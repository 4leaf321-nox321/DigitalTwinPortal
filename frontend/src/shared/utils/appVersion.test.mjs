/**
 * 화면ㆍ서버 버전 견주기.
 *
 * ⚠️ **모르는 것과 다른 것은 다르다.** 서버 값을 못 받았을 때 「어긋났다」고 하면
 *    안 된다 — 거짓 경고를 한 번 보면 그다음부터는 진짜 경고도 안 본다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

// `__APP_VERSION__` 은 빌드할 때 심는 값이라 node 에는 없다. 시험은 함수만 본다.
globalThis.__APP_VERSION__ = '0.0.0-test';
const { versionState, versionText } = await import('./appVersion.js');

test('같으면 ok', () => {
  assert.equal(versionState('0.6.4', '0.6.4'), 'ok');
});

test('다르면 mismatch — 함께 안 올렸다는 뜻', () => {
  assert.equal(versionState('0.6.4', '0.6.3'), 'mismatch');
});

test('서버 값을 모르면 mismatch 가 아니라 unknown', () => {
  // 옛 서버라 /api/version 이 없거나, 아직 안 받았거나, 끊겼거나.
  for (const server of [null, undefined, '', 'unknown']) {
    assert.equal(versionState('0.6.4', server), 'unknown',
      `${JSON.stringify(server)} 를 어긋남으로 읽으면 안 된다`);
  }
});

test('화면 값이 없으면 견줄 것이 없다', () => {
  assert.equal(versionState('', '0.6.4'), 'unknown');
});

test('같을 때는 한 번만 적는다', () => {
  // 같은 값을 두 번 읽게 하면, 정작 달라졌을 때 눈이 그 자리를 지나친다.
  assert.equal(versionText('0.6.4', '0.6.4'), 'v0.6.4');
});

test('다를 때만 갈라 적는다', () => {
  assert.equal(versionText('0.6.4', '0.6.3'), '화면 v0.6.4 · 서버 v0.6.3');
});

test('서버를 모르면 화면 것만', () => {
  assert.equal(versionText('0.6.4', null), 'v0.6.4');
  assert.equal(versionText('0.6.4', 'unknown'), 'v0.6.4');
});

test('화면 값이 없으면 아무것도 안 적는다', () => {
  // 빈 「v」 만 뜨는 것보다 아예 없는 편이 낫다.
  assert.equal(versionText('', '0.6.4'), '');
});
