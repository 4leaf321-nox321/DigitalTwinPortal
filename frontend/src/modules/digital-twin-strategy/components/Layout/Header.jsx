import React from 'react';
import { Compass, Settings, ClipboardList, ExternalLink } from 'lucide-react';
import styled from 'styled-components';
import CommonHeader from '../../../../shared/components/Header/CommonHeader';

const Buttons = styled.div`
  display: flex;
  gap: 0.5rem;
`;

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

const Header = ({ onGoHome, onOpenSettings, onOpenSurveys }) => {
  return (
    <CommonHeader
      logo={<Compass size={24} strokeWidth={2} />}
      title="디지털 트윈 전략 기획"
      titleColor="#7c3aed"
      onGoHome={onGoHome}
      showStats={false}
      className="digital-twin-strategy-header"
      centerContent={
        <Buttons>
          {/* 설문은 독립 모듈이다. 여기서는 만들지 않고 **넘어가기만** 한다 —
              지금 보고 있는 전략을 context 로 달아 보내므로, 저쪽에서 그
              전략의 설문만 걸러 보인다. */}
          <SettingsButton onClick={onOpenSurveys} title="이 전략의 설문으로 이동합니다">
            <ClipboardList size={16} />
            설문
            <ExternalLink size={13} style={{ opacity: 0.6 }} />
          </SettingsButton>
          <SettingsButton onClick={onOpenSettings} title="진단 임계값을 조정합니다">
            <Settings size={16} />
            설정
          </SettingsButton>
        </Buttons>
      }
    />
  );
};

export default Header;
