import { INITIAL_FORM_DATA, INITIAL_PERFORMANCE_INPUT, INITIAL_PERSONNEL_INPUT } from '../constants/formConstants';
import { generateNextProjectId, generateNextActionItemId } from '../../../data/sampleData';
// 진행률의 0 과 미입력은 다른 뜻이다. `|| 0` 으로 다루면 미입력이 0% 로 확정된다.
import { hasLevel, levelNumber } from '../../../utils/levelValue';

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
  
  // 진행률 검증 — **비워 두는 것을 허용한다.**
  //
  // 진행률에는 '미입력' 이라는 상태가 있다(2026-08-06 결정). 운영 실측으로 살아있는
  // 과제 328건 중 204건이 미입력이고 그중 200건이 '정상진행' 이다. 필수로 두면
  // 그 과제들을 열어 다른 항목만 고쳐도 저장이 막히거나, 예전처럼 조용히 0 이 된다.
  // 값을 넣었을 때의 형식·범위 검사는 그대로다.
  if (hasLevel(formData.진행률)) {
    const progressValue = parseFloat(formData.진행률);
    if (isNaN(progressValue)) {
      newErrors.진행률 = '진행률은 숫자로 입력해주세요.';
    } else if (progressValue < 0 || progressValue > 100) {
      newErrors.진행률 = '진행률은 0~100 사이의 값이어야 합니다.';
    }
  }
  
  // 성과 목록 검증 - 선택사항 (성과 없이도 과제 추가 가능)
  // if (formData.성과목록.length === 0) {
  //   newErrors.성과목록 = '최소 1개 이상의 성과를 추가해주세요.';
  // }

  // 새로운 인력 관리 방식 유효성 검사
  if (formData.과제참여인력목록.length === 0) {
    newErrors.과제참여인력목록 = '최소 1명 이상의 과제 참여 인력을 추가해주세요.';
  }
  if (formData.담당부서목록.length === 0) {
    newErrors.담당부서목록 = '과제 참여 인력을 추가하면 담당부서가 자동으로 생성됩니다.';
  }
  if (!formData.과제PL.trim()) newErrors.과제PL = '과제 PL을 입력해주세요.';

  // 문자열일 수 있으므로 숫자로 변환하여 비교
  const startMonth = parseInt(formData.시작, 10);
  const endMonth = parseInt(formData.종료, 10);
  if (endMonth < startMonth) {
    newErrors.종료 = '종료월은 시작월보다 늦어야 합니다.';
  }

  return newErrors;
};

// 폼 데이터 처리 (새로운 인력 관리 방식, "프로세스" 필드명 사용)
export const processFormData = (formData, currentYear, existingProjects = [], existingProjectId = null) => {
  // 이전 버전과의 호환성을 위해 기존 형식으로도 변환
  const 담당부서Array = formData.담당부서목록;
  const 담당자Array = formData.과제참여인력목록.map(person => person.이름);

  // 사업부-번호 형식의 과제 ID 생성 (편집 모드면 기존 ID 사용)
  const projectId = existingProjectId || generateNextProjectId(existingProjects, formData.사업부);

  // 기존 프로젝트들의 모든 액션 아이템 수집
  const allExistingActionItems = existingProjects.flatMap(project =>
    project.액션아이템목록 || []
  );

  // 액션 아이템 데이터 처리 - ID도 새로운 형식으로 생성
  // reduce를 사용하여 순차적으로 처리하면서 누적
  const processedActionItems = (formData.액션아이템목록 || []).reduce((acc, item) => {
    // 이미 생성된 액션 아이템 + 현재까지 처리된 액션 아이템
    const existingItems = [...allExistingActionItems, ...acc];

    const processedItem = {
      ...item,
      // ⚠️ `id` 는 **매 저장마다 다시 매겨진다** — 편집 저장에서는 `existingProjects` 로
      //    빈 배열이 와서 항상 1..N 이 된다. 그래서 id 는 정체성이 아니라 순번이다.
      //    정체성은 `uuid` 이고 `...item` 으로 그대로 따라온다. **지우지 말 것** —
      //    없이 보내면 서버가 기존 값에서 물려받아 채우지만(routes_v2._assign_action_uuids),
      //    그 물려받기는 제목·자리 추측이라 완전하지 않다.
      id: generateNextActionItemId(projectId, existingItems),
      // 빈 bullet 제거
      월별내용: Object.keys(item.월별내용 || {}).reduce((monthAcc, month) => {
        monthAcc[month] = (item.월별내용[month] || []).filter(bullet => bullet.trim() !== '');
        return monthAcc;
      }, {})
    };

    return [...acc, processedItem];
  }, []);
  
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
    과제년도: parseInt(formData.과제년도) || currentYear, // 폼에서 입력한 연도 사용, 없으면 현재 연도
    // `관리자` 는 여기서 보내지 않는다. 과제PL 의 사본일 뿐이고 입력 칸도 없는데
    // 화면이 값을 실어 보내는 바람에, AI 가 따로 바꿔 놓은 값을 다음 저장 때
    // 조용히 덮어쓰고 있었다. 이제 **서버가 과제PL 에서 파생시킨다**
    // (routes_v2._derive_manager). 보내면 불변 필드라 `ignored` 로 돌아온다.
    시작: parseInt(formData.시작),
    종료: parseInt(formData.종료),
    // 완료면 무조건 100%. 그 외에는 **넣은 값 그대로** — 비어 있으면 null(미입력)이다.
    // `parseFloat(v) || 0` 이면 미입력도 0 도 전부 0 이 되어, 편집창을 열어 저장만
    // 해도 미입력 과제가 0% 로 확정됐다. levelNumber 는 0 을 0 으로, 빈 값을 null 로 준다.
    진행률: formData.진행상태 === '완료' ? 100 : levelNumber(formData.진행률)
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

// 상세 과제 정보의 총 줄 수 계산
const DETAIL_SECTION_KEYS = ['과제개요', '추진배경', '과제목표', '상세내용', '성과', '산출물', '향후계획'];

export const countDetailLines = (project) => {
  let count = 0;
  for (const key of DETAIL_SECTION_KEYS) {
    const section = project[`상세정보_${key}`];
    if (!section || !section.enabled) continue;
    count += 1; // 섹션 제목 (□ 과제 개요 등)
    const items = Array.isArray(section.items) ? section.items : [];
    for (const item of items) {
      if (typeof item === 'string') {
        if (item.trim()) count += 1;
      } else {
        if ((item.text ?? '').trim()) count += 1;
        const children = Array.isArray(item.children) ? item.children : [];
        for (const child of children) {
          const t = typeof child === 'string' ? child : (child.text ?? '');
          if (t.trim()) count += 1;
        }
      }
    }
  }
  return count;
};

// 이전 버전과의 호환성을 위한 유틸리티 함수들 (사용 시 주의)
export const legacyValidateForm = (formData) => {
  const newErrors = {};
  
  if (!formData.사업부) newErrors.사업부 = '사업부를 선택해주세요.';
  if (!formData.프로세스) newErrors.프로세스 = '프로세스를 선택해주세요.'; // "부문" -> "프로세스"
  if (!formData.과제구분) newErrors.과제구분 = '과제 구분을 선택해주세요.';
  if (!formData.과제명.trim()) newErrors.과제명 = '과제명을 입력해주세요.';
  
  // 성과 목록 검증 - 선택사항 (성과 없이도 과제 추가 가능)
  // if (formData.성과목록.length === 0) {
  //   newErrors.성과목록 = '최소 1개 이상의 성과를 추가해주세요.';
  // }

  // 담당부서 및 담당자 유효성 검사 (쉼표로 구분된 값 고려)
  const deptValues = formData.담당부서.split(',').map(dept => dept.trim()).filter(dept => dept.length > 0);
  const assigneeValues = formData.과제참여인력.split(',').map(person => person.trim()).filter(person => person.length > 0);
  
  if (deptValues.length === 0) newErrors.담당부서 = '담당부서를 입력해주세요.';
  if (assigneeValues.length === 0) newErrors.과제참여인력 = '과제 참여 인력을 입력해주세요.';
  if (!formData.과제PL.trim()) newErrors.과제PL = '과제 PL을 입력해주세요.';

  // 문자열일 수 있으므로 숫자로 변환하여 비교
  const startMonth = parseInt(formData.시작, 10);
  const endMonth = parseInt(formData.종료, 10);
  if (endMonth < startMonth) {
    newErrors.종료 = '종료월은 시작월보다 늦어야 합니다.';
  }

  return newErrors;
};
