// 성숙도 — 해석 활용 기록을 실제로 눌러 본다. (2026-08-28)
//
//   ① 열면 그 해의 건과 셈이 보인다 (건수 · 스펙 확정 전 이상 % · 정착 후보)
//   ② 위 줄에 한 건 적고 「추가」 → POST /reviews 에 month·kind·agent_id·timing… 이 간다
//   ③ 연필로 고치기 → PUT · 휴지통 → DELETE
//   ④ CSV 가져오기 — 미리보기 → 문제 없으면 넣기
//   ⑤ 정착 후보 → 상시 시험 항목으로 올리기 (2026-08-30)
import './setup-dom.mjs';   // ⚠️ 반드시 첫 import
import React from 'react';
import { render, click, type, settle, byText, html, fakeFetch, suite, unmount } from './dom-helpers.mjs';
import ReviewLedger from '../../src/modules/dev-dt-maturity/components/Review/ReviewLedger';

const REVIEW = {
  kinds: [{ key: 'spec', label: '설계 스펙 검토', item_label: '스펙 항목' }, { key: 'cause', label: '원인 분석', item_label: '불량 유형' }],
  fields: {
    timing: { label: '시점', options: [{ key: 'after_issue', label: '문제 발생 후' }, { key: 'review_meeting', label: '설계 검토 단계' }, { key: 'before_spec', label: '스펙 확정 전' }, { key: 'concept', label: '컨셉 단계' }] },
    decision: { label: '결정 반영', options: [{ key: 'reference', label: '참고 자료' }, { key: 'change_basis', label: '설계 변경 근거' }, { key: 'gate', label: '스펙 확정 관문' }, { key: 'rule', label: '설계 규칙 정착' }] },
    basis: { label: '판정 근거', options: [{ key: 'trend', label: '경향 비교' }, { key: 'margin', label: '정량 마진 산출' }, { key: 'confirmed', label: '실측·시험 검증' }] },
  },
  promote_min: 3,
};
const ROW = { id: 7, division_id: 17, kind: 'spec', month: '2026-03-01', target: 'Fold8', item: '힌지 강성', agent_id: 5, agent_name: '폴딩 응력 해석', timing: 'before_spec', decision: 'gate', basis: 'margin', lead_days: 4, note: '', actor_name: '홍' };
const STATS = { division_id: 17, year: 2026, kinds: {
  spec: { count: 3, early: 67, gate: 67, confirmed: 50, lead_median: 3, promote: [{ agent_name: '폴딩 응력 해석', item: '힌지 강성', count: 3 }] },
  cause: { count: 1, early: 0, gate: 100, confirmed: 100, lead_median: 6, promote: [] } } };

export default async function run() {
  const { say, done } = suite();
  const calls = fakeFetch(({ url, method, body }) => {
    if (url.includes('/reviews/years')) return [2026, 2025];
    if (url.includes('/reviews/stats')) return STATS;
    if (url.includes('/reviews/import/preview')) return { count: 2, problems: [], items: [{ line: 2, agent_known: true }, { line: 3, agent_known: false }] };
    if (url.includes('/reviews/import/apply')) return { created: 2 };
    if (url.includes('/reviews/promote')) return { pair_id: 42, subject_id: 9, agent_id: 5,
      subject_name: body.subject_name, agent_name: body.agent_name,
      made: { subject: true, agent: false, pair: true }, cases: 3 };
    if (url.includes('/reviews') && method === 'POST') return { ...ROW, id: 8, ...body };
    if (url.includes('/reviews/7') && method === 'PUT') return { ...ROW, ...body };
    if (url.includes('/reviews/7') && method === 'DELETE') return { deleted: 7 };
    if (url.includes('/reviews?')) return [ROW];
    if (url.includes('/agents')) return [{ id: 5, name: '폴딩 응력 해석' }, { id: 6, name: '열 해석' }];
    return {};
  });

  try {
    await render(<ReviewLedger divisionId={17} divisions={[{ id: 17, name: 'MX' }]} denyReason={null} review={REVIEW} refreshKey={0} />);
    await settle(60);
    const h = html();
    say(h.includes('힌지 강성') && h.includes('스펙 확정 전') && h.includes('스펙 확정 관문'), '① 그 해의 건이 표에 보임(칸은 글자로)');
    say(h.includes('3건') && h.includes('스펙 확정 전 이상 67%') && h.includes('정착 후보 1'), '① 셈 — 건수·스펙 확정 전 이상 %·정착 후보');

    // ② 한 건 추가
    calls.length = 0;
    await type(document.querySelector('input[aria-label="연-월"]'), '2026-07');
    await type(document.querySelector('input[aria-label="항목"]'), '방열 마진');
    const agentIn = document.querySelector('input[data-search-select]');
    await type(agentIn, '열'); await settle();
    await click(byText('li', '열 해석')); await settle();
    await click(byText('button', '컨셉 단계'));
    await click(byText('button', '설계 규칙 정착'));
    say(byText('button', '컨셉 단계').getAttribute('aria-pressed') === 'true', '② 시점·결정 반영은 토글 — 누른 것이 선택됨');
    await type(document.querySelector('input[aria-label="리드타임(일)"]'), '2');
    await click(byText('button', '추가')); await settle(60);
    const post = calls.find(c => c.method === 'POST' && c.url.endsWith('/reviews'));
    say(!!post && post.body.month === '2026-07' && post.body.agent_id === 6 && post.body.timing === 'concept' && post.body.decision === 'rule' && post.body.lead_days === 2 && post.body.item === '방열 마진',
        `② POST /reviews: ${JSON.stringify(post?.body)}`);
    say(document.querySelector('input[aria-label="항목"]').value === '', '② 넣고 나면 입력 줄이 비워짐');

    // ③ 고치기 · 지우기
    calls.length = 0;
    await click(document.querySelector('button[aria-label="고치기"]')); await settle();
    say(document.querySelector('input[aria-label="항목"]').value === '힌지 강성' && !!byText('button', '고침'), '③ 연필을 누르면 그 건이 입력 줄에 채워짐');
    await type(document.querySelector('input[aria-label="리드타임(일)"]'), '5');
    await click(byText('button', '고침')); await settle(60);
    const put = calls.find(c => c.method === 'PUT' && c.url.includes('/reviews/7'));
    say(!!put && put.body.lead_days === 5, `③ PUT /reviews/7: lead_days ${put?.body?.lead_days}`);
    window.confirm = () => true;
    await click(document.querySelector('button[aria-label="지우기"]')); await settle(60);
    say(calls.some(c => c.method === 'DELETE' && c.url.includes('/reviews/7')), '③ 휴지통이 DELETE 를 보냄');

    // ④ CSV
    calls.length = 0;
    await click(byText('button', 'CSV 가져오기')); await settle();
    const area = document.querySelector('textarea');
    say(!!area && !!document.querySelector('[download]'), '④ 가져오기 창 — 틀 내려받기·붙여 넣기 칸');
    await type(area, '연-월\t종류\n2026-03\t설계 스펙 검토');
    await click(byText('button', '미리보기')); await settle(60);
    say(html().includes('넣을 건') && html().includes('관리 목록에 없는 시뮬레이션 이름이 1건'), '④ 미리보기 — 건수와 모르는 이름 경고');
    await click(byText('button', '2건 넣기')); await settle(60);
    say(calls.some(c => c.url.includes('/reviews/import/apply')), '④ 넣기가 apply 를 보냄');

    // ⑤ 정착 후보 — 알약을 누르면 목록 창, 이름을 고쳐 올린다
    calls.length = 0;
    await click(byText('button', '정착 후보 1')); await settle();
    say(!!document.querySelector('[aria-label="정착 후보 올리기"]'), '⑤ 알약을 누르면 후보 창');
    say(html().includes('평가는 만들지 않습니다') && html().includes('그대로 남습니다'),
        '⑤ 무엇이 일어나는지 먼저 말한다');
    const nameIn = document.querySelector('input[aria-label="폴딩 응력 해석 시험 항목 이름"]');
    say(nameIn?.value === '힌지 강성', '⑤ 기록의 항목 이름이 채워져 있음');
    await type(nameIn, '힌지 강성 시험');
    say(html().includes('기록에는 「힌지 강성」'), '⑤ 이름을 고치면 원래 것을 짚어 준다');
    await click(byText('button', '올리기')); await settle();
    const up = calls.find(c => c.url.includes('/reviews/promote'));
    say(JSON.stringify(up?.body) === JSON.stringify({ division_id: 17, agent_name: '폴딩 응력 해석',
      item: '힌지 강성', subject_name: '힌지 강성 시험', make_agent: false }),
        `⑤ 올릴 때 무엇을 보내나: ${JSON.stringify(up?.body)}`);
    say(html().includes('올렸습니다') && html().includes('항목 새로'), '⑤ 무엇이 새로 생겼는지 말해 준다');

    await unmount();
  } catch (e) {
    say(false, `실패: ${e.stack.split('\n').slice(0, 4).join(' | ')}`);
  }
  return done();
}
