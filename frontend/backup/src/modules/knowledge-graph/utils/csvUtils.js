/**
 * Knowledge Graph 데이터의 CSV 변환을 위한 유틸리티
 */

/**
 * Knowledge Graph 데이터를 CSV 형태로 변환
 * @param {Object} graphData - 그래프 데이터 { nodes, edges }
 * @returns {Object} { nodes: Array, edges: Array } CSV 형태의 데이터
 */
export const graphDataToCSV = (graphData) => {
  const { nodes = [], edges = [] } = graphData;

  const nodesCSV = nodes.map(node => ({
    'ID': node.id,
    'Label': node.label || '',
    'Type': node.type || 'unknown',
    'Description': node.description || '',
    'Color': node.color || '',
    'Size': node.size || 20,
    'X': node.x || 0,
    'Y': node.y || 0,
    'Fixed': node.fixed ? 'true' : 'false',
    'Hidden': node.hidden ? 'true' : 'false',
    'Created At': node.createdAt || '',
    'Updated At': node.updatedAt || '',
    'Properties': node.properties ? JSON.stringify(node.properties) : '{}'
  }));

  const edgesCSV = edges.map(edge => ({
    'ID': edge.id,
    'From': edge.from,
    'To': edge.to,
    'Label': edge.label || '',
    'Type': edge.type || 'unknown',
    'Color': edge.color || '',
    'Width': edge.width || 1,
    'Arrows': edge.arrows || 'to',
    'Dashes': edge.dashes ? 'true' : 'false',
    'Hidden': edge.hidden ? 'true' : 'false',
    'Created At': edge.createdAt || '',
    'Updated At': edge.updatedAt || '',
    'Properties': edge.properties ? JSON.stringify(edge.properties) : '{}'
  }));

  return { nodes: nodesCSV, edges: edgesCSV };
};

/**
 * CSV 데이터를 Knowledge Graph 형태로 변환
 * @param {Object} csvData - { nodes: Array, edges: Array } 형태의 CSV 데이터
 * @returns {Object} 그래프 데이터 { nodes, edges }
 */
export const csvToGraphData = (csvData) => {
  const { nodes: nodesCSV = [], edges: edgesCSV = [] } = csvData;

  const nodes = nodesCSV.map((row, index) => {
    const id = row.ID || row.id || `node_${Date.now()}_${index}`;
    
    return {
      id,
      label: row.Label || row.label || id,
      type: row.Type || row.type || 'unknown',
      description: row.Description || row.description || '',
      color: row.Color || row.color || '#4a90e2',
      size: parseInt(row.Size || row.size || 20),
      x: parseFloat(row.X || row.x || 0),
      y: parseFloat(row.Y || row.y || 0),
      fixed: (row.Fixed || row.fixed || 'false').toString().toLowerCase() === 'true',
      hidden: (row.Hidden || row.hidden || 'false').toString().toLowerCase() === 'true',
      createdAt: row['Created At'] || row.createdAt || new Date().toISOString(),
      updatedAt: row['Updated At'] || row.updatedAt || new Date().toISOString(),
      properties: parseJsonSafely(row.Properties || row.properties || '{}')
    };
  });

  const edges = edgesCSV.map((row, index) => {
    const id = row.ID || row.id || `edge_${Date.now()}_${index}`;
    
    return {
      id,
      from: row.From || row.from || '',
      to: row.To || row.to || '',
      label: row.Label || row.label || '',
      type: row.Type || row.type || 'unknown',
      color: row.Color || row.color || '#848484',
      width: parseInt(row.Width || row.width || 1),
      arrows: row.Arrows || row.arrows || 'to',
      dashes: (row.Dashes || row.dashes || 'false').toString().toLowerCase() === 'true',
      hidden: (row.Hidden || row.hidden || 'false').toString().toLowerCase() === 'true',
      createdAt: row['Created At'] || row.createdAt || new Date().toISOString(),
      updatedAt: row['Updated At'] || row.updatedAt || new Date().toISOString(),
      properties: parseJsonSafely(row.Properties || row.properties || '{}')
    };
  });

  return { nodes, edges };
};

/**
 * JSON 문자열을 안전하게 파싱
 * @param {string} jsonString - JSON 문자열
 * @returns {Object} 파싱된 객체
 */
const parseJsonSafely = (jsonString) => {
  try {
    return JSON.parse(jsonString);
  } catch {
    return {};
  }
};

/**
 * Knowledge Graph CSV 데이터 유효성 검증
 * @param {Object} data - { nodes, edges } 형태의 데이터
 * @returns {Object} 검증 결과
 */
export const validateKnowledgeGraphCSVData = (data) => {
  const result = {
    isValid: true,
    errors: [],
    warnings: []
  };

  // 노드 데이터 검증
  if (data.nodes && Array.isArray(data.nodes)) {
    if (data.nodes.length === 0) {
      result.warnings.push('노드 데이터가 비어있습니다.');
    } else {
      // 노드 ID 중복 검사
      const nodeIds = data.nodes.map(node => node.ID || node.id).filter(Boolean);
      const duplicateNodeIds = nodeIds.filter((id, index) => nodeIds.indexOf(id) !== index);
      if (duplicateNodeIds.length > 0) {
        result.errors.push(`중복된 노드 ID가 있습니다: ${[...new Set(duplicateNodeIds)].join(', ')}`);
        result.isValid = false;
      }

      // 노드 레이블 검사
      data.nodes.forEach((node, index) => {
        if (!node.Label && !node.label) {
          result.warnings.push(`노드 ${index + 1}: 레이블이 없습니다.`);
        }
      });
    }
  } else if (data.nodes) {
    result.errors.push('노드 데이터가 배열 형식이 아닙니다.');
    result.isValid = false;
  }

  // 엣지 데이터 검증
  if (data.edges && Array.isArray(data.edges)) {
    if (data.edges.length > 0) {
      // 엣지 ID 중복 검사
      const edgeIds = data.edges.map(edge => edge.ID || edge.id).filter(Boolean);
      const duplicateEdgeIds = edgeIds.filter((id, index) => edgeIds.indexOf(id) !== index);
      if (duplicateEdgeIds.length > 0) {
        result.errors.push(`중복된 엣지 ID가 있습니다: ${[...new Set(duplicateEdgeIds)].join(', ')}`);
        result.isValid = false;
      }

      // 엣지 연결 검사
      const nodeIds = data.nodes ? (data.nodes.map(node => node.ID || node.id).filter(Boolean)) : [];
      data.edges.forEach((edge, index) => {
        const from = edge.From || edge.from;
        const to = edge.To || edge.to;
        
        if (!from) {
          result.warnings.push(`엣지 ${index + 1}: From 노드가 지정되지 않았습니다.`);
        } else if (nodeIds.length > 0 && !nodeIds.includes(from)) {
          result.warnings.push(`엣지 ${index + 1}: From 노드 '${from}'이 노드 목록에 없습니다.`);
        }
        
        if (!to) {
          result.warnings.push(`엣지 ${index + 1}: To 노드가 지정되지 않았습니다.`);
        } else if (nodeIds.length > 0 && !nodeIds.includes(to)) {
          result.warnings.push(`엣지 ${index + 1}: To 노드 '${to}'이 노드 목록에 없습니다.`);
        }
      });
    }
  } else if (data.edges) {
    result.errors.push('엣지 데이터가 배열 형식이 아닙니다.');
    result.isValid = false;
  }

  return result;
};

/**
 * 노드만 있는 CSV 데이터를 처리 (단일 파일 import용)
 * @param {Array} csvData - CSV 데이터 배열
 * @returns {Object} { nodes, edges } 형태의 그래프 데이터
 */
export const csvArrayToGraphData = (csvData) => {
  if (!Array.isArray(csvData) || csvData.length === 0) {
    return { nodes: [], edges: [] };
  }

  // 첫 번째 행을 확인하여 노드 데이터인지 엣지 데이터인지 판단
  const firstRow = csvData[0];
  const hasFromTo = (firstRow.From || firstRow.from) && (firstRow.To || firstRow.to);
  
  if (hasFromTo) {
    // 엣지 데이터로 판단
    return {
      nodes: [],
      edges: csvToGraphData({ nodes: [], edges: csvData }).edges
    };
  } else {
    // 노드 데이터로 판단
    return {
      nodes: csvToGraphData({ nodes: csvData, edges: [] }).nodes,
      edges: []
    };
  }
};