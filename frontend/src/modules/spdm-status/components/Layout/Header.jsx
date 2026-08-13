import React from 'react';
import styled from 'styled-components';
import { FileText, List, Box, CalendarDays, Settings, LayoutDashboard } from 'lucide-react';
import { CommonHeader } from '../../../../shared/components/Header';

const TitleWrapper = styled.div`
  display: flex;
  flex-direction: column;
  line-height: 1.2;
`;

const MainTitle = styled.span`
  font-size: 1.25rem;
  font-weight: 700;
`;

const SubTitle = styled.span`
  font-size: 0.75rem;
  font-weight: 400;
  color: #64748b;
  margin-top: 2px;
`;

const SettingsButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: white;
  color: #64748b;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #f1f5f9;
    color: #374151;
    border-color: #cbd5e1;
  }

  span {
    @media (max-width: 1400px) {
      display: none;
    }
  }

  @media (max-width: 1400px) {
    padding: 8px;
    gap: 0;
  }
`;

const Header = ({ onGoHome, viewMode = 'issues', onViewModeChange, onOpenSettings }) => {
  // 타이틀 컴포넌트
  const titleContent = (
    <TitleWrapper>
      <MainTitle>플랫폼 현황</MainTitle>
      <SubTitle>SPDM 현황 관리</SubTitle>
    </TitleWrapper>
  );

  // 화면 전환 토글
  const viewToggle = (
    <div className="header-actions">
      <div className="view-toggle">
        <button
          className={`toggle-btn ${viewMode === 'dashboard' ? 'active' : ''}`}
          onClick={() => onViewModeChange && onViewModeChange('dashboard')}
          title="SPDM 현황"
        >
          <LayoutDashboard size={16} strokeWidth={2} />
          <span>SPDM 현황</span>
        </button>
        <button
          className={`toggle-btn ${viewMode === 'issues' ? 'active' : ''}`}
          onClick={() => onViewModeChange && onViewModeChange('issues')}
          title="이슈 보기"
        >
          <List size={16} strokeWidth={2} />
          <span>이슈 보기</span>
        </button>
        <button
          className={`toggle-btn ${viewMode === 'modules' ? 'active' : ''}`}
          onClick={() => onViewModeChange && onViewModeChange('modules')}
          title="모듈 현황"
        >
          <Box size={16} strokeWidth={2} />
          <span>모듈 현황</span>
        </button>
        <button
          className={`toggle-btn ${viewMode === 'schedule' ? 'active' : ''}`}
          onClick={() => onViewModeChange && onViewModeChange('schedule')}
          title="일정 공유"
        >
          <CalendarDays size={16} strokeWidth={2} />
          <span>일정 공유</span>
        </button>
      </div>
    </div>
  );

  const settingsButton = (
    <SettingsButton onClick={onOpenSettings} title="설정">
      <Settings size={16} />
      <span>설정</span>
    </SettingsButton>
  );

  return (
    <CommonHeader
      logo={<FileText size={24} strokeWidth={2} />}
      title={titleContent}
      titleColor="#8b5cf6"
      onGoHome={onGoHome}
      showStats={false}
      centerContent={viewToggle}
      rightContent={settingsButton}
      className="spdm-status-header"
    />
  );
};

export default Header;
