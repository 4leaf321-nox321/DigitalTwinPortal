import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import styled from 'styled-components';
import { FileText, CheckCircle2, Clock, Search, ChevronLeft, ChevronRight, Edit2, Stamp, ShieldCheck, Undo2, AlertTriangle, ArrowUp, ArrowDown, X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { saveSystemSettings, searchUsers } from '../../services/settingsApi';
import ReportImg from '../ReportImage/ReportImg';
import { useReportImageSrc } from '../../utils/reportImageHelper';
// 수준값의 0 과 미입력은 다른 뜻이다. `|| '-'` 로 다루면 0 이 '-' 로 찍힌다.
import { percentText } from '../../utils/levelValue';

// 상세 과제 정보의 섹션 목록·한계는 `utils/detailSections` 가 정본이고,
// 본문 렌더링은 `ProjectDetailSections` 가 맡는다 — 이 파일은 이제 그것을 배치만 한다.
// 상세 과제 정보 본문·마일스톤 — '모든 과제 현황' 상세 보기와 **같은 컴포넌트**를 쓴다.
// 같은 데이터를 두 양식으로 보여주면 헷갈린다(2026-08-08 통합).
import ProjectDetailSections from './ProjectDetailSections';
import ProjectMilestones, {
  MilestoneBadge, getActionItemProgress,
} from './ProjectMilestones';
import ProjectBasicInfo, { getStatusStyle } from './ProjectBasicInfo';

const IMAGE_CATEGORIES = [
  { key: '개요그림', label: '개요 그림' },
  { key: '상세내용그림', label: '상세 내용 그림' },
  { key: '향후계획그림', label: '향후 계획 그림' },
];

// ── Styled Components ──
const Container = styled.div`
  display: flex;
  flex-direction: row;
  height: 100%;
  overflow: hidden;
`;

const MainArea = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
`;

const Sidebar = styled.div`
  width: ${p => p.$open ? '300px' : '40px'};
  background: white;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  transition: width 0.22s ease;
  flex-shrink: 0;
  overflow: hidden;
  position: relative;
`;

const ToggleCenterBtn = styled.button`
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  width: 26px;
  height: 32px;
  border: 1px solid #cbd5e1;
  border-radius: 0.35rem;
  background: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  z-index: 10;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);

  &:hover {
    background: #f1f5f9;
    color: #1e293b;
    border-color: #94a3b8;
  }
`;

const SidebarToggle = styled.button`
  position: absolute;
  top: 50%;
  right: -14px;
  transform: translateY(-50%);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid #cbd5e1;
  background: white;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);

  &:hover {
    background: #f8fafc;
    color: #1e293b;
  }
`;

const SidebarHeader = styled.div`
  position: relative;
  padding: 0.85rem 0.9rem 0.6rem;
  border-bottom: 1px solid #f1f5f9;
  flex-shrink: 0;
`;

const SidebarTitle = styled.div`
  font-size: 0.85rem;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 0.55rem;
  display: flex;
  align-items: center;
  gap: 0.35rem;
`;

const SidebarCount = styled.span`
  font-size: 0.7rem;
  font-weight: 600;
  color: #94a3b8;
  margin-left: auto;
`;

const SortToggleBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  padding: 0.15rem 0.4rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.35rem;
  background: white;
  color: #475569;
  font-size: 0.68rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.12s ease;

  &:hover {
    background: #f1f5f9;
    border-color: #94a3b8;
    color: #1e293b;
  }
`;

const SearchWrap = styled.div`
  position: relative;
  margin-bottom: 0.55rem;

  svg {
    position: absolute;
    left: 0.5rem;
    top: 50%;
    transform: translateY(-50%);
    color: #94a3b8;
    pointer-events: none;
  }
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 0.4rem 0.5rem 0.4rem 1.85rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.4rem;
  font-size: 0.8rem;
  color: #1e293b;
  outline: none;
  background: white;

  &:focus {
    border-color: #6366f1;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
  }
`;

const ChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-bottom: 0.45rem;

  &:last-child { margin-bottom: 0; }
`;

const ChipLabel = styled.div`
  font-size: 0.65rem;
  font-weight: 700;
  color: #64748b;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  margin-bottom: 0.2rem;
  width: 100%;
`;

const Chip = styled.button`
  padding: 0.18rem 0.5rem;
  background: ${p => p.$active ? (p.$color || '#6366f1') : 'white'};
  color: ${p => p.$active ? 'white' : (p.$color || '#475569')};
  border: 1px solid ${p => p.$active ? (p.$color || '#6366f1') : '#cbd5e1'};
  border-radius: 0.35rem;
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.12s ease;

  &:hover {
    background: ${p => p.$active ? (p.$color || '#4f46e5') : '#f8fafc'};
  }
`;

const ProjectList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0.4rem 0.5rem 0.5rem;
`;

const ProjectCard = styled.div`
  position: relative;
  width: 100%;
  text-align: left;
  padding: 0.55rem 0.65rem;
  border: 1px solid ${p => p.$active ? '#6366f1' : '#e2e8f0'};
  background: ${p => p.$active ? '#eef2ff' : 'white'};
  border-radius: 0.45rem;
  margin-bottom: 0.4rem;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  transition: all 0.12s ease;

  &:hover {
    border-color: ${p => p.$active ? '#6366f1' : '#94a3b8'};
    background: ${p => p.$active ? '#eef2ff' : '#f8fafc'};
  }

  &:hover .card-edit-btn {
    opacity: 1;
    pointer-events: auto;
  }
`;

const CardEditBtn = styled.button`
  position: absolute;
  top: 4px;
  right: 4px;
  width: 24px;
  height: 24px;
  border: 1px solid #cbd5e1;
  border-radius: 0.3rem;
  background: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #475569;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s ease, background 0.12s ease, border-color 0.12s ease;
  z-index: 2;

  &:hover {
    background: #eef2ff;
    border-color: #6366f1;
    color: #4f46e5;
  }
`;

const ProjectCardName = styled.div`
  font-size: 0.82rem;
  font-weight: 600;
  color: #1e293b;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const ProjectCardMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.68rem;
  color: #64748b;
  flex-wrap: wrap;
`;

const ProjectCardDivision = styled.span`
  padding: 0.1rem 0.4rem;
  background: #f1f5f9;
  border-radius: 0.25rem;
  font-weight: 700;
  color: #475569;
`;

const ProjectCardStatus = styled.span`
  padding: 0.1rem 0.4rem;
  background: ${p => p.$bg};
  color: ${p => p.$color};
  border-radius: 0.25rem;
  font-weight: 700;
`;

const SidebarEmpty = styled.div`
  padding: 2rem 1rem;
  text-align: center;
  color: #94a3b8;
  font-size: 0.78rem;
`;

const CollapsedHandle = styled.button`
  width: 40px;
  height: 100%;
  border: none;
  background: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding-top: 1.25rem;
  color: #64748b;

  &:hover {
    background: #f8fafc;
    color: #1e293b;
  }
`;

const CollapsedLabel = styled.div`
  writing-mode: vertical-rl;
  text-orientation: upright;
  font-size: 0.78rem;
  font-weight: 700;
  color: #64748b;
  letter-spacing: 0.18em;
`;

const SelectorBar = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 2rem;
  background: white;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
`;

const SelectorGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const SelectorLabel = styled.label`
  font-size: 0.8rem;
  font-weight: 600;
  color: #64748b;
  white-space: nowrap;
`;

const Select = styled.select`
  padding: 0.5rem 0.75rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
  font-size: 0.85rem;
  color: #1e293b;
  background: white;
  min-width: 120px;
  cursor: pointer;
  outline: none;

  &:focus {
    border-color: #6366f1;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
  }
`;

const ProjectSelect = styled(Select)`
  min-width: 300px;
  max-width: 500px;
`;

const NavButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid #cbd5e1;
  border-radius: 0.375rem;
  background: white;
  color: #475569;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover:not(:disabled) {
    background: #f1f5f9;
    border-color: #94a3b8;
  }

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
`;

const ReportContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem 2rem;
  background: #f8fafc;
`;

const TwoColumnLayout = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  align-items: start;

  @media (max-width: 1400px) {
    grid-template-columns: 1fr;
  }
`;

const LeftPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const RightPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;


const NoProjectMessage = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 400px;
  color: #94a3b8;
  gap: 1rem;
  font-size: 0.95rem;
`;

// ── 기본 정보 카드 ──
const ProjectNameBanner = styled.div`
  font-size: 1.2rem;
  font-weight: 800;
  color: #0f172a;
  padding: 0.75rem 0.25rem;
  border-bottom: 2px solid #e2e8f0;
  margin-bottom: 1rem;
  line-height: 1.4;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ProjectNameText = styled.div`
  flex: 1;
  min-width: 0;
`;

const NavArrowBtn = styled.button`
  width: 32px;
  height: 32px;
  border: 1px solid #cbd5e1;
  border-radius: 0.4rem;
  background: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #475569;
  flex-shrink: 0;
  transition: background 0.12s ease, border-color 0.12s ease;

  &:hover:not(:disabled) {
    background: #f1f5f9;
    border-color: #94a3b8;
    color: #1e293b;
  }

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
`;

const NavPositionLabel = styled.span`
  font-size: 0.78rem;
  font-weight: 600;
  color: #64748b;
  flex-shrink: 0;
  letter-spacing: 0;
`;

const PanelCard = styled.div`
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid #e2e8f0;
  overflow: hidden;
`;

const BasicInfoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0;
`;

const InfoField = styled.div`
  display: flex;
  border-bottom: 1px solid #f1f5f9;
  border-right: 1px solid #f1f5f9;
  min-height: 44px;
`;

const InfoLabel = styled.div`
  width: 110px;
  min-width: 110px;
  padding: 0.75rem 1rem;
  background: #f8fafc;
  font-size: 0.8rem;
  font-weight: 600;
  color: #475569;
  display: flex;
  align-items: center;
  border-right: 1px solid #f1f5f9;
`;

const InfoValue = styled.div`
  flex: 1;
  padding: 0.75rem 1rem;
  font-size: 0.85rem;
  color: #1e293b;
  display: flex;
  align-items: center;
  word-break: break-word;
`;

const StatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  background: ${props => props.$bgColor || '#e2e8f0'};
  color: ${props => props.$textColor || '#475569'};
`;

const ProgressBarContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
`;

const ProgressBar = styled.div`
  flex: 1;
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
  max-width: 200px;
`;

const ProgressFill = styled.div`
  height: 100%;
  background: ${props => {
    if (props.$value >= 100) return '#10b981';
    if (props.$value >= 70) return '#3b82f6';
    if (props.$value >= 30) return '#f59e0b';
    return '#ef4444';
  }};
  border-radius: 4px;
  width: ${props => Math.min(props.$value, 100)}%;
  transition: width 0.3s ease;
`;

const ProgressText = styled.span`
  font-size: 0.85rem;
  font-weight: 700;
  color: ${props => {
    if (props.$value >= 100) return '#10b981';
    if (props.$value >= 70) return '#3b82f6';
    if (props.$value >= 30) return '#f59e0b';
    return '#ef4444';
  }};
  min-width: 40px;
`;

const DetailContainerBody = styled.div`
  padding: 1.25rem 1.5rem;
`;

/* 상세 과제 정보 본문의 스타일(DetailParagraph·자식 줄·성과 표)은
   `ProjectDetailSections.jsx` 로 옮겼다 — 그 화면과 **같은 컴포넌트**를 쓴다.
   여기 남은 것은 이 파일에서 아직 쓰는 것들뿐이다(마일스톤 라벨·개요 이미지). */

const DetailParagraphLabel = styled.div`
  font-size: 0.95rem;
  font-weight: 700;
  color: #6366f1;
  margin-bottom: 0.5rem;
  letter-spacing: 0.02em;
`;

const MilestonePanelBody = styled.div`
  padding: 1.25rem 1.5rem;
`;

/* 마일스톤 타임라인(막대·점·날짜 꼬리표)은 `ProjectMilestones.jsx` 로 옮겼다 —
   '모든 과제 현황' 상세 보기와 **같은 양식**이어야 해서다. 배지도 그쪽에서 가져온다. */

const DetailInlineImages = styled.div`
  display: flex;
  gap: 0.75rem;
  margin-top: 0.75rem;
  flex-wrap: wrap;
`;

const SectionBadge = styled.span`
  font-size: 0.7rem;
  padding: 0.125rem 0.5rem;
  background: #e0e7ff;
  color: #4338ca;
  border-radius: 9999px;
  font-weight: 600;
`;

// 성과 테이블(PerfTable·PerfTh·PerfTd·PerfDelta)도 `ProjectDetailSections.jsx` 로 옮겼다.

/* 포인트+바를 하나의 그리드로 정렬 */
/* 가로 바: 첫 점 중심 ~ 마지막 점 중심 */
/* 포인트 아래 콘텐츠 — 동일 그리드 */
const PersonnelGroupWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
`;

const PersonnelGroupItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-wrap: wrap;
`;

const PersonBadge = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.3rem 0.625rem;
  background: ${props => props.$highlight ? '#ede9fe' : '#f5f3ff'};
  border: 1px solid ${props => props.$highlight ? '#c4b5fd' : '#e9d5ff'};
  border-radius: 0.375rem;
  font-size: 0.78rem;
  color: #6d28d9;
  font-weight: ${props => props.$highlight ? '600' : '500'};
`;

const DeptBadge = styled.div`
  padding: 0.3rem 0.625rem;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 0.375rem;
  font-size: 0.78rem;
  color: #16a34a;
  font-weight: 500;
`;

const ImageGrid = styled.div`
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
`;

const ImageItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  flex: 1;
  min-width: 250px;
`;

const ImagePreview = styled.div`
  position: relative;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  overflow: hidden;
  background: #f8fafc;
  cursor: zoom-in;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  img {
    width: 100%;
    display: block;
    object-fit: contain;
    max-height: 400px;
  }

  &:hover {
    border-color: #6366f1;
    box-shadow: 0 4px 14px rgba(99, 102, 241, 0.2);
  }

  &:hover .zoom-hint {
    opacity: 1;
  }
`;

const ZoomHint = styled.div`
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  background: rgba(15, 23, 42, 0.7);
  color: white;
  font-size: 0.7rem;
  font-weight: 600;
  opacity: 0;
  transition: opacity 0.15s ease;
  pointer-events: none;
`;

const ImageCaption = styled.div`
  font-size: 0.75rem;
  color: #64748b;
  text-align: center;
  font-style: italic;
`;

// ── 이미지 확대 보기(라이트박스) ──
const LightboxOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1400;
  background: rgba(15, 23, 42, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3.5rem;
  cursor: zoom-out;
`;

const LightboxFigure = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  max-width: 100%;
  max-height: 100%;
  cursor: default;
`;

const LightboxImage = styled.img`
  max-width: min(92vw, 1600px);
  max-height: 76vh;
  object-fit: contain;
  border-radius: 0.5rem;
  background: white;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55);
  transform: translate(${p => p.$x}px, ${p => p.$y}px) scale(${p => p.$scale});
  transition: ${p => (p.$dragging ? 'none' : 'transform 0.18s ease-out')};
  cursor: ${p => (p.$scale > 1 ? (p.$dragging ? 'grabbing' : 'grab') : 'zoom-in')};
  user-select: none;
  -webkit-user-drag: none;
  will-change: transform;
`;

const LightboxToolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.3rem;
  border-radius: 9999px;
  background: rgba(15, 23, 42, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.18);
`;

const ZoomButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  min-width: 32px;
  height: 32px;
  padding: 0 0.6rem;
  border: none;
  border-radius: 9999px;
  background: transparent;
  color: ${p => (p.disabled ? '#64748b' : '#e2e8f0')};
  font-size: 0.75rem;
  font-weight: 600;
  cursor: ${p => (p.disabled ? 'not-allowed' : 'pointer')};
  transition: background 0.15s ease, color 0.15s ease;

  &:hover:not(:disabled) {
    background: rgba(99, 102, 241, 0.85);
    color: white;
  }
`;

const ZoomLevel = styled.div`
  min-width: 52px;
  text-align: center;
  color: #e2e8f0;
  font-size: 0.75rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
`;

const LightboxCaption = styled.div`
  color: #e2e8f0;
  font-size: 0.875rem;
  text-align: center;
  max-width: 80vw;
  line-height: 1.5;
`;

const LightboxCounter = styled.div`
  color: #94a3b8;
  font-size: 0.78rem;
  font-weight: 600;
`;

const LightboxButton = styled.button`
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 50%;
  background: rgba(15, 23, 42, 0.75);
  color: white;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;

  &:hover {
    background: rgba(99, 102, 241, 0.9);
    border-color: rgba(255, 255, 255, 0.5);
  }
`;

const LightboxClose = styled(LightboxButton)`
  top: 1.25rem;
  right: 1.25rem;
`;

const LightboxPrev = styled(LightboxButton)`
  top: 50%;
  left: 1.25rem;
  transform: translateY(-50%);
`;

const LightboxNext = styled(LightboxButton)`
  top: 50%;
  right: 1.25rem;
  transform: translateY(-50%);
`;



// ── "완료 순서" 정렬 유틸 ──
const isProjectDone = (p) => (p.진행상태 || '') === '완료';

// 과제의 실제 완료 시점 도출: 완료된 마일스톤(액션아이템/세부항목)의 최종 완료일
//  tier 0 = 실제 완료일 보유(YYYY-MM-DD) → tier 1 = 계획 종료월 폴백 → tier 2 = 정보 없음(맨 뒤)
const getCompletionSortKey = (p) => {
  const dates = [];
  (p.액션아이템목록 || []).forEach(item => {
    if (item.완료여부 && item.완료일) dates.push(item.완료일);
    (item.세부항목목록 || []).forEach(s => { if (s.완료여부 && s.완료일) dates.push(s.완료일); });
  });
  if (dates.length) { dates.sort(); return { tier: 0, key: dates[dates.length - 1] }; }
  if (p.종료 != null && p.종료 !== '') return { tier: 1, key: String(p.종료).padStart(2, '0') };
  return { tier: 2, key: '' };
};

// ── "사무국 확인 순서" 정렬 유틸 ──
//  tier 0 = 확인 완료(확인일 보유) → tier 1 = 반려(요청일 보유) → tier 2 = 미확인(맨 뒤)
const getConfirmSortKey = (p, confirm) => {
  if (confirm?.status === 'confirmed' && confirm.at) return { tier: 0, key: confirm.at };
  if (confirm?.status === 'rejected' && confirm.at) return { tier: 1, key: confirm.at };
  return { tier: 2, key: '' };
};

// ── 컴포넌트 ──
const ProjectReportView = ({ projects = [], globalPerformances = [], currentYear, settingsData = {}, onEditProject }) => {
  const [selectedDivision, setSelectedDivision] = useState('all');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all'); // 진행상태 필터
  const [selectedReportStatus, setSelectedReportStatus] = useState('all'); // 보고서 작성상태 필터
  const [searchTerm, setSearchTerm] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // 기본 정렬 = **확인순 + 최근순** (2026-08-06).
  // 결과 보고서를 여는 이유는 대개 '최근에 확인된 것부터 훑기' 라서,
  // 완료 시점 오름차순(옛날 것부터)이 기본이면 매번 두 번 눌러 바꿔야 했다.
  const [sortDir, setSortDir] = useState('desc'); // desc = 최근 시점부터
  const [sortKey, setSortKey] = useState('confirmed'); // 'completion' | 'confirmed'

  // 보고서 작성 상태 판별
  const DETAIL_SECTION_KEYS = ['과제개요', '추진배경', '과제목표', '상세내용', '성과', '산출물', '향후계획'];
  const getReportStatus = (project) => {
    if (project.상세정보_입력완료) return '작성 완료';
    const hasAny = DETAIL_SECTION_KEYS.some(key => {
      const section = project[`상세정보_${key}`];
      if (!section || typeof section !== 'object') return false;
      if (section.enabled) return true;
      const items = Array.isArray(section.items) ? section.items : [];
      return items.some(item => {
        if (typeof item === 'string') return !!item.trim();
        if ((item?.text ?? '').trim()) return true;
        const children = Array.isArray(item?.children) ? item.children : [];
        return children.some(c => {
          const t = typeof c === 'string' ? c : (c?.text ?? '');
          return !!t.trim();
        });
      });
    });
    return hasAny ? '작성 중' : '미작성';
  };

  // ── 사무국 최종 확인(인장) ──
  const { user } = useAuth();
  const canConfirmReport = ['admin', 'dt_office'].includes(user?.role) || user?.is_admin;
  const [reportConfirms, setReportConfirms] = useState(settingsData?.reportConfirmations || {});
  const [savingConfirm, setSavingConfirm] = useState(false);
  // ── 챔피언 보고 ──
  // 사무국 확인과 **별개 표시**다. 둘 다 찍힐 수 있고 서로를 대체하지 않는다.
  // 권한·저장 방식은 사무국 확인과 같다(admin·dt_office, module_settings).
  const [championReports, setChampionReports] = useState(settingsData?.championReports || {});
  // 재검토 요청 모달 (수신자 선택)
  const [rejectModal, setRejectModal] = useState(null); // { project } | null
  const [rejectReason, setRejectReason] = useState('');
  const [rejectRecipients, setRejectRecipients] = useState([]); // [{id, name, email, department}]
  const [recipientQuery, setRecipientQuery] = useState('');
  const [recipientResults, setRecipientResults] = useState([]);
  // 사무국 확인 메모 모달
  const [memoModal, setMemoModal] = useState(null); // { project } | null
  const [memoText, setMemoText] = useState('');
  // 이미지 확대 보기 (라이트박스): { images: [...], index: number } | null
  const [lightbox, setLightbox] = useState(null);
  useEffect(() => {
    if (settingsData?.reportConfirmations && typeof settingsData.reportConfirmations === 'object') {
      setReportConfirms(settingsData.reportConfirmations);
    }
    if (settingsData?.championReports && typeof settingsData.championReports === 'object') {
      setChampionReports(settingsData.championReports);
    }
  }, [settingsData]);

  // 확대/이동 상태
  const ZOOM_MIN = 1;
  const ZOOM_MAX = 8;
  const ZOOM_RESET = { scale: 1, x: 0, y: 0 };
  const [zoom, setZoom] = useState(ZOOM_RESET);
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef(null);
  const lightboxImgRef = useRef(null);
  const lightboxOverlayRef = useRef(null);

  // [Phase 1-2] 라이트박스 이미지 src 해석
  //   imageId 가 있으면 서버에서, 없거나 실패하면 레거시 dataUrl 로 폴백한다.
  //   라이트박스 본문은 IIFE 안이라 훅을 쓸 수 없어 여기서 미리 해석해 둔다.
  const lightboxImage = lightbox ? lightbox.images[lightbox.index] : null;
  const { src: lightboxSrc } = useReportImageSrc(lightboxImage);

  const openLightbox = (images, index) => {
    if (!Array.isArray(images) || images.length === 0) return;
    setZoom(ZOOM_RESET);
    setLightbox({ images, index });
  };

  const closeLightbox = () => {
    setLightbox(null);
    setZoom(ZOOM_RESET);
    setDragging(false);
  };

  const stepLightbox = (delta) => {
    setZoom(ZOOM_RESET); // 이미지가 바뀌면 확대 상태 초기화
    setLightbox(prev => {
      if (!prev) return prev;
      const total = prev.images.length;
      return { ...prev, index: (prev.index + delta + total) % total };
    });
  };

  // 이미지 중심 기준으로 배율 변경 (anchor 를 주면 그 지점을 고정한 채 확대)
  const applyZoom = useCallback((nextScaleRaw, anchor) => {
    setZoom(prev => {
      const nextScale = Math.min(Math.max(nextScaleRaw, ZOOM_MIN), ZOOM_MAX);
      if (nextScale === prev.scale) return prev;
      if (nextScale <= ZOOM_MIN) return ZOOM_RESET; // 원본 크기로 돌아오면 위치도 초기화

      const el = lightboxImgRef.current;
      if (!anchor || !el) return { ...prev, scale: nextScale };

      // 커서 아래 지점이 그대로 있도록 오프셋 보정
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const ratio = nextScale / prev.scale;

      return {
        scale: nextScale,
        x: prev.x + (anchor.x - centerX) * (1 - ratio),
        y: prev.y + (anchor.y - centerY) * (1 - ratio)
      };
    });
  }, []);

  // 휠 확대/축소 - 페이지 스크롤을 막아야 해서 non-passive 리스너로 직접 등록
  useEffect(() => {
    const el = lightboxOverlayRef.current;
    if (!lightbox || !el) return;

    const handleWheel = (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      setZoom(prev => {
        const nextScale = Math.min(Math.max(prev.scale * factor, ZOOM_MIN), ZOOM_MAX);
        if (nextScale === prev.scale) return prev;
        if (nextScale <= ZOOM_MIN) return ZOOM_RESET;

        const img = lightboxImgRef.current;
        if (!img) return { ...prev, scale: nextScale };
        const rect = img.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const ratio = nextScale / prev.scale;
        return {
          scale: nextScale,
          x: prev.x + (e.clientX - centerX) * (1 - ratio),
          y: prev.y + (e.clientY - centerY) * (1 - ratio)
        };
      });
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [lightbox]);

  // 드래그 이동 (확대 상태에서만)
  useEffect(() => {
    if (!dragging) return;

    const handleMove = (e) => {
      const start = dragStartRef.current;
      if (!start) return;
      setZoom(prev => ({ ...prev, x: start.x + (e.clientX - start.clientX), y: start.y + (e.clientY - start.clientY) }));
    };
    const handleUp = () => {
      setDragging(false);
      dragStartRef.current = null;
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragging]);

  const handleImageMouseDown = (e) => {
    if (zoom.scale <= ZOOM_MIN) return;
    e.preventDefault();
    dragStartRef.current = { x: zoom.x, y: zoom.y, clientX: e.clientX, clientY: e.clientY };
    setDragging(true);
  };

  // 더블클릭: 원본 ↔ 2.5배 토글 (클릭 지점 기준)
  const handleImageDoubleClick = (e) => {
    if (zoom.scale > ZOOM_MIN) setZoom(ZOOM_RESET);
    else applyZoom(2.5, { x: e.clientX, y: e.clientY });
  };

  // 라이트박스 키보드 조작 (Esc 닫기 / ←→ 이동 / +− 확대축소 / 0 원본)
  useEffect(() => {
    if (!lightbox) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowRight') stepLightbox(1);
      else if (e.key === 'ArrowLeft') stepLightbox(-1);
      else if (e.key === '+' || e.key === '=') applyZoom(zoom.scale * 1.25);
      else if (e.key === '-' || e.key === '_') applyZoom(zoom.scale / 1.25);
      else if (e.key === '0') setZoom(ZOOM_RESET);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightbox, zoom.scale, applyZoom]);

  const keyOfProject = (p) => p.uuid || p.id;
  const getReportConfirm = (p) => reportConfirms[keyOfProject(p)] || null;

  // 보고서 내용 해시 (확정 이후 변경 감지용)
  const hashReportContent = (p) => {
    const payload = { done: !!p.상세정보_입력완료, perf: p.성과목록 || null };
    DETAIL_SECTION_KEYS.forEach(k => { payload[k] = p[`상세정보_${k}`] || null; });
    const str = JSON.stringify(payload);
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    return h.toString(16);
  };

  const persistReportConfirms = async (next) => {
    setSavingConfirm(true);
    try {
      await saveSystemSettings({ reportConfirmations: next });
      setReportConfirms(next);
      return true;
    } catch (err) {
      alert(`보고서 확인 상태 저장 실패: ${err.message}`);
      return false;
    } finally {
      setSavingConfirm(false);
    }
  };

  const getChampion = (p) => championReports[keyOfProject(p)] || null;

  const persistChampionReports = async (next) => {
    setSavingConfirm(true);
    try {
      await saveSystemSettings({ championReports: next });
      setChampionReports(next);
      return true;
    } catch (err) {
      alert(`챔피언 보고 상태 저장 실패: ${err.message}`);
      return false;
    } finally {
      setSavingConfirm(false);
    }
  };

  /** 챔피언 보고 표시/해제. 사무국 확인과 달리 반려·메모가 없어 토글 하나로 끝난다. */
  const toggleChampion = async (p) => {
    if (!canConfirmReport) return;
    const key = keyOfProject(p);
    const next = { ...championReports };
    if (next[key]?.status === 'reported') {
      if (!window.confirm('챔피언 보고 표시를 해제하시겠습니까?')) return;
      delete next[key];
    } else {
      next[key] = { status: 'reported', ...stampMeta() };
    }
    await persistChampionReports(next);
  };

  const stampMeta = () => {
    // toISOString 은 UTC 기준이라 KST 새벽 0~9시에 하루 전으로 찍힘 → 로컬 기준으로 포맷
    const d = new Date();
    const at = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return {
      by: user?.id || null,
      byName: user?.name || user?.username || user?.email || '',
      at,
    };
  };

  const confirmReport = async (p) => {
    if (!canConfirmReport) return;
    const next = { ...reportConfirms, [keyOfProject(p)]: { status: 'confirmed', ...stampMeta(), comment: '', hash: hashReportContent(p) } };
    await persistReportConfirms(next);
  };
  // 재검토 요청 모달 열기 (기본 수신자 = PL 이름과 일치하는 계정)
  const openRejectModal = async (p) => {
    if (!canConfirmReport) return;
    const existing = getReportConfirm(p);
    setRejectModal({ project: p });
    setRejectReason(existing?.status === 'rejected' ? (existing.comment || '') : '');
    setRejectRecipients(Array.isArray(existing?.recipients) ? existing.recipients : []);
    setRecipientQuery('');
    setRecipientResults([]);
    // 기본 수신자 자동 선정: 과제PL(없으면 작성자) 이름과 정확히 일치하는 계정
    const plName = (p.과제PL || p.작성자 || '').trim();
    if (plName && !(existing?.recipients?.length)) {
      try {
        const found = await searchUsers(plName);
        const exact = found.filter(u => u.name === plName);
        if (exact.length) setRejectRecipients(exact);
      } catch { /* 검색 실패 시 수동 추가 */ }
    }
  };
  const closeRejectModal = () => {
    setRejectModal(null); setRejectReason(''); setRejectRecipients([]);
    setRecipientQuery(''); setRecipientResults([]);
  };
  const addRecipient = (u) => {
    setRejectRecipients(prev => prev.some(r => r.id === u.id) ? prev : [...prev, u]);
    setRecipientQuery(''); setRecipientResults([]);
  };
  const removeRecipient = (id) => setRejectRecipients(prev => prev.filter(r => r.id !== id));
  const runRecipientSearch = async (q) => {
    setRecipientQuery(q);
    const term = q.trim();
    if (term.length < 1) { setRecipientResults([]); return; }
    try {
      const found = await searchUsers(term);
      setRecipientResults(found.filter(u => !rejectRecipients.some(r => r.id === u.id)));
    } catch { setRecipientResults([]); }
  };
  const submitReject = async () => {
    if (!canConfirmReport || !rejectModal) return;
    const p = rejectModal.project;
    const next = {
      ...reportConfirms,
      [keyOfProject(p)]: {
        status: 'rejected', ...stampMeta(),
        sentAt: new Date().toISOString(), // 재전송할 때마다 갱신 → 수신자 재알림 트리거
        comment: rejectReason.trim(),
        recipients: rejectRecipients.map(r => ({ id: r.id, name: r.name, email: r.email, department: r.department || '' })),
        hash: hashReportContent(p),
      }
    };
    const ok = await persistReportConfirms(next);
    if (ok) closeRejectModal();
  };
  const revokeReport = async (p) => {
    if (!canConfirmReport) return;
    if (!window.confirm('사무국 확인을 해제하시겠습니까?')) return;
    const next = { ...reportConfirms };
    delete next[keyOfProject(p)];
    await persistReportConfirms(next);
  };

  // ── 사무국 확인 메모 (확인된 보고서에 남기는 코멘트) ──
  const openMemoModal = (p) => {
    if (!canConfirmReport) return;
    setMemoModal({ project: p });
    setMemoText(getReportConfirm(p)?.comment || '');
  };
  const closeMemoModal = () => { setMemoModal(null); setMemoText(''); };
  const submitMemo = async () => {
    if (!canConfirmReport || !memoModal) return;
    const p = memoModal.project;
    const prev = getReportConfirm(p);
    if (!prev) return;
    // 확인 상태·확인자·확인일은 유지하고 메모만 갱신 (메모 수정이 확인 이력을 덮지 않도록)
    const next = {
      ...reportConfirms,
      [keyOfProject(p)]: {
        ...prev,
        comment: memoText.trim(),
        commentBy: user?.name || user?.username || user?.email || '',
        commentAt: stampMeta().at,
      }
    };
    const ok = await persistReportConfirms(next);
    if (ok) closeMemoModal();
  };

  // 현재 연도의 프로젝트 필터링
  const yearProjects = useMemo(() => {
    return projects.filter(p => p.과제년도 === currentYear && !p._deleted);
  }, [projects, currentYear]);

  // 사업부 목록 (지정 순서 우선: MX, VD, DA, NW, 의료기기, CS, GTR, SR)
  const divisions = useMemo(() => {
    const DIV_ORDER = ['MX', 'VD', 'DA', 'NW', '의료기기', 'CS', 'GTR', 'SR'];
    const divSet = new Set(yearProjects.map(p => p.사업부).filter(Boolean));
    const ordered = DIV_ORDER.filter(d => divSet.has(d));
    const others = Array.from(divSet).filter(d => !DIV_ORDER.includes(d)).sort();
    return [...ordered, ...others];
  }, [yearProjects]);

  // 사업부 + 진행상태 + 보고서상태 + 검색어 필터링된 과제 목록
  const filteredProjects = useMemo(() => {
    let list = yearProjects;
    if (selectedDivision !== 'all') list = list.filter(p => p.사업부 === selectedDivision);
    if (selectedStatus !== 'all') list = list.filter(p => (p.진행상태 || '미착수') === selectedStatus);
    if (selectedReportStatus === '사무국 확인') list = list.filter(p => getReportConfirm(p)?.status === 'confirmed');
    else if (selectedReportStatus === '반려') list = list.filter(p => getReportConfirm(p)?.status === 'rejected');
    else if (selectedReportStatus === '재확인 대기') list = list.filter(p => getReportConfirm(p)?.status === 'resubmitted');
    else if (selectedReportStatus !== 'all') list = list.filter(p => getReportStatus(p) === selectedReportStatus);
    const term = searchTerm.trim().toLowerCase();
    if (term) {
      list = list.filter(p =>
        (p.과제명 || '').toLowerCase().includes(term) ||
        (p.과제PL || p.PL || '').toLowerCase().includes(term)
      );
    }
    const dir = sortDir === 'asc' ? 1 : -1;

    if (sortKey === 'confirmed') {
      // 사무국 확인 순서: ①확인된 과제 우선 → ②확인 시점(오름/내림) → ③과제명
      //  ※ 확인 시점은 일(YYYY-MM-DD) 단위라 같은 날 확인분은 과제명 순으로 정렬됨
      return [...list].sort((a, b) => {
        const ca = getConfirmSortKey(a, getReportConfirm(a));
        const cb = getConfirmSortKey(b, getReportConfirm(b));
        if (ca.tier !== cb.tier) return ca.tier - cb.tier;
        if (ca.key !== cb.key) return (ca.key < cb.key ? -1 : 1) * dir;
        return (a.과제명 || '').localeCompare(b.과제명 || '', 'ko');
      });
    }

    // 완료 순서 정렬: ①완료 과제 우선 → ②완료시점 tier(실제완료>계획>미상) → ③완료 시점(오름/내림) → ④과제명
    return [...list].sort((a, b) => {
      if (isProjectDone(a) !== isProjectDone(b)) return isProjectDone(a) ? -1 : 1;
      const ka = getCompletionSortKey(a);
      const kb = getCompletionSortKey(b);
      if (ka.tier !== kb.tier) return ka.tier - kb.tier;
      if (ka.key !== kb.key) return (ka.key < kb.key ? -1 : 1) * dir;
      return (a.과제명 || '').localeCompare(b.과제명 || '', 'ko');
    });
  }, [yearProjects, selectedDivision, selectedStatus, selectedReportStatus, searchTerm, reportConfirms, sortDir, sortKey]);

  // 진행상태 목록 (현재 연도 기준)
  const statuses = useMemo(() => {
    const STATUS_ORDER = ['정상진행', '완료', '지연', '미착수', '계획', '미배정', '취소'];
    const set = new Set(yearProjects.map(p => p.진행상태 || '미착수'));
    return STATUS_ORDER.filter(s => set.has(s));
  }, [yearProjects]);

  // 선택된 과제
  const selectedProject = useMemo(() => {
    if (!selectedProjectId) return null;
    return projects.find(p => (p.uuid || p.id) === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  // 사업부 변경 시 과제 선택 초기화
  const handleDivisionChange = (div) => {
    setSelectedDivision(div);
    setSelectedProjectId('');
  };

  // 상태 색상 가져오기
  const getStatusStyle = (status) => {
    const statusMap = {
      '완료': { bg: '#dcfce7', text: '#16a34a' },
      '정상진행': { bg: '#dbeafe', text: '#2563eb' },
      '지연': { bg: '#fee2e2', text: '#dc2626' },
      '미착수': { bg: '#f3f4f6', text: '#6b7280' },
      '미배정': { bg: '#fef3c7', text: '#d97706' },
      '계획': { bg: '#e0e7ff', text: '#4f46e5' },
      '취소': { bg: '#fce7f3', text: '#be185d' },
    };
    return statusMap[status] || { bg: '#f3f4f6', text: '#6b7280' };
  };

  // 상세정보 섹션 데이터 가져오기
  const getSectionData = (project, key) => {
    const data = project[`상세정보_${key}`];
    if (!data || !data.enabled) return null;
    return data;
  };

  // 성과 목록에 전역 성과 정보를 얹는 일은 `ProjectDetailSections` 가 한다
  // (`enrichPerformances`) — 성과 표를 그리는 쪽이 그 표의 재료를 만든다.

  // 액션아이템 진행률 계산
  // 액션아이템 진행률은 `ProjectMilestones` 에서 가져온다(위 import) —
  // 그림을 그리는 쪽이 그 숫자의 정의도 갖는다.

  return (
    <Container>
      <Sidebar $open={sidebarOpen}>
        <ToggleCenterBtn
          onClick={() => setSidebarOpen(!sidebarOpen)}
          title={sidebarOpen ? '사이드바 숨기기' : '사이드바 펼치기'}
        >
          {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </ToggleCenterBtn>
        {sidebarOpen ? (
          <>
            <SidebarHeader>
              <SidebarTitle>
                📋 과제 선택
                <SidebarCount>{filteredProjects.length}개</SidebarCount>
                <SortToggleBtn
                  onClick={() => setSortKey(k => (k === 'completion' ? 'confirmed' : 'completion'))}
                  title={sortKey === 'completion'
                    ? '정렬 기준: 과제 완료 시점 (클릭 시 사무국 확인 시점 기준으로 전환)'
                    : '정렬 기준: 사무국 확인 시점 (클릭 시 과제 완료 시점 기준으로 전환)'}
                >
                  {sortKey === 'completion' ? <CheckCircle2 size={12} /> : <Stamp size={12} />}
                  {sortKey === 'completion' ? '완료순' : '확인순'}
                </SortToggleBtn>
                <SortToggleBtn
                  onClick={() => setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))}
                  title={sortDir === 'asc'
                    ? `${sortKey === 'completion' ? '먼저 완료된' : '먼저 확인된'} 과제부터 (클릭 시 최근순)`
                    : `${sortKey === 'completion' ? '최근 완료된' : '최근 확인된'} 과제부터 (클릭 시 빠른순)`}
                >
                  {sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                  {sortDir === 'asc' ? '빠른순' : '최근순'}
                </SortToggleBtn>
              </SidebarTitle>
              <SearchWrap>
                <Search size={13} />
                <SearchInput
                  type="text"
                  placeholder="과제명 / PL 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </SearchWrap>
              <ChipLabel>사업부</ChipLabel>
              <ChipRow>
                <Chip $active={selectedDivision === 'all'} onClick={() => handleDivisionChange('all')}>전체</Chip>
                {divisions.map(div => (
                  <Chip
                    key={div}
                    $active={selectedDivision === div}
                    onClick={() => handleDivisionChange(div)}
                  >
                    {div}
                  </Chip>
                ))}
              </ChipRow>
              <ChipLabel>진행상태</ChipLabel>
              <ChipRow>
                <Chip $active={selectedStatus === 'all'} onClick={() => setSelectedStatus('all')}>전체</Chip>
                {statuses.map(s => {
                  const style = getStatusStyle(s);
                  return (
                    <Chip
                      key={s}
                      $active={selectedStatus === s}
                      $color={style.text}
                      onClick={() => setSelectedStatus(s)}
                    >
                      {s}
                    </Chip>
                  );
                })}
              </ChipRow>
              <ChipLabel>보고서</ChipLabel>
              <ChipRow>
                <Chip $active={selectedReportStatus === 'all'} onClick={() => setSelectedReportStatus('all')}>전체</Chip>
                <Chip
                  $active={selectedReportStatus === '미작성'}
                  $color="#94a3b8"
                  onClick={() => setSelectedReportStatus('미작성')}
                >
                  미작성
                </Chip>
                <Chip
                  $active={selectedReportStatus === '작성 중'}
                  $color="#d97706"
                  onClick={() => setSelectedReportStatus('작성 중')}
                >
                  작성 중
                </Chip>
                <Chip
                  $active={selectedReportStatus === '작성 완료'}
                  $color="#059669"
                  onClick={() => setSelectedReportStatus('작성 완료')}
                >
                  작성 완료
                </Chip>
                <Chip
                  $active={selectedReportStatus === '사무국 확인'}
                  $color="#4f46e5"
                  onClick={() => setSelectedReportStatus('사무국 확인')}
                >
                  사무국 확인
                </Chip>
                <Chip
                  $active={selectedReportStatus === '반려'}
                  $color="#dc2626"
                  onClick={() => setSelectedReportStatus('반려')}
                >
                  재검토 요청
                </Chip>
                {/* 보완했다고 알려 온 것. 사무국이 여기서 다시 확인한다. */}
                <Chip
                  $active={selectedReportStatus === '재확인 대기'}
                  $color="#b45309"
                  onClick={() => setSelectedReportStatus('재확인 대기')}
                >
                  재확인 대기
                </Chip>
              </ChipRow>
            </SidebarHeader>
            <ProjectList>
              {filteredProjects.length === 0 ? (
                <SidebarEmpty>일치하는 과제가 없습니다.</SidebarEmpty>
              ) : (
                filteredProjects.map(p => {
                  const id = p.uuid || p.id;
                  const style = getStatusStyle(p.진행상태);
                  return (
                    <ProjectCard
                      key={id}
                      $active={id === selectedProjectId}
                      onClick={() => setSelectedProjectId(id)}
                    >
                      {onEditProject && (
                        <CardEditBtn
                          className="card-edit-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditProject(p, { openDetailInfo: true });
                          }}
                          title="상세 과제 정보 입력"
                        >
                          <Edit2 size={12} />
                        </CardEditBtn>
                      )}
                      <ProjectCardName>{p.과제명}</ProjectCardName>
                      <ProjectCardMeta>
                        <ProjectCardDivision>{p.사업부 || '?'}</ProjectCardDivision>
                        <ProjectCardStatus $bg={style.bg} $color={style.text}>
                          {p.진행상태 || '미착수'}
                        </ProjectCardStatus>
                        {(() => {
                          const sc = getReportConfirm(p);
                          if (sc?.status === 'confirmed') {
                            const changed = sc.hash && sc.hash !== hashReportContent(p);
                            const tip = [
                              changed ? '확정 이후 변경됨' : '사무국 확인',
                              sc.comment ? `메모: ${sc.comment}` : ''
                            ].filter(Boolean).join('\n');
                            return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem', fontSize: '0.66rem', fontWeight: 700, color: '#4338ca', background: '#eef2ff', padding: '0.05rem 0.35rem', borderRadius: '0.3rem' }} title={tip}>🔖 확인{changed ? ' ⚠️' : ''}{sc.comment ? ' 💬' : ''}</span>;
                          }
                          /* 받은 사람이 「보완했습니다」를 누른 상태. 사무국이
                             재확인해야 끝난다 — 이 표가 없으면 사무국은 보완된
                             줄을 모르고, 사람은 알렸는데 아무 일도 안 일어난다. */
                          if (sc?.status === 'resubmitted') {
                            const who = [sc.resubmittedByName, String(sc.resubmittedAt || '').slice(0, 10)]
                              .filter(Boolean).join(' · ');
                            return <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#b45309', background: '#fef3c7', padding: '0.05rem 0.35rem', borderRadius: '0.3rem' }} title={['보완했다고 알려 왔습니다 — 재확인이 필요합니다', who, sc.comment ? `요청 사유: ${sc.comment}` : ''].filter(Boolean).join('\n')}>🔁 재확인 대기</span>;
                          }
                          if (sc?.status === 'rejected') {
                            return <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#b91c1c', background: '#fee2e2', padding: '0.05rem 0.35rem', borderRadius: '0.3rem' }} title={sc.comment || ''}>⛔ 재검토</span>;
                          }
                          return null;
                        })()}
                        {getChampion(p)?.status === 'reported' && (
                          <span
                            style={{ fontSize: '0.66rem', fontWeight: 700, color: '#92400e', background: '#fef3c7', padding: '0.05rem 0.35rem', borderRadius: '0.3rem' }}
                            title={`챔피언 보고 · ${getChampion(p).byName || ''} ${getChampion(p).at || ''}`}
                          >🏆 챔피언</span>
                        )}
                        {(p.과제PL || p.PL) && <span>· PL {p.과제PL || p.PL}</span>}
                      </ProjectCardMeta>
                    </ProjectCard>
                  );
                })
              )}
            </ProjectList>
          </>
        ) : (
          <CollapsedHandle onClick={() => setSidebarOpen(true)} title="과제 선택 펼치기">
            <CollapsedLabel>과제 선택</CollapsedLabel>
          </CollapsedHandle>
        )}
      </Sidebar>

      <MainArea>
      {/* 보고서 콘텐츠 */}
      <ReportContent>
        {!selectedProject ? (
          <NoProjectMessage>
            <FileText size={48} strokeWidth={1.5} />
            <div>과제를 선택하면 결과 보고서가 표시됩니다.</div>
          </NoProjectMessage>
        ) : (
          <>
            {/* 과제명 배너 (전체 너비) */}
            <ProjectNameBanner>
              <NavArrowBtn
                onClick={() => {
                  if (filteredProjects.length === 0) return;
                  const idx = filteredProjects.findIndex(p => (p.uuid || p.id) === selectedProjectId);
                  const prev = idx <= 0 ? filteredProjects.length - 1 : idx - 1;
                  const p = filteredProjects[prev];
                  setSelectedProjectId(p.uuid || p.id);
                }}
                disabled={filteredProjects.length <= 1}
                title="이전 과제"
              >
                <ChevronLeft size={18} />
              </NavArrowBtn>
              <ProjectNameText>{selectedProject.과제명}</ProjectNameText>
              {filteredProjects.length > 0 && (() => {
                const idx = filteredProjects.findIndex(p => (p.uuid || p.id) === selectedProjectId);
                return idx >= 0 ? (
                  <NavPositionLabel style={{ order: 1 }}>{idx + 1} / {filteredProjects.length}</NavPositionLabel>
                ) : null;
              })()}
              <NavArrowBtn
                onClick={() => {
                  if (filteredProjects.length === 0) return;
                  const idx = filteredProjects.findIndex(p => (p.uuid || p.id) === selectedProjectId);
                  const next = idx >= filteredProjects.length - 1 ? 0 : idx + 1;
                  const p = filteredProjects[next];
                  setSelectedProjectId(p.uuid || p.id);
                }}
                disabled={filteredProjects.length <= 1}
                title="다음 과제"
                style={{ order: 2 }}
              >
                <ChevronRight size={18} />
              </NavArrowBtn>

              {/* 사무국 최종 확인(인장) — 배너 우측 */}
              {(() => {
                const seal = getReportConfirm(selectedProject);
                const champ = getChampion(selectedProject);
                const baseStatus = getReportStatus(selectedProject);
                const changedAfterSeal = seal?.status === 'confirmed' && seal.hash && seal.hash !== hashReportContent(selectedProject);
                const sbtn = (label, onClick, { primary, danger, disabled } = {}) => (
                  <button
                    onClick={onClick}
                    disabled={disabled || savingConfirm}
                    style={{
                      padding: '0.25rem 0.6rem', fontSize: '0.72rem', fontWeight: 700, borderRadius: '0.4rem',
                      cursor: (disabled || savingConfirm) ? 'not-allowed' : 'pointer',
                      border: primary ? 'none' : `1px solid ${danger ? '#fca5a5' : '#cbd5e1'}`,
                      color: primary ? '#fff' : (danger ? '#b91c1c' : '#475569'),
                      background: primary ? '#4f46e5' : (danger ? '#fef2f2' : '#fff'),
                      opacity: (disabled || savingConfirm) ? 0.55 : 1,
                    }}
                  >{label}</button>
                );
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0, order: 0 }}>
                    {seal?.status === 'confirmed' && (
                      <span title={`${seal.byName || '사무국'} · ${seal.at}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.55rem', border: '2px solid #4f46e5', color: '#4338ca', borderRadius: '0.45rem', fontWeight: 800, fontSize: '0.76rem', transform: 'rotate(-3deg)', background: '#f5f3ff' }}>
                        <Stamp size={13} /> 사무국 확인
                      </span>
                    )}
                    {/* 챔피언 보고 — 사무국 확인과 **별개**라 둘 다 찍힐 수 있다 */}
                    {champ?.status === 'reported' && (
                      <span title={`${champ.byName || ''} · ${champ.at}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.55rem', border: '2px solid #b45309', color: '#92400e', borderRadius: '0.45rem', fontWeight: 800, fontSize: '0.76rem', transform: 'rotate(-3deg)', background: '#fffbeb' }}>
                        <Stamp size={13} /> 챔피언 보고
                      </span>
                    )}
                    {seal?.status === 'confirmed' && changedAfterSeal && (
                      <span title="확정 이후 보고서가 변경되었습니다" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.7rem', fontWeight: 700, color: '#b45309', background: '#fef3c7', padding: '0.15rem 0.4rem', borderRadius: '0.35rem' }}>
                        <AlertTriangle size={12} /> 변경됨
                      </span>
                    )}
                    {!seal && baseStatus === '작성 완료' && !canConfirmReport && (
                      <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#94a3b8' }}>확인 대기</span>
                    )}
                    {canConfirmReport && (
                      seal?.status === 'confirmed'
                        ? (
                          <>
                            {sbtn(seal.comment ? '💬 메모 수정' : '💬 메모 추가', () => openMemoModal(selectedProject))}
                            {sbtn('확인 해제', () => revokeReport(selectedProject), { danger: true })}
                          </>
                        )
                        : (
                          <>
                            {sbtn('✔ 최종 확인', () => confirmReport(selectedProject), { primary: true, disabled: baseStatus !== '작성 완료' })}
                            {sbtn('재검토 요청', () => openRejectModal(selectedProject), { danger: true })}
                          </>
                        )
                    )}
                    {/* 챔피언 보고는 사무국 확인 여부와 무관하게 켜고 끌 수 있다 */}
                    {canConfirmReport && sbtn(
                      champ?.status === 'reported' ? '챔피언 보고 해제' : '🏆 챔피언 보고',
                      () => toggleChampion(selectedProject)
                    )}
                  </div>
                );
              })()}
            </ProjectNameBanner>

            {/* 사무국 확인 메모 콜아웃 */}
            {(() => {
              const seal = getReportConfirm(selectedProject);
              if (seal?.status !== 'confirmed' || !seal.comment) return null;
              return (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                  padding: '0.6rem 0.9rem', margin: '0 0 0.9rem', borderRadius: '0.55rem',
                  background: '#f5f3ff', border: '1px solid #ddd6fe', color: '#4338ca',
                }}>
                  <Stamp size={16} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                  <div style={{ fontSize: '0.85rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    <strong style={{ fontWeight: 800 }}>사무국 메모</strong>
                    {(seal.commentBy || seal.commentAt) && (
                      <span style={{ fontSize: '0.72rem', color: '#7c74d8', fontWeight: 600, marginLeft: '0.4rem' }}>
                        {[seal.commentBy, seal.commentAt].filter(Boolean).join(' · ')}
                      </span>
                    )}
                    <div style={{ marginTop: '0.2rem' }}>{seal.comment}</div>
                  </div>
                </div>
              );
            })()}

            {/* 재검토 요청 사유 콜아웃 (요청자 미표시) */}
            {(() => {
              const seal = getReportConfirm(selectedProject);
              // ⚠️ 보완한 뒤(`resubmitted`)에도 사유를 계속 보여준다. 사무국이
              //    재확인할 때 **무엇을 지적했는지**를 다시 읽어야 하기 때문이다.
              if (seal?.status !== 'rejected' && seal?.status !== 'resubmitted') return null;
              return (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                  padding: '0.6rem 0.9rem', margin: '0 0 0.9rem', borderRadius: '0.55rem',
                  background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
                }}>
                  <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                  <div style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>
                    <strong style={{ fontWeight: 800 }}>재검토 요청</strong>
                    {seal.comment ? <span> — {seal.comment}</span> : <span style={{ color: '#b91c1c' }}> (사유 미기재)</span>}
                  </div>
                </div>
              );
            })()}

            {/* ═══ 2단 레이아웃 ═══ */}
            <TwoColumnLayout>
              {/* ── 좌측: 과제 정보 + 마일스톤 + 담당 인력 ── */}
              <LeftPanel>
                {/* ① 기본 정보 */}
                <PanelCard>
                  {/*
                    기본 정보 표 — '모든 과제 현황' 상세 보기와 **같은 컴포넌트**다.
                    같은 과제 정보를 두 화면이 다른 표로 보여주면 다른 값처럼 읽힌다.
                  */}
                  <ProjectBasicInfo project={selectedProject} onImageClick={openLightbox} />
                </PanelCard>

                {/* ② 마일스톤 */}
                {selectedProject.액션아이템목록 && selectedProject.액션아이템목록.length > 0 && (
                  <PanelCard>
                    <MilestonePanelBody>
                      <DetailParagraphLabel>
                        마일스톤
                        {(() => {
                          const prog = getActionItemProgress(selectedProject);
                          return <MilestoneBadge>{prog.completed}/{prog.total} ({prog.rate}%)</MilestoneBadge>;
                        })()}
                      </DetailParagraphLabel>
                      <ProjectMilestones project={selectedProject} />
                    </MilestonePanelBody>
                  </PanelCard>
                )}
              </LeftPanel>

              {/* ── 우측: 상세 과제 정보 ── */}
              <RightPanel>
                <PanelCard>
                  <DetailContainerBody>
                    {/*
                      상세 과제 정보 — **'모든 과제 현황' 상세 보기와 같은 컴포넌트**를 쓴다.
                      같은 내용을 두 양식으로 보여주면 사람이 헷갈린다(2026-08-08).
                      개요·추진배경은 왼쪽 기본정보 칸에 이미 있으므로 여기서 뺀다.
                    */}
                    <ProjectDetailSections
                      project={selectedProject}
                      performances={globalPerformances}
                      exclude={['과제개요', '추진배경']}
                      onImageClick={openLightbox}
                    />
                  </DetailContainerBody>
                </PanelCard>
              </RightPanel>
            </TwoColumnLayout>
          </>
        )}
      </ReportContent>
      </MainArea>

      {/* 재검토 요청 모달 (사유 + 수신자 선택) */}
      {rejectModal && (
        <div
          onClick={closeRejectModal}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '0.75rem', width: 'min(560px, 94vw)', maxHeight: '86vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden' }}
          >
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#991b1b' }}>재검토 요청</div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 2 }}>{rejectModal.project.과제명}</div>
            </div>
            <div style={{ padding: '1rem 1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* 사유 */}
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginBottom: '0.4rem' }}>재검토 요청 사유</div>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="보완이 필요한 사유를 입력하세요"
                  style={{ width: '100%', minHeight: '80px', padding: '0.55rem 0.7rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', fontSize: '0.85rem', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>
              {/* 수신자 */}
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginBottom: '0.4rem' }}>
                  수신자 <span style={{ color: '#94a3b8', fontWeight: 500 }}>(기본: 과제PL "{rejectModal.project.과제PL || rejectModal.project.작성자 || '-'}"와 동일 이름 계정)</span>
                </div>
                {/* 선택된 수신자 칩 */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
                  {rejectRecipients.length === 0 && <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>선택된 수신자가 없습니다.</span>}
                  {rejectRecipients.map(r => (
                    <span key={r.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem 0.5rem', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: '0.4rem', fontSize: '0.78rem', color: '#3730a3' }}>
                      {r.name}<span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>{r.department ? `· ${r.department}` : ''} · {r.email}</span>
                      <button onClick={() => removeRecipient(r.id)} title="제거" style={{ border: 'none', background: 'transparent', color: '#6366f1', cursor: 'pointer', fontWeight: 800, lineHeight: 1 }}>×</button>
                    </span>
                  ))}
                </div>
                {/* 검색 추가 */}
                <div style={{ position: 'relative' }}>
                  <input
                    value={recipientQuery}
                    onChange={(e) => runRecipientSearch(e.target.value)}
                    placeholder="이름으로 계정 검색하여 추가"
                    style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '0.45rem', fontSize: '0.82rem', boxSizing: 'border-box' }}
                  />
                  {recipientResults.length > 0 && (
                    <div style={{ position: 'absolute', zIndex: 5, left: 0, right: 0, top: '100%', marginTop: 2, background: '#fff', border: '1px solid #c7d2fe', borderRadius: '0.4rem', maxHeight: '180px', overflowY: 'auto', boxShadow: '0 6px 18px rgba(0,0,0,0.12)' }}>
                      {recipientResults.map(u => (
                        <div key={u.id} onMouseDown={(e) => { e.preventDefault(); addRecipient(u); }}
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: '1px solid #f1f5f9' }}>
                          <span style={{ fontWeight: 600, color: '#1e293b' }}>{u.name}</span>
                          <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#94a3b8' }}>{u.department ? `${u.department} · ` : ''}{u.email}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={closeRejectModal} disabled={savingConfirm} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 600, color: '#475569', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '0.5rem', cursor: 'pointer' }}>취소</button>
              <button onClick={submitReject} disabled={savingConfirm || rejectRecipients.length === 0} style={{ padding: '0.5rem 1.1rem', fontSize: '0.85rem', fontWeight: 700, color: '#fff', background: '#dc2626', border: 'none', borderRadius: '0.5rem', cursor: (savingConfirm || rejectRecipients.length === 0) ? 'not-allowed' : 'pointer', opacity: (savingConfirm || rejectRecipients.length === 0) ? 0.6 : 1 }}>
                {savingConfirm ? '전송 중…' : '재검토 요청 보내기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 사무국 확인 메모 입력 모달 */}
      {memoModal && (
        <div
          onClick={closeMemoModal}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '0.75rem', width: 'min(520px, 94vw)', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden' }}
          >
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#4338ca', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Stamp size={17} /> 사무국 메모
              </div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 2 }}>{memoModal.project.과제명}</div>
            </div>
            <div style={{ padding: '1rem 1.25rem' }}>
              <textarea
                value={memoText}
                onChange={(e) => setMemoText(e.target.value)}
                placeholder="확인 의견, 참고 사항 등을 남겨주세요 (비워두면 메모가 삭제됩니다)"
                autoFocus
                style={{ width: '100%', minHeight: '120px', padding: '0.55rem 0.7rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', fontSize: '0.85rem', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.5 }}
              />
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.4rem' }}>
                * 메모는 보고서를 보는 모든 사용자에게 표시되며, 확인 상태와 확인일은 변경되지 않습니다.
              </div>
            </div>
            <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={closeMemoModal} disabled={savingConfirm} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 600, color: '#475569', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '0.5rem', cursor: 'pointer' }}>취소</button>
              <button onClick={submitMemo} disabled={savingConfirm} style={{ padding: '0.5rem 1.1rem', fontSize: '0.85rem', fontWeight: 700, color: '#fff', background: '#4f46e5', border: 'none', borderRadius: '0.5rem', cursor: savingConfirm ? 'not-allowed' : 'pointer', opacity: savingConfirm ? 0.6 : 1 }}>
                {savingConfirm ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 이미지 확대 보기 (배경 클릭 / Esc 로 닫기, ←→ 로 이동) */}
      {lightbox && (() => {
        const current = lightbox.images[lightbox.index];
        if (!current) return null;
        const hasMultiple = lightbox.images.length > 1;

        return (
          <LightboxOverlay ref={lightboxOverlayRef} onClick={closeLightbox}>
            <LightboxClose onClick={closeLightbox} title="닫기 (Esc)">
              <X size={20} />
            </LightboxClose>

            {hasMultiple && (
              <>
                <LightboxPrev
                  onClick={(e) => { e.stopPropagation(); stepLightbox(-1); }}
                  title="이전 이미지 (←)"
                >
                  <ChevronLeft size={22} />
                </LightboxPrev>
                <LightboxNext
                  onClick={(e) => { e.stopPropagation(); stepLightbox(1); }}
                  title="다음 이미지 (→)"
                >
                  <ChevronRight size={22} />
                </LightboxNext>
              </>
            )}

            <LightboxFigure onClick={(e) => e.stopPropagation()}>
              <LightboxImage
                ref={lightboxImgRef}
                src={lightboxSrc || current.dataUrl}
                alt={current.caption || current.fileName || '보고서 이미지'}
                $scale={zoom.scale}
                $x={zoom.x}
                $y={zoom.y}
                $dragging={dragging}
                onMouseDown={handleImageMouseDown}
                onDoubleClick={handleImageDoubleClick}
                draggable={false}
              />

              <LightboxToolbar onClick={(e) => e.stopPropagation()}>
                <ZoomButton
                  onClick={() => applyZoom(zoom.scale / 1.25)}
                  disabled={zoom.scale <= ZOOM_MIN}
                  title="축소 (−)"
                >
                  <ZoomOut size={15} />
                </ZoomButton>
                <ZoomLevel>{Math.round(zoom.scale * 100)}%</ZoomLevel>
                <ZoomButton
                  onClick={() => applyZoom(zoom.scale * 1.25)}
                  disabled={zoom.scale >= ZOOM_MAX}
                  title="확대 (+)"
                >
                  <ZoomIn size={15} />
                </ZoomButton>
                <ZoomButton
                  onClick={() => setZoom(ZOOM_RESET)}
                  disabled={zoom.scale === ZOOM_MIN && zoom.x === 0 && zoom.y === 0}
                  title="원본 크기 (0)"
                >
                  <RotateCcw size={14} />원본
                </ZoomButton>
              </LightboxToolbar>

              {(current.caption || current.fileName) && (
                <LightboxCaption>{current.caption || current.fileName}</LightboxCaption>
              )}
              {hasMultiple && (
                <LightboxCounter>{lightbox.index + 1} / {lightbox.images.length}</LightboxCounter>
              )}
            </LightboxFigure>
          </LightboxOverlay>
        );
      })()}
    </Container>
  );
};

export default ProjectReportView;
