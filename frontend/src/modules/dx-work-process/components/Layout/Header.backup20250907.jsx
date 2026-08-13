import React, { useState, useRef } from 'react';
import { 
  Search, 
  Network, 
  Filter,
  Settings,
  LayoutGrid,
  Home
} from 'lucide-react';
import { ImportDropdown, ExportDropdown } from '../../../../shared/components/ImportExport';
import { graphDataToCSV, csvToGraphData, csvArrayToGraphData, validateKnowledgeGraphCSVData } from '../../utils/csvUtils';
import TypeSettingsModal from './TypeSettingsModal';

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
  currentGraphData = { nodes: [], edges: [] }, // 현재 그래프 데이터
  typeSettings = { nodeTypes: [], edgeTypes: [] }, // 타입 설정 추가
  onLoadSampleData, // 샘플 데이터 로드 함수 추가
  showError, // 모달 함수
  showSuccess,
  // 커스텀 모달 함수들 추가
  askWarningConfirm
}) => {
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showTypeSettings, setShowTypeSettings] = useState(false);

  const layoutOptions = [
    { value: 'force-directed', label: '힘 기반 레이아웃' },
    { value: 'circular', label: '원형 레이아웃' },
    { value: 'grid', label: '그리드 레이아웃' }
  ];

  const handleGoHome = () => {
    window.location.href = '/';
  };

  // JSON Import 핸들러
  const handleJSONImport = async (data, filename) => {
    try {
      // 새로운 형식 감지
      if (data.version && data.data && data.settings) {
        console.log('📁 새로운 형식 데이터 감지 (v' + data.version + '):', {
          nodes: data.data.nodes?.length || 0,
          edges: data.data.edges?.length || 0,
          nodeTypes: data.settings.nodeTypes?.length || 0,
          edgeTypes: data.settings.edgeTypes?.length || 0
        });
        
        // 데이터 유효성 검사
        if (!data.data.nodes || !Array.isArray(data.data.nodes)) {
          throw new Error('잘못된 JSON 파일입니다. data.nodes 배열이 필요합니다.');
        }
        
        if (!data.data.edges || !Array.isArray(data.data.edges)) {
          throw new Error('잘못된 JSON 파일입니다. data.edges 배열이 필요합니다.');
        }
      }
      // 기존 형식 감지
      else if (data.nodes && data.edges) {
        console.log('📁 기존 형식 데이터 감지:', {
          nodes: data.nodes.length,
          edges: data.edges.length
        });
        
        // 데이터 유효성 검사
        if (!Array.isArray(data.nodes)) {
          throw new Error('잘못된 JSON 파일입니다. nodes 배열이 필요합니다.');
        }
        
        if (!Array.isArray(data.edges)) {
          throw new Error('잘못된 JSON 파일입니다. edges 배열이 필요합니다.');
        }
      }
      else {
        throw new Error('잘못된 JSON 파일입니다. 올바른 데이터 구조가 필요합니다.');
      }
      
      if (onDataImport) {
        await onDataImport(data, 'json', filename);
      }
    } catch (error) {
      throw new Error(error.message);
    }
  };

  // CSV Import 핸들러
  const handleCSVImport = async (csvData, filename) => {
    try {
      // CSV 데이터를 그래프 데이터로 변환
      const graphData = csvArrayToGraphData(csvData);
      
      if (onDataImport) {
        await onDataImport(graphData, 'csv', filename);
      }
    } catch (error) {
      throw new Error(`CSV 데이터 변환 실패: ${error.message}`);
    }
  };

  // 데이터 유효성 검증
  const validateImportData = (data, type) => {
    if (type === 'csv') {
      // CSV 배열을 그래프 형태로 임시 변환해서 검증
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
      // JSON 데이터 유효성 검증
      const result = { isValid: true, errors: [], warnings: [] };
      
      if (data.version && data.data && data.settings) {
        // 새로운 형식
        if (!data.data.nodes || !Array.isArray(data.data.nodes)) {
          result.isValid = false;
          result.errors.push('data.nodes 배열이 필요합니다.');
        }
        if (!data.data.edges || !Array.isArray(data.data.edges)) {
          result.isValid = false;
          result.errors.push('data.edges 배열이 필요합니다.');
        }
      } else if (data.nodes && data.edges) {
        // 기존 형식
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

  // JSON Export 핸들러
  const handleJSONExport = async () => {
    if (onDataExport) {
      await onDataExport('json');
    }
  };

  // CSV Export 핸들러
  const handleCSVExport = async () => {
    try {
      const { nodes, edges } = graphDataToCSV(currentGraphData);
      
      if (nodes.length === 0 && edges.length === 0) {
        throw new Error('내보낼 데이터가 없습니다.');
      }
      
      const timestamp = new Date().toISOString().split('T')[0];
      const { downloadCSV } = await import('../../../../shared/utils/csvUtils');
      
      // UTF-8 인코딩 옵션
      const csvOptions = {
        includeHeader: true,
        encoding: 'utf-8'
      };
      
      // 노드와 엣지를 각각 다운로드
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

  // 동적 타입 목록 사용
  const availableNodeTypes = typeSettings.nodeTypes && typeSettings.nodeTypes.length > 0 
    ? typeSettings.nodeTypes.map(t => t.id)
    : ['person', 'company', 'project', 'skill', 'department', 'technology', 'unknown'];
  
  const availableEdgeTypes = typeSettings.edgeTypes && typeSettings.edgeTypes.length > 0
    ? typeSettings.edgeTypes.map(t => t.id)
    : ['works_for', 'participates_in', 'has_skill', 'belongs_to', 'uses_technology', 'utilizes', 'part_of', 'collaborates_with', 'unknown'];

  return (
    <header className="header">
      <div className="header-left">
        <div className="logo">
          <Network size={24} strokeWidth={2} />
          <h1>Knowledge Graph</h1>
        </div>
      </div>

      <div className="header-center">
        <div className="search-container">
          <Search size={18} className="search-icon" strokeWidth={2} />
          <input
            type="text"
            placeholder="노드나 관계를 검색하세요..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      <div className="header-right">
        {/* 레이아웃 선택 */}
        <div className="dropdown-container">
          <button 
            className="header-btn"
            onClick={() => setShowLayoutMenu(!showLayoutMenu)}
            title="레이아웃 변경"
            aria-label="레이아웃 변경"
          >
            <LayoutGrid size={18} strokeWidth={2} />
            <span>레이아웃</span>
          </button>
          {showLayoutMenu && (
            <div className="dropdown-menu">
              {layoutOptions.map(option => (
                <button
                  key={option.value}
                  className={`dropdown-item ${layoutType === option.value ? 'active' : ''}`}
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

        {/* 필터 */}
        <div className="dropdown-container">
          <button 
            className="header-btn"
            onClick={() => setShowFilterMenu(!showFilterMenu)}
            title="필터 설정"
            aria-label="필터 설정"
          >
            <Filter size={18} strokeWidth={2} />
            <span>필터</span>
          </button>
          {showFilterMenu && (
            <div className="dropdown-menu filter-menu">
              <div className="filter-section">
                <h4>노드 타입</h4>
                {availableNodeTypes.map(type => (
                  <label key={type} className="filter-checkbox">
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
                    />
                    {type}
                  </label>
                ))}
              </div>
              <div className="filter-section">
                <h4>관계 타입</h4>
                {availableEdgeTypes.map(type => (
                  <label key={type} className="filter-checkbox">
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
                    />
                    {type}
                  </label>
                ))}
              </div>
              <div className="filter-section">
                <h4>최소 연결 수</h4>
                <input
                  type="number"
                  min="0"
                  value={filterOptions.minConnections}
                  onChange={(e) => onFilterChange({
                    ...filterOptions,
                    minConnections: parseInt(e.target.value) || 0
                  })}
                  className="filter-input"
                />
              </div>
              <div className="filter-actions">
                <button
                  className="filter-reset-btn"
                  onClick={() => onFilterChange({
                    nodeTypes: [],
                    edgeTypes: [],
                    minConnections: 0
                  })}
                >
                  필터 초기화
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 샘플 데이터 로드 */}
        {onLoadSampleData && currentGraphData.nodes.length === 0 && (
          <button 
            className="header-btn sample-btn"
            onClick={onLoadSampleData}
            title="샘플 데이터 불러오기 (김철수, 박영희 등)"
            aria-label="샘플 데이터 불러오기"
          >
            <Network size={18} strokeWidth={2} />
            <span>샘플</span>
          </button>
        )}

        {/* 데이터 불러오기 */}
        <ImportDropdown
          onImportJSON={handleJSONImport}
          onImportCSV={handleCSVImport}
          onValidateData={validateImportData}
          showError={showError}
          showSuccess={showSuccess}
          className="header-import-dropdown"
        />

        {/* 데이터 저장하기 */}
        <ExportDropdown
          onExportJSON={handleJSONExport}
          onExportCSV={handleCSVExport}
          data={currentGraphData}
          filename="knowledge-graph"
          showError={showError}
          showSuccess={showSuccess}
          className="header-export-dropdown"
        />

        {/* 설정 */}
        <button 
          className="header-btn"
          onClick={() => {
            console.log('설정 버튼 클릭됨, 현재 타입 설정:', typeSettings); // 디버깅용
            setShowTypeSettings(true);
          }}
          title="설정"
          aria-label="설정"
        >
          <Settings size={18} strokeWidth={2} />
          <span>설정</span>
        </button>

        {/* 홈으로 돌아가기 버튼 */}
        <button 
          className="header-btn home-btn"
          onClick={handleGoHome}
          title="메인 화면으로 돌아가기"
          aria-label="메인 화면으로 돌아가기"
        >
          <Home size={18} strokeWidth={2} />
          <span>홈</span>
        </button>
      </div>
      
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
    </header>
  );
};

export default Header;
