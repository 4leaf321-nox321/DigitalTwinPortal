/**
 * 성과 수준값(현재/목표/실적)의 **0 과 미입력을 구분한다.**
 *
 * 왜 필요한가
 *   `값 || ''` · `값 && (...)` 로 다루면 **0 이 미입력으로 뭉개진다.**
 *   0 은 진짜 값이다 — "현재 0%, 목표 20%" 처럼 출발점이 0 인 성과가 흔하고
 *   (2026-08-06 개발서버 실측: 살아있는 성과 112건 중 현재수준이 0 인 것 54건),
 *   "소요 시간 0 으로 만들기" 처럼 목표가 0 인 성과도 있다.
 *
 * 왜 목표는 사라지고 실적은 멀쩡했나
 *   컬럼 타입이 다르다. `current_level`·`target_level` 은 Numeric 이라 응답에
 *   **숫자 0** 으로 오고, `actual_level` 은 String 이라 **문자열 '0'** 으로 온다.
 *   자바스크립트에서 `0 || ''` 는 `''` 지만 `'0' || ''` 는 `'0'` 이다.
 *   그래서 같은 화면에서 목표만 빈칸이 되는 기묘한 증상이 났다.
 *
 * 미입력의 표현도 둘이다
 *   현재/목표  컬럼이 NULL → 응답에서 **키가 아예 빠진다**(assemble.py 는 None 을
 *              건너뛴다) → `undefined`
 *   실적       문자열 컬럼이라 `''` 로 저장된다
 *   `hasLevel` 은 셋(`undefined` · `null` · `''`)을 모두 미입력으로 본다.
 */

/** 값이 입력되어 있는가. **0 은 입력된 것이다.** */
export const hasLevel = (v) => v !== undefined && v !== null && v !== '';

/**
 * 화면·입력칸에 넣을 문자열. 미입력이면 `fallback`(기본 빈 문자열).
 *
 * 입력칸(`<input value=...>`)에 쓸 때는 fallback 을 비워 두고,
 * 표에 쓸 때는 `'-'` 를 준다.
 */
export const levelText = (v, fallback = '') => (hasLevel(v) ? String(v) : fallback);

/** 계산용 숫자. 미입력이거나 숫자가 아니면 null (0 과 구분된다). */
export const levelNumber = (v) => {
  if (!hasLevel(v)) return null;
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
};

/**
 * 퍼센트 표시. **과제 진행률**이 이걸 쓴다 — 성과 수준값과 사정이 같아서 여기 둔다.
 *
 *   0          → '0%'    실제로 0% 인 과제
 *   미입력      → '-'     아직 진행률을 안 정한 과제 (2026-08-06 기준 204건)
 *
 * 예전에는 자리마다 달랐다 — `진행률 ?? 0` 인 곳은 미입력을 '0%' 로 그렸고,
 * `{p.진행률}%` 인 곳은 숫자 없이 '%' 만 나왔다. 서버가 NULL 이면 키를 통째로
 * 빼서 보내기 때문이다(assemble.py). 그 둘을 여기로 모은다.
 */
export const percentText = (v, fallback = '-') => (hasLevel(v) ? `${v}%` : fallback);

/**
 * 변화량 = 대상 − 현재. **성과에서 실제로 중요한 값은 이 차이다.**
 *
 *   목표 변화량 = 목표 − 현재   목표까지 만들어야 할 변화
 *   실적 변화량 = 실적 − 현재   지금까지 실제로 만든 변화
 *
 * '개선량' 이 아니라 '변화량' 이다 — 실적이 목표와 **반대 방향**으로 갈 수도 있어서
 * '개선' 이라고 부르면 사실과 달라진다(AddPerformanceModal 의 같은 표기와 맞춘다).
 *
 * 둘 중 하나라도 미입력이면 null 이다. 0 은 정상적인 결과다 —
 * "현재와 같다(변화 없음)" 는 뜻이고 미입력과 다르다.
 */
export const levelDelta = (target, current) => {
  const t = levelNumber(target);
  const c = levelNumber(current);
  if (t === null || c === null) return null;
  return Math.round((t - c) * 1000) / 1000;
};

/** 변화량 표시. 양수에 `+` 를 붙여 방향이 한눈에 보이게 한다. 미입력이면 fallback. */
export const deltaText = (target, current, fallback = '-') => {
  const d = levelDelta(target, current);
  if (d === null) return fallback;
  return (d > 0 ? '+' : '') + d.toLocaleString();
};
