/**
 * 「단계 저장」이 켜지는 규칙.
 *
 * 왜 시험하나
 *     두 번 다 사용자가 신고해서 알았다 — ① 사업부 눈으로 열면 기본 설정이
 *     조용히 덮어써졌고, ② 사업부만 바꾸면 저장이 안 켜졌다. 둘 다 화면을
 *     열어 봐야만 보이던 것이라, 판단만 떼어 여기에 못 박는다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FOLLOW, baseStageOf, asDraft, divisionDirty, divisionNeedsReason,
  divisionNeedsStage, baseNeedsReason, saveLabel,
} from './stageSave.js';

test('고르는 값은 그 기술 자신의 단계다 — 사업부가 푼 값이 아니라', () => {
  // 사업부 눈: 서버가 stage 에 MX 값을, companyStage 에 원래 값을 넣어 보낸다.
  assert.equal(baseStageOf({ stage: '도입', companyStage: '감지' }), '감지');
  // 사업부를 안 골랐으면 companyStage 가 아예 없다.
  assert.equal(baseStageOf({ stage: '관찰' }), '관찰');
  // ⚠️ 역량은 단계를 안 갖는다 — 늘 빈 값이다(이 길은 이제 도구에만 쓰인다).
  assert.equal(baseStageOf({ stage: null, companyStage: null }), '');
});

test('열어만 보고 닫는 것은 바꾼 것이 아니다', () => {
  const kept = { division: 'MX', stage: '도입',
                 reason: '3년째 쓰는 중', tools: ['t1', 't2'] };
  assert.equal(divisionDirty(kept, asDraft(kept)), false);
  // 아직 안 적힌 줄을 펴기만 한 것도 마찬가지.
  assert.equal(divisionDirty(null, asDraft(null)), false);
  assert.equal(divisionDirty(null, null), false);
});

test('사업부 쪽이 바뀌면 잡아낸다 — 단계ㆍ이유ㆍ도구 어느 것이든', () => {
  const kept = { stage: '도입', reason: '쓴다', tools: ['t1'] };
  assert.equal(divisionDirty(kept, { ...asDraft(kept), stage: '시험' }), true);
  assert.equal(divisionDirty(kept, { ...asDraft(kept), reason: '다른 이유' }), true);
  assert.equal(divisionDirty(kept, { ...asDraft(kept), tools: ['t1', 't2'] }), true);
  assert.equal(divisionDirty(kept, { ...asDraft(kept), tools: ['t2'] }), true);
  // 순서만 다른 것은 바뀐 것이 아니다.
  const two = { stage: '도입', reason: '쓴다', tools: ['t1', 't2'] };
  assert.equal(divisionDirty(two, { ...asDraft(two), tools: ['t2', 't1'] }), false);
  // 「아직 안 정함」으로 되돌리는 것도 바뀐 것이다.
  assert.equal(divisionDirty(kept, { stage: FOLLOW, reason: '', tools: [] }), true);
});

test('앞뒤 공백만 다른 이유는 바뀐 것이 아니다', () => {
  const kept = { stage: '도입', reason: '쓴다', tools: [] };
  assert.equal(divisionDirty(kept, { ...asDraft(kept), reason: '  쓴다  ' }), false);
});

test('이유는 「보류」에만 묻는다', () => {
  /*
    ⚠️⚠️ 예전에는 단계를 적는 것이 곧 「기본 설정과 다르게 본다」는 주장이라 늘
       이유를 물었다. 기본 설정이 없어진 지금 단계는 **사실**이고, 63줄마다 이유를
       쓰게 하면 아무도 안 적는다.
  */
  assert.equal(divisionNeedsReason({ stage: '도입', reason: '' }), false);
  assert.equal(divisionNeedsReason({ stage: '보류', reason: '' }), true);
  assert.equal(divisionNeedsReason({ stage: '보류', reason: '  ' }), true);
  assert.equal(divisionNeedsReason({ stage: '보류', reason: '비싸다' }), false);
  // 기본 설정을 따르는 것은 주장이 아니다 — 이유를 안 묻는다.
  assert.equal(divisionNeedsReason({ stage: FOLLOW, reason: '' }), false);
  assert.equal(divisionNeedsReason(null), false);
});

test('도구만 적고 단계를 안 고르면 찍을 자리가 없다', () => {
  /*
    ⚠️ 예전에는 단계 없이 도구만 적을 수 있었고 그것이 「기본 설정을 따른다」는
       뜻이었다. 이제 그런 줄은 **어디에 있는지를 말하지 않는 줄**이다.
  */
  assert.equal(divisionNeedsStage({ stage: FOLLOW, reason: '', tools: ['t1'] }), true);
  assert.equal(divisionNeedsStage({ stage: FOLLOW, reason: '쓴다', tools: [] }), true);
  // 아무것도 안 적었으면 그냥 「아직 안 정함」이다 — 막을 것이 없다.
  assert.equal(divisionNeedsStage({ stage: FOLLOW, reason: '', tools: [] }), false);
  assert.equal(divisionNeedsStage({ stage: '시험', reason: '', tools: ['t1'] }), false);
  assert.equal(divisionNeedsStage(null), false);
});

test('기본 설정은 「보류」로 옮길 때만 이유를 묻는다', () => {
  assert.equal(baseNeedsReason('보류', ''), true);
  assert.equal(baseNeedsReason('보류', '비싸다'), false);
  assert.equal(baseNeedsReason('감지', ''), false);
});

test('무엇이 나가는지 이름을 댄다 — 한쪽만 바뀌어도 나간다', () => {
  assert.equal(
    saveLabel({ stageChanged: false, divisionDirty: true, division: 'MX' }), 'MX');
  assert.equal(
    saveLabel({ stageChanged: true, divisionDirty: false, division: '' }), '기본 설정');
  assert.equal(
    saveLabel({ stageChanged: true, divisionDirty: true, division: 'MX' }),
    '기본 설정 · MX');
  // 나갈 것이 없으면 빈 글자 — 단추를 끄는 신호다.
  assert.equal(
    saveLabel({ stageChanged: false, divisionDirty: false, division: '' }), '');
});
