/**
 * 확장자 없는 import 를 풀어 준다.
 *
 * 화면 코드는 `import { COLUMNS } from '../constants'` 처럼 확장자를 안 적는다.
 * 번들러(vite)는 이것을 풀어 주지만 **node 의 ESM 해석기는 못 푼다.** 시험은
 * 번들러 없이 소스를 그대로 불러오므로 그 자리를 여기서 메운다.
 *
 * ⚠️ vite 가 하는 일 **전부**를 흉내내지 않는다. 지금 필요한 것은 확장자 보충
 *    하나뿐이다. 이 저장소는 경로 별칭(alias)을 쓰지 않는다 — 쓰기 시작하면
 *    이 훅도 따라가야 한다. 그때 여기 주석부터 읽을 것.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const TRY = ['.js', '.jsx', '/index.js', '/index.jsx'];

export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (err) {
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
