import { useState, useEffect, useCallback } from 'react';

/**
 * 박스 선택 기능을 관리하는 커스텀 훅
 * 박스 선택 UI 개선된 버전
 * Ctrl+드래그 또는 Shift+드래그로 박스 선택 가능
 */
export const useBoxSelection = ({ containerRef, networkRef, updateSelectedNodes, onNodeClick }) => {
  const [isBoxSelecting, setIsBoxSelecting] = useState(false);
  const [boxStart, setBoxStart] = useState(null);
  const [boxEnd, setBoxEnd] = useState(null);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [originalInteractionSettings, setOriginalInteractionSettings] = useState(null);

  // 안전한 네트워크 설정 변경
  const changeNetworkInteraction = useCallback((settings) => {
    if (!networkRef.current) return;
    
    try {
      networkRef.current.setOptions({
        interaction: settings
      });
    } catch (error) {
      console.warn('네트워크 설정 변경 실패:', error);
    }
  }, [networkRef]);

  // 박스 선택 시작 (Ctrl 또는 Shift 키와 함께 드래그)
  const startBoxSelection = useCallback((event) => {
    const isModifierPressed = event.ctrlKey || event.metaKey || event.shiftKey;
    if (!isModifierPressed) return;
    if (!containerRef.current || !networkRef.current) return;
    
    // 마우스 다운 이벤트 기본 동작 방지
    event.preventDefault();
    event.stopPropagation();
    
    // 현재 인터랙션 설정 백업
    setOriginalInteractionSettings({
      dragView: true,
      zoomView: true,
      selectConnectedEdges: false,
      dragNodes: true
    });
    
    // 박스 선택 중에만 드래그 비활성화
    changeNetworkInteraction({
      dragView: false,
      zoomView: true,
      selectConnectedEdges: false,
      dragNodes: false
    });
    
    const rect = containerRef.current.getBoundingClientRect();
    const startPos = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
    
    setIsBoxSelecting(true);
    setBoxStart(startPos);
    setBoxEnd(startPos); // 시작점과 동일하게 설정
  }, [containerRef, networkRef, changeNetworkInteraction]);

  // 박스 선택 업데이트 - 실시간으로 박스 크기 조정
  const updateBoxSelection = useCallback((event) => {
    if (!isBoxSelecting || !containerRef.current || !boxStart) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const currentPos = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
    
    // 박스 끝점 업데이트
    setBoxEnd(currentPos);
  }, [isBoxSelecting, containerRef, boxStart]);

  // 박스 선택 종료
  const endBoxSelection = useCallback(() => {
    if (!isBoxSelecting) return;
    
    setIsBoxSelecting(false);
    
    // 원래 인터랙션 설정 복원
    if (originalInteractionSettings) {
      changeNetworkInteraction(originalInteractionSettings);
      setOriginalInteractionSettings(null);
    }
    
    // 박스 영역 계산 및 노드 선택
    if (boxStart && boxEnd && networkRef.current) {
      const selectedNodeIds = new Set();
      
      try {
        // 박스의 최소/최대 좌표 계산
        const minX = Math.min(boxStart.x, boxEnd.x);
        const maxX = Math.max(boxStart.x, boxEnd.x);
        const minY = Math.min(boxStart.y, boxEnd.y);
        const maxY = Math.max(boxStart.y, boxEnd.y);
        
        // 박스가 너무 작으면 선택하지 않음 (클릭으로 간주)
        const boxWidth = maxX - minX;
        const boxHeight = maxY - minY;
        if (boxWidth < 5 && boxHeight < 5) {
          setBoxStart(null);
          setBoxEnd(null);
          return;
        }
        
        // 현재 실제 노드 위치를 가져오기
        const positions = networkRef.current.getPositions();
        
        if (positions && Object.keys(positions).length > 0) {
          Object.keys(positions).forEach(nodeId => {
            try {
              const nodeCanvasPos = positions[nodeId];
              // 캔버스 좌표를 DOM 좌표로 변환
              const nodePos = networkRef.current.canvasToDOM(nodeCanvasPos);
              
              // 노드가 박스 영역 안에 있는지 확인
              if (nodePos.x >= minX && nodePos.x <= maxX && 
                  nodePos.y >= minY && nodePos.y <= maxY) {
                selectedNodeIds.add(nodeId);
              }
            } catch (nodeError) {
              console.warn(`노드 ${nodeId} 위치 계산 실패:`, nodeError);
            }
          });
        }
      } catch (error) {
        console.warn('박스 선택 중 노드 위치 계산 오류:', error);
      }
      
      // 선택된 노드가 있으면 업데이트
      if (selectedNodeIds.size > 0) {
        updateSelectedNodes(selectedNodeIds);
        onNodeClick(null); // 다중 선택이므로 단일 선택 해제
      }
    }
    
    // 상태 초기화
    setBoxStart(null);
    setBoxEnd(null);
  }, [isBoxSelecting, boxStart, boxEnd, networkRef, originalInteractionSettings, 
      changeNetworkInteraction, updateSelectedNodes, onNodeClick]);

  // Ctrl/Shift 키 상태 추적
  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && !isCtrlPressed) {
        setIsCtrlPressed(true);
      }
      if (event.shiftKey && !isShiftPressed) {
        setIsShiftPressed(true);
      }
    };

    const handleKeyUp = (event) => {
      if (!event.ctrlKey && !event.metaKey && isCtrlPressed) {
        setIsCtrlPressed(false);
      }
      if (!event.shiftKey && isShiftPressed) {
        setIsShiftPressed(false);
      }

      // 모든 수정자 키를 떼면 진행 중인 박스 선택 종료
      if (!event.ctrlKey && !event.metaKey && !event.shiftKey && isBoxSelecting) {
        endBoxSelection();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [isCtrlPressed, isShiftPressed, isBoxSelecting, endBoxSelection]);

  // 전역 마우스 이벤트 처리 (화면 밖으로 나가도 박스 선택 유지)
  useEffect(() => {
    if (!isBoxSelecting) return;
    
    const handleGlobalMouseMove = (event) => {
      if (!containerRef.current || !boxStart) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const currentPos = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
      
      setBoxEnd(currentPos);
    };

    const handleGlobalMouseUp = () => {
      if (isBoxSelecting) {
        endBoxSelection();
      }
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isBoxSelecting, containerRef, boxStart, endBoxSelection]);

  // 컨테이너 내 마우스 이벤트
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    const handleMouseDown = (event) => {
      // 박스 선택 시작 (Ctrl 또는 Shift + 마우스 다운)
      if (event.ctrlKey || event.metaKey || event.shiftKey) {
        startBoxSelection(event);
      }
    };

    container.addEventListener('mousedown', handleMouseDown);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
    };
  }, [containerRef, startBoxSelection]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      // 언마운트 시 박스 선택이 진행 중이면 종료
      if (isBoxSelecting && originalInteractionSettings) {
        changeNetworkInteraction(originalInteractionSettings);
      }
    };
  }, [isBoxSelecting, originalInteractionSettings, changeNetworkInteraction]);

  return {
    isBoxSelecting,
    boxStart,
    boxEnd,
    isCtrlPressed,
    isShiftPressed,
    isModifierPressed: isCtrlPressed || isShiftPressed, // Ctrl 또는 Shift 중 하나라도 눌려있는지
    startBoxSelection,
    updateBoxSelection,
    endBoxSelection
  };
};