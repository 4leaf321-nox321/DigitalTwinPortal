import React, { useState, useMemo, useCallback, useRef } from 'react';
import styled from 'styled-components';
import { ChevronDown, ChevronRight, ChevronLeft, ZoomIn, ZoomOut, Calendar, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';

const parseLocalDate = (dateString) => {
  if (!dateString) return null;
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const fmtDate = (d) => d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` : null;

// ========== Styled ==========

const Container = styled.div`
  display: flex; flex-direction: column; flex: 1; overflow: hidden;
  border: 1px solid #e2e8f0; border-radius: 10px; background: white;
`;

const Toolbar = styled.div`
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.75rem 1rem; background: #f8fafc; border-bottom: 1px solid #e2e8f0; gap: 0.75rem;
`;

const Legend = styled.div`
  display: flex; align-items: center; gap: 1rem; font-size: 0.75rem; color: #64748b;
`;

const LegendItem = styled.div`
  display: flex; align-items: center; gap: 0.375rem;
  &::before {
    content: ''; width: 18px; height: 10px; border-radius: 2px;
    ${p => {
      switch (p.$type) {
        case 'plan': return 'background: #e2e8f0; border: 1px solid #cbd5e1;';
        case 'progress': return 'background: #3b82f6;';
        case 'done': return 'background: #10b981;';
        case 'overdue': return 'background: #ef4444;';
        default: return '';
      }
    }}
  }
`;

const YearSelector = styled.div`
  display: flex; align-items: center; gap: 0.5rem;
  background: white; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 0.25rem;
`;
const YearButton = styled.button`
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; background: white;
  border: 1px solid #e2e8f0; border-radius: 0.375rem; color: #64748b; cursor: pointer;
  &:hover { background: #6366f1; border-color: #6366f1; color: white; }
`;
const YearDisplay = styled.div`
  font-size: 0.9rem; font-weight: 600; color: #1e293b; min-width: 90px; text-align: center; white-space: nowrap;
`;

const ZoomToggle = styled.div`
  display: flex; background: #f1f5f9; border-radius: 0.5rem; padding: 3px; border: 1px solid #e2e8f0;
`;
const ZoomBtn = styled.button`
  display: flex; align-items: center; gap: 0.375rem; padding: 0.4rem 0.7rem; border: none;
  border-radius: 0.375rem; font-size: 0.8rem; font-weight: 500; cursor: pointer; transition: all 0.2s;
  background: ${p => p.$active ? '#6366f1' : 'transparent'}; color: ${p => p.$active ? 'white' : '#64748b'};
  &:hover { background: ${p => p.$active ? '#4f46e5' : '#e2e8f0'}; }
`;

const ExpandAllBtn = styled.button`
  display: flex; align-items: center; gap: 4px; padding: 5px 12px;
  border: 1px solid #d1d5db; background: #ffffff; color: #475569;
  border-radius: 6px; font-size: 0.78rem; font-weight: 600; cursor: pointer; transition: all 0.15s;
  &:hover { background: #f8fafc; border-color: #a5b4fc; color: #4f46e5; }
`;

const TimelineWrap = styled.div` flex: 1; overflow: auto; `;
const TimelineInner = styled.div` min-width: ${p => p.$minWidth}px; `;

const StickyHeader = styled.div`
  display: flex; background: white; border-bottom: 2px solid #e2e8f0;
  position: sticky; top: 0; z-index: 10;
`;

const LeftColHeader = styled.div`
  width: 420px; min-width: 420px; padding: 0.625rem 1rem;
  font-size: 0.78rem; font-weight: 700; color: #64748b;
  background: #f8fafc; border-right: 1px solid #e2e8f0; box-sizing: border-box;
`;
const ProgressColHeader = styled.div`
  width: 90px; min-width: 90px; padding: 0.625rem 0.25rem;
  font-size: 0.72rem; font-weight: 700; color: #64748b; text-align: center;
  background: #f8fafc; border-right: 1px solid #e2e8f0; box-sizing: border-box;
`;

const MonthsRow = styled.div` flex: 1; display: flex; `;
const YearRow = styled.div` display: flex; border-bottom: 1px solid #e2e8f0; `;
const YearLabel = styled.div`
  flex: 1; text-align: center; font-size: 0.75rem; font-weight: 600; color: #1e293b;
  padding: 0.375rem 0; background: ${p => p.$isCurrent ? '#f5f3ff' : '#f8fafc'};
  border-right: 2px solid #e2e8f0; &:last-child { border-right: none; }
`;
const MonthCell = styled.div`
  flex: 1; min-width: ${p => p.$zoom === 'year' ? '20px' : p.$zoom === 'week' ? '120px' : '70px'};
  padding: ${p => p.$zoom === 'year' ? '0.375rem 0' : p.$zoom === 'week' ? '0.375rem 0.25rem' : '0.5rem 0.25rem'}; text-align: center;
  font-size: ${p => p.$zoom === 'year' ? '0.5625rem' : p.$zoom === 'week' ? '0.68rem' : '0.78rem'}; font-weight: 500; color: #64748b;
  border-right: 1px solid #f1f5f9; background: ${p => p.$isCurrent ? '#faf5ff' : 'transparent'};
  white-space: nowrap; line-height: 1.4;
  &:last-child { border-right: none; }
`;

const Row = styled.div`
  display: flex; align-items: stretch; min-height: 38px;
  border-bottom: 1px solid ${p => p.$isTask ? '#e2e8f0' : '#f1f5f9'};
  background: ${p => p.$isTask ? 'white' : '#fafafa'};
  &:hover { background: ${p => p.$isTask ? '#f8fafc' : '#f5f5f5'}; }
`;

const LeftCol = styled.div`
  width: 420px; min-width: 420px;
  padding: 0.5rem 1rem; padding-left: ${p => p.$indent ? '2.25rem' : '1rem'};
  font-size: 0.8rem; color: ${p => p.$indent ? '#64748b' : '#1e293b'};
  font-weight: ${p => p.$indent ? '500' : '600'};
  display: flex; align-items: center; gap: 0.5rem;
  border-right: 1px solid #e2e8f0; box-sizing: border-box;
  cursor: ${p => p.$expandable ? 'pointer' : 'default'};
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
`;

const ProgressCol = styled.div`
  width: 90px; min-width: 90px;
  display: flex; align-items: center; justify-content: center;
  border-right: 1px solid #e2e8f0; box-sizing: border-box;
  font-size: 0.72rem; font-weight: 600;
  color: ${p => p.$v >= 100 ? '#10b981' : p.$v > 0 ? '#3b82f6' : '#94a3b8'};
`;

const ProgressMini = styled.div`
  display: flex; flex-direction: column; align-items: center; gap: 2px; width: 100%;
  padding: 0 6px; box-sizing: border-box;
`;
const ProgressTrack = styled.div`
  width: 100%; height: 4px; background: #e2e8f0; border-radius: 2px; overflow: hidden;
`;
const ProgressFill = styled.div`
  height: 100%; border-radius: 2px;
  background: ${p => p.$v >= 100 ? '#10b981' : p.$v > 0 ? '#3b82f6' : '#e2e8f0'};
  width: ${p => Math.min(p.$v, 100)}%;
`;

const IdBadge = styled.span` font-size: 0.68rem; font-weight: 600; color: #6366f1; flex-shrink: 0; `;

const BarArea = styled.div` flex: 1; position: relative; display: flex; align-items: center; min-height: 38px; `;

const GridLines = styled.div` position: absolute; inset: 0; display: flex; pointer-events: none; `;
const GridLine = styled.div` flex: 1; border-right: 1px solid #f1f5f9; &:last-child { border-right: none; } `;

/* 바: 시작~목표 구간 전체 배경 */
const PlanBar = styled.div`
  position: absolute; height: 16px; border-radius: 4px; top: 50%; transform: translateY(-50%);
  left: ${p => p.$left}%; width: ${p => Math.max(p.$width, 0.4)}%;
  background: #e2e8f0; border: 1px solid #cbd5e1;
`;

/* 바: 진행/완료 채움 (PlanBar 위에 겹침) */
const FillBar = styled.div`
  position: absolute; height: 16px; border-radius: 4px; top: 50%; transform: translateY(-50%);
  left: ${p => p.$left}%; width: ${p => Math.max(p.$width, 0.3)}%;
  background: ${p => p.$color};
  z-index: 1;
`;

/* 바 위 레이블 */
const BarLabel = styled.span`
  position: absolute; top: 50%; transform: translateY(-50%);
  left: ${p => p.$left}%; width: ${p => p.$width}%;
  font-size: 0.6rem; font-weight: 600; color: #475569;
  text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  padding: 0 4px; box-sizing: border-box; z-index: 3; pointer-events: none;
`;

/* 바 위 호버 영역 */
const BarHoverZone = styled.div`
  position: absolute; top: 0; bottom: 0;
  left: ${p => p.$left}%; width: ${p => Math.max(p.$width, 1)}%;
  z-index: 6; cursor: default;
`;

const BarTooltipBox = styled.div`
  display: none;
  position: fixed;
  background: #1e293b; color: white; border-radius: 8px; padding: 8px 12px;
  font-size: 0.72rem; white-space: nowrap; z-index: 9999;
  box-shadow: 0 4px 12px rgba(0,0,0,0.25);
  pointer-events: none;
`;

const TooltipRow = styled.div`
  display: flex; align-items: center; gap: 6px; padding: 1.5px 0;
`;

const TooltipDot = styled.span`
  width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
  background: ${p => p.$color};
`;

const TodayLine = styled.div`
  position: absolute; top: 0; bottom: 0; width: 2px; background: #ef4444;
  left: ${p => p.$left}%; z-index: 5; pointer-events: none;
`;

const TodayLabel = styled.div`
  position: absolute; top: 0; bottom: 0; width: 2px; background: #ef4444;
  left: ${p => p.$left}%; z-index: 5; pointer-events: none;
  &::after {
    content: '오늘'; position: absolute; top: 50%; transform: translateY(-50%); left: 5px;
    font-size: 0.65rem; color: #ef4444; font-weight: 700; white-space: nowrap;
    background: white; padding: 1px 4px; border-radius: 3px; border: 1px solid #fecaca;
  }
`;

const EmptyState = styled.div`
  flex: 1; display: flex; align-items: center; justify-content: center;
  padding: 3rem; color: #94a3b8; font-size: 0.9rem;
`;

// ========== Logic ==========

const groupActivities = (task) => {
  const catMap = {};
  (task.대분류액티비티 || []).forEach(cat => {
    catMap[cat.categoryId] = { ...cat, subcategories: [] };
  });
  (task.분석액티비티 || []).forEach(sub => {
    if (catMap[sub.categoryId]) catMap[sub.categoryId].subcategories.push(sub);
  });
  return Object.values(catMap);
};

const calcCatProgress = (cat) => {
  const subs = cat.subcategories || [];
  if (subs.length === 0) return 0;
  const total = subs.reduce((sum, s) => {
    if (s.상태 === '완료') return sum + 100;
    if (s.상태 === '진행') return sum + (s.진행률 ?? 0);
    return sum;
  }, 0);
  return Math.round(total / subs.length);
};

// ========== Component ==========

const WEEK_COUNT = 12; // 주간 뷰에서 표시할 주 수

const getMonday = (d) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

const TaskGanttView = ({ tasks, divisionColors, expandedTasks: extExpanded, onExpandedChange }) => {
  const [zoomLevel, setZoomLevel] = useState('month');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [yearViewStart, setYearViewStart] = useState(new Date().getFullYear() - 2);
  const [weekViewStart, setWeekViewStart] = useState(() => getMonday(new Date()));
  const [internalExpanded, setInternalExpanded] = useState(new Set());
  const isExpandControlled = extExpanded !== undefined && typeof onExpandedChange === 'function';
  const expandedTasks = isExpandControlled ? extExpanded : internalExpanded;
  const setExpandedTasks = (updater) => {
    if (isExpandControlled) {
      const next = typeof updater === 'function' ? updater(expandedTasks) : updater;
      onExpandedChange(next);
    } else {
      setInternalExpanded(updater);
    }
  };
  const [tooltip, setTooltip] = useState(null); // { x, y, content }
  const tooltipRef = useRef(null);

  const showTooltip = useCallback((e, content) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      content,
    });
  }, []);

  const hideTooltip = useCallback(() => setTooltip(null), []);

  const YEAR_SPAN = 5;
  const dateRange = useMemo(() => ({
    minYear: yearViewStart, maxYear: yearViewStart + YEAR_SPAN - 1,
  }), [yearViewStart]);

  const toggleTask = (taskId) => {
    setExpandedTasks(prev => {
      const n = new Set(prev); n.has(taskId) ? n.delete(taskId) : n.add(taskId); return n;
    });
  };

  const allTaskIds = useMemo(() => tasks.filter(t => groupActivities(t).length > 0).map(t => t.id), [tasks]);
  const isAllExpanded = allTaskIds.length > 0 && allTaskIds.every(id => expandedTasks.has(id));

  const toggleAll = () => {
    if (isAllExpanded) {
      setExpandedTasks(new Set());
    } else {
      setExpandedTasks(new Set(allTaskIds));
    }
  };

  const timelineStart = useMemo(() => {
    if (zoomLevel === 'year') return new Date(dateRange.minYear, 0, 1);
    if (zoomLevel === 'week') return new Date(weekViewStart);
    return new Date(selectedYear, 0, 1);
  }, [zoomLevel, dateRange, selectedYear, weekViewStart]);
  const timelineEnd = useMemo(() => {
    if (zoomLevel === 'year') return new Date(dateRange.maxYear, 11, 31);
    if (zoomLevel === 'week') {
      const end = new Date(weekViewStart);
      end.setDate(end.getDate() + WEEK_COUNT * 7 - 1);
      return end;
    }
    return new Date(selectedYear, 11, 31);
  }, [zoomLevel, dateRange, selectedYear, weekViewStart]);
  const totalDays = useMemo(() => (timelineEnd - timelineStart) / 864e5, [timelineStart, timelineEnd]);

  const calcPos = (startDate, endDate) => {
    const s = parseLocalDate(startDate), e = parseLocalDate(endDate);
    if (!s || !e) return null;
    let sP = ((s - timelineStart) / 864e5) / totalDays * 100;
    let eP = ((e - timelineStart) / 864e5) / totalDays * 100;
    sP = Math.max(0, sP); eP = Math.min(100, eP);
    if (eP <= 0 || sP >= 100) return null;
    return { left: sP, width: Math.max(eP - sP, 0.4) };
  };

  const todayPos = useMemo(() => {
    const p = ((new Date() - timelineStart) / 864e5) / totalDays * 100;
    return p >= 0 && p <= 100 ? p : null;
  }, [timelineStart, totalDays]);

  const monthlyTimeline = useMemo(() => {
    if (zoomLevel !== 'month') return null;
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => ({
      month: i + 1, label: `${i + 1}월`,
      isCurrent: now.getFullYear() === selectedYear && now.getMonth() === i,
    }));
  }, [zoomLevel, selectedYear]);

  const yearlyTimeline = useMemo(() => {
    if (zoomLevel !== 'year') return null;
    const now = new Date();
    const yrs = [];
    for (let y = dateRange.minYear; y <= dateRange.maxYear; y++) {
      const ms = Array.from({ length: 12 }, (_, m) => ({
        year: y, month: m + 1, label: `${m + 1}`,
        isCurrent: now.getFullYear() === y && now.getMonth() === m,
      }));
      yrs.push({ year: y, months: ms, isCurrent: now.getFullYear() === y });
    }
    return yrs;
  }, [zoomLevel, dateRange]);

  const weeklyTimeline = useMemo(() => {
    if (zoomLevel !== 'week') return null;
    const now = new Date();
    const currentMonday = getMonday(now);
    const weeks = [];
    for (let i = 0; i < WEEK_COUNT; i++) {
      const wStart = new Date(weekViewStart);
      wStart.setDate(wStart.getDate() + i * 7);
      const wEnd = new Date(wStart);
      wEnd.setDate(wEnd.getDate() + 6);
      const isCurrent = wStart.getTime() === currentMonday.getTime();
      // 해당 주가 속한 연도의 1월 1일 기준 주차 계산
      const yearStart = new Date(wStart.getFullYear(), 0, 1);
      const diffDays = Math.floor((wStart - yearStart) / 864e5);
      const weekNum = Math.ceil((diffDays + yearStart.getDay() + 1) / 7);
      const label = `${weekNum}주차 ${wStart.getMonth() + 1}/${wStart.getDate()}~${wEnd.getMonth() + 1}/${wEnd.getDate()}`;
      weeks.push({ index: i, start: wStart, end: wEnd, label, isCurrent });
    }
    return weeks;
  }, [zoomLevel, weekViewStart]);

  const gridCount = zoomLevel === 'year' ? YEAR_SPAN * 12 : zoomLevel === 'week' ? WEEK_COUNT : 12;
  const cellMinWidth = zoomLevel === 'year' ? 20 : zoomLevel === 'week' ? 120 : 70;
  const gridMinWidth = 420 + 90 + gridCount * cellMinWidth;

  // Build rows
  const rows = useMemo(() => {
    const r = [];
    tasks.forEach(task => {
      const groups = groupActivities(task);
      const has = groups.length > 0;
      const exp = expandedTasks.has(task.id);
      r.push({ type: 'task', task, groups, hasGroups: has, isExpanded: exp });
      if (exp && has) groups.forEach(cat => r.push({ type: 'cat', task, cat }));
    });
    return r;
  }, [tasks, expandedTasks]);

  // 바 렌더 헬퍼
  const renderBars = (startDate, targetDate, completeDate, progress) => {
    const today = fmtDate(new Date());
    const bars = [];
    const isCompleted = progress >= 100 || !!completeDate;
    const isOverdue = !isCompleted && targetDate && today > targetDate;

    // 지연 상태: 전체 바를 빨간색으로 표시
    if (isOverdue && startDate) {
      const barEnd = today > targetDate ? today : targetDate;
      const overPos = calcPos(startDate, barEnd);
      if (overPos) {
        bars.push(<PlanBar key="plan" $left={overPos.left} $width={overPos.width} style={{ background: '#fee2e2', borderColor: '#fca5a5' }} />);
        bars.push(<FillBar key="overdue" $left={overPos.left} $width={overPos.width} $color="#ef4444" style={{ opacity: 0.6 }} />);
        // 진행된 부분은 안쪽에 약간 어두운 빨간으로
        if (progress > 0) {
          const s = parseLocalDate(startDate), t = parseLocalDate(targetDate);
          if (s && t) {
            const progressEnd = new Date(s.getTime() + (t - s) * (progress / 100));
            const progPos = calcPos(startDate, fmtDate(progressEnd));
            if (progPos) bars.push(<FillBar key="prog" $left={progPos.left} $width={progPos.width} $color="#dc2626" />);
          }
        }
      }
      return bars;
    }

    // 배경 바: 시작~목표
    const planPos = calcPos(startDate, targetDate);
    if (planPos) {
      bars.push(<PlanBar key="plan" $left={planPos.left} $width={planPos.width} />);
    }

    const effectiveEnd = completeDate || (isCompleted ? targetDate : null);

    if (isCompleted && startDate && effectiveEnd) {
      // 완료: 초록 바
      const donePos = calcPos(startDate, effectiveEnd);
      if (donePos) bars.push(<FillBar key="done" $left={donePos.left} $width={donePos.width} $color="#10b981" />);
    } else if (startDate && progress > 0 && planPos) {
      // 진행 중: 파란 바
      const s = parseLocalDate(startDate), t = parseLocalDate(targetDate);
      if (s && t) {
        const progressEnd = new Date(s.getTime() + (t - s) * (progress / 100));
        const progPos = calcPos(startDate, fmtDate(progressEnd));
        if (progPos) bars.push(<FillBar key="prog" $left={progPos.left} $width={progPos.width} $color="#3b82f6" />);
      }
    }

    return bars;
  };

  if (tasks.length === 0) {
    return <EmptyState><Calendar size={40} style={{ marginRight: 8, opacity: 0.5 }} /> 간트 차트에 표시할 과제가 없습니다.</EmptyState>;
  }

  return (
    <Container>
      <Toolbar>
        <Legend>
          <LegendItem $type="plan">계획 기간</LegendItem>
          <LegendItem $type="progress">진행</LegendItem>
          <LegendItem $type="done">완료</LegendItem>
          <LegendItem $type="overdue">지연/초과</LegendItem>
        </Legend>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {zoomLevel === 'week' && (
            <YearSelector>
              <YearButton onClick={() => setWeekViewStart(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7 * 4); return d; })}><ChevronLeft size={16} /></YearButton>
              <YearDisplay>
                {weekViewStart.getMonth() + 1}/{weekViewStart.getDate()} ~ {(() => { const e = new Date(weekViewStart); e.setDate(e.getDate() + WEEK_COUNT * 7 - 1); return `${e.getMonth() + 1}/${e.getDate()}`; })()}
              </YearDisplay>
              <YearButton onClick={() => setWeekViewStart(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7 * 4); return d; })}><ChevronRight size={16} /></YearButton>
            </YearSelector>
          )}
          {zoomLevel === 'month' && (
            <YearSelector>
              <YearButton onClick={() => setSelectedYear(y => y - 1)}><ChevronLeft size={16} /></YearButton>
              <YearDisplay>{selectedYear}년</YearDisplay>
              <YearButton onClick={() => setSelectedYear(y => y + 1)}><ChevronRight size={16} /></YearButton>
            </YearSelector>
          )}
          {zoomLevel === 'year' && (
            <YearSelector>
              <YearButton onClick={() => setYearViewStart(y => y - 1)}><ChevronLeft size={16} /></YearButton>
              <YearDisplay>{dateRange.minYear}~{dateRange.maxYear}년</YearDisplay>
              <YearButton onClick={() => setYearViewStart(y => y + 1)}><ChevronRight size={16} /></YearButton>
            </YearSelector>
          )}
          <ZoomToggle>
            <ZoomBtn $active={zoomLevel === 'week'} onClick={() => { setWeekViewStart(getMonday(new Date())); setZoomLevel('week'); }}>
              <Calendar size={14} /> 주간
            </ZoomBtn>
            <ZoomBtn $active={zoomLevel === 'month'} onClick={() => setZoomLevel('month')}>
              <ZoomIn size={14} /> 월별
            </ZoomBtn>
            <ZoomBtn $active={zoomLevel === 'year'} onClick={() => setZoomLevel('year')}>
              <ZoomOut size={14} /> 연간
            </ZoomBtn>
          </ZoomToggle>
        </div>
      </Toolbar>

      <TimelineWrap>
        <TimelineInner $minWidth={gridMinWidth}>
        {/* Year labels for year view */}
        {zoomLevel === 'year' && yearlyTimeline && (
          <YearRow>
            <div style={{ width: 510, minWidth: 510, background: '#f8fafc', borderRight: '1px solid #e2e8f0' }} />
            {yearlyTimeline.map(yr => (
              <YearLabel key={yr.year} $isCurrent={yr.isCurrent} style={{ minWidth: 240 }}>{yr.year}</YearLabel>
            ))}
          </YearRow>
        )}

        {/* Column headers */}
        <StickyHeader>
          <LeftColHeader>과제 / 대분류</LeftColHeader>
          <ProgressColHeader>진행률</ProgressColHeader>
          <MonthsRow style={{ position: 'relative' }}>
            {zoomLevel === 'week' && weeklyTimeline?.map(w => (
              <MonthCell key={w.index} $isCurrent={w.isCurrent} $zoom={zoomLevel}>
                <div>{w.label.split(' ')[0]}</div>
                <div>{w.label.split(' ')[1]}</div>
              </MonthCell>
            ))}
            {zoomLevel === 'month' && monthlyTimeline?.map(m => (
              <MonthCell key={m.month} $isCurrent={m.isCurrent} $zoom={zoomLevel}>{m.label}</MonthCell>
            ))}
            {zoomLevel === 'year' && yearlyTimeline?.flatMap(yr =>
              yr.months.map(m => (
                <MonthCell key={`${yr.year}-${m.month}`} $isCurrent={m.isCurrent} $zoom={zoomLevel}>{m.label}</MonthCell>
              ))
            )}
            {todayPos !== null && <TodayLabel $left={todayPos} />}
          </MonthsRow>
        </StickyHeader>

        {/* Data rows */}
        {rows.map((row) => {
          if (row.type === 'task') {
            const { task, groups, hasGroups, isExpanded } = row;
            // 과제 전체 진행률 집계
            let totalProgress = 0, catCount = 0;
            let minStart = null, maxTarget = null, maxComplete = null;
            groups.forEach(cat => {
              const p = calcCatProgress(cat);
              totalProgress += p; catCount++;
              if (cat.시작일) { const d = parseLocalDate(cat.시작일); if (d && (!minStart || d < minStart)) minStart = d; }
              if (cat.목표일) { const d = parseLocalDate(cat.목표일); if (d && (!maxTarget || d > maxTarget)) maxTarget = d; }
              if (cat.완료일) { const d = parseLocalDate(cat.완료일); if (d && (!maxComplete || d > maxComplete)) maxComplete = d; }
            });
            const avgProgress = catCount > 0 ? Math.round(totalProgress / catCount) : 0;

            return (
              <Row key={`t-${task.id}`} $isTask>
                <LeftCol $expandable={hasGroups} onClick={() => hasGroups && toggleTask(task.id)}>
                  {hasGroups ? (isExpanded ? <ChevronDown size={14} color="#94a3b8" /> : <ChevronRight size={14} color="#94a3b8" />) : <span style={{ width: 14 }} />}
                  {task.식별ID && <IdBadge>{task.식별ID}</IdBadge>}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.과제명}</span>
                </LeftCol>
                <ProgressCol $v={avgProgress}>
                  <ProgressMini>
                    <span>{avgProgress}%</span>
                    <ProgressTrack><ProgressFill $v={avgProgress} /></ProgressTrack>
                  </ProgressMini>
                </ProgressCol>
                <BarArea>
                  <GridLines>{Array.from({ length: gridCount }, (_, i) => <GridLine key={i} />)}</GridLines>
                  {todayPos !== null && <TodayLine $left={todayPos} />}
                  {renderBars(fmtDate(minStart), fmtDate(maxTarget), fmtDate(maxComplete), avgProgress)}
                  {/* 과제 호버 툴팁 */}
                  {groups.length > 0 && (
                    <BarHoverZone $left={0} $width={100}
                      onMouseEnter={(e) => showTooltip(e, { type: 'task', task, groups })}
                      onMouseLeave={hideTooltip}
                    />
                  )}
                </BarArea>
              </Row>
            );
          }

          // Category row
          const { cat } = row;
          const progress = calcCatProgress(cat);
          const subs = cat.subcategories || [];
          const today = fmtDate(new Date());
          const isCatOverdue = progress < 100 && !cat.완료일 && cat.목표일 && today > cat.목표일;

          return (
            <Row key={`c-${row.task.id}-${cat.categoryId}`}>
              <LeftCol $indent>{cat.categoryName}</LeftCol>
              <ProgressCol $v={progress}>
                <ProgressMini>
                  <span>{progress}%</span>
                  <ProgressTrack><ProgressFill $v={progress} /></ProgressTrack>
                </ProgressMini>
              </ProgressCol>
              <BarArea>
                <GridLines>{Array.from({ length: gridCount }, (_, i) => <GridLine key={i} />)}</GridLines>
                {todayPos !== null && <TodayLine $left={todayPos} />}
                {renderBars(cat.시작일, cat.목표일, cat.완료일, progress)}
                {/* 대분류 호버 툴팁 */}
                <BarHoverZone $left={0} $width={100}
                  onMouseEnter={(e) => showTooltip(e, { type: 'cat', cat, subs })}
                  onMouseLeave={hideTooltip}
                />
              </BarArea>
            </Row>
          );
        })}
        </TimelineInner>
      </TimelineWrap>

      {/* Fixed 툴팁 (overflow 잘림 방지) */}
      {tooltip && (
        <BarTooltipBox ref={tooltipRef} style={{
          display: 'block',
          left: tooltip.x,
          top: tooltip.y,
          transform: 'translate(-50%, -100%)',
        }}>
          {tooltip.content.type === 'task' && (() => {
            const { task, groups } = tooltip.content;
            return (
              <>
                <div style={{ fontWeight: 700, marginBottom: 6, fontSize: '0.78rem', borderBottom: '1px solid #334155', paddingBottom: 4 }}>
                  {task.식별ID && <span style={{ color: '#a5b4fc', marginRight: 6 }}>{task.식별ID}</span>}
                  {task.과제명}
                </div>
                {groups.map(cat => {
                  const catSubs = cat.subcategories || [];
                  return (
                    <div key={cat.categoryId} style={{ marginBottom: 4 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.72rem', color: '#cbd5e1', marginBottom: 2 }}>{cat.categoryName}</div>
                      {catSubs.length > 0 ? catSubs.map((sub, si) => {
                        const done = sub.완료여부 || sub.상태 === '완료';
                        return (
                          <TooltipRow key={si}>
                            <TooltipDot $color={done ? '#10b981' : '#64748b'} />
                            <span style={{ color: done ? '#e2e8f0' : '#94a3b8' }}>{sub.subcategoryName || '(이름없음)'}</span>
                            <span style={{ marginLeft: 'auto', paddingLeft: 8, color: done ? '#6ee7b7' : '#64748b' }}>
                              {done ? (sub.완료일 || '완료') : '미완료'}
                            </span>
                          </TooltipRow>
                        );
                      }) : (
                        <div style={{ fontSize: '0.68rem', color: '#64748b', paddingLeft: 13 }}>중분류 없음</div>
                      )}
                    </div>
                  );
                })}
              </>
            );
          })()}
          {tooltip.content.type === 'cat' && (() => {
            const { cat, subs } = tooltip.content;
            return (
              <>
                <div style={{ fontWeight: 700, marginBottom: 4, fontSize: '0.75rem' }}>{cat.categoryName}</div>
                {subs.length > 0 ? subs.map((sub, i) => {
                  const done = sub.완료여부 || sub.상태 === '완료';
                  return (
                    <TooltipRow key={i}>
                      <TooltipDot $color={done ? '#10b981' : '#64748b'} />
                      <span style={{ color: done ? '#e2e8f0' : '#94a3b8' }}>{sub.subcategoryName || '(이름없음)'}</span>
                      <span style={{ marginLeft: 'auto', paddingLeft: 8, color: done ? '#6ee7b7' : '#64748b' }}>
                        {done ? (sub.완료일 || '완료') : '미완료'}
                      </span>
                    </TooltipRow>
                  );
                }) : (
                  <div style={{ fontSize: '0.68rem', color: '#64748b' }}>중분류 없음</div>
                )}
              </>
            );
          })()}
        </BarTooltipBox>
      )}
    </Container>
  );
};

export default TaskGanttView;
