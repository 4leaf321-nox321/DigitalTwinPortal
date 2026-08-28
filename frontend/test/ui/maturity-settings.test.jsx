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

const DIVS = [{ id: 17, name: 'MX' }, { id: 18, name: 'VD' }];
const RUNGS = [{ key: 'trend', label: '경향 일치' }, { key: 'quantitative', label: '원인 분석' }, { key: 'correlated', label: '현상 재현' }];

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
    await render(<SettingsModal divisions={DIVS} accuracyRungs={RUNGS} onClose={() => {}} onChanged={() => {}} />);
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
    await unmount();
  } catch (e) {
    say(false, `실패: ${e.stack.split('\n').slice(0, 4).join(' | ')}`);
  }
  return done();
}
