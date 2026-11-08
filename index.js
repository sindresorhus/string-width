import stripAnsi from 'strip-ansi';
import {eastAsianWidth} from 'get-east-asian-width';

/**
Logic:
- Segment graphemes to match how terminals render clusters.
- Width rules:
	1. Skip non-printing clusters (Default_Ignorable, Control, Format except prepended concatenation marks like ARABIC NUMBER SIGN, pure nonspacing/enclosing Mark). Tabs are ignored by design. Lone surrogates are measured as U+FFFD, which is how they are written out.
	2. Clusters starting with an RGI emoji (\p{RGI_Emoji}), regional indicators, or a digit/#/* with VS16 are double-width, even with trailing extenders (e.g., a dangling ZWJ, an extra variation selector, or a spacing mark). Only a stray emoji modifier adds its own swatch width.
	   A wide BMP emoji followed by VS15 (text presentation) is one column; anything after the VS15 is ignored.
	3. Minimally-qualified emoji ZWJ sequences (2+ Extended_Pictographic) are double-width, except that a stray emoji modifier after the sequence adds its own swatch width. An unqualified keycap (no VS16) is text, so it uses the width of its base.
	4. A cluster starting with Hangul (jamo or a precomposed syllable) is one syllable block with the width of its first code point (plus stray emoji modifiers), as in iTerm, Ghostty, and kitty.
	5. Otherwise sum the East Asian Width of every visible code point in the cluster: the base plus trailing spacing marks (including Thai/Lao AM), stray emoji modifiers, Indic conjunct consonants, and halfwidth dakuten/handakuten. Nothing after a ZWJ is counted.
	6. Prepended concatenation marks (e.g., ARABIC NUMBER SIGN before digits) are one column each, unless the following glyph is wide (East Asian Wide or emoji, but not in VS15 text style), which takes them into its own cell.
*/

const segmenter = new Intl.Segmenter();

// Prepended_Concatenation_Mark: Grapheme_Cluster_Break=Prepend format characters (e.g., ARABIC NUMBER SIGN) that are visible signs spanning the following characters
const prependedConcatenationMarks = String.raw`\u{600}-\u{605}\u{6DD}\u{70F}\u{890}\u{891}\u{8E2}\u{110BD}\u{110CD}`;
const prependedConcatenationMarksRegex = new RegExp(`^[${prependedConcatenationMarks}]+`, 'v');

// Matches a visible (printing) character. Used to find the base scalar of a cluster (skipping leading Format characters and marks), to detect whole-cluster zero-width, and to skip invisible code points when summing widths.
// Intentionally a single negated class without a quantifier: a repeated pattern like `^(?:…|…)+$` backtracks exponentially on overlapping properties, and even `^[…]+$` overflows V8's backtrack stack (RangeError) on clusters with millions of marks.
// Line and paragraph separators (U+2028, U+2029) are intentionally not skipped: iTerm, Terminal.app, and kitty show them as one column.
const visibleCharacterRegex = new RegExp(String.raw`[^\p{Default_Ignorable_Code_Point}\p{Control}\p{Enclosing_Mark}\p{Nonspacing_Mark}[\p{Format}--[${prependedConcatenationMarks}]]]`, 'v');

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

// Hangul jamo (U+1100..U+11FF, Hangul Jamo Extended-A and -B) and precomposed syllables. Includes the Default_Ignorable HANGUL CHOSEONG/JUNGSEONG FILLER (U+115F, U+1160), which start a syllable block in place of a missing jamo.
function isHangul(codePoint) {
	return (codePoint >= 0x11_00 && codePoint <= 0x11_FF)
		|| (codePoint >= 0xA9_60 && codePoint <= 0xA9_7C)
		|| (codePoint >= 0xAC_00 && codePoint <= 0xD7_A3)
		|| (codePoint >= 0xD7_B0 && codePoint <= 0xD7_C6)
		|| (codePoint >= 0xD7_CB && codePoint <= 0xD7_FB);
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

function clusterWidth(segment, eastAsianWidthOptions) {
	// Prepended concatenation marks (e.g., ARABIC NUMBER SIGN) are visible one-column signs that join the next character. A wide glyph (East Asian Wide or emoji, but not a VS15 text style) takes them into its own cell.
	// The marks are in U+0600..U+08FF plus U+110BD and U+110CD, so most clusters skip the regex
	const firstCodePoint = segment.codePointAt(0);
	const marks = firstCodePoint === 0x1_10_BD || firstCodePoint === 0x1_10_CD || (firstCodePoint >= 0x6_00 && firstCodePoint <= 0x8_FF) ? prependedConcatenationMarksRegex.exec(segment) : undefined;
	if (marks) {
		const rest = segment.slice(marks[0].length);
		const restWidth = clusterWidth(rest, eastAsianWidthOptions);
		const visibleRest = baseVisible(rest);
		const isWideGlyph = restWidth >= 2 && (
			eastAsianWidth(visibleRest.codePointAt(0), eastAsianWidthOptions) === 2
			|| rgiEmojiRegex.test(visibleRest)
			|| emojiZwjSequenceRegex.test(visibleRest)
		);
		return isWideGlyph ? restWidth : [...marks[0]].length + restWidth;
	}

	// Zero-width / non-printing clusters (including a Hangul filler with only invisible extenders)
	const visibleSegment = baseVisible(segment);
	if (visibleSegment === undefined) {
		return 0;
	}

	// Checked on the raw cluster, since it can start with a Default_Ignorable filler
	if (isHangul(firstCodePoint)) {
		return eastAsianWidth(firstCodePoint, eastAsianWidthOptions) + (strayEmojiModifierCount(segment, 1) * 2);
	}

	if (textPresentationEmojiRegex.test(visibleSegment)) {
		return 1;
	}

	// Emoji width logic. Uses the visible part, so leading invisible characters do not hide the emoji.
	const emoji = rgiEmojiRegex.exec(visibleSegment);
	if (emoji) {
		return 2 + (strayEmojiModifierCount(visibleSegment, emoji[0].length) * 2);
	}

	// Minimally-qualified emoji ZWJ sequences are double-width, like RGI emoji, except that a stray emoji modifier after the sequence is shown as its own swatch. Everything else: EAW of the cluster’s visible scalars, including trailing spacing marks and Halfwidth/Fullwidth Forms (e.g., ﾞ, ﾟ)
	const zwjSequence = emojiZwjSequenceRegex.exec(visibleSegment);
	return zwjSequence
		? 2 + (strayEmojiModifierCount(visibleSegment, zwjSequence.index + zwjSequence[0].length) * 2)
		: visibleCodePointsWidth(visibleSegment, eastAsianWidthOptions);
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

	// Fast path: printable ASCII (0x20–0x7E) needs no segmenter, regex, or EAW lookup — width equals length.
	// A negated class without a quantifier, since `^[…]*$` overflows V8's backtrack stack (RangeError) on strings with millions of characters.
	if (!/[^\u{20}-\u{7E}]/v.test(string)) {
		return string.length;
	}

	// A lone surrogate is written out as U+FFFD REPLACEMENT CHARACTER
	string = string.toWellFormed();

	// Kirat Rai vowel runs form one glyph, including canonically decomposed vowels. Collapse them before segmentation so older Unicode tables give the same width.
	string = string.replaceAll(/(?<=[\u{16D63}-\u{16D6A}])[\u{16D63}-\u{16D6A}]+/gv, '');

	let width = 0;
	const eastAsianWidthOptions = {ambiguousAsWide: !ambiguousIsNarrow};

	for (const {segment} of segmenter.segment(string)) {
		// Fast path: a single visible UTF-16 code unit has its East Asian Width under every rule above (a single-code-point RGI emoji is East Asian Wide, and a Hangul cluster uses the width of its first code point).
		if (segment.length === 1) {
			if (visibleCharacterRegex.test(segment)) {
				width += eastAsianWidth(segment.codePointAt(0), eastAsianWidthOptions);
			}

			continue;
		}

		width += clusterWidth(segment, eastAsianWidthOptions);
	}

	return width;
}
