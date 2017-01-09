'use strict';
const stripAnsi = require('strip-ansi');
const isFullwidthCodePoint = require('is-fullwidth-code-point');
const codePointAt = require('code-point-at');

function stringWidth(ambiguousCharWidth) {
	return function (str) {
		if (typeof str !== 'string' || str.length === 0) {
			return 0;
		}

		let width = 0;

		str = stripAnsi(str);

		for (let i = 0; i < str.length; i++) {
			const code = codePointAt(str, i);

			// ignore control characters
			if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) {
				continue;
			}

			// surrogates
			if (code >= 0x10000) {
				i++;
			}

			// could be 1 or 2
			if (ambiguousChar(code)) {
				width += ambiguousCharWidth;
				continue;
			}

			if (isFullwidthCodePoint(code)) {
				width += 2;
			} else {
				width++;
			}
		}

		return width;
	};

	function ambiguousChar(code) {
		if ((code === 0x00A1) ||
			(code === 0x00A4) ||
			(code >= 0x00A7 && code <= 0x00A8) ||
			(code === 0x00AA) ||
			(code >= 0x00AD && code <= 0x00AE) ||
			(code >= 0x00B0 && code <= 0x00B4) ||
			(code >= 0x00B6 && code <= 0x00BA) ||
			(code >= 0x00BC && code <= 0x00BF) ||
			(code === 0x00C6) ||
			(code === 0x00D0) ||
			(code >= 0x00D7 && code <= 0x00D8) ||
			(code >= 0x00DE && code <= 0x00E1) ||
			(code === 0x00E6) ||
			(code >= 0x00E8 && code <= 0x00EA) ||
			(code >= 0x00EC && code <= 0x00ED) ||
			(code === 0x00F0) ||
			(code >= 0x00F2 && code <= 0x00F3) ||
			(code >= 0x00F7 && code <= 0x00FA) ||
			(code === 0x00FC) ||
			(code === 0x00FE) ||
			(code === 0x0101) ||
			(code === 0x0111) ||
			(code === 0x0113) ||
			(code === 0x011B) ||
			(code >= 0x0126 && code <= 0x0127) ||
			(code === 0x012B) ||
			(code >= 0x0131 && code <= 0x0133) ||
			(code === 0x0138) ||
			(code >= 0x013F && code <= 0x0142) ||
			(code === 0x0144) ||
			(code >= 0x0148 && code <= 0x014B) ||
			(code === 0x014D) ||
			(code >= 0x0152 && code <= 0x0153) ||
			(code >= 0x0166 && code <= 0x0167) ||
			(code === 0x016B) ||
			(code === 0x01CE) ||
			(code === 0x01D0) ||
			(code === 0x01D2) ||
			(code === 0x01D4) ||
			(code === 0x01D6) ||
			(code === 0x01D8) ||
			(code === 0x01DA) ||
			(code === 0x01DC) ||
			(code === 0x0251) ||
			(code === 0x0261) ||
			(code === 0x02C4) ||
			(code === 0x02C7) ||
			(code >= 0x02C9 && code <= 0x02CB) ||
			(code === 0x02CD) ||
			(code === 0x02D0) ||
			(code >= 0x02D8 && code <= 0x02DB) ||
			(code === 0x02DD) ||
			(code === 0x02DF) ||
			(code >= 0x0300 && code <= 0x036F) ||
			(code >= 0x0391 && code <= 0x03A1) ||
			(code >= 0x03A3 && code <= 0x03A9) ||
			(code >= 0x03B1 && code <= 0x03C1) ||
			(code >= 0x03C3 && code <= 0x03C9) ||
			(code === 0x0401) ||
			(code >= 0x0410 && code <= 0x044F) ||
			(code === 0x0451) ||
			(code === 0x2010) ||
			(code >= 0x2013 && code <= 0x2016) ||
			(code >= 0x2018 && code <= 0x2019) ||
			(code >= 0x201C && code <= 0x201D) ||
			(code >= 0x2020 && code <= 0x2022) ||
			(code >= 0x2024 && code <= 0x2027) ||
			(code === 0x2030) ||
			(code >= 0x2032 && code <= 0x2033) ||
			(code === 0x2035) ||
			(code === 0x203B) ||
			(code === 0x203E) ||
			(code === 0x2074) ||
			(code === 0x207F) ||
			(code >= 0x2081 && code <= 0x2084) ||
			(code === 0x20AC) ||
			(code === 0x2103) ||
			(code === 0x2105) ||
			(code === 0x2109) ||
			(code === 0x2113) ||
			(code === 0x2116) ||
			(code >= 0x2121 && code <= 0x2122) ||
			(code === 0x2126) ||
			(code === 0x212B) ||
			(code >= 0x2153 && code <= 0x2154) ||
			(code >= 0x215B && code <= 0x215E) ||
			(code >= 0x2160 && code <= 0x216B) ||
			(code >= 0x2170 && code <= 0x2179) ||
			(code === 0x2189) ||
			(code >= 0x2190 && code <= 0x2199) ||
			(code >= 0x21B8 && code <= 0x21B9) ||
			(code === 0x21D2) ||
			(code === 0x21D4) ||
			(code === 0x21E7) ||
			(code === 0x2200) ||
			(code >= 0x2202 && code <= 0x2203) ||
			(code >= 0x2207 && code <= 0x2208) ||
			(code === 0x220B) ||
			(code === 0x220F) ||
			(code === 0x2211) ||
			(code === 0x2215) ||
			(code === 0x221A) ||
			(code >= 0x221D && code <= 0x2220) ||
			(code === 0x2223) ||
			(code === 0x2225) ||
			(code >= 0x2227 && code <= 0x222C) ||
			(code === 0x222E) ||
			(code >= 0x2234 && code <= 0x2237) ||
			(code >= 0x223C && code <= 0x223D) ||
			(code === 0x2248) ||
			(code === 0x224C) ||
			(code === 0x2252) ||
			(code >= 0x2260 && code <= 0x2261) ||
			(code >= 0x2264 && code <= 0x2267) ||
			(code >= 0x226A && code <= 0x226B) ||
			(code >= 0x226E && code <= 0x226F) ||
			(code >= 0x2282 && code <= 0x2283) ||
			(code >= 0x2286 && code <= 0x2287) ||
			(code === 0x2295) ||
			(code === 0x2299) ||
			(code === 0x22A5) ||
			(code === 0x22BF) ||
			(code === 0x2312) ||
			(code >= 0x2460 && code <= 0x24E9) ||
			(code >= 0x24EB && code <= 0x254B) ||
			(code >= 0x2550 && code <= 0x2573) ||
			(code >= 0x2580 && code <= 0x258F) ||
			(code >= 0x2592 && code <= 0x2595) ||
			(code >= 0x25A0 && code <= 0x25A1) ||
			(code >= 0x25A3 && code <= 0x25A9) ||
			(code >= 0x25B2 && code <= 0x25B3) ||
			(code >= 0x25B6 && code <= 0x25B7) ||
			(code >= 0x25BC && code <= 0x25BD) ||
			(code >= 0x25C0 && code <= 0x25C1) ||
			(code >= 0x25C6 && code <= 0x25C8) ||
			(code === 0x25CB) ||
			(code >= 0x25CE && code <= 0x25D1) ||
			(code >= 0x25E2 && code <= 0x25E5) ||
			(code === 0x25EF) ||
			(code >= 0x2605 && code <= 0x2606) ||
			(code === 0x2609) ||
			(code >= 0x260E && code <= 0x260F) ||
			(code >= 0x2614 && code <= 0x2615) ||
			(code === 0x261C) ||
			(code === 0x261E) ||
			(code === 0x2640) ||
			(code === 0x2642) ||
			(code >= 0x2660 && code <= 0x2661) ||
			(code >= 0x2663 && code <= 0x2665) ||
			(code >= 0x2667 && code <= 0x266A) ||
			(code >= 0x266C && code <= 0x266D) ||
			(code === 0x266F) ||
			(code >= 0x269E && code <= 0x269F) ||
			(code >= 0x26BE && code <= 0x26BF) ||
			(code >= 0x26C4 && code <= 0x26CD) ||
			(code >= 0x26CF && code <= 0x26E1) ||
			(code === 0x26E3) ||
			(code >= 0x26E8 && code <= 0x26FF) ||
			(code === 0x273D) ||
			(code === 0x2757) ||
			(code >= 0x2776 && code <= 0x277F) ||
			(code >= 0x2B55 && code <= 0x2B59) ||
			(code >= 0x3248 && code <= 0x324F) ||
			(code >= 0xE000 && code <= 0xF8FF) ||
			(code >= 0xFE00 && code <= 0xFE0F) ||
			(code === 0xFFFD) ||
			(code >= 0x1F100 && code <= 0x1F10A) ||
			(code >= 0x1F110 && code <= 0x1F12D) ||
			(code >= 0x1F130 && code <= 0x1F169) ||
			(code >= 0x1F170 && code <= 0x1F19A) ||
			(code >= 0xE0100 && code <= 0xE01EF) ||
			(code >= 0xF0000 && code <= 0xFFFFD) ||
			(code >= 0x100000 && code <= 0x10FFFD)) {
			return true;
		}
		return false;
	}
}

module.exports = stringWidth(2);
module.exports.ambiguousCharOneWidth = stringWidth(1);
