// 프로세스 박스의 edge 연결점 계산 함수 (글로벌 연결용)
export const getGlobalProcessEdgePoint = (fromCellId, fromProcessId, toCellId, toProcessId, cellData, cellRefs, chartContentRef) => {
  const fromCellRef = cellRefs[fromCellId];
  const toCellRef = cellRefs[toCellId];
  const chartRect = chartContentRef.current?.getBoundingClientRect();
  
  if (!fromCellRef?.current || !toCellRef?.current || !chartRect) {
    return null;
  }
  
  const fromData = cellData[fromCellId];
  const toData = cellData[toCellId];
  const fromProcess = fromData?.processes?.find(p => p.id === fromProcessId);
  const toProcess = toData?.processes?.find(p => p.id === toProcessId);
  
  if (!fromProcess || !toProcess) {
    return null;
  }
  
  // 셀 좌표 계산
  const fromCellRect = fromCellRef.current.getBoundingClientRect();
  const toCellRect = toCellRef.current.getBoundingClientRect();
  
  // 실제 DOM 요소에서 크기 얻기 - 글로벌 좌표계를 기준으로 계산해야 하므로 더 복잡
  let fromBoxWidth = 280, fromBoxHeight = 120;
  let toBoxWidth = 280, toBoxHeight = 120;
  
  // From 셀 내에서 해당 프로세스 찾기
  const fromProcessElements = fromCellRef.current.querySelectorAll(`[data-process-id]`);
  const fromElement = Array.from(fromProcessElements).find(
    el => el.getAttribute('data-process-id') === fromProcessId.toString()
  );
  
  // To 셀 내에서 해당 프로세스 찾기
  const toProcessElements = toCellRef.current.querySelectorAll(`[data-process-id]`);
  const toElement = Array.from(toProcessElements).find(
    el => el.getAttribute('data-process-id') === toProcessId.toString()
  );
  
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
  
  // 프로세스 중심점 (차트 기준) - 실제 크기 반영
  const fromCenterX = (fromCellRect.left - chartRect.left) + fromProcess.x + fromBoxWidth / 2;
  const fromCenterY = (fromCellRect.top - chartRect.top) + fromProcess.y + fromBoxHeight / 2;
  const toCenterX = (toCellRect.left - chartRect.left) + toProcess.x + toBoxWidth / 2;
  const toCenterY = (toCellRect.top - chartRect.top) + toProcess.y + toBoxHeight / 2;
  
  // 서로 간의 방향 벡터
  const dx = toCenterX - fromCenterX;
  const dy = toCenterY - fromCenterY;
  
  // 프로세스 박스 크기 - 실제 크기 사용
  const fromHalfWidth = fromBoxWidth / 2;
  const fromHalfHeight = fromBoxHeight / 2;
  const toHalfWidth = toBoxWidth / 2;
  const toHalfHeight = toBoxHeight / 2;
  
  // From edge point 계산
  let fromEdgeX, fromEdgeY, fromDirection;
  if (Math.abs(dx) > Math.abs(dy)) {
    // 수평 연결
    if (dx > 0) {
      fromEdgeX = fromCenterX + fromHalfWidth;  // 오른쪽 edge
      fromEdgeY = fromCenterY;
      fromDirection = 'right';
    } else {
      fromEdgeX = fromCenterX - fromHalfWidth;  // 왼쪽 edge
      fromEdgeY = fromCenterY;
      fromDirection = 'left';
    }
  } else {
    // 수직 연결
    if (dy > 0) {
      fromEdgeX = fromCenterX;
      fromEdgeY = fromCenterY + fromHalfHeight;  // 아래쪽 edge
      fromDirection = 'down';
    } else {
      fromEdgeX = fromCenterX;
      fromEdgeY = fromCenterY - fromHalfHeight;  // 위쪽 edge
      fromDirection = 'up';
    }
  }
  
  // To edge point 계산
  let toEdgeX, toEdgeY, toDirection;
  if (Math.abs(dx) > Math.abs(dy)) {
    // 수평 연결
    if (dx > 0) {
      toEdgeX = toCenterX - toHalfWidth;  // 왼쪽 edge
      toEdgeY = toCenterY;
      toDirection = 'left';
    } else {
      toEdgeX = toCenterX + toHalfWidth;  // 오른쪽 edge
      toEdgeY = toCenterY;
      toDirection = 'right';
    }
  } else {
    // 수직 연결
    if (dy > 0) {
      toEdgeX = toCenterX;
      toEdgeY = toCenterY - toHalfHeight;  // 위쪽 edge
      toDirection = 'top';
    } else {
      toEdgeX = toCenterX;
      toEdgeY = toCenterY + toHalfHeight;  // 아래쪽 edge
      toDirection = 'bottom';
    }
  }
  
  return {
    from: { x: fromEdgeX, y: fromEdgeY },
    to: { x: toEdgeX, y: toEdgeY },
    fromDirection: fromDirection,
    toDirection: toDirection
  };
};

// 연결선 경로와 화살표 각도 계산 (로컬 연결용)
export const calculateConnectionPath = (fromEdge, toEdge, fromProcess, toProcess) => {
  // ProcessBox 실제 크기에 맞는 중심점 계산
  const boxWidth = 280;
  const boxHeight = 120;
  const fromCenterX = fromProcess.x + boxWidth / 2;
  const fromCenterY = fromProcess.y + boxHeight / 2;
  const toCenterX = toProcess.x + boxWidth / 2;
  const toCenterY = toProcess.y + boxHeight / 2;
  
  const dx = toCenterX - fromCenterX;
  const dy = toCenterY - fromCenterY;
  
  // edge에서 직각으로 나가는 거리 정의
  const orthogonalDistance = 30;
  
  let pathData;
  let arrowAngle;
  
  if (Math.abs(dx) > Math.abs(dy)) {
    // 수평 주 방향 연결
    if (dx > 0) {
      // 왼쪽에서 오른쪽으로
      const fromExtend = fromEdge.x + orthogonalDistance;
      const toExtend = toEdge.x - orthogonalDistance;
      pathData = `M ${fromEdge.x} ${fromEdge.y} L ${fromExtend} ${fromEdge.y} L ${fromExtend} ${toEdge.y} L ${toEdge.x} ${toEdge.y}`;
      arrowAngle = 0; // 오른쪽(박스 안쪽)으로 들어가는 화살표
    } else {
      // 오른쪽에서 왼쪽으로
      const fromExtend = fromEdge.x - orthogonalDistance;
      const toExtend = toEdge.x + orthogonalDistance;
      pathData = `M ${fromEdge.x} ${fromEdge.y} L ${fromExtend} ${fromEdge.y} L ${fromExtend} ${toEdge.y} L ${toEdge.x} ${toEdge.y}`;
      arrowAngle = 180; // 왼쪽(박스 안쪽)으로 들어가는 화살표
    }
  } else {
    // 수직 주 방향 연결
    if (dy > 0) {
      // 위에서 아래로
      const fromExtend = fromEdge.y + orthogonalDistance;
      const toExtend = toEdge.y - orthogonalDistance;
      pathData = `M ${fromEdge.x} ${fromEdge.y} L ${fromEdge.x} ${fromExtend} L ${toEdge.x} ${fromExtend} L ${toEdge.x} ${toEdge.y}`;
      arrowAngle = 90; // 아래쪽(박스 안쪽)으로 들어가는 화살표
    } else {
      // 아래에서 위로
      const fromExtend = fromEdge.y - orthogonalDistance;
      const toExtend = toEdge.y + orthogonalDistance;
      pathData = `M ${fromEdge.x} ${fromEdge.y} L ${fromEdge.x} ${fromExtend} L ${toEdge.x} ${fromExtend} L ${toEdge.x} ${toEdge.y}`;
      arrowAngle = -90; // 위쪽(박스 안쪽)으로 들어가는 화살표 (270도)
    }
  }
  
  return { pathData, arrowAngle };
};

// 글로벌 연결선 경로와 화살표 각도 계산 - 출발/도착 시 완전 직각 보장
export const calculateGlobalConnectionPath = (fromEdge, toEdge, edgeDirection, fromDirection, toDirection) => {
  // 기본 거리 설정
  const baseOrthogonalDistance = 35;
  
  let pathData;
  let arrowAngle;
  
  // 방향별 화살표 각도 설정
  switch(toDirection) {
    case 'left':
      arrowAngle = 0; // 왼쪽에서 오른쪽으로 들어가는 화살표
      break;
    case 'right':
      arrowAngle = 180; // 오른쪽에서 왼쪽으로 들어가는 화살표
      break;
    case 'top':
      arrowAngle = 90; // 위에서 아래로 들어가는 화살표
      break;
    case 'bottom':
      arrowAngle = -90; // 아래에서 위로 들어가는 화살표 (270도)
      break;
    default:
      arrowAngle = 0;
  }
  
  // 출발점에서 직각으로 나가는 지점 계산
  let fromExtendX, fromExtendY;
  switch(fromDirection) {
    case 'right':
      fromExtendX = fromEdge.x + baseOrthogonalDistance;
      fromExtendY = fromEdge.y;
      break;
    case 'left':
      fromExtendX = fromEdge.x - baseOrthogonalDistance;
      fromExtendY = fromEdge.y;
      break;
    case 'down':
      fromExtendX = fromEdge.x;
      fromExtendY = fromEdge.y + baseOrthogonalDistance;
      break;
    case 'up':
      fromExtendX = fromEdge.x;
      fromExtendY = fromEdge.y - baseOrthogonalDistance;
      break;
  }
  
  // 도착점에서 직각으로 들어오는 지점 계산
  let toExtendX, toExtendY;
  switch(toDirection) {
    case 'left':
      toExtendX = toEdge.x - baseOrthogonalDistance;
      toExtendY = toEdge.y;
      break;
    case 'right':
      toExtendX = toEdge.x + baseOrthogonalDistance;
      toExtendY = toEdge.y;
      break;
    case 'top':
      toExtendX = toEdge.x;
      toExtendY = toEdge.y - baseOrthogonalDistance;
      break;
    case 'bottom':
      toExtendX = toEdge.x;
      toExtendY = toEdge.y + baseOrthogonalDistance;
      break;
  }
  
  // 중간 연결 경로 계산
  const dx = toExtendX - fromExtendX;
  const dy = toExtendY - fromExtendY;
  
  // 거리가 매우 가까운 경우 특별 처리
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance < 60) {
    // 가까운 거리: 중간에 우회 경로 생성
    let midX1, midY1, midX2, midY2;
    
    if (fromDirection === 'right' || fromDirection === 'left') {
      // 출발이 수평인 경우
      const yOffset = dy > 0 ? 40 : (dy < 0 ? -40 : (fromEdge.y < toEdge.y ? 40 : -40));
      midX1 = fromExtendX;
      midY1 = fromEdge.y + yOffset;
      midX2 = toExtendX;
      midY2 = toEdge.y + (toDirection === 'top' || toDirection === 'bottom' ? 0 : yOffset);
    } else {
      // 출발이 수직인 경우
      const xOffset = dx > 0 ? 40 : (dx < 0 ? -40 : (fromEdge.x < toEdge.x ? 40 : -40));
      midX1 = fromEdge.x + xOffset;
      midY1 = fromExtendY;
      midX2 = toEdge.x + (toDirection === 'left' || toDirection === 'right' ? 0 : xOffset);
      midY2 = toExtendY;
    }
    
    pathData = `M ${fromEdge.x} ${fromEdge.y} 
                L ${fromExtendX} ${fromExtendY} 
                L ${midX1} ${midY1} 
                L ${midX2} ${midY2} 
                L ${toExtendX} ${toExtendY} 
                L ${toEdge.x} ${toEdge.y}`;
  } else {
    // 일반적인 거리: 직각 연결
    if ((fromDirection === 'right' || fromDirection === 'left') && 
        (toDirection === 'left' || toDirection === 'right')) {
      // 둘 다 수평: 중간에 수직 연결
      const midY = (fromExtendY + toExtendY) / 2;
      pathData = `M ${fromEdge.x} ${fromEdge.y} 
                  L ${fromExtendX} ${fromExtendY} 
                  L ${fromExtendX} ${midY} 
                  L ${toExtendX} ${midY} 
                  L ${toExtendX} ${toExtendY} 
                  L ${toEdge.x} ${toEdge.y}`;
    } else if ((fromDirection === 'up' || fromDirection === 'down') && 
               (toDirection === 'top' || toDirection === 'bottom')) {
      // 둘 다 수직: 중간에 수평 연결
      const midX = (fromExtendX + toExtendX) / 2;
      pathData = `M ${fromEdge.x} ${fromEdge.y} 
                  L ${fromExtendX} ${fromExtendY} 
                  L ${midX} ${fromExtendY} 
                  L ${midX} ${toExtendY} 
                  L ${toExtendX} ${toExtendY} 
                  L ${toEdge.x} ${toEdge.y}`;
    } else {
      // 수평-수직 조합: 직접 연결
      pathData = `M ${fromEdge.x} ${fromEdge.y} 
                  L ${fromExtendX} ${fromExtendY} 
                  L ${toExtendX} ${toExtendY} 
                  L ${toEdge.x} ${toEdge.y}`;
    }
  }
  
  return { pathData, arrowAngle };
};
