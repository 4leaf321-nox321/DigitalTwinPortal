import React from 'react';
import styled from 'styled-components';
import { Coins, Plus, FileSpreadsheet, History, Settings, Table2, LayoutGrid } from 'lucide-react';
import { CommonHeader } from '../../../../shared/components/Header';

const ButtonGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const AddButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.4rem 0.875rem;
  background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
  }
`;

// 강조색이 인디고라 보라색은 옆에 두면 구분이 안 된다. 청록으로 갈라 둔다.
const BulkButton = styled(AddButton)`
  background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%);

  &:hover {
    box-shadow: 0 4px 12px rgba(20, 184, 166, 0.3);
  }
`;

// 공용 헤더에도 .view-toggle 이 있지만 파란색이 박혀 있어 이 모듈의 인디고와 부딪친다.
// 모양만 같게 두고 색은 여기서 따로 잡는다.
const ViewToggle = styled.div`
  display: flex;
  gap: 2px;
  padding: 3px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
`;

const ToggleButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.6rem;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  background: ${props => (props.$active ? '#4f46e5' : 'transparent')};
  color: ${props => (props.$active ? 'white' : '#64748b')};

  &:hover {
    background: ${props => (props.$active ? '#4338ca' : '#e2e8f0')};
    color: ${props => (props.$active ? 'white' : '#334155')};
  }
`;

const RightGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const SettingsButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.4rem 0.75rem;
  background: white;
  color: #64748b;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover { border-color: #4f46e5; color: #4338ca; background: #eef2ff; }
`;

const Header = ({ onGoHome, onAdd, onBulkAdd, onOpenSettings, onOpenHistory, viewMode, onViewModeChange }) => {
  return (
    <CommonHeader
      logo={<Coins size={24} strokeWidth={2} />}
      title="디지털 트윈 투자 현황"
      titleColor="#4f46e5"
      onGoHome={onGoHome}
      showStats={false}
      className="digital-twin-investment-header"
      centerContent={
        <ButtonGroup>
          <AddButton onClick={onAdd}>
            <Plus size={16} />
            투자 등록
          </AddButton>
          <BulkButton onClick={onBulkAdd}>
            <FileSpreadsheet size={16} />
            투자 일괄 등록
          </BulkButton>
        </ButtonGroup>
      }
      rightContent={
        <RightGroup>
          <ViewToggle>
            <ToggleButton
              $active={viewMode === 'table'}
              onClick={() => onViewModeChange('table')}
              title="목록으로 보기"
            >
              <Table2 size={15} />
              목록
            </ToggleButton>
            <ToggleButton
              $active={viewMode === 'pivot'}
              onClick={() => onViewModeChange('pivot')}
              title="연도별 피벗으로 보기"
            >
              <LayoutGrid size={15} />
              피벗
            </ToggleButton>
          </ViewToggle>

          <SettingsButton onClick={onOpenHistory} title="지워진 건까지 포함한 전체 변경 이력">
            <History size={16} />
            변경 이력
          </SettingsButton>

          <SettingsButton onClick={onOpenSettings} title="디지털 트윈 영역 목록 관리">
            <Settings size={16} />
            설정
          </SettingsButton>
        </RightGroup>
      }
    />
  );
};

export default Header;
