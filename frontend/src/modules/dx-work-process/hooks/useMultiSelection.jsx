import { useState, useRef, useEffect } from 'react';

/**
 * 다중 선택 기능을 관리하는 커스텀 훅
 */
export const useMultiSelection = ({
  data,
  onNodeClick,
  onNodeDelete,
  onMultipleNodesDelete,
  // 엣지 삭제 관련
  onEdgeDelete,
  selectedEdge,
  // 모달 함수 추가
  askWarningConfirm
}) => {
  const selectedNodesRef = useRef(new Set());
  const [selectedNodes, setSelectedNodes] = useState(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);

  const updateSelectedNodes = (nodes) => {
    setSelectedNodes(nodes);
    selectedNodesRef.current = nodes;
  };

  // 다중 선택 관련 함수들
  const toggleNodeSelection = (nodeId, isCtrlPressed = false) => {
    const newSelected = new Set(selectedNodes);
    
    if (isCtrlPressed) {
      if (newSelected.has(nodeId)) {
        newSelected.delete(nodeId);
      } else {
        newSelected.add(nodeId);
      }
    } else {
      // Ctrl 없이 클릭하면 기존 선택을 모두 해제하고 해당 노드만 선택
      newSelected.clear();
      newSelected.add(nodeId);
    }
    
    updateSelectedNodes(newSelected);
    
    // 단일 선택의 경우 기존 로직도 호출
    if (!isCtrlPressed || newSelected.size === 1) {
      onNodeClick(nodeId);
    } else {
      // 다중 선택의 경우 선택 해제
      onNodeClick(null);
    }
  };

  const clearNodeSelection = () => {
    updateSelectedNodes(new Set());
    onNodeClick(null);
  };

  // 선택된 엣지 삭제
  const deleteSelectedEdge = () => {
    if (!selectedEdge || !onEdgeDelete) return;

    const edge = data.edges.find(e => e.id === selectedEdge);
    const edgeLabel = edge?.label || selectedEdge;

    const confirmMessage = `관계 "${edgeLabel}"을(를) 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`;

    if (askWarningConfirm) {
      askWarningConfirm(confirmMessage, '관계 삭제 확인').then((confirmed) => {
        if (confirmed) {
          onEdgeDelete(selectedEdge);
        }
      });
    } else {
      if (confirm(confirmMessage)) {
        onEdgeDelete(selectedEdge);
      }
    }
  };

  const deleteSelectedNodes = () => {
    if (selectedNodes.size === 0) return;
    
    const nodeLabels = Array.from(selectedNodes)
      .map(nodeId => data.nodes.find(n => n.id === nodeId)?.label || nodeId)
      .slice(0, 3); // 최대 3개까지만 표시
    
    let confirmMessage;
    if (selectedNodes.size === 1) {
      confirmMessage = `노드 "${nodeLabels[0]}"을(를) 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`;
    } else if (selectedNodes.size <= 3) {
      confirmMessage = `노드 "${nodeLabels.join('", "')}"을(를) 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`;
    } else {
      confirmMessage = `선택된 ${selectedNodes.size}개의 노드("${nodeLabels.join('", "')}" 등)를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`;
    }
    
    // 모달이 있으면 모달 사용, 없으면 기본 confirm 사용
    if (askWarningConfirm) {
      askWarningConfirm(confirmMessage, '노드 삭제 확인').then((confirmed) => {
        if (confirmed) {
          // 다중 노드 삭제 기능이 있으면 사용, 없으면 개별 삭제
          if (onMultipleNodesDelete && selectedNodes.size > 1) {
            onMultipleNodesDelete(selectedNodes);
          } else {
            // 각 노드를 순차적으로 삭제
            selectedNodes.forEach(nodeId => {
              onNodeDelete(nodeId);
            });
          }
          clearNodeSelection();
        }
      });
    } else {
      // 폴백: 기본 confirm 사용
      if (confirm(confirmMessage)) {
        // 다중 노드 삭제 기능이 있으면 사용, 없으면 개별 삭제
        if (onMultipleNodesDelete && selectedNodes.size > 1) {
          onMultipleNodesDelete(selectedNodes);
        } else {
          // 각 노드를 순차적으로 삭제
          selectedNodes.forEach(nodeId => {
            onNodeDelete(nodeId);
          });
        }
        clearNodeSelection();
      }
    }
  };

  return {
    selectedNodes,
    selectedNodesRef,
    isMultiSelectMode,
    setIsMultiSelectMode,
    toggleNodeSelection,
    clearNodeSelection,
    deleteSelectedNodes,
    deleteSelectedEdge,
    updateSelectedNodes
  };
};