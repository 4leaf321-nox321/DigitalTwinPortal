import React, { useState, useRef } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

const HeaderContainer = styled.div`
  background: white;
  border-bottom: 1px solid #e5e7eb;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: sticky;
  top: 0;
  z-index: 100;
  height: 80px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`;

const LeftSection = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const Logo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 1.5rem;
  font-weight: 700;
  color: #8b5cf6;
`;

const LogoIcon = styled.span`
  font-size: 1.75rem;
`;

const StatsSection = styled.div`
  display: flex;
  gap: 1rem;
  
  @media (max-width: 768px) {
    display: none;
  }
`;

const StatItem = styled.div`
  background: #f3f4f6;
  color: #374151;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  border: 1px solid #d1d5db;
`;

const CenterSection = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  
  @media (max-width: 1024px) {
    gap: 0.5rem;
  }
  
  @media (max-width: 768px) {
    display: none;
  }
`;

const RightSection = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const ActionButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border: 2px solid transparent;
  border-radius: 0.5rem;
  background: ${props => props.variant === 'primary' ? '#3b82f6' : '#f3f4f6'};
  color: ${props => props.variant === 'primary' ? 'white' : '#374151'};
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;

  &:hover {
    background: ${props => props.variant === 'primary' ? '#2563eb' : '#e5e7eb'};
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
  
  @media (max-width: 1024px) {
    padding: 0.5rem 0.75rem;
    font-size: 0.8rem;
    
    span {
      display: none;
    }
  }
`;

const Divider = styled.div`
  width: 1px;
  height: 2rem;
  background: #e5e7eb;
  
  @media (max-width: 1024px) {
    display: none;
  }
`;

const FileInput = styled.input`
  display: none;
`;

const DropdownMenu = styled(motion.div)`
  position: absolute;
  top: 100%;
  right: 0;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 0.5rem;
  min-width: 200px;
  z-index: 1000;
`;

const DropdownItem = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border: none;
  background: none;
  color: #374151;
  font-size: 0.875rem;
  cursor: pointer;
  border-radius: 0.375rem;
  transition: background 0.2s ease;

  &:hover {
    background: #f3f4f6;
  }
`;

const MobileMenuButton = styled.button`
  display: none;
  
  @media (max-width: 768px) {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border: 2px solid #e5e7eb;
    border-radius: 0.5rem;
    background: white;
    color: #374151;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
  }
`;

const Header = ({
  documentsCount = 0,
  onLoadSample,
  onClearData,
  onExport,
  onImport,
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

  return (
    <HeaderContainer>
      <LeftSection>
        <Logo>
          <LogoIcon>📚</LogoIcon>
          <span>Tech Archive</span>
        </Logo>
        
        <StatsSection>
          <StatItem>
            📄 {documentsCount}개 문서
          </StatItem>
        </StatsSection>
      </LeftSection>

      <CenterSection>
        <ActionButton onClick={onLoadSample}>
          <span>📊</span>
          <span>샘플 로드</span>
        </ActionButton>
        
        <Divider />
        
        <ActionButton onClick={handleExport} disabled={documentsCount === 0}>
          <span>📤</span>
          <span>내보내기</span>
        </ActionButton>
        
        <ActionButton onClick={handleImportClick}>
          <span>📥</span>
          <span>가져오기</span>
        </ActionButton>
      </CenterSection>

      <RightSection>
        <div style={{ position: 'relative' }}>
          <ActionButton 
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            variant={showMoreMenu ? 'primary' : 'default'}
          >
            <span>⚙️</span>
            <span>더보기</span>
          </ActionButton>
          
          {showMoreMenu && (
            <DropdownMenu
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <DropdownItem onClick={handleExport} disabled={documentsCount === 0}>
                <span>📤</span>
                <span>데이터 내보내기</span>
              </DropdownItem>
              <DropdownItem onClick={handleImportClick}>
                <span>📥</span>
                <span>데이터 가져오기</span>
              </DropdownItem>
              <DropdownItem onClick={onLoadSample}>
                <span>📊</span>
                <span>샘플 데이터 로드</span>
              </DropdownItem>
              <DropdownItem 
                onClick={handleClearData}
                style={{ color: '#ef4444' }}
                disabled={documentsCount === 0}
              >
                <span>🗑️</span>
                <span>모든 데이터 삭제</span>
              </DropdownItem>
            </DropdownMenu>
          )}
        </div>
        
        <MobileMenuButton>
          <span>☰</span>
          <span>메뉴</span>
        </MobileMenuButton>
      </RightSection>

      <FileInput
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
      />
    </HeaderContainer>
  );
};

export default Header;
