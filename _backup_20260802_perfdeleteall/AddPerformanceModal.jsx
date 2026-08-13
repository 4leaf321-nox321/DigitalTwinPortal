import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Target, Search, Filter, Trash2, AlertTriangle, Cloud, Copy, LayoutGrid, List, HelpCircle } from 'lucide-react';
import ConfirmDialog from '../common/ConfirmDialog';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../../../../contexts/AuthContext';
import { fetchSystemSettings, saveSystemSettings } from '../../services/settingsApi';
// 충돌(409)은 고장이 아니라 정상 결과다 — 문구 규칙은 어댑터 한 곳에 둔다.
import { saveErrorMessage } from '../../services/dashboardWriteApi';

// ============== 계산 로직 엔진 ==============

const calculateLogicResult = (변수목록, 연산타입, 연산설정, valueField) => {
  const values = 변수목록.map(v => parseFloat(v[valueField]) || 0);
  const hasAnyValue = 변수목록.some(v => v[valueField] !== '' && v[valueField] !== undefined);

  if (!hasAnyValue) return '';

  switch (연산타입) {
    case 'SUM':
      return values.reduce((a, b) => a + b, 0);

    case 'MULTIPLY':
      return values.reduce((a, b) => a * b, 1);

    case 'DIVIDE':
      if (values.length < 2) return values[0] || 0;
      return values.slice(1).reduce((a, b) => (b !== 0 ? a / b : 0), values[0]);

    case 'AVERAGE':
      if (values.length === 0) return 0;
      return values.reduce((a, b) => a + b, 0) / values.length;

    case 'SUM_THEN_MULTIPLY': {
      if (!연산설정 || !연산설정.그룹연산) return 0;
      const groups = {};
      변수목록.forEach(v => {
        const grp = v.그룹 || 'A';
        if (!groups[grp]) groups[grp] = [];
        groups[grp].push(parseFloat(v[valueField]) || 0);
      });

      const groupResults = {};
      연산설정.그룹연산.forEach(gs => {
        const grpValues = groups[gs.그룹] || [];
        if (gs.연산 === 'SUM') {
          groupResults[gs.그룹] = grpValues.reduce((a, b) => a + b, 0);
        } else if (gs.연산 === 'MULTIPLY') {
          groupResults[gs.그룹] = grpValues.reduce((a, b) => a * b, 1);
        } else if (gs.연산 === 'AVERAGE') {
          groupResults[gs.그룹] = grpValues.length > 0 ? grpValues.reduce((a, b) => a + b, 0) / grpValues.length : 0;
        }
      });

      const grpVals = Object.values(groupResults);
      if (grpVals.length === 0) return 0;

      const 그룹간연산 = 연산설정.그룹간연산 || 'MULTIPLY';
      if (그룹간연산 === 'MULTIPLY') {
        return grpVals.reduce((a, b) => a * b, 1);
      } else if (그룹간연산 === 'SUM') {
        return grpVals.reduce((a, b) => a + b, 0);
      } else if (그룹간연산 === 'DIVIDE') {
        return grpVals.slice(1).reduce((a, b) => (b !== 0 ? a / b : 0), grpVals[0]);
      }
      return grpVals.reduce((a, b) => a * b, 1);
    }

    default:
      return values.reduce((a, b) => a + b, 0);
  }
};

const calculateAllLogicResults = (계산로직) => {
  if (!계산로직 || !계산로직.변수목록 || 계산로직.변수목록.length === 0) {
    return { 현재수준: '', 목표수준: '', 실적수준: '' };
  }

  const { 변수목록, 연산타입, 연산설정 } = 계산로직;

  const formatResult = (val) => {
    if (val === '' || val === undefined) return '';
    const num = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(num)) return '';
    return Number.isInteger(num) ? String(num) : num.toFixed(4).replace(/\.?0+$/, '');
  };

  return {
    현재수준: formatResult(calculateLogicResult(변수목록, 연산타입, 연산설정, '현재')),
    목표수준: formatResult(calculateLogicResult(변수목록, 연산타입, 연산설정, '목표')),
    실적수준: formatResult(calculateLogicResult(변수목록, 연산타입, 연산설정, '실적'))
  };
};

const AddPerformanceModal = ({
  isOpen,
  onClose,
  onSubmit,
  onSubmitAndUpload, // 성과 생성 후 서버 바로 업로드
  onDelete, // 새로 추가된 props
  settingsData = {},
  globalPerformances = [],
  showSuccess,
  showError,
  initialPerformanceToEdit = null, // 초기 편집할 성과 (수정 버튼에서 전달)
  currentYear = null // 메인 화면의 현재 연도
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.is_admin;

  const [formData, setFormData] = useState({
    성과년도: new Date().getFullYear(),
    대분류: '',
    소분류: '',
    성과항목: '',
    현재수준: '',
    목표수준: '',
    로직입력여부: false,
    월별실적여부: false,
    실적수준: '',
    월별실적: Array(12).fill(''),
    단위: '',
    디지털트윈기여도여부: false,
    디지털트윈기여도: '100',
    조치사항: '',
    조치사항목록: [],
    보고현황목록: [],
    설명: '',
    계산로직: null
  });

  const [logicModalOpen, setLogicModalOpen] = useState(false);
  const [logicData, setLogicData] = useState(null);
  const [templateListOpen, setTemplateListOpen] = useState(false);
  const [templateSearchTerm, setTemplateSearchTerm] = useState('');
  const [templatePage, setTemplatePage] = useState(0);

  const [selectedCategory, setSelectedCategory] = useState('');
  const [availableSubcategories, setAvailableSubcategories] = useState([]);
  const [editingPerformance, setEditingPerformance] = useState(null); // 수정 중인 성과 항목
  const [shouldFocusPerformanceName, setShouldFocusPerformanceName] = useState(false); // 포커스 트리거 플래그
  const [selectedDivision, setSelectedDivision] = useState(''); // 사업부 선택

  // 사업부 select에 대한 ref
  const divisionSelectRef = useRef(null);

  // 대분류 select에 대한 ref
  const categorySelectRef = useRef(null);

  // 성과 항목명 input에 대한 ref
  const performanceNameInputRef = useRef(null);

  // 수정 필요 사항 드롭다운 ref (외부 클릭 감지용)
  const actionDropdownRef = useRef(null);

  // 보고 현황 드롭다운 ref (외부 클릭 감지용)
  const reportDropdownRef = useRef(null);

  // 리스트용 상태
  const [listViewMode, setListViewMode] = useState('table'); // 'card' | 'table'
  const [searchTerm, setSearchTerm] = useState('');
  const [yearFilter, setYearFilter] = useState(currentYear ? String(currentYear) : '');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [subcategoryFilter, setSubcategoryFilter] = useState('');
  const [divisionFilter, setDivisionFilter] = useState(''); // 사업부 필터
  const [actionFilter, setActionFilter] = useState(''); // 조치사항 필터
  const [monthlyFilter, setMonthlyFilter] = useState(''); // 월별 실적 관리 여부 필터
  const [actionSearchTerm, setActionSearchTerm] = useState(''); // 수정 필요 사항 검색어
  const [isActionDropdownOpen, setIsActionDropdownOpen] = useState(false); // 수정 필요 사항 드롭다운 열림 상태
  const [reportSearchTerm, setReportSearchTerm] = useState(''); // 보고 현황 검색어
  const [isReportDropdownOpen, setIsReportDropdownOpen] = useState(false); // 보고 현황 드롭다운 열림 상태

  // 편집 모드에서 id 수정용 상태
  const [editingId, setEditingId] = useState('');

  // 삭제 확인 모달 상태
  const [deleteConfirm, setDeleteConfirm] = useState({
    isOpen: false,
    performance: null,
    connectedProjects: []
  });

  // 전체 삭제 확인 모달 상태
  const [deleteAllConfirm, setDeleteAllConfirm] = useState({
    isOpen: false
  });

  // 닫기 확인 모달 상태
  const [closeConfirm, setCloseConfirm] = useState({
    isOpen: false
  });

  // 드래그 감지 (텍스트 선택 드래그가 오버레이에서 끝나도 모달 닫히지 않도록)
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });

  // 설정 데이터에서 카테고리와 서브카테고리 목록 가져오기
  const categories = settingsData.performanceCategories || [];
  const subcategories = settingsData.performanceSubcategories || [];
  const performanceEvaluations = settingsData.performanceEvaluations || [];
  const reportStatuses = settingsData.reportStatuses || [];

  // 사업부 목록 (시스템 설정에서 가져온 것 + "공통")
  const divisions = settingsData.divisions || [];
  const divisionNames = divisions.map(d => d.name);
  const divisionOptions = ['공통', ...divisionNames];

  useEffect(() => {
    if (selectedCategory) {
      const filteredSubs = subcategories.filter(sub => sub.categoryId === selectedCategory);
      setAvailableSubcategories(filteredSubs);
    } else {
      setAvailableSubcategories([]);
    }
  }, [selectedCategory, subcategories]);

  // 포커스 이동을 위한 useEffect (성과 추가 후 사업부 드롭다운으로 포커스)
  useEffect(() => {
    if (shouldFocusPerformanceName) {
      // 약간의 지연을 두고 포커스 이동
      const timer = setTimeout(() => {
        if (divisionSelectRef.current) {
          divisionSelectRef.current.focus();
        }
        setShouldFocusPerformanceName(false);
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [shouldFocusPerformanceName]);

  // 수정 필요 사항 드롭다운 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (actionDropdownRef.current && !actionDropdownRef.current.contains(event.target)) {
        setIsActionDropdownOpen(false);
      }
    };

    if (isActionDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isActionDropdownOpen]);

  // 보고 현황 드롭다운 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (reportDropdownRef.current && !reportDropdownRef.current.contains(event.target)) {
        setIsReportDropdownOpen(false);
      }
    };

    if (isReportDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isReportDropdownOpen]);

  useEffect(() => {
    if (isOpen) {
      // 모달이 열릴 때 폼 초기화
      setFormData({
        성과년도: new Date().getFullYear(),
        대분류: '',
        소분류: '',
        성과항목: '',
        현재수준: '',
        목표수준: '',
        로직입력여부: false,
        월별실적여부: false,
        실적수준: '',
        월별실적: Array(12).fill(''),
        단위: '',
        디지털트윈기여도여부: false,
        디지털트윈기여도: '100',
        조치사항: '',
        조치사항목록: [],
        보고현황목록: [],
        설명: '',
        계산로직: null
      });
      setLogicModalOpen(false);
      setLogicData(null);
      setSelectedCategory('');
      setSelectedDivision('');
      setSearchTerm('');
      setYearFilter(currentYear ? String(currentYear) : '');
      setCategoryFilter('');
      setSubcategoryFilter('');
      setDivisionFilter('');
      setActionFilter('');
      setDeleteConfirm({ isOpen: false, performance: null, connectedProjects: [] });
      setDeleteAllConfirm({ isOpen: false });
      setEditingPerformance(null);
      setEditingId('');

      // 초기 편집할 성과가 있으면 해당 성과 로드
      if (initialPerformanceToEdit) {
        // 약간의 지연을 두고 편집 모드로 전환 (폼 초기화 후)
        setTimeout(() => {
          // globalPerformances에서 해당 성과 찾기 (다양한 방법으로 매칭)
          const performanceToEdit = globalPerformances.find(p => {
            // UUID로 매칭 (가장 정확)
            if (initialPerformanceToEdit.uuid && p.uuid === initialPerformanceToEdit.uuid) return true;
            if (initialPerformanceToEdit.성과항목UUID && p.uuid === initialPerformanceToEdit.성과항목UUID) return true;
            if (initialPerformanceToEdit.성과UUID && p.uuid === initialPerformanceToEdit.성과UUID) return true;

            // ID로 매칭
            if (initialPerformanceToEdit.id && p.id === initialPerformanceToEdit.id) return true;
            if (initialPerformanceToEdit.성과항목ID && p.id === initialPerformanceToEdit.성과항목ID) return true;

            // 성과항목명으로 매칭 (fallback)
            if (initialPerformanceToEdit.성과항목 && p.성과항목 === initialPerformanceToEdit.성과항목) return true;

            return false;
          });

          if (performanceToEdit) {
            handleEditPerformance(performanceToEdit);
          }
        }, 150);
      } else {
        // 모달이 열릴 때 사업부 select로 포커스 이동
        setTimeout(() => {
          if (divisionSelectRef.current) {
            divisionSelectRef.current.focus();
          }
        }, 100);
      }
    }
  }, [isOpen, initialPerformanceToEdit, globalPerformances]);

  const handleCategoryChange = (categoryId) => {
    setSelectedCategory(categoryId);
    const category = categories.find(cat => cat.id === categoryId);

    setFormData(prev => ({
      ...prev,
      대분류: category ? category.name : '',
      소분류: '', // 대분류 변경 시 소분류 초기화
      단위: '' // 소분류 선택 시 단위가 자동 설정됨
    }));
  };

  const handleSubcategoryChange = (subcategoryId) => {
    const subcategory = subcategories.find(sub => sub.id === subcategoryId);
    const subcategoryName = subcategory ? subcategory.name : '';

    // 소분류의 unit 필드에서 단위 가져오기
    let autoUnit = '';
    if (subcategory && subcategory.unit) {
      autoUnit = subcategory.unit;
    }
    // unit이 없으면 빈 문자열로 설정하여 커스텀 입력 가능하게 함

    setFormData(prev => ({
      ...prev,
      소분류: subcategoryName,
      단위: autoUnit
    }));
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 단위가 자동 설정되는 조건 확인
  const isUnitAutoSet = () => {
    const { 소분류 } = formData;

    // 선택된 소분류 찾기
    const selectedSubcategory = subcategories.find(sub => sub.name === 소분류);

    // 소분류에 unit 필드가 정의되어 있으면 자동 설정됨
    if (selectedSubcategory && selectedSubcategory.unit) {
      return true;
    }

    return false;
  };

  // 선택된 소분류가 달성형인지 확인
  const isAchievementType = () => {
    const { 소분류 } = formData;

    // 선택된 소분류 찾기
    const selectedSubcategory = subcategories.find(sub => sub.name === 소분류);

    // 소분류에 isAchievementType 필드가 true면 달성형
    return selectedSubcategory?.isAchievementType || false;
  };

  // 현재/기준 라벨 (달성형이면 "기준", 비교형이면 "현재")
  const getCurrentLabel = () => {
    return isAchievementType() ? '기준' : '현재';
  };

  // 특정 성과 항목의 달성형 여부 확인 (목록 표시용)
  const isPerformanceAchievementType = (performance) => {
    const subcategoryName = performance?.소분류;
    const selectedSubcategory = subcategories.find(sub => sub.name === subcategoryName);
    return selectedSubcategory?.isAchievementType || false;
  };

  // 특정 성과 항목의 현재/기준 라벨 (목록 표시용)
  const getPerformanceCurrentLabel = (performance) => {
    return isPerformanceAchievementType(performance) ? '기준' : '현재';
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // 필수 필드 검증
    if (!formData.성과항목.trim()) {
      showError('성과 항목명을 입력해주세요.');
      return;
    }

    if (!selectedDivision) {
      showError('사업부를 선택해주세요.');
      return;
    }

    if (!formData.대분류) {
      showError('대분류를 선택해주세요.');
      return;
    }

    if (!formData.소분류) {
      showError('소분류를 선택해주세요.');
      return;
    }

    // 성과항목명에 사업부 추가
    const finalPerformanceName = `[${selectedDivision}] ${formData.성과항목}`;

    if (editingPerformance) {
      // 수정 모드
      const oldId = editingPerformance.id;
      const newId = editingId;
      const idChanged = oldId !== newId;

      // ID 중복 체크 (변경된 경우에만)
      if (idChanged && globalPerformances.some(p => p.id === newId && p.uuid !== editingPerformance.uuid)) {
        showError(`이미 사용 중인 ID입니다: ${newId}`);
        return;
      }

      const updatedPerformance = {
        ...editingPerformance,
        ...formData,
        id: newId, // 수정된 ID 적용
        성과항목: finalPerformanceName,
        updatedAt: new Date().toISOString(),
        isEditing: true, // 수정 모드임을 표시
        _idChanged: idChanged ? { oldId, newId } : null, // ID 변경 정보
        isAchievementType: isAchievementType() // 달성형 여부 저장
      };

      try {
        onSubmit(updatedPerformance);
        showSuccess(idChanged
          ? `성과 항목이 수정되었습니다. (ID: ${oldId} → ${newId})`
          : '성과 항목이 성공적으로 수정되었습니다.');
        handleFormReset();
      } catch (error) {
        showError('성과 수정 중 오류가 발생했습니다: ' + error.message);
      }
    } else {
      // 새로 생성 모드
      // UUID 기반 고유 ID 생성 (충돌 방지)
      const newUuid = uuidv4();
      const uniqueId = `perf-${newUuid.substring(0, 8)}`; // UUID 앞 8자리 사용

      const newPerformance = {
        ...formData,
        성과항목: finalPerformanceName,
        id: uniqueId, // UUID 기반 고유 ID (절대 충돌 안함)
        uuid: newUuid, // 전체 UUID (백엔드용)
        createdAt: new Date().toISOString(),
        isActive: true,
        isEditing: false, // 새 생성임을 표시
        isAchievementType: isAchievementType() // 달성형 여부 저장
      };

      try {
        onSubmit(newPerformance);
        showSuccess('새 성과 항목이 성공적으로 생성되었습니다. 이제 각 과제에서 이 성과를 선택할 수 있습니다.');
        handleFormReset();
      } catch (error) {
        showError('성과 생성 중 오류가 발생했습니다: ' + error.message);
      }
    }
  };

  // 성과 항목 생성 후 서버 바로 업로드
  const handleSubmitAndUpload = async (e) => {
    e.preventDefault();

    // 필수 필드 검증
    if (!formData.성과항목.trim()) {
      showError('성과 항목명을 입력해주세요.');
      return;
    }

    if (!selectedDivision) {
      showError('사업부를 선택해주세요.');
      return;
    }

    if (!formData.대분류) {
      showError('대분류를 선택해주세요.');
      return;
    }

    if (!formData.소분류) {
      showError('소분류를 선택해주세요.');
      return;
    }

    // 성과항목명에 사업부 추가
    const finalPerformanceName = `[${selectedDivision}] ${formData.성과항목}`;

    if (editingPerformance) {
      // 수정 모드
      const oldId = editingPerformance.id;
      const newId = editingId;
      const idChanged = oldId !== newId;

      // ID 중복 체크 (변경된 경우에만)
      if (idChanged && globalPerformances.some(p => p.id === newId && p.uuid !== editingPerformance.uuid)) {
        showError(`이미 사용 중인 ID입니다: ${newId}`);
        return;
      }

      const updatedPerformance = {
        ...editingPerformance,
        ...formData,
        id: newId, // 수정된 ID 적용
        성과항목: finalPerformanceName,
        updatedAt: new Date().toISOString(),
        isEditing: true,
        _idChanged: idChanged ? { oldId, newId } : null, // ID 변경 정보
        isAchievementType: isAchievementType() // 달성형 여부 저장
      };

      try {
        if (onSubmitAndUpload) {
          await onSubmitAndUpload(updatedPerformance);
          showSuccess(idChanged
            ? `성과 항목이 수정되고 서버에 업로드되었습니다. (ID: ${oldId} → ${newId})`
            : '성과 항목이 수정되고 서버에 업로드되었습니다.');
        } else {
          onSubmit(updatedPerformance);
          showSuccess(idChanged
            ? `성과 항목이 수정되었습니다. (ID: ${oldId} → ${newId})`
            : '성과 항목이 수정되었습니다.');
        }
        handleFormReset();
      } catch (error) {
        showError(saveErrorMessage(error, '성과 수정 및 서버 업로드 중 오류가 발생했습니다'));
      }
    } else {
      // 새로 생성 모드
      // UUID 기반 고유 ID 생성 (충돌 방지)
      const newUuid = uuidv4();
      const uniqueId = `perf-${newUuid.substring(0, 8)}`; // UUID 앞 8자리 사용

      const newPerformance = {
        ...formData,
        성과항목: finalPerformanceName,
        id: uniqueId, // UUID 기반 고유 ID (절대 충돌 안함)
        uuid: newUuid, // 전체 UUID (백엔드용)
        createdAt: new Date().toISOString(),
        isActive: true,
        isEditing: false,
        isAchievementType: isAchievementType() // 달성형 여부 저장
      };

      try {
        if (onSubmitAndUpload) {
          await onSubmitAndUpload(newPerformance);
          showSuccess('새 성과 항목이 생성되고 서버에 업로드되었습니다.');
        } else {
          onSubmit(newPerformance);
          showSuccess('새 성과 항목이 생성되었습니다.');
        }
        handleFormReset();
      } catch (error) {
        showError(saveErrorMessage(error, '성과 생성 및 서버 업로드 중 오류가 발생했습니다'));
      }
    }
  };

  // 다른 이름으로 저장 (현재 편집 중인 성과를 새로운 인스턴스로 생성)
  // 2026-08-01 서버 경로로 연결 — 예전엔 `onSubmit`(로컬 전용)을 불렀다.
  // 컷오버로 '서버에 저장' 일괄 업로드 메뉴가 없어져서, 로컬에만 저장하면
  // **만든 성과가 새로고침에 통째로 사라진다.**
  const handleSaveAsNew = async () => {
    // 필수 필드 검증
    if (!formData.성과항목.trim()) {
      showError('성과 항목명을 입력해주세요.');
      return;
    }

    if (!selectedDivision) {
      showError('사업부를 선택해주세요.');
      return;
    }

    if (!formData.대분류) {
      showError('대분류를 선택해주세요.');
      return;
    }

    if (!formData.소분류) {
      showError('소분류를 선택해주세요.');
      return;
    }

    // 성과항목명에 사업부 추가
    const finalPerformanceName = `[${selectedDivision}] ${formData.성과항목}`;

    // UUID 기반 고유 ID 생성 (충돌 방지)
    const newUuid = uuidv4();
    const uniqueId = `perf-${newUuid.substring(0, 8)}`; // UUID 앞 8자리 사용

    // 새 성과 객체 생성 (기존 ID, UUID 제외)
    const newPerformance = {
      ...formData,
      성과항목: finalPerformanceName,
      id: uniqueId, // UUID 기반 고유 ID (절대 충돌 안함)
      uuid: newUuid, // 전체 UUID (백엔드용)
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
      isEditing: false,
      isAchievementType: isAchievementType() // 달성형 여부 저장
    };

    if (onSubmitAndUpload) {
      try {
        await onSubmitAndUpload(newPerformance);
        showSuccess(`새 성과 항목 "${finalPerformanceName}"이 생성되었습니다.`);
        handleFormReset();
      } catch (error) {
        showError(saveErrorMessage(error, '성과 생성 중 오류가 발생했습니다'));
      }
      return;
    }

    onSubmit(newPerformance);
    showSuccess(`새 성과 항목 "${finalPerformanceName}"이 생성되었습니다.`);
    handleFormReset();
  };

  // 폼 초기화 함수 (성과 추가 후 호출)
  const handleFormReset = () => {
    setFormData({
      성과년도: new Date().getFullYear(),
      대분류: '',
      소분류: '',
      성과항목: '',
      현재수준: '',
      목표수준: '',
      로직입력여부: false,
      월별실적여부: false,
      실적수준: '',
      월별실적: Array(12).fill(''),
      단위: '',
      디지털트윈기여도여부: false,
      디지털트윈기여도: '100',
      조치사항: '',
      조치사항목록: [],
      보고현황목록: [],
      설명: '',
      계산로직: null
    });
    setLogicModalOpen(false);
    setLogicData(null);
    setSelectedCategory('');
    setSelectedDivision('');
    setEditingPerformance(null);
    setEditingId('');

    // 폼 리셋 후 성과 항목명 input으로 포커스 이동 (useEffect 트리거)
    setShouldFocusPerformanceName(true);
  };

  // 성과 항목 편집 로드
  const handleEditPerformance = (performance) => {
    // 성과항목명에서 사업부 추출
    const performanceName = performance.성과항목 || '';
    const divisionMatch = performanceName.match(/^\[(.+?)\]\s*(.*)$/);

    let extractedDivision = '';
    let extractedName = performanceName;

    if (divisionMatch) {
      extractedDivision = divisionMatch[1];
      extractedName = divisionMatch[2];
    }

    // 조치사항목록 복원 (기존 데이터 호환성 처리)
    let actionList = performance.조치사항목록 || [];
    if (actionList.length === 0 && performance.조치사항 && performance.조치사항 !== '없음' && performance.조치사항 !== '') {
      // 기존 단일 문자열 데이터를 배열로 변환
      actionList = performance.조치사항.split(', ').filter(item => item.trim());
    }

    // 폼에 데이터 로드
    setFormData({
      성과년도: performance.성과년도,
      대분류: performance.대분류 || '',
      소분류: performance.소분류 || '',
      성과항목: extractedName,
      현재수준: performance.현재수준 || '',
      목표수준: performance.목표수준 || '',
      로직입력여부: performance.로직입력여부 || false,
      월별실적여부: performance.월별실적여부 || false,
      실적수준: performance.실적수준 || '',
      월별실적: performance.월별실적 || Array(12).fill(''),
      단위: performance.단위 || '',
      디지털트윈기여도여부: performance.디지털트윈기여도여부 || false,
      디지털트윈기여도: performance.디지털트윈기여도 ?? '100',
      조치사항: performance.조치사항 || '',
      조치사항목록: actionList,
      보고현황목록: performance.보고현황목록 || [],
      설명: performance.설명 || '',
      계산로직: performance.계산로직 || null
    });

    // 카테고리 설정
    const category = categories.find(cat => cat.name === performance.대분류);
    if (category) {
      setSelectedCategory(category.id);
    }

    // 사업부 설정
    setSelectedDivision(extractedDivision);

    // 수정 모드 설정
    setEditingPerformance(performance);
    setEditingId(performance.id || '');

    // 좌측 패널로 스크롤 (선택사항)
    const createForm = document.querySelector('.create-form');
    if (createForm) {
      createForm.scrollTop = 0;
    }
  };

  // ============== 로직 설정 핸들러 ==============

  const createDefaultLogicData = () => ({
    변수목록: [
      { id: `var-${uuidv4().substring(0, 8)}`, 이름: '', 단위: '', 그룹: 'A', 현재: '', 목표: '', 실적: '' }
    ],
    연산타입: 'SUM',
    연산설정: { 그룹연산: [{ 그룹: 'A', 연산: 'SUM' }], 그룹간연산: 'MULTIPLY' },
    계산결과: { 현재수준: '', 목표수준: '', 실적수준: '' }
  });

  const handleOpenLogicModal = () => {
    const data = formData.계산로직 ? JSON.parse(JSON.stringify(formData.계산로직)) : createDefaultLogicData();
    setLogicData(data);
    setLogicModalOpen(true);
  };

  const handleAddVariable = () => {
    setLogicData(prev => {
      const newVar = { id: `var-${uuidv4().substring(0, 8)}`, 이름: '', 단위: '', 그룹: 'A', 현재: '', 목표: '', 실적: '' };
      return { ...prev, 변수목록: [...prev.변수목록, newVar] };
    });
  };

  const handleRemoveVariable = (varId) => {
    setLogicData(prev => ({
      ...prev,
      변수목록: prev.변수목록.filter(v => v.id !== varId)
    }));
  };

  const handleVariableChange = (varId, field, value) => {
    setLogicData(prev => ({
      ...prev,
      변수목록: prev.변수목록.map(v => v.id === varId ? { ...v, [field]: value } : v)
    }));
  };

  const handleOperationChange = (연산타입) => {
    setLogicData(prev => {
      const updated = { ...prev, 연산타입 };
      if (연산타입 === 'SUM_THEN_MULTIPLY') {
        const existingGroups = [...new Set(prev.변수목록.map(v => v.그룹 || 'A'))];
        if (existingGroups.length === 0) existingGroups.push('A');
        updated.연산설정 = {
          그룹연산: existingGroups.map(g => ({ 그룹: g, 연산: 'SUM' })),
          그룹간연산: prev.연산설정?.그룹간연산 || 'MULTIPLY'
        };
      }
      return updated;
    });
  };

  const handleGroupOperationChange = (그룹, 연산) => {
    setLogicData(prev => ({
      ...prev,
      연산설정: {
        ...prev.연산설정,
        그룹연산: prev.연산설정.그룹연산.map(g => g.그룹 === 그룹 ? { ...g, 연산 } : g)
      }
    }));
  };

  const handleInterGroupOperationChange = (그룹간연산) => {
    setLogicData(prev => ({
      ...prev,
      연산설정: { ...prev.연산설정, 그룹간연산 }
    }));
  };

  const handleApplyLogic = () => {
    if (!logicData) return;

    const results = calculateAllLogicResults(logicData);
    const finalLogic = {
      ...logicData,
      계산결과: results
    };

    setFormData(prev => ({
      ...prev,
      현재수준: results.현재수준,
      목표수준: results.목표수준,
      실적수준: results.실적수준,
      계산로직: finalLogic
    }));

    setLogicModalOpen(false);
  };

  // ============== 로직 템플릿 핸들러 (서버 설정 DB 저장) ==============

  const [logicTemplates, setLogicTemplates] = useState([]);

  // settingsData에서 템플릿 목록 동기화
  useEffect(() => {
    setLogicTemplates(settingsData.logicTemplates || []);
  }, [settingsData]);

  const handleSaveTemplate = async () => {
    if (!logicData) return;
    const name = prompt('템플릿 이름을 입력하세요:');
    if (!name || !name.trim()) return;

    const template = {
      id: `tmpl-${uuidv4().substring(0, 8)}`,
      이름: name.trim(),
      변수목록: logicData.변수목록.map(v => ({
        ...v,
        현재: '',
        목표: '',
        실적: ''
      })),
      연산타입: logicData.연산타입,
      연산설정: JSON.parse(JSON.stringify(logicData.연산설정)),
      createdAt: new Date().toISOString()
    };

    try {
      const currentSettings = await fetchSystemSettings();
      const updatedTemplates = [...(currentSettings.logicTemplates || []), template];
      await saveSystemSettings({ ...currentSettings, logicTemplates: updatedTemplates });
      setLogicTemplates(updatedTemplates);
      if (showSuccess) showSuccess(`템플릿 "${name.trim()}"이 저장되었습니다.`);
    } catch (err) {
      console.error('템플릿 저장 실패:', err);
      if (showError) showError('템플릿 저장에 실패했습니다.');
    }
  };

  const handleLoadTemplate = (template) => {
    const newVars = template.변수목록.map(v => ({
      ...v,
      id: `var-${uuidv4().substring(0, 8)}`,
      현재: '',
      목표: '',
      실적: ''
    }));

    setLogicData({
      변수목록: newVars,
      연산타입: template.연산타입,
      연산설정: JSON.parse(JSON.stringify(template.연산설정)),
      계산결과: { 현재수준: '', 목표수준: '', 실적수준: '' }
    });
    setTemplateListOpen(false);
  };

  const handleDeleteTemplate = async (templateId) => {
    try {
      const currentSettings = await fetchSystemSettings();
      const updatedTemplates = (currentSettings.logicTemplates || []).filter(t => t.id !== templateId);
      await saveSystemSettings({ ...currentSettings, logicTemplates: updatedTemplates });
      setLogicTemplates(updatedTemplates);
    } catch (err) {
      console.error('템플릿 삭제 실패:', err);
      if (showError) showError('템플릿 삭제에 실패했습니다.');
    }
  };

  // 삭제 확인 처리
  const handleDeleteClick = (performance, e) => {
    e.stopPropagation(); // 카드 클릭 이벤트 방지
    
    // 이 성과 항목을 사용하는 과제들 찾기 (상위 컴포넌트에서 전달받거나 계산)
    const connectedProjects = []; // 실제로는 상위에서 계산해서 전달받아야 함
    
    setDeleteConfirm({
      isOpen: true,
      performance,
      connectedProjects
    });
  };

  // 삭제 실행
  const handleConfirmDelete = () => {
    const { performance } = deleteConfirm;
    
    if (performance && onDelete) {
      try {
        onDelete(performance.id);
        showSuccess(`성과 항목 "${performance.성과항목}"이(가) 삭제되었습니다.`);
        
        // 현재 편집 중인 성과가 삭제된 경우 폼 초기화
        if (editingPerformance?.id === performance.id) {
          handleFormReset();
        }
      } catch (error) {
        showError('성과 삭제 중 오류가 발생했습니다: ' + error.message);
      }
    }
    
    setDeleteConfirm({ isOpen: false, performance: null, connectedProjects: [] });
  };

  // 삭제 취소
  const handleCancelDelete = () => {
    setDeleteConfirm({ isOpen: false, performance: null, connectedProjects: [] });
  };

  // 모든 성과 삭제 처리
  const handleDeleteAllClick = () => {
    if (globalPerformances.length === 0) {
      showError('삭제할 성과 항목이 없습니다.');
      return;
    }
    setDeleteAllConfirm({ isOpen: true });
  };

  // 모든 성과 삭제 실행
  const handleConfirmDeleteAll = () => {
    try {
      const totalCount = globalPerformances.length;
      
      if (onDelete) {
        // 전체 삭제를 나타내는 특별한 ID 사용
        onDelete('ALL');
      }
      
      showSuccess(`모든 성과 항목(${totalCount}개)이 삭제되었습니다.`);
      
      // 편집 중인 성과가 있으면 폼 초기화
      if (editingPerformance) {
        handleFormReset();
      }
    } catch (error) {
      showError('전체 성과 삭제 중 오류가 발생했습니다: ' + error.message);
    }
    
    setDeleteAllConfirm({ isOpen: false });
  };

  // 모든 성과 삭제 취소
  const handleCancelDeleteAll = () => {
    setDeleteAllConfirm({ isOpen: false });
  };

  const handleClose = () => {
    // 변경사항이 있는지 확인
    const hasChanges = Object.values(formData).some(value =>
      typeof value === 'string' && value.trim() !== ''
    );

    if (hasChanges) {
      setCloseConfirm({ isOpen: true });
    } else {
      onClose();
    }
  };

  const handleConfirmClose = () => {
    setCloseConfirm({ isOpen: false });
    onClose();
  };

  /**
   * 현재/목표/실적 변화량.
   *
   * 목표−현재 = 달성해야 할 변화량, 실적−현재 = 실제 변화량.
   * 달성률은 그 둘의 비율이라 "낮을수록 좋은 지표"(비용 절감 등)에서도 방향이 자동으로 맞는다.
   * (예: 현재 100 → 목표 70 → 실적 85 이면 −30 중 −15 달성 = 50%)
   */
  const levelDeltas = React.useMemo(() => {
    const toNum = (v) => {
      if (v === null || v === undefined || v === '') return null;
      const n = parseFloat(String(v).replace(/,/g, ''));
      return Number.isFinite(n) ? n : null;
    };
    const cur = toNum(formData.현재수준);
    const tgt = toNum(formData.목표수준);
    const act = toNum(formData.실적수준);

    const fmt = (n) => {
      if (n === null) return null;
      const rounded = Math.round(n * 1000) / 1000;
      return (rounded > 0 ? '+' : '') + rounded.toLocaleString();
    };

    const dTarget = (cur !== null && tgt !== null) ? tgt - cur : null;
    const dActual = (cur !== null && act !== null) ? act - cur : null;
    const rate = (dTarget !== null && dActual !== null && dTarget !== 0)
      ? Math.round((dActual / dTarget) * 1000) / 10
      : null;

    return {
      hasAny: dTarget !== null || dActual !== null,
      targetText: fmt(dTarget),
      actualText: fmt(dActual),
      rate,
    };
  }, [formData.현재수준, formData.목표수준, formData.실적수준]);

  // 성과항목명에서 사업부 추출하는 헬퍼 함수
  const extractDivisionFromPerformanceName = (performanceName) => {
    const match = (performanceName || '').match(/^\[(.+?)\]/);
    return match ? match[1] : '미분류';
  };

  // 성과 목록에서 사업부 목록 추출 (고정 순서: MX, VD, DA, NW, 의료기기, SR, GTR, CS)
  const performanceDivisions = React.useMemo(() => {
    const divisionOrder = ['MX', 'VD', 'DA', 'NW', '의료기기', 'SR', 'GTR', 'CS'];
    const divisionSet = new Set();
    globalPerformances.forEach(perf => {
      const division = extractDivisionFromPerformanceName(perf.성과항목);
      if (division) divisionSet.add(division);
    });
    return Array.from(divisionSet).sort((a, b) => {
      const indexA = divisionOrder.indexOf(a);
      const indexB = divisionOrder.indexOf(b);
      // 둘 다 목록에 있으면 순서대로
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      // a만 목록에 있으면 a가 앞으로
      if (indexA !== -1) return -1;
      // b만 목록에 있으면 b가 앞으로
      if (indexB !== -1) return 1;
      // 둘 다 목록에 없으면 알파벳 순서
      return a.localeCompare(b);
    });
  }, [globalPerformances]);

  // 성과 목록 필터링 (useMemo로 메모이제이션하여 렌더 사이클 내 일관성 보장)
  const filteredPerformances = React.useMemo(() => {
    let filtered = globalPerformances;

    // 검색어 필터링
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(perf =>
        (perf.성과항목 || '').toLowerCase().includes(search) ||
        (perf.대분류 || '').toLowerCase().includes(search) ||
        (perf.소분류 || '').toLowerCase().includes(search) ||
        (perf.설명 || '').toLowerCase().includes(search) ||
        (perf.성과년도 && perf.성과년도.toString().includes(searchTerm))
      );
    }

    // 성과년도 필터링
    if (yearFilter) {
      filtered = filtered.filter(perf => perf.성과년도 && perf.성과년도.toString() === yearFilter);
    }

    // 대분류 필터링
    if (categoryFilter) {
      filtered = filtered.filter(perf => perf.대분류 === categoryFilter);
    }

    // 소분류 필터링
    if (subcategoryFilter) {
      filtered = filtered.filter(perf => perf.소분류 === subcategoryFilter);
    }

    // 사업부 필터링
    if (divisionFilter) {
      filtered = filtered.filter(perf => {
        const division = extractDivisionFromPerformanceName(perf.성과항목);
        return division === divisionFilter;
      });
    }

    // 조치사항 필터링
    if (actionFilter) {
      filtered = filtered.filter(perf => {
        const action = perf.조치사항;
        const actionList = perf.조치사항목록;
        const hasActionList = actionList && Array.isArray(actionList) && actionList.length > 0;
        const hasAction = action && action !== '' && action !== '없음';

        if (actionFilter === 'normal') {
          // 정상 등록: 조치사항목록이 비어있고, 조치사항이 없거나 "없음"인 경우
          return !hasActionList && !hasAction;
        } else if (actionFilter === 'needsAction') {
          // 수정 필요: 조치사항목록이 있거나, 조치사항이 있고 "없음"이 아닌 경우
          return hasActionList || hasAction;
        }
        return true;
      });
    }

    // 월별 실적 관리 여부 필터링
    if (monthlyFilter) {
      filtered = filtered.filter(perf => {
        const isMonthly = perf.월별실적여부 === true;
        if (monthlyFilter === 'monthly') {
          return isMonthly;
        } else if (monthlyFilter === 'yearly') {
          return !isMonthly;
        }
        return true;
      });
    }

    return filtered;
  }, [globalPerformances, searchTerm, yearFilter, categoryFilter, subcategoryFilter, divisionFilter, actionFilter, monthlyFilter]);

  if (!isOpen) return null;

  return (
    /*
     * AnimatePresence 는 **나타났다 사라지는 요소만** 감싸야 한다.
     * 예전에는 <style> 과 로직 모달용 AnimatePresence 까지 자식으로 들어가 있었는데,
     * 이 둘은 key 가 없어 React 가 같은 빈 key('')로 취급했다.
     *   → "Encountered two children with the same key, ``" 경고
     * 오버레이만 감싸고 나머지는 형제로 뺀다.
     */
    <>
    <AnimatePresence>
      <motion.div
        key="performance-modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="modal-overlay"
        onMouseDown={(e) => {
          setIsDragging(false);
          setDragStartPos({ x: e.clientX, y: e.clientY });
        }}
        onMouseMove={(e) => {
          if (dragStartPos.x !== 0 || dragStartPos.y !== 0) {
            const distance = Math.sqrt(
              Math.pow(e.clientX - dragStartPos.x, 2) + Math.pow(e.clientY - dragStartPos.y, 2)
            );
            if (distance > 5) {
              setIsDragging(true);
            }
          }
        }}
        onMouseUp={(e) => {
          if (!isDragging && e.target === e.currentTarget) {
            handleClose();
          }
          setIsDragging(false);
          setDragStartPos({ x: 0, y: 0 });
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", damping: 20 }}
          className="performance-modal"
        >
          {/* 모달 헤더 */}
          <div className="modal-header">
            <div className="header-left">
              <Target className="modal-icon" size={24} />
              <h2>성과 항목 관리</h2>
            </div>
            <button onClick={handleClose} className="close-btn">
              <X size={20} />
            </button>
          </div>

          {/* 메인 컨텐츠 - 좌우 분할 */}
          <div className="modal-content">
            {/* 좌측: 새 성과 입력 */}
            <div className="left-panel">
              <div className="panel-header">
                <h3>
                  <Plus size={18} />
                  {editingPerformance ? '성과 수정' : '새 성과 생성'}
                </h3>
                {editingPerformance && (
                  <button
                    type="button"
                    onClick={handleFormReset}
                    className="reset-btn"
                    title="새 성과 생성 모드로 돌아가기"
                  >
                    <X size={16} />
                    취소
                  </button>
                )}
              </div>
              
              {/*
                2026-08-01 form 제출을 **서버 경로**로 돌렸다 (예전 `handleSubmit` 은 로컬 전용).
                버튼만 숨기면 **입력칸에서 Enter 를 눌렀을 때** 로컬 저장이 그대로 돌아서,
                "저장했는데 새로고침하면 사라지는" 경로가 남는다. 그래서 form 자체를 바꾼다.
              */}
              <form onSubmit={handleSubmitAndUpload} className="create-form">
                {/* 입력 영역만 스크롤한다 — 하단 저장 버튼은 항상 보이게 밖에 둔다 */}
                <div className="create-form-scroll">
                <div className="form-section">
                  {/* 편집 모드에서만 ID 수정 필드 표시 */}
                  {editingPerformance && (
                    <div className="form-row">
                      <label>성과 ID <span className="required">*</span></label>
                      <input
                        type="text"
                        value={editingId}
                        onChange={(e) => setEditingId(e.target.value.trim())}
                        placeholder="예: performance-1"
                        className="form-input"
                        style={{ fontFamily: 'monospace' }}
                        required
                      />
                      {editingId !== editingPerformance.id && (
                        <small style={{ color: '#f59e0b', marginTop: '4px', display: 'block' }}>
                          ⚠️ ID 변경 시 이 성과를 참조하는 과제들의 연결도 함께 업데이트됩니다.
                        </small>
                      )}
                    </div>
                  )}

                  {/* 사업부 · 성과년도 — 짧은 필드라 한 행에 나란히 */}
                  <div className="form-grid-two">
                    <div className="form-row">
                      <label>사업부 <span className="required">*</span></label>
                      <select
                        ref={divisionSelectRef}
                        value={selectedDivision}
                        onChange={(e) => setSelectedDivision(e.target.value)}
                        className="form-select"
                        required
                      >
                        <option value="">사업부 선택</option>
                        {divisionOptions.map((division, index) => (
                          <option key={`division-${index}`} value={division}>
                            {division}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-row">
                      <label>성과년도 <span className="required">*</span></label>
                      <input
                        type="number"
                        value={formData.성과년도}
                        onChange={(e) => handleInputChange('성과년도', parseInt(e.target.value) || 2025)}
                        className="form-input"
                        min="2020"
                        max="2050"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <label>성과 항목명 <span className="required">*</span></label>
                    <input
                      ref={performanceNameInputRef}
                      type="text"
                      value={formData.성과항목}
                      onChange={(e) => handleInputChange('성과항목', e.target.value)}
                      placeholder="예: 시뮬레이션 정확도 개선, 처리 속도 향상 등"
                      className="form-input"
                      required
                    />
                  </div>

                  <div className="form-grid-three">
                    <div className="form-row">
                      <label>대분류 <span className="required">*</span></label>
                      <select
                        ref={categorySelectRef}
                        value={selectedCategory}
                        onChange={(e) => handleCategoryChange(e.target.value)}
                        className="form-select"
                        required
                      >
                        <option value="">대분류 선택</option>
                        {categories.map((category, index) => (
                          <option key={category.id || `category-${index}`} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-row">
                      <label>소분류 <span className="required">*</span></label>
                      <select
                        value={availableSubcategories.find(sub => sub.name === formData.소분류)?.id || ''}
                        onChange={(e) => handleSubcategoryChange(e.target.value)}
                        className="form-select"
                        disabled={!selectedCategory}
                        required
                      >
                        <option value="">소분류 선택</option>
                        {availableSubcategories.map((subcategory, index) => (
                          <option key={subcategory.id || `subcategory-${index}`} value={subcategory.id}>
                            {subcategory.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-row">
                      <label>단위</label>
                      <input
                        type="text"
                        value={formData.단위}
                        onChange={(e) => handleInputChange('단위', e.target.value)}
                        className={`form-input ${isUnitAutoSet() ? 'auto-set' : ''}`}
                        disabled={isUnitAutoSet()}
                        readOnly={isUnitAutoSet()}
                      />
                    </div>
                  </div>

                  <div className="form-grid-three">
                    <div className="form-row">
                      <label className="with-tooltip">
                        {getCurrentLabel()}
                        <span
                          className="label-info-icon"
                          data-tooltip={isAchievementType()
                            ? "달성 여부 판단의 '기준' 값입니다. 예) 신규 시스템 도입 여부가 성과인 경우, 비교 기준이 되는 값(보통 0)을 입력합니다."
                            : "성과항목의 '현재' 수준입니다. 개선/달성 활동을 시작하기 전의 출발점 값이며, 목표·실적과 비교해 변화량을 계산하는 기준이 됩니다. 예) '목업 비용 절감'이 성과인 경우, 개선 전에 발생하고 있는 현재의 목업 비용을 입력합니다."}
                        >
                          <HelpCircle size={13} />
                        </span>
                      </label>
                      <input
                        type="text"
                        value={formData.현재수준}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9.]/g, '');
                          handleInputChange('현재수준', value);
                        }}
                        className="form-input"
                        placeholder={isAchievementType() ? "예상/기준값 입력" : "숫자만 입력"}
                        disabled={formData.로직입력여부}
                        style={formData.로직입력여부 ? { background: '#f1f5f9', color: '#94a3b8', cursor: 'not-allowed' } : {}}
                      />
                    </div>

                    <div className="form-row">
                      <label className="with-tooltip">
                        목표
                        <span
                          className="label-info-icon"
                          data-tooltip="이 성과를 통해 달성하고자 하는 '목표' 수준입니다. 현재 수준과의 차이는 개선 목표량을 의미합니다. 예) '목업 비용 절감'이 성과인 경우, 활동 종료 시점에 도달하고자 하는 목표 목업 비용(현재보다 낮은 값)을 입력합니다."
                        >
                          <HelpCircle size={13} />
                        </span>
                      </label>
                      <input
                        type="text"
                        value={formData.목표수준}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9.]/g, '');
                          handleInputChange('목표수준', value);
                        }}
                        className="form-input"
                        placeholder="숫자만 입력"
                        disabled={formData.로직입력여부}
                        style={formData.로직입력여부 ? { background: '#f1f5f9', color: '#94a3b8', cursor: 'not-allowed' } : {}}
                      />
                    </div>

                    {/* 월별 실적이 아닐 때만 실적 필드를 같은 행에 표시 */}
                    {!formData.월별실적여부 && (
                      <div className="form-row">
                        <label className="with-tooltip">
                          실적
                          <span
                            className="label-info-icon"
                            data-tooltip="실제로 발생/달성한 '실적' 값입니다. 활동 진행 중 또는 종료 후 측정된 결과이며, 목표와 비교해 성과 달성 정도를 평가합니다. 예) '목업 비용 절감'이 성과인 경우, 개선 활동 후 실제로 발생한 목업 비용을 입력합니다."
                          >
                            <HelpCircle size={13} />
                          </span>
                        </label>
                        <input
                          type="text"
                          value={formData.실적수준}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9.]/g, '');
                            handleInputChange('실적수준', value);
                          }}
                          className="form-input"
                          placeholder="숫자만 입력"
                          disabled={formData.로직입력여부}
                          style={formData.로직입력여부 ? { background: '#f1f5f9', color: '#94a3b8', cursor: 'not-allowed' } : {}}
                        />
                      </div>
                    )}
                  </div>

                  {/*
                    변화량 — 현재 대비 목표·실적의 차이.
                    '개선량'이 아니라 '변화량'인 이유: 실적이 목표와 반대 방향으로 갈 수도 있어서
                    '개선'이라고 부르면 사실과 달라지는 경우가 생긴다.
                  */}
                  {levelDeltas.hasAny && (
                    <div className="delta-strip">
                      {levelDeltas.targetText !== null && (
                        <span className="delta-item" title="목표 − 현재 : 목표까지 만들어야 할 변화량">
                          <em>목표 변화량</em>
                          <b>{levelDeltas.targetText}{formData.단위 ? ` ${formData.단위}` : ''}</b>
                        </span>
                      )}
                      {levelDeltas.actualText !== null && (
                        <span className="delta-item" title="실적 − 현재 : 지금까지 실제로 만든 변화량">
                          <em>실적 변화량</em>
                          <b>{levelDeltas.actualText}{formData.단위 ? ` ${formData.단위}` : ''}</b>
                        </span>
                      )}
                      {levelDeltas.rate !== null && (
                        <span className="delta-item delta-rate" title="실적 변화량 ÷ 목표 변화량">
                          <em>달성률</em>
                          <b>{levelDeltas.rate}%</b>
                        </span>
                      )}
                    </div>
                  )}

                  {/* 로직으로 입력 토글 */}
                  <div className="form-row checkbox-row" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', marginBottom: 0 }}>
                      <input
                        type="checkbox"
                        checked={formData.로직입력여부}
                        onChange={(e) => {
                          const isLogic = e.target.checked;
                          setFormData(prev => ({
                            ...prev,
                            로직입력여부: isLogic,
                            ...(!isLogic ? { 계산로직: null, 현재수준: '', 목표수준: '', 실적수준: '' } : {})
                          }));
                          if (!isLogic) setLogicData(null);
                        }}
                        style={{ marginRight: '0.5rem' }}
                      />
                      로직으로 입력
                    </label>
                    {formData.로직입력여부 && (
                      <button
                        type="button"
                        onClick={handleOpenLogicModal}
                        style={{
                          padding: '0.25rem 0.75rem',
                          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.375rem',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          fontWeight: 500
                        }}
                      >
                        로직 설정
                      </button>
                    )}
                  </div>

                  {/* 월별 실적 토글 */}
                  <div className="form-row checkbox-row">
                    <label>
                      <input
                        type="checkbox"
                        checked={formData.월별실적여부}
                        onChange={(e) => {
                          const isMonthly = e.target.checked;
                          setFormData(prev => ({
                            ...prev,
                            월별실적여부: isMonthly,
                            실적수준: isMonthly ? '' : prev.실적수준,
                            월별실적: isMonthly ? (prev.월별실적.every(v => !v) ? Array(12).fill('') : prev.월별실적) : Array(12).fill('')
                          }));
                        }}
                        style={{ marginRight: '0.5rem' }}
                      />
                      월별 실적으로 관리
                    </label>
                  </div>

                  {/* 월별 실적 입력 */}
                  {formData.월별실적여부 && (
                    // 월별 실적
                    <div className="form-row">
                      <label>월별 실적</label>
                      <div className="monthly-performance-grid">
                        {Array.from({ length: 12 }, (_, i) => (
                          <div key={i} className="monthly-input-wrapper">
                            <label className="monthly-label">{i + 1}월</label>
                            <input
                              type="text"
                              value={formData.월별실적[i] || ''}
                              onChange={(e) => {
                                const value = e.target.value.replace(/[^0-9.]/g, '');
                                const newMonthly = [...formData.월별실적];
                                newMonthly[i] = value;
                                handleInputChange('월별실적', newMonthly);
                              }}
                              className="form-input monthly-input"
                              placeholder={formData.단위 || '숫자'}
                              disabled={formData.로직입력여부}
                              style={formData.로직입력여부 ? { background: '#f1f5f9', color: '#94a3b8', cursor: 'not-allowed' } : {}}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 디지털 트윈 기여도 토글 */}
                  <div className="form-row checkbox-row">
                    <label>
                      <input
                        type="checkbox"
                        checked={formData.디지털트윈기여도여부}
                        onChange={(e) => {
                          const isEnabled = e.target.checked;
                          setFormData(prev => ({
                            ...prev,
                            디지털트윈기여도여부: isEnabled,
                            디지털트윈기여도: isEnabled ? prev.디지털트윈기여도 : '100'
                          }));
                        }}
                        style={{ marginRight: '0.5rem' }}
                      />
                      디지털 트윈의 기여도
                    </label>
                  </div>

                  {/* 디지털 트윈 기여도 입력 */}
                  {formData.디지털트윈기여도여부 && (
                    <div className="form-row">
                      <label>기여도 (%)</label>
                      <input
                        type="text"
                        value={formData.디지털트윈기여도}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9]/g, '');
                          const numValue = parseInt(value, 10);
                          if (value === '' || (numValue >= 0 && numValue <= 100)) {
                            handleInputChange('디지털트윈기여도', value);
                          }
                        }}
                        className="form-input"
                        placeholder="0~100"
                        style={{ maxWidth: '120px' }}
                      />
                    </div>
                  )}

                  {/* 보고 현황 토글 */}
                  <div className="form-row checkbox-row">
                    <label>
                      <input
                        type="checkbox"
                        checked={formData.보고현황목록 && formData.보고현황목록.length > 0}
                        onChange={(e) => {
                          if (!e.target.checked) {
                            handleInputChange('보고현황목록', []);
                          }
                          setIsReportDropdownOpen(e.target.checked);
                        }}
                        style={{ marginRight: '0.5rem' }}
                      />
                      보고 현황
                    </label>
                  </div>

                  {/* 보고 현황 드롭다운 + 태그 */}
                  {(formData.보고현황목록?.length > 0 || isReportDropdownOpen) && (
                    <div className="form-row">
                      <label>보고 현황 항목</label>
                      <div className="action-items-container">
                        <div className="searchable-dropdown" ref={reportDropdownRef}>
                          <input
                            type="text"
                            className="form-input searchable-dropdown-input"
                            placeholder="검색 또는 항목 선택..."
                            value={reportSearchTerm}
                            onChange={(e) => setReportSearchTerm(e.target.value)}
                            onFocus={() => setIsReportDropdownOpen(true)}
                          />
                          {isReportDropdownOpen && (
                            <div className="searchable-dropdown-list">
                              <div
                                className="searchable-dropdown-item searchable-dropdown-item-clear"
                                onClick={() => {
                                  handleInputChange('보고현황목록', []);
                                  setReportSearchTerm('');
                                  setIsReportDropdownOpen(false);
                                }}
                              >
                                없음 (모두 삭제)
                              </div>
                              {reportStatuses
                                .filter(status =>
                                  status.name.toLowerCase().includes(reportSearchTerm.toLowerCase())
                                )
                                .map((status, index) => (
                                  <div
                                    key={status.id || `rpt-${index}`}
                                    className="searchable-dropdown-item"
                                    onClick={() => {
                                      const value = status.name;
                                      const currentList = formData.보고현황목록 || [];
                                      if (!currentList.includes(value)) {
                                        const newList = [...currentList, value];
                                        handleInputChange('보고현황목록', newList);
                                      }
                                      setReportSearchTerm('');
                                      setIsReportDropdownOpen(false);
                                    }}
                                  >
                                    {status.name}
                                  </div>
                                ))}
                              {reportStatuses.filter(status =>
                                status.name.toLowerCase().includes(reportSearchTerm.toLowerCase())
                              ).length === 0 && (
                                <div className="searchable-dropdown-empty">
                                  검색 결과가 없습니다
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        {formData.보고현황목록 && formData.보고현황목록.length > 0 && (
                          <div className="action-tags-container">
                            {formData.보고현황목록.map((item, index) => (
                              <span key={index} className="action-tag">
                                {item}
                                <button
                                  type="button"
                                  className="action-tag-remove"
                                  onClick={() => {
                                    const newList = formData.보고현황목록.filter((_, i) => i !== index);
                                    handleInputChange('보고현황목록', newList);
                                  }}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="form-row description-row">
                    <label>상세 설명</label>
                    <textarea
                      value={formData.설명}
                      onChange={(e) => handleInputChange('설명', e.target.value)}
                      placeholder="성과 항목에 대한 상세 설명을 입력하세요."
                      className="form-textarea"
                      rows={3}
                    />
                  </div>

                  {isAdmin && (
                    <div className="form-row action-row">
                      <label>수정 필요 사항</label>
                      <div className="action-items-container">
                        <div className="searchable-dropdown" ref={actionDropdownRef}>
                          <input
                            type="text"
                            className="form-input searchable-dropdown-input"
                            placeholder="검색 또는 항목 선택..."
                            value={actionSearchTerm}
                            onChange={(e) => setActionSearchTerm(e.target.value)}
                            onFocus={() => setIsActionDropdownOpen(true)}
                          />
                          {isActionDropdownOpen && (
                            <div className="searchable-dropdown-list">
                              <div
                                className="searchable-dropdown-item searchable-dropdown-item-clear"
                                onClick={() => {
                                  handleInputChange('조치사항', '없음');
                                  handleInputChange('조치사항목록', []);
                                  setActionSearchTerm('');
                                  setIsActionDropdownOpen(false);
                                }}
                              >
                                없음 (모두 삭제)
                              </div>
                              {performanceEvaluations
                                .filter(evaluation =>
                                  evaluation.name.toLowerCase().includes(actionSearchTerm.toLowerCase())
                                )
                                .map((evaluation, index) => (
                                  <div
                                    key={evaluation.id || `eval-${index}`}
                                    className="searchable-dropdown-item"
                                    onClick={() => {
                                      const value = evaluation.name;
                                      const currentList = formData.조치사항목록 || [];
                                      if (!currentList.includes(value)) {
                                        const newList = [...currentList, value];
                                        handleInputChange('조치사항목록', newList);
                                        handleInputChange('조치사항', newList.join(', '));
                                      }
                                      setActionSearchTerm('');
                                      setIsActionDropdownOpen(false);
                                    }}
                                  >
                                    {evaluation.name}
                                  </div>
                                ))}
                              {performanceEvaluations.filter(evaluation =>
                                evaluation.name.toLowerCase().includes(actionSearchTerm.toLowerCase())
                              ).length === 0 && (
                                <div className="searchable-dropdown-empty">
                                  검색 결과가 없습니다
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        {formData.조치사항목록 && formData.조치사항목록.length > 0 && (
                          <div className="action-tags-container">
                            {formData.조치사항목록.map((item, index) => (
                              <span key={index} className="action-tag">
                                {item}
                                <button
                                  type="button"
                                  className="action-tag-remove"
                                  onClick={() => {
                                    const newList = formData.조치사항목록.filter((_, i) => i !== index);
                                    handleInputChange('조치사항목록', newList);
                                    handleInputChange('조치사항', newList.length > 0 ? newList.join(', ') : '');
                                  }}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                </div>{/* create-form-scroll 닫기 */}

                <div className="form-actions">
                  <div className="form-actions-row">
                    {/*
                      2026-08-01 저장 버튼을 **하나로 합쳤다.**

                      전에는 '성과 항목 생성/수정'(로컬 전용, admin 만 보임)과
                      '… 및 서버 업로드'(서버) 둘이 나란히 있었다. 로컬 전용 쪽은
                      "여러 건 모아뒀다가 '서버에 저장' 메뉴로 일괄 업로드" 하는
                      워크플로를 위한 것이었는데, **컷오버로 그 메뉴를 내려서
                      회수 경로가 사라졌다.** 그대로 두면 admin 이 저장을 누르고
                      성공 메시지를 본 뒤 새로고침하면 조용히 사라진다.
                    */}
                    <button
                      type="submit"
                      className="submit-btn submit-upload-btn"
                      title="서버에 저장되어 모든 사용자와 공유됩니다."
                    >
                      <Cloud size={16} />
                      {editingPerformance ? '성과 항목 수정' : '성과 항목 생성'}
                    </button>
                    {isAdmin && editingPerformance && (
                      <button
                        type="button"
                        className="submit-btn save-as-new-btn"
                        onClick={handleSaveAsNew}
                        title="입력한 내용으로 새 성과 항목을 만듭니다. 서버에 저장되어 모든 사용자와 공유됩니다."
                      >
                        <Copy size={16} />
                        다른 이름으로 저장
                      </button>
                    )}
                    {editingPerformance && (
                      <button
                        type="button"
                        className="submit-btn submit-delete-btn"
                        onClick={(e) => handleDeleteClick(editingPerformance, e)}
                        title="현재 편집 중인 성과 항목을 삭제합니다."
                      >
                        <Trash2 size={16} />
                        성과 삭제
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </div>

            {/* 우측: 성과 목록 */}
            <div className="right-panel">
              <div className="panel-header">
                <h3>
                  <Target size={18} />
                  등록된 성과 항목 ({filteredPerformances.length}개)
                </h3>
                <div className="view-toggle">
                  <button
                    className={`view-toggle-btn ${listViewMode === 'table' ? 'active' : ''}`}
                    onClick={() => setListViewMode('table')}
                    title="테이블 뷰"
                  >
                    <List size={14} />
                  </button>
                  <button
                    className={`view-toggle-btn ${listViewMode === 'card' ? 'active' : ''}`}
                    onClick={() => setListViewMode('card')}
                    title="카드 뷰"
                  >
                    <LayoutGrid size={14} />
                  </button>
                </div>
                {isAdmin && globalPerformances.length > 0 && (
                  <button
                    onClick={handleDeleteAllClick}
                    className="delete-all-btn"
                    title="모든 성과 항목 삭제 (관리자 전용)"
                  >
                    <Trash2 size={16} />
                    전체 삭제
                  </button>
                )}
              </div>

              {/* 검색 및 필터 */}
              <div className="list-filters">
                <div className="search-box">
                  <Search size={16} className="search-icon" />
                  <input
                    type="text"
                    placeholder="성과 항목명, 년도, 분류명으로 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                  />
                </div>
                
                <div className="filter-grid-row">
                  <select
                    value={divisionFilter}
                    onChange={(e) => setDivisionFilter(e.target.value)}
                    className="filter-select"
                  >
                    <option value="">전체 사업부</option>
                    {performanceDivisions.map((division) => (
                      <option key={division} value={division}>
                        {division}
                      </option>
                    ))}
                  </select>

                  <select
                    value={actionFilter}
                    onChange={(e) => setActionFilter(e.target.value)}
                    className="filter-select"
                  >
                    <option value="">전체</option>
                    <option value="normal">정상 등록</option>
                    <option value="needsAction">수정 필요</option>
                  </select>

                  <select
                    value={monthlyFilter}
                    onChange={(e) => setMonthlyFilter(e.target.value)}
                    className="filter-select"
                  >
                    <option value="">전체 실적관리</option>
                    <option value="monthly">월별 실적</option>
                    <option value="yearly">연간 실적</option>
                  </select>

                  <select
                    value={yearFilter}
                    onChange={(e) => setYearFilter(e.target.value)}
                    className="filter-select"
                  >
                    <option value="">전체 년도</option>
                    {Array.from(new Set(globalPerformances.map(p => p.성과년도).filter(y => y)))
                      .sort((a, b) => b - a)
                      .map((year) => (
                        <option key={year} value={year.toString()}>
                          {year}년
                        </option>
                      ))}
                  </select>
                </div>

                <div className="filter-grid-row">
                  <select
                    value={categoryFilter}
                    onChange={(e) => {
                      setCategoryFilter(e.target.value);
                      setSubcategoryFilter(''); // 대분류 변경 시 소분류 초기화
                    }}
                    className="filter-select"
                  >
                    <option value="">전체 대분류</option>
                    {categories.map((category, index) => (
                      <option key={category.id || `filter-category-${index}`} value={category.name}>
                        {category.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={subcategoryFilter}
                    onChange={(e) => setSubcategoryFilter(e.target.value)}
                    className="filter-select"
                    disabled={!categoryFilter}
                  >
                    <option value="">전체 소분류</option>
                    {subcategories
                      .filter(sub => {
                        const category = categories.find(cat => cat.name === categoryFilter);
                        return category ? sub.categoryId === category.id : false;
                      })
                      .map((subcategory, index) => (
                        <option key={subcategory.id || `filter-subcategory-${index}`} value={subcategory.name}>
                          {subcategory.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* 성과 목록 */}
              <div className="performance-list">
                {filteredPerformances.length === 0 ? (
                  <div className="empty-state">
                    {globalPerformances.length === 0 ? (
                      <>
                        <Target size={48} className="empty-icon" />
                        <p>등록된 성과 항목이 없습니다.</p>
                        <p className="empty-subtitle">좌측 폼에서 새 성과를 생성해보세요!</p>
                      </>
                    ) : (
                      <>
                        <Search size={48} className="empty-icon" />
                        <p>검색 조건에 맞는 성과 항목이 없습니다.</p>
                        <p className="empty-subtitle">다른 검색어나 필터를 시도해보세요.</p>
                      </>
                    )}
                  </div>
                ) : listViewMode === 'table' ? (
                  /* ===== 테이블 뷰 ===== */
                  <div className="perf-table-wrapper">
                    <table className="perf-table">
                      <thead>
                        <tr>
                          <th className="perf-table-th-name">성과항목</th>
                          <th className="perf-table-th-cat">분류</th>
                          <th className="perf-table-th-num">현재</th>
                          <th className="perf-table-th-num">목표</th>
                          <th className="perf-table-th-num">실적</th>
                          <th className="perf-table-th-unit">단위</th>
                          <th className="perf-table-th-action"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPerformances.map((performance, index) => (
                          <tr
                            key={performance.id || `performance-${index}`}
                            className={`perf-table-row ${editingPerformance?.id === performance.id ? 'editing' : ''}`}
                            onClick={() => handleEditPerformance(performance)}
                            title="클릭하여 수정하기"
                          >
                            <td className="perf-table-td-name">
                              <span className="perf-table-name-text">{performance.성과항목}</span>
                            </td>
                            <td className="perf-table-td-cat">
                              {performance.소분류 || performance.대분류 || '-'}
                            </td>
                            <td className="perf-table-td-num">{performance.현재수준 || '-'}</td>
                            <td className="perf-table-td-num">{performance.목표수준 || '-'}</td>
                            <td className="perf-table-td-num">
                              {performance.월별실적여부 ? '월별' : (performance.실적수준 || '-')}
                            </td>
                            <td className="perf-table-td-unit">{performance.단위 || '-'}</td>
                            <td className="perf-table-td-action">
                              <button
                                className="delete-btn"
                                onClick={(e) => handleDeleteClick(performance, e)}
                                title="성과 삭제"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  /* ===== 카드 뷰 ===== */
                  filteredPerformances.map((performance, index) => (
                    <div
                      key={performance.id || `performance-${index}`}
                      className={`performance-card ${
                        performance.isFromSample ? 'sample-item' : ''
                      } ${
                        editingPerformance?.id === performance.id ? 'editing' : ''
                      }`}
                      onClick={() => handleEditPerformance(performance)}
                      style={{ cursor: 'pointer' }}
                      title="클릭하여 수정하기"
                    >
                      <div className="card-header">
                        <div className="performance-title">
                          <div className="title-content">
                            {performance.성과항목}
                            {performance.isFromSample && <span className="sample-badge">샘플</span>}
                          </div>
                          {/* 삭제 버튼 - 성과명과 같은 행 우측 끝 */}
                          <button
                            className="delete-btn"
                            onClick={(e) => handleDeleteClick(performance, e)}
                            title="성과 삭제"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="performance-badges">
                          <div className="performance-id-badge">
                            ID: {performance.id}
                          </div>
                          <div className="performance-year-badge">
                            {performance.성과년도}년
                          </div>
                          {(performance.대분류 || performance.소분류) && (
                            <div className="performance-year-badge">
                              {performance.대분류}{performance.소분류 ? ` › ${performance.소분류}` : ''}
                            </div>
                          )}
                          {performance.보고현황목록 && performance.보고현황목록.length > 0 && (
                            performance.보고현황목록.map((reportItem, idx) => (
                              <div key={`report-${idx}`} className="performance-report-badge">
                                보고: {reportItem}
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="card-content">
                        {(performance.단위 || (performance.조치사항 && performance.조치사항 !== '없음') || (performance.조치사항목록 && performance.조치사항목록.length > 0)) && (
                          <div className="performance-detail-row">
                            {/* 조치사항목록이 있으면 각 항목을 개별 뱃지로 표시 */}
                            {performance.조치사항목록 && performance.조치사항목록.length > 0 ? (
                              performance.조치사항목록.map((actionItem, idx) => (
                                <span key={idx} className="detail-item action-badge">
                                  <span className="label">수정 필요:</span> {actionItem}
                                </span>
                              ))
                            ) : (
                              /* 기존 단일 조치사항 호환 */
                              performance.조치사항 && performance.조치사항 !== '없음' && (
                                <span className="detail-item action-badge">
                                  <span className="label">수정 필요:</span> {performance.조치사항}
                                </span>
                              )
                            )}
                          </div>
                        )}

                        {(performance.현재수준 || performance.목표수준 || performance.실적수준 || performance.월별실적여부) && (
                          <div className="performance-levels">
                            {performance.현재수준 && (
                              <span className="level-item">
                                {getPerformanceCurrentLabel(performance)}: {performance.현재수준} {performance.단위}
                              </span>
                            )}
                            {performance.목표수준 && (
                              <span className="level-item">
                                목표: {performance.목표수준} {performance.단위}
                              </span>
                            )}
                            {performance.월별실적여부 ? (
                              <span className="level-item monthly-badge">
                                월별 실적 관리
                              </span>
                            ) : performance.실적수준 ? (
                              <span className="level-item">
                                실적: {performance.실적수준} {performance.단위}
                              </span>
                            ) : null}
                          </div>
                        )}

                        <div className="performance-meta">
                          생성일: {new Date(performance.createdAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 모달 푸터 */}
          <div className="modal-footer">
            <button
              type="button"
              onClick={handleClose}
              className="close-modal-btn"
            >
              닫기
            </button>
          </div>
        </motion.div>

        {/* 삭제 확인 모달 */}
        <AnimatePresence>
          {deleteConfirm.isOpen && (
            <motion.div
              key="delete-confirm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="delete-modal-overlay"
              onClick={(e) => e.target === e.currentTarget && handleCancelDelete()}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="delete-modal"
              >
                <div className="delete-modal-header">
                  <AlertTriangle size={24} className="warning-icon" />
                  <h3>성과 항목 삭제</h3>
                </div>
                
                <div className="delete-modal-content">
                  <p>다음 성과 항목을 정말 삭제하시겠습니까?</p>
                  
                  <div className="delete-target">
                    <strong>{deleteConfirm.performance?.성과항목}</strong>
                    <div className="delete-target-detail">
                      {deleteConfirm.performance?.대분류} › {deleteConfirm.performance?.소분류}
                    </div>
                  </div>
                  
                  <div className="warning-message">
                    <AlertTriangle size={16} />
                    <span>⚠️ 이 성과 항목을 사용하는 모든 과제에서도 해당 성과가 삭제됩니다.</span>
                  </div>
                  
                  {deleteConfirm.connectedProjects.length > 0 && (
                    <div className="connected-projects">
                      <h4>영향을 받는 과제:</h4>
                      <ul>
                        {deleteConfirm.connectedProjects.map((project, index) => (
                          <li key={project.id || `project-${index}`}>{project.과제명}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                
                <div className="delete-modal-actions">
                  <button
                    onClick={handleCancelDelete}
                    className="cancel-delete-btn"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleConfirmDelete}
                    className="confirm-delete-btn"
                  >
                    <Trash2 size={16} />
                    삭제하기
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 모든 성과 삭제 확인 모달 */}
        <AnimatePresence>
          {deleteAllConfirm.isOpen && (
            <motion.div
              key="delete-all-confirm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="delete-modal-overlay"
              onClick={(e) => e.target === e.currentTarget && handleCancelDeleteAll()}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="delete-modal"
              >
                <div className="delete-modal-header">
                  <AlertTriangle size={24} className="warning-icon" />
                  <h3>모든 성과 항목 삭제</h3>
                </div>
                
                <div className="delete-modal-content">
                  <p>등록된 모든 성과 항목을 삭제하시겠습니까?</p>
                  
                  <div className="delete-target">
                    <strong>대상: 전체 {globalPerformances.length}개 성과 항목</strong>
                    <div className="delete-target-detail">
                      모든 대분류 › 모든 소분류
                    </div>
                  </div>
                  
                  <div className="warning-message">
                    <AlertTriangle size={16} />
                    <span>⚠️ 이 동작은 되돌릴 수 없습니다. 모든 프로젝트에서 연결된 성과들도 함께 삭제됩니다.</span>
                  </div>
                </div>
                
                <div className="delete-modal-actions">
                  <button
                    onClick={handleCancelDeleteAll}
                    className="cancel-delete-btn"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleConfirmDeleteAll}
                    className="confirm-delete-btn"
                  >
                    <Trash2 size={16} />
                    전체 삭제
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 닫기 확인 다이얼로그 */}
        <ConfirmDialog
          isOpen={closeConfirm.isOpen}
          onConfirm={handleConfirmClose}
          onCancel={() => setCloseConfirm({ isOpen: false })}
          title="작성 취소"
          message="작성 중인 내용이 있습니다. 정말 닫으시겠습니까?"
          confirmText="닫기"
          cancelText="계속 작성"
          variant="warning"
        />
      </motion.div>
    </AnimatePresence>

      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }

        .performance-modal {
          background: white;
          border-radius: 0.75rem;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          width: 100%;
          max-width: 1800px;
          max-height: 90vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          /* 상단 여백 축소 — 헤더/패널헤더/폼 패딩이 겹쳐 '기본 정보'가 너무 아래에 있었다 */
          padding: 1rem 1.5rem;
          border-bottom: 1px solid #e5e7eb;
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white;
          flex-shrink: 0;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .modal-icon {
          color: #fbbf24;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 600;
        }

        .close-btn {
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          padding: 0.5rem;
          border-radius: 0.375rem;
          transition: all 0.2s ease;
        }

        .close-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .modal-info {
          padding: 1rem 1.5rem;
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          border-bottom: 1px solid #f59e0b;
          flex-shrink: 0;
        }

        .modal-info p {
          margin: 0;
          font-size: 0.875rem;
          color: #92400e;
        }

        .modal-content {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        .left-panel,
        .right-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .left-panel {
          border-right: 1px solid #e5e7eb;
          background: #fefefe;
        }

        .right-panel {
          background: #f9fafb;
        }

        .panel-header {
          padding: 0.75rem 1.5rem;
          /*
           * margin-bottom 을 명시적으로 0 으로 눌러둔다.
           * digital-twin-solution 모듈의 TechnologyPanel.css 가 같은 이름의 전역 클래스
           * .panel-header 에 margin-bottom: 1.5rem 을 주고 있어서,
           * 번들이 합쳐지면 이 모달에도 그 여백이 새어 들어온다.
           */
          margin-bottom: 0;
          border-bottom: 1px solid #e5e7eb;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .panel-header h3 {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
          color: #374151;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .reset-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          background: #f3f4f6;
          color: #6b7280;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .reset-btn:hover {
          background: #e5e7eb;
          border-color: #9ca3af;
          color: #374151;
        }

        .delete-all-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          background: #fee2e2;
          color: #dc2626;
          border: 1px solid #fca5a5;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s ease;
          font-weight: 500;
        }

        .delete-all-btn:hover {
          background: #fecaca;
          border-color: #f87171;
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(220, 38, 38, 0.2);
        }

        /*
         * 폼은 스크롤하지 않는다. 안쪽 .create-form-scroll 만 스크롤하고
         * 하단 .form-actions(저장 버튼)는 항상 보이도록 밖에 고정한다.
         */
        .create-form {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
          padding: 0;
          overflow: hidden;
        }

        .create-form-scroll {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 0.875rem 1.5rem 1rem 1.5rem;
        }

        .form-section {
          margin-bottom: 1.25rem;
        }

        .form-section h4 {
          margin: 0 0 0.75rem 0;
          font-size: 0.9rem;
          font-weight: 600;
          color: #374151;
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 0.375rem;
        }

        .form-row {
          margin-bottom: 1rem;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .form-grid-three {
          display: grid;
          grid-template-columns: 1fr 1fr 0.8fr;
          gap: 1rem;
        }

        /* 사업부 · 성과년도처럼 짧은 필드 두 개를 한 행에 */
        .form-grid-two {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .form-grid-two > .form-row {
          margin-bottom: 1rem;
        }

        /* 현재 대비 변화량 — 입력값에서 바로 계산해 보여준다 */
        .delta-strip {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin: -0.25rem 0 1rem 0;
          padding: 0.5rem 0.75rem;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
        }

        .delta-item {
          display: inline-flex;
          align-items: baseline;
          gap: 0.375rem;
          padding-right: 0.75rem;
          border-right: 1px solid #e2e8f0;
        }

        .delta-item:last-child {
          border-right: none;
          padding-right: 0;
        }

        .delta-item em {
          font-style: normal;
          font-size: 0.7rem;
          color: #94a3b8;
        }

        .delta-item b {
          font-size: 0.8rem;
          font-weight: 600;
          color: #334155;
          font-variant-numeric: tabular-nums;
        }

        .delta-rate b {
          color: #4f46e5;
        }

        /* 월별 실적 입력 그리드 */
        .monthly-performance-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.75rem;
          margin-top: 0.5rem;
        }

        .monthly-input-wrapper {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .monthly-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: #64748b;
          margin-bottom: 0;
        }

        .monthly-input {
          padding: 0.5rem;
          font-size: 0.875rem;
        }

        /*
         * 입력 행 정렬 — 라벨은 항상 왼쪽, 입력은 남는 폭 전부.
         *
         * 예전에는 .form-row:first-child, :nth-child(2) 처럼 위치로 규칙을 걸어서
         * 행을 하나만 묶거나 옮겨도 정렬이 어긋났다 (라벨이 어떤 줄은 위, 어떤 줄은 왼쪽).
         * 이제 구조(어느 그리드에 속하는지)로만 판단한다.
         */
        .form-section:first-child .form-row:not(.checkbox-row) {
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          gap: 0.75rem !important;
        }

        .form-section:first-child .form-row:not(.checkbox-row) > label {
          margin-bottom: 0 !important;
          flex-shrink: 0 !important;
          font-size: 0.8rem !important;
          text-align: left !important;
          color: #4b5563;
        }

        .form-section:first-child .form-row:not(.checkbox-row) > .form-select,
        .form-section:first-child .form-row:not(.checkbox-row) > .form-input {
          flex: 1 !important;
          min-width: 0 !important;
        }

        /* 한 줄 전체를 쓰는 행(성과 항목명) — 넓은 라벨 */
        .form-section:first-child > .form-row:not(.checkbox-row) > label {
          width: 80px !important;
          min-width: 80px !important;
          max-width: 80px !important;
        }

        /* 2열 그리드(사업부·성과년도) */
        .form-section:first-child > .form-grid-two > .form-row > label {
          width: 68px !important;
          min-width: 68px !important;
          max-width: 68px !important;
        }

        /* 3열 그리드(대분류·소분류·단위 / 현재·목표·실적) — 좁으므로 라벨도 좁게 */
        .form-section:first-child > .form-grid-three > .form-row > label {
          width: 50px !important;
          min-width: 50px !important;
          max-width: 50px !important;
        }

        /* 현재/목표/실적 라벨 - 도움말 아이콘 자리 확보 */
        .form-section:first-child > .form-grid-three > .form-row > label.with-tooltip {
          width: 62px !important;
          min-width: 62px !important;
          max-width: 62px !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 4px !important;
          overflow: visible !important;
        }

        .label-info-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
          cursor: help;
          position: relative;
          flex-shrink: 0;
          transition: color 0.15s ease;
        }

        .label-info-icon:hover {
          color: #6366f1;
        }

        .label-info-icon:hover::after {
          content: attr(data-tooltip);
          position: absolute;
          top: calc(100% + 8px);
          left: -8px;
          background: #1e293b;
          color: #f8fafc;
          padding: 0.6rem 0.75rem;
          border-radius: 0.375rem;
          font-size: 0.75rem;
          font-weight: 400;
          line-height: 1.5;
          letter-spacing: -0.01em;
          white-space: normal;
          width: max-content;
          max-width: 320px;
          z-index: 9999;
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
          text-align: left;
          pointer-events: none;
        }

        .label-info-icon:hover::before {
          content: '';
          position: absolute;
          top: 100%;
          left: 0;
          margin-top: 2px;
          border: 6px solid transparent;
          border-bottom-color: #1e293b;
          z-index: 10000;
          pointer-events: none;
        }

        /* 상세 설명 필드 - 80px 레이블 */
        .description-row {
          display: flex !important;
          flex-direction: row !important;
          align-items: flex-start !important;
          gap: 0.75rem !important;
        }

        .description-row > label {
          margin-bottom: 0 !important;
          flex-shrink: 0 !important;
          width: 80px !important;
          min-width: 80px !important;
          max-width: 80px !important;
          font-size: 0.8rem !important;
          text-align: left !important;
          padding-top: 0.875rem;
        }

        .description-row > .form-textarea {
          flex: 1 !important;
          min-width: 0;
          box-sizing: border-box;
        }

        .form-row label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 500;
          color: #374151;
          font-size: 0.875rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-align: left;
        }

        /* 조치 사항 행 - 상세 설명과 동일한 레이아웃 */
        .action-row {
          display: flex !important;
          flex-direction: row !important;
          align-items: flex-start !important;
          gap: 0.75rem !important;
        }

        .action-row > label {
          margin-bottom: 0 !important;
          flex-shrink: 0 !important;
          width: 80px !important;
          min-width: 80px !important;
          max-width: 80px !important;
          font-size: 0.8rem !important;
          text-align: left !important;
          white-space: nowrap !important;
          overflow: visible !important;
          padding-top: 0.875rem;
        }

        .action-row > .action-items-container {
          flex: 1 !important;
          min-width: 0;
        }

        .action-items-container {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .action-items-container .form-select {
          width: 100%;
          box-sizing: border-box;
        }

        .action-tags-container {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          padding: 0.5rem;
          background: #fef3c7;
          border: 1px solid #fcd34d;
          border-radius: 0.375rem;
        }

        .action-tag {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.375rem 0.5rem;
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white;
          border-radius: 0.375rem;
          font-size: 0.8rem;
          font-weight: 500;
        }

        .action-tag-remove {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          background: rgba(255, 255, 255, 0.3);
          border: none;
          border-radius: 50%;
          color: white;
          font-size: 14px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s ease;
          line-height: 1;
        }

        .action-tag-remove:hover {
          background: rgba(255, 255, 255, 0.5);
          transform: scale(1.1);
        }

        /* 검색 가능한 드롭다운 */
        .searchable-dropdown {
          position: relative;
          width: 100%;
        }

        .searchable-dropdown-input {
          width: 100%;
          box-sizing: border-box;
        }

        .searchable-dropdown-list {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          max-height: 250px;
          overflow-y: auto;
          background: white;
          border: 1px solid #d1d5db;
          border-top: none;
          border-radius: 0 0 0.5rem 0.5rem;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 1000;
        }

        .searchable-dropdown-item {
          padding: 0.75rem 1rem;
          cursor: pointer;
          transition: background-color 0.15s ease;
          font-size: 0.875rem;
          color: #374151;
          border-bottom: 1px solid #f3f4f6;
        }

        .searchable-dropdown-item:last-child {
          border-bottom: none;
        }

        .searchable-dropdown-item:hover {
          background-color: #f3f4f6;
        }

        .searchable-dropdown-item-clear {
          background-color: #fef3c7;
          color: #92400e;
          font-weight: 500;
        }

        .searchable-dropdown-item-clear:hover {
          background-color: #fde68a;
        }

        .searchable-dropdown-empty {
          padding: 1rem;
          text-align: center;
          color: #9ca3af;
          font-size: 0.875rem;
        }

        /* 체크박스가 있는 행은 텍스트를 한 줄로 표시하되 잘리지 않게 */
        .checkbox-row label {
          white-space: nowrap !important;
          overflow: visible !important;
          text-overflow: clip !important;
          display: inline-flex !important;
          align-items: center !important;
          width: auto !important;
          max-width: none !important;
        }

        .required {
          color: #ef4444;
        }

        .form-input,
        .form-select,
        .form-textarea {
          width: 100%;
          padding: 0.875rem;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          transition: all 0.2s ease;
          box-sizing: border-box;
          min-height: 42px;
        }

        .form-select {
          padding: 0.75rem 0.875rem;
          background-color: white;
          background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
          background-position: right 0.75rem center;
          background-repeat: no-repeat;
          background-size: 1.5em 1.5em;
          appearance: none;
          cursor: pointer;
        }

        .form-input.auto-set {
          background-color: #f3f4f6;
          color: #6b7280;
          cursor: not-allowed;
          border-color: #d1d5db;
        }

        .form-input:focus,
        .form-select:focus,
        .form-textarea:focus {
          outline: none;
          border-color: #f59e0b;
          box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1);
        }

        .form-select:disabled {
          background-color: #f9fafb;
          color: #9ca3af;
          cursor: not-allowed;
          background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
        }

        .form-textarea {
          resize: vertical;
          min-height: 80px;
        }

        /* 스크롤 밖에 고정된 저장 버튼 영역 */
        .form-actions {
          flex-shrink: 0;
          margin-top: 0;
          padding: 0.875rem 1.5rem;
          border-top: 1px solid #e5e7eb;
          background: #fefefe;
        }

        .form-actions-row {
          display: flex;
          gap: 0.75rem;
        }

        .submit-btn {
          flex: 1;
          padding: 0.875rem 1rem;
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white;
          border: none;
          border-radius: 0.375rem;
          font-weight: 500;
          font-size: 0.8125rem;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          white-space: nowrap;
        }

        .submit-btn:hover {
          background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
        }

        .submit-btn:active {
          transform: translateY(0);
        }

        .submit-upload-btn {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        }

        .submit-upload-btn:hover {
          background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
        }

        .save-as-new-btn {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        }

        .save-as-new-btn:hover {
          background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
        }

        .submit-delete-btn {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        }

        .submit-delete-btn:hover {
          background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
        }

        .list-filters {
          padding: 1rem 1.5rem;
          border-bottom: 1px solid #e5e7eb;
          flex-shrink: 0;
        }

        .search-box {
          position: relative;
          margin-bottom: 0.75rem;
          width: 100%;
        }

        .search-icon {
          position: absolute;
          left: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          color: #9ca3af;
        }

        .search-input {
          display: block !important;
          width: 100% !important;
          max-width: none !important;
          min-width: 0 !important;
          padding: 0.75rem 0.75rem 0.75rem 2.5rem;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          box-sizing: border-box;
        }

        .search-input:focus {
          outline: none;
          border-color: #f59e0b;
          box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1);
        }

        .filter-grid-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.75rem;
          margin-bottom: 0.5rem;
        }

        .filter-grid-row:last-child {
          margin-bottom: 0;
          grid-template-columns: repeat(2, 1fr);
        }

        .filter-select {
          padding: 0.5rem;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          background: white;
          width: 100%;
          min-width: 0;
          max-width: none;
        }

        .filter-select:disabled {
          background: #f9fafb;
          color: #9ca3af;
        }

        .performance-list {
          flex: 1;
          overflow-y: auto;
          padding: 1rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .empty-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          color: #6b7280;
          padding: 2rem;
        }

        .empty-icon {
          color: #d1d5db;
          margin-bottom: 1rem;
        }

        .empty-state p {
          margin: 0.25rem 0;
          font-weight: 500;
        }

        .empty-subtitle {
          font-size: 0.875rem;
          color: #9ca3af;
          font-style: italic;
        }

        .sample-item {
          border-left: 4px solid #f59e0b;
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 10%, white 10%);
        }

        .sample-badge {
          display: inline-block;
          background: #f59e0b;
          color: white;
          font-size: 0.75rem;
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          margin-left: 0.5rem;
          font-weight: 500;
        }

        .performance-card {
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          padding: 1rem;
          background: white;
          transition: all 0.2s ease;
          cursor: pointer;
          position: relative;
        }

        .performance-card:hover {
          border-color: #f59e0b;
          box-shadow: 0 2px 4px rgba(245, 158, 11, 0.1);
          transform: translateY(-1px);
        }

        .performance-card.editing {
          border-color: #3b82f6;
          background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 10%, white 10%);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
        }

        .performance-card.editing:hover {
          border-color: #2563eb;
          box-shadow: 0 6px 16px rgba(59, 130, 246, 0.2);
        }

        .card-header {
          margin-bottom: 0.75rem;
          position: relative;
        }

        .performance-title {
          font-weight: 600;
          color: #374151;
          font-size: 1rem;
          margin-bottom: 0.25rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
        }

        .title-content {
          display: flex;
          align-items: center;
          flex: 1;
          min-width: 0;
        }

        .performance-badges {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 0.375rem;
          flex-wrap: wrap;
        }

        .performance-id-badge {
          display: inline-block;
          background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
          color: #4338ca;
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          border: 1px solid #a5b4fc;
          font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
        }

        .performance-year-badge {
          display: inline-block;
          background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
          color: #1e40af;
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          border: 1px solid #93c5fd;
        }

        .performance-report-badge {
          display: inline-block;
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          color: #92400e;
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          border: 1px solid #fcd34d;
        }

        /* 뷰 모드 토글 */
        .view-toggle {
          display: flex;
          gap: 2px;
          background: #f1f5f9;
          border-radius: 0.375rem;
          padding: 2px;
          margin-left: auto;
          margin-right: 0.5rem;
        }

        .view-toggle-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.3rem 0.5rem;
          border: none;
          border-radius: 0.25rem;
          background: transparent;
          color: #94a3b8;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .view-toggle-btn.active {
          background: white;
          color: #4f46e5;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
        }

        .view-toggle-btn:hover:not(.active) {
          color: #64748b;
        }

        /* 테이블 뷰 */
        .perf-table-wrapper {
          overflow-x: auto;
        }

        .perf-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.8rem;
        }

        .perf-table thead {
          position: sticky;
          top: 0;
          z-index: 1;
        }

        .perf-table th {
          background: #f8fafc;
          color: #64748b;
          font-weight: 600;
          font-size: 0.75rem;
          padding: 0.5rem 0.6rem;
          text-align: left;
          border-bottom: 1px solid #e2e8f0;
          white-space: nowrap;
        }

        .perf-table-th-name { min-width: 120px; }
        .perf-table-th-cat { min-width: 60px; }
        .perf-table-th-num { text-align: right !important; min-width: 50px; }
        .perf-table-th-unit { text-align: center !important; min-width: 40px; }
        .perf-table-th-action { width: 32px; }

        .perf-table-row {
          cursor: pointer;
          transition: background 0.1s ease;
        }

        .perf-table-row:hover {
          background: #f1f5f9;
        }

        .perf-table-row.editing {
          background: #eef2ff;
        }

        .perf-table-row td {
          padding: 0.45rem 0.6rem;
          border-bottom: 1px solid #f1f5f9;
          color: #374151;
          vertical-align: middle;
        }

        .perf-table-td-name {
          max-width: 200px;
        }

        .perf-table-name-text {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-weight: 500;
        }

        .perf-table-td-cat {
          color: #6b7280;
          font-size: 0.75rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100px;
        }

        .perf-table-td-num {
          text-align: right;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }

        .perf-table-td-unit {
          text-align: center;
          color: #6b7280;
          font-size: 0.75rem;
        }

        .perf-table-td-action {
          padding: 0.25rem !important;
        }

        .perf-table-td-action .delete-btn {
          opacity: 0;
          visibility: hidden;
        }

        .perf-table-row:hover .perf-table-td-action .delete-btn {
          opacity: 1;
          visibility: visible;
        }

        .delete-btn {
          background: none;
          border: none;
          color: #dc2626;
          cursor: pointer;
          padding: 0.375rem;
          border-radius: 0.375rem;
          transition: all 0.2s ease;
          opacity: 0;
          visibility: hidden;
          transform: scale(0.8);
          flex-shrink: 0;
        }

        .performance-card:hover .delete-btn {
          opacity: 1;
          visibility: visible;
          transform: scale(1);
        }

        .delete-btn:hover {
          background: #fef2f2;
          color: #b91c1c;
          transform: scale(1.1);
        }

        .card-content {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .performance-detail {
          font-size: 0.875rem;
          color: #6b7280;
        }

        .performance-detail-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          font-size: 0.875rem;
          color: #6b7280;
        }

        .detail-item {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
        }

        .detail-item.action-badge {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          color: #92400e;
          padding: 0.125rem 0.5rem;
          border-radius: 0.25rem;
          border: 1px solid #fcd34d;
          font-weight: 500;
          max-width: 100%;
          word-break: break-word;
        }

        .detail-item.action-badge .label {
          color: #78350f;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .label {
          font-weight: 500;
          color: #374151;
        }

        .performance-levels {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          font-size: 0.875rem;
        }

        .level-item {
          background: #f3f4f6;
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          color: #4b5563;
          font-size: 0.8rem;
        }

        .level-item.monthly-badge {
          background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
          color: #1e40af;
          font-weight: 600;
          border: 1px solid #93c5fd;
        }

        .performance-description {
          font-size: 0.875rem;
          color: #6b7280;
          line-height: 1.4;
          padding: 0.5rem;
          background: #f9fafb;
          border-radius: 0.25rem;
          border-left: 3px solid #f59e0b;
        }

        .performance-meta {
          font-size: 0.75rem;
          color: #9ca3af;
          padding-top: 0.5rem;
          border-top: 1px solid #f3f4f6;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          padding: 1rem 1.5rem;
          border-top: 1px solid #e5e7eb;
          background: #f9fafb;
          flex-shrink: 0;
        }

        .close-modal-btn {
          padding: 0.75rem 1.5rem;
          background: white;
          color: #6b7280;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          font-weight: 500;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .close-modal-btn:hover {
          background: #f9fafb;
          border-color: #9ca3af;
        }

        /* 삭제 확인 모달 스타일 */
        .delete-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1100;
          padding: 1rem;
        }

        .delete-modal {
          background: white;
          border-radius: 0.75rem;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          width: 100%;
          max-width: 500px;
          overflow: hidden;
        }

        .delete-modal-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1.5rem;
          border-bottom: 1px solid #e5e7eb;
          background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
        }

        .warning-icon {
          color: #dc2626;
        }

        .delete-modal-header h3 {
          margin: 0;
          font-size: 1.125rem;
          font-weight: 600;
          color: #dc2626;
        }

        .delete-modal-content {
          padding: 1.5rem;
        }

        .delete-modal-content p {
          margin: 0 0 1rem 0;
          color: #374151;
          font-size: 0.875rem;
        }

        .delete-target {
          background: #f9fafb;
          padding: 1rem;
          border-radius: 0.5rem;
          border-left: 4px solid #dc2626;
          margin: 1rem 0;
        }

        .delete-target strong {
          display: block;
          color: #dc2626;
          font-size: 1rem;
          margin-bottom: 0.5rem;
        }

        .delete-target-detail {
          color: #6b7280;
          font-size: 0.875rem;
        }

        .warning-message {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem;
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 0.375rem;
          margin: 1rem 0;
        }

        .warning-message span {
          color: #92400e;
          font-size: 0.875rem;
        }

        .connected-projects {
          margin-top: 1rem;
          padding: 1rem;
          background: #f3f4f6;
          border-radius: 0.375rem;
        }

        .connected-projects h4 {
          margin: 0 0 0.5rem 0;
          color: #374151;
          font-size: 0.875rem;
          font-weight: 600;
        }

        .connected-projects ul {
          margin: 0;
          padding-left: 1.5rem;
          color: #6b7280;
          font-size: 0.875rem;
        }

        .connected-projects li {
          margin-bottom: 0.25rem;
        }

        .delete-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          padding: 1rem 1.5rem;
          border-top: 1px solid #e5e7eb;
          background: #f9fafb;
        }

        .cancel-delete-btn,
        .confirm-delete-btn {
          padding: 0.75rem 1.5rem;
          border-radius: 0.375rem;
          font-weight: 500;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .cancel-delete-btn {
          background: white;
          color: #6b7280;
          border: 1px solid #d1d5db;
        }

        .cancel-delete-btn:hover {
          background: #f9fafb;
          border-color: #9ca3af;
        }

        .confirm-delete-btn {
          background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
          color: white;
          border: none;
        }

        .confirm-delete-btn:hover {
          background: linear-gradient(135deg, #b91c1c 0%, #991b1b 100%);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
        }

        @media (max-width: 1024px) {
          .performance-modal {
            max-width: 95vw;
          }
          
          .modal-content {
            flex-direction: column;
          }
          
          .left-panel {
            border-right: none;
            border-bottom: 1px solid #e5e7eb;
            max-height: 50vh;
          }
          
          .form-grid {
            grid-template-columns: 1fr;
          }
          
          .form-grid-three {
            grid-template-columns: 1fr;
          }

          .form-grid-two {
            grid-template-columns: 1fr;
          }

          .filter-grid-row {
            grid-template-columns: 1fr;
          }

          .filter-grid-row:last-child {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 768px) {
          .modal-overlay {
            padding: 0.5rem;
          }
          
          .performance-modal {
            max-height: 95vh;
          }
          
          .create-form,
          .list-filters,
          .performance-list {
            padding: 1rem;
          }
          
          .delete-modal-overlay {
            padding: 0.5rem;
          }
          
          .delete-modal {
            max-width: 95vw;
          }
        }
      `}</style>

      {/* 로직 설정 모달 */}
      <AnimatePresence>
        {logicModalOpen && logicData && (() => {
          const isSumThenMultiply = logicData.연산타입 === 'SUM_THEN_MULTIPLY';
          const preview = calculateAllLogicResults(logicData);
          const uniqueGroups = [...new Set(logicData.변수목록.map(v => v.그룹 || 'A'))];

          // SUM_THEN_MULTIPLY일 때 그룹연산 설정에 없는 그룹 자동 추가
          const 그룹연산 = logicData.연산설정?.그룹연산 || [];
          const existingGroupNames = 그룹연산.map(g => g.그룹);
          const missingGroups = uniqueGroups.filter(g => !existingGroupNames.includes(g));
          if (missingGroups.length > 0 && isSumThenMultiply) {
            const updated = [...그룹연산, ...missingGroups.map(g => ({ 그룹: g, 연산: 'SUM' }))];
            // 비동기로 상태 업데이트 (렌더링 사이클 이후)
            setTimeout(() => {
              setLogicData(prev => ({
                ...prev,
                연산설정: { ...prev.연산설정, 그룹연산: updated }
              }));
            }, 0);
          }

          const getOperationSymbol = (type) => {
            switch (type) {
              case 'SUM': return '+';
              case 'MULTIPLY': return '×';
              case 'DIVIDE': return '÷';
              case 'AVERAGE': return '+';
              default: return '+';
            }
          };

          const buildPreviewExpression = (field) => {
            const vars = logicData.변수목록;
            const values = vars.map(v => v[field] !== '' ? v[field] : '?');

            if (logicData.연산타입 === 'SUM_THEN_MULTIPLY') {
              const groups = {};
              vars.forEach((v, i) => {
                const grp = v.그룹 || 'A';
                if (!groups[grp]) groups[grp] = [];
                groups[grp].push(values[i]);
              });
              const groupExprs = Object.entries(groups).map(([grp, vals]) => {
                const grpOp = 그룹연산.find(g => g.그룹 === grp);
                const sym = getOperationSymbol(grpOp?.연산 || 'SUM');
                const expr = vals.join(` ${sym} `);
                return vals.length > 1 ? `(${expr})` : expr;
              });
              const interSym = getOperationSymbol(logicData.연산설정?.그룹간연산 || 'MULTIPLY');
              return groupExprs.join(` ${interSym} `);
            }

            if (logicData.연산타입 === 'AVERAGE') {
              return `(${values.join(' + ')}) / ${values.length}`;
            }

            const sym = getOperationSymbol(logicData.연산타입);
            return values.join(` ${sym} `);
          };

          return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000
            }}
            onClick={() => { setLogicModalOpen(false); setTemplateListOpen(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'white',
                borderRadius: '0.75rem',
                width: '60vw',
                minWidth: '60vw',
                maxWidth: '60vw',
                height: '85vh',
                overflow: 'hidden',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {/* 헤더 (overflow visible for dropdown) */}
              <div style={{ padding: '1.5rem 1.5rem 0 1.5rem', overflow: 'visible', position: 'relative', zIndex: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>로직 설정</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {/* 템플릿 저장 */}
                  <button
                    type="button"
                    onClick={handleSaveTemplate}
                    style={{
                      padding: '0.3rem 0.65rem',
                      background: '#f0fdf4',
                      color: '#16a34a',
                      border: '1px solid #bbf7d0',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      fontWeight: 500
                    }}
                  >
                    템플릿 저장
                  </button>
                  {/* 템플릿 불러오기 */}
                  <div style={{ position: 'relative' }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const opening = !templateListOpen;
                        setTemplateListOpen(opening);
                        if (opening) { setTemplateSearchTerm(''); setTemplatePage(0); }
                      }}
                      style={{
                        padding: '0.3rem 0.65rem',
                        background: '#eff6ff',
                        color: '#2563eb',
                        border: '1px solid #bfdbfe',
                        borderRadius: '0.375rem',
                        cursor: 'pointer',
                        fontSize: '0.78rem',
                        fontWeight: 500
                      }}
                    >
                      템플릿 불러오기
                    </button>
                    {/* 템플릿 목록 드롭다운 */}
                    {templateListOpen && (() => {
                      const ITEMS_PER_PAGE = 10;
                      const filtered = logicTemplates.filter(t =>
                        !templateSearchTerm || t.이름.toLowerCase().includes(templateSearchTerm.toLowerCase()) ||
                        t.연산타입.toLowerCase().includes(templateSearchTerm.toLowerCase())
                      );
                      const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
                      const safePage = Math.min(templatePage, totalPages - 1);
                      const pageItems = filtered.slice(safePage * ITEMS_PER_PAGE, (safePage + 1) * ITEMS_PER_PAGE);

                      return (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            marginTop: '0.25rem',
                            background: 'white',
                            border: '1px solid #d1d5db',
                            borderRadius: '0.5rem',
                            boxShadow: '0 12px 36px rgba(0,0,0,0.2)',
                            zIndex: 10001,
                            width: '380px',
                            maxHeight: '480px',
                            display: 'flex',
                            flexDirection: 'column'
                          }}
                        >
                          {/* 헤더 + 검색 */}
                          <div style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>
                              저장된 템플릿 ({logicTemplates.length})
                              {templateSearchTerm && filtered.length !== logicTemplates.length && (
                                <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: '0.4rem' }}>
                                  · 검색결과 {filtered.length}건
                                </span>
                              )}
                            </div>
                            <div style={{ position: 'relative' }}>
                              <Search size={14} style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                              <input
                                type="text"
                                value={templateSearchTerm}
                                onChange={(e) => { setTemplateSearchTerm(e.target.value); setTemplatePage(0); }}
                                placeholder="템플릿 검색 (이름, 연산타입)"
                                style={{
                                  width: '100%',
                                  padding: '0.35rem 0.5rem 0.35rem 1.75rem',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '0.375rem',
                                  fontSize: '0.8rem',
                                  outline: 'none',
                                  boxSizing: 'border-box'
                                }}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          </div>

                          {/* 목록 */}
                          <div style={{ overflow: 'auto', flex: 1, maxHeight: '320px' }}>
                            {filtered.length === 0 ? (
                              <div style={{ padding: '1.5rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
                                {logicTemplates.length === 0 ? '저장된 템플릿이 없습니다.' : '검색 결과가 없습니다.'}
                              </div>
                            ) : (
                              pageItems.map(tmpl => (
                                <div
                                  key={tmpl.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '0.55rem 0.75rem',
                                    borderBottom: '1px solid #f1f5f9',
                                    cursor: 'pointer',
                                    transition: 'background 0.15s'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = '#f0f9ff'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                  <div
                                    onClick={() => handleLoadTemplate(tmpl)}
                                    style={{ flex: 1, minWidth: 0 }}
                                  >
                                    <div style={{ fontSize: '0.84rem', fontWeight: 500, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {tmpl.이름}
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.1rem' }}>
                                      {tmpl.연산타입} · 변수 {tmpl.변수목록.length}개
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(tmpl.id); }}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '0.25rem', marginLeft: '0.5rem', flexShrink: 0 }}
                                    title="템플릿 삭제"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              ))
                            )}
                          </div>

                          {/* 페이지네이션 */}
                          {totalPages > 1 && (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.5rem',
                              padding: '0.4rem 0.75rem',
                              borderTop: '1px solid #e2e8f0',
                              fontSize: '0.78rem',
                              color: '#64748b'
                            }}>
                              <button
                                type="button"
                                disabled={safePage === 0}
                                onClick={(e) => { e.stopPropagation(); setTemplatePage(p => Math.max(0, p - 1)); }}
                                style={{
                                  padding: '0.2rem 0.5rem',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '0.25rem',
                                  background: safePage === 0 ? '#f8fafc' : 'white',
                                  cursor: safePage === 0 ? 'not-allowed' : 'pointer',
                                  color: safePage === 0 ? '#cbd5e1' : '#475569',
                                  fontSize: '0.78rem'
                                }}
                              >
                                이전
                              </button>
                              <span>{safePage + 1} / {totalPages}</span>
                              <button
                                type="button"
                                disabled={safePage >= totalPages - 1}
                                onClick={(e) => { e.stopPropagation(); setTemplatePage(p => Math.min(totalPages - 1, p + 1)); }}
                                style={{
                                  padding: '0.2rem 0.5rem',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '0.25rem',
                                  background: safePage >= totalPages - 1 ? '#f8fafc' : 'white',
                                  cursor: safePage >= totalPages - 1 ? 'not-allowed' : 'pointer',
                                  color: safePage >= totalPages - 1 ? '#cbd5e1' : '#475569',
                                  fontSize: '0.78rem'
                                }}
                              >
                                다음
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  <button
                    onClick={() => { setLogicModalOpen(false); setTemplateListOpen(false); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: '#64748b' }}
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              </div>

              {/* 스크롤 가능한 본문 영역 */}
              <div style={{ padding: '0 1.5rem 1.5rem 1.5rem', overflow: 'auto', flex: 1 }} onClick={() => setTemplateListOpen(false)}>

              {/* 연산 방법 선택 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <label style={{ fontWeight: 500, fontSize: '0.875rem', color: '#374151', minWidth: '70px' }}>연산 방법:</label>
                <select
                  value={logicData.연산타입}
                  onChange={(e) => handleOperationChange(e.target.value)}
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #d1d5db',
                    fontSize: '0.85rem',
                    background: 'white',
                    cursor: 'pointer'
                  }}
                >
                  <option value="SUM">SUM (합산)</option>
                  <option value="MULTIPLY">MULTIPLY (곱셈)</option>
                  <option value="DIVIDE">DIVIDE (나눗셈)</option>
                  <option value="AVERAGE">AVERAGE (평균)</option>
                  <option value="SUM_THEN_MULTIPLY">SUM_THEN_MULTIPLY (그룹 합산 후 곱셈)</option>
                </select>

                {isSumThenMultiply && (
                  <>
                    <label style={{ fontWeight: 500, fontSize: '0.85rem', color: '#374151', marginLeft: '0.5rem' }}>그룹간 연산:</label>
                    <select
                      value={logicData.연산설정?.그룹간연산 || 'MULTIPLY'}
                      onChange={(e) => handleInterGroupOperationChange(e.target.value)}
                      style={{
                        padding: '0.4rem 0.75rem',
                        borderRadius: '0.375rem',
                        border: '1px solid #d1d5db',
                        fontSize: '0.85rem',
                        background: 'white',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="MULTIPLY">MULTIPLY (곱셈)</option>
                      <option value="SUM">SUM (합산)</option>
                      <option value="DIVIDE">DIVIDE (나눗셈)</option>
                    </select>
                  </>
                )}
              </div>

              {/* SUM_THEN_MULTIPLY 그룹별 연산 설정 */}
              {isSumThenMultiply && uniqueGroups.length > 0 && (
                <div style={{
                  display: 'flex',
                  gap: '0.75rem',
                  marginBottom: '1rem',
                  flexWrap: 'wrap',
                  padding: '0.5rem 0.75rem',
                  background: '#f8fafc',
                  borderRadius: '0.375rem',
                  border: '1px solid #e2e8f0'
                }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500, lineHeight: '2' }}>그룹별 연산:</span>
                  {uniqueGroups.map(grp => {
                    const grpSetting = 그룹연산.find(g => g.그룹 === grp);
                    return (
                      <div key={grp} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#4f46e5' }}>그룹 {grp}:</span>
                        <select
                          value={grpSetting?.연산 || 'SUM'}
                          onChange={(e) => handleGroupOperationChange(grp, e.target.value)}
                          style={{ padding: '0.2rem 0.4rem', borderRadius: '0.25rem', border: '1px solid #d1d5db', fontSize: '0.8rem' }}
                        >
                          <option value="SUM">SUM</option>
                          <option value="MULTIPLY">MULTIPLY</option>
                          <option value="AVERAGE">AVERAGE</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 변수 테이블 */}
              <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '0.5rem', textAlign: 'center', width: '36px', color: '#64748b' }}>#</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', minWidth: '100px', color: '#374151' }}>변수명</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', minWidth: '60px', color: '#374151' }}>단위</th>
                      {isSumThenMultiply && <th style={{ padding: '0.5rem', textAlign: 'center', width: '55px', color: '#374151' }}>그룹</th>}
                      <th style={{ padding: '0.5rem', textAlign: 'right', minWidth: '80px', color: '#374151' }}>현재</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right', minWidth: '80px', color: '#374151' }}>목표</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right', minWidth: '80px', color: '#374151' }}>실적</th>
                      <th style={{ padding: '0.5rem', textAlign: 'center', width: '40px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {logicData.변수목록.map((variable, index) => (
                      <tr key={variable.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.4rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>{index + 1}</td>
                        <td style={{ padding: '0.4rem' }}>
                          <input
                            type="text"
                            value={variable.이름}
                            onChange={(e) => handleVariableChange(variable.id, '이름', e.target.value)}
                            placeholder="변수명"
                            style={{ width: '100%', padding: '0.3rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.25rem', fontSize: '0.85rem' }}
                          />
                        </td>
                        <td style={{ padding: '0.4rem' }}>
                          <input
                            type="text"
                            value={variable.단위}
                            onChange={(e) => handleVariableChange(variable.id, '단위', e.target.value)}
                            placeholder="단위"
                            style={{ width: '100%', padding: '0.3rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.25rem', fontSize: '0.85rem' }}
                          />
                        </td>
                        {isSumThenMultiply && (
                          <td style={{ padding: '0.4rem', textAlign: 'center' }}>
                            <select
                              value={variable.그룹 || 'A'}
                              onChange={(e) => handleVariableChange(variable.id, '그룹', e.target.value)}
                              style={{ padding: '0.3rem', border: '1px solid #e2e8f0', borderRadius: '0.25rem', fontSize: '0.85rem', width: '100%' }}
                            >
                              {['A', 'B', 'C', 'D', 'E'].map(g => (
                                <option key={g} value={g}>{g}</option>
                              ))}
                            </select>
                          </td>
                        )}
                        <td style={{ padding: '0.4rem' }}>
                          <input
                            type="text"
                            value={variable.현재}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^0-9.\-]/g, '');
                              handleVariableChange(variable.id, '현재', value);
                            }}
                            placeholder="숫자"
                            style={{ width: '100%', padding: '0.3rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.25rem', fontSize: '0.85rem', textAlign: 'right' }}
                          />
                        </td>
                        <td style={{ padding: '0.4rem' }}>
                          <input
                            type="text"
                            value={variable.목표}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^0-9.\-]/g, '');
                              handleVariableChange(variable.id, '목표', value);
                            }}
                            placeholder="숫자"
                            style={{ width: '100%', padding: '0.3rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.25rem', fontSize: '0.85rem', textAlign: 'right' }}
                          />
                        </td>
                        <td style={{ padding: '0.4rem' }}>
                          <input
                            type="text"
                            value={variable.실적}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^0-9.\-]/g, '');
                              handleVariableChange(variable.id, '실적', value);
                            }}
                            placeholder="숫자"
                            style={{ width: '100%', padding: '0.3rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.25rem', fontSize: '0.85rem', textAlign: 'right' }}
                          />
                        </td>
                        <td style={{ padding: '0.4rem', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveVariable(variable.id)}
                            disabled={logicData.변수목록.length <= 1}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: logicData.변수목록.length <= 1 ? 'not-allowed' : 'pointer',
                              color: logicData.변수목록.length <= 1 ? '#d1d5db' : '#ef4444',
                              padding: '0.2rem',
                              fontSize: '0.9rem'
                            }}
                            title="변수 삭제"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 변수 추가 버튼 */}
              <button
                type="button"
                onClick={handleAddVariable}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '0.4rem 0.75rem',
                  background: '#f1f5f9',
                  border: '1px dashed #cbd5e1',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontSize: '0.825rem',
                  color: '#475569',
                  marginBottom: '1.25rem'
                }}
              >
                <Plus size={14} /> 변수 추가
              </button>

              {/* 계산 미리보기 */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '0.5rem',
                padding: '1rem',
                marginBottom: '1.25rem'
              }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>계산 미리보기</div>
                {['현재', '목표', '실적'].map((field) => {
                  const resultKey = field + '수준';
                  const expression = buildPreviewExpression(field);
                  const result = preview[resultKey];
                  return (
                    <div key={field} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0', fontSize: '0.85rem' }}>
                      <span style={{ fontWeight: 500, color: '#374151', minWidth: '60px' }}>{resultKey}:</span>
                      <span style={{ color: '#64748b', flex: 1 }}>{expression}</span>
                      <span style={{ color: '#1e293b', fontWeight: 600 }}>= {result || '-'}</span>
                    </div>
                  );
                })}
              </div>

              {/* 하단 버튼 */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => { setLogicModalOpen(false); setTemplateListOpen(false); }}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    color: '#475569'
                  }}
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleApplyLogic}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#4f46e5',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 500
                  }}
                >
                  적용
                </button>
              </div>
              </div>{/* 스크롤 영역 닫기 */}
            </motion.div>
          </motion.div>
          );
        })()}
      </AnimatePresence>
    </>
  );
};

export default AddPerformanceModal;