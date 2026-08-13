import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp, FolderPlus, X, Edit2, Check, Download, Upload } from 'lucide-react';
import Modal from '../../../../shared/components/Modal/Modal';
import { todayLocalYmd } from '../../../../shared/utils/localDate';

const ModalWrapper = styled.div`
  .settings-modal {
    width: 80vw !important;
    max-width: 80vw !important;
    height: 80vh !important;
    max-height: 80vh !important;
  }

  .settings-modal .modal-content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding: 0 !important;
  }
`;

const TabsContainer = styled.div`
  display: flex;
  align-items: center;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
  padding: 0 12px;
  flex-shrink: 0;
  gap: 4px;
  overflow-x: auto;

  &::-webkit-scrollbar {
    height: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 2px;
  }
`;

const Tab = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 16px;
  border: none;
  background: transparent;
  font-size: 14px;
  font-weight: 500;
  color: ${props => props.active ? '#8b5cf6' : '#64748b'};
  cursor: pointer;
  position: relative;
  transition: color 0.2s;
  white-space: nowrap;

  &:hover {
    color: #8b5cf6;
  }

  &::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 0;
    right: 0;
    height: 2px;
    background: ${props => props.active ? '#8b5cf6' : 'transparent'};
    transition: background 0.2s;
  }
`;

const TabLabelInput = styled.input`
  background: white;
  border: 1px solid #8b5cf6;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 13px;
  font-weight: 500;
  color: #1e293b;
  width: 150px;

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2);
  }
`;

const TabActionButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  border-radius: 4px;
  padding: 0;
  transition: all 0.2s;

  &:hover {
    background: ${props => props.delete ? '#fee2e2' : '#e2e8f0'};
    color: ${props => props.delete ? '#dc2626' : '#1e293b'};
  }

  &.confirm {
    color: #22c55e;
    &:hover {
      background: #dcfce7;
      color: #16a34a;
    }
  }
`;

const AddTabButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 12px;
  border: 1px dashed #d1d5db;
  border-radius: 6px;
  background: transparent;
  color: #64748b;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  margin-left: 8px;

  &:hover {
    border-color: #8b5cf6;
    color: #8b5cf6;
    background: #faf5ff;
  }
`;

const ContentArea = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 24px 40px;
`;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  flex: 1;
  min-height: 0;
`;

const GroupList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 8px;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.3);
  }
`;

const GroupCard = styled.div`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
`;

const GroupHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  color: white;
  border-radius: 12px 12px 0 0;
`;

const DragHandle = styled.div`
  color: rgba(255, 255, 255, 0.7);
  cursor: grab;
`;

const GroupTitleInput = styled.input`
  flex: 1;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  padding: 7px 11px;
  color: white;
  font-size: 13px;
  font-weight: 600;

  &::placeholder {
    color: rgba(255, 255, 255, 0.7);
  }

  &:focus {
    outline: none;
    background: rgba(255, 255, 255, 0.3);
    border-color: rgba(255, 255, 255, 0.5);
  }
`;

const GroupActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const IconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 6px;
  background: ${props => props.light ? 'rgba(255,255,255,0.2)' : 'transparent'};
  color: ${props => props.light ? 'white' : '#64748b'};
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: ${props => props.light ? 'rgba(255,255,255,0.3)' : '#e2e8f0'};
    color: ${props => props.light ? 'white' : '#1e293b'};
  }

  &.delete:hover {
    background: ${props => props.light ? 'rgba(239, 68, 68, 0.3)' : '#fee2e2'};
    color: ${props => props.light ? '#fecaca' : '#dc2626'};
  }
`;

const GroupBody = styled.div`
  padding: 14px;
`;

const FieldList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const FieldCard = styled.div`
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
`;

const FieldHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #f1f5f9;
  }
`;

const FieldInfo = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const FieldLabel = styled.span`
  font-weight: 500;
  font-size: 12px;
  color: #1e293b;
`;

const FieldType = styled.span`
  font-size: 10px;
  padding: 2px 5px;
  border-radius: 4px;
  background: ${props => {
    switch (props.type) {
      case 'textbox': return '#dbeafe';
      case 'combobox': return '#dcfce7';
      case 'datepicker': return '#fef3c7';
      case 'generatedtextbox': return '#f3e8ff';
      default: return '#e2e8f0';
    }
  }};
  color: ${props => {
    switch (props.type) {
      case 'textbox': return '#1d4ed8';
      case 'combobox': return '#15803d';
      case 'datepicker': return '#b45309';
      case 'generatedtextbox': return '#7c3aed';
      default: return '#475569';
    }
  }};
`;

const RequiredBadge = styled.span`
  font-size: 9px;
  padding: 2px 4px;
  border-radius: 4px;
  background: #fee2e2;
  color: #dc2626;
`;

const ExpandIcon = styled.div`
  color: #94a3b8;
`;

const FieldBody = styled.div`
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-top: 1px solid #e2e8f0;
  background: white;
`;

const FormRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const Label = styled.label`
  font-size: 11px;
  font-weight: 500;
  color: #64748b;
`;

const Input = styled.input`
  padding: 7px 9px;
  border: 1px solid #d1d5db;
  border-radius: 5px;
  font-size: 12px;

  &:focus {
    outline: none;
    border-color: #8b5cf6;
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.1);
  }
`;

const Select = styled.select`
  padding: 7px 9px;
  border: 1px solid #d1d5db;
  border-radius: 5px;
  font-size: 12px;
  background: white;

  &:focus {
    outline: none;
    border-color: #8b5cf6;
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.1);
  }
`;

const Checkbox = styled.label`
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 12px;
  color: #374151;

  input {
    width: 14px;
    height: 14px;
    cursor: pointer;
  }
`;

const OptionsSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const OptionsList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
`;

const OptionTag = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 7px;
  background: #f1f5f9;
  border-radius: 4px;
  font-size: 11px;
  color: #475569;

  button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    border: none;
    background: transparent;
    color: #94a3b8;
    cursor: pointer;
    padding: 0;
    font-size: 12px;

    &:hover {
      color: #dc2626;
    }
  }
`;

const AddOptionInput = styled.div`
  display: flex;
  gap: 6px;

  input {
    flex: 1;
    padding: 5px 8px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    font-size: 11px;

    &:focus {
      outline: none;
      border-color: #8b5cf6;
    }
  }

  button {
    padding: 5px 9px;
    background: #8b5cf6;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;

    &:hover {
      background: #7c3aed;
    }
  }
`;

const AddFieldButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px;
  border: 1px dashed #d1d5db;
  border-radius: 6px;
  background: transparent;
  color: #64748b;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 8px;

  &:hover {
    border-color: #8b5cf6;
    color: #8b5cf6;
    background: #faf5ff;
  }
`;

const AddGroupButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px;
  border: 2px dashed #d1d5db;
  border-radius: 12px;
  background: transparent;
  color: #64748b;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: #8b5cf6;
    color: #8b5cf6;
    background: #faf5ff;
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 20px;
  border-top: 1px solid #e5e7eb;
  flex-shrink: 0;
`;

const LeftButtons = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const RightButtons = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
`;

const ExportSettingsButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  background: #10b981;
  color: white;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #059669;
  }
`;

const ImportSettingsButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  background: #f59e0b;
  color: white;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #d97706;
  }
`;

const HiddenInput = styled.input`
  display: none;
`;

const Button = styled.button`
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &.cancel {
    background: white;
    border: 1px solid #d1d5db;
    color: #374151;

    &:hover {
      background: #f3f4f6;
    }
  }

  &.save {
    background: #8b5cf6;
    border: none;
    color: white;

    &:hover {
      background: #7c3aed;
    }
  }
`;

const FIELD_TYPES = [
  { value: 'textbox', label: '텍스트 입력' },
  { value: 'combobox', label: '드롭다운 선택' },
  { value: 'datepicker', label: '날짜 선택' },
  { value: 'generatedtextbox', label: '자동 생성 ID' },
];

const SettingsModal = ({ isOpen, onClose, tabsData, tabOrder, onSave }) => {
  const [activeTab, setActiveTab] = useState(tabOrder[0] || '');
  const [localTabsData, setLocalTabsData] = useState(tabsData || {});
  const [localTabOrder, setLocalTabOrder] = useState(tabOrder || []);
  const [expandedFields, setExpandedFields] = useState({});
  const [newOptionTexts, setNewOptionTexts] = useState({});
  const [editingTabId, setEditingTabId] = useState(null);
  const [editingTabLabel, setEditingTabLabel] = useState('');
  const settingsFileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setLocalTabsData(tabsData || {});
      setLocalTabOrder(tabOrder || []);
      setActiveTab(tabOrder[0] || '');
      setEditingTabId(null);
    }
  }, [isOpen, tabsData, tabOrder]);

  const currentGroups = localTabsData[activeTab]?.groups || [];

  const handleAddGroup = () => {
    const newGroup = {
      id: `group_${Date.now()}`,
      title: `새 그룹 ${currentGroups.length + 1}`,
      fields: [],
    };

    setLocalTabsData(prev => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        groups: [...(prev[activeTab]?.groups || []), newGroup],
      },
    }));
  };

  const handleDeleteGroup = (groupId) => {
    setLocalTabsData(prev => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        groups: prev[activeTab].groups.filter(g => g.id !== groupId),
      },
    }));
  };

  const handleGroupTitleChange = (groupId, title) => {
    setLocalTabsData(prev => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        groups: prev[activeTab].groups.map(g =>
          g.id === groupId ? { ...g, title } : g
        ),
      },
    }));
  };

  const handleAddField = (groupId) => {
    const newField = {
      id: `field_${Date.now()}`,
      name: `field_${Date.now()}`,
      label: '새 필드',
      type: 'textbox',
      required: false,
      placeholder: '',
      options: [],
    };

    setLocalTabsData(prev => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        groups: prev[activeTab].groups.map(g =>
          g.id === groupId
            ? { ...g, fields: [...g.fields, newField] }
            : g
        ),
      },
    }));
    setExpandedFields(prev => ({ ...prev, [newField.id]: true }));
  };

  const handleDeleteField = (groupId, fieldId) => {
    setLocalTabsData(prev => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        groups: prev[activeTab].groups.map(g =>
          g.id === groupId
            ? { ...g, fields: g.fields.filter(f => f.id !== fieldId) }
            : g
        ),
      },
    }));
  };

  const handleFieldChange = (groupId, fieldId, key, value) => {
    setLocalTabsData(prev => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        groups: prev[activeTab].groups.map(g =>
          g.id === groupId
            ? {
                ...g,
                fields: g.fields.map(f =>
                  f.id === fieldId ? { ...f, [key]: value } : f
                ),
              }
            : g
        ),
      },
    }));
  };

  const handleAddOption = (groupId, fieldId) => {
    const key = `${groupId}_${fieldId}`;
    const optionText = newOptionTexts[key]?.trim();
    if (!optionText) return;

    setLocalTabsData(prev => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        groups: prev[activeTab].groups.map(g =>
          g.id === groupId
            ? {
                ...g,
                fields: g.fields.map(f =>
                  f.id === fieldId
                    ? { ...f, options: [...(f.options || []), optionText] }
                    : f
                ),
              }
            : g
        ),
      },
    }));
    setNewOptionTexts(prev => ({ ...prev, [key]: '' }));
  };

  const handleRemoveOption = (groupId, fieldId, optionIndex) => {
    setLocalTabsData(prev => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        groups: prev[activeTab].groups.map(g =>
          g.id === groupId
            ? {
                ...g,
                fields: g.fields.map(f =>
                  f.id === fieldId
                    ? { ...f, options: f.options.filter((_, i) => i !== optionIndex) }
                    : f
                ),
              }
            : g
        ),
      },
    }));
  };

  const handleAddTab = () => {
    const newTabId = `tab_${Date.now()}`;
    const newTabLabel = `새 탭 ${localTabOrder.length + 1}`;

    setLocalTabsData(prev => ({
      ...prev,
      [newTabId]: {
        id: newTabId,
        label: newTabLabel,
        groups: [],
      },
    }));
    setLocalTabOrder(prev => [...prev, newTabId]);
    setActiveTab(newTabId);
    setEditingTabId(newTabId);
    setEditingTabLabel(newTabLabel);
  };

  const handleDeleteTab = (tabId) => {
    if (localTabOrder.length <= 1) {
      alert('최소 1개의 탭이 필요합니다.');
      return;
    }

    const newTabOrder = localTabOrder.filter(id => id !== tabId);
    const newTabsData = { ...localTabsData };
    delete newTabsData[tabId];

    setLocalTabOrder(newTabOrder);
    setLocalTabsData(newTabsData);

    if (activeTab === tabId) {
      setActiveTab(newTabOrder[0]);
    }
  };

  const handleStartEditTab = (tabId, e) => {
    e.stopPropagation();
    setEditingTabId(tabId);
    setEditingTabLabel(localTabsData[tabId]?.label || '');
  };

  const handleConfirmEditTab = (tabId, e) => {
    e.stopPropagation();
    if (editingTabLabel.trim()) {
      setLocalTabsData(prev => ({
        ...prev,
        [tabId]: {
          ...prev[tabId],
          label: editingTabLabel.trim(),
        },
      }));
    }
    setEditingTabId(null);
    setEditingTabLabel('');
  };

  const handleCancelEditTab = (e) => {
    e.stopPropagation();
    setEditingTabId(null);
    setEditingTabLabel('');
  };

  const handleSave = () => {
    onSave(localTabsData, localTabOrder);
    onClose();
  };

  const handleClose = () => {
    setLocalTabsData(tabsData || {});
    setLocalTabOrder(tabOrder || []);
    setEditingTabId(null);
    onClose();
  };

  // 설정 내보내기
  const handleExportSettings = () => {
    const exportData = {
      version: '1.0',
      type: 'settings',
      exportedAt: new Date().toISOString(),
      tabsData: localTabsData,
      tabOrder: localTabOrder,
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `material-council-settings_${todayLocalYmd()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    alert('설정 데이터를 내보냈습니다.');
  };

  // 설정 가져오기
  const handleImportSettings = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const importData = JSON.parse(event.target.result);

        // 버전/타입 확인
        if (!importData.version || importData.type !== 'settings') {
          alert('올바른 설정 JSON 파일이 아닙니다.');
          return;
        }

        if (!importData.tabsData || !importData.tabOrder) {
          alert('가져올 설정 데이터가 없습니다.');
          return;
        }

        const shouldReplace = window.confirm(
          '설정 데이터를 가져오면 현재 설정이 교체됩니다.\n계속하시겠습니까?'
        );

        if (shouldReplace) {
          setLocalTabsData(importData.tabsData);
          setLocalTabOrder(importData.tabOrder);
          setActiveTab(importData.tabOrder[0] || '');
          alert('설정 데이터를 가져왔습니다. "저장" 버튼을 눌러 적용하세요.');
        }
      } catch (error) {
        console.error('JSON 가져오기 오류:', error);
        alert('JSON 파일을 읽는 중 오류가 발생했습니다.');
      }
    };

    reader.onerror = () => {
      alert('파일을 읽는 중 오류가 발생했습니다.');
    };

    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  const toggleFieldExpand = (fieldId) => {
    setExpandedFields(prev => ({
      ...prev,
      [fieldId]: !prev[fieldId],
    }));
  };

  return (
    <ModalWrapper>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title="데이터 입력 필드 설정"
        maxWidth="80vw"
        className="settings-modal"
      >
        <TabsContainer>
          {localTabOrder.map(tabId => (
            <Tab
              key={tabId}
              active={activeTab === tabId}
              onClick={() => setActiveTab(tabId)}
            >
              {editingTabId === tabId ? (
                <>
                  <TabLabelInput
                    value={editingTabLabel}
                    onChange={(e) => setEditingTabLabel(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyPress={(e) => e.key === 'Enter' && handleConfirmEditTab(tabId, e)}
                    autoFocus
                  />
                  <TabActionButton
                    className="confirm"
                    onClick={(e) => handleConfirmEditTab(tabId, e)}
                    title="확인"
                  >
                    <Check size={12} />
                  </TabActionButton>
                  <TabActionButton
                    onClick={handleCancelEditTab}
                    title="취소"
                  >
                    <X size={12} />
                  </TabActionButton>
                </>
              ) : (
                <>
                  <span>{localTabsData[tabId]?.label || tabId}</span>
                  <TabActionButton
                    onClick={(e) => handleStartEditTab(tabId, e)}
                    title="탭 이름 수정"
                  >
                    <Edit2 size={11} />
                  </TabActionButton>
                  <TabActionButton
                    delete
                    onClick={(e) => { e.stopPropagation(); handleDeleteTab(tabId); }}
                    title="탭 삭제"
                  >
                    <X size={12} />
                  </TabActionButton>
                </>
              )}
            </Tab>
          ))}
          <AddTabButton onClick={handleAddTab}>
            <Plus size={14} />
            탭 추가
          </AddTabButton>
        </TabsContainer>

        <ContentArea>
          <Container>
            <GroupList>
              {currentGroups.map((group) => (
                <GroupCard key={group.id}>
                  <GroupHeader>
                    <DragHandle>
                      <GripVertical size={16} />
                    </DragHandle>
                    <GroupTitleInput
                      value={group.title}
                      onChange={(e) => handleGroupTitleChange(group.id, e.target.value)}
                      placeholder="그룹 이름"
                    />
                    <GroupActions>
                      <IconButton
                        light
                        className="delete"
                        onClick={() => handleDeleteGroup(group.id)}
                        title="그룹 삭제"
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    </GroupActions>
                  </GroupHeader>

                  <GroupBody>
                    <FieldList>
                      {group.fields.map((field) => (
                        <FieldCard key={field.id}>
                          <FieldHeader onClick={() => toggleFieldExpand(field.id)}>
                            <DragHandle onClick={(e) => e.stopPropagation()}>
                              <GripVertical size={12} />
                            </DragHandle>
                            <FieldInfo>
                              <FieldLabel>{field.label}</FieldLabel>
                              <FieldType type={field.type}>
                                {FIELD_TYPES.find(t => t.value === field.type)?.label}
                              </FieldType>
                              {field.required && <RequiredBadge>필수</RequiredBadge>}
                            </FieldInfo>
                            <IconButton
                              className="delete"
                              onClick={(e) => { e.stopPropagation(); handleDeleteField(group.id, field.id); }}
                            >
                              <Trash2 size={12} />
                            </IconButton>
                            <ExpandIcon>
                              {expandedFields[field.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </ExpandIcon>
                          </FieldHeader>

                          {expandedFields[field.id] && (
                            <FieldBody>
                              <FormRow>
                                <FormGroup>
                                  <Label>필드 라벨</Label>
                                  <Input
                                    value={field.label}
                                    onChange={(e) => handleFieldChange(group.id, field.id, 'label', e.target.value)}
                                    placeholder="표시될 라벨명"
                                  />
                                </FormGroup>
                                <FormGroup>
                                  <Label>필드 이름 (영문)</Label>
                                  <Input
                                    value={field.name}
                                    onChange={(e) => handleFieldChange(group.id, field.id, 'name', e.target.value)}
                                    placeholder="영문 필드명"
                                  />
                                </FormGroup>
                                <FormGroup>
                                  <Label>필드 타입</Label>
                                  <Select
                                    value={field.type}
                                    onChange={(e) => handleFieldChange(group.id, field.id, 'type', e.target.value)}
                                  >
                                    {FIELD_TYPES.map(type => (
                                      <option key={type.value} value={type.value}>{type.label}</option>
                                    ))}
                                  </Select>
                                </FormGroup>
                                <FormGroup>
                                  <Label>플레이스홀더</Label>
                                  <Input
                                    value={field.placeholder || ''}
                                    onChange={(e) => handleFieldChange(group.id, field.id, 'placeholder', e.target.value)}
                                    placeholder="입력 힌트"
                                  />
                                </FormGroup>
                              </FormRow>

                              <Checkbox>
                                <input
                                  type="checkbox"
                                  checked={field.required}
                                  onChange={(e) => handleFieldChange(group.id, field.id, 'required', e.target.checked)}
                                />
                                필수 입력 필드
                              </Checkbox>

                              {field.type === 'combobox' && (
                                <OptionsSection>
                                  <Label>드롭다운 옵션</Label>
                                  <OptionsList>
                                    {(field.options || []).map((option, index) => (
                                      <OptionTag key={index}>
                                        {option}
                                        <button onClick={() => handleRemoveOption(group.id, field.id, index)}>
                                          ×
                                        </button>
                                      </OptionTag>
                                    ))}
                                  </OptionsList>
                                  <AddOptionInput>
                                    <input
                                      value={newOptionTexts[`${group.id}_${field.id}`] || ''}
                                      onChange={(e) => setNewOptionTexts(prev => ({
                                        ...prev,
                                        [`${group.id}_${field.id}`]: e.target.value
                                      }))}
                                      placeholder="새 옵션 입력"
                                      onKeyPress={(e) => e.key === 'Enter' && handleAddOption(group.id, field.id)}
                                    />
                                    <button onClick={() => handleAddOption(group.id, field.id)}>추가</button>
                                  </AddOptionInput>
                                </OptionsSection>
                              )}
                            </FieldBody>
                          )}
                        </FieldCard>
                      ))}
                    </FieldList>

                    <AddFieldButton onClick={() => handleAddField(group.id)}>
                      <Plus size={12} />
                      필드 추가
                    </AddFieldButton>
                  </GroupBody>
                </GroupCard>
              ))}

              <AddGroupButton onClick={handleAddGroup}>
                <FolderPlus size={16} />
                새 그룹 추가
              </AddGroupButton>
            </GroupList>

            <ButtonGroup>
              <LeftButtons>
                <ExportSettingsButton onClick={handleExportSettings}>
                  <Download size={14} />
                  설정 내보내기
                </ExportSettingsButton>
                <ImportSettingsButton onClick={() => settingsFileInputRef.current?.click()}>
                  <Upload size={14} />
                  설정 가져오기
                </ImportSettingsButton>
                <HiddenInput
                  ref={settingsFileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImportSettings}
                />
              </LeftButtons>
              <RightButtons>
                <Button type="button" className="cancel" onClick={handleClose}>
                  취소
                </Button>
                <Button type="button" className="save" onClick={handleSave}>
                  저장
                </Button>
              </RightButtons>
            </ButtonGroup>
          </Container>
        </ContentArea>
      </Modal>
    </ModalWrapper>
  );
};

export default SettingsModal;
