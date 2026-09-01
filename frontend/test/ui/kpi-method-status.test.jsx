// KPI 매트릭스 — 사업부 탭 끝의 「현황」 단추와 KPI 연계 현황 모달. (2026-08-30)
//
//   ① 매트릭스 보기에는 탭 줄이 없다 — 단추도 없다
//   ② 사업부별 보기로 가면 탭 줄 끝에 「현황」, 남은 일(미연계·미입력)을 달고 있다
//   ③ 누르면 두 단(과제→연계 · 연계→기여방법)이 조직마다 한 판에 선다
//   ④ 기능조직(GTR·CS)도 줄이 선다 — 이들도 KPI 연계를 정의한다
//   ⑤ 엑셀로 저장하면 판 셋(현황·미연계·미입력)이 한 권으로
//   ⑥ 사업부 줄을 누르면 그 사업부로 옮기고 닫힌다 — 보고 끝나는 표가 아니다
import './setup-dom.mjs';   // ⚠️ 반드시 첫 import
import React from 'react';
import { render, click, settle, byText, html, fakeFetch, suite, unmount } from './dom-helpers.mjs';
import { AuthProvider } from '../../src/contexts/AuthContext';
import KpiMatrixView from '../../src/modules/digital-twin-dashboard/components/Dashboard/KpiMatrixView';
import { written } from './xlsx-stub.js';
import { placePick, PICK_W } from '../../src/modules/digital-twin-dashboard/components/Dashboard/BulkKpiLinkModal';

const KPI = (id, label) => ({ kpiDefinitionId: id, label, unit: '%', category: '개발', kind: 'metric' });
const P = (uuid, division, status = '진행중') => ({ uuid, projectName: uuid, division, status });

/*
  연결 = [과제, KPI, 대상 사업부, 기여방법(note), 등급]. note 가 비면 「미입력」이다.

    MX   과제 a·b·c·x   a→k1(적힘) · a→k2(빈칸) · b→k1(공백만)   c·x 는 아무 데도 안 걸림
         → 과제 4 · 연계 2 · 미연계 2 (50%) | 연결 3 · 정의 1 · 미입력 2 (33%)
    VD   과제 없음 → 전부 0, 비율은 「없음」 (0% 로 칠하면 안 한 것처럼 읽힌다)
    GTR  과제 g — MX 와 VD 를 함께 지원(둘 다 빈칸) → 과제 1 · 연계 1 | 연결 2 · 미입력 2
    CS   과제 없음
    취소된 z 는 과제에도 연결에도 안 잡힌다.
*/
const MATRIX = {
  divisions: [
    { name: 'MX', isKpiOwner: true }, { name: 'VD', isKpiOwner: true },
    { name: 'GTR', isKpiOwner: false }, { name: 'CS', isKpiOwner: false },
  ],
  kpis: [KPI(1, '개발 리드타임'), KPI(2, '시제 검증률')],
  projects: [P('a', 'MX'), P('b', 'MX'), P('c', 'MX'), P('x', 'MX'),
    P('g', 'GTR'), P('z', 'MX', '취소')],
  links: [
    ['a', 1, 'MX', '해석으로 시제 회차를 줄임', 'direct'],
    ['a', 2, 'MX', '', 'direct'],
    ['b', 1, 'MX', '   ', 'indirect'],       // 공백만 — 적힌 것이 아니다
    ['g', 1, 'MX', '', 'indirect'],
    ['g', 1, 'VD', '', 'indirect'],
    ['z', 1, 'MX', '적힘', 'direct'],        // 취소 과제 — 셈에서 빠진다
  ],
  metrics: [],
  unmatched: [],
};

/** 오늘 날짜 — 파일 이름이 매일 바뀌므로 시험도 같은 규칙으로 짓는다. */
const stamp = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
};

export default async function run() {
  const { say, done } = suite();
  fakeFetch(({ url }) => {
    if (url.includes('/auth/me')) return { id: 1, name: '관리자', is_admin: true, role: 'ADMIN' };
    if (url.includes('/kpi-matrix')) return MATRIX;
    if (url.includes('/settings')) return { divisions: MATRIX.divisions, processes: [] };
    return {};
  });
  try {
    await render(
      <AuthProvider>
        <KpiMatrixView currentYear={2026} onYearChange={() => {}} onOpenProject={() => {}} />
      </AuthProvider>,
    );
    await settle(80);

    // ① 매트릭스 보기 — 탭 줄이 없으니 단추도 없다
    say(byText('button', '사업부별 보기') != null, '① 보기 전환이 있다');
    say(!html().includes('KPI 연계 현황'), '① 매트릭스 보기에서는 현황 모달이 없다');

    // ② 사업부별 보기 — 탭 줄 끝에 현황
    await click(byText('button', '사업부별 보기'));
    await settle(60);
    const btn = [...document.querySelectorAll('button')]
      .find((b) => b.textContent.trim().startsWith('현황'));
    say(!!btn, '② 사업부 탭 줄에 「현황」 단추');
    say(!!btn && /미연계 2 · 미입력 4/.test(btn.textContent),
        `② 남은 일을 달고 있다: ${btn?.textContent.trim()}`);

    // ③ 두 단이 조직마다
    await click(btn);
    await settle(60);
    const dlg = document.querySelector('[role="dialog"][aria-label="KPI 연계 현황"]');
    say(!!dlg, '③ 현황 모달이 열린다');
    say(dlg.textContent.includes('과제 → KPI 연계') && dlg.textContent.includes('연계 → 기여방법'),
        '③ 두 단으로 나뉘어 있다');
    const rowOf = (name) => [...dlg.querySelectorAll('tbody tr')]
      .find((tr) => tr.querySelector('td')?.textContent.trim() === name);
    const cells = (tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim());

    const mx = cells(rowOf('MX'));
    say(mx.slice(1, 4).join(',') === '4,2,2', `③ MX 과제4·연계2·미연계2: ${mx.slice(1, 4)}`);
    say(mx[4].includes('50%'), `③ MX 연계율 50%: ${mx[4]}`);
    say(mx.slice(5, 8).join(',') === '3,1,2', `③ MX 연결3·정의1·미입력2: ${mx.slice(5, 8)}`);
    say(mx[8].includes('33%'), `③ MX 채움률 33%: ${mx[8]}`);
    // 취소 과제 z 가 잡히면 MX 는 5건/4연결로 나온다
    say(mx[1] === '4' && mx[5] === '3', '③ 취소 과제는 셈에서 빠진다');

    // 과제가 없으면 0% 가 아니라 「없음」 — 0% 는 안 한 것처럼 읽힌다
    const vd = cells(rowOf('VD'));
    say(vd.slice(1, 4).join(',') === '0,0,0' && vd[4].includes('과제 없음'),
        `③ VD 는 과제 없음: ${vd.slice(1, 5)}`);

    // ④ 기능조직도 줄이 선다 — 지원한 사업부가 아니라 **자기 줄**에
    say(dlg.textContent.includes('기능조직'), '④ 기능조직 구획이 있다');
    const gtr = cells(rowOf('GTR'));
    say(gtr.slice(1, 4).join(',') === '1,1,0', `④ GTR 과제1·연계1: ${gtr.slice(1, 4)}`);
    say(gtr.slice(5, 8).join(',') === '2,0,2', `④ GTR 연결2·미입력2(MX·VD 둘): ${gtr.slice(5, 8)}`);
    say(!!rowOf('CS'), '④ 과제가 없는 기능조직도 줄이 선다');

    // 합계 — 연결이 표 전체에서 한 번씩만 세어진다(GTR 것이 MX 줄에 안 겹친다)
    const foot = [...dlg.querySelectorAll('tfoot td')].map((td) => td.textContent.trim());
    say(foot.slice(1, 4).join(',') === '5,3,2', `④ 합계 과제5·연계3·미연계2: ${foot.slice(1, 4)}`);
    say(foot.slice(5, 8).join(',') === '5,1,4', `④ 합계 연결5·정의1·미입력4: ${foot.slice(5, 8)}`);

    // ⑤ 엑셀로 저장 — 현황 판과 할 일 둘을 한 권으로
    written.length = 0;
    await click([...dlg.querySelectorAll('button')].find((b2) => b2.textContent.includes('엑셀로 저장')));
    await settle(60);
    say(written.length === 1, `⑤ 파일 하나를 저장한다: ${written.length}`);
    const wb = written[0]?.wb;
    say(written[0]?.name === 'KPI연계현황_2026_' + stamp() + '.xlsx',
        `⑤ 파일 이름: ${written[0]?.name}`);
    say(JSON.stringify(wb?.SheetNames) === JSON.stringify(['현황', '미연계 과제', '기여방법 미입력']),
        `⑤ 판 셋: ${wb?.SheetNames}`);
    const sheet = (n) => wb.Sheets[n].rows;
    // 현황 판은 화면의 표와 같은 숫자다 — 갈리면 둘 중 하나가 거짓말이 된다
    say(JSON.stringify(sheet('현황').at(-1)) === JSON.stringify(['합계', '', 5, 3, 2, 60, 5, 1, 4, 20]),
        `⑤ 현황 판의 합계: ${sheet('현황').at(-1)}`);
    say(sheet('미연계 과제').length === 3, `⑤ 미연계 과제 둘(c·x): ${sheet('미연계 과제').length - 1}건`);
    say(sheet('기여방법 미입력').length === 5, `⑤ 기여방법 미입력 넷: ${sheet('기여방법 미입력').length - 1}건`);

    // ⑥ 사업부 줄을 누르면 그 사업부로 — 보고 끝나는 표가 아니다
    await click(rowOf('VD'));
    await settle(60);
    say(!document.querySelector('[role="dialog"][aria-label="KPI 연계 현황"]'), '⑥ 고르면 모달이 닫힌다');
    const onTab = [...document.querySelectorAll('button')]
      .find((b) => b.textContent.trim().startsWith('VD') && b.getAttribute('title')?.includes('연결된 자체 과제'));
    say(!!onTab, '⑥ VD 로 옮겨졌다');
    await unmount();
  } catch (e) {
    say(false, `실패: ${e.stack.split('\n').slice(0, 4).join(' | ')}`);
  }
  // ── 칸 고르기 패널의 자리 — 누른 칸 아래 **한가운데**(2026-09-01 지적: 오른쪽으로 쏠렸다) ──
  {
    const at = placePick({ left: 600, width: 80, top: 300, bottom: 330 }, 1600, 900);
    say(at.left === 600 + 40 - PICK_W / 2, `패널이 칸 한가운데에 선다: ${at.left}`);
    say(at.top === 336, '패널이 칸 바로 아래에 선다');
    const edge = placePick({ left: 1500, width: 80, top: 300, bottom: 330 }, 1600, 900);
    say(edge.left === 1600 - PICK_W - 8, '오른쪽 끝에서는 화면 안으로 들어온다');
    const low = placePick({ left: 600, width: 80, top: 800, bottom: 830 }, 1600, 900);
    say(low.top === 800 - 440 - 6, '아래가 모자라면 칸 위로 올라간다');
    const tiny = placePick({ left: 10, width: 80, top: 300, bottom: 330 }, 1600, 900);
    say(tiny.left === 8, '왼쪽 끝에서는 8px 안쪽에 선다');
  }
  return done();
}
