import React, { useMemo, useState, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { Edit3, X, Check, ChevronsUpDown, ChevronDown, ChevronRight, Box, Search, ClipboardList } from 'lucide-react';
import BatchEvalView from './BatchEvalView';
import { useModuleCategories } from '../contexts/ModuleCategoryContext';
import { spdmApi } from '../services/spdmApi';

const DIVISIONS = ['MX', 'VD', 'DA', 'NW', '의료기기'];

/* ===== Styled Components ===== */

const Container = styled.div`
  flex: 1;
  overflow: auto;
  padding: 1.5rem;
`;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-bottom: 0.75rem;
`;

const EditToggleBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 1px solid ${props => props.$active ? '#8b5cf6' : '#e2e8f0'};
  border-radius: 6px;
  background: ${props => props.$active ? '#f5f3ff' : 'white'};
  color: ${props => props.$active ? '#7c3aed' : '#64748b'};
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.$active ? '#ede9fe' : '#f8fafc'};
    border-color: ${props => props.$active ? '#7c3aed' : '#cbd5e1'};
  }
`;

const ToolbarBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: white;
  color: #64748b;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
  }
`;

const TableWrapper = styled.div`
  background: white;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  overflow: auto;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;

  th, td {
    border: 1px solid #e2e8f0;
    padding: 8px 12px;
    text-align: center;
    vertical-align: middle;
  }

  th {
    background: #f8fafc;
    font-weight: 600;
    color: #374151;
    white-space: nowrap;
    position: sticky;
    top: 0;
    z-index: 1;
  }

  td {
    color: #1e293b;
  }
`;

const GroupCell = styled.td`
  background: #f5f3ff;
  font-weight: 600;
  color: #6d28d9 !important;
`;

const CategoryCell = styled.td`
  background: #faf5ff;
  font-weight: 500;
  color: #7c3aed !important;
  cursor: pointer;
  user-select: none;

  &:hover {
    background: #f3e8ff;
  }
`;

const CategoryCellContent = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
`;

const CollapseIcon = styled.span`
  display: inline-flex;
  color: #a78bfa;
  flex-shrink: 0;
`;

const SummaryDetailCell = styled.td`
  background: #faf5ff;
  font-weight: 500;
  font-size: 0.75rem;
  color: #7c3aed !important;
`;

const DivisionCell = styled.td`
  position: relative;
  cursor: ${props => props.$clickable ? 'pointer' : 'default'};

  &:hover {
    background: ${props => props.$clickable ? '#f8fafc' : 'transparent'};
  }
`;

const SummaryDivisionCell = styled.td`
  background: #fefce8;
  font-weight: 600;
`;

const ScoreBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 600;
  background: ${props => props.$color || '#f1f5f9'};
  color: ${props => props.$textColor || '#475569'};
`;

const EmptyMessage = styled.div`
  padding: 3rem;
  text-align: center;
  color: #94a3b8;
  font-size: 0.9rem;
`;

/* ===== Modal ===== */
const Overlay = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
`;

const Modal = styled.div`
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0,0,0,0.2);
  width: 80vw;
  height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
`;

const ModalTitle = styled.h3`
  margin: 0;
  font-size: 1rem;
  color: #1e293b;
`;

const ModalSubtitle = styled.span`
  font-size: 0.8rem;
  color: #64748b;
  font-weight: 400;
  margin-left: 8px;
`;

const CloseBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: #64748b;
  display: flex;
  border-radius: 4px;

  &:hover {
    background: #e2e8f0;
    color: #1e293b;
  }
`;

const ModalBody = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
`;

const ModalPanelLeft = styled.div`
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  border-right: 1px solid #e2e8f0;
`;

const ModalPanelRight = styled.div`
  width: 40%;
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const DetailSection = styled.div`
  margin-bottom: 16px;
  &:last-child { margin-bottom: 0; }
`;

const DetailLabel = styled.div`
  font-size: 0.85rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
`;

const CriteriaOptions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const CriteriaOption = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: 1.5px solid ${props => props.$selected ? '#8b5cf6' : '#e2e8f0'};
  border-radius: 8px;
  background: ${props => props.$selected ? '#f5f3ff' : 'white'};
  color: ${props => props.$selected ? '#7c3aed' : '#475569'};
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: #c4b5fd;
    background: #faf5ff;
  }
`;

const CriteriaScore = styled.span`
  font-weight: 700;
  color: ${props => props.$selected ? '#6d28d9' : '#94a3b8'};
  font-size: 0.75rem;
`;

const NoCriteria = styled.span`
  font-size: 0.8rem;
  color: #94a3b8;
  font-style: italic;
`;

const ChecklistCellContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
`;

const CheckedItems = styled.span`
  font-size: 0.7rem;
  color: #64748b;
  line-height: 1.3;
  word-break: keep-all;
`;

const ChecklistSummary = styled.div`
  margin-top: 12px;
  font-size: 0.8rem;
  font-weight: 600;
  color: #7c3aed;
`;

const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
`;

const ModalBtn = styled.button`
  padding: 8px 18px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  border: 1px solid ${props => props.$primary ? '#8b5cf6' : '#e2e8f0'};
  background: ${props => props.$primary ? '#8b5cf6' : 'white'};
  color: ${props => props.$primary ? 'white' : '#64748b'};

  &:hover {
    background: ${props => props.$primary ? '#7c3aed' : '#f8fafc'};
  }
`;

const ViewToggle = styled.div`
  display: flex;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  overflow: hidden;
`;

const ViewToggleBtn = styled.button`
  padding: 6px 12px;
  border: none;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  background: ${props => props.$active ? '#8b5cf6' : 'white'};
  color: ${props => props.$active ? 'white' : '#64748b'};

  &:not(:last-child) {
    border-right: 1px solid #e2e8f0;
  }

  &:hover {
    background: ${props => props.$active ? '#8b5cf6' : '#f8fafc'};
  }
`;

const SummarySymbol = styled.span`
  font-size: 1rem;
  font-weight: 700;
  color: ${props => props.$color || '#475569'};
`;

/* ===== Module Selection Styles ===== */

const ModuleSectionDivider = styled.div`
  border-top: 1px solid #e2e8f0;
  margin-top: 16px;
  padding-top: 16px;
`;

const ModuleSectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 10px;
`;

const ModuleSearchInput = styled.input`
  width: 100%;
  padding: 6px 10px 6px 30px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.8rem;
  color: #1e293b;
  margin-bottom: 8px;

  &:focus {
    outline: none;
    border-color: #8b5cf6;
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.1);
  }

  &::placeholder { color: #94a3b8; }
`;

const ModuleSearchWrapper = styled.div`
  position: relative;

  svg {
    position: absolute;
    left: 9px;
    top: 50%;
    transform: translateY(-50%);
    color: #94a3b8;
    pointer-events: none;
  }
`;

const ModuleListScroll = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 6px;
`;

const ModuleItem = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 0.8rem;
  color: #1e293b;
  cursor: pointer;
  background: ${props => props.$checked ? '#f5f3ff' : 'transparent'};
  transition: background 0.1s ease;

  &:hover {
    background: ${props => props.$checked ? '#ede9fe' : '#f8fafc'};
  }

  input {
    accent-color: #8b5cf6;
    flex-shrink: 0;
  }
`;

const ModuleItemName = styled.span`
  flex: 1;
  font-weight: 500;
`;

const ModuleItemMeta = styled.span`
  font-size: 0.7rem;
  color: #94a3b8;
`;

const NoModules = styled.div`
  padding: 12px;
  text-align: center;
  font-size: 0.8rem;
  color: #94a3b8;
`;

const SelectedCount = styled.span`
  font-size: 0.75rem;
  font-weight: 400;
  color: #7c3aed;
  margin-left: auto;
`;

/* ===== Module View Cell Styles ===== */

const ModuleChipList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  justify-content: center;
`;

const ModuleChip = styled.span`
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 0.68rem;
  font-weight: 500;
  background: #ede9fe;
  color: #6d28d9;
  white-space: nowrap;
  line-height: 1.4;
`;

/* ===== Comment Styles ===== */

const CommentTextarea = styled.textarea`
  width: 100%;
  min-height: 60px;
  padding: 8px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.8rem;
  color: #1e293b;
  resize: vertical;
  font-family: inherit;

  &:focus {
    outline: none;
    border-color: #8b5cf6;
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.1);
  }

  &::placeholder { color: #94a3b8; }
`;

const CommentCell = styled.span`
  font-size: 0.75rem;
  color: #475569;
  line-height: 1.4;
  text-align: left;
  display: block;
  white-space: pre-wrap;
  word-break: break-word;
`;

/* ===== Batch Eval Modal ===== */
const BatchEvalOverlay = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
`;

const BatchEvalModal = styled.div`
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.25);
  width: 90vw;
  height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const BatchEvalModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
  flex-shrink: 0;
`;

const BatchEvalModalTitle = styled.h3`
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const BatchEvalModalBody = styled.div`
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

/* ===== Helpers ===== */

const getScoreSymbol = (score) => {
  if (score >= 3) return { symbol: '◎', color: '#166534' };
  if (score === 2) return { symbol: '○', color: '#854d0e' };
  if (score === 1) return { symbol: '△', color: '#9a3412' };
  return { symbol: '✕', color: '#991b1b' };
};

const getScoreColor = (score, maxScore) => {
  if (maxScore <= 0) return { bg: '#f1f5f9', text: '#475569' };
  const ratio = score / maxScore;
  if (ratio >= 0.8) return { bg: '#dcfce7', text: '#166534' };
  if (ratio >= 0.5) return { bg: '#fef9c3', text: '#854d0e' };
  if (ratio >= 0.2) return { bg: '#ffedd5', text: '#9a3412' };
  return { bg: '#fee2e2', text: '#991b1b' };
};

// Get numeric score for a single detail+division
const getDetailScore = (detail, divisionScores, division) => {
  const value = divisionScores[detail.id]?.[division];
  if (value === undefined || value === null) return null;
  if ((detail.type || 'score') === 'checklist') {
    return Array.isArray(value) ? value.length : 0;
  }
  return typeof value === 'number' ? value : null;
};

/* ===== Component ===== */

const SPDMDashboardView = ({ departments = [] }) => {
  const { groups, categories, categoryGroups, categoryDetails, divisionScores, updateDivisionScore, divisionModules, updateDivisionModules, divisionComments, updateDivisionComment } = useModuleCategories();

  const [viewType, setViewType] = useState('summary'); // 'summary' | 'score' | 'module' | 'comment'
  const [editMode, setEditMode] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState(new Set());
  const [modalInfo, setModalInfo] = useState(null);
  const [showBatchEval, setShowBatchEval] = useState(false);

  const [draftScores, setDraftScores] = useState({});
  const [draftChecked, setDraftChecked] = useState([]);

  const [draftComment, setDraftComment] = useState('');

  // Module selection state
  const [allModules, setAllModules] = useState([]);
  const [draftModuleIds, setDraftModuleIds] = useState([]);
  const [moduleSearch, setModuleSearch] = useState('');
  // Fetch all modules once
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await spdmApi.getModules();
        if (!cancelled) setAllModules(data);
      } catch (e) {
        console.error('모듈 목록 조회 실패:', e);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // Department name → id map
  const deptNameToId = useMemo(() => {
    const map = {};
    departments.forEach(d => { map[d.name] = d.id; });
    return map;
  }, [departments]);

  // Module id → module map
  const moduleMap = useMemo(() => {
    const map = {};
    allModules.forEach(m => { map[m.id] = m; });
    return map;
  }, [allModules]);

  // All category names that appear in the table
  const allCategoryNames = useMemo(() => {
    const names = new Set();
    const linkedCatNames = new Set();
    groups.forEach(group => {
      categories.forEach(cat => {
        if ((categoryGroups[cat] || []).includes(group.id)) {
          names.add(cat);
          linkedCatNames.add(cat);
        }
      });
    });
    categories.forEach(cat => {
      if (!linkedCatNames.has(cat)) names.add(cat);
    });
    return names;
  }, [groups, categories, categoryGroups]);

  const allCollapsed = allCategoryNames.size > 0 && collapsedCategories.size >= allCategoryNames.size;

  const toggleCategory = useCallback((catName) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catName)) next.delete(catName);
      else next.add(catName);
      return next;
    });
  }, []);

  const toggleAllCollapse = useCallback(() => {
    if (allCollapsed) {
      setCollapsedCategories(new Set());
    } else {
      setCollapsedCategories(new Set(allCategoryNames));
    }
  }, [allCollapsed, allCategoryNames]);

  // Compute sum score for a category + division
  const getCategorySumScore = useCallback((categoryName, division) => {
    const details = categoryDetails[categoryName] || [];
    if (details.length === 0) return null;
    let sum = 0;
    let hasAny = false;
    details.forEach(detail => {
      const s = getDetailScore(detail, divisionScores, division);
      if (s !== null) {
        sum += s;
        hasAny = true;
      }
    });
    return hasAny ? sum : null;
  }, [categoryDetails, divisionScores]);

  // Max possible sum for a category (for color scaling)
  const getCategoryMaxScore = useCallback((categoryName) => {
    const details = categoryDetails[categoryName] || [];
    let max = 0;
    details.forEach(detail => {
      if ((detail.type || 'score') === 'checklist') {
        max += detail.criteria.length;
      } else {
        const scores = detail.criteria.map(c => c.score);
        max += scores.length > 0 ? Math.max(...scores) : 0;
      }
    });
    return max;
  }, [categoryDetails]);

  // Build table rows respecting collapsed state
  const tableRows = useMemo(() => {
    const rows = [];

    const buildCategoryRows = (catData, groupName, groupTotalRows, isFirstOfGroupRef) => {
      const isCollapsed = collapsedCategories.has(catData.name);

      if (isCollapsed || catData.details.length === 0) {
        // Collapsed → 1 summary row; or no details → 1 empty row
        rows.push({
          group: groupName,
          groupRowSpan: groupTotalRows,
          isFirstOfGroup: isFirstOfGroupRef.value,
          category: catData.name,
          categoryRowSpan: 1,
          isFirstOfCategory: true,
          detail: isCollapsed && catData.details.length > 0 ? `합계 (${catData.details.length})` : '',
          detailId: null,
          categoryName: catData.name,
          isSummaryRow: isCollapsed && catData.details.length > 0,
        });
        isFirstOfGroupRef.value = false;
      } else {
        catData.details.forEach((detail, detailIdx) => {
          rows.push({
            group: groupName,
            groupRowSpan: groupTotalRows,
            isFirstOfGroup: isFirstOfGroupRef.value,
            category: catData.name,
            categoryRowSpan: catData.rowCount,
            isFirstOfCategory: detailIdx === 0,
            detail: detail.name,
            detailId: detail.id,
            categoryName: catData.name,
            isSummaryRow: false,
          });
          isFirstOfGroupRef.value = false;
        });
      }
    };

    const processCategoryList = (catList, groupName) => {
      // Compute group total rows considering collapsed state
      let groupTotalRows = 0;
      const categoryData = catList.map(cat => {
        const details = categoryDetails[cat] || [];
        const isCollapsed = collapsedCategories.has(cat);
        const rowCount = isCollapsed ? 1 : (details.length > 0 ? details.length : 1);
        groupTotalRows += rowCount;
        return { name: cat, details, rowCount };
      });

      if (categoryData.length === 0) {
        rows.push({
          group: groupName,
          groupRowSpan: 1,
          isFirstOfGroup: true,
          category: '',
          categoryRowSpan: 1,
          isFirstOfCategory: true,
          detail: '',
          detailId: null,
          categoryName: null,
          isSummaryRow: false,
        });
        return;
      }

      const isFirstOfGroupRef = { value: true };
      categoryData.forEach(catData => {
        buildCategoryRows(catData, groupName, groupTotalRows, isFirstOfGroupRef);
      });
    };

    groups.forEach(group => {
      const linkedCategories = categories.filter(cat =>
        (categoryGroups[cat] || []).includes(group.id)
      );

      if (linkedCategories.length === 0) {
        rows.push({
          group: group.name,
          groupRowSpan: 1,
          isFirstOfGroup: true,
          category: '',
          categoryRowSpan: 1,
          isFirstOfCategory: true,
          detail: '',
          detailId: null,
          categoryName: null,
          isSummaryRow: false,
        });
      } else {
        processCategoryList(linkedCategories, group.name);
      }
    });

    // Unlinked categories
    const linkedCategoryNames = new Set();
    groups.forEach(group => {
      categories.forEach(cat => {
        if ((categoryGroups[cat] || []).includes(group.id)) {
          linkedCategoryNames.add(cat);
        }
      });
    });
    const unlinkedCategories = categories.filter(cat => !linkedCategoryNames.has(cat));
    if (unlinkedCategories.length > 0) {
      processCategoryList(unlinkedCategories, '(미분류)');
    }

    return rows;
  }, [groups, categories, categoryGroups, categoryDetails, collapsedCategories]);

  /* ===== Modal handlers ===== */

  const handleOpenModal = (row, division) => {
    if (!row.detailId || !row.categoryName) return;
    const details = categoryDetails[row.categoryName] || [];
    const detail = details.find(d => d.id === row.detailId);
    if (!detail) return;

    const type = detail.type || 'score';
    const current = divisionScores[row.detailId]?.[division];

    if (type === 'checklist') {
      setDraftChecked(Array.isArray(current) ? [...current] : []);
    } else {
      setDraftScores({ [row.detailId]: current });
    }

    // Initialize draft module selection & comment
    const currentModules = divisionModules[row.detailId]?.[division] || [];
    setDraftModuleIds([...currentModules]);
    setModuleSearch('');
    setDraftComment(divisionComments[row.detailId]?.[division] || '');

    setModalInfo({
      category: row.categoryName,
      detailId: row.detailId,
      detailName: row.detail,
      division,
      criteria: detail.criteria || [],
      type,
      readOnly: !editMode,
    });
  };

  const handleSelectCriteria = (detailId, score) => {
    setDraftScores(prev => ({
      ...prev,
      [detailId]: prev[detailId] === score ? undefined : score,
    }));
  };

  const handleToggleChecked = (index) => {
    setDraftChecked(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const handleToggleModule = (moduleId) => {
    setDraftModuleIds(prev =>
      prev.includes(moduleId) ? prev.filter(id => id !== moduleId) : [...prev, moduleId]
    );
  };

  const handleSaveModal = () => {
    if (!modalInfo) return;
    if (modalInfo.type === 'checklist') {
      updateDivisionScore(modalInfo.detailId, modalInfo.division, draftChecked);
    } else {
      updateDivisionScore(modalInfo.detailId, modalInfo.division, draftScores[modalInfo.detailId]);
    }
    updateDivisionModules(modalInfo.detailId, modalInfo.division, draftModuleIds);
    updateDivisionComment(modalInfo.detailId, modalInfo.division, draftComment.trim());
    setModalInfo(null);
    setDraftScores({});
    setDraftChecked([]);
    setDraftModuleIds([]);
    setModuleSearch('');
    setDraftComment('');
  };

  const handleCloseModal = () => {
    setModalInfo(null);
    setDraftScores({});
    setDraftChecked([]);
    setDraftModuleIds([]);
    setModuleSearch('');
    setDraftComment('');
  };

  // Filtered modules for modal: match division + category
  const filteredModulesForModal = useMemo(() => {
    if (!modalInfo) return [];
    const divId = deptNameToId[modalInfo.division];
    return allModules.filter(mod => {
      // Match division
      const matchDiv = mod.divisionId === divId || mod.divisionId === '__all__';
      // Match category
      const matchCat = Array.isArray(mod.categories) && mod.categories.includes(modalInfo.category);
      if (!matchDiv || !matchCat) return false;
      // Search filter
      if (moduleSearch.trim()) {
        return mod.name.toLowerCase().includes(moduleSearch.trim().toLowerCase());
      }
      return true;
    });
  }, [modalInfo, allModules, deptNameToId, moduleSearch]);

  /* ===== Cell rendering ===== */

  const renderDetailCellContent = (row, division) => {
    if (!row.detailId) return null;

    // Module view: show linked modules
    if (viewType === 'module') {
      const linkedIds = divisionModules[row.detailId]?.[division] || [];
      if (linkedIds.length === 0) return null;
      return (
        <ModuleChipList>
          {linkedIds.map(id => {
            const mod = moduleMap[id];
            return (
              <ModuleChip key={id}>{mod ? mod.name : id}</ModuleChip>
            );
          })}
        </ModuleChipList>
      );
    }

    // Comment view: show comment text
    if (viewType === 'comment') {
      const comment = divisionComments[row.detailId]?.[division];
      if (!comment) return null;
      return <CommentCell>{comment}</CommentCell>;
    }

    const value = divisionScores[row.detailId]?.[division];
    const details = categoryDetails[row.categoryName] || [];
    const detail = details.find(d => d.id === row.detailId);
    const criteria = detail?.criteria || [];
    const isChecklist = (detail?.type || 'score') === 'checklist';

    const hasValue = isChecklist
      ? Array.isArray(value) && value.length > 0
      : value !== undefined && value !== null;

    if (!hasValue) return null;

    const numericScore = isChecklist
      ? (Array.isArray(value) ? value.length : 0)
      : value;

    if (viewType === 'summary') {
      const { symbol, color } = getScoreSymbol(numericScore);
      return <SummarySymbol $color={color}>{symbol}</SummarySymbol>;
    }

    if (isChecklist) {
      const checked = Array.isArray(value) ? value : [];
      const total = criteria.length;
      const colors = getScoreColor(checked.length, total);
      const checkedLabels = checked
        .sort((a, b) => a - b)
        .map(ci => criteria[ci]?.label || `항목 ${ci + 1}`)
        .join(', ');
      return (
        <ChecklistCellContent>
          <ScoreBadge $color={colors.bg} $textColor={colors.text}>
            {checked.length}점
          </ScoreBadge>
          {checkedLabels && <CheckedItems>{checkedLabels}</CheckedItems>}
        </ChecklistCellContent>
      );
    }

    const maxScore = criteria.length > 0 ? Math.max(...criteria.map(c => c.score)) : 0;
    const matched = criteria.find(c => c.score === value);
    const colors = getScoreColor(value, maxScore);
    return (
      <ScoreBadge $color={colors.bg} $textColor={colors.text}>
        {value}점{matched?.label ? ` · ${matched.label}` : ''}
      </ScoreBadge>
    );
  };

  const renderSummaryCellContent = (categoryName, division) => {
    // Comment view: show all comments for this category
    if (viewType === 'comment') {
      const details = categoryDetails[categoryName] || [];
      const comments = details
        .map(d => divisionComments[d.id]?.[division])
        .filter(Boolean);
      if (comments.length === 0) return null;
      return <CommentCell>{comments.join('; ')}</CommentCell>;
    }

    // Module view: show all linked modules for this category
    if (viewType === 'module') {
      const details = categoryDetails[categoryName] || [];
      const allLinked = [];
      details.forEach(d => {
        const ids = divisionModules[d.id]?.[division] || [];
        ids.forEach(id => { if (!allLinked.includes(id)) allLinked.push(id); });
      });
      if (allLinked.length === 0) return null;
      return (
        <ModuleChipList>
          {allLinked.map(id => {
            const mod = moduleMap[id];
            return <ModuleChip key={id}>{mod ? mod.name : id}</ModuleChip>;
          })}
        </ModuleChipList>
      );
    }

    const sum = getCategorySumScore(categoryName, division);
    if (sum === null) return null;

    if (viewType === 'summary') {
      const { symbol, color } = getScoreSymbol(sum);
      return <SummarySymbol $color={color}>{symbol}</SummarySymbol>;
    }

    const maxScore = getCategoryMaxScore(categoryName);
    const colors = getScoreColor(sum, maxScore);
    return (
      <ScoreBadge $color={colors.bg} $textColor={colors.text}>
        {sum}점
      </ScoreBadge>
    );
  };

  /* ===== Render ===== */

  if (tableRows.length === 0) {
    return (
      <Container>
        <TableWrapper>
          <EmptyMessage>
            설정에서 그룹과 모듈 구분을 추가해주세요.
          </EmptyMessage>
        </TableWrapper>
      </Container>
    );
  }

  return (
    <Container>
      <Toolbar>
        <ViewToggle>
          <ViewToggleBtn $active={viewType === 'summary'} onClick={() => setViewType('summary')}>
            요약 뷰
          </ViewToggleBtn>
          <ViewToggleBtn $active={viewType === 'score'} onClick={() => setViewType('score')}>
            점수 뷰
          </ViewToggleBtn>
          <ViewToggleBtn $active={viewType === 'module'} onClick={() => setViewType('module')}>
            모듈 뷰
          </ViewToggleBtn>
          <ViewToggleBtn $active={viewType === 'comment'} onClick={() => setViewType('comment')}>
            코멘트 뷰
          </ViewToggleBtn>
        </ViewToggle>
        <ToolbarBtn onClick={toggleAllCollapse}>
          <ChevronsUpDown size={14} />
          {allCollapsed ? '모두 펼치기' : '모두 접기'}
        </ToolbarBtn>
        <EditToggleBtn $active={editMode} onClick={() => setEditMode(!editMode)}>
          <Edit3 size={14} />
          {editMode ? 'Edit 완료' : 'Edit'}
        </EditToggleBtn>
        <ToolbarBtn onClick={() => setShowBatchEval(true)}>
          <ClipboardList size={14} />
          일괄 평가
        </ToolbarBtn>
      </Toolbar>

      <TableWrapper>
        <Table>
          <colgroup>
            <col style={{ width: '8%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '20%' }} />
            {DIVISIONS.map(div => (
              <col key={div} style={{ width: '11.4%' }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th>그룹</th>
              <th>모듈 구분</th>
              <th>세부 항목</th>
              {DIVISIONS.map(div => (
                <th key={div}>{div}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, idx) => (
              <tr key={idx}>
                {row.isFirstOfGroup && (
                  <GroupCell rowSpan={row.groupRowSpan}>
                    {row.group}
                  </GroupCell>
                )}
                {row.isFirstOfCategory && (
                  <CategoryCell
                    rowSpan={row.categoryRowSpan}
                    onClick={() => row.categoryName && toggleCategory(row.categoryName)}
                  >
                    <CategoryCellContent>
                      {row.categoryName && (
                        <CollapseIcon>
                          {collapsedCategories.has(row.categoryName)
                            ? <ChevronRight size={14} />
                            : <ChevronDown size={14} />
                          }
                        </CollapseIcon>
                      )}
                      {row.category}
                    </CategoryCellContent>
                  </CategoryCell>
                )}

                {row.isSummaryRow ? (
                  <>
                    <SummaryDetailCell>{row.detail}</SummaryDetailCell>
                    {DIVISIONS.map(div => (
                      <SummaryDivisionCell key={div}>
                        {renderSummaryCellContent(row.categoryName, div)}
                      </SummaryDivisionCell>
                    ))}
                  </>
                ) : (
                  <>
                    <td>{row.detail}</td>
                    {DIVISIONS.map(div => (
                      <DivisionCell
                        key={div}
                        $clickable={!!row.detailId}
                        onClick={() => row.detailId && handleOpenModal(row, div)}
                      >
                        {renderDetailCellContent(row, div)}
                      </DivisionCell>
                    ))}
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrapper>

      {/* Batch Eval Modal */}
      {showBatchEval && (
        <BatchEvalOverlay onClick={() => setShowBatchEval(false)}>
          <BatchEvalModal onClick={e => e.stopPropagation()}>
            <BatchEvalModalHeader>
              <BatchEvalModalTitle>
                <ClipboardList size={18} />
                일괄 평가
              </BatchEvalModalTitle>
              <CloseBtn onClick={() => setShowBatchEval(false)}>
                <X size={18} />
              </CloseBtn>
            </BatchEvalModalHeader>
            <BatchEvalModalBody>
              <BatchEvalView />
            </BatchEvalModalBody>
          </BatchEvalModal>
        </BatchEvalOverlay>
      )}

      {/* Criteria Selection Modal */}
      {modalInfo && (
        <Overlay onClick={handleCloseModal}>
          <Modal onClick={e => e.stopPropagation()}>
            <ModalHeader>
              <div>
                <ModalTitle>
                  {modalInfo.division}
                  <ModalSubtitle>{modalInfo.category} &gt; {modalInfo.detailName}</ModalSubtitle>
                </ModalTitle>
              </div>
              <CloseBtn onClick={handleCloseModal}>
                <X size={18} />
              </CloseBtn>
            </ModalHeader>

            <ModalBody>
              {/* Left Panel: 기준 선택 + 코멘트 */}
              <ModalPanelLeft>
                <DetailSection>
                  <DetailLabel>
                    {modalInfo.detailName}
                    {modalInfo.readOnly
                      ? (modalInfo.type === 'checklist' ? ' — 선택 현황' : ' — 평가 현황')
                      : (modalInfo.type === 'checklist' ? ' — 해당 항목 선택' : ' — 기준 선택')
                    }
                  </DetailLabel>
                  {modalInfo.criteria.length > 0 ? (
                    modalInfo.type === 'checklist' ? (
                      <CriteriaOptions>
                        {modalInfo.criteria.map((c, ci) => {
                          const isChecked = draftChecked.includes(ci);
                          return (
                            <CriteriaOption
                              key={ci}
                              $selected={isChecked}
                              onClick={modalInfo.readOnly ? undefined : () => handleToggleChecked(ci)}
                              style={modalInfo.readOnly ? { cursor: 'default' } : undefined}
                            >
                              <Check size={14} style={{ opacity: isChecked ? 1 : 0.2 }} />
                              {c.label || `항목 ${ci + 1}`}
                            </CriteriaOption>
                          );
                        })}
                      </CriteriaOptions>
                    ) : (
                      <CriteriaOptions>
                        {modalInfo.criteria.map(c => {
                          const isSelected = draftScores[modalInfo.detailId] === c.score;
                          return (
                            <CriteriaOption
                              key={c.score}
                              $selected={isSelected}
                              onClick={modalInfo.readOnly ? undefined : () => handleSelectCriteria(modalInfo.detailId, c.score)}
                              style={modalInfo.readOnly ? { cursor: 'default' } : undefined}
                            >
                              <CriteriaScore $selected={isSelected}>{c.score}점</CriteriaScore>
                              {c.label || '(라벨 없음)'}
                              {isSelected && <Check size={14} />}
                            </CriteriaOption>
                          );
                        })}
                      </CriteriaOptions>
                    )
                  ) : (
                    <NoCriteria>설정에서 판단 기준을 추가해주세요.</NoCriteria>
                  )}
                  {modalInfo.type === 'checklist' && modalInfo.criteria.length > 0 && (
                    <ChecklistSummary>
                      선택: {draftChecked.length} / {modalInfo.criteria.length}
                    </ChecklistSummary>
                  )}
                </DetailSection>

                <ModuleSectionDivider>
                  <ModuleSectionHeader>코멘트</ModuleSectionHeader>
                  {modalInfo.readOnly ? (
                    <CommentCell>{draftComment || '(코멘트 없음)'}</CommentCell>
                  ) : (
                    <CommentTextarea
                      placeholder="코멘트를 입력하세요..."
                      value={draftComment}
                      onChange={e => setDraftComment(e.target.value)}
                    />
                  )}
                </ModuleSectionDivider>
              </ModalPanelLeft>

              {/* Right Panel: 관련 모듈 */}
              <ModalPanelRight>
                <ModuleSectionHeader>
                  <Box size={15} />
                  관련 모듈
                  <SelectedCount>
                    {draftModuleIds.length > 0 && `${draftModuleIds.length}개 선택`}
                  </SelectedCount>
                </ModuleSectionHeader>

                {!modalInfo.readOnly && (
                  <ModuleSearchWrapper>
                    <Search size={14} />
                    <ModuleSearchInput
                      type="text"
                      placeholder="모듈 검색..."
                      value={moduleSearch}
                      onChange={e => setModuleSearch(e.target.value)}
                    />
                  </ModuleSearchWrapper>
                )}

                <ModuleListScroll>
                  {modalInfo.readOnly ? (
                    draftModuleIds.length > 0 ? (
                      draftModuleIds.map(id => {
                        const mod = moduleMap[id];
                        return (
                          <ModuleItem key={id} $checked>
                            <ModuleItemName>{mod ? mod.name : id}</ModuleItemName>
                            {mod?.systemType && (
                              <ModuleItemMeta>{mod.systemType}</ModuleItemMeta>
                            )}
                          </ModuleItem>
                        );
                      })
                    ) : (
                      <NoModules>연결된 모듈이 없습니다.</NoModules>
                    )
                  ) : (
                    filteredModulesForModal.length > 0 ? (
                      filteredModulesForModal.map(mod => {
                        const isChecked = draftModuleIds.includes(mod.id);
                        return (
                          <ModuleItem key={mod.id} $checked={isChecked}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleModule(mod.id)}
                            />
                            <ModuleItemName>{mod.name}</ModuleItemName>
                            {mod.systemType && (
                              <ModuleItemMeta>{mod.systemType}</ModuleItemMeta>
                            )}
                          </ModuleItem>
                        );
                      })
                    ) : (
                      <NoModules>
                        {moduleSearch.trim()
                          ? '검색 결과가 없습니다.'
                          : `${modalInfo.division} · ${modalInfo.category}에 해당하는 모듈이 없습니다.`
                        }
                      </NoModules>
                    )
                  )}
                </ModuleListScroll>
              </ModalPanelRight>
            </ModalBody>

            <ModalFooter>
              {modalInfo.readOnly ? (
                <ModalBtn onClick={handleCloseModal}>닫기</ModalBtn>
              ) : (
                <>
                  <ModalBtn onClick={handleCloseModal}>취소</ModalBtn>
                  <ModalBtn $primary onClick={handleSaveModal}>저장</ModalBtn>
                </>
              )}
            </ModalFooter>
          </Modal>
        </Overlay>
      )}
    </Container>
  );
};

export default SPDMDashboardView;
