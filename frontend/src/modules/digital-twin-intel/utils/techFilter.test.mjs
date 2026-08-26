/**
 * 레이더ㆍ목록에 무엇을 세울지 — 거르는 규칙.
 *
 * 왜 시험하나
 *     이 규칙이 화면 코드 안에 박혀 있어서 밖에서 못 불렀고, SSR 검사는 규칙을
 *     **복사해** 들고 있었다. 그래서 화면이 틀려도 검사는 자기 복사본을 보고
 *     통과했다 — 「사업부 전체에서 도입을 누르면 아무것도 안 남는다」는 흠을
 *     사용자가 신고해서야 알았다(2026-08-26).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { atStage, onRadar, keepTech, narrowMarks, shownTechOf }
  from './techFilter.js';

/** 사업부를 안 골랐을 때의 역량 — **단계가 비어 있다.** */
const cap = (name, marks) => ({
  uuid: name, name, kind: 'capability', stage: null, companyStage: null,
  category: '시뮬레이션·해석', divisionMarks: marks,
});
/** 어느 역량에도 안 매달린 도구 — 자기 단계를 갖는다. */
const tool = (name, stage, caps = []) => ({
  uuid: name, name, kind: 'tool', stage, capabilityUuids: caps,
});

const 충돌 = cap('충돌 해석', [{ division: 'VD', stage: '도입' },
                            { division: 'MX', stage: '시험' },
                            { division: 'NW', stage: '보류' }]);
const 구조 = cap('구조 해석', [{ division: 'DA', stage: '도입' },
                            { division: 'MX', stage: '도입' }]);
const 조용 = cap('아무도 안 본 역량', []);

test('단계는 사업부 줄에서 찾는다 — 역량의 컬럼은 비어 있다', () => {
  /*
    ⚠️⚠️ 이 한 줄이 신고받은 흠이다. 컬럼 값만 보면 레이더에 「도입」 점이 버젓이
       있는데도 「도입」을 누르는 순간 그 역량이 통째로 사라진다.
  */
  assert.equal(atStage(충돌, '도입'), true);
  assert.equal(atStage(충돌, '시험'), true);
  assert.equal(atStage(충돌, '관찰'), false);
  assert.equal(atStage(조용, '도입'), false, '아무도 안 적었으면 어디에도 없다');
  // 도구는 자기 단계를 갖는다.
  assert.equal(atStage(tool('LS-DYNA', '도입'), '도입'), true);
  // 안 골랐으면 다 통과한다.
  assert.equal(atStage(조용, ''), true);
});

test('레이더에는 역량과 안 매달린 도구만 선다', () => {
  // ⚠️ 매달린 도구까지 그리면 같은 것이 두 번 서고 층을 나눈 뜻이 사라진다.
  assert.equal(onRadar(충돌), true);
  assert.equal(onRadar(tool('LS-DYNA', '도입')), true, '안 매달렸으면 선다');
  assert.equal(onRadar(tool('LS-DYNA', '도입', ['c1'])), false, '매달렸으면 안 선다');
});

test('레이더가 아니면 갈래(역량ㆍ도구)로 거를 수 있다', () => {
  const t = tool('LS-DYNA', '도입', ['c1']);
  assert.equal(keepTech(t, { radar: true }), false);
  assert.equal(keepTech(t, { radar: false, kind: 'tool' }), true);
  assert.equal(keepTech(t, { radar: false, kind: 'capability' }), false);
});

test('찾기는 도구 이름으로도 그 역량을 건진다', () => {
  /*
    ⚠️ 안 그러면 레이더에서 「LS-DYNA」를 찾았을 때 아무것도 안 나온다 — 매달린
       도구는 안 그리니까. 찾는 사람은 도구 이름을 치지 역량 이름을 치지 않는다.
  */
  const c = { ...충돌, children: [{ name: 'LS-DYNA' }], tags: ['비선형'],
              cpt: ['Intelligence'] };
  assert.equal(keepTech(c, { q: 'ls-dyna' }), true, '자식 이름');
  assert.equal(keepTech(c, { q: '비선형' }), true, '태그');
  assert.equal(keepTech(c, { q: 'intel' }), true, 'CPT');
  assert.equal(keepTech(c, { q: '충돌' }), true, '제 이름');
  assert.equal(keepTech(c, { q: '없는말' }), false);
  assert.equal(keepTech(c, { q: '   ' }), true, '빈 것은 안 거른다');
});

test('낡음ㆍ이동 고르개', () => {
  const stale = { ...조용, isStale: true };
  const moved = { ...조용, movedFrom: '관찰' };
  assert.equal(keepTech(조용, { focus: 'stale' }), false);
  assert.equal(keepTech(stale, { focus: 'stale' }), true);
  assert.equal(keepTech(조용, { staleOnly: true }), false);
  assert.equal(keepTech(조용, { focus: 'moved' }), false);
  assert.equal(keepTech(moved, { focus: 'moved' }), true);
});

test('사업부로는 안 거른다', () => {
  /*
    ⚠️ 서버가 이미 그 사업부 눈으로 풀어 보냈다. 「관련된 것만」으로 좁히면
       「우리 사업부는 어디까지 왔나」에 답할 수 없다.
  */
  assert.equal(keepTech(조용, { division: 'MX' }), true);
});

test('단계를 골랐으면 그 단계의 사업부만 남는다', () => {
  /*
    ⚠️⚠️ 걸러 놓고 안 걸린 것을 보여주면 「거른 게 맞나」를 못 믿게 된다.
       충돌 해석은 도입ㆍ시험ㆍ보류 셋인데, 「도입」을 골랐으면 VD 만 남아야 한다.
  */
  const [c] = narrowMarks([충돌], '도입');
  assert.deepEqual(c.divisionMarks, [{ division: 'VD', stage: '도입' }]);
  assert.notEqual(c, 충돌, '새 객체여야 원본이 안 좁아진다');
  assert.equal(충돌.divisionMarks.length, 3, '원본은 그대로다');

  // 바뀔 것이 없으면 **그대로** 돌려준다 — 새 객체를 만들면 React 가 매번 다시 그린다.
  const [same] = narrowMarks([구조], '도입');
  assert.equal(same, 구조);
  assert.equal(narrowMarks([충돌], '')[0], 충돌, '안 골랐으면 손대지 않는다');
});

test('거르고 좁히는 것을 한 번에', () => {
  const rows = shownTechOf([충돌, 구조, 조용, tool('떠도는 도구', '도입')],
                           { stage: '도입', radar: true });
  assert.deepEqual(rows.map((r) => r.name),
                   ['충돌 해석', '구조 해석', '떠도는 도구']);
  assert.deepEqual(rows[0].divisionMarks, [{ division: 'VD', stage: '도입' }]);
  assert.deepEqual(rows[1].divisionMarks.map((m) => m.division), ['DA', 'MX']);
});
