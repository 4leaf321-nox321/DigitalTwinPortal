import { useState, useEffect } from 'react';

export const useResize = (isAnyModalOpen = false) => {
  const [colWidths, setColWidths] = useState({});
  const [rowHeights, setRowHeights] = useState({});
  const [resizing, setResizing] = useState(null);
  const [stepColumnWidth, setStepColumnWidth] = useState(200);

  // 열 너비와 행 높이 계산 (행 높이 2배, 열 너비 3배로 증가)
  const getColWidth = (orgId) => colWidths[orgId] || 450; // 150 * 3 = 450
  const getRowHeight = (stepId) => rowHeights[stepId] || 240; // 120 * 2 = 240

  // 리사이징 핸들러
  const handleMouseDown = (e, type, id) => {
    // 모달이 열려있을 때는 드래그 비활성화
    if (isAnyModalOpen) {
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    setResizing({ type, id, startX: e.clientX, startY: e.clientY });
  };

  const handleMouseMove = (e) => {
    if (!resizing) return;

    if (resizing.type === 'column') {
      const deltaX = e.clientX - resizing.startX;
      const currentWidth = getColWidth(resizing.id);
      const newWidth = Math.max(300, currentWidth + deltaX); // 최소 너비 300px (증가된 기본값에 맞춤)
      setColWidths(prev => ({ ...prev, [resizing.id]: newWidth }));
      // 시작 위치 업데이트
      setResizing(prev => ({ ...prev, startX: e.clientX }));
    } else if (resizing.type === 'row') {
      const deltaY = e.clientY - resizing.startY;
      const currentHeight = getRowHeight(resizing.id);
      const newHeight = Math.max(160, currentHeight + deltaY); // 최소 높이 160px (증가된 기본값에 맞춤)
      setRowHeights(prev => ({ ...prev, [resizing.id]: newHeight }));
      // 시작 위치 업데이트
      setResizing(prev => ({ ...prev, startY: e.clientY }));
    } else if (resizing.type === 'stepColumn') {
      const deltaX = e.clientX - resizing.startX;
      const newWidth = Math.max(120, stepColumnWidth + deltaX); // 최소 너비 120px
      setStepColumnWidth(newWidth);
      // 시작 위치 업데이트
      setResizing(prev => ({ ...prev, startX: e.clientX }));
    }
  };

  const handleMouseUp = () => {
    setResizing(null);
  };

  useEffect(() => {
    if (resizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [resizing]);

  return {
    colWidths,
    rowHeights,
    stepColumnWidth,
    getColWidth,
    getRowHeight,
    handleMouseDown
  };
};
