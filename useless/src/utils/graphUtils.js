// 그래프 데이터 처리 유틸리티

/**
 * 노드와 엣지 데이터의 유효성을 검증
 */
export const validateGraphData = (data) => {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: '데이터가 유효하지 않습니다.' };
  }

  if (!Array.isArray(data.nodes)) {
    return { valid: false, error: '노드 데이터가 배열이 아닙니다.' };
  }

  if (!Array.isArray(data.edges)) {
    return { valid: false, error: '엣지 데이터가 배열이 아닙니다.' };
  }

  // 노드 ID 중복 검사
  const nodeIds = data.nodes.map(node => node.id);
  const uniqueNodeIds = new Set(nodeIds);
  if (nodeIds.length !== uniqueNodeIds.size) {
    return { valid: false, error: '중복된 노드 ID가 있습니다.' };
  }

  // 필수 노드 속성 검사
  for (const node of data.nodes) {
    if (!node.id || !node.label) {
      return { valid: false, error: '노드에 필수 속성(id, label)이 없습니다.' };
    }
  }

  // 엣지 유효성 검사
  for (const edge of data.edges) {
    if (!edge.id || !edge.from || !edge.to) {
      return { valid: false, error: '엣지에 필수 속성(id, from, to)이 없습니다.' };
    }
    
    // 존재하지 않는 노드 참조 검사
    if (!uniqueNodeIds.has(edge.from) || !uniqueNodeIds.has(edge.to)) {
      return { valid: false, error: `존재하지 않는 노드를 참조하는 엣지가 있습니다: ${edge.id}` };
    }
  }

  return { valid: true };
};

/**
 * 노드의 연결 정보를 계산
 */
export const calculateNodeConnections = (nodeId, edges) => {
  const connections = {
    incoming: [],
    outgoing: [],
    total: 0
  };

  edges.forEach(edge => {
    if (edge.to === nodeId) {
      connections.incoming.push(edge);
    }
    if (edge.from === nodeId) {
      connections.outgoing.push(edge);
    }
  });

  connections.total = connections.incoming.length + connections.outgoing.length;
  return connections;
};

/**
 * 그래프의 기본 통계 계산
 */
export const calculateGraphStats = (data) => {
  const stats = {
    nodeCount: data.nodes.length,
    edgeCount: data.edges.length,
    nodeTypes: {},
    edgeTypes: {},
    avgConnections: 0,
    maxConnections: 0,
    minConnections: Infinity,
    isolatedNodes: 0
  };

  // 노드 타입별 집계
  data.nodes.forEach(node => {
    const type = node.type || 'unknown';
    stats.nodeTypes[type] = (stats.nodeTypes[type] || 0) + 1;
  });

  // 엣지 타입별 집계
  data.edges.forEach(edge => {
    const type = edge.type || 'unknown';
    stats.edgeTypes[type] = (stats.edgeTypes[type] || 0) + 1;
  });

  // 연결 통계 계산
  const connectionCounts = data.nodes.map(node => {
    const connections = calculateNodeConnections(node.id, data.edges);
    return connections.total;
  });

  if (connectionCounts.length > 0) {
    stats.avgConnections = connectionCounts.reduce((sum, count) => sum + count, 0) / connectionCounts.length;
    stats.maxConnections = Math.max(...connectionCounts);
    stats.minConnections = Math.min(...connectionCounts);
    stats.isolatedNodes = connectionCounts.filter(count => count === 0).length;
  }

  return stats;
};

/**
 * 두 노드 간의 최단 경로 찾기 (BFS 알고리즘)
 */
export const findShortestPath = (startNodeId, endNodeId, edges) => {
  if (startNodeId === endNodeId) {
    return [startNodeId];
  }

  // 인접 리스트 생성
  const adjacencyList = {};
  edges.forEach(edge => {
    if (!adjacencyList[edge.from]) {
      adjacencyList[edge.from] = [];
    }
    if (!adjacencyList[edge.to]) {
      adjacencyList[edge.to] = [];
    }
    adjacencyList[edge.from].push(edge.to);
    adjacencyList[edge.to].push(edge.from); // 양방향으로 처리
  });

  // BFS
  const queue = [[startNodeId]];
  const visited = new Set([startNodeId]);

  while (queue.length > 0) {
    const path = queue.shift();
    const currentNode = path[path.length - 1];

    if (currentNode === endNodeId) {
      return path;
    }

    const neighbors = adjacencyList[currentNode] || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([...path, neighbor]);
      }
    }
  }

  return null; // 경로를 찾을 수 없음
};

/**
 * 노드의 이웃 노드들을 찾기
 */
export const findNodeNeighbors = (nodeId, edges, depth = 1) => {
  let neighbors = new Set();
  let currentLevel = new Set([nodeId]);
  
  for (let i = 0; i < depth; i++) {
    const nextLevel = new Set();
    
    currentLevel.forEach(currentNodeId => {
      edges.forEach(edge => {
        if (edge.from === currentNodeId) {
          nextLevel.add(edge.to);
          neighbors.add(edge.to);
        }
        if (edge.to === currentNodeId) {
          nextLevel.add(edge.from);
          neighbors.add(edge.from);
        }
      });
    });
    
    currentLevel = nextLevel;
  }
  
  neighbors.delete(nodeId); // 자기 자신 제외
  return Array.from(neighbors);
};

/**
 * 그래프에서 클러스터 감지 (간단한 연결 컴포넌트 찾기)
 */
export const findClusters = (nodes, edges) => {
  const visited = new Set();
  const clusters = [];
  
  // 인접 리스트 생성
  const adjacencyList = {};
  nodes.forEach(node => {
    adjacencyList[node.id] = [];
  });
  
  edges.forEach(edge => {
    adjacencyList[edge.from].push(edge.to);
    adjacencyList[edge.to].push(edge.from);
  });
  
  // DFS로 연결된 컴포넌트 찾기
  const dfs = (nodeId, cluster) => {
    visited.add(nodeId);
    cluster.push(nodeId);
    
    adjacencyList[nodeId].forEach(neighborId => {
      if (!visited.has(neighborId)) {
        dfs(neighborId, cluster);
      }
    });
  };
  
  nodes.forEach(node => {
    if (!visited.has(node.id)) {
      const cluster = [];
      dfs(node.id, cluster);
      clusters.push(cluster);
    }
  });
  
  return clusters;
};

/**
 * 노드 위치를 그리드 패턴으로 배치
 */
export const arrangeNodesInGrid = (nodes, spacing = 200) => {
  const gridSize = Math.ceil(Math.sqrt(nodes.length));
  
  return nodes.map((node, index) => ({
    ...node,
    x: (index % gridSize) * spacing - (gridSize * spacing / 2),
    y: Math.floor(index / gridSize) * spacing - (gridSize * spacing / 2),
    physics: false
  }));
};

/**
 * 노드를 원형으로 배치
 */
export const arrangeNodesInCircle = (nodes, radius = 300) => {
  const angleStep = (2 * Math.PI) / nodes.length;
  
  return nodes.map((node, index) => ({
    ...node,
    x: radius * Math.cos(index * angleStep),
    y: radius * Math.sin(index * angleStep),
    physics: false
  }));
};

/**
 * 검색 쿼리에 따른 노드/엣지 필터링
 */
export const searchGraphData = (data, query) => {
  if (!query || query.trim() === '') {
    return {
      nodes: [],
      edges: []
    };
  }
  
  const lowerQuery = query.toLowerCase();
  const matchingNodes = [];
  const matchingEdges = [];
  
  // 노드 검색
  data.nodes.forEach(node => {
    const labelMatch = node.label.toLowerCase().includes(lowerQuery);
    const typeMatch = node.type.toLowerCase().includes(lowerQuery);
    const propertiesMatch = node.properties && 
      Object.values(node.properties).some(value => 
        value.toString().toLowerCase().includes(lowerQuery)
      );
    
    if (labelMatch || typeMatch || propertiesMatch) {
      matchingNodes.push(node.id);
    }
  });
  
  // 엣지 검색
  data.edges.forEach(edge => {
    const labelMatch = edge.label.toLowerCase().includes(lowerQuery);
    const typeMatch = edge.type.toLowerCase().includes(lowerQuery);
    const propertiesMatch = edge.properties && 
      Object.values(edge.properties).some(value => 
        value.toString().toLowerCase().includes(lowerQuery)
      );
    
    if (labelMatch || typeMatch || propertiesMatch) {
      matchingEdges.push(edge.id);
    }
  });
  
  return {
    nodes: matchingNodes,
    edges: matchingEdges
  };
};

/**
 * 그래프 데이터를 JSON으로 내보내기
 */
export const exportGraphData = (data, filename = 'graph-data.json') => {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * JSON 파일에서 그래프 데이터 가져오기
 */
export const importGraphData = (file) => {
  return new Promise((resolve, reject) => {
    if (!file || file.type !== 'application/json') {
      reject(new Error('JSON 파일만 지원됩니다.'));
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        const validation = validateGraphData(data);
        
        if (!validation.valid) {
          reject(new Error(validation.error));
          return;
        }
        
        resolve(data);
      } catch (error) {
        reject(new Error('JSON 파일 파싱 중 오류가 발생했습니다.'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('파일 읽기 중 오류가 발생했습니다.'));
    };
    
    reader.readAsText(file);
  });
};
