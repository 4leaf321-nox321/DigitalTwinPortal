import React from 'react';
import styled from 'styled-components';
import { Cog, Plus, FolderPlus, Minus, GitBranch, Cloud, RotateCcw, Trash2, Table, Edit3 } from 'lucide-react';
import { CommonHeader } from '../../../../shared/components/Header';

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;

  @media (max-width: 1400px) {
    gap: 4px;
  }
`;

const ActionButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: ${props => props.primary ? '#3b82f6' : 'white'};
  color: ${props => props.primary ? 'white' : '#374151'};
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.primary ? '#2563eb' : '#f1f5f9'};
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

const Divider = styled.div`
  width: 1px;
  height: 24px;
  background: #e2e8f0;
  margin: 0 4px;

  @media (max-width: 1200px) {
    display: none;
  }
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

const Header = ({ onGoHome, onAddNode, onBulkAddNodes, onBulkEditData, onAddGroup, onAddDivider, onAddArrow, onOpenSettings, onServerSync, onLoadSample, onClear }) => {
  return (
    <CommonHeader
      logo={<Cog size={24} strokeWidth={2} />}
      title="데이터/프로세스 가시화"
      titleColor="#f59e0b"
      onGoHome={onGoHome}
      showStats={false}
      className="dev-manufacturing-process-header"
      centerContent={
        <HeaderActions>
          <ActionButton onClick={onAddNode} title="노드 추가">
            <Plus size={16} />
            <span>노드 추가</span>
          </ActionButton>
          <ActionButton onClick={onBulkAddNodes} title="여러 노드 추가">
            <Table size={16} />
            <span>여러 노드 추가</span>
          </ActionButton>
          <ActionButton onClick={onBulkEditData} title="여러 데이터 일괄 수정">
            <Edit3 size={16} />
            <span>일괄 수정</span>
          </ActionButton>
          <ActionButton onClick={onAddGroup} title="그룹 추가">
            <FolderPlus size={16} />
            <span>그룹 추가</span>
          </ActionButton>
          <Divider />
          <ActionButton onClick={() => onAddDivider?.('horizontal')} title="가로선">
            <Minus size={16} />
            <span>가로선</span>
          </ActionButton>
          <ActionButton onClick={() => onAddDivider?.('vertical')} title="세로선">
            <Minus size={16} style={{ transform: 'rotate(90deg)' }} />
            <span>세로선</span>
          </ActionButton>
          <Divider />
          <ActionButton onClick={onAddArrow} title="화살표">
            <GitBranch size={16} />
            <span>화살표</span>
          </ActionButton>
          <Divider />
          <ActionButton onClick={onServerSync} primary title="저장/불러오기">
            <Cloud size={16} />
            <span>저장/불러오기</span>
          </ActionButton>
          <Divider />
          <ActionButton onClick={onLoadSample} title="샘플">
            <RotateCcw size={16} />
            <span>샘플</span>
          </ActionButton>
          <ActionButton onClick={onClear} title="초기화">
            <Trash2 size={16} />
            <span>초기화</span>
          </ActionButton>
          <Divider />
          <SettingsButton onClick={onOpenSettings} title="설정">
            <Cog size={16} />
            <span>설정</span>
          </SettingsButton>
        </HeaderActions>
      }
    />
  );
};

export default Header;
