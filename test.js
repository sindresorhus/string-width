import {test} from 'node:test';
import assert from 'node:assert/strict';
import stringWidth from './index.js';

// AVA's `test.macro` has no node:test equivalent, so build the test body directly.
const macro = (input, expected, options = {}) => () => {
	assert.equal(stringWidth(input, options), expected);
};

// Basic functionality
test('empty string', macro('', 0));
test('single ASCII character', macro('a', 1));
test('ASCII string', macro('hello world', 11));

// Edge cases for input validation
test('non-string input (number)', () => {
	assert.equal(stringWidth(123), 0);
});
test('non-string input (null)', () => {
	assert.equal(stringWidth(null), 0);
});
test('non-string input (undefined)', () => {
	assert.equal(stringWidth(undefined), 0);
});

// East Asian width categories
test('full-width characters', macro('你好', 4));
test('half-width characters', macro('hello', 5));
test('mixed width', macro('hello世界', 9));
test('repeated leading Hangul jamo in one grapheme cluster are one syllable block', macro('ᄀᄀ', 2));
test('long leading Hangul jamo cluster is one syllable block', macro('ᄀᄀᄀᄀᄀᄀ', 2));
test('decomposed Hangul syllable cluster', macro('가', 2));
test('decomposed Hangul syllable cluster with trailing jamo', macro('각', 2));
test('decomposed Hangul syllable cluster with variation selector', macro('가\u{FE0F}', 2));
test('repeated leading jamo before vowel', macro('ᄀ가', 2));
test('repeated vowel jamo after leading', macro('가ᅡ', 2));
test('repeated trailing jamo after syllable', macro('각ᆨ', 2));
test('repeated leading Hangul jamo with variation selector', macro('ᄀᄀ\u{FE0F}', 2));
test('repeated leading Hangul jamo with trailing ZWJ', macro('ᄀᄀ\u{200D}', 2));
test('vowel-only Hangul jamo cluster has the width of its first jamo', macro('ᅡᅡᅡ', 1));
test('trailing-only Hangul jamo cluster has the width of its first jamo', macro('ᆨᆨ', 1));
test('single leading jamo alone is width 2', macro('ᄀ', 2));
test('single vowel jamo alone is width 1', macro('ᅡ', 1));
test('single trailing jamo alone is width 1', macro('ᆨ', 1));
test('vowel jamo before leading jamo does not compose', macro('ᅡᄀ', 3));
test('leading jamo followed by trailing jamo without vowel does not compose', macro('ᄀᆨ', 3));
test('extended leading jamo U+A960 + standard vowel composes to width 2', macro('ꥠᅡ', 2));
test('standard leading jamo + extended vowel U+D7B0 composes to width 2', macro('ᄀힰ', 2));
test('extended leading + standard vowel + standard trailing composes to width 2', macro('ꥠᅡᆨ', 2));
test('Hangul Compatibility Jamo is full-width via EAW', macro('ㄱ', 2));
test('two Hangul Compatibility Jamo do not compose', macro('ㄱㄱ', 4));
test('precomposed syllable 가 U+AC00', macro('가', 2));
test('precomposed syllable 한 U+D55C', macro('한', 2));
test('three precomposed syllables', macro('한국어', 6));
test('leading jamo + precomposed syllable in one cluster', macro('ᄀ가', 2));

// Halfwidth Katakana with dakuten/handakuten (issue #55)
test('halfwidth kana voiced sound mark (ba)', macro('ﾊﾞ', 2));
test('halfwidth kana semi-voiced sound mark (pa)', macro('ﾊﾟ', 2));
test('halfwidth vu', macro('ｳﾞ', 2));
test('halfwidth vu with prolonged sound', macro('ｳﾞｰ', 3));
test('voiced sound mark alone', macro('ﾞ', 1));
test('semi-voiced sound mark alone', macro('ﾟ', 1));
test('halfwidth prolonged sound with kana', macro('ｶｰ', 2));
test('halfwidth kana with dakuten and prolonged mark', macro('ｶﾞｰ', 3));

// Ambiguous characters
test('ambiguous narrow (default)', macro('±', 1));
test('ambiguous wide', macro('±', 2, {ambiguousIsNarrow: false}));

// Control characters (should be ignored)
test('null character', macro('\u{0}', 0));
test('tab character', macro('\t', 0));
// Tabs are ignored by design (issue #45)
test('tab sandwich ASCII', macro('a\tb', 2));
test('multiple tabs between ASCII', macro('a\t\tb', 2));
test('leading tab before ASCII', macro('\ta', 1));
test('trailing tab after ASCII', macro('a\t', 1));
test('only tabs', macro('\t\t', 0));
test('newline character', macro('\n', 0));
test('escape character', macro('\u{1B}', 0));
test('control in text', macro('a\u{1}b', 2));

// ANSI escape sequences
test('ANSI color codes', macro('\u{1B}[31mred\u{1B}[0m', 3));
test('ANSI codes counted', macro('\u{1B}[31m', 4, {countAnsiEscapeCodes: true}));
test('complex ANSI sequence', macro('\u{1B}]8;;https://example.com\u{7}link\u{1B}]8;;\u{7}', 4));

// Zero-width characters
test('zero-width space', macro('a\u{200B}b', 2));
test('zero-width non-joiner', macro('a\u{200C}b', 2));
test('zero-width joiner', macro('a\u{200D}b', 2));
test('zero-width no-break space', macro('a\u{FEFF}b', 2));

// Explicit ZWNJ/ZWJ cases (issue #4)
test('ZWNJ alone', macro('\u{200C}', 0));
test('ZWJ alone', macro('\u{200D}', 0));
test('Arabic with ZWNJ', macro('ب\u{200C}ه', 2));
test('multiple ZWNJ between ASCII', macro('a\u{200C}\u{200C}b', 2));
test('Indic conjunct via ZWJ', macro('क्\u{200D}ष', 1));

// Combining characters
test('combining diacritical mark', macro('e\u{301}', 1));
test('multiple combining marks', macro('e\u{301}\u{302}', 1));
test('combining marks only', macro('\u{301}\u{302}', 0));
test('Tibetan combining mark', macro('ཟླ', 1));
test('enclosing mark', macro('a\u{20DD}', 1));
test('spacing mark alone', macro('\u{93E}', 1));
test('spacing mark after base character', macro('\u{915}\u{93E}', 2));
test('pre-base spacing mark after base character', macro('\u{915}\u{93F}', 2));

// Surrogate pairs and high code points
test('emoji surrogate pair', macro('😀', 2));
test('text with emoji', macro('a😀b', 4));

// Variation selectors
test('variation selector ignored', macro('a\u{FE0F}', 1));
test('emoji with variation selector', macro('⚡\u{FE0F}', 2));

// Symbols that should remain narrow (issue #56)
test('black medium square', macro('◼', 1));
test('warning sign', macro('⚠', 1));
test('check mark', macro('✔', 1));
test('heart suit', macro('♥', 1));
test('female sign', macro('♀', 1));
test('male sign', macro('♂', 1));
test('warning sign emoji style', macro('⚠\u{FE0F}', 2));
test('warning sign text style', macro('⚠\u{FE0E}', 1));
test('check mark text style', macro('✔\u{FE0E}', 1));

// Variation selector sequences (issue #42)
test('arrow with text variation', macro('\u{21A9}\u{FE0E}', 1));
test('arrow with emoji variation', macro('\u{21A9}\u{FE0F}', 2));
test('information source text variation', macro('\u{2139}\u{FE0E}', 1));
test('information source emoji variation', macro('\u{2139}\u{FE0F}', 2));
test('registered sign text variation', macro('\u{AE}\u{FE0E}', 1));
test('registered sign emoji variation', macro('\u{AE}\u{FE0F}', 2));
test('copyright sign text variation', macro('\u{A9}\u{FE0E}', 1));
test('copyright sign emoji variation', macro('\u{A9}\u{FE0F}', 2));

// Emoji and emoji-like sequences
test('basic emoji', macro('😀', 2));
test('emoji with skin tone', macro('👋🏽', 2));
test('ZWJ sequence', macro('👨‍👩‍👧‍👦', 2));
test('keycap sequence', macro('1️⃣', 2));
test('flag sequence', macro('🇺🇸', 2));
test('tag sequence', macro('\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}', 2)); // England flag

// Regional indicators
test('single regional indicator', macro('🇦', 2));
test('flag from two regional indicators', macro('🇺🇸', 2));
test('three regional indicators', macro('🇺🇸🇦', 4));

// Default ignorable code points
test('word joiner', macro('a\u{2060}b', 2));
test('function application', macro('a\u{2061}b', 2));

// Complex real-world cases
test('mixed script with emoji', macro('Hello 👋 世界', 13));
test('ANSI with emoji', macro('\u{1B}[32m✅ Pass\u{1B}[0m', 7));
test('combining with full-width', macro('東京\u{301}', 4));

// Edge cases that could break
test('only combining marks', macro('\u{300}\u{301}\u{302}', 0));
test('only control characters', macro('\u{0}\u{1}\u{1B}', 0));
test('only zero-width characters', macro('\u{200B}\u{200C}\u{200D}', 0));
test('malformed surrogate', macro('\u{D800}', 1));
test('mixed control and text', macro('a\u{0}b\u{1}c', 3));
test('double-width with combining', macro('你\u{301}好', 4));

// Performance edge cases
test('long ASCII string', macro('a'.repeat(1000), 1000));
test('huge ASCII string', macro('a'.repeat(10_000_000), 10_000_000));
test('long full-width string', macro('你'.repeat(500), 1000));
test('mixed long string', macro('a你'.repeat(500), 1500));

// Variation selectors alone: zero width
test('VS16 alone', macro('\u{FE0F}', 0));
test('VS15 alone', macro('\u{FE0E}', 0));

// ZWJ appended to ASCII should not change width
test('ASCII with trailing ZWJ', macro('A\u{200D}\u{200D}', 1));

// Leading ZWJ should not steal the base width
test('leading ZWJ + ASCII', macro('\u{200D}A', 1));
test('leading ZWJ + CJK', macro('\u{200D}你', 2));

// A prepended concatenation mark is one column, but shares the cell of a following wide character
test('prepend + ASCII', macro('\u{600}A', 2));
test('prepend + CJK', macro('\u{600}你', 2));
test('prepend + emoji', macro('\u{600}😀', 2));

// Sequence consisting only of default ignorables should be zero
test('only default ignorables (tags)', macro('\u{E0020}\u{E007F}', 0));

// Emoji coverage for RGI and related cases
// Case 1: Emoji with VS16 (should be double-width)
test('digit with VS16 (keycap base)', macro('0\u{FE0F}', 2)); // Not RGI, but a standardized emoji presentation sequence (measured 2 in Ghostty and kitty)
test('asterisk with VS16', macro('*\u{FE0F}', 2));
test('pound with VS16', macro('#\u{FE0F}', 2));
test('trademark with VS16', macro('™\u{FE0F}', 2));
test('watch with VS16', macro('⌚\u{FE0F}', 2));
test('phone with VS16', macro('☎\u{FE0F}', 2));
test('keyboard with VS16', macro('⌨\u{FE0F}', 2));
test('envelope with VS16', macro('✉\u{FE0F}', 2));

// Case 2: Emoji_Presentation characters without VS15 (should be double-width)
test('face emoji (has Emoji_Presentation)', macro('😀', 2));
test('heart emoji (has Emoji_Presentation)', macro('❤️', 2));
test('fire emoji (has Emoji_Presentation)', macro('🔥', 2));
test('rocket emoji (has Emoji_Presentation)', macro('🚀', 2));
test('star emoji (has Emoji_Presentation)', macro('⭐', 2));

// Case 3: Emoji_Presentation with VS15 (should be single-width)
test('heart with VS15 (text style)', macro('❤\u{FE0E}', 1));
test('star with VS15 (text style)', macro('⭐\u{FE0E}', 1));

// Case 4: Multi-scalar meaningful sequences (should be double-width)
test('keycap sequence 0️⃣', macro('0️⃣', 2));
test('keycap sequence 1️⃣', macro('1️⃣', 2));
test('keycap sequence 9️⃣', macro('9️⃣', 2));
test('keycap sequence *️⃣', macro('*️⃣', 2));
test('keycap sequence #️⃣', macro('#️⃣', 2));
test('flag emoji GB', macro('🇬🇧', 2));
test('flag emoji JP', macro('🇯🇵', 2));
test('skin tone modifier', macro('👋🏻', 2));
test('skin tone modifier dark', macro('👋🏿', 2));
test('couple with heart', macro('👨‍❤️‍👨', 2));
test('woman technologist', macro('👩‍💻', 2));
test('man health worker', macro('👨‍⚕️', 2));

// Case 5: Non-emoji presentation without VS16 (should be single-width via EAW)
test('watch without VS', macro('⌚', 2)); // Watch is actually RGI emoji with Emoji_Presentation
test('phone without VS (not Emoji_Presentation)', macro('☎', 1));
test('keyboard without VS (not Emoji_Presentation)', macro('⌨', 1));
test('envelope without VS (not Emoji_Presentation)', macro('✉', 1));

// Case 6: Edge cases for multi-scalar logic
test('single code point with VS15 (2 scalars but not meaningful)', macro('A\u{FE0E}', 1));
test('emoji with VS15 only (2 scalars, VS15 present)', macro('⌚\u{FE0E}', 1));
test('three code points with VS15 at end', macro('A👋\u{FE0E}', 3)); // Astral emoji keep their width with VS15 (see the limitation in index.js)

// Case 7: RGI emoji coverage
test('RGI emoji face', macro('😊', 2));
test('RGI emoji hand', macro('✋', 2));
test('RGI emoji animal', macro('🐶', 2));
test('RGI emoji food', macro('🍕', 2));
test('RGI emoji flag', macro('🏁', 2));

// Case 8: Complex emoji sequences that test all branches
test('emoji with combining mark', macro('😀\u{301}', 2));
test('emoji with ZWJ and another emoji', macro('😀\u{200D}😀', 2));
test('text character made emoji with VS16', macro('↔\u{FE0F}', 2));
test('text character kept text with VS15', macro('↔\u{FE0E}', 1));

// Case 9: Non-RGI sequences
test('non-RGI with VS16', macro('〰\u{FE0F}', 2));
test('non-RGI multi-scalar', macro('☎\u{FE0F}\u{20E3}', 2)); // Not an RGI sequence, but starts with the RGI emoji ☎️ and the keycap is zero-width

// Case 10: VS15 on BMP Emoji_Presentation selects the narrow text style
test('hourglass with VS15', macro('⌛\u{FE0E}', 1));
test('fast-forward with VS15', macro('⏩\u{FE0E}', 1));
test('rewind with VS15', macro('⏪\u{FE0E}', 1));
test('arrow double up with VS15', macro('⏫\u{FE0E}', 1));
test('arrow double down with VS15', macro('⏬\u{FE0E}', 1));
test('alarm clock with VS15', macro('⏰\u{FE0E}', 1));
test('hourglass flowing sand with VS15', macro('⏳\u{FE0E}', 1));
test('umbrella with rain with VS15', macro('☔\u{FE0E}', 1));
test('hot beverage with VS15', macro('☕\u{FE0E}', 1));
// Removed redundant duplicate of '⭐\uFE0E' test

// Other emoji that may not have Emoji_Presentation but are affected
test('sun with VS15', macro('☀\u{FE0E}', 1));
test('cloud with VS15', macro('☁\u{FE0E}', 1));
test('umbrella with VS15', macro('☂\u{FE0E}', 1));
test('snowman with VS15', macro('☃\u{FE0E}', 1));
test('comet with VS15', macro('☄\u{FE0E}', 1));
test('black nib with VS15', macro('✒\u{FE0E}', 1));
test('heavy check mark with VS15', macro('✔\u{FE0E}', 1));

// More edge cases for single-scalar text characters (not emoji)
test('digit zero as plain text (not emoji)', macro('0', 1));
test('digit one as plain text', macro('1', 1));
test('asterisk as plain text', macro('*', 1));
test('hash as plain text', macro('#', 1));

// Unicode Format characters (non-default-ignorable)
test('Arabic number sign U+0600', macro('\u{600}', 1));
test('Arabic end of ayah U+06DD', macro('\u{6DD}', 1));
test('Syriac abbreviation mark U+070F', macro('\u{70F}', 1));

// Minimally-qualified/unqualified emoji sequences
// These are emoji sequences missing VS16 but should still be width 2
test('heart on fire (MQ)', macro('\u{2764}\u{200D}\u{1F525}', 2)); // ❤‍🔥
test('rainbow flag (MQ)', macro('\u{1F3F3}\u{200D}\u{1F308}', 2)); // 🏳‍🌈
test('transgender flag (MQ)', macro('\u{1F3F3}\u{200D}\u{26A7}', 2)); // 🏳‍⚧
test('broken chain (MQ)', macro('\u{26D3}\u{200D}\u{1F4A5}', 2)); // ⛓‍💥
test('eye in speech bubble (MQ)', macro('\u{1F441}\u{200D}\u{1F5E8}', 2)); // 👁‍🗨
test('man bouncing ball (MQ)', macro('\u{26F9}\u{200D}\u{2642}', 2)); // ⛹‍♂
test('woman bouncing ball (MQ)', macro('\u{26F9}\u{200D}\u{2640}', 2)); // ⛹‍♀
test('man detective (MQ)', macro('\u{1F575}\u{200D}\u{2642}', 2)); // 🕵‍♂
test('woman detective (MQ)', macro('\u{1F575}\u{200D}\u{2640}', 2)); // 🕵‍♀

// Unqualified keycap sequences (missing VS16)
test('keycap # (UQ)', macro('#\u{20E3}', 1)); // #⃣
test('keycap 0 (UQ)', macro('0\u{20E3}', 1)); // 0⃣
test('keycap * (UQ)', macro('*\u{20E3}', 1)); // *⃣

// Ensure invalid keycap sequences don't match
test('phone + keycap (invalid)', macro('\u{260E}\u{FE0E}\u{20E3}', 1)); // Not a valid keycap base, and text presentation

// Latin1 range (0xA0–0x2FF) — width 1, no segmenter or EAW lookup needed
test('non-breaking space U+00A0', macro('\u{A0}', 1));
test('Latin ñ U+00F1', macro('ñ', 1));
test('Latin ü U+00FC', macro('ü', 1));
test('Latin ÿ U+00FF', macro('ÿ', 1));
test('Latin1 in text', macro('café', 4));
test('Spacing Modifier U+02FF', macro('\u{2FF}', 1));

// Soft hyphen (0xAD) — zero-width
test('soft hyphen U+00AD', macro('\u{AD}', 0));
test('soft hyphen in text', macro('a\u{AD}b', 2));

// Combining diacritical boundary (0x300) — zero-width combining mark
test('combining grave U+0300 alone', macro('\u{300}', 0));
test('char + combining at 0x300 boundary', macro('a\u{300}', 1));

// ASCII boundary characters
test('space U+0020 (lowest printable ASCII)', macro(' ', 1));
test('tilde U+007E (highest printable ASCII)', macro('~', 1));
test('DEL U+007F (just above printable ASCII)', macro('\u{7F}', 0));
test('unit separator U+001F (just below printable ASCII)', macro('\u{1F}', 0));

// Ambiguous characters
test('ambiguous in text (narrow default)', macro('±×÷', 3));
test('ambiguous in text (wide)', macro('±×÷', 6, {ambiguousIsNarrow: false}));
test('ambiguous mixed with CJK', macro('±你', 3));
test('ambiguous mixed with CJK (wide)', macro('±你', 4, {ambiguousIsNarrow: false}));

// `stripAnsi` guard: non-ANSI strings should not call `stripAnsi`
test('non-ASCII without ANSI escapes', macro('你好世界', 8));
test('Latin1 without ANSI escapes', macro('résumé', 6));

// Long runs of overlapping zero-width code points must not cause catastrophic backtracking
test('many combining grapheme joiners + spacing mark', macro('\u{34F}'.repeat(1000) + '\u{903}', 1));
test('many combining grapheme joiners + emoji modifier', macro('\u{34F}'.repeat(1000) + '\u{1F3FB}', 2));
test('huge cluster of combining grapheme joiners + spacing mark', macro('\u{34F}'.repeat(3_000_000) + '\u{903}', 1));
test('huge cluster of only combining grapheme joiners', macro('\u{34F}'.repeat(3_000_000), 0));

test('ANSI codes around Thai AM', macro('\u{1B}[31mกำ\u{1B}[39m', 2));
test('Thai consonant + SARA AM', macro('กำ', 2));
test('Thai word with SARA AM', macro('ทำงาน', 5));
test('Thai consonant + tone mark + SARA AM', macro('น้ำ', 2));
test('Lao consonant + AM', macro('ນຳ', 2));
test('Thai SARA AM alone', macro('ำ', 1));
test('Thai SARA AM with wide ambiguous option', macro('กำ±', 4, {ambiguousIsNarrow: false}));
test('Thai word with above vowel (issue #43)', macro('ปฏัก', 3));
test('Thai SARA AM composed and decomposed are the same width', macro('ก\u{E4D}\u{E32}', 2));
test('Lao AM composed and decomposed are the same width', macro('ຄ\u{ECD}\u{EB2}', 2));

test('ANSI codes around conjunct', macro('\u{1B}[31mक्ष\u{1B}[39m', 2));
test('Devanagari conjunct', macro('क्ष', 2));
test('Devanagari word with conjunct', macro('नमस्ते', 4));
test('Devanagari three-consonant conjunct', macro('स्त्र', 3));
test('Devanagari conjunct with spacing marks', macro('हिन्दी', 5));
test('Devanagari conjunct with vowel sign', macro('श्री', 3));
test('Bengali conjunct', macro('ক্ষ', 2));
test('Gujarati conjunct', macro('ત્ર', 2));
test('Oriya conjunct', macro('କ୍ଷ', 2));
test('Telugu conjunct', macro('క్ష', 2));
test('Malayalam conjunct', macro('ക്ഷ', 2));
test('Devanagari conjunct broken by ZWNJ', macro('क्\u{200C}ष', 2));
test('Devanagari conjunct with wide ambiguous option', macro('क्ष±', 4, {ambiguousIsNarrow: false}));
test('Devanagari virama alone after consonant', macro('क्', 1));
test('conjunct with nukta', macro('क़्ष', 2));
test('long conjunct chain in one cluster', macro('क्'.repeat(5) + 'क', 6));
test('Hindi sentence', macro('हिन्दी में नमस्ते', 12));
test('two ZWJ conjuncts in one cluster', macro('क्\u{200D}ष्\u{200D}ट', 1));
test('ZWJ conjunct + spacing mark', macro('क्\u{200D}षा', 1));
test('ZWJ conjunct in text', macro('aक्\u{200D}षb', 3));
test('skin tone modifier after ZWJ after text', macro('a\u{200D}🏻', 1));
test('ZWJ after text does not join a following emoji', macro('a\u{200D}😀', 3));
test('visible prepend + consonant', macro('\u{D4E}ക', 2));
test('visible prepend + punctuation', macro('\u{D4E}!', 2));
test('visible prepend + CJK', macro('\u{D4E}你', 3));
test('visible prepend alone', macro('\u{D4E}', 1));
test('ASCII + skin tone modifier', macro('a🏻', 3));
test('CJK + skin tone modifier', macro('你🏻', 4));
test('Devanagari + skin tone modifier', macro('क🏻', 3));
test('ASCII + two skin tone modifiers', macro('a🏻🏿', 5));
test('ambiguous + skin tone modifier (wide)', macro('±🏻', 4, {ambiguousIsNarrow: false}));
test('skin tone modifier after halfwidth katakana', macro('ｶ🏻', 3));
test('huge cluster of skin tone modifiers after ASCII', macro('a' + '🏻'.repeat(100_000), 200_001));
test('huge conjunct chain', macro('क्'.repeat(100_000) + 'क', 100_001));

test('ANSI codes around invalid regional indicator pair', macro('\u{1B}[31m🇦🇦\u{1B}[39m', 2));
test('counted ANSI codes next to emoji with trailing ZWJ', macro('\u{1B}[31m⚠️\u{200D}', 6, {countAnsiEscapeCodes: true}));
test('black flag', macro('🏴', 2));
test('ZWJ sequence with different skin tones', macro('\u{1F9D1}\u{1F3FF}\u{200D}\u{1F91D}\u{200D}\u{1F9D1}\u{1F3FB}', 2));
test('heart emoji with VS16 (not Emoji_Presentation)', macro('❤️', 2));
test('wavy dash with VS16', macro('〰\u{FE0F}', 2));
test('high variation selector U+E0100 ignored', macro('a\u{E0100}', 1));
test('check mark button with VS15', macro('✅\u{FE0E}', 1));
test('watch with VS15 in text', macro('a⌚\u{FE0E}b', 3));
test('watch with VS15 + trailing ZWJ', macro('⌚\u{FE0E}\u{200D}', 1));
test('watch with VS15 + stray skin tone modifier stays narrow', macro('⌚\u{FE0E}🏻', 1));
test('astral emoji with VS15 keeps its width with trailing ZWJ', macro('👋\u{FE0E}\u{200D}', 2));
test('CJK with VS15 stays wide', macro('你\u{FE0E}', 2));
test('digit with VS16 in text', macro('a1\u{FE0F}b', 4));
test('digit with VS16 + combining mark', macro('1\u{FE0F}\u{301}', 2));
test('digit with VS16 + trailing ZWJ', macro('1\u{FE0F}\u{200D}', 2));
test('digit with VS15 stays narrow', macro('1\u{FE0E}', 1));
test('every digit with VS16', macro('0\u{FE0F}1\u{FE0F}2\u{FE0F}3\u{FE0F}4\u{FE0F}5\u{FE0F}6\u{FE0F}7\u{FE0F}8\u{FE0F}9\u{FE0F}', 20));
test('couple with heart without VS16 (MQ)', macro('\u{1F468}\u{200D}\u{2764}\u{200D}\u{1F468}', 2));
test('minimally-qualified ZWJ sequence with many trailing extenders', macro('\u{2764}\u{200D}\u{1F525}' + '\u{34F}'.repeat(60), 2));
test('minimally-qualified ZWJ sequence + stray skin tone modifier', macro('\u{2764}\u{200D}\u{1F525}\u{1F3FB}', 4));
test('minimally-qualified ZWJ sequence ending in a modifier base + skin tone modifier', macro('\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}\u{1F3FD}', 2));
test('unqualified keycap + trailing ZWJ', macro('1\u{20E3}\u{200D}', 1));
test('unqualified keycap + many trailing ZWJs', macro('1\u{20E3}' + '\u{200D}'.repeat(60), 1));
test('text-default emoji + enclosing keycap is not a keycap sequence', macro('☎\u{20E3}', 1));
test('text-default emoji with VS16 + trailing ZWJ', macro('⚠️\u{200D}', 2));
test('flag + trailing ZWJ', macro('🇺🇸\u{200D}', 2));
test('text-default emoji with VS16 + combining mark', macro('❤️\u{301}', 2));
test('text-default emoji with VS16 + extra VS16', macro('❤️\u{FE0F}', 2));
test('text-default emoji with VS16 + combining grapheme joiner', macro('❤️\u{34F}', 2));
test('text-default emoji with VS16 + tag characters', macro('❤️\u{E0067}\u{E007F}', 2));
test('flag + combining mark', macro('🇺🇸\u{301}', 2));
test('RGI ZWJ sequence + trailing ZWJ', macro('👩‍💻\u{200D}', 2));
test('trailing ZWJ after text-default emoji without VS16 stays narrow', macro('❤\u{200D}', 1));
test('trailing ZWJ between emoji in a string', macro('a⚠️\u{200D}b', 4));
test('emoji cluster with a stray spacing mark is double-width as a whole', macro('😀\u{903}', 2));
test('skin tone modifier alone', macro('🏻', 2));
test('skin tone modifier on modifier base', macro('✌🏻', 2));
test('skin tone modifier on modifier base in text', macro('a👍🏽b', 4));
test('skin tone modifier after Hangul syllable', macro('가🏻', 4));
test('skin tone modifier after ZWJ following emoji is absorbed', macro('😀\u{200D}🏻', 2));
test('emoji + two stray skin tone modifiers', macro('😀🏻🏿', 6));
test('flag + stray skin tone modifier', macro('🇺🇸🏻', 4));
test('keycap + stray skin tone modifier', macro('1️⃣🏻', 4));
test('modifier base with VS16 + skin tone', macro('☝️🏻', 4));
test('emoji-presentation emoji + skin tone on non-modifier base', macro('😀🏻', 4));
test('ZWJ sequence ending in a modifier base + skin tone modifier', macro('👨‍👩‍👧‍👦🏻', 2));
test('skin tone modifier on modifier base after ZWJ sequence part', macro('👩🏽‍💻', 2));
test('five regional indicators pair up from the start', macro('🇺🇸🇺🇸🇺', 6));
test('flag + ZWJ does not join a following emoji', macro('🇺🇸\u{200D}😀', 4));
test('invalid regional indicator pair', macro('🇦🇦', 2));
test('invalid regional indicator pair in text', macro('a🇺🇺b', 4));
test('invalid pair + single regional indicator', macro('🇦🇦🇦', 4));
test('invalid pair + valid flag', macro('🇦🇦🇺🇸', 4));
test('valid flag + invalid pair', macro('🇺🇸🇦🇦', 4));
test('invalid regional indicator pair with trailing ZWJ', macro('🇦🇦\u{200D}', 2));
test('lone regional indicator in text', macro('a🇦b', 4));
test('lone regional indicator + combining mark', macro('🇦\u{301}', 2));
test('lone regional indicator + trailing ZWJ', macro('🇦\u{200D}', 2));
test('four regional indicators form two pairs', macro('🇦🇦🇦🇦', 4));
test('lone regional indicator + stray skin tone modifier', macro('🇦🏻', 4));
test('huge emoji cluster with trailing ZWJs', macro('⚠️' + '\u{200D}'.repeat(100_000), 2));
for (const base of '0123456789#*') {
	test(`keycap ${base} (fully-qualified and unqualified)`, () => {
		assert.equal(stringWidth(`${base}\u{FE0F}\u{20E3}`), 2);
		assert.equal(stringWidth(`${base}\u{20E3}`), 1);
		assert.equal(stringWidth(`${base}\u{FE0F}\u{20E3}\u{200D}`), 2);
	});
}

test('leading jamo + vowel + skin tone modifier', macro('\u{1100}\u{1161}🏻', 4));
test('precomposed syllable + spacing mark', macro('가\u{903}', 2));
test('Hangul syllable + halfwidth voiced mark', macro('가ﾞ', 2));
test('Hangul cluster with three leading jamo + vowel', macro('\u{1100}\u{1100}\u{1100}\u{1161}', 2));
test('Hangul syllables with ambiguous wide option', macro('한국어±', 8, {ambiguousIsNarrow: false}));
test('precomposed LVT syllable + trailing jamo', macro('\u{AC01}\u{11A8}', 2));
test('precomposed LV syllable + vowel jamo', macro('\u{AC00}\u{1161}', 2));
test('precomposed LV syllable + trailing jamo', macro('\u{AC00}\u{11A8}', 2));
test('precomposed LV syllable + extended trailing jamo', macro('\u{AC00}\u{D7CB}', 2));
test('precomposed LV syllable + two trailing jamo', macro('\u{AC00}\u{11A8}\u{11A8}', 2));
test('precomposed LV syllable + vowel + trailing jamo', macro('\u{AC00}\u{1161}\u{11A8}', 2));
test('last precomposed LVT syllable + trailing jamo', macro('\u{D7A3}\u{11A8}', 2));
test('leading jamo + precomposed LV syllable + trailing jamo', macro('\u{1100}\u{AC00}\u{11A8}', 2));
test('precomposed Hangul cluster + trailing jamo in text', macro('a\u{AC01}\u{11A8}b', 4));
test('choseong filler + vowel jamo', macro('\u{115F}\u{1161}', 2));
test('choseong filler + vowel + trailing jamo', macro('\u{115F}\u{1161}\u{11A8}', 2));
test('choseong filler alone is invisible', macro('\u{115F}', 0));
test('choseong filler + vowel jamo in text', macro('a\u{115F}\u{1161}b', 4));
test('jungseong filler after leading jamo', macro('\u{1100}\u{1160}', 2));
test('jungseong filler alone', macro('\u{1160}', 0));
test('Hangul filler U+3164 alone', macro('\u{3164}', 0));
test('halfwidth Hangul filler U+FFA0 alone', macro('\u{FFA0}', 0));
test('choseong filler + two leading jamo', macro('\u{115F}\u{1100}\u{1100}', 2));
test('choseong filler + combining mark is invisible', macro('\u{115F}\u{301}', 0));
test('choseong filler + trailing ZWJ is invisible', macro('\u{115F}\u{200D}', 0));
test('jungseong filler + combining mark is invisible', macro('\u{1160}\u{301}', 0));
test('jungseong filler between leading and trailing jamo', macro('\u{1100}\u{1160}\u{11A8}', 2));

for (const string of ['\u{AC01}\u{11A8}', '\u{AC00}\u{1161}', '\u{AC00}\u{11A8}', '\u{1100}\u{AC00}\u{11A8}', '\u{AC00}\u{1161}\u{11A8}', '\u{1100}\u{1100}\u{1161}', '한국어\u{11A8}']) {
	test(`Hangul width is the same in NFC and NFD: ${string}`, () => {
		assert.equal(stringWidth(string.normalize('NFC')), stringWidth(string.normalize('NFD')));
	});
}

test('Arabic number sign before Arabic-Indic digits', macro('\u{600}١٢٣', 4));
test('Arabic end of ayah before digits', macro('\u{6DD}١٢', 3));
test('Arabic number sign before ASCII digits', macro('\u{600}123', 4));
test('two prepended concatenation marks', macro('\u{600}\u{601}', 2));
test('two prepended concatenation marks + ASCII', macro('\u{600}\u{601}a', 3));
test('prepended concatenation mark + ambiguous characters (narrow)', macro('\u{600}±±', 3));
test('prepended concatenation mark + ambiguous characters (wide)', macro('\u{600}±±', 4, {ambiguousIsNarrow: false}));
test('prepended concatenation mark + combining mark', macro('\u{600}\u{300}', 1));
test('prepended concatenation mark + Hebrew letter', macro('\u{600}א', 2));
test('astral prepended concatenation mark', macro('\u{110BD}1', 2));
test('astral prepended concatenation mark + CJK', macro('\u{110BD}你', 2));
test('prepended concatenation mark + consonant with spacing mark', macro('\u{600}का', 3));
test('prepended concatenation mark + Thai consonant with AM', macro('\u{600}กำ', 3));
test('prepended concatenation mark + ASCII + stray skin tone modifier', macro('\u{600}a🏻', 4));
test('prepended concatenation mark + Hangul syllable', macro('\u{600}가', 2));
test('prepended concatenation mark + regional indicator', macro('\u{600}🇦', 2));
test('prepended concatenation mark + wide emoji with VS15', macro('\u{600}⌚\u{FE0E}', 2));
test('prepended concatenation mark + halfwidth kana with dakuten', macro('\u{600}ﾊﾞ', 3));
test('prepended concatenation mark + skin tone modifier alone', macro('\u{600}\u{1F3FB}', 2));
test('prepend + flag', macro('\u{600}🇺🇸', 2));
test('prepend + text-default emoji with VS16', macro('\u{600}❤️', 2));
test('prepend + keycap', macro('\u{600}1️⃣', 2));
test('prepend + unqualified keycap', macro('\u{600}1\u{20E3}', 2));
test('prepend + minimally-qualified ZWJ sequence', macro('\u{600}\u{2764}\u{200D}\u{1F525}', 2));
test('prepend + RGI ZWJ sequence', macro('\u{600}👩‍💻', 2));
test('prepend + text-default emoji with VS15', macro('\u{600}❤\u{FE0E}', 2));
test('multiple prepends + flag', macro('\u{600}\u{601}🇺🇸', 2));

test('lone low surrogate', macro('\u{DC00}', 1));
test('lone surrogate in text', macro('a\u{D800}b', 3));
test('two lone high surrogates', macro('\u{D800}\u{D800}', 2));
test('reversed surrogate pair', macro('\u{DE00}\u{D83D}', 2));
test('lone surrogate + combining mark', macro('\u{D800}\u{301}', 1));
test('valid surrogate pair is not affected', macro('\u{D83D}\u{DE00}', 2));
test('lone surrogate with wide ambiguous option', macro('\u{D800}', 2, {ambiguousIsNarrow: false}));
test('lone surrogate after emoji', macro('😀\u{D800}', 3));

test('every single-code-unit RGI emoji is double-width', () => {
	const narrow = [];
	for (let codePoint = 0; codePoint <= 0xFF_FF; codePoint++) {
		const character = String.fromCodePoint(codePoint);
		if (/^\p{RGI_Emoji}$/v.test(character) && stringWidth(character) !== 2) {
			narrow.push(codePoint.toString(16));
		}
	}

	assert.deepEqual(narrow, []);
});
