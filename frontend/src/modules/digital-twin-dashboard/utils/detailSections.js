/**
 * 상세 과제 정보 7섹션의 **정의**. 화면 여러 곳이 같이 본다.
 *
 * 왜 모았나
 *     이 목록(키·이름·부모전용 여부·짝 이미지)이 `ProjectReportView`·`DetailInfoModal`
 *     에 각각 복사돼 있었다. 섹션 하나를 늘리거나 이름을 바꾸면 **한 화면에서만
 *     바뀌고 나머지는 옛말을 한다.** 2026-08-08 에 '모든 과제 현황' 상세 보기가
 *     세 번째 사용처가 되면서 한 곳으로 모았다.
 *
 * ⚠️ 서버에도 같은 규칙이 있다(`backend/.../detail_rules.py` — 39자·항목 수 한계).
 *    저쪽은 **저장할 수 있는가**를 판정하고, 여기는 **어떻게 보여줄까**를 정한다.
 *    둘이 다루는 것이 달라서 굳이 합치지 않는다 — 다만 섹션 키는 같아야 한다.
 */

/** 화면 표시 순서. `DetailInfoModal` 의 편집 순서와 같아야 사람이 대조할 수 있다. */
export const DETAIL_SECTIONS = [
  { key: '과제개요', label: '과제 개요', icon: '📌' },
  { key: '추진배경', label: '추진 배경', icon: '🔍' },
  { key: '과제목표', label: '과제 목표', icon: '🎯' },
  { key: '상세내용', label: '상세 내용', icon: '📝' },
  { key: '성과', label: '기술/경영 성과', icon: '📊' },
  { key: '산출물', label: '산출물', icon: '📦' },
  { key: '향후계획', label: '향후 계획', icon: '🗓️' },
];

/** 하위 줄(children)을 쓰지 않는 섹션 — 편집 화면이 아예 만들지 못하게 막는다. */
export const PARENT_ONLY_SECTIONS = new Set(['과제개요', '추진배경', '과제목표']);

/** 섹션과 짝이 되는 이미지 슬롯. 없는 섹션이 더 많다. */
export const SECTION_IMAGE_KEY = {
  과제개요: '개요그림',
  상세내용: '상세내용그림',
  향후계획: '향후계획그림',
};

/**
 * 섹션 하나의 값. **`enabled` 가 꺼져 있으면 없는 것으로 본다** —
 * 편집 화면이 그 섹션을 통째로 숨기므로, 보여주면 화면마다 다른 내용이 나온다.
 */
export const getSectionData = (project, key) => {
  const data = project?.[`상세정보_${key}`];
  if (!data || !data.enabled) return null;
  if (!Array.isArray(data.items) || data.items.length === 0) return null;
  return data;
};

/** 이 과제에 보여줄 내용이 하나라도 있나 (섹션 또는 짝 이미지) */
export const hasAnyDetail = (project) =>
  DETAIL_SECTIONS.some(({ key }) => {
    if (getSectionData(project, key)) return true;
    const imgKey = SECTION_IMAGE_KEY[key];
    return Boolean(imgKey && (project?.[`이미지_${imgKey}`] || []).length);
  });
