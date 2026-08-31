// 「모든 과제 현황」의 다섯 번째 보기 — 완료 현황. (2026-08-31)
//
//   ① 보기 단추가 있고, 누르면 사업부 × 12개월 표가 선다
//   ② 완료는 **실적 완료일**의 달, 미완료는 **계획 종료월** — 두 기준이 한 표에 선다
//   ③ 완료일이 없는 완료 과제는 종료 월로 세되 별표가 붙는다
//   ④ 완료일이 해당 연도 밖이면 12월이 아니라 「기간 외」으로 빠진다
//   ⑤ 칸을 누르면 아래에 그 과제가 선다 — 숫자와 목록이 한 화면에서 이어진다
//   ⑥ 집계 대상(전체·완료·미완료)을 고르면 세는 것이 달라진다
import './setup-dom.mjs';   // ⚠️ 반드시 첫 import
import React from 'react';
import { render, click, settle, byText, html, fakeFetch, suite, unmount } from './dom-helpers.mjs';
import { AuthProvider } from '../../src/contexts/AuthContext';
import AllProjectsView from '../../src/modules/digital-twin-dashboard/components/Dashboard/AllProjectsView';

const YEAR = 2026;
const A = (done, ymd) => ({ 완료여부: done, 완료일: ymd, 목표일: ymd });
const P = (o) => ({ 과제년도: YEAR, 사업부: 'MX', 진행상태: '정상진행', 시작: 1, 종료: 6, ...o });

/*
    MX-1  완료 · 종료 12월인데 액션아이템 최종 완료일 3/14  → **3월** 완료
    MX-2  완료 · 액션아이템 완료일 없음, 종료 9월           → 9월 완료(별표)
    MX-3  미완료 · 종료 3월 (오늘보다 지남)                 → 3월 기한 경과
    VD-1  미완료 · 종료 11월                                → 11월 예정
    VD-2  완료 · 완료일 2025-12-20 (해당 연도 밖)           → 기간 외
    MX-9  취소                                              → 어디에도 안 선다
*/
const PROJECTS = [
  P({ id: 1, 과제코드: 'MX-1', 과제명: '구조해석 자동화', 진행상태: '완료', 종료: 12,
    액션아이템목록: [A(true, '2026-02-01'), A(true, '2026-03-14'), A(false, '')] }),
  P({ id: 2, 과제코드: 'MX-2', 과제명: '완료일 없는 과제', 진행상태: '완료', 종료: 9, 액션아이템목록: [] }),
  P({ id: 3, 과제코드: 'MX-3', 과제명: '늦은 과제', 종료: 3 }),
  P({ id: 4, 과제코드: 'VD-1', 과제명: '가을 마감', 사업부: 'VD', 종료: 11 }),
  P({ id: 5, 과제코드: 'VD-2', 과제명: '작년에 끝난 것', 사업부: 'VD', 진행상태: '완료', 종료: 1,
    액션아이템목록: [A(true, '2025-12-20')] }),
  P({ id: 9, 과제코드: 'MX-9', 과제명: '접은 과제', 진행상태: '취소', 종료: 5 }),
];

/** 표에서 (사업부 줄 × 열 번호) 칸의 글자. 0번 열이 사업부 이름이다. */
const cellText = (rowName, col) => {
  const tr = [...document.querySelectorAll('table tr')]
    .find((x) => x.querySelector('td, th')?.textContent.trim() === rowName);
  return tr ? tr.querySelectorAll('td')[col]?.textContent.trim() : null;
};

export default async function run() {
  const { say, done } = suite();
  fakeFetch(({ url }) => {
    if (url.includes('/auth/me')) return { id: 1, name: '관리자', is_admin: true, role: 'admin' };
    return {};
  });
  try {
    await render(
      <AuthProvider>
        <AllProjectsView projects={PROJECTS} currentYear={YEAR} onYearChange={() => {}}
                         statusColors={{}} divisionColors={{}} settingsData={{}} isAdmin />
      </AuthProvider>,
    );
    await settle(80);

    // ① 다섯 번째 보기
    const btn = byText('button', '완료 현황');
    say(!!btn, '① 「완료 현황」 보기 단추가 있다');
    await click(btn);
    await settle(60);
    say(html().includes('2026년 월별 과제 완료 현황'), '① 표가 선다');
    // ⚠️ 임원 보고에 그대로 띄우는 화면이라 문구는 명사형·격식체다(2026-08-31).
    say(html().includes('실적 완료일 기준') && html().includes('계획 종료월 기준'),
        '① 두 기준이 다르다는 것을 머리에 적어 둔다');

    // ② 완료는 실제 완료일의 달 — 종료 12월인 과제가 3월 칸에 선다
    // 열: 0=사업부, 1~12=월, 13=기간 외, 14=미정, 15=합계
    say(cellText('MX', 3) === '1 · 1', `② MX 3월 = 완료1 · 기한 경과1: ${cellText('MX', 3)}`);
    say(cellText('MX', 12) === '·', `② 종료 12월이어도 12월 칸은 비었다: ${cellText('MX', 12)}`);

    // ③ 완료일이 없으면 종료 월로 세되 별표
    say(cellText('MX', 9) === '1*', `③ MX 9월 = 완료1 + 별표: ${cellText('MX', 9)}`);

    // ④ 해당 연도 밖은 「기간 외」로
    say(cellText('VD', 13) === '1', `④ VD 기간 외 1건: ${cellText('VD', 13)}`);
    say(cellText('VD', 1) === '·' && cellText('VD', 12) === '·',
        '④ 작년에 끝난 것이 1월·12월 칸에 안 섰다');
    say(cellText('VD', 11) === '1', `④ VD 11월 예정 1건: ${cellText('VD', 11)}`);

    // 취소는 어디에도 안 선다 — MX 합계는 완료2 · 미완료1 뿐이다
    say(cellText('MX', 15) === '2* · 1', `④ MX 합계 = 완료2(별표) · 미완료1: ${cellText('MX', 15)}`);

    // ⑤ 칸을 누르면 그 과제가 아래에
    say(html().includes('항목을 선택하면 해당 과제가 표시됩니다'), '⑤ 처음엔 고른 칸이 없다');
    const mxRow = [...document.querySelectorAll('table tbody tr')]
      .find((x) => x.querySelector('td')?.textContent.trim() === 'MX');
    await click(mxRow.querySelectorAll('td')[3].querySelector('button'));
    await settle(60);
    say(html().includes('MX · 3월'), '⑤ 고른 칸을 머리에 적는다');
    say(html().includes('구조해석 자동화') && html().includes('늦은 과제'),
        '⑤ 그 칸의 과제 둘이 선다(완료 하나 · 기한 경과 하나)');
    say(html().includes('2026-03-14'), '⑤ 완료한 것은 실제 완료일을 보여 준다');
    say(!html().includes('가을 마감'), '⑤ 다른 칸의 과제는 안 섞인다');

    // ⑥ 집계 대상을 바꾸면 세는 것이 달라진다
    const pickShow = (label) => [...document.querySelectorAll('button')]
      .find((b) => b.textContent.trim() === label);
    await click(pickShow('미완료'));
    await settle(60);
    say(cellText('MX', 3) === '1', `⑥ 미완료 — MX 3월은 기한 경과 1 뿐: ${cellText('MX', 3)}`);
    say(cellText('MX', 9) === '·', `⑥ 미완료 — 완료뿐인 9월은 빈다: ${cellText('MX', 9)}`);
    await click(pickShow('완료'));
    await settle(60);
    say(cellText('MX', 3) === '1' && cellText('MX', 9) === '1*',
        `⑥ 완료 — 3월 1 · 9월 1*: ${cellText('MX', 3)} / ${cellText('MX', 9)}`);
    await unmount();
  } catch (e) {
    say(false, `실패: ${e.stack.split('\n').slice(0, 4).join(' | ')}`);
  }
  return done();
}
