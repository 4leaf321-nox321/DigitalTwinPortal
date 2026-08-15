// 모듈 상징색을 한 곳에 둔다.
//
// 색값을 컴포넌트마다 박아 두면 모듈 색을 바꿀 때 반드시 몇 군데가 남는다 —
// 전략 모듈에서 옮겨 온 관리 화면 3개가 실제로 #7c3aed 를 열 몇 군데에 박고
// 있었다. 여기 상수로 모아 두면 그런 잔재가 안 생긴다.
//
// 모서리 반경·회색조는 포탈 공통 감각을 그대로 따른다(카드 0.5rem, 테두리
// #e2e8f0, 본문 #1e293b). 그건 모듈마다 달라야 할 이유가 없어서 토큰화하지
// 않고 각 컴포넌트에 그대로 쓴다.

export const ACCENT = '#0d9488';       // 강조 (버튼·활성 탭)
export const ACCENT_DARK = '#0f766e';  // hover
export const ACCENT_LINE = '#99f6e4';  // 점선 테두리·연한 경계
export const ACCENT_TINT = '#f0fdfa';  // 아주 옅은 배경

export const MAX_WIDTH = '1440px';     // 포탈 공통 (전략 모듈과 같다)
export const READING_WIDTH = '52rem';  // 읽고 답하는 화면은 더 좁게
