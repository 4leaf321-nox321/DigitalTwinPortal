import React, { useState, useMemo } from 'react';
import styled from 'styled-components';
import { X, Plus, Trash2, RotateCcw, Edit3, Check } from 'lucide-react';

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
  color: ${props => props.$active ? '#0891b2' : '#64748b'};
  cursor: pointer;
  position: relative;
  transition: color 0.2s ease;

  &:hover {
    color: ${props => props.$active ? '#0891b2' : '#475569'};
    background: ${props => props.$active ? 'transparent' : '#f8fafc'};
  }

  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: ${props => props.$active ? '#06b6d4' : 'transparent'};
    transition: background 0.2s ease;
  }
`;

const ModalBody = styled.div`
  padding: 20px;
  overflow-y: auto;
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

const ItemList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Item = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: white;
`;

const ItemIndex = styled.span`
  font-size: 0.75rem;
  color: #94a3b8;
  font-weight: 600;
  width: 20px;
  text-align: center;
  flex-shrink: 0;
`;

const ItemLabel = styled.span`
  flex: 1;
  font-size: 0.875rem;
  color: #1e293b;
  font-weight: 500;
`;

const LabelInput = styled.input`
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #06b6d4;
  border-radius: 4px;
  font-size: 0.875rem;
  color: #1e293b;
  background: #ecfeff;

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.1);
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

const NewInput = styled.input`
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 0.85rem;
  color: #1e293b;

  &:focus {
    outline: none;
    border-color: #06b6d4;
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.1);
  }

  &::placeholder {
    color: #94a3b8;
  }
`;

const NewSelect = styled.select`
  padding: 6px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 0.85rem;
  color: #1e293b;
  background: white;
  min-width: 100px;

  &:focus {
    outline: none;
    border-color: #06b6d4;
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.1);
  }
`;

const AddButton = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  background: #06b6d4;
  color: white;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;

  &:hover {
    background: #0891b2;
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
  background: #06b6d4;
  color: white;
  border: none;

  &:hover {
    background: #0891b2;
  }
`;

const HelpText = styled.p`
  font-size: 0.75rem;
  color: #64748b;
  margin: 8px 0 0 0;
`;

const DivisionBadge = styled.span`
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 4px;
  background: #f1f5f9;
  color: #64748b;
  flex-shrink: 0;
`;

const ItemSelect = styled.select`
  padding: 4px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 0.8rem;
  color: #1e293b;
  background: white;
  flex-shrink: 0;

  &:focus {
    outline: none;
    border-color: #06b6d4;
  }
`;

const ClassInput = styled.input`
  padding: 5px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 0.8rem;
  color: #1e293b;
  width: 120px;
  &:focus { outline: none; border-color: #06b6d4; }
`;

const ClassBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 10px;
  background: #f0f9ff;
  color: #0369a1;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid #bae6fd;
  &:hover { background: #e0f2fe; }
`;

const ClassItemRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: white;
  margin-bottom: 4px;
`;

const ClassItemName = styled.span`
  flex: 1;
  font-size: 0.85rem;
  color: #1e293b;
  font-weight: 500;
`;

const ClassSuggestions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
  margin-bottom: 12px;
`;

const ClassCategorySection = styled.div`
  margin-bottom: 16px;
`;

const ClassCategoryTitle = styled.div`
  font-size: 0.8rem;
  font-weight: 700;
  color: #0e7490;
  margin-bottom: 8px;
  padding: 4px 0;
  border-bottom: 1px solid #e0f2fe;
`;

const DEFAULT_CATEGORIES = ['시뮬레이션', '검증 자동화', '설계 자동화'];
const DEFAULT_STATUSES = ['완료', '진행', '계획'];

const SettingsModal = ({ isOpen, onClose, categories, statuses, productFamilies = [], divisions = [], onSave, tasks = [], roadmapConfig, onSaveRoadmapConfig }) => {
  const [activeTab, setActiveTab] = useState('category');

  const [localCategories, setLocalCategories] = useState([]);
  const [localStatuses, setLocalStatuses] = useState([]);
  const [localProductFamilies, setLocalProductFamilies] = useState([]);
  const [localItemClassification, setLocalItemClassification] = useState({});

  // Category edit state
  const [newCat, setNewCat] = useState('');
  const [editingCatIdx, setEditingCatIdx] = useState(null);
  const [editingCatVal, setEditingCatVal] = useState('');

  // Status edit state
  const [newStatus, setNewStatus] = useState('');
  const [editingStatusIdx, setEditingStatusIdx] = useState(null);
  const [editingStatusVal, setEditingStatusVal] = useState('');

  // Product family add state
  const [newPFName, setNewPFName] = useState('');
  const [newPFDivision, setNewPFDivision] = useState('');
  const [editingPFIdx, setEditingPFIdx] = useState(null);
  const [editingPFName, setEditingPFName] = useState('');
  const [editingPFDivision, setEditingPFDivision] = useState('');

  // 구분별 항목 목록 (분류 탭용)
  const itemsByCategory = useMemo(() => {
    const map = {};
    (tasks || []).forEach(t => {
      const cat = t.category || '미분류';
      const item = t.testItem;
      if (!item) return;
      if (!map[cat]) map[cat] = new Set();
      map[cat].add(item);
    });
    const result = {};
    Object.keys(map).forEach(cat => {
      result[cat] = [...map[cat]].sort();
    });
    return result;
  }, [tasks]);

  // 기존 분류값에서 고유 분류 추천 목록
  const classificationSuggestions = useMemo(() => {
    const set = new Set();
    Object.values(localItemClassification).forEach(v => {
      if (v && v.trim()) set.add(v.trim());
    });
    return [...set].sort();
  }, [localItemClassification]);

  React.useEffect(() => {
    if (isOpen) {
      setLocalCategories([...categories]);
      setLocalStatuses([...statuses]);
      setLocalProductFamilies(productFamilies.map(pf => ({ ...pf })));
      setLocalItemClassification(roadmapConfig?.itemClassification || {});
      setNewCat('');
      setNewStatus('');
      setNewPFName('');
      setNewPFDivision('');
      setEditingCatIdx(null);
      setEditingStatusIdx(null);
      setEditingPFIdx(null);
    }
  }, [isOpen, categories, statuses, productFamilies, roadmapConfig]);

  // --- Category handlers ---
  const handleAddCat = () => {
    const trimmed = newCat.trim();
    if (trimmed && !localCategories.includes(trimmed)) {
      setLocalCategories(prev => [...prev, trimmed]);
      setNewCat('');
    }
  };

  const handleStartCatEdit = (idx) => {
    setEditingCatIdx(idx);
    setEditingCatVal(localCategories[idx]);
    setEditingStatusIdx(null);
    setEditingPFIdx(null);
  };

  const handleConfirmCatEdit = () => {
    if (editingCatIdx !== null) {
      const trimmed = editingCatVal.trim();
      if (trimmed && trimmed !== localCategories[editingCatIdx]) {
        setLocalCategories(prev => prev.map((c, i) => i === editingCatIdx ? trimmed : c));
      }
      setEditingCatIdx(null);
      setEditingCatVal('');
    }
  };

  const handleRemoveCat = (idx) => {
    setLocalCategories(prev => prev.filter((_, i) => i !== idx));
  };

  // --- Status handlers ---
  const handleAddStatus = () => {
    const trimmed = newStatus.trim();
    if (trimmed && !localStatuses.includes(trimmed)) {
      setLocalStatuses(prev => [...prev, trimmed]);
      setNewStatus('');
    }
  };

  const handleStartStatusEdit = (idx) => {
    setEditingStatusIdx(idx);
    setEditingStatusVal(localStatuses[idx]);
    setEditingCatIdx(null);
    setEditingPFIdx(null);
  };

  const handleConfirmStatusEdit = () => {
    if (editingStatusIdx !== null) {
      const trimmed = editingStatusVal.trim();
      if (trimmed && trimmed !== localStatuses[editingStatusIdx]) {
        setLocalStatuses(prev => prev.map((s, i) => i === editingStatusIdx ? trimmed : s));
      }
      setEditingStatusIdx(null);
      setEditingStatusVal('');
    }
  };

  const handleRemoveStatus = (idx) => {
    setLocalStatuses(prev => prev.filter((_, i) => i !== idx));
  };

  // --- Product Family handlers ---
  const handleAddPF = () => {
    const trimmed = newPFName.trim();
    if (trimmed && !localProductFamilies.some(pf => pf.name === trimmed)) {
      setLocalProductFamilies(prev => [...prev, { name: trimmed, divisionId: newPFDivision }]);
      setNewPFName('');
      setNewPFDivision('');
    }
  };

  const handleStartPFEdit = (idx) => {
    setEditingPFIdx(idx);
    setEditingPFName(localProductFamilies[idx].name);
    setEditingPFDivision(localProductFamilies[idx].divisionId || '');
    setEditingCatIdx(null);
    setEditingStatusIdx(null);
  };

  const handleConfirmPFEdit = () => {
    if (editingPFIdx !== null) {
      const trimmed = editingPFName.trim();
      if (trimmed) {
        setLocalProductFamilies(prev => prev.map((pf, i) =>
          i === editingPFIdx ? { name: trimmed, divisionId: editingPFDivision } : pf
        ));
      }
      setEditingPFIdx(null);
      setEditingPFName('');
      setEditingPFDivision('');
    }
  };

  const handleRemovePF = (idx) => {
    setLocalProductFamilies(prev => prev.filter((_, i) => i !== idx));
  };

  const handlePFDivisionChange = (idx, divisionId) => {
    setLocalProductFamilies(prev => prev.map((pf, i) =>
      i === idx ? { ...pf, divisionId } : pf
    ));
  };

  const handleSave = () => {
    onSave({ categories: localCategories, statuses: localStatuses, productFamilies: localProductFamilies });
    // 항목 분류가 변경되었으면 roadmapConfig에도 저장
    if (onSaveRoadmapConfig) {
      const currentClassification = roadmapConfig?.itemClassification || {};
      const changed = JSON.stringify(currentClassification) !== JSON.stringify(localItemClassification);
      if (changed) {
        onSaveRoadmapConfig({ ...roadmapConfig, itemClassification: localItemClassification });
      }
    }
  };

  const getDivisionName = (divisionId) => {
    if (!divisionId) return '미지정';
    const div = divisions.find(d => d.id === divisionId);
    return div ? div.name : divisionId;
  };

  const isCatDuplicate = newCat.trim() && localCategories.includes(newCat.trim());
  const isStatusDuplicate = newStatus.trim() && localStatuses.includes(newStatus.trim());
  const isPFDuplicate = newPFName.trim() && localProductFamilies.some(pf => pf.name === newPFName.trim());

  if (!isOpen) return null;

  const renderList = (items, {
    editingIdx, editingVal, setEditingVal,
    onStartEdit, onConfirmEdit, onCancelEdit, onRemove,
    newValue, setNewValue, onAdd, isDuplicate, placeholder, helpDefault, resetFn
  }) => (
    <>
      {resetFn && (
        <SectionHeader>
          <ResetButton onClick={resetFn}>
            <RotateCcw size={12} />
            기본값으로 복원
          </ResetButton>
        </SectionHeader>
      )}

      <ItemList>
        {items.map((item, index) => (
          <Item key={`${item}-${index}`}>
            <ItemIndex>{index + 1}</ItemIndex>
            {editingIdx === index ? (
              <>
                <LabelInput
                  type="text"
                  value={editingVal}
                  onChange={(e) => setEditingVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onConfirmEdit();
                    else if (e.key === 'Escape') onCancelEdit();
                  }}
                  autoFocus
                />
                <IconButton $confirm onClick={onConfirmEdit} title="확인">
                  <Check size={16} />
                </IconButton>
                <IconButton onClick={onCancelEdit} title="취소">
                  <X size={16} />
                </IconButton>
              </>
            ) : (
              <>
                <ItemLabel>{item}</ItemLabel>
                <IconButton onClick={() => onStartEdit(index)} title="수정">
                  <Edit3 size={14} />
                </IconButton>
                <IconButton
                  $danger
                  onClick={() => onRemove(index)}
                  disabled={items.length <= 1}
                  title={items.length <= 1 ? '최소 1개의 항목이 필요합니다' : '삭제'}
                >
                  <Trash2 size={14} />
                </IconButton>
              </>
            )}
          </Item>
        ))}
      </ItemList>

      <AddSection>
        <NewInput
          type="text"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onAdd(); }}
          placeholder={placeholder}
        />
        <AddButton onClick={onAdd} disabled={!newValue.trim() || isDuplicate}>
          <Plus size={14} />
          추가
        </AddButton>
      </AddSection>

      <HelpText>
        {isDuplicate ? '이미 존재하는 항목입니다.' : helpDefault}
      </HelpText>
    </>
  );

  const renderProductFamilyTab = () => (
    <>
      <ItemList>
        {localProductFamilies.map((pf, index) => (
          <Item key={`${pf.name}-${index}`}>
            <ItemIndex>{index + 1}</ItemIndex>
            {editingPFIdx === index ? (
              <>
                <LabelInput
                  type="text"
                  value={editingPFName}
                  onChange={(e) => setEditingPFName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmPFEdit();
                    else if (e.key === 'Escape') { setEditingPFIdx(null); setEditingPFName(''); setEditingPFDivision(''); }
                  }}
                  autoFocus
                />
                <ItemSelect
                  value={editingPFDivision}
                  onChange={(e) => setEditingPFDivision(e.target.value)}
                >
                  <option value="">사업부 선택</option>
                  {divisions.map(div => (
                    <option key={div.id} value={div.id}>{div.name}</option>
                  ))}
                </ItemSelect>
                <IconButton $confirm onClick={handleConfirmPFEdit} title="확인">
                  <Check size={16} />
                </IconButton>
                <IconButton onClick={() => { setEditingPFIdx(null); setEditingPFName(''); setEditingPFDivision(''); }} title="취소">
                  <X size={16} />
                </IconButton>
              </>
            ) : (
              <>
                <ItemLabel>{pf.name}</ItemLabel>
                <DivisionBadge>{getDivisionName(pf.divisionId)}</DivisionBadge>
                <ItemSelect
                  value={pf.divisionId || ''}
                  onChange={(e) => handlePFDivisionChange(index, e.target.value)}
                >
                  <option value="">사업부 선택</option>
                  {divisions.map(div => (
                    <option key={div.id} value={div.id}>{div.name}</option>
                  ))}
                </ItemSelect>
                <IconButton onClick={() => handleStartPFEdit(index)} title="수정">
                  <Edit3 size={14} />
                </IconButton>
                <IconButton
                  $danger
                  onClick={() => handleRemovePF(index)}
                  title="삭제"
                >
                  <Trash2 size={14} />
                </IconButton>
              </>
            )}
          </Item>
        ))}
        {localProductFamilies.length === 0 && (
          <HelpText style={{ textAlign: 'center', padding: '20px 0' }}>
            등록된 제품군이 없습니다. 아래에서 추가하세요.
          </HelpText>
        )}
      </ItemList>

      <AddSection>
        <NewInput
          type="text"
          value={newPFName}
          onChange={(e) => setNewPFName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAddPF(); }}
          placeholder="새 제품군 이름"
        />
        <NewSelect
          value={newPFDivision}
          onChange={(e) => setNewPFDivision(e.target.value)}
        >
          <option value="">사업부 선택</option>
          {divisions.map(div => (
            <option key={div.id} value={div.id}>{div.name}</option>
          ))}
        </NewSelect>
        <AddButton onClick={handleAddPF} disabled={!newPFName.trim() || isPFDuplicate}>
          <Plus size={14} />
          추가
        </AddButton>
      </AddSection>

      <HelpText>
        {isPFDuplicate ? '이미 존재하는 제품군입니다.' : '각 제품군에 소속 사업부를 지정할 수 있습니다.'}
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
          <Tab $active={activeTab === 'category'} onClick={() => setActiveTab('category')}>
            구분
          </Tab>
          <Tab $active={activeTab === 'status'} onClick={() => setActiveTab('status')}>
            상태
          </Tab>
          <Tab $active={activeTab === 'productFamily'} onClick={() => setActiveTab('productFamily')}>
            적용 제품군
          </Tab>
          <Tab $active={activeTab === 'classify'} onClick={() => setActiveTab('classify')}>
            항목 분류
          </Tab>
        </TabBar>

        <ModalBody>
          {activeTab === 'category'
            ? renderList(localCategories, {
                editingIdx: editingCatIdx,
                editingVal: editingCatVal,
                setEditingVal: setEditingCatVal,
                onStartEdit: handleStartCatEdit,
                onConfirmEdit: handleConfirmCatEdit,
                onCancelEdit: () => { setEditingCatIdx(null); setEditingCatVal(''); },
                onRemove: handleRemoveCat,
                newValue: newCat,
                setNewValue: setNewCat,
                onAdd: handleAddCat,
                isDuplicate: isCatDuplicate,
                placeholder: '새 구분 항목 입력',
                helpDefault: '과제 추가/수정 시 선택할 수 있는 구분 항목을 관리합니다.',
                resetFn: () => setLocalCategories([...DEFAULT_CATEGORIES]),
              })
            : activeTab === 'status'
            ? renderList(localStatuses, {
                editingIdx: editingStatusIdx,
                editingVal: editingStatusVal,
                setEditingVal: setEditingStatusVal,
                onStartEdit: handleStartStatusEdit,
                onConfirmEdit: handleConfirmStatusEdit,
                onCancelEdit: () => { setEditingStatusIdx(null); setEditingStatusVal(''); },
                onRemove: handleRemoveStatus,
                newValue: newStatus,
                setNewValue: setNewStatus,
                onAdd: handleAddStatus,
                isDuplicate: isStatusDuplicate,
                placeholder: '새 상태 항목 입력',
                helpDefault: '과제 추가/수정 시 선택할 수 있는 상태 항목을 관리합니다.',
                resetFn: () => setLocalStatuses([...DEFAULT_STATUSES]),
              })
            : activeTab === 'classify'
            ? (() => {
                // 구분별 항목을 순서대로 flat 리스트로 만듬 (paste 시 인덱스 매핑용)
                const flatItems = Object.entries(itemsByCategory).flatMap(([, items]) => items);

                const handleClassifyPaste = (e, pasteStartIdx) => {
                  const clipboardData = e.clipboardData.getData('text/plain');
                  if (!clipboardData) return;

                  const lines = clipboardData.split('\n').map(l => l.replace(/\r$/, ''));
                  // 단일 셀이면 브라우저 기본 paste 사용
                  if (lines.filter(l => l.length > 0).length <= 1 && !clipboardData.includes('\t')) return;

                  e.preventDefault();

                  setLocalItemClassification(prev => {
                    const next = { ...prev };
                    lines.forEach((line, i) => {
                      const targetIdx = pasteStartIdx + i;
                      if (targetIdx >= flatItems.length) return;
                      // 탭 구분인 경우 2열(항목명\t분류) → 분류만, 1열이면 그대로
                      const cols = line.split('\t');
                      const value = (cols.length >= 2 ? cols[1] : cols[0]).trim();
                      next[flatItems[targetIdx]] = value;
                    });
                    return next;
                  });
                };

                let flatIdx = 0;
                return (
                  <>
                    {classificationSuggestions.length > 0 && (
                      <ClassSuggestions>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', lineHeight: '24px', marginRight: 4 }}>빠른 입력:</span>
                        {classificationSuggestions.map(s => (
                          <ClassBadge key={s} title="클릭하여 복사"
                            onClick={() => navigator.clipboard.writeText(s)}
                          >{s}</ClassBadge>
                        ))}
                      </ClassSuggestions>
                    )}
                    {Object.keys(itemsByCategory).length === 0 ? (
                      <HelpText style={{ textAlign: 'center', padding: '20px 0' }}>
                        과제에 시험항목이 설정된 데이터가 없습니다.
                      </HelpText>
                    ) : (
                      Object.entries(itemsByCategory).map(([cat, items]) => {
                        const section = (
                          <ClassCategorySection key={cat}>
                            <ClassCategoryTitle>{cat}</ClassCategoryTitle>
                            {items.map(item => {
                              const currentFlatIdx = flatIdx++;
                              return (
                                <ClassItemRow key={item}>
                                  <ClassItemName>{item}</ClassItemName>
                                  <ClassInput
                                    placeholder="분류 입력"
                                    value={localItemClassification[item] || ''}
                                    onChange={e => setLocalItemClassification(prev => ({ ...prev, [item]: e.target.value }))}
                                    onPaste={e => handleClassifyPaste(e, currentFlatIdx)}
                                    list="class-suggestions"
                                  />
                                </ClassItemRow>
                              );
                            })}
                          </ClassCategorySection>
                        );
                        return section;
                      })
                    )}
                    <datalist id="class-suggestions">
                      {classificationSuggestions.map(s => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                    <HelpText>각 항목에 분류를 입력하세요. 엑셀에서 분류 열을 복사하여 붙여넣기(Ctrl+V)하면 해당 항목부터 순서대로 채워집니다.</HelpText>
                  </>
                );
              })()
            : renderProductFamilyTab()
          }
        </ModalBody>

        <ModalFooter>
          <Button onClick={handleSave}>
            저장
          </Button>
        </ModalFooter>
      </Modal>
    </Overlay>
  );
};

export default SettingsModal;
