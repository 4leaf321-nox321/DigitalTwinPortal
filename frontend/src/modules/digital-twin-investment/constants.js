/**
 * 디지털 트윈 투자 현황 - 공용 상수
 */

// 투자 유형은 고정 목록이다. 늘어나는 건 디지털 트윈 영역뿐이라 그쪽만 설정에서 관리한다.
export const CATEGORY1_OPTIONS = ['H/W', 'S/W', '플랫폼'];

// 서버에 저장된 설정이 아직 없을 때 쓰는 디지털 트윈 영역 기본값.
// 정본은 서버(/api/digital-twin-investment/settings)에 있다.
export const DEFAULT_CATEGORY2_OPTIONS = [
  '시뮬레이션', '검증 자동화', '설계 자동화', '모니터링',
];

// 계획/실적의 단위. 표와 입력창 어디서든 이 값을 쓴다.
export const AMOUNT_UNIT = '억원';

export const EMPTY_INVESTMENT = {
  name: '',
  division: '',
  process: '',
  department: '',
  year: '',
  planAmount: '',
  actualAmount: '',
  category1: '',
  category2: '',
};

// 표·일괄등록·붙여넣기가 모두 이 한 벌의 열 정의를 본다.
export const COLUMNS = [
  { key: 'name', label: '투자명', type: 'text', width: '17%' },
  { key: 'division', label: '사업부', type: 'division', width: '10%' },
  { key: 'process', label: '프로세스', type: 'process', width: '10%' },
  { key: 'department', label: '투자부서', type: 'department', width: '11%' },
  { key: 'year', label: '투자년도', type: 'year', width: '8%' },
  { key: 'planAmount', label: `계획 (${AMOUNT_UNIT})`, type: 'amount', width: '9%' },
  { key: 'actualAmount', label: `실적 (${AMOUNT_UNIT})`, type: 'amount', width: '9%' },
  { key: 'category1', label: '투자 유형', type: 'category1', width: '10%' },
  { key: 'category2', label: '디지털 트윈 영역', type: 'category2', width: '16%' },
];

/**
 * 고른 사업부에 딸린 투자부서만 추린다.
 * 사업부를 아직 안 골랐으면 전체를, 골랐으면 그 아래 부서만 준다 —
 * 그 사업부에 등록된 부서가 없으면 빈 배열이고, 그건 대시보드 설정에
 * 부서가 없다는 뜻이지 여기서 메워 줄 일이 아니다.
 */
export const departmentsFor = (division, allDepartments = [], byDivision = {}) => {
  if (!division) return allDepartments;
  return byDivision[division] || [];
};

/** 금액 표시: 값이 없으면 '-', 있으면 소수점 이하 불필요한 0 을 떨군다. */
export const formatAmount = (value) => {
  const n = Number(value);
  if (value === '' || value === null || value === undefined || Number.isNaN(n)) return '-';
  return n.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
};
