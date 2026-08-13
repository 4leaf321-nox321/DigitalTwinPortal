/**
 * 디지털 트윈 대시보드 데이터 가져오기/내보내기 유틸리티 (4테이블 분리 방식 + CSV 지원)
 * 
 * 📊 4테이블 분리 방식:
 * - [PROJECTS]: 기본 프로젝트 정보
 * - [PERFORMANCES]: 프로젝트별 성과 정보 (project_id로 연결)
 * - [ACTION_ITEMS]: 프로젝트별 액션아이템 정보 (project_id로 연결)
 * - [TEAM_MEMBERS]: 프로젝트별 참여인력 정보 (project_id로 연결)
 * 
 * 장점:
 * - Excel에서 섹션별 독립 편집 가능
 * - 중복 데이터 최소화 (정규화된 구조)
 * - 명확한 관계 구조 (project_id 연결)
 * - 각 테이블별 특화 필드 추가 용이
 * - 섹션별 피벗테이블 분석 최적화
 */

// projectPerformanceLink 유틸리티 함수 import
import { getProjectPerformancesWithData } from './projectPerformanceLink';

// 📢 브라우저 보안 경고 필터링 (HTTP 환경에서 data URL 사용 시 발생하는 경고 숨김)
(() => {
  const originalWarn = console.warn;
  const originalError = console.error;
  
  // Chrome DevTools에서 직접 출력되는 메시지도 가로채기
  const originalLog = console.log;
  
  console.warn = function(...args) {
    const message = String(args[0] || '');
    if (message.includes('loaded over an insecure connection') ||
        message.includes('This file should be served over HTTPS') ||
        message.includes('data:application/json') ||
        message.includes('data:text/csv')) {
      return; // HTTP 환경 data URL 관련 경고 무시
    }
    originalWarn.apply(console, args);
  };
  
  console.error = function(...args) {
    const message = String(args[0] || '');
    if (message.includes('loaded over an insecure connection') ||
        message.includes('This file should be served over HTTPS')) {
      return; // HTTP 환경 data URL 관련 에러 무시
    }
    originalError.apply(console, args);
  };
  
  console.log = function(...args) {
    const message = String(args[0] || '');
    if (message.includes('The file at \'data:') ||
        message.includes('loaded over an insecure connection') ||
        message.includes('This file should be served over HTTPS')) {
      return; // data URL 관련 로그 메시지도 무시
    }
    originalLog.apply(console, args);
  };
  
  // 추가로 window.console도 오버라이드
  if (typeof window !== 'undefined' && window.console) {
    window.console.warn = console.warn;
    window.console.error = console.error;
    window.console.log = console.log;
  }
})();

/**
 * Export 모드 선택 옵션
 */
export const EXPORT_MODES = {
  MULTI_TABLE: 'multi_table',
  LEGACY: 'legacy',
  JSON: 'json'
};

/**
 * HTTPS가 아닌 환경에서 안전한 파일 다운로드
 * @param {string} content - 파일 내용
 * @param {string} filename - 파일명
 * @param {string} mimeType - MIME 타입
 * @param {boolean} addBOM - UTF-8 BOM 추가 여부 (CSV 한글 지원용)
 */
const secureDownload = (content, filename, mimeType, addBOM = false) => {
  try {
    // UTF-8 BOM 추가 (CSV 파일 한글 깨짐 방지)
    let finalContent = content;
    if (addBOM) {
      const BOM = '\uFEFF'; // UTF-8 BOM
      finalContent = BOM + content;
    }
    
    // 먼저 Blob 방식 시도 (더 안전하고 경고 없음)
    const blob = new Blob([finalContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // 메모리 해제
    setTimeout(() => URL.revokeObjectURL(url), 100);
    
    return true;
  } catch (blobError) {
    console.warn('Blob 다운로드 실패, data URL 방식으로 시도:', blobError);
    
    try {
      // Blob 실패 시 data URL 방식 사용
      let finalContent = content;
      if (addBOM) {
        const BOM = '\uFEFF';
        finalContent = BOM + content;
      }
      
      const dataUrl = `data:${mimeType};charset=utf-8,${encodeURIComponent(finalContent)}`;
      
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = filename;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      return true;
    } catch (dataError) {
      console.error('모든 다운로드 방식 실패:', dataError);
      
      // 최후의 수단: 새 창에 내용 표시
      try {
        const newWindow = window.open();
        if (newWindow) {
          newWindow.document.write(`
            <html>
              <head><title>${filename}</title></head>
              <body>
                <h3>파일 내용 (복사해서 저장하세요):</h3>
                <textarea style="width:100%; height:80vh;" readonly>${content}</textarea>
                <p>위 내용을 복사하여 ${filename} 파일로 저장하세요.</p>
              </body>
            </html>
          `);
          newWindow.document.close();
        }
      } catch (popupError) {
        console.error('Popup fallback 실패:', popupError);
        // 마지막 수단: 콘솔에 출력
        console.log(`File content for ${filename}:`, content);
        alert(`파일 다운로드에 실패했습니다. 개발자 도구 콘솔에서 내용을 확인하세요.\n파일명: ${filename}`);
      }
      return false;
    }
  }
};
export const EXPORT_MODE_DESCRIPTIONS = {
  [EXPORT_MODES.MULTI_TABLE]: {
    name: '4테이블 분리 방식 (권장)',
    description: '프로젝트를 4개 테이블로 분리하여 Excel 편집에 최적화',
    pros: ['Excel 섹션별 독립 편집', '중복 데이터 최소화', '관계 구조 명확', '확장성 우수'],
    cons: ['기존 방식과 다름'],
    icon: '🎯'
  },
  [EXPORT_MODES.LEGACY]: {
    name: '기존 방식',
    description: '기존 방식과 동일한 형태로 저장',
    pros: ['기존 시스템과 호환'],
    cons: ['Excel 편집 어려움', '중복 데이터 많음'],
    icon: '📄'
  },
  [EXPORT_MODES.JSON]: {
    name: 'JSON 통합 형식',
    description: '프로젝트와 성과를 분리된 구조로 저장하여 관리 효율성 극대화',
    pros: ['데이터 정규화', '중복 제거', '확장성 우수', '관계 구조 명확'],
    cons: ['기존 방식과 다름'],
    icon: '🗃️'
  }
};

/**
 * 프로젝트 데이터를 JSON 파일로 내보내기
 * @param {Array} projects - 프로젝트 배열
 * @param {Array} performances - 성과 항목 배열 (선택사항)
 * @param {string} filename - 저장할 파일명 (확장자 제외)
 */
export const exportProjectsToJSON = (projects, performances = [], filename = 'digital-twin-dashboard') => {
  try {
    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        version: '3.0',
        type: 'digital-twin-dashboard-v3',
        projectCount: projects.length,
        performanceCount: performances.length,
        format: 'json'
      },
      projects: projects.map(project => ({
        ...project,
        // 성과목록을 ID 참조로 변환 (이미 ID 형태라면 그대로 유지)
        성과목록: project.성과목록?.map(perf => {
          if (typeof perf === 'string' || perf.id) {
            return perf; // 이미 ID 형태
          }
          // 레거시 형태인 경우 ID 찾기
          const foundPerf = performances.find(p => 
            p.성과항목 === perf.성과항목 && 
            p.대분류 === perf.대분류 && 
            p.소분류 === perf.소분류
          );
          return foundPerf ? {
            id: foundPerf.id,
            과제기여도: perf.과제기여도 || '100',
            실적수준: perf.실적수준 || ''
          } : perf;
        }) || []
      })),
      performances
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const fullFilename = `${filename}_${new Date().toISOString().split('T')[0]}.json`;
    
    const success = secureDownload(dataStr, fullFilename, 'application/json');
    
    if (success) {
      console.log(`✅ JSON 파일 내보내기 완료: ${fullFilename}`);
      console.log(`📊 내보낸 데이터:`, {
        projects: projects.length,
        performances: performances.length
      });
    }
    
    return success;
  } catch (error) {
    console.error('❌ JSON 파일 내보내기 실패:', error);
    return false;
  }
};

/**
 * 프로젝트 데이터를 CSV 파일로 내보내기 (4테이블 분리 방식)
 * @param {Array} projects - 프로젝트 배열
 * @param {string} filename - 저장할 파일명 (확장자 제외)
 * @param {string} mode - Export 모드 (EXPORT_MODES 중 선택)
 */
export const exportProjectsToCSV = (projects, filename = 'digital-twin-dashboard-data', mode = EXPORT_MODES.MULTI_TABLE) => {
  try {
    console.log(`🔄 CSV 내보내기 시작 (모드: ${mode}):`, { 
      projects: projects.length,
      filename 
    });

    let csvContent = '';

    if (mode === EXPORT_MODES.MULTI_TABLE) {
      // 4테이블 분리 방식 - 글로벌 성과 데이터 로드는 generateMultiTableCSV 내부에서 처리
      csvContent = generateMultiTableCSV(projects);
    } else {
      // 기존 방식 (Legacy)
      csvContent = generateLegacyCSV(projects);
    }

    const fullFilename = `${filename}.csv`;
    const success = secureDownload(csvContent, fullFilename, 'text/csv;charset=utf-8', true); // BOM 추가
    
    if (success) {
      console.log(`✅ CSV 파일 내보내기 완료: ${fullFilename}`);
    }
    
    return success;
  } catch (error) {
    console.error('❌ CSV 파일 내보내기 실패:', error);
    return false;
  }
};

/**
 * 4테이블 분리 방식 CSV 생성
 * @param {Array} projects - 프로젝트 배열
 * @returns {string} CSV 내용
 */
const generateMultiTableCSV = (projects) => {
  // localStorage에서 글로벌 성과 데이터 로드
  let globalPerformances = [];
  try {
    const storedPerformances = localStorage.getItem('digitalTwinDashboard_performances');
    globalPerformances = storedPerformances ? JSON.parse(storedPerformances) : [];
    console.log(`🔗 generateMultiTableCSV에서 글로벌 성과 데이터 로드: ${globalPerformances.length}개`);
  } catch (error) {
    console.warn('⚠️ generateMultiTableCSV에서 글로벌 성과 데이터 로드 실패:', error);
    globalPerformances = [];
  }

  const sections = [];

  // 1. [PROJECTS] 섹션
  sections.push('[PROJECTS]');
  sections.push(generateProjectsCSV(projects));
  sections.push(''); // 빈 줄

  // 2. [PERFORMANCES] 섹션 (글로벌 성과 데이터 전달)
  sections.push('[PERFORMANCES]');
  sections.push(generatePerformancesCSV(projects, globalPerformances));
  sections.push(''); // 빈 줄

  // 3. [ACTION_ITEMS] 섹션
  sections.push('[ACTION_ITEMS]');
  sections.push(generateActionItemsCSV(projects));
  sections.push(''); // 빈 줄

  // 4. [TEAM_MEMBERS] 섹션
  sections.push('[TEAM_MEMBERS]');
  sections.push(generateTeamMembersCSV(projects));

  return sections.join('\n');
};

/**
 * 기존 방식 CSV 생성 (Legacy)
 * @param {Array} projects - 프로젝트 배열
 * @returns {string} CSV 내용
 */
const generateLegacyCSV = (projects) => {
  const headers = [
    'id', '과제년도', '사업부', '프로세스', '과제구분', '과제명', '과제목표',
    '시작', '종료', '진행상태', '과제PL', '작성자', '과제상세설명',
    'PoC과제여부', '중점과제여부', '성과목록', '액션아이템목록', '과제참여인력목록'
  ];

  const rows = projects.map(project => [
    project.id || '',
    project.과제년도 || '',
    project.사업부 || '',
    project.프로세스 || '',
    project.과제구분 || '',
    project.과제명 || '',
    project.과제목표 || '',
    project.시작 || '',
    project.종료 || '',
    project.진행상태 || '',
    project.과제PL || '',
    project.작성자 || '',
    project.과제상세설명 || '',
    project.PoC과제여부 || false,
    project.중점과제여부 || false,
    (project.성과목록 || []).map(p => `${p.대분류}>${p.소분류}>${p.성과항목}`).join(';'),
    (project.액션아이템목록 || []).map(a => a.제목).join(';'),
    (project.과제참여인력목록 || []).map(m => `${m.이름}(${m.부서})`).join(';')
  ]);

  return [headers, ...rows].map(row => 
    row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')
  ).join('\n');
};

/**
 * PROJECTS 테이블 CSV 생성
 * @param {Array} projects - 프로젝트 배열
 * @returns {string} CSV 내용
 */
const generateProjectsCSV = (projects) => {
  const headers = [
    'id', '과제년도', '사업부', '프로세스', '과제구분', '과제명', '과제목표', 
    '시작', '종료', '진행상태', '과제PL', '작성자', '과제상세설명', 
    'PoC과제여부', '중점과제여부'
  ];

  const rows = projects.map(project => [
    project.id || '',
    project.과제년도 || '',
    project.사업부 || '',
    project.프로세스 || '',
    project.과제구분 || '',
    project.과제명 || '',
    project.과제목표 || '',
    project.시작 || '',
    project.종료 || '',
    project.진행상태 || '',
    project.과제PL || '',
    project.작성자 || '',
    project.과제상세설명 || '',
    project.PoC과제여부 || false,
    project.중점과제여부 || false
  ]);

  return [headers, ...rows].map(row => 
    row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')
  ).join('\n');
};

/**
 * PERFORMANCES 테이블 CSV 생성 (확장된 필드 포함, 글로벌 성과 항목 연결)
 * @param {Array} projects - 프로젝트 배열
 * @param {Array} globalPerformances - 글로벌 성과 아이템 배열 (선택사항)
 * @returns {string} CSV 내용
 */
const generatePerformancesCSV = (projects, globalPerformances = null) => {
  console.log('📊 PERFORMANCES CSV 생성 시작, 프로젝트 수:', projects.length);
  
  // 글로벌 성과 데이터가 없으면 localStorage에서 로드
  if (!globalPerformances) {
    try {
      const storedPerformances = localStorage.getItem('digitalTwinDashboard_performances');
      globalPerformances = storedPerformances ? JSON.parse(storedPerformances) : [];
      console.log(`🔗 localStorage에서 글로벌 성과 아이템 로드: ${globalPerformances.length}개`);
    } catch (error) {
      console.warn('⚠️ localStorage에서 글로벌 성과 데이터 로드 실패:', error);
      globalPerformances = [];
    }
  } else {
    console.log(`🔗 매개변수로 전달된 글로벌 성과 아이템: ${globalPerformances.length}개`);
  }
  
  const headers = [
    'project_id',    // 과제ID
    '과제명',        // 과제명 추가
    '사업부',        // 사업부 추가
    '순번',          // 성과 순번
    '대분류',        // 성과 대분류
    '소분류',        // 성과 소분류
    '성과항목',      // 성과항목명
    '과제기여도',    // 이 과제가 해당 성과에 기여하는 정도 (%)
    '현재수준',      // 현재 달성 수준
    '목표수준',      // 목표 달성 수준
    '실적수준',      // 실제 달성된 수준
    '단위',          // 측정 단위
    '설명',          // 성과 설명
    '성과타입',      // 성과 유형 (대분류와 동일하지만 명시적 표기)
    '진행상태',      // 프로젝트 진행상태
    'PL담당자'       // 프로젝트 리더
  ];

  const rows = [];
  let totalPerformances = 0;
  
  projects.forEach(project => {
    console.log(`\n📁 프로젝트 처리: ${project.과제명} (ID: ${project.id})`);
    console.log(`  원본 성과목록:`, project.성과목록);
    
    // getProjectPerformancesWithData 함수로 실제 성과 데이터와 연결
    const linkedPerformances = getProjectPerformancesWithData(project, globalPerformances);
    console.log(`  🔗 연결된 성과목록:`, linkedPerformances);
    
    if (linkedPerformances && linkedPerformances.length > 0) {
      linkedPerformances.forEach((performance, index) => {
        console.log(`    🎯 성과 ${index + 1}:`, {
          대분류: performance.대분류,
          소분류: performance.소분류,
          성과항목: performance.성과항목,
          과제기여도: performance.과제기여도,
          현재수준: performance.현재수준,
          목표수준: performance.목표수준,
          실적수준: performance.실적수준,
          단위: performance.단위,
          설명: performance.설명
        });
        
        rows.push([
          project.id || '',                           // project_id
          project.과제명 || '',                       // 과제명
          project.사업부 || '',                       // 사업부
          index + 1,                                  // 순번
          performance.대분류 || '',                   // 대분류
          performance.소분류 || '',                   // 소분류
          performance.성과항목 || '',                 // 성과항목
          performance.과제기여도 || '',               // 과제기여도
          performance.현재수준 || '',                 // 현재수준
          performance.목표수준 || '',                 // 목표수준
          performance.실적수준 || '',                 // 실적수준
          performance.단위 || '',                     // 단위
          performance.설명 || '',                     // 설명
          performance.대분류 || '',                   // 성과타입 (대분류와 동일)
          project.진행상태 || '',                     // 진행상태
          project.과제PL || ''                        // PL담당자
        ]);
        totalPerformances++;
      });
    } else {
      console.log(`  ⚠️ 성과 항목이 없는 프로젝트: ${project.과제명}`);
      // 성과가 없는 프로젝트도 한 줄 추가 (분석 시 참고용)
      rows.push([
        project.id || '',           // project_id
        project.과제명 || '',       // 과제명
        project.사업부 || '',       // 사업부
        0,                         // 순번 (성과 없음을 표시)
        '',                        // 대분류
        '',                        // 소분류
        '성과 없음',               // 성과항목
        '',                        // 과제기여도
        '',                        // 현재수준
        '',                        // 목표수준
        '',                        // 실적수준
        '',                        // 단위
        '',                        // 설명
        '',                        // 성과타입
        project.진행상태 || '',     // 진행상태
        project.과제PL || ''        // PL담당자
      ]);
    }
  });

  console.log(`✅ PERFORMANCES CSV 생성 완료: 총 ${totalPerformances}개 성과 항목, ${rows.length}개 행`);
  
  return [headers, ...rows].map(row => 
    row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')
  ).join('\n');
};

/**
 * ACTION_ITEMS 테이블 CSV 생성 (간소화된 버전)
 * @param {Array} projects - 프로젝트 배열
 * @returns {string} CSV 내용
 */
const generateActionItemsCSV = (projects) => {
  const headers = [
    'project_id', '순번', '제목', '완료여부'
  ];

  const rows = [];
  projects.forEach(project => {
    if (project.액션아이템목록 && project.액션아이템목록.length > 0) {
      project.액션아이템목록.forEach((item, index) => {
        rows.push([
          project.id || '',
          index + 1,
          item.제목 || '',
          item.완료여부 || false
        ]);
      });
    }
  });

  return [headers, ...rows].map(row => 
    row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')
  ).join('\n');
};

/**
 * TEAM_MEMBERS 테이블 CSV 생성 (간소화된 버전)
 * @param {Array} projects - 프로젝트 배열
 * @returns {string} CSV 내용
 */
const generateTeamMembersCSV = (projects) => {
  const headers = [
    'project_id', '순번', '이름', '부서'
  ];

  const rows = [];
  projects.forEach(project => {
    if (project.과제참여인력목록 && project.과제참여인력목록.length > 0) {
      project.과제참여인력목록.forEach((member, index) => {
        rows.push([
          project.id || '',
          index + 1,
          member.이름 || '',
          member.부서 || ''
        ]);
      });
    }
  });

  return [headers, ...rows].map(row => 
    row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')
  ).join('\n');
};

/**
 * CSV 문자열에서 프로젝트 데이터 가져오기
 * @param {string} csvText - CSV 텍스트
 * @returns {Promise<{projects: Array, performances: Array}>} 파싱된 데이터
 */
export const importProjectsFromCSV = async (csvText) => {
  try {
    console.log('🔄 CSV 데이터 가져오기 시작');
    
    // CSV 텍스트가 4테이블 분리 방식인지 확인
    if (csvText.includes('[PROJECTS]')) {
      return await importMultiTableCSV(csvText);
    } else {
      return await importLegacyCSV(csvText);
    }
  } catch (error) {
    console.error('❌ CSV 데이터 가져오기 실패:', error);
    throw error;
  }
};

/**
 * 4테이블 분리 방식 CSV 가져오기
 * @param {string} csvText - CSV 텍스트
 * @returns {Promise<{projects: Array, performances: Array}>} 프로젝트 배열
 */
const importMultiTableCSV = async (csvText) => {
  console.log('📊 4테이블 분리 방식 CSV 파싱 시작');
  
  const sections = parseCSVSections(csvText);
  
  const projects = sections.PROJECTS || [];
  const performances = sections.PERFORMANCES || [];
  const actionItems = sections.ACTION_ITEMS || [];
  const teamMembers = sections.TEAM_MEMBERS || [];
  
  console.log('📊 섹션별 데이터 개수:', {
    projects: projects.length,
    performances: performances.length,
    actionItems: actionItems.length,
    teamMembers: teamMembers.length
  });
  
  // 프로젝트에 관련 데이터 연결
  const enrichedProjects = projects.map(project => {
    const projectId = String(project.id);
    
    return {
      ...project,
      성과목록: performances
        .filter(p => String(p.project_id) === projectId && p.순번 > 0) // 순번이 0인 것은 "성과 없음" 항목이므로 제외
        .map(p => ({
          대분류: p.대분류,
          소분류: p.소분류,
          성과항목: p.성과항목,
          과제기여도: p.과제기여도,
          현재수준: p.현재수준,
          목표수준: p.목표수준,
          실적수준: p.실적수준,
          단위: p.단위
        })),
      액션아이템목록: actionItems
        .filter(a => String(a.project_id) === projectId)
        .map(a => ({
          제목: a.제목,
          완료여부: parseBoolean(a.완료여부)
        })),
      과제참여인력목록: teamMembers
        .filter(m => String(m.project_id) === projectId)
        .map(m => ({
          이름: m.이름,
          부서: m.부서
        }))
    };
  });
  
  console.log('✅ 4테이블 분리 방식 CSV 파싱 완료:', enrichedProjects.length);
  return {
    projects: enrichedProjects,
    performances: [],
    metadata: {
      exportDate: new Date().toISOString(),
      version: '3.0',
      type: 'csv-import',
      projectCount: enrichedProjects.length
    }
  };
};

/**
 * 기존 방식 CSV 가져오기
 * @param {string} csvText - CSV 텍스트
 * @returns {Promise<{projects: Array, performances: Array}>} 프로젝트 배열
 */
const importLegacyCSV = async (csvText) => {
  console.log('📄 기존 방식 CSV 파싱 시작');
  
  const data = parseCSVData([csvText]);
  
  const projects = data.map(row => ({
    id: row.id,
    과제명: row.과제명,
    사업부: row.사업부,
    프로세스: row.프로세스,
    과제구분: row.과제구분,
    시작: row.시작,
    종료: row.종료,
    진행상태: row.진행상태,
    총예산: row.총예산,
    집행액: row.집행액,
    잔액: row.잔액,
    예산진행률: row.예산진행률,
    상세내용: row.상세내용,
    기대효과: row.기대효과,
    위험요소: row.위험요소,
    성과목록: parsePerformanceList(row.성과목록),
    액션아이템목록: parseActionItemList(row.액션아이템목록),
    과제참여인력목록: parseTeamMemberList(row.과제참여인력목록)
  }));
  
  console.log('✅ 기존 방식 CSV 파싱 완료:', projects.length);
  return {
    projects,
    performances: [],
    metadata: {
      exportDate: new Date().toISOString(),
      version: '3.0',
      type: 'legacy-csv-import',
      projectCount: projects.length
    }
  };
};

/**
 * CSV 섹션별 파싱
 * @param {string} csvText - CSV 텍스트
 * @returns {Object} 섹션별 데이터
 */
const parseCSVSections = (csvText) => {
  console.log('🔍 CSV 섹션 파싱 시작', {
    csvText: typeof csvText,
    length: csvText?.length || 0,
    sample: csvText ? csvText.substring(0, 200) : 'null/undefined'
  });

  if (typeof csvText !== 'string') {
    throw new Error(`parseCSVSections: csvText가 문자열이 아닙니다. 타입: ${typeof csvText}`);
  }

  const lines = csvText.split('\n').map(line => line.trim()).filter(line => line);
  const sections = {};
  let currentSection = null;
  let currentData = [];

  console.log(`총 ${lines.length}개 라인 처리 시작`);

  lines.forEach((line, index) => {
    // 섹션 헤더 감지 [SECTION_NAME]
    const sectionMatch = line.match(/^\[(\w+)\]$/);
    if (sectionMatch) {
      console.log(`라인 ${index + 1}: 섹션 헤더 발견 [${sectionMatch[1]}]`);
      
      // 이전 섹션 데이터 저장
      if (currentSection && currentData.length > 0) {
        console.log(`섹션 ${currentSection} 데이터 저장: ${currentData.length}개 라인`);
        sections[currentSection] = parseCSVData(currentData);
      }
      
      // 새 섹션 시작
      currentSection = sectionMatch[1];
      currentData = [];
      return;
    }

    // 현재 섹션에 데이터 추가
    if (currentSection && line) {
      currentData.push(line);
    }
  });

  // 마지막 섹션 저장
  if (currentSection && currentData.length > 0) {
    console.log(`마지막 섹션 ${currentSection} 데이터 저장: ${currentData.length}개 라인`);
    sections[currentSection] = parseCSVData(currentData);
  }

  console.log('섹션 파싱 완료:', {
    sectionsFound: Object.keys(sections),
    sectionCounts: Object.entries(sections).map(([name, data]) => `${name}: ${data.length}`)
  });

  return sections;
};

/**
 * CSV 데이터 파싱 (헤더 + 데이터 행)
 * @param {Array} lines - CSV 라인 배열
 * @returns {Array} 파싱된 데이터 객체 배열
 */
const parseCSVData = (lines) => {
  if (!lines || lines.length === 0) return [];
  
  const [headerLine, ...dataLines] = lines;
  const headers = parseCSVLine(headerLine);
  
  console.log(`CSV 데이터 파싱: 헤더 ${headers.length}개, 데이터 ${dataLines.length}개 라인`);
  
  return dataLines.map((line, index) => {
    const values = parseCSVLine(line);
    const row = {};
    
    headers.forEach((header, i) => {
      const value = values[i] || '';
      row[header] = processFieldValue(header, value);
    });
    
    return row;
  });
};

/**
 * CSV 라인을 필드별로 분할
 * @param {string} line - CSV 라인
 * @returns {Array} 필드 배열
 */
const parseCSVLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // 다음 따옴표 건너뛰기
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
};

/**
 * 필드값 처리 (타입 변환)
 * @param {string} header - 필드명
 * @param {string} value - 원본 값
 * @returns {any} 처리된 값
 */
const processFieldValue = (header, value) => {
  const trimmedValue = value.trim();
  
  // 빈 값 처리
  if (!trimmedValue) return '';
  
  // 숫자 필드 처리
  if (['현재수준', '목표수준', '실적수준', '과제기여도'].includes(header)) {
    const num = parseFloat(trimmedValue);
    return isNaN(num) ? '' : num;
  }
  
  // Boolean 필드 처리
  if (header === '완료여부') {
    return parseBoolean(trimmedValue);
  }
  
  return trimmedValue;
};

/**
 * Boolean 값 파싱
 * @param {string} value - 원본 값
 * @returns {boolean} Boolean 값
 */
const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  const str = String(value).toLowerCase().trim();
  return ['true', '1', 'yes', 'y', '참', '예'].includes(str);
};

/**
 * 성과목록 문자열 파싱
 * @param {string} performanceString - 성과목록 문자열
 * @returns {Array} 성과 객체 배열
 */
const parsePerformanceList = (performanceString) => {
  if (!performanceString || performanceString.trim() === '') return [];
  
  return performanceString.split(';').map(item => {
    const parts = item.split('>');
    return {
      대분류: parts[0] || '',
      소분류: parts[1] || '',
      성과항목: parts[2] || '',
      과제기여도: '',
      현재수준: '',
      목표수준: '',
      실적수준: '',
      단위: ''
    };
  });
};

/**
 * 액션아이템목록 문자열 파싱
 * @param {string} actionItemString - 액션아이템목록 문자열
 * @returns {Array} 액션아이템 객체 배열
 */
const parseActionItemList = (actionItemString) => {
  if (!actionItemString || actionItemString.trim() === '') return [];
  
  return actionItemString.split(';').map(title => ({
    제목: title.trim(),
    완료여부: false
  }));
};

/**
 * 팀멤버목록 문자열 파싱
 * @param {string} teamMemberString - 팀멤버목록 문자열
 * @returns {Array} 팀멤버 객체 배열
 */
const parseTeamMemberList = (teamMemberString) => {
  if (!teamMemberString || teamMemberString.trim() === '') return [];
  
  return teamMemberString.split(';').map(member => {
    const match = member.match(/(.+?)\((.+?)\)/);
    return {
      이름: match ? match[1].trim() : member.trim(),
      부서: match ? match[2].trim() : ''
    };
  });
};

/**
 * JSON 파일에서 프로젝트 데이터 가져오기
 * @param {File} file - 업로드된 JSON 파일
 * @returns {Promise<{projects: Array, performances: Array, metadata: Object}>} 파싱된 데이터
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
        
        // 새로운 구조 (v3) 확인
        if (data.metadata && data.projects && data.performances) {
          resolve({
            projects: data.projects || [],
            performances: data.performances || [],
            metadata: data.metadata
          });
          return;
        }

        // 기존 구조 (v2) 호환
        if (data.projects && Array.isArray(data.projects)) {
          resolve({
            projects: data.projects,
            performances: [],
            metadata: data.metadata || {
              version: '2.0',
              importDate: new Date().toISOString(),
              type: 'legacy-import'
            }
          });
          return;
        }

        // 매우 오래된 구조 (v1) - 직접 프로젝트 배열
        if (Array.isArray(data)) {
          resolve({
            projects: data,
            performances: [],
            metadata: {
              version: '1.0',
              importDate: new Date().toISOString(),
              type: 'legacy-array-import'
            }
          });
          return;
        }

        reject(new Error('올바르지 않은 데이터 형식입니다.'));
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
 * 프로젝트 데이터 병합
 * @param {Array} existingProjects - 기존 프로젝트 배열
 * @param {Array} importedProjects - 가져온 프로젝트 배열
 * @param {string} mergeMode - 병합 모드 ('replace', 'merge', 'append')
 * @returns {Array} 병합된 프로젝트 배열
 */
export const mergeProjects = (existingProjects, importedProjects, mergeMode = 'replace') => {
  switch (mergeMode) {
    case 'replace':
      return [...importedProjects];
      
    case 'merge':
      const merged = [...existingProjects];
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
 * 성과 항목 데이터 병합
 * @param {Array} existingPerformances - 기존 성과 항목 배열
 * @param {Array} importedPerformances - 가져온 성과 항목 배열
 * @param {string} mergeMode - 병합 모드 ('replace', 'merge', 'append')
 * @returns {Array} 병합된 성과 항목 배열
 */
export const mergePerformances = (existingPerformances, importedPerformances, mergeMode = 'replace') => {
  switch (mergeMode) {
    case 'replace':
      return [...importedPerformances];
      
    case 'merge':
      const merged = [...existingPerformances];
      importedPerformances.forEach(importedPerf => {
        const existingIndex = merged.findIndex(p => p.id === importedPerf.id);
        if (existingIndex >= 0) {
          merged[existingIndex] = importedPerf;
        } else {
          merged.push(importedPerf);
        }
      });
      return merged;
      
    case 'append':
      // ID 중복 방지를 위해 새로운 ID 생성
      const appendedPerformances = importedPerformances.map(perf => ({
        ...perf,
        id: `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        isFromSample: false
      }));
      return [...existingPerformances, ...appendedPerformances];
      
    default:
      return existingPerformances;
  }
};

/**
 * 파일 읽기 유틸리티
 * @param {File} file - 파일 객체
 * @returns {Promise<string>} 파일 내용
 */
export const readFileContent = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      resolve(e.target.result);
    };
    
    reader.onerror = (e) => {
      reject(new Error('파일 읽기에 실패했습니다.'));
    };
    
    reader.readAsText(file, 'utf-8');
  });
};

/**
 * 데이터 검증
 * @param {Array} projects - 프로젝트 배열
 * @returns {Object} 검증 결과
 */
export const validateProjectData = (projects) => {
  const errors = [];
  const warnings = [];
  
  projects.forEach((project, index) => {
    // 필수 필드 확인
    if (!project.id) {
      errors.push(`프로젝트 ${index + 1}: ID가 없습니다.`);
    }
    if (!project.과제명) {
      warnings.push(`프로젝트 ${index + 1}: 과제명이 없습니다.`);
    }
    if (!project.사업부) {
      warnings.push(`프로젝트 ${index + 1}: 사업부가 없습니다.`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    projectCount: projects.length
  };
};

/**
 * 파일 크기 검증
 * @param {File} file - 검증할 파일
 * @param {number} maxSizeMB - 최대 크기 (MB)
 * @returns {boolean} 크기 유효성 여부
 */
export const validateFileSize = (file, maxSizeMB = 10) => {
  const maxSize = maxSizeMB * 1024 * 1024;
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
 * @param {string} csvText - CSV 텍스트
 * @returns {Object} 매핑 정보
 */
export const generateColumnMapping = (csvText) => {
  const mapping = {
    mode: 'unknown',
    hasMultiTableSections: false,
    sectionsFound: [],
    missingColumns: [],
    extraColumns: []
  };

  if (typeof csvText !== 'string') {
    console.warn('generateColumnMapping: csvText is not a string', typeof csvText);
    return mapping;
  }

  try {
    // 4테이블 방식 감지
    const sectionMatches = csvText.match(/\[(\w+)\]/g);
    if (sectionMatches) {
      mapping.hasMultiTableSections = true;
      mapping.sectionsFound = sectionMatches.map(match => match.replace(/[\[\]]/g, ''));
      
      if (mapping.sectionsFound.includes('PROJECTS')) {
        mapping.mode = 'multi_table';
        
        const requiredSections = ['PROJECTS'];
        mapping.missingColumns = requiredSections.filter(section => 
          !mapping.sectionsFound.includes(section)
        );
      }
    } else {
      mapping.mode = 'legacy';
    }
  } catch (error) {
    console.error('generateColumnMapping error:', error);
    mapping.mode = 'error';
  }

  return mapping;
};
