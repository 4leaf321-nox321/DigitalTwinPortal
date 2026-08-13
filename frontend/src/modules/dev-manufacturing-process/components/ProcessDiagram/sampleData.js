// 샘플 프로세스 데이터 - 제품 개발 프로세스
export const sampleNodes = [
  // ========== 상단 화살표 (단계 표시) ==========
  {
    id: 'arrow-planning',
    type: 'arrow',
    position: { x: 50, y: 20 },
    data: {
      label: '기획',
      color: '#3b82f6',
      isFirst: true
    }
  },
  {
    id: 'arrow-design',
    type: 'arrow',
    position: { x: 190, y: 20 },
    data: {
      label: '설계',
      color: '#8b5cf6'
    }
  },
  {
    id: 'arrow-verification',
    type: 'arrow',
    position: { x: 330, y: 20 },
    data: {
      label: '검증',
      color: '#f59e0b'
    }
  },
  {
    id: 'arrow-preparation',
    type: 'arrow',
    position: { x: 470, y: 20 },
    data: {
      label: '양산준비',
      color: '#ef4444'
    }
  },
  {
    id: 'arrow-production',
    type: 'arrow',
    position: { x: 610, y: 20 },
    data: {
      label: '양산',
      color: '#10b981'
    }
  },

  // ========== 세로 구분선 ==========
  {
    id: 'divider-1',
    type: 'divider',
    position: { x: 250, y: 100 },
    data: {
      direction: 'vertical',
      label: ''
    },
    style: { width: 20, height: 500 }
  },
  {
    id: 'divider-2',
    type: 'divider',
    position: { x: 500, y: 100 },
    data: {
      direction: 'vertical',
      label: ''
    },
    style: { width: 20, height: 500 }
  },
  {
    id: 'divider-3',
    type: 'divider',
    position: { x: 750, y: 100 },
    data: {
      direction: 'vertical',
      label: ''
    },
    style: { width: 20, height: 500 }
  },

  // ========== 기획 그룹 ==========
  {
    id: 'group-planning',
    type: 'group',
    position: { x: 30, y: 100 },
    data: {
      label: '요구사항 정의',
      color: '#3b82f6',
      description: ''
    },
    style: { width: 200, height: 250 }
  },
  {
    id: 'p1',
    type: 'process',
    position: { x: 20, y: 50 },
    parentNode: 'group-planning',
    extent: 'parent',
    data: {
      label: '시장 조사',
      description: '시장 동향 및 경쟁사 분석',
      color: '#3b82f6',
      attributes: [
        { name: '담당', value: '기획팀' }
      ]
    }
  },
  {
    id: 'p2',
    type: 'process',
    position: { x: 20, y: 150 },
    parentNode: 'group-planning',
    extent: 'parent',
    data: {
      label: '요구사항 수집',
      description: '고객 요구사항 분석 및 정의',
      color: '#3b82f6',
      attributes: [
        { name: '담당', value: '기획팀' }
      ]
    }
  },

  // ========== 설계 그룹 ==========
  {
    id: 'group-design',
    type: 'group',
    position: { x: 280, y: 100 },
    data: {
      label: '제품 설계',
      color: '#8b5cf6',
      description: ''
    },
    style: { width: 200, height: 350 }
  },
  {
    id: 'p3',
    type: 'process',
    position: { x: 20, y: 50 },
    parentNode: 'group-design',
    extent: 'parent',
    data: {
      label: '개념 설계',
      description: '제품 구조 및 기능 정의',
      color: '#8b5cf6',
      attributes: [
        { name: '담당', value: '설계팀' }
      ]
    }
  },
  {
    id: 'p4',
    type: 'process',
    position: { x: 20, y: 150 },
    parentNode: 'group-design',
    extent: 'parent',
    data: {
      label: '상세 설계',
      description: 'CAD 모델링 및 도면 작성',
      color: '#8b5cf6',
      attributes: [
        { name: '담당', value: '설계팀' },
        { name: '도구', value: 'CAD' }
      ]
    }
  },
  {
    id: 'p5',
    type: 'process',
    position: { x: 20, y: 250 },
    parentNode: 'group-design',
    extent: 'parent',
    data: {
      label: '설계 검토',
      description: 'DR(Design Review) 수행',
      color: '#8b5cf6',
      attributes: [
        { name: '담당', value: '품질팀' }
      ]
    }
  },

  // ========== 검증/양산준비 그룹 ==========
  {
    id: 'group-verification',
    type: 'group',
    position: { x: 530, y: 100 },
    data: {
      label: '시제품 검증',
      color: '#f59e0b',
      description: ''
    },
    style: { width: 200, height: 250 }
  },
  {
    id: 'p6',
    type: 'process',
    position: { x: 20, y: 50 },
    parentNode: 'group-verification',
    extent: 'parent',
    data: {
      label: '시제품 제작',
      description: '프로토타입 제작',
      color: '#f59e0b',
      attributes: [
        { name: '담당', value: '시작팀' }
      ]
    }
  },
  {
    id: 'p7',
    type: 'process',
    position: { x: 20, y: 150 },
    parentNode: 'group-verification',
    extent: 'parent',
    data: {
      label: '품질 시험',
      description: '기능/신뢰성 검증',
      color: '#f59e0b',
      attributes: [
        { name: '담당', value: '품질팀' }
      ]
    }
  },

  // ========== 양산준비 노드 ==========
  {
    id: 'p8',
    type: 'process',
    position: { x: 530, y: 380 },
    data: {
      label: '금형 제작',
      description: '양산용 금형 제작',
      color: '#ef4444',
      attributes: [
        { name: '담당', value: '생산기술팀' }
      ]
    }
  },
  {
    id: 'p9',
    type: 'process',
    position: { x: 530, y: 480 },
    data: {
      label: '공정 설계',
      description: '생산 라인 구축',
      color: '#ef4444',
      attributes: [
        { name: '담당', value: '생산기술팀' }
      ]
    }
  },

  // ========== 양산 그룹 ==========
  {
    id: 'group-production',
    type: 'group',
    position: { x: 780, y: 100 },
    data: {
      label: '대량 생산',
      color: '#10b981',
      description: ''
    },
    style: { width: 200, height: 250 }
  },
  {
    id: 'p10',
    type: 'process',
    position: { x: 20, y: 50 },
    parentNode: 'group-production',
    extent: 'parent',
    data: {
      label: '초도 생산',
      description: '초도품 생산 및 검증',
      color: '#10b981',
      attributes: [
        { name: '담당', value: '생산팀' }
      ]
    }
  },
  {
    id: 'p11',
    type: 'process',
    position: { x: 20, y: 150 },
    parentNode: 'group-production',
    extent: 'parent',
    data: {
      label: '양산',
      description: '대량 생산 수행',
      color: '#10b981',
      attributes: [
        { name: '담당', value: '생산팀' },
        { name: '시스템', value: 'MES' }
      ]
    }
  },

  // ========== 가로 구분선 ==========
  {
    id: 'divider-h1',
    type: 'divider',
    position: { x: 530, y: 360 },
    data: {
      direction: 'horizontal',
      label: ''
    },
    style: { width: 200, height: 20 }
  }
];

export const sampleEdges = [
  // 기획 단계 흐름
  { id: 'e-p1-p2', source: 'p1', target: 'p2', type: 'smoothstep' },

  // 기획 → 설계
  { id: 'e-p2-p3', source: 'p2', target: 'p3', type: 'smoothstep', sourceHandle: 'right', targetHandle: 'left' },

  // 설계 단계 흐름
  { id: 'e-p3-p4', source: 'p3', target: 'p4', type: 'smoothstep' },
  { id: 'e-p4-p5', source: 'p4', target: 'p5', type: 'smoothstep' },

  // 설계 → 검증
  { id: 'e-p5-p6', source: 'p5', target: 'p6', type: 'smoothstep', sourceHandle: 'right', targetHandle: 'left' },

  // 검증 단계 흐름
  { id: 'e-p6-p7', source: 'p6', target: 'p7', type: 'smoothstep' },

  // 검증 → 양산준비
  { id: 'e-p7-p8', source: 'p7', target: 'p8', type: 'smoothstep' },
  { id: 'e-p8-p9', source: 'p8', target: 'p9', type: 'smoothstep' },

  // 양산준비 → 양산
  { id: 'e-p9-p10', source: 'p9', target: 'p10', type: 'smoothstep', sourceHandle: 'right', targetHandle: 'left' },

  // 양산 단계 흐름
  { id: 'e-p10-p11', source: 'p10', target: 'p11', type: 'smoothstep' }
];
