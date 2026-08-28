// 성숙도 — 전체 「요약」의 사업부 × 축 표를 실제로 그려 본다. (2026-08-28)
//
//   ① 전체 판이면 「요약」이 기본이고 가로가 사업부, 세로가 축이다
//   ② 축마다 다른 대표 수치 — 정확도 평균 · 적용 범위 「이상 %」 · 자동화 평균 켠 수 · 모델링 시험 재현률
//   ③ 사업부 머리를 누르면 그 사업부로 내려간다 · 「상세」로 바꾸면 시험 표가 나온다
import './setup-dom.mjs';   // ⚠️ 반드시 첫 import
import React from 'react';
import { render, click, settle, byText, html, fakeFetch, suite, unmount } from './dom-helpers.mjs';
import { BoardBody } from '../../src/modules/dev-dt-maturity/components/Board/BoardView';

const AXES = [
  { key: 'accuracy', label: '정확도', kind: 'value', rungs: [{ key: 'trend', label: '경향 일치' }, { key: 'quantitative', label: '원인 분석' }, { key: 'correlated', label: '현상 재현' }] },
  { key: 'automation', label: '자동화', kind: 'set', rungs: [{ key: 'manual', label: '수동' }, { key: 'pre', label: '전처리 자동', short: '전처리' }, { key: 'run', label: '실행 자동', short: '실행' }] },
  { key: 'modeling', label: '모델링 수준', kind: 'matrix', base: [{ key: 'geometry', label: '형상 재현' }, { key: 'performance', label: '거동 재현' }],
    columns: [{ key: 'test', label: '시험' }, { key: 'market', label: '시장' }],
    rungs: [{ key: 'none', label: '없음' }, { key: 'geometry', label: '형상' }, { key: 'performance', label: '거동' }, { key: 'test_some', label: '일부' }, { key: 'test_all', label: '전부' }, { key: 'market', label: '시장' }] },
  { key: 'scope', label: '적용 범위', kind: 'rung', rungs: [{ key: 'issue', label: '이슈 대응' }, { key: 'basic', label: '대표 모델' }, { key: 'derived_some', label: '신규 개발 전 모델' }, { key: 'all', label: '파생까지' }] },
];
const pair = (id, a) => ({ id, agent: { name: '해석', defect_types: ['크랙', '변색'] }, unassessed: Object.keys(a).filter(k => !a[k]), assessments: a });
const subj = (id, name, pairs) => ({ id, name, product_families: [], pairs, summary: { unassessed: 0, stale: 0, pair_count: pairs.length, best_rung_index: {} } });
const MX = { division_id: 17, division_name: 'MX', subjects: [subj(1, '낙하 시험', [
  pair(11, { accuracy: { value: 90, rung_index: 2 }, automation: { flags: ['pre', 'run'], rung_index: 2 }, modeling: { flags: ['geometry', 'performance'], rung_index: 4, summary: { test: 2, market: 0, total: 2 } }, scope: { rung_index: 3 } }),
  pair(12, { accuracy: { value: 70, rung_index: 1 }, automation: { flags: [], rung_index: 0 }, modeling: null, scope: { rung_index: 1 } }),
])] };
const VD = { division_id: 18, division_name: 'VD', subjects: [subj(2, '진동 시험', [
  pair(21, { accuracy: null, automation: { flags: ['pre'], rung_index: 1 }, modeling: { flags: [], rung_index: 0, summary: { test: 0, market: 0, total: 2 } }, scope: { rung_index: 2 } }),
])] };
const BOARD = { boards: [MX, VD], subjects: [...MX.subjects.map(s => ({ ...s, division_name: 'MX' })), ...VD.subjects.map(s => ({ ...s, division_name: 'VD' }))],
  totals: { subjects: 2, pairs: 3, unassessed: 2, stale: 0 }, stale_days: 365, deny_reason: null };

const REVIEW = { kinds: [{ key: 'spec', label: '설계 스펙 검토' }, { key: 'cause', label: '원인 분석' }], fields: {}, promote_min: 3 };

export default async function run() {
  const { say, done } = suite();
  let picked = null;
  fakeFetch(({ url }) => {
    if (url.includes('/reviews/years')) return [2026];
    if (url.includes('/reviews/stats')) return { year: 2026, divisions: [
      { division_id: 17, kinds: { spec: { count: 4, early: 75, gate: 50, confirmed: 25, lead_median: 4, promote: [{ agent_name: 'x', item: 'y', count: 3 }] }, cause: { count: 2, early: 0, gate: 50, confirmed: 100, lead_median: 6, promote: [] } } },
      { division_id: 18, kinds: { spec: { count: 0, early: null, gate: null, confirmed: null, lead_median: null, promote: [] }, cause: { count: 0, early: null, gate: null, confirmed: null, lead_median: null, promote: [] } } } ] };
    return {};
  });
  try {
    await render(<BoardBody board={BOARD} changes={[]} axes={AXES} filters={{}} onFiltersChange={() => {}} onOpenPair={() => {}} onPickDivision={(id) => { picked = id; }} review={REVIEW} />);
    await settle(60);
    say(html().includes('검토 대장') && html().includes('4') && html().includes('착수 전 이상 75%') && html().includes('정착 후보 1'), '① 맨 아래 검토 대장 블록 — 건수·착수 전 이상·정착 후보');
    say(!!byText('th', 'MX') && !!byText('th', 'VD') && !!byText('td', '정확도'), '① 전체 판은 「요약」으로 열리고 사업부가 열, 축이 행');
    const h = html();
    say(h.includes('80%') && h.includes('값 있음 2/2'), '② 정확도: 평균 80% · 값 있음 2/2');
    say(h.includes('50%') && h.includes('신규 개발 전 모델 이상'), '② 적용 범위: 「신규 개발 전 모델」 이상 50%');
    say(h.includes('1/2') && h.includes('평균 켠 수'), '② 자동화: 평균 켠 수 1/2');
    say(h.includes('시험 재현') && h.includes('유형 4'), '② 모델링: 시험 재현률 · 유형 수');
    say(h.includes('미검증 1'), '② VD 정확도에 「미검증 1」 배지');
    await click(byText('th', 'VD'));
    say(picked === 18, '③ 사업부 머리를 누르면 그 사업부(18)로');
    await click(byText('button', '상세')); await settle();
    say(html().includes('낙하 시험') && html().includes('진동 시험'), '③ 「상세」로 바꾸면 시험 표');
    await unmount();
  } catch (e) {
    say(false, `실패: ${e.stack.split('\n').slice(0, 4).join(' | ')}`);
  }
  return done();
}
