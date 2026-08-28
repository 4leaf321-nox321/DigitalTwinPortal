// 성숙도 — 시뮬레이션 「목록」의 연계 추가 모달을 눌러 본다. (2026-08-28)
//
//   ① 평소엔 잇기 양식이 없고, 상단 「연계 추가」를 누르면 모달
//   ② 시험·시뮬레이션을 고르고 「잇기」 → POST /pairs, 모달 닫힘
import './setup-dom.mjs';   // ⚠️ 반드시 첫 import
import React from 'react';
import { render, click, select, settle, byText, html, fakeFetch, suite, unmount } from './dom-helpers.mjs';
import ListView from '../../src/modules/dev-dt-maturity/components/List/ListView';

const AXES = [{ key: 'accuracy', label: '정확도', kind: 'value', rungs: [{ key: 'trend', label: '경향 일치' }, { key: 'quantitative', label: '원인 분석' }, { key: 'correlated', label: '현상 재현' }] }];

export default async function run() {
  const { say, done } = suite();
  const calls = fakeFetch(({ url, method }) => {
    if (url.includes('/pairs') && method === 'POST') return { id: 77 };
    if (url.includes('/subjects')) return [{ id: 1, name: '낙하 시험', division_id: 17, product_families: [] }];
    if (url.includes('/agents')) return [{ id: 5, name: '구조 해석', division_id: 17, tools: [] }, { id: 6, name: '열 해석', division_id: 17, tools: [] }];
    if (url.includes('/board')) return { subjects: [{ id: 1, name: '낙하 시험', pairs: [{ id: 9, subject_id: 1, agent_id: 5, agent: { name: '구조 해석', tools: [] }, unassessed: [], assessments: {} }] }], totals: {} };
    return {};
  });
  try {
    await render(<ListView divisionId={17} divisions={[{ id: 17, name: 'MX' }]} denyReason={null} axes={AXES} pairId={null}
                           onOpenPair={() => {}} onClosePair={() => {}} onEditSubject={() => {}} onEditAgent={() => {}} onChanged={() => {}} refreshKey={0} />);
    await settle(60);
    say(html().includes('낙하 시험') && !document.querySelector('[role="dialog"]'), '① 표는 보이고 잇기 양식은 안 보임');
    await click(byText('button', '연계 추가')); await settle();
    const dlg = document.querySelector('[role="dialog"][aria-label="연계 추가"]');
    say(!!dlg, '① 「연계 추가」를 누르면 모달');
    const sels = dlg.querySelectorAll('select');
    await select(sels[0], '1'); await settle();
    await select(sels[1], '6'); await settle();
    await click(byText('button', '잇기')); await settle(60);
    const post = calls.find(c => c.method === 'POST' && c.url.endsWith('/pairs'));
    say(!!post && post.body.subject_id === 1 && post.body.agent_id === 6, `② POST /pairs: ${JSON.stringify(post?.body)}`);
    say(!document.querySelector('[role="dialog"]'), '② 이으면 모달이 닫힘');
    await unmount();
  } catch (e) {
    say(false, `실패: ${e.stack.split('\n').slice(0, 4).join(' | ')}`);
  }
  return done();
}
