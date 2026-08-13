import React from 'react';
import styled from 'styled-components';
import { Edit3, Trash2 } from 'lucide-react';

const GridHeader = styled.div`
  display: grid;
  grid-template-columns: ${props => props.gridTemplateColumns};
  gap: 1px;
  margin-bottom: 1px;
  background-color: #e5e7eb;
  border-radius: 8px 8px 0 0;
`;

const HeaderCell = styled.div`
  background: #374151;
  color: white;
  padding: 16px 12px;
  text-align: center;
  font-weight: 600;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 60px;
  position: relative;
  
  &:first-child {
    background: #1f2937;
    border-radius: 8px 0 0 0;
    cursor: col-resize;
    
    &::after {
      content: '';
      position: absolute;
      right: 0;
      top: 10%;
      bottom: 10%;
      width: 4px;
      background: rgba(59, 130, 246, 0.4);
      cursor: col-resize;
      z-index: 10;
      border-radius: 2px;
    }
    
    &:hover::after {
      background: rgba(59, 130, 246, 0.8);
    }
  }
  
  &:last-child {
    border-radius: 0 8px 0 0;
  }
  
  &:not(:first-child)::after {
    content: '';
    position: absolute;
    right: 0;
    top: 10%;
    bottom: 10%;
    width: 4px;
    background: rgba(99, 102, 241, 0.4);
    cursor: col-resize;
    z-index: 10;
    border-radius: 2px;
  }
  
  &:not(:first-child):hover::after {
    background: rgba(99, 102, 241, 0.8);
  }
  
  .org-name {
    flex: 1;
    text-align: center;
  }
  
  .org-actions {
    display: flex;
    gap: 2px;
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  
  &:not(:first-child):hover .org-actions {
    opacity: 1;
  }
`;

const ActionButton = styled.button`
  padding: 4px;
  border: none;
  background: none;
  color: #9ca3af;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  font-size: 12px;
  min-width: 24px;
  min-height: 24px;
  
  &:hover {
    background: rgba(55, 65, 81, 0.8);
    color: white;
  }
  
  &.delete:hover {
    color: #fca5a5;
    background: rgba(220, 38, 38, 0.2);
  }
  
  &.move:hover {
    color: #93c5fd;
    background: rgba(59, 130, 246, 0.2);
  }
  
  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  
  &:disabled:hover {
    background: none;
    color: #9ca3af;
  }
`;

const ChartGridHeader = ({ 
  gridTemplateColumns, 
  stepColumnWidth, 
  organizations, 
  onMouseDown,
  onEditOrganization,
  onDeleteOrganization,
  onMoveOrganizationLeft,
  onMoveOrganizationRight
}) => {
  return (
    <GridHeader gridTemplateColumns={gridTemplateColumns}>
      <HeaderCell 
        onMouseDown={(e) => onMouseDown(e, 'stepColumn', 'step')}
        style={{ position: 'relative' }}
      >
        <div
          style={{
            position: 'absolute',
            right: '-2px',
            top: 0,
            bottom: 0,
            width: '6px',
            background: 'rgba(59, 130, 246, 0.4)',
            cursor: 'col-resize',
            zIndex: 20,
            borderRadius: '0 2px 2px 0',
            transition: 'background-color 0.2s ease'
          }}
          onMouseDown={(e) => onMouseDown(e, 'stepColumn', 'step')}
          onMouseEnter={(e) => {
            e.target.style.background = 'rgba(59, 130, 246, 0.8)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'rgba(59, 130, 246, 0.4)';
          }}
          title="단계 열 크기 조정"
        />
      </HeaderCell>
      {organizations.map((org, index) => (
        <HeaderCell 
          key={org.id}
        >
          <div className="org-name">{org.name}</div>
          <div className="org-actions">
            <ActionButton 
              className="move"
              onClick={(e) => {
                e.stopPropagation();
                onMoveOrganizationLeft?.(org.id);
              }}
              disabled={index === 0}
              title={index === 0 ? "첫 번째 조직입니다" : "왼쪽으로 이동"}
            >
              ◀
            </ActionButton>
            <ActionButton 
              className="move"
              onClick={(e) => {
                e.stopPropagation();
                onMoveOrganizationRight?.(org.id);
              }}
              disabled={index === organizations.length - 1}
              title={index === organizations.length - 1 ? "마지막 조직입니다" : "오른쪽으로 이동"}
            >
              ▶
            </ActionButton>
            <ActionButton 
              onClick={(e) => {
                e.stopPropagation();
                onEditOrganization?.(org.id);
              }}
              title="편집"
            >
              <Edit3 size={12} />
            </ActionButton>
            <ActionButton 
              className="delete"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteOrganization?.(org.id);
              }}
              title="삭제"
            >
              <Trash2 size={12} />
            </ActionButton>
          </div>
          <div
            style={{
              position: 'absolute',
              right: '-2px',
              top: 0,
              bottom: 0,
              width: '6px',
              background: 'rgba(99, 102, 241, 0.4)',
              cursor: 'col-resize',
              zIndex: 20,
              borderRadius: '0 2px 2px 0',
              transition: 'background-color 0.2s ease'
            }}
            onMouseDown={(e) => onMouseDown(e, 'column', org.id)}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(99, 102, 241, 0.8)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(99, 102, 241, 0.4)';
            }}
            title={`${org.name} 열 크기 조정`}
          />
        </HeaderCell>
      ))}
    </GridHeader>
  );
};

export default ChartGridHeader;