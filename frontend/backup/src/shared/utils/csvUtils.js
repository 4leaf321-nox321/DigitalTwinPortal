/**
 * CSV 파일 처리를 위한 유틸리티 함수들
 */

/**
 * CSV 문자열을 파싱하여 객체 배열로 변환
 * @param {string} csvText - CSV 문자열
 * @param {Object} options - 파싱 옵션
 * @returns {Array} 파싱된 데이터 배열
 */
export const parseCSV = (csvText, options = {}) => {
  const {
    delimiter = ',',
    hasHeader = true,
    encoding = 'utf-8'
  } = options;

  try {
    // 줄바꿈으로 행 분리 (다양한 줄바꿈 형식 지원)
    const lines = csvText.split(/\r?\n/).filter(line => line.trim());
    
    if (lines.length === 0) {
      return [];
    }

    // 헤더 처리
    let headers = [];
    let dataStartIndex = 0;
    
    if (hasHeader && lines.length > 0) {
      headers = parseCSVLine(lines[0], delimiter);
      dataStartIndex = 1;
    }

    // 데이터 행 파싱
    const data = [];
    for (let i = dataStartIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = parseCSVLine(line, delimiter);
      
      if (hasHeader) {
        const row = {};
        headers.forEach((header, index) => {
          row[header.trim()] = values[index] || '';
        });
        data.push(row);
      } else {
        data.push(values);
      }
    }

    return data;
  } catch (error) {
    throw new Error(`CSV 파싱 오류: ${error.message}`);
  }
};

/**
 * CSV 한 줄을 파싱하여 배열로 변환
 * @param {string} line - CSV 줄
 * @param {string} delimiter - 구분자
 * @returns {Array} 파싱된 값 배열
 */
const parseCSVLine = (line, delimiter = ',') => {
  const result = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // 이스케이프된 따옴표
        current += '"';
        i += 2;
        continue;
      } else {
        // 따옴표 시작/끝
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      // 구분자 발견
      result.push(current);
      current = '';
    } else {
      current += char;
    }
    i++;
  }

  // 마지막 값 추가
  result.push(current);

  return result;
};

/**
 * 객체 배열을 CSV 문자열로 변환
 * @param {Array} data - 변환할 데이터 배열
 * @param {Object} options - 변환 옵션
 * @returns {string} CSV 문자열
 */
export const arrayToCSV = (data, options = {}) => {
  const {
    delimiter = ',',
    includeHeader = true,
    encoding = 'utf-8'
  } = options;

  try {
    if (!Array.isArray(data) || data.length === 0) {
      return '';
    }

    // 헤더 추출 (첫 번째 객체의 키들)
    const headers = Object.keys(data[0]);
    const csvRows = [];

    // 헤더 추가
    if (includeHeader) {
      csvRows.push(headers.map(header => escapeCSVValue(header, delimiter)).join(delimiter));
    }

    // 데이터 행 추가
    data.forEach(row => {
      const values = headers.map(header => {
        const value = row[header];
        return escapeCSVValue(value, delimiter);
      });
      csvRows.push(values.join(delimiter));
    });

    return csvRows.join('\n');
  } catch (error) {
    throw new Error(`CSV 변환 오류: ${error.message}`);
  }
};

/**
 * CSV 값 이스케이프 처리
 * @param {any} value - 이스케이프할 값
 * @param {string} delimiter - 구분자
 * @returns {string} 이스케이프된 값
 */
const escapeCSVValue = (value, delimiter = ',') => {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);
  
  // 구분자, 따옴표, 줄바꿈이 포함된 경우 따옴표로 감싸기
  if (stringValue.includes(delimiter) || 
      stringValue.includes('"') || 
      stringValue.includes('\n') ||
      stringValue.includes('\r')) {
    
    // 따옴표를 이스케이프하고 전체를 따옴표로 감싸기
    const escaped = stringValue.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  return stringValue;
};

/**
 * 파일에서 CSV 읽기
 * @param {File} file - 파일 객체
 * @param {Object} options - 파싱 옵션
 * @returns {Promise<Array>} 파싱된 데이터 배열
 */
export const readCSVFile = (file, options = {}) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('파일이 선택되지 않았습니다.'));
      return;
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      reject(new Error('CSV 파일만 업로드 가능합니다.'));
      return;
    }

    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const csvText = e.target.result;
        const data = parseCSV(csvText, options);
        resolve(data);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('파일 읽기 중 오류가 발생했습니다.'));
    };
    
    reader.readAsText(file, options.encoding || 'utf-8');
  });
};

/**
 * CSV 파일 다운로드 (UTF-8 BOM 포함)
 * @param {Array} data - 다운로드할 데이터
 * @param {string} filename - 파일명
 * @param {Object} options - 변환 옵션
 */
export const downloadCSV = (data, filename = 'export.csv', options = {}) => {
  try {
    const csvContent = arrayToCSV(data, options);
    
    // UTF-8 BOM을 추가하여 한글 등이 제대로 표시되도록 함
    const BOM = '\uFEFF';
    const csvWithBOM = BOM + csvContent;
    
    const blob = new Blob([csvWithBOM], { 
      type: 'text/csv;charset=utf-8;' 
    });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
    
    // 링크에 UTF-8 인코딩 속성 추가
    link.setAttribute('charset', 'utf-8');
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  } catch (error) {
    throw new Error(`CSV 다운로드 오류: ${error.message}`);
  }
};

/**
 * CSV 데이터 유효성 검증
 * @param {Array} data - 검증할 데이터
 * @param {Array} requiredFields - 필수 필드 목록
 * @returns {Object} 검증 결과
 */
export const validateCSVData = (data, requiredFields = []) => {
  const result = {
    isValid: true,
    errors: [],
    warnings: []
  };

  try {
    if (!Array.isArray(data)) {
      result.isValid = false;
      result.errors.push('데이터가 배열 형식이 아닙니다.');
      return result;
    }

    if (data.length === 0) {
      result.warnings.push('데이터가 비어있습니다.');
      return result;
    }

    // 필수 필드 검증
    if (requiredFields.length > 0) {
      const firstRow = data[0];
      const availableFields = Object.keys(firstRow);
      
      const missingFields = requiredFields.filter(field => 
        !availableFields.includes(field)
      );
      
      if (missingFields.length > 0) {
        result.isValid = false;
        result.errors.push(`필수 필드가 누락되었습니다: ${missingFields.join(', ')}`);
      }
    }

    // 데이터 일관성 검증
    const firstRowKeys = Object.keys(data[0]);
    for (let i = 1; i < data.length; i++) {
      const currentRowKeys = Object.keys(data[i]);
      if (currentRowKeys.length !== firstRowKeys.length) {
        result.warnings.push(`${i + 1}행의 컬럼 수가 다릅니다.`);
      }
    }

  } catch (error) {
    result.isValid = false;
    result.errors.push(`검증 중 오류: ${error.message}`);
  }

  return result;
};