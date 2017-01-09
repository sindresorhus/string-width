import test from 'ava';
import stringWidth from './';

test('main', t => {
	t.is(stringWidth('abcde'), 5);
	t.is(stringWidth('古池や'), 6);
	t.is(stringWidth('あいうabc'), 9);
	t.is(stringWidth('ノード.js'), 9);
	t.is(stringWidth('你好'), 4);
	t.is(stringWidth('안녕하세요'), 10);
	t.is(stringWidth('안녕※하세요'), 12);
	t.is(stringWidth.ambiguousCharOneWidth('안녕※하세요'), 11);
	t.is(stringWidth('A\ud83c\ude00BC'), 5, 'surrogate');
	t.is(stringWidth('\u001b[31m\u001b[39m'), 0);
});

test('ignores control characters', t => {
	t.is(stringWidth(String.fromCharCode(0)), 0);
	t.is(stringWidth(String.fromCharCode(31)), 0);
	t.is(stringWidth(String.fromCharCode(127)), 0);
	t.is(stringWidth(String.fromCharCode(134)), 0);
	t.is(stringWidth(String.fromCharCode(159)), 0);
	t.is(stringWidth('\u001b'), 0);
});
