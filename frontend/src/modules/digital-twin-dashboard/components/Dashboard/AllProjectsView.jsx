import React, { useMemo, useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Target, X, Search, Calendar, User, Building2, CheckCircle2, Clock, Users, Briefcase, Download, Trash2, RotateCcw, AlertTriangle, LayoutGrid, List, Settings, GripVertical, ChevronUp, ChevronDown, ArrowRight, Table2, Link2 } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { todayLocalYmd } from '../../../../shared/utils/localDate';
// 수준값의 0 과 미입력은 다른 뜻이다. `|| ''` 로 다루면 0 이 사라진다.
import { levelText } from '../../utils/levelValue';
import { compareProjects } from '../../utils/divisionOrder';
// 상세 과제 정보·마일스톤 — '결과 보고서' 와 **같은 컴포넌트**를 쓴다.
// 같은 내용을 두 양식으로 보여주면 사람이 다른 것으로 읽는다(2026-08-08 통합).
import ProjectDetailModal from './ProjectDetailModal';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: calc(100vh - 70px);
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
`;

const ProjectCount = styled.span`
  font-size: 1rem;
  font-weight: 500;
  color: #64748b;
  margin-left: 0.5rem;
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
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
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
`;

const SearchInput = styled.input`
  border: none;
  background: transparent;
  outline: none;
  font-size: 0.875rem;
  color: #1e293b;
  width: 200px;

  &::placeholder {
    color: #94a3b8;
  }
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

  &::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }
`;

const ProjectGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const ProjectCard = styled(motion.div)`
  background: white;
  border: ${props =>
    props.$updateRecency === 'week' ? '2px solid #3b82f6' :
    props.$updateRecency === 'month' ? '2px solid #10b981' :
    '1px solid #e2e8f0'};
  border-radius: 0.75rem;
  padding: 1.25rem;
  transition: all 0.2s ease;
  cursor: pointer;
  ${props => props.$updateRecency === 'week' && `
    box-shadow: 0 0 12px rgba(59, 130, 246, 0.3);
    background: rgba(59, 130, 246, 0.02);
  `}
  ${props => props.$updateRecency === 'month' && `
    box-shadow: 0 0 12px rgba(16, 185, 129, 0.3);
    background: rgba(16, 185, 129, 0.02);
  `}

  &:hover {
    border-color: ${props =>
      props.$updateRecency === 'week' ? '#2563eb' :
      props.$updateRecency === 'month' ? '#059669' :
      '#cbd5e1'};
    box-shadow: ${props =>
      props.$updateRecency === 'week' ? '0 4px 16px rgba(59, 130, 246, 0.4)' :
      props.$updateRecency === 'month' ? '0 4px 16px rgba(16, 185, 129, 0.4)' :
      '0 4px 12px rgba(0, 0, 0, 0.08)'};
    transform: translateY(-2px);
  }
`;

const ProjectTitle = styled.div`
  font-size: 1rem;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 0.75rem;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const ProjectMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
`;

const MetaBadge = styled.span`
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.7rem;
  font-weight: 500;
  background: ${props => props.$bg || '#e2e8f0'};
  color: ${props => props.$color || '#475569'};
`;

const PerformanceCount = styled.div`
  font-size: 0.75rem;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
`;

const ProgressContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ProgressLabel = styled.div`
  font-size: 0.75rem;
  font-weight: 600;
  color: #475569;
  min-width: 35px;
`;

const ProgressBar = styled.div`
  display: flex;
  gap: 2px;
  flex: 1;
`;

const ProgressBox = styled.div`
  flex: 1;
  height: 8px;
  border-radius: 2px;
  background: ${props => props.$filled ? '#3b82f6' : '#e2e8f0'};
  transition: background 0.3s ease;
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

const EmptyIcon = styled.div`
  margin-bottom: 1rem;
  opacity: 0.5;
`;

const EmptyText = styled.div`
  font-size: 1rem;
  margin-bottom: 0.5rem;
`;

const EmptySubText = styled.div`
  font-size: 0.875rem;
  color: #cbd5e1;
`;

const LegendNote = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  font-size: 0.8rem;
  color: #64748b;
  margin-bottom: 1rem;
  padding: 0.5rem 0.75rem;
  background: white;
  border-radius: 0.375rem;
  border: 1px solid #e2e8f0;
`;

const LegendFilterButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.625rem;
  border: 1.5px solid ${props => props.$borderColor || '#e2e8f0'};
  border-radius: 0.375rem;
  background: ${props => props.$active ? (props.$borderColor || '#e2e8f0') + '1a' : 'transparent'};
  cursor: pointer;
  font-size: 0.8rem;
  color: ${props => props.$active ? (props.$textColor || '#334155') : '#64748b'};
  font-weight: ${props => props.$active ? 600 : 400};
  transition: all 0.15s;

  &:hover {
    background: ${props => (props.$borderColor || '#e2e8f0') + '1a'};
  }
`;

const LegendIndicator = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 14px;
  border: 2px solid ${props => props.$color || '#10b981'};
  border-radius: 0.25rem;
  box-shadow: 0 0 6px ${props => props.$color ? props.$color + '66' : 'rgba(16, 185, 129, 0.4)'};
  background: ${props => props.$color ? props.$color + '1a' : 'rgba(16, 185, 129, 0.1)'};
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
  font-size: 0.875rem;
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
  }
`;

const TrashButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: ${props => props.$active ? '#ef4444' : '#f1f5f9'};
  color: ${props => props.$active ? 'white' : '#64748b'};
  border: 1px solid ${props => props.$active ? '#ef4444' : '#e2e8f0'};
  border-radius: 0.5rem;
  font-size: 0.875rem;
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
  color: ${props => props.$active ? 'white' : 'white'};
  font-size: 0.7rem;
  padding: 0.125rem 0.375rem;
  border-radius: 9999px;
  min-width: 18px;
  text-align: center;
`;

const ViewModeToggle = styled.div`
  display: flex;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  overflow: hidden;
`;

const ViewModeButton = styled.button`
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
  box-shadow: ${props => props.$active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'};

  &:hover {
    background: ${props => props.$active ? 'white' : '#e2e8f0'};
  }
`;

// 성과 보기 스타일 컴포넌트
const PerformanceViewContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const PerformanceViewHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
`;

const PerformanceViewInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #64748b;

  svg {
    color: #6366f1;
  }
`;

const PerformanceLegend = styled.div`
  display: flex;
  align-items: center;
  gap: 1.5rem;
`;

const LegendItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: #64748b;
`;

const LegendBox = styled.span`
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 2px solid ${props => props.$color || '#e2e8f0'};
  background: ${props => props.$bg || 'white'};
`;

const PerformanceProjectGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 1rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const PerformanceProjectCard = styled(motion.div)`
  background: white;
  border: 2px solid ${props => props.$hasIssue ? '#ef4444' : '#e2e8f0'};
  border-radius: 0.75rem;
  padding: 1.25rem;
  transition: all 0.2s ease;
  cursor: pointer;

  ${props => props.$hasIssue && `
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15);
  `}

  &:hover {
    border-color: ${props => props.$hasIssue ? '#dc2626' : '#cbd5e1'};
    box-shadow: ${props => props.$hasIssue ? '0 4px 16px rgba(239, 68, 68, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.08)'};
    transform: translateY(-2px);
  }
`;

const PerformanceProjectHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 0.75rem;
`;

const PerformanceProjectTitle = styled.div`
  font-size: 1rem;
  font-weight: 600;
  color: #1e293b;
  line-height: 1.4;
  flex: 1;
`;

const PerformanceWarningBadge = styled.span`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
  border-radius: 0.375rem;
  font-size: 0.7rem;
  font-weight: 600;
  white-space: nowrap;
  margin-left: 0.5rem;

  svg {
    flex-shrink: 0;
  }
`;

const PerformanceProjectMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
`;

const PerformanceSection = styled.div`
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  padding: 0.75rem;
`;

const PerformanceSectionTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: #475569;
  margin-bottom: 0.5rem;
`;

const PerformanceTypeGroup = styled.div`
  margin-bottom: 0.5rem;

  &:last-child {
    margin-bottom: 0;
  }
`;

const PerformanceTypeLabel = styled.div`
  font-size: 0.7rem;
  font-weight: 600;
  color: ${props => props.$color || '#64748b'};
  margin-bottom: 0.25rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const PerfViewList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const PerfViewItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.375rem 0.5rem;
  background: white;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  border: 1px solid #e2e8f0;
`;

const PerfViewName = styled.span`
  color: #334155;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const PerfViewContribution = styled.span`
  padding: 0.125rem 0.375rem;
  background: #dcfce7;
  color: #166534;
  border-radius: 0.25rem;
  font-size: 0.65rem;
  font-weight: 600;
  margin-left: 0.5rem;
  flex-shrink: 0;
`;

const NoPerfViewText = styled.div`
  font-size: 0.75rem;
  color: #94a3b8;
  font-style: italic;
  padding: 0.25rem 0;
`;

// 성과 보기 - 사업부별 섹션 스타일
const PerfViewDivisionSection = styled.div`
  margin-bottom: 2rem;

  &:last-child {
    margin-bottom: 0;
  }
`;

const PerfViewDivisionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding: 0.875rem 1.25rem;
  background: linear-gradient(135deg, #475569 0%, #334155 100%);
  border-radius: 0.75rem;
  color: white;
  box-shadow: 0 2px 8px rgba(51, 65, 85, 0.3);
  cursor: default;

  &:hover {
    background: linear-gradient(135deg, #334155 0%, #1e293b 100%);
  }
`;

const PerfViewDivisionTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const PerfViewDivisionBadge = styled.span`
  padding: 0.25rem 0.75rem;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 1rem;
  font-size: 0.85rem;
`;

const PerfViewDivisionWarning = styled.span`
  padding: 0.25rem 0.75rem;
  background: rgba(239, 68, 68, 0.9);
  border-radius: 1rem;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

// 성과 보기 - 필터 바 스타일
const PerfViewFilterBar = styled.div`
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem 0;
  margin-bottom: 1rem;
  flex-wrap: wrap;
`;

const PerfViewFilterButton = styled.button`
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

const PerfViewFilterBadge = styled.span`
  padding: 0.125rem 0.375rem;
  background: ${props => props.$active ? 'rgba(255,255,255,0.3)' : '#e2e8f0'};
  border-radius: 0.25rem;
  font-size: 0.7rem;
`;

// 그룹별 보기 스타일 컴포넌트 - 명시적 열 배치
const GroupedViewContainer = styled.div`
  display: flex;
  gap: 1rem;
  align-items: flex-start;

  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const GroupColumn = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const GroupBox = styled.div`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const GroupBoxHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: ${props => props.$color || '#64748b'};
  flex-shrink: 0;
`;

const GroupBoxTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const GroupBoxCategory = styled.div`
  font-size: 0.95rem;
  font-weight: 700;
  color: white;
`;

const GroupBoxCount = styled.span`
  background: rgba(255, 255, 255, 0.2);
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.7rem;
  font-weight: 600;
  color: white;
`;

const GroupBoxContent = styled.div`
  flex: 1;
`;

const ProjectItemCompact = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #f1f5f9;
  transition: background 0.15s ease;
  cursor: pointer;
  font-size: 0.8rem;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: #f8fafc;
  }
`;

const ProjectNameCompact = styled.div`
  flex: 1;
  font-weight: 500;
  color: #1e293b;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ProjectMetaCompact = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-shrink: 0;
`;

const MetaBadgeCompact = styled.span`
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.65rem;
  font-weight: 500;
  background: ${props => props.$bg || '#e2e8f0'};
  color: ${props => props.$color || '#475569'};
  white-space: nowrap;
`;

const ProgressBadgeCompact = styled.span`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.65rem;
  font-weight: 600;
  background: ${props => {
    const progress = props.$progress || 0;
    if (progress >= 100) return '#dcfce7';
    if (progress >= 70) return '#dbeafe';
    if (progress >= 30) return '#fef9c3';
    return '#f1f5f9';
  }};
  color: ${props => {
    const progress = props.$progress || 0;
    if (progress >= 100) return '#166534';
    if (progress >= 70) return '#1e40af';
    if (progress >= 30) return '#854d0e';
    return '#475569';
  }};
  white-space: nowrap;
  min-width: 36px;
  justify-content: center;
`;

const GroupedViewHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
`;

const GroupedViewInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.875rem;
  color: #64748b;
`;

const DivisionFilterSelect = styled.select`
  padding: 0.5rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.8rem;
  color: #1e293b;
  background: white;
  cursor: pointer;
  min-width: 150px;

  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
`;

const FilterLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  font-weight: 500;
  color: #475569;
`;

const TrashActions = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
`;

const TrashActionButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;

  &.restore {
    background: #10b981;
    color: white;
    &:hover { background: #059669; }
  }

  &.delete {
    background: #ef4444;
    color: white;
    &:hover { background: #dc2626; }
  }
`;

const DeletedBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
  border-radius: 0.25rem;
  font-size: 0.7rem;
  font-weight: 500;
`;

const DeletedInfo = styled.div`
  font-size: 0.7rem;
  color: #94a3b8;
  margin-top: 0.5rem;
`;

// 상세 모달 스타일
const CloseButton = styled.button`
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 0.5rem;
  padding: 0.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  transition: all 0.2s ease;
  margin-left: 1rem;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

// 열 배치 설정 모달 스타일
const SettingsButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  background: #f1f5f9;
  color: #64748b;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #e2e8f0;
    color: #475569;
  }
`;

const SettingsModalOverlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001;
  padding: 2rem;
`;

const SettingsModalContent = styled(motion.div)`
  background: white;
  border-radius: 1rem;
  width: 80vw;
  height: 80vh;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;

  @media (max-width: 768px) {
    width: 95vw;
    height: 90vh;
  }
`;

const SettingsModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  background: #1e293b;
  color: white;
`;

const SettingsModalTitle = styled.h3`
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const SettingsModalBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
`;

const ColumnSettingsContainer = styled.div`
  display: flex;
  gap: 1rem;

  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const ColumnSettingsColumn = styled.div`
  flex: 1;
  background: #f8fafc;
  border: 2px dashed #e2e8f0;
  border-radius: 0.75rem;
  padding: 1rem;
  min-height: 200px;
`;

const ColumnSettingsTitle = styled.div`
  font-size: 0.85rem;
  font-weight: 600;
  color: #475569;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e2e8f0;
`;

const CategoryItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  margin-bottom: 0.5rem;
  font-size: 0.8rem;
  color: #334155;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: #3b82f6;
    background: #eff6ff;
  }

  &:last-child {
    margin-bottom: 0;
  }
`;

const CategorySelect = styled.select`
  padding: 0.25rem 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  color: #475569;
  background: white;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: #3b82f6;
  }
`;

const CategoryActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-left: auto;
`;

const MoveButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 1px solid #e2e8f0;
  border-radius: 0.25rem;
  background: white;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover:not(:disabled) {
    background: #f1f5f9;
    border-color: #cbd5e1;
    color: #334155;
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
`;

const CategoryName = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const SettingsModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
`;

const SettingsModalButton = styled.button`
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &.primary {
    background: #3b82f6;
    color: white;
    border: none;

    &:hover {
      background: #2563eb;
    }
  }

  &.secondary {
    background: white;
    color: #64748b;
    border: 1px solid #e2e8f0;

    &:hover {
      background: #f1f5f9;
    }
  }
`;

const AllCategoriesList = styled.div`
  margin-bottom: 1.5rem;
`;

const AllCategoriesTitle = styled.div`
  font-size: 0.9rem;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 0.75rem;
`;

// 피봇 보기 스타일 컴포넌트
const PivotViewContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const PivotViewHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
`;

const PivotViewInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.875rem;
  color: #64748b;
`;

const PivotAxisSelector = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const PivotAxisLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  font-weight: 500;
  color: #475569;
`;

const PivotAxisSelect = styled.select`
  padding: 0.375rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  font-size: 0.8rem;
  color: #1e293b;
  background: white;
  cursor: pointer;
  min-width: 120px;

  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  }
`;

const PivotTableWrapper = styled.div`
  overflow: auto;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  max-height: calc(100vh - 280px);
`;

const PivotTable = styled.table`
  width: auto;
  border-collapse: separate;
  border-spacing: 0;
`;

const PivotHeaderCell = styled.th`
  position: sticky;
  top: 0;
  background: #f8fafc;
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #334155;
  text-align: center;
  border-bottom: 2px solid #e2e8f0;
  border-right: 1px solid #e2e8f0;
  white-space: nowrap;
  z-index: 10;

  &:first-child {
    position: sticky;
    left: 0;
    z-index: 20;
    background: #f1f5f9;
    width: 1%;
    text-align: left;
    font-size: 0.7rem;
  }

  &:last-child {
    border-right: none;
  }
`;

const PivotRowHeaderCell = styled.td`
  position: sticky;
  left: 0;
  background: #f8fafc;
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #334155;
  border-bottom: 1px solid #e2e8f0;
  border-right: 2px solid #e2e8f0;
  white-space: nowrap;
  width: 1%;
  z-index: 5;
`;

const PivotCell = styled.td`
  padding: 0.375rem;
  border-bottom: 1px solid #e2e8f0;
  border-right: 1px solid #e2e8f0;
  vertical-align: top;
  background: ${props => props.$hasItems ? '#fff' : '#fafafa'};

  &:last-child {
    border-right: none;
  }
`;

const PivotCellContent = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  align-items: flex-start;
`;

const PivotProjectItem = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 0.25rem;
  font-size: 0.7rem;
  color: #334155;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;

  &:hover {
    background: #eff6ff;
    border-color: #3b82f6;
  }
`;

const PivotProjectName = styled.span`
  max-width: 350px;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const PivotProjectProgress = styled.span`
  font-size: 0.6rem;
  font-weight: 600;
  padding: 0.0625rem 0.25rem;
  border-radius: 0.125rem;
  background: ${props => {
    const progress = props.$progress || 0;
    if (progress >= 100) return '#dcfce7';
    if (progress >= 70) return '#dbeafe';
    if (progress >= 30) return '#fef9c3';
    return '#e2e8f0';
  }};
  color: ${props => {
    const progress = props.$progress || 0;
    if (progress >= 100) return '#166534';
    if (progress >= 70) return '#1e40af';
    if (progress >= 30) return '#854d0e';
    return '#64748b';
  }};
`;

const PivotCellCount = styled.span`
  font-size: 0.6rem;
  color: #94a3b8;
  padding: 0.25rem 0.375rem;
  background: #f8fafc;
  border-radius: 0.25rem;
`;

const PivotEmptyCell = styled.div`
  color: #cbd5e1;
  font-size: 0.7rem;
  text-align: center;
  padding: 0.25rem;
`;

// 피봇 설정 모달 스타일
const PivotSettingsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const PivotSettingsSection = styled.div`
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  padding: 1rem;
`;

const PivotSettingsSectionTitle = styled.div`
  font-size: 0.9rem;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const PivotAxisOrderList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  max-height: 250px;
  overflow-y: auto;
`;

const PivotAxisOrderItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  font-size: 0.8rem;
  color: #334155;
`;

const PivotAxisOrderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-left: auto;
`;

// 피봇 축 필드 옵션
const PIVOT_FIELD_OPTIONS = [
  { value: '사업부', label: '사업부' },
  { value: '프로세스', label: '프로세스' },
  { value: '과제영역', label: '과제 영역' },
  { value: '과제구분', label: '과제구분' },
  { value: '진행상태', label: '진행상태' },
];

// 피봇 설정 (축 순서만 서버에 저장, 축 선택은 로컬 상태로 관리)
const DEFAULT_PIVOT_SETTINGS = {
  xAxisOrder: [],
  yAxisOrder: [],
};

// 기본 열 배치 설정 (배열 기반 - 순서 포함, 최대 4열)
const DEFAULT_COLUMN_SETTINGS = {
  column1: ['신규 시뮬레이션 기법 개발', '물성 측정 고도화'],
  column2: ['기존 기법 정확도/정합성 개선', '시뮬레이션 자동화', '신규 프로세스 도입'],
  column3: ['기존 프로세스 고도화', '조기 검증 체계 구축', '플랫폼 도입 및 적용 확대'],
  column4: [],
};

// 구버전 설정(객체 기반)을 새버전(배열 기반)으로 변환
const migrateColumnSettings = (settings) => {
  if (!settings) return null;
  // 이미 배열 기반이면 column4 추가 후 반환
  if (settings.column1 || settings.column2 || settings.column3) {
    return {
      column1: settings.column1 || [],
      column2: settings.column2 || [],
      column3: settings.column3 || [],
      column4: settings.column4 || [],
    };
  }
  // 객체 기반이면 배열 기반으로 변환
  const result = { column1: [], column2: [], column3: [], column4: [] };
  Object.entries(settings).forEach(([category, columnNum]) => {
    const key = `column${columnNum}`;
    if (result[key]) {
      result[key].push(category);
    } else {
      result.column4.push(category);
    }
  });
  return result;
};

// 유형 × 사업부 표. 「따로 얘기한다」면 어느 조직 문제인지가 먼저 나와야 한다.
const RiskBoard = styled.div`
  margin: 0 0 1rem;
  border: 1px solid #fecaca;
  border-radius: 0.5rem;
  background: #fffbfb;
  overflow: hidden;
`;

const RiskBoardHead = styled.div`
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #fee2e2;
  font-size: 0.78rem;
  font-weight: 700;
  color: #b91c1c;
  display: flex;
  align-items: baseline;
  gap: 0.5rem;

  small { font-weight: 500; color: #f87171; font-size: 0.72rem; }
`;

const RiskGrid = styled.div`
  display: grid;
  grid-template-columns: 7.5rem repeat(${p => p.$cols}, minmax(2.6rem, 1fr)) 3rem;
  font-size: 0.78rem;
`;

const RiskCell = styled.div`
  padding: 0.35rem 0.4rem;
  text-align: center;
  border-top: 1px solid #fee2e2;
  color: ${p => (p.$zero ? '#e5e7eb' : p.$total ? '#b91c1c' : '#475569')};
  font-weight: ${p => (p.$head || p.$total ? 700 : 500)};
  background: ${p => (p.$head ? '#fef2f2' : 'transparent')};
  ${p => p.$head && 'border-top: none; color: #b91c1c; font-size: 0.72rem;'}
`;

const RiskKindCell = styled.button`
  padding: 0.35rem 0.5rem;
  text-align: left;
  border: none;
  border-top: 1px solid #fee2e2;
  border-left: 3px solid ${p => (p.$on ? '#dc2626' : 'transparent')};
  background: ${p => (p.$on ? '#fee2e2' : 'transparent')};
  color: ${p => (p.$on ? '#991b1b' : '#b91c1c')};
  font-size: 0.75rem;
  font-weight: ${p => (p.$on ? 700 : 600)};
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;

  &:hover { background: #fee2e2; }
`;

// ── 일정 위험 ────────────────────────────────────────────────────────────────
//
// 「기간이 지난 만큼 진척이 안 따라온다」로 볼 최소 격차.
//
// 0.2 인 이유는 실측이다(2026-08-18 개발 DB, 2026년 **살아 있는** 진행 과제 94건).
//     0.1 → 30건(32%)   0.15 → 14건   0.2 → 6건(6%)   0.25 → 4건   0.3 → 0건
// 「따로 얘기할 목록」이라 서른 줄이면 안 읽힌다. 6% 가 그 크기다.
//
// ⚠️ **처음에 0.3 으로 잡았다가 0건이 떴다.** 임계값을 삭제된 과제까지 포함해
//    쟀기 때문이다 — 휴지통에 시험용 과제(「테스트과제33」 같은)가 쌓여 있었고,
//    그것들이 격차 30~59% 로 걸려 "4건 잡힌다"고 착각했다. 화면은 삭제된 과제를
//    안 보여주므로 실제로는 아무것도 안 떴다.
//    **기준을 정할 때는 화면이 실제로 보는 모수로 재야 한다.**
//
// ⚠️ 운영 DB 는 분포가 또 다르다. 너무 많거나 적으면 이 값부터 만진다.
const SCHEDULE_RISK_GAP = 0.2;

const SCHEDULE_RISK_LABEL = {
  overdue: '기한 지남',
  behind: '일정 뒤처짐',
  backloaded: '막판 몰림',
};

const AllProjectsView = ({
  projects,
  globalPerformances = [],
  statusColors,
  divisionColors,
  currentYear,
  onYearChange,
  onRestoreProject,
  onPermanentDeleteProject,
  isAdmin = false,
  columnSettings: propColumnSettings,
  onColumnSettingsChange,
  pivotSettings: propPivotSettings,
  onPivotSettingsChange,
  taskCategories = [],
  settingsData = {}
}) => {
  const { user } = useAuth();
  // 로컬 저장 권한: Admin, Manager, DT Office만 허용
  const canExport = ['admin', 'manager', 'dt_office'].includes(user?.role) || user?.is_admin;
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);
  const [showTrash, setShowTrash] = useState(false);
  const [viewMode, setViewMode] = useState('all'); // 'all' | 'grouped' | 'pivot' | 'performance'
  const [divisionFilter, setDivisionFilter] = useState(''); // 그룹별 보기 사업부 필터
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [tempColumnSettings, setTempColumnSettings] = useState({ column1: [], column2: [], column3: [], column4: [] });

  // 피봇 보기 상태
  const [showPivotSettings, setShowPivotSettings] = useState(false);
  const [tempPivotSettings, setTempPivotSettings] = useState({ xAxisOrder: [], yAxisOrder: [] });
  // 축 선택은 로컬 상태로 관리 (서버 저장 안함)
  const [pivotXAxisField, setPivotXAxisField] = useState('사업부');
  const [pivotYAxisField, setPivotYAxisField] = useState('과제구분');
  const [pivotDivisionFilter, setPivotDivisionFilter] = useState(''); // 피봇 보기 사업부 필터
  const [perfViewDivisionFilter, setPerfViewDivisionFilter] = useState('all'); // 성과 보기 사업부 필터
  const [recencyFilter, setRecencyFilter] = useState(''); // '' | 'week' | 'month' | 'none'
  const [riskFilter, setRiskFilter] = useState(false);    // 일정 위험만 보기
  const [riskKind, setRiskKind] = useState('');           // '' | overdue | behind | backloaded

  // 경과율의 기준이 되는 「지금」.
  //
  // ⚠️ **보고 있는 연도가 올해일 때만 뜻이 있다.** 2025년을 열어 보면 모든 과제의
  //    경과율이 100% 라 전부 위험으로 걸리고, 그건 아무 말도 아니다. 지난 해는
  //    「기한 내 못 끝낸 과제」라는 다른 이야기이므로 여기서는 아예 안 짚는다.
  const thisYear = new Date().getFullYear();
  const thisMonth = new Date().getMonth() + 1;
  const scheduleRiskApplies = Number(currentYear) === thisYear && !showTrash;
  const [selectedProjectStatuses, setSelectedProjectStatuses] = useState(new Set()); // 과제 상태 (진행상태) 필터

  // 열 배치 설정 (prop 또는 기본값 사용, 구버전 마이그레이션 적용)
  const columnSettings = useMemo(() => {
    const migrated = migrateColumnSettings(propColumnSettings);
    return migrated || DEFAULT_COLUMN_SETTINGS;
  }, [propColumnSettings]);

  // 피봇 설정 (prop 또는 기본값 사용)
  const pivotSettings = useMemo(() => {
    return propPivotSettings || DEFAULT_PIVOT_SETTINGS;
  }, [propPivotSettings]);

  /**
   * 과제의 연도. 목록 필터와 배지가 **같은 규칙**을 써야 숫자가 안 어긋난다.
   *
   * `Number()` 로 감싸는 이유 — 예전 데이터에 연도가 문자열로 들어간 것이 섞이면
   * `'2026' !== 2026` 이 되어 그 과제는 **어느 연도로 가도 안 보인다.**
   * 연도가 아예 없으면 올해로 본다(기존 동작 유지).
   */
  const projectYearOf = (p) => Number(p.과제년도 || new Date().getFullYear());

  /**
   * 휴지통 배지 숫자. **목록과 같은 조건으로 센다.**
   *
   * 🐞 2026-08-06 운영에서 발견 — 배지는 4인데 목록엔 3만 나왔다.
   *    배지는 `_deleted` 만 셌고 목록은 진행상태 필터까지 걸었기 때문이다.
   *    그 필터는 초기 로드 때 화면이 **'취소'만 빼고** 자동으로 켜 둔 것이라
   *    (아래 statusInitialized 참조) 사용자는 켠 적조차 없다.
   *    "4개 있다" 고 해놓고 3개만 보여주면 나머지 하나는 찾을 방법이 없다.
   */
  const deletedProjectsCount = useMemo(() => {
    return projects.filter(p => p._deleted === true
      && projectYearOf(p) === Number(currentYear)).length;
  }, [projects, currentYear]);

  /** 다른 연도의 휴지통 건수 — 이 연도가 비었을 때 "어디에 있는지" 알려주려고 센다 */
  const deletedOtherYearsCount = useMemo(() => {
    return projects.filter(p => p._deleted === true
      && projectYearOf(p) !== Number(currentYear)).length;
  }, [projects, currentYear]);

  // 진행률 계산 함수 (세부 항목 기반)
  const calculateProgress = (project) => {
    if (!project.액션아이템목록 || project.액션아이템목록.length === 0) {
      return 0;
    }

    let totalCount = 0;
    let completedCount = 0;

    project.액션아이템목록.forEach(item => {
      const detailItems = item.세부항목목록 || [];

      // 세부 항목이 있으면 세부 항목 기준으로 계산
      if (detailItems.length > 0) {
        totalCount += detailItems.length;
        completedCount += detailItems.filter(detail => detail.완료여부).length;
      } else {
        // 세부 항목이 없으면 액션아이템 자체의 완료여부로 계산
        totalCount += 1;
        completedCount += item.완료여부 ? 1 : 0;
      }
    });

    return totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  };

  /**
   * 일정이 지난 만큼 진척이 안 따라온 과제. 아니면 null.
   *
   * ⚠️ **판정은 「기간이 얼마나 지났나 − 얼마나 끝냈나」 하나로 한다.**
   *    처음에는 목표일이 뒤로 몰린 것을 보려 했는데, 개발 DB 로 재 보니
   *    **이미 100% 끝낸 과제가 걸렸다**(MX-32). 목표일을 안 적었을 뿐 일은 다 한
   *    것이었다. 목표일은 판정에서 빼고 **왜 그런지 나누는 데만** 쓴다.
   *
   * ⚠️ **액션아이템이 없으면 판단하지 않는다.** 진척을 0% 로 두면 전부 걸리는데,
   *    그건 늦은 게 아니라 **아직 안 적은 것**이다.
   *
   * ⚠️ `시작`·`종료` 는 **월 번호(1~12)** 이지 날짜가 아니다(field_maps.py:45).
   *    그래서 경과율의 해상도는 12단계뿐이다. 일 단위로 쪼개면 정밀해 보이지만
   *    원 데이터에 없는 정밀도라 거짓이다.
   *
   * ⚠️ 진척은 **`calculateProgress` 를 그대로 쓴다.** 여기서 따로 세면 화면이
   *    보여주는 진행률과 배지가 어긋나고, 그때 어느 쪽이 맞는지 아무도 모른다.
   */
  const getScheduleRisk = (project) => {
    if ((project.진행상태 || '') === '완료' || (project.진행상태 || '') === '취소'
        || (project.진행상태 || '') === '미착수') return null;

    const items = project.액션아이템목록 || [];
    if (items.length === 0) return null;           // 안 적은 것은 늦은 것이 아니다

    const start = Number(project.시작), end = Number(project.종료);
    if (!start || !end || end < start) return null;
    const span = end - start + 1;
    // 기간이 짧으면 경과율이 33%씩 뚝뚝 끊겨 신호가 안 된다.
    if (span < 3) return null;

    const elapsed = Math.min(1, Math.max(0, (thisMonth - start + 1) / span));
    const actual = calculateProgress(project) / 100;
    const gap = elapsed - actual;
    if (gap < SCHEDULE_RISK_GAP) return null;

    // ── 여기부터는 「왜」다. 판정은 위에서 끝났다. ──
    let due = 0, dueTotal = 0;
    items.forEach(it => {
      const raw = String(it.목표일 || '').trim();
      if (!raw) return;
      dueTotal += 1;
      if (raw.slice(0, 10) <= todayLocalYmd()) due += 1;
    });
    const plannedRate = dueTotal > 0 ? due / dueTotal : null;

    let kind, why;
    if (elapsed >= 1) {
      kind = 'overdue';
      why = `과제 기한(${start}~${end}월)이 지났는데 진척이 ${Math.round(actual * 100)}% 입니다.`;
    } else if (plannedRate !== null && plannedRate - actual >= 0.2) {
      kind = 'behind';
      why = `이번 달까지 ${Math.round(plannedRate * 100)}% 가 끝났어야 하는데 `
          + `${Math.round(actual * 100)}% 입니다.`;
    } else if (plannedRate !== null && plannedRate <= 0.1) {
      kind = 'backloaded';
      why = `기간의 ${Math.round(elapsed * 100)}% 가 지났는데 이번 달까지 목표일인 `
          + `액션아이템이 없습니다. 남은 일이 뒤에 몰려 있습니다.`;
    } else {
      kind = 'behind';
      why = `기간의 ${Math.round(elapsed * 100)}% 가 지났는데 진척은 `
          + `${Math.round(actual * 100)}% 입니다.`;
    }
    return { kind, gap, elapsed, actual, why, label: SCHEDULE_RISK_LABEL[kind] };
  };

  // 최근 업데이트 여부 확인: 'week' | 'month' | null
  const getUpdateRecency = (project) => {
    if (!project.updatedAt) return null;
    const updatedAt = new Date(project.updatedAt);
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    if (updatedAt > oneWeekAgo) return 'week';
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    if (updatedAt > oneMonthAgo) return 'month';
    return null;
  };

  // 과제 상태(진행상태) 목록
  const availableProjectStatuses = useMemo(() => {
    const statuses = (settingsData.statuses || []).map(s => ({ name: s.name, color: s.color }));
    if (statuses.length > 0) return statuses;
    return [...new Set(projects.filter(p => p.진행상태).map(p => p.진행상태))].sort().map(name => ({ name, color: '#64748b' }));
  }, [settingsData, projects]);

  // 초기 로드 시 "취소"를 제외한 모든 상태 선택
  const [statusInitialized, setStatusInitialized] = useState(false);
  useEffect(() => {
    if (!statusInitialized && availableProjectStatuses.length > 0) {
      const defaultStatuses = new Set(availableProjectStatuses.filter(s => s.name !== '취소').map(s => s.name));
      setSelectedProjectStatuses(defaultStatuses);
      setStatusInitialized(true);
    }
  }, [availableProjectStatuses, statusInitialized]);

  // 과제 상태 토글 핸들러
  const handleProjectStatusToggle = (statusName) => {
    setSelectedProjectStatuses(prev => {
      const next = new Set(prev);
      if (next.has(statusName)) {
        next.delete(statusName);
      } else {
        next.add(statusName);
      }
      return next;
    });
  };

  // 연도별 필터링 및 검색
  const filteredProjects = useMemo(() => {
    return projects.filter(project => {
      // 삭제된 과제 필터 (휴지통 모드에 따라)
      const isDeleted = project._deleted === true;
      if (showTrash) {
        // 휴지통 모드: 삭제된 과제만 표시
        if (!isDeleted) return false;
      } else {
        // 일반 모드: 삭제되지 않은 과제만 표시
        if (isDeleted) return false;
      }

      // 연도 필터 (배지도 같은 규칙을 쓴다 — projectYearOf 주석 참조)
      if (projectYearOf(project) !== Number(currentYear)) return false;

      // 검색어 필터
      if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase();
        const matchName = project.과제명?.toLowerCase().includes(lowerSearch);
        const matchDivision = project.사업부?.toLowerCase().includes(lowerSearch);
        const matchProcess = project.프로세스?.toLowerCase().includes(lowerSearch);
        const matchStatus = project.진행상태?.toLowerCase().includes(lowerSearch);
        const matchPL = project.과제PL?.toLowerCase().includes(lowerSearch);

        if (!matchName && !matchDivision && !matchProcess && !matchStatus && !matchPL) {
          return false;
        }
      }

      // ⚠️ 아래 두 필터는 **휴지통에서는 걸지 않는다.**
      //    휴지통은 '지운 것을 다시 찾는 곳' 이고, 이 둘은 사용자가 켠 적이 없는
      //    화면 기본값이다(특히 진행상태는 '취소'를 자동으로 빼 둔다).
      //    지운 과제를 그런 필터로 숨기면 배지 숫자와 어긋나고, 무엇보다
      //    **취소된 과제야말로 지워질 가능성이 높은데** 하필 그게 안 보인다.
      //    검색어는 사용자가 직접 친 것이라 휴지통에서도 그대로 적용한다.

      // 업데이트 최근성 필터
      if (!showTrash && recencyFilter) {
        const recency = getUpdateRecency(project);
        if (recencyFilter === 'none') {
          if (recency !== null) return false;
        } else {
          if (recency !== recencyFilter) return false;
        }
      }

      // 과제 상태(진행상태) 필터
      if (!showTrash && selectedProjectStatuses.size > 0) {
        if (!selectedProjectStatuses.has(project.진행상태)) return false;
      }

      // 일정 위험만 보기 — 「이 과제들만 따로 얘기한다」가 이 필터의 쓸모다.
      if (riskFilter && scheduleRiskApplies) {
        const risk = getScheduleRisk(project);
        if (!risk) return false;
        // 유형을 고르면 그것만. 「막판 몰림」과 「기한 지남」은 할 말이 다르다.
        if (riskKind && risk.kind !== riskKind) return false;
      }

      return true;
    });
  }, [projects, currentYear, searchTerm, showTrash, recencyFilter, selectedProjectStatuses,
      riskFilter, riskKind, scheduleRiskApplies, thisMonth]);

  /** 유형 × 사업부. 「따로 얘기한다」면 **어느 조직 문제인지**가 먼저 나와야 한다.
   *
   *  ⚠️ 세 유형은 **할 말이 서로 다르다.** 「기한 지남」은 이미 끝난 이야기이고,
   *     「일정 뒤처짐」은 지금 밀리는 중이고, 「막판 몰림」은 아직 안 늦었지만
   *     계획이 뒤에 쏠려 있다는 예고다. 한 덩어리로 세면 그 구별이 사라진다.
   *
   *  ⚠️ 모수는 **필터를 거치지 않은 그 해 과제**다. 필터가 걸린 목록으로 세면
   *     유형을 하나 고르는 순간 나머지 칸이 0 이 되어 표가 자기 자신을 지운다.
   */
  const scheduleRiskSummary = useMemo(() => {
    const empty = { total: 0, kinds: [], divisions: [] };
    if (!scheduleRiskApplies) return empty;

    const byKind = {};
    const divisions = new Set();
    let total = 0;
    projects.forEach(p => {
      if (p._deleted || projectYearOf(p) !== Number(currentYear)) return;
      const risk = getScheduleRisk(p);
      if (!risk) return;
      total += 1;
      const division = p.사업부 || '미지정';
      divisions.add(division);
      const slot = byKind[risk.kind] || (byKind[risk.kind] = { total: 0, by: {} });
      slot.total += 1;
      slot.by[division] = (slot.by[division] || 0) + 1;
    });

    // 급한 순으로 세운다 — 이미 기한이 지난 것이 맨 위다.
    const order = ['overdue', 'behind', 'backloaded'];
    return {
      total,
      divisions: [...divisions].sort(),
      kinds: order.filter(k => byKind[k]).map(k => ({
        kind: k, label: SCHEDULE_RISK_LABEL[k], ...byKind[k],
      })),
    };
  }, [projects, currentYear, scheduleRiskApplies, thisMonth]);

  /** 칩에 붙일 수. 눌러보기 전에 **몇 건인지 먼저 보여야** 누를 마음이 생긴다. */
  const scheduleRiskCount = scheduleRiskSummary.total;

  /**
   * 사업부(설정 순서) → 과제명 순.
   *
   * 사업부를 **가나다순**(`localeCompare`)으로 세우고 있었다 — `CS · DA · GTR · MX …`.
   * 그런데 다른 화면은 전부 설정 순서(`MX · VD · DA · NW …`)로 보여 준다. 그래서 이
   * 목록 맨 위 과제를 편집창에서 열면 이전/다음 순서로는 17번째였다(2026-08-07 신고).
   * 편집창 네비게이션과 **같은 비교자**를 쓴다 — 한쪽만 고치면 또 갈린다.
   */
  const sortedProjects = useMemo(
    () => [...filteredProjects].sort(compareProjects(settingsData)),
    [filteredProjects, settingsData]);

  // 사용 가능한 사업부 목록 추출
  const availableDivisions = useMemo(() => {
    const divisions = new Set();
    sortedProjects.forEach(project => {
      if (project.사업부) {
        divisions.add(project.사업부);
      }
    });
    return [...divisions].sort();
  }, [sortedProjects]);

  // 그룹별 보기용 데이터 구조: 과제구분별 그룹 (사업부 필터 적용)
  const groupedData = useMemo(() => {
    const groups = {};

    // 사업부 필터 적용
    const filteredByDivision = divisionFilter
      ? sortedProjects.filter(p => p.사업부 === divisionFilter)
      : sortedProjects;

    filteredByDivision.forEach(project => {
      const category = project.과제구분 || '미지정';

      if (!groups[category]) {
        groups[category] = {
          category,
          projects: []
        };
      }

      groups[category].projects.push(project);
    });

    return Object.values(groups).sort((a, b) => a.category.localeCompare(b.category));
  }, [sortedProjects, divisionFilter]);

  // 그룹을 열로 분배 - 설정값 기반 배치 (배열 순서 적용, 최대 4열)
  const groupColumns = useMemo(() => {
    const columns = [[], [], [], []]; // 4개 열
    const assignedCategories = new Set();

    // 설정된 순서대로 배치
    [columnSettings.column1, columnSettings.column2, columnSettings.column3, columnSettings.column4].forEach((columnCategories, colIndex) => {
      if (columnCategories) {
        columnCategories.forEach(categoryName => {
          const group = groupedData.find(g => g.category === categoryName);
          if (group) {
            columns[colIndex].push(group);
            assignedCategories.add(categoryName);
          }
        });
      }
    });

    // 설정에 없는 그룹들은 마지막 열에 추가 (4열 또는 비어있지 않은 마지막 열)
    groupedData.forEach(group => {
      if (!assignedCategories.has(group.category)) {
        columns[3].push(group);
      }
    });

    // 빈 열 제거
    return columns.filter(col => col.length > 0);
  }, [groupedData, columnSettings]);

  // 설정의 과제구분 목록 (정렬된 상태) - taskCategories는 객체 배열이므로 name 추출
  const allCategories = useMemo(() => {
    return taskCategories
      .map(cat => typeof cat === 'object' ? cat.name : cat)
      .filter(Boolean)
      .sort();
  }, [taskCategories]);

  // 피봇 축별 값 목록 추출 함수
  const getAxisValues = (field) => {
    const values = new Set();
    sortedProjects.forEach(project => {
      const value = project[field] || '미지정';
      values.add(value);
    });
    return [...values].sort();
  };

  // 피봇 축별 설정값 가져오기 (순서 포함)
  const getOrderedAxisValues = (field, customOrder = []) => {
    const allValues = getAxisValues(field);
    if (customOrder && customOrder.length > 0) {
      // 커스텀 순서가 있으면 적용
      const orderedValues = customOrder.filter(v => allValues.includes(v));
      const remainingValues = allValues.filter(v => !customOrder.includes(v));
      return [...orderedValues, ...remainingValues];
    }
    // 설정 데이터에서 순서 가져오기
    const settingsMap = {
      '사업부': settingsData.divisions,
      '프로세스': settingsData.processes,
      '과제영역': settingsData.projectDomains,
      '과제구분': settingsData.taskCategories,
      '진행상태': settingsData.statuses,
    };
    const settingsItems = settingsMap[field];
    if (settingsItems && settingsItems.length > 0) {
      const orderedNames = settingsItems.map(item => item.name || item);
      const orderedValues = orderedNames.filter(v => allValues.includes(v));
      const remainingValues = allValues.filter(v => !orderedNames.includes(v));
      return [...orderedValues, ...remainingValues];
    }
    return allValues;
  };

  // 피봇 데이터 계산 (축 선택은 로컬 상태, 순서는 서버 설정 사용)
  const pivotData = useMemo(() => {
    const { xAxisOrder, yAxisOrder } = pivotSettings;

    // 사업부 필터 적용
    const filteredProjects = pivotDivisionFilter
      ? sortedProjects.filter(p => p.사업부 === pivotDivisionFilter)
      : sortedProjects;

    const xValues = getOrderedAxisValues(pivotXAxisField, xAxisOrder);
    const yValues = getOrderedAxisValues(pivotYAxisField, yAxisOrder);

    // 2D 매트릭스 생성
    const matrix = {};
    yValues.forEach(yVal => {
      matrix[yVal] = {};
      xValues.forEach(xVal => {
        matrix[yVal][xVal] = [];
      });
    });

    // 프로젝트 배치
    filteredProjects.forEach(project => {
      const xVal = project[pivotXAxisField] || '미지정';
      const yVal = project[pivotYAxisField] || '미지정';
      if (matrix[yVal] && matrix[yVal][xVal]) {
        matrix[yVal][xVal].push(project);
      }
    });

    // 필터링된 프로젝트 수도 반환
    return { xValues, yValues, matrix, filteredCount: filteredProjects.length };
  }, [sortedProjects, pivotSettings, pivotXAxisField, pivotYAxisField, pivotDivisionFilter, settingsData]);

  // 설정 모달 열기
  const handleOpenColumnSettings = () => {
    // taskCategories에서 이름만 추출 (객체인 경우 .name 사용)
    const categoryNames = taskCategories.map(cat => typeof cat === 'object' ? cat.name : cat).filter(Boolean);

    // 현재 설정 복사 (유효한 카테고리만 유지)
    const newSettings = {
      column1: [...(columnSettings.column1 || [])].filter(cat => categoryNames.includes(cat)),
      column2: [...(columnSettings.column2 || [])].filter(cat => categoryNames.includes(cat)),
      column3: [...(columnSettings.column3 || [])].filter(cat => categoryNames.includes(cat)),
      column4: [...(columnSettings.column4 || [])].filter(cat => categoryNames.includes(cat))
    };

    // 설정에 없는 카테고리를 4열에 추가 (설정의 과제구분 목록 기준)
    const allAssigned = [...newSettings.column1, ...newSettings.column2, ...newSettings.column3, ...newSettings.column4];
    categoryNames.forEach(catName => {
      if (!allAssigned.includes(catName)) {
        newSettings.column4.push(catName);
      }
    });

    setTempColumnSettings(newSettings);
    setShowColumnSettings(true);
  };

  // 설정 모달 닫기
  const handleCloseColumnSettings = () => {
    setShowColumnSettings(false);
    setTempColumnSettings({ column1: [], column2: [], column3: [], column4: [] });
  };

  // 과제구분을 다른 열로 이동
  const handleMoveCategory = (category, fromColumn, toColumn) => {
    setTempColumnSettings(prev => {
      const newSettings = {
        column1: [...prev.column1],
        column2: [...prev.column2],
        column3: [...prev.column3],
        column4: [...prev.column4]
      };

      // 기존 열에서 제거
      newSettings[fromColumn] = newSettings[fromColumn].filter(c => c !== category);
      // 새 열에 추가
      newSettings[toColumn].push(category);

      return newSettings;
    });
  };

  // 과제구분 순서 변경 (위로)
  const handleMoveUp = (category, columnKey) => {
    setTempColumnSettings(prev => {
      const newSettings = { ...prev };
      const arr = [...newSettings[columnKey]];
      const index = arr.indexOf(category);
      if (index > 0) {
        [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
        newSettings[columnKey] = arr;
      }
      return newSettings;
    });
  };

  // 과제구분 순서 변경 (아래로)
  const handleMoveDown = (category, columnKey) => {
    setTempColumnSettings(prev => {
      const newSettings = { ...prev };
      const arr = [...newSettings[columnKey]];
      const index = arr.indexOf(category);
      if (index < arr.length - 1) {
        [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
        newSettings[columnKey] = arr;
      }
      return newSettings;
    });
  };

  // 설정 저장
  const handleSaveColumnSettings = () => {
    if (onColumnSettingsChange) {
      onColumnSettingsChange(tempColumnSettings);
    }
    setShowColumnSettings(false);
  };

  // ============ 피봇 설정 함수들 ============

  // 피봇 설정 모달 열기 (현재 선택된 축 기준으로 순서 목록 생성)
  const handleOpenPivotSettings = () => {
    setTempPivotSettings({
      xAxisOrder: getOrderedAxisValues(pivotXAxisField, pivotSettings.xAxisOrder),
      yAxisOrder: getOrderedAxisValues(pivotYAxisField, pivotSettings.yAxisOrder),
    });
    setShowPivotSettings(true);
  };

  // 피봇 설정 모달 닫기
  const handleClosePivotSettings = () => {
    setShowPivotSettings(false);
    setTempPivotSettings({ xAxisOrder: [], yAxisOrder: [] });
  };

  // 피봇 축 순서 위로 이동
  const handlePivotOrderUp = (axis, value) => {
    setTempPivotSettings(prev => {
      const orderKey = `${axis}Order`;
      const arr = [...(prev[orderKey] || [])];
      const index = arr.indexOf(value);
      if (index > 0) {
        [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
      }
      return { ...prev, [orderKey]: arr };
    });
  };

  // 피봇 축 순서 아래로 이동
  const handlePivotOrderDown = (axis, value) => {
    setTempPivotSettings(prev => {
      const orderKey = `${axis}Order`;
      const arr = [...(prev[orderKey] || [])];
      const index = arr.indexOf(value);
      if (index < arr.length - 1) {
        [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
      }
      return { ...prev, [orderKey]: arr };
    });
  };

  // 피봇 설정 저장 (축 순서만 서버에 저장)
  const handleSavePivotSettings = () => {
    if (onPivotSettingsChange) {
      onPivotSettingsChange({
        xAxisOrder: tempPivotSettings.xAxisOrder,
        yAxisOrder: tempPivotSettings.yAxisOrder,
      });
    }
    setShowPivotSettings(false);
  };

  const handleYearChange = (delta) => {
    if (onYearChange) {
      onYearChange(currentYear + delta);
    }
  };

  const handleCardClick = (project) => {
    setSelectedProject(project);
  };

  const handleCloseModal = () => {
    setSelectedProject(null);
  };

  // HTML 태그 제거 및 순수 텍스트 추출 헬퍼 함수
  const stripHtmlTags = (html) => {
    if (!html) return '';
    // 임시 div 요소를 사용하여 HTML을 텍스트로 변환
    const temp = document.createElement('div');
    temp.innerHTML = html;
    // 텍스트만 추출
    let text = temp.textContent || temp.innerText || '';
    // 연속된 공백과 줄바꿈을 하나의 공백으로 정리
    text = text.replace(/\s+/g, ' ').trim();
    return text;
  };

  // CSV 로컬 저장 함수
  const handleExportToCSV = () => {
    if (sortedProjects.length === 0) {
      alert('내보낼 과제가 없습니다.');
      return;
    }

    // CSV 헤더 정의
    const headers = [
      '과제ID',
      '과제년도',
      '사업부',
      '프로세스',
      '과제구분',
      '과제영역',
      '과제명',
      '진행상태',
      '진행률(%)',
      '시작월',
      '종료월',
      '과제PL',
      '작성자',
      '담당부서',
      '참여인력',
      'PoC과제여부',
      '중점과제여부',
      '과제상세설명',
      '액션아이템(완료/전체)',
      '액션아이템목록',
      '연결된성과수',
      '기술성과수',
      '기술성과목록',
      '경영성과수',
      '경영성과목록',
      '성과적합도',
      '수정필요성과수',
      '수정필요사항',
      '상세정보입력완료'
    ];

    // 성과의 수정 필요 여부 판단 헬퍼 함수
    const isPerformanceNeedsAction = (perf) => {
      // 조치사항목록이 있고 비어있지 않으면 수정 필요
      if (perf.조치사항목록 && Array.isArray(perf.조치사항목록) && perf.조치사항목록.length > 0) {
        return true;
      }
      // 조치사항이 있고 "없음"이 아니면 수정 필요
      const action = perf.조치사항;
      if (action && action !== '' && action !== '없음') {
        return true;
      }
      return false;
    };

    // 성과의 수정 필요 사항 문자열 추출
    const getPerformanceActionItems = (perf) => {
      const items = [];
      if (perf.조치사항목록 && Array.isArray(perf.조치사항목록) && perf.조치사항목록.length > 0) {
        items.push(...perf.조치사항목록);
      }
      if (perf.조치사항 && perf.조치사항 !== '' && perf.조치사항 !== '없음') {
        items.push(perf.조치사항);
      }
      return items;
    };

    // globalPerformances를 id/uuid로 빠르게 찾기 위한 맵 생성
    const globalPerfMap = new Map();
    globalPerformances.forEach(gp => {
      if (gp.id) globalPerfMap.set(gp.id, gp);
      if (gp.uuid) globalPerfMap.set(gp.uuid, gp);
      if (gp.성과항목ID) globalPerfMap.set(gp.성과항목ID, gp);
    });

    // project.성과목록의 참조에서 globalPerformances의 전체 정보를 조회하는 헬퍼
    const getFullPerformanceData = (perfRef) => {
      if (!perfRef || typeof perfRef !== 'object') return null;
      // id, uuid, 성과항목ID 순으로 조회
      const perfId = perfRef.id || perfRef.uuid || perfRef.성과항목ID;
      if (perfId && globalPerfMap.has(perfId)) {
        // globalPerformances에서 찾은 데이터와 project의 참조 데이터 병합
        return { ...globalPerfMap.get(perfId), ...perfRef };
      }
      // 찾지 못하면 원래 참조 데이터 반환
      return perfRef;
    };

    // CSV 데이터 생성
    const csvData = sortedProjects.map(project => {
      // 담당부서 문자열화
      const departments = project.담당부서목록?.join(', ') || '';

      // 참여인력 문자열화
      const personnel = project.과제참여인력목록?.map(p => `${p.이름}(${p.부서})`).join(', ') || '';

      // 액션아이템 문자열화
      const completedItems = getCompletedActionItems(project);
      const totalItems = project.액션아이템목록?.length || 0;
      const actionItemsStatus = `="${completedItems} / ${totalItems}"`;
      const actionItemsList = project.액션아이템목록?.map(item =>
        `[${item.완료여부 ? '완료' : '진행중'}] ${item.제목}`
      ).join(' | ') || '';

      // 성과목록 분류 (기술성과 vs 경영성과) - globalPerformances에서 전체 정보 조회
      const perfRefs = project.성과목록 || [];
      const allPerformances = perfRefs.map(getFullPerformanceData).filter(p => p);
      const performanceCount = allPerformances.length;

      // 기술성과 필터링
      const techPerformances = allPerformances.filter(perf =>
        perf.대분류 === '기술 성과' || perf.대분류 === '기술성과'
      );
      const techCount = techPerformances.length;
      const techList = techPerformances.map(perf => {
        if (typeof perf === 'object') {
          const name = perf.성과항목 || perf.name || '-';
          const subcategory = perf.소분류 || '';
          const contribution = perf.과제기여도 ? `${perf.과제기여도}%` : '';
          const current = levelText(perf.현재수준);
          const target = levelText(perf.목표수준);
          const unit = perf.단위 || '';
          return `${name}(${subcategory}, 기여도:${contribution}, 현재:${current}${unit}, 목표:${target}${unit})`;
        }
        return perf;
      }).join(' | ') || '';

      // 경영성과 (기술성과 외) 필터링
      const bizPerformances = allPerformances.filter(perf =>
        perf.대분류 !== '기술 성과' && perf.대분류 !== '기술성과'
      );
      const bizCount = bizPerformances.length;
      const bizList = bizPerformances.map(perf => {
        if (typeof perf === 'object') {
          const name = perf.성과항목 || perf.name || '-';
          const category = perf.대분류 || '';
          const subcategory = perf.소분류 || '';
          const contribution = perf.과제기여도 ? `${perf.과제기여도}%` : '';
          const current = levelText(perf.현재수준);
          const target = levelText(perf.목표수준);
          const unit = perf.단위 || '';
          return `${name}(${category}>${subcategory}, 기여도:${contribution}, 현재:${current}${unit}, 목표:${target}${unit})`;
        }
        return perf;
      }).join(' | ') || '';

      // 성과 적합도 관련 계산
      const performancesNeedingAction = allPerformances.filter(perf =>
        typeof perf === 'object' && isPerformanceNeedsAction(perf)
      );
      const needsActionCount = performancesNeedingAction.length;
      const performanceStatus = performanceCount === 0
        ? '성과없음'
        : needsActionCount === 0
          ? '정상'
          : '수정필요';

      // 수정 필요 사항 목록 (성과명: 수정사항 형태)
      const performanceActionDetails = performancesNeedingAction.map(perf => {
        const perfName = perf.성과항목 || perf.name || '-';
        const actions = getPerformanceActionItems(perf);
        return `[${perfName}] ${actions.join(', ')}`;
      }).join(' | ') || '';

      return [
        project.id || '',
        project.과제년도 || '',
        project.사업부 || '',
        project.프로세스 || '',
        project.과제구분 || '',
        project.과제영역 || '',
        project.과제명 || '',
        project.진행상태 || '',
        calculateProgress(project),
        project.시작 || '',
        project.종료 || '',
        project.과제PL || '',
        project.작성자 || '',
        departments,
        personnel,
        project.PoC과제여부 ? 'Y' : 'N',
        project.중점과제여부 ? 'Y' : 'N',
        stripHtmlTags(project.과제상세설명),
        actionItemsStatus,
        actionItemsList,
        performanceCount,
        techCount,
        techList,
        bizCount,
        bizList,
        performanceStatus,
        needsActionCount,
        performanceActionDetails,
        project.상세정보_입력완료 ? 'Y' : 'N'
      ];
    });

    // CSV 문자열 생성 (BOM 추가로 한글 지원)
    const escapeCSV = (value) => {
      if (value === null || value === undefined) return '';
      let str = String(value);
      // 줄바꿈 문자를 공백으로 치환 (CSV 파싱 문제 방지)
      str = str.replace(/\r\n/g, ' ').replace(/\r/g, ' ').replace(/\n/g, ' ');
      // 쉼표나 따옴표가 있으면 따옴표로 감싸기
      if (str.includes(',') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent = '\uFEFF' + // BOM for UTF-8
      headers.map(escapeCSV).join(',') + '\n' +
      csvData.map(row => row.map(escapeCSV).join(',')).join('\n');

    // 파일 다운로드
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `과제현황_${currentYear}년_${todayLocalYmd()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 완료된 액션아이템 수 (세부 항목 기반)
  const getCompletedActionItems = (project) => {
    if (!project.액션아이템목록 || project.액션아이템목록.length === 0) return 0;

    let completedCount = 0;
    project.액션아이템목록.forEach(item => {
      const detailItems = item.세부항목목록 || [];
      if (detailItems.length > 0) {
        completedCount += detailItems.filter(detail => detail.완료여부).length;
      } else {
        completedCount += item.완료여부 ? 1 : 0;
      }
    });
    return completedCount;
  };

  // 전체 아이템 수 (세부 항목 기반)
  const getTotalActionItems = (project) => {
    if (!project.액션아이템목록 || project.액션아이템목록.length === 0) return 0;

    let totalCount = 0;
    project.액션아이템목록.forEach(item => {
      const detailItems = item.세부항목목록 || [];
      if (detailItems.length > 0) {
        totalCount += detailItems.length;
      } else {
        totalCount += 1;
      }
    });
    return totalCount;
  };

  return (
    <Container>
      <Header>
        <HeaderLeft>
          <Title>
            {showTrash ? <Trash2 size={24} /> : <FileText size={24} />}
            {showTrash ? '휴지통' : '모든 과제 현황'}
            <ProjectCount>({sortedProjects.length}개)</ProjectCount>
          </Title>
        </HeaderLeft>

        <HeaderRight>
          <SearchBox>
            <Search size={16} color="#94a3b8" />
            <SearchInput
              type="text"
              placeholder="과제명, 사업부, PL 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <X
                size={14}
                color="#94a3b8"
                style={{ cursor: 'pointer' }}
                onClick={() => setSearchTerm('')}
              />
            )}
          </SearchBox>

          {!showTrash && canExport && (
            <ExportButton
              onClick={handleExportToCSV}
              disabled={sortedProjects.length === 0}
              title="현재 표시된 과제 목록을 CSV로 저장"
            >
              <Download size={16} />
              로컬 저장
            </ExportButton>
          )}

          {!showTrash && (
            <ViewModeToggle>
              <ViewModeButton
                $active={viewMode === 'all'}
                onClick={() => setViewMode('all')}
                title="전체 보기"
              >
                <LayoutGrid size={14} />
                전체 보기
              </ViewModeButton>
              <ViewModeButton
                $active={viewMode === 'grouped'}
                onClick={() => setViewMode('grouped')}
                title="그룹별 보기"
              >
                <List size={14} />
                그룹별 보기
              </ViewModeButton>
              <ViewModeButton
                $active={viewMode === 'pivot'}
                onClick={() => setViewMode('pivot')}
                title="피봇 보기"
              >
                <Table2 size={14} />
                피봇 보기
              </ViewModeButton>
              <ViewModeButton
                $active={viewMode === 'performance'}
                onClick={() => setViewMode('performance')}
                title="성과 보기"
              >
                <Link2 size={14} />
                성과 보기
              </ViewModeButton>
            </ViewModeToggle>
          )}

          <TrashButton
            $active={showTrash}
            onClick={() => setShowTrash(!showTrash)}
            title={showTrash ? '과제 목록으로 돌아가기' : '삭제된 과제 보기'}
          >
            <Trash2 size={16} />
            {showTrash ? '목록으로' : '휴지통'}
            {deletedProjectsCount > 0 && (
              <TrashBadge $active={showTrash}>{deletedProjectsCount}</TrashBadge>
            )}
          </TrashButton>

          <YearSelector>
            <YearButton onClick={() => handleYearChange(-1)} title="이전 년도">
              ‹
            </YearButton>
            <YearDisplay>{currentYear}년</YearDisplay>
            <YearButton onClick={() => handleYearChange(1)} title="다음 년도">
              ›
            </YearButton>
          </YearSelector>
        </HeaderRight>
      </Header>

      <Content>
        {showTrash ? (
          <LegendNote style={{ background: '#fef2f2', borderColor: '#fecaca' }}>
            <AlertTriangle size={16} color="#dc2626" />
            <span style={{ color: '#dc2626' }}>삭제된 과제 목록입니다. 복구하거나 완전히 삭제할 수 있습니다.</span>
          </LegendNote>
        ) : viewMode === 'all' ? (
          <LegendNote>
            <LegendFilterButton
              $borderColor="#3b82f6"
              $textColor="#2563eb"
              $active={recencyFilter === 'week'}
              onClick={() => setRecencyFilter(recencyFilter === 'week' ? '' : 'week')}
              title="클릭하여 최근 1주일 업데이트만 필터"
            >
              <LegendIndicator $color="#3b82f6" />
              최근 1주일
            </LegendFilterButton>
            <LegendFilterButton
              $borderColor="#10b981"
              $textColor="#059669"
              $active={recencyFilter === 'month'}
              onClick={() => setRecencyFilter(recencyFilter === 'month' ? '' : 'month')}
              title="클릭하여 최근 1개월 업데이트만 필터"
            >
              <LegendIndicator />
              최근 1개월
            </LegendFilterButton>
            <LegendFilterButton
              $borderColor="#e2e8f0"
              $textColor="#64748b"
              $active={recencyFilter === 'none'}
              onClick={() => setRecencyFilter(recencyFilter === 'none' ? '' : 'none')}
              title="클릭하여 오래된 과제만 필터"
            >
              <LegendIndicator $color="#e2e8f0" />
              그 외
            </LegendFilterButton>
            {/* 일정 위험. **0건이면 칩을 안 그린다** — 눌러도 빈 목록이 나오는
                칩이 늘 떠 있으면 다음부터 아무도 안 누른다. */}
            {scheduleRiskApplies && scheduleRiskCount > 0 && (
              <LegendFilterButton
                $borderColor="#fecaca"
                $textColor="#dc2626"
                $active={riskFilter}
                /* 끌 때 유형 선택도 같이 푼다 — 안 그러면 다시 켰을 때 왜
                   3건뿐인지 모른 채 목록을 본다. */
                onClick={() => { setRiskFilter(!riskFilter); setRiskKind(''); }}
                title="기간이 지난 만큼 진척이 안 따라온 과제만 봅니다"
              >
                <AlertTriangle size={12} />
                일정 위험 {scheduleRiskCount}
              </LegendFilterButton>
            )}
            {recencyFilter && (
              <LegendFilterButton
                $borderColor="#94a3b8"
                onClick={() => setRecencyFilter('')}
                title="필터 초기화"
                style={{ marginLeft: '0.25rem' }}
              >
                <X size={12} />
                초기화
              </LegendFilterButton>
            )}
            {/* 과제 상태(진행상태) 필터 토글 */}
            {availableProjectStatuses.length > 0 && (
              <>
                <span style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '0.75rem', marginLeft: '0.25rem', fontSize: '0.8rem', color: '#475569', fontWeight: 600, whiteSpace: 'nowrap' }}>과제 상태:</span>
                {availableProjectStatuses.map(status => {
                  const isActive = selectedProjectStatuses.has(status.name);
                  return (
                    <LegendFilterButton
                      key={`ps-${status.name}`}
                      $borderColor={status.color}
                      $textColor={status.color}
                      $active={isActive}
                      onClick={() => handleProjectStatusToggle(status.name)}
                      style={isActive ? { background: status.color, color: 'white', fontWeight: 600 } : {}}
                      title={`${status.name} 과제만 필터`}
                    >
                      {status.name}
                    </LegendFilterButton>
                  );
                })}
                {selectedProjectStatuses.size > 0 && (
                  <LegendFilterButton
                    $borderColor="#94a3b8"
                    onClick={() => setSelectedProjectStatuses(new Set(availableProjectStatuses.filter(s => s.name !== '취소').map(s => s.name)))}
                    title="과제 상태 필터 초기화"
                  >
                    <X size={12} />
                    초기화
                  </LegendFilterButton>
                )}
              </>
            )}
          </LegendNote>
        ) : null}

        {/* 유형 × 사업부. **필터를 켰을 때만** 편다 — 평소에 깔아 두면 아무도 안
            누르는 표가 목록 위 자리를 늘 차지한다. */}
        {riskFilter && scheduleRiskApplies && scheduleRiskSummary.total > 0 && (
          <RiskBoard>
            <RiskBoardHead>
              유형별 · 사업부별
              <small>
                유형을 누르면 그것만 봅니다
                {riskKind && ` · 지금 「${SCHEDULE_RISK_LABEL[riskKind]}」만 보는 중`}
              </small>
            </RiskBoardHead>
            <RiskGrid $cols={scheduleRiskSummary.divisions.length}>
              <RiskCell $head />
              {scheduleRiskSummary.divisions.map(d => (
                <RiskCell key={d} $head>{d}</RiskCell>
              ))}
              <RiskCell $head $total>합</RiskCell>

              {scheduleRiskSummary.kinds.map(k => (
                <React.Fragment key={k.kind}>
                  <RiskKindCell
                    $on={riskKind === k.kind}
                    onClick={() => setRiskKind(riskKind === k.kind ? '' : k.kind)}
                    title={`「${k.label}」 ${k.total}건만 봅니다`}
                  >
                    ⚠ {k.label}
                  </RiskKindCell>
                  {scheduleRiskSummary.divisions.map(d => (
                    /* 0 은 흐리게. 있는 칸이 눈에 먼저 들어와야 한다. */
                    <RiskCell key={d} $zero={!k.by[d]}>{k.by[d] || 0}</RiskCell>
                  ))}
                  <RiskCell $total>{k.total}</RiskCell>
                </React.Fragment>
              ))}
            </RiskGrid>
          </RiskBoard>
        )}

        {sortedProjects.length === 0 ? (
          <EmptyState>
            <EmptyIcon>
              {showTrash ? <Trash2 size={64} /> : <FileText size={64} />}
            </EmptyIcon>
            <EmptyText>
              {showTrash
                ? `${currentYear}년 삭제된 과제가 없습니다.`
                : searchTerm
                  ? `"${searchTerm}" 검색 결과가 없습니다.`
                  : `${currentYear}년 과제가 없습니다.`
              }
            </EmptyText>
            <EmptySubText>
              {showTrash
                /* 다른 연도에 있으면 그 사실을 알린다 — 안 알리면 "지웠는데 어디에도
                   없다" 가 되고, 사용자는 연도를 하나씩 돌려볼 생각을 못 한다. */
                ? (deletedOtherYearsCount > 0
                    ? `다른 연도에 삭제된 과제가 ${deletedOtherYearsCount}건 있습니다. 연도를 바꿔 보세요.`
                    : '삭제된 과제가 없습니다.')
                : searchTerm
                  ? '다른 검색어를 입력해 보세요.'
                  : '다른 연도를 선택해 보세요.'
              }
            </EmptySubText>
          </EmptyState>
        ) : viewMode === 'grouped' && !showTrash ? (
          /* 그룹별 보기 - 박스 그리드 형태 */
          <>
            <GroupedViewHeader>
              <GroupedViewInfo>
                <Briefcase size={16} />
                <span>
                  {divisionFilter ? `${divisionFilter} 사업부` : '전체 사업부'} ·
                  {groupedData.length}개 그룹 ·
                  {groupedData.reduce((sum, g) => sum + g.projects.length, 0)}개 과제
                </span>
              </GroupedViewInfo>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <FilterLabel>
                  <Building2 size={14} />
                  사업부 필터
                  <DivisionFilterSelect
                    value={divisionFilter}
                    onChange={(e) => setDivisionFilter(e.target.value)}
                  >
                    <option value="">전체 사업부</option>
                    {availableDivisions.map(div => (
                    <option key={div} value={div}>{div}</option>
                  ))}
                </DivisionFilterSelect>
              </FilterLabel>
                {isAdmin && (
                  <SettingsButton onClick={handleOpenColumnSettings} title="열 배치 설정">
                    <Settings size={14} />
                    열 배치 설정
                  </SettingsButton>
                )}
              </div>
            </GroupedViewHeader>
            <GroupedViewContainer>
              {groupColumns.map((column, colIndex) => (
                <GroupColumn key={colIndex}>
                  {column.map(group => (
                    <GroupBox key={group.category}>
                      <GroupBoxHeader $color="#475569">
                        <GroupBoxTitle>
                          <GroupBoxCategory>{group.category}</GroupBoxCategory>
                        </GroupBoxTitle>
                        <GroupBoxCount>{group.projects.length}개</GroupBoxCount>
                      </GroupBoxHeader>
                      <GroupBoxContent>
                        {group.projects.map(project => {
                          const progress = calculateProgress(project);
                          return (
                            <ProjectItemCompact
                              key={project.id}
                              onClick={() => handleCardClick(project)}
                            >
                              <ProjectNameCompact title={project.과제명}>
                                {project.과제명}
                              </ProjectNameCompact>
                              <ProjectMetaCompact>
                                <ProgressBadgeCompact $progress={progress}>
                                  {progress}%
                                </ProgressBadgeCompact>
                                <MetaBadgeCompact $bg={divisionColors[project.사업부]} $color="white">
                                  {project.사업부}
                                </MetaBadgeCompact>
                                <MetaBadgeCompact $bg="#3b82f6" $color="white">
                                  {project.프로세스}
                                </MetaBadgeCompact>
                                <MetaBadgeCompact>
                                  {project.과제영역 || '-'}
                                </MetaBadgeCompact>
                              </ProjectMetaCompact>
                            </ProjectItemCompact>
                          );
                        })}
                      </GroupBoxContent>
                    </GroupBox>
                  ))}
                </GroupColumn>
              ))}
            </GroupedViewContainer>
          </>
        ) : viewMode === 'pivot' && !showTrash ? (
          /* 피봇 보기 */
          <PivotViewContainer>
            <PivotViewHeader>
              <PivotViewInfo>
                <Table2 size={16} />
                <span>
                  {pivotDivisionFilter ? `${pivotDivisionFilter} 사업부` : '전체 사업부'} ·
                  {pivotData.yValues.length}개 행 × {pivotData.xValues.length}개 열 ·
                  {pivotData.filteredCount}개 과제
                </span>
              </PivotViewInfo>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <PivotAxisSelector>
                  <PivotAxisLabel>
                    사업부:
                    <PivotAxisSelect
                      value={pivotDivisionFilter}
                      onChange={(e) => setPivotDivisionFilter(e.target.value)}
                    >
                      <option value="">전체</option>
                      {availableDivisions.map(div => (
                        <option key={div} value={div}>{div}</option>
                      ))}
                    </PivotAxisSelect>
                  </PivotAxisLabel>
                  <PivotAxisLabel>
                    가로축:
                    <PivotAxisSelect
                      value={pivotXAxisField}
                      onChange={(e) => setPivotXAxisField(e.target.value)}
                    >
                      {PIVOT_FIELD_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </PivotAxisSelect>
                  </PivotAxisLabel>
                  <PivotAxisLabel>
                    세로축:
                    <PivotAxisSelect
                      value={pivotYAxisField}
                      onChange={(e) => setPivotYAxisField(e.target.value)}
                    >
                      {PIVOT_FIELD_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </PivotAxisSelect>
                  </PivotAxisLabel>
                </PivotAxisSelector>
                {isAdmin && (
                  <SettingsButton onClick={handleOpenPivotSettings} title="피봇 설정">
                    <Settings size={14} />
                    축 순서 설정
                  </SettingsButton>
                )}
              </div>
            </PivotViewHeader>

            <PivotTableWrapper>
              <PivotTable>
                <thead>
                  <tr>
                    <PivotHeaderCell>
                      {PIVOT_FIELD_OPTIONS.find(o => o.value === pivotYAxisField)?.label || pivotYAxisField}
                      {' / '}
                      {PIVOT_FIELD_OPTIONS.find(o => o.value === pivotXAxisField)?.label || pivotXAxisField}
                    </PivotHeaderCell>
                    {pivotData.xValues.map(xVal => (
                      <PivotHeaderCell key={xVal}>{xVal}</PivotHeaderCell>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pivotData.yValues.map(yVal => (
                    <tr key={yVal}>
                      <PivotRowHeaderCell>{yVal}</PivotRowHeaderCell>
                      {pivotData.xValues.map(xVal => {
                        const cellProjects = pivotData.matrix[yVal]?.[xVal] || [];
                        return (
                          <PivotCell key={xVal} $hasItems={cellProjects.length > 0}>
                            {cellProjects.length > 0 ? (
                              <PivotCellContent>
                                {cellProjects.map(project => {
                                  const progress = calculateProgress(project);
                                  return (
                                    <PivotProjectItem
                                      key={project.id}
                                      onClick={() => handleCardClick(project)}
                                      title={project.과제명}
                                    >
                                      <PivotProjectName>{project.과제명}</PivotProjectName>
                                      <PivotProjectProgress $progress={progress}>
                                        {progress}%
                                      </PivotProjectProgress>
                                    </PivotProjectItem>
                                  );
                                })}
                                {cellProjects.length > 1 && (
                                  <PivotCellCount>{cellProjects.length}</PivotCellCount>
                                )}
                              </PivotCellContent>
                            ) : (
                              <PivotEmptyCell>-</PivotEmptyCell>
                            )}
                          </PivotCell>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </PivotTable>
            </PivotTableWrapper>
          </PivotViewContainer>
        ) : viewMode === 'performance' && !showTrash ? (
          /* 성과 보기 - 사업부별 그룹 */
          <PerformanceViewContainer>
            <PerformanceViewHeader>
              <PerformanceViewInfo>
                <Link2 size={16} />
                <span>
                  총 {sortedProjects.length}개 과제 ·
                  성과 연결 미흡 {sortedProjects.filter(p => {
                    const performances = p.성과목록 || [];
                    const techCount = performances.filter(perf =>
                      perf.대분류 === '기술 성과' || perf.대분류 === '기술성과'
                    ).length;
                    const bizCount = performances.filter(perf =>
                      perf.대분류 !== '기술 성과' && perf.대분류 !== '기술성과'
                    ).length;
                    return techCount < 1 || bizCount < 1;
                  }).length}개
                </span>
              </PerformanceViewInfo>
              <PerformanceLegend>
                <LegendItem>
                  <LegendBox $color="#ef4444" $bg="#fef2f2" />
                  <span>기술성과 또는 경영성과 미연결</span>
                </LegendItem>
                <LegendItem>
                  <LegendBox $color="#e2e8f0" $bg="white" />
                  <span>정상 연결</span>
                </LegendItem>
              </PerformanceLegend>
            </PerformanceViewHeader>

            {/* 사업부별로 그룹화 */}
            {(() => {
              // 사업부별로 과제 그룹화
              const projectsByDivision = {};
              sortedProjects.forEach(project => {
                const division = project.사업부 || '미분류';
                if (!projectsByDivision[division]) {
                  projectsByDivision[division] = [];
                }
                projectsByDivision[division].push(project);
              });

              // 사업부 순서 정렬
              const divisionOrder = ['MX', 'VD', 'DA', 'NW', '의료기기', 'SR', 'GTR', 'CS'];
              const divisions = Object.keys(projectsByDivision).sort((a, b) => {
                const indexA = divisionOrder.indexOf(a);
                const indexB = divisionOrder.indexOf(b);
                if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                if (indexA !== -1) return -1;
                if (indexB !== -1) return 1;
                return a.localeCompare(b);
              });

              // 필터링된 사업부 목록
              const displayDivisions = perfViewDivisionFilter === 'all'
                ? divisions
                : divisions.filter(d => d === perfViewDivisionFilter);

              return (
                <>
                  {/* 사업부 필터 바 */}
                  <PerfViewFilterBar>
                    <PerfViewFilterButton
                      $active={perfViewDivisionFilter === 'all'}
                      onClick={() => setPerfViewDivisionFilter('all')}
                    >
                      전체
                      <PerfViewFilterBadge $active={perfViewDivisionFilter === 'all'}>
                        {sortedProjects.length}
                      </PerfViewFilterBadge>
                    </PerfViewFilterButton>
                    {divisions.map(division => {
                      const count = projectsByDivision[division]?.length || 0;
                      return (
                        <PerfViewFilterButton
                          key={division}
                          $active={perfViewDivisionFilter === division}
                          onClick={() => setPerfViewDivisionFilter(division)}
                        >
                          {division}
                          <PerfViewFilterBadge $active={perfViewDivisionFilter === division}>
                            {count}
                          </PerfViewFilterBadge>
                        </PerfViewFilterButton>
                      );
                    })}
                  </PerfViewFilterBar>

                  {/* 사업부별 섹션 */}
                  {displayDivisions.map(division => {
                    const divisionProjects = projectsByDivision[division];
                    const issueCount = divisionProjects.filter(p => {
                      const performances = p.성과목록 || [];
                      const techCount = performances.filter(perf =>
                        perf.대분류 === '기술 성과' || perf.대분류 === '기술성과'
                      ).length;
                      const bizCount = performances.filter(perf =>
                        perf.대분류 !== '기술 성과' && perf.대분류 !== '기술성과'
                      ).length;
                      return techCount < 1 || bizCount < 1;
                    }).length;

                    return (
                      <PerfViewDivisionSection key={division}>
                        <PerfViewDivisionHeader>
                          <Building2 size={22} />
                          <PerfViewDivisionTitle>
                            {division}
                            <PerfViewDivisionBadge>
                              {divisionProjects.length}개 과제
                            </PerfViewDivisionBadge>
                          </PerfViewDivisionTitle>
                          {issueCount > 0 && (
                            <PerfViewDivisionWarning>
                              <AlertTriangle size={14} />
                              미흡 {issueCount}개
                            </PerfViewDivisionWarning>
                          )}
                        </PerfViewDivisionHeader>

                        <PerformanceProjectGrid>
                      {divisionProjects.map((project, index) => {
                        const performances = project.성과목록 || [];
                        const techPerformances = performances.filter(perf =>
                          perf.대분류 === '기술 성과' || perf.대분류 === '기술성과'
                        );
                        const bizPerformances = performances.filter(perf =>
                          perf.대분류 !== '기술 성과' && perf.대분류 !== '기술성과'
                        );
                        const hasIssue = techPerformances.length < 1 || bizPerformances.length < 1;

                        return (
                          <PerformanceProjectCard
                            key={project.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: Math.min(index * 0.02, 0.3) }}
                            $hasIssue={hasIssue}
                            onClick={() => handleCardClick(project)}
                          >
                            <PerformanceProjectHeader>
                              <PerformanceProjectTitle>
                                {project.과제명}
                              </PerformanceProjectTitle>
                              {hasIssue && (
                                <PerformanceWarningBadge>
                                  <AlertTriangle size={12} />
                                  {techPerformances.length < 1 && bizPerformances.length < 1
                                    ? '성과 미연결'
                                    : techPerformances.length < 1
                                      ? '기술성과 미연결'
                                      : '경영성과 미연결'
                                  }
                                </PerformanceWarningBadge>
                              )}
                            </PerformanceProjectHeader>

                            <PerformanceProjectMeta>
                              <MetaBadge $bg="#3b82f6" $color="white">
                                {project.프로세스}
                              </MetaBadge>
                              <MetaBadge $bg={statusColors[project.진행상태]} $color="white">
                                {project.진행상태}
                              </MetaBadge>
                              {project.과제PL && (
                                <MetaBadge $bg="#f1f5f9" $color="#475569">
                                  PL: {project.과제PL}
                                </MetaBadge>
                              )}
                            </PerformanceProjectMeta>

                            <PerformanceSection>
                              <PerformanceSectionTitle>
                                <Target size={14} />
                                연결된 성과 ({performances.length}개)
                              </PerformanceSectionTitle>

                              <PerformanceTypeGroup>
                                <PerformanceTypeLabel $color="#6366f1">
                                  기술 성과 ({techPerformances.length}개)
                                  {techPerformances.length < 1 && <AlertTriangle size={10} color="#ef4444" />}
                                </PerformanceTypeLabel>
                                {techPerformances.length > 0 ? (
                                  <PerfViewList>
                                    {techPerformances.map((perf, idx) => (
                                      <PerfViewItem key={idx}>
                                        <PerfViewName title={perf.성과항목}>
                                          {perf.성과항목}
                                        </PerfViewName>
                                        <PerfViewContribution>
                                          {perf.과제기여도 || 0}%
                                        </PerfViewContribution>
                                      </PerfViewItem>
                                    ))}
                                  </PerfViewList>
                                ) : (
                                  <NoPerfViewText>연결된 기술 성과 없음</NoPerfViewText>
                                )}
                              </PerformanceTypeGroup>

                              <PerformanceTypeGroup>
                                <PerformanceTypeLabel $color="#10b981">
                                  경영 성과 ({bizPerformances.length}개)
                                  {bizPerformances.length < 1 && <AlertTriangle size={10} color="#ef4444" />}
                                </PerformanceTypeLabel>
                                {bizPerformances.length > 0 ? (
                                  <PerfViewList>
                                    {bizPerformances.map((perf, idx) => (
                                      <PerfViewItem key={idx}>
                                        <PerfViewName title={perf.성과항목}>
                                          {perf.성과항목}
                                        </PerfViewName>
                                        <PerfViewContribution>
                                          {perf.과제기여도 || 0}%
                                        </PerfViewContribution>
                                      </PerfViewItem>
                                    ))}
                                  </PerfViewList>
                                ) : (
                                  <NoPerfViewText>연결된 경영 성과 없음</NoPerfViewText>
                                )}
                              </PerformanceTypeGroup>
                            </PerformanceSection>
                          </PerformanceProjectCard>
                        );
                        })}
                        </PerformanceProjectGrid>
                      </PerfViewDivisionSection>
                    );
                  })}
                </>
              );
            })()}
          </PerformanceViewContainer>
        ) : (
          /* 전체 보기 (기본) */
          <ProjectGrid>
            {sortedProjects.map((project, index) => (
              <ProjectCard
                key={project.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.02, 0.5) }}
                $updateRecency={!showTrash ? getUpdateRecency(project) : null}
                onClick={() => !showTrash && handleCardClick(project)}
                style={showTrash ? { cursor: 'default', opacity: 0.9 } : {}}
              >
                <ProjectTitle>
                  {project.과제명}
                  {showTrash && (
                    <DeletedBadge>
                      <Trash2 size={10} />
                      삭제됨
                    </DeletedBadge>
                  )}
                </ProjectTitle>

                <ProjectMeta>
                  <MetaBadge $bg={divisionColors[project.사업부]} $color="white">
                    {project.사업부}
                  </MetaBadge>
                  <MetaBadge $bg="#3b82f6" $color="white">
                    {project.프로세스}
                  </MetaBadge>
                  <MetaBadge $bg={statusColors[project.진행상태]} $color="white">
                    {project.진행상태}
                  </MetaBadge>
                  <MetaBadge>
                    {project.시작}월 ~ {project.종료}월
                  </MetaBadge>
                  {project.과제PL && (
                    <MetaBadge $bg="#f1f5f9" $color="#475569">
                      PL: {project.과제PL}
                    </MetaBadge>
                  )}
                  {project.사업부내공개여부 && (
                    <MetaBadge $bg="#475569" $color="white" title="사업부 내 공개 과제">
                      🔒 사업부내
                    </MetaBadge>
                  )}
                  {/* 일정 위험. **필터를 켜지 않아도 보인다** — 걸러야만 보이는
                      신호는 누가 걸러 볼 생각을 해야 존재를 안다. 이유는 title 에
                      붙여 두어 왜 걸렸는지 그 자리에서 읽을 수 있게 한다. */}
                  {scheduleRiskApplies && (() => {
                    const risk = getScheduleRisk(project);
                    if (!risk) return null;
                    return (
                      <MetaBadge $bg="#fef2f2" $color="#dc2626" title={risk.why}>
                        ⚠ {risk.label}
                      </MetaBadge>
                    );
                  })()}
                </ProjectMeta>

                {showTrash ? (
                  <>
                    {project._deletedAt && (
                      <DeletedInfo>
                        삭제일: {new Date(project._deletedAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}
                        {project._deletedByName && ` (${project._deletedByName})`}
                      </DeletedInfo>
                    )}
                    <TrashActions>
                      <TrashActionButton
                        className="restore"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onRestoreProject) onRestoreProject(project);
                        }}
                      >
                        <RotateCcw size={14} />
                        복구
                      </TrashActionButton>
                      <TrashActionButton
                        className="delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`"${project.과제명}" 과제를 완전히 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
                            if (onPermanentDeleteProject) onPermanentDeleteProject(project);
                          }
                        }}
                      >
                        <Trash2 size={14} />
                        완전 삭제
                      </TrashActionButton>
                    </TrashActions>
                  </>
                ) : (
                  <>
                    <PerformanceCount>
                      <Target size={12} />
                      성과 {project.성과목록?.length || 0}개
                    </PerformanceCount>

                    <ProgressContainer>
                      <ProgressLabel>{calculateProgress(project)}%</ProgressLabel>
                      <ProgressBar>
                        {Array.from({ length: 10 }).map((_, i) => {
                          const progress = calculateProgress(project);
                          const filledBoxes = Math.round(progress / 10);
                          return (
                            <ProgressBox key={i} $filled={i < filledBoxes} />
                          );
                        })}
                      </ProgressBar>
                    </ProgressContainer>
                  </>
                )}
              </ProjectCard>
            ))}
          </ProjectGrid>
        )}
      </Content>

      {/*
        과제 상세 모달 — **전체 요약에서도 같은 것을 띄운다**(2026-08-08).
        컴포넌트로 빼기 전에는 이 파일 안에만 있어서, 다른 화면에서 쓰려면 복사밖에
        방법이 없었다. 안은 보고서와 같은 공용 조각들이다.
      */}
      <ProjectDetailModal
        project={selectedProject}
        onClose={handleCloseModal}
        performances={globalPerformances}
        divisionColors={divisionColors}
        statusColors={statusColors}
      />

      {/* 열 배치 설정 모달 (관리자 전용) */}
      <AnimatePresence>
        {showColumnSettings && (
          <SettingsModalOverlay
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCloseColumnSettings}
          >
            <SettingsModalContent
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <SettingsModalHeader>
                <SettingsModalTitle>
                  <Settings size={18} />
                  그룹별 보기 열 배치 설정
                </SettingsModalTitle>
                <CloseButton onClick={handleCloseColumnSettings}>
                  <X size={18} />
                </CloseButton>
              </SettingsModalHeader>

              <SettingsModalBody>
                <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem' }}>
                  각 열에서 과제구분의 위치를 조정하세요. ▲▼ 버튼으로 순서를 변경하고, 드롭다운으로 열을 이동할 수 있습니다.
                </p>

                <ColumnSettingsContainer>
                  {/* 1열 */}
                  <ColumnSettingsColumn>
                    <ColumnSettingsTitle>1열 - {tempColumnSettings.column1?.length || 0}개</ColumnSettingsTitle>
                    {tempColumnSettings.column1?.map((cat, index) => (
                      <CategoryItem key={cat}>
                        <CategoryName title={cat}>{cat}</CategoryName>
                        <CategoryActions>
                          <MoveButton
                            onClick={() => handleMoveUp(cat, 'column1')}
                            disabled={index === 0}
                            title="위로 이동"
                          >
                            <ChevronUp size={14} />
                          </MoveButton>
                          <MoveButton
                            onClick={() => handleMoveDown(cat, 'column1')}
                            disabled={index === tempColumnSettings.column1.length - 1}
                            title="아래로 이동"
                          >
                            <ChevronDown size={14} />
                          </MoveButton>
                          <CategorySelect
                            value="column1"
                            onChange={(e) => handleMoveCategory(cat, 'column1', e.target.value)}
                          >
                            <option value="column1">1열</option>
                            <option value="column2">→ 2열</option>
                            <option value="column3">→ 3열</option>
                            <option value="column4">→ 4열</option>
                          </CategorySelect>
                        </CategoryActions>
                      </CategoryItem>
                    ))}
                    {(!tempColumnSettings.column1 || tempColumnSettings.column1.length === 0) && (
                      <div style={{ color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center', padding: '1rem' }}>
                        항목 없음
                      </div>
                    )}
                  </ColumnSettingsColumn>

                  {/* 2열 */}
                  <ColumnSettingsColumn>
                    <ColumnSettingsTitle>2열 - {tempColumnSettings.column2?.length || 0}개</ColumnSettingsTitle>
                    {tempColumnSettings.column2?.map((cat, index) => (
                      <CategoryItem key={cat}>
                        <CategoryName title={cat}>{cat}</CategoryName>
                        <CategoryActions>
                          <MoveButton
                            onClick={() => handleMoveUp(cat, 'column2')}
                            disabled={index === 0}
                            title="위로 이동"
                          >
                            <ChevronUp size={14} />
                          </MoveButton>
                          <MoveButton
                            onClick={() => handleMoveDown(cat, 'column2')}
                            disabled={index === tempColumnSettings.column2.length - 1}
                            title="아래로 이동"
                          >
                            <ChevronDown size={14} />
                          </MoveButton>
                          <CategorySelect
                            value="column2"
                            onChange={(e) => handleMoveCategory(cat, 'column2', e.target.value)}
                          >
                            <option value="column1">→ 1열</option>
                            <option value="column2">2열</option>
                            <option value="column3">→ 3열</option>
                            <option value="column4">→ 4열</option>
                          </CategorySelect>
                        </CategoryActions>
                      </CategoryItem>
                    ))}
                    {(!tempColumnSettings.column2 || tempColumnSettings.column2.length === 0) && (
                      <div style={{ color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center', padding: '1rem' }}>
                        항목 없음
                      </div>
                    )}
                  </ColumnSettingsColumn>

                  {/* 3열 */}
                  <ColumnSettingsColumn>
                    <ColumnSettingsTitle>3열 - {tempColumnSettings.column3?.length || 0}개</ColumnSettingsTitle>
                    {tempColumnSettings.column3?.map((cat, index) => (
                      <CategoryItem key={cat}>
                        <CategoryName title={cat}>{cat}</CategoryName>
                        <CategoryActions>
                          <MoveButton
                            onClick={() => handleMoveUp(cat, 'column3')}
                            disabled={index === 0}
                            title="위로 이동"
                          >
                            <ChevronUp size={14} />
                          </MoveButton>
                          <MoveButton
                            onClick={() => handleMoveDown(cat, 'column3')}
                            disabled={index === tempColumnSettings.column3.length - 1}
                            title="아래로 이동"
                          >
                            <ChevronDown size={14} />
                          </MoveButton>
                          <CategorySelect
                            value="column3"
                            onChange={(e) => handleMoveCategory(cat, 'column3', e.target.value)}
                          >
                            <option value="column1">→ 1열</option>
                            <option value="column2">→ 2열</option>
                            <option value="column3">3열</option>
                            <option value="column4">→ 4열</option>
                          </CategorySelect>
                        </CategoryActions>
                      </CategoryItem>
                    ))}
                    {(!tempColumnSettings.column3 || tempColumnSettings.column3.length === 0) && (
                      <div style={{ color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center', padding: '1rem' }}>
                        항목 없음
                      </div>
                    )}
                  </ColumnSettingsColumn>

                  {/* 4열 */}
                  <ColumnSettingsColumn>
                    <ColumnSettingsTitle>4열 - {tempColumnSettings.column4?.length || 0}개</ColumnSettingsTitle>
                    {tempColumnSettings.column4?.map((cat, index) => (
                      <CategoryItem key={cat}>
                        <CategoryName title={cat}>{cat}</CategoryName>
                        <CategoryActions>
                          <MoveButton
                            onClick={() => handleMoveUp(cat, 'column4')}
                            disabled={index === 0}
                            title="위로 이동"
                          >
                            <ChevronUp size={14} />
                          </MoveButton>
                          <MoveButton
                            onClick={() => handleMoveDown(cat, 'column4')}
                            disabled={index === tempColumnSettings.column4.length - 1}
                            title="아래로 이동"
                          >
                            <ChevronDown size={14} />
                          </MoveButton>
                          <CategorySelect
                            value="column4"
                            onChange={(e) => handleMoveCategory(cat, 'column4', e.target.value)}
                          >
                            <option value="column1">→ 1열</option>
                            <option value="column2">→ 2열</option>
                            <option value="column3">→ 3열</option>
                            <option value="column4">4열</option>
                          </CategorySelect>
                        </CategoryActions>
                      </CategoryItem>
                    ))}
                    {(!tempColumnSettings.column4 || tempColumnSettings.column4.length === 0) && (
                      <div style={{ color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center', padding: '1rem' }}>
                        항목 없음
                      </div>
                    )}
                  </ColumnSettingsColumn>
                </ColumnSettingsContainer>
              </SettingsModalBody>

              <SettingsModalFooter>
                <SettingsModalButton className="secondary" onClick={handleCloseColumnSettings}>
                  취소
                </SettingsModalButton>
                <SettingsModalButton className="primary" onClick={handleSaveColumnSettings}>
                  저장
                </SettingsModalButton>
              </SettingsModalFooter>
            </SettingsModalContent>
          </SettingsModalOverlay>
        )}
      </AnimatePresence>

      {/* 피봇 설정 모달 */}
      <AnimatePresence>
        {showPivotSettings && (
          <SettingsModalOverlay
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClosePivotSettings}
          >
            <SettingsModalContent
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <SettingsModalHeader>
                <SettingsModalTitle>
                  <Table2 size={18} />
                  피봇 보기 축 순서 설정
                </SettingsModalTitle>
                <CloseButton onClick={handleClosePivotSettings}>
                  <X size={18} />
                </CloseButton>
              </SettingsModalHeader>

              <SettingsModalBody>
                <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem' }}>
                  가로축과 세로축의 값 순서를 설정하세요. ▲▼ 버튼으로 순서를 변경할 수 있습니다.
                </p>

                <PivotSettingsContainer>
                  {/* 가로축 설정 */}
                  <PivotSettingsSection>
                    <PivotSettingsSectionTitle>
                      <span style={{ color: '#3b82f6' }}>→</span>
                      가로축: {PIVOT_FIELD_OPTIONS.find(o => o.value === pivotXAxisField)?.label}
                    </PivotSettingsSectionTitle>
                    <PivotAxisOrderList>
                      {(tempPivotSettings.xAxisOrder || []).map((value, index) => (
                        <PivotAxisOrderItem key={value}>
                          <span style={{ color: '#94a3b8', fontSize: '0.7rem', minWidth: '20px' }}>{index + 1}.</span>
                          <span style={{ flex: 1 }}>{value}</span>
                          <PivotAxisOrderActions>
                            <MoveButton
                              onClick={() => handlePivotOrderUp('xAxis', value)}
                              disabled={index === 0}
                              title="위로 이동"
                            >
                              <ChevronUp size={14} />
                            </MoveButton>
                            <MoveButton
                              onClick={() => handlePivotOrderDown('xAxis', value)}
                              disabled={index === (tempPivotSettings.xAxisOrder || []).length - 1}
                              title="아래로 이동"
                            >
                              <ChevronDown size={14} />
                            </MoveButton>
                          </PivotAxisOrderActions>
                        </PivotAxisOrderItem>
                      ))}
                      {(!tempPivotSettings.xAxisOrder || tempPivotSettings.xAxisOrder.length === 0) && (
                        <div style={{ color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center', padding: '1rem' }}>
                          항목 없음
                        </div>
                      )}
                    </PivotAxisOrderList>
                  </PivotSettingsSection>

                  {/* 세로축 설정 */}
                  <PivotSettingsSection>
                    <PivotSettingsSectionTitle>
                      <span style={{ color: '#10b981' }}>↓</span>
                      세로축: {PIVOT_FIELD_OPTIONS.find(o => o.value === pivotYAxisField)?.label}
                    </PivotSettingsSectionTitle>
                    <PivotAxisOrderList>
                      {(tempPivotSettings.yAxisOrder || []).map((value, index) => (
                        <PivotAxisOrderItem key={value}>
                          <span style={{ color: '#94a3b8', fontSize: '0.7rem', minWidth: '20px' }}>{index + 1}.</span>
                          <span style={{ flex: 1 }}>{value}</span>
                          <PivotAxisOrderActions>
                            <MoveButton
                              onClick={() => handlePivotOrderUp('yAxis', value)}
                              disabled={index === 0}
                              title="위로 이동"
                            >
                              <ChevronUp size={14} />
                            </MoveButton>
                            <MoveButton
                              onClick={() => handlePivotOrderDown('yAxis', value)}
                              disabled={index === (tempPivotSettings.yAxisOrder || []).length - 1}
                              title="아래로 이동"
                            >
                              <ChevronDown size={14} />
                            </MoveButton>
                          </PivotAxisOrderActions>
                        </PivotAxisOrderItem>
                      ))}
                      {(!tempPivotSettings.yAxisOrder || tempPivotSettings.yAxisOrder.length === 0) && (
                        <div style={{ color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center', padding: '1rem' }}>
                          항목 없음
                        </div>
                      )}
                    </PivotAxisOrderList>
                  </PivotSettingsSection>
                </PivotSettingsContainer>
              </SettingsModalBody>

              <SettingsModalFooter>
                <SettingsModalButton className="secondary" onClick={handleClosePivotSettings}>
                  취소
                </SettingsModalButton>
                <SettingsModalButton className="primary" onClick={handleSavePivotSettings}>
                  저장
                </SettingsModalButton>
              </SettingsModalFooter>
            </SettingsModalContent>
          </SettingsModalOverlay>
        )}
      </AnimatePresence>
    </Container>
  );
};

export default AllProjectsView;
