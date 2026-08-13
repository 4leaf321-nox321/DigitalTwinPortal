import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { Building2, Target, FileText, BarChart3, X, Users, FolderKanban, User, Download, Network, ArrowDownWideNarrow, GitMerge } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { todayLocalYmd } from '../../../../shared/utils/localDate';

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

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem 2rem;
  display: flex;
  flex-direction: row;
  gap: 1.5rem;

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

const OverviewSection = styled.div`
  background: white;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid #e2e8f0;
  flex: 4;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }
`;

const DepartmentPanel = styled.div`
  background: white;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid #e2e8f0;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const DepartmentListContainer = styled.div`
  overflow-y: auto;
  flex: 1;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  align-content: start;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }
`;

const PanelTitle = styled.h3`
  font-size: 1.125rem;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
`;

const DepartmentItem = styled(motion.div)`
  cursor: pointer;
  padding: 1rem;
  border-radius: 0.5rem;
  transition: all 0.2s ease;
  border: 2px solid ${props => props.isSelected ? '#3b82f6' : 'transparent'};
  background: ${props => props.isSelected ? '#eff6ff' : 'transparent'};
  height: fit-content;

  &:hover {
    background: #f8fafc;
  }
`;

const DepartmentName = styled.div`
  font-size: 0.875rem;
  font-weight: 600;
  color: #334155;
  margin-bottom: 0.5rem;
`;

const DepartmentStats = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 0.75rem;
  font-size: 0.75rem;
  color: #64748b;
`;

const StatItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const BarChart = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
  height: 40px;
`;

const Bar = styled.div`
  flex: 1;
  background: ${props => props.color};
  border-radius: 0.25rem 0.25rem 0 0;
  height: ${props => props.height}%;
  min-height: 4px;
  position: relative;
  transition: all 0.3s ease;

  &:hover {
    opacity: 0.8;
  }
`;

const BarLabel = styled.div`
  position: absolute;
  top: -20px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.75rem;
  font-weight: 600;
  color: #1e293b;
  white-space: nowrap;
`;

const BarLegend = styled.div`
  display: flex;
  gap: 0.75rem;
  margin-top: 0.5rem;
  font-size: 0.7rem;
  color: #64748b;
`;

const LegendItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const LegendColor = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: ${props => props.color};
`;

const ProjectList = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;

  @media (max-width: 1400px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const ProjectCard = styled(motion.div)`
  background: ${props =>
    props.$updateRecency === 'week' ? 'rgba(59, 130, 246, 0.02)' :
    props.$updateRecency === 'month' ? 'rgba(16, 185, 129, 0.02)' :
    '#f8fafc'};
  border: ${props =>
    props.$updateRecency === 'week' ? '2px solid #3b82f6' :
    props.$updateRecency === 'month' ? '2px solid #10b981' :
    '1px solid #e2e8f0'};
  border-radius: 0.5rem;
  padding: 1rem;
  transition: all 0.2s ease;
  ${props => props.$updateRecency === 'week' && `
    box-shadow: 0 0 12px rgba(59, 130, 246, 0.3);
  `}
  ${props => props.$updateRecency === 'month' && `
    box-shadow: 0 0 12px rgba(16, 185, 129, 0.3);
  `}

  &:hover {
    border-color: ${props =>
      props.$updateRecency === 'week' ? '#2563eb' :
      props.$updateRecency === 'month' ? '#059669' :
      '#cbd5e1'};
    box-shadow: ${props =>
      props.$updateRecency === 'week' ? '0 4px 16px rgba(59, 130, 246, 0.4)' :
      props.$updateRecency === 'month' ? '0 4px 16px rgba(16, 185, 129, 0.4)' :
      '0 2px 8px rgba(0, 0, 0, 0.08)'};
  }
`;

const ProjectTitle = styled.div`
  font-size: 0.9rem;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 0.5rem;
`;

const ProjectMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
`;

const MetaBadge = styled.span`
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.7rem;
  font-weight: 500;
  background: ${props => props.bg || '#e2e8f0'};
  color: ${props => props.color || '#475569'};
`;

const PerformanceCount = styled.div`
  font-size: 0.75rem;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const ProgressContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
`;

const ProgressLabel = styled.div`
  font-size: 0.7rem;
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
  background: ${props => props.filled ? '#3b82f6' : '#e2e8f0'};
  transition: background 0.3s ease;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem 1rem;
  color: #94a3b8;
  font-size: 0.875rem;
`;

const OverviewChartContainer = styled.div`
  margin-top: 0.5rem;
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  grid-auto-rows: minmax(290px, auto);
  gap: 1.5rem;
  padding: 0.5rem 0.5rem;
  align-items: start;
  overflow: visible;

  /* 한 줄에 최대 5개로 제한 */
  @media (min-width: 1800px) {
    grid-template-columns: repeat(5, 1fr);
  }
`;

const DonutChartWrapper = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  overflow: visible;
`;

const DonutSVG = styled.svg`
  overflow: visible;
`;

const DonutSegment = styled(motion.path)`
  cursor: pointer;
  transition: opacity 0.2s ease;
  will-change: opacity;

  &:hover {
    opacity: 0.8;
  }
`;

const SegmentLabel = styled(motion.text)`
  font-size: 0.875rem;
  font-weight: 700;
  fill: #1e293b;
  stroke: white;
  stroke-width: 3px;
  paint-order: stroke;
  pointer-events: none;
  text-anchor: middle;
  dominant-baseline: middle;
`;

const LeaderLine = styled(motion.polyline)`
  fill: none;
  stroke: ${props => props.$color || '#64748b'};
  stroke-width: 1.5;
  opacity: 0.7;
`;

const OuterLabel = styled(motion.text)`
  font-size: 0.95rem;
  font-weight: 600;
  fill: #1e293b;
  pointer-events: none;
  dominant-baseline: middle;
`;

const SegmentCount = styled(motion.text)`
  font-size: 0.85rem;
  font-weight: 700;
  fill: #1e293b;
  stroke: white;
  stroke-width: 3px;
  paint-order: stroke;
  pointer-events: none;
  text-anchor: middle;
  dominant-baseline: middle;
`;

const CenterLabel = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
`;

const DivisionTitle = styled.div`
  font-size: 1.5rem;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 0.5rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    opacity: 0.7;
    transform: scale(1.02);
  }
`;

const TotalCount = styled.div`
  font-size: 3rem;
  font-weight: 700;
  color: #1e293b;
  line-height: 1;
`;

const TotalLabel = styled.div`
  font-size: 1rem;
  color: #64748b;
  margin-top: 0.5rem;
`;

const TooltipContainer = styled(motion.div)`
  position: fixed;
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  pointer-events: none;
  z-index: 10000;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
`;

const TooltipDepartment = styled.div`
  font-weight: 700;
  margin-bottom: 0.25rem;
`;

const TooltipInfo = styled.div`
  font-size: 0.75rem;
  opacity: 0.9;
`;

const ChartLegend = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1rem;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid #e2e8f0;
`;

const ChartLegendItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: #64748b;
`;

const ChartLegendColor = styled.div`
  width: 16px;
  height: 16px;
  border-radius: 0.25rem;
  background: ${props => props.color};
`;

const InfoNote = styled.div`
  position: absolute;
  top: 1.25rem;
  right: 1.5rem;
  font-size: 0.75rem;
  color: #64748b;
  font-style: italic;
`;

const ModalOverlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 2rem;
`;

const ModalContent = styled(motion.div)`
  background: white;
  border-radius: 1rem;
  padding: 2rem;
  width: 70vw;
  height: 70vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  position: relative;
  display: flex;
  flex-direction: column;

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

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #e2e8f0;
`;

const ModalTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 700;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const CloseButton = styled.button`
  background: #f1f5f9;
  border: none;
  border-radius: 0.5rem;
  padding: 0.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;

  &:hover {
    background: #e2e8f0;
  }
`;

const LegendNote = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: #64748b;
  margin-bottom: 1rem;
  padding: 0.5rem 0.75rem;
  background: #f8fafc;
  border-radius: 0.375rem;
  border: 1px solid #e2e8f0;
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

const StatusFilterBar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  font-size: 0.8rem;
  color: #64748b;
  margin-bottom: 1rem;
  padding: 0.5rem 0.75rem;
  background: #f8fafc;
  border-radius: 0.375rem;
  border: 1px solid #e2e8f0;
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

const PersonnelContent = styled.div`
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

const PersonnelSection = styled.div`
  background: white;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid #e2e8f0;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const PersonnelGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
  overflow-y: auto;
  padding: 0.5rem;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
  }
`;

const DepartmentCard = styled(motion.div)`
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  padding: 1.25rem;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: #cbd5e1;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }
`;

const DepartmentCardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
`;

const DepartmentCardTitle = styled.div`
  font-size: 1rem;
  font-weight: 700;
  color: #1e293b;
`;

const PersonnelCount = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.5rem;
  font-weight: 700;
  color: #3b82f6;
`;

const PersonnelList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
`;

const PersonnelBadge = styled.span`
  padding: 0.25rem 0.5rem;
  background: ${props => props.$isLeader ? '#fef3c7' : '#e0f2fe'};
  color: ${props => props.$isLeader ? '#92400e' : '#0369a1'};
  border: 1px solid ${props => props.$isLeader ? '#fcd34d' : '#7dd3fc'};
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 500;
`;

const PersonnelSummary = styled.div`
  display: flex;
  gap: 2rem;
  padding: 1rem 1.5rem;
  background: #f8fafc;
  border-radius: 0.5rem;
  margin-bottom: 1rem;
`;

const SummaryItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const SummaryLabel = styled.span`
  font-size: 0.875rem;
  color: #64748b;
`;

const SummaryValue = styled.span`
  font-size: 1.25rem;
  font-weight: 700;
  color: #1e293b;
`;

// 와플 차트 관련 스타일
const WaffleChartsContainer = styled.div`
  column-count: 3;
  column-gap: 1.5rem;
  width: 100%;

  @media (max-width: 1400px) {
    column-count: 2;
  }

  @media (max-width: 900px) {
    column-count: 1;
  }
`;

const WaffleChartCard = styled.div`
  break-inside: avoid;
  margin-bottom: 1.5rem;
  background: white;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid #e2e8f0;
`;

const WaffleChartHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #e2e8f0;
`;

const WaffleChartTitle = styled.h3`
  font-size: 1.125rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const WaffleChartCount = styled.span`
  font-size: 1rem;
  font-weight: 600;
  color: #64748b;
`;

const WaffleGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 4px;
  margin-bottom: 1rem;
`;

const WaffleCell = styled.div`
  aspect-ratio: 1;
  border-radius: 4px;
  background: ${props => props.$color || '#f1f5f9'};
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  cursor: ${props => props.$filled ? 'pointer' : 'default'};

  &:hover {
    transform: ${props => props.$filled ? 'scale(1.1)' : 'none'};
    z-index: ${props => props.$filled ? '1' : '0'};
  }

  svg {
    width: 60%;
    height: 60%;
    color: ${props => props.$iconColor || 'white'};
  }
`;

const WaffleLegend = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #f1f5f9;
`;

const WaffleLegendItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: #475569;
`;

const WaffleLegendColor = styled.div`
  width: 16px;
  height: 16px;
  border-radius: 4px;
  background: ${props => props.$color};
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    width: 10px;
    height: 10px;
    color: white;
  }
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
    box-shadow: none;
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

// ===== 그룹별 과제 상세 (Upset Plot) 스타일 =====
// 사업부 필터 탭 - KPI 대시보드와 동일한 형태
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

const UpsetContent = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 1.5rem 2rem;
  display: flex;
  flex-direction: column;

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

const UpsetSection = styled.div`
  background: white;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 820px;
`;

const UpsetControls = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
`;

const UpsetChartScroll = styled.div`
  flex: 1;
  min-height: 480px;
  overflow: auto;
  padding-bottom: 0.5rem;

  &::-webkit-scrollbar {
    width: 8px;
    height: 8px;
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

const UpsetColumnHit = styled.rect`
  cursor: pointer;
`;

const UpsetSetLabel = styled.text`
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
`;

// SVG 텍스트 폭 추정 (한글/CJK는 폰트 크기와 거의 동일, 영문·숫자는 약 0.58배)
const estimateTextWidth = (text, fontSize) => {
  let width = 0;
  for (const ch of String(text)) {
    const code = ch.codePointAt(0);
    width += code > 0x2E80 ? fontSize * 1.02 : fontSize * 0.58;
  }
  return width;
};

const UpsetNote = styled.div`
  font-size: 0.75rem;
  color: #64748b;
  font-style: italic;
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const DepartmentStatus = ({ projects, statusColors, divisionColors, currentYear, onYearChange, settingsData = {}, isAdmin = false }) => {
  const { user } = useAuth();
  // 로컬 저장 권한: Admin, Manager, DT Office만 허용
  const canExport = ['admin', 'manager', 'dt_office'].includes(user?.role) || user?.is_admin;
  const [viewMode, setViewMode] = useState('project'); // 'project' | 'personnel' | 'group'
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [selectedDivision, setSelectedDivision] = useState(null);
  const [hoveredSegment, setHoveredSegment] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  // 그룹별 과제 상세(Upset Plot) 상태
  const [upsetDivision, setUpsetDivision] = useState('all'); // 사업부 탭
  const [upsetSort, setUpsetSort] = useState('count'); // 'count' | 'degree'
  const [collabOnly, setCollabOnly] = useState(false); // 2개 이상 조직 조합만 보기
  const [hoveredCombo, setHoveredCombo] = useState(null);
  const [selectedCombo, setSelectedCombo] = useState(null); // { key, departments, projects }
  const [upsetBox, setUpsetBox] = useState({ width: 0, height: 0 }); // 차트 영역 실측 크기

  // 차트 영역 크기 관찰 (남는 공간만큼 SVG를 키우기 위함)
  const upsetResizeObserver = useRef(null);
  const upsetScrollRef = useCallback((node) => {
    if (upsetResizeObserver.current) {
      upsetResizeObserver.current.disconnect();
      upsetResizeObserver.current = null;
    }
    if (!node || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setUpsetBox(prev => (
        Math.abs(prev.width - rect.width) < 1 && Math.abs(prev.height - rect.height) < 1
          ? prev
          : { width: rect.width, height: rect.height }
      ));
    });
    observer.observe(node);
    upsetResizeObserver.current = observer;
  }, []);

  useEffect(() => () => upsetResizeObserver.current?.disconnect(), []);
  const [selectedProjectStatuses, setSelectedProjectStatuses] = useState(new Set()); // 과제 상태 (진행상태) 필터
  const [statusInitialized, setStatusInitialized] = useState(false);

  // 과제 상태(진행상태) 목록
  const availableProjectStatuses = useMemo(() => {
    const statuses = (settingsData.statuses || []).map(s => ({ name: s.name, color: s.color }));
    if (statuses.length > 0) return statuses;
    return [...new Set(projects.filter(p => p.진행상태).map(p => p.진행상태))].sort().map(name => ({ name, color: '#64748b' }));
  }, [settingsData, projects]);

  // 초기 로드 시 "취소"를 제외한 모든 상태 선택
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

  // 과제 상태 필터 적용된 과제 목록
  const filteredProjects = useMemo(() => {
    if (selectedProjectStatuses.size === 0) return projects;
    return projects.filter(project => selectedProjectStatuses.has(project.진행상태));
  }, [projects, selectedProjectStatuses]);

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

  // 시스템 설정에서 부서-사업부 매핑 생성
  const departmentToDivisionMap = useMemo(() => {
    const map = {};
    const departments = settingsData.departments || [];
    const divisions = settingsData.divisions || [];

    // division ID to name 매핑
    const divisionIdToName = {};
    divisions.forEach(div => {
      divisionIdToName[div.id] = div.name;
    });

    // department name to division name 매핑
    departments.forEach(dept => {
      if (dept.divisionId && divisionIdToName[dept.divisionId]) {
        map[dept.name] = divisionIdToName[dept.divisionId];
      } else {
        map[dept.name] = '공통';
      }
    });

    return map;
  }, [settingsData]);

  // 부서별 통계 계산
  const departmentStats = useMemo(() => {
    const stats = {};

    filteredProjects.forEach(project => {
      if (project.담당부서목록 && Array.isArray(project.담당부서목록)) {
        project.담당부서목록.forEach(dept => {
          if (!stats[dept]) {
            stats[dept] = {
              name: dept,
              projectCount: 0,
              performanceCount: 0,
              projects: []
            };
          }
          stats[dept].projectCount++;
          stats[dept].performanceCount += (project.성과목록?.length || 0);
          stats[dept].projects.push(project);
        });
      }
    });

    // 과제수 기준으로 내림차순 정렬
    return Object.values(stats).sort((a, b) => b.projectCount - a.projectCount);
  }, [filteredProjects]);

  // 부서별 인력 통계 계산
  const personnelStats = useMemo(() => {
    const stats = {};
    const allPersonnel = new Set(); // 전체 고유 인력

    projects.forEach(project => {
      if (project.과제참여인력목록 && Array.isArray(project.과제참여인력목록)) {
        project.과제참여인력목록.forEach(person => {
          const dept = person.부서 || '미지정';
          const name = person.이름 || person.name || '이름없음';
          const isLeader = person.역할 === 'PL' || person.역할 === '과제PL' || person.isPL;

          if (!stats[dept]) {
            stats[dept] = {
              name: dept,
              personnelCount: 0,
              personnel: new Map(), // 이름으로 중복 제거
              projectCount: 0,
              projects: new Set()
            };
          }

          // 인력 추가 (중복 제거)
          if (!stats[dept].personnel.has(name)) {
            stats[dept].personnel.set(name, { name, isLeader, projectCount: 1 });
          } else {
            const existing = stats[dept].personnel.get(name);
            existing.projectCount++;
            if (isLeader) existing.isLeader = true;
          }

          // 과제 추가
          stats[dept].projects.add(project.id);

          // 전체 인력에 추가
          allPersonnel.add(`${dept}-${name}`);
        });
      }
    });

    // Map을 배열로 변환하고 정렬
    const result = Object.values(stats).map(dept => ({
      ...dept,
      personnelCount: dept.personnel.size,
      personnel: Array.from(dept.personnel.values()).sort((a, b) => {
        // PL 먼저, 그 다음 이름순
        if (a.isLeader && !b.isLeader) return -1;
        if (!a.isLeader && b.isLeader) return 1;
        return a.name.localeCompare(b.name);
      }),
      projectCount: dept.projects.size
    }));

    // 인력수 기준으로 내림차순 정렬
    return {
      departments: result.sort((a, b) => b.personnelCount - a.personnelCount),
      totalPersonnel: allPersonnel.size,
      totalDepartments: result.length
    };
  }, [projects]);

  // 사업부별 인력 통계 (와플 차트용) - 시스템 설정 기준
  const divisionPersonnelStats = useMemo(() => {
    // 시스템 설정에서 사업부 목록 가져오기
    const divisions = settingsData.divisions || [];
    const departments = settingsData.departments || [];

    // divisionId -> division name 매핑
    const divisionIdToName = {};
    divisions.forEach(div => {
      divisionIdToName[div.id] = div.name;
    });

    // department name -> division name 매핑
    const deptToDivision = {};
    departments.forEach(dept => {
      if (dept.divisionId && divisionIdToName[dept.divisionId]) {
        deptToDivision[dept.name] = divisionIdToName[dept.divisionId];
      } else {
        deptToDivision[dept.name] = '공통';
      }
    });

    // 시스템 설정의 사업부별로 통계 초기화
    const divisionStats = {};
    divisions.forEach(div => {
      divisionStats[div.name] = {
        name: div.name,
        departments: {},
        totalCount: 0,
        allPersonnel: new Set()
      };
    });
    // 공통 부서용 추가
    divisionStats['공통'] = {
      name: '공통',
      departments: {},
      totalCount: 0,
      allPersonnel: new Set()
    };

    // 인력 집계 (부서의 소속 사업부 기준)
    projects.forEach(project => {
      if (project.과제참여인력목록 && Array.isArray(project.과제참여인력목록)) {
        project.과제참여인력목록.forEach(person => {
          const dept = person.부서 || '미지정';
          const name = person.이름 || person.name || '이름없음';
          const personKey = `${dept}-${name}`;

          // 부서의 소속 사업부 찾기
          const division = deptToDivision[dept] || '공통';

          // 해당 사업부가 없으면 생성
          if (!divisionStats[division]) {
            divisionStats[division] = {
              name: division,
              departments: {},
              totalCount: 0,
              allPersonnel: new Set()
            };
          }

          // 이미 카운트된 인력인지 확인
          if (!divisionStats[division].allPersonnel.has(personKey)) {
            divisionStats[division].allPersonnel.add(personKey);
            divisionStats[division].totalCount++;

            if (!divisionStats[division].departments[dept]) {
              divisionStats[division].departments[dept] = {
                name: dept,
                count: 0
              };
            }
            divisionStats[division].departments[dept].count++;
          }
        });
      }
    });

    // 결과 변환 (인력이 있는 사업부만)
    const result = Object.values(divisionStats).map(div => ({
      name: div.name,
      totalCount: div.totalCount,
      departments: Object.values(div.departments).sort((a, b) => b.count - a.count)
    })).filter(div => div.totalCount > 0);

    // 가장 큰 인력수 찾기
    const maxPersonnel = Math.max(...result.map(div => div.totalCount), 0);

    // 10의 배수 중 maxPersonnel보다 큰 가장 작은 수
    const gridSize = Math.ceil(maxPersonnel / 10) * 10 || 10;

    // 사업부 정렬 순서
    const divisionOrder = ['MX', 'VD', 'DA', 'NW', '의료기기', 'SR', 'GTR', 'CS'];
    const getOrderIndex = (name) => {
      const upperName = name.toUpperCase();
      const index = divisionOrder.findIndex(d => d.toUpperCase() === upperName);
      return index === -1 ? 999 : index;
    };

    return {
      divisions: result.sort((a, b) => getOrderIndex(a.name) - getOrderIndex(b.name)),
      maxPersonnel,
      gridSize
    };
  }, [projects, settingsData]);

  // 부서별 색상 생성 (와플 차트용)
  const departmentColors = useMemo(() => {
    const colors = [
      '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
      '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
      '#14b8a6', '#a855f7', '#eab308', '#22c55e', '#0ea5e9'
    ];

    const allDepts = new Set();
    divisionPersonnelStats.divisions.forEach(div => {
      div.departments.forEach(dept => allDepts.add(dept.name));
    });

    const colorMap = {};
    Array.from(allDepts).forEach((dept, index) => {
      colorMap[dept] = colors[index % colors.length];
    });

    return colorMap;
  }, [divisionPersonnelStats]);

  // 최대값 계산 (막대그래프 높이 계산용)
  const maxCount = useMemo(() => {
    if (departmentStats.length === 0) return 1;
    return Math.max(
      ...departmentStats.map(dept => Math.max(dept.projectCount, dept.performanceCount))
    );
  }, [departmentStats]);

  // 전체 과제 현황 차트 데이터 (부서별, 사업부별 집계)
  const overviewChartData = useMemo(() => {
    const deptData = {};

    filteredProjects.forEach(project => {
      if (project.담당부서목록 && Array.isArray(project.담당부서목록)) {
        project.담당부서목록.forEach(dept => {
          if (!deptData[dept]) {
            deptData[dept] = {
              name: dept,
              totalCount: 0,
              divisions: {}
            };
          }

          const division = project.사업부 || '미분류';
          if (!deptData[dept].divisions[division]) {
            deptData[dept].divisions[division] = 0;
          }

          deptData[dept].divisions[division]++;
          deptData[dept].totalCount++;
        });
      }
    });

    // 과제 수 기준으로 정렬
    const sorted = Object.values(deptData).sort((a, b) => b.totalCount - a.totalCount);

    return sorted;
  }, [filteredProjects]);

  // 최대 과제 수 계산 (차트 높이용)
  const maxProjectCount = useMemo(() => {
    if (overviewChartData.length === 0) return 1;
    return Math.max(...overviewChartData.map(dept => dept.totalCount));
  }, [overviewChartData]);

  // 사업부 목록 추출 (범례용)
  const divisionsInChart = useMemo(() => {
    const divisions = new Set();
    overviewChartData.forEach(dept => {
      Object.keys(dept.divisions).forEach(div => divisions.add(div));
    });
    return Array.from(divisions);
  }, [overviewChartData]);

  // 사업부별 도넛 차트 데이터
  const divisionDonutData = useMemo(() => {
    // 사업부별로 부서와 과제 수 집계
    const divisionData = {};

    filteredProjects.forEach(project => {
      const division = project.사업부 || '미분류';

      if (!divisionData[division]) {
        divisionData[division] = {
          name: division,
          totalCount: 0,
          uniqueProjectCount: 0,
          departments: {},
          projectIds: new Set()
        };
      }

      // 고유 과제 수 계산 (중복 제거)
      if (!divisionData[division].projectIds.has(project.id)) {
        divisionData[division].projectIds.add(project.id);
        divisionData[division].uniqueProjectCount++;
      }

      if (project.담당부서목록 && Array.isArray(project.담당부서목록)) {
        project.담당부서목록.forEach(dept => {
          if (!divisionData[division].departments[dept]) {
            divisionData[division].departments[dept] = 0;
          }
          divisionData[division].departments[dept]++;
          divisionData[division].totalCount++;
        });
      }
    });

    // 각 사업부별로 도넛 차트 세그먼트 생성
    const divisions = Object.values(divisionData).map(division => {
      let currentAngle = 0;

      // 부서별 색상 팔레트 생성 (HSL 기반)
      const deptNames = Object.keys(division.departments);
      const segments = deptNames.map((dept, index) => {
        const count = division.departments[dept];
        const percentage = (count / division.totalCount) * 100;
        const startAngle = currentAngle;
        const endAngle = currentAngle + (percentage / 100) * 360;
        currentAngle = endAngle;

        // 부서별로 다른 색상 생성
        const hue = (index * 360 / deptNames.length) % 360;
        const color = `hsl(${hue}, 65%, 55%)`;

        return {
          department: dept,
          count,
          percentage,
          startAngle,
          endAngle,
          color
        };
      });

      return {
        division: division.name,
        totalCount: division.totalCount,
        uniqueProjectCount: division.uniqueProjectCount,
        segments,
        baseColor: divisionColors[division.name] || '#94a3b8'
      };
    });

    // 지정된 순서로 정렬
    const divisionOrder = ['mx', 'vd', 'da', 'nw', '의료기기', 'gtr'];
    return divisions.sort((a, b) => {
      const indexA = divisionOrder.indexOf(a.division.toLowerCase());
      const indexB = divisionOrder.indexOf(b.division.toLowerCase());

      // 둘 다 리스트에 있는 경우
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      // a만 리스트에 있는 경우
      if (indexA !== -1) return -1;
      // b만 리스트에 있는 경우
      if (indexB !== -1) return 1;
      // 둘 다 리스트에 없는 경우 이름순 정렬
      return a.division.localeCompare(b.division);
    });
  }, [filteredProjects, divisionColors]);

  // ===================== 그룹별 과제 상세 (Upset Plot) =====================
  // 사업부 탭 목록 (시스템 설정 순서 유지)
  const upsetDivisionTabs = useMemo(() => {
    const found = new Set();
    filteredProjects.forEach(p => found.add(p.사업부 || '미분류'));
    const order = (settingsData.divisions || []).map(d => d.name);
    const ordered = order.filter(d => found.has(d));
    const extra = [...found].filter(d => !order.includes(d)).sort();
    return [...ordered, ...extra];
  }, [filteredProjects, settingsData]);

  const getUpsetDivisionCount = (division) =>
    filteredProjects.filter(p => (p.사업부 || '미분류') === division).length;

  // 선택된 사업부 탭이 적용된 과제 목록
  const upsetProjects = useMemo(() => {
    if (upsetDivision === 'all') return filteredProjects;
    return filteredProjects.filter(p => (p.사업부 || '미분류') === upsetDivision);
  }, [filteredProjects, upsetDivision]);

  // Upset Plot 데이터 (조직 = 담당부서, 조합 = 과제를 함께 수행하는 조직 집합)
  const upsetData = useMemo(() => {
    const MAX_SETS = 20;   // 표시할 조직(행) 최대 개수
    const MAX_COMBOS = 30; // 표시할 조합(열) 최대 개수

    const setCounts = new Map();
    const withOrg = [];
    let noOrgCount = 0;

    upsetProjects.forEach(project => {
      const orgs = Array.from(new Set(
        (project.담당부서목록 || [])
          .map(d => (typeof d === 'string' ? d.trim() : d?.name || ''))
          .filter(Boolean)
      ));
      if (orgs.length === 0) {
        noOrgCount++;
        return;
      }
      withOrg.push({ project, orgs });
      orgs.forEach(o => setCounts.set(o, (setCounts.get(o) || 0) + 1));
    });

    // 조직(행): 과제 수 기준 상위 MAX_SETS개
    const allSets = Array.from(setCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    const sets = allSets.slice(0, MAX_SETS);
    const setNames = new Set(sets.map(s => s.name));
    const hiddenSetCount = allSets.length - sets.length;
    const setIndexMap = {};
    sets.forEach((s, i) => { setIndexMap[s.name] = i; });

    // 조합(열): 표시 대상 조직만으로 구성한 교집합
    // + 조직별 지표(단독/협업, 평균 진척률, 진행상태 분포)를 같은 순회에서 집계
    const comboMap = new Map();
    let excludedByHiddenSets = 0;

    const setMetrics = {};
    sets.forEach(s => {
      setMetrics[s.name] = { solo: 0, collab: 0, progressSum: 0, progressCount: 0, statusCounts: {} };
    });

    withOrg.forEach(({ project, orgs }) => {
      const visible = orgs
        .filter(o => setNames.has(o))
        .sort((a, b) => setIndexMap[a] - setIndexMap[b]);
      if (visible.length === 0) {
        excludedByHiddenSets++;
        return;
      }
      const key = visible.join(' ∩ ');
      if (!comboMap.has(key)) {
        comboMap.set(key, { key, departments: visible, projects: [], divisions: {} });
      }
      const combo = comboMap.get(key);
      combo.projects.push(project);
      const div = project.사업부 || '미분류';
      combo.divisions[div] = (combo.divisions[div] || 0) + 1;

      // 조직별 지표 누적 (조합 표시 필터와 무관하게 항상 전체 기준)
      const progress = calculateProgress(project);
      const status = project.진행상태 || '미지정';
      visible.forEach(org => {
        const m = setMetrics[org];
        if (!m) return;
        if (visible.length === 1) m.solo++;
        else m.collab++;
        m.progressSum += progress;
        m.progressCount++;
        m.statusCounts[status] = (m.statusCounts[status] || 0) + 1;
      });
    });

    const setsWithMetrics = sets.map(s => {
      const m = setMetrics[s.name];
      return {
        ...s,
        solo: m.solo,
        collab: m.collab,
        avgProgress: m.progressCount > 0 ? Math.round(m.progressSum / m.progressCount) : 0,
        statusCounts: m.statusCounts,
        statusTotal: Object.values(m.statusCounts).reduce((a, b) => a + b, 0)
      };
    });

    let combos = Array.from(comboMap.values()).map(c => ({
      ...c,
      count: c.projects.length,
      degree: c.departments.length
    }));

    const totalComboCount = combos.length;
    if (collabOnly) combos = combos.filter(c => c.degree > 1);
    const filteredComboCount = combos.length;

    combos.sort((a, b) => {
      if (upsetSort === 'degree') {
        return a.degree - b.degree || b.count - a.count || a.key.localeCompare(b.key);
      }
      return b.count - a.count || a.degree - b.degree || a.key.localeCompare(b.key);
    });

    const shownCombos = combos.slice(0, MAX_COMBOS);
    const hiddenComboCount = filteredComboCount - shownCombos.length;

    // 사업부 스택 순서 (시스템 설정 순서 유지)
    const divOrder = (settingsData.divisions || []).map(d => d.name);
    const divisionsInPlot = new Set();
    shownCombos.forEach(c => Object.keys(c.divisions).forEach(d => divisionsInPlot.add(d)));
    const stackDivisions = [
      ...divOrder.filter(d => divisionsInPlot.has(d)),
      ...[...divisionsInPlot].filter(d => !divOrder.includes(d)).sort()
    ];

    const collabProjectCount = withOrg.filter(x => x.orgs.length > 1).length;

    return {
      sets: setsWithMetrics,
      combos: shownCombos,
      stackDivisions,
      maxSetCount: Math.max(...sets.map(s => s.count), 1),
      maxComboCount: Math.max(...shownCombos.map(c => c.count), 1),
      totalOrgCount: allSets.length,
      totalComboCount,
      hiddenSetCount,
      hiddenComboCount,
      excludedByHiddenSets,
      noOrgCount,
      collabProjectCount,
      totalProjectCount: upsetProjects.length
    };
  }, [upsetProjects, collabOnly, upsetSort, settingsData]);

  // Upset Plot 도형 좌표 상수
  const UPSET_SETBAR_W = 110;  // 조직별 과제 수 막대 영역
  const UPSET_GAP = 14;
  const UPSET_LABEL_FONT = 12; // 조직명(행) 폰트 크기(px)
  const UPSET_TOP_PAD = 24;    // 막대 위 숫자 레이블 공간

  // 우측 조직별 지표 패널 (매트릭스와 같은 행에 정렬)
  const UPSET_PANEL_GAP = 28;       // 매트릭스와 패널 사이 간격
  const UPSET_PANEL_STACK_W = 120;  // 단독/협업 스택 막대 폭
  const UPSET_PANEL_RATIO_X = 128;  // "9 / 4" 텍스트 시작
  const UPSET_PANEL_PROG_X = 196;   // 진척률 막대 시작
  const UPSET_PANEL_PROG_W = 56;
  const UPSET_PANEL_PROGTXT_X = 258;
  const UPSET_PANEL_STATUS_X = 300; // 진행상태 분포 막대 시작
  const UPSET_PANEL_STATUS_W = 76;
  const UPSET_PANEL_W = UPSET_PANEL_STATUS_X + UPSET_PANEL_STATUS_W;

  // 조직명이 잘리지 않도록 레이블 영역 폭을 가장 긴 이름에 맞춰 계산
  const UPSET_LABEL_W = useMemo(() => {
    const longest = Math.max(...upsetData.sets.map(s => estimateTextWidth(s.name, UPSET_LABEL_FONT)), 0);
    return Math.min(Math.max(Math.ceil(longest) + 20, 140), 480);
  }, [upsetData]);

  // 실측한 차트 영역을 꽉 채우도록 열 폭 / 행 높이 / 상단 막대 높이를 계산
  const { colW: UPSET_COL_W, rowH: UPSET_ROW_H, topBarH: UPSET_TOPBAR_H } = useMemo(() => {
    const comboCount = Math.max(upsetData.combos.length, 1);
    const setCount = Math.max(upsetData.sets.length, 1);

    // 가로: 고정 영역을 뺀 나머지를 조합 열이 균등하게 나눠 가짐
    const fixedW = UPSET_LABEL_W + UPSET_SETBAR_W + UPSET_GAP + UPSET_PANEL_GAP + UPSET_PANEL_W + 24;
    const availW = Math.max((upsetBox.width || 0) - fixedW, 0);
    const colW = Math.min(Math.max(Math.floor(availW / comboCount), 32), 140);

    // 세로: 상단 막대 40% / 행 영역 60%로 배분 (기준선 아래 여백 26px + 하단 축·범례 60px 확보)
    const availH = Math.max((upsetBox.height || 0) - UPSET_TOP_PAD - 26 - 60, 0);
    const topBarH = Math.min(Math.max(Math.floor(availH * 0.4), 170), 420);
    const rowH = Math.min(Math.max(Math.floor((availH - topBarH) / setCount), 28), 60);

    return { colW, rowH, topBarH };
  }, [upsetData, upsetBox, UPSET_LABEL_W]);

  const upsetGeom = useMemo(() => {
    const matrixX = UPSET_LABEL_W + UPSET_SETBAR_W + UPSET_GAP;
    // 상단 막대 기준선(UPSET_TOP_PAD + UPSET_TOPBAR_H) 아래로 여백을 두고 매트릭스 시작
    const matrixTop = UPSET_TOP_PAD + UPSET_TOPBAR_H + 26;
    const matrixW = Math.max(upsetData.combos.length, 1) * UPSET_COL_W;
    const panelX = matrixX + matrixW + UPSET_PANEL_GAP;
    const width = panelX + UPSET_PANEL_W + 20;
    const height = matrixTop + upsetData.sets.length * UPSET_ROW_H + 50;
    return { matrixX, matrixTop, matrixW, panelX, width, height };
  }, [upsetData, UPSET_LABEL_W, UPSET_COL_W, UPSET_ROW_H, UPSET_TOPBAR_H]);

  const handleComboHover = (e, combo) => {
    setTooltipPos({ x: e.clientX, y: e.clientY });
    setHoveredCombo(combo);
  };

  const handleComboClick = (combo) => {
    setSelectedCombo(combo);
    setSelectedDepartment(null);
    setSelectedDivision(null);
    setIsModalOpen(true);
  };

  // SVG 도넛 차트 path 생성 (12시 방향에서 시작하도록 -90도 오프셋 적용)
  const createArc = (startAngle, endAngle, outerRadius, innerRadius, centerX = 140, centerY = 140) => {
    // -90도 오프셋 적용 (12시 방향 시작)
    const adjustedStart = startAngle - 90;
    const adjustedEnd = endAngle - 90;

    // 360도 전체 원일 경우 (부서가 1개일 때) 특수 처리
    // SVG arc는 시작점과 끝점이 같으면 그려지지 않으므로, 두 개의 반원으로 그림
    if (endAngle - startAngle >= 359.99) {
      const midAngle = adjustedStart + 180;

      const outerStart = polarToCartesian(centerX, centerY, outerRadius, adjustedStart);
      const outerMid = polarToCartesian(centerX, centerY, outerRadius, midAngle);
      const innerStart = polarToCartesian(centerX, centerY, innerRadius, adjustedStart);
      const innerMid = polarToCartesian(centerX, centerY, innerRadius, midAngle);

      const d = [
        'M', outerStart.x, outerStart.y,
        'A', outerRadius, outerRadius, 0, 1, 1, outerMid.x, outerMid.y,
        'A', outerRadius, outerRadius, 0, 1, 1, outerStart.x, outerStart.y,
        'L', innerStart.x, innerStart.y,
        'A', innerRadius, innerRadius, 0, 1, 0, innerMid.x, innerMid.y,
        'A', innerRadius, innerRadius, 0, 1, 0, innerStart.x, innerStart.y,
        'Z'
      ].join(' ');

      return d;
    }

    const start = polarToCartesian(centerX, centerY, outerRadius, adjustedEnd);
    const end = polarToCartesian(centerX, centerY, outerRadius, adjustedStart);
    const innerStart = polarToCartesian(centerX, centerY, innerRadius, adjustedEnd);
    const innerEnd = polarToCartesian(centerX, centerY, innerRadius, adjustedStart);

    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

    const d = [
      'M', start.x, start.y,
      'A', outerRadius, outerRadius, 0, largeArcFlag, 0, end.x, end.y,
      'L', innerEnd.x, innerEnd.y,
      'A', innerRadius, innerRadius, 0, largeArcFlag, 1, innerStart.x, innerStart.y,
      'Z'
    ].join(' ');

    return d;
  };

  const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
    const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians)
    };
  };

  const handleMouseMove = (e, segment) => {
    setTooltipPos({
      x: e.clientX,
      y: e.clientY
    });
    setHoveredSegment(segment);
  };

  const handleDepartmentClick = (departmentName) => {
    setSelectedDepartment(departmentName);
    setSelectedDivision(null);
    setSelectedCombo(null);
    setIsModalOpen(true);
  };

  const handleDivisionClick = (divisionName) => {
    setSelectedDivision(divisionName);
    setSelectedDepartment(null);
    setSelectedCombo(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  // CSV 이스케이프 함수
  const escapeCSV = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // 과제 현황 CSV 내보내기
  const handleExportProjectStatusToCSV = () => {
    if (departmentStats.length === 0) {
      alert('내보낼 데이터가 없습니다.');
      return;
    }

    // 각 부서별 사업부 정보와 과제수 계산
    const deptWithDivisions = departmentStats.map(dept => {
      const divisionCounts = {};
      dept.projects.forEach(project => {
        const division = project.사업부 || '미지정';
        divisionCounts[division] = (divisionCounts[division] || 0) + 1;
      });

      // 시스템 설정에서 소속 사업부 가져오기
      const primaryDivision = departmentToDivisionMap[dept.name] || '미지정';

      return {
        ...dept,
        divisions: divisionCounts,
        primaryDivision
      };
    });

    // CSV 헤더 정의
    const headers = [
      '부서',
      '소속 사업부',
      '과제 수',
      '성과 수',
      '사업부별 과제 수'
    ];

    // 사업부 목록 추출
    const allDivisions = new Set();
    deptWithDivisions.forEach(dept => {
      Object.keys(dept.divisions || {}).forEach(div => allDivisions.add(div));
    });
    const divisionList = Array.from(allDivisions).sort();

    // 사업부별 헤더 추가
    divisionList.forEach(div => {
      headers.push(`${div} 과제수`);
    });

    // CSV 데이터 생성
    const csvData = deptWithDivisions.map(dept => {
      const row = [
        dept.name,
        dept.primaryDivision,
        dept.projectCount,
        dept.performanceCount,
        Object.entries(dept.divisions || {}).map(([k, v]) => `${k}:${v}`).join(', ')
      ];

      // 사업부별 과제수 추가
      divisionList.forEach(div => {
        row.push(dept.divisions?.[div] || 0);
      });

      return row;
    });

    // CSV 문자열 생성 (BOM 추가로 한글 지원)
    const csvContent = '\uFEFF' +
      headers.map(escapeCSV).join(',') + '\n' +
      csvData.map(row => row.map(escapeCSV).join(',')).join('\n');

    // 파일 다운로드
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `부서별_과제현황_${currentYear}년_${todayLocalYmd()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 인력 현황 CSV 내보내기
  const handleExportPersonnelStatusToCSV = () => {
    if (divisionPersonnelStats.divisions.length === 0) {
      alert('내보낼 데이터가 없습니다.');
      return;
    }

    // ===== 섹션 1: 사업부별 총인력 테이블 =====
    const summaryHeaders = [
      '사업부',
      '총 인력',
      '부서별 인력 현황'
    ];

    // 모든 부서 목록 추출
    const allDepts = new Set();
    divisionPersonnelStats.divisions.forEach(div => {
      div.departments.forEach(dept => allDepts.add(dept.name));
    });
    const deptList = Array.from(allDepts).sort();

    // 부서별 헤더 추가
    deptList.forEach(dept => {
      summaryHeaders.push(dept);
    });

    // 총인력 테이블 데이터 생성
    const summaryData = divisionPersonnelStats.divisions.map(division => {
      const deptMap = {};
      division.departments.forEach(dept => {
        deptMap[dept.name] = dept.count;
      });

      const row = [
        division.name,
        division.totalCount,
        division.departments.map(d => `${d.name}:${d.count}명`).join(', ')
      ];

      // 부서별 인력수 추가
      deptList.forEach(dept => {
        row.push(deptMap[dept] || 0);
      });

      return row;
    });

    // 합계 행 추가
    const totalRow = ['합계', personnelStats.totalPersonnel, ''];
    deptList.forEach(dept => {
      const total = divisionPersonnelStats.divisions.reduce((sum, div) => {
        const deptData = div.departments.find(d => d.name === dept);
        return sum + (deptData?.count || 0);
      }, 0);
      totalRow.push(total);
    });
    summaryData.push(totalRow);

    // ===== 섹션 2: 참여 인력 상세 목록 =====
    const detailHeaders = ['이름', '부서', '소속 사업부', '참여 과제 수', '참여 과제 목록'];

    // 모든 인력 수집 (중복 제거하면서 과제 정보 수집)
    const personnelMap = new Map();

    projects.forEach(project => {
      if (project.과제참여인력목록 && Array.isArray(project.과제참여인력목록)) {
        project.과제참여인력목록.forEach(person => {
          const dept = person.부서 || '미지정';
          const name = person.이름 || person.name || '이름없음';
          const personKey = `${dept}-${name}`;

          if (!personnelMap.has(personKey)) {
            personnelMap.set(personKey, {
              name: name,
              department: dept,
              division: departmentToDivisionMap[dept] || '공통',
              projects: []
            });
          }

          // 과제 추가
          personnelMap.get(personKey).projects.push(project.과제명 || '이름없는 과제');
        });
      }
    });

    // 상세 목록 데이터 생성 (사업부 > 부서 > 이름 순으로 정렬)
    const detailData = Array.from(personnelMap.values())
      .sort((a, b) => {
        // 사업부 순서로 먼저 정렬
        const divisionOrder = ['MX', 'VD', 'DA', 'NW', '의료기기', 'SR', 'GTR', 'CS', '공통'];
        const divA = divisionOrder.indexOf(a.division.toUpperCase()) === -1 ? 999 : divisionOrder.findIndex(d => d.toUpperCase() === a.division.toUpperCase());
        const divB = divisionOrder.indexOf(b.division.toUpperCase()) === -1 ? 999 : divisionOrder.findIndex(d => d.toUpperCase() === b.division.toUpperCase());
        if (divA !== divB) return divA - divB;
        // 부서명으로 정렬
        if (a.department !== b.department) return a.department.localeCompare(b.department);
        // 이름으로 정렬
        return a.name.localeCompare(b.name);
      })
      .map(person => [
        person.name,
        person.department,
        person.division,
        person.projects.length,
        person.projects.join(', ')
      ]);

    // ===== CSV 문자열 생성 =====
    const csvLines = [];

    // 섹션 1: 사업부별 총인력
    csvLines.push('[사업부별 인력 현황]');
    csvLines.push(summaryHeaders.map(escapeCSV).join(','));
    summaryData.forEach(row => {
      csvLines.push(row.map(escapeCSV).join(','));
    });

    // 빈 줄 추가
    csvLines.push('');
    csvLines.push('');

    // 섹션 2: 참여 인력 상세
    csvLines.push('[참여 인력 상세 목록]');
    csvLines.push(detailHeaders.map(escapeCSV).join(','));
    detailData.forEach(row => {
      csvLines.push(row.map(escapeCSV).join(','));
    });

    // CSV 문자열 생성 (BOM 추가로 한글 지원)
    const csvContent = '\uFEFF' + csvLines.join('\n');

    // 파일 다운로드
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `사업부별_인력현황_${currentYear}년_${todayLocalYmd()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 그룹별 과제 상세 CSV 내보내기
  const handleExportGroupDetailToCSV = () => {
    if (upsetData.combos.length === 0) {
      alert('내보낼 데이터가 없습니다.');
      return;
    }

    const csvLines = [];
    const divisionLabel = upsetDivision === 'all' ? '전체' : upsetDivision;

    // ===== 섹션 1: 조직별 지표 =====
    const statusHeaders = availableProjectStatuses.map(s => s.name);
    csvLines.push(`[조직별 지표] 사업부: ${escapeCSV(divisionLabel)}`);
    csvLines.push(['조직', '과제 수', '단독 수행', '협업 수행', '협업 비율(%)', '평균 진척률(%)', ...statusHeaders]
      .map(escapeCSV).join(','));
    upsetData.sets.forEach(set => {
      const total = set.solo + set.collab;
      csvLines.push([
        set.name,
        set.count,
        set.solo,
        set.collab,
        total > 0 ? Math.round((set.collab / total) * 100) : 0,
        set.avgProgress,
        ...statusHeaders.map(name => set.statusCounts[name] || 0)
      ].map(escapeCSV).join(','));
    });

    csvLines.push('');
    csvLines.push('');

    // ===== 섹션 2: 조직 조합별 과제 =====
    csvLines.push(`[조직 조합별 과제] 사업부: ${escapeCSV(divisionLabel)}`);
    csvLines.push(['조직 조합', '조직 수', '과제 수', '사업부별 과제 수', '과제 목록'].map(escapeCSV).join(','));
    upsetData.combos.forEach(combo => {
      csvLines.push([
        combo.departments.join(' ∩ '),
        combo.degree,
        combo.count,
        Object.entries(combo.divisions).map(([k, v]) => `${k}:${v}`).join(', '),
        combo.projects.map(p => p.과제명 || '이름없는 과제').join(', ')
      ].map(escapeCSV).join(','));
    });

    csvLines.push('');
    csvLines.push('');

    // ===== 섹션 3: 과제별 참여 조직 =====
    csvLines.push('[과제별 참여 조직]');
    csvLines.push(['과제명', '사업부', '진행상태', '조직 수', '참여 조직'].map(escapeCSV).join(','));
    upsetData.combos.forEach(combo => {
      combo.projects.forEach(p => {
        csvLines.push([
          p.과제명 || '이름없는 과제',
          p.사업부 || '미분류',
          p.진행상태 || '',
          combo.degree,
          combo.departments.join(' / ')
        ].map(escapeCSV).join(','));
      });
    });

    // CSV 문자열 생성 (BOM 추가로 한글 지원)
    const csvContent = '\uFEFF' + csvLines.join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `그룹별_과제상세_${divisionLabel}_${currentYear}년_${todayLocalYmd()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 레이블 위치 계산 (세그먼트 중간)
  const getLabelPosition = (startAngle, endAngle, radius, centerX = 140, centerY = 140) => {
    const middleAngle = (startAngle + endAngle) / 2;
    return polarToCartesian(centerX, centerY, radius, middleAngle);
  };

  // 리더 라인용 레이블 위치 계산 (원 바깥 방사형 배치 + 겹침 방지)
  const calculateLeaderLineLabels = (segments, centerX, centerY, outerRadius) => {
    const labelRadius = outerRadius + 25; // 레이블 위치 (원 바깥으로 더 여유있게)
    const minLabelGap = 16; // 레이블 간 최소 간격 (px)

    // 각 세그먼트의 중간 각도와 위치 계산
    const labelData = segments.map((segment, index) => {
      const middleAngle = (segment.startAngle + segment.endAngle) / 2;
      // -90도 오프셋 적용 (12시 방향 시작 기준)
      const adjustedAngle = middleAngle - 90;

      // 화면 기준 오른쪽: 0~180도 (12시~6시), 왼쪽: 180~360도 (6시~12시)
      const isRight = middleAngle >= 0 && middleAngle < 180;

      const arcPoint = polarToCartesian(centerX, centerY, outerRadius, adjustedAngle);
      // 레이블을 원 바깥 방사형으로 배치
      const labelPoint = polarToCartesian(centerX, centerY, labelRadius, adjustedAngle);

      return {
        ...segment,
        index,
        middleAngle,
        adjustedAngle,
        isRight,
        arcPoint,
        labelX: labelPoint.x,
        labelY: labelPoint.y,
        originalX: labelPoint.x,
        originalY: labelPoint.y
      };
    });

    // 왼쪽/오른쪽 그룹으로 분리하여 겹침 방지
    const rightLabels = labelData.filter(l => l.isRight).sort((a, b) => a.labelY - b.labelY);
    const leftLabels = labelData.filter(l => !l.isRight).sort((a, b) => a.labelY - b.labelY);

    // 겹침 방지: 같은 방향의 레이블끼리 Y 위치 조정
    const adjustLabelPositions = (labels) => {
      for (let i = 1; i < labels.length; i++) {
        const prevLabel = labels[i - 1];
        const currLabel = labels[i];
        const gap = currLabel.labelY - prevLabel.labelY;

        if (gap < minLabelGap) {
          // 겹치면 아래로 밀어냄
          currLabel.labelY = prevLabel.labelY + minLabelGap;
        }
      }
    };

    adjustLabelPositions(rightLabels);
    adjustLabelPositions(leftLabels);

    // 원래 인덱스 순서로 정렬하여 반환
    return [...rightLabels, ...leftLabels].sort((a, b) => a.index - b.index);
  };

  // 선택된 부서 / 사업부 / 조직 조합의 과제 목록
  const selectedProjects = useMemo(() => {
    if (selectedCombo) {
      return selectedCombo.projects || [];
    }
    if (selectedDepartment) {
      const dept = departmentStats.find(d => d.name === selectedDepartment);
      return dept?.projects || [];
    }
    if (selectedDivision) {
      return filteredProjects.filter(project => project.사업부 === selectedDivision);
    }
    return [];
  }, [selectedCombo, selectedDepartment, selectedDivision, departmentStats, filteredProjects]);

  // 모달 제목
  const modalTitle = useMemo(() => {
    if (selectedCombo) {
      const orgs = selectedCombo.departments.join(' ∩ ');
      return selectedCombo.isSetRow
        ? `${orgs} - 과제 목록 (${selectedProjects.length}개)`
        : `${orgs} - 공동 수행 과제 (${selectedProjects.length}개)`;
    }
    if (selectedDepartment) return `${selectedDepartment} - 과제 목록 (${selectedProjects.length}개)`;
    return `${selectedDivision} 사업부 - 과제 목록 (${selectedProjects.length}개)`;
  }, [selectedCombo, selectedDepartment, selectedDivision, selectedProjects]);

  // 조직(행) 레이블 클릭 - 현재 사업부 탭 기준 해당 조직의 전체 과제
  const handleSetLabelClick = (orgName) => {
    const orgProjects = upsetProjects.filter(p =>
      (p.담당부서목록 || [])
        .map(d => (typeof d === 'string' ? d.trim() : d?.name || ''))
        .includes(orgName)
    );
    setSelectedCombo({ key: orgName, departments: [orgName], projects: orgProjects, isSetRow: true });
    setSelectedDepartment(null);
    setSelectedDivision(null);
    setIsModalOpen(true);
  };

  // 초기 선택 제거 - 사용자가 직접 클릭하도록 변경

  if (departmentStats.length === 0 && personnelStats.departments.length === 0) {
    return (
      <EmptyState>
        <Building2 size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
        <div>부서 정보가 있는 과제가 없습니다.</div>
      </EmptyState>
    );
  }

  // 뷰 전환 토글 (3개 뷰 공용)
  const viewModeToggle = (
    <ViewModeToggle>
      <ViewModeButton
        $active={viewMode === 'project'}
        onClick={() => setViewMode('project')}
      >
        <FolderKanban size={14} />
        과제 현황
      </ViewModeButton>
      <ViewModeButton
        $active={viewMode === 'personnel'}
        onClick={() => setViewMode('personnel')}
      >
        <Users size={14} />
        인력 현황
      </ViewModeButton>
      <ViewModeButton
        $active={viewMode === 'group'}
        onClick={() => setViewMode('group')}
      >
        <Network size={14} />
        그룹별 과제 상세
      </ViewModeButton>
    </ViewModeToggle>
  );

  // 년도 선택기 (3개 뷰 공용)
  const yearSelector = currentYear && onYearChange ? (
    <YearSelector>
      <YearButton onClick={() => onYearChange(currentYear - 1)} title="이전 년도">
        ‹
      </YearButton>
      <YearDisplay>{currentYear}년</YearDisplay>
      <YearButton onClick={() => onYearChange(currentYear + 1)} title="다음 년도">
        ›
      </YearButton>
    </YearSelector>
  ) : null;

  // 과제 목록 모달 (부서 / 사업부 / 조직 조합 공용)
  const projectListModal = isModalOpen && (selectedDepartment || selectedDivision || selectedCombo) && (
    <ModalOverlay
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={handleCloseModal}
    >
      <ModalContent
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
      >
        <ModalHeader>
          <ModalTitle>
            <FileText size={24} />
            {modalTitle}
          </ModalTitle>
          <CloseButton onClick={handleCloseModal}>
            <X size={20} />
          </CloseButton>
        </ModalHeader>

        <LegendNote>
          <LegendIndicator $color="#3b82f6" />
          <span>파란 테두리: 최근 1주일 내 업데이트</span>
          <span style={{ margin: '0 0.25rem', color: '#cbd5e1' }}>|</span>
          <LegendIndicator />
          <span>녹색 테두리: 최근 1개월 내 업데이트</span>
        </LegendNote>

        <ProjectList>
          {selectedProjects.map((project, index) => (
            <ProjectCard
              key={project.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              $updateRecency={getUpdateRecency(project)}
            >
              <ProjectTitle>{project.과제명}</ProjectTitle>

              <ProjectMeta>
                <MetaBadge bg={divisionColors[project.사업부]} color="white">
                  {project.사업부}
                </MetaBadge>
                <MetaBadge bg="#3b82f6" color="white">
                  {project.프로세스}
                </MetaBadge>
                <MetaBadge bg={statusColors[project.진행상태]} color="white">
                  {project.진행상태}
                </MetaBadge>
                <MetaBadge>
                  {project.시작}월 ~ {project.종료}월
                </MetaBadge>
              </ProjectMeta>

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
                      <ProgressBox key={i} filled={i < filledBoxes} />
                    );
                  })}
                </ProgressBar>
              </ProgressContainer>
            </ProjectCard>
          ))}
        </ProjectList>
      </ModalContent>
    </ModalOverlay>
  );

  // 인력 현황 뷰 렌더링
  if (viewMode === 'personnel') {
    return (
      <Container>
        <Header>
          <HeaderLeft>
            <Title>
              <Building2 size={24} />
              부서별 현황
            </Title>
          </HeaderLeft>
          <HeaderRight>
            {canExport && (
              <ExportButton onClick={handleExportPersonnelStatusToCSV}>
                <Download size={16} />
                로컬 저장
              </ExportButton>
            )}
            {viewModeToggle}
            {yearSelector}
          </HeaderRight>
        </Header>

        <PersonnelContent>
          <PersonnelSection>
            <PanelTitle style={{ marginBottom: '1rem' }}>
              <Users size={20} />
              사업부별 인력 현황
            </PanelTitle>

            <PersonnelSummary>
              <SummaryItem>
                <Building2 size={18} color="#64748b" />
                <SummaryLabel>사업부</SummaryLabel>
                <SummaryValue>{divisionPersonnelStats.divisions.length}개</SummaryValue>
              </SummaryItem>
              <SummaryItem>
                <Users size={18} color="#64748b" />
                <SummaryLabel>총 인력</SummaryLabel>
                <SummaryValue>{personnelStats.totalPersonnel}명</SummaryValue>
              </SummaryItem>
              <SummaryItem>
                <FileText size={18} color="#64748b" />
                <SummaryLabel>총 과제</SummaryLabel>
                <SummaryValue>{projects.length}개</SummaryValue>
              </SummaryItem>
            </PersonnelSummary>

            <WaffleChartsContainer>
              {divisionPersonnelStats.divisions.map((division, divIndex) => {
                // 와플 셀 데이터 생성
                const cells = [];
                let cellIndex = 0;

                // 부서별로 셀 추가
                division.departments.forEach(dept => {
                  for (let i = 0; i < dept.count; i++) {
                    cells.push({
                      filled: true,
                      department: dept.name,
                      color: departmentColors[dept.name]
                    });
                    cellIndex++;
                  }
                });

                // 빈 셀로 나머지 채우기
                while (cells.length < divisionPersonnelStats.gridSize) {
                  cells.push({ filled: false });
                }

                return (
                  <WaffleChartCard key={division.name}>
                    <WaffleChartHeader>
                      <WaffleChartTitle style={{ color: divisionColors[division.name] || '#1e293b' }}>
                        {division.name}
                      </WaffleChartTitle>
                      <WaffleChartCount>{division.totalCount}명</WaffleChartCount>
                    </WaffleChartHeader>

                    <WaffleGrid>
                      {cells.map((cell, idx) => (
                        <WaffleCell
                          key={idx}
                          $filled={cell.filled}
                          $color={cell.filled ? cell.color : '#f1f5f9'}
                          title={cell.filled ? `${cell.department}` : ''}
                        >
                          {cell.filled && <User />}
                        </WaffleCell>
                      ))}
                    </WaffleGrid>

                    <WaffleLegend>
                      {division.departments.map(dept => (
                        <WaffleLegendItem key={dept.name}>
                          <WaffleLegendColor $color={departmentColors[dept.name]}>
                            <User />
                          </WaffleLegendColor>
                          {dept.name} ({dept.count}명)
                        </WaffleLegendItem>
                      ))}
                    </WaffleLegend>
                  </WaffleChartCard>
                );
              })}
            </WaffleChartsContainer>
          </PersonnelSection>
        </PersonnelContent>
      </Container>
    );
  }

  // 그룹별 과제 상세 (Upset Plot) 뷰 렌더링
  if (viewMode === 'group') {
    const { sets, combos, stackDivisions, maxSetCount, maxComboCount } = upsetData;
    const { matrixX, matrixTop, matrixW, panelX, width: chartW, height: chartH } = upsetGeom;
    const baselineY = UPSET_TOP_PAD + UPSET_TOPBAR_H;
    const rowsBottom = matrixTop + sets.length * UPSET_ROW_H;
    const progressColor = (v) => (v >= 70 ? '#10b981' : v >= 40 ? '#f59e0b' : '#ef4444');
    // 열 폭 / 행 높이에 맞춰 점과 글자 크기도 함께 확대
    const dotR = Math.max(6, Math.min(UPSET_COL_W * 0.22, UPSET_ROW_H * 0.3, 13));
    const comboFont = UPSET_COL_W >= 46 ? 12 : 11;

    return (
      <Container>
        <Header>
          <HeaderLeft>
            <Title>
              <Building2 size={24} />
              부서별 현황
            </Title>
          </HeaderLeft>
          <HeaderRight>
            {canExport && (
              <ExportButton onClick={handleExportGroupDetailToCSV}>
                <Download size={16} />
                로컬 저장
              </ExportButton>
            )}
            {viewModeToggle}
            {yearSelector}
          </HeaderRight>
        </Header>

        {/* 사업부 탭 (KPI 대시보드와 동일한 형태) */}
        <FilterBar>
          <FilterButton $active={upsetDivision === 'all'} onClick={() => setUpsetDivision('all')}>
            전체<FilterBadge $active={upsetDivision === 'all'}>{filteredProjects.length}</FilterBadge>
          </FilterButton>
          {upsetDivisionTabs.map(division => (
            <FilterButton
              key={division}
              $active={upsetDivision === division}
              onClick={() => setUpsetDivision(division)}
            >
              {division}
              <FilterBadge $active={upsetDivision === division}>{getUpsetDivisionCount(division)}</FilterBadge>
            </FilterButton>
          ))}
        </FilterBar>

        <UpsetContent>
          <UpsetSection>
            <PanelTitle>
              <Network size={20} />
              그룹별 과제 상세
              <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8', marginLeft: '0.25rem' }}>
                Upset Plot · 조직 조합별 과제 분포
              </span>
            </PanelTitle>

            {/* 과제 상태(진행상태) 필터 */}
            {availableProjectStatuses.length > 0 && (
              <StatusFilterBar>
                <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600, whiteSpace: 'nowrap' }}>과제 상태:</span>
                {availableProjectStatuses.map(status => {
                  const isActive = selectedProjectStatuses.has(status.name);
                  return (
                    <LegendFilterButton
                      key={`ups-${status.name}`}
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
              </StatusFilterBar>
            )}

            {/* 정렬 / 협업 필터 */}
            <UpsetControls>
              <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600 }}>정렬:</span>
              <LegendFilterButton
                $borderColor="#6366f1"
                $textColor="#4338ca"
                $active={upsetSort === 'count'}
                onClick={() => setUpsetSort('count')}
                title="과제 수가 많은 조합부터 표시"
              >
                <ArrowDownWideNarrow size={12} />
                과제 수
              </LegendFilterButton>
              <LegendFilterButton
                $borderColor="#6366f1"
                $textColor="#4338ca"
                $active={upsetSort === 'degree'}
                onClick={() => setUpsetSort('degree')}
                title="참여 조직 수가 적은 조합부터 표시"
              >
                <ArrowDownWideNarrow size={12} />
                조직 수
              </LegendFilterButton>
              <span style={{ width: '1px', height: '20px', background: '#e2e8f0', margin: '0 0.25rem' }} />
              <LegendFilterButton
                $borderColor="#10b981"
                $textColor="#047857"
                $active={collabOnly}
                onClick={() => setCollabOnly(v => !v)}
                title="2개 이상 조직이 함께 수행하는 과제 조합만 표시"
              >
                <GitMerge size={12} />
                협업 조합만
              </LegendFilterButton>
            </UpsetControls>

            {/* 요약 */}
            <PersonnelSummary>
              <SummaryItem>
                <Building2 size={18} color="#64748b" />
                <SummaryLabel>조직</SummaryLabel>
                <SummaryValue>{upsetData.totalOrgCount}개</SummaryValue>
              </SummaryItem>
              <SummaryItem>
                <Network size={18} color="#64748b" />
                <SummaryLabel>조직 조합</SummaryLabel>
                <SummaryValue>{upsetData.totalComboCount}개</SummaryValue>
              </SummaryItem>
              <SummaryItem>
                <FileText size={18} color="#64748b" />
                <SummaryLabel>과제</SummaryLabel>
                <SummaryValue>{upsetData.totalProjectCount}개</SummaryValue>
              </SummaryItem>
              <SummaryItem>
                <GitMerge size={18} color="#64748b" />
                <SummaryLabel>협업 과제</SummaryLabel>
                <SummaryValue>{upsetData.collabProjectCount}개</SummaryValue>
              </SummaryItem>
            </PersonnelSummary>

            {combos.length === 0 ? (
              <EmptyState>
                <Network size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                <div>{collabOnly ? '2개 이상 조직이 함께 수행하는 과제가 없습니다.' : '담당 조직 정보가 있는 과제가 없습니다.'}</div>
              </EmptyState>
            ) : (
              <>
                <UpsetChartScroll ref={upsetScrollRef}>
                  <svg width={chartW} height={chartH} style={{ display: 'block' }}>
                    {/* 행 배경 (짝수행 음영) */}
                    {sets.map((set, r) => (
                      <rect
                        key={`row-bg-${set.name}`}
                        x={0}
                        y={matrixTop + r * UPSET_ROW_H}
                        width={chartW}
                        height={UPSET_ROW_H}
                        fill={r % 2 === 0 ? '#f8fafc' : 'white'}
                      />
                    ))}

                    {/* 선택 조합 하이라이트 */}
                    {combos.map((combo, i) => (
                      hoveredCombo?.key === combo.key ? (
                        <rect
                          key={`hl-${combo.key}`}
                          x={matrixX + i * UPSET_COL_W}
                          y={0}
                          width={UPSET_COL_W}
                          height={matrixTop + sets.length * UPSET_ROW_H}
                          fill="rgba(99, 102, 241, 0.08)"
                        />
                      ) : null
                    ))}

                    {/* 상단: 조합별 과제 수 막대 (사업부 색상 스택) */}
                    {combos.map((combo, i) => {
                      const barH = (combo.count / maxComboCount) * UPSET_TOPBAR_H;
                      // 열이 넓어져도 막대는 과하게 굵어지지 않도록 상한을 두고 가운데 정렬
                      const barW = Math.min(UPSET_COL_W - 10, 72);
                      const barX = matrixX + i * UPSET_COL_W + (UPSET_COL_W - barW) / 2;
                      let acc = 0;

                      return (
                        <g key={`bar-${combo.key}`}>
                          {stackDivisions.map(div => {
                            const c = combo.divisions[div] || 0;
                            if (c === 0) return null;
                            const segH = (c / combo.count) * barH;
                            const segY = baselineY - acc - segH;
                            acc += segH;
                            return (
                              <rect
                                key={`bar-${combo.key}-${div}`}
                                x={barX}
                                y={segY}
                                width={barW}
                                height={Math.max(segH, 0)}
                                fill={divisionColors[div] || '#6366f1'}
                                opacity={hoveredCombo && hoveredCombo.key !== combo.key ? 0.35 : 1}
                              />
                            );
                          })}
                          <text
                            x={barX + barW / 2}
                            y={baselineY - barH - 6}
                            textAnchor="middle"
                            fontSize={comboFont}
                            fontWeight="700"
                            fill="#1e293b"
                          >
                            {combo.count}
                          </text>
                        </g>
                      );
                    })}

                    {/* 상단 막대 기준선 */}
                    <line x1={matrixX} y1={baselineY} x2={matrixX + matrixW} y2={baselineY} stroke="#cbd5e1" strokeWidth="1" />
                    <text
                      x={matrixX - UPSET_GAP}
                      y={baselineY - 4}
                      textAnchor="end"
                      fontSize="11"
                      fontWeight="600"
                      fill="#64748b"
                    >
                      조합별 과제 수
                    </text>

                    {/* 좌측: 조직명 + 조직별 과제 수 막대 */}
                    {sets.map((set, r) => {
                      const rowY = matrixTop + r * UPSET_ROW_H;
                      const cy = rowY + UPSET_ROW_H / 2;
                      const barW = (set.count / maxSetCount) * (UPSET_SETBAR_W - 10);
                      const barX = matrixX - UPSET_GAP - barW;
                      const isActive = hoveredCombo?.departments?.includes(set.name);

                      return (
                        <g key={`set-${set.name}`}>
                          <UpsetSetLabel
                            x={UPSET_LABEL_W - 10}
                            y={cy + 4}
                            textAnchor="end"
                            fontSize={UPSET_LABEL_FONT}
                            fill={isActive ? '#4338ca' : '#334155'}
                            fontWeight={isActive ? 700 : 600}
                            onClick={() => handleSetLabelClick(set.name)}
                          >
                            {set.name}
                            <title>{`${set.name} · 과제 ${set.count}개 (클릭하여 목록 보기)`}</title>
                          </UpsetSetLabel>
                          <rect
                            x={barX}
                            y={rowY + 7}
                            width={Math.max(barW, 2)}
                            height={UPSET_ROW_H - 14}
                            rx="2"
                            fill={isActive ? '#818cf8' : '#cbd5e1'}
                          />
                          {/* 과제 수는 막대 오른쪽 끝(고정 위치)에 표시 - 조직명과 겹치지 않도록 */}
                          <text
                            x={matrixX - UPSET_GAP - 5}
                            y={cy + 4}
                            textAnchor="end"
                            fontSize="11"
                            fontWeight="700"
                            fill={barW >= 24 ? 'white' : '#64748b'}
                          >
                            {set.count}
                          </text>
                        </g>
                      );
                    })}

                    {/* 매트릭스: 조합 도트 + 연결선 */}
                    {combos.map((combo, i) => {
                      const cx = matrixX + i * UPSET_COL_W + UPSET_COL_W / 2;
                      const activeRows = combo.departments
                        .map(d => sets.findIndex(s => s.name === d))
                        .filter(idx => idx >= 0);
                      const minRow = Math.min(...activeRows);
                      const maxRow = Math.max(...activeRows);
                      const dimmed = hoveredCombo && hoveredCombo.key !== combo.key;
                      const dotColor = combo.degree > 1 ? '#4338ca' : '#64748b';

                      return (
                        <g key={`dots-${combo.key}`} opacity={dimmed ? 0.35 : 1}>
                          {maxRow > minRow && (
                            <line
                              x1={cx}
                              y1={matrixTop + minRow * UPSET_ROW_H + UPSET_ROW_H / 2}
                              x2={cx}
                              y2={matrixTop + maxRow * UPSET_ROW_H + UPSET_ROW_H / 2}
                              stroke={dotColor}
                              strokeWidth={Math.max(3, dotR * 0.45)}
                            />
                          )}
                          {sets.map((set, r) => {
                            const on = combo.departments.includes(set.name);
                            return (
                              <circle
                                key={`dot-${combo.key}-${set.name}`}
                                cx={cx}
                                cy={matrixTop + r * UPSET_ROW_H + UPSET_ROW_H / 2}
                                r={on ? dotR : dotR * 0.7}
                                fill={on ? dotColor : '#e2e8f0'}
                              />
                            );
                          })}
                        </g>
                      );
                    })}

                    {/* ===== 우측 조직별 지표 패널 (매트릭스와 같은 행에 정렬) ===== */}
                    <line
                      x1={panelX - UPSET_PANEL_GAP / 2}
                      y1={matrixTop - 22}
                      x2={panelX - UPSET_PANEL_GAP / 2}
                      y2={rowsBottom}
                      stroke="#e2e8f0"
                      strokeWidth="1"
                    />

                    {/* 패널 헤더 */}
                    <text x={panelX} y={matrixTop - 10} fontSize="11" fontWeight="700" fill="#475569">
                      단독 / 협업 수행
                    </text>
                    <text
                      x={panelX + UPSET_PANEL_PROG_X + UPSET_PANEL_PROG_W / 2}
                      y={matrixTop - 10}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="700"
                      fill="#475569"
                    >
                      평균 진척
                    </text>
                    <text
                      x={panelX + UPSET_PANEL_STATUS_X + UPSET_PANEL_STATUS_W / 2}
                      y={matrixTop - 10}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="700"
                      fill="#475569"
                    >
                      진행상태
                    </text>

                    {sets.map((set, r) => {
                      const rowY = matrixTop + r * UPSET_ROW_H;
                      const cy = rowY + UPSET_ROW_H / 2;
                      // 단독/협업은 비율 바(고정 폭) - 절대 개수는 좌측 막대와 우측 숫자가 담당
                      const total = set.solo + set.collab;
                      const soloW = total > 0 ? (set.solo / total) * UPSET_PANEL_STACK_W : 0;
                      const collabW = total > 0 ? UPSET_PANEL_STACK_W - soloW : 0;
                      const isActive = hoveredCombo?.departments?.includes(set.name);

                      // 진행상태 분포 (설정 순서 유지, 없는 상태는 뒤에)
                      const statusNames = [
                        ...availableProjectStatuses.map(s => s.name).filter(n => set.statusCounts[n]),
                        ...Object.keys(set.statusCounts).filter(n => !availableProjectStatuses.some(s => s.name === n))
                      ];
                      let statusAcc = 0;

                      return (
                        <g key={`panel-${set.name}`} opacity={isActive || !hoveredCombo ? 1 : 0.45}>
                          {/* 단독 / 협업 스택 막대 */}
                          <rect
                            x={panelX}
                            y={rowY + 8}
                            width={soloW}
                            height={UPSET_ROW_H - 16}
                            fill="#94a3b8"
                          >
                            <title>{`${set.name} · 단독 수행 ${set.solo}개 (${total > 0 ? Math.round((set.solo / total) * 100) : 0}%)`}</title>
                          </rect>
                          <rect
                            x={panelX + soloW}
                            y={rowY + 8}
                            width={collabW}
                            height={UPSET_ROW_H - 16}
                            fill="#4338ca"
                          >
                            <title>{`${set.name} · 협업 수행 ${set.collab}개 (${total > 0 ? Math.round((set.collab / total) * 100) : 0}%)`}</title>
                          </rect>
                          <text
                            x={panelX + UPSET_PANEL_RATIO_X}
                            y={cy + 4}
                            fontSize="11"
                            fontWeight="600"
                            fill="#475569"
                          >
                            <tspan fill="#64748b">{set.solo}</tspan>
                            <tspan fill="#cbd5e1"> / </tspan>
                            <tspan fill="#4338ca">{set.collab}</tspan>
                          </text>

                          {/* 평균 진척률 */}
                          <rect
                            x={panelX + UPSET_PANEL_PROG_X}
                            y={rowY + 10}
                            width={UPSET_PANEL_PROG_W}
                            height={UPSET_ROW_H - 20}
                            rx="3"
                            fill="#e2e8f0"
                          />
                          <rect
                            x={panelX + UPSET_PANEL_PROG_X}
                            y={rowY + 10}
                            width={(set.avgProgress / 100) * UPSET_PANEL_PROG_W}
                            height={UPSET_ROW_H - 20}
                            rx="3"
                            fill={progressColor(set.avgProgress)}
                          >
                            <title>{`${set.name} · 평균 진척률 ${set.avgProgress}%`}</title>
                          </rect>
                          <text
                            x={panelX + UPSET_PANEL_PROGTXT_X}
                            y={cy + 4}
                            fontSize="11"
                            fontWeight="600"
                            fill="#475569"
                          >
                            {set.avgProgress}%
                          </text>

                          {/* 진행상태 분포 */}
                          {statusNames.map(name => {
                            const c = set.statusCounts[name] || 0;
                            if (c === 0 || set.statusTotal === 0) return null;
                            const segW = (c / set.statusTotal) * UPSET_PANEL_STATUS_W;
                            const segX = panelX + UPSET_PANEL_STATUS_X + statusAcc;
                            statusAcc += segW;
                            const color = statusColors[name]
                              || availableProjectStatuses.find(s => s.name === name)?.color
                              || '#cbd5e1';
                            return (
                              <rect
                                key={`st-${set.name}-${name}`}
                                x={segX}
                                y={rowY + 10}
                                width={segW}
                                height={UPSET_ROW_H - 20}
                                fill={color}
                              >
                                <title>{`${set.name} · ${name} ${c}개`}</title>
                              </rect>
                            );
                          })}
                        </g>
                      );
                    })}

                    {/* 패널 범례 */}
                    <g transform={`translate(${panelX}, ${rowsBottom + 16})`}>
                      <rect x={0} y={0} width={10} height={10} rx="2" fill="#94a3b8" />
                      <text x={14} y={9} fontSize="10.5" fill="#64748b">단독 수행</text>
                      <rect x={78} y={0} width={10} height={10} rx="2" fill="#4338ca" />
                      <text x={92} y={9} fontSize="10.5" fill="#64748b">협업 수행</text>
                      <rect x={UPSET_PANEL_PROG_X} y={0} width={10} height={10} rx="2" fill="#10b981" />
                      <text x={UPSET_PANEL_PROG_X + 14} y={9} fontSize="10.5" fill="#64748b">70%↑</text>
                      <rect x={UPSET_PANEL_PROG_X + 50} y={0} width={10} height={10} rx="2" fill="#f59e0b" />
                      <text x={UPSET_PANEL_PROG_X + 64} y={9} fontSize="10.5" fill="#64748b">40%↑</text>
                      <rect x={UPSET_PANEL_PROG_X + 100} y={0} width={10} height={10} rx="2" fill="#ef4444" />
                      <text x={UPSET_PANEL_PROG_X + 114} y={9} fontSize="10.5" fill="#64748b">40%↓</text>
                    </g>

                    {/* 열 단위 히트 영역 (툴팁/클릭) - 레이블·막대·점 전체 */}
                    {combos.map((combo, i) => (
                      <UpsetColumnHit
                        key={`hit-${combo.key}`}
                        x={matrixX + i * UPSET_COL_W}
                        y={0}
                        width={UPSET_COL_W}
                        height={matrixTop + sets.length * UPSET_ROW_H}
                        fill="transparent"
                        onMouseMove={(e) => handleComboHover(e, combo)}
                        onMouseLeave={() => setHoveredCombo(null)}
                        onClick={() => handleComboClick(combo)}
                      />
                    ))}

                    {/* 축 설명 */}
                    <text
                      x={UPSET_LABEL_W - 10}
                      y={matrixTop + sets.length * UPSET_ROW_H + 20}
                      textAnchor="end"
                      fontSize="11"
                      fontWeight="600"
                      fill="#64748b"
                    >
                      조직명
                    </text>
                    <text
                      x={matrixX - UPSET_GAP}
                      y={matrixTop + sets.length * UPSET_ROW_H + 20}
                      textAnchor="end"
                      fontSize="11"
                      fontWeight="600"
                      fill="#64748b"
                    >
                      조직별 과제 수
                    </text>
                  </svg>
                </UpsetChartScroll>

                {/* 사업부 색상 범례 */}
                <ChartLegend>
                  {stackDivisions.map(div => (
                    <ChartLegendItem key={`ul-${div}`}>
                      <ChartLegendColor color={divisionColors[div] || '#6366f1'} />
                      {div}
                    </ChartLegendItem>
                  ))}
                </ChartLegend>
              </>
            )}

            <UpsetNote>
              <span>* 세로 막대 = 해당 조직 조합이 함께 수행하는 과제 수, 점 매트릭스 = 조합에 포함된 조직 (열 클릭 시 과제 목록, 좌측 조직명 클릭 시 해당 조직 전체 과제)</span>
              <span>* 가로 막대 = 조직별 총 과제 수 (다른 조직과의 협업 과제 포함)</span>
              <span>* 우측 패널 = 조직별 단독/협업 수행 비중, 평균 진척률, 진행상태 분포 (좌측 조직 행과 같은 줄, 「협업 조합만」 필터와 무관하게 항상 전체 기준)</span>
              {upsetData.hiddenSetCount > 0 && (
                <span>* 과제 수 상위 {upsetData.sets.length}개 조직만 표시 (조직 {upsetData.hiddenSetCount}개 제외
                  {upsetData.excludedByHiddenSets > 0 ? `, 제외된 조직만 참여한 과제 ${upsetData.excludedByHiddenSets}개 미집계` : ''})</span>
              )}
              {upsetData.hiddenComboCount > 0 && (
                <span>* 상위 {combos.length}개 조합만 표시 (조합 {upsetData.hiddenComboCount}개 생략) — 전체 내역은 「로컬 저장」 CSV에서 확인</span>
              )}
              {upsetData.noOrgCount > 0 && (
                <span>* 담당 조직이 지정되지 않은 과제 {upsetData.noOrgCount}개는 제외됨</span>
              )}
            </UpsetNote>
          </UpsetSection>
        </UpsetContent>

        {/* 조합 툴팁 */}
        {hoveredCombo && (
          <TooltipContainer
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              left: `${tooltipPos.x + 15}px`,
              top: `${tooltipPos.y - 60}px`
            }}
          >
            <TooltipDepartment>{hoveredCombo.departments.join(' ∩ ')}</TooltipDepartment>
            <TooltipInfo>
              과제 {hoveredCombo.count}개 · 조직 {hoveredCombo.degree}개
            </TooltipInfo>
            <TooltipInfo>
              {Object.entries(hoveredCombo.divisions).map(([d, c]) => `${d} ${c}`).join(' · ')}
            </TooltipInfo>
          </TooltipContainer>
        )}

        {/* 과제 목록 모달 */}
        {projectListModal}
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <HeaderLeft>
          <Title>
            <Building2 size={24} />
            부서별 현황
          </Title>
        </HeaderLeft>
        <HeaderRight>
          {canExport && (
            <ExportButton onClick={handleExportProjectStatusToCSV}>
              <Download size={16} />
              로컬 저장
            </ExportButton>
          )}
          {viewModeToggle}
          {yearSelector}
        </HeaderRight>
      </Header>

      <Content>
        {/* 사업부별 과제 현황 차트 */}
        <OverviewSection>
          <PanelTitle>
            <BarChart3 size={20} />
            사업부별 과제현황
          </PanelTitle>

          {/* 과제 상태(진행상태) 필터 토글 */}
          {availableProjectStatuses.length > 0 && (
            <StatusFilterBar>
              <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600, whiteSpace: 'nowrap' }}>과제 상태:</span>
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
            </StatusFilterBar>
          )}

          <OverviewChartContainer>
          {divisionDonutData.map((divisionData, divIndex) => (
            <DonutChartWrapper key={divisionData.division}>
              <DivisionTitle
                style={{ color: divisionData.baseColor }}
                onClick={() => handleDivisionClick(divisionData.division)}
                title={`${divisionData.division} 클릭하여 전체 과제 보기`}
              >
                {divisionData.division}
              </DivisionTitle>

              <div style={{ position: 'relative', width: '100%', maxWidth: '400px', aspectRatio: '1', overflow: 'visible' }}>
                <DonutSVG width="100%" height="100%" viewBox="-100 -40 600 480" style={{ display: 'block', overflow: 'visible' }}>
                  {(() => {
                    const centerX = 200;
                    const centerY = 200;
                    const outerRadius = 140;
                    const innerRadius = 90;

                    // 리더 라인 레이블 위치 계산 (겹침 방지 적용)
                    const labeledSegments = calculateLeaderLineLabels(
                      divisionData.segments,
                      centerX,
                      centerY,
                      outerRadius
                    );

                    return (
                      <>
                        {/* 도넛 세그먼트 */}
                        {divisionData.segments.map((segment, segIndex) => {
                          // 세그먼트 내부 숫자 위치 계산 (innerRadius와 outerRadius 중간)
                          const middleAngle = (segment.startAngle + segment.endAngle) / 2 - 90;
                          const countRadius = (innerRadius + outerRadius) / 2;
                          const countPos = polarToCartesian(centerX, centerY, countRadius, middleAngle);
                          const showCount = segment.percentage > 5; // 5% 이상일 때만 숫자 표시

                          return (
                            <g key={`segment-${divisionData.division}-${segment.department}`}>
                              <DonutSegment
                                d={createArc(segment.startAngle, segment.endAngle, outerRadius, innerRadius, centerX, centerY)}
                                fill={segment.color}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: divIndex * 0.1 + segIndex * 0.05, duration: 0.3 }}
                                onMouseMove={(e) => handleMouseMove(e, { ...segment, division: divisionData.division })}
                                onMouseLeave={() => setHoveredSegment(null)}
                                onClick={() => handleDepartmentClick(segment.department)}
                              />
                              {showCount && (
                                <SegmentCount
                                  x={countPos.x}
                                  y={countPos.y}
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  transition={{ delay: divIndex * 0.1 + segIndex * 0.05 + 0.15, duration: 0.3 }}
                                >
                                  {segment.count}
                                </SegmentCount>
                              )}
                            </g>
                          );
                        })}

                        {/* 리더 라인과 레이블 */}
                        {labeledSegments.map((labelData, segIndex) => {
                          const showLabel = labelData.percentage > 3; // 3% 이상일 때만 표시
                          if (!showLabel) return null;

                          // 레이블 위치가 원래 위치에서 이동했는지 확인 (겹침 방지로 인해)
                          const wasAdjusted = labelData.labelY !== labelData.originalY;

                          // 리더 라인: 세그먼트 가장자리 → 레이블 (조정된 경우만 표시)
                          const linePoints = wasAdjusted ? [
                            `${labelData.arcPoint.x},${labelData.arcPoint.y}`,
                            `${labelData.labelX},${labelData.labelY}`
                          ].join(' ') : null;

                          return (
                            <g key={`label-${divisionData.division}-${labelData.department}`}>
                              {linePoints && (
                                <LeaderLine
                                  points={linePoints}
                                  $color={labelData.color}
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 0.5 }}
                                  transition={{ delay: divIndex * 0.1 + segIndex * 0.05 + 0.2, duration: 0.3 }}
                                />
                              )}
                              <OuterLabel
                                x={labelData.labelX}
                                y={labelData.labelY}
                                textAnchor={labelData.isRight ? 'start' : 'end'}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: divIndex * 0.1 + segIndex * 0.05 + 0.2, duration: 0.3 }}
                              >
                                {labelData.department}
                              </OuterLabel>
                            </g>
                          );
                        })}
                      </>
                    );
                  })()}
                </DonutSVG>

                <CenterLabel>
                  <TotalCount>{divisionData.uniqueProjectCount}</TotalCount>
                  <TotalLabel>과제</TotalLabel>
                </CenterLabel>
              </div>
            </DonutChartWrapper>
          ))}
        </OverviewChartContainer>

        {/* 공통 툴팁 */}
        {hoveredSegment && (
          <TooltipContainer
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              left: `${tooltipPos.x + 15}px`,
              top: `${tooltipPos.y - 50}px`
            }}
          >
            <TooltipDepartment>{hoveredSegment.department}</TooltipDepartment>
            <TooltipInfo>
              {hoveredSegment.count}개 ({hoveredSegment.percentage.toFixed(1)}%)
            </TooltipInfo>
          </TooltipContainer>
        )}

        {/* 안내 문구 */}
        <InfoNote>* 부서간 협업 과제는 중복 카운팅 되어있음</InfoNote>
      </OverviewSection>

      {/* 부서 선택 패널 */}
      <DepartmentPanel>
        <PanelTitle>
          <Building2 size={20} />
          부서 선택
        </PanelTitle>

        <DepartmentListContainer>
          {departmentStats.map((dept, index) => (
            <DepartmentItem
              key={dept.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => handleDepartmentClick(dept.name)}
              isSelected={selectedDepartment === dept.name}
            >
              <DepartmentName>{dept.name}</DepartmentName>

              <DepartmentStats>
                <StatItem>
                  <FileText size={12} />
                  과제: {dept.projectCount}개
                </StatItem>
                <StatItem>
                  <Target size={12} />
                  성과: {dept.performanceCount}개
                </StatItem>
              </DepartmentStats>

              <BarChart>
                <Bar
                  color="#3b82f6"
                  height={(dept.projectCount / maxCount) * 100}
                >
                  <BarLabel>{dept.projectCount}</BarLabel>
                </Bar>
                <Bar
                  color="#10b981"
                  height={(dept.performanceCount / maxCount) * 100}
                >
                  <BarLabel>{dept.performanceCount}</BarLabel>
                </Bar>
              </BarChart>

              <BarLegend>
                <LegendItem>
                  <LegendColor color="#3b82f6" />
                  과제
                </LegendItem>
                <LegendItem>
                  <LegendColor color="#10b981" />
                  성과
                </LegendItem>
              </BarLegend>
            </DepartmentItem>
          ))}
        </DepartmentListContainer>
      </DepartmentPanel>

      {/* 과제 목록 모달 */}
      {projectListModal}
      </Content>
    </Container>
  );
};

export default DepartmentStatus;
