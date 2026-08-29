// 성숙도 — 전체 「요약」의 사업부 × 축 표를 실제로 그려 본다. (2026-08-28)
//
//   ① 전체 판이면 「요약」이 기본이고 가로가 사업부, 세로가 축이다
//   ② 축마다 다른 대표 수치 — 정확도 평균 · 적용 범위 「이상 %」 · 자동화 적용 단계 수 (평균) · 모델링 시험 재현률
//   ③ 사업부 머리를 누르면 그 사업부로 내려간다 · 「상세」로 바꾸면 시험 표가 나온다
import './setup-dom.mjs';   // ⚠️ 반드시 첫 import
import React from 'react';
import { render, click, type, settle, byText, html, fakeFetch, suite, unmount } from './dom-helpers.mjs';
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
    say(html().includes('해석 활용 기록') && html().includes('4') && html().includes('스펙 확정 전 이상 75%') && html().includes('정착 후보 1'), '① 맨 아래 해석 활용 기록 블록 — 건수·스펙 확정 전 이상·정착 후보');
    say(!!byText('th', 'MX') && !!byText('th', 'VD') && !!byText('td', '정확도'), '① 전체 판은 「요약」으로 열리고 사업부가 열, 축이 행');
    say(!!byText('th', '전체') && html().includes('평가 완료 2/3'), '① 맨 오른쪽 「전체」 열 — 사업부를 합쳐 다시 센 것(정확도 평가 완료 2/3)');
    await click(byText('button', '1주 전')); await settle();
    say(html().includes('대비 증감') && (html().includes('Δ —') || html().includes('Δ 0') || html().includes('▲') || html().includes('▼')), '① 기준 시점을 고르면 대표 수치마다 증감');
    await click(byText('button', '1주 전')); await settle();
    say(!html().includes('대비 증감'), '① 기준 시점을 풀면 증감이 사라짐');
    say(document.querySelector('[data-notes="on"]') && document.querySelector('.ov-note'), '① 코멘트 보기 기본 켜짐(작은 글줄 있음)');
    await click(byText('button', '코멘트 보기')); await settle();
    say(document.querySelector('[data-notes="off"]'), '① 코멘트를 끄면 숨김 상태로 감');
    await click(byText('button', '코멘트 보기')); await settle();
    say(document.querySelector('[data-notes="on"]'), '① 다시 켜면 보임');
    const h = html();
    say(h.includes('80%') && h.includes('평가 완료 2/2'), '② 정확도: 평균 80% · 평가 완료 2/2');
    say(h.includes('50%') && h.includes('신규 개발 전 모델 이상'), '② 적용 범위: 「신규 개발 전 모델」 이상 50%');
    say(h.includes('1/2') && h.includes('적용 단계 수 (평균)'), '② 자동화: 적용 단계 수 (평균) 1/2');
    say(h.includes('시험 불량 재현') && h.includes('불량 유형 4'), '② 모델링: 시험 불량 재현률 · 불량 유형 수');
    say(h.includes('미평가 1'), '② VD 정확도에 「미평가 1」 배지');
    await click(byText('th', 'VD'));
    say(picked === 18, '③ 사업부 머리를 누르면 그 사업부(18)로');
    // ⑥ 모판 — 연계가 네모, 축을 바꾸면 색 기준이 바뀜, 부서로 묶임
    await click(byText('button', '모판')); await settle();
    const h6 = html();
    say(h6.includes('색의 기준') && h6.includes('부서 미지정') && document.querySelectorAll('button[title*="—"]').length >= 2, '⑥ 모판 — 부서 묶음과 네모들');
    say(h6.includes('80%') || h6.includes('90%'), '⑥ 정확도 축이면 네모에 % 배지');
    await click(byText('button', '지난 분기 마감')); await settle();
    say(html().includes('변경 사항 발생'), '⑥ 모판의 기준 시점 — 범례에 「변경 사항 발생」이 붙음');
    // ⑥-2 그 상태로 액자를 누르면 — 날짜 기준이 창까지 따라간다
    await click(byText('button', '지난 분기 마감')); await settle();
    say(!html().includes('변경 사항 발생'), '⑥ 기준 시점을 풀면 표시가 사라짐');
    await click(byText('button', '자동화')); await settle();
    say(html().includes('2/2') || html().includes('1/2'), '⑥ 축을 자동화로 바꾸면 배지가 켠 수로');
    await click(document.querySelector('[aria-label$="펼치기"]')); await settle();   // 전체 모드라 「MX · 부서 미지정」 — 끝맺음으로 찾는다
    say(!!byText('button', '← 전체') && html().includes('부서 미지정'), '⑥ 묶음 이름표를 누르면 드릴다운, 「← 전체」가 생김');
    await click(byText('button', '← 전체')); await settle();
    say(!byText('button', '← 전체'), '⑥ 「← 전체」로 벽 전체로 돌아옴');
    await click(byText('button', '상세')); await settle();
    say(html().includes('낙하 시험') && html().includes('진동 시험') && byText('td', '낙하 시험')?.getAttribute('rowspan') === '2', '③ 「상세」— 시험 항목은 셀을 합치고(rowspan 2) 한 줄에 시뮬레이션 하나');
    const h3 = html();
    say(h3.includes('>전처리<') && h3.includes('>실행<') && h3.includes('시험 2/2') && h3.includes('>형상 재현<'), '③ 상세의 묶음·표 축은 선택한 것들이 배지로 늘어섬(전처리·실행 · 형상 재현 · 시험 2/2)');
    say(h3.includes('>파생까지<') && h3.includes('>이슈 대응<') && h3.includes('담당 그룹'), '③ 택1 축은 선택지 전부가 늘어서고 고른 칸만 채움 · 담당 그룹 열');
    await unmount();

    // ④ 사업부 하나의 「요약」 — 축마다 판, 앞선·취약 연계
    const ONE = { ...MX, subjects: MX.subjects, totals: { subjects: 1, pairs: 2, unassessed: 1, stale: 0 }, stale_days: 365, deny_reason: null };
    let opened = null;
    await render(<BoardBody board={ONE} changes={[]} axes={AXES} filters={{}} onFiltersChange={() => {}} onOpenPair={(id) => { opened = id; }} onPickDivision={() => {}} review={REVIEW} />);
    await settle();
    await click(byText('button', '요약')); await settle();
    const h4 = html();
    say(h4.includes('앞선 연계') && h4.includes('취약 연계') && h4.includes('평균 정확도'), '④ 사업부 요약은 축마다 판 + 앞선·취약 연계');
    say(h4.includes('낙하 시험 × 해석') && h4.includes('미평가'), '④ 취약 연계에 미평가 연계가 오름');
    await click(byText('b', '낙하 시험 × 해석').closest('button'));
    say(opened != null, '④ 연계를 누르면 상세가 열림');
    // ⑤ 「변화」 — 축마다 그래프 하나, 표 없음
    await click(byText('button', '변화')); await settle();
    const h5 = html();
    say(['정확도', '자동화', '모델링 수준', '적용 범위', '해석 활용 기록'].every(l => !!document.querySelector(`section[aria-label="${l}"]`)) && h5.includes('12개월') && h5.includes('24개월'), '⑤ 변화는 축마다 그래프 판 + 해석 활용 기록 막대 + 기간 12/24개월');
    say(!h5.includes('<table'), '⑤ 표는 없다');
    await click(byText('button', '기간 설정')); await settle();
    const fromIn = document.querySelector('input[aria-label="시작 연-월"]');
    say(!!fromIn && !!document.querySelector('input[aria-label="끝 연-월"]'), '⑤ 「기간 설정」을 누르면 시작·끝 연-월');
    await type(fromIn, '2026-03'); await type(document.querySelector('input[aria-label="끝 연-월"]'), '2026-05'); await settle();
    say(html().includes('3달'), '⑤ 두 연-월 사이(3달)로 그린다');
    await click(document.querySelector('section[aria-label="자동화"] button[aria-pressed]')); await settle();
    // ⑤ 칸 축(자동화)은 선이 아니라 히트맵 — 값이 정수 몇 개뿐이라 선은 겹쳐 못 읽는다
    say(!!document.querySelector('[aria-label="자동화 범례"]') && html().includes('자동화 — 연계마다 한 줄 · 색이 칸'),
        '⑤ 칸 축의 「상세」는 히트맵 — 연계마다 한 줄, 색이 칸');
    say(!!document.querySelector('[aria-label="달마다 칸 분포"]'), '⑤ 위에 분포 띠');
    const side = document.querySelector('[aria-label="상세"]');
    const heads = [...side.querySelectorAll('thead th')].map(x => x.textContent.trim());
    say(heads[0].startsWith('연계') && heads.length === 4, `⑤ 가로가 달, 세로가 연계인 표: ${heads}`);
    say(side.innerHTML.includes('이력이 있는 연계가 없습니다'), '⑤ 그 기간에 이력이 없으면 그렇게 말한다');
    await unmount();
  } catch (e) {
    say(false, `실패: ${e.stack.split('\n').slice(0, 4).join(' | ')}`);
  }
  return done();
}
