// 성숙도 「계획」 — 조사의 배경과 얼개. 부문과 무관한 한 페이지. (2026-08-31)
//
//   ① 부문을 안 물어본다 — /overview 를 그냥 부른다
//   ② 절은 넷뿐이다 — 지금 문제 · 이 조사 · 지표 · 전제
//   ③ 1절: **문장형** — 가상검증률은 정확도의 평균, 개발시간의 세 갈래
//   ④ 2절: **순서도** — 지표 ▶ KPI ▶ 성과. 신규 성과는 점선(KPI 없음)
//        집계 지표는 **칸이 따로 없다** — 원본 축에 병기된다(2026-09-01)
//        지표끼리의 선행이 가로 자리를 정한다 — 선행이 없는 축이 맨 왼쪽
//   ⑤ 3절: 지표는 **접혀 있다.** 눌러야 펼쳐진다 — 처음부터 표 세 장이면 안 읽힌다
//   ⑥ 현재 수준·달성도가 섞이지 않는다
import './setup-dom.mjs';   // ⚠️ 반드시 첫 import
import React from 'react';
import { render, click, settle, sleep, byText, html, fakeFetch, suite, unmount } from './dom-helpers.mjs';
import { act } from 'react-dom/test-utils';
import OverviewView from '../../src/modules/dev-dt-maturity/components/Overview/OverviewView';
import { buildChain, focusOf, sliceChain, placeLabels } from '../../src/modules/dev-dt-maturity/components/Overview/ChainFlow';

/* ⚠️ 가상검증률·데이터 연결율은 성숙도 지표의 **집계값**(derived)이다. 별도 계층이 아니다. */
const KPIS = [
  { key: 'virtual_rate', label: '가상검증률', domain: '개발', tier: 'derived', part: 'dev', managed: true, from_axis: '정확도', outcomes: ['dev_cost'], note: '', how: { dev_cost: '재설계를 안 한다' } },
  { key: 'data_link', label: '데이터 연결율', domain: '제조', tier: 'derived', part: 'mfg', managed: true, from_axis: '기본 계측', outcomes: ['mfg_cost'], note: '', how: { mfg_cost: '멈춘 시간이 준다' } },
  { key: 'otp', label: 'One Time Pass', domain: '개발', tier: 'result', part: 'dev', managed: true, from_axis: null, outcomes: ['dev_cost'], note: '', how: { dev_cost: '재설계를 안 한다' } },
  { key: 'test_leadtime', label: '시험 리드타임', domain: '개발', tier: 'result', part: 'dev', managed: true, from_axis: null, outcomes: ['dev_time'], note: '', how: { dev_time: '임계 경로가 준다' } },
  { key: 'line_loss', label: '라인 유실율', domain: '제조', tier: 'result', part: 'mfg', managed: true, from_axis: null, outcomes: ['mfg_cost'], note: '', how: { mfg_cost: '멈춘 시간이 준다' } },
  // ⚠️ 거쳐 가는 KPI — 성과에 직접 안 닿고 라인 유실율을 거친다
  { key: 'mttr', label: '평균 복구 시간', domain: '제조', tier: 'result', part: 'mfg', managed: false, from_axis: null, outcomes: [], note: '', leads_to: { line_loss: '정지 시간 단축' } },
  { key: 'design_ve', label: '설계 원가절감률', domain: '개발', tier: 'result', part: 'dev', managed: false, from_axis: null, outcomes: ['material'], note: '', how: { material: '사양 하향에 의한 원가 절감' } },
];
const IND = (o) => ({
  levels: [{ key: 'a', label: '아래' }, { key: 'b', label: '유효' }],
  level_index: 1, level_label: '유효', metric: ['무엇'], why: '왜 조사하는지', gate_why: '왜 그 수준인지',
  deps: [], derived_label: null, acts_on: [], needs: [], fed_by: [],
  ...o,
});
const DATA = {
  sectors: [
    { key: 'sim', part: 'dev', label: '시뮬레이션', purpose: '해석으로 대체한다.',
      indicators: [
        IND({ axis: 'accuracy', axis_label: '정확도', role: 'prereq', role_label: '선행',
          change: '시험 없이 판정', derived_label: '가상검증률',
          acts_on: [{ key: 'design', band: 'development', label: '설계', how: '설계 판정 근거 제공' }],
          fed_by: [{ key: 'test', band: 'development', label: '시험·검증', how: '실측 대조' }],
          kpi: [{ key: 'otp', label: 'One Time Pass', tier: 'result', how: 'One Time Pass 로 이어진다' },
            { key: 'design_ve', label: '설계 원가절감률', tier: 'result', how: '마진 축소분의 사양 반영' }],
          outcomes: [] }),
        IND({ axis: 'substitution', axis_label: '시험 대체', role: 'driver', role_label: '동인',
          change: '시험이 일정에서 빠진다', level_label: '인증 게이트',
          // 정확도와 자동화가 **둘 다** 서야 대체가 된다
          deps: [{ key: 'accuracy', label: '정확도', how: '정확도 가 먼저다' }, { key: 'automation', label: '자동화', how: '자동화 가 먼저다' }],
          acts_on: [{ key: 'test', band: 'development', label: '시험·검증', how: '실물 시험의 해석 대체' }],
          kpi: [{ key: 'test_leadtime', label: '시험 리드타임', tier: 'result', how: '시험 리드타임 로 이어진다' }],
          outcomes: [{ key: 'dev_cost', label: '개발비용', how: '개발비용 이 준다' }, { key: 'dev_time', label: '개발시간', how: '개발시간 이 준다' }] }),
        IND({ axis: 'automation', axis_label: '자동화', role: 'driver', role_label: '동인',
          change: '사람 없이 돈다', deps: [{ key: 'accuracy', label: '정확도', how: '정확도 가 먼저다' }],
          acts_on: [{ key: 'test', band: 'development', label: '시험·검증', how: '검증 회전 속도 향상' }],
          kpi: [{ key: 'test_leadtime', label: '시험 리드타임', tier: 'result', how: '시험 리드타임 로 이어진다' }],
          outcomes: [{ key: 'dev_time', label: '개발시간', how: '개발시간 이 준다' }] }),
      ] },
    { key: 'mon', part: 'mfg', label: '모니터링', purpose: '이상을 먼저 잡는다.',
      indicators: [
        IND({ axis: 'basic_metrics', axis_label: '기본 계측', role: 'driver', role_label: '동인',
          change: '원인을 본다', derived_label: '데이터 연결율',
          kpi: [{ key: 'line_loss', label: '라인 유실율', tier: 'result', how: '라인 유실율 로 이어진다' }],
          outcomes: [{ key: 'mfg_cost', label: '제조비용', how: '제조비용 이 준다' }] }),
        IND({ axis: 'judgement', axis_label: '판단 수준', role: 'driver', role_label: '동인',
          change: '시스템이 판정', deps: [{ key: 'basic_metrics', label: '기본 계측', how: '기본 계측 가 먼저다' }],
          acts_on: [{ key: 'production', band: 'manufacturing', label: '양산', how: '이상의 자동 판정' }],
          needs: [{ sector: 'sim', axis: 'accuracy', sector_label: '시뮬레이션', label: '정확도', how: '판정 모델의 정확도' }],
          kpi: [{ key: 'mttr', label: '평균 복구 시간', tier: 'result', how: '복구가 빨라진다' }],
          outcomes: [{ key: 'mfg_cost', label: '제조비용', how: '제조비용 이 준다' }],
          // 신규 성과 — 대응 KPI 가 없어 지표에서 바로 간다
          new_outcomes: [{ key: 'new_biz', label: '신사업·서비스 확장', how: '신사업·서비스 확장 이 준다' }] }),
      ] },
  ],
  // ⚠️ 아직 안 연 부문의 **초안** 지표 — 다른 부문과 **같은 층**(축 단위)으로
  //    서야 견줄 수 있다. 부문마다 칸 하나씩이면 층이 안 맞는다.
  draft_sectors: [
    { key: 'fac', part: 'mfg', label: '공장 최적화', draft: true, purpose: '같은 설비로 더 만든다.',
      indicators: [
        IND({ axis: 'line_model', axis_label: '공정 모델', role: 'prereq', role_label: '선행',
          change: '라인 거동의 사전 모사', draft: true, level_label: null, levels: [], level_index: null,
          kpi: [{ key: 'line_loss', label: '라인 유실율', tier: 'result', how: '개선안의 사전 검증' }],
          outcomes: [] }),
        IND({ axis: 'balancing', axis_label: '라인 편성', role: 'driver', role_label: '동인',
          change: '공정별 부하의 균형 배분', draft: true, level_label: null, levels: [], level_index: null,
          deps: [{ key: 'line_model', label: '공정 모델', how: '라인 거동 예측 확보' }],
          acts_on: [{ key: 'line_build', band: 'manufacturing', label: '라인 구축', how: '배치 사전 결정' }],
          kpi: [{ key: 'line_loss', label: '라인 유실율', tier: 'result', how: '병목 해소' }],
          outcomes: [{ key: 'mfg_cost', label: '제조비용', how: '산출 증대' }] }),
      ] },
  ],
  // ⚠️ 개발·제조의 업무 요소 — 디지털 트윈 **밖**이다. 지표가 여기에 **작용**하고,
  //    이 요소 자체도 KPI 를 민다(디지털 트윈과 무관한 경로). 둘 다 보여야 몫이 읽힌다.
  value_chain: {
    development: { label: '개발 부문', elements: [
      { key: 'design', label: '설계', kind: 'step', next: 'test', note: '도면 확정',
        kpi: [{ key: 'otp', label: 'One Time Pass', how: '설계 완성도' }] },
      { key: 'test', label: '시험·검증', kind: 'step', next: null, note: '합부 판정',
        kpi: [{ key: 'test_leadtime', label: '시험 리드타임', how: '시험 기간 확정' }] },
      { key: 'test_infra', label: '시험 설비·인력', kind: 'lever', next: null, note: '설비 용량',
        kpi: [{ key: 'test_leadtime', label: '시험 리드타임', how: '착수 대기 해소' }] },
    ] },
    manufacturing: { label: '제조 부문', elements: [
      { key: 'line_build', label: '라인 구축', kind: 'step', next: 'production', note: '설비 설치',
        kpi: [{ key: 'line_loss', label: '라인 유실율', how: '설비 사양 신뢰성' }] },
      { key: 'production', label: '양산', kind: 'step', next: null, note: '생산 운영',
        kpi: [{ key: 'line_loss', label: '라인 유실율', how: '운영 중 손실' }] },
      { key: 'workforce', label: '작업자 숙련', kind: 'lever', next: null, note: '교육',
        kpi: [{ key: 'mttr', label: '평균 복구 시간', how: '숙련도' }] },
    ] },
  },
  focus_areas: [
    { key: 'sim', label: '시뮬레이션', open: true, defined: true, indicator_count: 3, role: 'r', kpi: [] },
    { key: 'mon', label: '모니터링', open: true, defined: true, indicator_count: 2, role: 'r', kpi: [] },
    { key: 'fac', label: '공장 최적화', open: false, defined: false, indicator_count: 0, role: 'r',
      kpi: [{ key: 'line_loss', label: '라인 유실율', tier: 'result', how: '라인 유실율 로 이어진다' }] },
  ],
  /* status — current 는 뚜렷하게, new 는 회색으로. new 는 **대응 KPI 가 없다.** */
  outcomes: [
    { key: 'dev_cost', label: '개발비용', status: 'current', lever: '해석으로 대체' },
    { key: 'dev_time', label: '개발시간', status: 'current', lever: '기간 단축',
      // 개발시간 단축의 값어치는 셋으로 갈라진다 — 셋째가 사업 확대로 가는 고리다
      branches: [
        { label: '인건비 절감', to: null, note: '투입 기간이 준다 — 가장 작다' },
        { label: '조기 출시 매출', to: null, note: '같은 제품이 먼저 팔린다' },
        { label: '개발 여력', to: 'new_biz', note: '더 많은 과제를 소화한다 — 신사업에 투입된다' },
      ] },
    { key: 'mfg_cost', label: '제조비용', status: 'current', lever: '조기 대응' },
    // ⚠️ 새로 짚는 성과지만 **재는 지표가 있다** — 점선으로 가면 안 된다.
    //    지금 실제 체계에는 이런 성과가 없지만, 규칙을 지키려고 여기서 만들어 둔다.
    { key: 'material', label: '재료비', status: 'new', lever: '사양 하향' },
    // stage: 'growth' — 더 버는 성과는 덜 쓰는 성과보다 **뒤 단계**다
    { key: 'new_biz', label: '신사업·서비스 확장', status: 'new', stage: 'growth',
      lever: '새 영역 진입' },
  ],
  kpis: KPIS,
  kpi_tiers: { derived: { label: '집계 지표' }, result: { label: '성과형 KPI' } },
  gaps: [
    { no: '1', title: '역량이 지표 하나로 대변된다',
      example: '가상검증률 = 여러 시뮬레이션 「정확도」의 평균',
      problem: '자동화·대체 범위는 안 잡힌다.', answer: '역량을 여러 지표로 나눈다.' },
    { no: '2', title: '나뉜 지표가 어느 성과에 닿는지가 없다',
      example: '역량 지표 1개 : 성과형 KPI 5개',
      problem: '하나가 다섯을 설명할 수 없다.', answer: '지표마다 KPI 와 비용을 못박는다.' },
  ],
  roles: { prereq: { label: '선행', definition: '없으면 성과로 안 간다.' },
    driver: { label: '동인', definition: '성과를 직접 민다.' },
    multiplier: { label: '확산', definition: '퍼지는 범위를 정한다.' } },
  caveats: ['본 자료는 **측정 체계** — 성과 실적이 아님. 실제 수준은 「성숙도」 탭 참조.',
    '「측정 지표」 대부분은 **집계 체계 미구축**.'],
};

export default async function run() {
  const { say, done } = suite();
  const calls = fakeFetch(({ url }) => (url.includes('/overview') ? DATA : {}));
  try {
    await render(<OverviewView />);
    await settle(60);

    // ① 부문을 안 묻는다
    const call = calls.find(c => c.url.includes('/overview'));
    say(!!call && !call.url.includes('sector='), `① 부문 없이 부른다: ${call?.url}`);
    let text = document.body.textContent;

    // ② 절은 넷뿐 — 더 늘리면 안 읽힌다
    const heads = [...document.querySelectorAll('h3')].map(x => x.textContent.trim());
    say(JSON.stringify(heads) === JSON.stringify(['지금 문제', '이 조사', '지표', '전제']),
        `② 절이 넷: ${heads}`);

    // ③ 1절 — 문제를 그림 하나로
    // 1절은 문장형이다 — 그림 대신 말로 짚는다(2026-08-31)
    say(text.includes('가상검증률은 시뮬레이션별 「정확도」의 평균'), '③ 가상검증률의 정체');
    say(text.includes('지표 하나') && text.includes('대변'), '③ 역량이 하나로 대변된다');
    say(text.includes('현행 체계에 미반영'), '③ 나머지 역량이 빠져 있다');
    say(text.includes('정의 자체가 부재') && text.includes('성과 후보로 제안'), '③ 새로 짚는 성과는 아직 후보다');
    // KPI 수는 실제 수를 센다 — 고정물의 성과형 KPI 는 다섯이다
    say(text.includes('성과형 KPI 5개'), '③ 성과형 KPI 수를 데이터에서 센다');
    // ⚠️ 임원 보고용 — 서술형 종결·구어 표현이 없어야 한다(2026-09-01 요청)
    ['덧붙여', '셈에 들어간다', '작용한다', '갈라진다', '대변된다', '없앤다', '줄인다']
      .forEach(w => say(!text.includes(w), `③ 구어·서술형 표현이 없다: ${w}`));
    // 개발시간의 세 갈래 — 인건비만 세면 가장 작은 갈래만 보는 셈이다
    say(text.includes('세 갈래'), '③ 개발시간의 세 갈래');
    ['인건비 절감', '조기 출시 매출', '개발 여력'].forEach(b => {
      say(text.includes(b), `③ 갈래 「${b}」`);
    });
    say(text.includes('재원'), '③ 기간 단축은 원가가 아니라 재원이다');
    say(!text.includes('역량형'), '③ 「역량형 KPI」라는 없는 계층을 안 만든다');

    // ④ 2절 — 분야마다 한 줄
    // 2절은 순서도다 — 지표·KPI·성과가 단으로 선다
    say(document.querySelector('.react-flow') != null, '④ 순서도가 선다');
    say(text.includes('정확도') && text.includes('시험 대체') && text.includes('판단 수준'),
        '④ 지표 단');
    say(text.includes('시험 리드타임') && text.includes('라인 유실율'), '④ KPI 단');
    // ⚠️ 집계 지표에 칸을 따로 주면 같은 것이 둘로 보인다 — 원본 축에 병기한다
    const boxes = [...document.querySelectorAll('.react-flow__node')]
      .map(n => n.textContent.trim());
    say(boxes.some(t => t.startsWith('정확도 (가상검증률)')), `④ 정확도에 병기: ${boxes[0]}`);
    say(boxes.some(t => t.startsWith('기본 계측 (데이터 연결율)')), '④ 기본 계측에 병기');
    say(!boxes.some(t => t.startsWith('가상검증률') || t.startsWith('데이터 연결율')),
        '④ 집계 지표는 별도 칸이 없다');
    say(!boxes.some(t => t.includes('의 평균')), '④ 「oo 의 평균」이라는 군더더기가 없다');
    // ⚠️ jsdom 은 칸의 크기를 안 재서 reactflow 가 선을 그리지 않는다 —
    //    그래프를 짜는 부분을 따로 불러 선 자체를 본다.
    const { edges } = buildChain({ sectors: DATA.sectors, kpis: KPIS, outcomes: DATA.outcomes,
      drafts: DATA.draft_sectors, chain: DATA.value_chain });
    const eid = new Set(edges.map(e => e.id));
    const dash = e => (e.style.strokeDasharray || '') !== '';
    // 정확도·자동화가 **둘 다** 서야 시험 대체가 된다
    say(eid.has('d:sim:accuracy:substitution') && eid.has('d:sim:automation:substitution'),
    `④ 선행이 둘 다 그려진다: ${[...eid].filter(i => i.startsWith('d:')).join()}`);
    say(eid.has('d:sim:accuracy:automation') && eid.has('d:mon:basic_metrics:judgement'),
        '④ 부문마다 선행이 잡힌다');
    say(eid.has('e:sim:substitution:test_leadtime') && eid.has('e:k:test_leadtime:dev_time'),
        '④ 지표 ▶ KPI ▶ 성과');
    say(eid.has('n:mon:judgement:new_biz')
        && dash(edges.find(e => e.id === 'n:mon:judgement:new_biz')),
    '④ 신규 성과는 점선으로 KPI 를 건너뛴다');
    // 집계 지표로 가는 선은 없다 — 칸 자체가 없으니까
    say(!edges.some(e => e.target === 'k:virtual_rate' || e.target === 'k:data_link'),
        '④ 집계 지표로 가는 선이 없다');
    // 선행이 가로 자리를 정한다 — 정확도는 맨 왼쪽, 시험 대체는 그 오른쪽
    const built = buildChain({ sectors: DATA.sectors, kpis: KPIS, outcomes: DATA.outcomes,
      drafts: DATA.draft_sectors, chain: DATA.value_chain });
    const at = Object.fromEntries(built.nodes.map(n => [n.id, n.position]));
    const px = Object.fromEntries(built.nodes.map(n => [n.id, n.position.x]));

    // ⚠️ 아직 안 연 분야도 **자리만** 세운다 — 빼 버리면 조사 범위가 좁아 보이고,
    //    실선으로 이으면 없는 근거를 있다고 말하는 셈이 된다.
    // ⚠️ 초안은 **축 단위**로 선다 — 부문마다 칸 하나씩이면 다른 지표와 층이 안 맞는다
    const dr = built.nodes.filter(n => n.id.startsWith('i:fac:') && n.data.kind === 'todo');
    say(dr.length === 2, `④ 초안도 축마다 칸이 선다: ${dr.length}`);
    say(dr[0].data.sub.includes('초안'), `④ 칸이 초안임을 밝힌다: ${dr[0].data.sub}`);
    say(dr[0].data.tip.sub.includes('축·수준 미정의'), '④ 요약이 아직 정의 안 됐다고 적는다');
    // 선행도 같은 방식으로 잡히고, 가로 자리도 그것으로 정해진다
    say(eid.has('d:fac:line_model:balancing'), '④ 초안 안에서도 선행이 이어진다');
    const dx = Object.fromEntries(dr.map(n => [n.id, n.position.x]));
    say(dx['i:fac:balancing'] > dx['i:fac:line_model'], '④ 초안도 선행이 가로 자리를 정한다');
    // 초안에서 나가는 선은 전부 점점선 — 근거가 아니라 제안이다
    const dEdges = edges.filter(e => e.id.includes(':fac:') && !e.id.includes('capex_people'));
    say(dEdges.length > 0 && dEdges.every(e => e.style.strokeDasharray === '2 4'),
    `④ 초안의 선은 잠게 끊어져 「대응 KPI 없음」 점선과 구분된다: ${dEdges.length}`);
    say(eid.has('e:fac:balancing:line_loss'), '④ 초안도 KPI 로 이어진다');

    // ⚠️ 세 띠 — 위에서 아래로 개발 · 디지털 트윈 · 제조. 디지털 트윈이 어느 업무를
    //    바꿔 어느 성과에 닿는지, 그 성과를 디지털 트윈 말고 무엇이 또 움직이는지가 읽혀야 한다.
    const yOf = id => built.nodes.find(n => n.id === id).position.y;
    say(yOf('band:development') < yOf('band:dt') && yOf('band:dt') < yOf('band:manufacturing'),
        '④ 띠가 위에서 아래로 개발 · 디지털 트윈 · 제조다');
    const dtYs = built.nodes.filter(n => n.id.startsWith('i:')).map(n => n.position.y);
    say(yOf('b:design') < Math.min(...dtYs) && yOf('b:production') > Math.max(...dtYs),
        '④ 개발 업무는 지표 위, 제조 업무는 지표 아래에 선다');
    // 업무 단계는 디지털 트윈 띠 쪽에 붙고, 기반 요소는 바깥쪽에 선다
    say(yOf('b:design') > yOf('b:test_infra') && yOf('b:production') < yOf('b:workforce'),
        '④ 단계가 안쪽, 기반 요소가 바깥쪽이다');
    // 밖의 요소 — 단계와 기반 요소가 다르게 그려진다
    const st = built.nodes.find(n => n.id === 'b:design');
    const lv = built.nodes.find(n => n.id === 'b:test_infra');
    say(st.data.kind === 'step' && lv.data.kind === 'lever', '④ 단계와 기반 요소가 갈린다');
    say(st.data.sub.includes('디지털 트윈 밖') && lv.data.sub.includes('디지털 트윈 밖'),
        '④ 둘 다 밖이라고 적힌다');
    say(lv.data.tip.rows.some(r => r.k === '작용하는 DT 지표' && r.v.includes('대체 불가')),
        '④ 기반 요소 요약이 디지털 트윈이 못 하는 몫임을 적는다');
    // 지표 ─▶ 업무: 디지털 트윈의 **작용**. 위 띠로는 위 손잡이, 아래 띠로는 아래 손잡이.
    const up = edges.find(e => e.id === 'a:sim:substitution:test');
    say(!!up && up.sourceHandle === 'st' && up.targetHandle === 'tb' && up.style.stroke === '#60a5fa',
        '④ 지표가 개발 업무로 위로 작용한다');
    const dn = edges.find(e => e.id === 'a:mon:judgement:production');
    say(!!dn && dn.sourceHandle === 'sb' && dn.targetHandle === 'tt', '④ 지표가 제조 업무로 아래로 작용한다');
    say(up.data.how === '실물 시험의 해석 대체', `④ 작용 선에 역할이 적힌다: ${up.data.how}`);
    const ad = edges.find(e => e.id === 'a:fac:balancing:line_build');
    say(!!ad && ad.style.strokeDasharray === '2 4', '④ 초안의 작용 선은 점점선이다');
    // 업무 ┈▶ KPI: 디지털 트윈 **밖**의 경로 — 이것이 없으면 KPI 가 전부 디지털 트윈 덕으로 보인다
    const ox = edges.find(e => e.id === 'x:test_infra:test_leadtime');
    say(!!ox && ox.style.strokeDasharray === '1 4', '④ 업무 자체가 KPI 를 민다 — 밖의 경로');
    say(eid.has('q:design:test') && eid.has('q:line_build:production'), '④ 업무 단계가 차례로 이어진다');
    // 누락 없이 — 모든 업무 요소가 KPI 로 가고, 모든 단계에 지표가 하나는 작용한다
    const acts = built.nodes.filter(n => n.id.startsWith('b:'));
    say(acts.every(n => edges.some(e => e.source === n.id && e.target.startsWith('k:'))),
        '④ 모든 업무 요소가 KPI 로 간다');
    say(acts.filter(n => n.data.kind === 'step')
      .every(n => edges.some(e => e.target === n.id && e.id.startsWith('a:'))),
    '④ 모든 업무 단계에 디지털 트윈이 작용한다');
    say(built.nodes.filter(n => n.type === 'band').every(n => !n.data.tip), '④ 띠에는 요약이 없다');

    // ⚠️ 시뮬레이션으로 **들어오는** 선 — 업무 → 지표 입력, 부문 간 선행(2026-09-01)
    const tipX = id => built.nodes.find(n => n.id === id).data.tip;   // tipOf 는 아래에서 선언된다
    const fe = edges.find(e => e.id === 'f:test:sim:accuracy');
    say(!!fe && fe.source === 'b:test' && fe.target === 'i:sim:accuracy' && fe.style.stroke === '#94a3b8'
        && fe.sourceHandle === 'sb' && fe.targetHandle === 'tt',
    '④ 업무가 지표의 입력이 되는 선이 위에서 아래로 그려진다');
    say(fe.data.how === '실측 대조', '④ 입력 선에도 설명이 붙는다');
    const ne = edges.find(e => e.id === 'w:sim:accuracy:mon:judgement');
    say(!!ne && ne.source === 'i:sim:accuracy' && ne.target === 'i:mon:judgement' && ne.sourceHandle === 'sb',
        '④ 부문 간 선행이 위 부문에서 아래 부문으로 그려진다');
    say(tipX('i:sim:accuracy').rows.some(r => r.k === '입력 업무' && r.v === '시험·검증')
        && tipX('i:mon:judgement').rows.some(r => r.k === '타 부문 선행' && r.v === '시뮬레이션 · 정확도'),
    '④ 요약이 입력 업무와 타 부문 선행을 적는다');
    say(tipX('b:test').rows.some(r => r.k === '입력을 주는 지표' && r.v === '정확도'), '④ 업무 요약이 어느 지표의 입력인지 적는다');
    say(text.includes('업무 → 지표 입력'), '④ 범례가 입력 선을 적는다');

    // ⚠️ 같은 줄의 가로 선은 차선으로 돌린다 — 같은 칸으로 모이는 두 선이 포개지지 않고,
    //    먼 칸에서 오는 선이 중간 칸을 뚫지 않는다(2026-09-01 지적).
    const e1 = edges.find(e => e.id === 'd:sim:accuracy:substitution');
    const e2 = edges.find(e => e.id === 'd:sim:automation:substitution');
    // 정확도 → 시험 대체는 제 줄의 자동화를 뚫고 가야 하므로 차선으로 비킨다. 이웃한 자동화 → 시험 대체는 안 비킨다.
    say(!!e1.data.lane && !e2.data.lane, `④ 가로막는 칸이 있는 선만 차선을 탄다: ${e1.data.lane} / ${e2.data.lane}`);
    say(Math.abs(e1.data.lane) >= 30 && Math.abs(e1.data.lane) < 90 - 24,
        '④ 차선이 줄 사이 틈 안에 있다 — 칸도 다음 줄도 안 건드린다');
    // ⚠️ 옆으로 들어갈 때도 같은 병이었다 — 같은 칸으로 모이는 선은 꺾는 자리와 들어가는 자리가 달라야 한다
    say(!!e1.data.hroute && !!e2.data.hroute && e1.data.hroute.bx !== e2.data.hroute.bx
        && e1.data.hroute.ey !== e2.data.hroute.ey,
    `④ 같은 칸으로 모이는 가로 선은 꺾는 자리·들어가는 자리가 다르다: ${JSON.stringify(e1.data.hroute)} / ${JSON.stringify(e2.data.hroute)}`);
    say(Math.abs(e1.data.hroute.bx - e2.data.hroute.bx) >= 8 && Math.abs(e1.data.hroute.ey - e2.data.hroute.ey) >= 8,
        '④ 눈으로 갈릴 만큼 벌어져 있다');
    // 먼 데서 오는 선이 목적지에 가까운 꺾는 자리를 받는다 — 그래야 서로 가로지르지 않는다
    say(e1.data.hroute.bx > e2.data.hroute.bx, '④ 차선을 타고 멀리서 온 선이 목적지 쪽에서 꺾인다');
    // 들어가는 자리는 칸의 변 안쪽이다
    const tY = at['i:sim:substitution'].y;
    say([e1, e2].every(e => e.data.hroute.ey > tY + 4 && e.data.hroute.ey < tY + 48 - 4), '④ 들어가는 자리가 칸 변 안에 있다');
    // 여러 줄에서 한 KPI 로 모이는 선들 — 들어가는 자리가 전부 다르다
    const intoOtp = edges.filter(e => e.target === 'k:otp' && e.data.hroute);
    say(intoOtp.length >= 2 && new Set(intoOtp.map(e => e.data.hroute.ey)).size === intoOtp.length,
        `④ One Time Pass로 모이는 ${intoOtp.length}선이 제각기 다른 자리로 들어간다`);
    // ⚠️ 들어가는 자리는 출발 줄 순이다 — 위 줄에서 온 선이 아래 자리로 들어가면 목적지 앞에서 엇갈린다
    const crossed = Object.values(edges.filter(e => e.data.hroute).reduce((m, e) => { (m[e.target] = m[e.target] || []).push(e); return m; }, {}))
      .flatMap(g => g.flatMap(a => g.filter(b => a !== b && a.data.geo.sy < b.data.geo.sy - 1 && a.data.hroute.ey > b.data.hroute.ey)))
      .map(e => e.id);
    say(crossed.length === 0, `④ 위에서 온 선은 위 자리로 들어간다(엇갈림 없음): ${crossed.join(' ') || '없음'}`);
    // 차선은 목적지 쪽으로 — 아래 목적지로 가는 선이 위 차선을 타지 않는다
    // 목적지 쪽이 전부 막혀 어쩔 수 없이 반대로 간 것(laneForced)만 예외다
    const wrongSide = edges.filter(e => e.data.lane && !e.data.laneForced && Math.abs(e.data.geo.ty - e.data.geo.sy) > 1
      && Math.sign(e.data.lane) !== Math.sign(e.data.geo.ty - e.data.geo.sy)).map(e => e.id);
    say(wrongSide.length === 0, `④ 차선은 목적지 쪽으로 난다: ${wrongSide.join(' ') || '없음'}`);
    // 가로 선이 제 줄의 다른 칸을 뚫지 않는다 — 달리는 구간이 어떤 칸도 안 지난다
    const rectsAll = built.nodes.filter(n => n.type !== 'band')
      .map(n => ({ id: n.id, x: n.position.x, y: n.position.y, w: n.style.width, h: 48 }));
    const pierced = edges.filter(e => e.data.hroute).filter((e) => {
      const { runY, bx } = e.data.hroute; const x0 = e.data.geo.sx + 1;
      return rectsAll.some(r => r.id !== e.source && r.id !== e.target
        && r.y < runY && runY < r.y + r.h && r.x < bx && x0 < r.x + r.w);
    }).map(e => e.id);
    say(pierced.length === 0, `④ 가로 선이 칸을 뚫지 않는다: ${pierced.join(' ') || '없음'}`);
    say(!edges.find(e => e.id === 'a:sim:substitution:test').data.hroute, '④ 세로 선은 가로 길을 안 탄다');
    // ⚠️ 같은 업무 칸으로 모이는 세로 선 — 꾸이는 높이와 들어가는 자리가 선마다 달라야 한다.
    //    같으면 마지막 세로 구간과 가로 구간이 통째로 포개진다(2026-09-01 지적).
    const v1 = edges.find(e => e.id === 'a:sim:automation:test').data.vlane;
    const v2 = edges.find(e => e.id === 'a:sim:substitution:test').data.vlane;
    say(!!v1 && !!v2 && v1.tdx !== v2.tdx && v1.dy !== v2.dy,
        `④ 같은 칸으로 가는 세로 선은 꾸이는 높이·들어가는 자리가 다르다: ${JSON.stringify(v1)} / ${JSON.stringify(v2)}`);
    say(Math.abs(v1.dy - v2.dy) >= 8 && Math.abs(v1.tdx - v2.tdx) >= 12, '④ 눈으로 갈릴 만큼 벌어져 있다');
    // ⚠️ 한 칸의 **같은 변**에서 나가는 선과 들어오는 선은 자리가 달라야 한다 — 정확도의 위 변에는
    //    설계로 나가는 작용 선과 시험·검증에서 들어오는 입력 선이 함께 닿는다(2026-09-01 지적).
    const outA = edges.find(e => e.id === 'a:sim:accuracy:design');
    const inA = edges.find(e => e.id === 'f:test:sim:accuracy');
    say(!!outA && !!inA && Math.abs((outA.data.vlane.sdx || 0) - (inA.data.vlane.tdx || 0)) >= 12,
        `④ 같은 변의 나가는 선·들어오는 선이 다른 자리를 쓴다: ${outA?.data.vlane.sdx} / ${inA?.data.vlane.tdx}`);
    say(Math.abs(outA.data.vlane.dy - inA.data.vlane.dy) >= 8, '④ 그 둘의 가로 구간 높이도 다르다');
    // 먼 데서 오는 선이 목적지에 가까운 높이를 받는다 — 그래야 서로 가로지르지 않는다
    const far = at['i:sim:automation'].x < at['i:sim:substitution'].x ? v1 : v2;   // 시험·검증은 오른쪽 위에 있다
    const near = far === v1 ? v2 : v1;
    const tX = at['b:test'].x; const fx = Math.min(at['i:sim:automation'].x, at['i:sim:substitution'].x);
    say(tX > fx ? far.dy < near.dy : true, '④ 먼 선이 목적지 쪽 높이를 받는다(위로 갈 때 dy 가 작다)');
    // ⚠️ 설명은 칸과 다른 설명을 피해 앉는다 — 어느 칸을 고르든
    const rectsOf = g => g.nodes.filter(n => n.type !== 'band')
      .map(n => ({ x: n.position.x, y: n.position.y, w: n.style.width, h: 48 }));
    const overlap = (a, b) => !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
    const bad = [];
    ['i:sim:substitution', 'k:test_leadtime', 'k:line_loss', 'b:design', 'o:dev_time'].forEach((id) => {
      const f2 = focusOf(edges, id);
      const sh = placeLabels(built.nodes, edges, f2.edges);
      const rects = rectsOf(built);
      const labels = [];
      edges.filter(e => f2.edges.has(e.id)).forEach((e) => {
        const w = Math.min(200, e.data.how.length * 7.4 + 22); const h = 28;
        const a = sh[e.id] || e.data.mid;
        const r = { x: a.x - w / 2, y: a.y - h / 2, w, h };
        if (rects.some(o => overlap(r, o))) bad.push(`${id}:${e.id}:칸`);
        if (labels.some(o => overlap(r, o))) bad.push(`${id}:${e.id}:설명`);
        labels.push(r);
      });
    });
    say(bad.length === 0, `④ 설명이 칸이나 다른 설명을 덮지 않는다: ${bad.join(' ') || '없음'}`);

    // ⚠️ 토글 — 입력을 잘라 다시 배치한다. KPI·성과는 들어오는 선이 없어지면 덩달아 빠진다.
    const cut = tg => buildChain({ outcomes: DATA.outcomes,
      ...sliceChain({ sectors: DATA.sectors, drafts: DATA.draft_sectors, chain: DATA.value_chain, kpis: KPIS },
        { dev: true, mfg: true, link: true, dt: true, outside: true, ...tg }) });
    const has = (g, id) => g.nodes.some(n => n.id === id);
    const noDev = cut({ dev: false });
    say(!has(noDev, 'i:sim:accuracy') && !has(noDev, 'b:design') && !has(noDev, 'band:development'),
        '④ 개발을 끄면 개발 지표·업무·띠가 빠진다');
    say(!has(noDev, 'k:otp') && !has(noDev, 'o:dev_cost') && !has(noDev, 'br:dev_time:0'),
        '④ 앞이 비면 개발 KPI·성과·갈래도 빠진다');
    say(has(noDev, 'i:mon:judgement') && has(noDev, 'k:line_loss') && has(noDev, 'o:mfg_cost'),
        '④ 제조 쪽은 그대로 남는다');
    // ⚠️ 개발만 켜면 제조 KPI 는 안 딸려온다 — 개발 업무가 밀더라도 소속이 제조면 뺀다
    const devOnly = cut({ mfg: false, link: false });
    say(!has(devOnly, 'k:line_loss') && !has(devOnly, 'k:mttr') && has(devOnly, 'k:otp'),
        '④ 개발만 켜면 제조 KPI 가 빠진다');
    // 차례 — 데이터의 차례 그대로. 도메인으로 다시 줄 세우지 않는다.
    const kys = built.nodes.filter(n => n.id.startsWith('k:')).sort((a, b) => a.position.y - b.position.y).map(n => n.id);
    say(kys.join() === ['k:otp', 'k:test_leadtime', 'k:line_loss', 'k:mttr', 'k:design_ve'].join(),
        `④ KPI 세로 차례는 데이터 차례다: ${kys.join()}`);
    // 현행 관리 KPI 는 황색(집계 지표와 같은 색), 새로 제안한 것은 남색
    say(built.nodes.find(n => n.id === 'k:otp').data.kind === 'kpi_now'
        && built.nodes.find(n => n.id === 'k:mttr').data.kind === 'kpi',
    '④ 현행 관리 KPI 와 신규 제안 KPI 의 색이 갈린다');
    const tipK = id => built.nodes.find(n => n.id === id).data.tip;   // tipOf 는 아래에서 선언된다
    say(tipK('k:otp').sub.includes('현행 관리 KPI') && tipK('k:mttr').sub.includes('신규 제안 KPI'),
        '④ 요약이 현행·신규를 적는다');
    say(noDev.nodes.find(n => n.id === 'band:dt').position.y < 20, '④ 빈 띠 자리가 남지 않고 당겨진다');
    const noDt = cut({ dt: false });
    say(!noDt.nodes.some(n => n.id.startsWith('i:')) && !has(noDt, 'band:dt'), '④ 디지털 트윈을 끄면 지표·띠가 빠진다');
    say(has(noDt, 'k:line_loss') && has(noDt, 'k:test_leadtime'),
        '④ 디지털 트윈 없이도 업무가 미는 KPI 는 남는다 — 밖의 경로');
    const noOut = cut({ outside: false });
    say(!noOut.nodes.some(n => n.id.startsWith('b:')) && !has(noOut, 'band:development') && has(noOut, 'band:dt'),
        '④ 디지털 트윈 외를 끄면 업무 띠만 빠진다');
    say(!cut({ dev: false, mfg: false, link: false }).nodes.some(n => n.id.startsWith('i:')),
        '④ 셋을 다 끄면 지표가 하나도 없다');
    // ⚠️ 무엇을 끄든 자리가 어긋나면 안 된다 — 겹침·구멍·치우침 셋을 본다(2026-09-01 지적)
    const right = (g, pre) => Math.max(...g.nodes.filter(n => n.id.startsWith(pre))
      .map(n => n.position.x + (n.style.width || 0)), -1);
    const left = (g, pre) => Math.min(...g.nodes.filter(n => n.id.startsWith(pre)).map(n => n.position.x));
    [{ tg: { dt: false }, why: '디지털 트윈을 끄면' }, { tg: { mfg: false, link: false }, why: '개발만 남기면' },
      { tg: { outside: false }, why: '업무를 끄면' }, { tg: {}, why: '다 켜도' }].forEach(({ tg, why }) => {
      const g = cut(tg);
      say(left(g, 'k:') > right(g, 'b:') && left(g, 'k:') > right(g, 'i:'),
          `④ ${why} KPI 열이 지표·업무 오른쪽에 선다: ${right(g, 'b:')}/${right(g, 'i:')} < ${left(g, 'k:')}`);
      // 남은 KPI 는 구멍 없이 같은 간격으로 선다
      const ys = g.nodes.filter(n => n.id.startsWith('k:')).map(n => n.position.y).sort((p, q) => p - q);
      say(ys.every((v, i) => i === 0 || Math.abs(v - ys[i - 1] - 100) < 0.5),
          `④ ${why} KPI 사이에 구멍이 없다: ${ys.join()}`);
      // 띠 묶음과 KPI 열의 세로 중심이 맞는다
      const bandNs = g.nodes.filter(n => n.type === 'band');
      if (bandNs.length && ys.length) {
        const bTop = Math.min(...bandNs.map(n => n.position.y));
        const bBot = Math.max(...bandNs.map(n => n.position.y + n.style.height));
        const kMid = (ys[0] + ys[ys.length - 1]) / 2;
        say(Math.abs((bTop + bBot) / 2 - kMid) < 60,
            `④ ${why} 띠와 KPI 열이 세로로 가운데 맞는다: ${(bTop + bBot) / 2} ≈ ${kMid}`);
      }
      say(g.nodes.every(n => n.position.y >= -12), `④ ${why} 위로 삐져나가는 칸이 없다`);
    });
    // 화면의 단추 — 누르면 실제로 빠진다
    const chip = lab => [...document.querySelectorAll('button')]
      .find(b => b.textContent.trim() === lab && b.hasAttribute('aria-pressed'));
    say(['개발', '제조', '연계', '디지털 트윈', '디지털 트윈 외'].every(l => chip(l)?.getAttribute('aria-pressed') === 'true'),
        '④ 토글 다섯이 켜진 채로 선다');
    const before = document.querySelectorAll('.react-flow__node').length;
    await click(chip('제조')); await settle();
    say(chip('제조').getAttribute('aria-pressed') === 'false'
        && document.querySelectorAll('.react-flow__node').length < before, '④ 제조를 끄면 칸이 준다');
    say(![...document.querySelectorAll('.react-flow__node')].some(n => n.textContent.includes('판단 수준')),
        '④ 꺼진 쪽 지표가 화면에서 사라진다');
    await click(chip('제조')); await settle();
    say(document.querySelectorAll('.react-flow__node').length === before, '④ 다시 켜면 돌아온다');
    say(text.includes('디지털 트윈 밖') && text.includes('디지털 트윈의 작용'),
        '④ 범례가 작용과 밖의 경로를 적는다');
    say(px['i:sim:accuracy'] === 0 && px['i:sim:substitution'] > px['i:sim:automation'],
    `④ 선행이 가로 자리를 정한다: ${px['i:sim:accuracy']}<${px['i:sim:automation']}<${px['i:sim:substitution']}`);
    // ⚠️ 칸이 겹쳐 보이면 선을 못 따라간다 — KPI·성과는 들어오는 선이
    //    많아 지표보다 더 벌려야 한다(2026-09-01).
    const gap = (a2, b2) => Math.abs(at[b2].y - at[a2].y);
    say(gap('k:otp', 'k:test_leadtime') >= 90, `④ KPI 사이가 넘넘하다: ${gap('k:otp', 'k:test_leadtime')}`);
    say(gap('o:dev_cost', 'o:dev_time') >= 100,
    `④ 성과 사이가 넘넘하다: ${gap('o:dev_cost', 'o:dev_time')}`);
    say(at['o:dev_cost'].x - at['k:otp'].x >= 250, '④ KPI 와 성과 사이가 벌어져 있다');
    say(at['k:otp'].x - px['i:sim:substitution'] > 265, '④ 지표 끝 단과 KPI 사이도 한 번 더 띄운다');

    // 칸에 마우스를 올리면 그 칸의 내용이 요약된다 — 칸 안에는 이름만 둔다
    const tipOf = id => built.nodes.find(n => n.id === id).data.tip;
    say(built.nodes.filter(n => n.type !== 'band').every(n => n.data.tip && n.data.tip.title && n.data.tip.rows),
        '④ 모든 칸이 요약을 가진다');
    const acc = tipOf('i:sim:accuracy');
    const k = r => (acc.rows.find(x => x.k === r) || {}).v;
    say(acc.sub.includes('시뮬레이션') && acc.sub.includes('선행'), `④ 지표 요약의 머리: ${acc.sub}`);
    say(k('업무 변화') === '시험 없이 판정' && k('측정 지표') === '무엇',
        '④ 지표 요약에 변화·측정이 들어 있다');
    say(k('조사 목적') === '왜 조사하는지', '④ 지표 요약에 근거가 들어 있다');
    // 척도 — 단계 사다리가 한 줄로, 유효 수준은 「」(2026-09-01 요청)
    // 유효 수준 **이상**은 전부 색이 칠해진다 — 유효 수준 자체는 표시(gate)가 따로 붙는다
    say(JSON.stringify(k('척도')) === JSON.stringify([{ label: '아래', on: false, gate: false }, { label: '유효', on: true, gate: true }]),
        `④ 지표 요약에 척도가 단계별로 들어 있다: ${JSON.stringify(k('척도'))}`);
    // 세 단 사다리에서 가운데가 유효면 위도 칠해진다 — 순수 함수라 고정물 하나로 본다
    const three = buildChain({ outcomes: DATA.outcomes, kpis: KPIS,
      sectors: [{ key: 's3', part: 'dev', label: 'x', indicators: [IND({ axis: 'a', axis_label: 'a', role: 'prereq', role_label: '선행',
        change: 'c', levels: [{ key: 'l', label: '낮음' }, { key: 'm', label: '중간' }, { key: 'h', label: '높음' }], level_index: 1, kpi: [] })] }] });
    const rung = three.nodes.find(n => n.id === 'i:s3:a').data.tip.rows.find(r => r.k === '척도').v;
    say(rung.map(b => b.on).join() === 'false,true,true' && rung.map(b => b.gate).join() === 'false,true,false',
        `④ 유효 수준 이상이 전부 칠해진다: ${JSON.stringify(rung)}`);
    say(!tipOf('i:fac:line_model').rows.some(r => r.k === '척도'), '④ 초안(수준 미정의)에는 척도 줄이 없다');
    const sub = tipOf('i:sim:substitution').rows.find(x => x.k === '선행 요건');
    say(sub && sub.v.includes('정확도') && sub.v.includes('자동화'), `④ 요약이 선행을 적는다: ${sub && sub.v}`);
    const neo = tipOf('o:new_biz');
    say(neo.sub.includes('대응 KPI 미정의'), '④ 신규 성과의 요약이 그렇다고 말한다');
    // ⚠️ 갈림길은 status 가 아니라 **재는 지표가 있느냐**다.
    //    재료비는 새로 짚는 성과지만 KPI 가 붙었으니 실선으로 간다.
    const mat = built.nodes.find(n => n.id === 'o:material');
    say(mat.data.sub === undefined, `④ 재는 지표가 있으면 「대응 KPI 미정의」가 안 붙는다: ${mat.data.sub}`);
    say(mat.data.tip.sub.includes('신규 제안 성과')
        && !mat.data.tip.sub.includes('미정의'), '④ 요약은 신규라고만 적는다');
    say(eid.has('e:k:design_ve:material') && !dash(edges.find(e => e.id === 'e:k:design_ve:material')),
        '④ 재료비로 가는 길은 실선이다');
    const dtTip = tipOf('o:dev_time');
    say(dtTip.rows.some(r => r.k === '개발 여력'), '④ 개발시간 요약에 세 갈래가 들어 있다');

    // ⚠️ 1절 글이 말하는 세 갈래가 **그림에도** 서야 한다 —
    //    글과 그림이 어깋나면 둘 중 하나는 거짓말이 된다(2026-09-01).
    const brs = built.nodes.filter(n => n.id.startsWith('br:'));
    say(brs.length === 3, `④ 갈래가 셋 선다: ${brs.length}`);
    say(['인건비 절감', '조기 출시 매출', '개발 여력']
      .every(l => brs.some(n => n.data.label === l)),
    `④ 세 갈래의 이름: ${brs.map(n => n.data.label).join()}`);
    say(brs.every(n => n.position.x > at['o:dev_time'].x), '④ 갈래는 성과 오른쪽에 선다');
    say(brs.filter(n => n.data.kind === 'branch_on').length === 1,
        '④ 다음 성과로 이어지는 갈래만 색이 다르다');
    const on = brs.find(n => n.data.kind === 'branch_on');
    say(on.data.label === '개발 여력' && on.data.sub.includes('재원'),
    `④ 그 갈래는 개발 여력이다: ${on.data.label}/${on.data.sub}`);
    // 성과 ─▶ 갈래 셋, 그리고 개발 여력 ┄▶ 신사업으로 **되돌아간다**
    say(['s:dev_time:0', 's:dev_time:1', 's:dev_time:2'].every(i => eid.has(i)),
        '④ 성과에서 갈래로 선이 간다');
    const back = edges.find(e => e.id === 'b:dev_time:new_biz');
    say(!!back && back.source === on.id && back.target === 'o:new_biz' && dash(back),
        '④ 개발 여력 ┄▶ 신사업');
    say(back.data.how.includes('재원'), `④ 그 선에 기여가 적혀 있다: ${back.data.how}`);
    // 예전처럼 성과에서 바로 가는 선은 없다 — 갈래를 거친다
    say(!edges.some(e => e.source === 'o:dev_time' && e.target === 'o:new_biz'),
        '④ 성과에서 성과로 직행하지 않는다');
    say(tipOf(on.id).rows.some(r => r.k === '전이 대상' && r.v.includes('신사업')),
        '④ 갈래 요약이 어디로 가는지 적는다');

    // ⚠️ KPI 사이에도 선후가 있다 — 거쳐 가는 것은 왼쪽, 성과에 닿는 것이 오른쪽
    say(at['k:mttr'].x < at['k:line_loss'].x,
    `④ 거쳐 가는 KPI 가 앞 단에 선다: ${at['k:mttr'].x} < ${at['k:line_loss'].x}`);
    say(eid.has('c:mttr:line_loss'), '④ KPI ▶ KPI 선이 그려진다');
    // 기준선은 **성과에 직접 닿는 KPI** 다 — 라인 유실율이 One Time Pass와 한 줄
    say(at['k:line_loss'].x === at['k:otp'].x && at['k:line_loss'].x === at['k:test_leadtime'].x,
    `④ 성과에 닿는 KPI 는 한 줄에 선다: ${at['k:line_loss'].x}/${at['k:otp'].x}`);
    say(!edges.some(e => e.source === 'k:mttr' && e.target.startsWith('o:')),
        '④ 거쳐 가는 KPI 는 성과로 직행하지 않는다');
    const mt = built.nodes.find(n => n.id === 'k:mttr');
    say(mt.data.tip.sub.includes('경유 KPI'), '④ 요약이 경유 KPI 라고 적는다');
    // 역방향 — KPI 요약에 누가 미는지, 성과 요약에 어느 KPI 가 닿는지
    const tl = tipOf('k:test_leadtime');
    say(tl.rows.some(r => r.k === '기여 지표' && r.v.includes('시험 대체')) && tl.rows.some(r => r.k === '기여 업무' && r.v.includes('시험 설비')),
        '④ KPI 요약이 미는 지표·업무를 적는다');
    say(tipOf('o:dev_time').rows.some(r => r.k === '연계 KPI' && r.v.includes('시험 리드타임')), '④ 성과 요약이 닿는 KPI 를 적는다');
    say(tipOf('o:new_biz').rows.some(r => r.k === '직결 지표' && r.v.includes('판단 수준')), '④ 신규 성과 요약이 직결 지표를 적는다');
    say(mt.data.tip.rows.some(r => r.k === '이어지는 KPI' && r.v === '라인 유실율'),
        '④ 요약이 어느 KPI 로 이어지는지 적는다');

    // ⚠️ 성과가 두 단이다 — 덜 쓰는 것이 먼저, 더 버는 것이 그다음(2026-09-01).
    //    그 사이에 갈래가 끼어 「개발 여력 → 신사업」이 앞으로 흘러야 한다.
    say(at['o:new_biz'].x > at['o:dev_cost'].x,
    `④ 성장 성과가 더 오른쪽: ${at['o:dev_cost'].x} < ${at['o:new_biz'].x}`);
    say(at['o:dev_cost'].x === at['o:mfg_cost'].x, '④ 절감 성과끼리는 같은 단');
    say(on.position.x > at['o:dev_time'].x && on.position.x < at['o:new_biz'].x,
        '④ 갈래가 절감과 성장 사이에 선다');
    // ⚠️ 위·아래 띄로 가는 작용 선은 세로다(손잡이가 위·아래) — 가로 흐름 규칙에서 범다
    say(edges.filter(e => !e.sourceHandle).every(e => at[e.target] === undefined || at[e.source] === undefined
      || at[e.target].x >= at[e.source].x), '④ 가로 선은 뒤로 가지 않는다');

    // ⚠️ 설명이 안 붙는 선은 **근거 없이 그은 선**이다 — 그림에선 똑같아 보인다
    say(edges.every(e => e.data && e.data.how), '④ 모든 선에 어떻게 기여하는지가 적혀 있다');
    say(edges.every(e => !e.label), '④ 평소엔 선에 글자가 안 뜼다');
    // ⚠️ 기본 선은 라벨을 SVG 안에 그려 카드 밑으로 깔린다 — 맞춤 선을 쓴다
    say(edges.every(e => e.type === 'badge'), '④ 선은 라벨을 div 층에 그리는 맞춤 선이다');

    // ⚠️ 선이 많아 눈으로 못 좀는다 — 누르면 거기 걸린 것만 남는다
    const f = focusOf(edges, 'k:test_leadtime');
    say(f.nodes.has('k:test_leadtime') && f.nodes.has('o:dev_time')
        && f.nodes.has('i:sim:substitution'), '④ 누르면 앞뒤로 걸린 칸이 남는다');
    say(!f.nodes.has('o:mfg_cost') && !f.nodes.has('i:mon:judgement'),
        '④ 안 걸린 칸은 빠진다');
    // 한 다리 건너까지 물면 결국 다 켜져 흐림이 무의미해진다
    say(!f.nodes.has('i:sim:accuracy'), '④ 한 다리 건너까지는 안 물어온다');
    say([...f.edges].every(i => {
      const e = edges.find(x => x.id === i);
      return e.source === 'k:test_leadtime' || e.target === 'k:test_leadtime';
    }) && f.edges.size > 0, '④ 남는 선은 그 칸에 닿은 것뿐');
    say(tipOf('k:test_leadtime').rows.some(r => r.k === '기여 성과' && r.v.includes('개발시간')),
        '④ KPI 요약이 닿는 성과를 적는다');
    say(html().includes('항목 호버 시') && html().includes('연계 경로·기여 내용 표시'),
        '④ 범례가 호버·누르기를 안내한다');
    say(text.includes('선행 요건'), '④ 선행 범례');

    // ⚠️ 본문 폭에서는 단이 다섯이라 항상 작다 — 띄워 놓고 짚으려면 꽉 채워야 한다
    const fullBtn = () => [...document.querySelectorAll('button')]
      .find(b => b.textContent.startsWith('전체 화면'));
    say(!!fullBtn() && fullBtn().getAttribute('aria-pressed') === 'false',
        '④ 전체 화면 단추가 꺼진 채로 선다');
    await click(fullBtn()); await settle();
    say(fullBtn().getAttribute('aria-pressed') === 'true', '④ 누르면 전체 화면');
    say(fullBtn().textContent.includes('ESC'), '④ 나가는 법을 단추가 적는다');
    // ESC — 브라우저 전체 화면이 안 잡힐 때도 덧개가 남지 않아야 한다
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await sleep(5);
    });
    say(fullBtn().getAttribute('aria-pressed') === 'false', '④ ESC 로 나간다');
    say(text.includes('개발비용') && text.includes('제조비용'), '④ 성과 단');
    // 새로 짚는 성과는 「대응 KPI 없음」으로 표시된다
    say(text.includes('대응 KPI 미정의'), '④ 신규 성과는 KPI 가 없다고 적힌다');
    say(text.includes('대응 KPI 미정의') && text.includes('측정 불가'),
        '④ 점선의 뜻을 범례가 적는다');
    say(text.includes('초안으로 세운 분야') && text.includes('공장 최적화') && !text.includes('아직 지표를 안 정한'),
        '④ 초안 분야를 초안이라고 적는다 — 「아직 안 정한」이 아니다');
    say(text.includes('초안 부문 1 · 지표 2개') && text.includes('정의 부문 2 · 지표 5개'),
        '④ 머리글이 정의·초안을 따로 센다');

    // 누른 것이 화면에서 실제로 흐려지는지
    const boxOf = lab => [...document.querySelectorAll('.react-flow__node')]
      .find(n => n.textContent.trim().startsWith(lab));
    const faded = () => [...document.querySelectorAll('.react-flow__node')]
      .filter(n => (n.style.opacity || '1') !== '1').length;
    say(faded() === 0, '④ 누르기 전엔 흐린 칸이 없다');
    // ⚠️ 끌면 화면이 움직인다 — 누른 자리에서 멀어진 무른 고르기로 안 친다.
    const press = async (el, dx = 0, dy = 0) => {
      await act(async () => {
        // ⚠️ pointer 로 보낸다 — d3-zoom 이 mouseup 을 삼켜 버려서 그리 받는다
        el.dispatchEvent(new MouseEvent('pointerdown',
          { bubbles: true, clientX: 100, clientY: 100 }));
        el.dispatchEvent(new MouseEvent('pointerup',
          { bubbles: true, clientX: 100 + dx, clientY: 100 + dy }));
        await sleep(5);
      });
    };
    await press(boxOf('시험 리드타임'), 40, 0); await settle();
    say(faded() === 0, '④ 끌었으면 고르기가 아니다');
    await press(boxOf('시험 리드타임'), 3, 2); await settle();
    say(faded() > 0, `④ 누르면 안 걸린 칸이 흐려진다: ${faded()}`);
    say((boxOf('시험 리드타임').style.opacity || '1') === '1'
        && (boxOf('제조비용').style.opacity || '1') !== '1',
    '④ 누른 칸은 남고 관계없는 칸은 흐려진다');
    say(document.body.textContent.includes('빈 영역 클릭 시 해제'),
        '④ 되돌리는 법을 알려 준다');
    await press(boxOf('시험 리드타임')); await settle();
    say(faded() === 0, '④ 다시 누르면 해제된다');
    // ⚠️ Ctrl+클릭 — 복수 선택. 각각에 걸린 것의 합집합이 남는다(2026-09-01 요청).
    const pressCtrl = async (el) => {
      await act(async () => {
        el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 100 }));
        el.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 101, clientY: 100, ctrlKey: true }));
        await sleep(5);
      });
    };
    const vis = lab => (boxOf(lab).style.opacity || '1') === '1';
    await press(boxOf('시험 리드타임')); await settle();
    say(!vis('라인 유실율'), '④ 하나만 고르면 무관한 칸은 흐리다');
    await pressCtrl(boxOf('라인 유실율')); await settle();
    say(vis('시험 리드타임') && vis('라인 유실율') && vis('시험 대체') && vis('기본 계측'),
        '④ Ctrl+클릭으로 더하면 둘에 걸린 것이 다 남는다');
    say(!vis('개발비용') || vis('개발비용'), '④ (합집합 셈 — 성과는 KPI 를 통해 걸린다)');
    await pressCtrl(boxOf('라인 유실율')); await settle();
    say(vis('시험 리드타임') && !vis('라인 유실율'), '④ Ctrl+클릭으로 다시 누르면 그것만 빠진다');
    await press(boxOf('라인 유실율')); await settle();
    say(vis('라인 유실율') && !vis('시험 리드타임'), '④ 그냥 클릭은 그것 하나로 바꾼다');
    await press(boxOf('라인 유실율')); await settle();
    say(faded() === 0, '④ 해제');
    say(document.body.textContent.includes('Ctrl+클릭'), '④ 범례가 복수 선택을 안내한다');
    text = document.body.textContent;

    // ⑤ 3절 — 접혀 있다
    say(document.querySelectorAll('table').length === 0, '⑤ 처음엔 표가 없다(접혀 있다)');
    const fold = [...document.querySelectorAll('button')]
      .find(b => b.textContent.includes('해석으로 대체한다'));
    say(!!fold && fold.getAttribute('aria-expanded') === 'false', '⑤ 부문 단추가 접힘으로 선다');
    await click(fold); await settle();
    const rows = [...document.querySelectorAll('table tbody tr')]
      .filter(tr => tr.querySelector('td.name'))
      .map(tr => [...tr.querySelectorAll('td')].map(td => td.textContent.trim()));
    say(rows.length === 3, `⑤ 펼치면 그 부문 지표만: ${rows.length}`);
    // ⚠️ 비용은 동인에만 — 전부에 달면 무엇이 비용을 움직이는지 안 보인다
    say(rows[0][6] === '간접', `⑤ 선행은 비용을 안 단다: ${rows[0][6]}`);
    say(rows[1][6] === '개발비용개발시간', `⑤ 동인만 비용이 붙는다: ${rows[1][6]}`);
    // 「작용 업무」 열 — 디지털 트윈의 역할이 표에서도 읽힌다
    say(rows[1][3].includes('시험·검증'), `⑤ 작용 업무 열이 있다: ${rows[1][3]}`);
    // 원본 축은 표에서도 병기된다 — 순서도와 표기가 어긋나면 안 된다
    say(rows[0][0].startsWith('정확도 (가상검증률)'), `⑤ 표에도 병기: ${rows[0][0]}`);
    say(html().includes('조사 목적'), '⑤ 펼치면 근거가 보인다');
    // 다른 부문은 아직 접혀 있다 — 한 번에 하나만
    // ⚠️ 순서도에는 지표 이름이 이미 다 있다 — **표의 줄**로 본다.
    say(rows.every(r => !r[0].startsWith('판단 수준')), '⑤ 다른 부문은 그대로 접혀 있다');
    await click(fold); await settle();
    say(document.querySelectorAll('table').length === 0, '⑤ 다시 누르면 접힌다');

    // ⑥ 실적이 섞이지 않는다
    text = document.body.textContent;
    ['문턱을 넘', '미평가', '안 매김', '달성률'].forEach(w => {
      say(!text.includes(w), `⑥ 실적 표현이 없다: ${w}`);
    });
    say(text.includes('성과 실적이 아님'), '⑥ 실적이 아니라고 밝힌다');
    say(text.includes('「성숙도」 탭'), '⑥ 실제 수준은 어디서 보는지');
    await unmount();

    fakeFetch(() => ({ sectors: [], focus_areas: [] }));
    await render(<OverviewView />);
    await settle(60);
    say(byText('div', '측정 체계가 아직 정의되지 않았습니다') != null
        || html().includes('측정 체계가 아직 정의되지 않았습니다'),
    '체계가 없으면 그렇다고 말한다');
    await unmount();
  } catch (e) {
    say(false, `실패: ${e.stack.split('\n').slice(0, 4).join(' | ')}`);
  }
  return done();
}
