/**
 * DMA Freq-Temp Sweep CSV 파일 파서
 * CSV 파일을 파싱하여 폼 데이터, 온도별 측정 데이터, TTS 데이터를 추출
 */

// 온도 스윕 데이터 컬럼 정의
export const FREQ_TEMP_COLUMNS = [
  { key: 'temperature', label: 'Temperature', unit: '°C' },
  { key: 'frequency', label: 'Frequency', unit: 'Hz' },
  { key: 'angularFrequency', label: 'Angular Freq', unit: 'rad/s' },
  { key: 'storageModulus', label: "Storage Modulus", unit: 'MPa' },
  { key: 'lossModulus', label: "Loss Modulus", unit: 'MPa' },
  { key: 'tanDelta', label: 'Tan(delta)', unit: '' },
  { key: 'oscillationStrain', label: 'Strain', unit: '%' },
  { key: 'oscillationStress', label: 'Stress', unit: 'MPa' },
];

// TTS Shift Factors 컬럼
export const SHIFT_FACTORS_COLUMNS = [
  { key: 'temperature', label: 'Temperature', unit: '°C' },
  { key: 'aT', label: 'aT (x variable)', unit: '' },
  { key: 'bTBase', label: 'bT base', unit: '' },
  { key: 'bTDelta', label: 'bT delta', unit: '' },
  { key: 'bT', label: 'bT (y variables)', unit: '' },
];

// Master Curve 컬럼
export const MASTER_CURVE_COLUMNS = [
  { key: 'frequency', label: 'Frequency', unit: 'Hz' },
  { key: 'storageModulus', label: "Storage Modulus", unit: 'MPa' },
  { key: 'lossModulus', label: "Loss Modulus", unit: 'MPa' },
  { key: 'tanDelta', label: 'Tan(delta)', unit: '' },
  { key: 'complexModulus', label: 'Complex Modulus', unit: 'MPa' },
  { key: 'phaseAngle', label: 'Phase Angle', unit: '°' },
];

// 헤더 필드 매핑 (CSV 키 → 폼 필드명)
const HEADER_FIELD_MAPPING = {
  'rundate': 'dmaFTRundate',
  'Instrument name': 'dmaFTInstrument',
  'Instrument location': 'dmaFTInstrumentLocation',
  'Operator': 'dmaFTOperator',
  'Sample name': 'dmaFTSampleName',
  'Geometry name': 'dmaFTGeometry',
  'Procedure name': 'dmaFTProcedure',
  'proceduresegments': 'dmaFTSegments',
  'Length': 'dmaFTLength',
  'Width': 'dmaFTWidth',
  'Thickness': 'dmaFTThickness',
};

/**
 * DMA Freq-Temp Sweep CSV 파일 파싱
 * @param {string} content - CSV 파일 내용
 * @returns {Object} { formData, tempSweepData, shiftFactorsData, masterCurveData, rawFieldCount }
 */
export const parseFreqTempFile = (content) => {
  const lines = content.split(/\r?\n/);
  const formData = {};
  const tempSweepData = [];
  const shiftFactorsData = [];
  const masterCurveData = [];
  const tempSweepTables = []; // 각 테이블 정보 저장
  let rawFieldCount = 0;

  let currentSection = 'header';
  let currentStepType = null;
  let currentStepName = '';
  let headerRowIndex = -1;
  let hasFrequencyColumn = false;
  let frequencyValues = []; // 첫 번째 step에서 추출한 frequency 값들
  let currentRowIndex = 0;
  let currentRefTemp = null;
  let tempSweepTableIndex = -1; // 현재 온도 스윕 테이블 인덱스

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) {
      currentRowIndex = 0;
      continue;
    }

    // [step] 섹션 시작 감지
    if (line === '[step]') {
      currentSection = 'step';
      headerRowIndex = -1;
      currentRowIndex = 0;
      continue;
    }

    if (currentSection === 'header') {
      // 헤더 섹션 파싱
      const parts = line.split(',');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        let value = parts.slice(1).join(',').trim();

        // 단위 제거
        if (key === 'Length' || key === 'Width' || key === 'Thickness') {
          value = value.replace(/\s*mm\s*$/i, '').trim();
        }

        if (HEADER_FIELD_MAPPING[key]) {
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
    } else if (currentSection === 'step') {
      // Step 이름 파싱
      if (headerRowIndex === -1) {
        // 첫 줄은 step 이름
        if (line.includes('Temperature Sweep') || line.includes('temperature sweep')) {
          currentStepType = 'tempSweep';
          currentStepName = line;
          tempSweepTableIndex++;
          // 테이블 정보 저장 (온도는 첫 번째 데이터 행에서 추출)
          tempSweepTables.push({ index: tempSweepTableIndex, name: line, temperature: null });
        } else if (line.includes('shift factors')) {
          currentStepType = 'shiftFactors';
          currentStepName = line;
          // 참조 온도 추출 (예: "TTS 30 - shift factors" → 30)
          const tempMatch = line.match(/TTS\s*(\d+)?/i);
          currentRefTemp = tempMatch && tempMatch[1] ? parseFloat(tempMatch[1]) : 20;
        } else if (line.includes('master curve')) {
          currentStepType = 'masterCurve';
          currentStepName = line;
          // 참조 온도 추출 (예: "TTS - master curve (20.0 °C)" → 20)
          const tempMatch = line.match(/\(([0-9.-]+)/);
          currentRefTemp = tempMatch ? parseFloat(tempMatch[1]) : 20;
        } else {
          currentStepType = 'unknown';
        }
        headerRowIndex = i;
        continue;
      }

      // 컬럼 헤더 행
      if (i === headerRowIndex + 1) {
        // Frequency 컬럼 존재 여부 확인
        hasFrequencyColumn = line.toLowerCase().includes('frequency') &&
                            line.split(',').some(col => col.trim().toLowerCase() === 'frequency');
        continue;
      }

      // 단위 행 건너뛰기
      if (i === headerRowIndex + 2) {
        continue;
      }

      // 데이터 행 파싱
      if (i > headerRowIndex + 2) {
        const values = line.split(',').map(v => v.trim());

        if (currentStepType === 'tempSweep') {
          parseTempSweepRow(values, hasFrequencyColumn, tempSweepData, frequencyValues, currentRowIndex, tempSweepTableIndex, tempSweepTables);
          currentRowIndex++;
        } else if (currentStepType === 'shiftFactors') {
          parseShiftFactorsRow(values, shiftFactorsData, currentRefTemp);
        } else if (currentStepType === 'masterCurve') {
          parseMasterCurveRow(values, masterCurveData, currentRefTemp);
        }
      }
    }
  }

  // frequency 값이 없는 행에 frequency 값 채우기
  if (frequencyValues.length > 0) {
    let freqIndex = 0;
    tempSweepData.forEach(row => {
      if (row.frequency === null || row.frequency === undefined || row.frequency === 0) {
        // angular frequency로부터 frequency 계산 (f = ω / 2π)
        if (row.angularFrequency) {
          row.frequency = row.angularFrequency / (2 * Math.PI);
        } else if (frequencyValues[freqIndex % frequencyValues.length]) {
          row.frequency = frequencyValues[freqIndex % frequencyValues.length];
        }
      }
      freqIndex++;
    });
  }

  return {
    formData,
    tempSweepData,
    shiftFactorsData,
    masterCurveData,
    tempSweepTables, // 테이블 정보
    rawFieldCount,
    tempSweepCount: tempSweepData.length,
    shiftFactorsCount: shiftFactorsData.length,
    masterCurveCount: masterCurveData.length,
  };
};

function parseTempSweepRow(values, hasFrequencyColumn, tempSweepData, frequencyValues, rowIndex, tableIndex, tables) {
  if (values.length < 8) return;

  let frequency = null;
  let baseIndex = 0;

  if (hasFrequencyColumn && values.length >= 9) {
    frequency = parseFloat(values[8]) || null;
    if (frequency && rowIndex < 20) {
      frequencyValues.push(frequency);
    }
  }

  const temperature = parseFloat(values[2]) || 0;

  // 첫 번째 데이터 행에서 테이블 온도 설정
  if (rowIndex === 0 && tables[tableIndex]) {
    tables[tableIndex].temperature = Math.round(temperature);
  }

  const row = {
    id: `ft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    tableIndex: tableIndex, // 테이블 인덱스 추가
    angularFrequency: parseFloat(values[0]) || 0,
    stepTime: parseFloat(values[1]) || 0,
    temperature: temperature,
    oscillationStrain: parseFloat(values[3]) || 0,
    oscillationStress: parseFloat(values[4]) || 0,
    tanDelta: values[5] ? parseFloat(values[5]) : null,
    storageModulus: parseFloat(values[6]) || 0,
    lossModulus: parseFloat(values[7]) || 0,
    frequency: frequency,
  };

  tempSweepData.push(row);
}

function parseShiftFactorsRow(values, shiftFactorsData, refTemp) {
  if (values.length < 5) return;

  const row = {
    id: `sf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    refTemperature: refTemp,
    temperature: parseFloat(values[0]) || 0,
    aT: parseFloat(values[1]) || 0,
    bTBase: parseFloat(values[2]) || 1,
    bTDelta: parseFloat(values[3]) || 1,
    bT: parseFloat(values[4]) || 1,
  };

  shiftFactorsData.push(row);
}

function parseMasterCurveRow(values, masterCurveData, refTemp) {
  if (values.length < 9) return;

  const row = {
    id: `mc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    refTemperature: refTemp,
    frequency: parseFloat(values[0]) || 0,
    temperature: parseFloat(values[1]) || 0,
    storageModulus: parseFloat(values[2]) || 0,
    lossModulus: parseFloat(values[3]) || 0,
    angularFrequency: parseFloat(values[4]) || 0,
    invTemperature: parseFloat(values[5]) || 0,
    phaseAngle: parseFloat(values[6]) || 0,
    tanDelta: parseFloat(values[7]) || 0,
    complexModulus: parseFloat(values[8]) || 0,
    complexCompliance: values[9] ? parseFloat(values[9]) : null,
    storageCompliance: values[10] ? parseFloat(values[10]) : null,
    lossCompliance: values[11] ? parseFloat(values[11]) : null,
  };

  masterCurveData.push(row);
}

/**
 * 파일이 DMA Freq-Temp CSV 파일인지 확인
 * @param {string} filename - 파일 이름
 * @returns {boolean}
 */
export const isFreqTempFile = (filename) => {
  return filename.toLowerCase().endsWith('.csv');
};

/**
 * 빈 온도 스윕 데이터 행 생성
 */
export const createEmptyFreqTempRow = () => ({
  id: `ft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  temperature: 0,
  frequency: 0,
  angularFrequency: 0,
  storageModulus: 0,
  lossModulus: 0,
  tanDelta: null,
  oscillationStrain: 0,
  oscillationStress: 0,
});

/**
 * 온도 목록 추출 (유니크)
 */
export const getUniqueTemperatures = (data) => {
  const temps = [...new Set(data.map(d => d.temperature))];
  return temps.sort((a, b) => a - b);
};

/**
 * 참조 온도 목록 추출 (shift factors / master curve)
 */
export const getRefTemperatures = (shiftFactorsData, masterCurveData) => {
  const sfTemps = [...new Set(shiftFactorsData.map(d => d.refTemperature))];
  const mcTemps = [...new Set(masterCurveData.map(d => d.refTemperature))];
  return [...new Set([...sfTemps, ...mcTemps])].sort((a, b) => a - b);
};
