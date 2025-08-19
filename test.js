import test from 'ava';
import stringWidth from './index.js';

const macro = test.macro((t, input, expected, options = {}) => {
	t.is(stringWidth(input, options), expected);
});

// Basic functionality
test('empty string', macro, '', 0);
test('single ASCII character', macro, 'a', 1);
test('ASCII string', macro, 'hello world', 11);

// Edge cases for input validation
test('non-string input (number)', t => {
	t.is(stringWidth(123), 0);
});
test('non-string input (null)', t => {
	t.is(stringWidth(null), 0);
});
test('non-string input (undefined)', t => {
	t.is(stringWidth(undefined), 0);
});

// East Asian width categories
test('full-width characters', macro, '你好', 4);
test('half-width characters', macro, 'hello', 5);
test('mixed width', macro, 'hello世界', 9);

// Halfwidth Katakana with dakuten/handakuten (issue #55)
test('halfwidth kana voiced sound mark (ba)', macro, 'ﾊﾞ', 2);
test('halfwidth kana semi-voiced sound mark (pa)', macro, 'ﾊﾟ', 2);
test('halfwidth vu', macro, 'ｳﾞ', 2);
test('halfwidth vu with prolonged sound', macro, 'ｳﾞｰ', 3);
test('voiced sound mark alone', macro, 'ﾞ', 1);
test('semi-voiced sound mark alone', macro, 'ﾟ', 1);
test('halfwidth prolonged sound with kana', macro, 'ｶｰ', 2);
test('halfwidth kana with dakuten and prolonged mark', macro, 'ｶﾞｰ', 3);

// Ambiguous characters
test('ambiguous narrow (default)', macro, '±', 1);
test('ambiguous wide', macro, '±', 2, {ambiguousIsNarrow: false});

// Control characters (should be ignored)
test('null character', macro, '\u0000', 0);
test('tab character', macro, '\t', 0);
// Tabs are ignored by design (issue #45)
test('tab sandwich ASCII', macro, 'a\tb', 2);
test('multiple tabs between ASCII', macro, 'a\t\tb', 2);
test('leading tab before ASCII', macro, '\ta', 1);
test('trailing tab after ASCII', macro, 'a\t', 1);
test('only tabs', macro, '\t\t', 0);
test('newline character', macro, '\n', 0);
test('escape character', macro, '\u001B', 0);
test('control in text', macro, 'a\u0001b', 2);

// ANSI escape sequences
test('ANSI color codes', macro, '\u001B[31mred\u001B[0m', 3);
test('ANSI codes counted', macro, '\u001B[31m', 4, {countAnsiEscapeCodes: true});
test('complex ANSI sequence', macro, '\u001B]8;;https://example.com\u0007link\u001B]8;;\u0007', 4);

// Zero-width characters
test('zero-width space', macro, 'a\u200Bb', 2);
test('zero-width non-joiner', macro, 'a\u200Cb', 2);
test('zero-width joiner', macro, 'a\u200Db', 2);
test('zero-width no-break space', macro, 'a\uFEFFb', 2);

// Explicit ZWNJ/ZWJ cases (issue #4)
test('ZWNJ alone', macro, '\u200C', 0);
test('ZWJ alone', macro, '\u200D', 0);
test('Arabic with ZWNJ', macro, 'ب\u200Cه', 2);
test('multiple ZWNJ between ASCII', macro, 'a\u200C\u200Cb', 2);
test('Indic conjunct via ZWJ', macro, 'क्\u200Dष', 1);

// Combining characters
test('combining diacritical mark', macro, 'e\u0301', 1);
test('multiple combining marks', macro, 'e\u0301\u0302', 1);
test('combining marks only', macro, '\u0301\u0302', 0);

// Surrogate pairs and high code points
test('emoji surrogate pair', macro, '😀', 2);
test('text with emoji', macro, 'a😀b', 4);

// Variation selectors
test('variation selector ignored', macro, 'a\uFE0F', 1);
test('emoji with variation selector', macro, '⚡\uFE0F', 2);

// Symbols that should remain narrow (issue #56)
test('black medium square', macro, '◼', 1);
test('warning sign', macro, '⚠', 1);
test('check mark', macro, '✔', 1);
test('heart suit', macro, '♥', 1);
test('female sign', macro, '♀', 1);
test('male sign', macro, '♂', 1);
test('warning sign emoji style', macro, '⚠\uFE0F', 2);
test('warning sign text style', macro, '⚠\uFE0E', 1);
test('check mark text style', macro, '✔\uFE0E', 1);

// Variation selector sequences (issue #42)
test('arrow with text variation', macro, '\u21A9\uFE0E', 1);
test('arrow with emoji variation', macro, '\u21A9\uFE0F', 2);
test('information source text variation', macro, '\u2139\uFE0E', 1);
test('information source emoji variation', macro, '\u2139\uFE0F', 2);
test('registered sign text variation', macro, '\u00AE\uFE0E', 1);
test('registered sign emoji variation', macro, '\u00AE\uFE0F', 2);
test('copyright sign text variation', macro, '\u00A9\uFE0E', 1);
test('copyright sign emoji variation', macro, '\u00A9\uFE0F', 2);

// Emoji and emoji-like sequences
test('basic emoji', macro, '😀', 2);
test('emoji with skin tone', macro, '👋🏽', 2);
test('ZWJ sequence', macro, '👨‍👩‍👧‍👦', 2);
test('keycap sequence', macro, '1️⃣', 2);
test('flag sequence', macro, '🇺🇸', 2);
test('tag sequence', macro, '🏴', 2);

// Regional indicators
test('single regional indicator', macro, '🇦', 1);
test('flag from two regional indicators', macro, '🇺🇸', 2);
test('three regional indicators', macro, '🇺🇸🇦', 3);

// Default ignorable code points
test('word joiner', macro, 'a\u2060b', 2);
test('function application', macro, 'a\u2061b', 2);

// Complex real-world cases
test('mixed script with emoji', macro, 'Hello 👋 世界', 13);
test('ANSI with emoji', macro, '\u001B[32m✅ Pass\u001B[0m', 7);
test('combining with full-width', macro, '東京\u0301', 4);

// Edge cases that could break
test('only combining marks', macro, '\u0300\u0301\u0302', 0);
test('only control characters', macro, '\u0000\u0001\u001B', 0);
test('only zero-width characters', macro, '\u200B\u200C\u200D', 0);
test('malformed surrogate', macro, '\uD800', 0);
test('mixed control and text', macro, 'a\u0000b\u0001c', 3);
test('double-width with combining', macro, '你\u0301好', 4);

// Performance edge cases
test('long ASCII string', macro, 'a'.repeat(1000), 1000);
test('long full-width string', macro, '你'.repeat(500), 1000);
test('mixed long string', macro, 'a你'.repeat(500), 1500);

// Variation selectors alone: zero width
test('VS16 alone', macro, '\uFE0F', 0);
test('VS15 alone', macro, '\uFE0E', 0);

// ZWJ appended to ASCII should not change width
test('ASCII with trailing ZWJ', macro, 'A\u200D\u200D', 1);

// Leading ZWJ should not steal the base width
test('leading ZWJ + ASCII', macro, '\u200DA', 1);
test('leading ZWJ + CJK', macro, '\u200D你', 2);

// Prepended Concatenation Mark (GB9b) should not affect width of following cluster
test('prepend + ASCII', macro, '\u0600A', 1);
test('prepend + CJK', macro, '\u0600你', 2);
test('prepend + emoji', macro, '\u0600😀', 2);

// Sequence consisting only of default ignorables should be zero
test('only default ignorables (tags)', macro, '\u{E0020}\u{E007F}', 0);
