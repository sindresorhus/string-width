import {expectType} from 'tsd-check';
import stringWidth from '.';

expectType<number>(stringWidth('古'));
