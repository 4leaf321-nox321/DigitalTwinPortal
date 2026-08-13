import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './SettingsModal.css';

const SettingsModal = ({ 
  isOpen, 
  onClose, 
  settingsData,
  onUpdateSettings,
  showSuccess,
  showError 
}) => {
  const [activeTab, setActiveTab] = useState('divisions');
  const [localSettings, setLocalSettings] = useState({
    divisions: [],
    statuses: [],
    performanceCategories: [],
    performanceSubcategories: [],
    performanceItems: []
  });
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (isOpen && settingsData) {
      setLocalSettings({
        divisions: [...(settingsData.divisions || [])],
        statuses: [...(settingsData.statuses || [])],
        performanceCategories: [...(settingsData.performanceCategories || [])],
        performanceSubcategories: [...(settingsData.performanceSubcategories || [])],
        performanceItems: [...(settingsData.performanceItems || [])]
      });
      setHasChanges(false);
    }
  }, [isOpen, settingsData]);

  useEffect(() => {
    if (!isOpen || !settingsData) return;

    const hasChanged = (
      JSON.stringify(localSettings.divisions) !== JSON.stringify(settingsData.divisions || []) ||
      JSON.stringify(localSettings.statuses) !== JSON.stringify(settingsData.statuses || []) ||
      JSON.stringify(localSettings.performanceCategories) !== JSON.stringify(settingsData.performanceCategories || []) ||
      JSON.stringify(localSettings.performanceSubcategories) !== JSON.stringify(settingsData.performanceSubcategories || []) ||
      JSON.stringify(localSettings.performanceItems) !== JSON.stringify(settingsData.performanceItems || [])
    );
    
    setHasChanges(hasChanged);
  }, [localSettings, settingsData, isOpen]);

  const tabs = [
    { id: 'divisions', label: '사업부', key: 'divisions' },
    { id: 'statuses', label: '진행상태', key: 'statuses' },
    { id: 'performance', label: '성과 항목', key: 'performanceItems' }
  ];

  const handleAddItem = (category) => {
    const newItem = createNewItem(category);
    setLocalSettings(prev => ({
      ...prev,
      [category]: [...prev[category], newItem]
    }));
  };

  const createNewItem = (category) => {
    const id = category + '_' + Date.now();
    const baseItem = {
      id,
      name: '새 ' + (tabs.find(t => t.key === category)?.label || '항목'),
      order: localSettings[category].length
    };

    switch (category) {
      case 'divisions':
        return {
          ...baseItem,
          color: '#64748B',
          description: ''
        };
      case 'statuses':
        return {
          ...baseItem,
          color: '#64748B',
          description: ''
        };
      case 'performanceItems':
        return {
          ...baseItem,
          name: '새 성과 항목',
          subcategoryId: localSettings.performanceSubcategories[0]?.id || '',
          unit: '',
          currentLevel: '',
          targetLevel: '',
          actualLevel: '',
          description: ''
        };
      default:
        return baseItem;
    }
  };

  const handleUpdateItem = (category, id, updates) => {
    setLocalSettings(prev => ({
      ...prev,
      [category]: prev[category].map(item => 
        item.id === id ? { ...item, ...updates } : item
      )
    }));
  };

  const handleDeleteItem = (category, id) => {
    if (window.confirm('이 항목을 정말 삭제하시겠습니까?')) {
      setLocalSettings(prev => ({
        ...prev,
        [category]: prev[category].filter(item => item.id !== id)
      }));
    }
  };

  const handleMoveItem = (category, index, direction) => {
    const items = [...localSettings[category]];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (newIndex < 0 || newIndex >= items.length) return;

    const temp = items[index];
    items[index] = items[newIndex];
    items[newIndex] = temp;
    
    items.forEach((item, idx) => {
      item.order = idx;
    });

    setLocalSettings(prev => ({
      ...prev,
      [category]: items
    }));
  };

  const handleSave = () => {
    try {
      onUpdateSettings(localSettings);
      showSuccess('설정이 성공적으로 저장되었습니다.');
      setHasChanges(false);
    } catch (error) {
      showError('설정 저장 중 오류가 발생했습니다.');
    }
  };

  const handleReset = () => {
    if (window.confirm('모든 변경 사항을 초기화하시겠습니까?')) {
      setLocalSettings({
        divisions: [...(settingsData.divisions || [])],
        statuses: [...(settingsData.statuses || [])],
        performanceCategories: [...(settingsData.performanceCategories || [])],
        performanceSubcategories: [...(settingsData.performanceSubcategories || [])],
        performanceItems: [...(settingsData.performanceItems || [])]
      });
      setHasChanges(false);
    }
  };

  const handleClose = () => {
    if (hasChanges) {
      if (window.confirm('저장되지 않은 변경 사항이 있습니다. 정말 닫으시겠습니까?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const getSubcategoryName = (subcategoryId) => {
    const subcategory = localSettings.performanceSubcategories.find(sub => sub.id === subcategoryId);
    if (subcategory) {
      const category = localSettings.performanceCategories.find(cat => cat.id === subcategory.categoryId);
      return (category?.name || '') + ' › ' + subcategory.name;
    }
    return '분류 없음';
  };

  const renderItemEditor = (item, category, index) => {
    const isEditing = item.isEditing;
    const isPerformance = category === 'performanceItems';

    return (
      <motion.div
        key={item.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={'settings-item' + (isPerformance ? ' performance-item' : '')}
      >
        <div className="item-content">
          <div className="item-main">
            {isEditing ? (
              isPerformance ? (
                <div className="performance-edit-form">
                  <div className="form-row">
                    <label>성과 항목명:</label>
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => handleUpdateItem(category, item.id, { name: e.target.value })}
                      className="item-name-input"
                      placeholder="성과 항목명을 입력하세요"
                    />
                  </div>
                  <div className="form-row">
                    <label>분류:</label>
                    <select
                      value={item.subcategoryId}
                      onChange={(e) => handleUpdateItem(category, item.id, { subcategoryId: e.target.value })}
                      className="subcategory-select"
                    >
                      <option value="">분류 선택</option>
                      {localSettings.performanceSubcategories.map(sub => {
                        const cat = localSettings.performanceCategories.find(c => c.id === sub.categoryId);
                        return (
                          <option key={sub.id} value={sub.id}>
                            {cat?.name} &gt; {sub.name}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div className="form-row">
                    <label>단위:</label>
                    <input
                      type="text"
                      value={item.unit}
                      onChange={(e) => handleUpdateItem(category, item.id, { unit: e.target.value })}
                      className="unit-input"
                      placeholder="예: hours, %, 억원, ppm"
                    />
                  </div>
                  
                  {/* 성과 수준 입력 필드 추가 */}
                  <div className="form-row">
                    <label>현재 수준:</label>
                    <input
                      type="text"
                      value={item.currentLevel || ''}
                      onChange={(e) => handleUpdateItem(category, item.id, { currentLevel: e.target.value })}
                      className="level-input"
                      placeholder="현재 수준을 입력하세요"
                    />
                  </div>
                  <div className="form-row">
                    <label>목표 수준:</label>
                    <input
                      type="text"
                      value={item.targetLevel || ''}
                      onChange={(e) => handleUpdateItem(category, item.id, { targetLevel: e.target.value })}
                      className="level-input"
                      placeholder="목표 수준을 입력하세요"
                    />
                  </div>
                  <div className="form-row">
                    <label>실적 수준 (선택사항):</label>
                    <input
                      type="text"
                      value={item.actualLevel || ''}
                      onChange={(e) => handleUpdateItem(category, item.id, { actualLevel: e.target.value })}
                      className="level-input"
                      placeholder="실적 수준을 입력하세요 (선택사항)"
                    />
                  </div>
                  
                  <div className="form-row">
                    <label>설명:</label>
                    <textarea
                      value={item.description}
                      onChange={(e) => handleUpdateItem(category, item.id, { description: e.target.value })}
                      className="description-textarea"
                      placeholder="이 성과 항목에 대한 설명을 입력하세요"
                      rows="2"
                    />
                  </div>
                  <div className="form-actions">
                    <button
                      onClick={() => handleUpdateItem(category, item.id, { isEditing: false })}
                      className="save-edit-btn"
                    >
                      저장
                    </button>
                  </div>
                </div>
              ) : (
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => handleUpdateItem(category, item.id, { name: e.target.value })}
                  onBlur={() => handleUpdateItem(category, item.id, { isEditing: false })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleUpdateItem(category, item.id, { isEditing: false });
                    }
                  }}
                  className="item-name-input"
                  autoFocus
                />
              )
            ) : (
              isPerformance ? (
                <div className="performance-display">
                  <div className="performance-name">{item.name}</div>
                  <div className="performance-details">
                    <span className="performance-category">
                      분류: {getSubcategoryName(item.subcategoryId)}
                    </span>
                    {item.unit && (
                      <span className="performance-unit">
                        단위: {item.unit}
                      </span>
                    )}
                  </div>
                  
                  {/* 성과 수준 표시 추가 */}
                  {(item.currentLevel || item.targetLevel || item.actualLevel) && (
                    <div className="performance-levels">
                      {item.currentLevel && (
                        <span className="performance-level">
                          현재: {item.currentLevel} {item.unit}
                        </span>
                      )}
                      {item.targetLevel && (
                        <span className="performance-level">
                          목표: {item.targetLevel} {item.unit}
                        </span>
                      )}
                      {item.actualLevel && (
                        <span className="performance-level">
                          실적: {item.actualLevel} {item.unit}
                        </span>
                      )}
                    </div>
                  )}
                  
                  {item.description && (
                    <div className="performance-description">
                      {item.description}
                    </div>
                  )}
                </div>
              ) : (
                <span 
                  className="item-name"
                  onDoubleClick={() => handleUpdateItem(category, item.id, { isEditing: true })}
                >
                  {item.name}
                </span>
              )
            )}

            {(category === 'divisions' || category === 'statuses') && (
              <div className="item-color">
                <input
                  type="color"
                  value={item.color || '#64748B'}
                  onChange={(e) => handleUpdateItem(category, item.id, { color: e.target.value })}
                  className="color-picker"
                  title="색상 선택"
                />
              </div>
            )}
          </div>
        </div>

        <div className="item-actions">
          <button
            onClick={() => handleMoveItem(category, index, 'up')}
            disabled={index === 0}
            className="move-btn"
            title="위로 이동"
          >
            위로
          </button>
          <button
            onClick={() => handleMoveItem(category, index, 'down')}
            disabled={index === localSettings[category].length - 1}
            className="move-btn"
            title="아래로 이동"
          >
            아래로
          </button>
          <button
            onClick={() => handleUpdateItem(category, item.id, { isEditing: !isEditing })}
            className="edit-btn"
            title="편집"
          >
            편집
          </button>
          <button
            onClick={() => handleDeleteItem(category, item.id)}
            className="delete-btn"
            title="삭제"
          >
            삭제
          </button>
        </div>
      </motion.div>
    );
  };

  const renderTabContent = () => {
    const currentTab = tabs.find(tab => tab.id === activeTab);
    const items = localSettings[currentTab.key] || [];

    return (
      <div className="tab-content">
        <div className="tab-header">
          <h3>{currentTab.label} 관리</h3>
          <button
            onClick={() => handleAddItem(currentTab.key)}
            className="add-item-btn"
          >
            추가
          </button>
        </div>

        <div className="items-list">
          <AnimatePresence>
            {items.map((item, index) => 
              renderItemEditor(item, currentTab.key, index)
            )}
          </AnimatePresence>

          {items.length === 0 && (
            <div className="empty-state">
              <p>{currentTab.label} 항목이 없습니다.</p>
              <button
                onClick={() => handleAddItem(currentTab.key)}
                className="empty-add-btn"
              >
                첫 {currentTab.label} 추가
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="settings-modal-overlay"
        onClick={(e) => e.target === e.currentTarget && handleClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", damping: 20 }}
          className="settings-modal"
        >
          <div className="modal-header">
            <h2>시스템 설정</h2>
            <button onClick={handleClose} className="close-btn">
              X
            </button>
          </div>

          <div className="modal-content">
            <div className="tab-navigation">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={'tab-btn' + (activeTab === tab.id ? ' active' : '')}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="tab-container">
              {renderTabContent()}
            </div>
          </div>

          <div className="modal-footer">
            <div className="changes-indicator">
              {hasChanges && (
                <span>
                  저장되지 않은 변경사항이 있습니다
                </span>
              )}
            </div>
            
            <div className="footer-actions">
              <button
                onClick={handleReset}
                disabled={!hasChanges}
                className="reset-btn"
              >
                초기화
              </button>
              
              <button
                onClick={handleSave}
                disabled={!hasChanges}
                className="save-btn"
              >
                저장
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SettingsModal;