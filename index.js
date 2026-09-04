import stripAnsi from 'strip-ansi';
import {eastAsianWidth} from 'get-east-asian-width';

/**
Logic:
- Segment graphemes to match how terminals render clusters.
- Runs of characters that never join a neighbouring cluster (ASCII, most Latin, Greek, Cyrillic, CJK, Hangul syllables) are counted without segmenting; only the text around other characters is segmented.
- Width rules:
	1. Skip non-printing clusters (Default_Ignorable, Control, pure nonspacing/enclosing Mark, lone Surrogates). Tabs are ignored by design.
	2. RGI emoji clusters (\p{RGI_Emoji}) are double-width.
	3. Minimally-qualified/unqualified emoji clusters (ZWJ sequences with 2+ Extended_Pictographic, or keycap sequences) are double-width.
	4. Hangul jamo collapse each standard modern Hangul L+V or L+V+T syllable piece to width 2.
	   Unmatched repeated leading/vowel/trailing jamo stay additive because that matches how the terminals we target render them.
	5. Otherwise use East Asian Width of the cluster's first visible code point, and add widths for trailing spacing marks and Halfwidth/Fullwidth Forms within the same cluster (e.g., dakuten/handakuten/prolonged sound mark).
*/

const segmenter = new Intl.Segmenter();

// Whole-cluster zero-width
const zeroWidthClusterRegex = /^(?:\p{Default_Ignorable_Code_Point}|\p{Control}|\p{Format}|\p{Nonspacing_Mark}|\p{Enclosing_Mark}|\p{Surrogate})+$/v;

// Pick the base scalar if the cluster starts with Prepend/Format/Marks
const leadingNonPrintingRegex = /^[\p{Default_Ignorable_Code_Point}\p{Control}\p{Format}\p{Nonspacing_Mark}\p{Enclosing_Mark}\p{Surrogate}]+/v;
const spacingMarkRegex = /\p{Spacing_Mark}/v;

// RGI emoji sequences
const rgiEmojiRegex = /^\p{RGI_Emoji}$/v;

// Detect minimally-qualified/unqualified emoji sequences (missing VS16 but still render as double-width)
const unqualifiedKeycapRegex = /^[\d#*]\u20E3$/;
const extendedPictographicRegex = /\p{Extended_Pictographic}/gu;

function isDoubleWidthNonRgiEmojiSequence(segment) {
	// Real emoji clusters are < 30 chars; guard against pathological input
	if (segment.length > 50) {
		return false;
	}

	if (unqualifiedKeycapRegex.test(segment)) {
		return true;
	}

	// ZWJ sequences with 2+ Extended_Pictographic
	if (segment.includes('\u200D')) {
		const pictographics = segment.match(extendedPictographicRegex);
		return pictographics !== null && pictographics.length >= 2;
	}

	return false;
}

/*
Characters that never share a grapheme cluster with a neighbour from the same set (UAX #29 rules GB3 to GB13).
None of them is Extend, ZWJ, SpacingMark, Prepend, Regional_Indicator, Hangul jamo, Control, CR, LF or an Indic conjunct consonant or linker,
so between two of them GB999 (break everywhere) always applies. Extended_Pictographic characters qualify because joining them needs a ZWJ,
and precomposed Hangul syllables qualify because joining them needs a jamo. The test suite enumerates every code point of these ranges.
*/
export const _standaloneRanges = [
	[0x20, 0x7E], // Printable ASCII
	[0xA0, 0xAC], // Latin-1 Supplement up to the soft hyphen (U+00AD is Control)
	[0xAE, 0x2_FF], // Rest of Latin-1 Supplement, Latin Extended-A and B, IPA Extensions, Spacing Modifier Letters
	[0x3_70, 0x3_FF], // Greek and Coptic
	[0x4_00, 0x4_82], // Cyrillic up to the combining marks (U+0483 to U+0489)
	[0x4_8A, 0x5_2F], // Rest of Cyrillic, Cyrillic Supplement
	[0x1E_00, 0x1F_FF], // Latin Extended Additional, Greek Extended
	[0x20_00, 0x20_0A], // Spaces (U+200B to U+200F are Format)
	[0x20_10, 0x20_27], // Dashes, quotes, bullets, ellipsis (U+2028 to U+202E are separators and Format)
	[0x20_30, 0x20_5E], // Rest of General Punctuation (U+2060 to U+206F are Format)
	[0x20_70, 0x20_CF], // Superscripts and Subscripts, Currency Symbols (U+20D0 to U+20FF are combining marks)
	[0x21_00, 0x2B_FF], // Letterlike Symbols to Miscellaneous Symbols and Arrows: arrows, math, box drawing, shapes, symbols, dingbats
	[0x30_00, 0x30_29], // CJK Symbols and Punctuation (U+302A to U+302F are combining marks)
	[0x30_30, 0x30_98], // Rest of CJK Symbols and Punctuation, Hiragana (U+3099 and U+309A are combining marks)
	[0x30_9B, 0x30_FF], // Rest of Hiragana, Katakana
	[0x31_00, 0x31_63], // Bopomofo, Hangul Compatibility Jamo (U+3164 is default ignorable)
	[0x31_65, 0x33_FF], // Rest of Hangul Compatibility Jamo, Kanbun, Enclosed CJK Letters and Months, CJK Compatibility
	[0x34_00, 0x4D_BF], // CJK Unified Ideographs Extension A
	[0x4E_00, 0x9F_FF], // CJK Unified Ideographs
	[0xAC_00, 0xD7_A3], // Hangul Syllables
	[0xF9_00, 0xFA_FF], // CJK Compatibility Ideographs
	[0xFF_01, 0xFF_9D], // Fullwidth ASCII variants, Halfwidth Katakana (U+FF9E and U+FF9F are Extend)
	[0xFF_E0, 0xFF_EE], // Fullwidth and halfwidth signs
	[0x2_00_00, 0x2_FA_1F], // CJK Unified Ideographs Extensions B to F and I, CJK Compatibility Ideographs Supplement
	[0x3_00_00, 0x3_23_AF], // CJK Unified Ideographs Extensions G and H
];

const standaloneRunRegex = new RegExp(`[${_standaloneRanges.map(([start, end]) => `\\u{${start.toString(16)}}-\\u{${end.toString(16)}}`).join('')}]+`, 'gu');

// Segmenting a slice costs about as much as classifying a dozen single code point clusters, so a run in the middle of the string is only skipped when it is long enough to pay for the extra slice
const minimumInnerRunLength = 16;

function isPrintableAscii(codePoint) {
	return codePoint >= 0x20 && codePoint <= 0x7E;
}

function baseVisible(segment) {
	return segment.replace(leadingNonPrintingRegex, '');
}

function isZeroWidthCluster(segment) {
	return zeroWidthClusterRegex.test(segment);
}

function isHangulLeadingJamo(codePoint) {
	return (codePoint >= 0x11_00 && codePoint <= 0x11_5F)
		|| (codePoint >= 0xA9_60 && codePoint <= 0xA9_7C);
}

function isHangulVowelJamo(codePoint) {
	return (codePoint >= 0x11_60 && codePoint <= 0x11_A7)
		|| (codePoint >= 0xD7_B0 && codePoint <= 0xD7_C6);
}

function isHangulTrailingJamo(codePoint) {
	return (codePoint >= 0x11_A8 && codePoint <= 0x11_FF)
		|| (codePoint >= 0xD7_CB && codePoint <= 0xD7_FB);
}

function isHangulJamo(codePoint) {
	return isHangulLeadingJamo(codePoint)
		|| isHangulVowelJamo(codePoint)
		|| isHangulTrailingJamo(codePoint);
}

function hangulClusterWidth(visibleSegment, eastAsianWidthOptions) {
	const codePoints = [];

	for (const character of visibleSegment) {
		if (zeroWidthClusterRegex.test(character)) {
			continue;
		}

		codePoints.push(character.codePointAt(0));
	}

	if (codePoints.length === 0) {
		return undefined;
	}

	let width = 0;

	for (let index = 0; index < codePoints.length; index++) {
		const codePoint = codePoints[index];
		if (!isHangulJamo(codePoint)) {
			if (width === 0) {
				return undefined;
			}

			// Mixed cluster (e.g., L + precomposed syllable): use EAW for non-jamo remainder
			for (let remaining = index; remaining < codePoints.length; remaining++) {
				width += eastAsianWidth(codePoints[remaining], eastAsianWidthOptions);
			}

			return width;
		}

		// Modern Hangul L+V(+T) shapes as one syllable block. Unmatched jamo stay additive:
		// U+1100 U+1100 U+1161 => U+1100 + (U+1100 U+1161) => 2 + 2.
		if (
			isHangulLeadingJamo(codePoint)
			&& isHangulVowelJamo(codePoints[index + 1])
		) {
			width += 2;
			index += isHangulTrailingJamo(codePoints[index + 2]) ? 2 : 1;
			continue;
		}

		width += eastAsianWidth(codePoint, eastAsianWidthOptions);
	}

	return width;
}

function trailingWidth(visibleSegment, eastAsianWidthOptions) {
	let extra = 0;
	let first = true;

	for (const character of visibleSegment) {
		if (first) {
			first = false;
			continue;
		}

		if (
			spacingMarkRegex.test(character)
			|| (character >= '\uFF00' && character <= '\uFFEF')
		) {
			extra += eastAsianWidth(character.codePointAt(0), eastAsianWidthOptions);
		}
	}

	return extra;
}

function clusterWidth(segment, eastAsianWidthOptions) {
	// Zero-width / non-printing clusters
	if (isZeroWidthCluster(segment)) {
		return 0;
	}

	// Emoji width logic
	if (rgiEmojiRegex.test(segment) || isDoubleWidthNonRgiEmojiSequence(segment)) {
		return 2;
	}

	const visibleSegment = baseVisible(segment);
	const hangulWidth = hangulClusterWidth(visibleSegment, eastAsianWidthOptions);
	if (hangulWidth !== undefined) {
		return hangulWidth;
	}

	// Everything else: EAW of the cluster’s first visible scalar, plus trailing spacing marks and Halfwidth/Fullwidth Forms (e.g., ﾞ, ﾟ, ｰ)
	const codePoint = visibleSegment.codePointAt(0);
	return eastAsianWidth(codePoint, eastAsianWidthOptions) + trailingWidth(visibleSegment, eastAsianWidthOptions);
}

// The width of a single code point cluster depends only on the code point and the ambiguous width option, so cache it per option
const narrowCodePointWidths = new Map();
const wideCodePointWidths = new Map();
const maximumCachedCodePoints = 2048;

function codePointWidth(codePoint, eastAsianWidthOptions) {
	const cache = eastAsianWidthOptions.ambiguousAsWide ? wideCodePointWidths : narrowCodePointWidths;
	let width = cache.get(codePoint);

	if (width === undefined) {
		width = clusterWidth(String.fromCodePoint(codePoint), eastAsianWidthOptions);

		if (cache.size >= maximumCachedCodePoints) {
			cache.clear();
		}

		cache.set(codePoint, width);
	}

	return width;
}

function segmentedWidth(string, eastAsianWidthOptions) {
	let width = 0;

	for (const {segment} of segmenter.segment(string)) {
		const codePoint = segment.codePointAt(0);

		// A lone printable ASCII character is always width 1, so skip the cluster checks
		if (segment.length === 1 && isPrintableAscii(codePoint)) {
			width += 1;
			continue;
		}

		// Single code point clusters are by far the most common and repeat a lot, so use the cache
		if (segment.length === (codePoint > 0xFF_FF ? 2 : 1)) {
			width += codePointWidth(codePoint, eastAsianWidthOptions);
			continue;
		}

		width += clusterWidth(segment, eastAsianWidthOptions);
	}

	return width;
}

function isLowSurrogate(codeUnit) {
	return codeUnit >= 0xDC_00 && codeUnit <= 0xDF_FF;
}

// Width of a run of standalone characters: every one is its own cluster
function standaloneRunWidth(string, start, end, eastAsianWidthOptions) {
	let width = 0;

	for (let index = start; index < end;) {
		const codePoint = string.codePointAt(index);
		index += codePoint > 0xFF_FF ? 2 : 1;
		width += codePoint <= 0x7E ? 1 : codePointWidth(codePoint, eastAsianWidthOptions);
	}

	return width;
}

function textWidth(string, eastAsianWidthOptions) {
	const {length} = string;
	let width = 0;

	// Start of the text that still has to be segmented
	let pendingStart = 0;

	// Runs of standalone characters are counted one code point at a time; only the text around other
	// characters is segmented. The first and last character of a run may still join a cluster with a
	// neighbouring character (combining marks, ZWJ, keycaps, prepends), so they are left to the
	// segmenter unless the run touches the start or end of the string.
	standaloneRunRegex.lastIndex = 0;
	for (let match = standaloneRunRegex.exec(string); match !== null; match = standaloneRunRegex.exec(string)) {
		const runStart = match.index;
		const runEnd = standaloneRunRegex.lastIndex;
		// Step over whole code points: the first or last character of the run may be a surrogate pair
		const skipStart = runStart === 0 ? 0 : runStart + (string.codePointAt(runStart) > 0xFF_FF ? 2 : 1);
		const skipEnd = runEnd === length ? length : runEnd - (isLowSurrogate(string.codePointAt(runEnd - 1)) ? 2 : 1);
		const isInnerRun = runStart > 0 && runEnd < length;

		if (skipEnd <= skipStart || (isInnerRun && skipEnd - skipStart < minimumInnerRunLength)) {
			continue;
		}

		if (skipStart > pendingStart) {
			width += segmentedWidth(string.slice(pendingStart, skipStart), eastAsianWidthOptions);
		}

		width += standaloneRunWidth(string, skipStart, skipEnd, eastAsianWidthOptions);
		pendingStart = skipEnd;
	}

	if (pendingStart < length) {
		width += segmentedWidth(pendingStart === 0 ? string : string.slice(pendingStart), eastAsianWidthOptions);
	}

	return width;
}

export default function stringWidth(input, options = {}) {
	if (typeof input !== 'string' || input.length === 0) {
		return 0;
	}

	const {
		ambiguousIsNarrow = true,
		countAnsiEscapeCodes = false,
	} = options;

	let string = input;

	// Avoid calling stripAnsi when there are no ANSI escape sequences (ESC = 0x1B, CSI = 0x9B)
	if (!countAnsiEscapeCodes && (string.includes('\u001B') || string.includes('\u009B'))) {
		string = stripAnsi(string);
	}

	if (string.length === 0) {
		return 0;
	}

	// Fast path: printable ASCII (0x20–0x7E) needs no segmenter, regex, or EAW lookup — width equals length.
	if (/^[\u0020-\u007E]*$/.test(string)) {
		return string.length;
	}

	return textWidth(string, {ambiguousAsWide: !ambiguousIsNarrow});
}
