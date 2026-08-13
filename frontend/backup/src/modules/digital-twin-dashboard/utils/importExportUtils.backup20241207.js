/**
 * 디지털 트윈 대시보드 데이터 가져오기/내보내기 유틸리티 (하이브리드 방식)
 * 
 * 📊 하이브리드 CSV 방식:
 * - Export: 성과목록을 각 행으로 분리 (플래튼닝)
 * - Import: 같은 ID 기준으로 그룹핑 후 성과목록 재조립
 * - 호환성: 기존 JSON 형식 그대로 유지
 * - 분석성: Excel 피벗테이블로 성과 분석 가능
 */

/**
 * 프로젝트 데이터를 JSON 파일로 내보내기
 * @param {Array} projects - 프로젝트 배열
 * @param {string} filename - 저장할 파일명 (확장자 제외)
 */
export const exportProjectsToJSON = (projects, filename = 'digital-twin-dashboard-data') => {
  try {
    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        version: '1.0',
        type: 'digital-twin-dashboard',
        projectCount: projects.length
      },
      projects
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.json`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(link.href);
    
    return true;
  } catch (error) {
    console.error('JSON 내보내기 실패:', error);
    throw new Error(`데이터 내보내기 중 오류가 발생했습니다: ${error.message}`);
  }
};

/**
 * 하이브리드 방식으로 프로젝트 데이터를 CSV 파일로 내보내기
 * 성과목록을 각 행으로 분리하여 분석 친화적인 형태로 저장
 * 
 * @param {Array} projects - 프로젝트 배열
 * @param {string} filename - 저장할 파일명 (확장자 제외)
 * @param {string} mode - 내보내기 모드 ('hybrid'|'legacy') 기본값: 'hybrid'
 */
export const exportProjectsToCSV = (projects, filename = 'digital-twin-dashboard-data', mode = 'hybrid') => {
  try {
    if (mode === 'legacy') {
      return exportProjectsToCSVLegacy(projects, filename);
    }

    // 하이브리드 방식 CSV 헤더 정의
    const headers = [
      'id',
      '과제년도',
      '사업부',
      '프로세스',
      '과제구분',
      '과제명',
      '과제목표',
      '시작',
      '종료',
      '진행상태',
      '과제PL',
      '작성자',
      '과제상세설명',
      'PoC과제여부',
      '중점과제여부',
      '성과순번',
      '성과_대분류',
      '성과_소분류',
      '성과_성과항목',
      '성과_과제기여도',
      '성과_현재수준',
      '성과_목표수준',
      '성과_실적수준',
      '성과_단위',
      '과제참여인력목록',
      '담당부서목록',
      '액션아이템_제목',
      '액션아이템_완료여부'
    ];

    const csvRows = [];

    // 각 프로젝트의 성과목록과 액션아이템을 플래튼닝
    projects.forEach(project => {
      const 성과목록 = project.성과목록 || [];
      const 액션아이템목록 = project.액션아이템목록 || [];

      // 과제참여인력목록을 문자열로 변환 (|로 구분)
      const participantsList = project.과제참여인력목록
        ? project.과제참여인력목록.map(p => `${p.이름}|${p.부서}`).join(',')
        : '';

      // 담당부서목록을 문자열로 변환 (,로 구분)
      const departmentsList = project.담당부서목록
        ? project.담당부서목록.join(',')
        : '';

      // 성과와 액션아이템의 최대 수를 계산
      const maxItems = Math.max(성과목록.length, 액션아이템목록.length, 1);

      // 각 성과/액션아이템에 대해 행 생성
      for (let i = 0; i < maxItems; i++) {
        const performance = 성과목록[i];
        const actionItem = 액션아이템목록[i];

        csvRows.push([
          project.id,
          project.과제년도,
          project.사업부,
          project.프로세스,
          project.과제구분,
          project.과제명,
          project.과제목표,
          project.시작,
          project.종료,
          project.진행상태,
          project.과제PL,
          project.작성자,
          project.과제상세설명,
          project.PoC과제여부,
          project.중점과제여부,
          // 성과 정보
          performance ? i + 1 : 0,
          performance ? performance.대분류 : '',
          performance ? performance.소분류 : '',
          performance ? performance.성과항목 : '',
          performance ? performance.과제기여도 : '',
          performance ? performance.현재수준 : '',
          performance ? performance.목표수준 : '',
          performance ? performance.실적수준 : '',
          performance ? performance.단위 : '',
          // 공통 정보 (첫 번째 행에만 포함)
          i === 0 ? participantsList : '',
          i === 0 ? departmentsList : '',
          // 액션아이템 정보
          actionItem ? actionItem.제목 : '',
          actionItem ? actionItem.완료여부 : ''
        ]);
      }
    });

    // CSV 문자열 생성
    const csvContent = [
      headers.join(','),
      ...csvRows.map(row => 
        row.map(field => {
          // 필드에 쉼표, 줄바꿈, 따옴표가 있으면 따옴표로 감싸기
          const str = String(field || '');
          if (str.includes(',') || str.includes('\n') || str.includes('"')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        }).join(',')
      )
    ].join('\n');

    // BOM을 추가하여 한글 인코딩 문제 해결
    const BOM = '\uFEFF';
    const csvBlob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(csvBlob);
    link.download = `${filename}_hybrid_${new Date().toISOString().split('T')[0]}.csv`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(link.href);
    
    return true;
  } catch (error) {
    console.error('CSV 내보내기 실패:', error);
    throw new Error(`CSV 내보내기 중 오류가 발생했습니다: ${error.message}`);
  }
};

/**
 * 레거시 방식으로 프로젝트 데이터를 CSV 파일로 내보내기 (기존 방식)
 * @param {Array} projects - 프로젝트 배열
 * @param {string} filename - 저장할 파일명 (확장자 제외)
 */
const exportProjectsToCSVLegacy = (projects, filename) => {
  try {
    // 레거시 CSV 헤더 정의
    const headers = [
      'id',
      '과제년도',
      '사업부',
      '프로세스',
      '과제구분',
      '과제명',
      '과제목표',
      '시작',
      '종료',
      '진행상태',
      '과제PL',
      '작성자',
      '과제상세설명',
      'PoC과제여부',
      '중점과제여부',
      '과제참여인력목록',
      '담당부서목록',
      '성과목록',
      '액션아이템목록'
    ];

    // 프로젝트 데이터를 CSV 행으로 변환
    const csvRows = projects.map(project => {
      // 과제참여인력목록을 문자열로 변환 (|로 구분)
      const participantsList = project.과제참여인력목록
        ? project.과제참여인력목록.map(p => `${p.이름}|${p.부서}`).join(',')
        : '';

      // 담당부서목록을 문자열로 변환 (,로 구분)
      const departmentsList = project.담당부서목록
        ? project.담당부서목록.join(',')
        : '';

      // 성과목록을 JSON 문자열로 변환
      const performanceList = project.성과목록
        ? JSON.stringify(project.성과목록)
        : '';

      // 액션아이템목록을 문자열로 변환 (,로 구분)
      const actionItemsList = project.액션아이템목록
        ? project.액션아이템목록.map(item => item.제목).join(',')
        : '';

      return [
        project.id,
        project.과제년도,
        project.사업부,
        project.프로세스,
        project.과제구분,
        project.과제명,
        project.과제목표,
        project.시작,
        project.종료,
        project.진행상태,
        project.과제PL,
        project.작성자,
        project.과제상세설명,
        project.PoC과제여부,
        project.중점과제여부,
        participantsList,
        departmentsList,
        performanceList,
        actionItemsList
      ];
    });

    // CSV 문자열 생성
    const csvContent = [
      headers.join(','),
      ...csvRows.map(row => 
        row.map(field => {
          const str = String(field || '');
          if (str.includes(',') || str.includes('\n') || str.includes('"')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        }).join(',')
      )
    ].join('\n');

    const BOM = '\uFEFF';
    const csvBlob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(csvBlob);
    link.download = `${filename}_legacy_${new Date().toISOString().split('T')[0]}.csv`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(link.href);
    
    return true;
  } catch (error) {
    console.error('레거시 CSV 내보내기 실패:', error);
    throw error;
  }
};

/**
 * JSON 파일에서 프로젝트 데이터 가져오기
 * @param {File} file - 업로드된 JSON 파일
 * @returns {Promise<{projects: Array}>} 파싱된 데이터
 */
export const importProjectsFromJSON = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('파일이 선택되지 않았습니다.'));
      return;
    }

    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
      reject(new Error('JSON 파일만 업로드할 수 있습니다.'));
      return;
    }

    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        
        // 데이터 구조 검증
        if (!validateImportData(data)) {
          reject(new Error('올바르지 않은 데이터 형식입니다.'));
          return;
        }

        resolve({
          projects: data.projects || [],
          metadata: data.metadata || null
        });
      } catch (error) {
        reject(new Error('JSON 파일 파싱 중 오류가 발생했습니다: ' + error.message));
      }
    };

    reader.onerror = () => {
      reject(new Error('파일 읽기 중 오류가 발생했습니다.'));
    };

    reader.readAsText(file);
  });
};

/**
 * 하이브리드 방식으로 CSV 파일에서 프로젝트 데이터 가져오기
 * @param {File} file - 업로드된 CSV 파일
 * @returns {Promise<{projects: Array}>} 파싱된 데이터
 */
export const importProjectsFromCSV = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('파일이 선택되지 않았습니다.'));
      return;
    }

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      reject(new Error('CSV 파일만 업로드할 수 있습니다.'));
      return;
    }

    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const csvText = event.target.result;
        const projects = parseCSVToProjects(csvText);
        
        if (!projects || projects.length === 0) {
          reject(new Error('유효한 프로젝트 데이터가 없습니다.'));
          return;
        }

        resolve({
          projects,
          metadata: {
            exportDate: new Date().toISOString(),
            version: '1.0',
            type: 'digital-twin-dashboard-csv-hybrid',
            projectCount: projects.length
          }
        });
      } catch (error) {
        reject(new Error('CSV 파일 파싱 중 오류가 발생했습니다: ' + error.message));
      }
    };

    reader.onerror = () => {
      reject(new Error('파일 읽기 중 오류가 발생했습니다.'));
    };

    reader.readAsText(file, 'utf-8');
  });
};

/**
 * 스마트 CSV 파싱: 하이브리드/레거시 모드 자동 감지
 * @param {string} csvText - CSV 텍스트
 * @returns {Array} 프로젝트 배열
 */
const parseCSVToProjects = (csvText) => {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length < 2) {
    throw new Error('CSV 파일에 유효한 데이터가 없습니다.');
  }

  const headers = parseCSVLine(lines[0]);
  
  // 하이브리드 모드 감지 (성과_대분류 컬럼 존재 여부)
  const isHybridMode = headers.includes('성과_대분류') || headers.includes('성과순번');
  
  console.log(`CSV 파싱 모드: ${isHybridMode ? '하이브리드' : '레거시'}`);
  
  if (isHybridMode) {
    return parseHybridCSV(lines, headers);
  } else {
    return parseLegacyCSV(lines, headers);
  }
};

/**
 * 하이브리드 방식 CSV 파싱 (성과목록이 플래튼닝된 형태)
 * @param {Array} lines - CSV 라인 배열
 * @param {Array} headers - 헤더 배열
 * @returns {Array} 프로젝트 배열
 */
const parseHybridCSV = (lines, headers) => {
  const projectGroups = new Map();

  // 각 행을 파싱하여 프로젝트별로 그룹핑
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length !== headers.length) {
      console.warn(`라인 ${i + 1}: 컬럼 수가 맞지 않습니다. (예상: ${headers.length}, 실제: ${values.length})`);
      continue;
    }

    const rowData = {};
    headers.forEach((header, index) => {
      rowData[header] = values[index];
    });

    const projectId = parseInt(rowData.id);
    if (!projectId) continue;

    // 프로젝트 기본 정보
    if (!projectGroups.has(projectId)) {
      projectGroups.set(projectId, {
        id: projectId,
        과제년도: parseInt(rowData.과제년도) || new Date().getFullYear(),
        사업부: rowData.사업부 || '',
        프로세스: rowData.프로세스 || '',
        과제구분: rowData.과제구분 || '',
        과제명: rowData.과제명 || '',
        과제목표: rowData.과제목표 || '',
        시작: parseInt(rowData.시작) || 1,
        종료: parseInt(rowData.종료) || 12,
        진행상태: rowData.진행상태 || '',
        과제PL: rowData.과제PL || '',
        작성자: rowData.작성자 || '',
        과제상세설명: rowData.과제상세설명 || '',
        PoC과제여부: parseBooleanValue(rowData.PoC과제여부),
        중점과제여부: parseBooleanValue(rowData.중점과제여부),
        성과목록: [],
        액션아이템목록: [],
        과제참여인력목록: [],
        담당부서목록: []
      });
    }

    const project = projectGroups.get(projectId);

    // 성과 정보 추가
    if (rowData.성과_대분류 && rowData.성과_대분류.trim()) {
      const performance = {
        대분류: rowData.성과_대분류 || '',
        소분류: rowData.성과_소분류 || '',
        성과항목: rowData.성과_성과항목 || '',
        과제기여도: rowData.성과_과제기여도 || '',
        현재수준: rowData.성과_현재수준 || '',
        목표수준: rowData.성과_목표수준 || '',
        실적수준: rowData.성과_실적수준 || '',
        단위: rowData.성과_단위 || ''
      };

      // 중복 성과 방지
      const isDuplicate = project.성과목록.some(p => 
        p.대분류 === performance.대분류 && 
        p.소분류 === performance.소분류 && 
        p.성과항목 === performance.성과항목
      );
      
      if (!isDuplicate) {
        project.성과목록.push(performance);
      }
    }

    // 액션아이템 정보 추가 (성과 존재 여부와 관계없이 처리)
    if (rowData.액션아이템_제목 && rowData.액션아이템_제목.trim()) {
      const actionItem = {
        id: `action_${projectId}_${project.액션아이템목록.length + 1}`,
        제목: rowData.액션아이템_제목,
        완료여부: parseBooleanValue(rowData.액션아이템_완료여부)
      };

      // 중복 액션아이템 방지
      const isDuplicate = project.액션아이템목록.some(a => a.제목 === actionItem.제목);
      if (!isDuplicate) {
        project.액션아이템목록.push(actionItem);
      }
    }

    // 과제참여인력목록 (첫 번째 행에서만 처리)
    if (project.과제참여인력목록.length === 0 && rowData.과제참여인력목록 && rowData.과제참여인력목록.trim()) {
      project.과제참여인력목록 = rowData.과제참여인력목록.split(',').map(item => {
        const [name, department] = item.trim().split('|');
        return {
          이름: name?.trim() || '',
          부서: department?.trim() || ''
        };
      }).filter(item => item.이름);
    }

    // 담당부서목록 (첫 번째 행에서만 처리)
    if (project.담당부서목록.length === 0 && rowData.담당부서목록 && rowData.담당부서목록.trim()) {
      project.담당부서목록 = rowData.담당부서목록.split(',').map(dept => dept.trim()).filter(dept => dept);
    }
  }

  return Array.from(projectGroups.values()).filter(project => project.과제명);
};

/**
 * 레거시 방식 CSV 파싱 (기존 형태)
 * @param {Array} lines - CSV 라인 배열
 * @param {Array} headers - 헤더 배열
 * @returns {Array} 프로젝트 배열
 */
const parseLegacyCSV = (lines, headers) => {
  const projects = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length !== headers.length) {
      console.warn(`라인 ${i + 1}: 컬럼 수가 맞지 않습니다.`);
      continue;
    }

    const project = {};
    headers.forEach((header, index) => {
      const value = values[index];
      
      switch (header) {
        case 'id':
          project.id = parseInt(value) || 0;
          break;
        case '과제년도':
          project.과제년도 = parseInt(value) || new Date().getFullYear();
          break;
        case '시작':
        case '종료':
          project[header] = parseInt(value) || 1;
          break;
        case 'PoC과제여부':
        case '중점과제여부':
          project[header] = parseBooleanValue(value);
          break;
        case '프로세스':
          project.프로세스 = value || '';
          break;
        case '과제참여인력목록':
          if (value && value.trim()) {
            project[header] = value.split(',').map(item => {
              const [name, department] = item.trim().split('|');
              return {
                이름: name?.trim() || '',
                부서: department?.trim() || ''
              };
            }).filter(item => item.이름);
          } else {
            project[header] = [];
          }
          break;
        case '담당부서목록':
          if (value && value.trim()) {
            project[header] = value.split(',').map(dept => dept.trim()).filter(dept => dept);
          } else {
            project[header] = [];
          }
          break;
        case '성과목록':
          if (value && value.trim()) {
            try {
              project[header] = JSON.parse(value);
            } catch (e) {
              project[header] = [];
            }
          } else {
            project[header] = [];
          }
          break;
        case '액션아이템목록':
          if (value && value.trim()) {
            project[header] = value.split(',').map((title, index) => ({
              id: `action_${project.id}_${index + 1}`,
              제목: title.trim(),
              완료여부: false
            })).filter(item => item.제목);
          } else {
            project[header] = [];
          }
          break;
        default:
          project[header] = value || '';
          break;
      }
    });

    // 필수 필드 검증
    if (project.id && project.과제명 && project.과제년도) {
      projects.push(project);
    }
  }

  return projects;
};

/**
 * 불린 값 파싱 유틸리티
 * @param {string} value - 파싱할 값
 * @returns {boolean} 불린 값
 */
const parseBooleanValue = (value) => {
  if (typeof value === 'boolean') return value;
  const str = String(value).toLowerCase().trim();
  return str === 'true' || str === '1' || str === 'yes' || str === 'y';
};

/**
 * CSV 라인을 파싱하여 배열로 변환 (따옴표 처리 포함)
 * @param {string} line - CSV 라인
 * @returns {Array} 파싱된 값 배열
 */
const parseCSVLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // 이스케이프된 따옴표
        current += '"';
        i += 2;
      } else {
        // 따옴표 시작/끝
        inQuotes = !inQuotes;
        i++;
      }
    } else if (char === ',' && !inQuotes) {
      // 컬럼 구분자
      result.push(current);
      current = '';
      i++;
    } else {
      current += char;
      i++;
    }
  }
  
  result.push(current);
  return result;
};

/**
 * 가져온 데이터의 유효성 검증
 * @param {Object} data - 가져온 데이터
 * @returns {boolean} 유효성 여부
 */
const validateImportData = (data) => {
  try {
    // 기본 구조 확인
    if (!data || typeof data !== 'object') {
      return false;
    }

    // projects 배열 확인
    if (!Array.isArray(data.projects)) {
      return false;
    }

    // 각 프로젝트의 필수 필드 확인
    for (const project of data.projects) {
      if (!project.id || !project.과제명 || !project.과제년도) {
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('데이터 검증 실패:', error);
    return false;
  }
};

/**
 * 프로젝트 데이터 병합
 * @param {Array} existingProjects - 기존 프로젝트 배열
 * @param {Array} importedProjects - 가져온 프로젝트 배열
 * @param {string} mergeMode - 병합 모드 ('replace', 'merge', 'append')
 * @returns {Array} 병합된 프로젝트 배열
 */
export const mergeProjects = (existingProjects, importedProjects, mergeMode = 'replace') => {
  switch (mergeMode) {
    case 'replace':
      // 기존 데이터를 완전히 교체
      return [...importedProjects];
      
    case 'merge':
      // ID 기준으로 병합 (중복 시 가져온 데이터로 덮어쓰기)
      const merged = [...existingProjects];
      const existingIds = new Set(existingProjects.map(p => p.id));
      
      importedProjects.forEach(importedProject => {
        const existingIndex = merged.findIndex(p => p.id === importedProject.id);
        if (existingIndex >= 0) {
          merged[existingIndex] = importedProject;
        } else {
          merged.push(importedProject);
        }
      });
      
      return merged;
      
    case 'append':
      // ID 중복 해결 후 추가
      const maxId = Math.max(0, ...existingProjects.map(p => p.id));
      const appendedProjects = importedProjects.map((project, index) => ({
        ...project,
        id: maxId + index + 1
      }));
      
      return [...existingProjects, ...appendedProjects];
      
    default:
      return existingProjects;
  }
};

/**
 * 파일 크기 검증
 * @param {File} file - 검증할 파일
 * @param {number} maxSizeMB - 최대 크기 (MB)
 * @returns {boolean} 크기 유효성 여부
 */
export const validateFileSize = (file, maxSizeMB = 10) => {
  const maxSize = maxSizeMB * 1024 * 1024; // MB to bytes
  return file.size <= maxSize;
};

/**
 * 파일 형식 검증
 * @param {File} file - 검증할 파일
 * @param {Array} allowedTypes - 허용된 파일 형식 배열
 * @returns {boolean} 형식 유효성 여부
 */
export const validateFileType = (file, allowedTypes = ['application/json']) => {
  return allowedTypes.includes(file.type) || 
         allowedTypes.some(type => file.name.toLowerCase().endsWith(type.split('/')[1]));
};

/**
 * CSV 컬럼 매핑 정보 생성
 * @param {Array} headers - CSV 헤더 배열
 * @returns {Object} 매핑 정보
 */
export const generateColumnMapping = (headers) => {
  const mapping = {
    mode: 'unknown',
    hasPerformanceColumns: false,
    hasActionItemColumns: false,
    missingColumns: [],
    extraColumns: []
  };

  // 하이브리드 모드 필수 컬럼
  const hybridRequiredColumns = ['id', '과제명', '성과_대분류'];
  const hybridOptionalColumns = ['성과순번', '성과_소분류', '성과_성과항목', '액션아이템_제목'];

  // 레거시 모드 필수 컬럼
  const legacyRequiredColumns = ['id', '과제명', '성과목록'];
  
  // 하이브리드 모드 감지
  if (headers.includes('성과_대분류') || headers.includes('성과순번')) {
    mapping.mode = 'hybrid';
    mapping.hasPerformanceColumns = true;
    mapping.hasActionItemColumns = headers.includes('액션아이템_제목');
    
    // 누락된 필수 컬럼 확인
    mapping.missingColumns = hybridRequiredColumns.filter(col => !headers.includes(col));
  } else if (headers.includes('성과목록')) {
    mapping.mode = 'legacy';
    mapping.missingColumns = legacyRequiredColumns.filter(col => !headers.includes(col));
  } else {
    mapping.mode = 'unknown';
    mapping.missingColumns = ['id', '과제명'];
  }

  return mapping;
};

/**
 * Export 모드 선택 옵션
 */
export const EXPORT_MODES = {
  HYBRID: 'hybrid',
  LEGACY: 'legacy'
};

/**
 * Export 모드별 설명
 */
export const EXPORT_MODE_DESCRIPTIONS = {
  [EXPORT_MODES.HYBRID]: {
    name: '하이브리드 방식 (권장)',
    description: '성과목록을 각 행으로 분리하여 Excel 분석에 최적화',
    pros: ['Excel 피벗테이블 분석 가능', '데이터 구조가 명확', '대용량 처리 효율적'],
    cons: ['파일 크기가 약간 클 수 있음'],
    icon: '📊'
  },
  [EXPORT_MODES.LEGACY]: {
    name: '레거시 방식',
    description: '기존 방식과 동일한 형태로 저장',
    pros: ['기존 시스템과 호환', '파일 크기 작음'],
    cons: ['Excel 분석 어려움', 'JSON 문자열 포함'],
    icon: '📄'
  }
};
