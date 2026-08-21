/**
 * `DashboardView` 의 계산이 **다시 계산될 수 있는가**.
 *
 * 왜 있나
 *     액션아이템 이력(`aiHistory`)과 사업부 목록(`execDivOrder`)은 화면이 뜬 **뒤에**
 *     정해진다. 그 값을 쓰는 `useMemo` 의 의존성 목록에서 빠뜨리면, 값이 도착해도
 *     **처음 계산한 결과를 그대로 붙들고 있다.**
 *
 *     실제로 그랬다(0.5.0). 전체 카드는 낡은 값을, 사업부 카드는 탭을 옮길 때
 *     우연히 다시 계산된 값을 말해서 **둘이 서로 다른 수**를 보였다. 문법은
 *     멀쩡하고 빌드도 통과한다 — 틀린 값만 조용히 나온다.
 *
 * 왜 lint 만으로 안 되나
 *     `react-hooks/exhaustive-deps` 가 같은 것을 잡지만, 지금은 경고이고 천장
 *     121건짜리 **래칫**으로 묶여 있다. 다른 경고 하나를 고치면서 이 실수를
 *     들이면 총합이 그대로라 빠져나간다. 여기서는 **이름을 콕 집어** 본다.
 *
 * ⚠️ 소스를 글자로 읽는다. `DashboardView` 가 1만 2천 줄이라 계산이 컴포넌트
 *    안에 갇혀 있어서 불러올 수가 없다. 계산을 utils 로 꺼내면 이 시험은
 *    평범한 단위 시험으로 바뀔 수 있다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'DashboardView.jsx'), 'utf-8')
  .replace(/\r\n/g, '\n');
const LINES = SRC.split('\n');

/** 헬퍼 **정의 본문**. 거기서 서로 부르는 것은 memo 가 아니다. */
const defRanges = [];
LINES.forEach((line, i) => {
  if (!/^\s*const (aiCountProgressAsOf|computeExecMetrics|aiCountsAt)\s*=/.test(line)) return;
  for (let j = i + 1; j < LINES.length; j++) {
    if (/^ {2}\};\s*$/.test(LINES[j])) { defRanges.push([i, j]); break; }
  }
});
const inDefinition = (i) => defRanges.some(([a, b]) => i >= a && i <= b);

const DEPS_LINE = /^\s*\}?,?\s*\[(.*)\]\s*\)?;?\s*$/;
const SCOPED = /executive|projects|divisionDetail|kpiDefinitions/;

const HOOK_OPEN = /=\s*use(Memo|Callback)\(|^\s*useEffect\(/;

/**
 * 그 자리가 훅 안인가. 위로 훑어 `useMemo` ㆍ `useCallback` ㆍ `useEffect` 를 먼저
 * 만나면 훅 안이다.
 *
 * ⚠️ 렌더 본문에서 쓰는 것은 **의존성 목록이 아예 없다**(매 렌더 다시 읽으므로
 *    낡을 수가 없다). 그것까지 잡으면 시험이 거짓으로 운다.
 */
const inHook = (i) => {
  for (let j = i; j >= Math.max(0, i - 200); j--) {
    if (HOOK_OPEN.test(LINES[j])) return true;
    if (/^  const \w+ = \(/.test(LINES[j]) || /^  return \(/.test(LINES[j])) return false;
  }
  return false;
};

/** `line` 뒤에서 가장 가까운 의존성 배열. 없으면 null. */
const depsAfter = (i) => {
  for (let j = i; j < Math.min(i + 240, LINES.length); j++) {
    const m = LINES[j].match(DEPS_LINE);
    if (m && SCOPED.test(m[1])) return { line: j + 1, deps: m[1] };
  }
  return null;
};

/** `uses` 를 쓰는 자리를 모아, 그 memo 가 `dep` 를 의존성에 갖고 있는지 본다. */
const guard = (uses, dep) => {
  const sites = [];
  LINES.forEach((line, i) => {
    if (!uses.test(line)) return;
    const t = line.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
    if (inDefinition(i)) return;
    if (!inHook(i)) return;              // 렌더 본문 — 의존성 목록이 없다
    sites.push(i);
  });
  assert.ok(sites.length > 0, `${dep} 를 쓰는 자리를 하나도 못 찾았다 — 시험이 낡았다`);
  for (const i of sites) {
    const d = depsAfter(i);
    assert.ok(d, `${i + 1}행의 의존성 배열을 못 찾았다 — 사람이 봐야 한다\n  ${LINES[i].trim()}`);
    assert.ok(d.deps.includes(dep),
      `${i + 1}행이 ${dep} 를 쓰는데 ${d.line}행 의존성에 없다\n`
      + `  쓰는 곳: ${LINES[i].trim().slice(0, 80)}\n`
      + `  의존성 : [${d.deps}]`);
  }
  return sites.length;
};

test('이력을 쓰는 계산은 이력이 도착하면 다시 계산된다', () => {
  const n = guard(/(aiCountProgressAsOf|computeExecMetrics|aiCountsAt)\(/, 'aiHistory');
  assert.ok(n >= 5, `자리가 ${n}곳뿐이다 — 계산이 옮겨갔는지 확인할 것`);
});

test('사업부 목록을 쓰는 계산은 설정이 도착하면 다시 계산된다', () => {
  guard(/\bexecDivOrder\b/, 'execDivOrder');
});

/**
 * **차례**를 박은 배열만 잡는다.
 *
 * ⚠️ 「어느 사업부를 보여줄까」를 고르는 배열은 성격이 다르다 — divisionOrder 의
 *    주석이 그렇게 못박고 있다. 아래 셋이 그것이고, 새로 늘리려면 여기에 **일부러**
 *    적어야 한다. 그 손길이 곧 "이게 차례가 아니라 대상이 맞나" 를 한 번 묻는다.
 */
const SELECTION_CONSTS = ['KPI_DIVISIONS', 'PERF_TARGET_DIVS', 'BU_GROUP', 'FN_GROUP'];

test('사업부 차례를 손으로 박아 두지 않는다', () => {
  // 다섯 곳에 흩어져 서로 어긋나 있던 것을 걷어냈다(2026-08-21). 되살아나면 잡는다.
  const hardcoded = LINES
    .map((line, i) => ({ line, i }))
    .filter(({ line }) => /\[\s*'MX'\s*,\s*'VD'\s*,/.test(line))
    .filter(({ line }) => !SELECTION_CONSTS.some(name => line.includes(name)));
  assert.deepEqual(hardcoded.map(h => `${h.i + 1}행: ${h.line.trim()}`), [],
    '사업부 차례는 설정에서 온다(utils/divisionOrder). 배열을 여기 박지 말 것.\n'
    + '대상을 고르는 배열이라면 SELECTION_CONSTS 에 이름을 더할 것.');
});
