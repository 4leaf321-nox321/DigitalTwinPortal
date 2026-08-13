import React, { useState } from 'react';
import { Download, ChevronDown, FileText, Database } from 'lucide-react';
import { downloadCSV } from '../../utils/csvUtils';
import './ExportDropdown.css';
import { todayLocalYmd } from '../../utils/localDate';

const ExportDropdown = ({ 
  onExportJSON, 
  onExportCSV,
  data = null,
  filename = 'export',
  csvExportOptions = {},
  jsonExportOptions = {},
  className = '',
  disabled = false,
  showError,
  showSuccess,
  ...props 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleDropdownToggle = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
  };

  const handleJSONExport = async () => {
    setIsOpen(false);
    setIsLoading(true);

    try {
      if (onExportJSON) {
        await onExportJSON(data);
      } else {
        // 기본 JSON 내보내기
        await exportDefaultJSON(data, filename, jsonExportOptions);
      }
      
      if (showSuccess) {
        showSuccess(`JSON 파일을 성공적으로 내보냈습니다.`);
      }
    } catch (error) {
      console.error('JSON 내보내기 오류:', error);
      if (showError) {
        showError(`JSON 내보내기 실패: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCSVExport = async () => {
    setIsOpen(false);
    setIsLoading(true);

    try {
      if (onExportCSV) {
        await onExportCSV(data);
      } else {
        // 기본 CSV 내보내기
        await exportDefaultCSV(data, filename, csvExportOptions);
      }
      
      if (showSuccess) {
        showSuccess(`CSV 파일을 성공적으로 내보냈습니다.`);
      }
    } catch (error) {
      console.error('CSV 내보내기 오류:', error);
      if (showError) {
        showError(`CSV 내보내기 실패: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const exportDefaultJSON = async (data, filename, options = {}) => {
    if (!data) {
      throw new Error('내보낼 데이터가 없습니다.');
    }

    const exportData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      data: data,
      ...options
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    
    const timestamp = todayLocalYmd();
    link.download = `${filename}-${timestamp}.json`;
    
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportDefaultCSV = async (data, filename, options = {}) => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      throw new Error('내보낼 데이터가 없거나 올바른 배열 형식이 아닙니다.');
    }

    const timestamp = todayLocalYmd();
    const csvFilename = `${filename}-${timestamp}.csv`;
    
    downloadCSV(data, csvFilename, {
      includeHeader: true,
      ...options
    });
  };

  const closeDropdown = () => {
    setIsOpen(false);
  };

  const hasData = data && (Array.isArray(data) ? data.length > 0 : Object.keys(data).length > 0);

  return (
    <div className={`export-dropdown-container ${className}`} {...props}>
      <button 
        className={`export-dropdown-trigger ${disabled || !hasData ? 'disabled' : ''} ${isLoading ? 'loading' : ''}`}
        onClick={handleDropdownToggle}
        disabled={disabled || !hasData || isLoading}
        title={hasData ? "데이터 내보내기" : "내보낼 데이터가 없습니다"}
        aria-label="데이터 내보내기"
      >
        <Download size={18} strokeWidth={2} />
        <span>{isLoading ? '내보내는 중...' : '내보내기'}</span>
        <ChevronDown 
          size={16} 
          className={`dropdown-arrow ${isOpen ? 'open' : ''}`} 
        />
      </button>

      {isOpen && (
        <>
          <div className="export-dropdown-overlay" onClick={closeDropdown} />
          <div className="export-dropdown-menu">
            <div className="dropdown-header">
              <span>파일 형식 선택</span>
            </div>
            
            <button
              className="export-dropdown-item"
              onClick={handleJSONExport}
              disabled={isLoading}
            >
              <Database size={16} strokeWidth={2} />
              <div className="item-content">
                <span className="item-title">JSON 파일</span>
              </div>
            </button>

            <button
              className="export-dropdown-item"
              onClick={handleCSVExport}
              disabled={isLoading}
            >
              <FileText size={16} strokeWidth={2} />
              <div className="item-content">
                <span className="item-title">CSV 파일</span>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ExportDropdown;