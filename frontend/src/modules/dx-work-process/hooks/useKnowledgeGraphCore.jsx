import { useState, useRef } from 'react';
import { getNodeStyle, getEdgeColorByType } from '../utils/colorUtils.js';
import { useKnowledgeGraphEvents } from './useKnowledgeGraphEvents';

export const useKnowledgeGraphCore = ({
  networkRef,
  nodesRef,
  data,
  nodeTypes,
  edgeTypes,
  onNodeAdd,
  onEdgeAdd,
  setIsFitActive,
  // Delete 키 처리를 위한 추가 매개변수
  deleteSelectedNodes,
  selectedNodes,
  // 엣지 삭제를 위한 매개변수
  deleteSelectedEdge,
  selectedEdge
}) => {
  // 상태를 ref로도 관리하여 이벤트 리스너에서 최신 값 참조
  const isAddingNodeRef = useRef(false);
  const isAddingEdgeRef = useRef(false);
  const sourceNodeForEdgeRef = useRef(null);
  
  const [isAddingNode, setIsAddingNode] = useState(false);
  const [isAddingEdge, setIsAddingEdge] = useState(false);
  const [tempNode, setTempNode] = useState(null);
  const [sourceNodeForEdge, setSourceNodeForEdge] = useState(null);
  const [nodeSpacing, setNodeSpacing] = useState(120); // 기본 노드 간격

  // 상태 업데이트 함수들 - ref와 동기화
  const updateIsAddingNode = (value) => {
    setIsAddingNode(value);
    isAddingNodeRef.current = value;
  };

  const updateIsAddingEdge = (value) => {
    setIsAddingEdge(value);
    isAddingEdgeRef.current = value;
  };

  const updateSourceNodeForEdge = (value) => {
    setSourceNodeForEdge(value);
    sourceNodeForEdgeRef.current = value;
  };

  // 컨트롤 함수들
  const handleFitToView = (setIsFitActive) => {
    if (networkRef.current) {
      setIsFitActive(true);
      networkRef.current.fit({
        animation: {
          duration: 1000,
          easingFunction: 'easeInOutQuart'
        }
      });
      setTimeout(() => setIsFitActive(false), 1000);
    }
  };

  const handleZoomIn = () => {
    if (networkRef.current) {
      const scale = networkRef.current.getScale();
      networkRef.current.moveTo({ scale: scale * 1.2 });
    }
  };

  const handleZoomOut = () => {
    if (networkRef.current) {
      const scale = networkRef.current.getScale();
      networkRef.current.moveTo({ scale: scale * 0.8 });
    }
  };

  const togglePhysics = () => {
    if (networkRef.current) {
      const options = networkRef.current.physics.options;
      const newPhysicsState = !options.enabled;
      
      networkRef.current.setOptions({
        physics: { 
          enabled: newPhysicsState,
          stabilization: { 
            enabled: newPhysicsState,
            iterations: newPhysicsState ? 150 : 0
          }
        }
      });
      
      if (newPhysicsState) {
        networkRef.current.physics.startSimulation();
        setTimeout(() => {
          if (networkRef.current && networkRef.current.physics) {
            networkRef.current.setOptions({
              physics: {
                enabled: true,
                forceAtlas2Based: {
                  damping: 0.95
                }
              }
            });
            
            setTimeout(() => {
              if (networkRef.current && networkRef.current.physics) {
                networkRef.current.setOptions({
                  physics: { enabled: false }
                });
              }
            }, 2000);
          }
        }, 4000);
      }
    }
  };

  // 노드 간격 조절
  const updateNodeSpacing = (spacing) => {
    setNodeSpacing(spacing);

    if (networkRef.current) {
      // physics 옵션 업데이트
      networkRef.current.setOptions({
        physics: {
          enabled: true,
          forceAtlas2Based: {
            springLength: spacing,
            gravitationalConstant: -35 - (spacing - 120) * 0.2, // 간격에 따라 중력도 조절
            centralGravity: 0.0005,
            springConstant: 0.25,
            damping: 0.9,
            avoidOverlap: 0.6
          }
        }
      });

      // 시뮬레이션 시작
      networkRef.current.physics.startSimulation();

      // 일정 시간 후 physics 비활성화
      setTimeout(() => {
        if (networkRef.current) {
          networkRef.current.setOptions({
            physics: { enabled: false }
          });
        }
      }, 2000);
    }
  };

  const reapplyLayout = () => {
    if (!networkRef.current) return;
    
    const resetNodes = data.nodes.map(node => {
      const style = getNodeStyle(node.type, nodeTypes);
      return {
        ...node,
        ...style,
        physics: true,
        fixed: false,
        x: undefined,
        y: undefined
      };
    });
    
    nodesRef.current.update(resetNodes);
    
    networkRef.current.setOptions({
      physics: { 
        enabled: true,
        stabilization: { 
          enabled: true,
          iterations: 200,
          updateInterval: 20
        }
      }
    });
    
    networkRef.current.physics.startSimulation();
    
    setTimeout(() => {
      if (networkRef.current && networkRef.current.physics) {
        networkRef.current.setOptions({
          physics: {
            enabled: true,
            forceAtlas2Based: {
              damping: 0.95
            }
          }
        });
        
        setTimeout(() => {
          if (networkRef.current) {
            networkRef.current.setOptions({
              physics: { enabled: false }
            });
          }
        }, 2000);
      }
    }, 3000);
  };

  // 노드/엣지 추가 핸들러
  const handleAddNodeClick = (params) => {
    // 사용 가능한 첫 번째 노드 타입 선택 (unknown 우선, 없으면 첫 번째)
    const defaultNodeType = nodeTypes.length > 0
      ? (nodeTypes.find(t => t.id === 'unknown') || nodeTypes[0])
      : { id: 'unknown', label: '알 수 없음' };

    const nodeStyle = getNodeStyle(defaultNodeType.id, nodeTypes);
    const newNode = {
      id: `node_${Date.now()}`,
      label: '새 노드',
      type: defaultNodeType.id,
      properties: {},
      ...nodeStyle,
      size: 25,
      x: params.pointer.canvas.x,
      y: params.pointer.canvas.y,
      physics: true
    };

    onNodeAdd(newNode);
    setTempNode(null);
  };

  const handleAddEdgeClick = (params) => {
    if (params.nodes.length > 0) {
      const clickedNode = params.nodes[0];
      
      if (!sourceNodeForEdgeRef.current) {
        updateSourceNodeForEdge(clickedNode);
      } else if (sourceNodeForEdgeRef.current !== clickedNode) {
        const defaultEdgeType = edgeTypes.length > 0 
          ? edgeTypes.find(t => t.id === 'unknown') || edgeTypes[0]
          : { id: 'unknown', label: '알 수 없음' };
        
        const newEdge = {
          id: `edge_${Date.now()}`,
          from: sourceNodeForEdgeRef.current,
          to: clickedNode,
          // defaultEdgeLabel이 있으면 사용, 없으면 타입 label 사용
          label: defaultEdgeType.defaultEdgeLabel || defaultEdgeType.label,
          type: defaultEdgeType.id,
          properties: {},
          color: getEdgeColorByType(defaultEdgeType.id, edgeTypes),
          width: 2
        };

        onEdgeAdd(newEdge);
        updateIsAddingEdge(false);
        updateSourceNodeForEdge(null);
      }
    }
  };

  const handleBulkAddNodes = (nodes) => {
    let centerX = 0, centerY = 0;
    if (networkRef.current) {
      try {
        const viewPosition = networkRef.current.getViewPosition();
        centerX = viewPosition.x || 0;
        centerY = viewPosition.y || 0;
      } catch (error) {
        centerX = 0;
        centerY = 0;
      }
    }
    
    nodes.forEach((nodeData, index) => {
      const nodeStyle = getNodeStyle(nodeData.type, nodeTypes);
      
      const gridCols = Math.min(5, nodes.length);
      const col = index % gridCols;
      const row = Math.floor(index / gridCols);
      
      const newNode = {
        id: `bulk_node_${Date.now()}_${index}`,
        label: nodeData.label,
        type: nodeData.type,
        properties: {},
        ...nodeStyle,
        size: 25,
        x: centerX + (col - (gridCols - 1) / 2) * 150,
        y: centerY + row * 100,
        physics: true
      };

      setTimeout(() => {
        if (networkRef.current && index === nodes.length - 1) {
          networkRef.current.setOptions({
            physics: {
              enabled: true,
              stabilization: { enabled: false },
              forceAtlas2Based: {
                damping: 0.9
              }
            }
          });
          
          setTimeout(() => {
            if (networkRef.current) {
              networkRef.current.setOptions({
                physics: { enabled: false }
              });
            }
          }, 1500);
        }
      }, 100);

      onNodeAdd(newNode);
    });
  };

  const handleBulkAddEdges = (edges) => {
    console.log('일괄 엣지 추가 시작:', edges);
    
    edges.forEach((edgeData, index) => {
      const edgeColor = getEdgeColorByType(edgeData.type, edgeTypes);
      
      const newEdge = {
        id: `bulk_edge_${Date.now()}_${index}`,
        from: edgeData.from,
        to: edgeData.to,
        label: edgeData.label || '',
        type: edgeData.type,
        properties: {},
        color: edgeColor,
        width: 2,
        arrows: {
          to: {
            enabled: true,
            scaleFactor: 1,
            type: 'arrow'
          }
        },
        smooth: {
          type: 'continuous'
        }
      };

      console.log('엣지 추가:', newEdge);
      onEdgeAdd(newEdge);
    });
    
    console.log('일괄 엣지 추가 완료:', edges.length, '개');
  };

  // 키보드 이벤트 훅 사용 - Delete 키 처리 매개변수 추가
  useKnowledgeGraphEvents({
    isAddingNodeRef,
    isAddingEdgeRef,
    updateIsAddingNode,
    updateIsAddingEdge,
    updateSourceNodeForEdge,
    setTempNode,
    handleFitToView: () => handleFitToView(setIsFitActive),
    deleteSelectedNodes,
    selectedNodes,
    deleteSelectedEdge,
    selectedEdge,
    togglePhysics
  });

  return {
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
  };
};