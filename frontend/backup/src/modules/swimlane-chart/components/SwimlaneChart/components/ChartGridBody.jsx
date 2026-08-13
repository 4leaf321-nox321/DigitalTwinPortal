import React from 'react';
import styled from 'styled-components';
import { Edit3, Trash2 } from 'lucide-react';
import ProcessCell from '../../ProcessCell/ProcessCell';

const GridBody = styled.div`
  display: grid;
  grid-template-columns: ${props => props.gridTemplateColumns};
  gap: 1px;
  background-color: #e5e7eb;
  border-radius: 0 0 8px 8px;
`;

const StepCell = styled.div`
  background: #f3f4f6;
  padding: 16px 12px;
  text-align: center;
  font-weight: 600;
  font-size: 14px;
  color: #374151;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: ${props => props.height || 120}px;
  border-left: 4px solid #6366f1;
  position: relative;
  
  .step-name {
    flex: 1;
  }
  
  .step-actions {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  
  &:hover .step-actions {
    opacity: 1;
  }
  
  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 10%;
    right: 10%;
    height: 4px;
    background: rgba(16, 185, 129, 0.4);
    cursor: row-resize;
    z-index: 10;
    border-radius: 2px;
  }
  
  &:hover::after {
    background: rgba(16, 185, 129, 0.8);
  }
`;

const ProcessCellContainer = styled.div`
  background: white;
  min-height: ${props => props.height || 120}px;
  border: 1px solid #e5e7eb;
  position: relative;
  cursor: ${props => props.isConnecting ? 'crosshair' : 'default'};
  overflow: hidden;
  
  &:hover {
    border-color: #6366f1;
    box-shadow: 0 2px 4px rgba(99, 102, 241, 0.1);
  }
  
  /* 행 리사이징 핸들 추가 */
  &::after {
    content: '';
    position: absolute;
    bottom: -2px;
    left: 0;
    right: 0;
    height: 6px;
    background: rgba(16, 185, 129, 0.4);
    cursor: row-resize;
    z-index: 20;
    border-radius: 0 0 2px 2px;
    transition: background-color 0.2s ease;
  }
  
  &:hover::after {
    background: rgba(16, 185, 129, 0.8);
  }
`;

const ActionButton = styled.button`
  padding: 4px;
  border: none;
  background: none;
  color: #6b7280;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  
  &:hover {
    background: #e5e7eb;
    color: #374151;
  }
  
  &.delete:hover {
    color: #dc2626;
    background: #fee2e2;
  }
`;

const ChartGridBody = ({ 
  gridTemplateColumns,
  steps,
  organizations,
  getRowHeight,
  getCellData,
  getCellRef,
  globalConnecting,
  connectingFrom,
  cellData,
  cellRefs,
  onEditStep,
  onDeleteStep,
  onMouseDown,
  onAddProcess,
  onUpdateProcess,
  onDeleteProcess,
  onUpdateConnections,
  onUpdateCellData,
  onStartConnection,
  onStartGlobalConnection,
  onEndConnection,
  onCancelConnection,
  onRequestAddProcess,
  onRequestEditProcess,
  onModalStateChange
}) => {
  return (
    <GridBody gridTemplateColumns={gridTemplateColumns}>
      {steps.map(step => (
        <React.Fragment key={step.id}>
          <StepCell height={getRowHeight(step.id)}>
            <div className="step-name">{step.name}</div>
            <div className="step-actions">
              <ActionButton 
                onClick={(e) => onEditStep(e, step.id)}
                title="편집"
              >
                <Edit3 size={14} />
              </ActionButton>
              <ActionButton 
                className="delete"
                onClick={(e) => onDeleteStep(e, step.id)}
                title="삭제"
              >
                <Trash2 size={14} />
              </ActionButton>
            </div>
            <div
              style={{
                position: 'absolute',
                bottom: '-2px',
                left: 0,
                right: 0,
                height: '6px',
                background: 'rgba(16, 185, 129, 0.4)',
                cursor: 'row-resize',
                zIndex: 20,
                borderRadius: '0 0 2px 2px',
                transition: 'background-color 0.2s ease'
              }}
              onMouseDown={(e) => onMouseDown(e, 'row', step.id)}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(16, 185, 129, 0.8)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(16, 185, 129, 0.4)';
              }}
              title={`${step.name} 행 크기 조정`}
            />
          </StepCell>
          
          {organizations.map(org => {
            const cellId = `${step.id}-${org.id}`;
            const data = getCellData(step.id, org.id);
            const cellRef = getCellRef(cellId);
            
            return (
              <ProcessCellContainer 
                key={cellId}
                ref={cellRef}
                height={getRowHeight(step.id)}
                onMouseDown={(e) => {
                  // ProcessCell의 드래그와 충돌하지 않도록 바닥 영역에서만 행 리사이징
                  const rect = e.currentTarget.getBoundingClientRect();
                  const isBottomArea = e.clientY > rect.bottom - 10;
                  if (isBottomArea) {
                    onMouseDown(e, 'row', step.id);
                  }
                }}
              >
                <ProcessCell
                  cellId={cellId}
                  processes={data.processes}
                  connections={data.connections}
                  containerRef={cellRef}
                  globalConnecting={globalConnecting}
                  connectingFrom={connectingFrom}
                  onAddProcess={onAddProcess}
                  onUpdateProcess={onUpdateProcess}
                  onDeleteProcess={onDeleteProcess}
                  onUpdateConnections={onUpdateConnections}
                  onUpdateCellData={onUpdateCellData}
                  onStartConnection={onStartConnection}
                  onStartGlobalConnection={onStartGlobalConnection}
                  onEndConnection={onEndConnection}
                  onCancelConnection={onCancelConnection}
                  allCellData={cellData} // 다른 셀의 프로세스 정보 접근용
                  cellRefs={cellRefs} // 다른 셀의 DOM 요소 접근용
                  onRequestAddProcess={onRequestAddProcess}
                  onRequestEditProcess={onRequestEditProcess}
                  onModalStateChange={onModalStateChange}
                />
              </ProcessCellContainer>
            );
          })}
        </React.Fragment>
      ))}
    </GridBody>
  );
};

export default ChartGridBody;
