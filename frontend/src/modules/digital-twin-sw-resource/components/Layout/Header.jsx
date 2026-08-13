import React from 'react';
import { Cpu, Plus, FileSpreadsheet, Table2, BarChart3 } from 'lucide-react';
import styled from 'styled-components';
import CommonHeader from '../../../../shared/components/Header/CommonHeader';

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
  background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(14, 165, 233, 0.3);
  }
`;

const BulkButton = styled(AddButton)`
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);

  &:hover {
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
  }
`;

const Header = ({ onGoHome, onAdd, onBulkAdd, viewMode, onViewModeChange }) => {
  const viewToggle = (
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
          className={`toggle-btn ${viewMode === 'dashboard' ? 'active' : ''}`}
          onClick={() => onViewModeChange('dashboard')}
          title="대시보드 보기"
        >
          <BarChart3 size={16} strokeWidth={2} />
          <span>대시보드</span>
        </button>
      </div>
    </div>
  );

  return (
    <CommonHeader
      logo={<Cpu size={24} strokeWidth={2} />}
      title="전사 디지털 트윈 S/W 자원 정보"
      titleColor="#0ea5e9"
      onGoHome={onGoHome}
      showStats={false}
      className="digital-twin-sw-resource-header"
      centerContent={
        <ButtonGroup>
          <AddButton onClick={onAdd}>
            <Plus size={16} />
            S/W 등록
          </AddButton>
          <BulkButton onClick={onBulkAdd}>
            <FileSpreadsheet size={16} />
            S/W 일괄 등록
          </BulkButton>
        </ButtonGroup>
      }
      rightContent={viewToggle}
    />
  );
};

export default Header;
