import {expectType} from 'tsd';
import stringWidth from './index.js';

expectType<number>(stringWidth('古'));
expectType<number>(stringWidth('★', {}));
expectType<number>(stringWidth('★', {ambiguousIsNarrow: false}));
expectType<number>(stringWidth('\u001B[31m\u001B[39m', {countAnsiEscapeCodes: true}));
