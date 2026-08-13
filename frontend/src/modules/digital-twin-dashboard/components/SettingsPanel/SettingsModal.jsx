import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './SettingsModal.css';
import ConfirmDialog from '../common/ConfirmDialog';
import BulkAddModal from './BulkAddModal';
import { evalFactorPreview } from '../../utils/evalFactor';
import { todayLocalYmd } from '../../../../shared/utils/localDate';
import { fetchKpiDefinitions } from '../../../dx-kpi-management/services/kpiApi';
import { renameKpiContributionMethod } from '../../services/settingsApi';

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
    processes: [],
    projectDomains: [],
    taskCategories: [],
    departments: [],
    performanceCategories: [],
    performanceSubcategories: [],
    performanceEvaluations: [],
    reportStatuses: [],
    unitConversions: [],
    // ⚠️ 다른 탭과 달리 배열이 아니라 **{ 지표id: [방법, ...] }** 객체다.
    //    지표마다 쓸 수 있는 방법이 다르므로 평면 목록으로는 담기지 않는다.
    kpiContributionMethods: {}
  });
  const [hasChanges, setHasChanges] = useState(false);

  /* KPI 기여방법 탭 전용 상태 — 지표 목록은 dx-kpi-management 가 정본이라 여기서 받는다. */
  const [kpiDefs, setKpiDefs] = useState([]);
  const [methodKpiId, setMethodKpiId] = useState(null);
  const [methodDraft, setMethodDraft] = useState('');
  const [methodEditing, setMethodEditing] = useState(null);   // { index, value, original }
  const [methodBusy, setMethodBusy] = useState(false);
  const [methodBulk, setMethodBulk] = useState(false);   // 여러 개 붙여넣기 모드
  const [methodBulkText, setMethodBulkText] = useState('');

  // 확인 다이얼로그 상태
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'warning'
  });

  // 일괄 추가 모달 상태
  const [bulkAddModal, setBulkAddModal] = useState({
    isOpen: false,
    categoryType: '',
    categoryLabel: ''
  });

  useEffect(() => {
    if (!isOpen) return undefined;
    let alive = true;
    fetchKpiDefinitions()
      .then(list => { if (alive) setKpiDefs(list || []); })
      .catch(() => { /* 못 불러와도 다른 탭은 멀쩡해야 한다 */ });
    return () => { alive = false; };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && settingsData) {
      // id가 없는 항목들에 id 생성
      const ensureIds = (items, prefix) => {
        return items.map((item, index) => ({
          ...item,
          id: item.id || `${prefix}_${Date.now()}_${index}`
        }));
      };

      setLocalSettings({
        kpiContributionMethods: settingsData.kpiContributionMethods || {},
        divisions: ensureIds(settingsData.divisions || [], 'division'),
        statuses: ensureIds(settingsData.statuses || [], 'status'),
        processes: ensureIds(settingsData.processes || [], 'process'),
        projectDomains: ensureIds(settingsData.projectDomains || [], 'domain'),
        taskCategories: ensureIds(settingsData.taskCategories || [], 'taskcategory'),
        departments: ensureIds(settingsData.departments || [], 'department'),
        performanceCategories: ensureIds(settingsData.performanceCategories || [], 'perfcat'),
        performanceSubcategories: ensureIds(settingsData.performanceSubcategories || [], 'perfsubcat'),
        performanceEvaluations: ensureIds(settingsData.performanceEvaluations || [], 'perfeval'),
        reportStatuses: ensureIds(
          (settingsData.reportStatuses && settingsData.reportStatuses.length > 0)
            ? settingsData.reportStatuses
            : [
                { name: '협의체', order: 0, description: '' },
                { name: '서초', order: 1, description: '' }
              ],
          'rptstat'
        ),
        unitConversions: settingsData.unitConversions || []
      });
      setHasChanges(false);
    }
  }, [isOpen, settingsData]);

  useEffect(() => {
    if (!isOpen || !settingsData) return;

    const hasChanged = (
      JSON.stringify(localSettings.divisions) !== JSON.stringify(settingsData.divisions || []) ||
      JSON.stringify(localSettings.statuses) !== JSON.stringify(settingsData.statuses || []) ||
      JSON.stringify(localSettings.processes) !== JSON.stringify(settingsData.processes || []) ||
      JSON.stringify(localSettings.projectDomains) !== JSON.stringify(settingsData.projectDomains || []) ||
      JSON.stringify(localSettings.taskCategories) !== JSON.stringify(settingsData.taskCategories || []) ||
      JSON.stringify(localSettings.departments) !== JSON.stringify(settingsData.departments || []) ||
      JSON.stringify(localSettings.performanceCategories) !== JSON.stringify(settingsData.performanceCategories || []) ||
      JSON.stringify(localSettings.performanceSubcategories) !== JSON.stringify(settingsData.performanceSubcategories || []) ||
      JSON.stringify(localSettings.performanceEvaluations) !== JSON.stringify(settingsData.performanceEvaluations || []) ||
      JSON.stringify(localSettings.reportStatuses) !== JSON.stringify(settingsData.reportStatuses || []) ||
      JSON.stringify(localSettings.kpiContributionMethods) !== JSON.stringify(settingsData.kpiContributionMethods || {}) ||
      JSON.stringify(localSettings.unitConversions) !== JSON.stringify(settingsData.unitConversions || [])
    );

    setHasChanges(hasChanged);
  }, [localSettings, settingsData, isOpen]);

  const tabs = [
    { id: 'divisions', label: '사업부', key: 'divisions' },
    { id: 'processes', label: '프로세스', key: 'processes' },
    { id: 'projectDomains', label: '과제 영역', key: 'projectDomains' },
    { id: 'taskCategories', label: '과제 구분', key: 'taskCategories' },
    { id: 'departments', label: '부서/그룹', key: 'departments' },
    { id: 'statuses', label: '진행상태', key: 'statuses' },
    { id: 'performanceCategories', label: '성과 대분류', key: 'performanceCategories' },
    { id: 'performanceSubcategories', label: '성과 소분류', key: 'performanceSubcategories' },
    { id: 'performanceEvaluations', label: '조치 사항', key: 'performanceEvaluations' },
    { id: 'reportStatuses', label: '보고 현황', key: 'reportStatuses' },
    { id: 'unitConversions', label: '단위 환산', key: 'unitConversions' },
    { id: 'kpiContributionMethods', label: 'KPI 기여방법', key: 'kpiContributionMethods' }
  ];

  const handleAddItem = (category) => {
    const newItem = createNewItem(category);
    setLocalSettings(prev => ({
      ...prev,
      [category]: [...prev[category], newItem]
    }));
  };

  // 일괄 추가 모달 열기
  const handleOpenBulkAdd = (category) => {
    const tab = tabs.find(t => t.key === category);
    setBulkAddModal({
      isOpen: true,
      categoryType: category,
      categoryLabel: tab?.label || '항목'
    });
  };

  // 일괄 추가 처리
  const handleBulkAdd = (items) => {
    const category = bulkAddModal.categoryType;
    const currentLength = localSettings[category].length;

    const newItems = items.map((item, index) => {
      const id = category + '_' + Date.now() + '_' + (currentLength + index) + '_' + Math.random().toString(36).substr(2, 9);
      return {
        id,
        ...item,
        order: currentLength + index
      };
    });

    setLocalSettings(prev => ({
      ...prev,
      [category]: [...prev[category], ...newItems]
    }));
  };

  const createNewItem = (category) => {
    // 고유한 ID 생성 (timestamp + random)
    const id = category + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
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
      case 'processes':
        return {
          ...baseItem,
          description: ''
        };
      case 'taskCategories':
        return {
          ...baseItem,
          description: ''
        };
      case 'departments':
        return {
          ...baseItem,
          divisionId: null,
          description: ''
        };
      case 'statuses':
        return {
          ...baseItem,
          color: '#64748B',
          description: ''
        };
      case 'performanceCategories':
        return {
          ...baseItem,
          color: '#64748B',
          description: ''
        };
      case 'performanceSubcategories':
        return {
          ...baseItem,
          categoryId: localSettings.performanceCategories[0]?.id || '',
          unit: '',
          description: '',
          isAchievementType: false  // 달성형 여부 (false: 비교형, true: 달성형)
        };
      case 'performanceEvaluations':
        return {
          ...baseItem,
          description: ''
        };
      case 'reportStatuses':
        return {
          ...baseItem,
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
    setConfirmDialog({
      isOpen: true,
      title: '항목 삭제',
      message: '이 항목을 정말 삭제하시겠습니까?',
      variant: 'danger',
      onConfirm: () => {
        setLocalSettings(prev => ({
          ...prev,
          [category]: prev[category].filter(item => item.id !== id)
        }));
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
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

  const handleSave = async () => {
    try {
      await onUpdateSettings(localSettings);
      showSuccess('설정이 성공적으로 저장되었습니다.');
      setHasChanges(false);
    } catch (error) {
      console.error('설정 저장 실패:', error);
      showError('설정 저장 중 오류가 발생했습니다: ' + error.message);
    }
  };

  const handleReset = () => {
    setConfirmDialog({
      isOpen: true,
      title: '변경 사항 초기화',
      message: '모든 변경 사항을 초기화하시겠습니까?',
      variant: 'warning',
      onConfirm: () => {
        setLocalSettings({
          divisions: [...(settingsData.divisions || [])],
          statuses: [...(settingsData.statuses || [])],
          processes: [...(settingsData.processes || [])],
          projectDomains: [...(settingsData.projectDomains || [])],
          taskCategories: [...(settingsData.taskCategories || [])],
          departments: [...(settingsData.departments || [])],
          performanceCategories: [...(settingsData.performanceCategories || [])],
          performanceSubcategories: [...(settingsData.performanceSubcategories || [])],
          performanceEvaluations: [...(settingsData.performanceEvaluations || [])],
          reportStatuses: [...(settingsData.reportStatuses || [])],
          unitConversions: [...(settingsData.unitConversions || [])],
          kpiContributionMethods: settingsData.kpiContributionMethods || {}
        });
        setHasChanges(false);
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleClose = () => {
    if (hasChanges) {
      setConfirmDialog({
        isOpen: true,
        title: '변경 사항 취소',
        message: '저장되지 않은 변경 사항이 있습니다. 정말 닫으시겠습니까?',
        variant: 'warning',
        onConfirm: () => {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          onClose();
        }
      });
    } else {
      onClose();
    }
  };

  // 설정 내보내기 (JSON 파일로 다운로드)
  const handleExportSettings = () => {
    try {
      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        settings: localSettings
      };

      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `시스템설정_${todayLocalYmd()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showSuccess('설정이 파일로 내보내기되었습니다.');
    } catch (error) {
      console.error('설정 내보내기 실패:', error);
      showError('설정 내보내기 중 오류가 발생했습니다.');
    }
  };

  // 설정 불러오기 (JSON 파일 읽기)
  const handleImportSettings = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);

        // 데이터 유효성 검사
        if (!importedData.settings) {
          throw new Error('유효하지 않은 설정 파일입니다.');
        }

        const settings = importedData.settings;

        // 각 카테고리에 대해 id가 없는 항목에 id 부여
        const ensureIds = (items, prefix) => {
          if (!Array.isArray(items)) return [];
          return items.map((item, index) => ({
            ...item,
            id: item.id || `${prefix}_imported_${Date.now()}_${index}`
          }));
        };

        setConfirmDialog({
          isOpen: true,
          title: '설정 불러오기',
          message: `파일에서 설정을 불러오시겠습니까?\n\n현재 설정이 파일의 내용으로 대체됩니다.\n(저장 버튼을 눌러야 최종 반영됩니다)`,
          variant: 'warning',
          onConfirm: () => {
            setLocalSettings({
              divisions: ensureIds(settings.divisions || [], 'division'),
              statuses: ensureIds(settings.statuses || [], 'status'),
              processes: ensureIds(settings.processes || [], 'process'),
              projectDomains: ensureIds(settings.projectDomains || [], 'domain'),
              taskCategories: ensureIds(settings.taskCategories || [], 'taskcategory'),
              departments: ensureIds(settings.departments || [], 'department'),
              performanceCategories: ensureIds(settings.performanceCategories || [], 'perfcat'),
              performanceSubcategories: ensureIds(settings.performanceSubcategories || [], 'perfsubcat'),
              performanceEvaluations: ensureIds(settings.performanceEvaluations || [], 'perfeval'),
              reportStatuses: ensureIds(settings.reportStatuses || [], 'rptstat'),
              unitConversions: settings.unitConversions || []
            });
            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
            showSuccess('설정을 불러왔습니다. 저장 버튼을 눌러 반영하세요.');
          }
        });
      } catch (error) {
        console.error('설정 불러오기 실패:', error);
        showError('설정 파일을 읽는 중 오류가 발생했습니다: ' + error.message);
      }
    };

    reader.onerror = () => {
      showError('파일을 읽는 중 오류가 발생했습니다.');
    };

    reader.readAsText(file);
    // 같은 파일 다시 선택 가능하도록 초기화
    event.target.value = '';
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
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={'settings-item' + (isPerformance ? ' performance-item' : '')}
      >
        <div className="item-content">
          <div className="item-main">
            {isEditing ? (
              category === 'processes' ? (
                <div className="process-edit-form">
                  <div className="form-row">
                    <label>프로세스명:</label>
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => handleUpdateItem(category, item.id, { name: e.target.value })}
                      className="item-name-input"
                      placeholder="프로세스명을 입력하세요"
                    />
                  </div>
                  <div className="form-row">
                    <label>설명:</label>
                    <textarea
                      value={item.description || ''}
                      onChange={(e) => handleUpdateItem(category, item.id, { description: e.target.value })}
                      className="description-textarea"
                      placeholder="이 프로세스에 대한 설명을 입력하세요"
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
              ) : category === 'taskCategories' ? (
                <div className="task-category-edit-form">
                  <div className="form-row">
                    <label>과제 구분명:</label>
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => handleUpdateItem(category, item.id, { name: e.target.value })}
                      className="item-name-input"
                      placeholder="과제 구분명을 입력하세요"
                    />
                  </div>
                  <div className="form-row">
                    <label>설명:</label>
                    <textarea
                      value={item.description || ''}
                      onChange={(e) => handleUpdateItem(category, item.id, { description: e.target.value })}
                      className="description-textarea"
                      placeholder="이 과제 구분에 대한 설명을 입력하세요"
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
              ) : category === 'departments' ? (
                <div className="department-edit-form">
                  <div className="form-row">
                    <label>부서명:</label>
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => handleUpdateItem(category, item.id, { name: e.target.value })}
                      className="item-name-input"
                      placeholder="부서명을 입력하세요"
                    />
                  </div>
                  <div className="form-row">
                    <label>소속 사업부:</label>
                    <select
                      value={item.divisionId || ''}
                      onChange={(e) => handleUpdateItem(category, item.id, { divisionId: e.target.value || null })}
                      className="division-select"
                    >
                      <option value="">공통 부서 (사업부 미지정)</option>
                      {localSettings.divisions.map(div => (
                        <option key={div.id} value={div.id}>
                          {div.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-row">
                    <label>설명:</label>
                    <textarea
                      value={item.description || ''}
                      onChange={(e) => handleUpdateItem(category, item.id, { description: e.target.value })}
                      className="description-textarea"
                      placeholder="이 부서에 대한 설명을 입력하세요"
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
              ) : category === 'performanceSubcategories' ? (
                <div className="performance-subcategory-edit-form">
                  <div className="form-row">
                    <label>소분류명:</label>
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => handleUpdateItem(category, item.id, { name: e.target.value })}
                      className="item-name-input"
                      placeholder="소분류명을 입력하세요"
                    />
                  </div>
                  <div className="form-row">
                    <label>대분류:</label>
                    <select
                      value={item.categoryId || ''}
                      onChange={(e) => handleUpdateItem(category, item.id, { categoryId: e.target.value })}
                      className="category-select"
                    >
                      <option value="">대분류 선택</option>
                      {localSettings.performanceCategories.map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-row">
                    <label>단위:</label>
                    <input
                      type="text"
                      value={item.unit || ''}
                      onChange={(e) => handleUpdateItem(category, item.id, { unit: e.target.value })}
                      className="unit-input"
                      placeholder="예: hrs, %, 억원, 건, 대 (빈 칸 시 커스텀 입력 가능)"
                    />
                  </div>
                  <div className="form-row">
                    <label>설명:</label>
                    <textarea
                      value={item.description || ''}
                      onChange={(e) => handleUpdateItem(category, item.id, { description: e.target.value })}
                      className="description-textarea"
                      placeholder="이 소분류에 대한 설명을 입력하세요"
                      rows="2"
                    />
                  </div>
                  <div className="form-row checkbox-row">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={item.isAchievementType || false}
                        onChange={(e) => handleUpdateItem(category, item.id, { isAchievementType: e.target.checked })}
                        className="achievement-type-checkbox"
                      />
                      <span className="checkbox-text">달성형</span>
                      <span className="checkbox-hint">
                        (체크 시 "현재" 대신 "기준" 라벨로 표시됩니다)
                      </span>
                    </label>
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
              ) : isPerformance ? (
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
              category === 'processes' ? (
                <div className="process-display">
                  <div className="process-name">{item.name}</div>
                  {item.description && (
                    <div className="process-description">
                      {item.description}
                    </div>
                  )}
                </div>
              ) : category === 'taskCategories' ? (
                <div className="task-category-display">
                  <div className="task-category-name">{item.name}</div>
                  {item.description && (
                    <div className="task-category-description">
                      {item.description}
                    </div>
                  )}
                </div>
              ) : category === 'departments' ? (
                <div className="department-display">
                  <div className="department-name">{item.name}</div>
                  <div className="department-details">
                    <span className="department-division">
                      소속: {item.divisionId
                        ? localSettings.divisions.find(d => d.id === item.divisionId)?.name || '알 수 없음'
                        : '공통 부서'}
                    </span>
                  </div>
                  {item.description && (
                    <div className="department-description">
                      {item.description}
                    </div>
                  )}
                </div>
              ) : category === 'performanceSubcategories' ? (
                <div className="performance-subcategory-display">
                  <div className="subcategory-name">
                    {localSettings.performanceCategories.find(c => c.id === item.categoryId)?.name || '미지정'} › {item.name}
                    {item.unit && <span className="unit-badge">({item.unit})</span>}
                    {item.isAchievementType && <span className="achievement-type-badge">달성형</span>}
                  </div>
                  {item.description && (
                    <div className="subcategory-description">
                      {item.description}
                    </div>
                  )}
                </div>
              ) : isPerformance ? (
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

            {(category === 'divisions' || category === 'statuses' || category === 'performanceCategories') && (
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
            {category === 'performanceSubcategories' && isEditing && (
              <div className="item-category">
                <select
                  value={item.categoryId || ''}
                  onChange={(e) => handleUpdateItem(category, item.id, { categoryId: e.target.value })}
                  className="category-select"
                  title="대분류 선택"
                >
                  <option value="">대분류 선택</option>
                  {localSettings.performanceCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
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

  // === 단위 환산 탭 전용 함수들 ===
  const [expandedYearOverrides, setExpandedYearOverrides] = useState({}); // { convIndex: { year: true } }

  const handleAddConversion = () => {
    const newConversion = {
      id: `conv_${Date.now()}`,
      sourceUnit: '',
      targetUnit: '',
      label: '',
      defaultFactor: '1',
      description: '',
      divisionOverrides: {},
      yearOverrides: {}
    };
    setLocalSettings(prev => ({
      ...prev,
      unitConversions: [...prev.unitConversions, newConversion]
    }));
  };

  const handleUpdateConversion = (index, field, value) => {
    setLocalSettings(prev => {
      const updated = [...prev.unitConversions];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, unitConversions: updated };
    });
  };

  const handleDeleteConversion = (index) => {
    setLocalSettings(prev => ({
      ...prev,
      unitConversions: prev.unitConversions.filter((_, i) => i !== index)
    }));
  };

  const handleAddDivisionOverride = (convIndex, divisionName) => {
    setLocalSettings(prev => {
      const updated = [...prev.unitConversions];
      const conv = { ...updated[convIndex] };
      conv.divisionOverrides = {
        ...conv.divisionOverrides,
        [divisionName]: { factor: String(conv.defaultFactor), description: '' }
      };
      updated[convIndex] = conv;
      return { ...prev, unitConversions: updated };
    });
  };

  const handleUpdateDivisionOverride = (convIndex, divisionName, field, value) => {
    setLocalSettings(prev => {
      const updated = [...prev.unitConversions];
      const conv = { ...updated[convIndex] };
      conv.divisionOverrides = { ...conv.divisionOverrides };
      conv.divisionOverrides[divisionName] = {
        ...conv.divisionOverrides[divisionName],
        [field]: value
      };
      updated[convIndex] = conv;
      return { ...prev, unitConversions: updated };
    });
  };

  const handleDeleteDivisionOverride = (convIndex, divisionName) => {
    setLocalSettings(prev => {
      const updated = [...prev.unitConversions];
      const conv = { ...updated[convIndex] };
      conv.divisionOverrides = { ...conv.divisionOverrides };
      delete conv.divisionOverrides[divisionName];
      updated[convIndex] = conv;
      return { ...prev, unitConversions: updated };
    });
  };

  // 연도별 오버라이드 핸들러
  const handleAddYearOverride = (convIndex, year) => {
    setLocalSettings(prev => {
      const updated = [...prev.unitConversions];
      const conv = { ...updated[convIndex] };
      conv.yearOverrides = {
        ...conv.yearOverrides,
        [year]: { defaultFactor: String(conv.defaultFactor), divisionOverrides: {} }
      };
      updated[convIndex] = conv;
      return { ...prev, unitConversions: updated };
    });
    // 자동 펼침
    setExpandedYearOverrides(prev => ({
      ...prev,
      [convIndex]: { ...(prev[convIndex] || {}), [year]: true }
    }));
  };

  const handleUpdateYearOverride = (convIndex, year, field, value) => {
    setLocalSettings(prev => {
      const updated = [...prev.unitConversions];
      const conv = { ...updated[convIndex] };
      conv.yearOverrides = { ...conv.yearOverrides };
      conv.yearOverrides[year] = { ...conv.yearOverrides[year], [field]: value };
      updated[convIndex] = conv;
      return { ...prev, unitConversions: updated };
    });
  };

  const handleDeleteYearOverride = (convIndex, year) => {
    setLocalSettings(prev => {
      const updated = [...prev.unitConversions];
      const conv = { ...updated[convIndex] };
      conv.yearOverrides = { ...conv.yearOverrides };
      delete conv.yearOverrides[year];
      updated[convIndex] = conv;
      return { ...prev, unitConversions: updated };
    });
  };

  const handleAddYearDivisionOverride = (convIndex, year, divisionName) => {
    setLocalSettings(prev => {
      const updated = [...prev.unitConversions];
      const conv = { ...updated[convIndex] };
      conv.yearOverrides = { ...conv.yearOverrides };
      const yearData = { ...conv.yearOverrides[year] };
      yearData.divisionOverrides = {
        ...yearData.divisionOverrides,
        [divisionName]: { factor: String(yearData.defaultFactor), description: '' }
      };
      conv.yearOverrides[year] = yearData;
      updated[convIndex] = conv;
      return { ...prev, unitConversions: updated };
    });
  };

  const handleUpdateYearDivisionOverride = (convIndex, year, divisionName, field, value) => {
    setLocalSettings(prev => {
      const updated = [...prev.unitConversions];
      const conv = { ...updated[convIndex] };
      conv.yearOverrides = { ...conv.yearOverrides };
      const yearData = { ...conv.yearOverrides[year] };
      yearData.divisionOverrides = { ...yearData.divisionOverrides };
      yearData.divisionOverrides[divisionName] = {
        ...yearData.divisionOverrides[divisionName],
        [field]: value
      };
      conv.yearOverrides[year] = yearData;
      updated[convIndex] = conv;
      return { ...prev, unitConversions: updated };
    });
  };

  const handleDeleteYearDivisionOverride = (convIndex, year, divisionName) => {
    setLocalSettings(prev => {
      const updated = [...prev.unitConversions];
      const conv = { ...updated[convIndex] };
      conv.yearOverrides = { ...conv.yearOverrides };
      const yearData = { ...conv.yearOverrides[year] };
      yearData.divisionOverrides = { ...yearData.divisionOverrides };
      delete yearData.divisionOverrides[divisionName];
      conv.yearOverrides[year] = yearData;
      updated[convIndex] = conv;
      return { ...prev, unitConversions: updated };
    });
  };

  // 사업부 오버라이드 행 렌더링 (공통)
  const renderDivisionOverrideRow = (divName, override, fallbackFactor, onUpdate, onDelete, size = 'normal') => {
    const s = size === 'small';
    const preview = evalFactorPreview(override.factor ?? fallbackFactor);
    return (
      <div key={divName} className="uc-override-row">
        <span className={`uc-override-label${s ? ' uc-small' : ''}`}>{divName}</span>
        <div className="uc-override-factor-wrap">
          <input
            type="text"
            value={override.factor ?? fallbackFactor}
            onChange={(e) => onUpdate(divName, 'factor', e.target.value)}
            className="settings-input uc-override-input"
            placeholder="계수 또는 수식"
          />
          {preview && <span className="uc-factor-preview">{preview}</span>}
        </div>
        <input
          type="text"
          value={override.description || ''}
          onChange={(e) => onUpdate(divName, 'description', e.target.value)}
          placeholder="설명"
          className="settings-input uc-override-desc"
        />
        <button onClick={() => onDelete(divName)} className="uc-delete-x">X</button>
      </div>
    );
  };

  /* -- KPI 기여방법 (2026-08-07) --------------------------------------------
     다른 탭과 성격이 다르다 - 평면 목록이 아니라 **지표마다 다른 목록**이다.
     그래서 왼쪽에서 지표를 고르고 오른쪽에서 그 지표의 방법을 손본다.

     * 이름을 고치면 **이미 그 방법으로 적어 둔 연결도 함께** 바꾼다.
       안 그러면 사전에는 새 이름, 데이터에는 옛 이름이 남아 같은 뜻이 둘이 된다 -
       자유 텍스트를 사전으로 바꾼 이유가 그걸 없애려는 것이었다.
     * 삭제는 **정의만** 지우는 것이 기본이다. 연결에 적힌 문구는 남는다.
       사전에서 뺐다고 남이 이미 입력한 내용을 지우는 건 다른 얘기다.
       필요하면 '연결에서도 빼기' 를 골라 함께 지운다. */
  const methodsOf = (kid) => (localSettings.kpiContributionMethods || {})[String(kid)] || [];

  const setMethodsOf = (kid, list) => {
    setLocalSettings(prev => ({
      ...prev,
      kpiContributionMethods: { ...(prev.kpiContributionMethods || {}), [String(kid)]: list },
    }));
  };

  /**
   * 붙여넣은 덩어리 → 기여 방법 목록. (2026-08-07)
   *
   * 엑셀에서 여러 셀을 복사하면 **행은 줄바꿈, 열은 탭**으로 온다. 둘 다 끊어야
   * "한 열만 복사" 든 "여러 열 복사" 든 그대로 들어온다.
   * 따옴표로 감싸인 셀(줄바꿈 포함 셀)까지는 다루지 않는다 — 기여 방법은 한 줄짜리다.
   */
  const parseBulkMethods = (text) => {
    const raw = String(text || '')
      .split(/[\r\n\t]+/)
      .map((x) => x.trim().replace(/^"(.*)"$/, '$1').trim())
      .filter(Boolean);
    return [...new Set(raw)];               // 붙여넣기 안에서의 중복부터 먼저 없앤다
  };

  /** 미리보기 — 누르기 전에 몇 개가 들어가고 몇 개가 이미 있는지 보여 준다. */
  const bulkPreview = () => {
    const parsed = parseBulkMethods(methodBulkText);
    const cur = methodKpiId != null ? methodsOf(methodKpiId) : [];
    const fresh = parsed.filter((x) => !cur.includes(x));
    return { parsed, fresh, dup: parsed.length - fresh.length };
  };

  const addMethodsBulk = () => {
    if (methodKpiId == null) return;
    const { fresh } = bulkPreview();
    if (!fresh.length) { showError('추가할 새 항목이 없습니다.'); return; }
    setMethodsOf(methodKpiId, [...methodsOf(methodKpiId), ...fresh]);
    setMethodBulkText('');
    setMethodBulk(false);
    showSuccess(fresh.length + '개를 추가했습니다. 저장을 눌러야 반영됩니다.');
  };

  const addMethod = () => {
    const v = methodDraft.trim();
    if (!v || methodKpiId == null) return;
    const cur = methodsOf(methodKpiId);
    if (cur.includes(v)) { showError('이미 있는 기여 방법입니다.'); return; }
    setMethodsOf(methodKpiId, [...cur, v]);
    setMethodDraft('');
  };

  /** 이름 변경 - 사전과 연결을 **함께** 바꾼다. 서버가 먼저다(실패하면 사전도 안 바꾼다). */
  const commitMethodEdit = async () => {
    if (!methodEditing) return;
    const { index, value, original } = methodEditing;
    const next = value.trim();
    if (!next) { showError('빈 값으로는 바꿀 수 없습니다.'); return; }
    if (next === original) { setMethodEditing(null); return; }
    const cur = methodsOf(methodKpiId);
    if (cur.some((m, i) => i !== index && m === next)) {
      showError('이미 있는 기여 방법입니다.'); return;
    }
    setMethodBusy(true);
    try {
      const r = await renameKpiContributionMethod({
        kpiDefinitionId: methodKpiId, from: original, to: next,
      });
      setMethodsOf(methodKpiId, cur.map((m, i) => (i === index ? next : m)));
      setMethodEditing(null);
      showSuccess('기여 방법을 바꿨습니다. 연결 ' + (r && r.changed ? r.changed : 0) + '건에 함께 반영했습니다.');
    } catch (e) {
      showError('기여 방법 일괄 수정 실패: ' + e.message);
    } finally {
      setMethodBusy(false);
    }
  };

  /** 삭제 - 먼저 몇 건이 쓰고 있는지 세어 보고(dryRun) 물어본다. */
  const askDeleteMethod = async (index) => {
    const cur = methodsOf(methodKpiId);
    const target = cur[index];
    let used = 0;
    try {
      const r = await renameKpiContributionMethod({
        kpiDefinitionId: methodKpiId, from: target, to: target, dryRun: true,
      });
      used = (r && r.changed) || 0;
    } catch (e) { /* 못 세도 삭제 자체는 물어볼 수 있다 */ }

    const dropDefOnly = () => {
      setMethodsOf(methodKpiId, cur.filter((_, i) => i !== index));
      setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      showSuccess('목록에서 뺐습니다. 이미 입력된 기여 방법은 그대로 둡니다.');
    };
    const dropEverywhere = async () => {
      setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      setMethodBusy(true);
      try {
        const r = await renameKpiContributionMethod({
          kpiDefinitionId: methodKpiId, from: target, to: '',
        });
        setMethodsOf(methodKpiId, cur.filter((_, i) => i !== index));
        showSuccess('목록에서 빼고, 연결 ' + ((r && r.changed) || 0) + '건에서도 지웠습니다.');
      } catch (e) {
        showError('연결에서 빼기 실패: ' + e.message);
      } finally { setMethodBusy(false); }
    };

    if (used === 0) { dropDefOnly(); return; }
    setConfirmDialog({
      isOpen: true,
      title: '기여 방법 삭제',
      variant: 'warning',
      message: '"' + target + '" 을(를) 쓰는 연결이 ' + used + '건 있습니다.\n\n'
        + '[확인] 을 누르면 목록에서만 뺍니다 - 이미 입력된 내용은 그대로 남습니다.\n'
        + '연결에서도 지우려면 아래 버튼을 쓰세요.',
      onConfirm: dropDefOnly,
      extraAction: { label: '연결 ' + used + '건에서도 지우기', onClick: dropEverywhere },
    });
  };

  const renderKpiMethodsTab = () => {
    const sel = kpiDefs.find(k => k.id === methodKpiId) || null;
    const list = methodKpiId != null ? methodsOf(methodKpiId) : [];
    return (
      <div className="tab-content">
        <div className="tab-header">
          <h3>KPI 기여방법 관리</h3>
        </div>
        <p className="kpi-methods-desc">
          지표마다 <b>과제가 어떻게 기여하는지</b>를 미리 정의해 둡니다.
          과제 편집창의 &apos;DX KPI 연결&apos; 에서 이 목록을 골라 쓰고, 거기서 새로 적은 문구도
          이 목록에 자동으로 들어옵니다.
          <br />
          <b>이름을 고치면</b> 이미 그 방법으로 적어 둔 연결도 함께 바뀝니다.
          <b> 삭제</b>는 목록에서만 빼는 것이 기본이고, 연결에서도 지울지 따로 고를 수 있습니다.
        </p>

        <div className="kpi-methods-wrap">
          <div className="kpi-methods-list">
            {kpiDefs.length === 0 && <div className="kpi-methods-empty">지표를 불러오는 중...</div>}
            {kpiDefs.map(k => {
              const n = methodsOf(k.id).length;
              return (
                <button
                  key={k.id}
                  type="button"
                  className={'kpi-methods-item' + (methodKpiId === k.id ? ' active' : '')}
                  onClick={() => {
                    setMethodKpiId(k.id); setMethodEditing(null); setMethodDraft('');
                    setMethodBulk(false); setMethodBulkText('');
                  }}
                  title={k.label}
                >
                  <span className="name">{k.label}</span>
                  <span className={'count' + (n ? '' : ' zero')}>{n}</span>
                </button>
              );
            })}
          </div>

          <div className="kpi-methods-detail">
            {!sel ? (
              <div className="kpi-methods-empty">왼쪽에서 지표를 고르세요.</div>
            ) : (
              <>
                <div className="kpi-methods-title">{sel.label}</div>
                {!methodBulk ? (
                  <div className="kpi-methods-add">
                    <input
                      type="text"
                      value={methodDraft}
                      placeholder="기여 방법을 입력하고 Enter (예: 시뮬레이션으로 시제작 횟수 감소)"
                      onChange={(e) => setMethodDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMethod(); } }}
                      maxLength={140}
                    />
                    <button type="button" onClick={addMethod} disabled={!methodDraft.trim()}>추가</button>
                    <button type="button" className="kpi-methods-bulk-btn"
                            onClick={() => setMethodBulk(true)}>여러 개 붙여넣기</button>
                  </div>
                ) : (
                  <div className="kpi-methods-bulk">
                    <textarea
                      autoFocus
                      rows={6}
                      value={methodBulkText}
                      placeholder={'엑셀에서 여러 셀을 복사해 그대로 붙여넣으세요.\n한 줄(또는 한 칸)이 기여 방법 하나가 됩니다.'}
                      onChange={(e) => setMethodBulkText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); addMethodsBulk(); }
                        if (e.key === 'Escape') { setMethodBulkText(''); setMethodBulk(false); }
                      }}
                    />
                    {(() => {
                      const { parsed, fresh, dup } = bulkPreview();
                      if (!parsed.length) {
                        return <div className="kpi-methods-bulk-info">붙여넣으면 여기에 결과가 미리 보입니다. (Ctrl+Enter 로 추가)</div>;
                      }
                      return (
                        <div className="kpi-methods-bulk-info">
                          <b>{fresh.length}개</b> 추가
                          {dup > 0 && <span className="dup"> · 이미 있어서 제외 {dup}개</span>}
                          {fresh.length > 0 && (
                            <div className="preview">
                              {fresh.slice(0, 8).map((x) => <span key={x}>{x}</span>)}
                              {fresh.length > 8 && <span className="more">외 {fresh.length - 8}개</span>}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    <div className="kpi-methods-bulk-actions">
                      <button type="button" onClick={addMethodsBulk}
                              disabled={bulkPreview().fresh.length === 0}>
                        추가
                      </button>
                      <button type="button" className="ghost"
                              onClick={() => { setMethodBulkText(''); setMethodBulk(false); }}>
                        취소
                      </button>
                    </div>
                  </div>
                )}
                {list.length === 0 && (
                  <div className="kpi-methods-empty">아직 정의된 기여 방법이 없습니다.</div>
                )}
                <ul className="kpi-methods-items">
                  {list.map((m, i) => (
                    <li key={m + '-' + i}>
                      {methodEditing && methodEditing.index === i ? (
                        <>
                          <input
                            type="text"
                            value={methodEditing.value}
                            autoFocus
                            maxLength={140}
                            onChange={(e) => setMethodEditing({ ...methodEditing, value: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') { e.preventDefault(); commitMethodEdit(); }
                              if (e.key === 'Escape') setMethodEditing(null);
                            }}
                          />
                          <button type="button" onClick={commitMethodEdit} disabled={methodBusy}>
                            {methodBusy ? '반영 중...' : '저장'}
                          </button>
                          <button type="button" className="ghost" onClick={() => setMethodEditing(null)}>취소</button>
                        </>
                      ) : (
                        <>
                          <span className="text">{m}</span>
                          <button
                            type="button"
                            className="ghost"
                            onClick={() => setMethodEditing({ index: i, value: m, original: m })}
                          >수정</button>
                          <button type="button" className="ghost danger" onClick={() => askDeleteMethod(i)}>삭제</button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderUnitConversionsTab = () => {
    const conversions = localSettings.unitConversions || [];
    const divisions = localSettings.divisions || [];

    return (
      <div className="tab-content">
        <div className="tab-header">
          <h3>단위 환산 관리</h3>
          <div className="tab-header-actions">
            <button onClick={handleAddConversion} className="add-item-btn">
              환산 규칙 추가
            </button>
          </div>
        </div>

        <div className="items-list">
          {conversions.map((conv, index) => (
            <div key={conv.id || index} className="uc-rule-card">
              <div className="uc-rule-header">
                <strong>환산 규칙 #{index + 1}{conv.label ? ` - ${conv.label}` : ''}</strong>
                <button onClick={() => handleDeleteConversion(index)} className="delete-btn">삭제</button>
              </div>

              {/* 기본 정보 */}
              <div className="uc-fields-row">
                <div className="uc-field uc-field-grow">
                  <label className="uc-label">명칭</label>
                  <input type="text" value={conv.label || ''} onChange={(e) => handleUpdateConversion(index, 'label', e.target.value)} placeholder="예: Person-Month 환산" className="settings-input" />
                </div>
                <div className="uc-field uc-field-sm">
                  <label className="uc-label">원본 단위</label>
                  <input type="text" value={conv.sourceUnit || ''} onChange={(e) => handleUpdateConversion(index, 'sourceUnit', e.target.value)} placeholder="예: hrs" className="settings-input" />
                </div>
                <div className="uc-field uc-field-sm">
                  <label className="uc-label">변환 단위</label>
                  <input type="text" value={conv.targetUnit || ''} onChange={(e) => handleUpdateConversion(index, 'targetUnit', e.target.value)} placeholder="예: p/m" className="settings-input" />
                </div>
              </div>

              <div className="uc-fields-row">
                <div className="uc-field uc-field-sm">
                  <label className="uc-label">기본 환산계수</label>
                  <input type="text" value={conv.defaultFactor ?? '1'} onChange={(e) => handleUpdateConversion(index, 'defaultFactor', e.target.value)} placeholder="예: 1/168" className="settings-input" />
                  {evalFactorPreview(conv.defaultFactor) && <span className="uc-factor-preview">{evalFactorPreview(conv.defaultFactor)}</span>}
                </div>
                <div className="uc-field uc-field-grow">
                  <label className="uc-label">설명</label>
                  <input type="text" value={conv.description || ''} onChange={(e) => handleUpdateConversion(index, 'description', e.target.value)} placeholder="예: 1 p/m = 168hrs" className="settings-input" />
                </div>
              </div>

              {/* 사업부별 오버라이드 */}
              <div className="uc-section">
                <div className="uc-section-header">
                  <label className="uc-section-label">사업부별 환산계수 (선택)</label>
                  <select
                    onChange={(e) => { if (e.target.value) { handleAddDivisionOverride(index, e.target.value); e.target.value = ''; } }}
                    className="settings-input uc-add-select"
                    defaultValue=""
                  >
                    <option value="">사업부 추가...</option>
                    {divisions.filter(d => !conv.divisionOverrides?.[d.name]).map(d => (
                      <option key={d.name} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>
                {Object.entries(conv.divisionOverrides || {}).map(([divName, override]) =>
                  renderDivisionOverrideRow(divName, override, conv.defaultFactor,
                    (dn, f, v) => handleUpdateDivisionOverride(index, dn, f, v),
                    (dn) => handleDeleteDivisionOverride(index, dn)
                  )
                )}
                {Object.keys(conv.divisionOverrides || {}).length === 0 && (
                  <p className="uc-hint">사업부별 다른 환산계수가 필요하면 위 드롭다운에서 추가하세요.</p>
                )}
              </div>

              {/* 연도별 오버라이드 */}
              <div className="uc-section">
                <div className="uc-section-header">
                  <label className="uc-section-label">연도별 환산계수 (선택)</label>
                  <div className="uc-year-add">
                    <input type="number" id={`year-input-${index}`} placeholder="연도" min="2020" max="2040" className="settings-input uc-year-input" />
                    <button
                      onClick={() => {
                        const input = document.getElementById(`year-input-${index}`);
                        const year = input?.value;
                        if (year && !conv.yearOverrides?.[year]) { handleAddYearOverride(index, year); input.value = ''; }
                      }}
                      className="uc-year-add-btn"
                    >추가</button>
                  </div>
                </div>

                {Object.entries(conv.yearOverrides || {}).sort(([a], [b]) => a.localeCompare(b)).map(([year, yearData]) => {
                  const isExpanded = expandedYearOverrides[index]?.[year];
                  return (
                    <div key={year} className="uc-year-card">
                      <div
                        className={`uc-year-header${isExpanded ? ' uc-expanded' : ''}`}
                        onClick={() => setExpandedYearOverrides(prev => ({ ...prev, [index]: { ...(prev[index] || {}), [year]: !isExpanded } }))}
                      >
                        <div className="uc-year-header-left">
                          <span className={`uc-arrow${isExpanded ? ' uc-rotated' : ''}`}>▶</span>
                          <strong>{year}년</strong>
                          <span className="uc-year-factor">계수: {yearData.defaultFactor}</span>
                          {Object.keys(yearData.divisionOverrides || {}).length > 0 && (
                            <span className="uc-year-badge">사업부 {Object.keys(yearData.divisionOverrides).length}개</span>
                          )}
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteYearOverride(index, year); }} className="uc-delete-x">X</button>
                      </div>

                      {isExpanded && (
                        <div className="uc-year-body">
                          <div className="uc-fields-row">
                            <div className="uc-field uc-field-sm">
                              <label className="uc-label">{year}년 기본 환산계수</label>
                              <input type="text" value={yearData.defaultFactor ?? conv.defaultFactor} onChange={(e) => handleUpdateYearOverride(index, year, 'defaultFactor', e.target.value)} placeholder="계수 또는 수식" className="settings-input" />
                              {evalFactorPreview(yearData.defaultFactor ?? conv.defaultFactor) && <span className="uc-factor-preview">{evalFactorPreview(yearData.defaultFactor ?? conv.defaultFactor)}</span>}
                            </div>
                            <div className="uc-field uc-field-grow">
                              <label className="uc-label">설명</label>
                              <input type="text" value={yearData.description || ''} onChange={(e) => handleUpdateYearOverride(index, year, 'description', e.target.value)} placeholder={`예: ${year}년 기준`} className="settings-input" />
                            </div>
                          </div>

                          <div className="uc-nested-section">
                            <div className="uc-section-header">
                              <label className="uc-section-label uc-small">{year}년 사업부별 환산계수</label>
                              <select
                                onChange={(e) => { if (e.target.value) { handleAddYearDivisionOverride(index, year, e.target.value); e.target.value = ''; } }}
                                className="settings-input uc-add-select"
                                defaultValue=""
                              >
                                <option value="">사업부 추가...</option>
                                {divisions.filter(d => !yearData.divisionOverrides?.[d.name]).map(d => (
                                  <option key={d.name} value={d.name}>{d.name}</option>
                                ))}
                              </select>
                            </div>
                            {Object.entries(yearData.divisionOverrides || {}).map(([divName, override]) =>
                              renderDivisionOverrideRow(divName, override, yearData.defaultFactor,
                                (dn, f, v) => handleUpdateYearDivisionOverride(index, year, dn, f, v),
                                (dn) => handleDeleteYearDivisionOverride(index, year, dn),
                                'small'
                              )
                            )}
                            {Object.keys(yearData.divisionOverrides || {}).length === 0 && (
                              <p className="uc-hint">사업부별 다른 계수가 필요하면 위에서 추가하세요.</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {Object.keys(conv.yearOverrides || {}).length === 0 && (
                  <p className="uc-hint">연도별 다른 환산계수가 필요하면 위에서 연도를 추가하세요.</p>
                )}
              </div>
            </div>
          ))}

          {conversions.length === 0 && (
            <div className="empty-state">
              <p>단위 환산 규칙이 없습니다.</p>
              <button onClick={handleAddConversion} className="empty-add-btn">첫 환산 규칙 추가</button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // 일괄 추가 지원 카테고리
  const bulkAddCategories = ['departments', 'performanceCategories', 'performanceSubcategories'];

  const renderTabContent = () => {
    if (activeTab === 'unitConversions') {
      return renderUnitConversionsTab();
    }
    if (activeTab === 'kpiContributionMethods') {
      return renderKpiMethodsTab();
    }

    const currentTab = tabs.find(tab => tab.id === activeTab);
    const items = localSettings[currentTab.key] || [];
    const supportsBulkAdd = bulkAddCategories.includes(currentTab.key);

    return (
      <div className="tab-content">
        <div className="tab-header">
          <h3>{currentTab.label} 관리</h3>
          <div className="tab-header-actions">
            <button
              onClick={() => handleAddItem(currentTab.key)}
              className="add-item-btn"
            >
              추가
            </button>
            {supportsBulkAdd && (
              <button
                onClick={() => handleOpenBulkAdd(currentTab.key)}
                className="bulk-add-item-btn"
              >
                일괄 추가
              </button>
            )}
          </div>
        </div>

        <div className="items-list">
          <AnimatePresence>
            {items.map((item, index) =>
              <React.Fragment key={item.id || `item-${index}`}>
                {renderItemEditor(item, currentTab.key, index)}
              </React.Fragment>
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

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="settings-modal"
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
            <div className="footer-left">
              <div className="import-export-actions">
                <button
                  onClick={handleExportSettings}
                  className="export-btn"
                  title="현재 설정을 JSON 파일로 내보내기"
                >
                  📤 내보내기
                </button>
                <label className="import-btn" title="JSON 파일에서 설정 불러오기">
                  📥 불러오기
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportSettings}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
              <div className="changes-indicator">
                {hasChanges && (
                  <span>
                    저장되지 않은 변경사항이 있습니다
                  </span>
                )}
              </div>
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
      )}

      {/* 확인 다이얼로그 */}
      {confirmDialog.isOpen && (
        <ConfirmDialog
          key="settings-confirm-dialog"
          isOpen={confirmDialog.isOpen}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
          title={confirmDialog.title}
          message={confirmDialog.message}
          variant={confirmDialog.variant}
          extraAction={confirmDialog.extraAction || null}
        />
      )}

      {/* 일괄 추가 모달 */}
      <BulkAddModal
        isOpen={bulkAddModal.isOpen}
        onClose={() => setBulkAddModal(prev => ({ ...prev, isOpen: false }))}
        onAdd={handleBulkAdd}
        categoryType={bulkAddModal.categoryType}
        categoryLabel={bulkAddModal.categoryLabel}
        performanceCategories={localSettings.performanceCategories}
        divisions={localSettings.divisions}
      />
    </AnimatePresence>
  );
};

export default SettingsModal;