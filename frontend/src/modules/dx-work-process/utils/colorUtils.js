// 노드 타입별 색상 매핑
const NODE_TYPE_COLORS = {
  person: '#4CAF50',        // 초록색 - 사람
  company: '#2196F3',       // 파란색 - 회사
  project: '#FF9800',       // 주황색 - 프로젝트
  skill: '#9C27B0',         // 보라색 - 기술/스킬
  department: '#FF5722',    // 빨간색 - 부서
  technology: '#607D8B',    // 회색 - 기술
  team: '#795548',          // 갈색 - 팀
  product: '#E91E63',       // 핑크색 - 제품
  service: '#00BCD4',       // 청록색 - 서비스
  location: '#8BC34A',      // 연두색 - 위치
  unknown: '#cccccc',       // 회색 - 알 수 없는 타입
  default: '#95a5a6'        // 기본 회색
};

// 잘 구분되는 색상 팔레트 (HSL 기반으로 균등하게 분포)
const DISTINCT_COLOR_PALETTE = [
  // 첫 번째 그룹: 채도 높은 색상들
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#34495e', '#f1c40f', '#e91e63',
  
  // 두 번째 그룹: 중간 채도 색상들  
  '#c0392b', '#2980b9', '#27ae60', '#d68910', '#8e44ad',
  '#16a085', '#d35400', '#2c3e50', '#f4d03f', '#ad1457',
  
  // 세 번째 그룹: 어두운 색상들
  '#922b21', '#1f4e79', '#1e8449', '#b7950b', '#6c3483',
  '#138d75', '#a04000', '#212f3c', '#b7950b', '#7b241c',
  
  // 네 번째 그룹: 밝은 색상들
  '#f1948a', '#85c1e9', '#82e0aa', '#f8c471', '#bb8fce',
  '#76d7c4', '#f0b27a', '#85929e', '#f7dc6f', '#f1a7bb'
];

// HSL을 HEX로 변환
export const hslToHex = (h, s, l) => {
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;

  if (0 <= h && h < 60) {
    r = c; g = x; b = 0;
  } else if (60 <= h && h < 120) {
    r = x; g = c; b = 0;
  } else if (120 <= h && h < 180) {
    r = 0; g = c; b = x;
  } else if (180 <= h && h < 240) {
    r = 0; g = x; b = c;
  } else if (240 <= h && h < 300) {
    r = x; g = 0; b = c;
  } else if (300 <= h && h < 360) {
    r = c; g = 0; b = x;
  }

  const toHex = (c) => {
    const hex = Math.round((c + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

// 기존 색상들과 구분되는 색상을 생성
export const generateDistinctColor = (existingColors = [], typeString = '') => {
  // 기존 색상들을 HSL로 변환
  const existingHSLs = existingColors
    .filter(color => color && color !== '#cccccc') // 회색 제외
    .map(color => hexToHsl(color))
    .filter(hsl => hsl !== null);
  
  // 색상 후보군 생성
  const candidates = [];
  
  // 1단계: 미리 정의된 팔레트에서 사용되지 않은 색상 찾기
  for (const color of DISTINCT_COLOR_PALETTE) {
    if (!existingColors.includes(color)) {
      const hsl = hexToHsl(color);
      if (hsl && isColorDistinct(hsl, existingHSLs)) {
        candidates.push({ color, score: getDistinctScore(hsl, existingHSLs) });
      }
    }
  }
  
  // 2단계: 후보가 없으면 HSL 공간에서 체계적으로 생성
  if (candidates.length === 0) {
    for (let h = 0; h < 360; h += 30) { // 색조 30도씩
      for (let s = 60; s <= 90; s += 15) { // 채도 60-90%
        for (let l = 40; l <= 65; l += 12) { // 명도 40-65%
          const hsl = { h, s, l };
          if (isColorDistinct(hsl, existingHSLs)) {
            const color = hslToHex(h, s, l);
            candidates.push({ color, score: getDistinctScore(hsl, existingHSLs) });
          }
        }
      }
    }
  }
  
  // 3단계: 타입 문자열 기반 해시로 일관성 있는 선택
  if (candidates.length > 0) {
    // 점수 순으로 정렬 (높은 점수 = 더 구분됨)
    candidates.sort((a, b) => b.score - a.score);
    
    // 타입 문자열이 있으면 해시를 사용하여 일관성 있게 선택
    if (typeString) {
      const hash = stringToHash(typeString);
      const index = Math.abs(hash) % Math.min(candidates.length, 5); // 상위 5개 중 선택
      return candidates[index].color;
    }
    
    // 가장 구분되는 색상 반환
    return candidates[0].color;
  }
  
  // 4단계: 모든 것이 실패하면 기본 색상 생성 (문자열 해시 기반)
  return generateColorFromString(typeString || 'default');
};

// 문자열을 해시로 변환
const stringToHash = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32bit integer로 변환
  }
  return hash;
};

// HSL 색상이 기존 색상들과 구분되는지 확인
const isColorDistinct = (newHsl, existingHsls, minHueDiff = 30, minSatDiff = 20, minLightDiff = 15) => {
  for (const existingHsl of existingHsls) {
    const hueDiff = Math.min(
      Math.abs(newHsl.h - existingHsl.h),
      360 - Math.abs(newHsl.h - existingHsl.h)
    );
    const satDiff = Math.abs(newHsl.s - existingHsl.s);
    const lightDiff = Math.abs(newHsl.l - existingHsl.l);
    
    // 색조, 채도, 명도 모든 면에서 충분히 다른지 확인
    if (hueDiff < minHueDiff && satDiff < minSatDiff && lightDiff < minLightDiff) {
      return false;
    }
  }
  return true;
};

// 색상의 구분도 점수 계산 (높을수록 더 구분됨)
const getDistinctScore = (newHsl, existingHsls) => {
  let totalScore = 0;
  
  for (const existingHsl of existingHsls) {
    const hueDiff = Math.min(
      Math.abs(newHsl.h - existingHsl.h),
      360 - Math.abs(newHsl.h - existingHsl.h)
    );
    const satDiff = Math.abs(newHsl.s - existingHsl.s);
    const lightDiff = Math.abs(newHsl.l - existingHsl.l);
    
    // 가중 점수 계산 (색조가 가장 중요, 다음 채도, 마지막 명도)
    const score = (hueDiff * 2) + (satDiff * 1.5) + lightDiff;
    totalScore += score;
  }
  
  return existingHsls.length > 0 ? totalScore / existingHsls.length : 100;
};

// HEX를 HSL로 변환
export const hexToHsl = (hex) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  
  if (max === min) {
    h = s = 0; // 무채색
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
};

// 여러 새로운 타입에 대해 구분되는 색상들을 배정
export const assignDistinctColors = (newTypes, existingTypes = []) => {
  const existingColors = existingTypes.map(type => type.color).filter(Boolean);
  const assignments = [];
  const usedColors = [...existingColors];
  
  for (const typeId of newTypes) {
    const distinctColor = generateDistinctColor(usedColors, typeId);
    assignments.push({
      id: typeId,
      label: typeId.charAt(0).toUpperCase() + typeId.slice(1),
      color: distinctColor
    });
    usedColors.push(distinctColor);
  }
  
  return assignments;
};

// 색상의 명도를 계산하여 대비되는 텍스트 색상 반환
export const getContrastTextColor = (backgroundColor) => {
  // 헥스 색상을 RGB로 변환
  const rgb = hexToRgb(backgroundColor);
  if (!rgb) return '#333333'; // 기본 어두운 색상
  
  // 상대 밝기 계산 (W3C 공식)
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  
  // 밝기에 따라 텍스트 색상 결정
  return luminance > 0.6 ? '#333333' : '#ffffff';
};

// HSL 색상을 RGB로 변환
export const hslToRgb = (h, s, l) => {
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;

  if (0 <= h && h < 60) {
    r = c; g = x; b = 0;
  } else if (60 <= h && h < 120) {
    r = x; g = c; b = 0;
  } else if (120 <= h && h < 180) {
    r = 0; g = c; b = x;
  } else if (180 <= h && h < 240) {
    r = 0; g = x; b = c;
  } else if (240 <= h && h < 300) {
    r = x; g = 0; b = c;
  } else if (300 <= h && h < 360) {
    r = c; g = 0; b = x;
  }

  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);

  return { r, g, b };
};

// 헥스 색상을 RGB로 변환
export const hexToRgb = (hex) => {
  // #이 없는 경우 추가
  if (!hex.startsWith('#')) {
    hex = '#' + hex;
  }
  
  // 3자리 헥스를 6자리로 확장
  if (hex.length === 4) {
    hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
  }
  
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

// RGB를 헥스로 변환
export const rgbToHex = (r, g, b) => {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
};

// 타입에 따른 색상 반환 (동적 색상 생성 포함)
export const getNodeColorByType = (type, customTypes = []) => {
  // 커스텀 타입 목록에서 먼저 찾기 (우선순위 높음)
  const customType = customTypes.find(t => t.id === type);
  if (customType && customType.color) {
    return customType.color;
  }

  // 기본 타입 색상이 있으면 사용
  if (NODE_TYPE_COLORS[type]) {
    return NODE_TYPE_COLORS[type];
  }

  // 타입명을 기반으로 해시 색상 생성
  if (type && type !== 'default') {
    return generateColorFromString(type);
  }

  return NODE_TYPE_COLORS.default;
};

// 문자열을 기반으로 일관된 색상 생성 (더 대비 친화적)
const generateColorFromString = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32bit integer로 변환
  }
  
  // HSL 색상으로 변환 (더 높은 채도와 적절한 밝기)
  const hue = Math.abs(hash) % 360;
  const saturation = 70 + (Math.abs(hash) % 25); // 70-95%
  const lightness = 45 + (Math.abs(hash) % 15);  // 45-60% (더 어두운 색상)
  
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

// 노드 스타일을 생성하는 함수 (색상 + 텍스트 색상 + 그림자)
export const getNodeStyle = (type, customTypes = []) => {
  const backgroundColor = getNodeColorByType(type, customTypes);
  const textColor = getContrastTextColor(backgroundColor);
  
  return {
    color: {
      background: backgroundColor,
      border: darkenColor(backgroundColor, 20),
      highlight: {
        background: lightenColor(backgroundColor, 10),
        border: darkenColor(backgroundColor, 30)
      }
    },
    font: {
      color: textColor,
      size: 14,
      face: 'Arial, sans-serif',
      strokeWidth: 2,
      strokeColor: textColor === '#ffffff' ? '#000000' : '#ffffff',
    },
    borderWidth: 2,
    shadow: {
      enabled: true,
      color: 'rgba(0,0,0,0.3)',
      size: 10,
      x: 2,
      y: 2
    }
  };
};

// 색상을 어둡게 만드는 함수
export const darkenColor = (color, percent) => {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  
  const factor = 1 - (percent / 100);
  return rgbToHex(
    Math.round(rgb.r * factor),
    Math.round(rgb.g * factor),
    Math.round(rgb.b * factor)
  );
};

// 색상을 밝게 만드는 함수
export const lightenColor = (color, percent) => {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  
  const factor = percent / 100;
  return rgbToHex(
    Math.round(rgb.r + (255 - rgb.r) * factor),
    Math.round(rgb.g + (255 - rgb.g) * factor),
    Math.round(rgb.b + (255 - rgb.b) * factor)
  );
};

// 모든 노드 타입 목록 반환
export const getNodeTypes = () => {
  return Object.keys(NODE_TYPE_COLORS).filter(type => type !== 'default');
};

// 타입별 색상 목록 반환
export const getTypeColorMap = () => {
  return { ...NODE_TYPE_COLORS };
};

// 노드 데이터에 타입별 색상과 스타일 적용
export const applyNodeTypeColors = (nodes, customTypes = []) => {
  return nodes.map(node => {
    const style = getNodeStyle(node.type, customTypes);
    return {
      ...node,
      ...style
    };
  });
};

// 색상 대비 비율 계산 (WCAG 기준)
export const getContrastRatio = (color1, color2) => {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  
  if (!rgb1 || !rgb2) return 0;
  
  const luminance1 = getRelativeLuminance(rgb1);
  const luminance2 = getRelativeLuminance(rgb2);
  
  const lighter = Math.max(luminance1, luminance2);
  const darker = Math.min(luminance1, luminance2);
  
  return (lighter + 0.05) / (darker + 0.05);
};

// 상대 밝기 계산
const getRelativeLuminance = (rgb) => {
  const { r, g, b } = rgb;
  
  const toLinear = (c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
};

// 엣지 스타일을 생성하는 함수
export const getEdgeStyle = (type, customTypes = []) => {
  // 커스텀 타입에서 찾기
  const customType = customTypes.find(t => t.id === type);
  if (customType && customType.style) {
    return customType.style;
  }
  
  // 기본 엣지 스타일
  return {
    color: '#666666',
    width: 2,
    font: {
      size: 12,
      align: 'middle',
      strokeWidth: 3,
      strokeColor: '#ffffff'
    }
  };
};

// 엣지 타입별 기본 색상 매핑
const EDGE_TYPE_COLORS = {
  'works_for': '#3498db',
  'participates_in': '#2ecc71', 
  'has_skill': '#f39c12',
  'belongs_to': '#9b59b6',
  'uses_technology': '#e67e22',
  'utilizes': '#1abc9c',
  'part_of': '#34495e',
  'collaborates_with': '#e74c3c',
  'unknown': '#95a5a6',
  'default': '#666666'
};

// 엣지 타입에 따른 색상 반환
export const getEdgeColorByType = (type, customTypes = []) => {
  // 커스텀 타입에서 찾기
  const customType = customTypes.find(t => t.id === type);
  if (customType && customType.color) {
    return customType.color;
  }
  
  // 기본 타입 색상 반환
  return EDGE_TYPE_COLORS[type] || EDGE_TYPE_COLORS.default;
};

// 엣지 데이터에 타입별 색상 적용
export const applyEdgeTypeColors = (edges, customTypes = []) => {
  console.log('🎨 applyEdgeTypeColors 호출됨:', {
    edgeCount: edges.length,
    customTypesCount: customTypes.length,
    customTypes: customTypes.map(t => ({ id: t.id, label: t.label, defaultEdgeLabel: t.defaultEdgeLabel }))
  });

  return edges.map(edge => {
    const edgeTypeInfo = customTypes.find(t => t.id === edge.type);
    const newColor = getEdgeColorByType(edge.type, customTypes);

    // 기존 라벨을 보존 - 커스텀 라벨이 있으면 유지, 없을 때만 기본값 사용
    // edge.label이 이미 존재하면 그대로 유지
    const newLabel = edge.label || (edgeTypeInfo
      ? (edgeTypeInfo.defaultEdgeLabel || edgeTypeInfo.label)
      : '');

    if (edgeTypeInfo && !edge.label) {
      console.log(`🔄 엣지 "${edge.id}" 기본 라벨 적용: type="${edge.type}", label="${newLabel}"`);
    }

    return {
      ...edge,
      color: newColor,
      label: newLabel,
      // 화살표 속성 명시적 설정 - 서버에서 불러온 데이터에 arrows가 없어서 화살표가 표시되지 않는 문제 해결
      arrows: edge.arrows || { to: { enabled: true, scaleFactor: 1 } }
    };
  });
};

// 색상 접근성 검사 (WCAG AA 기준: 4.5:1, AAA 기준: 7:1)
export const isColorAccessible = (backgroundColor, textColor, level = 'AA') => {
  const ratio = getContrastRatio(backgroundColor, textColor);
  return level === 'AAA' ? ratio >= 7 : ratio >= 4.5;
};