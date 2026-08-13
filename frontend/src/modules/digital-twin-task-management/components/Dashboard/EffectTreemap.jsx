import React, { useMemo, useRef, useEffect, useCallback, useState } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download } from 'lucide-react';
import * as d3 from 'd3';

const Container = styled.div`
  display: flex;
  gap: 20px;
  height: calc(100% - 10px);
  min-height: 0;
`;

const TreemapArea = styled.div`
  flex: 3;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const FilterBar = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  flex-shrink: 0;
`;

const FilterLabel = styled.span`
  font-size: 0.75rem;
  font-weight: 700;
  color: #64748b;
  margin-right: 2px;
  white-space: nowrap;
`;

const FilterChip = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: 14px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  border: 1.5px solid ${p => p.$active ? (p.$color || '#6366f1') : '#d1d5db'};
  background: ${p => p.$active ? (p.$color || '#6366f1') : '#ffffff'};
  color: ${p => p.$active ? '#ffffff' : '#4b5563'};
  &:hover {
    border-color: ${p => p.$color || '#6366f1'};
    ${p => !p.$active && `background: ${(p.$color || '#6366f1')}15;`}
  }
`;

const FilterAllBtn = styled.button`
  padding: 4px 10px;
  border-radius: 14px;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid #d1d5db;
  background: #f8fafc;
  color: #64748b;
  &:hover { background: #e2e8f0; }
`;

const TreemapContainer = styled.div`
  flex: 1;
  min-height: 280px;
  max-height: 520px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
  position: relative;
  background: #f8fafc;
  svg {
    width: 100%;
    height: 100%;
    display: block;
    position: absolute;
    top: 0; left: 0;
  }
`;

const LegendPanel = styled.div`
  flex: 1;
  min-width: 200px;
  max-width: 280px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const LegendTitle = styled.div`
  font-size: 0.82rem;
  font-weight: 700;
  color: #1e293b;
  padding-bottom: 8px;
  border-bottom: 2px solid #e2e8f0;
`;

const LegendCatGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const LegendCatLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 0.78rem;
  font-weight: 700;
  color: #1e293b;
`;

const LegendDot = styled.div`
  width: 10px;
  height: 10px;
  border-radius: 3px;
  background: ${p => p.$color};
  flex-shrink: 0;
`;

const LegendSubItem = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
  padding-left: 17px;
  font-size: 0.72rem;
  color: #475569;
  line-height: 1.7;
`;

const LegendSubDot = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: ${p => p.$color};
  flex-shrink: 0;
`;

const Tooltip = styled.div`
  position: fixed;
  background: rgba(30, 41, 59, 0.95);
  color: white;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 0.75rem;
  pointer-events: none;
  z-index: 10000;
  max-width: 320px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  white-space: pre-line;
  line-height: 1.5;
`;

const EmptyState = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  gap: 8px;
  font-size: 0.9rem;
`;

// ===== Modal Styled =====

const ModalOverlay = styled(motion.div)`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20000;
`;

const ModalBox = styled(motion.div)`
  background: #ffffff;
  border-radius: 14px;
  width: 80vw;
  height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
`;

const ModalHeader = styled.div`
  padding: 16px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
`;

const ModalTitleWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const ModalBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 10px;
  font-size: 0.78rem;
  font-weight: 700;
  color: #ffffff;
  background: ${p => p.$color || '#64748b'};
`;

const ModalTitle = styled.h3`
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: #1e293b;
`;

const ModalHeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ModalExportBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  border: 1px solid #a5b4fc;
  background: #eef2ff;
  color: #4f46e5;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { background: #e0e7ff; border-color: #818cf8; }
`;

const ModalCloseBtn = styled.button`
  width: 32px; height: 32px;
  border: none; background: #f1f5f9; color: #64748b;
  border-radius: 8px; display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.15s;
  &:hover { background: #e2e8f0; color: #1e293b; }
`;

const ModalBody = styled.div`
  flex: 1;
  overflow-y: auto;
`;

const ModalTable = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const MTh = styled.th`
  padding: 10px 16px;
  font-size: 0.75rem;
  font-weight: 700;
  color: #64748b;
  text-align: ${p => p.$align || 'left'};
  background: #f8fafc;
  border-bottom: 2px solid #e2e8f0;
  position: sticky;
  top: 0;
  z-index: 1;
  white-space: nowrap;
`;

const MTr = styled.tr`
  &:not(:last-child) td { border-bottom: 1px solid #f1f5f9; }
  &:hover { background: #fafbfc; }
`;

const MTd = styled.td`
  padding: 10px 16px;
  font-size: 0.82rem;
  color: #1e293b;
  vertical-align: middle;
  text-align: ${p => p.$align || 'left'};
`;

const TaskIdBadge = styled.span`
  font-size: 0.72rem;
  font-weight: 600;
  color: #6366f1;
  margin-right: 6px;
`;

const DeltaText = styled.span`
  font-weight: 700;
  color: #4f46e5;
`;

const UnitText = styled.span`
  font-size: 0.75rem;
  color: #94a3b8;
  margin-left: 2px;
`;

const MutedText = styled.span`
  color: #94a3b8;
`;

// ===== Color helpers =====

const CATEGORY_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#64748b',
];

const adjustBrightness = (hex, factor) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const fn = factor > 0
    ? (c) => Math.round(c + (255 - c) * factor)
    : (c) => Math.max(0, Math.round(c * (1 + factor)));
  return `#${[r, g, b].map(fn).map(c => c.toString(16).padStart(2, '0')).join('')}`;
};

// ===== Component =====

const EffectTreemap = ({ tasks, divisionColors = {} }) => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [detailModal, setDetailModal] = useState(null); // { category, name, color, items }

  // 사업부 목록 추출 (고정 순서)
  const DIVISION_ORDER = ['MX', 'VD', 'DA', 'NW', '의료기기', 'GTR', 'SR', 'CS'];
  const allDivisions = useMemo(() => {
    const set = new Set();
    tasks.forEach(task => (task.사업부 || []).forEach(d => set.add(d)));
    const divs = Array.from(set);
    const orderMap = {};
    DIVISION_ORDER.forEach((name, i) => { orderMap[name.toUpperCase()] = i; });
    divs.sort((a, b) => {
      const ai = orderMap[a.toUpperCase()] ?? 999;
      const bi = orderMap[b.toUpperCase()] ?? 999;
      return ai !== bi ? ai - bi : a.localeCompare(b);
    });
    return divs;
  }, [tasks]);

  const [selectedDivisions, setSelectedDivisions] = useState(() => new Set());
  const [selectedUnit, setSelectedUnit] = useState('억원');

  // 전체 기대효과에서 단위 목록 추출
  const allUnits = useMemo(() => {
    const set = new Set();
    tasks.forEach(task => {
      (task.대분류액티비티 || []).forEach(catAct => {
        (catAct.기대효과 || []).forEach(eff => {
          const u = (eff.단위 || '').trim();
          if (u) set.add(u);
        });
      });
    });
    const units = Array.from(set);
    // '억원'을 맨 앞으로
    units.sort((a, b) => {
      if (a === '억원') return -1;
      if (b === '억원') return 1;
      return a.localeCompare(b);
    });
    return units;
  }, [tasks]);

  // 단위 목록이 바뀌면 기본 선택 보정
  useEffect(() => {
    if (allUnits.length > 0 && !allUnits.includes(selectedUnit)) {
      setSelectedUnit(allUnits[0]);
    }
  }, [allUnits]);

  // 초기값: 전체 선택 (allDivisions 변경 시 리셋)
  useEffect(() => {
    setSelectedDivisions(new Set(allDivisions));
  }, [allDivisions]);

  const toggleDivision = (div) => {
    setSelectedDivisions(prev => {
      const next = new Set(prev);
      next.has(div) ? next.delete(div) : next.add(div);
      return next;
    });
  };

  const isAllSelected = allDivisions.length > 0 && allDivisions.every(d => selectedDivisions.has(d));
  const toggleAll = () => {
    setSelectedDivisions(isAllSelected ? new Set() : new Set(allDivisions));
  };

  const handleExportCsv = () => {
    if (!detailModal || detailModal.items.length === 0) return;
    const BOM = '\uFEFF';
    const header = ['No.', '식별ID', '과제명', '대분류(액티비티)', '기대효과명', '현재', '목표', '△ 목표-현재', '단위'];
    const rows = detailModal.items.map((item, idx) => [
      idx + 1, item.taskId || '', item.taskName || '', item.catActName || '',
      item.effectName || '', item.current, item.target, item.delta, item.unit || '',
    ]);
    const esc = (v) => { const s = String(v); return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = BOM + [header, ...rows].map(r => r.map(esc).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${detailModal.category}_${detailModal.name}_기대효과.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 필터된 과제
  const filteredTasks = useMemo(() => {
    if (selectedDivisions.size === 0) return [];
    return tasks.filter(task => (task.사업부 || []).some(d => selectedDivisions.has(d)));
  }, [tasks, selectedDivisions]);

  // 기대효과 데이터를 대분류/소분류별로 집계
  const { treemapData, legendData, subColorMap } = useMemo(() => {
    const catMap = {}; // { 대분류: { 소분류: { deltaSum, count, items[] } } }

    filteredTasks.forEach(task => {
      (task.대분류액티비티 || []).forEach(catAct => {
        (catAct.기대효과 || []).forEach(eff => {
          const u = (eff.단위 || '').trim();
          if (u !== selectedUnit) return;
          const cat = eff.대분류 || '미분류';
          const sub = eff.소분류 || '미분류';
          const current = parseFloat(eff.현재) || 0;
          const target = parseFloat(eff.목표) || 0;
          const delta = Math.abs(target - current);

          if (!catMap[cat]) catMap[cat] = {};
          if (!catMap[cat][sub]) catMap[cat][sub] = { deltaSum: 0, count: 0, items: [] };
          catMap[cat][sub].deltaSum += delta;
          catMap[cat][sub].count++;
          catMap[cat][sub].items.push({
            taskName: task.과제명,
            taskId: task.식별ID,
            catActName: catAct.categoryName || '',
            effectName: eff.기대효과명 || '',
            unit: eff.단위 || '',
            current,
            target,
            delta,
          });
        });
      });
    });

    // 대분류별 색상 + 소분류별 밝기 변화
    const catNames = Object.keys(catMap);
    const scMap = {}; // subColorMap: { "대분류|소분류": color }
    const legend = [];

    catNames.forEach((catName, ci) => {
      const baseColor = CATEGORY_COLORS[ci % CATEGORY_COLORS.length];
      const subNames = Object.keys(catMap[catName]);
      const subEntries = [];

      subNames.forEach((subName, si) => {
        // 소분류 인덱스에 따라 밝기 변화 (-0.15 ~ +0.2 범위)
        const factor = subNames.length <= 1 ? 0 : -0.15 + (si / (subNames.length - 1)) * 0.35;
        const subColor = adjustBrightness(baseColor, factor);
        const key = `${catName}|${subName}`;
        scMap[key] = {
          fill: subColor,
          stroke: adjustBrightness(baseColor, -0.25),
        };
        subEntries.push({ name: subName, color: subColor });
      });

      legend.push({ catName, baseColor, subs: subEntries });
    });

    // flat children
    const children = [];
    Object.entries(catMap).forEach(([cat, subs]) => {
      Object.entries(subs).forEach(([sub, data]) => {
        children.push({
          name: sub,
          category: cat,
          key: `${cat}|${sub}`,
          value: data.deltaSum > 0 ? data.deltaSum : data.count,
          deltaSum: data.deltaSum,
          count: data.count,
          items: data.items,
          unit: data.items[0]?.unit || '',
        });
      });
    });

    return {
      treemapData: { name: 'root', children },
      legendData: legend,
      subColorMap: scMap,
    };
  }, [filteredTasks, selectedUnit]);

  const wrapText = useCallback((text, maxChars) => {
    if (!text) return [];
    const lines = [];
    let current = '';
    for (const word of text.split(' ')) {
      const test = current ? `${current} ${word}` : word;
      if (test.length <= maxChars) { current = test; }
      else {
        if (current) { lines.push(current); current = word; }
        else { lines.push(word.substring(0, maxChars)); current = word.substring(maxChars); }
      }
    }
    if (current) lines.push(current);
    return lines;
  }, []);

  const formatNumber = (n) => {
    if (n >= 1e8) return `${(n / 1e8).toFixed(1)}억`;
    if (n >= 1e4) return `${(n / 1e4).toFixed(1)}만`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}천`;
    return String(n);
  };

  const renderTreemap = useCallback(() => {
    if (!svgRef.current || !containerRef.current || !treemapData.children?.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const rect = containerRef.current.getBoundingClientRect();
    const width = Math.max(rect.width, 300);
    const height = Math.max(rect.height, 250);

    svg.attr('width', width).attr('height', height)
      .style('width', width + 'px').style('height', height + 'px');

    const hierarchy = d3.hierarchy(treemapData)
      .sum(d => d.value)
      .sort((a, b) => {
        const cc = (a.data.category || '').localeCompare(b.data.category || '');
        return cc !== 0 ? cc : b.value - a.value;
      });

    const layout = d3.treemap()
      .size([width, height])
      .paddingOuter(4)
      .paddingInner(2)
      .round(true)
      .tile(d3.treemapSquarify);

    const root = layout(hierarchy);
    const groups = svg.selectAll('.sub')
      .data(root.children)
      .enter()
      .append('g')
      .attr('class', 'sub')
      .style('cursor', 'pointer');

    // 클릭
    groups.on('click', function (event, d) {
      setDetailModal({
        category: d.data.category,
        name: d.data.name,
        color: subColorMap[d.data.key]?.fill || '#64748b',
        items: d.data.items || [],
        unit: d.data.unit || '',
        deltaSum: d.data.deltaSum,
        count: d.data.count,
      });
    });

    // 사각형 - 소분류별 색상
    groups.append('rect')
      .attr('x', d => d.x0)
      .attr('y', d => d.y0)
      .attr('width', d => Math.max(0, d.x1 - d.x0))
      .attr('height', d => Math.max(0, d.y1 - d.y0))
      .attr('fill', d => subColorMap[d.data.key]?.fill || '#64748b')
      .attr('stroke', d => subColorMap[d.data.key]?.stroke || '#475569')
      .attr('stroke-width', 2)
      .attr('rx', 4);

    // 호버
    groups
      .on('mouseover', function (event, d) {
        d3.select(this).select('rect').attr('opacity', 0.8);
        const items = d.data.items || [];
        const itemLines = items.slice(0, 6).map(it =>
          `  ${it.effectName || it.taskName}: △${it.delta}${it.unit ? ' ' + it.unit : ''}`
        ).join('\n');
        const more = items.length > 6 ? `\n  ... 외 ${items.length - 6}건` : '';
        setTooltip({
          x: event.clientX + 12, y: event.clientY + 12,
          content: `[${d.data.category}] ${d.data.name}\n기대효과 ${d.data.count}건\n목표-현재 합계: △${d.data.deltaSum}${d.data.unit ? ' ' + d.data.unit : ''}\n\n${itemLines}${more}`,
        });
      })
      .on('mousemove', function (event) {
        setTooltip(prev => prev ? { ...prev, x: event.clientX + 12, y: event.clientY + 12 } : null);
      })
      .on('mouseout', function () {
        d3.select(this).select('rect').attr('opacity', 1);
        setTooltip(null);
      });

    // 대분류 라벨 (상단)
    groups.append('text')
      .attr('x', d => d.x0 + 5)
      .attr('y', d => d.y0 + 14)
      .attr('font-size', d => {
        const w = d.x1 - d.x0, h = d.y1 - d.y0;
        if (w > 120 && h > 60) return '11px';
        if (w > 80 && h > 40) return '10px';
        if (w > 55 && h > 30) return '9px';
        return '0px';
      })
      .attr('font-weight', 'bold')
      .attr('fill', 'white')
      .attr('opacity', 0.7)
      .attr('pointer-events', 'none')
      .text(d => {
        const w = d.x1 - d.x0, h = d.y1 - d.y0;
        return (w > 55 && h > 30) ? d.data.category : '';
      });

    // 소분류 이름 + delta 값 (중앙)
    groups.each(function (d) {
      const w = d.x1 - d.x0, h = d.y1 - d.y0;
      if (w < 40 || h < 30) return;

      const g = d3.select(this);
      const cx = d.x0 + w / 2;
      const cy = d.y0 + h / 2;

      let fontSize, maxChars, lineH;
      if (w > 140 && h > 80) { fontSize = 12; maxChars = Math.floor(w / 8); lineH = 15; }
      else if (w > 100 && h > 60) { fontSize = 11; maxChars = Math.floor(w / 7); lineH = 14; }
      else if (w > 70 && h > 45) { fontSize = 10; maxChars = Math.floor(w / 6.5); lineH = 12; }
      else { fontSize = 9; maxChars = Math.floor(w / 6); lineH = 11; }

      const nameLines = wrapText(d.data.name, maxChars);
      const deltaLabel = `△ ${formatNumber(d.data.deltaSum)}${d.data.unit ? ' ' + d.data.unit : ''}`;
      const allLines = [...nameLines, deltaLabel];
      const maxLines = Math.floor((h - 24) / lineH);
      const lines = allLines.slice(0, maxLines);
      const startY = cy - ((lines.length - 1) * lineH) / 2;

      lines.forEach((line, i) => {
        const isDelta = i === nameLines.length;
        g.append('text')
          .attr('x', cx)
          .attr('y', startY + i * lineH)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('font-size', isDelta ? (fontSize - 1) + 'px' : fontSize + 'px')
          .attr('font-weight', isDelta ? '700' : '600')
          .attr('fill', 'white')
          .attr('opacity', isDelta ? 1 : 0.95)
          .attr('pointer-events', 'none')
          .text(line);
      });
    });
  }, [treemapData, subColorMap, wrapText, setDetailModal]);

  useEffect(() => {
    renderTreemap();
    const handleResize = () => renderTreemap();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [renderTreemap]);

  const hasData = treemapData.children?.length > 0;

  return (
    <Container>
      <TreemapArea>
        {allDivisions.length > 0 && (
          <FilterBar>
            <FilterLabel>사업부</FilterLabel>
            <FilterAllBtn onClick={toggleAll}>
              {isAllSelected ? '전체 해제' : '전체 선택'}
            </FilterAllBtn>
            {allDivisions.map(div => (
              <FilterChip
                key={div}
                $active={selectedDivisions.has(div)}
                $color={divisionColors[div]}
                onClick={() => toggleDivision(div)}
              >
                {div}
              </FilterChip>
            ))}
            {allUnits.length > 0 && (
              <>
                <span style={{ width: 1, height: 20, background: '#d1d5db', margin: '0 4px', flexShrink: 0 }} />
                <FilterLabel>단위</FilterLabel>
                {allUnits.map(u => (
                  <FilterChip
                    key={u}
                    $active={selectedUnit === u}
                    $color="#6366f1"
                    onClick={() => setSelectedUnit(u)}
                  >
                    {u}
                  </FilterChip>
                ))}
              </>
            )}
          </FilterBar>
        )}
        {hasData ? (
          <TreemapContainer ref={containerRef}>
            <svg ref={svgRef} />
          </TreemapContainer>
        ) : (
          <EmptyState>
            <span>표시할 기대효과 데이터가 없습니다.</span>
            <span style={{ fontSize: '0.78rem' }}>
              {selectedDivisions.size === 0 ? '사업부를 선택하세요.' : '과제의 대분류에서 기대 효과를 등록하세요.'}
            </span>
          </EmptyState>
        )}
      </TreemapArea>
      <LegendPanel>
        <LegendTitle>성과 분류</LegendTitle>
        {legendData.map(({ catName, baseColor, subs }) => (
          <LegendCatGroup key={catName}>
            <LegendCatLabel>
              <LegendDot $color={baseColor} />
              {catName}
            </LegendCatLabel>
            {subs.map(s => (
              <LegendSubItem key={s.name}>
                <LegendSubDot $color={s.color} />
                {s.name}
              </LegendSubItem>
            ))}
          </LegendCatGroup>
        ))}
      </LegendPanel>
      {tooltip && (
        <Tooltip style={{ left: tooltip.x, top: tooltip.y }}>
          {tooltip.content}
        </Tooltip>
      )}

      {/* 상세 모달 */}
      <AnimatePresence>
        {detailModal && (
          <ModalOverlay
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setDetailModal(null)}
          >
            <ModalBox
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
            >
              <ModalHeader>
                <ModalTitleWrap>
                  <ModalBadge $color={detailModal.color}>{detailModal.category}</ModalBadge>
                  <ModalTitle>{detailModal.name}</ModalTitle>
                  <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                    {detailModal.count}건 · △ {detailModal.deltaSum}{detailModal.unit ? ' ' + detailModal.unit : ''}
                  </span>
                </ModalTitleWrap>
                <ModalHeaderRight>
                  <ModalExportBtn onClick={handleExportCsv}>
                    <Download size={13} /> CSV 저장
                  </ModalExportBtn>
                  <ModalCloseBtn onClick={() => setDetailModal(null)}>
                    <X size={16} />
                  </ModalCloseBtn>
                </ModalHeaderRight>
              </ModalHeader>
              <ModalBody>
                <ModalTable>
                  <thead>
                    <tr>
                      <MTh style={{ width: 44 }}>No.</MTh>
                      <MTh>과제명</MTh>
                      <MTh>대분류</MTh>
                      <MTh>기대효과명</MTh>
                      <MTh $align="center">현재</MTh>
                      <MTh $align="center">목표</MTh>
                      <MTh $align="center">△ 목표-현재</MTh>
                      <MTh $align="center">단위</MTh>
                    </tr>
                  </thead>
                  <tbody>
                    {detailModal.items.map((item, idx) => (
                      <MTr key={idx}>
                        <MTd style={{ color: '#94a3b8', fontSize: '0.78rem' }}>{idx + 1}</MTd>
                        <MTd>
                          {item.taskId && <TaskIdBadge>{item.taskId}</TaskIdBadge>}
                          {item.taskName}
                        </MTd>
                        <MTd>{item.catActName || <MutedText>-</MutedText>}</MTd>
                        <MTd>{item.effectName || <MutedText>-</MutedText>}</MTd>
                        <MTd $align="center">{item.current || <MutedText>-</MutedText>}</MTd>
                        <MTd $align="center">{item.target || <MutedText>-</MutedText>}</MTd>
                        <MTd $align="center"><DeltaText>{item.delta}</DeltaText></MTd>
                        <MTd $align="center">{item.unit || <MutedText>-</MutedText>}</MTd>
                      </MTr>
                    ))}
                  </tbody>
                </ModalTable>
              </ModalBody>
            </ModalBox>
          </ModalOverlay>
        )}
      </AnimatePresence>
    </Container>
  );
};

export default EffectTreemap;
