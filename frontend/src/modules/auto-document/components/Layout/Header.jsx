import React from 'react';
import styled from 'styled-components';
import { FileText } from 'lucide-react';
import { CommonHeader } from '../../../../shared/components/Header';

const ToggleWrapper = styled.div`
  display: flex;
  background: #f1f5f9;
  border-radius: 8px;
  padding: 3px;
`;

const ToggleButton = styled.button`
  padding: 0.375rem 1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: ${p => p.$active ? 600 : 400};
  color: ${p => p.$active ? '#fff' : '#64748b'};
  background: ${p => p.$active ? '#8b5cf6' : 'transparent'};
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;

  &:hover {
    color: ${p => p.$active ? '#fff' : '#334155'};
  }
`;

const MODES = [
  { id: 'single', label: '단일 보고서 작성' },
  { id: 'stats', label: '통계 보고서 작성' },
];

const Header = ({ onGoHome, mode, onModeChange }) => {
  return (
    <CommonHeader
      logo={<FileText size={24} strokeWidth={2} />}
      title="문서 자동 작성"
      titleColor="#8b5cf6"
      onGoHome={onGoHome}
      showStats={false}
      className="auto-document-header"
      centerContent={
        <ToggleWrapper>
          {MODES.map(m => (
            <ToggleButton
              key={m.id}
              $active={mode === m.id}
              onClick={() => onModeChange(m.id)}
            >
              {m.label}
            </ToggleButton>
          ))}
        </ToggleWrapper>
      }
    />
  );
};

export default Header;
