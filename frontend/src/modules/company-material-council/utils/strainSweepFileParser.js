/**
 * DMA Strain Sweep CSV 파일 파서
 * CSV 파일을 파싱하여 폼 데이터와 측정 데이터를 추출
 */

// 측정 데이터 컬럼 정의
export const STRAIN_SWEEP_COLUMNS = [
  { key: 'angularFrequency', label: 'Angular Frequency', unit: 'rad/s' },
  { key: 'stepTime', label: 'Step Time', unit: 's' },
  { key: 'temperature', label: 'Temperature', unit: '°C' },
  { key: 'oscillationStrain', label: 'Oscillation Strain', unit: '%' },
  { key: 'oscillationStress', label: 'Oscillation Stress', unit: 'MPa' },
  { key: 'tanDelta', label: 'Tan(delta)', unit: '' },
  { key: 'storageModulus', label: 'Storage Modulus', unit: 'MPa' },
  { key: 'lossModulus', label: 'Loss Modulus', unit: 'MPa' },
];

// 헤더 필드 매핑 (CSV 키 → 폼 필드명)
const HEADER_FIELD_MAPPING = {
  'rundate': 'dmaSSRundate',
  'Instrument name': 'dmaSSInstrument',
  'Instrument location': 'dmaSSInstrumentLocation',
  'Operator': 'dmaSSOperator',
  'Sample name': 'dmaSSSampleName',
  'Geometry name': 'dmaSSGeometry',
  'Procedure name': 'dmaSSProcedure',
  'proceduresegments': 'dmaSSSegments',
  'Length': 'dmaSSLength',
  'Width': 'dmaSSWidth',
  'Thickness': 'dmaSSThickness',
};

/**
 * DMA Strain Sweep CSV 파일 파싱
 * @param {string} content - CSV 파일 내용
 * @returns {Object} { formData, measurementData, rawFieldCount, measurementCount }
 */
export const parseStrainSweepFile = (content) => {
  const lines = content.split(/\r?\n/);
  const formData = {};
  const measurementData = [];
  let rawFieldCount = 0;
  let inDataSection = false;
  let headerRowIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) continue;

    // [step] 섹션 시작 감지
    if (line === '[step]') {
      inDataSection = true;
      continue;
    }

    if (!inDataSection) {
      // 헤더 섹션 파싱
      const parts = line.split(',');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        let value = parts.slice(1).join(',').trim();

        // 단위 제거 (예: "50.0 mm" → "50.0")
        if (key === 'Length' || key === 'Width' || key === 'Thickness') {
          value = value.replace(/\s*mm\s*$/i, '').trim();
        }

        // 매핑된 필드가 있으면 저장
        if (HEADER_FIELD_MAPPING[key]) {
          // 날짜 형식 변환 (YYYY-MM-DD)
          if (key === 'rundate') {
            const dateMatch = value.match(/(\d{4})-(\d{2})-(\d{2})/);
            if (dateMatch) {
              value = dateMatch[0];
            }
          }

          formData[HEADER_FIELD_MAPPING[key]] = value;
          rawFieldCount++;
        }
      }
    } else {
      // 데이터 섹션 파싱
      // 스텝 이름 행 건너뛰기 (예: "Strain Sweep - 2")
      if (line.includes('Strain Sweep') || line.includes('strain sweep')) {
        continue;
      }

      // 컬럼 헤더 행 감지
      if (line.includes('Angular frequency') || line.includes('angular frequency')) {
        headerRowIndex = i;
        continue;
      }

      // 단위 행 건너뛰기
      if (headerRowIndex >= 0 && i === headerRowIndex + 1) {
        continue;
      }

      // 데이터 행 파싱
      if (headerRowIndex >= 0 && i > headerRowIndex + 1) {
        const values = line.split(',').map(v => v.trim());

        if (values.length >= 8) {
          const row = {
            id: `ss_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            angularFrequency: parseFloat(values[0]) || 0,
            stepTime: parseFloat(values[1]) || 0,
            temperature: parseFloat(values[2]) || 0,
            oscillationStrain: parseFloat(values[3]) || 0,
            oscillationStress: parseFloat(values[4]) || 0,
            tanDelta: values[5] ? parseFloat(values[5]) : null,
            storageModulus: parseFloat(values[6]) || 0,
            lossModulus: parseFloat(values[7]) || 0,
          };
          measurementData.push(row);
        }
      }
    }
  }

  return {
    formData,
    measurementData,
    rawFieldCount,
    measurementCount: measurementData.length,
  };
};

/**
 * 파일이 DMA Strain Sweep CSV 파일인지 확인
 * @param {string} filename - 파일 이름
 * @returns {boolean}
 */
export const isStrainSweepFile = (filename) => {
  return filename.toLowerCase().endsWith('.csv');
};

/**
 * 빈 측정 데이터 행 생성
 * @returns {Object}
 */
export const createEmptyStrainSweepRow = () => ({
  id: `ss_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  angularFrequency: 0,
  stepTime: 0,
  temperature: 0,
  oscillationStrain: 0,
  oscillationStress: 0,
  tanDelta: null,
  storageModulus: 0,
  lossModulus: 0,
});
