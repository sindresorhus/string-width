'use strict';
const stripAnsi = require('strip-ansi');
const isFullwidthCodePoint = require('is-fullwidth-code-point');

module.exports = (str, options) => {
	if (typeof str !== 'string' || str.length === 0) {
		return 0;
	}

	options = options || {};
	if (typeof options.joinAroundZWJ !== 'boolean') {
		options.joinAroundZWJ = false;
	}

	str = stripAnsi(str);

	let width = 0;
	let zwjInEffect = false;

	for (let i = 0; i < str.length; i++) {
		const code = str.codePointAt(i);

		// Ignore control characters
		if (code <= 0x1F || (code >= 0x7F && code <= 0x9F)) {
			continue;
		}

		// Ignore combining characters
		if (code >= 0x300 && code <= 0x36F) {
			continue;
		}

		// Join characters around zero-width-joiner, but only if:
		// - requested in the options
		// - there is a character before
		// - there is a character after
		if (options.joinAroundZWJ && code === 0x200D && width) {
			zwjInEffect = true;
			continue; // In any case, this codepoint has no width
		}

		// Surrogates
		if (code > 0xFFFF) {
			i++;
		}

		width += zwjInEffect ? 0 : isFullwidthCodePoint(code) ? 2 : 1;

		zwjInEffect = false;
	}

	return width;
};
