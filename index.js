import stripAnsi from 'strip-ansi';
import {eastAsianWidth} from 'get-east-asian-width';

/**
Logic:
- Segment graphemes to match how terminals render clusters.
- Width rules:
	1. Skip non-printing clusters (Default_Ignorable, Control, pure Mark, lone Surrogates). Tabs are ignored by design.
	2. RGI emoji clusters (\p{RGI_Emoji}) are double-width.
	3. Minimally-qualified/unqualified emoji clusters (ZWJ sequences with 2+ Extended_Pictographic, or keycap sequences) are double-width.
	4. Otherwise use East Asian Width of the cluster's first visible code point, and add widths for trailing Halfwidth/Fullwidth Forms within the same cluster (e.g., dakuten/handakuten/prolonged sound mark).
*/

const segmenter = new Intl.Segmenter();

// Whole-cluster zero-width
const zeroWidthClusterRegex = /^(?:\p{Default_Ignorable_Code_Point}|\p{Control}|\p{Mark}|\p{Surrogate})+$/v;

// Pick the base scalar if the cluster starts with Prepend/Format/Marks
const leadingNonPrintingRegex = /^[\p{Default_Ignorable_Code_Point}\p{Control}\p{Format}\p{Mark}\p{Surrogate}]+/v;

// RGI emoji sequences
const rgiEmojiRegex = /^\p{RGI_Emoji}$/v;

// Detect minimally-qualified/unqualified emoji clusters (missing VS16)
// - ZWJ sequences with 2+ Extended_Pictographic (e.g., ❤‍🔥, 🏳‍🌈, ⛹‍♂)
// - Keycap sequences (e.g., #⃣, 0⃣)
const zwjRegex = /\u200D/;
const validKeycapRegex = /^[\d#*].*\u20E3/;
const extendedPictographicRegex = /\p{Extended_Pictographic}/gu;

function isDoubleWidthEmojiCluster(segment) {
	// Keycap sequences with valid base (0-9, #, *)
	if (validKeycapRegex.test(segment)) {
		return true;
	}

	// ZWJ sequences with 2+ Extended_Pictographic
	if (zwjRegex.test(segment)) {
		const matches = segment.match(extendedPictographicRegex);
		if (matches && matches.length >= 2) {
			return true;
		}
	}

	return false;
}

function baseVisible(segment) {
	return segment.replace(leadingNonPrintingRegex, '');
}

function isZeroWidthCluster(segment) {
	return zeroWidthClusterRegex.test(segment);
}

function trailingHalfwidthWidth(segment, eastAsianWidthOptions) {
	let extra = 0;
	if (segment.length > 1) {
		for (const char of segment.slice(1)) {
			if (char >= '\uFF00' && char <= '\uFFEF') {
				extra += eastAsianWidth(char.codePointAt(0), eastAsianWidthOptions);
			}
		}
	}

	return extra;
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

	if (!countAnsiEscapeCodes) {
		string = stripAnsi(string);
	}

	if (string.length === 0) {
		return 0;
	}

	let width = 0;
	const eastAsianWidthOptions = {ambiguousAsWide: !ambiguousIsNarrow};

	for (const {segment} of segmenter.segment(string)) {
		// Zero-width / non-printing clusters
		if (isZeroWidthCluster(segment)) {
			continue;
		}

		// Emoji width logic
		if (rgiEmojiRegex.test(segment) || isDoubleWidthEmojiCluster(segment)) {
			width += 2;
			continue;
		}

		// Everything else: EAW of the cluster’s first visible scalar
		const codePoint = baseVisible(segment).codePointAt(0);
		width += eastAsianWidth(codePoint, eastAsianWidthOptions);

		// Add width for trailing Halfwidth and Fullwidth Forms (e.g., ﾞ, ﾟ, ｰ)
		width += trailingHalfwidthWidth(segment, eastAsianWidthOptions);
	}

	return width;
}
