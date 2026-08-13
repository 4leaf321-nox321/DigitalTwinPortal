import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Network } from 'vis-network/standalone/esm/vis-network';
import { DataSet } from 'vis-data/esnext';
import styled from 'styled-components';
import { Edit3, Trash2, ZoomIn, ZoomOut, Maximize, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useModuleCategories } from '../../contexts/ModuleCategoryContext';

// ===== 시스템 색상 팔레트 =====
const SYSTEM_COLORS = [
  '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b',
  '#ec4899', '#6366f1', '#f97316', '#14b8a6',
  '#ef4444', '#06b6d4', '#84cc16', '#a855f7',
];

const getSystemColor = (index) => SYSTEM_COLORS[index % SYSTEM_COLORS.length];

const darken = (hex, amt = 30) => {
  const c = hex.replace('#', '');
  const r = Math.max(0, parseInt(c.substring(0, 2), 16) - amt);
  const g = Math.max(0, parseInt(c.substring(2, 4), 16) - amt);
  const b = Math.max(0, parseInt(c.substring(4, 6), 16) - amt);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

const lighten = (hex, amt = 180) => {
  const c = hex.replace('#', '');
  const r = Math.min(255, parseInt(c.substring(0, 2), 16) + amt);
  const g = Math.min(255, parseInt(c.substring(2, 4), 16) + amt);
  const b = Math.min(255, parseInt(c.substring(4, 6), 16) + amt);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

// ===== Styled Components =====
const Container = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
`;

const GraphCanvas = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #f8fafc;
`;

const Legend = styled.div`
  position: absolute;
  bottom: 12px;
  left: 12px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 0.6875rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  z-index: 5;
  max-width: 400px;
`;

const LegendItem = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
`;

const LegendDot = styled.span`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${props => props.$color};
  border: 1.5px solid ${props => props.$border};
  flex-shrink: 0;
`;

const LegendLine = styled.span`
  width: 18px;
  height: 0;
  border-top: 2px ${props => props.$dashed ? 'dashed' : 'solid'} #f59e0b;
  flex-shrink: 0;
`;

const Controls = styled.div`
  position: absolute;
  bottom: 12px;
  right: 12px;
  display: flex;
  gap: 4px;
  z-index: 5;
`;

const ControlGroup = styled.div`
  display: flex;
  flex-direction: column;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  overflow: hidden;
`;

const ControlBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: white;
  color: #64748b;
  cursor: pointer;
  padding: 0;
  transition: all 0.1s ease;

  &:not(:last-child) {
    border-bottom: 1px solid #f1f5f9;
  }

  &:hover {
    background: #f1f5f9;
    color: #1e293b;
  }

  &:active {
    background: #e2e8f0;
  }
`;

const PanGrid = styled.div`
  display: grid;
  grid-template-columns: 32px 32px 32px;
  grid-template-rows: 32px 32px 32px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  overflow: hidden;
`;

const PanBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: white;
  color: #64748b;
  cursor: pointer;
  padding: 0;
  transition: all 0.1s ease;

  &:hover {
    background: #f1f5f9;
    color: #1e293b;
  }

  &:active {
    background: #e2e8f0;
  }
`;

const PanCenter = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: #f8fafc;
  color: #cbd5e1;
  font-size: 0.5rem;
`;

const LevelGroup = styled.div`
  display: flex;
  flex-direction: column;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  overflow: hidden;
`;

const LevelLabel = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3px 0;
  font-size: 0.5rem;
  font-weight: 700;
  color: #94a3b8;
  background: #f8fafc;
  border-bottom: 1px solid #f1f5f9;
  letter-spacing: 0.5px;
`;

const LevelBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 24px;
  border: none;
  background: ${props => props.$active ? '#8b5cf6' : 'white'};
  color: ${props => props.$active ? 'white' : '#64748b'};
  cursor: pointer;
  padding: 0;
  font-size: 0.6875rem;
  font-weight: ${props => props.$active ? '700' : '500'};
  transition: all 0.1s ease;

  &:not(:last-child) {
    border-bottom: 1px solid #f1f5f9;
  }

  &:hover {
    background: ${props => props.$active ? '#8b5cf6' : '#f1f5f9'};
    color: ${props => props.$active ? 'white' : '#1e293b'};
  }
`;

const SpacingGroup = styled.div`
  display: flex;
  flex-direction: column;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  padding: 6px 10px 10px;
  gap: 6px;
  min-width: 36px;
`;

const SpacingLabel = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.5rem;
  font-weight: 700;
  color: #94a3b8;
  letter-spacing: 0.5px;
`;

const SpacingSlider = styled.input.attrs({ type: 'range' })`
  writing-mode: vertical-lr;
  direction: rtl;
  appearance: none;
  width: 6px;
  height: 100px;
  background: transparent;
  margin: 0 auto;
  cursor: pointer;

  &::-webkit-slider-runnable-track {
    width: 6px;
    background: #e2e8f0;
    border-radius: 3px;
  }

  &::-webkit-slider-thumb {
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #8b5cf6;
    border: 2px solid white;
    box-shadow: 0 1px 4px rgba(0,0,0,0.2);
    margin-left: -4px;
  }

  &::-moz-range-track {
    width: 6px;
    background: #e2e8f0;
    border-radius: 3px;
    border: none;
  }

  &::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #8b5cf6;
    border: 2px solid white;
    box-shadow: 0 1px 4px rgba(0,0,0,0.2);
  }
`;

const SpacingValue = styled.div`
  font-size: 0.625rem;
  font-weight: 600;
  color: #64748b;
  text-align: center;
`;

const ContextMenu = styled.div`
  position: absolute;
  z-index: 20;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  padding: 0.25rem;
  min-width: 140px;
`;

const ContextMenuItem = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 0.8125rem;
  color: ${props => props.$danger ? '#ef4444' : '#334155'};
  border-radius: 0.375rem;
  transition: background 0.1s ease;

  &:hover {
    background: ${props => props.$danger ? '#fef2f2' : '#f1f5f9'};
  }
`;

const ContextMenuDivider = styled.div`
  height: 1px;
  background: #e2e8f0;
  margin: 0.25rem 0;
`;

const ContextMenuLabel = styled.div`
  padding: 0.375rem 0.75rem;
  font-size: 0.6875rem;
  font-weight: 600;
  color: #94a3b8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
`;

// ===== vis-network 그래프 빌더 =====
const buildGraphData = (modules, getLinkMethodType, systemDescriptions = {}) => {
  const nodes = [];
  const edges = [];

  const systemMap = new Map();
  modules.forEach(mod => {
    const sys = mod.systemType || '미분류';
    if (!systemMap.has(sys)) systemMap.set(sys, []);
    systemMap.get(sys).push(mod);
  });

  modules.forEach(mod => {
    const modLinks = mod.links || [];
    modLinks.forEach(link => {
      if (link.from && !systemMap.has(link.from)) {
        systemMap.set(link.from, []);
      }
      if (link.to && !systemMap.has(link.to)) {
        systemMap.set(link.to, []);
      }
    });
  });

  const systemNames = [...systemMap.keys()];
  const colorMap = {};
  systemNames.forEach((name, i) => { colorMap[name] = getSystemColor(i); });

  // 시스템 노드
  systemNames.forEach(sysName => {
    const color = colorMap[sysName];
    const modCount = systemMap.get(sysName).length;
    nodes.push({
      id: `sys-${sysName}`,
      label: `${sysName}\n(${modCount}개 모듈)`,
      shape: 'dot',
      size: 30 + Math.min(modCount, 25) * 4,
      color: {
        background: lighten(color, 160),
        border: color,
        highlight: { background: lighten(color, 120), border: darken(color) },
        hover: { background: lighten(color, 130), border: color },
      },
      font: { size: 14, color: darken(color, 60), face: 'Arial, sans-serif', strokeWidth: 3, strokeColor: '#ffffff', multi: true },
      borderWidth: 3,
      shadow: { enabled: true, color: 'rgba(0,0,0,0.15)', size: 12, x: 2, y: 2 },
      mass: 3 + Math.min(modCount, 25) * 0.5,
      title: systemDescriptions[sysName] || undefined,
      _type: 'system',
      _sysName: sysName,
      _totalCount: modCount,
    });
  });

  // 카테고리 노드: 시스템별 카테고리 그룹화 (모듈이 복수 카테고리 가능)
  const catNodeIds = new Set();
  const catCountMap = new Map(); // `${sysName}-${catName}` → count
  systemNames.forEach(sysName => {
    const mods = systemMap.get(sysName);
    mods.forEach(mod => {
      const cats = (mod.categories && mod.categories.length > 0) ? mod.categories : ['미분류'];
      cats.forEach(cat => {
        const key = `${sysName}-${cat}`;
        catCountMap.set(key, (catCountMap.get(key) || 0) + 1);
      });
    });

    const color = colorMap[sysName];
    const processedCats = new Set();
    mods.forEach(mod => {
      const cats = (mod.categories && mod.categories.length > 0) ? mod.categories : ['미분류'];
      cats.forEach(catName => {
        if (processedCats.has(catName)) return;
        processedCats.add(catName);
        const catNodeId = `cat-${sysName}-${catName}`;
        catNodeIds.add(catNodeId);
        const count = catCountMap.get(`${sysName}-${catName}`) || 0;
        nodes.push({
          id: catNodeId,
          label: `${catName} (${count})`,
          shape: 'dot',
          size: 18 + Math.min(count, 25) * 2,
          color: {
            background: lighten(color, 140),
            border: lighten(color, 40),
            highlight: { background: lighten(color, 110), border: color },
            hover: { background: lighten(color, 120), border: color },
          },
          font: { size: 11, color: darken(color, 40), face: 'Arial, sans-serif', strokeWidth: 2, strokeColor: '#ffffff' },
          borderWidth: 2,
          shadow: { enabled: true, color: 'rgba(0,0,0,0.1)', size: 8, x: 1, y: 1 },
          mass: 1.5 + Math.min(count, 25) * 0.3,
          _type: 'category',
          _sysName: sysName,
          _catName: catName,
        });

        // 시스템 → 카테고리 엣지
        edges.push({
          id: `sys-cat-${sysName}-${catName}`,
          from: `sys-${sysName}`,
          to: catNodeId,
          color: { color: lighten(color, 60), highlight: color, hover: color, opacity: 0.6 },
          width: 1.5,
          arrows: { to: { enabled: false } },
          smooth: { enabled: true, type: 'continuous', roundness: 0 },
          dashes: false,
          _type: 'sys-cat',
          _sysName: sysName,
        });
      });
    });
  });

  // 모듈 노드 + 엣지
  modules.forEach(mod => {
    const sys = mod.systemType || '미분류';
    const cats = (mod.categories && mod.categories.length > 0) ? mod.categories : ['미분류'];
    const color = colorMap[sys] || '#94a3b8';
    const modLinks = (mod.links || []).filter(l => l.from && l.to);
    const isLinked = modLinks.length > 0;

    const linkLabel = isLinked && modLinks.length === 1 && modLinks[0].method
      ? `${mod.name}\n(${modLinks[0].method})`
      : isLinked && modLinks.length > 1
        ? `${mod.name}\n(연계 ${modLinks.length}건)`
        : mod.name;

    nodes.push({
      id: `mod-${mod.id}`,
      label: linkLabel,
      shape: 'dot',
      size: isLinked ? 16 : 12,
      color: {
        background: isLinked ? '#fef3c7' : '#ffffff',
        border: isLinked ? '#f59e0b' : color,
        highlight: { background: isLinked ? '#fde68a' : lighten(color, 140), border: darken(color) },
        hover: { background: isLinked ? '#fde68a' : '#f1f5f9', border: color },
      },
      font: { size: 11, color: isLinked ? '#92400e' : '#334155', face: 'Arial, sans-serif', strokeWidth: 2, strokeColor: '#ffffff' },
      borderWidth: isLinked ? 2.5 : 1.5,
      shadow: { enabled: true, color: 'rgba(0,0,0,0.1)', size: 6, x: 1, y: 1 },
      mass: 1,
      _type: 'module',
      _moduleId: mod.id,
      _systemName: sys,
      _categories: cats,
      _isLinked: isLinked,
      _links: modLinks,
    });

    // 모든 모듈: 소속 카테고리에 각각 연결 (복수 카테고리 지원)
    cats.forEach((cat, catIdx) => {
      const catNodeId = `cat-${sys}-${cat}`;
      edges.push({
        id: `belong-${mod.id}-${catIdx}`,
        from: `mod-${mod.id}`,
        to: catNodeId,
        color: { color: lighten(color, 80), highlight: color, hover: color, opacity: 0.5 },
        width: 1,
        arrows: { to: { enabled: false } },
        smooth: { enabled: true, type: 'continuous', roundness: 0 },
        dashes: false,
        _type: 'belong',
        _sysName: sys,
      });
    });

    // 연계 모듈: 각 링크별 FROM→TO 방향에 맞춰 엣지 생성
    modLinks.forEach((link, linkIdx) => {
      const methodType = getLinkMethodType ? getLinkMethodType(link.method || '') : 'non-system';
      const isSystemLink = methodType === 'system';
      const linkDashes = isSystemLink ? false : [8, 4];
      const linkEdgeStyle = {
        color: { color: '#f59e0b', highlight: '#d97706', hover: '#d97706' },
        width: 2,
        arrows: { to: { enabled: true, scaleFactor: 0.8 } },
        smooth: { enabled: true, type: 'continuous', roundness: 0 },
        dashes: linkDashes,
        font: { size: 10, color: '#92400e', face: 'Arial, sans-serif', strokeWidth: 3, strokeColor: '#ffffff', align: 'middle' },
      };

      const edgeId = `link-${mod.id}-${linkIdx}`;
      // targetModuleId가 있으면 모듈 노드에 연결, 없으면 시스템 노드에 연결
      const hasTargetModule = !!link.targetModuleId;
      // 타겟 모듈의 시스템 확인 (접기/펼치기용)
      const targetMod = hasTargetModule ? modules.find(m => m.id === link.targetModuleId) : null;
      const otherSysName = sys === link.from ? link.to : link.from;
      const targetSysName = targetMod ? (targetMod.systemType || '미분류') : otherSysName;

      let edgeFrom, edgeTo;
      if (sys === link.from) {
        edgeFrom = `mod-${mod.id}`;
        edgeTo = hasTargetModule ? `mod-${link.targetModuleId}` : `sys-${link.to}`;
      } else if (sys === link.to) {
        edgeFrom = hasTargetModule ? `mod-${link.targetModuleId}` : `sys-${link.from}`;
        edgeTo = `mod-${mod.id}`;
      } else {
        edgeFrom = `mod-${mod.id}`;
        edgeTo = hasTargetModule ? `mod-${link.targetModuleId}` : `sys-${link.to}`;
      }

      edges.push({
        id: edgeId,
        from: edgeFrom,
        to: edgeTo,
        label: link.method || '',
        ...linkEdgeStyle,
        _type: 'link',
        _moduleId: mod.id,
        _sysName: sys,
        _linkFrom: link.from,
        _linkTo: link.to,
        // 접기/펼치기용 메타데이터
        _fromNodeId: edgeFrom,
        _toNodeId: edgeTo,
        _fromSysName: edgeFrom.startsWith('mod-') ? sys : edgeFrom.replace('sys-', ''),
        _toSysName: edgeTo.startsWith('mod-') ? targetSysName : edgeTo.replace('sys-', ''),
      });
    });
  });

  return { nodes, edges, colorMap };
};

// ===== vis-network 옵션 =====
const networkOptions = {
  nodes: {
    borderWidth: 2,
    borderWidthSelected: 3,
    font: {
      size: 12,
      face: 'Arial, sans-serif',
      strokeWidth: 2,
      strokeColor: '#ffffff',
    },
    shadow: {
      enabled: true,
      color: 'rgba(0,0,0,0.15)',
      size: 8,
      x: 2,
      y: 2,
    },
    chosen: {
      node: (values, id, selected, hovering) => {
        if (hovering) {
          values.shadowSize = 25;
          values.shadowColor = 'rgba(139, 92, 246, 0.35)';
          values.size += 4;
          values.borderWidth += 1;
        } else if (selected) {
          values.shadowSize = 20;
        }
      },
    },
  },
  edges: {
    font: { size: 10, align: 'middle', strokeWidth: 3, strokeColor: '#ffffff' },
    smooth: { enabled: true, type: 'continuous', roundness: 0.5 },
  },
  interaction: {
    dragNodes: true,
    dragView: true,
    zoomView: true,
    hover: true,
    hoverConnectedEdges: true,
    selectConnectedEdges: false,
    tooltipDelay: 200,
  },
  physics: {
    enabled: false,
    forceAtlas2Based: {
      gravitationalConstant: -40,
      centralGravity: 0.002,
      springConstant: 0.2,
      springLength: 140,
      damping: 0.85,
      avoidOverlap: 0.7,
    },
    maxVelocity: 50,
    minVelocity: 0.1,
    solver: 'forceAtlas2Based',
    timestep: 0.4,
    stabilization: false,
    adaptiveTimestep: true,
  },
  layout: {
    improvedLayout: false,
    randomSeed: 42,
  },
};

// ===== 메인 컴포넌트 =====
const ModuleFlowView = ({ modules, onEditModule, onDeleteModule }) => {
  const { getLinkMethodType, systemDescriptions } = useModuleCategories();
  const containerRef = useRef(null);
  const networkRef = useRef(null);
  const nodesRef = useRef(null);
  const edgesRef = useRef(null);
  const onEditModuleRef = useRef(onEditModule);
  const onDeleteModuleRef = useRef(onDeleteModule);
  const modulesRef = useRef(modules);
  const initializedRef = useRef(false);
  const collapsedRef = useRef(new Set());
  const dragLevelRef = useRef(1);
  const spacingRef = useRef(140); // springLength default
  const [dragLevel, setDragLevel] = useState(1); // 1~5 or Infinity(All)
  const [spacing, setSpacing] = useState(140);
  const [ctxMenu, setCtxMenu] = useState(null); // { x, y, nodeData, module }

  useEffect(() => { onEditModuleRef.current = onEditModule; }, [onEditModule]);
  useEffect(() => { onDeleteModuleRef.current = onDeleteModule; }, [onDeleteModule]);
  useEffect(() => { modulesRef.current = modules; }, [modules]);

  // 컨텍스트 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    if (!ctxMenu) return;
    const handleClose = () => setCtxMenu(null);
    window.addEventListener('click', handleClose);
    window.addEventListener('contextmenu', handleClose);
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('contextmenu', handleClose);
    };
  }, [ctxMenu]);

  // 시스템 접기/펼치기 토글
  const toggleCollapse = useCallback((sysName) => {
    const nodesDS = nodesRef.current;
    const edgesDS = edgesRef.current;
    if (!nodesDS || !edgesDS) return;

    const collapsed = collapsedRef.current;
    const isCollapsing = !collapsed.has(sysName);

    if (isCollapsing) {
      collapsed.add(sysName);
    } else {
      collapsed.delete(sysName);
    }

    const nodeUpdates = [];

    // 소속 카테고리 노드 숨김/표시
    nodesDS.forEach(node => {
      if (node._type === 'category' && node._sysName === sysName) {
        nodeUpdates.push({ id: node.id, hidden: isCollapsing });
      }
    });

    // 소속 모듈 노드 숨김/표시
    nodesDS.forEach(node => {
      if (node._type !== 'module' || node._systemName !== sysName) return;
      nodeUpdates.push({ id: node.id, hidden: isCollapsing });
    });

    // 시스템 노드 라벨 업데이트
    const sysNode = nodesDS.get(`sys-${sysName}`);
    if (sysNode) {
      const label = isCollapsing
        ? `▶ ${sysNode._sysName}\n(${sysNode._totalCount}개 모듈 접힘)`
        : `${sysNode._sysName}\n(${sysNode._totalCount}개 모듈)`;
      nodeUpdates.push({ id: sysNode.id, label });
    }

    if (nodeUpdates.length > 0) nodesDS.update(nodeUpdates);

    // ===== 전체 link 엣지 재계산 (collapsed 상태 기반) =====
    // 기존 collapsed-link 전부 제거
    const collapsedToRemove = [];
    edgesDS.forEach(edge => {
      if (edge._type === 'collapsed-link') collapsedToRemove.push(edge.id);
    });
    if (collapsedToRemove.length > 0) edgesDS.remove(collapsedToRemove);

    // sys-cat, belong 엣지 숨김/표시
    const edgeUpdates = [];
    edgesDS.forEach(edge => {
      if ((edge._type === 'sys-cat' || edge._type === 'belong') && edge._sysName) {
        const shouldHide = collapsed.has(edge._sysName);
        edgeUpdates.push({ id: edge.id, hidden: shouldHide });
      }
    });

    // link 엣지: collapsed 상태에 따라 숨기고 대체 엣지 생성
    const edgesToAdd = [];
    edgesDS.forEach(edge => {
      if (edge._type !== 'link') return;

      const fromIsModule = edge._fromNodeId && edge._fromNodeId.startsWith('mod-');
      const toIsModule = edge._toNodeId && edge._toNodeId.startsWith('mod-');
      const fromCollapsed = fromIsModule && collapsed.has(edge._fromSysName);
      const toCollapsed = toIsModule && collapsed.has(edge._toSysName);

      if (fromCollapsed || toCollapsed) {
        // 원본 숨김
        edgeUpdates.push({ id: edge.id, hidden: true });

        // collapsed 버전 생성: 접힌 쪽은 시스템 노드로 대체
        const collapsedFrom = fromCollapsed ? `sys-${edge._fromSysName}` : edge._fromNodeId;
        const collapsedTo = toCollapsed ? `sys-${edge._toSysName}` : edge._toNodeId;

        const modNode = nodesDS.get(`mod-${edge._moduleId}`);
        const modName = modNode ? modNode.label.split('\n')[0] : '';
        const collapsedLabel = edge.label ? `${modName}\n(${edge.label})` : modName;

        edgesToAdd.push({
          id: `collapsed-${edge.id}`,
          from: collapsedFrom,
          to: collapsedTo,
          label: collapsedLabel,
          color: { color: '#f59e0b', highlight: '#d97706', hover: '#d97706' },
          width: 2.5,
          arrows: { to: { enabled: true, scaleFactor: 1.2 } },
          smooth: { enabled: true, type: 'curvedCW', roundness: 0 },
          dashes: edge.dashes,
          font: { size: 10, color: '#92400e', face: 'Arial, sans-serif', strokeWidth: 3, strokeColor: '#ffffff', align: 'middle' },
          _type: 'collapsed-link',
          _origLinkId: edge.id,
        });
      } else {
        // 원본 표시
        edgeUpdates.push({ id: edge.id, hidden: false });
      }
    });

    if (edgeUpdates.length > 0) edgesDS.update(edgeUpdates);
    if (edgesToAdd.length > 0) edgesDS.add(edgesToAdd);

    // collapsed-link 엣지 곡률 재분배 (같은 노드 쌍 사이 겹침 방지)
    const pairMap = {};
    edgesDS.forEach(edge => {
      if (edge._type !== 'collapsed-link') return;
      const a = edge.from < edge.to ? edge.from : edge.to;
      const b = edge.from < edge.to ? edge.to : edge.from;
      const pairKey = `${a}↔${b}`;
      if (!pairMap[pairKey]) pairMap[pairKey] = [];
      pairMap[pairKey].push({ id: edge.id, from: edge.from, to: edge.to });
    });

    const roundnessUpdates = [];
    Object.values(pairMap).forEach(edges => {
      if (edges.length <= 1) return;
      edges.forEach((edge, i) => {
        const step = Math.floor(i / 2) + 1;
        const magnitude = 0.2 * step;
        const visualSign = i % 2 === 0 ? 1 : -1;
        const directionFlip = edge.from > edge.to ? -1 : 1;
        const roundness = magnitude * visualSign * directionFlip;
        roundnessUpdates.push({
          id: edge.id,
          smooth: { enabled: true, type: 'curvedCW', roundness },
        });
      });
    });
    if (roundnessUpdates.length > 0) edgesDS.update(roundnessUpdates);
  }, []);

  // 범례
  const legendItems = useMemo(() => {
    const systemMap = new Map();
    modules.forEach(mod => {
      const sys = mod.systemType || '미분류';
      if (!systemMap.has(sys)) systemMap.set(sys, true);
    });
    modules.forEach(mod => {
      const modLinks = mod.links || [];
      modLinks.forEach(link => {
        if (link.from) systemMap.set(link.from, true);
        if (link.to) systemMap.set(link.to, true);
      });
    });
    return [...systemMap.keys()].map((sys, i) => ({
      label: sys,
      color: getSystemColor(i),
    }));
  }, [modules]);

  // Network 한 번만 생성 (dx-work-process 패턴)
  useEffect(() => {
    if (!containerRef.current) return;

    const nodesDS = new DataSet([]);
    const edgesDS = new DataSet([]);
    nodesRef.current = nodesDS;
    edgesRef.current = edgesDS;

    const network = new Network(
      containerRef.current,
      { nodes: nodesDS, edges: edgesDS },
      networkOptions
    );
    networkRef.current = network;

    // 클릭 → 시스템 접기/펼치기
    network.on('click', (params) => {
      if (params.nodes.length === 0) return;
      const nodeData = nodesDS.get(params.nodes[0]);
      if (nodeData?._type === 'system' && nodeData._sysName) {
        toggleCollapse(nodeData._sysName);
      }
    });

    // 더블클릭 → 모듈 편집
    network.on('doubleClick', (params) => {
      if (params.nodes.length === 0) return;
      const nodeData = nodesDS.get(params.nodes[0]);
      if (nodeData?._type === 'module' && nodeData._moduleId && onEditModuleRef.current) {
        const mod = modulesRef.current.find(m => m.id === nodeData._moduleId);
        if (mod) onEditModuleRef.current(mod);
      }
    });

    // N-레벨 BFS: startId에서 maxDepth 단계까지 연결된 노드 수집
    const getConnectedAtDepth = (startId, maxDepth) => {
      const visited = new Set([startId]);
      let frontier = [startId];
      for (let d = 0; d < maxDepth && frontier.length > 0; d++) {
        const nextFrontier = [];
        for (const nodeId of frontier) {
          const neighbors = network.getConnectedNodes(nodeId);
          for (const nid of neighbors) {
            if (!visited.has(nid)) {
              visited.add(nid);
              nextFrontier.push(nid);
            }
          }
        }
        frontier = nextFrontier;
      }
      return visited;
    };

    // 노드 드래그: 드래그 노드 + N-레벨 이웃 물리엔진 적용, 나머지 고정
    let fixedBackup = null;
    network.on('dragStart', (params) => {
      if (params.nodes.length === 0) return; // 배경 PAN

      isDragging = true;
      if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
      clearHighlight();

      const draggedId = params.nodes[0];
      const level = dragLevelRef.current;
      const connectedIds = getConnectedAtDepth(draggedId, level);

      // 연결 범위 밖 노드를 전부 고정
      fixedBackup = {};
      nodesDS.forEach(node => {
        if (!connectedIds.has(node.id)) {
          fixedBackup[node.id] = node.fixed || false;
          nodesDS.update({ id: node.id, fixed: { x: true, y: true } });
        }
      });

      network.setOptions({
        physics: {
          enabled: true,
          forceAtlas2Based: {
            centralGravity: 0,
            gravitationalConstant: -20,
            springConstant: 0.2,
            springLength: spacingRef.current,
            damping: 0.95,
            avoidOverlap: 0.7,
          },
        },
      });
    });

    network.on('dragEnd', () => {
      isDragging = false;
      if (!fixedBackup) return;

      network.setOptions({ physics: { enabled: false } });

      // 고정 해제
      const updates = Object.keys(fixedBackup).map(id => ({
        id,
        fixed: fixedBackup[id],
      }));
      if (updates.length > 0) nodesDS.update(updates);
      fixedBackup = null;
    });

    // ===== 호버 하이라이트: 딜레이 후 연결된 노드+엣지 강조, 나머지 흐리게 =====
    let highlightActive = false;
    let hoverTimer = null;
    let isDragging = false;

    const applyHighlight = (hoveredNodeId) => {
      const nDS = nodesRef.current;
      const eDS = edgesRef.current;
      if (!nDS || !eDS) return;

      const connectedEdgeIds = new Set(network.getConnectedEdges(hoveredNodeId));
      const connectedNodeIds = new Set(network.getConnectedNodes(hoveredNodeId));
      connectedNodeIds.add(hoveredNodeId);

      const nodeUpdates = [];
      nDS.forEach(node => {
        if (node.hidden) return;
        if (connectedNodeIds.has(node.id)) {
          nodeUpdates.push({ id: node.id, opacity: 1.0 });
        } else {
          nodeUpdates.push({ id: node.id, opacity: 0.35 });
        }
      });

      const edgeUpdates = [];
      eDS.forEach(edge => {
        if (edge.hidden) return;
        if (connectedEdgeIds.has(edge.id)) {
          edgeUpdates.push({ id: edge.id, opacity: 1.0 });
        } else {
          edgeUpdates.push({ id: edge.id, opacity: 0.15 });
        }
      });

      if (nodeUpdates.length) nDS.update(nodeUpdates);
      if (edgeUpdates.length) eDS.update(edgeUpdates);
      highlightActive = true;
    };

    const clearHighlight = () => {
      if (!highlightActive) return;
      const nDS = nodesRef.current;
      const eDS = edgesRef.current;
      if (!nDS || !eDS) return;

      const nodeUpdates = [];
      nDS.forEach(node => {
        if (node.hidden) return;
        nodeUpdates.push({ id: node.id, opacity: 1.0 });
      });

      const edgeUpdates = [];
      eDS.forEach(edge => {
        if (edge.hidden) return;
        edgeUpdates.push({ id: edge.id, opacity: 1.0 });
      });

      if (nodeUpdates.length) nDS.update(nodeUpdates);
      if (edgeUpdates.length) eDS.update(edgeUpdates);
      highlightActive = false;
    };

    network.on('hoverNode', (params) => {
      if (isDragging) return;
      if (hoverTimer) clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => {
        if (!isDragging) applyHighlight(params.node);
      }, 300);
    });

    network.on('blurNode', () => {
      if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
      clearHighlight();
    });

    // 우클릭 → 컨텍스트 메뉴 (native event로 처리)
    const handleContextMenu = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = containerRef.current.getBoundingClientRect();
      const domX = e.clientX - rect.left;
      const domY = e.clientY - rect.top;

      const nodeId = network.getNodeAt({ x: domX, y: domY });
      if (!nodeId) {
        setCtxMenu(null);
        return;
      }
      const nodeData = nodesDS.get(nodeId);
      if (!nodeData) return;

      let mod = null;
      if (nodeData._type === 'module' && nodeData._moduleId) {
        mod = modulesRef.current.find(m => m.id === nodeData._moduleId);
      }

      setCtxMenu({
        x: domX,
        y: domY,
        nodeData,
        module: mod,
      });
    };

    containerRef.current.addEventListener('contextmenu', handleContextMenu);
    const canvasEl = containerRef.current;

    initializedRef.current = true;

    return () => {
      if (hoverTimer) clearTimeout(hoverTimer);
      canvasEl.removeEventListener('contextmenu', handleContextMenu);
      network.destroy();
      networkRef.current = null;
      nodesRef.current = null;
      edgesRef.current = null;
      initializedRef.current = false;
    };
  }, []); // ← 빈 의존성: 한 번만 생성

  // 데이터 변경 시 점진적 업데이트 (destroy/recreate 하지 않음)
  useEffect(() => {
    if (!nodesRef.current || !edgesRef.current || !initializedRef.current) return;

    const { nodes, edges } = buildGraphData(modules, getLinkMethodType, systemDescriptions);

    // 데이터 갱신 시 접힌 상태 초기화
    collapsedRef.current.clear();

    // 기존 데이터 클리어 후 새 데이터 설정
    nodesRef.current.clear();
    edgesRef.current.clear();

    if (nodes.length > 0) {
      nodesRef.current.add(nodes);
    }
    if (edges.length > 0) {
      edgesRef.current.add(edges);
    }

    if (!networkRef.current || nodes.length === 0) return;

    // 물리엔진 + stabilization 으로 화면 렌더 전에 배치 완료
    networkRef.current.setOptions({
      physics: {
        enabled: true,
        stabilization: {
          enabled: true,
          iterations: 200,
          updateInterval: 25,
        },
      },
    });

    // 안정화 완료 시 물리엔진 끄고 fit
    const onStabilized = () => {
      if (!networkRef.current) return;
      networkRef.current.setOptions({ physics: { enabled: false } });
      networkRef.current.fit({ animation: { duration: 400, easingFunction: 'easeInOutQuad' } });
    };
    networkRef.current.once('stabilizationIterationsDone', onStabilized);

    // 안전장치: 3초 후 물리엔진 강제 종료
    const forceStopTimer = setTimeout(() => {
      if (!networkRef.current) return;
      networkRef.current.off('stabilizationIterationsDone', onStabilized);
      networkRef.current.setOptions({ physics: { enabled: false } });
      networkRef.current.fit({ animation: { duration: 400, easingFunction: 'easeInOutQuad' } });
    }, 3000);

    networkRef.current.stabilize();

    return () => {
      clearTimeout(forceStopTimer);
      if (networkRef.current) {
        networkRef.current.off('stabilizationIterationsDone', onStabilized);
      }
    };
  }, [modules, getLinkMethodType, systemDescriptions]);

  // ===== Pan / Zoom 컨트롤 =====
  const PAN_STEP = 150;

  const handlePan = useCallback((dx, dy) => {
    if (!networkRef.current) return;
    const pos = networkRef.current.getViewPosition();
    networkRef.current.moveTo({ position: { x: pos.x + dx, y: pos.y + dy }, animation: { duration: 200, easingFunction: 'easeInOutQuad' } });
  }, []);

  const handleZoomIn = useCallback(() => {
    if (!networkRef.current) return;
    const scale = networkRef.current.getScale();
    networkRef.current.moveTo({ scale: scale * 1.3, animation: { duration: 200, easingFunction: 'easeInOutQuad' } });
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!networkRef.current) return;
    const scale = networkRef.current.getScale();
    networkRef.current.moveTo({ scale: scale / 1.3, animation: { duration: 200, easingFunction: 'easeInOutQuad' } });
  }, []);

  const handleFit = useCallback(() => {
    if (!networkRef.current) return;
    networkRef.current.fit({ animation: { duration: 400, easingFunction: 'easeInOutQuad' } });
  }, []);

  const handleCtxEdit = () => {
    if (ctxMenu?.module && onEditModuleRef.current) {
      onEditModuleRef.current(ctxMenu.module);
    }
    setCtxMenu(null);
  };

  const handleCtxDelete = () => {
    if (ctxMenu?.module && onDeleteModuleRef.current) {
      onDeleteModuleRef.current(ctxMenu.module.id);
    }
    setCtxMenu(null);
  };

  const DRAG_LEVELS = [
    { value: 1, label: '1' },
    { value: 2, label: '2' },
    { value: 3, label: '3' },
    { value: 4, label: '4' },
    { value: 5, label: '5' },
    { value: Infinity, label: 'All' },
  ];

  const handleDragLevelChange = useCallback((level) => {
    setDragLevel(level);
    dragLevelRef.current = level;
  }, []);

  const handleSpacingChange = useCallback((value) => {
    const v = Number(value);
    setSpacing(v);
    spacingRef.current = v;

    if (!networkRef.current || !nodesRef.current) return;
    const nodeCount = nodesRef.current.length;
    if (nodeCount === 0) return;

    networkRef.current.setOptions({
      physics: {
        enabled: true,
        forceAtlas2Based: {
          gravitationalConstant: -40,
          centralGravity: 0.002,
          springConstant: 0.2,
          springLength: v,
          damping: 0.85,
          avoidOverlap: 0.7,
        },
        stabilization: {
          enabled: true,
          iterations: 150,
          updateInterval: 25,
        },
      },
    });

    const onDone = () => {
      if (!networkRef.current) return;
      networkRef.current.setOptions({ physics: { enabled: false } });
    };
    networkRef.current.once('stabilizationIterationsDone', onDone);
    networkRef.current.stabilize();
  }, []);

  const handleCtxCollapse = () => {
    if (ctxMenu?.nodeData?._type === 'system' && ctxMenu.nodeData._sysName) {
      toggleCollapse(ctxMenu.nodeData._sysName);
    }
    setCtxMenu(null);
  };

  return (
    <Container>
      <GraphCanvas ref={containerRef} />
      {legendItems.length > 0 && (
        <Legend>
          {legendItems.map(item => (
            <LegendItem key={item.label}>
              <LegendDot $color={lighten(item.color, 160)} $border={item.color} />
              {item.label}
            </LegendItem>
          ))}
          <LegendItem>
            <LegendLine />
            연계 (시스템)
          </LegendItem>
          <LegendItem>
            <LegendLine $dashed />
            연계 (비시스템)
          </LegendItem>
          <LegendItem style={{ color: '#94a3b8', fontSize: '0.625rem' }}>
            클릭: 접기/펼치기
          </LegendItem>
        </Legend>
      )}
      {ctxMenu && (
        <ContextMenu
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {ctxMenu.nodeData._type === 'module' && ctxMenu.module && (
            <>
              <ContextMenuLabel>{ctxMenu.module.name}</ContextMenuLabel>
              <ContextMenuDivider />
              <ContextMenuItem onClick={handleCtxEdit}>
                <Edit3 size={14} />
                편집
              </ContextMenuItem>
              <ContextMenuItem $danger onClick={handleCtxDelete}>
                <Trash2 size={14} />
                삭제
              </ContextMenuItem>
            </>
          )}
          {ctxMenu.nodeData._type === 'system' && (
            <>
              <ContextMenuLabel>{ctxMenu.nodeData._sysName}</ContextMenuLabel>
              <ContextMenuDivider />
              <ContextMenuItem onClick={handleCtxCollapse}>
                {collapsedRef.current.has(ctxMenu.nodeData._sysName) ? '📂 펼치기' : '📁 접기'}
              </ContextMenuItem>
            </>
          )}
        </ContextMenu>
      )}
      <Controls>
        <PanGrid>
          <div />
          <PanBtn title="위로 이동" onClick={() => handlePan(0, -PAN_STEP)}><ChevronUp size={14} /></PanBtn>
          <div />
          <PanBtn title="왼쪽으로 이동" onClick={() => handlePan(-PAN_STEP, 0)}><ChevronLeft size={14} /></PanBtn>
          <PanCenter>PAN</PanCenter>
          <PanBtn title="오른쪽으로 이동" onClick={() => handlePan(PAN_STEP, 0)}><ChevronRight size={14} /></PanBtn>
          <div />
          <PanBtn title="아래로 이동" onClick={() => handlePan(0, PAN_STEP)}><ChevronDown size={14} /></PanBtn>
          <div />
        </PanGrid>
        <ControlGroup>
          <ControlBtn title="확대" onClick={handleZoomIn}><ZoomIn size={15} /></ControlBtn>
          <ControlBtn title="축소" onClick={handleZoomOut}><ZoomOut size={15} /></ControlBtn>
          <ControlBtn title="전체 보기" onClick={handleFit}><Maximize size={14} /></ControlBtn>
        </ControlGroup>
        <LevelGroup>
          <LevelLabel>LEV</LevelLabel>
          {DRAG_LEVELS.map(lv => (
            <LevelBtn
              key={lv.label}
              $active={dragLevel === lv.value}
              title={`드래그 연결 범위: ${lv.label === 'All' ? '전체' : lv.label + '단계'}`}
              onClick={() => handleDragLevelChange(lv.value)}
            >
              {lv.label}
            </LevelBtn>
          ))}
        </LevelGroup>
        <SpacingGroup>
          <SpacingLabel>GAP</SpacingLabel>
          <SpacingSlider
            min={20}
            max={800}
            step={10}
            value={spacing}
            onChange={(e) => handleSpacingChange(e.target.value)}
            title={`노드 간격: ${spacing}`}
          />
          <SpacingValue>{spacing}</SpacingValue>
        </SpacingGroup>
      </Controls>
    </Container>
  );
};

export default ModuleFlowView;
