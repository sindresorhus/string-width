import test from 'ava';
import stringWidth from './index.js';

test('main', t => {
	t.is(stringWidth('abcde'), 5);
	t.is(stringWidth('古池や'), 6);
	t.is(stringWidth('あいうabc'), 9);
	t.is(stringWidth('あいう★'), 7);
	t.is(stringWidth('あいう★', {ambiguousIsNarrow: false}), 8);
	t.is(stringWidth('±'), 1);
	t.is(stringWidth('ノード.js'), 9);
	t.is(stringWidth('你好'), 4);
	t.is(stringWidth('안녕하세요'), 10);
	t.is(stringWidth('A\uD83C\uDE00BC'), 5, 'surrogate');
	t.is(stringWidth('\u001B[31m\u001B[39m'), 0);
	t.is(stringWidth('\u001B]8;;https://github.com\u0007Click\u001B]8;;\u0007'), 5);
	t.is(stringWidth('\u{231A}'), 2, '⌚ default emoji presentation character (Emoji_Presentation)');
	t.is(stringWidth('\u{2194}\u{FE0F}'), 2, '↔️ default text presentation character rendered as emoji');
	t.is(stringWidth('\u{1F469}'), 2, '👩 emoji modifier base (Emoji_Modifier_Base)');
	t.is(stringWidth('\u{1F469}\u{1F3FF}'), 2, '👩🏿 emoji modifier base followed by a modifier');
	t.is(stringWidth('\u{845B}\u{E0100}'), 2, 'Variation Selectors');
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
});

test('handles ZWJ characters', t => {
	t.is(stringWidth('👶'), 2);
	t.is(stringWidth('👶🏽'), 2);
	t.is(stringWidth('👩‍👩‍👦‍👦'), 2);
	t.is(stringWidth('👨‍❤️‍💋‍👨'), 2);
});
