// 성숙도 — 설정 창(정확도 문턱·경계)을 실제로 눌러 본다. (2026-08-28)
//
//   ① 열면 GET /settings 를 읽고, 전사 기본이 없으면 코드 기본(70 · 90 · ≥)이 채워진다
//   ② 사업부를 고르면 「전사 따름」이고, 문턱을 고치면 그 사업부만의 값이 돼 PUT 에 사업부 줄이 생긴다
//   ③ 문턱이 뒤집히면 저장이 잠긴다
//   ④ 「전사 기본 따르기」로 사업부 줄이 빠진 채 저장된다
import './setup-dom.mjs';   // ⚠️ 반드시 첫 import
import React from 'react';
import { render, click, type, select, settle, byText, html, fakeFetch, suite, unmount } from './dom-helpers.mjs';
import SettingsModal from '../../src/modules/dev-dt-maturity/components/Settings/SettingsModal';
import Header from '../../src/modules/dev-dt-maturity/components/Layout/Header';

const DIVS = [{ id: 17, name: 'MX' }, { id: 18, name: 'VD' }];
const RUNGS = [{ key: 'trend', label: '경향 일치' }, { key: 'quantitative', label: '원인 분석' }, { key: 'correlated', label: '현상 재현' }];
const SECTORS = [{ key: 'simulation', label: '시뮬레이션', active: true, hidden: false }, { key: 'digital_thread', label: '디지털 스레드', active: true, hidden: false },
  { key: 'manufacturing_monitoring', label: '모니터링', active: true, hidden: false }, { key: 'design_automation', label: '설계 자동화', active: false, hidden: false }];

export default async function run() {
  const { say, done } = suite();
  let stored = { accuracy: {} };
  // 기준 정보 — 서버가 주는 지금 값. 저장하면 서버가 그것을 되돌려 준다.
  let vocabs = [
    { key: 'model_kinds', label: '모델 종류', sector_label: '시뮬레이션', hint: '무엇에 기대어 도는가.', is_custom: false,
      items: [{ key: 'fem', label: '유한요소' }] },
    { key: 'system_kinds', label: '시스템 종류', sector_label: '디지털 스레드', hint: 'PLM·MES 처럼 시스템 사전의 갈래.', is_custom: false,
      items: [{ key: 'plm', label: 'PLM' }, { key: 'mes', label: 'MES' }] },
    { key: 'thread_stages', label: '생애 단계', sector_label: '디지털 스레드', hint: '차례가 뜻을 갖습니다.', is_custom: false,
      items: [{ key: 'plan', label: '기획' }, { key: 'dev', label: '개발' }] },
    { key: 'ladder:simulation:automation', label: '척도 · 자동화', sector_label: '시뮬레이션', store: 'ladders',
      sector: 'simulation', axis: 'automation', fixed: true, has_description: true, is_custom: false,
      hint: '어느 단계가 사람 손 없이 도는가',
      fields: [{ key: 'label', label: '축 이름', value: '자동화' }, { key: 'question', label: '묻는 것', value: '어디까지 도는가' },
               { key: 'evidence_label', label: '근거 이름표', value: '1회 소요 시간(Hr)' }],
      extras: [{ key: 'base', label: '바탕', items: [{ key: 'geometry', label: '형상 재현', description: '치수·재질' }] }],
      items: [{ key: 'manual', label: '수동', description: '전 과정을 사람이 한다' },
              { key: 'pre', label: '전처리 자동', description: '준비가 자동' }] },
    { key: 'sector_words', label: '부문의 말', sector_label: '공통', store: 'sector_words', fixed: true, is_custom: false,
      hint: '관리 창 이름·표 머리가 이 말을 씁니다.',
      items: [{ key: 'simulation:subject_label', label: '시험 항목', description: '시뮬레이션 — 대상' },
              { key: 'simulation:agent_label', label: '시뮬레이션', description: '시뮬레이션 — 수단' }] },
  ];
  // 점검 — 자료가 가리키는데 목록에 없는 값
  let mismatch = [
    { vocab: 'system_kinds', label: '시스템 종류', sector_label: '디지털 스레드', can_clear: false,
      options: [{ key: 'plm', label: 'PLM' }, { key: 'mes', label: 'MES' }],
      bad: [{ value: 'erp', count: 3, where: ['시스템 사전 — 종류'], free: false }] },
    { vocab: 'thread_stages', label: '생애 단계', sector_label: '디지털 스레드', can_clear: false,
      options: [{ key: 'plan', label: '기획' }], bad: [] },
  ];
  const calls = fakeFetch(({ url, method, body }) => {
    if (url.endsWith('/vocabs/mismatches')) return mismatch;
    if (url.endsWith('/vocabs/remap')) { mismatch = mismatch.map(m => (m.vocab === body.vocab ? { ...m, bad: [] } : m)); return { rows: 3 }; }
    if (url.endsWith('/vocabs')) return vocabs;
    if (url.endsWith('/settings') && method === 'PUT') {
      if (body.vocab) vocabs = vocabs.map(v => ({ ...v, items: body.vocab[v.key] || v.items, is_custom: true }));
      if (body.ladders) {
        vocabs = vocabs.map(v => (v.store === 'ladders'
          ? { ...v, items: ((body.ladders[v.sector] || {})[v.axis] || {}).rungs || v.items, is_custom: true } : v));
      }
      stored = { ...stored, ...body }; return stored;
    }
    if (url.endsWith('/settings')) return stored;
    if (url.includes('/divisions')) return [{ id: 17, name: 'MX', hidden: false }, { id: 18, name: 'VD', hidden: false }, { id: 99, name: 'SR', hidden: false }];
    return {};
  });

  try {
    await render(<SettingsModal divisions={DIVS} sectors={SECTORS} accuracyRungs={RUNGS} onClose={() => {}} onChanged={() => {}} />);
    await settle();
    const q = () => document.querySelector('input[aria-label="원인 분석 문턱"]');
    const c = () => document.querySelector('input[aria-label="현상 재현 문턱"]');
    say(calls.some(x => x.method === 'GET' && x.url.endsWith('/settings')), '① 열면 설정을 읽음');
    say(q()?.value === '70' && c()?.value === '90' && html().includes('코드 기본'), '① 전사 기본이 없으면 코드 기본(70 · 90)이 보임');
    // ①-2 왼쪽은 「무엇을 정하나」만 — 사업부는 판 안의 칩이다
    const leftRows = () => [...document.querySelectorAll('[aria-label="설정"] > div > div:first-child > button')].map(b => b.textContent.trim());
    say(!!document.querySelector('[aria-label="문턱을 정할 곳"]'), '①-2 사업부는 정확도 판 안의 칩');
    say(leftRows().some(t => t.startsWith('정확도 문턱')) && !leftRows().some(t => t.startsWith('MX')),
        `①-2 왼쪽에 사업부 줄이 서 있지 않음: ${leftRows()}`);

    // ② 사업부 MX — 전사 따름 → 문턱을 고치면 따로
    await click(byText('button', 'MX'));
    say(html().includes('지금은 전사 기본을 따릅니다'), '② 사업부를 고르면 「전사 따름」');
    await type(c(), '95');
    await click(byText('button', '저장')); await settle();
    const put = calls.find(x => x.method === 'PUT');
    const mx = put?.body?.accuracy?.['17'];
    say(!!mx && mx.thresholds.find(t => t.rung === 'correlated').min === 95 && mx.boundary === 'gte', `② PUT 에 사업부 17 줄이 생김: ${JSON.stringify(mx)}`);
    say(html().includes('저장됨') && html().includes('따로'), '② 저장 뒤 「따로」 표시');

    // ③ 뒤집힌 문턱은 잠김
    await type(q(), '96');
    say(byText('button', '저장').disabled && html().includes('이어야 합니다'), '③ 원인 분석 문턱이 현상 재현 문턱보다 크면 저장 잠김');
    await type(q(), '60');
    say(!byText('button', '저장').disabled, '③ 바로잡으면 풀림');

    // ④ 전사 기본 따르기 → 줄이 빠진 채 저장
    calls.length = 0;
    await click(byText('button', '전사 기본 따르기'));
    await click(byText('button', '저장')); await settle();
    const put2 = calls.find(x => x.method === 'PUT');
    say(!!put2 && !('17' in (put2.body.accuracy || {})), '④ 「전사 기본 따르기」로 사업부 줄이 빠짐');

    // ⑤ 사업부 표시 — SR 을 빼면 hidden_divisions 로 저장
    calls.length = 0;
    await click(byText('button', '사업부 표시')); await settle();
    const sr = document.querySelector('input[aria-label="SR 제외"]');
    say(!!sr && !!document.querySelector('input[aria-label="MX 제외"]'), '⑤ 전체 조직이 체크 목록으로 보임');
    say(byText('button', '저장').disabled, '⑤ 안 바꾸면 저장 잠김');
    await click(sr); await settle();
    await click(byText('button', '저장')); await settle();
    const put3 = calls.find(x => x.method === 'PUT');
    say(!!put3 && JSON.stringify(put3.body) === JSON.stringify({ hidden_divisions: [99] }), `⑤ PUT hidden_divisions: ${JSON.stringify(put3?.body)}`);
    say(html().includes('1개 뺌'), '⑤ 왼쪽에 「1개 뺌」');

    // ⑤-2 부문 표시 — 모니터링을 감추면 hidden_sectors 로 저장
    calls.length = 0;
    await click(byText('button', '부문 표시')); await settle();
    const mon = document.querySelector('input[aria-label="모니터링 감춤"]');
    say(!!mon && !!document.querySelector('input[aria-label="시뮬레이션 감춤"]'), '⑤-2 부문이 체크 목록으로 보임');
    say(html().includes('평가 척도 없음(준비 중)'), '⑤-2 아직 척도가 없는 부문은 표시됨');
    say(byText('button', '저장').disabled, '⑤-2 안 바꾸면 저장 잠김');
    await click(mon); await settle();
    await click(byText('button', '저장')); await settle();
    say(!document.querySelector('input[aria-label="원인 분석 문턱"]'), '⑤-2 부문 표시 화면에 정확도 판이 딸려 나오지 않음');
    const putSec = calls.find(x => x.method === 'PUT');
    say(!!putSec && JSON.stringify(putSec.body) === JSON.stringify({ hidden_sectors: ['manufacturing_monitoring'] }), `⑤-2 PUT hidden_sectors: ${JSON.stringify(putSec?.body)}`);

    // ⑥ 재평가 기간 — 일 수를 바꿔 저장
    calls.length = 0;
    await click(byText('button', '재평가 기간')); await settle();
    const sd = document.querySelector('input[aria-label="재평가 기간(일)"]');
    say(!!sd && sd.value === '365' && byText('button', '저장').disabled, '⑥ 기본 365일이 채워져 있고 안 바꾸면 저장 잠김');
    await click(byText('button', '180일'));
    say(sd.value === '180' && !byText('button', '저장').disabled, '⑥ 빠른 선택 180일 → 저장 켜짐');
    await type(sd, '0');
    say(byText('button', '저장').disabled && html().includes('정수(일)'), '⑥ 0 은 거절');
    await type(sd, '240');
    await click(byText('button', '저장')); await settle();
    const put4 = calls.find(x => x.method === 'PUT');
    say(!!put4 && JSON.stringify(put4.body) === JSON.stringify({ stale_days: 240 }), `⑥ PUT stale_days: ${JSON.stringify(put4?.body)}`);
    say(html().includes('240일'), '⑥ 왼쪽에 「240일」');

    // ⑧ 기준 정보 — 화면의 선택지를 고치고, 더하고, 뺀다
    calls.length = 0;
    await click(byText('button', '기준 정보')); await settle();
    const name = (dict, i) => document.querySelector(`input[aria-label="${dict} ${i}번 이름"]`);
    say(html().includes('key 는 자료에 박히는 값'), '⑧ key 는 안 바뀐다고 알림');
    say(!document.querySelector('input[aria-label="원인 분석 문턱"]'), '⑧ 기준 정보 화면에도 정확도 판이 없음');
    // ⑧ 갈래는 **위의 탭**으로 나뉜다 — 옆줄에 죽 세우면 찾기 힘들다
    const tabs = () => [...document.querySelectorAll('[role="tab"]')].map(t => t.textContent.trim());
    say(tabs().some(t => t.startsWith('시뮬레이션')) && tabs().some(t => t.startsWith('디지털 스레드')),
        `⑧ 갈래가 위의 탭으로: ${tabs()}`);
    const listed = () => [...document.querySelectorAll('[aria-label="설정"] button')].map(b2 => b2.textContent.trim());
    say(listed().some(t => t.startsWith('모델 종류')) && !listed().some(t => t.startsWith('시스템 종류')),
        '⑧ 옆줄에는 고른 갈래의 것만');
    await click([...document.querySelectorAll('[role="tab"]')].find(t => t.textContent.startsWith('디지털 스레드'))); await settle();
    say(listed().some(t => t.startsWith('시스템 종류')) && !listed().some(t => t.startsWith('모델 종류')),
        '⑧ 탭을 옮기면 그 갈래의 것으로 바뀜');
    say(html().includes('디지털 스레드 화면'), '⑧ 탭을 옮기면 그 갈래의 첫 줄이 골라짐');
    say(!!name('시스템 종류', 1) && !!name('시스템 종류', 2), '⑧ 항목이 고칠 수 있는 칸으로 보임');
    const goTab = (t) => click([...document.querySelectorAll('[role="tab"]')].find(x => x.textContent.startsWith(t)));
    // ⑧-2 척도 문구 — 평가할 때 고르는 칸. 문구만 고치고 칸은 못 늘린다.
    await goTab('시뮬레이션'); await settle();
    await click(byText('button', '척도 · 자동화')); await settle();
    say(!byText('button', '항목 더하기') && html().includes('문구만 고칩니다'), '⑧-2 못 박힌 목록은 더하기·빼기가 없음');
    say(!!document.querySelector('textarea[aria-label="척도 · 자동화 1번 설명"]'), '⑧-2 설명도 함께 고침');
    await type(document.querySelector('input[aria-label="척도 · 자동화 2번 이름"]'), '앞단 자동');
    await click(byText('button', '저장')); await settle();
    const putL = calls.find(x => x.method === 'PUT' && x.body?.ladders);
    say(putL?.body?.ladders?.simulation?.automation?.rungs?.[1]?.label === '앞단 자동',
        `⑧-2 척도는 ladders 광주리로 감: ${JSON.stringify(putL?.body?.ladders)}`);
    say(!('ladder:simulation:automation' in (putL?.body?.vocab || {})), '⑧-2 사전 광주리에는 안 섞임');
    // ⑧-3 축 이름·묻는 것·근거 이름표, 그리고 바탕 곁표까지 한 판에서
    await click(byText('button', '척도 · 자동화')); await settle();
    calls.length = 0;
    const ask = document.querySelector('input[aria-label="척도 · 자동화 묻는 것"]');
    say(!!ask && !!document.querySelector('input[aria-label="척도 · 자동화 축 이름"]'), '⑧-3 축 이름·묻는 것도 고침');
    say(!!document.querySelector('input[aria-label="바탕 1번 이름"]'), '⑧-3 바탕 곁표도 함께');
    await type(ask, '어느 단계가 저절로 도는가');
    await type(document.querySelector('input[aria-label="바탕 1번 이름"]'), '형상만');
    await click(byText('button', '저장')); await settle();
    const putA = calls.find(x => x.method === 'PUT' && x.body?.ladders?.simulation?.automation?.question);
    say(putA?.body?.ladders?.simulation?.automation?.question === '어느 단계가 저절로 도는가', '⑧-3 묻는 것이 함께 감');
    say(putA?.body?.ladders?.simulation?.automation?.base?.[0]?.label === '형상만', '⑧-3 바탕도 함께 감');
    // ⑧-5 점검 — 빼도 자료는 남으므로, 어긋난 값을 세어 주고 지금 있는 값으로 옮긴다
    calls.length = 0;
    await click([...document.querySelectorAll('[role="tab"]')].find(t => t.textContent.startsWith('점검'))); await settle();
    say(html().includes('erp') && html().includes('3줄'), '⑧-5 어긋난 값과 줄 수가 보임');
    say(html().includes('시스템 사전 — 종류'), '⑧-5 어디에 있는지도');
    const pickTo = document.querySelector('select[aria-label="erp 를 무엇으로"]');
    say(!!pickTo && byText('button', '고른 것 바꾸기').disabled, '⑧-5 안 고르면 바꾸기 잠김');
    await select(pickTo, 'mes'); await settle();
    say(!byText('button', '고른 것 바꾸기').disabled, '⑧-5 고르면 풀림');
    await click(byText('button', '고른 것 바꾸기')); await settle();
    const putR = calls.find(x => x.url.endsWith('/vocabs/remap'));
    say(JSON.stringify(putR?.body) === JSON.stringify({ vocab: 'system_kinds', moves: [{ from: 'erp', to: 'mes' }] }),
        `⑧-5 옮길 것만 보냄: ${JSON.stringify(putR?.body)}`);
    say(html().includes('어긋난 값이 없습니다'), '⑧-5 옮기고 나면 다시 훑어 깨끗해짐');

    // ⑧-4 부문의 말 — 화면 전체의 이름표
    calls.length = 0;
    await goTab('공통'); await settle();
    await click(byText('button', '부문의 말')); await settle();
    say(!byText('button', '항목 더하기'), '⑧-4 부문의 말도 줄은 못 늘림');
    await type(document.querySelector('input[aria-label="부문의 말 1번 이름"]'), '검증 항목');
    await click(byText('button', '저장')); await settle();
    const putW = calls.find(x => x.method === 'PUT' && x.body?.sector_words);
    say(putW?.body?.sector_words?.simulation?.subject_label === '검증 항목',
        `⑧-4 부문·자리로 갈라 보냄: ${JSON.stringify(putW?.body?.sector_words)}`);
    calls.length = 0;
    await goTab('디지털 스레드'); await settle();
    await click(byText('button', '시스템 종류')); await settle();
    say(byText('button', '저장').disabled, '⑧ 안 바꾸면 저장 잠김');
    await type(name('시스템 종류', 1), '제품 수명주기 관리');
    say(!byText('button', '저장').disabled, '⑧ 이름을 고치면 저장 켜짐');
    await click(byText('button', '항목 더하기')); await settle();
    say(!!name('시스템 종류', 3), '⑧ 항목을 더하면 줄이 늘어남');
    await type(name('시스템 종류', 3), '창고 관리');
    await click(document.querySelector('button[aria-label="2번 빼기"]')); await settle();
    say(!name('시스템 종류', 3), '⑧ 빼면 줄이 줄어듦');
    await click(byText('button', '저장')); await settle();
    const putV = calls.find(x => x.method === 'PUT');
    const sk = putV?.body?.vocab?.system_kinds;
    say(!!sk && sk.length === 2 && sk[0].key === 'plm' && sk[0].label === '제품 수명주기 관리',
        `⑧ key 는 그대로 두고 이름만 바뀐 채 저장: ${JSON.stringify(sk)}`);
    say(!!sk && sk[1].label === '창고 관리' && !sk.some(x => x.key === 'mes'), '⑧ 더한 것은 들어가고 뺀 것은 빠짐');
    say(JSON.stringify(putV?.body?.vocab?.thread_stages) === JSON.stringify(vocabs.find(v => v.key === 'thread_stages').items),
        '⑧ 손 안 댄 사전도 함께 보냄 — 서버가 통째로 받는다');
    say(html().includes('제품 수명주기 관리'), '⑧ 저장 뒤 서버가 준 값이 보임');
    // 다른 사전으로 옮겨도 그 사전의 것만 보인다
    await click(byText('button', '생애 단계')); await settle();
    say(!!name('생애 단계', 1) && !name('시스템 종류', 1), '⑧ 사전을 옮기면 그 사전의 항목만 보임');
    await unmount();

    // ⑦ 헤더 토글 — 감춘 부문은 아예 안 보인다
    await render(<Header sectors={SECTORS} sector="simulation" canCurate onGoHome={() => {}} onOpen={() => {}} onSector={() => {}} />);
    await settle();
    const names = () => [...document.querySelectorAll('[aria-label="부문"] button')].map(b => b.textContent.trim());
    say(names().includes('모니터링') && names().includes('디지털 스레드'), `⑦ 부문 토글에 모니터링이 있음: ${names()}`);
    // ⑦-2 「추출」은 탭과 무관하게 늘 있다 — 관리자가 아니어도 자기 사업부 자료는 받아 갈 수 있다
    let asked = null;
    await unmount();
    await render(<Header sectors={SECTORS} sector="simulation" onGoHome={() => {}} onOpen={(k) => { asked = k; }} onSector={() => {}} />);
    await settle();
    // ⑦-2 「데이터」 아래에 추출·일괄 입력 둘
    const data = byText('button', '데이터');
    say(!!data, '⑦-2 헤더에 「데이터」');
    await click(data); await settle();
    say(!!byText('button', '추출') && !!byText('button', '일괄 입력'), '⑦-2 열면 추출·일괄 입력');
    await click(byText('button', '추출')); await settle();
    say(asked === 'export', `⑦-2 추출을 누르면 추출이 돈다: ${asked}`);
    await click(byText('button', '데이터')); await settle();
    await click(byText('button', '일괄 입력')); await settle();
    say(asked === 'bulk', `⑦-2 일괄 입력을 누르면 창이 열린다: ${asked}`);
    await unmount();
    await render(<Header sectors={SECTORS.map(x => (x.key === 'manufacturing_monitoring' ? { ...x, hidden: true } : x))}
                         sector="simulation" canCurate onGoHome={() => {}} onOpen={() => {}} onSector={() => {}} />);
    await settle();
    say(!names().includes('모니터링') && names().includes('시뮬레이션'), `⑦ 감추면 토글에서 사라짐: ${names()}`);
    await unmount();
  } catch (e) {
    say(false, `실패: ${e.stack.split('\n').slice(0, 4).join(' | ')}`);
  }
  return done();
}
