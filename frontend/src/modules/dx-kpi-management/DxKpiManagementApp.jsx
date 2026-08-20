import React, { useState, useCallback, useMemo, useEffect, useRef, startTransition } from 'react';
import styled from 'styled-components';
import XLSX from 'xlsx-js-style';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Header from './components/Layout/Header';
import SettingsModal from './components/SettingsModal';
import WeeklyTrendModal from './components/WeeklyTrendModal';
import ImportModal from './components/ImportModal';
import BulkGrid from './components/BulkGrid';
import KpiLineChart from './components/KpiLineChart';
import { fetchRecords, createRecord, createRecordsBulk, updateRecord as updateRecordApi, deleteRecord as deleteRecordApi, fetchTargets, saveTargets, fetchCriteria, fetchAttachments, uploadAttachment, downloadAttachment, downloadAllAttachments, deleteAttachment as deleteAttachmentApi, fetchKpiDefinitions, fetchWeeklyTrends, upsertWeeklyTrend, deleteWeeklyTrend as deleteWeeklyTrendApi } from './services/kpiApi';
import { todayLocalYmd } from '../../shared/utils/localDate';
import {
  achievement as calcAchievementRaw,
  achievementColor,
} from '../../shared/utils/kpiAchievement';
import {
  MONTHS, MONTH_TO_QUARTER, monthLabelOf, weekLabelOf, weeksForYear, monthLabelForWeek,
} from '../../shared/utils/kpiPeriod';

/*
  주·월·분기 라벨은 **공용 셈법 하나**를 쓴다(shared/utils/kpiPeriod).
  대시보드의 사업부별 KPI 그래프도 같은 것을 쓰므로, 같은 날짜가 두 화면에서
  다른 주로 잡히는 일이 없다. 예전에는 이 파일 안에 제 사본을 갖고 있었다.
*/
const getMonth = monthLabelOf;
const getWeek = weekLabelOf;
const getWeeksForYear = weeksForYear;
const getMonthForWeek = monthLabelForWeek;

const DIVISIONS = [
  { id: 'mx', name: 'MX' },
  { id: 'vd', name: 'VD' },
  { id: 'da', name: 'DA' },
  { id: 'nw', name: 'NW' },
  { id: 'medical', name: '의료기기' },
];

const DIVISION_ID_BY_NAME = DIVISIONS.reduce((acc, d) => { acc[d.name] = d.id; return acc; }, {});

// KPI 정의 필터링: divisions 미지정 또는 빈 배열이면 전 사업부 공통, 지정 시 해당 사업부 전용
const filterKpisForDivision = (definitions, divisionId) =>
  definitions.filter(item => !item.divisions || item.divisions.length === 0 || item.divisions.includes(divisionId));

const CATEGORY_COLORS = {
  '개발': { bg: '#eff6ff', text: '#1d4ed8', border: '#93c5fd' },
  '제조': { bg: '#f0fdf4', text: '#15803d', border: '#86efac' },
  '품질': { bg: '#fef3c7', text: '#b45309', border: '#fcd34d' },
};

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f8fafc;
`;

const MainContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 24px;
`;

const TableWrapper = styled.div`
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  overflow: hidden;
`;

const TableHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid #e2e8f0;
`;

const TableTitle = styled.h2`
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
`;

const RecordCount = styled.span`
  font-size: 13px;
  color: #64748b;
  background: #f1f5f9;
  padding: 4px 10px;
  border-radius: 12px;
`;

const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;

  th {
    background: #f8fafc;
    padding: 8px 10px;
    text-align: left;
    font-size: 12px;
    font-weight: 600;
    color: #64748b;
    border-bottom: 1px solid #e2e8f0;
    white-space: nowrap;
  }

  td {
    padding: 7px 10px;
    font-size: 13px;
    color: #334155;
    border-bottom: 1px solid #f1f5f9;
  }

  tr:last-child td {
    border-bottom: none;
  }

  tr:hover td {
    background: #f8fafc;
  }
`;

const CategoryBadge = styled.span`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  background: ${props => props.$bg};
  color: ${props => props.$color};
  border: 1px solid ${props => props.$border};
`;

const YearSelectorContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-bottom: 1rem;
  gap: 12px;
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

const EmptyState = styled.div`
  text-align: center;
  padding: 60px 20px;
  color: #94a3b8;
  font-size: 14px;
`;

const ActionBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  font-size: 13px;
  padding: 4px 8px;
  border-radius: 4px;
  color: ${props => props.$color || '#64748b'};
  &:hover {
    background: ${props => props.$hoverBg || '#f1f5f9'};
  }
`;

const InlineInput = styled.input`
  width: 70px;
  padding: 4px 6px;
  border: 1px solid #8b5cf6;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 700;
  color: #334155;
  outline: none;
  background: #fff;
  text-align: center;
  &:focus {
    box-shadow: 0 0 0 2px rgba(139,92,246,0.15);
  }
`;

const InlineValue = styled.span`
  cursor: pointer;
  padding: 3px 6px;
  border-radius: 4px;
  border: 1px solid transparent;
  &:hover {
    background: #f1f5f9;
    border-color: #e2e8f0;
  }
`;

/* ── KPI 추세 그래프 (KPI 마다 한 장) ── */

const ChartArea = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: calc(100vh - 320px);
  min-height: 400px;
  background: #fff;
`;

const ChartEmpty = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #94a3b8;
  font-size: 14px;
`;

const ChartLegend = styled.div`
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
  flex-shrink: 0;
  font-size: 12px;
  color: #475569;

  span { display: inline-flex; align-items: center; gap: 6px; }
  i { display: inline-block; width: 18px; height: 2px; }
`;

const ChartGrid = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  align-content: start;
  padding-right: 4px;

  /* 좁으면 한 줄에 하나 — 둘을 억지로 넣으면 가로축 글씨가 겹친다 */
  @media (max-width: 1100px) { grid-template-columns: 1fr; }
`;

const ChartCard = styled.div`
  /* 부모가 세로 flex 스크롤 상자라, 안 박아 두면 장 수가 늘 때 전부 납작해진다 */
  flex-shrink: 0;
  padding: 10px 12px 6px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
`;

const ChartTitle = styled.div`
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 2px;

  b { font-size: 13px; font-weight: 700; color: #1e293b; }
  em { font-style: normal; font-size: 11.5px; color: #64748b; }
  small { margin-left: auto; font-size: 11px; color: #94a3b8; }
`;

const Toast = styled.div`
  position: fixed;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  background: #1e293b;
  color: #fff;
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 4px 16px rgba(0,0,0,0.2);
  z-index: 3000;
  animation: toastIn 0.2s ease;
  @keyframes toastIn {
    from { opacity: 0; transform: translateX(-50%) translateY(10px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
`;

const DeleteBtn = styled.button`
  background: none;
  border: none;
  color: #ef4444;
  cursor: pointer;
  font-size: 13px;
  padding: 4px 8px;
  border-radius: 4px;
  &:hover {
    background: #fef2f2;
  }
`;

/* ── Modal ── */
const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
`;

const Modal = styled.div`
  background: #fff;
  border-radius: 16px;
  width: 480px;
  max-width: 90vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
  overflow: hidden;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
`;

const ModalTitle = styled.h3`
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
`;

const CloseBtn = styled.button`
  background: none;
  border: none;
  font-size: 22px;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px;
  line-height: 1;
  &:hover { color: #475569; }
`;

const ModalBody = styled.div`
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
  flex: 1;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Label = styled.label`
  font-size: 13px;
  font-weight: 600;
  color: #475569;
`;

const Select = styled.select`
  padding: 10px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 14px;
  color: #334155;
  background: #fff;
  outline: none;
  &:focus { border-color: #8b5cf6; box-shadow: 0 0 0 3px rgba(139,92,246,0.15); }
`;

const Input = styled.input`
  padding: 10px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 14px;
  color: #334155;
  outline: none;
  &:focus { border-color: #8b5cf6; box-shadow: 0 0 0 3px rgba(139,92,246,0.15); }
`;

const CategoryDisplay = styled.div`
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  background: #f8fafc;
  color: ${props => props.$color || '#64748b'};
  font-weight: 500;
`;

const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 24px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
  flex-shrink: 0;
`;

const Btn = styled.button`
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s;
`;

const CancelBtn = styled(Btn)`
  background: #fff;
  color: #64748b;
  border-color: #e2e8f0;
  &:hover { background: #f1f5f9; }
`;

const SubmitBtn = styled(Btn)`
  background: #8b5cf6;
  color: #fff;
  &:hover { background: #7c3aed; }
  &:disabled { background: #c4b5fd; cursor: not-allowed; }
`;

/* ── Bulk Entry ── */
const ModeToggle = styled.div`
  display: flex;
  background: #f1f5f9;
  border-radius: 8px;
  padding: 3px;
  border: 1px solid #e2e8f0;
`;

const ModeBtn = styled.button`
  padding: 6px 14px;
  border: none;
  background: ${p => p.$active ? '#8b5cf6' : 'transparent'};
  color: ${p => p.$active ? '#fff' : '#64748b'};
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { background: ${p => p.$active ? '#7c3aed' : '#e2e8f0'}; }
`;

const DivisionToggle = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
`;

const DivisionBtn = styled.button`
  padding: 7px 14px;
  border: 1px solid ${p => p.$active ? '#8b5cf6' : '#e2e8f0'};
  background: ${p => p.$active ? '#8b5cf6' : '#fff'};
  color: ${p => p.$active ? '#fff' : '#64748b'};
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  &:hover {
    border-color: ${p => p.$active ? '#7c3aed' : '#cbd5e1'};
    background: ${p => p.$active ? '#7c3aed' : '#f8fafc'};
  }
`;

const MonthEndSelect = styled.select`
  padding: 8px 6px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 13px;
  color: #334155;
  background: #fff;
  outline: none;
  width: 90px;
  flex-shrink: 0;
  &:focus { border-color: #8b5cf6; box-shadow: 0 0 0 3px rgba(139,92,246,0.15); }
`;

function getLastDayOfMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/**
 * 'YYYY-MM-DD' 에 며칠을 더한다. 달·해가 바뀌어도 알아서 넘어간다.
 *
 * ⚠️ `new Date('2026-08-09')` 는 **UTC 자정**으로 읽혀 시간대에 따라 하루가 밀린다.
 *    연·월·일을 따로 넘겨 **그 자리 시간**으로 만든다.
 */
function addDaysYmd(ymd, days) {
  const [y, m, d] = String(ymd || '').split('-').map(Number);
  if (!y || !m || !d) return '';
  const dt = new Date(y, m - 1, d + days);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

function makeMonthEndDate(year, month) {
  const lastDay = getLastDayOfMonth(year, month);
  const mm = String(month).padStart(2, '0');
  const dd = String(lastDay).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/* ── Summary View ── */

const SummaryTable = styled.table`
  width: 100%;
  border-collapse: collapse;

  th {
    background: #f8fafc;
    padding: 6px 6px;
    font-size: 11px;
    font-weight: 600;
    color: #64748b;
    border-bottom: 2px solid #e2e8f0;
    text-align: center;
    white-space: nowrap;
    position: sticky;
    top: 0;
    z-index: 2;
  }

  td {
    padding: 5px 6px;
    font-size: 12px;
    color: #334155;
    border-bottom: 1px solid #f1f5f9;
    text-align: center;
  }

  tr:last-child td {
    border-bottom: none;
  }

  tr:hover td {
    background: #fafbfc;
  }
`;

const QuarterGroup = styled.col``;

const SubHeader = styled.th`
  font-size: 10px !important;
  padding: 4px 4px !important;
  color: ${p => p.$color || '#64748b'} !important;
  background: ${p => p.$bg || '#f8fafc'} !important;
  border-bottom: 1px solid #e2e8f0 !important;
  top: 28px !important;
`;

const KpiNameCell = styled.td`
  text-align: left !important;
  font-weight: 500;
  word-break: keep-all;
`;

const CategoryTd = styled.td`
  font-size: 12px !important;
  font-weight: 600;
  text-align: left !important;
`;

const ValueCell = styled.td`
  font-weight: ${p => p.$bold ? '700' : '400'};
  color: ${p => p.$color || '#334155'} !important;
  background: ${p => p.$bg || 'transparent'} !important;
`;

const DivisionHeader = styled.td`
  background: #f1f5f9 !important;
  font-size: 12px !important;
  font-weight: 700 !important;
  color: #1e293b !important;
  text-align: left !important;
  padding: 6px 8px !important;
  border-bottom: 2px solid #e2e8f0 !important;
  letter-spacing: 0.5px;
`;

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
function getQuarter(dateStr) {
  if (!dateStr) return null;
  const month = parseInt(dateStr.split('-')[1], 10);
  if (month >= 1 && month <= 3) return 'Q1';
  if (month >= 4 && month <= 6) return 'Q2';
  if (month >= 7 && month <= 9) return 'Q3';
  if (month >= 10 && month <= 12) return 'Q4';
  return null;
}

const PeriodToggle = styled.div`
  display: flex;
  background: #f1f5f9;
  border-radius: 8px;
  padding: 3px;
  border: 1px solid #e2e8f0;
`;

const PeriodBtn = styled.button`
  padding: 6px 14px;
  border: none;
  background: ${p => p.$active ? '#8b5cf6' : 'transparent'};
  color: ${p => p.$active ? '#fff' : '#64748b'};
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  &:hover {
    background: ${p => p.$active ? '#7c3aed' : '#e2e8f0'};
  }
`;

const FilterBar = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  margin-bottom: 10px;
`;

const FilterRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
`;

const FilterLabel = styled.span`
  font-size: 12px;
  font-weight: 700;
  color: #334155;
  min-width: 60px;
  flex-shrink: 0;
`;

const FilterChip = styled.button`
  padding: 3px 10px;
  border: 1px solid ${p => p.$active ? '#8b5cf6' : '#cbd5e1'};
  background: ${p => p.$active ? '#8b5cf6' : '#fff'};
  color: ${p => p.$active ? '#fff' : '#94a3b8'};
  border-radius: 14px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s;
  &:hover {
    background: ${p => p.$active ? '#7c3aed' : '#f1f5f9'};
    border-color: ${p => p.$active ? '#7c3aed' : '#94a3b8'};
  }
`;

const FilterResetBtn = styled.button`
  padding: 3px 10px;
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #64748b;
  border-radius: 14px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  margin-left: auto;
  &:hover {
    color: #dc2626;
    border-color: #fca5a5;
    background: #fef2f2;
  }
`;

const FilterActionBtn = styled.button`
  padding: 2px 8px;
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
  text-decoration-color: #cbd5e1;
  text-decoration-style: dotted;
  text-underline-offset: 3px;
  &:hover {
    color: #8b5cf6;
    text-decoration-color: #8b5cf6;
  }
`;

function formatValue(val, unit) {
  if (!val) return '';
  const num = parseFloat(val);
  if (isNaN(num)) return val;
  return `${num.toFixed(1)}${unit || ''}`;
}

/**
 * 달성률 — 계산은 공용 모듈이 한다 (`shared/utils/kpiAchievement`).
 *
 * 예전에는 여기서 `실적/목표` 만 했다. 그래서 **망소 지표(Lead Time·라인 유실률·ASR)
 * 의 달성률이 뒤집혀** 있었고, 100/80 경계로 칠하는 색까지 반대로 나왔다.
 * (실측 2026-08-01: 라인 유실률 MX 목표1%/실적2% → 200% 초록. 실제는 50% 빨강)
 *
 * `direction` 을 **반드시 넘겨야 한다.** 안 넘기면 예전 동작(망대)으로 조용히 돌아간다.
 */
function calcAchievement(target, actual, direction) {
  const rate = calcAchievementRaw(target, actual, direction || 'higher');
  return rate === null ? null : rate.toFixed(1);
}

// targets는 {value, numerator, denominator} 형태 또는 문자열 (역호환)
const getTargetValue = (t) => {
  if (t == null) return '';
  if (typeof t === 'object') return t.value || '';
  return t;
};
const getTargetFraction = (t) => {
  if (t && typeof t === 'object') return { numerator: t.numerator, denominator: t.denominator };
  return { numerator: null, denominator: null };
};

// 분자/분모 표시 형식: "75.0% (300/400)"
function formatFractionDisplay(value, unit, numerator, denominator) {
  if (!value) return '';
  const valStr = formatValue(value, unit);
  if (numerator && denominator) {
    return `${valStr} (${numerator}/${denominator})`;
  }
  return valStr;
}

const DxKpiManagementApp = ({ onGoHome }) => {
  // 들어오면 「KPI 종합 데이터」의 그래프부터 본다 — 처음 보는 것은 대개 추세이고,
  // Raw 데이터는 값을 넣거나 고칠 때 들어가는 화면이다.
  const [viewMode, setViewMode] = useState('summary');
  const [records, setRecords] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedKpis, setSelectedKpis] = useState([]);
  const [kpiEntries, setKpiEntries] = useState({});
  const [selectedKpi, setSelectedKpi] = useState(''); // edit mode only
  const [selectedDivision, setSelectedDivision] = useState('');
  const [value, setValue] = useState('');
  const [baseDate, setBaseDate] = useState('');
  const [targets, setTargets] = useState({});
  const [criteria, setCriteria] = useState({});
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [summaryPeriod, setSummaryPeriod] = useState('graph');
  const [summaryCompact, setSummaryCompact] = useState(false); // false: 펼치기(목표/실적/달성률), true: 접기(실적만)
  /*
    그래프에 그릴 KPI 들. **여러 개를 동시에 그린다.**

    🐞 예전에는 하나만 골라 차트 한 장을 갈아 끼웠다. 그런데 KPI 는 서로 견주며
       보는 것이라, 하나를 보려면 나머지를 지우는 조작이 매번 들어갔다.
       빈 배열이면 **고른 사업부의 KPI 전부**를 그린다.
  */
  const [graphKpis, setGraphKpis] = useState([]);
  /*
    그래프에 그릴 사업부. **전부 골라 둔 채로 시작한다.**

    빈 배열이면 그래프 자리에 「사업부를 1개 이상 선택하세요」만 뜬다. 들어오자마자
    그래프를 보여 주기로 한 이상, 첫 화면이 안내문이면 뜻이 없다.
    (2026년 자료 기준으로 11장이 그려진다 — 골라 둔 사업부의 KPI 전부다)
  */
  const [graphDivisions, setGraphDivisions] = useState(DIVISIONS.map(d => d.name));
  const [graphAxis, setGraphAxis] = useState('week'); // 'week' | 'month'
  const [graphTargetDivision, setGraphTargetDivision] = useState('');
  const [entryMode, setEntryMode] = useState('single'); // 'single' | 'bulk'
  /*
    일괄 입력 격자 — 행은 KPI, 열은 날짜.

    예전에는 KPI 한 개에 (날짜, 값) 줄을 다는 방식이라, 사업부 하나를 넣으려면
    좌측에서 KPI 를 열 번 바꿔 가며 같은 일을 열 번 해야 했다. 정작 원본(주간보고·
    엑셀)은 **KPI × 기간 표**라 모양이 달라 옮겨 적는 내내 눈이 왔다 갔다 했다.
    화면을 원본과 같은 모양으로 맞춘다.
  */
  const [gridDates, setGridDates] = useState([]);
  const [gridValues, setGridValues] = useState({});   // {kpi: {date: {...}}}
  /*
    단건 모드의 **기준 날짜 — 한 개뿐이다.**

    🐞 예전에는 행마다 날짜 칸이 따로 있었다. 그런데 값을 열 개 넣을 때
       탭이 「날짜 → 값 → 날짜 → 값」으로 지나가서, 정작 치려는 값 칸에
       닿기까지 매번 한 칸을 건너뛰어야 했다.
       서로 다른 날짜를 넣는 일은 드물고, 그럴 땐 KPI 하나만 골라 따로 넣으면 된다.
       그래서 날짜는 **위에서 한 번만** 받고 행에서는 없앴다 — 이제 탭이 값에서 값으로 간다.
  */
  const [commonDate, setCommonDate] = useState('');
  /* 항목을 새로 켤 때 **지금 고른 날짜**를 넣어야 하는데, 그 콜백들에 `commonDate`
     의존성을 달면 날짜를 바꿀 때마다 함수가 새로 만들어진다. 읽기만 하므로 ref 로 든다. */
  const commonDateRef = useRef('');
  useEffect(() => { commonDateRef.current = commonDate; }, [commonDate]);
  const [editingRecord, setEditingRecord] = useState(null); // record being edited
  const [inlineEditId, setInlineEditId] = useState(null);
  const [inlineEditValue, setInlineEditValue] = useState('');
  const [toast, setToast] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [dragOverCell, setDragOverCell] = useState(null); // `${division}::${kpi}::${month}` while dragging files over a cell
  // Summary table filters: hidden Set is empty by default (= all visible). Items in the set are hidden.
  const [hiddenDivisions, setHiddenDivisions] = useState(() => new Set());
  const [hiddenCategories, setHiddenCategories] = useState(() => new Set());
  const [hiddenKpis, setHiddenKpis] = useState(() => new Set());
  const [kpiDefinitions, setKpiDefinitions] = useState([]);
  const [editNumerator, setEditNumerator] = useState('');
  const [editDenominator, setEditDenominator] = useState('');
  const [weeklyTrends, setWeeklyTrends] = useState([]);
  const [showImport, setShowImport] = useState(false);
  const [showTrendModal, setShowTrendModal] = useState(false);
  const [editingTrend, setEditingTrend] = useState(null);
  const [trendVisibleDivisions, setTrendVisibleDivisions] = useState(() => DIVISIONS.map(d => d.name));
  const [trendVisibleCategories, setTrendVisibleCategories] = useState(['개발', '제조']);

  // KPI 정의 로드 (서버 시드 데이터 포함)
  const loadKpiDefinitions = useCallback(() => {
    return fetchKpiDefinitions().then(data => setKpiDefinitions(data)).catch(console.error);
  }, []);

  // DB에서 데이터 로드
  const loadRecords = useCallback(() => {
    fetchRecords().then(data => setRecords(data)).catch(console.error);
  }, []);

  const loadWeeklyTrends = useCallback(() => {
    fetchWeeklyTrends().then(data => setWeeklyTrends(data)).catch(console.error);
  }, []);

  useEffect(() => {
    loadRecords();
    loadKpiDefinitions();
    fetchTargets().then(data => setTargets(data)).catch(console.error);
    fetchCriteria().then(data => setCriteria(data)).catch(console.error);
    fetchAttachments().then(data => setAttachments(data)).catch(console.error);
    loadWeeklyTrends();
  }, [loadRecords, loadKpiDefinitions, loadWeeklyTrends]);

  // KPI 정의 기반 헬퍼 (kpiDefinitions에 의존)
  const getKpisForDivision = useCallback(
    (divisionId) => filterKpisForDivision(kpiDefinitions, divisionId),
    [kpiDefinitions]
  );
  const getKpisForDivisionName = useCallback(
    (divisionName) => filterKpisForDivision(kpiDefinitions, DIVISION_ID_BY_NAME[divisionName]),
    [kpiDefinitions]
  );

  const filteredRecords = useMemo(() => {
    return records.filter(r => r.baseDate && r.baseDate.startsWith(String(currentYear)));
  }, [records, currentYear]);

  const summaryColumns = useMemo(() => {
    if (summaryPeriod === 'quarter') return QUARTERS;
    if (summaryPeriod === 'week') return getWeeksForYear(currentYear);
    return MONTHS;
  }, [summaryPeriod, currentYear]);

  // 종합 데이터: 사업부 × KPI × 기간별 실적
  const summaryData = useMemo(() => {
    const yearStr = String(currentYear);
    const getPeriod = summaryPeriod === 'quarter'
      ? getQuarter
      : summaryPeriod === 'week' ? getWeek : getMonth;
    // 한 번 순회하며 (division|kpi|period) → 최신 레코드로 그룹화
    const latestByKey = new Map();
    for (const r of records) {
      if (!r.baseDate || !r.baseDate.startsWith(yearStr)) continue;
      const period = getPeriod(r.baseDate);
      if (!period) continue;
      const key = `${r.division}|${r.kpi}|${period}`;
      const existing = latestByKey.get(key);
      // baseDate가 더 늦은 레코드 우선, 같은 날짜면 나중에 입력된(id 큰) 레코드
      if (!existing
        || r.baseDate > existing.baseDate
        || (r.baseDate === existing.baseDate && r.id > existing.id)) {
        latestByKey.set(key, r);
      }
    }
    // 주 → 월 매핑은 col에만 의존하므로 한 번만 계산
    const weekToMonth = summaryPeriod === 'week'
      ? Object.fromEntries(summaryColumns.map(c => [c, getMonthForWeek(currentYear, c)]))
      : null;
    return DIVISIONS.map(div => {
      const kpis = getKpisForDivision(div.id).map(item => {
        const periodData = {};
        summaryColumns.forEach(col => {
          const latest = latestByKey.get(`${div.name}|${item.label}|${col}`) || null;
          const targetKey = `${div.name}|${currentYear}|${item.label}|${col}`;
          let targetEntry = targets[targetKey];
          if (!getTargetValue(targetEntry) && summaryPeriod === 'month' && MONTH_TO_QUARTER[col]) {
            const quarterKey = `${div.name}|${currentYear}|${item.label}|${MONTH_TO_QUARTER[col]}`;
            targetEntry = targets[quarterKey];
          }
          if (!getTargetValue(targetEntry) && summaryPeriod === 'week') {
            const fbMonth = weekToMonth[col];
            if (fbMonth) {
              const monthKey = `${div.name}|${currentYear}|${item.label}|${fbMonth}`;
              targetEntry = targets[monthKey];
              if (!getTargetValue(targetEntry) && MONTH_TO_QUARTER[fbMonth]) {
                const quarterKey = `${div.name}|${currentYear}|${item.label}|${MONTH_TO_QUARTER[fbMonth]}`;
                targetEntry = targets[quarterKey];
              }
            }
          }
          const targetFrac = getTargetFraction(targetEntry);
          periodData[col] = {
            target: getTargetValue(targetEntry),
            targetNumerator: targetFrac.numerator,
            targetDenominator: targetFrac.denominator,
            actual: latest ? latest.value : '',
            actualNumerator: latest ? latest.numerator : null,
            actualDenominator: latest ? latest.denominator : null,
          };
        });
        return { ...item, periodData };
      });
      return { division: div, kpis };
    });
  }, [records, targets, currentYear, summaryPeriod, summaryColumns, kpiDefinitions]);

  // 목표 라인의 기준 사업부: 사용자가 선택한 사업부, 없거나 무효면 첫 선택 사업부로 폴백
  const graphTargetDiv = graphDivisions.includes(graphTargetDivision)
    ? graphTargetDivision
    : (graphDivisions[0] || '');

  /**
   * KPI **하나**의 시계열을 만든다 — 사업부별 값 + 목표선.
   *
   * 예전에는 화면에 고른 KPI 하나만 계산하는 useMemo 였다. 이제 KPI 마다 한 장을
   * 그리므로 **부르는 함수**로 바꿨다. 계산 자체는 그대로다.
   */
  const buildGraphSeries = useCallback((kpiLabel) => {
    if (!kpiLabel || graphDivisions.length === 0) return [];
    const yearStr = String(currentYear);
    const getPeriod = graphAxis === 'week' ? getWeek : getMonth;
    const filtered = records.filter(r =>
      r.baseDate && r.baseDate.startsWith(yearStr)
      && r.kpi === kpiLabel && graphDivisions.includes(r.division)
    );
    // 버킷별 사업부 latest record 보관
    const byPeriod = new Map();
    for (const r of filtered) {
      const period = getPeriod(r.baseDate);
      if (!period) continue;
      const entry = byPeriod.get(period) || { period };
      const existing = entry[`__${r.division}_rec`];
      if (!existing
        || r.baseDate > existing.baseDate
        || (r.baseDate === existing.baseDate && r.id > existing.id)) {
        entry[`__${r.division}_rec`] = r;
        const v = parseFloat(r.value);
        entry[r.division] = isNaN(v) ? null : v;
      }
      byPeriod.set(period, entry);
    }
    // 가로축은 그 해 전체 범위로 고정 (데이터 없는 기간도 포함)
    const allPeriods = graphAxis === 'week' ? getWeeksForYear(currentYear) : MONTHS;
    const targetDiv = graphTargetDiv;
    return allPeriods.map(p => {
      const entry = byPeriod.get(p) || { period: p };
      let tval = null;
      if (graphAxis === 'month') {
        const mk = `${targetDiv}|${currentYear}|${kpiLabel}|${p}`;
        const mv = parseFloat(getTargetValue(targets[mk]));
        if (!isNaN(mv)) tval = mv;
        if (tval === null && MONTH_TO_QUARTER[p]) {
          const qk = `${targetDiv}|${currentYear}|${kpiLabel}|${MONTH_TO_QUARTER[p]}`;
          const qv = parseFloat(getTargetValue(targets[qk]));
          if (!isNaN(qv)) tval = qv;
        }
      } else {
        const wk = `${targetDiv}|${currentYear}|${kpiLabel}|${p}`;
        const wv = parseFloat(getTargetValue(targets[wk]));
        if (!isNaN(wv)) tval = wv;
        if (tval === null) {
          const m = getMonthForWeek(currentYear, p);
          if (m) {
            const mk = `${targetDiv}|${currentYear}|${kpiLabel}|${m}`;
            const mv = parseFloat(getTargetValue(targets[mk]));
            if (!isNaN(mv)) tval = mv;
            if (tval === null && MONTH_TO_QUARTER[m]) {
              const qk = `${targetDiv}|${currentYear}|${kpiLabel}|${MONTH_TO_QUARTER[m]}`;
              const qv = parseFloat(getTargetValue(targets[qk]));
              if (!isNaN(qv)) tval = qv;
            }
          }
        }
      }
      const out = { period: p, target: tval };
      graphDivisions.forEach(div => { out[div] = entry[div] ?? null; });
      return out;
    });
  }, [records, targets, currentYear, graphAxis, graphDivisions, graphTargetDiv]);

  // 그래프 KPI 후보: 선택된 사업부에 속한 것만 (선택 없으면 전체)
  const availableKpis = useMemo(() => {
    if (graphDivisions.length === 0) return kpiDefinitions;
    const selectedIds = graphDivisions.map(name => DIVISION_ID_BY_NAME[name]);
    return kpiDefinitions.filter(item =>
      !item.divisions || item.divisions.length === 0
      || item.divisions.some(d => selectedIds.includes(d))
    );
  }, [kpiDefinitions, graphDivisions]);

  /**
   * 실제로 그릴 KPI 들. **아무것도 안 고르면 고른 사업부의 KPI 전부.**
   * 처음 들어왔을 때 빈 화면을 보여 주는 대신 다 그려 놓고, 필요하면 줄이게 한다.
   */
  const graphTargets = useMemo(() => {
    const pool = availableKpis;
    const picked = graphKpis.length
      ? pool.filter(k => graphKpis.includes(k.label))
      : pool;
    return picked;
  }, [availableKpis, graphKpis]);

  /** KPI 마다 한 장. 값이 하나도 없는 KPI 는 그리지 않는다 — 빈 판이 늘어서면 못 읽는다. */
  const graphCharts = useMemo(() => {
    if (summaryPeriod !== 'graph' || graphDivisions.length === 0) return [];
    return graphTargets.map(def => {
      const data = buildGraphSeries(def.label);
      const hasValue = data.some(row =>
        graphDivisions.some(d => row[d] != null) || row.target != null);
      return { def, data, hasValue };
    }).filter(c => c.hasValue);
  }, [summaryPeriod, graphDivisions, graphTargets, buildGraphSeries]);

  const DIVISION_COLORS = {
    'MX': '#3b82f6',
    'VD': '#8b5cf6',
    'DA': '#ec4899',
    'NW': '#f59e0b',
    '의료기기': '#10b981',
  };

  // 사업부를 바꾸면 후보에서 빠진 KPI 는 골라 둔 목록에서도 뺀다.
  // 안 빼면 「고른 것이 있는데 아무것도 안 그려지는」 상태가 된다.
  useEffect(() => {
    setGraphKpis(prev => {
      if (prev.length === 0) return prev;
      const next = prev.filter(l => availableKpis.some(k => k.label === l));
      return next.length === prev.length ? prev : next;
    });
  }, [availableKpis]);

  // 목표 기준 사업부가 선택 사업부 목록에서 빠지면 첫 사업부로 폴백
  useEffect(() => {
    if (graphDivisions.length === 0) {
      if (graphTargetDivision !== '') setGraphTargetDivision('');
    } else if (!graphDivisions.includes(graphTargetDivision)) {
      setGraphTargetDivision(graphDivisions[0]);
    }
  }, [graphDivisions, graphTargetDivision]);

  const selectedItem = kpiDefinitions.find(k => k.label === selectedKpi);
  const category = selectedItem?.category || '';
  const unit = selectedItem?.unit ?? '';

  const toggleKpi = useCallback((label) => {
    setSelectedKpis(prev => {
      const exists = prev.includes(label);
      if (exists) {
        const next = prev.filter(k => k !== label);
        setKpiEntries(e => { const copy = { ...e }; delete copy[label]; return copy; });
        return next;
      }
      setKpiEntries(e => ({ ...e, [label]: { baseDate: commonDateRef.current || todayLocalYmd(), value: '', numerator: '', denominator: '' } }));
      return [...prev, label];
    });
  }, []);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }, []);

  /**
   * 고른 사업부에서 **KPI 마다 가장 마지막 기록**.
   *
   * 대부분의 KPI 는 지난번 값에서 조금 움직인다. 그래서 매번 백지에서 치는 것보다
   * 지난 값을 불러 고치는 편이 빠르고, 자릿수를 잘못 치는 실수도 준다.
   *
   * 최신 판정은 **기준일 → id** 순이다. 같은 날에 두 번 넣은 기록이 있으면
   * 나중에 넣은 것이 맞다.
   */
  const lastRecordByKpi = useMemo(() => {
    const m = new Map();
    if (!selectedDivision) return m;
    records.forEach(r => {
      if (r.division !== selectedDivision) return;
      const prev = m.get(r.kpi);
      const newer = !prev
        || r.baseDate > prev.baseDate
        || (r.baseDate === prev.baseDate && (r.id || 0) > (prev.id || 0));
      if (newer) m.set(r.kpi, r);
    });
    return m;
  }, [records, selectedDivision]);

  /** 불러올 값이 있는 KPI 수와, 그 값들이 언제 것인지. 단추에 그대로 적는다. */
  const lastLoadInfo = useMemo(() => {
    let count = 0;
    let newest = '';
    selectedKpis.forEach(label => {
      const last = lastRecordByKpi.get(label);
      if (!last) return;
      count += 1;
      if (last.baseDate > newest) newest = last.baseDate;
    });
    return { count, newest };
  }, [selectedKpis, lastRecordByKpi]);

  /**
   * 마지막 값을 입력칸에 채운다. **기준 날짜는 손대지 않는다** —
   * 이 기능의 쓰임이 "지난 값을 고쳐 **다음 날짜**로 넣기" 라서,
   * 날짜까지 되돌리면 같은 날에 덮어 쓰는 꼴이 된다.
   */
  const loadLastValues = useCallback(() => {
    const patch = {};
    let filled = 0;
    selectedKpis.forEach(label => {
      const last = lastRecordByKpi.get(label);
      if (!last) return;
      const def = kpiDefinitions.find(k => k.label === label);
      const cur = kpiEntries[label]
        || { baseDate: commonDateRef.current, value: '', numerator: '', denominator: '' };
      if (def?.valueType === 'fraction' && (last.numerator || last.denominator)) {
        patch[label] = {
          ...cur,
          numerator: last.numerator ?? '',
          denominator: last.denominator ?? '',
        };
      } else {
        // 분수형인데 분자·분모가 안 남은 옛 기록은 **합쳐진 값**만 있다.
        // 그건 분자에 넣으면 뜻이 달라지므로 값 칸에 그대로 둔다.
        patch[label] = { ...cur, value: last.value ?? '' };
      }
      filled += 1;
    });
    if (filled === 0) {
      showToast('불러올 지난 기록이 없습니다.');
      return;
    }
    setKpiEntries(prev => ({ ...prev, ...patch }));
    showToast(`${filled}개 항목에 마지막 값을 넣었습니다. 고쳐서 저장하세요.`);
  }, [selectedKpis, lastRecordByKpi, kpiDefinitions, kpiEntries, showToast]);

  /**
   * 사업부를 고르면 **그 사업부의 KPI 를 한 번에 켠다.**
   *
   * 사업부마다 넣을 KPI 가 정해져 있는데 매번 열 개를 손으로 누르고 있었다.
   * 켜 놓고 지우는 편이 하나씩 켜는 것보다 늘 빠르다 —
   * 필요 없는 것은 아래 「전체 해제」나 항목을 다시 눌러 뺀다.
   *
   * ⚠️ 수정 중일 때는 손대지 않는다. 그때는 고치는 그 한 건이 대상이다.
   */
  const selectDivision = useCallback((name) => {
    setSelectedDivision(name);
    if (editingRecord) return;
    const labels = getKpisForDivisionName(name).map(k => k.label);
    setSelectedKpis(labels);
    setKpiEntries(() => {
      const next = {};
      labels.forEach(l => {
        next[l] = { baseDate: commonDateRef.current || todayLocalYmd(), value: '', numerator: '', denominator: '' };
      });
      return next;
    });
  }, [editingRecord, getKpisForDivisionName]);

  /** 전부 켜기 / 전부 끄기. 자동 선택을 되돌릴 길이 있어야 한다. */
  const toggleAllKpis = useCallback(() => {
    const labels = (selectedDivision
      ? getKpisForDivisionName(selectedDivision)
      : kpiDefinitions).map(k => k.label);
    const allOn = labels.length > 0 && labels.every(l => selectedKpis.includes(l));
    if (allOn) {
      setSelectedKpis([]);
      setKpiEntries({});
      return;
    }
    setSelectedKpis(labels);
    setKpiEntries(() => {
      const next = {};
      labels.forEach(l => {
        next[l] = { baseDate: commonDateRef.current || todayLocalYmd(), value: '', numerator: '', denominator: '' };
      });
      return next;
    });
  }, [selectedDivision, getKpisForDivisionName, kpiDefinitions, selectedKpis]);

  /** 분수 미리보기 — 저장 규칙과 **같은 식**이어야 한다(단위 % 면 ×100). */
  const computeFraction = useCallback((num, den, unit) => {
    const n = parseFloat(num);
    const d = parseFloat(den);
    if (isNaN(n) || isNaN(d) || d === 0) return null;
    return (unit === '%' ? (n / d) * 100 : n / d).toFixed(1);
  }, []);

  const setGridCell = useCallback((kpi, date, field, val) => {
    if (!date) return;
    setGridValues(prev => ({
      ...prev,
      [kpi]: { ...(prev[kpi] || {}), [date]: { ...((prev[kpi] || {})[date] || {}), [field]: val } },
    }));
  }, []);

  /**
   * 격자에 덩이째 붙여넣기 — 그 칸부터 **아래로 KPI, 오른쪽으로 날짜**.
   * 엑셀에서 긁어 온 모양 그대로 들어간다.
   */
  const pasteGridBlock = useCallback((kpiIdx, dateIdx, rows) => {
    const labels = selectedKpis;
    setGridValues(prev => {
      const next = { ...prev };
      rows.forEach((cols, r) => {
        const label = labels[kpiIdx + r];
        if (!label) return;
        const def = kpiDefinitions.find(k => k.label === label);
        const isFrac = def?.valueType === 'fraction';
        cols.forEach((raw, c) => {
          const date = gridDates[dateIdx + c];
          if (!date) return;
          const cur = { ...((next[label] || {})[date] || {}) };
          const text = String(raw || '').trim();
          const m = text.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/);
          if (isFrac && m) {
            cur.numerator = m[1];
            cur.denominator = m[2];
          } else if (isFrac) {
            // 분수형인데 한 숫자만 왔다 — 분자로 받는다(분모는 사람이 채운다)
            cur.numerator = text;
          } else {
            cur.value = text.replace(/[,%]/g, '');
          }
          next[label] = { ...(next[label] || {}), [date]: cur };
        });
      });
      return next;
    });
  }, [selectedKpis, kpiDefinitions, gridDates]);

  /** 격자에서 **값이 있는 칸만** 모아 저장한다. 빈 칸을 0 으로 넣으면 안 된다. */
  const handleGridSubmit = useCallback(async () => {
    const payload = [];
    selectedKpis.forEach(label => {
      const def = kpiDefinitions.find(k => k.label === label);
      if (!def) return;
      const isFrac = def.valueType === 'fraction';
      gridDates.forEach(date => {
        if (!date) return;
        const c = (gridValues[label] || {})[date] || {};
        if (isFrac) {
          const v = computeFraction(c.numerator, c.denominator, def.unit);
          if (v === null) return;
          payload.push({
            division: selectedDivision, kpi: label, category: def.category || '',
            value: v, unit: def.unit || '', baseDate: date,
            numerator: c.numerator, denominator: c.denominator,
          });
        } else {
          const v = String(c.value ?? '').trim();
          if (!v) return;
          payload.push({
            division: selectedDivision, kpi: label, category: def.category || '',
            value: v, unit: def.unit || '', baseDate: date,
          });
        }
      });
    });
    if (!selectedDivision || payload.length === 0) return;
    try {
      const saved = await createRecordsBulk(payload);
      setRecords(prev => [...saved.reverse(), ...prev]);
      setGridValues({});
      showToast(`${payload.length}건을 저장했습니다.`);
    } catch (err) {
      console.error('KPI 격자 저장 실패:', err);
      showToast('저장에 실패했습니다.');
    }
  }, [selectedKpis, kpiDefinitions, gridDates, gridValues, selectedDivision,
      computeFraction, showToast]);

  const updateKpiEntry = useCallback((label, field, val) => {
    setKpiEntries(prev => ({ ...prev, [label]: { ...prev[label], [field]: val } }));
  }, []);

  const buildPayloads = useCallback(() => {
    return selectedKpis
      .map(label => {
        const item = kpiDefinitions.find(k => k.label === label);
        const entry = kpiEntries[label];
        if (!entry || !entry.baseDate) return null;
        if (item?.valueType === 'fraction') {
          if (!entry.numerator || !entry.denominator) return null;
          const num = parseFloat(entry.numerator);
          const den = parseFloat(entry.denominator);
          if (isNaN(num) || isNaN(den) || den === 0) return null;
          const computed = (item?.unit === '%' ? (num / den) * 100 : num / den).toFixed(1);
          return {
            division: selectedDivision,
            kpi: label,
            category: item?.category || '',
            value: computed,
            unit: item?.unit ?? '',
            baseDate: entry.baseDate,
            numerator: entry.numerator,
            denominator: entry.denominator,
          };
        }
        if (!entry.value) return null;
        return {
          division: selectedDivision,
          kpi: label,
          category: item?.category || '',
          value: entry.value,
          unit: item?.unit ?? '',
          baseDate: entry.baseDate,
        };
      })
      .filter(Boolean);
  }, [selectedKpis, kpiEntries, selectedDivision, kpiDefinitions]);

  const handleSubmit = useCallback(async () => {
    const payloads = buildPayloads();
    if (!selectedDivision || payloads.length === 0) return;
    try {
      const saved = await createRecordsBulk(payloads);
      setRecords(prev => [...saved.reverse(), ...prev]);
      showToast(`${payloads.length}건 추가 완료`);
      setKpiEntries(prev => {
        const next = { ...prev };
        selectedKpis.forEach(k => { if (next[k]) next[k] = { ...next[k], value: '' }; });
        return next;
      });
    } catch (err) {
      console.error('KPI 기록 저장 실패:', err);
    }
  }, [buildPayloads, selectedDivision, selectedKpis, showToast]);

  const handleSubmitAndClose = useCallback(async () => {
    const payloads = buildPayloads();
    if (!selectedDivision || payloads.length === 0) return;
    try {
      const saved = await createRecordsBulk(payloads);
      setRecords(prev => [...saved.reverse(), ...prev]);
      setSelectedKpis([]);
      setKpiEntries({});
      setSelectedDivision('');
      setShowModal(false);
    } catch (err) {
      console.error('KPI 기록 저장 실패:', err);
    }
  }, [buildPayloads, selectedDivision]);


  const handleDelete = useCallback(async (id) => {
    try {
      await deleteRecordApi(id);
      setRecords(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error('KPI 기록 삭제 실패:', err);
    }
  }, []);

  const handleEdit = useCallback((record) => {
    setEditingRecord(record);
    setSelectedDivision(record.division);
    setSelectedKpi(record.kpi);
    setValue(record.value);
    setBaseDate(record.baseDate);
    setEditNumerator(record.numerator || '');
    setEditDenominator(record.denominator || '');
    setEntryMode('single');
    setShowModal(true);
  }, []);

  const handleUpdate = useCallback(async () => {
    if (!editingRecord || !selectedKpi || !selectedDivision || !baseDate) return;
    const isFraction = selectedItem?.valueType === 'fraction';
    let payload;
    if (isFraction) {
      const num = parseFloat(editNumerator);
      const den = parseFloat(editDenominator);
      if (isNaN(num) || isNaN(den) || den === 0) return;
      const computed = (unit === '%' ? (num / den) * 100 : num / den).toFixed(1);
      payload = {
        division: selectedDivision,
        kpi: selectedKpi,
        category,
        value: computed,
        unit,
        baseDate,
        numerator: editNumerator,
        denominator: editDenominator,
      };
    } else {
      if (!value) return;
      payload = {
        division: selectedDivision,
        kpi: selectedKpi,
        category,
        value,
        unit,
        baseDate,
        numerator: null,
        denominator: null,
      };
    }
    try {
      const updated = await updateRecordApi(editingRecord.id, payload);
      setRecords(prev => prev.map(r => r.id === editingRecord.id ? updated : r));
      setEditingRecord(null);
      setSelectedKpi('');
      setSelectedDivision('');
      setValue('');
      setBaseDate('');
      setEditNumerator('');
      setEditDenominator('');
      setShowModal(false);
    } catch (err) {
      console.error('KPI 기록 수정 실패:', err);
    }
  }, [editingRecord, selectedKpi, selectedDivision, value, category, unit, baseDate, selectedItem, editNumerator, editDenominator]);

  const handleInlineSave = useCallback(async (record) => {
    const trimmed = inlineEditValue.trim();
    if (trimmed === record.value || !trimmed) {
      setInlineEditId(null);
      return;
    }
    try {
      const updated = await updateRecordApi(record.id, { value: trimmed });
      setRecords(prev => prev.map(r => r.id === record.id ? updated : r));
    } catch (err) {
      console.error('값 수정 실패:', err);
    }
    setInlineEditId(null);
  }, [inlineEditValue]);

  const todayStr = useCallback(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const parseDateStr = useCallback((str) => {
    const s = str.trim();
    const m = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    return null;
  }, []);

  // 전체 날짜를 모든 행/KPI에 일괄 적용
  const applyCommonDate = useCallback((date) => {
    setCommonDate(date);
    if (!date) return;
    if (entryMode === 'single') {
      setKpiEntries(prev => {
        const next = { ...prev };
        selectedKpis.forEach(label => {
          next[label] = {
            ...(next[label] || { value: '', numerator: '', denominator: '' }),
            baseDate: date,
          };
        });
        return next;
      });
    }
    // 일괄(격자)은 **열 머리글**에서 날짜를 바꾸므로 여기서 손댈 것이 없다.
  }, [entryMode, selectedKpis]);

  // 단건 모드 붙여넣기: 현재 KPI부터 selectedKpis 순서대로 채움. 분수형 KPI는 값/숫자 갱신 건너뜀.
  const handleSinglePaste = useCallback((e, label, field) => {
    const text = e.clipboardData.getData('text');
    if (!text) return;
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length === 0) return;
    // 단일 줄 + 탭 없음 → 브라우저 기본 동작 (값/분자/분모 모두)
    if (lines.length === 1 && !lines[0].includes('\t') && (field === 'value' || field === 'numerator' || field === 'denominator')) return;

    e.preventDefault();

    const startIdx = selectedKpis.indexOf(label);
    if (startIdx < 0) return;

    /* 🐞 날짜가 섞여 붙으면 예전에는 **행마다 다른 날짜**가 박혔다. 이제 날짜는
       위에 한 칸뿐이라 그러면 화면과 저장값이 어긋난다. 첫 날짜를 잡아
       **기준 날짜로 올린다** — 어디에 적용됐는지 눈에 보이는 곳이 그 칸이다. */
    let pastedDate = null;

    setKpiEntries(prev => {
      const next = { ...prev };
      lines.forEach((line, i) => {
        const targetLabel = selectedKpis[startIdx + i];
        if (!targetLabel) return;
        const def = kpiDefinitions.find(k => k.label === targetLabel);
        const isFraction = def?.valueType === 'fraction';
        const cols = line.split('\t');
        const cur = next[targetLabel] || { baseDate: '', value: '', numerator: '', denominator: '' };
        if (field === 'value' && !isFraction) {
          if (cols.length >= 2) {
            const date = parseDateStr(cols[0]);
            if (date) {
              if (!pastedDate) pastedDate = date;
              next[targetLabel] = { ...cur, value: cols[1].trim() };
            } else {
              next[targetLabel] = { ...cur, value: cols[0].trim() };
            }
          } else {
            next[targetLabel] = { ...cur, value: cols[0].trim() };
          }
        } else if (field === 'numerator' && isFraction) {
          // 분자에 붙여넣기: date\tnum\tden | num\tden | num
          const firstDate = parseDateStr(cols[0]);
          let updated = cur;
          if (firstDate) {
            if (!pastedDate) pastedDate = firstDate;
            if (cols.length >= 3) {
              updated = { ...updated, numerator: cols[1].trim(), denominator: cols[2].trim() };
            } else if (cols.length >= 2) {
              updated = { ...updated, numerator: cols[1].trim() };
            }
          } else if (cols.length >= 2) {
            updated = { ...updated, numerator: cols[0].trim(), denominator: cols[1].trim() };
          } else {
            updated = { ...updated, numerator: cols[0].trim() };
          }
          next[targetLabel] = updated;
        } else if (field === 'denominator' && isFraction) {
          // 분모에 붙여넣기: 단일 컬럼이면 분모만, date\tden 도 허용
          const firstDate = parseDateStr(cols[0]);
          let updated = cur;
          if (firstDate && cols.length >= 2) {
            if (!pastedDate) pastedDate = firstDate;
            updated = { ...updated, denominator: cols[1].trim() };
          } else {
            updated = { ...updated, denominator: cols[0].trim() };
          }
          next[targetLabel] = updated;
        } else if (field === 'date') {
          const date = parseDateStr(cols[0]);
          let updated = cur;
          if (date && !pastedDate) pastedDate = date;
          if (isFraction) {
            if (cols.length >= 3) {
              updated = { ...updated, numerator: cols[1].trim(), denominator: cols[2].trim() };
            } else if (cols.length >= 2) {
              updated = { ...updated, numerator: cols[1].trim() };
            }
          } else if (cols.length >= 2) {
            updated = { ...updated, value: cols[1].trim() };
          }
          next[targetLabel] = updated;
        }
      });
      if (pastedDate) {
        selectedKpis.forEach(l => {
          if (next[l]) next[l] = { ...next[l], baseDate: pastedDate };
        });
      }
      return next;
    });
    if (pastedDate) setCommonDate(pastedDate);
  }, [selectedKpis, kpiDefinitions, parseDateStr]);


  const handleOpenModal = useCallback(() => {
    setEditingRecord(null);
    setSelectedKpis([]);
    setKpiEntries({});
    setSelectedKpi('');
    setSelectedDivision('');
    setValue('');
    setBaseDate(todayStr());
    setEntryMode('single');
    setCommonDate(todayStr());   // 날짜가 하나뿐이라 비워 두면 저장이 막힌다
    setShowModal(true);
  }, [todayStr]);

  const handleExcelExport = useCallback(() => {
    const wb = XLSX.utils.book_new();
    const headerStyle = { font: { bold: true, color: { rgb: '334155' } }, fill: { fgColor: { rgb: 'F1F5F9' } }, border: { bottom: { style: 'thin', color: { rgb: 'E2E8F0' } } }, alignment: { horizontal: 'center', vertical: 'center' } };
    const centerStyle = { alignment: { horizontal: 'center', vertical: 'center' } };
    const leftCenterStyle = { alignment: { horizontal: 'left', vertical: 'center' } };

    // 시트 전체 셀에 정렬 스타일 적용 (leftCol: 왼쪽 정렬할 열 인덱스)
    const applyAlignment = (ws, leftCol) => {
      const range = XLSX.utils.decode_range(ws['!ref']);
      for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          if (!ws[addr]) continue;
          const existing = ws[addr].s || {};
          ws[addr].s = { ...existing, alignment: c === leftCol ? { horizontal: 'left', vertical: 'center' } : { horizontal: 'center', vertical: 'center' } };
        }
      }
    };

    // === Raw 데이터 시트 ===
    const rawHeaders = ['No', '사업부', '구분', 'KPI 항목', '값', '단위', '기준 날짜'];
    const rawData = [rawHeaders.map(h => ({ v: h, s: headerStyle }))];
    filteredRecords.forEach((r, idx) => {
      rawData.push([
        filteredRecords.length - idx,
        r.division,
        r.category,
        r.kpi,
        r.value,
        r.unit || '',
        r.baseDate,
      ]);
    });
    const wsRaw = XLSX.utils.aoa_to_sheet(rawData);
    wsRaw['!cols'] = [{ wch: 6 }, { wch: 10 }, { wch: 8 }, { wch: 26 }, { wch: 12 }, { wch: 6 }, { wch: 14 }];
    applyAlignment(wsRaw, 3);
    XLSX.utils.book_append_sheet(wb, wsRaw, 'Raw 데이터');

    // === 종합 데이터 시트 (분기별) ===
    const qCols = QUARTERS;
    const qHeader1 = ['사업부', '구분', 'KPI 항목'];
    qCols.forEach(q => qHeader1.push(q, '', ''));
    qHeader1.push('산출 기준');
    const qHeader2 = ['', '', ''];
    qCols.forEach(() => qHeader2.push('목표', '실적', '달성률'));
    qHeader2.push('');

    const qData = [
      qHeader1.map(h => ({ v: h, s: headerStyle })),
      qHeader2.map(h => ({ v: h, s: headerStyle })),
    ];

    // Build quarterly summary using same logic
    const yearRecords = records.filter(r => r.baseDate && r.baseDate.startsWith(String(currentYear)));
    DIVISIONS.forEach(div => {
      const divRecords = yearRecords.filter(r => r.division === div.name);
      getKpisForDivision(div.id).forEach(item => {
        const row = [div.name, item.category, item.label + (item.unit ? ` (${item.unit})` : '')];
        qCols.forEach(col => {
          const colRecords = divRecords.filter(r => r.kpi === item.label && getQuarter(r.baseDate) === col);
          const latest = colRecords.length > 0 ? colRecords.reduce((a, b) => {
            if (a.baseDate !== b.baseDate) return a.baseDate > b.baseDate ? a : b;
            return a.id > b.id ? a : b;
          }) : null;
          const targetKey = `${div.name}|${currentYear}|${item.label}|${col}`;
          const targetEntry = targets[targetKey];
          const target = getTargetValue(targetEntry);
          const targetFrac = getTargetFraction(targetEntry);
          const actual = latest ? latest.value : '';
          const ach = calcAchievement(target, actual, item.direction);
          const isFraction = item.valueType === 'fraction';
          const showRaw = isFraction && item.showRawData !== false;
          const targetCell = !target
            ? '-'
            : (showRaw && targetFrac.numerator && targetFrac.denominator
                ? `${formatValue(target, item.unit)} (${targetFrac.numerator}/${targetFrac.denominator})`
                : formatValue(target, item.unit));
          const actualCell = !actual
            ? '-'
            : (showRaw && latest && latest.numerator && latest.denominator
                ? `${formatValue(actual, item.unit)} (${latest.numerator}/${latest.denominator})`
                : formatValue(actual, item.unit));
          row.push(
            targetCell,
            actualCell,
            ach !== null ? `${ach}%` : '-'
          );
        });
        row.push(criteria[item.label] || '');
        qData.push(row);
      });
    });

    // 사업부(col 0), 구분(col 1) 셀 병합 계산
    const buildDataMerges = (headerRows) => {
      const merges = [];
      const dataStart = headerRows; // 데이터 시작 행
      let rowStart = dataStart;
      DIVISIONS.forEach(div => {
        const divItems = getKpisForDivision(div.id);
        const kpiCount = divItems.length;
        if (kpiCount === 0) return;
        const rowEnd = rowStart + kpiCount - 1;
        // 사업부 병합
        if (rowEnd > rowStart) {
          merges.push({ s: { r: rowStart, c: 0 }, e: { r: rowEnd, c: 0 } });
        }
        // 구분 병합 (같은 category끼리)
        let catStart = rowStart;
        let currentCat = divItems[0].category;
        divItems.forEach((item, i) => {
          if (item.category !== currentCat) {
            if (rowStart + i - 1 > catStart) {
              merges.push({ s: { r: catStart, c: 1 }, e: { r: rowStart + i - 1, c: 1 } });
            }
            catStart = rowStart + i;
            currentCat = item.category;
          }
        });
        if (rowEnd > catStart) {
          merges.push({ s: { r: catStart, c: 1 }, e: { r: rowEnd, c: 1 } });
        }
        rowStart = rowEnd + 1;
      });
      return merges;
    };

    const wsSummary = XLSX.utils.aoa_to_sheet(qData);
    wsSummary['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
      { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
      { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } },
      ...qCols.map((_, i) => ({ s: { r: 0, c: 3 + i * 3 }, e: { r: 0, c: 5 + i * 3 } })),
      { s: { r: 0, c: 3 + qCols.length * 3 }, e: { r: 1, c: 3 + qCols.length * 3 } },
      ...buildDataMerges(2),
    ];
    const totalQCols = 3 + qCols.length * 3 + 1;
    wsSummary['!cols'] = Array.from({ length: totalQCols }, (_, i) => {
      if (i === 0) return { wch: 10 };
      if (i === 1) return { wch: 8 };
      if (i === 2) return { wch: 26 };
      if (i === totalQCols - 1) return { wch: 20 };
      return { wch: 10 };
    });
    applyAlignment(wsSummary, 2);
    XLSX.utils.book_append_sheet(wb, wsSummary, '종합 데이터 (분기)');

    // === 종합 데이터 시트 (월별) ===
    const mCols = MONTHS;
    const mHeader1 = ['사업부', '구분', 'KPI 항목'];
    mCols.forEach(m => mHeader1.push(m, '', ''));
    const mHeader2 = ['', '', ''];
    mCols.forEach(() => mHeader2.push('목표', '실적', '달성률'));

    const mData = [
      mHeader1.map(h => ({ v: h, s: headerStyle })),
      mHeader2.map(h => ({ v: h, s: headerStyle })),
    ];

    DIVISIONS.forEach(div => {
      const divRecords = yearRecords.filter(r => r.division === div.name);
      getKpisForDivision(div.id).forEach(item => {
        const row = [div.name, item.category, item.label + (item.unit ? ` (${item.unit})` : '')];
        mCols.forEach(col => {
          const colRecords = divRecords.filter(r => r.kpi === item.label && getMonth(r.baseDate) === col);
          const latest = colRecords.length > 0 ? colRecords.reduce((a, b) => {
            if (a.baseDate !== b.baseDate) return a.baseDate > b.baseDate ? a : b;
            return a.id > b.id ? a : b;
          }) : null;
          const targetKey = `${div.name}|${currentYear}|${item.label}|${col}`;
          let targetEntry = targets[targetKey];
          if (!getTargetValue(targetEntry) && MONTH_TO_QUARTER[col]) {
            const qKey = `${div.name}|${currentYear}|${item.label}|${MONTH_TO_QUARTER[col]}`;
            targetEntry = targets[qKey];
          }
          const target = getTargetValue(targetEntry);
          const targetFrac = getTargetFraction(targetEntry);
          const actual = latest ? latest.value : '';
          const ach = calcAchievement(target, actual, item.direction);
          const isFraction = item.valueType === 'fraction';
          const showRaw = isFraction && item.showRawData !== false;
          const targetCell = !target
            ? '-'
            : (showRaw && targetFrac.numerator && targetFrac.denominator
                ? `${formatValue(target, item.unit)} (${targetFrac.numerator}/${targetFrac.denominator})`
                : formatValue(target, item.unit));
          const actualCell = !actual
            ? '-'
            : (showRaw && latest && latest.numerator && latest.denominator
                ? `${formatValue(actual, item.unit)} (${latest.numerator}/${latest.denominator})`
                : formatValue(actual, item.unit));
          row.push(
            targetCell,
            actualCell,
            ach !== null ? `${ach}%` : '-'
          );
        });
        mData.push(row);
      });
    });

    const wsMonthly = XLSX.utils.aoa_to_sheet(mData);
    wsMonthly['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
      { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
      { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } },
      ...mCols.map((_, i) => ({ s: { r: 0, c: 3 + i * 3 }, e: { r: 0, c: 5 + i * 3 } })),
      ...buildDataMerges(2),
    ];
    const totalMCols = 3 + mCols.length * 3;
    wsMonthly['!cols'] = Array.from({ length: totalMCols }, (_, i) => {
      if (i === 0) return { wch: 10 };
      if (i === 1) return { wch: 8 };
      if (i === 2) return { wch: 26 };
      return { wch: 8 };
    });
    applyAlignment(wsMonthly, 2);
    XLSX.utils.book_append_sheet(wb, wsMonthly, '종합 데이터 (월별)');

    // === 종합 데이터 시트 (주별) ===
    const wCols = getWeeksForYear(currentYear);
    const wHeader1 = ['사업부', '구분', 'KPI 항목'];
    wCols.forEach(w => wHeader1.push(w, '', ''));
    const wHeader2 = ['', '', ''];
    wCols.forEach(() => wHeader2.push('목표', '실적', '달성률'));

    const wData = [
      wHeader1.map(h => ({ v: h, s: headerStyle })),
      wHeader2.map(h => ({ v: h, s: headerStyle })),
    ];

    DIVISIONS.forEach(div => {
      const divRecords = yearRecords.filter(r => r.division === div.name);
      getKpisForDivision(div.id).forEach(item => {
        const row = [div.name, item.category, item.label + (item.unit ? ` (${item.unit})` : '')];
        wCols.forEach(col => {
          const colRecords = divRecords.filter(r => r.kpi === item.label && getWeek(r.baseDate) === col);
          const latest = colRecords.length > 0 ? colRecords.reduce((a, b) => {
            if (a.baseDate !== b.baseDate) return a.baseDate > b.baseDate ? a : b;
            return a.id > b.id ? a : b;
          }) : null;
          const targetKey = `${div.name}|${currentYear}|${item.label}|${col}`;
          let targetEntry = targets[targetKey];
          if (!getTargetValue(targetEntry)) {
            const monthLabel = getMonthForWeek(currentYear, col);
            if (monthLabel) {
              targetEntry = targets[`${div.name}|${currentYear}|${item.label}|${monthLabel}`];
              if (!getTargetValue(targetEntry) && MONTH_TO_QUARTER[monthLabel]) {
                targetEntry = targets[`${div.name}|${currentYear}|${item.label}|${MONTH_TO_QUARTER[monthLabel]}`];
              }
            }
          }
          const target = getTargetValue(targetEntry);
          const targetFrac = getTargetFraction(targetEntry);
          const actual = latest ? latest.value : '';
          const ach = calcAchievement(target, actual, item.direction);
          const isFraction = item.valueType === 'fraction';
          const showRaw = isFraction && item.showRawData !== false;
          const targetCell = !target
            ? '-'
            : (showRaw && targetFrac.numerator && targetFrac.denominator
                ? `${formatValue(target, item.unit)} (${targetFrac.numerator}/${targetFrac.denominator})`
                : formatValue(target, item.unit));
          const actualCell = !actual
            ? '-'
            : (showRaw && latest && latest.numerator && latest.denominator
                ? `${formatValue(actual, item.unit)} (${latest.numerator}/${latest.denominator})`
                : formatValue(actual, item.unit));
          row.push(
            targetCell,
            actualCell,
            ach !== null ? `${ach}%` : '-'
          );
        });
        wData.push(row);
      });
    });

    const wsWeekly = XLSX.utils.aoa_to_sheet(wData);
    wsWeekly['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
      { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
      { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } },
      ...wCols.map((_, i) => ({ s: { r: 0, c: 3 + i * 3 }, e: { r: 0, c: 5 + i * 3 } })),
      ...buildDataMerges(2),
    ];
    const totalWCols = 3 + wCols.length * 3;
    wsWeekly['!cols'] = Array.from({ length: totalWCols }, (_, i) => {
      if (i === 0) return { wch: 10 };
      if (i === 1) return { wch: 8 };
      if (i === 2) return { wch: 26 };
      return { wch: 8 };
    });
    applyAlignment(wsWeekly, 2);
    XLSX.utils.book_append_sheet(wb, wsWeekly, '종합 데이터 (주별)');

    // === 주간 주요 동향 시트 ===
    const yearTrends = weeklyTrends.filter(t => t.year === currentYear);
    const trendMap = {};
    for (const t of yearTrends) {
      trendMap[`${t.division}|${t.category}|${t.week}`] = t.content || '';
    }
    const lastWeekNum = getISOWeek(new Date(currentYear, 11, 28));
    const trendWeekNums = Array.from({ length: lastWeekNum }, (_, i) => i + 1);

    const trendHeader1 = ['주차'];
    ['개발', '제조'].forEach(cat => {
      DIVISIONS.forEach(() => trendHeader1.push(cat));
    });
    const trendHeader2 = [''];
    ['개발', '제조'].forEach(() => {
      DIVISIONS.forEach(div => trendHeader2.push(div.name));
    });

    const trendData = [
      trendHeader1.map(h => ({ v: h, s: headerStyle })),
      trendHeader2.map(h => ({ v: h, s: headerStyle })),
    ];

    trendWeekNums.forEach(wn => {
      const row = [`${wn}주차`];
      ['개발', '제조'].forEach(cat => {
        DIVISIONS.forEach(div => {
          row.push(trendMap[`${div.name}|${cat}|${wn}`] || '');
        });
      });
      trendData.push(row);
    });

    const wsTrend = XLSX.utils.aoa_to_sheet(trendData);
    wsTrend['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
      { s: { r: 0, c: 1 }, e: { r: 0, c: DIVISIONS.length } },
      { s: { r: 0, c: 1 + DIVISIONS.length }, e: { r: 0, c: DIVISIONS.length * 2 } },
    ];
    const trendColCount = 1 + DIVISIONS.length * 2;
    wsTrend['!cols'] = Array.from({ length: trendColCount }, (_, i) => (i === 0 ? { wch: 10 } : { wch: 30 }));
    const trendRange = XLSX.utils.decode_range(wsTrend['!ref']);
    for (let r = 2; r <= trendRange.e.r; r++) {
      for (let c = 0; c <= trendRange.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!wsTrend[addr]) continue;
        const existing = wsTrend[addr].s || {};
        wsTrend[addr].s = {
          ...existing,
          alignment: c === 0
            ? { horizontal: 'center', vertical: 'center' }
            : { horizontal: 'left', vertical: 'top', wrapText: true },
        };
      }
    }
    XLSX.utils.book_append_sheet(wb, wsTrend, '주간 주요 동향');

    XLSX.writeFile(wb, `DX_KPI_${currentYear}.xlsx`);
  }, [filteredRecords, records, targets, criteria, currentYear, weeklyTrends, getKpisForDivision]);

  const handleDeleteAttachment = useCallback(async (id) => {
    try {
      await deleteAttachmentApi(id);
      setAttachments(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      console.error('첨부파일 삭제 실패:', err);
    }
  }, []);

  const uploadFilesToCell = useCallback(async (files, division, kpi, month) => {
    if (!files || !files.length) return;
    try {
      for (const file of files) {
        const saved = await uploadAttachment(file, { division, kpi, year: currentYear, month });
        setAttachments(prev => [saved, ...prev]);
      }
      showToast(`${files.length}개 파일 업로드 완료`);
    } catch (err) {
      console.error('업로드 실패:', err);
      showToast('업로드 중 오류가 발생했습니다.');
    }
  }, [currentYear, showToast]);

  const toggleHiddenItem = useCallback((setter, item) => {
    setter(prev => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  }, []);

  const resetSummaryFilters = useCallback(() => {
    setHiddenDivisions(new Set());
    setHiddenCategories(new Set());
    setHiddenKpis(new Set());
  }, []);

  const filterCategoryOptions = useMemo(() => {
    const set = new Set();
    kpiDefinitions.forEach(k => k.category && set.add(k.category));
    return Array.from(set).sort();
  }, [kpiDefinitions]);

  const filterKpiOptionsCommon = useMemo(() => {
    const seen = new Set();
    const result = [];
    kpiDefinitions.forEach(k => {
      if (k.label && (!k.divisions || k.divisions.length === 0) && !seen.has(k.label)) {
        seen.add(k.label);
        result.push(k.label);
      }
    });
    return result;
  }, [kpiDefinitions]);

  const filterKpiOptionsSpecific = useMemo(() => {
    const seen = new Set();
    const result = [];
    kpiDefinitions.forEach(k => {
      if (k.label && k.divisions && k.divisions.length > 0 && !seen.has(k.label)) {
        seen.add(k.label);
        result.push(k.label);
      }
    });
    return result;
  }, [kpiDefinitions]);

  const hasActiveFilter = hiddenDivisions.size > 0 || hiddenCategories.size > 0 || hiddenKpis.size > 0;

  const filteredAttachments = useMemo(() => {
    return attachments.filter(a => a.year === currentYear);
  }, [attachments, currentYear]);

  const weeklyTrendsForYear = useMemo(
    () => weeklyTrends.filter(t => t.year === currentYear),
    [weeklyTrends, currentYear]
  );

  const trendCellMap = useMemo(() => {
    const map = {};
    for (const t of weeklyTrendsForYear) {
      map[`${t.division}|${t.category}|${t.week}`] = t;
    }
    return map;
  }, [weeklyTrendsForYear]);

  const trendWeeks = useMemo(() => {
    const lastWeek = getISOWeek(new Date(currentYear, 11, 28));
    return Array.from({ length: lastWeek }, (_, i) => i + 1);
  }, [currentYear]);

  const trendWeekLabels = useMemo(() => trendWeeks.map(w => `${w}주`), [trendWeeks]);

  const visibleTrendDivisions = useMemo(
    () => DIVISIONS.filter(d => trendVisibleDivisions.includes(d.name)),
    [trendVisibleDivisions]
  );
  const visibleTrendCategories = useMemo(
    () => ['개발', '제조'].filter(c => trendVisibleCategories.includes(c)),
    [trendVisibleCategories]
  );

  const handleTrendSubmit = useCallback(async (payload) => {
    try {
      const saved = await upsertWeeklyTrend(payload);
      setWeeklyTrends(prev => {
        const exists = prev.find(t => t.id === saved.id);
        if (exists) return prev.map(t => (t.id === saved.id ? saved : t));
        return [saved, ...prev];
      });
      setShowTrendModal(false);
      setEditingTrend(null);
      setToast('주간 주요 동향이 저장되었습니다.');
      setTimeout(() => setToast(null), 1800);
    } catch (err) {
      console.error(err);
      setToast(err.message || '저장 실패');
      setTimeout(() => setToast(null), 1800);
    }
  }, []);

  /**
   * 주간 동향 **여러 건**을 한 번에 저장한다.
   *
   * ⚠️ 창을 닫지 않는다 — 한 주차를 채운 뒤 다음 주차로 옮겨 이어서 쓰는 것이
   *    이 화면의 흔한 쓰임이다. 저장할 때마다 닫히면 매번 다시 열어야 한다.
   *
   * ⚠️ 한 건이 실패해도 **나머지는 살린다.** 열 칸을 쓴 뒤 하나 때문에 전부
   *    날아가면 손해가 너무 크다. 대신 몇 건이 실패했는지 반드시 알린다.
   */
  const handleTrendSubmitMany = useCallback(async (payloads) => {
    const results = await Promise.allSettled(payloads.map(p => upsertWeeklyTrend(p)));
    const saved = results.filter(r => r.status === 'fulfilled').map(r => r.value);
    const failed = results.length - saved.length;
    if (saved.length) {
      setWeeklyTrends(prev => {
        const next = [...prev];
        saved.forEach(item => {
          const i = next.findIndex(t => t.id === item.id);
          if (i >= 0) next[i] = item;
          else next.unshift(item);
        });
        return next;
      });
    }
    setToast(failed
      ? `${saved.length}건 저장 · ${failed}건 실패`
      : `${saved.length}건을 저장했습니다.`);
    setTimeout(() => setToast(null), 2000);
  }, []);

  const handleTrendDelete = useCallback(async (id) => {
    if (!id) return;
    if (!window.confirm('이 주간 주요 동향을 삭제하시겠습니까?')) return;
    try {
      await deleteWeeklyTrendApi(id);
      setWeeklyTrends(prev => prev.filter(t => t.id !== id));
      setShowTrendModal(false);
      setEditingTrend(null);
      setToast('삭제되었습니다.');
      setTimeout(() => setToast(null), 1800);
    } catch (err) {
      console.error(err);
      setToast(err.message || '삭제 실패');
      setTimeout(() => setToast(null), 1800);
    }
  }, []);

  return (
    <Container>
      <Header
        onGoHome={onGoHome}
        onRecord={handleOpenModal}
        onAddTrend={() => { setEditingTrend(null); setShowTrendModal(true); }}
        onImport={() => setShowImport(true)}
        onExcelExport={handleExcelExport}
        onSettings={() => setShowSettings(true)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />
      <MainContent>
        {viewMode === 'raw' ? (
        <>
        <YearSelectorContainer>
          <YearSelector>
            <YearButton onClick={() => setCurrentYear(y => y - 1)} title="이전 년도">
              ‹
            </YearButton>
            <YearDisplay>{currentYear}년</YearDisplay>
            <YearButton onClick={() => setCurrentYear(y => y + 1)} title="다음 년도">
              ›
            </YearButton>
          </YearSelector>
        </YearSelectorContainer>
        <TableWrapper>
          <TableHeader>
            <TableTitle>KPI 기록 현황</TableTitle>
            <RecordCount>총 {filteredRecords.length}건</RecordCount>
          </TableHeader>
          <StyledTable>
            <thead>
              <tr>
                <th style={{ width: 40 }}>No</th>
                <th style={{ width: 70 }}>사업부</th>
                <th style={{ width: 60 }}>구분</th>
                <th style={{ width: 180 }}>KPI 항목</th>
                <th style={{ width: 80, whiteSpace: 'nowrap' }}>값</th>
                <th style={{ width: 100, whiteSpace: 'nowrap' }}>기준 날짜</th>
                <th style={{ width: 100 }}>관리</th>
                <th style={{ width: 'auto' }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState>
                      {currentYear}년 기록된 KPI 데이터가 없습니다.<br />
                      상단의 "KPI 입력" 버튼을 눌러 데이터를 추가하세요.
                    </EmptyState>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r, idx) => {
                  const cc = CATEGORY_COLORS[r.category];
                  return (
                    <tr key={r.id}>
                      <td>{filteredRecords.length - idx}</td>
                      <td><strong>{r.division}</strong></td>
                      <td>
                        <CategoryBadge $bg={cc.bg} $color={cc.text} $border={cc.border}>
                          {r.category}
                        </CategoryBadge>
                      </td>
                      <td>{r.kpi}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {inlineEditId === r.id ? (
                          <InlineInput
                            autoFocus
                            value={inlineEditValue}
                            onChange={e => setInlineEditValue(e.target.value)}
                            onBlur={() => handleInlineSave(r)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleInlineSave(r);
                              if (e.key === 'Escape') setInlineEditId(null);
                            }}
                          />
                        ) : (
                          <InlineValue onClick={() => {
                            // 분자/분모 레코드는 모달로 편집 (인라인은 단일값 전용)
                            if (r.numerator || r.denominator) {
                              handleEdit(r);
                              return;
                            }
                            setInlineEditId(r.id);
                            setInlineEditValue(r.value);
                          }}>
                            <strong>{r.value}</strong>
                            {r.numerator && r.denominator && (
                              <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 4 }}>
                                ({r.numerator}/{r.denominator})
                              </span>
                            )}
                          </InlineValue>
                        )}
                        {r.unit ? ` ${r.unit}` : ''}
                      </td>
                      <td>{r.baseDate}</td>
                      <td>
                        <ActionBtn $color="#8b5cf6" $hoverBg="#f5f3ff" onClick={() => handleEdit(r)}>수정</ActionBtn>
                        <DeleteBtn onClick={() => handleDelete(r.id)}>삭제</DeleteBtn>
                      </td>
                      <td></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </StyledTable>
        </TableWrapper>
        </>
        ) : viewMode === 'summary' ? (
        <>
          <YearSelectorContainer>
            {summaryPeriod !== 'evidence' && summaryPeriod !== 'graph' && (
              <PeriodToggle>
                <PeriodBtn $active={!summaryCompact} onClick={() => startTransition(() => setSummaryCompact(false))}>펼치기</PeriodBtn>
                <PeriodBtn $active={summaryCompact} onClick={() => startTransition(() => setSummaryCompact(true))}>접기</PeriodBtn>
              </PeriodToggle>
            )}
            <PeriodToggle>
              <PeriodBtn $active={summaryPeriod === 'quarter'} onClick={() => startTransition(() => setSummaryPeriod('quarter'))}>분기별</PeriodBtn>
              <PeriodBtn $active={summaryPeriod === 'month'} onClick={() => startTransition(() => setSummaryPeriod('month'))}>월별</PeriodBtn>
              <PeriodBtn $active={summaryPeriod === 'week'} onClick={() => startTransition(() => setSummaryPeriod('week'))}>주별</PeriodBtn>
              <PeriodBtn $active={summaryPeriod === 'evidence'} onClick={() => startTransition(() => setSummaryPeriod('evidence'))}>근거 자료</PeriodBtn>
              <PeriodBtn $active={summaryPeriod === 'graph'} onClick={() => startTransition(() => setSummaryPeriod('graph'))}>그래프</PeriodBtn>
            </PeriodToggle>
            <YearSelector>
              <YearButton onClick={() => setCurrentYear(y => y - 1)} title="이전 년도">‹</YearButton>
              <YearDisplay>{currentYear}년</YearDisplay>
              <YearButton onClick={() => setCurrentYear(y => y + 1)} title="다음 년도">›</YearButton>
            </YearSelector>
          </YearSelectorContainer>
          {summaryPeriod !== 'graph' && (
            <FilterBar>
              <FilterRow>
                <FilterLabel>사업부</FilterLabel>
                <FilterActionBtn onClick={() => setHiddenDivisions(new Set())}>전체 선택</FilterActionBtn>
                <FilterActionBtn onClick={() => setHiddenDivisions(new Set(DIVISIONS.map(d => d.name)))}>전체 해제</FilterActionBtn>
                {DIVISIONS.map(d => {
                  const active = !hiddenDivisions.has(d.name);
                  return (
                    <FilterChip key={d.id} $active={active} onClick={() => toggleHiddenItem(setHiddenDivisions, d.name)}>
                      {d.name}
                    </FilterChip>
                  );
                })}
                {hasActiveFilter && (
                  <FilterResetBtn onClick={resetSummaryFilters} title="모든 필터 해제">필터 초기화</FilterResetBtn>
                )}
              </FilterRow>
              {filterCategoryOptions.length > 0 && (
                <FilterRow>
                  <FilterLabel>구분</FilterLabel>
                  <FilterActionBtn onClick={() => setHiddenCategories(new Set())}>전체 선택</FilterActionBtn>
                  <FilterActionBtn onClick={() => setHiddenCategories(new Set(filterCategoryOptions))}>전체 해제</FilterActionBtn>
                  {filterCategoryOptions.map(c => {
                    const active = !hiddenCategories.has(c);
                    return (
                      <FilterChip key={c} $active={active} onClick={() => toggleHiddenItem(setHiddenCategories, c)}>
                        {c}
                      </FilterChip>
                    );
                  })}
                </FilterRow>
              )}
              {filterKpiOptionsCommon.length > 0 && (
                <FilterRow>
                  <FilterLabel>KPI (공통)</FilterLabel>
                  <FilterActionBtn onClick={() => setHiddenKpis(prev => {
                    const next = new Set(prev);
                    filterKpiOptionsCommon.forEach(k => next.delete(k));
                    return next;
                  })}>전체 선택</FilterActionBtn>
                  <FilterActionBtn onClick={() => setHiddenKpis(prev => {
                    const next = new Set(prev);
                    filterKpiOptionsCommon.forEach(k => next.add(k));
                    return next;
                  })}>전체 해제</FilterActionBtn>
                  {filterKpiOptionsCommon.map(k => {
                    const active = !hiddenKpis.has(k);
                    return (
                      <FilterChip key={k} $active={active} onClick={() => toggleHiddenItem(setHiddenKpis, k)}>
                        {k}
                      </FilterChip>
                    );
                  })}
                </FilterRow>
              )}
              {filterKpiOptionsSpecific.length > 0 && (
                <FilterRow>
                  <FilterLabel>KPI (사업부별)</FilterLabel>
                  <FilterActionBtn onClick={() => setHiddenKpis(prev => {
                    const next = new Set(prev);
                    filterKpiOptionsSpecific.forEach(k => next.delete(k));
                    return next;
                  })}>전체 선택</FilterActionBtn>
                  <FilterActionBtn onClick={() => setHiddenKpis(prev => {
                    const next = new Set(prev);
                    filterKpiOptionsSpecific.forEach(k => next.add(k));
                    return next;
                  })}>전체 해제</FilterActionBtn>
                  {filterKpiOptionsSpecific.map(k => {
                    const active = !hiddenKpis.has(k);
                    return (
                      <FilterChip key={k} $active={active} onClick={() => toggleHiddenItem(setHiddenKpis, k)}>
                        {k}
                      </FilterChip>
                    );
                  })}
                </FilterRow>
              )}
            </FilterBar>
          )}
          {summaryPeriod === 'graph' ? (
          <TableWrapper>
            <TableHeader>
              <TableTitle>KPI 추세 그래프</TableTitle>
            </TableHeader>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#475569', paddingTop: 5, flexShrink: 0 }}>사업부</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {DIVISIONS.map(div => {
                    const checked = graphDivisions.includes(div.name);
                    return (
                      <label key={div.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', border: `1px solid ${checked ? DIVISION_COLORS[div.name] : '#cbd5e1'}`, borderRadius: 16, fontSize: 12, cursor: 'pointer', background: checked ? `${DIVISION_COLORS[div.name]}15` : '#fff', color: checked ? DIVISION_COLORS[div.name] : '#64748b', fontWeight: 600 }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setGraphDivisions(prev => checked ? prev.filter(n => n !== div.name) : [...prev, div.name])}
                          style={{ display: 'none' }}
                        />
                        {div.name}
                      </label>
                    );
                  })}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#475569', paddingTop: 5, flexShrink: 0 }}>KPI 항목 <span style={{ fontWeight: 400, color: '#94a3b8' }}>(그릴 것만)</span></span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {availableKpis.length === 0 ? (
                    <span style={{ fontSize: 12, color: '#94a3b8', paddingTop: 5 }}>선택된 사업부에 해당하는 KPI 항목이 없습니다</span>
                  ) : (
                    <>
                      {availableKpis.map(k => {
                        // 아무것도 안 고르면 **전부** 그린다 — 그때는 전부 켜진 것처럼 보인다.
                        const active = graphKpis.length === 0 || graphKpis.includes(k.label);
                        return (
                          <button
                            key={k.label}
                            onClick={() => setGraphKpis(prev => {
                              const base = prev.length ? prev : availableKpis.map(x => x.label);
                              return base.includes(k.label)
                                ? base.filter(l => l !== k.label)
                                : [...base, k.label];
                            })}
                            style={{ padding: '4px 10px', border: `1px solid ${active ? '#8b5cf6' : '#cbd5e1'}`, borderRadius: 16, fontSize: 12, cursor: 'pointer', background: active ? '#f5f3ff' : '#fff', color: active ? '#7c3aed' : '#64748b', fontWeight: 600 }}
                          >
                            {k.label}{k.unit ? ` (${k.unit})` : ''}
                          </button>
                        );
                      })}
                      {graphKpis.length > 0 && (
                        <button
                          onClick={() => setGraphKpis([])}
                          style={{ padding: '4px 10px', border: '1px solid #cbd5e1', borderRadius: 16, fontSize: 12, cursor: 'pointer', background: '#fff', color: '#475569', fontWeight: 600 }}
                        >
                          전체 보기
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#475569', flexShrink: 0 }}>가로축</span>
                  <PeriodToggle>
                    <PeriodBtn $active={graphAxis === 'month'} onClick={() => setGraphAxis('month')}>월별</PeriodBtn>
                    <PeriodBtn $active={graphAxis === 'week'} onClick={() => setGraphAxis('week')}>주별</PeriodBtn>
                  </PeriodToggle>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#475569', flexShrink: 0 }}>목표 기준</span>
                  {graphDivisions.length === 0 ? (
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>사업부를 먼저 선택하세요</span>
                  ) : (
                    <PeriodToggle>
                      {graphDivisions.map(div => (
                        <PeriodBtn key={div} $active={graphTargetDiv === div} onClick={() => setGraphTargetDivision(div)}>
                          {div}
                        </PeriodBtn>
                      ))}
                    </PeriodToggle>
                  )}
                </div>
              </div>
              <ChartArea>
                {graphDivisions.length === 0 ? (
                  <ChartEmpty>사업부를 1개 이상 선택하세요</ChartEmpty>
                ) : graphCharts.length === 0 ? (
                  <ChartEmpty>{currentYear}년 데이터가 있는 KPI가 없습니다</ChartEmpty>
                ) : (
                  <>
                    {/* 범례는 **한 번만.** 차트마다 그리면 같은 줄이 열 번 반복돼 자리만 먹는다 */}
                    <ChartLegend>
                      {graphDivisions.map(div => (
                        <span key={div}>
                          <i style={{ background: DIVISION_COLORS[div] || '#64748b' }} />
                          {div}
                        </span>
                      ))}
                      {graphTargetDiv && (
                        <span>
                          <i style={{ background: 'none', borderTop: '2px dashed #0f172a', height: 0 }} />
                          목표 ({graphTargetDiv} 기준)
                        </span>
                      )}
                    </ChartLegend>
                    <ChartGrid>
                      {graphCharts.map(({ def, data }) => (
                        <ChartCard key={def.label}>
                          <ChartTitle>
                            <b>{def.label}</b>
                            {def.unit && <em>{def.unit}</em>}
                            <small>{def.category}</small>
                          </ChartTitle>
                          <KpiLineChart
                            data={data}
                            divisions={graphDivisions}
                            divisionColors={DIVISION_COLORS}
                            targetDiv={graphTargetDiv}
                          />
                        </ChartCard>
                      ))}
                    </ChartGrid>
                  </>
                )}
              </ChartArea>
            </div>
          </TableWrapper>
          ) : summaryPeriod === 'evidence' ? (
          <TableWrapper>
            <TableHeader>
              <TableTitle>KPI 근거 자료</TableTitle>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <RecordCount>총 {filteredAttachments.length}건</RecordCount>
                <SubmitBtn
                  style={{ padding: '6px 14px', fontSize: 12 }}
                  disabled={filteredAttachments.length === 0}
                  onClick={() => downloadAllAttachments(currentYear)}
                >
                  전체 다운로드
                </SubmitBtn>
              </div>
            </TableHeader>
            <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 260px)' }}>
            <SummaryTable style={{ tableLayout: 'fixed', minWidth: 'max-content' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', width: 60, borderRight: '1px solid #e2e8f0', position: 'sticky', left: 0, top: 0, zIndex: 3, background: '#f8fafc' }}>사업부</th>
                  <th style={{ textAlign: 'left', width: 44, borderRight: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 2, background: '#f8fafc' }}>구분</th>
                  <th style={{ textAlign: 'left', borderRight: '1px solid #e2e8f0', width: 140, position: 'sticky', top: 0, zIndex: 2, background: '#f8fafc' }}>KPI 항목</th>
                  {MONTHS.map(m => (
                    <th key={m} style={{ minWidth: 220, position: 'sticky', top: 0, zIndex: 2, background: '#f8fafc' }}>{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DIVISIONS.filter(d => !hiddenDivisions.has(d.name)).map(div => {
                  const divItems = getKpisForDivision(div.id).filter(item =>
                    !hiddenCategories.has(item.category) && !hiddenKpis.has(item.label)
                  );
                  if (divItems.length === 0) return null;
                  return (
                  <React.Fragment key={div.id}>
                    {divItems.map((item, kpiIdx) => {
                      const catColor = CATEGORY_COLORS[item.category];
                      return (
                        <tr key={`${div.id}-${item.label}`}>
                          {kpiIdx === 0 && (
                            <DivisionHeader rowSpan={divItems.length} style={{ borderRight: '1px solid #e2e8f0', verticalAlign: 'middle', position: 'sticky', left: 0, zIndex: 1 }}>
                              {div.name}
                            </DivisionHeader>
                          )}
                          <CategoryTd style={{ color: catColor.text, borderRight: '1px solid #f1f5f9' }}>
                            {item.category}
                          </CategoryTd>
                          <KpiNameCell style={{ borderRight: '1px solid #f1f5f9' }}>
                            {item.label}
                          </KpiNameCell>
                          {MONTHS.map(month => {
                            const cellFiles = filteredAttachments.filter(
                              a => a.division === div.name && a.kpi === item.label && a.month === month
                            );
                            const cellKey = `${div.name}::${item.label}::${month}`;
                            const isDragOver = dragOverCell === cellKey;
                            return (
                              <td
                                key={month}
                                style={{
                                  verticalAlign: 'top',
                                  padding: '4px 6px',
                                  background: isDragOver ? '#eef2ff' : undefined,
                                  outline: isDragOver ? '2px dashed #6366f1' : undefined,
                                  outlineOffset: -2,
                                  transition: 'background 0.12s ease',
                                }}
                                onDragEnter={(e) => {
                                  if (!e.dataTransfer.types || !e.dataTransfer.types.includes('Files')) return;
                                  e.preventDefault();
                                  setDragOverCell(cellKey);
                                }}
                                onDragOver={(e) => {
                                  if (!e.dataTransfer.types || !e.dataTransfer.types.includes('Files')) return;
                                  e.preventDefault();
                                  e.dataTransfer.dropEffect = 'copy';
                                  if (dragOverCell !== cellKey) setDragOverCell(cellKey);
                                }}
                                onDragLeave={(e) => {
                                  const next = e.relatedTarget;
                                  if (next instanceof Node && e.currentTarget.contains(next)) return;
                                  setDragOverCell(prev => (prev === cellKey ? null : prev));
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  setDragOverCell(null);
                                  const files = Array.from(e.dataTransfer.files || []);
                                  if (!files.length) return;
                                  uploadFilesToCell(files, div.name, item.label, month);
                                }}
                              >
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                  {cellFiles.map(f => (
                                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f0f4ff', borderRadius: 4, padding: '2px 6px', fontSize: 11 }}>
                                      <span
                                        style={{ color: '#3b82f6', cursor: 'pointer', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                        title={f.originalFilename}
                                        onClick={() => downloadAttachment(f.id, f.originalFilename)}
                                      >
                                        {f.originalFilename}
                                      </span>
                                      <button
                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 13, padding: 0, lineHeight: 1 }}
                                        onClick={() => handleDeleteAttachment(f.id)}
                                        title="삭제"
                                      >×</button>
                                    </div>
                                  ))}
                                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 3, cursor: 'pointer', color: '#8b5cf6', fontSize: 11, fontWeight: 600, padding: '2px 4px', borderRadius: 4 }}>
                                    <span>+ 업로드 (또는 드래그)</span>
                                    <input
                                      type="file"
                                      multiple
                                      style={{ display: 'none' }}
                                      onChange={async (e) => {
                                        const files = Array.from(e.target.files);
                                        await uploadFilesToCell(files, div.name, item.label, month);
                                        e.target.value = '';
                                      }}
                                    />
                                  </label>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </React.Fragment>
                  );
                })}
              </tbody>
            </SummaryTable>
            </div>
          </TableWrapper>
          ) : (
          <TableWrapper>
            <TableHeader>
              <TableTitle>KPI 종합 현황</TableTitle>
            </TableHeader>
            <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 260px)' }}>
            <SummaryTable style={{ tableLayout: 'fixed', minWidth: 'max-content' }}>
              <colgroup>
                <col style={{ width: 100 }} />
                <col style={{ width: 44 }} />
                <col style={{ width: 200 }} />
                {summaryColumns.map(col => (
                  summaryCompact ? (
                    <col key={col} style={{ width: 90 }} />
                  ) : (
                    <React.Fragment key={col}>
                      <col style={{ width: 50 }} />
                      <col style={{ width: 50 }} />
                      <col style={{ width: 55 }} />
                    </React.Fragment>
                  )
                ))}
                {summaryPeriod === 'quarter' && <col style={{ width: 140 }} />}
              </colgroup>
              <thead>
                <tr>
                  <th rowSpan={summaryCompact ? 1 : 2} style={{ textAlign: 'left', borderRight: '1px solid #e2e8f0', position: 'sticky', left: 0, top: 0, zIndex: 3, background: '#f8fafc' }}>사업부</th>
                  <th rowSpan={summaryCompact ? 1 : 2} style={{ textAlign: 'left', borderRight: '1px solid #e2e8f0', position: 'sticky', left: 100, top: 0, zIndex: 3, background: '#f8fafc' }}>구분</th>
                  <th rowSpan={summaryCompact ? 1 : 2} style={{ textAlign: 'left', borderRight: '1px solid #e2e8f0', position: 'sticky', left: 144, top: 0, zIndex: 3, background: '#f8fafc' }}>KPI 항목</th>
                  {summaryColumns.map(col => (
                    <th key={col} colSpan={summaryCompact ? 1 : 3} style={{ borderLeft: '1px solid #e2e8f0' }}>{col}</th>
                  ))}
                  {summaryPeriod === 'quarter' && <th rowSpan={summaryCompact ? 1 : 2} style={{ textAlign: 'left', minWidth: 120 }}>산출 기준</th>}
                </tr>
                {!summaryCompact && (
                  <tr>
                    {summaryColumns.map(col => (
                      <React.Fragment key={col}>
                        <SubHeader $color="#6366f1" $bg="#f5f3ff" style={{ borderLeft: '1px solid #e2e8f0', width: 50 }}>목표</SubHeader>
                        <SubHeader $color="#0891b2" $bg="#ecfeff" style={{ width: 50 }}>실적</SubHeader>
                        <SubHeader $color="#d97706" $bg="#fffbeb" style={{ width: 55 }}>달성률</SubHeader>
                      </React.Fragment>
                    ))}
                  </tr>
                )}
              </thead>
              <tbody>
                {summaryData
                  .filter(({ division }) => !hiddenDivisions.has(division.name))
                  .map(({ division, kpis }) => {
                    const visibleKpis = kpis.filter(item =>
                      !hiddenCategories.has(item.category) && !hiddenKpis.has(item.label)
                    );
                    if (visibleKpis.length === 0) return null;
                    return (
                  <React.Fragment key={division.id}>
                    {visibleKpis.map((item, kpiIdx) => {
                      const catColor = CATEGORY_COLORS[item.category];
                      return (
                        <tr key={`${division.id}-${item.label}`}>
                          {kpiIdx === 0 && (
                            <DivisionHeader rowSpan={visibleKpis.length} style={{ borderRight: '1px solid #e2e8f0', verticalAlign: 'middle', position: 'sticky', left: 0, zIndex: 1 }}>
                              {division.name}
                            </DivisionHeader>
                          )}
                          <CategoryTd style={{ color: catColor.text, borderRight: '1px solid #f1f5f9', position: 'sticky', left: 100, zIndex: 1, background: '#fff' }}>
                            {item.category}
                          </CategoryTd>
                          <KpiNameCell style={{ borderRight: '1px solid #f1f5f9', position: 'sticky', left: 144, zIndex: 1, background: '#fff' }}>
                            {item.label}
                            {item.unit && <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 4 }}>({item.unit})</span>}
                          </KpiNameCell>
                          {summaryColumns.map(col => {
                            const d = item.periodData[col];
                            const achievement = calcAchievement(d.target, d.actual, item.direction);
                            const achNum = achievement !== null ? parseFloat(achievement) : null;
                            // 색 경계도 공용 모듈이 정한다 — 화면마다 다르면
                            // 같은 칸이 어디선 노랑, 어디선 빨강이 된다.
                            const achColor = achievementColor(achNum);
                            const isFraction = item.valueType === 'fraction';
                            const showRaw = isFraction && item.showRawData !== false;
                            const targetDisplay = !d.target
                              ? null
                              : (showRaw && d.targetNumerator && d.targetDenominator
                                  ? formatFractionDisplay(d.target, item.unit, d.targetNumerator, d.targetDenominator)
                                  : formatValue(d.target, item.unit));
                            const actualDisplay = !d.actual
                              ? null
                              : (showRaw && d.actualNumerator && d.actualDenominator
                                  ? formatFractionDisplay(d.actual, item.unit, d.actualNumerator, d.actualDenominator)
                                  : formatValue(d.actual, item.unit));
                            if (summaryCompact) {
                              return (
                                <ValueCell key={col} $bold style={{ borderLeft: '1px solid #f1f5f9' }}>
                                  {actualDisplay || <span style={{ color: '#cbd5e1' }}>-</span>}
                                </ValueCell>
                              );
                            }
                            return (
                              <React.Fragment key={col}>
                                <ValueCell style={{ borderLeft: '1px solid #f1f5f9' }}>
                                  {targetDisplay || <span style={{ color: '#cbd5e1' }}>-</span>}
                                </ValueCell>
                                <ValueCell $bold>
                                  {actualDisplay || <span style={{ color: '#cbd5e1' }}>-</span>}
                                </ValueCell>
                                <ValueCell $color={achColor} $bold>
                                  {achievement !== null ? `${achievement}%` : <span style={{ color: '#cbd5e1' }}>-</span>}
                                </ValueCell>
                              </React.Fragment>
                            );
                          })}
                          {summaryPeriod === 'quarter' && (
                            <td style={{ textAlign: 'left', fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>
                              {criteria[item.label] || <span style={{ color: '#cbd5e1' }}>-</span>}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </React.Fragment>
                    );
                  })}
              </tbody>
            </SummaryTable>
            </div>
          </TableWrapper>
          )}
        </>
        ) : (
        <>
          <YearSelectorContainer>
            <YearSelector>
              <YearButton onClick={() => setCurrentYear(y => y - 1)} title="이전 년도">‹</YearButton>
              <YearDisplay>{currentYear}년</YearDisplay>
              <YearButton onClick={() => setCurrentYear(y => y + 1)} title="다음 년도">›</YearButton>
            </YearSelector>
          </YearSelectorContainer>
          <TableWrapper style={{ display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 180px)' }}>
            <TableHeader style={{ flexShrink: 0 }}>
              <TableTitle>주간 주요 동향</TableTitle>
              <RecordCount>총 {weeklyTrendsForYear.length}건</RecordCount>
            </TableHeader>
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 20px', borderBottom: '1px solid #e2e8f0', background: '#fafbfc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', minWidth: 56 }}>구분</span>
                {['개발', '제조'].map(cat => {
                  const checked = trendVisibleCategories.includes(cat);
                  const cc = CATEGORY_COLORS[cat];
                  return (
                    <label
                      key={cat}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 12px',
                        border: `1px solid ${checked ? cc.border : '#cbd5e1'}`,
                        borderRadius: 16,
                        fontSize: 12,
                        cursor: 'pointer',
                        background: checked ? cc.bg : '#fff',
                        color: checked ? cc.text : '#64748b',
                        fontWeight: 600,
                        userSelect: 'none',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setTrendVisibleCategories(prev =>
                          checked ? prev.filter(c => c !== cat) : [...prev, cat]
                        )}
                        style={{ display: 'none' }}
                      />
                      {cat}
                    </label>
                  );
                })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', minWidth: 56 }}>사업부</span>
                {DIVISIONS.map(div => {
                  const checked = trendVisibleDivisions.includes(div.name);
                  const color = DIVISION_COLORS[div.name];
                  return (
                    <label
                      key={div.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 12px',
                        border: `1px solid ${checked ? color : '#cbd5e1'}`,
                        borderRadius: 16,
                        fontSize: 12,
                        cursor: 'pointer',
                        background: checked ? `${color}15` : '#fff',
                        color: checked ? color : '#64748b',
                        fontWeight: 600,
                        userSelect: 'none',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setTrendVisibleDivisions(prev =>
                          checked ? prev.filter(n => n !== div.name) : [...prev, div.name]
                        )}
                        style={{ display: 'none' }}
                      />
                      {div.name}
                    </label>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    const all = DIVISIONS.map(d => d.name);
                    const isAll = trendVisibleDivisions.length === all.length;
                    setTrendVisibleDivisions(isAll ? [] : all);
                  }}
                  style={{
                    marginLeft: 'auto',
                    padding: '4px 10px',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    fontSize: 11,
                    background: '#fff',
                    color: '#64748b',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {trendVisibleDivisions.length === DIVISIONS.length ? '전체 해제' : '전체 선택'}
                </button>
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              <SummaryTable style={{ tableLayout: 'fixed', width: 'max-content', minWidth: '100%' }}>
                <colgroup>
                  <col style={{ width: 120 }} />
                  {visibleTrendCategories.map(cat => (
                    <React.Fragment key={`cg-${cat}`}>
                      {visibleTrendDivisions.map(div => (
                        <col key={`cg-${cat}-${div.id}`} style={{ width: 'calc((100vw - 200px) / 5)' }} />
                      ))}
                    </React.Fragment>
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <th
                      rowSpan={2}
                      style={{
                        textAlign: 'center',
                        borderRight: '1px solid #e2e8f0',
                        position: 'sticky',
                        top: 0,
                        left: 0,
                        zIndex: 4,
                        background: '#f8fafc',
                        verticalAlign: 'middle',
                      }}
                    >
                      주차
                    </th>
                    {visibleTrendCategories.map(cat => (
                      <th
                        key={cat}
                        colSpan={visibleTrendDivisions.length || 1}
                        style={{
                          textAlign: 'center',
                          borderRight: '1px solid #e2e8f0',
                          borderBottom: '1px solid #e2e8f0',
                          position: 'sticky',
                          top: 0,
                          zIndex: 3,
                          background: '#f8fafc',
                          color: CATEGORY_COLORS[cat].text,
                        }}
                      >
                        {cat}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {visibleTrendCategories.map(cat => (
                      <React.Fragment key={`${cat}-divs`}>
                        {visibleTrendDivisions.map((div, i) => (
                          <th
                            key={`${cat}-${div.id}`}
                            style={{
                              textAlign: 'center',
                              borderRight: i === visibleTrendDivisions.length - 1 ? '1px solid #e2e8f0' : '1px solid #f1f5f9',
                              position: 'sticky',
                              top: 28,
                              zIndex: 3,
                              background: '#f8fafc',
                            }}
                          >
                            {div.name}
                          </th>
                        ))}
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trendWeeks.length === 0 || visibleTrendCategories.length === 0 || visibleTrendDivisions.length === 0 ? (
                    <tr>
                      <td colSpan={1 + Math.max(visibleTrendCategories.length * visibleTrendDivisions.length, 1)}>
                        <EmptyState>
                          {visibleTrendCategories.length === 0 || visibleTrendDivisions.length === 0
                            ? '표시할 구분 또는 사업부를 1개 이상 선택하세요.'
                            : <>{currentYear}년 주간 주요 동향이 없습니다.<br />상단의 "주간 주요 동향 추가" 버튼을 눌러 코멘트를 입력하세요.</>}
                        </EmptyState>
                      </td>
                    </tr>
                  ) : (
                    trendWeeks.map(weekNum => (
                      <tr key={weekNum}>
                        <td
                          style={{
                            fontWeight: 700,
                            textAlign: 'center',
                            background: '#f8fafc',
                            borderRight: '1px solid #e2e8f0',
                            position: 'sticky',
                            left: 0,
                            zIndex: 1,
                          }}
                        >
                          {weekNum}주차
                        </td>
                        {visibleTrendCategories.map(cat => (
                          <React.Fragment key={`${cat}-${weekNum}`}>
                            {visibleTrendDivisions.map((div, i) => {
                              const cell = trendCellMap[`${div.name}|${cat}|${weekNum}`];
                              const isCatEnd = i === visibleTrendDivisions.length - 1;
                              return (
                                <td
                                  key={`${cat}-${div.id}`}
                                  style={{
                                    verticalAlign: 'top',
                                    padding: '8px 10px',
                                    borderRight: isCatEnd ? '1px solid #e2e8f0' : '1px solid #f1f5f9',
                                    cursor: 'pointer',
                                    background: cell ? '#fff' : '#fafbfc',
                                    fontSize: 12,
                                    lineHeight: 1.55,
                                    color: '#334155',
                                          whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                    overflowWrap: 'anywhere',
                                    textAlign: 'left',
                                  }}
                                  title={cell ? '클릭하여 수정' : '클릭하여 추가'}
                                  onClick={() => {
                                    if (cell) {
                                      setEditingTrend(cell);
                                    } else {
                                      setEditingTrend({
                                        id: null,
                                        division: div.name,
                                        category: cat,
                                        year: currentYear,
                                        week: weekNum,
                                        content: '',
                                      });
                                    }
                                    setShowTrendModal(true);
                                  }}
                                >
                                  {cell ? cell.content : <span style={{ color: '#cbd5e1' }}>—</span>}
                                </td>
                              );
                            })}
                          </React.Fragment>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </SummaryTable>
            </div>
          </TableWrapper>
        </>
        )}
      </MainContent>

      {showModal && (
        <Overlay onClick={() => { setShowModal(false); setEditingRecord(null); }}>
          <Modal onClick={e => e.stopPropagation()} style={{ width: '80vw', maxWidth: '80vw', height: '80vh', maxHeight: '80vh' }}>
            <ModalHeader>
              <ModalTitle>{editingRecord ? 'KPI 입력 수정' : 'KPI 입력'}</ModalTitle>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {!editingRecord && (
                  <ModeToggle>
                    <ModeBtn $active={entryMode === 'single'} onClick={() => setEntryMode('single')}>단건</ModeBtn>
                    <ModeBtn $active={entryMode === 'bulk'} onClick={() => {
                      setEntryMode('bulk');
                      // 열이 하나도 없으면 아무것도 못 넣는다 — 이번 달말로 한 칸 열어 준다.
                      if (gridDates.length === 0) {
                        // 첫 열이 **기준 날짜**다. 여기서부터 +7일씩 열을 늘린다.
                        setGridDates([todayStr()]);
                      }
                    }}>일괄</ModeBtn>
                  </ModeToggle>
                )}
                <CloseBtn onClick={() => { setShowModal(false); setEditingRecord(null); }}>&times;</CloseBtn>
              </div>
            </ModalHeader>
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              {/* 좌측 패널: 사업부 + KPI 항목 선택 */}
              <div style={{ flex: '0 0 33.3%', borderRight: '1px solid #e2e8f0', padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
                <Field>
                  <Label>사업부</Label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {DIVISIONS.map(d => (
                      <DivisionBtn
                        key={d.id}
                        $active={selectedDivision === d.name}
                        onClick={() => selectDivision(d.name)}
                        style={{ textAlign: 'left' }}
                      >
                        {d.name}
                      </DivisionBtn>
                    ))}
                  </div>
                </Field>
                <Field>
                  <Label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>KPI 항목</span>
                    {!editingRecord && (
                      <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 11 }}>
                        {selectedKpis.length}개 선택
                      </span>
                    )}
                    {/* 사업부를 고르면 자동으로 다 켜지므로, 되돌릴 단추가 반드시 있어야 한다 */}
                    {!editingRecord && (
                      <button
                        type="button"
                        onClick={toggleAllKpis}
                        style={{ marginLeft: 'auto', padding: '2px 8px', fontSize: 11, fontWeight: 600, color: '#475569', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer' }}
                      >
                        {selectedKpis.length > 0 ? '전체 해제' : '전체 선택'}
                      </button>
                    )}
                  </Label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {editingRecord ? (
                      <DivisionBtn $active style={{ textAlign: 'left' }}>
                        {selectedKpi} <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>({category})</span>
                      </DivisionBtn>
                    ) : (selectedDivision ? getKpisForDivisionName(selectedDivision) : kpiDefinitions).map(item => {
                      const cc = CATEGORY_COLORS[item.category];
                      const active = selectedKpis.includes(item.label);
                      return (
                        <DivisionBtn
                          key={item.label}
                          $active={active}
                          onClick={() => {
                            // 일괄(격자)도 이제 **여러 KPI** 를 함께 다룬다.
                            // 예전에는 여기서 한 개로 잘라서, 사업부 하나를 넣으려면
                            // KPI 를 열 번 바꿔 가며 같은 일을 열 번 해야 했다.
                            toggleKpi(item.label);
                          }}
                          style={{ textAlign: 'left', ...(active ? {} : { borderColor: cc.border || '#e2e8f0', color: cc.text }) }}
                        >
                          <span style={{ fontSize: 10, marginRight: 6, opacity: 0.7 }}>{item.category}</span>
                          {item.label}
                        </DivisionBtn>
                      );
                    })}
                  </div>
                </Field>
              </div>

              {/* 우측 패널: 입력 영역 */}
              <div style={{ flex: '0 0 66.7%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <ModalBody>
                  {editingRecord ? (
                    <>
                      <Field>
                        <Label>기준 날짜</Label>
                        <Input type="date" value={baseDate} onChange={e => setBaseDate(e.target.value)} />
                      </Field>
                      <Field>
                        <Label>값</Label>
                        {selectedItem?.valueType === 'fraction' ? (() => {
                          const n = parseFloat(editNumerator);
                          const d = parseFloat(editDenominator);
                          const preview = (!isNaN(n) && !isNaN(d) && d !== 0) ? (unit === '%' ? (n / d) * 100 : n / d).toFixed(1) : null;
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Input
                                type="text"
                                placeholder="분자"
                                value={editNumerator}
                                onChange={e => setEditNumerator(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleUpdate(); }}
                                style={{ width: 100 }}
                              />
                              <span style={{ fontSize: 14, color: '#64748b' }}>/</span>
                              <Input
                                type="text"
                                placeholder="분모"
                                value={editDenominator}
                                onChange={e => setEditDenominator(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleUpdate(); }}
                                style={{ width: 100 }}
                              />
                              <span style={{ fontSize: 13, fontWeight: 700, color: preview !== null ? '#0891b2' : '#cbd5e1', marginLeft: 8 }}>
                                = {preview !== null ? `${preview}${unit || ''}` : '-'}
                              </span>
                            </div>
                          );
                        })() : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Input
                              type="text"
                              placeholder="값을 입력하세요"
                              value={value}
                              onChange={e => setValue(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleUpdate(); }}
                              style={{ flex: 1 }}
                            />
                            {unit && <span style={{ fontSize: 14, fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>{unit}</span>}
                          </div>
                        )}
                      </Field>
                    </>
                  ) : entryMode === 'single' ? (
                    selectedKpis.length === 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#94a3b8', fontSize: 14 }}>
                        좌측에서 KPI 항목을 선택하세요
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#f0f9ff', borderRadius: 8, border: '1px dashed #93c5fd' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#0369a1', flexShrink: 0 }}>기준 날짜</span>
                          <MonthEndSelect
                            value=""
                            onChange={e => {
                              if (!e.target.value) return;
                              const m = Number(e.target.value);
                              applyCommonDate(makeMonthEndDate(currentYear, m));
                              e.target.value = '';
                            }}
                          >
                            <option value="">월말</option>
                            {Array.from({ length: 12 }, (_, i) => (
                              <option key={i + 1} value={i + 1}>{i + 1}월말</option>
                            ))}
                          </MonthEndSelect>
                          <Input
                            type="date"
                            style={{ width: 150 }}
                            value={commonDate}
                            onChange={e => applyCommonDate(e.target.value)}
                          />
                          <span style={{ fontSize: 11, color: '#64748b' }}>아래 값 전부에 이 날짜로 기록됩니다</span>
                          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                            {/* 같은 날짜로 저장하면 그날 기록이 두 벌이 된다.
                                불러온 값을 그대로 저장하려는 참이라 특히 걸리기 쉽다. */}
                            {lastLoadInfo.newest && commonDate === lastLoadInfo.newest && (
                              <span style={{ fontSize: 11, color: '#b45309', fontWeight: 600 }}>
                                기준 날짜가 마지막 기록과 같습니다
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={loadLastValues}
                              disabled={lastLoadInfo.count === 0}
                              title="지난 기록을 입력칸에 채웁니다. 기준 날짜는 그대로 두므로, 고쳐서 다음 날짜로 저장하면 됩니다."
                              style={{
                                padding: '4px 10px', fontSize: 11.5, fontWeight: 700,
                                color: lastLoadInfo.count ? '#0369a1' : '#cbd5e1',
                                background: '#fff',
                                border: `1px solid ${lastLoadInfo.count ? '#93c5fd' : '#e2e8f0'}`,
                                borderRadius: 6,
                                cursor: lastLoadInfo.count ? 'pointer' : 'default',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              마지막 값 불러오기
                              {lastLoadInfo.count > 0 && (
                                <span style={{ fontWeight: 500, color: '#64748b' }}>
                                  {' '}({lastLoadInfo.count}개
                                  {lastLoadInfo.newest ? ` · ~${lastLoadInfo.newest.slice(5).replace('-', '/')}` : ''})
                                </span>
                              )}
                            </button>
                          </div>
                        </div>
                        {selectedKpis.map(label => {
                          const item = kpiDefinitions.find(k => k.label === label);
                          const cc = CATEGORY_COLORS[item.category];
                          const entry = kpiEntries[label] || { baseDate: '', value: '', numerator: '', denominator: '' };
                          const isFraction = item.valueType === 'fraction';
                          const fracNum = parseFloat(entry.numerator);
                          const fracDen = parseFloat(entry.denominator);
                          const fracPreview = (isFraction && !isNaN(fracNum) && !isNaN(fracDen) && fracDen !== 0)
                            ? (item.unit === '%' ? (fracNum / fracDen) * 100 : fracNum / fracDen).toFixed(1)
                            : null;
                          return (
                            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                              <CategoryBadge $bg={cc.bg} $color={cc.text} $border={cc.border} style={{ flexShrink: 0 }}>
                                {item.category}
                              </CategoryBadge>
                              <span style={{ fontSize: 13, fontWeight: 600, color: '#334155', minWidth: 110, flexShrink: 0 }}>{label}</span>
                              {isFraction ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                                  <Input
                                    type="text"
                                    placeholder="분자"
                                    style={{ width: 80, flexShrink: 0 }}
                                    value={entry.numerator || ''}
                                    onChange={e => updateKpiEntry(label, 'numerator', e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
                                    onPaste={e => handleSinglePaste(e, label, 'numerator')}
                                  />
                                  <span style={{ fontSize: 14, color: '#64748b' }}>/</span>
                                  <Input
                                    type="text"
                                    placeholder="분모"
                                    style={{ width: 80, flexShrink: 0 }}
                                    value={entry.denominator || ''}
                                    onChange={e => updateKpiEntry(label, 'denominator', e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
                                    onPaste={e => handleSinglePaste(e, label, 'denominator')}
                                  />
                                  <span style={{ fontSize: 12, fontWeight: 700, color: fracPreview !== null ? '#0891b2' : '#cbd5e1', whiteSpace: 'nowrap', marginLeft: 4 }}>
                                    = {fracPreview !== null ? `${fracPreview}${item.unit || ''}` : '-'}
                                  </span>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                                  <Input
                                    type="text"
                                    placeholder="값"
                                    style={{ flex: 1 }}
                                    value={entry.value}
                                    onChange={e => updateKpiEntry(label, 'value', e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
                                    onPaste={e => handleSinglePaste(e, label, 'value')}
                                  />
                                  {item.unit && <span style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', whiteSpace: 'nowrap' }}>{item.unit}</span>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )
                  ) : (
                    selectedKpis.length === 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#94a3b8', fontSize: 14 }}>
                        좌측에서 KPI 항목을 선택하세요 (여러 개 고를 수 있습니다)
                      </div>
                    ) : (
                      <BulkGrid
                        kpis={selectedKpis
                          .map(l => kpiDefinitions.find(k => k.label === l))
                          .filter(Boolean)}
                        dates={gridDates}
                        values={gridValues}
                        onDatesChange={setGridDates}
                        onChange={setGridCell}
                        onPasteBlock={pasteGridBlock}
                        computeFraction={computeFraction}
                        addDays={addDaysYmd}
                        todayStr={todayStr}
                      />
                    )
                  )}
                </ModalBody>
              </div>
            </div>
            <ModalFooter>
              <CancelBtn onClick={() => { setShowModal(false); setEditingRecord(null); }}>취소</CancelBtn>
              {editingRecord ? (() => {
                const isFraction = selectedItem?.valueType === 'fraction';
                const validEdit = isFraction
                  ? (() => { const n = parseFloat(editNumerator); const d = parseFloat(editDenominator); return !isNaN(n) && !isNaN(d) && d !== 0; })()
                  : !!value;
                return (
                  <SubmitBtn disabled={!selectedKpi || !selectedDivision || !validEdit || !baseDate} onClick={handleUpdate}>
                    수정 완료
                  </SubmitBtn>
                );
              })() : entryMode === 'single' ? (() => {
                const validCount = selectedKpis.filter(k => {
                  const e = kpiEntries[k];
                  if (!e || !e.baseDate) return false;
                  const def = kpiDefinitions.find(d => d.label === k);
                  if (def?.valueType === 'fraction') {
                    const n = parseFloat(e.numerator);
                    const d = parseFloat(e.denominator);
                    return !isNaN(n) && !isNaN(d) && d !== 0;
                  }
                  return !!e.value;
                }).length;
                return (
                  <>
                    <SubmitBtn disabled={!selectedDivision || validCount === 0} onClick={handleSubmit}>
                      {validCount > 0 ? `${validCount}건 추가` : '기록 추가'}
                    </SubmitBtn>
                    <SubmitBtn disabled={!selectedDivision || validCount === 0} onClick={handleSubmitAndClose} style={{ background: '#6d28d9' }}>
                      추가 후 닫기
                    </SubmitBtn>
                  </>
                );
              })() : (() => {
                // 격자에서 **값이 들어간 칸**만 센다. 빈 칸은 저장 대상이 아니다.
                let n = 0;
                selectedKpis.forEach(label => {
                  const def = kpiDefinitions.find(k => k.label === label);
                  if (!def) return;
                  gridDates.forEach(date => {
                    if (!date) return;
                    const c = (gridValues[label] || {})[date] || {};
                    if (def.valueType === 'fraction') {
                      if (computeFraction(c.numerator, c.denominator, def.unit) !== null) n += 1;
                    } else if (String(c.value ?? '').trim()) {
                      n += 1;
                    }
                  });
                });
                return (
                  <SubmitBtn
                    disabled={selectedKpis.length === 0 || !selectedDivision || n === 0}
                    onClick={handleGridSubmit}
                  >
                    {n}건 일괄 추가
                  </SubmitBtn>
                );
              })()}
            </ModalFooter>
          </Modal>
        </Overlay>
      )}
      {showSettings && (
        <SettingsModal
          targets={targets}
          criteria={criteria}
          kpiDefinitions={kpiDefinitions}
          onSave={setTargets}
          onSaveCriteria={setCriteria}
          onKpiDefinitionsChange={setKpiDefinitions}
          onClose={() => setShowSettings(false)}
        />
      )}
      <ImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        /* 저장하면 목록을 다시 읽는다 — 반입한 값이 화면에 바로 보여야 한다 */
        onDone={() => { loadRecords(); loadWeeklyTrends(); }}
        kpiDefinitions={kpiDefinitions}
        defaultYear={currentYear}
        weeks={trendWeekLabels}
      />
      <WeeklyTrendModal
        open={showTrendModal}
        onClose={() => { setShowTrendModal(false); setEditingTrend(null); }}
        onSubmit={handleTrendSubmit}
        onSubmitMany={handleTrendSubmitMany}
        onDelete={handleTrendDelete}
        trends={weeklyTrends}
        divisions={DIVISIONS}
        weeks={trendWeekLabels}
        defaultYear={currentYear}
        initial={editingTrend}
      />
      {toast && <Toast>{toast}</Toast>}
    </Container>
  );
};

export default DxKpiManagementApp;
