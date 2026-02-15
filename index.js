import stripAnsi from 'strip-ansi';
import {eastAsianWidth} from 'get-east-asian-width';

/**
Logic:
- Segment graphemes to match how terminals render clusters.
- Width rules:
	1. Skip non-printing clusters (Default_Ignorable, Control, pure Mark, lone Surrogates). Tabs are ignored by design.
	2. RGI emoji clusters (\p{RGI_Emoji}) are double-width.
	3. Otherwise use East Asian Width of the cluster’s first visible code point, and add widths for trailing Halfwidth/Fullwidth Forms within the same cluster (e.g., dakuten/handakuten/prolonged sound mark).
*/

const segmenter = new Intl.Segmenter();

// Whole-cluster zero-width
const zeroWidthClusterRegex = /^(?:\p{Default_Ignorable_Code_Point}|\p{Control}|\p{Format}|\p{Mark}|\p{Surrogate})+$/v;

// Pick the base scalar if the cluster starts with Prepend/Format/Marks
const leadingNonPrintingRegex = /^[\p{Default_Ignorable_Code_Point}\p{Control}\p{Format}\p{Mark}\p{Surrogate}]+/v;

// RGI emoji sequences
const rgiEmojiRegex = /^\p{RGI_Emoji}$/v;

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

// eslint-disable-next-line complexity
export default function stringWidth(input, options = {}) {
	if (typeof input !== 'string' || input.length === 0) {
		return 0;
	}

	const {
		ambiguousIsNarrow = true,
		countAnsiEscapeCodes = false,
	} = options;

	let string = input;

	// Avoid calling stripAnsi when there are no ANSI escape sequences (ESC = 0x1B)
	if (!countAnsiEscapeCodes && string.includes('\u001B')) {
		string = stripAnsi(string);
	}

	if (string.length === 0) {
		return 0;
	}

	// Fast path: printable ASCII (0x20–0x7E) needs no segmenter, regex, or EAW lookup — width equals length.
	// This covers the majority of real-world terminal strings (log messages, CLI output, prompts).
	let isAscii = true;
	for (let index = 0; index < string.length; index += 1) {
		const code = string.codePointAt(index);
		if (code < 32 || code > 126) {
			isAscii = false;
			break;
		}
	}

	if (isAscii) {
		return string.length;
	}

	const eastAsianWidthOptions = {ambiguousAsWide: !ambiguousIsNarrow};

	// Try per-codepoint iteration first — avoids Intl.Segmenter overhead (~2–4µs per call).
	// Bail to segmenter only when we encounter characters that form multi-codepoint grapheme clusters
	// (emoji ZWJ sequences, flags, skin tones, keycaps, tag sequences).
	let width = 0;
	let useSegmenter = false;

	for (const character of string) {
		const codePoint = character.codePointAt(0);

		// These characters join with adjacent codepoints into multi-codepoint grapheme clusters,
		// changing the combined width. Fall back to Intl.Segmenter for correctness.
		if (
			codePoint === 0x20_0D // ZWJ — joins emoji sequences (e.g., 👩‍👩‍👧‍👦)
			|| codePoint === 0xFE_0F // VS16 — emoji presentation (e.g., ❤️ vs ❤)
			|| codePoint === 0x20_E3 // Combining Enclosing Keycap (e.g., 1️⃣)
			|| (codePoint >= 0x1_F1_E6 && codePoint <= 0x1_F1_FF) // Regional Indicators (flags, e.g., 🇺🇸)
			|| (codePoint >= 0x1_F3_FB && codePoint <= 0x1_F3_FF) // Skin Tone Modifiers
			|| (codePoint >= 0xE_00_20 && codePoint <= 0xE_00_7F) // Tag characters (subdivision flags)
		) {
			useSegmenter = true;
			break;
		}

		// Printable ASCII (0x20–0x7E) is always width 1 and never zero-width
		if (codePoint >= 0x20 && codePoint < 0x7F) {
			width += 1;
			continue;
		}

		// Wide/fullwidth/ambiguous (when configured) → width 2; always visible, skip zero-width check
		if (eastAsianWidth(codePoint, eastAsianWidthOptions) === 2) {
			width += 2;
			continue;
		}

		// Latin1 through Spacing Modifier Letters (0xA0–0x2FF, except soft hyphen 0xAD)
		// are all visible width-1 characters (ambiguous ones already caught above)
		if (codePoint >= 0xA0 && codePoint < 0x3_00 && codePoint !== 0xAD) {
			width += 1;
			continue;
		}

		// Remaining: check if zero-width (Control, Format, Mark, Default_Ignorable)
		if (isZeroWidthCluster(character)) {
			continue;
		}

		width += 1;
	}

	if (!useSegmenter) {
		return width;
	}

	// Slow path: use Intl.Segmenter for strings with multi-codepoint grapheme clusters
	width = 0;

	for (const {segment} of segmenter.segment(string)) {
		// Single BMP codepoint — skip regex tests for known-width characters
		if (segment.length === 1) {
			const codePoint = segment.codePointAt(0);

			if (eastAsianWidth(codePoint, eastAsianWidthOptions) === 2) {
				width += 2;
				continue;
			}

			if (codePoint >= 0x20 && codePoint < 0x7F) {
				width += 1;
				continue;
			}

			if (codePoint >= 0xA0 && codePoint < 0x3_00 && codePoint !== 0xAD) {
				width += 1;
				continue;
			}
		}

		// Zero-width / non-printing clusters
		if (isZeroWidthCluster(segment)) {
			continue;
		}

		// Emoji width logic
		if (rgiEmojiRegex.test(segment)) {
			width += 2;
			continue;
		}

		// Everything else: EAW of the cluster's first visible scalar
		const codePoint = baseVisible(segment).codePointAt(0);
		width += eastAsianWidth(codePoint, eastAsianWidthOptions);

		// Add width for trailing Halfwidth and Fullwidth Forms (e.g., ﾞ, ﾟ, ｰ)
		width += trailingHalfwidthWidth(segment, eastAsianWidthOptions);
	}

	return width;
}
