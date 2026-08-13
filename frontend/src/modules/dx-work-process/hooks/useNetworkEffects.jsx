import { useEffect } from 'react';
import { getNodeStyle } from '../utils/colorUtils.js';
import { getNetworkOptions } from '../utils/networkOptions';
import { applyGridLayout, applyCircularLayout, updateCursor, updateHighlights } from '../utils/layoutUtils';

export const useNetworkEffects = ({
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
}) => {
  // 다중 선택 시각적 업데이트 - 자연스러운 움직임 보장
  useEffect(() => {
    if (!nodesRef.current || !networkRef.current) return;
    
    // 현재 노드 위치를 저장하되, physics 상태는 유지
    const currentPositions = {};
    data.nodes.forEach(node => {
      try {
        const position = networkRef.current.getPosition(node.id);
        if (position && !isNaN(position.x) && !isNaN(position.y)) {
          currentPositions[node.id] = position;
        }
      } catch (error) {
        // 위치를 가져올 수 없는 경우 무시
      }
    });
    
    const updatedNodes = data.nodes.map(node => {
      const style = getNodeStyle(node.type, nodeTypes);
      const isSelected = selectedNodes.has(node.id);
      const currentPosition = currentPositions[node.id];
      const currentNode = nodesRef.current.get(node.id);

      return {
        ...node,
        ...style,
        size: node.size || 25,
        // 현재 위치가 있으면 보존하되, physics 상태도 반드시 보존
        ...(currentPosition && {
          x: currentPosition.x,
          y: currentPosition.y,
          // 기존 physics 상태를 반드시 유지 (강제로 true로 설정하지 않음)
          physics: currentNode && currentNode.physics !== undefined ? currentNode.physics : false
        }),
        borderWidth: isSelected ? 6 : (style.borderWidth || 2),
        borderColor: isSelected ? '#e74c3c' : style.borderColor,
        shadow: isSelected ? {
          enabled: true,
          color: '#e74c3c',
          size: 15,
          x: 0,
          y: 0
        } : style.shadow,
        font: isSelected ? {
          ...style.font,
          color: '#ffffff',
          strokeWidth: 2,
          strokeColor: '#e74c3c'
        } : style.font
      };
    });
    
    nodesRef.current.update(updatedNodes);
  }, [selectedNodes, nodeTypes, layoutType]);

  // 데이터 업데이트 - 새로운 노드만 추가하고 기존 노드 위치는 보존
  useEffect(() => {
    if (!nodesRef.current || !edgesRef.current || !data) return;

    // 현재 노드들의 ID 목록
    const currentNodeIds = new Set(nodesRef.current.getIds());
    const newNodeIds = new Set(data.nodes.map(node => node.id));
    
    // 삭제된 노드 제거
    const nodesToRemove = [...currentNodeIds].filter(id => !newNodeIds.has(id));
    if (nodesToRemove.length > 0) {
      nodesRef.current.remove(nodesToRemove);
    }
    
    // 새로운 노드만 추가하거나 기존 노드의 스타일만 업데이트
    const currentPositions = {};
    if (networkRef.current) {
      data.nodes.forEach(node => {
        if (currentNodeIds.has(node.id)) {
          try {
            const position = networkRef.current.getPosition(node.id);
            if (position && !isNaN(position.x) && !isNaN(position.y)) {
              currentPositions[node.id] = position;
            }
          } catch (error) {
            // 위치를 가져올 수 없는 경우 무시
          }
        }
      });
    }
    
    const nodesToUpdate = data.nodes.map(node => {
      const style = getNodeStyle(node.type, nodeTypes);
      const currentPosition = currentPositions[node.id];
      const isNewNode = !currentNodeIds.has(node.id);
      const currentNode = nodesRef.current.get(node.id);

      return {
        ...node,
        ...style,
        size: node.size || 25,
        // 기존 노드는 현재 위치와 physics 상태를 모두 보존
        ...(currentPosition && !isNewNode && {
          x: currentPosition.x,
          y: currentPosition.y,
          // physics 상태를 강제로 변경하지 않고 보존
          physics: currentNode && currentNode.physics !== undefined ? currentNode.physics : false
        }),
        // 새 노드는 물리 시뮬레이션 활성화
        ...(isNewNode && {
          physics: layoutType === 'force-directed',
          ...(layoutType === 'force-directed' && {
            x: (Math.random() - 0.5) * 200,
            y: (Math.random() - 0.5) * 200
          })
        })
      };
    });
    
    // 새 노드 추가 또는 기존 노드 업데이트
    const newNodes = nodesToUpdate.filter(node => !currentNodeIds.has(node.id));
    const existingNodes = nodesToUpdate.filter(node => currentNodeIds.has(node.id));
    
    if (newNodes.length > 0) {
      nodesRef.current.add(newNodes);
    }
    if (existingNodes.length > 0) {
      nodesRef.current.update(existingNodes);
    }
    
    // 엣지 업데이트 - 기존 엣지는 update, 새 엣지는 add, 삭제된 엣지는 remove
    const currentEdgeIds = new Set(edgesRef.current.getIds());
    const newEdgeIds = new Set(data.edges.map(edge => edge.id));

    // 삭제된 엣지 제거
    const edgesToRemove = [...currentEdgeIds].filter(id => !newEdgeIds.has(id));
    if (edgesToRemove.length > 0) {
      console.log('🗑️ 엣지 제거:', edgesToRemove);
      edgesRef.current.remove(edgesToRemove);
    }

    // 새로운 엣지와 업데이트할 엣지 분리
    // arrows 속성이 없는 경우 기본값 설정하여 화살표가 표시되도록 함
    const ensureArrows = (edge) => ({
      ...edge,
      arrows: edge.arrows || { to: { enabled: true, scaleFactor: 1 } }
    });

    const edgesToAdd = data.edges.filter(edge => !currentEdgeIds.has(edge.id)).map(ensureArrows);
    const edgesToUpdate = data.edges.filter(edge => currentEdgeIds.has(edge.id)).map(ensureArrows);

    if (edgesToAdd.length > 0) {
      console.log('➕ 엣지 추가:', edgesToAdd.map(e => ({ id: e.id, label: e.label, arrows: e.arrows })));
      edgesRef.current.add(edgesToAdd);
    }
    if (edgesToUpdate.length > 0) {
      console.log('🔄 엣지 업데이트:', edgesToUpdate.map(e => ({ id: e.id, label: e.label, arrows: e.arrows })));
      edgesRef.current.update(edgesToUpdate);
    }
    
  }, [data, nodeTypes]);

  // 레이아웃 변경 - 명시적인 레이아웃 변경 시에만 위치 리셋
  useEffect(() => {
    if (!networkRef.current || !nodesRef.current) return;

    // 레이아웃 변경 시에만 노드 위치를 리셋
    const resetNodes = data.nodes.map(node => {
      const style = getNodeStyle(node.type, nodeTypes);
      return {
        ...node,
        ...style,
        size: node.size || 25,
        physics: true,
        fixed: false,
        x: undefined,
        y: undefined
      };
    });
    
    nodesRef.current.update(resetNodes);

    const options = getNetworkOptions(layoutType);
    networkRef.current.setOptions(options);
    
    // 물리 시뮬레이션 시작
    if (layoutType === 'force-directed') {
      networkRef.current.physics.startSimulation();
    }

    setTimeout(() => {
      if (layoutType === 'grid') {
        applyGridLayout(networkRef, nodesRef);
      } else if (layoutType === 'circular') {
        applyCircularLayout(networkRef, nodesRef);
      }
    }, 100);

  }, [layoutType]);

  // 하이라이트 노드/엣지 업데이트 - 위치에 영향을 주지 않음
  useEffect(() => {
    updateHighlights({
      data,
      nodesRef,
      edgesRef,
      networkRef,
      highlightedNodes,
      highlightedEdges,
      selectedNode,
      selectedEdge,
      nodeTypes
    });
  }, [highlightedNodes, highlightedEdges, selectedNode, selectedEdge]);

  // 노드/엣지 추가 모드에서 커서 스타일 업데이트
  useEffect(() => {
    updateCursor(networkRef, isAddingNode, isAddingEdge);
  }, [isAddingNode, isAddingEdge]);
};