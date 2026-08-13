// 데이터 불러오기 문제 해결 도구
window.debugDataImport = function() {
  console.log('🔍 데이터 불러오기 디버깅 시작...');
  
  console.log('=== 현재 상태 ===');
  console.log('App 그래프 데이터:', window.currentRawGraphData);
  console.log('Hook 그래프 데이터:', window.currentGraphData);
  console.log('처리된 데이터:', window.currentProcessedData);
  console.log('타입 설정:', window.currentTypeSettings);
  
  // 데이터가 있는지 확인
  if (!window.currentRawGraphData || !window.currentRawGraphData.nodes) {
    console.error('❌ App 그래프 데이터가 없습니다!');
    return;
  }
  
  if (!window.currentGraphData || !window.currentGraphData.nodes) {
    console.error('❌ Hook 그래프 데이터가 없습니다!');
    
    // 강제로 훅 데이터 동기화
    if (window.setGraphData && window.currentRawGraphData) {
      console.log('🔄 훅 데이터 강제 동기화 시도...');
      window.setGraphData(window.currentRawGraphData);
      setTimeout(() => {
        console.log('✅ 훅 데이터 동기화 완료');
        console.log('새로운 Hook 데이터:', window.currentGraphData);
      }, 100);
    }
    return;
  }
  
  console.log('✅ 모든 데이터가 정상적으로 존재합니다.');
  
  // 노드 개수 비교
  const appNodes = window.currentRawGraphData.nodes.length;
  const hookNodes = window.currentGraphData.nodes.length;
  const processedNodes = window.currentProcessedData.nodes.length;
  
  console.log('📊 노드 개수 비교:', {
    app: appNodes,
    hook: hookNodes,
    processed: processedNodes
  });
  
  if (appNodes !== hookNodes) {
    console.warn('⚠️ App과 Hook의 노드 개수가 다릅니다!');
  }
};

// 강제 리프레시 함수
window.forceRefreshGraph = function() {
  console.log('🔄 그래프 강제 리프레시...');
  
  if (window.currentRawGraphData && window.setGraphData) {
    // 데이터를 다시 설정
    const data = { ...window.currentRawGraphData };
    window.setGraphData(data);
    
    setTimeout(() => {
      console.log('✅ 그래프 리프레시 완료');
      window.debugDataImport();
    }, 100);
  } else {
    console.error('❌ 필요한 함수나 데이터가 없습니다.');
  }
};

console.log('🛠️ 디버깅 도구 로드 완료!');
console.log('사용법:');
console.log('- window.debugDataImport() : 현재 상태 확인');
console.log('- window.forceRefreshGraph() : 강제 리프레시');