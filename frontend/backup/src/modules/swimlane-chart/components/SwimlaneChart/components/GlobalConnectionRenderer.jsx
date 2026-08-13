import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import styled from 'styled-components';
import { getGlobalProcessEdgePoint, calculateGlobalConnectionPath } from '../utils/connectionUtils';

// 로컬 버튼과 완전히 동일한 스타일
const UnifiedConnectionDeleteButton = styled.div`
  position: ${props => props.portal ? 'fixed' : 'absolute'};
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 50%;
  background: #ef4444;
  color: white;
  cursor: pointer;
  display: ${props => props.visible ? 'flex' : 'none'};
  align-items: center;
  justify-content: center;
  z-index: ${props => props.portal ? 9999 : 1700}; // 포털일 때는 최상위, 아닐 때는 프로세스 셀보다 높게
  font-size: 14px;
  font-weight: bold;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  user-select: none;
  font-family: Arial, sans-serif;
  line-height: 1;
  
  &:hover {
    background: #dc2626;
    transform: scale(1.1);
  }
`;

const GlobalConnectionRenderer = ({ 
  cellData, 
  cellRefs, 
  chartContentRef, 
  onDeleteGlobalConnection 
}) => {
  const [selectedGlobalConnection, setSelectedGlobalConnection] = useState(null); // { fromCellId, connectionId }

  // Delete 키로 선택된 글로벌 연결선 삭제
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Delete' && selectedGlobalConnection) {
        handleDeleteGlobalConnection();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedGlobalConnection]);

  // 글로벌 연결선 선택 핸들러
  const handleGlobalConnectionClick = (e, fromCellId, connectionId) => {
    e.stopPropagation();
    const connectionKey = `${fromCellId}-${connectionId}`;
    const currentKey = selectedGlobalConnection ? `${selectedGlobalConnection.fromCellId}-${selectedGlobalConnection.connectionId}` : null;
    
    if (connectionKey === currentKey) {
      setSelectedGlobalConnection(null); // 선택 해제
    } else {
      setSelectedGlobalConnection({ fromCellId, connectionId }); // 새로 선택
    }
  };

  // 글로벌 연결선 삭제 실행
  const handleDeleteGlobalConnection = () => {
    if (selectedGlobalConnection) {
      onDeleteGlobalConnection(selectedGlobalConnection.fromCellId, selectedGlobalConnection.connectionId);
      setSelectedGlobalConnection(null);
    }
  };

  // X 버튼 클릭 핸들러
  const handleDeleteButtonClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleDeleteGlobalConnection();
  };

  // 글로벌 연결선 중점 계산 (삭제 버튼 위치용)
  const getGlobalConnectionMidPoint = (fromEdge, toEdge) => {
    return {
      x: (fromEdge.x + toEdge.x) / 2,
      y: (fromEdge.y + toEdge.y) / 2
    };
  };

  // 글로벌 연결선 렌더링
  const renderGlobalConnections = () => {
    const globalConnections = [];
    
    // 모든 셀에서 다른 셀로의 연결만 찾기
    Object.entries(cellData).forEach(([fromCellId, data]) => {
      if (data.connections) {
        data.connections.forEach(conn => {
          if (conn.targetCell) {
            // 다른 셀로의 연결을 전역 레이어에 생성
            const edgePoints = getGlobalProcessEdgePoint(
              fromCellId, 
              conn.from, 
              conn.targetCell, 
              conn.to,
              cellData,
              cellRefs,
              chartContentRef
            );
            
            if (edgePoints) {
              const { from: fromEdge, to: toEdge, fromDirection, toDirection } = edgePoints;
              
              // 글로벌 연결선 경로와 화살표 각도 계산 - 새로운 파라미터들 사용
              const { pathData, arrowAngle } = calculateGlobalConnectionPath(
                fromEdge, 
                toEdge, 
                edgePoints.edgeDirection, // 하위 호환성을 위해 유지 (실제로는 toDirection 사용)
                fromDirection,
                toDirection
              );
              
              const isSelected = selectedGlobalConnection && 
                selectedGlobalConnection.fromCellId === fromCellId && 
                selectedGlobalConnection.connectionId === conn.id;
              
              const strokeColor = isSelected ? '#dc2626' : '#ef4444';
              const strokeWidth = isSelected ? '4' : '3';
              
              globalConnections.push(
                <g key={`${fromCellId}-${conn.id}`}>
                  <path
                    d={pathData}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray="8,4"
                    fill="none"
                    markerEnd={`url(#global-arrowhead-${fromCellId}-${conn.id})`}
                    style={{ filter: isSelected ? 'drop-shadow(0 0 6px rgba(220, 38, 38, 0.6))' : 'none' }}
                  />
                  {/* 삭제 가능한 투명한 굵은 선 */}
                  <path
                    d={pathData}
                    stroke="transparent"
                    strokeWidth="15"
                    fill="none"
                    cursor="pointer"
                    onClick={(e) => handleGlobalConnectionClick(e, fromCellId, conn.id)}
                    onMouseEnter={(e) => {
                      // 호버 시 연결선 강조
                      const actualLine = e.target.previousElementSibling;
                      if (actualLine && !isSelected) {
                        actualLine.style.stroke = '#dc2626';
                        actualLine.style.strokeWidth = '5';
                        actualLine.style.filter = 'drop-shadow(0 0 6px rgba(220, 38, 38, 0.6))';
                      }
                    }}
                    onMouseLeave={(e) => {
                      // 호버 해제 시 원래 색상으로 복귀 (선택된 경우 제외)
                      const actualLine = e.target.previousElementSibling;
                      if (actualLine && !isSelected) {
                        actualLine.style.stroke = '#ef4444';
                        actualLine.style.strokeWidth = '3';
                        actualLine.style.filter = 'none';
                      }
                    }}
                    title="클릭하여 글로벌 연결선 선택/삭제 (Delete 키 또는 X 버튼 클릭)"
                  />
                  
                  {/* 로컬 화살표와 완전히 동일한 마커 정의 */}
                  <defs>
                    <marker
                      id={`global-arrowhead-${fromCellId}-${conn.id}`}
                      markerWidth="8"
                      markerHeight="6" 
                      refX="7"
                      refY="3"
                      orient={arrowAngle}
                      markerUnits="strokeWidth"
                    >
                      <polygon
                        points="0 0, 8 3, 0 6"
                        fill={strokeColor}
                      />
                    </marker>
                  </defs>
                </g>
              );
            }
          }
        });
      }
    });
    
    return globalConnections;
  };

  // 선택된 글로벌 연결선의 삭제 버튼 렌더링 (포털 사용, 로컬과 동일한 styled-component)
  const renderSelectedConnectionDeleteButton = () => {
    if (!selectedGlobalConnection || !chartContentRef.current) return null;

    // 선택된 연결선 찾기
    const fromCellData = cellData[selectedGlobalConnection.fromCellId];
    const selectedConn = fromCellData?.connections?.find(c => c.id === selectedGlobalConnection.connectionId);
    
    if (!selectedConn || !selectedConn.targetCell) return null;

    // Edge 포인트 계산
    const edgePoints = getGlobalProcessEdgePoint(
      selectedGlobalConnection.fromCellId,
      selectedConn.from,
      selectedConn.targetCell,
      selectedConn.to,
      cellData,
      cellRefs,
      chartContentRef
    );

    if (!edgePoints) return null;

    const midPoint = getGlobalConnectionMidPoint(edgePoints.from, edgePoints.to);
    const chartRect = chartContentRef.current.getBoundingClientRect();
    
    // 차트 컨테이너 기준 상대 위치를 절대 위치로 변환
    const absoluteX = chartRect.left + midPoint.x;
    const absoluteY = chartRect.top + midPoint.y;

    const deleteButton = (
      <UnifiedConnectionDeleteButton
        portal={true}
        visible={true}
        style={{
          left: absoluteX - 12,
          top: absoluteY - 12
        }}
        onClick={handleDeleteButtonClick}
        onMouseDown={handleDeleteButtonClick}
        title="글로벌 연결선 삭제 (또는 Delete 키)"
      >
        ×
      </UnifiedConnectionDeleteButton>
    );

    // document.body에 포털로 렌더링
    return ReactDOM.createPortal(deleteButton, document.body);
  };

  return (
    <>
      {renderGlobalConnections()}
      {renderSelectedConnectionDeleteButton()}
    </>
  );
};

export default GlobalConnectionRenderer;
