import React from 'react';
import { Target, RotateCcw, Plus, Table, Radar, Grid, List, Trash, Eye, EyeOff } from 'lucide-react';
import { CommonHeader } from '../../../../shared/components/Header';
import { ImportDropdown, ExportDropdown } from '../../../../shared/components/ImportExport';
import { technologiesToCSV, csvToTechnologies, validateTechRadarCSVData } from '../../utils/csvUtils';

const Header = ({ 
  onGoHome,
  onAddTechnology,
  onBulkAddTechnology,
  onImportData,
  onExportData,
  onLoadSample,
  onClearData,
  technologiesCount = 0,
  technologies = [],
  viewMode = 'radar',
  onViewModeChange,
  showError,
  showSuccess,
  showLabels = true,
  onShowLabelsChange
}) => {

  // 통계 데이터
  const statsData = [
    {
      label: `${technologiesCount}개 기술`,
      style: {
        backgroundColor: '#fff3cd',
        color: '#856404',
        borderColor: '#ffeaa7'
      }
    }
  ];

  // JSON Import 핸들러
  const handleJSONImport = async (data, filename) => {
    if (onImportData) {
      await onImportData(data, 'json', filename);
    }
  };

  // CSV Import 핸들러
  const handleCSVImport = async (csvData, filename) => {
    try {
      const technologies = csvToTechnologies(csvData);
      if (onImportData) {
        await onImportData(technologies, 'csv', filename);
      }
    } catch (error) {
      throw new Error(`CSV 데이터 변환 실패: ${error.message}`);
    }
  };

  // JSON 데이터 유효성 검증
  const validateJSONData = (data) => {
    const result = { isValid: true, errors: [], warnings: [] };
    
    let technologiesArray = [];
    
    if (Array.isArray(data)) {
      technologiesArray = data;
    } else if (data && typeof data === 'object') {
      if (Array.isArray(data.technologies)) {
        technologiesArray = data.technologies;
      } else if (Array.isArray(data.data)) {
        technologiesArray = data.data;
      } else if (data.sectors && data.rings && Array.isArray(data.technologies)) {
        technologiesArray = data.technologies;
      } else {
        result.isValid = false;
        result.errors.push('올바른 기술 데이터 형식이 아닙니다.');
        return result;
      }
    } else {
      result.isValid = false;
      result.errors.push('올바른 JSON 형식이 아닙니다.');
      return result;
    }

    if (technologiesArray.length === 0) {
      result.warnings.push('기술 데이터가 비어있습니다.');
    }

    return result;
  };

  // 데이터 유효성 검증
  const validateImportData = (data, type) => {
    if (type === 'csv') {
      return validateTechRadarCSVData(data);
    } else if (type === 'json') {
      return validateJSONData(data);
    }
    return { isValid: true, errors: [], warnings: [] };
  };

  // JSON Export 핸들러
  const handleJSONExport = async () => {
    if (onExportData) {
      await onExportData('json');
    }
  };

  // CSV Export 핸들러
  const handleCSVExport = async () => {
    try {
      const csvData = technologiesToCSV(technologies);
      if (csvData.length === 0) {
        throw new Error('내보낼 기술이 없습니다.');
      }
      
      const timestamp = new Date().toISOString().split('T')[0];
      const { downloadCSV } = await import('../../../../shared/utils/csvUtils');
      
      downloadCSV(csvData, `tech-radar-technologies-${timestamp}`, {
        includeHeader: true,
        encoding: 'utf-8'
      });
      
      if (showSuccess) {
        showSuccess(`${csvData.length}개의 기술을 UTF-8 CSV로 내보냈습니다.`);
      }
    } catch (error) {
      if (showError) {
        showError(`CSV 내보내기 실패: ${error.message}`);
      }
      throw error;
    }
  };

  // 중앙 액션 버튼들 - view-toggle을 header-actions 안으로 이동
  const centerContent = (
    <div className="header-actions">
      {/* View Toggle을 actions 안으로 이동 */}
      <div className="view-toggle">
        <button 
          className={`toggle-btn ${viewMode === 'radar' ? 'active' : ''}`}
          onClick={() => onViewModeChange('radar')}
          title="레이더 뷰"
        >
          <Radar size={16} strokeWidth={2} />
          <span>RADAR</span>
        </button>
        <button 
          className={`toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
          onClick={() => onViewModeChange('table')}
          title="테이블 뷰"
        >
          <Grid size={16} strokeWidth={2} />
          <span>TABLE</span>
        </button>
        <button 
          className={`toggle-btn ${viewMode === 'grouped' ? 'active' : ''}`}
          onClick={() => onViewModeChange('grouped')}
          title="그룹 뷰"
        >
          <List size={16} strokeWidth={2} />
          <span>LIST</span>
        </button>
      </div>
      
      <div className="header-divider"></div>
      
      {/* 라벨 표시/숨김 토글 버튼 - 레이더 뷰에서만 표시 */}
      {viewMode === 'radar' && onShowLabelsChange && (
        <>
          <button 
            className={`header-btn action-btn ${showLabels ? 'active' : ''}`}
            onClick={() => onShowLabelsChange(!showLabels)}
            title={showLabels ? "기술 이름 숨기기" : "기술 이름 보이기"}
            style={{
              backgroundColor: showLabels ? '#7c3aed' : '#f8f4ff',
              color: showLabels ? '#ffffff' : '#7c3aed',
              borderColor: showLabels ? '#6d28d9' : '#d8b4fe'
            }}
          >
            {showLabels ? (
              <>
                <EyeOff size={18} strokeWidth={2} />
                <span>Hide Names</span>
              </>
            ) : (
              <>
                <Eye size={18} strokeWidth={2} />
                <span>Show Names</span>
              </>
            )}
          </button>
          <div className="header-divider"></div>
        </>
      )}
      
      <button 
        className="header-btn action-btn add-btn"
        onClick={onAddTechnology}
        title="새 기술 추가"
      >
        <Plus size={18} strokeWidth={2} />
        <span>Add Technology</span>
      </button>
      
      <button 
        className="header-btn action-btn bulk-add-btn"
        onClick={onBulkAddTechnology}
        title="여러 기술 일괄 추가"
      >
        <Table size={18} strokeWidth={2} />
        <span>Bulk Add</span>
      </button>
      
      <div className="header-divider"></div>
      
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
        data={technologies}
        filename="tech-radar-technologies"
        showError={showError}
        showSuccess={showSuccess}
        className="header-export-dropdown"
      />
      
      <div className="header-divider"></div>
      
      <button 
        className="header-btn action-btn sample-btn"
        onClick={onLoadSample}
        title="샘플 데이터 로드"
      >
        <RotateCcw size={18} strokeWidth={2} />
        <span>Sample</span>
      </button>
      
      <div className="header-divider"></div>
      
      <button 
        className="header-btn action-btn clear-btn"
        onClick={onClearData}
        title="모든 데이터 삭제"
      >
        <Trash size={18} strokeWidth={2} />
        <span>Clear</span>
      </button>
    </div>
  );

  return (
    <CommonHeader
      logo={<Target size={24} strokeWidth={2} />}
      title="Tech Radar"
      titleColor="#ff6b35"
      centerContent={centerContent}
      statsData={statsData}
      onGoHome={onGoHome}
      className="tech-radar-header"
    />
  );
};

export default Header;
