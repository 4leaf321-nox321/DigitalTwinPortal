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
  let opened = null;
  const calls = fakeFetch(({ url, method }) => {
    if (url.includes('/pairs') && method === 'POST') return { id: 77 };
    if (url.includes('/subjects')) return [{ id: 1, name: '낙하 시험', division_id: 17, product_families: [] }];
    if (url.includes('/agents')) return [{ id: 5, name: '구조 해석', division_id: 17, tools: [] }, { id: 6, name: '열 해석', division_id: 17, tools: [] }];
    if (url.includes('/board')) return { subjects: [{ id: 1, name: '낙하 시험', pairs: [{ id: 9, subject_id: 1, agent_id: 5, agent: { name: '구조 해석', tools: ['LS-DYNA', 'HyperMesh'], department_name: 'CAE그룹(MX)', projects: [{ uuid: 'u1', code: 'MX-1', title: '낙하 해석 자동화' }] }, unassessed: [], assessments: {} }] }], totals: {} };
    return {};
  });
  try {
    await render(<ListView divisionId={17} divisions={[{ id: 17, name: 'MX' }]} denyReason={null} axes={AXES} pairId={null}
                           onOpenPair={(id) => { opened = id; }} onClosePair={() => {}} onEditSubject={() => {}} onEditAgent={() => {}} onChanged={() => {}} refreshKey={0} />);
    await settle(60);
    say(html().includes('낙하 시험') && !document.querySelector('[role="dialog"]'), '① 표는 보이고 잇기 양식은 안 보임');
    // ①-2 열이 다섯 — 시험 · 시뮬레이션 · 사용 툴 · 담당 부서 · 디지털 트윈 연결 과제
    const heads = [...document.querySelectorAll('thead th')].map(x => x.textContent.trim());
    say(JSON.stringify(heads.slice(0, 5)) === JSON.stringify(['시험 항목', '시뮬레이션', '사용 툴', '담당 부서', '디지털 트윈 연결 과제']), `①-2 열 이름: ${heads}`);
    // ①-3 줄 아무 데나 눌러도 사다리가 열린다 — 시뮬레이션 칸만 눌리면 아무도 못 알아챈다
    const row = document.querySelector('tbody tr');
    await click([...row.querySelectorAll('td')].find(x => x.textContent.includes('CAE그룹'))); await settle();
    say(opened === 9, `①-3 담당 부서 칸을 눌러도 사다리가 열림: ${opened}`);
    const tds = [...document.querySelectorAll('tbody tr td')].map(x => x.textContent.trim());
    say(tds.includes('LS-DYNA, HyperMesh'), `①-2 사용 툴이 제 열에: ${tds}`);
    say(tds.includes('낙하 해석 자동화') && !tds.some(x => x.includes('MX-1')), '①-2 과제는 코드가 아니라 이름으로 제 열에');
    // ①-5 이름표는 부문이 정한다 — 모니터링이면 「공정 × 수집 수단」
    await unmount();
    await render(<ListView divisionId={17} divisions={[{ id: 17, name: 'MX' }]} denyReason={null} axes={[]} pairId={null}
                           sector="manufacturing_monitoring" sectorDef={{ key: 'manufacturing_monitoring', subject_label: '공정', agent_label: '수집 수단' }}
                           onOpenPair={() => {}} onClosePair={() => {}} onEditSubject={() => {}} onEditAgent={() => {}} onChanged={() => {}} refreshKey={0} />);
    await settle(60);
    const mheads = [...document.querySelectorAll('thead th')].map(x => x.textContent.trim());
    say(mheads[0] === '공정' && mheads[1] === '수집 수단', `①-5 모니터링 열 이름: ${mheads}`);
    const asked = calls.filter(c => (c.url || '').includes('sector=manufacturing_monitoring'));
    say(asked.length >= 3, `①-5 목록·판을 부문으로 부름(안 그러면 시뮬레이션이 나온다): ${asked.length}건`);
    say(html().includes('공정 × 수집 수단'), '①-5 표 머리도 부문의 말로');
    const badge = [...document.querySelectorAll('td button')].find(x => x.textContent === '낙하 해석 자동화');
    say(!!badge && (badge.getAttribute('title') || '').includes('MX-1'), '①-2 과제는 배지로 — 코드·연도는 마우스를 올렸을 때');
    // ①-4 배지를 누르면 대시보드의 과제 보고를 불러온다(줄의 사다리는 안 열린다)
    opened = null;
    await click(badge); await settle(60);
    const got = calls.find(c => (c.url || '').includes('/dt-v2/projects/u1'));
    say(!!got && opened === null, `①-4 배지 → 과제 보고 부름: ${got?.url} · 사다리는 안 열림(${opened})`);
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
