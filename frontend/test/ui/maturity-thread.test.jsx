// 성숙도 — 디지털 스레드의 「목록」(구간 표 + 추가 줄)과 사전 창을 눌러 본다. (2026-08-28)
//
//   ① 구간이 스레드 묶음으로 보이고(출발 → 매개 → 도착, 비공식 매개는 호박색), 연결 방식 배지
//   ② 아래 줄에서 스레드·표준 구간·조직·시스템을 고르고 「구간 추가」 → POST /segments
//   ③ 사전 창: 시스템 빠른 추가 → POST /systems · 조직 탭에서 포탈 부서 가져오기 → POST /orgs(portal)
import './setup-dom.mjs';   // ⚠️ 반드시 첫 import
import React from 'react';
import { render, click, type, select, settle, byText, html, fakeFetch, suite, unmount } from './dom-helpers.mjs';
import ThreadListView from '../../src/modules/dev-dt-maturity/components/Thread/ThreadListView';
import ThreadDictModal from '../../src/modules/dev-dt-maturity/components/Thread/ThreadDictModal';
import { BoardBody } from '../../src/modules/dev-dt-maturity/components/Board/BoardView';
import ThreadCaseLedger from '../../src/modules/dev-dt-maturity/components/Thread/ThreadCaseLedger';

const AXES = [
  { key: 'capture', label: '데이터 확보', kind: 'rung', unknown_ok: true, headline_min: 'direct', rungs: [{ key: 'none', label: '없음·개인 파일' }, { key: 'upload', label: '사람이 취합해 올림' }, { key: 'direct', label: '시스템에 직접 입력' }, { key: 'auto', label: '장비·도구에서 자동 수집' }] },
  { key: 'link_mode', label: '연결', kind: 'rung', unknown_ok: true, headline_min: 'auto_transfer', rungs: [{ key: 'manual', label: '사람이 옮김' }, { key: 'auto_transfer', label: '자동 전달' }, { key: 'integrated', label: '시스템 연동' }, { key: 'closed_loop', label: '폐루프' }] },
];
const THREAD = {
  stages: [{ key: 'planning', label: '기획' }, { key: 'development', label: '개발' }, { key: 'management', label: '경영' }, { key: 'purchasing', label: '구매' }],
  system_kinds: [{ key: 'plm', label: 'PLM' }, { key: 'cost', label: '원가' }, { key: 'informal', label: '비공식 매개' }, { key: 'other', label: '기타' }],
  link_means: [{ key: 'api', label: 'API 있음' }, { key: 'file', label: '파일 배치' }, { key: 'none', label: '없음' }, { key: 'unknown', label: '미확인' }],
  system_status: [{ key: 'active', label: '운영' }, { key: 'adopting', label: '도입 중' }],
  data_kinds: [{ key: 'bom', label: 'BOM' }, { key: 'cost', label: '원가·단가' }, { key: 'other', label: '기타' }],
  case_actions: [{ key: 'integrate', label: '연동' }, { key: 'adopt', label: '도입' }, { key: 'harmonize', label: '정합화' }],
  case_status: [{ key: 'planned', label: '계획' }, { key: 'doing', label: '진행 중' }, { key: 'done', label: '완료' }],
};
const THREADS = [
  { id: 1, key: 'cost', name: '재료비 스레드', axes_off: [], segments: [
    { id: 11, key: 'target_to_bom', name: '목표 원가 → 설계 BOM', from_stage: 'planning', to_stage: 'development', data_kinds: ['cost', 'bom'] },
    { id: 12, key: 'bom_to_estimate', name: '설계 BOM → 예상 원가', from_stage: 'development', to_stage: 'management' } ] },
  { id: 2, key: 'quality', name: '품질 스레드', axes_off: [], segments: [] },
];
const SYSTEMS = [{ id: 5, name: 'Teamcenter', kind: 'plm', link_means: 'api', status: 'active', stages: ['development'] }, { id: 6, name: '원가 산정 시스템', kind: 'cost', link_means: 'none', status: 'active', stages: [] }, { id: 9, name: '메일', kind: 'informal', link_means: 'none', status: 'active', stages: [] }];
const ORGS = [{ id: 21, name: 'MX 설계그룹', role: 'development', division_id: 17, source_kind: 'manual' }, { id: 22, name: '원가팀', role: 'management', division_id: 17, source_kind: 'manual' }];
const SEG = { id: 101, subject_id: 501, division_id: 17, thread_id: 1, thread_name: '재료비 스레드', segment_def_id: 12, segment_def: THREADS[0].segments[1], name: '설계 BOM → 예상 원가',
  from_org_id: 21, from_org_name: 'MX 설계그룹', from_system_id: 5, from_system_name: 'Teamcenter', via_system_id: 9, via_system_name: '메일', via_informal: true, to_org_id: 22, to_org_name: '원가팀', to_system_id: 6, to_system_name: '원가 산정 시스템',
  data_kinds: ['bom', 'cost'], data_kind_labels: ['BOM', '원가·단가'],
  pair_id: 901, pair: { id: 901, assessments: { link_mode: { rung: 'manual', rung_index: 0 } }, unassessed: ['capture'] } };

export default async function run() {
  const { say, done } = suite();
  const calls = fakeFetch(({ url, method, body }) => {
    if (url.includes('/thread-cases/years')) return [2026];
    if (url.includes('/thread-cases/stats')) return { count: 1, by_action: { integrate: 1 }, by_status: { done: 1 }, lift: 2, systems: [{ name: 'Teamcenter', count: 1 }] };
    if (url.includes('/thread-cases') && method === 'POST') return { id: 8, ...body, month: `${body.month}-01`, thread_name: '재료비 스레드', segment_name: '설계 BOM → 예상 원가', system_name: 'Teamcenter', link_from_label: '사람이 옮김', link_to_label: '시스템 연동', lift: 2, actor_name: '나' };
    if (url.includes('/thread-cases')) return [{ id: 7, month: '2026-03-01', action: 'integrate', status: 'done', thread_id: 1, thread_name: '재료비 스레드', segment_id: 101, segment_name: '설계 BOM → 예상 구간', system_id: 5, system_name: 'Teamcenter', link_from: 'manual', link_to: 'integrated', link_from_label: '사람이 옮김', link_to_label: '시스템 연동', lift: 2, note: '허브 연동', actor_name: '홍' }];
    if (url.includes('/threads/stats')) return { division_id: 17, threads: [{ thread_id: 1, thread_key: 'cost', thread_name: '재료비 스레드', def_count: 2, segment_count: 1, assessed: 1, continuity: 0, reach_stage: null, reach_label: null, weakest: { id: 101, name: '설계 BOM → 예상 원가', link_index: 0, link_label: '사람이 옮김' }, closed_loop: false, informal_ratio: 100, unassessed: 0 }, { thread_id: 2, thread_key: 'quality', thread_name: '품질 스레드', def_count: 0, segment_count: 0, assessed: 0, continuity: null, reach_label: null, weakest: null, closed_loop: false, informal_ratio: null, unassessed: 0 }], divisions: [{ division_id: 17, division_name: 'MX', threads: [{ thread_key: 'cost', thread_name: '재료비 스레드', def_count: 2, segment_count: 1, assessed: 1, continuity: 0, reach_label: null, weakest: { name: '설계 BOM → 예상 원가', link_label: '사람이 옮김' }, closed_loop: false, informal_ratio: 100, unassessed: 0 }] }] };
    if (url.includes('/threads/org-matrix')) return [{ from_org_id: 21, from_org: 'MX 설계그룹', to_org_id: 22, to_org: '원가팀', count: 1, min_link: 0, min_link_label: '사람이 옮김', systems: ['Teamcenter', '메일', '원가 산정 시스템'], informal: 1 }];
    if (url.includes('/systems/hubs')) return [{ id: 5, name: 'Teamcenter', kind: 'plm', threads: 1, segments: 1, avg_link: 0, link_means: 'api', unknown_means: false }];
    if (url.includes('/threads')) return THREADS;
    if (url.includes('/segments') && method === 'POST') return { ...SEG, id: 102, ...body, name: body.name || '목표 원가 → 설계 BOM' };
    if (url.includes('/segments')) return [SEG];
    if (url.includes('/systems') && method === 'POST') return { id: 7, name: body.name, kind: body.kind, link_means: 'unknown', status: 'active', stages: [] };
    if (url.includes('/systems')) return SYSTEMS;
    if (url.includes('/orgs/from-departments')) return [{ id: 3, name: 'CAE그룹(MX)', org_id: null }, { id: 4, name: 'Mecha그룹(MX)', org_id: 21 }];
    if (url.includes('/orgs') && method === 'POST') return { id: 23, name: body.name, division_id: 17, source_kind: body.source_kind || 'manual', source_id: body.source_id || null };
    if (url.includes('/orgs')) return ORGS;
    if (url.includes('/pairs/901')) return { id: 901, subject: { name: '설계 BOM → 예상 원가' }, agent: null, assessments: { link_mode: { rung: 'manual', rung_index: 0, note: '엑셀 메일', evidence: {}, assessed_at: '2026-06-01T00:00:00' } }, unassessed: ['capture'], changes: [], deny_reason: null };
    return {};
  });

  try {
    await render(<ThreadListView divisionId={17} divisions={[{ id: 17, name: 'MX' }]} denyReason={null} axes={AXES} pairId={null} thread={THREAD}
                                 onOpenPair={() => {}} onClosePair={() => {}} onChanged={() => {}} refreshKey={0} onManage={() => {}} />);
    await settle(60);
    const h = html();
    say(h.includes('재료비 스레드') && h.includes('품질 스레드') && h.includes('설계 BOM → 예상 원가'), '① 스레드 묶음과 구간이 보임');
    say(h.includes('MX 설계그룹') && h.includes('원가팀') && byText('span', '메일') != null, '① 출발 → 매개 → 도착 (비공식 매개 「메일」)');
    say(h.includes('사람이 옮김') && h.includes('미평가 1개'), '① 연결 방식 배지와 미평가 수');
    say(h.includes('>BOM<') && h.includes('>원가·단가<'), '① 데이터 종류 꼬리표');

    // ② 구간 추가 — 단추를 누르면 모달
    calls.length = 0;
    say(!document.querySelector('select[aria-label="스레드"]'), '② 추가 양식은 평소엔 안 보임');
    await click(byText('button', '구간 추가')); await settle();
    say(!!document.querySelector('[role="dialog"][aria-label="구간 추가"]'), '② 「구간 추가」를 누르면 모달');
    await select(document.querySelector('select[aria-label="스레드"]'), '1');
    await select(document.querySelector('select[aria-label="표준 구간"]'), '11');
    const sels = document.querySelectorAll('input[data-search-select]');
    await type(sels[0], '설계'); await settle(); await click(byText('li', 'MX 설계그룹')); await settle();
    await type(sels[1], 'Team'); await settle(); await click(byText('li', 'Teamcenter')); await settle();
    await type(sels[2], '메일'); await settle(); await click(byText('li', '메일 (비공식)')); await settle();
    await type(sels[3], '원가'); await settle(); await click(byText('li', '원가팀')); await settle();
    await click(byText('button', '추가')); await settle(60);
    say(!document.querySelector('[role="dialog"][aria-label="구간 추가"]'), '② 넣으면 모달이 닫힘');
    const post = calls.find(c => c.method === 'POST' && c.url.endsWith('/segments'));
    say(!!post && post.body.thread_id === 1 && post.body.segment_def_id === 11 && post.body.from_org_id === 21 && post.body.from_system_id === 5 && post.body.via_system_id === 9 && post.body.to_org_id === 22,
        `② POST /segments: ${JSON.stringify(post?.body)}`);
    say(JSON.stringify(post?.body?.data_kinds) === '["cost","bom"]', '② 표준 구간을 고르면 데이터 종류 기본값이 채워져 감');
    await unmount();

    // ③ 사전 창
    calls.length = 0;
    await render(<ThreadDictModal kind="system" divisionId={17} divisions={[{ id: 17, name: 'MX' }]} thread={THREAD} axes={AXES} canCurate denyReason={null} onClose={() => {}} onChanged={() => {}} />);
    await settle(60);
    say(html().includes('Teamcenter') && html().includes('원가 산정 시스템'), '③ 시스템 목록이 보임');
    await select(document.querySelector('select[aria-label="종류"]'), 'plm');
    await type(document.querySelector('input[aria-label="시스템 관리 빠른 추가"]'), 'Windchill');
    await click(document.querySelector('button[title="추가"]')); await settle(60);
    const ps = calls.find(c => c.method === 'POST' && c.url.endsWith('/systems'));
    say(!!ps && ps.body.name === 'Windchill' && ps.body.kind === 'plm', `③ POST /systems: ${JSON.stringify(ps?.body)}`);
    await click(byText('button', '조직')); await settle(60);
    say(html().includes('포탈 부서에서 가져오기') && !!document.querySelector('button[aria-label="CAE그룹(MX) 가져오기"]') && !document.querySelector('button[aria-label="Mecha그룹(MX) 가져오기"]'), '③ 조직 탭 — 아직 안 들어온 부서만 가져오기 단추');
    calls.length = 0;
    await click(document.querySelector('button[aria-label="CAE그룹(MX) 가져오기"]')); await settle(60);
    const po = calls.find(c => c.method === 'POST' && c.url.endsWith('/orgs'));
    say(!!po && po.body.source_kind === 'portal' && po.body.source_id === '3' && po.body.name === 'CAE그룹(MX)', `③ POST /orgs(portal): ${JSON.stringify(po?.body)}`);
    say(!!byText('button', '스레드 정의'), '③ 사무국에는 스레드 정의 탭');
    await unmount();

    // ④ 사업부 요약 — 스레드 줄 그림 · 조직 연계표 · 시스템 허브도
    const SUBJ = { id: 501, name: '설계 BOM → 예상 원가', product_families: [], segment: { thread_id: 1, thread_name: '재료비 스레드', segment_def_id: 12, via_informal: true, from_org_name: 'MX 설계그룹', from_system_name: 'Teamcenter', via_system_name: '메일', to_org_name: '원가팀', to_system_name: '원가 산정 시스템' },
      pairs: [{ id: 901, agent: null, unassessed: ['scope'], assessments: { link_mode: { rung: 'manual', rung_index: 0 }, capture: null } }], summary: { unassessed: 1, stale: 0, pair_count: 1, best_rung_index: {} } };
    const BOARD = { division_id: 17, subjects: [SUBJ], totals: { subjects: 1, pairs: 1, unassessed: 1, stale: 0 }, stale_days: 365, deny_reason: null };
    let opened = null;
    await render(<BoardBody board={BOARD} changes={[]} axes={AXES} filters={{}} onFiltersChange={() => {}} onOpenPair={(id) => { opened = id; }} onPickDivision={() => {}} review={null} sector="digital_thread" sectorDef={{ subject_label: '연계 구간' }} />);
    await settle(80);
    await click(byText('button', '요약')); await settle(80);
    const h4 = html();
    say(h4.includes('재료비 스레드') && !!byText('button', '설계 BOM → 예상 원가') && !!byText('button', '목표 원가 → 설계 BOM'), '④ 스레드 줄 그림 — 적은 구간은 색, 안 적은 구간은 점선');
    say(h4.includes('조직 간 연계') && h4.includes('원가팀') && h4.includes('시스템 허브도') && h4.includes('Teamcenter'), '④ 조직 연계표와 시스템 허브도');
    say(!!document.querySelector('svg[aria-label="시스템 지도"]') && document.querySelectorAll('svg[aria-label="시스템 지도"] circle').length === 3 && document.querySelectorAll('svg[aria-label="시스템 지도"] line').length === 2, '④ 시스템 지도 — 노드 3(Teamcenter·메일·원가 산정) · 간선 2');
    await click(byText('button', '설계 BOM → 예상 원가'));
    say(opened === 901, '④ 줄의 구간을 누르면 그 구간 상세');
    await click(byText('button', '상세')); await settle();
    say(html().includes('스레드 · 구간') && html().includes('출발 → 매개 → 도착') && html().includes('MX 설계그룹'), '④ 상세 표의 첫 두 열이 구간과 출발 → 매개 → 도착');
    await unmount();

    // ⑤ 연계 개발 기록 — 건이 보이고, 토글로 적어 추가
    calls.length = 0;
    await render(<ThreadCaseLedger divisionId={17} divisions={[{ id: 17, name: 'MX' }]} denyReason={null} thread={THREAD} axes={AXES} refreshKey={0} />);
    await settle(80);
    const h5 = html();
    say(h5.includes('1건') && h5.includes('올라간 칸') && h5.includes('허브 연동') && h5.includes('사람이 옮김') && h5.includes('시스템 연동'), '⑤ 셈과 건이 보임(전 → 후, +2)');
    await click(byText('button', '정합화'));
    await click([...document.querySelector('[aria-label="상태"]').querySelectorAll('button')].find(b => b.textContent === '진행 중'));
    const segIn = document.querySelectorAll('input[data-search-select]');
    await type(segIn[0], '예상'); await settle(); await click(byText('li', '재료비 스레드 · 설계 BOM → 예상 원가')); await settle();
    await type(document.querySelectorAll('input[data-search-select]')[1], 'Team'); await settle(); await click(byText('li', 'Teamcenter')); await settle();
    const fromGroup = document.querySelector('[aria-label="연결 방식 전"]');
    await click([...fromGroup.querySelectorAll('button')].find(b => b.textContent === '사람이 옮김'));
    const toGroup = document.querySelector('[aria-label="연결 방식 후"]');
    await click([...toGroup.querySelectorAll('button')].find(b => b.textContent === '시스템 연동'));
    await type(document.querySelector('input[aria-label="메모"]'), '코드 통일');
    await click(byText('button', '추가')); await settle(80);
    const pc = calls.find(c => c.method === 'POST' && c.url.endsWith('/thread-cases'));
    say(!!pc && pc.body.action === 'harmonize' && pc.body.status === 'doing' && pc.body.segment_id === 101 && pc.body.system_id === 5 && pc.body.link_from === 'manual' && pc.body.link_to === 'integrated',
        `⑤ POST /thread-cases: ${JSON.stringify(pc?.body)}`);
    await unmount();
  } catch (e) {
    say(false, `실패: ${e.stack.split('\n').slice(0, 4).join(' | ')}`);
  }
  return done();
}
