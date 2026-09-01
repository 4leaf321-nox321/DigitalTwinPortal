// 추출 — 판을 짜는 셈. 축 종류마다 값을 사람이 읽는 글로 옮기고, 부문마다 열이 다르다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { axisText, assessmentSheet, changeSheet, subjectSheet, agentSheet, fileName } from './exportSheets.js';

const AXES = [
  { key: 'accuracy', label: '정확도', kind: 'value', rungs: [{ key: 'trend', label: '경향 일치' }] },
  { key: 'automation', label: '자동화', kind: 'set', rungs: [{ key: 'manual', label: '수동' }, { key: 'pre', label: '전처리 자동' }, { key: 'run', label: '실행 자동' }] },
  { key: 'scope', label: '적용 범위', kind: 'rung', rungs: [{ key: 'issue', label: '이슈 대응' }, { key: 'basic', label: '대표 모델' }] },
];

test('축 값은 사람이 읽는 글로 — 값·묶음·택1·모름·미평가', () => {
  assert.equal(axisText(AXES[0], { value: 82 }), 82);
  assert.equal(axisText(AXES[1], { flags: ['pre', 'run'] }), '전처리 자동 · 실행 자동');
  assert.equal(axisText(AXES[1], { flags: [] }), '수동');                   // 아무것도 안 켠 상태
  assert.equal(axisText(AXES[2], { rung: 'basic' }), '대표 모델');
  assert.equal(axisText(AXES[2], { rung: 'unknown', unknown: true }), '모름');
  assert.equal(axisText(AXES[2], null), '');                                // 미평가는 빈 칸
});

const BOARDS = [{
  division_name: 'MX',
  subjects: [{
    name: '낙하 시험', detail: '1.2m', product_families: ['S'],
    pairs: [{
      agent: { name: '구조 해석', kind: '구조', tools: ['LS-DYNA'], projects: [{ title: '낙하 자동화' }] },
      assessments: { accuracy: { value: 82, note: '시험 3건', assessed_at: '2026-06-01T00:00:00', assessed_by_name: '김해석' } },
      unassessed: ['automation', 'scope'],
    }],
  }],
}];

test('평가 판 — 축마다 값·근거·평가일·평가자 네 칸, 미평가 축도 적는다', () => {
  const rows = assessmentSheet(BOARDS, AXES, 'simulation');
  assert.equal(rows[0][0], '사업부');
  assert.ok(rows[0].includes('정확도') && rows[0].includes('정확도 근거') && rows[0].includes('정확도 평가일'));
  assert.equal(rows[0][rows[0].length - 1], '미평가 축');
  const r = rows[1];
  assert.equal(r[0], 'MX');
  assert.equal(r[1], '낙하 시험');
  assert.equal(r[r.length - 1], '자동화 · 적용 범위');
  assert.ok(r.includes(82) && r.includes('시험 3건') && r.includes('2026-06-01') && r.includes('김해석'));
});

test('평가가 하나도 없는 대상도 한 줄로 남는다 — 무엇을 안 매겼나가 보여야 한다', () => {
  const rows = assessmentSheet([{ division_name: 'VD', subjects: [{ name: '굽힘 시험', pairs: [] }] }], AXES, 'simulation');
  assert.equal(rows.length, 2);
  assert.equal(rows[1][1], '굽힘 시험');
});

test('부문마다 열이 다르다 — 모니터링은 라인·공정, 스레드는 스레드·조직·시스템', () => {
  const mon = assessmentSheet([{ division_name: 'MX', subjects: [{ name: 'A라인 · SMT 실장', line: 'A라인', process_label: 'SMT 실장', pairs: [] }] }],
    [], 'manufacturing_monitoring', '수집 수단', '공정');
  // ⚠️ 「공정 단계」다. 이 부문은 대상의 이름표가 「공정」이라 그냥 「공정」이면 머리글이
  //    겹치고, 일괄 입력이 **이름 칸을 공정 단계로 읽는다**(2026-08-30 실측).
  assert.deepEqual(mon[0].slice(0, 6), ['사업부', '공정', '라인·사업장', '공정 단계', '세부', '수집 수단']);
  assert.equal(mon[1][2], 'A라인');
  const dup = mon[0].filter((c, i) => c && mon[0].indexOf(c) !== i);
  assert.deepEqual(dup, [], `머리글이 겹치면 그 칸이 안 닿는다: ${dup}`);

  const th = assessmentSheet([{ division_name: 'MX', subjects: [{ name: 'E-BOM → 예상 원가', segment: { thread_name: '재료비 스레드', from_org_name: '설계그룹(MX)' }, pairs: [] }] }],
    [], 'digital_thread', null, '구간');
  assert.ok(th[0].includes('스레드') && th[0].includes('출발 조직'));
  assert.ok(!th[0].includes('사용 툴'));           // 스레드는 수단이 없다
  assert.equal(th[1][2], '재료비 스레드');
});

test('이력 판 — 축 이름을 사람 말로 옮긴다', () => {
  const rows = changeSheet([{ created_at: '2026-06-01T10:00:00', subject_name: '낙하 시험', agent_name: '구조 해석', axis: 'automation', before: 'manual', after: 'pre', note: '스크립트', actor_name: '박' }], AXES);
  assert.deepEqual(rows[1], ['2026-06-01', '낙하 시험', '구조 해석', '자동화', 'manual', 'pre', '스크립트', '박']);
});

test('대상·수단 목록은 평가가 없어도 다 나온다', () => {
  const s = subjectSheet([{ name: '낙하 시험', division_name: 'MX', detail: '1.2m', product_families: ['S', 'A'] }], 'simulation');
  // ⚠️ 여럿은 ` | ` 로 잇는다 — 이 판을 그대로 「일괄 입력」에 되붙일 수 있어야 한다.
  assert.deepEqual(s[1], ['MX', '낙하 시험', '1.2m', 'S | A']);
  const a = agentSheet([{ name: '구조 해석', division_name: 'MX', kind: '구조', tools: ['LS-DYNA'], defect_types: [], projects: [] }], 'simulation');
  assert.equal(a[1][1], '구조 해석');
  assert.equal(a[1][4], 'LS-DYNA');
});

test('파일 이름 — 부문·사업부·날짜, 샘플이면 그렇다고 적는다', () => {
  const now = new Date(2026, 7, 30);
  assert.equal(fileName({ sectorLabel: '시뮬레이션', divisionName: 'MX', sample: false, now }), '디지털트윈성숙도_시뮬레이션_MX_20260830.xlsx');
  assert.ok(fileName({ sectorLabel: '모니터링', divisionName: '전체', sample: true, now }).includes('_샘플_'));
});

// 공장 최적화 — 대상은 법인 × 라인, 수단 종류는 사전 문구(2026-09-02)
test('공장 최적화의 대상 판은 법인·라인 열을, 수단 판은 종류 문구를 쓴다', () => {
  const s = subjectSheet([{ name: '베트남 · SMT 1라인', division_name: 'MX', site: '베트남 법인', line: 'SMT 1라인', detail: '설비 24대' }],
    'factory_optimization', '법인·라인');
  assert.deepEqual(s[0].slice(0, 5), ['사업부', '법인·라인', '법인', '라인', '세부']);
  assert.deepEqual(s[1].slice(0, 5), ['MX', '베트남 · SMT 1라인', '베트남 법인', 'SMT 1라인', '설비 24대']);
  const a = agentSheet([{ name: '라인 밸런싱 모델', division_name: 'MX', kind: 'line', kind_label: '라인', department_name: '생산기술' }],
    'factory_optimization', '공장 시뮬레이션');
  assert.deepEqual(a[0].slice(0, 4), ['사업부', '공장 시뮬레이션', '수단 종류', '담당 부서']);
  assert.deepEqual(a[1].slice(0, 4), ['MX', '라인 밸런싱 모델', '라인', '생산기술']);
});
