// 성숙도 — 설정 창(정확도 문턱·경계)을 실제로 눌러 본다. (2026-08-28)
//
//   ① 열면 GET /settings 를 읽고, 전사 기본이 없으면 코드 기본(70 · 90 · ≥)이 채워진다
//   ② 사업부를 고르면 「전사 따름」이고, 문턱을 고치면 그 사업부만의 값이 돼 PUT 에 사업부 줄이 생긴다
//   ③ 문턱이 뒤집히면 저장이 잠긴다
//   ④ 「전사 기본 따르기」로 사업부 줄이 빠진 채 저장된다
import './setup-dom.mjs';   // ⚠️ 반드시 첫 import
import React from 'react';
import { render, click, type, settle, byText, html, fakeFetch, suite, unmount } from './dom-helpers.mjs';
import SettingsModal from '../../src/modules/dev-dt-maturity/components/Settings/SettingsModal';
import Header from '../../src/modules/dev-dt-maturity/components/Layout/Header';

const DIVS = [{ id: 17, name: 'MX' }, { id: 18, name: 'VD' }];
const RUNGS = [{ key: 'trend', label: '경향 일치' }, { key: 'quantitative', label: '원인 분석' }, { key: 'correlated', label: '현상 재현' }];
const SECTORS = [{ key: 'simulation', label: '시뮬레이션', active: true, hidden: false }, { key: 'digital_thread', label: '디지털 스레드', active: true, hidden: false },
  { key: 'manufacturing_monitoring', label: '모니터링', active: true, hidden: false }, { key: 'design_automation', label: '설계 자동화', active: false, hidden: false }];

export default async function run() {
  const { say, done } = suite();
  let stored = { accuracy: {} };
  const calls = fakeFetch(({ url, method, body }) => {
    if (url.endsWith('/settings') && method === 'PUT') { stored = { ...stored, ...body }; return stored; }
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
    say(html().includes('사다리 없음(준비 중)'), '⑤-2 아직 사다리가 없는 부문은 표시됨');
    say(byText('button', '저장').disabled, '⑤-2 안 바꾸면 저장 잠김');
    await click(mon); await settle();
    await click(byText('button', '저장')); await settle();
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
