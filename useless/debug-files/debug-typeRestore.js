// 데이터 복원 도구
window.restoreDataTypes = function() {
  console.log('🔧 데이터 타입 복원 시작...');
  
  // 현재 그래프 데이터 가져오기
  const currentData = window.currentRawGraphData || window.currentGraphData;
  if (!currentData) {
    console.error('❌ 현재 그래프 데이터를 찾을 수 없습니다.');
    return;
  }
  
  // 타입 복원 로직
  const restoredData = {
    ...currentData,
    nodes: currentData.nodes.map(node => {
      if (node.type === 'unknown' || !node.type) {
        // properties를 기반으로 타입 추정
        const inferredType = inferNodeType(node);
        if (inferredType !== 'unknown') {
          console.log(`🔎 노드 ${node.id} (${node.label}): ${node.type} → ${inferredType}`);
          return { ...node, type: inferredType };
        }
      }
      return node;
    })
  };
  
  // 복원된 데이터 적용
  if (window.forceUpdateGraphData) {
    window.forceUpdateGraphData(restoredData);
    console.log('✅ 데이터 타입 복원 완료!');
  } else {
    console.error('❌ forceUpdateGraphData 함수를 찾을 수 없습니다.');
  }
};

// 타입 추정 함수
function inferNodeType(node) {
  if (!node.properties || typeof node.properties !== 'object') {
    return 'unknown';
  }
  
  const props = Object.keys(node.properties).map(k => k.toLowerCase());
  const values = Object.values(node.properties).map(v => 
    typeof v === 'string' ? v.toLowerCase() : String(v).toLowerCase()
  );
  
  console.log(`분석 중인 노드 ${node.id}:`, { props, values });
  
  // 사람 타입 추정
  if (props.some(p => ['age', 'occupation', 'department', 'position', 'salary'].includes(p))) {
    return 'person';
  }
  
  // 회사 타입 추정
  if (props.some(p => ['industry', 'employees', 'founded', 'revenue'].includes(p))) {
    return 'company';
  }
  
  // 프로젝트 타입 추정  
  if (props.some(p => ['status', 'budget', 'startdate', 'enddate', 'priority'].includes(p))) {
    return 'project';
  }
  
  // 기술/스킬 타입 추정
  if (props.some(p => ['category', 'difficulty', 'popularity', 'level', 'experience'].includes(p))) {
    return 'skill';
  }
  
  // 부서 타입 추정
  if (props.some(p => ['headcount', 'manager'].includes(p)) || 
      values.some(v => v.includes('부') || v.includes('team') || v.includes('팀'))) {
    return 'department';
  }
  
  return 'unknown';
}

console.log('🛠️ 데이터 복원 도구가 로드되었습니다. window.restoreDataTypes()를 실행하세요.');