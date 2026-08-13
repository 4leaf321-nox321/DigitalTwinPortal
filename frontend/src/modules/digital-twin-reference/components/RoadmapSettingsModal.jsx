import React, { useState, useEffect, useMemo, useCallback } from 'react';
import styled from 'styled-components';
import { X, ChevronUp, ChevronDown, Plus, Trash2 } from 'lucide-react';

const Overlay = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
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
  &:hover { background: #e2e8f0; color: #1e293b; }
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
  color: ${p => p.$active ? '#0891b2' : '#64748b'};
  cursor: pointer;
  position: relative;
  transition: color 0.2s ease;
  &:hover {
    color: ${p => p.$active ? '#0891b2' : '#475569'};
    background: ${p => p.$active ? 'transparent' : '#f8fafc'};
  }
  &::after {
    content: '';
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 2px;
    background: ${p => p.$active ? '#06b6d4' : 'transparent'};
  }
`;

const ModalBody = styled.div`
  flex: 1;
  padding: 20px;
  overflow-y: auto;
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
  &:hover { background: #0891b2; }
`;

const HelpText = styled.p`
  font-size: 0.75rem;
  color: #64748b;
  margin: 8px 0 0 0;
`;

/* ── Item Order Tab ── */
const CategorySection = styled.div`
  margin-bottom: 16px;
`;

const CategoryTitle = styled.div`
  font-size: 0.8rem;
  font-weight: 700;
  color: #0e7490;
  margin-bottom: 8px;
  padding: 4px 0;
  border-bottom: 1px solid #e0f2fe;
`;

const OrderItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid ${p => p.$selected ? '#06b6d4' : '#e2e8f0'};
  border-radius: 6px;
  background: ${p => p.$selected ? '#ecfeff' : 'white'};
  margin-bottom: 4px;
  cursor: pointer;
  outline: none;
  transition: border-color 0.15s, background 0.15s;

  &:hover {
    border-color: ${p => p.$selected ? '#06b6d4' : '#cbd5e1'};
  }
`;

const OrderIndex = styled.span`
  font-size: 0.75rem;
  color: #94a3b8;
  font-weight: 600;
  width: 20px;
  text-align: center;
  flex-shrink: 0;
`;

const OrderLabel = styled.span`
  flex: 1;
  font-size: 0.85rem;
  color: #1e293b;
  font-weight: 500;
`;

const ArrowButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border: none;
  background: none;
  color: #94a3b8;
  cursor: pointer;
  border-radius: 4px;
  &:hover { background: #f1f5f9; color: #475569; }
  &:disabled { opacity: 0.3; cursor: not-allowed; &:hover { background: none; color: #94a3b8; } }
`;

/* ── Cell Merge Tab ── */
const MergeSplitLayout = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  height: 100%;
`;

const MergePane = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const PaneTitle = styled.div`
  font-size: 0.85rem;
  font-weight: 700;
  color: #334155;
  padding-bottom: 8px;
  border-bottom: 2px solid #e2e8f0;
`;

const RuleList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  flex: 1;
`;

const RuleItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: white;
`;

const RuleBadge = styled.span`
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 4px;
  background: ${p => p.$bg || '#f1f5f9'};
  color: ${p => p.$color || '#64748b'};
  font-weight: 500;
  flex-shrink: 0;
`;

const RuleItems = styled.span`
  flex: 1;
  font-size: 0.8rem;
  color: #334155;
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
  flex-shrink: 0;
  &:hover {
    background: ${p => p.$danger ? '#fee2e2' : '#f1f5f9'};
    color: ${p => p.$danger ? '#ef4444' : '#475569'};
  }
`;

const FormSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
`;

const FormRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const FormLabel = styled.span`
  font-size: 0.78rem;
  font-weight: 600;
  color: #475569;
  min-width: 50px;
  flex-shrink: 0;
`;

const Select = styled.select`
  padding: 6px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 0.85rem;
  color: #1e293b;
  background: white;
  flex: 1;
  &:focus { outline: none; border-color: #06b6d4; }
`;

const FilterButtonGroup = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
`;

const FilterButton = styled.button`
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: ${p => p.$active ? '600' : '500'};
  cursor: pointer;
  border: 1px solid ${p => p.$active ? '#06b6d4' : '#e2e8f0'};
  background: ${p => p.$active ? '#ecfeff' : 'white'};
  color: ${p => p.$active ? '#0891b2' : '#64748b'};
  &:hover { border-color: #06b6d4; }
`;

const CheckboxGroup = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const CheckboxLabel = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8rem;
  color: #334155;
  padding: 4px 8px;
  border: 1px solid ${p => p.$checked ? '#06b6d4' : '#e2e8f0'};
  border-radius: 4px;
  background: ${p => p.$checked ? '#ecfeff' : 'white'};
  cursor: pointer;
  user-select: none;
  &:hover { border-color: #06b6d4; }
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
  flex-shrink: 0;
  &:hover { background: #0891b2; }
  &:disabled { background: #94a3b8; cursor: not-allowed; }
`;

const EmptyText = styled.div`
  text-align: center;
  padding: 20px 0;
  font-size: 0.8rem;
  color: #94a3b8;
`;


const RoadmapSettingsModal = ({ isOpen, onClose, onSave, roadmapConfig, tasks = [], categories = [], divisions = [] }) => {
  const [activeTab, setActiveTab] = useState('order');
  const [localItemOrder, setLocalItemOrder] = useState({});
  const [localCellMerge, setLocalCellMerge] = useState([]);

  // New merge rule state
  const [newCategory, setNewCategory] = useState('');
  const [newYear, setNewYear] = useState('');
  const [newItems, setNewItems] = useState([]);

  // Selected item for keyboard navigation
  const [selectedOrder, setSelectedOrder] = useState(null); // { cat, idx }

  // Division filter for merge tab
  const [mergeDivisionFilter, setMergeDivisionFilter] = useState('');

  // Extract existing items per category from tasks
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
      result[cat] = [...map[cat]];
    });
    return result;
  }, [tasks]);

  // Extract years from tasks (non-완료)
  const availableYears = useMemo(() => {
    const years = new Set();
    (tasks || []).forEach(t => {
      if (t.status !== '완료' && t.year) years.add(t.year);
    });
    return [...years].sort();
  }, [tasks]);

  // All categories that exist in tasks
  const existingCategories = useMemo(() => {
    const cats = new Set();
    (tasks || []).forEach(t => {
      if (t.category) cats.add(t.category);
    });
    return [...cats];
  }, [tasks]);

  // Filtered categories by division
  const filteredCategories = useMemo(() => {
    if (!mergeDivisionFilter) return existingCategories;
    const cats = new Set();
    (tasks || []).forEach(t => {
      if (t.category && t.divisionId === mergeDivisionFilter) cats.add(t.category);
    });
    return [...cats];
  }, [tasks, existingCategories, mergeDivisionFilter]);

  useEffect(() => {
    if (isOpen) {
      const cfg = roadmapConfig || { itemOrder: {}, cellMerge: [] };
      const order = {};
      Object.keys(itemsByCategory).forEach(cat => {
        const saved = cfg.itemOrder?.[cat] || [];
        const taskItems = itemsByCategory[cat] || [];
        const ordered = saved.filter(item => taskItems.includes(item));
        taskItems.forEach(item => {
          if (!ordered.includes(item)) ordered.push(item);
        });
        order[cat] = ordered;
      });
      setLocalItemOrder(order);
      setLocalCellMerge((cfg.cellMerge || []).map(r => ({ ...r, items: [...r.items] })));
      setNewCategory('');
      setNewYear('');
      setNewItems([]);
      setMergeDivisionFilter('');
      setSelectedOrder(null);
      setActiveTab('order');
    }
  }, [isOpen, roadmapConfig, itemsByCategory]);

  // --- Item Order handlers ---
  const handleMoveItem = useCallback((cat, idx, direction) => {
    setLocalItemOrder(prev => {
      const arr = [...prev[cat]];
      let newIdx;
      if (direction === 'up') {
        newIdx = idx - 1;
        if (newIdx < 0) return prev;
        [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      } else if (direction === 'down') {
        newIdx = idx + 1;
        if (newIdx >= arr.length) return prev;
        [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      } else if (direction === 'first') {
        if (idx === 0) return prev;
        const [item] = arr.splice(idx, 1);
        arr.unshift(item);
        newIdx = 0;
      } else if (direction === 'last') {
        if (idx === arr.length - 1) return prev;
        const [item] = arr.splice(idx, 1);
        arr.push(item);
        newIdx = arr.length - 1;
      }
      setSelectedOrder({ cat, idx: newIdx });
      return { ...prev, [cat]: arr };
    });
  }, []);

  const handleOrderKeyDown = useCallback((e, cat, idx) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      handleMoveItem(cat, idx, 'up');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      handleMoveItem(cat, idx, 'down');
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      handleMoveItem(cat, idx, 'first');
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      handleMoveItem(cat, idx, 'last');
    }
  }, [handleMoveItem]);

  // --- Cell Merge handlers ---
  const handleToggleNewItem = (item) => {
    setNewItems(prev =>
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    );
  };

  const handleAddRule = () => {
    if (!newCategory || !newYear || newItems.length < 2) return;
    setLocalCellMerge(prev => [
      ...prev,
      { category: newCategory, year: newYear, items: [...newItems] }
    ]);
    setNewCategory('');
    setNewYear('');
    setNewItems([]);
  };

  const handleRemoveRule = (idx) => {
    setLocalCellMerge(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    // 기존 config의 다른 필드(itemClassification 등)를 보존
    onSave({ ...roadmapConfig, itemOrder: localItemOrder, cellMerge: localCellMerge });
  };

  // Items available for new merge rule (filtered by selected category + division)
  const newRuleAvailableItems = useMemo(() => {
    if (!newCategory) return [];
    const baseItems = localItemOrder[newCategory] || itemsByCategory[newCategory] || [];
    if (!mergeDivisionFilter) return baseItems;
    // Filter to items that have at least one task in the selected division
    const divItems = new Set();
    (tasks || []).forEach(t => {
      if (t.category === newCategory && t.divisionId === mergeDivisionFilter && t.testItem) {
        divItems.add(t.testItem);
      }
    });
    return baseItems.filter(item => divItems.has(item));
  }, [newCategory, localItemOrder, itemsByCategory, mergeDivisionFilter, tasks]);

  // Filtered rules for display
  const filteredRules = useMemo(() => {
    if (!mergeDivisionFilter) return localCellMerge;
    // Filter rules to those whose category has tasks in the selected division
    const divCats = new Set();
    (tasks || []).forEach(t => {
      if (t.divisionId === mergeDivisionFilter && t.category) divCats.add(t.category);
    });
    return localCellMerge.filter(rule => divCats.has(rule.category));
  }, [localCellMerge, mergeDivisionFilter, tasks]);

  if (!isOpen) return null;

  return (
    <Overlay onClick={onClose}>
      <Modal onClick={e => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>로드맵 설정</ModalTitle>
          <CloseButton onClick={onClose}><X size={20} /></CloseButton>
        </ModalHeader>

        <TabBar>
          <Tab $active={activeTab === 'order'} onClick={() => setActiveTab('order')}>
            항목 순서
          </Tab>
          <Tab $active={activeTab === 'merge'} onClick={() => setActiveTab('merge')}>
            셀 합치기
          </Tab>
        </TabBar>

        <ModalBody>
          {activeTab === 'order' ? (
            <>
              {Object.keys(localItemOrder).length === 0 ? (
                <EmptyText>표시할 항목이 없습니다. 과제에 구분/시험항목을 설정하세요.</EmptyText>
              ) : (
                Object.entries(localItemOrder).map(([cat, items]) => (
                  <CategorySection key={cat}>
                    <CategoryTitle>{cat}</CategoryTitle>
                    {items.map((item, idx) => {
                      const isSelected = selectedOrder?.cat === cat && selectedOrder?.idx === idx;
                      return (
                        <OrderItem
                          key={item}
                          $selected={isSelected}
                          tabIndex={0}
                          onClick={() => setSelectedOrder({ cat, idx })}
                          onKeyDown={(e) => handleOrderKeyDown(e, cat, idx)}
                        >
                          <OrderIndex>{idx + 1}</OrderIndex>
                          <OrderLabel>{item}</OrderLabel>
                          <ArrowButton
                            disabled={idx === 0}
                            onClick={(e) => { e.stopPropagation(); handleMoveItem(cat, idx, 'up'); }}
                            title="위로"
                          >
                            <ChevronUp size={16} />
                          </ArrowButton>
                          <ArrowButton
                            disabled={idx === items.length - 1}
                            onClick={(e) => { e.stopPropagation(); handleMoveItem(cat, idx, 'down'); }}
                            title="아래로"
                          >
                            <ChevronDown size={16} />
                          </ArrowButton>
                        </OrderItem>
                      );
                    })}
                  </CategorySection>
                ))
              )}
              <HelpText>항목을 클릭하여 선택 후 방향키로 이동: ↑↓ 한칸 이동, ← 맨 앞, → 맨 뒤</HelpText>
            </>
          ) : (
            <>
              {/* 사업부 필터 */}
              {divisions.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <FormRow>
                    <FormLabel>사업부</FormLabel>
                    <FilterButtonGroup>
                      <FilterButton
                        $active={mergeDivisionFilter === ''}
                        onClick={() => setMergeDivisionFilter('')}
                      >
                        전체
                      </FilterButton>
                      {divisions.map(div => (
                        <FilterButton
                          key={div.id}
                          $active={mergeDivisionFilter === div.id}
                          onClick={() => {
                            setMergeDivisionFilter(div.id);
                            setNewCategory('');
                            setNewItems([]);
                          }}
                        >
                          {div.name}
                        </FilterButton>
                      ))}
                    </FilterButtonGroup>
                  </FormRow>
                </div>
              )}

              <MergeSplitLayout>
                {/* 좌측: 규칙 추가 */}
                <MergePane>
                  <PaneTitle>규칙 추가</PaneTitle>
                  <FormSection>
                    <FormRow>
                      <FormLabel>구분</FormLabel>
                      <Select value={newCategory} onChange={e => { setNewCategory(e.target.value); setNewItems([]); }}>
                        <option value="">구분 선택</option>
                        {filteredCategories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </Select>
                    </FormRow>
                    <FormRow>
                      <FormLabel>열</FormLabel>
                      <Select value={newYear} onChange={e => setNewYear(e.target.value)}>
                        <option value="">열 선택</option>
                        <option value="__current__">현재</option>
                        {availableYears.map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </Select>
                    </FormRow>
                    {newCategory && newRuleAvailableItems.length > 0 && (
                      <>
                        <FormLabel style={{ minWidth: 'auto' }}>합칠 항목 (2개 이상 선택)</FormLabel>
                        <CheckboxGroup>
                          {newRuleAvailableItems.map(item => (
                            <CheckboxLabel key={item} $checked={newItems.includes(item)}>
                              <input
                                type="checkbox"
                                checked={newItems.includes(item)}
                                onChange={() => handleToggleNewItem(item)}
                                style={{ display: 'none' }}
                              />
                              {item}
                            </CheckboxLabel>
                          ))}
                        </CheckboxGroup>
                      </>
                    )}
                    <FormRow>
                      <AddButton
                        onClick={handleAddRule}
                        disabled={!newCategory || !newYear || newItems.length < 2}
                      >
                        <Plus size={14} />
                        규칙 추가
                      </AddButton>
                      {newItems.length === 1 && (
                        <HelpText style={{ margin: 0 }}>2개 이상의 항목을 선택하세요.</HelpText>
                      )}
                    </FormRow>
                  </FormSection>
                  <HelpText>
                    특정 연도 또는 "현재" 열에서 여러 시험항목의 셀을 합쳐 하나로 표시합니다.
                  </HelpText>
                </MergePane>

                {/* 우측: 추가된 규칙 목록 */}
                <MergePane>
                  <PaneTitle>추가된 규칙 ({filteredRules.length})</PaneTitle>
                  <RuleList>
                    {filteredRules.length === 0 ? (
                      <EmptyText>설정된 셀 합치기 규칙이 없습니다.</EmptyText>
                    ) : (
                      filteredRules.map((rule, idx) => {
                        const realIdx = localCellMerge.indexOf(rule);
                        return (
                          <RuleItem key={idx}>
                            <RuleBadge $bg="#ecfeff" $color="#0891b2">{rule.category}</RuleBadge>
                            <RuleBadge $bg="#fef3c7" $color="#92400e">{rule.year === '__current__' ? '현재' : rule.year}</RuleBadge>
                            <RuleItems>{rule.items.join(', ')}</RuleItems>
                            <IconButton $danger onClick={() => handleRemoveRule(realIdx)} title="삭제">
                              <Trash2 size={14} />
                            </IconButton>
                          </RuleItem>
                        );
                      })
                    )}
                  </RuleList>
                </MergePane>
              </MergeSplitLayout>
            </>
          )}
        </ModalBody>

        <ModalFooter>
          <Button onClick={handleSave}>저장</Button>
        </ModalFooter>
      </Modal>
    </Overlay>
  );
};

export default RoadmapSettingsModal;
