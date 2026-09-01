// 표의 이름 칸이 좁은 화면에서 홀로 쪼그라들지 않는지 — **글로 본다.** (2026-08-31)
//
// 왜 눌러 보는 시험이 아니라 소스를 읽나
//     이건 CSS 하나로 나는 병인데, `npm run test:ui` 는 styled-components 를 스텁으로
//     갈아 끼워 **CSS 가 아예 안 붙는다.** jsdom 도 표 레이아웃을 계산하지 않는다.
//     그래서 눌러 보는 시험으로는 절대 못 잡는다. 대신 그 규칙이 소스에 남아 있는지 본다.
//
// 무엇이 문제였나 (2026-08-31 신고)
//     표의 다른 칸은 전부 `white-space: nowrap` 이라 줄지 않는데, 이름 칸만
//     `overflow-wrap: anywhere` 였다. 이 값은 명세상 **낱말 중간의 끊는 자리를
//     min-content 셈에 넣는다** — 즉 그 칸의 최소 너비가 한 글자가 된다.
//     그래서 폭이 모자라면 브라우저가 줄어들 수 있는 유일한 칸인 이름 칸부터 끝까지
//     짜냈고, 「목표 원가 → E-BOM」이 한 글자씩 세로로 서서 줄 높이가 열 배가 됐다.
//
//     `break-word` 는 같은 자리에서 줄을 바꾸되 **min-content 는 가장 긴 낱말로**
//     지킨다. 여기에 min-width 바닥을 더해, 그래도 좁으면 칸을 짜내는 대신
//     표가 가로로 흐르게 둔다(바깥이 overflow: auto 다).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, '..', 'components', p), 'utf8');

/** 표 안에서 **줄을 바꿀 수 있는 칸**들 — 좁아지면 여기부터 짜인다. */
const CELLS = [
  ['Thread/ThreadListView.jsx', 'SegCell'],        // 디지털 스레드의 구간 — 실제 신고된 자리
  ['Board/BoardView.jsx', 'SubjectTd'],            // 판(상세)의 구간·대상 이름
  ['List/ListView.jsx', 'SubjectCell'],            // 시뮬레이션·모니터링의 대상
  ['List/ListView.jsx', 'SimCell'],
  ['List/ListView.jsx', 'ToolCell'],
  ['List/ListView.jsx', 'DeptCell'],
];

/** `const 이름 = styled.td\`…\`` 한 덩어리를 떼어 온다.
 *  ⚠️ 주석은 걷어낸다 — 「예전엔 anywhere 였다」고 적어 둔 설명까지 규칙 위반으로 잡힌다. */
const blockOf = (src, name) => {
  const i = src.indexOf(`const ${name} = styled.td\``);
  assert.notEqual(i, -1, `${name} 을(를) 못 찾았습니다 — 이름이 바뀌었으면 이 시험도 같이 고치세요.`);
  const from = src.indexOf('`', i) + 1;
  const to = src.indexOf('`;', from);
  return src.slice(from, to).replace(/\/\*[\s\S]*?\*\//g, '');
};

test('표의 이름 칸에 overflow-wrap: anywhere 를 쓰지 않는다', () => {
  CELLS.forEach(([file, name]) => {
    const css = blockOf(read(file), name);
    assert.ok(!/overflow-wrap:\s*anywhere/.test(css),
      `${file} 의 ${name} 이 anywhere 로 돌아갔습니다 — 최소 너비가 한 글자가 되어 `
      + '좁은 화면에서 이 칸만 세로로 길어집니다. break-word 를 쓰세요.');
  });
});

test('줄을 바꾸는 칸에는 min-width 바닥이 있다', () => {
  CELLS.forEach(([file, name]) => {
    const css = blockOf(read(file), name);
    if (!/overflow-wrap:/.test(css)) return;      // 줄을 안 바꾸는 칸은 해당 없음
    assert.ok(/min-width:\s*[\d.]+rem/.test(css),
      `${file} 의 ${name} 에 min-width 가 없습니다 — 그래도 좁으면 칸을 짜내는 대신 `
      + '표가 가로로 흘러야 합니다.');
  });
});

test('스레드 목록도 좁은 화면에서는 위아래로 쌓는다', () => {
  // 끝까지 반반이면 1366 짜리 화면에서 표가 절반밖에 못 쓰고, 그 폭을 구간 칸이 감당한다.
  // 시뮬레이션 목록에는 진작 있던 규칙이다 — 둘이 같은 문턱을 쓴다.
  const both = [read('Thread/ThreadListView.jsx'), read('List/ListView.jsx')];
  both.forEach((src, i) => {
    const wrap = src.slice(src.indexOf('const Wrap = styled.div`'));
    const head = wrap.slice(0, wrap.indexOf('`;'));
    assert.ok(/@media\s*\(max-width:\s*1100px\)/.test(head)
      && /grid-template-columns:\s*1fr/.test(head),
    `${i === 0 ? 'ThreadListView' : 'ListView'} 의 Wrap 에 좁은 화면 규칙이 없습니다.`);
  });
});

test('세로로 쌓는 판은 카드가 눌리지 않는다', () => {
  // ⚠️ flex 아이템의 기본은 shrink: 1 이다. 세로 flex 안에서 내용이 넘치면 브라우저는
  //    스크롤이 아니라 **카드를 눌러** 맞추고, 카드에 overflow: hidden 이 있으면
  //    눌린 만큼 그대로 잘린다. 개요 화면이 정확히 그렇게 깨졌다(2026-08-31 신고).
  const src = readFileSync(join(here, '..', 'components', 'Overview', 'OverviewView.jsx'), 'utf8');
  const wrap = src.slice(src.indexOf('const Wrap = styled.div`'));
  const css = wrap.slice(0, wrap.indexOf('`;')).replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(/overflow:\s*auto/.test(css), '개요의 Wrap 이 흐르지 않습니다.');
  assert.ok(/&\s*>\s*\*\s*\{[^}]*flex:\s*0\s+0\s+auto/.test(css),
    '개요의 Wrap 자식에 flex: 0 0 auto 가 없습니다 — 넘치면 카드가 눌려 잘립니다.');
});

/**
 * 순서도의 **선 위 설명**이 카드에 안 가리는지 — 이것도 글로 본다. (2026-09-01)
 *
 * 왜 소스를 읽나
 *     reactflow 의 기본 선 라벨은 SVG(`.react-flow__edges`) 안에 있어 카드 층 밑으로
 *     깔린다. 그래서 EdgeLabelRenderer(별도 div 층)로 옮기고 그 층의 z-index 를
 *     카드 위로 올렸다. 둘 중 하나만 빠져도 설명이 **조용히 가려진다** —
 *     jsdom 은 겹침을 계산하지 않으므로 눌러 보는 시험으로는 못 잡는다.
 */
test('순서도의 선 위 설명은 카드보다 앞에 서고, 길면 접힌다', () => {
  const src = read('Overview/ChainFlow.jsx');
  assert.match(src, /EdgeLabelRenderer/,
    'EdgeLabelRenderer 를 안 쓰면 라벨이 SVG 안에 남아 카드에 가린다');
  assert.match(src, /\.react-flow__edgelabel-renderer\s*\{[^}]*z-index:\s*(\d+)/,
    '라벨 층의 z-index 를 안 올리면 카드 밑에 깔린다');
  const z = Number(src.match(/\.react-flow__edgelabel-renderer\s*\{[^}]*z-index:\s*(\d+)/)[1]);
  assert.ok(z >= 10, `라벨 층 z-index 가 너무 낮다: ${z}`);

  // 알약 꼴 · 길면 줄바꿈 — 한 줄로 두면 설명이 그림을 가로지른다
  const badge = src.match(/const EdgeBadge = styled\.div`([\s\S]*?)`;/);
  assert.ok(badge, 'EdgeBadge 가 없다');
  assert.match(badge[1], /border-radius:\s*999px/, '알약 꼴이 아니다');
  assert.match(badge[1], /max-width:/, 'max-width 가 없으면 한 줄이 끝없이 길어진다');
  assert.match(badge[1], /white-space:\s*normal/, 'nowrap 이면 줄이 안 바뀐다');
});

/**
 * 성숙도 헤더 — 좁은 화면에서 가운데 줄이 **옆으로 굴러가는지**. (2026-09-01)
 *
 * 왜 소스를 읽나
 *     공용 헤더는 flex-shrink 0 · width max-content 라 줄지 않고 그대로 넘친다.
 *     그러면 오른쪽 단추부터 화면 밖으로 잘린다. 대시보드와 같은 처방을 이 모듈
 *     클래스에만 건다 — jsdom 은 레이아웃을 안 재므로 규칙이 있는지를 글로 본다.
 * ⚠️ 「데이터」 내려 목록은 스크롤 상자 안에 있어 absolute 면 잘린다 — fixed 여야 한다.
 */
test('성숙도 헤더의 가운데 줄은 좁으면 가로로 굴러가고, 내려 목록은 잘리지 않는다', () => {
  const src = read('Layout/Header.jsx');
  const rule = (sel) => {
    const m = src.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}'));
    assert.ok(m, `규칙이 없다: ${sel}`);
    return m[1];
  };
  assert.match(rule('.dev-dt-maturity-header .header-center-content'), /overflow-x:\s*auto/,
    '가운데 줄에 overflow-x auto 가 없으면 넘친 단추가 잘린다');
  assert.match(rule('.dev-dt-maturity-header .header-center-content'), /min-width:\s*0/,
    'min-width 0 이 없으면 flex 항목이 안 줄어 스크롤이 안 생긴다');
  assert.match(rule('.dev-dt-maturity-header .header-center-content > *'), /flex-shrink:\s*0/,
    '안쪽이 줄어들면 넘치지 않아 스크롤이 안 생기고 단추만 찌그러진다');
  assert.match(rule('.dev-dt-maturity-header .header-right'), /flex-shrink:\s*1/,
    '묶음이 안 줄면 오른쪽 끝이 먼저 잘리고 스크롤은 그 뒤에야 생긴다');
  // 내려 목록 — 스크롤 상자 안의 absolute 는 잘린다
  const list = src.match(/const DataList = styled\.div`([\s\S]*?)`;/)[1];
  assert.match(list, /position:\s*fixed/, '내려 목록이 fixed 가 아니면 가로 스크롤 상자에 잘린다');
  assert.doesNotMatch(list, /position:\s*absolute/);
  assert.match(src, /getBoundingClientRect\(\)/, 'fixed 목록은 단추의 화면 좌표로 자리를 잡아야 한다');
});
