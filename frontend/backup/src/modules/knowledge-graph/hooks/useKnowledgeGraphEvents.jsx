import { useEffect } from 'react';

/**
 * 다중 선택을 지원하는 키보드 이벤트를 처리하는 훅
 */
export const useKnowledgeGraphEvents = ({
  isAddingNodeRef,
  isAddingEdgeRef,
  updateIsAddingNode,
  updateIsAddingEdge,
  updateSourceNodeForEdge,
  setTempNode,
  handleFitToView,
  // Delete 키 처리를 위한 추가 매개변수
  deleteSelectedNodes,
  selectedNodes
}) => {
  // 키보드 이벤트 리스너
  useEffect(() => {
    const handleKeyPress = (event) => {
      // 입력 필드에서 타이핑 중이면 Delete와 f키 외의 처리 무시
      const isTyping = event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA';
      
      // Delete 키 처리 - 선택된 노드들 삭제
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (!isTyping && selectedNodes && selectedNodes.size > 0 && deleteSelectedNodes) {
          event.preventDefault();
          deleteSelectedNodes();
          return;
        }
      }
      
      // ESC 키 처리 - 노드/엣지 추가 모드 종료
      if (event.key === 'Escape') {
        if (isAddingNodeRef.current) {
          updateIsAddingNode(false);
          setTempNode(null);
        }
        if (isAddingEdgeRef.current) {
          updateIsAddingEdge(false);
          updateSourceNodeForEdge(null);
        }
      }
      
      // Enter 키 처리 - 노드/엣지 추가 모드 종료 (입력 필드가 아닌 경우에만)
      if (event.key === 'Enter' && !isTyping) {
        if (isAddingNodeRef.current) {
          event.preventDefault();
          updateIsAddingNode(false);
          setTempNode(null);
        }
        if (isAddingEdgeRef.current) {
          event.preventDefault();
          updateIsAddingEdge(false);
          updateSourceNodeForEdge(null);
        }
      }
      
      // f키 처리 - 전체 그래프 화면에 맞추기
      if (event.key === 'f' || event.key === 'F') {
        if (isTyping) {
          return;
        }
        
        event.preventDefault();
        handleFitToView();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [
    isAddingNodeRef,
    isAddingEdgeRef,
    updateIsAddingNode,
    updateIsAddingEdge,
    updateSourceNodeForEdge,
    setTempNode,
    handleFitToView,
    deleteSelectedNodes,
    selectedNodes
  ]);
};

/**
 * 다중 선택을 지원하는 vis-network 이벤트 리스너를 설정하는 함수
 */
export const setupNetworkEventListeners = ({
  networkRef,
  nodesRef,
  isAddingNodeRef,
  isAddingEdgeRef,
  handleAddNodeClick,
  handleAddEdgeClick,
  onNodeClick,
  onEdgeClick,
  updateIsAddingNode,
  updateCursor,
  layoutType
}) => {
  if (!networkRef.current) return;

  // 노드 클릭 - 다중 선택 지원
  networkRef.current.on('click', (params) => {
    if (isAddingNodeRef.current) {
      handleAddNodeClick(params);
    } else if (isAddingEdgeRef.current) {
      handleAddEdgeClick(params);
    } else {
      const event = params.event.srcEvent || params.event;
      
      if (params.nodes.length > 0) {
        onNodeClick(params.nodes[0], event);
      } else if (params.edges.length > 0) {
        onEdgeClick(params.edges[0], event);
      } else {
        onNodeClick(null, event);
        onEdgeClick(null, event);
      }
    }
  });

  // 더블 클릭으로 노드 추가
  networkRef.current.on('doubleClick', (params) => {
    if (isAddingNodeRef.current && !params.nodes.length && !params.edges.length) {
      handleAddNodeClick(params);
    } else if (!isAddingNodeRef.current && !params.nodes.length && !params.edges.length) {
      updateIsAddingNode(true);
    }
  });

  // 호버 효과
  networkRef.current.on('hoverNode', (params) => {
    if (isAddingEdgeRef.current) {
      networkRef.current.canvas.body.container.style.cursor = 'crosshair';
    } else {
      networkRef.current.canvas.body.container.style.cursor = 'pointer';
    }
  });

  networkRef.current.on('blurNode', (params) => {
    updateCursor();
  });

  networkRef.current.on('hoverEdge', (params) => {
    networkRef.current.canvas.body.container.style.cursor = 'pointer';
  });

  networkRef.current.on('blurEdge', (params) => {
    updateCursor();
  });

  // 개선된 드래그 이벤트 처리 - 위치 보존
  networkRef.current.on('dragStart', (params) => {
    if (params.nodes.length > 0) {
      // 드래그 시작 시 물리 시뮬레이션 일시 중지
      if (layoutType === 'force-directed') {
        networkRef.current.setOptions({
          physics: {
            enabled: false
          }
        });
      }
      
      // 드래그되는 노드들을 physics: false로 설정
      const draggedNodeUpdates = params.nodes.map(nodeId => ({
        id: nodeId,
        physics: false,
        fixed: { x: false, y: false }
      }));
      
      if (nodesRef.current) {
        try {
          nodesRef.current.update(draggedNodeUpdates);
        } catch (error) {
          console.warn('드래그 시작 중 노드 업데이트 실패:', error);
        }
      }
    }
  });

  networkRef.current.on('dragging', (params) => {
    // 드래그 중에는 추가적인 처리 없음
  });

  networkRef.current.on('dragEnd', (params) => {
    if (params.nodes.length > 0) {
      const draggedNodes = params.nodes;
      
      draggedNodes.forEach(nodeId => {
        try {
          const finalPosition = networkRef.current.getPosition(nodeId);
          if (finalPosition && !isNaN(finalPosition.x) && !isNaN(finalPosition.y) && nodesRef.current) {
            nodesRef.current.update({
              id: nodeId,
              x: finalPosition.x,
              y: finalPosition.y,
              physics: false,
              fixed: { x: false, y: false }
            });
          }
        } catch (error) {
          console.warn(`노드 ${nodeId} 드래그 완료 처리 실패:`, error);
        }
      });
      
      if (layoutType === 'force-directed') {
        setTimeout(() => {
          if (networkRef.current) {
            try {
              networkRef.current.setOptions({
                physics: {
                  enabled: true,
                  stabilization: { enabled: false }
                }
              });
              
              setTimeout(() => {
                if (networkRef.current) {
                  networkRef.current.setOptions({
                    physics: { enabled: false }
                  });
                }
              }, 1000);
            } catch (error) {
              console.warn('물리 시뮬레이션 재설정 실패:', error);
            }
          }
        }, 100);
      }
    }
  });

  networkRef.current.on('oncontext', (params) => {
    params.event.preventDefault();
  });

  // 안정화 완료 시 물리 시뮬레이션 비활성화
  networkRef.current.on('stabilizationIterationsDone', () => {
    if (layoutType === 'force-directed') {
      setTimeout(() => {
        if (networkRef.current && networkRef.current.physics) {
          try {
            networkRef.current.setOptions({
              physics: { enabled: false }
            });
          } catch (error) {
            console.warn('안정화 후 물리 시뮬레이션 비활성화 실패:', error);
          }
        }
      }, 500);
    }
  });
};