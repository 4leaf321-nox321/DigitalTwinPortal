import React from 'react';
import { Compass, Settings } from 'lucide-react';
import styled from 'styled-components';
import CommonHeader from '../../../../shared/components/Header/CommonHeader';

const SettingsButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.4rem 0.875rem;
  background: white;
  color: #475569;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: #7c3aed;
    color: #7c3aed;
  }
`;

const Header = ({ onGoHome, onOpenSettings }) => {
  return (
    <CommonHeader
      logo={<Compass size={24} strokeWidth={2} />}
      title="디지털 트윈 전략 기획"
      titleColor="#7c3aed"
      onGoHome={onGoHome}
      showStats={false}
      className="digital-twin-strategy-header"
      centerContent={
        <SettingsButton onClick={onOpenSettings} title="진단 임계값을 조정합니다">
          <Settings size={16} />
          설정
        </SettingsButton>
      }
    />
  );
};

export default Header;
