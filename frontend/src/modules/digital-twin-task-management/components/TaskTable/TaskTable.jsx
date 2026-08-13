import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Pencil, FolderOpen, ChevronDown, ChevronRight, ChevronUp, ChevronsDownUp, ChevronsUpDown, Table2, GanttChart, AlertTriangle, CheckCircle2, Filter, RotateCcw, Download } from 'lucide-react';
import XLSX from 'xlsx-js-style';
import TaskGanttView from './TaskGanttView';
import { todayLocalYmd } from '../../../../shared/utils/localDate';

const Wrapper = styled.div`
  padding: 24px;
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const TableHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  flex-shrink: 0;
`;

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: #1e293b;
`;

const Count = styled.span`
  font-size: 0.85rem;
  color: #64748b;
  font-weight: 500;
  margin-left: 8px;
`;

const ExpandToggleBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #475569;
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { background: #f8fafc; border-color: #a5b4fc; color: #4f46e5; }
`;

const SaveBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 13px;
  border: 1px solid #86efac;
  background: #f0fdf4;
  color: #15803d;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  &:hover:not(:disabled) { background: #dcfce7; border-color: #4ade80; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const ViewToggleWrap = styled.div`
  display: flex;
  background: #f1f5f9;
  border-radius: 6px;
  padding: 2px;
  border: 1px solid #e2e8f0;
`;

const ViewToggleBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border: none;
  border-radius: 4px;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  background: ${p => p.$active ? '#6366f1' : 'transparent'};
  color: ${p => p.$active ? 'white' : '#64748b'};
  &:hover { background: ${p => p.$active ? '#4f46e5' : '#e2e8f0'}; }
`;

const TableContainer = styled.div`
  flex: 1;
  overflow: auto;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #ffffff;
`;

const StyledTable = styled.table`
  min-width: ${props => props.$expanded ? '2300px' : '980px'};
  width: 100%;
  border-collapse: collapse;
`;

const Thead = styled.thead`
  position: sticky;
  top: 0;
  z-index: 2;
`;

const ThRow = styled.tr`
  background: #f8fafc;
`;

const Th = styled.th`
  padding: 10px 14px;
  text-align: left;
  font-size: 0.75rem;
  font-weight: 700;
  color: #475569;
  letter-spacing: 0.03em;
  border-bottom: 2px solid #e2e8f0;
  border-right: 1px solid #e2e8f0;
  white-space: nowrap;
  user-select: none;
`;

const ThGroup = styled.th`
  padding: 6px 14px;
  text-align: center;
  font-size: 0.72rem;
  font-weight: 700;
  color: #ffffff;
  background: ${props => props.$color || '#6366f1'};
  border-bottom: 1px solid rgba(255,255,255,0.2);
  white-space: nowrap;
`;

const ThSub = styled.th`
  padding: 8px 14px;
  text-align: left;
  font-size: 0.7rem;
  font-weight: 600;
  color: #64748b;
  background: #f1f5f9;
  border-bottom: 2px solid #e2e8f0;
  white-space: nowrap;
`;

const Tbody = styled.tbody``;

const Tr = styled.tr`
  transition: background 0.1s;
  cursor: pointer;
  &:hover { background: #f0f4ff; }
  td { border-bottom: 1px solid #f1f5f9; }
`;

const Td = styled.td`
  padding: 10px 14px;
  font-size: 0.82rem;
  color: #1e293b;
  text-align: left;
  vertical-align: middle;
  border-right: 1px solid #f1f5f9;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TagGroup = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
`;

const DivisionTag = styled.span`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.72rem;
  font-weight: 600;
  color: #ffffff;
  background: ${props => props.$color || '#64748b'};
`;

const CorpTag = styled.span`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.72rem;
  font-weight: 500;
  color: #065f46;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
`;

const CountBadge = styled.span`
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 600;
  color: ${p => p.$color || '#475569'};
  background: ${p => p.$bg || '#f1f5f9'};
  border: 1px solid ${p => p.$border || '#e2e8f0'};
`;

const LpTag = styled.span`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.72rem;
  font-weight: 500;
  color: #713f12;
  background: #fefce8;
  border: 1px solid #fde68a;
`;

const StatusBadge = styled.span`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.7rem;
  font-weight: 600;
  background: ${p => p.$s === '완료' ? '#dcfce7' : p.$s === '진행' ? '#dbeafe' : p.$s === '지연' ? '#fef2f2' : '#f1f5f9'};
  color: ${p => p.$s === '완료' ? '#16a34a' : p.$s === '진행' ? '#2563eb' : p.$s === '지연' ? '#ef4444' : '#64748b'};
`;

const ProgressBar = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const ProgressTrack = styled.div`
  width: 40px;
  height: 6px;
  background: #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
`;

const ProgressFill = styled.div`
  height: 100%;
  background: ${p => p.$v >= 100 ? '#16a34a' : p.$v > 0 ? '#3b82f6' : '#e2e8f0'};
  border-radius: 3px;
`;

const ProgressLabel = styled.span`
  font-size: 0.7rem;
  font-weight: 600;
  color: ${p => p.$v >= 100 ? '#16a34a' : p.$v > 0 ? '#3b82f6' : '#94a3b8'};
`;

const PersonnelChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
`;

const PersonnelChip = styled.span`
  display: inline-block;
  padding: 1px 6px;
  border-radius: 8px;
  font-size: 0.68rem;
  font-weight: 500;
  color: #1e293b;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
`;

const CatNameCell = styled.div`
  font-size: 0.78rem;
  font-weight: 600;
  color: #4f46e5;
`;

const SubNameCell = styled.div`
  font-size: 0.78rem;
  font-weight: 600;
  color: #1e293b;
`;

const DeleteBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { background: #fef2f2; color: #ef4444; }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  color: #94a3b8;
  gap: 12px;
  span { font-size: 0.9rem; }
  p { font-size: 0.8rem; margin: 0; }
`;

const NoText = styled.span`
  color: #cbd5e1;
  font-size: 0.75rem;
`;

const TaskIdLink = styled.button`
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  font: inherit;
  font-weight: 600;
  color: #4f46e5;
  cursor: pointer;
  text-decoration: none;
  &:hover { text-decoration: underline; color: #3730a3; }
  &:focus-visible { outline: 2px solid #6366f1; outline-offset: 2px; border-radius: 2px; }
`;

// 대분류별로 중분류를 그룹핑
const groupActivities = (task) => {
  const catMap = {};
  (task.대분류액티비티 || []).forEach(cat => {
    catMap[cat.categoryId] = { ...cat, subcategories: [] };
  });
  (task.분석액티비티 || []).forEach(sub => {
    if (catMap[sub.categoryId]) {
      catMap[sub.categoryId].subcategories.push(sub);
    } else {
      if (!catMap[sub.categoryId]) {
        catMap[sub.categoryId] = { categoryId: sub.categoryId, categoryName: sub.categoryId, subcategories: [] };
      }
      catMap[sub.categoryId].subcategories.push(sub);
    }
  });
  return Object.values(catMap);
};

// 과제 전체 상태 자동 계산 (지연 포함)
const calcTaskStatus = (groups) => {
  if (groups.length === 0) return { status: '계획', progress: 0 };
  let totalProgress = 0, catCount = 0;
  groups.forEach(cat => {
    totalProgress += calcCatProgress(cat);
    catCount++;
  });
  const avg = catCount > 0 ? Math.round(totalProgress / catCount) : 0;
  if (avg >= 100) return { status: '완료', progress: 100 };
  // 지연 판단: 대분류 중 하나라도 목표일 초과 + 미완료
  const today = todayLocalYmd();
  const isOverdue = groups.some(cat => {
    const p = calcCatProgress(cat);
    return p < 100 && !cat.완료일 && cat.목표일 && today > cat.목표일;
  });
  if (isOverdue) return { status: '지연', progress: avg };
  if (avg > 0) return { status: '진행', progress: avg };
  return { status: '계획', progress: 0 };
};

// 대분류 진행률 계산
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

// === 정렬/필터 ===
const STATUS_PRIORITY = { '완료': 0, '진행': 1, '지연': 2, '계획': 3 };
const ALL_STATUSES = ['완료', '진행', '지연', '계획'];

const getSortValue = (task, key, groups) => {
  switch (key) {
    case '식별ID':
      return (task.식별ID || '').toString().toLowerCase();
    case '과제명':
      return (task.과제명 || '').toString().toLowerCase();
    case '상태': {
      const s = calcTaskStatus(groups).status;
      return STATUS_PRIORITY[s] ?? 99;
    }
    case '사업부': {
      const arr = (task.사업부 || []).slice().sort();
      return (arr[0] || '').toLowerCase();
    }
    case '법인': {
      const arr = (task.법인 || []).slice().sort();
      return arr.length === 0 ? '' : (arr[0] || '').toLowerCase();
    }
    case '라인/제품': {
      const arr = (task['라인/제품'] || []).slice().sort();
      return (arr[0] || '').toLowerCase();
    }
    case '대분류':
      return groups.length;
    case '중분류':
      return groups.reduce((s, g) => s + (g.subcategories || []).length, 0);
    default:
      return '';
  }
};

const taskMatchesFilter = (task, key, value, groups) => {
  if (value == null) return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  switch (key) {
    case '식별ID':
      return (task.식별ID || '').toString().toLowerCase().includes(value.toLowerCase());
    case '과제명':
      return (task.과제명 || '').toString().toLowerCase().includes(value.toLowerCase());
    case '상태': {
      const s = calcTaskStatus(groups).status;
      return value.includes(s);
    }
    case '사업부':
      return (task.사업부 || []).some(v => value.includes(v));
    case '법인':
      return (task.법인 || []).some(v => value.includes(v));
    case '라인/제품':
      return (task['라인/제품'] || []).some(v => value.includes(v));
    case '대분류':
      return groups.some(g => value.includes(g.categoryName));
    case '중분류':
      return groups.some(g => (g.subcategories || []).some(s => value.includes(s.subcategoryName)));
    default:
      return true;
  }
};

const EditBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { background: #eff6ff; color: #3b82f6; }
`;

const ActionGroup = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
`;

// ============== Column Header / Filter Popover ==============

const HeaderCell = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  width: 100%;
`;

const SortLabel = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  padding: 2px 4px;
  margin: 0;
  border-radius: 4px;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
  color: ${p => p.$active ? '#4f46e5' : 'inherit'};
  text-align: left;
  transition: background 0.15s, color 0.15s;
  &:hover { background: #eef2ff; color: #4f46e5; }
  > span:first-of-type {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  svg { flex-shrink: 0; }
`;

const SortIdle = styled.span`
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  opacity: 0.3;
`;

const HeaderIconBtn = styled.button`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: ${p => p.$active ? '#eef2ff' : 'transparent'};
  color: ${p => p.$active ? '#4f46e5' : '#94a3b8'};
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
  &:hover { background: #e0e7ff; color: #4f46e5; }
`;

const FilterDot = styled.span`
  position: absolute;
  top: 2px;
  right: 2px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ef4444;
  border: 1px solid #ffffff;
`;

const Popover = styled.div`
  position: fixed;
  z-index: 25000;
  width: 240px;
  max-height: 420px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.18);
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const PopoverSection = styled.div`
  padding: 10px 12px;
  & + & { border-top: 1px solid #f1f5f9; }
`;

const PopoverLabel = styled.div`
  font-size: 0.7rem;
  font-weight: 700;
  color: #94a3b8;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  margin-bottom: 6px;
`;

const FilterInputBox = styled.input`
  width: 100%;
  padding: 7px 9px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.78rem;
  color: #1e293b;
  box-sizing: border-box;
  &:focus { outline: none; border-color: #a5b4fc; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }
`;

const CheckListScroll = styled.div`
  max-height: 200px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-top: 4px;
`;

const CheckItem = styled.label`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 6px;
  border-radius: 4px;
  font-size: 0.76rem;
  color: #1e293b;
  cursor: pointer;
  user-select: none;
  &:hover { background: #f8fafc; }
  input { margin: 0; cursor: pointer; flex-shrink: 0; }
  span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;

const PopoverEmpty = styled.div`
  padding: 8px 4px;
  font-size: 0.74rem;
  color: #94a3b8;
  text-align: center;
`;

const ClearBtn = styled.button`
  width: 100%;
  margin-top: 6px;
  padding: 6px;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #ef4444;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  &:hover { background: #fee2e2; }
`;

const ColumnHeader = ({
  label,
  columnKey,
  filterType, // 'text' | 'select' | null (sort-only when null)
  filterOptions,
  sortConfig,
  filters,
  onSort,
  onFilter,
}) => {
  const btnRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const isSortActive = sortConfig.key === columnKey;
  const filterValue = filters[columnKey];
  const hasFilter = filterType === 'text'
    ? !!(filterValue && filterValue.toString().trim() !== '')
    : Array.isArray(filterValue) && filterValue.length > 0;

  // 정렬: 라벨 클릭 시 asc → desc → 해제 순으로 토글
  const handleSortClick = (e) => {
    e.stopPropagation();
    if (!isSortActive) {
      onSort({ key: columnKey, direction: 'asc' });
    } else if (sortConfig.direction === 'asc') {
      onSort({ key: columnKey, direction: 'desc' });
    } else {
      onSort({ key: null, direction: 'asc' });
    }
  };

  const computePos = () => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const popoverWidth = 240;
    let left = rect.left;
    if (left + popoverWidth > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - popoverWidth - 8);
    }
    setPos({ top: rect.bottom + 4, left });
  };

  const handleFilterToggle = (e) => {
    e.stopPropagation();
    if (!open) computePos();
    setOpen(prev => !prev);
  };

  useEffect(() => {
    if (!open) return;
    const handleDown = (e) => {
      if (btnRef.current && btnRef.current.contains(e.target)) return;
      const popover = document.getElementById(`col-popover-${columnKey}`);
      if (popover && popover.contains(e.target)) return;
      setOpen(false);
    };
    const handleResize = () => computePos();
    document.addEventListener('mousedown', handleDown);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('mousedown', handleDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [open, columnKey]);

  const handleCheckToggle = (val) => {
    const current = Array.isArray(filterValue) ? filterValue : [];
    const next = current.includes(val) ? current.filter(v => v !== val) : [...current, val];
    onFilter(columnKey, next);
  };

  const clearFilter = () => {
    if (filterType === 'text') onFilter(columnKey, '');
    else if (filterType === 'select') onFilter(columnKey, []);
  };

  return (
    <HeaderCell>
      <SortLabel
        type="button"
        onClick={handleSortClick}
        $active={isSortActive}
        title={
          !isSortActive ? '오름차순 정렬'
          : sortConfig.direction === 'asc' ? '내림차순 정렬'
          : '정렬 해제'
        }
      >
        <span>{label}</span>
        {isSortActive
          ? (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
          : <SortIdle><ChevronsUpDown size={10} /></SortIdle>}
      </SortLabel>
      {filterType && (
        <HeaderIconBtn
          ref={btnRef}
          type="button"
          onClick={handleFilterToggle}
          $active={hasFilter || open}
          title="필터"
        >
          <Filter size={12} />
          {hasFilter && <FilterDot />}
        </HeaderIconBtn>
      )}
      {open && filterType && createPortal(
        <Popover
          id={`col-popover-${columnKey}`}
          style={{ top: pos.top, left: pos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <PopoverSection>
            <PopoverLabel>필터</PopoverLabel>
            {filterType === 'text' ? (
              <FilterInputBox
                type="text"
                placeholder="포함어 검색..."
                value={filterValue || ''}
                onChange={(e) => onFilter(columnKey, e.target.value)}
                autoFocus
              />
            ) : (
              (filterOptions && filterOptions.length > 0) ? (
                <CheckListScroll>
                  {filterOptions.map(opt => (
                    <CheckItem key={opt}>
                      <input
                        type="checkbox"
                        checked={Array.isArray(filterValue) && filterValue.includes(opt)}
                        onChange={() => handleCheckToggle(opt)}
                      />
                      <span>{opt}</span>
                    </CheckItem>
                  ))}
                </CheckListScroll>
              ) : (
                <PopoverEmpty>선택 가능한 값이 없습니다.</PopoverEmpty>
              )
            )}
          </PopoverSection>
          {hasFilter && (
            <PopoverSection>
              <ClearBtn type="button" onClick={clearFilter}>
                <RotateCcw size={11} /> 필터 초기화
              </ClearBtn>
            </PopoverSection>
          )}
        </Popover>,
        document.body
      )}
    </HeaderCell>
  );
};

// ============== Confirm Modal ==============

const ConfirmOverlay = styled(motion.div)`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 30000;
`;

const ConfirmBox = styled(motion.div)`
  background: #ffffff;
  border-radius: 16px;
  width: 380px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
`;

const ConfirmIconArea = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 24px 12px;
`;

const ConfirmIconCircle = styled.div`
  width: 52px;
  height: 52px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${p => p.$variant === 'danger' ? '#fef2f2' : '#f0fdf4'};
  color: ${p => p.$variant === 'danger' ? '#ef4444' : '#10b981'};
`;

const ConfirmBody = styled.div`
  padding: 0 24px 20px;
  text-align: center;
`;

const ConfirmTitle = styled.h3`
  margin: 0 0 8px;
  font-size: 1rem;
  font-weight: 700;
  color: #1e293b;
`;

const ConfirmMessage = styled.p`
  margin: 0;
  font-size: 0.85rem;
  color: #64748b;
  line-height: 1.5;
  white-space: pre-line;
`;

const ConfirmActions = styled.div`
  display: flex;
  border-top: 1px solid #e2e8f0;
`;

const ConfirmBtn = styled.button`
  flex: 1;
  padding: 14px 0;
  border: none;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  &:first-child {
    background: #ffffff;
    color: #64748b;
    border-right: 1px solid #e2e8f0;
    border-radius: 0 0 0 16px;
    &:hover { background: #f8fafc; }
  }
  &:last-child {
    background: ${p => p.$variant === 'danger' ? '#fef2f2' : '#f0fdf4'};
    color: ${p => p.$variant === 'danger' ? '#ef4444' : '#059669'};
    border-radius: 0 0 16px 0;
    &:hover { background: ${p => p.$variant === 'danger' ? '#fee2e2' : '#dcfce7'}; }
  }
`;

const ConfirmModal = ({ open, title, message, variant = 'danger', onConfirm, onCancel }) => (
  <AnimatePresence>
    {open && (
      <ConfirmOverlay
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onCancel}
      >
        <ConfirmBox
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 10 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
        >
          <ConfirmIconArea>
            <ConfirmIconCircle $variant={variant}>
              {variant === 'danger'
                ? <AlertTriangle size={26} />
                : <CheckCircle2 size={26} />}
            </ConfirmIconCircle>
          </ConfirmIconArea>
          <ConfirmBody>
            <ConfirmTitle>{title}</ConfirmTitle>
            <ConfirmMessage>{message}</ConfirmMessage>
          </ConfirmBody>
          <ConfirmActions>
            <ConfirmBtn type="button" onClick={onCancel}>취소</ConfirmBtn>
            <ConfirmBtn type="button" $variant={variant} onClick={onConfirm}>
              {variant === 'danger' ? '삭제' : '확인'}
            </ConfirmBtn>
          </ConfirmActions>
        </ConfirmBox>
      </ConfirmOverlay>
    )}
  </AnimatePresence>
);

const TaskTable = ({ tasks, divisionColors, onDelete, onEdit, onView }) => {
  const handleRowClick = (task) => { if (onView) onView(task); };

  const [expanded, setExpanded] = useState(false);
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'gantt'
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [filters, setFilters] = useState({});
  const [ganttExpanded, setGanttExpanded] = useState(new Set());

  const handleDeleteClick = (task) => setDeleteTarget(task);
  const handleDeleteCancel = () => setDeleteTarget(null);
  const handleDeleteConfirm = () => {
    if (deleteTarget) onDelete(deleteTarget.id);
    setDeleteTarget(null);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => {
      const next = { ...prev };
      if (value == null || (Array.isArray(value) && value.length === 0) || (typeof value === 'string' && value === '')) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  };

  const resetAll = () => {
    setFilters({});
    setSortConfig({ key: null, direction: 'asc' });
  };

  // 현재 정렬/필터된 과제 데이터를 다중 시트 Excel로 로컬 저장
  const handleExportExcel = () => {
    const tasksToExport = displayedItems.map(d => d.task);
    if (tasksToExport.length === 0) return;
    const wb = XLSX.utils.book_new();
    const today = todayLocalYmd();
    const filterSuffix = hasActiveFilters ? '_필터됨' : '';

    const headerStyle = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '4F46E5' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: {
        top: { style: 'thin', color: { rgb: 'C7D2FE' } },
        bottom: { style: 'thin', color: { rgb: 'C7D2FE' } },
        left: { style: 'thin', color: { rgb: 'C7D2FE' } },
        right: { style: 'thin', color: { rgb: 'C7D2FE' } },
      },
    };
    const applyHeaderStyle = (ws) => {
      if (!ws['!ref']) return;
      const range = XLSX.utils.decode_range(ws['!ref']);
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r: 0, c });
        if (ws[addr]) ws[addr].s = headerStyle;
      }
      ws['!freeze'] = { xSplit: 0, ySplit: 1 };
    };
    const appendSheet = (rows, cols, name) => {
      if (!rows || rows.length === 0) return;
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = cols;
      applyHeaderStyle(ws);
      XLSX.utils.book_append_sheet(wb, ws, name);
    };

    // 1) 과제
    appendSheet(
      tasksToExport.map((t, idx) => ({
        'No.': idx + 1,
        '식별ID': t.식별ID || '',
        '과제명': t.과제명 || '',
        '사업부': (t.사업부 || []).join(', '),
        '법인': (t.법인 || []).join(', '),
        '라인/제품': (t['라인/제품'] || []).join(', '),
        '생성일': t.createdAt ? String(t.createdAt).slice(0, 10) : '',
        '수정일': t.updatedAt ? String(t.updatedAt).slice(0, 10) : '',
        'uuid': t.uuid || '',
      })),
      [{ wch: 5 }, { wch: 12 }, { wch: 36 }, { wch: 18 }, { wch: 24 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 38 }],
      '과제'
    );

    // 2) 대분류 액티비티
    const catRows = [];
    tasksToExport.forEach(t => (t.대분류액티비티 || []).forEach(c => {
      catRows.push({
        '식별ID': t.식별ID || '',
        '과제명': t.과제명 || '',
        'categoryId': c.categoryId || '',
        '대분류명': c.categoryName || '',
        '시작일': c.시작일 || '',
        '종료 계획일': c.목표일 || '',
        '완료일': c.완료일 || '',
      });
    }));
    appendSheet(catRows,
      [{ wch: 12 }, { wch: 30 }, { wch: 16 }, { wch: 22 }, { wch: 12 }, { wch: 14 }, { wch: 12 }],
      '대분류 액티비티'
    );

    // 3) 중분류 액티비티 (분석액티비티)
    const subRows = [];
    tasksToExport.forEach(t => (t.분석액티비티 || []).forEach(s => {
      subRows.push({
        '식별ID': t.식별ID || '',
        '과제명': t.과제명 || '',
        'categoryId': s.categoryId || '',
        'subcategoryId': s.subcategoryId || '',
        '중분류명': s.subcategoryName || '',
        '상태': s.상태 || '',
        '진행률(%)': s.진행률 ?? '',
        '완료일': s.완료일 || '',
        '주관부서': s.주관부서 || '',
        '활용솔루션': s.활용솔루션 || '',
        '상세내용': s.상세내용 || '',
      });
    }));
    appendSheet(subRows,
      [{ wch: 12 }, { wch: 30 }, { wch: 16 }, { wch: 16 }, { wch: 24 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 50 }],
      '중분류 액티비티'
    );

    // 4) 기대 효과
    const effRows = [];
    tasksToExport.forEach(t => (t.대분류액티비티 || []).forEach(c => {
      (c.기대효과 || []).forEach(eff => {
        effRows.push({
          '식별ID': t.식별ID || '',
          '과제명': t.과제명 || '',
          '대분류명': c.categoryName || '',
          'effectId': eff.id || '',
          '기대효과명': eff.기대효과명 || '',
          '효과 대분류': eff.대분류 || '',
          '효과 소분류': eff.소분류 || '',
          '단위': eff.단위 || '',
          '현재': eff.현재 || '',
          '목표': eff.목표 || '',
          '실적': eff.실적 || '',
          '상세설명': eff.상세설명 || '',
        });
      });
    }));
    appendSheet(effRows,
      [{ wch: 12 }, { wch: 30 }, { wch: 22 }, { wch: 14 }, { wch: 26 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 40 }],
      '기대 효과'
    );

    // 5) 담당자
    const persRows = [];
    tasksToExport.forEach(t => (t.분석액티비티 || []).forEach(s => {
      (s.담당자목록 || []).forEach(p => {
        persRows.push({
          '식별ID': t.식별ID || '',
          '과제명': t.과제명 || '',
          '중분류명': s.subcategoryName || '',
          '이름': p.이름 || '',
          'knoxID': p.knoxId || '',
          '부서': p.부서 || '',
          '사업부': p.사업부 || '',
          'PL': p.isPL ? 'O' : '',
        });
      });
    }));
    appendSheet(persRows,
      [{ wch: 12 }, { wch: 30 }, { wch: 24 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 6 }],
      '담당자'
    );

    // 6) 산출물 (메타데이터)
    const fileRows = [];
    tasksToExport.forEach(t => (t.대분류액티비티 || []).forEach(c => {
      (c.산출물 || []).forEach(f => {
        fileRows.push({
          '식별ID': t.식별ID || '',
          '과제명': t.과제명 || '',
          '대분류명': c.categoryName || '',
          '파일명': f.name || f.fileName || '',
          '크기(bytes)': f.size ?? '',
          '타입': f.type || '',
        });
      });
    }));
    appendSheet(fileRows,
      [{ wch: 12 }, { wch: 30 }, { wch: 22 }, { wch: 36 }, { wch: 14 }, { wch: 22 }],
      '산출물'
    );

    XLSX.writeFile(wb, `과제목록_${today}${filterSuffix}.xlsx`);
  };

  // 필터 선택지 (전체 tasks 기준, 항상 동일하게 표시)
  const filterOptions = useMemo(() => {
    const div = new Set();
    const corp = new Set();
    const lp = new Set();
    const cat = new Set();
    const sub = new Set();
    tasks.forEach(t => {
      (t.사업부 || []).forEach(v => v && div.add(v));
      (t.법인 || []).forEach(v => v && corp.add(v));
      (t['라인/제품'] || []).forEach(v => v && lp.add(v));
      (t.대분류액티비티 || []).forEach(c => c.categoryName && cat.add(c.categoryName));
      (t.분석액티비티 || []).forEach(s => s.subcategoryName && sub.add(s.subcategoryName));
    });
    const sortAsc = (arr) => arr.sort((a, b) => a.localeCompare(b, 'ko'));
    return {
      '상태': ALL_STATUSES,
      '사업부': sortAsc(Array.from(div)),
      '법인': sortAsc(Array.from(corp)),
      '라인/제품': sortAsc(Array.from(lp)),
      '대분류': sortAsc(Array.from(cat)),
      '중분류': sortAsc(Array.from(sub)),
    };
  }, [tasks]);

  // 필터링 + 정렬된 표시 대상
  const displayedItems = useMemo(() => {
    const withGroups = tasks.map(t => ({ task: t, groups: groupActivities(t) }));
    const filtered = withGroups.filter(({ task, groups }) => {
      for (const [key, value] of Object.entries(filters)) {
        if (!taskMatchesFilter(task, key, value, groups)) return false;
      }
      return true;
    });
    if (sortConfig.key) {
      const dir = sortConfig.direction === 'asc' ? 1 : -1;
      filtered.sort((a, b) => {
        const va = getSortValue(a.task, sortConfig.key, a.groups);
        const vb = getSortValue(b.task, sortConfig.key, b.groups);
        if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
        const sa = String(va);
        const sb = String(vb);
        if (sa < sb) return -1 * dir;
        if (sa > sb) return 1 * dir;
        return 0;
      });
    }
    return filtered;
  }, [tasks, filters, sortConfig]);

  const hasActiveFilters = Object.keys(filters).length > 0 || sortConfig.key != null;

  // 간트 전체 펼침 상태
  const ganttExpandableIds = useMemo(
    () => displayedItems.filter(d => d.groups.length > 0).map(d => d.task.id),
    [displayedItems]
  );
  const ganttIsAllExpanded = ganttExpandableIds.length > 0
    && ganttExpandableIds.every(id => ganttExpanded.has(id));
  const handleToggleGanttAll = () => {
    if (ganttIsAllExpanded) setGanttExpanded(new Set());
    else setGanttExpanded(new Set(ganttExpandableIds));
  };

  if (tasks.length === 0) {
    return (
      <Wrapper>
        <EmptyState>
          <FolderOpen size={48} strokeWidth={1.2} />
          <span>등록된 과제가 없습니다.</span>
          <p>헤더의 "새 과제 추가" 버튼을 눌러 과제를 추가하세요.</p>
        </EmptyState>
      </Wrapper>
    );
  }

  // 정렬/필터 적용된 표시 대상
  const taskGroups = displayedItems;

  return (
    <>
    <Wrapper>
      <TableHeader>
        <TitleRow>
          <Title>
            과제 목록
            <Count>
              {hasActiveFilters
                ? `(${displayedItems.length}건 / 전체 ${tasks.length}건)`
                : `(${tasks.length}건)`}
            </Count>
          </Title>
          {hasActiveFilters && (
            <ExpandToggleBtn type="button" onClick={resetAll} style={{ marginLeft: 8 }} title="정렬/필터 모두 초기화">
              <RotateCcw size={12} /> 초기화
            </ExpandToggleBtn>
          )}
        </TitleRow>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <SaveBtn
            type="button"
            onClick={handleExportExcel}
            disabled={displayedItems.length === 0}
            title={hasActiveFilters
              ? `현재 필터/정렬 결과(${displayedItems.length}건)를 Excel(.xlsx)로 저장`
              : '전체 과제 데이터를 Excel(.xlsx)로 저장'}
          >
            <Download size={13} /> 로컬 저장{hasActiveFilters ? ` (${displayedItems.length})` : ''}
          </SaveBtn>
          {viewMode === 'table' && (
            <ExpandToggleBtn onClick={() => setExpanded(prev => !prev)}>
              {expanded ? <ChevronsDownUp size={14} /> : <ChevronsUpDown size={14} />}
              {expanded ? '접기' : '펼치기'}
            </ExpandToggleBtn>
          )}
          {viewMode === 'gantt' && (
            <ExpandToggleBtn
              onClick={handleToggleGanttAll}
              disabled={ganttExpandableIds.length === 0}
              style={ganttExpandableIds.length === 0 ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
            >
              {ganttIsAllExpanded ? <ChevronsDownUp size={14} /> : <ChevronsUpDown size={14} />}
              {ganttIsAllExpanded ? '전체 접기' : '전체 펼치기'}
            </ExpandToggleBtn>
          )}
          <ViewToggleWrap>
            <ViewToggleBtn $active={viewMode === 'table'} onClick={() => setViewMode('table')}>
              <Table2 size={14} /> 테이블
            </ViewToggleBtn>
            <ViewToggleBtn $active={viewMode === 'gantt'} onClick={() => setViewMode('gantt')}>
              <GanttChart size={14} /> 간트
            </ViewToggleBtn>
          </ViewToggleWrap>
        </div>
      </TableHeader>

      {viewMode === 'gantt' ? (
        <TaskGanttView
          tasks={displayedItems.map(d => d.task)}
          divisionColors={divisionColors}
          expandedTasks={ganttExpanded}
          onExpandedChange={setGanttExpanded}
        />
      ) : (
      <TableContainer>
        <StyledTable $expanded={expanded}>
          <Thead>
            <ThRow>
              <Th rowSpan={2} style={{ width: '72px', minWidth: '72px' }}></Th>
              <Th rowSpan={2} style={{ width: '44px', minWidth: '44px' }}>No.</Th>
              <Th rowSpan={2} style={{ width: '80px', minWidth: '80px' }}>
                <ColumnHeader label="식별 ID" columnKey="식별ID" filterType="text"
                  sortConfig={sortConfig} filters={filters}
                  onSort={setSortConfig} onFilter={handleFilterChange} />
              </Th>
              <Th rowSpan={2} style={{ width: expanded ? '200px' : '20%', minWidth: '160px' }}>
                <ColumnHeader label="과제명" columnKey="과제명" filterType="text"
                  sortConfig={sortConfig} filters={filters}
                  onSort={setSortConfig} onFilter={handleFilterChange} />
              </Th>
              <Th rowSpan={2} style={{ width: '80px', minWidth: '80px' }}>
                <ColumnHeader label="상태" columnKey="상태" filterType="select" filterOptions={filterOptions['상태']}
                  sortConfig={sortConfig} filters={filters}
                  onSort={setSortConfig} onFilter={handleFilterChange} />
              </Th>
              <Th rowSpan={2} style={{ width: expanded ? '120px' : '100px', minWidth: '100px' }}>
                <ColumnHeader label="사업부" columnKey="사업부" filterType="select" filterOptions={filterOptions['사업부']}
                  sortConfig={sortConfig} filters={filters}
                  onSort={setSortConfig} onFilter={handleFilterChange} />
              </Th>
              <Th rowSpan={2} style={{ width: expanded ? '240px' : '140px', minWidth: '140px' }}>
                <ColumnHeader label="법인" columnKey="법인" filterType="select" filterOptions={filterOptions['법인']}
                  sortConfig={sortConfig} filters={filters}
                  onSort={setSortConfig} onFilter={handleFilterChange} />
              </Th>
              <Th rowSpan={2} style={{ width: expanded ? '160px' : '120px', minWidth: '110px' }}>
                <ColumnHeader label="라인/제품" columnKey="라인/제품" filterType="select" filterOptions={filterOptions['라인/제품']}
                  sortConfig={sortConfig} filters={filters}
                  onSort={setSortConfig} onFilter={handleFilterChange} />
              </Th>
              <Th rowSpan={2} style={{ width: expanded ? '140px' : '18%', minWidth: '120px' }}>
                <ColumnHeader label="대분류" columnKey="대분류" filterType="select" filterOptions={filterOptions['대분류']}
                  sortConfig={sortConfig} filters={filters}
                  onSort={setSortConfig} onFilter={handleFilterChange} />
              </Th>
              {expanded && (
                <>
                  <Th rowSpan={2} style={{ width: '96px', minWidth: '96px' }}>시작일</Th>
                  <Th rowSpan={2} style={{ width: '96px', minWidth: '96px' }}>종료 계획일</Th>
                  <Th rowSpan={2} style={{ width: '96px', minWidth: '96px' }}>완료일</Th>
                  <Th rowSpan={2} style={{ width: '72px', minWidth: '72px' }}>진행률</Th>
                </>
              )}
              <Th rowSpan={2} style={{ width: expanded ? '160px' : '22%', minWidth: '130px' }}>
                <ColumnHeader label="중분류" columnKey="중분류" filterType="select" filterOptions={filterOptions['중분류']}
                  sortConfig={sortConfig} filters={filters}
                  onSort={setSortConfig} onFilter={handleFilterChange} />
              </Th>
              {expanded && (
                <>
                  <Th rowSpan={2} style={{ width: '80px', minWidth: '80px' }}>상태</Th>
                  <Th rowSpan={2} style={{ width: '72px', minWidth: '72px' }}>진행률</Th>
                  <Th rowSpan={2} style={{ width: '96px', minWidth: '96px' }}>완료일</Th>
                  <Th rowSpan={2} style={{ width: '100px', minWidth: '100px' }}>주관부서</Th>
                  <Th rowSpan={2} style={{ width: '110px', minWidth: '110px' }}>활용솔루션</Th>
                  <Th rowSpan={2} style={{ width: '130px', minWidth: '130px' }}>담당자</Th>
                </>
              )}
            </ThRow>
          </Thead>
          <Tbody>
            {taskGroups.length === 0 ? (
              <tr>
                <td colSpan={expanded ? 20 : 10} style={{ textAlign: 'center', padding: '48px 20px', color: '#94a3b8', fontSize: '0.85rem' }}>
                  필터 조건에 맞는 과제가 없습니다.
                </td>
              </tr>
            ) : taskGroups.map(({ task, groups }, taskIdx) => {
              // 접기 모드: 과제당 1행, 법인/대분류/중분류는 개수만 표시
              if (!expanded) {
                const corpCount = (task.법인 || []).length;
                const catCount = groups.length;
                const subCount = groups.reduce((sum, g) => sum + (g.subcategories || []).length, 0);

                return (
                  <Tr key={task.id} style={{ borderTop: '2px solid #e2e8f0' }} onClick={() => handleRowClick(task)} title="과제 상세 보기">
                    <Td style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                      <ActionGroup>
                        <EditBtn onClick={(e) => { e.stopPropagation(); onEdit && onEdit(task); }} title="수정">
                          <Pencil size={14} />
                        </EditBtn>
                        <DeleteBtn onClick={(e) => { e.stopPropagation(); handleDeleteClick(task); }} title="삭제">
                          <Trash2 size={14} />
                        </DeleteBtn>
                      </ActionGroup>
                    </Td>
                    <Td style={{ verticalAlign: 'middle' }}>{taskIdx + 1}</Td>
                    <Td style={{ verticalAlign: 'middle', fontSize: '0.78rem' }}>
                      {task.식별ID ? (
                        <TaskIdLink type="button" onClick={(e) => { e.stopPropagation(); onEdit && onEdit(task); }} title="과제 수정">
                          {task.식별ID}
                        </TaskIdLink>
                      ) : <NoText>-</NoText>}
                    </Td>
                    <Td style={{ verticalAlign: 'middle', fontWeight: 600 }}>{task.과제명}</Td>
                    <Td style={{ verticalAlign: 'middle' }}>
                      {(() => { const ts = calcTaskStatus(groups); return (
                        <StatusBadge $s={ts.status}>{ts.status}{(ts.status === '진행' || ts.status === '지연') && ` ${ts.progress}%`}</StatusBadge>
                      ); })()}
                    </Td>
                    <Td style={{ verticalAlign: 'middle' }}>
                      {(task.사업부 || []).length > 0 ? (
                        <TagGroup>{task.사업부.map(n => <DivisionTag key={n} $color={divisionColors[n]}>{n}</DivisionTag>)}</TagGroup>
                      ) : <NoText>-</NoText>}
                    </Td>
                    <Td style={{ verticalAlign: 'middle' }}>
                      {corpCount > 0 ? (
                        <CountBadge $color="#065f46" $bg="#ecfdf5" $border="#a7f3d0">{corpCount}개</CountBadge>
                      ) : <NoText>-</NoText>}
                    </Td>
                    <Td style={{ verticalAlign: 'middle' }}>
                      {Array.isArray(task['라인/제품']) && task['라인/제품'].length > 0 ? (
                        <TagGroup>{task['라인/제품'].map(n => <LpTag key={n}>{n}</LpTag>)}</TagGroup>
                      ) : <NoText>-</NoText>}
                    </Td>
                    <Td style={{ verticalAlign: 'middle' }}>
                      {catCount > 0 ? (
                        <CountBadge $color="#4f46e5" $bg="#eef2ff" $border="#c7d2fe">{catCount}개</CountBadge>
                      ) : <NoText>-</NoText>}
                    </Td>
                    <Td style={{ verticalAlign: 'middle' }}>
                      {subCount > 0 ? (
                        <CountBadge $color="#1e293b" $bg="#f1f5f9" $border="#e2e8f0">{subCount}개</CountBadge>
                      ) : <NoText>-</NoText>}
                    </Td>
                  </Tr>
                );
              }

              // 펼치기 모드: 기존 다중 행 로직
              const rows = [];
              if (groups.length === 0) {
                rows.push({ cat: null, sub: null });
              } else {
                groups.forEach(cat => {
                  if (cat.subcategories.length === 0) {
                    rows.push({ cat, sub: null });
                  } else {
                    cat.subcategories.forEach((sub, si) => {
                      rows.push({ cat, sub, isFirstSub: si === 0, subCount: cat.subcategories.length });
                    });
                  }
                });
              }

              // 대분류별 첫 행 인덱스 계산
              let catFirstRows = {};
              let catRowCounts = {};
              rows.forEach((r, i) => {
                if (r.cat) {
                  const cid = r.cat.categoryId;
                  if (!(cid in catFirstRows)) catFirstRows[cid] = i;
                  catRowCounts[cid] = (catRowCounts[cid] || 0) + 1;
                }
              });

              const totalRowSpan = rows.length;

              return rows.map((row, ri) => {
                const isFirstRow = ri === 0;
                const isCatFirst = row.cat && catFirstRows[row.cat.categoryId] === ri;
                const catRowSpan = row.cat ? catRowCounts[row.cat.categoryId] : 1;
                const catProgress = row.cat ? calcCatProgress(row.cat) : 0;

                return (
                  <Tr key={`${task.id}-${ri}`} style={isFirstRow ? { borderTop: '2px solid #e2e8f0' } : undefined} onClick={() => handleRowClick(task)} title="과제 상세 보기">
                    {isFirstRow && (
                      <>
                        <Td rowSpan={totalRowSpan} style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                          <ActionGroup>
                            <EditBtn onClick={(e) => { e.stopPropagation(); onEdit && onEdit(task); }} title="수정">
                              <Pencil size={14} />
                            </EditBtn>
                            <DeleteBtn onClick={(e) => { e.stopPropagation(); handleDeleteClick(task); }} title="삭제">
                              <Trash2 size={14} />
                            </DeleteBtn>
                          </ActionGroup>
                        </Td>
                        <Td rowSpan={totalRowSpan} style={{ verticalAlign: 'middle' }}>{taskIdx + 1}</Td>
                        <Td rowSpan={totalRowSpan} style={{ verticalAlign: 'middle', fontSize: '0.78rem' }}>
                          {task.식별ID ? (
                            <TaskIdLink type="button" onClick={(e) => { e.stopPropagation(); onEdit && onEdit(task); }} title="과제 수정">
                              {task.식별ID}
                            </TaskIdLink>
                          ) : <NoText>-</NoText>}
                        </Td>
                        <Td rowSpan={totalRowSpan} style={{ verticalAlign: 'middle', fontWeight: 600 }}>{task.과제명}</Td>
                        <Td rowSpan={totalRowSpan} style={{ verticalAlign: 'middle' }}>
                          {(() => { const ts = calcTaskStatus(groups); return (
                            <StatusBadge $s={ts.status}>{ts.status}{(ts.status === '진행' || ts.status === '지연') && ` ${ts.progress}%`}</StatusBadge>
                          ); })()}
                        </Td>
                        <Td rowSpan={totalRowSpan} style={{ verticalAlign: 'middle' }}>
                          {(task.사업부 || []).length > 0 ? (
                            <TagGroup>{task.사업부.map(n => <DivisionTag key={n} $color={divisionColors[n]}>{n}</DivisionTag>)}</TagGroup>
                          ) : <NoText>-</NoText>}
                        </Td>
                        <Td rowSpan={totalRowSpan} style={{ verticalAlign: 'middle' }}>
                          {(task.법인 || []).length > 0 ? (
                            <TagGroup>{task.법인.map(n => <CorpTag key={n}>{n}</CorpTag>)}</TagGroup>
                          ) : <NoText>-</NoText>}
                        </Td>
                        <Td rowSpan={totalRowSpan} style={{ verticalAlign: 'middle' }}>
                          {Array.isArray(task['라인/제품']) && task['라인/제품'].length > 0 ? (
                            <TagGroup>{task['라인/제품'].map(n => <LpTag key={n}>{n}</LpTag>)}</TagGroup>
                          ) : <NoText>-</NoText>}
                        </Td>
                      </>
                    )}

                    {/* 대분류 */}
                    {isCatFirst && (
                      <>
                        <Td rowSpan={catRowSpan}>
                          <CatNameCell>{row.cat.categoryName}</CatNameCell>
                        </Td>
                        <Td rowSpan={catRowSpan}>{row.cat.시작일 || <NoText>-</NoText>}</Td>
                        <Td rowSpan={catRowSpan}>{row.cat.목표일 || <NoText>-</NoText>}</Td>
                        <Td rowSpan={catRowSpan}>{row.cat.완료일 || <NoText>-</NoText>}</Td>
                        <Td rowSpan={catRowSpan}>
                          <ProgressBar>
                            <ProgressLabel $v={catProgress}>{catProgress}%</ProgressLabel>
                            <ProgressTrack><ProgressFill style={{ width: `${catProgress}%` }} $v={catProgress} /></ProgressTrack>
                          </ProgressBar>
                        </Td>
                      </>
                    )}
                    {!row.cat && isFirstRow && (
                      <>
                        <Td><NoText>-</NoText></Td>
                        <Td><NoText>-</NoText></Td><Td><NoText>-</NoText></Td><Td><NoText>-</NoText></Td><Td><NoText>-</NoText></Td>
                      </>
                    )}

                    {/* 중분류 */}
                    {row.sub ? (
                      <>
                        <Td><SubNameCell>{row.sub.subcategoryName}</SubNameCell></Td>
                        <Td>
                          <StatusBadge $s={row.sub.상태}>
                            {row.sub.상태 || '계획'}
                            {row.sub.상태 === '진행' && ` ${row.sub.진행률 ?? 0}%`}
                          </StatusBadge>
                        </Td>
                        <Td>
                          {(() => {
                            const v = row.sub.상태 === '완료' ? 100 : row.sub.상태 === '진행' ? (row.sub.진행률 ?? 0) : 0;
                            return (
                              <ProgressBar>
                                <ProgressLabel $v={v}>{v}%</ProgressLabel>
                                <ProgressTrack><ProgressFill style={{ width: `${v}%` }} $v={v} /></ProgressTrack>
                              </ProgressBar>
                            );
                          })()}
                        </Td>
                        <Td>{row.sub.완료일 || <NoText>-</NoText>}</Td>
                        <Td>{row.sub.주관부서 || <NoText>-</NoText>}</Td>
                        <Td>{row.sub.활용솔루션 || <NoText>-</NoText>}</Td>
                        <Td>
                          {(row.sub.담당자목록 || []).length > 0 ? (
                            <PersonnelChips>
                              {row.sub.담당자목록.map((p, pi) => (
                                <PersonnelChip key={pi}>
                                  {p.이름}{p.knoxId ? ` (${p.knoxId})` : ''}
                                </PersonnelChip>
                              ))}
                            </PersonnelChips>
                          ) : <NoText>-</NoText>}
                        </Td>
                      </>
                    ) : (
                      <>
                        <Td><NoText>-</NoText></Td>
                        <Td><NoText>-</NoText></Td><Td><NoText>-</NoText></Td><Td><NoText>-</NoText></Td><Td><NoText>-</NoText></Td><Td><NoText>-</NoText></Td><Td><NoText>-</NoText></Td>
                      </>
                    )}

                  </Tr>
                );
              });
            })}
          </Tbody>
        </StyledTable>
      </TableContainer>
      )}
    </Wrapper>
    <ConfirmModal
      open={!!deleteTarget}
      title="과제 삭제"
      message={deleteTarget ? `"${deleteTarget.과제명}" 과제를 삭제하시겠습니까?\n입력된 데이터가 모두 삭제됩니다.` : ''}
      variant="danger"
      onConfirm={handleDeleteConfirm}
      onCancel={handleDeleteCancel}
    />
    </>
  );
};

export default TaskTable;
