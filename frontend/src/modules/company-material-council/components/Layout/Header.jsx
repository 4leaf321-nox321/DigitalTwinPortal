import React, { useRef } from 'react';
import { FlaskConical, Plus, Settings, Database, Download, Upload, LayoutDashboard, Table, FileText } from 'lucide-react';
import styled from 'styled-components';
import { CommonHeader } from '../../../../shared/components/Header';

const HiddenInput = styled.input`
  display: none;
`;

const Header = ({ onGoHome, onAddData, onBulkAdd, onSettings, onExportJson, onImportJson, viewMode, onViewModeChange, onAddTestMethod }) => {
  const fileInputRef = useRef(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportJson(file);
      e.target.value = '';
    }
  };

  // 뷰 모드에 따른 버튼 렌더링
  const renderModeButtons = () => {
    if (viewMode === 'dashboard') {
      // 대시보드 모드에서는 설정 버튼만 표시
      return (
        <button className="settings-btn" onClick={onSettings}>
          <Settings size={16} strokeWidth={2} />
          <span>설정</span>
        </button>
      );
    }

    if (viewMode === 'test-methods') {
      // 시험 방법 모드에서는 시험 방법 추가 버튼만 표시 (설정 버튼 제외)
      return (
        <button className="add-data-btn" onClick={onAddTestMethod}>
          <Plus size={16} strokeWidth={2} />
          <span>시험 방법 추가</span>
        </button>
      );
    }

    // 데이터 관리 모드에서는 모든 버튼 표시
    return (
      <>
        <button className="add-data-btn" onClick={onAddData}>
          <Plus size={16} strokeWidth={2} />
          <span>데이터 추가</span>
        </button>
        <button className="bulk-add-btn" onClick={onBulkAdd}>
          <Database size={16} strokeWidth={2} />
          <span>여러 데이터 추가</span>
        </button>
        <button className="export-btn" onClick={onExportJson}>
          <Download size={16} strokeWidth={2} />
          <span>JSON 내보내기</span>
        </button>
        <button className="import-btn" onClick={handleImportClick}>
          <Upload size={16} strokeWidth={2} />
          <span>JSON 가져오기</span>
        </button>
        <HiddenInput
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
        />
        <button className="settings-btn" onClick={onSettings}>
          <Settings size={16} strokeWidth={2} />
          <span>설정</span>
        </button>
      </>
    );
  };

  // 중앙 콘텐츠 (액션 버튼 + 뷰 토글)
  const centerContent = (
    <div className="header-center-content">
      {renderModeButtons()}
      <div className="header-actions">
        <div className="view-toggle">
          <button
            className={`toggle-btn ${viewMode === 'dashboard' ? 'active' : ''}`}
            onClick={() => onViewModeChange('dashboard')}
            title="물성 대시보드"
          >
            <LayoutDashboard size={16} strokeWidth={2} />
            <span>물성 대시보드</span>
          </button>
          <button
            className={`toggle-btn ${viewMode === 'data-management' ? 'active' : ''}`}
            onClick={() => onViewModeChange('data-management')}
            title="물성 데이터 관리"
          >
            <Table size={16} strokeWidth={2} />
            <span>물성 데이터 관리</span>
          </button>
          <button
            className={`toggle-btn ${viewMode === 'test-methods' ? 'active' : ''}`}
            onClick={() => onViewModeChange('test-methods')}
            title="물성 시험 방법"
          >
            <FileText size={16} strokeWidth={2} />
            <span>물성 시험 방법</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <CommonHeader
        logo={<FlaskConical size={24} strokeWidth={2} />}
        title="전사 물성 협의체"
        titleColor="#8b5cf6"
        onGoHome={onGoHome}
        showStats={false}
        className="company-material-council-header"
        centerContent={centerContent}
      />

      <style>{`
        .company-material-council-header .add-data-btn {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.5rem 1rem;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          background: white;
          color: #8b5cf6;
        }

        .company-material-council-header .add-data-btn:hover {
          background: #f5f3ff;
          border-color: #c4b5fd;
        }

        .company-material-council-header .bulk-add-btn {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.5rem 1rem;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          background: white;
          color: #3b82f6;
        }

        .company-material-council-header .bulk-add-btn:hover {
          background: #eff6ff;
          border-color: #93c5fd;
        }

        .company-material-council-header .export-btn {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.5rem 1rem;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          background: white;
          color: #10b981;
        }

        .company-material-council-header .export-btn:hover {
          background: #ecfdf5;
          border-color: #6ee7b7;
        }

        .company-material-council-header .import-btn {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.5rem 1rem;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          background: white;
          color: #f59e0b;
        }

        .company-material-council-header .import-btn:hover {
          background: #fffbeb;
          border-color: #fcd34d;
        }

        .company-material-council-header .settings-btn {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.5rem 1rem;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          background: white;
          color: #64748b;
        }

        .company-material-council-header .settings-btn:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }
      `}</style>
    </>
  );
};

export default Header;
