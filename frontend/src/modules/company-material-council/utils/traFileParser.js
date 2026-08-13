/**
 * .tra 파일 파서
 * Tensile Test 결과 파일을 파싱하여 폼 필드에 매핑
 */

// .tra 파일의 레이블과 폼 필드명 매핑
const FIELD_MAPPING = {
  'Strain (plastic) at break': 'strainAtBreak',
  'Yield strain': 'yieldStrain',
  'Strain (plastic) at Fmax': 'strainAtFmax',
  'Work hardening coefficient k': 'workHardeningK',
  'Work hardening exponent n': 'workHardeningN',
  'Vertical anisotropy r': 'verticalAnisotropy',
  'Upper yield point': 'upperYieldPoint',
  'Lower yield point': 'lowerYieldPoint',
  'Force maximum': 'forceMaximum',
  'Force at proof stress 0.2%': 'forceProofStress',
  'Specimen number': 'specimenNumber',
  'Specimen thickness a0': 'specimenThicknessA0',
  'Specimen width b0': 'specimenWidthB0',
};

// 측정 데이터 컬럼 정의
export const MEASUREMENT_COLUMNS = [
  { key: 'extensometer', label: 'Standard Extensometer', unit: 'mm' },
  { key: 'loadCell', label: 'Standard Load Cell', unit: 'N' },
  { key: 'specimenWidth', label: 'Specimen Width', unit: 'mm' },
];

/**
 * CSV 라인을 파싱하여 값 배열로 반환
 * 따옴표로 감싸진 값 처리
 */
const parseCSVLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
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
 * 레이블에서 기본 이름 추출 (중괄호 내용 제거)
 * ex) "Work hardening coefficient k{lo  10 - 15}" → "Work hardening coefficient k"
 */
const extractBaseLabel = (label) => {
  return label.replace(/\{[^}]*\}/g, '').trim();
};

/**
 * 값이 유효한지 확인 (Unknown이 아닌 경우)
 */
const isValidValue = (value) => {
  if (!value) return false;
  const strValue = String(value).trim().toLowerCase();
  return strValue !== 'unknown' && strValue !== '';
};

/**
 * 고유 ID 생성
 */
const generateRowId = () => {
  return `row_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * .tra 파일 내용을 파싱하여 폼 데이터로 변환
 * @param {string} content - 파일 내용
 * @returns {Object} - 파싱된 폼 데이터
 */
export const parseTraFile = (content) => {
  const lines = content.split('\n').filter(line => line.trim());
  const formData = {};
  const measurementData = [];
  let isDataSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);

    // 데이터 섹션 헤더 감지 (Standard extensometer 등)
    if (values[0] && values[0].includes('Standard extensometer')) {
      isDataSection = true;
      continue;
    }

    // 단위 행 스킵 (mm, N, mm)
    if (isDataSection && values[0] === 'mm') {
      continue;
    }

    // 데이터 섹션 - 측정 데이터
    if (isDataSection) {
      const numericValues = values.map(v => parseFloat(v));
      if (!isNaN(numericValues[0])) {
        measurementData.push({
          id: generateRowId(),
          extensometer: numericValues[0],
          loadCell: numericValues[1],
          specimenWidth: numericValues[2],
        });
      }
      continue;
    }

    // 키-값 섹션 파싱
    if (values.length >= 2) {
      const label = values[0].replace(/^"|"$/g, '');
      const value = values[1].replace(/^"|"$/g, '');

      // 기본 레이블로 필드 매핑 찾기
      const baseLabel = extractBaseLabel(label);
      let fieldName = null;

      for (const [key, field] of Object.entries(FIELD_MAPPING)) {
        if (baseLabel.startsWith(key) || baseLabel === key) {
          fieldName = field;
          break;
        }
      }

      if (fieldName && isValidValue(value)) {
        formData[fieldName] = value;
      }
    }
  }

  return {
    formData,
    measurementData,
    rawFieldCount: Object.keys(formData).length,
    measurementCount: measurementData.length,
  };
};

/**
 * 빈 측정 데이터 행 생성
 */
export const createEmptyMeasurementRow = () => ({
  id: generateRowId(),
  extensometer: 0,
  loadCell: 0,
  specimenWidth: 0,
});

/**
 * 파일 확장자 확인
 */
export const isTraFile = (filename) => {
  return filename.toLowerCase().endsWith('.tra');
};

export default parseTraFile;
