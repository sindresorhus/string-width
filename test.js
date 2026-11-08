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
test('repeated leading Hangul jamo in one grapheme cluster stay additive', macro('ᄀᄀ', 4));
test('long leading Hangul jamo cluster stays additive', macro('ᄀᄀᄀᄀᄀᄀ', 12));
test('decomposed Hangul syllable cluster', macro('가', 2));
test('decomposed Hangul syllable cluster with trailing jamo', macro('각', 2));
test('decomposed Hangul syllable cluster with variation selector', macro('가\u{FE0F}', 2));
test('repeated leading jamo before vowel composes last pair', macro('ᄀ가', 4));
test('repeated vowel jamo after leading composes first pair', macro('가ᅡ', 3));
test('repeated trailing jamo after syllable composes first three', macro('각ᆨ', 3));
test('repeated leading Hangul jamo with variation selector stay additive', macro('ᄀᄀ\u{FE0F}', 4));
test('repeated leading Hangul jamo with trailing ZWJ stay additive', macro('ᄀᄀ\u{200D}', 4));
test('vowel-only Hangul jamo cluster stays additive', macro('ᅡᅡᅡ', 3));
test('trailing-only Hangul jamo cluster stays additive', macro('ᆨᆨ', 2));
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
test('leading jamo + precomposed syllable in one cluster', macro('ᄀ가', 4));

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
test('tag sequence', macro('🏴', 2));

// Regional indicators
test('single regional indicator', macro('🇦', 1));
test('flag from two regional indicators', macro('🇺🇸', 2));
test('three regional indicators', macro('🇺🇸🇦', 3));

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
test('malformed surrogate', macro('\u{D800}', 0));
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

// Prepended Concatenation Mark (GB9b) should not affect width of following cluster
test('prepend + ASCII', macro('\u{600}A', 1));
test('prepend + CJK', macro('\u{600}你', 2));
test('prepend + emoji', macro('\u{600}😀', 2));

// Sequence consisting only of default ignorables should be zero
test('only default ignorables (tags)', macro('\u{E0020}\u{E007F}', 0));

// Emoji coverage for RGI and related cases
// Case 1: Emoji with VS16 (should be double-width)
test('digit with VS16 (keycap base)', macro('0\u{FE0F}', 1)); // Digits/asterisk/pound are not RGI emoji
test('asterisk with VS16', macro('*\u{FE0F}', 1));
test('pound with VS16', macro('#\u{FE0F}', 1));
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
test('star with VS15 (text style)', macro('⭐\u{FE0E}', 2)); // Star with VS15 still renders as 2 in terminals

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
test('emoji with VS15 only (2 scalars, VS15 present)', macro('⌚\u{FE0E}', 2)); // Watch with VS15 still renders as 2
test('three code points with VS15 at end', macro('A👋\u{FE0E}', 3));

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
test('non-RGI multi-scalar', macro('☎\u{FE0F}\u{20E3}', 1)); // Not RGI emoji, counts as 1

// Case 10: VS15 on Emoji_Presentation remain width 2 in most terminals via EAW
test('hourglass with VS15', macro('⌛\u{FE0E}', 2));
test('fast-forward with VS15', macro('⏩\u{FE0E}', 2));
test('rewind with VS15', macro('⏪\u{FE0E}', 2));
test('arrow double up with VS15', macro('⏫\u{FE0E}', 2));
test('arrow double down with VS15', macro('⏬\u{FE0E}', 2));
test('alarm clock with VS15', macro('⏰\u{FE0E}', 2));
test('hourglass flowing sand with VS15', macro('⏳\u{FE0E}', 2));
test('umbrella with rain with VS15', macro('☔\u{FE0E}', 2));
test('hot beverage with VS15', macro('☕\u{FE0E}', 2));
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
test('Arabic number sign U+0600', macro('\u{600}', 0));
test('Arabic end of ayah U+06DD', macro('\u{6DD}', 0));
test('Syriac abbreviation mark U+070F', macro('\u{70F}', 0));

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
test('keycap # (UQ)', macro('#\u{20E3}', 2)); // #⃣
test('keycap 0 (UQ)', macro('0\u{20E3}', 2)); // 0⃣
test('keycap * (UQ)', macro('*\u{20E3}', 2)); // *⃣

// Ensure invalid keycap sequences don't match
test('phone + keycap (invalid)', macro('\u{260E}\u{FE0F}\u{20E3}', 1)); // Not a valid keycap base

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
