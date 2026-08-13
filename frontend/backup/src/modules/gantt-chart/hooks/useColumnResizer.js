import { useState, useEffect, useRef } from 'react';

export const useColumnResizer = () => {
  const [taskNameColWidth, setTaskNameColWidth] = useState(() => {
    const width = window.innerWidth;
    if (width <= 480) return 90;
    if (width <= 1024) return 110;
    return 140;
  });
  
  const [assigneeColWidth, setAssigneeColWidth] = useState(() => {
    const width = window.innerWidth;
    if (width <= 480) return 60;
    if (width <= 1024) return 70;
    return 90;
  });
  
  const [progressColWidth, setProgressColWidth] = useState(() => {
    const width = window.innerWidth;
    if (width <= 480) return 40;
    if (width <= 1024) return 50;
    return 70;
  });
  
  const [isResizing, setIsResizing] = useState(false);
  const [resizingColumn, setResizingColumn] = useState(null);
  const [dragStarted, setDragStarted] = useState(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  // 전역 마우스 이벤트 핸들러
  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      if (!isResizing || !resizingColumn) return;
      
      const deltaX = e.clientX - resizeStartX.current;
      
      if (!dragStarted && Math.abs(deltaX) < 3) {
        return;
      }
      
      if (!dragStarted) {
        setDragStarted(true);
      }
      
      let newWidth;
      
      switch (resizingColumn) {
        case 'name':
          newWidth = Math.max(80, Math.min(1000, resizeStartWidth.current + deltaX));
          setTaskNameColWidth(newWidth);
          break;
        case 'assignee':
          newWidth = Math.max(50, Math.min(150, resizeStartWidth.current + deltaX));
          setAssigneeColWidth(newWidth);
          break;
        case 'progress':
          newWidth = Math.max(40, Math.min(120, resizeStartWidth.current + deltaX));
          setProgressColWidth(newWidth);
          break;
      }
    };

    const handleGlobalMouseUp = () => {
      if (!isResizing) return;
      
      setIsResizing(false);
      setResizingColumn(null);
      setDragStarted(false);
      
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      document.body.classList.remove('resizing');
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleGlobalMouseMove, { passive: false });
      document.addEventListener('mouseup', handleGlobalMouseUp, { passive: false });
      
      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isResizing, resizingColumn, dragStarted]);

  // 화면 크기 변경 감지
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      
      // 기본값이면 화면 크기에 따라 조정
      if ([140, 110, 90].includes(taskNameColWidth)) {
        if (width <= 480) setTaskNameColWidth(90);
        else if (width <= 1024) setTaskNameColWidth(110);
        else setTaskNameColWidth(140);
      }
      
      if ([90, 70, 60].includes(assigneeColWidth)) {
        if (width <= 480) setAssigneeColWidth(60);
        else if (width <= 1024) setAssigneeColWidth(70);
        else setAssigneeColWidth(90);
      }
      
      if ([70, 50, 40].includes(progressColWidth)) {
        if (width <= 480) setProgressColWidth(40);
        else if (width <= 1024) setProgressColWidth(50);
        else setProgressColWidth(70);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [taskNameColWidth, assigneeColWidth, progressColWidth]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      document.body.classList.remove('resizing');
    };
  }, []);

  const handleColumnResize = (e, columnType, currentWidth) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsResizing(true);
    setResizingColumn(columnType);
    setDragStarted(false);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = currentWidth;
    
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    document.body.classList.add('resizing');
  };

  const totalTaskPanelWidth = taskNameColWidth + assigneeColWidth + progressColWidth;

  return {
    taskNameColWidth,
    assigneeColWidth,
    progressColWidth,
    isResizing,
    resizingColumn,
    handleColumnResize,
    totalTaskPanelWidth
  };
};