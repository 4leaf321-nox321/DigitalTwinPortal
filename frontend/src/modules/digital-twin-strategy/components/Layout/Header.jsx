import React from 'react';
import { Compass, Settings, ClipboardList } from 'lucide-react';
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
  background: ${p => (p.$active ? '#f5f3ff' : 'white')};
  color: ${p => (p.$active ? '#7c3aed' : '#475569')};
  border: 1px solid ${p => (p.$active ? '#c4b5fd' : '#e2e8f0')};
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

const Header = ({ onGoHome, onOpenSettings, onOpenSurveys, surveyActive }) => {
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
          {/* 설문은 단계가 아니라 모든 단계를 가로지르는 근거 원천이라
              ①~⑤ 탭이 아니라 여기에 둔다. */}
          <SettingsButton
            onClick={onOpenSurveys}
            $active={surveyActive}
            title="설문을 만들고 집계를 봅니다"
          >
            <ClipboardList size={16} />
            설문
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
