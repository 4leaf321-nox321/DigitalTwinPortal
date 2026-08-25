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
  baseNeedsReason, saveLabel,
} from './stageSave.js';

test('고르는 값은 언제나 기본 설정이다 — 사업부가 푼 값이 아니라', () => {
  // 사업부 눈: 서버가 stage 에 MX 값을, companyStage 에 원래 값을 넣어 보낸다.
  assert.equal(baseStageOf({ stage: '도입', companyStage: '감지' }), '감지');
  // 사업부를 안 골랐으면 companyStage 가 아예 없다.
  assert.equal(baseStageOf({ stage: '관찰' }), '관찰');
});

test('열어만 보고 닫는 것은 바꾼 것이 아니다', () => {
  const kept = { division: 'MX', stage: '도입', followsCompany: false,
                 reason: '3년째 쓰는 중', tools: ['t1', 't2'] };
  assert.equal(divisionDirty(kept, asDraft(kept)), false);
  // 전사를 따르던 줄을 펴기만 한 것도 마찬가지.
  assert.equal(divisionDirty(null, asDraft(null)), false);
  assert.equal(divisionDirty(null, null), false);
});

test('사업부 쪽이 바뀌면 잡아낸다 — 단계ㆍ이유ㆍ도구 어느 것이든', () => {
  const kept = { stage: '도입', followsCompany: false, reason: '쓴다', tools: ['t1'] };
  assert.equal(divisionDirty(kept, { ...asDraft(kept), stage: '시험' }), true);
  assert.equal(divisionDirty(kept, { ...asDraft(kept), reason: '다른 이유' }), true);
  assert.equal(divisionDirty(kept, { ...asDraft(kept), tools: ['t1', 't2'] }), true);
  assert.equal(divisionDirty(kept, { ...asDraft(kept), tools: ['t2'] }), true);
  // 순서만 다른 것은 바뀐 것이 아니다.
  const two = { stage: '도입', followsCompany: false, reason: '쓴다', tools: ['t1', 't2'] };
  assert.equal(divisionDirty(two, { ...asDraft(two), tools: ['t2', 't1'] }), false);
  // 전사를 따르기로 되돌리는 것도 바뀐 것이다.
  assert.equal(divisionDirty(kept, { stage: FOLLOW, reason: '', tools: [] }), true);
});

test('앞뒤 공백만 다른 이유는 바뀐 것이 아니다', () => {
  const kept = { stage: '도입', followsCompany: false, reason: '쓴다', tools: [] };
  assert.equal(divisionDirty(kept, { ...asDraft(kept), reason: '  쓴다  ' }), false);
});

test('예외를 만들 때만 이유가 필요하다', () => {
  assert.equal(divisionNeedsReason({ stage: '도입', reason: '' }), true);
  assert.equal(divisionNeedsReason({ stage: '도입', reason: '  ' }), true);
  assert.equal(divisionNeedsReason({ stage: '도입', reason: '쓴다' }), false);
  // 전사를 따르는 것은 주장이 아니다 — 이유를 안 묻는다.
  assert.equal(divisionNeedsReason({ stage: FOLLOW, reason: '' }), false);
  assert.equal(divisionNeedsReason(null), false);
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
