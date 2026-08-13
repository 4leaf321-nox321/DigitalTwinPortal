import { getNodeStyle } from './colorUtils.js';

/**
 * 레이아웃 관련 유틸리티 함수들
 */

/**
 * 그리드 레이아웃을 적용하는 함수
 */
export const applyGridLayout = (networkRef, nodesRef) => {
  if (!networkRef.current || !nodesRef.current) return;

  const nodeIds = nodesRef.current.getIds();
  const gridSize = Math.ceil(Math.sqrt(nodeIds.length));
  const spacing = 200;

  const updates = nodeIds.map((nodeId, index) => ({
    id: nodeId,
    x: (index % gridSize) * spacing - (gridSize * spacing / 2),
    y: Math.floor(index / gridSize) * spacing - (gridSize * spacing / 2),
    physics: false,
    fixed: true
  }));

  nodesRef.current.update(updates);
};

/**
 * 원형 레이아웃을 적용하는 함수
 */
export const applyCircularLayout = (networkRef, nodesRef) => {
  if (!networkRef.current || !nodesRef.current) return;

  const nodeIds = nodesRef.current.getIds();
  const radius = Math.max(200, nodeIds.length * 15);
  const angleStep = (2 * Math.PI) / nodeIds.length;

  const updates = nodeIds.map((nodeId, index) => ({
    id: nodeId,
    x: radius * Math.cos(index * angleStep),
    y: radius * Math.sin(index * angleStep),
    physics: true
  }));

  nodesRef.current.update(updates);
};

/**
 * 커서 스타일을 업데이트하는 함수
 */
export const updateCursor = (networkRef, isAddingNode, isAddingEdge) => {
  if (!networkRef.current) return;
  
  if (isAddingNode || isAddingEdge) {
    networkRef.current.canvas.body.container.style.cursor = 'crosshair';
  } else {
    networkRef.current.canvas.body.container.style.cursor = 'default';
  }
};

/**
 * 하이라이트를 업데이트하는 함수
 */
export const updateHighlights = ({
  data,
  nodesRef,
  edgesRef,
  networkRef,
  highlightedNodes,
  highlightedEdges,
  selectedNode,
  selectedEdge,
  nodeTypes
}) => {
  if (!data || !nodesRef.current || !edgesRef.current) return;

  const currentPositions = networkRef.current ? networkRef.current.getPositions() : {};

  // 노드 업데이트 - 개선된 스타일 적용
  const updatedNodes = data.nodes.map(node => {
    const isHighlighted = highlightedNodes.includes(node.id);
    const isSelected = selectedNode === node.id;
    const currentPos = currentPositions[node.id];
    
    // 기본 스타일 가져오기
    const baseStyle = getNodeStyle(node.type, nodeTypes);
    
    return {
      ...node,
      ...baseStyle,
      ...(currentPos && { x: currentPos.x, y: currentPos.y }),
      color: {
        ...baseStyle.color,
        background: isSelected ? '#ff4757' : (isHighlighted ? '#ffa502' : baseStyle.color.background),
        border: isSelected ? '#ff3742' : (isHighlighted ? '#ff6348' : baseStyle.color.border)
      },
      borderWidth: isSelected ? 4 : (isHighlighted ? 3 : 2),
      opacity: (!highlightedNodes.length && !selectedNode) || isHighlighted || isSelected ? 1.0 : 0.3,
      size: node.size || 25
    };
  });

  const updatedEdges = data.edges.map(edge => {
    const isHighlighted = highlightedEdges.includes(edge.id);
    const isSelected = selectedEdge === edge.id;
    const isConnectedToHighlighted = highlightedNodes.includes(edge.from) || highlightedNodes.includes(edge.to);
    const isConnectedToSelected = selectedNode === edge.from || selectedNode === edge.to;

    return {
      ...edge,
      color: {
        color: isSelected ? '#ff4757' : (isHighlighted || isConnectedToHighlighted || isConnectedToSelected ? '#ffa502' : (typeof edge.color === 'string' ? edge.color : edge.color?.color || '#666')),
        opacity: (!highlightedNodes.length && !selectedNode && !highlightedEdges.length && !selectedEdge) ||
                 isHighlighted || isSelected || isConnectedToHighlighted || isConnectedToSelected ? 1.0 : 0.1
      },
      width: isSelected ? (edge.width || 2) * 2 : (edge.width || 2),
      // 화살표 속성 명시적 보존 - 서버에서 불러온 데이터의 화살표 표시 문제 해결
      arrows: edge.arrows || { to: { enabled: true, scaleFactor: 1 } }
    };
  });

  nodesRef.current.update(updatedNodes);
  edgesRef.current.update(updatedEdges);
};