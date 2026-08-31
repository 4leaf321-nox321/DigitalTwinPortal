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
