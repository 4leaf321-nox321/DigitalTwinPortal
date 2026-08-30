// 성숙도 — 시뮬레이션 「목록」의 연계 추가 모달을 눌러 본다. (2026-08-28)
//
//   ① 평소엔 잇기 양식이 없고, 상단 「연계 추가」를 누르면 모달
//   ② 시험·시뮬레이션을 고르고 「잇기」 → POST /pairs, 모달 닫힘
import './setup-dom.mjs';   // ⚠️ 반드시 첫 import
import React from 'react';
import { render, click, select, type, paste, settle, byText, html, fakeFetch, suite, unmount } from './dom-helpers.mjs';
import ListView from '../../src/modules/dev-dt-maturity/components/List/ListView';
import BulkInputModal from '../../src/modules/dev-dt-maturity/components/List/BulkInputModal';

const AXES = [{ key: 'accuracy', label: '정확도', kind: 'value', rungs: [{ key: 'trend', label: '경향 일치' }, { key: 'quantitative', label: '원인 분석' }, { key: 'correlated', label: '현상 재현' }] }];

export default async function run() {
  const { say, done } = suite();
  let opened = null;
  const calls = fakeFetch(({ url, method, body }) => {
    if (url.includes('/pairs') && method === 'POST') return { id: 77 };
    if (url.includes('/bulk/kinds')) return [
      { key: 'subject', label: '시험 항목', columns: ['사업부', '시험 항목', '세부', '제품군'], required: ['시험 항목'],
        hint: '제품군은 · 로 나눠 적습니다.', choices: { 사업부: ['MX', 'VD'] } },
      { key: 'agent', label: '시뮬레이션', columns: ['사업부', '시뮬레이션', '종류'], required: ['시뮬레이션'], hint: '' },
    ];
    if (url.includes('/bulk/rows')) return {
      columns: ['사업부', '시험 항목', '세부', '제품군'],
      rows: [['MX', '낙하 시험', '1.2m', 'S 시리즈'], ['MX', '굽힘 시험', '', '']],
    };
    if ((url || '').endsWith('/bulk') && method === 'POST') {
      // 고치기를 켜면 **무엇이 무엇으로** 바뀌는지 함께 온다
      if (body.mode === 'update') return {
        kind: body.kind, mode: 'update',
        summary: { rows: 2, new: 0, exists: 1, updated: 1, errors: 0 },
        rows: [
          { line: 2, status: 'update', name: '낙하 시험',
            changes: [{ col: '세부', field: 'detail', before: '1.2m', after: '1.5m' }] },
          { line: 3, status: 'same', name: '굽힘 시험', changes: [] },
        ],
      };
      return {
        kind: body.kind,
        summary: { rows: 2, new: 1, exists: 0, updated: 0, errors: 1 },
        rows: [{ line: 2, status: 'new', name: '낙하 시험' }, { line: 3, status: 'error', name: '', message: '시험 항목 이름이 없습니다.' }],
      };
    }
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
    // ①-3 줄 아무 데나 눌러도 척도가 열린다 — 시뮬레이션 칸만 눌리면 아무도 못 알아챈다
    const row = document.querySelector('tbody tr');
    await click([...row.querySelectorAll('td')].find(x => x.textContent.includes('CAE그룹'))); await settle();
    say(opened === 9, `①-3 담당 부서 칸을 눌러도 척도가 열림: ${opened}`);
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
    // ①-4 배지를 누르면 대시보드의 과제 보고를 불러온다(줄의 척도는 안 열린다)
    opened = null;
    await click(badge); await settle(60);
    const got = calls.find(c => (c.url || '').includes('/dt-v2/projects/u1'));
    say(!!got && opened === null, `①-4 배지 → 과제 보고 부름: ${got?.url} · 척도는 안 열림(${opened})`);
    await click(byText('button', '연계 추가')); await settle();
    const dlg = document.querySelector('[role="dialog"][aria-label="연계 추가"]');
    say(!!dlg, '① 「연계 추가」를 누르면 모달');
    const sels = dlg.querySelectorAll('select');
    await select(sels[0], '1'); await settle();
    // ①-6 이미 이어진 수단은 **남되 못 고른다** — 사라지면 「공정마다 고를 수 있는 게 다르다」로 잘못 읽힌다
    const opts = [...sels[1].querySelectorAll('option')];
    const done5 = opts.find(o => o.value === '5');
    say(!!done5 && done5.disabled && done5.textContent.includes('연계 완료'), `①-6 이어진 수단은 「연계 완료」로 잠김: ${opts.map(o => o.textContent.trim())}`);
    say(opts.find(o => o.value === '6') && !opts.find(o => o.value === '6').disabled, '①-6 안 이어진 수단은 고를 수 있음');
    await select(sels[1], '6'); await settle();
    await click(byText('button', '잇기')); await settle(60);
    const post = calls.find(c => c.method === 'POST' && c.url.endsWith('/pairs'));
    say(!!post && post.body.subject_id === 1 && post.body.agent_id === 6, `② POST /pairs: ${JSON.stringify(post?.body)}`);
    say(!document.querySelector('[role="dialog"]'), '② 이으면 모달이 닫힘');
    await unmount();
    // ⑦ 일괄 입력 — 종류를 고르고 붙여넣어 미리보기(저장 없음) → 넣기
    let changed = 0;
    calls.length = 0;
    await render(<BulkInputModal divisionId={17} divisionName="MX" sector="simulation" canEdit
                                 onClose={() => {}} onChanged={() => { changed += 1; }} />);
    await settle(60);
    say(!!byText('button', '시험 항목') && !!byText('button', '시뮬레이션'), '⑦ 부문의 종류가 칩으로');
    say(html().includes('필요한 열'), '⑦ 어떤 열이 필요한지 알려 준다');
    // 표 — 열마다 칸, 고를 수 있는 열은 드롭다운
    const cells = document.querySelectorAll('[aria-label="일괄 입력 표"] tbody tr:first-child td');
    say(cells.length === 5, `⑦ 열마다 칸이 선다(번호+4열): ${cells.length}`);
    say(!!document.querySelector('select[aria-label="1행 사업부"]'), '⑦ 사업부처럼 정해진 값은 드롭다운');
    say(!!document.querySelector('input[aria-label="1행 시험 항목"]'), '⑦ 이름은 그냥 적는 칸');
    say(byText('button', '미리보기 (0줄)').disabled, '⑦ 비어 있으면 미리보기가 잠김');
    // 엑셀에서 붙여넣기 — 목록에 있는 값은 골라지고, 없는 값은 빨갛게 남는다
    const grid = document.querySelector('[aria-label="일괄 입력 표"]');
    await paste(grid, ['사업부\t시험 항목', 'MX\t낙하 시험', '없는사업부\t굽힘 시험'].join('\n'));
    await settle();
    say(document.querySelector('select[aria-label="1행 사업부"]').value === 'MX', '⑦ 붙여넣은 값이 목록에 있으면 골라짐');
    const bad = document.querySelector('select[aria-label="2행 사업부"]');
    say(bad.value === '' && bad.textContent.includes('못 찾음: 없는사업부'), '⑦ 목록에 없으면 「못 찾음」으로 남음');
    say(document.querySelector('input[aria-label="1행 시험 항목"]').value === '낙하 시험', '⑦ 이름 칸도 채워짐');
    await click(byText('button', '미리보기 (2줄)')); await settle(60);
    const dry = calls.find(c => c.method === 'POST' && (c.url || '').endsWith('/bulk'));
    say(!!dry && dry.body.dry_run === true && dry.body.text.split('\n').length === 3, `⑦ 미리보기는 머리글+2줄을 dry_run 으로: ${JSON.stringify(dry?.body?.text)}`);
    say(html().includes('아직 저장하지 않았습니다') && html().includes('시험 항목 이름이 없습니다.'),
        '⑦ 줄마다 어떻게 될지 — 오류 줄도 남는다');
    await click(byText('button', '1줄 넣기')); await settle(60);
    const put = calls.filter(c => c.method === 'POST' && (c.url || '').endsWith('/bulk')).pop();
    say(put && put.body.dry_run === false && changed === 1, `⑦ 넣기는 dry_run=false 로 가고 화면이 새로 읽는다: ${JSON.stringify(put?.body?.dry_run)}`);

    // ⑧ 왕복 — 지금 자료를 불러와, 고쳐, 되넣는다(2026-08-30)
    calls.length = 0;
    await click(byText('button', '지금 자료 불러오기')); await settle(60);
    say(!!calls.find(c => c.url.includes('/bulk/rows')), '⑧ 불러오기가 지금 자료를 부른다');
    say(document.querySelector('input[aria-label="1행 시험 항목"]').value === '낙하 시험'
        && document.querySelector('input[aria-label="1행 세부"]').value === '1.2m',
        '⑧ 표에 지금 값이 채워진다');

    // ⚠️ 불러왔다는 건 **고치러 왔다**는 뜻이다 — 켜 두지 않으면 미리보기가 전부
    //    「이미 있음」으로 끝나 아무 일도 안 한 것처럼 보인다(2026-08-30).
    say(document.querySelector('input[aria-label="있는 것은 고치기"]').checked,
        '⑧ 불러오면 고치기가 켜진다');
    calls.length = 0;
    await click(byText('button', '미리보기 (2줄)')); await settle(60);
    const upd = calls.find(c => c.method === 'POST' && (c.url || '').endsWith('/bulk'));
    say(upd?.body?.mode === 'update', `⑧ 그대로 미리보면 mode=update`);
    say(html().includes('1.2m') && html().includes('1.5m'), '⑧ 무엇이 무엇으로 바뀌는지 보여 준다');
    say(html().includes('고침') && html().includes('그대로'), '⑧ 줄마다 어떻게 될지');
    say(byText('button', '새로 0 · 고침 1 넣기') != null, '⑧ 넣기 단추가 몇 건인지 말해 준다');

    // 끄면 예전처럼 새것만 — 앞선 미리보기는 뜻이 달라졌으니 버린다
    await click(document.querySelector('input[aria-label="있는 것은 고치기"]')); await settle();
    say(!html().includes('아직 저장하지 않았습니다'), '⑧ 고치기를 끄면 앞선 미리보기는 버린다');
    calls.length = 0;
    await click(byText('button', '미리보기 (2줄)')); await settle(60);
    const add = calls.find(c => c.method === 'POST' && (c.url || '').endsWith('/bulk'));
    say(add?.body?.mode === 'add', `⑧ 끄면 새것만: mode=${add?.body?.mode}`);
    await unmount();

    // ⑨ 샘플 뷰에서는 쓸 수 없다고 말한다(2026-08-30)
    // ⚠️ 목업에는 일괄 입력의 재료(머리글·선택지)가 없다. 그냥 두면 종류도 표도 없는
    //    **빈 상자**가 열려 사람이 무엇이 잘못됐는지 모른다.
    const { setSampleMode } = await import('../../src/modules/dev-dt-maturity/sample/sampleStore');
    await setSampleMode(true);
    calls.length = 0;
    await render(<BulkInputModal divisionId={1} divisionName="MX" sector="simulation" onClose={() => {}} />);
    await settle(60);
    say(html().includes('샘플 뷰에서는 일괄 입력을 쓸 수 없습니다'), '⑨ 샘플 뷰에서는 그렇다고 말한다');
    say(!calls.find(c => (c.url || '').includes('/bulk/kinds')), '⑨ 목업을 묻지도 않는다');
    say(byText('button', '지금 자료 불러오기') == null, '⑨ 표도 단추도 안 띄운다');
    await unmount();
    await setSampleMode(false);
  } catch (e) {
    say(false, `실패: ${e.stack.split('\n').slice(0, 4).join(' | ')}`);
  }
  return done();
}
