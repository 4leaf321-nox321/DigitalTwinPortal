import React from 'react';
import styled from 'styled-components';

const ConnectionLine = styled.svg`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 100;
  
  path[cursor="pointer"] {
    pointer-events: all;
  }
`;

const ConnectionDeleteButton = styled.div`
  position: absolute;
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
  z-index: 1700;
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

const ConnectionRenderer = ({ 
  connections = [], 
  processes = [], 
  cellId,
  selectedConnection,
  globalConnecting,
  onConnectionClick,
  onDeleteConnection 
}) => {
  // 프로세스 박스의 실제 DOM 크기를 기반으로 edge 연결점 계산
  const getProcessEdgePoint = (processId, targetProcessId) => {
    const process = processes.find(p => p.id === processId);
    const targetProcess = processes.find(p => p.id === targetProcessId);
    if (!process || !targetProcess) return { x: 0, y: 0 };
    
    // 프로세스 박스의 실제 DOM 요소 찾기
    const processElement = document.querySelector(`[data-process-id="${processId}"]`);
    const targetElement = document.querySelector(`[data-process-id="${targetProcessId}"]`);
    
    let boxWidth = 280;
    let boxHeight = 120;
    let targetBoxWidth = 280;
    let targetBoxHeight = 120;
    
    // 실제 DOM 요소가 있으면 실제 크기 사용
    if (processElement) {
      const rect = processElement.getBoundingClientRect();
      boxWidth = rect.width;
      boxHeight = rect.height;
    }
    
    if (targetElement) {
      const rect = targetElement.getBoundingClientRect();
      targetBoxWidth = rect.width;
      targetBoxHeight = rect.height;
    }
    
    // 박스의 실제 중심점
    const centerX = process.x + boxWidth / 2;
    const centerY = process.y + boxHeight / 2;
    const targetCenterX = targetProcess.x + targetBoxWidth / 2;
    const targetCenterY = targetProcess.y + targetBoxHeight / 2;
    
    const dx = targetCenterX - centerX;
    const dy = targetCenterY - centerY;
    
    const halfWidth = boxWidth / 2;
    const halfHeight = boxHeight / 2;
    
    let edgeX, edgeY;
    
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) {
        edgeX = centerX + halfWidth;
        edgeY = centerY;
      } else {
        edgeX = centerX - halfWidth;
        edgeY = centerY;
      }
    } else {
      if (dy > 0) {
        edgeX = centerX;
        edgeY = centerY + halfHeight;
      } else {
        edgeX = centerX;
        edgeY = centerY - halfHeight;
      }
    }
    
    return { x: edgeX, y: edgeY };
  };

  // 연결선 중점 계산
  const getConnectionMidPoint = (connection) => {
    const fromPos = getProcessEdgePoint(connection.from, connection.to);
    const toPos = getProcessEdgePoint(connection.to, connection.from);
    
    if (!fromPos || !toPos) return null;
    
    return {
      x: (fromPos.x + toPos.x) / 2,
      y: (fromPos.y + toPos.y) / 2
    };
  };

  // 연결선 렌더링
  const renderConnections = () => {
    return connections.map(conn => {
      // 글로벌 연결은 건너뜀 (다른 곳에서 처리)
      if (conn.targetCell) {
        return null;
      }
      
      const fromPos = getProcessEdgePoint(conn.from, conn.to);
      const toPos = getProcessEdgePoint(conn.to, conn.from);
      
      if (!fromPos || !toPos) return null;
      
      const fromProcess = processes.find(p => p.id === conn.from);
      const toProcess = processes.find(p => p.id === conn.to);
      if (!fromProcess || !toProcess) return null;
      
      // 실제 DOM 요소에서 크기 얻기
      const fromElement = document.querySelector(`[data-process-id="${conn.from}"]`);
      const toElement = document.querySelector(`[data-process-id="${conn.to}"]`);
      
      let fromBoxWidth = 280, fromBoxHeight = 120;
      let toBoxWidth = 280, toBoxHeight = 120;
      
      if (fromElement) {
        const rect = fromElement.getBoundingClientRect();
        fromBoxWidth = rect.width;
        fromBoxHeight = rect.height;
      }
      
      if (toElement) {
        const rect = toElement.getBoundingClientRect();
        toBoxWidth = rect.width;
        toBoxHeight = rect.height;
      }
      
      // 실제 크기에 맞는 중심점 계산
      const fromCenterX = fromProcess.x + fromBoxWidth / 2;
      const fromCenterY = fromProcess.y + fromBoxHeight / 2;
      const toCenterX = toProcess.x + toBoxWidth / 2;
      const toCenterY = toProcess.y + toBoxHeight / 2;
      const dx = toCenterX - fromCenterX;
      const dy = toCenterY - fromCenterY;
      
      const orthogonalDistance = 30;
      
      let pathData;
      let arrowAngle;
      
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) {
          const fromExtend = fromPos.x + orthogonalDistance;
          const toExtend = toPos.x - orthogonalDistance;
          pathData = `M ${fromPos.x} ${fromPos.y} L ${fromExtend} ${fromPos.y} L ${fromExtend} ${toPos.y} L ${toPos.x} ${toPos.y}`;
          arrowAngle = 0;
        } else {
          const fromExtend = fromPos.x - orthogonalDistance;
          const toExtend = toPos.x + orthogonalDistance;
          pathData = `M ${fromPos.x} ${fromPos.y} L ${fromExtend} ${fromPos.y} L ${fromExtend} ${toPos.y} L ${toPos.x} ${toPos.y}`;
          arrowAngle = 180;
        }
      } else {
        if (dy > 0) {
          const fromExtend = fromPos.y + orthogonalDistance;
          const toExtend = toPos.y - orthogonalDistance;
          pathData = `M ${fromPos.x} ${fromPos.y} L ${fromPos.x} ${fromExtend} L ${toPos.x} ${fromExtend} L ${toPos.x} ${toPos.y}`;
          arrowAngle = 90;
        } else {
          const fromExtend = fromPos.y - orthogonalDistance;
          const toExtend = toPos.y + orthogonalDistance;
          pathData = `M ${fromPos.x} ${fromPos.y} L ${fromPos.x} ${fromExtend} L ${toPos.x} ${fromExtend} L ${toPos.x} ${toPos.y}`;
          arrowAngle = -90;
        }
      }

      const isSelected = selectedConnection === conn.id;
      const strokeColor = isSelected ? '#dc2626' : '#6366f1';
      const strokeWidth = isSelected ? '4' : '3';
      
      return (
        <g key={conn.id}>
          <path
            d={pathData}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            fill="none"
            markerEnd={`url(#arrowhead-${cellId}-${conn.id})`}
            style={{ filter: isSelected ? 'drop-shadow(0 0 6px rgba(220, 38, 38, 0.6))' : 'none' }}
          />
          <path
            d={pathData}
            stroke="transparent"
            strokeWidth="15"
            fill="none"
            cursor="pointer"
            onClick={(e) => onConnectionClick(e, conn.id)}
            onMouseEnter={(e) => {
              const actualLine = e.target.previousElementSibling;
              if (actualLine) {
                actualLine.style.stroke = '#dc2626';
                actualLine.style.strokeWidth = '5';
                actualLine.style.filter = 'drop-shadow(0 0 6px rgba(220, 38, 38, 0.6))';
              }
            }}
            onMouseLeave={(e) => {
              const actualLine = e.target.previousElementSibling;
              if (actualLine && !isSelected) {
                actualLine.style.stroke = '#6366f1';
                actualLine.style.strokeWidth = '3';
                actualLine.style.filter = 'none';
              }
            }}
            title="클릭하여 연결선 선택/삭제 (Delete 키)"
          />
          <defs>
            <marker
              id={`arrowhead-${cellId}-${conn.id}`}
              markerWidth="8"
              markerHeight="6"
              refX="7"
              refY="3"
              orient={arrowAngle}
            >
              <polygon
                points="0 0, 8 3, 0 6"
                fill={strokeColor}
              />
            </marker>
          </defs>
        </g>
      );
    }).filter(Boolean);
  };

  // 선택된 연결선의 삭제 버튼
  const renderDeleteButton = () => {
    if (!selectedConnection || globalConnecting) return null;
    
    const selectedConn = connections.find(c => c.id === selectedConnection);
    if (!selectedConn) return null;
    
    const midPoint = getConnectionMidPoint(selectedConn);
    if (!midPoint) return null;
    
    return (
      <ConnectionDeleteButton
        visible={true}
        style={{
          left: midPoint.x - 12,
          top: midPoint.y - 12
        }}
        onClick={() => onDeleteConnection(selectedConnection)}
        title="연결선 삭제 (또는 Delete 키)"
      >
        ×
      </ConnectionDeleteButton>
    );
  };

  return (
    <>
      <ConnectionLine>
        {renderConnections()}
      </ConnectionLine>
      {renderDeleteButton()}
    </>
  );
};

export default ConnectionRenderer;
