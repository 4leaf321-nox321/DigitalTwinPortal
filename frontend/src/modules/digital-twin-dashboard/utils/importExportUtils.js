/**
 * 디지털 트윈 대시보드 데이터 가져오기/내보내기 유틸리티 (5테이블 분리 방식 + CSV 지원)
 *
 * 📊 5테이블 분리 방식:
 * - [GLOBAL_PERFORMANCES]: 글로벌 성과 항목 (성과 ID, 성과항목명, 대분류, 소분류, 단위, 수준 등)
 * - [PROJECTS]: 기본 프로젝트 정보 (과제명, 사업부, 진행상태, PL담당자 등)
 * - [PROJECT_PERFORMANCE_LINKS]: 과제-성과 연결 (project_id와 performance_id 연결, 과제기여도)
 * - [ACTION_ITEMS]: 액션아이템 정보 (project_id로 연결)
 * - [TEAM_MEMBERS]: 참여인력 정보 (project_id로 연결)
 *
 * 장점:
 * - Excel에서 섹션별 독립 편집 가능
 * - 중복 데이터 최소화 (정규화된 구조)
 * - 명확한 관계 구조 (ID 기반 연결)
 * - 각 테이블별 특화 필드 추가 용이
 * - 섹션별 피벗테이블 분석 최적화
 * - "여러 데이터 한번에 추가" 기능과 완전히 호환
 */

// projectPerformanceLink 유틸리티 함수 import
import { getProjectPerformancesWithData } from './projectPerformanceLink';
import * as XLSX from 'xlsx-js-style';
import { todayLocalYmd } from '../../../shared/utils/localDate';
// 수준값의 0 과 미입력은 다른 뜻이다. `|| ''` 로 다루면 0 이 빈칸으로 내보내진다.
import { levelText, levelNumber, percentText } from './levelValue';

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
 * 월별실적 배열을 정규화 (항상 12개 요소를 가진 배열로 변환)
 * @param {Array|any} monthlyData - 월별실적 데이터
 * @returns {Array} - 12개 요소를 가진 배열
 */
const normalizeMonthlyData = (monthlyData) => {
  // 배열이 아닌 경우 빈 배열 12개 반환
  if (!Array.isArray(monthlyData)) {
    return Array(12).fill('');
  }

  // 배열 길이가 12개가 아닌 경우 정규화
  const normalized = Array(12).fill('');
  for (let i = 0; i < 12; i++) {
    normalized[i] = monthlyData[i] !== undefined && monthlyData[i] !== null
      ? String(monthlyData[i])
      : '';
  }
  return normalized;
};

/**
 * CSV 셀 값을 안전하게 이스케이프 처리
 * - 쉼표, 탭, 줄바꿈, 큰따옴표가 포함된 경우 큰따옴표로 감싸기
 * - 내부 큰따옴표는 두 개로 이스케이프
 * @param {any} value - 이스케이프할 값
 * @returns {string} - CSV에서 안전한 문자열
 */
/**
 * 텍스트에서 Excel CSV 파싱을 방해하는 요소 제거
 * - base64 이미지 데이터 제거
 * - 이모지 및 특수 기호 제거
 * - 제어 문자 제거
 * - 줄바꿈을 공백으로 대체
 * @param {string} text - 정제할 텍스트
 * @returns {string} - 정제된 텍스트
 */
const sanitizeTextForCSV = (text) => {
  if (!text || typeof text !== 'string') return text;

  let sanitized = text;

  // 1. base64 이미지 데이터 제거 (data:image/... 형식)
  sanitized = sanitized.replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g, '[이미지]');

  // 2. HTML 이미지 태그 제거
  sanitized = sanitized.replace(/<img[^>]*>/gi, '[이미지]');

  // 3. 제어 문자 제거 (0x00-0x1F, 0x7F 제외: 탭, 줄바꿈, 캐리지리턴은 유지 후 처리)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // 4. 줄바꿈과 캐리지리턴을 공백으로 대체 (Excel CSV 파싱 안정성)
  sanitized = sanitized.replace(/[\r\n]+/g, ' ');

  // 5. 연속된 공백을 하나로 줄이기
  sanitized = sanitized.replace(/\s{2,}/g, ' ');

  // 6. 서로게이트 페어 이모지 및 특수 유니코드 기호 제거 (기본 다국어 평면 외 문자)
  // U+10000 이상의 문자 (이모지, 특수 기호 등)
  sanitized = sanitized.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '');

  // 7. 일부 특수 기호 제거 (Excel에서 문제를 일으킬 수 있는 기호)
  // 단, 일반적인 특수문자는 유지 (!@#$%^&*() 등)
  sanitized = sanitized.replace(/[\u2000-\u200F\u2028-\u202F\u205F-\u206F]/g, '');

  return sanitized.trim();
};

const escapeCSVCell = (value) => {
  // boolean 타입 처리
  if (typeof value === 'boolean') {
    return `"${value}"`;
  }

  // null/undefined 처리
  let str = String(value ?? '');

  // CSV 파싱을 방해하는 요소 정제
  str = sanitizeTextForCSV(str);

  // 특수문자 체크 (쉼표, 탭, 줄바꿈, 캐리지리턴, 큰따옴표)
  const needsQuoting = /[,\t\n\r"]/.test(str);

  if (needsQuoting) {
    // 큰따옴표를 두 개로 이스케이프하고 전체를 큰따옴표로 감싸기
    return `"${str.replace(/"/g, '""')}"`;
  }

  // 안전을 위해 모든 셀을 큰따옴표로 감싸기 (Excel 호환성 향상)
  return `"${str}"`;
};

/**
 * CSV 행 배열을 CSV 문자열로 변환
 * @param {Array} row - 행 데이터 배열
 * @returns {string} - CSV 형식 문자열
 */
const rowToCSV = (row) => {
  return row.map(cell => escapeCSVCell(cell)).join(',');
};

/**
 * 2차원 배열을 CSV 문자열로 변환
 * @param {Array} rows - 행 배열 (헤더 포함)
 * @returns {string} - CSV 형식 문자열
 */
const arrayToCSV = (rows) => {
  return rows.map(row => rowToCSV(row)).join('\n');
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
    name: '5테이블 분리 방식 (권장)',
    description: '프로젝트를 5개 테이블로 분리하여 Excel 편집에 최적화',
    pros: ['Excel 섹션별 독립 편집', '중복 데이터 최소화', '관계 구조 명확', '확장성 우수', '"여러 데이터 추가"와 호환'],
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
            실적수준: levelText(perf.실적수준)
          } : perf;
        }) || []
      })),
      performances
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const fullFilename = `${filename}_${todayLocalYmd()}.json`;
    
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
 * @param {Array} performances - 성과 항목 배열
 * @param {string} filename - 저장할 파일명 (확장자 제외)
 * @param {string} mode - Export 모드 (EXPORT_MODES 중 선택)
 */
export const exportProjectsToCSV = (projects, performances = [], filename = 'digital-twin-dashboard-data', mode = EXPORT_MODES.MULTI_TABLE) => {
  try {
    console.log(`🔄 CSV 내보내기 시작 (모드: ${mode}):`, {
      projects: projects.length,
      performances: performances.length,
      filename
    });

    let csvContent = '';

    if (mode === EXPORT_MODES.MULTI_TABLE) {
      // 4테이블 분리 방식 - props로 전달받은 performances 사용
      csvContent = generateMultiTableCSV(projects, performances);
    } else {
      // 기존 방식 (Legacy)
      csvContent = generateLegacyCSV(projects, performances);
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
 * 프로젝트 데이터를 Excel 파일로 내보내기
 * - 1열: 사업부, 2열: 프로세스, 3열: 과제 영역
 * - 1~2행: 두 줄짜리 헤더 (옅은 파란색 배경)
 * @param {Array} projects - 프로젝트 배열
 * @param {Array} performances - 성과 항목 배열
 * @param {string} filename - 저장할 파일명 (확장자 제외)
 */
export const exportProjectsToExcel = (projects, performances = [], filename = 'digital-twin-dashboard') => {
  try {
    console.log(`🔄 Excel 내보내기 시작:`, { projects: projects.length, performances: performances.length });

    const wb = XLSX.utils.book_new();

    // === 헤더 정의 (2행 헤더) ===
    // 열 구조: A개발년도, B사업부, C프로세스, D과제영역, E과제구분, F과제명, G액션아이템,
    //          H기술성과, I경영성과,
    //          J~U: 1월~12월 (일정), V진행상태, W진행률,
    //          X담당자, Y담당부서 (담당 정보),
    //          Z~AK: 1월~12월 (월별 진행 현황)
    const headerRow1 = [
      '개발년도', '사업부', '프로세스', '과제 영역', '과제 정보', '', '',
      '성과 정보', '',
      '일정 정보', '', '', '', '', '', '', '', '', '', '', '', '', '',
      '담당 정보', '',
      '월별 진행 현황', '', '', '', '', '', '', '', '', '', '', ''
    ];
    const headerRow2 = [
      '개발년도', '사업부', '프로세스', '과제영역', '과제구분', '과제명', '액션아이템',
      '기술성과', '경영성과',
      '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월',
      '진행상태', '진행률',
      '담당자', '담당부서',
      '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'
    ];
    const TOTAL_COLS = headerRow2.length; // 37
    const MONTH_COL_START = 9;  // J열 (일정 정보 1월) 시작 인덱스
    const PROGRESS_MONTH_START = 25; // Z열 (월별 진행 현황 1월) 시작 인덱스

    // 날짜/월 값에서 월(1~12) 추출
    // - 숫자(1~12): 월 그대로 반환
    // - 날짜 문자열("2025-03-01"): 월 파싱
    const getMonth = (value) => {
      if (value === null || value === undefined || value === '') return null;
      const str = String(value).trim();
      // 숫자인 경우 (월 값 그대로)
      const num = Number(str);
      if (!isNaN(num) && num >= 1 && num <= 12) return Math.round(num);
      // "X월" 형식
      const monthMatch = str.match(/^(\d{1,2})월$/);
      if (monthMatch) return parseInt(monthMatch[1], 10);
      // "YYYY-MM" 또는 "YYYY-MM-DD" 형식
      const dateMatch = str.match(/(\d{4})-(\d{1,2})/);
      if (dateMatch) return parseInt(dateMatch[2], 10);
      // 기타 Date 파싱
      const d = new Date(str);
      return isNaN(d.getTime()) ? null : d.getMonth() + 1;
    };

    // === 성과 텍스트 포맷 함수 ===
    // [소분류] 성과항목명 : 현재수준단위, 목표수준단위, 실적수준단위
    const formatPerfLine = (globalPerf, perfData) => {
      const 소분류 = globalPerf?.소분류 || perfData?.소분류 || '';
      const raw성과항목 = globalPerf?.성과항목 || perfData?.성과항목 || '';
      const 성과항목 = raw성과항목.replace(/^\[.*?\]\s*/, '');
      const 단위 = globalPerf?.단위 || perfData?.단위 || '';
      const 현재 = globalPerf?.현재수준 ?? perfData?.현재수준 ?? '';
      const 목표 = globalPerf?.목표수준 ?? perfData?.목표수준 ?? '';
      const 실적 = globalPerf?.실적수준 ?? perfData?.실적수준 ?? '';

      const prefix = 소분류 ? `[${소분류}] ` : '';
      const values = `기존 ${현재}${단위} / 목표 ${목표}${단위} / 실적 ${실적}${단위}`;
      return `${prefix}${성과항목}\n  ${values}`;
    };

    // === 데이터 행 생성 ===
    const dataRows = [];
    // 과제 블록별 병합 정보: { startRow, endRow } (dataRows 기준 인덱스)
    const projectBlocks = [];
    // 일정 색상 정보: { dataRowIdx, startMonth, endMonth, type }
    const scheduleColors = [];

    projects.forEach(project => {
      const perfList = project.성과목록 || [];
      const actionItems = project.액션아이템목록 || [];

      // --- 성과 분류 (기술성과 / 경영성과) ---
      const techLines = [];
      const bizLines = [];

      perfList.forEach(perf => {
        const perfId = typeof perf === 'object' ? (perf.id || perf.성과항목ID) : perf;
        const perfData = typeof perf === 'object' ? perf : {};
        const globalPerf = performances.find(gp => gp.id === perfId);
        const 대분류 = globalPerf?.대분류 || perfData?.대분류 || '';
        const line = formatPerfLine(globalPerf, perfData);

        if (대분류 === '기술성과') {
          techLines.push(line);
        } else {
          bizLines.push(line);
        }
      });

      const techText = techLines.join('\n');
      const bizText = bizLines.join('\n');

      const blockStartRow = dataRows.length;

      // --- 담당자 텍스트: 과제 PL : OOO, 멤버 : OOO, OOO, ... ---
      const plName = project.과제PL || '';
      const members = (project.과제참여인력목록 || []).map(m => m.이름 || '').filter(Boolean);
      const 담당자Lines = [];
      if (plName) 담당자Lines.push(`과제 PL : ${plName}`);
      if (members.length > 0) 담당자Lines.push(`멤버 : ${members.join(', ')}`);
      const 담당자Text = 담당자Lines.join('\n');

      // --- 담당부서 텍스트 ---
      const deptSet = new Set();
      if (project.과제참여인력목록) {
        project.과제참여인력목록.forEach(m => { if (m.부서) deptSet.add(m.부서); });
      }
      const 담당부서Text = [...deptSet].join(', ');

      // --- 과제 시작/종료 월 ---
      const projStartMonth = getMonth(project.시작);
      const projEndMonth = getMonth(project.종료);
      // --- 월간 진척 현황 요약 데이터 (과제 행 전용) ---
      const monthlyProgress = project.월간진척현황 || {};
      const progressMonthCells = Array.from({ length: 12 }, (_, i) => monthlyProgress[i + 1] || '');

      // --- 과제 행 (첫 행) ---
      const projectRow = [
        project.과제년도 || '',
        project.사업부 || '',
        project.프로세스 || '',
        project.과제영역 || '',
        project.과제구분 || '',
        project.과제명 || '',
        '',  // 액션아이템 열 (과제 행에서는 F+G 병합)
        techText,
        bizText,
        ...Array(12).fill(''),
        project.진행상태 || '',
        percentText(project.진행률),
        담당자Text,
        담당부서Text,
        ...progressMonthCells
      ];
      dataRows.push(projectRow);

      // 일정 색상 정보 저장: { dataRowIdx, startMonth, endMonth }
      if (projStartMonth && projEndMonth) {
        scheduleColors.push({ dataRowIdx: blockStartRow, startMonth: projStartMonth, endMonth: projEndMonth, type: 'project' });
      }

      // --- 액션아이템 행들 ---
      actionItems.forEach(item => {
        const row = Array(TOTAL_COLS).fill('');
        row[6] = item.제목 || '';
        row[21] = item.완료여부 ? '완료' : '진행중';
        // 진행률: 세부항목(액티비티) 기반 계산
        const subs = item.세부항목목록 || [];
        if (subs.length > 0) {
          const done = subs.filter(s => s.완료여부).length;
          row[22] = `${Math.round((done / subs.length) * 100)}%`;
        } else {
          row[22] = item.완료여부 ? '100%' : '0%';
        }

        // 월별 진행 현황: 완료된 액티비티를 완료일 기준 월에 배치
        if (subs.length > 0) {
          // 월별로 완료된 액티비티 그룹핑
          const monthlyActivities = {};
          subs.forEach(sub => {
            if (sub.완료여부 && sub.완료일) {
              const month = getMonth(sub.완료일);
              if (month) {
                if (!monthlyActivities[month]) monthlyActivities[month] = [];
                monthlyActivities[month].push(sub.내용 || '');
              }
            }
          });
          // 각 월 셀에 해당 월 완료 액티비티 내용 구분자로 표기
          Object.entries(monthlyActivities).forEach(([month, contents]) => {
            const col = PROGRESS_MONTH_START + (parseInt(month) - 1);
            row[col] = contents.join(' │ ');
          });
        }
        const actionRowIdx = dataRows.length;
        dataRows.push(row);

        // 액션아이템 일정: 시작은 과제 시작월, 끝은 목표일 기반
        const actionEndMonth = getMonth(item.목표일);
        if (projStartMonth && actionEndMonth) {
          scheduleColors.push({ dataRowIdx: actionRowIdx, startMonth: projStartMonth, endMonth: actionEndMonth, type: 'action' });
        }
      });

      const blockEndRow = dataRows.length - 1;

      projectBlocks.push({
        startRow: blockStartRow,
        endRow: blockEndRow,
        hasActionItems: actionItems.length > 0
      });
    });

    // 시트 데이터 (헤더 2행 + 데이터)
    const sheetData = [headerRow1, headerRow2, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // === 열 너비 설정 ===
    ws['!cols'] = [
      { wch: 10 }, // A 개발년도
      { wch: 12 }, // B 사업부
      { wch: 12 }, // C 프로세스
      { wch: 12 }, // D 과제영역
      { wch: 10 }, // E 과제구분
      { wch: 10 }, // F 과제명
      { wch: 60 }, // G 액션아이템
      { wch: 45 }, // H 기술성과
      { wch: 45 }, // I 경영성과
      { wch: 4 }, { wch: 4 }, { wch: 4 }, { wch: 4 }, { wch: 4 }, { wch: 4 },
      { wch: 4 }, { wch: 4 }, { wch: 4 }, { wch: 4 }, { wch: 4 }, { wch: 4 },
      { wch: 10 }, // U 진행상태
      { wch: 8 },  // V 진행률
      { wch: 30 }, // W 담당자
      { wch: 15 }, // X 담당부서
      { wch: 45 }, { wch: 45 }, { wch: 45 }, { wch: 45 }, { wch: 45 }, { wch: 45 },
      { wch: 45 }, { wch: 45 }, { wch: 45 }, { wch: 45 }, { wch: 45 }, { wch: 45 },
    ];

    // === 셀 병합 ===
    const HEADER_ROWS = 2;
    const merges = [
      // 헤더 병합
      { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },    // 개발년도 A1:A2
      { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },    // 사업부 B1:B2
      { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } },    // 프로세스 C1:C2
      { s: { r: 0, c: 3 }, e: { r: 1, c: 3 } },    // 과제 영역 D1:D2
      { s: { r: 0, c: 4 }, e: { r: 0, c: 6 } },    // 과제 정보 E1:G1
      { s: { r: 0, c: 7 }, e: { r: 0, c: 8 } },    // 성과 정보 H1:I1
      { s: { r: 0, c: 9 }, e: { r: 0, c: 22 } },   // 일정 정보 J1:W1
      { s: { r: 0, c: 23 }, e: { r: 0, c: 24 } },  // 담당 정보 X1:Y1
      { s: { r: 0, c: 25 }, e: { r: 0, c: 36 } },  // 월별 진행 현황 Z1:AK1
    ];

    // 과제 블록별 병합
    projectBlocks.forEach(block => {
      const sheetStart = block.startRow + HEADER_ROWS;
      const sheetEnd = block.endRow + HEADER_ROWS;

      // 과제 첫 행: 과제명(F) + 액션아이템(G) 가로 병합
      merges.push({ s: { r: sheetStart, c: 5 }, e: { r: sheetStart, c: 6 } });

      // 액션아이템이 있으면 A~E열을 액션아이템 첫행~마지막행 세로 병합
      if (block.hasActionItems) {
        const actionStart = sheetStart + 1; // 액션아이템 첫 행 (과제 행 다음)
        merges.push({ s: { r: actionStart, c: 0 }, e: { r: sheetEnd, c: 0 } }); // 개발년도
        merges.push({ s: { r: actionStart, c: 1 }, e: { r: sheetEnd, c: 1 } }); // 사업부
        merges.push({ s: { r: actionStart, c: 2 }, e: { r: sheetEnd, c: 2 } }); // 프로세스
        merges.push({ s: { r: actionStart, c: 3 }, e: { r: sheetEnd, c: 3 } }); // 과제영역
        merges.push({ s: { r: actionStart, c: 4 }, e: { r: sheetEnd, c: 4 } }); // 과제구분
        merges.push({ s: { r: actionStart, c: 5 }, e: { r: sheetEnd, c: 5 } }); // 과제명
      }

      // 과제 첫 행 ~ 마지막 액션아이템 행까지 세로 병합
      if (block.hasActionItems) {
        merges.push({ s: { r: sheetStart, c: 7 }, e: { r: sheetEnd, c: 7 } });  // 기술성과(H)
        merges.push({ s: { r: sheetStart, c: 8 }, e: { r: sheetEnd, c: 8 } });  // 경영성과(I)
        merges.push({ s: { r: sheetStart, c: 23 }, e: { r: sheetEnd, c: 23 } }); // 담당자(X)
        merges.push({ s: { r: sheetStart, c: 24 }, e: { r: sheetEnd, c: 24 } }); // 담당부서(Y)
      }
    });

    ws['!merges'] = merges;

    // === 모든 병합 셀의 시작 셀에 세로 위쪽 맞춤 적용 ===
    const topAlignStyle = { alignment: { vertical: 'center', wrapText: true } };
    merges.forEach(merge => {
      const cellRef = XLSX.utils.encode_cell({ r: merge.s.r, c: merge.s.c });
      if (!ws[cellRef]) ws[cellRef] = { v: '', t: 's' };
      // 헤더 셀은 별도 스타일이 있으므로 데이터 영역만 적용
      if (merge.s.r >= HEADER_ROWS) {
        ws[cellRef].s = topAlignStyle;
      }
    });

    // === 일정 정보 셀 색상 채우기 ===
    const projectScheduleStyle = {
      fill: { fgColor: { rgb: '93C5FD' }, patternType: 'solid' } // 파란색
    };
    const actionScheduleStyle = {
      fill: { fgColor: { rgb: 'BBF7D0' }, patternType: 'solid' } // 연두색
    };
    scheduleColors.forEach(info => {
      const sheetRow = info.dataRowIdx + HEADER_ROWS;
      const style = info.type === 'project' ? projectScheduleStyle : actionScheduleStyle;
      const start = Math.min(info.startMonth, info.endMonth);
      const end = Math.max(info.startMonth, info.endMonth);
      for (let month = start; month <= end; month++) {
        const col = MONTH_COL_START + (month - 1);
        const cellRef = XLSX.utils.encode_cell({ r: sheetRow, c: col });
        if (!ws[cellRef]) ws[cellRef] = { v: '', t: 's' };
        ws[cellRef].s = style;
      }
    });

    // === 옅은 파란색 헤더 스타일 적용 ===
    const lightBlue = { rgb: 'DBEAFE' };
    const headerStyle = {
      fill: { fgColor: lightBlue, patternType: 'solid' },
      font: { bold: true, sz: 11 },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: {
        top: { style: 'thin', color: { rgb: '9CA3AF' } },
        bottom: { style: 'thin', color: { rgb: '9CA3AF' } },
        left: { style: 'thin', color: { rgb: '9CA3AF' } },
        right: { style: 'thin', color: { rgb: '9CA3AF' } }
      }
    };

    // 1행, 2행 모든 셀에 스타일 적용
    const totalCols = headerRow2.length;
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < totalCols; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
        if (!ws[cellRef]) ws[cellRef] = { v: '', t: 's' };
        ws[cellRef].s = headerStyle;
      }
    }

    // === 모든 데이터 영역에 테두리 적용 ===
    const thinBorder = {
      top: { style: 'thin', color: { rgb: '9CA3AF' } },
      bottom: { style: 'thin', color: { rgb: '9CA3AF' } },
      left: { style: 'thin', color: { rgb: '9CA3AF' } },
      right: { style: 'thin', color: { rgb: '9CA3AF' } }
    };
    const totalRows = HEADER_ROWS + dataRows.length;
    const totalColumns = headerRow2.length;
    for (let r = 0; r < totalRows; r++) {
      for (let c = 0; c < totalColumns; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        if (!ws[cellRef]) ws[cellRef] = { v: '', t: 's' };
        const existing = ws[cellRef].s || {};
        // 기존 스타일 유지하면서 border + vertical top 추가
        ws[cellRef].s = {
          ...existing,
          border: thinBorder,
          alignment: { ...(existing.alignment || {}), vertical: 'center', wrapText: true }
        };
      }
    }

    // === 모든 행 높이 45 설정 ===
    ws['!rows'] = Array.from({ length: totalRows }, () => ({ hpt: 45 }));

    XLSX.utils.book_append_sheet(wb, ws, '과제 현황');

    // Excel 파일 다운로드
    const fullFilename = `${filename}.xlsx`;
    XLSX.writeFile(wb, fullFilename);

    console.log(`✅ Excel 파일 내보내기 완료: ${fullFilename}`);
    return true;
  } catch (error) {
    console.error('❌ Excel 파일 내보내기 실패:', error);
    return false;
  }
};

/**
 * 5테이블 분리 방식 CSV 생성
 * @param {Array} projects - 프로젝트 배열
 * @param {Array} globalPerformances - 글로벌 성과 항목 배열
 * @returns {string} CSV 내용
 */
const generateMultiTableCSV = (projects, globalPerformances = []) => {
  console.log(`🔗 generateMultiTableCSV에서 전달받은 글로벌 성과 데이터: ${globalPerformances.length}개`);

  const sections = [];

  // 1. [GLOBAL_PERFORMANCES] 섹션 - 글로벌 성과 목록
  sections.push('[GLOBAL_PERFORMANCES]');
  sections.push(generateGlobalPerformancesCSV(globalPerformances));
  sections.push(''); // 빈 줄

  // 2. [PROJECTS] 섹션 - 프로젝트 기본 정보
  sections.push('[PROJECTS]');
  sections.push(generateProjectsCSV(projects));
  sections.push(''); // 빈 줄

  // 3. [PROJECT_PERFORMANCE_LINKS] 섹션 - 과제-성과 연결
  sections.push('[PROJECT_PERFORMANCE_LINKS]');
  sections.push(generateProjectPerformanceLinksCSV(projects, globalPerformances));
  sections.push(''); // 빈 줄

  // 4. [ACTION_ITEMS] 섹션
  sections.push('[ACTION_ITEMS]');
  sections.push(generateActionItemsCSV(projects));
  sections.push(''); // 빈 줄

  // 5. [TEAM_MEMBERS] 섹션
  sections.push('[TEAM_MEMBERS]');
  sections.push(generateTeamMembersCSV(projects));

  return sections.join('\n');
};

/**
 * 기존 방식 CSV 생성 (Legacy) - 5개 테이블을 하나의 통합 테이블로
 * @param {Array} projects - 프로젝트 배열
 * @param {Array} globalPerformances - 글로벌 성과 항목 배열
 * @returns {string} CSV 내용
 */
const generateLegacyCSV = (projects, globalPerformances = []) => {
  console.log(`🔗 generateLegacyCSV에서 전달받은 글로벌 성과 데이터: ${globalPerformances.length}개`);

  const headers = [
    // 프로젝트 기본 정보
    'uuid', 'project_id', '과제년도', '사업부', '프로세스', '과제영역', '과제구분', '과제명',
    '시작', '종료', '진행상태', '진행률', '과제PL', '작성자', '과제상세설명',
    'PoC과제여부', '중점과제여부',
    // 성과 연결 정보
    'performance_id', '성과년도', '성과항목명', '대분류', '소분류', '단위', '과제기여도',
    '현재수준', '목표수준', '월별실적여부', '실적수준',
    '실적_1월', '실적_2월', '실적_3월', '실적_4월', '실적_5월', '실적_6월',
    '실적_7월', '실적_8월', '실적_9월', '실적_10월', '실적_11월', '실적_12월',
    '보고현황',
    '성과설명',
    // 액션아이템 목록 (세미콜론 구분)
    '액션아이템목록',
    // 팀멤버 목록 (세미콜론 구분)
    '과제참여인력목록'
  ];

  const rows = [];

  projects.forEach(project => {
    // 액션아이템과 팀멤버는 문자열로 변환
    const actionItemsStr = (project.액션아이템목록 || [])
      .map(item => `${item.제목}${item.완료여부 ? '[완료]' : '[진행중]'}`)
      .join(';');

    const teamMembersStr = (project.과제참여인력목록 || [])
      .map(member => `${member.이름}(${member.부서})`)
      .join(';');

    if (project.성과목록 && project.성과목록.length > 0) {
      // 각 성과별로 행 생성 (프로젝트 정보는 중복)
      project.성과목록.forEach(perf => {
        // 성과 ID로 글로벌 성과 데이터 찾기
        const perfId = typeof perf === 'object' ? (perf.id || perf.성과항목ID) : perf;
        const globalPerf = globalPerformances.find(gp => gp.id === perfId);

        // 성과 정보 (글로벌 데이터 우선, ID 형식이면 글로벌에서 가져옴)
        const perfData = typeof perf === 'object' ? perf : {};
        // ID 형식인지 확인 (category-X, subcategory-X, performance-X 패턴)
        const isIdFormat = (value) => value && /^(category|subcategory|performance)-\d+$/.test(value);

        const 성과년도 = globalPerf?.성과년도 || perfData.성과년도;
        // 성과항목명: globalPerf 우선, perfData가 ID 형식이 아니면 perfData 사용
        const perfDataName = perfData.성과항목 || perfData.성과항목명 || perfData.성과항목ID;
        const 성과항목명 = globalPerf?.성과항목 || (isIdFormat(perfDataName) ? '' : perfDataName) || '';
        // 대분류/소분류: globalPerf 우선, perfData가 ID 형식이 아니면 perfData 사용
        // 대분류ID, 소분류ID 필드도 체크하여 ID 형식인 경우 제외
        const perfData대분류 = perfData.대분류 || perfData.대분류ID;
        const perfData소분류 = perfData.소분류 || perfData.소분류ID;
        const 대분류 = globalPerf?.대분류 || (isIdFormat(perfData대분류) ? '' : perfData대분류) || '';
        const 소분류 = globalPerf?.소분류 || (isIdFormat(perfData소분류) ? '' : perfData소분류) || '';
        const 단위 = globalPerf?.단위 || perfData.단위 || '';
        const 현재수준 = globalPerf?.현재수준 ?? perfData.현재수준 ?? '';
        const 목표수준 = globalPerf?.목표수준 ?? perfData.목표수준 ?? '';
        const 월별실적여부 = globalPerf?.월별실적여부 || false;
        const 실적수준 = globalPerf?.실적수준 ?? perfData.실적수준 ?? '';
        const 월별실적 = normalizeMonthlyData(globalPerf?.월별실적);
        const 보고현황 = (globalPerf?.보고현황목록 && Array.isArray(globalPerf.보고현황목록) && globalPerf.보고현황목록.length > 0)
          ? globalPerf.보고현황목록.join(';')
          : '';
        const 성과설명 = globalPerf?.설명 || '';

        rows.push([
          // 프로젝트 기본 정보
          project.uuid || '',
          project.id || '',
          project.과제년도 || '',
          project.사업부 || '',
          project.프로세스 || '',
          project.과제영역 || '',
          project.과제구분 || '',
          project.과제명 || '',
          project.시작 || '',
          project.종료 || '',
          project.진행상태 || '',
          levelNumber(project.진행률),
          project.과제PL || '',
          project.작성자 || '',
          project.과제상세설명 || '',
          project.PoC과제여부 ?? false,
          project.중점과제여부 ?? false,
          // 성과 연결 정보
          perfId || '',
          성과년도,
          성과항목명,
          대분류,
          소분류,
          단위,
          perfData.과제기여도 || '',
          현재수준,
          목표수준,
          월별실적여부 ? 'TRUE' : 'FALSE',
          실적수준,
          ...월별실적,
          보고현황,
          성과설명,
          // 액션아이템 목록
          actionItemsStr,
          // 팀멤버 목록
          teamMembersStr
        ]);
      });
    } else {
      // 성과가 없는 프로젝트도 한 행으로 표시
      rows.push([
        // 프로젝트 기본 정보
        project.uuid || '',
        project.id || '',
        project.과제년도 || '',
        project.사업부 || '',
        project.프로세스 || '',
        project.과제영역 || '',
        project.과제구분 || '',
        project.과제명 || '',
        project.시작 || '',
        project.종료 || '',
        project.진행상태 || '',
        levelNumber(project.진행률),
        project.과제PL || '',
        project.작성자 || '',
        project.과제상세설명 || '',
        project.PoC과제여부 ?? false,
        project.중점과제여부 ?? false,
        // 성과 연결 정보 (없음) - performance_id, 성과년도, 성과항목명, 대분류, 소분류, 단위, 과제기여도, 현재수준, 목표수준, 월별실적여부, 실적수준, 월별실적(12개), 보고현황, 성과설명
        '', '', '', '', '', '', '', '', '', 'FALSE', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
        // 액션아이템 목록
        actionItemsStr,
        // 팀멤버 목록
        teamMembersStr
      ]);
    }
  });

  return arrayToCSV([headers, ...rows]);
};

/**
 * PROJECTS 테이블 CSV 생성
 * @param {Array} projects - 프로젝트 배열
 * @returns {string} CSV 내용
 */
const generateProjectsCSV = (projects) => {
  const headers = [
    'uuid', 'id', '과제년도', '사업부', '프로세스', '과제영역', '과제구분', '과제명',
    '시작', '종료', '진행상태', '과제PL', '작성자', '과제상세설명',
    'PoC과제여부', '중점과제여부'
  ];

  const rows = projects.map(project => [
    project.uuid || '',
    project.id || '',
    project.과제년도 || '',
    project.사업부 || '',
    project.프로세스 || '',
    project.과제영역 || '',
    project.과제구분 || '',
    project.과제명 || '',
    project.시작 || '',
    project.종료 || '',
    project.진행상태 || '',
    project.과제PL || '',
    project.작성자 || '',
    project.과제상세설명 || '',
    project.PoC과제여부 ?? false,
    project.중점과제여부 ?? false
  ]);

  return arrayToCSV([headers, ...rows]);
};

/**
 * GLOBAL_PERFORMANCES 테이블 CSV 생성 - 글로벌 성과 항목 목록
 * @param {Array} globalPerformances - 글로벌 성과 항목 배열
 * @returns {string} CSV 내용
 */
const generateGlobalPerformancesCSV = (globalPerformances) => {
  const headers = [
    'uuid',         // UUID
    'id',           // 성과 ID
    '성과년도',     // 성과년도
    '성과항목',     // 성과항목명
    '대분류',       // 대분류
    '소분류',       // 소분류
    '단위',         // 단위
    '현재수준',     // 현재수준
    '목표수준',     // 목표수준
    '월별실적여부', // 월별실적여부
    '실적수준',     // 실적수준 (단일)
    '실적_1월', '실적_2월', '실적_3월', '실적_4월', '실적_5월', '실적_6월',
    '실적_7월', '실적_8월', '실적_9월', '실적_10월', '실적_11월', '실적_12월',
    '보고현황',     // 보고현황목록 (세미콜론 구분)
    '설명'          // 설명
  ];

  const rows = globalPerformances.map(perf => {
    const monthlyActuals = normalizeMonthlyData(perf.월별실적);
    const reportStatusStr = (perf.보고현황목록 && Array.isArray(perf.보고현황목록) && perf.보고현황목록.length > 0)
      ? perf.보고현황목록.join(';')
      : '';
    return [
      perf.uuid || '',
      perf.id || '',
      perf.성과년도,
      perf.성과항목 || '',
      perf.대분류 || '',
      perf.소분류 || '',
      perf.단위 || '',
      perf.현재수준 ?? '',
      perf.목표수준 ?? '',
      perf.월별실적여부 ? 'TRUE' : 'FALSE',
      perf.실적수준 ?? '',
      ...monthlyActuals,
      reportStatusStr,
      perf.설명 || ''
    ];
  });

  return arrayToCSV([headers, ...rows]);
};

/**
 * PROJECT_PERFORMANCE_LINKS 테이블 CSV 생성 - 과제-성과 연결
 * @param {Array} projects - 프로젝트 배열
 * @param {Array} globalPerformances - 글로벌 성과 항목 배열
 * @returns {string} CSV 내용
 */
const generateProjectPerformanceLinksCSV = (projects, globalPerformances) => {
  const headers = [
    'project_id',      // 과제 ID
    '과제명',          // 과제명
    'performance_id',  // 성과 ID
    '성과항목명',      // 성과항목명
    '과제기여도'       // 과제기여도
  ];

  const rows = [];

  projects.forEach(project => {
    if (project.성과목록 && project.성과목록.length > 0) {
      project.성과목록.forEach((perf) => {
        // perf가 객체일 수도 있고 ID 문자열일 수도 있음
        const perfId = typeof perf === 'object' ? (perf.id || perf.성과항목ID) : perf;
        const perfData = typeof perf === 'object' ? perf : {};

        // 글로벌 성과 데이터에서 성과항목명 찾기
        // ID 형식인지 확인 (category-X, subcategory-X, performance-X 패턴)
        const isIdFormat = (value) => value && /^(category|subcategory|performance)-\d+$/.test(value);
        const perfDataName = perfData.성과항목 || perfData.성과항목명 || perfData.성과항목ID || '';
        let 성과항목명 = isIdFormat(perfDataName) ? '' : perfDataName;
        if (!성과항목명 && perfId && globalPerformances) {
          const foundPerf = globalPerformances.find(gp => gp.id === perfId);
          성과항목명 = foundPerf?.성과항목 || '';
        }

        rows.push([
          project.id || '',
          project.과제명 || '',
          perfId || '',
          성과항목명,
          perfData.과제기여도 || ''
        ]);
      });
    }
  });

  return arrayToCSV([headers, ...rows]);
};

/**
 * PERFORMANCES 테이블 CSV 생성 (확장된 필드 포함, 글로벌 성과 항목 연결)
 * ⚠️ 이 함수는 더 이상 사용되지 않습니다. generateProjectPerformanceLinksCSV를 사용하세요.
 * @param {Array} projects - 프로젝트 배열
 * @param {Array} globalPerformances - 글로벌 성과 아이템 배열 (선택사항)
 * @returns {string} CSV 내용
 * @deprecated
 */
const generatePerformancesCSV = (projects, globalPerformances = null) => {
  console.log('📊 PERFORMANCES CSV 생성 시작 (성과 중심), 프로젝트 수:', projects.length);

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
    'performance_id',  // 성과 ID
    '대분류',          // 성과 대분류
    '소분류',          // 성과 소분류
    '성과항목',        // 성과항목명
    '단위',            // 측정 단위
    '설명',            // 성과 설명
    'project_id',      // 연결된 과제ID
    '과제기여도',      // 이 과제가 해당 성과에 기여하는 정도 (%)
    '현재수준',        // 현재 달성 수준
    '목표수준',        // 목표 달성 수준
    '실적수준'         // 실제 달성된 수준
  ];

  const rows = [];
  let totalLinks = 0;

  // 성과 중심으로 순회
  globalPerformances.forEach((performance, perfIndex) => {
    console.log(`\n🎯 성과 처리: ${performance.성과항목} (ID: ${performance.id})`);

    // 이 성과와 연결된 프로젝트 찾기
    const linkedProjects = projects.filter(project => {
      if (!project.성과목록 || project.성과목록.length === 0) return false;

      // 프로젝트의 성과목록에서 현재 성과 ID를 찾기
      return project.성과목록.some(perfRef => {
        // perfRef가 객체일 수도 있고 ID 문자열일 수도 있음
        const perfId = typeof perfRef === 'object' ? perfRef.id : perfRef;
        return perfId === performance.id;
      });
    });

    console.log(`  🔗 연결된 프로젝트: ${linkedProjects.length}개`);

    if (linkedProjects.length > 0) {
      // 각 연결된 프로젝트마다 행 생성
      linkedProjects.forEach(project => {
        // 프로젝트의 성과목록에서 이 성과의 프로젝트별 데이터 찾기
        const perfInProject = project.성과목록.find(perfRef => {
          const perfId = typeof perfRef === 'object' ? perfRef.id : perfRef;
          return perfId === performance.id;
        });

        // 프로젝트별 성과 데이터 (과제기여도, 수준 등)
        const projectPerfData = typeof perfInProject === 'object' ? perfInProject : {};

        console.log(`    📁 프로젝트: ${project.과제명} (ID: ${project.id})`);
        console.log(`    📊 성과 데이터 상세:`, {
          perfInProject: perfInProject,
          perfInProjectType: typeof perfInProject,
          projectPerfData: projectPerfData,
          '과제기여도': projectPerfData.과제기여도,
          '글로벌_현재수준': performance.현재수준,
          '글로벌_목표수준': performance.목표수준,
          '글로벌_실적수준': performance.실적수준
        });

        // 현재/목표/실적수준은 항상 글로벌 성과 데이터에서 가져옴
        // 프로젝트별 데이터는 과제기여도만 저장됨
        const 현재수준 = performance.현재수준 ?? '';
        const 목표수준 = performance.목표수준 ?? '';
        const 실적수준 = performance.실적수준 ?? '';

        console.log(`    ✅ 최종 출력 값:`, {
          과제기여도: projectPerfData.과제기여도,
          현재수준,
          목표수준,
          실적수준
        });

        rows.push([
          performance.id || '',                                           // performance_id
          performance.대분류 || '',                                       // 대분류
          performance.소분류 || '',                                       // 소분류
          performance.성과항목 || '',                                     // 성과항목
          performance.단위 || '',                                         // 단위
          performance.설명 || '',                                         // 설명
          project.id || '',                                               // project_id
          projectPerfData.과제기여도 ?? '',                               // 과제기여도
          현재수준,                                                        // 현재수준
          목표수준,                                                        // 목표수준
          실적수준                                                         // 실적수준
        ]);
        totalLinks++;
      });
    } else {
      console.log(`  ⚠️ 연결된 프로젝트가 없는 성과`);
      // 연결된 프로젝트가 없는 성과도 표시 (성과 기본 정보 + 글로벌 수준 데이터)
      rows.push([
        performance.id || '',                       // performance_id
        performance.대분류 || '',                   // 대분류
        performance.소분류 || '',                   // 소분류
        performance.성과항목 || '',                 // 성과항목
        performance.단위 || '',                     // 단위
        performance.설명 || '',                     // 설명
        '',                                         // project_id (연결 없음)
        '',                                         // 과제기여도
        levelText(performance.현재수준),            // 현재수준
        levelText(performance.목표수준),            // 목표수준
        levelText(performance.실적수준)             // 실적수준
      ]);
    }
  });

  console.log(`✅ PERFORMANCES CSV 생성 완료: ${globalPerformances.length}개 성과, ${totalLinks}개 프로젝트 연결, ${rows.length}개 행`);

  return arrayToCSV([headers, ...rows]);
};

/**
 * ACTION_ITEMS 테이블 CSV 생성 (간소화된 버전)
 * @param {Array} projects - 프로젝트 배열
 * @returns {string} CSV 내용
 */
const generateActionItemsCSV = (projects) => {
  const headers = [
    'project_id', '제목', '완료여부'
  ];

  const rows = [];
  projects.forEach(project => {
    if (project.액션아이템목록 && project.액션아이템목록.length > 0) {
      project.액션아이템목록.forEach((item) => {
        rows.push([
          project.id || '',
          item.제목 || '',
          item.완료여부 ?? false
        ]);
      });
    }
  });

  return arrayToCSV([headers, ...rows]);
};

/**
 * TEAM_MEMBERS 테이블 CSV 생성 (간소화된 버전)
 * @param {Array} projects - 프로젝트 배열
 * @returns {string} CSV 내용
 */
const generateTeamMembersCSV = (projects) => {
  const headers = [
    'project_id', '이름', 'knoxId', '부서'
  ];

  const rows = [];
  projects.forEach(project => {
    if (project.과제참여인력목록 && project.과제참여인력목록.length > 0) {
      project.과제참여인력목록.forEach((member) => {
        rows.push([
          project.id || '',
          member.이름 || '',
          member.knoxId || '',
          member.부서 || ''
        ]);
      });
    }
  });

  return arrayToCSV([headers, ...rows]);
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
 * 5테이블 분리 방식 CSV 가져오기 (4테이블 레거시 호환)
 * @param {string} csvText - CSV 텍스트
 * @returns {Promise<{projects: Array, performances: Array}>} 프로젝트 배열
 */
const importMultiTableCSV = async (csvText) => {
  console.log('📊 5테이블 분리 방식 CSV 파싱 시작');

  const sections = parseCSVSections(csvText);

  const projects = sections.PROJECTS || [];
  const globalPerformances = sections.GLOBAL_PERFORMANCES || [];
  const projectPerformanceLinks = sections.PROJECT_PERFORMANCE_LINKS || sections.PERFORMANCES || []; // 레거시 호환
  const actionItems = sections.ACTION_ITEMS || [];
  const teamMembers = sections.TEAM_MEMBERS || [];

  console.log('📊 섹션별 데이터 개수:', {
    projects: projects.length,
    globalPerformances: globalPerformances.length,
    projectPerformanceLinks: projectPerformanceLinks.length,
    actionItems: actionItems.length,
    teamMembers: teamMembers.length
  });

  // 프로젝트에 관련 데이터 연결
  const enrichedProjects = projects.map(project => {
    const projectId = String(project.id);

    return {
      ...project,
      성과목록: projectPerformanceLinks
        .filter(p => String(p.project_id) === projectId)
        .map(p => ({
          id: p.performance_id,
          성과항목ID: p.performance_id,
          성과항목: p.성과항목명 || p.성과항목 || '',
          과제기여도: p.과제기여도 || '',
          // 레거시 형식 지원
          대분류: p.대분류 || '',
          소분류: p.소분류 || '',
          현재수준: levelText(p.현재수준),
          목표수준: levelText(p.목표수준),
          실적수준: levelText(p.실적수준),
          단위: p.단위 || ''
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
          knoxId: m.knoxId || '',
          부서: m.부서
        }))
    };
  });

  console.log('✅ 5테이블 분리 방식 CSV 파싱 완료:', enrichedProjects.length);
  return {
    projects: enrichedProjects,
    performances: globalPerformances,  // 글로벌 성과 항목 반환
    metadata: {
      exportDate: new Date().toISOString(),
      version: '3.1',
      type: 'csv-import-5table',
      projectCount: enrichedProjects.length,
      globalPerformanceCount: globalPerformances.length
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
    uuid: row.uuid || '',
    id: row.id || row.project_id,
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

  // 정수 필드 처리 (성과년도)
  if (header === '성과년도') {
    const num = parseInt(trimmedValue, 10);
    return isNaN(num) ? '' : num;
  }

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
 * 형식: "이름(부서)" 또는 "이름[knoxId](부서)"
 * @param {string} teamMemberString - 팀멤버목록 문자열
 * @returns {Array} 팀멤버 객체 배열
 */
const parseTeamMemberList = (teamMemberString) => {
  if (!teamMemberString || teamMemberString.trim() === '') return [];

  return teamMemberString.split(';').map(member => {
    // "이름[knoxId](부서)" 형식 지원
    const matchWithKnox = member.match(/(.+?)\[(.+?)\]\((.+?)\)/);
    if (matchWithKnox) {
      return {
        이름: matchWithKnox[1].trim(),
        knoxId: matchWithKnox[2].trim(),
        부서: matchWithKnox[3].trim()
      };
    }
    // 기존 "이름(부서)" 형식
    const match = member.match(/(.+?)\((.+?)\)/);
    return {
      이름: match ? match[1].trim() : member.trim(),
      knoxId: '',
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
/*
  지식 그래프 생성기 셋을 지웠다 (2026-08-09).
    exportKnowledgeGraph                   로컬 JSON 내보내기
    generateKnowledgeGraphData             과제-성과 노드/엣지
    generatePersonnelKnowledgeGraphData    과제-인력 노드/엣지

  왜  브라우저에서 만들어 **찍어 두는** 방식이었다. 저장한 순간에 얼어붙어
      과제명을 바꿔도 옛 이름이 남았고, 과제-성과 **또는** 과제-인력 둘 중
      하나만 담겼으며, `color`·`size` 가 노드에 박혀 데이터가 아니라 그림이었다.

  대신  대시보드 「관계도」 탭 — 서버가 `dt2_*` 를 읽어 **매번 지금 값**을 준다.
        backend `graph_view.py` · frontend `components/GraphView/`
*/
