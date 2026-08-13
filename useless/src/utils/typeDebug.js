// 브라우저 개발자 도구에서 사용할 수 있는 타입 설정 디버깅 함수들
// main.jsx에서 import하여 사용

export const initTypeDebug = () => {
  window.typeDebug = {
    // 현재 localStorage 상태 확인
    checkStorage() {
      const settings = localStorage.getItem('knowledgeGraphTypeSettings');
      if (settings) {
        const parsed = JSON.parse(settings);
        console.log('=== 저장된 타입 설정 ===');
        console.log('노드 타입:', parsed.nodeTypes);
        console.log('엣지 타입:', parsed.edgeTypes);
        console.table(parsed.nodeTypes);
        console.table(parsed.edgeTypes);
        return parsed;
      } else {
        console.log('저장된 타입 설정이 없습니다.');
        return null;
      }
    },

    // localStorage 타입 설정 초기화
    clearSettings() {
      localStorage.removeItem('knowledgeGraphTypeSettings');
      console.log('타입 설정이 초기화되었습니다. 페이지를 새로고침하세요.');
    },

    // 현재 그래프 데이터의 타입 사용 현황 확인
    checkDataTypes() {
      if (window.currentGraphData) {
        const nodeTypes = {};
        const edgeTypes = {};

        window.currentGraphData.nodes.forEach(node => {
          nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
        });

        window.currentGraphData.edges.forEach(edge => {
          edgeTypes[edge.type] = (edgeTypes[edge.type] || 0) + 1;
        });

        console.log('=== 현재 그래프 데이터의 타입 사용 현황 ===');
        console.log('노드 타입별 개수:', nodeTypes);
        console.log('엣지 타입별 개수:', edgeTypes);

        return { nodeTypes, edgeTypes };
      } else {
        console.log('그래프 데이터에 접근할 수 없습니다.');
        return null;
      }
    },

    // 현재 상태 전체 확인
    checkAllStates() {
      console.log('=== 전체 상태 확인 ===');
      console.log('1. localStorage 설정:');
      this.checkStorage();
      console.log('\n2. 현재 그래프 데이터:');
      this.checkDataTypes();
      console.log('\n3. 현재 타입 설정 상태:');
      console.log(window.currentTypeSettings);
    },

    // person 타입을 모두 unknown으로 강제 변경
    forceConvertPersonToUnknown() {
      const settings = localStorage.getItem('knowledgeGraphTypeSettings');
      if (settings) {
        const parsed = JSON.parse(settings);
        
        // person 타입 제거
        parsed.nodeTypes = parsed.nodeTypes.filter(type => type.id !== 'person');
        
        // unknown 타입이 없으면 추가
        if (!parsed.nodeTypes.find(type => type.id === 'unknown')) {
          parsed.nodeTypes.push({ id: 'unknown', label: 'Unknown', color: '#cccccc' });
        }
        
        localStorage.setItem('knowledgeGraphTypeSettings', JSON.stringify(parsed));
        console.log('person 타입이 설정에서 제거되었습니다. 페이지를 새로고침하세요.');
      }
    },

    // 특정 타입 강제 제거
    forceRemoveType(typeId) {
      const settings = localStorage.getItem('knowledgeGraphTypeSettings');
      if (settings) {
        const parsed = JSON.parse(settings);
        
        // 노드 타입에서 제거
        const originalNodeCount = parsed.nodeTypes.length;
        parsed.nodeTypes = parsed.nodeTypes.filter(type => type.id !== typeId);
        
        // 엣지 타입에서 제거
        const originalEdgeCount = parsed.edgeTypes.length;
        parsed.edgeTypes = parsed.edgeTypes.filter(type => type.id !== typeId);
        
        localStorage.setItem('knowledgeGraphTypeSettings', JSON.stringify(parsed));
        
        console.log(`${typeId} 타입 제거 완료:`);
        console.log(`- 노드 타입: ${originalNodeCount} → ${parsed.nodeTypes.length}`);
        console.log(`- 엣지 타입: ${originalEdgeCount} → ${parsed.edgeTypes.length}`);
        console.log('페이지를 새로고침하세요.');
      }
    },

    // 강제 동기화 트리거
    forceSyncNow() {
      console.log('강제 동기화 실행...');
      if (window.currentGraphData && window.currentTypeSettings && window.forceUpdateGraphData) {
        console.log('현재 데이터:', window.currentGraphData);
        console.log('현재 설정:', window.currentTypeSettings);
        
        // 동기화 함수 실행
        const nodeTypes = window.currentTypeSettings.nodeTypes && window.currentTypeSettings.nodeTypes.length > 0 
          ? window.currentTypeSettings.nodeTypes 
          : [
            { id: 'person', label: 'Person', color: '#3498db' },
            { id: 'company', label: 'Company', color: '#e74c3c' },
            { id: 'project', label: 'Project', color: '#2ecc71' },
            { id: 'skill', label: 'Skill', color: '#f39c12' },
            { id: 'department', label: 'Department', color: '#9b59b6' },
            { id: 'technology', label: 'Technology', color: '#f39c12' },
            { id: 'team', label: 'Team', color: '#1abc9c' },
            { id: 'product', label: 'Product', color: '#34495e' },
            { id: 'service', label: 'Service', color: '#95a5a6' },
            { id: 'location', label: 'Location', color: '#e67e22' },
            { id: 'unknown', label: 'Unknown', color: '#cccccc' }
          ];
          
        const edgeTypes = window.currentTypeSettings.edgeTypes && window.currentTypeSettings.edgeTypes.length > 0 
          ? window.currentTypeSettings.edgeTypes 
          : [
            { id: 'works_for', label: 'Works For' },
            { id: 'participates_in', label: 'Participates In' },
            { id: 'has_skill', label: 'Has Skill' },
            { id: 'belongs_to', label: 'Belongs To' },
            { id: 'uses_technology', label: 'Uses Technology' },
            { id: 'utilizes', label: 'Utilizes' },
            { id: 'part_of', label: 'Part Of' },
            { id: 'collaborates_with', label: 'Collaborates With' },
            { id: 'unknown', label: 'Unknown' }
          ];

        const validNodeTypeIds = new Set(nodeTypes.map(t => t.id));
        const validEdgeTypeIds = new Set(edgeTypes.map(t => t.id));
        
        console.log('유효한 노드 타입들:', Array.from(validNodeTypeIds));
        
        let hasChanges = false;
        const updatedData = { ...window.currentGraphData };

        // 노드 타입 동기화
        updatedData.nodes = window.currentGraphData.nodes.map(node => {
          if (!validNodeTypeIds.has(node.type)) {
            console.log(`🔄 강제 동기화: 노드 ${node.id} (${node.label}): ${node.type} → unknown`);
            hasChanges = true;
            return {
              ...node,
              type: 'unknown',
              color: '#cccccc'
            };
          }
          return node;
        });

        // 엣지 타입 동기화
        updatedData.edges = window.currentGraphData.edges.map(edge => {
          if (!validEdgeTypeIds.has(edge.type)) {
            console.log(`🔄 강제 동기화: 엣지 ${edge.id}: ${edge.type} → unknown`);
            hasChanges = true;
            return {
              ...edge,
              type: 'unknown',
              label: edge.label || 'unknown'
            };
          }
          return edge;
        });

        if (hasChanges) {
          console.log('✅ 강제 동기화 - 변경사항 적용됨');
          
          // 색상을 다시 적용
          updatedData.nodes = updatedData.nodes.map(node => ({
            ...node,
            color: node.type === 'unknown' ? '#cccccc' : (
              node.type === 'person' ? '#4CAF50' :
              node.type === 'company' ? '#2196F3' :
              node.type === 'project' ? '#FF9800' :
              node.type === 'skill' ? '#9C27B0' :
              node.type === 'department' ? '#FF5722' :
              node.type === 'technology' ? '#607D8B' :
              node.type === 'team' ? '#795548' :
              node.type === 'product' ? '#E91E63' :
              node.type === 'service' ? '#00BCD4' :
              node.type === 'location' ? '#8BC34A' :
              node.color
            )
          }));
          
          // 강제 데이터 업데이트
          window.forceUpdateGraphData(updatedData);
          console.log('📊 강제 동기화 완료');
          
          // 2초 후 결과 확인
          setTimeout(() => {
            console.log('강제 동기화 결과 확인:');
            this.checkDataTypes();
          }, 2000);
        } else {
          console.log('✅ 강제 동기화 - 변경사항 없음');
        }
      } else {
        console.log('⚠️ 강제 동기화에 필요한 데이터가 없습니다.');
        console.log('window.currentGraphData:', !!window.currentGraphData);
        console.log('window.currentTypeSettings:', !!window.currentTypeSettings);
        console.log('window.forceUpdateGraphData:', !!window.forceUpdateGraphData);
        
        // 대안 방법: 페이지 새로고침
        console.log('🔄 대안 방법으로 페이지를 새로고침합니다...');
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    },

    // 페이지 새로고침
    refresh() {
      window.location.reload();
    },

    // 도움말
    help() {
      console.log('=== 타입 디버깅 도구 사용법 ===');
      console.log('window.typeDebug.checkStorage() - 저장된 설정 확인');
      console.log('window.typeDebug.checkDataTypes() - 현재 데이터 타입 확인');
      console.log('window.typeDebug.checkAllStates() - 전체 상태 확인');
      console.log('window.typeDebug.clearSettings() - 설정 초기화');
      console.log('window.typeDebug.forceRemoveType("person") - 특정 타입 강제 제거');
      console.log('window.typeDebug.forceSyncNow() - 강제 동기화');
      console.log('window.typeDebug.refresh() - 페이지 새로고침');
      console.log('window.typeDebug.help() - 이 도움말');
    }
  };

  console.log('🛠️ 타입 디버깅 도구가 로드되었습니다.');
  console.log('💡 window.typeDebug.help() 를 입력하여 사용법을 확인하세요.');
};