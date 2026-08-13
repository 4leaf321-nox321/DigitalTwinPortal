import React, { useState } from 'react';
import styled from 'styled-components';
import { X, Plus, Trash2, RotateCcw, Edit3, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { useModuleCategories } from '../contexts/ModuleCategoryContext';

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
`;

const Modal = styled.div`
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
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
  font-size: 1.1rem;
  color: #1e293b;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;

  &:hover {
    background: #e2e8f0;
    color: #1e293b;
  }
`;

const TabBar = styled.div`
  display: flex;
  border-bottom: 1px solid #e2e8f0;
  background: white;
`;

const Tab = styled.button`
  flex: 1;
  padding: 10px 16px;
  border: none;
  background: none;
  font-size: 0.85rem;
  font-weight: 600;
  color: ${props => props.$active ? '#7c3aed' : '#64748b'};
  cursor: pointer;
  position: relative;
  transition: color 0.2s ease;

  &:hover {
    color: ${props => props.$active ? '#7c3aed' : '#475569'};
    background: ${props => props.$active ? 'transparent' : '#f8fafc'};
  }

  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: ${props => props.$active ? '#8b5cf6' : 'transparent'};
    transition: background 0.2s ease;
  }
`;

const ModalBody = styled.div`
  padding: 20px;
  overflow-y: auto;
  flex: 1;
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-bottom: 12px;
`;

const ResetButton = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  background: white;
  color: #64748b;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #f1f5f9;
    color: #374151;
  }
`;

const CategoryList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const CategoryItem = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: white;
`;

const CategoryIndex = styled.span`
  font-size: 0.75rem;
  color: #94a3b8;
  font-weight: 600;
  width: 20px;
  text-align: center;
  flex-shrink: 0;
`;

const CategoryLabel = styled.span`
  flex: 1;
  font-size: 0.875rem;
  color: #1e293b;
  font-weight: 500;
`;

const LabelInput = styled.input`
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #8b5cf6;
  border-radius: 4px;
  font-size: 0.875rem;
  color: #1e293b;
  background: #faf5ff;

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.1);
  }
`;

const IconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  border: none;
  background: none;
  color: #94a3b8;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s ease;
  flex-shrink: 0;

  &:hover {
    background: ${props => props.$danger ? '#fee2e2' : props.$confirm ? '#dcfce7' : '#f1f5f9'};
    color: ${props => props.$danger ? '#ef4444' : props.$confirm ? '#16a34a' : '#475569'};
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
    &:hover {
      background: none;
      color: #94a3b8;
    }
  }
`;

const AddSection = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 12px;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  background: #f8fafc;
`;

const NewLabelInput = styled.input`
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 0.85rem;
  color: #1e293b;

  &:focus {
    outline: none;
    border-color: #8b5cf6;
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.1);
  }

  &::placeholder {
    color: #94a3b8;
  }
`;

const AddButton = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  background: #8b5cf6;
  color: white;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;

  &:hover {
    background: #7c3aed;
  }

  &:disabled {
    background: #94a3b8;
    cursor: not-allowed;
  }
`;

const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
`;

const Button = styled.button`
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  background: #8b5cf6;
  color: white;
  border: none;

  &:hover {
    background: #7c3aed;
  }
`;

const HelpText = styled.p`
  font-size: 0.75rem;
  color: #64748b;
  margin: 8px 0 0 0;
`;

const SystemItemWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: white;
`;

const SystemItemRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const DescriptionInput = styled.input`
  width: 100%;
  padding: 5px 10px;
  margin-left: 30px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 0.8rem;
  color: #475569;
  background: #f8fafc;

  &:focus {
    outline: none;
    border-color: #8b5cf6;
    background: white;
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.1);
  }

  &::placeholder {
    color: #94a3b8;
  }
`;

const TypeToggle = styled.div`
  display: flex;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
`;

const TypeBtn = styled.button`
  padding: 4px 8px;
  border: none;
  font-size: 0.6875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  background: ${props => props.$active ? '#8b5cf6' : 'white'};
  color: ${props => props.$active ? 'white' : '#94a3b8'};

  &:not(:last-child) {
    border-right: 1px solid #e2e8f0;
  }

  &:hover {
    background: ${props => props.$active ? '#8b5cf6' : '#f8fafc'};
  }
`;

// ===== New styled components for expanded category rows =====

const ExpandableWrapper = styled.div`
  border: 1px solid ${props => props.$expanded ? '#c4b5fd' : '#e2e8f0'};
  border-radius: 8px;
  background: white;
  transition: border-color 0.2s ease;
`;

const ExpandableHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  cursor: pointer;
`;

const ExpandToggle = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border: none;
  background: none;
  color: #94a3b8;
  cursor: pointer;
  flex-shrink: 0;
  transition: color 0.2s ease;

  &:hover {
    color: #7c3aed;
  }
`;

const ExpandedContent = styled.div`
  padding: 0 12px 12px 42px;
  border-top: 1px solid #f1f5f9;
`;

const SubSectionTitle = styled.div`
  font-size: 0.75rem;
  font-weight: 600;
  color: #7c3aed;
  margin: 12px 0 8px 0;
`;

const CheckboxGroup = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8rem;
  color: #475569;
  cursor: pointer;
  padding: 4px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  background: ${props => props.$checked ? '#f5f3ff' : 'white'};
  transition: all 0.15s ease;

  &:hover {
    background: #f5f3ff;
    border-color: #c4b5fd;
  }

  input {
    accent-color: #8b5cf6;
  }
`;

const DetailItemRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #fafafa;
  margin-bottom: 6px;
`;

const DetailItemName = styled.span`
  font-size: 0.8rem;
  color: #1e293b;
  font-weight: 500;
  min-width: 80px;
`;

const CriteriaChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  flex: 1;
  align-items: center;
`;

const CriteriaChip = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  font-size: 0.7rem;
  color: #475569;
  background: white;
`;

const CriteriaScore = styled.span`
  font-weight: 600;
  color: #7c3aed;
`;

const CriteriaLabel = styled.span`
  cursor: pointer;
  border-bottom: 1px dashed transparent;

  &:hover {
    border-bottom-color: #7c3aed;
  }
`;

const CriteriaLabelInput = styled.input`
  width: 60px;
  padding: 1px 4px;
  border: 1px solid #8b5cf6;
  border-radius: 3px;
  font-size: 0.7rem;
  color: #1e293b;
  background: #faf5ff;

  &:focus {
    outline: none;
  }
`;

const ChipDeleteBtn = styled.button`
  display: flex;
  align-items: center;
  padding: 0;
  border: none;
  background: none;
  color: #cbd5e1;
  cursor: pointer;
  margin-left: 2px;

  &:hover {
    color: #ef4444;
  }
`;

const AddCriteriaBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 8px;
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
  font-size: 0.7rem;
  color: #94a3b8;
  background: none;
  cursor: pointer;

  &:hover {
    border-color: #8b5cf6;
    color: #7c3aed;
  }
`;

const SmallInput = styled.input`
  flex: 1;
  padding: 4px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 0.8rem;
  color: #1e293b;

  &:focus {
    outline: none;
    border-color: #8b5cf6;
  }

  &::placeholder {
    color: #94a3b8;
  }
`;

const SmallAddButton = styled.button`
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  background: #8b5cf6;
  color: white;
  font-size: 0.75rem;
  cursor: pointer;
  flex-shrink: 0;

  &:hover {
    background: #7c3aed;
  }

  &:disabled {
    background: #94a3b8;
    cursor: not-allowed;
  }
`;

const DetailAddRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
`;

const NoGroupsText = styled.span`
  font-size: 0.75rem;
  color: #94a3b8;
  font-style: italic;
`;

const SettingsModal = ({ isOpen, onClose }) => {
  const {
    categories, addCategory, removeCategory, updateCategory, resetCategories,
    systems, systemDescriptions, addSystem, removeSystem, updateSystem, updateSystemDescription, resetSystems,
    linkMethods, addLinkMethod, removeLinkMethod, updateLinkMethod, updateLinkMethodType, resetLinkMethods,
    groups, addGroup, removeGroup, updateGroup, resetGroups,
    categoryGroups, toggleCategoryGroup,
    categoryDetails, addDetailItem, removeDetailItem, updateDetailItem, updateDetailCriteria,
  } = useModuleCategories();

  const [activeTab, setActiveTab] = useState('group');

  // 그룹 편집 state
  const [newGroup, setNewGroup] = useState('');
  const [editingGroupIndex, setEditingGroupIndex] = useState(null);
  const [editingGroupValue, setEditingGroupValue] = useState('');

  // 모듈 구분 편집 state
  const [newLabel, setNewLabel] = useState('');
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [expandedCategories, setExpandedCategories] = useState({});

  // 세부 항목 추가 state (per category)
  const [newDetailName, setNewDetailName] = useState({});

  // 판단 기준 인라인 편집 state
  const [editingCriteria, setEditingCriteria] = useState(null); // { categoryName, detailId, scoreIndex }
  const [editingCriteriaValue, setEditingCriteriaValue] = useState('');

  // 시스템 편집 state
  const [newSystem, setNewSystem] = useState('');
  const [editingSystemIndex, setEditingSystemIndex] = useState(null);
  const [editingSystemValue, setEditingSystemValue] = useState('');

  // 연계 방식 편집 state
  const [newLinkMethod, setNewLinkMethod] = useState('');
  const [editingLinkMethodIndex, setEditingLinkMethodIndex] = useState(null);
  const [editingLinkMethodValue, setEditingLinkMethodValue] = useState('');

  // --- 그룹 handlers ---
  const handleAddGroup = () => {
    const trimmed = newGroup.trim();
    if (trimmed && !groups.some(g => g.name === trimmed)) {
      addGroup(trimmed);
      setNewGroup('');
    }
  };

  const handleGroupKeyDown = (e) => {
    if (e.key === 'Enter') handleAddGroup();
  };

  const handleStartGroupEdit = (index) => {
    setEditingGroupIndex(index);
    setEditingGroupValue(groups[index].name);
  };

  const handleConfirmGroupEdit = () => {
    if (editingGroupIndex !== null) {
      const trimmed = editingGroupValue.trim();
      if (trimmed && trimmed !== groups[editingGroupIndex].name) {
        updateGroup(groups[editingGroupIndex].id, trimmed);
      }
      setEditingGroupIndex(null);
      setEditingGroupValue('');
    }
  };

  const handleGroupEditKeyDown = (e) => {
    if (e.key === 'Enter') handleConfirmGroupEdit();
    else if (e.key === 'Escape') { setEditingGroupIndex(null); setEditingGroupValue(''); }
  };

  // --- 모듈 구분 handlers ---
  const handleAdd = () => {
    const trimmed = newLabel.trim();
    if (trimmed && !categories.includes(trimmed)) {
      addCategory(trimmed);
      setNewLabel('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAdd();
  };

  const handleStartEdit = (index) => {
    setEditingIndex(index);
    setEditingValue(categories[index]);
    setEditingSystemIndex(null);
  };

  const handleConfirmEdit = () => {
    if (editingIndex !== null) {
      const trimmed = editingValue.trim();
      if (trimmed && trimmed !== categories[editingIndex]) {
        updateCategory(categories[editingIndex], trimmed);
      }
      setEditingIndex(null);
      setEditingValue('');
    }
  };

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter') handleConfirmEdit();
    else if (e.key === 'Escape') { setEditingIndex(null); setEditingValue(''); }
  };

  const toggleExpand = (category) => {
    setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  // --- 세부 항목 handlers ---
  const handleAddDetail = (categoryName) => {
    const name = (newDetailName[categoryName] || '').trim();
    if (name) {
      addDetailItem(categoryName, name);
      setNewDetailName(prev => ({ ...prev, [categoryName]: '' }));
    }
  };

  const handleDetailKeyDown = (e, categoryName) => {
    if (e.key === 'Enter') handleAddDetail(categoryName);
  };

  // --- 세부 항목 타입 변경 handler ---
  const handleToggleDetailType = (categoryName, detailId, newType) => {
    updateDetailItem(categoryName, detailId, { type: newType, criteria: [] });
  };

  // --- 판단 기준 handlers ---
  const handleAddCriteria = (categoryName, detailId) => {
    const items = categoryDetails[categoryName] || [];
    const item = items.find(d => d.id === detailId);
    if (!item) return;
    const isChecklist = item.type === 'checklist';
    const next = isChecklist
      ? [...item.criteria, { label: '' }]
      : [...item.criteria, { score: item.criteria.length, label: '' }];
    updateDetailCriteria(categoryName, detailId, next);
    setEditingCriteria({ categoryName, detailId, scoreIndex: next.length - 1 });
    setEditingCriteriaValue('');
  };

  const handleRemoveCriteria = (categoryName, detailId, scoreIndex) => {
    const items = categoryDetails[categoryName] || [];
    const item = items.find(d => d.id === detailId);
    if (!item) return;
    const isChecklist = item.type === 'checklist';
    const next = item.criteria
      .filter((_, i) => i !== scoreIndex)
      .map((c, i) => isChecklist ? c : { ...c, score: i });
    updateDetailCriteria(categoryName, detailId, next);
  };

  const handleStartCriteriaEdit = (categoryName, detailId, scoreIndex, currentLabel) => {
    setEditingCriteria({ categoryName, detailId, scoreIndex });
    setEditingCriteriaValue(currentLabel);
  };

  const handleConfirmCriteriaEdit = () => {
    if (!editingCriteria) return;
    const { categoryName, detailId, scoreIndex } = editingCriteria;
    const items = categoryDetails[categoryName] || [];
    const item = items.find(d => d.id === detailId);
    if (!item) return;
    const next = item.criteria.map((c, i) =>
      i === scoreIndex ? { ...c, label: editingCriteriaValue.trim() } : c
    );
    updateDetailCriteria(categoryName, detailId, next);
    setEditingCriteria(null);
    setEditingCriteriaValue('');
  };

  const handleCriteriaEditKeyDown = (e) => {
    if (e.key === 'Enter') handleConfirmCriteriaEdit();
    else if (e.key === 'Escape') { setEditingCriteria(null); setEditingCriteriaValue(''); }
  };

  // --- 시스템 handlers ---
  const handleAddSystem = () => {
    const trimmed = newSystem.trim();
    if (trimmed && !systems.includes(trimmed)) {
      addSystem(trimmed);
      setNewSystem('');
    }
  };

  const handleSystemKeyDown = (e) => {
    if (e.key === 'Enter') handleAddSystem();
  };

  const handleStartSystemEdit = (index) => {
    setEditingSystemIndex(index);
    setEditingSystemValue(systems[index]);
    setEditingIndex(null);
  };

  const handleConfirmSystemEdit = () => {
    if (editingSystemIndex !== null) {
      const trimmed = editingSystemValue.trim();
      if (trimmed && trimmed !== systems[editingSystemIndex]) {
        updateSystem(systems[editingSystemIndex], trimmed);
      }
      setEditingSystemIndex(null);
      setEditingSystemValue('');
    }
  };

  const handleSystemEditKeyDown = (e) => {
    if (e.key === 'Enter') handleConfirmSystemEdit();
    else if (e.key === 'Escape') { setEditingSystemIndex(null); setEditingSystemValue(''); }
  };

  // --- 연계 방식 handlers ---
  const linkMethodLabels = linkMethods.map(m => m.label);

  const handleAddLinkMethod = () => {
    const trimmed = newLinkMethod.trim();
    if (trimmed && !linkMethodLabels.includes(trimmed)) {
      addLinkMethod(trimmed, 'non-system');
      setNewLinkMethod('');
    }
  };

  const handleLinkMethodKeyDown = (e) => {
    if (e.key === 'Enter') handleAddLinkMethod();
  };

  const handleStartLinkMethodEdit = (index) => {
    setEditingLinkMethodIndex(index);
    setEditingLinkMethodValue(linkMethods[index].label);
    setEditingIndex(null);
    setEditingSystemIndex(null);
  };

  const handleConfirmLinkMethodEdit = () => {
    if (editingLinkMethodIndex !== null) {
      const trimmed = editingLinkMethodValue.trim();
      if (trimmed && trimmed !== linkMethods[editingLinkMethodIndex].label) {
        updateLinkMethod(linkMethods[editingLinkMethodIndex].label, trimmed);
      }
      setEditingLinkMethodIndex(null);
      setEditingLinkMethodValue('');
    }
  };

  const handleLinkMethodEditKeyDown = (e) => {
    if (e.key === 'Enter') handleConfirmLinkMethodEdit();
    else if (e.key === 'Escape') { setEditingLinkMethodIndex(null); setEditingLinkMethodValue(''); }
  };

  const isDuplicate = newLabel.trim() && categories.includes(newLabel.trim());
  const isSystemDuplicate = newSystem.trim() && systems.includes(newSystem.trim());
  const isLinkMethodDuplicate = newLinkMethod.trim() && linkMethodLabels.includes(newLinkMethod.trim());
  const isGroupDuplicate = newGroup.trim() && groups.some(g => g.name === newGroup.trim());

  if (!isOpen) return null;

  const renderGroupTab = () => (
    <>
      <SectionHeader>
        <ResetButton onClick={resetGroups}>
          <RotateCcw size={12} />
          초기화
        </ResetButton>
      </SectionHeader>

      <CategoryList>
        {groups.map((group, index) => (
          <CategoryItem key={group.id}>
            <CategoryIndex>{index + 1}</CategoryIndex>
            {editingGroupIndex === index ? (
              <>
                <LabelInput
                  type="text"
                  value={editingGroupValue}
                  onChange={(e) => setEditingGroupValue(e.target.value)}
                  onKeyDown={handleGroupEditKeyDown}
                  autoFocus
                />
                <IconButton $confirm onClick={handleConfirmGroupEdit} title="확인">
                  <Check size={16} />
                </IconButton>
                <IconButton onClick={() => { setEditingGroupIndex(null); setEditingGroupValue(''); }} title="취소">
                  <X size={16} />
                </IconButton>
              </>
            ) : (
              <>
                <CategoryLabel>{group.name}</CategoryLabel>
                <IconButton onClick={() => handleStartGroupEdit(index)} title="수정">
                  <Edit3 size={14} />
                </IconButton>
                <IconButton
                  $danger
                  onClick={() => removeGroup(group.id)}
                  title="삭제"
                >
                  <Trash2 size={14} />
                </IconButton>
              </>
            )}
          </CategoryItem>
        ))}
      </CategoryList>

      <AddSection>
        <NewLabelInput
          type="text"
          value={newGroup}
          onChange={(e) => setNewGroup(e.target.value)}
          onKeyDown={handleGroupKeyDown}
          placeholder="새 그룹 이름 입력"
        />
        <AddButton
          onClick={handleAddGroup}
          disabled={!newGroup.trim() || isGroupDuplicate}
        >
          <Plus size={14} />
          추가
        </AddButton>
      </AddSection>

      <HelpText>
        {isGroupDuplicate
          ? '이미 존재하는 그룹입니다.'
          : '모듈 구분에 연결할 수 있는 그룹을 정의합니다.'}
      </HelpText>
    </>
  );

  const renderCategoryTab = () => (
    <>
      <SectionHeader>
        <ResetButton onClick={resetCategories}>
          <RotateCcw size={12} />
          기본값으로 복원
        </ResetButton>
      </SectionHeader>

      <CategoryList>
        {categories.map((category, index) => {
          const isExpanded = expandedCategories[category];
          const linkedGroups = categoryGroups[category] || [];
          const details = categoryDetails[category] || [];

          return (
            <ExpandableWrapper key={`cat-${category}-${index}`} $expanded={isExpanded}>
              <ExpandableHeader>
                <ExpandToggle onClick={() => toggleExpand(category)}>
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </ExpandToggle>
                <CategoryIndex>{index + 1}</CategoryIndex>
                {editingIndex === index ? (
                  <>
                    <LabelInput
                      type="text"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onKeyDown={handleEditKeyDown}
                      autoFocus
                    />
                    <IconButton $confirm onClick={handleConfirmEdit} title="확인">
                      <Check size={16} />
                    </IconButton>
                    <IconButton onClick={() => { setEditingIndex(null); setEditingValue(''); }} title="취소">
                      <X size={16} />
                    </IconButton>
                  </>
                ) : (
                  <>
                    <CategoryLabel>{category}</CategoryLabel>
                    <IconButton onClick={() => handleStartEdit(index)} title="수정">
                      <Edit3 size={14} />
                    </IconButton>
                    <IconButton
                      $danger
                      onClick={() => removeCategory(category)}
                      disabled={categories.length <= 1}
                      title={categories.length <= 1 ? '최소 1개의 항목이 필요합니다' : '삭제'}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </>
                )}
              </ExpandableHeader>

              {isExpanded && (
                <ExpandedContent>
                  {/* 연결된 그룹 */}
                  <SubSectionTitle>연결된 그룹</SubSectionTitle>
                  {groups.length > 0 ? (
                    <CheckboxGroup>
                      {groups.map(group => (
                        <CheckboxLabel key={group.id} $checked={linkedGroups.includes(group.id)}>
                          <input
                            type="checkbox"
                            checked={linkedGroups.includes(group.id)}
                            onChange={() => toggleCategoryGroup(category, group.id)}
                          />
                          {group.name}
                        </CheckboxLabel>
                      ))}
                    </CheckboxGroup>
                  ) : (
                    <NoGroupsText>그룹 정의 탭에서 먼저 그룹을 추가해주세요.</NoGroupsText>
                  )}

                  {/* 세부 항목 */}
                  <SubSectionTitle>세부 항목</SubSectionTitle>
                  {details.map(detail => {
                    const isChecklist = detail.type === 'checklist';
                    return (
                      <DetailItemRow key={detail.id}>
                        <DetailItemName>{detail.name}</DetailItemName>
                        <TypeToggle>
                          <TypeBtn
                            type="button"
                            $active={!isChecklist}
                            onClick={() => isChecklist && handleToggleDetailType(category, detail.id, 'score')}
                          >
                            점수 선택
                          </TypeBtn>
                          <TypeBtn
                            type="button"
                            $active={isChecklist}
                            onClick={() => !isChecklist && handleToggleDetailType(category, detail.id, 'checklist')}
                          >
                            체크리스트
                          </TypeBtn>
                        </TypeToggle>
                        <CriteriaChips>
                          {detail.criteria.map((c, ci) => (
                            <CriteriaChip key={ci}>
                              {!isChecklist && <CriteriaScore>{c.score}점:</CriteriaScore>}
                              {editingCriteria &&
                                editingCriteria.categoryName === category &&
                                editingCriteria.detailId === detail.id &&
                                editingCriteria.scoreIndex === ci ? (
                                <CriteriaLabelInput
                                  type="text"
                                  value={editingCriteriaValue}
                                  onChange={(e) => setEditingCriteriaValue(e.target.value)}
                                  onKeyDown={handleCriteriaEditKeyDown}
                                  onBlur={handleConfirmCriteriaEdit}
                                  autoFocus
                                />
                              ) : (
                                <CriteriaLabel
                                  onClick={() => handleStartCriteriaEdit(category, detail.id, ci, c.label)}
                                >
                                  {c.label || '(라벨 입력)'}
                                </CriteriaLabel>
                              )}
                              <ChipDeleteBtn
                                onClick={() => handleRemoveCriteria(category, detail.id, ci)}
                                title="기준 삭제"
                              >
                                <X size={10} />
                              </ChipDeleteBtn>
                            </CriteriaChip>
                          ))}
                          <AddCriteriaBtn onClick={() => handleAddCriteria(category, detail.id)}>
                            <Plus size={10} />
                            {isChecklist ? '항목 추가' : '기준 추가'}
                          </AddCriteriaBtn>
                        </CriteriaChips>
                        <IconButton
                          $danger
                          onClick={() => removeDetailItem(category, detail.id)}
                          title="세부 항목 삭제"
                        >
                          <Trash2 size={12} />
                        </IconButton>
                      </DetailItemRow>
                    );
                  })}

                  <DetailAddRow>
                    <SmallInput
                      type="text"
                      value={newDetailName[category] || ''}
                      onChange={(e) => setNewDetailName(prev => ({ ...prev, [category]: e.target.value }))}
                      onKeyDown={(e) => handleDetailKeyDown(e, category)}
                      placeholder="새 세부 항목 이름"
                    />
                    <SmallAddButton
                      onClick={() => handleAddDetail(category)}
                      disabled={!(newDetailName[category] || '').trim()}
                    >
                      <Plus size={12} />
                      추가
                    </SmallAddButton>
                  </DetailAddRow>
                </ExpandedContent>
              )}
            </ExpandableWrapper>
          );
        })}
      </CategoryList>

      <AddSection>
        <NewLabelInput
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="새 구분 항목 입력"
        />
        <AddButton
          onClick={handleAdd}
          disabled={!newLabel.trim() || isDuplicate}
        >
          <Plus size={14} />
          추가
        </AddButton>
      </AddSection>

      <HelpText>
        {isDuplicate
          ? '이미 존재하는 항목입니다.'
          : '모듈 추가/수정 시 선택할 수 있는 구분 항목을 관리합니다. 항목을 펼쳐 그룹 연결 및 세부 항목을 설정할 수 있습니다.'}
      </HelpText>
    </>
  );

  return (
    <Overlay onClick={onClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>설정</ModalTitle>
          <CloseButton onClick={onClose}>
            <X size={20} />
          </CloseButton>
        </ModalHeader>

        <TabBar>
          <Tab $active={activeTab === 'group'} onClick={() => setActiveTab('group')}>
            그룹 정의
          </Tab>
          <Tab $active={activeTab === 'category'} onClick={() => setActiveTab('category')}>
            모듈 구분
          </Tab>
          <Tab $active={activeTab === 'system'} onClick={() => setActiveTab('system')}>
            구현 시스템
          </Tab>
          <Tab $active={activeTab === 'linkMethod'} onClick={() => setActiveTab('linkMethod')}>
            연계 방식
          </Tab>
        </TabBar>

        <ModalBody>
          {activeTab === 'group' ? renderGroupTab()
          : activeTab === 'category' ? renderCategoryTab()
          : activeTab === 'system' ? (
            <>
              <SectionHeader>
                <ResetButton onClick={resetSystems}>
                  <RotateCcw size={12} />
                  기본값으로 복원
                </ResetButton>
              </SectionHeader>

              <CategoryList>
                {systems.map((system, index) => (
                  <SystemItemWrapper key={`sys-${system}-${index}`}>
                    <SystemItemRow>
                      <CategoryIndex>{index + 1}</CategoryIndex>
                      {editingSystemIndex === index ? (
                        <>
                          <LabelInput
                            type="text"
                            value={editingSystemValue}
                            onChange={(e) => setEditingSystemValue(e.target.value)}
                            onKeyDown={handleSystemEditKeyDown}
                            autoFocus
                          />
                          <IconButton $confirm onClick={handleConfirmSystemEdit} title="확인">
                            <Check size={16} />
                          </IconButton>
                          <IconButton onClick={() => { setEditingSystemIndex(null); setEditingSystemValue(''); }} title="취소">
                            <X size={16} />
                          </IconButton>
                        </>
                      ) : (
                        <>
                          <CategoryLabel>{system}</CategoryLabel>
                          <IconButton onClick={() => handleStartSystemEdit(index)} title="수정">
                            <Edit3 size={14} />
                          </IconButton>
                          <IconButton
                            $danger
                            onClick={() => removeSystem(system)}
                            disabled={systems.length <= 1}
                            title={systems.length <= 1 ? '최소 1개의 항목이 필요합니다' : '삭제'}
                          >
                            <Trash2 size={14} />
                          </IconButton>
                        </>
                      )}
                    </SystemItemRow>
                    {editingSystemIndex !== index && (
                      <DescriptionInput
                        type="text"
                        value={systemDescriptions[system] || ''}
                        onChange={(e) => updateSystemDescription(system, e.target.value)}
                        placeholder="시스템 설명 입력"
                      />
                    )}
                  </SystemItemWrapper>
                ))}
              </CategoryList>

              <AddSection>
                <NewLabelInput
                  type="text"
                  value={newSystem}
                  onChange={(e) => setNewSystem(e.target.value)}
                  onKeyDown={handleSystemKeyDown}
                  placeholder="새 시스템 이름 입력"
                />
                <AddButton
                  onClick={handleAddSystem}
                  disabled={!newSystem.trim() || isSystemDuplicate}
                >
                  <Plus size={14} />
                  추가
                </AddButton>
              </AddSection>

              <HelpText>
                {isSystemDuplicate
                  ? '이미 존재하는 항목입니다.'
                  : '모듈이 구현된 시스템을 선택할 수 있는 목록을 관리합니다.'}
              </HelpText>
            </>
          ) : activeTab === 'linkMethod' ? (
            <>
              <SectionHeader>
                <ResetButton onClick={resetLinkMethods}>
                  <RotateCcw size={12} />
                  기본값으로 복원
                </ResetButton>
              </SectionHeader>

              <CategoryList>
                {linkMethods.map((method, index) => (
                  <CategoryItem key={`lm-${method.label}-${index}`}>
                    <CategoryIndex>{index + 1}</CategoryIndex>
                    {editingLinkMethodIndex === index ? (
                      <>
                        <LabelInput
                          type="text"
                          value={editingLinkMethodValue}
                          onChange={(e) => setEditingLinkMethodValue(e.target.value)}
                          onKeyDown={handleLinkMethodEditKeyDown}
                          autoFocus
                        />
                        <IconButton $confirm onClick={handleConfirmLinkMethodEdit} title="확인">
                          <Check size={16} />
                        </IconButton>
                        <IconButton onClick={() => { setEditingLinkMethodIndex(null); setEditingLinkMethodValue(''); }} title="취소">
                          <X size={16} />
                        </IconButton>
                      </>
                    ) : (
                      <>
                        <CategoryLabel>{method.label}</CategoryLabel>
                        <TypeToggle>
                          <TypeBtn
                            type="button"
                            $active={method.type === 'system'}
                            onClick={() => updateLinkMethodType(method.label, 'system')}
                          >
                            시스템
                          </TypeBtn>
                          <TypeBtn
                            type="button"
                            $active={method.type === 'non-system'}
                            onClick={() => updateLinkMethodType(method.label, 'non-system')}
                          >
                            비시스템
                          </TypeBtn>
                        </TypeToggle>
                        <IconButton onClick={() => handleStartLinkMethodEdit(index)} title="수정">
                          <Edit3 size={14} />
                        </IconButton>
                        <IconButton
                          $danger
                          onClick={() => removeLinkMethod(method.label)}
                          disabled={linkMethods.length <= 1}
                          title={linkMethods.length <= 1 ? '최소 1개의 항목이 필요합니다' : '삭제'}
                        >
                          <Trash2 size={14} />
                        </IconButton>
                      </>
                    )}
                  </CategoryItem>
                ))}
              </CategoryList>

              <AddSection>
                <NewLabelInput
                  type="text"
                  value={newLinkMethod}
                  onChange={(e) => setNewLinkMethod(e.target.value)}
                  onKeyDown={handleLinkMethodKeyDown}
                  placeholder="새 연계 방식 입력"
                />
                <AddButton
                  onClick={handleAddLinkMethod}
                  disabled={!newLinkMethod.trim() || isLinkMethodDuplicate}
                >
                  <Plus size={14} />
                  추가
                </AddButton>
              </AddSection>

              <HelpText>
                {isLinkMethodDuplicate
                  ? '이미 존재하는 항목입니다.'
                  : '연계 모듈의 연계 방식을 선택할 수 있는 목록을 관리합니다.'}
              </HelpText>
            </>
          ) : null}
        </ModalBody>

        <ModalFooter>
          <Button onClick={onClose}>
            닫기
          </Button>
        </ModalFooter>
      </Modal>
    </Overlay>
  );
};

export default SettingsModal;
