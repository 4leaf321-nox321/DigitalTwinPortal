// 성과 대분류에 따른 단위 옵션 (기술혁신 단위를 %, 건, 종으로 수정)
/*
 * 과제 편집·추가 모달의 탭 구성 (공통)
 *
 * 유효성 검사 오류가 어느 탭에 속하는지 알아야 한다.
 * 숨은 탭에서 난 오류는 사용자에게 보이지 않아 "저장 버튼이 안 먹는다"로 느껴지므로,
 * 저장 실패 시 해당 탭으로 자동 전환하고 탭에 경고 배지를 띄운다.
 */
export const FIELD_TAB = {
  사업부: 'basic', 프로세스: 'basic', 과제구분: 'basic', 과제명: 'basic',
  진행률: 'basic', 과제영역: 'basic', 진행상태: 'basic', 시작: 'basic', 종료: 'basic',
  과제참여인력목록: 'basic', 담당부서목록: 'basic', 과제PL: 'basic', 작성자: 'basic',
  성과목록: 'performance',
  액션아이템목록: 'actions',
  이슈목록: 'issues',
  선행과제목록: 'etc', 과제상세설명: 'etc',
};

export const TAB_ORDER = ['basic', 'performance', 'actions', 'issues', 'etc'];

/** 오류 객체를 받아 이동할 탭 키를 돌려준다. 없으면 null. */
export const firstErrorTab = (validationErrors) => {
  const tabs = new Set(Object.keys(validationErrors).map(k => FIELD_TAB[k] || 'basic'));
  return TAB_ORDER.find(t => tabs.has(t)) || null;
};

/** 특정 탭에 속한 오류 개수 */
export const countTabErrors = (errors, tabKey) =>
  Object.keys(errors || {}).filter(k => errors[k] && (FIELD_TAB[k] || 'basic') === tabKey).length;

export const UNIT_OPTIONS = {
  '비용절감': ['억원'],
  '리드타임단축': ['hours'],
  '제조성과': ['%', '대'],
  '기술혁신': ['%', '건', '종'], // 수정된 부분
  '품질향상': ['ppm', '건']
};

// 성과 대분류에 따른 소분류 옵션
export const SUBCATEGORY_OPTIONS = {
  '비용절감': [
    '개발비 (시료, 목업 등 자재비)',
    '개발비 (금형제조비)',
    '제조비 (설비운영비)',
    '제조비 (인건비)',
    '품질·서비스비'
  ],
  '리드타임단축': [
    '제품설계시간',
    '시험시간',
    '측정·검사시간',
    '인증시간',
    '검증·분석시간',
    '공정설계시간',
    '생산시간',
    '설비셋업시간'
  ],
  '제조성과': [
    '설비 정지율',
    '데이터 연결률',
    '인당생산대수',
    '제조유실율'
  ],
  '기술혁신': [
    '시뮬레이션 정확도',
    '시뮬레이션 대상 확대 건수',
    '시스템 등록 건수',
    '구현 건수'
  ],
  '품질향상': [
    '불량률 감소'
  ]
};

// 초기 폼 데이터 (한국어 속성명 사용)
export const INITIAL_FORM_DATA = {
  과제년도: new Date().getFullYear(),
  사업부: '',
  프로세스: '',
  과제구분: '',
  과제명: '',
  성과목록: [],
  시작: 1,
  종료: 12,
  진행상태: '미착수',
  진행률: 0,
  과제참여인력목록: [],
  담당부서목록: [],
  과제PL: '',
  작성자: '',
  과제상세설명: '',
  액션아이템목록: [],
  PoC과제여부: false,
  중점과제여부: false,
  사업부내공개여부: false,
  // 월간 진척 현황 요약
  월간진척현황: {},
  // 이전 버전과의 호환성을 위해 유지 (사용하지 않음)
  담당부서: '',
  과제참여인력: ''
};

// 초기 성과 입력 데이터 (한국어 속성명 사용)
export const INITIAL_PERFORMANCE_INPUT = {
  대분류ID: '',
  소분류ID: '',
  성과항목ID: '',
  과제기여도: '',
  현재수준: '',
  목표수준: '',
  실적수준: '',
  단위: ''
};

// 초기 인력 입력 데이터 (한국어 속성명 사용)
export const INITIAL_PERSONNEL_INPUT = {
  이름: '',
  knoxId: '',
  선택사업부: '',  // 부서 선택을 위한 사업부 (과제 사업부와 별도)
  부서: ''
};

// 성과 대분류 옵션
export const PERFORMANCE_CATEGORIES = [
  '비용절감',
  '리드타임단축',
  '제조성과',
  '기술혁신',
  '품질향상'
];