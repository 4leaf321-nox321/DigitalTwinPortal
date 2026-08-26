/**
 * **단계를 저장할 것이 있나** — 상세 창의 「단계 저장」이 켜지는 규칙.
 *
 * 한 곳에 모은 이유
 *     이 판단이 두 번 틀렸고, 둘 다 화면에서만 보였다.
 *
 *     ⚠️⚠️ 사업부 눈으로 보면 서버는 `stage` 에 **그 사업부가 푼 값**을 넣어
 *        보낸다(원래 값은 `companyStage`). 그걸 「지금 값」으로 삼는 바람에
 *        MX 의 단계가 골라진 채로 뜨고, 저장하면 **기본 설정이 조용히 덮어써졌다**
 *        (2026-08-25).
 *
 *     ⚠️⚠️ 사업부만 바꿨을 때 저장이 안 켜졌다. 사업부 칸 안에 저장 단추가 따로
 *        있어서였는데, 아래 큰 단추만 보는 사람에게는 고장으로 읽혔다(2026-08-26).
 *        이제 저장은 창에 하나뿐이고, **둘 중 하나만 바뀌어도 켜진다.**
 */

/** 사업부 칸에서 「기본 설정을 따름」. 값이 없는 것이 곧 따른다는 뜻이다. */
export const FOLLOW = '';

/**
 * 고르고 견줄 **그 기술 자신의** 단계.
 *
 * ⚠️⚠️ 역량은 단계를 안 갖는다(2026-08-26) — 늘 빈 값이 온다. 이 길은 이제
 *    **도구에만** 쓰인다.
 * ⚠️ `tech.stage` 가 아니다. 사업부 눈일 때 `stage` 는 그 사업부 값이라, 그대로
 *    담으면 남의 값을 저장하게 된다.
 */
export const baseStageOf = (tech) =>
  (tech && (tech.companyStage || tech.stage)) || '';

/** 사업부 한 줄을 「적을 것」 모양으로. 없으면 「아직 안 정함」이다. */
export const asDraft = (kept) => ({
  stage: (kept && kept.stage) || FOLLOW,
  reason: (kept && kept.reason) || '',
  tools: (kept && kept.tools) || [],
});

const sameSet = (a, b) =>
  a.length === b.length && a.every((u) => b.includes(u));

/**
 * 적어 둔 것이 **저장된 것과 다른가.**
 *
 * ⚠️ 열어만 보고 닫는 것은 바꾼 것이 아니다 — 펴는 것만으로 켜지면 「안 바꿨는데
 *    저장하라고 한다」가 된다.
 */
export const divisionDirty = (kept, draft) => {
  if (!draft) return false;
  const k = asDraft(kept);
  return draft.stage !== k.stage
    || (draft.reason || '').trim() !== k.reason.trim()
    || !sameSet(draft.tools || [], k.tools);
};

/**
 * **「보류」에만 이유를 묻는다**(2026-08-26).
 *
 * ⚠️⚠️ 예전에는 단계를 적는 것이 곧 「기본 설정과 다르게 본다」는 주장이라 늘
 *    이유를 물었다. 기본 설정이 없어진 지금 단계는 주장이 아니라 **사실**이고,
 *    63줄마다 이유를 쓰게 하면 아무도 안 적는다. 다만 **안 쓰기로 한 판단**은
 *    여전히 근거가 남아야 한다 — 그것만 6개월 뒤에 처음부터 되풀이된다.
 *
 * ⚠️ **서버가 정본이다**(400 을 낸다). 여기 있는 것은 헛걸음을 막는 손잡이다.
 */
export const divisionNeedsReason = (draft) =>
  Boolean(draft) && draft.stage === '보류' && !(draft.reason || '').trim();

/** 도구 쪽도 같은 규칙 — 「보류」로 옮기려면 이유가 있어야 한다. */
export const baseNeedsReason = (stage, reason) =>
  stage === '보류' && !(reason || '').trim();

/**
 * 적을 것이 있는데 단계가 없으면 **찍을 자리가 없다.**
 *
 * ⚠️ 예전에는 단계 없이 도구만 적을 수 있었고 그것이 「기본 설정을 따른다」는
 *    뜻이었다. 이제 그런 줄은 어디에 있는지를 말하지 않는 줄이다.
 */
export const divisionNeedsStage = (draft) =>
  Boolean(draft) && draft.stage === FOLLOW
  && Boolean((draft.reason || '').trim() || (draft.tools || []).length);

/**
 * 무엇이 나가는지. 나갈 것이 없으면 `''` — 단추를 끄고 그 자리에 이유를 적는다.
 *
 * ⚠️ **이름을 대 준다.** 기본 설정과 사업부가 함께 걸릴 수 있어서, 안 적으면
 *    무엇을 저장하는지 모르고 누르게 된다.
 */
export const saveLabel = ({ stageChanged, divisionDirty: dirty, division }) =>
  [stageChanged && '기본 설정', dirty && division].filter(Boolean).join(' · ');
