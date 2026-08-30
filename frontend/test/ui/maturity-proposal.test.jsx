// 성숙도 — 확인 대기 창을 눌러 본다. (2026-08-30)
//
//   ① 무엇을 어떻게 매기자는지와 **지금 값**을 나란히 보여 준다 — 사람이 그걸 보고 판단한다
//   ② 근거가 그대로 보인다 — 이 창의 존재 이유다
//   ③ 승인하면 approve, 거절하면 reject 가 간다
//   ④ 비었으면 「확인할 것이 없습니다」
//   ⑤ 「지난 것」 — 승인·거절·밀려남까지 남는다(감사 기록)
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
  // 남의 사업부 것 — 보이되 못 누른다
  { id: 13, pair_id: 7, division_id: 18, kind: 'assess', axis: 'scope', axis_label: '적용 범위',
    sector: 'simulation', subject_name: 'VD 시험', agent_name: 'VD 해석', division_name: 'VD',
    payload: { rung: 'basic' }, note: 'VD 쪽 근거', now: null, deny_reason: 'VD 사업부 인력만 평가합니다.',
    actor_name: '박용진', created_at: '2026-08-30T10:10:00', status: 'pending' },
];

export default async function run() {
  const { say, done } = suite();
  let rows = [...ROWS];
  const PAST = [
    { id: 8, pair_id: 5, division_id: 17, kind: 'assess', axis: 'scope', axis_label: '적용 범위',
      sector: 'simulation', subject_name: '낙하 시험', agent_name: '낙하 해석',
      payload: { rung: 'basic' }, note: '올린 근거', status: 'approved',
      actor_name: '박용진', decided_by_name: '홍길동', decided_note: null,
      created_at: '2026-08-20T09:00:00', decided_at: '2026-08-20T11:00:00' },
    { id: 9, pair_id: 5, division_id: 17, kind: 'assess', axis: 'scope', axis_label: '적용 범위',
      sector: 'simulation', subject_name: '낙하 시험', agent_name: '낙하 해석',
      payload: { rung: 'issue' }, note: '내린 근거', status: 'rejected',
      actor_name: '박용진', decided_by_name: '홍길동', decided_note: '근거가 약하다',
      created_at: '2026-08-21T09:00:00', decided_at: '2026-08-21T10:00:00' },
    { id: 10, pair_id: 6, division_id: 17, kind: 'assess', axis: 'automation', axis_label: '자동화',
      sector: 'simulation', subject_name: '굽힘 시험', agent_name: '낙하 해석',
      payload: { flags: ['pre'] }, note: '먼저 낸 것', status: 'superseded',
      actor_name: '박용진', decided_by_name: null, decided_note: null,
      created_at: '2026-08-22T09:00:00', decided_at: '2026-08-22T09:30:00' },
  ];
  const calls = fakeFetch(({ url, method }) => {
    if (url.includes('/proposals/11/approve')) { rows = rows.filter(r => r.id !== 11); return { proposal: {}, pair: {} }; }
    if (url.includes('/proposals/12/reject')) { rows = rows.filter(r => r.id !== 12); return { proposal: {}, pair: null }; }
    if (url.includes('status=done')) return PAST;
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

    // ⑥ 남의 사업부 것 — 보이되 단추가 없고, 왜 못 하는지 말해 준다
    say(html().includes('VD 시험') && html().includes('VD 사업부 인력만'),
        '⑥ 남의 사업부 것은 보이되 이유가 붙는다');
    say(!document.querySelector('button[aria-label="VD 시험 적용 범위 승인"]'),
        '⑥ 남의 것에는 승인 단추가 없다');
    say(html().includes('그 사업부에서 승인합니다'), '⑥ 어디서 하라고 알려 준다');

    calls.length = 0;
    await click(document.querySelector('button[aria-label="낙하 시험 적용 범위 승인"]')); await settle();
    const ok = calls.find(c => c.method === 'POST' && c.url.includes('/proposals/11/approve'));
    say(!!ok, `③ 승인은 approve 로: ${ok?.url}`);
    say(!html().includes('낙하 시험'), '③ 승인하면 목록에서 빠진다');

    calls.length = 0;
    await click(document.querySelector('button[aria-label="굽힘 시험 자동화 거절"]')); await settle();
    const no = calls.find(c => c.method === 'POST' && c.url.includes('/proposals/12/reject'));
    say(!!no, `③ 거절은 reject 로: ${no?.url}`);
    say(!html().includes('확인할 것이 없습니다'), '④ 남의 것이 남아 있으면 「없습니다」가 아니다');

    // ⑤ 지난 것 — 감사 기록. 여기서는 아무것도 못 바꾼다.
    await click(byText('button', '지난 것')); await settle();
    say(html().includes('올린 근거') && html().includes('내린 근거'), '⑤ 승인·거절한 것이 다 남는다');
    say(html().includes('승인') && html().includes('거절') && html().includes('밀려남'),
        '⑤ 결말을 딱지로 말해 준다');
    say(html().includes('근거가 약하다'), '⑤ 거절 사유도 남는다');
    say(html().includes('먼저 낸 것'), '⑤ 밀려난 것도 남는다 — 이렇게도 제안했다는 기록');
    say(html().includes('홍길동'), '⑤ 누가 결정했는지');
    say(!byText('button', '승인') && !byText('button', '거절'), '⑤ 지난 것은 못 바꾼다');
    await unmount();
  } catch (e) {
    say(false, `실패: ${e.stack.split('\n').slice(0, 4).join(' | ')}`);
  }
  return done();
}
