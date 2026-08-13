import dxWorkProcessSampleData from '../../../sample/dxworkprocesssample.json';

// JSON 파일에서 데이터 추출
// JSON 파일 구조가 { version, timestamp, settings, data: { nodes, edges }, nodes, edges } 형태
export const sampleGraphData = {
  nodes: dxWorkProcessSampleData.data?.nodes || dxWorkProcessSampleData.nodes || [],
  edges: dxWorkProcessSampleData.data?.edges || dxWorkProcessSampleData.edges || []
};

// 설정 정보도 export (있는 경우)
export const sampleSettings = dxWorkProcessSampleData.settings || null;

// 노드 타입별 기본 설정 (설정 파일에 있으면 그것을 사용, 없으면 기본값)
export const nodeTypeConfig = {
  person: {
    color: '#FF6B6B',
    size: 25,
    shape: 'dot'
  },
  company: {
    color: '#4ECDC4',
    size: 35,
    shape: 'square'
  },
  project: {
    color: '#45B7D1',
    size: 30,
    shape: 'triangle'
  },
  skill: {
    color: '#96CEB4',
    size: 20,
    shape: 'dot'
  },
  department: {
    color: '#FECA57',
    size: 30,
    shape: 'diamond'
  },
  technology: {
    color: '#FF9FF3',
    size: 25,
    shape: 'star'
  },
  division: {
    color: '#f50a0a',
    size: 30,
    shape: 'square'
  },
  performance: {
    color: '#10B981',
    size: 25,
    shape: 'triangle'
  }
};

// 엣지 타입별 기본 설정
export const edgeTypeConfig = {
  works_for: {
    color: '#666',
    width: 2,
    style: 'solid'
  },
  participates_in: {
    color: '#888',
    width: 2,
    style: 'solid'
  },
  has_skill: {
    color: '#aaa',
    width: 1.5,
    style: 'dashed'
  },
  belongs_to: {
    color: '#777',
    width: 2,
    style: 'solid'
  },
  uses_technology: {
    color: '#999',
    width: 1.5,
    style: 'dotted'
  },
  utilizes: {
    color: '#999',
    width: 2,
    style: 'solid'
  },
  part_of: {
    color: '#555',
    width: 3,
    style: 'solid'
  },
  collaborates_with: {
    color: '#444',
    width: 1,
    style: 'dashed'
  },
  contributes_to: {
    color: '#6366F1',
    width: 2,
    style: 'solid'
  }
};
