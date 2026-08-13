import React from 'react';
import { Calendar, Plus, RotateCcw, PlusSquare } from 'lucide-react';
import { CommonHeader } from '../../../../shared/components/Header';
import { ImportDropdown, ExportDropdown } from '../../../../shared/components/ImportExport';
import { tasksToCSV, csvToTasks, validateGanttCSVData } from '../../utils/csvUtils';
import { todayLocalYmd } from '../../../../shared/utils/localDate';

const Header = ({ 
  onGoHome, 
  onAddTask, 
  onAddMultipleTasks,
  onImport, 
  onExport, 
  onLoadSample,
  onLoadFromStorage,
  tasksCount = 0,
  tasks = [],
  showError,
  showSuccess
}) => {

  // 통계 데이터
  const statsData = [
    {
      label: `${tasksCount}개 태스크`,
      style: {
        backgroundColor: '#e8f5e8',
        color: '#2d5a2d',
        borderColor: '#a8d4a8'
      }
    }
  ];

  // JSON Import 핸들러
  const handleJSONImport = async (data, filename) => {
    if (onImport) {
      await onImport(data, 'json', filename);
    }
  };

  // CSV Import 핸들러
  const handleCSVImport = async (csvData, filename) => {
    try {
      const tasks = csvToTasks(csvData);
      if (onImport) {
        await onImport(tasks, 'csv', filename);
      }
    } catch (error) {
      throw new Error(`CSV 데이터 변환 실패: ${error.message}`);
    }
  };

  // 데이터 유효성 검증
  const validateImportData = (data, type) => {
    if (type === 'csv') {
      return validateGanttCSVData(data);
    } else if (type === 'json') {
      const result = { isValid: true, errors: [], warnings: [] };
      
      if (Array.isArray(data)) {
        return result;
      } else if (data.tasks && Array.isArray(data.tasks)) {
        return result;
      } else {
        result.isValid = false;
        result.errors.push('올바른 태스크 데이터 형식이 아닙니다.');
        return result;
      }
    }
    return { isValid: true, errors: [], warnings: [] };
  };

  // JSON Export 핸들러
  const handleJSONExport = async () => {
    if (onExport) {
      await onExport('json');
    }
  };

  // CSV Export 핸들러
  const handleCSVExport = async () => {
    try {
      const csvData = tasksToCSV(tasks);
      if (csvData.length === 0) {
        throw new Error('내보낼 태스크가 없습니다.');
      }
      
      const timestamp = todayLocalYmd();
      const { downloadCSV } = await import('../../../../shared/utils/csvUtils');
      
      downloadCSV(csvData, `gantt-tasks-${timestamp}`, {
        includeHeader: true,
        encoding: 'utf-8'
      });
      
      if (showSuccess) {
        showSuccess(`${csvData.length}개의 태스크를 UTF-8 CSV로 내보냈습니다.`);
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
      <button 
        className="header-btn action-btn add-btn"
        onClick={onAddTask}
        title="새 태스크 추가"
      >
        <Plus size={18} strokeWidth={2} />
        <span>태스크 추가</span>
      </button>
      
      <button 
        className="header-btn action-btn bulk-add-btn"
        onClick={onAddMultipleTasks}
        title="여러 태스크를 한번에 추가"
      >
        <PlusSquare size={18} strokeWidth={2} />
        <span>멀티 태스크 추가</span>
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
        data={tasks}
        filename="gantt-tasks"
        showError={showError}
        showSuccess={showSuccess}
        className="header-export-dropdown"
      />
      
      <div className="header-divider"></div>
      
      {onLoadFromStorage && (
        <>
          <button 
            className="header-btn action-btn"
            onClick={onLoadFromStorage}
            title="저장된 데이터 불러오기"
            style={{
              backgroundColor: '#f3e5f5',
              color: '#7b1fa2',
              borderColor: '#ce93d8'
            }}
          >
            <RotateCcw size={18} strokeWidth={2} />
            <span>저장된 데이터</span>
          </button>
          
          <div className="header-divider"></div>
        </>
      )}
      
      <button 
        className="header-btn action-btn sample-btn"
        onClick={onLoadSample}
        title="샘플 데이터 로드"
      >
        <RotateCcw size={18} strokeWidth={2} />
        <span>샘플</span>
      </button>
    </div>
  );

  return (
    <CommonHeader
      logo={<Calendar size={24} strokeWidth={2} />}
      title="Gantt Chart"
      titleColor="#f59e0b"
      centerContent={centerContent}
      statsData={statsData}
      onGoHome={onGoHome}
      className="gantt-chart-header"
    />
  );
};

export default Header;
