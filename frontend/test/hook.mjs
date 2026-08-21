// `node --import ./test/hook.mjs --test src` 로 붙인다.
import { register } from 'node:module';
register('./resolver.mjs', import.meta.url);
