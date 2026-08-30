// 성숙도 — 확인 대기 창을 눌러 본다. (2026-08-30)
//
//   ① 무엇을 어떻게 매기자는지와 **지금 값**을 나란히 보여 준다 — 사람이 그걸 보고 판단한다
//   ② 근거가 그대로 보인다 — 이 창의 존재 이유다
//   ③ 승인하면 approve, 거절하면 reject 가 간다
//   ④ 비었으면 「확인할 것이 없습니다」
import './setup-dom.mjs';   // ⚠️ 반드시 첫 import
import React from 'react';
import { render, click, settle, byText, html, fakeFetch, suite, unmount } from './dom-helpers.mjs';
import ProposalModal from '../../src/modules/dev-dt-maturity/components/Proposal/ProposalModal';

const AXES = {
  simulation: [
    { key: 'scope', label: '적용 범위', kind: 'rung',
      rungs: [{ key: 'issue', label: '이슈 대응' }, { key: 'basic', label: '대표 모델' }] },
    { key: 'automation', label: '자동화', kind: 'set',
      rungs: [{ key: 'manual', label: '수동' }, { key: 'pre', label: '전처리 자동' }] },
  ],
};
const ROWS = [
  { id: 11, pair_id: 5, division_id: 17, kind: 'assess', axis: 'scope', axis_label: '적용 범위',
    sector: 'simulation', subject_name: '낙하 시험', agent_name: '낙하 해석',
    payload: { rung: 'basic' }, note: '2026 상반기 대표 모델 개발에서 돌렸다',
    now: { rung: 'issue' }, actor_name: '박용진', created_at: '2026-08-30T10:00:00', status: 'pending' },
  { id: 12, pair_id: 6, division_id: 17, kind: 'assess', axis: 'automation', axis_label: '자동화',
    sector: 'simulation', subject_name: '굽힘 시험', agent_name: '낙하 해석',
    payload: { flags: ['pre'] }, note: '메시만 템플릿', now: null,
    actor_name: '박용진', created_at: '2026-08-30T10:05:00', status: 'pending' },
];

export default async function run() {
  const { say, done } = suite();
  let rows = [...ROWS];
  const calls = fakeFetch(({ url, method }) => {
    if (url.includes('/proposals/11/approve')) { rows = rows.filter(r => r.id !== 11); return { proposal: {}, pair: {} }; }
    if (url.includes('/proposals/12/reject')) { rows = rows.filter(r => r.id !== 12); return { proposal: {}, pair: null }; }
    if (url.includes('/proposals')) return rows;
    return {};
  });

  try {
    await render(<ProposalModal divisionId={17} axesBySector={AXES} onClose={() => {}} onChanged={() => {}} />);
    await settle();

    say(html().includes('아직 판에 안 올랐습니다'), '① 아직 반영 안 됐다고 먼저 말한다');
    say(html().includes('낙하 시험 × 낙하 해석') && html().includes('적용 범위'), '① 어디의 무슨 축인지');
    say(html().includes('이슈 대응') && html().includes('대표 모델'), '① 지금 값 → 제안을 나란히');
    say(html().includes('아직 안 매김'), '① 처음 매기는 것은 「아직 안 매김」');
    say(html().includes('2026 상반기 대표 모델 개발에서 돌렸다'), '② 근거가 그대로 보인다');
    say(html().includes('전처리 자동'), '② 묶음 축은 항목 이름으로 풀어서');

    calls.length = 0;
    await click(document.querySelector('button[aria-label="낙하 시험 적용 범위 승인"]')); await settle();
    const ok = calls.find(c => c.method === 'POST' && c.url.includes('/proposals/11/approve'));
    say(!!ok, `③ 승인은 approve 로: ${ok?.url}`);
    say(!html().includes('낙하 시험'), '③ 승인하면 목록에서 빠진다');

    calls.length = 0;
    await click(document.querySelector('button[aria-label="굽힘 시험 자동화 거절"]')); await settle();
    const no = calls.find(c => c.method === 'POST' && c.url.includes('/proposals/12/reject'));
    say(!!no, `③ 거절은 reject 로: ${no?.url}`);
    say(html().includes('확인할 것이 없습니다'), '④ 비면 그렇게 말한다');
    await unmount();
  } catch (e) {
    say(false, `실패: ${e.stack.split('\n').slice(0, 4).join(' | ')}`);
  }
  return done();
}
