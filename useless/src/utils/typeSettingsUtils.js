// localStorage 타입 설정 관리 유틸리티

export const clearTypeSettings = () => {
  localStorage.removeItem('knowledgeGraphTypeSettings');
  console.log('타입 설정 초기화됨');
};

export const getTypeSettings = () => {
  const saved = localStorage.getItem('knowledgeGraphTypeSettings');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (error) {
      console.error('타입 설정 파싱 오류:', error);
      return null;
    }
  }
  return null;
};

export const setTypeSettings = (settings) => {
  localStorage.setItem('knowledgeGraphTypeSettings', JSON.stringify(settings));
  console.log('타입 설정 저장됨:', settings);
};

export const validateTypeSettings = (settings, graphData) => {
  if (!settings || !settings.nodeTypes || !settings.edgeTypes) {
    return false;
  }

  const nodeTypeIds = new Set(settings.nodeTypes.map(t => t.id));
  const edgeTypeIds = new Set(settings.edgeTypes.map(t => t.id));

  // 그래프 데이터에서 사용된 타입들 확인
  const usedNodeTypes = new Set(graphData.nodes.map(n => n.type));
  const usedEdgeTypes = new Set(graphData.edges.map(e => e.type));

  console.log('타입 설정 유효성 검사:');
  console.log('- 설정된 노드 타입:', Array.from(nodeTypeIds));
  console.log('- 사용된 노드 타입:', Array.from(usedNodeTypes));
  console.log('- 설정된 엣지 타입:', Array.from(edgeTypeIds));
  console.log('- 사용된 엣지 타입:', Array.from(usedEdgeTypes));

  // 사용된 타입 중 설정에 없는 것들 찾기
  const missingNodeTypes = Array.from(usedNodeTypes).filter(type => !nodeTypeIds.has(type));
  const missingEdgeTypes = Array.from(usedEdgeTypes).filter(type => !edgeTypeIds.has(type));

  if (missingNodeTypes.length > 0) {
    console.log('설정에 없는 노드 타입들:', missingNodeTypes);
  }
  if (missingEdgeTypes.length > 0) {
    console.log('설정에 없는 엣지 타입들:', missingEdgeTypes);
  }

  return {
    isValid: missingNodeTypes.length === 0 && missingEdgeTypes.length === 0,
    missingNodeTypes,
    missingEdgeTypes
  };
};

// 디버깅용 함수들
export const debugTypeSettings = () => {
  const settings = getTypeSettings();
  console.log('=== 현재 타입 설정 디버그 정보 ===');
  
  if (settings) {
    console.log('저장된 설정:', settings);
    console.log('노드 타입 개수:', settings.nodeTypes ? settings.nodeTypes.length : 0);
    console.log('엣지 타입 개수:', settings.edgeTypes ? settings.edgeTypes.length : 0);
    
    if (settings.nodeTypes) {
      console.log('노드 타입 목록:', settings.nodeTypes.map(t => t.id));
    }
    if (settings.edgeTypes) {
      console.log('엣지 타입 목록:', settings.edgeTypes.map(t => t.id));
    }
  } else {
    console.log('저장된 타입 설정이 없습니다.');
  }
};

// 타입 설정 강제 동기화 함수
export const forceSync = () => {
  console.log('타입 설정 강제 동기화 실행...');
  
  // 현재 페이지 새로고침하여 동기화 강제 실행
  window.location.reload();
};