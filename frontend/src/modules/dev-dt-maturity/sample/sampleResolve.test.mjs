// 샘플 뷰의 경로 맞추기
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSample } from './sampleResolve.js';

const STORE = {
  '/definitions': { axes: {} },
  '/board?division_id=all&sector=simulation': { boards: [1] },
  '/changes?division_id=17&sector=simulation&days=365': [{ id: 1 }],
  '/reviews?division_id=17&year=2026': [{ id: 9 }],
};

test('정확한 키는 그대로, days 만 다른 키는 같은 사업부의 것을 쓴다', () => {
  assert.deepEqual(resolveSample('/definitions', 'GET', STORE).data, { axes: {} });
  assert.deepEqual(resolveSample('/changes?division_id=17&sector=simulation&days=1825', 'GET', STORE).data, [{ id: 1 }]);
  assert.deepEqual(resolveSample('/reviews?division_id=17&year=2026&kind=cause', 'GET', STORE).data, [{ id: 9 }]);   // kind 는 없는 인자 — 같은 키
});

test('다른 사업부의 키는 빌리지 않고 빈 답 · 저장은 거절', () => {
  assert.deepEqual(resolveSample('/changes?division_id=18&sector=simulation&days=365', 'GET', STORE).data, []);
  assert.equal(resolveSample('/pairs/5', 'GET', STORE).data, null);   // 없는 연계는 null — 화면이 「없는 연계」로 읽는다
  assert.throws(() => resolveSample('/pairs/5/assessments/accuracy', 'PUT', STORE), /저장되지 않습니다/);
});

test('부문이 다른 키로는 넘어가지 않는다 — 스레드 구간이 시뮬레이션 목록에 섞이면 안 된다', () => {
  const store = {
    '/board?division_id=17&sector=simulation': { subjects: ['시뮬'] },
    '/changes?division_id=17&sector=simulation&days=365': ['시뮬 이력'],
  };
  // 스레드 판을 물었는데 시뮬레이션 판이 오면 안 된다 — 빈 답이 낫다
  assert.deepEqual(resolveSample('/board?division_id=17&sector=digital_thread', 'GET', store).data, {});
  assert.deepEqual(resolveSample('/changes?division_id=17&sector=digital_thread&days=730', 'GET', store).data, []);
  // 같은 부문이면 꼬리 인자(days)가 달라도 쓴다
  assert.deepEqual(resolveSample('/changes?division_id=17&sector=simulation&days=1825', 'GET', store).data, ['시뮬 이력']);
  // 부문을 안 물으면 예전처럼 고른다
  assert.deepEqual(resolveSample('/board?division_id=17', 'GET', store).data, { subjects: ['시뮬'] });
});

test('부문을 물었으면 부문 없는 옛 키로 넘어가지 않는다 — 추출이 시뮬레이션을 담던 일', () => {
  const store = {
    '/subjects?division_id=17': ['시뮬레이션 대상'],                       // 부문이 안 적힌 옛 키
    '/subjects?division_id=17&sector=simulation': ['시뮬레이션 대상'],
  };
  assert.deepEqual(resolveSample('/subjects?division_id=17&sector=digital_thread', 'GET', store).data, []);
  assert.deepEqual(resolveSample('/subjects?division_id=17&sector=simulation', 'GET', store).data, ['시뮬레이션 대상']);
  assert.deepEqual(resolveSample('/subjects?division_id=17', 'GET', store).data, ['시뮬레이션 대상']);   // 안 물으면 그대로
});

// ── 샘플 판 자체를 본다 — 뽑기 스크립트가 키를 빠뜨리면 화면이 조용히 빈다 ──────
test('샘플 뷰에 「확인 대기」 예시가 들어 있다 (2026-08-30)', async () => {
  const store = (await import('./sample-data.json', { with: { type: 'json' } })).default;
  const rows = resolveSample('/proposals?status=pending&division_id=17', 'GET', store).data;
  assert.ok(rows.length >= 1, '확인 대기 예시가 없다 — 뽑기 스크립트가 키를 빠뜨렸나');
  assert.equal(resolveSample('/proposals/count?division_id=17', 'GET', store).data.pending, rows.length);

  const r = rows[0];
  // 창이 그리는 데 필요한 것이 다 있어야 한다 — 하나라도 없으면 카드가 반쪽이 된다
  for (const k of ['subject_name', 'axis', 'axis_label', 'sector', 'payload', 'note', 'now']) {
    assert.ok(k in r, `확인 대기 줄에 ${k} 가 없다`);
  }
  assert.equal(r.status, 'pending');
  assert.equal(r.source, 'ai');
  // 축 종류를 갈라 담는다 — 창이 종류마다 다르게 그리므로 하나만 있으면 못 본다
  const kinds = new Set(rows.map(x => ('value' in x.payload ? 'value' : x.payload.flags ? 'set' : 'rung')));
  assert.ok(kinds.size >= 2, `축 종류가 ${[...kinds]} 뿐 — 값·묶음·칸을 갈라 담을 것`);

  // ⚠️ 샘플 뷰에서 승인은 **안 된다.** 보기 전용인 것이 맞다.
  assert.throws(() => resolveSample(`/proposals/${r.id}/approve`, 'POST', store), /샘플 뷰/);
});
