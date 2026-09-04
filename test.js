import test from 'ava';
import stringWidth, {_standaloneRanges as standaloneRanges} from './index.js';

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
test('repeated leading Hangul jamo in one grapheme cluster stay additive', macro, 'ᄀᄀ', 4);
test('long leading Hangul jamo cluster stays additive', macro, 'ᄀᄀᄀᄀᄀᄀ', 12);
test('decomposed Hangul syllable cluster', macro, '가', 2);
test('decomposed Hangul syllable cluster with trailing jamo', macro, '각', 2);
test('decomposed Hangul syllable cluster with variation selector', macro, '가\uFE0F', 2);
test('repeated leading jamo before vowel composes last pair', macro, 'ᄀ가', 4);
test('repeated vowel jamo after leading composes first pair', macro, '가ᅡ', 3);
test('repeated trailing jamo after syllable composes first three', macro, '각ᆨ', 3);
test('repeated leading Hangul jamo with variation selector stay additive', macro, 'ᄀᄀ\uFE0F', 4);
test('repeated leading Hangul jamo with trailing ZWJ stay additive', macro, 'ᄀᄀ\u200D', 4);
test('vowel-only Hangul jamo cluster stays additive', macro, 'ᅡᅡᅡ', 3);
test('trailing-only Hangul jamo cluster stays additive', macro, 'ᆨᆨ', 2);
test('single leading jamo alone is width 2', macro, 'ᄀ', 2);
test('single vowel jamo alone is width 1', macro, 'ᅡ', 1);
test('single trailing jamo alone is width 1', macro, 'ᆨ', 1);
test('vowel jamo before leading jamo does not compose', macro, 'ᅡᄀ', 3);
test('leading jamo followed by trailing jamo without vowel does not compose', macro, 'ᄀᆨ', 3);
test('extended leading jamo U+A960 + standard vowel composes to width 2', macro, 'ꥠᅡ', 2);
test('standard leading jamo + extended vowel U+D7B0 composes to width 2', macro, 'ᄀힰ', 2);
test('extended leading + standard vowel + standard trailing composes to width 2', macro, 'ꥠᅡᆨ', 2);
test('Hangul Compatibility Jamo is full-width via EAW', macro, 'ㄱ', 2);
test('two Hangul Compatibility Jamo do not compose', macro, 'ㄱㄱ', 4);
test('precomposed syllable 가 U+AC00', macro, '가', 2);
test('precomposed syllable 한 U+D55C', macro, '한', 2);
test('three precomposed syllables', macro, '한국어', 6);
test('leading jamo + precomposed syllable in one cluster', macro, 'ᄀ가', 4);

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
test('Tibetan combining mark', macro, 'ཟླ', 1);
test('enclosing mark', macro, 'a\u20DD', 1);
test('spacing mark alone', macro, '\u093E', 1);
test('spacing mark after base character', macro, '\u0915\u093E', 2);
test('pre-base spacing mark after base character', macro, '\u0915\u093F', 2);

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

// Emoji coverage for RGI and related cases
// Case 1: Emoji with VS16 (should be double-width)
test('digit with VS16 (keycap base)', macro, '0\uFE0F', 1); // Digits/asterisk/pound are not RGI emoji
test('asterisk with VS16', macro, '*\uFE0F', 1);
test('pound with VS16', macro, '#\uFE0F', 1);
test('trademark with VS16', macro, '™\uFE0F', 2);
test('watch with VS16', macro, '⌚\uFE0F', 2);
test('phone with VS16', macro, '☎\uFE0F', 2);
test('keyboard with VS16', macro, '⌨\uFE0F', 2);
test('envelope with VS16', macro, '✉\uFE0F', 2);

// Case 2: Emoji_Presentation characters without VS15 (should be double-width)
test('face emoji (has Emoji_Presentation)', macro, '😀', 2);
test('heart emoji (has Emoji_Presentation)', macro, '❤️', 2);
test('fire emoji (has Emoji_Presentation)', macro, '🔥', 2);
test('rocket emoji (has Emoji_Presentation)', macro, '🚀', 2);
test('star emoji (has Emoji_Presentation)', macro, '⭐', 2);

// Case 3: Emoji_Presentation with VS15 (should be single-width)
test('heart with VS15 (text style)', macro, '❤\uFE0E', 1);
test('star with VS15 (text style)', macro, '⭐\uFE0E', 2); // Star with VS15 still renders as 2 in terminals

// Case 4: Multi-scalar meaningful sequences (should be double-width)
test('keycap sequence 0️⃣', macro, '0️⃣', 2);
test('keycap sequence 1️⃣', macro, '1️⃣', 2);
test('keycap sequence 9️⃣', macro, '9️⃣', 2);
test('keycap sequence *️⃣', macro, '*️⃣', 2);
test('keycap sequence #️⃣', macro, '#️⃣', 2);
test('flag emoji GB', macro, '🇬🇧', 2);
test('flag emoji JP', macro, '🇯🇵', 2);
test('skin tone modifier', macro, '👋🏻', 2);
test('skin tone modifier dark', macro, '👋🏿', 2);
test('couple with heart', macro, '👨‍❤️‍👨', 2);
test('woman technologist', macro, '👩‍💻', 2);
test('man health worker', macro, '👨‍⚕️', 2);

// Case 5: Non-emoji presentation without VS16 (should be single-width via EAW)
test('watch without VS', macro, '⌚', 2); // Watch is actually RGI emoji with Emoji_Presentation
test('phone without VS (not Emoji_Presentation)', macro, '☎', 1);
test('keyboard without VS (not Emoji_Presentation)', macro, '⌨', 1);
test('envelope without VS (not Emoji_Presentation)', macro, '✉', 1);

// Case 6: Edge cases for multi-scalar logic
test('single code point with VS15 (2 scalars but not meaningful)', macro, 'A\uFE0E', 1);
test('emoji with VS15 only (2 scalars, VS15 present)', macro, '⌚\uFE0E', 2); // Watch with VS15 still renders as 2
test('three code points with VS15 at end', macro, 'A👋\uFE0E', 3);

// Case 7: RGI emoji coverage
test('RGI emoji face', macro, '😊', 2);
test('RGI emoji hand', macro, '✋', 2);
test('RGI emoji animal', macro, '🐶', 2);
test('RGI emoji food', macro, '🍕', 2);
test('RGI emoji flag', macro, '🏁', 2);

// Case 8: Complex emoji sequences that test all branches
test('emoji with combining mark', macro, '😀\u0301', 2);
test('emoji with ZWJ and another emoji', macro, '😀\u200D😀', 2);
test('text character made emoji with VS16', macro, '↔\uFE0F', 2);
test('text character kept text with VS15', macro, '↔\uFE0E', 1);

// Case 9: Non-RGI sequences
test('non-RGI with VS16', macro, '〰\uFE0F', 2);
test('non-RGI multi-scalar', macro, '☎\uFE0F\u20E3', 1); // Not RGI emoji, counts as 1

// Case 10: VS15 on Emoji_Presentation remain width 2 in most terminals via EAW
test('hourglass with VS15', macro, '⌛\uFE0E', 2);
test('fast-forward with VS15', macro, '⏩\uFE0E', 2);
test('rewind with VS15', macro, '⏪\uFE0E', 2);
test('arrow double up with VS15', macro, '⏫\uFE0E', 2);
test('arrow double down with VS15', macro, '⏬\uFE0E', 2);
test('alarm clock with VS15', macro, '⏰\uFE0E', 2);
test('hourglass flowing sand with VS15', macro, '⏳\uFE0E', 2);
test('umbrella with rain with VS15', macro, '☔\uFE0E', 2);
test('hot beverage with VS15', macro, '☕\uFE0E', 2);
// Removed redundant duplicate of '⭐\uFE0E' test

// Other emoji that may not have Emoji_Presentation but are affected
test('sun with VS15', macro, '☀\uFE0E', 1);
test('cloud with VS15', macro, '☁\uFE0E', 1);
test('umbrella with VS15', macro, '☂\uFE0E', 1);
test('snowman with VS15', macro, '☃\uFE0E', 1);
test('comet with VS15', macro, '☄\uFE0E', 1);
test('black nib with VS15', macro, '✒\uFE0E', 1);
test('heavy check mark with VS15', macro, '✔\uFE0E', 1);

// More edge cases for single-scalar text characters (not emoji)
test('digit zero as plain text (not emoji)', macro, '0', 1);
test('digit one as plain text', macro, '1', 1);
test('asterisk as plain text', macro, '*', 1);
test('hash as plain text', macro, '#', 1);

// Unicode Format characters (non-default-ignorable)
test('Arabic number sign U+0600', macro, '\u0600', 0);
test('Arabic end of ayah U+06DD', macro, '\u06DD', 0);
test('Syriac abbreviation mark U+070F', macro, '\u070F', 0);

// Minimally-qualified/unqualified emoji sequences
// These are emoji sequences missing VS16 but should still be width 2
test('heart on fire (MQ)', macro, '\u2764\u200D\u{1F525}', 2); // ❤‍🔥
test('rainbow flag (MQ)', macro, '\u{1F3F3}\u200D\u{1F308}', 2); // 🏳‍🌈
test('transgender flag (MQ)', macro, '\u{1F3F3}\u200D\u26A7', 2); // 🏳‍⚧
test('broken chain (MQ)', macro, '\u26D3\u200D\u{1F4A5}', 2); // ⛓‍💥
test('eye in speech bubble (MQ)', macro, '\u{1F441}\u200D\u{1F5E8}', 2); // 👁‍🗨
test('man bouncing ball (MQ)', macro, '\u26F9\u200D\u2642', 2); // ⛹‍♂
test('woman bouncing ball (MQ)', macro, '\u26F9\u200D\u2640', 2); // ⛹‍♀
test('man detective (MQ)', macro, '\u{1F575}\u200D\u2642', 2); // 🕵‍♂
test('woman detective (MQ)', macro, '\u{1F575}\u200D\u2640', 2); // 🕵‍♀

// Unqualified keycap sequences (missing VS16)
test('keycap # (UQ)', macro, '#\u20E3', 2); // #⃣
test('keycap 0 (UQ)', macro, '0\u20E3', 2); // 0⃣
test('keycap * (UQ)', macro, '*\u20E3', 2); // *⃣

// Ensure invalid keycap sequences don't match
test('phone + keycap (invalid)', macro, '\u260E\uFE0F\u20E3', 1); // Not a valid keycap base

// Latin1 range (0xA0–0x2FF) — width 1, no segmenter or EAW lookup needed
test('non-breaking space U+00A0', macro, '\u00A0', 1);
test('Latin ñ U+00F1', macro, 'ñ', 1);
test('Latin ü U+00FC', macro, 'ü', 1);
test('Latin ÿ U+00FF', macro, 'ÿ', 1);
test('Latin1 in text', macro, 'café', 4);
test('Spacing Modifier U+02FF', macro, '\u02FF', 1);

// Soft hyphen (0xAD) — zero-width
test('soft hyphen U+00AD', macro, '\u00AD', 0);
test('soft hyphen in text', macro, 'a\u00ADb', 2);

// Combining diacritical boundary (0x300) — zero-width combining mark
test('combining grave U+0300 alone', macro, '\u0300', 0);
test('char + combining at 0x300 boundary', macro, 'a\u0300', 1);

// ASCII boundary characters
test('space U+0020 (lowest printable ASCII)', macro, ' ', 1);
test('tilde U+007E (highest printable ASCII)', macro, '~', 1);
test('DEL U+007F (just above printable ASCII)', macro, '\u007F', 0);
test('unit separator U+001F (just below printable ASCII)', macro, '\u001F', 0);

// Ambiguous characters
test('ambiguous in text (narrow default)', macro, '±×÷', 3);
test('ambiguous in text (wide)', macro, '±×÷', 6, {ambiguousIsNarrow: false});
test('ambiguous mixed with CJK', macro, '±你', 3);
test('ambiguous mixed with CJK (wide)', macro, '±你', 4, {ambiguousIsNarrow: false});

// `stripAnsi` guard: non-ANSI strings should not call `stripAnsi`
test('non-ASCII without ANSI escapes', macro, '你好世界', 8);
test('Latin1 without ANSI escapes', macro, 'résumé', 6);

// ASCII runs are counted without segmenting; characters at the edges of a run may still join a cluster
test('long ASCII with trailing emoji', macro, 'a'.repeat(40) + '😀', 42);
test('long ASCII with leading emoji', macro, '😀' + 'a'.repeat(40), 42);
test('emoji between long ASCII runs', macro, 'a'.repeat(40) + '😀' + 'b'.repeat(40), 82);
test('emoji between short ASCII runs', macro, '😀 ok 😀', 8);
test('combining mark after long ASCII run', macro, 'a'.repeat(40) + '\u0301', 40);
test('combining mark between long ASCII runs', macro, 'a'.repeat(40) + '\u0301' + 'b'.repeat(40), 80);
test('ZWJ after long ASCII run', macro, 'a'.repeat(40) + '\u200D\u200D', 40);
test('prepend before long ASCII run', macro, '\u0600' + 'a'.repeat(40), 40);
test('keycap at the end of a long ASCII run', macro, 'a'.repeat(40) + '#\u20E3', 42);
test('keycap between long ASCII runs', macro, 'a'.repeat(40) + '#\uFE0F\u20E3' + 'b'.repeat(40), 82);
test('CJK between long ASCII runs', macro, 'a'.repeat(40) + '你好' + 'b'.repeat(40), 84);
test('ambiguous between long ASCII runs (wide)', macro, 'a'.repeat(40) + '±' + 'b'.repeat(40), 82, {ambiguousIsNarrow: false});
test('tab between long ASCII runs', macro, 'a'.repeat(40) + '\t' + 'b'.repeat(40), 80);
test('ANSI codes around long ASCII with emoji', macro, '\u001B[32m' + 'a'.repeat(40) + ' ✅\u001B[0m', 43);

// Standalone character runs: characters that never join a neighbouring cluster are counted without the segmenter,
// while the first and last character of a run stay with the segmenter
test('accented letter with combining mark', macro, 'é\u0301', 1);
test('accented word with combining mark', macro, 'café\u0301', 4);
test('long accented run with trailing combining mark', macro, 'é'.repeat(40) + '\u0301', 40);
test('long accented run with trailing combining mark (ambiguous wide)', macro, 'é'.repeat(40) + '\u0301', 80, {ambiguousIsNarrow: false});
test('combining mark between accented runs', macro, 'é'.repeat(20) + '\u0301' + 'ñ'.repeat(20), 40);
test('combining mark between accented runs (ambiguous wide)', macro, 'é'.repeat(20) + '\u0301' + 'ñ'.repeat(20), 60, {ambiguousIsNarrow: false});
test('CJK with VS16', macro, '你\uFE0F', 2);
test('CJK run with trailing VS15', macro, '你好世界'.repeat(5) + '\uFE0E', 40);
test('VS16 between CJK runs', macro, '你'.repeat(20) + '\uFE0F' + '好'.repeat(20), 80);
test('precomposed syllable with trailing jamo', macro, '가\u11A8', 2);
test('syllable run with trailing jamo', macro, '가'.repeat(20) + '\u11A8', 40);
test('leading jamo before syllable run', macro, '\u1100' + '가'.repeat(20), 42);
test('precomposed syllable with vowel jamo', macro, '가\u1161', 2);
test('emoji modifier after CJK', macro, '你\u{1F3FD}', 2);
test('emoji modifier between CJK runs', macro, '你'.repeat(20) + '\u{1F3FD}' + '好'.repeat(20), 80);
test('halfwidth kana run with voiced sound mark', macro, 'ｶ'.repeat(20) + '\uFF9E', 21);
test('hiragana run with combining dakuten', macro, 'か'.repeat(20) + '\u3099', 40);
test('Cyrillic run with combining mark', macro, 'ж'.repeat(20) + '\u0483', 20);
test('Cyrillic run with combining mark (ambiguous wide)', macro, 'ж'.repeat(20) + '\u0483', 40, {ambiguousIsNarrow: false});
test('Greek run with combining mark', macro, 'α'.repeat(20) + '\u0345', 20);
test('copyright ZWJ copyright', macro, '©\u200D©', 2);
test('copyright run', macro, '©'.repeat(20), 20);
test('soft hyphen between Latin runs', macro, 'a'.repeat(20) + '\u00AD' + 'b'.repeat(20), 40);
test('Hangul filler between compatibility jamo runs', macro, 'ㄱ'.repeat(20) + '\u3164' + 'ㄴ'.repeat(20), 80);
test('CJK Extension B run', macro, '\u{20000}'.repeat(20), 40);
test('CJK Extension B run with combining mark', macro, '\u{20000}'.repeat(20) + '\u0301', 40);
test('combining mark before CJK Extension B run', macro, '\u0301' + '\u{20000}'.repeat(20), 40);
test('CJK Extension B run between combining marks', macro, '\u0301' + '\u{20000}'.repeat(20) + '\u0301', 40);
test('Hangul filler before CJK Extension B character', macro, '\u3164\u{2FA1F}', 2);
test('CJK Extension B character between symbols', macro, '\u2192\u{2A6D6}\u{1F3C1}\u4E3D', 7);
test('tag between symbol and CJK Extension G character', macro, '\u25FC\u{E0001}\u{3134A}', 3);
test('box drawing table row', macro, '│ 名前 │ OK │', 13);
test('box drawing table row (ambiguous wide)', macro, '│ 名前 │ OK │', 16, {ambiguousIsNarrow: false});
test('ambiguous run (wide)', macro, '±'.repeat(20), 40, {ambiguousIsNarrow: false});
test('mixed scripts prose', macro, 'Le café est déjà prêt 你好 Привет Γειά', 38);
test('mixed scripts prose (ambiguous wide)', macro, 'Le café est déjà prêt 你好 Привет Γειά', 51, {ambiguousIsNarrow: false});
test('prepend before CJK run', macro, '\u0600' + '你'.repeat(20), 40);
test('CJK run with trailing ZWJ', macro, '你'.repeat(20) + '\u200D', 40);
test('flag after CJK run', macro, '你'.repeat(20) + '\u{1F1FA}\u{1F1F8}', 42);

test('cached code point widths stay correct across cache eviction', t => {
	// More distinct code points than the cache holds, checked twice so both cold and warm lookups are covered
	for (let pass = 0; pass < 2; pass++) {
		for (let codePoint = 0x4E_00; codePoint < 0x4E_00 + 3000; codePoint++) {
			const character = String.fromCodePoint(codePoint);
			t.is(stringWidth('\u0301' + character), 2);
			t.is(stringWidth(character.repeat(3)), 6);
		}

		for (let codePoint = 0x3_91; codePoint <= 0x3_A1; codePoint++) {
			const character = String.fromCodePoint(codePoint);
			t.is(stringWidth('\u0301' + character), 1);
			t.is(stringWidth('\u0301' + character, {ambiguousIsNarrow: false}), 2);
			t.is(stringWidth(character.repeat(3), {ambiguousIsNarrow: false}), 6);
		}
	}
});

test('standalone ranges contain only characters that never join a neighbouring cluster', t => {
	// Anything that can take part in a join under UAX #29: Extend (marks, Grapheme_Extend, Emoji_Modifier), ZWJ and ZWNJ,
	// SpacingMark (Mc), Control (Cc, Cf, Cs, Zl, Zp, default ignorables), Regional_Indicator, and the scripts that carry
	// Prepend characters or Indic conjunct consonants and linkers.
	const joiningProperties = [
		'M',
		'Grapheme_Extend',
		'Emoji_Modifier',
		'Join_Control',
		'Cc',
		'Cf',
		'Cs',
		'Zl',
		'Zp',
		'Default_Ignorable_Code_Point',
		'Regional_Indicator',
		'Script=Arabic',
		'Script=Syriac',
		'Script=Devanagari',
		'Script=Bengali',
		'Script=Gurmukhi',
		'Script=Gujarati',
		'Script=Oriya',
		'Script=Tamil',
		'Script=Telugu',
		'Script=Kannada',
		'Script=Malayalam',
		'Script=Sinhala',
		'Script=Tibetan',
		'Script=Myanmar',
		'Script=Khmer',
		'Script=Thai',
		'Script=Lao',
		'Script=Balinese',
		'Script=Javanese',
	];
	const joiningRegex = new RegExp(`[${joiningProperties.map(property => `\\p{${property}}`).join('')}]`, 'u');

	// Every script the ranges may contain; anything else (including Inherited, which holds combining marks) is a failure
	const allowedScripts = ['Latin', 'Greek', 'Coptic', 'Cyrillic', 'Han', 'Hiragana', 'Katakana', 'Hangul', 'Bopomofo', 'Braille', 'Common'];
	const allowedScriptRegex = new RegExp(`^[${allowedScripts.map(script => `\\p{Script=${script}}`).join('')}\\p{Unassigned}]$`, 'u');

	// Grapheme_Cluster_Break=Prepend (Unicode 16)
	const prependCodePoints = new Set([
		0x6_00,
		0x6_01,
		0x6_02,
		0x6_03,
		0x6_04,
		0x6_05,
		0x6_DD,
		0x7_0F,
		0x8_90,
		0x8_91,
		0x8_E2,
		0xD_4E,
		0x1_10_BD,
		0x1_10_CD,
		0x1_11_C2,
		0x1_11_C3,
		0x1_19_3F,
		0x1_19_41,
		0x1_1A_3A,
		0x1_1A_84,
		0x1_1A_85,
		0x1_1A_86,
		0x1_1A_87,
		0x1_1A_88,
		0x1_1A_89,
		0x1_1D_46,
		0x1_1F_02,
	]);

	const isHangulJamo = codePoint => (codePoint >= 0x11_00 && codePoint <= 0x11_FF) || (codePoint >= 0xA9_60 && codePoint <= 0xA9_7F) || (codePoint >= 0xD7_B0 && codePoint <= 0xD7_FF);

	// The segmenter itself must agree: a standalone character never merges with a standalone neighbour of any kind
	// (ASCII, Extended_Pictographic, precomposed Hangul, CJK, or another copy of itself)
	const segmenter = new Intl.Segmenter();
	const probes = ['a', '©', '가', '你'];

	const failures = [];
	for (const [start, end] of standaloneRanges) {
		for (let codePoint = start; codePoint <= end; codePoint++) {
			const character = String.fromCodePoint(codePoint);
			const hex = codePoint.toString(16).toUpperCase();

			if (joiningRegex.test(character) || !allowedScriptRegex.test(character) || prependCodePoints.has(codePoint) || isHangulJamo(codePoint)) {
				failures.push(`U+${hex} can join a neighbouring cluster`);
				continue;
			}

			let probeString = character;
			for (const probe of probes) {
				probeString += probe + character;
			}

			const segmentCount = [...segmenter.segment(probeString)].length;
			if (segmentCount !== (probes.length * 2) + 1) {
				failures.push(`U+${hex} merges with a neighbour (${segmentCount} segments)`);
			}
		}
	}

	t.deepEqual(failures, []);
});

test('standalone ranges are sorted, disjoint and exclude the width-affecting halfwidth marks', t => {
	let previousEnd = -1;
	for (const [start, end] of standaloneRanges) {
		t.true(start > previousEnd, `range starting at U+${start.toString(16)} overlaps or is out of order`);
		t.true(end >= start);
		previousEnd = end;
	}

	const inRanges = codePoint => standaloneRanges.some(([start, end]) => codePoint >= start && codePoint <= end);
	t.false(inRanges(0xFF_9E));
	t.false(inRanges(0xFF_9F));
	t.false(inRanges(0xAD));
	t.false(inRanges(0x3_00));
	t.false(inRanges(0x20_0D));
	t.false(inRanges(0x30_99));
	t.true(inRanges(0x4E_00));
	t.true(inRanges(0xAC_00));
	t.true(inRanges(0xE9));
});
