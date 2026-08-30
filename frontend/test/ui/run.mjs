// 눌러 보는 시험 — `npm run test:ui`
//
// 왜 따로 있나: `npm test`(node --test) 는 번들러 없이 소스를 그대로 읽어 **JSX 를 못 읽는다.**
// 화면 부품을 실제로 눌러 보려면 esbuild 로 묶어(styled-components 는 스텁으로) jsdom 위에서
// 돌려야 한다. 서버 렌더(renderToString)로는 useEffect 도 클릭도 안 돈다.
//
// 시험 파일: test/ui/*.test.jsx — 각 파일은 process.exitCode 로 틀린 수를 남긴다.
import { build } from 'esbuild';
import { readdirSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const out = join(root, '.tmp-ui-tests');
mkdirSync(out, { recursive: true });

const files = readdirSync(here).filter(f => f.endsWith('.test.jsx'));
let failed = 0;
for (const f of files) {
  const outfile = join(out, f.replace(/\.jsx$/, '.mjs'));
  await build({
    entryPoints: [join(here, f)],
    bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'error',
    alias: {
      'styled-components': join(here, 'sc-stub.js'),
      'react-force-graph-2d': join(here, 'fg-stub.js'),
      'xlsx-js-style': join(here, 'xlsx-stub.js'),   // CJS 라 묶으면 불러오는 자리에서 터진다
    },
    // Vite 의 import.meta.env 는 esbuild 에 없다 — 다른 모듈 부품을 끌어 쓰면 여기서 터진다.
    define: { 'import.meta.env': '{}' },
    external: ['jsdom'],
    jsx: 'automatic',
  });
  console.log(`\n▶ ${f}`);
  const mod = await import(pathToFileURL(outfile).href + `?t=${Date.now()}`);
  const bad = typeof mod.default === 'function' ? await mod.default() : 0;
  failed += bad || 0;
}
rmSync(out, { recursive: true, force: true });
console.log(failed ? `\n✖ 틀림 ${failed}건` : '\n✔ 전부 맞음');
process.exit(failed ? 1 : 0);
