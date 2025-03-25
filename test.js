import test from 'ava';
import stringWidth from './index.js';

test('main', t => {
	t.is(stringWidth('⛣', { ambiguousIsNarrow: false }), 2);
	t.is(stringWidth('abcde'), 5);
	t.is(stringWidth('古池や'), 6);
	t.is(stringWidth('あいうabc'), 9);
	t.is(stringWidth('あいう★'), 7);
	t.is(stringWidth('あいう★', { ambiguousIsNarrow: false }), 8);
	t.is(stringWidth('±'), 1);
	t.is(stringWidth('ノード.js'), 9);
	t.is(stringWidth('你好'), 4);
	t.is(stringWidth('안녕하세요'), 10);
	t.is(stringWidth('A\uD83C\uDE00BC'), 5, 'surrogate');
	t.is(stringWidth('\u001B[31m\u001B[39m'), 0);
	t.is(stringWidth('\u001B[31m\u001B[39m', { countAnsiEscapeCodes: true }), 8);
	t.is(stringWidth('\u001B]8;;https://github.com\u0007Click\u001B]8;;\u0007'), 5);
	t.is(stringWidth('\u{231A}'), 1, '⌚ default emoji presentation character (Emoji_Presentation)');
	t.is(stringWidth('\u{2194}\u{FE0F}'), 2, '↔️ default text presentation character rendered as emoji');
	t.is(stringWidth('\u{1F469}'), 1, '👩 emoji modifier base (Emoji_Modifier_Base)');
	t.is(stringWidth('\u{1F469}\u{1F3FF}'), 2, '👩🏿 emoji modifier base followed by a modifier');
	t.is(stringWidth('\u{845B}\u{E0100}'), 2, 'Variation Selectors');
	t.is(stringWidth('ปฏัก'), 3, 'Thai script');
	t.is(stringWidth('_\u0E34'), 1, 'Thai script');
	t.is(stringWidth('“', { ambiguousIsNarrow: false }), 2);
});

test('ignores control characters', t => {
	t.is(stringWidth(String.fromCodePoint(0)), 0);
	t.is(stringWidth(String.fromCodePoint(31)), 0);
	t.is(stringWidth(String.fromCodePoint(127)), 0);
	t.is(stringWidth(String.fromCodePoint(134)), 0);
	t.is(stringWidth(String.fromCodePoint(159)), 0);
	t.is(stringWidth('\u001B'), 0);
});

test('handles combining characters', t => {
	t.is(stringWidth('x\u0300'), 1);
	t.is(stringWidth('\u0300\u0301'), 0);
	t.is(stringWidth('e\u0301e'), 2);
	t.is(stringWidth('x\u036F'), 1);
	t.is(stringWidth('\u036F\u036F'), 0);
});

test('handles ZWJ characters', t => {
	t.is(stringWidth('👶'), 1);
	t.is(stringWidth('👶🏽'), 2);
	t.is(stringWidth('👩‍👩‍👦‍👦'), 7);
	t.is(stringWidth('👨‍❤️‍💋‍👨'), 8);
});

test('handles zero-width characters', t => {
	t.is(stringWidth('\u200B'), 0);
	t.is(stringWidth('x\u200Bx'), 2);
	t.is(stringWidth('\u200C'), 0);
	t.is(stringWidth('x\u200Cx'), 2);
	t.is(stringWidth('\u200D'), 0);
	t.is(stringWidth('x\u200Dx'), 2);
	t.is(stringWidth('\uFEFF'), 0);
	t.is(stringWidth('x\uFEFFx'), 2);
});

test('handles surrogate pairs', t => {
	t.is(stringWidth('\uD83D\uDE00'), 1); // 😀
	t.is(stringWidth('A\uD83D\uDE00B'), 3);
});

test('handles variation selectors', t => {
	t.is(stringWidth('\u{1F1E6}\uFE0F'), 1); // Regional indicator symbol A with variation selector
	t.is(stringWidth('A\uFE0F'), 1);
	t.is(stringWidth('\uFE0F'), 0);
});

test('handles edge cases', t => {
	t.is(stringWidth(''), 0);
	t.is(stringWidth('\u200B\u200B'), 0);
	t.is(stringWidth('x\u200Bx\u200B'), 2);
	t.is(stringWidth('x\u0300x\u0300'), 2);
	t.is(stringWidth('\uD83D\uDE00\uFE0F'), 1); // 😀 with variation selector
	t.is(stringWidth('\uD83D\uDC69\u200D\uD83C\uDF93'), 3); // 👩‍🎓
	t.is(stringWidth('x\u1AB0x\u1AB0'), 2); // Combining diacritical marks extended
	t.is(stringWidth('x\u1DC0x\u1DC0'), 2); // Combining diacritical marks supplement
	t.is(stringWidth('x\u20D0x\u20D0'), 2); // Combining diacritical marks for symbols
	t.is(stringWidth('x\uFE20x\uFE20'), 2); // Combining half marks
});

test('ignores default ignorable code points', t => {
	t.is(stringWidth('\u2060'), 0); // Word joiner
	t.is(stringWidth('\u2061'), 0); // Function application
	t.is(stringWidth('\u2062'), 0); // Invisible times
	t.is(stringWidth('\u2063'), 0); // Invisible separator
	t.is(stringWidth('\u2064'), 0); // Invisible plus
	t.is(stringWidth('\uFEFF'), 0); // Zero-width no-break space
	t.is(stringWidth('x\u2060x'), 2);
	t.is(stringWidth('x\u2061x'), 2);
	t.is(stringWidth('x\u2062x'), 2);
	t.is(stringWidth('x\u2063x'), 2);
	t.is(stringWidth('x\u2064x'), 2);
});
