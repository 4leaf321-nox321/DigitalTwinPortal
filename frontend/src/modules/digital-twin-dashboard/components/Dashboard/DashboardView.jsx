import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { Download, X, ChevronDown, AlertTriangle, CheckCircle2, Calendar, FolderOpen, Plus, Trash2, Pencil } from 'lucide-react';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';
import ProjectSummary from './ProjectSummary';
import ProgressTrendChart from './ProgressTrendChart';
import PerformanceOverview from './PerformanceOverview';
import DepartmentStatus from './DepartmentStatus';
import AllProjectsView from './AllProjectsView';
import KPIDashboard from './KPIDashboard';
import ProjectReportView from './ProjectReportView';
// 과제 상세 모달 — '모든 과제 현황' 과 **같은 컴포넌트**를 전체 요약에서도 띄운다
import ProjectDetailModal from './ProjectDetailModal';
import { useAuth } from '../../../../contexts/AuthContext';
import { getActionItemCreatedAt } from '../ProjectModal/components/ActionItemsSection';
import { fetchKpiDefinitions, fetchRecords as fetchKpiRecords, fetchTargets as fetchKpiTargets } from '../../../dx-kpi-management/services/kpiApi';
import { fetchKPIDashboardCards, saveSystemSettings } from '../../services/settingsApi';
import {
  achievement as calcAchievement,
  targetNumber,
  changeOf,
  changeColor,
} from '../../../../shared/utils/kpiAchievement';
import { evalFactor } from '../../utils/evalFactor';
// 수준값의 0 과 미입력은 다른 뜻이다. `parseFloat(v) || null` 은 0 을 null 로 접는다.
import { levelNumber, percentText, levelDelta } from '../../utils/levelValue';
import { toLocalYmd, todayLocalYmd } from '../../../../shared/utils/localDate';
import { LineChart, Line, BarChart, Bar, LabelList, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend as RechartsLegend, ResponsiveContainer } from 'recharts';

const EXEC_DIV_COLORS = {
  'MX': '#6366f1',
  'VD': '#10b981',
  'DA': '#f59e0b',
  'NW': '#ef4444',
  '의료기기': '#8b5cf6',
  'CS': '#14b8a6',
  'GTR': '#0ea5e9',
  'SR': '#ec4899'
};
const EXEC_DIV_ORDER = ['MX', 'VD', 'DA', 'NW', '의료기기', 'CS', 'GTR', 'SR'];
const EXEC_DIV_LABEL = { '의료기기': '의료' };
const execDivDisplayName = (div) => EXEC_DIV_LABEL[div] || div;

// 취소 시각이 없는 옛 과제. **과거로 취급**해서 최근 변경 목록에 안 끼게 한다 —
// 언제 빠졌는지 모르는 것을 "방금 빠졌다" 고 말하는 것보다 낫다.
const REMOVED_LONG_AGO = '1970-01-01T00:00:00.000Z';

/**
 * 과제가 **모집단에서 빠진 시점과 이유.** 안 빠졌으면 `{at: null}`.
 *
 * 🐞 예전에는 `_deleted` 를 먼저 봤다. 그래서 **취소한 뒤 나중에 지운 과제**가
 *    「삭제」 로, 그것도 **지운 날짜에** 빠진 것으로 잡혔다. 실제로는 취소한 그날
 *    이미 빠졌고, 삭제는 이미 없는 것을 치운 것뿐이다. 화면에는 몇 달 전에 취소한
 *    과제가 "이번 주에 삭제됨" 으로 떴다.
 *
 * **둘 중 먼저 일어난 것**이 빠진 시점이다. 한 과제가 두 번 빠질 수는 없다.
 * (`trend_view._project_span` 이 서버에서 쓰는 규칙과 같다 — 곡선과 목록이
 *  같은 날을 가리켜야 한다)
 */
const projectRemoval = (p) => {
  const cancel = p.진행상태 === '취소'
    ? { at: p._canceledAt || REMOVED_LONG_AGO, reason: '취소' }
    : null;
  const del = p._deleted
    ? { at: p._deletedAt || p.updatedAt || null, reason: '삭제' }
    : null;
  if (cancel && del) {
    // ⚠️ 견줄 때는 **진짜 삭제 시각만** 쓴다. `updatedAt` 은 편집할 때마다 갱신돼서
    //    "취소한 뒤 한 번 고쳤다" 를 "취소보다 나중에 삭제됐다" 로 오판한다.
    if (!p._deletedAt) return cancel;
    return new Date(cancel.at) <= new Date(p._deletedAt) ? cancel : del;
  }
  return cancel || del || { at: null, reason: '' };
};

// 막대 차트 Y축 범위 계산: 최댓값이 범위의 ~80%를 차지하도록 하고,
// 축 최댓값/눈금 간격은 1·2·5 계열(…10·20·50·100·200·500…)의 "딱 떨어지는" 값으로 맞춤.
// 예) 최댓값 286 → 350(눈금 50), 최댓값 2860 → 3500(눈금 500)
const niceAxis = (maxVal) => {
  if (!(maxVal > 0)) return null;
  const target = maxVal / 0.8; // 최댓값이 80%가 되는 이상적인 축 상단
  const round6 = (n) => Math.round(n * 1e6) / 1e6;
  let best = null;
  for (let k = -2; k <= 12; k++) {
    const base = Math.pow(10, k);
    for (const m of [1, 2, 5]) {
      const step = round6(base * m);
      if (step <= 0) continue;
      let M = Math.round(target / step) * step; // 이상값에 가장 가까운 step 배수
      if (M < maxVal) M += step;                // 막대가 범위를 넘지 않도록 보정
      M = round6(M);
      const ticks = Math.round(M / step);
      if (ticks < 3 || ticks > 12) continue;    // 눈금 너무 적거나 많으면 제외
      const fill = maxVal / M;
      if (fill > 0.92) continue;                // 막대가 천장에 붙으면 라벨이 잘림 → 제외
      // 점수: fill을 0.8에 가깝게 + 눈금 5~9개 선호
      const tickPenalty = ticks < 5 ? (5 - ticks) * 0.05 : ticks > 9 ? (ticks - 9) * 0.05 : 0;
      const score = Math.abs(fill - 0.8) + tickPenalty;
      if (!best || score < best.score) best = { step, M, ticks, score };
    }
  }
  if (!best) return null;
  const tickArr = [];
  for (let v = 0; v <= best.M + 1e-9; v = round6(v + best.step)) tickArr.push(v);
  return { max: best.M, step: best.step, ticks: tickArr };
};
// DX KPI 표/대표법인 입력 대상 사업부 (KPI 메모의 DIVISION_NAME_TO_ID 와 동일)
const KPI_DIVISIONS = ['MX', 'VD', 'DA', 'NW', '의료기기'];

const Container = styled.div`
  width: 100%;
  padding: ${props => props.$noPadding ? '0' : '2rem'};
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: ${props => props.$noPadding ? '0' : '2rem'};
  height: ${props => props.$fullHeight ? '100%' : 'auto'};

  /* recharts: 클릭/포커스 시 브라우저 기본 outline (검은 테두리) 제거 */
  .recharts-bar-rectangle,
  .recharts-bar-rectangle path,
  .recharts-bar-rectangles,
  .recharts-layer,
  .recharts-rectangle,
  svg path,
  svg rect,
  svg g {
    outline: none !important;
  }
  .recharts-bar-rectangle:focus,
  .recharts-bar-rectangle:focus-visible,
  .recharts-bar-rectangle path:focus,
  .recharts-bar-rectangle path:focus-visible,
  svg :focus,
  svg :focus-visible {
    outline: none !important;
  }
`;

const TopSection = styled.div`
  width: 100%;
  margin-bottom: 2rem;
  /* 화면 높이에서 헤더(64px) + 연도선택(약 60px) + 마진 등을 뺀 높이 */
  min-height: calc(100vh - 64px - 60px - 4rem);
`;

const MiddleSection = styled.div`
  width: 100%;
  margin-bottom: 2rem;
  /* 전체 성과 분류 현황이 화면 전체 높이를 차지하도록 설정 */
  /* 헤더(64px) + 연도선택/상단섹션/마진 등을 고려 */
  min-height: calc(100vh - 64px - 2rem);
`;

const BottomGrid = styled.div`
  display: flex;
  width: 100%;
  /* "전체 성과 분류 현황"과 동일한 높이 */
  min-height: calc(100vh - 64px - 2rem);

  @media (max-width: 1200px) {
    flex-direction: column;
  }
`;

const EmptyPlaceholder = styled.div`
  background: white;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  font-size: 0.875rem;
  min-height: 300px;
`;

const TrendContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: #f8fafc;
  overflow: hidden;
`;

const TrendHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background: white;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
`;

const TrendHeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const TrendTitle = styled.h1`
  font-size: 1.5rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const TrendHeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const ProgressViewToggle = styled.div`
  display: flex;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  overflow: hidden;
`;

const ProgressViewButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.875rem;
  background: ${props => props.$active ? 'white' : 'transparent'};
  color: ${props => props.$active ? '#1e293b' : '#64748b'};
  border: none;
  font-size: 0.8rem;
  font-weight: ${props => props.$active ? '600' : '500'};
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: ${props => props.$active ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none'};

  &:hover {
    color: ${props => props.$active ? '#1e293b' : '#475569'};
    background: ${props => props.$active ? 'white' : '#e2e8f0'};
  }
`;

const TrendYearSelector = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: white;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid #e2e8f0;
`;

const TrendYearButton = styled.button`
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

const TrendYearDisplay = styled.div`
  font-size: 1rem;
  font-weight: 700;
  color: #1e293b;
  min-width: 60px;
  text-align: center;
`;

const TrendContent = styled.div`
  flex: 1;
  padding: 2rem;
  overflow-y: auto;
`;

const TrendFilterBar = styled.div`
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem 2rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
  flex-wrap: wrap;
`;

const TrendFilterButton = styled.button`
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

const TrendFilterBadge = styled.span`
  padding: 0.125rem 0.375rem;
  background: ${props => props.$active ? 'rgba(255,255,255,0.3)' : '#e2e8f0'};
  border-radius: 0.25rem;
  font-size: 0.7rem;
`;

const DetailViewContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
  border-radius: 1rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid #e2e8f0;
  overflow: hidden;
`;

const DetailViewHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
`;

const WeekSelector = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: white;
  padding: 0.375rem 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid #e2e8f0;
`;

const WeekButton = styled.button`
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #475569;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #e2e8f0;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const WeekDisplay = styled.div`
  font-size: 0.9rem;
  font-weight: 600;
  color: #1e293b;
  min-width: 50px;
  text-align: center;
`;

const DetailTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
`;

const DetailTableHead = styled.thead`
  background: #f1f5f9;
  position: sticky;
  top: 0;
  z-index: 1;
`;

const DetailTableTh = styled.th`
  padding: 0.75rem 1rem;
  text-align: left;
  font-weight: 600;
  color: #475569;
  border-bottom: 2px solid #e2e8f0;
  white-space: nowrap;

  &:first-child {
    padding-left: 1.5rem;
  }
`;

const DetailTableBody = styled.tbody`
  tr:nth-child(even) {
    background: #f8fafc;
  }

  tr:hover {
    background: #f1f5f9;
  }
`;

const DetailTableTd = styled.td`
  padding: 0.75rem 1rem;
  color: #334155;
  border-bottom: 1px solid #e2e8f0;
  vertical-align: top;

  &:first-child {
    padding-left: 1.5rem;
  }
`;

const CompletedItemsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const CompletedItem = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.375rem;
  font-size: 0.8rem;
  color: ${props => props.$isActivity ? '#8b5cf6' : '#10b981'};

  &::before {
    content: '${props => props.$isActivity ? '-' : '□'}';
    font-size: ${props => props.$isActivity ? '0.8rem' : '0.7rem'};
    margin-top: ${props => props.$isActivity ? '0' : '0.1rem'};
  }
`;

const ActionItemGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
`;

const ActionItemTitle = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.375rem;
  font-size: 0.8rem;
  color: #10b981;

  &::before {
    content: '□';
    font-size: 0.7rem;
    margin-top: 0.1rem;
  }
`;

const NestedActivityItem = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.375rem;
  font-size: 0.8rem;
  color: #8b5cf6;
  padding-left: 1rem;

  &::before {
    content: '-';
    font-size: 0.8rem;
  }
`;

const EmptyCell = styled.span`
  color: #cbd5e1;
  font-style: italic;
`;

const IssueItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  font-size: 0.8rem;
  padding: 0.25rem 0;
  border-bottom: 1px dashed #e2e8f0;

  &:last-child {
    border-bottom: none;
  }
`;

const IssueTitle = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.375rem;
  color: ${props => props.$resolved ? '#10b981' : '#ef4444'};
  font-weight: 500;

  &::before {
    content: '${props => props.$resolved ? '✓' : '!'}';
    font-size: 0.7rem;
    font-weight: bold;
  }
`;

const IssueComment = styled.div`
  font-size: 0.75rem;
  color: #64748b;
  padding-left: 1rem;
  font-style: italic;
`;

const IssuesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const ExportButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #059669;
  }

  &:disabled {
    background: #9ca3af;
    cursor: not-allowed;
  }
`;

const ExportDropdownWrapper = styled.div`
  position: relative;
  display: inline-block;
  margin-left: 0.5rem;
`;

const ExportDropdownToggle = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #059669;
  }

  &:disabled {
    background: #9ca3af;
    cursor: not-allowed;
  }
`;

const ExportDropdownMenu = styled.div`
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 0.25rem;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 50;
  min-width: 160px;
  overflow: hidden;
`;

const ExportDropdownItem = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.6rem 1rem;
  background: white;
  color: #374151;
  border: none;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: #f3f4f6;
  }

  &:not(:last-child) {
    border-bottom: 1px solid #f3f4f6;
  }
`;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContainer = styled.div`
  background: white;
  border-radius: 1rem;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
  width: 80%;
  height: 80%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #e2e8f0;
  background: ${props => props.$bgColor || '#f8fafc'};
`;

const ModalTitle = styled.h2`
  font-size: 1.125rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ModalCloseButton = styled.button`
  background: none;
  border: none;
  padding: 0.5rem;
  cursor: pointer;
  color: #64748b;
  border-radius: 0.375rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;

  &:hover {
    background: #f1f5f9;
    color: #1e293b;
  }
`;

const ModalBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.5rem;
`;

const ProjectListItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  margin-bottom: 0.5rem;
  background: white;
  transition: all 0.2s ease;

  &:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
  }

  &:last-child {
    margin-bottom: 0;
  }
`;

const ProjectBadge = styled.span`
  padding: 0.25rem 0.5rem;
  background: ${props => props.$bgColor || '#e2e8f0'};
  color: ${props => props.$textColor || '#475569'};
  font-size: 0.7rem;
  font-weight: 600;
  border-radius: 0.25rem;
  white-space: nowrap;
`;

const ProjectName = styled.span`
  flex: 1;
  font-size: 0.9rem;
  color: #334155;
  font-weight: 500;
`;

const ClickableRateSection = styled.div`
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 0.25rem;
  margin: -0.25rem;
  border-radius: 0.5rem;

  &:hover {
    background: ${props => props.$hoverBg || '#f8fafc'};
  }
`;

const ModalFooter = styled.div`
  padding: 1rem 1.5rem;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const YearSelectorContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-bottom: 1.5rem;
  gap: 1rem;
`;

const YearSelector = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: white;
  padding: 0.75rem 1.25rem;
  border-radius: 0.75rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid #e2e8f0;
`;

const YearButton = styled.button`
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #475569;
  padding: 0.375rem 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #e2e8f0;
    border-color: #94a3b8;
    color: #334155;
  }

  &:active {
    transform: scale(0.98);
  }
`;

const YearDisplay = styled.div`
  font-size: 1.125rem;
  font-weight: 700;
  color: #1e293b;
  min-width: 80px;
  text-align: center;
`;

const RefDateBar = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 2rem;
  background: white;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
  flex-wrap: wrap;
`;

const RefDateLabel = styled.div`
  font-size: 0.875rem;
  font-weight: 600;
  color: #475569;
  display: flex;
  align-items: center;
  gap: 0.375rem;
`;

const RefDatePresetGroup = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const RefDatePresetButton = styled.button`
  padding: 0.4rem 0.85rem;
  background: ${props => props.$active ? '#6366f1' : 'white'};
  color: ${props => props.$active ? 'white' : '#64748b'};
  border: 1px solid ${props => props.$active ? '#6366f1' : '#e2e8f0'};
  border-radius: 0.5rem;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.$active ? '#4f46e5' : '#f8fafc'};
    border-color: ${props => props.$active ? '#4f46e5' : '#cbd5e1'};
  }
`;

const RefDateInput = styled.input`
  padding: 0.4rem 0.6rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
  font-size: 0.85rem;
  color: #1e293b;
  background: white;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }
`;

const RefDateHint = styled.div`
  font-size: 0.8rem;
  color: #94a3b8;
  margin-left: auto;
`;

const KpiSelectorWrap = styled.div`
  position: relative;
  display: inline-flex;
`;

const KpiSelectorButton = styled.button`
  padding: 0.4rem 0.85rem;
  background: ${p => p.$active ? '#6366f1' : 'white'};
  color: ${p => p.$active ? 'white' : '#475569'};
  border: 1px solid ${p => p.$active ? '#6366f1' : '#cbd5e1'};
  border-radius: 0.5rem;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  transition: all 0.15s ease;

  &:hover {
    background: ${p => p.$active ? '#4f46e5' : '#f8fafc'};
    border-color: ${p => p.$active ? '#4f46e5' : '#94a3b8'};
  }
`;

const SaveImageButton = styled.button`
  padding: 0.4rem 0.85rem;
  background: white;
  color: #475569;
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  transition: all 0.15s ease;
  margin-left: 0.4rem;

  &:hover:not(:disabled) {
    background: #f8fafc;
    border-color: #94a3b8;
  }

  &:disabled {
    opacity: 0.55;
    cursor: wait;
  }
`;

const KpiSelectorOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 90;
`;

const KpiSelectorPanel = styled.div`
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 100;
  width: 320px;
  max-height: 500px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const KpiSelectorHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
`;

const KpiSelectorHeaderTitle = styled.div`
  font-size: 0.85rem;
  font-weight: 700;
  color: #1e293b;
`;

const KpiSelectorHeaderActions = styled.div`
  display: flex;
  gap: 0.4rem;
`;

const KpiSelectorMiniButton = styled.button`
  padding: 0.2rem 0.5rem;
  background: white;
  border: 1px solid #cbd5e1;
  border-radius: 0.375rem;
  font-size: 0.7rem;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  &:hover { background: #f1f5f9; }
`;

const KpiSelectorBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 0;
`;

const KpiSelectorGroupTitle = styled.div`
  padding: 0.5rem 1rem 0.3rem;
  font-size: 0.7rem;
  font-weight: 700;
  color: ${p => p.$color || '#64748b'};
  letter-spacing: 0.02em;
`;

const KpiSelectorRow = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 1rem;
  font-size: 0.8rem;
  color: #334155;
  cursor: pointer;
  user-select: none;

  &:hover { background: #f8fafc; }

  input {
    cursor: pointer;
    accent-color: #6366f1;
  }
`;

const KpiSelectorFooter = styled.div`
  padding: 0.6rem 1rem;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
  font-size: 0.72rem;
  color: #64748b;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const KpiSelectorTabBar = styled.div`
  display: flex;
  border-bottom: 1px solid #e2e8f0;
  background: white;
`;

const ConvSection = styled.div`
  border-bottom: 1px solid #e2e8f0;
  background: #fafbfc;
  padding: 0.5rem 0.85rem 0.6rem;
`;

const ConvSectionTitle = styled.div`
  font-size: 0.7rem;
  font-weight: 700;
  color: #475569;
  margin-bottom: 0.4rem;
  display: flex;
  align-items: center;
  gap: 0.3rem;
`;

const ConvChipGroup = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
`;

const ConvChip = styled.button`
  padding: 0.2rem 0.55rem;
  background: ${p => p.$active ? '#6366f1' : 'white'};
  color: ${p => p.$active ? 'white' : '#475569'};
  border: 1px solid ${p => p.$active ? '#6366f1' : '#cbd5e1'};
  border-radius: 0.35rem;
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  transition: all 0.15s ease;

  &:hover {
    background: ${p => p.$active ? '#4f46e5' : '#f1f5f9'};
  }
`;

const ConvEmpty = styled.div`
  font-size: 0.7rem;
  color: #94a3b8;
  font-style: italic;
`;

const KpiSelectorTab = styled.button`
  flex: 1;
  padding: 0.55rem 0.5rem;
  background: ${p => p.$active ? '#eef2ff' : 'white'};
  color: ${p => p.$active ? '#4338ca' : '#64748b'};
  border: none;
  border-bottom: 2px solid ${p => p.$active ? '#6366f1' : 'transparent'};
  font-size: 0.78rem;
  font-weight: ${p => p.$active ? 700 : 500};
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: ${p => p.$active ? '#eef2ff' : '#f8fafc'};
  }
`;

const ExecPerfFullRow = styled.div`
  padding: 0 2rem 1.5rem;
`;

const ExecPerfGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.85rem;
  margin-top: 0.85rem;

  @media (max-width: 1400px) {
    grid-template-columns: repeat(3, 1fr);
  }
  @media (max-width: 800px) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const ExecPerfCard = styled.div`
  border: 1px solid #e2e8f0;
  border-radius: 0.6rem;
  background: white;
  overflow: hidden;
`;

const ExecPerfCardHeader = styled.div`
  padding: 0.45rem 0.75rem;
  background: #f8fafc;
  border-bottom: 1px solid #f1f5f9;
  font-size: 0.95rem;
  font-weight: 800;
  color: ${p => p.$color || '#1e293b'};
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &::before {
    content: '';
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: ${p => p.$color || '#94a3b8'};
  }
`;

const ExecPerfCardBody = styled.div`
  padding: 0.5rem 0.4rem 0.4rem;
`;

const ExecPerfEmpty = styled.div`
  padding: 2rem 1rem;
  text-align: center;
  color: #94a3b8;
  font-size: 0.8rem;
`;

const KPICardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 1rem;
  padding: 0.75rem 2rem 1.5rem;

  @media (max-width: 1700px) {
    grid-template-columns: repeat(3, 1fr);
  }
  @media (max-width: 900px) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const KPICard = styled.div`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  padding: 0.85rem 1.1rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 4px;
    height: 100%;
    background: ${props => props.$accent || '#6366f1'};
  }
`;

const KPICardValueRow = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.6rem;
  flex-wrap: wrap;
`;

const ExecDivCardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 0.75rem;
  padding: 0.75rem 2rem 1.5rem;

  @media (max-width: 1500px) {
    grid-template-columns: repeat(4, 1fr);
  }
  @media (max-width: 800px) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const ExecTotalBar = styled.div`
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  margin: 0 2rem 0;
  padding: 0.85rem 1rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.7rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);

  @media (max-width: 800px) {
    grid-template-columns: repeat(2, 1fr);
    row-gap: 0.75rem;
  }
`;

const ExecTotalCell = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  text-align: center;
  border-left: 1px solid #f1f5f9;

  &:first-child {
    border-left: none;
  }
`;

const ExecTotalLabel = styled.div`
  font-size: 0.72rem;
  font-weight: 700;
  color: #94a3b8;
  letter-spacing: 0.02em;
`;

const ExecTotalValue = styled.div`
  font-size: 1.4rem;
  font-weight: 800;
  color: #1e293b;
  line-height: 1;
  display: inline-flex;
  align-items: baseline;
`;

const ExecTotalUnit = styled.span`
  font-size: 0.78rem;
  color: #94a3b8;
  font-weight: 600;
  margin-left: 0.15rem;
`;

const ExecDivCardBox = styled.div`
  background: ${p => p.$bgColor || 'white'};
  border: 1.5px solid ${p => p.$borderColor || '#e2e8f0'};
  border-radius: 0.7rem;
  padding: 0.6rem 0.55rem 0.55rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  }
`;

const ExecDivCardHeader = styled.div`
  display: flex;
  justify-content: center;
  align-items: baseline;
  gap: 0.4rem;
  padding-bottom: 0.4rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.6);
`;

const ExecDivCardName = styled.span`
  font-size: 1.2rem;
  font-weight: 800;
  color: ${p => p.$color || '#1e293b'};
  letter-spacing: 0.01em;
`;

const ExecDivCardCount = styled.span`
  font-size: 0.78rem;
  font-weight: 600;
  color: #64748b;
`;

const ExecDivCardMetricsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.35rem;
`;

const ExecDivCardMetric = styled.div`
  background: rgba(255, 255, 255, 0.9);
  border-radius: 0.45rem;
  padding: 0.45rem 0.35rem 0.4rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
`;

const ExecDivCardMetricLabel = styled.div`
  font-size: 0.72rem;
  font-weight: 700;
  color: #94a3b8;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  line-height: 1.25;
  /* 항상 2줄 높이를 확보해 카드별 값 위치가 흔들리지 않게 함 */
  min-height: 2.05em;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  word-break: keep-all;
`;

const ExecDivCardMetricValue = styled.div`
  font-size: 1.3rem;
  font-weight: 800;
  color: #1e293b;
  line-height: 1;
  display: inline-flex;
  align-items: baseline;
  gap: 0.05rem;
`;

const ExecDivCardSlash = styled.span`
  color: #cbd5e1;
  font-weight: 600;
  margin: 0 0.05rem;
`;

const ExecDivCardCompleted = styled.span`
  color: ${p => p.$color || '#059669'};
`;

const ExecDivCardDelta = styled.span`
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.1rem 0.4rem;
  border-radius: 0.3rem;
  color: ${p => p.$delta > 0 ? '#047857' : p.$delta < 0 ? '#b91c1c' : '#94a3b8'};
  background: ${p => p.$delta > 0 ? '#d1fae5' : p.$delta < 0 ? '#fee2e2' : '#f1f5f9'};
  white-space: nowrap;
  line-height: 1.2;
`;

const ExecDivCardCompletedLine = styled.div`
  margin-top: 0.2rem;
  font-size: 0.72rem;
  font-weight: 700;
  color: #475569;
  white-space: nowrap;
  display: inline-flex;
  align-items: baseline;
  gap: 0.2rem;
`;

const ExecDivCardCompletedRate = styled.span`
  color: #059669;
  font-weight: 800;
`;

const KPICardValueGroup = styled.div`
  display: inline-flex;
  align-items: baseline;
  gap: 0.4rem;
`;

const KPICardDeltaBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: ${p => p.$delta > 0 ? '#10b981' : p.$delta < 0 ? '#ef4444' : '#94a3b8'};
  background: ${p => p.$delta > 0 ? '#d1fae5' : p.$delta < 0 ? '#fee2e2' : '#f1f5f9'};
  padding: 0.15rem 0.4rem;
  border-radius: 0.35rem;
  white-space: nowrap;
  line-height: 1;
`;

const KPICardRefHint = styled.span`
  font-size: 0.72rem;
  font-weight: 500;
  color: #cbd5e1;
  white-space: nowrap;
`;

const KPICardLabel = styled.div`
  font-size: 0.85rem;
  font-weight: 600;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 0.4rem;
`;

const KPICardValue = styled.div`
  font-size: 1.6rem;
  font-weight: 800;
  color: #1e293b;
  line-height: 1.1;
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
`;

const KPICardUnit = styled.span`
  font-size: 0.95rem;
  font-weight: 600;
  color: #64748b;
`;

const KPICardDelta = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.85rem;
  font-weight: 700;
  color: ${props => props.$delta > 0 ? '#10b981' : props.$delta < 0 ? '#ef4444' : '#94a3b8'};
  background: ${props => props.$delta > 0 ? '#d1fae5' : props.$delta < 0 ? '#fee2e2' : '#f1f5f9'};
  padding: 0.2rem 0.5rem;
  border-radius: 0.375rem;
  width: fit-content;
`;

const KPICardSubText = styled.div`
  font-size: 0.75rem;
  color: #94a3b8;
`;

const KPIDecompBlock = styled.div`
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px dashed #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const KPIDecompRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  color: #475569;
  gap: 0.5rem;
`;

const KPIDecompLabel = styled.span`
  color: #64748b;
`;

const KPIDecompValue = styled.span`
  font-weight: 700;
  color: ${props => props.$value > 0 ? '#10b981' : props.$value < 0 ? '#ef4444' : '#94a3b8'};
  white-space: nowrap;
`;

const ExecTwoColumnRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  padding: 0 2rem 2rem;

  @media (max-width: 1200px) {
    grid-template-columns: 1fr;
  }
`;

const ExecFullRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  padding: 0 2rem 1.5rem;

  @media (max-width: 1200px) {
    grid-template-columns: 1fr;
  }
`;

const ExecDivisionChartGrid = styled.div`
  display: grid;
  gap: 0.85rem;
  grid-template-columns: repeat(${p => p.$cols}, 1fr);
`;

const ExecDivisionChartCard = styled.div`
  border: 1px solid #e2e8f0;
  border-radius: 0.6rem;
  background: white;
  overflow: hidden;
`;

const ExecDivisionChartHeader = styled.div`
  padding: 0.4rem 0.75rem;
  border-bottom: 1px solid #f1f5f9;
  background: #f8fafc;
  font-size: 0.85rem;
  font-weight: 700;
  color: ${p => p.$color || '#1e293b'};
  display: flex;
  align-items: center;
  gap: 0.4rem;

  &::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${p => p.$color || '#94a3b8'};
  }
`;

const ExecDivisionChartBody = styled.div`
  padding: 0.5rem 0.4rem 0.4rem;
`;

const ExecPanel = styled.div`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const ExecPanelHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.85rem 1.25rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  gap: 0.75rem;
`;

const ExecPanelTitle = styled.h2`
  font-size: 1.05rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ExecPanelSubtitle = styled.div`
  font-size: 0.8rem;
  color: #94a3b8;
`;

const ExecPanelBody = styled.div`
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const ExecKpiPlaceholder = styled.div`
  padding: 3rem 1.5rem;
  text-align: center;
  color: #94a3b8;
  font-size: 0.85rem;
  border: 1px dashed #cbd5e1;
  border-radius: 0.5rem;
  background: #f8fafc;
`;

const ExecKpiDivisionGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const ExecKpiDivisionTitle = styled.div`
  font-size: 0.85rem;
  font-weight: 700;
  color: #1e293b;
  padding: 0.4rem 0;
  border-bottom: 1px solid #e2e8f0;
`;

const ExecKpiCategoryTitle = styled.div`
  font-size: 0.7rem;
  font-weight: 700;
  color: ${p => p.$color || '#64748b'};
  background: ${p => p.$bg || '#f1f5f9'};
  padding: 0.2rem 0.5rem;
  border-radius: 0.25rem;
  display: inline-flex;
  align-self: flex-start;
  margin-top: 0.4rem;
`;

const ExecKpiRow = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.4rem 0.6rem;
  border: 1px solid ${p => p.$active ? '#6366f1' : '#f1f5f9'};
  border-radius: 0.4rem;
  background: ${p => p.$active ? '#eef2ff' : 'white'};
  cursor: pointer;
  font-size: 0.78rem;
  text-align: left;
  width: 100%;
  transition: all 0.15s ease;

  &:hover {
    border-color: ${p => p.$active ? '#6366f1' : '#cbd5e1'};
    background: ${p => p.$active ? '#eef2ff' : '#f8fafc'};
  }
`;

const ExecKpiRowLabel = styled.span`
  color: #334155;
  font-weight: 500;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ExecKpiRowValue = styled.span`
  font-weight: 700;
  color: #1e293b;
  white-space: nowrap;
`;

const ExecKpiRowDelta = styled.span`
  font-size: 0.72rem;
  font-weight: 700;
  color: ${p => p.$delta > 0 ? '#10b981' : p.$delta < 0 ? '#ef4444' : '#94a3b8'};
  white-space: nowrap;
  min-width: 50px;
  text-align: right;
`;

const ExecKpiChartWrap = styled.div`
  border-top: 1px solid #e2e8f0;
  padding: 0.75rem 1.25rem 1rem;
  background: #fafbfc;
`;

const ExecKpiChartTitle = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 0.5rem;
`;

const ExecKpiChartClose = styled.button`
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0.1rem 0.4rem;

  &:hover { color: #475569; }
`;

const ExecKpiChartPlaceholder = styled.div`
  padding: 3rem 1rem;
  text-align: center;
  color: #94a3b8;
  font-size: 0.9rem;
  background: white;
  border: 1px dashed #cbd5e1;
  border-radius: 0.5rem;

  .hint {
    font-size: 0.75rem;
    margin-top: 0.5rem;
    color: #cbd5e1;
  }
`;

const ExecKpiTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.75rem;
`;

const ExecKpiTableHead = styled.thead``;

const ExecKpiTh = styled.th`
  padding: 0.45rem 0.4rem;
  text-align: ${p => p.$left ? 'left' : 'center'};
  font-weight: 700;
  color: #475569;
  border-bottom: 2px solid #e2e8f0;
  font-size: 0.72rem;
  white-space: nowrap;
  /* sticky를 th에 적용 (thead sticky보다 호환성 안정) */
  position: sticky;
  top: 0;
  z-index: 2;
  background: #f8fafc;
  /* 헤더 아래 경계선이 sticky로 둥둥 뜨는 현상 방지 */
  box-shadow: inset 0 -2px 0 #e2e8f0;
`;

const ExecKpiCategoryHeaderRow = styled.tr`
  background: ${p => p.$bg};

  td {
    padding: 0.3rem 0.5rem;
    font-weight: 700;
    color: ${p => p.$color};
    font-size: 0.72rem;
    border-bottom: 1px solid #e2e8f0;
  }
`;

const ExecKpiCategoryCell = styled.td`
  background: ${p => p.$bg};
  color: ${p => p.$color};
  font-weight: 700;
  font-size: 0.75rem;
  text-align: center;
  vertical-align: middle;
  padding: 0.4rem 0.4rem;
  border-bottom: 1px solid #e2e8f0;
  border-right: 1px solid #e2e8f0;
  white-space: nowrap;
  width: 1%;
`;

const ExecKpiCategoryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 0.75rem;
`;

const ExecKpiMiniBox = styled.div`
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  overflow: hidden;
  background: white;
`;

const ExecKpiMiniHeader = styled.div`
  padding: 0.4rem 0.7rem;
  background: ${p => p.$bg};
  color: ${p => p.$color};
  font-size: 0.85rem;
  font-weight: 700;
  border-bottom: 1px solid #e2e8f0;
`;

const ExecKpiMiniTable = styled.table`
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: 0.8rem;
`;

const ExecKpiMiniThKpi = styled.th`
  padding: 0.45rem 0.4rem;
  text-align: left;
  font-weight: 700;
  color: #475569;
  font-size: 0.78rem;
  white-space: nowrap;
  background: #f8fafc;
  box-shadow: inset 0 -2px 0 #e2e8f0;
  width: 95px;
`;

const ExecKpiDivGrid = styled.div`
  display: grid;
  /* min(320px, 100%): 뷰포트가 320px보다 좁아도 박스가 컨테이너를 넘치지 않게 해 우측 열 잘림 방지 */
  grid-template-columns: repeat(auto-fit, minmax(min(320px, 100%), 1fr));
  gap: 0.75rem;
`;

const ExecKpiDivBox = styled.div`
  border: 1px solid #e2e8f0;
  border-radius: 0.55rem;
  overflow: hidden;
  background: white;
`;

const ExecKpiDivHeader = styled.div`
  padding: 0.45rem 0.75rem;
  background: ${p => p.$bg};
  color: ${p => p.$color};
  font-size: 0.95rem;
  font-weight: 800;
  border-bottom: 2px solid ${p => p.$color};
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ExecKpiDivCount = styled.span`
  font-size: 0.7rem;
  font-weight: 600;
  color: ${p => p.$color};
  opacity: 0.7;
`;

const ExecKpiDivTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.78rem;
`;

const ExecKpiDivTh = styled.th`
  padding: 0.4rem 0.5rem;
  text-align: ${p => p.$align || 'left'};
  font-weight: 700;
  color: #475569;
  font-size: 0.72rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  white-space: nowrap;
  width: ${p => p.$width || 'auto'};
`;

const ExecKpiDivTd = styled.td`
  padding: 0.4rem 0.5rem;
  text-align: ${p => p.$align || 'left'};
  border-bottom: 1px solid #f1f5f9;
  vertical-align: middle;
  cursor: ${p => p.$clickable ? 'pointer' : 'default'};
  background: ${p => p.$active ? '#eef2ff' : 'transparent'};

  &:hover {
    background: ${p => p.$clickable ? (p.$active ? '#eef2ff' : '#f8fafc') : 'transparent'};
  }
`;

const ExecKpiDivKpiLabel = styled.div`
  font-weight: 600;
  color: #1e293b;
  font-size: 0.8rem;
  /* 좁은 화면에서 라벨이 잘리지 않도록 줄바꿈 허용 (ellipsis 대신 wrap) */
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
  line-height: 1.3;
`;

const ExecKpiDivCatCell = styled.td`
  padding: 0.4rem 0.4rem;
  text-align: center;
  vertical-align: middle;
  border-bottom: 1px solid #f1f5f9;
  border-right: 1px solid #f1f5f9;
  background: ${p => p.$bg || '#f8fafc'};
  color: ${p => p.$color || '#64748b'};
  font-size: 0.74rem;
  font-weight: 700;
  white-space: nowrap;
`;

const ExecKpiDivCellMain = styled.div`
  font-weight: 700;
  color: #1e293b;
  font-size: 0.84rem;
`;

const ExecKpiDivCellDelta = styled.div`
  font-size: 0.7rem;
  font-weight: 700;
  color: ${p => p.$delta > 0 ? '#10b981' : p.$delta < 0 ? '#ef4444' : '#94a3b8'};
  margin-top: 1px;
`;

const ExecKpiDivRate = styled.div`
  font-weight: 700;
  font-size: 0.84rem;
  color: ${p => p.$rate == null ? '#cbd5e1'
                : p.$rate >= 100 ? '#10b981'
                : p.$rate >= 70 ? '#f59e0b'
                : '#ef4444'};
`;

const ExecKpiMiniThDiv = styled.th`
  padding: 0.45rem 0.2rem;
  text-align: center;
  font-weight: 700;
  color: #475569;
  font-size: 0.75rem;
  white-space: nowrap;
  background: #f8fafc;
  box-shadow: inset 0 -2px 0 #e2e8f0;
  width: ${p => p.$colWidth || '40px'};
`;

const ExecKpiLabelCell = styled.td`
  padding: 0.45rem 0.55rem;
  color: #1e293b;
  font-weight: 600;
  font-size: 0.82rem;
  border-bottom: 1px solid #f1f5f9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 0;
`;

const ExecKpiCell = styled.td`
  padding: 0.45rem 0.3rem;
  text-align: center;
  border-bottom: 1px solid #f1f5f9;
  cursor: ${p => p.$clickable ? 'pointer' : 'default'};
  background: ${p => p.$active ? '#eef2ff' : 'transparent'};
  transition: background 0.15s ease;

  &:hover {
    background: ${p => p.$clickable ? (p.$active ? '#eef2ff' : '#f8fafc') : 'transparent'};
  }
`;

const ExecKpiCellValue = styled.div`
  font-size: 0.85rem;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.2;
`;

const ExecKpiCellDelta = styled.div`
  font-size: 0.74rem;
  font-weight: 700;
  color: ${p => p.$delta > 0 ? '#10b981' : p.$delta < 0 ? '#ef4444' : '#94a3b8'};
  margin-top: 0.1rem;
`;

const ExecKpiCellEmpty = styled.div`
  color: #cbd5e1;
  font-size: 0.85rem;
`;

const ExecStatusFilterBar = styled.div`
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  flex-wrap: wrap;
`;

const ExecStatusChip = styled.button`
  padding: 0.35rem 0.75rem;
  background: ${p => p.$active ? (p.$color || '#6366f1') : 'white'};
  color: ${p => p.$active ? 'white' : '#64748b'};
  border: 1px solid ${p => p.$active ? (p.$color || '#6366f1') : '#e2e8f0'};
  border-radius: 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  transition: all 0.15s ease;

  &:hover {
    background: ${p => p.$active ? (p.$color || '#6366f1') : '#f1f5f9'};
  }
`;

const ExecStatusChipBadge = styled.span`
  padding: 0.05rem 0.4rem;
  background: ${p => p.$active ? 'rgba(255,255,255,0.3)' : '#e2e8f0'};
  border-radius: 0.25rem;
  font-size: 0.7rem;
`;

const ExecProjectList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-height: 700px;
  overflow-y: auto;
  padding: 0.75rem 1.25rem;
`;

const ExecProjectCard = styled.div`
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  padding: 0.75rem 0.9rem;
  background: white;
`;

const ExecProjectCardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
`;

const ExecProjectCardTitle = styled.div`
  font-size: 0.875rem;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.3;
`;

const ExecProjectCardMeta = styled.div`
  font-size: 0.7rem;
  color: #94a3b8;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
`;

const ExecProjectProgress = styled.span`
  font-weight: 700;
  color: ${p => p.$progress >= 100 ? '#10b981' : p.$progress >= 50 ? '#6366f1' : '#64748b'};
`;

const ExecCategoryGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin-top: 0.4rem;
`;

const ExecCategoryHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.72rem;
  font-weight: 700;
  color: ${p => p.$color};
  margin-top: 0.25rem;
`;

const ExecActionItemRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.78rem;
  color: #475569;
  padding: 0.15rem 0 0.15rem 1rem;
  line-height: 1.3;

  &::before {
    content: '·';
    color: #cbd5e1;
    flex-shrink: 0;
  }
`;

const ExecActionItemText = styled.span`
  flex: 1;
`;

const ExecActionItemDates = styled.span`
  font-size: 0.7rem;
  color: #94a3b8;
  white-space: nowrap;
  flex-shrink: 0;
`;

const ExecEmptyMessage = styled.div`
  padding: 2rem 1rem;
  text-align: center;
  color: #94a3b8;
  font-size: 0.85rem;
`;

const ExecTableWrap = styled.div`
  max-height: 700px;
  overflow-y: auto;
`;

const ExecTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
  table-layout: fixed;
`;

const ExecTableHead = styled.thead`
  background: #f8fafc;
  position: sticky;
  top: 0;
  z-index: 1;
`;

const ExecTableTh = styled.th`
  padding: 0.6rem 0.75rem;
  text-align: left;
  font-weight: 700;
  color: #475569;
  border-bottom: 2px solid #e2e8f0;
  font-size: 0.75rem;
  white-space: nowrap;
`;

const ExecTableTd = styled.td`
  padding: 0.55rem 0.75rem;
  color: #334155;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: top;
  line-height: 1.4;
  word-break: keep-all;
  overflow-wrap: anywhere;
`;

const ExecTableTdProject = styled.td`
  padding: 0.6rem 0.75rem;
  color: #1e293b;
  border-bottom: 1px solid #e2e8f0;
  border-right: 1px solid #f1f5f9;
  vertical-align: top;
  background: #fafbfc;
  min-width: 140px;
  max-width: 220px;
`;

const ExecTableProjectName = styled.div`
  font-size: 0.85rem;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.3;
  margin-bottom: 0.25rem;
`;

const ExecTableProjectMeta = styled.div`
  font-size: 0.7rem;
  color: #94a3b8;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem;
`;

const ExecCategoryBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.15rem 0.5rem;
  border-radius: 0.375rem;
  font-size: 0.72rem;
  font-weight: 700;
  color: ${p => p.$color};
  background: ${p => p.$bg};
  white-space: nowrap;
`;

const ExecTableInfo = styled.span`
  font-size: 0.72rem;
  color: #64748b;
  line-height: 1.35;
`;

const ExecShowMoreBar = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0.75rem 1.25rem;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
  gap: 0.5rem;
`;

const ExecShowMoreButton = styled.button`
  padding: 0.4rem 1rem;
  background: white;
  color: #6366f1;
  border: 1px solid #c7d2fe;
  border-radius: 0.5rem;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  transition: all 0.15s ease;

  &:hover {
    background: #eef2ff;
    border-color: #6366f1;
  }
`;

const ExecShowMoreHint = styled.span`
  font-size: 0.72rem;
  color: #94a3b8;
`;

const CompletedSection = styled.div`
  padding: 0 2rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const CompletedSectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
  padding: 0.75rem 0;
  border-bottom: 2px solid #e2e8f0;
`;

const CompletedSectionTitle = styled.h2`
  font-size: 1.125rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const CompletedSectionSubtitle = styled.div`
  font-size: 0.8rem;
  color: #64748b;
`;

const CompletedDivisionGroup = styled.div`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  overflow: hidden;
`;

const CompletedDivisionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1.25rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
`;

const CompletedDivisionName = styled.div`
  font-size: 0.95rem;
  font-weight: 700;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const CompletedDivisionCount = styled.span`
  font-size: 0.75rem;
  font-weight: 700;
  color: #6366f1;
  background: #eef2ff;
  padding: 0.2rem 0.5rem;
  border-radius: 0.375rem;
`;

const CompletedProjectRow = styled.div`
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid #f1f5f9;

  &:last-child {
    border-bottom: none;
  }
`;

const CompletedProjectTitle = styled.div`
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
`;

const CompletedProjectName = styled.div`
  font-size: 0.9rem;
  font-weight: 600;
  color: #334155;
`;

const CompletedProjectPL = styled.span`
  font-size: 0.75rem;
  color: #94a3b8;
`;

const CompletedItemList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding-left: 0.5rem;
`;

const CompletedItemRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: #10b981;

  &::before {
    content: '□';
    font-size: 0.75rem;
    margin-top: 0.15rem;
    flex-shrink: 0;
  }
`;

const CompletedActivityRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: #8b5cf6;
  padding-left: 1.25rem;

  &::before {
    content: '-';
    font-size: 0.85rem;
    flex-shrink: 0;
  }
`;

const CompletedItemText = styled.span`
  flex: 1;
  line-height: 1.4;
`;

const CompletedItemDate = styled.span`
  font-size: 0.75rem;
  color: #94a3b8;
  white-space: nowrap;
  font-weight: 500;
`;

const CompletedEmpty = styled.div`
  padding: 3rem 2rem;
  text-align: center;
  color: #94a3b8;
  font-size: 0.9rem;
  background: white;
  border: 1px dashed #cbd5e1;
  border-radius: 0.75rem;
`;

const DashboardView = ({
  projects,
  statusColors,
  divisionColors,
  globalPerformances = [],
  subTab = 'overview',
  currentYear: propCurrentYear,
  onYearChange,
  settingsData = {},
  onRestoreProject,
  onPermanentDeleteProject,
  columnSettings,
  onColumnSettingsChange,
  pivotSettings,
  onPivotSettingsChange,
  onEditPerformance,
  onLinkProjectToPerformance,
  onEditProject,
  // 성과 휴지통에서 복구한 뒤 상위가 서버 데이터를 다시 받게 한다 (KPIDashboard 로 넘긴다)
  onPerformanceRestored
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.is_admin;
  // 로컬 저장 권한: Admin, Manager, DT Office만 허용
  const canExport = ['admin', 'manager', 'dt_office'].includes(user?.role) || user?.is_admin;
  // 사무국 코멘트 수정 권한: 매니저 이상 (Admin, Manager, DT Office)
  const canEditSecretariat = ['admin', 'manager', 'dt_office'].includes(user?.role) || user?.is_admin;
  const [currentYear, setCurrentYear] = useState(propCurrentYear || 2025);
  const [trendSelectedDivision, setTrendSelectedDivision] = useState('all');
  const [executiveSelectedDivision, setExecutiveSelectedDivision] = useState('all');
  // 경영진 보고 - 기준 날짜 (기본: 1주 전)
  const [executiveRefDate, setExecutiveRefDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return toLocalYmd(d);
  });
  const [executiveRefPreset, setExecutiveRefPreset] = useState('1week');
  // 경영진 보고 - 과제 진행 현황 카테고리 필터
  const [executiveStatusFilter, setExecutiveStatusFilter] = useState('all'); // 'all' | 'completed' | 'delayed' | 'early'
  const [executiveShowAll, setExecutiveShowAll] = useState(false);
  // 경영진 보고 - DX KPI 데이터
  const [kpiDefinitions, setKpiDefinitions] = useState([]);
  const [kpiRecords, setKpiRecords] = useState([]);
  const [kpiTargets, setKpiTargets] = useState({});
  const [selectedKpis, setSelectedKpis] = useState([]); // [{label, division}] — 같은 label로 다중 선택
  // 경영진 보고 설정 — 서버 (settingsData.executiveReportSettings) 에 저장, 모든 사용자 공유
  const [excludedKpis, setExcludedKpis] = useState(new Set());
  const [kpiSelectorOpen, setKpiSelectorOpen] = useState(false);
  const [executiveImageSaving, setExecutiveImageSaving] = useState(false);
  const executiveDashboardRef = useRef(null);

  const handleSaveExecutiveAsImage = async () => {
    const target = executiveDashboardRef.current;
    if (!target) return;
    setExecutiveImageSaving(true);

    // 캡처 전 스크롤 위치 + 모든 조상 스타일 백업
    const savedScrollX = window.scrollX;
    const savedScrollY = window.scrollY;
    const styleBackups = [];
    const scrollBackups = [];

    const backupAndExpand = (el) => {
      styleBackups.push({
        el,
        cssText: el.style.cssText,
      });
      // overflow 제약 해제 → 자식 콘텐츠 전체가 박스 밖으로 흐를 수 있게
      el.style.maxHeight = 'none';
      el.style.maxWidth = 'none';
      el.style.overflow = 'visible';
      el.style.overflowX = 'visible';
      el.style.overflowY = 'visible';
    };

    // 1) 스크롤 가능한 조상들의 스크롤 위치 백업 + 0으로 리셋
    let cur = target.parentElement;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      if (cur.scrollTop > 0 || cur.scrollLeft > 0) {
        scrollBackups.push({ el: cur, top: cur.scrollTop, left: cur.scrollLeft });
        cur.scrollTop = 0;
        cur.scrollLeft = 0;
      }
      cur = cur.parentElement;
    }
    window.scrollTo(0, 0);

    // 2) 타깃 + 모든 조상의 overflow/maxHeight 제거
    backupAndExpand(target);
    cur = target.parentElement;
    while (cur && cur !== document.body) {
      backupAndExpand(cur);
      cur = cur.parentElement;
    }
    backupAndExpand(document.body);
    backupAndExpand(document.documentElement);

    // 3) 타깃의 높이를 자기 콘텐츠 전체 높이로 강제 (clientHeight 한계 우회)
    target.style.height = `${target.scrollHeight}px`;
    target.style.minHeight = `${target.scrollHeight}px`;

    // 레이아웃 안정화 (DOM 측정값 갱신)
    await new Promise(r => setTimeout(r, 200));

    try {
      const html2canvas = (await import('html2canvas')).default;
      const rect = target.getBoundingClientRect();
      const fullWidth = Math.ceil(rect.width);
      const fullHeight = Math.ceil(target.scrollHeight);

      // 캡처 전 원본 SVG 텍스트 요소들의 computed style 캐싱
      // (clone 시 CSS가 누락되어 텍스트가 안 보이는 이슈 우회)
      const originalSvgTexts = Array.from(target.querySelectorAll('svg text, svg tspan'));
      const svgTextStyles = originalSvgTexts.map(el => {
        const c = window.getComputedStyle(el);
        return {
          fill: c.fill,
          fontFamily: c.fontFamily,
          fontSize: c.fontSize,
          fontWeight: c.fontWeight,
          textAnchor: c.textAnchor,
          opacity: c.opacity,
        };
      });

      const canvas = await html2canvas(target, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
        width: fullWidth,
        height: fullHeight,
        windowWidth: fullWidth,
        windowHeight: fullHeight,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc, clonedElement) => {
          // clone된 DOM에서 SVG text/tspan을 다시 찾아서 inline 스타일 강제 주입
          const clonedSvgTexts = clonedElement.querySelectorAll('svg text, svg tspan');
          clonedSvgTexts.forEach((el, i) => {
            const s = svgTextStyles[i];
            if (!s) return;
            // SVG는 fill 속성을 우선 사용
            if (s.fill && s.fill !== 'none') {
              el.setAttribute('fill', s.fill);
              el.style.fill = s.fill;
            }
            if (s.fontFamily) el.style.fontFamily = s.fontFamily;
            if (s.fontSize) el.style.fontSize = s.fontSize;
            if (s.fontWeight) el.style.fontWeight = s.fontWeight;
            if (s.textAnchor) el.setAttribute('text-anchor', s.textAnchor);
            el.style.opacity = '1';
            el.style.visibility = 'visible';
          });
          // recharts 라벨 wrapper도 visible 처리
          clonedElement.querySelectorAll('.recharts-label, .recharts-label-list, .recharts-text').forEach(el => {
            el.style.opacity = '1';
            el.style.visibility = 'visible';
          });
        },
      });

      await new Promise((resolve) => {
        canvas.toBlob((blob) => {
          if (!blob) { resolve(); return; }
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          const divLabel = executiveSelectedDivision === 'all' ? '전체' : executiveSelectedDivision;
          const today = todayLocalYmd();
          a.download = `경영진보고_${currentYear}년_${divLabel}_${today}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          resolve();
        }, 'image/png');
      });
    } catch (err) {
      console.error('경영진 보고 이미지 저장 실패:', err);
      alert('이미지 저장 중 오류가 발생했습니다: ' + (err?.message || err));
    } finally {
      // 모든 스타일 원복
      styleBackups.forEach(({ el, cssText }) => {
        el.style.cssText = cssText;
      });
      // 스크롤 위치 복원
      scrollBackups.forEach(({ el, top, left }) => {
        el.scrollTop = top;
        el.scrollLeft = left;
      });
      window.scrollTo(savedScrollX, savedScrollY);
      setExecutiveImageSaving(false);
    }
  };
  const [kpiSelectorTab, setKpiSelectorTab] = useState('kpi'); // 'kpi' | 'perf'
  // 성과 검증 모달 (막대 클릭 시)
  const [perfDetailModal, setPerfDetailModal] = useState(null); // { division, item }
  // 조직별 액션아이템 상태 모달 (막대 클릭 시)
  const [aiStatusModal, setAiStatusModal] = useState(null); // { division: divKey, focusCategory? }
  const [aiModalFilter, setAiModalFilter] = useState('all'); // 'all' | '완료' | '조기달성' | '계획' | '지연'
  // 사업부 카드 클릭 시: 과제/액션아이템 변경 현황 + 전체현황 모달
  const [divisionDetailModal, setDivisionDetailModal] = useState(null); // 사업부명(string) | null
  // 상단 요약(전체 과제/완료 과제/전체 액션아이템) 카드 클릭 시 상세 모달
  const [metricDetailModal, setMetricDetailModal] = useState(null); // { type: 'projects'|'completed'|'ai' } | null
  // 진척률 추이 점 클릭 시: 해당 주차 진척률 상세 모달
  const [aiProgressModal, setAiProgressModal] = useState(null); // { scope:'division'|'process', key, week, dateMs } | null
  // 조직별 경영성과: 표시할 KPI 대시보드 카드 ID 집합 (opt-in)
  const [selectedKpiCards, setSelectedKpiCards] = useState(new Set());
  // KPI 대시보드 카드 (fetchKPIDashboardCards 로 로드)
  const [kpiDashboardCards, setKpiDashboardCards] = useState([]);
  // 관리자 기본 단위 환산 설정 (성과 차트에 적용)
  const [execActiveConversions, setExecActiveConversions] = useState({});
  // 사업부별 대표 법인 (KPI 선택 모달에서 입력, DX KPI 표 하단에 표기) { 'MX': '삼성전자', ... }
  const [repCorps, setRepCorps] = useState({});

  // 서버 설정에서 동기화 (settingsData 가 로드되면 초기 셋업)
  useEffect(() => {
    const s = settingsData?.executiveReportSettings;
    if (!s) return;
    if (Array.isArray(s.excludedKpis)) setExcludedKpis(new Set(s.excludedKpis));
    if (Array.isArray(s.selectedKpiCards)) setSelectedKpiCards(new Set(s.selectedKpiCards));
    if (s.execActiveConversions && typeof s.execActiveConversions === 'object') {
      setExecActiveConversions(s.execActiveConversions);
    }
    if (s.repCorps && typeof s.repCorps === 'object') setRepCorps(s.repCorps);
  }, [settingsData]);

  // 사무국 코멘트 서버 동기화
  useEffect(() => {
    const c = settingsData?.issueSecretariatComments;
    if (c && typeof c === 'object') setSecretariatComments(c);
  }, [settingsData]);

  // 통합 저장 헬퍼: 항상 전체 executiveReportSettings 를 보내서 부분 누락 방지
  const saveExecReportSettings = useCallback((partial) => {
    if (!isAdmin) return;
    const current = {
      excludedKpis: [...excludedKpis],
      selectedKpiCards: [...selectedKpiCards],
      execActiveConversions,
      repCorps
    };
    const next = { ...current, ...partial };
    saveSystemSettings({ executiveReportSettings: next }).catch(err => {
      console.warn('경영진 보고 설정 저장 실패:', err.message);
    });
  }, [isAdmin, excludedKpis, selectedKpiCards, execActiveConversions, repCorps]);

  // 대표 법인 입력: 타이핑 중엔 로컬 상태만, 포커스 아웃(blur) 시 서버 저장
  const handleRepCorpChange = (division, value) => {
    setRepCorps(prev => ({ ...prev, [division]: value }));
  };
  const persistRepCorps = () => {
    saveExecReportSettings({ repCorps });
  };

  const toggleExecConversion = (conv) => {
    const srcKey = (conv.sourceUnit || '').toLowerCase();
    setExecActiveConversions(prev => {
      const next = { ...prev };
      if (next[srcKey] === conv.id) delete next[srcKey];
      else next[srcKey] = conv.id;
      saveExecReportSettings({ execActiveConversions: next });
      return next;
    });
  };

  // KPI 대시보드 카드 로드 (연도별)
  useEffect(() => {
    fetchKPIDashboardCards(currentYear)
      .then(setKpiDashboardCards)
      .catch(err => {
        console.warn('KPI 카드 로드 실패:', err.message);
        setKpiDashboardCards([]);
      });
  }, [currentYear]);

  const toggleKpiCard = (id) => {
    setSelectedKpiCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      saveExecReportSettings({ selectedKpiCards: [...next] });
      return next;
    });
  };

  const toggleKpiExclusion = (label) => {
    setExcludedKpis(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      saveExecReportSettings({ excludedKpis: [...next] });
      return next;
    });
  };

  const setAllKpisIncluded = () => {
    setExcludedKpis(() => {
      const next = new Set();
      saveExecReportSettings({ excludedKpis: [] });
      return next;
    });
  };

  const setAllKpisExcluded = () => {
    setExcludedKpis(() => {
      const next = new Set(kpiDefinitions.map(d => d.label));
      saveExecReportSettings({ excludedKpis: [...next] });
      return next;
    });
  };

  // KPI 데이터 로드
  useEffect(() => {
    fetchKpiDefinitions().then(setKpiDefinitions).catch(err => {
      console.warn('KPI 정의 로드 실패:', err.message);
    });
    fetchKpiRecords().then(setKpiRecords).catch(err => {
      console.warn('KPI 레코드 로드 실패:', err.message);
    });
    fetchKpiTargets().then(setKpiTargets).catch(err => {
      console.warn('KPI 타깃 로드 실패:', err.message);
    });
  }, []);
  const [trendChartType, setTrendChartType] = useState('actionItem'); // 'actionItem' | 'project'
  const [trendSelectedProcesses, setTrendSelectedProcesses] = useState(new Set()); // 빈 Set = 전체 선택
  const [trendSelectedStatuses, setTrendSelectedStatuses] = useState(new Set()); // 빈 Set = 전체 선택
  const [progressViewMode, setProgressViewMode] = useState('summary'); // 'summary' | 'detail' | 'project'
  const [projectViewStatusFilter, setProjectViewStatusFilter] = useState('all'); // 'all' | 'normal' | 'delayed' | 'noTarget' | 'noAction'
  const [unregisteredModal, setUnregisteredModal] = useState({ isOpen: false, type: null }); // type: 'actionItem' | 'activity'
  const [weeklyTrendModal, setWeeklyTrendModal] = useState({ isOpen: false, week: null }); // 주차별 추이 상세 모달
  const [hoveredWeekPoint, setHoveredWeekPoint] = useState(null); // 호버된 주차 포인트
  /**
   * 과제 상세 모달 — **'모든 과제 현황' 과 같은 것**을 띄운다 (2026-08-08).
   *
   * 전체 요약의 여러 상세 모달(지표·사업부·AI 현황·미등록 목록)에 과제가 줄줄이
   * 나오는데 눌러도 아무 일이 없었다. 같은 모달을 여기서도 띄운다.
   *
   * ⚠️ 목록의 원소는 **가벼운 사본**인 경우가 있다(과제명·사업부·reason 만 담은 것).
   *    그대로 모달에 넘기면 상세 정보가 텅 빈다 — `projects` 에서 **원본을 찾아** 넘긴다.
   */
  const [detailProject, setDetailProject] = useState(null);

  const openProjectDetail = (p) => {
    if (!p) return;
    const full = (projects || []).find(x =>
      (p.uuid && x.uuid === p.uuid) || (p.id && x.id === p.id)) || p;
    setDetailProject(full);
  };

  /** 과제 줄에 붙이는 공통 속성. `cursor` 는 각 줄의 style 에 직접 넣는다(덮어쓰기 방지). */
  const projectRowProps = (p) => ({
    onClick: () => openProjectDetail(p),
    title: '클릭하면 과제 상세를 봅니다',
  });

  const [progressModal, setProgressModal] = useState(false); // 전체 진행률 상세 모달
  const [scheduleRateModal, setScheduleRateModal] = useState(false); // 액션아이템 일정 수립률 모달
  const [allWeeksDropdownOpen, setAllWeeksDropdownOpen] = useState(false); // 모든 주차 테이블 저장 드롭다운
  const allWeeksDropdownRef = useRef(null);
  const [localSaveDropdownOpen, setLocalSaveDropdownOpen] = useState(false); // 로컬 저장 드롭다운
  const localSaveDropdownRef = useRef(null);

  // 이슈 현황 필터
  const [issueStatusFilter, setIssueStatusFilter] = useState('all'); // 'all' | 'unresolved' | 'resolved'
  const [issueSelectedDivision, setIssueSelectedDivision] = useState('all');
  const [issuePeriodPreset, setIssuePeriodPreset] = useState('lastWeek'); // 'year' | 'lastWeek' | 'lastMonth' | 'firstHalf' | 'secondHalf' | 'custom'
  const [issueStartDate, setIssueStartDate] = useState('');
  const [issueEndDate, setIssueEndDate] = useState('');
  // 사업부별 사무국 코멘트 { [연도]: { [사업부]: 코멘트 } }
  const [secretariatComments, setSecretariatComments] = useState({});
  const [editingSecretariatDiv, setEditingSecretariatDiv] = useState(null); // 추가 에디터가 열린 사업부
  const [editingCommentId, setEditingCommentId] = useState(null); // 수정 중인 코멘트 id
  const [secretariatDraft, setSecretariatDraft] = useState('');
  const [secretariatDraftMentions, setSecretariatDraftMentions] = useState([]); // [{ name, uuid }]
  const [secretariatSaving, setSecretariatSaving] = useState(false);
  // 사무국 코멘트 @과제명 멘션
  const secretariatTextareaRef = useRef(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionAtIdx, setMentionAtIdx] = useState(-1);

  // 모든 주차 테이블 저장 드롭다운 외부 클릭 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (allWeeksDropdownRef.current && !allWeeksDropdownRef.current.contains(event.target)) {
        setAllWeeksDropdownOpen(false);
      }
    };
    if (allWeeksDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [allWeeksDropdownOpen]);

  // 로컬 저장 드롭다운 외부 클릭 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (localSaveDropdownRef.current && !localSaveDropdownRef.current.contains(event.target)) {
        setLocalSaveDropdownOpen(false);
      }
    };
    if (localSaveDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [localSaveDropdownOpen]);

  // 주차별 추이 모달 닫기 핸들러
  const closeWeeklyTrendModal = () => {
    setWeeklyTrendModal({ isOpen: false, week: null });
    setHoveredWeekPoint(null);
  };

  // 한국 시간 기준 현재 주차 계산
  const getCurrentKoreanWeek = () => {
    const now = new Date();
    // 한국 시간으로 변환 (UTC+9)
    const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000) + (now.getTimezoneOffset() * 60 * 1000));
    const startOfYear = new Date(koreaTime.getFullYear(), 0, 1);
    const days = Math.floor((koreaTime - startOfYear) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + startOfYear.getDay() + 1) / 7);
  };

  const [selectedWeek, setSelectedWeek] = useState(getCurrentKoreanWeek());

  // 주차 변경 핸들러
  const handlePrevWeek = () => {
    setSelectedWeek(prev => Math.max(1, prev - 1));
  };

  const handleNextWeek = () => {
    setSelectedWeek(prev => Math.min(52, prev + 1));
  };

  useEffect(() => {
    if (propCurrentYear && propCurrentYear !== currentYear) {
      setCurrentYear(propCurrentYear);
    }
  }, [propCurrentYear]);

  // 사업부 목록 추출 (진행률 현황용)
  const trendDivisions = useMemo(() => {
    const divisionOrder = ['MX', 'VD', 'DA', 'NW', '의료기기', 'GTR', 'SR'];
    const divisionSet = new Set();
    projects.forEach(project => {
      if (project.사업부 && project.과제년도 === currentYear && !project._deleted) {
        divisionSet.add(project.사업부);
      }
    });
    const divisions = Array.from(divisionSet);
    // 지정된 순서대로 정렬, 목록에 없는 사업부는 마지막에 알파벳순으로
    return divisions.sort((a, b) => {
      const indexA = divisionOrder.indexOf(a);
      const indexB = divisionOrder.indexOf(b);
      if (indexA === -1 && indexB === -1) return a.localeCompare(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [projects, currentYear]);

  // 진행률 현황용 프로젝트 수 계산
  const getTrendDivisionCount = (division) => {
    return projects.filter(p =>
      p.사업부 === division &&
      p.과제년도 === currentYear &&
      !p._deleted
    ).length;
  };

  const getTrendTotalCount = () => {
    return projects.filter(p =>
      p.과제년도 === currentYear &&
      !p._deleted
    ).length;
  };

  // 진행률 계산 함수 (액션아이템별 동일 기여도 방식)
  // 각 액션아이템이 동일한 기여도(100% / 액션아이템 수)를 가지고,
  // 해당 기여도 내에서 세부항목별로 비율을 분배
  const calculateProgress = (project) => {
    if (!project.액션아이템목록 || project.액션아이템목록.length === 0) {
      return 0;
    }

    const actionItemCount = project.액션아이템목록.length;
    const contributionPerActionItem = 100 / actionItemCount;

    let totalProgress = 0;

    project.액션아이템목록.forEach(item => {
      const detailItems = item.세부항목목록 || [];

      if (detailItems.length > 0) {
        // 세부 항목이 있으면 해당 액션 아이템의 기여도를 세부 항목별로 분배
        const completedDetails = detailItems.filter(detail => detail.완료여부).length;
        const progressForThisItem = (completedDetails / detailItems.length) * contributionPerActionItem;
        totalProgress += progressForThisItem;
      } else {
        // 세부 항목이 없으면 액션아이템 자체의 완료여부로 계산
        if (item.완료여부) {
          totalProgress += contributionPerActionItem;
        }
      }
    });

    return Math.round(totalProgress);
  };

  // 프로세스 목록 (settingsData 기반)
  const availableProcesses = useMemo(() => {
    const processes = (settingsData.processes || []).map(p => p.name);
    if (processes.length > 0) return processes;
    // settingsData에 프로세스가 없으면 프로젝트에서 추출
    return [...new Set(projects.filter(p => p.프로세스).map(p => p.프로세스))].sort();
  }, [settingsData, projects]);

  // 프로세스 토글 핸들러
  const handleProcessToggle = (processName) => {
    setTrendSelectedProcesses(prev => {
      const next = new Set(prev);
      if (next.has(processName)) {
        next.delete(processName);
      } else {
        next.add(processName);
      }
      return next;
    });
  };

  // 진행 상태 목록 (settingsData 기반)
  const availableStatuses = useMemo(() => {
    const statuses = (settingsData.statuses || []).map(s => ({ name: s.name, color: s.color }));
    if (statuses.length > 0) return statuses;
    return [...new Set(projects.filter(p => p.진행상태).map(p => p.진행상태))].sort().map(name => ({ name, color: '#64748b' }));
  }, [settingsData, projects]);

  // 초기 로드 시 "취소"를 제외한 모든 상태 선택
  const [statusInitialized, setStatusInitialized] = useState(false);
  useEffect(() => {
    if (!statusInitialized && availableStatuses.length > 0) {
      const defaultStatuses = new Set(availableStatuses.filter(s => s.name !== '취소').map(s => s.name));
      setTrendSelectedStatuses(defaultStatuses);
      setStatusInitialized(true);
    }
  }, [availableStatuses, statusInitialized]);

  // 진행 상태 토글 핸들러
  const handleStatusToggle = (statusName) => {
    setTrendSelectedStatuses(prev => {
      const next = new Set(prev);
      if (next.has(statusName)) {
        next.delete(statusName);
      } else {
        next.add(statusName);
      }
      return next;
    });
  };

  // 선택된 사업부의 과제들 필터링 및 평균 진행률 계산
  const trendFilteredProjects = useMemo(() => {
    return projects.filter(p =>
      p.과제년도 === currentYear &&
      !p._deleted &&
      (trendSelectedDivision === 'all' || p.사업부 === trendSelectedDivision) &&
      (trendSelectedProcesses.size === 0 || trendSelectedProcesses.has(p.프로세스)) &&
      (trendSelectedStatuses.size === 0 || trendSelectedStatuses.has(p.진행상태))
    );
  }, [projects, currentYear, trendSelectedDivision, trendSelectedProcesses, trendSelectedStatuses]);

  const trendAverageProgress = useMemo(() => {
    if (trendFilteredProjects.length === 0) return 0;
    const totalProgress = trendFilteredProjects.reduce((sum, project) => {
      return sum + calculateProgress(project);
    }, 0);
    return Math.round(totalProgress / trendFilteredProjects.length);
  }, [trendFilteredProjects]);

  // 액션 아이템 비율 기반 진행��� (전체 완료 액션아이템 / 총 액션아이템)
  const actionItemBasedProgress = useMemo(() => {
    let totalItems = 0;
    let completedItems = 0;
    trendFilteredProjects.forEach(project => {
      const items = project.액션아이템목록 || [];
      totalItems += items.length;
      completedItems += items.filter(item => item.완료여부).length;
    });
    if (totalItems === 0) return { percent: 0, completed: 0, total: 0 };
    return { percent: Math.round((completedItems / totalItems) * 100), completed: completedItems, total: totalItems };
  }, [trendFilteredProjects]);

  // 액션아이템 달성률 (분자: 완료된 액션아이템 수, 분모: 오늘까지 계획된 액션아이템 수)
  const actionItemAchievementRate = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    let plannedByToday = 0;
    let completedAll = 0;
    trendFilteredProjects.forEach(project => {
      const items = project.액션아이템목록 || [];
      items.forEach(item => {
        if (item.목표일 && new Date(item.목표일) <= today) {
          plannedByToday++;
        }
        if (item.완료여부) {
          completedAll++;
        }
      });
    });
    if (plannedByToday === 0) return { percent: 0, achieved: 0, target: 0 };
    return { percent: Math.min(Math.round((completedAll / plannedByToday) * 100), 999), achieved: completedAll, target: plannedByToday };
  }, [trendFilteredProjects]);

  // 액션아이템 등록률 계산
  const actionItemRegistrationRate = useMemo(() => {
    if (trendFilteredProjects.length === 0) return 0;
    const projectsWithActionItems = trendFilteredProjects.filter(project => {
      const actionItems = project.액션아이템목록 || [];
      return actionItems.length > 0;
    }).length;
    return Math.round((projectsWithActionItems / trendFilteredProjects.length) * 100);
  }, [trendFilteredProjects]);

  // 액티비티 등록률 계산
  const activityRegistrationRate = useMemo(() => {
    if (trendFilteredProjects.length === 0) return 0;
    const projectsWithActivities = trendFilteredProjects.filter(project => {
      const actionItems = project.액션아이템목록 || [];
      return actionItems.some(item => (item.세부항목목록 || []).length > 0);
    }).length;
    return Math.round((projectsWithActivities / trendFilteredProjects.length) * 100);
  }, [trendFilteredProjects]);

  // 액션아이템 미등록 과제 리스트
  const unregisteredActionItemProjects = useMemo(() => {
    return trendFilteredProjects.filter(project => {
      const actionItems = project.액션아이템목록 || [];
      return actionItems.length === 0;
    });
  }, [trendFilteredProjects]);

  // 액티비티 미등록 과제 리스트 (액션아이템이 있지만 액티비티가 없는 과제)
  const unregisteredActivityProjects = useMemo(() => {
    return trendFilteredProjects.filter(project => {
      const actionItems = project.액션아이템목록 || [];
      // 액션아이템이 있지만, 어떤 액션아이템에도 세부항목이 없는 경우
      return actionItems.length > 0 && !actionItems.some(item => (item.세부항목목록 || []).length > 0);
    });
  }, [trendFilteredProjects]);

  // 액션아이템 일정 수립률 계산 (목표일이 설정된 액션아이템 비율)
  const actionItemScheduleRate = useMemo(() => {
    let totalActionItems = 0;
    let actionItemsWithTargetDate = 0;

    trendFilteredProjects.forEach(project => {
      const actionItems = project.액션아이템목록 || [];
      actionItems.forEach(item => {
        totalActionItems++;
        if (item.목표일) {
          actionItemsWithTargetDate++;
        }
      });
    });

    if (totalActionItems === 0) return 0;
    return Math.round((actionItemsWithTargetDate / totalActionItems) * 100);
  }, [trendFilteredProjects]);

  // 목표일 미설정 액션아이템 리스트
  const unscheduledActionItems = useMemo(() => {
    const items = [];
    trendFilteredProjects.forEach(project => {
      const actionItems = project.액션아이템목록 || [];
      actionItems.forEach(item => {
        if (!item.목표일) {
          items.push({
            projectId: project.id,
            projectName: project.과제명,
            division: project.사업부,
            process: project.프로세스,
            projectPL: project.과제PL || project.PL || '',
            actionItemTitle: item.제목 || item.title || '(제목 없음)',
            actionItemId: item.id
          });
        }
      });
    });
    return items;
  }, [trendFilteredProjects]);

  // 날짜에서 주차 번호를 반환하는 함수 (해당 날짜의 연도 기준)
  // getWeekDateRange와 동일한 기준 사용: 1월 1일이 속한 주의 일요일부터 시작
  const getWeekNumber = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;

    const year = date.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const startDay = startOfYear.getDay(); // 1월 1일의 요일 (0: 일요일)

    // 첫째 주 시작일 계산 (1월 1일이 속한 주의 일요일부터)
    const firstWeekStart = new Date(year, 0, 1 - startDay);

    const diffTime = date - firstWeekStart;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const weekNumber = Math.floor(diffDays / 7) + 1;

    return Math.min(Math.max(weekNumber, 1), 52); // 1~52주로 제한
  };

  // 주차 번호로 해당 주의 시작일과 종료일 반환
  const getWeekDateRange = (weekNumber, year = currentYear) => {
    const startOfYear = new Date(year, 0, 1);
    const startDay = startOfYear.getDay(); // 1월 1일의 요일 (0: 일요일)

    // 첫째 주 시작일 계산 (1월 1일이 속한 주의 일요일부터)
    const firstWeekStart = new Date(year, 0, 1 - startDay);

    // 해당 주의 시작일 (일요일)
    const weekStart = new Date(firstWeekStart);
    weekStart.setDate(firstWeekStart.getDate() + (weekNumber - 1) * 7);

    // 해당 주의 종료일 (토요일)
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const formatDate = (date) => {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      return `${month}/${day}`;
    };

    return `${formatDate(weekStart)} ~ ${formatDate(weekEnd)}`;
  };

  // 특정 주차에 완료된 액션아이템과 액티비티 가져오기
  // 액티비티는 상위 액션아이템과 그룹화하여 반환
  const getCompletedItemsInWeek = (project, weekNumber) => {
    const actionItems = project.액션아이템목록 || [];
    const completedActionItems = []; // 액션아이템 자체가 완료된 경우 (세부항목 없이 단독 완료)
    const groupedActivities = []; // 액티비티가 완료된 경우 (상위 액션아이템과 함께 그룹화)

    actionItems.forEach(actionItem => {
      const actionItemTitle = actionItem.제목;
      const activities = actionItem.세부항목목록 || [];

      // 이번 주에 완료된 액티비티들 수집
      const completedActivitiesInWeek = [];
      activities.forEach(activity => {
        if (activity.완료일) {
          const completedWeek = getWeekNumber(activity.완료일);
          if (completedWeek === weekNumber) {
            completedActivitiesInWeek.push(activity.내용 || activity.제목);
          }
        }
      });

      // 이번 주에 완료된 액티비티가 있으면 그룹으로 추가
      if (completedActivitiesInWeek.length > 0) {
        groupedActivities.push({
          actionItemTitle,
          activities: completedActivitiesInWeek
        });
      } else {
        // 이번 주에 완료된 액티비티가 없는 경우에만 액션아이템 단독 완료 체크
        // (액티비티가 있으면 groupedActivities에서 이미 표시됨)
        if (actionItem.완료일) {
          const completedWeek = getWeekNumber(actionItem.완료일);
          if (completedWeek === weekNumber) {
            // 세부항목이 없는 액션아이템이 이번 주에 완료된 경우만 단독 표시
            if (activities.length === 0) {
              completedActionItems.push(actionItemTitle);
            }
          }
        }
      }
    });

    return { completedActionItems, groupedActivities };
  };

  // 상세 보기용 테이블 데이터
  const detailViewData = useMemo(() => {
    const previousWeek = selectedWeek > 1 ? selectedWeek - 1 : null;

    return trendFilteredProjects.map(project => {
      const currentWeekItems = getCompletedItemsInWeek(project, selectedWeek);
      const prevWeekItems = previousWeek ? getCompletedItemsInWeek(project, previousWeek) : { completedActionItems: [], groupedActivities: [] };

      // 이슈 목록 (미해결/해결 구분)
      const issues = project.이슈목록 || [];
      const unresolvedIssues = issues.filter(issue => !issue.해결여부);
      const resolvedIssues = issues.filter(issue => issue.해결여부);

      return {
        id: project.id,
        프로세스: project.프로세스 || '-',
        과제영역: project.과제영역 || '-',
        과제명: project.과제명,
        currentWeek: currentWeekItems,
        prevWeek: prevWeekItems,
        unresolvedIssues,
        resolvedIssues
      };
    });
  }, [trendFilteredProjects, selectedWeek]);

  // 과제별 보기용 데이터 - 각 과제의 액션아이템 계획 대비 완료 현황
  const projectViewData = useMemo(() => {
    return trendFilteredProjects.map(project => {
      const actionItems = project.액션아이템목록 || [];
      const totalActionItems = actionItems.length;

      // 전체 세부항목 수 및 완료 수
      let totalSubItems = 0;
      let completedSubItems = 0;
      // 완료된 액션아이템 수
      let completedActionItems = 0;

      // 주차별 계획/완료 액션아이템 집계
      const weeklyPlan = {}; // { weekNum: [item titles] } - 목표일 기준
      const weeklyDone = {}; // { weekNum: [item titles] } - 완료일 기준

      actionItems.forEach(item => {
        const subItems = item.세부항목목록 || [];

        // 액션아이템 자체 완료 여부
        if (item.완료여부) completedActionItems++;

        // 목표일 기준 주차별 계획
        if (item.목표일) {
          const targetWeek = getWeekNumber(item.목표일);
          if (targetWeek) {
            if (!weeklyPlan[targetWeek]) weeklyPlan[targetWeek] = [];
            weeklyPlan[targetWeek].push({
              title: item.제목 || '(제목 없음)',
              type: 'actionItem',
              completed: item.완료여부
            });
          }
        }

        // 완료일 기준 주차별 완료
        if (item.완료일) {
          const doneWeek = getWeekNumber(item.완료일);
          if (doneWeek) {
            if (!weeklyDone[doneWeek]) weeklyDone[doneWeek] = [];
            weeklyDone[doneWeek].push({
              title: item.제목 || '(제목 없음)',
              type: 'actionItem'
            });
          }
        }

        // 세부항목 처리
        if (subItems.length > 0) {
          totalSubItems += subItems.length;
          subItems.forEach(sub => {
            if (sub.완료여부) completedSubItems++;

            // 세부항목의 완료일 기준 주차별 완료
            if (sub.완료일) {
              const subDoneWeek = getWeekNumber(sub.완료일);
              if (subDoneWeek) {
                if (!weeklyDone[subDoneWeek]) weeklyDone[subDoneWeek] = [];
                weeklyDone[subDoneWeek].push({
                  title: sub.내용 || sub.제목 || '(제목 없음)',
                  type: 'subItem',
                  parentTitle: item.제목 || '(제목 없음)'
                });
              }
            }
          });
        }
      });

      // 진행률 계산 (기존 calculateProgress와 동일 로직)
      const progress = calculateProgress(project);

      // 누적 계획/완료 (액션아이템 단위로만 카운팅)
      let cumulativePlanned = 0;
      let cumulativeDone = 0;
      for (let w = 1; w <= selectedWeek; w++) {
        cumulativePlanned += (weeklyPlan[w] || []).length;
        cumulativeDone += (weeklyDone[w] || []).filter(item => item.type === 'actionItem').length;
      }

      // 지연 항목: 선택 주차까지 목표일이 있는데 아직 완료되지 않은 액션아이템
      const delayedItems = [];
      actionItems.forEach(item => {
        if (!item.목표일) return;
        const targetWeek = getWeekNumber(item.목표일);
        if (!targetWeek || targetWeek > selectedWeek) return; // 목표일이 선택 주차 이후면 아직 지연 아님
        if (item.완료여부) {
          // 완료됐지만 목표일보다 늦게 완료된 경우도 지연은 아님 (이미 완료)
          return;
        }
        delayedItems.push({
          title: item.제목 || '(제목 없음)',
          targetWeek,
          targetDate: item.목표일
        });
      });

      // 목표일이 설정된 액션아이템이 하나라도 있는지 (전체 기준)
      const hasAnyTargetDate = actionItems.some(item => !!item.목표일);

      return {
        id: project.id,
        사업부: project.사업부,
        프로세스: project.프로세스 || '-',
        과제영역: project.과제영역 || '-',
        과제명: project.과제명,
        과제PL: project.과제PL || project.PL || '-',
        totalActionItems,
        completedActionItems,
        totalSubItems,
        completedSubItems,
        progress,
        delayedItems,
        hasAnyTargetDate,
        cumulativePlanned,
        cumulativeDone,
        weeklyPlan,
        weeklyDone
      };
    });
  }, [trendFilteredProjects, selectedWeek]);

  // 진행률 현황 엑셀 내보내기 (요약 + 상세)
  const handleExportDetailView = () => {
    // CSV 문자열 생성 헬퍼
    const escapeCSV = (value) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const sections = [];

    // ===== 1. 요약 정보 =====
    sections.push(['[요약 정보]']);
    sections.push(['항목', '값']);
    sections.push(['조회 연도', `${currentYear}년`]);
    sections.push(['선택 사업부', trendSelectedDivision === 'all' ? '전체' : trendSelectedDivision]);
    sections.push(['총 과제 수', trendFilteredProjects.length]);
    sections.push(['전체 진행률', `${trendAverageProgress}%`]);
    sections.push(['액션아이템 등록률', `${actionItemRegistrationRate}%`]);
    sections.push(['액티비티 등록률', `${activityRegistrationRate}%`]);
    sections.push([]);

    // ===== 2. 과제 현황 =====
    const completedCount = trendFilteredProjects.filter(p => calculateProgress(p) === 100).length;
    const inProgressCount = trendFilteredProjects.filter(p => {
      const progress = calculateProgress(p);
      return progress > 0 && progress < 100;
    }).length;
    const notStartedCount = trendFilteredProjects.filter(p => calculateProgress(p) === 0).length;

    sections.push(['[과제 현황]']);
    sections.push(['상태', '개수']);
    sections.push(['완료', completedCount]);
    sections.push(['진행중', inProgressCount]);
    sections.push(['미착수', notStartedCount]);
    sections.push([]);

    // ===== 3. 프로세스별 진행률 =====
    sections.push(['[프로세스별 진행률]']);
    sections.push(['프로세스', '과제 수', '평균 진행률']);
    processProgressData.forEach(p => {
      sections.push([p.name, p.count, `${p.avgProgress}%`]);
    });
    sections.push([]);

    // ===== 4. 과제 영역별 진행률 =====
    sections.push(['[과제 영역별 진행률]']);
    sections.push(['과제 영역', '과제 수', '평균 진행률']);
    projectAreaProgressData.forEach(a => {
      sections.push([a.name, a.count, `${a.avgProgress}%`]);
    });
    sections.push([]);

    // ===== 5. 주차별 추이 데이터 (과제) =====
    sections.push(['[주차별 추이 - 과제]']);
    sections.push(['주차', '계획 과제 수', '완료 과제 수']);
    weeklyProjectData.forEach(d => {
      if (d.planned > 0 || d.completed > 0) {
        sections.push([`${d.week}주차`, d.planned, d.completed]);
      }
    });
    sections.push([]);

    // ===== 6. 주차별 추이 데이터 (액션아이템) =====
    sections.push(['[주차별 추이 - 액션아이템]']);
    sections.push(['주차', '계획 액션아이템 수', '완료 액션아이템 수']);
    weeklyActionItemData.forEach(d => {
      if (d.planned > 0 || d.completed > 0) {
        sections.push([`${d.week}주차`, d.planned, d.completed]);
      }
    });
    sections.push([]);

    // ===== 7. 주차별 추이 데이터 (액티비티) =====
    sections.push(['[주차별 추이 - 액티비티]']);
    sections.push(['주차', '계획 액티비티 수', '완료 액티비티 수']);
    weeklyActivityData.forEach(d => {
      if (d.planned > 0 || d.completed > 0) {
        sections.push([`${d.week}주차`, d.planned, d.completed]);
      }
    });
    sections.push([]);

    // ===== 6. 상세 보기 테이블 =====
    const prevWeekLabel = selectedWeek > 1 ? `${selectedWeek - 1}주차 완료 항목` : '- 완료 항목';
    const currentWeekLabel = `${selectedWeek}주차 완료 항목`;

    sections.push(['[상세 보기 - 주차별 완료 현황]']);
    sections.push([`선택 주차: ${selectedWeek}주차`]);
    sections.push(['프로세스', '과제 영역', '과제명', prevWeekLabel, currentWeekLabel, '이슈 사항']);

    // 완료 항목 포맷팅 헬퍼 함수
    const formatCompletedItems = (weekData) => {
      const items = [];
      // 완전히 완료된 액션아이템
      weekData.completedActionItems.forEach(item => {
        items.push(`□ ${item}`);
      });
      // 액티비티가 완료된 액션아이템 그룹
      weekData.groupedActivities.forEach(group => {
        items.push(`□ ${group.actionItemTitle}`);
        group.activities.forEach(activity => {
          items.push(`  - ${activity}`);
        });
      });
      return items.length > 0 ? items.join('\n') : '-';
    };

    detailViewData.forEach(row => {
      const prevWeekItems = selectedWeek > 1
        ? formatCompletedItems(row.prevWeek)
        : '-';

      const currentWeekItems = formatCompletedItems(row.currentWeek);

      const issueItems = [
        ...row.unresolvedIssues.map(issue => `! ${issue.제목}${issue.코멘트 ? ` (${issue.코멘트})` : ''}`),
        ...row.resolvedIssues.map(issue => `✓ ${issue.제목}${issue.코멘트 ? ` (${issue.코멘트})` : ''}`)
      ].join('\n') || '-';

      sections.push([
        row.프로세스,
        row.과제영역,
        row.과제명,
        prevWeekItems,
        currentWeekItems,
        issueItems
      ]);
    });

    // CSV 문자열 생성
    const csvContent = sections
      .map(row => row.map(escapeCSV).join(','))
      .join('\n');

    // BOM 추가 (한글 인코딩)
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

    // 파일 다운로드
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const fileName = `진행률현황_${currentYear}년_${selectedWeek}주차_${todayLocalYmd()}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 로컬 저장 Word 내보내기
  const handleExportDetailViewWord = async () => {
    const paragraphs = [];

    // ===== 1. 요약 정보 =====
    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: '[요약 정보]', bold: true, size: 28 })],
      spacing: { after: 100 }
    }));
    paragraphs.push(new Paragraph({ children: [new TextRun({ text: `조회 연도: ${currentYear}년`, size: 22 })] }));
    paragraphs.push(new Paragraph({ children: [new TextRun({ text: `선택 사업부: ${trendSelectedDivision === 'all' ? '전체' : trendSelectedDivision}`, size: 22 })] }));
    paragraphs.push(new Paragraph({ children: [new TextRun({ text: `총 과제 수: ${trendFilteredProjects.length}개`, size: 22 })] }));
    paragraphs.push(new Paragraph({ children: [new TextRun({ text: `전체 진행률: ${trendAverageProgress}%`, size: 22 })] }));
    paragraphs.push(new Paragraph({ children: [new TextRun({ text: `액션아이템 등록률: ${actionItemRegistrationRate}%`, size: 22 })] }));
    paragraphs.push(new Paragraph({ children: [new TextRun({ text: `액티비티 등록률: ${activityRegistrationRate}%`, size: 22 })] }));

    // ===== 2. 상세 보기 - 주차별 완료 현황 (주차 > 과제 > 액션아이템 > 액티비티) =====

    // 주차별 완료 항목을 과제 단위로 출력하는 헬퍼
    const renderWeekItems = (weekLabel, weekKey) => {
      const weekParagraphs = [];
      detailViewData.forEach(row => {
        const items = row[weekKey];
        const hasItems = items.completedActionItems.length > 0 || items.groupedActivities.length > 0;
        if (!hasItems) return;

        // 과제 이름 (□ 접두어)
        weekParagraphs.push(new Paragraph({
          children: [new TextRun({ text: `□ ${row.과제명}`, bold: true, size: 22 })],
          spacing: { before: 80, after: 40 }
        }));

        items.completedActionItems.forEach(ai => {
          weekParagraphs.push(new Paragraph({ children: [new TextRun({ text: `   - ${ai}`, size: 20 })] }));
        });
        items.groupedActivities.forEach(group => {
          weekParagraphs.push(new Paragraph({ children: [new TextRun({ text: `   - ${group.actionItemTitle}`, size: 20 })] }));
          group.activities.forEach(activity => {
            weekParagraphs.push(new Paragraph({ children: [new TextRun({ text: `     · ${activity}`, size: 20 })] }));
          });
        });
      });

      if (weekParagraphs.length > 0) {
        paragraphs.push(new Paragraph({
          children: [new TextRun({ text: weekLabel, bold: true, size: 24 })],
          spacing: { before: 200, after: 60 }
        }));
        paragraphs.push(...weekParagraphs);
      }
    };

    // 이전 주차
    if (selectedWeek > 1) {
      renderWeekItems(`${selectedWeek - 1}주차 완료 항목`, 'prevWeek');
    }

    // 현재 주차
    renderWeekItems(`${selectedWeek}주차 완료 항목`, 'currentWeek');

    // 이슈 사항 (과제별)
    const issueRows = detailViewData.filter(row => row.unresolvedIssues.length > 0 || row.resolvedIssues.length > 0);
    if (issueRows.length > 0) {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: '[이슈 사항]', bold: true, size: 24 })],
        spacing: { before: 200, after: 60 }
      }));
      issueRows.forEach(row => {
        paragraphs.push(new Paragraph({
          children: [new TextRun({ text: `□ ${row.과제명}`, bold: true, size: 22 })],
          spacing: { before: 80, after: 40 }
        }));
        row.unresolvedIssues.forEach(issue => {
          const comment = issue.코멘트 ? ` (${issue.코멘트})` : '';
          paragraphs.push(new Paragraph({ children: [new TextRun({ text: `   ! ${issue.제목}${comment}`, size: 20, color: 'CC0000' })] }));
        });
        row.resolvedIssues.forEach(issue => {
          const comment = issue.코멘트 ? ` (${issue.코멘트})` : '';
          paragraphs.push(new Paragraph({ children: [new TextRun({ text: `   ✓ ${issue.제목}${comment}`, size: 20, color: '008800' })] }));
        });
      });
    }

    const doc = new Document({
      sections: [{
        properties: {},
        children: paragraphs
      }]
    });

    const blob = await Packer.toBlob(doc);
    const fileName = `진행률현황_${currentYear}년_${selectedWeek}주차_${todayLocalYmd()}.docx`;
    saveAs(blob, fileName);
  };

  // 전체 주차 완료 현황 CSV 내보내기
  const handleExportAllWeeks = () => {
    const escapeCSV = (value) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // 완료 항목을 텍스트로 변환하는 헬퍼 (로컬 저장과 동일한 형식)
    const formatCompletedItems = (items) => {
      const parts = [];
      // 단독 완료된 액션아이템
      items.completedActionItems.forEach(ai => {
        parts.push(`□ ${ai}`);
      });
      // 액티비티가 완료된 액션아이템 그룹
      items.groupedActivities.forEach(group => {
        parts.push(`□ ${group.actionItemTitle}`);
        group.activities.forEach(activity => {
          parts.push(`  - ${activity}`);
        });
      });
      return parts.join('\n') || '';
    };

    // 헤더 생성: 프로세스, 과제영역, 과제명, 1주차~52주차
    const headerRow = ['프로세스', '과제영역', '과제명'];
    for (let w = 1; w <= 52; w++) {
      headerRow.push(`${w}주차 (${getWeekDateRange(w)}) 완료항목`);
    }

    const rows = [];
    rows.push(['[전체 주차별 완료 현황]']);
    rows.push([`조회 연도: ${currentYear}년`]);
    rows.push([`선택 사업부: ${trendSelectedDivision === 'all' ? '전체' : trendSelectedDivision}`]);
    rows.push([`총 과제 수: ${trendFilteredProjects.length}개`]);
    rows.push([]);
    rows.push(headerRow);

    // 각 과제별 데이터
    trendFilteredProjects.forEach(project => {
      const row = [
        project.프로세스 || '-',
        project.과제영역 || '-',
        project.과제명 || ''
      ];

      // 1주차부터 52주차까지 완료 항목 추가
      for (let w = 1; w <= 52; w++) {
        const weekItems = getCompletedItemsInWeek(project, w);
        row.push(formatCompletedItems(weekItems));
      }

      rows.push(row);
    });

    // 이슈 사항 섹션
    rows.push([]);
    rows.push(['[이슈 사항]']);

    const issueHeaderRow = ['프로세스', '과제영역', '과제명'];
    for (let w = 1; w <= 52; w++) {
      issueHeaderRow.push(`${w}주차 (${getWeekDateRange(w)}) 이슈`);
    }
    rows.push(issueHeaderRow);

    // 각 과제별 이슈 데이터 (미해결 이슈만 표시)
    trendFilteredProjects.forEach(project => {
      const issues = project.이슈목록 || [];
      const row = [
        project.프로세스 || '-',
        project.과제영역 || '-',
        project.과제명 || ''
      ];

      // 1주차부터 52주차까지 이슈 추가
      for (let w = 1; w <= 52; w++) {
        const weekIssues = issues.filter(issue => {
          if (!issue.등록일) return false;
          const issueWeek = getWeekNumber(issue.등록일);
          return issueWeek === w;
        });
        const issueTexts = weekIssues.map(issue => {
          const prefix = issue.해결여부 ? '✓' : '!';
          const content = issue.제목 || issue.내용 || '';
          const comment = issue.코멘트 ? ` (${issue.코멘트})` : '';
          return `${prefix} ${content}${comment}`;
        });
        row.push(issueTexts.join('\n') || '');
      }

      rows.push(row);
    });

    // CSV 생성
    const csvContent = rows.map(row => row.map(escapeCSV).join(',')).join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const fileName = `전체주차_완료현황_${currentYear}년_${todayLocalYmd()}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 전체 주차 완료 현황 Word 내보내기
  const handleExportAllWeeksWord = async () => {
    const paragraphs = [];

    // 헤더 정보
    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: '[전체 주차별 완료 현황]', bold: true, size: 28 })],
      spacing: { after: 100 }
    }));
    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: `조회 연도: ${currentYear}년`, size: 22 })],
    }));
    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: `선택 사업부: ${trendSelectedDivision === 'all' ? '전체' : trendSelectedDivision}`, size: 22 })],
    }));
    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: `총 과제 수: ${trendFilteredProjects.length}개`, size: 22 })],
      spacing: { after: 200 }
    }));

    // 주차별 > 과제별 > 액션아이템 > 액티비티 계층 구조
    for (let w = 1; w <= 52; w++) {
      const weekProjectParagraphs = [];

      trendFilteredProjects.forEach(project => {
        const weekItems = getCompletedItemsInWeek(project, w);
        const hasItems = weekItems.completedActionItems.length > 0 || weekItems.groupedActivities.length > 0;
        if (!hasItems) return;

        // 과제 이름 (□ 접두어)
        weekProjectParagraphs.push(new Paragraph({
          children: [new TextRun({ text: `□ ${project.과제명 || ''}`, bold: true, size: 22 })],
          spacing: { before: 80, after: 40 }
        }));

        // 단독 완료된 액션아이템
        weekItems.completedActionItems.forEach(ai => {
          weekProjectParagraphs.push(new Paragraph({
            children: [new TextRun({ text: `   - ${ai}`, size: 20 })],
          }));
        });

        // 액티비티가 완료된 액션아이템 그룹
        weekItems.groupedActivities.forEach(group => {
          weekProjectParagraphs.push(new Paragraph({
            children: [new TextRun({ text: `   - ${group.actionItemTitle}`, size: 20 })],
          }));
          group.activities.forEach(activity => {
            weekProjectParagraphs.push(new Paragraph({
              children: [new TextRun({ text: `     · ${activity}`, size: 20 })],
            }));
          });
        });
      });

      if (weekProjectParagraphs.length > 0) {
        // 주차 제목
        paragraphs.push(new Paragraph({
          children: [new TextRun({ text: `${w}주차 (${getWeekDateRange(w)})`, bold: true, size: 24 })],
          spacing: { before: 200, after: 60 }
        }));
        paragraphs.push(...weekProjectParagraphs);
      }
    }

    const doc = new Document({
      sections: [{
        properties: {},
        children: paragraphs
      }]
    });

    const blob = await Packer.toBlob(doc);
    const fileName = `전체주차_완료현황_${currentYear}년_${todayLocalYmd()}.docx`;
    saveAs(blob, fileName);
  };

  // 과제별 보기 CSV 내보내기
  const handleExportProjectView = () => {
    const escapeCSV = (value) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const getStatusKey = (row) => {
      if (row.totalActionItems === 0) return 'noAction';
      if (!row.hasAnyTargetDate) return 'noTarget';
      if (row.delayedItems.length > 0) return 'delayed';
      return 'normal';
    };
    const statusLabels = { normal: '정상', delayed: '지연', noTarget: '목표일 미설정', noAction: '미등록' };

    const rows = [];
    rows.push(['[과제별 액션아이템 진척 현황]']);
    rows.push([`조회 연도: ${currentYear}년`]);
    rows.push([`선택 사업부: ${trendSelectedDivision === 'all' ? '전체' : trendSelectedDivision}`]);
    rows.push([`선택 주차: ${selectedWeek}주차 (${getWeekDateRange(selectedWeek)})`]);
    const statusFilterLabels = { all: '전체', normal: '정상', delayed: '지연', noTarget: '목표일 미설정', noAction: '미등록' };
    rows.push([`상태 필터: ${statusFilterLabels[projectViewStatusFilter] || '전체'}`]);
    rows.push([`총 과제 수: ${trendFilteredProjects.length}개`]);
    rows.push([]);

    // 헤더
    rows.push([
      '사업부', '과제명', '과제PL', '전체 진행률(%)',
      '액션아이템(완료/전체)', '세부항목(완료/전체)',
      `~${selectedWeek}주차 지연 항목`,
      `누적 목표`, `누적 완료`, '상태'
    ]);

    // 현재 상태 필터 적용
    const filteredData = projectViewStatusFilter === 'all'
      ? projectViewData
      : projectViewData.filter(row => getStatusKey(row) === projectViewStatusFilter);

    // 데이터
    filteredData.forEach(row => {
      const delayedText = row.delayedItems.length > 0
        ? row.delayedItems.map(d => `${d.title} (목표: ${d.targetWeek}주차)`).join('\n')
        : '';
      const sk = getStatusKey(row);
      const statusText = sk === 'delayed' ? `지연 (${row.delayedItems.length})` : statusLabels[sk];

      rows.push([
        row.사업부,
        row.과제명,
        row.과제PL,
        row.progress,
        `="${row.completedActionItems} / ${row.totalActionItems}"`,
        row.totalSubItems > 0 ? `="${row.completedSubItems} / ${row.totalSubItems}"` : '-',
        delayedText,
        row.cumulativePlanned,
        row.cumulativeDone,
        statusText
      ]);
    });

    const csvContent = rows.map(row => row.map(escapeCSV).join(',')).join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const division = trendSelectedDivision === 'all' ? '전체' : trendSelectedDivision;
    const fileName = `과제별_진척현황_${currentYear}년_${division}_${selectedWeek}주차_${todayLocalYmd()}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 미등록 과제 CSV 내보내기
  const handleExportUnregisteredProjects = (type) => {
    const escapeCSV = (value) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const projectList = type === 'actionItem'
      ? unregisteredActionItemProjects
      : unregisteredActivityProjects;

    const typeLabel = type === 'actionItem' ? '액션아이템' : '액티비티';

    const rows = [
      [`[${typeLabel} 미등록 과제 목록]`],
      [`조회 연도: ${currentYear}년`],
      [`선택 사업부: ${trendSelectedDivision === 'all' ? '전체' : trendSelectedDivision}`],
      [`총 미등록 과제 수: ${projectList.length}개`],
      [],
      ['과제명', '과제 PL']
    ];

    projectList.forEach(project => {
      rows.push([
        escapeCSV(project.과제명 || ''),
        escapeCSV(project.과제PL || project.PL || '')
      ]);
    });

    const csvContent = rows.map(row => row.join(',')).join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const fileName = `${typeLabel}_미등록과제_${currentYear}년_${todayLocalYmd()}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 전체 진행률 리스트 내보내기
  const handleExportProgressList = () => {
    const escapeCSV = (value) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const sortedProjects = [...trendFilteredProjects].sort((a, b) => {
      const progressA = a.진행률 ?? 0;
      const progressB = b.진행률 ?? 0;
      return progressB - progressA;
    });

    const rows = [
      ['[전체 과제 진행률 현황]'],
      [`조회 연도: ${currentYear}년`],
      [`선택 사업부: ${trendSelectedDivision === 'all' ? '전체' : trendSelectedDivision}`],
      [`총 과제 수: ${sortedProjects.length}개`],
      [`평균 진행률: ${trendAverageProgress}%`],
      [],
      ['과제명', '사업부', '프로세스', '과제영역', '과제구분', '과제PL', '진행률']
    ];

    sortedProjects.forEach(project => {
      rows.push([
        escapeCSV(project.과제명 || ''),
        escapeCSV(project.사업부 || ''),
        escapeCSV(project.프로세스 || ''),
        escapeCSV(project.과제영역 || ''),
        escapeCSV(project.과제구분 || ''),
        escapeCSV(project.과제PL || project.PL || ''),
        percentText(project.진행률)
      ]);
    });

    const csvContent = rows.map(row => row.join(',')).join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const fileName = `과제진행률현황_${currentYear}년_${todayLocalYmd()}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 목표일 미설정 액션아이템 리스트 내보내기
  const handleExportUnscheduledActionItems = () => {
    const escapeCSV = (value) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = [
      ['[목표일 미설정 액션아이템 목록]'],
      [`조회 연도: ${currentYear}년`],
      [`선택 사업부: ${trendSelectedDivision === 'all' ? '전체' : trendSelectedDivision}`],
      [`총 미설정 액션아이템 수: ${unscheduledActionItems.length}개`],
      [`액션아이템 일정 수립률: ${actionItemScheduleRate}%`],
      [],
      ['과제명', '사업부', '프로세스', '과제PL', '액션아이템']
    ];

    unscheduledActionItems.forEach(item => {
      rows.push([
        escapeCSV(item.projectName || ''),
        escapeCSV(item.division || ''),
        escapeCSV(item.process || ''),
        escapeCSV(item.projectPL || ''),
        escapeCSV(item.actionItemTitle || '')
      ]);
    });

    const csvContent = rows.map(row => row.join(',')).join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const fileName = `목표일미설정_액션아이템_${currentYear}년_${todayLocalYmd()}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 주차별 액션 아이템 데이터 계산 (누적 방식)
  const weeklyActionItemData = useMemo(() => {
    // 52주 데이터 초기화
    const weeklyData = Array.from({ length: 52 }, (_, i) => ({
      week: i + 1,
      planned: 0,
      completed: 0,
      total: 0
    }));

    // 필터링된 프로젝트의 모든 액션 아이템 순회
    trendFilteredProjects.forEach(project => {
      const actionItems = project.액션아이템목록 || [];

      actionItems.forEach(item => {
        // 총 액션 아이템: 목표일 기준 전체 (완료 여부 무관)
        if (item.목표일) {
          const targetWeek = getWeekNumber(item.목표일);
          if (targetWeek) {
            for (let w = targetWeek - 1; w < 52; w++) {
              weeklyData[w].total += 1;
            }
          }
        }

        if (item.완료여부 && item.완료일) {
          // 완료된 항목: 완료 라인에만 표시
          const completedWeek = getWeekNumber(item.완료일);
          if (completedWeek) {
            for (let w = completedWeek - 1; w < 52; w++) {
              weeklyData[w].completed += 1;
            }
          }
        } else if (item.목표일) {
          // 미완료 항목: 계획 라인에만 표시
          const targetWeek = getWeekNumber(item.목표일);
          if (targetWeek) {
            for (let w = targetWeek - 1; w < 52; w++) {
              weeklyData[w].planned += 1;
            }
          }
        }
      });
    });

    return weeklyData;
  }, [trendFilteredProjects]);

  // 실제 액션 아이템 개수 계산 (요약용)
  const actionItemStats = useMemo(() => {
    let totalPlanned = 0;
    let totalCompleted = 0;

    trendFilteredProjects.forEach(project => {
      const actionItems = project.액션아이템목록 || [];
      actionItems.forEach(item => {
        if (item.완료여부 && item.완료일) {
          totalCompleted += 1;
        } else if (item.목표일) {
          totalPlanned += 1;
        }
      });
    });

    return { totalPlanned, totalCompleted };
  }, [trendFilteredProjects]);

  // 월을 주차로 변환하는 함수 (해당 월의 첫 주차 반환)
  const monthToWeek = (month) => {
    if (!month || month < 1 || month > 12) return null;
    // 각 월의 대략적인 시작 주차 (1월=1주, 2월=5주, ...)
    return Math.round((month - 1) * 4.33) + 1;
  };

  // 과제의 완료일 계산 (액션아이템 완료일 중 가장 늦은 날짜)
  const getProjectCompletedDate = (project) => {
    const actionItems = project.액션아이템목록 || [];
    let latestDate = null;

    actionItems.forEach(item => {
      if (item.완료일) {
        if (!latestDate || item.완료일 > latestDate) {
          latestDate = item.완료일;
        }
      }
    });

    return latestDate;
  };

  // 주차별 과제 데이터 계산 (누적 방식)
  const weeklyProjectData = useMemo(() => {
    // 52주 데이터 초기화
    const weeklyData = Array.from({ length: 52 }, (_, i) => ({
      week: i + 1,
      planned: 0,
      completed: 0,
      total: 0
    }));

    // 필터링된 프로젝트 순회
    trendFilteredProjects.forEach(project => {
      const progress = calculateProgress(project);
      const completedDate = getProjectCompletedDate(project);
      const isCompleted = progress === 100 && completedDate;

      // 총: 종료월 기준 전체 (완료 여부 무관)
      const endMonth = project.종료 || project.end;
      if (endMonth) {
        const endWeek = monthToWeek(endMonth);
        if (endWeek) {
          for (let w = endWeek - 1; w < 52; w++) {
            weeklyData[w].total += 1;
          }
        }
      }

      if (isCompleted) {
        // 완료된 과제: 완료 라인에만 표시
        const completedWeek = getWeekNumber(completedDate);
        if (completedWeek) {
          for (let w = completedWeek - 1; w < 52; w++) {
            weeklyData[w].completed += 1;
          }
        }
      } else {
        // 미완료 과제: 계획 라인에만 표시
        if (endMonth) {
          const endWeek = monthToWeek(endMonth);
          if (endWeek) {
            for (let w = endWeek - 1; w < 52; w++) {
              weeklyData[w].planned += 1;
            }
          }
        }
      }
    });

    return weeklyData;
  }, [trendFilteredProjects]);

  // 실제 과제 개수 계산 (요약용)
  const projectStats = useMemo(() => {
    let totalPlanned = 0;
    let totalCompleted = 0;

    trendFilteredProjects.forEach(project => {
      const progress = calculateProgress(project);
      const completedDate = getProjectCompletedDate(project);
      if (progress === 100 && completedDate) {
        totalCompleted += 1;
      } else if (project.종료 || project.end) {
        totalPlanned += 1;
      }
    });

    return { totalPlanned, totalCompleted };
  }, [trendFilteredProjects]);

  // 주차별 액티비티 데이터 계산 (누적 방식)
  const weeklyActivityData = useMemo(() => {
    // 52주 데이터 초기화
    const weeklyData = Array.from({ length: 52 }, (_, i) => ({
      week: i + 1,
      planned: 0,
      completed: 0,
      total: 0
    }));

    // 필터링된 프로젝트의 모든 액티비티 순회
    trendFilteredProjects.forEach(project => {
      const actionItems = project.액션아이템목록 || [];

      actionItems.forEach(actionItem => {
        const activities = actionItem.세부항목목록 || [];
        const actionItemTargetWeek = getWeekNumber(actionItem.목표일);

        activities.forEach(activity => {
          // 총: 목표일 기준 전체 (완료 여부 무관)
          if (actionItemTargetWeek) {
            for (let w = actionItemTargetWeek - 1; w < 52; w++) {
              weeklyData[w].total += 1;
            }
          }

          if (activity.완료여부 && activity.완료일) {
            // 완료된 액티비티: 완료 라인에만 표시
            const completedWeek = getWeekNumber(activity.완료일);
            if (completedWeek) {
              for (let w = completedWeek - 1; w < 52; w++) {
                weeklyData[w].completed += 1;
              }
            }
          } else if (actionItemTargetWeek) {
            // 미완료 액티비티: 계획 라인에만 표시
            for (let w = actionItemTargetWeek - 1; w < 52; w++) {
              weeklyData[w].planned += 1;
            }
          }
        });
      });
    });

    return weeklyData;
  }, [trendFilteredProjects]);

  // 실제 액티비티 개수 계산 (요약용)
  const activityStats = useMemo(() => {
    let totalPlanned = 0;
    let totalCompleted = 0;

    trendFilteredProjects.forEach(project => {
      const actionItems = project.액션아이템목록 || [];
      actionItems.forEach(actionItem => {
        const activities = actionItem.세부항목목록 || [];
        activities.forEach(activity => {
          if (activity.완료여부 && activity.완료일) {
            totalCompleted += 1;
          } else if (actionItem.목표일) {
            totalPlanned += 1;
          }
        });
      });
    });

    return { totalPlanned, totalCompleted };
  }, [trendFilteredProjects]);

  // 현재 선택된 차트 타입에 따른 데이터
  const currentChartData = useMemo(() => {
    switch (trendChartType) {
      case 'project': return weeklyProjectData;
      case 'activity': return weeklyActivityData;
      default: return weeklyActionItemData;
    }
  }, [trendChartType, weeklyProjectData, weeklyActivityData, weeklyActionItemData]);

  const currentStats = useMemo(() => {
    switch (trendChartType) {
      case 'project': return projectStats;
      case 'activity': return activityStats;
      default: return actionItemStats;
    }
  }, [trendChartType, projectStats, activityStats, actionItemStats]);

  // 특정 주차의 실제 아이템 목록 가져오기 (비누적)
  const getWeeklyItems = (weekNum) => {
    const plannedItems = [];
    const completedItems = [];

    // 공통 프로젝트 정보 추출 함수
    const getProjectInfo = (project) => ({
      process: project.프로세스 || '',
      projectArea: project.과제영역 || '',
      projectType: project.과제구분 || '',
      projectPL: project.과제PL || '',
      projectMembers: (project.과제참여인력목록 || []).map(m => typeof m === 'string' ? m : m.이름 || '').filter(Boolean).join('|')
    });

    trendFilteredProjects.forEach(project => {
      const projectInfo = getProjectInfo(project);

      if (trendChartType === 'project') {
        // 과제 기준 — 과제 전체의 액티비티 통계 계산
        const allActivities = (project.액션아이템목록 || []).flatMap(ai => {
          const subs = ai.세부항목목록 || [];
          return subs.map(a => ({ ...a, 목표일: ai.목표일 }));
        });
        const totalActivities = allActivities.length;
        const completedActivitiesCount = allActivities.filter(a => a.완료여부).length;
        const plannedActivitiesCount = totalActivities - completedActivitiesCount;
        const delayedActivitiesCount = allActivities.filter(a => {
          if (a.완료여부) return false;
          if (!a.목표일) return false;
          return new Date(a.목표일) < new Date();
        }).length;
        const projActivityStats = { totalActivities, completedActivities: completedActivitiesCount, plannedActivities: plannedActivitiesCount, delayedActivities: delayedActivitiesCount };

        const progress = calculateProgress(project);
        const completedDate = getProjectCompletedDate(project);
        const isCompleted = progress === 100 && completedDate;

        if (isCompleted) {
          // 완료된 과제: 완료에만 표시
          const completedWeek = getWeekNumber(completedDate);
          if (completedWeek === weekNum) {
            completedItems.push({
              type: 'project',
              projectId: project.id,
              projectName: project.과제명,
              division: project.사업부,
              date: completedDate,
              createdAt: project.createdAt || null,
              ...projectInfo,
              ...projActivityStats
            });
          }
        } else {
          // 미완료 과제: 계획에만 표시
          const endMonth = project.종료 || project.end;
          const endWeek = endMonth ? monthToWeek(endMonth) : null;
          if (endWeek === weekNum) {
            plannedItems.push({
              type: 'project',
              projectId: project.id,
              projectName: project.과제명,
              division: project.사업부,
              date: `${endMonth}월`,
              createdAt: project.createdAt || null,
              ...projectInfo,
              ...projActivityStats
            });
          }
        }
      } else if (trendChartType === 'activity') {
        // 액티비티 기준
        const actionItems = project.액션아이템목록 || [];
        actionItems.forEach(actionItem => {
          const targetWeek = actionItem.목표일 ? getWeekNumber(actionItem.목표일) : null;
          const activities = actionItem.세부항목목록 || [];

          activities.forEach(activity => {
            if (activity.완료여부 && activity.완료일) {
              // 완료된 액티비티: 완료에만 표시
              const completedWeek = getWeekNumber(activity.완료일);
              if (completedWeek === weekNum) {
                completedItems.push({
                  type: 'activity',
                  projectId: project.id,
                  projectName: project.과제명,
                  actionItemTitle: actionItem.제목,
                  activityContent: activity.내용,
                  division: project.사업부,
                  date: activity.완료일,
                  targetDate: actionItem.목표일 || '미수립',
                  ...projectInfo
                });
              }
            } else if (targetWeek === weekNum) {
              // 미완료 액티비티: 계획에만 표시
              plannedItems.push({
                type: 'activity',
                projectId: project.id,
                projectName: project.과제명,
                actionItemTitle: actionItem.제목,
                activityContent: activity.내용,
                division: project.사업부,
                date: actionItem.목표일,
                ...projectInfo
              });
            }
          });
        });
      } else {
        // 액션아이템 기준
        const actionItems = project.액션아이템목록 || [];
        actionItems.forEach(item => {
          // 액티비티 통계 계산
          const activities = item.세부항목목록 || [];
          const totalActivities = activities.length;
          const completedActivities = activities.filter(a => a.완료여부).length;
          const plannedActivities = totalActivities - completedActivities;
          const delayedActivities = activities.filter(a => {
            if (a.완료여부) return false;
            if (!item.목표일) return false;
            return new Date(item.목표일) < new Date();
          }).length;
          const activityStats = { totalActivities, completedActivities, plannedActivities, delayedActivities };

          if (item.완료여부 && item.완료일) {
            // 완료된 액션아이템: 완료에만 표시
            const completedWeek = getWeekNumber(item.완료일);
            if (completedWeek === weekNum) {
              completedItems.push({
                type: 'actionItem',
                projectId: project.id,
                projectName: project.과제명,
                title: item.제목,
                division: project.사업부,
                date: item.완료일,
                targetDate: item.목표일 || '미수립',
                createdAt: getActionItemCreatedAt(item),
                ...projectInfo,
                ...activityStats
              });
            }
          } else if (item.목표일) {
            // 미완료 액션아이템: 계획에만 표시
            const targetWeek = getWeekNumber(item.목표일);
            if (targetWeek === weekNum) {
              plannedItems.push({
                type: 'actionItem',
                projectId: project.id,
                projectName: project.과제명,
                title: item.제목,
                division: project.사업부,
                date: item.목표일,
                createdAt: getActionItemCreatedAt(item),
                ...projectInfo,
                ...activityStats
              });
            }
          }
        });
      }
    });

    return { plannedItems, completedItems };
  };

  // 전체 주차의 아이템 목록 가져오기
  const getAllWeeklyItems = () => {
    const allPlannedItems = [];
    const allCompletedItems = [];

    for (let weekNum = 1; weekNum <= 52; weekNum++) {
      const { plannedItems, completedItems } = getWeeklyItems(weekNum);
      plannedItems.forEach(item => {
        allPlannedItems.push({ ...item, weekNum });
      });
      completedItems.forEach(item => {
        allCompletedItems.push({ ...item, weekNum });
      });
    }

    // 일정 미수립 아이템 수집 (목표일이 없는 액션아이템/액티비티)
    const getProjectInfo = (project) => ({
      process: project.프로세스 || '',
      projectArea: project.과제영역 || '',
      projectType: project.과제구분 || '',
      projectPL: project.과제PL || '',
      projectMembers: (project.과제참여인력목록 || []).map(m => typeof m === 'string' ? m : m.이름 || '').filter(Boolean).join('|')
    });

    trendFilteredProjects.forEach(project => {
      const projectInfo = getProjectInfo(project);

      if (trendChartType === 'actionItem') {
        const actionItems = project.액션아이템목록 || [];
        actionItems.forEach(item => {
          // 미수립: 목표일도 없고 완료되지도 않은 항목
          if (!item.목표일 && !(item.완료여부 && item.완료일)) {
            const activities = item.세부항목목록 || [];
            const totalActivities = activities.length;
            const completedActivities = activities.filter(a => a.완료여부).length;
            const plannedActivities = totalActivities - completedActivities;
            const delayedActivities = 0; // 목표일 미수립이므로 지연 판단 불가
            allPlannedItems.push({
              type: 'actionItem',
              projectId: project.id,
              projectName: project.과제명,
              title: item.제목,
              division: project.사업부,
              date: '미수립',
              weekNum: '미수립',
              createdAt: getActionItemCreatedAt(item),
              ...projectInfo,
              totalActivities, completedActivities, plannedActivities, delayedActivities
            });
          }
        });
      } else if (trendChartType === 'activity') {
        const actionItems = project.액션아이템목록 || [];
        actionItems.forEach(actionItem => {
          if (!actionItem.목표일) {
            const activities = actionItem.세부항목목록 || [];
            activities.forEach(activity => {
              // 미수립: 완료되지 않은 액티비티만
              if (!(activity.완료여부 && activity.완료일)) {
                allPlannedItems.push({
                  type: 'activity',
                  projectId: project.id,
                  projectName: project.과제명,
                  actionItemTitle: actionItem.제목,
                  activityContent: activity.내용,
                  division: project.사업부,
                  date: '미수립',
                  weekNum: '미수립',
                  ...projectInfo
                });
              }
            });
          }
        });
      }
    });

    return { plannedItems: allPlannedItems, completedItems: allCompletedItems };
  };

  // 주차별 추이 모달 데이터 내보내기
  const handleExportWeeklyTrendItems = (weekNum, plannedItems, completedItems) => {
    const escapeCSV = (value) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // ISO 타임스탬프를 YYYY-MM-DD 로 포맷 (생성 날짜 열용)
    const formatCreatedAt = (iso) => {
      if (!iso) return '';
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const isAllWeeks = weekNum === 'all';
    const typeLabel = trendChartType === 'project' ? '과제' : trendChartType === 'activity' ? '액티비티' : '액션아이템';
    const titleText = isAllWeeks ? `전체 ${typeLabel} 현황` : `${weekNum}주차 ${typeLabel} 현황`;

    const rows = [
      [`[${titleText}]`],
      [`조회 연도: ${currentYear}년`],
      [`선택 사업부: ${trendSelectedDivision === 'all' ? '전체' : trendSelectedDivision}`],
      [`총: ${plannedItems.length + completedItems.length}건, 계획: ${plannedItems.length}건, 완료: ${completedItems.length}건`],
      [],
      isAllWeeks
        ? (trendChartType === 'activity'
          ? ['구분', '주차', '사업부', '프로세스', '과제영역', '과제구분', '과제명', '액션아이템', '액티비티', '목표일', '완료일', '과제 PL', '과제 멤버']
          : ['구분', '주차', '사업부', '프로세스', '과제영역', '과제구분', '과제명', '액션아이템', '전체 액티비티', '완료 액티비티', '계획 액티비티', '지연 액티비티', '생성 날짜', '목표일', '완료일', '과제 PL', '과제 멤버'])
        : (trendChartType === 'activity'
          ? ['구분', '사업부', '프로세스', '과제영역', '과제구분', '과제명', '액션아이템', '액티비티', '목표일', '완료일', '과제 PL', '과제 멤버']
          : ['구분', '사업부', '프로세스', '과제영역', '과제구분', '과제명', '액션아이템', '전체 액티비티', '완료 액티비티', '계획 액티비티', '지연 액티비티', '생성 날짜', '목표일', '완료일', '과제 PL', '과제 멤버'])
    ];

    // 계획 아이템 추가 (목표일만 있고 완료일은 미완료)
    plannedItems.forEach(item => {
      const baseRow = [escapeCSV('계획')];
      if (isAllWeeks) baseRow.push(escapeCSV(item.weekNum === '미수립' ? '미수립' : (item.weekNum ? `${item.weekNum}주` : '')));

      if (trendChartType === 'project') {
        rows.push([
          ...baseRow,
          escapeCSV(item.division || ''),
          escapeCSV(item.process || ''),
          escapeCSV(item.projectArea || ''),
          escapeCSV(item.projectType || ''),
          escapeCSV(item.projectName || ''),
          escapeCSV(''),
          escapeCSV(item.totalActivities ?? ''),
          escapeCSV(item.completedActivities ?? ''),
          escapeCSV(item.plannedActivities ?? ''),
          escapeCSV(item.delayedActivities ?? ''),
          escapeCSV(formatCreatedAt(item.createdAt)),
          escapeCSV(item.date || ''),
          escapeCSV('미완료'),
          escapeCSV(item.projectPL || ''),
          escapeCSV(item.projectMembers || '')
        ]);
      } else if (trendChartType === 'activity') {
        rows.push([
          ...baseRow,
          escapeCSV(item.division || ''),
          escapeCSV(item.process || ''),
          escapeCSV(item.projectArea || ''),
          escapeCSV(item.projectType || ''),
          escapeCSV(item.projectName || ''),
          escapeCSV(item.actionItemTitle || ''),
          escapeCSV(item.activityContent || ''),
          escapeCSV(item.date || ''),
          escapeCSV('미완료'),
          escapeCSV(item.projectPL || ''),
          escapeCSV(item.projectMembers || '')
        ]);
      } else {
        rows.push([
          ...baseRow,
          escapeCSV(item.division || ''),
          escapeCSV(item.process || ''),
          escapeCSV(item.projectArea || ''),
          escapeCSV(item.projectType || ''),
          escapeCSV(item.projectName || ''),
          escapeCSV(item.title || ''),
          escapeCSV(item.totalActivities ?? ''),
          escapeCSV(item.completedActivities ?? ''),
          escapeCSV(item.plannedActivities ?? ''),
          escapeCSV(item.delayedActivities ?? ''),
          escapeCSV(formatCreatedAt(item.createdAt)),
          escapeCSV(item.date || ''),
          escapeCSV('미완료'),
          escapeCSV(item.projectPL || ''),
          escapeCSV(item.projectMembers || '')
        ]);
      }
    });

    // 완료 아이템 추가 (목표일과 완료일 모두 표시)
    completedItems.forEach(item => {
      const baseRow = [escapeCSV('완료')];
      if (isAllWeeks) baseRow.push(escapeCSV(item.weekNum === '미수립' ? '미수립' : (item.weekNum ? `${item.weekNum}주` : '')));

      if (trendChartType === 'project') {
        rows.push([
          ...baseRow,
          escapeCSV(item.division || ''),
          escapeCSV(item.process || ''),
          escapeCSV(item.projectArea || ''),
          escapeCSV(item.projectType || ''),
          escapeCSV(item.projectName || ''),
          escapeCSV(''),
          escapeCSV(item.totalActivities ?? ''),
          escapeCSV(item.completedActivities ?? ''),
          escapeCSV(item.plannedActivities ?? ''),
          escapeCSV(item.delayedActivities ?? ''),
          escapeCSV(formatCreatedAt(item.createdAt)),
          escapeCSV(item.targetDate || ''),
          escapeCSV(item.date || ''),
          escapeCSV(item.projectPL || ''),
          escapeCSV(item.projectMembers || '')
        ]);
      } else if (trendChartType === 'activity') {
        rows.push([
          ...baseRow,
          escapeCSV(item.division || ''),
          escapeCSV(item.process || ''),
          escapeCSV(item.projectArea || ''),
          escapeCSV(item.projectType || ''),
          escapeCSV(item.projectName || ''),
          escapeCSV(item.actionItemTitle || ''),
          escapeCSV(item.activityContent || ''),
          escapeCSV(item.targetDate || ''),
          escapeCSV(item.date || ''),
          escapeCSV(item.projectPL || ''),
          escapeCSV(item.projectMembers || '')
        ]);
      } else {
        rows.push([
          ...baseRow,
          escapeCSV(item.division || ''),
          escapeCSV(item.process || ''),
          escapeCSV(item.projectArea || ''),
          escapeCSV(item.projectType || ''),
          escapeCSV(item.projectName || ''),
          escapeCSV(item.title || ''),
          escapeCSV(item.totalActivities ?? ''),
          escapeCSV(item.completedActivities ?? ''),
          escapeCSV(item.plannedActivities ?? ''),
          escapeCSV(item.delayedActivities ?? ''),
          escapeCSV(formatCreatedAt(item.createdAt)),
          escapeCSV(item.targetDate || ''),
          escapeCSV(item.date || ''),
          escapeCSV(item.projectPL || ''),
          escapeCSV(item.projectMembers || '')
        ]);
      }
    });

    const csvContent = rows.map(row => row.join(',')).join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const fileName = isAllWeeks
      ? `전체_${typeLabel}_현황_${currentYear}년_${todayLocalYmd()}.csv`
      : `${weekNum}주차_${typeLabel}_현황_${currentYear}년_${todayLocalYmd()}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 차트에서 사용할 최대값 계산 (5의 배수로 올림하여 Y축 눈금과 정확히 일치하도록)
  const maxChartValue = useMemo(() => {
    const maxPlanned = Math.max(...currentChartData.map(d => d.planned), 0);
    const maxCompleted = Math.max(...currentChartData.map(d => d.completed), 0);
    const maxTotal = Math.max(...currentChartData.map(d => d.total || 0), 0);
    const rawMax = Math.max(maxPlanned, maxCompleted, maxTotal, 5);
    // 5의 배수로 올림 (Y축이 5등분되므로)
    return Math.ceil(rawMax / 5) * 5;
  }, [currentChartData]);

  // 프로세스별 진행률 계산
  const processList = settingsData.processes || [];
  const processProgressData = useMemo(() => {
    const processOrder = ['개발', '품질', '제조', '구매', '디자인', '연계'];

    return processList
      .map(process => {
        const processProjects = trendFilteredProjects.filter(p => p.프로세스 === process.name);
        const count = processProjects.length;
        const avgProgress = count > 0
          ? Math.round(processProjects.reduce((sum, p) => sum + calculateProgress(p), 0) / count)
          : 0;
        return {
          name: process.name,
          count,
          avgProgress
        };
      })
      .filter(p => p.count > 0)
      .sort((a, b) => {
        const indexA = processOrder.indexOf(a.name);
        const indexB = processOrder.indexOf(b.name);
        if (indexA === -1 && indexB === -1) return a.name.localeCompare(b.name);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });
  }, [trendFilteredProjects, processList]);

  // 과제 영역별 진행률 계산
  const projectAreaProgressData = useMemo(() => {
    const areaOrder = ['데이터', '시뮬레이션', 'AI'];
    const areaSet = new Set();

    // 프로젝트에서 사용된 과제 영역 수집
    trendFilteredProjects.forEach(p => {
      if (p.과제영역) areaSet.add(p.과제영역);
    });

    return Array.from(areaSet)
      .map(area => {
        const areaProjects = trendFilteredProjects.filter(p => p.과제영역 === area);
        const count = areaProjects.length;
        const avgProgress = count > 0
          ? Math.round(areaProjects.reduce((sum, p) => sum + calculateProgress(p), 0) / count)
          : 0;
        return {
          name: area,
          count,
          avgProgress
        };
      })
      .filter(p => p.count > 0)
      .sort((a, b) => {
        const indexA = areaOrder.indexOf(a.name);
        const indexB = areaOrder.indexOf(b.name);
        if (indexA === -1 && indexB === -1) return a.name.localeCompare(b.name);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });
  }, [trendFilteredProjects]);

  const handlePrevYear = () => {
    const newYear = currentYear - 1;
    setCurrentYear(newYear);
    if (onYearChange) {
      onYearChange(newYear);
    }
  };

  const handleNextYear = () => {
    const newYear = currentYear + 1;
    setCurrentYear(newYear);
    if (onYearChange) {
      onYearChange(newYear);
    }
  };

  // 현재 연도의 프로젝트만 필터링 (삭제된 과제 제외)
  const filteredProjects = useMemo(() => {
    return projects.filter(project =>
      project.과제년도 === currentYear && !project._deleted
    );
  }, [projects, currentYear]);

  // ============ 경영진 보고 ============

  // 경영진 보고 기본 모집단 (사업부 필터 미적용, 취소·삭제 제외)
  const executiveBaseProjects = useMemo(() => {
    return projects.filter(p =>
      p.과제년도 === currentYear &&
      !p._deleted &&
      p.진행상태 !== '취소'
    );
  }, [projects, currentYear]);

  // 사업부 필터 적용된 과제 목록 (취소 제외, 삭제 제외)
  const executiveFilteredProjects = useMemo(() => {
    return executiveBaseProjects.filter(p =>
      executiveSelectedDivision === 'all' || p.사업부 === executiveSelectedDivision
    );
  }, [executiveBaseProjects, executiveSelectedDivision]);

  // 삭제 포함 (기준일 시점 모집단 복원용) - 취소는 여전히 제외
  const executiveProjectsAllStates = useMemo(() => {
    return projects.filter(p =>
      p.과제년도 === currentYear &&
      p.진행상태 !== '취소' &&
      (executiveSelectedDivision === 'all' || p.사업부 === executiveSelectedDivision)
    );
  }, [projects, currentYear, executiveSelectedDivision]);

  // 사업부 목록 (취소 제외 기준) — EXEC_DIV_ORDER 와 순서 통일
  const executiveDivisions = useMemo(() => {
    const set = new Set(executiveBaseProjects.map(p => p.사업부).filter(Boolean));
    // EXEC_DIV_ORDER에 있는 것 우선, 그 외는 뒤에 알파벳순
    const ordered = EXEC_DIV_ORDER.filter(d => set.has(d));
    const unknowns = [...set].filter(d => !EXEC_DIV_ORDER.includes(d)).sort((a, b) => a.localeCompare(b));
    return [...ordered, ...unknowns];
  }, [executiveBaseProjects]);

  // 취소 과제 (현재 사업부 필터 범위) — '총 과제' 카운트에서 삭제처럼 반영하기 위한 보조 모집단
  const executiveCanceledProjects = useMemo(() => {
    return projects.filter(p =>
      p.과제년도 === currentYear &&
      p.진행상태 === '취소' &&
      (executiveSelectedDivision === 'all' || p.사업부 === executiveSelectedDivision)
    );
  }, [projects, currentYear, executiveSelectedDivision]);

  // 기준 날짜 프리셋 적용
  const applyExecutiveRefPreset = (preset) => {
    const now = new Date();
    let d;
    if (preset === '1week') {
      d = new Date(now);
      d.setDate(d.getDate() - 7);
    } else if (preset === '2week') {
      d = new Date(now);
      d.setDate(d.getDate() - 14);
    } else if (preset === '1month') {
      d = new Date(now);
      d.setMonth(d.getMonth() - 1);
    } else if (preset === 'lastQuarter') {
      // 지난 분기 마감일 (1Q: 3/31, 2Q: 6/30, 3Q: 9/30, 4Q: 12/31)
      const currentQuarterIdx = Math.floor(now.getMonth() / 3);
      if (currentQuarterIdx === 0) {
        d = new Date(now.getFullYear() - 1, 11, 31); // 작년 12/31 (4Q 마감)
      } else {
        // day=0 → 전월의 마지막 날 = 지난 분기 마지막 달의 말일
        d = new Date(now.getFullYear(), currentQuarterIdx * 3, 0);
      }
    } else {
      return;
    }
    setExecutiveRefDate(toLocalYmd(d));
    setExecutiveRefPreset(preset);
  };

  // 사용자가 달력으로 직접 날짜 변경
  const handleExecutiveRefDateChange = (e) => {
    setExecutiveRefDate(e.target.value);
    setExecutiveRefPreset('custom');
  };

  // 기준일 라벨 (프리셋이면 짧은 이름, 커스텀이면 날짜)
  const executiveRefLabel = executiveRefPreset === '1week' ? '1주 전'
    : executiveRefPreset === '2week' ? '2주 전'
    : executiveRefPreset === '1month' ? '1개월 전'
    : executiveRefPreset === 'lastQuarter' ? '전 분기'
    : executiveRefDate;

  // 기준일 시점 진행률 계산 (해당 시점 이전에 완료된 액션아이템만 카운트)
  const calculateProgressAsOf = (project, asOfDate) => {
    if (!project.액션아이템목록 || project.액션아이템목록.length === 0) return 0;
    const actionItemCount = project.액션아이템목록.length;
    const contributionPerActionItem = 100 / actionItemCount;
    const wasCompletedByDate = (it) =>
      it.완료여부 && it.완료일 && new Date(it.완료일) <= asOfDate;

    let totalProgress = 0;
    project.액션아이템목록.forEach(item => {
      const details = item.세부항목목록 || [];
      if (details.length > 0) {
        const completed = details.filter(wasCompletedByDate).length;
        totalProgress += (completed / details.length) * contributionPerActionItem;
      } else if (wasCompletedByDate(item)) {
        totalProgress += contributionPerActionItem;
      }
    });
    return Math.round(totalProgress);
  };

  // 재사용 가능한 메트릭 계산 (executiveMetrics + 사업부별 카드 공통)
  // allStateProjects: 취소 제외 모집단(삭제 포함) — 진척률/완료/AI 등 모든 집계는 이 기준
  // canceledProjects: 같은 범위(연도·사업부)의 취소 과제 — '총 과제' 카운트에서만 삭제와 동일하게 취급
  const computeExecMetrics = (allStateProjects, refDateStr, canceledProjects = []) => {
    const refDate = new Date(refDateStr);
    refDate.setHours(23, 59, 59, 999);

    const existedAtRef = (p) => {
      if (p.createdAt && new Date(p.createdAt) > refDate) return false;
      if (p._deleted && p._deletedAt && new Date(p._deletedAt) <= refDate) return false;
      return true;
    };

    const currentProjects = allStateProjects.filter(p => !p._deleted);
    const refProjects = allStateProjects.filter(existedAtRef);

    // 액션아이템 생성 시점 기준 "기준일에 존재했던 AI"인지 (생성일 미상이면 존재로 간주)
    const aiExistedAtRef = (item) => {
      const c = getActionItemCreatedAt(item);
      return !c || new Date(c) <= refDate;
    };

    // 취소 과제 중 "기준일엔 존재(활성)했고 그 이후 취소된" 건 — 총 과제/총 AI 카운트에서 삭제처럼 반영
    // 빠진 시점은 `projectRemoval` 이 정한다 (취소·삭제 중 **먼저 일어난 것**)
    const canceledExistedAtRefProjects = canceledProjects.filter(p => {
      if (p.createdAt && new Date(p.createdAt) > refDate) return false;   // 기준일 이후 생성 → 당시 미존재
      const { at } = projectRemoval(p);
      if (at && new Date(at) <= refDate) return false;                    // 기준일 이전에 빠짐 → 당시 미존재
      return true;
    });
    const canceledExistedAtRef = canceledExistedAtRefProjects.length;

    // ── 전체 과제 ── (취소를 삭제처럼: 기준일엔 있었으나 이후 취소된 건도 기준일 카운트에 포함)
    const totalProjects = currentProjects.length;
    const refTotalProjects = refProjects.length + canceledExistedAtRef;

    // ── 완료 과제 ──
    const currentCompletedProjects = currentProjects.filter(p => p.진행상태 === '완료').length;
    const refCompletedProjects = refProjects.filter(p => {
      if (p.진행상태 !== '완료') return false;
      const items = p.액션아이템목록 || [];
      if (items.length === 0) {
        return p.종료 ? new Date(p.종료) <= refDate : false;
      }
      return items.every(
        item => item.완료여부 && item.완료일 && new Date(item.완료일) <= refDate
      );
    }).length;

    // ── 액션아이템 ──
    let totalAI = 0;
    let currentCompletedAI = 0;
    currentProjects.forEach(p => {
      (p.액션아이템목록 || []).forEach(item => {
        totalAI++;
        if (item.완료여부) currentCompletedAI++;
      });
    });
    let refTotalAI = 0;
    let refCompletedAI = 0;
    refProjects.forEach(p => {
      (p.액션아이템목록 || []).forEach(item => {
        // 기준일 시점에 존재했던 AI만 카운트 (생성일 기준) → 기존 과제에 이후 추가된 AI는 제외
        if (aiExistedAtRef(item)) refTotalAI++;
        if (item.완료여부 && item.완료일 && new Date(item.완료일) <= refDate) {
          refCompletedAI++;
        }
      });
    });
    // 기준일 이후 취소된 과제가 기준일에 갖고 있던 AI도 "당시 존재" 카운트에 포함 (삭제와 동일 취급)
    canceledExistedAtRefProjects.forEach(p => {
      (p.액션아이템목록 || []).forEach(item => {
        if (aiExistedAtRef(item)) refTotalAI++;
      });
    });

    // ── 액션아이템 달성률 (현시점: 진행률 현황의 actionItemAchievementRate와 동일 로직) ──
    // 분자: 완료된 액션아이템 / 분모: 시점까지 목표일이 도래한 액션아이템
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    let currentPlannedByToday = 0;
    let currentAchieved = 0;
    currentProjects.forEach(p => {
      (p.액션아이템목록 || []).forEach(item => {
        if (item.목표일 && new Date(item.목표일) <= today) currentPlannedByToday++;
        if (item.완료여부) currentAchieved++;
      });
    });
    const currentAchievementRate = currentPlannedByToday === 0
      ? 0
      : Math.min((currentAchieved / currentPlannedByToday) * 100, 999);

    let refPlannedByRef = 0;
    let refAchieved = 0;
    refProjects.forEach(p => {
      (p.액션아이템목록 || []).forEach(item => {
        if (item.목표일 && new Date(item.목표일) <= refDate) refPlannedByRef++;
        if (item.완료여부 && item.완료일 && new Date(item.완료일) <= refDate) refAchieved++;
      });
    });
    const refAchievementRate = refPlannedByRef === 0
      ? 0
      : Math.min((refAchieved / refPlannedByRef) * 100, 999);

    // 공통셋 (양 시점 모두 존재한 과제) - uuid 우선, 없으면 id
    const keyOf = (p) => p.uuid || p.id;
    const refKeySet = new Set(refProjects.map(keyOf));
    const intersection = currentProjects.filter(p => refKeySet.has(keyOf(p)));
    const interKeySet = new Set(intersection.map(keyOf));

    const newProjects = currentProjects.filter(p => !refKeySet.has(keyOf(p)));
    const removedProjects = refProjects.filter(p => !interKeySet.has(keyOf(p)));

    // ── 액션아이템 진척률 (완료 AI / 총 AI, 비율 기반) ──
    // 진행률 현황의 actionItemBasedProgress와 동일 정의: 상위 액션아이템 완료여부 기준
    //   현재: 완료여부 / 전체 AI · 기준일: (완료일<=refDate) / 기준일에 존재했던 AI
    const aiRatioProgress = (projs, isTotal, isCompleted) => {
      let total = 0, completed = 0;
      projs.forEach(p => (p.액션아이템목록 || []).forEach(item => {
        if (isTotal(item)) total++;
        if (isCompleted(item)) completed++;
      }));
      return total === 0 ? 0 : (completed / total) * 100;
    };
    const curTotalFn = () => true;
    const curDoneFn = (it) => !!it.완료여부;
    const refTotalFn = (it) => aiExistedAtRef(it);
    const refDoneFn = (it) => it.완료여부 && it.완료일 && new Date(it.완료일) <= refDate;

    const currentAvgProgress = aiRatioProgress(currentProjects, curTotalFn, curDoneFn);
    const refAvgProgress = aiRatioProgress(refProjects, refTotalFn, refDoneFn);

    // 공통셋(동일 과제)의 현재/기준일 진척률 — 델타 분해용
    const interCurProgress = aiRatioProgress(intersection, curTotalFn, curDoneFn);
    const interRefProgress = aiRatioProgress(intersection, refTotalFn, refDoneFn);

    // 분해: 전체Δ = 신규영향 + 동일과제진척 + 삭제영향 (텔레스코핑으로 합이 델타와 일치)
    const newEffect = currentAvgProgress - interCurProgress;    // 신규 과제가 전체 비율에 준 영향
    const sameCohortDelta = interCurProgress - interRefProgress; // 동일 과제의 진척
    const removedEffect = interRefProgress - refAvgProgress;    // 기준일에만 있던(삭제) 과제의 영향

    return {
      totalProjects,
      refTotalProjects,
      deltaTotalProjects: totalProjects - refTotalProjects,
      currentCompletedProjects,
      refCompletedProjects,
      deltaCompletedProjects: currentCompletedProjects - refCompletedProjects,
      totalAI,
      refTotalAI,
      currentCompletedAI,
      refCompletedAI,
      deltaCompletedAI: currentCompletedAI - refCompletedAI,
      currentAvgProgress,
      refAvgProgress,
      deltaAvgProgress: currentAvgProgress - refAvgProgress,
      // 평균 진행률 분해
      newEffect,
      sameCohortDelta,
      removedEffect,
      newProjectsCount: newProjects.length,
      removedProjectsCount: removedProjects.length,
      sameCohortCount: intersection.length,
      // 액션아이템 달성률
      currentAchievementRate,
      currentAchieved,
      currentPlannedByToday,
      refAchievementRate,
      refAchieved,
      refPlannedByRef,
      deltaAchievementRate: currentAchievementRate - refAchievementRate
    };
  };

  // 현재 필터 적용된 KPI 지표 (단일 사업부 모드의 6 카드용)
  const executiveMetrics = useMemo(
    () => computeExecMetrics(executiveProjectsAllStates, executiveRefDate, executiveCanceledProjects),
    [executiveProjectsAllStates, executiveRefDate, executiveCanceledProjects]
  );

  // 델타 표기 포맷 (전체 요약 줄 + 카드 공통 패턴)
  const execFmtCntDelta = (d) => d === 0 ? '–' : `${d > 0 ? '↑' : '↓'}${Math.abs(d)}`;
  const execFmtPctDelta = (d) => d === 0 ? '–' : `${d > 0 ? '↑' : '↓'}${Math.abs(d).toFixed(1)}%p`;

  // 사업부별 KPI 요약 카드 (전체 탭 모드에서 표시)
  const executiveDivisionCards = useMemo(() => {
    if (executiveSelectedDivision !== 'all') return [];
    const allYearProjects = projects.filter(p =>
      p.과제년도 === currentYear && p.진행상태 !== '취소'
    );
    const canceledYearProjects = projects.filter(p =>
      p.과제년도 === currentYear && p.진행상태 === '취소'
    );
    return EXEC_DIV_ORDER.map(div => {
      const divProjects = allYearProjects.filter(p => p.사업부 === div);
      const divCanceled = canceledYearProjects.filter(p => p.사업부 === div);
      const m = computeExecMetrics(divProjects, executiveRefDate, divCanceled);
      return { division: div, ...m };
    }).filter(d => d.totalProjects > 0 || d.refTotalProjects > 0);
  }, [projects, currentYear, executiveRefDate, executiveSelectedDivision]);

  // 사업부 카드 클릭 시 상세: 과제 변경 현황 + 액션아이템 변경 현황 + 전체현황
  const divisionDetailData = useMemo(() => {
    if (!divisionDetailModal) return null;
    const div = divisionDetailModal;

    const refDate = new Date(executiveRefDate);
    refDate.setHours(23, 59, 59, 999);
    const now = new Date();
    now.setHours(23, 59, 59, 999);

    // 전체현황 메트릭: 진척률/완료/AI 등은 취소 제외 (computeExecMetrics 규칙 유지)
    // 단, 총 과제 카운트는 취소를 삭제처럼 반영 — 취소 과제를 별도 인자로 전달
    const metricsProjects = projects.filter(p =>
      p.과제년도 === currentYear && p.사업부 === div && p.진행상태 !== '취소'
    );
    const canceledProjects = projects.filter(p =>
      p.과제년도 === currentYear && p.사업부 === div && p.진행상태 === '취소'
    );
    const metrics = computeExecMetrics(metricsProjects, executiveRefDate, canceledProjects);

    // ── 과제 변경 현황 (취소도 삭제와 동일하게 "제외됨"으로 추적) ──
    // 변경 추적 모집단: 취소·삭제 과제 모두 포함
    const trackProjects = projects.filter(p =>
      p.과제년도 === currentYear && p.사업부 === div
    );

    const keyOf = (p) => p.uuid || p.id;
    // 빠진 시점·이유는 `projectRemoval` 한 곳에서 정한다 (취소 뒤 삭제 = 취소한 날)
    const removedAtOf = (p) => projectRemoval(p).at;
    const isActiveNow = (p) => !p._deleted && p.진행상태 !== '취소';
    const existedAtRef = (p) => {
      if (p.createdAt && new Date(p.createdAt) > refDate) return false; // 기준일 이후 생성 → 당시 미존재
      const rAt = removedAtOf(p);
      if (rAt && new Date(rAt) <= refDate) return false;                // 기준일 이전 제외(삭제/취소) → 당시 미존재
      return true;
    };

    const currentActive = trackProjects.filter(isActiveNow);  // 현재 유효 과제
    const refExisted = trackProjects.filter(existedAtRef);    // 기준일 시점 유효 과제
    const refKeySet = new Set(refExisted.map(keyOf));
    const curKeySet = new Set(currentActive.map(keyOf));

    // 과제 완료일: 액션아이템 최종 완료일(없으면 종료일)
    const projectCompletedDate = (p) => {
      const items = p.액션아이템목록 || [];
      if (items.length === 0) return p.종료 || '';
      const dates = items.filter(it => it.완료여부 && it.완료일).map(it => it.완료일).sort();
      return dates.length ? dates[dates.length - 1] : (p.종료 || '');
    };
    const mapProject = (p, reason) => ({
      id: p.id,
      과제명: p.과제명 || '(과제명 없음)',
      과제PL: p.과제PL || p.PL || '',
      진행상태: p.진행상태 || '',
      진행률: calculateProgress(p),
      완료일: p.진행상태 === '완료' ? projectCompletedDate(p) : '',
      reason // '삭제' | '취소' (removed 목록에서만 사용)
    });
    const addedProjects = currentActive.filter(p => !refKeySet.has(keyOf(p))).map(p => mapProject(p));   // 신규 추가
    const removedRaw = refExisted.filter(p => !curKeySet.has(keyOf(p)));                                  // 삭제·취소 (원본)
    const removedProjects = removedRaw.map(p => mapProject(p, projectRemoval(p).reason));

    // ── 완료 과제 (전체 완료 / 해당 기간 완료) ──
    // computeExecMetrics 의 완료 판정과 동일: 진행상태 '완료' 기준, 기준일 완료여부는 액션아이템 완료일로 판정
    const wasCompletedAsOfRef = (p) => {
      if (p.진행상태 !== '완료') return false;
      const items = p.액션아이템목록 || [];
      if (items.length === 0) return p.종료 ? new Date(p.종료) <= refDate : false;
      return items.every(it => it.완료여부 && it.완료일 && new Date(it.완료일) <= refDate);
    };
    const completedActiveRaw = currentActive.filter(p => p.진행상태 === '완료');
    const completedAll = completedActiveRaw.map(p => mapProject(p));                              // 전체 완료 과제
    const completedInPeriod = completedActiveRaw.filter(p => !wasCompletedAsOfRef(p)).map(p => mapProject(p)); // 기준일 이후 완료

    // 액션아이템 변경 현황은 현재 유효 과제 기준 (취소·삭제 과제 제외)
    const currentProjects = currentActive;

    // ── 액션아이템 변경 현황 (기준일 ~ 현재 기간) ──
    const inPeriod = (dateStr) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d > refDate && d <= now;
    };
    // 이 모달에서는 '신규 추가'와 '제외(삭제·취소)'만 집계·표시한다.
    // (완료/조기달성/지연은 바 플롯에서 확인 — 여기서는 다루지 않음)
    const aiChanges = [];
    currentProjects.forEach(project => {
      const actionItems = project.액션아이템목록 || [];
      const projectIsNew = !refKeySet.has(keyOf(project)); // 과제 자체가 기간 내 신규
      const items = [];
      actionItems.forEach(item => {
        const createdAt = getActionItemCreatedAt(item);
        // 신규 여부 (과제 자체가 신규면 그 안의 AI는 전부 신규로 간주)
        const isNew = projectIsNew || !!(createdAt && inPeriod(createdAt));
        if (isNew) {
          items.push({ title: item.제목 || '(제목 없음)', 목표일: item.목표일, 생성일: createdAt, isNew: true });
        }
      });
      if (items.length) {
        aiChanges.push({
          id: project.id,
          과제명: project.과제명 || '(과제명 없음)',
          과제PL: project.과제PL || project.PL || '',
          items
        });
      }
    });

    // 제외: 삭제·취소된 과제가 기준일에 갖고 있던 액션아이템 (카드 변화량의 (−) 요소)
    const aiExistedAtRefItem = (item) => {
      const c = getActionItemCreatedAt(item);
      return !c || new Date(c) <= refDate;
    };
    removedRaw.forEach(project => {
      const reason = projectRemoval(project).reason;
      const items = (project.액션아이템목록 || [])
        .filter(aiExistedAtRefItem)
        .map(item => ({ title: item.제목 || '(제목 없음)', 목표일: item.목표일, isExcluded: true }));
      if (items.length) {
        aiChanges.push({
          id: project.id,
          과제명: project.과제명 || '(과제명 없음)',
          과제PL: project.과제PL || project.PL || '',
          reason,                       // 과제가 제외된 사유 (헤더 배지용)
          items
        });
      }
    });

    const allItems = aiChanges.flatMap(p => p.items);
    const aiStats = {
      added: allItems.filter(it => it.isNew).length,
      excluded: allItems.filter(it => it.isExcluded).length
    };

    return { division: div, metrics, addedProjects, removedProjects, completedAll, completedInPeriod, aiChanges, aiStats };
  }, [divisionDetailModal, projects, currentYear, executiveRefDate]);

  // 상단 요약 카드 클릭 상세: 델타 목록(변동) + 전체 목록
  const metricDetailData = useMemo(() => {
    if (!metricDetailModal) return null;
    const { type } = metricDetailModal;

    const refDate = new Date(executiveRefDate);
    refDate.setHours(23, 59, 59, 999);
    const now = new Date();
    now.setHours(23, 59, 59, 999);

    const divFilter = (p) => executiveSelectedDivision === 'all' || p.사업부 === executiveSelectedDivision;
    const trackProjects = projects.filter(p => p.과제년도 === currentYear && divFilter(p));

    const keyOf = (p) => p.uuid || p.id;
    const removedAtOf = (p) => projectRemoval(p).at;
    const isActiveNow = (p) => !p._deleted && p.진행상태 !== '취소';
    const existedAtRef = (p) => {
      if (p.createdAt && new Date(p.createdAt) > refDate) return false;
      const rAt = removedAtOf(p);
      if (rAt && new Date(rAt) <= refDate) return false;
      return true;
    };
    const currentActive = trackProjects.filter(isActiveNow);
    const refExisted = trackProjects.filter(existedAtRef);
    const refKeySet = new Set(refExisted.map(keyOf));
    const curKeySet = new Set(currentActive.map(keyOf));

    const projectCompletedDate = (p) => {
      const items = p.액션아이템목록 || [];
      if (items.length === 0) return p.종료 || '';
      const dates = items.filter(it => it.완료여부 && it.완료일).map(it => it.완료일).sort();
      return dates.length ? dates[dates.length - 1] : (p.종료 || '');
    };
    const mapProject = (p, reason) => ({
      id: p.id,
      과제명: p.과제명 || '(과제명 없음)',
      사업부: p.사업부 || '',
      과제PL: p.과제PL || p.PL || '',
      진행상태: p.진행상태 || '',
      진행률: calculateProgress(p),
      완료일: p.진행상태 === '완료' ? projectCompletedDate(p) : '',
      reason
    });

    if (type === 'projects') {
      const added = currentActive.filter(p => !refKeySet.has(keyOf(p))).map(p => mapProject(p));
      const removed = refExisted.filter(p => !curKeySet.has(keyOf(p)))
        .map(p => mapProject(p, projectRemoval(p).reason));
      return {
        type, title: '전체 과제', unit: '개', total: currentActive.length,
        deltaGroups: [
          { label: '신규 추가', statusColor: '#10b981', items: added, empty: '신규 추가된 과제가 없습니다.' },
          { label: '삭제·취소', statusColor: '#ef4444', items: removed, empty: '삭제·취소된 과제가 없습니다.' },
        ],
        allProjects: currentActive.map(p => mapProject(p)),
      };
    }

    if (type === 'completed') {
      const wasCompletedAsOfRef = (p) => {
        if (p.진행상태 !== '완료') return false;
        const items = p.액션아이템목록 || [];
        if (items.length === 0) return p.종료 ? new Date(p.종료) <= refDate : false;
        return items.every(it => it.완료여부 && it.완료일 && new Date(it.완료일) <= refDate);
      };
      const completedActive = currentActive.filter(p => p.진행상태 === '완료');
      const inPeriod = completedActive.filter(p => !wasCompletedAsOfRef(p)).map(p => mapProject(p));
      return {
        type, title: '전체 완료 과제', unit: '개', total: completedActive.length,
        deltaGroups: [
          { label: `${executiveRefLabel} 이후 완료`, statusColor: '#10b981', items: inPeriod, empty: '해당 기간에 완료된 과제가 없습니다.' },
        ],
        allProjects: completedActive.map(p => mapProject(p)),
      };
    }

    // type === 'ai'
    const inPeriod = (dateStr) => { if (!dateStr) return false; const dd = new Date(dateStr); return dd > refDate && dd <= now; };
    const aiExistedAtRefItem = (item) => { const c = getActionItemCreatedAt(item); return !c || new Date(c) <= refDate; };
    const addedAI = [], excludedAI = [], allAI = [];
    currentActive.forEach(project => {
      const projectIsNew = !refKeySet.has(keyOf(project));
      (project.액션아이템목록 || []).forEach((item, ix) => {
        const createdAt = getActionItemCreatedAt(item);
        const row = {
          id: `${project.id}-${ix}`,
          과제명: project.과제명 || '(과제명 없음)', 사업부: project.사업부 || '',
          title: item.제목 || '(제목 없음)', 목표일: item.목표일 || '',
          완료여부: !!item.완료여부, 완료일: item.완료일 || ''
        };
        allAI.push(row);
        if (projectIsNew || (createdAt && inPeriod(createdAt))) addedAI.push({ ...row, isNew: true });
      });
    });
    refExisted.filter(p => !curKeySet.has(keyOf(p))).forEach(project => {
      (project.액션아이템목록 || []).filter(aiExistedAtRefItem).forEach((item, ix) => {
        excludedAI.push({
          id: `${project.id}-x-${ix}`,
          과제명: project.과제명 || '(과제명 없음)', 사업부: project.사업부 || '',
          title: item.제목 || '(제목 없음)', 목표일: item.목표일 || '',
          reason: projectRemoval(project).reason
        });
      });
    });
    return {
      type, title: '전체 액션아이템', unit: '개', total: allAI.length,
      aiDeltaGroups: [
        { label: '신규 추가', statusColor: '#7c3aed', items: addedAI, empty: '신규 추가된 액션아이템이 없습니다.' },
        { label: '제외(삭제·취소)', statusColor: '#94a3b8', items: excludedAI, empty: '제외된 액션아이템이 없습니다.' },
      ],
      allAI,
    };
  }, [metricDetailModal, projects, currentYear, executiveRefDate, executiveSelectedDivision, executiveRefLabel]);

  // 기간 내 과제 진행 현황: 완료/지연/조기 달성된 액션아이템을 과제 단위로 묶음
  const executiveProjectStatus = useMemo(() => {
    const refDate = new Date(executiveRefDate);
    refDate.setHours(23, 59, 59, 999);
    const now = new Date();
    now.setHours(23, 59, 59, 999);

    const inPeriod = (dateStr) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d > refDate && d <= now;
    };

    const currentProjects = executiveProjectsAllStates.filter(p => !p._deleted);

    const results = currentProjects.map(project => {
      const actionItems = project.액션아이템목록 || [];

      const completedInPeriod = []; // 기간 내 완료된 액션아이템
      const delayed = [];            // 지연: 목표일 도래했지만 미완료
      const early = [];              // 조기 달성: 기간 내 완료 & 완료일 < 목표일

      actionItems.forEach(item => {
        const title = item.제목 || '(제목 없음)';
        const targetDate = item.목표일 ? new Date(item.목표일) : null;
        const doneDate = item.완료일 ? new Date(item.완료일) : null;

        // 카테고리 배타 분류
        if (item.완료여부 && doneDate && inPeriod(item.완료일)) {
          // 기간 내 완료 → 조기 vs 일반 완료로 분기
          if (targetDate && targetDate > now) {
            early.push({ title, 목표일: item.목표일, 완료일: item.완료일 });
          } else {
            completedInPeriod.push({ title, 목표일: item.목표일, 완료일: item.완료일 });
          }
        } else if (targetDate && targetDate <= now && !item.완료여부) {
          // 지연: 목표일 도래, 미완료
          delayed.push({ title, 목표일: item.목표일 });
        }
      });

      const totalActionItems = actionItems.length;
      const completedActionItems = actionItems.filter(i => i.완료여부).length;

      return {
        id: project.id,
        사업부: project.사업부,
        과제명: project.과제명,
        과제PL: project.과제PL || project.PL || '',
        진행상태: project.진행상태,
        진행률: calculateProgress(project),
        totalActionItems,
        completedActionItems,
        completedInPeriod,
        delayed,
        early,
        hasAny: completedInPeriod.length > 0 || delayed.length > 0 || early.length > 0
      };
    }).filter(p => p.hasAny);

    // 카운트 (액션아이템 단위 - 칩 필터가 행 단위로 동작)
    const stats = {
      completed: results.reduce((s, p) => s + p.completedInPeriod.length, 0),
      delayed: results.reduce((s, p) => s + p.delayed.length, 0),
      early: results.reduce((s, p) => s + p.early.length, 0)
    };
    stats.total = stats.completed + stats.delayed + stats.early;

    return { results, stats };
  }, [executiveProjectsAllStates, executiveRefDate]);

  // 사업부별 주차별 평균 진척률 — 사업부 칸막이는 따로 그리되 데이터는 통합 array
  const executiveDivisionTrend = useMemo(() => {
    const now = new Date();
    const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000) + (now.getTimezoneOffset() * 60 * 1000));

    // 표시 후보 사업부: 고정 순서 × 필터 적용 × 과제가 있는 사업부만
    const candidates = executiveSelectedDivision === 'all'
      ? EXEC_DIV_ORDER
      : EXEC_DIV_ORDER.filter(d => d === executiveSelectedDivision);

    const byDivision = new Map();
    candidates.forEach(div => {
      byDivision.set(div, executiveBaseProjects.filter(p => p.사업부 === div));
    });
    const divisions = candidates.filter(div => (byDivision.get(div) || []).length > 0);

    // 주차 끝 날짜 헬퍼 (해당 주 토요일 23:59:59)
    const weekEndDate = (weekNum) => {
      const startOfYear = new Date(currentYear, 0, 1);
      const startDay = startOfYear.getDay();
      const firstWeekStart = new Date(currentYear, 0, 1 - startDay);
      const weekEnd = new Date(firstWeekStart);
      weekEnd.setDate(firstWeekStart.getDate() + (weekNum - 1) * 7 + 6);
      weekEnd.setHours(23, 59, 59, 999);
      return weekEnd;
    };

    // X축 범위: 올해는 오늘까지, 그 외(과거/미래)는 12/31까지
    const yearStart = new Date(currentYear, 0, 1).getTime();
    const isCurrentYear = koreaTime.getFullYear() === currentYear;
    const yearEnd = isCurrentYear
      ? koreaTime.getTime()
      : new Date(currentYear, 11, 31, 23, 59, 59).getTime();

    // 데이터: yearEnd 이내 주차만 포함 → X축이 미래 영역으로 늘어나지 않음
    const data = [];
    for (let w = 1; w <= 52; w++) {
      const endDate = weekEndDate(w);
      if (endDate.getTime() > yearEnd) break;
      const row = { week: w, dateMs: endDate.getTime() };
      divisions.forEach(div => {
        const projects = byDivision.get(div) || [];
        const sum = projects.reduce((s, p) => s + calculateProgressAsOf(p, endDate), 0);
        row[div] = Math.round((sum / projects.length) * 10) / 10;
      });
      data.push(row);
    }

    // 월별 눈금은 도메인 안에 있는 월만 표시
    const monthTicks = Array.from({ length: 12 }, (_, i) => new Date(currentYear, i, 1).getTime())
      .filter(ts => ts >= yearStart && ts <= yearEnd);

    return { data, divisions, yearStart, yearEnd, monthTicks };
  }, [executiveBaseProjects, executiveSelectedDivision, currentYear]);

  // 조직별 액션아이템 상태 (조기달성/완료/계획/지연 — 상호 배타)
  const executiveDivisionAIStatus = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const targetDivisions = executiveSelectedDivision === 'all'
      ? EXEC_DIV_ORDER
      : EXEC_DIV_ORDER.filter(d => d === executiveSelectedDivision);

    const counts = new Map();
    targetDivisions.forEach(div => {
      counts.set(div, { 조기달성: 0, 완료: 0, 계획: 0, 지연: 0 });
    });

    executiveBaseProjects.forEach(p => {
      const c = counts.get(p.사업부);
      if (!c) return;
      (p.액션아이템목록 || []).forEach(item => {
        const target = item.목표일 ? new Date(item.목표일) : null;
        if (item.완료여부) {
          if (target && target > today) c.조기달성++;
          else c.완료++;
        } else {
          if (target && target <= today) c.지연++;
          else c.계획++;
        }
      });
    });

    return targetDivisions
      .map(div => ({
        division: execDivDisplayName(div),
        divKey: div,
        ...counts.get(div)
      }))
      .filter(d => d.조기달성 + d.완료 + d.계획 + d.지연 > 0);
  }, [executiveBaseProjects, executiveSelectedDivision]);

  // ===== 사업부별 모드 (specific division) 전용 데이터 =====
  // 프로세스 순서 (settingsData에서, 없으면 데이터에서 추출 후 알파벳순)
  const sortProcessesByOrder = (processes, settingsProcs) => {
    const order = (settingsProcs || []).map(p => p.name);
    return [...processes].sort((a, b) => {
      const ia = order.indexOf(a), ib = order.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  };

  // 프로세스별 액션아이템 진척률 (선택된 사업부 안에서 프로세스별 시계열)
  const executiveProcessTrend = useMemo(() => {
    if (executiveSelectedDivision === 'all') return null;

    const now = new Date();
    const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000) + (now.getTimezoneOffset() * 60 * 1000));

    const divProjects = executiveBaseProjects.filter(p => p.사업부 === executiveSelectedDivision);

    // 프로세스 그룹
    const byProcess = new Map();
    divProjects.forEach(p => {
      const proc = p.프로세스 || '기타';
      if (!byProcess.has(proc)) byProcess.set(proc, []);
      byProcess.get(proc).push(p);
    });
    const processes = sortProcessesByOrder([...byProcess.keys()], settingsData?.processes)
      .filter(proc => (byProcess.get(proc) || []).length > 0);

    // 주차 끝 날짜 헬퍼
    const weekEndDate = (weekNum) => {
      const startOfYear = new Date(currentYear, 0, 1);
      const startDay = startOfYear.getDay();
      const firstWeekStart = new Date(currentYear, 0, 1 - startDay);
      const weekEnd = new Date(firstWeekStart);
      weekEnd.setDate(firstWeekStart.getDate() + (weekNum - 1) * 7 + 6);
      weekEnd.setHours(23, 59, 59, 999);
      return weekEnd;
    };

    const yearStart = new Date(currentYear, 0, 1).getTime();
    const isCurrentYear = koreaTime.getFullYear() === currentYear;
    const yearEnd = isCurrentYear
      ? koreaTime.getTime()
      : new Date(currentYear, 11, 31, 23, 59, 59).getTime();

    const data = [];
    for (let w = 1; w <= 52; w++) {
      const endDate = weekEndDate(w);
      if (endDate.getTime() > yearEnd) break;
      const row = { week: w, dateMs: endDate.getTime() };
      processes.forEach(proc => {
        const projects = byProcess.get(proc) || [];
        if (projects.length === 0) {
          row[proc] = null;
        } else {
          const sum = projects.reduce((s, p) => s + calculateProgressAsOf(p, endDate), 0);
          row[proc] = Math.round((sum / projects.length) * 10) / 10;
        }
      });
      data.push(row);
    }

    const monthTicks = Array.from({ length: 12 }, (_, i) => new Date(currentYear, i, 1).getTime())
      .filter(ts => ts >= yearStart && ts <= yearEnd);

    return { processes, data, yearStart, yearEnd, monthTicks };
  }, [executiveBaseProjects, executiveSelectedDivision, currentYear, settingsData]);

  // 프로세스별 액션아이템 상태 (선택된 사업부 안에서)
  const executiveProcessAIStatus = useMemo(() => {
    if (executiveSelectedDivision === 'all') return null;

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const divProjects = executiveBaseProjects.filter(p => p.사업부 === executiveSelectedDivision);

    const counts = new Map();
    divProjects.forEach(p => {
      const proc = p.프로세스 || '기타';
      if (!counts.has(proc)) counts.set(proc, { 조기달성: 0, 완료: 0, 계획: 0, 지연: 0 });
      const c = counts.get(proc);
      (p.액션아이템목록 || []).forEach(item => {
        const target = item.목표일 ? new Date(item.목표일) : null;
        if (item.완료여부) {
          if (target && target > today) c.조기달성++;
          else c.완료++;
        } else {
          if (target && target <= today) c.지연++;
          else c.계획++;
        }
      });
    });

    const processes = sortProcessesByOrder([...counts.keys()], settingsData?.processes);

    return processes
      .map(proc => ({
        process: proc,
        procKey: proc,
        ...counts.get(proc)
      }))
      .filter(d => d.조기달성 + d.완료 + d.계획 + d.지연 > 0);
  }, [executiveBaseProjects, executiveSelectedDivision, settingsData]);

  // 진척률 추이 점 클릭 → 해당 주차의 "전 사업부(또는 전 프로세스)" 진척률 상세
  const aiProgressDrillData = useMemo(() => {
    if (!aiProgressModal) return null;
    const { scope, dateMs } = aiProgressModal;
    const weekEnd = new Date(dateMs);

    // 해당 주차/직전 주차 데이터 행 (정확한 값·Δ 및 직전 주말 시각)
    const trend = scope === 'process' ? executiveProcessTrend : executiveDivisionTrend;
    const arr = trend?.data || [];
    const idx = arr.findIndex(r => r.dateMs === dateMs);
    const curRow = idx >= 0 ? arr[idx] : null;
    const prevRow = idx > 0 ? arr[idx - 1] : null;
    const prevWeekEnd = new Date(prevRow ? prevRow.dateMs : (dateMs - 7 * 24 * 60 * 60 * 1000));

    const inThisWeek = (dateStr) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d > prevWeekEnd && d <= weekEnd;
    };
    const doneByWeekEnd = (item) => item.완료여부 && item.완료일 && new Date(item.완료일) <= weekEnd;

    const PROCESS_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9', '#ec4899', '#14b8a6'];
    const seriesKeys = scope === 'process'
      ? (executiveProcessTrend?.processes || [])
      : (executiveDivisionTrend?.divisions || []);

    // 시리즈(사업부 또는 프로세스)별 집계
    const entries = seriesKeys.map((sk, i) => {
      const baseProjects = executiveBaseProjects.filter(p =>
        scope === 'process'
          ? (p.사업부 === executiveSelectedDivision && (p.프로세스 || '기타') === sk)
          : (p.사업부 === sk)
      );
      const completedThisWeek = [];
      const newlyDueThisWeek = [];
      let cumCompleted = 0;
      let cumTotal = 0;
      baseProjects.forEach(p => {
        (p.액션아이템목록 || []).forEach(item => {
          cumTotal++;
          if (doneByWeekEnd(item)) cumCompleted++;
          if (item.완료여부 && item.완료일 && inThisWeek(item.완료일)) {
            completedThisWeek.push({ 과제명: p.과제명 || '(과제명 없음)', title: item.제목 || '(제목 없음)', 완료일: item.완료일 });
          }
          if (item.목표일 && inThisWeek(item.목표일) && !doneByWeekEnd(item)) {
            newlyDueThisWeek.push({ 과제명: p.과제명 || '(과제명 없음)', title: item.제목 || '(제목 없음)', 목표일: item.목표일 });
          }
        });
      });
      const curVal = curRow ? curRow[sk] : null;
      const prevVal = prevRow ? prevRow[sk] : null;
      const delta = (curVal != null && prevVal != null) ? Math.round((curVal - prevVal) * 10) / 10 : null;
      return {
        key: sk,
        name: scope === 'process' ? sk : execDivDisplayName(sk),
        color: scope === 'process' ? PROCESS_COLORS[i % PROCESS_COLORS.length] : (EXEC_DIV_COLORS[sk] || '#64748b'),
        curVal, prevVal, delta,
        projectCount: baseProjects.length,
        cumCompleted, cumTotal,
        completedThisWeek, newlyDueThisWeek
      };
    }).filter(e => e.projectCount > 0);

    // 전 시리즈 합산 목록 (시리즈 라벨 부착)
    const allCompleted = entries.flatMap(e => e.completedThisWeek.map(it => ({ ...it, series: e.name, color: e.color })));
    const allNewlyDue = entries.flatMap(e => e.newlyDueThisWeek.map(it => ({ ...it, series: e.name, color: e.color })));

    return {
      scope,
      week: aiProgressModal.week,
      weekEnd, prevWeekEnd,
      clickedKey: aiProgressModal.key,
      entries,
      allCompleted,
      allNewlyDue
    };
  }, [aiProgressModal, executiveBaseProjects, executiveSelectedDivision, executiveDivisionTrend, executiveProcessTrend]);

  // 진척률 라인차트의 클릭 가능한 활성 점 (호버 시 커진 점 → 클릭하면 해당 주차 상세 모달)
  const renderClickableActiveDot = (scope, seriesKey, color) => (dotProps) => {
    const { cx, cy, payload } = dotProps;
    if (cx == null || cy == null) return null;
    return (
      <circle
        cx={cx} cy={cy} r={6}
        fill={color} stroke="#fff" strokeWidth={2}
        style={{ cursor: 'pointer' }}
        onClick={() => setAiProgressModal({ scope, key: seriesKey, week: payload?.week, dateMs: payload?.dateMs })}
      />
    );
  };

  // 사업부 액션아이템 상태 모달 데이터 (사업부 단위 + 카테고리별 + (옵션) 프로세스 필터)
  const aiStatusModalData = useMemo(() => {
    if (!aiStatusModal) return null;
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const divProjects = executiveBaseProjects.filter(p =>
      p.사업부 === aiStatusModal.division &&
      (!aiStatusModal.process || p.프로세스 === aiStatusModal.process)
    );

    const projects = divProjects.map(p => {
      const items = (p.액션아이템목록 || []).map(item => {
        const target = item.목표일 ? new Date(item.목표일) : null;
        let category;
        if (item.완료여부) {
          if (target && target > today) category = '조기달성';
          else category = '완료';
        } else {
          if (target && target <= today) category = '지연';
          else category = '계획';
        }
        return {
          id: item.id,
          title: item.제목 || '(제목 없음)',
          category,
          목표일: item.목표일 || null,
          완료일: item.완료일 || null
        };
      });
      return {
        id: p.id,
        과제명: p.과제명,
        과제PL: p.과제PL || p.PL || '',
        진행상태: p.진행상태,
        items
      };
    });

    // 카테고리별 카운트
    const counts = { 조기달성: 0, 완료: 0, 계획: 0, 지연: 0 };
    projects.forEach(p => p.items.forEach(i => { counts[i.category]++; }));

    return { projects, counts };
  }, [aiStatusModal, executiveBaseProjects]);

  // 조직별 경영성과: 5개 사업부에 한정 (KPI 대시보드 카드 기반)
  const PERF_TARGET_DIVS = ['MX', 'VD', 'DA', 'NW', '의료기기'];

  const toNum = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  };

  const getPerfKey = (p) => p.uuid || p.id || p.성과항목;

  // 사용 가능한 단위 환산 정의
  const execUnitConversions = useMemo(
    () => (settingsData?.unitConversions) || [],
    [settingsData]
  );

  // 단위 환산 적용
  const applyExecConversion = useCallback((value, unit, division) => {
    if (Object.keys(execActiveConversions).length === 0) return { value, unit };
    const srcKey = (unit || '').toLowerCase();
    const convId = execActiveConversions[srcKey];
    if (!convId) return { value, unit };
    const conv = execUnitConversions.find(c => c.id === convId);
    if (!conv) return { value, unit };
    if (value === undefined || value === null || value === '') return { value, unit: conv.targetUnit };
    const numVal = parseFloat(value);
    if (isNaN(numVal)) return { value, unit: conv.targetUnit };
    let rawFactor = conv.defaultFactor;
    const yearData = conv.yearOverrides?.[String(currentYear)];
    if (yearData) {
      rawFactor = yearData.divisionOverrides?.[division]?.factor ?? yearData.defaultFactor;
    } else {
      rawFactor = conv.divisionOverrides?.[division]?.factor ?? conv.defaultFactor;
    }
    const factor = evalFactor(rawFactor);
    if (isNaN(factor)) return { value, unit: conv.targetUnit };
    return { value: parseFloat((numVal * factor).toFixed(4)), unit: conv.targetUnit };
  }, [execActiveConversions, execUnitConversions, currentYear]);

  // 성과 → 그 성과에 연결된 과제 목록.
  // 「모든 성과 항목」 카드 모달(KPIDashboard)과 **같은 규칙**으로 찾는다 —
  // 과제의 성과목록에 담긴 참조가 문자열일 때도, 객체일 때도 있어서 키를 여러 개 본다.
  const perfProjectMap = useMemo(() => {
    const map = new Map();
    (projects || []).forEach(proj => {
      if (proj._deleted) return;
      const perfList = proj.성과목록;
      if (!perfList || perfList.length === 0) return;
      const projectId = proj.id || proj.uuid;
      perfList.forEach(perfRef => {
        const perfKey = typeof perfRef === 'string'
          ? perfRef
          : (perfRef.성과항목UUID || perfRef.성과UUID || perfRef.성과항목ID || perfRef.성과항목 || perfRef.id);
        if (!perfKey) return;
        let arr = map.get(perfKey);
        if (!arr) { arr = []; map.set(perfKey, arr); }
        if (!arr.some(x => x.id === projectId)) {
          arr.push({ id: projectId, uuid: proj.uuid, 과제명: proj.과제명 || '(이름 없음)' });
        }
      });
    });
    return map;
  }, [projects]);

  const getLinkedProjects = useCallback((perf) => {
    const keys = [perf.uuid, perf.id, perf.성과항목UUID, perf.성과UUID, perf.성과항목ID, perf.성과항목];
    for (const key of keys) {
      if (key && perfProjectMap.has(key)) return perfProjectMap.get(key);
    }
    return [];
  }, [perfProjectMap]);

  // ── 성과 묶음 하나를 집계한다 (목표/실적 절감액 + 달성률 모수) ──────────
  //
  // 여기 오는 perfs 는 **환산 후 단위가 같은 것들끼리**여야 한다.
  // 단위가 다른 값을 더하거나 평균 내면 나오는 수가 아무 뜻이 없다.
  const summarizePerfs = (perfs, logic, division) => {
    const toNumZero = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
    const hasVal = (v) => v !== undefined && v !== null && v !== '' && !isNaN(parseFloat(v));
    const aggregate = (vals, total) => {
      if (total === 0) return null;
      const sum = vals.reduce((a, b) => a + b, 0);
      return logic === '합계' ? sum : sum / total;
    };
    const convertedNum = (raw, p) => toNumZero(applyExecConversion(raw, p.단위 || '', division).value);

    // 유효성 판정: 값이 명시되어 있으면 인정 (0 포함). null/''/undefined 만 제외.
    const isValidVal = (raw) => hasVal(raw);

    // 실적값 추출 (월별실적 우선)
    const getActual = (p) => {
      if (p.월별실적여부 && Array.isArray(p.월별실적) && p.월별실적.length > 0) {
        const nums = p.월별실적
          .map(v => applyExecConversion(v, p.단위 || '', division).value)
          .map(v => parseFloat(v))
          .filter(v => !isNaN(v));
        if (nums.length === 0) return null; // 월별 다 비어있음 → 미기록
        return nums.reduce((a, b) => a + b, 0); // 합이 0이어도 명시적 0으로 인정
      }
      if (hasVal(p.실적수준)) {
        return convertedNum(p.실적수준, p); // 명시적 0 포함
      }
      return null;
    };

    // 한 묶음의 (기준값 − 현재) 절감액. rows 가 비면 null.
    const savingOf = (rows, valueOf) => {
      if (rows.length === 0) return null;
      const vAgg = aggregate(rows.map(valueOf), rows.length);
      const cAgg = aggregate(rows.map(p => convertedNum(p.현재수준, p)), rows.length);
      return vAgg - cAgg;
    };

    // ── 목표 절감액: 목표·현재 둘 다 유효한 짝 (목표 − 현재) ──
    const tcPairs = perfs.filter(p => isValidVal(p.목표수준) && isValidVal(p.현재수준));
    const targetSaving = savingOf(tcPairs, p => convertedNum(p.목표수준, p));

    // ── 실적 절감액: 실적·현재 둘 다 유효한 짝 (실적 − 현재) ──
    const acPairs = perfs.filter(p => getActual(p) !== null && isValidVal(p.현재수준));
    const actualSaving = savingOf(acPairs, p => getActual(p));

    // 달성률은 이 두 값(목표·실적 절감액)을 그대로 나눈다 — execAchievementRate 참고.
    // 분모가 **세운 목표 전부**여야 해서 따로 모수를 잡지 않는다.

    // 검증 모달용 raw 데이터 (각 성과의 변환 후 값 + 포함 여부)
    const sourceRows = perfs.map(p => {
      const tConv = applyExecConversion(p.목표수준, p.단위 || '', division);
      const targetNum = isValidVal(p.목표수준) ? convertedNum(p.목표수준, p) : null;
      const currentNum = isValidVal(p.현재수준) ? convertedNum(p.현재수준, p) : null;
      const actualNum = getActual(p);
      return {
        key: getPerfKey(p),
        name: (p.성과항목 || '').replace(/^\[.+?\]\s*/, ''),
        rawUnit: p.단위 || '',
        convUnit: tConv.unit || p.단위 || '',
        rawTarget: p.목표수준,
        rawCurrent: p.현재수준,
        rawActual: p.실적수준,
        isMonthly: !!p.월별실적여부,
        monthly: Array.isArray(p.월별실적) ? p.월별실적 : null,
        target: targetNum,
        current: currentNum,
        actual: actualNum,
        usedInTarget: targetNum !== null && currentNum !== null,
        usedInActual: actualNum !== null && currentNum !== null,
        projects: getLinkedProjects(p)
      };
    });

    const round = (n) => n === null ? null : Math.round(n * 100) / 100;
    return {
      // 막대 표시값은 절대값(부호와 무관하게 높이로 표현)
      목표: targetSaving === null ? null : Math.round(Math.abs(targetSaving) * 100) / 100,
      실적: actualSaving === null ? null : Math.round(Math.abs(actualSaving) * 100) / 100,
      // 툴팁 부호 표시용 (signed 절감액)
      targetSaving: round(targetSaving),
      actualSaving: round(actualSaving),
      sourceRows,
      tcPairCount: tcPairs.length,
      acPairCount: acPairs.length,
      logic
    };
  };

  // 환산 후 단위. 환산을 켜면 hrs 와 억원이 똑같이 '억원' 이 되어 한 덩어리가 되고,
  // 끄면 서로 다른 단위라 따로 선다.
  const resolvedUnitOf = (p, division) =>
    applyExecConversion(null, p.단위 || '', division).unit || p.단위 || '';

  // 성과를 환산 후 단위별로 갈라 각각 집계한다. 단위가 하나뿐이면 묶음도 하나다.
  const summarizeByUnit = (perfs, logic, division) => {
    const byUnit = new Map();
    perfs.forEach(p => {
      const u = resolvedUnitOf(p, division);
      if (!byUnit.has(u)) byUnit.set(u, []);
      byUnit.get(u).push(p);
    });
    return [...byUnit.entries()]
      .sort((a, b) => b[1].length - a[1].length)   // 성과가 많은 단위부터
      .map(([unit, rows]) => ({ unit, ...summarizePerfs(rows, logic, division) }));
  };

  // 달성률 = |실적 절감액| / |목표 절감액|.
  //
  // 분모는 **세운 목표 전부**다 — 실적이 아직 안 들어온 성과의 목표도 분모에 든다.
  // 조직이 세운 목표 대비 지금까지 얼마나 왔는지를 보는 자리라, 실적이 있는 것만
  // 골라 견주면 아직 손도 못 댄 목표가 셈에서 빠져 실제보다 높게 나온다.
  // 그래서 화면의 두 막대(목표·실적)를 그대로 나눈다.
  //
  // 실적이 하나도 없으면 0% 다(미기록이 아니라 '아직 못 했다'로 읽는다).
  // 목표가 없거나 0 이면 나눌 것이 없어 '–' 다.
  const execAchievementRate = (g) => {
    if (!g) return null;
    const t = g.targetSaving;
    if (t == null || Math.abs(t) <= 0.001) return null;
    return (Math.abs(g.actualSaving ?? 0) / Math.abs(t)) * 100;
  };

  // KPI 카드 집계 — 환산 후 단위별 묶음 배열을 돌려준다.
  const aggregateCardValues = (card) => {
    const keys = card.selectedPerfKeys || [];
    if (keys.length === 0) return [];
    const filtered = globalPerformances.filter(
      p => Number(p.성과년도) === currentYear && keys.includes(getPerfKey(p))
    );
    if (filtered.length === 0) return [];
    return summarizeByUnit(filtered, card.logic || '평균', card.division);
  };


  // 5개 사업부 KPI 카드 (모달 선택용)
  const kpiCardsByDivision = useMemo(() => {
    const byDiv = new Map();
    PERF_TARGET_DIVS.forEach(d => byDiv.set(d, []));
    kpiDashboardCards.forEach(card => {
      if (!byDiv.has(card.division)) return;
      byDiv.get(card.division).push({
        id: card.id,
        name: card.name || '(이름 없음)',
        category: card.category || '',
        logic: card.logic || ''
      });
    });
    return PERF_TARGET_DIVS.map(div => ({
      division: div,
      items: byDiv.get(div) || []
    })).filter(d => d.items.length > 0);
  }, [kpiDashboardCards]);


  // 조직별 경영성과 데이터
  // - byDivision (items): 전체 모드용 카드 단위 집계 (X축=카드)
  // - detailedByDivision (cards): 사업부별 모드용 카드+소분류 (X축=소분류)
  const executiveBusinessPerf = useMemo(() => {
    const subOrder = (settingsData?.performanceSubcategories || []).map(s => s.name);
    const sortSubs = (subs) => subs.sort((a, b) => {
      const ia = subOrder.indexOf(a.fullName);
      const ib = subOrder.indexOf(b.fullName);
      if (ia === -1 && ib === -1) return a.fullName.localeCompare(b.fullName);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });

    // 한 차트 안의 막대 최댓값으로 Y축을 잡는다. 단위마다 차트가 따로이므로
    // Y축도 그 단위 것만 본다 — 억원 막대와 hrs 막대가 한 눈금을 쓰던 걸 끊는다.
    const axisOf = (rows) => {
      let max = 0;
      rows.forEach(r => {
        if (r.목표 != null && r.목표 > max) max = r.목표;
        if (r.실적 != null && r.실적 > max) max = r.실적;
      });
      return niceAxis(max);
    };

    const aggregated = []; // 전체 모드용
    const detailed = [];   // 사업부별 모드용

    PERF_TARGET_DIVS.forEach(divName => {
      const itemsByUnit = new Map();   // 단위 → 카드 항목들
      const divCards = [];

      kpiDashboardCards.forEach(card => {
        if (card.division !== divName) return;
        if (!selectedKpiCards.has(card.id)) return;

        const fullName = card.name || '(이름 없음)';

        // 1) 전체 모드용: 카드 단위 집계 — 환산 후 단위마다 항목 하나
        aggregateCardValues(card).forEach(group => {
          if (!itemsByUnit.has(group.unit)) itemsByUnit.set(group.unit, []);
          itemsByUnit.get(group.unit).push({
            // 같은 카드가 단위마다 하나씩 서므로 id 도 단위까지 묶어 만든다
            id: `${card.id}::${group.unit}`,
            cardId: card.id,
            name: fullName.length > 16 ? fullName.slice(0, 15) + '…' : fullName,
            fullName,
            ...group
          });
        });

        // 2) 사업부별 모드용: 소분류 분해 (여기서도 단위별로 나눈다)
        const keys = card.selectedPerfKeys || [];
        const cardPerfs = globalPerformances.filter(p =>
          Number(p.성과년도) === currentYear && keys.includes(getPerfKey(p))
        );
        const bySubcat = new Map();
        cardPerfs.forEach(p => {
          const sub = p.소분류 || '(기타)';
          if (!bySubcat.has(sub)) bySubcat.set(sub, []);
          bySubcat.get(sub).push(p);
        });

        const subsByUnit = new Map();  // 단위 → 소분류 항목들
        bySubcat.forEach((perfs, subName) => {
          summarizeByUnit(perfs, card.logic || '평균', card.division).forEach(group => {
            if (!subsByUnit.has(group.unit)) subsByUnit.set(group.unit, []);
            subsByUnit.get(group.unit).push({
              name: subName.length > 14 ? subName.slice(0, 13) + '…' : subName,
              fullName: subName,
              ...group
            });
          });
        });
        if (subsByUnit.size === 0) return;

        const unitCharts = [...subsByUnit.entries()].map(([unit, subs]) => {
          sortSubs(subs);
          return { unit, subcategories: subs, axis: axisOf(subs) };
        });
        divCards.push({
          cardId: card.id,
          cardName: fullName,
          logic: card.logic || '평균',
          unitCharts
        });
      });

      const unitCharts = [...itemsByUnit.entries()].map(([unit, items]) => ({
        unit, items, axis: axisOf(items)
      }));
      aggregated.push({ division: divName, unitCharts });

      // 사업부별 모드일 땐 선택된 사업부의 detailed만 포함
      if (divCards.length > 0
          && (executiveSelectedDivision === 'all' || executiveSelectedDivision === divName)) {
        detailed.push({ division: divName, cards: divCards });
      }
    });

    return { byDivision: aggregated, detailedByDivision: detailed };
  }, [kpiDashboardCards, selectedKpiCards, globalPerformances, currentYear, execActiveConversions, execUnitConversions, settingsData, executiveSelectedDivision, getLinkedProjects]);

  // 전체 선택/해제 헬퍼
  const selectAllKpiCardsInDivs = () => {
    setSelectedKpiCards(() => {
      const next = new Set();
      kpiCardsByDivision.forEach(({ items }) => items.forEach(it => next.add(it.id)));
      saveExecReportSettings({ selectedKpiCards: [...next] });
      return next;
    });
  };

  const clearAllKpiCards = () => {
    setSelectedKpiCards(() => {
      const next = new Set();
      saveExecReportSettings({ selectedKpiCards: [] });
      return next;
    });
  };

  // DX KPI 데이터: 카테고리 → KPI 행 → 사업부별 셀 (가로: 사업부, 세로: KPI)
  const executiveKpiTable = useMemo(() => {
    const DIVISION_NAME_TO_ID = {
      'MX': 'mx', 'VD': 'vd', 'DA': 'da', 'NW': 'nw', '의료기기': 'medical'
    };
    const ALL_DIVISIONS = Object.keys(DIVISION_NAME_TO_ID);
    const today = todayLocalYmd();
    const refDate = executiveRefDate;

    const activeDivisions = executiveSelectedDivision === 'all'
      ? ALL_DIVISIONS
      : (DIVISION_NAME_TO_ID[executiveSelectedDivision] ? [executiveSelectedDivision] : []);

    const pickLatest = (records, upToDate) => {
      let latest = null;
      for (const r of records) {
        if (!r.baseDate || r.baseDate > upToDate) continue;
        if (!latest
          || r.baseDate > latest.baseDate
          || (r.baseDate === latest.baseDate && r.id > latest.id)) {
          latest = r;
        }
      }
      return latest;
    };

    const toNum = (v) => {
      if (v === null || v === undefined || v === '') return null;
      const n = parseFloat(v);
      return isNaN(n) ? null : n;
    };

    const categories = ['개발', '제조', '품질'].map(cat => {
      const defs = kpiDefinitions.filter(d => (d.category || '기타') === cat && !excludedKpis.has(d.label));
      const kpis = defs.map(def => {
        const byDivision = {};
        activeDivisions.forEach(divName => {
          const divId = DIVISION_NAME_TO_ID[divName];
          const applies = !def.divisions || def.divisions.length === 0 || def.divisions.includes(divId);
          if (!applies) {
            byDivision[divName] = { applies: false };
            return;
          }
          const divRecords = kpiRecords.filter(r => r.division === divName && r.kpi === def.label);
          const cur = pickLatest(divRecords, today);
          const ref = pickLatest(divRecords, refDate);
          const curNum = toNum(cur?.value);
          const refNum = toNum(ref?.value);
          const delta = (curNum !== null && refNum !== null) ? curNum - refNum : null;
          byDivision[divName] = {
            applies: true,
            curNum,
            refNum,
            delta,
            hasData: cur !== null
          };
        });
        return { label: def.label, unit: def.unit || '', byDivision };
      }).filter(kpi =>
        // 활성 사업부 중 데이터가 하나라도 있는 KPI만
        activeDivisions.some(d => kpi.byDivision[d]?.hasData)
      );
      return { name: cat, kpis };
    }).filter(c => c.kpis.length > 0);

    return { activeDivisions, categories };
  }, [kpiDefinitions, kpiRecords, executiveSelectedDivision, executiveRefDate, excludedKpis]);

  // 사업부별 DX KPI 표 (행: KPI, 열: 목표/실적/달성률)
  const executiveKpiByDivision = useMemo(() => {
    const DIVISION_NAME_TO_ID = {
      'MX': 'mx', 'VD': 'vd', 'DA': 'da', 'NW': 'nw', '의료기기': 'medical'
    };
    const today = todayLocalYmd();
    const refDate = executiveRefDate;

    const activeDivisions = executiveSelectedDivision === 'all'
      ? EXEC_DIV_ORDER
      : EXEC_DIV_ORDER.filter(d => d === executiveSelectedDivision);

    const pickLatest = (records, upToDate) => {
      let latest = null;
      for (const r of records) {
        if (!r.baseDate || r.baseDate > upToDate) continue;
        if (!latest
          || r.baseDate > latest.baseDate
          || (r.baseDate === latest.baseDate && r.id > latest.id)) {
          latest = r;
        }
      }
      return latest;
    };

    // 기준일 이전에 기록이 없을 때 baseline으로 쓸 "가장 오래된 기록"
    const pickEarliest = (records) => {
      let earliest = null;
      for (const r of records) {
        if (!r.baseDate) continue;
        if (!earliest
          || r.baseDate < earliest.baseDate
          || (r.baseDate === earliest.baseDate && r.id > earliest.id)) {
          earliest = r;
        }
      }
      return earliest;
    };

    const toN = (v) => {
      if (v === null || v === undefined || v === '') return null;
      const n = parseFloat(v);
      return isNaN(n) ? null : n;
    };

    // 타깃 값 추출 — 공용 모듈이 한다 (분수 목표 폴백 포함).
    // 여기 사본이 있으면 종합표·매트릭스와 조용히 갈린다.
    const targetVal = targetNumber;

    // 연 목표: 분기 목표는 분기마다 정의된 값. 합산·비율 계산 없이 가장 늦은 분기 값 그대로 사용
    // (Q4 → Q3 → Q2 → Q1 순으로 첫 번째 유효 값)
    const computeYearlyTarget = (divName, kpiLabel /* , unit */) => {
      const Q = ['Q4', 'Q3', 'Q2', 'Q1'];
      for (const q of Q) {
        const key = `${divName}|${currentYear}|${kpiLabel}|${q}`;
        const v = targetVal(kpiTargets[key]);
        if (v !== null) return v;
      }
      return null;
    };

    const result = activeDivisions.map(divName => {
      const divId = DIVISION_NAME_TO_ID[divName];
      if (!divId) return { division: divName, kpis: [] };
      const defs = kpiDefinitions.filter(d =>
        (!d.divisions || d.divisions.length === 0 || d.divisions.includes(divId))
        && !excludedKpis.has(d.label)
      );

      const kpis = defs.map(def => {
        const recs = kpiRecords.filter(r => r.division === divName && r.kpi === def.label);
        const cur = pickLatest(recs, today);
        // 기준일 시점의 값. 기준일 이전에 기록이 없으면(예: 운영 데이터가 4월부터인데 '전 분기' 선택)
        // 가장 오래된 기록값으로 clamp 하고 refClamped 플래그로 표시한다.
        let ref = pickLatest(recs, refDate);
        let refClamped = false;
        if (ref === null) {
          ref = pickEarliest(recs);
          if (ref) refClamped = true;
        }
        const curNum = toN(cur?.value);
        const refNum = toN(ref?.value);
        const delta = (curNum !== null && refNum !== null) ? curNum - refNum : null;
        const target = computeYearlyTarget(divName, def.label, def.unit);
        // 달성률 계산은 공용 모듈 하나만 쓴다 (망대/망소·0 나눗셈 규칙 포함).
        // 이 화면은 원래 맞게 계산하고 있었지만, 구현이 따로 있으면 언제든 갈린다 —
        // 실제로 종합표 쪽이 갈려서 망소 지표가 뒤집혀 있었다. (2026-08-01)
        const direction = def.direction || 'higher';
        const rate = calcAchievement(target, curNum, direction);
        return {
          label: def.label,
          unit: def.unit || '',
          category: def.category || '',
          direction,
          curNum, refNum, delta, target, rate,
          refClamped,
          refBaseDate: ref?.baseDate || null,
          hasData: cur !== null || target !== null
        };
      }).filter(k => k.hasData);

      // 카테고리 순서 정렬 (개발 → 제조 → 품질 → 기타)
      const catOrder = { '개발': 0, '제조': 1, '품질': 2 };
      kpis.sort((a, b) => {
        const oa = catOrder[a.category] ?? 99;
        const ob = catOrder[b.category] ?? 99;
        if (oa !== ob) return oa - ob;
        return a.label.localeCompare(b.label);
      });

      return { division: divName, kpis };
    }).filter(d => d.kpis.length > 0);

    // (어떤 사업부든) Δ 있는 KPI 라벨 → 그 KPI 행은 모든 사업부에서 두 줄 높이 유지
    const labelsWithDelta = new Set();
    let hasClampedDelta = false;
    result.forEach(({ kpis }) => {
      kpis.forEach(k => {
        if (k.delta !== null && k.delta !== 0) labelsWithDelta.add(k.label);
        if (k.refClamped && k.delta !== null && k.delta !== 0) hasClampedDelta = true;
      });
    });

    return { divisions: result, labelsWithDelta, hasClampedDelta };
  }, [kpiDefinitions, kpiRecords, kpiTargets, executiveSelectedDivision, executiveRefDate, currentYear, excludedKpis]);

  // 사업부별 모드: 선택된 사업부의 KPI별 월간 시계열 (실적 + 분기 목표 fallback)
  const executiveKpiTrend = useMemo(() => {
    if (executiveSelectedDivision === 'all') return null;
    const divEntry = executiveKpiByDivision.divisions.find(d => d.division === executiveSelectedDivision);
    if (!divEntry || divEntry.kpis.length === 0) return null;

    const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
    const MONTH_TO_QUARTER = {
      '1월': 'Q1', '2월': 'Q1', '3월': 'Q1',
      '4월': 'Q2', '5월': 'Q2', '6월': 'Q2',
      '7월': 'Q3', '8월': 'Q3', '9월': 'Q3',
      '10월': 'Q4', '11월': 'Q4', '12월': 'Q4'
    };
    const yearStr = String(currentYear);

    const getMonthLabel = (dateStr) => {
      if (!dateStr) return null;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      return MONTHS[d.getMonth()];
    };

    const targetVal = (entry) => {
      if (entry == null) return null;
      if (typeof entry === 'object') {
        const v = parseFloat(entry.value);
        if (!isNaN(v)) return v;
        const num = parseFloat(entry.numerator);
        const den = parseFloat(entry.denominator);
        if (!isNaN(num) && !isNaN(den) && den !== 0) return num / den;
        return null;
      }
      const v = parseFloat(entry);
      return isNaN(v) ? null : v;
    };

    return divEntry.kpis.map(kpi => {
      const recs = kpiRecords.filter(r =>
        r.division === executiveSelectedDivision &&
        r.kpi === kpi.label &&
        r.baseDate?.startsWith(yearStr)
      );

      const monthData = MONTHS.map(month => {
        // 실적: 그 월 안에서 가장 최근(baseDate가 늦은 → 같으면 id 큰) 레코드
        let latest = null;
        for (const r of recs) {
          if (getMonthLabel(r.baseDate) !== month) continue;
          if (!latest
            || r.baseDate > latest.baseDate
            || (r.baseDate === latest.baseDate && r.id > latest.id)) {
            latest = r;
          }
        }
        const actualVal = latest ? parseFloat(latest.value) : null;

        // 목표: 월별 우선, 없으면 분기별 fallback
        const monthKey = `${executiveSelectedDivision}|${currentYear}|${kpi.label}|${month}`;
        let tEntry = kpiTargets[monthKey];
        if (targetVal(tEntry) === null) {
          const quarterKey = `${executiveSelectedDivision}|${currentYear}|${kpi.label}|${MONTH_TO_QUARTER[month]}`;
          tEntry = kpiTargets[quarterKey];
        }
        const targetVal_ = targetVal(tEntry);

        return {
          month,
          actual: actualVal !== null && !isNaN(actualVal) ? actualVal : null,
          target: targetVal_
        };
      });

      return {
        label: kpi.label,
        unit: kpi.unit,
        category: kpi.category,
        monthData
      };
    });
  }, [executiveSelectedDivision, executiveKpiByDivision, kpiRecords, kpiTargets, currentYear]);

  // KPI 셀 클릭: 같은 label이면 추가/토글, 다른 label이면 교체
  const handleKpiCellClick = (label, division) => {
    setSelectedKpis(prev => {
      if (prev.length > 0 && prev[0].label !== label) {
        return [{ label, division }]; // 다른 KPI로 전환
      }
      const idx = prev.findIndex(s => s.division === division);
      if (idx >= 0) return prev.filter((_, i) => i !== idx); // 토글 해제
      return [...prev, { label, division }];
    });
  };

  // 선택된 KPI(들)의 시계열 — 같은 label의 여러 사업부를 한 차트에 합침
  const selectedKpiChartData = useMemo(() => {
    if (selectedKpis.length === 0) return null;
    const label = selectedKpis[0].label;
    const divisions = selectedKpis.map(k => k.division);
    const yearStr = String(currentYear);

    // 사업부 × 날짜 → latest record
    const byDate = new Map();
    for (const r of kpiRecords) {
      if (r.kpi !== label || !divisions.includes(r.division)) continue;
      if (!r.baseDate?.startsWith(yearStr)) continue;
      const v = parseFloat(r.value);
      if (isNaN(v)) continue;
      const entry = byDate.get(r.baseDate) || { date: r.baseDate };
      const idKey = `__${r.division}_id`;
      if (entry[idKey] === undefined || r.id > entry[idKey]) {
        entry[idKey] = r.id;
        entry[r.division] = v;
      }
      byDate.set(r.baseDate, entry);
    }

    const data = Array.from(byDate.values())
      .map(d => {
        const clean = { date: d.date };
        divisions.forEach(div => { if (div in d) clean[div] = d[div]; });
        return clean;
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    return { label, divisions, data };
  }, [selectedKpis, kpiRecords, currentYear]);

  // ============ 이슈 현황 ============
  // 기간 프리셋 → 실제 시작/종료일 (해당 연도 범위)
  const issueRange = useMemo(() => {
    const y = currentYear;
    const yearStart = `${y}-01-01`;
    const yearEnd = `${y}-12-31`;
    // toISOString 은 UTC 기준이라 KST 새벽에 하루 밀림 → 로컬 기준으로 포맷
    // (같은 포맷이 여러 곳에 복사돼 있었고 그중 하나가 빠져서 저장이 막혔다.
    //  utils/localDate.js 한 곳으로 모았다 — 2026-08-02)
    const toLocalISO = toLocalYmd;

    if (issuePeriodPreset === 'firstHalf') return { start: yearStart, end: `${y}-06-30` };
    if (issuePeriodPreset === 'secondHalf') return { start: `${y}-07-01`, end: yearEnd };

    if (issuePeriodPreset === 'lastWeek' || issuePeriodPreset === 'lastMonth') {
      // "최근"의 기준점을 선택 연도 안으로 맞춘다
      //  - 올해   : 오늘
      //  - 지난 해 : 그 해 마지막 날 (12/31)
      //  - 미래 해 : 그 해 첫 날 (1/1)
      const today = new Date();
      const thisYear = today.getFullYear();
      const anchor = thisYear === y ? today
        : thisYear > y ? new Date(y, 11, 31)
        : new Date(y, 0, 1);

      const from = new Date(anchor);
      if (issuePeriodPreset === 'lastWeek') from.setDate(from.getDate() - 7);
      else from.setMonth(from.getMonth() - 1);

      // 연 경계를 넘지 않도록 클램프 (이슈는 이미 해당 연도로만 필터되므로)
      const fromStr = toLocalISO(from);
      return { start: fromStr < yearStart ? yearStart : fromStr, end: toLocalISO(anchor) };
    }

    if (issuePeriodPreset === 'custom') {
      return { start: issueStartDate || yearStart, end: issueEndDate || yearEnd };
    }
    return { start: yearStart, end: yearEnd }; // year (전체)
  }, [issuePeriodPreset, issueStartDate, issueEndDate, currentYear]);

  // 사업부별 이슈 그룹 (현재 연도·삭제 제외, 기간·상태 필터 적용)
  const issuesByDivision = useMemo(() => {
    const { start, end } = issueRange;
    const startMs = start ? new Date(start).getTime() : -Infinity;
    const endMs = end ? new Date(`${end}T23:59:59`).getTime() : Infinity;

    const inPeriod = (dateStr) => {
      if (!dateStr) return true; // 등록일 미상 → 항상 포함
      const t = new Date(dateStr).getTime();
      if (Number.isNaN(t)) return true;
      return t >= startMs && t <= endMs;
    };
    const matchStatus = (issue) =>
      issueStatusFilter === 'all' ? true
      : issueStatusFilter === 'resolved' ? !!issue.해결여부
      : !issue.해결여부; // unresolved

    const map = new Map(); // 사업부 → [{ issue, project }]
    projects
      .filter(p => p.과제년도 === currentYear && !p._deleted)
      .forEach(p => {
        const div = p.사업부 || '미지정';
        if (!map.has(div)) map.set(div, []);
        (p.이슈목록 || []).forEach(issue => {
          if (inPeriod(issue.등록일) && matchStatus(issue)) {
            map.get(div).push({ issue, project: p });
          }
        });
      });

    // 정렬: EXEC_DIV_ORDER 우선, 그 외 이름순
    const divs = [...map.keys()];
    const ordered = EXEC_DIV_ORDER.filter(d => map.has(d));
    const rest = divs.filter(d => !EXEC_DIV_ORDER.includes(d)).sort((a, b) => a.localeCompare(b));
    const orderedDivs = [...ordered, ...rest];

    // 사업부 내 이슈 정렬: 미해결 먼저, 그다음 등록일 내림차순
    orderedDivs.forEach(d => {
      map.get(d).sort((a, b) => {
        if (!!a.issue.해결여부 !== !!b.issue.해결여부) return a.issue.해결여부 ? 1 : -1;
        return (b.issue.등록일 || '').localeCompare(a.issue.등록일 || '');
      });
    });

    const totalIssues = orderedDivs.reduce((s, d) => s + map.get(d).length, 0);
    const unresolvedCount = orderedDivs.reduce((s, d) => s + map.get(d).filter(x => !x.issue.해결여부).length, 0);

    return { map, orderedDivs, totalIssues, unresolvedCount };
  }, [projects, currentYear, issueRange, issueStatusFilter]);

  // 사업부의 사무국 코멘트 목록 조회 (현재 연도 기준, 레거시 문자열 호환)
  const getSecretariatComments = (division) => {
    const raw = secretariatComments?.[currentYear]?.[division];
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') return [{ id: 'legacy', 내용: raw, 등록일: '', 작성자: '' }];
    return [];
  };

  // 이슈 기간 필터를 코멘트 등록일에도 동일 적용
  const isInIssuePeriod = (dateStr) => {
    if (!dateStr) return true; // 등록일 미상 → 항상 포함
    const t = new Date(dateStr).getTime();
    if (Number.isNaN(t)) return true;
    const s = issueRange.start ? new Date(issueRange.start).getTime() : -Infinity;
    const e = issueRange.end ? new Date(`${issueRange.end}T23:59:59`).getTime() : Infinity;
    return t >= s && t <= e;
  };

  // 코멘트 목록 서버 저장 공통 (매니저 이상)
  const persistSecretariatComments = async (division, list) => {
    const next = { ...(secretariatComments || {}) };
    const yearMap = { ...(next[currentYear] || {}) };
    if (list && list.length) yearMap[division] = list;
    else delete yearMap[division];
    next[currentYear] = yearMap;

    setSecretariatSaving(true);
    try {
      await saveSystemSettings({ issueSecretariatComments: next });
      setSecretariatComments(next); // 로컬 즉시 반영
      return true;
    } catch (err) {
      alert(`사무국 코멘트 저장 실패: ${err.message}`);
      return false;
    } finally {
      setSecretariatSaving(false);
    }
  };

  // 코멘트 추가 (매니저 이상)
  const addSecretariatComment = async (division) => {
    if (!canEditSecretariat) return;
    const text = secretariatDraft.trim();
    if (!text) return;
    // 실제 본문에 남아있는 멘션만 저장
    const mentions = secretariatDraftMentions.filter(m => text.includes('@' + m.name));
    const inst = {
      id: Date.now(),
      내용: text,
      등록일: todayLocalYmd(),
      작성자: user?.name || user?.username || user?.email || '',
      mentions,
    };
    const existing = getSecretariatComments(division);
    const ok = await persistSecretariatComments(division, [...existing, inst]);
    if (ok) { setEditingSecretariatDiv(null); setSecretariatDraft(''); setSecretariatDraftMentions([]); }
  };

  // 코멘트 삭제 (매니저 이상)
  const deleteSecretariatComment = async (division, id) => {
    if (!canEditSecretariat) return;
    if (!window.confirm('이 사무국 코멘트를 삭제하시겠습니까?')) return;
    const existing = getSecretariatComments(division);
    await persistSecretariatComments(division, existing.filter(c => c.id !== id));
  };

  // 에디터(추가/수정) 초기화
  const resetSecretariatEditor = () => {
    setEditingSecretariatDiv(null);
    setEditingCommentId(null);
    setSecretariatDraft('');
    setSecretariatDraftMentions([]);
    setMentionOpen(false); setMentionAtIdx(-1); setMentionQuery('');
  };

  // 코멘트 수정 시작 (기존 내용·멘션을 draft로 로드)
  const startEditSecretariatComment = (division, c) => {
    if (!canEditSecretariat) return;
    setEditingSecretariatDiv(null);
    setEditingCommentId(c.id);
    setSecretariatDraft(c.내용 || '');
    setSecretariatDraftMentions(Array.isArray(c.mentions) ? c.mentions : []);
    setMentionOpen(false);
  };

  // 코멘트 수정 저장 (매니저 이상)
  const updateSecretariatComment = async (division, id) => {
    if (!canEditSecretariat) return;
    const text = secretariatDraft.trim();
    if (!text) return;
    const mentions = secretariatDraftMentions.filter(m => text.includes('@' + m.name));
    const existing = getSecretariatComments(division);
    const nextList = existing.map(c =>
      c.id === id ? { ...c, 내용: text, mentions, 수정일: todayLocalYmd() } : c
    );
    const ok = await persistSecretariatComments(division, nextList);
    if (ok) resetSecretariatEditor();
  };

  // ── @과제명 멘션 ──
  // 멘션 대상 과제 (삭제 제외, 과제명 있음)
  const mentionProjects = useMemo(
    () => projects.filter(p => !p._deleted && p.과제명),
    [projects]
  );
  // 렌더 시 최장 과제명 우선 매칭 (부분명이 전체명을 가리지 않도록)
  const mentionByLenDesc = useMemo(
    () => [...mentionProjects].sort((a, b) => (b.과제명?.length || 0) - (a.과제명?.length || 0)),
    [mentionProjects]
  );
  // 자동완성 후보 (현재 입력중인 @쿼리 기준)
  const mentionSuggestions = useMemo(() => {
    if (!mentionOpen) return [];
    const q = mentionQuery.trim().toLowerCase();
    let list = q ? mentionProjects.filter(p => p.과제명.toLowerCase().includes(q)) : mentionProjects;
    // 현재 연도 우선
    list = [...list].sort((a, b) => (b.과제년도 === currentYear ? 1 : 0) - (a.과제년도 === currentYear ? 1 : 0));
    return list.slice(0, 8);
  }, [mentionOpen, mentionQuery, mentionProjects, currentYear]);

  // 코멘트 입력 변경 → @멘션 활성 여부 판정
  const handleSecretariatDraftChange = (e) => {
    const value = e.target.value;
    setSecretariatDraft(value);
    const caret = e.target.selectionStart ?? value.length;
    const atIdx = value.lastIndexOf('@', caret - 1);
    if (atIdx >= 0) {
      const before = atIdx === 0 ? '' : value[atIdx - 1];
      const query = value.slice(atIdx + 1, caret);
      if ((atIdx === 0 || /\s/.test(before)) && !query.includes('\n')) {
        setMentionOpen(true); setMentionQuery(query); setMentionAtIdx(atIdx);
        return;
      }
    }
    setMentionOpen(false); setMentionAtIdx(-1);
  };

  // 후보 선택 → "@과제명 " 삽입
  const applyMention = (proj) => {
    const value = secretariatDraft;
    const ta = secretariatTextareaRef.current;
    const caret = ta?.selectionStart ?? value.length;
    if (mentionAtIdx < 0) return;
    const newVal = value.slice(0, mentionAtIdx) + '@' + proj.과제명 + ' ' + value.slice(caret);
    setSecretariatDraft(newVal);
    // uuid 매핑 기록 (화면엔 @과제명만, 링크 resolve는 uuid로)
    const uuid = proj.uuid || proj.id;
    setSecretariatDraftMentions(prev =>
      prev.some(m => m.name === proj.과제명 && m.uuid === uuid) ? prev : [...prev, { name: proj.과제명, uuid }]
    );
    setMentionOpen(false); setMentionAtIdx(-1); setMentionQuery('');
    const newCaret = mentionAtIdx + 1 + proj.과제명.length + 1;
    requestAnimationFrame(() => {
      if (secretariatTextareaRef.current) {
        secretariatTextareaRef.current.focus();
        secretariatTextareaRef.current.setSelectionRange(newCaret, newCaret);
      }
    });
  };

  // 코멘트 본문의 "@과제명"을 과제 편집 링크로 렌더 (uuid로 정확 resolve, 화면엔 이름만)
  const renderCommentWithMentions = (text, mentions = []) => {
    if (!text) return null;
    const mentionMap = new Map((mentions || []).map(m => [m.name, m.uuid]));
    // 후보 이름: 코멘트 멘션 이름 + 전체 과제명 (최장 우선)
    const names = Array.from(new Set([
      ...(mentions || []).map(m => m.name),
      ...mentionProjects.map(p => p.과제명),
    ])).filter(Boolean).sort((a, b) => b.length - a.length);

    const nodes = [];
    let i = 0, buf = '', key = 0;
    const flush = () => { if (buf) { nodes.push(<span key={`t${key++}`}>{buf}</span>); buf = ''; } };
    while (i < text.length) {
      if (text[i] === '@') {
        const rest = text.slice(i + 1);
        const name = names.find(n => rest.startsWith(n));
        if (name) {
          flush();
          const uuid = mentionMap.get(name);
          // uuid 우선 정확 매칭, 없으면(레거시) 이름 매칭
          const target = uuid
            ? mentionProjects.find(p => (p.uuid || p.id) === uuid)
            : mentionByLenDesc.find(p => p.과제명 === name);
          if (target) {
            nodes.push(
              <button
                key={`m${key++}`}
                type="button"
                onClick={() => onEditProject && onEditProject(target)}
                title="과제 편집창 열기"
                style={{
                  display: 'inline', padding: 0, margin: 0, border: 'none', background: 'transparent',
                  color: '#4f46e5', fontWeight: 700, fontSize: 'inherit', fontFamily: 'inherit',
                  cursor: 'pointer', textDecoration: 'underline',
                }}
              >
                @{name}
              </button>
            );
          } else {
            // 링크 대상 없음(삭제 등) → 텍스트만
            nodes.push(<span key={`m${key++}`}>@{name}</span>);
          }
          i += 1 + name.length;
          continue;
        }
      }
      buf += text[i]; i++;
    }
    flush();
    return nodes;
  };

  // 서브탭별 콘텐츠 렌더링
  const renderSubTabContent = () => {
    switch(subTab) {
      case 'executive':
        return (
          <TrendContainer ref={executiveDashboardRef}>
            <TrendHeader>
              <TrendHeaderLeft>
                <TrendTitle>
                  📑 전체 요약
                </TrendTitle>
              </TrendHeaderLeft>
              <TrendHeaderRight>
                <RefDateLabel>📅 기준 날짜</RefDateLabel>
                <RefDatePresetGroup>
                  <RefDatePresetButton
                    $active={executiveRefPreset === '1week'}
                    onClick={() => applyExecutiveRefPreset('1week')}
                  >
                    1주 전
                  </RefDatePresetButton>
                  <RefDatePresetButton
                    $active={executiveRefPreset === '2week'}
                    onClick={() => applyExecutiveRefPreset('2week')}
                  >
                    2주 전
                  </RefDatePresetButton>
                  <RefDatePresetButton
                    $active={executiveRefPreset === '1month'}
                    onClick={() => applyExecutiveRefPreset('1month')}
                  >
                    1개월 전
                  </RefDatePresetButton>
                  <RefDatePresetButton
                    $active={executiveRefPreset === 'lastQuarter'}
                    onClick={() => applyExecutiveRefPreset('lastQuarter')}
                  >
                    지난 분기 마감
                  </RefDatePresetButton>
                </RefDatePresetGroup>
                <RefDateInput
                  type="date"
                  value={executiveRefDate}
                  onChange={handleExecutiveRefDateChange}
                  // toISOString()(UTC)을 쓰면 KST 새벽에 max 가 하루 밀려
                  // 오늘 날짜가 거부된다. 값과 같은 로컬 기준으로 만든다.
                  max={todayLocalYmd()}
                />
                {isAdmin && (
                  <KpiSelectorWrap>
                    <KpiSelectorButton
                      $active={kpiSelectorOpen || excludedKpis.size > 0}
                      onClick={() => setKpiSelectorOpen(v => !v)}
                      title="표에 표시할 KPI 선택 (관리자 전용)"
                    >
                      ⚙️ KPI 선택
                      {excludedKpis.size > 0 && (
                        <span style={{
                          background: 'rgba(255,255,255,0.3)',
                          padding: '0 0.35rem',
                          borderRadius: '0.25rem',
                          fontSize: '0.7rem'
                        }}>
                          −{excludedKpis.size}
                        </span>
                      )}
                    </KpiSelectorButton>
                    {kpiSelectorOpen && (
                      <>
                        <KpiSelectorOverlay onClick={() => setKpiSelectorOpen(false)} />
                        <KpiSelectorPanel>
                          <KpiSelectorHeader>
                            <KpiSelectorHeaderTitle>
                              {kpiSelectorTab === 'kpi' ? '표시할 DX KPI'
                                : kpiSelectorTab === 'perf' ? '표시할 경영성과'
                                : '사업부 대표 법인'}
                            </KpiSelectorHeaderTitle>
                            <KpiSelectorHeaderActions>
                              {kpiSelectorTab === 'kpi' ? (
                                <>
                                  <KpiSelectorMiniButton onClick={setAllKpisIncluded}>전체 선택</KpiSelectorMiniButton>
                                  <KpiSelectorMiniButton onClick={setAllKpisExcluded}>전체 해제</KpiSelectorMiniButton>
                                </>
                              ) : kpiSelectorTab === 'perf' ? (
                                <>
                                  <KpiSelectorMiniButton onClick={selectAllKpiCardsInDivs}>전체 선택</KpiSelectorMiniButton>
                                  <KpiSelectorMiniButton onClick={clearAllKpiCards}>전체 해제</KpiSelectorMiniButton>
                                </>
                              ) : null}
                            </KpiSelectorHeaderActions>
                          </KpiSelectorHeader>
                          <KpiSelectorTabBar>
                            <KpiSelectorTab
                              $active={kpiSelectorTab === 'kpi'}
                              onClick={() => setKpiSelectorTab('kpi')}
                            >
                              DX 부문 KPI
                            </KpiSelectorTab>
                            <KpiSelectorTab
                              $active={kpiSelectorTab === 'perf'}
                              onClick={() => setKpiSelectorTab('perf')}
                            >
                              조직별 경영성과
                            </KpiSelectorTab>
                            <KpiSelectorTab
                              $active={kpiSelectorTab === 'repCorp'}
                              onClick={() => setKpiSelectorTab('repCorp')}
                            >
                              대표 법인
                            </KpiSelectorTab>
                          </KpiSelectorTabBar>
                          <KpiSelectorBody>
                            {kpiSelectorTab === 'kpi' ? (
                              <>
                                {['개발', '제조', '품질'].map(cat => {
                                  const defs = kpiDefinitions.filter(d => (d.category || '기타') === cat);
                                  if (defs.length === 0) return null;
                                  const catColor = cat === '개발' ? '#1d4ed8'
                                                : cat === '제조' ? '#15803d'
                                                : cat === '품질' ? '#b45309'
                                                : '#64748b';
                                  return (
                                    <React.Fragment key={cat}>
                                      <KpiSelectorGroupTitle $color={catColor}>{cat}</KpiSelectorGroupTitle>
                                      {defs.map(def => (
                                        <KpiSelectorRow key={def.label}>
                                          <input
                                            type="checkbox"
                                            checked={!excludedKpis.has(def.label)}
                                            onChange={() => toggleKpiExclusion(def.label)}
                                          />
                                          <span>{def.label}</span>
                                        </KpiSelectorRow>
                                      ))}
                                    </React.Fragment>
                                  );
                                })}
                                {kpiDefinitions.length === 0 && (
                                  <div style={{ padding: '1.5rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
                                    KPI 정의가 없습니다.
                                  </div>
                                )}
                              </>
                            ) : kpiSelectorTab === 'perf' ? (
                              <>
                                <ConvSection>
                                  <ConvSectionTitle>🔧 단위 환산 (기본값)</ConvSectionTitle>
                                  {execUnitConversions.length === 0 ? (
                                    <ConvEmpty>등록된 단위 환산이 없습니다.</ConvEmpty>
                                  ) : (
                                    <ConvChipGroup>
                                      {execUnitConversions.map(conv => {
                                        const srcKey = (conv.sourceUnit || '').toLowerCase();
                                        const isActive = execActiveConversions[srcKey] === conv.id;
                                        return (
                                          <ConvChip
                                            key={conv.id}
                                            $active={isActive}
                                            onClick={() => toggleExecConversion(conv)}
                                            title={conv.description || ''}
                                          >
                                            {isActive ? '✓ ' : ''}
                                            {conv.label || `${conv.sourceUnit} → ${conv.targetUnit}`}
                                          </ConvChip>
                                        );
                                      })}
                                    </ConvChipGroup>
                                  )}
                                </ConvSection>
                                {kpiCardsByDivision.map(({ division, items }) => {
                                  const divColor = EXEC_DIV_COLORS[division] || '#64748b';
                                  return (
                                    <React.Fragment key={division}>
                                      <KpiSelectorGroupTitle $color={divColor}>
                                        {execDivDisplayName(division)}
                                      </KpiSelectorGroupTitle>
                                      {items.map(it => (
                                        <KpiSelectorRow key={it.id}>
                                          <input
                                            type="checkbox"
                                            checked={selectedKpiCards.has(it.id)}
                                            onChange={() => toggleKpiCard(it.id)}
                                          />
                                          <span>{it.name}{it.category ? ` · ${it.category}` : ''}</span>
                                        </KpiSelectorRow>
                                      ))}
                                    </React.Fragment>
                                  );
                                })}
                                {kpiCardsByDivision.length === 0 && (
                                  <div style={{ padding: '1.5rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
                                    {currentYear}년 KPI 대시보드 카드가 없습니다.
                                  </div>
                                )}
                              </>
                            ) : (
                              <>
                                <div style={{ padding: '0.6rem 1rem 0.25rem', fontSize: '0.74rem', color: '#64748b', lineHeight: 1.4 }}>
                                  각 사업부의 대표 법인을 입력하세요. 입력한 값은 「전체 요약」의 DX KPI 표 하단에 표기됩니다.
                                </div>
                                {KPI_DIVISIONS.map(div => {
                                  const divColor = EXEC_DIV_COLORS[div] || '#64748b';
                                  return (
                                    <KpiSelectorRow key={div} style={{ cursor: 'default' }}>
                                      <span style={{ minWidth: 44, fontWeight: 700, color: divColor }}>
                                        {execDivDisplayName(div)}
                                      </span>
                                      <input
                                        type="text"
                                        value={repCorps[div] || ''}
                                        onChange={(e) => handleRepCorpChange(div, e.target.value)}
                                        onBlur={persistRepCorps}
                                        placeholder="대표 법인명 입력"
                                        style={{
                                          flex: 1,
                                          padding: '0.3rem 0.5rem',
                                          border: '1px solid #d1d5db',
                                          borderRadius: '0.35rem',
                                          fontSize: '0.8rem',
                                          cursor: 'text'
                                        }}
                                      />
                                    </KpiSelectorRow>
                                  );
                                })}
                              </>
                            )}
                          </KpiSelectorBody>
                          <KpiSelectorFooter>
                            <span>
                              {kpiSelectorTab === 'kpi'
                                ? `표시 ${kpiDefinitions.length - excludedKpis.size} / 전체 ${kpiDefinitions.length}`
                                : kpiSelectorTab === 'perf'
                                ? `선택 ${selectedKpiCards.size} / 전체 ${kpiCardsByDivision.reduce((s, d) => s + d.items.length, 0)}`
                                : `대표 법인 ${KPI_DIVISIONS.filter(d => (repCorps[d] || '').trim()).length} / ${KPI_DIVISIONS.length}`}
                              <span style={{ marginLeft: 8, color: '#94a3b8' }}>· 서버 저장 · 전사 공유</span>
                            </span>
                            <KpiSelectorMiniButton onClick={() => setKpiSelectorOpen(false)}>닫기</KpiSelectorMiniButton>
                          </KpiSelectorFooter>
                        </KpiSelectorPanel>
                      </>
                    )}
                  </KpiSelectorWrap>
                )}
                {isAdmin && (
                  <SaveImageButton
                    onClick={handleSaveExecutiveAsImage}
                    disabled={executiveImageSaving}
                    title="현재 경영진 보고 화면 전체를 PNG로 저장 (관리자 전용)"
                  >
                    {executiveImageSaving ? '⏳ 저장 중...' : '🖼 이미지 저장'}
                  </SaveImageButton>
                )}
                <TrendYearSelector>
                  <TrendYearButton onClick={handlePrevYear}>‹</TrendYearButton>
                  <TrendYearDisplay>{currentYear}년</TrendYearDisplay>
                  <TrendYearButton onClick={handleNextYear}>›</TrendYearButton>
                </TrendYearSelector>
              </TrendHeaderRight>
            </TrendHeader>
            <TrendFilterBar>
              <TrendFilterButton
                $active={executiveSelectedDivision === 'all'}
                onClick={() => setExecutiveSelectedDivision('all')}
              >
                전체
                <TrendFilterBadge $active={executiveSelectedDivision === 'all'}>
                  {executiveBaseProjects.length}
                </TrendFilterBadge>
              </TrendFilterButton>
              {executiveDivisions.map(division => (
                <TrendFilterButton
                  key={division}
                  $active={executiveSelectedDivision === division}
                  onClick={() => setExecutiveSelectedDivision(division)}
                >
                  {division}
                  <TrendFilterBadge $active={executiveSelectedDivision === division}>
                    {executiveBaseProjects.filter(p => p.사업부 === division).length}
                  </TrendFilterBadge>
                </TrendFilterButton>
              ))}
            </TrendFilterBar>
            <TrendContent>
              {executiveSelectedDivision === 'all' ? (
                <>
                <ExecTotalBar>
                  <ExecTotalCell
                    onClick={() => setMetricDetailModal({ type: 'projects' })}
                    style={{ cursor: 'pointer' }}
                    title="클릭 시 변동 내역 + 전체 목록 보기"
                  >
                    <ExecTotalLabel>전체 과제</ExecTotalLabel>
                    <ExecTotalValue>{executiveMetrics.totalProjects}<ExecTotalUnit>개</ExecTotalUnit></ExecTotalValue>
                    <ExecDivCardDelta $delta={executiveMetrics.deltaTotalProjects}>
                      {execFmtCntDelta(executiveMetrics.deltaTotalProjects)}
                    </ExecDivCardDelta>
                  </ExecTotalCell>
                  <ExecTotalCell
                    onClick={() => setMetricDetailModal({ type: 'completed' })}
                    style={{ cursor: 'pointer' }}
                    title="클릭 시 변동 내역 + 전체 목록 보기"
                  >
                    <ExecTotalLabel>전체 완료 과제</ExecTotalLabel>
                    <ExecTotalValue>
                      {executiveMetrics.currentCompletedProjects}
                      <ExecTotalUnit>
                        개 ({executiveMetrics.totalProjects > 0 ? Math.round((executiveMetrics.currentCompletedProjects / executiveMetrics.totalProjects) * 100) : 0}%)
                      </ExecTotalUnit>
                    </ExecTotalValue>
                    <ExecDivCardDelta $delta={executiveMetrics.deltaCompletedProjects}>
                      {execFmtCntDelta(executiveMetrics.deltaCompletedProjects)}
                    </ExecDivCardDelta>
                  </ExecTotalCell>
                  <ExecTotalCell
                    onClick={() => setMetricDetailModal({ type: 'ai' })}
                    style={{ cursor: 'pointer' }}
                    title="클릭 시 변동 내역 + 전체 목록 보기"
                  >
                    <ExecTotalLabel>전체 액션아이템</ExecTotalLabel>
                    <ExecTotalValue>{executiveMetrics.totalAI}<ExecTotalUnit>개</ExecTotalUnit></ExecTotalValue>
                    <ExecDivCardDelta $delta={executiveMetrics.totalAI - executiveMetrics.refTotalAI}>
                      {execFmtCntDelta(executiveMetrics.totalAI - executiveMetrics.refTotalAI)}
                    </ExecDivCardDelta>
                  </ExecTotalCell>
                  <ExecTotalCell>
                    <ExecTotalLabel>전체 진척률</ExecTotalLabel>
                    <ExecTotalValue>{executiveMetrics.currentAvgProgress.toFixed(1)}<ExecTotalUnit>%</ExecTotalUnit></ExecTotalValue>
                    <ExecDivCardDelta $delta={executiveMetrics.deltaAvgProgress}>
                      {execFmtPctDelta(executiveMetrics.deltaAvgProgress)}
                    </ExecDivCardDelta>
                  </ExecTotalCell>
                  <ExecTotalCell>
                    <ExecTotalLabel>목표 일정 달성률</ExecTotalLabel>
                    <ExecTotalValue>{executiveMetrics.currentAchievementRate.toFixed(1)}<ExecTotalUnit>%</ExecTotalUnit></ExecTotalValue>
                    <ExecDivCardDelta $delta={executiveMetrics.deltaAchievementRate}>
                      {execFmtPctDelta(executiveMetrics.deltaAchievementRate)}
                    </ExecDivCardDelta>
                  </ExecTotalCell>
                </ExecTotalBar>
                <ExecDivCardGrid>
                  {executiveDivisionCards.map(card => {
                    const color = EXEC_DIV_COLORS[card.division] || '#94a3b8';
                    const bgColor = `${color}15`;
                    const borderColor = `${color}50`;
                    const fmtPctDelta = (d) => d === 0 ? '–' : `${d > 0 ? '↑' : '↓'}${Math.abs(d).toFixed(1)}%p`;
                    const fmtCntDelta = (d) => d === 0 ? '–' : `${d > 0 ? '↑' : '↓'}${Math.abs(d)}`;
                    return (
                      <ExecDivCardBox
                        key={card.division}
                        $bgColor={bgColor}
                        $borderColor={borderColor}
                        onClick={() => setDivisionDetailModal(card.division)}
                        style={{ cursor: 'pointer' }}
                        title="클릭 시 변경 현황 및 전체현황 보기"
                      >
                        <ExecDivCardHeader>
                          <ExecDivCardName $color={color}>{execDivDisplayName(card.division)}</ExecDivCardName>
                        </ExecDivCardHeader>
                        <ExecDivCardMetricsGrid>
                          <ExecDivCardMetric>
                            <ExecDivCardMetricLabel>총 과제</ExecDivCardMetricLabel>
                            <ExecDivCardMetricValue>
                              {card.totalProjects}
                            </ExecDivCardMetricValue>
                            <ExecDivCardDelta $delta={card.deltaTotalProjects}>
                              {fmtCntDelta(card.deltaTotalProjects)}
                            </ExecDivCardDelta>
                            <ExecDivCardCompletedLine title="진행상태가 '완료'인 과제 수 / 비율 (액션아이템 진척률과 별개)">
                              완료 {card.currentCompletedProjects}
                              <ExecDivCardCompletedRate>
                                ({card.totalProjects > 0 ? Math.round((card.currentCompletedProjects / card.totalProjects) * 100) : 0}%)
                              </ExecDivCardCompletedRate>
                            </ExecDivCardCompletedLine>
                          </ExecDivCardMetric>

                          <ExecDivCardMetric>
                            <ExecDivCardMetricLabel>총 액션아이템</ExecDivCardMetricLabel>
                            <ExecDivCardMetricValue>
                              {card.totalAI}
                            </ExecDivCardMetricValue>
                            <ExecDivCardDelta $delta={card.totalAI - card.refTotalAI}>
                              {fmtCntDelta(card.totalAI - card.refTotalAI)}
                            </ExecDivCardDelta>
                          </ExecDivCardMetric>

                          <ExecDivCardMetric>
                            <ExecDivCardMetricLabel>액션아이템<br />진척률</ExecDivCardMetricLabel>
                            <ExecDivCardMetricValue>
                              {card.currentAvgProgress.toFixed(1)}
                              <ExecDivCardSlash>%</ExecDivCardSlash>
                            </ExecDivCardMetricValue>
                            <ExecDivCardDelta $delta={card.deltaAvgProgress}>
                              {fmtPctDelta(card.deltaAvgProgress)}
                            </ExecDivCardDelta>
                          </ExecDivCardMetric>

                          <ExecDivCardMetric>
                            <ExecDivCardMetricLabel>목표 일정<br />달성률</ExecDivCardMetricLabel>
                            <ExecDivCardMetricValue>
                              {card.currentAchievementRate.toFixed(1)}
                              <ExecDivCardSlash>%</ExecDivCardSlash>
                            </ExecDivCardMetricValue>
                          </ExecDivCardMetric>
                        </ExecDivCardMetricsGrid>
                      </ExecDivCardBox>
                    );
                  })}
                  {executiveDivisionCards.length === 0 && (
                    <div style={{ gridColumn: '1 / -1', padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                      과제 데이터가 없습니다.
                    </div>
                  )}
                </ExecDivCardGrid>
                </>
              ) : (
              <KPICardGrid>
                <KPICard $accent="#6366f1">
                  <KPICardLabel>전체 과제</KPICardLabel>
                  <KPICardValueRow>
                    <KPICardValueGroup>
                      <KPICardValue>
                        {executiveMetrics.totalProjects}
                        <KPICardUnit>개</KPICardUnit>
                      </KPICardValue>
                      <KPICardDeltaBadge $delta={executiveMetrics.deltaTotalProjects}>
                        {executiveMetrics.deltaTotalProjects > 0 ? '↑' : executiveMetrics.deltaTotalProjects < 0 ? '↓' : '–'}
                        {' '}
                        {Math.abs(executiveMetrics.deltaTotalProjects)}개
                      </KPICardDeltaBadge>
                    </KPICardValueGroup>
                    <KPICardRefHint>
                      {executiveRefLabel} {executiveMetrics.refTotalProjects}개
                    </KPICardRefHint>
                  </KPICardValueRow>
                  <KPICardSubText>
                    {currentYear}년 · {executiveSelectedDivision === 'all' ? '전체' : executiveSelectedDivision}
                  </KPICardSubText>
                </KPICard>

                <KPICard $accent="#10b981">
                  <KPICardLabel>완료 과제</KPICardLabel>
                  <KPICardValueRow>
                    <KPICardValueGroup>
                      <KPICardValue>
                        {executiveMetrics.currentCompletedProjects}
                        <KPICardUnit>
                          / {executiveMetrics.totalProjects}개
                        </KPICardUnit>
                      </KPICardValue>
                      <KPICardDeltaBadge $delta={executiveMetrics.deltaCompletedProjects}>
                        {executiveMetrics.deltaCompletedProjects > 0 ? '↑' : executiveMetrics.deltaCompletedProjects < 0 ? '↓' : '–'}
                        {' '}
                        {Math.abs(executiveMetrics.deltaCompletedProjects)}개
                      </KPICardDeltaBadge>
                    </KPICardValueGroup>
                    <KPICardRefHint>
                      {executiveRefLabel} {executiveMetrics.refCompletedProjects}개
                    </KPICardRefHint>
                  </KPICardValueRow>
                </KPICard>

                <KPICard $accent="#0ea5e9">
                  <KPICardLabel>총 액션아이템</KPICardLabel>
                  <KPICardValueRow>
                    <KPICardValueGroup>
                      <KPICardValue>
                        {executiveMetrics.totalAI}
                        <KPICardUnit>개</KPICardUnit>
                      </KPICardValue>
                      <KPICardDeltaBadge $delta={executiveMetrics.totalAI - executiveMetrics.refTotalAI}>
                        {executiveMetrics.totalAI - executiveMetrics.refTotalAI > 0 ? '↑' : executiveMetrics.totalAI - executiveMetrics.refTotalAI < 0 ? '↓' : '–'}
                        {' '}
                        {Math.abs(executiveMetrics.totalAI - executiveMetrics.refTotalAI)}개
                      </KPICardDeltaBadge>
                    </KPICardValueGroup>
                    <KPICardRefHint>
                      {executiveRefLabel} {executiveMetrics.refTotalAI}개
                    </KPICardRefHint>
                  </KPICardValueRow>
                  <KPICardSubText>
                    과제 {executiveMetrics.totalProjects}개 평균 {executiveMetrics.totalProjects === 0 ? 0 : (executiveMetrics.totalAI / executiveMetrics.totalProjects).toFixed(1)}개
                  </KPICardSubText>
                </KPICard>

                <KPICard $accent="#f59e0b">
                  <KPICardLabel>완료 액션아이템</KPICardLabel>
                  <KPICardValueRow>
                    <KPICardValueGroup>
                      <KPICardValue>
                        {executiveMetrics.currentCompletedAI}
                        <KPICardUnit>
                          / {executiveMetrics.totalAI}개
                        </KPICardUnit>
                      </KPICardValue>
                      <KPICardDeltaBadge $delta={executiveMetrics.deltaCompletedAI}>
                        {executiveMetrics.deltaCompletedAI > 0 ? '↑' : executiveMetrics.deltaCompletedAI < 0 ? '↓' : '–'}
                        {' '}
                        {Math.abs(executiveMetrics.deltaCompletedAI)}개
                      </KPICardDeltaBadge>
                    </KPICardValueGroup>
                    <KPICardRefHint>
                      {executiveRefLabel} {executiveMetrics.refCompletedAI}개
                    </KPICardRefHint>
                  </KPICardValueRow>
                </KPICard>

                <KPICard $accent="#8b5cf6">
                  <KPICardLabel>평균 액션아이템 진척률</KPICardLabel>
                  <KPICardValueRow>
                    <KPICardValueGroup>
                      <KPICardValue>
                        {executiveMetrics.currentAvgProgress.toFixed(1)}
                        <KPICardUnit>%</KPICardUnit>
                      </KPICardValue>
                      <KPICardDeltaBadge $delta={executiveMetrics.deltaAvgProgress}>
                        {executiveMetrics.deltaAvgProgress > 0 ? '↑' : executiveMetrics.deltaAvgProgress < 0 ? '↓' : '–'}
                        {' '}
                        {Math.abs(executiveMetrics.deltaAvgProgress).toFixed(1)}%p
                      </KPICardDeltaBadge>
                    </KPICardValueGroup>
                    <KPICardRefHint>
                      {executiveRefLabel} {executiveMetrics.refAvgProgress.toFixed(1)}%
                    </KPICardRefHint>
                  </KPICardValueRow>
                  <KPIDecompBlock>
                    <KPIDecompRow>
                      <KPIDecompLabel>
                        기존 {executiveMetrics.sameCohortCount}개 과제 진척
                      </KPIDecompLabel>
                      <KPIDecompValue $value={executiveMetrics.sameCohortDelta}>
                        {executiveMetrics.sameCohortDelta > 0 ? '+' : ''}{executiveMetrics.sameCohortDelta.toFixed(1)}%p
                      </KPIDecompValue>
                    </KPIDecompRow>
                    {executiveMetrics.newProjectsCount > 0 && (
                      <KPIDecompRow>
                        <KPIDecompLabel>
                          신규 {executiveMetrics.newProjectsCount}개 추가 영향
                        </KPIDecompLabel>
                        <KPIDecompValue $value={executiveMetrics.newEffect}>
                          {executiveMetrics.newEffect > 0 ? '+' : ''}{executiveMetrics.newEffect.toFixed(1)}%p
                        </KPIDecompValue>
                      </KPIDecompRow>
                    )}
                    {executiveMetrics.removedProjectsCount > 0 && (
                      <KPIDecompRow>
                        <KPIDecompLabel>
                          삭제 {executiveMetrics.removedProjectsCount}개 영향
                        </KPIDecompLabel>
                        <KPIDecompValue $value={executiveMetrics.removedEffect}>
                          {executiveMetrics.removedEffect > 0 ? '+' : ''}{executiveMetrics.removedEffect.toFixed(1)}%p
                        </KPIDecompValue>
                      </KPIDecompRow>
                    )}
                  </KPIDecompBlock>
                </KPICard>

                <KPICard $accent="#ec4899">
                  <KPICardLabel>목표 일정 달성률</KPICardLabel>
                  <KPICardValueRow>
                    <KPICardValueGroup>
                      <KPICardValue>
                        {executiveMetrics.currentAchievementRate.toFixed(1)}
                        <KPICardUnit>%</KPICardUnit>
                      </KPICardValue>
                      <KPICardDeltaBadge $delta={executiveMetrics.deltaAchievementRate}>
                        {executiveMetrics.deltaAchievementRate > 0 ? '↑' : executiveMetrics.deltaAchievementRate < 0 ? '↓' : '–'}
                        {' '}
                        {Math.abs(executiveMetrics.deltaAchievementRate).toFixed(1)}%p
                      </KPICardDeltaBadge>
                    </KPICardValueGroup>
                    <KPICardRefHint>
                      {executiveRefLabel} {executiveMetrics.refAchievementRate.toFixed(1)}%
                    </KPICardRefHint>
                  </KPICardValueRow>
                  <KPICardSubText>
                    완료 {executiveMetrics.currentAchieved}개 / 목표일 도래 {executiveMetrics.currentPlannedByToday}개
                  </KPICardSubText>
                </KPICard>
              </KPICardGrid>
              )}

              <ExecFullRow style={executiveSelectedDivision !== 'all' ? { gridTemplateColumns: '1fr' } : undefined}>
                <ExecPanel>
                  <ExecPanelHeader>
                    <ExecPanelTitle>
                      📈 조직별 액션아이템 진척률
                    </ExecPanelTitle>
                    <ExecPanelSubtitle>
                      {currentYear}년 · 주차별 평균 액션아이템 진척률
                      {executiveSelectedDivision !== 'all' ? ` · ${execDivDisplayName(executiveSelectedDivision)} 프로세스별` : ''}
                    </ExecPanelSubtitle>
                  </ExecPanelHeader>
                  <ExecPanelBody style={{ padding: '0.85rem 1rem 1rem' }}>
                    {executiveSelectedDivision !== 'all' ? (
                      !executiveProcessTrend || executiveProcessTrend.processes.length === 0 ? (
                        <ExecKpiPlaceholder>표시할 프로세스 데이터가 없습니다.</ExecKpiPlaceholder>
                      ) : (() => {
                        const PROCESS_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9', '#ec4899', '#14b8a6'];
                        return (
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${executiveProcessTrend.processes.length}, 1fr)`,
                            gap: '0.5rem'
                          }}>
                            {executiveProcessTrend.processes.map((proc, idx) => {
                              const color = PROCESS_COLORS[idx % PROCESS_COLORS.length];
                              return (
                                <div key={proc}>
                                  <div style={{
                                    fontSize: '0.9rem', fontWeight: 700, color, textAlign: 'center',
                                    marginBottom: '0.3rem', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', gap: 6
                                  }}>
                                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                                    {proc}
                                  </div>
                                  <ResponsiveContainer width="100%" height={240}>
                                    <LineChart data={executiveProcessTrend.data} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                                      <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                                      <XAxis
                                        dataKey="dateMs"
                                        type="number"
                                        scale="time"
                                        domain={[executiveProcessTrend.yearStart, executiveProcessTrend.yearEnd]}
                                        ticks={executiveProcessTrend.monthTicks}
                                        tick={{ fontSize: 11, fill: '#64748b' }}
                                        tickFormatter={(ts) => `${new Date(ts).getMonth() + 1}월`}
                                      />
                                      <YAxis
                                        tick={{ fontSize: 11, fill: '#64748b' }}
                                        domain={[0, 100]}
                                        ticks={[0, 25, 50, 75, 100]}
                                        tickFormatter={(v) => `${v}%`}
                                        width={42}
                                      />
                                      <RechartsTooltip
                                        contentStyle={{ fontSize: 11, border: '1px solid #e2e8f0', borderRadius: 6, padding: '5px 8px' }}
                                        formatter={(v) => [`${v}%`, proc]}
                                        labelFormatter={(ts) => {
                                          const d = new Date(ts);
                                          return `${d.getMonth() + 1}/${d.getDate()}`;
                                        }}
                                      />
                                      <Line
                                        type="linear"
                                        dataKey={proc}
                                        stroke={color}
                                        strokeWidth={2}
                                        dot={{ r: 2.5, fill: color, strokeWidth: 0 }}
                                        activeDot={renderClickableActiveDot('process', proc, color)}
                                        connectNulls
                                      />
                                    </LineChart>
                                  </ResponsiveContainer>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()
                    ) : executiveDivisionTrend.divisions.length === 0 ? (
                      <ExecKpiPlaceholder>표시할 데이터가 없습니다.</ExecKpiPlaceholder>
                    ) : (() => {
                      const BU_GROUP = ['MX', 'VD', 'DA', 'NW', '의료기기'];
                      const FN_GROUP = ['CS', 'GTR', 'SR'];
                      const buDivs = executiveDivisionTrend.divisions.filter(d => BU_GROUP.includes(d));
                      const fnDivs = executiveDivisionTrend.divisions.filter(d => FN_GROUP.includes(d));

                      const renderSubChart = (subDivisions) => (
                        subDivisions.length === 0 ? (
                          <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
                            데이터 없음
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height={280}>
                            <LineChart
                              data={executiveDivisionTrend.data}
                              margin={{ top: 12, right: 16, left: 0, bottom: 4 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                              <XAxis
                                dataKey="dateMs"
                                type="number"
                                scale="time"
                                domain={[executiveDivisionTrend.yearStart, executiveDivisionTrend.yearEnd]}
                                ticks={executiveDivisionTrend.monthTicks}
                                tick={{ fontSize: 12, fill: '#64748b' }}
                                tickFormatter={(ts) => `${new Date(ts).getMonth() + 1}월`}
                              />
                              <YAxis
                                tick={{ fontSize: 12, fill: '#64748b' }}
                                domain={[0, 100]}
                                ticks={[0, 25, 50, 75, 100]}
                                tickFormatter={(v) => `${v}%`}
                                width={48}
                              />
                              <RechartsTooltip
                                contentStyle={{ fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px' }}
                                formatter={(v, name) => [`${v}%`, execDivDisplayName(name)]}
                                labelFormatter={(ts) => {
                                  const d = new Date(ts);
                                  return `${d.getMonth() + 1}/${d.getDate()}`;
                                }}
                                itemSorter={(item) => {
                                  const idx = EXEC_DIV_ORDER.indexOf(item.dataKey);
                                  return idx === -1 ? 999 : idx;
                                }}
                              />
                              <RechartsLegend
                                wrapperStyle={{ fontSize: 12, paddingTop: 4 }}
                                content={() => (
                                  <div style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    justifyContent: 'center',
                                    gap: '0.85rem',
                                    paddingTop: '0.4rem',
                                    fontSize: 12,
                                    color: '#475569'
                                  }}>
                                    {subDivisions.map(div => (
                                      <span key={div} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                        <span style={{
                                          display: 'inline-block',
                                          width: 16,
                                          height: 3,
                                          background: EXEC_DIV_COLORS[div] || '#64748b',
                                          borderRadius: 1
                                        }} />
                                        {execDivDisplayName(div)}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              />
                              {subDivisions.map(div => (
                                <Line
                                  key={div}
                                  type="linear"
                                  dataKey={div}
                                  name={div}
                                  stroke={EXEC_DIV_COLORS[div] || '#64748b'}
                                  strokeWidth={2}
                                  dot={{ r: 2.5, fill: EXEC_DIV_COLORS[div] || '#64748b', strokeWidth: 0 }}
                                  activeDot={renderClickableActiveDot('division', div, EXEC_DIV_COLORS[div] || '#64748b')}
                                  connectNulls
                                />
                              ))}
                            </LineChart>
                          </ResponsiveContainer>
                        )
                      );

                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                          <div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', textAlign: 'center', marginBottom: '0.35rem' }}>
                              사업부
                            </div>
                            {renderSubChart(buDivs)}
                          </div>
                          <div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', textAlign: 'center', marginBottom: '0.35rem' }}>
                              기능 조직
                            </div>
                            {renderSubChart(fnDivs)}
                          </div>
                        </div>
                      );
                    })()}
                  </ExecPanelBody>
                </ExecPanel>

                {executiveSelectedDivision === 'all' && (
                <ExecPanel>
                  <ExecPanelHeader>
                    <ExecPanelTitle>📊 조직별 액션아이템 상태 현황</ExecPanelTitle>
                    <ExecPanelSubtitle>
                      {currentYear}년 · 현재 상태 분포
                    </ExecPanelSubtitle>
                  </ExecPanelHeader>
                  <ExecPanelBody style={{ padding: '0.85rem 1rem 1rem' }}>
                    {executiveDivisionAIStatus.length === 0 ? (
                      <ExecKpiPlaceholder>표시할 데이터가 없습니다.</ExecKpiPlaceholder>
                    ) : (
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart
                          data={executiveDivisionAIStatus}
                          layout="vertical"
                          margin={{ top: 8, right: 20, left: 0, bottom: 4 }}
                          barCategoryGap="22%"
                          style={{ cursor: 'pointer' }}
                          onClick={(e) => {
                            if (!e) return;
                            let divKey = e?.activePayload?.[0]?.payload?.divKey;
                            if (!divKey && e?.activeLabel) {
                              const found = executiveDivisionAIStatus.find(d => d.division === e.activeLabel);
                              divKey = found?.divKey;
                            }
                            if (divKey) {
                              setAiStatusModal({ division: divKey });
                              setAiModalFilter('all');
                            }
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
                          <XAxis
                            type="number"
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            allowDecimals={false}
                          />
                          <YAxis
                            type="category"
                            dataKey="division"
                            tick={{ fontSize: 11, fill: '#1e293b', fontWeight: 600 }}
                            width={50}
                            tickLine={false}
                          />
                          <RechartsTooltip
                            contentStyle={{ fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px' }}
                          />
                          <RechartsLegend
                            wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
                            payload={[
                              { value: '조기달성', type: 'square', color: '#3b82f6' },
                              { value: '완료', type: 'square', color: '#10b981' },
                              { value: '지연', type: 'square', color: '#ef4444' },
                              { value: '계획', type: 'square', color: '#94a3b8' }
                            ]}
                          />
                          <Bar
                            dataKey="조기달성" stackId="ai" fill="#3b82f6" activeBar={false}
                            onClick={(d) => d?.divKey && (setAiStatusModal({ division: d.divKey }), setAiModalFilter('all'))}
                          >
                            <LabelList dataKey="조기달성" position="center" fill="white" fontSize={11} fontWeight={700} formatter={(v) => v > 0 ? v : ''} />
                          </Bar>
                          <Bar
                            dataKey="완료" stackId="ai" fill="#10b981" activeBar={false}
                            onClick={(d) => d?.divKey && (setAiStatusModal({ division: d.divKey }), setAiModalFilter('all'))}
                          >
                            <LabelList dataKey="완료"     position="center" fill="white" fontSize={11} fontWeight={700} formatter={(v) => v > 0 ? v : ''} />
                          </Bar>
                          <Bar
                            dataKey="지연" stackId="ai" fill="#ef4444" activeBar={false}
                            onClick={(d) => d?.divKey && (setAiStatusModal({ division: d.divKey }), setAiModalFilter('all'))}
                          >
                            <LabelList dataKey="지연"     position="center" fill="white" fontSize={11} fontWeight={700} formatter={(v) => v > 0 ? v : ''} />
                          </Bar>
                          <Bar
                            dataKey="계획" stackId="ai" fill="#94a3b8" activeBar={false}
                            onClick={(d) => d?.divKey && (setAiStatusModal({ division: d.divKey }), setAiModalFilter('all'))}
                          >
                            <LabelList dataKey="계획"     position="center" fill="white" fontSize={11} fontWeight={700} formatter={(v) => v > 0 ? v : ''} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </ExecPanelBody>
                </ExecPanel>
                )}
              </ExecFullRow>

              {/* 사업부별 모드: 프로세스별 액션아이템 상태 + 기간 내 과제 진행 현황 (한 행) */}
              {executiveSelectedDivision !== 'all' && (
              <ExecTwoColumnRow>
                <ExecPanel>
                  <ExecPanelHeader>
                    <ExecPanelTitle>📊 조직별 액션아이템 상태 현황</ExecPanelTitle>
                    <ExecPanelSubtitle>
                      {execDivDisplayName(executiveSelectedDivision)} · 프로세스별 분포
                    </ExecPanelSubtitle>
                  </ExecPanelHeader>
                  <ExecPanelBody style={{ padding: '0.85rem 1rem 1rem' }}>
                    {(!executiveProcessAIStatus || executiveProcessAIStatus.length === 0) ? (
                      <ExecKpiPlaceholder>표시할 프로세스 데이터가 없습니다.</ExecKpiPlaceholder>
                    ) : (
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart
                          data={executiveProcessAIStatus}
                          layout="vertical"
                          margin={{ top: 8, right: 20, left: 0, bottom: 4 }}
                          barCategoryGap="22%"
                          style={{ cursor: 'pointer' }}
                          onClick={(e) => {
                            if (!e) return;
                            let procKey = e?.activePayload?.[0]?.payload?.procKey;
                            if (!procKey && e?.activeLabel) {
                              const found = executiveProcessAIStatus.find(d => d.process === e.activeLabel);
                              procKey = found?.procKey;
                            }
                            if (procKey) {
                              setAiStatusModal({ division: executiveSelectedDivision, process: procKey });
                              setAiModalFilter('all');
                            }
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
                          <XAxis
                            type="number"
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            allowDecimals={false}
                          />
                          <YAxis
                            type="category"
                            dataKey="process"
                            tick={{ fontSize: 11, fill: '#1e293b', fontWeight: 600 }}
                            width={80}
                            tickLine={false}
                          />
                          <RechartsTooltip
                            contentStyle={{ fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px' }}
                          />
                          <RechartsLegend
                            wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
                            payload={[
                              { value: '조기달성', type: 'square', color: '#3b82f6' },
                              { value: '완료', type: 'square', color: '#10b981' },
                              { value: '지연', type: 'square', color: '#ef4444' },
                              { value: '계획', type: 'square', color: '#94a3b8' }
                            ]}
                          />
                          <Bar
                            dataKey="조기달성" stackId="ai" fill="#3b82f6" activeBar={false}
                            onClick={(d) => d?.procKey && (setAiStatusModal({ division: executiveSelectedDivision, process: d.procKey }), setAiModalFilter('all'))}
                          >
                            <LabelList dataKey="조기달성" position="center" fill="white" fontSize={11} fontWeight={700} formatter={(v) => v > 0 ? v : ''} />
                          </Bar>
                          <Bar
                            dataKey="완료" stackId="ai" fill="#10b981" activeBar={false}
                            onClick={(d) => d?.procKey && (setAiStatusModal({ division: executiveSelectedDivision, process: d.procKey }), setAiModalFilter('all'))}
                          >
                            <LabelList dataKey="완료" position="center" fill="white" fontSize={11} fontWeight={700} formatter={(v) => v > 0 ? v : ''} />
                          </Bar>
                          <Bar
                            dataKey="지연" stackId="ai" fill="#ef4444" activeBar={false}
                            onClick={(d) => d?.procKey && (setAiStatusModal({ division: executiveSelectedDivision, process: d.procKey }), setAiModalFilter('all'))}
                          >
                            <LabelList dataKey="지연" position="center" fill="white" fontSize={11} fontWeight={700} formatter={(v) => v > 0 ? v : ''} />
                          </Bar>
                          <Bar
                            dataKey="계획" stackId="ai" fill="#94a3b8" activeBar={false}
                            onClick={(d) => d?.procKey && (setAiStatusModal({ division: executiveSelectedDivision, process: d.procKey }), setAiModalFilter('all'))}
                          >
                            <LabelList dataKey="계획" position="center" fill="white" fontSize={11} fontWeight={700} formatter={(v) => v > 0 ? v : ''} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </ExecPanelBody>
                </ExecPanel>

                <ExecPanel>
                  <ExecPanelHeader>
                    <ExecPanelTitle>
                      🎯 기간 내 과제 상세 진행 현황 (액션아이템 기준)
                    </ExecPanelTitle>
                    <ExecPanelSubtitle>
                      {executiveRefDate} 이후 ~ 오늘
                    </ExecPanelSubtitle>
                  </ExecPanelHeader>
                  <ExecStatusFilterBar>
                    {[
                      { key: 'all',       label: '전체',     color: '#6366f1', count: executiveProjectStatus.stats.total },
                      { key: 'completed', label: '완료',     color: '#10b981', count: executiveProjectStatus.stats.completed },
                      { key: 'delayed',   label: '지연',     color: '#ef4444', count: executiveProjectStatus.stats.delayed },
                      { key: 'early',     label: '조기 달성', color: '#3b82f6', count: executiveProjectStatus.stats.early }
                    ].map(chip => (
                      <ExecStatusChip
                        key={chip.key}
                        $active={executiveStatusFilter === chip.key}
                        $color={chip.color}
                        onClick={() => setExecutiveStatusFilter(chip.key)}
                      >
                        {chip.label}
                        <ExecStatusChipBadge $active={executiveStatusFilter === chip.key}>
                          {chip.count}
                        </ExecStatusChipBadge>
                      </ExecStatusChip>
                    ))}
                  </ExecStatusFilterBar>

                  {(() => {
                    const CAT = {
                      completed: { label: '완료',     icon: '✅', color: '#047857', bg: '#d1fae5' },
                      delayed:   { label: '지연',     icon: '⚠️', color: '#b91c1c', bg: '#fee2e2' },
                      early:     { label: '조기 달성', icon: '🌟', color: '#1d4ed8', bg: '#dbeafe' }
                    };
                    const flatRows = [];
                    executiveProjectStatus.results.forEach(project => {
                      const projectRows = [];
                      const pushCat = (catKey, items) => {
                        if (executiveStatusFilter !== 'all' && executiveStatusFilter !== catKey) return;
                        items.forEach(item => projectRows.push({ category: catKey, item }));
                      };
                      pushCat('completed', project.completedInPeriod);
                      pushCat('delayed',   project.delayed);
                      pushCat('early',     project.early);
                      if (projectRows.length === 0) return;
                      projectRows.forEach((r, idx) => {
                        flatRows.push({
                          project,
                          ...r,
                          isFirstOfProject: idx === 0,
                          projectSpan: projectRows.length
                        });
                      });
                    });
                    if (flatRows.length === 0) {
                      return <ExecEmptyMessage>해당 카테고리에 해당하는 항목이 없습니다.</ExecEmptyMessage>;
                    }
                    const infoText = (row) => {
                      if (row.category === 'completed') return `완료 ${row.item.완료일}`;
                      if (row.category === 'delayed')   return `목표 ${row.item.목표일}`;
                      if (row.category === 'early')     return `완료 ${row.item.완료일} (목표 ${row.item.목표일})`;
                      return '';
                    };
                    const LIMIT = 10;
                    let visibleRows = flatRows;
                    if (flatRows.length > LIMIT && !executiveShowAll) {
                      let cutAt = LIMIT;
                      while (cutAt > 0 && cutAt < flatRows.length && !flatRows[cutAt].isFirstOfProject) {
                        cutAt--;
                      }
                      if (cutAt === 0) {
                        cutAt = 1;
                        while (cutAt < flatRows.length && !flatRows[cutAt].isFirstOfProject) {
                          cutAt++;
                        }
                      }
                      visibleRows = flatRows.slice(0, cutAt);
                    }
                    const hasHidden = visibleRows.length < flatRows.length;
                    return (
                      <>
                        <ExecTableWrap>
                          <ExecTable>
                            <colgroup>
                              <col style={{ width: '28%' }} />
                              <col style={{ width: 'auto' }} />
                              <col style={{ width: '100px' }} />
                              <col style={{ width: '130px' }} />
                            </colgroup>
                            <ExecTableHead>
                              <tr>
                                <ExecTableTh>과제</ExecTableTh>
                                <ExecTableTh>액션아이템</ExecTableTh>
                                <ExecTableTh>달성현황</ExecTableTh>
                                <ExecTableTh>정보</ExecTableTh>
                              </tr>
                            </ExecTableHead>
                            <tbody>
                              {visibleRows.map((row, idx) => {
                                const cat = CAT[row.category];
                                return (
                                  <tr key={idx}>
                                    {row.isFirstOfProject && (
                                      <ExecTableTdProject rowSpan={row.projectSpan}>
                                        <ExecTableProjectName>{row.project.과제명}</ExecTableProjectName>
                                        <ExecTableProjectMeta>
                                          <span>{row.project.사업부}</span>
                                          {row.project.과제PL && <span>· {row.project.과제PL}</span>}
                                          <ExecProjectProgress $progress={row.project.진행률}>
                                            · {percentText(row.project.진행률)}
                                          </ExecProjectProgress>
                                        </ExecTableProjectMeta>
                                      </ExecTableTdProject>
                                    )}
                                    <ExecTableTd>{row.item.title}</ExecTableTd>
                                    <ExecTableTd>
                                      <ExecCategoryBadge $color={cat.color} $bg={cat.bg}>
                                        {cat.icon} {cat.label}
                                      </ExecCategoryBadge>
                                    </ExecTableTd>
                                    <ExecTableTd>
                                      <ExecTableInfo>{infoText(row)}</ExecTableInfo>
                                    </ExecTableTd>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </ExecTable>
                        </ExecTableWrap>
                        {(hasHidden || executiveShowAll) && flatRows.length > LIMIT && (
                          <ExecShowMoreBar>
                            {executiveShowAll ? (
                              <>
                                <ExecShowMoreButton onClick={() => setExecutiveShowAll(false)}>
                                  접기 ▲
                                </ExecShowMoreButton>
                                <ExecShowMoreHint>총 {flatRows.length}건</ExecShowMoreHint>
                              </>
                            ) : (
                              <>
                                <ExecShowMoreButton onClick={() => setExecutiveShowAll(true)}>
                                  더보기 ▼
                                </ExecShowMoreButton>
                                <ExecShowMoreHint>
                                  {visibleRows.length} / {flatRows.length}건 표시
                                </ExecShowMoreHint>
                              </>
                            )}
                          </ExecShowMoreBar>
                        )}
                      </>
                    );
                  })()}
                </ExecPanel>
              </ExecTwoColumnRow>
              )}

              <ExecPerfFullRow>
                <ExecPanel>
                  <ExecPanelHeader>
                    <ExecPanelTitle>💼 조직별 경영성과</ExecPanelTitle>
                    <ExecPanelSubtitle>
                      {currentYear}년 · 목표 vs 현재 vs 실적 ·{' '}
                      {selectedKpiCards.size === 0
                        ? 'KPI 선택 모달의 「조직별 경영성과」 탭에서 카드를 선택하세요'
                        : `선택 ${selectedKpiCards.size}개 카드`}
                    </ExecPanelSubtitle>
                  </ExecPanelHeader>
                  {selectedKpiCards.size === 0 ? (
                    <ExecPerfEmpty>
                      📊 표시할 KPI 카드가 선택되지 않았습니다.
                      <div style={{ fontSize: '0.72rem', marginTop: '0.4rem', color: '#cbd5e1' }}>
                        우측 상단 「⚙️ KPI 선택」 → 「조직별 경영성과」 탭에서 카드를 골라주세요.
                      </div>
                    </ExecPerfEmpty>
                  ) : executiveSelectedDivision === 'all' ? (
                    <ExecPanelBody style={{ padding: '0.5rem 1rem 1rem' }}>
                      <ExecPerfGrid>
                        {executiveBusinessPerf.byDivision.map(({ division, unitCharts }) => {
                          const color = EXEC_DIV_COLORS[division] || '#94a3b8';
                          const cardCount = unitCharts.reduce((n, c) => n + c.items.length, 0);
                          // 단위가 둘 이상이면 차트를 나눠 그린다. 하나면 지금까지와 똑같이 보인다.
                          const showUnitCaption = unitCharts.length > 1;
                          return (
                            <ExecPerfCard key={division}>
                              <ExecPerfCardHeader $color={color}>
                                {execDivDisplayName(division)}
                                <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 500, marginLeft: 'auto' }}>
                                  {cardCount}개
                                </span>
                              </ExecPerfCardHeader>
                              <ExecPerfCardBody>
                                {cardCount === 0 ? (
                                  <ExecPerfEmpty style={{ padding: '1.5rem 0.5rem' }}>
                                    선택된 항목 없음
                                  </ExecPerfEmpty>
                                ) : unitCharts.map(({ unit, items, axis }) => (
                                  <div key={unit || '(단위없음)'}>
                                    {showUnitCaption && (
                                      <div style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        margin: '0.35rem 0 0.1rem', paddingLeft: 44,
                                        fontSize: 11, fontWeight: 700, color: '#475569'
                                      }}>
                                        <span style={{
                                          padding: '1px 7px', borderRadius: 999,
                                          background: '#eef2ff', color: '#3730a3', border: '1px solid #c7d2fe'
                                        }}>
                                          {unit || '단위 없음'}
                                        </span>
                                        <span style={{ fontWeight: 500, color: '#94a3b8' }}>
                                          {items.length}개
                                        </span>
                                      </div>
                                    )}
                                    <div style={{
                                      display: 'flex',
                                      paddingLeft: 44,
                                      paddingRight: 8,
                                      marginBottom: 3,
                                      fontSize: 12
                                    }}>
                                      {items.map(it => {
                                        // 달성률 = 실적 막대 ÷ 목표 막대. 분모는 세운 목표 전부다.
                                        const rate = execAchievementRate(it);
                                        const rateColor = rate == null ? '#94a3b8'
                                                        : rate >= 100 ? '#10b981'
                                                        : rate >= 70 ? '#f59e0b' : '#ef4444';
                                        return (
                                          <div key={it.id} style={{ flex: 1, textAlign: 'center', whiteSpace: 'nowrap' }}>
                                            <span style={{ color: '#64748b' }}>달성률</span>{' '}
                                            <span style={{ fontWeight: 700, color: rateColor }}
                                              title={rate == null
                                                ? '목표가 없어 달성률을 낼 수 없습니다'
                                                : `전체 목표(${it.tcPairCount}개) 대비 실적(${it.acPairCount}개)`}>
                                              {rate != null ? `${rate.toFixed(1)}%` : '–'}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    <ResponsiveContainer width="100%" height={240}>
                                      <BarChart
                                        data={items}
                                        margin={{ top: 26, right: 12, left: 0, bottom: 4 }}
                                        barCategoryGap="22%"
                                        style={{ cursor: 'pointer' }}
                                        onClick={(e) => {
                                          if (!e) return;
                                          let item = e?.activePayload?.[0]?.payload;
                                          if (!item && e?.activeLabel) {
                                            item = items.find(i => i.name === e.activeLabel);
                                          }
                                          if (item) setPerfDetailModal({ division, item });
                                        }}
                                      >
                                        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                                        <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} interval={0} />
                                        <YAxis
                                          tick={{ fontSize: 12, fill: '#64748b' }}
                                          width={48}
                                          domain={axis ? [0, axis.max] : [0, 'auto']}
                                          ticks={axis ? axis.ticks : undefined}
                                          allowDataOverflow={false}
                                        />
                                        <RechartsTooltip
                                          contentStyle={{ fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px' }}
                                          content={({ active, payload }) => {
                                            if (!active || !payload || !payload.length) return null;
                                            const it = payload[0].payload;
                                            const u = it.unit || '';
                                            const absFmt = (n) => n == null ? '–' : `${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}${u ? ' ' + u : ''}`;
                                            return (
                                              <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px', fontSize: 12, minWidth: 200 }}>
                                                <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>{it.fullName}</div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                                  <span style={{ color: '#64748b' }}>목표 절감액</span>
                                                  <span style={{ fontWeight: 700, color: '#1e293b' }}>{absFmt(it.targetSaving)}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                                  <span style={{ color: '#64748b' }}>실적 절감액</span>
                                                  <span style={{ fontWeight: 700, color: '#1e293b' }}>{absFmt(it.actualSaving)}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 3, paddingTop: 3, borderTop: '1px solid #f1f5f9', color: '#94a3b8' }}>
                                                  <span>집계 대상</span>
                                                  <span>목표 {it.tcPairCount} · 실적 {it.acPairCount}</span>
                                                </div>
                                              </div>
                                            );
                                          }}
                                        />
                                        <RechartsLegend wrapperStyle={{ fontSize: 12, paddingTop: 4 }} />
                                        <Bar dataKey="목표" name="목표 절감액" fill="#94a3b8" activeBar={false}>
                                          <LabelList
                                            dataKey="목표"
                                            position="top"
                                            content={({ x, y, width, value }) => {
                                              if (value == null) return null;
                                              return (
                                                <text x={x + width / 2} y={y - 4} textAnchor="middle" fontSize={11.5} fill="#1e293b" fontWeight={600}>
                                                  {value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{unit ? ` ${unit}` : ''}
                                                </text>
                                              );
                                            }}
                                          />
                                        </Bar>
                                        <Bar dataKey="실적" name="실적 절감액" fill={color} activeBar={false}>
                                          <LabelList
                                            dataKey="실적"
                                            position="top"
                                            content={({ x, y, width, value }) => {
                                              if (value == null) return null;
                                              return (
                                                <text x={x + width / 2} y={y - 4} textAnchor="middle" fontSize={11.5} fill="#1e293b" fontWeight={600}>
                                                  {value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{unit ? ` ${unit}` : ''}
                                                </text>
                                              );
                                            }}
                                          />
                                        </Bar>
                                      </BarChart>
                                    </ResponsiveContainer>
                                  </div>
                                ))}
                              </ExecPerfCardBody>
                            </ExecPerfCard>
                          );
                        })}
                      </ExecPerfGrid>
                    </ExecPanelBody>
                    ) : (
                    <ExecPanelBody style={{ padding: '0.75rem 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {executiveBusinessPerf.detailedByDivision.map(({ division, cards }) => {
                        const color = EXEC_DIV_COLORS[division] || '#94a3b8';
                        return (
                          <div key={division}>
                            <ExecPerfCardHeader $color={color} style={{ marginBottom: '0.5rem', borderRadius: '0.5rem', border: `1px solid ${color}40` }}>
                              {execDivDisplayName(division)}
                              <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500, marginLeft: 'auto' }}>
                                {cards.length}개 카드
                              </span>
                            </ExecPerfCardHeader>
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                              gap: '0.75rem'
                            }}>
                              {cards.map(card => {
                                // 단위가 둘 이상이면 차트를 나눠 그린다. 하나면 지금까지와 똑같이 보인다.
                                const showUnitCaption = card.unitCharts.length > 1;
                                // 카드 달성률: 소분류들의 목표·실적 절감액을 그대로 합쳐서 낸다.
                                // 분모는 세운 목표 전부 — 실적이 없는 소분류의 목표도 든다.
                                const allSubs = card.unitCharts.flatMap(c => c.subcategories);
                                const cardRate = execAchievementRate({
                                  targetSaving: allSubs.reduce((n, s) => n + Math.abs(s.targetSaving || 0), 0),
                                  actualSaving: allSubs.reduce((n, s) => n + Math.abs(s.actualSaving || 0), 0)
                                });
                                const rateColor = cardRate == null ? '#94a3b8'
                                                : cardRate >= 100 ? '#10b981'
                                                : cardRate >= 70 ? '#f59e0b' : '#ef4444';
                                return (
                                  <div key={card.cardId} style={{
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '0.55rem',
                                    overflow: 'hidden',
                                    background: 'white'
                                  }}>
                                    <div style={{
                                      padding: '0.5rem 0.75rem',
                                      borderBottom: '1px solid #f1f5f9',
                                      background: '#fafbfc',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.5rem'
                                    }}>
                                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {card.cardName}
                                      </div>
                                      {cardRate != null && (
                                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: rateColor }}
                                          title="세운 목표 전부 대비 실적입니다">
                                          달성률 {cardRate.toFixed(1)}%
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ padding: '0.4rem 0.3rem' }}>
                                      {card.unitCharts.length === 0 ? (
                                        <ExecPerfEmpty style={{ padding: '1.5rem 0.5rem' }}>
                                          소분류 데이터 없음
                                        </ExecPerfEmpty>
                                      ) : card.unitCharts.map(({ unit, subcategories, axis }) => (
                                        <div key={unit || '(단위없음)'}>
                                          {showUnitCaption && (
                                            <div style={{
                                              margin: '0.2rem 0 0.1rem', paddingLeft: 40,
                                              fontSize: 10.5, fontWeight: 700, color: '#475569'
                                            }}>
                                              <span style={{
                                                padding: '1px 7px', borderRadius: 999,
                                                background: '#eef2ff', color: '#3730a3', border: '1px solid #c7d2fe'
                                              }}>
                                                {unit || '단위 없음'}
                                              </span>
                                            </div>
                                          )}
                                          <ResponsiveContainer width="100%" height={210}>
                                            <BarChart
                                              data={subcategories}
                                              margin={{ top: 24, right: 10, left: 0, bottom: 4 }}
                                              barCategoryGap="22%"
                                              style={{ cursor: 'pointer' }}
                                              onClick={(e) => {
                                                if (!e) return;
                                                let sub = e?.activePayload?.[0]?.payload;
                                                if (!sub && e?.activeLabel) {
                                                  sub = subcategories.find(s => s.name === e.activeLabel);
                                                }
                                                // sourceRows 는 집계할 때 이미 만들어 두었다 —
                                                // 여기서 다시 만들면 월별실적 같은 규칙이 갈린다.
                                                if (sub) setPerfDetailModal({
                                                  division,
                                                  item: { ...sub, fullName: `${card.cardName} · ${sub.fullName}`, logic: card.logic }
                                                });
                                              }}
                                            >
                                              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                                              <XAxis
                                                dataKey="name"
                                                tick={{ fontSize: 11, fill: '#64748b' }}
                                                interval={0}
                                              />
                                              <YAxis
                                                tick={{ fontSize: 11, fill: '#64748b' }}
                                                width={44}
                                                domain={axis ? [0, axis.max] : [0, 'auto']}
                                                ticks={axis ? axis.ticks : undefined}
                                                allowDataOverflow={false}
                                              />
                                              <RechartsTooltip
                                                contentStyle={{ fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px' }}
                                                content={({ active, payload }) => {
                                                  if (!active || !payload || !payload.length) return null;
                                                  const sub = payload[0].payload;
                                                  const u = unit || '';
                                                  const absFmt = (n) => n == null ? '–' : `${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}${u ? ' ' + u : ''}`;
                                                  return (
                                                    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px', fontSize: 12, minWidth: 200 }}>
                                                      <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>{sub.fullName}</div>
                                                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                                        <span style={{ color: '#64748b' }}>목표 절감액</span>
                                                        <span style={{ fontWeight: 700, color: '#1e293b' }}>{absFmt(sub.targetSaving)}</span>
                                                      </div>
                                                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                                        <span style={{ color: '#64748b' }}>실적 절감액</span>
                                                        <span style={{ fontWeight: 700, color: '#1e293b' }}>{absFmt(sub.actualSaving)}</span>
                                                      </div>
                                                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 3, paddingTop: 3, borderTop: '1px solid #f1f5f9', color: '#94a3b8' }}>
                                                        <span>집계 대상</span>
                                                        <span>목표 {sub.tcPairCount} · 실적 {sub.acPairCount}</span>
                                                      </div>
                                                    </div>
                                                  );
                                                }}
                                              />
                                              <RechartsLegend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                                              <Bar
                                                dataKey="목표"
                                                name="목표 절감액"
                                                fill="#94a3b8"
                                                activeBar={false}
                                              >
                                                <LabelList
                                                  dataKey="목표"
                                                  position="top"
                                                  content={({ x, y, width, value }) => {
                                                    if (value == null) return null;
                                                    return (
                                                      <text x={x + width / 2} y={y - 4} textAnchor="middle" fontSize={10.5} fill="#1e293b" fontWeight={600}>
                                                        {value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{unit ? ` ${unit}` : ''}
                                                      </text>
                                                    );
                                                  }}
                                                />
                                              </Bar>
                                              <Bar
                                                dataKey="실적"
                                                name="실적 절감액"
                                                fill={color}
                                                activeBar={false}
                                              >
                                                <LabelList
                                                  dataKey="실적"
                                                  position="top"
                                                  content={({ x, y, width, value }) => {
                                                    if (value == null) return null;
                                                    return (
                                                      <text x={x + width / 2} y={y - 4} textAnchor="middle" fontSize={10.5} fill="#1e293b" fontWeight={600}>
                                                        {value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{unit ? ` ${unit}` : ''}
                                                      </text>
                                                    );
                                                  }}
                                                />
                                              </Bar>
                                            </BarChart>
                                          </ResponsiveContainer>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </ExecPanelBody>
                  )}
                </ExecPanel>
              </ExecPerfFullRow>

              {aiProgressModal && aiProgressDrillData && (() => {
                const dd = aiProgressDrillData;
                const fmtMD = (date) => `${date.getMonth() + 1}/${date.getDate()}`;
                const scopeLabel = dd.scope === 'process'
                  ? `${execDivDisplayName(executiveSelectedDivision)} · 전 프로세스`
                  : '전 사업부';
                const fmtDelta = (v) => v == null ? '–' : v === 0 ? '0' : `${v > 0 ? '▲' : '▼'}${Math.abs(v).toFixed(1)}`;
                const dColor = (v) => v == null || v === 0 ? '#94a3b8' : v > 0 ? '#047857' : '#b91c1c';

                const ItemRow = ({ icon, iconColor, iconBg, label, it, dateText, last }) => (
                  <div style={{
                    padding: '0.4rem 0.85rem',
                    borderBottom: last ? 'none' : '1px solid #f8fafc',
                    display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem'
                  }}>
                    <span style={{
                      padding: '0.1rem 0.45rem', background: iconBg, color: iconColor,
                      fontWeight: 700, borderRadius: '0.3rem', fontSize: '0.7rem',
                      flexShrink: 0, minWidth: 44, textAlign: 'center'
                    }}>{icon} {label}</span>
                    <span style={{
                      flexShrink: 0, fontSize: '0.68rem', fontWeight: 700, color: it.color,
                      background: `${it.color}1a`, padding: '0.05rem 0.4rem', borderRadius: '0.3rem'
                    }}>{it.series}</span>
                    <span style={{ color: '#475569', fontSize: '0.74rem', flexShrink: 0, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.과제명}</span>
                    <span style={{ flex: 1, color: '#1e293b' }}>{it.title}</span>
                    <span style={{ color: '#94a3b8', fontSize: '0.74rem', whiteSpace: 'nowrap' }}>{dateText}</span>
                  </div>
                );

                return (
                  <div
                    onClick={() => setAiProgressModal(null)}
                    style={{
                      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem'
                    }}
                  >
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        background: 'white', borderRadius: '0.75rem', maxWidth: 980, width: '100%',
                        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden'
                      }}
                    >
                      {/* 헤더 */}
                      <div style={{
                        padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: 2 }}>
                            {currentYear}년 · {dd.week}주차 (~{fmtMD(dd.weekEnd)} 기준) · 액션아이템 진척률
                          </div>
                          <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            📈 {scopeLabel}
                          </div>
                        </div>
                        <button
                          onClick={() => setAiProgressModal(null)}
                          style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: '#94a3b8', cursor: 'pointer', padding: '0.25rem 0.5rem' }}
                        >×</button>
                      </div>

                      <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
                        {/* 전 사업부 진척률 요약 테이블 */}
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.6rem' }}>
                          {dd.scope === 'process' ? '프로세스별 진척률' : '사업부별 진척률'} · 이 시점
                        </div>
                        {dd.entries.length === 0 ? (
                          <div style={{ padding: '1.5rem', color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center' }}>표시할 데이터가 없습니다.</div>
                        ) : (
                          <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', overflow: 'hidden', marginBottom: '1.5rem' }}>
                            <div style={{
                              display: 'grid', gridTemplateColumns: '1.4fr 1.6fr 0.8fr 0.8fr 0.9fr',
                              gap: '0.5rem', padding: '0.5rem 0.85rem', background: '#f8fafc',
                              borderBottom: '1px solid #e2e8f0', fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8'
                            }}>
                              <span>{dd.scope === 'process' ? '프로세스' : '사업부'}</span>
                              <span>진척률 (전주 대비)</span>
                              <span style={{ textAlign: 'center' }}>이번주 완료</span>
                              <span style={{ textAlign: 'center' }}>이번주 지연</span>
                              <span style={{ textAlign: 'right' }}>누적 완료</span>
                            </div>
                            {dd.entries.map((e, i) => {
                              const highlighted = e.key === dd.clickedKey;
                              return (
                                <div key={e.key} style={{
                                  display: 'grid', gridTemplateColumns: '1.4fr 1.6fr 0.8fr 0.8fr 0.9fr',
                                  gap: '0.5rem', padding: '0.5rem 0.85rem', alignItems: 'center',
                                  borderBottom: i === dd.entries.length - 1 ? 'none' : '1px solid #f1f5f9',
                                  background: highlighted ? `${e.color}12` : 'transparent', fontSize: '0.82rem'
                                }}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: '#1e293b' }}>
                                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: e.color, flexShrink: 0 }} />
                                    {e.name}
                                    {highlighted && <span style={{ fontSize: '0.62rem', color: e.color }}>● 선택</span>}
                                  </span>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{ flex: 1, height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden', minWidth: 60 }}>
                                      <div style={{ width: `${e.curVal ?? 0}%`, height: '100%', background: e.color, borderRadius: 4 }} />
                                    </div>
                                    <span style={{ fontWeight: 700, color: '#475569', width: 38, textAlign: 'right' }}>{e.curVal == null ? '–' : `${e.curVal.toFixed(1)}%`}</span>
                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: dColor(e.delta), width: 50, textAlign: 'right' }}>{fmtDelta(e.delta)}{e.delta != null && e.delta !== 0 ? '%p' : ''}</span>
                                  </span>
                                  <span style={{ textAlign: 'center', fontWeight: 700, color: e.completedThisWeek.length ? '#047857' : '#cbd5e1' }}>{e.completedThisWeek.length}</span>
                                  <span style={{ textAlign: 'center', fontWeight: 700, color: e.newlyDueThisWeek.length ? '#b91c1c' : '#cbd5e1' }}>{e.newlyDueThisWeek.length}</span>
                                  <span style={{ textAlign: 'right', fontSize: '0.76rem', color: '#64748b' }}>{e.cumCompleted}/{e.cumTotal}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* 이번 주 변동 요인 (전 사업부 합산, 2열) */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#047857', marginBottom: '0.5rem' }}>
                              ▲ 이번 주 완료 ({dd.allCompleted.length})
                            </div>
                            <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', overflow: 'hidden' }}>
                              {dd.allCompleted.length === 0 ? (
                                <div style={{ padding: '0.85rem', color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center' }}>이번 주 완료된 액션아이템이 없습니다.</div>
                              ) : dd.allCompleted.map((it, i) => (
                                <ItemRow key={i} icon="✅" label="완료" iconColor="#10b981" iconBg="#d1fae5"
                                  it={it} dateText={it.완료일 ? `완료 ${it.완료일}` : ''} last={i === dd.allCompleted.length - 1} />
                              ))}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#b91c1c', marginBottom: '0.5rem' }}>
                              ▼ 이번 주 목표일 도래·미완료 ({dd.allNewlyDue.length})
                            </div>
                            <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', overflow: 'hidden' }}>
                              {dd.allNewlyDue.length === 0 ? (
                                <div style={{ padding: '0.85rem', color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center' }}>이번 주 새로 지연된 액션아이템이 없습니다.</div>
                              ) : dd.allNewlyDue.map((it, i) => (
                                <ItemRow key={i} icon="⚠️" label="지연" iconColor="#ef4444" iconBg="#fee2e2"
                                  it={it} dateText={it.목표일 ? `목표 ${it.목표일}` : ''} last={i === dd.allNewlyDue.length - 1} />
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {metricDetailModal && metricDetailData && (() => {
                const d = metricDetailData;
                const isAI = d.type === 'ai';
                const SectionTitle = ({ children }) => (
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1e293b', margin: '0 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>{children}</div>
                );
                const listEmpty = (t) => <div style={{ padding: '0.85rem', color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center' }}>{t}</div>;
                const ProjRow = ({ p, statusColor }) => (
                  <div {...projectRowProps(p)} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderLeft: `3px solid ${statusColor}`, borderRadius: '0.5rem', background: '#fff', cursor: 'pointer' }}>
                    <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.85rem' }}>{p.과제명}</span>
                    {p.사업부 && <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#3730a3', background: '#eef2ff', padding: '0.1rem 0.4rem', borderRadius: '0.3rem' }}>{p.사업부}</span>}
                    {p.reason && <span style={{ fontSize: '0.68rem', fontWeight: 700, color: p.reason === '삭제' ? '#b91c1c' : '#b45309', background: p.reason === '삭제' ? '#fee2e2' : '#fef3c7', padding: '0.1rem 0.45rem', borderRadius: '0.3rem' }}>{p.reason}</span>}
                    {p.과제PL && <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>PL: {p.과제PL}</span>}
                    {p.완료일 && <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>완료 {p.완료일}</span>}
                    {p.진행상태 && <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#475569', background: '#f1f5f9', padding: '0.1rem 0.45rem', borderRadius: '0.3rem' }}>{p.진행상태}</span>}
                    <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>{percentText(p.진행률)}</span>
                  </div>
                );
                const AIRow = ({ a, statusColor }) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderLeft: `3px solid ${statusColor}`, borderRadius: '0.5rem', background: '#fff' }}>
                    <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.83rem' }}>{a.title}</span>
                    <span style={{ fontSize: '0.72rem', color: '#6366f1', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }} title={a.과제명}>
                      <FolderOpen size={11} />{a.과제명}
                    </span>
                    {a.사업부 && <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#3730a3', background: '#eef2ff', padding: '0.1rem 0.4rem', borderRadius: '0.3rem' }}>{a.사업부}</span>}
                    {a.reason && <span style={{ fontSize: '0.68rem', fontWeight: 700, color: a.reason === '삭제' ? '#b91c1c' : '#b45309', background: a.reason === '삭제' ? '#fee2e2' : '#fef3c7', padding: '0.1rem 0.45rem', borderRadius: '0.3rem' }}>{a.reason}</span>}
                    {a.목표일 && <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>목표 {a.목표일}</span>}
                    <span style={{ marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 700, color: a.완료여부 ? '#059669' : '#94a3b8' }}>{a.완료여부 ? (a.완료일 ? `완료 ${a.완료일}` : '완료') : '미완료'}</span>
                  </div>
                );
                const deltaGroups = isAI ? d.aiDeltaGroups : d.deltaGroups;

                return (
                  <div onClick={() => setMetricDetailModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: '0.75rem', width: '80vw', height: '82vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
                      <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: 2 }}>
                            {currentYear}년 · {executiveRefLabel} 대비 · {executiveSelectedDivision === 'all' ? '전체 사업부' : executiveSelectedDivision}
                          </div>
                          <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1e293b' }}>
                            📋 {d.title} <span style={{ color: '#64748b', fontWeight: 600, fontSize: '0.95rem' }}>({d.total}{d.unit})</span>
                          </div>
                        </div>
                        <button onClick={() => setMetricDetailModal(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: '#94a3b8', cursor: 'pointer', padding: '0.25rem 0.5rem' }}>×</button>
                      </div>
                      <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
                        {/* 변동 내역 (델타) */}
                        <SectionTitle>🔺 변동 내역 ({executiveRefLabel} 이후)</SectionTitle>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
                          {deltaGroups.map(g => (
                            <div key={g.label}>
                              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>{g.label} ({g.items.length})</div>
                              {g.items.length === 0 ? listEmpty(g.empty) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                  {g.items.map(it => isAI ? <AIRow key={it.id} a={it} statusColor={g.statusColor} /> : <ProjRow key={it.id} p={it} statusColor={g.statusColor} />)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        {/* 전체 목록 */}
                        <SectionTitle>📄 전체 목록 ({d.total})</SectionTitle>
                        {isAI ? (
                          d.allAI.length === 0 ? listEmpty('액션아이템이 없습니다.') : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              {d.allAI.map(a => <AIRow key={a.id} a={a} statusColor="#0ea5e9" />)}
                            </div>
                          )
                        ) : (
                          d.allProjects.length === 0 ? listEmpty('과제가 없습니다.') : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              {d.allProjects.map(p => <ProjRow key={p.id} p={p} statusColor={d.type === 'completed' ? '#3b82f6' : '#6366f1'} />)}
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {divisionDetailModal && divisionDetailData && (() => {
                const d = divisionDetailData;
                const m = d.metrics;
                const divColor = EXEC_DIV_COLORS[d.division] || '#94a3b8';
                const fmtCntDelta = (v) => v === 0 ? '–' : `${v > 0 ? '↑' : '↓'}${Math.abs(v)}`;
                const fmtPctDelta = (v) => v === 0 ? '–' : `${v > 0 ? '↑' : '↓'}${Math.abs(v).toFixed(1)}%p`;
                const deltaColor = (v) => v > 0 ? '#047857' : v < 0 ? '#b91c1c' : '#94a3b8';
                const deltaBg = (v) => v > 0 ? '#d1fae5' : v < 0 ? '#fee2e2' : '#f1f5f9';

                const SectionTitle = ({ children }) => (
                  <div style={{
                    fontSize: '0.95rem', fontWeight: 800, color: '#1e293b',
                    margin: '0 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem'
                  }}>{children}</div>
                );

                const DeltaBadge = ({ value, text }) => (
                  <span style={{
                    fontSize: '0.72rem', fontWeight: 700, padding: '0.1rem 0.4rem',
                    borderRadius: '0.3rem', color: deltaColor(value), background: deltaBg(value),
                    whiteSpace: 'nowrap'
                  }}>{text}</span>
                );

                const metricCards = [
                  { label: '총 과제', value: m.totalProjects, unit: '개', delta: m.deltaTotalProjects, deltaText: fmtCntDelta(m.deltaTotalProjects), accent: '#6366f1' },
                  { label: '완료 과제', value: m.currentCompletedProjects, unit: `/ ${m.totalProjects}개`, delta: m.deltaCompletedProjects, deltaText: fmtCntDelta(m.deltaCompletedProjects), accent: '#10b981' },
                  { label: '총 액션아이템', value: m.totalAI, unit: '개', delta: m.totalAI - m.refTotalAI, deltaText: fmtCntDelta(m.totalAI - m.refTotalAI), accent: '#0ea5e9' },
                  { label: '액션아이템 진척률', value: m.currentAvgProgress.toFixed(1), unit: '%', delta: m.deltaAvgProgress, deltaText: fmtPctDelta(m.deltaAvgProgress), accent: '#f59e0b' },
                  { label: '목표 일정 달성률', value: m.currentAchievementRate.toFixed(1), unit: '%', delta: m.deltaAchievementRate, deltaText: fmtPctDelta(m.deltaAchievementRate), accent: '#8b5cf6', sub: `완료 ${m.currentAchieved} / 도래 ${m.currentPlannedByToday}` }
                ];

                const projChip = (label, count, color, bg) => (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                    padding: '0.25rem 0.6rem', borderRadius: '0.5rem',
                    background: bg, color, fontSize: '0.78rem', fontWeight: 700
                  }}>{label}<span style={{
                    background: 'white', color, padding: '0.02rem 0.4rem',
                    borderRadius: '0.3rem', fontSize: '0.72rem'
                  }}>{count}</span></span>
                );

                const ProjectList = ({ items, emptyText, statusColor }) => (
                  items.length === 0 ? (
                    <div style={{ padding: '0.85rem', color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center' }}>{emptyText}</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {items.map(p => (
                        <div key={p.id} {...projectRowProps(p)} style={{
                          display: 'flex', alignItems: 'center', gap: '0.6rem',
                          padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0',
                          borderLeft: `3px solid ${statusColor}`, borderRadius: '0.5rem', background: '#fff',
                          cursor: 'pointer'
                        }}>
                          <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.85rem' }}>{p.과제명}</span>
                          {p.reason && (
                            <span style={{
                              fontSize: '0.68rem', fontWeight: 700,
                              color: p.reason === '삭제' ? '#b91c1c' : '#b45309',
                              background: p.reason === '삭제' ? '#fee2e2' : '#fef3c7',
                              padding: '0.1rem 0.45rem', borderRadius: '0.3rem'
                            }}>{p.reason}</span>
                          )}
                          {p.과제PL && <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>PL: {p.과제PL}</span>}
                          {p.완료일 && <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>완료 {p.완료일}</span>}
                          {p.진행상태 && (
                            <span style={{
                              fontSize: '0.7rem', fontWeight: 600, color: '#475569',
                              background: '#f1f5f9', padding: '0.1rem 0.45rem', borderRadius: '0.3rem'
                            }}>{p.진행상태}</span>
                          )}
                          <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>{percentText(p.진행률)}</span>
                        </div>
                      ))}
                    </div>
                  )
                );

                const AI_META = {
                  added:     { label: '신규', color: '#7c3aed', bg: '#ede9fe', icon: '🆕' },
                  excluded:  { label: '제외', color: '#64748b', bg: '#f1f5f9', icon: '🗑️' }
                };

                return (
                  <div
                    onClick={() => setDivisionDetailModal(null)}
                    style={{
                      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        background: 'white', borderRadius: '0.75rem',
                        width: '80vw', height: '82vh',
                        display: 'flex', flexDirection: 'column',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden'
                      }}
                    >
                      {/* 헤더 */}
                      <div style={{
                        padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: 2 }}>
                            {currentYear}년 · {executiveRefLabel} 대비 변경 현황
                          </div>
                          <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ width: 12, height: 12, borderRadius: '50%', background: divColor }} />
                            📊 {execDivDisplayName(d.division)}
                          </div>
                        </div>
                        <button
                          onClick={() => setDivisionDetailModal(null)}
                          style={{
                            background: 'none', border: 'none', fontSize: '1.5rem',
                            color: '#94a3b8', cursor: 'pointer', padding: '0.25rem 0.5rem'
                          }}
                        >×</button>
                      </div>

                      {/* 본문 */}
                      <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
                        {/* 전체현황 */}
                        <SectionTitle>📈 전체현황</SectionTitle>
                        <div style={{
                          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                          gap: '0.75rem', marginBottom: '1.75rem'
                        }}>
                          {metricCards.map(c => (
                            <div key={c.label} style={{
                              border: '1px solid #e2e8f0', borderTop: `3px solid ${c.accent}`,
                              borderRadius: '0.6rem', padding: '0.85rem', background: '#fff'
                            }}>
                              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.4rem' }}>{c.label}</div>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
                                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', lineHeight: 1 }}>{c.value}</span>
                                <span style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600 }}>{c.unit}</span>
                              </div>
                              <div style={{ marginTop: '0.5rem' }}>
                                <DeltaBadge value={c.delta} text={c.deltaText} />
                              </div>
                              {c.sub && (
                                <div style={{ marginTop: '0.4rem', fontSize: '0.72rem', fontWeight: 600, color: '#64748b' }}>
                                  {c.sub}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* 과제 변경 현황 */}
                        <SectionTitle>🗂️ 과제 변경 현황</SectionTitle>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
                          {projChip('신규 추가', d.addedProjects.length, '#047857', '#d1fae5')}
                          {projChip('삭제·취소', d.removedProjects.length, '#b91c1c', '#fee2e2')}
                        </div>
                        <div style={{
                          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                          gap: '1rem', marginBottom: '1.75rem'
                        }}>
                          <div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#047857', marginBottom: '0.5rem' }}>＋ 신규 추가 ({d.addedProjects.length})</div>
                            <ProjectList items={d.addedProjects} emptyText="신규 추가된 과제가 없습니다." statusColor="#10b981" />
                          </div>
                          <div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#b91c1c', marginBottom: '0.5rem' }}>－ 삭제·취소 ({d.removedProjects.length})</div>
                            <ProjectList items={d.removedProjects} emptyText="삭제·취소된 과제가 없습니다." statusColor="#ef4444" />
                          </div>
                        </div>

                        {/* 완료 과제 현황 */}
                        <SectionTitle>✅ 완료 과제</SectionTitle>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
                          {projChip(`${executiveRefLabel} 이후 완료`, d.completedInPeriod.length, '#047857', '#d1fae5')}
                          {projChip('전체 완료', d.completedAll.length, '#1d4ed8', '#dbeafe')}
                        </div>
                        <div style={{
                          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                          gap: '1rem', marginBottom: '1.75rem'
                        }}>
                          <div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#047857', marginBottom: '0.5rem' }}>🗓️ {executiveRefLabel} 이후 완료 ({d.completedInPeriod.length})</div>
                            <ProjectList items={d.completedInPeriod} emptyText="해당 기간에 완료된 과제가 없습니다." statusColor="#10b981" />
                          </div>
                          <div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1d4ed8', marginBottom: '0.5rem' }}>🏁 전체 완료 ({d.completedAll.length})</div>
                            <ProjectList items={d.completedAll} emptyText="완료된 과제가 없습니다." statusColor="#3b82f6" />
                          </div>
                        </div>

                        {/* 액션아이템 변경 현황 */}
                        <SectionTitle>✔️ 액션아이템 변경 현황</SectionTitle>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
                          {projChip('신규 추가', d.aiStats.added, AI_META.added.color, AI_META.added.bg)}
                          {projChip('제외(삭제·취소)', d.aiStats.excluded, AI_META.excluded.color, AI_META.excluded.bg)}
                        </div>
                        {/* 총 액션아이템 변화량 = 신규 − 제외 (전체현황 카드의 ↑변화량과 일치) */}
                        <div style={{
                          fontSize: '0.78rem', color: '#475569', marginBottom: '0.85rem',
                          padding: '0.4rem 0.7rem', background: '#f8fafc', border: '1px solid #e2e8f0',
                          borderRadius: '0.4rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem'
                        }}>
                          총 액션아이템 변화량
                          <strong style={{ color: (m.totalAI - m.refTotalAI) >= 0 ? '#047857' : '#b91c1c' }}>
                            {(m.totalAI - m.refTotalAI) > 0 ? '+' : ''}{m.totalAI - m.refTotalAI}
                          </strong>
                          <span style={{ color: '#94a3b8' }}>= 신규 {d.aiStats.added} − 제외 {d.aiStats.excluded}</span>
                        </div>
                        {d.aiChanges.length === 0 ? (
                          <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                            {executiveRefLabel} 이후 변경된 액션아이템이 없습니다.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {d.aiChanges.map(p => {
                              const rows = p.items;
                              const Badge = ({ k }) => {
                                const meta = AI_META[k];
                                return (
                                  <span style={{
                                    padding: '0.1rem 0.45rem', background: meta.bg, color: meta.color,
                                    fontWeight: 700, borderRadius: '0.3rem', fontSize: '0.7rem',
                                    flexShrink: 0, textAlign: 'center', whiteSpace: 'nowrap'
                                  }}>{meta.icon} {meta.label}</span>
                                );
                              };
                              return (
                                <div key={p.id} style={{ border: '1px solid #e2e8f0', borderRadius: '0.6rem', overflow: 'hidden' }}>
                                  {/* 카드 머리만 누를 수 있게 한다 — 아래 액션아이템 목록에는
                                      각자의 클릭이 있을 수 있어 카드 전체를 덮지 않는다 */}
                                  <div {...projectRowProps(p)} style={{
                                    padding: '0.55rem 0.85rem', background: '#f8fafc',
                                    borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '0.6rem',
                                    cursor: 'pointer'
                                  }}>
                                    <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.9rem' }}>{p.과제명}</span>
                                    {p.reason && (
                                      <span style={{
                                        fontSize: '0.68rem', fontWeight: 700,
                                        color: p.reason === '삭제' ? '#b91c1c' : '#b45309',
                                        background: p.reason === '삭제' ? '#fee2e2' : '#fef3c7',
                                        padding: '0.1rem 0.45rem', borderRadius: '0.3rem'
                                      }}>{p.reason}</span>
                                    )}
                                    {p.과제PL && <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>PL: {p.과제PL}</span>}
                                    <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#94a3b8' }}>{rows.length}건</span>
                                  </div>
                                  <div>
                                    {rows.map((it, i) => {
                                      // 날짜 라벨: 제외는 목표일, 신규는 등록일
                                      const dateLabel = it.isExcluded
                                        ? (it.목표일 ? `목표 ${it.목표일}` : '목표일 없음')
                                        : (it.생성일 ? `등록 ${String(it.생성일).slice(0, 10)}` : '');
                                      return (
                                        <div key={i} style={{
                                          padding: '0.4rem 0.85rem',
                                          borderBottom: i < rows.length - 1 ? '1px solid #f8fafc' : 'none',
                                          display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.82rem'
                                        }}>
                                          <span style={{ display: 'inline-flex', gap: '0.25rem', flexShrink: 0 }}>
                                            {it.isNew && <Badge k="added" />}
                                            {it.isExcluded && <Badge k="excluded" />}
                                          </span>
                                          <span style={{ flex: 1, color: '#1e293b' }}>{it.title}</span>
                                          <span style={{ color: '#94a3b8', fontSize: '0.74rem', whiteSpace: 'nowrap' }}>
                                            {dateLabel}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {aiStatusModal && aiStatusModalData && (() => {
                const divColor = EXEC_DIV_COLORS[aiStatusModal.division] || '#94a3b8';
                const CAT_META = {
                  '완료':   { color: '#10b981', bg: '#d1fae5', icon: '✅' },
                  '조기달성': { color: '#3b82f6', bg: '#dbeafe', icon: '🌟' },
                  '계획':   { color: '#64748b', bg: '#f1f5f9', icon: '📋' },
                  '지연':   { color: '#ef4444', bg: '#fee2e2', icon: '⚠️' }
                };
                const filteredProjects = aiStatusModalData.projects.map(p => ({
                  ...p,
                  items: p.items.filter(i => aiModalFilter === 'all' || i.category === aiModalFilter)
                })).filter(p => p.items.length > 0);
                const totalFiltered = filteredProjects.reduce((s, p) => s + p.items.length, 0);

                return (
                  <div
                    onClick={() => setAiStatusModal(null)}
                    style={{
                      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        background: 'white', borderRadius: '0.75rem',
                        width: '80vw', height: '80vh',
                        display: 'flex', flexDirection: 'column',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden'
                      }}
                    >
                      <div style={{
                        padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: 2 }}>
                            {currentYear}년 · {executiveRefDate} 기준
                          </div>
                          <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ width: 12, height: 12, borderRadius: '50%', background: divColor }} />
                            📊 {execDivDisplayName(aiStatusModal.division)}
                            {aiStatusModal.process ? ` · ${aiStatusModal.process}` : ''}
                            {' · 액션아이템 상태 상세'}
                          </div>
                        </div>
                        <button
                          onClick={() => setAiStatusModal(null)}
                          style={{
                            background: 'none', border: 'none', fontSize: '1.5rem',
                            color: '#94a3b8', cursor: 'pointer', padding: '0.25rem 0.5rem'
                          }}
                        >×</button>
                      </div>

                      <div style={{
                        padding: '0.75rem 1.5rem', borderBottom: '1px solid #e2e8f0',
                        display: 'flex', gap: '0.5rem', background: '#fafbfc', flexWrap: 'wrap'
                      }}>
                        {[
                          { key: 'all', label: '전체', count: aiStatusModalData.projects.reduce((s, p) => s + p.items.length, 0), color: '#6366f1', bg: '#eef2ff' },
                          { key: '완료', label: '완료', count: aiStatusModalData.counts.완료, color: CAT_META.완료.color, bg: CAT_META.완료.bg },
                          { key: '조기달성', label: '조기달성', count: aiStatusModalData.counts.조기달성, color: CAT_META.조기달성.color, bg: CAT_META.조기달성.bg },
                          { key: '계획', label: '계획', count: aiStatusModalData.counts.계획, color: CAT_META.계획.color, bg: CAT_META.계획.bg },
                          { key: '지연', label: '지연', count: aiStatusModalData.counts.지연, color: CAT_META.지연.color, bg: CAT_META.지연.bg }
                        ].map(chip => {
                          const active = aiModalFilter === chip.key;
                          return (
                            <button
                              key={chip.key}
                              onClick={() => setAiModalFilter(chip.key)}
                              style={{
                                padding: '0.4rem 0.85rem',
                                background: active ? chip.color : chip.bg,
                                color: active ? 'white' : chip.color,
                                border: `1px solid ${active ? chip.color : 'transparent'}`,
                                borderRadius: '0.5rem',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem'
                              }}
                            >
                              {chip.label}
                              <span style={{
                                background: active ? 'rgba(255,255,255,0.25)' : 'white',
                                color: active ? 'white' : chip.color,
                                padding: '0.05rem 0.4rem',
                                borderRadius: '0.3rem',
                                fontSize: '0.72rem'
                              }}>
                                {chip.count}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem' }}>
                        {filteredProjects.length === 0 ? (
                          <div style={{ padding: '4rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
                            해당 카테고리의 액션아이템이 없습니다.
                          </div>
                        ) : (
                          <>
                            <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.75rem' }}>
                              {filteredProjects.length}개 과제 · {totalFiltered}개 액션아이템
                            </div>
                            {filteredProjects.map(p => (
                              <div key={p.id} style={{
                                marginBottom: '0.85rem',
                                border: '1px solid #e2e8f0',
                                borderRadius: '0.6rem',
                                overflow: 'hidden'
                              }}>
                                <div {...projectRowProps(p)} style={{
                                  padding: '0.55rem 0.85rem',
                                  background: '#f8fafc',
                                  borderBottom: '1px solid #f1f5f9',
                                  display: 'flex', alignItems: 'center', gap: '0.6rem',
                                  cursor: 'pointer'
                                }}>
                                  <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.9rem' }}>
                                    {p.과제명}
                                  </div>
                                  {p.과제PL && (
                                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                      PL: {p.과제PL}
                                    </div>
                                  )}
                                  <div style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#94a3b8' }}>
                                    {p.items.length}건
                                  </div>
                                </div>
                                <div>
                                  {p.items.map((it, i) => {
                                    const meta = CAT_META[it.category];
                                    return (
                                      <div key={i} style={{
                                        padding: '0.4rem 0.85rem',
                                        borderBottom: i < p.items.length - 1 ? '1px solid #f8fafc' : 'none',
                                        display: 'flex', alignItems: 'center', gap: '0.6rem',
                                        fontSize: '0.82rem'
                                      }}>
                                        <span style={{
                                          padding: '0.1rem 0.45rem',
                                          background: meta.bg,
                                          color: meta.color,
                                          fontWeight: 700,
                                          borderRadius: '0.3rem',
                                          fontSize: '0.7rem',
                                          flexShrink: 0,
                                          minWidth: 65,
                                          textAlign: 'center'
                                        }}>
                                          {meta.icon} {it.category}
                                        </span>
                                        <span style={{ flex: 1, color: '#1e293b' }}>{it.title}</span>
                                        <span style={{ color: '#94a3b8', fontSize: '0.74rem', whiteSpace: 'nowrap' }}>
                                          {it.category === '완료' || it.category === '조기달성'
                                            ? (it.완료일 ? `완료 ${it.완료일}` : '')
                                            : (it.목표일 ? `목표 ${it.목표일}` : '목표일 없음')}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {perfDetailModal && (() => {
                const { division, item } = perfDetailModal;
                const color = EXEC_DIV_COLORS[division] || '#94a3b8';
                const u = item.unit || '';
                const fmt = (n) => n == null ? '–' : `${n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}${u ? ' ' + u : ''}`;
                const sourceRows = item.sourceRows || [];

                // 변화량도 목표·실적 칸과 같은 모양으로 적는다 (자릿수 + 단위, 아래에 raw).
                // 부호를 붙여 방향이 보이게 한다 — 실적이 목표와 반대로 갈 수도 있다.
                const signed = (d, unitText) => {
                  if (d === null) return '–';
                  const body = d.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
                  return `${d > 0 ? '+' : ''}${body}${unitText ? ' ' + unitText : ''}`;
                };
                const fmtDelta = (to, from) => signed(levelDelta(to, from), u);
                // 월별실적의 raw 실적은 12개월 합이다 (집계에서 쓰는 값과 같은 규칙).
                const rawActualNumber = (row) => {
                  if (row.isMonthly) {
                    const nums = (row.monthly || []).map(v => levelNumber(v)).filter(v => v !== null);
                    return nums.length === 0 ? null : nums.reduce((a, b) => a + b, 0);
                  }
                  return levelNumber(row.rawActual);
                };
                const rawDeltaText = (to, from, rawUnit) => signed(levelDelta(to, from), rawUnit);
                return (
                  <div
                    onClick={() => setPerfDetailModal(null)}
                    style={{
                      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
                      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem'
                    }}
                  >
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        // 열이 아홉이라(관련 과제 · 값 4칸 · 변화량 2칸 · 사용 여부 2칸)
                        // 1000px 에서는 과제명과 성과명이 서로 자리를 뺏는다. 창을 넓게 쓰되
                        // 좌우 여백(패딩 2rem)은 남긴다.
                        background: 'white', borderRadius: '0.75rem', maxWidth: 1500, width: '100%',
                        maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)'
                      }}
                    >
                      <div style={{
                        padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: 2 }}>
                            {execDivDisplayName(division)} · {item.logic} 집계
                          </div>
                          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e293b' }}>
                            🔍 {item.fullName}
                          </div>
                        </div>
                        <button
                          onClick={() => setPerfDetailModal(null)}
                          style={{
                            background: 'none', border: 'none', fontSize: '1.5rem', color: '#94a3b8',
                            cursor: 'pointer', padding: '0.25rem 0.5rem'
                          }}
                        >×</button>
                      </div>

                      <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>목표 절감액 (집계)</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: color }}>
                            {item.targetSaving == null
                              ? '–'
                              : `${Math.abs(item.targetSaving).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}${u ? ' ' + u : ''}`}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 2 }}>
                            모집단 {item.tcPairCount}개 (목표·현재 모두 유효)
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>실적 절감액 (집계)</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: color }}>
                            {item.actualSaving == null
                              ? '–'
                              : `${Math.abs(item.actualSaving).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}${u ? ' ' + u : ''}`}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 2 }}>
                            모집단 {item.acPairCount}개 (실적·현재 모두 유효)
                          </div>
                        </div>
                        {/* 달성률의 분모는 **세운 목표 전부**다 — 실적이 아직 없는
                            성과의 목표도 든다. 그래서 위 두 모집단이 달라도 그대로 나눈다. */}
                        <div>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>달성률</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: color }}>
                            {execAchievementRate(item) == null
                              ? '–'
                              : `${execAchievementRate(item).toFixed(1)}%`}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 2 }}>
                            실적 ÷ 목표 (실적 미기입 성과의 목표도 분모에 듦)
                          </div>
                        </div>
                      </div>

                      <div style={{ overflowY: 'auto', padding: '0.75rem 1.25rem 1rem' }}>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem', fontWeight: 600 }}>
                          소스 성과 항목 · 총 {sourceRows.length}건
                          {' '}<span style={{ color: '#94a3b8', fontWeight: 400 }}>(단위 환산: {u || '없음'})</span>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                          <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                            <tr>
                              <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>성과 항목</th>
                              <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>관련 과제</th>
                              <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right', borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>현재</th>
                              <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right', borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>목표</th>
                              <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right', borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: 700 }} title="목표 − 현재 : 목표까지 만들어야 할 변화량">목표 변화량</th>
                              <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right', borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>실적</th>
                              <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right', borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: 700 }} title="실적 − 현재 : 지금까지 실제로 만든 변화량">실적 변화량</th>
                              <th style={{ padding: '0.4rem 0.5rem', textAlign: 'center', borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>목표Δ 사용</th>
                              <th style={{ padding: '0.4rem 0.5rem', textAlign: 'center', borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>실적Δ 사용</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sourceRows.map(row => (
                              <tr key={row.key}>
                                <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                                  <div style={{ color: '#1e293b' }}>{row.name}</div>
                                  <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                                    원단위: {row.rawUnit || '–'}{row.rawUnit !== row.convUnit ? ` → ${row.convUnit}` : ''}
                                    {row.isMonthly ? ' · 월별실적' : ''}
                                  </div>
                                </td>
                                {/* 관련 과제 — 「모든 성과 항목」 카드 모달과 같이 눌러서 과제 상세로 간다 */}
                                <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #f1f5f9', maxWidth: 320 }}>
                                  {(row.projects || []).length === 0
                                    ? <span style={{ color: '#cbd5e1' }}>–</span>
                                    : row.projects.map((proj, i) => (
                                        <React.Fragment key={proj.id || proj.uuid || i}>
                                          {i > 0 && <span style={{ color: '#cbd5e1' }}>, </span>}
                                          <span
                                            onClick={() => { setPerfDetailModal(null); openProjectDetail(proj); }}
                                            title="클릭하면 과제 상세를 봅니다"
                                            style={{ color: '#4f46e5', cursor: 'pointer', textDecoration: 'underline' }}
                                          >
                                            {proj.과제명}
                                          </span>
                                        </React.Fragment>
                                      ))}
                                </td>
                                <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>
                                  <div>{fmt(row.current)}</div>
                                  <div style={{ fontSize: '0.66rem', color: '#cbd5e1' }}>raw: {row.rawCurrent ?? '–'}</div>
                                </td>
                                <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>
                                  <div>{fmt(row.target)}</div>
                                  <div style={{ fontSize: '0.66rem', color: '#cbd5e1' }}>raw: {row.rawTarget ?? '–'}</div>
                                </td>
                                {/* 변화량은 **환산 후 값**으로 뺀다 — 옆 칸에 보이는 숫자와 맞아야 한다.
                                    아래 raw 는 원단위끼리 뺀 값이라 위 숫자와 자리수가 다르다. */}
                                <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #f1f5f9', textAlign: 'right', fontWeight: 600 }}>
                                  <div>{fmtDelta(row.target, row.current)}</div>
                                  <div style={{ fontSize: '0.66rem', color: '#cbd5e1', fontWeight: 400 }}>
                                    raw: {rawDeltaText(levelNumber(row.rawTarget), levelNumber(row.rawCurrent), row.rawUnit)}
                                  </div>
                                </td>
                                <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>
                                  <div>{fmt(row.actual)}</div>
                                  <div style={{ fontSize: '0.66rem', color: '#cbd5e1' }}>
                                    raw: {row.isMonthly
                                      ? (Array.isArray(row.monthly) ? `[${row.monthly.map(v => v ?? '').join(', ')}]` : '–')
                                      : (row.rawActual ?? '–')}
                                  </div>
                                </td>
                                <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #f1f5f9', textAlign: 'right', fontWeight: 600 }}>
                                  <div>{fmtDelta(row.actual, row.current)}</div>
                                  <div style={{ fontSize: '0.66rem', color: '#cbd5e1', fontWeight: 400 }}>
                                    raw: {rawDeltaText(rawActualNumber(row), levelNumber(row.rawCurrent), row.rawUnit)}
                                  </div>
                                </td>
                                <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #f1f5f9', textAlign: 'center', color: row.usedInTarget ? '#10b981' : '#cbd5e1', fontWeight: 700 }}>
                                  {row.usedInTarget ? '✓' : '✗'}
                                </td>
                                <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #f1f5f9', textAlign: 'center', color: row.usedInActual ? '#10b981' : '#cbd5e1', fontWeight: 700 }}>
                                  {row.usedInActual ? '✓' : '✗'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <ExecTwoColumnRow
                style={{ gridTemplateColumns: '1fr' }}
              >
                {/* 좌측: DX KPI 컨테이너 */}
                <ExecPanel>
                  <ExecPanelHeader>
                    <ExecPanelTitle>📊 DX 부문 KPI</ExecPanelTitle>
                    <ExecPanelSubtitle>
                      {executiveSelectedDivision === 'all' ? '전체 사업부' : executiveSelectedDivision} · 기준일 {executiveRefDate}
                    </ExecPanelSubtitle>
                  </ExecPanelHeader>
                  <ExecPanelBody style={{ padding: '0.75rem 0.75rem 0.75rem' }}>
                    {executiveSelectedDivision !== 'all' ? (
                      !executiveKpiTrend || executiveKpiTrend.length === 0 ? (
                        <ExecKpiPlaceholder>KPI 데이터가 없습니다.</ExecKpiPlaceholder>
                      ) : (
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                          gap: '0.75rem'
                        }}>
                          {executiveKpiTrend.map(kpi => {
                            const catColor = kpi.category === '개발' ? '#1d4ed8'
                                          : kpi.category === '제조' ? '#15803d'
                                          : kpi.category === '품질' ? '#b45309' : '#64748b';
                            const catBg = kpi.category === '개발' ? '#eff6ff'
                                        : kpi.category === '제조' ? '#f0fdf4'
                                        : kpi.category === '품질' ? '#fefce8' : '#f8fafc';
                            return (
                              <div key={kpi.label} style={{
                                border: '1px solid #e2e8f0',
                                borderRadius: '0.55rem',
                                overflow: 'hidden',
                                background: 'white'
                              }}>
                                <div style={{
                                  padding: '0.45rem 0.75rem',
                                  borderBottom: '1px solid #f1f5f9',
                                  background: '#fafbfc',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem'
                                }}>
                                  <span style={{
                                    fontSize: '0.7rem', fontWeight: 700,
                                    color: catColor, background: catBg,
                                    padding: '0.1rem 0.45rem', borderRadius: '0.3rem'
                                  }}>
                                    {kpi.category || '기타'}
                                  </span>
                                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {kpi.label}
                                  </div>
                                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                    {kpi.unit || ''}
                                  </span>
                                </div>
                                <div style={{ padding: '0.4rem 0.3rem' }}>
                                  <ResponsiveContainer width="100%" height={200}>
                                    <LineChart
                                      data={kpi.monthData}
                                      margin={{ top: 12, right: 12, left: 0, bottom: 4 }}
                                    >
                                      <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                                      <XAxis
                                        dataKey="month"
                                        tick={{ fontSize: 11, fill: '#64748b' }}
                                        interval={0}
                                      />
                                      <YAxis
                                        tick={{ fontSize: 11, fill: '#64748b' }}
                                        width={44}
                                        tickFormatter={(v) => v == null ? '' : Number(v).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                      />
                                      <RechartsTooltip
                                        contentStyle={{ fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px' }}
                                        formatter={(v, name) => [v == null ? '–' : `${Number(v).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}${kpi.unit || ''}`, name]}
                                      />
                                      <RechartsLegend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                                      <Line
                                        type="linear"
                                        dataKey="target"
                                        name="연간 목표"
                                        stroke="#94a3b8"
                                        strokeWidth={2}
                                        strokeDasharray="5 4"
                                        dot={{ r: 2.5, fill: '#94a3b8', strokeWidth: 0 }}
                                        activeDot={{ r: 4 }}
                                        connectNulls
                                      />
                                      <Line
                                        type="linear"
                                        dataKey="actual"
                                        name="실적"
                                        stroke="#6366f1"
                                        strokeWidth={2.5}
                                        dot={{ r: 3, fill: '#6366f1', strokeWidth: 0 }}
                                        activeDot={{ r: 5 }}
                                        connectNulls
                                      />
                                    </LineChart>
                                  </ResponsiveContainer>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )
                    ) : executiveKpiByDivision.divisions.length === 0 ? (
                      <ExecKpiPlaceholder>
                        KPI 데이터가 없습니다.
                      </ExecKpiPlaceholder>
                    ) : (
                      <ExecKpiDivGrid>
                        {executiveKpiByDivision.divisions.map(({ division, kpis }) => {
                          const divColor = EXEC_DIV_COLORS[division] || '#64748b';
                          const divBg = `${divColor}15`;
                          return (
                            <ExecKpiDivBox key={division}>
                              <ExecKpiDivHeader $color={divColor} $bg={divBg}>
                                <span>{execDivDisplayName(division)}</span>
                              </ExecKpiDivHeader>
                              <div style={{ overflowX: 'auto' }}>
                              <ExecKpiDivTable>
                                <thead>
                                  <tr>
                                    <ExecKpiDivTh $align="center" $width="1%">구분</ExecKpiDivTh>
                                    <ExecKpiDivTh $align="center">KPI</ExecKpiDivTh>
                                    <ExecKpiDivTh $align="center" $width="1%" style={{ whiteSpace: 'nowrap', borderLeft: '1px solid #e2e8f0' }}>연간 목표</ExecKpiDivTh>
                                    <ExecKpiDivTh $align="center" $width="1%" style={{ whiteSpace: 'nowrap', borderLeft: '1px solid #e2e8f0' }}>실적</ExecKpiDivTh>
                                    <ExecKpiDivTh $align="center" $width="1%" style={{ whiteSpace: 'nowrap', borderLeft: '1px solid #e2e8f0' }}>달성률</ExecKpiDivTh>
                                  </tr>
                                </thead>
                                <tbody>
                                  {kpis.map((kpi, idx) => {
                                    const deltaUnit = kpi.unit === '%' ? '%p' : (kpi.unit || '');
                                    const catColor = kpi.category === '개발' ? '#1d4ed8'
                                                    : kpi.category === '제조' ? '#15803d'
                                                    : kpi.category === '품질' ? '#b45309'
                                                    : '#64748b';
                                    const catBg = kpi.category === '개발' ? '#eff6ff'
                                                : kpi.category === '제조' ? '#f0fdf4'
                                                : kpi.category === '품질' ? '#fefce8'
                                                : '#f8fafc';
                                    // 같은 카테고리 연속 그룹 → 첫 행에만 rowSpan 셀
                                    const isCatStart = idx === 0 || kpis[idx - 1].category !== kpi.category;
                                    let catSpan = 0;
                                    if (isCatStart) {
                                      catSpan = 1;
                                      for (let j = idx + 1; j < kpis.length && kpis[j].category === kpi.category; j++) catSpan++;
                                    }
                                    return (
                                      <tr key={kpi.label}>
                                        {isCatStart && (
                                          <ExecKpiDivCatCell
                                            rowSpan={catSpan}
                                            $color={catColor}
                                            $bg={catBg}
                                          >
                                            {kpi.category || '기타'}
                                          </ExecKpiDivCatCell>
                                        )}
                                        <ExecKpiDivTd $align="left" style={{ verticalAlign: 'top' }}>
                                          <ExecKpiDivKpiLabel title={kpi.label}>{kpi.label}</ExecKpiDivKpiLabel>
                                        </ExecKpiDivTd>
                                        <ExecKpiDivTd $align="right" style={{ whiteSpace: 'nowrap', borderLeft: '1px solid #f1f5f9', verticalAlign: 'top' }}>
                                          <ExecKpiDivCellMain>
                                            {kpi.target == null ? '–' : `${Number(kpi.target).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}${kpi.unit || ''}`}
                                          </ExecKpiDivCellMain>
                                        </ExecKpiDivTd>
                                        <ExecKpiDivTd
                                          $align="right"
                                          style={{ whiteSpace: 'nowrap', borderLeft: '1px solid #f1f5f9', verticalAlign: 'top' }}
                                        >
                                          <ExecKpiDivCellMain>
                                            {kpi.curNum == null ? '–' : `${Number(kpi.curNum).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}${kpi.unit || ''}`}
                                          </ExecKpiDivCellMain>
                                          {kpi.delta !== null && kpi.delta !== 0 ? (
                                            <div style={{
                                              /* 화살표는 값의 방향(사실), 색은 **좋고 나쁨**.
                                                 부호로만 칠하면 망소 지표(Lead Time·라인 유실률)가
                                                 좋아졌을 때 빨갛게 나온다. (2026-08-01 수정) */
                                              color: changeColor(
                                                changeOf(kpi.refNum, kpi.curNum, kpi.direction)),
                                              fontWeight: 600,
                                              fontSize: '0.84rem',
                                              lineHeight: 1.3
                                            }}>
                                              ({kpi.delta > 0 ? '↑' : '↓'}{Math.abs(kpi.delta).toFixed(1)}{deltaUnit})
                                              {kpi.refClamped && (
                                                <span
                                                  title={`기준일 이전 데이터 없음 — 최초 기록일(${kpi.refBaseDate}) 값 대비 변동`}
                                                  style={{ marginLeft: 2, color: '#f59e0b', cursor: 'help' }}
                                                >*</span>
                                              )}
                                            </div>
                                          ) : executiveKpiByDivision.labelsWithDelta.has(kpi.label) ? (
                                            <div style={{
                                              visibility: 'hidden',
                                              fontWeight: 600,
                                              fontSize: '0.84rem',
                                              lineHeight: 1.3
                                            }}>&nbsp;</div>
                                          ) : null}
                                        </ExecKpiDivTd>
                                        <ExecKpiDivTd $align="right" style={{ whiteSpace: 'nowrap', borderLeft: '1px solid #f1f5f9', verticalAlign: 'top' }}>
                                          <ExecKpiDivRate $rate={kpi.rate}>
                                            {kpi.rate == null ? '–' : `${kpi.rate.toFixed(1)}%`}
                                          </ExecKpiDivRate>
                                        </ExecKpiDivTd>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </ExecKpiDivTable>
                              </div>
                            </ExecKpiDivBox>
                          );
                        })}
                      </ExecKpiDivGrid>
                    )}
                    {executiveSelectedDivision === 'all' && executiveKpiByDivision.hasClampedDelta && (
                      <div style={{
                        marginTop: '0.6rem',
                        fontSize: '0.72rem',
                        color: '#b45309',
                        lineHeight: 1.4
                      }}>
                        <span style={{ color: '#f59e0b', fontWeight: 700 }}>*</span> 기준일 이전에 기록이 없어, 해당 KPI의 변동치는 <b>최초 기록일 값</b> 대비 산출되었습니다.
                      </div>
                    )}
                    {(() => {
                      const divs = (executiveSelectedDivision === 'all'
                        ? KPI_DIVISIONS
                        : [executiveSelectedDivision]
                      ).filter(d => (repCorps[d] || '').trim());
                      if (divs.length === 0) return null;
                      return (
                        <div style={{
                          marginTop: '0.6rem',
                          fontSize: '0.75rem',
                          color: '#475569',
                          lineHeight: 1.4
                        }}>
                          ※ 대표법인 : {divs.map(d => executiveSelectedDivision === 'all'
                            ? `${execDivDisplayName(d)} ${repCorps[d].trim()}`
                            : repCorps[d].trim()
                          ).join('   ·   ')}
                        </div>
                      );
                    })()}
                  </ExecPanelBody>
                </ExecPanel>

                {/* 기간 내 과제 진행 현황 패널은 위 ExecTwoColumnRow 로 이동 */}
                {false && (
                <ExecPanel>
                  <ExecPanelHeader>
                    <ExecPanelTitle>
                      🎯 기간 내 과제 상세 진행 현황 (액션아이템 기준)
                    </ExecPanelTitle>
                    <ExecPanelSubtitle>
                      {executiveRefDate} 이후 ~ 오늘
                    </ExecPanelSubtitle>
                  </ExecPanelHeader>
                  <ExecStatusFilterBar>
                    {[
                      { key: 'all',       label: '전체',     color: '#6366f1', count: executiveProjectStatus.stats.total },
                      { key: 'completed', label: '완료',     color: '#10b981', count: executiveProjectStatus.stats.completed },
                      { key: 'delayed',   label: '지연',     color: '#ef4444', count: executiveProjectStatus.stats.delayed },
                      { key: 'early',     label: '조기 달성', color: '#3b82f6', count: executiveProjectStatus.stats.early }
                    ].map(chip => (
                      <ExecStatusChip
                        key={chip.key}
                        $active={executiveStatusFilter === chip.key}
                        $color={chip.color}
                        onClick={() => setExecutiveStatusFilter(chip.key)}
                      >
                        {chip.label}
                        <ExecStatusChipBadge $active={executiveStatusFilter === chip.key}>
                          {chip.count}
                        </ExecStatusChipBadge>
                      </ExecStatusChip>
                    ))}
                  </ExecStatusFilterBar>

                  {(() => {
                    const CAT = {
                      completed: { label: '완료',     icon: '✅', color: '#047857', bg: '#d1fae5' },
                      delayed:   { label: '지연',     icon: '⚠️', color: '#b91c1c', bg: '#fee2e2' },
                      early:     { label: '조기 달성', icon: '🌟', color: '#1d4ed8', bg: '#dbeafe' }
                    };

                    // 행 평탄화: 필터에 맞는 카테고리만 모음 + 과제별 묶음 유지
                    const flatRows = [];
                    executiveProjectStatus.results.forEach(project => {
                      const projectRows = [];
                      const pushCat = (catKey, items) => {
                        if (executiveStatusFilter !== 'all' && executiveStatusFilter !== catKey) return;
                        items.forEach(item => projectRows.push({ category: catKey, item }));
                      };
                      pushCat('completed', project.completedInPeriod);
                      pushCat('delayed',   project.delayed);
                      pushCat('early',     project.early);

                      if (projectRows.length === 0) return;
                      projectRows.forEach((r, idx) => {
                        flatRows.push({
                          project,
                          ...r,
                          isFirstOfProject: idx === 0,
                          projectSpan: projectRows.length
                        });
                      });
                    });

                    if (flatRows.length === 0) {
                      return <ExecEmptyMessage>해당 카테고리에 해당하는 항목이 없습니다.</ExecEmptyMessage>;
                    }

                    const infoText = (row) => {
                      if (row.category === 'completed') return `완료 ${row.item.완료일}`;
                      if (row.category === 'delayed')   return `목표 ${row.item.목표일}`;
                      if (row.category === 'early')     return `완료 ${row.item.완료일} (목표 ${row.item.목표일})`;
                      return '';
                    };

                    // 10건 초과면 잘라서 표시. rowSpan이 깨지지 않게 과제 묶음 단위로 잘라냄.
                    const LIMIT = 10;
                    let visibleRows = flatRows;
                    if (flatRows.length > LIMIT && !executiveShowAll) {
                      // 뒤로 클립: LIMIT 위치에서 시작해 직전 과제 경계까지 후퇴
                      let cutAt = LIMIT;
                      while (cutAt > 0 && cutAt < flatRows.length && !flatRows[cutAt].isFirstOfProject) {
                        cutAt--;
                      }
                      // 첫 과제 하나가 LIMIT보다 크면 backward로 0까지 후퇴 → 첫 과제는 통째로 보여줌
                      if (cutAt === 0) {
                        cutAt = 1;
                        while (cutAt < flatRows.length && !flatRows[cutAt].isFirstOfProject) {
                          cutAt++;
                        }
                      }
                      visibleRows = flatRows.slice(0, cutAt);
                    }
                    const hasHidden = visibleRows.length < flatRows.length;

                    return (
                      <>
                        <ExecTableWrap>
                          <ExecTable>
                            <colgroup>
                              <col style={{ width: '28%' }} />
                              <col style={{ width: 'auto' }} />
                              <col style={{ width: '100px' }} />
                              <col style={{ width: '130px' }} />
                            </colgroup>
                            <ExecTableHead>
                              <tr>
                                <ExecTableTh>과제</ExecTableTh>
                                <ExecTableTh>액션아이템</ExecTableTh>
                                <ExecTableTh>달성현황</ExecTableTh>
                                <ExecTableTh>정보</ExecTableTh>
                              </tr>
                            </ExecTableHead>
                            <tbody>
                              {visibleRows.map((row, idx) => {
                                const cat = CAT[row.category];
                                return (
                                  <tr key={idx}>
                                    {row.isFirstOfProject && (
                                      <ExecTableTdProject rowSpan={row.projectSpan}>
                                        <ExecTableProjectName>{row.project.과제명}</ExecTableProjectName>
                                        <ExecTableProjectMeta>
                                          <span>{row.project.사업부}</span>
                                          {row.project.과제PL && <span>· {row.project.과제PL}</span>}
                                          <ExecProjectProgress $progress={row.project.진행률}>
                                            · {percentText(row.project.진행률)}
                                          </ExecProjectProgress>
                                        </ExecTableProjectMeta>
                                      </ExecTableTdProject>
                                    )}
                                    <ExecTableTd>{row.item.title}</ExecTableTd>
                                    <ExecTableTd>
                                      <ExecCategoryBadge $color={cat.color} $bg={cat.bg}>
                                        {cat.icon} {cat.label}
                                      </ExecCategoryBadge>
                                    </ExecTableTd>
                                    <ExecTableTd>
                                      <ExecTableInfo>{infoText(row)}</ExecTableInfo>
                                    </ExecTableTd>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </ExecTable>
                        </ExecTableWrap>

                        {(hasHidden || executiveShowAll) && flatRows.length > LIMIT && (
                          <ExecShowMoreBar>
                            {executiveShowAll ? (
                              <>
                                <ExecShowMoreButton onClick={() => setExecutiveShowAll(false)}>
                                  접기 ▲
                                </ExecShowMoreButton>
                                <ExecShowMoreHint>총 {flatRows.length}건</ExecShowMoreHint>
                              </>
                            ) : (
                              <>
                                <ExecShowMoreButton onClick={() => setExecutiveShowAll(true)}>
                                  더보기 ▼
                                </ExecShowMoreButton>
                                <ExecShowMoreHint>
                                  {visibleRows.length} / {flatRows.length}건 표시
                                </ExecShowMoreHint>
                              </>
                            )}
                          </ExecShowMoreBar>
                        )}
                      </>
                    );
                  })()}
                </ExecPanel>
                )}
              </ExecTwoColumnRow>
            </TrendContent>
          </TrendContainer>
        );

      case 'overview':
        return (
          <>
            {/* 연도 선택 */}
            <YearSelectorContainer>
              <YearSelector>
                <YearButton onClick={handlePrevYear} title="이전 년도">
                  ‹
                </YearButton>
                <YearDisplay>{currentYear}년</YearDisplay>
                <YearButton onClick={handleNextYear} title="다음 년도">
                  ›
                </YearButton>
              </YearSelector>
            </YearSelectorContainer>

            {/* 상단 섹션: 사업부별 과제 현황 */}
            <TopSection>
              <ProjectSummary
                projects={filteredProjects}
                divisionColors={divisionColors}
                statusColors={statusColors}
                settingsData={settingsData}
              />
            </TopSection>

            {/* 중간 섹션: 성과 분류 현황 (전체 폭) */}
            <MiddleSection>
              <PerformanceOverview
                projects={filteredProjects}
                divisionColors={divisionColors}
                statusColors={statusColors}
                globalPerformances={globalPerformances}
                performanceCategories={settingsData.performanceCategories || []}
                settingsData={settingsData}
              />
            </MiddleSection>

            {/* 하단: 월별 진행 과제 현황 */}
            <BottomGrid>
              <ProgressTrendChart
                projects={filteredProjects}
                divisionColors={divisionColors}
              />
            </BottomGrid>
          </>
        );

      case 'kpi':
        return (
          <KPIDashboard
            currentYear={currentYear}
            onYearChange={(newYear) => {
              setCurrentYear(newYear);
              if (onYearChange) onYearChange(newYear);
            }}
            globalPerformances={globalPerformances}
            settingsData={settingsData}
            projects={projects}
            onEditPerformance={onEditPerformance}
            onEditProject={onEditProject}
            onLinkProjectToPerformance={onLinkProjectToPerformance}
            onPerformanceRestored={onPerformanceRestored}
          />
        );

      case 'comparison':
        return (
          <DepartmentStatus
            projects={filteredProjects}
            statusColors={statusColors}
            divisionColors={divisionColors}
            currentYear={currentYear}
            onYearChange={(newYear) => {
              setCurrentYear(newYear);
              if (onYearChange) onYearChange(newYear);
            }}
            settingsData={settingsData}
            isAdmin={isAdmin}
          />
        );

      case 'allProjects':
        return (
          <AllProjectsView
            projects={projects}
            globalPerformances={globalPerformances}
            statusColors={statusColors}
            divisionColors={divisionColors}
            currentYear={currentYear}
            onYearChange={(newYear) => {
              setCurrentYear(newYear);
              if (onYearChange) onYearChange(newYear);
            }}
            onRestoreProject={onRestoreProject}
            onPermanentDeleteProject={onPermanentDeleteProject}
            isAdmin={isAdmin}
            columnSettings={columnSettings}
            onColumnSettingsChange={onColumnSettingsChange}
            pivotSettings={pivotSettings}
            onPivotSettingsChange={onPivotSettingsChange}
            taskCategories={settingsData.taskCategories || []}
            settingsData={settingsData}
          />
        );


      case 'trend':
        return (
          <TrendContainer>
            <TrendHeader>
              <TrendHeaderLeft>
                <TrendTitle>
                  📊 진행률 현황
                </TrendTitle>
              </TrendHeaderLeft>
              <TrendHeaderRight>
                {canExport && (
                  <>
                    <ExportDropdownWrapper ref={localSaveDropdownRef}>
                      <ExportDropdownToggle
                        onClick={() => setLocalSaveDropdownOpen(prev => !prev)}
                        disabled={trendFilteredProjects.length === 0}
                        title="요약 정보, 진행률, 주차별 추이, 상세 데이터를 저장"
                      >
                        <Download size={14} />
                        로컬 저장
                        <ChevronDown size={12} />
                      </ExportDropdownToggle>
                      {localSaveDropdownOpen && (
                        <ExportDropdownMenu>
                          <ExportDropdownItem onClick={() => { handleExportDetailView(); setLocalSaveDropdownOpen(false); }}>
                            CSV로 저장
                          </ExportDropdownItem>
                          <ExportDropdownItem onClick={() => { handleExportDetailViewWord(); setLocalSaveDropdownOpen(false); }}>
                            Word로 저장
                          </ExportDropdownItem>
                        </ExportDropdownMenu>
                      )}
                    </ExportDropdownWrapper>
                    <ExportDropdownWrapper ref={allWeeksDropdownRef}>
                      <ExportDropdownToggle
                        onClick={() => setAllWeeksDropdownOpen(prev => !prev)}
                        disabled={trendFilteredProjects.length === 0}
                        title="전체 52주차의 완료 항목과 이슈 사항을 저장"
                      >
                        <Download size={14} />
                        모든 주차 테이블 저장
                        <ChevronDown size={12} />
                      </ExportDropdownToggle>
                      {allWeeksDropdownOpen && (
                        <ExportDropdownMenu>
                          <ExportDropdownItem onClick={() => { handleExportAllWeeks(); setAllWeeksDropdownOpen(false); }}>
                            CSV로 저장
                          </ExportDropdownItem>
                          <ExportDropdownItem onClick={() => { handleExportAllWeeksWord(); setAllWeeksDropdownOpen(false); }}>
                            Word로 저장
                          </ExportDropdownItem>
                        </ExportDropdownMenu>
                      )}
                    </ExportDropdownWrapper>
                    <ExportButton
                      onClick={handleExportProjectView}
                      disabled={trendFilteredProjects.length === 0}
                      title="과제별 액션아이템 진척 현황을 CSV 파일로 저장"
                      style={{ marginLeft: '0.5rem' }}
                    >
                      <Download size={14} />
                      과제별 현황 저장
                    </ExportButton>
                  </>
                )}
                <ProgressViewToggle>
                  <ProgressViewButton
                    $active={progressViewMode === 'summary'}
                    onClick={() => setProgressViewMode('summary')}
                  >
                    요약 보기
                  </ProgressViewButton>
                  <ProgressViewButton
                    $active={progressViewMode === 'detail'}
                    onClick={() => setProgressViewMode('detail')}
                  >
                    상세 보기
                  </ProgressViewButton>
                  <ProgressViewButton
                    $active={progressViewMode === 'project'}
                    onClick={() => setProgressViewMode('project')}
                  >
                    과제별 보기
                  </ProgressViewButton>
                </ProgressViewToggle>
                <TrendYearSelector>
                  <TrendYearButton onClick={handlePrevYear}>‹</TrendYearButton>
                  <TrendYearDisplay>{currentYear}년</TrendYearDisplay>
                  <TrendYearButton onClick={handleNextYear}>›</TrendYearButton>
                </TrendYearSelector>
              </TrendHeaderRight>
            </TrendHeader>
            <TrendFilterBar>
              <TrendFilterButton
                $active={trendSelectedDivision === 'all'}
                onClick={() => setTrendSelectedDivision('all')}
              >
                전체
                <TrendFilterBadge $active={trendSelectedDivision === 'all'}>
                  {getTrendTotalCount()}
                </TrendFilterBadge>
              </TrendFilterButton>
              {trendDivisions.map(division => (
                <TrendFilterButton
                  key={division}
                  $active={trendSelectedDivision === division}
                  onClick={() => setTrendSelectedDivision(division)}
                >
                  {division}
                  <TrendFilterBadge $active={trendSelectedDivision === division}>
                    {getTrendDivisionCount(division)}
                  </TrendFilterBadge>
                </TrendFilterButton>
              ))}
            </TrendFilterBar>
            <TrendContent>
              {progressViewMode === 'project' ? (
                /* 과제별 보기 - 계획 대비 완료 현황 테이블 */
                <DetailViewContainer>
                  <DetailViewHeader>
                    <div style={{ fontSize: '0.9rem', color: '#64748b' }}>
                      {trendFilteredProjects.length}개 과제 - 액션아이템 진척 현황
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>선택 주차:</span>
                        <WeekSelector>
                          <WeekButton onClick={handlePrevWeek} disabled={selectedWeek <= 1}>‹</WeekButton>
                          <WeekDisplay>{selectedWeek}주차 ({getWeekDateRange(selectedWeek)})</WeekDisplay>
                          <WeekButton onClick={handleNextWeek} disabled={selectedWeek >= 52}>›</WeekButton>
                        </WeekSelector>
                      </div>
                    </div>
                  </DetailViewHeader>
                  {/* 상태 필터 바 */}
                  <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    padding: '0.625rem 1.5rem',
                    background: '#f8fafc',
                    borderBottom: '1px solid #e2e8f0',
                    flexWrap: 'wrap',
                    alignItems: 'center'
                  }}>
                    <span style={{ fontSize: '0.8rem', color: '#64748b', marginRight: '0.25rem' }}>상태:</span>
                    {[
                      { key: 'all', label: '전체' },
                      { key: 'normal', label: '정상', color: '#10b981' },
                      { key: 'delayed', label: '지연', color: '#ef4444' },
                      { key: 'noTarget', label: '목표일 미설정', color: '#94a3b8' },
                      { key: 'noAction', label: '미등록', color: '#94a3b8' }
                    ].map(({ key, label, color }) => {
                      const getStatusKey = (row) => {
                        if (row.totalActionItems === 0) return 'noAction';
                        if (!row.hasAnyTargetDate) return 'noTarget';
                        if (row.delayedItems.length > 0) return 'delayed';
                        return 'normal';
                      };
                      const count = key === 'all'
                        ? projectViewData.length
                        : projectViewData.filter(row => getStatusKey(row) === key).length;
                      const isActive = projectViewStatusFilter === key;
                      return (
                        <TrendFilterButton
                          key={key}
                          $active={isActive}
                          onClick={() => setProjectViewStatusFilter(key)}
                          style={isActive && color ? { background: color, borderColor: color } : {}}
                        >
                          {label}
                          <TrendFilterBadge $active={isActive}>{count}</TrendFilterBadge>
                        </TrendFilterButton>
                      );
                    })}
                    {/* 과제 상태 필터 (진행상태) */}
                    {availableStatuses.length > 0 && (
                      <>
                        <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: '1rem', marginRight: '0.25rem', borderLeft: '1px solid #e2e8f0', paddingLeft: '1rem' }}>과제 상태:</span>
                        {availableStatuses.map(status => {
                          const isActive = trendSelectedStatuses.has(status.name);
                          return (
                            <TrendFilterButton
                              key={`ps-${status.name}`}
                              $active={isActive}
                              onClick={() => handleStatusToggle(status.name)}
                              style={isActive ? { background: status.color, borderColor: status.color } : {}}
                            >
                              {status.name}
                            </TrendFilterButton>
                          );
                        })}
                        {trendSelectedStatuses.size > 0 && (
                          <button
                            onClick={() => setTrendSelectedStatuses(new Set(availableStatuses.filter(s => s.name !== '취소').map(s => s.name)))}
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.7rem',
                              fontWeight: 500,
                              border: '1px solid #e2e8f0',
                              background: '#f1f5f9',
                              color: '#64748b',
                              borderRadius: '0.375rem',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            초기화
                          </button>
                        )}
                      </>
                    )}
                    <button
                      onClick={handleExportProjectView}
                      disabled={projectViewData.length === 0}
                      style={{
                        marginLeft: 'auto',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                        padding: '0.375rem 0.75rem',
                        background: projectViewData.length === 0 ? '#e2e8f0' : '#3b82f6',
                        color: projectViewData.length === 0 ? '#94a3b8' : 'white',
                        border: 'none',
                        borderRadius: '0.375rem',
                        fontSize: '0.8rem',
                        fontWeight: 500,
                        cursor: projectViewData.length === 0 ? 'not-allowed' : 'pointer',
                        transition: 'background 0.2s ease',
                        whiteSpace: 'nowrap'
                      }}
                      onMouseOver={(e) => { if (projectViewData.length > 0) e.currentTarget.style.background = '#2563eb'; }}
                      onMouseOut={(e) => { if (projectViewData.length > 0) e.currentTarget.style.background = '#3b82f6'; }}
                    >
                      <Download size={14} />
                      CSV 저장
                    </button>
                  </div>
                  <div style={{ flex: 1, overflow: 'auto' }}>
                    <DetailTable>
                      <DetailTableHead>
                        <tr>
                          <DetailTableTh style={{ width: '5%' }}>사업부</DetailTableTh>
                          <DetailTableTh style={{ width: '5%' }}>프로세스</DetailTableTh>
                          <DetailTableTh style={{ width: '16%' }}>과제명</DetailTableTh>
                          <DetailTableTh style={{ width: '7%' }}>과제PL</DetailTableTh>
                          <DetailTableTh style={{ width: '10%', textAlign: 'center' }}>전체 진행률</DetailTableTh>
                          <DetailTableTh style={{ width: '10%', textAlign: 'center' }}>액션아이템 현황</DetailTableTh>
                          <DetailTableTh style={{ width: '30%' }}>~{selectedWeek}주차 지연 항목</DetailTableTh>
                          <DetailTableTh style={{ width: '10%', textAlign: 'center' }}>누적 (~ {selectedWeek}주차)</DetailTableTh>
                          <DetailTableTh style={{ width: '10%', textAlign: 'center' }}>상태</DetailTableTh>
                        </tr>
                      </DetailTableHead>
                      <DetailTableBody>
                        {(() => {
                          const getStatusKey = (row) => {
                            if (row.totalActionItems === 0) return 'noAction';
                            if (!row.hasAnyTargetDate) return 'noTarget';
                            if (row.delayedItems.length > 0) return 'delayed';
                            return 'normal';
                          };
                          const filteredRows = projectViewStatusFilter === 'all'
                            ? projectViewData
                            : projectViewData.filter(row => getStatusKey(row) === projectViewStatusFilter);

                          if (filteredRows.length === 0) return (
                            <tr>
                              <DetailTableTd colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                                해당 조건의 과제가 없습니다.
                              </DetailTableTd>
                            </tr>
                          );

                          return filteredRows.map(row => {
                            const progressColor = row.progress >= 80 ? '#10b981' : row.progress >= 50 ? '#f59e0b' : row.progress >= 20 ? '#f97316' : '#ef4444';
                            const statusKey = getStatusKey(row);
                            const statusLabel = statusKey === 'noAction' ? '미등록'
                              : statusKey === 'noTarget' ? '목표일 미설정'
                              : statusKey === 'delayed' ? `지연 (${row.delayedItems.length})` : '정상';
                            const statusColor = statusKey === 'normal' ? '#10b981' : statusKey === 'delayed' ? '#ef4444' : '#94a3b8';

                            return (
                              <tr key={row.id} onClick={() => onEditProject && onEditProject(trendFilteredProjects.find(p => p.id === row.id))} style={{ cursor: 'pointer' }}>
                                <DetailTableTd>
                                  <span style={{
                                    padding: '0.2rem 0.5rem',
                                    background: '#f1f5f9',
                                    borderRadius: '0.25rem',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    color: '#475569'
                                  }}>{row.사업부}</span>
                                </DetailTableTd>
                                <DetailTableTd style={{ fontSize: '0.8rem', color: '#64748b' }}>{row.프로세스}</DetailTableTd>
                                <DetailTableTd style={{ fontWeight: 500 }}>{row.과제명}</DetailTableTd>
                                <DetailTableTd style={{ fontSize: '0.8rem', color: '#64748b' }}>{row.과제PL}</DetailTableTd>
                                <DetailTableTd style={{ textAlign: 'center' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                                    <span style={{ fontSize: '1rem', fontWeight: 700, color: progressColor }}>{row.progress}%</span>
                                    <div style={{
                                      width: '100%',
                                      height: '6px',
                                      background: '#e2e8f0',
                                      borderRadius: '3px',
                                      overflow: 'hidden'
                                    }}>
                                      <div style={{
                                        width: `${row.progress}%`,
                                        height: '100%',
                                        background: progressColor,
                                        borderRadius: '3px',
                                        transition: 'width 0.3s ease'
                                      }} />
                                    </div>
                                  </div>
                                </DetailTableTd>
                                <DetailTableTd style={{ textAlign: 'center' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.125rem' }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                                      {row.completedActionItems} / {row.totalActionItems}
                                    </span>
                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                      {row.totalSubItems > 0 && `세부: ${row.completedSubItems}/${row.totalSubItems}`}
                                    </span>
                                  </div>
                                </DetailTableTd>
                                <DetailTableTd>
                                  {row.delayedItems.length === 0 ? (
                                    <EmptyCell>-</EmptyCell>
                                  ) : (
                                    <CompletedItemsList>
                                      {row.delayedItems.map((item, idx) => (
                                        <div key={`delay-${idx}`} style={{
                                          display: 'flex',
                                          alignItems: 'flex-start',
                                          gap: '0.375rem',
                                          fontSize: '0.8rem',
                                          color: '#ef4444'
                                        }}>
                                          <span style={{ fontSize: '0.7rem', marginTop: '0.1rem' }}>!</span>
                                          <span>{item.title}</span>
                                          <span style={{ fontSize: '0.7rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                                            (목표: {item.targetWeek}주차)
                                          </span>
                                        </div>
                                      ))}
                                    </CompletedItemsList>
                                  )}
                                </DetailTableTd>
                                <DetailTableTd style={{ textAlign: 'center' }}>
                                  <span style={{ fontSize: '0.8rem', color: '#475569', whiteSpace: 'nowrap' }}>
                                    목표 {row.cumulativePlanned} / 완료 {row.cumulativeDone}
                                    {row.cumulativePlanned > 0 && (() => {
                                      const gap = row.cumulativeDone - row.cumulativePlanned;
                                      return (
                                        <span style={{
                                          marginLeft: '0.375rem',
                                          fontSize: '0.8rem',
                                          fontWeight: 600,
                                          color: gap >= 0 ? '#10b981' : '#ef4444'
                                        }}>
                                          ({gap >= 0 ? `+${gap}` : gap})
                                        </span>
                                      );
                                    })()}
                                  </span>
                                </DetailTableTd>
                                <DetailTableTd style={{ textAlign: 'center' }}>
                                  <span style={{
                                    padding: '0.25rem 0.625rem',
                                    borderRadius: '1rem',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    color: 'white',
                                    background: statusColor
                                  }}>
                                    {statusLabel}
                                  </span>
                                </DetailTableTd>
                              </tr>
                            );
                          });
                        })()}
                      </DetailTableBody>
                    </DetailTable>
                  </div>
                </DetailViewContainer>
              ) : progressViewMode === 'detail' ? (
                /* 상세 보기 - 테이블 */
                <DetailViewContainer>
                  <DetailViewHeader>
                    <div style={{ fontSize: '0.9rem', color: '#64748b' }}>
                      {trendFilteredProjects.length}개 과제
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>선택 주차:</span>
                        <WeekSelector>
                          <WeekButton onClick={handlePrevWeek} disabled={selectedWeek <= 1}>‹</WeekButton>
                          <WeekDisplay>{selectedWeek}주차 ({getWeekDateRange(selectedWeek)})</WeekDisplay>
                          <WeekButton onClick={handleNextWeek} disabled={selectedWeek >= 52}>›</WeekButton>
                        </WeekSelector>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        이전 주차: {selectedWeek > 1 ? `${selectedWeek - 1}주차 (${getWeekDateRange(selectedWeek - 1)})` : '-'}
                      </div>
                    </div>
                  </DetailViewHeader>
                  <div style={{ flex: 1, overflow: 'auto' }}>
                    <DetailTable>
                      <DetailTableHead>
                        <tr>
                          <DetailTableTh style={{ width: '5%' }}>프로세스</DetailTableTh>
                          <DetailTableTh style={{ width: '5%' }}>과제 영역</DetailTableTh>
                          <DetailTableTh style={{ width: '20%' }}>과제명</DetailTableTh>
                          <DetailTableTh style={{ width: '23.33%' }}>{selectedWeek > 1 ? `${selectedWeek - 1}주차 (${getWeekDateRange(selectedWeek - 1)})` : '-'} 완료 항목</DetailTableTh>
                          <DetailTableTh style={{ width: '23.33%' }}>{selectedWeek}주차 ({getWeekDateRange(selectedWeek)}) 완료 항목</DetailTableTh>
                          <DetailTableTh style={{ width: '23.34%' }}>이슈 사항</DetailTableTh>
                        </tr>
                      </DetailTableHead>
                      <DetailTableBody>
                        {detailViewData.length === 0 ? (
                          <tr>
                            <DetailTableTd colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                              해당 조건의 과제가 없습니다.
                            </DetailTableTd>
                          </tr>
                        ) : (
                          detailViewData.map(row => (
                            <tr key={row.id}>
                              <DetailTableTd>{row.프로세스}</DetailTableTd>
                              <DetailTableTd>{row.과제영역}</DetailTableTd>
                              <DetailTableTd style={{ fontWeight: 500 }}>{row.과제명}</DetailTableTd>
                              <DetailTableTd>
                                {selectedWeek <= 1 ? (
                                  <EmptyCell>-</EmptyCell>
                                ) : row.prevWeek.completedActionItems.length === 0 && row.prevWeek.groupedActivities.length === 0 ? (
                                  <EmptyCell>-</EmptyCell>
                                ) : (
                                  <CompletedItemsList>
                                    {/* 완전히 완료된 액션아이템 (세부항목이 없거나 모두 완료) */}
                                    {row.prevWeek.completedActionItems.map((item, idx) => (
                                      <CompletedItem key={`ai-${idx}`} $isActivity={false}>{item}</CompletedItem>
                                    ))}
                                    {/* 액티비티가 완료된 액션아이템 그룹 */}
                                    {row.prevWeek.groupedActivities.map((group, gIdx) => (
                                      <ActionItemGroup key={`group-${gIdx}`}>
                                        <ActionItemTitle>{group.actionItemTitle}</ActionItemTitle>
                                        {group.activities.map((activity, aIdx) => (
                                          <NestedActivityItem key={`act-${aIdx}`}>{activity}</NestedActivityItem>
                                        ))}
                                      </ActionItemGroup>
                                    ))}
                                  </CompletedItemsList>
                                )}
                              </DetailTableTd>
                              <DetailTableTd>
                                {row.currentWeek.completedActionItems.length === 0 && row.currentWeek.groupedActivities.length === 0 ? (
                                  <EmptyCell>-</EmptyCell>
                                ) : (
                                  <CompletedItemsList>
                                    {/* 완전히 완료된 액션아이템 (세부항목이 없거나 모두 완료) */}
                                    {row.currentWeek.completedActionItems.map((item, idx) => (
                                      <CompletedItem key={`ai-${idx}`} $isActivity={false}>{item}</CompletedItem>
                                    ))}
                                    {/* 액티비티가 완료된 액션아이템 그룹 */}
                                    {row.currentWeek.groupedActivities.map((group, gIdx) => (
                                      <ActionItemGroup key={`group-${gIdx}`}>
                                        <ActionItemTitle>{group.actionItemTitle}</ActionItemTitle>
                                        {group.activities.map((activity, aIdx) => (
                                          <NestedActivityItem key={`act-${aIdx}`}>{activity}</NestedActivityItem>
                                        ))}
                                      </ActionItemGroup>
                                    ))}
                                  </CompletedItemsList>
                                )}
                              </DetailTableTd>
                              <DetailTableTd>
                                {row.unresolvedIssues.length === 0 && row.resolvedIssues.length === 0 ? (
                                  <EmptyCell>-</EmptyCell>
                                ) : (
                                  <IssuesList>
                                    {row.unresolvedIssues.map((issue, idx) => (
                                      <IssueItem key={`unresolved-${idx}`}>
                                        <IssueTitle $resolved={false}>{issue.제목}</IssueTitle>
                                        {issue.코멘트 && <IssueComment>{issue.코멘트}</IssueComment>}
                                      </IssueItem>
                                    ))}
                                    {row.resolvedIssues.map((issue, idx) => (
                                      <IssueItem key={`resolved-${idx}`}>
                                        <IssueTitle $resolved={true}>{issue.제목}</IssueTitle>
                                        {issue.코멘트 && <IssueComment>{issue.코멘트}</IssueComment>}
                                      </IssueItem>
                                    ))}
                                  </IssuesList>
                                )}
                              </DetailTableTd>
                            </tr>
                          ))
                        )}
                      </DetailTableBody>
                    </DetailTable>
                  </div>
                </DetailViewContainer>
              ) : (
              /* 요약 보기 */
              <div style={{ display: 'flex', gap: '1.5rem', width: '100%', height: '100%' }}>
                {/* 왼쪽 1/3: 전체 진행률 + 프로세스별 진행률 */}
                <div style={{ flex: '0 0 33.33%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* 전체 진행률 */}
                  <div style={{
                    background: 'white',
                    borderRadius: '1rem',
                    padding: '1.25rem 1.5rem',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                    border: '1px solid #e2e8f0'
                  }}>
                    <ClickableRateSection
                      $hoverBg="#e0f2fe"
                      onClick={() => setProgressModal(true)}
                      title="클릭하여 전체 과제 진행률 보기"
                    >
                      <div style={{
                        fontSize: '1rem',
                        fontWeight: 700,
                        color: '#1e293b',
                        marginBottom: '1rem',
                        paddingBottom: '0.5rem',
                        borderBottom: '1px solid #e2e8f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span>전체 진행률</span>
                        <span style={{
                          fontSize: '0.7rem',
                          color: '#0ea5e9',
                          fontWeight: 500
                        }}>
                          상세보기 →
                        </span>
                      </div>
                      {/* 과제 균일 조건 시 진행률 */}
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.375rem', fontWeight: 500 }}>
                        과제 균일 조건 시 진행률
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem'
                      }}>
                        <div style={{
                          flex: 1,
                          height: '28px',
                          background: '#e0f2fe',
                          borderRadius: '14px',
                          overflow: 'hidden',
                          position: 'relative'
                        }}>
                          <div style={{
                            width: `${trendAverageProgress}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #38bdf8, #0ea5e9)',
                            borderRadius: '14px',
                            transition: 'width 0.5s ease'
                          }} />
                        </div>
                        <div style={{
                          fontSize: '1.25rem',
                          fontWeight: 700,
                          color: '#0ea5e9',
                          minWidth: '55px',
                          textAlign: 'right'
                        }}>
                          {trendAverageProgress}%
                        </div>
                      </div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: '#64748b',
                        marginTop: '0.25rem',
                        textAlign: 'right'
                      }}>
                        ({trendFilteredProjects.length}개 과제)
                      </div>

                      {/* 액션 아이템 비율 기반 진행률 */}
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.75rem', marginBottom: '0.375rem', fontWeight: 500 }}>
                        액션 아이템 비율 기반 진행률
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem'
                      }}>
                        <div style={{
                          flex: 1,
                          height: '28px',
                          background: '#dbeafe',
                          borderRadius: '14px',
                          overflow: 'hidden',
                          position: 'relative'
                        }}>
                          <div style={{
                            width: `${actionItemBasedProgress.percent}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #60a5fa, #3b82f6)',
                            borderRadius: '14px',
                            transition: 'width 0.5s ease'
                          }} />
                        </div>
                        <div style={{
                          fontSize: '1.25rem',
                          fontWeight: 700,
                          color: '#3b82f6',
                          minWidth: '55px',
                          textAlign: 'right'
                        }}>
                          {actionItemBasedProgress.percent}%
                        </div>
                      </div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: '#64748b',
                        marginTop: '0.25rem',
                        textAlign: 'right'
                      }}>
                        ({actionItemBasedProgress.completed}/{actionItemBasedProgress.total}개 액션아이템)
                      </div>

                      {/* 액션아이템 달성률 (오늘 기준 목표 대비) */}
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.75rem', marginBottom: '0.375rem', fontWeight: 500 }}>
                        액션아이템 달성률
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem'
                      }}>
                        <div style={{
                          flex: 1,
                          height: '28px',
                          background: '#fef3c7',
                          borderRadius: '14px',
                          overflow: 'hidden',
                          position: 'relative'
                        }}>
                          <div style={{
                            width: `${actionItemAchievementRate.percent}%`,
                            height: '100%',
                            background: actionItemAchievementRate.percent >= 80
                              ? 'linear-gradient(90deg, #34d399, #10b981)'
                              : actionItemAchievementRate.percent >= 50
                                ? 'linear-gradient(90deg, #fbbf24, #f59e0b)'
                                : 'linear-gradient(90deg, #f87171, #ef4444)',
                            borderRadius: '14px',
                            transition: 'width 0.5s ease'
                          }} />
                        </div>
                        <div style={{
                          fontSize: '1.25rem',
                          fontWeight: 700,
                          color: actionItemAchievementRate.percent >= 80 ? '#10b981' : actionItemAchievementRate.percent >= 50 ? '#f59e0b' : '#ef4444',
                          minWidth: '55px',
                          textAlign: 'right'
                        }}>
                          {actionItemAchievementRate.percent}%
                        </div>
                      </div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: '#64748b',
                        marginTop: '0.25rem',
                        textAlign: 'right'
                      }}>
                        ({actionItemAchievementRate.achieved}/{actionItemAchievementRate.target}개 목표 도래)
                      </div>
                    </ClickableRateSection>

                    {/* 액션아이템 등록률 */}
                    <ClickableRateSection
                      $hoverBg="#fef3c7"
                      onClick={() => setUnregisteredModal({ isOpen: true, type: 'actionItem' })}
                      title="클릭하여 미등록 과제 보기"
                    >
                      <div style={{
                        marginTop: '1rem',
                        paddingTop: '1rem',
                        borderTop: '1px solid #e2e8f0'
                      }}>
                        <div style={{
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          color: '#475569',
                          marginBottom: '0.5rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <span>액션아이템 등록률</span>
                          {unregisteredActionItemProjects.length > 0 && (
                            <span style={{
                              fontSize: '0.7rem',
                              color: '#f59e0b',
                              fontWeight: 500
                            }}>
                              미등록 {unregisteredActionItemProjects.length}개 →
                            </span>
                          )}
                        </div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem'
                        }}>
                          <div style={{
                            flex: 1,
                            height: '20px',
                            background: '#fef3c7',
                            borderRadius: '10px',
                            overflow: 'hidden',
                            position: 'relative'
                          }}>
                            <div style={{
                              width: `${actionItemRegistrationRate}%`,
                              height: '100%',
                              background: 'linear-gradient(90deg, #fbbf24, #f59e0b)',
                              borderRadius: '10px',
                              transition: 'width 0.5s ease'
                            }} />
                          </div>
                          <div style={{
                            fontSize: '1rem',
                            fontWeight: 700,
                            color: '#f59e0b',
                            minWidth: '45px',
                            textAlign: 'right'
                          }}>
                            {actionItemRegistrationRate}%
                          </div>
                        </div>
                      </div>
                    </ClickableRateSection>

                    {/* 액티비티 등록률 */}
                    <ClickableRateSection
                      $hoverBg="#ede9fe"
                      onClick={() => setUnregisteredModal({ isOpen: true, type: 'activity' })}
                      title="클릭하여 미등록 과제 보기"
                    >
                      <div style={{
                        marginTop: '0.75rem'
                      }}>
                        <div style={{
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          color: '#475569',
                          marginBottom: '0.5rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <span>액티비티 등록률</span>
                          {unregisteredActivityProjects.length > 0 && (
                            <span style={{
                              fontSize: '0.7rem',
                              color: '#8b5cf6',
                              fontWeight: 500
                            }}>
                              미등록 {unregisteredActivityProjects.length}개 →
                            </span>
                          )}
                        </div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem'
                        }}>
                          <div style={{
                            flex: 1,
                            height: '20px',
                            background: '#ede9fe',
                            borderRadius: '10px',
                            overflow: 'hidden',
                            position: 'relative'
                          }}>
                            <div style={{
                              width: `${activityRegistrationRate}%`,
                              height: '100%',
                              background: 'linear-gradient(90deg, #a78bfa, #8b5cf6)',
                              borderRadius: '10px',
                              transition: 'width 0.5s ease'
                            }} />
                          </div>
                          <div style={{
                            fontSize: '1rem',
                            fontWeight: 700,
                            color: '#8b5cf6',
                            minWidth: '45px',
                            textAlign: 'right'
                          }}>
                            {activityRegistrationRate}%
                          </div>
                        </div>
                      </div>
                    </ClickableRateSection>

                    {/* 액션아이템 일정 수립률 */}
                    <ClickableRateSection
                      $hoverBg="#fce7f3"
                      onClick={() => setScheduleRateModal(true)}
                      title="클릭하여 목표일 미설정 액션아이템 보기"
                    >
                      <div style={{
                        marginTop: '0.75rem'
                      }}>
                        <div style={{
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          color: '#475569',
                          marginBottom: '0.5rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <span>액션아이템 일정 수립률</span>
                          {unscheduledActionItems.length > 0 && (
                            <span style={{
                              fontSize: '0.7rem',
                              color: '#ec4899',
                              fontWeight: 500
                            }}>
                              미설정 {unscheduledActionItems.length}개 →
                            </span>
                          )}
                        </div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem'
                        }}>
                          <div style={{
                            flex: 1,
                            height: '20px',
                            background: '#fce7f3',
                            borderRadius: '10px',
                            overflow: 'hidden',
                            position: 'relative'
                          }}>
                            <div style={{
                              width: `${actionItemScheduleRate}%`,
                              height: '100%',
                              background: 'linear-gradient(90deg, #f472b6, #ec4899)',
                              borderRadius: '10px',
                              transition: 'width 0.5s ease'
                            }} />
                          </div>
                          <div style={{
                            fontSize: '1rem',
                            fontWeight: 700,
                            color: '#ec4899',
                            minWidth: '45px',
                            textAlign: 'right'
                          }}>
                            {actionItemScheduleRate}%
                          </div>
                        </div>
                      </div>
                    </ClickableRateSection>
                  </div>

                  {/* 프로세스별 진행률 */}
                  <div style={{
                    background: 'white',
                    borderRadius: '1rem',
                    padding: '1.25rem 1.5rem',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                    border: '1px solid #e2e8f0',
                    flex: 1
                  }}>
                    <div style={{
                      fontSize: '1rem',
                      fontWeight: 700,
                      color: '#1e293b',
                      marginBottom: '1rem',
                      paddingBottom: '0.5rem',
                      borderBottom: '1px solid #e2e8f0'
                    }}>
                      프로세스별 진행률
                    </div>

                    {processProgressData.length === 0 ? (
                      <div style={{
                        textAlign: 'center',
                        color: '#94a3b8',
                        padding: '2rem'
                      }}>
                        해당 조건의 과제가 없습니다.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {processProgressData.map((process) => (
                          <div key={process.name} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem'
                          }}>
                            <div style={{
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              color: '#475569',
                              minWidth: '60px'
                            }}>
                              {process.name}
                            </div>
                            <div style={{
                              flex: 1,
                              height: '20px',
                              background: '#e0f2fe',
                              borderRadius: '10px',
                              overflow: 'hidden',
                              position: 'relative'
                            }}>
                              <div style={{
                                width: `${process.avgProgress}%`,
                                height: '100%',
                                background: 'linear-gradient(90deg, #7dd3fc, #38bdf8)',
                                borderRadius: '10px',
                                transition: 'width 0.5s ease'
                              }} />
                            </div>
                            <div style={{
                              fontSize: '0.9rem',
                              fontWeight: 700,
                              color: '#0ea5e9',
                              minWidth: '40px',
                              textAlign: 'right'
                            }}>
                              {process.avgProgress}%
                            </div>
                            <div style={{
                              fontSize: '0.75rem',
                              color: '#94a3b8',
                              minWidth: '40px'
                            }}>
                              ({process.count}개)
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 과제 영역별 진행률 */}
                  <div style={{
                    background: 'white',
                    borderRadius: '1rem',
                    padding: '1.25rem 1.5rem',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                    border: '1px solid #e2e8f0',
                    flex: 1
                  }}>
                    <div style={{
                      fontSize: '1rem',
                      fontWeight: 700,
                      color: '#1e293b',
                      marginBottom: '1rem',
                      paddingBottom: '0.5rem',
                      borderBottom: '1px solid #e2e8f0'
                    }}>
                      과제 영역별 진행률
                    </div>

                    {projectAreaProgressData.length === 0 ? (
                      <div style={{
                        textAlign: 'center',
                        color: '#94a3b8',
                        padding: '2rem'
                      }}>
                        해당 조건의 과제가 없습니다.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {projectAreaProgressData.map((area) => (
                          <div key={area.name} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem'
                          }}>
                            <div style={{
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              color: '#475569',
                              minWidth: '80px'
                            }}>
                              {area.name}
                            </div>
                            <div style={{
                              flex: 1,
                              height: '20px',
                              background: '#fef3c7',
                              borderRadius: '10px',
                              overflow: 'hidden',
                              position: 'relative'
                            }}>
                              <div style={{
                                width: `${area.avgProgress}%`,
                                height: '100%',
                                background: 'linear-gradient(90deg, #fcd34d, #f59e0b)',
                                borderRadius: '10px',
                                transition: 'width 0.5s ease'
                              }} />
                            </div>
                            <div style={{
                              fontSize: '0.9rem',
                              fontWeight: 700,
                              color: '#f59e0b',
                              minWidth: '40px',
                              textAlign: 'right'
                            }}>
                              {area.avgProgress}%
                            </div>
                            <div style={{
                              fontSize: '0.75rem',
                              color: '#94a3b8',
                              minWidth: '40px'
                            }}>
                              ({area.count}개)
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 통계 요약 카드 */}
                  <div style={{
                    display: 'flex',
                    gap: '0.5rem'
                  }}>
                    <div style={{
                      flex: 1,
                      background: 'white',
                      padding: '0.75rem 0.5rem',
                      borderRadius: '0.5rem',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                      border: '1px solid #e2e8f0',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0c4a6e' }}>
                        {trendFilteredProjects.length}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        총과제
                      </div>
                    </div>
                    <div style={{
                      flex: 1,
                      background: 'white',
                      padding: '0.75rem 0.5rem',
                      borderRadius: '0.5rem',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                      border: '1px solid #e2e8f0',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0284c7' }}>
                        {trendFilteredProjects.filter(p => calculateProgress(p) === 100).length}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        완료
                      </div>
                    </div>
                    <div style={{
                      flex: 1,
                      background: 'white',
                      padding: '0.75rem 0.5rem',
                      borderRadius: '0.5rem',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                      border: '1px solid #e2e8f0',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#38bdf8' }}>
                        {trendFilteredProjects.filter(p => {
                          const progress = calculateProgress(p);
                          return progress > 0 && progress < 100;
                        }).length}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        진행중
                      </div>
                    </div>
                    <div style={{
                      flex: 1,
                      background: 'white',
                      padding: '0.75rem 0.5rem',
                      borderRadius: '0.5rem',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                      border: '1px solid #e2e8f0',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#bae6fd' }}>
                        {trendFilteredProjects.filter(p => calculateProgress(p) === 0).length}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        미착수
                      </div>
                    </div>
                  </div>
                </div>

                {/* 오른쪽 2/3: 주차별 액션 아이템 추이 차트 */}
                <div style={{
                  flex: '0 0 66.67%',
                  background: 'white',
                  borderRadius: '1rem',
                  padding: '1.5rem',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: '500px'
                }}>
                  {/* 차트 헤더 - 1줄: 제목/컨트롤 + 범례 */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.5rem',
                    paddingBottom: '0.5rem',
                    borderBottom: '1px solid #e2e8f0'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{
                        fontSize: '1rem',
                        fontWeight: 700,
                        color: '#1e293b'
                      }}>
                        주차별 추이
                      </div>
                      <select
                        value={trendChartType}
                        onChange={(e) => setTrendChartType(e.target.value)}
                        style={{
                          padding: '0.375rem 0.75rem',
                          borderRadius: '0.375rem',
                          border: '1px solid #e2e8f0',
                          fontSize: '0.85rem',
                          fontWeight: 500,
                          color: '#374151',
                          background: 'white',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="actionItem">액션아이템</option>
                        <option value="activity">액티비티</option>
                        <option value="project">과제</option>
                      </select>
                      <button
                        onClick={() => setWeeklyTrendModal({ isOpen: true, week: 'all' })}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.375rem',
                          padding: '0.375rem 0.75rem',
                          background: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.375rem',
                          fontSize: '0.85rem',
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'background 0.2s ease'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = '#2563eb'}
                        onMouseOut={(e) => e.currentTarget.style.background = '#3b82f6'}
                      >
                        📋 전체 리스트
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          background: '#f59e0b'
                        }} />
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>계획</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          background: '#10b981'
                        }} />
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>완료</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          background: '#3b82f6'
                        }} />
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>총 액션 아이템</span>
                      </div>
                    </div>
                  </div>

                  {/* 차트 헤더 - 2줄: 필터 */}
                  {(availableProcesses.length > 0 || availableStatuses.length > 0) && (
                    <div style={{
                      display: 'flex',
                      gap: '1rem',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      marginBottom: '0.5rem',
                      paddingBottom: '0.5rem',
                      borderBottom: '1px solid #f1f5f9'
                    }}>
                      {/* 프로세스 필터 토글 */}
                      {availableProcesses.length > 0 && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.375rem',
                          paddingRight: '1rem',
                          borderRight: availableStatuses.length > 0 ? '1px solid #cbd5e1' : 'none'
                        }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>프로세스</span>
                          {availableProcesses.map(proc => {
                            const isActive = trendSelectedProcesses.has(proc);
                            return (
                              <button
                                key={proc}
                                onClick={() => handleProcessToggle(proc)}
                                style={{
                                  padding: '0.2rem 0.5rem',
                                  fontSize: '0.7rem',
                                  fontWeight: 500,
                                  border: `1px solid ${isActive ? '#3b82f6' : '#d1d5db'}`,
                                  background: isActive ? '#3b82f6' : 'white',
                                  color: isActive ? 'white' : '#6b7280',
                                  borderRadius: '1rem',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {proc}
                              </button>
                            );
                          })}
                          {trendSelectedProcesses.size > 0 && (
                            <button
                              onClick={() => setTrendSelectedProcesses(new Set())}
                              style={{
                                padding: '0.2rem 0.5rem',
                                fontSize: '0.65rem',
                                fontWeight: 500,
                                border: '1px solid #e2e8f0',
                                background: '#f1f5f9',
                                color: '#64748b',
                                borderRadius: '1rem',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              초기화
                            </button>
                          )}
                        </div>
                      )}
                      {/* 진행 상태 필터 토글 */}
                      {availableStatuses.length > 0 && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.375rem'
                        }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>진행상태</span>
                          {availableStatuses.map(status => {
                            const isActive = trendSelectedStatuses.has(status.name);
                            return (
                              <button
                                key={status.name}
                                onClick={() => handleStatusToggle(status.name)}
                                style={{
                                  padding: '0.2rem 0.5rem',
                                  fontSize: '0.7rem',
                                  fontWeight: 500,
                                  border: `1px solid ${isActive ? status.color : '#d1d5db'}`,
                                  background: isActive ? status.color : 'white',
                                  color: isActive ? 'white' : '#6b7280',
                                  borderRadius: '1rem',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {status.name}
                              </button>
                            );
                          })}
                          {trendSelectedStatuses.size > 0 && (
                            <button
                              onClick={() => setTrendSelectedStatuses(new Set(availableStatuses.filter(s => s.name !== '취소').map(s => s.name)))}
                              style={{
                                padding: '0.2rem 0.5rem',
                                fontSize: '0.65rem',
                                fontWeight: 500,
                                border: '1px solid #e2e8f0',
                                background: '#f1f5f9',
                                color: '#64748b',
                                borderRadius: '1rem',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              초기화
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 차트 영역 */}
                  <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                    <svg
                      width="100%"
                      height="100%"
                      viewBox="0 0 600 600"
                      preserveAspectRatio="xMidYMid meet"
                    >
                      {/* 배경 그리드 */}
                      {[0, 1, 2, 3, 4, 5].map(i => {
                        const y = 50 + (500 / 5) * i;
                        const value = Math.round(maxChartValue - (maxChartValue / 5) * i);
                        return (
                          <g key={i}>
                            <line
                              x1="50"
                              y1={y}
                              x2="570"
                              y2={y}
                              stroke="#e2e8f0"
                              strokeWidth="1"
                            />
                            <text
                              x="40"
                              y={y + 4}
                              textAnchor="end"
                              fontSize="11"
                              fill="#94a3b8"
                            >
                              {value}
                            </text>
                          </g>
                        );
                      })}

                      {/* X축 라벨 (월 표시) */}
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => {
                        const weekStart = Math.round((month - 1) * 4.33) + 1;
                        const x = 50 + ((weekStart - 1) / 51) * 520;
                        return (
                          <g key={month}>
                            <line
                              x1={x}
                              y1="550"
                              x2={x}
                              y2="555"
                              stroke="#94a3b8"
                              strokeWidth="1"
                            />
                            <text
                              x={x}
                              y="570"
                              textAnchor="middle"
                              fontSize="11"
                              fill="#64748b"
                            >
                              {month}월
                            </text>
                          </g>
                        );
                      })}

                      {/* 오늘 주차 표시 */}
                      {(() => {
                        const todayWeek = getWeekNumber(todayLocalYmd());
                        if (!todayWeek || todayWeek < 1 || todayWeek > 52) return null;
                        const todayX = 50 + ((todayWeek - 1) / 51) * 520;
                        return (
                          <g>
                            <line
                              x1={todayX}
                              y1={50}
                              x2={todayX}
                              y2={550}
                              stroke="#ef4444"
                              strokeWidth="1.5"
                              strokeDasharray="6,4"
                              opacity="0.7"
                              pointerEvents="none"
                            />
                            <rect
                              x={todayX - 28}
                              y={34}
                              width={56}
                              height={18}
                              rx={4}
                              fill="#ef4444"
                              opacity="0.9"
                            />
                            <text
                              x={todayX}
                              y={47}
                              textAnchor="middle"
                              fontSize="10"
                              fontWeight="600"
                              fill="white"
                              pointerEvents="none"
                            >
                              오늘 ({todayWeek}주)
                            </text>
                          </g>
                        );
                      })()}

                      {/* 계획 라인 (주황색) */}
                      <path
                        d={currentChartData.map((d, i) => {
                          const x = 50 + (i / 51) * 520;
                          const y = 550 - (d.planned / maxChartValue) * 500;
                          return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                        }).join(' ')}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        pointerEvents="none"
                      />

                      {/* 완료 라인 (녹색) - 오늘 주차까지만 표시 (미래 주차는 데이터 정의상 평평해져 오해 소지) */}
                      {(() => {
                        const todayWeek = getWeekNumber(todayLocalYmd());
                        const todayIdx = (todayWeek && todayWeek >= 1 && todayWeek <= 52) ? todayWeek - 1 : currentChartData.length - 1;
                        const visible = currentChartData.slice(0, todayIdx + 1);
                        return (
                          <path
                            d={visible.map((d, i) => {
                              const x = 50 + (i / 51) * 520;
                              const y = 550 - (d.completed / maxChartValue) * 500;
                              return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                            }).join(' ')}
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            pointerEvents="none"
                          />
                        );
                      })()}

                      {/* 총 액션 아이템 라인 (파란색) */}
                      <path
                        d={currentChartData.map((d, i) => {
                          const x = 50 + (i / 51) * 520;
                          const y = 550 - ((d.total || 0) / maxChartValue) * 500;
                          return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                        }).join(' ')}
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        pointerEvents="none"
                      />

                      {/* 인터랙티브 주차별 영역 (클릭 가능) */}
                      {currentChartData.map((d, i) => {
                        const x = 50 + (i / 51) * 520;
                        const weekNum = i + 1;

                        return (
                          <g key={`week-area-${i}`}>
                            {/* 클릭 가능한 투명 영역 */}
                            <rect
                              x={x - 5}
                              y={50}
                              width={10}
                              height={500}
                              fill="transparent"
                              style={{ cursor: 'pointer' }}
                              onMouseEnter={() => setHoveredWeekPoint(weekNum)}
                              onMouseLeave={() => setHoveredWeekPoint(null)}
                              onClick={(e) => {
                                e.stopPropagation();
                                const items = getWeeklyItems(weekNum);
                                if (items.plannedItems.length > 0 || items.completedItems.length > 0) {
                                  setWeeklyTrendModal({ isOpen: true, week: weekNum });
                                }
                              }}
                            />

                            {/* 호버 시 세로 가이드라인 */}
                            {hoveredWeekPoint === i + 1 && (
                              <line
                                x1={x}
                                y1={50}
                                x2={x}
                                y2={550}
                                stroke="#94a3b8"
                                strokeWidth="1"
                                strokeDasharray="4,4"
                                pointerEvents="none"
                              />
                            )}
                          </g>
                        );
                      })}

                      {/* 계획 포인트 */}
                      {currentChartData.map((d, i) => {
                        if (d.planned === 0) return null;
                        const x = 50 + (i / 51) * 520;
                        const y = 550 - (d.planned / maxChartValue) * 500;
                        const isHovered = hoveredWeekPoint === i + 1;
                        return (
                          <g key={`planned-${i}`} style={{ pointerEvents: 'none' }}>
                            <circle
                              cx={x}
                              cy={y}
                              r={isHovered ? 6 : 4}
                              fill="#f59e0b"
                              stroke="white"
                              strokeWidth="2"
                              style={{ transition: 'r 0.15s ease' }}
                            />
                          </g>
                        );
                      })}

                      {/* 완료 포인트 - 오늘 주차까지만 표시 */}
                      {(() => {
                        const todayWeek = getWeekNumber(todayLocalYmd());
                        const todayIdx = (todayWeek && todayWeek >= 1 && todayWeek <= 52) ? todayWeek - 1 : currentChartData.length - 1;
                        return currentChartData.map((d, i) => {
                          if (i > todayIdx) return null;
                          if (d.completed === 0) return null;
                          const x = 50 + (i / 51) * 520;
                          const y = 550 - (d.completed / maxChartValue) * 500;
                          const isHovered = hoveredWeekPoint === i + 1;
                          return (
                            <g key={`completed-${i}`} style={{ pointerEvents: 'none' }}>
                              <circle
                                cx={x}
                                cy={y}
                                r={isHovered ? 6 : 4}
                                fill="#10b981"
                                stroke="white"
                                strokeWidth="2"
                                style={{ transition: 'r 0.15s ease' }}
                              />
                            </g>
                          );
                        });
                      })()}

                      {/* 총 액션 아이템 포인트 */}
                      {currentChartData.map((d, i) => {
                        if (!d.total || d.total === 0) return null;
                        const x = 50 + (i / 51) * 520;
                        const y = 550 - (d.total / maxChartValue) * 500;
                        const isHovered = hoveredWeekPoint === i + 1;
                        return (
                          <g key={`total-${i}`} style={{ pointerEvents: 'none' }}>
                            <circle
                              cx={x}
                              cy={y}
                              r={isHovered ? 6 : 4}
                              fill="#3b82f6"
                              stroke="white"
                              strokeWidth="2"
                              style={{ transition: 'r 0.15s ease' }}
                            />
                          </g>
                        );
                      })}

                      {/* 호버 툴팁 */}
                      {hoveredWeekPoint && (() => {
                        const weekData = currentChartData[hoveredWeekPoint - 1];
                        const x = 50 + ((hoveredWeekPoint - 1) / 51) * 520;
                        const weekItems = getWeeklyItems(hoveredWeekPoint);
                        const plannedY = weekData.planned > 0 ? 550 - (weekData.planned / maxChartValue) * 500 : 550;
                        const completedY = weekData.completed > 0 ? 550 - (weekData.completed / maxChartValue) * 500 : 550;
                        const totalY = (weekData.total || 0) > 0 ? 550 - ((weekData.total || 0) / maxChartValue) * 500 : 550;

                        // weekData.planned/completed/total가 이미 누적값임
                        const cumulativePlanned = weekData.planned;
                        const cumulativeCompleted = weekData.completed;
                        const cumulativeTotal = weekData.total || 0;
                        // 이번 주에 추가된 개수
                        const thisWeekPlanned = weekItems.plannedItems.length;
                        const thisWeekCompleted = weekItems.completedItems.length;

                        const hasClickHint = weekItems.plannedItems.length > 0 || weekItems.completedItems.length > 0;
                        const tooltipHeight = hasClickHint ? 90 : 74;
                        const adjustedTooltipY = Math.min(plannedY, completedY, totalY) - tooltipHeight - 10;
                        const ty = Math.max(10, adjustedTooltipY);

                        return (
                          <g pointerEvents="none">
                            {/* 툴팁 배경 */}
                            <rect
                              x={x - 85}
                              y={ty}
                              width={170}
                              height={tooltipHeight}
                              rx={6}
                              fill="#1e293b"
                              fillOpacity="0.95"
                            />
                            {/* 툴팁 화살표 */}
                            <polygon
                              points={`${x - 6},${ty + tooltipHeight} ${x},${ty + tooltipHeight + 8} ${x + 6},${ty + tooltipHeight}`}
                              fill="#1e293b"
                              fillOpacity="0.95"
                            />
                            {/* 툴팁 텍스트 */}
                            <text x={x} y={ty + 18} textAnchor="middle" fontSize="12" fontWeight="600" fill="white">
                              {hoveredWeekPoint}주차
                            </text>
                            <text x={x - 60} y={ty + 34} textAnchor="start" fontSize="11" fill="#fbbf24">
                              ● 계획: {cumulativePlanned}{thisWeekPlanned > 0 ? ` (+${thisWeekPlanned})` : ''}건
                            </text>
                            <text x={x - 60} y={ty + 48} textAnchor="start" fontSize="11" fill="#34d399">
                              ● 완료: {cumulativeCompleted}{thisWeekCompleted > 0 ? ` (+${thisWeekCompleted})` : ''}건
                            </text>
                            <text x={x - 60} y={ty + 62} textAnchor="start" fontSize="11" fill="#60a5fa">
                              ● 총: {cumulativeTotal}건
                            </text>
                            {hasClickHint && (
                              <text x={x} y={ty + 80} textAnchor="middle" fontSize="9" fill="#94a3b8">
                                클릭하여 상세 보기
                              </text>
                            )}
                          </g>
                        );
                      })()}

                      {/* Y축 라벨 */}
                      <text
                        x="15"
                        y="300"
                        textAnchor="middle"
                        fontSize="12"
                        fill="#64748b"
                        transform="rotate(-90, 15, 300)"
                      >
                        {trendChartType === 'project' ? '과제 수' : trendChartType === 'activity' ? '액티비티 수' : '액션아이템 수'}
                      </text>

                      {/* X축 라벨 */}
                      <text
                        x="310"
                        y="595"
                        textAnchor="middle"
                        fontSize="12"
                        fill="#64748b"
                      >
                        주차 (1~52주)
                      </text>
                    </svg>
                  </div>

                  {/* 요약 정보 */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '3rem',
                    marginTop: '1rem',
                    paddingTop: '1rem',
                    borderTop: '1px solid #e2e8f0'
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#3b82f6' }}>
                        {currentStats.totalPlanned + currentStats.totalCompleted}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        총 {trendChartType === 'project' ? '과제' : trendChartType === 'activity' ? '액티비티' : '액션아이템'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f59e0b' }}>
                        {currentStats.totalPlanned}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        계획(잔여) {trendChartType === 'project' ? '과제' : trendChartType === 'activity' ? '액티비티' : '액션아이템'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>
                        {currentStats.totalCompleted}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        완료 {trendChartType === 'project' ? '과제' : trendChartType === 'activity' ? '액티비티' : '액션아이템'}
                      </div>
                    </div>
                    {trendChartType === 'actionItem' && unscheduledActionItems.length > 0 && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#94a3b8' }}>
                          {unscheduledActionItems.length}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          일정 미수립
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              )}
            </TrendContent>

            {/* 미등록 과제 모달 */}
            {unregisteredModal.isOpen && (
              <ModalOverlay onClick={() => setUnregisteredModal({ isOpen: false, type: null })}>
                <ModalContainer onClick={(e) => e.stopPropagation()}>
                  <ModalHeader $bgColor={unregisteredModal.type === 'actionItem' ? '#fef3c7' : '#ede9fe'}>
                    <ModalTitle>
                      {unregisteredModal.type === 'actionItem' ? (
                        <>
                          <span style={{ color: '#f59e0b' }}>액션아이템</span> 미등록 과제
                        </>
                      ) : (
                        <>
                          <span style={{ color: '#8b5cf6' }}>액티비티</span> 미등록 과제
                        </>
                      )}
                    </ModalTitle>
                    <ModalCloseButton onClick={() => setUnregisteredModal({ isOpen: false, type: null })}>
                      <X size={20} />
                    </ModalCloseButton>
                  </ModalHeader>
                  <ModalBody>
                    {unregisteredModal.type === 'actionItem' ? (
                      unregisteredActionItemProjects.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                          모든 과제에 액션아이템이 등록되어 있습니다.
                        </div>
                      ) : (
                        unregisteredActionItemProjects.map((project, idx) => (
                          <ProjectListItem key={project.id || idx} {...projectRowProps(project)} style={{ cursor: 'pointer' }}>
                            <ProjectBadge $bgColor="#fee2e2" $textColor="#dc2626">
                              미등록
                            </ProjectBadge>
                            {project.사업부 && (
                              <ProjectBadge $bgColor="#e0e7ff" $textColor="#4338ca">
                                {project.사업부}
                              </ProjectBadge>
                            )}
                            {project.프로세스 && (
                              <ProjectBadge $bgColor="#dcfce7" $textColor="#16a34a">
                                {project.프로세스}
                              </ProjectBadge>
                            )}
                            <ProjectName>{project.과제명}</ProjectName>
                          </ProjectListItem>
                        ))
                      )
                    ) : (
                      unregisteredActivityProjects.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                          액션아이템이 있는 모든 과제에 액티비티가 등록되어 있습니다.
                        </div>
                      ) : (
                        unregisteredActivityProjects.map((project, idx) => (
                          <ProjectListItem key={project.id || idx} {...projectRowProps(project)} style={{ cursor: 'pointer' }}>
                            <ProjectBadge $bgColor="#fef3c7" $textColor="#d97706">
                              액티비티 미등록
                            </ProjectBadge>
                            {project.사업부 && (
                              <ProjectBadge $bgColor="#e0e7ff" $textColor="#4338ca">
                                {project.사업부}
                              </ProjectBadge>
                            )}
                            {project.프로세스 && (
                              <ProjectBadge $bgColor="#dcfce7" $textColor="#16a34a">
                                {project.프로세스}
                              </ProjectBadge>
                            )}
                            <ProjectName>{project.과제명}</ProjectName>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                              (액션아이템 {(project.액션아이템목록 || []).length}개)
                            </span>
                          </ProjectListItem>
                        ))
                      )
                    )}
                  </ModalBody>
                  <ModalFooter>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                        {unregisteredModal.type === 'actionItem'
                          ? `총 ${unregisteredActionItemProjects.length}개 과제`
                          : `총 ${unregisteredActivityProjects.length}개 과제`}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        {unregisteredModal.type === 'actionItem'
                          ? '액션아이템을 등록하면 진행률 추적이 가능합니다.'
                          : '액티비티를 등록하면 상세 진행률 추적이 가능합니다.'}
                      </div>
                    </div>
                    {canExport && (
                      <ExportButton
                        onClick={() => handleExportUnregisteredProjects(unregisteredModal.type)}
                        disabled={
                          unregisteredModal.type === 'actionItem'
                            ? unregisteredActionItemProjects.length === 0
                            : unregisteredActivityProjects.length === 0
                        }
                      >
                        <Download size={14} />
                        로컬 저장
                      </ExportButton>
                    )}
                  </ModalFooter>
                </ModalContainer>
              </ModalOverlay>
            )}

            {/* 전체 진행률 상세 모달 */}
            {progressModal && (
              <ModalOverlay onClick={() => setProgressModal(false)}>
                <ModalContainer onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px' }}>
                  <ModalHeader $bgColor="#e0f2fe">
                    <ModalTitle>
                      <span style={{ color: '#0ea5e9' }}>전체 과제</span> 진행률 현황
                    </ModalTitle>
                    <ModalCloseButton onClick={() => setProgressModal(false)}>
                      <X size={20} />
                    </ModalCloseButton>
                  </ModalHeader>
                  <ModalBody style={{ maxHeight: '60vh' }}>
                    {trendFilteredProjects.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                        표시할 과제가 없습니다.
                      </div>
                    ) : (
                      [...trendFilteredProjects]
                        .sort((a, b) => {
                          const progressA = a.진행률 ?? 0;
                          const progressB = b.진행률 ?? 0;
                          return progressB - progressA;
                        })
                        .map((project, idx) => {
                          const progress = project.진행률 ?? 0;
                          const progressColor = progress >= 80 ? '#22c55e' : progress >= 50 ? '#f59e0b' : '#ef4444';
                          return (
                            <ProjectListItem key={project.id || idx} {...projectRowProps(project)} style={{ alignItems: 'center', cursor: 'pointer' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
                                {project.사업부 && (
                                  <ProjectBadge $bgColor="#e0e7ff" $textColor="#4338ca" style={{ flexShrink: 0 }}>
                                    {project.사업부}
                                  </ProjectBadge>
                                )}
                                {project.프로세스 && (
                                  <ProjectBadge $bgColor="#dcfce7" $textColor="#16a34a" style={{ flexShrink: 0 }}>
                                    {project.프로세스}
                                  </ProjectBadge>
                                )}
                                <ProjectName style={{ flex: 1, minWidth: 0 }}>{project.과제명}</ProjectName>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0, minWidth: '180px' }}>
                                <div style={{
                                  flex: 1,
                                  height: '8px',
                                  background: '#e2e8f0',
                                  borderRadius: '4px',
                                  overflow: 'hidden',
                                  minWidth: '100px'
                                }}>
                                  <div style={{
                                    width: `${progress}%`,
                                    height: '100%',
                                    background: progressColor,
                                    borderRadius: '4px',
                                    transition: 'width 0.3s ease'
                                  }} />
                                </div>
                                <span style={{
                                  fontSize: '0.85rem',
                                  fontWeight: 600,
                                  color: progressColor,
                                  minWidth: '45px',
                                  textAlign: 'right'
                                }}>
                                  {percentText(project.진행률)}
                                </span>
                              </div>
                            </ProjectListItem>
                          );
                        })
                    )}
                  </ModalBody>
                  <ModalFooter>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                        총 {trendFilteredProjects.length}개 과제
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        평균 진행률: {trendAverageProgress}%
                      </div>
                    </div>
                    <ExportButton
                      onClick={handleExportProgressList}
                      disabled={trendFilteredProjects.length === 0}
                    >
                      <Download size={14} />
                      리스트 저장
                    </ExportButton>
                  </ModalFooter>
                </ModalContainer>
              </ModalOverlay>
            )}

            {/* 액션아이템 일정 수립률 모달 */}
            {scheduleRateModal && (
              <ModalOverlay onClick={() => setScheduleRateModal(false)}>
                <ModalContainer onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
                  <ModalHeader $bgColor="#fce7f3">
                    <ModalTitle>
                      <span style={{ color: '#ec4899' }}>목표일 미설정</span> 액션아이템
                    </ModalTitle>
                    <ModalCloseButton onClick={() => setScheduleRateModal(false)}>
                      <X size={20} />
                    </ModalCloseButton>
                  </ModalHeader>
                  <ModalBody style={{ maxHeight: '60vh' }}>
                    {unscheduledActionItems.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                        모든 액션아이템에 목표일이 설정되어 있습니다.
                      </div>
                    ) : (
                      unscheduledActionItems.map((item, idx) => (
                        <ProjectListItem key={`${item.projectId}-${item.actionItemId || idx}`}>
                          <ProjectBadge $bgColor="#fce7f3" $textColor="#be185d">
                            목표일 미설정
                          </ProjectBadge>
                          {item.division && (
                            <ProjectBadge $bgColor="#e0e7ff" $textColor="#4338ca">
                              {item.division}
                            </ProjectBadge>
                          )}
                          {item.process && (
                            <ProjectBadge $bgColor="#dcfce7" $textColor="#16a34a">
                              {item.process}
                            </ProjectBadge>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <ProjectName style={{ fontSize: '0.8rem', color: '#64748b' }}>
                              {item.projectName}
                            </ProjectName>
                            <div style={{ fontSize: '0.9rem', fontWeight: 500, color: '#1e293b', marginTop: '0.25rem' }}>
                              {item.actionItemTitle}
                            </div>
                          </div>
                        </ProjectListItem>
                      ))
                    )}
                  </ModalBody>
                  <ModalFooter>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                        총 {unscheduledActionItems.length}개 액션아이템
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        목표일을 설정하면 일정 추적이 가능합니다.
                      </div>
                    </div>
                    <ExportButton
                      onClick={handleExportUnscheduledActionItems}
                      disabled={unscheduledActionItems.length === 0}
                    >
                      <Download size={14} />
                      리스트 저장
                    </ExportButton>
                  </ModalFooter>
                </ModalContainer>
              </ModalOverlay>
            )}

            {/* 주차별 추이 상세 모달 */}
            {weeklyTrendModal.isOpen && weeklyTrendModal.week && (() => {
              const isAllWeeks = weeklyTrendModal.week === 'all';
              const weekItems = isAllWeeks ? getAllWeeklyItems() : getWeeklyItems(weeklyTrendModal.week);
              const typeLabel = trendChartType === 'project' ? '과제' : trendChartType === 'activity' ? '액티비티' : '액션아이템';
              const weekDateRange = !isAllWeeks ? getWeekDateRange(weeklyTrendModal.week) : '';
              const modalTitle = isAllWeeks ? `전체 ${typeLabel} 현황` : `${weeklyTrendModal.week}주차 (${weekDateRange}) ${typeLabel} 상세 현황`;

              return (
                <ModalOverlay onClick={closeWeeklyTrendModal}>
                  <ModalContainer
                    onClick={(e) => e.stopPropagation()}
                    style={{ maxWidth: '900px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
                  >
                    <ModalHeader $bgColor="#f0f9ff">
                      <ModalTitle style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '1.25rem' }}>{isAllWeeks ? '📋' : '📅'}</span>
                        {modalTitle}
                      </ModalTitle>
                      <ModalCloseButton onClick={closeWeeklyTrendModal}>
                        <X size={20} />
                      </ModalCloseButton>
                    </ModalHeader>
                    <ModalBody style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', padding: '1.5rem', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                      {/* 계획 목록 */}
                      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          marginBottom: '1rem',
                          paddingBottom: '0.75rem',
                          borderBottom: '3px solid #f59e0b'
                        }}>
                          <span style={{ fontSize: '1.125rem' }}>📋</span>
                          <span style={{ fontWeight: 600, color: '#1e293b' }}>
                            계획된 {typeLabel} (목표일 기준)
                          </span>
                          <span style={{
                            background: '#fef3c7',
                            color: '#d97706',
                            padding: '0.25rem 0.625rem',
                            borderRadius: '1rem',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            marginLeft: 'auto'
                          }}>
                            {weekItems.plannedItems.length}건
                          </span>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
                          {weekItems.plannedItems.length > 0 ? (
                            weekItems.plannedItems.map((item, idx) => (
                              <div key={idx} style={{
                                background: '#fffbeb',
                                border: '1px solid #fde68a',
                                borderRadius: '0.5rem',
                                padding: '0.75rem',
                                marginBottom: '0.5rem'
                              }}>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.25rem' }}>
                                  {isAllWeeks && item.weekNum && (
                                    <span style={{
                                      background: item.weekNum === '미수립' ? '#fee2e2' : '#fef3c7',
                                      color: item.weekNum === '미수립' ? '#dc2626' : '#d97706',
                                      padding: '0.125rem 0.375rem',
                                      borderRadius: '0.25rem',
                                      fontSize: '0.65rem',
                                      fontWeight: 600,
                                      marginRight: '0.25rem'
                                    }}>
                                      {item.weekNum === '미수립' ? '미수립' : `${item.weekNum}주`}
                                    </span>
                                  )}
                                  <span style={{
                                    background: '#e0e7ff',
                                    color: '#4338ca',
                                    padding: '0.125rem 0.375rem',
                                    borderRadius: '0.25rem',
                                    fontSize: '0.65rem',
                                    fontWeight: 500,
                                    marginRight: '0.5rem'
                                  }}>
                                    {item.division}
                                  </span>
                                  {item.projectName}
                                </div>
                                {item.actionItemTitle && (
                                  <div style={{ fontSize: '0.75rem', color: '#475569', marginBottom: '0.25rem', fontWeight: 500 }}>
                                    └ {item.actionItemTitle}
                                  </div>
                                )}
                                {item.activityContent && (
                                  <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.25rem', paddingLeft: '0.75rem' }}>
                                    └ {item.activityContent}
                                  </div>
                                )}
                                {!item.activityContent && (
                                  <div style={{ fontWeight: 500, color: '#1e293b', fontSize: '0.875rem' }}>
                                    {item.title || item.actionItemTitle || item.projectName}
                                  </div>
                                )}
                                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <span>🎯</span>
                                  목표일: {item.date}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                              <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>📋</span>
                              {isAllWeeks ? `계획된 ${typeLabel}이 없습니다.` : `해당 주차에 계획된 ${typeLabel}이 없습니다.`}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 완료 목록 */}
                      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          marginBottom: '1rem',
                          paddingBottom: '0.75rem',
                          borderBottom: '3px solid #10b981'
                        }}>
                          <span style={{ fontSize: '1.125rem' }}>✅</span>
                          <span style={{ fontWeight: 600, color: '#1e293b' }}>
                            완료된 {typeLabel} (완료일 기준)
                          </span>
                          <span style={{
                            background: '#dcfce7',
                            color: '#16a34a',
                            padding: '0.25rem 0.625rem',
                            borderRadius: '1rem',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            marginLeft: 'auto'
                          }}>
                            {weekItems.completedItems.length}건
                          </span>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
                          {weekItems.completedItems.length > 0 ? (
                            weekItems.completedItems.map((item, idx) => (
                              <div key={idx} style={{
                                background: '#f0fdf4',
                                border: '1px solid #bbf7d0',
                                borderRadius: '0.5rem',
                                padding: '0.75rem',
                                marginBottom: '0.5rem'
                              }}>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.25rem' }}>
                                  {isAllWeeks && item.weekNum && (
                                    <span style={{
                                      background: '#dcfce7',
                                      color: '#16a34a',
                                      padding: '0.125rem 0.375rem',
                                      borderRadius: '0.25rem',
                                      fontSize: '0.65rem',
                                      fontWeight: 600,
                                      marginRight: '0.25rem'
                                    }}>
                                      {item.weekNum === '미수립' ? '미수립' : `${item.weekNum}주`}
                                    </span>
                                  )}
                                  <span style={{
                                    background: '#e0e7ff',
                                    color: '#4338ca',
                                    padding: '0.125rem 0.375rem',
                                    borderRadius: '0.25rem',
                                    fontSize: '0.65rem',
                                    fontWeight: 500,
                                    marginRight: '0.5rem'
                                  }}>
                                    {item.division}
                                  </span>
                                  {item.projectName}
                                </div>
                                {item.actionItemTitle && (
                                  <div style={{ fontSize: '0.75rem', color: '#475569', marginBottom: '0.25rem', fontWeight: 500 }}>
                                    └ {item.actionItemTitle}
                                  </div>
                                )}
                                {item.activityContent && (
                                  <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.25rem', paddingLeft: '0.75rem' }}>
                                    └ {item.activityContent}
                                  </div>
                                )}
                                {!item.activityContent && (
                                  <div style={{ fontWeight: 500, color: '#1e293b', fontSize: '0.875rem' }}>
                                    {item.title || item.actionItemTitle || item.projectName}
                                  </div>
                                )}
                                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <span>✓</span>
                                    완료일: {item.date}
                                  </span>
                                  {item.targetDate && (
                                    <span style={{ color: '#94a3b8' }}>
                                      (목표: {item.targetDate})
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                              <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>✅</span>
                              {isAllWeeks ? `완료된 ${typeLabel}이 없습니다.` : `해당 주차에 완료된 ${typeLabel}이 없습니다.`}
                            </div>
                          )}
                        </div>
                      </div>
                    </ModalBody>
                    <ModalFooter style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.85rem', color: '#64748b' }}>
                        <span>총: <strong style={{ color: '#3b82f6' }}>{weekItems.plannedItems.length + weekItems.completedItems.length}</strong>건</span>
                        <span>|</span>
                        <span>계획: <strong style={{ color: '#f59e0b' }}>{weekItems.plannedItems.length}</strong>건</span>
                        <span>|</span>
                        <span>완료: <strong style={{ color: '#10b981' }}>{weekItems.completedItems.length}</strong>건</span>
                      </div>
                      <button
                        onClick={() => handleExportWeeklyTrendItems(weeklyTrendModal.week, weekItems.plannedItems, weekItems.completedItems)}
                        disabled={weekItems.plannedItems.length === 0 && weekItems.completedItems.length === 0}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.375rem',
                          padding: '0.5rem 1rem',
                          background: weekItems.plannedItems.length === 0 && weekItems.completedItems.length === 0 ? '#e2e8f0' : '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.375rem',
                          fontSize: '0.8rem',
                          fontWeight: 500,
                          cursor: weekItems.plannedItems.length === 0 && weekItems.completedItems.length === 0 ? 'not-allowed' : 'pointer',
                          transition: 'background 0.2s ease'
                        }}
                        onMouseOver={(e) => {
                          if (weekItems.plannedItems.length > 0 || weekItems.completedItems.length > 0) {
                            e.currentTarget.style.background = '#2563eb';
                          }
                        }}
                        onMouseOut={(e) => {
                          if (weekItems.plannedItems.length > 0 || weekItems.completedItems.length > 0) {
                            e.currentTarget.style.background = '#3b82f6';
                          }
                        }}
                      >
                        <Download size={14} />
                        리스트 저장
                      </button>
                    </ModalFooter>
                  </ModalContainer>
                </ModalOverlay>
              );
            })()}
          </TrendContainer>
        );

      case 'issues': {
        const { map: issueMap, orderedDivs, totalIssues, unresolvedCount } = issuesByDivision;
        const visibleDivs = issueSelectedDivision === 'all'
          ? orderedDivs
          : orderedDivs.filter(d => d === issueSelectedDivision);

        const statusFilters = [
          { key: 'all', label: '전체' },
          { key: 'unresolved', label: '미해결' },
          { key: 'resolved', label: '해결' },
        ];
        const periodPresets = [
          { key: 'year', label: '연간 전체' },
          { key: 'lastWeek', label: '최근 한 주' },
          { key: 'lastMonth', label: '최근 한 달' },
          { key: 'firstHalf', label: '상반기' },
          { key: 'secondHalf', label: '하반기' },
        ];

        const renderIssueRow = ({ issue, project }, idx) => {
          const resolved = !!issue.해결여부;
          return (
            <div
              key={issue.id || `${project.id}-${idx}`}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                padding: '0.75rem 0.875rem', borderRadius: '0.5rem',
                borderLeft: `4px solid ${resolved ? '#10b981' : '#ef4444'}`,
                background: resolved ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${resolved ? '#d1fae5' : '#fecaca'}`,
                borderLeftWidth: '4px',
              }}
            >
              <div style={{ marginTop: '0.1rem', color: resolved ? '#10b981' : '#ef4444', flexShrink: 0 }}>
                {resolved ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1f2937', wordBreak: 'break-word' }}>
                  {issue.제목 || '(제목 없음)'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.35rem', fontSize: '0.75rem', color: '#64748b' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontWeight: 500, color: '#475569', minWidth: 0, maxWidth: '100%' }}>
                    <FolderOpen size={12} style={{ flexShrink: 0 }} />
                    <span style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }} title={project.과제명 || ''}>
                      {project.과제명 || '(과제명 없음)'}
                    </span>
                  </span>
                  {project.프로세스 && <span>· {project.프로세스}</span>}
                  {issue.등록일 && <span>· 등록 {issue.등록일}</span>}
                  {resolved && issue.해결일 && <span style={{ color: '#10b981' }}>· 해결 {issue.해결일}</span>}
                </div>
                {issue.코멘트 && (
                  <div style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: '#6b7280', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {issue.코멘트}
                  </div>
                )}
              </div>
              <span style={{
                flexShrink: 0, padding: '0.2rem 0.5rem', borderRadius: '0.375rem',
                fontSize: '0.7rem', fontWeight: 700,
                color: resolved ? '#047857' : '#b91c1c',
                background: resolved ? '#d1fae5' : '#fee2e2',
              }}>
                {resolved ? '해결됨' : '미해결'}
              </span>
            </div>
          );
        };

        // 사무국 코멘트 에디터 (추가/수정 공용)
        const renderSecretariatEditor = (onSave, submitLabel) => (
          <div style={{ padding: '0.7rem 0.8rem', background: '#f8fafc', border: '1px dashed #a5b4fc', borderRadius: '0.5rem' }}>
            <div style={{ position: 'relative' }}>
              <textarea
                ref={secretariatTextareaRef}
                value={secretariatDraft}
                onChange={handleSecretariatDraftChange}
                onBlur={() => setTimeout(() => setMentionOpen(false), 150)}
                autoFocus
                placeholder="사무국 코멘트를 입력하세요 (@ 입력 시 과제 연결)"
                style={{ width: '100%', minHeight: '56px', padding: '0.45rem 0.55rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', fontSize: '0.8rem', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
              {mentionOpen && mentionSuggestions.length > 0 && (
                <div style={{ position: 'absolute', zIndex: 20, left: 0, right: 0, top: '100%', marginTop: '2px', maxHeight: '180px', overflowY: 'auto', background: '#fff', border: '1px solid #c7d2fe', borderRadius: '0.375rem', boxShadow: '0 6px 18px rgba(0,0,0,0.12)' }}>
                  {mentionSuggestions.map(p => (
                    <div
                      key={p.uuid || p.id}
                      onMouseDown={(e) => { e.preventDefault(); applyMention(p); }}
                      style={{ padding: '0.4rem 0.6rem', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: '1px solid #f1f5f9' }}
                    >
                      <span style={{ fontWeight: 600, color: '#312e81', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.과제명}</span>
                      <span style={{ marginLeft: 'auto', flexShrink: 0, fontSize: '0.68rem', color: '#94a3b8' }}>{p.사업부}{p.과제년도 ? ` · ${p.과제년도}` : ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem', justifyContent: 'flex-end' }}>
              <button
                onClick={resetSecretariatEditor}
                disabled={secretariatSaving}
                style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem', color: '#475569', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '0.375rem', cursor: 'pointer' }}
              >
                취소
              </button>
              <button
                onClick={onSave}
                disabled={secretariatSaving || !secretariatDraft.trim()}
                style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem', fontWeight: 600, color: '#fff', background: '#4f46e5', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', opacity: (secretariatSaving || !secretariatDraft.trim()) ? 0.6 : 1 }}
              >
                {secretariatSaving ? '저장 중…' : submitLabel}
              </button>
            </div>
          </div>
        );

        return (
          <TrendContainer>
            <TrendHeader>
              <TrendHeaderLeft>
                <TrendTitle>
                  🚨 이슈 현황
                  <span style={{ marginLeft: '0.75rem', fontSize: '0.8rem', fontWeight: 500, color: '#64748b' }}>
                    전체 {totalIssues}건 · 미해결 <span style={{ color: '#ef4444', fontWeight: 700 }}>{unresolvedCount}</span>건
                  </span>
                </TrendTitle>
              </TrendHeaderLeft>
              <TrendHeaderRight>
                <TrendYearSelector>
                  <TrendYearButton onClick={handlePrevYear}>‹</TrendYearButton>
                  <TrendYearDisplay>{currentYear}년</TrendYearDisplay>
                  <TrendYearButton onClick={handleNextYear}>›</TrendYearButton>
                </TrendYearSelector>
              </TrendHeaderRight>
            </TrendHeader>

            {/* 상태 · 기간 필터 */}
            <div style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem',
              padding: '0.75rem 1rem', borderBottom: '1px solid #e5e7eb', background: '#f8fafc',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569' }}>상태</span>
                {statusFilters.map(s => (
                  <TrendFilterButton
                    key={s.key}
                    $active={issueStatusFilter === s.key}
                    onClick={() => setIssueStatusFilter(s.key)}
                  >
                    {s.label}
                  </TrendFilterButton>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', fontWeight: 600, color: '#475569' }}>
                  <Calendar size={13} /> 기간
                </span>
                {periodPresets.map(pz => (
                  <TrendFilterButton
                    key={pz.key}
                    $active={issuePeriodPreset === pz.key}
                    onClick={() => { setIssuePeriodPreset(pz.key); setIssueStartDate(''); setIssueEndDate(''); }}
                  >
                    {pz.label}
                  </TrendFilterButton>
                ))}
                <input
                  type="date"
                  value={issueStartDate || issueRange.start}
                  onChange={(e) => { setIssueStartDate(e.target.value); setIssuePeriodPreset('custom'); }}
                  style={{ padding: '0.35rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.78rem', background: 'white' }}
                />
                <span style={{ color: '#94a3b8' }}>~</span>
                <input
                  type="date"
                  value={issueEndDate || issueRange.end}
                  onChange={(e) => { setIssueEndDate(e.target.value); setIssuePeriodPreset('custom'); }}
                  style={{ padding: '0.35rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.78rem', background: 'white' }}
                />
              </div>
            </div>

            {/* 사업부 필터 */}
            <TrendFilterBar>
              <TrendFilterButton
                $active={issueSelectedDivision === 'all'}
                onClick={() => setIssueSelectedDivision('all')}
              >
                전체
                <TrendFilterBadge $active={issueSelectedDivision === 'all'}>{totalIssues}</TrendFilterBadge>
              </TrendFilterButton>
              {orderedDivs.map(div => (
                <TrendFilterButton
                  key={div}
                  $active={issueSelectedDivision === div}
                  onClick={() => setIssueSelectedDivision(div)}
                >
                  {div}
                  <TrendFilterBadge $active={issueSelectedDivision === div}>{issueMap.get(div).length}</TrendFilterBadge>
                </TrendFilterButton>
              ))}
            </TrendFilterBar>

            <TrendContent>
              {orderedDivs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#9ca3af', fontSize: '0.9rem' }}>
                  {currentYear}년 과제가 없습니다.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.25rem 0' }}>
                  {visibleDivs.map(div => {
                    const rows = issueMap.get(div);
                    const comments = getSecretariatComments(div).filter(c => isInIssuePeriod(c.등록일));
                    const isEditing = editingSecretariatDiv === div;
                    return (
                      <div key={div}>
                        {/* 사업부 헤더 (전체폭) */}
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '0.5rem',
                          padding: '0.4rem 0.25rem', marginBottom: '0.6rem',
                          borderBottom: '2px solid #e2e8f0',
                        }}>
                          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>{div}</span>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>이슈 {rows.length}건 · 코멘트 {comments.length}건</span>
                        </div>

                        {/* 2열: 좌(이슈 6) / 우(사무국 코멘트 4) */}
                        <div style={{ display: 'grid', gridTemplateColumns: '6fr 4fr', gap: '1rem', alignItems: 'start' }}>
                          {/* 좌: 이슈 */}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#b91c1c', marginBottom: '0.45rem' }}>
                              🚨 이슈 <span style={{ color: '#94a3b8', fontWeight: 500 }}>({rows.length})</span>
                            </div>
                            {rows.length === 0 ? (
                              /* 이슈 없으면 공란 */
                              <div style={{ padding: '0.5rem 0.25rem', fontSize: '0.8rem', color: '#cbd5e1' }}>—</div>
                            ) : (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.5rem', alignItems: 'start' }}>
                                {rows.map((r, i) => renderIssueRow(r, i))}
                              </div>
                            )}
                          </div>

                          {/* 우: 사무국 코멘트 */}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.74rem', fontWeight: 700, color: '#4338ca', marginBottom: '0.45rem' }}>
                              🏛️ 사무국 코멘트 <span style={{ color: '#94a3b8', fontWeight: 500 }}>({comments.length})</span>
                              {canEditSecretariat && !isEditing && (
                                <button
                                  onClick={() => { resetSecretariatEditor(); setEditingSecretariatDiv(div); }}
                                  style={{
                                    marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                                    padding: '0.2rem 0.6rem', fontSize: '0.72rem', fontWeight: 600,
                                    color: '#4338ca', background: '#eef2ff', border: '1px solid #c7d2fe',
                                    borderRadius: '0.375rem', cursor: 'pointer',
                                  }}
                                >
                                  <Plus size={12} /> 추가
                                </button>
                              )}
                            </div>
                            {(comments.length === 0 && !isEditing) ? (
                              /* 코멘트 없으면 공란 */
                              <div style={{ padding: '0.5rem 0.25rem', fontSize: '0.8rem', color: '#cbd5e1' }}>—</div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {comments.map(c => (
                                  editingCommentId === c.id ? (
                                    <div key={c.id}>
                                      {renderSecretariatEditor(() => updateSecretariatComment(div, c.id), '저장')}
                                    </div>
                                  ) : (
                                    <div key={c.id} style={{ position: 'relative', padding: '0.7rem 0.8rem', background: '#eef2ff', border: '1px solid #c7d2fe', borderLeft: '4px solid #6366f1', borderRadius: '0.5rem' }}>
                                      <div style={{ fontSize: '0.82rem', color: '#312e81', whiteSpace: 'pre-wrap', wordBreak: 'break-word', paddingRight: canEditSecretariat ? '2.6rem' : 0 }}>{renderCommentWithMentions(c.내용, c.mentions)}</div>
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '0.4rem', fontSize: '0.7rem', color: '#6366f1' }}>
                                        {c.등록일 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}><Calendar size={11} />{c.등록일}</span>}
                                        {c.작성자 && <span>· {c.작성자}</span>}
                                        {c.수정일 && <span style={{ color: '#94a3b8' }}>· 수정 {c.수정일}</span>}
                                      </div>
                                      {canEditSecretariat && (
                                        <div style={{ position: 'absolute', top: '0.4rem', right: '0.4rem', display: 'flex', gap: '0.15rem' }}>
                                          <button
                                            title="수정"
                                            onClick={() => startEditSecretariatComment(div, c)}
                                            disabled={secretariatSaving}
                                            style={{ display: 'inline-flex', padding: '0.15rem', color: '#6366f1', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '0.25rem' }}
                                          >
                                            <Pencil size={13} />
                                          </button>
                                          <button
                                            title="삭제"
                                            onClick={() => deleteSecretariatComment(div, c.id)}
                                            disabled={secretariatSaving}
                                            style={{ display: 'inline-flex', padding: '0.15rem', color: '#6366f1', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '0.25rem' }}
                                          >
                                            <Trash2 size={13} />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )
                                ))}

                                {/* 새 코멘트 입력 카드 */}
                                {isEditing && renderSecretariatEditor(() => addSecretariatComment(div), '추가')}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TrendContent>
          </TrendContainer>
        );
      }

      case 'report':
        return (
          <TrendContainer>
            <TrendHeader>
              <TrendHeaderLeft>
                <TrendTitle>
                  📋 결과 보고서
                </TrendTitle>
              </TrendHeaderLeft>
              <TrendHeaderRight>
                <TrendYearSelector>
                  <TrendYearButton onClick={handlePrevYear}>‹</TrendYearButton>
                  <TrendYearDisplay>{currentYear}년</TrendYearDisplay>
                  <TrendYearButton onClick={handleNextYear}>›</TrendYearButton>
                </TrendYearSelector>
              </TrendHeaderRight>
            </TrendHeader>
            <ProjectReportView
              projects={projects}
              globalPerformances={globalPerformances}
              currentYear={currentYear}
              settingsData={settingsData}
              onEditProject={onEditProject}
            />
          </TrendContainer>
        );

      default:
        return null;
    }
  };

  // allProjects, comparison 탭일 때는 패딩 없이 전체 화면 사용
  const isFullScreenTab = subTab === 'executive' || subTab === 'allProjects' || subTab === 'comparison' || subTab === 'trend' || subTab === 'kpi' || subTab === 'issues' || subTab === 'report';

  return (
    <Container $noPadding={isFullScreenTab} $fullHeight={isFullScreenTab}>
      <motion.div
        key={subTab}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={isFullScreenTab ? { height: '100%' } : {}}
      >
        {renderSubTabContent()}
      </motion.div>

      {/*
        과제 상세 모달 — 전체 요약의 여러 상세 모달 안에서 과제를 누르면 뜬다.
        **여기 한 곳에만 둔다** — 목록마다 모달을 두면 열림 상태가 갈리고, 모달 위에
        모달이 겹칠 때 z-index 를 각자 맞춰야 한다. '모든 과제 현황' 과 같은 컴포넌트다.
      */}
      <ProjectDetailModal
        project={detailProject}
        onClose={() => setDetailProject(null)}
        performances={globalPerformances}
        divisionColors={divisionColors}
        statusColors={statusColors}
      />
    </Container>
  );
};

export default DashboardView;