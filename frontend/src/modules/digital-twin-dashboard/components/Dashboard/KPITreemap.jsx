import React, { useMemo, useRef, useEffect, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download } from 'lucide-react';
import * as d3 from 'd3';

// ====== 헬퍼 ======

const extractDivisionFromPerformance = (performanceName) => {
  const match = (performanceName || '').match(/^\[(.+?)\]\s*(.*)$/);
  if (match) return { division: match[1], name: match[2] };
  return { division: '미분류', name: performanceName || '' };
};

const getPerfKey = (p) => p.uuid || p.id || p.성과항목;

const toNum = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
};

const formatNum = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '-';
  const abs = Math.abs(n);
  if (abs >= 1e8) return `${(n / 1e8).toFixed(1)}억`;
  if (abs >= 1e4) return `${(n / 1e4).toFixed(1)}만`;
  if (abs % 1 === 0) return n.toLocaleString();
  return parseFloat(n.toFixed(1)).toLocaleString();
};

const formatPct = (p) => {
  if (p === null || p === undefined || !isFinite(p) || p < 0) return '-';
  if (p < 0.1) return '<0.1%';
  if (p >= 10) return `${Math.round(p)}%`;
  return `${p.toFixed(1)}%`;
};

// 성과의 '실적' 값: 월별이면 월별 합, 아니면 실적수준
const computeActualValue = (p) => {
  if (p.월별실적여부 && Array.isArray(p.월별실적) && p.월별실적.length > 0) {
    const nums = p.월별실적.map(v => parseFloat(v)).filter(v => !isNaN(v));
    if (nums.length > 0) return nums.reduce((a, b) => a + b, 0);
    return null;
  }
  const n = parseFloat(p.실적수준);
  return isNaN(n) ? null : n;
};

const METRIC_LABEL = {
  target: '목표 - 현재',
  actual: '실적 - 현재',
};
const METRIC_SHORT = {
  target: '목표-현재',
  actual: '실적-현재',
};

const adjustBrightness = (hex, factor) => {
  if (!hex || !hex.startsWith('#') || hex.length !== 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const fn = factor > 0
    ? (c) => Math.round(c + (255 - c) * factor)
    : (c) => Math.max(0, Math.round(c * (1 + factor)));
  return `#${[r, g, b].map(fn).map(c => c.toString(16).padStart(2, '0')).join('')}`;
};

const DIVISION_PALETTE = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#64748b',
];

// 사업부 고정 순서
const DIVISION_ORDER = ['MX', 'VD', 'DA', 'NW', '의료기기'];
const DIVISION_ORDER_MAP = DIVISION_ORDER.reduce((acc, name, i) => {
  acc[name] = i;
  return acc;
}, {});
const compareDivision = (a, b) => {
  const ai = DIVISION_ORDER_MAP[a] ?? 999;
  const bi = DIVISION_ORDER_MAP[b] ?? 999;
  if (ai !== bi) return ai - bi;
  return String(a).localeCompare(String(b));
};

// ====== 스타일 ======

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 0.25rem;
  width: 100%;
`;

const UnitBlock = styled(motion.div)`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  /* 상단 네비/헤더/필터들 고려해서 뷰포트 세로 거의 가득 채움 */
  min-height: calc(100vh - 320px);
  display: flex;
  flex-direction: column;
`;

const UnitHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.85rem 1.25rem;
  border-bottom: 1px solid #e2e8f0;
  background: linear-gradient(to right, #f8fafc, white);
`;

const UnitTitleWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
`;

const UnitBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.6rem;
  background: #eef2ff;
  color: #4f46e5;
  border-radius: 0.4rem;
  font-size: 0.82rem;
  font-weight: 700;
`;

const UnitTitle = styled.div`
  font-size: 0.9rem;
  font-weight: 600;
  color: #1e293b;
`;

const UnitStats = styled.div`
  display: flex;
  align-items: center;
  gap: 0.85rem;
  font-size: 0.78rem;
  color: #64748b;
  b { color: #1e293b; font-weight: 700; }
`;

const TreemapArea = styled.div`
  display: flex;
  gap: 1rem;
  padding: 0.85rem 1rem 1rem 1rem;
  flex: 1;
  min-height: 0;
`;

const TreemapCanvas = styled.div`
  flex: 3;
  min-width: 0;
  min-height: 420px;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  overflow: hidden;
  position: relative;
  background: #f8fafc;
  svg { width: 100%; height: 100%; display: block; }
`;

const LegendPanel = styled.div`
  flex: 1;
  min-width: 180px;
  max-width: 240px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  padding: 0.85rem 1rem;
  overflow-y: auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;

  &::-webkit-scrollbar { width: 6px; }
  &::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 3px; }
  &::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
`;

const LegendTitle = styled.div`
  font-size: 0.78rem;
  font-weight: 700;
  color: #1e293b;
  padding-bottom: 0.4rem;
  border-bottom: 2px solid #e2e8f0;
`;

const LegendItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.78rem;
  color: #475569;
`;

const LegendDot = styled.div`
  width: 12px; height: 12px; border-radius: 3px;
  background: ${p => p.$color}; flex-shrink: 0;
`;

const LegendCount = styled.span`
  margin-left: auto;
  font-size: 0.72rem;
  color: #94a3b8;
  font-variant-numeric: tabular-nums;
`;

const Tooltip = styled.div`
  position: fixed;
  background: rgba(15, 23, 42, 0.96);
  color: white;
  padding: 0.7rem 0.85rem;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  pointer-events: none;
  z-index: 10000;
  max-width: 340px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
  line-height: 1.55;
  white-space: pre-line;
  border: 1px solid rgba(255, 255, 255, 0.08);
`;

const EmptyState = styled.div`
  padding: 3rem 2rem;
  text-align: center;
  color: #94a3b8;
  .icon { font-size: 2.5rem; margin-bottom: 0.75rem; opacity: 0.6; }
  .msg { font-size: 0.9rem; font-weight: 500; }
  .sub { font-size: 0.78rem; margin-top: 0.4rem; color: #cbd5e1; }
`;

// ====== KPI 필터 바 ======

const FilterBar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 0.85rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.6rem;
  flex-wrap: wrap;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
`;

const FilterLabel = styled.span`
  font-size: 0.75rem;
  font-weight: 700;
  color: #64748b;
  margin-right: 0.1rem;
  white-space: nowrap;
`;

const FilterAllBtn = styled.button`
  padding: 0.25rem 0.7rem;
  border-radius: 0.75rem;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid #d1d5db;
  background: #f8fafc;
  color: #64748b;
  white-space: nowrap;
  &:hover { background: #e2e8f0; }
`;

const FilterChip = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.7rem;
  border-radius: 0.75rem;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  border: 1.5px solid ${p => p.$active ? '#6366f1' : '#d1d5db'};
  background: ${p => p.$active ? '#6366f1' : 'white'};
  color: ${p => p.$active ? '#ffffff' : '#4b5563'};
  white-space: nowrap;
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  &:hover {
    border-color: #6366f1;
    ${p => !p.$active && `background: #eef2ff; color: #4338ca;`}
  }
`;

const ChipDivisionDot = styled.span`
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: ${p => p.$color || '#94a3b8'};
  flex-shrink: 0;
`;

const ChipDivisionLabel = styled.span`
  font-size: 0.65rem;
  font-weight: 500;
  opacity: ${p => p.$active ? 0.85 : 0.6};
  padding-left: 0.2rem;
  border-left: 1px solid ${p => p.$active ? 'rgba(255,255,255,0.35)' : '#e2e8f0'};
`;

const FilterMuted = styled.span`
  font-size: 0.72rem;
  color: #94a3b8;
  margin-left: 0.25rem;
`;

const FilterDivider = styled.span`
  width: 1px;
  height: 22px;
  background: #e2e8f0;
  margin: 0 0.5rem;
  flex-shrink: 0;
`;

const MetricGroup = styled.div`
  display: inline-flex;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  padding: 0.15rem;
`;

const MetricBtn = styled.button`
  padding: 0.3rem 0.75rem;
  border: none;
  border-radius: 0.35rem;
  background: ${p => p.$active ? 'white' : 'transparent'};
  color: ${p => p.$active ? '#4338ca' : '#64748b'};
  font-size: 0.75rem;
  font-weight: ${p => p.$active ? 700 : 500};
  cursor: pointer;
  transition: all 0.15s;
  box-shadow: ${p => p.$active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'};
  white-space: nowrap;
  &:hover {
    color: ${p => p.$active ? '#4338ca' : '#334155'};
  }
`;

const BreadcrumbBar = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.3rem;
  padding: 0.5rem 1.1rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  font-size: 0.78rem;
  color: #64748b;
`;

const BreadcrumbLabel = styled.span`
  font-size: 0.72rem;
  color: #94a3b8;
  font-weight: 700;
  margin-right: 0.15rem;
`;

const BreadcrumbItem = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.6rem;
  border: 1px solid ${p => p.$active ? '#6366f1' : '#e2e8f0'};
  background: ${p => p.$active ? '#eef2ff' : 'white'};
  color: ${p => p.$active ? '#4338ca' : '#475569'};
  border-radius: 0.4rem;
  font-size: 0.75rem;
  font-weight: ${p => p.$active ? 700 : 500};
  cursor: pointer;
  transition: all 0.12s;
  &:hover { border-color: #818cf8; color: #4338ca; }
`;

const BreadcrumbSep = styled.span`
  color: #cbd5e1;
  font-size: 0.72rem;
  user-select: none;
`;

const BreadcrumbReset = styled.button`
  padding: 0.2rem 0.6rem;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #b91c1c;
  border-radius: 0.4rem;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  margin-left: auto;
  transition: all 0.12s;
  &:hover { background: #fee2e2; border-color: #fca5a5; }
`;

// ===== 상세 모달 =====

const ModalOverlay = styled(motion.div)`
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  z-index: 20000;
`;

const ModalBox = styled(motion.div)`
  background: white;
  border-radius: 0.85rem;
  /* 항목/내용/단위 3열 목록이라 넓힐수록 읽기 어려워진다. 폭은 고정하고 높이는 내용에 맞춘다. */
  width: min(94vw, 720px);
  height: auto;
  max-height: 86vh;
  display: flex; flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
`;

const ModalHeader = styled.div`
  padding: 1rem 1.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
  gap: 1rem;
`;

const ModalTitle = styled.h3`
  margin: 0; font-size: 1rem; font-weight: 700; color: #1e293b;
`;

const ModalBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.65rem;
  border-radius: 0.5rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: white;
  background: ${p => p.$color || '#64748b'};
`;

const ModalMeta = styled.span`
  font-size: 0.82rem; color: #64748b;
  b { color: #4f46e5; font-weight: 700; }
`;

const ModalActions = styled.div`
  display: flex; align-items: center; gap: 0.4rem;
`;

const ModalBtn = styled.button`
  display: inline-flex; align-items: center; gap: 0.3rem;
  padding: 0.45rem 0.85rem;
  border: 1px solid ${p => p.$primary ? '#a5b4fc' : '#e2e8f0'};
  background: ${p => p.$primary ? '#eef2ff' : 'white'};
  color: ${p => p.$primary ? '#4f46e5' : '#64748b'};
  border-radius: 0.5rem;
  font-size: 0.78rem; font-weight: 600; cursor: pointer;
  transition: all 0.15s;
  &:hover {
    background: ${p => p.$primary ? '#e0e7ff' : '#f8fafc'};
    border-color: ${p => p.$primary ? '#818cf8' : '#cbd5e1'};
  }
`;

const ModalIconBtn = styled.button`
  width: 32px; height: 32px;
  border: none; background: #f1f5f9; color: #64748b;
  border-radius: 0.5rem;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.15s;
  &:hover { background: #e2e8f0; color: #1e293b; }
`;

const ModalBody = styled.div`
  /* basis:auto 라야 부모가 height:auto 일 때 내용 높이로 접히지 않는다 */
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  &::-webkit-scrollbar { width: 8px; }
  &::-webkit-scrollbar-track { background: #f1f5f9; }
  &::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
`;

const DataTable = styled.table`
  width: 100%; border-collapse: collapse;
`;

const Th = styled.th`
  padding: 0.6rem 1rem;
  font-size: 0.74rem; font-weight: 700;
  color: #64748b;
  text-align: ${p => p.$align || 'left'};
  background: #f8fafc;
  border-bottom: 2px solid #e2e8f0;
  position: sticky; top: 0; z-index: 1;
  white-space: nowrap;
`;

const Tr = styled.tr`
  &:not(:last-child) td { border-bottom: 1px solid #f1f5f9; }
  &:hover { background: #fafbfc; }
`;

const Td = styled.td`
  padding: 0.55rem 1rem;
  font-size: 0.8rem; color: #1e293b;
  vertical-align: middle;
  text-align: ${p => p.$align || 'left'};
`;

const DeltaChip = styled.span`
  display: inline-flex; align-items: center; gap: 0.15rem;
  padding: 0.15rem 0.5rem;
  background: #eef2ff; color: #4f46e5;
  border-radius: 0.3rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
`;

const MutedText = styled.span`color: #94a3b8;`;

/* 값 뒤에 붙는 단위. 숫자보다 약하게 보여야 숫자가 먼저 읽힌다. */
const UnitSuffix = styled.span`
  margin-left: 0.25rem;
  font-size: 0.72rem;
  font-weight: 500;
  color: #94a3b8;
`;

/* 값 셀은 좌측 정렬이되 숫자 폭은 고정. */
const ValueText = styled.span`
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: #1e293b;
`;

// ====== 메인 컴포넌트 ======

const KPITreemap = ({
  kpiCards = [],
  yearPerformances = [],
  divisions = [],
  applyConversion,
  selectedDivision = 'all',
  currentYear,
  projects = [],
}) => {
  const [detailModal, setDetailModal] = useState(null);
  const [selectedKpiIds, setSelectedKpiIds] = useState(null); // null = 전체, Set = 선택된 id
  const [metricMode, setMetricMode] = useState('target'); // 'target' | 'actual'

  // 성과 → 연결된 과제명 매핑
  const perfProjectMap = useMemo(() => {
    const map = new Map();
    (projects || []).forEach(proj => {
      if (proj._deleted) return;
      const perfList = proj.성과목록;
      if (!perfList || perfList.length === 0) return;
      const projectId = proj.id || proj.uuid;
      const projectName = proj.과제명 || '(이름 없음)';
      perfList.forEach(perfRef => {
        const perfKey = typeof perfRef === 'string'
          ? perfRef
          : (perfRef.성과항목UUID || perfRef.성과UUID || perfRef.성과항목ID || perfRef.성과항목 || perfRef.id);
        if (!perfKey) return;
        let arr = map.get(perfKey);
        if (!arr) { arr = []; map.set(perfKey, arr); }
        if (!arr.some(p => p.id === projectId)) {
          arr.push({ id: projectId, 과제명: projectName });
        }
      });
    });
    return map;
  }, [projects]);

  const getLinkedProjectNames = useCallback((perf) => {
    if (!perf) return [];
    const keys = [perf.uuid, perf.id, perf.성과항목UUID, perf.성과UUID, perf.성과항목ID, perf.성과항목];
    for (const key of keys) {
      if (key && perfProjectMap.has(key)) {
        return perfProjectMap.get(key).map(p => p.과제명);
      }
    }
    return [];
  }, [perfProjectMap]);

  const divisionColorMap = useMemo(() => {
    const map = {};
    (divisions || []).forEach((d, i) => {
      map[d.name] = d.color || DIVISION_PALETTE[i % DIVISION_PALETTE.length];
    });
    return map;
  }, [divisions]);

  const getDivisionColor = useCallback((name) => {
    if (divisionColorMap[name]) return divisionColorMap[name];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return DIVISION_PALETTE[hash % DIVISION_PALETTE.length];
  }, [divisionColorMap]);

  const handleLeafClick = useCallback((leaf, unit, pct, totalVisible) => {
    setDetailModal({ unit, leaf, pct, totalVisible });
  }, []);

  // 필터 대상 KPI 카드 (합계 로직 + 사업부 필터 적용)
  const availableKpis = useMemo(() => {
    const pool = kpiCards.filter(c => c.logic === '합계');
    const byDiv = selectedDivision === 'all'
      ? pool
      : pool.filter(c => c.division === selectedDivision);
    return byDiv.map(c => ({
      id: c.id,
      name: c.name || '(KPI 미지정)',
      division: c.division,
      treemapEnabled: c.treemapEnabled !== false
    }));
  }, [kpiCards, selectedDivision]);

  // 카드 추가/삭제 또는 트리맵 활성화 여부 변경 시 사용자 선택 초기화 → 기본값(활성화 카드만) 적용
  const availableKpiKey = useMemo(
    () => availableKpis.map(k => `${k.id}:${k.treemapEnabled ? '1' : '0'}`).sort().join('|'),
    [availableKpis]
  );
  useEffect(() => {
    setSelectedKpiIds(null);
  }, [availableKpiKey]);

  // 기본 선택 집합: 트리맵 활성화 = true 인 카드만
  const defaultSelectedKpiIds = useMemo(() => {
    return new Set(availableKpis.filter(k => k.treemapEnabled).map(k => k.id));
  }, [availableKpis]);

  // 실제 적용되는 선택 집합 (사용자 미수정 시 기본값)
  const activeKpiIdSet = useMemo(() => {
    return selectedKpiIds === null ? defaultSelectedKpiIds : selectedKpiIds;
  }, [selectedKpiIds, defaultSelectedKpiIds]);

  const toggleKpiId = useCallback((id) => {
    setSelectedKpiIds(prev => {
      const cur = new Set(prev === null ? defaultSelectedKpiIds : prev);
      if (cur.has(id)) cur.delete(id); else cur.add(id);
      return cur;
    });
  }, [defaultSelectedKpiIds]);

  const isAllSelected = activeKpiIdSet.size === availableKpis.length && availableKpis.length > 0;
  const toggleAll = useCallback(() => {
    if (isAllSelected) {
      // 전부 해제
      setSelectedKpiIds(new Set());
    } else {
      // 전부 선택 (실제 모든 id 포함)
      setSelectedKpiIds(new Set(availableKpis.map(k => k.id)));
    }
  }, [isAllSelected, availableKpis]);

  // 합계 로직 카드만, 각 성과의 |목표-현재| 환산 값을 리프로
  const leaves = useMemo(() => {
    if (!applyConversion) return [];
    const perfIndex = new Map();
    yearPerformances.forEach(p => perfIndex.set(getPerfKey(p), p));

    const result = [];
    const cardsToUse = kpiCards.filter(c => c.logic === '합계');
    const byDiv = selectedDivision === 'all'
      ? cardsToUse
      : cardsToUse.filter(c => c.division === selectedDivision);
    const filteredByDiv = byDiv.filter(c => activeKpiIdSet.has(c.id));

    filteredByDiv.forEach(card => {
      (card.selectedPerfKeys || []).forEach(key => {
        const p = perfIndex.get(key);
        if (!p) return;
        const { division: extractedDiv, name: perfNameOnly } = extractDivisionFromPerformance(p.성과항목);
        const sourceUnit = p.단위 || '';
        const convDivision = card.division === '전체' ? extractedDiv : card.division;
        const curCv = applyConversion(p.현재수준, sourceUnit, convDivision);
        const tgtCv = applyConversion(p.목표수준, sourceUnit, convDivision);
        const actualRaw = computeActualValue(p);
        const actCv = actualRaw !== null && actualRaw !== undefined
          ? applyConversion(actualRaw, sourceUnit, convDivision)
          : { value: null, unit: null };
        const resolvedUnit = curCv.unit || tgtCv.unit || actCv.unit || sourceUnit || '(단위없음)';
        const cur = toNum(curCv.value);
        const tgt = toNum(tgtCv.value);
        const act = toNum(actCv.value);
        if (cur === null && tgt === null && act === null) return;
        const curN = cur ?? 0;
        const tgtN = tgt ?? 0;
        const actN = act; // null 가능

        // 선택된 metric 기준 delta. 해당 metric 값이 없으면 이 성과는 제외
        let delta;
        if (metricMode === 'target') {
          if (tgt === null) return;
          delta = Math.abs(tgtN - curN);
        } else { // 'actual'
          if (actN === null) return;
          delta = Math.abs(actN - curN);
        }
        if (delta <= 0) return;

        result.push({
          division: card.division === '전체' ? (extractedDiv || '미분류') : card.division,
          kpiName: card.name || '(KPI 미지정)',
          kpiId: card.id,
          category: p.대분류 || '미분류',
          subcategory: p.소분류 || '미분류',
          perfName: perfNameOnly || p.성과항목 || '',
          perfKey: key,
          unit: resolvedUnit,
          sourceUnit,
          current: curN,
          target: tgtN,
          actual: actN,
          delta,
          metricMode,
          performance: p,
          linkedProjectNames: getLinkedProjectNames(p),
        });
      });
    });
    return result;
  }, [kpiCards, yearPerformances, applyConversion, selectedDivision, activeKpiIdSet, getLinkedProjectNames, metricMode]);

  // 단위별 그룹
  const unitGroups = useMemo(() => {
    const map = new Map();
    leaves.forEach(l => {
      const u = l.unit || '(단위없음)';
      if (!map.has(u)) map.set(u, []);
      map.get(u).push(l);
    });
    const arr = Array.from(map.entries())
      .map(([unit, items]) => ({
        unit,
        items,
        totalDelta: items.reduce((s, x) => s + (x.delta || 0), 0),
        divisionCount: new Set(items.map(x => x.division)).size,
        kpiCount: new Set(items.map(x => x.kpiId)).size,
      }))
      .sort((a, b) => b.totalDelta - a.totalDelta);
    return arr;
  }, [leaves]);

  // 동명 KPI 감지: 같은 이름이 2개 이상이면 사업부 라벨을 함께 표시
  const duplicateKpiNames = useMemo(() => {
    const counts = new Map();
    availableKpis.forEach(k => {
      counts.set(k.name, (counts.get(k.name) || 0) + 1);
    });
    const dup = new Set();
    counts.forEach((c, name) => { if (c > 1) dup.add(name); });
    return dup;
  }, [availableKpis]);

  const kpiFilterBar = availableKpis.length > 0 ? (
    <FilterBar>
      <FilterLabel>지표</FilterLabel>
      <MetricGroup role="tablist" aria-label="지표 전환">
        <MetricBtn
          role="tab"
          aria-selected={metricMode === 'target'}
          $active={metricMode === 'target'}
          onClick={() => setMetricMode('target')}
        >
          △ 목표 - 현재
        </MetricBtn>
        <MetricBtn
          role="tab"
          aria-selected={metricMode === 'actual'}
          $active={metricMode === 'actual'}
          onClick={() => setMetricMode('actual')}
        >
          △ 실적 - 현재
        </MetricBtn>
      </MetricGroup>
      <FilterDivider />
      <FilterLabel>KPI 명칭</FilterLabel>
      <FilterAllBtn onClick={toggleAll}>
        {isAllSelected ? '전체 해제' : '전체 선택'}
      </FilterAllBtn>
      {availableKpis.map(k => {
        const active = activeKpiIdSet.has(k.id);
        const showDivision = duplicateKpiNames.has(k.name) && k.division;
        const divColor = getDivisionColor(k.division);
        const titleText = showDivision ? `${k.name} · ${k.division}` : k.name;
        return (
          <FilterChip
            key={k.id}
            $active={active}
            onClick={() => toggleKpiId(k.id)}
            title={titleText}
          >
            {showDivision && <ChipDivisionDot $color={divColor} />}
            <span>{k.name}</span>
            {showDivision && (
              <ChipDivisionLabel $active={active}>{k.division}</ChipDivisionLabel>
            )}
          </FilterChip>
        );
      })}
      <FilterMuted>
        {isAllSelected
          ? `(전체 ${availableKpis.length}개)`
          : `(${activeKpiIdSet.size}/${availableKpis.length} 선택)`
        }
      </FilterMuted>
    </FilterBar>
  ) : null;

  if (leaves.length === 0) {
    const metricWord = metricMode === 'actual' ? '실적' : '목표';
    return (
      <Container>
        {kpiFilterBar}
        <UnitBlock initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <EmptyState>
            <div className="icon">📊</div>
            <div className="msg">트리맵으로 표시할 데이터가 없습니다</div>
            <div className="sub">
              계산 로직이 "합계"인 KPI 카드를 추가하거나, 선택된 성과 항목에 현재/{metricWord} 값을 등록하세요.
            </div>
          </EmptyState>
        </UnitBlock>
      </Container>
    );
  }

  return (
    <Container>
      {kpiFilterBar}
      {unitGroups.map(ug => (
        <UnitTreemapBlock
          key={ug.unit}
          unit={ug.unit}
          items={ug.items}
          totalDelta={ug.totalDelta}
          divisionCount={ug.divisionCount}
          kpiCount={ug.kpiCount}
          getDivisionColor={getDivisionColor}
          onLeafClick={handleLeafClick}
        />
      ))}

      <AnimatePresence>
        {detailModal && (
          <LeafDetailModal
            detail={detailModal}
            currentYear={currentYear}
            applyConversion={applyConversion}
            getDivisionColor={getDivisionColor}
            onClose={() => setDetailModal(null)}
          />
        )}
      </AnimatePresence>
    </Container>
  );
};

// ===== 단위별 트리맵 블록 =====

const UnitTreemapBlock = ({
  unit, items, totalDelta, divisionCount, kpiCount,
  getDivisionColor, onLeafClick,
}) => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const tooltipRef = useRef(null);
  const onLeafClickRef = useRef(onLeafClick);
  useEffect(() => { onLeafClickRef.current = onLeafClick; }, [onLeafClick]);
  const unitRef = useRef(unit);
  useEffect(() => { unitRef.current = unit; }, [unit]);
  const getDivisionColorRef = useRef(getDivisionColor);
  useEffect(() => { getDivisionColorRef.current = getDivisionColor; }, [getDivisionColor]);

  // ====== 드릴다운 상태 (4단계 계층: 사업부 → KPI → 소분류 → 성과) ======
  const [drillState, setDrillState] = useState({
    division: null,
    kpiId: null,
    kpiName: null,
    subcategory: null,
  });

  // items 바뀌면(필터 변경 등) 드릴 리셋 — 의도치 않게 빈 화면 방지
  const itemsSignature = useMemo(
    () => items.map(x => x.perfKey).sort().join('|'),
    [items]
  );
  useEffect(() => { setDrillState({ division: null, kpiId: null, kpiName: null, subcategory: null }); }, [itemsSignature]);

  const drillDepth =
    (drillState.division ? 1 : 0) +
    (drillState.kpiId ? 1 : 0) +
    (drillState.subcategory ? 1 : 0);

  const drillToDivision = useCallback((div) => {
    setDrillState({ division: div, kpiId: null, kpiName: null, subcategory: null });
  }, []);
  const drillToKpi = useCallback((kpiId, kpiName, divForContext) => {
    setDrillState(prev => ({
      division: prev.division || divForContext || null,
      kpiId, kpiName,
      subcategory: null,
    }));
  }, []);
  const drillToSub = useCallback((sub) => {
    setDrillState(prev => ({ ...prev, subcategory: sub }));
  }, []);
  const resetDrill = useCallback(() => {
    setDrillState({ division: null, kpiId: null, kpiName: null, subcategory: null });
  }, []);
  const drillUpTo = useCallback((level) => {
    // level: 'all' | 'division' | 'kpi' | 'subcategory'
    setDrillState(prev => {
      if (level === 'all') return { division: null, kpiId: null, kpiName: null, subcategory: null };
      if (level === 'division') return { division: prev.division, kpiId: null, kpiName: null, subcategory: null };
      if (level === 'kpi') return { division: prev.division, kpiId: prev.kpiId, kpiName: prev.kpiName, subcategory: null };
      return prev;
    });
  }, []);

  // stable refs for d3 handlers
  const drillHandlersRef = useRef({ drillToDivision, drillToKpi, drillToSub });
  useEffect(() => {
    drillHandlersRef.current = { drillToDivision, drillToKpi, drillToSub };
  }, [drillToDivision, drillToKpi, drillToSub]);

  // ====== 드릴 필터 적용된 items ======
  const drilledItems = useMemo(() => {
    return items.filter(l => {
      if (drillState.division && l.division !== drillState.division) return false;
      if (drillState.kpiId && l.kpiId !== drillState.kpiId) return false;
      if (drillState.subcategory && l.subcategory !== drillState.subcategory) return false;
      return true;
    });
  }, [items, drillState]);

  const drilledStats = useMemo(() => ({
    itemCount: drilledItems.length,
    kpiCount: new Set(drilledItems.map(l => l.kpiId)).size,
    divisionCount: new Set(drilledItems.map(l => l.division)).size,
    totalDelta: drilledItems.reduce((s, x) => s + (x.delta || 0), 0),
  }), [drilledItems]);

  // 4단계 계층 데이터: 사업부 → KPI → 소분류 → 성과
  const hierarchyData = useMemo(() => {
    const root = { name: 'root', children: [] };
    const divMap = new Map();
    drilledItems.forEach(leaf => {
      let divNode = divMap.get(leaf.division);
      if (!divNode) {
        divNode = { name: leaf.division, type: 'division', children: [], _kpiMap: new Map() };
        divMap.set(leaf.division, divNode);
        root.children.push(divNode);
      }
      let kpiNode = divNode._kpiMap.get(leaf.kpiId);
      if (!kpiNode) {
        kpiNode = { name: leaf.kpiName, type: 'kpi', children: [], _subMap: new Map() };
        divNode._kpiMap.set(leaf.kpiId, kpiNode);
        divNode.children.push(kpiNode);
      }
      let subNode = kpiNode._subMap.get(leaf.subcategory);
      if (!subNode) {
        subNode = { name: leaf.subcategory, type: 'subcategory', children: [] };
        kpiNode._subMap.set(leaf.subcategory, subNode);
        kpiNode.children.push(subNode);
      }
      subNode.children.push({
        name: leaf.perfName,
        type: 'leaf',
        value: leaf.delta,
        leaf,
      });
    });
    return root;
  }, [drilledItems]);

  // 범례용 사업부별 집계 (사업부 고정 순서, 드릴 필터 반영)
  const divisionLegend = useMemo(() => {
    const map = new Map();
    drilledItems.forEach(l => {
      const cur = map.get(l.division) || { count: 0, delta: 0 };
      cur.count += 1; cur.delta += l.delta;
      map.set(l.division, cur);
    });
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v, color: getDivisionColor(name) }))
      .sort((a, b) => compareDivision(a.name, b.name));
  }, [drilledItems, getDivisionColor]);

  const wrapText = useCallback((text, maxChars) => {
    if (!text) return [];
    const lines = [];
    let current = '';
    for (const word of String(text).split(' ')) {
      const test = current ? `${current} ${word}` : word;
      if (test.length <= maxChars) { current = test; }
      else {
        if (current) { lines.push(current); current = word; }
        else {
          lines.push(word.substring(0, maxChars));
          current = word.substring(maxChars);
        }
      }
    }
    if (current) lines.push(current);
    return lines;
  }, []);

  const renderTreemap = useCallback(() => {
    if (!svgRef.current || !containerRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const rect = containerRef.current.getBoundingClientRect();
    const width = Math.max(rect.width, 320);
    const height = Math.max(rect.height, 300);

    svg.attr('width', width).attr('height', height)
      .style('width', width + 'px').style('height', height + 'px');

    const hierarchy = d3.hierarchy(hierarchyData)
      .sum(d => d.value || 0)
      .sort((a, b) => {
        // depth 1 (사업부) — 고정 순서
        if (a.depth === 1 && b.depth === 1) {
          return compareDivision(a.data.name, b.data.name);
        }
        // 그 외는 값 내림차순
        return b.value - a.value;
      });

    const layout = d3.treemap()
      .size([width, height])
      .paddingOuter(d => (d.depth === 0 ? 4 : 0))
      .paddingTop(d => {
        if (d.depth === 0) return 4;
        // 드릴된 레벨 이하는 라벨/프레임 숨김 → paddingTop 0
        if (d.depth <= drillDepth) return 0;
        if (d.depth === 1) return 28;
        if (d.depth === 2) return 26;
        if (d.depth === 3) return 20;
        return 0;
      })
      .paddingInner(3)
      .round(true)
      .tile(d3.treemapSquarify);

    const root = layout(hierarchy);

    // 1) Division 프레임 (depth 1) — drillDepth < 1일 때만 렌더
    const divisionNodes = drillDepth < 1 ? root.descendants().filter(d => d.depth === 1) : [];
    const divFrames = svg.append('g').selectAll('.div-frame')
      .data(divisionNodes)
      .enter()
      .append('rect')
      .attr('class', 'div-frame')
      .attr('x', d => d.x0)
      .attr('y', d => d.y0)
      .attr('width', d => Math.max(0, d.x1 - d.x0))
      .attr('height', d => Math.max(0, d.y1 - d.y0))
      .attr('fill', d => adjustBrightness(getDivisionColorRef.current(d.data.name), 0.85))
      .attr('stroke', d => getDivisionColorRef.current(d.data.name))
      .attr('stroke-width', 2)
      .attr('rx', 5)
      .style('cursor', 'pointer');

    divFrames
      .on('mouseover', function () { d3.select(this).attr('fill-opacity', 0.7); })
      .on('mouseout', function () { d3.select(this).attr('fill-opacity', 1); })
      .on('click', function (event, d) {
        event.stopPropagation();
        drillHandlersRef.current.drillToDivision(d.data.name);
      });

    svg.append('g').selectAll('.div-label')
      .data(divisionNodes)
      .enter()
      .append('text')
      .attr('x', d => d.x0 + 10)
      .attr('y', d => d.y0 + 18)
      .attr('font-size', d => {
        const w = d.x1 - d.x0;
        if (w > 140) return '15px';
        if (w > 90) return '13px';
        if (w > 55) return '12px';
        return '0px';
      })
      .attr('font-weight', 800)
      .attr('fill', d => adjustBrightness(getDivisionColorRef.current(d.data.name), -0.5))
      .attr('pointer-events', 'none')
      .text(d => d.data.name);

    // 2) KPI 프레임 (depth 2) — drillDepth < 2일 때만 렌더
    const kpiNodes = drillDepth < 2 ? root.descendants().filter(d => d.depth === 2) : [];
    const kpiFrames = svg.append('g').selectAll('.kpi-frame')
      .data(kpiNodes)
      .enter()
      .append('rect')
      .attr('class', 'kpi-frame')
      .attr('x', d => d.x0)
      .attr('y', d => d.y0)
      .attr('width', d => Math.max(0, d.x1 - d.x0))
      .attr('height', d => Math.max(0, d.y1 - d.y0))
      .attr('fill', 'rgba(255,255,255,0.45)')
      .attr('stroke', d => adjustBrightness(getDivisionColorRef.current(d.parent.data.name), -0.1))
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3 3')
      .attr('rx', 3)
      .style('cursor', 'pointer');

    kpiFrames
      .on('mouseover', function () { d3.select(this).attr('fill', 'rgba(99,102,241,0.12)'); })
      .on('mouseout', function () { d3.select(this).attr('fill', 'rgba(255,255,255,0.45)'); })
      .on('click', function (event, d) {
        event.stopPropagation();
        // leaf에서 kpiId 꺼내기
        const leaf = d.leaves()[0]?.data?.leaf;
        if (leaf) {
          drillHandlersRef.current.drillToKpi(leaf.kpiId, leaf.kpiName, leaf.division);
        }
      });

    svg.append('g').selectAll('.kpi-label')
      .data(kpiNodes)
      .enter()
      .append('text')
      .attr('x', d => d.x0 + 10)
      .attr('y', d => d.y0 + 17)
      .attr('font-size', d => {
        const w = d.x1 - d.x0;
        const h = d.y1 - d.y0;
        if (w > 120 && h > 50) return '13px';
        if (w > 80 && h > 35) return '12px';
        if (w > 50 && h > 25) return '11px';
        return '0px';
      })
      .attr('font-weight', 700)
      .attr('fill', d => adjustBrightness(getDivisionColorRef.current(d.parent.data.name), -0.55))
      .attr('pointer-events', 'none')
      .text(d => {
        const w = d.x1 - d.x0;
        const maxChars = Math.max(3, Math.floor((w - 20) / 8));
        const n = d.data.name || '';
        return n.length > maxChars ? n.substring(0, maxChars - 1) + '…' : n;
      });

    // 3) Subcategory 프레임 (depth 3) — drillDepth < 3일 때만 렌더
    const subNodes = drillDepth < 3 ? root.descendants().filter(d => d.depth === 3) : [];
    const subFrames = svg.append('g').selectAll('.sub-frame')
      .data(subNodes)
      .enter()
      .append('rect')
      .attr('x', d => d.x0)
      .attr('y', d => d.y0)
      .attr('width', d => Math.max(0, d.x1 - d.x0))
      .attr('height', d => Math.max(0, d.y1 - d.y0))
      .attr('fill', 'transparent')
      .attr('stroke', d => adjustBrightness(getDivisionColorRef.current(d.parent.parent.data.name), -0.2))
      .attr('stroke-width', 0.8)
      .attr('rx', 2)
      .style('cursor', 'pointer');

    subFrames
      .on('mouseover', function () { d3.select(this).attr('fill', 'rgba(99,102,241,0.08)'); })
      .on('mouseout', function () { d3.select(this).attr('fill', 'transparent'); })
      .on('click', function (event, d) {
        event.stopPropagation();
        drillHandlersRef.current.drillToSub(d.data.name);
      });

    svg.append('g').selectAll('.sub-label')
      .data(subNodes)
      .enter()
      .append('text')
      .attr('x', d => d.x0 + 8)
      .attr('y', d => d.y0 + 13)
      .attr('font-size', d => {
        const w = d.x1 - d.x0;
        const h = d.y1 - d.y0;
        if (w > 110 && h > 35) return '11px';
        if (w > 70 && h > 25) return '10px';
        if (w > 45 && h > 20) return '9px';
        return '0px';
      })
      .attr('font-style', 'italic')
      .attr('font-weight', 600)
      .attr('fill', '#475569')
      .attr('pointer-events', 'none')
      .text(d => {
        const w = d.x1 - d.x0;
        const maxChars = Math.max(2, Math.floor((w - 16) / 7));
        const n = d.data.name || '';
        return n.length > maxChars ? n.substring(0, maxChars - 1) + '…' : n;
      });

    // 4) Leaf (성과명) — 각 리프마다 clip-path 생성해서 텍스트 오버플로 방지
    const leafNodes = root.leaves();
    const defs = svg.append('defs');
    const clipIdPrefix = `leafclip-${Math.random().toString(36).slice(2, 9)}`;
    defs.selectAll('clipPath')
      .data(leafNodes)
      .enter()
      .append('clipPath')
      .attr('id', (d, i) => `${clipIdPrefix}-${i}`)
      .append('rect')
      .attr('x', d => d.x0)
      .attr('y', d => d.y0)
      .attr('width', d => Math.max(0, d.x1 - d.x0))
      .attr('height', d => Math.max(0, d.y1 - d.y0));

    const leafGroups = svg.append('g').selectAll('.leaf')
      .data(leafNodes)
      .enter()
      .append('g')
      .attr('class', 'leaf')
      .attr('clip-path', (d, i) => `url(#${clipIdPrefix}-${i})`)
      .style('cursor', 'pointer');

    leafGroups.append('rect')
      .attr('x', d => d.x0)
      .attr('y', d => d.y0)
      .attr('width', d => Math.max(0, d.x1 - d.x0))
      .attr('height', d => Math.max(0, d.y1 - d.y0))
      .attr('fill', d => {
        const divName = d.ancestors().find(a => a.depth === 1)?.data?.name;
        return getDivisionColorRef.current(divName);
      })
      .attr('stroke', d => {
        const divName = d.ancestors().find(a => a.depth === 1)?.data?.name;
        return adjustBrightness(getDivisionColorRef.current(divName), -0.3);
      })
      .attr('stroke-width', 1.2)
      .attr('rx', 3);

    // 호버/클릭 - tooltipRef DOM 직접 조작 (React re-render 방지)
    const updateTooltipDom = (x, y, content) => {
      const el = tooltipRef.current;
      if (!el) return;
      if (content === null) {
        el.style.display = 'none';
      } else {
        el.style.display = 'block';
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        el.textContent = content;
      }
    };
    leafGroups
      .on('mouseover', function (event, d) {
        d3.select(this).select('rect').attr('opacity', 0.82);
        const leaf = d.data.leaf;
        if (!leaf) return;
        const totalVisible = root.value || 0;
        const pct = totalVisible > 0 ? (leaf.delta / totalVisible) * 100 : 0;
        const projNames = leaf.linkedProjectNames || [];
        const projLines = projNames.length > 0
          ? ['', `과제명 (${projNames.length}):`, ...projNames.slice(0, 5).map(n => `  • ${n}`),
             ...(projNames.length > 5 ? [`  … 외 ${projNames.length - 5}건`] : [])]
          : ['', '과제명: -'];
        const isActualMode = leaf.metricMode === 'actual';
        const deltaLabelText = isActualMode ? '△ 실적-현재' : '△ 목표-현재';
        const valueRows = [
          `현재: ${formatNum(leaf.current)}${leaf.unit ? ' ' + leaf.unit : ''}`,
          `목표: ${formatNum(leaf.target)}${leaf.unit ? ' ' + leaf.unit : ''}`,
        ];
        if (leaf.actual !== null && leaf.actual !== undefined) {
          valueRows.push(`실적: ${formatNum(leaf.actual)}${leaf.unit ? ' ' + leaf.unit : ''}`);
        }
        const content = [
          `[${leaf.division}] ${leaf.kpiName}`,
          `${leaf.category} › ${leaf.subcategory}`,
          `성과: ${leaf.perfName}`,
          '',
          ...valueRows,
          `${deltaLabelText}: ${formatNum(leaf.delta)}${leaf.unit ? ' ' + leaf.unit : ''}`,
          `화면 내 비중: ${formatPct(pct)} (전체 ${formatNum(totalVisible)}${leaf.unit ? ' ' + leaf.unit : ''} 기준)`,
          ...projLines,
          '',
          '클릭시 상세 정보를 볼 수 있습니다.',
        ].join('\n');
        updateTooltipDom(event.clientX + 14, event.clientY + 14, content);
      })
      .on('mousemove', function (event) {
        const el = tooltipRef.current;
        if (!el || el.style.display === 'none') return;
        el.style.left = (event.clientX + 14) + 'px';
        el.style.top = (event.clientY + 14) + 'px';
      })
      .on('mouseout', function () {
        d3.select(this).select('rect').attr('opacity', 1);
        updateTooltipDom(0, 0, null);
      })
      .on('click', function (event, d) {
        if (d.data.leaf && onLeafClickRef.current) {
          const totalVisible = root.value || 0;
          const pct = totalVisible > 0 ? (d.data.leaf.delta / totalVisible) * 100 : 0;
          onLeafClickRef.current(d.data.leaf, unitRef.current, pct, totalVisible);
        }
      });

    leafGroups.each(function (d) {
      const w = d.x1 - d.x0;
      const h = d.y1 - d.y0;
      if (w < 34 || h < 22) return;

      const g = d3.select(this);
      const cx = d.x0 + w / 2;
      const cy = d.y0 + h / 2;

      // 가로/세로 여백 (패딩) 확보 후 가용 영역 계산
      const padX = 6;
      const padY = 6;
      const availW = Math.max(0, w - padX * 2);
      const availH = Math.max(0, h - padY * 2);

      let fontSize, charW, lineH;
      if (w > 150 && h > 80) { fontSize = 12; charW = 7.2; lineH = 15; }
      else if (w > 100 && h > 55) { fontSize = 11; charW = 6.6; lineH = 13.5; }
      else if (w > 70 && h > 40) { fontSize = 10; charW = 6.0; lineH = 12; }
      else if (w > 50 && h > 30) { fontSize = 9; charW = 5.4; lineH = 11; }
      else { fontSize = 8; charW = 4.8; lineH = 10; }
      const maxChars = Math.max(3, Math.floor(availW / charW));

      const nameLines = wrapText(d.data.name, maxChars);
      const leaf = d.data.leaf;
      const totalVisible = root.value || 0;
      const pct = totalVisible > 0 ? (leaf.delta / totalVisible) * 100 : 0;
      const deltaLabel = `△ ${formatNum(leaf.delta)}${leaf.unit ? ' ' + leaf.unit : ''} · ${formatPct(pct)}`;
      const allLines = [...nameLines, deltaLabel];
      // 세로 가용 영역 기준으로 표시 가능한 최대 줄 수 (clip-path가 백업해주지만 사전에 절단)
      const maxLines = Math.max(1, Math.floor(availH / lineH));
      const lines = allLines.slice(0, maxLines);

      // 줄이 잘렸다면 마지막 줄을 delta로 강제 치환, 이름 끝에 … 표시
      if (lines.length < allLines.length) {
        const lastNameIdx = Math.min(maxLines - 2, nameLines.length - 1);
        if (lastNameIdx >= 0) {
          const orig = lines[lastNameIdx];
          if (orig && orig.length > 2) lines[lastNameIdx] = orig.substring(0, orig.length - 1) + '…';
        }
        if (maxLines >= 2) lines[lines.length - 1] = deltaLabel;
      }

      const totalH = lines.length * lineH;
      // 중앙 정렬하되, 윗면/아랫면 경계를 절대 벗어나지 않도록 clamp
      let startY = cy - (totalH - lineH) / 2;
      const topBound = d.y0 + padY + lineH / 2;
      const bottomBound = d.y1 - padY - lineH / 2;
      if (startY < topBound) startY = topBound;
      if (startY + (lines.length - 1) * lineH > bottomBound) {
        startY = Math.max(topBound, bottomBound - (lines.length - 1) * lineH);
      }

      lines.forEach((line, i) => {
        const isDelta = line === deltaLabel;
        g.append('text')
          .attr('x', cx)
          .attr('y', startY + i * lineH)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('font-size', isDelta ? (fontSize - 0.5) + 'px' : fontSize + 'px')
          .attr('font-weight', isDelta ? 700 : 600)
          .attr('fill', 'white')
          .attr('opacity', isDelta ? 1 : 0.95)
          .attr('pointer-events', 'none')
          .text(line);
      });
    });
  }, [hierarchyData, wrapText, drillDepth]);

  useEffect(() => {
    renderTreemap();
    const handleResize = () => renderTreemap();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [renderTreemap]);

  return (
    <UnitBlock initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <UnitHeader>
        <UnitTitleWrap>
          <UnitBadge>{unit}</UnitBadge>
          <UnitTitle>단위별 △ {items[0]?.metricMode === 'actual' ? '실적-현재' : '목표-현재'}</UnitTitle>
        </UnitTitleWrap>
        <UnitStats>
          <span>성과 <b>{drilledStats.itemCount}</b>건</span>
          <span>·</span>
          <span>KPI <b>{drilledStats.kpiCount}</b>개</span>
          <span>·</span>
          <span>사업부 <b>{drilledStats.divisionCount}</b>개</span>
          <span>·</span>
          <span>합계 <b>△ {formatNum(drilledStats.totalDelta)} {unit}</b></span>
        </UnitStats>
      </UnitHeader>
      {drillDepth > 0 && (
        <BreadcrumbBar>
          <BreadcrumbLabel>탐색 경로</BreadcrumbLabel>
          <BreadcrumbItem onClick={() => drillUpTo('all')} $active={drillDepth === 0}>전체</BreadcrumbItem>
          {drillState.division && (
            <>
              <BreadcrumbSep>›</BreadcrumbSep>
              <BreadcrumbItem
                onClick={() => drillUpTo('division')}
                $active={drillDepth === 1}
                title={`사업부: ${drillState.division}`}
              >
                {drillState.division}
              </BreadcrumbItem>
            </>
          )}
          {drillState.kpiId && (
            <>
              <BreadcrumbSep>›</BreadcrumbSep>
              <BreadcrumbItem
                onClick={() => drillUpTo('kpi')}
                $active={drillDepth === 2}
                title={`KPI: ${drillState.kpiName}`}
              >
                {drillState.kpiName}
              </BreadcrumbItem>
            </>
          )}
          {drillState.subcategory && (
            <>
              <BreadcrumbSep>›</BreadcrumbSep>
              <BreadcrumbItem $active title={`소분류: ${drillState.subcategory}`}>
                {drillState.subcategory}
              </BreadcrumbItem>
            </>
          )}
          <BreadcrumbReset onClick={resetDrill}>전체 보기</BreadcrumbReset>
        </BreadcrumbBar>
      )}
      <TreemapArea>
        <TreemapCanvas ref={containerRef}>
          <svg ref={svgRef} />
        </TreemapCanvas>
        <LegendPanel>
          <LegendTitle>사업부 · {divisionLegend.length}개</LegendTitle>
          {divisionLegend.map(d => (
            <LegendItem key={d.name}>
              <LegendDot $color={d.color} />
              <span>{d.name}</span>
              <LegendCount>△ {formatNum(d.delta)} · {d.count}건</LegendCount>
            </LegendItem>
          ))}
        </LegendPanel>
      </TreemapArea>
      {typeof document !== 'undefined' && createPortal(
        <Tooltip ref={tooltipRef} style={{ display: 'none' }} />,
        document.body
      )}
    </UnitBlock>
  );
};

// ===== 리프 상세 모달 =====

const LeafDetailModal = ({ detail, onClose, currentYear, applyConversion, getDivisionColor }) => {
  const { leaf, pct, totalVisible } = detail;
  const perf = leaf.performance;
  const { division: extractedDiv } = extractDivisionFromPerformance(perf.성과항목 || '');
  const convDivision = leaf.division === '전체' ? extractedDiv : leaf.division;
  const hasMonthly = perf.월별실적여부 && Array.isArray(perf.월별실적) && perf.월별실적.length > 0;

  const monthlyRows = useMemo(() => {
    if (!hasMonthly) return [];
    return perf.월별실적.map((val, idx) => {
      const num = parseFloat(val);
      if (isNaN(num)) return { month: idx + 1, value: null, unit: leaf.unit };
      const cv = applyConversion ? applyConversion(num, perf.단위, convDivision) : { value: num, unit: perf.단위 };
      return { month: idx + 1, value: cv.value, unit: cv.unit || perf.단위 || '' };
    });
  }, [hasMonthly, perf, applyConversion, convDivision, leaf.unit]);

  const projectNames = leaf.linkedProjectNames || [];

  // 단위를 별도 열로 두지 않고 값 뒤에 붙여 쓴다. 값이 없으면 단위도 붙이지 않는다.
  const withUnit = (value, unit = leaf.unit) => {
    const text = formatNum(value);
    if (text === null || text === undefined || text === '' || text === '-') return <MutedText>-</MutedText>;
    return <>{text}{unit ? <UnitSuffix>{unit}</UnitSuffix> : null}</>;
  };

  const handleExportCsv = () => {
    const BOM = '﻿';
    const header = ['구분', '항목', '값', '단위'];
    const deltaLabelCsv = `△ ${METRIC_SHORT[leaf.metricMode] || '목표-현재'}`;
    const rows = [
      ['사업부', leaf.division, '', ''],
      ['KPI 명칭', leaf.kpiName, '', ''],
      ['성과 대분류', leaf.category, '', ''],
      ['성과 소분류', leaf.subcategory, '', ''],
      ['성과명', leaf.perfName, '', ''],
      ['과제명', projectNames.join(' | ') || '-', '', ''],
      ['현재', '', leaf.current, leaf.unit || ''],
      ['목표', '', leaf.target, leaf.unit || ''],
      ['실적', '', leaf.actual ?? '-', leaf.unit || ''],
      [deltaLabelCsv, '', leaf.delta, leaf.unit || ''],
      ['화면 내 비중', '', pct !== undefined ? `${pct.toFixed(1)}%` : '-', ''],
    ];
    if (hasMonthly) {
      monthlyRows.forEach(r => rows.push([`${r.month}월`, '월별실적', r.value ?? '', r.unit || '']));
    }
    const esc = (v) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = BOM + [header, ...rows].map(r => r.map(esc).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `KPI_트리맵_${leaf.kpiName}_${leaf.perfName}_${currentYear || ''}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <ModalOverlay
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClose}
    >
      <ModalBox
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.15 }}
        onClick={(e) => e.stopPropagation()}
      >
        <ModalHeader>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, minWidth: 0 }}>
            <ModalBadge $color={getDivisionColor(leaf.division)}>{leaf.division}</ModalBadge>
            <ModalTitle title={leaf.kpiName} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {leaf.kpiName}
            </ModalTitle>
          </div>
          <ModalActions>
            <ModalBtn $primary onClick={handleExportCsv}>
              <Download size={13} /> CSV 저장
            </ModalBtn>
            <ModalIconBtn onClick={onClose}><X size={16} /></ModalIconBtn>
          </ModalActions>
        </ModalHeader>
        <ModalBody>
          <DataTable>
            <thead>
              <tr>
                <Th style={{ width: 140 }}>항목</Th>
                <Th>내용</Th>
              </tr>
            </thead>
            <tbody>
              {/* 1. 과제명 */}
              <Tr>
                <Td style={{ verticalAlign: 'top' }}>
                  <b>과제명</b>
                  <span style={{ marginLeft: '0.35rem', fontSize: '0.72rem', color: '#6366f1', background: '#eef2ff', padding: '0.1rem 0.4rem', borderRadius: '0.3rem', fontWeight: 600 }}>
                    {projectNames.length}건
                  </span>
                </Td>
                <Td>
                  {projectNames.length === 0 ? (
                    <MutedText>연결된 과제가 없습니다.</MutedText>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                      {projectNames.map((name, idx) => (
                        <span
                          key={idx}
                          title={name}
                          style={{
                            fontSize: '0.78rem',
                            padding: '0.25rem 0.6rem',
                            background: '#f1f5f9',
                            color: '#1e293b',
                            border: '1px solid #e2e8f0',
                            borderRadius: '0.35rem',
                            maxWidth: '420px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  )}
                </Td>
              </Tr>
              {/* 2. 성과명 */}
              <Tr>
                <Td><b>성과명</b></Td>
                <Td style={{ fontWeight: 600 }}>{leaf.perfName || <MutedText>-</MutedText>}</Td>
              </Tr>
              {/* 3. 성과 대분류 */}
              <Tr>
                <Td>성과 대분류</Td>
                <Td>{leaf.category || <MutedText>-</MutedText>}</Td>
              </Tr>
              {/* 4. 성과 소분류 */}
              <Tr>
                <Td>성과 소분류</Td>
                <Td>{leaf.subcategory || <MutedText>-</MutedText>}</Td>
              </Tr>
              {/* 5. 현재 */}
              <Tr>
                <Td>현재</Td>
                <Td><ValueText>{withUnit(leaf.current)}</ValueText></Td>
              </Tr>
              {/* 6. 목표 */}
              <Tr>
                <Td>목표</Td>
                <Td><ValueText>{withUnit(leaf.target)}</ValueText></Td>
              </Tr>
              {/* 7. 실적 */}
              {leaf.actual !== null && leaf.actual !== undefined && (
                <Tr>
                  <Td>실적</Td>
                  <Td><ValueText>{withUnit(leaf.actual)}</ValueText></Td>
                </Tr>
              )}
              {/* 8. 선택된 delta */}
              <Tr>
                <Td><b>△ {METRIC_LABEL[leaf.metricMode] || '목표 - 현재'}</b></Td>
                <Td><DeltaChip>△ {withUnit(leaf.delta)}</DeltaChip></Td>
              </Tr>
              {/* 8. 화면 내 비중 */}
              {pct !== undefined && (
                <Tr>
                  <Td>화면 내 비중</Td>
                  <Td>
                    <span style={{ fontWeight: 700, color: '#4f46e5' }}>{formatPct(pct)}</span>
                    {typeof totalVisible === 'number' && totalVisible > 0 && (
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                        (전체 △ {formatNum(totalVisible)}{leaf.unit ? ' ' + leaf.unit : ''} 기준)
                      </span>
                    )}
                  </Td>
                </Tr>
              )}
              {leaf.sourceUnit && leaf.sourceUnit !== leaf.unit && (
                <Tr>
                  <Td style={{ color: '#94a3b8', fontSize: '0.75rem' }}>원본 단위</Td>
                  <Td style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{leaf.sourceUnit} → {leaf.unit} (환산됨)</Td>
                </Tr>
              )}
            </tbody>
          </DataTable>

          {hasMonthly && (
            <div style={{ padding: '1rem 1.25rem 0 1.25rem', fontSize: '0.82rem', color: '#1e293b', fontWeight: 700 }}>
              월별 실적 ({currentYear || '해당'}년)
            </div>
          )}
          {hasMonthly && (
            <DataTable style={{ marginTop: '0.5rem' }}>
              <thead>
                <tr>
                  <Th style={{ width: 140 }}>월</Th>
                  <Th>값</Th>
                </tr>
              </thead>
              <tbody>
                {monthlyRows.map(r => (
                  <Tr key={r.month}>
                    <Td>{r.month}월</Td>
                    <Td>{r.value === null ? <MutedText>-</MutedText> : <ValueText>{withUnit(r.value, r.unit)}</ValueText>}</Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </ModalBody>
      </ModalBox>
    </ModalOverlay>
  );
};

export default KPITreemap;
