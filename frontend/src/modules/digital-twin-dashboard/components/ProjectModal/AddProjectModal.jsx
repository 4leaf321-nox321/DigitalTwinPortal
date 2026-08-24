import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ClipboardList, BarChart3, CheckSquare, MoreHorizontal, Link2 } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';

import { settingsData } from '../../data/sampleData';
// 충돌(409)은 고장이 아니라 정상 결과다 — 문구 규칙은 어댑터 한 곳에 둔다.
import { saveErrorMessage } from '../../services/dashboardWriteApi';
// 수준값의 0 과 미입력은 다른 뜻이다. `|| ''` 로 다루면 0 이 사라진다.
import { hasLevel, levelText } from '../../utils/levelValue';

import ModalLayout, { HorizontalSectionsContainer } from './components/ModalLayout';
import BasicInfoSection from './components/BasicInfoSection';
import ResponsibleInfoSection from './components/ResponsibleInfoSection';
import PerformanceSection from './components/PerformanceSection';
import RemarksSection from './components/RemarksSection';
import AttachmentSection from './components/AttachmentSection';
import ActionItemsSection from './components/ActionItemsSection';
import KpiLinkSection from './components/KpiLinkSection';
import AlertDialog from '../common/AlertDialog';
import AddPerformanceModal from '../PerformanceModal/AddPerformanceModal';
import { authApi } from '../../../auth/services/authApi';

import { 
  UNIT_OPTIONS, 
  SUBCATEGORY_OPTIONS, 
  INITIAL_FORM_DATA, 
  INITIAL_PERFORMANCE_INPUT,
  INITIAL_PERSONNEL_INPUT,
  firstErrorTab,
  countTabErrors,
} from './constants/formConstants';

import { 
  validateForm, 
  processFormData, 
  resetFormData,
  validatePerformanceInput,
  validateNumericInput
} from './utils/formUtils';

const AddProjectModal = ({ isOpen, onClose, onSubmit, onSubmitAndUpload, currentYear, settingsData, existingProjects = [], globalPerformances = [], onSubmitPerformance, onSubmitPerformanceAndUpload }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [performanceInput, setPerformanceInput] = useState(INITIAL_PERFORMANCE_INPUT);
  const [personnelInput, setPersonnelInput] = useState(INITIAL_PERSONNEL_INPUT);
  const [errors, setErrors] = useState({});

  // 탭 (편집창과 동일한 구조)
  const [activeTab, setActiveTab] = useState('basic');

  // ── DX KPI 연결 (2026-08-24) ──────────────────────────────────────────────
  // 편집창과 **같은 컴포넌트**를 쓰지만 uuid 가 없다 — 사업부를 넘겨 후보만 받는다.
  // `null` = 아직 안 불러옴. KpiLinkSection 이 `onLoaded` 로 채운다.
  const [kpiLinks, setKpiLinks] = useState(null);
  // 사업부가 바뀌었는지 보려고 직전 값을 들고 있다.
  const prevDivisionRef = useRef(null);

  /*
    사업부가 바뀌면 **고른 지표를 버린다.**

    ⚠️ 지표는 (지표 × 대상 사업부) 로 걸린다. 사업부가 바뀌면 기능조직 여부가
       뒤집히고(GTR→MX 면 대상이 자기 사업부로 고정된다) 고른 대상이 통째로 무효가
       된다. 남겨 두면 **엉뚱한 사업부 칸에 기여가 찍힌다.**

    ⚠️ **버렸으면 말해야 한다.** 사업부는 기본정보 탭이고 지표는 다른 탭이라,
       조용히 비우면 저장을 누르고 나서야 없어진 것을 안다. 다만 고른 것이 없을
       때는 알리지 않는다 — 잃은 것이 없는데 창을 띄우면 그다음부터 안 읽는다.
  */
  useEffect(() => {
    const now = formData.사업부 || '';
    const before = prevDivisionRef.current;
    prevDivisionRef.current = now;
    if (before === null || before === now) return;      // 첫 렌더이거나 안 바뀐 것
    const had = Array.isArray(kpiLinks) ? kpiLinks.length : 0;
    setKpiLinks(null);                                  // 섹션이 다시 불러 채운다
    if (had > 0) {
      setAlertDialog({
        isOpen: true,
        variant: 'warning',
        message: `사업부가 「${before || '미지정'}」에서 「${now || '미지정'}」(으)로 바뀌어 `
               + `골라 둔 DX KPI ${had}건을 비웠습니다. 지표는 사업부별로 따로 측정되므로 `
               + `[DX KPI 연결] 탭에서 다시 골라 주세요.`,
      });
    }
  }, [formData.사업부]);   // eslint-disable-line react-hooks/exhaustive-deps

  /** 검증 실패 시 오류가 있는 첫 탭으로 이동 */
  const focusFirstErrorTab = (validationErrors) => {
    const target = firstErrorTab(validationErrors);
    if (target) setActiveTab(target);
  };

  // 첨부파일 대기 목록 (과제 저장 전 선택된 파일들)
  const [pendingFiles, setPendingFiles] = useState([]);

  // 알림 다이얼로그 상태
  const [alertDialog, setAlertDialog] = useState({
    isOpen: false,
    message: ''
  });

  // 새 성과 추가 모달 상태
  const [isAddPerformanceModalOpen, setIsAddPerformanceModalOpen] = useState(false);

  // 성과 수정을 위해 모달에 전달할 성과 정보
  const [performanceToEdit, setPerformanceToEdit] = useState(null);

  // 로컬 성과 목록 (모달 내에서 추가된 성과 포함)
  const [localPerformances, setLocalPerformances] = useState([]);

  useEffect(() => {
    if (isOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';

      // 모달이 열릴 때 시스템 년도로 과제년도 설정하고, 로그인한 사용자 이름을 작성자로 설정
      setFormData(prev => ({
        ...prev,
        과제년도: new Date().getFullYear(),
        작성자: user?.name || ''
      }));

      // 로컬 성과 목록 초기화
      setLocalPerformances(globalPerformances);

      // 새로 열 때는 첫 탭부터 (이전에 보던 탭이 남지 않게)
      setActiveTab('basic');

      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isOpen, currentYear, user, globalPerformances]);

  const divisionOptions = (settingsData || {}).divisions ? settingsData.divisions.map(division => division.name) : [];
  const processOptions = (settingsData || {}).processes ? settingsData.processes.map(process => process.name) : [];
  const domainOptions = (settingsData || {}).projectDomains ? settingsData.projectDomains.map(domain => domain.name) : [];
  const categoryOptions = (settingsData || {}).taskCategories ? settingsData.taskCategories.map(taskCategory => taskCategory.name) : [];
  const statusOptions = (settingsData || {}).statuses ? settingsData.statuses.map(status => status.name) : [];

  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: (i + 1) + '월'
  }));

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    
    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }));
    
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  const handlePerformanceInputChange = (field, value) => {
    setPerformanceInput(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePersonnelInputChange = (field, value) => {
    setPersonnelInput(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const getCategoryName = (categoryId) => {
    const categories = (settingsData || {}).performanceCategories || [];
    const category = categories.find(cat => cat.id === categoryId);
    return category ? category.name : categoryId;
  };
  
  const getSubcategoryName = (subcategoryId) => {
    const subcategories = (settingsData || {}).performanceSubcategories || [];
    const subcategory = subcategories.find(sub => sub.id === subcategoryId);
    return subcategory ? subcategory.name : subcategoryId;
  };
  
  const getItemName = (itemId) => {
    const items = (settingsData || {}).performanceItems || [];
    const item = items.find(item => item.id === itemId);
    return item ? item.name : itemId;
  };

  const addPerformanceToList = () => {
    // 수준값은 `hasLevel` 로 본다 — **0 은 입력된 값이다** (levelValue.js 참조).
    if (performanceInput.대분류ID && performanceInput.소분류ID && performanceInput.성과항목ID &&
        performanceInput.과제기여도 && performanceInput.단위 &&
        hasLevel(performanceInput.현재수준) && hasLevel(performanceInput.목표수준)) {
      const newPerformance = {
        대분류ID: performanceInput.대분류ID,
        소분류ID: performanceInput.소분류ID,
        성과항목ID: performanceInput.성과항목ID,
        // UUID 저장 (신규 연결 시 사용, 하위 호환을 위해 ID도 유지)
        성과항목UUID: performanceInput.성과항목UUID || '',
        // 이름 우선 사용 (PerformanceSection에서 저장된 이름), 없으면 ID로 조회
        대분류: performanceInput.대분류 || getCategoryName(performanceInput.대분류ID),
        소분류: performanceInput.소분류 || getSubcategoryName(performanceInput.소분류ID),
        성과항목: performanceInput.성과항목 || getItemName(performanceInput.성과항목ID),
        과제기여도: performanceInput.과제기여도,
        현재수준: performanceInput.현재수준,
        목표수준: performanceInput.목표수준,
        실적수준: levelText(performanceInput.실적수준),
        단위: performanceInput.단위
      };

      setFormData(prev => ({
        ...prev,
        성과목록: [...prev.성과목록, newPerformance]
      }));

      setPerformanceInput(INITIAL_PERFORMANCE_INPUT);
    }
  };

  const addPersonnelToList = () => {
    if (personnelInput.이름 && personnelInput.부서) {
      const newPersonnel = {
        이름: personnelInput.이름.trim(),
        knoxId: personnelInput.knoxId?.trim() || '',
        부서: personnelInput.부서.trim()
      };

      const isDuplicate = formData.과제참여인력목록.some(person =>
        person.이름 === newPersonnel.이름 && person.부서 === newPersonnel.부서
      );
      
      if (isDuplicate) {
        setAlertDialog({
          isOpen: true,
          message: '이미 등록된 인원입니다.'
        });
        return;
      }
      
      setFormData(prev => {
        const newPersonnelList = [...prev.과제참여인력목록, newPersonnel];
        const departmentSet = new Set(newPersonnelList.map(person => person.부서));
        const newDepartmentList = Array.from(departmentSet);
        
        return {
          ...prev,
          과제참여인력목록: newPersonnelList,
          담당부서목록: newDepartmentList
        };
      });
      
      setPersonnelInput(INITIAL_PERSONNEL_INPUT);
    }
  };

  const removePerformanceFromList = (index) => {
    setFormData(prev => ({
      ...prev,
      성과목록: prev.성과목록.filter((_, i) => i !== index)
    }));
  };

  // 성과 기여도 업데이트 (인라인 편집용)
  const updatePerformanceContribution = (index, newContribution) => {
    setFormData(prev => ({
      ...prev,
      성과목록: prev.성과목록.map((perf, i) =>
        i === index ? { ...perf, 과제기여도: newContribution } : perf
      )
    }));
  };

  const removePersonnelFromList = (index) => {
    setFormData(prev => {
      const newPersonnelList = prev.과제참여인력목록.filter((_, i) => i !== index);
      const departmentSet = new Set(newPersonnelList.map(person => person.부서));
      const newDepartmentList = Array.from(departmentSet);
      
      return {
        ...prev,
        과제참여인력목록: newPersonnelList,
        담당부서목록: newDepartmentList
      };
    });
  };

  const removeDepartmentFromList = (index) => {
    const departmentToRemove = formData.담당부서목록[index];
    
    if (window.confirm(departmentToRemove + ' 부서와 모든 소속 인원을 삭제하시겠습니까?')) {
      setFormData(prev => {
        const newPersonnelList = prev.과제참여인력목록.filter(person => person.부서 !== departmentToRemove);
        const newDepartmentList = prev.담당부서목록.filter((_, i) => i !== index);
        
        return {
          ...prev,
          과제참여인력목록: newPersonnelList,
          담당부서목록: newDepartmentList
        };
      });
    }
  };

  /**
   * form 제출 = **서버 저장**. (2026-08-01 변경 — EditProjectModal 의 같은 주석 참조)
   *
   * 로컬 전용 저장은 '서버에 저장' 일괄 업로드 메뉴가 있을 때만 뜻이 있었는데,
   * 컷오버로 그 메뉴를 내려서 **만든 과제를 서버로 보낼 방법이 없어졌다.**
   * ⚠️ **입력칸에서 Enter** 를 눌러도 이 함수가 불리므로, 버튼이 아니라 여기를 바꾼다.
   */
  const handleSubmit = (e) => {
    e.preventDefault();
    handleSubmitAndUploadClick();
  };

  // 과제 추가 후 서버 바로 업로드
  const handleSubmitAndUploadClick = async () => {
    const validationErrors = validateForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      focusFirstErrorTab(validationErrors);
      return;
    }

    // 기존 프로젝트 목록을 전달하여 올바른 ID 생성
    const newProject = processFormData(formData, currentYear, existingProjects);

    // 대기 중인 파일 정보를 프로젝트에 포함
    newProject.pendingFiles = pendingFiles;

    /*
      DX KPI 연결. 과제가 만들어진 **뒤에** 별도 API 로 걸린다
      (`createProjectFlowV2` — 과제가 있어야 연결을 건다).
      ⚠️ 빈 배열도 보내지 않는다. 아무것도 안 골랐으면 키 자체를 안 만들어
         쓸데없는 왕복과 row_version 증가를 없앤다.
    */
    if (Array.isArray(kpiLinks) && kpiLinks.length > 0) {
      newProject.DX_KPI연결 = kpiLinks;
    }

    console.log('New project data (with server upload):', newProject);

    if (onSubmitAndUpload) {
      try {
        await onSubmitAndUpload(newProject);
        handleClose();
      } catch (error) {
        showError(saveErrorMessage(error, '과제 추가 및 서버 업로드 중 오류가 발생했습니다'));
      }
    } else {
      onSubmit(newProject);
      handleClose();
    }
  };

  const handleClose = () => {
    resetFormData(setFormData, setPerformanceInput, setErrors);
    setPersonnelInput(INITIAL_PERSONNEL_INPUT);
    setPendingFiles([]);
    // 다음에 열 때 지난 선택이 남아 있으면 안 된다. 사업부 비교 기준도 같이 지운다.
    setKpiLinks(null);
    prevDivisionRef.current = null;
    setActiveTab('basic');
    onClose();
  };

  const showError = (message) => {
    setAlertDialog({
      isOpen: true,
      variant: 'error',
      message: message
    });
  };

  const showSuccess = (message) => {
    setAlertDialog({
      isOpen: true,
      message: message
    });
  };

  // 새 성과 추가 모달 열기
  const handleOpenAddPerformanceModal = () => {
    setPerformanceToEdit(null); // 새 성과 추가 시에는 편집 대상 없음
    setIsAddPerformanceModalOpen(true);
  };

  // 성과 수정 모달 열기 (등록된 성과의 수정 버튼에서 호출)
  const handleEditPerformanceInModal = (performance) => {
    setPerformanceToEdit(performance); // 수정할 성과 정보 설정
    setIsAddPerformanceModalOpen(true);
  };

  /**
   * 과제의 성과목록(연결 행)에 박혀 있는 **정의값 사본**을 갱신한다.
   * (EditProjectModal 과 같은 건 — 사연은 그쪽 주석 참조, 2026-08-07)
   *
   * ⚠️ 과제별 값은 `과제기여도` 하나뿐이다 — 그것만 지킨다.
   *    `실적수준`·`월별실적` 은 **반드시 같이 갱신한다.** 저장할 때 `toLinkItems()` 가
   *    이 행의 값을 그대로 서버로 보내므로, 안 맞추면 성과 수정이 과제 저장으로
   *    되돌아간다. `대분류ID`·`소분류ID` 는 안 건드린다.
   */
  const syncLinkedPerformanceRows = (perf, searchId) => {
    const matches = (row) => (
      (row.성과UUID && perf.uuid && row.성과UUID === perf.uuid)
      || (row.성과항목UUID && perf.uuid && row.성과항목UUID === perf.uuid)
      || (row.성과항목ID && row.성과항목ID === searchId)
    );
    setFormData(prev => ({
      ...prev,
      성과목록: (prev.성과목록 || []).map(row => (matches(row) ? {
        ...row,
        성과항목ID: perf.id ?? row.성과항목ID,
        성과UUID: perf.uuid ?? row.성과UUID,
        성과항목: perf.성과항목,
        대분류: perf.대분류,
        소분류: perf.소분류,
        단위: perf.단위 || '',
        현재수준: levelText(perf.현재수준),
        목표수준: levelText(perf.목표수준),
        실적수준: levelText(perf.실적수준),
        월별실적여부: perf.월별실적여부 || false,
        월별실적: perf.월별실적 || row.월별실적 || Array(12).fill(''),
        // 과제기여도는 **일부러 없다** — row 의 값이 그대로 남는다 (위 ⚠️ 참조)
      } : row)),
    }));
  };

  /**
   * 성과 편집 결과를 **이 모달 안에만** 반영한다 (서버 저장과는 분리).
   * 서버 저장은 `handlePerformanceSubmitAndUpload` 가 부모 핸들러로 처리한다.
   */
  const applyPerformanceLocally = (newPerformance) => {
    // 수정 모드인지 확인
    if (newPerformance.isEditing) {
      // 기존 성과 수정.
      // ⚠️ ID 가 바뀐 수정이면 목록에는 **옛 ID** 로 들어 있다. 새 ID 로 찾으면
      //    아무것도 안 맞아 목록이 조용히 안 바뀐다.
      const searchId = newPerformance._idChanged?.oldId ?? newPerformance.id;
      setLocalPerformances(prev =>
        prev.map(perf => (
          (perf.uuid && newPerformance.uuid && perf.uuid === newPerformance.uuid)
          || perf.id === searchId
            ? { ...perf, ...newPerformance }
            : perf
        ))
      );
      syncLinkedPerformanceRows(newPerformance, searchId);
    } else {
      // 새 성과 추가
      setLocalPerformances(prev => [...prev, newPerformance]);

      // 새로 생성된 성과를 현재 과제의 성과 목록에 자동 연결
      const linkedPerformance = {
        대분류ID: newPerformance.id, // UUID 기반 고유 ID (perf-xxxxxxxx)
        소분류ID: newPerformance.id,
        성과항목ID: newPerformance.id, // "여러 데이터 한번에 추가"에서 이 ID로 연결
        성과UUID: newPerformance.uuid, // 전체 UUID (백엔드용)
        대분류: newPerformance.대분류,
        소분류: newPerformance.소분류,
        성과항목: newPerformance.성과항목,
        과제기여도: '100', // 기본값 100%
        현재수준: levelText(newPerformance.현재수준),
        목표수준: levelText(newPerformance.목표수준),
        실적수준: levelText(newPerformance.실적수준),
        단위: newPerformance.단위 || '',
        월별실적여부: newPerformance.월별실적여부 || false,
        월별실적: newPerformance.월별실적 || Array(12).fill('')
      };

      setFormData(prev => ({
        ...prev,
        성과목록: [...prev.성과목록, linkedPerformance]
      }));
    }
  };

  /** 서버 저장 경로가 없을 때만 쓰는 예비 경로 — 로컬 상태만 만진다. */
  const handlePerformanceSubmit = (newPerformance) => {
    applyPerformanceLocally(newPerformance);
    // 부모 컴포넌트에도 전달 (글로벌 성과 목록 업데이트)
    if (onSubmitPerformance) {
      onSubmitPerformance(newPerformance);
    }
  };

  /**
   * 성과 편집을 **서버에 저장**한다 (2026-08-07 버그 수정 — EditProjectModal 과 같은 건).
   *
   * 이 모달이 `onSubmitAndUpload` 를 안 넘겨서, 여기서 만든/고친 성과가 로컬에만
   * 남고 모달을 닫으면 사라졌다. 서버가 먼저다 — 실패하면 로컬도 안 건드린다.
   * (부모 핸들러가 전역 목록까지 갱신하므로 `onSubmitPerformance` 는 안 부른다.
   *  둘 다 부르면 새 성과가 두 번 들어간다)
   */
  const handlePerformanceSubmitAndUpload = async (newPerformance) => {
    await onSubmitPerformanceAndUpload(newPerformance);
    applyPerformanceLocally(newPerformance);
  };

  // 성과 삭제 처리
  const handlePerformanceDelete = (performanceId) => {
    if (performanceId === 'ALL') {
      setLocalPerformances([]);
    } else {
      setLocalPerformances(prev => prev.filter(perf => perf.id !== performanceId));
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <ModalLayout
        key="add-project-modal"
        handleClose={handleClose}
        currentYear={currentYear}
        formYear={formData.과제년도}
        handleSubmit={handleSubmit}
        handleSubmitAndUpload={onSubmitAndUpload ? handleSubmitAndUploadClick : null}
        isEditMode={false}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabs={[
          {
            key: 'basic',
            label: '기본정보 / 담당정보',
            icon: <ClipboardList size={15} />,
            errorCount: countTabErrors(errors, 'basic'),
            content: (
              <HorizontalSectionsContainer>
                <BasicInfoSection
                  formData={formData}
                  handleInputChange={handleInputChange}
                  errors={errors}
                  divisionOptions={divisionOptions}
                  processOptions={processOptions}
                  domainOptions={domainOptions}
                  categoryOptions={categoryOptions}
                  statusOptions={statusOptions}
                  monthOptions={monthOptions}
                  showError={showError}
                />
                <ResponsibleInfoSection
                  formData={formData}
                  handleInputChange={handleInputChange}
                  errors={errors}
                  personnelInput={personnelInput}
                  handlePersonnelInputChange={handlePersonnelInputChange}
                  addPersonnelToList={addPersonnelToList}
                  removePersonnelFromList={removePersonnelFromList}
                  removeDepartmentFromList={removeDepartmentFromList}
                  settingsData={settingsData}
                  searchUsers={(q) => authApi.searchUsers(q)}
                />
              </HorizontalSectionsContainer>
            ),
          },
          {
            key: 'kpi',
            label: 'DX KPI 연결',
            icon: <Link2 size={15} />,
            // 편집창과 달리 **늘 0 에서 시작한다.** 그래서 이 배지는 "몇 개 걸려
            // 있나" 가 아니라 "지금 몇 개 골랐나" 를 알린다.
            count: Array.isArray(kpiLinks) ? kpiLinks.length : 0,
            content: (
              /*
                ⚠️ 편집창과 **같은 컴포넌트**다. 다른 것은 uuid 대신 사업부를 넘긴다는
                   것뿐 — 규칙(대상 사업부·기능조직 판정)이 두 벌이 되면 "추가창에서
                   고를 수 있던 것이 편집창에선 없다" 가 난다.
                ⚠️ 사업부를 **폼에서** 읽는다. 아직 저장된 과제가 없으니 서버는 모른다.
              */
              <KpiLinkSection
                division={formData.사업부 || null}
                settingsData={settingsData}
                value={kpiLinks}
                // ★ 기준선은 서버 응답만 정한다(편집창과 같은 규칙). 신규창에서는
                //   그 응답이 늘 빈 배열이라, 사용자의 클릭을 덮어쓰지 않게만 한다.
                onLoaded={(serverItems) => {
                  setKpiLinks((cur) => (cur == null ? serverItems : cur));
                }}
                onChange={setKpiLinks}
              />
            ),
          },
          {
            key: 'performance',
            label: '과제 성과',
            icon: <BarChart3 size={15} />,
            count: (formData.성과목록 || []).length,
            errorCount: countTabErrors(errors, 'performance'),
            content: (
              <PerformanceSection
                performanceInput={performanceInput}
                handlePerformanceInputChange={handlePerformanceInputChange}
                addPerformanceToList={addPerformanceToList}
                formData={formData}
                removePerformanceFromList={removePerformanceFromList}
                onUpdatePerformanceContribution={updatePerformanceContribution}
                errors={errors}
                UNIT_OPTIONS={UNIT_OPTIONS}
                SUBCATEGORY_OPTIONS={SUBCATEGORY_OPTIONS}
                settingsData={settingsData}
                globalPerformances={localPerformances}
                onOpenAddPerformanceModal={handleOpenAddPerformanceModal}
                onEditPerformanceInModal={handleEditPerformanceInModal}
              />
            ),
          },
          {
            key: 'actions',
            label: '액션아이템',
            icon: <CheckSquare size={15} />,
            count: (formData.액션아이템목록 || []).length,
            content: (
              <ActionItemsSection
                formData={formData}
                handleInputChange={handleInputChange}
              />
            ),
          },
          {
            key: 'etc',
            label: '기타',
            icon: <MoreHorizontal size={15} />,
            count: pendingFiles.length,
            content: (
              <>
                <AttachmentSection
                  projectId={null}
                  attachments={[]}
                  pendingFiles={pendingFiles}
                  onPendingFilesChange={setPendingFiles}
                  isEditMode={false}
                />
                <RemarksSection
                  formData={formData}
                  handleInputChange={handleInputChange}
                />
              </>
            ),
          },
        ]}
      />

      {/* 알림 다이얼로그 */}
      {alertDialog.isOpen && (
        <AlertDialog
          key="alert-dialog"
          isOpen={alertDialog.isOpen}
          onClose={() => setAlertDialog({ isOpen: false, message: '' })}
          title="알림"
          message={alertDialog.message}
          variant={alertDialog.variant || 'error'}
        />
      )}

      {/* 새 성과 추가 모달 */}
      <AddPerformanceModal
        isOpen={isAddPerformanceModalOpen}
        onClose={() => {
          setIsAddPerformanceModalOpen(false);
          setPerformanceToEdit(null); // 모달 닫을 때 편집 대상 초기화
        }}
        onSubmit={handlePerformanceSubmit}
        // ⚠️ onSubmitAndUpload 를 빼면 성과 편집이 **로컬에만** 남는다.
        //    AddPerformanceModal 은 이게 없으면 onSubmit(로컬 전용)으로 떨어지고,
        //    그러면서도 "수정되었습니다" 라고 말한다. (2026-08-07 이 버그를 고쳤다)
        onSubmitAndUpload={onSubmitPerformanceAndUpload ? handlePerformanceSubmitAndUpload : undefined}
        onDelete={handlePerformanceDelete}
        settingsData={settingsData}
        globalPerformances={localPerformances}
        showSuccess={showSuccess}
        showError={showError}
        initialPerformanceToEdit={performanceToEdit}
      />
    </AnimatePresence>
  );
};

export default AddProjectModal;