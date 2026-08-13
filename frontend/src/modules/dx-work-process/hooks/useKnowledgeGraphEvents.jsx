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
  selectedNodes,
  // 엣지 삭제를 위한 매개변수
  deleteSelectedEdge,
  selectedEdge,
  // Spacebar로 물리 시뮬레이션 토글
  togglePhysics
}) => {
  // 키보드 이벤트 리스너
  useEffect(() => {
    const handleKeyPress = (event) => {
      // 입력 필드에서 타이핑 중이면 Delete와 f키 외의 처리 무시
      const isTyping = event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA';
      
      // Delete 키 처리 - 선택된 노드 또는 엣지 삭제
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (!isTyping) {
          // 선택된 노드가 있으면 노드 삭제
          if (selectedNodes && selectedNodes.size > 0 && deleteSelectedNodes) {
            event.preventDefault();
            deleteSelectedNodes();
            return;
          }
          // 선택된 엣지가 있으면 엣지 삭제
          if (selectedEdge && deleteSelectedEdge) {
            event.preventDefault();
            deleteSelectedEdge();
            return;
          }
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

      // Spacebar 처리 - 물리 시뮬레이션 토글
      if (event.key === ' ' || event.code === 'Space') {
        if (isTyping) {
          return;
        }

        event.preventDefault();
        if (togglePhysics) {
          togglePhysics();
        }
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
    selectedNodes,
    deleteSelectedEdge,
    selectedEdge,
    togglePhysics
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

  // physics 비활성화 타이머를 추적하기 위한 변수
  let physicsDisableTimeout = null;

  // 초기 안정화 완료 여부를 추적 (최초 1회만 physics 비활성화)
  let isInitialStabilization = true;

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

  // 개선된 드래그 이벤트 처리 - 드래그 후 일시적으로 physics 활성화하여 연결된 노드들이 따라오게 한 후 멈춤
  networkRef.current.on('dragStart', (params) => {
    // 노드를 드래그하는 경우에만 처리 (화면 이동은 제외)
    if (params.nodes.length === 0) return;

    // 드래그가 시작되면 초기 안정화가 아님
    isInitialStabilization = false;

    // 기존 타이머가 있다면 취소
    if (physicsDisableTimeout) {
      clearTimeout(physicsDisableTimeout);
      physicsDisableTimeout = null;
    }

    // force-directed 레이아웃일 때 physics 다시 활성화
    if (layoutType === 'force-directed' && networkRef.current) {
      networkRef.current.setOptions({
        physics: {
          enabled: true
        }
      });
    }
  });

  networkRef.current.on('dragging', (params) => {
    // 드래그 중에는 추가적인 처리 없음
  });

  networkRef.current.on('dragEnd', (params) => {
    if (params.nodes.length > 0 && nodesRef.current) {
      const draggedNodes = params.nodes;

      // 드래그가 끝나면 physics를 일시적으로 활성화
      draggedNodes.forEach(nodeId => {
        try {
          const finalPosition = networkRef.current.getPosition(nodeId);
          if (finalPosition && !isNaN(finalPosition.x) && !isNaN(finalPosition.y)) {
            nodesRef.current.update({
              id: nodeId,
              x: finalPosition.x,
              y: finalPosition.y,
              physics: layoutType === 'force-directed' ? true : false,
              fixed: false
            });
          }
        } catch (error) {
          console.warn(`노드 ${nodeId} 드래그 완료 처리 실패:`, error);
        }
      });

      // force-directed 레이아웃일 때만 일정 시간 후 physics 비활성화
      if (layoutType === 'force-directed') {
        // 기존 타이머가 있다면 취소
        if (physicsDisableTimeout) {
          clearTimeout(physicsDisableTimeout);
        }

        // 1.5초 후 네트워크 전체의 physics 엔진을 비활성화하여 움직임 멈춤
        physicsDisableTimeout = setTimeout(() => {
          if (networkRef.current) {
            // 네트워크 레벨에서 physics 비활성화 (개별 노드가 아닌 전체 엔진)
            networkRef.current.setOptions({
              physics: {
                enabled: false
              }
            });
            console.log('Physics 엔진 비활성화 - 모든 노드 움직임 멈춤');
          }
        }, 1500);
      }
    }
  });

  networkRef.current.on('oncontext', (params) => {
    params.event.preventDefault();
  });

  // 안정화 완료 - 초기 로딩 시에만 physics 비활성화
  networkRef.current.on('stabilizationIterationsDone', () => {
    // 초기 안정화 완료 시에만 physics 비활성화 (맨 처음 데이터 로드 시)
    if (isInitialStabilization && layoutType === 'force-directed' && networkRef.current) {
      isInitialStabilization = false;

      // 1초 후 physics 비활성화 (안정화 완료 직후 약간의 여유 시간)
      setTimeout(() => {
        if (networkRef.current) {
          networkRef.current.setOptions({
            physics: {
              enabled: false
            }
          });
          console.log('초기 안정화 완료 - physics 비활성화');
        }
      }, 1000);
    } else {
      console.log('안정화 완료 (초기 로딩 아님)');
    }
  });
};