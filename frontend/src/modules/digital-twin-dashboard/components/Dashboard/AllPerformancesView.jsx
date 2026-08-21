import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { evalFactor } from '../../utils/evalFactor';
import { sortDivisionNames } from '../../utils/divisionOrder';
// 수준값의 0 과 미입력은 다른 뜻이다. 판정은 한 곳(levelValue)으로 모은다.
import { hasLevel, levelText } from '../../utils/levelValue';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, ChevronDown, ChevronRight, Search, Link2, FileText, FolderOpen, Folder, Building2, List, LayoutGrid, ChevronsUpDown, ChevronsDownUp, Download, Table, Pencil, FileSpreadsheet, X, Plus, Trash2, Briefcase, Calendar, Filter, Check, BarChart3, RotateCcw, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { fetchKPIDashboardCards, fetchDeletedPerformances, restorePerformanceV2, permanentDeletePerformanceV2 } from '../../services/settingsApi';
import { todayLocalYmd } from '../../../../shared/utils/localDate';

// 성과항목명에서 사업부 추출 헬퍼 함수
const extractDivisionFromPerformance = (performanceName) => {
  const match = (performanceName || '').match(/^\[(.+?)\]\s*(.*)$/);
  if (match) {
    return {
      division: match[1],
      name: match[2]
    };
  }
  return {
    division: '미분류',
    name: performanceName || ''
  };
};

// 카테고리 정렬 헬퍼 함수 ('기타'가 항상 마지막에 오도록)
const sortWithEtcLast = (a, b) => {
  // '기타'는 항상 마지막으로
  if (a === '기타') return 1;
  if (b === '기타') return -1;
  // 그 외에는 알파벳 순서
  return a.localeCompare(b);
};

// 숫자를 소수점 최대 2자리로 포맷팅 (불필요한 0 제거)
const formatNumber = (value) => {
  if (value === undefined || value === null || value === '') return value;
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  // 소수점 2자리까지 반올림 후 불필요한 0 제거
  return parseFloat(num.toFixed(2));
};

// 차이값 계산 및 포맷팅 (소수점 2자리)
const formatDiff = (diff) => {
  if (diff === 0) return 0;
  return parseFloat(diff.toFixed(2));
};

const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: #f8fafc;
  overflow: hidden;
`;

const LoadingOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(248, 250, 252, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 100;
`;

const LoadingSpinner = styled.div`
  width: 48px;
  height: 48px;
  border: 4px solid #e2e8f0;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 1s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const LoadingText = styled.div`
  margin-top: 1rem;
  font-size: 0.9rem;
  color: #64748b;
  font-weight: 500;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background: white;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const Title = styled.h1`
  font-size: 1.5rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  svg {
    color: #6366f1;
  }
`;

const StatsContainer = styled.div`
  display: flex;
  gap: 1rem;
  margin-left: 1rem;
`;

const StatBadge = styled.span`
  padding: 0.375rem 0.75rem;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.8rem;
  color: #64748b;

  strong {
    color: #1e293b;
    font-weight: 600;
  }
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;




/* ── 성과 휴지통 ────────────────────────────────────────────────────────────
   과제 휴지통(AllProjectsView)과 같은 모양을 쓴다. 다른 점 하나 — **완전 삭제가
   없다.** 성과에는 영구삭제 개념 자체가 없다(dt2_performances 에
   `is_permanently_deleted` 컬럼이 없다). 그래서 버튼도 '복구' 하나뿐이다. */
const TrashButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: ${props => props.$active ? '#ef4444' : '#f1f5f9'};
  color: ${props => props.$active ? 'white' : '#64748b'};
  border: 1px solid ${props => props.$active ? '#ef4444' : '#e2e8f0'};
  border-radius: 0.5rem;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.$active ? '#dc2626' : '#e2e8f0'};
    border-color: ${props => props.$active ? '#dc2626' : '#cbd5e1'};
  }
`;

const TrashBadge = styled.span`
  background: ${props => props.$active ? 'rgba(255,255,255,0.2)' : '#ef4444'};
  color: white;
  font-size: 0.7rem;
  padding: 0.125rem 0.375rem;
  border-radius: 9999px;
  min-width: 18px;
  text-align: center;
`;

const TrashPanel = styled.div`
  padding: 1rem 1.5rem 2rem;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
`;

const TrashNotice = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.5rem;
  color: #991b1b;
  font-size: 0.8rem;
  line-height: 1.5;
`;

const TrashFilterBar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
`;

const TrashSearchBox = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.7rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  background: white;
  flex: 1;
  min-width: 200px;

  input {
    border: none;
    outline: none;
    font-size: 0.8rem;
    width: 100%;
    background: transparent;
  }
`;

const TrashSelect = styled.select`
  padding: 0.4rem 0.7rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  background: white;
  font-size: 0.8rem;
  color: #334155;
  cursor: pointer;
`;

const TrashCount = styled.span`
  font-size: 0.78rem;
  color: #64748b;
  white-space: nowrap;
`;

const DangerButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.4rem 0.8rem;
  border: none;
  border-radius: 0.375rem;
  background: #ef4444;
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;

  &:hover { background: #dc2626; }
  &:disabled { background: #94a3b8; cursor: not-allowed; }
`;

const TrashRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  background: white;
  margin-bottom: 0.5rem;

  &:hover { border-color: #cbd5e1; }
`;

const TrashRowMain = styled.div`
  flex: 1;
  min-width: 0;
`;

const TrashRowTitle = styled.div`
  font-size: 0.875rem;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 0.2rem;
  word-break: break-word;
`;

const TrashRowMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  font-size: 0.72rem;
  color: #64748b;
`;

const RestoreButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.4rem 0.8rem;
  border: none;
  border-radius: 0.375rem;
  background: #10b981;
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;

  &:hover { background: #059669; }
  &:disabled { background: #94a3b8; cursor: not-allowed; }
`;

const ExportButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: linear-gradient(135deg, #059669 0%, #047857 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  }

  &:active {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;

const SearchBox = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  transition: all 0.2s ease;

  &:focus-within {
    background: white;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }
`;

const SearchInput = styled.input`
  border: none;
  background: transparent;
  outline: none;
  font-size: 0.875rem;
  color: #1e293b;
  width: 200px;
  max-width: 26vw;

  &::placeholder {
    color: #94a3b8;
  }
`;

// 헤더 툴바 묶음 - 상위 헤더로 포털될 때 한 덩어리로 이동
const ToolbarGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  justify-content: flex-end;
  opacity: ${p => (p.$disabled ? 0.5 : 1)};
  pointer-events: ${p => (p.$disabled ? 'none' : 'auto')};
  transition: opacity 0.2s ease;
`;

const YearSelector = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: white;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid #e2e8f0;
`;

const YearButton = styled.button`
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #475569;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #e2e8f0;
  }
`;

const YearDisplay = styled.div`
  font-size: 1rem;
  font-weight: 700;
  color: #1e293b;
  min-width: 60px;
  text-align: center;
`;

const FilterBar = styled.div`
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem 2rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
  flex-wrap: wrap;
`;

const FilterButton = styled.button`
  padding: 0.5rem 1rem;
  background: ${props => props.$active ? '#6366f1' : 'white'};
  color: ${props => props.$active ? 'white' : '#64748b'};
  border: 1px solid ${props => props.$active ? '#6366f1' : '#e2e8f0'};
  border-radius: 0.5rem;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &:hover {
    background: ${props => props.$active ? '#4f46e5' : '#f8fafc'};
    border-color: ${props => props.$active ? '#4f46e5' : '#cbd5e1'};
  }
`;

const FilterBadge = styled.span`
  padding: 0.125rem 0.375rem;
  background: ${props => props.$active ? 'rgba(255,255,255,0.3)' : '#e2e8f0'};
  border-radius: 0.25rem;
  font-size: 0.7rem;
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem 2rem;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 4px;
  }
`;























const EditButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-radius: 0.375rem;
  color: #d97706;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s ease;

  &:hover {
    background: #fde68a;
    color: #b45309;
    border-color: #fbbf24;
  }
`;














const EmptyMessage = styled.div`
  text-align: center;
  padding: 4rem 2rem;
  color: #94a3b8;

  svg {
    margin-bottom: 1rem;
    color: #cbd5e1;
  }

  h3 {
    font-size: 1.125rem;
    font-weight: 600;
    color: #64748b;
    margin-bottom: 0.5rem;
  }

  p {
    font-size: 0.875rem;
  }
`;

// 테이블 보기 스타일
const TableViewContainer = styled.div`
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  border: 1px solid #e2e8f0;
  overflow: auto;
  max-height: calc(100vh - 200px);
`;

const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
  table-layout: fixed;
`;

const TableHeader = styled.thead`
  background: #f8fafc;
  position: sticky;
  top: 0;
  z-index: 10;

  th {
    padding: 0.75rem 0.5rem;
    text-align: left;
    font-weight: 600;
    color: #475569;
    border-bottom: 2px solid #e2e8f0;
    white-space: nowrap;

    &:first-child {
      padding-left: 1rem;
    }

    &:last-child {
      padding-right: 1rem;
    }
  }
`;

const TableBody = styled.tbody`
  tr {
    border-bottom: 1px solid #f1f5f9;
    transition: background 0.15s ease;

    &:hover {
      background: #f8fafc;
    }

    &:last-child {
      border-bottom: none;
    }
  }

  td {
    padding: 0.625rem 0.5rem;
    color: #1e293b;
    vertical-align: middle;

    &:first-child {
      padding-left: 1rem;
    }

    &:last-child {
      padding-right: 1rem;
    }
  }
`;

const TableDivisionBadge = styled.span`
  display: inline-block;
  padding: 0.25rem 0.5rem;
  background: ${props => props.$color || '#64748b'};
  color: white;
  border-radius: 0.25rem;
  font-size: 0.7rem;
  font-weight: 600;
`;

const CategoryCell = styled.td`
  color: #64748b !important;
  font-size: 0.75rem;
`;

const ValueCell = styled.td`
  font-weight: 500;
  text-align: left;
  white-space: nowrap;
`;


const ProjectsCell = styled.td`
  .project-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .project-badge {
    display: block;
    padding: 0.2rem 0.5rem;
    background: #e0f2fe;
    color: #0369a1;
    border-radius: 0.25rem;
    font-size: 0.7rem;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .more-projects {
    color: #64748b;
    font-size: 0.7rem;
    padding: 0.125rem 0;
  }
`;

const NoProjectsText = styled.span`
  color: #94a3b8;
  font-size: 0.75rem;
`;

const SubtotalRow = styled.tr`
  background: ${props => props.$bgColor || '#f1f5f9'} !important;
  border-top: 2px solid ${props => props.$borderColor || '#94a3b8'} !important;

  &:hover {
    filter: brightness(0.95);
  }

  td {
    font-weight: 600;
    color: #334155;
    padding: 0.5rem 0.5rem;
  }
`;

const SubtotalLabel = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.2rem 0.5rem;
  background: ${props => props.$labelColor || '#475569'};
  color: white;
  border-radius: 0.25rem;
  font-size: 0.7rem;
  font-weight: 600;
`;

const GroupedRow = styled.tr`
  background: ${props => props.$bgColor || 'white'};
  border-bottom: 1px solid ${props => props.$borderColor || '#f1f5f9'};
  transition: background 0.15s ease;

  &:hover {
    filter: brightness(0.97);
  }
`;

// 테이블 헤더 필터 스타일 컴포넌트
const FilterHeaderCell = styled.th`
  position: relative;
  cursor: pointer;
  user-select: none;

  &:hover {
    background: #f1f5f9;
  }
`;

const FilterHeaderContent = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem;
`;

const FilterIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 3px;
  background: ${props => props.$active ? '#6366f1' : 'transparent'};
  color: ${props => props.$active ? 'white' : '#94a3b8'};
  transition: all 0.15s ease;
  flex-shrink: 0;

  &:hover {
    background: ${props => props.$active ? '#4f46e5' : '#e2e8f0'};
    color: ${props => props.$active ? 'white' : '#64748b'};
  }
`;

const FilterDropdown = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  min-width: 180px;
  max-height: 280px;
  overflow-y: auto;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  z-index: 100;
  padding: 0.5rem 0;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f5f9;
  }

  &::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
  }
`;

const FilterOption = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: ${props => props.$selected ? '#eef2ff' : 'transparent'};
  border: none;
  text-align: left;
  font-size: 0.8rem;
  color: ${props => props.$selected ? '#4f46e5' : '#374151'};
  cursor: pointer;
  transition: all 0.1s ease;

  &:hover {
    background: ${props => props.$selected ? '#e0e7ff' : '#f8fafc'};
  }

  svg {
    flex-shrink: 0;
  }
`;

const FilterOptionCheck = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: 1.5px solid ${props => props.$checked ? '#6366f1' : '#d1d5db'};
  border-radius: 3px;
  background: ${props => props.$checked ? '#6366f1' : 'white'};
  color: white;
  font-size: 10px;
`;

const FilterDivider = styled.div`
  height: 1px;
  background: #e2e8f0;
  margin: 0.25rem 0;
`;

const ActiveFilterBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.375rem;
  background: #eef2ff;
  color: #4f46e5;
  border-radius: 0.25rem;
  font-size: 0.65rem;
  font-weight: 500;
  margin-left: 0.25rem;
`;

const FilterStatusBar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 1rem;
  background: #fef3c7;
  border: 1px solid #fbbf24;
  border-radius: 0.5rem;
  margin-bottom: 0.75rem;
  font-size: 0.8rem;
  color: #92400e;
`;

const FilterTag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.5rem;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  color: #374151;

  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    padding: 0;
    background: #ef4444;
    border: none;
    border-radius: 50%;
    color: white;
    cursor: pointer;
    font-size: 10px;
    line-height: 1;

    &:hover {
      background: #dc2626;
    }
  }
`;

const ClearAllFiltersButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  background: #dc2626;
  border: none;
  border-radius: 0.375rem;
  color: white;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  margin-left: auto;

  &:hover {
    background: #b91c1c;
  }
`;

const ActionItemsCell = styled.td`
  .action-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .action-badge {
    display: block;
    padding: 0.2rem 0.5rem;
    background: #fef2f2;
    color: #dc2626;
    border: 1px solid #fecaca;
    border-radius: 0.25rem;
    font-size: 0.7rem;
    font-weight: 500;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .more-actions {
    color: #dc2626;
    font-size: 0.7rem;
    font-weight: 500;
    padding: 0.125rem 0;
  }
`;

const NoActionText = styled.span`
  color: #10b981;
  font-size: 0.7rem;
  font-weight: 500;
`;

const ReportItemsCell = styled.td`
  .report-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .report-badge {
    display: block;
    padding: 0.2rem 0.5rem;
    background: #eff6ff;
    color: #2563eb;
    border: 1px solid #bfdbfe;
    border-radius: 0.25rem;
    font-size: 0.7rem;
    font-weight: 500;
    white-space: pre-wrap;
    word-break: break-word;
  }
`;

const NoReportText = styled.span`
  color: #94a3b8;
  font-size: 0.7rem;
  font-weight: 500;
`;

const KpiLinksCell = styled.td`
  .kpi-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .kpi-badge {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.2rem 0.5rem;
    background: #f5f3ff;
    color: #6d28d9;
    border: 1px solid #ddd6fe;
    border-radius: 0.25rem;
    font-size: 0.7rem;
    font-weight: 500;
    white-space: pre-wrap;
    word-break: break-word;

    svg {
      flex-shrink: 0;
      color: #7c3aed;
    }
  }
`;

const NoKpiLinksText = styled.span`
  color: #94a3b8;
  font-size: 0.7rem;
  font-weight: 500;
`;




















// 과제 링크 모달 스타일
const LinkModalOverlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 2rem;
`;

const LinkModalContainer = styled(motion.div)`
  background: white;
  border-radius: 1rem;
  width: 80vw;
  height: 80vh;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
`;

const LinkModalHeader = styled.div`
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  color: white;
  padding: 1.25rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
`;

const LinkModalTitle = styled.h2`
  font-size: 1.125rem;
  font-weight: 700;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const LinkModalCloseButton = styled.button`
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 0.5rem;
  color: white;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.3);
  }
`;

const LinkModalBody = styled.div`
  flex: 1;
  overflow: hidden;
  padding: 1.5rem;
  display: flex;
  gap: 1.5rem;
`;

const LinkModalSection = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;

  h4 {
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
    margin: 0 0 0.75rem 0;
    display: flex;
    align-items: center;
    flex-shrink: 0;
    gap: 0.5rem;
  }
`;

const LinkModalSearchInput = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  padding: 0.625rem 1rem;
  margin-bottom: 1rem;

  input {
    flex: 1;
    border: none;
    background: transparent;
    outline: none;
    font-size: 0.875rem;
    color: #1e293b;

    &::placeholder {
      color: #94a3b8;
    }
  }
`;

const LinkModalProjectList = styled.div`
  flex: 1;
  overflow-y: auto;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  background: #f8fafc;
`;

const LinkModalProjectItem = styled.div`
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e2e8f0;
  cursor: pointer;
  transition: background 0.15s ease;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: #e2e8f0;
  }

  .project-info {
    flex: 1;
    min-width: 0;

    .project-name {
      font-size: 0.875rem;
      font-weight: 500;
      color: #1e293b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .project-meta {
      font-size: 0.75rem;
      color: #64748b;
      margin-top: 0.25rem;
    }
  }

  .add-btn {
    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
    border: none;
    color: white;
    padding: 0.375rem 0.75rem;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    transition: all 0.2s ease;

    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
    }
  }
`;

const LinkModalLinkedSection = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  padding-left: 1.5rem;
  border-left: 1px solid #e2e8f0;
`;

const LinkModalLinkedItem = styled.div`
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  background: #f0fdf4;
  border: 1px solid #86efac;
  border-radius: 0.5rem;
  margin-bottom: 0.5rem;

  .project-info {
    flex: 1;
    min-width: 0;

    .project-name {
      font-size: 0.875rem;
      font-weight: 500;
      color: #166534;
    }

    .project-meta {
      font-size: 0.75rem;
      color: #16a34a;
      margin-top: 0.25rem;
    }
  }

  .contribution-input {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-right: 1rem;

    input {
      width: 60px;
      padding: 0.375rem 0.5rem;
      border: 1px solid #86efac;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      text-align: right;
      outline: none;

      &:focus {
        border-color: #22c55e;
        box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.2);
      }
    }

    span {
      font-size: 0.875rem;
      color: #16a34a;
    }
  }

  .remove-btn {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #dc2626;
    padding: 0.375rem;
    border-radius: 0.375rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;

    &:hover {
      background: #fee2e2;
    }
  }
`;

const LinkModalFooter = styled.div`
  padding: 1rem 1.5rem;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  flex-shrink: 0;
`;

const LinkModalButton = styled.button`
  padding: 0.625rem 1.25rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &.cancel {
    background: white;
    border: 1px solid #e2e8f0;
    color: #64748b;

    &:hover {
      background: #f1f5f9;
    }
  }

  &.save {
    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
    border: none;
    color: white;

    &:hover {
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
      transform: translateY(-1px);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }
  }
`;

const LinkButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  border-radius: 0.375rem;
  color: #6366f1;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s ease;

  &:hover {
    background: #e0e7ff;
    color: #4f46e5;
    border-color: #a5b4fc;
  }
`;

const AllPerformancesView = ({
  projects = [],
  globalPerformances = [],
  currentYear: propCurrentYear,
  onYearChange,
  isAdmin = false,
  onEditPerformance,
  onLinkProjectToPerformance,
  onEditProject,
  settingsData,
  // KPI 대시보드 안에 내장될 때: 자체 헤더 행을 만들지 않고
  // 통계 배지/툴바를 상위 헤더의 슬롯(DOM node)으로 포털한다
  embedded = false,
  statsSlot = null,
  toolbarSlot = null,
  // 성과를 복구한 뒤 상위가 서버 데이터를 다시 받도록 부른다.
  // 복구는 서버에서만 일어나므로 이걸 안 부르면 화면이 옛 목록 그대로다.
  onPerformanceRestored = null
}) => {
  const { user } = useAuth();
  // 로컬 저장 권한: Admin, Manager, DT Office만 허용
  const canExport = ['admin', 'manager', 'dt_office'].includes(user?.role) || user?.is_admin;
  const [currentYear, setCurrentYear] = useState(propCurrentYear || new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDivision, setSelectedDivision] = useState('all');
  const [isLoading, setIsLoading] = useState(true); // 로딩 상태

  // ── 성과 휴지통 ──────────────────────────────────────────────────────────
  // 삭제된 성과는 `globalPerformances` 에 없다 — `/data` 가 걸러 보내기 때문에
  // (assemble.py) **따로 불러와야 한다.** 과제 휴지통과 다른 점이 이것이다.
  const [showTrash, setShowTrash] = useState(false);
  const [deletedPerformances, setDeletedPerformances] = useState([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const [trashError, setTrashError] = useState('');
  const [restoringUuid, setRestoringUuid] = useState('');
  // 휴지통 전용 필터. 본 목록의 검색·연도와 **따로 둔다** — 휴지통은 다른 연도의
  // 잔재가 대부분이라(개발서버 638건) 본 화면 연도에 묶으면 아무것도 안 보인다.
  const [trashSearch, setTrashSearch] = useState('');
  const [trashYear, setTrashYear] = useState('all');

  // 내보내기 모달 상태
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportDivisionFilter, setExportDivisionFilter] = useState('all');
  const [exportLinkedFilter, setExportLinkedFilter] = useState('all'); // 'all' | 'linked'

  // 단위 환산 상태: { sourceUnit: conversionId } 형태로 단위별 독립 적용
  const [activeConversions, setActiveConversions] = useState({});
  const [conversionPanelOpen, setConversionPanelOpen] = useState(false);

  // 단위 환산 규칙 목록
  const unitConversions = useMemo(() => {
    return (settingsData?.unitConversions) || [];
  }, [settingsData]);

  // sourceUnit 기준으로 그룹화 (같은 원본 단위에 여러 환산 규칙이 있을 수 있음)
  const conversionsBySource = useMemo(() => {
    const map = {};
    unitConversions.forEach(conv => {
      const key = (conv.sourceUnit || '').toLowerCase();
      if (!map[key]) map[key] = [];
      map[key].push(conv);
    });
    return map;
  }, [unitConversions]);

  const toggleConversion = useCallback((conv) => {
    const srcKey = (conv.sourceUnit || '').toLowerCase();
    setActiveConversions(prev => {
      const next = { ...prev };
      if (next[srcKey] === conv.id) {
        delete next[srcKey]; // 토글 해제
      } else {
        next[srcKey] = conv.id; // 같은 단위의 다른 규칙 대체 또는 신규 적용
      }
      return next;
    });
  }, []);

  // 활성 환산 존재 여부
  const hasActiveConversion = Object.keys(activeConversions).length > 0;

  // 단위 환산 적용 헬퍼
  // 우선순위: 연도+사업부 → 연도기본 → 사업부기본 → 전체기본
  const applyConversion = useCallback((value, unit, division) => {
    if (!hasActiveConversion || !value || value === '') return { value, unit };
    const srcKey = (unit || '').toLowerCase();
    const convId = activeConversions[srcKey];
    if (!convId) return { value, unit };
    const conv = unitConversions.find(c => c.id === convId);
    if (!conv) return { value, unit };
    const numVal = parseFloat(value);
    if (isNaN(numVal)) return { value, unit };

    let rawFactor = conv.defaultFactor;
    const yearData = conv.yearOverrides?.[String(currentYear)];
    if (yearData) {
      rawFactor = yearData.divisionOverrides?.[division]?.factor ?? yearData.defaultFactor;
    } else {
      rawFactor = conv.divisionOverrides?.[division]?.factor ?? conv.defaultFactor;
    }

    const factor = evalFactor(rawFactor);
    if (isNaN(factor)) return { value, unit };
    const converted = parseFloat((numVal * factor).toFixed(4));
    return { value: converted, unit: conv.targetUnit };
  }, [activeConversions, hasActiveConversion, unitConversions, currentYear]);

  // 과제 링크 모달 상태
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkModalPerformance, setLinkModalPerformance] = useState(null);
  const [linkModalSearchTerm, setLinkModalSearchTerm] = useState('');
  const [linkModalYearFilter, setLinkModalYearFilter] = useState(new Date().getFullYear()); // 연도 필터
  const [linkedProjects, setLinkedProjects] = useState([]); // {projectId, projectName, division, contribution, year}

  // 월별 실적 모달 상태
  const [monthlyModalOpen, setMonthlyModalOpen] = useState(false);
  const [monthlyModalPerformance, setMonthlyModalPerformance] = useState(null);

  // KPI 대시보드 카드 (현재 연도 기준) - 성과 ↔ KPI 카드 연결 표시용
  const [kpiCards, setKpiCards] = useState([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cards = await fetchKPIDashboardCards(currentYear);
        if (!cancelled) {
          setKpiCards((cards || []).map(c => ({
            id: c.id,
            name: c.name || '',
            division: c.division || '',
            category: c.category || '',
            subcategories: c.subcategories || [],
            logic: c.logic || '',
            selectedPerfKeys: c.selectedPerfKeys || []
          })));
        }
      } catch (err) {
        console.error('KPI 카드 로드 실패:', err);
        if (!cancelled) setKpiCards([]);
      }
    })();
    return () => { cancelled = true; };
  }, [currentYear]);

  // perf 식별 키 → KPI 카드 배열 역인덱스
  const perfKeyToKpiCards = useMemo(() => {
    const map = new Map();
    kpiCards.forEach(card => {
      (card.selectedPerfKeys || []).forEach(key => {
        if (key === undefined || key === null || key === '') return;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(card);
      });
    });
    return map;
  }, [kpiCards]);

  // 특정 성과에 연결된 KPI 카드 목록 (id 기준 중복 제거)
  const getLinkedKpiCards = useCallback((perf) => {
    if (!perf) return [];
    const candidates = [perf.uuid, perf.id, perf.성과항목UUID, perf.성과UUID, perf.성과항목ID, perf.성과항목];
    const collected = [];
    const seen = new Set();
    for (const key of candidates) {
      if (key === undefined || key === null || key === '') continue;
      const cards = perfKeyToKpiCards.get(key);
      if (!cards) continue;
      for (const c of cards) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        collected.push(c);
      }
    }
    return collected;
  }, [perfKeyToKpiCards]);

  // 테이블 헤더 필터 상태
  const [tableFilters, setTableFilters] = useState({
    category: [],      // 대분류 필터 (복수 선택)
    subcategory: [],   // 소분류 필터 (복수 선택)
    hasLinkedProject: '', // 연결과제: '' (전체), 'yes', 'no'
    hasKpiLink: '',    // KPI 대시보드 연결: '' (전체), 'yes', 'no'(미연결)
    needsAction: '',   // 수정필요: '' (전체), 'normal', 'needs'
    reportStatus: ''   // 보고현황: '' (전체), 'has', 'none', 또는 특정 항목명
  });
  const [activeFilterDropdown, setActiveFilterDropdown] = useState(null); // 현재 열린 필터 드롭다운

  // 초기 로딩 완료 처리
  useEffect(() => {
    // 데이터가 준비되면 로딩 해제 (약간의 딜레이로 UI 깜빡임 방지)
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // 정상 등록 여부 확인 헬퍼 함수 (조치사항목록과 조치사항 모두 확인)
  const isNormalPerformance = (p) => {
    // 조치사항목록이 있고 비어있지 않으면 수정 필요
    if (p.조치사항목록 && Array.isArray(p.조치사항목록) && p.조치사항목록.length > 0) {
      return false;
    }
    // 조치사항이 있고 "없음"이 아니면 수정 필요
    const action = p.조치사항;
    if (action && action !== '' && action !== '없음') {
      return false;
    }
    // 그 외는 정상 등록
    return true;
  };

  // 성과-과제 연결 조회 헬퍼 함수 (성능 최적화: 첫 번째 매칭에서 중단)
  const getLinkedProjects = (perf, projectMap) => {
    const keys = [perf.uuid, perf.id, perf.성과항목UUID, perf.성과UUID, perf.성과항목ID, perf.성과항목];
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (key && projectMap.has(key)) {
        return projectMap.get(key);
      }
    }
    return [];
  };

  // 현재 연도의 성과만 필터링 (조치사항이 "없음"이거나 미설정인 경우만 집계)
  const filteredPerformances = useMemo(() => {
    return globalPerformances.filter(p => {
      // 연도 필터 (타입 변환하여 비교)
      if (Number(p.성과년도) !== Number(currentYear)) return false;
      // 정상 등록된 성과만 포함
      return isNormalPerformance(p);
    });
  }, [globalPerformances, currentYear]);

  // 현재 연도의 프로젝트만 필터링
  const filteredProjects = useMemo(() => {
    return projects.filter(p => p.과제년도 === currentYear && !p._deleted);
  }, [projects, currentYear]);

  // 성과-과제 연결 맵 생성 (현재 연도 ± 2년 범위의 과제만 - 성능 최적화)
  const performanceProjectMap = useMemo(() => {
    const map = new Map();
    const minYear = currentYear - 2;
    const maxYear = currentYear + 1;

    // 연도 범위 내의 과제만 처리 (성능 최적화)
    for (let i = 0; i < projects.length; i++) {
      const project = projects[i];
      if (project._deleted) continue;

      const projectYear = project.과제년도;
      if (projectYear < minYear || projectYear > maxYear) continue;

      const performanceList = project.성과목록;
      if (!performanceList || performanceList.length === 0) continue;

      for (let j = 0; j < performanceList.length; j++) {
        const perf = performanceList[j];
        const perfKey = perf.성과항목UUID || perf.성과UUID || perf.성과항목ID || perf.성과항목;
        if (!perfKey) continue;

        let arr = map.get(perfKey);
        if (!arr) {
          arr = [];
          map.set(perfKey, arr);
        }
        // 중복 체크: 같은 과제가 이미 있으면 추가하지 않음
        const projectId = project.id || project.uuid;
        const isDuplicate = arr.some(p => (p.id || p.uuid) === projectId);
        if (!isDuplicate) {
          arr.push({
            id: project.id,
            uuid: project.uuid,
            과제명: project.과제명,
            사업부: project.사업부,
            과제PL: project.과제PL,
            과제년도: project.과제년도,
            기여도: perf.과제기여도
          });
        }
      }
    }

    return map;
  }, [projects, currentYear]);

  // 테이블 뷰용: 모든 성과 (정상 + 수정 필요 모두 포함)
  const allPerformancesForYear = useMemo(() => {
    return globalPerformances.filter(p => Number(p.성과년도) === Number(currentYear));
  }, [globalPerformances, currentYear]);

  // 성과를 사업부 > 대분류 > 소분류로 그룹화
  const groupedPerformances = useMemo(() => {
    const grouped = {};

    let performances = filteredPerformances;

    // 검색어 필터
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      performances = performances.filter(p => {
        const { name } = extractDivisionFromPerformance(p.성과항목);
        return name.toLowerCase().includes(term) ||
          (p.대분류 || '').toLowerCase().includes(term) ||
          (p.소분류 || '').toLowerCase().includes(term);
      });
    }

    performances.forEach(perf => {
      const { division, name } = extractDivisionFromPerformance(perf.성과항목);
      const category = perf.대분류 || '미분류';
      const subcategory = perf.소분류 || '미분류';

      if (!grouped[division]) {
        grouped[division] = {};
      }
      if (!grouped[division][category]) {
        grouped[division][category] = {};
      }
      if (!grouped[division][category][subcategory]) {
        grouped[division][category][subcategory] = [];
      }

      // 성과-과제 연결 조회 (빠른 조회를 위해 첫 번째 매칭에서 중단)
      const perfKeys = [perf.uuid, perf.id, perf.성과항목UUID, perf.성과UUID, perf.성과항목ID, perf.성과항목];
      let linkedProjects = null;
      for (const key of perfKeys) {
        if (key && performanceProjectMap.has(key)) {
          linkedProjects = performanceProjectMap.get(key);
          break;
        }
      }

      // 원본 데이터 객체를 변형하지 않도록 복사본에 필드 추가
      // (원본이 동결(frozen)된 경우 직접 할당은 "Cannot assign to read only property" 에러 유발)
      grouped[division][category][subcategory].push({
        ...perf,
        displayName: name,
        linkedProjects: linkedProjects || []
      });
    });

    return grouped;
  }, [filteredPerformances, performanceProjectMap, searchTerm]);

  // 테이블 뷰용 그룹화 (모든 성과 포함 - 수정 필요한 것도 포함)
  const groupedPerformancesForTable = useMemo(() => {
    const grouped = {};

    let performances = allPerformancesForYear;

    // 검색어 필터
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      performances = performances.filter(p => {
        const { name } = extractDivisionFromPerformance(p.성과항목);
        return name.toLowerCase().includes(term) ||
          (p.대분류 || '').toLowerCase().includes(term) ||
          (p.소분류 || '').toLowerCase().includes(term);
      });
    }

    // 사업부 필터
    if (selectedDivision !== 'all') {
      performances = performances.filter(p => {
        const { division } = extractDivisionFromPerformance(p.성과항목);
        return division === selectedDivision;
      });
    }

    performances.forEach(perf => {
      const { division, name } = extractDivisionFromPerformance(perf.성과항목);
      const category = perf.대분류 || '미분류';
      const subcategory = perf.소분류 || '미분류';

      if (!grouped[division]) {
        grouped[division] = {};
      }
      if (!grouped[division][category]) {
        grouped[division][category] = {};
      }
      if (!grouped[division][category][subcategory]) {
        grouped[division][category][subcategory] = [];
      }

      // 성과-과제 연결 조회 (빠른 조회)
      const perfKeys = [perf.uuid, perf.id, perf.성과항목UUID, perf.성과UUID, perf.성과항목ID, perf.성과항목];
      let linkedProjects = null;
      for (const key of perfKeys) {
        if (key && performanceProjectMap.has(key)) {
          linkedProjects = performanceProjectMap.get(key);
          break;
        }
      }

      // 원본 데이터 객체를 변형하지 않도록 복사본에 필드 추가
      // (원본이 동결(frozen)된 경우 직접 할당은 "Cannot assign to read only property" 에러 유발)
      grouped[division][category][subcategory].push({
        ...perf,
        displayName: name,
        linkedProjects: linkedProjects || []
      });
    });

    return grouped;
  }, [allPerformancesForYear, performanceProjectMap, searchTerm, selectedDivision]);

  // 테이블 뷰용 사업부 목록
  const divisionsForTable = useMemo(() => {
    return sortDivisionNames(Object.keys(groupedPerformancesForTable), settingsData);
  }, [groupedPerformancesForTable, settingsData]);

  // 사업부 차례는 **설정이 정본**이다(utils/divisionOrder).
  const divisions = useMemo(
    () => sortDivisionNames(Object.keys(groupedPerformances), settingsData),
    [groupedPerformances, settingsData]);

  // 조치사항이 있는 성과 (수정 필요한 것)
  const performancesWithAction = useMemo(() => {
    return globalPerformances.filter(p => {
      if (Number(p.성과년도) !== Number(currentYear)) return false;
      // 정상 등록이 아니면 수정 필요
      return !isNormalPerformance(p);
    });
  }, [globalPerformances, currentYear]);

  // 통계 계산
  const stats = useMemo(() => {
    const totalPerformances = filteredPerformances.length;
    const divisionsCount = Object.keys(groupedPerformances).length;
    const linkedPerformances = filteredPerformances.filter(p => {
      return getLinkedProjects(p, performanceProjectMap).length > 0;
    }).length;
    const withActionCount = performancesWithAction.length;

    return { totalPerformances, divisionsCount, linkedPerformances, withActionCount };
  }, [filteredPerformances, groupedPerformances, performanceProjectMap, performancesWithAction]);

  // 테이블 뷰용 행 데이터 (성능 최적화: 렌더링 시 재계산 방지)
  const tableRows = useMemo(() => {
    const groupColorPalette = [
      { bg: '#fef3c7', border: '#fbbf24', label: '#d97706' },
      { bg: '#dbeafe', border: '#60a5fa', label: '#2563eb' },
      { bg: '#dcfce7', border: '#4ade80', label: '#16a34a' },
      { bg: '#fce7f3', border: '#f472b6', label: '#db2777' },
      { bg: '#e0e7ff', border: '#818cf8', label: '#4f46e5' },
      { bg: '#fed7aa', border: '#fb923c', label: '#ea580c' },
      { bg: '#d1fae5', border: '#34d399', label: '#059669' },
      { bg: '#ede9fe', border: '#a78bfa', label: '#7c3aed' },
    ];

    const divisionColorMap = {
      'MX': '#3b82f6',
      'VD': '#8b5cf6',
      'DA': '#10b981',
      'NW': '#f59e0b',
      '의료기기': '#ec4899',
      'SR': '#06b6d4',
      'GTR': '#6366f1',
      'CS': '#84cc16'
    };

    const rows = [];
    let groupColorIndex = 0;

    divisionsForTable.forEach(division => {
      const categories = groupedPerformancesForTable[division] || {};
      Object.keys(categories).sort(sortWithEtcLast).forEach(category => {
        const subcategories = categories[category] || {};
        Object.keys(subcategories).sort(sortWithEtcLast).forEach(subcategory => {
          const performances = subcategories[subcategory] || [];

          // 단위 + 월별여부로 그룹화 (월별 성과는 별도 집계)
          const unitGroups = {};
          performances.forEach(perf => {
            const unit = perf.단위 || '기타';
            const isMonthly = perf.월별실적여부 === true;
            const groupKey = isMonthly ? `${unit}__monthly` : unit;
            if (!unitGroups[groupKey]) {
              unitGroups[groupKey] = { unit, isMonthly, items: [] };
            }
            unitGroups[groupKey].items.push(perf);
          });

          // 그룹 정렬: 일반 먼저, 월별 나중에
          const unitKeys = Object.keys(unitGroups).sort((a, b) => {
            const aIsMonthly = a.includes('__monthly');
            const bIsMonthly = b.includes('__monthly');
            if (aIsMonthly !== bIsMonthly) return aIsMonthly ? 1 : -1;
            return a.localeCompare(b);
          });

          unitKeys.forEach(groupKey => {
            const { unit, isMonthly: isMonthlyGroup, items: unitPerformances } = unitGroups[groupKey];
            const groupColor = groupColorPalette[groupColorIndex % groupColorPalette.length];
            // 월별 성과는 개별 집계하지 않음 (각각 다른 월별 데이터를 가지므로)
            const needsSubtotal = !isMonthlyGroup && unitPerformances.length >= 2;
            // 필터링 시 그룹 경계 식별을 위한 키
            const unitGroupKey = `${division}::${category}::${subcategory}::${groupKey}`;

            let totalCurrent = 0, totalTarget = 0, totalActual = 0, totalDiff = 0;
            const isPercentage = unit === '%';

            // 월별 성과가 아닌 경우에만 집계
            if (!isMonthlyGroup) {
              unitPerformances.forEach(perf => {
                const current = parseFloat(perf.현재수준) || 0;
                const target = parseFloat(perf.목표수준) || 0;
                const actual = parseFloat(perf.실적수준) || 0;
                totalCurrent += current;
                totalTarget += target;
                totalActual += actual;
                totalDiff += (target - current);
              });
            }

            const count = unitPerformances.length;
            // 소수점 2자리로 반올림 (부동소수점 오류 방지)
            const roundToTwo = (num) => Math.round(num * 100) / 100;
            const displayCurrent = roundToTwo(isPercentage ? totalCurrent / count : totalCurrent);
            const displayTarget = roundToTwo(isPercentage ? totalTarget / count : totalTarget);
            const displayActual = roundToTwo(isPercentage ? totalActual / count : totalActual);
            const displayDiff = roundToTwo(isPercentage ? totalDiff / count : totalDiff);

            unitPerformances.forEach(perf => {
              const { name: perfName } = extractDivisionFromPerformance(perf.성과항목);
              const linkedProjects = getLinkedProjects(perf, performanceProjectMap);

              const current = parseFloat(perf.현재수준) || 0;
              const target = parseFloat(perf.목표수준) || 0;
              const diff = target - current;

              let actionItems = [];
              if (perf.조치사항목록 && Array.isArray(perf.조치사항목록) && perf.조치사항목록.length > 0) {
                actionItems = perf.조치사항목록;
              } else if (perf.조치사항 && perf.조치사항 !== '없음' && perf.조치사항 !== '') {
                actionItems = [perf.조치사항];
              }

              const reportItems = (perf.보고현황목록 && Array.isArray(perf.보고현황목록)) ? perf.보고현황목록 : [];

              rows.push({
                id: perf.id || perf.uuid,
                division,
                divisionColor: divisionColorMap[division] || '#64748b',
                category,
                subcategory,
                name: perfName || perf.성과항목,
                unit: perf.단위 || '',
                current: perf.현재수준,
                target: perf.목표수준,
                actual: perf.실적수준,
                diff,
                description: perf.설명 || '',
                linkedProjects,
                actionItems,
                reportItems,
                kpiLinks: getLinkedKpiCards(perf),
                isSubtotal: false,
                groupColor: needsSubtotal ? groupColor : null,
                originalPerf: perf,
                // 월별 실적 정보
                isMonthly: perf.월별실적여부 === true,
                monthlyData: perf.월별실적 || null,
                // 디지털 트윈 기여도
                dtContribution: perf.디지털트윈기여도 ?? '100',
                // 필터링 시 그룹 경계 식별용
                unitGroupKey
              });
            });

            if (needsSubtotal) {
              rows.push({
                id: `subtotal-${division}-${category}-${subcategory}-${unit}`,
                division,
                divisionColor: divisionColorMap[division] || '#64748b',
                category,
                subcategory,
                name: isPercentage ? '평균' : '소계',
                unit: unit !== '기타' ? unit : '',
                current: displayCurrent,
                target: displayTarget,
                actual: displayActual,
                diff: displayDiff,
                linkedProjects: [],
                isSubtotal: true,
                itemCount: count,
                isAverage: isPercentage,
                groupColor,
                unitGroupKey
              });

              groupColorIndex++;
            }
          });
        });
      });
    });

    return rows;
  }, [divisionsForTable, groupedPerformancesForTable, performanceProjectMap, projects, getLinkedKpiCards]);

  // 테이블 필터 옵션 추출 (고유값)
  const tableFilterOptions = useMemo(() => {
    const categories = new Set();
    const subcategories = new Set();
    const reportItems = new Set();

    tableRows.forEach(row => {
      if (!row.isSubtotal) {
        if (row.category) categories.add(row.category);
        if (row.subcategory) subcategories.add(row.subcategory);
        if (row.reportItems) row.reportItems.forEach(item => reportItems.add(item));
      }
    });

    return {
      categories: Array.from(categories).sort(sortWithEtcLast),
      subcategories: Array.from(subcategories).sort(sortWithEtcLast),
      reportItems: Array.from(reportItems).sort()
    };
  }, [tableRows]);

  // 개별 데이터 행이 필터를 통과하는지 확인하는 함수
  const passesFilters = (row) => {
    if (tableFilters.category.length > 0 && !tableFilters.category.includes(row.category)) return false;
    if (tableFilters.subcategory.length > 0 && !tableFilters.subcategory.includes(row.subcategory)) return false;
    if (tableFilters.hasLinkedProject === 'yes' && (!row.linkedProjects || row.linkedProjects.length === 0)) return false;
    if (tableFilters.hasLinkedProject === 'no' && row.linkedProjects && row.linkedProjects.length > 0) return false;
    if (tableFilters.hasKpiLink === 'yes' && (!row.kpiLinks || row.kpiLinks.length === 0)) return false;
    if (tableFilters.hasKpiLink === 'no' && row.kpiLinks && row.kpiLinks.length > 0) return false;
    if (tableFilters.needsAction === 'needs' && (!row.actionItems || row.actionItems.length === 0)) return false;
    if (tableFilters.needsAction === 'normal' && row.actionItems && row.actionItems.length > 0) return false;
    if (tableFilters.reportStatus) {
      const hasReport = row.reportItems && row.reportItems.length > 0;
      if (tableFilters.reportStatus === 'has' && !hasReport) return false;
      if (tableFilters.reportStatus === 'none' && hasReport) return false;
      if (tableFilters.reportStatus !== 'has' && tableFilters.reportStatus !== 'none') {
        if (!hasReport || !row.reportItems.includes(tableFilters.reportStatus)) return false;
      }
    }
    return true;
  };

  // 필터가 적용된 테이블 행
  const filteredTableRows = useMemo(() => {
    // 필터가 모두 비어있으면 전체 반환
    const hasActiveFilter =
      tableFilters.category.length > 0 ||
      tableFilters.subcategory.length > 0 ||
      tableFilters.hasLinkedProject ||
      tableFilters.hasKpiLink ||
      tableFilters.needsAction ||
      tableFilters.reportStatus;

    if (!hasActiveFilter) {
      return tableRows;
    }

    // 필터링 적용 + 소계를 필터된 행으로 재계산
    // unitGroupKey 기반으로 그룹을 구분하여 올바른 소계 계산
    const roundToTwo = (num) => Math.round(num * 100) / 100;

    // 1단계: 그룹별로 필터된 데이터 행과 소계 행 수집
    const groupMap = new Map(); // unitGroupKey → { dataRows, subtotalRow }

    tableRows.forEach((row) => {
      const key = row.unitGroupKey;
      if (!key) return;

      if (!groupMap.has(key)) {
        groupMap.set(key, { dataRows: [], subtotalRow: null });
      }

      if (row.isSubtotal) {
        groupMap.get(key).subtotalRow = row;
      } else if (passesFilters(row)) {
        groupMap.get(key).dataRows.push(row);
      }
    });

    // 2단계: 원래 순서를 유지하면서 필터된 행과 재계산된 소계 출력
    const filtered = [];
    const processedGroups = new Set();

    tableRows.forEach((row) => {
      const key = row.unitGroupKey;
      if (!key) return;

      // 이미 처리된 그룹은 건너뛰기
      if (processedGroups.has(key)) return;

      if (row.isSubtotal) {
        // 소계 행을 만나면 해당 그룹은 이미 데이터 행에서 처리되었거나 빈 그룹
        return;
      }

      // 이 그룹의 첫 데이터 행을 만났으므로 그룹 전체를 출력
      processedGroups.add(key);
      const group = groupMap.get(key);
      if (!group || group.dataRows.length === 0) return;

      // 필터된 데이터 행 추가
      group.dataRows.forEach(r => filtered.push(r));

      // 원래 소계가 있었고 필터된 행이 2개 이상이면 소계 재계산
      if (group.subtotalRow && group.dataRows.length >= 2) {
        const count = group.dataRows.length;
        const isPercentage = group.subtotalRow.isAverage;
        let totalCurrent = 0, totalTarget = 0, totalActual = 0, totalDiff = 0;

        group.dataRows.forEach(r => {
          totalCurrent += parseFloat(r.current) || 0;
          totalTarget += parseFloat(r.target) || 0;
          totalActual += parseFloat(r.actual) || 0;
          totalDiff += r.diff || 0;
        });

        filtered.push({
          ...group.subtotalRow,
          current: roundToTwo(isPercentage ? totalCurrent / count : totalCurrent),
          target: roundToTwo(isPercentage ? totalTarget / count : totalTarget),
          actual: roundToTwo(isPercentage ? totalActual / count : totalActual),
          diff: roundToTwo(isPercentage ? totalDiff / count : totalDiff),
          itemCount: count
        });
      }
    });

    return filtered;
  }, [tableRows, tableFilters]);

  // 필터 드롭다운 토글
  const handleFilterDropdownToggle = (filterName, e) => {
    e.stopPropagation();
    setActiveFilterDropdown(prev => prev === filterName ? null : filterName);
  };

  // 필터 값 변경
  const handleFilterChange = (filterName, value) => {
    if (filterName === 'category' || filterName === 'subcategory') {
      // 복수 선택: 배열에서 토글
      setTableFilters(prev => {
        const arr = prev[filterName];
        const newArr = arr.includes(value)
          ? arr.filter(v => v !== value)
          : [...arr, value];
        return { ...prev, [filterName]: newArr };
      });
      // 드롭다운 닫지 않음 (복수 선택 가능하도록)
    } else {
      setTableFilters(prev => ({
        ...prev,
        [filterName]: prev[filterName] === value ? '' : value
      }));
      setActiveFilterDropdown(null); // 선택 후 드롭다운 닫기
    }
  };

  // 필터 초기화
  const handleClearFilter = (filterName, e) => {
    e.stopPropagation();
    setTableFilters(prev => ({
      ...prev,
      [filterName]: (filterName === 'category' || filterName === 'subcategory') ? [] : ''
    }));
    setActiveFilterDropdown(null);
  };

  // 드롭다운 외부 클릭 처리
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (activeFilterDropdown && !e.target.closest('.filter-header-cell')) {
        setActiveFilterDropdown(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [activeFilterDropdown]);

  // 내보내기 모달 열기
  const handleOpenExportModal = () => {
    setExportDivisionFilter('all');
    setExportLinkedFilter('all');
    setExportModalOpen(true);
  };

  // CSV 로컬 저장 함수
  const handleExportToCSV = () => {
    // 현재 연도의 모든 성과 (정상 등록 + 수정 필요 모두 포함)
    let allPerformancesForYear = globalPerformances.filter(p => Number(p.성과년도) === Number(currentYear));

    // 사업부 필터 적용
    if (exportDivisionFilter !== 'all') {
      allPerformancesForYear = allPerformancesForYear.filter(p => {
        const { division } = extractDivisionFromPerformance(p.성과항목);
        return division === exportDivisionFilter;
      });
    }

    // 과제 연결 여부 필터 적용
    if (exportLinkedFilter === 'linked') {
      allPerformancesForYear = allPerformancesForYear.filter(p => {
        return getLinkedProjects(p, performanceProjectMap).length > 0;
      });
    }

    if (allPerformancesForYear.length === 0) {
      alert('내보낼 성과가 없습니다.');
      return;
    }

    // 모달 닫기
    setExportModalOpen(false);

    // CSV 헤더 정의
    const headers = [
      '성과ID',
      'UUID',
      '성과년도',
      '사업부',
      '대분류',
      '소분류',
      '성과항목명',
      '단위',
      '측정유형',
      '현재/기준수준',
      '목표수준',
      '실적수준',
      '월별실적여부',
      '월별실적(1월~12월)',
      '디지털트윈기여도(%)',
      '설명',
      '등록상태',
      '수정필요여부',
      '수정필요사항',
      '연결된과제수',
      '연결된과제목록'
    ];

    // CSV 데이터 생성
    const csvData = allPerformancesForYear.map(perf => {
      // 사업부 추출
      const { division, name: perfName } = extractDivisionFromPerformance(perf.성과항목);

      // 정상 등록 여부 확인
      const isNormal = isNormalPerformance(perf);

      // 수정 필요 사항 문자열화
      let actionItems = '';
      if (perf.조치사항목록 && Array.isArray(perf.조치사항목록) && perf.조치사항목록.length > 0) {
        actionItems = perf.조치사항목록.join(' | ');
      } else if (perf.조치사항 && perf.조치사항 !== '없음' && perf.조치사항 !== '') {
        actionItems = perf.조치사항;
      }

      // 월별실적 문자열화
      const monthlyActuals = perf.월별실적 && Array.isArray(perf.월별실적)
        ? perf.월별실적.join(' | ')
        : '';

      // 연결된 과제 찾기
      const linkedProjects = getLinkedProjects(perf, performanceProjectMap);

      // 연결된 과제 문자열화
      const linkedProjectCount = linkedProjects.length;
      const linkedProjectList = linkedProjects.map(project => {
        const name = project.과제명 || '';
        const div = project.사업부 || '';
        const contribution = project.기여도 ? `${project.기여도}%` : '';
        return `${name}(${div}, 기여도:${contribution})`;
      }).join(' | ');

      return [
        perf.id || '',
        perf.uuid || '',
        perf.성과년도 || '',
        division || '',
        perf.대분류 || '',
        perf.소분류 || '',
        perfName || perf.성과항목 || '',
        perf.단위 || '',
        perf.isAchievementType ? '달성형' : '비교형',
        levelText(perf.현재수준),
        levelText(perf.목표수준),
        levelText(perf.실적수준),
        perf.월별실적여부 ? 'Y' : 'N',
        monthlyActuals,
        perf.디지털트윈기여도 ?? '100',
        perf.설명 || '',
        isNormal ? '정상등록' : '수정필요',
        isNormal ? 'N' : 'Y',
        actionItems,
        linkedProjectCount,
        linkedProjectList
      ];
    });

    // CSV 문자열 생성
    const BOM = '\uFEFF';
    const csvContent = BOM + [
      headers.join(','),
      ...csvData.map(row =>
        row.map(cell => {
          // 셀 내용을 문자열로 변환하고 쉼표, 줄바꿈, 따옴표가 있으면 따옴표로 감싸기
          const cellStr = String(cell ?? '');
          if (cellStr.includes(',') || cellStr.includes('\n') || cellStr.includes('"')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        }).join(',')
      )
    ].join('\n');

    // 파일 다운로드
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `성과현황_${currentYear}년_${todayLocalYmd()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 테이블 보기 전용 CSV 내보내기 (화면 그대로 + 차이값 별도 열, 필터 적용)
  // ── 성과 휴지통 ──────────────────────────────────────────────────────────

  const loadDeletedPerformances = useCallback(async () => {
    setTrashLoading(true);
    setTrashError('');
    try {
      setDeletedPerformances(await fetchDeletedPerformances());
    } catch (err) {
      setTrashError(err?.message || '삭제된 성과를 불러오지 못했습니다.');
      setDeletedPerformances([]);
    } finally {
      setTrashLoading(false);
    }
  }, []);

  // 휴지통을 열 때마다 새로 받는다. 목록이 화면 상태와 따로 놀기 때문에
  // (globalPerformances 에 없다) 캐시해 두면 남이 지운 것을 못 본다.
  useEffect(() => {
    if (showTrash) loadDeletedPerformances();
  }, [showTrash, loadDeletedPerformances]);

  const handleRestorePerformance = async (perf) => {
    const name = perf.displayName || perf.title || perf.code;
    // 연결이 안 돌아온다는 것을 **복구 전에** 알린다. 복구하고 나서 알면
    // "왜 과제에 안 붙어 있지" 를 사용자가 혼자 헤매게 된다.
    if (!window.confirm(
      [
        `"${name}" 성과를 복구하시겠습니까?`,
        '',
        '⚠️ 삭제할 때 끊긴 과제 연결은 되살아나지 않습니다.',
        '복구 후 각 과제에서 다시 연결해야 합니다.',
      ].join('\n')
    )) return;

    setRestoringUuid(perf.uuid);
    try {
      await restorePerformanceV2(perf.uuid);
      setDeletedPerformances(prev => prev.filter(x => x.uuid !== perf.uuid));
      if (onPerformanceRestored) await onPerformanceRestored();
    } catch (err) {
      window.alert(err?.status === 403
        ? '복구 권한이 없습니다. 삭제된 성과는 관리자 또는 만든 사람만 복구할 수 있습니다.'
        : (err?.message || '복구에 실패했습니다.'));
    } finally {
      setRestoringUuid('');
    }
  };

  const handlePermanentDeletePerformance = async (perf) => {
    const name = perf.displayName || perf.title || perf.code;
    if (!window.confirm(
      [
        `"${name}" 성과를 영구 삭제하시겠습니까?`,
        '',
        '⚠️ 이 작업은 되돌릴 수 없습니다. 휴지통에서도 사라집니다.',
      ].join('\n')
    )) return;

    setRestoringUuid(perf.uuid);
    try {
      await permanentDeletePerformanceV2(perf.uuid);
      setDeletedPerformances(prev => prev.filter(x => x.uuid !== perf.uuid));
    } catch (err) {
      window.alert(err?.status === 403
        ? '영구 삭제는 관리자만 할 수 있습니다.'
        : (err?.message || '영구 삭제에 실패했습니다.'));
    } finally {
      setRestoringUuid('');
    }
  };

  /** 휴지통에 있는 성과의 연도 목록 (필터 드롭다운용) */
  const trashYears = useMemo(() => {
    const set = new Set(deletedPerformances.map(p => p.year).filter(Boolean));
    return Array.from(set).sort((a, b) => b - a);
  }, [deletedPerformances]);

  /** 검색어·연도로 좁힌 휴지통 목록 */
  const filteredDeletedPerformances = useMemo(() => {
    const term = trashSearch.trim().toLowerCase();
    return deletedPerformances.filter(p => {
      if (trashYear !== 'all' && String(p.year) !== String(trashYear)) return false;
      if (!term) return true;
      return [p.displayName, p.title, p.code, p.category, p.subcategory]
        .some(v => (v || '').toLowerCase().includes(term));
    });
  }, [deletedPerformances, trashSearch, trashYear]);

  const handleExportTableToCSV = () => {
    // filteredTableRows 사용 (현재 적용된 필터 반영)
    const rows = [];

    // 소계 행 제외하고 데이터 행만 수집
    filteredTableRows.forEach(row => {
      if (row.isSubtotal) return; // 소계 행 제외

      // 단위 환산 적용
      const cc = applyConversion(row.current, row.unit, row.division);
      const ct = applyConversion(row.target, row.unit, row.division);
      const ca = applyConversion(row.actual, row.unit, row.division);
      const displayUnit = cc.unit;

      const current = parseFloat(cc.value) || 0;
      const target = parseFloat(ct.value) || 0;
      const actual = parseFloat(ca.value) || 0;
      const targetDiff = Math.round((target - current) * 100) / 100;
      const actualDiff = Math.round((actual - current) * 100) / 100;

      // 연결된 과제 문자열화
      const linkedProjects = row.linkedProjects || [];
      const linkedProjectList = linkedProjects.map(project => project.과제명 || '').join(' | ');

      // 과제PL 수집 (중복 제거)
      const plSet = new Set();
      linkedProjects.forEach(project => {
        if (project.과제PL) plSet.add(project.과제PL);
      });
      const plList = Array.from(plSet).join(' | ');

      // 보고현황 문자열화
      const reportList = row.reportItems && row.reportItems.length > 0 ? row.reportItems.join(' | ') : '';

      // KPI 대시보드 연결 문자열화
      const kpiLinkList = (row.kpiLinks || []).map(card => {
        const labelParts = [];
        if (card.division && card.division !== '전체') labelParts.push(card.division);
        if (card.category && card.category !== '전체') labelParts.push(card.category);
        if (Array.isArray(card.subcategories) && card.subcategories.length > 0) labelParts.push(card.subcategories.join(', '));
        const contextLabel = labelParts.join(' · ');
        return card.name || contextLabel || '(이름없음)';
      }).join(' | ');

      rows.push({
        사업부: row.division,
        대분류: row.category,
        소분류: row.subcategory,
        성과항목명: row.name,
        단위: displayUnit || '',
        현재: hasLevel(row.current) ? cc.value : '',
        목표: hasLevel(row.target) ? ct.value : '',
        '목표-현재': targetDiff,
        실적: hasLevel(row.actual) ? ca.value : '',
        '실적-현재': actualDiff,
        보고현황: reportList,
        상세설명: row.description || '',
        연결된과제: linkedProjectList,
        'KPI대시보드연결': kpiLinkList,
        수정필요사항: row.actionItems && row.actionItems.length > 0 ? row.actionItems.join(' | ') : '정상',
        과제PL: plList
      });
    });

    if (rows.length === 0) {
      alert('내보낼 데이터가 없습니다.');
      return;
    }

    // CSV 헤더
    const headers = ['사업부', '대분류', '소분류', '성과항목명', '단위', '현재', '목표', '목표-현재', '실적', '실적-현재', '보고현황', '상세설명', '연결된과제', 'KPI대시보드연결', '수정필요사항', '과제PL'];

    // 필터 적용 여부 확인 (파일명에 반영)
    const hasFilter = tableFilters.category.length > 0 || tableFilters.subcategory.length > 0 || tableFilters.hasLinkedProject || tableFilters.hasKpiLink || tableFilters.needsAction;
    const filterSuffix = hasFilter ? '_필터적용' : '';
    const activeConvNames = Object.values(activeConversions)
      .map(id => unitConversions.find(c => c.id === id))
      .filter(Boolean)
      .map(c => c.label || c.targetUnit);
    const convSuffix = activeConvNames.length > 0 ? `_${activeConvNames.join('+')}` : '';

    // CSV 문자열 생성
    const BOM = '\uFEFF';
    const csvContent = BOM + [
      headers.join(','),
      ...rows.map(row =>
        headers.map(header => {
          const cellStr = String(row[header] ?? '');
          if (cellStr.includes(',') || cellStr.includes('\n') || cellStr.includes('"')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        }).join(',')
      )
    ].join('\n');

    // 파일 다운로드
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `성과테이블_${currentYear}년${filterSuffix}${convSuffix}_${todayLocalYmd()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrevYear = () => {
    const newYear = currentYear - 1;
    setCurrentYear(newYear);
    if (onYearChange) onYearChange(newYear);
  };

  const handleNextYear = () => {
    const newYear = currentYear + 1;
    setCurrentYear(newYear);
    if (onYearChange) onYearChange(newYear);
  };

  // 사업부별 성과 수 계산
  const getDivisionCount = (division) => {
    const categories = groupedPerformances[division] || {};
    let count = 0;
    Object.values(categories).forEach(subcats => {
      Object.values(subcats).forEach(perfs => {
        count += perfs.length;
      });
    });
    return count;
  };

  // 소분류별 합산치/평균 계산 (단위가 %인 경우 평균 계산)
  const calculateSubcategorySummary = (performances) => {
    let currentSum = 0;
    let targetSum = 0;
    let actualSum = 0;
    let currentCount = 0;
    let targetCount = 0;
    let actualCount = 0;
    let hasNumericData = false;
    let unit = '';

    performances.forEach(perf => {
      const current = parseFloat(perf.현재수준);
      const target = parseFloat(perf.목표수준);
      const actual = parseFloat(perf.실적수준);

      // 첫 번째로 발견된 단위 사용
      if (!unit && perf.단위) {
        unit = perf.단위;
      }

      if (!isNaN(current)) {
        currentSum += current;
        currentCount++;
        hasNumericData = true;
      }
      if (!isNaN(target)) {
        targetSum += target;
        targetCount++;
        hasNumericData = true;
      }
      if (!isNaN(actual)) {
        actualSum += actual;
        actualCount++;
        hasNumericData = true;
      }
    });

    // 단위가 %인 경우 평균 계산, 그 외에는 합산
    const isPercentage = unit === '%';

    // 소수점 2자리로 반올림 (부동소수점 오류 방지)
    const roundToTwo = (num) => Math.round(num * 100) / 100;

    return {
      current: roundToTwo(isPercentage && currentCount > 0 ? currentSum / currentCount : currentSum),
      target: roundToTwo(isPercentage && targetCount > 0 ? targetSum / targetCount : targetSum),
      actual: roundToTwo(isPercentage && actualCount > 0 ? actualSum / actualCount : actualSum),
      unit: unit,
      isAverage: isPercentage,
      hasData: hasNumericData
    };
  };

  // 과제 링크 모달 열기
  const handleOpenLinkModal = (performance) => {
    setLinkModalPerformance(performance);
    setLinkModalSearchTerm('');
    setLinkModalYearFilter(currentYear); // 테이블 보기의 현재 연도로 설정

    // 현재 이 성과에 연결된 과제들 찾기
    const currentLinks = [];
    projects.forEach(project => {
      if (project.성과목록 && Array.isArray(project.성과목록)) {
        const linkedPerf = project.성과목록.find(p => {
          const perfId = typeof p === 'object' ? (p.성과항목ID || p.성과UUID || p.uuid) : p;
          return perfId === performance.uuid || perfId === performance.id || perfId === performance.성과항목UUID;
        });
        if (linkedPerf) {
          currentLinks.push({
            projectId: project.id || project.uuid,
            projectName: project.과제명,
            division: project.사업부 || '',
            contribution: typeof linkedPerf === 'object' ? (linkedPerf.과제기여도 || '') : '',
            year: project.과제년도 || ''  // 과제 연도 추가
          });
        }
      }
    });

    setLinkedProjects(currentLinks);
    setLinkModalOpen(true);
  };

  // 과제 링크 모달 닫기
  const handleCloseLinkModal = () => {
    setLinkModalOpen(false);
    setLinkModalPerformance(null);
    setLinkedProjects([]);
    setLinkModalSearchTerm('');
  };

  // 과제 추가
  const handleAddProjectLink = (project) => {
    // 이미 추가된 과제인지 확인
    if (linkedProjects.some(p => p.projectId === (project.id || project.uuid))) {
      return;
    }

    setLinkedProjects(prev => [...prev, {
      projectId: project.id || project.uuid,
      projectName: project.과제명,
      division: project.사업부 || '',
      contribution: '',
      year: project.과제년도 || ''  // 과제 연도 추가
    }]);
  };

  // 과제 제거
  const handleRemoveProjectLink = (projectId) => {
    setLinkedProjects(prev => prev.filter(p => p.projectId !== projectId));
  };

  // 기여도 변경
  const handleContributionChange = (projectId, value) => {
    setLinkedProjects(prev => prev.map(p =>
      p.projectId === projectId ? { ...p, contribution: value } : p
    ));
  };

  // 과제 링크 저장
  const handleSaveLinkModal = () => {
    if (!linkModalPerformance || !onLinkProjectToPerformance) return;

    onLinkProjectToPerformance({
      performanceId: linkModalPerformance.uuid || linkModalPerformance.id,
      performanceName: linkModalPerformance.성과항목,
      linkedProjects: linkedProjects.map(p => ({
        projectId: p.projectId,
        contribution: p.contribution
      }))
    });

    handleCloseLinkModal();
  };

  // 모달용 필터된 과제 목록 (연도 필터 + 검색어 필터)
  const filteredProjectsForModal = useMemo(() => {
    // 먼저 연도로 필터링
    let filtered = projects.filter(p =>
      !p._deleted && p.과제년도 === linkModalYearFilter
    );

    // 검색어가 있으면 추가 필터링
    if (linkModalSearchTerm) {
      const term = linkModalSearchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        (p.과제명 || '').toLowerCase().includes(term) ||
        (p.사업부 || '').toLowerCase().includes(term)
      );
    }
    return filtered;
  }, [projects, linkModalSearchTerm, linkModalYearFilter]);

  // ===== 헤더 조각 (내장 모드에서는 상위 헤더 슬롯으로 포털) =====
  const statsContent = (
    <StatsContainer>
      <StatBadge>사업부 <strong>{stats.divisionsCount}</strong>개</StatBadge>
      <StatBadge>총 성과 <strong>{stats.totalPerformances + stats.withActionCount}</strong>개 (정상 등록 <strong>{stats.totalPerformances}</strong> / 수정 필요 <strong>{stats.withActionCount}</strong>)</StatBadge>
    </StatsContainer>
  );

  // 검색 / 단위 환산 / 테이블 저장 / 로컬 저장 - 로딩 중에는 조작 차단
  const toolbarContent = (
    <ToolbarGroup $disabled={isLoading}>
      <SearchBox>
        <Search size={16} color="#94a3b8" />
        <SearchInput
          placeholder="성과 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </SearchBox>

      {unitConversions.length > 0 && (
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setConversionPanelOpen(prev => !prev)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '0.375rem 0.625rem',
              fontSize: '0.8rem',
              borderRadius: '0.5rem',
              border: `1px solid ${hasActiveConversion ? '#6366f1' : '#e2e8f0'}`,
              background: hasActiveConversion ? '#eef2ff' : 'white',
              color: hasActiveConversion ? '#4f46e5' : '#475569',
              cursor: 'pointer',
              fontWeight: hasActiveConversion ? 600 : 400,
              whiteSpace: 'nowrap'
            }}
          >
            단위 환산
            {hasActiveConversion && (
              <span style={{
                background: '#6366f1',
                color: 'white',
                fontSize: '0.65rem',
                borderRadius: '999px',
                padding: '0 5px',
                lineHeight: '16px',
                minWidth: '16px',
                textAlign: 'center'
              }}>
                {Object.keys(activeConversions).length}
              </span>
            )}
            <ChevronDown size={14} style={{ transform: conversionPanelOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
          {conversionPanelOpen && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                onClick={() => setConversionPanelOpen(false)}
              />
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '4px',
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '0.5rem',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                padding: '8px',
                zIndex: 100,
                minWidth: '180px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                {unitConversions.map(conv => {
                  const srcKey = (conv.sourceUnit || '').toLowerCase();
                  const isActive = activeConversions[srcKey] === conv.id;
                  return (
                    <button
                      key={conv.id}
                      onClick={() => toggleConversion(conv)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 8px',
                        fontSize: '0.8rem',
                        borderRadius: '0.375rem',
                        border: `1px solid ${isActive ? '#6366f1' : '#e2e8f0'}`,
                        background: isActive ? '#eef2ff' : '#fafafa',
                        color: isActive ? '#4f46e5' : '#475569',
                        cursor: 'pointer',
                        fontWeight: isActive ? 600 : 400,
                        whiteSpace: 'nowrap',
                        textAlign: 'left',
                        width: '100%'
                      }}
                      title={conv.description || ''}
                    >
                      <span style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '3px',
                        border: `1.5px solid ${isActive ? '#6366f1' : '#cbd5e1'}`,
                        background: isActive ? '#6366f1' : 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {isActive && <Check size={10} color="white" />}
                      </span>
                      {conv.label || `${conv.sourceUnit} → ${conv.targetUnit}`}
                    </button>
                  );
                })}
                {hasActiveConversion && (
                  <>
                    <div style={{ borderTop: '1px solid #e2e8f0', margin: '2px 0' }} />
                    <button
                      onClick={() => { setActiveConversions({}); setConversionPanelOpen(false); }}
                      style={{
                        padding: '5px 8px',
                        fontSize: '0.75rem',
                        borderRadius: '0.375rem',
                        border: '1px solid #e2e8f0',
                        background: 'white',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        textAlign: 'center'
                      }}
                    >
                      모두 해제
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <TrashButton
        $active={showTrash}
        onClick={() => setShowTrash(v => !v)}
        title={showTrash ? '성과 목록으로 돌아가기' : '삭제된 성과 보기'}
      >
        <Trash2 size={16} />
        {showTrash ? '목록으로' : '휴지통'}
        {deletedPerformances.length > 0 && (
          <TrashBadge $active={showTrash}>{deletedPerformances.length}</TrashBadge>
        )}
      </TrashButton>

      <ExportButton onClick={handleExportTableToCSV}>
        <FileSpreadsheet size={14} />
        테이블 저장
      </ExportButton>

      {canExport && (
        <ExportButton
          onClick={handleOpenExportModal}
          disabled={stats.totalPerformances + stats.withActionCount === 0}
          title="현재 연도의 성과 현황을 CSV로 저장"
        >
          <Download size={16} />
          로컬 저장
        </ExportButton>
      )}
    </ToolbarGroup>
  );

  return (
    <Container
      style={embedded
        ? { position: 'relative', flex: 1, minHeight: 0, height: 'auto' }
        : { position: 'relative' }}
    >
      {/* 로딩 오버레이 */}
      {isLoading && (
        <LoadingOverlay>
          <LoadingSpinner />
          <LoadingText>성과 데이터를 불러오는 중...</LoadingText>
        </LoadingOverlay>
      )}

      {embedded ? (
        /* 내장 모드: 통계 배지와 툴바를 상위(KPI 대시보드) 헤더 슬롯으로 포털 */
        <>
          {statsSlot && createPortal(statsContent, statsSlot)}
          {toolbarSlot && createPortal(toolbarContent, toolbarSlot)}
        </>
      ) : (
        <Header>
          <HeaderLeft>
            <Title>
              <Target size={28} />
              모든 성과 현황
            </Title>
            {statsContent}
          </HeaderLeft>

          <HeaderRight>
            {toolbarContent}
            <YearSelector>
              <YearButton onClick={handlePrevYear}>‹</YearButton>
              <YearDisplay>{currentYear}년</YearDisplay>
              <YearButton onClick={handleNextYear}>›</YearButton>
            </YearSelector>
          </HeaderRight>
        </Header>
      )}


      <FilterBar>
        <FilterButton
          $active={selectedDivision === 'all'}
          onClick={() => setSelectedDivision('all')}
        >
          전체
          <FilterBadge $active={selectedDivision === 'all'}>{stats.totalPerformances}</FilterBadge>
        </FilterButton>
        {divisions.map(division => {
          const count = getDivisionCount(division);
          return (
            <FilterButton
              key={division}
              $active={selectedDivision === division}
              onClick={() => setSelectedDivision(division)}
            >
              {division}
              <FilterBadge $active={selectedDivision === division}>{count}</FilterBadge>
            </FilterButton>
          );
        })}
      </FilterBar>

      {showTrash ? (
        /* ── 성과 휴지통 ────────────────────────────────────────────────────
           과제 휴지통과 달리 **완전 삭제 버튼이 없다** — 성과에는 영구삭제가
           없기 때문이다. 목록도 서버에서 따로 받는다(loadDeletedPerformances). */
        <TrashPanel>
          <TrashNotice>
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
            <span>
              삭제된 성과 목록입니다. 복구하면 성과 자체는 되살아나지만&nbsp;
              <strong>과제 연결은 복구되지 않습니다</strong> — 삭제할 때 끊겼기 때문에
              복구 후 각 과제에서 다시 연결해야 합니다.
              삭제된 성과의 복구는 관리자 또는 만든 사람만 할 수 있습니다.
            </span>
          </TrashNotice>

          <TrashFilterBar>
            <TrashSearchBox>
              <Search size={14} color="#94a3b8" />
              <input
                type="text"
                value={trashSearch}
                onChange={(e) => setTrashSearch(e.target.value)}
                placeholder="성과명 · 코드 · 분류로 검색"
              />
              {trashSearch && (
                <button
                  onClick={() => setTrashSearch('')}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex' }}
                  title="검색어 지우기"
                >
                  <X size={14} />
                </button>
              )}
            </TrashSearchBox>

            <TrashSelect value={trashYear} onChange={(e) => setTrashYear(e.target.value)}>
              <option value="all">전체 연도</option>
              {trashYears.map(y => <option key={y} value={y}>{y}년</option>)}
            </TrashSelect>

            <TrashCount>
              {filteredDeletedPerformances.length === deletedPerformances.length
                ? `${deletedPerformances.length}건`
                : `${filteredDeletedPerformances.length} / ${deletedPerformances.length}건`}
            </TrashCount>
          </TrashFilterBar>

          {trashLoading ? (
            <EmptyMessage><h3>삭제된 성과를 불러오는 중...</h3></EmptyMessage>
          ) : trashError ? (
            <EmptyMessage>
              <AlertTriangle size={48} />
              <h3>불러오지 못했습니다</h3>
              <p>{trashError}</p>
            </EmptyMessage>
          ) : filteredDeletedPerformances.length === 0 ? (
            <EmptyMessage>
              <Trash2 size={48} />
              <h3>{deletedPerformances.length === 0 ? '휴지통이 비어 있습니다' : '조건에 맞는 성과가 없습니다'}</h3>
              <p>{deletedPerformances.length === 0
                ? '삭제된 성과가 없습니다.'
                : '검색어나 연도를 바꿔보세요.'}</p>
            </EmptyMessage>
          ) : (
            filteredDeletedPerformances.map(perf => (
              <TrashRow key={perf.uuid}>
                <TrashRowMain>
                  <TrashRowTitle>{perf.displayName || perf.title || '(이름 없음)'}</TrashRowTitle>
                  <TrashRowMeta>
                    {perf.code && <span>{perf.code}</span>}
                    {perf.year && <span>{perf.year}년</span>}
                    {perf.category && <span>{perf.category}{perf.subcategory ? ` › ${perf.subcategory}` : ''}</span>}
                    {perf.unit && <span>단위 {perf.unit}</span>}
                    {perf.deletedAt && (
                      <span>
                        삭제일 {new Date(perf.deletedAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}
                        {perf.deletedByName && ` (${perf.deletedByName})`}
                      </span>
                    )}
                  </TrashRowMeta>
                </TrashRowMain>
                <RestoreButton
                  onClick={() => handleRestorePerformance(perf)}
                  disabled={restoringUuid === perf.uuid}
                >
                  <RotateCcw size={14} />
                  {restoringUuid === perf.uuid ? '복구 중...' : '복구'}
                </RestoreButton>
                {/* 영구 삭제는 서버가 관리자만 허용한다(403). 버튼도 관리자에게만 보인다 */}
                {isAdmin && (
                  <DangerButton
                    onClick={() => handlePermanentDeletePerformance(perf)}
                    disabled={restoringUuid === perf.uuid}
                    title="되돌릴 수 없습니다"
                  >
                    <Trash2 size={14} />
                    완전 삭제
                  </DangerButton>
                )}
              </TrashRow>
            ))
          )}
        </TrashPanel>
      ) : (
      <Content>
        {/* 테이블 보기 - 모든 성과 포함 */}
        {divisionsForTable.length === 0 ? (
            <EmptyMessage>
              <Target size={48} />
              <h3>{currentYear}년에 등록된 성과가 없습니다</h3>
              <p>성과 항목을 추가하거나 다른 연도를 선택해주세요.</p>
            </EmptyMessage>
          ) : (
          /* 테이블 보기 */
          <>
            {/* 활성 필터 상태 표시 */}
            {(tableFilters.category.length > 0 || tableFilters.subcategory.length > 0 || tableFilters.hasLinkedProject || tableFilters.hasKpiLink || tableFilters.needsAction || tableFilters.reportStatus) && (
              <FilterStatusBar>
                <Filter size={14} />
                <span>필터 적용중:</span>
                {tableFilters.category.length > 0 && (
                  <FilterTag>
                    대분류: {tableFilters.category.join(', ')}
                    <button onClick={(e) => { e.stopPropagation(); handleClearFilter('category', e); }}>
                      <X size={8} />
                    </button>
                  </FilterTag>
                )}
                {tableFilters.subcategory.length > 0 && (
                  <FilterTag>
                    소분류: {tableFilters.subcategory.join(', ')}
                    <button onClick={(e) => { e.stopPropagation(); handleClearFilter('subcategory', e); }}>
                      <X size={8} />
                    </button>
                  </FilterTag>
                )}
                {tableFilters.hasLinkedProject && (
                  <FilterTag>
                    연결과제: {tableFilters.hasLinkedProject === 'yes' ? '있음' : '없음'}
                    <button onClick={(e) => { e.stopPropagation(); handleClearFilter('hasLinkedProject', e); }}>
                      <X size={8} />
                    </button>
                  </FilterTag>
                )}
                {tableFilters.hasKpiLink && (
                  <FilterTag>
                    KPI 연결: {tableFilters.hasKpiLink === 'yes' ? '연결됨' : '미연결'}
                    <button onClick={(e) => { e.stopPropagation(); handleClearFilter('hasKpiLink', e); }}>
                      <X size={8} />
                    </button>
                  </FilterTag>
                )}
                {tableFilters.needsAction && (
                  <FilterTag>
                    수정필요: {tableFilters.needsAction === 'needs' ? '필요' : '정상'}
                    <button onClick={(e) => { e.stopPropagation(); handleClearFilter('needsAction', e); }}>
                      <X size={8} />
                    </button>
                  </FilterTag>
                )}
                {tableFilters.reportStatus && (
                  <FilterTag>
                    보고현황: {tableFilters.reportStatus === 'has' ? '있음' : tableFilters.reportStatus === 'none' ? '없음' : tableFilters.reportStatus}
                    <button onClick={(e) => { e.stopPropagation(); handleClearFilter('reportStatus', e); }}>
                      <X size={8} />
                    </button>
                  </FilterTag>
                )}
                <ClearAllFiltersButton
                  onClick={() => setTableFilters({ category: [], subcategory: [], hasLinkedProject: '', hasKpiLink: '', needsAction: '', reportStatus: '' })}
                >
                  <X size={12} />
                  전체 해제
                </ClearAllFiltersButton>
                <span style={{ marginLeft: '0.5rem', color: '#64748b' }}>
                  ({filteredTableRows.filter(r => !r.isSubtotal).length}개 항목)
                </span>
              </FilterStatusBar>
            )}
            <TableViewContainer>
            <StyledTable>
              <TableHeader>
                <tr>
                  <th style={{ width: '3%' }}>사업부</th>
                  {/* 대분류 필터 */}
                  <FilterHeaderCell
                    as="th"
                    style={{ width: '4%' }}
                    className="filter-header-cell"
                    onClick={(e) => handleFilterDropdownToggle('category', e)}
                  >
                    <FilterHeaderContent>
                      <span>대분류</span>
                      <FilterIcon $active={tableFilters.category.length > 0}>
                        <Filter size={12} />
                      </FilterIcon>
                    </FilterHeaderContent>
                    {tableFilters.category.length > 0 && (
                      <ActiveFilterBadge>{tableFilters.category.length}개 선택</ActiveFilterBadge>
                    )}
                    {activeFilterDropdown === 'category' && (
                      <FilterDropdown onClick={(e) => e.stopPropagation()}>
                        <FilterOption
                          $selected={tableFilters.category.length === 0}
                          onClick={() => setTableFilters(prev => ({ ...prev, category: [] }))}
                        >
                          <FilterOptionCheck $checked={tableFilters.category.length === 0}>
                            {tableFilters.category.length === 0 && <Check size={10} />}
                          </FilterOptionCheck>
                          전체
                        </FilterOption>
                        <FilterDivider />
                        {tableFilterOptions.categories.map(cat => (
                          <FilterOption
                            key={cat}
                            $selected={tableFilters.category.includes(cat)}
                            onClick={() => handleFilterChange('category', cat)}
                          >
                            <FilterOptionCheck $checked={tableFilters.category.includes(cat)}>
                              {tableFilters.category.includes(cat) && <Check size={10} />}
                            </FilterOptionCheck>
                            {cat}
                          </FilterOption>
                        ))}
                      </FilterDropdown>
                    )}
                  </FilterHeaderCell>
                  {/* 소분류 필터 */}
                  <FilterHeaderCell
                    as="th"
                    style={{ width: '8%' }}
                    className="filter-header-cell"
                    onClick={(e) => handleFilterDropdownToggle('subcategory', e)}
                  >
                    <FilterHeaderContent>
                      <span>소분류</span>
                      <FilterIcon $active={tableFilters.subcategory.length > 0}>
                        <Filter size={12} />
                      </FilterIcon>
                    </FilterHeaderContent>
                    {tableFilters.subcategory.length > 0 && (
                      <ActiveFilterBadge>{tableFilters.subcategory.length}개 선택</ActiveFilterBadge>
                    )}
                    {activeFilterDropdown === 'subcategory' && (
                      <FilterDropdown onClick={(e) => e.stopPropagation()}>
                        <FilterOption
                          $selected={tableFilters.subcategory.length === 0}
                          onClick={() => setTableFilters(prev => ({ ...prev, subcategory: [] }))}
                        >
                          <FilterOptionCheck $checked={tableFilters.subcategory.length === 0}>
                            {tableFilters.subcategory.length === 0 && <Check size={10} />}
                          </FilterOptionCheck>
                          전체
                        </FilterOption>
                        <FilterDivider />
                        {tableFilterOptions.subcategories.map(sub => (
                          <FilterOption
                            key={sub}
                            $selected={tableFilters.subcategory.includes(sub)}
                            onClick={() => handleFilterChange('subcategory', sub)}
                          >
                            <FilterOptionCheck $checked={tableFilters.subcategory.includes(sub)}>
                              {tableFilters.subcategory.includes(sub) && <Check size={10} />}
                            </FilterOptionCheck>
                            {sub}
                          </FilterOption>
                        ))}
                      </FilterDropdown>
                    )}
                  </FilterHeaderCell>
                  <th style={{ width: '14%' }}>성과항목명</th>
                  <th style={{ width: '5%' }}>현재</th>
                  <th style={{ width: '6%' }}>목표</th>
                  <th style={{ width: '6%' }}>실적</th>
                  <th style={{ width: '4%', textAlign: 'center' }}>DT기여도</th>
                  <th style={{ width: '9%' }}>상세설명</th>
                  {/* 연결된 과제 필터 */}
                  <FilterHeaderCell
                    as="th"
                    style={{ width: '13%' }}
                    className="filter-header-cell"
                    onClick={(e) => handleFilterDropdownToggle('hasLinkedProject', e)}
                  >
                    <FilterHeaderContent>
                      <span>연결된 과제</span>
                      <FilterIcon $active={!!tableFilters.hasLinkedProject}>
                        <Filter size={12} />
                      </FilterIcon>
                    </FilterHeaderContent>
                    {tableFilters.hasLinkedProject && (
                      <ActiveFilterBadge>
                        {tableFilters.hasLinkedProject === 'yes' ? '있음' : '없음'}
                      </ActiveFilterBadge>
                    )}
                    {activeFilterDropdown === 'hasLinkedProject' && (
                      <FilterDropdown onClick={(e) => e.stopPropagation()}>
                        <FilterOption
                          $selected={!tableFilters.hasLinkedProject}
                          onClick={() => handleFilterChange('hasLinkedProject', '')}
                        >
                          <FilterOptionCheck $checked={!tableFilters.hasLinkedProject}>
                            {!tableFilters.hasLinkedProject && <Check size={10} />}
                          </FilterOptionCheck>
                          전체
                        </FilterOption>
                        <FilterDivider />
                        <FilterOption
                          $selected={tableFilters.hasLinkedProject === 'yes'}
                          onClick={() => handleFilterChange('hasLinkedProject', 'yes')}
                        >
                          <FilterOptionCheck $checked={tableFilters.hasLinkedProject === 'yes'}>
                            {tableFilters.hasLinkedProject === 'yes' && <Check size={10} />}
                          </FilterOptionCheck>
                          연결됨
                        </FilterOption>
                        <FilterOption
                          $selected={tableFilters.hasLinkedProject === 'no'}
                          onClick={() => handleFilterChange('hasLinkedProject', 'no')}
                        >
                          <FilterOptionCheck $checked={tableFilters.hasLinkedProject === 'no'}>
                            {tableFilters.hasLinkedProject === 'no' && <Check size={10} />}
                          </FilterOptionCheck>
                          미연결
                        </FilterOption>
                      </FilterDropdown>
                    )}
                  </FilterHeaderCell>
                  {/* KPI 대시보드 연결 필터 */}
                  <FilterHeaderCell
                    as="th"
                    style={{ width: '9%' }}
                    className="filter-header-cell"
                    onClick={(e) => handleFilterDropdownToggle('hasKpiLink', e)}
                  >
                    <FilterHeaderContent>
                      <span>KPI 대시보드 연결</span>
                      <FilterIcon $active={!!tableFilters.hasKpiLink}>
                        <Filter size={12} />
                      </FilterIcon>
                    </FilterHeaderContent>
                    {tableFilters.hasKpiLink && (
                      <ActiveFilterBadge>
                        {tableFilters.hasKpiLink === 'yes' ? '연결됨' : '미연결'}
                      </ActiveFilterBadge>
                    )}
                    {activeFilterDropdown === 'hasKpiLink' && (
                      <FilterDropdown onClick={(e) => e.stopPropagation()}>
                        <FilterOption
                          $selected={!tableFilters.hasKpiLink}
                          onClick={() => handleFilterChange('hasKpiLink', '')}
                        >
                          <FilterOptionCheck $checked={!tableFilters.hasKpiLink}>
                            {!tableFilters.hasKpiLink && <Check size={10} />}
                          </FilterOptionCheck>
                          전체
                        </FilterOption>
                        <FilterDivider />
                        <FilterOption
                          $selected={tableFilters.hasKpiLink === 'yes'}
                          onClick={() => handleFilterChange('hasKpiLink', 'yes')}
                        >
                          <FilterOptionCheck $checked={tableFilters.hasKpiLink === 'yes'}>
                            {tableFilters.hasKpiLink === 'yes' && <Check size={10} />}
                          </FilterOptionCheck>
                          연결됨
                        </FilterOption>
                        <FilterOption
                          $selected={tableFilters.hasKpiLink === 'no'}
                          onClick={() => handleFilterChange('hasKpiLink', 'no')}
                        >
                          <FilterOptionCheck $checked={tableFilters.hasKpiLink === 'no'}>
                            {tableFilters.hasKpiLink === 'no' && <Check size={10} />}
                          </FilterOptionCheck>
                          미연결
                        </FilterOption>
                      </FilterDropdown>
                    )}
                  </FilterHeaderCell>
                  {/* 보고 현황 필터 */}
                  <FilterHeaderCell
                    as="th"
                    style={{ width: '7%' }}
                    className="filter-header-cell"
                    onClick={(e) => handleFilterDropdownToggle('reportStatus', e)}
                  >
                    <FilterHeaderContent>
                      <span>보고현황</span>
                      <FilterIcon $active={!!tableFilters.reportStatus}>
                        <Filter size={12} />
                      </FilterIcon>
                    </FilterHeaderContent>
                    {tableFilters.reportStatus && (
                      <ActiveFilterBadge>
                        {tableFilters.reportStatus === 'has' ? '있음' : tableFilters.reportStatus === 'none' ? '없음' : tableFilters.reportStatus}
                      </ActiveFilterBadge>
                    )}
                    {activeFilterDropdown === 'reportStatus' && (
                      <FilterDropdown onClick={(e) => e.stopPropagation()}>
                        <FilterOption
                          $selected={!tableFilters.reportStatus}
                          onClick={() => handleFilterChange('reportStatus', '')}
                        >
                          <FilterOptionCheck $checked={!tableFilters.reportStatus}>
                            {!tableFilters.reportStatus && <Check size={10} />}
                          </FilterOptionCheck>
                          전체
                        </FilterOption>
                        <FilterDivider />
                        <FilterOption
                          $selected={tableFilters.reportStatus === 'has'}
                          onClick={() => handleFilterChange('reportStatus', 'has')}
                        >
                          <FilterOptionCheck $checked={tableFilters.reportStatus === 'has'}>
                            {tableFilters.reportStatus === 'has' && <Check size={10} />}
                          </FilterOptionCheck>
                          보고 있음
                        </FilterOption>
                        <FilterOption
                          $selected={tableFilters.reportStatus === 'none'}
                          onClick={() => handleFilterChange('reportStatus', 'none')}
                        >
                          <FilterOptionCheck $checked={tableFilters.reportStatus === 'none'}>
                            {tableFilters.reportStatus === 'none' && <Check size={10} />}
                          </FilterOptionCheck>
                          보고 없음
                        </FilterOption>
                        {tableFilterOptions.reportItems.length > 0 && <FilterDivider />}
                        {tableFilterOptions.reportItems.map(item => (
                          <FilterOption
                            key={item}
                            $selected={tableFilters.reportStatus === item}
                            onClick={() => handleFilterChange('reportStatus', item)}
                          >
                            <FilterOptionCheck $checked={tableFilters.reportStatus === item}>
                              {tableFilters.reportStatus === item && <Check size={10} />}
                            </FilterOptionCheck>
                            {item}
                          </FilterOption>
                        ))}
                      </FilterDropdown>
                    )}
                  </FilterHeaderCell>
                  {/* 수정 필요 사항 필터 */}
                  <FilterHeaderCell
                    as="th"
                    style={{ width: '8%' }}
                    className="filter-header-cell"
                    onClick={(e) => handleFilterDropdownToggle('needsAction', e)}
                  >
                    <FilterHeaderContent>
                      <span>수정 필요</span>
                      <FilterIcon $active={!!tableFilters.needsAction}>
                        <Filter size={12} />
                      </FilterIcon>
                    </FilterHeaderContent>
                    {tableFilters.needsAction && (
                      <ActiveFilterBadge>
                        {tableFilters.needsAction === 'needs' ? '필요' : '정상'}
                      </ActiveFilterBadge>
                    )}
                    {activeFilterDropdown === 'needsAction' && (
                      <FilterDropdown onClick={(e) => e.stopPropagation()}>
                        <FilterOption
                          $selected={!tableFilters.needsAction}
                          onClick={() => handleFilterChange('needsAction', '')}
                        >
                          <FilterOptionCheck $checked={!tableFilters.needsAction}>
                            {!tableFilters.needsAction && <Check size={10} />}
                          </FilterOptionCheck>
                          전체
                        </FilterOption>
                        <FilterDivider />
                        <FilterOption
                          $selected={tableFilters.needsAction === 'normal'}
                          onClick={() => handleFilterChange('needsAction', 'normal')}
                        >
                          <FilterOptionCheck $checked={tableFilters.needsAction === 'normal'}>
                            {tableFilters.needsAction === 'normal' && <Check size={10} />}
                          </FilterOptionCheck>
                          정상 등록
                        </FilterOption>
                        <FilterOption
                          $selected={tableFilters.needsAction === 'needs'}
                          onClick={() => handleFilterChange('needsAction', 'needs')}
                        >
                          <FilterOptionCheck $checked={tableFilters.needsAction === 'needs'}>
                            {tableFilters.needsAction === 'needs' && <Check size={10} />}
                          </FilterOptionCheck>
                          수정 필요
                        </FilterOption>
                      </FilterDropdown>
                    )}
                  </FilterHeaderCell>
                  <th style={{ width: '4%', textAlign: 'center' }}>수정</th>
                </tr>
              </TableHeader>
              <TableBody>
                {filteredTableRows.map((row, index) => (
                    row.isSubtotal ? (
                      <SubtotalRow
                        key={row.id || index}
                        $bgColor={row.groupColor?.bg}
                        $borderColor={row.groupColor?.border}
                      >
                        <td>
                          <TableDivisionBadge $color={row.divisionColor}>
                            {row.division}
                          </TableDivisionBadge>
                        </td>
                        <CategoryCell>{row.category}</CategoryCell>
                        <CategoryCell>{row.subcategory}</CategoryCell>
                        <td>
                          <SubtotalLabel $labelColor={row.groupColor?.label}>
                            {row.isAverage ? 'μ' : 'Σ'} {row.name} ({row.itemCount}개)
                          </SubtotalLabel>
                        </td>
                        {(() => {
                          const cc = applyConversion(row.current, row.unit, row.division);
                          const ct = applyConversion(row.target, row.unit, row.division);
                          const ca = applyConversion(row.actual, row.unit, row.division);
                          const convDiff = applyConversion(row.diff, row.unit, row.division);
                          const displayUnit = cc.unit;
                          return (
                            <>
                              <ValueCell style={{ fontWeight: 700 }}>
                                {formatNumber(cc.value)}{displayUnit ? ` ${displayUnit}` : ''}
                              </ValueCell>
                              <ValueCell style={{ fontWeight: 700 }}>
                                {formatNumber(ct.value)}{displayUnit ? ` ${displayUnit}` : ''}
                                {convDiff.value !== 0 && (
                                  <span style={{ color: convDiff.value > 0 ? '#10b981' : '#ef4444', marginLeft: '0.25rem', fontSize: '0.7rem' }}>
                                    ({convDiff.value > 0 ? '+' : ''}{formatDiff(convDiff.value)})
                                  </span>
                                )}
                              </ValueCell>
                              <ValueCell style={{ fontWeight: 700 }}>
                                {formatNumber(ca.value)}{displayUnit ? ` ${displayUnit}` : ''}
                                {(() => {
                                  const actualDiff = formatDiff((parseFloat(ca.value) || 0) - (parseFloat(cc.value) || 0));
                                  return actualDiff !== 0 && (
                                    <span style={{ color: actualDiff > 0 ? '#10b981' : '#ef4444', marginLeft: '0.25rem', fontSize: '0.7rem' }}>
                                      ({actualDiff > 0 ? '+' : ''}{actualDiff})
                                    </span>
                                  );
                                })()}
                              </ValueCell>
                            </>
                          );
                        })()}
                        <td style={{ color: '#64748b', fontSize: '0.75rem', textAlign: 'center' }}>-</td>
                        <td style={{ color: '#64748b', fontSize: '0.75rem' }}>-</td>
                        <td style={{ color: '#64748b', fontSize: '0.75rem' }}>-</td>
                        <td style={{ color: '#64748b', fontSize: '0.75rem' }}>-</td>
                        <td style={{ color: '#64748b', fontSize: '0.75rem' }}>-</td>
                        <td style={{ color: '#64748b', fontSize: '0.75rem' }}>-</td>
                        <td></td>
                      </SubtotalRow>
                    ) : (
                      <GroupedRow
                        key={row.id || index}
                        $bgColor={row.groupColor?.bg ? `${row.groupColor.bg}90` : 'white'}
                        $borderColor={row.groupColor?.border ? `${row.groupColor.border}50` : '#f1f5f9'}
                      >
                        <td>
                          <TableDivisionBadge $color={row.divisionColor}>
                            {row.division}
                          </TableDivisionBadge>
                        </td>
                        <CategoryCell>{row.category}</CategoryCell>
                        <CategoryCell>{row.subcategory}</CategoryCell>
                        <td style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{row.name}</td>
                        {(() => {
                          const cc = applyConversion(row.current, row.unit, row.division);
                          const ct = applyConversion(row.target, row.unit, row.division);
                          const convDiff = applyConversion(row.diff, row.unit, row.division);
                          const displayUnit = cc.unit;
                          return (
                            <>
                              <ValueCell>
                                {hasLevel(row.current) ? `${formatNumber(cc.value)}${displayUnit ? ` ${displayUnit}` : ''}` : '-'}
                              </ValueCell>
                              <ValueCell>
                                {hasLevel(row.target) ? (
                                  <>
                                    {formatNumber(ct.value)}{displayUnit ? ` ${displayUnit}` : ''}
                                    {convDiff.value !== 0 && (
                                      <span style={{ color: convDiff.value > 0 ? '#10b981' : '#ef4444', marginLeft: '0.25rem', fontSize: '0.7rem' }}>
                                        ({convDiff.value > 0 ? '+' : ''}{formatDiff(convDiff.value)})
                                      </span>
                                    )}
                                  </>
                                ) : '-'}
                              </ValueCell>
                            </>
                          );
                        })()}
                        <ValueCell>
                          {row.isMonthly ? (
                            <button
                              onClick={() => {
                                setMonthlyModalPerformance(row.originalPerf);
                                setMonthlyModalOpen(true);
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                padding: '0.25rem 0.5rem',
                                background: '#eef2ff',
                                border: '1px solid #c7d2fe',
                                borderRadius: '0.375rem',
                                color: '#4f46e5',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                fontWeight: 500
                              }}
                              title="월별 실적 보기"
                            >
                              <Calendar size={12} />
                              월별
                            </button>
                          ) : hasLevel(row.actual) ? (
                            <>
                              {(() => {
                                const ca = applyConversion(row.actual, row.unit, row.division);
                                const cc2 = applyConversion(row.current, row.unit, row.division);
                                return (
                                  <>
                                    {formatNumber(ca.value)}{ca.unit ? ` ${ca.unit}` : ''}
                                    {(() => {
                                      const actualDiff = formatDiff((parseFloat(ca.value) || 0) - (parseFloat(cc2.value) || 0));
                                      return actualDiff !== 0 && (
                                        <span style={{ color: actualDiff > 0 ? '#10b981' : '#ef4444', marginLeft: '0.25rem', fontSize: '0.7rem' }}>
                                          ({actualDiff > 0 ? '+' : ''}{actualDiff})
                                        </span>
                                      );
                                    })()}
                                  </>
                                );
                              })()}
                            </>
                          ) : '-'}
                        </ValueCell>
                        <td style={{ fontSize: '0.75rem', textAlign: 'center', color: row.dtContribution !== '100' ? '#4f46e5' : '#64748b' }}>
                          {row.dtContribution}%
                        </td>
                        <td style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {row.description || '-'}
                        </td>
                        <ProjectsCell>
                          {row.linkedProjects.length > 0 ? (
                            <div className="project-list">
                              {row.linkedProjects.map((project, pIdx) => {
                                const projectYear = project.과제년도;
                                const isDifferentYear = projectYear && projectYear !== currentYear;
                                const handleProjectClick = () => {
                                  if (onEditProject) {
                                    // 전체 프로젝트 데이터 찾기
                                    const fullProject = projects.find(p =>
                                      (p.id && p.id === project.id) ||
                                      (p.uuid && p.uuid === project.uuid)
                                    );
                                    if (fullProject) {
                                      onEditProject(fullProject);
                                    }
                                  }
                                };
                                return (
                                  <span
                                    key={pIdx}
                                    className="project-badge"
                                    title={`${project.과제명} - 클릭하여 편집`}
                                    onClick={handleProjectClick}
                                    style={{
                                      cursor: onEditProject ? 'pointer' : 'default',
                                      transition: 'all 0.15s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                      if (onEditProject) {
                                        e.currentTarget.style.background = '#dbeafe';
                                        e.currentTarget.style.borderColor = '#60a5fa';
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = '';
                                      e.currentTarget.style.borderColor = '';
                                    }}
                                  >
                                    {isDifferentYear && (
                                      <span style={{
                                        display: 'inline-block',
                                        background: '#f59e0b',
                                        color: 'white',
                                        fontSize: '0.6rem',
                                        padding: '0.1rem 0.3rem',
                                        borderRadius: '0.25rem',
                                        marginRight: '0.3rem',
                                        fontWeight: 700
                                      }}>
                                        {projectYear}
                                      </span>
                                    )}
                                    {project.과제명}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <NoProjectsText>-</NoProjectsText>
                          )}
                        </ProjectsCell>
                        <KpiLinksCell>
                          {row.kpiLinks && row.kpiLinks.length > 0 ? (
                            <div className="kpi-list">
                              {row.kpiLinks.map((card, kIdx) => {
                                const labelParts = [];
                                if (card.division && card.division !== '전체') labelParts.push(card.division);
                                if (card.category && card.category !== '전체') labelParts.push(card.category);
                                if (Array.isArray(card.subcategories) && card.subcategories.length > 0) labelParts.push(card.subcategories.join(', '));
                                const contextLabel = labelParts.join(' · ');
                                const displayName = card.name || contextLabel || '(이름없음)';
                                const tooltip = [displayName, contextLabel, card.logic]
                                  .filter(Boolean)
                                  .join(' | ');
                                return (
                                  <span key={card.id ?? kIdx} className="kpi-badge" title={tooltip}>
                                    <BarChart3 size={11} />
                                    {displayName}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <NoKpiLinksText>-</NoKpiLinksText>
                          )}
                        </KpiLinksCell>
                        <ReportItemsCell>
                          {row.reportItems && row.reportItems.length > 0 ? (
                            <div className="report-list">
                              {row.reportItems.map((report, rIdx) => (
                                <span key={rIdx} className="report-badge" title={report}>
                                  {report}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <NoReportText>-</NoReportText>
                          )}
                        </ReportItemsCell>
                        <ActionItemsCell>
                          {row.actionItems && row.actionItems.length > 0 ? (
                            <div className="action-list">
                              {row.actionItems.map((action, aIdx) => (
                                <span key={aIdx} className="action-badge" title={action}>
                                  {action}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <NoActionText>정상</NoActionText>
                          )}
                        </ActionItemsCell>
                        <td style={{ textAlign: 'center', display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                          {row.originalPerf && (
                            <LinkButton
                              onClick={() => handleOpenLinkModal(row.originalPerf)}
                              title="과제 연결"
                            >
                              <Link2 size={16} />
                            </LinkButton>
                          )}
                          {onEditPerformance && row.originalPerf && (
                            <EditButton
                              onClick={() => onEditPerformance(row.originalPerf)}
                              title="성과 항목 수정"
                            >
                              <Pencil size={16} />
                            </EditButton>
                          )}
                        </td>
                      </GroupedRow>
                    )
                  ))}
              </TableBody>
            </StyledTable>
          </TableViewContainer>
          </>
        )}
      </Content>
      )}

      {/* 내보내기 옵션 모달 */}
      {exportModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}
          onClick={() => setExportModalOpen(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              width: '400px',
              maxWidth: '90%',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem',
              paddingBottom: '1rem',
              borderBottom: '1px solid #e2e8f0'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#1e293b' }}>
                성과 현황 내보내기
              </h3>
              <button
                onClick={() => setExportModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '0.25rem'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* 사업부 선택 */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: '#475569',
                  marginBottom: '0.5rem'
                }}>
                  사업부
                </label>
                <select
                  value={exportDivisionFilter}
                  onChange={(e) => setExportDivisionFilter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.625rem 0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    color: '#1e293b',
                    background: 'white'
                  }}
                >
                  <option value="all">전체 사업부</option>
                  {divisions.map(division => (
                    <option key={division} value={division}>{division}</option>
                  ))}
                </select>
              </div>

              {/* 과제 연결 여부 */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: '#475569',
                  marginBottom: '0.5rem'
                }}>
                  과제 연결 여부
                </label>
                <select
                  value={exportLinkedFilter}
                  onChange={(e) => setExportLinkedFilter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.625rem 0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    color: '#1e293b',
                    background: 'white'
                  }}
                >
                  <option value="all">전체 성과</option>
                  <option value="linked">과제 연결된 성과만</option>
                </select>
              </div>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              marginTop: '1.5rem',
              paddingTop: '1rem',
              borderTop: '1px solid #e2e8f0'
            }}>
              <button
                onClick={() => setExportModalOpen(false)}
                style={{
                  padding: '0.625rem 1rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  background: 'white',
                  color: '#475569',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                취소
              </button>
              <button
                onClick={handleExportToCSV}
                style={{
                  padding: '0.625rem 1rem',
                  border: 'none',
                  borderRadius: '0.375rem',
                  background: '#3b82f6',
                  color: 'white',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem'
                }}
              >
                <Download size={16} />
                내보내기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 과제 링크 모달 */}
      <AnimatePresence>
        {linkModalOpen && linkModalPerformance && (
          <LinkModalOverlay
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCloseLinkModal}
          >
            <LinkModalContainer
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
            >
              <LinkModalHeader>
                <LinkModalTitle>
                  <Link2 size={20} />
                  과제 연결 - {linkModalPerformance.성과항목}
                </LinkModalTitle>
                <LinkModalCloseButton onClick={handleCloseLinkModal}>
                  <X size={18} />
                </LinkModalCloseButton>
              </LinkModalHeader>

              <LinkModalBody>
                <LinkModalSection>
                  <h4><Briefcase size={16} /> 과제 검색</h4>
                  <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <LinkModalSearchInput style={{ flex: 1 }}>
                      <Search size={16} color="#94a3b8" />
                      <input
                        type="text"
                        placeholder="과제명 또는 사업부로 검색..."
                        value={linkModalSearchTerm}
                        onChange={(e) => setLinkModalSearchTerm(e.target.value)}
                      />
                    </LinkModalSearchInput>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 0.75rem',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '0.5rem'
                    }}>
                      <button
                        onClick={() => setLinkModalYearFilter(prev => prev - 1)}
                        style={{
                          background: '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          borderRadius: '0.25rem',
                          padding: '0.25rem 0.5rem',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: '#475569'
                        }}
                      >
                        ◀
                      </button>
                      <span style={{ minWidth: '50px', textAlign: 'center', fontWeight: 700, fontSize: '0.9rem' }}>
                        {linkModalYearFilter}
                      </span>
                      <button
                        onClick={() => setLinkModalYearFilter(prev => prev + 1)}
                        disabled={linkModalYearFilter >= currentYear}
                        style={{
                          background: linkModalYearFilter >= currentYear ? '#e2e8f0' : '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          borderRadius: '0.25rem',
                          padding: '0.25rem 0.5rem',
                          cursor: linkModalYearFilter >= currentYear ? 'not-allowed' : 'pointer',
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: linkModalYearFilter >= currentYear ? '#94a3b8' : '#475569',
                          opacity: linkModalYearFilter >= currentYear ? 0.5 : 1
                        }}
                      >
                        ▶
                      </button>
                    </div>
                  </div>
                  <LinkModalProjectList>
                    {filteredProjectsForModal.length === 0 ? (
                      <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
                        검색 결과가 없습니다
                      </div>
                    ) : (
                      filteredProjectsForModal.slice(0, 50).map(project => {
                        const isAlreadyLinked = linkedProjects.some(p => p.projectId === (project.id || project.uuid));
                        return (
                          <LinkModalProjectItem key={project.id || project.uuid}>
                            <div className="project-info">
                              <div className="project-name">{project.과제명}</div>
                              <div className="project-meta">
                                {project.사업부 && <span>{project.사업부}</span>}
                                {project.과제PL && <span> · PL: {project.과제PL}</span>}
                              </div>
                            </div>
                            {!isAlreadyLinked && (
                              <button
                                className="add-btn"
                                onClick={() => handleAddProjectLink(project)}
                              >
                                <Plus size={12} />
                                추가
                              </button>
                            )}
                            {isAlreadyLinked && (
                              <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 500 }}>
                                연결됨
                              </span>
                            )}
                          </LinkModalProjectItem>
                        );
                      })
                    )}
                  </LinkModalProjectList>
                </LinkModalSection>

                <LinkModalLinkedSection>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151', margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    <Target size={16} />
                    연결된 과제 ({linkedProjects.length}개)
                  </h4>
                  <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '0.5rem', background: '#f8fafc', padding: linkedProjects.length > 0 ? '0.5rem' : '0' }}>
                  {linkedProjects.length === 0 ? (
                    <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
                      연결된 과제가 없습니다.<br />좌측에서 과제를 검색하여 추가하세요.
                    </div>
                  ) : (
                    linkedProjects.map(project => {
                      const perfYear = linkModalPerformance?.성과년도;
                      const isDifferentYear = project.year && perfYear && project.year !== perfYear;
                      return (
                        <LinkModalLinkedItem key={project.projectId}>
                          <div className="project-info">
                            <div className="project-name">
                              {isDifferentYear && (
                                <span style={{
                                  display: 'inline-block',
                                  background: '#f59e0b',
                                  color: 'white',
                                  fontSize: '0.65rem',
                                  padding: '0.1rem 0.35rem',
                                  borderRadius: '0.25rem',
                                  marginRight: '0.4rem',
                                  fontWeight: 700
                                }}>
                                  {project.year}
                                </span>
                              )}
                              {project.projectName}
                            </div>
                            <div className="project-meta">{project.division}</div>
                          </div>
                        <div className="contribution-input">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            placeholder="0"
                            value={project.contribution}
                            onChange={(e) => handleContributionChange(project.projectId, e.target.value)}
                          />
                          <span>%</span>
                        </div>
                        <button
                          className="remove-btn"
                          onClick={() => handleRemoveProjectLink(project.projectId)}
                          title="연결 해제"
                        >
                          <Trash2 size={14} />
                        </button>
                      </LinkModalLinkedItem>
                      );
                    })
                  )}
                  </div>
                </LinkModalLinkedSection>
              </LinkModalBody>

              <LinkModalFooter>
                <LinkModalButton className="cancel" onClick={handleCloseLinkModal}>
                  취소
                </LinkModalButton>
                <LinkModalButton
                  className="save"
                  onClick={handleSaveLinkModal}
                  disabled={!onLinkProjectToPerformance}
                >
                  <Link2 size={16} />
                  저장
                </LinkModalButton>
              </LinkModalFooter>
            </LinkModalContainer>
          </LinkModalOverlay>
        )}
      </AnimatePresence>

      {/* 월별 실적 모달 */}
      {monthlyModalOpen && monthlyModalPerformance && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setMonthlyModalOpen(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={20} style={{ color: '#4f46e5' }} />
                월별 실적 현황
              </h3>
              <button
                onClick={() => setMonthlyModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  color: '#64748b'
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '0.5rem' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{monthlyModalPerformance.displayName || monthlyModalPerformance.성과항목}</div>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                {monthlyModalPerformance.대분류} › {monthlyModalPerformance.소분류}
                {monthlyModalPerformance.단위 && <span style={{ marginLeft: '0.5rem' }}>({monthlyModalPerformance.단위})</span>}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(idx => {
                const monthlyArray = monthlyModalPerformance.월별실적 || [];
                const value = Array.isArray(monthlyArray) ? monthlyArray[idx] : null;
                const hasValue = value !== null && value !== undefined && value !== '';

                return (
                  <div
                    key={idx}
                    style={{
                      padding: '0.75rem',
                      background: hasValue ? '#eef2ff' : '#f8fafc',
                      borderRadius: '0.5rem',
                      textAlign: 'center',
                      border: `1px solid ${hasValue ? '#c7d2fe' : '#e2e8f0'}`
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>{idx + 1}월</div>
                    <div style={{ fontWeight: 600, color: hasValue ? '#4f46e5' : '#94a3b8' }}>
                      {hasValue ? formatNumber(value) : '-'}
                      {hasValue && monthlyModalPerformance.단위 && <span style={{ fontSize: '0.7rem', marginLeft: '0.15rem' }}>{monthlyModalPerformance.단위}</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 연간 합계/평균 */}
            {(() => {
              const monthlyArray = monthlyModalPerformance.월별실적 || [];
              const values = Array.isArray(monthlyArray)
                ? monthlyArray.map(v => parseFloat(v) || 0).filter(v => v !== 0)
                : [];

              if (values.length === 0) return null;

              const sum = values.reduce((a, b) => a + b, 0);
              const avg = formatNumber(sum / values.length);
              const unit = monthlyModalPerformance.단위 || '';
              const isPercentage = unit === '%';

              return (
                <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#fef3c7', borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-around' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: '#92400e' }}>연간 합계</div>
                    <div style={{ fontWeight: 700, color: '#d97706' }}>{formatNumber(sum)}{unit && ` ${unit}`}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: '#92400e' }}>평균 ({values.length}개월)</div>
                    <div style={{ fontWeight: 700, color: '#d97706' }}>{avg}{unit && ` ${unit}`}</div>
                  </div>
                </div>
              );
            })()}

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setMonthlyModalOpen(false)}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </Container>
  );
};

export default AllPerformancesView;
