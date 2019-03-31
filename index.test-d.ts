import {expectType} from 'tsd';
import stringWidth = require('.');

expectType<number>(stringWidth('古'));
