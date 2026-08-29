// 일괄 입력 표의 셈 — 붙여넣은 것을 칸에 앉히고, 고를 수 있는 값과 맞춰 본다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseClipboard, looksLikeHeader, applyPaste, canon, isUnknown, toText, usedRows, emptyGrid } from './bulkGrid.js';

const COLS = ['사업부', '시험 항목', '세부'];
const CH = { 사업부: ['MX', 'VD'] };
const T = (s) => s.replace(/\|/g, '\t');          // 읽기 쉽게 — | 를 탭으로

test('엑셀은 탭으로 준다 — 탭이 없으면 쉼표로 나눈다', () => {
  assert.deepEqual(parseClipboard(T('a|b\nc|d')), [['a', 'b'], ['c', 'd']]);
  assert.deepEqual(parseClipboard('a,b\nc,d'), [['a', 'b'], ['c', 'd']]);
  assert.deepEqual(parseClipboard('a\tb\r\nc\td\r\n'), [['a', 'b'], ['c', 'd']]);   // 끝의 빈 줄은 버린다
  assert.deepEqual(parseClipboard(''), []);
});

test('첫 줄이 머리글이면 건너뛴다 — 열 이름과 절반 넘게 겹칠 때', () => {
  assert.equal(looksLikeHeader(['사업부', '시험 항목', '세부'], COLS), true);
  assert.equal(looksLikeHeader(['MX', '낙하 시험', ''], COLS), false);
  const g = applyPaste(emptyGrid(COLS, 2), COLS, CH, T('사업부|시험 항목\nMX|낙하 시험'));
  assert.deepEqual(g[0], ['MX', '낙하 시험', '']);
});

test('붙여넣은 값이 목록에 있으면 목록의 글자로 앉는다 — 공백·대소문자 차이를 흡수', () => {
  assert.equal(canon(' mx ', ['MX', 'VD']), 'MX');
  assert.equal(canon('없는것', ['MX']), '없는것');           // 없으면 적은 그대로 — 화면이 짚는다
  assert.equal(canon('개발 · 제조', ['개발', '제조']), '개발 · 제조');
  assert.equal(canon('개발,없음', ['개발']), '개발 · 없음');   // 여럿이면 하나씩 맞춰 본다
});

test('목록 밖의 값을 짚는다 — 빈 칸은 아니다', () => {
  assert.equal(isUnknown('MX', ['MX']), false);
  assert.equal(isUnknown('없는것', ['MX']), true);
  assert.equal(isUnknown('', ['MX']), false);
  assert.equal(isUnknown('아무거나', null), false);            // 목록이 없는 열은 그냥 적는 칸
  assert.equal(isUnknown('개발 · 없음', ['개발']), true);       // 여럿 중 하나만 틀려도 짚는다
});

test('고른 칸부터 앉히고, 표가 모자라면 늘린다', () => {
  const g = applyPaste(emptyGrid(COLS, 1), COLS, CH, T('MX|낙하\nVD|굽힘\nMX|비틀림'), 0, 0);
  assert.equal(g.length, 3);
  assert.deepEqual(g.map(r => r[1]), ['낙하', '굽힘', '비틀림']);
  const g2 = applyPaste(emptyGrid(COLS, 3), COLS, CH, T('낙하|1.2m'), 1, 1);     // 둘째 줄, 둘째 열부터
  assert.deepEqual(g2[1], ['', '낙하', '1.2m']);
  assert.deepEqual(g2[0], ['', '', '']);
});

test('열 수를 넘는 것은 버린다 — 옆 열로 밀려 들어가지 않게', () => {
  const g = applyPaste(emptyGrid(COLS, 1), COLS, CH, T('MX|낙하|1.2m|남는 것'));
  assert.deepEqual(g[0], ['MX', '낙하', '1.2m']);
});

test('빈 줄은 서버로 안 보낸다 — 머리글은 늘 앞에 붙인다', () => {
  const g = [['MX', '낙하', ''], ['', '', ''], ['VD', '굽힘', '']];
  assert.equal(usedRows(g).length, 2);
  assert.deepEqual(toText(g, COLS).split('\n'), [
    ['사업부', '시험 항목', '세부'].join('\t'),
    ['MX', '낙하', ''].join('\t'),
    ['VD', '굽힘', ''].join('\t'),
  ]);
});
