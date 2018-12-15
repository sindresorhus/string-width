import test from 'ava';
import stringWidth from '.';

test('main', t => {
	t.is(stringWidth('abcde'), 5);
	t.is(stringWidth('古池や'), 6);
	t.is(stringWidth('あいうabc'), 9);
	t.is(stringWidth('ノード.js'), 9);
	t.is(stringWidth('你好'), 4);
	t.is(stringWidth('안녕하세요'), 10);
	t.is(stringWidth('A\uD83C\uDE00BC'), 5, 'surrogate');
	t.is(stringWidth('\u001B[31m\u001B[39m'), 0);
	t.is(stringWidth('\u{231A}'), 2, '⌚ default emoji presentation character (Emoji_Presentation)');
	t.is(stringWidth('\u{2194}\u{FE0F}'), 2, '↔️ default text presentation character rendered as emoji');
	t.is(stringWidth('\u{1F469}'), 2, '👩 emoji modifier base (Emoji_Modifier_Base)');
	t.is(stringWidth('\u{1F469}\u{1F3FF}'), 2, '👩🏿 emoji modifier base followed by a modifier');
});

test('ignores control characters', t => {
	t.is(stringWidth(String.fromCharCode(0)), 0);
	t.is(stringWidth(String.fromCharCode(31)), 0);
	t.is(stringWidth(String.fromCharCode(127)), 0);
	t.is(stringWidth(String.fromCharCode(134)), 0);
	t.is(stringWidth(String.fromCharCode(159)), 0);
	t.is(stringWidth('\u001B'), 0);
});

test('handles combining characters', t => {
	t.is(stringWidth('x\u0300'), 1);
});
