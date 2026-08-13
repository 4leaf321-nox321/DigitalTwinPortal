import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import styled from 'styled-components';
import {
  Plus, Edit2, Trash2, X, Calendar, Clock, FileText,
  Users2, ChevronRight, Search, Paperclip, Download, FolderDown, AlertTriangle, Check,
  List, LayoutGrid, ArrowLeftRight, MessageSquare
} from 'lucide-react';
import Header from './components/Layout/Header';
import ReportPlanTable from './components/ReportPlanTable';
import ReportPlanSummary from './components/ReportPlanSummary';
import ReportPlanCrossView from './components/ReportPlanCrossView';
import ReportPlanCommentPanel from './components/ReportPlanCommentPanel';
import ReportPlanNoticeModal, { ReportPlanNoticeBanner } from './components/ReportPlanNotice';
import { meetingApi } from './services/meetingApi';
import { useAuth } from '../../contexts/AuthContext';
import { toLocalYmd } from '../../shared/utils/localDate';

// ============== Styled Components ==============

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f8fafc;
`;

const Content = styled.main`
  flex: 1;
  display: flex;
  overflow: hidden;
`;

const MasterPanel = styled.aside`
  width: 320px;
  min-width: 320px;
  background: white;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
`;

const MasterHeader = styled.div`
  padding: 1rem;
  border-bottom: 1px solid #e2e8f0;
`;

const MasterTitle = styled.h2`
  font-size: 1rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 0.75rem 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const AddButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.75rem;
  background: #8b5cf6;
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #7c3aed;
  }
`;

const SearchBox = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;

  input {
    flex: 1;
    border: none;
    background: none;
    font-size: 0.875rem;
    color: #1e293b;
    outline: none;

    &::placeholder {
      color: #94a3b8;
    }
  }
`;

const MasterList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
`;

const GroupItem = styled.div`
  padding: 0.875rem;
  margin-bottom: 0.375rem;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
  background: ${props => props.selected ? '#f5f3ff' : 'transparent'};
  border-color: ${props => props.selected ? '#8b5cf6' : 'transparent'};

  &:hover {
    background: ${props => props.selected ? '#f5f3ff' : '#f8fafc'};
  }
`;

const GroupHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.375rem;
`;

const GroupColorDot = styled.span`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${props => props.color || '#3b82f6'};
  flex-shrink: 0;
`;

const GroupName = styled.span`
  font-size: 0.9375rem;
  font-weight: 500;
  color: #1e293b;
  flex: 1;
`;

const GroupBadge = styled.span`
  font-size: 0.6875rem;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  background: ${props => {
    switch (props.type) {
      case 'council': return '#dbeafe';
      case 'meeting': return '#dcfce7';
      case 'report': return '#fef3c7';
      default: return '#f1f5f9';
    }
  }};
  color: ${props => {
    switch (props.type) {
      case 'council': return '#1d4ed8';
      case 'meeting': return '#15803d';
      case 'report': return '#b45309';
      default: return '#475569';
    }
  }};
`;

const GroupMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.75rem;
  color: #64748b;
`;

const DetailPanel = styled.section`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const DetailHeader = styled.div`
  padding: 1rem 1.5rem;
  background: white;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const DetailTitleSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const DetailTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const DetailSubtitle = styled.span`
  font-size: 0.875rem;
  color: #64748b;
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ActionButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.875rem;
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid #e2e8f0;
  background: white;
  color: #475569;

  &:hover {
    background: #f8fafc;
    border-color: #8b5cf6;
    color: #8b5cf6;
  }

  &.primary {
    background: #8b5cf6;
    border-color: #8b5cf6;
    color: white;

    &:hover {
      background: #7c3aed;
    }
  }

  &.danger {
    &:hover {
      border-color: #ef4444;
      color: #ef4444;
    }
  }
`;

const DetailContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
`;

const GroupInfoCard = styled.div`
  background: white;
  border-radius: 0.75rem;
  border: 1px solid #e2e8f0;
  padding: 1.25rem;
  margin-bottom: 1.5rem;
`;

const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
`;

const InfoItem = styled.div`
  .label {
    font-size: 0.75rem;
    color: #64748b;
    margin-bottom: 0.25rem;
  }
  .value {
    font-size: 0.9375rem;
    color: #1e293b;
    font-weight: 500;
  }
`;

const TimelineSection = styled.div`
  margin-top: 1rem;
`;

const TimelineSectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;

  h3 {
    font-size: 1rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0;
  }
`;

const Timeline = styled.div`
  position: relative;
  padding-left: 1.5rem;

  &::before {
    content: '';
    position: absolute;
    left: 0.375rem;
    top: 0;
    bottom: 0;
    width: 2px;
    background: #e2e8f0;
  }
`;

const TimelineItem = styled.div`
  position: relative;
  padding-bottom: 1.5rem;

  &:last-child {
    padding-bottom: 0;
  }

  &::before {
    content: '';
    position: absolute;
    left: -1.125rem;
    top: 0.25rem;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: ${props => props.color || '#8b5cf6'};
    border: 2px solid white;
    box-shadow: 0 0 0 2px ${props => props.color || '#8b5cf6'};
  }
`;

const SessionCard = styled.div`
  background: white;
  border-radius: 0.75rem;
  border: 1px solid #e2e8f0;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: #8b5cf6;
    box-shadow: 0 2px 8px rgba(139, 92, 246, 0.1);
  }
`;

const SessionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
`;

const SessionTitle = styled.span`
  font-size: 0.9375rem;
  font-weight: 600;
  color: #1e293b;
`;

const SessionDate = styled.span`
  font-size: 0.8125rem;
  color: #64748b;
`;

const SessionMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.8125rem;
  color: #64748b;

  span {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
`;

const SessionDetailList = styled.div`
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #f1f5f9;
`;

const SessionDetailSection = styled.div`
  margin-bottom: 0.75rem;

  &:last-child {
    margin-bottom: 0;
  }
`;

const SessionDetailLabel = styled.div`
  font-size: 0.6875rem;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  margin-bottom: 0.375rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const SessionAgendaList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const SessionAgendaItem = styled.div`
  background: #f8fafc;
  border-radius: 0.375rem;
  padding: 0.5rem 0.75rem;
  border-left: 3px solid #8b5cf6;
`;

const SessionAgendaTitle = styled.div`
  font-size: 0.8125rem;
  font-weight: 500;
  color: #1e293b;
  margin-bottom: 0.25rem;
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
`;

const SessionAgendaNumber = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  background: #8b5cf6;
  color: white;
  border-radius: 50%;
  font-size: 0.6875rem;
  font-weight: 600;
  flex-shrink: 0;
`;

const SessionAgendaContent = styled.div`
  font-size: 0.75rem;
  color: #64748b;
  line-height: 1.5;
  white-space: pre-wrap;
  margin-left: 1.625rem;
`;

const SessionAttachmentList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
`;

const SessionAttachmentChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  background: #f1f5f9;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  color: #475569;
  word-break: break-all;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #64748b;
  text-align: center;
  padding: 3rem;

  svg {
    margin-bottom: 1rem;
    opacity: 0.5;
  }
`;

// ============== Modal Components ==============

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 1rem;
`;

const Modal = styled.div`
  background: white;
  border-radius: 0.75rem;
  width: 100%;
  max-width: ${props => props.large ? '700px' : '500px'};
  max-height: 85vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const ModalHeader = styled.div`
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ModalTitle = styled.h3`
  font-size: 1.125rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
`;

const ModalCloseButton = styled.button`
  background: none;
  border: none;
  padding: 0.25rem;
  cursor: pointer;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.375rem;

  &:hover {
    background: #f1f5f9;
    color: #1e293b;
  }
`;

const ModalContent = styled.div`
  padding: 1.25rem;
  overflow-y: auto;
  flex: 1;
`;

const ModalFooter = styled.div`
  padding: 1rem 1.25rem;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
`;

const FormGroup = styled.div`
  margin-bottom: 1rem;

  &:last-child {
    margin-bottom: 0;
  }
`;

const Label = styled.label`
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.375rem;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.625rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.9375rem;
  color: #1e293b;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: #8b5cf6;
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 0.625rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.9375rem;
  color: #1e293b;
  background: white;

  &:focus {
    outline: none;
    border-color: #8b5cf6;
  }
`;

const Textarea = styled.textarea`
  width: 100%;
  padding: 0.625rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.9375rem;
  color: #1e293b;
  min-height: 100px;
  resize: vertical;

  &:focus {
    outline: none;
    border-color: #8b5cf6;
  }
`;

const FormRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
`;

const ColorPicker = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const ColorOption = styled.button`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid ${props => props.selected ? '#1e293b' : 'transparent'};
  background: ${props => props.color};
  cursor: pointer;
  transition: transform 0.2s;

  &:hover {
    transform: scale(1.1);
  }
`;

const Button = styled.button`
  padding: 0.625rem 1.25rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid #e2e8f0;
  background: white;
  color: #475569;

  &:hover {
    background: #f8fafc;
  }

  &.primary {
    background: #8b5cf6;
    border-color: #8b5cf6;
    color: white;

    &:hover {
      background: #7c3aed;
    }
  }

  &.danger {
    background: #ef4444;
    border-color: #ef4444;
    color: white;

    &:hover {
      background: #dc2626;
    }
  }
`;

// ============== Conflict Modal Styled Components ==============

const ConflictModal = styled.div`
  background: white;
  border-radius: 0.75rem;
  width: 100%;
  max-width: 1000px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const ConflictHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-bottom: 1px solid #f59e0b;
`;

const ConflictTitle = styled.h3`
  font-size: 1.125rem;
  font-weight: 600;
  color: #92400e;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ConflictDescription = styled.p`
  font-size: 0.875rem;
  color: #a16207;
  margin: 0;
  margin-left: auto;
`;

const ConflictContent = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
`;

const ConflictPane = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  border-right: ${props => props.$isLeft ? '1px solid #e2e8f0' : 'none'};
  overflow: hidden;
`;

const ConflictPaneHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: ${props => props.$selected ? '#f5f3ff' : '#f8fafc'};
  border-bottom: 1px solid #e2e8f0;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: ${props => props.$selected ? '#f5f3ff' : '#f1f5f9'};
  }
`;

const ConflictPaneTitle = styled.div`
  font-size: 0.875rem;
  font-weight: 600;
  color: ${props => props.$selected ? '#7c3aed' : '#475569'};
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ConflictPaneTime = styled.span`
  font-size: 0.75rem;
  color: #94a3b8;
  font-weight: 400;
`;

const SelectButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: ${props => props.$selected ? '#8b5cf6' : 'white'};
  color: ${props => props.$selected ? 'white' : '#64748b'};
  border: 1px solid ${props => props.$selected ? '#8b5cf6' : '#e2e8f0'};
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: ${props => props.$selected ? '#7c3aed' : '#f8fafc'};
  }
`;

const ConflictPaneBody = styled.div`
  flex: 1;
  padding: 1rem;
  overflow-y: auto;
  background: ${props => props.$selected ? '#faf5ff' : 'white'};
`;

const ConflictFieldGroup = styled.div`
  margin-bottom: 1rem;

  &:last-child {
    margin-bottom: 0;
  }
`;

const ConflictFieldLabel = styled.div`
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
  margin-bottom: 0.375rem;
  text-transform: uppercase;
  letter-spacing: 0.025em;
`;

const ConflictFieldValue = styled.div`
  font-size: 0.875rem;
  color: #1e293b;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  padding: 0.625rem 0.75rem;
  white-space: pre-wrap;
  line-height: 1.5;
  max-height: 200px;
  overflow-y: auto;
`;

const ConflictFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid #e2e8f0;
  background: white;
`;

// Session Detail Components
const SessionDetailCard = styled.div`
  background: white;
  border-radius: 0.75rem;
  border: 1px solid #e2e8f0;
  margin-bottom: 1rem;
`;

const SessionDetailHeader = styled.div`
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const SessionDetailContent = styled.div`
  padding: 1.25rem;
`;

const AgendaList = styled.div`
  margin-top: 1rem;
`;

const AgendaItem = styled.div`
  padding: 0.75rem;
  background: #f8fafc;
  border-radius: 0.5rem;
  margin-bottom: 0.5rem;
  display: flex;
  gap: 0.75rem;

  &:last-child {
    margin-bottom: 0;
  }
`;

const AgendaNumber = styled.span`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #8b5cf6;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
  flex-shrink: 0;
`;

const AgendaContent = styled.div`
  flex: 1;

  .title {
    font-size: 0.9375rem;
    font-weight: 500;
    color: #1e293b;
    margin-bottom: 0.25rem;
  }

  .content {
    font-size: 0.8125rem;
    color: #64748b;
    white-space: pre-wrap;
  }
`;

const AttachmentList = styled.div`
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e2e8f0;
`;

const AttachmentItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: #f8fafc;
  border-radius: 0.375rem;
  margin-bottom: 0.375rem;
  font-size: 0.8125rem;

  &:last-child {
    margin-bottom: 0;
  }

  .filename {
    flex: 1;
    color: #1e293b;
  }

  button {
    background: none;
    border: none;
    padding: 0.25rem;
    cursor: pointer;
    color: #64748b;
    display: flex;
    align-items: center;

    &:hover {
      color: #8b5cf6;
    }

    &.delete:hover {
      color: #ef4444;
    }
  }
`;

// ============== Constants ==============

const MEETING_TYPES = [
  { value: 'council', label: '협의체' },
  { value: 'meeting', label: '회의체' },
  { value: 'report', label: '보고' }
];

const CYCLES = [
  { value: 'weekly', label: '주간' },
  { value: 'biweekly', label: '격주' },
  { value: 'monthly', label: '월간' },
  { value: 'quarterly', label: '분기' },
  { value: 'irregular', label: '비정기' }
];

const COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444',
  '#f59e0b', '#10b981', '#14b8a6', '#64748b'
];

// ============== Helper Functions ==============

const getMeetingTypeLabel = (type) => {
  const found = MEETING_TYPES.find(t => t.value === type);
  return found ? found.label : type;
};

const getCycleLabel = (cycle) => {
  const found = CYCLES.find(c => c.value === cycle);
  return found ? found.label : cycle;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// ============== Report Plan Styled Components ==============

const PlanContainer = styled.div`
  flex: 1;
  display: flex;
  flex-direction: row;
  overflow: hidden;
  background: #f8fafc;
`;

const PlanMainArea = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: auto;
  min-width: 0;
`;

const CommentToggleBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.35rem 0.75rem;
  border: none;
  border-radius: 0.25rem;
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  background: ${props => props.$active ? '#f5f3ff' : 'transparent'};
  color: ${props => props.$active ? '#7c3aed' : '#64748b'};
  margin-left: 0.5rem;

  &:hover {
    color: #7c3aed;
    background: #f5f3ff;
  }
`;

/* PlanTabBar replaced by PlanTabBarRow */

const PlanTab = styled.button`
  padding: 0.75rem 1.5rem;
  border: none;
  background: transparent;
  font-size: 0.9rem;
  font-weight: 600;
  color: ${props => props.active ? '#8b5cf6' : '#64748b'};
  cursor: pointer;
  border-bottom: 2px solid ${props => props.active ? '#8b5cf6' : 'transparent'};
  transition: all 0.2s;
  margin-bottom: -1px;

  &:hover {
    color: ${props => props.active ? '#8b5cf6' : '#1e293b'};
  }
`;

const PlanTabBarRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1.5rem 0;
  background: white;
  border-bottom: 1px solid #e2e8f0;
  position: sticky;
  top: 0;
  z-index: 2;
`;

const PlanTabGroup = styled.div`
  display: flex;
  gap: 0;
`;

const PlanRightGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const PlanViewToggle = styled.div`
  display: flex;
  background: #f1f5f9;
  border-radius: 0.375rem;
  padding: 0.175rem;
`;

const PlanViewToggleBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.35rem 0.75rem;
  border: none;
  border-radius: 0.25rem;
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  background: ${props => props.active ? 'white' : 'transparent'};
  color: ${props => props.active ? '#7c3aed' : '#64748b'};
  box-shadow: ${props => props.active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'};

  &:hover {
    color: ${props => props.active ? '#7c3aed' : '#1e293b'};
  }
`;

const YearSelector = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const YearNavBtn = styled.button`
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  color: #64748b;
  width: 1.75rem;
  height: 1.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
  font-size: 1rem;
  font-weight: bold;
  padding: 0;

  &:hover {
    background: #ede9fe;
    border-color: #8b5cf6;
    color: #7c3aed;
  }
`;

const YearDisplay = styled.span`
  font-size: 0.9rem;
  font-weight: 700;
  color: #334155;
  min-width: 3rem;
  text-align: center;
`;

// ============== Plan Tab Constants ==============

const PLAN_TABS = ['ceo', 'cfo', 'issue'];
const PLAN_TAB_LABELS = {
  ceo: '대표 이사 협의체',
  cfo: 'CFO 주간 회의',
  issue: 'DX 디지털 트윈 이슈 점검 회의',
};
const PLAN_TAB_SHORT_LABELS = {
  ceo: '협의체',
  cfo: '주간',
  issue: '이슈점검',
};
const initPlanTabRecord = (value) => PLAN_TABS.reduce((acc, key) => {
  acc[key] = typeof value === 'function' ? value() : value;
  return acc;
}, {});

// ============== Main Component ==============

const MeetingManagementApp = ({ onGoHome }) => {
  const { user } = useAuth();
  // 회차 삭제 권한: admin 또는 dt_office 만 허용 (manager 등은 불가)
  const canDeleteSession = !!user && (
    user.is_admin === true ||
    user.role === 'admin' ||
    user.role === 'dt_office'
  );

  // State
  const [viewMode, setViewMode] = useState('summary');
  const [planTab, setPlanTab] = useState('ceo');
  const [planViewMode, setPlanViewMode] = useState('detail'); // 'detail' | 'summary'
  const [showCommentPanel, setShowCommentPanel] = useState(false);
  const [planYear, setPlanYear] = useState(new Date().getFullYear());
  const [planData, setPlanData] = useState(() => initPlanTabRecord(() => []));
  const [planLoaded, setPlanLoaded] = useState(() => initPlanTabRecord(false));
  const [planUpdatedAt, setPlanUpdatedAt] = useState(() => initPlanTabRecord(null));
  const planUpdatedAtRef = useRef(initPlanTabRecord(null));
  const dirtyTabsRef = useRef(initPlanTabRecord(false));
  const [planConflict, setPlanConflict] = useState(null); // { tabKey, myRounds, serverRounds, serverUpdatedAt }
  const [canEditPlan, setCanEditPlan] = useState(false);
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [noticeBannerKey, setNoticeBannerKey] = useState(0);
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showSessionDetailModal, setShowSessionDetailModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [editingSession, setEditingSession] = useState(null);

  // Conflict modal states (낙관적 잠금)
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [conflictData, setConflictData] = useState(null); // { myData, serverData }
  const [selectedVersion, setSelectedVersion] = useState('mine');

  // Form states
  const [groupForm, setGroupForm] = useState({
    name: '',
    meetingType: 'council',
    cycle: 'monthly',
    description: '',
    participants: '',
    color: '#3b82f6'
  });

  const [sessionForm, setSessionForm] = useState({
    year: new Date().getFullYear(),
    sessionNumber: '',
    sessionDate: '',
    sessionTime: '',
    agendaItems: [],
    pendingFiles: []  // 업로드 대기 중인 파일들
  });

  // Load groups
  const loadGroups = useCallback(async () => {
    try {
      const data = await meetingApi.getGroups();
      setGroups(data);
    } catch (err) {
      console.error('Failed to load groups:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load group detail with sessions
  const loadGroupDetail = useCallback(async (groupId) => {
    try {
      const data = await meetingApi.getGroup(groupId);
      setSelectedGroup(data);
    } catch (err) {
      console.error('Failed to load group detail:', err);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    if (selectedGroupId) {
      loadGroupDetail(selectedGroupId);
    } else {
      setSelectedGroup(null);
    }
  }, [selectedGroupId, loadGroupDetail]);

  // Load report plan data when switching to plan view or changing tab
  const mapRoundsFromServer = useCallback((rounds) => {
    return (rounds || []).map((r) => ({
      id: String(r.id),
      roundNumber: r.roundNumber,
      schedule: r.schedule,
      timeStart: r.timeStart,
      timeEnd: r.timeEnd,
      status: r.status,
      items: r.items.map(it => ({
        id: String(it.id),
        category: it.category,
        divisions: it.divisions,
        agenda: it.agenda,
        content: it.content,
        categoryMerged: it.categoryMerged,
        linkedId: it.linkedId || undefined,
      })),
    }));
  }, []);

  const loadPlanTab = useCallback((tabKey) => {
    if (planLoaded[tabKey]) return;
    meetingApi.getReportPlan(tabKey).then(data => {
      const mapped = mapRoundsFromServer(data.rounds);
      setPlanData(prev => ({ ...prev, [tabKey]: mapped }));
      setPlanUpdatedAt(prev => {
        const next = { ...prev, [tabKey]: data.updatedAt };
        planUpdatedAtRef.current = next;
        return next;
      });
      setPlanLoaded(prev => ({ ...prev, [tabKey]: true }));
    }).catch(err => console.error('Failed to load report plan:', err));
  }, [planLoaded, mapRoundsFromServer]);

  useEffect(() => {
    if (viewMode !== 'plan') return;
    // Always load all tabs — needed for link feature and cross view
    PLAN_TABS.forEach(t => loadPlanTab(t));
  }, [viewMode, planTab, planViewMode, loadPlanTab]);

  // 보고계획 편집 권한 체크
  useEffect(() => {
    meetingApi.checkReportPlanEditPermission().then(setCanEditPlan);
  }, []);

  // Sync linked items: when current tab data changes, propagate to all other tabs.
  // Items sharing the same linkedId stay in sync — supports chains like ceo↔cfo↔issue.
  const syncingRef = useRef(false);
  useEffect(() => {
    if (syncingRef.current) return;
    if (!planLoaded[planTab]) return;
    const currentRounds = planData[planTab] || [];

    // Build map of linkedId → item data from current tab
    const linkedMap = new Map();
    currentRounds.forEach(r => r.items.forEach(it => {
      if (it.linkedId) {
        linkedMap.set(it.linkedId, { category: it.category, divisions: it.divisions, agenda: it.agenda, content: it.content });
      }
    }));

    if (linkedMap.size === 0) return;

    const updates = {};
    PLAN_TABS.forEach(otherTab => {
      if (otherTab === planTab) return;
      if (!planLoaded[otherTab]) return;
      const otherRounds = planData[otherTab] || [];
      let tabChanged = false;
      const updatedOther = otherRounds.map(r => ({
        ...r,
        items: r.items.map(it => {
          if (it.linkedId && linkedMap.has(it.linkedId)) {
            const src = linkedMap.get(it.linkedId);
            if (it.category !== src.category || it.agenda !== src.agenda || it.content !== src.content ||
                JSON.stringify(it.divisions) !== JSON.stringify(src.divisions)) {
              tabChanged = true;
              return { ...it, category: src.category, divisions: [...(src.divisions || [])], agenda: src.agenda, content: src.content };
            }
          }
          return it;
        })
      }));
      if (tabChanged) {
        updates[otherTab] = updatedOther;
        dirtyTabsRef.current[otherTab] = true;
      }
    });

    if (Object.keys(updates).length > 0) {
      syncingRef.current = true;
      setPlanData(prev => {
        syncingRef.current = false;
        return { ...prev, ...updates };
      });
    }
  }, [planData, planTab, planLoaded]);

  // Auto-save report plan data (debounced) — with optimistic locking
  const saveTimerRef = useRef(null);
  const planDataRef = useRef(planData);
  planDataRef.current = planData;

  const savePlanTab = useCallback((tabKey) => {
    const dataToSave = planDataRef.current[tabKey];
    const updatedAt = planUpdatedAtRef.current[tabKey];
    meetingApi.saveReportPlan(tabKey, dataToSave, updatedAt)
      .then(data => {
        setPlanUpdatedAt(prev => {
          const next = { ...prev, [tabKey]: data.updatedAt };
          planUpdatedAtRef.current = next;
          return next;
        });
      })
      .catch(err => {
        if (err.isConflict) {
          setPlanConflict({
            tabKey,
            myRounds: planDataRef.current[tabKey],
            serverRounds: mapRoundsFromServer(err.conflictData.current),
            serverUpdatedAt: err.conflictData.updatedAt,
          });
        } else {
          console.error('Failed to save report plan:', err);
        }
      });
  }, [mapRoundsFromServer]); // stable deps only — reads from refs

  useEffect(() => {
    if (!planLoaded[planTab] || planConflict) return;
    // Only trigger auto-save when there are dirty tabs
    if (!PLAN_TABS.some(t => dirtyTabsRef.current[t])) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      PLAN_TABS.forEach(t => {
        if (planLoaded[t] && dirtyTabsRef.current[t]) {
          dirtyTabsRef.current[t] = false;
          savePlanTab(t);
        }
      });
    }, 1000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [planData, planTab, planLoaded, planConflict, savePlanTab]);

  // Filter rounds by selected year — include if schedule year matches or schedule is empty
  const filterRoundsByYear = useCallback((rounds) => {
    const currentYear = new Date().getFullYear();
    const filtered = rounds.filter(r => {
      if (!r.schedule) return planYear === currentYear; // 날짜 미정은 현재 연도에서만 표시
      const year = new Date(r.schedule + 'T00:00:00').getFullYear();
      return year === planYear;
    });
    // CEO 탭: 해당 연도 기준으로 회차 번호 재부여
    return filtered.map((r, i) => ({ ...r, roundNumber: i + 1 }));
  }, [planYear]);

  const filteredPlanRounds = useMemo(() => {
    return PLAN_TABS.reduce((acc, t) => {
      acc[t] = filterRoundsByYear(planData[t] || []);
      return acc;
    }, {});
  }, [planData, filterRoundsByYear]);

  const otherTabsForTable = useMemo(() => (
    PLAN_TABS
      .filter(t => t !== planTab)
      .map(t => ({
        tabKey: t,
        label: PLAN_TAB_LABELS[t],
        shortLabel: PLAN_TAB_SHORT_LABELS[t],
        rounds: filteredPlanRounds[t] || [],
        roundFmt: t === 'cfo' ? 'week' : 'round',
      }))
  ), [planTab, filteredPlanRounds]);

  // Filtered groups
  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(searchText.toLowerCase())
  );

  // Group handlers
  const handleOpenAddGroup = () => {
    setEditingGroup(null);
    setGroupForm({
      name: '',
      meetingType: 'council',
      cycle: 'monthly',
      description: '',
      participants: '',
      color: '#3b82f6'
    });
    setShowGroupModal(true);
  };

  const handleOpenEditGroup = () => {
    if (!selectedGroup) return;
    setEditingGroup(selectedGroup);
    setGroupForm({
      name: selectedGroup.name,
      meetingType: selectedGroup.meetingType,
      cycle: selectedGroup.cycle || 'monthly',
      description: selectedGroup.description || '',
      participants: selectedGroup.participants || '',
      color: selectedGroup.color || '#3b82f6'
    });
    setShowGroupModal(true);
  };

  const handleSaveGroup = async () => {
    if (!groupForm.name.trim()) {
      alert('이름을 입력해주세요.');
      return;
    }

    try {
      if (editingGroup) {
        await meetingApi.updateGroup(editingGroup.id, groupForm);
      } else {
        await meetingApi.createGroup(groupForm);
      }
      setShowGroupModal(false);
      loadGroups();
      if (selectedGroupId) {
        loadGroupDetail(selectedGroupId);
      }
    } catch (err) {
      alert('저장에 실패했습니다: ' + err.message);
    }
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroup) return;
    if (!window.confirm(`"${selectedGroup.name}"을(를) 삭제하시겠습니까?\n모든 회차 정보도 함께 삭제됩니다.`)) return;

    try {
      await meetingApi.deleteGroup(selectedGroup.id);
      setSelectedGroupId(null);
      loadGroups();
    } catch (err) {
      alert('삭제에 실패했습니다: ' + err.message);
    }
  };

  // Session handlers
  const handleOpenAddSession = () => {
    if (!selectedGroup) return;
    setEditingSession(null);

    const today = new Date();
    const year = today.getFullYear();
    const todayStr = toLocalYmd(today);

    // 해당 연도의 회차 수 계산
    const sessionsInYear = selectedGroup.sessions?.filter(s => s.year === year) || [];
    const nextNum = sessionsInYear.length + 1;

    setSessionForm({
      year: year,
      sessionNumber: nextNum,
      sessionDate: todayStr,
      sessionTime: '',
      agendaItems: [{ title: '', content: '' }],
      pendingFiles: []
    });
    setShowSessionModal(true);
  };

  const handleOpenEditSession = (session) => {
    setEditingSession(session);
    setSessionForm({
      year: session.year,
      sessionNumber: session.sessionNumber,
      sessionDate: session.sessionDate,
      sessionTime: session.sessionTime || '',
      agendaItems: session.agendaItems?.length > 0
        ? session.agendaItems.map(item => ({ title: item.title, content: item.content || '' }))
        : [{ title: '', content: '' }],
      pendingFiles: [],
      existingAttachments: session.attachments || []  // 수정 시 기존 첨부파일 표시
    });
    setShowSessionModal(true);
  };

  const handleSaveSession = async () => {
    if (!sessionForm.sessionDate) {
      alert('일시를 입력해주세요.');
      return;
    }

    // Filter out empty agenda items
    const agendaItems = sessionForm.agendaItems.filter(item => item.title.trim());

    try {
      // 세션 데이터 준비 (파일 관련 필드 제외)
      const { pendingFiles, existingAttachments, ...sessionData } = sessionForm;
      const data = { ...sessionData, agendaItems };

      let sessionId;
      if (editingSession) {
        // 낙관적 잠금을 위해 updatedAt 전송
        await meetingApi.updateSession(editingSession.id, data, editingSession.updatedAt);
        sessionId = editingSession.id;
      } else {
        const newSession = await meetingApi.createSession(selectedGroupId, data);
        sessionId = newSession.id;
      }

      // 새 파일들 업로드
      if (pendingFiles && pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          await meetingApi.uploadAttachment(sessionId, file, 'etc');
        }
      }

      setShowSessionModal(false);
      loadGroupDetail(selectedGroupId);
      loadGroups();
    } catch (err) {
      // 낙관적 잠금 충돌 처리 - 비교 모달 열기
      if (err.isConflict && err.conflictData?.current) {
        const serverData = err.conflictData.current;
        setConflictData({
          myData: {
            year: sessionForm.year,
            sessionNumber: sessionForm.sessionNumber,
            sessionDate: sessionForm.sessionDate,
            sessionTime: sessionForm.sessionTime,
            agendaItems: sessionForm.agendaItems,
            updatedAt: editingSession?.updatedAt
          },
          serverData: {
            year: serverData.year,
            sessionNumber: serverData.sessionNumber,
            sessionDate: serverData.sessionDate,
            sessionTime: serverData.sessionTime,
            agendaItems: serverData.agendaItems,
            updatedAt: serverData.updatedAt
          }
        });
        setSelectedVersion('mine');
        setIsConflictModalOpen(true);
      } else {
        alert('저장에 실패했습니다: ' + err.message);
      }
    }
  };

  const handleDeleteSession = async (sessionId) => {
    if (!window.confirm('이 회차를 삭제하시겠습니까?')) return;

    try {
      await meetingApi.deleteSession(sessionId);
      setShowSessionDetailModal(false);
      setSelectedSession(null);
      loadGroupDetail(selectedGroupId);
      loadGroups();
    } catch (err) {
      alert('삭제에 실패했습니다: ' + err.message);
    }
  };

  const handleOpenSessionDetail = async (session) => {
    try {
      const data = await meetingApi.getSession(session.id);
      setSelectedSession(data);
      setShowSessionDetailModal(true);
    } catch (err) {
      console.error('Failed to load session:', err);
    }
  };

  // Agenda item handlers
  const handleAddAgendaItem = () => {
    setSessionForm(prev => ({
      ...prev,
      agendaItems: [...prev.agendaItems, { title: '', content: '' }]
    }));
  };

  const handleRemoveAgendaItem = (index) => {
    setSessionForm(prev => ({
      ...prev,
      agendaItems: prev.agendaItems.filter((_, i) => i !== index)
    }));
  };

  const handleAgendaItemChange = (index, field, value) => {
    setSessionForm(prev => ({
      ...prev,
      agendaItems: prev.agendaItems.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  // File handlers for session modal
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      setSessionForm(prev => ({
        ...prev,
        pendingFiles: [...prev.pendingFiles, ...files]
      }));
    }
    // Reset input
    e.target.value = '';
  };

  const handleRemovePendingFile = (index) => {
    setSessionForm(prev => ({
      ...prev,
      pendingFiles: prev.pendingFiles.filter((_, i) => i !== index)
    }));
  };

  const handleRemoveExistingAttachment = async (attachmentId) => {
    if (!window.confirm('이 첨부파일을 삭제하시겠습니까?')) return;
    try {
      await meetingApi.deleteAttachment(attachmentId);
      setSessionForm(prev => ({
        ...prev,
        existingAttachments: prev.existingAttachments.filter(a => a.id !== attachmentId)
      }));
    } catch (err) {
      alert('첨부파일 삭제에 실패했습니다: ' + err.message);
    }
  };

  // Attachment handlers
  const handleDownloadAttachment = async (attachment) => {
    try {
      await meetingApi.downloadAttachment(attachment.id, attachment.originalFilename || attachment.original_filename);
    } catch (error) {
      console.error('Download failed:', error);
      alert('파일 다운로드에 실패했습니다.');
    }
  };

  const handleDownloadAllAttachments = async () => {
    if (!selectedSession?.attachments?.length) {
      alert('다운로드할 첨부파일이 없습니다.');
      return;
    }
    for (const att of selectedSession.attachments) {
      try {
        await meetingApi.downloadAttachment(att.id, att.originalFilename || att.original_filename);
      } catch (error) {
        console.error('Download failed:', error);
      }
    }
  };

  // 선택된 회의체의 모든 첨부파일 다운로드
  const handleDownloadAllGroupAttachments = async () => {
    if (!selectedGroup?.sessions?.length) {
      alert('다운로드할 첨부파일이 없습니다.');
      return;
    }

    // 모든 세션에서 첨부파일 수집
    const allAttachments = [];
    selectedGroup.sessions.forEach(session => {
      if (session.attachments && session.attachments.length > 0) {
        allAttachments.push(...session.attachments);
      }
    });

    if (allAttachments.length === 0) {
      alert('다운로드할 첨부파일이 없습니다.');
      return;
    }

    // 각 파일 다운로드
    for (const att of allAttachments) {
      try {
        await meetingApi.downloadAttachment(att.id, att.originalFilename || att.original_filename);
      } catch (error) {
        console.error('Download failed:', error);
      }
    }
  };

  // ============== Conflict Resolution Handlers ==============

  // 충돌 버전 선택 핸들러
  const handleSelectVersion = useCallback((version) => {
    setSelectedVersion(version);
  }, []);

  // 충돌 해결 후 저장
  const handleResolveConflict = useCallback(async () => {
    if (!editingSession || !conflictData) return;

    try {
      // 선택한 버전의 데이터로 저장
      const selectedData = selectedVersion === 'mine' ? conflictData.myData : conflictData.serverData;
      const agendaItems = selectedData.agendaItems?.filter(item => item.title?.trim()) || [];

      const data = {
        year: selectedData.year,
        sessionNumber: selectedData.sessionNumber,
        sessionDate: selectedData.sessionDate,
        sessionTime: selectedData.sessionTime,
        agendaItems
      };

      // 서버의 최신 updatedAt으로 강제 저장 (잠금 우회)
      await meetingApi.updateSession(
        editingSession.id,
        data,
        conflictData.serverData.updatedAt
      );

      // 새 파일들 업로드 (있는 경우)
      const { pendingFiles } = sessionForm;
      if (pendingFiles && pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          await meetingApi.uploadAttachment(editingSession.id, file, 'etc');
        }
      }

      setIsConflictModalOpen(false);
      setConflictData(null);
      setShowSessionModal(false);
      loadGroupDetail(selectedGroupId);
      loadGroups();
    } catch (err) {
      alert('저장에 실패했습니다: ' + err.message);
    }
  }, [editingSession, conflictData, selectedVersion, sessionForm, selectedGroupId, loadGroupDetail, loadGroups]);

  // 충돌 모달 닫기
  const handleCloseConflictModal = useCallback(() => {
    setIsConflictModalOpen(false);
    setConflictData(null);
    setSelectedVersion('mine');
  }, []);

  return (
    <Container>
      <Header onGoHome={onGoHome} viewMode={viewMode} onViewModeChange={setViewMode} />

      {viewMode === 'summary' ? (
      <Content>
        {/* Master Panel - 목록 */}
        <MasterPanel>
          <MasterHeader>
            <MasterTitle>
              목록
              <AddButton onClick={handleOpenAddGroup}>
                <Plus size={14} />
                추가
              </AddButton>
            </MasterTitle>
            <SearchBox>
              <Search size={16} color="#94a3b8" />
              <input
                type="text"
                placeholder="검색..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </SearchBox>
          </MasterHeader>

          <MasterList>
            {loading ? (
              <EmptyState>
                <span>로딩 중...</span>
              </EmptyState>
            ) : filteredGroups.length > 0 ? (
              filteredGroups.map(group => (
                <GroupItem
                  key={group.id}
                  selected={group.id === selectedGroupId}
                  onClick={() => setSelectedGroupId(group.id)}
                >
                  <GroupHeader>
                    <GroupColorDot color={group.color} />
                    <GroupName>{group.name}</GroupName>
                    <GroupBadge type={group.meetingType}>
                      {getMeetingTypeLabel(group.meetingType)}
                    </GroupBadge>
                  </GroupHeader>
                  <GroupMeta>
                    <span>{getCycleLabel(group.cycle)}</span>
                    <span>{group.sessionCount || 0}회차</span>
                  </GroupMeta>
                </GroupItem>
              ))
            ) : (
              <EmptyState>
                <Users2 size={32} />
                <span>등록된 항목이 없습니다</span>
              </EmptyState>
            )}
          </MasterList>
        </MasterPanel>

        {/* Detail Panel */}
        <DetailPanel>
          {selectedGroup ? (
            <>
              <DetailHeader>
                <DetailTitleSection>
                  <DetailTitle>
                    <GroupColorDot color={selectedGroup.color} />
                    {selectedGroup.name}
                  </DetailTitle>
                  <DetailSubtitle>
                    {getMeetingTypeLabel(selectedGroup.meetingType)} · {getCycleLabel(selectedGroup.cycle)}
                  </DetailSubtitle>
                </DetailTitleSection>
                <HeaderActions>
                  <ActionButton onClick={handleOpenEditGroup}>
                    <Edit2 size={14} />
                    수정
                  </ActionButton>
                  <ActionButton className="danger" onClick={handleDeleteGroup}>
                    <Trash2 size={14} />
                    삭제
                  </ActionButton>
                  <ActionButton onClick={handleDownloadAllGroupAttachments}>
                    <FolderDown size={14} />
                    첨부 모두 다운로드
                  </ActionButton>
                  <ActionButton className="primary" onClick={handleOpenAddSession}>
                    <Plus size={14} />
                    회차 추가
                  </ActionButton>
                </HeaderActions>
              </DetailHeader>

              <DetailContent>
                {/* Group Info */}
                {(selectedGroup.description || selectedGroup.participants) && (
                  <GroupInfoCard>
                    <InfoGrid>
                      {selectedGroup.description && (
                        <InfoItem>
                          <div className="label">설명</div>
                          <div className="value">{selectedGroup.description}</div>
                        </InfoItem>
                      )}
                      {selectedGroup.participants && (
                        <InfoItem>
                          <div className="label">참여자</div>
                          <div className="value">{selectedGroup.participants}</div>
                        </InfoItem>
                      )}
                    </InfoGrid>
                  </GroupInfoCard>
                )}

                {/* Sessions Timeline */}
                <TimelineSection>
                  <TimelineSectionHeader>
                    <h3>회차 이력</h3>
                  </TimelineSectionHeader>

                  {selectedGroup.sessions?.length > 0 ? (
                    <Timeline>
                      {selectedGroup.sessions.map(session => (
                        <TimelineItem key={session.id} color={selectedGroup.color}>
                          <SessionCard onClick={() => handleOpenSessionDetail(session)}>
                            <SessionHeader>
                              <SessionTitle>{session.year}년 {session.sessionNumber}회차</SessionTitle>
                              <SessionDate>{formatDate(session.sessionDate)}</SessionDate>
                            </SessionHeader>
                            <SessionMeta>
                              {session.sessionTime && (
                                <span><Clock size={12} /> {session.sessionTime}</span>
                              )}
                            </SessionMeta>

                            {/* 안건 및 첨부파일 상세 표시 */}
                            {(session.agendaItems?.length > 0 || session.attachments?.length > 0) && (
                              <SessionDetailList>
                                {session.agendaItems?.length > 0 && (
                                  <SessionDetailSection>
                                    <SessionDetailLabel>
                                      <FileText size={10} />
                                      안건 ({session.agendaItems.length})
                                    </SessionDetailLabel>
                                    <SessionAgendaList>
                                      {session.agendaItems.map((item, idx) => (
                                        <SessionAgendaItem key={item.id || idx}>
                                          <SessionAgendaTitle>
                                            <SessionAgendaNumber>{idx + 1}</SessionAgendaNumber>
                                            {item.title}
                                          </SessionAgendaTitle>
                                          {item.content && (
                                            <SessionAgendaContent>{item.content}</SessionAgendaContent>
                                          )}
                                        </SessionAgendaItem>
                                      ))}
                                    </SessionAgendaList>
                                  </SessionDetailSection>
                                )}

                                {session.attachments?.length > 0 && (
                                  <SessionDetailSection>
                                    <SessionDetailLabel>
                                      <Paperclip size={10} />
                                      첨부파일 ({session.attachments.length})
                                    </SessionDetailLabel>
                                    <SessionAttachmentList>
                                      {session.attachments.map(att => (
                                        <SessionAttachmentChip key={att.id} title={att.originalFilename}>
                                          <Paperclip size={10} />
                                          {att.originalFilename}
                                        </SessionAttachmentChip>
                                      ))}
                                    </SessionAttachmentList>
                                  </SessionDetailSection>
                                )}
                              </SessionDetailList>
                            )}
                          </SessionCard>
                        </TimelineItem>
                      ))}
                    </Timeline>
                  ) : (
                    <EmptyState>
                      <Calendar size={32} />
                      <span>등록된 회차가 없습니다</span>
                      <Button className="primary" onClick={handleOpenAddSession} style={{ marginTop: '1rem' }}>
                        <Plus size={14} /> 첫 회차 추가
                      </Button>
                    </EmptyState>
                  )}
                </TimelineSection>
              </DetailContent>
            </>
          ) : (
            <EmptyState>
              <Users2 size={48} />
              <p>좌측 목록에서 항목을 선택하세요</p>
            </EmptyState>
          )}
        </DetailPanel>
      </Content>
      ) : (
      <PlanContainer>
        <PlanMainArea>
        <ReportPlanNoticeBanner
          key={noticeBannerKey}
          planTab={planTab}
          canEdit={canEditPlan}
          onOpenModal={() => setShowNoticeModal(true)}
        />
        <PlanTabBarRow>
          {planViewMode !== 'cross' && (
            <PlanTabGroup>
              {PLAN_TABS.map(t => (
                <PlanTab
                  key={t}
                  active={planTab === t}
                  onClick={() => setPlanTab(t)}
                >
                  {PLAN_TAB_LABELS[t]}
                </PlanTab>
              ))}
            </PlanTabGroup>
          )}
          {planViewMode === 'cross' && <PlanTabGroup />}
          {!canEditPlan && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
              padding: '0.25rem 0.625rem', borderRadius: '9999px',
              background: '#fef3c7', color: '#92400e', fontSize: '0.75rem', fontWeight: 600,
              border: '1px solid #fde68a',
            }}>
              읽기 전용
            </span>
          )}
          <YearSelector>
            <YearNavBtn onClick={() => setPlanYear(y => y - 1)} title="이전 년도">‹</YearNavBtn>
            <YearDisplay>{planYear}</YearDisplay>
            <YearNavBtn onClick={() => setPlanYear(y => y + 1)} title="다음 년도">›</YearNavBtn>
          </YearSelector>
          <PlanRightGroup>
            <PlanViewToggle>
              <PlanViewToggleBtn
                active={planViewMode === 'detail'}
                onClick={() => setPlanViewMode('detail')}
              >
                <List size={14} />
                상세
              </PlanViewToggleBtn>
              <PlanViewToggleBtn
                active={planViewMode === 'summary'}
                onClick={() => setPlanViewMode('summary')}
              >
                <LayoutGrid size={14} />
                요약
              </PlanViewToggleBtn>
              <PlanViewToggleBtn
                active={planViewMode === 'cross'}
                onClick={() => setPlanViewMode('cross')}
              >
                <ArrowLeftRight size={14} />
                협의체-주간-이슈
              </PlanViewToggleBtn>
            </PlanViewToggle>
            <CommentToggleBtn
              $active={showCommentPanel}
              onClick={() => setShowCommentPanel(prev => !prev)}
              title="의견 패널"
            >
              <MessageSquare size={14} />
              의견
            </CommentToggleBtn>
          </PlanRightGroup>
        </PlanTabBarRow>
        {planViewMode === 'detail' ? (
          <ReportPlanTable
            rounds={filteredPlanRounds[planTab]}
            readOnly={!canEditPlan}
            onRoundsChange={(newFilteredRounds) => {
              // Merge filtered changes back into full data
              const fullRounds = planData[planTab] || [];
              const filteredIds = new Set(filteredPlanRounds[planTab].map(r => r.id));
              // Keep non-filtered rounds, replace filtered ones with new data
              const nonFiltered = fullRounds.filter(r => !filteredIds.has(r.id));
              // Restore original roundNumbers across entire dataset
              const merged = [...nonFiltered, ...newFilteredRounds]
                .sort((a, b) => {
                  const aIdx = fullRounds.findIndex(r => r.id === a.id);
                  const bIdx = fullRounds.findIndex(r => r.id === b.id);
                  // New rounds (not in original) go to end
                  return (aIdx === -1 ? 9999 : aIdx) - (bIdx === -1 ? 9999 : bIdx);
                })
                .map((r, i) => ({ ...r, roundNumber: i + 1 }));
              dirtyTabsRef.current[planTab] = true;
              setPlanData(prev => ({ ...prev, [planTab]: merged }));
            }}
            planTab={planTab}
            otherTabs={otherTabsForTable}
            onLinkToOther={(item, sourceRoundId, targetRoundId, targetTab) => {
              if (!targetTab || !PLAN_TABS.includes(targetTab)) return;
              // Reuse the linkedId of the item if it already belongs to a chain;
              // otherwise mint a fresh one. This lets ceo→cfo→issue extend a chain.
              const linkedId = item.linkedId
                || `link-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

              // 1) 원본 아이템에 linkedId 부여 (이미 있으면 그대로 유지)
              const updatedCurrent = (planData[planTab] || []).map(r => ({
                ...r,
                items: r.items.map(it =>
                  it.id === item.id ? { ...it, linkedId } : it
                )
              }));

              // 2) 대상 탭 회차에 링크된 아이템 추가
              const updatedTarget = (planData[targetTab] || []).map(r => {
                if (r.id === targetRoundId) {
                  return {
                    ...r,
                    items: [...r.items, {
                      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                      category: item.category,
                      divisions: [...(item.divisions || [])],
                      agenda: item.agenda,
                      content: item.content,
                      linkedId,
                    }]
                  };
                }
                return r;
              });

              dirtyTabsRef.current[planTab] = true;
              dirtyTabsRef.current[targetTab] = true;
              setPlanData(prev => ({
                ...prev,
                [planTab]: updatedCurrent,
                [targetTab]: updatedTarget,
              }));
            }}
            onUnlink={(item) => {
              const lid = item.linkedId;
              if (!lid) return;

              // 모든 탭에서 linkedId 제거 (아이템은 남기고 연결만 해제)
              const updates = {};
              PLAN_TABS.forEach(t => {
                const tabRounds = planData[t] || [];
                let touched = false;
                const updated = tabRounds.map(r => ({
                  ...r,
                  items: r.items.map(it => {
                    if (it.linkedId === lid) {
                      touched = true;
                      return { ...it, linkedId: undefined };
                    }
                    return it;
                  })
                }));
                if (touched) {
                  updates[t] = updated;
                  dirtyTabsRef.current[t] = true;
                }
              });

              if (Object.keys(updates).length > 0) {
                setPlanData(prev => ({ ...prev, ...updates }));
              }
            }}
          />
        ) : planViewMode === 'summary' ? (
          <ReportPlanSummary rounds={filteredPlanRounds[planTab]} planTab={planTab} />
        ) : (
          <ReportPlanCrossView
            ceoRounds={filteredPlanRounds.ceo}
            cfoRounds={filteredPlanRounds.cfo}
            issueRounds={filteredPlanRounds.issue}
          />
        )}
        </PlanMainArea>
        {showCommentPanel && (
          <ReportPlanCommentPanel
            tabKey={planTab}
            onClose={() => setShowCommentPanel(false)}
          />
        )}
      </PlanContainer>
      )}

      {/* Notice Modal */}
      {showNoticeModal && (
        <ReportPlanNoticeModal
          onClose={() => {
            setShowNoticeModal(false);
            setNoticeBannerKey(k => k + 1); // 배너 새로고침
          }}
          canEdit={canEditPlan}
        />
      )}

      {/* Group Modal */}
      {showGroupModal && (
        <ModalOverlay onClick={() => setShowGroupModal(false)}>
          <Modal onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>{editingGroup ? '수정' : '새 항목 추가'}</ModalTitle>
              <ModalCloseButton onClick={() => setShowGroupModal(false)}>
                <X size={18} />
              </ModalCloseButton>
            </ModalHeader>
            <ModalContent>
              <FormGroup>
                <Label>이름 *</Label>
                <Input
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                  placeholder="예: 디지털트윈 협의체"
                />
              </FormGroup>
              <FormRow>
                <FormGroup>
                  <Label>유형 *</Label>
                  <Select
                    value={groupForm.meetingType}
                    onChange={(e) => setGroupForm({ ...groupForm, meetingType: e.target.value })}
                  >
                    {MEETING_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </Select>
                </FormGroup>
                <FormGroup>
                  <Label>주기</Label>
                  <Select
                    value={groupForm.cycle}
                    onChange={(e) => setGroupForm({ ...groupForm, cycle: e.target.value })}
                  >
                    {CYCLES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </Select>
                </FormGroup>
              </FormRow>
              <FormGroup>
                <Label>설명</Label>
                <Textarea
                  value={groupForm.description}
                  onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                  placeholder="회의체에 대한 설명"
                />
              </FormGroup>
              <FormGroup>
                <Label>참여자/부서</Label>
                <Input
                  value={groupForm.participants}
                  onChange={(e) => setGroupForm({ ...groupForm, participants: e.target.value })}
                  placeholder="참여자 입력"
                />
              </FormGroup>
              <FormGroup>
                <Label>색상</Label>
                <ColorPicker>
                  {COLORS.map(color => (
                    <ColorOption
                      key={color}
                      color={color}
                      selected={groupForm.color === color}
                      onClick={() => setGroupForm({ ...groupForm, color })}
                    />
                  ))}
                </ColorPicker>
              </FormGroup>
            </ModalContent>
            <ModalFooter>
              <Button onClick={() => setShowGroupModal(false)}>취소</Button>
              <Button className="primary" onClick={handleSaveGroup}>
                {editingGroup ? '수정' : '추가'}
              </Button>
            </ModalFooter>
          </Modal>
        </ModalOverlay>
      )}

      {/* Session Modal */}
      {showSessionModal && (
        <ModalOverlay onClick={() => setShowSessionModal(false)}>
          <Modal large onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>{editingSession ? '회차 수정' : '새 회차 추가'}</ModalTitle>
              <ModalCloseButton onClick={() => setShowSessionModal(false)}>
                <X size={18} />
              </ModalCloseButton>
            </ModalHeader>
            <ModalContent>
              <FormRow>
                <FormGroup>
                  <Label>연도 *</Label>
                  <Input
                    type="number"
                    value={sessionForm.year}
                    onChange={(e) => setSessionForm({ ...sessionForm, year: parseInt(e.target.value) || '' })}
                    min="2000"
                    max="2100"
                  />
                </FormGroup>
                <FormGroup>
                  <Label>회차 번호</Label>
                  <Input
                    type="number"
                    value={sessionForm.sessionNumber}
                    onChange={(e) => setSessionForm({ ...sessionForm, sessionNumber: parseInt(e.target.value) || '' })}
                  />
                </FormGroup>
              </FormRow>
              <FormRow>
                <FormGroup>
                  <Label>일시 *</Label>
                  <Input
                    type="date"
                    value={sessionForm.sessionDate}
                    onChange={(e) => setSessionForm({ ...sessionForm, sessionDate: e.target.value })}
                  />
                </FormGroup>
                <FormGroup>
                  <Label>시간</Label>
                  <Input
                    value={sessionForm.sessionTime}
                    onChange={(e) => setSessionForm({ ...sessionForm, sessionTime: e.target.value })}
                    placeholder="예: 14:00~16:00"
                  />
                </FormGroup>
              </FormRow>

              <FormGroup>
                <Label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  안건
                  <Button onClick={handleAddAgendaItem} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                    <Plus size={12} /> 안건 추가
                  </Button>
                </Label>
                {sessionForm.agendaItems.map((item, index) => (
                  <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <div style={{ flex: 1 }}>
                      <Input
                        value={item.title}
                        onChange={(e) => handleAgendaItemChange(index, 'title', e.target.value)}
                        placeholder={`안건 ${index + 1} 제목`}
                        style={{ marginBottom: '0.375rem' }}
                      />
                      <Textarea
                        value={item.content}
                        onChange={(e) => handleAgendaItemChange(index, 'content', e.target.value)}
                        placeholder="안건 내용 (선택)"
                        style={{ minHeight: '60px' }}
                      />
                    </div>
                    {sessionForm.agendaItems.length > 1 && (
                      <button
                        onClick={() => handleRemoveAgendaItem(index)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#ef4444',
                          alignSelf: 'flex-start',
                          marginTop: '0.5rem'
                        }}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </FormGroup>

              <FormGroup>
                <Label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  첨부파일
                  <label style={{ cursor: 'pointer' }}>
                    <Button as="span" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                      <Plus size={12} /> 파일 추가
                    </Button>
                    <input
                      type="file"
                      multiple
                      onChange={handleFileSelect}
                      style={{ display: 'none' }}
                    />
                  </label>
                </Label>

                {/* 기존 첨부파일 (수정 시) */}
                {sessionForm.existingAttachments?.length > 0 && (
                  <div style={{ marginBottom: '0.5rem' }}>
                    {sessionForm.existingAttachments.map(att => (
                      <AttachmentItem key={att.id}>
                        <Paperclip size={14} />
                        <span className="filename">{att.originalFilename}</span>
                        <button onClick={() => handleDownloadAttachment(att)}>
                          <Download size={14} />
                        </button>
                        <button className="delete" onClick={() => handleRemoveExistingAttachment(att.id)}>
                          <X size={14} />
                        </button>
                      </AttachmentItem>
                    ))}
                  </div>
                )}

                {/* 새로 추가할 파일들 */}
                {sessionForm.pendingFiles?.length > 0 && (
                  <div>
                    {sessionForm.pendingFiles.map((file, index) => (
                      <AttachmentItem key={index} style={{ background: '#f0fdf4' }}>
                        <Paperclip size={14} />
                        <span className="filename">{file.name}</span>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                        <button className="delete" onClick={() => handleRemovePendingFile(index)}>
                          <X size={14} />
                        </button>
                      </AttachmentItem>
                    ))}
                  </div>
                )}

                {(!sessionForm.existingAttachments?.length && !sessionForm.pendingFiles?.length) && (
                  <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '0.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
                    첨부파일이 없습니다
                  </div>
                )}
              </FormGroup>
            </ModalContent>
            <ModalFooter>
              <Button onClick={() => setShowSessionModal(false)}>취소</Button>
              <Button className="primary" onClick={handleSaveSession}>
                {editingSession ? '수정' : '추가'}
              </Button>
            </ModalFooter>
          </Modal>
        </ModalOverlay>
      )}

      {/* Session Detail Modal */}
      {showSessionDetailModal && selectedSession && (
        <ModalOverlay onClick={() => setShowSessionDetailModal(false)}>
          <Modal large onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>{selectedSession.year}년 {selectedSession.sessionNumber}회차 상세</ModalTitle>
              <ModalCloseButton onClick={() => setShowSessionDetailModal(false)}>
                <X size={18} />
              </ModalCloseButton>
            </ModalHeader>
            <ModalContent>
              <InfoGrid style={{ marginBottom: '1rem' }}>
                <InfoItem>
                  <div className="label">일시</div>
                  <div className="value">{formatDate(selectedSession.sessionDate)}</div>
                </InfoItem>
                {selectedSession.sessionTime && (
                  <InfoItem>
                    <div className="label">시간</div>
                    <div className="value">{selectedSession.sessionTime}</div>
                  </InfoItem>
                )}
              </InfoGrid>

              {selectedSession.agendaItems?.length > 0 && (
                <>
                  <Label>안건</Label>
                  <AgendaList>
                    {selectedSession.agendaItems.map((item, index) => (
                      <AgendaItem key={item.id || index}>
                        <AgendaNumber>{index + 1}</AgendaNumber>
                        <AgendaContent>
                          <div className="title">{item.title}</div>
                          {item.content && <div className="content">{item.content}</div>}
                        </AgendaContent>
                      </AgendaItem>
                    ))}
                  </AgendaList>
                </>
              )}

              {selectedSession.attachments?.length > 0 && (
                <AttachmentList>
                  <Label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    첨부파일
                    <Button onClick={handleDownloadAllAttachments} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                      <FolderDown size={12} /> 모두 다운로드
                    </Button>
                  </Label>
                  {selectedSession.attachments.map(att => (
                    <AttachmentItem key={att.id}>
                      <Paperclip size={14} />
                      <span className="filename">{att.originalFilename}</span>
                      <button onClick={() => handleDownloadAttachment(att)}>
                        <Download size={14} />
                      </button>
                    </AttachmentItem>
                  ))}
                </AttachmentList>
              )}
            </ModalContent>
            <ModalFooter>
              {canDeleteSession && (
                <Button className="danger" onClick={() => handleDeleteSession(selectedSession.id)}>
                  <Trash2 size={14} /> 삭제
                </Button>
              )}
              <Button onClick={() => {
                setShowSessionDetailModal(false);
                handleOpenEditSession(selectedSession);
              }}>
                <Edit2 size={14} /> 수정
              </Button>
              <Button onClick={() => setShowSessionDetailModal(false)}>닫기</Button>
            </ModalFooter>
          </Modal>
        </ModalOverlay>
      )}

      {/* Conflict Resolution Modal */}
      {isConflictModalOpen && conflictData && (
        <ModalOverlay onClick={(e) => e.target === e.currentTarget && handleCloseConflictModal()}>
          <ConflictModal>
            <ConflictHeader>
              <ConflictTitle>
                <AlertTriangle size={20} />
                수정 충돌 발생
              </ConflictTitle>
              <ConflictDescription>
                다른 사용자가 이 회차를 수정했습니다. 저장할 버전을 선택하세요.
              </ConflictDescription>
            </ConflictHeader>

            <ConflictContent>
              {/* 내 버전 */}
              <ConflictPane $isLeft>
                <ConflictPaneHeader
                  $selected={selectedVersion === 'mine'}
                  onClick={() => handleSelectVersion('mine')}
                >
                  <ConflictPaneTitle $selected={selectedVersion === 'mine'}>
                    내 버전
                    <ConflictPaneTime>
                      (편집 시작: {conflictData.myData.updatedAt
                        ? new Date(conflictData.myData.updatedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
                        : '알 수 없음'})
                    </ConflictPaneTime>
                  </ConflictPaneTitle>
                  <SelectButton
                    $selected={selectedVersion === 'mine'}
                    onClick={(e) => { e.stopPropagation(); handleSelectVersion('mine'); }}
                  >
                    {selectedVersion === 'mine' && <Check size={12} />}
                    선택
                  </SelectButton>
                </ConflictPaneHeader>
                <ConflictPaneBody $selected={selectedVersion === 'mine'}>
                  <ConflictFieldGroup>
                    <ConflictFieldLabel>연도/회차</ConflictFieldLabel>
                    <ConflictFieldValue>
                      {conflictData.myData.year}년 {conflictData.myData.sessionNumber}회차
                    </ConflictFieldValue>
                  </ConflictFieldGroup>
                  <ConflictFieldGroup>
                    <ConflictFieldLabel>일시</ConflictFieldLabel>
                    <ConflictFieldValue>
                      {conflictData.myData.sessionDate} {conflictData.myData.sessionTime || ''}
                    </ConflictFieldValue>
                  </ConflictFieldGroup>
                  <ConflictFieldGroup>
                    <ConflictFieldLabel>안건</ConflictFieldLabel>
                    <ConflictFieldValue>
                      {conflictData.myData.agendaItems?.map((item, i) => (
                        <div key={i}>{i + 1}. {item.title || '(제목 없음)'}</div>
                      )) || '(없음)'}
                    </ConflictFieldValue>
                  </ConflictFieldGroup>
                </ConflictPaneBody>
              </ConflictPane>

              {/* 서버 버전 */}
              <ConflictPane>
                <ConflictPaneHeader
                  $selected={selectedVersion === 'server'}
                  onClick={() => handleSelectVersion('server')}
                >
                  <ConflictPaneTitle $selected={selectedVersion === 'server'}>
                    서버 버전 (다른 사용자)
                    <ConflictPaneTime>
                      (수정: {conflictData.serverData.updatedAt
                        ? new Date(conflictData.serverData.updatedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
                        : '알 수 없음'})
                    </ConflictPaneTime>
                  </ConflictPaneTitle>
                  <SelectButton
                    $selected={selectedVersion === 'server'}
                    onClick={(e) => { e.stopPropagation(); handleSelectVersion('server'); }}
                  >
                    {selectedVersion === 'server' && <Check size={12} />}
                    선택
                  </SelectButton>
                </ConflictPaneHeader>
                <ConflictPaneBody $selected={selectedVersion === 'server'}>
                  <ConflictFieldGroup>
                    <ConflictFieldLabel>연도/회차</ConflictFieldLabel>
                    <ConflictFieldValue>
                      {conflictData.serverData.year}년 {conflictData.serverData.sessionNumber}회차
                    </ConflictFieldValue>
                  </ConflictFieldGroup>
                  <ConflictFieldGroup>
                    <ConflictFieldLabel>일시</ConflictFieldLabel>
                    <ConflictFieldValue>
                      {conflictData.serverData.sessionDate} {conflictData.serverData.sessionTime || ''}
                    </ConflictFieldValue>
                  </ConflictFieldGroup>
                  <ConflictFieldGroup>
                    <ConflictFieldLabel>안건</ConflictFieldLabel>
                    <ConflictFieldValue>
                      {conflictData.serverData.agendaItems?.map((item, i) => (
                        <div key={i}>{i + 1}. {item.title || '(제목 없음)'}</div>
                      )) || '(없음)'}
                    </ConflictFieldValue>
                  </ConflictFieldGroup>
                </ConflictPaneBody>
              </ConflictPane>
            </ConflictContent>

            <ConflictFooter>
              <Button onClick={handleCloseConflictModal}>취소</Button>
              <Button className="primary" onClick={handleResolveConflict}>
                선택한 버전으로 저장
              </Button>
            </ConflictFooter>
          </ConflictModal>
        </ModalOverlay>
      )}
      {/* Report Plan Conflict Modal */}
      {planConflict && (
        <ModalOverlay onClick={(e) => e.target === e.currentTarget && setPlanConflict(null)}>
          <ConflictModal>
            <ConflictHeader>
              <ConflictTitle>
                <AlertTriangle size={20} />
                보고 계획 수정 충돌
              </ConflictTitle>
              <ConflictDescription>
                다른 사용자가 보고 계획({PLAN_TAB_LABELS[planConflict.tabKey] || planConflict.tabKey})을 수정했습니다. 유지할 버전을 선택하세요.
              </ConflictDescription>
            </ConflictHeader>

            <ConflictContent>
              <ConflictPane $isLeft>
                <ConflictPaneHeader
                  $selected={selectedVersion === 'mine'}
                  onClick={() => setSelectedVersion('mine')}
                >
                  <ConflictPaneTitle $selected={selectedVersion === 'mine'}>
                    내 버전
                  </ConflictPaneTitle>
                  <SelectButton
                    $selected={selectedVersion === 'mine'}
                    onClick={(e) => { e.stopPropagation(); setSelectedVersion('mine'); }}
                  >
                    {selectedVersion === 'mine' && <Check size={12} />}
                    선택
                  </SelectButton>
                </ConflictPaneHeader>
                <ConflictPaneBody $selected={selectedVersion === 'mine'}>
                  {planConflict.myRounds.map((r, i) => (
                    <ConflictFieldGroup key={i}>
                      <ConflictFieldLabel>{r.roundNumber}회차</ConflictFieldLabel>
                      <ConflictFieldValue>
                        {r.items.map((it, j) => (
                          <div key={j}>{it.category ? `[${it.category}] ` : ''}{it.agenda || '(Agenda 없음)'}</div>
                        ))}
                      </ConflictFieldValue>
                    </ConflictFieldGroup>
                  ))}
                </ConflictPaneBody>
              </ConflictPane>

              <ConflictPane>
                <ConflictPaneHeader
                  $selected={selectedVersion === 'server'}
                  onClick={() => setSelectedVersion('server')}
                >
                  <ConflictPaneTitle $selected={selectedVersion === 'server'}>
                    서버 버전 (다른 사용자)
                  </ConflictPaneTitle>
                  <SelectButton
                    $selected={selectedVersion === 'server'}
                    onClick={(e) => { e.stopPropagation(); setSelectedVersion('server'); }}
                  >
                    {selectedVersion === 'server' && <Check size={12} />}
                    선택
                  </SelectButton>
                </ConflictPaneHeader>
                <ConflictPaneBody $selected={selectedVersion === 'server'}>
                  {planConflict.serverRounds.map((r, i) => (
                    <ConflictFieldGroup key={i}>
                      <ConflictFieldLabel>{r.roundNumber}회차</ConflictFieldLabel>
                      <ConflictFieldValue>
                        {r.items.map((it, j) => (
                          <div key={j}>{it.category ? `[${it.category}] ` : ''}{it.agenda || '(Agenda 없음)'}</div>
                        ))}
                      </ConflictFieldValue>
                    </ConflictFieldGroup>
                  ))}
                </ConflictPaneBody>
              </ConflictPane>
            </ConflictContent>

            <ConflictFooter>
              <Button onClick={() => setPlanConflict(null)}>취소</Button>
              <Button className="primary" onClick={() => {
                const tabKey = planConflict.tabKey;
                if (selectedVersion === 'mine') {
                  // 내 버전으로 강제 저장 (서버 updatedAt 사용하여 잠금 우회)
                  dirtyTabsRef.current[tabKey] = true;
                  setPlanUpdatedAt(prev => {
                    const next = { ...prev, [tabKey]: planConflict.serverUpdatedAt };
                    planUpdatedAtRef.current = next;
                    return next;
                  });
                  setPlanConflict(null);
                  // 다음 auto-save에서 새 updatedAt으로 저장됨
                } else {
                  // 서버 버전으로 교체
                  setPlanData(prev => ({ ...prev, [tabKey]: planConflict.serverRounds }));
                  setPlanUpdatedAt(prev => {
                    const next = { ...prev, [tabKey]: planConflict.serverUpdatedAt };
                    planUpdatedAtRef.current = next;
                    return next;
                  });
                  setPlanConflict(null);
                }
              }}>
                선택한 버전으로 저장
              </Button>
            </ConflictFooter>
          </ConflictModal>
        </ModalOverlay>
      )}
    </Container>
  );
};

export default MeetingManagementApp;
