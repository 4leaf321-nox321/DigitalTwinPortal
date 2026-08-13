import React, { useState, useCallback, useMemo, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
  Panel,
  useReactFlow,
  ReactFlowProvider,
  applyNodeChanges
} from 'reactflow';
import 'reactflow/dist/style.css';
import styled from 'styled-components';

import { nodeTypes } from './CustomNodes';
import { sampleNodes, sampleEdges } from './sampleData';
import AddEdgeModal from '../AddEdgeModal';
import EditNodeModal from '../EditNodeModal';
import EditGroupModal from '../EditGroupModal';
import EditArrowModal from '../EditArrowModal';
import EditDividerModal from '../EditDividerModal';
import EditEdgeModal from '../EditEdgeModal';
import CreateThreadModal from '../CreateThreadModal';
import BulkEditNodeModal from '../BulkEditNodeModal';
import { useColorSettings } from '../../contexts/ColorSettingsContext';

const DiagramContainer = styled.div`
  width: 100%;
  height: 100%;
  background: #f8fafc;
  position: relative;

  /* 그룹 노드의 기본 스타일 제거 */
  .react-flow__node-group {
    background: transparent !important;
    border: none !important;
    padding: 0 !important;
  }

  /* 모든 커스텀 노드의 기본 배경/테두리 제거 */
  .react-flow__node {
    background: transparent;
    border: none;
    padding: 0;
  }

  /* 엣지 선택 시 스타일 */
  .react-flow__edge.selected .react-flow__edge-path {
    stroke: #ef4444 !important;
    stroke-width: 3px !important;
  }

  /* 엣지 호버 시 스타일 */
  .react-flow__edge:hover .react-flow__edge-path {
    stroke: #3b82f6 !important;
    stroke-width: 3px !important;
  }

  /* 엣지 클릭 영역 확대 및 z-index 조정 */
  .react-flow__edge {
    pointer-events: all !important;
  }

  .react-flow__edge-interaction {
    pointer-events: stroke !important;
    stroke-width: 20px !important;
  }

  /* 엣지 레이어가 노드 위에 오도록 */
  .react-flow__edges {
    z-index: 5 !important;
  }
`;

const ContextMenu = styled.div`
  position: absolute;
  z-index: 1000;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border: 1px solid #e2e8f0;
  overflow: hidden;
  min-width: 160px;
`;

const ContextMenuItem = styled.div`
  padding: 10px 14px;
  font-size: 0.85rem;
  color: #374151;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;

  &:hover {
    background: #f1f5f9;
  }

  &.danger {
    color: #ef4444;
  }
`;

const AlignmentPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const AlignmentRow = styled.div`
  display: flex;
  gap: 4px;
`;

const AlignmentButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 28px;
  padding: 0 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: white;
  color: #1f2937;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover:not(:disabled) {
    background: #f3f4f6;
    border-color: #9ca3af;
  }

  &:active:not(:disabled) {
    background: #e5e7eb;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const AlignmentLabel = styled.div`
  font-size: 0.7rem;
  color: #64748b;
  text-align: center;
  margin-bottom: 4px;
`;


const LegendPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  font-size: 0.75rem;
`;

const LegendTitle = styled.div`
  font-weight: 600;
  color: #374151;
  margin-bottom: 4px;
`;

const LegendItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const LegendColor = styled.div`
  width: 16px;
  height: 16px;
  border-radius: ${props => props.shape === 'circle' ? '50%' : props.shape === 'diamond' ? '2px' : '4px'};
  background: ${props => props.color};
  transform: ${props => props.shape === 'diamond' ? 'rotate(45deg) scale(0.8)' : 'none'};
`;

const LegendLine = styled.div`
  width: 24px;
  height: 2px;
  background: ${props => props.color};
  border-style: ${props => props.dashed ? 'dashed' : 'solid'};
`;

const ThreadLegendPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  font-size: 0.75rem;
  margin-top: 8px;
`;

const ThreadLegendItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background 0.2s;

  &:hover {
    background: #f1f5f9;
  }
`;

const ThreadLegendLine = styled.div`
  width: 24px;
  height: 6px;
  background: ${props => props.color};
  border-radius: 3px;
  box-shadow: 0 0 4px ${props => props.color}, 0 0 8px ${props => props.color}80;
`;

const ThreadLegendName = styled.span`
  color: #374151;
  flex: 1;
`;

const ThreadDeleteButton = styled.button`
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  font-size: 0.7rem;

  &:hover {
    color: #ef4444;
  }
`;

const defaultEdgeOptions = {
  type: 'smoothstep',
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 20,
    height: 20,
    color: '#64748b',
  },
  style: {
    strokeWidth: 2,
    stroke: '#64748b',
  },
};

const ProcessDiagramInner = forwardRef((props, ref) => {
  const { colorItems } = useColorSettings();
  const [nodes, setNodes, defaultOnNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodes, setSelectedNodes] = useState([]);
  const [selectedEdges, setSelectedEdges] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);
  const [pendingConnection, setPendingConnection] = useState(null);
  const [isEdgeModalOpen, setIsEdgeModalOpen] = useState(false);

  // 수정 모달 상태
  const [editNodeModal, setEditNodeModal] = useState({ isOpen: false, node: null });
  const [editGroupModal, setEditGroupModal] = useState({ isOpen: false, node: null });
  const [editArrowModal, setEditArrowModal] = useState({ isOpen: false, node: null });
  const [editDividerModal, setEditDividerModal] = useState({ isOpen: false, node: null });
  const [editEdgeModal, setEditEdgeModal] = useState({ isOpen: false, edge: null });
  const [bulkEditModal, setBulkEditModal] = useState({ isOpen: false, nodes: [] });

  // 연결 시작 정보 저장 (드래그 시작 노드/핸들)
  const connectionStartRef = useRef(null);

  // 스레드 상태
  const [threads, setThreads] = useState([]); // { id, name, color, edgeIds: [] }
  const [isCreateThreadModalOpen, setIsCreateThreadModalOpen] = useState(false);

  // 다중 리사이즈를 위한 상태
  const resizeStartRef = useRef({}); // 리사이즈 시작 시 각 노드의 초기 크기 저장
  const isResizingRef = useRef(false);
  const reactFlowWrapper = useRef(null);

  // Shift+드래그를 위한 상태 (가로/세로 방향 고정)
  const dragStartPositionsRef = useRef({}); // 드래그 시작 시 각 노드의 초기 위치
  const dragAxisRef = useRef(null); // 'x' 또는 'y' 또는 null
  const isDraggingWithShiftRef = useRef(false);

  // Undo/Redo 히스토리 관리
  const historyRef = useRef([]); // 히스토리 스택
  const historyIndexRef = useRef(-1); // 현재 히스토리 위치
  const isUndoRedoRef = useRef(false); // undo/redo 중인지 여부 (무한 루프 방지)
  const maxHistorySize = 50; // 최대 히스토리 크기

  // 클립보드 (복사/붙여넣기)
  const clipboardRef = useRef({ nodes: [], edges: [] });
  const pasteCountRef = useRef(0); // 연속 붙여넣기 횟수 (오프셋 계산용)

  // 최신 상태를 ref로 유지 (stale closure 방지)
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const threadsRef = useRef(threads);
  const selectedNodesRef = useRef(selectedNodes);

  // 상태 변경 시 ref 업데이트
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);
  useEffect(() => { threadsRef.current = threads; }, [threads]);
  useEffect(() => { selectedNodesRef.current = selectedNodes; }, [selectedNodes]);

  // 컴포넌트 마운트 시 초기 히스토리 저장 (한 번만 실행)
  const isInitializedRef = useRef(false);
  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      // 초기 상태를 히스토리에 저장
      const initialSnapshot = {
        nodes: JSON.parse(JSON.stringify(nodes)),
        edges: JSON.parse(JSON.stringify(edges)),
        threads: JSON.parse(JSON.stringify(threads)),
      };
      historyRef.current = [initialSnapshot];
      historyIndexRef.current = 0;
    }
  }, []);

  const { getViewport, setViewport } = useReactFlow();

  // 현재 화면 중심의 Flow 좌표 계산
  const getViewportCenter = useCallback(() => {
    const { x, y, zoom } = getViewport();
    const wrapper = reactFlowWrapper.current;
    if (!wrapper) {
      return { x: 400, y: 300 };
    }
    const { width, height } = wrapper.getBoundingClientRect();
    // 화면 중심을 Flow 좌표로 변환
    const centerX = (width / 2 - x) / zoom;
    const centerY = (height / 2 - y) / zoom;
    return { x: centerX, y: centerY };
  }, [getViewport]);

  // 히스토리에 현재 상태 저장 (ref 사용으로 항상 최신 상태 저장)
  const saveToHistory = useCallback(() => {
    if (isUndoRedoRef.current) return; // undo/redo 중에는 저장하지 않음

    const snapshot = {
      nodes: JSON.parse(JSON.stringify(nodesRef.current)),
      edges: JSON.parse(JSON.stringify(edgesRef.current)),
      threads: JSON.parse(JSON.stringify(threadsRef.current)),
    };

    // 현재 위치 이후의 히스토리 제거 (새 분기 시작)
    const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    newHistory.push(snapshot);

    // 최대 크기 초과 시 오래된 항목 제거
    if (newHistory.length > maxHistorySize) {
      newHistory.shift();
    } else {
      historyIndexRef.current += 1;
    }

    historyRef.current = newHistory;
  }, []);

  // Undo 실행
  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0 || historyRef.current.length === 0) return; // 더 이상 되돌릴 수 없음

    isUndoRedoRef.current = true;
    historyIndexRef.current -= 1;
    const snapshot = historyRef.current[historyIndexRef.current];

    if (!snapshot) {
      isUndoRedoRef.current = false;
      return;
    }

    // ref도 함께 업데이트하여 일관성 유지
    nodesRef.current = snapshot.nodes;
    edgesRef.current = snapshot.edges;
    threadsRef.current = snapshot.threads;

    setNodes(snapshot.nodes);
    setEdges(snapshot.edges);
    setThreads(snapshot.threads);

    // 다음 틱에서 플래그 해제
    setTimeout(() => {
      isUndoRedoRef.current = false;
    }, 0);
  }, [setNodes, setEdges, setThreads]);

  // Redo 실행
  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return; // 더 이상 다시 실행할 수 없음

    isUndoRedoRef.current = true;
    historyIndexRef.current += 1;
    const snapshot = historyRef.current[historyIndexRef.current];

    if (!snapshot) {
      isUndoRedoRef.current = false;
      return;
    }

    // ref도 함께 업데이트하여 일관성 유지
    nodesRef.current = snapshot.nodes;
    edgesRef.current = snapshot.edges;
    threadsRef.current = snapshot.threads;

    setNodes(snapshot.nodes);
    setEdges(snapshot.edges);
    setThreads(snapshot.threads);

    // 다음 틱에서 플래그 해제
    setTimeout(() => {
      isUndoRedoRef.current = false;
    }, 0);
  }, [setNodes, setEdges, setThreads]);

  // 복사 함수 (ref 사용으로 항상 최신 상태 참조)
  const copySelectedNodes = useCallback(() => {
    const currentSelectedNodes = selectedNodesRef.current || [];
    const currentNodes = nodesRef.current || [];
    const currentEdges = edgesRef.current || [];

    if (!currentSelectedNodes || currentSelectedNodes.length === 0) return;

    const selectedNodeIds = currentSelectedNodes.map(n => n.id).filter(Boolean);
    if (selectedNodeIds.length === 0) return;

    // 선택된 노드들을 깊은 복사
    const copiedNodes = currentSelectedNodes.map(n => {
      const fullNode = currentNodes.find(node => node.id === n.id);
      return fullNode ? JSON.parse(JSON.stringify(fullNode)) : null;
    }).filter(Boolean);

    if (copiedNodes.length === 0) return;

    // 선택된 노드들 사이의 엣지만 복사
    const copiedEdges = currentEdges.filter(e =>
      selectedNodeIds.includes(e.source) && selectedNodeIds.includes(e.target)
    ).map(e => JSON.parse(JSON.stringify(e)));

    clipboardRef.current = { nodes: copiedNodes, edges: copiedEdges };
    pasteCountRef.current = 0; // 복사 시 붙여넣기 카운트 초기화
  }, []);

  // 붙여넣기 함수 (ref 사용으로 항상 최신 상태 참조)
  const pasteNodes = useCallback(() => {
    if (!clipboardRef.current || !clipboardRef.current.nodes || clipboardRef.current.nodes.length === 0) return;

    saveToHistory();
    pasteCountRef.current += 1;

    const offset = 30 * pasteCountRef.current; // 연속 붙여넣기 시 오프셋 증가
    const idMapping = {}; // 원본 ID -> 새 ID 매핑

    // 새 노드 생성
    const newNodes = clipboardRef.current.nodes.map(node => {
      const newId = `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      idMapping[node.id] = newId;

      return {
        ...node,
        id: newId,
        position: {
          x: node.position.x + offset,
          y: node.position.y + offset,
        },
        selected: true,
        // parentNode도 매핑해야 함 (그룹 내 노드인 경우)
        parentNode: node.parentNode ? idMapping[node.parentNode] || node.parentNode : undefined,
      };
    });

    // 새 엣지 생성 (ID 매핑 적용)
    const newEdges = clipboardRef.current.edges.map(edge => {
      const newId = `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      return {
        ...edge,
        id: newId,
        source: idMapping[edge.source] || edge.source,
        target: idMapping[edge.target] || edge.target,
      };
    });

    // 기존 노드들의 선택 해제 후 새 노드 추가
    setNodes(nds => [
      ...nds.map(n => ({ ...n, selected: false })),
      ...newNodes,
    ]);

    if (newEdges.length > 0) {
      setEdges(eds => [...eds, ...newEdges]);
    }
  }, [setNodes, setEdges, saveToHistory]);

  // Ctrl+Z, Ctrl+Y, Ctrl+C, Ctrl+V 키보드 이벤트 처리
  useEffect(() => {
    const handleKeyDown = (event) => {
      // 입력 필드에서는 동작하지 않도록
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.isContentEditable) {
        return;
      }

      // Caps Lock 상태와 관계없이 동작하도록 소문자로 변환
      const key = event.key.toLowerCase();

      if (event.ctrlKey && key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((event.ctrlKey && key === 'y') || (event.ctrlKey && event.shiftKey && key === 'z')) {
        event.preventDefault();
        redo();
      } else if (event.ctrlKey && key === 'c') {
        event.preventDefault();
        copySelectedNodes();
      } else if (event.ctrlKey && key === 'v') {
        event.preventDefault();
        pasteNodes();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, copySelectedNodes, pasteNodes]);

  // 커스텀 onNodesChange - 다중 선택 리사이즈 지원
  const onNodesChange = useCallback((changes) => {
    // 리사이즈 변경 감지
    const dimensionChanges = changes.filter(change => change.type === 'dimensions');

    if (dimensionChanges.length > 0 && selectedNodes.length > 1) {
      const resizingChange = dimensionChanges[0];
      const resizingNodeId = resizingChange.id;

      // 선택된 노드 중 하나가 리사이즈되는 경우에만 처리
      if (selectedNodes.some(n => n.id === resizingNodeId)) {

        // 리사이즈 시작 감지
        if (resizingChange.resizing && !isResizingRef.current) {
          isResizingRef.current = true;
          // 모든 선택된 노드의 초기 크기 저장
          selectedNodes.forEach(node => {
            const currentNode = nodes.find(n => n.id === node.id);
            if (currentNode) {
              resizeStartRef.current[node.id] = {
                width: currentNode.style?.width || currentNode.width || 160,
                height: currentNode.style?.height || currentNode.height || 80,
              };
            }
          });
        }

        // 리사이즈 중
        if (resizingChange.resizing && resizingChange.dimensions && isResizingRef.current) {
          const startSize = resizeStartRef.current[resizingNodeId];
          if (startSize) {
            const newWidth = resizingChange.dimensions.width;
            const newHeight = resizingChange.dimensions.height;

            // 크기 변화량 계산
            const deltaWidth = newWidth - startSize.width;
            const deltaHeight = newHeight - startSize.height;

            // 선택된 다른 노드들의 크기도 변경
            if (deltaWidth !== 0 || deltaHeight !== 0) {
              setNodes(nds => nds.map(node => {
                // 리사이즈 중인 노드가 아닌 선택된 노드만 처리
                if (node.id !== resizingNodeId && selectedNodes.some(n => n.id === node.id)) {
                  const nodeStartSize = resizeStartRef.current[node.id];
                  if (nodeStartSize) {
                    const newNodeWidth = Math.max(50, nodeStartSize.width + deltaWidth);
                    const newNodeHeight = Math.max(50, nodeStartSize.height + deltaHeight);

                    return {
                      ...node,
                      style: {
                        ...node.style,
                        width: newNodeWidth,
                        height: newNodeHeight,
                      },
                    };
                  }
                }
                return node;
              }));
            }
          }
        }

        // 리사이즈 종료 감지
        if (!resizingChange.resizing && isResizingRef.current) {
          isResizingRef.current = false;
          resizeStartRef.current = {};
        }
      }
    }

    // 리사이즈 종료 감지 (resizing이 false인 경우)
    dimensionChanges.forEach(change => {
      if (!change.resizing && isResizingRef.current) {
        isResizingRef.current = false;
        resizeStartRef.current = {};
      }
    });

    // 기본 변경 사항 적용
    defaultOnNodesChange(changes);
  }, [defaultOnNodesChange, selectedNodes, nodes, setNodes]);

  // 외부에서 호출 가능한 메서드 노출
  useImperativeHandle(ref, () => ({
    getViewportCenter,
    addNode: (nodeData) => {
      saveToHistory();
      const center = getViewportCenter();
      const newNode = {
        id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: nodeData.type,
        position: nodeData.position || { x: center.x - 80, y: center.y - 40 },
        data: {
          label: nodeData.label,
          description: nodeData.description,
          color: nodeData.color || '#3b82f6',
          attributes: nodeData.attributes || [],
          headerOnly: nodeData.headerOnly || false,
          textAlign: nodeData.textAlign || 'left',
          headerTextColor: nodeData.headerTextColor || 'white',
        },
      };
      setNodes((nds) => [...nds, newNode]);
    },
    addGroup: (groupData = {}) => {
      saveToHistory();
      const center = getViewportCenter();
      const newNode = {
        id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'group',
        position: { x: center.x - 150, y: center.y - 100 },
        data: {
          label: groupData.label || '새 그룹',
          color: groupData.color || '#3b82f6',
          description: groupData.description || '',
        },
        style: { width: 300, height: 200 },
      };
      setNodes((nds) => [newNode, ...nds]);
    },
    addDivider: (dividerData = {}) => {
      saveToHistory();
      const center = getViewportCenter();
      const direction = dividerData.direction || 'horizontal';
      const newNode = {
        id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'divider',
        position: { x: center.x - (direction === 'vertical' ? 10 : 200), y: center.y - (direction === 'vertical' ? 150 : 10) },
        data: {
          direction: direction,
          label: dividerData.label || '',
          color: dividerData.color || '#94a3b8',
          lineStyle: dividerData.lineStyle || 'solid',
          lineWidth: dividerData.lineWidth || 3,
        },
        style: direction === 'vertical'
          ? { width: 20, height: 300 }
          : { width: 400, height: 20 },
      };
      setNodes((nds) => [...nds, newNode]);
    },
    addArrow: (arrowData = {}) => {
      saveToHistory();
      const center = getViewportCenter();
      const newNode = {
        id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'arrow',
        position: { x: center.x - 70, y: center.y - 25 },
        data: {
          label: arrowData.label || '',
          color: arrowData.color || '#3b82f6',
          fontSize: arrowData.fontSize || '0.85rem',
        },
      };
      setNodes((nds) => [...nds, newNode]);
    },
    getDiagramData: () => {
      const { x, y, zoom } = getViewport();
      return {
        nodes,
        edges,
        viewport: { x, y, zoom },
        threads,
      };
    },
    loadDiagram: (diagramData) => {
      // 불러오기 시 히스토리 초기화
      historyRef.current = [];
      historyIndexRef.current = -1;
      const newNodes = diagramData.nodes || [];
      const newEdges = diagramData.edges || [];
      const newThreads = diagramData.threads || [];
      // ref를 먼저 업데이트
      nodesRef.current = newNodes;
      edgesRef.current = newEdges;
      threadsRef.current = newThreads;
      setNodes(newNodes);
      setEdges(newEdges);
      setThreads(newThreads);
      if (diagramData.viewport) {
        const { x, y, zoom } = diagramData.viewport;
        setViewport({ x: x || 0, y: y || 0, zoom: zoom || 1 });
      }
      // 초기 상태 저장
      setTimeout(() => {
        saveToHistory();
      }, 0);
    },
    loadSample: () => {
      historyRef.current = [];
      historyIndexRef.current = -1;
      // ref를 먼저 업데이트
      nodesRef.current = sampleNodes;
      edgesRef.current = sampleEdges;
      threadsRef.current = [];
      setNodes(sampleNodes);
      setEdges(sampleEdges);
      setThreads([]);
      setTimeout(() => {
        saveToHistory();
      }, 0);
    },
    clear: () => {
      saveToHistory();
      setNodes([]);
      setEdges([]);
      setThreads([]);
    },
    updateNodes: (updates) => {
      setNodes((nds) =>
        nds.map((node) => {
          const update = updates.find((u) => u.id === node.id);
          if (update) {
            return {
              ...node,
              data: {
                ...node.data,
                ...update.data,
              },
            };
          }
          return node;
        })
      );
    },
  }), [setNodes, setEdges, setThreads, nodes, edges, threads, getViewport, setViewport, saveToHistory, getViewportCenter]);

  // Delete 키로 선택된 노드/엣지 삭제
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        // 입력 필드에서는 동작하지 않도록
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
          return;
        }

        if (selectedNodes.length > 0 || selectedEdges.length > 0) {
          saveToHistory();
        }

        if (selectedNodes.length > 0) {
          const selectedNodeIds = selectedNodes.map(n => n.id);

          // 그룹 노드가 포함되어 있으면 그 안의 자식 노드들도 삭제 대상에 추가
          const groupNodeIds = selectedNodes.filter(n => n.type === 'group').map(n => n.id);
          const childNodeIds = nodes
            .filter(n => n.parentNode && groupNodeIds.includes(n.parentNode))
            .map(n => n.id);

          const allNodeIdsToDelete = [...new Set([...selectedNodeIds, ...childNodeIds])];

          setNodes((nds) => nds.filter((node) => !allNodeIdsToDelete.includes(node.id)));
          // 삭제된 노드와 연결된 엣지도 삭제
          setEdges((eds) => eds.filter((edge) =>
            !allNodeIdsToDelete.includes(edge.source) && !allNodeIdsToDelete.includes(edge.target)
          ));
          setSelectedNodes([]);
        }

        if (selectedEdges.length > 0) {
          const selectedEdgeIds = selectedEdges.map(e => e.id);
          setEdges((eds) => eds.filter((edge) => !selectedEdgeIds.includes(edge.id)));
          setSelectedEdges([]);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodes, selectedEdges, nodes, edges, threads, setNodes, setEdges, saveToHistory]);

  // 연결 시작 시 호출 - 드래그 시작 노드 저장
  const onConnectStart = useCallback((event, { nodeId, handleId, handleType }) => {
    connectionStartRef.current = { nodeId, handleId, handleType };
  }, []);

  // 연결 종료 시 호출 - ref 초기화
  const onConnectEnd = useCallback(() => {
    // 모달이 열려있지 않으면 초기화 (연결이 실패한 경우)
    if (!isEdgeModalOpen) {
      connectionStartRef.current = null;
    }
  }, [isEdgeModalOpen]);

  const onConnect = useCallback(
    (params) => {
      // 핸들 ID 변환 함수: target-핸들을 source-핸들로, 또는 그 반대로
      const convertHandleId = (handleId, toType) => {
        if (!handleId) return handleId;
        // 예: "top-target" -> "top-source" 또는 "top-source" -> "top-target"
        if (handleId.endsWith('-target')) {
          return toType === 'source' ? handleId.replace('-target', '-source') : handleId;
        }
        if (handleId.endsWith('-source')) {
          return toType === 'target' ? handleId.replace('-source', '-target') : handleId;
        }
        return handleId;
      };

      // 클릭 순서대로 방향 결정: 드래그 시작 노드가 source가 되어야 함
      let correctedParams = { ...params };

      if (connectionStartRef.current) {
        const startNodeId = connectionStartRef.current.nodeId;
        const startHandleId = connectionStartRef.current.handleId;
        const startHandleType = connectionStartRef.current.handleType;

        // React Flow가 source/target을 뒤집었는지 확인
        // 드래그 시작 노드가 target으로 되어있으면 뒤집어야 함
        if (params.target === startNodeId) {
          // source와 target을 교환하고, 핸들 ID도 적절히 변환
          correctedParams = {
            ...params,
            source: params.target,
            sourceHandle: convertHandleId(params.targetHandle, 'source'),
            target: params.source,
            targetHandle: convertHandleId(params.sourceHandle, 'target'),
          };
        } else {
          // 뒤집지 않아도 되지만, 핸들 타입에 맞게 ID 변환
          correctedParams = {
            ...params,
            sourceHandle: convertHandleId(params.sourceHandle, 'source'),
            targetHandle: convertHandleId(params.targetHandle, 'target'),
          };
        }
      }

      setPendingConnection(correctedParams);
      setIsEdgeModalOpen(true);
    },
    []
  );

  const handleEdgeConfirm = useCallback(
    (edgeSettings) => {
      if (!pendingConnection) return;

      saveToHistory();

      const arrowMarker = {
        type: MarkerType.ArrowClosed,
        width: 20,
        height: 20,
        color: edgeSettings.color,
      };

      // 화살표 방향에 따른 마커 설정
      let markerEnd = undefined;
      let markerStart = undefined;
      if (edgeSettings.arrowDirection === 'forward') {
        markerEnd = arrowMarker;
      } else if (edgeSettings.arrowDirection === 'reverse') {
        markerStart = arrowMarker;
      }
      // 'none'인 경우 둘 다 undefined 유지

      const newEdge = {
        ...pendingConnection,
        ...defaultEdgeOptions,
        label: edgeSettings.label || undefined,
        style: {
          strokeWidth: 2,
          stroke: edgeSettings.color,
          ...(edgeSettings.isDashed && { strokeDasharray: '5,5' }),
        },
        markerEnd: markerEnd,
        markerStart: markerStart,
      };

      setEdges((eds) => addEdge(newEdge, eds));
      setPendingConnection(null);
      setIsEdgeModalOpen(false);
      connectionStartRef.current = null;
    },
    [pendingConnection, setEdges, nodes, edges, threads, saveToHistory]
  );

  const handleEdgeModalClose = useCallback(() => {
    setPendingConnection(null);
    setIsEdgeModalOpen(false);
    connectionStartRef.current = null;
  }, []);

  const onSelectionChange = useCallback(({ nodes, edges }) => {
    setSelectedNodes(nodes);
    setSelectedEdges(edges);
  }, []);

  // 노드 드래그 시작 - Shift+드래그를 위한 초기 위치 저장
  const onNodeDragStart = useCallback((event, node, dragNodes) => {
    // 드래그 시작 시 히스토리에 저장
    saveToHistory();

    // 드래그하는 모든 노드의 시작 위치 저장
    dragStartPositionsRef.current = {};
    dragNodes.forEach(n => {
      dragStartPositionsRef.current[n.id] = { x: n.position.x, y: n.position.y };
    });
    dragAxisRef.current = null; // 아직 축이 결정되지 않음
    isDraggingWithShiftRef.current = event.shiftKey;
  }, [nodes, edges, threads, saveToHistory]);

  // 노드 드래그 중 - Shift가 눌려있으면 한 방향으로만 이동
  const onNodeDrag = useCallback((event, node, dragNodes) => {
    // Shift 키가 눌려있지 않으면 일반 드래그
    if (!event.shiftKey) {
      isDraggingWithShiftRef.current = false;
      dragAxisRef.current = null;
      return;
    }

    isDraggingWithShiftRef.current = true;
    const startPos = dragStartPositionsRef.current[node.id];
    if (!startPos) return;

    const deltaX = Math.abs(node.position.x - startPos.x);
    const deltaY = Math.abs(node.position.y - startPos.y);

    // 아직 축이 결정되지 않았고, 일정 거리 이상 이동했으면 축 결정
    if (!dragAxisRef.current && (deltaX > 5 || deltaY > 5)) {
      dragAxisRef.current = deltaX > deltaY ? 'x' : 'y';
    }

    // 축이 결정되었으면 해당 축으로만 이동
    if (dragAxisRef.current) {
      setNodes(nds => nds.map(n => {
        const nodeStartPos = dragStartPositionsRef.current[n.id];
        if (!nodeStartPos) return n;

        // 드래그 중인 노드들만 처리
        const isDragNode = dragNodes.some(dn => dn.id === n.id);
        if (!isDragNode) return n;

        // 해당 드래그 노드의 현재 위치 찾기
        const currentDragNode = dragNodes.find(dn => dn.id === n.id);
        if (!currentDragNode) return n;

        if (dragAxisRef.current === 'x') {
          // 가로로만 이동 (Y는 시작 위치 유지)
          return {
            ...n,
            position: { x: currentDragNode.position.x, y: nodeStartPos.y }
          };
        } else {
          // 세로로만 이동 (X는 시작 위치 유지)
          return {
            ...n,
            position: { x: nodeStartPos.x, y: currentDragNode.position.y }
          };
        }
      }));
    }
  }, [setNodes]);

  // 노드 드래그 종료 시 그룹에 포함시키기
  const onNodeDragStop = useCallback((event, node, dragNodes) => {
    // Shift+드래그 상태 초기화
    dragStartPositionsRef.current = {};
    dragAxisRef.current = null;
    isDraggingWithShiftRef.current = false;
    // 그룹 노드나 구분선은 다른 그룹에 포함시키지 않음
    if (node.type === 'group' || node.type === 'divider') return;
    // 이미 그룹에 속한 노드는 처리하지 않음 (그룹 내 이동은 React Flow가 처리)
    if (node.parentNode) return;

    const nodePosition = node.position;
    const nodeWidth = node.width || 160;
    const nodeHeight = node.height || 80;

    // 현재 노드의 중심점 계산
    const nodeCenterX = nodePosition.x + nodeWidth / 2;
    const nodeCenterY = nodePosition.y + nodeHeight / 2;

    // 그룹 노드들 찾기
    const groupNodes = nodes.filter(n => n.type === 'group' && n.id !== node.id);

    // 노드가 어느 그룹 안에 있는지 확인
    let targetGroup = null;
    for (const group of groupNodes) {
      const groupX = group.position.x;
      const groupY = group.position.y;
      const groupWidth = group.style?.width || group.width || 300;
      const groupHeight = group.style?.height || group.height || 200;

      // 노드의 중심이 그룹 영역 안에 있는지 확인
      if (
        nodeCenterX >= groupX &&
        nodeCenterX <= groupX + groupWidth &&
        nodeCenterY >= groupY &&
        nodeCenterY <= groupY + groupHeight
      ) {
        targetGroup = group;
        break;
      }
    }

    if (targetGroup) {
      // 그룹 내 상대 좌표 계산
      const relativeX = nodePosition.x - targetGroup.position.x;
      const relativeY = nodePosition.y - targetGroup.position.y;

      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === node.id) {
            return {
              ...n,
              position: { x: relativeX, y: relativeY },
              parentNode: targetGroup.id,
              extent: 'parent',
            };
          }
          return n;
        })
      );
    }
  }, [nodes, setNodes]);

  // 우클릭 컨텍스트 메뉴 (노드)
  const onNodeContextMenu = useCallback((event, node) => {
    event.preventDefault();

    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      node: node,
      edge: null,
      type: node.type,
    });
  }, []);

  // 우클릭 컨텍스트 메뉴 (엣지)
  const onEdgeContextMenu = useCallback((event, edge) => {
    event.preventDefault();

    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      node: null,
      edge: edge,
      type: 'edge',
    });
  }, []);

  // 컨텍스트 메뉴 닫기
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // 그룹에서 노드 분리
  const handleUngroupNode = useCallback(() => {
    if (!contextMenu?.node) return;

    const node = contextMenu.node;
    if (!node.parentNode) {
      closeContextMenu();
      return;
    }

    const parentGroup = nodes.find(n => n.id === node.parentNode);
    if (!parentGroup) {
      closeContextMenu();
      return;
    }

    saveToHistory();

    // 절대 좌표 계산
    const absoluteX = parentGroup.position.x + node.position.x;
    const absoluteY = parentGroup.position.y + node.position.y;

    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === node.id) {
          const { parentNode, extent, ...rest } = n;
          return {
            ...rest,
            position: { x: absoluteX, y: absoluteY },
          };
        }
        return n;
      })
    );

    closeContextMenu();
  }, [contextMenu, nodes, edges, threads, setNodes, closeContextMenu, saveToHistory]);

  // 노드 삭제 (컨텍스트 메뉴에서)
  const handleDeleteNode = useCallback(() => {
    if (!contextMenu?.node) return;

    saveToHistory();

    const nodeId = contextMenu.node.id;

    // 그룹 노드인 경우 자식 노드들도 함께 삭제
    let nodeIdsToDelete = [nodeId];
    if (contextMenu.node.type === 'group') {
      const childNodeIds = nodes
        .filter(n => n.parentNode === nodeId)
        .map(n => n.id);
      nodeIdsToDelete = [...nodeIdsToDelete, ...childNodeIds];
    }

    setNodes((nds) => nds.filter((n) => !nodeIdsToDelete.includes(n.id)));
    setEdges((eds) => eds.filter((e) =>
      !nodeIdsToDelete.includes(e.source) && !nodeIdsToDelete.includes(e.target)
    ));

    closeContextMenu();
  }, [contextMenu, nodes, edges, threads, setNodes, setEdges, closeContextMenu, saveToHistory]);

  // zIndex 조정 함수들
  const getMaxZIndex = useCallback(() => {
    return Math.max(0, ...nodes.map(n => n.zIndex || 0));
  }, [nodes]);

  const getMinZIndex = useCallback(() => {
    return Math.min(0, ...nodes.map(n => n.zIndex || 0));
  }, [nodes]);

  // 맨 앞으로 가져오기
  const handleBringToFront = useCallback(() => {
    if (!contextMenu?.node) return;

    saveToHistory();

    const nodeId = contextMenu.node.id;
    const maxZ = getMaxZIndex();

    setNodes((nds) => nds.map((n) => {
      if (n.id === nodeId) {
        return { ...n, zIndex: maxZ + 1 };
      }
      return n;
    }));

    closeContextMenu();
  }, [contextMenu, nodes, edges, threads, setNodes, getMaxZIndex, closeContextMenu, saveToHistory]);

  // 맨 뒤로 보내기
  const handleSendToBack = useCallback(() => {
    if (!contextMenu?.node) return;

    saveToHistory();

    const nodeId = contextMenu.node.id;
    const minZ = getMinZIndex();

    setNodes((nds) => nds.map((n) => {
      if (n.id === nodeId) {
        return { ...n, zIndex: minZ - 1 };
      }
      return n;
    }));

    closeContextMenu();
  }, [contextMenu, nodes, edges, threads, setNodes, getMinZIndex, closeContextMenu, saveToHistory]);

  // 앞으로 가져오기 (한 단계)
  const handleBringForward = useCallback(() => {
    if (!contextMenu?.node) return;

    saveToHistory();

    const nodeId = contextMenu.node.id;
    const currentZ = contextMenu.node.zIndex || 0;

    setNodes((nds) => nds.map((n) => {
      if (n.id === nodeId) {
        return { ...n, zIndex: currentZ + 1 };
      }
      return n;
    }));

    closeContextMenu();
  }, [contextMenu, nodes, edges, threads, setNodes, closeContextMenu, saveToHistory]);

  // 뒤로 보내기 (한 단계)
  const handleSendBackward = useCallback(() => {
    if (!contextMenu?.node) return;

    saveToHistory();

    const nodeId = contextMenu.node.id;
    const currentZ = contextMenu.node.zIndex || 0;

    setNodes((nds) => nds.map((n) => {
      if (n.id === nodeId) {
        return { ...n, zIndex: currentZ - 1 };
      }
      return n;
    }));

    closeContextMenu();
  }, [contextMenu, nodes, edges, threads, setNodes, closeContextMenu, saveToHistory]);

  // 엣지 삭제 (컨텍스트 메뉴에서)
  const handleDeleteEdge = useCallback(() => {
    if (!contextMenu?.edge) return;

    saveToHistory();

    const edgeId = contextMenu.edge.id;
    setEdges((eds) => eds.filter((e) => e.id !== edgeId));

    closeContextMenu();
  }, [contextMenu, nodes, edges, threads, setEdges, closeContextMenu, saveToHistory]);

  // 노드/그룹/화살표/엣지 수정 핸들러
  const handleEditItem = useCallback(() => {
    if (!contextMenu) return;

    // 다중 선택된 process 노드가 있는 경우 일괄 수정
    const selectedProcessNodes = selectedNodes.filter(n => n.type === 'process');
    if (contextMenu.type === 'process' && selectedProcessNodes.length > 1) {
      setBulkEditModal({ isOpen: true, nodes: selectedProcessNodes });
      closeContextMenu();
      return;
    }

    if (contextMenu.type === 'edge' && contextMenu.edge) {
      setEditEdgeModal({ isOpen: true, edge: contextMenu.edge });
    } else if (contextMenu.type === 'process' && contextMenu.node) {
      setEditNodeModal({ isOpen: true, node: contextMenu.node });
    } else if (contextMenu.type === 'group' && contextMenu.node) {
      setEditGroupModal({ isOpen: true, node: contextMenu.node });
    } else if (contextMenu.type === 'arrow' && contextMenu.node) {
      setEditArrowModal({ isOpen: true, node: contextMenu.node });
    } else if (contextMenu.type === 'divider' && contextMenu.node) {
      setEditDividerModal({ isOpen: true, node: contextMenu.node });
    }

    closeContextMenu();
  }, [contextMenu, closeContextMenu, selectedNodes]);

  // 노드 저장
  const handleSaveNode = useCallback((updatedNode) => {
    saveToHistory();
    setNodes((nds) =>
      nds.map((n) => (n.id === updatedNode.id ? updatedNode : n))
    );
    setEditNodeModal({ isOpen: false, node: null });
  }, [nodes, edges, threads, setNodes, saveToHistory]);

  // 노드 일괄 저장
  const handleBulkSaveNodes = useCallback((changes) => {
    saveToHistory();
    const nodeIds = bulkEditModal.nodes.map(n => n.id);
    setNodes((nds) =>
      nds.map((n) => {
        if (nodeIds.includes(n.id)) {
          return {
            ...n,
            data: {
              ...n.data,
              ...changes,
            },
          };
        }
        return n;
      })
    );
    setBulkEditModal({ isOpen: false, nodes: [] });
  }, [nodes, edges, threads, setNodes, bulkEditModal.nodes, saveToHistory]);

  // 그룹 저장
  const handleSaveGroup = useCallback((updatedNode) => {
    saveToHistory();
    setNodes((nds) =>
      nds.map((n) => (n.id === updatedNode.id ? updatedNode : n))
    );
    setEditGroupModal({ isOpen: false, node: null });
  }, [nodes, edges, threads, setNodes, saveToHistory]);

  // 화살표 저장
  const handleSaveArrow = useCallback((updatedNode) => {
    saveToHistory();
    setNodes((nds) =>
      nds.map((n) => (n.id === updatedNode.id ? updatedNode : n))
    );
    setEditArrowModal({ isOpen: false, node: null });
  }, [nodes, edges, threads, setNodes, saveToHistory]);

  // 구분선 저장
  const handleSaveDivider = useCallback((updatedNode) => {
    saveToHistory();
    setNodes((nds) =>
      nds.map((n) => (n.id === updatedNode.id ? updatedNode : n))
    );
    setEditDividerModal({ isOpen: false, node: null });
  }, [nodes, edges, threads, setNodes, saveToHistory]);

  // 엣지 저장
  const handleSaveEdge = useCallback((updatedEdge) => {
    saveToHistory();
    setEdges((eds) =>
      eds.map((e) => (e.id === updatedEdge.id ? updatedEdge : e))
    );
    setEditEdgeModal({ isOpen: false, edge: null });
  }, [nodes, edges, threads, setEdges, saveToHistory]);

  // 클릭 시 컨텍스트 메뉴 닫기
  const onPaneClick = useCallback(() => {
    closeContextMenu();
  }, [closeContextMenu]);

  // 스레드 생성 핸들러
  const handleCreateThread = useCallback((threadData) => {
    saveToHistory();

    const newThread = {
      id: `thread-${Date.now()}`,
      name: threadData.name,
      color: threadData.color,
      edgeIds: selectedEdges.map(e => e.id),
    };

    setThreads(prev => [...prev, newThread]);

    // 선택된 엣지 ID 목록
    const selectedEdgeIds = selectedEdges.map(e => e.id);

    // 선택된 엣지들에 스레드 스타일 적용 (형광 효과)
    setEdges(eds => eds.map(edge => {
      if (selectedEdgeIds.includes(edge.id)) {
        // 원본 정보 저장 (처음 스레드 적용 시)
        const isFirstTimeApply = edge.data?.originalColor === undefined;

        const originalColor = isFirstTimeApply ? (edge.style?.stroke || '#64748b') : edge.data.originalColor;
        // null이 아닌 실제 객체가 있을 때만 저장, 없으면 null로 명시
        const originalMarkerEnd = isFirstTimeApply
          ? (edge.markerEnd || null)
          : edge.data.originalMarkerEnd;
        const originalMarkerStart = isFirstTimeApply
          ? (edge.markerStart || null)
          : edge.data.originalMarkerStart;

        const newEdge = {
          ...edge,
          data: {
            ...edge.data,
            threadId: newThread.id,
            threadColor: threadData.color,
            originalColor,
            originalMarkerEnd,
            originalMarkerStart,
            originalStrokeWidth: isFirstTimeApply ? (edge.style?.strokeWidth || 2) : edge.data.originalStrokeWidth,
          },
          style: {
            ...edge.style,
            stroke: threadData.color,
            strokeWidth: 4,
            filter: `drop-shadow(0 0 3px ${threadData.color}) drop-shadow(0 0 6px ${threadData.color}80)`,
          },
        };

        // markerEnd/markerStart는 원본이 있을 때만 설정 (색상만 변경, 크기는 원본 유지)
        if (originalMarkerEnd) {
          newEdge.markerEnd = {
            type: originalMarkerEnd.type || MarkerType.ArrowClosed,
            width: originalMarkerEnd.width || 20,
            height: originalMarkerEnd.height || 20,
            color: threadData.color,
          };
        } else {
          delete newEdge.markerEnd;
        }

        if (originalMarkerStart) {
          newEdge.markerStart = {
            type: originalMarkerStart.type || MarkerType.ArrowClosed,
            width: originalMarkerStart.width || 20,
            height: originalMarkerStart.height || 20,
            color: threadData.color,
          };
        } else {
          delete newEdge.markerStart;
        }

        return newEdge;
      }
      return edge;
    }));

    setIsCreateThreadModalOpen(false);
  }, [nodes, edges, threads, selectedEdges, setEdges, saveToHistory]);

  // 스레드 삭제 핸들러
  const handleDeleteThread = useCallback((threadId) => {
    const thread = threads.find(t => t.id === threadId);
    if (!thread) return;

    saveToHistory();

    // 스레드에 속한 엣지들의 스타일 원복
    setEdges(eds => eds.map(edge => {
      if (thread.edgeIds.includes(edge.id)) {
        const { threadId: _, threadColor: __, originalColor, originalMarkerEnd, originalMarkerStart, ...restData } = edge.data || {};
        const { filter, ...restStyle } = edge.style || {};

        // 원본 색상 복원
        const restoredColor = originalColor || '#64748b';

        const { originalStrokeWidth, ...finalRestData } = restData;

        const newEdge = {
          ...edge,
          data: finalRestData,
          style: {
            ...restStyle,
            stroke: restoredColor,
            strokeWidth: originalStrokeWidth || 2,
          },
        };

        // markerEnd/markerStart 원본 복원
        if (originalMarkerEnd) {
          newEdge.markerEnd = {
            ...originalMarkerEnd,
            color: restoredColor,
          };
        } else {
          delete newEdge.markerEnd;
        }

        if (originalMarkerStart) {
          newEdge.markerStart = {
            ...originalMarkerStart,
            color: restoredColor,
          };
        } else {
          delete newEdge.markerStart;
        }

        return newEdge;
      }
      return edge;
    }));

    setThreads(prev => prev.filter(t => t.id !== threadId));
  }, [nodes, edges, threads, setEdges, saveToHistory]);

  // 스레드로 엮기 메뉴 클릭 핸들러
  const handleOpenCreateThreadModal = useCallback(() => {
    closeContextMenu();
    setIsCreateThreadModalOpen(true);
  }, [closeContextMenu]);

  // 노드 정렬 함수들
  const getNodeDimensions = useCallback((node) => {
    const width = node.style?.width || node.width || 160;
    const height = node.style?.height || node.height || 80;
    return { width, height };
  }, []);

  // 수평 정렬 - 왼쪽
  const alignLeft = useCallback(() => {
    if (selectedNodes.length < 2) return;

    const selectedNodeIds = selectedNodes.map(n => n.id);
    const nodesWithPos = nodes.filter(n => selectedNodeIds.includes(n.id));
    const minX = Math.min(...nodesWithPos.map(n => n.position.x));

    setNodes(nds => nds.map(node => {
      if (selectedNodeIds.includes(node.id)) {
        return {
          ...node,
          position: { ...node.position, x: minX }
        };
      }
      return node;
    }));
  }, [selectedNodes, nodes, setNodes]);

  // 수평 정렬 - 가운데
  const alignCenterHorizontal = useCallback(() => {
    if (selectedNodes.length < 2) return;

    const selectedNodeIds = selectedNodes.map(n => n.id);
    const nodesWithPos = nodes.filter(n => selectedNodeIds.includes(n.id));

    // 각 노드의 중심 X 좌표 계산
    const centerXs = nodesWithPos.map(n => {
      const { width } = getNodeDimensions(n);
      return n.position.x + width / 2;
    });
    const avgCenterX = centerXs.reduce((a, b) => a + b, 0) / centerXs.length;

    setNodes(nds => nds.map(node => {
      if (selectedNodeIds.includes(node.id)) {
        const { width } = getNodeDimensions(node);
        return {
          ...node,
          position: { ...node.position, x: avgCenterX - width / 2 }
        };
      }
      return node;
    }));
  }, [selectedNodes, nodes, setNodes, getNodeDimensions]);

  // 수평 정렬 - 오른쪽
  const alignRight = useCallback(() => {
    if (selectedNodes.length < 2) return;

    const selectedNodeIds = selectedNodes.map(n => n.id);
    const nodesWithPos = nodes.filter(n => selectedNodeIds.includes(n.id));

    // 각 노드의 오른쪽 끝 X 좌표 계산
    const rightXs = nodesWithPos.map(n => {
      const { width } = getNodeDimensions(n);
      return n.position.x + width;
    });
    const maxRightX = Math.max(...rightXs);

    setNodes(nds => nds.map(node => {
      if (selectedNodeIds.includes(node.id)) {
        const { width } = getNodeDimensions(node);
        return {
          ...node,
          position: { ...node.position, x: maxRightX - width }
        };
      }
      return node;
    }));
  }, [selectedNodes, nodes, setNodes, getNodeDimensions]);

  // 수직 정렬 - 위쪽
  const alignTop = useCallback(() => {
    if (selectedNodes.length < 2) return;

    const selectedNodeIds = selectedNodes.map(n => n.id);
    const nodesWithPos = nodes.filter(n => selectedNodeIds.includes(n.id));
    const minY = Math.min(...nodesWithPos.map(n => n.position.y));

    setNodes(nds => nds.map(node => {
      if (selectedNodeIds.includes(node.id)) {
        return {
          ...node,
          position: { ...node.position, y: minY }
        };
      }
      return node;
    }));
  }, [selectedNodes, nodes, setNodes]);

  // 수직 정렬 - 가운데
  const alignCenterVertical = useCallback(() => {
    if (selectedNodes.length < 2) return;

    const selectedNodeIds = selectedNodes.map(n => n.id);
    const nodesWithPos = nodes.filter(n => selectedNodeIds.includes(n.id));

    // 각 노드의 중심 Y 좌표 계산
    const centerYs = nodesWithPos.map(n => {
      const { height } = getNodeDimensions(n);
      return n.position.y + height / 2;
    });
    const avgCenterY = centerYs.reduce((a, b) => a + b, 0) / centerYs.length;

    setNodes(nds => nds.map(node => {
      if (selectedNodeIds.includes(node.id)) {
        const { height } = getNodeDimensions(node);
        return {
          ...node,
          position: { ...node.position, y: avgCenterY - height / 2 }
        };
      }
      return node;
    }));
  }, [selectedNodes, nodes, setNodes, getNodeDimensions]);

  // 수직 정렬 - 아래쪽
  const alignBottom = useCallback(() => {
    if (selectedNodes.length < 2) return;

    const selectedNodeIds = selectedNodes.map(n => n.id);
    const nodesWithPos = nodes.filter(n => selectedNodeIds.includes(n.id));

    // 각 노드의 아래쪽 끝 Y 좌표 계산
    const bottomYs = nodesWithPos.map(n => {
      const { height } = getNodeDimensions(n);
      return n.position.y + height;
    });
    const maxBottomY = Math.max(...bottomYs);

    setNodes(nds => nds.map(node => {
      if (selectedNodeIds.includes(node.id)) {
        const { height } = getNodeDimensions(node);
        return {
          ...node,
          position: { ...node.position, y: maxBottomY - height }
        };
      }
      return node;
    }));
  }, [selectedNodes, nodes, setNodes, getNodeDimensions]);

  // 가로 간격 균등 분배
  const distributeHorizontal = useCallback(() => {
    if (selectedNodes.length < 3) return;

    const selectedNodeIds = selectedNodes.map(n => n.id);
    const nodesWithPos = nodes.filter(n => selectedNodeIds.includes(n.id));

    // X 좌표로 정렬
    const sortedNodes = [...nodesWithPos].sort((a, b) => a.position.x - b.position.x);

    // 첫 번째와 마지막 노드 위치 고정, 중간 노드들 균등 분배
    const firstNode = sortedNodes[0];
    const lastNode = sortedNodes[sortedNodes.length - 1];
    const firstX = firstNode.position.x;
    const { width: lastWidth } = getNodeDimensions(lastNode);
    const lastRightX = lastNode.position.x + lastWidth;

    // 전체 노드들의 너비 합계 (첫 번째와 마지막 제외)
    const middleNodes = sortedNodes.slice(1, -1);
    const totalMiddleWidth = middleNodes.reduce((sum, n) => sum + getNodeDimensions(n).width, 0);
    const { width: firstWidth } = getNodeDimensions(firstNode);

    // 사용 가능한 총 간격
    const totalSpace = lastRightX - firstX - firstWidth - totalMiddleWidth - lastWidth;
    const gap = totalSpace / (sortedNodes.length - 1);

    let currentX = firstX + firstWidth + gap;

    const newPositions = {};
    middleNodes.forEach(node => {
      newPositions[node.id] = currentX;
      currentX += getNodeDimensions(node).width + gap;
    });

    setNodes(nds => nds.map(node => {
      if (newPositions[node.id] !== undefined) {
        return {
          ...node,
          position: { ...node.position, x: newPositions[node.id] }
        };
      }
      return node;
    }));
  }, [selectedNodes, nodes, setNodes, getNodeDimensions]);

  // 세로 간격 균등 분배
  const distributeVertical = useCallback(() => {
    if (selectedNodes.length < 3) return;

    const selectedNodeIds = selectedNodes.map(n => n.id);
    const nodesWithPos = nodes.filter(n => selectedNodeIds.includes(n.id));

    // Y 좌표로 정렬
    const sortedNodes = [...nodesWithPos].sort((a, b) => a.position.y - b.position.y);

    // 첫 번째와 마지막 노드 위치 고정, 중간 노드들 균등 분배
    const firstNode = sortedNodes[0];
    const lastNode = sortedNodes[sortedNodes.length - 1];
    const firstY = firstNode.position.y;
    const { height: lastHeight } = getNodeDimensions(lastNode);
    const lastBottomY = lastNode.position.y + lastHeight;

    // 전체 노드들의 높이 합계 (첫 번째와 마지막 제외)
    const middleNodes = sortedNodes.slice(1, -1);
    const totalMiddleHeight = middleNodes.reduce((sum, n) => sum + getNodeDimensions(n).height, 0);
    const { height: firstHeight } = getNodeDimensions(firstNode);

    // 사용 가능한 총 간격
    const totalSpace = lastBottomY - firstY - firstHeight - totalMiddleHeight - lastHeight;
    const gap = totalSpace / (sortedNodes.length - 1);

    let currentY = firstY + firstHeight + gap;

    const newPositions = {};
    middleNodes.forEach(node => {
      newPositions[node.id] = currentY;
      currentY += getNodeDimensions(node).height + gap;
    });

    setNodes(nds => nds.map(node => {
      if (newPositions[node.id] !== undefined) {
        return {
          ...node,
          position: { ...node.position, y: newPositions[node.id] }
        };
      }
      return node;
    }));
  }, [selectedNodes, nodes, setNodes, getNodeDimensions]);

  // MiniMap 노드 색상
  const nodeColor = useCallback((node) => {
    switch (node.type) {
      case 'process':
        return node.data?.color || '#64748b';
      case 'system':
        return '#8b5cf6';
      case 'data':
        return '#10b981';
      case 'start':
        return '#22c55e';
      case 'end':
        return '#ef4444';
      case 'decision':
        return '#f59e0b';
      case 'group':
        return node.data?.color || '#64748b';
      case 'divider':
        return node.data?.color || '#94a3b8';
      case 'arrow':
        return node.data?.color || '#64748b';
      default:
        return '#64748b';
    }
  }, []);

  return (
    <DiagramContainer ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onSelectionChange={onSelectionChange}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionMode="loose"
        fitView
        attributionPosition="bottom-left"
        deleteKeyCode={null}
        selectionOnDrag
        selectNodesOnDrag={false}
        multiSelectionKeyCode="Shift"
        edgesUpdatable
        edgesFocusable
      >
        <Background color="#94a3b8" gap={20} size={1} />
        <Controls />
        <MiniMap
          nodeColor={nodeColor}
          nodeStrokeWidth={3}
          zoomable
          pannable
        />

        {/* 정렬 툴바 */}
        <Panel position="top-right">
          <AlignmentPanel>
            <AlignmentLabel>정렬 (2개 이상 선택)</AlignmentLabel>
            <AlignmentRow>
              <AlignmentButton
                onClick={alignLeft}
                disabled={selectedNodes.length < 2}
                title="왼쪽 맞춤"
              >
                좌
              </AlignmentButton>
              <AlignmentButton
                onClick={alignCenterHorizontal}
                disabled={selectedNodes.length < 2}
                title="가로 가운데 맞춤"
              >
                중앙
              </AlignmentButton>
              <AlignmentButton
                onClick={alignRight}
                disabled={selectedNodes.length < 2}
                title="오른쪽 맞춤"
              >
                우
              </AlignmentButton>
            </AlignmentRow>
            <AlignmentRow>
              <AlignmentButton
                onClick={alignTop}
                disabled={selectedNodes.length < 2}
                title="위쪽 맞춤"
              >
                상
              </AlignmentButton>
              <AlignmentButton
                onClick={alignCenterVertical}
                disabled={selectedNodes.length < 2}
                title="세로 가운데 맞춤"
              >
                중앙
              </AlignmentButton>
              <AlignmentButton
                onClick={alignBottom}
                disabled={selectedNodes.length < 2}
                title="아래쪽 맞춤"
              >
                하
              </AlignmentButton>
            </AlignmentRow>
            <AlignmentLabel style={{ marginTop: '8px' }}>간격 균등 (3개 이상 선택)</AlignmentLabel>
            <AlignmentRow>
              <AlignmentButton
                onClick={distributeHorizontal}
                disabled={selectedNodes.length < 3}
                title="가로 간격 균등"
              >
                가로
              </AlignmentButton>
              <AlignmentButton
                onClick={distributeVertical}
                disabled={selectedNodes.length < 3}
                title="세로 간격 균등"
              >
                세로
              </AlignmentButton>
            </AlignmentRow>
          </AlignmentPanel>

          {/* 색상 범례 */}
          <LegendPanel style={{ marginTop: '8px' }}>
            <LegendTitle>색상 범례</LegendTitle>
            {colorItems.filter(item => item.label).map((item) => (
              <LegendItem key={item.color}>
                <LegendColor color={item.color} />
                <span>{item.label}</span>
              </LegendItem>
            ))}
            {colorItems.filter(item => item.label).length === 0 && (
              <LegendItem>
                <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>설정에서 색상 라벨을 추가하세요</span>
              </LegendItem>
            )}
          </LegendPanel>

          {/* 하이라이트 범례 (스레드) */}
          {threads.length > 0 && (
            <ThreadLegendPanel>
              <LegendTitle>하이라이트 범례</LegendTitle>
              {threads.map((thread) => (
                <ThreadLegendItem key={thread.id}>
                  <ThreadLegendLine color={thread.color} />
                  <ThreadLegendName>{thread.name}</ThreadLegendName>
                  <ThreadDeleteButton
                    onClick={() => handleDeleteThread(thread.id)}
                    title="스레드 삭제"
                  >
                    ✕
                  </ThreadDeleteButton>
                </ThreadLegendItem>
              ))}
            </ThreadLegendPanel>
          )}
        </Panel>
      </ReactFlow>

      {/* 우클릭 컨텍스트 메뉴 */}
      {contextMenu && (
        <ContextMenu style={{ left: contextMenu.x, top: contextMenu.y }}>
          {/* 수정 메뉴 - process, group, arrow, divider, edge에 표시 */}
          {(contextMenu.type === 'process' || contextMenu.type === 'group' || contextMenu.type === 'arrow' || contextMenu.type === 'divider' || contextMenu.type === 'edge') && (
            <ContextMenuItem onClick={handleEditItem}>
              ✏️ 수정
            </ContextMenuItem>
          )}
          {/* 스레드로 엮기 - 여러 엣지가 선택된 경우에만 표시 */}
          {contextMenu.type === 'edge' && selectedEdges.length >= 1 && (
            <ContextMenuItem onClick={handleOpenCreateThreadModal}>
              ✨ 스레드로 엮기 ({selectedEdges.length}개)
            </ContextMenuItem>
          )}
          {/* 앞/뒤 순서 조정 - 노드에만 표시 */}
          {contextMenu.node && (
            <>
              <ContextMenuItem onClick={handleBringToFront}>
                ⬆️ 맨 앞으로
              </ContextMenuItem>
              <ContextMenuItem onClick={handleBringForward}>
                🔼 앞으로
              </ContextMenuItem>
              <ContextMenuItem onClick={handleSendBackward}>
                🔽 뒤로
              </ContextMenuItem>
              <ContextMenuItem onClick={handleSendToBack}>
                ⬇️ 맨 뒤로
              </ContextMenuItem>
            </>
          )}
          {/* 그룹에서 분리 - 그룹 내 노드에만 표시 */}
          {contextMenu.node?.parentNode && (
            <ContextMenuItem onClick={handleUngroupNode}>
              📤 그룹에서 분리
            </ContextMenuItem>
          )}
          {/* 삭제 - 노드 */}
          {contextMenu.node && (
            <ContextMenuItem className="danger" onClick={handleDeleteNode}>
              🗑️ 삭제
            </ContextMenuItem>
          )}
          {/* 삭제 - 엣지 */}
          {contextMenu.edge && (
            <ContextMenuItem className="danger" onClick={handleDeleteEdge}>
              🗑️ 삭제
            </ContextMenuItem>
          )}
        </ContextMenu>
      )}

      {/* 엣지 연결 모달 */}
      <AddEdgeModal
        isOpen={isEdgeModalOpen}
        onClose={handleEdgeModalClose}
        onConfirm={handleEdgeConfirm}
        connection={pendingConnection}
      />

      {/* 노드 수정 모달 */}
      <EditNodeModal
        isOpen={editNodeModal.isOpen}
        onClose={() => setEditNodeModal({ isOpen: false, node: null })}
        onSave={handleSaveNode}
        node={editNodeModal.node}
      />

      {/* 그룹 수정 모달 */}
      <EditGroupModal
        isOpen={editGroupModal.isOpen}
        onClose={() => setEditGroupModal({ isOpen: false, node: null })}
        onSave={handleSaveGroup}
        node={editGroupModal.node}
      />

      {/* 화살표 수정 모달 */}
      <EditArrowModal
        isOpen={editArrowModal.isOpen}
        onClose={() => setEditArrowModal({ isOpen: false, node: null })}
        onSave={handleSaveArrow}
        node={editArrowModal.node}
      />

      {/* 구분선 수정 모달 */}
      <EditDividerModal
        isOpen={editDividerModal.isOpen}
        onClose={() => setEditDividerModal({ isOpen: false, node: null })}
        onSave={handleSaveDivider}
        node={editDividerModal.node}
      />

      {/* 엣지 수정 모달 */}
      <EditEdgeModal
        isOpen={editEdgeModal.isOpen}
        onClose={() => setEditEdgeModal({ isOpen: false, edge: null })}
        onSave={handleSaveEdge}
        edge={editEdgeModal.edge}
      />

      {/* 스레드 생성 모달 */}
      <CreateThreadModal
        isOpen={isCreateThreadModalOpen}
        onClose={() => setIsCreateThreadModalOpen(false)}
        onConfirm={handleCreateThread}
        selectedEdgeCount={selectedEdges.length}
      />

      {/* 노드 일괄 수정 모달 */}
      <BulkEditNodeModal
        isOpen={bulkEditModal.isOpen}
        onClose={() => setBulkEditModal({ isOpen: false, nodes: [] })}
        onSave={handleBulkSaveNodes}
        nodes={bulkEditModal.nodes}
      />
    </DiagramContainer>
  );
});

// ReactFlowProvider로 감싸는 래퍼 컴포넌트
const ProcessDiagram = forwardRef((props, ref) => {
  return (
    <ReactFlowProvider>
      <ProcessDiagramInner ref={ref} {...props} />
    </ReactFlowProvider>
  );
});

export default ProcessDiagram;
