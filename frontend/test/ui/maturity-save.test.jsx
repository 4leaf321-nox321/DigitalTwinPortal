// 성숙도 — 저장 흐름을 실제로 눌러 본다. (2026-08-28 「근거를 적어도 저장이 안 된다」 점검에서 시작)
//
//   ① 연계 상세: 칸 누르기 → 근거 적기 → 저장 → PUT 이 가고 사다리가 새 칸을 그린다
//   ② 연계 상세: 근거 칸에서 Enter 로도 저장된다
//   ③ 연계 상세: 정확도 「정확도 기록 추가」 → 값·근거 → value 로 간다(rung 없음)
//   ④ 연계 상세: 서버가 거절하면 그 이유가 저장 단추 옆에 보인다
//   ⑤ 관리 창: 항목 고르기 → 세부 고치기 → 저장
//   ⑥ 관리 창: 담당 부서를 찾아 고르고 저장 → department_id 가 숫자로 간다
//   ⑦ 관리 창: 표의 연필로 열면 그 항목이 골라진 채 열린다(initialId)
import './setup-dom.mjs';   // ⚠️ 반드시 첫 import
import React from 'react';
import { render, click, type, keydown, select, settle, byText, html, fakeFetch, suite, unmount } from './dom-helpers.mjs';
import PairSide from '../../src/modules/dev-dt-maturity/components/Pair/PairSide';
import { PairPanel } from '../../src/modules/dev-dt-maturity/components/Pair/PairModal';
import ItemManagerModal from '../../src/modules/dev-dt-maturity/components/List/ItemManagerModal';

const AXES = [
  { key: 'accuracy', label: '정확도', kind: 'value', question: '맞는가', evidence: ['compared_tests', 'error_pct'],
    rungs: [{ key: 'trend', label: '경향 일치' }, { key: 'quantitative', label: '원인 분석' }, { key: 'correlated', label: '현상 재현' }] },
  { key: 'modeling', label: '모델링 수준', kind: 'matrix', question: '어느 불량까지', evidence: ['phenomena', 'defects'], hide_empty: true,
    base: [{ key: 'geometry', label: '형상 재현' }, { key: 'performance', label: '거동 재현' }],
    columns: [{ key: 'test', label: '신뢰성 시험 불량 재현' }, { key: 'market', label: '시장 불량 재현' }],
    rungs: [{ key: 'none', label: '없음' }, { key: 'geometry', label: '형상 재현' }, { key: 'performance', label: '거동 재현' }, { key: 'test_some', label: '일부 불량 시험 재현' }, { key: 'test_all', label: '전 유형 시험 재현' }, { key: 'market', label: '시장 불량까지' }] },
  { key: 'automation', label: '자동화', kind: 'set', question: '돌아가는가', evidence: ['hours_per_run'],
    rungs: [{ key: 'manual', label: '수동' }, { key: 'pre', label: '전처리 자동' }, { key: 'run', label: '실행 자동' }, { key: 'post', label: '후처리 자동' }] },
  { key: 'scope', label: '적용 범위', kind: 'rung', question: '어디까지', evidence: [],
    rungs: [{ key: 'issue', label: '이슈 모델' }, { key: 'basic', label: '기본 모델' }, { key: 'all', label: '전 제품군' }] },
];
const PAIR = {
  id: 101, subject_id: 1, agent_id: 10, subject: { name: '낙하 시험', product_families: [] }, agent: { name: '구조 해석', tools: [], defect_types: ['크랙', '변색'] },
  assessments: {
    automation: { rung: 'pre', flags: ['pre'], rung_index: 1, stale: false, note: '스크립트', evidence: {}, assessed_at: '2026-01-01T00:00:00', assessed_by_name: '홍' },
    scope: { rung: 'basic', rung_index: 1, stale: false, note: '기본만', evidence: {}, assessed_at: '2026-01-01T00:00:00', assessed_by_name: '홍' },
  },
  unassessed: ['accuracy'], changes: [], deny_reason: null, phenomena: [],
};

export default async function run() {
  const { say, done } = suite();
  let refuse = null;   // 서버 거절을 흉내낼 때
  let lastAssess = null;   // 마지막으로 서버에 간 평가 꾸러미
  const calls = fakeFetch(({ url, method, body }) => {
    if (url.includes('/projects?')) return [
      { uuid: 'u1', code: 'MX-1', title: '낙하 해석 자동화', status: '진행', year: 2026, division: 'MX', division_id: 17, process: '설계', pl_name: '김해석' },
      { uuid: 'u2', code: 'MX-2', title: '열 해석 정확도', status: '완료', year: 2025, division: 'MX', division_id: 17, process: '검증', pl_name: '박시험' },
      { uuid: 'u3', code: 'VD-9', title: '패널 해석 표준화', status: '진행', year: 2026, division: 'VD', division_id: 18, process: '설계', pl_name: '이구조' },
    ];
    if (url.includes('/pairs/101/assessments/')) {
      if (refuse) { const e = new Error(refuse); throw e; }
      lastAssess = body;
      const axis = url.split('/assessments/')[1];
      const a = AXES.find(x => x.key === axis);
      let idx, rung, flags;
      if (a.kind === 'value') { idx = body.value >= 90 ? 2 : body.value >= 70 ? 1 : 0; rung = a.rungs[idx].key; }
      else if (a.kind === 'set') { flags = a.rungs.slice(1).map(r => r.key).filter(k => body.flags.includes(k)); idx = flags.length; rung = flags.join(',') || 'manual'; }
      else if (a.kind === 'matrix') { flags = a.base.map(r => r.key).filter(k => body.flags.includes(k)); idx = flags.length; rung = a.rungs[idx].key; }
      else { idx = a.rungs.findIndex(r => r.key === body.rung); rung = body.rung; }
      return { ...PAIR,
        assessments: { ...PAIR.assessments, [axis]: { rung, flags, rung_index: idx, value: body.value ?? null, note: body.note, evidence: body.evidence || {}, assessed_at: '2026-08-28T00:00:00', assessed_by_name: '나', stale: false } },
        unassessed: [], changes: [{ id: 9, axis, before: 'pre', after: a.kind === 'value' ? String(body.value) : rung, created_at: `${body.assessed_at || '2026-08'}-28T00:00:00`, actor_name: '나', note: body.note }] };
    }
    if (url.includes('/reached/')) {
      const [, axis, rung] = url.split('/reached/')[1].match(/^(\w+)\/(\w+)$/);
      return { ...PAIR, changes: [{ id: 21, axis, before: null, after: rung, created_at: `${body.month}-01T12:00:00`, actor_name: '나', note: '시점 적기' }] };
    }
    if (url.includes('/defects/')) {
      const on = body.month ? { [body.name]: { [body.col]: `${body.month}-01` } } : {};
      const lv = body.month ? 3 : 0;
      return { ...PAIR, assessments: { ...PAIR.assessments, modeling: { rung: lv ? 'test_some' : 'none', flags: [], defects: on, summary: { test: lv ? 1 : 0, market: 0, total: 2 }, rung_index: lv, stale: false, note: '', evidence: { defects: on }, assessed_at: '2026-08-28T00:00:00', assessed_by_name: '나' } } };
    }
    if (method === 'DELETE' && url.includes('/changes/')) return PAIR;
    if (url.endsWith('/pairs/101')) return PAIR;
    if (/\/(subjects|agents)\/\d+$/.test(url)) return { id: Number(url.split('/').pop()), ...body };
    return {};
  });

  try {
    // ① 칸 → 근거 → 저장
    await render(<PairSide pairId={101} axes={AXES} onChanged={() => {}} onClose={() => {}} />);
    say(html().includes('낙하 시험 × 구조 해석'), '① 연계이 불러와짐');
    say(!html().includes('아직 바뀐 것이 없습니다') && !!document.querySelector('[aria-label="이력"]'), '⓪ 이력은 접혀 있고 머리에 단추만');
    await click(document.querySelector('[aria-label="이력"]'));
    say(html().includes('아직 바뀐 것이 없습니다'), '⓪ 단추를 누르면 이력 판이 열림');
    await click(document.querySelector('[aria-label="이력"]'));
    await click(byText('[role="button"]', '실행 자동'));
    const note = document.querySelector('input[placeholder^="근거"]');
    say(!!note, '① 칸을 누르면 근거 칸이 열림');
    say(note.value === '스크립트', '① 편집 칸에 기존 근거가 채워져 있음');
    say(html().includes('전처리 자동 · 실행 자동'), '① 묶음: 실행 자동을 선택하면 전처리에 더해진다(선후 없음)');
    await click(byText('[role="button"]', '✓ 전처리 자동')); await settle();
    say(html().includes('→ <strong>실행 자동</strong>'), '① 묶음: 선택한 것을 다시 누르면 꺼진다');
    await click(byText('[role="button"]', '전처리 자동')); await settle();
    await type(note, '');
    say(byText('button', '저장').disabled && html().includes('근거를 적어야 저장됩니다'), '① 근거를 지우면 저장이 잠기고 이유가 옆에 보임');
    await type(note, '템플릿 도입');
    say(!byText('button', '저장').disabled, '① 근거를 적으면 저장이 선택됨');
    await click(byText('button', '저장')); await settle();
    const put = calls.find(c => c.method === 'PUT' && c.url.includes('/assessments/automation'));
    say(!!put && JSON.stringify(put.body.flags) === '["pre","run"]' && put.body.note === '템플릿 도입', `① PUT 이 flags 로 감: ${JSON.stringify(put?.body)}`);
    say(put?.body.assessed_at === undefined, '① 묶음 축은 시점을 같이 보내지 않음(칸 밑에서 따로 고침)');
    say(!document.querySelector('input[placeholder^="근거"]'), '① 저장 뒤 편집 칸이 닫힘');
    say(html().includes('템플릿 도입') && html().includes('2026-08') && !html().includes('2026-08-28'), '① 사다리가 새 묶음·근거·시점(연-월)을 그림');

    // ② 수동을 누르면 전부 꺼지고, Enter 로 저장
    calls.length = 0;
    await click(byText('[role="button"]', '수동'));
    say(html().includes('→ <strong>수동</strong>'), '② 「수동」을 누르면 전부 꺼짐');
    await type(document.querySelector('input[placeholder^="근거"]'), '되돌림');
    await keydown(document.querySelector('input[placeholder^="근거"]'), 'Enter'); await settle();
    say(calls.some(c => c.method === 'PUT' && Array.isArray(c.body?.flags) && c.body.flags.length === 0), '② 근거 칸에서 Enter 로 저장됨(빈 묶음)');

    // ②-2 칸의 도달 시점을 그 자리에서 — 적용 범위(칸 축)에서 이력 없는 도달 칸(첫 것: issue) 밑 「시점 적기」
    calls.length = 0;
    await click(byText('span', '시점 적기'));
    const monthIn = document.querySelector('input[type="month"]');
    say(!!monthIn, '②-2 칸 밑의 시점을 누르면 월 고르기가 열림');
    await type(monthIn, '2024-09');
    await keydown(monthIn, 'Enter'); await settle();
    const reachedCall = calls.find(c => c.url.includes('/reached/scope/issue'));
    say(!!reachedCall && reachedCall.body.month === '2024-09', `②-2 PUT reached 가 감: ${JSON.stringify(reachedCall?.body)}`);
    say(html().includes('2024-09'), '②-2 사다리가 그 달을 그림');

    // ②-3 모델링 수준 — 표의 칸은 근거 없이 바로 저장, 바탕은 근거와 함께
    calls.length = 0;
    say(html().includes('크랙') && html().includes('변색') && !!document.querySelector('button[aria-label="크랙 신뢰성 시험 불량 재현"]'), '②-3 시뮬레이션의 불량 유형이 표의 행으로 보임');
    await click(document.querySelector('button[aria-label="크랙 신뢰성 시험 불량 재현"]')); await settle();
    const cellPut = calls.find(c => c.method === 'PUT' && c.url.includes('/defects/modeling'));
    say(!!cellPut && cellPut.body.name === '크랙' && cellPut.body.col === 'test' && /^\d{4}-\d{2}$/.test(cellPut.body.month), `②-3 칸을 누르면 근거 없이 PUT defects 가 감: ${JSON.stringify(cellPut?.body)}`);
    say(!document.querySelector('input[placeholder^="근거"]'), '②-3 표의 칸은 근거 상자를 열지 않음');
    say(document.querySelector('button[aria-label="크랙 신뢰성 시험 불량 재현"]').getAttribute('aria-pressed') === 'true' && html().includes('시험 1/2'), '②-3 선택된 칸과 「시험 1/2」 요약');
    await click(document.querySelector('button[aria-label="크랙 신뢰성 시험 불량 재현"]')); await settle();
    const offPut = calls.filter(c => c.url.includes('/defects/modeling')).pop();
    say(offPut?.body.month === null, '②-3 다시 누르면 끔(month null)');
    calls.length = 0;
    await click(byText('[role="button"]', '거동 재현'));
    say(!!document.querySelector('input[placeholder^="근거"]'), '②-3 바탕(거동 재현)을 누르면 근거 상자가 열림');
    await type(document.querySelector('input[placeholder^="근거"]'), '낙하 3건 비교');
    await click(byText('button', '저장')); await settle();
    const putM = calls.find(c => c.method === 'PUT' && c.url.includes('/assessments/modeling'));
    say(!!putM && JSON.stringify(putM.body.flags) === '["performance"]', `②-3 바탕은 flags 로 감: ${JSON.stringify(putM?.body?.flags)}`);

    // ③ 정확도 값
    calls.length = 0;
    await click(byText('button', '정확도 기록 추가'));
    const num = document.querySelector('input[type="number"]');
    say(!!num && html().includes('값을 적어야 저장됩니다') === false, '③ 값 칸이 열림');
    await type(num, '91');
    await type(document.querySelector('input[placeholder^="근거"]'), '12건 비교');
    await click(byText('button', '저장')); await settle();
    const put3 = calls.find(c => c.method === 'PUT' && c.url.includes('/assessments/accuracy'));
    say(!!put3 && put3.body.value === 91 && !('rung' in put3.body), `③ value 로 감: ${JSON.stringify(put3?.body)}`);
    say(html().includes('91%') && html().includes('현상 재현'), '③ 값이 막대의 영역(현상 재현)으로 그려짐');
    say(!!document.querySelector('[aria-label="정확도 기록 지우기"]') && html().includes('12건 비교'), '③ 정확도가 줄로 붙어 보임');
    window.confirm = () => true;
    await click(document.querySelector('[aria-label="정확도 기록 지우기"]')); await settle();
    say(calls.some(c => c.method === 'DELETE' && c.url.includes('/changes/9')), '③ 줄의 휴지통이 DELETE 를 보냄');

    // ④ 서버 거절 — 이유가 단추 옆에 (칸 축으로)
    refuse = 'VD 사업부 인력만 평가합니다.';
    await click(byText('[role="button"]', '전 제품군'));
    await type(document.querySelector('input[placeholder^="근거"]'), 'x');
    await click(byText('button', '저장')); await settle();
    const editor = document.querySelector('input[placeholder^="근거"]');
    say(!!editor && html().includes('VD 사업부 인력만 평가합니다'), '④ 거절 이유가 편집 칸 옆에 보이고 칸은 열린 채');
    refuse = null;
    await unmount();

    // ⑤ 관리 창 — 세부 고치고 저장
    calls.length = 0;
    const DIVS = [{ id: 17, name: 'MX', deny_reason: null }];
    await render(<ItemManagerModal kind="subject" divisionId={17} divisions={DIVS} items={[{ id: 1, name: '낙하 시험', division_id: 17, detail: '', product_families: [] }]} pairCount={{}} canEdit denyReason={null} modelKinds={[]} onClose={() => {}} onChanged={() => {}} />);
    await click(byText('button', '낙하 시험'));
    const detail = document.querySelector('input[placeholder^="예: 1.2m"]');
    say(!!detail && byText('button', '저장').disabled, '⑤ 항목을 고르면 상세가 열리고 안 고치면 저장 잠김');
    await type(detail, '1.2m');
    await click(byText('button', '저장')); await settle();
    const put5 = calls.find(c => c.method === 'PUT' && c.url.includes('/subjects/1'));
    say(!!put5 && put5.body.detail === '1.2m', `⑤ PUT 이 감: ${JSON.stringify(put5?.body)}`);
    await unmount();

    // ⑥ 담당 부서 — 찾아서 고르기
    calls.length = 0;
    await render(<ItemManagerModal kind="agent" divisionId={17} divisions={DIVS} items={[{ id: 5, name: '구조 해석', division_id: 17, kind: '', model_kind: '', tools: [], department_id: null }]} pairCount={{}} canEdit denyReason={null} modelKinds={[]} departments={{ 17: [{ id: 3, name: 'CAE그룹(MX)' }, { id: 4, name: 'Mecha그룹(MX)' }] }} onClose={() => {}} onChanged={() => {}} />);
    await click(byText('button', '구조 해석'));
    const dep = document.querySelector('input[data-search-select]');
    say(!!dep, '⑥ 담당 부서는 검색되는 고르기');
    await type(dep, 'CAE'); await settle();
    const opt = byText('li', 'CAE그룹(MX)');
    say(!!opt && !byText('li', 'Mecha그룹(MX)'), '⑥ 글자를 치면 좁혀짐');
    await click(opt); await settle();
    // ⑥-2 불량 유형 — 도구처럼 칩으로 하나씩
    const defIn = document.querySelector('input[aria-label="불량 유형 추가"]');
    say(!!defIn, '⑥-2 불량 유형 칸이 있음');
    await type(defIn, '크랙'); await keydown(defIn, 'Enter'); await settle();
    say(html().includes('크랙') && defIn.value === '', '⑥-2 Enter 로 칩이 붙고 칸이 비워짐');
    // ⑥-3 수행 디지털 트윈 과제 — 대시보드 과제를 여럿 매단다
    const projIn = [...document.querySelectorAll('input[data-search-select]')].find(x => (x.placeholder || '').includes('최근 과제'));
    say(!!projIn, '⑥-3 과제 드롭다운이 있음');
    await type(projIn, '해석'); await settle();
    say(byText('li', 'MX-1 · 낙하 해석 자동화 (2026)') != null && byText('li', 'VD-9 · 패널 해석 표준화 (2026)') == null,
        '⑥-3 드롭다운은 후보 둘까지만');
    await click(byText('li', 'MX-1 · 낙하 해석 자동화 (2026)')); await settle();
    // 「상세」 창 — 사업부·프로세스로 좁혀 여럿 고르기
    await click(byText('button', '상세')); await settle(60);
    const dlg = document.querySelector('[aria-label="과제 고르기"]');
    say(!!dlg, '⑥-3 상세 창이 열림');
    say(dlg.innerHTML.includes('패널 해석 표준화'), '⑥-3 다른 사업부 과제까지 보임');
    const proc = dlg.querySelector('select[aria-label="프로세스"]');
    await select(proc, '검증'); await settle();
    say(!dlg.innerHTML.includes('패널 해석 표준화') && dlg.innerHTML.includes('열 해석 정확도'), '⑥-3 프로세스로 좁혀짐');
    say(dlg.innerHTML.includes('매달림') === false, '⑥-3 아직 매달린 과제는 이 목록에 없음');
    await click([...dlg.querySelectorAll('tbody tr')][0]); await settle();
    await click(byText('button', '고른 1건 매달기')); await settle(60);
    say(html().includes('낙하 해석 자동화') && html().includes('열 해석 정확도'), '⑥-3 둘 다 칩으로 붙음');
    say(!byText('button', '저장').disabled, '⑥ 고르면 저장이 선택됨');
    await click(byText('button', '저장')); await settle();
    const put6 = calls.find(c => c.method === 'PUT' && c.url.includes('/agents/5'));
    say(JSON.stringify(put6?.body?.defect_types) === '["크랙"]', `⑥-2 PUT 에 defect_types 가 감: ${JSON.stringify(put6?.body?.defect_types)}`);
    say(!!put6 && put6.body.department_id === 3, `⑥ department_id 가 숫자로 감: ${JSON.stringify(put6?.body)}`);
    say(JSON.stringify(put6?.body?.project_uuids) === '["u1","u2"]', `⑥-3 PUT 에 project_uuids 가 감: ${JSON.stringify(put6?.body?.project_uuids)}`);
    await unmount();

    // ⑦-2 덮어쓰기 알림 — 저장에 「내가 띄운 그 축의 평가 시각」이 함께 간다(같은 축을 남이 먼저 고쳤는지 서버가 본다)
    say(lastAssess && 'base_assessed_at' in lastAssess,
        `⑦-2 저장에 base_assessed_at 이 실려 감: ${JSON.stringify(lastAssess && lastAssess.base_assessed_at)}`);

    // ⑧ 모판에서 기준 시점을 켠 채 들어오면 — 그 뒤 변경이 있었던 축을 짚어 준다
    const HOT = { ...PAIR, changes: [
      { id: 1, axis: 'automation', before: 'manual', after: 'pre', created_at: '2026-08-20T00:00:00', actor_name: '나', note: '스크립트' },
      { id: 2, axis: 'scope', before: 'issue', after: 'basic', created_at: '2026-05-02T00:00:00', actor_name: '홍', note: '넓힘' },
      { id: 3, axis: 'accuracy', before: null, after: 'trend', created_at: '2026-08-25T00:00:00', actor_name: '나', note: '시점 적기' },
    ] };
    await render(<PairPanel pair={HOT} pairId={101} axes={AXES} since="2026-08-01" onClose={() => {}} onSaved={() => {}} />);
    await settle();
    say(html().includes('2026-08-01') && html().includes('이후 변경 사항'), '⑧ 창 위에 기준 시점 줄');
    say(html().includes('1건'), '⑧ 변경이 있었던 축의 수');
    say(html().includes('변경 사항 발생'), '⑧ 변경이 있었던 축에 「변경 사항 발생」 표');
    const hotCount = (html().match(/변경 사항 발생/g) || []).length;
    say(hotCount === 1, `⑧ 자동화만 짚는다(적용 범위는 그 전, 정확도는 「시점 적기」뿐): ${hotCount}`);
    await unmount();
    // 날짜 기준 없이 열면 아무 표시도 없다
    await render(<PairPanel pair={HOT} pairId={101} axes={AXES} onClose={() => {}} onSaved={() => {}} />);
    await settle();
    say(!html().includes('변경 사항 발생') && !html().includes('이후 변경 사항'), '⑧ 기준 시점 없이 열면 표시가 없다');
    await unmount();

    // ⑦ initialId — 표의 연필로 연 것처럼
    await render(<ItemManagerModal kind="subject" divisionId={17} divisions={DIVS} initialId={2}
                   items={[{ id: 1, name: '낙하 시험', division_id: 17, detail: '', product_families: [] }, { id: 2, name: '굽힘 시험', division_id: 17, detail: '3점', product_families: [] }]}
                   pairCount={{}} canEdit denyReason={null} modelKinds={[]} onClose={() => {}} onChanged={() => {}} />);
    await settle();
    const opened = document.querySelector('input[placeholder^="예: 1.2m"]');
    say(!!opened && opened.value === '3점', '⑦ 연필로 열면 그 항목(굽힘 시험)이 골라진 채 상세가 열림');
    await unmount();
  } catch (e) {
    say(false, `실패: ${e.stack.split('\n').slice(0, 4).join(' | ')}`);
  }
  return done();
}
