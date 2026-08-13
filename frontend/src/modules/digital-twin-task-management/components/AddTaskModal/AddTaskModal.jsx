import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, ChevronDown, ChevronRight, ChevronLeft, Download, FileText, Trash2, UserPlus, AlertTriangle, CheckCircle2, Pencil, RotateCcw, Lock } from 'lucide-react';
import JSZip from 'jszip';
import { fetchSystemSettings } from '../../../digital-twin-dashboard/services/settingsApi';
import { settingsData as defaultSettingsData } from '../../../digital-twin-dashboard/data/sampleDataV2';
import PersonnelModal from './PersonnelModal';
import { todayLocalYmd } from '../../../../shared/utils/localDate';

const TODAY = () => todayLocalYmd();

// 다음 자동 채번 번호 계산: 기존 과제의 Sim-XXX 중 최댓값 + 1
const computeNextSimNumber = (tasks, excludeUuid) => {
  let max = 0;
  (tasks || []).forEach(t => {
    if (excludeUuid && t.uuid === excludeUuid) return;
    const id = t.식별ID || (t.식별번호 ? `Sim-${String(t.식별번호).padStart(3, '0')}` : '');
    const m = id.match(/^Sim-(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && n > max) max = n;
    }
  });
  return String(max + 1).padStart(3, '0');
};

// ============== Styled Components ==============

const Overlay = styled(motion.div)`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20000;
`;

const ModalContainer = styled(motion.div)`
  background: #ffffff;
  border-radius: 16px;
  width: 80vw;
  height: 80vh;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
`;

const ModalHeader = styled.div`
  background: linear-gradient(135deg, #10b981, #059669);
  padding: 16px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: white;
  flex-shrink: 0;
`;

const HeaderTitle = styled.h2`
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const CloseButton = styled.button`
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s;
  &:hover { background: rgba(255, 255, 255, 0.3); }
`;

/* 좌우 패널 레이아웃 */
const BodyWrapper = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
`;

const LeftPanel = styled.div`
  flex: 1;
  min-width: 0;
  border-right: 1px solid #e5e7eb;
  padding: 24px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const LeftPanelTitle = styled.h3`
  margin: 0;
  font-size: 0.9rem;
  font-weight: 700;
  color: #1e293b;
  padding-bottom: 8px;
  border-bottom: 2px solid #10b981;
`;

const RightPanel = styled.div`
  flex: 3;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const RightPanelHeader = styled.div`
  padding: 16px 24px 0;
  flex-shrink: 0;
`;

const RightPanelScroll = styled.div`
  flex: 1;
  overflow-y: auto;
  min-height: 0;
`;

const RightPanelTitle = styled.h3`
  margin: 0 0 12px;
  font-size: 0.9rem;
  font-weight: 700;
  color: #1e293b;
  padding-bottom: 8px;
  border-bottom: 2px solid #6366f1;
`;

const CategoryTabs = styled.div`
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  padding: 0 24px;
  flex-shrink: 0;
  border-bottom: 1px solid #e2e8f0;
`;

const CategoryTab = styled.button`
  padding: 9px 18px;
  border: none;
  border-bottom: 2.5px solid ${props => props.$active ? '#6366f1' : 'transparent'};
  background: ${props => props.$active ? '#eef2ff' : 'transparent'};
  color: ${props => props.$active ? '#4f46e5' : '#64748b'};
  font-size: 0.82rem;
  font-weight: ${props => props.$active ? '700' : '500'};
  cursor: pointer;
  border-radius: 6px 6px 0 0;
  transition: all 0.15s;
  margin-bottom: -1px;
  &:hover {
    background: ${props => props.$active ? '#eef2ff' : '#f8fafc'};
    color: ${props => props.$active ? '#4f46e5' : '#334155'};
  }
`;

const ActivityContent = styled.div`
  padding: 20px 24px 24px;
`;

const ActivityGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
`;

const ActivityField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const ActivityLabel = styled.label`
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
`;

const ActivityInput = styled.input`
  padding: 7px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.82rem;
  color: #1e293b;
  outline: none;
  transition: border-color 0.15s;
  &:focus { border-color: #818cf8; }
  &::placeholder { color: #94a3b8; }
`;

const ActivitySelect = styled.select`
  padding: 7px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.82rem;
  color: #1e293b;
  outline: none;
  cursor: pointer;
  &:focus { border-color: #818cf8; }
`;

// 검색 가능 부서 드롭다운
const DeptSearchWrapper = styled.div`
  position: relative;
`;

const DeptSearchInput = styled.input`
  width: 100%;
  padding: 7px 10px;
  border: 1px solid ${props => props.$hasValue ? '#818cf8' : '#d1d5db'};
  border-radius: 6px;
  font-size: 0.82rem;
  color: #1e293b;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s;
  &:focus { border-color: #818cf8; }
  &::placeholder { color: #94a3b8; }
`;

const DeptDropdown = styled.ul`
  position: absolute;
  top: calc(100% + 3px);
  left: 0; right: 0;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  max-height: 180px;
  overflow-y: auto;
  z-index: 20;
  margin: 0;
  padding: 4px;
  list-style: none;
`;

const DeptDropdownItem = styled.li`
  padding: 7px 10px;
  font-size: 0.82rem;
  color: #1e293b;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.1s;
  &:hover, &[data-active="true"] { background: #eef2ff; color: #4338ca; }
`;

const DeptDropdownHighlight = styled.span`
  font-weight: 700;
  color: #6366f1;
`;

const ActivityDateInput = styled.input.attrs({ type: 'date' })`
  padding: 6px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.82rem;
  color: #1e293b;
  outline: none;
  cursor: pointer;
  &:focus { border-color: #818cf8; }
`;

// 상태 + 날짜 한 행
const StatusDateRow = styled.div`
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 10px;
`;

// 텍스트 영역
const ActivityTextarea = styled.textarea`
  padding: 8px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.82rem;
  color: #1e293b;
  outline: none;
  resize: none;
  overflow: hidden;
  min-height: 40px;
  font-family: inherit;
  line-height: 1.5;
  transition: border-color 0.15s;
  &:focus { border-color: #818cf8; }
  &::placeholder { color: #94a3b8; }
`;

const FullWidthField = styled.div`
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

// 산출물 파일 영역
const FileSection = styled.div`
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const FileSectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const FileActions = styled.div`
  display: flex;
  gap: 4px;
`;

const FileUploadLabel = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 4px 10px;
  border: 1px solid #a5b4fc;
  background: #eef2ff;
  color: #4f46e5;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { background: #e0e7ff; }
  input { display: none; }
`;

const FileDownloadBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 4px 10px;
  border: 1px solid #86efac;
  background: #f0fdf4;
  color: #16a34a;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { background: #dcfce7; }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const FileList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
`;

const FileChip = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  font-size: 0.72rem;
  color: #334155;
`;

const FileRemoveBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border: none;
  background: rgba(0,0,0,0.08);
  color: #64748b;
  border-radius: 50%;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  &:hover { background: #fecaca; color: #ef4444; }
`;

// 기대효과 영역
const ExpectSection = styled.div`
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
  padding-top: 12px;
  border-top: 1.5px dashed #e2e8f0;
`;

const ExpectHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ExpectTitle = styled.span`
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
`;

const ExpectAddBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 4px 10px;
  border: 1px solid #a5b4fc;
  background: #eef2ff;
  color: #4f46e5;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { background: #e0e7ff; }
`;

const ExpectCard = styled.div`
  background: #fafbfc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const ExpectRow = styled.div`
  display: grid;
  grid-template-columns: ${props => props.$cols || '1fr 1fr'};
  gap: 6px;
  align-items: end;
`;

const ExpectMiniField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const ExpectMiniLabel = styled.label`
  font-size: 0.68rem;
  font-weight: 600;
  color: #94a3b8;
`;

const ExpectMiniInput = styled.input`
  padding: 5px 8px;
  border: 1px solid #d1d5db;
  border-radius: 5px;
  font-size: 0.78rem;
  color: #1e293b;
  outline: none;
  &:focus { border-color: #818cf8; }
  &::placeholder { color: #c0c7d0; }
`;

const ExpectMiniSelect = styled.select`
  padding: 5px 8px;
  border: 1px solid #d1d5db;
  border-radius: 5px;
  font-size: 0.78rem;
  color: #1e293b;
  outline: none;
  cursor: pointer;
  &:focus { border-color: #818cf8; }
`;

const ExpectCardHeader = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 8px;
`;

const ExpectCardTitle = styled.span`
  font-size: 0.75rem;
  font-weight: 600;
  color: #475569;
`;

const ExpectRemoveBtn = styled.button`
  width: 18px;
  height: 18px;
  border: none;
  background: transparent;
  color: #94a3b8;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  &:hover { background: #fef2f2; color: #ef4444; }
`;

// 담당자 인력 입력 영역
const PersonnelSection = styled.div`
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const PersonnelInputRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr auto;
  gap: 6px;
  align-items: end;
`;

const PersonnelMiniField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const PersonnelMiniLabel = styled.label`
  font-size: 0.7rem;
  font-weight: 600;
  color: #94a3b8;
`;

const PersonnelAddBtn = styled.button`
  padding: 7px 12px;
  border: 1px solid #a5b4fc;
  background: #eef2ff;
  color: #4f46e5;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 3px;
  transition: all 0.15s;
  &:hover:not(:disabled) { background: #e0e7ff; }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const PersonnelList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
`;

const PersonnelChip = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: ${props => props.$isPL ? '#eff6ff' : '#f8fafc'};
  border: 1px solid ${props => props.$isPL ? '#93c5fd' : '#e2e8f0'};
  border-radius: 14px;
  font-size: 0.72rem;
  color: #1e293b;
  line-height: 1.3;
`;

const ChipName = styled.span`
  font-weight: 600;
`;

const ChipDetail = styled.span`
  color: #64748b;
`;

const PLBadge = styled.span`
  font-size: 0.62rem;
  font-weight: 700;
  color: #2563eb;
  background: #dbeafe;
  padding: 1px 5px;
  border-radius: 8px;
  cursor: pointer;
  user-select: none;
`;

const PLToggle = styled.button`
  font-size: 0.6rem;
  font-weight: 600;
  color: #94a3b8;
  background: transparent;
  border: 1px dashed #cbd5e1;
  padding: 1px 5px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { color: #2563eb; border-color: #93c5fd; background: #eff6ff; }
`;

const ChipRemove = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border: none;
  background: rgba(0,0,0,0.08);
  color: #64748b;
  border-radius: 50%;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: all 0.15s;
  &:hover { background: #fecaca; color: #ef4444; }
`;

const NoActivityHint = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #94a3b8;
  font-size: 0.9rem;
  text-align: center;
  line-height: 1.6;
  padding: 40px;
`;

/* 기본 폼 요소들 */
const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Label = styled.label`
  font-size: 0.82rem;
  font-weight: 600;
  color: #374151;
  span.required {
    color: #ef4444;
    margin-left: 2px;
  }
`;

const Input = styled.input`
  padding: 8px 10px;
  border: 1.5px solid ${props => props.$hasError ? '#ef4444' : '#d1d5db'};
  border-radius: 8px;
  font-size: 0.85rem;
  color: #1f2937;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  &:focus {
    border-color: ${props => props.$hasError ? '#ef4444' : '#10b981'};
    box-shadow: 0 0 0 3px ${props => props.$hasError ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)'};
  }
  &::placeholder { color: #9ca3af; }
`;

const ErrorText = styled.span`
  font-size: 0.72rem;
  color: #ef4444;
`;

const ToggleGroup = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const ToggleButton = styled.button`
  padding: 5px 12px;
  border-radius: 16px;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  border: 1.5px solid ${props => props.$active ? props.$color || '#10b981' : '#d1d5db'};
  background: ${props => props.$active ? props.$color || '#10b981' : '#ffffff'};
  color: ${props => props.$active ? '#ffffff' : '#4b5563'};
  &:hover {
    border-color: ${props => props.$color || '#10b981'};
    ${props => !props.$active && `background: ${props.$color || '#10b981'}1a;`}
  }
`;

const CorpSelectRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const SelectWrapper = styled.div`
  position: relative;
  flex: 1;
`;

const Select = styled.select`
  width: 100%;
  padding: 8px 32px 8px 10px;
  border: 1.5px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.82rem;
  color: ${props => props.value ? '#1f2937' : '#9ca3af'};
  background: white;
  outline: none;
  cursor: pointer;
  appearance: none;
  transition: border-color 0.2s;
  &:focus { border-color: #10b981; }
  &:disabled { background: #f3f4f6; color: #9ca3af; cursor: not-allowed; }
`;

const SelectIcon = styled.div`
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: #6b7280;
`;

const TagList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
`;

const Tag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 9px;
  background: #ecfdf5;
  color: #065f46;
  border: 1px solid #a7f3d0;
  border-radius: 14px;
  font-size: 0.75rem;
  font-weight: 500;
`;

const TagRemove = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border: none;
  background: rgba(6, 95, 70, 0.15);
  color: #065f46;
  border-radius: 50%;
  cursor: pointer;
  padding: 0;
  transition: background 0.15s;
  &:hover { background: rgba(6, 95, 70, 0.3); }
`;

// 체크박스 드롭다운
const CheckDropdownWrapper = styled.div`
  position: relative;
`;

const CheckDropdownTrigger = styled.button`
  width: 100%;
  padding: 8px 32px 8px 10px;
  border: 1.5px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.82rem;
  color: ${props => props.$hasValue ? '#1f2937' : '#9ca3af'};
  background: white;
  text-align: left;
  cursor: pointer;
  appearance: none;
  outline: none;
  position: relative;
  transition: border-color 0.2s;
  &:focus { border-color: #10b981; }
`;

const CheckDropdownList = styled.ul`
  position: absolute;
  top: calc(100% + 3px);
  left: 0; right: 0;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  max-height: 220px;
  overflow-y: auto;
  z-index: 15;
  margin: 0;
  padding: 4px;
  list-style: none;
`;

const CheckDropdownItem = styled.li`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.82rem;
  color: #1e293b;
  transition: background 0.1s;
  &:hover { background: #f0fdf4; }
`;

const Checkbox = styled.input.attrs({ type: 'checkbox' })`
  width: 15px;
  height: 15px;
  accent-color: #10b981;
  cursor: pointer;
  flex-shrink: 0;
`;

const CheckDropdownSearch = styled.input`
  width: 100%;
  padding: 7px 10px;
  border: none;
  border-bottom: 1px solid #e2e8f0;
  font-size: 0.82rem;
  color: #1e293b;
  outline: none;
  box-sizing: border-box;
  &::placeholder { color: #94a3b8; }
`;

const EmptyHint = styled.span`
  font-size: 0.78rem;
  color: #9ca3af;
  font-style: italic;
`;

const AutocompleteWrapper = styled.div`
  position: relative;
`;

const AutocompleteInput = styled.input`
  width: 100%;
  padding: 8px 10px;
  border: 1.5px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.82rem;
  color: #1f2937;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s;
  &:focus { border-color: #10b981; }
  &::placeholder { color: #9ca3af; }
`;

const SuggestionList = styled.ul`
  position: absolute;
  top: calc(100% + 4px);
  left: 0; right: 0;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  max-height: 160px;
  overflow-y: auto;
  z-index: 10;
  margin: 0;
  padding: 4px;
  list-style: none;
`;

const SuggestionItem = styled.li`
  padding: 7px 10px;
  font-size: 0.82rem;
  color: #1e293b;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.1s;
  &:hover, &[data-active="true"] { background: #f0fdf4; color: #065f46; }
`;

const SuggestionHighlight = styled.span`
  font-weight: 700;
  color: #10b981;
`;

const ModalFooter = styled.div`
  padding: 14px 24px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-shrink: 0;
`;

const Button = styled.button`
  padding: 9px 18px;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
  border: none;
`;

const CancelButton = styled(Button)`
  background: #f3f4f6;
  color: #4b5563;
  border: 1px solid #d1d5db;
  &:hover { background: #e5e7eb; }
`;

const SubmitButton = styled(Button)`
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
  &:hover {
    background: linear-gradient(135deg, #059669, #047857);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  }
  &:disabled {
    background: #9ca3af;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;

// ===== 인스턴스 카드 =====
const InstanceList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const InstanceCard = styled.div`
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  transition: border-color 0.15s;
  &:hover { border-color: #a5b4fc; }
`;

const InstanceInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const InstanceName = styled.div`
  font-size: 0.82rem;
  font-weight: 700;
  color: #1e293b;
`;

const InstanceMeta = styled.div`
  font-size: 0.72rem;
  color: #64748b;
  margin-top: 2px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const InstanceMetaItem = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 2px;
`;

const InstanceStatusBadge = styled.span`
  display: inline-block;
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 0.68rem;
  font-weight: 600;
  background: ${props => props.$status === '완료' ? '#dcfce7' : props.$status === '진행' ? '#dbeafe' : '#f1f5f9'};
  color: ${props => props.$status === '완료' ? '#16a34a' : props.$status === '진행' ? '#2563eb' : '#64748b'};
  border: 1px solid ${props => props.$status === '완료' ? '#86efac' : props.$status === '진행' ? '#93c5fd' : '#e2e8f0'};
`;

const InstanceRemoveBtn = styled.button`
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  color: #94a3b8;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;
  &:hover { background: #fef2f2; color: #ef4444; }
`;

const AddActivityButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 10px;
  border: 1.5px dashed #a5b4fc;
  background: #fafbff;
  color: #4f46e5;
  border-radius: 10px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { background: #eef2ff; border-color: #818cf8; }
  &:disabled { opacity: 0.4; cursor: not-allowed; border-color: #d1d5db; color: #94a3b8; background: #f8fafc; }
`;

// ===== 인라인 편집 영역 =====
const ProgressDisplay = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const ProgressBarWrapper = styled.div`
  width: 100%;
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
`;

const ProgressBarFill = styled.div`
  height: 100%;
  background: ${props => props.$value >= 100 ? '#16a34a' : props.$value > 0 ? '#3b82f6' : '#e2e8f0'};
  border-radius: 4px;
  transition: width 0.3s;
`;

const ProgressText = styled.span`
  font-size: 0.82rem;
  font-weight: 700;
  color: ${props => props.$value >= 100 ? '#16a34a' : props.$value > 0 ? '#3b82f6' : '#94a3b8'};
`;

const InlineEditArea = styled.div`
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const InlineEditRow = styled.div`
  display: grid;
  grid-template-columns: ${props => props.$cols || '1fr 1fr'};
  gap: 10px;
  align-items: end;
`;

const StatusToggleGroup = styled.div`
  display: flex;
  gap: 0;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  overflow: hidden;
`;

const StatusToggleBtn = styled.button`
  flex: 1;
  padding: 6px 0;
  border: none;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  background: ${props => props.$active ? (
    props.$status === '완료' ? '#dcfce7' :
    props.$status === '진행' ? '#dbeafe' : '#f1f5f9'
  ) : '#fff'};
  color: ${props => props.$active ? (
    props.$status === '완료' ? '#16a34a' :
    props.$status === '진행' ? '#2563eb' : '#475569'
  ) : '#94a3b8'};
  &:not(:last-child) { border-right: 1px solid #d1d5db; }
  &:hover { background: ${props => props.$active ? undefined : '#f8fafc'}; }
`;

const InlineEditField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const InlineAddRow = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 8px;
`;

const InstanceExpandBtn = styled.button`
  width: 24px;
  height: 24px;
  border: none;
  background: #eef2ff;
  color: #4f46e5;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;
  &:hover { background: #e0e7ff; }
`;

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

const ConfirmModal = ({ open, title, message, variant, confirmLabel, onConfirm, onCancel }) => (
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
              {confirmLabel || (variant === 'danger' ? '삭제' : '확인')}
            </ConfirmBtn>
          </ConfirmActions>
        </ConfirmBox>
      </ConfirmOverlay>
    )}
  </AnimatePresence>
);

// ============== Navigation Styled Components ==============

const NavArrowButton = styled.button`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  border: 2px solid #e5e7eb;
  color: #374151;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 10;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);

  &:hover {
    background: white;
    border-color: #10b981;
    color: #10b981;
    transform: translateY(-50%) scale(1.1);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
  }

  &:active {
    transform: translateY(-50%) scale(0.95);
  }

  &.nav-left {
    left: 0.5rem;
  }

  &.nav-right {
    right: 0.5rem;
  }

  @media (max-width: 768px) {
    width: 36px;
    height: 36px;

    &.nav-left {
      left: 0.25rem;
    }

    &.nav-right {
      right: 0.25rem;
    }
  }
`;

const NavInfo = styled.span`
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
  margin-left: 0.75rem;
`;

// ============== Component ==============

const INITIAL_FORM = {
  식별번호: '',
  과제명: '',
  사업부: [],
  법인: [],
  '라인/제품': [],
  선택대분류: [],
};

const AddTaskModal = ({
  isOpen, onClose, onSubmit,
  corporations = [], solutions = [], lineProducts = [],
  activityCategories = [], activitySubcategories = [],
  editData = null,
  allTasks = [], onNavigate,
}) => {
  const isEditMode = !!editData;

  // 이전/다음 과제 네비게이션
  const currentIndex = isEditMode ? allTasks.findIndex(t => t.uuid === editData?.uuid) : -1;
  const prevTask = currentIndex > 0 ? allTasks[currentIndex - 1] : null;
  const nextTask = currentIndex >= 0 && currentIndex < allTasks.length - 1 ? allTasks[currentIndex + 1] : null;

  const handleNavigatePrev = () => {
    if (prevTask && onNavigate) onNavigate(prevTask);
  };

  const handleNavigateNext = () => {
    if (nextTask && onNavigate) onNavigate(nextTask);
  };

  const [formData, setFormData] = useState(INITIAL_FORM);
  const [isIdLocked, setIsIdLocked] = useState(true);
  const [autoIdValue, setAutoIdValue] = useState('');
  const [activities, setActivities] = useState({});
  const [categoryActivities, setCategoryActivities] = useState({});
  const [activeCategoryTab, setActiveCategoryTab] = useState('');
  const [expandedActivities, setExpandedActivities] = useState({});
  const [activeEditSubId, setActiveEditSubId] = useState('');
  const [personnelModalSubId, setPersonnelModalSubId] = useState('');
  const [errors, setErrors] = useState({});
  const [divisions, setDivisions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [perfCategories, setPerfCategories] = useState([]);
  const [perfSubcategories, setPerfSubcategories] = useState([]);
  const [deptSearchText, setDeptSearchText] = useState('');
  const [deptDropdownOpen, setDeptDropdownOpen] = useState(false);
  const [deptActiveIdx, setDeptActiveIdx] = useState(-1);
  const deptWrapperRef = useRef(null);
  const mouseDownInsideRef = useRef(false);

  const [corpDropdownOpen, setCorpDropdownOpen] = useState(false);
  const [corpSearch, setCorpSearch] = useState('');
  const corpDropdownRef = useRef(null);
  const corpSearchRef = useRef(null);
  const [lpInput, setLpInput] = useState('');
  const [lpSuggestionsOpen, setLpSuggestionsOpen] = useState(false);
  const [lpActiveIndex, setLpActiveIndex] = useState(-1);
  const lpWrapperRef = useRef(null);

  // 커스텀 confirm 모달 상태
  const [confirmState, setConfirmState] = useState({ open: false, title: '', message: '', variant: 'info', confirmLabel: '', onConfirm: null });
  const showConfirm = useCallback(({ title, message, variant = 'info', confirmLabel = '' }) => {
    return new Promise((resolve) => {
      setConfirmState({
        open: true, title, message, variant, confirmLabel,
        onConfirm: () => { setConfirmState(prev => ({ ...prev, open: false })); resolve(true); },
        onCancel: () => { setConfirmState(prev => ({ ...prev, open: false })); resolve(false); },
      });
    });
  }, []);

  // 대분류별 중분류 그룹핑
  const categoryGroups = useMemo(() => {
    const groups = {};
    activityCategories.forEach(cat => {
      groups[cat.id] = {
        ...cat,
        subcategories: activitySubcategories.filter(sub => sub.categoryId === cat.id),
      };
    });
    return groups;
  }, [activityCategories, activitySubcategories]);

  // activities: 추가된 인스턴스만 저장 (초기에는 빈 객체)
  const buildInitialActivities = useCallback(() => ({}), []);

  // categoryActivities 초기화: 모든 대분류에 대해 기본값 세팅
  const buildInitialCategoryActivities = useCallback(() => {
    const today = TODAY();
    const result = {};
    activityCategories.forEach(cat => {
      result[cat.id] = {
        categoryId: cat.id,
        categoryName: cat.name,
        시작일: today,
        목표일: '',
        완료일: '',
        산출물: [],
        기대효과: [],
      };
    });
    return result;
  }, [activityCategories]);

  useEffect(() => {
    if (!isOpen) return;
    const loadSettings = async () => {
      try {
        const dbSettings = await fetchSystemSettings();
        if (dbSettings?.divisions?.length > 0) setDivisions(dbSettings.divisions);
        else setDivisions(defaultSettingsData?.divisions || []);
        setDepartments(dbSettings?.departments || defaultSettingsData?.departments || []);
        setPerfCategories(dbSettings?.performanceCategories || defaultSettingsData?.performanceCategories || []);
        setPerfSubcategories(dbSettings?.performanceSubcategories || defaultSettingsData?.performanceSubcategories || []);
      } catch (e) {
        setDivisions(defaultSettingsData?.divisions || []);
        setDepartments(defaultSettingsData?.departments || []);
        setPerfCategories(defaultSettingsData?.performanceCategories || []);
        setPerfSubcategories(defaultSettingsData?.performanceSubcategories || []);
      }
    };
    loadSettings();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      if (editData) {
        // 편집 모드: 기존 데이터로 초기화
        const existingId = editData.식별번호 || (editData.식별ID ? editData.식별ID.replace(/^Sim-/, '') : '');
        setFormData({
          식별번호: existingId,
          과제명: editData.과제명 || '',
          사업부: editData.사업부 || [],
          법인: editData.법인 || [],
          '라인/제품': editData['라인/제품'] || [],
          선택대분류: (editData.대분류액티비티 || []).map(c => c.categoryId),
        });
        setAutoIdValue(existingId);
        setIsIdLocked(true);
        // 중분류 액티비티 복원 — 키를 subcategoryId로 맞춤 (추가 시와 동일한 키 구조)
        const restoredActivities = {};
        (editData.분석액티비티 || []).forEach(a => {
          const key = a.subcategoryId || a.id || `${a.categoryId}_${a.subcategoryId}`;
          restoredActivities[key] = { ...a };
        });
        setActivities({ ...buildInitialActivities(), ...restoredActivities });
        // 대분류 액티비티 복원
        const restoredCatActivities = {};
        (editData.대분류액티비티 || []).forEach(a => {
          restoredCatActivities[a.categoryId] = { ...a };
        });
        setCategoryActivities({ ...buildInitialCategoryActivities(), ...restoredCatActivities });
      } else {
        const nextNum = computeNextSimNumber(allTasks);
        setFormData({ ...INITIAL_FORM, 식별번호: nextNum });
        setAutoIdValue(nextNum);
        setIsIdLocked(true);
        setActivities(buildInitialActivities());
        setCategoryActivities(buildInitialCategoryActivities());
      }
      setErrors({});
      setCorpDropdownOpen(false);
      setLpInput('');
      setLpSuggestionsOpen(false);
      setLpActiveIndex(-1);
      // 편집 모드: 첫 번째 선택된 대분류 탭 자동 선택
      if (editData) {
        const catIds = (editData.대분류액티비티 || []).map(c => c.categoryId);
        setActiveCategoryTab(catIds.length > 0 ? catIds[0] : '');
      } else {
        setActiveCategoryTab('');
      }
      setExpandedActivities({});
      setActiveEditSubId('');
    }
  }, [isOpen, editData, allTasks, buildInitialActivities, buildInitialCategoryActivities, activityCategories, activitySubcategories]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (lpWrapperRef.current && !lpWrapperRef.current.contains(e.target)) {
        setLpSuggestionsOpen(false);
      }
      if (deptWrapperRef.current && !deptWrapperRef.current.contains(e.target)) {
        setDeptDropdownOpen(false);
      }
      if (corpDropdownRef.current && !corpDropdownRef.current.contains(e.target)) {
        setCorpDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 활성 편집 액티비티 변경 시 부서 입력 초기화
  useEffect(() => {
    if (activeEditSubId) {
      const act = activities[activeEditSubId];
      setDeptSearchText(act?.주관부서 || '');
      setDeptDropdownOpen(false);
      setDeptActiveIdx(-1);
    }
  }, [activeEditSubId]);

  // 선택된 대분류 목록 기반 필터링
  const selectedCategories = useMemo(() => {
    return activityCategories.filter(cat => formData.선택대분류.includes(cat.id));
  }, [activityCategories, formData.선택대분류]);

  // === 기본정보 핸들러 ===

  const handleToggleCategory = useCallback(async (catId) => {
    const isRemoving = formData.선택대분류.includes(catId);
    const catName = activityCategories.find(c => c.id === catId)?.name || catId;
    if (isRemoving) {
      const relatedSubs = activitySubcategories.filter(s => s.categoryId === catId);
      const hasData = relatedSubs.some(s => activities[s.id]);
      const confirmed = await showConfirm({
        title: '대분류 삭제',
        message: hasData
          ? `"${catName}" 대분류를 삭제하면\n입력된 중분류 데이터도 함께 삭제됩니다.`
          : `"${catName}" 대분류를 삭제하시겠습니까?`,
        variant: 'danger',
      });
      if (!confirmed) return;
    } else {
      const confirmed = await showConfirm({
        title: '대분류 추가',
        message: `"${catName}" 대분류를 추가하시겠습니까?`,
        variant: 'info',
      });
      if (!confirmed) return;
    }
    setFormData(prev => {
      const next = isRemoving
        ? prev.선택대분류.filter(id => id !== catId)
        : [...prev.선택대분류, catId];
      return { ...prev, 선택대분류: next };
    });
  }, [formData.선택대분류, activityCategories, activitySubcategories, activities, showConfirm]);

  const handleToggleDivision = useCallback((divName) => {
    setFormData(prev => {
      const next = prev.사업부.includes(divName)
        ? prev.사업부.filter(n => n !== divName)
        : [...prev.사업부, divName];
      return { ...prev, 사업부: next };
    });
    setErrors(prev => ({ ...prev, 사업부: '' }));
  }, []);

  const handleActivitySetSolution = useCallback((subId, solName) => {
    setActivities(prev => {
      const act = prev[subId] || {};
      return { ...prev, [subId]: { ...act, 활용솔루션: solName } };
    });
  }, []);

  // 라인/제품 자동완성
  const lpSuggestions = lineProducts
    .map(lp => lp.name)
    .filter(name => !formData['라인/제품'].includes(name))
    .filter(name => lpInput.trim() === '' || name.toLowerCase().includes(lpInput.trim().toLowerCase()));

  const addLpValue = useCallback((value) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setFormData(prev => {
      if (prev['라인/제품'].includes(trimmed)) return prev;
      return { ...prev, '라인/제품': [...prev['라인/제품'], trimmed] };
    });
    setLpInput('');
    setLpSuggestionsOpen(false);
    setLpActiveIndex(-1);
  }, []);

  const handleLpKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (lpActiveIndex >= 0 && lpActiveIndex < lpSuggestions.length) {
        addLpValue(lpSuggestions[lpActiveIndex]);
      } else { addLpValue(lpInput); }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setLpActiveIndex(prev => (prev < lpSuggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setLpActiveIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Escape') { setLpSuggestionsOpen(false); }
  }, [lpActiveIndex, lpSuggestions, lpInput, addLpValue]);

  const handleRemoveLp = useCallback((name) => {
    setFormData(prev => ({ ...prev, '라인/제품': prev['라인/제품'].filter(n => n !== name) }));
  }, []);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  }, [errors]);

  // === 인라인 액티비티 핸들러 ===

  const addActivityInline = useCallback(async (catId, subId) => {
    const sub = activitySubcategories.find(s => s.id === subId);
    if (!sub || activities[subId]) return;
    const confirmed = await showConfirm({
      title: '중분류 추가',
      message: `"${sub.name}" 중분류를 추가하시겠습니까?`,
      variant: 'info',
    });
    if (!confirmed) return;
    setActivities(prev => ({
      ...prev,
      [subId]: {
        subcategoryId: sub.id,
        subcategoryName: sub.name,
        categoryId: sub.categoryId,
        주관부서: '',
        담당자목록: [],
        상태: '계획',
        진행률: 0,
        완료일: '',
        상세내용: '',
        활용솔루션: '',
      },
    }));
    setExpandedActivities(prev => ({ ...prev, [subId]: true }));
    setActiveEditSubId(subId);
  }, [activitySubcategories, activities, showConfirm]);

  const handleRemoveActivity = useCallback(async (subId) => {
    const act = activities[subId];
    const subName = act?.subcategoryName || subId;
    const confirmed = await showConfirm({
      title: '중분류 삭제',
      message: `"${subName}" 중분류를 삭제하시겠습니까?\n입력된 데이터가 모두 삭제됩니다.`,
      variant: 'danger',
    });
    if (!confirmed) return;
    setActivities(prev => {
      const next = { ...prev };
      delete next[subId];
      return next;
    });
    setExpandedActivities(prev => {
      const next = { ...prev };
      delete next[subId];
      return next;
    });
    if (activeEditSubId === subId) setActiveEditSubId('');
  }, [activeEditSubId, activities, showConfirm]);

  const toggleExpandActivity = useCallback((subId) => {
    setExpandedActivities(prev => ({ ...prev, [subId]: !prev[subId] }));
    setActiveEditSubId(subId);
  }, []);

  const handleActivityChange = useCallback((subId, field, value) => {
    setActivities(prev => ({
      ...prev,
      [subId]: { ...prev[subId], [field]: value },
    }));
  }, []);

  // === 부서 검색 드롭다운 ===

  const deptFiltered = useMemo(() => {
    const q = deptSearchText.trim().toLowerCase();
    if (!q) return departments;
    return departments.filter(d => d.name.toLowerCase().includes(q));
  }, [departments, deptSearchText]);

  const selectDept = useCallback((subId, deptName) => {
    handleActivityChange(subId, '주관부서', deptName);
    setDeptSearchText(deptName);
    setDeptDropdownOpen(false);
    setDeptActiveIdx(-1);
  }, [handleActivityChange]);

  const handleDeptKeyDown = useCallback((e, subId) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (deptActiveIdx >= 0 && deptActiveIdx < deptFiltered.length) {
        selectDept(subId, deptFiltered[deptActiveIdx].name);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setDeptActiveIdx(prev => (prev < deptFiltered.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setDeptActiveIdx(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Escape') {
      setDeptDropdownOpen(false);
    }
  }, [deptActiveIdx, deptFiltered, selectDept]);

  // === 담당자 인력 관리 ===

  // 담당자 모달에서 일괄 추가
  const handlePersonnelConfirm = useCallback((entries) => {
    if (!personnelModalSubId || entries.length === 0) return;
    setActivities(prev => {
      const act = prev[personnelModalSubId] || {};
      return { ...prev, [personnelModalSubId]: { ...act, 담당자목록: [...(act.담당자목록 || []), ...entries] } };
    });
  }, [personnelModalSubId]);

  const togglePL = useCallback((subId, index) => {
    setActivities(prev => {
      const act = prev[subId] || {};
      const list = (act.담당자목록 || []).map((p, i) => ({
        ...p,
        isPL: i === index ? !p.isPL : false,
      }));
      return { ...prev, [subId]: { ...act, 담당자목록: list } };
    });
  }, []);

  const removePersonnel = useCallback((subId, index) => {
    setActivities(prev => {
      const act = prev[subId] || {};
      const list = (act.담당자목록 || []).filter((_, i) => i !== index);
      return { ...prev, [subId]: { ...act, 담당자목록: list } };
    });
  }, []);

  // === 대분류 활동 핸들러 ===

  const handleCategoryActivityChange = useCallback((catId, field, value) => {
    setCategoryActivities(prev => ({
      ...prev,
      [catId]: { ...prev[catId], [field]: value },
    }));
  }, []);

  // === 기대효과 관리 (대분류 기반) ===

  const addExpectedEffect = useCallback((catId) => {
    const entry = {
      id: `eff_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      기대효과명: '',
      대분류: '',
      소분류: '',
      단위: '',
      현재: '',
      목표: '',
      실적: '',
      상세설명: '',
    };
    setCategoryActivities(prev => {
      const act = prev[catId] || {};
      return { ...prev, [catId]: { ...act, 기대효과: [...(act.기대효과 || []), entry] } };
    });
  }, []);

  const updateExpectedEffect = useCallback((catId, effId, field, value) => {
    setCategoryActivities(prev => {
      const act = prev[catId] || {};
      const list = (act.기대효과 || []).map(e => {
        if (e.id !== effId) return e;
        const updated = { ...e, [field]: value };
        if (field === '소분류') {
          const subcat = perfSubcategories.find(s => s.name === value);
          if (subcat) updated.단위 = subcat.unit || '';
        }
        if (field === '대분류') {
          updated.소분류 = '';
          updated.단위 = '';
        }
        return updated;
      });
      return { ...prev, [catId]: { ...act, 기대효과: list } };
    });
  }, [perfSubcategories]);

  const removeExpectedEffect = useCallback((catId, effId) => {
    setCategoryActivities(prev => {
      const act = prev[catId] || {};
      return { ...prev, [catId]: { ...act, 기대효과: (act.기대효과 || []).filter(e => e.id !== effId) } };
    });
  }, []);

  // 대분류에 속한 소분류 필터
  const getSubcatsForCategory = useCallback((categoryName) => {
    const cat = perfCategories.find(c => c.name === categoryName);
    if (!cat) return [];
    return perfSubcategories.filter(s => s.categoryId === cat.id);
  }, [perfCategories, perfSubcategories]);

  // === 산출물 파일 관리 (대분류 기반) ===

  const handleFileSelect = useCallback((catId, e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setCategoryActivities(prev => {
      const act = prev[catId] || {};
      const existing = act.산출물 || [];
      return { ...prev, [catId]: { ...act, 산출물: [...existing, ...files] } };
    });
    e.target.value = '';
  }, []);

  const removeFile = useCallback((catId, index) => {
    setCategoryActivities(prev => {
      const act = prev[catId] || {};
      const list = (act.산출물 || []).filter((_, i) => i !== index);
      return { ...prev, [catId]: { ...act, 산출물: list } };
    });
  }, []);

  const downloadFilesAsZip = useCallback(async (files, zipName) => {
    if (!files || files.length === 0) return;
    const zip = new JSZip();
    for (const file of files) {
      zip.file(file.name, file);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${zipName}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  // === 제출 ===

  const validate = () => {
    const newErrors = {};
    if (!formData.과제명.trim()) newErrors.과제명 = '과제명을 입력해주세요.';
    if (formData.사업부.length === 0) newErrors.사업부 = '사업부를 하나 이상 선택해주세요.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const selectedCatIds = formData.선택대분류;
    const filteredActivities = Object.values(activities).filter(a => selectedCatIds.includes(a.categoryId));
    const filteredCatActivities = Object.values(categoryActivities).filter(a => selectedCatIds.includes(a.categoryId));
    // 식별ID 포맷팅: 숫자가 입력된 경우 "Sim-001" 형태로
    const 식별ID = formData.식별번호
      ? `Sim-${formData.식별번호.padStart(3, '0')}`
      : '';
    onSubmit?.({
      ...formData,
      식별ID,
      분석액티비티: filteredActivities,
      대분류액티비티: filteredCatActivities,
    });
    onClose();
  };

  const handleUnlockId = useCallback(async () => {
    const confirmed = await showConfirm({
      title: '식별 ID 수동 수정',
      message: '식별 ID는 자동으로 채번됩니다.\n수동 변경 시 다른 과제와 중복되거나\n채번 규칙에서 벗어날 수 있습니다.\n\n계속 진행하시겠습니까?',
      variant: 'danger',
      confirmLabel: '수정',
    });
    if (confirmed) setIsIdLocked(false);
  }, [showConfirm]);

  const handleRestoreAutoId = useCallback(() => {
    setFormData(prev => ({ ...prev, 식별번호: autoIdValue }));
    setIsIdLocked(true);
  }, [autoIdValue]);

  const handleCloseWithConfirm = useCallback(async () => {
    const hasData = formData.과제명.trim() || formData.사업부.length > 0 || Object.keys(activities).length > 0;
    if (hasData) {
      const confirmed = await showConfirm({
        title: '창 닫기',
        message: '입력한 내용이 있습니다.\n닫으시겠습니까?',
        variant: 'danger',
        confirmLabel: '닫기',
      });
      if (!confirmed) return;
    }
    onClose();
  }, [formData, activities, onClose, showConfirm]);

  // 선택된 대분류가 변경되면 탭 자동 보정
  useEffect(() => {
    if (selectedCategories.length === 0) {
      setActiveCategoryTab('');
      return;
    }
    if (!formData.선택대분류.includes(activeCategoryTab)) {
      setActiveCategoryTab(selectedCategories[0].id);
    }
  }, [formData.선택대분류, selectedCategories, activeCategoryTab]);

  const availableCorps = corporations.filter(c => !formData.법인.includes(c.name));
  const currentGroup = categoryGroups[activeCategoryTab];

  // 과제 전체 날짜 자동 계산 (선택된 대분류 기준)
  const taskDates = useMemo(() => {
    const selectedCatIds = formData.선택대분류;
    if (selectedCatIds.length === 0) return { 시작일: '', 종료계획일: '', 완료일: '' };

    let minStart = null;
    let maxTarget = null;
    let maxComplete = null;
    let allHaveComplete = true;

    selectedCatIds.forEach(catId => {
      const catAct = categoryActivities[catId];
      if (!catAct) { allHaveComplete = false; return; }

      if (catAct.시작일) {
        if (!minStart || catAct.시작일 < minStart) minStart = catAct.시작일;
      }
      if (catAct.목표일) {
        if (!maxTarget || catAct.목표일 > maxTarget) maxTarget = catAct.목표일;
      }
      if (catAct.완료일) {
        if (!maxComplete || catAct.완료일 > maxComplete) maxComplete = catAct.완료일;
      } else {
        allHaveComplete = false;
      }
    });

    // 과제 상태 자동 계산
    let totalProgress = 0, progressCatCount = 0;
    selectedCatIds.forEach(catId => {
      const group = categoryGroups[catId];
      if (!group) return;
      const subs = group.subcategories || [];
      const addedSubs = subs.filter(s => activities[s.id]);
      if (addedSubs.length === 0) return;
      const catProg = Math.round(addedSubs.reduce((sum, s) => {
        const a = activities[s.id];
        if (a.상태 === '완료') return sum + 100;
        if (a.상태 === '진행') return sum + (a.진행률 ?? 0);
        return sum;
      }, 0) / addedSubs.length);
      totalProgress += catProg;
      progressCatCount++;
    });
    const avgProgress = progressCatCount > 0 ? Math.round(totalProgress / progressCatCount) : 0;
    let 상태 = '계획';
    if (avgProgress >= 100) {
      상태 = '완료';
    } else {
      // 지연 판단: 대분류 중 하나라도 목표일 초과 + 미완료
      const today = todayLocalYmd();
      const isOverdue = selectedCatIds.some(catId => {
        const catAct = categoryActivities[catId];
        if (!catAct) return false;
        const group = categoryGroups[catId];
        if (!group) return false;
        const subs = (group.subcategories || []).filter(s => activities[s.id]);
        if (subs.length === 0) return false;
        const catProg = Math.round(subs.reduce((sum, s) => {
          const a = activities[s.id];
          if (a.상태 === '완료') return sum + 100;
          if (a.상태 === '진행') return sum + (a.진행률 ?? 0);
          return sum;
        }, 0) / subs.length);
        return catProg < 100 && !catAct.완료일 && catAct.목표일 && today > catAct.목표일;
      });
      if (isOverdue) 상태 = '지연';
      else if (avgProgress > 0) 상태 = '진행';
    }

    return {
      시작일: minStart || '',
      종료계획일: maxTarget || '',
      완료일: allHaveComplete ? (maxComplete || '') : '',
      상태,
      진행률: avgProgress,
    };
  }, [formData.선택대분류, categoryActivities, categoryGroups, activities]);

  return (
    <>
    <AnimatePresence>
      {isOpen && (
        <Overlay
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onMouseDown={() => { mouseDownInsideRef.current = false; }}
          onClick={() => {
            if (mouseDownInsideRef.current) { mouseDownInsideRef.current = false; return; }
            handleCloseWithConfirm();
          }}
          onKeyDown={(e) => { if (e.key === 'Escape') handleCloseWithConfirm(); }}
        >
          {isEditMode && prevTask && (
            <NavArrowButton
              className="nav-left"
              onClick={(e) => { e.stopPropagation(); handleNavigatePrev(); }}
              title="이전 과제"
            >
              <ChevronLeft size={24} />
            </NavArrowButton>
          )}
          {isEditMode && nextTask && (
            <NavArrowButton
              className="nav-right"
              onClick={(e) => { e.stopPropagation(); handleNavigateNext(); }}
              title="다음 과제"
            >
              <ChevronRight size={24} />
            </NavArrowButton>
          )}
          <ModalContainer
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onMouseDown={() => { mouseDownInsideRef.current = true; }}
            onClick={(e) => e.stopPropagation()}
          >
            <ModalHeader>
              <HeaderTitle>
                <Plus size={20} /> {isEditMode ? '과제 수정' : '새 과제 추가'}
                {isEditMode && currentIndex >= 0 && <NavInfo>{currentIndex + 1} / {allTasks.length}</NavInfo>}
              </HeaderTitle>
              <CloseButton onClick={handleCloseWithConfirm}><X size={18} /></CloseButton>
            </ModalHeader>

            <BodyWrapper>
              {/* ===== 좌측: 기본정보 ===== */}
              <LeftPanel>
                <LeftPanelTitle>과제 기본정보</LeftPanelTitle>

                <FormGroup>
                  <Label>식별 ID</Label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                      <span style={{
                        padding: '7px 10px',
                        background: '#f1f5f9',
                        border: '1px solid #e2e8f0',
                        borderRight: 'none',
                        borderRadius: '8px 0 0 8px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: '#475569',
                        whiteSpace: 'nowrap'
                      }}>Sim-</span>
                      <Input
                        name="식별번호"
                        value={formData.식별번호}
                        disabled={isIdLocked}
                        onChange={(e) => {
                          if (isIdLocked) return;
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          setFormData(prev => ({ ...prev, 식별번호: val }));
                        }}
                        placeholder="001"
                        style={{
                          borderRadius: '0 8px 8px 0',
                          width: '100px',
                          background: isIdLocked ? '#f8fafc' : '#ffffff',
                          color: isIdLocked ? '#475569' : '#1f2937',
                          cursor: isIdLocked ? 'not-allowed' : 'text',
                        }}
                      />
                    </div>
                    {isIdLocked ? (
                      <button
                        type="button"
                        onClick={handleUnlockId}
                        title="수동 수정 (경고)"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '6px 10px',
                          border: '1px solid #e2e8f0',
                          background: '#ffffff',
                          color: '#475569',
                          borderRadius: '8px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        <Pencil size={12} /> 수정
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleRestoreAutoId}
                        title="자동 채번 값으로 복원"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '6px 10px',
                          border: '1px solid #fde68a',
                          background: '#fffbeb',
                          color: '#b45309',
                          borderRadius: '8px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        <RotateCcw size={12} /> 복원
                      </button>
                    )}
                    {isIdLocked ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontSize: '0.72rem',
                        color: '#6366f1',
                        background: '#eef2ff',
                        border: '1px solid #c7d2fe',
                        padding: '3px 8px',
                        borderRadius: '10px',
                        fontWeight: 600,
                      }}>
                        <Lock size={10} /> 자동 채번
                      </span>
                    ) : (
                      <span style={{
                        fontSize: '0.72rem',
                        color: '#b45309',
                        background: '#fef3c7',
                        border: '1px solid #fde68a',
                        padding: '3px 8px',
                        borderRadius: '10px',
                        fontWeight: 600,
                      }}>
                        수동 수정 중
                      </span>
                    )}
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: 'auto' }}>
                      {formData.식별번호 ? `→ Sim-${formData.식별번호.padStart(3, '0')}` : ''}
                    </span>
                  </div>
                </FormGroup>

                <FormGroup>
                  <Label>과제명 <span className="required">*</span></Label>
                  <Input name="과제명" value={formData.과제명} onChange={handleChange}
                    placeholder="과제명을 입력하세요" $hasError={!!errors.과제명} autoFocus />
                  {errors.과제명 && <ErrorText>{errors.과제명}</ErrorText>}
                </FormGroup>

                <FormGroup>
                  <Label>사업부 <span className="required">*</span></Label>
                  <ToggleGroup>
                    {divisions.map(div => (
                      <ToggleButton key={div.id} type="button"
                        $active={formData.사업부.includes(div.name)} $color={div.color}
                        onClick={() => handleToggleDivision(div.name)}>{div.name}</ToggleButton>
                    ))}
                  </ToggleGroup>
                  {errors.사업부 && <ErrorText>{errors.사업부}</ErrorText>}
                </FormGroup>

                <FormGroup>
                  <Label>법인</Label>
                  {corporations.length === 0 ? (
                    <EmptyHint>설정에서 법인을 등록하세요.</EmptyHint>
                  ) : (
                    <CheckDropdownWrapper ref={corpDropdownRef}>
                      <CheckDropdownTrigger type="button"
                        $hasValue={formData.법인.length > 0}
                        onClick={() => {
                          setCorpDropdownOpen(prev => !prev);
                          setCorpSearch('');
                          setTimeout(() => corpSearchRef.current?.focus(), 0);
                        }}>
                        {formData.법인.length > 0
                          ? `${formData.법인.join(', ')} (${formData.법인.length})`
                          : '법인을 선택하세요'}
                        <SelectIcon><ChevronDown size={14} /></SelectIcon>
                      </CheckDropdownTrigger>
                      {corpDropdownOpen && (() => {
                        const q = corpSearch.trim().toLowerCase();
                        const filtered = q ? corporations.filter(c => c.name.toLowerCase().includes(q)) : corporations;
                        return (
                          <CheckDropdownList>
                            <CheckDropdownSearch
                              ref={corpSearchRef}
                              value={corpSearch}
                              onChange={(e) => setCorpSearch(e.target.value)}
                              placeholder="법인 검색..."
                              onClick={(e) => e.stopPropagation()}
                            />
                            {!q && (
                              <CheckDropdownItem
                                onClick={() => {
                                  const allNames = corporations.map(c => c.name);
                                  setFormData(prev => {
                                    const allSelected = allNames.every(n => prev.법인.includes(n));
                                    return { ...prev, 법인: allSelected ? [] : allNames };
                                  });
                                }}
                                style={{ fontWeight: 600 }}>
                                <Checkbox checked={corporations.length > 0 && corporations.every(c => formData.법인.includes(c.name))} readOnly />
                                전 법인
                              </CheckDropdownItem>
                            )}
                            {filtered.map(c => (
                              <CheckDropdownItem key={c.id}
                                onClick={() => {
                                  setFormData(prev => prev.법인.includes(c.name)
                                    ? { ...prev, 법인: prev.법인.filter(n => n !== c.name) }
                                    : { ...prev, 법인: [...prev.법인, c.name] });
                                }}>
                                <Checkbox checked={formData.법인.includes(c.name)} readOnly />
                                {c.name}
                              </CheckDropdownItem>
                            ))}
                            {filtered.length === 0 && (
                              <CheckDropdownItem style={{ color: '#94a3b8', cursor: 'default' }}>
                                검색 결과가 없습니다.
                              </CheckDropdownItem>
                            )}
                          </CheckDropdownList>
                        );
                      })()}
                    </CheckDropdownWrapper>
                  )}
                  {formData.법인.length > 0 && (
                    <TagList>
                      {formData.법인.map(name => (
                        <Tag key={name}>{name}
                          <TagRemove onClick={() => setFormData(prev => ({ ...prev, 법인: prev.법인.filter(n => n !== name) }))}><X size={9} /></TagRemove>
                        </Tag>
                      ))}
                    </TagList>
                  )}
                </FormGroup>

                <FormGroup>
                  <Label>라인/제품</Label>
                  <AutocompleteWrapper ref={lpWrapperRef}>
                    <AutocompleteInput value={lpInput}
                      onChange={(e) => { setLpInput(e.target.value); setLpSuggestionsOpen(true); setLpActiveIndex(-1); }}
                      onFocus={() => setLpSuggestionsOpen(true)}
                      onKeyDown={handleLpKeyDown}
                      placeholder="라인/제품 입력 (Enter로 추가)" />
                    {lpSuggestionsOpen && lpInput.trim() && lpSuggestions.length > 0 && (
                      <SuggestionList>
                        {lpSuggestions.map((name, idx) => {
                          const mi = name.toLowerCase().indexOf(lpInput.trim().toLowerCase());
                          return (
                            <SuggestionItem key={name} data-active={idx === lpActiveIndex ? 'true' : undefined}
                              onMouseDown={() => addLpValue(name)} onMouseEnter={() => setLpActiveIndex(idx)}>
                              {mi >= 0 ? <>{name.slice(0, mi)}<SuggestionHighlight>{name.slice(mi, mi + lpInput.trim().length)}</SuggestionHighlight>{name.slice(mi + lpInput.trim().length)}</> : name}
                            </SuggestionItem>
                          );
                        })}
                      </SuggestionList>
                    )}
                  </AutocompleteWrapper>
                  {formData['라인/제품'].length > 0 && (
                    <TagList>
                      {formData['라인/제품'].map(name => (
                        <Tag key={name}>{name}
                          <TagRemove onClick={() => handleRemoveLp(name)}><X size={9} /></TagRemove>
                        </Tag>
                      ))}
                    </TagList>
                  )}
                </FormGroup>

                <FormGroup>
                  <Label>액티비티 대분류</Label>
                  {activityCategories.length === 0 ? (
                    <EmptyHint>설정에서 대분류를 등록하세요.</EmptyHint>
                  ) : (
                    <ToggleGroup>
                      {activityCategories.map(cat => (
                        <ToggleButton key={cat.id} type="button"
                          $active={formData.선택대분류.includes(cat.id)} $color="#10b981"
                          onClick={() => handleToggleCategory(cat.id)}>{cat.name}</ToggleButton>
                      ))}
                    </ToggleGroup>
                  )}
                </FormGroup>

                <FormGroup>
                  <Label>과제 상태 / 일정</Label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b' }}>상태</span>
                      <div style={{
                        padding: '7px 10px',
                        background: taskDates.상태 === '완료' ? '#dcfce7' : taskDates.상태 === '진행' ? '#dbeafe' : taskDates.상태 === '지연' ? '#fef2f2' : '#f1f5f9',
                        border: `1.5px solid ${taskDates.상태 === '완료' ? '#86efac' : taskDates.상태 === '진행' ? '#93c5fd' : taskDates.상태 === '지연' ? '#fca5a5' : '#d1d5db'}`,
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        textAlign: 'center',
                        color: taskDates.상태 === '완료' ? '#16a34a' : taskDates.상태 === '진행' ? '#2563eb' : taskDates.상태 === '지연' ? '#ef4444' : '#64748b',
                      }}>
                        {taskDates.상태}{(taskDates.상태 === '진행' || taskDates.상태 === '지연') && ` ${taskDates.진행률}%`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b' }}>시작일</span>
                      <Input
                        value={taskDates.시작일 || ''}
                        readOnly
                        placeholder="-"
                        style={{ background: '#f8fafc', cursor: 'default', fontSize: '0.82rem', textAlign: 'center' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b' }}>종료 계획일</span>
                      <Input
                        value={taskDates.종료계획일 || ''}
                        readOnly
                        placeholder="-"
                        style={{ background: '#f8fafc', cursor: 'default', fontSize: '0.82rem', textAlign: 'center' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b' }}>완료일</span>
                      <Input
                        value={taskDates.완료일 || ''}
                        readOnly
                        placeholder="-"
                        style={{ background: '#f8fafc', cursor: 'default', fontSize: '0.82rem', textAlign: 'center' }}
                      />
                    </div>
                  </div>
                  {formData.선택대분류.length === 0 && (
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic' }}>
                      대분류를 선택하면 자동으로 계산됩니다.
                    </span>
                  )}
                  {formData.선택대분류.length > 0 && !taskDates.완료일 && (
                    <span style={{ fontSize: '0.72rem', color: '#f59e0b' }}>
                      모든 대분류의 완료일이 입력되면 과제 완료일이 표시됩니다.
                    </span>
                  )}
                </FormGroup>
              </LeftPanel>

              {/* ===== 우측: 분석 액티비티 ===== */}
              <RightPanel>
                <RightPanelHeader>
                  <RightPanelTitle>분석 액티비티</RightPanelTitle>
                </RightPanelHeader>

                {selectedCategories.length === 0 ? (
                  <NoActivityHint>
                    좌측에서 액티비티 대분류를 선택하면<br />여기에서 각 항목의 상세 정보를 입력할 수 있습니다.
                  </NoActivityHint>
                ) : (
                  <>
                    {/* 대분류 탭 (선택된 것만) */}
                    <CategoryTabs>
                      {selectedCategories.map(cat => (
                        <CategoryTab key={cat.id}
                          $active={activeCategoryTab === cat.id}
                          onClick={() => setActiveCategoryTab(cat.id)}>
                          {cat.name}
                        </CategoryTab>
                      ))}
                    </CategoryTabs>

                    <RightPanelScroll>
                    {/* 대분류 속성 (시작일, 목표일, 산출물, 기대효과) */}
                    {(() => {
                      const catAct = categoryActivities[activeCategoryTab] || {};
                      const catObj = activityCategories.find(c => c.id === activeCategoryTab);
                      if (!catObj) return null;
                      // 진행률 계산 (각 액티비티의 진행률 평균)
                      const catSubs = (categoryGroups[activeCategoryTab]?.subcategories || []);
                      const catActivitiesList = catSubs.filter(sub => activities[sub.id]);
                      const totalCount = catActivitiesList.length;
                      const progressValue = totalCount > 0 ? Math.round(
                        catActivitiesList.reduce((sum, sub) => {
                          const a = activities[sub.id];
                          if (a.상태 === '완료') return sum + 100;
                          if (a.상태 === '진행') return sum + (a.진행률 ?? 0);
                          return sum;
                        }, 0) / totalCount
                      ) : 0;
                      return (
                        <ActivityContent>
                          <ActivityGrid>
                            <StatusDateRow>
                              <ActivityField>
                                <ActivityLabel>시작일</ActivityLabel>
                                <ActivityDateInput value={catAct.시작일 || ''}
                                  onChange={(e) => handleCategoryActivityChange(catObj.id, '시작일', e.target.value)} />
                              </ActivityField>
                              <ActivityField>
                                <ActivityLabel>종료 계획일</ActivityLabel>
                                <ActivityDateInput value={catAct.목표일 || ''}
                                  onChange={(e) => handleCategoryActivityChange(catObj.id, '목표일', e.target.value)} />
                              </ActivityField>
                              <ActivityField>
                                <ActivityLabel>완료일</ActivityLabel>
                                <ActivityDateInput value={catAct.완료일 || ''}
                                  onChange={(e) => handleCategoryActivityChange(catObj.id, '완료일', e.target.value)} />
                              </ActivityField>
                              <ActivityField>
                                <ActivityLabel>진행률</ActivityLabel>
                                <ProgressDisplay>
                                  <ProgressText $value={progressValue}>{progressValue}%</ProgressText>
                                  <ProgressBarWrapper>
                                    <ProgressBarFill style={{ width: `${progressValue}%` }} $value={progressValue} />
                                  </ProgressBarWrapper>
                                </ProgressDisplay>
                              </ActivityField>
                            </StatusDateRow>

                            <FileSection>
                              <FileSectionHeader>
                                <ActivityLabel>산출물</ActivityLabel>
                                <FileActions>
                                  <FileUploadLabel>
                                    <Plus size={11} /> 파일 추가
                                    <input type="file" multiple onChange={(e) => handleFileSelect(catObj.id, e)} />
                                  </FileUploadLabel>
                                  {(catAct.산출물 || []).length > 0 && (
                                    <FileDownloadBtn type="button"
                                      onClick={() => downloadFilesAsZip(catAct.산출물, `${catObj.name}_산출물`)}>
                                      <Download size={11} /> ZIP 다운로드
                                    </FileDownloadBtn>
                                  )}
                                </FileActions>
                              </FileSectionHeader>
                              {(catAct.산출물 || []).length > 0 ? (
                                <FileList>
                                  {catAct.산출물.map((file, idx) => (
                                    <FileChip key={idx}>
                                      <FileText size={11} />
                                      {file.name}
                                      <FileRemoveBtn onClick={() => removeFile(catObj.id, idx)} title="삭제">
                                        <X size={8} />
                                      </FileRemoveBtn>
                                    </FileChip>
                                  ))}
                                </FileList>
                              ) : (
                                <EmptyHint>첨부된 파일이 없습니다.</EmptyHint>
                              )}
                            </FileSection>

                            <ExpectSection>
                              <ExpectHeader>
                                <ExpectTitle>기대 효과</ExpectTitle>
                                <ExpectAddBtn type="button" onClick={() => addExpectedEffect(catObj.id)}>
                                  <Plus size={11} /> 성과 추가
                                </ExpectAddBtn>
                              </ExpectHeader>

                              {(catAct.기대효과 || []).length === 0 ? (
                                <EmptyHint>등록된 기대 효과가 없습니다.</EmptyHint>
                              ) : (
                                (catAct.기대효과 || []).map((eff) => {
                                  const availSubcats = getSubcatsForCategory(eff.대분류);
                                  return (
                                    <ExpectCard key={eff.id}>
                                      <ExpectCardHeader>
                                        <ExpectMiniField style={{ flex: 1 }}>
                                          <ExpectMiniLabel>기대효과명</ExpectMiniLabel>
                                          <ExpectMiniInput value={eff.기대효과명 || ''} placeholder="기대효과명을 입력하세요"
                                            onChange={(e) => updateExpectedEffect(catObj.id, eff.id, '기대효과명', e.target.value)} />
                                        </ExpectMiniField>
                                        <ExpectRemoveBtn onClick={() => removeExpectedEffect(catObj.id, eff.id)} title="삭제"
                                          style={{ alignSelf: 'end', marginBottom: '2px' }}>
                                          <X size={10} />
                                        </ExpectRemoveBtn>
                                      </ExpectCardHeader>
                                      <ExpectRow $cols="2fr 2fr 60px 80px 80px 80px">
                                        <ExpectMiniField>
                                          <ExpectMiniLabel>대분류</ExpectMiniLabel>
                                          <ExpectMiniSelect value={eff.대분류}
                                            onChange={(e) => updateExpectedEffect(catObj.id, eff.id, '대분류', e.target.value)}>
                                            <option value="">선택</option>
                                            {perfCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                          </ExpectMiniSelect>
                                        </ExpectMiniField>
                                        <ExpectMiniField>
                                          <ExpectMiniLabel>소분류</ExpectMiniLabel>
                                          <ExpectMiniSelect value={eff.소분류}
                                            onChange={(e) => updateExpectedEffect(catObj.id, eff.id, '소분류', e.target.value)}
                                            disabled={!eff.대분류}>
                                            <option value="">선택</option>
                                            {availSubcats.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                          </ExpectMiniSelect>
                                        </ExpectMiniField>
                                        <ExpectMiniField>
                                          <ExpectMiniLabel>단위</ExpectMiniLabel>
                                          <ExpectMiniInput value={eff.단위} readOnly placeholder="-"
                                            style={{ background: '#f1f5f9', cursor: 'default' }} />
                                        </ExpectMiniField>
                                        <ExpectMiniField>
                                          <ExpectMiniLabel>현재</ExpectMiniLabel>
                                          <ExpectMiniInput value={eff.현재} placeholder="0"
                                            onChange={(e) => updateExpectedEffect(catObj.id, eff.id, '현재', e.target.value)} />
                                        </ExpectMiniField>
                                        <ExpectMiniField>
                                          <ExpectMiniLabel>목표</ExpectMiniLabel>
                                          <ExpectMiniInput value={eff.목표} placeholder="0"
                                            onChange={(e) => updateExpectedEffect(catObj.id, eff.id, '목표', e.target.value)} />
                                        </ExpectMiniField>
                                        <ExpectMiniField>
                                          <ExpectMiniLabel>실적</ExpectMiniLabel>
                                          <ExpectMiniInput value={eff.실적} placeholder="0"
                                            onChange={(e) => updateExpectedEffect(catObj.id, eff.id, '실적', e.target.value)} />
                                        </ExpectMiniField>
                                      </ExpectRow>
                                      <ExpectMiniField>
                                        <ExpectMiniLabel>상세설명</ExpectMiniLabel>
                                        <ExpectMiniInput value={eff.상세설명} placeholder="상세설명 입력"
                                          onChange={(e) => updateExpectedEffect(catObj.id, eff.id, '상세설명', e.target.value)} />
                                      </ExpectMiniField>
                                    </ExpectCard>
                                  );
                                })
                              )}
                            </ExpectSection>
                          </ActivityGrid>
                        </ActivityContent>
                      );
                    })()}

                    {/* 중분류 인라인 액티비티 */}
                    {currentGroup && currentGroup.subcategories.length > 0 ? (
                      <ActivityContent>
                        <ActivityLabel>액티비티</ActivityLabel>
                        {(() => {
                          const catSubs = currentGroup.subcategories;
                          const addedInstances = catSubs.filter(sub => activities[sub.id]);
                          const availableSubs = catSubs.filter(sub => !activities[sub.id]);
                          return (
                            <>
                              {addedInstances.length > 0 && (
                                <InstanceList>
                                  {addedInstances.map(sub => {
                                    const act = activities[sub.id];
                                    const isExpanded = expandedActivities[sub.id];
                                    return (
                                      <InstanceCard key={sub.id} style={{ flexDirection: 'column', alignItems: 'stretch', cursor: 'default' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <InstanceExpandBtn type="button" onClick={() => toggleExpandActivity(sub.id)}>
                                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                          </InstanceExpandBtn>
                                          <InstanceInfo onClick={() => toggleExpandActivity(sub.id)} style={{ cursor: 'pointer' }}>
                                            <InstanceName>{sub.name}</InstanceName>
                                            <InstanceMeta>
                                              <InstanceStatusBadge $status={act.상태}>
                                                {act.상태 || '계획'}
                                                {act.상태 === '진행' && ` ${act.진행률 ?? 0}%`}
                                              </InstanceStatusBadge>
                                              {act.주관부서 && <InstanceMetaItem>{act.주관부서}</InstanceMetaItem>}
                                              {act.활용솔루션 && <InstanceMetaItem>{act.활용솔루션}</InstanceMetaItem>}
                                              {act.완료일 && <InstanceMetaItem>완료일: {act.완료일}</InstanceMetaItem>}
                                              {(act.담당자목록 || []).length > 0 && (
                                                <InstanceMetaItem>
                                                  담당: {act.담당자목록.map(p => p.이름).join(', ')}
                                                </InstanceMetaItem>
                                              )}
                                            </InstanceMeta>
                                          </InstanceInfo>
                                          <InstanceRemoveBtn onClick={() => handleRemoveActivity(sub.id)} title="삭제">
                                            <Trash2 size={13} />
                                          </InstanceRemoveBtn>
                                        </div>

                                        {isExpanded && (
                                          <InlineEditArea>
                                            <InlineEditRow $cols="1fr auto 1fr 1fr 1fr">
                                              <InlineEditField>
                                                <ActivityLabel>상태</ActivityLabel>
                                                <StatusToggleGroup>
                                                  {['계획', '진행', '완료'].map(s => (
                                                    <StatusToggleBtn key={s} type="button"
                                                      $active={(act.상태 || '계획') === s} $status={s}
                                                      onClick={() => {
                                                        handleActivityChange(sub.id, '상태', s);
                                                        if (s === '완료') {
                                                          handleActivityChange(sub.id, '진행률', 100);
                                                          if (!act.완료일) handleActivityChange(sub.id, '완료일', TODAY());
                                                        } else if (s === '계획') {
                                                          handleActivityChange(sub.id, '진행률', 0);
                                                        } else if (s === '진행') {
                                                          if (!act.진행률 || act.진행률 === 0 || act.진행률 === 100) handleActivityChange(sub.id, '진행률', 50);
                                                        }
                                                      }}>
                                                      {s}
                                                    </StatusToggleBtn>
                                                  ))}
                                                </StatusToggleGroup>
                                              </InlineEditField>
                                              <InlineEditField style={{ width: '60px' }}>
                                                <ActivityLabel>진행률</ActivityLabel>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                  <ActivityInput
                                                    type="number" min="0" max="100"
                                                    value={act.상태 === '완료' ? 100 : act.상태 === '계획' ? 0 : (act.진행률 ?? 0)}
                                                    disabled={act.상태 !== '진행'}
                                                    style={{ width: '52px', textAlign: 'center', padding: '7px 4px' }}
                                                    onChange={(e) => {
                                                      let v = parseInt(e.target.value, 10);
                                                      if (isNaN(v)) v = 0;
                                                      if (v < 1) v = 1;
                                                      if (v > 99) v = 99;
                                                      handleActivityChange(sub.id, '진행률', v);
                                                    }} />
                                                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>%</span>
                                                </div>
                                              </InlineEditField>
                                              <InlineEditField>
                                                <ActivityLabel>완료일</ActivityLabel>
                                                <ActivityDateInput value={act.완료일 || ''}
                                                  onChange={(e) => handleActivityChange(sub.id, '완료일', e.target.value)} />
                                              </InlineEditField>
                                              <InlineEditField>
                                                <ActivityLabel>주관 부서</ActivityLabel>
                                                <DeptSearchWrapper ref={activeEditSubId === sub.id ? deptWrapperRef : null}>
                                                  <DeptSearchInput
                                                    value={activeEditSubId === sub.id ? deptSearchText : (act.주관부서 || '')}
                                                    $hasValue={!!act.주관부서}
                                                    onChange={(e) => {
                                                      setActiveEditSubId(sub.id);
                                                      setDeptSearchText(e.target.value);
                                                      setDeptDropdownOpen(true);
                                                      setDeptActiveIdx(-1);
                                                      if (!e.target.value.trim()) {
                                                        handleActivityChange(sub.id, '주관부서', '');
                                                      }
                                                    }}
                                                    onFocus={() => {
                                                      setActiveEditSubId(sub.id);
                                                      setDeptSearchText(act.주관부서 || '');
                                                      setDeptDropdownOpen(true);
                                                    }}
                                                    onKeyDown={(e) => handleDeptKeyDown(e, sub.id)}
                                                    placeholder="부서 검색"
                                                  />
                                                  {activeEditSubId === sub.id && deptDropdownOpen && deptFiltered.length > 0 && (
                                                    <DeptDropdown>
                                                      {deptFiltered.map((dept, idx) => {
                                                        const q = deptSearchText.trim().toLowerCase();
                                                        const mi = q ? dept.name.toLowerCase().indexOf(q) : -1;
                                                        return (
                                                          <DeptDropdownItem key={dept.id}
                                                            data-active={idx === deptActiveIdx ? 'true' : undefined}
                                                            onMouseDown={() => selectDept(sub.id, dept.name)}
                                                            onMouseEnter={() => setDeptActiveIdx(idx)}>
                                                            {mi >= 0 ? (
                                                              <>{dept.name.slice(0, mi)}<DeptDropdownHighlight>{dept.name.slice(mi, mi + q.length)}</DeptDropdownHighlight>{dept.name.slice(mi + q.length)}</>
                                                            ) : dept.name}
                                                          </DeptDropdownItem>
                                                        );
                                                      })}
                                                    </DeptDropdown>
                                                  )}
                                                </DeptSearchWrapper>
                                              </InlineEditField>
                                              <InlineEditField>
                                                <ActivityLabel>활용 솔루션</ActivityLabel>
                                                {solutions.length === 0 ? (
                                                  <EmptyHint>미등록</EmptyHint>
                                                ) : (
                                                  <ActivitySelect value={act.활용솔루션 || ''}
                                                    onChange={(e) => handleActivitySetSolution(sub.id, e.target.value)}>
                                                    <option value="">선택</option>
                                                    {solutions.map(sol => (
                                                      <option key={sol.id} value={sol.name}>{sol.name}</option>
                                                    ))}
                                                  </ActivitySelect>
                                                )}
                                              </InlineEditField>
                                            </InlineEditRow>

                                            <InlineEditField>
                                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <ActivityLabel>담당자</ActivityLabel>
                                                <PersonnelAddBtn type="button"
                                                  onClick={() => setPersonnelModalSubId(sub.id)}>
                                                  <UserPlus size={11} /> 추가
                                                </PersonnelAddBtn>
                                              </div>
                                              {(act.담당자목록 || []).length > 0 ? (
                                                <PersonnelList>
                                                  {act.담당자목록.map((p, idx) => (
                                                    <PersonnelChip key={idx} $isPL={p.isPL}>
                                                      {p.isPL ? (
                                                        <PLBadge title="과제 PL (클릭하여 해제)" onClick={() => togglePL(sub.id, idx)}>PL</PLBadge>
                                                      ) : (
                                                        <PLToggle title="과제 PL로 지정" onClick={() => togglePL(sub.id, idx)}>PL</PLToggle>
                                                      )}
                                                      <ChipName>{p.이름}</ChipName>
                                                      {p.knoxId && <ChipDetail>({p.knoxId})</ChipDetail>}
                                                      {p.부서 && <ChipDetail>· {p.부서}</ChipDetail>}
                                                      <ChipRemove onClick={() => removePersonnel(sub.id, idx)} title="삭제"><X size={8} /></ChipRemove>
                                                    </PersonnelChip>
                                                  ))}
                                                </PersonnelList>
                                              ) : (
                                                <EmptyHint style={{ padding: '4px 0', textAlign: 'left' }}>담당자를 추가하세요.</EmptyHint>
                                              )}
                                            </InlineEditField>

                                            <InlineEditField>
                                              <ActivityLabel>상세 내용</ActivityLabel>
                                              <ActivityTextarea value={act.상세내용 || ''} placeholder="상세 내용을 입력하세요"
                                                onChange={(e) => {
                                                  handleActivityChange(sub.id, '상세내용', e.target.value);
                                                  e.target.style.height = 'auto';
                                                  e.target.style.height = e.target.scrollHeight + 'px';
                                                }} />
                                            </InlineEditField>
                                          </InlineEditArea>
                                        )}
                                      </InstanceCard>
                                    );
                                  })}
                                </InstanceList>
                              )}

                              {availableSubs.length > 0 && (
                                <InlineAddRow>
                                  <ToggleGroup>
                                    {availableSubs.map(sub => (
                                      <ToggleButton key={sub.id} type="button"
                                        $active={false} $color="#6366f1"
                                        onClick={() => addActivityInline(activeCategoryTab, sub.id)}>
                                        <Plus size={11} style={{ marginRight: '2px' }} />{sub.name}
                                      </ToggleButton>
                                    ))}
                                  </ToggleGroup>
                                </InlineAddRow>
                              )}

                              {addedInstances.length === 0 && availableSubs.length === 0 && (
                                <EmptyHint style={{ textAlign: 'center', padding: '16px 0' }}>
                                  등록된 중분류가 없습니다.
                                </EmptyHint>
                              )}
                            </>
                          );
                        })()}
                      </ActivityContent>
                    ) : (
                      <NoActivityHint>
                        이 대분류에 속한 중분류가 없습니다.<br />설정에서 중분류를 추가하세요.
                      </NoActivityHint>
                    )}
                    </RightPanelScroll>
                  </>
                )}
              </RightPanel>
            </BodyWrapper>

            <ModalFooter>
              <CancelButton onClick={handleCloseWithConfirm}>취소</CancelButton>
              <SubmitButton onClick={handleSubmit}>
                <Plus size={16} /> {isEditMode ? '수정' : '추가'}
              </SubmitButton>
            </ModalFooter>
          </ModalContainer>
        </Overlay>
      )}
    </AnimatePresence>
    <PersonnelModal
      isOpen={!!personnelModalSubId}
      onClose={() => setPersonnelModalSubId('')}
      onConfirm={handlePersonnelConfirm}
      divisions={divisions}
      departments={departments}
    />
    <ConfirmModal
      open={confirmState.open}
      title={confirmState.title}
      message={confirmState.message}
      variant={confirmState.variant}
      confirmLabel={confirmState.confirmLabel}
      onConfirm={confirmState.onConfirm}
      onCancel={confirmState.onCancel}
    />
    </>
  );
};

export default AddTaskModal;
