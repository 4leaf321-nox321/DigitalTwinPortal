import React from 'react';
import { Target, RotateCcw, Plus, Table, Radar, Grid, List, Trash, Eye, EyeOff, Settings } from 'lucide-react';
import { CommonHeader } from '../../../../shared/components/Header';
import { ImportDropdown, ExportDropdown } from '../../../../shared/components/ImportExport';
import { todayLocalYmd } from '../../../../shared/utils/localDate';

const Header = ({ 
  onGoHome,
  onAddTechnology,
  onBulkAddTechnology,
  onImportData,
  onExportData,
  onLoadSample,
  onClearData,
  onManageSectors,
  onManageSettings,
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
      label: `${technologiesCount}개 솔루션`,
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
      // CSV 데이터를 기술 객체로 변환
      const technologies = csvData.map((row, index) => ({
        id: `imported_${Date.now()}_${index}`,
        name: row['솔루션 이름'] || row['name'] || '',
        sector: row['섹터'] || row['sector'] || '',
        ring: row['성숙도'] || row['ring'] || '',
        description: row['설명'] || row['description'] || '',
        isAdopted: true
      }));
      
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
      } else {
        result.isValid = false;
        result.errors.push('올바른 솔루션 데이터 형식이 아닙니다.');
        return result;
      }
    } else {
      result.isValid = false;
      result.errors.push('올바른 JSON 형식이 아닙니다.');
      return result;
    }

    if (technologiesArray.length === 0) {
      result.warnings.push('솔루션 데이터가 비어있습니다.');
    }

    return result;
  };

  // 데이터 유효성 검증
  const validateImportData = (data, type) => {
    if (type === 'csv') {
      const result = { isValid: true, errors: [], warnings: [] };
      if (!Array.isArray(data) || data.length === 0) {
        result.isValid = false;
        result.errors.push('CSV 데이터가 비어있습니다.');
      }
      return result;
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
      // 솔루션 데이터를 CSV 형태로 변환
      const csvData = technologies.map(tech => ({
        '솔루션 이름': tech.name || '',
        '섹터': tech.sector || '',
        '성숙도': tech.ring || '',
        '설명': tech.description || '',
        '도입 여부': tech.isAdopted ? '도입됨' : '미도입'
      }));
      
      if (csvData.length === 0) {
        throw new Error('내보낼 솔루션이 없습니다.');
      }
      
      const timestamp = todayLocalYmd();
      const { downloadCSV } = await import('../../../../shared/utils/csvUtils');
      
      downloadCSV(csvData, `digital-twin-solutions-${timestamp}`, {
        includeHeader: true,
        encoding: 'utf-8'
      });
      
      if (showSuccess) {
        showSuccess(`${csvData.length}개의 솔루션을 UTF-8 CSV로 내보냈습니다.`);
      }
    } catch (error) {
      if (showError) {
        showError(`CSV 내보내기 실패: ${error.message}`);
      }
      throw error;
    }
  };

  // 중앙 액션 버튼들
  const centerContent = (
    <div className="header-actions">
      {/* View Toggle */}
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
            title={showLabels ? "솔루션 이름 숨기기" : "솔루션 이름 보이기"}
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
        className="header-btn action-btn manage-sectors-btn"
        onClick={onManageSectors}
        title="섹터 관리"
        style={{
          backgroundColor: '#f97316',
          color: '#ffffff',
          borderColor: '#ea580c'
        }}
      >
        <Settings size={18} strokeWidth={2} />
        <span>Manage Sectors</span>
      </button>
      
      <button 
        className="header-btn action-btn add-btn"
        onClick={onAddTechnology}
        title="새 솔루션 추가"
      >
        <Plus size={18} strokeWidth={2} />
        <span>Add Solution</span>
      </button>
      
      <button 
        className="header-btn action-btn bulk-add-btn"
        onClick={onBulkAddTechnology}
        title="여러 솔루션 일괄 추가"
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
        filename="digital-twin-solutions"
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

  // 설정 버튼 (홈 버튼 왼쪽에 표시)
  const settingsButton = (
    <button 
      className="header-btn action-btn settings-btn"
      onClick={onManageSettings}
      title="시스템 설정"
      style={{
        backgroundColor: '#8b5cf6',
        color: '#ffffff',
        borderColor: '#7c3aed',
        marginRight: '0.75rem'
      }}
    >
      <Settings size={18} strokeWidth={2} />
      <span>설정</span>
    </button>
  );

  return (
    <CommonHeader
      logo={<Target size={24} strokeWidth={2} />}
      title="Digital Twin Dashboard"
      titleColor="#667eea"
      centerContent={centerContent}
      rightContent={settingsButton}
      statsData={statsData}
      onGoHome={onGoHome}
      className="digital-twin-solution-header"
    />
  );
};

export default Header;
