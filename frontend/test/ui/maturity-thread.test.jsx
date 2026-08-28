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

const AXES = [
  { key: 'link_mode', label: '연결 방식', kind: 'rung', rungs: [{ key: 'verbal', label: '문서·구두 전달' }, { key: 'manual_file', label: '수동 파일 교환' }, { key: 'auto_file', label: '자동 파일 교환' }, { key: 'api', label: 'API 연동' }, { key: 'sync', label: '자동 동기' }, { key: 'closed_loop', label: '폐루프' }] },
  { key: 'scope', label: '적용 범위', kind: 'rung', rungs: [{ key: 'issue', label: '이슈 대응' }, { key: 'basic', label: '대표 모델' }, { key: 'derived_some', label: '신규 개발 전 모델' }, { key: 'all', label: '파생까지' }] },
];
const THREAD = {
  stages: [{ key: 'planning', label: '기획' }, { key: 'development', label: '개발' }, { key: 'management', label: '경영' }, { key: 'purchasing', label: '구매' }],
  system_kinds: [{ key: 'plm', label: 'PLM' }, { key: 'cost', label: '원가' }, { key: 'informal', label: '비공식 매개' }, { key: 'other', label: '기타' }],
  link_means: [{ key: 'api', label: 'API 있음' }, { key: 'file', label: '파일 배치' }, { key: 'none', label: '없음' }, { key: 'unknown', label: '미확인' }],
  system_status: [{ key: 'active', label: '운영' }, { key: 'adopting', label: '도입 중' }],
};
const THREADS = [
  { id: 1, key: 'cost', name: '재료비 스레드', axes_off: [], segments: [
    { id: 11, key: 'target_to_bom', name: '목표 원가 → 설계 BOM', from_stage: 'planning', to_stage: 'development' },
    { id: 12, key: 'bom_to_estimate', name: '설계 BOM → 예상 원가', from_stage: 'development', to_stage: 'management' } ] },
  { id: 2, key: 'quality', name: '품질 스레드', axes_off: [], segments: [] },
];
const SYSTEMS = [{ id: 5, name: 'Teamcenter', kind: 'plm', link_means: 'api', status: 'active', stages: ['development'] }, { id: 6, name: '원가 산정 시스템', kind: 'cost', link_means: 'none', status: 'active', stages: [] }, { id: 9, name: '메일', kind: 'informal', link_means: 'none', status: 'active', stages: [] }];
const ORGS = [{ id: 21, name: 'MX 설계그룹', role: 'development', division_id: 17, source_kind: 'manual' }, { id: 22, name: '원가팀', role: 'management', division_id: 17, source_kind: 'manual' }];
const SEG = { id: 101, subject_id: 501, division_id: 17, thread_id: 1, thread_name: '재료비 스레드', segment_def_id: 12, segment_def: THREADS[0].segments[1], name: '설계 BOM → 예상 원가',
  from_org_id: 21, from_org_name: 'MX 설계그룹', from_system_id: 5, from_system_name: 'Teamcenter', via_system_id: 9, via_system_name: '메일', via_informal: true, to_org_id: 22, to_org_name: '원가팀', to_system_id: 6, to_system_name: '원가 산정 시스템',
  pair_id: 901, pair: { id: 901, assessments: { link_mode: { rung: 'manual_file', rung_index: 1 } }, unassessed: ['scope'] } };

export default async function run() {
  const { say, done } = suite();
  const calls = fakeFetch(({ url, method, body }) => {
    if (url.includes('/threads/stats')) return { division_id: 17, threads: [{ thread_id: 1, thread_key: 'cost', thread_name: '재료비 스레드', def_count: 2, segment_count: 1, assessed: 1, continuity: 0, reach_stage: null, reach_label: null, weakest: { id: 101, name: '설계 BOM → 예상 원가', link_index: 1, link_label: '수동 파일 교환' }, closed_loop: false, informal_ratio: 100, unassessed: 0 }, { thread_id: 2, thread_key: 'quality', thread_name: '품질 스레드', def_count: 0, segment_count: 0, assessed: 0, continuity: null, reach_label: null, weakest: null, closed_loop: false, informal_ratio: null, unassessed: 0 }], divisions: [{ division_id: 17, division_name: 'MX', threads: [{ thread_key: 'cost', thread_name: '재료비 스레드', def_count: 2, segment_count: 1, assessed: 1, continuity: 0, reach_label: null, weakest: { name: '설계 BOM → 예상 원가', link_label: '수동 파일 교환' }, closed_loop: false, informal_ratio: 100, unassessed: 0 }] }] };
    if (url.includes('/threads/org-matrix')) return [{ from_org_id: 21, from_org: 'MX 설계그룹', to_org_id: 22, to_org: '원가팀', count: 1, min_link: 1, min_link_label: '수동 파일 교환', systems: ['Teamcenter', '메일', '원가 산정 시스템'], informal: 1 }];
    if (url.includes('/systems/hubs')) return [{ id: 5, name: 'Teamcenter', kind: 'plm', threads: 1, segments: 1, avg_link: 1, link_means: 'api', unknown_means: false }];
    if (url.includes('/threads')) return THREADS;
    if (url.includes('/segments') && method === 'POST') return { ...SEG, id: 102, ...body, name: body.name || '목표 원가 → 설계 BOM' };
    if (url.includes('/segments')) return [SEG];
    if (url.includes('/systems') && method === 'POST') return { id: 7, name: body.name, kind: body.kind, link_means: 'unknown', status: 'active', stages: [] };
    if (url.includes('/systems')) return SYSTEMS;
    if (url.includes('/orgs/from-departments')) return [{ id: 3, name: 'CAE그룹(MX)', org_id: null }, { id: 4, name: 'Mecha그룹(MX)', org_id: 21 }];
    if (url.includes('/orgs') && method === 'POST') return { id: 23, name: body.name, division_id: 17, source_kind: body.source_kind || 'manual', source_id: body.source_id || null };
    if (url.includes('/orgs')) return ORGS;
    if (url.includes('/pairs/901')) return { id: 901, subject: { name: '설계 BOM → 예상 원가' }, agent: null, assessments: { link_mode: { rung: 'manual_file', rung_index: 1, note: '엑셀 메일', evidence: {}, assessed_at: '2026-06-01T00:00:00' } }, unassessed: ['scope'], changes: [], deny_reason: null };
    return {};
  });

  try {
    await render(<ThreadListView divisionId={17} divisions={[{ id: 17, name: 'MX' }]} denyReason={null} axes={AXES} pairId={null} thread={THREAD}
                                 onOpenPair={() => {}} onClosePair={() => {}} onChanged={() => {}} refreshKey={0} onManage={() => {}} />);
    await settle(60);
    const h = html();
    say(h.includes('재료비 스레드') && h.includes('품질 스레드') && h.includes('설계 BOM → 예상 원가'), '① 스레드 묶음과 구간이 보임');
    say(h.includes('MX 설계그룹') && h.includes('원가팀') && byText('span', '메일') != null, '① 출발 → 매개 → 도착 (비공식 매개 「메일」)');
    say(h.includes('수동 파일 교환') && h.includes('미평가 1개'), '① 연결 방식 배지와 미평가 수');

    // ② 구간 추가
    calls.length = 0;
    await select(document.querySelector('select[aria-label="스레드"]'), '1');
    await select(document.querySelector('select[aria-label="표준 구간"]'), '11');
    const sels = document.querySelectorAll('input[data-search-select]');
    await type(sels[0], '설계'); await settle(); await click(byText('li', 'MX 설계그룹')); await settle();
    await type(sels[1], 'Team'); await settle(); await click(byText('li', 'Teamcenter')); await settle();
    await type(sels[2], '메일'); await settle(); await click(byText('li', '메일 (비공식)')); await settle();
    await type(sels[3], '원가'); await settle(); await click(byText('li', '원가팀')); await settle();
    await click(byText('button', '구간 추가')); await settle(60);
    const post = calls.find(c => c.method === 'POST' && c.url.endsWith('/segments'));
    say(!!post && post.body.thread_id === 1 && post.body.segment_def_id === 11 && post.body.from_org_id === 21 && post.body.from_system_id === 5 && post.body.via_system_id === 9 && post.body.to_org_id === 22,
        `② POST /segments: ${JSON.stringify(post?.body)}`);
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
    say(!!byText('button', '스레드 사전'), '③ 사무국에는 스레드 사전 탭');
    await unmount();

    // ④ 사업부 요약 — 스레드 줄 그림 · 조직 연계표 · 시스템 허브도
    const SUBJ = { id: 501, name: '설계 BOM → 예상 원가', product_families: [], segment: { thread_id: 1, thread_name: '재료비 스레드', segment_def_id: 12, via_informal: true, from_org_name: 'MX 설계그룹', from_system_name: 'Teamcenter', via_system_name: '메일', to_org_name: '원가팀', to_system_name: '원가 산정 시스템' },
      pairs: [{ id: 901, agent: null, unassessed: ['scope'], assessments: { link_mode: { rung: 'manual_file', rung_index: 1 }, scope: null } }], summary: { unassessed: 1, stale: 0, pair_count: 1, best_rung_index: {} } };
    const BOARD = { division_id: 17, subjects: [SUBJ], totals: { subjects: 1, pairs: 1, unassessed: 1, stale: 0 }, stale_days: 365, deny_reason: null };
    let opened = null;
    await render(<BoardBody board={BOARD} changes={[]} axes={AXES} filters={{}} onFiltersChange={() => {}} onOpenPair={(id) => { opened = id; }} onPickDivision={() => {}} review={null} sector="digital_thread" sectorDef={{ subject_label: '연계 구간' }} />);
    await settle(80);
    await click(byText('button', '요약')); await settle(80);
    const h4 = html();
    say(h4.includes('재료비 스레드') && !!byText('button', '설계 BOM → 예상 원가') && !!byText('button', '목표 원가 → 설계 BOM'), '④ 스레드 줄 그림 — 적은 구간은 색, 안 적은 구간은 점선');
    say(h4.includes('조직 간 연계') && h4.includes('원가팀') && h4.includes('시스템 허브도') && h4.includes('Teamcenter'), '④ 조직 연계표와 시스템 허브도');
    await click(byText('button', '설계 BOM → 예상 원가'));
    say(opened === 901, '④ 줄의 구간을 누르면 그 구간 상세');
    await click(byText('button', '상세')); await settle();
    say(html().includes('스레드 · 구간') && html().includes('출발 → 매개 → 도착') && html().includes('MX 설계그룹'), '④ 상세 표의 첫 두 열이 구간과 출발 → 매개 → 도착');
    await unmount();
  } catch (e) {
    say(false, `실패: ${e.stack.split('\n').slice(0, 4).join(' | ')}`);
  }
  return done();
}
