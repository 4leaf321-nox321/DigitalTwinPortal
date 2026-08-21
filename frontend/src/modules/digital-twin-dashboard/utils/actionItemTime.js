/**
 * 액션아이템의 **생성 시각**.
 *
 * 왜 여기 있나
 *     원래 `ActionItemsSection.jsx` 안에 있었는데, 그 파일은 화면 조각이라
 *     **불러오려면 JSX 를 읽을 수 있어야 한다.** 이 함수를 쓰는 숫자 계산
 *     (`execMetrics`)을 시험하려면 화면 없이 불러와야 해서 따로 뺐다.
 *     기존 자리에서도 그대로 가져다 쓸 수 있게 그쪽이 이것을 다시 내보낸다.
 *
 * ⚠️ **없으면 `null` 이다. 「없다」이지 「옛날 것이다」가 아니다.** 이 값을 쓰는
 *    쪽(`aiExistedAt`)은 모를 때 **있었던 것으로** 친다 — 예전 데이터에는 생성
 *    시각이 없어서, 없다고 보면 과거가 통째로 비어 버린다.
 */

/** 생성 시각 ISO 문자열, 모르면 null. 레거시는 id 가 `Date.now()` 밀리초였다. */
export const getActionItemCreatedAt = (item) => {
  if (!item) return null;
  if (item.createdAt) return item.createdAt;
  if (typeof item.id === 'number' && item.id > 1e12) {
    return new Date(item.id).toISOString();
  }
  return null;
};
