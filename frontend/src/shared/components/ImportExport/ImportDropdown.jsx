import React, { useState, useRef } from 'react';
import { Upload, ChevronDown, FileText, Database } from 'lucide-react';
import { readCSVFile } from '../../utils/csvUtils';
import './ImportDropdown.css';

const ImportDropdown = ({ 
  onImportJSON, 
  onImportCSV, 
  onValidateData,
  acceptedCSVFields = [],
  csvParseOptions = {},
  className = '',
  disabled = false,
  showError,
  showSuccess,
  ...props 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const jsonFileInputRef = useRef(null);
  const csvFileInputRef = useRef(null);

  const handleDropdownToggle = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
  };

  const handleJSONImport = () => {
    setIsOpen(false);
    jsonFileInputRef.current?.click();
  };

  const handleCSVImport = () => {
    setIsOpen(false);
    csvFileInputRef.current?.click();
  };

  const handleJSONFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json')) {
      if (showError) {
        showError('JSON 파일만 업로드 가능합니다.');
      }
      return;
    }

    setIsLoading(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      // 데이터 유효성 검증 (선택사항)
      if (onValidateData) {
        const validation = onValidateData(data, 'json');
        if (!validation.isValid) {
          throw new Error(validation.errors.join(', '));
        }
      }

      if (onImportJSON) {
        await onImportJSON(data, file.name);
      }
      
      if (showSuccess) {
        showSuccess(`JSON 파일을 성공적으로 불러왔습니다: ${file.name}`);
      }
    } catch (error) {
      console.error('JSON 파일 불러오기 오류:', error);
      if (showError) {
        showError(`JSON 파일 불러오기 실패: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
      event.target.value = '';
    }
  };

  const handleCSVFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const data = await readCSVFile(file, {
        hasHeader: true,
        ...csvParseOptions
      });

      // 데이터 유효성 검증 (선택사항)
      if (onValidateData) {
        const validation = onValidateData(data, 'csv');
        if (!validation.isValid) {
          throw new Error(validation.errors.join(', '));
        }
      }

      if (onImportCSV) {
        await onImportCSV(data, file.name);
      }
      
      if (showSuccess) {
        showSuccess(`CSV 파일을 성공적으로 불러왔습니다: ${file.name} (${data.length}개 행)`);
      }
    } catch (error) {
      console.error('CSV 파일 불러오기 오류:', error);
      if (showError) {
        showError(`CSV 파일 불러오기 실패: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
      event.target.value = '';
    }
  };

  const closeDropdown = () => {
    setIsOpen(false);
  };

  return (
    <div className={`import-dropdown-container ${className}`} {...props}>
      <button 
        className={`import-dropdown-trigger ${disabled ? 'disabled' : ''} ${isLoading ? 'loading' : ''}`}
        onClick={handleDropdownToggle}
        disabled={disabled || isLoading}
        title="데이터 불러오기"
        aria-label="데이터 불러오기"
      >
        <Upload size={18} strokeWidth={2} />
        <span>{isLoading ? '불러오는 중...' : '불러오기'}</span>
        <ChevronDown 
          size={16} 
          className={`dropdown-arrow ${isOpen ? 'open' : ''}`} 
        />
      </button>

      {isOpen && (
        <>
          <div className="import-dropdown-overlay" onClick={closeDropdown} />
          <div className="import-dropdown-menu">
            <div className="dropdown-header">
              <span>파일 형식 선택</span>
            </div>

            <button
              className="import-dropdown-item"
              onClick={handleJSONImport}
              disabled={isLoading}
            >
              <Database size={16} strokeWidth={2} />
              <div className="item-content">
                <span className="item-title">JSON 파일</span>
              </div>
            </button>

            <button
              className="import-dropdown-item"
              onClick={handleCSVImport}
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

      {/* Hidden file inputs */}
      <input
        ref={jsonFileInputRef}
        type="file"
        accept=".json"
        onChange={handleJSONFileChange}
        style={{ display: 'none' }}
      />

      <input
        ref={csvFileInputRef}
        type="file"
        accept=".csv"
        onChange={handleCSVFileChange}
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default ImportDropdown;