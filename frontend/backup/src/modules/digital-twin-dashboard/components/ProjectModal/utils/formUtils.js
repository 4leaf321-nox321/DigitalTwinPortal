import { INITIAL_FORM_DATA, INITIAL_PERFORMANCE_INPUT, INITIAL_PERSONNEL_INPUT } from '../constants/formConstants';
import { generateNextProjectId, generateNextActionItemId } from '../../../data/sampleData';

// 성과 기여도 입력 유효성 검사 (퍼센트 전용)
export const validateContributionInput = (value) => {
  // 숫자, 소수점만 허용
  const numericValue = value.replace(/[^0-9.]/g, '');
  
  // 소수점은 최대 1개만 허용
  const dotCount = (numericValue.match(/\./g) || []).length;
  if (dotCount > 1) {
    const firstDotIndex = numericValue.indexOf('.');
    return numericValue.substring(0, firstDotIndex + 1) + 
           numericValue.substring(firstDotIndex + 1).replace(/\./g, '');
  }
  
  // 100 이상 입력 방지
  const numberValue = parseFloat(numericValue);
  if (!isNaN(numberValue) && numberValue > 100) {
    return '100';
  }
  
  return numericValue;
};

// 폼 유효성 검사 (새로운 인력 관리 방식, "프로세스" 필드명 사용)
export const validateForm = (formData) => {
  const newErrors = {};
  
  if (!formData.사업부) newErrors.사업부 = '사업부를 선택해주세요.';
  if (!formData.프로세스) newErrors.프로세스 = '프로세스를 선택해주세요.'; // "부문" -> "프로세스"
  if (!formData.과제구분) newErrors.과제구분 = '과제 구분을 선택해주세요.';
  if (!formData.과제명.trim()) newErrors.과제명 = '과제명을 입력해주세요.';
  
  // 진행률 검증
  if (formData.진행률 === undefined || formData.진행률 === null || formData.진행률 === '') {
    newErrors.진행률 = '진행률을 입력해주세요.';
  } else {
    const progressValue = parseFloat(formData.진행률);
    if (isNaN(progressValue)) {
      newErrors.진행률 = '진행률은 숫자로 입력해주세요.';
    } else if (progressValue < 0 || progressValue > 100) {
      newErrors.진행률 = '진행률은 0~100 사이의 값이어야 합니다.';
    }
  }
  
  // 성과 목록 검증 (선택사항)
  if (formData.성과목록.length === 0) {
    newErrors.성과목록 = '최소 1개 이상의 성과를 추가해주세요.';
  }
  
  // 새로운 인력 관리 방식 유효성 검사
  if (formData.과제참여인력목록.length === 0) {
    newErrors.과제참여인력목록 = '최소 1명 이상의 과제 참여 인력을 추가해주세요.';
  }
  if (formData.담당부서목록.length === 0) {
    newErrors.담당부서목록 = '과제 참여 인력을 추가하면 담당부서가 자동으로 생성됩니다.';
  }
  if (!formData.과제PL.trim()) newErrors.과제PL = '과제 PL을 입력해주세요.';
  
  if (formData.종료 < formData.시작) {
    newErrors.종료 = '종료월은 시작월보다 늦어야 합니다.';
  }
  
  return newErrors;
};

// 폼 데이터 처리 (새로운 인력 관리 방식, "프로세스" 필드명 사용)
export const processFormData = (formData, currentYear, existingProjects = []) => {
  // 이전 버전과의 호환성을 위해 기존 형식으로도 변환
  const 담당부서Array = formData.담당부서목록;
  const 담당자Array = formData.과제참여인력목록.map(person => person.이름);
  
  // 사업부-번호 형식의 과제 ID 생성
  const projectId = generateNextProjectId(existingProjects, formData.사업부);
  
  // 액션 아이템 데이터 처리 - ID도 새로운 형식으로 생성
  const processedActionItems = (formData.액션아이템목록 || []).map((item, index) => ({
    ...item,
    id: generateNextActionItemId(projectId, formData.액션아이템목록.slice(0, index + 1)),
    // 빈 bullet 제거
    월별내용: Object.keys(item.월별내용 || {}).reduce((acc, month) => {
      acc[month] = (item.월별내용[month] || []).filter(bullet => bullet.trim() !== '');
      return acc;
    }, {})
  }));
  
  const processedData = {
    ...formData,
    // 새로운 인력 관리 방식 데이터
    과제참여인력목록: formData.과제참여인력목록,
    담당부서목록: formData.담당부서목록,
    액션아이템목록: processedActionItems,
    // 이전 버전과의 호환성을 위한 데이터 (문자열 형태)
    담당부서: 담당부서Array.join(', '),
    담당자: 담당자Array,
    과제참여인력: 담당자Array.join(', ')
  };
  
  return {
    ...processedData,
    id: projectId, // 사업부-번호 형식의 ID
    과제년도: currentYear,
    관리자: formData.과제PL,
    시작: parseInt(formData.시작),
    종료: parseInt(formData.종료),
    진행률: parseFloat(formData.진행률) || 0 // 진행률 숫자로 변환
  };
};

// 폼 데이터 초기화 (새로운 인력 관리 방식)
export const resetFormData = (setFormData, setPerformanceInput, setErrors) => {
  setFormData(INITIAL_FORM_DATA);
  setPerformanceInput(INITIAL_PERFORMANCE_INPUT);
  setErrors({});
};

// 성과 항목 입력 유효성 검사 (모든 문자 허용)
export const validatePerformanceInput = (value) => {
  // 모든 문자 허용, 특별한 제한 없음
  return value;
};

// 숫자 입력 유효성 검사 (목표치, 실적치용)
export const validateNumericInput = (value) => {
  // 숫자, 소수점, 음수 기호만 허용하는 정규식
  const numericValue = value.replace(/[^0-9.-]/g, '');
  
  // 여러 개의 소수점이나 음수 기호 방지
  let formattedValue = numericValue;
  
  // 소수점은 최대 1개만 허용
  const dotCount = (formattedValue.match(/\./g) || []).length;
  if (dotCount > 1) {
    const firstDotIndex = formattedValue.indexOf('.');
    formattedValue = formattedValue.substring(0, firstDotIndex + 1) + 
                    formattedValue.substring(firstDotIndex + 1).replace(/\./g, '');
  }
  
  // 음수 기호는 맨 앞에서만 허용
  if (formattedValue.includes('-')) {
    const minusCount = (formattedValue.match(/-/g) || []).length;
    if (minusCount > 1 || formattedValue.indexOf('-') > 0) {
      formattedValue = formattedValue.replace(/-/g, '');
      if (numericValue.startsWith('-')) {
        formattedValue = '-' + formattedValue;
      }
    }
  }
  
  return formattedValue;
};

// 이전 버전과의 호환성을 위한 유틸리티 함수들 (사용 시 주의)
export const legacyValidateForm = (formData) => {
  const newErrors = {};
  
  if (!formData.사업부) newErrors.사업부 = '사업부를 선택해주세요.';
  if (!formData.프로세스) newErrors.프로세스 = '프로세스를 선택해주세요.'; // "부문" -> "프로세스"
  if (!formData.과제구분) newErrors.과제구분 = '과제 구분을 선택해주세요.';
  if (!formData.과제명.trim()) newErrors.과제명 = '과제명을 입력해주세요.';
  
  // 성과 목록 검증 (선택사항)
  if (formData.성과목록.length === 0) {
    newErrors.성과목록 = '최소 1개 이상의 성과를 추가해주세요.';
  }
  
  // 담당부서 및 담당자 유효성 검사 (쉼표로 구분된 값 고려)
  const deptValues = formData.담당부서.split(',').map(dept => dept.trim()).filter(dept => dept.length > 0);
  const assigneeValues = formData.과제참여인력.split(',').map(person => person.trim()).filter(person => person.length > 0);
  
  if (deptValues.length === 0) newErrors.담당부서 = '담당부서를 입력해주세요.';
  if (assigneeValues.length === 0) newErrors.과제참여인력 = '과제 참여 인력을 입력해주세요.';
  if (!formData.과제PL.trim()) newErrors.과제PL = '과제 PL을 입력해주세요.';
  
  if (formData.종료 < formData.시작) {
    newErrors.종료 = '종료월은 시작월보다 늦어야 합니다.';
  }
  
  return newErrors;
};
