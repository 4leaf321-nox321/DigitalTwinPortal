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
  onContextMenu, // 우클릭 이벤트 핸들러 추가
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

    // 엣지에 arrows 속성 설정 (서버에서 불러온 데이터에 arrows가 없는 경우 대비)
    const styledEdges = data.edges.map(edge => ({
      ...edge,
      arrows: edge.arrows || { to: { enabled: true, scaleFactor: 1 } }
    }));

    // 데이터셋 생성
    nodesRef.current = new DataSet(styledNodes);
    edgesRef.current = new DataSet(styledEdges);

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
          // Ctrl, Meta(Mac), 또는 Shift 키로 다중 선택 지원
          const isMultiSelectKey = event?.ctrlKey || event?.metaKey || event?.shiftKey;
          toggleNodeSelection(nodeId, isMultiSelectKey);
        } else {
          clearNodeSelection();
        }
      },
      onEdgeClick,
      updateIsAddingNode: () => {},
      updateCursor: () => {},
      layoutType
    });

    // 우클릭 이벤트 (컨텍스트 메뉴) 등록
    if (onContextMenu) {
      networkRef.current.on('oncontext', (params) => {
        params.event.preventDefault();

        const nodeId = networkRef.current.getNodeAt(params.pointer.DOM);
        const edgeId = networkRef.current.getEdgeAt(params.pointer.DOM);

        onContextMenu({
          type: nodeId ? 'node' : (edgeId ? 'edge' : 'canvas'),
          targetId: nodeId || edgeId || null,
          position: {
            x: params.event.clientX,
            y: params.event.clientY
          },
          pointer: params.pointer
        });
      });
    }

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
          // Ctrl, Meta(Mac), 또는 Shift 키로 다중 선택 지원
          const isMultiSelectKey = event?.ctrlKey || event?.metaKey || event?.shiftKey;
          toggleNodeSelection(nodeId, isMultiSelectKey);
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