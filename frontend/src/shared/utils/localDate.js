/**
 * 로컬(브라우저 시간대) 기준 날짜 문자열 — `YYYY-MM-DD`.
 *
 * 왜 있나 — `toISOString().slice(0, 10)` 을 쓰면 안 되는 이유
 *     `toISOString()` 은 **UTC** 로 바꾼다. KST(UTC+9)에서는 **매일 새벽 0~9시에
 *     UTC 가 아직 전날**이라 그 결과가 하루 밀린다.
 *
 *     그래서 이 시간대에만 이런 일이 생긴다:
 *       · 날짜 입력칸의 `max` 가 어제가 되어 **오늘 날짜가 거부**된다.
 *         폼 안이면 submit 자체가 취소돼 **저장 버튼이 아무 반응을 안 한다.**
 *         (2026-08-02 실측: 액션아이템 '생성 날짜' max=08-01 / value=08-02)
 *       · '오늘' 과 비교하는 로직(마감 임박·지연 판정)이 하루 밀린다.
 *       · 기본값으로 저장되는 날짜(등록일·기준일)가 하루 전으로 들어간다.
 *       · 내려받는 파일 이름의 날짜가 어제로 찍힌다.
 *
 *     낮에 테스트하면 절대 재현되지 않는다 — 그래서 오래 남아 있었다.
 *
 * ⚠️ **값과 min·max 는 반드시 같은 함수로 만들어야 한다.** 한쪽만 로컬이면 위 증상이
 *    그대로 돌아온다. 그래서 이 포맷을 앱 전체에서 여기 한 곳으로 모았다.
 *
 * 반대로 `toISOString()` **전체**를 쓰는 것(예: `createdAt` 에 넣는 타임스탬프)은
 * 그대로 두면 된다. 그건 시각을 UTC 로 정확히 표현한 것이고, 서버도 UTC 로 받는다.
 * 문제는 거기서 **날짜 10자리만 잘라 쓸 때**뿐이다.
 */

/** Date(또는 파싱 가능한 값) → 'YYYY-MM-DD' (로컬 기준). 날짜가 아니면 빈 문자열. */
export const toLocalYmd = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  if (!d || isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
       + `-${String(d.getDate()).padStart(2, '0')}`;
};

/** 오늘 (로컬 기준) 'YYYY-MM-DD'. 날짜 입력칸의 `max`·기본값·파일명에 쓴다. */
export const todayLocalYmd = () => toLocalYmd(new Date());

/**
 * 완료 표시를 켤 때 채울 완료일 — **과제년도 기준**.
 *
 * 지난 연도 과제를 지금 정리하면서 오늘 날짜를 박으면 그 과제의 기간 밖 날짜가 된다.
 * 그래서 과제년도보다 지금이 뒤면 그 해 마지막 날, 앞이면 첫날, 같은 해면 오늘로 둔다.
 *
 * 액션아이템 체크(ActionItemsSection)와 진행상태 완료(BasicInfoSection) 두 곳에서
 * 쓴다. 한쪽에만 두면 같은 동작이 서로 다른 날짜를 남긴다.
 */
export const projectCompletedYmd = (projectYear) => {
  const year = Number(projectYear) || new Date().getFullYear();
  const now = new Date().getFullYear();
  if (now < year) return `${year}-01-01`;
  if (now > year) return `${year}-12-31`;
  return todayLocalYmd();
};
