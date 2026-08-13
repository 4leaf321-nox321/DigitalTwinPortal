import { useState, useCallback, useMemo } from 'react';

export const useGraphInteraction = ({ 
  graphData, 
  searchQuery, 
  onNodeSelect, 
  onEdgeSelect 
}) => {
  const [selectedNodes, setSelectedNodes] = useState([]);
  const [selectedEdges, setSelectedEdges] = useState([]);

  // 검색에 따른 하이라이트된 노드/엣지
  const highlightedNodes = useMemo(() => {
    if (!searchQuery || !graphData) return [];
    
    const query = searchQuery.toLowerCase();
    return graphData.nodes
      .filter(node => {
        // 라벨, 타입, 속성에서 검색
        const labelMatch = node.label.toLowerCase().includes(query);
        const typeMatch = node.type.toLowerCase().includes(query);
        const propertiesMatch = node.properties && 
          Object.values(node.properties).some(value => 
            value.toString().toLowerCase().includes(query)
          );
        
        return labelMatch || typeMatch || propertiesMatch;
      })
      .map(node => node.id);
  }, [searchQuery, graphData]);

  const highlightedEdges = useMemo(() => {
    if (!searchQuery || !graphData) return [];
    
    const query = searchQuery.toLowerCase();
    return graphData.edges
      .filter(edge => {
        // 라벨, 타입, 속성에서 검색
        const labelMatch = edge.label.toLowerCase().includes(query);
        const typeMatch = edge.type.toLowerCase().includes(query);
        const propertiesMatch = edge.properties && 
          Object.values(edge.properties).some(value => 
            value.toString().toLowerCase().includes(query)
          );
        
        return labelMatch || typeMatch || propertiesMatch;
      })
      .map(edge => edge.id);
  }, [searchQuery, graphData]);

  // 노드 클릭 처리
  const handleNodeClick = useCallback((nodeId) => {
    if (nodeId) {
      onNodeSelect(nodeId);
      onEdgeSelect(null);
      setSelectedNodes([nodeId]);
      setSelectedEdges([]);
    } else {
      onNodeSelect(null);
      setSelectedNodes([]);
    }
  }, [onNodeSelect, onEdgeSelect]);

  // 엣지 클릭 처리
  const handleEdgeClick = useCallback((edgeId) => {
    if (edgeId) {
      onEdgeSelect(edgeId);
      onNodeSelect(null);
      setSelectedEdges([edgeId]);
      setSelectedNodes([]);
    } else {
      onEdgeSelect(null);
      setSelectedEdges([]);
    }
  }, [onNodeSelect, onEdgeSelect]);

  // 다중 선택 처리
  const handleMultiSelect = useCallback((nodeIds = [], edgeIds = []) => {
    setSelectedNodes(nodeIds);
    setSelectedEdges(edgeIds);
    
    // 단일 선택인 경우에만 콜백 호출
    if (nodeIds.length === 1 && edgeIds.length === 0) {
      onNodeSelect(nodeIds[0]);
      onEdgeSelect(null);
    } else if (edgeIds.length === 1 && nodeIds.length === 0) {
      onEdgeSelect(edgeIds[0]);
      onNodeSelect(null);
    } else {
      onNodeSelect(null);
      onEdgeSelect(null);
    }
  }, [onNodeSelect, onEdgeSelect]);

  // 검색 처리
  const handleSearch = useCallback((query) => {
    // 검색어가 있으면 하이라이트, 없으면 모든 하이라이트 제거
    // highlightedNodes와 highlightedEdges는 useMemo로 자동 업데이트됨
  }, []);

  // 선택 해제
  const clearSelection = useCallback(() => {
    setSelectedNodes([]);
    setSelectedEdges([]);
    onNodeSelect(null);
    onEdgeSelect(null);
  }, [onNodeSelect, onEdgeSelect]);

  // 노드 주변 네트워크 강조
  const highlightNodeNeighbors = useCallback((nodeId) => {
    if (!graphData || !nodeId) return { nodes: [], edges: [] };
    
    const connectedEdges = graphData.edges.filter(
      edge => edge.from === nodeId || edge.to === nodeId
    );
    
    const neighborNodes = new Set();
    connectedEdges.forEach(edge => {
      if (edge.from === nodeId) neighborNodes.add(edge.to);
      if (edge.to === nodeId) neighborNodes.add(edge.from);
    });
    
    return {
      nodes: [nodeId, ...Array.from(neighborNodes)],
      edges: connectedEdges.map(edge => edge.id)
    };
  }, [graphData]);

  // 경로 찾기 (간단한 BFS)
  const findPath = useCallback((startNodeId, endNodeId) => {
    if (!graphData || !startNodeId || !endNodeId) return [];
    
    const queue = [[startNodeId]];
    const visited = new Set([startNodeId]);
    
    while (queue.length > 0) {
      const path = queue.shift();
      const currentNode = path[path.length - 1];
      
      if (currentNode === endNodeId) {
        return path;
      }
      
      // 현재 노드와 연결된 모든 노드 찾기
      const connectedNodes = graphData.edges
        .filter(edge => edge.from === currentNode || edge.to === currentNode)
        .map(edge => edge.from === currentNode ? edge.to : edge.from)
        .filter(nodeId => !visited.has(nodeId));
      
      connectedNodes.forEach(nodeId => {
        visited.add(nodeId);
        queue.push([...path, nodeId]);
      });
    }
    
    return []; // 경로를 찾을 수 없음
  }, [graphData]);

  return {
    selectedNodes,
    selectedEdges,
    highlightedNodes,
    highlightedEdges,
    handleNodeClick,
    handleEdgeClick,
    handleMultiSelect,
    handleSearch,
    clearSelection,
    highlightNodeNeighbors,
    findPath
  };
};