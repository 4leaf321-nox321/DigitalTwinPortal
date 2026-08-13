// 타입 삭제 후 동기화 테스트를 위한 스크립트

console.log('🧪 타입 삭제 후 동기화 테스트 시작');

// 테스트 시나리오:
// 1. 현재 상태 확인
// 2. person 타입 강제 삭제
// 3. 동기화 결과 확인

const runTypeDeleteTest = () => {
  console.log('=== 1단계: 현재 상태 확인 ===');
  
  // 현재 그래프 데이터 확인
  if (window.currentGraphData) {
    const personNodes = window.currentGraphData.nodes.filter(n => n.type === 'person');
    console.log(`현재 person 타입 노드 개수: ${personNodes.length}`);
    
    if (personNodes.length > 0) {
      console.log('person 타입 노드들:', personNodes.map(n => ({id: n.id, label: n.label})));
    }
  }
  
  // 현재 타입 설정 확인
  if (window.currentTypeSettings) {
    const hasPersonType = window.currentTypeSettings.nodeTypes.some(t => t.id === 'person');
    console.log(`타입 설정에 person 타입 존재: ${hasPersonType}`);
  }
  
  console.log('=== 2단계: person 타입 삭제 테스트 ===');
  
  // person 타입을 설정에서 제거
  window.typeDebug.forceRemoveType('person');
  
  // 잠시 대기 후 새로고침
  console.log('3초 후 페이지를 새로고침합니다...');
  setTimeout(() => {
    window.location.reload();
  }, 3000);
};

const checkAfterReload = () => {
  console.log('=== 3단계: 새로고침 후 결과 확인 ===');
  
  // 페이지 로드 완료 대기
  setTimeout(() => {
    if (window.currentGraphData) {
      const personNodes = window.currentGraphData.nodes.filter(n => n.type === 'person');
      const unknownNodes = window.currentGraphData.nodes.filter(n => n.type === 'unknown');
      
      console.log(`새로고침 후 person 타입 노드 개수: ${personNodes.length}`);
      console.log(`새로고침 후 unknown 타입 노드 개수: ${unknownNodes.length}`);
      
      if (personNodes.length === 0 && unknownNodes.length > 0) {
        console.log('✅ 테스트 성공: person 타입 노드들이 unknown으로 변경됨');
      } else {
        console.log('❌ 테스트 실패: 동기화가 제대로 작동하지 않음');
        console.log('현재 상태를 확인하세요:');
        window.typeDebug.checkAllStates();
      }
    }
  }, 2000);
};

// 페이지가 이미 로드된 경우 즉시 실행, 아니면 로드 대기
if (document.readyState === 'complete') {
  if (window.location.search.includes('test=after')) {
    checkAfterReload();
  } else {
    console.log('타입 삭제 테스트를 시작하려면:');
    console.log('runTypeDeleteTest()를 실행하세요.');
  }
} else {
  window.addEventListener('load', () => {
    if (window.location.search.includes('test=after')) {
      checkAfterReload();
    }
  });
}

// 전역 함수로 노출
window.runTypeDeleteTest = runTypeDeleteTest;
