import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings, Plus, Trash2, ChevronUp, ChevronDown, Save } from 'lucide-react';

import { fetchTaskSettings, saveTaskSettingsApi } from '../../services/taskSettingsApi';

const DEFAULT_SETTINGS = {
  corporations: [],
  activityCategories: [],
  activitySubcategories: [],
  solutions: [],
  lineProducts: [],
};

export const loadTaskSettings = async () => {
  try {
    const data = await fetchTaskSettings();
    if (data) return { ...DEFAULT_SETTINGS, ...data };
  } catch (e) {
    console.error('[TaskSettings] API 로드 실패:', e);
  }
  return { ...DEFAULT_SETTINGS };
};

export const saveTaskSettings = async (settings) => {
  try {
    await saveTaskSettingsApi(settings);
  } catch (e) {
    console.error('[TaskSettings] API 저장 실패:', e);
  }
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
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  padding: 20px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: white;
  flex-shrink: 0;
`;

const HeaderTitle = styled.h2`
  margin: 0;
  font-size: 1.25rem;
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

const ModalBody = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
`;

const Sidebar = styled.div`
  width: 180px;
  min-width: 180px;
  background: #f8fafc;
  border-right: 1px solid #e2e8f0;
  padding: 12px 0;
  overflow-y: auto;
  flex-shrink: 0;
`;

const TabButton = styled.button`
  width: 100%;
  padding: 10px 16px;
  border: none;
  background: ${props => props.$active ? '#eef2ff' : 'transparent'};
  color: ${props => props.$active ? '#4f46e5' : '#64748b'};
  font-weight: ${props => props.$active ? '600' : '500'};
  font-size: 0.85rem;
  text-align: left;
  cursor: pointer;
  border-left: 3px solid ${props => props.$active ? '#4f46e5' : 'transparent'};
  transition: all 0.15s;

  &:hover {
    background: ${props => props.$active ? '#eef2ff' : '#f1f5f9'};
    color: ${props => props.$active ? '#4f46e5' : '#334155'};
  }
`;

const ContentArea = styled.div`
  flex: 1;
  padding: 20px 24px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const ContentHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ContentTitle = styled.h3`
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: #1e293b;
`;

const AddRow = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const AddInput = styled.input`
  flex: 1;
  padding: 8px 12px;
  border: 1.5px solid #c7d2fe;
  border-radius: 8px;
  font-size: 0.85rem;
  color: #1e293b;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;

  &:focus {
    border-color: #818cf8;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }

  &::placeholder { color: #94a3b8; }
`;

const AddButton = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 14px;
  border: 1px solid #a5b4fc;
  background: #eef2ff;
  color: #4f46e5;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  flex-shrink: 0;

  &:hover:not(:disabled) {
    background: #e0e7ff;
    border-color: #818cf8;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const ItemList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ItemRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  transition: border-color 0.15s;

  &:hover {
    border-color: #c7d2fe;
  }
`;

const ItemIndex = styled.span`
  font-size: 0.75rem;
  font-weight: 700;
  color: #94a3b8;
  min-width: 20px;
  text-align: center;
`;

const ItemInput = styled.input`
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.85rem;
  color: #1e293b;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;

  &:focus {
    border-color: #818cf8;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
  }

  &::placeholder { color: #94a3b8; }
`;

const ItemDescInput = styled(ItemInput)`
  flex: 1.5;
`;

const ItemSelect = styled.select`
  padding: 6px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.85rem;
  color: #1e293b;
  outline: none;
  cursor: pointer;
  min-width: 120px;
  transition: border-color 0.15s;

  &:focus {
    border-color: #818cf8;
  }
`;

const IconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  background: transparent;
  color: #94a3b8;
  flex-shrink: 0;

  &:hover { background: #f1f5f9; color: #64748b; }
  &:disabled { opacity: 0.3; cursor: not-allowed; }
`;

const DeleteButton = styled(IconButton)`
  &:hover { background: #fef2f2; color: #ef4444; }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 40px 20px;
  color: #94a3b8;
  font-size: 0.9rem;

  p { margin: 8px 0 0; font-size: 0.8rem; }
`;

const ModalFooter = styled.div`
  padding: 16px 24px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
`;

const FooterLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ChangeIndicator = styled.span`
  font-size: 0.8rem;
  color: #f59e0b;
  font-weight: 500;
`;

const FooterRight = styled.div`
  display: flex;
  gap: 10px;
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

const SaveButton = styled(Button)`
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  color: white;
  &:hover {
    background: linear-gradient(135deg, #4f46e5, #4338ca);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
  }
  &:disabled {
    background: #9ca3af;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;

const ParentBadge = styled.span`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.7rem;
  font-weight: 600;
  background: #eef2ff;
  color: #4f46e5;
  border: 1px solid #c7d2fe;
  white-space: nowrap;
`;

// ============== Component ==============

const TABS = [
  { id: 'corporations', label: '법인', prefix: 'corp' },
  { id: 'activityCategories', label: '액티비티 대분류', prefix: 'actcat' },
  { id: 'activitySubcategories', label: '액티비티 중분류', prefix: 'actsub' },
  { id: 'solutions', label: '활용 솔루션', prefix: 'sol' },
  { id: 'lineProducts', label: '라인/제품', prefix: 'lp' },
];

const ensureIds = (items, prefix) =>
  (items || []).map((item, i) => ({
    ...item,
    id: item.id || `${prefix}_${Date.now()}_${i}`,
  }));

const TaskSettingsModal = ({ isOpen, onClose, settings, onSave }) => {
  const [activeTab, setActiveTab] = useState('corporations');
  const [localSettings, setLocalSettings] = useState({ ...DEFAULT_SETTINGS });
  const [hasChanges, setHasChanges] = useState(false);
  const [addInput, setAddInput] = useState('');

  // 모달 열릴 때 설정 복사
  useEffect(() => {
    if (isOpen && settings) {
      setLocalSettings({
        corporations: ensureIds(settings.corporations, 'corp'),
        activityCategories: ensureIds(settings.activityCategories, 'actcat'),
        activitySubcategories: ensureIds(settings.activitySubcategories, 'actsub'),
        solutions: ensureIds(settings.solutions, 'sol'),
        lineProducts: ensureIds(settings.lineProducts, 'lp'),
      });
      setHasChanges(false);
      setAddInput('');
    }
  }, [isOpen, settings]);

  // 변경 감지
  useEffect(() => {
    if (!isOpen || !settings) return;
    const changed =
      JSON.stringify(localSettings.corporations) !== JSON.stringify(settings.corporations || []) ||
      JSON.stringify(localSettings.activityCategories) !== JSON.stringify(settings.activityCategories || []) ||
      JSON.stringify(localSettings.activitySubcategories) !== JSON.stringify(settings.activitySubcategories || []) ||
      JSON.stringify(localSettings.solutions) !== JSON.stringify(settings.solutions || []) ||
      JSON.stringify(localSettings.lineProducts) !== JSON.stringify(settings.lineProducts || []);
    setHasChanges(changed);
  }, [localSettings, settings, isOpen]);

  // 탭 변경 시 입력 초기화
  useEffect(() => {
    setAddInput('');
  }, [activeTab]);

  // ===== 범용 핸들러 =====

  const currentTab = TABS.find(t => t.id === activeTab);
  const currentItems = localSettings[activeTab] || [];

  const handleAddItems = useCallback(() => {
    const names = addInput.split(',').map(s => s.trim()).filter(Boolean);
    if (names.length === 0) return;
    const prefix = currentTab?.prefix || 'item';

    setLocalSettings(prev => {
      const existing = prev[activeTab] || [];
      const newItems = names.map((name, i) => {
        const base = {
          id: `${prefix}_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`,
          name,
          description: '',
          order: existing.length + i,
        };
        // 중분류는 대분류 연결 필드 추가
        if (activeTab === 'activitySubcategories') {
          base.categoryId = prev.activityCategories[0]?.id || '';
        }
        return base;
      });
      return { ...prev, [activeTab]: [...existing, ...newItems] };
    });
    setAddInput('');
  }, [addInput, activeTab, currentTab]);

  const handleUpdateItem = useCallback((category, id, field, value) => {
    setLocalSettings(prev => ({
      ...prev,
      [category]: (prev[category] || []).map(item =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    }));
  }, []);

  const handleDeleteItem = useCallback((category, id) => {
    setLocalSettings(prev => ({
      ...prev,
      [category]: (prev[category] || [])
        .filter(item => item.id !== id)
        .map((item, idx) => ({ ...item, order: idx })),
    }));
  }, []);

  const handleMoveItem = useCallback((category, index, direction) => {
    setLocalSettings(prev => {
      const items = [...(prev[category] || [])];
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= items.length) return prev;
      [items[index], items[newIndex]] = [items[newIndex], items[index]];
      items.forEach((item, idx) => { item.order = idx; });
      return { ...prev, [category]: items };
    });
  }, []);

  const handleSave = () => {
    onSave(localSettings);
    setHasChanges(false);
  };

  const handleClose = () => {
    if (hasChanges) {
      if (!window.confirm('저장되지 않은 변경 사항이 있습니다. 정말 닫으시겠습니까?')) return;
    }
    onClose();
  };

  // 중분류에서 대분류 이름 찾기
  const getCategoryName = (categoryId) => {
    const cat = (localSettings.activityCategories || []).find(c => c.id === categoryId);
    return cat?.name || '';
  };

  // ===== 탭별 콘텐츠 렌더 =====

  const renderSimpleList = (category, label, placeholder) => {
    const items = localSettings[category] || [];
    return (
      <>
        <ContentHeader>
          <ContentTitle>{label} 관리</ContentTitle>
        </ContentHeader>

        <AddRow>
          <AddInput
            value={addInput}
            onChange={(e) => setAddInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddItems(); }}
            placeholder={`${placeholder} 입력 (쉼표로 구분하여 여러 개 추가 가능)`}
          />
          <AddButton onClick={handleAddItems} disabled={!addInput.trim()}>
            <Plus size={14} />
            추가
          </AddButton>
        </AddRow>

        {items.length === 0 ? (
          <EmptyState>
            등록된 {label}이(가) 없습니다.
            <p>위 입력란에 {placeholder}을(를) 입력하고 추가하세요.</p>
          </EmptyState>
        ) : (
          <ItemList>
            {items.map((item, index) => (
              <ItemRow key={item.id}>
                <ItemIndex>{index + 1}</ItemIndex>
                <ItemInput
                  value={item.name}
                  onChange={(e) => handleUpdateItem(category, item.id, 'name', e.target.value)}
                  placeholder={placeholder}
                />
                <ItemDescInput
                  value={item.description || ''}
                  onChange={(e) => handleUpdateItem(category, item.id, 'description', e.target.value)}
                  placeholder="설명 (선택)"
                />
                <IconButton onClick={() => handleMoveItem(category, index, 'up')} disabled={index === 0} title="위로 이동">
                  <ChevronUp size={14} />
                </IconButton>
                <IconButton onClick={() => handleMoveItem(category, index, 'down')} disabled={index === items.length - 1} title="아래로 이동">
                  <ChevronDown size={14} />
                </IconButton>
                <DeleteButton onClick={() => handleDeleteItem(category, item.id)} title="삭제">
                  <Trash2 size={14} />
                </DeleteButton>
              </ItemRow>
            ))}
          </ItemList>
        )}
      </>
    );
  };

  const renderSubcategoryList = () => {
    const items = localSettings.activitySubcategories || [];
    const categories = localSettings.activityCategories || [];

    return (
      <>
        <ContentHeader>
          <ContentTitle>액티비티 중분류 관리</ContentTitle>
        </ContentHeader>

        <AddRow>
          <AddInput
            value={addInput}
            onChange={(e) => setAddInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddItems(); }}
            placeholder="중분류명 입력 (쉼표로 구분하여 여러 개 추가 가능)"
          />
          <AddButton onClick={handleAddItems} disabled={!addInput.trim()}>
            <Plus size={14} />
            추가
          </AddButton>
        </AddRow>

        {categories.length === 0 && (
          <EmptyState>
            대분류가 먼저 등록되어야 합니다.
            <p>"액티비티 대분류" 탭에서 대분류를 추가하세요.</p>
          </EmptyState>
        )}

        {categories.length > 0 && items.length === 0 && (
          <EmptyState>
            등록된 중분류가 없습니다.
            <p>위 입력란에 중분류명을 입력하고 추가하세요.</p>
          </EmptyState>
        )}

        {items.length > 0 && (
          <ItemList>
            {items.map((item, index) => (
              <ItemRow key={item.id}>
                <ItemIndex>{index + 1}</ItemIndex>
                <ItemSelect
                  value={item.categoryId || ''}
                  onChange={(e) => handleUpdateItem('activitySubcategories', item.id, 'categoryId', e.target.value)}
                >
                  <option value="">대분류 선택</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </ItemSelect>
                <ItemInput
                  value={item.name}
                  onChange={(e) => handleUpdateItem('activitySubcategories', item.id, 'name', e.target.value)}
                  placeholder="중분류명"
                />
                <ItemDescInput
                  value={item.description || ''}
                  onChange={(e) => handleUpdateItem('activitySubcategories', item.id, 'description', e.target.value)}
                  placeholder="설명 (선택)"
                />
                <IconButton onClick={() => handleMoveItem('activitySubcategories', index, 'up')} disabled={index === 0} title="위로 이동">
                  <ChevronUp size={14} />
                </IconButton>
                <IconButton onClick={() => handleMoveItem('activitySubcategories', index, 'down')} disabled={index === items.length - 1} title="아래로 이동">
                  <ChevronDown size={14} />
                </IconButton>
                <DeleteButton onClick={() => handleDeleteItem('activitySubcategories', item.id)} title="삭제">
                  <Trash2 size={14} />
                </DeleteButton>
              </ItemRow>
            ))}
          </ItemList>
        )}
      </>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <Overlay
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={handleClose}
        >
          <ModalContainer
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
          >
            <ModalHeader>
              <HeaderTitle>
                <Settings size={20} />
                과제 관리 설정
              </HeaderTitle>
              <CloseButton onClick={handleClose}>
                <X size={18} />
              </CloseButton>
            </ModalHeader>

            <ModalBody>
              <Sidebar>
                {TABS.map(tab => (
                  <TabButton
                    key={tab.id}
                    $active={activeTab === tab.id}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                  </TabButton>
                ))}
              </Sidebar>

              <ContentArea>
                {activeTab === 'corporations' && renderSimpleList('corporations', '법인', '법인명')}
                {activeTab === 'activityCategories' && renderSimpleList('activityCategories', '액티비티 대분류', '대분류명')}
                {activeTab === 'activitySubcategories' && renderSubcategoryList()}
                {activeTab === 'solutions' && renderSimpleList('solutions', '활용 솔루션', '솔루션명')}
                {activeTab === 'lineProducts' && renderSimpleList('lineProducts', '라인/제품', '라인/제품명')}
              </ContentArea>
            </ModalBody>

            <ModalFooter>
              <FooterLeft>
                {hasChanges && <ChangeIndicator>* 변경 사항이 있습니다</ChangeIndicator>}
              </FooterLeft>
              <FooterRight>
                <CancelButton onClick={handleClose}>취소</CancelButton>
                <SaveButton onClick={handleSave} disabled={!hasChanges}>
                  <Save size={15} />
                  저장
                </SaveButton>
              </FooterRight>
            </ModalFooter>
          </ModalContainer>
        </Overlay>
      )}
    </AnimatePresence>
  );
};

export default TaskSettingsModal;
