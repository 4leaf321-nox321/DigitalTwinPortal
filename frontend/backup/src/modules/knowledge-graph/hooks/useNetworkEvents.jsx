import { useEffect } from 'react';
import { Network } from 'vis-network/standalone/esm/vis-network';
import { DataSet } from 'vis-data/esnext';
import { getNodeStyle } from '../utils/colorUtils.js';
import { getNetworkOptions } from '../utils/networkOptions';
import { setupNetworkEventListeners } from './useKnowledgeGraphEvents';

export const useNetworkEvents = ({
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
  nodeTypes,
  layoutType
}) => {
  // 네트워크 초기화
  useEffect(() => {
    if (!containerRef.current || !data) return;

    // 노드에 스타일 적용
    const styledNodes = data.nodes.map(node => {
      const style = getNodeStyle(node.type, nodeTypes);
      return {
        ...node,
        ...style,
        size: node.size || 25
      };
    });

    // 데이터셋 생성
    nodesRef.current = new DataSet(styledNodes);
    edgesRef.current = new DataSet(data.edges);

    // 네트워크 옵션 설정
    const options = getNetworkOptions(layoutType);

    // 네트워크 생성
    networkRef.current = new Network(
      containerRef.current,
      {
        nodes: nodesRef.current,
        edges: edgesRef.current
      },
      options
    );

    // 이벤트 리스너 등록
    setupNetworkEventListeners({
      networkRef,
      nodesRef,
      isAddingNodeRef: { current: isAddingNode },
      isAddingEdgeRef: { current: isAddingEdge },
      handleAddNodeClick,
      handleAddEdgeClick,
      onNodeClick: (nodeId, event) => {
        if (nodeId) {
          toggleNodeSelection(nodeId, event?.ctrlKey || event?.metaKey);
        } else {
          clearNodeSelection();
        }
      },
      onEdgeClick,
      updateIsAddingNode: () => {},
      updateCursor: () => {},
      layoutType
    });

    return () => {
      if (networkRef.current) {
        networkRef.current.destroy();
        networkRef.current = null;
      }
    };
  }, []);

  // 이벤트 리스너 재등록 (상태 변화에 따른 업데이트)
  useEffect(() => {
    if (!networkRef.current) return;
    
    // 기존 리스너 제거 후 재등록
    networkRef.current.off('click');
    networkRef.current.off('doubleClick');
    
    setupNetworkEventListeners({
      networkRef,
      nodesRef,
      isAddingNodeRef: { current: isAddingNode },
      isAddingEdgeRef: { current: isAddingEdge },
      handleAddNodeClick,
      handleAddEdgeClick,
      onNodeClick: (nodeId, event) => {
        if (nodeId) {
          toggleNodeSelection(nodeId, event?.ctrlKey || event?.metaKey);
        } else {
          clearNodeSelection();
        }
      },
      onEdgeClick,
      updateIsAddingNode: () => {},
      updateCursor: () => {},
      layoutType
    });
  }, [isAddingNode, isAddingEdge]);
};