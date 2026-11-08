import stripAnsi from 'strip-ansi';
import {eastAsianWidth} from 'get-east-asian-width';

/**
Logic:
- Segment graphemes to match how terminals render clusters.
- Width rules:
	1. Skip non-printing clusters (Default_Ignorable, Control, pure nonspacing/enclosing Mark, lone Surrogates). Tabs are ignored by design.
	2. Clusters starting with an RGI emoji (\p{RGI_Emoji}), regional indicators, or a digit/#/* with VS16 are double-width, even with trailing extenders (e.g., a dangling ZWJ, an extra variation selector, or a spacing mark). Only a stray emoji modifier adds its own swatch width.
	   A wide BMP emoji followed by VS15 (text presentation) is one column; anything after the VS15 is ignored.
	3. Minimally-qualified emoji ZWJ sequences (2+ Extended_Pictographic) are double-width, except that a stray emoji modifier after the sequence adds its own swatch width. An unqualified keycap (no VS16) is text, so it uses the width of its base.
	4. Hangul jamo collapse each standard modern Hangul L+V or L+V+T syllable piece to width 2.
	   Unmatched repeated leading/vowel/trailing jamo stay additive because that matches how the terminals we target render them.
	5. Otherwise sum the East Asian Width of every visible code point in the cluster, stopping at a ZWJ.
*/

const segmenter = new Intl.Segmenter();

// Matches a visible (printing) character. Used to find the base scalar of a cluster (skipping leading Prepend/Format/Marks) and to detect whole-cluster zero-width.
// Intentionally a single negated class without a quantifier: a repeated pattern like `^(?:…|…)+$` backtracks exponentially on overlapping properties, and even `^[…]+$` overflows V8's backtrack stack (RangeError) on clusters with millions of marks.
const visibleCharacterRegex = /[^\p{Default_Ignorable_Code_Point}\p{Control}\p{Enclosing_Mark}\p{Format}\p{Nonspacing_Mark}\p{Surrogate}]/v;

// Clusters starting with an RGI emoji sequence. Not anchored at the end, so trailing extenders (ZWJ, marks, variation selectors) in the same cluster do not hide the emoji.
// Regional indicators that do not form a valid flag (alone, or an unknown pair) are also shown as one wide symbol, and so is a digit, number sign, or asterisk with VS16 (an emoji presentation sequence that is not RGI on its own).
const rgiEmojiRegex = /^(?:\p{RGI_Emoji}|\p{Regional_Indicator}{1,2}|[\d#*]\u{FE0F})/v;

// A wide BMP emoji followed by VS15 asks for its narrow text style. Every BMP Emoji_Presentation character has a standardized text variation sequence.
// Limitation: astral emoji (e.g., 👍︎) keep their width, because only some of them have a text variation sequence and terminals disagree.
const textPresentationEmojiRegex = /^[\p{Emoji_Presentation}--[\u{10000}-\u{10FFFF}]]\u{FE0E}/v;

// An emoji modifier that does not follow an emoji modifier base (or a ZWJ) is shown as a standalone color swatch (UTS #51)
const strayEmojiModifierRegex = /(?<![\p{Emoji_Modifier_Base}\u{200D}])\p{Emoji_Modifier}/gv;

// Counts the stray emoji modifiers at or after `fromIndex`. Searches the whole string so the lookbehind sees the character before the first one.
function strayEmojiModifierCount(string, fromIndex) {
	// Most emoji clusters are fully consumed by the emoji match
	if (fromIndex >= string.length) {
		return 0;
	}

	let count = 0;
	for (const match of string.matchAll(strayEmojiModifierRegex)) {
		if (match.index >= fromIndex) {
			count++;
		}
	}

	return count;
}

// Detect minimally-qualified emoji ZWJ sequences (missing VS16 but still render as double-width)
// A ZWJ only joins a following Extended_Pictographic into the cluster when an Extended_Pictographic comes before it (GB11), so this means 2+ Extended_Pictographic joined by a ZWJ.
const emojiZwjSequenceRegex = /\u{200D}\p{Extended_Pictographic}/v;

// Returns the cluster starting at its first visible character, or `undefined` if the whole cluster is zero-width.
function baseVisible(segment) {
	const index = segment.search(visibleCharacterRegex);
	return index === -1 ? undefined : segment.slice(index);
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
		if (!visibleCharacterRegex.test(character)) {
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

// Sums the East Asian Width of the visible code points of a cluster.
// Everything visible after the base still takes columns: spacing marks (Grapheme_Cluster_Break=SpacingMark, including Thai/Lao AM which are Lo), an emoji modifier not consumed by an emoji modifier sequence (shown as a standalone swatch), the consonants of an Indic conjunct joined by a virama (GB9c), and halfwidth dakuten/handakuten. A ZWJ ends the counting.
function visibleCodePointsWidth(visibleSegment, eastAsianWidthOptions) {
	let width = 0;

	for (const character of visibleSegment) {
		// A ZWJ joins the rest of the cluster into one glyph (e.g., an explicit Indic half-form conjunct)
		if (character === '\u{200D}') {
			break;
		}

		if (visibleCharacterRegex.test(character)) {
			width += eastAsianWidth(character.codePointAt(0), eastAsianWidthOptions);
		}
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
	if (!countAnsiEscapeCodes && (string.includes('\u{1B}') || string.includes('\u{9B}'))) {
		string = stripAnsi(string);
	}

	if (string.length === 0) {
		return 0;
	}

	// Fast path: printable ASCII (0x20–0x7E) needs no segmenter, regex, or EAW lookup — width equals length.
	// A negated class without a quantifier, since `^[…]*$` overflows V8's backtrack stack (RangeError) on strings with millions of characters.
	if (!/[^\u{20}-\u{7E}]/v.test(string)) {
		return string.length;
	}

	let width = 0;
	const eastAsianWidthOptions = {ambiguousAsWide: !ambiguousIsNarrow};

	for (const {segment} of segmenter.segment(string)) {
		// Zero-width / non-printing clusters
		const visibleSegment = baseVisible(segment);
		if (visibleSegment === undefined) {
			continue;
		}

		if (textPresentationEmojiRegex.test(visibleSegment)) {
			width += 1;
			continue;
		}

		// Emoji matching uses the visible prefix so extenders do not hide an emoji
		const emoji = rgiEmojiRegex.exec(visibleSegment);
		if (emoji) {
			width += 2 + (strayEmojiModifierCount(visibleSegment, emoji[0].length) * 2);
			continue;
		}

		const zwjSequence = emojiZwjSequenceRegex.exec(visibleSegment);
		if (zwjSequence) {
			width += 2 + (strayEmojiModifierCount(visibleSegment, zwjSequence.index + zwjSequence[0].length) * 2);
			continue;
		}

		const hangulWidth = hangulClusterWidth(visibleSegment, eastAsianWidthOptions);
		if (hangulWidth !== undefined) {
			width += hangulWidth;
			continue;
		}

		// Sum visible scalars, stopping at a ZWJ
		width += visibleCodePointsWidth(visibleSegment, eastAsianWidthOptions);
	}

	return width;
}
