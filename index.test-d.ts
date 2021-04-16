import {expectType} from 'tsd';
import stringWidth from './index.js';

expectType<number>(stringWidth('古'));
