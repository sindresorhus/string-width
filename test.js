'use strict';
var test = require('ava');
var fn = require('./');

test(function (t) {
	t.assert(fn('abcde') === 5);
	t.assert(fn('古池や') === 6);
	t.assert(fn('あいうabc') === 9);
	t.assert(fn('ノード.js') === 9);
	t.assert(fn('你好') === 4);
	t.assert(fn('안녕하세요') === 10);
	t.assert(fn('A\ud83c\ude00BC') === 5, 'surrogate');
	t.assert(fn('\u001b[31m\u001b[39m') === 0);
	t.end();
});
