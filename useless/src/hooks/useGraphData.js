import { useState, useCallback, useMemo } from 'react';
import { getNodeColorByType } from '../utils/colorUtils';

export const useGraphData = (initialData, filterOptions) => {
  const [graphData, setGraphData] = useState(initialData);

  // 필터링된 데이터 처리
  const processedData = useMemo(() => {
    if (!graphData) return { nodes: [], edges: [] };

    let filteredNodes = [...graphData.nodes];
    let filteredEdges = [...graphData.edges];

    // 노드 타입 필터
    if (filterOptions.nodeTypes && filterOptions.nodeTypes.length > 0) {
      filteredNodes = filteredNodes.filter(node => 
        filterOptions.nodeTypes.includes(node.type)
      );
    }

    // 엣지 타입 필터
    if (filterOptions.edgeTypes && filterOptions.edgeTypes.length > 0) {
      filteredEdges = filteredEdges.filter(edge => 
        filterOptions.edgeTypes.includes(edge.type)
      );
    }

    // 최소 연결 수 필터
    if (filterOptions.minConnections > 0) {
      const nodeConnections = {};
      
      // 각 노드의 연결 수 계산
      filteredNodes.forEach(node => {
        nodeConnections[node.id] = filteredEdges.filter(edge => 
          edge.from === node.id || edge.to === node.id
        ).length;
      });

      // 최소 연결 수 미만인 노드 제거
      filteredNodes = filteredNodes.filter(node => 
        nodeConnections[node.id] >= filterOptions.minConnections
      );
    }

    // 연결되지 않은 엣지 제거
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    filteredEdges = filteredEdges.filter(edge => 
      nodeIds.has(edge.from) && nodeIds.has(edge.to)
    );

    return {
      nodes: filteredNodes,
      edges: filteredEdges
    };
  }, [graphData, filterOptions]);

  // 그래프 데이터 업데이트
  const updateGraphData = useCallback((action, id, data) => {
    console.log(`🔄 useGraphData: ${action} 시작`, { id, data });
    
    setGraphData(prev => {
      switch (action) {
        case 'updateNode':
          const updatedNodes = prev.nodes.map(node => 
            node.id === id ? { ...node, ...data } : node
          );
          console.log(`✅ updateNode 완료:`, updatedNodes.find(n => n.id === id));
          return {
            ...prev,
            nodes: updatedNodes
          };
        
        case 'updateEdge':
          return {
            ...prev,
            edges: prev.edges.map(edge => 
              edge.id === id ? { ...edge, ...data } : edge
            )
          };
        
        case 'addNode':
          return {
            ...prev,
            nodes: [...prev.nodes, { id, ...data }]
          };
        
        case 'addEdge':
          return {
            ...prev,
            edges: [...prev.edges, { id, ...data }]
          };
        
        case 'removeNode':
          return {
            ...prev,
            nodes: prev.nodes.filter(node => node.id !== id),
            edges: prev.edges.filter(edge => 
              edge.from !== id && edge.to !== id
            )
          };

        case 'removeMultipleNodes':
          const nodeIdsToRemove = new Set(id); // id가 배열로 전달됨
          return {
            ...prev,
            nodes: prev.nodes.filter(node => !nodeIdsToRemove.has(node.id)),
            edges: prev.edges.filter(edge => 
              !nodeIdsToRemove.has(edge.from) && !nodeIdsToRemove.has(edge.to)
            )
          };
        
        case 'removeEdge':
          return {
            ...prev,
            edges: prev.edges.filter(edge => edge.id !== id)
          };
        
        default:
          return prev;
      }
    });
  }, []);

  // 노드 추가
  const addNode = useCallback((nodeData) => {
    const newNode = {
      id: nodeData.id || `node_${Date.now()}`,
      label: nodeData.label || '새 노드',
      type: nodeData.type || 'default',
      properties: nodeData.properties || {},
      color: nodeData.color || getNodeColorByType(nodeData.type || 'default'),
      size: nodeData.size || 25,
      ...nodeData
    };
    
    setGraphData(prev => {
      const updated = {
        ...prev,
        nodes: [...prev.nodes, newNode]
      };
      return updated;
    });
  }, []);

  // 엣지 추가
  const addEdge = useCallback((edgeData) => {
    console.log('addEdge 호출됨:', edgeData);
    
    const newEdge = {
      id: edgeData.id || `edge_${Date.now()}`,
      from: edgeData.from,
      to: edgeData.to,
      label: edgeData.label || '새 관계',
      type: edgeData.type || 'default',
      properties: edgeData.properties || {},
      color: edgeData.color || '#666',
      width: edgeData.width || 2,
      ...edgeData
    };
    
    console.log('생성할 엣지:', newEdge);
    
    setGraphData(prev => {
      const updated = {
        ...prev,
        edges: [...prev.edges, newEdge]
      };
      console.log('업데이트된 그래프 데이터:', updated);
      return updated;
    });
  }, []);

  // 노드 제거
  const removeNode = useCallback((nodeId) => {
    updateGraphData('removeNode', nodeId);
  }, [updateGraphData]);

  // 다중 노드 제거
  const removeMultipleNodes = useCallback((nodeIds) => {
    console.log('🗑️ 다중 노드 삭제:', nodeIds);
    updateGraphData('removeMultipleNodes', Array.from(nodeIds));
  }, [updateGraphData]);

  // 엣지 제거
  const removeEdge = useCallback((edgeId) => {
    updateGraphData('removeEdge', edgeId);
  }, [updateGraphData]);

  // 전체 데이터 설정
  const setData = useCallback((newData) => {
    setGraphData(newData);
  }, []);

  return {
    graphData,
    processedData,
    updateGraphData,
    addNode,
    addEdge,
    removeNode,
    removeMultipleNodes,
    removeEdge,
    setData
  };
};
