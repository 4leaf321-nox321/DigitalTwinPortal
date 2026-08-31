// KPI 연계 현황의 셈 — 무엇을 세고, 무엇을 어느 줄에 세는가.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  orgStatusOf, rateOf, statusSheet, todoSheets, statusFileName,
} from './methodStatus.js';

const OWNERS = [{ name: 'MX' }, { name: 'VD' }];
const FUNCS = [{ name: 'GTR' }, { name: 'CS' }];
const P = (uuid, division) => ({ uuid, division });

/** 과제 목록과 연결 목록으로 셈의 재료를 짠다 (화면의 model 이 주는 것과 같은 꼴). */
const src = (projects, links) => ({
  owners: OWNERS,
  funcs: FUNCS,
  projects,
  links,
  projById: new Map(projects.map((p) => [p.uuid, p])),
  // 어느 KPI든 한 번이라도 걸린 과제 — 화면의 taggedProjects 와 같은 규칙
  taggedProjects: new Set(links.filter((l) => l[2]).map((l) => l[0])),
});

const of = (got, name) => got.rows.find((r) => r.division === name);

test('과제는 과제로, 연결은 연결로 센다 — 단위가 다르다', () => {
  // a 는 KPI 둘에 걸렸다 → 연계된 **과제**는 1건, **연결**은 2건
  const projects = [P('a', 'MX'), P('b', 'MX')];
  const links = [['a', 1, 'MX', '해석으로 회차 감축'], ['a', 2, 'MX', '']];
  const mx = of(orgStatusOf(src(projects, links)), 'MX');
  assert.equal(mx.projects, 2);
  assert.equal(mx.linked, 1);
  assert.equal(mx.unlinked, 1);        // b 는 아무 KPI 에도 안 걸렸다
  assert.equal(mx.linkRate, 50);
  assert.equal(mx.links, 2);
  assert.equal(mx.filled, 1);
  assert.equal(mx.missing, 1);
  assert.equal(mx.fillRate, 50);
});

test('기능조직도 줄이 선다 — 남의 KPI 에 기여한 것도 자기 줄이다', () => {
  // ⚠️ 대상 기준으로 세면 GTR·CS 는 표에서 아예 빠진다. 그래서 **소속** 기준이다.
  const projects = [P('g', 'GTR'), P('c1', 'CS'), P('m', 'MX')];
  const links = [['g', 1, 'MX', '전사 표준 툴 배포'], ['c1', 1, 'VD', ''], ['m', 1, 'MX', '']];
  const got = orgStatusOf(src(projects, links));
  assert.deepEqual(got.rows.map((r) => r.division), ['MX', 'VD', 'GTR', 'CS']);
  assert.equal(of(got, 'GTR').isOwner, false);
  assert.equal(of(got, 'GTR').links, 1);
  assert.equal(of(got, 'GTR').filled, 1);
  assert.equal(of(got, 'CS').missing, 1);
  // VD 는 자기 과제가 없다 — CS 가 VD 의 KPI 에 기여했어도 VD 줄에는 안 붙는다
  assert.equal(of(got, 'VD').projects, 0);
  assert.equal(of(got, 'VD').links, 0);
});

test('연결이 표 전체에서 딱 한 번씩만 세어진다', () => {
  // 같은 과제가 MX·VD 를 함께 지원해도 소속(GTR) 줄에 2건으로 선다 — 겹쳐 세지 않는다.
  const projects = [P('g', 'GTR')];
  const links = [['g', 1, 'MX', '표준화'], ['g', 1, 'VD', '']];
  const got = orgStatusOf(src(projects, links));
  assert.equal(got.totals.links, 2);
  assert.equal(of(got, 'GTR').links, 2);
  assert.equal(of(got, 'MX').links, 0);
  assert.equal(got.totals.projects, 1);          // 과제는 하나다
  assert.equal(got.totals.linked, 1);
});

test('연결이 아닌 줄은 안 센다 — 취소 과제와 대상 없는 줄', () => {
  const projects = [P('a', 'MX')];                       // b 는 취소되어 목록에 없다
  const links = [['a', 1, 'MX', '적힘'], ['b', 1, 'MX', '적힘'], ['a', 2, '', '적힘']];
  const got = orgStatusOf(src(projects, links));
  assert.equal(got.totals.links, 1);
  assert.equal(of(got, 'MX').links, 1);
});

test('공백만 적은 기여방법은 안 적은 것이다', () => {
  const projects = [P('a', 'MX')];
  const got = orgStatusOf(src(projects, [['a', 1, 'MX', '   \n  ']]));
  assert.equal(of(got, 'MX').filled, 0);
  assert.equal(of(got, 'MX').missing, 1);
});

test('합계는 줄의 합이다', () => {
  const projects = [P('a', 'MX'), P('b', 'VD'), P('g', 'GTR')];
  const links = [['a', 1, 'MX', '적힘'], ['b', 1, 'VD', ''], ['g', 1, 'MX', '']];
  const { totals } = orgStatusOf(src(projects, links));
  assert.deepEqual(
    { ...totals },
    { projects: 3, linked: 3, unlinked: 0, linkRate: 100,
      links: 3, filled: 1, missing: 2, fillRate: 33 },
  );
});

test('아무것도 없으면 비율은 0% 가 아니라 없음', () => {
  // 0% 로 칠하면 「안 했다」로 읽혀, 없는 안건이 생긴다.
  const got = orgStatusOf(src([], []));
  assert.equal(of(got, 'MX').linkRate, null);
  assert.equal(of(got, 'MX').fillRate, null);
  assert.equal(got.totals.linkRate, null);
  assert.equal(rateOf(0, 0), null);
  assert.equal(rateOf(1, 3), 33);
  assert.equal(rateOf(3, 3), 100);
});

test('재료가 없어도 안 터진다', () => {
  const got = orgStatusOf();
  assert.deepEqual(got.rows, []);
  assert.equal(got.totals.links, 0);
});

// ── 엑셀로 뽑을 판 ──────────────────────────────────────────────────────────

test('현황 판은 모달의 표 그대로 — 비율은 글자가 아니라 숫자다', () => {
  // ⚠️ '33%' 라고 글자로 넣으면 엑셀에서 정렬도 합계도 안 된다.
  const projects = [P('a', 'MX'), P('b', 'MX'), P('g', 'GTR')];
  const links = [['a', 1, 'MX', '적힘'], ['g', 1, 'MX', '']];
  const rows = statusSheet(orgStatusOf(src(projects, links)));
  assert.deepEqual(rows[0].slice(0, 6), ['구분', '조직', '과제', 'KPI 연계', '미연계', '연계율(%)']);
  assert.deepEqual(rows[1], ['사업부', 'MX', 2, 1, 1, 50, 1, 1, 0, 100]);
  assert.deepEqual(rows[2], ['사업부', 'VD', 0, 0, 0, '', 0, 0, 0, '']);   // 없으면 빈칸(0% 아니다)
  assert.deepEqual(rows[3].slice(0, 2), ['기능조직', 'GTR']);
  assert.deepEqual(rows.at(-1), ['합계', '', 3, 2, 1, 67, 2, 1, 1, 50]);
});

test('할 일 판 둘 — 무엇이 남았는지가 있어야 일이 된다', () => {
  const projects = [
    { uuid: 'a', division: 'MX', code: 'MX-1', title: '낙하 해석 자동화', status: '진행중', progress: 40 },
    { uuid: 'x', division: 'MX', code: 'MX-9', title: '안 걸린 과제', status: '진행중', progress: 10 },
    { uuid: 'g', division: 'GTR', code: 'G-1', title: '표준 툴 배포', status: '완료', progress: 100 },
  ];
  const links = [['a', 1, 'MX', '적힘'], ['a', 2, 'MX', ''], ['g', 1, 'VD', '  ']];
  const kpis = [{ kpiDefinitionId: 1, label: '개발 리드타임', category: '개발' },
    { kpiDefinitionId: 2, label: '시제 검증률', category: '개발' }];
  const { unlinked, noMethod } = todoSheets({ ...src(projects, links), kpis });

  assert.deepEqual(unlinked[0], ['조직', '과제코드', '과제명', '상태', '진행률(%)']);
  assert.deepEqual(unlinked.slice(1), [['MX', 'MX-9', '안 걸린 과제', '진행중', 10]]);

  assert.deepEqual(noMethod[0].slice(0, 6),
    ['조직', '과제코드', '과제명', 'KPI 분류', 'KPI', '대상 사업부']);
  // 공백만 적은 것도 미입력이다. 사업부 먼저, 기능조직 나중.
  assert.deepEqual(noMethod.slice(1).map((r) => [r[0], r[2], r[4], r[5]]), [
    ['MX', '낙하 해석 자동화', '시제 검증률', 'MX'],
    ['GTR', '표준 툴 배포', '개발 리드타임', 'VD'],
  ]);
});

test('할 일 판에 취소 과제와 대상 없는 줄은 안 들어간다', () => {
  const projects = [{ uuid: 'a', division: 'MX', title: 'a' }];
  const links = [['z', 1, 'MX', ''], ['a', 1, '', '']];    // z 는 취소, 둘째는 대상 없음
  const { noMethod } = todoSheets({ ...src(projects, links), kpis: [] });
  assert.equal(noMethod.length, 1);                        // 머리글만
});

test('파일 이름에 무엇을·언제가 들어간다', () => {
  assert.equal(statusFileName(2026, new Date(2026, 7, 30)), 'KPI연계현황_2026_20260830.xlsx');
});
