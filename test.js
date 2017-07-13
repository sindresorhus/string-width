import test from 'ava';
import m from '.';

test('main', t => {
	t.is(m('abcde'), 5);
	t.is(m('古池や'), 6);
	t.is(m('あいうabc'), 9);
	t.is(m('ノード.js'), 9);
	t.is(m('你好'), 4);
	t.is(m('안녕하세요'), 10);
	t.is(m('😍'), 2);
	t.is(m('A\uD83C\uDE00BC'), 5, 'surrogate');
	t.is(m('\u001B[31m\u001B[39m'), 0);
});

test('ignores control characters', t => {
	t.is(m(String.fromCharCode(0)), 0);
	t.is(m(String.fromCharCode(31)), 0);
	t.is(m(String.fromCharCode(127)), 0);
	t.is(m(String.fromCharCode(134)), 0);
	t.is(m(String.fromCharCode(159)), 0);
	t.is(m('\u001B'), 0);
});

test.failing('handles combining characters', t => {
	t.is(m('x\u0300'), 1);
});
