import React from 'react';
import styled from 'styled-components';
import { Database, Plus, ListPlus, Link, Settings, Table2, Map, Grid, Download, Trash2 } from 'lucide-react';
import { CommonHeader } from '../../../../shared/components/Header';

const HeaderButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: none;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  background: ${props => props.$variant === 'primary' ? '#06b6d4' : 'transparent'};
  color: ${props => props.$variant === 'primary' ? 'white' : '#64748b'};
  border: ${props => props.$variant === 'primary' ? 'none' : '1px solid #e2e8f0'};

  &:hover {
    background: ${props => props.$variant === 'primary' ? '#0891b2' : '#f1f5f9'};
    color: ${props => props.$variant === 'primary' ? 'white' : '#475569'};
  }
`;

const DangerButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 1px solid #fca5a5;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  background: transparent;
  color: #ef4444;

  &:hover {
    background: #fef2f2;
    border-color: #ef4444;
  }
`;

const Header = ({ onGoHome, onAddTask, onBulkAdd, onOpenTaskLink, onExportCsv, onDeleteAll, isAdmin, onOpenSettings, viewMode, onViewModeChange }) => {
  const centerContent = (
    <div className="header-center-content">
      <HeaderButton $variant="primary" onClick={onAddTask}>
        <Plus size={16} />
        새 과제 추가
      </HeaderButton>
      <HeaderButton onClick={onBulkAdd}>
        <ListPlus size={16} />
        여러 과제 추가
      </HeaderButton>
      <HeaderButton onClick={onOpenTaskLink}>
        <Link size={16} />
        과제 연결
      </HeaderButton>
      <HeaderButton onClick={onExportCsv}>
        <Download size={16} />
        로컬 저장
      </HeaderButton>
      {isAdmin && (
        <DangerButton onClick={onDeleteAll}>
          <Trash2 size={16} />
          전체 삭제
        </DangerButton>
      )}
      <div className="header-actions">
        <div className="view-toggle">
          <button
            className={`toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
            onClick={() => onViewModeChange('table')}
            title="테이블 보기"
          >
            <Table2 size={16} strokeWidth={2} />
            <span>테이블</span>
          </button>
          <button
            className={`toggle-btn ${viewMode === 'roadmap' ? 'active' : ''}`}
            onClick={() => onViewModeChange('roadmap')}
            title="로드맵 보기"
          >
            <Map size={16} strokeWidth={2} />
            <span>로드맵</span>
          </button>
          <button
            className={`toggle-btn ${viewMode === 'seedbed' ? 'active' : ''}`}
            onClick={() => onViewModeChange('seedbed')}
            title="모판 보기"
          >
            <Grid size={16} strokeWidth={2} />
            <span>모판</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <CommonHeader
      logo={<Database size={24} strokeWidth={2} />}
      title="개발 디지털 트윈 로드맵 정보"
      titleColor="#06b6d4"
      onGoHome={onGoHome}
      showStats={false}
      className="digital-twin-reference-header"
      centerContent={centerContent}
      rightContent={
        <HeaderButton onClick={onOpenSettings}>
          <Settings size={16} />
          설정
        </HeaderButton>
      }
    />
  );
};

export default Header;
