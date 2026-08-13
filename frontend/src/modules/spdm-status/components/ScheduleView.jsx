import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { ChevronDown, ChevronRight, Calendar, Filter, ZoomIn, ZoomOut, Plus, Edit2, Trash2, X, Check, ChevronUp, FileText, ArrowRight, Loader } from 'lucide-react';
import { spdmApi } from '../services/spdmApi';

// 날짜 문자열을 로컬 시간으로 파싱하는 헬퍼 함수
const parseLocalDate = (dateString) => {
  if (!dateString) return null;
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// 색상 팔레트
const COLOR_PALETTE = [
  '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#84cc16'
];

const Container = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #f8fafc;
  overflow: hidden;
`;

const Header = styled.div`
  padding: 1.25rem 1.5rem;
  background: white;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
`;

const Title = styled.h2`
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const FilterBar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const ZoomToggle = styled.div`
  display: flex;
  background: #f1f5f9;
  border-radius: 0.5rem;
  padding: 3px;
  border: 1px solid #e2e8f0;
`;

const ZoomButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  background: ${props => props.$active ? '#8b5cf6' : 'transparent'};
  color: ${props => props.$active ? 'white' : '#64748b'};

  &:hover {
    background: ${props => props.$active ? '#7c3aed' : '#e2e8f0'};
  }
`;

const YearSelector = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  padding: 0.25rem;
`;

const YearButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  color: #64748b;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #8b5cf6;
    border-color: #8b5cf6;
    color: white;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    &:hover {
      background: white;
      border-color: #e2e8f0;
      color: #64748b;
    }
  }
`;

const YearDisplay = styled.div`
  font-size: 0.9375rem;
  font-weight: 600;
  color: #1e293b;
  min-width: 90px;
  text-align: center;
  white-space: nowrap;
`;

const Legend = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.75rem;
  color: #64748b;
`;

const LegendItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;

  &::before {
    content: '';
    width: 16px;
    height: 10px;
    border-radius: 2px;
    ${props => {
      switch (props.$status) {
        case 'completed':
          return `
            background: #64748b;
          `;
        case 'in_progress':
          return `
            background: repeating-linear-gradient(
              -45deg,
              #64748b,
              #64748b 2px,
              transparent 2px,
              transparent 4px
            );
            border: 1px solid #64748b;
          `;
        case 'planned':
          return `
            background: transparent;
            border: 2px dashed #94a3b8;
          `;
        case 'delayed':
          return `
            background: #fee2e2;
            border: 2px solid #ef4444;
          `;
        default:
          return `background: #e2e8f0;`;
      }
    }}
  }
`;

const TimelineContainer = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: auto;
`;

const TimelineHeader = styled.div`
  display: flex;
  background: white;
  border-bottom: 2px solid #e2e8f0;
  position: sticky;
  top: 0;
  z-index: 10;
`;

const DepartmentColumn = styled.div`
  width: 400px;
  min-width: 400px;
  padding: 0.75rem 1rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #64748b;
  background: #f8fafc;
  border-right: 1px solid #e2e8f0;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const DepartmentColumnButtons = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
`;

const ToggleAllDeptButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: #e2e8f0;
  border: none;
  border-radius: 4px;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #cbd5e1;
    color: #475569;
  }
`;

const AddDeptButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: #8b5cf6;
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #7c3aed;
  }
`;

const MonthsRow = styled.div`
  flex: 1;
  display: flex;
`;

const MonthCell = styled.div`
  flex: 1;
  min-width: ${props => props.$zoomLevel === 'year' ? '20px' : '80px'};
  padding: ${props => props.$zoomLevel === 'year' ? '0.375rem 0' : '0.5rem 0.25rem'};
  text-align: center;
  font-size: ${props => props.$zoomLevel === 'year' ? '0.5625rem' : '0.8125rem'};
  font-weight: 500;
  color: #64748b;
  border-right: 1px solid #f1f5f9;
  background: ${props => props.$isCurrent ? '#faf5ff' : 'transparent'};
  box-sizing: border-box;

  &:last-child {
    border-right: none;
  }
`;

const YearHeader = styled.div`
  display: flex;
  border-bottom: 1px solid #e2e8f0;
`;

const YearLabel = styled.div`
  flex: 1;
  text-align: center;
  font-size: 0.75rem;
  font-weight: 600;
  color: #1e293b;
  padding: 0.375rem 0;
  background: ${props => props.$isCurrent ? '#f5f3ff' : '#f8fafc'};
  border-right: 2px solid #e2e8f0;
  border-bottom: 1px solid #e2e8f0;
  box-sizing: border-box;

  &:last-child {
    border-right: none;
  }
`;

const SwimlaneList = styled.div`
  flex: 1;
`;

const Swimlane = styled.div`
  border-bottom: 1px solid #e2e8f0;
  background: white;
`;

const SwimlaneHeader = styled.div`
  display: flex;
  align-items: center;
  transition: background 0.2s ease;
  border-bottom: ${props => props.$expanded ? '1px solid #f1f5f9' : 'none'};
  box-sizing: border-box;

  &:hover {
    background: #f8fafc;
  }
`;

const DepartmentInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 400px;
  min-width: 400px;
  padding: 0.875rem 1rem;
  border-right: 1px solid #e2e8f0;
  box-sizing: border-box;
`;

const ExpandIcon = styled.div`
  color: #94a3b8;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  cursor: pointer;
`;

const DepartmentDot = styled.div`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${props => props.$color};
  flex-shrink: 0;
`;

const DepartmentName = styled.span`
  font-size: 0.875rem;
  font-weight: 600;
  color: #1e293b;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ScheduleCount = styled.span`
  font-size: 0.6875rem;
  color: #94a3b8;
  flex-shrink: 0;
`;

const ActionButtons = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  opacity: 0;
  transition: opacity 0.2s ease;

  ${SwimlaneHeader}:hover & {
    opacity: 1;
  }
`;

const OrderButtonsVertical = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
  opacity: 0;
  transition: opacity 0.2s ease;
  margin-right: 0.25rem;

  ${SwimlaneHeader}:hover & {
    opacity: 1;
  }
`;

const SmallOrderButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 14px;
  background: #e2e8f0;
  border: none;
  border-radius: 3px;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s ease;
  padding: 0;

  &:hover:not(:disabled) {
    background: #8b5cf6;
    color: white;
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
`;

const ActionButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: ${props => props.$variant === 'danger' ? '#fee2e2' : '#f1f5f9'};
  border: none;
  border-radius: 4px;
  color: ${props => props.$variant === 'danger' ? '#ef4444' : '#64748b'};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.$variant === 'danger' ? '#fecaca' : '#e2e8f0'};
    color: ${props => props.$variant === 'danger' ? '#dc2626' : '#475569'};
  }
`;

const SwimlanePreview = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  height: 24px;
  position: relative;
`;

const PreviewBar = styled.div`
  position: absolute;
  height: 8px;
  background: ${props => props.$color}40;
  border-radius: 4px;
  left: ${props => props.$left}%;
  width: ${props => props.$width}%;
`;

const SwimlaneContent = styled.div`
  display: ${props => props.$expanded ? 'block' : 'none'};
`;

const ScheduleRow = styled.div`
  display: flex;
  align-items: center;
  min-height: 48px;
  border-bottom: 1px solid #f1f5f9;
  box-sizing: border-box;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: #fafafa;
  }
`;

const PhaseLabel = styled.div`
  width: 400px;
  min-width: 400px;
  padding: 0.5rem 1rem;
  padding-left: 2.25rem;
  font-size: 0.8125rem;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-right: 1px solid #e2e8f0;
  box-sizing: border-box;

  .phase {
    font-weight: 600;
    color: #475569;
    flex-shrink: 0;
  }

  .title {
    color: #94a3b8;
    font-size: 0.75rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }
`;

const ScheduleActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-left: auto;
  opacity: 0;
  transition: opacity 0.2s ease;

  ${ScheduleRow}:hover & {
    opacity: 1;
  }
`;

const ScheduleOrderButtons = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
  opacity: 0;
  transition: opacity 0.2s ease;
  margin-right: 0.375rem;

  ${ScheduleRow}:hover & {
    opacity: 1;
  }
`;

const AddScheduleRow = styled.div`
  display: flex;
  align-items: center;
  min-height: 36px;
  padding-left: 2.25rem;
  border-bottom: 1px solid #f1f5f9;
  box-sizing: border-box;
  cursor: pointer;
  color: #94a3b8;
  font-size: 0.8125rem;
  gap: 0.375rem;

  &:hover {
    background: #f8fafc;
    color: #8b5cf6;
  }
`;

const ScheduleBarContainer = styled.div`
  flex: 1;
  position: relative;
  height: 48px;
  display: flex;
  align-items: center;
`;

const ScheduleBar = styled.div`
  position: absolute;
  height: 28px;
  border-radius: 6px;
  left: ${props => props.$left}%;
  width: ${props => props.$width}%;
  min-width: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

  /* 상태별 패턴 스타일 */
  ${props => {
    switch (props.$status) {
      case 'completed':
        return `
          background: ${props.$color};
        `;
      case 'in_progress':
        return `
          background: repeating-linear-gradient(
            -45deg,
            ${props.$color},
            ${props.$color} 4px,
            ${props.$color}40 4px,
            ${props.$color}40 8px
          );
          border: 2px solid ${props.$color};
        `;
      case 'delayed':
        return `
          background: ${props.$color}30;
          border: 3px solid #ef4444;
        `;
      default:
        return `
          background: ${props.$color}15;
          border: 2px dashed ${props.$color};
        `;
    }
  }}

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }

  ${props => props.$status === 'in_progress' && `
    &::after {
      content: '';
      position: absolute;
      right: 6px;
      width: 8px;
      height: 8px;
      background: ${props.$color};
      border-radius: 50%;
      animation: pulse 1.5s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.8); }
    }
  `}

  ${props => props.$status === 'delayed' && `
    &::before {
      content: '!';
      position: absolute;
      left: 6px;
      width: 16px;
      height: 16px;
      background: #ef4444;
      border-radius: 50%;
      color: white;
      font-size: 0.75rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  `}
`;

const BarLabel = styled.span`
  font-size: 0.6875rem;
  font-weight: 700;
  color: #1e293b;
  text-shadow:
    -1px -1px 0 white,
    1px -1px 0 white,
    -1px 1px 0 white,
    1px 1px 0 white,
    0 0 3px white;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 0.5rem;
  padding-left: ${props => props.$status === 'delayed' ? '1.5rem' : '0.5rem'};
  z-index: 1;
`;

const GridLines = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  pointer-events: none;
`;

const GridLine = styled.div`
  flex: 1;
  border-right: 1px solid #f1f5f9;

  &:last-child {
    border-right: none;
  }
`;

const EmptyState = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: #94a3b8;

  svg {
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  p {
    font-size: 1rem;
    margin: 0;
  }
`;

const LoadingState = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: #8b5cf6;

  svg {
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  p {
    font-size: 1rem;
    margin: 0;
    color: #64748b;
  }
`;

const Toast = styled.div`
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  padding: 1rem 1.5rem;
  background: #1e293b;
  color: white;
  border-radius: 0.75rem;
  font-size: 0.875rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  z-index: 1100;
  animation: slideIn 0.3s ease;

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

// Content View Styles (개발 내용 뷰)
const ContentViewContainer = styled.div`
  flex: 1;
  overflow: auto;
  padding: 1.5rem;
`;

const ContentDeptRow = styled.div`
  background: white;
  border-radius: 12px;
  margin-bottom: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e2e8f0;
  overflow: hidden;
`;

const ContentDeptHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
`;

const ContentDeptDot = styled.div`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: ${props => props.$color};
  flex-shrink: 0;
`;

const ContentDeptName = styled.span`
  font-size: 1rem;
  font-weight: 600;
  color: #1e293b;
`;

const ContentPhasesContainer = styled.div`
  display: flex;
  align-items: stretch;
  padding: 1.25rem;
  gap: 0;
  overflow-x: auto;
`;

const ContentPhaseCard = styled.div`
  flex-shrink: 0;
  width: calc(33.333vw - 80px);
  min-width: 200px;
  max-width: 600px;
  background: ${props => props.$color}08;
  border: 2px solid ${props => props.$color}30;
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const ContentPhaseHeader = styled.div`
  background: ${props => props.$color};
  color: white;
  padding: 0.75rem 1rem;

  .phase-name {
    font-size: 0.875rem;
    font-weight: 700;
  }

  .phase-title {
    font-size: 0.75rem;
    opacity: 0.9;
    margin-top: 0.25rem;
  }
`;

const ContentPhaseBody = styled.div`
  padding: 0.75rem;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const ContentSubtitleItem = styled.div`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: ${props => props.$color};
    background: ${props => props.$color}05;
  }
`;

const ContentSubtitleHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #475569;

  .expand-icon {
    color: #94a3b8;
    transition: transform 0.2s ease;
    transform: rotate(${props => props.$expanded ? '90deg' : '0deg'});
  }

  .subtitle-text {
    flex: 1;
  }
`;

const ContentSubtitleDetail = styled.div`
  padding: ${props => props.$expanded ? '0.5rem 0.75rem 0.75rem 1.75rem' : '0'};
  max-height: ${props => props.$expanded ? '500px' : '0'};
  overflow: hidden;
  transition: all 0.2s ease;
  font-size: 0.75rem;
  color: #64748b;
  line-height: 1.5;
  background: #f8fafc;
  border-top: ${props => props.$expanded ? '1px solid #e2e8f0' : 'none'};
  white-space: pre-wrap;
`;

const ContentViewHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-bottom: 1rem;
  gap: 0.5rem;
`;

const ExpandAllButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.875rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.8125rem;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
    color: #475569;
  }
`;

const ContentEmptySubtitles = styled.div`
  color: #94a3b8;
  font-size: 0.75rem;
  text-align: center;
  padding: 1rem 0.5rem;
  font-style: italic;
`;

const ContentPhaseConnector = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  flex-shrink: 0;
  color: #cbd5e1;
`;

const ContentEmptyDept = styled.div`
  padding: 2rem;
  text-align: center;
  color: #94a3b8;
  font-size: 0.875rem;
`;

// Schedule Detail Modal (바 클릭 시 상세 보기)
const DetailModalContent = styled.div`
  background: white;
  border-radius: 12px;
  width: 80%;
  max-width: 80%;
  height: 80%;
  max-height: 80%;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const DetailModalHeader = styled.div`
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
`;

const DetailModalTitle = styled.div`
  flex: 1;

  .dept-name {
    font-size: 0.75rem;
    color: #64748b;
    margin-bottom: 0.25rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .dept-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${props => props.$color};
  }

  .phase-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0;
  }

  .schedule-title {
    font-size: 0.875rem;
    color: #64748b;
    margin-top: 0.25rem;
  }
`;

const DetailModalBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
`;

const DetailInfoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid #e2e8f0;
`;

const DetailInfoItem = styled.div`
  .label {
    font-size: 0.75rem;
    color: #94a3b8;
    margin-bottom: 0.25rem;
  }

  .value {
    font-size: 0.875rem;
    color: #1e293b;
    font-weight: 500;
  }
`;

const DetailStatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.625rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;

  ${props => {
    switch (props.$status) {
      case 'completed':
        return `background: #dcfce7; color: #166534;`;
      case 'in_progress':
        return `background: #dbeafe; color: #1d4ed8;`;
      case 'delayed':
        return `background: #fee2e2; color: #dc2626;`;
      default:
        return `background: #f1f5f9; color: #64748b;`;
    }
  }}
`;

const DetailContentsSection = styled.div`
  h4 {
    font-size: 0.9375rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0 0 1rem 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
`;

const DetailContentItem = styled.div`
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 0.75rem;

  &:last-child {
    margin-bottom: 0;
  }

  .content-number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    background: ${props => props.$color};
    color: white;
    border-radius: 4px;
    font-size: 0.6875rem;
    font-weight: 600;
    margin-right: 0.5rem;
  }

  .content-subtitle {
    font-size: 0.875rem;
    font-weight: 600;
    color: #1e293b;
    display: inline;
  }

  .content-detail {
    margin-top: 0.5rem;
    font-size: 0.8125rem;
    color: #64748b;
    line-height: 1.6;
    white-space: pre-wrap;
  }
`;

const DetailEmptyContents = styled.div`
  text-align: center;
  padding: 2rem;
  color: #94a3b8;
  font-size: 0.875rem;
  background: #f8fafc;
  border-radius: 8px;
`;

// Modal Styles
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

const ModalContent = styled.div`
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  width: 100%;
  max-width: 480px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;

  h3 {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0;
  }
`;

const CloseButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: #f1f5f9;
  border: none;
  border-radius: 8px;
  color: #64748b;
  cursor: pointer;

  &:hover {
    background: #e2e8f0;
  }
`;

const FormGroup = styled.div`
  margin-bottom: 1rem;

  label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: #475569;
    margin-bottom: 0.5rem;
  }

  input, select {
    width: 100%;
    padding: 0.625rem 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font-size: 0.875rem;
    color: #1e293b;
    box-sizing: border-box;

    &:focus {
      outline: none;
      border-color: #8b5cf6;
      box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
    }
  }
`;

const ColorPicker = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const ColorOption = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 3px solid ${props => props.$selected ? '#1e293b' : 'transparent'};
  background: ${props => props.$color};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    transform: scale(1.1);
  }
`;

const FormRow = styled.div`
  display: flex;
  gap: 1rem;

  ${FormGroup} {
    flex: 1;
  }
`;

const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e2e8f0;
`;

const Button = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.625rem 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  ${props => props.$variant === 'primary' ? `
    background: #8b5cf6;
    border: none;
    color: white;

    &:hover {
      background: #7c3aed;
    }
  ` : props.$variant === 'danger' ? `
    background: #fee2e2;
    border: none;
    color: #ef4444;

    &:hover {
      background: #fecaca;
    }
  ` : `
    background: white;
    border: 1px solid #e2e8f0;
    color: #64748b;

    &:hover {
      background: #f8fafc;
    }
  `}
`;

const ConfirmModal = styled(ModalContent)`
  max-width: 400px;
  text-align: center;

  p {
    color: #64748b;
    margin: 0 0 1.5rem 0;
    font-size: 0.9375rem;
  }
`;

// 일정 모달 (80% 크기)
const ScheduleModalContent = styled(ModalContent)`
  width: 80%;
  max-width: 80%;
  height: 80%;
  max-height: 80%;
  display: flex;
  flex-direction: column;
  padding: 0;
`;

const ScheduleModalHeader = styled(ModalHeader)`
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #e2e8f0;
  margin-bottom: 0;
`;

const ScheduleModalBody = styled.div`
  flex: 1;
  display: flex;
  overflow: hidden;
`;

const ScheduleModalLeft = styled.div`
  width: 360px;
  min-width: 360px;
  padding: 1.5rem;
  border-right: 1px solid #e2e8f0;
  overflow-y: auto;
`;

const ScheduleModalRight = styled.div`
  flex: 1;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const ContentsHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;

  h4 {
    font-size: 0.9375rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0;
  }
`;

const AddContentButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  background: #f1f5f9;
  border: 1px dashed #cbd5e1;
  border-radius: 6px;
  color: #64748b;
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #e2e8f0;
    border-color: #8b5cf6;
    color: #8b5cf6;
  }
`;

const ContentsList = styled.div`
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const ContentItem = styled.div`
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1rem;
  position: relative;

  &:hover {
    border-color: #cbd5e1;
  }
`;

const ContentItemHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
`;

const ContentOrderButtons = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.2s ease;

  ${ContentItem}:hover & {
    opacity: 1;
  }
`;

const OrderButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 16px;
  background: #e2e8f0;
  border: none;
  border-radius: 3px;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s ease;
  padding: 0;

  &:hover:not(:disabled) {
    background: #8b5cf6;
    color: white;
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
`;

const ContentNumber = styled.span`
  font-size: 0.75rem;
  font-weight: 600;
  color: white;
  background: #8b5cf6;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
`;

const ContentDeleteButton = styled.button`
  margin-left: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #fee2e2;
    color: #ef4444;
  }
`;

const ContentInputGroup = styled.div`
  margin-bottom: 0.75rem;

  &:last-child {
    margin-bottom: 0;
  }

  label {
    display: block;
    font-size: 0.75rem;
    font-weight: 500;
    color: #64748b;
    margin-bottom: 0.375rem;
  }

  input, textarea {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #1e293b;
    box-sizing: border-box;
    background: white;

    &:focus {
      outline: none;
      border-color: #8b5cf6;
      box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.1);
    }
  }

  textarea {
    resize: none;
    min-height: 60px;
    font-family: inherit;
    overflow: hidden;
  }
`;

const EmptyContents = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  text-align: center;
  padding: 2rem;

  p {
    margin: 0.5rem 0 0 0;
    font-size: 0.875rem;
  }
`;

const ScheduleModalFooter = styled(ModalFooter)`
  padding: 1rem 1.5rem;
  margin-top: 0;
  border-top: 1px solid #e2e8f0;
`;


const ScheduleView = ({ departments = [] }) => {
  const [scheduleData, setScheduleData] = useState([]);
  const [expandedDepts, setExpandedDepts] = useState(new Set());
  const [zoomLevel, setZoomLevel] = useState('year');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [yearViewStartYear, setYearViewStartYear] = useState(new Date().getFullYear() - 2); // 연간 뷰 시작 연도
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const timelineRef = useRef(null);

  // Modal states
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [currentDeptId, setCurrentDeptId] = useState(null);
  const [viewingSchedule, setViewingSchedule] = useState(null); // { dept, schedule }

  // Form states
  const [deptForm, setDeptForm] = useState({ name: '', color: COLOR_PALETTE[0] });
  const [scheduleForm, setScheduleForm] = useState({
    phase: '',
    title: '',
    startDate: '',
    endDate: '',
    status: 'planned',
    contents: []
  });

  // Toast message
  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  };

  // Load data from backend
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await spdmApi.getScheduleDepartments();
      setScheduleData(data);
    } catch (error) {
      console.error('일정 데이터 로드 실패:', error);
      showToast('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Content view state (소제목 펼치기/접기)
  const [expandedSubtitles, setExpandedSubtitles] = useState(new Set());

  // 소제목 펼치기/접기 토글
  const toggleSubtitle = (contentId) => {
    setExpandedSubtitles(prev => {
      const next = new Set(prev);
      if (next.has(contentId)) {
        next.delete(contentId);
      } else {
        next.add(contentId);
      }
      return next;
    });
  };

  // 전체 펼치기/접기
  const expandAllSubtitles = () => {
    const allContentIds = new Set();
    scheduleData.forEach(dept => {
      dept.schedules.forEach(schedule => {
        if (schedule.contents) {
          schedule.contents.forEach(content => {
            allContentIds.add(content.id);
          });
        }
      });
    });
    setExpandedSubtitles(allContentIds);
  };

  const collapseAllSubtitles = () => {
    setExpandedSubtitles(new Set());
  };

  const isAllExpanded = useMemo(() => {
    let totalContents = 0;
    scheduleData.forEach(dept => {
      dept.schedules.forEach(schedule => {
        if (schedule.contents) {
          totalContents += schedule.contents.length;
        }
      });
    });
    return totalContents > 0 && expandedSubtitles.size === totalContents;
  }, [scheduleData, expandedSubtitles]);

  // 바 클릭 시 상세 보기 모달 열기
  const openDetailModal = (dept, schedule) => {
    setViewingSchedule({ dept, schedule });
    setDetailModalOpen(true);
  };

  // ID generators (no longer needed for backend, but kept for content items)
  const generateContentId = () => Date.now();

  // 전체 일정 범위 계산 (연간 뷰용)
  // 연간 뷰: yearViewStartYear 기반으로 5년 범위 계산
  const dateRange = useMemo(() => {
    const MAX_YEARS = 5;
    return {
      minYear: yearViewStartYear,
      maxYear: yearViewStartYear + MAX_YEARS - 1
    };
  }, [yearViewStartYear]);

  // 연간 뷰 이전/다음 핸들러
  const handlePrevYearRange = () => {
    setYearViewStartYear(prev => prev - 1);
  };

  const handleNextYearRange = () => {
    setYearViewStartYear(prev => prev + 1);
  };

  // 연간 뷰: 연도별 월 목록 생성
  const yearlyTimeline = useMemo(() => {
    if (zoomLevel !== 'year') return null;
    const years = [];
    for (let y = dateRange.minYear; y <= dateRange.maxYear; y++) {
      const months = [];
      for (let m = 0; m < 12; m++) {
        const now = new Date();
        months.push({
          year: y,
          month: m + 1,
          label: `${m + 1}`,
          isCurrent: now.getFullYear() === y && now.getMonth() === m
        });
      }
      years.push({ year: y, months, isCurrent: new Date().getFullYear() === y });
    }
    return years;
  }, [zoomLevel, dateRange]);

  // 월별 뷰: 선택된 연도의 월 목록
  const monthlyTimeline = useMemo(() => {
    if (zoomLevel !== 'month') return null;
    return Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      label: `${i + 1}월`,
      isCurrent: new Date().getFullYear() === selectedYear && new Date().getMonth() === i
    }));
  }, [zoomLevel, selectedYear]);

  // 전체 타임라인 기간 (일수)
  const totalTimelineDays = useMemo(() => {
    if (zoomLevel === 'year') {
      const start = new Date(dateRange.minYear, 0, 1);
      const end = new Date(dateRange.maxYear, 11, 31);
      return (end - start) / (1000 * 60 * 60 * 24);
    } else {
      return 365;
    }
  }, [zoomLevel, dateRange]);

  // 타임라인 시작일
  const timelineStart = useMemo(() => {
    if (zoomLevel === 'year') {
      return new Date(dateRange.minYear, 0, 1);
    } else {
      return new Date(selectedYear, 0, 1);
    }
  }, [zoomLevel, dateRange, selectedYear]);

  // 타임라인 종료일
  const timelineEnd = useMemo(() => {
    if (zoomLevel === 'year') {
      return new Date(dateRange.maxYear, 11, 31);
    } else {
      return new Date(selectedYear, 11, 31);
    }
  }, [zoomLevel, dateRange, selectedYear]);

  // 일정 바 위치 계산
  const calculateBarPosition = (startDate, endDate) => {
    const start = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);

    if (!start || !end) return { left: 0, width: 0, visible: false };

    let startPos = ((start - timelineStart) / (1000 * 60 * 60 * 24)) / totalTimelineDays * 100;
    let endPos = ((end - timelineStart) / (1000 * 60 * 60 * 24)) / totalTimelineDays * 100;

    startPos = Math.max(0, startPos);
    endPos = Math.min(100, endPos);

    if (endPos <= 0 || startPos >= 100) {
      return { left: 0, width: 0, visible: false };
    }

    return {
      left: startPos,
      width: Math.max(endPos - startPos, 1),
      visible: true
    };
  };

  // 필터링된 데이터 (뷰 범위에 따라)
  const filteredData = useMemo(() => {
    return scheduleData.map(dept => ({
      ...dept,
      schedules: dept.schedules.filter(schedule => {
        const start = parseLocalDate(schedule.startDate);
        const end = parseLocalDate(schedule.endDate);
        if (!start || !end) return false;
        if (end < timelineStart || start > timelineEnd) return false;
        return true;
      })
    }));
  }, [scheduleData, timelineStart, timelineEnd]);

  const toggleExpand = (deptId) => {
    setExpandedDepts(prev => {
      const next = new Set(prev);
      if (next.has(deptId)) {
        next.delete(deptId);
      } else {
        next.add(deptId);
      }
      return next;
    });
  };

  // 사업부 전체 펼치기/접기
  const expandAllDepts = () => {
    setExpandedDepts(new Set(scheduleData.map(d => d.departmentId)));
  };

  const collapseAllDepts = () => {
    setExpandedDepts(new Set());
  };

  const isAllDeptsExpanded = useMemo(() => {
    return scheduleData.length > 0 && scheduleData.every(d => expandedDepts.has(d.departmentId));
  }, [scheduleData, expandedDepts]);

  const getStatusLabel = (status) => {
    switch (status) {
      case 'completed': return '완료';
      case 'in_progress': return '진행중';
      case 'delayed': return '지연';
      default: return '예정';
    }
  };

  // 연도 변경 핸들러
  const handlePrevYear = () => {
    if (zoomLevel === 'month') {
      setSelectedYear(prev => prev - 1);
    }
  };

  const handleNextYear = () => {
    if (zoomLevel === 'month') {
      setSelectedYear(prev => prev + 1);
    }
  };

  // Department CRUD
  const openAddDeptModal = () => {
    setEditingDept(null);
    setDeptForm({ name: '', color: COLOR_PALETTE[0] });
    setDeptModalOpen(true);
  };

  const openEditDeptModal = (dept) => {
    setEditingDept(dept);
    setDeptForm({ name: dept.departmentName, color: dept.color });
    setDeptModalOpen(true);
  };

  const handleSaveDept = async () => {
    if (!deptForm.name.trim()) return;

    setSaving(true);
    try {
      if (editingDept) {
        const updated = await spdmApi.updateScheduleDepartment(editingDept.departmentId, {
          name: deptForm.name,
          color: deptForm.color
        });
        setScheduleData(prev => prev.map(d =>
          d.departmentId === updated.departmentId ? updated : d
        ));
        showToast('사업부가 수정되었습니다.');
      } else {
        const created = await spdmApi.createScheduleDepartment({
          name: deptForm.name,
          color: deptForm.color
        });
        setScheduleData(prev => [...prev, created]);
        setExpandedDepts(prev => new Set([...prev, created.departmentId]));
        showToast('사업부가 추가되었습니다.');
      }
      setDeptModalOpen(false);
    } catch (error) {
      console.error('사업부 저장 실패:', error);
      showToast('사업부 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const openDeleteDeptModal = (dept) => {
    setDeleteTarget({ type: 'dept', data: dept });
    setDeleteModalOpen(true);
  };

  // Department order
  const moveDepartment = async (deptId, direction) => {
    const index = scheduleData.findIndex(d => d.departmentId === deptId);
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= scheduleData.length) return;

    const newData = [...scheduleData];
    [newData[index], newData[newIndex]] = [newData[newIndex], newData[index]];
    setScheduleData(newData);

    // Save new order to backend
    try {
      await spdmApi.reorderScheduleDepartments(newData.map(d => d.departmentId));
    } catch (error) {
      console.error('사업부 순서 변경 실패:', error);
      // Revert on error
      loadData();
    }
  };

  // Schedule order within department
  const moveSchedule = async (deptId, scheduleId, direction) => {
    const dept = scheduleData.find(d => d.departmentId === deptId);
    if (!dept) return;

    const schedules = [...dept.schedules];
    const index = schedules.findIndex(s => s.id === scheduleId);
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= schedules.length) return;

    [schedules[index], schedules[newIndex]] = [schedules[newIndex], schedules[index]];

    setScheduleData(prev => prev.map(d =>
      d.departmentId === deptId ? { ...d, schedules } : d
    ));

    // Save new order to backend
    try {
      await spdmApi.reorderScheduleItems(deptId, schedules.map(s => s.id));
    } catch (error) {
      console.error('일정 순서 변경 실패:', error);
      // Revert on error
      loadData();
    }
  };

  // Schedule CRUD
  const openAddScheduleModal = (deptId) => {
    setCurrentDeptId(deptId);
    setEditingSchedule(null);
    setScheduleForm({
      phase: '',
      title: '',
      startDate: '',
      endDate: '',
      status: 'planned',
      contents: []
    });
    setScheduleModalOpen(true);
  };

  const openEditScheduleModal = (deptId, schedule) => {
    setCurrentDeptId(deptId);
    setEditingSchedule(schedule);
    setScheduleForm({
      phase: schedule.phase,
      title: schedule.title,
      startDate: schedule.startDate,
      endDate: schedule.endDate,
      status: schedule.status,
      contents: schedule.contents ? [...schedule.contents] : []
    });
    setScheduleModalOpen(true);
  };

  // Content item management
  const addContentItem = () => {
    const newContent = {
      id: generateContentId(),
      subtitle: '',
      detail: ''
    };
    setScheduleForm(prev => ({
      ...prev,
      contents: [...prev.contents, newContent]
    }));
  };

  const updateContentItem = (contentId, field, value) => {
    setScheduleForm(prev => ({
      ...prev,
      contents: prev.contents.map(c =>
        c.id === contentId ? { ...c, [field]: value } : c
      )
    }));
  };

  const deleteContentItem = (contentId) => {
    setScheduleForm(prev => ({
      ...prev,
      contents: prev.contents.filter(c => c.id !== contentId)
    }));
  };

  const moveContentItem = (index, direction) => {
    setScheduleForm(prev => {
      const newContents = [...prev.contents];
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= newContents.length) return prev;

      // Swap items
      [newContents[index], newContents[newIndex]] = [newContents[newIndex], newContents[index]];

      return {
        ...prev,
        contents: newContents
      };
    });
  };

  const handleSaveSchedule = async () => {
    if (!scheduleForm.phase.trim() || !scheduleForm.title.trim() ||
        !scheduleForm.startDate || !scheduleForm.endDate) return;

    // Filter out empty content items
    const filteredContents = scheduleForm.contents.filter(
      c => c.subtitle.trim() || c.detail.trim()
    );

    setSaving(true);
    try {
      if (editingSchedule) {
        const updated = await spdmApi.updateScheduleItem(editingSchedule.id, {
          phase: scheduleForm.phase,
          title: scheduleForm.title,
          startDate: scheduleForm.startDate,
          endDate: scheduleForm.endDate,
          status: scheduleForm.status,
          contents: filteredContents
        });

        setScheduleData(prev => prev.map(dept => {
          if (dept.departmentId !== currentDeptId) return dept;
          return {
            ...dept,
            schedules: dept.schedules.map(s =>
              s.id === editingSchedule.id ? updated : s
            )
          };
        }));
        showToast('일정이 수정되었습니다.');
      } else {
        const created = await spdmApi.createScheduleItem({
          departmentId: currentDeptId,
          phase: scheduleForm.phase,
          title: scheduleForm.title,
          startDate: scheduleForm.startDate,
          endDate: scheduleForm.endDate,
          status: scheduleForm.status,
          contents: filteredContents
        });

        setScheduleData(prev => prev.map(dept => {
          if (dept.departmentId !== currentDeptId) return dept;
          return {
            ...dept,
            schedules: [...dept.schedules, created]
          };
        }));
        showToast('일정이 추가되었습니다.');
      }
      setScheduleModalOpen(false);
    } catch (error) {
      console.error('일정 저장 실패:', error);
      showToast('일정 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const openDeleteScheduleModal = (deptId, schedule) => {
    setDeleteTarget({ type: 'schedule', deptId, data: schedule });
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      if (deleteTarget.type === 'dept') {
        await spdmApi.deleteScheduleDepartment(deleteTarget.data.departmentId);
        setScheduleData(prev => prev.filter(d => d.departmentId !== deleteTarget.data.departmentId));
        showToast('사업부가 삭제되었습니다.');
      } else if (deleteTarget.type === 'schedule') {
        await spdmApi.deleteScheduleItem(deleteTarget.data.id);
        setScheduleData(prev => prev.map(dept => {
          if (dept.departmentId !== deleteTarget.deptId) return dept;
          return {
            ...dept,
            schedules: dept.schedules.filter(s => s.id !== deleteTarget.data.id)
          };
        }));
        showToast('일정이 삭제되었습니다.');
      }
      setDeleteModalOpen(false);
      setDeleteTarget(null);
    } catch (error) {
      console.error('삭제 실패:', error);
      showToast('삭제에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container>
      <Header>
        <Title>
          <Calendar size={22} />
          플랫폼 개발 일정 공유
        </Title>
        <FilterBar>
          {(zoomLevel === 'month' || zoomLevel === 'year') && (
            <Legend>
              <LegendItem $status="completed">완료</LegendItem>
              <LegendItem $status="in_progress">진행중</LegendItem>
              <LegendItem $status="planned">예정</LegendItem>
              <LegendItem $status="delayed">지연</LegendItem>
            </Legend>
          )}
          {zoomLevel === 'month' && (
            <YearSelector>
              <YearButton onClick={handlePrevYear} title="이전 년도">
                ‹
              </YearButton>
              <YearDisplay>{selectedYear}년</YearDisplay>
              <YearButton onClick={handleNextYear} title="다음 년도">
                ›
              </YearButton>
            </YearSelector>
          )}
          {zoomLevel === 'year' && (
            <YearSelector>
              <YearButton onClick={handlePrevYearRange} title="이전 기간">
                ‹
              </YearButton>
              <YearDisplay>{dateRange.minYear}~{dateRange.maxYear}년</YearDisplay>
              <YearButton onClick={handleNextYearRange} title="다음 기간">
                ›
              </YearButton>
            </YearSelector>
          )}
          <ZoomToggle>
            <ZoomButton
              $active={zoomLevel === 'month'}
              onClick={() => setZoomLevel('month')}
              title="월별 보기"
            >
              <ZoomIn size={16} />
              <span>월별</span>
            </ZoomButton>
            <ZoomButton
              $active={zoomLevel === 'year'}
              onClick={() => setZoomLevel('year')}
              title="연간 보기"
            >
              <ZoomOut size={16} />
              <span>연간</span>
            </ZoomButton>
            <ZoomButton
              $active={zoomLevel === 'content'}
              onClick={() => setZoomLevel('content')}
              title="요약 보기"
            >
              <FileText size={16} />
              <span>요약</span>
            </ZoomButton>
          </ZoomToggle>
        </FilterBar>
      </Header>

      {/* Loading State */}
      {loading && (
        <LoadingState>
          <Loader size={48} />
          <p>데이터를 불러오는 중...</p>
        </LoadingState>
      )}

      {/* Timeline View - 월별 */}
      {!loading && zoomLevel === 'month' && (
      <TimelineContainer ref={timelineRef}>
        <TimelineHeader>
          <DepartmentColumn>
            <span>사업부</span>
            <DepartmentColumnButtons>
              <ToggleAllDeptButton
                onClick={isAllDeptsExpanded ? collapseAllDepts : expandAllDepts}
                title={isAllDeptsExpanded ? '전체 접기' : '전체 펼치기'}
              >
                {isAllDeptsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </ToggleAllDeptButton>
              <AddDeptButton onClick={openAddDeptModal} title="사업부 추가">
                <Plus size={14} />
              </AddDeptButton>
            </DepartmentColumnButtons>
          </DepartmentColumn>
          <MonthsRow>
            {monthlyTimeline.map(m => (
              <MonthCell key={m.month} $isCurrent={m.isCurrent} $zoomLevel={zoomLevel}>
                {m.label}
              </MonthCell>
            ))}
          </MonthsRow>
        </TimelineHeader>

        <SwimlaneList>
          {filteredData.length > 0 ? (
            filteredData.map((dept, deptIndex) => {
              const isExpanded = expandedDepts.has(dept.departmentId);
              const gridCellCount = 12;
              const originalDept = scheduleData.find(d => d.departmentId === dept.departmentId);
              return (
                <Swimlane key={dept.departmentId}>
                  <SwimlaneHeader $expanded={isExpanded}>
                    <DepartmentInfo>
                      <OrderButtonsVertical>
                        <SmallOrderButton
                          onClick={(e) => { e.stopPropagation(); moveDepartment(dept.departmentId, -1); }}
                          disabled={deptIndex === 0}
                          title="위로 이동"
                        >
                          <ChevronUp size={10} />
                        </SmallOrderButton>
                        <SmallOrderButton
                          onClick={(e) => { e.stopPropagation(); moveDepartment(dept.departmentId, 1); }}
                          disabled={deptIndex === filteredData.length - 1}
                          title="아래로 이동"
                        >
                          <ChevronDown size={10} />
                        </SmallOrderButton>
                      </OrderButtonsVertical>
                      <ExpandIcon onClick={() => toggleExpand(dept.departmentId)}>
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </ExpandIcon>
                      <DepartmentDot $color={dept.color} />
                      <DepartmentName>{dept.departmentName}</DepartmentName>
                      <ScheduleCount>({originalDept.schedules.length})</ScheduleCount>
                      <ActionButtons>
                        <ActionButton
                          onClick={(e) => { e.stopPropagation(); openEditDeptModal(dept); }}
                          title="수정"
                        >
                          <Edit2 size={12} />
                        </ActionButton>
                        <ActionButton
                          $variant="danger"
                          onClick={(e) => { e.stopPropagation(); openDeleteDeptModal(dept); }}
                          title="삭제"
                        >
                          <Trash2 size={12} />
                        </ActionButton>
                      </ActionButtons>
                    </DepartmentInfo>
                    {!isExpanded && (
                      <SwimlanePreview>
                        <GridLines>
                          {Array.from({ length: gridCellCount }, (_, i) => <GridLine key={i} />)}
                        </GridLines>
                        {dept.schedules.map(schedule => {
                          const pos = calculateBarPosition(schedule.startDate, schedule.endDate);
                          if (!pos.visible) return null;
                          return (
                            <PreviewBar
                              key={schedule.id}
                              $color={schedule.status === 'delayed' ? '#ef4444' : dept.color}
                              $left={pos.left}
                              $width={pos.width}
                            />
                          );
                        })}
                      </SwimlanePreview>
                    )}
                  </SwimlaneHeader>
                  <SwimlaneContent $expanded={isExpanded}>
                    {originalDept.schedules.map((schedule, scheduleIndex) => {
                      const pos = calculateBarPosition(schedule.startDate, schedule.endDate);
                      return (
                        <ScheduleRow key={schedule.id}>
                          <PhaseLabel>
                            <ScheduleOrderButtons>
                              <SmallOrderButton
                                onClick={() => moveSchedule(dept.departmentId, schedule.id, -1)}
                                disabled={scheduleIndex === 0}
                                title="위로 이동"
                              >
                                <ChevronUp size={10} />
                              </SmallOrderButton>
                              <SmallOrderButton
                                onClick={() => moveSchedule(dept.departmentId, schedule.id, 1)}
                                disabled={scheduleIndex === originalDept.schedules.length - 1}
                                title="아래로 이동"
                              >
                                <ChevronDown size={10} />
                              </SmallOrderButton>
                            </ScheduleOrderButtons>
                            <span className="phase">{schedule.phase}</span>
                            <span className="title">{schedule.title}</span>
                            <ScheduleActions>
                              <ActionButton
                                onClick={() => openEditScheduleModal(dept.departmentId, schedule)}
                                title="수정"
                              >
                                <Edit2 size={12} />
                              </ActionButton>
                              <ActionButton
                                $variant="danger"
                                onClick={() => openDeleteScheduleModal(dept.departmentId, schedule)}
                                title="삭제"
                              >
                                <Trash2 size={12} />
                              </ActionButton>
                            </ScheduleActions>
                          </PhaseLabel>
                          <ScheduleBarContainer>
                            <GridLines>
                              {Array.from({ length: gridCellCount }, (_, i) => <GridLine key={i} />)}
                            </GridLines>
                            {pos.visible && (
                              <ScheduleBar
                                $color={dept.color}
                                $status={schedule.status}
                                $left={pos.left}
                                $width={pos.width}
                                title={`${schedule.phase}: ${schedule.title}\n${schedule.startDate} ~ ${schedule.endDate}\n상태: ${getStatusLabel(schedule.status)}\n클릭하여 상세 보기`}
                                onClick={() => openDetailModal(dept, schedule)}
                              >
                                <BarLabel $status={schedule.status} $color={dept.color}>{schedule.phase} {schedule.title}</BarLabel>
                              </ScheduleBar>
                            )}
                          </ScheduleBarContainer>
                        </ScheduleRow>
                      );
                    })}
                    <AddScheduleRow onClick={() => openAddScheduleModal(dept.departmentId)}>
                      <Plus size={14} />
                      <span>일정 추가</span>
                    </AddScheduleRow>
                  </SwimlaneContent>
                </Swimlane>
              );
            })
          ) : (
            <EmptyState>
              <Filter size={48} />
              <p>등록된 사업부가 없습니다.</p>
              <Button $variant="primary" onClick={openAddDeptModal} style={{ marginTop: '1rem' }}>
                <Plus size={16} />
                사업부 추가
              </Button>
            </EmptyState>
          )}
        </SwimlaneList>
      </TimelineContainer>
      )}

      {/* Timeline View - 연간 */}
      {!loading && zoomLevel === 'year' && yearlyTimeline && (
      <TimelineContainer ref={timelineRef}>
        <TimelineHeader>
          <DepartmentColumn>
            <span>사업부</span>
            <DepartmentColumnButtons>
              <ToggleAllDeptButton
                onClick={isAllDeptsExpanded ? collapseAllDepts : expandAllDepts}
                title={isAllDeptsExpanded ? '전체 접기' : '전체 펼치기'}
              >
                {isAllDeptsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </ToggleAllDeptButton>
              <AddDeptButton onClick={openAddDeptModal} title="사업부 추가">
                <Plus size={14} />
              </AddDeptButton>
            </DepartmentColumnButtons>
          </DepartmentColumn>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <YearHeader>
              {yearlyTimeline.map(y => (
                <YearLabel
                  key={y.year}
                  $isCurrent={y.isCurrent}
                >
                  {y.year}년
                </YearLabel>
              ))}
            </YearHeader>
            <MonthsRow>
              {yearlyTimeline.flatMap(y =>
                y.months.map(m => (
                  <MonthCell
                    key={`${y.year}-${m.month}`}
                    $isCurrent={m.isCurrent}
                    $zoomLevel={zoomLevel}
                  >
                    {m.label}
                  </MonthCell>
                ))
              )}
            </MonthsRow>
          </div>
        </TimelineHeader>

        <SwimlaneList>
          {filteredData.length > 0 ? (
            filteredData.map((dept, deptIndex) => {
              const isExpanded = expandedDepts.has(dept.departmentId);
              const gridCellCount = yearlyTimeline.reduce((sum, y) => sum + y.months.length, 0);
              const originalDept = scheduleData.find(d => d.departmentId === dept.departmentId);
              return (
                <Swimlane key={dept.departmentId}>
                  <SwimlaneHeader $expanded={isExpanded}>
                    <DepartmentInfo>
                      <OrderButtonsVertical>
                        <SmallOrderButton
                          onClick={(e) => { e.stopPropagation(); moveDepartment(dept.departmentId, -1); }}
                          disabled={deptIndex === 0}
                          title="위로 이동"
                        >
                          <ChevronUp size={10} />
                        </SmallOrderButton>
                        <SmallOrderButton
                          onClick={(e) => { e.stopPropagation(); moveDepartment(dept.departmentId, 1); }}
                          disabled={deptIndex === filteredData.length - 1}
                          title="아래로 이동"
                        >
                          <ChevronDown size={10} />
                        </SmallOrderButton>
                      </OrderButtonsVertical>
                      <ExpandIcon onClick={() => toggleExpand(dept.departmentId)}>
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </ExpandIcon>
                      <DepartmentDot $color={dept.color} />
                      <DepartmentName>{dept.departmentName}</DepartmentName>
                      <ScheduleCount>({originalDept.schedules.length})</ScheduleCount>
                      <ActionButtons>
                        <ActionButton
                          onClick={(e) => { e.stopPropagation(); openEditDeptModal(dept); }}
                          title="수정"
                        >
                          <Edit2 size={12} />
                        </ActionButton>
                        <ActionButton
                          $variant="danger"
                          onClick={(e) => { e.stopPropagation(); openDeleteDeptModal(dept); }}
                          title="삭제"
                        >
                          <Trash2 size={12} />
                        </ActionButton>
                      </ActionButtons>
                    </DepartmentInfo>
                    {!isExpanded && (
                      <SwimlanePreview>
                        <GridLines>
                          {Array.from({ length: gridCellCount }, (_, i) => <GridLine key={i} />)}
                        </GridLines>
                        {dept.schedules.map(schedule => {
                          const pos = calculateBarPosition(schedule.startDate, schedule.endDate);
                          if (!pos.visible) return null;
                          return (
                            <PreviewBar
                              key={schedule.id}
                              $color={schedule.status === 'delayed' ? '#ef4444' : dept.color}
                              $left={pos.left}
                              $width={pos.width}
                            />
                          );
                        })}
                      </SwimlanePreview>
                    )}
                  </SwimlaneHeader>
                  <SwimlaneContent $expanded={isExpanded}>
                    {originalDept.schedules.map((schedule, scheduleIndex) => {
                      const pos = calculateBarPosition(schedule.startDate, schedule.endDate);
                      return (
                        <ScheduleRow key={schedule.id}>
                          <PhaseLabel>
                            <ScheduleOrderButtons>
                              <SmallOrderButton
                                onClick={() => moveSchedule(dept.departmentId, schedule.id, -1)}
                                disabled={scheduleIndex === 0}
                                title="위로 이동"
                              >
                                <ChevronUp size={10} />
                              </SmallOrderButton>
                              <SmallOrderButton
                                onClick={() => moveSchedule(dept.departmentId, schedule.id, 1)}
                                disabled={scheduleIndex === originalDept.schedules.length - 1}
                                title="아래로 이동"
                              >
                                <ChevronDown size={10} />
                              </SmallOrderButton>
                            </ScheduleOrderButtons>
                            <span className="phase">{schedule.phase}</span>
                            <span className="title">{schedule.title}</span>
                            <ScheduleActions>
                              <ActionButton
                                onClick={() => openEditScheduleModal(dept.departmentId, schedule)}
                                title="수정"
                              >
                                <Edit2 size={12} />
                              </ActionButton>
                              <ActionButton
                                $variant="danger"
                                onClick={() => openDeleteScheduleModal(dept.departmentId, schedule)}
                                title="삭제"
                              >
                                <Trash2 size={12} />
                              </ActionButton>
                            </ScheduleActions>
                          </PhaseLabel>
                          <ScheduleBarContainer>
                            <GridLines>
                              {Array.from({ length: gridCellCount }, (_, i) => <GridLine key={i} />)}
                            </GridLines>
                            {pos.visible && (
                              <ScheduleBar
                                $color={dept.color}
                                $status={schedule.status}
                                $left={pos.left}
                                $width={pos.width}
                                title={`${schedule.phase}: ${schedule.title}\n${schedule.startDate} ~ ${schedule.endDate}\n상태: ${getStatusLabel(schedule.status)}\n클릭하여 상세 보기`}
                                onClick={() => openDetailModal(dept, schedule)}
                              >
                                <BarLabel $status={schedule.status} $color={dept.color}>{schedule.phase} {schedule.title}</BarLabel>
                              </ScheduleBar>
                            )}
                          </ScheduleBarContainer>
                        </ScheduleRow>
                      );
                    })}
                    <AddScheduleRow onClick={() => openAddScheduleModal(dept.departmentId)}>
                      <Plus size={14} />
                      <span>일정 추가</span>
                    </AddScheduleRow>
                  </SwimlaneContent>
                </Swimlane>
              );
            })
          ) : (
            <EmptyState>
              <Filter size={48} />
              <p>등록된 사업부가 없습니다.</p>
              <Button $variant="primary" onClick={openAddDeptModal} style={{ marginTop: '1rem' }}>
                <Plus size={16} />
                사업부 추가
              </Button>
            </EmptyState>
          )}
        </SwimlaneList>
      </TimelineContainer>
      )}

      {/* Content View (개발 내용) */}
      {!loading && zoomLevel === 'content' && (
        <ContentViewContainer>
          <ContentViewHeader>
            <ExpandAllButton onClick={isAllExpanded ? collapseAllSubtitles : expandAllSubtitles}>
              {isAllExpanded ? (
                <>
                  <ChevronUp size={14} />
                  전체 접기
                </>
              ) : (
                <>
                  <ChevronDown size={14} />
                  전체 펼치기
                </>
              )}
            </ExpandAllButton>
          </ContentViewHeader>
          {scheduleData.length > 0 ? (
            scheduleData.map(dept => (
              <ContentDeptRow key={dept.departmentId}>
                <ContentDeptHeader>
                  <ContentDeptDot $color={dept.color} />
                  <ContentDeptName>{dept.departmentName}</ContentDeptName>
                </ContentDeptHeader>
                {dept.schedules.length > 0 ? (
                  <ContentPhasesContainer>
                    {dept.schedules.map((schedule, index) => (
                      <React.Fragment key={schedule.id}>
                        <ContentPhaseCard $color={dept.color}>
                          <ContentPhaseHeader $color={dept.color}>
                            <div className="phase-name">{schedule.phase}</div>
                            <div className="phase-title">{schedule.title}</div>
                          </ContentPhaseHeader>
                          <ContentPhaseBody>
                            {schedule.contents && schedule.contents.length > 0 ? (
                              schedule.contents.map(content => (
                                <ContentSubtitleItem
                                  key={content.id}
                                  $color={dept.color}
                                  onClick={() => toggleSubtitle(content.id)}
                                >
                                  <ContentSubtitleHeader $expanded={expandedSubtitles.has(content.id)}>
                                    <ChevronRight size={14} className="expand-icon" />
                                    <span className="subtitle-text">{content.subtitle}</span>
                                  </ContentSubtitleHeader>
                                  <ContentSubtitleDetail $expanded={expandedSubtitles.has(content.id)}>
                                    {content.detail || '상세 내용 없음'}
                                  </ContentSubtitleDetail>
                                </ContentSubtitleItem>
                              ))
                            ) : (
                              <ContentEmptySubtitles>
                                등록된 내용 없음
                              </ContentEmptySubtitles>
                            )}
                          </ContentPhaseBody>
                        </ContentPhaseCard>
                        {index < dept.schedules.length - 1 && (
                          <ContentPhaseConnector>
                            <ArrowRight size={20} />
                          </ContentPhaseConnector>
                        )}
                      </React.Fragment>
                    ))}
                  </ContentPhasesContainer>
                ) : (
                  <ContentEmptyDept>등록된 일정이 없습니다.</ContentEmptyDept>
                )}
              </ContentDeptRow>
            ))
          ) : (
            <EmptyState>
              <Filter size={48} />
              <p>등록된 사업부가 없습니다.</p>
              <Button $variant="primary" onClick={openAddDeptModal} style={{ marginTop: '1rem' }}>
                <Plus size={16} />
                사업부 추가
              </Button>
            </EmptyState>
          )}
        </ContentViewContainer>
      )}

      {/* Department Modal */}
      {deptModalOpen && (
        <ModalOverlay onClick={() => setDeptModalOpen(false)}>
          <ModalContent onClick={e => e.stopPropagation()}>
            <ModalHeader>
              <h3>{editingDept ? '사업부 수정' : '사업부 추가'}</h3>
              <CloseButton onClick={() => setDeptModalOpen(false)}>
                <X size={18} />
              </CloseButton>
            </ModalHeader>
            <FormGroup>
              <label>사업부명</label>
              <input
                type="text"
                value={deptForm.name}
                onChange={e => setDeptForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="사업부명을 입력하세요"
                autoFocus
              />
            </FormGroup>
            <FormGroup>
              <label>색상</label>
              <ColorPicker>
                {COLOR_PALETTE.map(color => (
                  <ColorOption
                    key={color}
                    $color={color}
                    $selected={deptForm.color === color}
                    onClick={() => setDeptForm(prev => ({ ...prev, color }))}
                  />
                ))}
              </ColorPicker>
            </FormGroup>
            <ModalFooter>
              <Button onClick={() => setDeptModalOpen(false)} disabled={saving}>취소</Button>
              <Button $variant="primary" onClick={handleSaveDept} disabled={saving}>
                {saving ? <Loader size={16} /> : <Check size={16} />}
                {editingDept ? '수정' : '추가'}
              </Button>
            </ModalFooter>
          </ModalContent>
        </ModalOverlay>
      )}

      {/* Schedule Modal */}
      {scheduleModalOpen && (
        <ModalOverlay onClick={() => setScheduleModalOpen(false)}>
          <ScheduleModalContent onClick={e => e.stopPropagation()}>
            <ScheduleModalHeader>
              <h3>{editingSchedule ? '일정 수정' : '일정 추가'}</h3>
              <CloseButton onClick={() => setScheduleModalOpen(false)}>
                <X size={18} />
              </CloseButton>
            </ScheduleModalHeader>
            <ScheduleModalBody>
              <ScheduleModalLeft>
                <FormRow>
                  <FormGroup>
                    <label>차수</label>
                    <input
                      type="text"
                      value={scheduleForm.phase}
                      onChange={e => setScheduleForm(prev => ({ ...prev, phase: e.target.value }))}
                      placeholder="예: 1차"
                      autoFocus
                    />
                  </FormGroup>
                  <FormGroup>
                    <label>상태</label>
                    <select
                      value={scheduleForm.status}
                      onChange={e => setScheduleForm(prev => ({ ...prev, status: e.target.value }))}
                    >
                      <option value="planned">예정</option>
                      <option value="in_progress">진행중</option>
                      <option value="completed">완료</option>
                      <option value="delayed">지연</option>
                    </select>
                  </FormGroup>
                </FormRow>
                <FormGroup>
                  <label>제목</label>
                  <input
                    type="text"
                    value={scheduleForm.title}
                    onChange={e => setScheduleForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="일정 제목을 입력하세요"
                  />
                </FormGroup>
                <FormRow>
                  <FormGroup>
                    <label>시작일</label>
                    <input
                      type="date"
                      value={scheduleForm.startDate}
                      onChange={e => setScheduleForm(prev => ({ ...prev, startDate: e.target.value }))}
                    />
                  </FormGroup>
                  <FormGroup>
                    <label>종료일</label>
                    <input
                      type="date"
                      value={scheduleForm.endDate}
                      onChange={e => setScheduleForm(prev => ({ ...prev, endDate: e.target.value }))}
                    />
                  </FormGroup>
                </FormRow>
              </ScheduleModalLeft>
              <ScheduleModalRight>
                <ContentsHeader>
                  <h4>내용</h4>
                  <AddContentButton onClick={addContentItem}>
                    <Plus size={14} />
                    항목 추가
                  </AddContentButton>
                </ContentsHeader>
                <ContentsList>
                  {scheduleForm.contents.length > 0 ? (
                    scheduleForm.contents.map((content, index) => (
                      <ContentItem key={content.id}>
                        <ContentItemHeader>
                          <ContentOrderButtons>
                            <OrderButton
                              onClick={() => moveContentItem(index, -1)}
                              disabled={index === 0}
                              title="위로 이동"
                            >
                              <ChevronUp size={12} />
                            </OrderButton>
                            <OrderButton
                              onClick={() => moveContentItem(index, 1)}
                              disabled={index === scheduleForm.contents.length - 1}
                              title="아래로 이동"
                            >
                              <ChevronDown size={12} />
                            </OrderButton>
                          </ContentOrderButtons>
                          <ContentNumber>{index + 1}</ContentNumber>
                          <ContentDeleteButton onClick={() => deleteContentItem(content.id)}>
                            <Trash2 size={14} />
                          </ContentDeleteButton>
                        </ContentItemHeader>
                        <ContentInputGroup>
                          <label>소제목</label>
                          <input
                            type="text"
                            value={content.subtitle}
                            onChange={e => updateContentItem(content.id, 'subtitle', e.target.value)}
                            placeholder="소제목을 입력하세요"
                          />
                        </ContentInputGroup>
                        <ContentInputGroup>
                          <label>상세</label>
                          <textarea
                            value={content.detail}
                            onChange={e => {
                              updateContentItem(content.id, 'detail', e.target.value);
                              // 자동 높이 조절
                              e.target.style.height = 'auto';
                              e.target.style.height = `${e.target.scrollHeight}px`;
                            }}
                            onInput={e => {
                              // 자동 높이 조절
                              e.target.style.height = 'auto';
                              e.target.style.height = `${e.target.scrollHeight}px`;
                            }}
                            placeholder="상세 내용을 입력하세요"
                            style={{ overflow: 'hidden' }}
                          />
                        </ContentInputGroup>
                      </ContentItem>
                    ))
                  ) : (
                    <EmptyContents>
                      <Plus size={32} />
                      <p>항목 추가 버튼을 클릭하여<br />내용을 추가하세요</p>
                    </EmptyContents>
                  )}
                </ContentsList>
              </ScheduleModalRight>
            </ScheduleModalBody>
            <ScheduleModalFooter>
              <Button onClick={() => setScheduleModalOpen(false)} disabled={saving}>취소</Button>
              <Button $variant="primary" onClick={handleSaveSchedule} disabled={saving}>
                {saving ? <Loader size={16} /> : <Check size={16} />}
                {editingSchedule ? '수정' : '추가'}
              </Button>
            </ScheduleModalFooter>
          </ScheduleModalContent>
        </ModalOverlay>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && deleteTarget && (
        <ModalOverlay onClick={() => setDeleteModalOpen(false)}>
          <ConfirmModal onClick={e => e.stopPropagation()}>
            <ModalHeader>
              <h3>삭제 확인</h3>
              <CloseButton onClick={() => setDeleteModalOpen(false)}>
                <X size={18} />
              </CloseButton>
            </ModalHeader>
            <p>
              {deleteTarget.type === 'dept'
                ? `"${deleteTarget.data.departmentName}" 사업부와 모든 일정을 삭제하시겠습니까?`
                : `"${deleteTarget.data.phase} ${deleteTarget.data.title}" 일정을 삭제하시겠습니까?`
              }
            </p>
            <ModalFooter style={{ justifyContent: 'center', borderTop: 'none', paddingTop: 0 }}>
              <Button onClick={() => setDeleteModalOpen(false)} disabled={saving}>취소</Button>
              <Button $variant="danger" onClick={handleDelete} disabled={saving}>
                {saving ? <Loader size={16} /> : <Trash2 size={16} />}
                삭제
              </Button>
            </ModalFooter>
          </ConfirmModal>
        </ModalOverlay>
      )}

      {/* Schedule Detail Modal (바 클릭 시 상세 보기) */}
      {detailModalOpen && viewingSchedule && (
        <ModalOverlay onClick={() => setDetailModalOpen(false)}>
          <DetailModalContent onClick={e => e.stopPropagation()}>
            <DetailModalHeader>
              <DetailModalTitle $color={viewingSchedule.dept.color}>
                <div className="dept-name">
                  <span className="dept-dot" />
                  {viewingSchedule.dept.departmentName}
                </div>
                <h3 className="phase-title">{viewingSchedule.schedule.phase}</h3>
                <div className="schedule-title">{viewingSchedule.schedule.title}</div>
              </DetailModalTitle>
              <CloseButton onClick={() => setDetailModalOpen(false)}>
                <X size={18} />
              </CloseButton>
            </DetailModalHeader>
            <DetailModalBody>
              <DetailInfoGrid>
                <DetailInfoItem>
                  <div className="label">시작일</div>
                  <div className="value">{viewingSchedule.schedule.startDate}</div>
                </DetailInfoItem>
                <DetailInfoItem>
                  <div className="label">종료일</div>
                  <div className="value">{viewingSchedule.schedule.endDate}</div>
                </DetailInfoItem>
                <DetailInfoItem>
                  <div className="label">상태</div>
                  <div className="value">
                    <DetailStatusBadge $status={viewingSchedule.schedule.status}>
                      {getStatusLabel(viewingSchedule.schedule.status)}
                    </DetailStatusBadge>
                  </div>
                </DetailInfoItem>
                <DetailInfoItem>
                  <div className="label">개발 항목 수</div>
                  <div className="value">{viewingSchedule.schedule.contents?.length || 0}개</div>
                </DetailInfoItem>
              </DetailInfoGrid>

              <DetailContentsSection>
                <h4>
                  <FileText size={18} />
                  개발 내용
                </h4>
                {viewingSchedule.schedule.contents && viewingSchedule.schedule.contents.length > 0 ? (
                  viewingSchedule.schedule.contents.map((content, index) => (
                    <DetailContentItem key={content.id} $color={viewingSchedule.dept.color}>
                      <span className="content-number">{index + 1}</span>
                      <span className="content-subtitle">{content.subtitle}</span>
                      {content.detail && (
                        <div className="content-detail">{content.detail}</div>
                      )}
                    </DetailContentItem>
                  ))
                ) : (
                  <DetailEmptyContents>
                    등록된 개발 내용이 없습니다.
                  </DetailEmptyContents>
                )}
              </DetailContentsSection>
            </DetailModalBody>
          </DetailModalContent>
        </ModalOverlay>
      )}

      {/* Toast Message */}
      {toast && <Toast>{toast}</Toast>}
    </Container>
  );
};

export default ScheduleView;
