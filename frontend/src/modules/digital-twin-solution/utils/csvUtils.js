/**
 * 디지털 트윈 포털 솔루션 맵 데이터의 CSV 변환을 위한 유틸리티
 */

/**
 * 디지털 트윈 솔루션 데이터를 CSV 형태로 변환
 * @param {Array} technologies - 솔루션 배열
 * @returns {Array} CSV 형태의 데이터 배열
 */
export const technologiesToCSV = (technologies) => {
  if (!Array.isArray(technologies) || technologies.length === 0) {
    return [];
  }

  return technologies.map(tech => ({
    'ID': tech.id,
    'Name': tech.name || '',
    'Description': tech.description || '',
    'Sector': tech.sector || tech.quadrant || '', // sector와 quadrant 모두 지원
    'Quadrant': tech.quadrant || tech.sector || '', // 하위 호환성
    'Ring': tech.ring || '',
    'Is New': tech.isNew ? 'true' : 'false',
    'Moved': tech.moved || 0,
    'Category': tech.category || '',
    'Tags': Array.isArray(tech.tags) ? tech.tags.join(';') : (tech.tags || ''),
    'Website': tech.website || '',
    'License': tech.license || '',
    'Assessment': tech.assessment || '',
    'Language': tech.language || '',
    'Platform': tech.platform || '',
    'Maturity Level': tech.maturityLevel || '',
    'Adoption Status': tech.adoptionStatus || '',
    'Strategic Importance': tech.strategicImportance || '',
    'Risk Level': tech.riskLevel || '',
    'Investment': tech.investment || '',
    'Timeline': tech.timeline || '',
    'Owner': tech.owner || '',
    'Team': tech.team || '',
    'Budget': tech.budget || '',
    'Notes': tech.notes || '',
    'Created At': tech.createdAt || '',
    'Updated At': tech.updatedAt || '',
    'Last Reviewed': tech.lastReviewed || ''
  }));
};

/**
 * CSV 데이터를 디지털 트윈 솔루션 형태로 변환
 * @param {Array} csvData - CSV 데이터 배열
 * @returns {Array} 솔루션 배열
 */
export const csvToTechnologies = (csvData) => {
  if (!Array.isArray(csvData) || csvData.length === 0) {
    return [];
  }

  return csvData.map((row, index) => {
    const id = row.ID || row.id || `solution_${Date.now()}_${index}`;
    
    // sector와 quadrant 필드 처리 (우선순위: sector > quadrant)
    const sector = row.Sector || row.sector || row.Quadrant || row.quadrant || 'tools';
    
    return {
      id,
      name: row.Name || row.name || `Solution ${index + 1}`,
      description: row.Description || row.description || '',
      sector, // 통합된 필드명 사용
      quadrant: sector, // 하위 호환성 유지
      ring: row.Ring || row.ring || 'assess',
      isNew: (row['Is New'] || row.isNew || 'false').toString().toLowerCase() === 'true',
      moved: parseInt(row.Moved || row.moved || 0),
      category: row.Category || row.category || '',
      tags: parseTagsFromString(row.Tags || row.tags || ''),
      website: row.Website || row.website || '',
      license: row.License || row.license || '',
      assessment: row.Assessment || row.assessment || '',
      language: row.Language || row.language || '',
      platform: row.Platform || row.platform || '',
      maturityLevel: row['Maturity Level'] || row.maturityLevel || '',
      adoptionStatus: row['Adoption Status'] || row.adoptionStatus || '',
      strategicImportance: row['Strategic Importance'] || row.strategicImportance || '',
      riskLevel: row['Risk Level'] || row.riskLevel || '',
      investment: row.Investment || row.investment || '',
      timeline: row.Timeline || row.timeline || '',
      owner: row.Owner || row.owner || '',
      team: row.Team || row.team || '',
      budget: row.Budget || row.budget || '',
      notes: row.Notes || row.notes || '',
      createdAt: row['Created At'] || row.createdAt || new Date().toISOString(),
      updatedAt: row['Updated At'] || row.updatedAt || new Date().toISOString(),
      lastReviewed: row['Last Reviewed'] || row.lastReviewed || ''
    };
  });
};

/**
 * 문자열에서 태그 배열로 파싱
 * @param {string} tagsString - 태그 문자열 (세미콜론으로 구분)
 * @returns {Array} 태그 배열
 */
const parseTagsFromString = (tagsString) => {
  if (!tagsString || typeof tagsString !== 'string') {
    return [];
  }
  
  return tagsString
    .split(';')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0);
};

/**
 * 디지털 트윈 솔루션 CSV 데이터 유효성 검증
 * @param {Array} data - 검증할 데이터
 * @returns {Object} 검증 결과
 */
export const validateTechRadarCSVData = (data) => {
  const result = {
    isValid: true,
    errors: [],
    warnings: []
  };

  if (!Array.isArray(data) || data.length === 0) {
    result.isValid = false;
    result.errors.push('데이터가 비어있거나 올바른 형식이 아닙니다.');
    return result;
  }

  const requiredFields = ['Name', 'name'];
  const firstRow = data[0];
  const availableFields = Object.keys(firstRow);
  
  // 필수 필드 중 하나라도 있는지 확인
  const hasNameField = requiredFields.some(field => availableFields.includes(field));
  if (!hasNameField) {
    result.errors.push('솔루션 이름 필드 (Name 또는 name)가 필요합니다.');
    result.isValid = false;
  }

  // 유효한 섹터/사분면과 링 값들 (디지털 트윈 전용)
  const validSectors = [
    'simulation-methods', 'digital-twin-platforms', 'ai-ml-simulation', 'visualization-collaboration',
    'tools', 'techniques', 'platforms', 'languages' // 전통적인 Tech Radar 기준
  ];
  const validRings = ['adopt', 'trial', 'assess', 'hold'];

  // 각 행 검증
  data.forEach((row, index) => {
    const rowNum = index + 1;
    
    // 섹터/사분면 검증 (더 관대하게 처리)
    const sector = row.Sector || row.sector || row.Quadrant || row.quadrant;
    if (sector && !validSectors.includes(sector.toLowerCase().replace(/\s+/g, '-'))) {
      // 섹터가 정확히 일치하지 않아도 경고만 표시
      result.warnings.push(`${rowNum}행: 알 수 없는 섹터 '${sector}'. 추천 값: ${validSectors.join(', ')}`);
    }
    
    // 링 검증
    const ring = row.Ring || row.ring;
    if (ring && !validRings.includes(ring.toLowerCase())) {
      result.warnings.push(`${rowNum}행: 알 수 없는 링 '${ring}'. 유효한 값: ${validRings.join(', ')}`);
    }
    
    // 이동 값 검증
    const moved = row.Moved || row.moved;
    if (moved !== undefined && moved !== '') {
      const movedNum = parseInt(moved);
      if (isNaN(movedNum)) {
        result.warnings.push(`${rowNum}행: Moved 값은 숫자여야 합니다 (${moved})`);
      }
    }
    
    // 웹사이트 URL 검증
    const website = row.Website || row.website;
    if (website && !isValidURL(website)) {
      result.warnings.push(`${rowNum}행: 웹사이트 URL 형식이 올바르지 않습니다 (${website})`);
    }
  });

  // ID 중복 검사
  const ids = data.map(row => row.ID || row.id).filter(Boolean);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    result.errors.push(`중복된 ID가 있습니다: ${[...new Set(duplicateIds)].join(', ')}`);
    result.isValid = false;
  }

  // 솔루션명 중복 검사
  const names = data.map(row => (row.Name || row.name || '').toLowerCase()).filter(name => name);
  const duplicateNames = names.filter((name, index) => names.indexOf(name) !== index);
  if (duplicateNames.length > 0) {
    result.warnings.push(`중복된 솔루션명이 있습니다: ${[...new Set(duplicateNames)].join(', ')}`);
  }

  return result;
};

/**
 * URL 유효성 검증
 * @param {string} url - 검증할 URL
 * @returns {boolean} 유효한 URL인지 여부
 */
const isValidURL = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * 디지털 트윈 솔루션 데이터를 섹터별로 그룹화하여 CSV로 변환
 * @param {Array} technologies - 솔루션 배열
 * @returns {Object} 섹터별로 그룹화된 CSV 데이터
 */
export const technologiesToGroupedCSV = (technologies) => {
  if (!Array.isArray(technologies) || technologies.length === 0) {
    return {
      'simulation-methods': [],
      'digital-twin-platforms': [],
      'ai-ml-simulation': [],
      'visualization-collaboration': [],
      tools: [],
      techniques: [],
      platforms: [],
      languages: []
    };
  }

  const grouped = {
    'simulation-methods': [],
    'digital-twin-platforms': [],
    'ai-ml-simulation': [],
    'visualization-collaboration': [],
    tools: [],
    techniques: [],
    platforms: [],
    languages: []
  };

  technologies.forEach(tech => {
    const sector = (tech.sector || tech.quadrant || 'tools').toLowerCase();
    if (grouped[sector]) {
      grouped[sector].push({
        'Name': tech.name || '',
        'Description': tech.description || '',
        'Ring': tech.ring || '',
        'Is New': tech.isNew ? 'true' : 'false',
        'Moved': tech.moved || 0,
        'Category': tech.category || '',
        'Assessment': tech.assessment || '',
        'Notes': tech.notes || ''
      });
    }
  });

  return grouped;
};

/**
 * 링별 통계를 CSV 형태로 변환
 * @param {Array} technologies - 솔루션 배열
 * @returns {Array} 링별 통계 CSV 데이터
 */
export const technologiesToStatisticsCSV = (technologies) => {
  if (!Array.isArray(technologies) || technologies.length === 0) {
    return [];
  }

  const stats = {
    adopt: { total: 0, new: 0, moved: 0 },
    trial: { total: 0, new: 0, moved: 0 },
    assess: { total: 0, new: 0, moved: 0 },
    hold: { total: 0, new: 0, moved: 0 }
  };

  technologies.forEach(tech => {
    const ring = (tech.ring || 'assess').toLowerCase();
    if (stats[ring]) {
      stats[ring].total++;
      if (tech.isNew) stats[ring].new++;
      if (tech.moved !== 0) stats[ring].moved++;
    }
  });

  return Object.entries(stats).map(([ring, data]) => ({
    'Ring': ring.charAt(0).toUpperCase() + ring.slice(1),
    'Total Solutions': data.total,
    'New Solutions': data.new,
    'Moved Solutions': data.moved,
    'Percentage': ((data.total / technologies.length) * 100).toFixed(1) + '%'
  }));
};
