/**
 * 확장자 없는 import 를 풀어 준다.
 *
 * 화면 코드는 `import { COLUMNS } from '../constants'` 처럼 확장자를 안 적는다.
 * 번들러(vite)는 이것을 풀어 주지만 **node 의 ESM 해석기는 못 푼다.** 시험은
 * 번들러 없이 소스를 그대로 불러오므로 그 자리를 여기서 메운다.
 *
 * ⚠️ vite 가 하는 일 **전부**를 흉내내지 않는다. 확장자 보충과 별칭 `@` 둘뿐이다.
 *    vite.config.js 의 `resolve.alias` 를 늘리면 **여기도 함께** 늘려야 한다 —
 *    안 그러면 그 파일을 부르는 시험만 조용히 못 돈다.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const TRY = ['.js', '.jsx', '/index.js', '/index.jsx'];

/** vite.config.js 의 `resolve.alias` 와 **같은 것**이어야 한다. */
const ALIAS = { '@/': new URL('../src/', import.meta.url).pathname.replace(/^\//, '') };

export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (err) {
    // 별칭 먼저. `@/utils/x` 같은 것은 상대 경로가 아니라 아래 검사에 안 걸린다.
    for (const [prefix, base] of Object.entries(ALIAS)) {
      if (!specifier.startsWith(prefix)) continue;
      for (const ext of ['', ...TRY]) {
        const candidate = pathResolve(base, specifier.slice(prefix.length) + ext);
        if (existsSync(candidate)) {
          return { url: pathToFileURL(candidate).href, shortCircuit: true };
        }
      }
    }
    // 상대 경로만 손댄다. 패키지 이름을 여기서 주무르면 진짜 오류가 묻힌다.
    if (!specifier.startsWith('.') || !context.parentURL) throw err;
    const base = dirname(fileURLToPath(context.parentURL));
    for (const ext of TRY) {
      const candidate = pathResolve(base, specifier + ext);
      if (existsSync(candidate)) {
        return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }
    }
    throw err;   // 못 찾으면 원래 오류를 그대로 — 우리가 만든 오류로 덮지 않는다
  }
}
