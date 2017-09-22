import test from 'ava';
import m from '.';

test('main', t => {
	t.is(m('abcde'), 5);
	t.is(m('古池や'), 6);
	t.is(m('あいうabc'), 9);
	t.is(m('ノード.js'), 9);
	t.is(m('你好'), 4);
	t.is(m('안녕하세요'), 10);
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

test('handles combining characters', t => {
	t.is(m('x\u0300'), 1);
});

test('handles zero-width-joiners - ZWJ ONLY', t => {
	// Random samples from http://unicode.org/emoji/charts/emoji-zwj-sequences.html
	// Family: man, woman, boy
	t.is(m('\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F466}', {joinAroundZWJ: true}), 1);
	// Family: woman, woman, boy, boy
	t.is(m('👩‍👩‍👦‍👦', {joinAroundZWJ: true}), 1);
});
