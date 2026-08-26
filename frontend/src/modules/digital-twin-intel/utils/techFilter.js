/**
 * **레이더ㆍ목록ㆍ계통에 무엇을 세울지** — 거르는 규칙 한 벌.
 *
 * 한 곳에 모은 이유
 *     이 규칙이 화면 코드(`DigitalTwinIntelApp`) 안에 박혀 있어서 밖에서 부를 수가
 *     없었다. 그래서 SSR 검사가 규칙을 **복사해** 들고 있었는데, 그러면 화면이
 *     틀려도 검사는 자기 복사본을 보고 통과한다 — 검사가 아니라 장식이 된다.
 *
 *     ⚠️⚠️ 실제로 여기서 한 번 데었다. 역량에서 단계를 걷어낸 뒤 역량의 `stage` 가
 *        비었는데 거르는 자리는 여전히 컬럼 값만 봐서, 「도입」을 누르면 레이더에
 *        도입 점이 버젓이 있는데도 그 역량이 통째로 사라졌다(2026-08-26 신고).
 *        **점을 만든 자료와 거르는 자료가 갈리면** 반드시 이런 일이 난다.
 */

/**
 * 분야가 안 적힌 줄이 서는 자리.
 *
 * ⚠️⚠️ **거르는 쪽과 그리는 쪽이 같은 말을 써야 한다**(2026-08-26 점검). 레이더는
 *    분야 없는 줄을 「분류 없음」 부채꼴에 그려 놓고, 그 이름을 누르면 `category` 를
 *    그 글자로 놓는다. 그런데 거르는 쪽은 컬럼 값(빈 값)과 견주므로 **아무것도 안
 *    걸려 화면이 통째로 비었다.**
 */
export const UNCATEGORIZED = '분류 없음';

/** 무엇을 찾을 때 훑는 곳. ⚠️ 도구 이름으로도 그 역량이 걸려야 한다. */
const haystack = (t) => [
  t.name, t.vendor, t.summary,
  ...(t.tags || []), ...(t.cpt || []),
  ...(t.children || []).map((c) => c.name),
];

/**
 * 그 줄이 이 단계에 있나.
 *
 * ⚠️⚠️ **사업부를 안 골랐으면 역량의 `stage` 는 비어 있다.** 단계는 사업부 줄에만
 *    산다 — 그래서 사업부 줄(`divisionMarks`)도 함께 본다. 사업부 눈일 때는 서버가
 *    `stage` 를 그 사업부 값으로 풀어 보내므로 컬럼 값이 맞고, 도구는 언제나
 *    자기 단계를 갖는다.
 */
export const atStage = (t, stage) => !stage
  || t.stage === stage
  || (t.divisionMarks || []).some((m) => m.stage === stage);

/**
 * 레이더에 서는 줄인가.
 *
 * ⚠️ **매달린 도구는 안 선다** — 그 역량이 대신 서기 때문이다. 둘 다 그리면 같은
 *    것이 두 번 서고 층을 나눈 뜻이 사라진다.
 */
export const onRadar = (t) =>
  t.kind === 'capability' || !(t.capabilityUuids || []).length;

/**
 * 한 줄을 남길지. `where` 는 화면의 고르개 값들이다.
 *
 * ⚠️ **사업부로는 안 거른다.** 서버가 이미 그 사업부 눈으로 풀어 보냈고, 「관련된
 *    것만」으로 좁히면 「우리 사업부는 어디까지 왔나」에 답할 수 없다.
 */
export const keepTech = (t, where = {}) => {
  const { q = '', category = '', stage = '', kind = '',
          staleOnly = false, focus = '', radar = false } = where;

  if (radar && !onRadar(t)) return false;
  if (!radar && kind && t.kind !== kind) return false;

  if (focus === 'stale' && !t.isStale) return false;
  if (focus === 'moved' && !t.movedFrom) return false;
  if (staleOnly && !t.isStale) return false;

  if (!atStage(t, stage)) return false;
  if (category && (t.category || UNCATEGORIZED) !== category) return false;

  const key = (q || '').trim().toLowerCase();
  if (!key) return true;
  return haystack(t).some((v) => (v || '').toLowerCase().includes(key));
};

/**
 * 단계를 골랐으면 **그 단계의 사업부만** 남긴다.
 *
 * ⚠️⚠️ 안 그러면 「도입」을 눌러도 충돌 해석의 시험ㆍ보류 점까지 함께 그려진다 —
 *    걸러 놓고 안 걸린 것을 보여주는 꼴이라 「거른 게 맞나」를 못 믿게 된다.
 *
 * ⚠️ **새 객체를 만든다.** 원본을 건드리면 도구 관리ㆍ역량 관리가 보는 목록까지
 *    함께 좁아진다 — 그 화면들은 전부를 봐야 한다. 바뀔 것이 없으면 **그대로**
 *    돌려준다(쓸데없이 새 객체를 만들면 React 가 매번 다시 그린다).
 */
export const narrowMarks = (rows, stage) => {
  if (!stage) return rows;
  return rows.map((t) => {
    const all = t.divisionMarks || [];
    const hit = all.filter((m) => m.stage === stage);
    return hit.length === all.length ? t : { ...t, divisionMarks: hit };
  });
};

/** 거르고 좁히는 것을 한 번에. 화면은 이것만 부르면 된다. */
export const shownTechOf = (rows, where = {}) =>
  narrowMarks((rows || []).filter((t) => keepTech(t, where)), where.stage);
