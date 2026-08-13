import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Network } from 'vis-network/standalone/esm/vis-network';
import { DataSet } from 'vis-data/esnext';
import Controls from './Controls';
import StatusIndicators from './StatusIndicators';
import BulkNodeModal from './BulkNodeModal';
import BulkEdgeModal from './BulkEdgeModal';
import ContextMenu from './ContextMenu';
import EditModal from './EditModal';
import { getNodeStyle } from '../../utils/colorUtils.js';
import { useKnowledgeGraphCore } from '../../hooks/useKnowledgeGraphCore';
import { useMultiSelection } from '../../hooks/useMultiSelection';
import { useBoxSelection } from '../../hooks/useBoxSelection';
import { useNetworkEvents } from '../../hooks/useNetworkEvents';
import { useNetworkEffects } from '../../hooks/useNetworkEffects';
import './KnowledgeGraph.css';

const KnowledgeGraph = ({
  data,
  selectedNode,
  selectedEdge,
  highlightedNodes,
  highlightedEdges,
  layoutType,
  onNodeClick,
  onEdgeClick,
  onNodeAdd,
  onEdgeAdd,
  onNodeUpdate,
  onEdgeUpdate,
  onNodeDelete,
  onMultipleNodesDelete,
  onEdgeDelete,
  nodeTypes = [],
  edgeTypes = [],
  askWarningConfirm,
  onNodeTypeUpdate,
  onEdgeTypeUpdate,
  // 커스텀 모달 함수들 추가
  showError,
  showSuccess,
  showInfo
}) => {
  const containerRef = useRef(null);
  const networkRef = useRef(null);
  const nodesRef = useRef(null);
  const edgesRef = useRef(null);

  const [isFitActive, setIsFitActive] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showBulkEdgeModal, setShowBulkEdgeModal] = useState(false);

  // 컨텍스트 메뉴 상태
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    position: { x: 0, y: 0 },
    type: null,
    targetId: null
  });

  // Edit 모달 상태
  const [editModal, setEditModal] = useState({
    isOpen: false,
    type: null, // 'node' | 'edge'
    data: null
  });

  // 다중 선택 기능
  const {
    selectedNodes,
    toggleNodeSelection,
    clearNodeSelection,
    deleteSelectedNodes,
    deleteSelectedEdge,
    updateSelectedNodes
  } = useMultiSelection({
    data,
    onNodeClick,
    onNodeDelete,
    onMultipleNodesDelete,
    onEdgeDelete,
    selectedEdge,
    askWarningConfirm
  });

  // 핵심 그래프 로직 - Delete 키 처리를 위한 매개변수 추가
  const {
    isAddingNode,
    isAddingEdge,
    sourceNodeForEdge,
    tempNode,
    updateIsAddingNode,
    updateIsAddingEdge,
    updateSourceNodeForEdge,
    setTempNode,
    handleFitToView,
    handleZoomIn,
    handleZoomOut,
    togglePhysics,
    reapplyLayout,
    handleAddNodeClick,
    handleAddEdgeClick,
    handleBulkAddNodes,
    handleBulkAddEdges,
    nodeSpacing,
    updateNodeSpacing
  } = useKnowledgeGraphCore({
    networkRef,
    nodesRef,
    data,
    nodeTypes,
    edgeTypes,
    onNodeAdd,
    onEdgeAdd,
    setIsFitActive,
    deleteSelectedNodes, // Delete 키 처리를 위한 함수 전달
    selectedNodes, // 선택된 노드 정보 전달
    deleteSelectedEdge, // 엣지 삭제 함수 전달
    selectedEdge // 선택된 엣지 정보 전달
  });

  // 박스 선택 기능 (Ctrl+드래그 또는 Shift+드래그)
  const {
    isBoxSelecting,
    boxStart,
    boxEnd,
    isCtrlPressed,
    isShiftPressed,
    isModifierPressed
  } = useBoxSelection({
    containerRef,
    networkRef,
    updateSelectedNodes,
    onNodeClick
  });

  // 모달 핸들러들
  const handleBulkAdd = (nodes) => {
    handleBulkAddNodes(nodes);
    setShowBulkModal(false);
  };

  const handleBulkEdgeAdd = (edges) => {
    handleBulkAddEdges(edges);
    setShowBulkEdgeModal(false);
  };

  const handleTypeUpdate = (newTypes) => {
    if (onNodeTypeUpdate) {
      onNodeTypeUpdate(newTypes);
    }
  };

  const handleEdgeTypeUpdate = (newTypes) => {
    if (onEdgeTypeUpdate) {
      onEdgeTypeUpdate(newTypes);
    }
  };

  // 컨텍스트 메뉴 핸들러
  const handleContextMenu = useCallback((params) => {
    // 노드나 엣지가 있을 때만 컨텍스트 메뉴 표시
    if (params.type === 'node' || params.type === 'edge') {
      setContextMenu({
        visible: true,
        position: params.position,
        type: params.type,
        targetId: params.targetId
      });
    }
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, visible: false }));
  }, []);

  // Edit 모달 열기
  const openEditModal = useCallback((type, targetId) => {
    let targetData = null;

    if (type === 'node') {
      targetData = data.nodes.find(n => n.id === targetId);
    } else if (type === 'edge') {
      targetData = data.edges.find(e => e.id === targetId);
    }

    if (targetData) {
      setEditModal({
        isOpen: true,
        type,
        data: targetData
      });
    }
  }, [data]);

  const closeEditModal = useCallback(() => {
    setEditModal({
      isOpen: false,
      type: null,
      data: null
    });
  }, []);

  // 컨텍스트 메뉴에서 Edit 클릭 시
  const handleContextMenuEdit = useCallback(() => {
    openEditModal(contextMenu.type, contextMenu.targetId);
  }, [contextMenu, openEditModal]);

  // 컨텍스트 메뉴에서 Delete 클릭 시
  const handleContextMenuDelete = useCallback(() => {
    if (contextMenu.type === 'node') {
      const node = data.nodes.find(n => n.id === contextMenu.targetId);
      if (node && askWarningConfirm) {
        askWarningConfirm(
          `노드 "${node.label}"을(를) 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`,
          '노드 삭제 확인'
        ).then((confirmed) => {
          if (confirmed && onNodeDelete) {
            onNodeDelete(contextMenu.targetId);
          }
        });
      }
    } else if (contextMenu.type === 'edge') {
      const edge = data.edges.find(e => e.id === contextMenu.targetId);
      if (edge && askWarningConfirm) {
        const edgeLabel = edge.label || edge.type || '관계';
        askWarningConfirm(
          `관계 "${edgeLabel}"을(를) 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`,
          '관계 삭제 확인'
        ).then((confirmed) => {
          if (confirmed && onEdgeDelete) {
            onEdgeDelete(contextMenu.targetId);
          }
        });
      }
    }
  }, [contextMenu, data, askWarningConfirm, onNodeDelete, onEdgeDelete]);

  // 컨텍스트 메뉴에서 연결 추가 클릭 시
  const handleContextMenuAddEdge = useCallback(() => {
    if (contextMenu.type === 'node') {
      updateIsAddingEdge(true);
      updateIsAddingNode(false);
      updateSourceNodeForEdge(contextMenu.targetId);
    }
  }, [contextMenu, updateIsAddingEdge, updateIsAddingNode, updateSourceNodeForEdge]);

  // 네트워크 이벤트 처리
  useNetworkEvents({
    networkRef,
    nodesRef,
    edgesRef,
    containerRef,
    data,
    isAddingNode,
    isAddingEdge,
    handleAddNodeClick,
    handleAddEdgeClick,
    toggleNodeSelection,
    clearNodeSelection,
    onEdgeClick,
    onContextMenu: handleContextMenu,
    nodeTypes,
    layoutType
  });

  // 네트워크 이펙트들 (데이터 업데이트, 레이아웃 변경 등)
  useNetworkEffects({
    networkRef,
    nodesRef,
    edgesRef,
    data,
    nodeTypes,
    layoutType,
    highlightedNodes,
    highlightedEdges,
    selectedNode,
    selectedEdge,
    selectedNodes,
    isAddingNode,
    isAddingEdge
  });

  // 박스 선택 디버깅
  useEffect(() => {
    if (isBoxSelecting && boxStart && boxEnd) {
      console.log('박스 선택 상태:', {
        isBoxSelecting,
        boxStart,
        boxEnd,
        width: Math.abs(boxEnd.x - boxStart.x),
        height: Math.abs(boxEnd.y - boxStart.y)
      });
    }
  }, [isBoxSelecting, boxStart, boxEnd]);

  return (
    <div className="knowledge-graph">
      <div
        className={`graph-container ${
          isAddingNode ? 'node-add-mode' : ''
        } ${
          isModifierPressed ? 'modifier-pressed' : ''
        } ${
          isBoxSelecting ? 'box-selecting' : ''
        }`}
        ref={containerRef}
        style={{ position: 'relative' }}
      />
      
      {/* 박스 선택 시각화 - 개선된 버전 */}
      {isBoxSelecting && boxStart && boxEnd && (
        <div
          className="selection-box"
          style={{
            position: 'absolute',
            left: Math.min(boxStart.x, boxEnd.x),
            top: Math.min(boxStart.y, boxEnd.y),
            width: Math.abs(boxEnd.x - boxStart.x),
            height: Math.abs(boxEnd.y - boxStart.y),
            border: '3px dashed #e74c3c',
            backgroundColor: 'rgba(231, 76, 60, 0.15)',
            pointerEvents: 'none',
            zIndex: 1000,
            borderRadius: '4px',
            minWidth: '1px', // 최소 너비 보장
            minHeight: '1px' // 최소 높이 보장
          }}
        />
      )}
      
      {/* 박스 선택 상태 표시 */}
      {(isModifierPressed || isBoxSelecting) && (
        <div style={{
          position: 'absolute',
          top: '70px',
          right: '16px',
          background: isBoxSelecting ? '#007bff' : '#17a2b8',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '12px',
          zIndex: 90
        }}>
          {isBoxSelecting ? (
            <span>박스 선택 중... ({Math.abs((boxEnd?.x || 0) - (boxStart?.x || 0))}×{Math.abs((boxEnd?.y || 0) - (boxStart?.y || 0))})</span>
          ) : (
            <span>{isCtrlPressed ? 'Ctrl' : 'Shift'} 키 - 박스 선택 준비 (드래그)</span>
          )}
        </div>
      )}
      
      <Controls
        onFitToView={() => handleFitToView(setIsFitActive)}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onTogglePhysics={togglePhysics}
        onReapplyLayout={reapplyLayout}
        isAddingNode={isAddingNode}
        isAddingEdge={isAddingEdge}
        onToggleAddNode={() => {
          updateIsAddingNode(!isAddingNode);
          updateIsAddingEdge(false);
          updateSourceNodeForEdge(null);
        }}
        onToggleAddEdge={() => {
          updateIsAddingEdge(!isAddingEdge);
          updateIsAddingNode(false);
          updateSourceNodeForEdge(null);
        }}
        sourceNodeForEdge={sourceNodeForEdge}
        currentLayout={layoutType}
        isFitActive={isFitActive}
        onShowBulkModal={() => setShowBulkModal(true)}
        onShowBulkEdgeModal={() => setShowBulkEdgeModal(true)}
        nodeSpacing={nodeSpacing}
        onNodeSpacingChange={updateNodeSpacing}
      />

      <StatusIndicators
        selectedNodes={selectedNodes}
        deleteSelectedNodes={deleteSelectedNodes}
        isAddingNode={isAddingNode}
        isAddingEdge={isAddingEdge}
        sourceNodeForEdge={sourceNodeForEdge}
        selectedNode={selectedNode}
        selectedEdge={selectedEdge}
        isBoxSelecting={isBoxSelecting}
        isCtrlPressed={isCtrlPressed}
        isShiftPressed={isShiftPressed}
        isModifierPressed={isModifierPressed}
      />

      {/* 일괄 노드 추가 모달 */}
      <BulkNodeModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        onBulkAdd={handleBulkAdd}
        nodeTypes={nodeTypes}
        onTypeUpdate={handleTypeUpdate}
        showError={showError}
        showSuccess={showSuccess}
        showInfo={showInfo}
      />

      {/* 일괄 엣지 추가 모달 */}
      <BulkEdgeModal
        isOpen={showBulkEdgeModal}
        onClose={() => setShowBulkEdgeModal(false)}
        onBulkAdd={handleBulkEdgeAdd}
        edgeTypes={edgeTypes}
        graphData={data}
        onTypeUpdate={handleEdgeTypeUpdate}
        showError={showError}
        showSuccess={showSuccess}
        showInfo={showInfo}
        askWarningConfirm={askWarningConfirm}
      />

      {/* 컨텍스트 메뉴 */}
      <ContextMenu
        visible={contextMenu.visible}
        position={contextMenu.position}
        type={contextMenu.type}
        targetId={contextMenu.targetId}
        onClose={closeContextMenu}
        onEdit={handleContextMenuEdit}
        onDelete={handleContextMenuDelete}
        onAddEdge={handleContextMenuAddEdge}
      />

      {/* Edit 모달 */}
      <EditModal
        isOpen={editModal.isOpen}
        onClose={closeEditModal}
        type={editModal.type}
        data={editModal.data}
        graphData={data}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeUpdate={onNodeUpdate}
        onNodeDelete={() => {
          if (onNodeDelete && editModal.data) {
            onNodeDelete(editModal.data.id);
          }
        }}
        onEdgeUpdate={onEdgeUpdate}
        onEdgeDelete={() => {
          if (onEdgeDelete && editModal.data) {
            onEdgeDelete(editModal.data.id);
          }
        }}
        askWarningConfirm={askWarningConfirm}
      />
    </div>
  );
};

export default KnowledgeGraph;