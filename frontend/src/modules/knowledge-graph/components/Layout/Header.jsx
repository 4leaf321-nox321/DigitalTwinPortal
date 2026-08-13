import React, { useState } from 'react';
import { 
  Search, 
  Network, 
  Filter,
  Settings,
  LayoutGrid
} from 'lucide-react';
import { CommonHeader } from '../../../../shared/components/Header';
import { ImportDropdown, ExportDropdown } from '../../../../shared/components/ImportExport';
import { graphDataToCSV, csvToGraphData, csvArrayToGraphData, validateKnowledgeGraphCSVData } from '../../utils/csvUtils';
import TypeSettingsModal from './TypeSettingsModal';
import { todayLocalYmd } from '../../../../shared/utils/localDate';

const Header = ({
  searchQuery,
  onSearchChange,
  layoutType,
  onLayoutChange,
  onDataImport,
  onDataExport,
  filterOptions,
  onFilterChange,
  onTypeSettingsChange,
  currentGraphData = { nodes: [], edges: [] },
  typeSettings = { nodeTypes: [], edgeTypes: [] },
  onLoadSampleData,
  showError,
  showSuccess,
  askWarningConfirm,
  onGoHome
}) => {
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showTypeSettings, setShowTypeSettings] = useState(false);

  const layoutOptions = [
    { value: 'force-directed', label: '힘 기반 레이아웃' },
    { value: 'circular', label: '원형 레이아웃' },
    { value: 'grid', label: '그리드 레이아웃' }
  ];

  // 통계 데이터
  const statsData = [
    {
      label: `${currentGraphData.nodes.length}개 노드`,
      style: {
        backgroundColor: '#e8f5e8',
        color: '#2d5a2d',
        borderColor: '#a8d4a8'
      }
    },
    {
      label: `${currentGraphData.edges.length}개 관계`,
      style: {
        backgroundColor: '#e3f2fd',
        color: '#1565c0',
        borderColor: '#90caf9'
      }
    }
  ];

  // JSON Import/Export 핸들러들
  const handleJSONImport = async (data, filename) => {
    try {
      if (data.version && data.data && data.settings) {
        if (!data.data.nodes || !Array.isArray(data.data.nodes)) {
          throw new Error('잘못된 JSON 파일입니다. data.nodes 배열이 필요합니다.');
        }
        if (!data.data.edges || !Array.isArray(data.data.edges)) {
          throw new Error('잘못된 JSON 파일입니다. data.edges 배열이 필요합니다.');
        }
      } else if (data.nodes && data.edges) {
        if (!Array.isArray(data.nodes)) {
          throw new Error('잘못된 JSON 파일입니다. nodes 배열이 필요합니다.');
        }
        if (!Array.isArray(data.edges)) {
          throw new Error('잘못된 JSON 파일입니다. edges 배열이 필요합니다.');
        }
      } else {
        throw new Error('잘못된 JSON 파일입니다. 올바른 데이터 구조가 필요합니다.');
      }
      
      if (onDataImport) {
        await onDataImport(data, 'json', filename);
      }
    } catch (error) {
      throw new Error(error.message);
    }
  };

  const handleCSVImport = async (csvData, filename) => {
    try {
      const graphData = csvArrayToGraphData(csvData);
      if (onDataImport) {
        await onDataImport(graphData, 'csv', filename);
      }
    } catch (error) {
      throw new Error(`CSV 데이터 변환 실패: ${error.message}`);
    }
  };

  const validateImportData = (data, type) => {
    if (type === 'csv') {
      try {
        const graphData = csvArrayToGraphData(data);
        return validateKnowledgeGraphCSVData(graphData);
      } catch (error) {
        return {
          isValid: false,
          errors: [`CSV 데이터 검증 실패: ${error.message}`],
          warnings: []
        };
      }
    } else if (type === 'json') {
      const result = { isValid: true, errors: [], warnings: [] };
      
      if (data.version && data.data && data.settings) {
        if (!data.data.nodes || !Array.isArray(data.data.nodes)) {
          result.isValid = false;
          result.errors.push('data.nodes 배열이 필요합니다.');
        }
        if (!data.data.edges || !Array.isArray(data.data.edges)) {
          result.isValid = false;
          result.errors.push('data.edges 배열이 필요합니다.');
        }
      } else if (data.nodes && data.edges) {
        if (!Array.isArray(data.nodes)) {
          result.isValid = false;
          result.errors.push('nodes 배열이 필요합니다.');
        }
        if (!Array.isArray(data.edges)) {
          result.isValid = false;
          result.errors.push('edges 배열이 필요합니다.');
        }
      } else {
        result.isValid = false;
        result.errors.push('올바른 그래프 데이터 구조가 필요합니다.');
      }
      
      return result;
    }
    return { isValid: true, errors: [], warnings: [] };
  };

  const handleJSONExport = async () => {
    if (onDataExport) {
      await onDataExport('json');
    }
  };

  const handleCSVExport = async () => {
    try {
      const { nodes, edges } = graphDataToCSV(currentGraphData);
      
      if (nodes.length === 0 && edges.length === 0) {
        throw new Error('내보낼 데이터가 없습니다.');
      }
      
      const timestamp = todayLocalYmd();
      const { downloadCSV } = await import('../../../../shared/utils/csvUtils');
      
      const csvOptions = {
        includeHeader: true,
        encoding: 'utf-8'
      };
      
      if (nodes.length > 0) {
        downloadCSV(nodes, `knowledge-graph-nodes-${timestamp}`, csvOptions);
      }
      
      if (edges.length > 0) {
        downloadCSV(edges, `knowledge-graph-edges-${timestamp}`, csvOptions);
      }
      
      let message = '';
      if (nodes.length > 0 && edges.length > 0) {
        message = `노드 ${nodes.length}개, 엣지 ${edges.length}개를 UTF-8 CSV로 내보냈습니다.`;
      } else if (nodes.length > 0) {
        message = `노드 ${nodes.length}개를 UTF-8 CSV로 내보냈습니다.`;
      } else {
        message = `엣지 ${edges.length}개를 UTF-8 CSV로 내보냈습니다.`;
      }
      
      if (showSuccess) {
        showSuccess(message);
      }
    } catch (error) {
      if (showError) {
        showError(`CSV 내보내기 실패: ${error.message}`);
      }
      throw error;
    }
  };

  // 동적 타입 목록
  const availableNodeTypes = typeSettings.nodeTypes && typeSettings.nodeTypes.length > 0 
    ? typeSettings.nodeTypes.map(t => t.id)
    : ['person', 'company', 'project', 'skill', 'department', 'technology', 'unknown'];
  
  const availableEdgeTypes = typeSettings.edgeTypes && typeSettings.edgeTypes.length > 0
    ? typeSettings.edgeTypes.map(t => t.id)
    : ['works_for', 'participates_in', 'has_skill', 'belongs_to', 'uses_technology', 'utilizes', 'part_of', 'collaborates_with', 'unknown'];

  // 검색 바
  const leftContent = (
    <div className="search-container">
      <Search size={18} strokeWidth={2} style={{ color: '#6c757d', marginRight: '8px' }} />
      <input
        type="text"
        placeholder="노드나 관계를 검색하세요..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
      />
    </div>
  );

  // 중앙 액션 버튼들
  const centerContent = (
    <div className="header-actions">
      {/* 레이아웃 드롭다운 */}
      <div className="dropdown-container" style={{ position: 'relative' }}>
        <button 
          className="header-btn action-btn"
          onClick={() => setShowLayoutMenu(!showLayoutMenu)}
          title="레이아웃 변경"
          style={{
            backgroundColor: '#f0f9ff',
            color: '#0369a1',
            borderColor: '#bae6fd'
          }}
        >
          <LayoutGrid size={18} strokeWidth={2} />
          <span>레이아웃</span>
        </button>
        {showLayoutMenu && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: '0',
            backgroundColor: 'white',
            border: '1px solid #dee2e6',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 1000,
            minWidth: '180px',
            marginTop: '4px'
          }}>
            {layoutOptions.map(option => (
              <button
                key={option.value}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: 'none',
                  background: layoutType === option.value ? '#e3f2fd' : 'transparent',
                  color: layoutType === option.value ? '#1565c0' : '#495057',
                  textAlign: 'left',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  onLayoutChange(option.value);
                  setShowLayoutMenu(false);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 필터 드롭다운 */}
      <div className="dropdown-container" style={{ position: 'relative' }}>
        <button 
          className="header-btn action-btn"
          onClick={() => setShowFilterMenu(!showFilterMenu)}
          title="필터 설정"
          style={{
            backgroundColor: '#fff3e0',
            color: '#e65100',
            borderColor: '#ffcc80'
          }}
        >
          <Filter size={18} strokeWidth={2} />
          <span>필터</span>
        </button>
        {showFilterMenu && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: '0',
            backgroundColor: 'white',
            border: '1px solid #dee2e6',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 1000,
            minWidth: '250px',
            marginTop: '4px',
            padding: '12px',
            maxHeight: '400px',
            overflowY: 'auto'
          }}>
            <div style={{ marginBottom: '12px' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '600' }}>노드 타입</h4>
              {availableNodeTypes.map(type => (
                <label key={type} style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
                  <input
                    type="checkbox"
                    checked={filterOptions.nodeTypes.includes(type)}
                    onChange={(e) => {
                      const newTypes = e.target.checked
                        ? [...filterOptions.nodeTypes, type]
                        : filterOptions.nodeTypes.filter(t => t !== type);
                      onFilterChange({
                        ...filterOptions,
                        nodeTypes: newTypes
                      });
                    }}
                    style={{ marginRight: '6px' }}
                  />
                  {type}
                </label>
              ))}
            </div>
            <div style={{ marginBottom: '12px' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '600' }}>관계 타입</h4>
              {availableEdgeTypes.map(type => (
                <label key={type} style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
                  <input
                    type="checkbox"
                    checked={filterOptions.edgeTypes.includes(type)}
                    onChange={(e) => {
                      const newTypes = e.target.checked
                        ? [...filterOptions.edgeTypes, type]
                        : filterOptions.edgeTypes.filter(t => t !== type);
                      onFilterChange({
                        ...filterOptions,
                        edgeTypes: newTypes
                      });
                    }}
                    style={{ marginRight: '6px' }}
                  />
                  {type}
                </label>
              ))}
            </div>
            <button
              style={{
                width: '100%',
                padding: '6px 12px',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                background: '#f8f9fa',
                color: '#495057',
                fontSize: '12px',
                cursor: 'pointer'
              }}
              onClick={() => {
                onFilterChange({
                  nodeTypes: [],
                  edgeTypes: [],
                  minConnections: 0
                });
                setShowFilterMenu(false);
              }}
            >
              필터 초기화
            </button>
          </div>
        )}
      </div>

      <div className="header-divider"></div>

      {/* 샘플 데이터 로드 */}
      {onLoadSampleData && currentGraphData.nodes.length === 0 && (
        <>
          <button 
            className="header-btn action-btn sample-btn"
            onClick={onLoadSampleData}
            title="샘플 데이터 불러오기"
          >
            <Network size={18} strokeWidth={2} />
            <span>샘플</span>
          </button>
          <div className="header-divider"></div>
        </>
      )}

      {/* Import/Export */}
      <ImportDropdown
        onImportJSON={handleJSONImport}
        onImportCSV={handleCSVImport}
        onValidateData={validateImportData}
        showError={showError}
        showSuccess={showSuccess}
        className="header-import-dropdown"
      />
      
      <ExportDropdown
        onExportJSON={handleJSONExport}
        onExportCSV={handleCSVExport}
        data={currentGraphData}
        filename="knowledge-graph"
        showError={showError}
        showSuccess={showSuccess}
        className="header-export-dropdown"
      />

      <div className="header-divider"></div>

      {/* 설정 */}
      <button 
        className="header-btn action-btn"
        onClick={() => setShowTypeSettings(true)}
        title="설정"
        style={{
          backgroundColor: '#f3e5f5',
          color: '#7b1fa2',
          borderColor: '#ce93d8'
        }}
      >
        <Settings size={18} strokeWidth={2} />
        <span>설정</span>
      </button>
    </div>
  );

  return (
    <>
      <CommonHeader
        logo={<Network size={24} strokeWidth={2} />}
        title="Knowledge Graph"
        titleColor="#10b981"
        leftContent={leftContent}
        centerContent={centerContent}
        statsData={statsData}
        onGoHome={onGoHome}
        className="knowledge-graph-header"
      />
      
      {/* 타입 설정 모달 */}
      <TypeSettingsModal
        isOpen={showTypeSettings}
        onClose={() => setShowTypeSettings(false)}
        onSave={onTypeSettingsChange || ((settings) => console.log('타입 설정:', settings))}
        currentGraphData={currentGraphData}
        initialNodeTypes={typeSettings.nodeTypes}
        initialEdgeTypes={typeSettings.edgeTypes}
        showError={showError}
        askWarningConfirm={askWarningConfirm}
      />
    </>
  );
};

export default Header;
