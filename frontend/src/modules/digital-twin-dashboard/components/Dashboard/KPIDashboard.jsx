import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Plus, Trash2, Check, Search, Square, CheckSquare, ChevronDown, Pencil, ArrowLeft, ArrowRight, ChevronsLeft, ChevronsRight, X, BarChart3, Download, LayoutGrid, Grid, Table } from 'lucide-react';
import systemSettings from '../../../../option/systemsetting.json';
import { evalFactor } from '../../utils/evalFactor';
// 변화량(목표−현재 · 실적−현재). 사용자가 실제로 보는 값은 절대수준이 아니라 이 차이다.
import { deltaText, levelDelta } from '../../utils/levelValue';
import { useAuth } from '../../../../contexts/AuthContext';
import KPITreemap from './KPITreemap';
import AllPerformancesView from './AllPerformancesView';
import {
  fetchKPIDashboardCards,
  createKPIDashboardCard,
  updateKPIDashboardCard,
  deleteKPIDashboardCard,
  reorderKPIDashboardCards,
  saveSystemSettings
} from '../../services/settingsApi';

// ============== 헬퍼 ==============

const extractDivisionFromPerformance = (performanceName) => {
  const match = (performanceName || '').match(/^\[(.+?)\]\s*(.*)$/);
  if (match) {
    return { division: match[1], name: match[2] };
  }
  return { division: '미분류', name: performanceName || '' };
};

const getPerfKey = (p) => p.uuid || p.id || p.성과항목;

const formatNumber = (value) => {
  if (value === undefined || value === null || value === '') return '-';
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return parseFloat(num.toFixed(1)).toLocaleString();
};

// ============== 메인 레이아웃 스타일 ==============

const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: #f8fafc;
  overflow: hidden;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background: white;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
  /* 원본 성과 테이블 뷰에서는 툴바가 추가로 들어와 한 줄이 길어짐 */
  flex-wrap: wrap;
  row-gap: 0.75rem;
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
  svg { color: #6366f1; }
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  justify-content: flex-end;
  row-gap: 0.75rem;
`;

const AddButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.875rem;
  background: #6366f1;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  &:hover {
    background: #4f46e5;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
  }
  &:active { transform: translateY(0); }
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
  &:hover { background: #e2e8f0; }
`;

const YearDisplay = styled.div`
  font-size: 1rem;
  font-weight: 700;
  color: #1e293b;
  min-width: 60px;
  text-align: center;
`;

const ViewToggle = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  padding: 0.2rem;
`;

const ViewToggleButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.35rem 0.7rem;
  background: ${p => p.$active ? 'white' : 'transparent'};
  color: ${p => p.$active ? '#4338ca' : '#64748b'};
  border: none;
  border-radius: 0.35rem;
  font-size: 0.78rem;
  font-weight: ${p => p.$active ? 700 : 500};
  cursor: pointer;
  transition: all 0.15s;
  box-shadow: ${p => p.$active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'};
  &:hover {
    color: ${p => p.$active ? '#4338ca' : '#334155'};
    background: ${p => p.$active ? 'white' : 'rgba(255,255,255,0.5)'};
  }
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
  background: ${p => p.$active ? '#6366f1' : 'white'};
  color: ${p => p.$active ? 'white' : '#64748b'};
  border: 1px solid ${p => p.$active ? '#6366f1' : '#e2e8f0'};
  border-radius: 0.5rem;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  &:hover {
    background: ${p => p.$active ? '#4f46e5' : '#f8fafc'};
    border-color: ${p => p.$active ? '#4f46e5' : '#cbd5e1'};
  }
`;

const FilterBadge = styled.span`
  padding: 0.125rem 0.375rem;
  background: ${p => p.$active ? 'rgba(255,255,255,0.3)' : '#e2e8f0'};
  border-radius: 0.25rem;
  font-size: 0.7rem;
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem 2rem;
  &::-webkit-scrollbar { width: 8px; }
  &::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
  &::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
`;

const CardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
`;

const KPICard = styled(motion.div)`
  background: white;
  border-radius: 0.75rem;
  padding: 1.25rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid #e2e8f0;
  border-left: 4px solid ${p => p.$borderColor || '#6366f1'};
  cursor: pointer;
  transition: box-shadow 0.15s;
  &:hover { box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1); }
  &:hover .card-actions { opacity: 1; pointer-events: auto; }
`;

const CardActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
`;

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
`;

const CardName = styled.div`
  font-size: 0.95rem;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 0.25rem;
`;

const CardTitle = styled.div`
  font-size: 0.8rem;
  font-weight: 600;
  color: #64748b;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const CardDivision = styled.span`
  display: inline-block;
  background: ${p => p.$color || '#e2e8f0'};
  color: white;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: 9999px;
  margin-bottom: 0.35rem;
`;

const CardLogic = styled.span`
  font-size: 0.7rem;
  font-weight: 500;
  color: #94a3b8;
  background: #f1f5f9;
  padding: 0.15rem 0.5rem;
  border-radius: 0.25rem;
  white-space: nowrap;
`;

const CardCount = styled.div`
  font-size: 0.75rem;
  color: #94a3b8;
  margin-top: 0.5rem;
`;

const CardLevels = styled.div`
  display: flex;
  gap: 0;
  margin-top: 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  overflow: hidden;
`;

const CardLevelItem = styled.div`
  flex: 1;
  text-align: center;
  padding: 0.4rem 0.25rem;
  border-right: 1px solid #e2e8f0;
  &:last-child { border-right: none; }
`;

const CardLevelLabel = styled.div`
  font-size: 0.65rem;
  color: #94a3b8;
  margin-bottom: 0.15rem;
`;

const CardLevelValue = styled.div`
  font-size: 0.85rem;
  font-weight: 700;
  color: ${p => p.$color || '#374151'};
  font-variant-numeric: tabular-nums;
`;

const CardLevelDelta = styled.div`
  font-size: 0.8rem;
  font-weight: 600;
  color: ${p => p.$positive ? '#059669' : p.$negative ? '#dc2626' : '#94a3b8'};
  margin-top: 0.1rem;
  font-variant-numeric: tabular-nums;
`;

// delta 기준 현재값(부분 입력 시 전체 현재값과 다름)을 작게 병기
const CardLevelBase = styled.div`
  font-size: 0.62rem;
  font-weight: 500;
  color: #94a3b8;
  margin-top: 0.1rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  cursor: help;
  border-bottom: 1px dotted #cbd5e1;
  display: inline-block;
`;

const MonthlyGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 2px;
  margin-top: 0.5rem;
`;

const MonthCell = styled.div`
  text-align: center;
  padding: 0.2rem 0;
  border-radius: 3px;
  background: ${p => p.$hasValue ? '#f0f4ff' : '#f8fafc'};
`;

const MonthCellLabel = styled.div`
  font-size: 0.6rem;
  color: #94a3b8;
  line-height: 1;
`;

const MonthCellValue = styled.div`
  font-size: 0.7rem;
  font-weight: 600;
  color: ${p => p.$hasValue ? '#1e293b' : '#d1d5db'};
  line-height: 1.3;
  font-variant-numeric: tabular-nums;
`;

const DeleteButton = styled.button`
  background: none;
  border: none;
  color: #cbd5e1;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 0.25rem;
  display: flex;
  align-items: center;
  transition: color 0.2s;
  &:hover { color: #ef4444; }
`;

const MoveButton = styled.button`
  background: none;
  border: none;
  color: #cbd5e1;
  cursor: pointer;
  padding: 0.2rem;
  border-radius: 0.25rem;
  display: flex;
  align-items: center;
  transition: all 0.15s;
  &:hover { color: #6366f1; background: #eef2ff; }
  &:disabled { opacity: 0.3; cursor: default; &:hover { color: #cbd5e1; background: none; } }
`;

// ============== 상세 모달 스타일 ==============

const DetailOverlay = styled(motion.div)`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const DetailModal = styled(motion.div)`
  background: white;
  border-radius: 0.75rem;
  width: min(92vw, 1080px);
  height: 84vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.18);
  overflow: hidden;
`;

/* 헤더 / 본문 행 / 월별 하위 행이 같은 컬럼 폭을 쓰도록 공유.
   숫자 칸을 고정폭으로 두어야 넓은 화면에서도 이름 옆에 붙어 읽힌다. */
const DETAIL_GRID = `
  display: grid;
  /* 성과항목 | 연결과제 | 현재 | 목표 | 목표Δ | 실적 | 실적Δ | 단위
     변화량(Δ) 두 열은 2026-08-06 추가 — 사용자가 실제로 보는 값은 절대수준이 아니라
     '현재 대비 얼마나 움직였나' 인데 그게 안 보여서 헷갈린다는 피드백. */
  grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr) 5rem 5rem 5rem 5rem 5rem 3.5rem;
  gap: 0 0.75rem;
`;

const DetailHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
`;

const DetailTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  color: #1e293b;
`;

const DetailCloseBtn = styled.button`
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  &:hover { color: #374151; background: #f3f4f6; }
`;

const DetailSummary = styled.div`
  display: flex;
  gap: 1rem;
  padding: 0.75rem 1.25rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
  flex-wrap: wrap;
`;

const SummaryItem = styled.div`
  font-size: 0.8rem;
  color: #64748b;
  span { font-weight: 600; color: #1e293b; }
`;

const DetailTable = styled.div`
  flex: 1;
  overflow-y: auto;
  &::-webkit-scrollbar { width: 6px; }
  &::-webkit-scrollbar-track { background: #f1f5f9; }
  &::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
`;

const DetailTableHeader = styled.div`
  ${DETAIL_GRID}
  padding: 0.6rem 1.25rem;
  background: #f1f5f9;
  border-bottom: 1px solid #e2e8f0;
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
  position: sticky;
  top: 0;
  z-index: 1;
`;

const DetailTableRow = styled.div`
  ${DETAIL_GRID}
  padding: 0.55rem 1.25rem;
  border-bottom: 1px solid #f3f4f6;
  font-size: 0.8rem;
  color: #374151;
  align-items: center;
  transition: background 0.1s;
  &:hover { background: #f8fafc; }
`;

const DetailPerfName = styled.div`
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  ${p => p.$clickable && `
    cursor: pointer;
    color: #2563eb;
    &:hover { color: #1d4ed8; text-decoration: underline; }
  `}
`;

const DetailPerfMeta = styled.div`
  font-size: 0.7rem;
  color: #9ca3af;
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const DetailCell = styled.div`
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  ${p => p.$highlight && `font-weight: 600; color: #1e293b;`}
  ${p => p.$header && `font-weight: 600; color: #64748b;`}
`;

const DetailProjectCell = styled.div`
  font-size: 0.75rem;
  color: #6366f1;
  min-width: 0;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.35;
  word-break: break-all;
`;

const DetailProjectLink = styled.span`
  cursor: pointer;
  &:hover { text-decoration: underline; color: #4f46e5; }
`;

const MonthSubRow = styled.div`
  ${DETAIL_GRID}
  padding: 0.35rem 1.25rem 0.35rem 2.5rem;
  border-bottom: 1px solid #f9fafb;
  font-size: 0.75rem;
  color: #64748b;
  align-items: center;
  background: #fafbfc;
`;

const MonthLabel = styled.div`
  font-weight: 500;
  color: #6b7280;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  color: #94a3b8;
  text-align: center;
`;

// ============== 모달 스타일 ==============

const ModalOverlay = styled(motion.div)`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled(motion.div)`
  background: white;
  border-radius: 1rem;
  width: 80vw;
  height: 80vh;
  max-width: 1400px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  overflow: hidden;
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
`;

const ModalTitle = styled.h3`
  font-size: 1.25rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ModalBody = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
`;

const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid #e2e8f0;
  flex-shrink: 0;
`;

// 좌측 패널
const LeftPanel = styled.div`
  width: 380px;
  min-width: 380px;
  border-right: 1px solid #e2e8f0;
  overflow-y: auto;
  padding: 1.25rem 1.5rem;
  &::-webkit-scrollbar { width: 6px; }
  &::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 3px; }
  &::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
`;

// 우측 패널
const RightPanel = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #f8fafc;
`;

const RightPanelHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.875rem 1.25rem;
  border-bottom: 1px solid #e2e8f0;
  background: white;
  flex-shrink: 0;
  gap: 0.75rem;
`;

const RightPanelTitle = styled.div`
  font-size: 0.85rem;
  font-weight: 600;
  color: #1e293b;
  white-space: nowrap;
`;

const RightPanelCount = styled.span`
  font-size: 0.75rem;
  font-weight: 500;
  color: #6366f1;
  background: #eef2ff;
  padding: 0.2rem 0.5rem;
  border-radius: 9999px;
  margin-left: 0.5rem;
`;

const SearchBox = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.75rem;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  flex: 1;
  max-width: 280px;
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
  font-size: 0.8rem;
  color: #1e293b;
  width: 100%;
  &::placeholder { color: #94a3b8; }
`;

const SelectAllRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1.25rem;
  background: white;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
`;

const SelectAllButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.35rem 0.75rem;
  background: ${p => p.$allSelected ? '#eef2ff' : 'white'};
  color: ${p => p.$allSelected ? '#4338ca' : '#64748b'};
  border: 1px solid ${p => p.$allSelected ? '#6366f1' : '#e2e8f0'};
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { border-color: #a5b4fc; }
`;

const PerfList = styled.div`
  flex: 1;
  overflow-y: auto;
  &::-webkit-scrollbar { width: 6px; }
  &::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 3px; }
  &::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
`;

const PerfRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 1.25rem;
  background: ${p => p.$selected ? 'white' : '#f8fafc'};
  border-bottom: 1px solid #f1f5f9;
  cursor: pointer;
  transition: background 0.15s;
  opacity: ${p => p.$selected ? 1 : 0.55};
  &:hover { background: ${p => p.$selected ? '#f8fafc' : '#f1f5f9'}; }
`;

const PerfCheckbox = styled.div`
  width: 18px;
  height: 18px;
  border-radius: 0.25rem;
  border: 2px solid ${p => p.$checked ? '#6366f1' : '#cbd5e1'};
  background: ${p => p.$checked ? '#6366f1' : 'white'};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;
  color: white;
`;

const PerfInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const PerfName = styled.div`
  font-size: 0.8rem;
  font-weight: 600;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const PerfMeta = styled.div`
  font-size: 0.7rem;
  color: #94a3b8;
  margin-top: 0.15rem;
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const PerfMetaTag = styled.span`
  background: #f1f5f9;
  padding: 0.1rem 0.35rem;
  border-radius: 0.2rem;
`;

const PerfValue = styled.div`
  font-size: 0.8rem;
  font-weight: 700;
  color: #1e293b;
  white-space: nowrap;
  text-align: right;
  min-width: 60px;
`;

const PerfLevels = styled.div`
  display: flex;
  gap: 0.25rem;
  align-items: center;
  flex-shrink: 0;
`;

const PerfLevelItem = styled.div`
  text-align: center;
  padding: 0.2rem 0.35rem;
  border-radius: 0.25rem;
  background: ${p => p.$bg || '#f8fafc'};
  min-width: 48px;
`;

const PerfLevelLabel = styled.div`
  font-size: 0.55rem;
  color: #94a3b8;
  line-height: 1;
  margin-bottom: 0.1rem;
`;

const PerfLevelValue = styled.div`
  font-size: 0.7rem;
  font-weight: 600;
  color: ${p => p.$color || '#374151'};
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
`;

const PerfEmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 2rem;
  color: #94a3b8;
  text-align: center;
  flex: 1;
`;

// 좌측 폼 스타일
const FormGroup = styled.div`
  margin-bottom: 1rem;
`;

const FormLabel = styled.label`
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
  color: #475569;
  margin-bottom: 0.35rem;
`;

const FormInput = styled.input`
  width: 100%;
  padding: 0.6rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  color: #1e293b;
  background: white;
  transition: border-color 0.2s;
  box-sizing: border-box;
  &:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }
  &::placeholder { color: #94a3b8; }
`;

const FormSelect = styled.select`
  width: 100%;
  padding: 0.6rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  color: #1e293b;
  background: white;
  cursor: pointer;
  transition: border-color 0.2s;
  &:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }
`;

const ChipContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  padding: 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  background: white;
  min-height: 38px;
  align-items: flex-start;
  align-content: flex-start;
`;

const Chip = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid ${p => p.$selected ? '#6366f1' : '#e2e8f0'};
  background: ${p => p.$selected ? '#eef2ff' : 'white'};
  color: ${p => p.$selected ? '#4338ca' : '#64748b'};
  font-size: 0.7rem;
  font-weight: 500;
  border-radius: 9999px;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  &:hover {
    border-color: ${p => p.$selected ? '#4f46e5' : '#a5b4fc'};
    background: ${p => p.$selected ? '#e0e7ff' : '#f5f3ff'};
  }
`;

const ChipCheck = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #6366f1;
  color: white;
  flex-shrink: 0;
`;

const SelectAllChip = styled(Chip)`
  font-weight: 600;
  border-style: dashed;
`;

const LogicToggle = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const LogicOption = styled.button`
  flex: 1;
  padding: 0.6rem;
  border: 2px solid ${p => p.$active ? '#6366f1' : '#e2e8f0'};
  background: ${p => p.$active ? '#eef2ff' : 'white'};
  color: ${p => p.$active ? '#6366f1' : '#64748b'};
  font-size: 0.875rem;
  font-weight: 600;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
  &:hover { border-color: #a5b4fc; }
`;

const ModalButton = styled.button`
  padding: 0.6rem 1.25rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: ${p => p.$primary ? 'none' : '1px solid #e2e8f0'};
  background: ${p => p.$primary ? '#6366f1' : 'white'};
  color: ${p => p.$primary ? 'white' : '#64748b'};
  &:hover { background: ${p => p.$primary ? '#4f46e5' : '#f8fafc'}; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

// ============== 컴포넌트 ==============

const KPIDashboard = ({ currentYear: propCurrentYear, onYearChange, globalPerformances = [], settingsData, projects = [], onEditPerformance, onEditProject, onLinkProjectToPerformance, onPerformanceRestored }) => {
  const [currentYear, setCurrentYear] = useState(propCurrentYear || new Date().getFullYear());
  const [showModal, setShowModal] = useState(false);
  const [kpiCards, setKpiCards] = useState([]);
  const [selectedDivision, setSelectedDivision] = useState('all');
  const [viewMode, setViewMode] = useState('card'); // 'card' | 'treemap' | 'table'
  const isTableView = viewMode === 'table';
  // 원본 성과 테이블의 통계 배지/툴바를 이 헤더에 받기 위한 슬롯 (DOM node)
  const [perfStatsSlot, setPerfStatsSlot] = useState(null);
  const [perfToolbarSlot, setPerfToolbarSlot] = useState(null);

  // 단위 환산
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.is_admin; // 기본 체크 상태 저장 권한 (백엔드 게이트와 일치)
  const [activeConversions, setActiveConversions] = useState({});
  const [conversionPanelOpen, setConversionPanelOpen] = useState(false);
  const [savingDefaultConv, setSavingDefaultConv] = useState(false);
  const [savedDefaultFlash, setSavedDefaultFlash] = useState(false);
  const didInitConversionsRef = useRef(false);

  const unitConversions = useMemo(() => (settingsData?.unitConversions) || [], [settingsData]);

  const toggleConversion = useCallback((conv) => {
    const srcKey = (conv.sourceUnit || '').toLowerCase();
    setActiveConversions(prev => {
      const next = { ...prev };
      if (next[srcKey] === conv.id) { delete next[srcKey]; } else { next[srcKey] = conv.id; }
      return next;
    });
  }, []);

  const hasActiveConversion = Object.keys(activeConversions).length > 0;

  const applyConversion = useCallback((value, unit, division) => {
    if (!hasActiveConversion) return { value, unit };
    const srcKey = (unit || '').toLowerCase();
    const convId = activeConversions[srcKey];
    if (!convId) return { value, unit };
    const conv = unitConversions.find(c => c.id === convId);
    if (!conv) return { value, unit };
    // 단위만 조회하는 경우 (value가 null)
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
  }, [activeConversions, hasActiveConversion, unitConversions, currentYear]);

  // 저장된 기본 체크 상태를 최초 1회 반영 (설정 로드 후, 사용자 조작 전)
  useEffect(() => {
    if (didInitConversionsRef.current) return;
    const def = settingsData?.defaultActiveConversions;
    if (def === undefined) return; // 서버 설정(기본값 키)이 아직 로드되지 않음 → 대기
    didInitConversionsRef.current = true;
    if (def && typeof def === 'object') {
      // 저장된 기본값 중 현재 존재하는 환산만 반영 (삭제된 환산 id 제거)
      const convs = settingsData?.unitConversions || [];
      const validIds = new Set(convs.map(c => c.id));
      const restored = {};
      Object.entries(def).forEach(([srcKey, convId]) => {
        if (validIds.has(convId)) restored[srcKey] = convId;
      });
      if (Object.keys(restored).length > 0) setActiveConversions(restored);
    }
  }, [settingsData]);

  // 현재 체크 상태를 전체 사용자 기본값으로 저장 (관리자)
  const saveDefaultConversions = useCallback(async () => {
    setSavingDefaultConv(true);
    try {
      await saveSystemSettings({ defaultActiveConversions: activeConversions });
      setSavedDefaultFlash(true);
      setTimeout(() => setSavedDefaultFlash(false), 2000);
    } catch (err) {
      alert(`기본값 저장 실패: ${err.message}`);
    } finally {
      setSavingDefaultConv(false);
    }
  }, [activeConversions]);

  // 성과항목 → 연결된 과제 매핑 (AllPerformancesView 방식)
  const perfProjectMap = useMemo(() => {
    const map = new Map();
    projects.forEach(proj => {
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
        if (!arr.some(p => p.id === projectId)) {
          arr.push({ id: projectId, 과제명: proj.과제명 || '(이름 없음)', 사업부: proj.사업부 });
        }
      });
    });
    return map;
  }, [projects]);

  const getLinkedProjects = useCallback((perf) => {
    const keys = [perf.uuid, perf.id, perf.성과항목UUID, perf.성과UUID, perf.성과항목ID, perf.성과항목];
    for (const key of keys) {
      if (key && perfProjectMap.has(key)) {
        return perfProjectMap.get(key);
      }
    }
    return [];
  }, [perfProjectMap]);

  const getLinkedProjectNames = useCallback((perf) => {
    return getLinkedProjects(perf).map(p => p.과제명);
  }, [getLinkedProjects]);

  // 모달 폼 상태
  const [formName, setFormName] = useState('');
  const [formDivision, setFormDivision] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formSubcategories, setFormSubcategories] = useState([]);
  const [formLogic, setFormLogic] = useState('합계');
  const [formTreemapEnabled, setFormTreemapEnabled] = useState(true);
  const [excludedPerfKeys, setExcludedPerfKeys] = useState(new Set());
  const [perfSearch, setPerfSearch] = useState('');
  const [editingCard, setEditingCard] = useState(null); // null = 추가모드, card object = 수정모드
  const [detailCard, setDetailCard] = useState(null); // 성과 상세 보기 모달

  // propCurrentYear 동기화
  React.useEffect(() => {
    if (propCurrentYear && propCurrentYear !== currentYear) {
      setCurrentYear(propCurrentYear);
    }
  }, [propCurrentYear]);

  // DB에서 KPI 카드 로드
  const loadCards = useCallback(async (year) => {
    try {
      const cards = await fetchKPIDashboardCards(year);
      setKpiCards(cards.map(c => ({
        id: c.id,
        name: c.name,
        division: c.division,
        category: c.category,
        subcategories: c.subcategories || [],
        logic: c.logic,
        selectedPerfKeys: c.selectedPerfKeys || [],
        treemapEnabled: c.treemapEnabled !== false,
      })));
    } catch (err) {
      console.error('KPI 카드 로드 실패:', err);
    }
  }, []);

  useEffect(() => {
    loadCards(currentYear);
  }, [currentYear, loadCards]);

  const handleYearChange = (delta) => {
    const newYear = currentYear + delta;
    setCurrentYear(newYear);
    if (onYearChange) onYearChange(newYear);
  };

  // 현재 연도 성과
  const yearPerformances = useMemo(() => {
    return globalPerformances.filter(p => Number(p.성과년도) === Number(currentYear));
  }, [globalPerformances, currentYear]);

  // 설정 데이터 (settingsData 우선, 없으면 systemSettings 폴백)
  const divisions = useMemo(() => settingsData?.divisions || systemSettings.divisions, [settingsData]);
  const perfCategories = useMemo(() => settingsData?.performanceCategories || systemSettings.performanceCategories, [settingsData]);
  const perfSubcategories = useMemo(() => settingsData?.performanceSubcategories || systemSettings.performanceSubcategories, [settingsData]);

  // 사업부 드롭다운 옵션 (설정 순서 유지)
  const divisionOptions = useMemo(() => {
    const settingsOrder = divisions.map(d => d.name);
    const fromPerf = new Set();
    yearPerformances.forEach(p => {
      const { division } = extractDivisionFromPerformance(p.성과항목);
      if (division && division !== '미분류') fromPerf.add(division);
    });
    // 설정 순서 유지 + 설정에 없는 사업부는 뒤에 추가
    const extra = [...fromPerf].filter(d => !settingsOrder.includes(d)).sort();
    return ['전체', ...settingsOrder, ...extra];
  }, [yearPerformances, divisions]);

  // 대분류 옵션
  const categoryOptions = useMemo(() => {
    return ['전체', ...perfCategories.map(c => c.name)];
  }, [perfCategories]);

  // 소분류 옵션 (대분류 기반)
  const subcategoryOptions = useMemo(() => {
    if (!formCategory || formCategory === '전체') {
      return perfSubcategories.map(s => s.name);
    }
    const cat = perfCategories.find(c => c.name === formCategory);
    if (!cat) return [];
    return perfSubcategories.filter(s => s.categoryId === cat.id).map(s => s.name);
  }, [formCategory, perfCategories, perfSubcategories]);

  const toggleSubcategory = (sub) => {
    setFormSubcategories(prev =>
      prev.includes(sub) ? prev.filter(s => s !== sub) : [...prev, sub]
    );
    setExcludedPerfKeys(new Set());
  };

  const isAllSubsSelected = subcategoryOptions.length > 0 && subcategoryOptions.every(s => formSubcategories.includes(s));

  const toggleAllSubcategories = () => {
    if (isAllSubsSelected) {
      setFormSubcategories(prev => prev.filter(s => !subcategoryOptions.includes(s)));
    } else {
      setFormSubcategories(prev => Array.from(new Set([...prev, ...subcategoryOptions])));
    }
    setExcludedPerfKeys(new Set());
  };

  // 좌측 필터 조건에 맞는 성과 목록 (모달 우측 미리보기)
  const previewPerformances = useMemo(() => {
    let filtered = yearPerformances;

    if (formDivision && formDivision !== '전체') {
      filtered = filtered.filter(p => {
        const { division } = extractDivisionFromPerformance(p.성과항목);
        return division === formDivision;
      });
    }

    if (formCategory && formCategory !== '전체') {
      filtered = filtered.filter(p => p.대분류 === formCategory);
    }

    if (formSubcategories.length > 0) {
      filtered = filtered.filter(p => formSubcategories.includes(p.소분류));
    }

    return filtered;
  }, [yearPerformances, formDivision, formCategory, formSubcategories]);

  // 검색 필터된 미리보기
  const filteredPreview = useMemo(() => {
    if (!perfSearch.trim()) return previewPerformances;
    const term = perfSearch.toLowerCase();
    return previewPerformances.filter(p => {
      const { name } = extractDivisionFromPerformance(p.성과항목);
      return name.toLowerCase().includes(term) ||
        (p.대분류 || '').toLowerCase().includes(term) ||
        (p.소분류 || '').toLowerCase().includes(term);
    });
  }, [previewPerformances, perfSearch]);

  // 선택된 개수
  const selectedCount = previewPerformances.filter(p => !excludedPerfKeys.has(getPerfKey(p))).length;

  const togglePerfSelection = useCallback((key) => {
    setExcludedPerfKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (excludedPerfKeys.size === 0) {
      // 전부 해제
      setExcludedPerfKeys(new Set(previewPerformances.map(p => getPerfKey(p))));
    } else {
      // 전부 선택
      setExcludedPerfKeys(new Set());
    }
  }, [previewPerformances, excludedPerfKeys]);

  // ========== KPI 카드 계산 ==========
  const computedCards = useMemo(() => {
    const toNum = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
    const aggregate = (vals, logic, total) => {
      if (total === 0) return null;
      const sum = vals.reduce((a, b) => a + b, 0);
      return logic === '합계' ? sum : sum / total;
    };
    const hasVal = (v) => v !== undefined && v !== null && v !== '' && !isNaN(parseFloat(v));

    // 값을 환산하는 헬퍼 (applyConversion wrapper)
    const convertVal = (value, srcUnit, division) => {
      const cv = applyConversion(value, srcUnit, division);
      return cv.value;
    };

    // 환산 후 단위를 구하는 헬퍼
    const resolveUnit = (srcUnit, division) => {
      const cv = applyConversion(null, srcUnit, division);
      return cv.unit || srcUnit || '';
    };

    // 단위별 그룹 집계 헬퍼 (환산 적용 버전)
    const computeUnitGroup = (perfs, logic, displayUnit, division) => {
      const hasMonthly = perfs.some(p => p.월별실적여부 && Array.isArray(p.월별실적) && p.월별실적.length > 0);
      const allCurrent = perfs.map(p => toNum(convertVal(p.현재수준, p.단위, division)));
      const currentValue = aggregate(allCurrent, logic, perfs.length);
      // 목표가 입력된 성과만 집계 (미기입을 0으로 보지 않음) — 목표 값·delta 모두 이 부분집합 기준
      const targetPerfs = perfs.filter(p => hasVal(p.목표수준));
      const targetValue = targetPerfs.length > 0
        ? aggregate(targetPerfs.map(p => toNum(convertVal(p.목표수준, p.단위, division))), logic, targetPerfs.length)
        : null;
      // 목표 delta 기준 현재값: 목표가 입력된 성과의 현재수준만 집계
      const targetBaselineCurrent = targetPerfs.length > 0
        ? aggregate(targetPerfs.map(p => toNum(convertVal(p.현재수준, p.단위, division))), logic, targetPerfs.length)
        : null;

      const singlePerfs = perfs.filter(p => !(p.월별실적여부 && Array.isArray(p.월별실적) && p.월별실적.length > 0));
      // 실적이 입력된 성과만 집계 (미기입을 0으로 보지 않음) — 실적 값·delta 모두 이 부분집합 기준
      const actualPerfs = singlePerfs.filter(p => hasVal(p.실적수준));
      const singleValues = actualPerfs.map(p => toNum(convertVal(p.실적수준, p.단위, division)));
      const value = actualPerfs.length > 0 ? aggregate(singleValues, logic, actualPerfs.length) : null;
      // 실적 delta 기준 현재값: 실적이 입력된 성과의 현재수준만 집계 (미입력 성과의 현재값이 delta에 섞이지 않도록)
      const valueBaselineCurrent = actualPerfs.length > 0
        ? aggregate(actualPerfs.map(p => toNum(convertVal(p.현재수준, p.단위, division))), logic, actualPerfs.length)
        : null;

      let monthlyValues = null;
      if (hasMonthly) {
        const monthlyPerfs = perfs.filter(p => p.월별실적여부 && Array.isArray(p.월별실적) && p.월별실적.length > 0);
        monthlyValues = Array.from({ length: 12 }, (_, i) => {
          const hasAnyMonthVal = monthlyPerfs.some(p => hasVal(p.월별실적[i]));
          if (!hasAnyMonthVal) return null;
          const vals = monthlyPerfs.map(p => toNum(convertVal(p.월별실적[i], p.단위, division)));
          return aggregate(vals, logic, monthlyPerfs.length);
        });
      }

      return { unit: displayUnit, currentValue, targetValue, targetBaselineCurrent, value, valueBaselineCurrent, hasMonthly, monthlyValues, count: perfs.length, isConverted: true };
    };

    return kpiCards.map(card => {
      const filtered = yearPerformances.filter(p => card.selectedPerfKeys.includes(getPerfKey(p)));

      // 환산 후 단위 기준으로 그룹핑
      const resolvedUnitMap = {};
      filtered.forEach(p => {
        const rawUnit = p.단위 || '';
        const resolved = resolveUnit(rawUnit, card.division);
        if (!resolvedUnitMap[resolved]) resolvedUnitMap[resolved] = [];
        resolvedUnitMap[resolved].push(p);
      });
      const distinctResolvedUnits = Object.keys(resolvedUnitMap).filter(u => u !== '');
      const isMultiUnit = distinctResolvedUnits.length > 1;

      // 단위별 그룹 계산 (환산 후 2개 이상 단위일 때)
      let unitGroups = null;
      if (isMultiUnit) {
        unitGroups = distinctResolvedUnits.map(u => computeUnitGroup(resolvedUnitMap[u], card.logic, u, card.division));
        // 빈 단위 항목이 있으면 별도 그룹 추가
        if (resolvedUnitMap[''] && resolvedUnitMap[''].length > 0) {
          unitGroups.push(computeUnitGroup(resolvedUnitMap[''], card.logic, '(단위없음)', card.division));
        }
      }

      // 전체 집계 (단일 단위이거나 대표값 용도 — 환산 적용)
      const group = computeUnitGroup(filtered, card.logic, '', card.division);
      const resolvedUnitCounts = {};
      filtered.forEach(p => {
        const resolved = resolveUnit(p.단위 || '', card.division);
        if (resolved) resolvedUnitCounts[resolved] = (resolvedUnitCounts[resolved] || 0) + 1;
      });
      const unit = Object.entries(resolvedUnitCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

      const div = divisions.find(d => d.name === card.division);
      const divColor = div?.color || '#64748b';
      const catObj = perfCategories.find(c => c.name === card.category);
      const borderColor = catObj?.color || '#6366f1';

      return {
        ...card,
        value: group.value, currentValue: group.currentValue, targetValue: group.targetValue,
        targetBaselineCurrent: group.targetBaselineCurrent,
        valueBaselineCurrent: group.valueBaselineCurrent,
        hasMonthly: group.hasMonthly, monthlyValues: group.monthlyValues,
        count: group.count,
        totalItems: filtered.length, unit, divColor, borderColor,
        isMultiUnit, unitGroups
      };
    });
  }, [kpiCards, yearPerformances, applyConversion]);

  // 사업부별 필터 탭 (설정 순서 유지)
  const filterDivisions = useMemo(() => {
    const divSet = new Set();
    computedCards.forEach(card => {
      if (card.division && card.division !== '전체') divSet.add(card.division);
    });
    const order = divisions.map(d => d.name);
    const ordered = order.filter(d => divSet.has(d));
    const extra = [...divSet].filter(d => !order.includes(d)).sort();
    return [...ordered, ...extra];
  }, [computedCards, divisions]);

  const getDivisionCardCount = (division) => computedCards.filter(c => c.division === division).length;

  const filteredCards = useMemo(() => {
    if (selectedDivision === 'all') return computedCards;
    return computedCards.filter(card => card.division === selectedDivision);
  }, [computedCards, selectedDivision]);

  // ========== 폼 핸들러 ==========
  const handleSubmitKPI = async () => {
    const selectedKeys = previewPerformances
      .filter(p => !excludedPerfKeys.has(getPerfKey(p)))
      .map(p => getPerfKey(p));

    const cardData = {
      name: formName.trim(),
      division: formDivision || '전체',
      category: formCategory || '전체',
      subcategories: formSubcategories.length > 0 ? [...formSubcategories] : [],
      logic: formLogic,
      selectedPerfKeys: selectedKeys,
      year: currentYear,
      treemapEnabled: formTreemapEnabled,
    };

    try {
      if (editingCard) {
        // 수정 모드
        const saved = await updateKPIDashboardCard(editingCard.id, cardData);
        setKpiCards(prev => prev.map(c => c.id === editingCard.id ? {
          id: saved.id,
          name: saved.name,
          division: saved.division,
          category: saved.category,
          subcategories: saved.subcategories || [],
          logic: saved.logic,
          selectedPerfKeys: saved.selectedPerfKeys || [],
          treemapEnabled: saved.treemapEnabled !== false,
        } : c));
      } else {
        // 추가 모드
        const saved = await createKPIDashboardCard(cardData);
        setKpiCards(prev => [...prev, {
          id: saved.id,
          name: saved.name,
          division: saved.division,
          category: saved.category,
          subcategories: saved.subcategories || [],
          logic: saved.logic,
          selectedPerfKeys: saved.selectedPerfKeys || [],
          treemapEnabled: saved.treemapEnabled !== false,
        }]);
      }
      setShowModal(false);
      resetForm();
    } catch (err) {
      console.error('KPI 카드 저장 실패:', err);
    }
  };

  const handleDeleteKPI = async (id) => {
    try {
      await deleteKPIDashboardCard(id);
      setKpiCards(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.error('KPI 카드 삭제 실패:', err);
    }
  };

  const handleMoveCard = useCallback(async (cardId, direction) => {
    const idx = kpiCards.findIndex(c => c.id === cardId);
    if (idx < 0) return;
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= kpiCards.length) return;

    const newCards = [...kpiCards];
    [newCards[idx], newCards[targetIdx]] = [newCards[targetIdx], newCards[idx]];
    setKpiCards(newCards);

    try {
      await reorderKPIDashboardCards(newCards.map(c => c.id));
    } catch (err) {
      console.error('KPI 카드 순서 변경 실패:', err);
      setKpiCards(kpiCards);
    }
  }, [kpiCards]);

  const handleMoveCardToEdge = useCallback(async (cardId, toEnd) => {
    const idx = kpiCards.findIndex(c => c.id === cardId);
    if (idx < 0) return;
    if (!toEnd && idx === 0) return;
    if (toEnd && idx === kpiCards.length - 1) return;

    const newCards = [...kpiCards];
    const [card] = newCards.splice(idx, 1);
    if (toEnd) newCards.push(card); else newCards.unshift(card);
    setKpiCards(newCards);

    try {
      await reorderKPIDashboardCards(newCards.map(c => c.id));
    } catch (err) {
      console.error('KPI 카드 순서 변경 실패:', err);
      setKpiCards(kpiCards);
    }
  }, [kpiCards]);

  const resetForm = () => {
    setFormName('');
    setFormDivision('');
    setFormCategory('');
    setFormSubcategories([]);
    setFormLogic('합계');
    setFormTreemapEnabled(true);
    setExcludedPerfKeys(new Set());
    setPerfSearch('');
    setEditingCard(null);
  };

  const openModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (card) => {
    setFormName(card.name || '');
    setFormDivision(card.division || '');
    setFormCategory(card.category || '');
    setFormSubcategories(card.subcategories || []);
    setFormLogic(card.logic || '합계');
    setFormTreemapEnabled(card.treemapEnabled !== false);
    setPerfSearch('');
    setEditingCard(card);
    // excludedPerfKeys: previewPerformances 기준으로 selectedPerfKeys에 없는 항목 제외
    // 모달이 열린 후 previewPerformances가 계산되면 useEffect에서 설정
    setExcludedPerfKeys(new Set());
    setShowModal(true);
  };

  // 수정 모달: previewPerformances가 계산되면 selectedPerfKeys 기준으로 excludedPerfKeys 설정
  useEffect(() => {
    if (!editingCard || !showModal || previewPerformances.length === 0) return;
    const selectedSet = new Set(editingCard.selectedPerfKeys || []);
    const excluded = new Set();
    previewPerformances.forEach(p => {
      const key = getPerfKey(p);
      if (!selectedSet.has(key)) excluded.add(key);
    });
    setExcludedPerfKeys(excluded);
  }, [editingCard, showModal, previewPerformances]);

  const buildSubLabel = (card) => {
    const parts = [];
    if (card.category && card.category !== '전체') parts.push(card.category);
    if (card.subcategories.length > 0) parts.push(card.subcategories.join(', '));
    if (parts.length === 0) parts.push('전체 성과');
    return parts.join(' > ');
  };

  // 상세 모달용: 선택된 카드의 연결 성과 목록
  const detailPerformances = useMemo(() => {
    if (!detailCard) return [];
    return yearPerformances.filter(p => detailCard.selectedPerfKeys.includes(getPerfKey(p)));
  }, [detailCard, yearPerformances]);

  const handleExportDetail = useCallback(() => {
    if (!detailCard || detailPerformances.length === 0) return;
    const BOM = '\uFEFF';
    const headers = ['성과항목', '연결된 과제', '현재수준', '목표수준', '목표 변화량', '실적수준', '실적 변화량', '단위'];
    const rows = [];
    detailPerformances.forEach(p => {
      const key = getPerfKey(p);
      const { division } = extractDivisionFromPerformance(p.성과항목);
      const linkedProjects = getLinkedProjectNames(p).join(', ') || '-';
      const hasMonthly = p.월별실적여부 && Array.isArray(p.월별실적) && p.월별실적.length > 0;
      if (hasMonthly) {
        rows.push([p.성과항목, linkedProjects, p.현재수준 ?? '', p.목표수준 ?? '',
                   levelDelta(p.목표수준, p.현재수준) ?? '', '(월별)', '', p.단위 || '']);
        p.월별실적.forEach((val, idx) => {
          const monthVal = parseFloat(val);
          const cv = !isNaN(monthVal) ? applyConversion(monthVal, p.단위, division) : null;
          const displayVal = cv ? cv.value : (val === '' || val === null || val === undefined ? '' : val);
          const displayUnit = cv ? (cv.unit || p.단위 || '') : (p.단위 || '');
          rows.push([`  ${idx + 1}월`, '', '', '', '', displayVal, '', displayUnit]);
        });
      } else {
        const cvActual = applyConversion(p.실적수준, p.단위, division);
        const cvCurrent = applyConversion(p.현재수준, p.단위, division);
        const cvTarget = applyConversion(p.목표수준, p.단위, division);
        rows.push([
          p.성과항목, linkedProjects,
          cvCurrent.value ?? '', cvTarget.value ?? '',
          levelDelta(cvTarget.value, cvCurrent.value) ?? '',
          cvActual.value ?? '',
          levelDelta(cvActual.value, cvCurrent.value) ?? '',
          cvActual.unit || p.단위 || ''
        ]);
      }
    });
    const csvContent = BOM + [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `KPI_${detailCard.name || 'detail'}_${currentYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [detailCard, detailPerformances, getLinkedProjectNames, applyConversion, currentYear]);

  const handleCardClick = useCallback((card) => {
    setDetailCard(card);
  }, []);

  const handleClickPerformance = useCallback((perf) => {
    if (onEditPerformance) {
      setDetailCard(null);
      onEditPerformance(perf);
    }
  }, [onEditPerformance]);

  const handleClickProject = useCallback((projInfo) => {
    if (!onEditProject) return;
    const fullProject = projects.find(p =>
      (p.id && p.id === projInfo.id) || (p.uuid && p.uuid === projInfo.uuid)
    );
    if (fullProject) {
      setDetailCard(null);
      onEditProject(fullProject);
    }
  }, [onEditProject, projects]);

  const handleExportCSV = useCallback(() => {
    if (computedCards.length === 0) return;

    const escapeCsv = (val) => {
      const s = String(val ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const fmtNum = (v) => {
      if (v === null || v === undefined) return '';
      const n = parseFloat(v);
      return isNaN(n) ? '' : parseFloat(n.toFixed(1)).toString();
    };

    const hasAnyMonthly = computedCards.some(c => c.hasMonthly);

    // 헤더: 실적 열은 항상 포함, 월별이 있으면 1~12월도 추가
    const headers = ['사업부', 'KPI명', '분류', '집계', '현재', '목표', '실적', '단위'];
    if (hasAnyMonthly) {
      for (let i = 1; i <= 12; i++) headers.push(`${i}월`);
    }

    const rows = [headers.map(escapeCsv).join(',')];

    computedCards.forEach(card => {
      const buildRow = (ug) => {
        // 값은 computedCards에서 이미 환산 적용됨
        const curVal = ug ? ug.currentValue : card.currentValue;
        const tgtVal = ug ? ug.targetValue : card.targetValue;
        const valSrc = ug ? ug.value : card.value;
        const hasM = ug ? ug.hasMonthly : card.hasMonthly;
        const monthVals = ug ? ug.monthlyValues : card.monthlyValues;
        const unitDisplay = ug ? (ug.unit || '') : (card.unit || '');

        const base = [
          escapeCsv(card.division),
          escapeCsv(card.name || ''),
          escapeCsv(buildSubLabel(card)),
          escapeCsv(card.logic),
          escapeCsv(fmtNum(curVal)),
          escapeCsv(fmtNum(tgtVal)),
          escapeCsv(hasM ? '' : fmtNum(valSrc)),
          escapeCsv(unitDisplay),
        ];

        if (hasAnyMonthly) {
          if (hasM && monthVals) {
            const monthCols = monthVals.map(mv => {
              if (mv === null) return escapeCsv('');
              return escapeCsv(fmtNum(mv));
            });
            rows.push([...base, ...monthCols].join(','));
          } else {
            rows.push([...base, ...Array(12).fill(escapeCsv(''))].join(','));
          }
        } else {
          rows.push(base.join(','));
        }
      };

      if (card.isMultiUnit && card.unitGroups) {
        card.unitGroups.forEach(ug => buildRow(ug));
      } else {
        buildRow(null);
      }
    });

    const bom = '\uFEFF';
    const blob = new Blob([bom + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `KPI_대시보드_${currentYear}년.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [computedCards, currentYear, applyConversion]);

  const getPerfDisplayValue = (p) => {
    if (p.월별실적여부 && Array.isArray(p.월별실적)) {
      const nums = p.월별실적.map(v => parseFloat(v)).filter(v => !isNaN(v));
      if (nums.length > 0) return formatNumber(nums.reduce((a, b) => a + b, 0));
    }
    return formatNumber(p.실적수준);
  };

  return (
    <Container>
      <Header>
        <HeaderLeft>
          <Title><Target size={28} />모든 성과 현황</Title>
          {/* 원본 성과 테이블의 통계 배지가 들어오는 자리 */}
          {isTableView && <div ref={setPerfStatsSlot} style={{ display: 'flex', alignItems: 'center' }} />}
        </HeaderLeft>
        <HeaderRight>
          {/* KPI 전용 도구는 원본 성과 테이블 뷰에서는 숨김 (테이블이 자체 도구 모음을 가짐) */}
          {!isTableView && unitConversions.length > 0 && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setConversionPanelOpen(prev => !prev)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '0.375rem 0.625rem', fontSize: '0.8rem', borderRadius: '0.5rem',
                  border: `1px solid ${hasActiveConversion ? '#6366f1' : '#e2e8f0'}`,
                  background: hasActiveConversion ? '#eef2ff' : 'white',
                  color: hasActiveConversion ? '#4f46e5' : '#475569',
                  cursor: 'pointer', fontWeight: hasActiveConversion ? 600 : 400, whiteSpace: 'nowrap'
                }}
              >
                단위 환산
                {hasActiveConversion && (
                  <span style={{ background: '#6366f1', color: 'white', fontSize: '0.65rem', borderRadius: '999px', padding: '0 5px', lineHeight: '16px', minWidth: '16px', textAlign: 'center' }}>
                    {Object.keys(activeConversions).length}
                  </span>
                )}
                <ChevronDown size={14} style={{ transform: conversionPanelOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
              {conversionPanelOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setConversionPanelOpen(false)} />
                  <div style={{
                    position: 'absolute', top: '100%', right: 0, marginTop: '4px',
                    background: 'white', border: '1px solid #e2e8f0', borderRadius: '0.5rem',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: '8px', zIndex: 100,
                    minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '4px'
                  }}>
                    {unitConversions.map(conv => {
                      const srcKey = (conv.sourceUnit || '').toLowerCase();
                      const isActive = activeConversions[srcKey] === conv.id;
                      return (
                        <button key={conv.id} onClick={() => toggleConversion(conv)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '6px 8px', fontSize: '0.8rem', borderRadius: '0.375rem',
                            border: `1px solid ${isActive ? '#6366f1' : '#e2e8f0'}`,
                            background: isActive ? '#eef2ff' : '#fafafa',
                            color: isActive ? '#4f46e5' : '#475569',
                            cursor: 'pointer', fontWeight: isActive ? 600 : 400,
                            whiteSpace: 'nowrap', textAlign: 'left', width: '100%'
                          }}
                          title={conv.description || ''}
                        >
                          <span style={{
                            width: '14px', height: '14px', borderRadius: '3px',
                            border: `1.5px solid ${isActive ? '#6366f1' : '#cbd5e1'}`,
                            background: isActive ? '#6366f1' : 'white',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
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
                        <button onClick={() => { setActiveConversions({}); setConversionPanelOpen(false); }}
                          style={{ padding: '5px 8px', fontSize: '0.75rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0', background: 'white', color: '#94a3b8', cursor: 'pointer', textAlign: 'center' }}>
                          모두 해제
                        </button>
                      </>
                    )}
                    {isAdmin && (
                      <>
                        <div style={{ borderTop: '1px solid #e2e8f0', margin: '2px 0' }} />
                        <button onClick={saveDefaultConversions} disabled={savingDefaultConv}
                          title="현재 체크 상태를 모든 사용자의 기본값으로 저장합니다 (관리자 전용)"
                          style={{
                            padding: '6px 8px', fontSize: '0.75rem', borderRadius: '0.375rem',
                            border: `1px solid ${savedDefaultFlash ? '#10b981' : '#6366f1'}`,
                            background: savedDefaultFlash ? '#ecfdf5' : '#eef2ff',
                            color: savedDefaultFlash ? '#059669' : '#4f46e5',
                            cursor: savingDefaultConv ? 'default' : 'pointer',
                            fontWeight: 600, textAlign: 'center', opacity: savingDefaultConv ? 0.6 : 1
                          }}>
                          {savedDefaultFlash ? '✓ 기본값으로 저장됨' : (savingDefaultConv ? '저장 중…' : '★ 현재 상태를 기본값으로 저장')}
                        </button>
                        <div style={{ fontSize: '0.66rem', color: '#94a3b8', textAlign: 'center', lineHeight: 1.3, padding: '0 2px' }}>
                          모든 사용자에게 이 체크 상태가 기본으로 적용됩니다
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          {!isTableView && (
            <>
              <AddButton onClick={openModal}><Plus size={14} />KPI 추가</AddButton>
              <AddButton onClick={handleExportCSV} style={{ background: '#10b981' }} title="KPI 데이터를 CSV로 저장">
                <Download size={14} />로컬 저장
              </AddButton>
            </>
          )}
          {/* 원본 성과 테이블의 툴바(검색/단위환산/테이블 저장/로컬 저장)가 들어오는 자리 */}
          {isTableView && <div ref={setPerfToolbarSlot} style={{ display: 'flex', alignItems: 'center', minWidth: 0 }} />}
          <ViewToggle role="tablist" aria-label="KPI 뷰 전환">
            <ViewToggleButton
              role="tab"
              aria-selected={viewMode === 'card'}
              $active={viewMode === 'card'}
              onClick={() => setViewMode('card')}
              title="카드 뷰"
            >
              <LayoutGrid size={14} />카드 뷰
            </ViewToggleButton>
            <ViewToggleButton
              role="tab"
              aria-selected={viewMode === 'treemap'}
              $active={viewMode === 'treemap'}
              onClick={() => setViewMode('treemap')}
              title="트리맵 뷰"
            >
              <Grid size={14} />트리맵 뷰
            </ViewToggleButton>
            <ViewToggleButton
              role="tab"
              aria-selected={isTableView}
              $active={isTableView}
              onClick={() => setViewMode('table')}
              title="원본 성과 테이블"
            >
              <Table size={14} />원본 성과 테이블
            </ViewToggleButton>
          </ViewToggle>
          <YearSelector>
            <YearButton onClick={() => handleYearChange(-1)}>‹</YearButton>
            <YearDisplay>{currentYear}년</YearDisplay>
            <YearButton onClick={() => handleYearChange(1)}>›</YearButton>
          </YearSelector>
        </HeaderRight>
      </Header>

      {isTableView ? (
        /* 원본 성과 테이블 - 자체 사업부 필터/검색/내보내기를 그대로 사용 */
        <AllPerformancesView
          embedded
          statsSlot={perfStatsSlot}
          toolbarSlot={perfToolbarSlot}
          projects={projects}
          globalPerformances={globalPerformances}
          currentYear={currentYear}
          onYearChange={onYearChange}
          isAdmin={isAdmin}
          onEditPerformance={onEditPerformance}
          onLinkProjectToPerformance={onLinkProjectToPerformance}
          onEditProject={onEditProject}
          settingsData={settingsData}
          onPerformanceRestored={onPerformanceRestored}
        />
      ) : (
      <>
      <FilterBar>
        <FilterButton $active={selectedDivision === 'all'} onClick={() => setSelectedDivision('all')}>
          전체<FilterBadge $active={selectedDivision === 'all'}>{computedCards.length}</FilterBadge>
        </FilterButton>
        {filterDivisions.map(division => (
          <FilterButton key={division} $active={selectedDivision === division} onClick={() => setSelectedDivision(division)}>
            {division}<FilterBadge $active={selectedDivision === division}>{getDivisionCardCount(division)}</FilterBadge>
          </FilterButton>
        ))}
      </FilterBar>

      <Content>
        {viewMode === 'treemap' ? (
          filteredCards.length === 0 ? (
            <EmptyState>
              <Target size={48} color="#cbd5e1" />
              <p style={{ marginTop: '1rem', fontSize: '1rem', fontWeight: 600 }}>등록된 KPI가 없습니다</p>
              <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>"KPI 추가" 버튼을 눌러 KPI 카드를 생성하세요</p>
            </EmptyState>
          ) : (
            <KPITreemap
              kpiCards={kpiCards}
              yearPerformances={yearPerformances}
              divisions={divisions}
              applyConversion={applyConversion}
              selectedDivision={selectedDivision}
              currentYear={currentYear}
              projects={projects}
            />
          )
        ) : filteredCards.length === 0 ? (
          <EmptyState>
            <Target size={48} color="#cbd5e1" />
            <p style={{ marginTop: '1rem', fontSize: '1rem', fontWeight: 600 }}>등록된 KPI가 없습니다</p>
            <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>"KPI 추가" 버튼을 눌러 KPI 카드를 생성하세요</p>
          </EmptyState>
        ) : (
          <CardGrid>
            <AnimatePresence>
              {filteredCards.map(card => (
                <KPICard key={card.id} $borderColor={card.borderColor}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }}
                  onClick={() => handleCardClick(card)}>
                  <CardHeader>
                    <div>
                      {card.division !== '전체'
                        ? <CardDivision $color={card.divColor}>{card.division}</CardDivision>
                        : <CardDivision $color="#64748b">전체 사업부</CardDivision>
                      }
                      {card.name && <CardName>{card.name} <CardLogic>{card.logic}</CardLogic></CardName>}
                      {!card.name && <CardLogic style={{ marginTop: '0.25rem' }}>{card.logic}</CardLogic>}
                      <CardTitle>{buildSubLabel(card)}</CardTitle>
                    </div>
                    <CardActions className="card-actions" onClick={(e) => e.stopPropagation()}>
                      <MoveButton
                        onClick={() => handleMoveCardToEdge(card.id, false)}
                        disabled={kpiCards.findIndex(c => c.id === card.id) === 0}
                        title="가장 앞으로 이동"
                      ><ChevronsLeft size={13} /></MoveButton>
                      <MoveButton
                        onClick={() => handleMoveCard(card.id, -1)}
                        disabled={kpiCards.findIndex(c => c.id === card.id) === 0}
                        title="앞으로 이동"
                      ><ArrowLeft size={13} /></MoveButton>
                      <MoveButton
                        onClick={() => handleMoveCard(card.id, 1)}
                        disabled={kpiCards.findIndex(c => c.id === card.id) === kpiCards.length - 1}
                        title="뒤로 이동"
                      ><ArrowRight size={13} /></MoveButton>
                      <MoveButton
                        onClick={() => handleMoveCardToEdge(card.id, true)}
                        disabled={kpiCards.findIndex(c => c.id === card.id) === kpiCards.length - 1}
                        title="가장 뒤로 이동"
                      ><ChevronsRight size={13} /></MoveButton>
                      <DeleteButton onClick={() => openEditModal(card)} title="수정"><Pencil size={14} /></DeleteButton>
                      <DeleteButton onClick={() => handleDeleteKPI(card.id)} title="삭제"><Trash2 size={14} /></DeleteButton>
                    </CardActions>
                  </CardHeader>
                  {/* 현재 / 목표 / 실적 — 단위별 그룹 또는 단일 */}
                  {card.isMultiUnit && card.unitGroups ? (
                    /* 단위가 여러개인 경우: 단위별로 분리 표시 (값은 이미 환산 적용됨) */
                    card.unitGroups.map((ug, ugIdx) => {
                      const u = ug.unit || '';
                      const curNum = ug.currentValue !== null ? parseFloat(ug.currentValue) : NaN;
                      const tgtNum = ug.targetValue !== null ? parseFloat(ug.targetValue) : NaN;
                      const valNum = ug.value !== null ? parseFloat(ug.value) : NaN;
                      // 목표·실적 delta는 각 값이 입력된 성과의 현재값 합을 기준으로 계산
                      const tgtBaseNum = (ug.targetBaselineCurrent !== null && ug.targetBaselineCurrent !== undefined) ? parseFloat(ug.targetBaselineCurrent) : NaN;
                      const valBaseNum = (ug.valueBaselineCurrent !== null && ug.valueBaselineCurrent !== undefined) ? parseFloat(ug.valueBaselineCurrent) : NaN;
                      const tgtDelta = (!isNaN(tgtBaseNum) && !isNaN(tgtNum)) ? tgtNum - tgtBaseNum : null;
                      const valDelta = (!isNaN(valBaseNum) && !isNaN(valNum)) ? valNum - valBaseNum : null;
                      // delta 기준 현재값이 카드 전체 현재값과 다르면(부분 입력) 기준값을 병기
                      const showTgtBase = !isNaN(tgtBaseNum) && !isNaN(curNum) && Math.abs(tgtBaseNum - curNum) > 1e-6;
                      const showValBase = !isNaN(valBaseNum) && !isNaN(curNum) && Math.abs(valBaseNum - curNum) > 1e-6;
                      const fmtDelta = (d) => `${d > 0 ? '+' : ''}${formatNumber(d)}`;
                      return (
                        <div key={ugIdx}>
                          <div style={{ fontSize: '0.65rem', color: '#6366f1', fontWeight: 600, marginTop: ugIdx > 0 ? '0.5rem' : '0.25rem', marginBottom: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span style={{ background: '#eef2ff', padding: '0.1rem 0.4rem', borderRadius: '0.25rem' }}>{u || '단위없음'}</span>
                            <span style={{ color: '#94a3b8', fontWeight: 400 }}>({ug.count}건)</span>
                          </div>
                          <CardLevels>
                            <CardLevelItem>
                              <CardLevelLabel>현재</CardLevelLabel>
                              <CardLevelValue>{`${formatNumber(ug.currentValue)}${u ? ` ${u}` : ''}`}</CardLevelValue>
                            </CardLevelItem>
                            <CardLevelItem>
                              <CardLevelLabel>목표</CardLevelLabel>
                              <CardLevelValue $color={ug.targetValue !== null ? '#2563eb' : '#94a3b8'}>{ug.targetValue !== null ? `${formatNumber(ug.targetValue)}${u ? ` ${u}` : ''}` : '-'}</CardLevelValue>
                              {tgtDelta !== null && tgtDelta !== 0 && <CardLevelDelta $positive={tgtDelta > 0} $negative={tgtDelta < 0}>{fmtDelta(tgtDelta)}</CardLevelDelta>}
                              {showTgtBase && <CardLevelBase title="기준 현재값은 목표가 입력된 성과만 합산한 현재값입니다. 목표 미입력 성과는 집계에서 제외됩니다.">{`기준 ${formatNumber(ug.targetBaselineCurrent)}${u ? ` ${u}` : ''}`}</CardLevelBase>}
                            </CardLevelItem>
                            {!ug.hasMonthly && (
                              <CardLevelItem>
                                <CardLevelLabel>실적</CardLevelLabel>
                                <CardLevelValue $color={ug.value !== null ? '#059669' : '#94a3b8'}>{ug.value !== null ? `${formatNumber(ug.value)}${u ? ` ${u}` : ''}` : '-'}</CardLevelValue>
                                {valDelta !== null && valDelta !== 0 && <CardLevelDelta $positive={valDelta > 0} $negative={valDelta < 0}>{fmtDelta(valDelta)}</CardLevelDelta>}
                                {showValBase && <CardLevelBase title="기준 현재값은 실적이 입력된 성과만 합산한 현재값입니다. 실적 미입력 성과는 집계에서 제외됩니다.">{`기준 ${formatNumber(ug.valueBaselineCurrent)}${u ? ` ${u}` : ''}`}</CardLevelBase>}
                              </CardLevelItem>
                            )}
                          </CardLevels>
                          {ug.hasMonthly && ug.monthlyValues && (
                            <>
                              <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600, marginTop: '0.35rem', marginBottom: '0.15rem' }}>월별 실적</div>
                              <MonthlyGrid>
                                {ug.monthlyValues.map((mv, i) => {
                                  const v = mv !== null ? parseFloat(mv) : null;
                                  const display = v !== null && !isNaN(v) ? (v % 1 === 0 ? v.toLocaleString() : v.toLocaleString(undefined, { maximumFractionDigits: 1 })) : '-';
                                  return (
                                    <MonthCell key={i} $hasValue={v !== null && !isNaN(v)}>
                                      <MonthCellLabel>{i + 1}월</MonthCellLabel>
                                      <MonthCellValue $hasValue={v !== null && !isNaN(v)}>{display}</MonthCellValue>
                                    </MonthCell>
                                  );
                                })}
                              </MonthlyGrid>
                            </>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    /* 단일 단위인 경우 (값은 이미 환산 적용됨) */
                    (() => {
                      const u = card.unit || '';
                      const curNum = card.currentValue !== null ? parseFloat(card.currentValue) : NaN;
                      const tgtNum = card.targetValue !== null ? parseFloat(card.targetValue) : NaN;
                      const valNum = card.value !== null ? parseFloat(card.value) : NaN;
                      // 목표·실적 delta는 각 값이 입력된 성과의 현재값 합을 기준으로 계산
                      const tgtBaseNum = (card.targetBaselineCurrent !== null && card.targetBaselineCurrent !== undefined) ? parseFloat(card.targetBaselineCurrent) : NaN;
                      const valBaseNum = (card.valueBaselineCurrent !== null && card.valueBaselineCurrent !== undefined) ? parseFloat(card.valueBaselineCurrent) : NaN;
                      const tgtDelta = (!isNaN(tgtBaseNum) && !isNaN(tgtNum)) ? tgtNum - tgtBaseNum : null;
                      const valDelta = (!isNaN(valBaseNum) && !isNaN(valNum)) ? valNum - valBaseNum : null;
                      // delta 기준 현재값이 카드 전체 현재값과 다르면(부분 입력) 기준값을 병기
                      const showTgtBase = !isNaN(tgtBaseNum) && !isNaN(curNum) && Math.abs(tgtBaseNum - curNum) > 1e-6;
                      const showValBase = !isNaN(valBaseNum) && !isNaN(curNum) && Math.abs(valBaseNum - curNum) > 1e-6;
                      const fmtDelta = (d) => `${d > 0 ? '+' : ''}${formatNumber(d)}`;
                      return (
                        <>
                          <CardLevels>
                            <CardLevelItem>
                              <CardLevelLabel>현재</CardLevelLabel>
                              <CardLevelValue>{`${formatNumber(card.currentValue)}${u ? ` ${u}` : ''}`}</CardLevelValue>
                            </CardLevelItem>
                            <CardLevelItem>
                              <CardLevelLabel>목표</CardLevelLabel>
                              <CardLevelValue $color={card.targetValue !== null ? '#2563eb' : '#94a3b8'}>{card.targetValue !== null ? `${formatNumber(card.targetValue)}${u ? ` ${u}` : ''}` : '-'}</CardLevelValue>
                              {tgtDelta !== null && tgtDelta !== 0 && <CardLevelDelta $positive={tgtDelta > 0} $negative={tgtDelta < 0}>{fmtDelta(tgtDelta)}</CardLevelDelta>}
                              {showTgtBase && <CardLevelBase title="기준 현재값은 목표가 입력된 성과만 합산한 현재값입니다. 목표 미입력 성과는 집계에서 제외됩니다.">{`기준 ${formatNumber(card.targetBaselineCurrent)}${u ? ` ${u}` : ''}`}</CardLevelBase>}
                            </CardLevelItem>
                            {!card.hasMonthly && (
                              <CardLevelItem>
                                <CardLevelLabel>실적</CardLevelLabel>
                                <CardLevelValue $color={card.value !== null ? '#059669' : '#94a3b8'}>{card.value !== null ? `${formatNumber(card.value)}${u ? ` ${u}` : ''}` : '-'}</CardLevelValue>
                                {valDelta !== null && valDelta !== 0 && <CardLevelDelta $positive={valDelta > 0} $negative={valDelta < 0}>{fmtDelta(valDelta)}</CardLevelDelta>}
                                {showValBase && <CardLevelBase title="기준 현재값은 실적이 입력된 성과만 합산한 현재값입니다. 실적 미입력 성과는 집계에서 제외됩니다.">{`기준 ${formatNumber(card.valueBaselineCurrent)}${u ? ` ${u}` : ''}`}</CardLevelBase>}
                              </CardLevelItem>
                            )}
                          </CardLevels>
                          {/* 월별 실적 그리드 */}
                          {card.hasMonthly && card.monthlyValues && (
                            <>
                              <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginTop: '0.5rem', marginBottom: '0.2rem' }}>월별 실적</div>
                              <MonthlyGrid>
                                {card.monthlyValues.map((mv, i) => {
                                  const v = mv !== null ? parseFloat(mv) : null;
                                  const display = v !== null && !isNaN(v) ? (v % 1 === 0 ? v.toLocaleString() : v.toLocaleString(undefined, { maximumFractionDigits: 1 })) : '-';
                                  return (
                                    <MonthCell key={i} $hasValue={v !== null && !isNaN(v)}>
                                      <MonthCellLabel>{i + 1}월</MonthCellLabel>
                                      <MonthCellValue $hasValue={v !== null && !isNaN(v)}>{display}</MonthCellValue>
                                    </MonthCell>
                                  );
                                })}
                              </MonthlyGrid>
                            </>
                          )}
                        </>
                      );
                    })()
                  )}
                  <CardCount>성과항목 {card.totalItems}건{card.isMultiUnit ? ` (${card.unitGroups.length}개 단위)` : ''}</CardCount>
                </KPICard>
              ))}
            </AnimatePresence>
          </CardGrid>
        )}
      </Content>
      </>
      )}

      {/* ========== KPI 추가 모달 ========== */}
      <AnimatePresence>
        {showModal && (
          <ModalOverlay
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowModal(false)}
          >
            <ModalContent
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <ModalHeader>
                <ModalTitle><Plus size={20} color="#6366f1" />{editingCard ? 'KPI 수정' : 'KPI 추가'}</ModalTitle>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    선택된 성과: <strong style={{ color: '#6366f1' }}>{selectedCount}</strong> / {previewPerformances.length}건
                  </span>
                </div>
              </ModalHeader>

              <ModalBody>
                {/* 좌측: 필터 폼 */}
                <LeftPanel>
                  <FormGroup>
                    <FormLabel>KPI 명칭</FormLabel>
                    <FormInput
                      type="text"
                      placeholder="명칭 입력"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                    />
                  </FormGroup>

                  <FormGroup>
                    <FormLabel>사업부</FormLabel>
                    <FormSelect value={formDivision} onChange={(e) => { setFormDivision(e.target.value); setExcludedPerfKeys(new Set()); }}>
                      {divisionOptions.map(d => <option key={d} value={d}>{d}</option>)}
                    </FormSelect>
                  </FormGroup>

                  <FormGroup>
                    <FormLabel>성과 대분류</FormLabel>
                    <FormSelect
                      value={formCategory}
                      onChange={(e) => {
                        setFormCategory(e.target.value);
                        setFormSubcategories([]);
                        setExcludedPerfKeys(new Set());
                      }}
                    >
                      {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                    </FormSelect>
                  </FormGroup>

                  <FormGroup>
                    <FormLabel>
                      성과 소분류
                      {formSubcategories.length > 0 && (
                        <span style={{ color: '#6366f1', fontWeight: 700, marginLeft: '0.35rem' }}>
                          ({formSubcategories.length}개 선택)
                        </span>
                      )}
                    </FormLabel>
                    <ChipContainer>
                      {subcategoryOptions.length > 0 && (
                        <SelectAllChip $selected={isAllSubsSelected} onClick={toggleAllSubcategories}>
                          {isAllSubsSelected && <ChipCheck><Check size={8} strokeWidth={3} /></ChipCheck>}
                          전체
                        </SelectAllChip>
                      )}
                      {subcategoryOptions.map(sub => {
                        const selected = formSubcategories.includes(sub);
                        return (
                          <Chip key={sub} $selected={selected} onClick={() => toggleSubcategory(sub)}>
                            {selected && <ChipCheck><Check size={8} strokeWidth={3} /></ChipCheck>}
                            {sub}
                          </Chip>
                        );
                      })}
                      {subcategoryOptions.length === 0 && (
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', padding: '0.15rem' }}>해당 대분류의 소분류가 없습니다</span>
                      )}
                    </ChipContainer>
                  </FormGroup>

                  <FormGroup>
                    <FormLabel>계산 로직</FormLabel>
                    <LogicToggle>
                      <LogicOption $active={formLogic === '합계'} onClick={() => setFormLogic('합계')}>합계</LogicOption>
                      <LogicOption $active={formLogic === '평균'} onClick={() => setFormLogic('평균')}>평균</LogicOption>
                    </LogicToggle>
                  </FormGroup>

                  <FormGroup>
                    <FormLabel>트리맵 활성화 여부</FormLabel>
                    <LogicToggle>
                      <LogicOption $active={formTreemapEnabled} onClick={() => setFormTreemapEnabled(true)}>활성화</LogicOption>
                      <LogicOption $active={!formTreemapEnabled} onClick={() => setFormTreemapEnabled(false)}>비활성화</LogicOption>
                    </LogicToggle>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.4rem', lineHeight: 1.4 }}>
                      비활성화로 설정하면 트리맵 화면에서 기본적으로 체크 해제된 상태로 시작합니다 (필터에서 수동 선택은 가능).
                    </div>
                  </FormGroup>
                </LeftPanel>

                {/* 우측: 성과 미리보기 리스트 */}
                <RightPanel>
                  <RightPanelHeader>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <RightPanelTitle>성과 항목 목록</RightPanelTitle>
                      <RightPanelCount>{filteredPreview.length}건</RightPanelCount>
                    </div>
                    <SearchBox>
                      <Search size={14} color="#94a3b8" />
                      <SearchInput
                        placeholder="성과 검색..."
                        value={perfSearch}
                        onChange={(e) => setPerfSearch(e.target.value)}
                      />
                    </SearchBox>
                  </RightPanelHeader>

                  <SelectAllRow>
                    <SelectAllButton $allSelected={excludedPerfKeys.size === 0} onClick={toggleSelectAll}>
                      {excludedPerfKeys.size === 0
                        ? <><CheckSquare size={13} /> 전체 선택됨</>
                        : <><Square size={13} /> 전체 선택</>
                      }
                    </SelectAllButton>
                  </SelectAllRow>

                  {filteredPreview.length === 0 ? (
                    <PerfEmptyState>
                      <Target size={36} color="#cbd5e1" />
                      <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', fontWeight: 600 }}>조건에 맞는 성과가 없습니다</p>
                      <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>좌측 필터 조건을 변경해 보세요</p>
                    </PerfEmptyState>
                  ) : (
                    <PerfList>
                      {filteredPreview.map(p => {
                        const key = getPerfKey(p);
                        const checked = !excludedPerfKeys.has(key);
                        const { division, name } = extractDivisionFromPerformance(p.성과항목);
                        return (
                          <PerfRow key={key} $selected={checked} onClick={() => togglePerfSelection(key)}>
                            <PerfCheckbox $checked={checked}>
                              {checked && <Check size={11} strokeWidth={3} />}
                            </PerfCheckbox>
                            <PerfInfo>
                              <PerfName>{name || p.성과항목}</PerfName>
                              <PerfMeta>
                                <PerfMetaTag>{division}</PerfMetaTag>
                                <PerfMetaTag>{p.대분류 || '-'}</PerfMetaTag>
                                <PerfMetaTag>{p.소분류 || '-'}</PerfMetaTag>
                                {p.단위 && <PerfMetaTag>{p.단위}</PerfMetaTag>}
                              </PerfMeta>
                            </PerfInfo>
                            <PerfLevels>
                              <PerfLevelItem $bg="#f0f9ff">
                                <PerfLevelLabel>현재</PerfLevelLabel>
                                <PerfLevelValue>{formatNumber(p.현재수준)}</PerfLevelValue>
                              </PerfLevelItem>
                              <PerfLevelItem $bg="#eff6ff">
                                <PerfLevelLabel>목표</PerfLevelLabel>
                                <PerfLevelValue $color="#2563eb">{formatNumber(p.목표수준)}</PerfLevelValue>
                              </PerfLevelItem>
                              <PerfLevelItem $bg="#f0fdf4">
                                <PerfLevelLabel>실적</PerfLevelLabel>
                                <PerfLevelValue $color="#059669">{getPerfDisplayValue(p)}</PerfLevelValue>
                              </PerfLevelItem>
                              {p.단위 && <span style={{ fontSize: '0.6rem', color: '#94a3b8', marginLeft: '0.15rem' }}>{p.단위}</span>}
                            </PerfLevels>
                          </PerfRow>
                        );
                      })}
                    </PerfList>
                  )}
                </RightPanel>
              </ModalBody>

              <ModalFooter>
                <ModalButton onClick={() => setShowModal(false)}>취소</ModalButton>
                <ModalButton $primary onClick={handleSubmitKPI} disabled={!formName.trim() || selectedCount === 0}>{editingCard ? '저장' : '추가'}</ModalButton>
              </ModalFooter>
            </ModalContent>
          </ModalOverlay>
        )}
      </AnimatePresence>

      {/* ========== 성과 상세 모달 ========== */}
      <AnimatePresence>
        {detailCard && (
          <DetailOverlay
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setDetailCard(null)}
          >
            <DetailModal
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <DetailHeader>
                <DetailTitle>
                  <BarChart3 size={18} color="#6366f1" />
                  {detailCard.name || buildSubLabel(detailCard)}
                </DetailTitle>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <DetailCloseBtn onClick={handleExportDetail} title="CSV 저장">
                    <Download size={16} />
                  </DetailCloseBtn>
                  <DetailCloseBtn onClick={() => setDetailCard(null)}>
                    <X size={18} />
                  </DetailCloseBtn>
                </div>
              </DetailHeader>

              <DetailSummary>
                <SummaryItem>사업부: <span>{detailCard.division}</span></SummaryItem>
                <SummaryItem>분류: <span>{buildSubLabel(detailCard)}</span></SummaryItem>
                <SummaryItem>집계: <span>{detailCard.logic}</span></SummaryItem>
                {detailCard.value !== null && (
                  <SummaryItem>
                    실적: <span>
                      {(() => {
                        const v = parseFloat(detailCard.value);
                        const display = isNaN(v) ? '-' : parseFloat(v.toFixed(1)).toLocaleString();
                        return `${display}${detailCard.unit ? ` ${detailCard.unit}` : ''}`;
                      })()}
                    </span>
                  </SummaryItem>
                )}
                <SummaryItem>성과 항목: <span>{detailCard.totalItems}건</span></SummaryItem>
              </DetailSummary>

              <DetailTable>
                <DetailTableHeader>
                  <div>성과항목</div>
                  <div>연결된 과제</div>
                  <DetailCell as="div" $header>현재수준</DetailCell>
                  <DetailCell as="div" $header>목표수준</DetailCell>
                  <DetailCell as="div" $header title="목표 − 현재 : 목표까지 만들어야 할 변화량">목표 변화량</DetailCell>
                  <DetailCell as="div" $header>실적수준</DetailCell>
                  <DetailCell as="div" $header title="실적 − 현재 : 지금까지 실제로 만든 변화량">실적 변화량</DetailCell>
                  <DetailCell as="div" $header>단위</DetailCell>
                </DetailTableHeader>
                {detailPerformances.length > 0 ? (
                  detailPerformances.map(p => {
                    const key = getPerfKey(p);
                    const { division, name } = extractDivisionFromPerformance(p.성과항목);
                    const hasMonthly = p.월별실적여부 && Array.isArray(p.월별실적) && p.월별실적.length > 0;

                    if (hasMonthly) {
                      // 월별 성과: 헤더 행 + 12개 월별 행
                      const cvCurMonthly = applyConversion(p.현재수준, p.단위, division);
                      const cvTgtMonthly = applyConversion(p.목표수준, p.단위, division);
                      const cvUnitMonthly = applyConversion(null, p.단위, division);
                      const monthlyUnitDisplay = cvUnitMonthly.unit || p.단위 || '-';
                      return (
                        <React.Fragment key={key}>
                          <DetailTableRow style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <div style={{ minWidth: 0 }}>
                              <DetailPerfName $clickable={!!onEditPerformance} title={p.성과항목} onClick={() => handleClickPerformance(p)}>{name || p.성과항목}</DetailPerfName>
                              <DetailPerfMeta>
                                {division !== '미분류' && division}{p.대분류 ? ` · ${p.대분류}` : ''}{p.소분류 ? ` · ${p.소분류}` : ''}
                                <span style={{ color: '#6366f1', marginLeft: '0.35rem' }}>(월별)</span>
                              </DetailPerfMeta>
                            </div>
                            <DetailProjectCell>
                              {(() => {
                                const linked = getLinkedProjects(p);
                                return linked.length > 0 ? linked.map((proj, i) => (
                                  <React.Fragment key={proj.id || i}>
                                    {i > 0 && ', '}
                                    <DetailProjectLink onClick={() => handleClickProject(proj)}>{proj.과제명}</DetailProjectLink>
                                  </React.Fragment>
                                )) : '-';
                              })()}
                            </DetailProjectCell>
                            <DetailCell>{formatNumber(cvCurMonthly.value)}</DetailCell>
                            <DetailCell>{formatNumber(cvTgtMonthly.value)}</DetailCell>
                            <DetailCell>{deltaText(cvTgtMonthly.value, cvCurMonthly.value)}</DetailCell>
                            <DetailCell style={{ color: '#94a3b8', fontSize: '0.75rem' }} title="아래 월별 행 참조">월별 ↓</DetailCell>
                            {/* 월별은 실적이 12칸으로 흩어져 있어 '실적 변화량' 을 한 값으로 못 쓴다 */}
                            <DetailCell />
                            <DetailCell>{monthlyUnitDisplay}</DetailCell>
                          </DetailTableRow>
                          {p.월별실적.map((val, idx) => {
                            const monthVal = parseFloat(val);
                            const monthCv = !isNaN(monthVal) ? applyConversion(monthVal, p.단위, division) : null;
                            const displayVal = monthCv ? formatNumber(monthCv.value) : (val === '' || val === null || val === undefined ? '-' : val);
                            const displayUnit = monthCv ? (monthCv.unit || p.단위 || '-') : (p.단위 || '-');
                            return (
                              <MonthSubRow key={`${key}-m${idx}`}>
                                <MonthLabel>{idx + 1}월</MonthLabel>
                                <div />
                                <DetailCell />
                                <DetailCell />
                                <DetailCell />
                                <DetailCell $highlight={!isNaN(monthVal)}>{displayVal}</DetailCell>
                                <DetailCell />
                                <DetailCell>{displayUnit}</DetailCell>
                              </MonthSubRow>
                            );
                          })}
                        </React.Fragment>
                      );
                    }

                    // 단일 실적: 현재/목표/실적 모두 표시
                    const cvActual = applyConversion(p.실적수준, p.단위, division);
                    const cvCurrent = applyConversion(p.현재수준, p.단위, division);
                    const cvTarget = applyConversion(p.목표수준, p.단위, division);
                    return (
                      <DetailTableRow key={key}>
                        <div style={{ minWidth: 0 }}>
                          <DetailPerfName $clickable={!!onEditPerformance} title={p.성과항목} onClick={() => handleClickPerformance(p)}>{name || p.성과항목}</DetailPerfName>
                          <DetailPerfMeta>
                            {division !== '미분류' && division}{p.대분류 ? ` · ${p.대분류}` : ''}{p.소분류 ? ` · ${p.소분류}` : ''}
                          </DetailPerfMeta>
                        </div>
                        <DetailProjectCell>
                          {(() => {
                            const linked = getLinkedProjects(p);
                            return linked.length > 0 ? linked.map((proj, i) => (
                              <React.Fragment key={proj.id || i}>
                                {i > 0 && ', '}
                                <DetailProjectLink onClick={() => handleClickProject(proj)}>{proj.과제명}</DetailProjectLink>
                              </React.Fragment>
                            )) : '-';
                          })()}
                        </DetailProjectCell>
                        <DetailCell>{formatNumber(cvCurrent.value)}</DetailCell>
                        <DetailCell>{formatNumber(cvTarget.value)}</DetailCell>
                        {/* 환산 후 값으로 뺀다 — 원단위끼리 빼면 환산된 표시값과 어긋난다 */}
                        <DetailCell>{deltaText(cvTarget.value, cvCurrent.value)}</DetailCell>
                        <DetailCell $highlight>{formatNumber(cvActual.value)}</DetailCell>
                        <DetailCell>{deltaText(cvActual.value, cvCurrent.value)}</DetailCell>
                        <DetailCell>{cvActual.unit || p.단위 || '-'}</DetailCell>
                      </DetailTableRow>
                    );
                  })
                ) : (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.85rem' }}>
                    연결된 성과 항목이 없습니다
                  </div>
                )}
              </DetailTable>
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                padding: '0.75rem 1.25rem',
                borderTop: '1px solid #e2e8f0',
                background: '#f8fafc',
                borderRadius: '0 0 1rem 1rem',
                gap: '0.5rem',
                flexShrink: 0
              }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b', marginRight: 'auto' }}>
                  {detailPerformances.length}개 성과항목
                </span>
                <button
                  onClick={handleExportDetail}
                  disabled={detailPerformances.length === 0}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    padding: '0.5rem 1rem',
                    background: detailPerformances.length === 0 ? '#e2e8f0' : '#6366f1',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.375rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: detailPerformances.length === 0 ? 'not-allowed' : 'pointer',
                    transition: 'background 0.2s ease'
                  }}
                  onMouseOver={(e) => { if (detailPerformances.length > 0) e.currentTarget.style.background = '#4f46e5'; }}
                  onMouseOut={(e) => { if (detailPerformances.length > 0) e.currentTarget.style.background = '#6366f1'; }}
                >
                  <Download size={14} />
                  로컬 저장
                </button>
              </div>
            </DetailModal>
          </DetailOverlay>
        )}
      </AnimatePresence>
    </Container>
  );
};

export default KPIDashboard;
