import React from 'react';
import { Target, Home, Download, Upload, RotateCcw, Plus, Table } from 'lucide-react';
import './Header.css';

const Header = ({ 
  onGoHome,
  onAddTechnology,
  onBulkAddTechnology,
  onImportData,
  onExportData,
  onLoadSample,
  technologiesCount = 0
}) => {
  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <header className="tech-radar-header">
      <div className="header-left">
        <div className="logo">
          <Target size={24} strokeWidth={2} />
          <h1>Tech Radar</h1>
        </div>
        <div className="tech-count-badge">
          {technologiesCount}개 기술
        </div>
      </div>

      <div className="header-center">
        <div className="header-actions">
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
          
          <button 
            className="header-btn action-btn"
            onClick={onImportData}
            title="데이터 불러오기"
          >
            <Upload size={18} strokeWidth={2} />
            <span>Import</span>
          </button>
          
          <button 
            className="header-btn action-btn"
            onClick={onExportData}
            title="데이터 내보내기"
          >
            <Download size={18} strokeWidth={2} />
            <span>Export</span>
          </button>
          
          <div className="header-divider"></div>
          
          <button 
            className="header-btn action-btn sample-btn"
            onClick={onLoadSample}
            title="샘플 데이터 로드"
          >
            <RotateCcw size={18} strokeWidth={2} />
            <span>Sample</span>
          </button>
        </div>
      </div>

      <div className="header-right">
        <button 
          className="header-btn home-btn"
          onClick={onGoHome || handleGoHome}
          title="메인 화면으로 돌아가기"
        >
          <Home size={18} strokeWidth={2} />
          <span>홈</span>
        </button>
      </div>
    </header>
  );
};

export default Header;