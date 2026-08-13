import React, { useState, useRef } from 'react';
import { BookOpen, RotateCcw, Download, Upload, Settings, Trash2, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { CommonHeader } from '../../../../shared/components/Header';

const Header = ({
  documentsCount = 0,
  onGoHome,
  onLoadSample,
  onClearData,
  onExport,
  onImport,
  onAddProject,
  showError,
  showSuccess
}) => {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const fileInputRef = useRef(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
    setShowMoreMenu(false);
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target.result);
        onImport(jsonData);
      } catch (error) {
        showError('올바른 JSON 파일이 아닙니다.');
      }
    };
    reader.readAsText(file);
    
    // 파일 input 초기화
    event.target.value = '';
  };

  const handleExport = () => {
    onExport();
    setShowMoreMenu(false);
  };

  const handleClearData = () => {
    onClearData();
    setShowMoreMenu(false);
  };

  // 통계 데이터
  const statsData = [
    {
      label: `${documentsCount}개 문서`,
      style: {
        backgroundColor: '#f3f4f6',
        color: '#374151',
        borderColor: '#d1d5db'
      }
    }
  ];

  // 중앙 액션 버튼들
  const centerContent = (
    <div className="header-actions">
      <button 
        className="header-btn action-btn add-project-btn"
        onClick={onAddProject}
        title="새 프로젝트 추가"
        style={{
          backgroundColor: '#10b981',
          color: '#ffffff',
          borderColor: '#059669'
        }}
      >
        <Plus size={18} strokeWidth={2} />
        <span>프로젝트 추가</span>
      </button>
      
      <div className="header-divider"></div>
      
      <button 
        className="header-btn action-btn sample-btn"
        onClick={onLoadSample}
        title="샘플 데이터 로드"
      >
        <RotateCcw size={18} strokeWidth={2} />
        <span>샘플 로드</span>
      </button>
      
      <div className="header-divider"></div>
      
      <button 
        className="header-btn action-btn export-btn"
        onClick={handleExport} 
        disabled={documentsCount === 0}
        title="데이터 내보내기"
      >
        <Download size={18} strokeWidth={2} />
        <span>내보내기</span>
      </button>
      
      <button 
        className="header-btn action-btn import-btn"
        onClick={handleImportClick}
        title="데이터 가져오기"
      >
        <Upload size={18} strokeWidth={2} />
        <span>가져오기</span>
      </button>
    </div>
  );

  // 우측 콘텐츠 - 더보기 메뉴
  const rightContent = (
    <div style={{ position: 'relative' }}>
      <button 
        className={`header-btn action-btn ${showMoreMenu ? 'active' : ''}`}
        onClick={() => setShowMoreMenu(!showMoreMenu)}
        title="더 많은 옵션"
        style={{
          backgroundColor: showMoreMenu ? '#8b5cf6' : '#f3f4f6',
          color: showMoreMenu ? '#ffffff' : '#374151',
          borderColor: showMoreMenu ? '#7c3aed' : '#d1d5db'
        }}
      >
        <Settings size={18} strokeWidth={2} />
        <span>더보기</span>
      </button>
      
      {showMoreMenu && (
        <motion.div
          className="dropdown-menu"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '0.5rem',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            padding: '0.5rem',
            minWidth: '200px',
            zIndex: 1000,
            marginTop: '8px'
          }}
        >
          <button
            className="dropdown-item"
            onClick={handleExport} 
            disabled={documentsCount === 0}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem',
              border: 'none',
              background: 'none',
              color: documentsCount === 0 ? '#9ca3af' : '#374151',
              fontSize: '0.875rem',
              cursor: documentsCount === 0 ? 'not-allowed' : 'pointer',
              borderRadius: '0.375rem',
              transition: 'background 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (documentsCount > 0) {
                e.target.style.background = '#f3f4f6';
              }
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'none';
            }}
          >
            <Download size={16} strokeWidth={2} />
            <span>데이터 내보내기</span>
          </button>
          
          <button
            className="dropdown-item"
            onClick={handleImportClick}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem',
              border: 'none',
              background: 'none',
              color: '#374151',
              fontSize: '0.875rem',
              cursor: 'pointer',
              borderRadius: '0.375rem',
              transition: 'background 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#f3f4f6';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'none';
            }}
          >
            <Upload size={16} strokeWidth={2} />
            <span>데이터 가져오기</span>
          </button>
          
          <button
            className="dropdown-item"
            onClick={onLoadSample}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem',
              border: 'none',
              background: 'none',
              color: '#374151',
              fontSize: '0.875rem',
              cursor: 'pointer',
              borderRadius: '0.375rem',
              transition: 'background 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#f3f4f6';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'none';
            }}
          >
            <RotateCcw size={16} strokeWidth={2} />
            <span>샘플 데이터 로드</span>
          </button>
          
          <button
            className="dropdown-item"
            onClick={handleClearData}
            disabled={documentsCount === 0}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem',
              border: 'none',
              background: 'none',
              color: documentsCount === 0 ? '#9ca3af' : '#ef4444',
              fontSize: '0.875rem',
              cursor: documentsCount === 0 ? 'not-allowed' : 'pointer',
              borderRadius: '0.375rem',
              transition: 'background 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (documentsCount > 0) {
                e.target.style.background = '#fef2f2';
              }
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'none';
            }}
          >
            <Trash2 size={16} strokeWidth={2} />
            <span>모든 데이터 삭제</span>
          </button>
        </motion.div>
      )}
      
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </div>
  );

  return (
    <CommonHeader
      logo={<BookOpen size={24} strokeWidth={2} />}
      title="Tech Archive"
      titleColor="#8b5cf6"
      centerContent={centerContent}
      rightContent={rightContent}
      statsData={statsData}
      onGoHome={onGoHome}
      className="tech-archive-header"
    />
  );
};

export default Header;
