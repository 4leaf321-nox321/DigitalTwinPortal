// 사업부 정렬 순서 정의
export const DIVISION_ORDER = ['MX', 'VD', 'DA', 'NW', '의료기기'];

// 사업부별 정렬 함수
export const sortDivisions = (divisions) => {
  return divisions.sort((a, b) => {
    const aIndex = DIVISION_ORDER.indexOf(a);
    const bIndex = DIVISION_ORDER.indexOf(b);
    
    // 정의된 순서에 없는 사업부는 맨 뒤로
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    
    return aIndex - bIndex;
  });
};

// 사업부별 데이터 엔트리 정렬 함수
export const sortDivisionEntries = (entries) => {
  return entries.sort(([divisionA], [divisionB]) => {
    const aIndex = DIVISION_ORDER.indexOf(divisionA);
    const bIndex = DIVISION_ORDER.indexOf(divisionB);
    
    // 정의된 순서에 없는 사업부는 맨 뒤로
    if (aIndex === -1 && bIndex === -1) return divisionA.localeCompare(divisionB);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    
    return aIndex - bIndex;
  });
};

// 사업부 순서 인덱스 가져오기
export const getDivisionOrderIndex = (division) => {
  const index = DIVISION_ORDER.indexOf(division);
  return index === -1 ? 999 : index; // 정의되지 않은 사업부는 맨 뒤로
};
