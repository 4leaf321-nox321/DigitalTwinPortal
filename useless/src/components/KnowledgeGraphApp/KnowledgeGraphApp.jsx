import React, { useState, useEffect } from 'react';
import Layout from '../Layout/Layout';
import KnowledgeGraph from '../KnowledgeGraph/KnowledgeGraph';
import DataPanel from '../DataPanel/DataPanel';
import { useGraphData } from '../../hooks/useGraphData';
import { useGraphInteraction } from '../../hooks/useGraphInteraction';
import { sampleGraphData } from '../../data/sampleData';
import { applyNodeTypeColors, applyEdgeTypeColors } from '../../utils/colorUtils';
import { useModal, ModalProvider } from '../Modal';
import '../../App.css';

function KnowledgeGraphApp() {
  // 타입 설정을 먼저 로드하기 위한 상태
  const [isInitialized, setIsInitialized] = useState(false);
  const [typeSettings, setTypeSettings] = useState({
    nodeTypes: [],
    edgeTypes: []
  });

  // 커스텀 모달 훅
  const {
    modals,
    closeAlert,
    closeConfirm,
    showSuccess,
    showError,
    showInfo,
    askWarningConfirm
  } = useModal();

  // 기본 타입 정의
  const getDefaultNodeTypes = () => [
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

  const getDefaultEdgeTypes = () => [
    { id: 'works_for', label: '근무' },
    { id: 'participates_in', label: '참여' },
    { id: 'has_skill', label: '보유' },
    { id: 'belongs_to', label: '소속' },
    { id: 'uses_technology', label: '사용' },
    { id: 'utilizes', label: '활용' },
    { id: 'part_of', label: '부분' },
    { id: 'collaborates_with', label: '협업' },
    { id: 'unknown', label: '알 수 없음' }
  ];

  // 초기화가 완료된 후에만 그래프 데이터 상태 생성
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [layoutType, setLayoutType] = useState('force-directed');
  const [filterOptions, setFilterOptions] = useState({
    nodeTypes: [],
    edgeTypes: [],
    minConnections: 0
  });

  // 컴포넌트 마운트 시 타입 설정을 먼저 로드
  useEffect(() => {
    console.log('🚀 앱 초기화 시작 - 빈 데이터로 시작');
    
    // 기본 타입 설정 생성
    const defaultTypeSettings = {
      nodeTypes: getDefaultNodeTypes(),
      edgeTypes: getDefaultEdgeTypes()
    };
    
    let finalTypeSettings = defaultTypeSettings;
    
    const savedTypeSettings = localStorage.getItem('knowledgeGraphTypeSettings');
    if (savedTypeSettings) {
      try {
        const parsedSettings = JSON.parse(savedTypeSettings);
        console.log('📁 로드된 타입 설정:', parsedSettings);
        
        // 저장된 설정이 완전하면 사용, 아니면 기본 설정 사용
        if (parsedSettings.nodeTypes && parsedSettings.nodeTypes.length > 0 &&
            parsedSettings.edgeTypes && parsedSettings.edgeTypes.length > 0) {
          finalTypeSettings = parsedSettings;
        }
      } catch (error) {
        console.error('❌ 타입 설정 로드 중 오류:', error);
      }
    } else {
      console.log('📁 저장된 타입 설정 없음 - 기본 설정 사용');
    }
    
    // 타입 설정 적용
    setTypeSettings(finalTypeSettings);
    
    // 빈 데이터로 시작
    setGraphData({ nodes: [], edges: [] });
    setIsInitialized(true);
    
    console.log('✅ 앱 초기화 완료 (빈 데이터)');
  }, []);

  const { 
    graphData: hookGraphData,
    processedData, 
    updateGraphData, 
    addNode, 
    addEdge, 
    removeNode, 
    removeMultipleNodes,
    removeEdge,
    setData
  } = useGraphData(graphData, filterOptions);

  const {
    highlightedNodes,
    highlightedEdges,
    handleNodeClick,
    handleEdgeClick,
    handleSearch,
    clearSelection
  } = useGraphInteraction({
    graphData: processedData,
    searchQuery,
    onNodeSelect: setSelectedNode,
    onEdgeSelect: setSelectedEdge
  });

  // **핵심: 타입 설정 변경 처리 함수 추가**
  const handleTypeSettingsChange = ({ nodeTypes, edgeTypes, deletedNodeTypes, deletedEdgeTypes }) => {
    console.log('🔧 타입 설정 변경 처리 시작:', { 
      deletedNodeTypes, 
      deletedEdgeTypes,
      currentNodes: graphData.nodes.length,
      currentEdges: graphData.edges.length
    });
    
    // 타입 설정 업데이트
    const newTypeSettings = { nodeTypes, edgeTypes };
    setTypeSettings(newTypeSettings);
    
    // localStorage에 저장
    localStorage.setItem('knowledgeGraphTypeSettings', JSON.stringify(newTypeSettings));
    
    // 삭제된 타입을 가진 노드/엣지들을 "unknown"으로 변경
    let updatedNodes = [...graphData.nodes];
    let updatedEdges = [...graphData.edges];
    let hasChanges = false;
    
    // 삭제된 노드 타입들을 "unknown"으로 변경
    if (deletedNodeTypes && deletedNodeTypes.length > 0) {
      console.log('🔄 삭제된 노드 타입 처리:', deletedNodeTypes);
      updatedNodes = updatedNodes.map(node => {
        if (deletedNodeTypes.includes(node.type)) {
          console.log(`📝 노드 ${node.id}의 타입을 ${node.type} → unknown으로 변경`);
          hasChanges = true;
          return {
            ...node,
            type: 'unknown',
            // unknown 타입의 색상 적용
            color: '#cccccc',
            font: { color: '#333333' }
          };
        }
        return node;
      });
    }
    
    // 삭제된 엣지 타입들을 "unknown"으로 변경
    if (deletedEdgeTypes && deletedEdgeTypes.length > 0) {
      console.log('🔄 삭제된 엣지 타입 처리:', deletedEdgeTypes);
      updatedEdges = updatedEdges.map(edge => {
        if (deletedEdgeTypes.includes(edge.type)) {
          console.log(`📝 엣지 ${edge.id}의 타입을 ${edge.type} → unknown으로 변경`);
          hasChanges = true;
          return {
            ...edge,
            type: 'unknown',
            label: '알 수 없음',
            // unknown 타입의 색상 적용
            color: '#cccccc'
          };
        }
        return edge;
      });
    }
    
    // 변경사항이 있으면 그래프 데이터 업데이트
    if (hasChanges) {
      console.log('✅ 그래프 데이터 업데이트:', {
        nodesUpdated: updatedNodes.length,
        edgesUpdated: updatedEdges.length
      });
      
      const newGraphData = { 
        nodes: updatedNodes, 
        edges: updatedEdges 
      };
      
      setGraphData(newGraphData);
      
      // 성공 메시지 표시
      if (showSuccess) {
        const deletedCount = (deletedNodeTypes?.length || 0) + (deletedEdgeTypes?.length || 0);
        showSuccess(
          `타입 설정이 저장되었습니다.\n삭제된 ${deletedCount}개 타입의 데이터가 "unknown"으로 변경되었습니다.`,
          '타입 설정 저장 완료'
        );
      }
    } else {
      console.log('✅ 타입 설정만 업데이트 (데이터 변경 없음)');
      
      if (showSuccess) {
        showSuccess('타입 설정이 저장되었습니다.', '타입 설정 저장 완료');
      }
    }
  };

  // 샘플 데이터 로드 함수
  const handleLoadSampleData = () => {
    console.log('📊 샘플 데이터 로드 시작');
    
    // 샘플 데이터에 색상 적용
    const coloredData = {
      nodes: applyNodeTypeColors(sampleGraphData.nodes, typeSettings.nodeTypes),
      edges: applyEdgeTypeColors(sampleGraphData.edges, typeSettings.edgeTypes)
    };
    
    setGraphData(coloredData);
    console.log('✅ 샘플 데이터 로드 완료');
  };

  // 데이터 가져오기 처리 함수
  const handleDataImport = (data) => {
    console.log('📁 데이터 가져오기 처리 시작:', data);
    
    try {
      let importedData;
      let importedTypeSettings;
      
      // 새로운 형식 (v1.0+) 처리
      if (data.version && data.data && data.settings) {
        console.log('📁 새로운 형식 데이터 가져오기 (v' + data.version + ')');
        importedData = data.data;
        importedTypeSettings = data.settings;
      }
      // 기존 형식 처리  
      else if (data.nodes && data.edges) {
        console.log('📁 기존 형식 데이터 가져오기');
        importedData = { nodes: data.nodes, edges: data.edges };
        importedTypeSettings = null; // 기존 형식에는 설정 정보 없음
      }
      else {
        throw new Error('지원되지 않는 데이터 형식입니다.');
      }
      
      // 타입 설정이 있으면 업데이트
      if (importedTypeSettings && importedTypeSettings.nodeTypes && importedTypeSettings.edgeTypes) {
        console.log('🔧 가져온 타입 설정 적용');
        setTypeSettings(importedTypeSettings);
        localStorage.setItem('knowledgeGraphTypeSettings', JSON.stringify(importedTypeSettings));
      }
      
      // 데이터에 색상 적용 (현재 또는 가져온 타입 설정 사용)
      const effectiveTypeSettings = importedTypeSettings || typeSettings;
      const coloredData = {
        nodes: applyNodeTypeColors(importedData.nodes, effectiveTypeSettings.nodeTypes),
        edges: applyEdgeTypeColors(importedData.edges, effectiveTypeSettings.edgeTypes)
      };
      
      setGraphData(coloredData);
      
      if (showSuccess) {
        showSuccess(
          `데이터를 성공적으로 가져왔습니다.\n노드: ${importedData.nodes.length}개\n엣지: ${importedData.edges.length}개`,
          '데이터 가져오기 완료'
        );
      }
      
      console.log('✅ 데이터 가져오기 완료');
    } catch (error) {
      console.error('❌ 데이터 가져오기 오류:', error);
      if (showError) {
        showError('데이터 가져오기 중 오류가 발생했습니다: ' + error.message);
      }
    }
  };

  const handleDataExport = async () => {
    const exportData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      settings: {
        nodeTypes: typeSettings.nodeTypes || getDefaultNodeTypes(),
        edgeTypes: typeSettings.edgeTypes || getDefaultEdgeTypes()
      },
      data: {
        nodes: graphData.nodes || [],
        edges: graphData.edges || []
      }
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    
    const timestamp = new Date().toISOString().split('T')[0];
    link.download = `knowledge-graph-${timestamp}.json`;
    
    link.click();
    URL.revokeObjectURL(url);
  };

  // 초기화가 완료되지 않았으면 로딩 표시
  if (!isInitialized) {
    return (
      <div className="app loading">
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          fontSize: '18px',
          color: '#666'
        }}>
          🔄 그래프 데이터 초기화 중...
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <Layout
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        layoutType={layoutType}
        onLayoutChange={setLayoutType}
        onDataImport={handleDataImport}
        onDataExport={handleDataExport}
        onLoadSampleData={handleLoadSampleData}
        filterOptions={filterOptions}
        onFilterChange={setFilterOptions}
        onTypeSettingsChange={handleTypeSettingsChange}
        currentGraphData={graphData}
        typeSettings={typeSettings}
        showError={showError}
        askWarningConfirm={askWarningConfirm}
      >
        <div className="app-content">
          <div className="graph-container">
            <KnowledgeGraph
              data={processedData}
              selectedNode={selectedNode}
              selectedEdge={selectedEdge}
              highlightedNodes={highlightedNodes}
              highlightedEdges={highlightedEdges}
              layoutType={layoutType}
              onNodeClick={handleNodeClick}
              onEdgeClick={handleEdgeClick}
              onNodeAdd={addNode}
              onEdgeAdd={addEdge}
              nodeTypes={typeSettings.nodeTypes}
              edgeTypes={typeSettings.edgeTypes}
            />
          </div>
          
          <div className="panel-container">
            <DataPanel
              selectedNode={selectedNode}
              selectedEdge={selectedEdge}
              graphData={processedData}
              nodeTypes={typeSettings.nodeTypes}
              edgeTypes={typeSettings.edgeTypes}
            />
          </div>
        </div>
      </Layout>

      <ModalProvider
        modals={modals}
        onCloseAlert={closeAlert}
        onCloseConfirm={closeConfirm}
      />
    </div>
  );
}

export default KnowledgeGraphApp;