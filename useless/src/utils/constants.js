// 상수 정의

// 기본 색상 팔레트
export const COLOR_PALETTE = {
  primary: '#646cff',
  secondary: '#535bf2',
  success: '#4caf50',
  warning: '#ff9800',
  error: '#f44336',
  info: '#2196f3',
  light: '#f5f5f5',
  dark: '#212121',
  
  // 노드 타입별 색상
  nodeColors: {
    person: '#FF6B6B',
    company: '#4ECDC4',
    project: '#45B7D1',
    skill: '#96CEB4',
    department: '#FECA57',
    technology: '#FF9FF3',
    default: '#95A5A6'
  },
  
  // 엣지 타입별 색상
  edgeColors: {
    works_for: '#666666',
    participates_in: '#888888',
    has_skill: '#AAAAAA',
    belongs_to: '#777777',
    uses_technology: '#999999',
    utilizes: '#999999',
    part_of: '#555555',
    collaborates_with: '#444444',
    default: '#666666'
  }
};

// 노드 크기 설정
export const NODE_SIZES = {
  small: 15,
  medium: 25,
  large: 35,
  xlarge: 45,
  
  // 타입별 기본 크기
  typeDefaults: {
    person: 25,
    company: 35,
    project: 30,
    skill: 20,
    department: 30,
    technology: 25,
    default: 25
  }
};

// 엣지 두께 설정
export const EDGE_WIDTHS = {
  thin: 1,
  normal: 2,
  thick: 3,
  xthick: 4,
  
  // 타입별 기본 두께
  typeDefaults: {
    works_for: 2,
    participates_in: 2,
    has_skill: 1.5,
    belongs_to: 2,
    uses_technology: 1.5,
    utilizes: 2,
    part_of: 3,
    collaborates_with: 1,
    default: 2
  }
};

// 레이아웃 옵션
export const LAYOUT_OPTIONS = {
  forceDirected: {
    name: '힘 기반 레이아웃',
    value: 'force-directed',
    description: '노드 간의 물리적 힘을 기반으로 자동 배치'
  },
  circular: {
    name: '원형 레이아웃',
    value: 'circular',
    description: '노드를 원형으로 배치'
  },
  grid: {
    name: '그리드 레이아웃',
    value: 'grid',
    description: '노드를 격자 형태로 배치'
  }
};

// 애니메이션 설정
export const ANIMATION_CONFIG = {
  duration: {
    fast: 250,
    normal: 500,
    slow: 1000
  },
  
  easing: {
    linear: 'linear',
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out'
  }
};

// 그래프 물리 설정
export const PHYSICS_CONFIG = {
  forceAtlas2Based: {
    gravitationalConstant: -50,
    centralGravity: 0.01,
    springConstant: 0.08,
    springLength: 100,
    damping: 0.4,
    avoidOverlap: 0
  },
  
  hierarchicalRepulsion: {
    centralGravity: 0.0,
    springLength: 100,
    springConstant: 0.01,
    nodeDistance: 120,
    damping: 0.09
  }
};

// 검색 설정
export const SEARCH_CONFIG = {
  minQueryLength: 1,
  maxResults: 50,
  debounceDelay: 300,
  highlightDuration: 2000
};

// 파일 처리 설정
export const FILE_CONFIG = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: ['application/json'],
  allowedExtensions: ['.json']
};

// UI 설정
export const UI_CONFIG = {
  panelWidth: {
    desktop: 350,
    tablet: 300,
    mobile: '100%'
  },
  
  headerHeight: 60,
  toolbarHeight: 48,
  
  breakpoints: {
    mobile: 768,
    tablet: 1024,
    desktop: 1200
  },
  
  scrollbar: {
    width: 6,
    thumbColor: '#c1c1c1',
    trackColor: '#f1f1f1'
  }
};

// 메시지
export const MESSAGES = {
  success: {
    dataSaved: '데이터가 성공적으로 저장되었습니다.',
    dataImported: '데이터를 성공적으로 가져왔습니다.',
    dataExported: '데이터를 성공적으로 내보냈습니다.',
    nodeAdded: '노드가 추가되었습니다.',
    nodeDeleted: '노드가 삭제되었습니다.',
    edgeAdded: '관계가 추가되었습니다.',
    edgeDeleted: '관계가 삭제되었습니다.'
  },
  
  error: {
    invalidData: '유효하지 않은 데이터입니다.',
    fileReadError: '파일을 읽는 중 오류가 발생했습니다.',
    networkError: '네트워크 오류가 발생했습니다.',
    unknownError: '알 수 없는 오류가 발생했습니다.',
    duplicateId: '이미 존재하는 ID입니다.',
    invalidFormat: '잘못된 파일 형식입니다.'
  },
  
  warning: {
    unsavedChanges: '저장되지 않은 변경사항이 있습니다.',
    largeDataset: '데이터셋이 커서 성능에 영향을 줄 수 있습니다.',
    confirmDelete: '정말로 삭제하시겠습니까?'
  },
  
  info: {
    selectNode: '노드나 엣지를 선택하여 상세 정보를 확인하세요.',
    searchPlaceholder: '노드나 관계를 검색하세요...',
    doubleClickToAdd: '더블클릭하여 노드를 추가하세요.',
    clickToConnect: '연결할 노드를 클릭하세요.'
  }
};

// 기본 노드 템플릿
export const DEFAULT_NODE_TEMPLATE = {
  id: '',
  label: '새 노드',
  type: 'default',
  properties: {},
  color: COLOR_PALETTE.nodeColors.default,
  size: NODE_SIZES.typeDefaults.default
};

// 기본 엣지 템플릿
export const DEFAULT_EDGE_TEMPLATE = {
  id: '',
  from: '',
  to: '',
  label: '새 관계',
  type: 'default',
  properties: {},
  color: COLOR_PALETTE.edgeColors.default,
  width: EDGE_WIDTHS.typeDefaults.default
};

// 노드 타입 정보
export const NODE_TYPES = {
  person: {
    label: '사람',
    icon: '👤',
    color: COLOR_PALETTE.nodeColors.person,
    size: NODE_SIZES.typeDefaults.person
  },
  company: {
    label: '회사',
    icon: '🏢',
    color: COLOR_PALETTE.nodeColors.company,
    size: NODE_SIZES.typeDefaults.company
  },
  project: {
    label: '프로젝트',
    icon: '📋',
    color: COLOR_PALETTE.nodeColors.project,
    size: NODE_SIZES.typeDefaults.project
  },
  skill: {
    label: '기술',
    icon: '⚡',
    color: COLOR_PALETTE.nodeColors.skill,
    size: NODE_SIZES.typeDefaults.skill
  },
  department: {
    label: '부서',
    icon: '🏛️',
    color: COLOR_PALETTE.nodeColors.department,
    size: NODE_SIZES.typeDefaults.department
  },
  technology: {
    label: '기술',
    icon: '🔧',
    color: COLOR_PALETTE.nodeColors.technology,
    size: NODE_SIZES.typeDefaults.technology
  }
};

// 엣지 타입 정보
export const EDGE_TYPES = {
  works_for: {
    label: '근무',
    icon: '💼',
    color: COLOR_PALETTE.edgeColors.works_for,
    width: EDGE_WIDTHS.typeDefaults.works_for
  },
  participates_in: {
    label: '참여',
    icon: '🤝',
    color: COLOR_PALETTE.edgeColors.participates_in,
    width: EDGE_WIDTHS.typeDefaults.participates_in
  },
  has_skill: {
    label: '보유',
    icon: '🎯',
    color: COLOR_PALETTE.edgeColors.has_skill,
    width: EDGE_WIDTHS.typeDefaults.has_skill
  },
  belongs_to: {
    label: '소속',
    icon: '📁',
    color: COLOR_PALETTE.edgeColors.belongs_to,
    width: EDGE_WIDTHS.typeDefaults.belongs_to
  },
  uses_technology: {
    label: '사용',
    icon: '🛠️',
    color: COLOR_PALETTE.edgeColors.uses_technology,
    width: EDGE_WIDTHS.typeDefaults.uses_technology
  },
  utilizes: {
    label: '활용',
    icon: '⚙️',
    color: COLOR_PALETTE.edgeColors.utilizes,
    width: EDGE_WIDTHS.typeDefaults.utilizes
  },
  part_of: {
    label: '부분',
    icon: '🔗',
    color: COLOR_PALETTE.edgeColors.part_of,
    width: EDGE_WIDTHS.typeDefaults.part_of
  },
  collaborates_with: {
    label: '협업',
    icon: '👥',
    color: COLOR_PALETTE.edgeColors.collaborates_with,
    width: EDGE_WIDTHS.typeDefaults.collaborates_with
  }
};

// 키보드 단축키
export const KEYBOARD_SHORTCUTS = {
  search: 'Ctrl+F',
  save: 'Ctrl+S',
  export: 'Ctrl+E',
  import: 'Ctrl+I',
  delete: 'Delete',
  escape: 'Escape',
  fitToView: 'F',
  zoomIn: '+',
  zoomOut: '-'
};
