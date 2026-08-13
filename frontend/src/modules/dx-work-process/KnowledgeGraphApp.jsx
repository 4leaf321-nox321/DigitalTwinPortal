import React, { useState, useEffect, useCallback } from 'react';
import Layout from './components/Layout/Layout';
import KnowledgeGraph from './components/KnowledgeGraph/KnowledgeGraph';
import DataPanel from './components/DataPanel/DataPanel';
import { useGraphData } from './hooks/useGraphData';
import { useGraphInteraction } from './hooks/useGraphInteraction';
import { sampleGraphData, sampleSettings } from './data/sampleData';
import { applyNodeTypeColors, applyEdgeTypeColors } from './utils/colorUtils.js';
import { useModal } from '../../shared/hooks/useModal';
import ModalProvider from '../../shared/components/Modal/ModalProvider';
import '../../App.css';
import { todayLocalYmd } from '../../shared/utils/localDate';

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
    { id: 'works_for', label: '근무', color: '#3498db' },
    { id: 'participates_in', label: '참여', color: '#2ecc71' },
    { id: 'has_skill', label: '보유', color: '#f39c12' },
    { id: 'belongs_to', label: '소속', color: '#9b59b6' },
    { id: 'uses_technology', label: '사용', color: '#e74c3c' },
    { id: 'utilizes', label: '활용', color: '#1abc9c' },
    { id: 'part_of', label: '부분', color: '#e67e22' },
    { id: 'collaborates_with', label: '협업', color: '#34495e' },
    { id: 'unknown', label: '알 수 없음', color: '#95a5a6' }
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

  // localStorage에서 타입 설정 변경 감지
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'knowledgeGraphTypeSettings') {
        console.log('🔄 타입 설정 변경 감지:', e.newValue);
        try {
          if (e.newValue) {
            const newSettings = JSON.parse(e.newValue);
            if (newSettings.nodeTypes && newSettings.edgeTypes) {
              console.log('⚙️ 새로운 타입 설정 적용:', newSettings);
              setTypeSettings(newSettings);
              
              // 기존 그래프 데이터에 새로운 색상 적용
              if (graphData.nodes.length > 0 || graphData.edges.length > 0) {
                const updatedData = {
                  nodes: applyNodeTypeColors(graphData.nodes, newSettings.nodeTypes),
                  edges: applyEdgeTypeColors(graphData.edges, newSettings.edgeTypes)
                };
                console.log('🎨 그래프 데이터에 새로운 색상 적용');
                setGraphData(updatedData);
                if (setData) {
                  setData(updatedData);
                }
              }
            }
          }
        } catch (error) {
          console.error('❌ 타입 설정 변경 처리 중 오류:', error);
        }
      }
    };

    // localStorage 이벤트 리스너 등록
    window.addEventListener('storage', handleStorageChange);
    
    // 같은 탭에서의 변경을 감지하기 위한 커스텀 이벤트 리스너
    const handleCustomStorageChange = (e) => {
      handleStorageChange(e.detail);
    };
    window.addEventListener('localStorageChange', handleCustomStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('localStorageChange', handleCustomStorageChange);
    };
  }, [graphData, setData]);

  useEffect(() => {
    if (import.meta.env.DEV) {
      window.currentGraphData = hookGraphData;
      window.currentRawGraphData = graphData;
      window.currentProcessedData = processedData;
      window.currentTypeSettings = typeSettings;
      window.setGraphData = setData;
      window.setAppGraphData = setGraphData;
      
      window.forceUpdateGraphData = (newData) => {
        console.log('🔄 강제 데이터 업데이트:', newData);
        setGraphData(newData);
        setData(newData);
      };
    }
  }, [hookGraphData, graphData, processedData, typeSettings, setData]);

  useEffect(() => {
    handleSearch(searchQuery);
  }, [searchQuery, handleSearch]);

  const handleLayoutChange = (newLayout) => {
    setLayoutType(newLayout);
  };

  const handleFilterChange = (newFilters) => {
    setFilterOptions(newFilters);
  };

  // 새로운 데이터 import 핸들러 (JSON, CSV 통합)
  const handleDataImport = async (importedData, type, filename) => {
    console.log(`📁 ${type.toUpperCase()} 데이터 불러오기 시작:`, importedData);
    
    let actualData = null;
    let importedSettings = null;
    
    if (type === 'json') {
      // 새로운 형식 (version 있는 경우)
      if (importedData.version && importedData.data && importedData.settings) {
        console.log('🆕 새로운 형식 감지 (v' + importedData.version + ')');
        actualData = importedData.data;
        importedSettings = importedData.settings;
      }
      // 기존 형식 (nodes, edges 직접 있는 경우)
      else if (importedData.nodes && importedData.edges) {
        console.log('📄 기존 형식 감지');
        actualData = {
          nodes: importedData.nodes,
          edges: importedData.edges
        };
        importedSettings = null;
      }
      else {
        throw new Error('지원하지 않는 JSON 데이터 형식입니다.');
      }
    } else if (type === 'csv') {
      // CSV 데이터는 이미 변환된 상태
      actualData = importedData;
      importedSettings = null;
    } else {
      throw new Error('지원하지 않는 파일 형식입니다.');
    }
    
    // 설정이 포함되어 있으면 먼저 적용
    if (importedSettings) {
      console.log('⚙️ 타입 설정 복원:', {
        nodeTypes: importedSettings.nodeTypes?.length || 0,
        edgeTypes: importedSettings.edgeTypes?.length || 0
      });
      
      setTypeSettings(importedSettings);
      localStorage.setItem('knowledgeGraphTypeSettings', JSON.stringify(importedSettings));
      
      setTimeout(() => {
        const dataWithColors = {
          ...actualData,
          nodes: applyNodeTypeColors(actualData.nodes, importedSettings.nodeTypes),
          edges: applyEdgeTypeColors(actualData.edges, importedSettings.edgeTypes)
        };
        
        setGraphData(dataWithColors);
        if (setData) {
          setData(dataWithColors);
        }
        
        console.log('✅ 데이터 + 설정 불러오기 완료');
      }, 100);
      
    } else {
      const dataWithColors = {
        ...actualData,
        nodes: applyNodeTypeColors(actualData.nodes, typeSettings.nodeTypes),
        edges: applyEdgeTypeColors(actualData.edges, typeSettings.edgeTypes)
      };
      
      setGraphData(dataWithColors);
      if (setData) {
        setData(dataWithColors);
      }
      
      console.log('✅ 데이터 불러오기 완료 (설정 유지)');
    }
    
    // 성공 알림
    if (importedSettings) {
      await showSuccess(`${type.toUpperCase()} 데이터와 설정을 성공적으로 불러왔습니다!

📈 노드: ${actualData.nodes.length}개
🔗 엣지: ${actualData.edges.length}개
⚙️ 노드 타입: ${importedSettings.nodeTypes.length}개
⚙️ 엣지 타입: ${importedSettings.edgeTypes.length}개`);
    } else {
      await showSuccess(`${type.toUpperCase()} 데이터를 성공적으로 불러왔습니다!

📈 노드: ${actualData.nodes.length}개
🔗 엣지: ${actualData.edges.length}개

ℹ️ 기존 설정이 유지되었습니다.`);
    }
  };

  // 새로운 데이터 export 핸들러 (type에 따라 다르게 처리)
  const handleDataExport = async (type = 'json') => {
    const actualData = processedData && processedData.nodes.length > 0 ? processedData : graphData;
    
    if (type === 'json') {
      const exportData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        settings: {
          nodeTypes: typeSettings.nodeTypes || getDefaultNodeTypes(),
          edgeTypes: typeSettings.edgeTypes || getDefaultEdgeTypes()
        },
        data: {
          nodes: actualData.nodes || [],
          edges: actualData.edges || []
        },
        nodes: actualData.nodes || [],
        edges: actualData.edges || []
      };
      
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      
      const timestamp = todayLocalYmd();
      link.download = `knowledge-graph-${timestamp}.json`;
      
      link.click();
      URL.revokeObjectURL(url);
      
      await showSuccess(`JSON 데이터와 설정을 성공적으로 저장했습니다!

📈 노드: ${exportData.data.nodes.length}개
🔗 엣지: ${exportData.data.edges.length}개`);
    }
    // CSV는 Header의 handleCSVExport에서 처리됨
  };

  const handleLoadSampleData = async () => {
    console.log('🗺️ 샘플 데이터 로드 시작');

    // 샘플 데이터에 설정이 포함되어 있으면 먼저 적용
    if (sampleSettings && sampleSettings.nodeTypes && sampleSettings.edgeTypes) {
      console.log('⚙️ 샘플 데이터 타입 설정 적용:', sampleSettings);

      setTypeSettings(sampleSettings);
      localStorage.setItem('knowledgeGraphTypeSettings', JSON.stringify(sampleSettings));

      // 커스텀 이벤트 발생
      window.dispatchEvent(new CustomEvent('localStorageChange', {
        detail: {
          key: 'knowledgeGraphTypeSettings',
          newValue: JSON.stringify(sampleSettings)
        }
      }));

      setTimeout(() => {
        const sampleDataWithColors = {
          ...sampleGraphData,
          nodes: applyNodeTypeColors(sampleGraphData.nodes, sampleSettings.nodeTypes),
          edges: applyEdgeTypeColors(sampleGraphData.edges, sampleSettings.edgeTypes)
        };

        setGraphData(sampleDataWithColors);

        if (setData) {
          setData(sampleDataWithColors);
        }

        showInfo(`샘플 데이터를 불러왔습니다!

📈 노드: ${sampleGraphData.nodes.length}개
🔗 엣지: ${sampleGraphData.edges.length}개
⚙️ 노드 타입: ${sampleSettings.nodeTypes.length}개
⚙️ 엣지 타입: ${sampleSettings.edgeTypes.length}개`);

        console.log('✅ 샘플 데이터 + 설정 로드 완료');
      }, 100);
    } else {
      // 설정이 없으면 기존 설정 사용
      const sampleDataWithColors = {
        ...sampleGraphData,
        nodes: applyNodeTypeColors(sampleGraphData.nodes, typeSettings.nodeTypes || getDefaultNodeTypes()),
        edges: applyEdgeTypeColors(sampleGraphData.edges, typeSettings.edgeTypes || getDefaultEdgeTypes())
      };

      setGraphData(sampleDataWithColors);

      if (setData) {
        setData(sampleDataWithColors);
      }

      await showInfo(`샘플 데이터를 불러왔습니다!

📈 노드: ${sampleGraphData.nodes.length}개
🔗 엣지: ${sampleGraphData.edges.length}개

ℹ️ 기존 설정이 유지되었습니다.`);

      console.log('✅ 샘플 데이터 로드 완료 (기존 설정 유지)');
    }
  };

  // 서버에서 불러온 데이터 처리 핸들러
  const handleLoadFromServer = useCallback((loadedData, loadedSettings) => {
    console.log('☁️ 서버 데이터 불러오기:', {
      nodes: loadedData.nodes.length,
      edges: loadedData.edges.length
    });

    // 설정이 있으면 먼저 적용
    if (loadedSettings && loadedSettings.nodeTypes && loadedSettings.edgeTypes) {
      console.log('⚙️ 서버 데이터 타입 설정 적용:', loadedSettings);
      setTypeSettings(loadedSettings);
      localStorage.setItem('knowledgeGraphTypeSettings', JSON.stringify(loadedSettings));

      // 커스텀 이벤트 발생
      window.dispatchEvent(new CustomEvent('localStorageChange', {
        detail: {
          key: 'knowledgeGraphTypeSettings',
          newValue: JSON.stringify(loadedSettings)
        }
      }));

      // 색상 적용
      const dataWithColors = {
        nodes: applyNodeTypeColors(loadedData.nodes, loadedSettings.nodeTypes),
        edges: applyEdgeTypeColors(loadedData.edges, loadedSettings.edgeTypes)
      };

      setGraphData(dataWithColors);
      if (setData) {
        setData(dataWithColors);
      }
    } else {
      // 기존 설정 사용
      const dataWithColors = {
        nodes: applyNodeTypeColors(loadedData.nodes, typeSettings.nodeTypes || getDefaultNodeTypes()),
        edges: applyEdgeTypeColors(loadedData.edges, typeSettings.edgeTypes || getDefaultEdgeTypes())
      };

      setGraphData(dataWithColors);
      if (setData) {
        setData(dataWithColors);
      }
    }

    console.log('✅ 서버 데이터 로드 완료');
  }, [typeSettings, setData]);

  // 타입 설정 변경 핸들러
  const handleTypeSettingsChange = useCallback((newSettings) => {
    console.log('🛠️ 타입 설정 변경 요청:', newSettings);

    // 타입 설정 업데이트
    setTypeSettings(newSettings);

    // localStorage에 저장
    localStorage.setItem('knowledgeGraphTypeSettings', JSON.stringify(newSettings));

    // 같은 탭에서의 변경을 감지하기 위한 커스텀 이벤트 발생
    window.dispatchEvent(new CustomEvent('localStorageChange', {
      detail: {
        key: 'knowledgeGraphTypeSettings',
        newValue: JSON.stringify(newSettings)
      }
    }));

    // 기존 그래프 데이터에 새로운 설정 적용 (삭제된 타입 처리 포함)
    if (graphData.nodes.length > 0 || graphData.edges.length > 0) {
      console.log('📊 현재 그래프 데이터:', {
        노드수: graphData.nodes.length,
        엣지수: graphData.edges.length
      });

      let updatedNodes = [...graphData.nodes];
      let updatedEdges = [...graphData.edges];

      // 삭제된 노드 타입을 'unknown'으로 변경
      if (newSettings.deletedNodeTypes && newSettings.deletedNodeTypes.length > 0) {
        console.log('🗑️ 삭제된 노드 타입들을 unknown으로 변경:', newSettings.deletedNodeTypes);
        updatedNodes = updatedNodes.map(node => {
          if (newSettings.deletedNodeTypes.includes(node.type)) {
            console.log(`📝 노드 "${node.label}"의 타입을 "${node.type}" → "unknown"으로 변경`);
            return {
              ...node,
              type: 'unknown'
            };
          }
          return node;
        });
      }

      // 삭제된 엣지 타입을 'unknown'으로 변경
      if (newSettings.deletedEdgeTypes && newSettings.deletedEdgeTypes.length > 0) {
        console.log('🗑️ 삭제된 엣지 타입들을 unknown으로 변경:', newSettings.deletedEdgeTypes);
        updatedEdges = updatedEdges.map(edge => {
          if (newSettings.deletedEdgeTypes.includes(edge.type)) {
            console.log(`📝 엣지 "${edge.label || edge.type}"의 타입을 "${edge.type}" → "unknown"으로 변경`);
            return {
              ...edge,
              type: 'unknown',
              label: edge.label || '알 수 없음'
            };
          }
          return edge;
        });
      }

      console.log('🔄 타입별 색상 및 레이블 적용 시작...');
      console.log('📋 적용할 엣지 타입:', newSettings.edgeTypes);

      // 새로운 색상 및 레이블 적용
      const updatedData = {
        nodes: applyNodeTypeColors(updatedNodes, newSettings.nodeTypes),
        edges: applyEdgeTypeColors(updatedEdges, newSettings.edgeTypes)
      };

      console.log('✅ 업데이트된 데이터:', {
        노드수: updatedData.nodes.length,
        엣지수: updatedData.edges.length,
        샘플_엣지: updatedData.edges.slice(0, 2).map(e => ({
          id: e.id,
          type: e.type,
          label: e.label,
          color: e.color
        }))
      });

      console.log('🎨 그래프 데이터에 새로운 색상 및 레이블 적용 완료');
      setGraphData(updatedData);
      if (setData) {
        console.log('📤 setData 호출하여 vis.js에 데이터 전달');
        setData(updatedData);
      }
    }
  }, [graphData, setData]);

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
        onLayoutChange={handleLayoutChange}
        onDataImport={handleDataImport}
        onDataExport={handleDataExport}
        onLoadSampleData={handleLoadSampleData}
        onLoadFromServer={handleLoadFromServer}
        filterOptions={filterOptions}
        onFilterChange={handleFilterChange}
        currentGraphData={processedData}
        onTypeSettingsChange={handleTypeSettingsChange}
        typeSettings={typeSettings}
        showError={showError}
        showSuccess={showSuccess}
        showInfo={showInfo}
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
              onNodeUpdate={(updatedNode) => {
                updateGraphData('updateNode', updatedNode.id, updatedNode);
              }}
              onEdgeUpdate={(updatedEdge) => {
                updateGraphData('updateEdge', updatedEdge.id, updatedEdge);
              }}
              onNodeDelete={(nodeId) => {
                removeNode(nodeId);
                clearSelection();
              }}
              onMultipleNodesDelete={(nodeIds) => {
                removeMultipleNodes(nodeIds);
                clearSelection();
              }}
              onEdgeDelete={(edgeId) => {
                removeEdge(edgeId);
                clearSelection();
              }}
              nodeTypes={typeSettings.nodeTypes}
              edgeTypes={typeSettings.edgeTypes}
              askWarningConfirm={askWarningConfirm}
              showError={showError}
              showSuccess={showSuccess}
              showInfo={showInfo}
            />
          </div>
          
          <div className="panel-container">
            <DataPanel
              selectedNode={selectedNode}
              selectedEdge={selectedEdge}
              graphData={processedData}
              onNodeUpdate={(nodeId, updates) => {
                updateGraphData('updateNode', nodeId, updates);
              }}
              onEdgeUpdate={(edgeId, updates) => {
                updateGraphData('updateEdge', edgeId, updates);
              }}
              onNodeDelete={(nodeId) => {
                removeNode(nodeId);
                clearSelection();
              }}
              onEdgeDelete={(edgeId) => {
                removeEdge(edgeId);
                clearSelection();
              }}
              onClearSelection={clearSelection}
              nodeTypes={typeSettings.nodeTypes}
              edgeTypes={typeSettings.edgeTypes}
              askWarningConfirm={askWarningConfirm}
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