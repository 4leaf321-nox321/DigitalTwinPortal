import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  FileText, ClipboardList, BarChart3, CheckSquare, AlertCircle, MoreHorizontal, History, Link2,
} from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';

import { settingsData } from '../../data/sampleData';
// 충돌(409)은 고장이 아니라 정상 결과다 — 문구 규칙은 어댑터 한 곳에 둔다.
import { saveErrorMessage } from '../../services/dashboardWriteApi';
// 수준값의 0 과 미입력은 다른 뜻이다. `|| ''` 로 다루면 0 이 사라진다.
import { hasLevel, levelText } from '../../utils/levelValue';
import { compareProjects } from '../../utils/divisionOrder';

import ModalLayout, { HorizontalSectionsContainer } from './components/ModalLayout';
import AiFillPanel from './components/AiFillPanel';
import BasicInfoSection from './components/BasicInfoSection';
import ResponsibleInfoSection from './components/ResponsibleInfoSection';
import PerformanceSection from './components/PerformanceSection';
import RemarksSection from './components/RemarksSection';
import AttachmentSection from './components/AttachmentSection';
import ActionItemsSection from './components/ActionItemsSection';
import IssuesSection from './components/IssuesSection';
import PredecessorSection from './components/PredecessorSection';
import ChangeHistorySection from './components/ChangeHistorySection';
import KpiLinkSection from './components/KpiLinkSection';
import AlertDialog from '../common/AlertDialog';
import AddPerformanceModal from '../PerformanceModal/AddPerformanceModal';
import { fetchProjectAttachments } from '../../services/settingsApi';
import { authApi } from '../../../auth/services/authApi';

import {
  UNIT_OPTIONS,
  SUBCATEGORY_OPTIONS,
  INITIAL_PERFORMANCE_INPUT,
  INITIAL_PERSONNEL_INPUT,
  firstErrorTab,
  countTabErrors,
} from './constants/formConstants';

import {
  validateForm,
  processFormData,
  validatePerformanceInput,
  validateNumericInput,
  countDetailLines
} from './utils/formUtils';

const EditProjectModal =({ isOpen, onClose, onSubmit, onSubmitAndUpload, onSaveAsNew, project, currentYear, settingsData, globalPerformances = [], onSubmitPerformance, onSubmitPerformanceAndUpload, allProjects = [], onNavigate, autoOpenDetailInfo = false, initialTab = null }) => {
  const { isAdmin, user } = useAuth();
  const canExportReport = user && user.role !== 'viewer';

  const [formData, setFormData] = useState({
    사업부: '',
    프로세스: '',
    과제영역: '',
    과제구분: '',
    과제명: '',
    성과목록: [],
    시작: 1,
    종료: 12,
    진행상태: '미착수',
    진행률: 0,
    과제참여인력목록: [],
    담당부서목록: [],
    과제PL: '',
    작성자: '',
    // 계정 연결용 knoxId. 이름과 짝이지만 뜻이 다르다 — 과제PL_knoxId 는
    // 서버에서 편집 권한의 근거가 된다(is_project_pl).
    과제PL_knoxId: '',
    작성자_knoxId: '',
    과제상세설명: '',
    액션아이템목록: [],
    이슈목록: [],
    선행과제목록: [],
    PoC과제여부: false,
    중점과제여부: false,
    사업부내공개여부: false,
    담당부서: '',
    과제참여인력: '',
    과제년도: currentYear || 2025
  });
  
  const [performanceInput, setPerformanceInput] = useState(INITIAL_PERFORMANCE_INPUT);
  const [personnelInput, setPersonnelInput] = useState(INITIAL_PERSONNEL_INPUT);
  const [errors, setErrors] = useState({});

  // 탭 (과제 편집창 구조 개선)
  const [activeTab, setActiveTab] = useState('basic');

  /**
   * 첫 탭으로 되돌리는 것은 **모달을 새로 열 때만** 한다.
   *
   * 예전엔 `project` 가 바뀔 때마다 되돌렸는데, 그러면 **이전/다음 과제로 넘길 때도**
   * 탭이 초기화된다. 여러 과제의 같은 항목(변경 이력·이슈 등)을 훑어보려면 넘길 때마다
   * 탭을 다시 골라야 했다. 과제 이동은 `project` 만 바뀌므로 보던 탭이 유지된다.
   */
  const wasOpen = useRef(false);
  useEffect(() => {
    // `initialTab` — 「내 업무」에서 넘어올 때 그 항목이 있는 탭으로 바로 연다
    //   (액션아이템 줄 → 액션아이템 탭, 이슈 줄 → 이슈 탭).
    //   ⚠️ **모달을 새로 열 때만** 쓴다. 이전/다음 과제로 넘길 때는 보던 탭을
    //      그대로 둔다 — 여러 과제의 같은 항목을 훑는 것이 그 기능의 목적이다.
    if (isOpen && !wasOpen.current) setActiveTab(initialTab || 'basic');
    wasOpen.current = isOpen;
  }, [isOpen]);   // eslint-disable-line react-hooks/exhaustive-deps

  /** 검증 실패 시 오류가 있는 첫 탭으로 이동 (숨은 탭의 오류를 놓치지 않게) */
  const focusFirstErrorTab = (validationErrors) => {
    const target = firstErrorTab(validationErrors);
    if (target) setActiveTab(target);
  };

  // 첨부파일 상태
  const [attachments, setAttachments] = useState([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);

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

  // ── DX KPI 연결 ───────────────────────────────────────────────────────────
  // `null` = 아직 서버에서 안 불러옴. KpiLinkSection 이 채운다.
  // `kpiLinksBase` 는 불러온 직후의 값 — **바뀌었을 때만 저장에 실으려고** 들고 있다.
  // 매번 보내면 아무것도 안 고친 저장에서도 row_version 이 올라가고 왕복이 하나 는다.
  const [kpiLinks, setKpiLinks] = useState(null);
  const [kpiLinksBase, setKpiLinksBase] = useState(null);

  /**
   * 저장에 실을 값. 안 바뀌었으면 undefined 를 돌려 어댑터가 건너뛰게 한다.
   *
   * 연결의 단위는 **(지표, 대상 사업부)** 다 — 대상까지 비교하지 않으면
   * "GTR 과제의 지원 대상을 MX 에서 VD 로 바꾼" 변경이 '안 바뀜' 으로 판정된다.
   */
  const kpiLinksIfChanged = () => {
    if (kpiLinks == null || kpiLinksBase == null) return undefined;
    const norm = (list) => JSON.stringify(
      [...list]
        .map((x) => ({
          id: x.kpiDefinitionId,
          target: x.targetDivision || '',
          note: (x.note || '').trim(),
        }))
        .sort((a, b) => (a.id - b.id) || a.target.localeCompare(b.target))
    );
    return norm(kpiLinks) === norm(kpiLinksBase) ? undefined : kpiLinks;
  };

  // 보고서 템플릿 모달 상태
  const [isReportTemplateModalOpen, setIsReportTemplateModalOpen] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';

      // 로컬 성과 목록 초기화
      setLocalPerformances(globalPerformances);

      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isOpen, globalPerformances]);

  // 모달 열릴 때 템플릿 목록 로드
  useEffect(() => {
    if (!isOpen || !canExportReport) return;
    const fetchTemplates = async () => {
      try {
        const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const accessToken = localStorage.getItem('accessToken');
        const res = await fetch(`${API_BASE_URL}/digital-twin-dashboard/report/templates`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (res.ok) {
          const json = await res.json();
          const list = json.data || [];
          setTemplates(list);
          if (list.length > 0) setSelectedTemplate(list[0].filename);
        }
      } catch (err) {
        console.error('템플릿 목록 조회 실패:', err);
      }
    };
    fetchTemplates();
  }, [isOpen, canExportReport]);

  // 프로젝트가 변경되면 첨부파일 로드
  useEffect(() => {
    const loadAttachments = async () => {
      if (project && (project.uuid || project.id)) {
        setAttachmentsLoading(true);
        try {
          const projectId = project.uuid || project.id;
          const data = await fetchProjectAttachments(projectId);
          setAttachments(data || []);
        } catch (error) {
          console.error('첨부파일 로드 실패:', error);
          setAttachments([]);
        } finally {
          setAttachmentsLoading(false);
        }
      } else {
        setAttachments([]);
      }
    };

    if (isOpen && project) {
      loadAttachments();
    }
  }, [isOpen, project]);

  useEffect(() => {
    if (project) {
      let 과제참여인력목록 = [];
      let 담당부서목록 = [];
      
      if (project.과제참여인력목록 && Array.isArray(project.과제참여인력목록)) {
        과제참여인력목록 = project.과제참여인력목록;
        담당부서목록 = project.담당부서목록 || [];
      } else if (project.teamMembers && Array.isArray(project.teamMembers)) {
        과제참여인력목록 = project.teamMembers.map(member => ({
          이름: member.name,
          부서: member.department
        }));
        담당부서목록 = project.departments || [];
      } else {
        if (project.assignees && Array.isArray(project.assignees)) {
          const depts = project.department && Array.isArray(project.department) 
            ? project.department 
            : (project.department ? project.department.split(',').map(d => d.trim()) : []);
          
          과제참여인력목록 = project.assignees.map((name, index) => ({
            이름: name.trim(),
            부서: depts[Math.min(index, depts.length - 1)] || 'Unassigned'
          }));
          
          담당부서목록 = [...new Set(과제참여인력목록.map(p => p.부서))];
        } else if (project.personnel || project.과제참여인력) {
          const names = (project.personnel || project.과제참여인력).split(',').map(n => n.trim());
          const depts = project.department || project.담당부서
            ? (Array.isArray(project.department) 
              ? project.department 
              : (project.department || project.담당부서).split(',').map(d => d.trim()))
            : [];
          
          과제참여인력목록 = names.map((name, index) => ({
            이름: name,
            부서: depts[Math.min(index, depts.length - 1)] || 'Unassigned'
          }));
          
          담당부서목록 = [...new Set(과제참여인력목록.map(p => p.부서))];
        }
      }

      let 성과목록 = [];
      if (project.성과목록 && Array.isArray(project.성과목록) && project.성과목록.length > 0) {
        성과목록 = project.성과목록;
      } else if (project.performanceList && Array.isArray(project.performanceList)) {
        성과목록 = project.performanceList;
      }
      
      let 액션아이템목록 = [];
      if (project.액션아이템목록 && Array.isArray(project.액션아이템목록)) {
        액션아이템목록 = project.액션아이템목록;
      } else if (project.actionItems && Array.isArray(project.actionItems)) {
        액션아이템목록 = project.actionItems;
      }
      
      setFormData({
        사업부: project.사업부 || project.businessDivision || '',
        프로세스: project.프로세스 || project.process || project.division || '',
        과제영역: project.과제영역 || '',
        과제구분: project.과제구분 || project.taskCategory || '',
        과제명: project.과제명 || project.taskName || '',
        성과목록: 성과목록,
        시작: project.시작 || project.start || 1,
        종료: project.종료 || project.end || 12,
        진행상태: project.진행상태 || project.status || '미착수',
        // `|| 0` 이면 **미입력과 0 이 둘 다 0** 이 된다 — 편집창을 열어 다른 항목만
        // 고쳐 저장해도 미입력 과제가 0% 로 확정됐다. `??` 로 둘을 갈라 둔다.
        // 미입력은 빈 문자열로 들고 있다가 저장 때 null 로 나간다(formUtils).
        진행률: project.진행률 ?? project.progress ?? '',
        과제참여인력목록: 과제참여인력목록,
        담당부서목록: 담당부서목록,
        과제PL: project.과제PL || project.manager || project.projectLeader || '',
        작성자: project.작성자 || project.author || '',
        과제PL_knoxId: project.과제PL_knoxId || '',
        작성자_knoxId: project.작성자_knoxId || '',
        과제상세설명: project.과제상세설명 || project.비고 || project.notes || '',
        액션아이템목록: 액션아이템목록,
        이슈목록: project.이슈목록 || [],
        선행과제목록: project.선행과제목록 || [],
        PoC과제여부: project.PoC과제여부 || project.isPoCTask || false,
        중점과제여부: project.중점과제여부 || project.isKeyTask || false,
        사업부내공개여부: project.사업부내공개여부 || false,
        _canceledAt: project._canceledAt || '', // 취소 전환 시각(관리자 수정 가능)
        담당부서: Array.isArray(project.department)
          ? project.department.join(', ')
          : project.department || project.담당부서 || '',
        과제참여인력: Array.isArray(project.assignees)
          ? project.assignees.join(', ')
          : project.assignees || project.personnel || project.과제참여인력 || '',
        과제년도: project.과제년도 || currentYear || 2025,
        createdAt: project.createdAt || null,
        // 상세 과제 정보 복원
        상세정보_과제개요: project.상세정보_과제개요 || null,
        상세정보_추진배경: project.상세정보_추진배경 || null,
        상세정보_과제목표: project.상세정보_과제목표 || null,
        상세정보_상세내용: project.상세정보_상세내용 || null,
        상세정보_성과: project.상세정보_성과 || null,
        상세정보_산출물: project.상세정보_산출물 || null,
        상세정보_향후계획: project.상세정보_향후계획 || null,
        // 독립 이미지 (좌측/우측)
        이미지_좌측: project.이미지_좌측 || [],
        이미지_우측: project.이미지_우측 || [],
        이미지_개요그림: project.이미지_개요그림 || [],
        이미지_상세내용그림: project.이미지_상세내용그림 || [],
        이미지_향후계획그림: project.이미지_향후계획그림 || [],
        이미지_그룹1_카테고리: project.이미지_그룹1_카테고리 || '개요그림',
        이미지_그룹2_카테고리: project.이미지_그룹2_카테고리 || '상세내용그림',
        // 상세 정보 입력 완료 여부
        상세정보_입력완료: project.상세정보_입력완료 || false,
        // 월간 진척 현황 요약
        월간진척현황: project.월간진척현황 || {},
      });

      // 탭은 **일부러 건드리지 않는다** — 이전/다음 과제로 넘겨도 보던 탭을 유지한다.
      // (첫 탭으로 되돌리는 것은 모달을 새로 열 때뿐 — 위 wasOpen 이펙트)
      setErrors({});

      // ⚠️ DX KPI 연결은 **반드시** 여기서 비운다. 안 비우면 이전/다음 과제로 넘길 때
      //    앞 과제의 선택이 그대로 남고, 그 상태로 저장하면 **남의 과제 연결이
      //    이 과제에 붙는다.** (KpiLinkSection 은 value 가 null 일 때만 서버 값을 채운다)
      setKpiLinks(null);
      setKpiLinksBase(null);

      // ⚠️ AI 표식도 반드시 비운다. 안 비우면 이전/다음 과제로 넘겼을 때 앞 과제에서
      //    채운 칸 이름이 남아, **남의 과제 변경 이력에 AI 표식이 붙는다.**
      //    (KPI 연결을 여기서 비우는 것과 같은 이유다)
      setAiFilledKeys([]);
    }
  }, [project]);

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

  /**
   * AI 가 채워 준 칸 이름. **변경 이력에 남길 표식**이고 과제 데이터가 아니다.
   *
   * 왜 필요한가
   *     이 저장은 사람이 누르는 것이라 이력에 `source='ui'` 로 남는다. 텍스트 두 칸일
   *     때는 감수할 만했지만, 상세정보처럼 **보고서에 그대로 실리는 문구**까지 AI 가
   *     채우기 시작하면 "이 문장을 누가 썼나" 에 답할 수 없게 된다.
   *     그래서 채운 칸만 `source='ai_fill'` 로 갈라 남긴다.
   *
   * ⚠️ 지우지 않는다 — 사람이 그 칸을 다시 고쳐도 **AI 가 만든 초안에서 출발한 것**은
   *    사실이다. 대신 저장 어댑터가 **이번 저장에 실제로 실린 칸만** 골라 보낸다
   *    (되돌려서 값이 안 바뀐 칸은 애초에 patch 에 없다).
   * ⚠️ 과제를 이전/다음으로 넘기면 비운다. 남기면 **남의 과제 이력에 AI 표식**이 붙는다.
   */
  const [aiFilledKeys, setAiFilledKeys] = useState([]);

  const markAiFilled = (keys) => {
    setAiFilledKeys(prev => Array.from(new Set([...prev, ...keys])));
  };

  /**
   * AI 가 만든 값을 폼에 넣는다 (AiFillPanel).
   *
   * **저장하지 않는다.** 값이 폼에 들어갈 뿐이고, 저장은 평소의 저장 버튼이 한다 —
   * 그래서 권한·낙관적 락·변경 이력이 평소와 똑같이 걸린다. 무엇이 바뀌는지는
   * 패널이 적용 전에 before → after 로 보여준다(그 화면이 유일한 관문이다).
   *
   * 값을 넣은 칸의 오류 표시는 지운다 — 비어서 났던 오류가 그대로 남아 있으면
   * 사용자는 아직 안 채운 줄 안다.
   */
  const handleAiFill = (patch) => {
    if (!patch || Object.keys(patch).length === 0) return;
    setFormData(prev => ({ ...prev, ...patch }));
    setErrors(prev => {
      const next = { ...prev };
      Object.keys(patch).forEach(key => { delete next[key]; });
      return next;
    });
    markAiFilled(Object.keys(patch));
  };

  const handlePerformanceInputChange = (field, value) => {
    setPerformanceInput(prev => ({
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

  /**
   * AI 가 찾고 **사람이 고른** 참여인력을 목록에 더한다 (AiPeopleModal).
   *
   * 손으로 넣는 `addPersonnelToList` 와 같은 규칙을 따른다 —
   * (이름+부서) 중복 제외, `담당부서목록` 다시 만들기.
   *
   * ⚠️ **knoxId 가 있는 사람만 들어온다.** 모달이 계정을 고른 줄만 넘기고, 서버도
   *    knoxId 없는 참여인력을 400 으로 막는다. 여기서 이름만으로 넣으면 저장에서
   *    막히거나(400) 화면에 '연결 안 됨' 으로 남는다.
   */
  const handleAddPeopleFromAi = (rows) => {
    const incoming = (rows || []).filter(r => r && r.이름 && r.knoxId);
    if (incoming.length === 0) return;

    setFormData(prev => {
      const list = [...(prev.과제참여인력목록 || [])];
      incoming.forEach(person => {
        const dup = list.some(x =>
          (x.knoxId && x.knoxId === person.knoxId)
          || (x.이름 === person.이름 && x.부서 === person.부서));
        if (!dup) list.push({ 이름: person.이름, knoxId: person.knoxId, 부서: person.부서 || '' });
      });
      return {
        ...prev,
        과제참여인력목록: list,
        담당부서목록: Array.from(new Set(list.map(x => x.부서).filter(Boolean))),
      };
    });

    // 변경 이력에 AI 표식을 남긴다. **담당부서목록은 여기서 파생된 값**이라 빼둔다 —
    // 사람이 부서를 직접 고친 것과 구분이 안 되기 때문이다.
    markAiFilled(['과제참여인력목록']);
  };

  const handlePersonnelInputChange = (field, value) => {
    setPersonnelInput(prev => ({
      ...prev,
      [field]: value
    }));
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
   * form 제출 = **서버 저장**. (2026-08-01 변경)
   *
   * 예전에는 `onSubmit`(로컬 전용)을 불렀고, 서버 저장은 옆의 '및 서버 업로드' 버튼이
   * 따로 했다. 로컬 전용 경로는 "여러 건 모아뒀다가 '서버에 저장' 메뉴로 일괄 업로드"
   * 하는 워크플로를 위한 것이었는데, **컷오버로 그 메뉴를 내려서 회수 경로가 사라졌다.**
   * 그대로 두면 저장을 누르고 성공 메시지를 본 뒤 새로고침하면 조용히 사라진다.
   *
   * ⚠️ 버튼만 바꾸면 안 된다 — **입력칸에서 Enter** 를 누르면 이 함수가 불린다.
   *    그래서 버튼이 아니라 **여기**를 서버 경로로 돌린다.
   */
  const handleSubmit = (e) => {
    e.preventDefault();
    handleSubmitAndUploadClick();
  };

  /**
   * 저장에 보낼 과제 객체. **세 저장 경로가 같은 것을 보내야 한다** —
   * 따로 만들면 어느 하나에만 필드가 빠지고, 그건 눈에 안 띈다.
   */
  const buildUpdatedProject = () => {
    const taskYear = currentYear || project.과제년도 || 2025;
    const processedData = processFormData(formData, taskYear, [], project.id);
    return {
      ...project,
      ...processedData,
      id: project.id,
      // 바뀌었을 때만 실린다. 앱 핸들러가 꺼내 쓰고 **곧바로 지운다** —
      // 과제 데이터가 아니므로 목록·localStorage 에 남으면 안 된다.
      __dtKpiLinks: kpiLinksIfChanged(),
      // AI 가 채운 칸 이름. 앱 핸들러가 꺼내 쓰고 곧바로 지운다(위와 같은 규칙).
      __dtAiFilled: aiFilledKeys,
    };
  };

  /** 입력값 검사 + 오류가 있으면 그 탭으로 이동. 통과하면 true. */
  const validateOrFocus = () => {
    const validationErrors = validateForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      focusFirstErrorTab(validationErrors);   // 숨은 탭의 오류를 놓치지 않게 이동
      return false;
    }
    return true;
  };

  // 서버 업로드만 (편집창 닫지 않음) - 상세정보 모달에서 사용
  const handleUploadOnly = async () => {
    if (!validateOrFocus()) return;
    if (onSubmitAndUpload) {
      try {
        await onSubmitAndUpload(buildUpdatedProject());
        setKpiLinksBase(kpiLinks);   // 저장됐으니 이제 이게 기준선이다
        showSuccess('서버에 업로드되었습니다.');
      } catch (error) {
        showError('서버 업로드 중 오류가 발생했습니다: ' + error.message);
      }
    }
  };

  /**
   * 저장하고 **창을 열어 둔다** (관리자 전용, 2026-08-07 요청).
   *
   * '변경 저장' 은 저장 후 닫힌다. 그래서 이전/다음 과제로 넘겨 가며 여러 건을
   * 빠르게 고칠 수가 없었다 — 한 건 저장할 때마다 목록에서 다시 찾아 들어가야 했다.
   * 저장 자체는 '변경 저장' 과 **완전히 같은 경로**다(`onSubmitAndUpload`). 닫지만 않는다.
   *
   * ⚠️ **성공 알림을 여기서 띄우지 않는다.** 앱의 `handleUpdateProjectAndUpload` 이
   *    이미 알린다. 게다가 이 모달의 `showSuccess` 는 4초 뒤 사라지는 알림이 아니라
   *    **눌러서 닫아야 하는 AlertDialog** 라, 한 건 저장할 때마다 확인창이 떠서
   *    "빠르게 여러 건" 이라는 목적을 정면으로 방해한다. (앱 쪽은 setNotification)
   *
   * ⚠️ 저장 뒤 `kpiLinksBase` 를 다시 잡는다. 안 잡으면 KPI 연결이 계속
   *    '바뀐 것' 으로 남아, 다음 저장에서 안 바뀐 연결을 또 보낸다.
   *
   * ⚠️ 로컬 전용 `onSubmit` 으로 물러서지 **않는다.** 그 경로는 2026-08-01 에
   *    걷어냈다 — 저장했다고 말해 놓고 새로고침하면 조용히 사라진다.
   *    서버 경로가 없으면 아래에서 버튼 자체를 안 그린다.
   */
  const handleSaveAndStay = async () => {
    if (!validateOrFocus()) return;
    try {
      await onSubmitAndUpload(buildUpdatedProject());
      setKpiLinksBase(kpiLinks);
    } catch (error) {
      showError(saveErrorMessage(error, '저장 중 오류가 발생했습니다'));
    }
  };

  // 과제 편집 후 서버 바로 업로드
  const handleSubmitAndUploadClick = async () => {
    const validationErrors = validateForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      focusFirstErrorTab(validationErrors);   // 숨은 탭의 오류를 놓치지 않게 이동
      return;
    }

    console.log('[EditProjectModal] handleSubmitAndUploadClick 시작');
    console.log('[EditProjectModal] project.id:', project.id);

    // 편집 모드이므로 기존 프로젝트 ID를 전달하여 새 ID 생성 방지
    const taskYear = currentYear || project.과제년도 || 2025;

    const processedData = processFormData(formData, taskYear, [], project.id);

    const updatedProject = {
      ...project,
      ...processedData,
      id: project.id,
      __dtKpiLinks: kpiLinksIfChanged(),
      // AI 가 채운 칸 이름. 앱 핸들러가 꺼내 쓰고 곧바로 지운다(위와 같은 규칙).
      __dtAiFilled: aiFilledKeys,   // 위 handleUploadOnly 와 같은 규칙
    };

    console.log('[EditProjectModal] 서버 업로드용 updatedProject:', updatedProject);

    if (onSubmitAndUpload) {
      try {
        await onSubmitAndUpload(updatedProject);
        handleClose();
      } catch (error) {
        showError(saveErrorMessage(error, '과제 편집 및 서버 업로드 중 오류가 발생했습니다'));
      }
    } else {
      onSubmit(updatedProject);
      handleClose();
    }
  };

  // 다른 이름으로 저장 (현재 입력 내용을 기반으로 새 과제 생성)
  const handleSaveAsNew = async () => {
    const validationErrors = validateForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      focusFirstErrorTab(validationErrors);   // 숨은 탭의 오류를 놓치지 않게 이동
      return;
    }

    console.log('[EditProjectModal] handleSaveAsNew 시작');

    const taskYear = currentYear || project.과제년도 || 2025;

    // 세 번째 인자는 **기존 과제 목록**이고, 코드 생성기가 다음 번호를 정하는 데 쓴다.
    // 2026-08-01 수정 — 여기에 `[]` 를 넘기고 있었다. 그러면 생성기가 "이 사업부의 첫
    // 과제" 로 판단해 **항상 `MX-1` 같은 값**을 만들고, 서버가 409(이미 있는 과제 코드)로
    // 거절한다. 로컬 전용 저장이던 시절엔 아무도 코드를 검사하지 않아 드러나지 않았다.
    // (네 번째 `null` 은 "새 uuid 를 만들라" 는 뜻이라 그대로 둔다)
    const processedData = processFormData(formData, taskYear, allProjects, null);

    // 새 프로젝트 객체 생성 (기존 ID, UUID 제외)
    const newProject = {
      ...processedData,
      // 새로운 생성 시간
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    console.log('[EditProjectModal] 다른 이름으로 저장 - newProject:', newProject);

    if (!onSaveAsNew) {
      showError('다른 이름으로 저장 기능이 지원되지 않습니다.');
      return;
    }

    // 2026-08-01 — 예전엔 `onSaveAsNew(newProject)` 를 **기다리지 않고** 바로 닫았다.
    // 서버가 거절해도(409 등) 던져진 오류를 아무도 받지 않아 **콘솔에만 남고**
    // 사용자는 성공한 줄 안다. 새로고침하면 만든 과제가 사라진다.
    try {
      await onSaveAsNew(newProject);
      handleClose();
    } catch (error) {
      // 실패하면 **닫지 않는다.** 닫아버리면 무엇을 잃었는지 알 수 없다.
      showError(saveErrorMessage(error, '다른 이름으로 저장 중 오류가 발생했습니다'));
    }
  };

  // PPT 보고서 내보내기 - 템플릿 선택 모달 열기
  const handleExportToPPT = () => {
    setIsReportTemplateModalOpen(true);
  };

  // PPT 보고서 다운로드 (관리자 전용) - 백엔드 API 호출
  const handleDownloadReport = async () => {
    setReportLoading(true);
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const accessToken = localStorage.getItem('accessToken');

      // 프로젝트 데이터 준비
      const projectData = {
        id: project?.id,
        과제명: formData.과제명,
        과제년도: formData.과제년도 || currentYear,
        사업부: formData.사업부,
        프로세스: formData.프로세스,
        과제PL: formData.과제PL,
        작성자: formData.작성자,
        과제PL_knoxId: formData.과제PL_knoxId || '',
        작성자_knoxId: formData.작성자_knoxId || '',
        시작: formData.시작,
        종료: formData.종료,
        과제영역: formData.과제영역,
        과제구분: formData.과제구분,
        진행상태: formData.진행상태,
        진행률: formData.진행률,
        PoC과제여부: formData.PoC과제여부,
        중점과제여부: formData.중점과제여부,
        사업부내공개여부: formData.사업부내공개여부,
        과제상세설명: formData.과제상세설명,
        담당부서목록: formData.담당부서목록,
        과제참여인력목록: formData.과제참여인력목록,
        성과목록: formData.성과목록,
        액션아이템목록: formData.액션아이템목록,
        // 상세 과제 정보
        상세정보_과제개요: formData.상세정보_과제개요 || null,
        상세정보_추진배경: formData.상세정보_추진배경 || null,
        상세정보_과제목표: formData.상세정보_과제목표 || null,
        상세정보_상세내용: formData.상세정보_상세내용 || null,
        상세정보_성과: formData.상세정보_성과 || null,
        상세정보_산출물: formData.상세정보_산출물 || null,
        상세정보_향후계획: formData.상세정보_향후계획 || null,
        // 독립 이미지 (좌측/우측)
        이미지_좌측: formData.이미지_좌측 || [],
        이미지_우측: formData.이미지_우측 || [],
        이미지_개요그림: formData.이미지_개요그림 || [],
        이미지_상세내용그림: formData.이미지_상세내용그림 || [],
        이미지_향후계획그림: formData.이미지_향후계획그림 || [],
        이미지_그룹1_카테고리: formData.이미지_그룹1_카테고리 || '개요그림',
        이미지_그룹2_카테고리: formData.이미지_그룹2_카테고리 || '상세내용그림',
        // 상세 정보 입력 완료 여부
        상세정보_입력완료: formData.상세정보_입력완료 || false,
        template: selectedTemplate || undefined
      };

      const response = await fetch(`${API_BASE_URL}/digital-twin-dashboard/report/ppt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(projectData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'PPT 생성 실패');
      }

      // Blob으로 변환 후 다운로드
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Content-Disposition 헤더에서 파일명 추출 (filename* 우선, UTF-8 한글 지원)
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `${formData.과제명 || '과제보고서'}_${formData.과제년도 || currentYear}년_보고서.pptx`;
      if (contentDisposition) {
        const starMatch = contentDisposition.match(/filename\*=UTF-8''([^;\r\n]*)/i);
        if (starMatch && starMatch[1]) {
          filename = decodeURIComponent(starMatch[1]);
        } else {
          const plainMatch = contentDisposition.match(/filename=['"]?([^;\r\n"']*)['"]?/i);
          if (plainMatch && plainMatch[1]) {
            filename = plainMatch[1];
          }
        }
      }

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setIsReportTemplateModalOpen(false);
      showSuccess('보고서가 성공적으로 저장되었습니다.');
    } catch (error) {
      console.error('PPT 내보내기 오류:', error);
      showError('보고서 저장 중 오류가 발생했습니다: ' + error.message);
    } finally {
      setReportLoading(false);
    }
  };

  const handleClose = () => {
    setErrors({});
    setPerformanceInput(INITIAL_PERFORMANCE_INPUT);
    setPersonnelInput(INITIAL_PERSONNEL_INPUT);
    setAttachments([]);
    onClose();
  };

  const showError = (message) => {
    setAlertDialog({
      isOpen: true,
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
   *
   * 왜 필요한가 (2026-08-07 신고)
   *     연결 행은 성과 정의를 가리키기만 하는 게 아니라 그때의 값을 **베껴 들고**
   *     있다(성과항목·대분류·소분류·단위·현재/목표/실적수준·월별실적). 그래서 성과
   *     정의를 고쳐도 과제 화면의 그 줄은 **옛 값 그대로** 보인다. 이름만 예외였는데,
   *     이름은 `getItemName()` 이 매번 정의에서 찾아 쓰기 때문이다(PerformanceSection).
   *
   * ⚠️ 과제별 값은 **`과제기여도` 하나뿐이다** — 그것만 행의 값을 지킨다.
   *    (근거는 PerformanceSection.withLiveDefinition 머리말. 화면에 과제별 실적을
   *     입력하는 칸이 없고, 보고서 화면도 정의를 덮어쓰고 기여도만 지킨다)
   *
   * ⚠️ **`실적수준`·`월별실적` 을 반드시 같이 갱신해야 한다.** 과제를 저장하면
   *    `toLinkItems()` 가 이 행의 `실적` 을 그대로 서버로 보낸다
   *    (dashboardWriteApi.js:441). 여기서 안 맞춰 두면, 성과를 고쳐 서버까지 반영된
   *    값이 **그 과제를 저장하는 순간 옛 값으로 되돌아간다.**
   *
   * ⚠️ `대분류ID`·`소분류ID` 는 건드리지 않는다 — 화면이 그 값으로 이름을 찾는데,
   *    여기서 성과 id 를 넣으면 분류 이름이 `perf-xxxxxxxx` 로 보인다.
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
        // ID 가 바뀐 수정이면 연결도 새 ID 를 가리켜야 한다
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
   *
   * 서버 저장은 `handlePerformanceSubmitAndUpload` 가 부모 핸들러로 처리한다.
   * 둘을 한 함수에 두면 "로컬만 갱신하고 저장했다고 말하는" 예전 버그가 돌아온다.
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
        대분류ID: newPerformance.id,
        소분류ID: newPerformance.id,
        성과항목ID: newPerformance.id,
        성과UUID: newPerformance.uuid,
        대분류: newPerformance.대분류,
        소분류: newPerformance.소분류,
        성과항목: newPerformance.성과항목,
        과제기여도: '100',
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

  /**
   * 서버 저장 경로가 없을 때만 쓰는 예비 경로 — 로컬 상태만 만진다.
   * (부모가 `onSubmitPerformanceAndUpload` 를 주면 아래 경로가 대신 불린다)
   */
  const handlePerformanceSubmit = (newPerformance) => {
    applyPerformanceLocally(newPerformance);
    // 부모 컴포넌트에도 전달 (글로벌 성과 목록 업데이트)
    if (onSubmitPerformance) {
      onSubmitPerformance(newPerformance);
    }
  };

  /**
   * 성과 편집을 **서버에 저장**한다 (2026-08-07 버그 수정).
   *
   * 버그: 과제 편집 → 과제성과 → 등록된 성과의 연필 버튼으로 고치면 화면은
   *      "성과 항목이 수정되었습니다" 라고 하는데 **서버에는 아무것도 안 갔다.**
   *      AddPerformanceModal 은 `onSubmitAndUpload` 가 있으면 서버로, 없으면
   *      `onSubmit`(로컬 전용)으로 떨어지는데, 이 모달이 `onSubmitAndUpload` 를
   *      안 넘기고 있었다. 대시보드의 성과 화면은 넘기고 있어서 거기서만 됐다.
   *      로컬 상태는 모달을 닫으면 사라지므로 고친 내용이 통째로 증발했다.
   *
   * 서버가 먼저다 — 실패하면 로컬도 안 건드려야 화면과 서버가 안 갈린다.
   * (부모 핸들러가 전역 성과 목록까지 갱신하므로 `onSubmitPerformance` 는 부르지
   *  않는다. 둘 다 부르면 새 성과가 두 번 들어간다.)
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

  // 이전/다음 과제 네비게이션 (당해년도 과제만 대상)
  const navYear = project?.과제년도 ?? currentYear;
  /**
   * 넘겨 가며 볼 과제 목록. (2026-08-07)
   *
   * ⚠️ **정렬을 고정해야 한다.** 서버는 `ORDER BY` 없이 내려주고(`assemble.py`),
   *    Postgres 는 UPDATE 된 행을 뒤로 보낸다. 실측(개발서버 328건): 한 건 저장하니
   *    그 과제가 **4번째 → 66번째**로 갔다. '저장 후 계속' 은 저장 뒤 목록을 다시
   *    받으므로, 정렬이 없으면 **다음을 눌렀을 때 엉뚱한 과제로 뛴다** — 건너뛰거나
   *    이미 본 것을 다시 본다.
   *
   * 정렬 기준은 **사업부(설정 순서) → 과제명** 이고, 목록 화면과 **같은 비교자**
   *    (`compareProjects`)를 쓴다. 목록에서 맨 위에 있던 과제가 여기서는 17번째로
   *    나오던 것이 이 때문이었다 — 목록은 사업부 가나다순이었고 여기는 설정 순서였다.
   *    기준이 갈리면 넘겨 가며 볼 때 "내가 어디쯤 있나" 를 잃는다.
   *
   * ⚠️ 휴지통·취소 과제는 뺀다. 서버는 소프트 삭제 과제도 함께 내려주고
   *    (개발서버 328건 중 228건이 휴지통), 그대로 두면 넘기다가 삭제된 과제
   *    편집창에 들어간다.
   *
   * ⚠️ **지금 보고 있는 과제는 예외로 남긴다.** 휴지통이나 취소 과제를 직접 열었을 때
   *    목록에서 빠지면 `currentIndex` 가 -1 이 되어 이전/다음이 **둘 다 막힌다.**
   *    빠져나갈 수는 있어야 하므로 자기 자신은 남기고, 다른 것으로 **들어가지만** 않게 한다.
   *
   * 화면 목록의 필터(사업부·진행상태·검색어)는 반영되지 않는다 — 여기까지 오지 않는다.
   */
  const navProjects = React.useMemo(() => (
    (allProjects || [])
      .filter(p => p
        && (navYear == null || p.과제년도 === navYear)
        && (p.id === project?.id || (!p._deleted && p.진행상태 !== '취소')))
      .sort(compareProjects(settingsData))
  ), [allProjects, navYear, project?.id, settingsData]);
  const currentIndex = navProjects.findIndex(p => p.id === project?.id);
  const prevProject = currentIndex > 0 ? navProjects[currentIndex - 1] : null;
  const nextProject = currentIndex >= 0 && currentIndex < navProjects.length - 1 ? navProjects[currentIndex + 1] : null;

  const handleNavigatePrev = () => {
    if (prevProject && onNavigate) onNavigate(prevProject);
  };

  const handleNavigateNext = () => {
    if (nextProject && onNavigate) onNavigate(nextProject);
  };

  if (!isOpen || !project) return null;

  return (
    <>
    <AnimatePresence>
      <ModalLayout
        key="edit-project-modal"
        handleClose={handleClose}
        currentYear={currentYear || project.taskYear}
        formYear={formData.과제년도}
        handleSubmit={handleSubmit}
        handleSubmitAndUpload={onSubmitAndUpload ? handleSubmitAndUploadClick : null}
        // 서버 저장 경로가 있을 때만 — 로컬 전용으로 물러서면 안 되는 버튼이다
        handleSaveAndStay={onSubmitAndUpload ? handleSaveAndStay : null}
        handleSaveAsNew={onSaveAsNew ? handleSaveAsNew : null}
        onExportToPPT={canExportReport ? handleExportToPPT : null}
        subjectTitle={formData.과제명 || ''}
        isEditMode={true}
        onNavigatePrev={prevProject ? handleNavigatePrev : null}
        onNavigateNext={nextProject ? handleNavigateNext : null}
        navInfo={currentIndex >= 0 ? { current: currentIndex + 1, total: navProjects.length } : null}
        tabs={[
          {
            key: 'basic',
            label: '기본정보 / 담당정보',
            icon: <ClipboardList size={15} />,
            errorCount: countTabErrors(errors, 'basic'),
            content: (
              <>
              {/*
                AI 폼 채우기 — 이 탭에만 둔다.
                ⚠️ 채우는 칸이 **이 탭에만 있는 것은 아니다**(과제상세설명은 '기타' 탭).
                   그래서 패널이 제안마다 어느 탭의 칸인지 배지로 보여준다 —
                   안 열어 본 탭의 값이 조용히 바뀌는 것을 막는 장치다.
              */}
              <AiFillPanel
                projectUuid={project?.uuid || project?.id}
                formData={formData}
                onApply={handleAiFill}
              />
              <HorizontalSectionsContainer>
                <BasicInfoSection
                  formData={formData}
                  handleInputChange={handleInputChange}
                  projectId={project?.uuid || project?.id}
                  isAdmin={isAdmin}
                  errors={errors}
                  divisionOptions={divisionOptions}
                  processOptions={processOptions}
                  domainOptions={domainOptions}
                  categoryOptions={categoryOptions}
                  statusOptions={statusOptions}
                  monthOptions={monthOptions}
                  showError={showError}
                  onSaveAndUpload={onSubmitAndUpload ? handleUploadOnly : null}
                  autoOpenDetailInfo={autoOpenDetailInfo}
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
                  /* AI 로 참여인력 찾기 — 저장된 과제에서만 (권한을 그 과제로 판정한다) */
                  projectUuid={project?.uuid || project?.id}
                  onAddPeople={handleAddPeopleFromAi}
                />
              </HorizontalSectionsContainer>
              </>
            ),
          },
          {
            key: 'kpi',
            label: 'DX KPI 연결',
            icon: <Link2 size={15} />,
            // 연결 건수를 탭에 띄운다 — 탭으로 빼면 안 열어 보는 사람이 생기는데,
            // 배지가 있으면 열지 않아도 '몇 개 걸려 있는지' 는 보인다.
            // (비활성 탭도 마운트되므로 열지 않아도 서버에서 불러온다 — ModalLayout:621)
            count: Array.isArray(kpiLinks) ? kpiLinks.length : 0,
            content: (
              /*
                별도 탭 (2026-08-06 요청).
                ⚠️ 원래는 기본정보 탭에 두었다 — 그 탭은 모두가 열기 때문에 연결이
                   저절로 쌓였다. 탭으로 빼면 **안 여는 사람은 영영 안 연다.**
                   연결률이 떨어지면 그때 다시 볼 것.
                전체 폭을 쓰는 건 그대로다 — 지표가 15개라 좁은 칼럼에 넣으면
                두 줄씩 접혀 읽기 어렵다.
              */
              <KpiLinkSection
                projectUuid={project?.uuid || project?.id}
                /* 기여 방법 사전(설정 ▸ KPI 기여방법)을 내려준다 */
                settingsData={settingsData}
                value={kpiLinks}
                // ★ 기준선은 **서버 응답만** 정한다. 사용자의 변경은 절대 기준선이 되지 않는다.
                //   예전엔 onChange 하나로 둘 다 처리해서, 조회 응답보다 클릭이 빠르면
                //   그 클릭이 기준선이 되고 "안 바뀐 것" 으로 판정돼 저장이 통째로 생략됐다.
                onLoaded={(serverItems) => {
                  setKpiLinksBase(serverItems);
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
                /* 붙여넣기로 액션아이템을 만들 때 권한·과제년도를 이 과제로 판정한다 */
                projectUuid={project?.uuid || project?.id}
                /* AI 로 뽑은 항목을 넣었으면 변경 이력에 그렇게 남긴다 */
                onAiFilled={markAiFilled}
              />
            ),
          },
          {
            key: 'issues',
            label: '이슈사항',
            icon: <AlertCircle size={15} />,
            count: (formData.이슈목록 || []).length,
            content: (
              <IssuesSection
                formData={formData}
                handleInputChange={handleInputChange}
              />
            ),
          },
          {
            key: 'etc',
            label: '기타',
            icon: <MoreHorizontal size={15} />,
            count: attachments.length + (formData.선행과제목록 || []).length,
            content: (
              <>
                {/*
                  선행 과제 — 2026-08-08 되살렸다.

                  숨겼던 이유(2026-07-31 V2 컷오버)
                      `선행과제목록` 만 V2 쓰기 API 가 없어서, 이 필드가 바뀐 저장은 통째로
                      V1 으로 물러섰다. 컷오버 뒤엔 그게 **조용한 손실**이었다 — V1 에는
                      쓰이지만 화면은 dt2 에서 읽고 v2_sync 는 멈춰 있어 새로고침하면
                      사라졌고, 폴백이 저장 전체를 V1 으로 보내므로 **같은 저장의 다른
                      필드 수정까지** 함께 사라졌다.

                  지금  `PUT /api/dt-v2/projects/<uuid>/dependencies` 가 생겼다.
                        `dashboardWriteApi` 가 성과 연결처럼 **필드 PATCH 보다 먼저** 보낸다.
                        `RELATION_FIELDS_WITHOUT_API` 는 비었다.

                  ⚠️ 서버가 거절하는 경우가 성과 연결보다 많다 — 자기 자신·없는 과제·
                     영구 삭제된 과제·중복, 그리고 **순환**(A→B→A). 문구는 서버가 준다.
                */}
                <PredecessorSection
                  formData={formData}
                  setFormData={setFormData}
                  allProjects={allProjects}
                  currentProjectId={project?.uuid || project?.id}
                />
                <AttachmentSection
                  projectId={project?.uuid || project?.id}
                  attachments={attachments}
                  pendingFiles={[]}
                  onAttachmentsChange={setAttachments}
                  isEditMode={true}
                />
                <RemarksSection
                  formData={formData}
                  handleInputChange={handleInputChange}
                />
              </>
            ),
          },
          {
            key: 'history',
            label: '변경 이력',
            icon: <History size={15} />,
            // 건수를 배지로 달지 않는다 — 세려면 탭을 열기 전에 서버를 불러야 하고,
            // 편집창을 열 때마다 모든 과제의 이력을 조회하게 된다.
            content: (
              <ChangeHistorySection projectUuid={project?.uuid || project?.id} />
            ),
          },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
    </AnimatePresence>

      {/* 보고서 템플릿 선택 모달 */}
      {isReportTemplateModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000,
          }}
          onClick={() => !reportLoading && setIsReportTemplateModalOpen(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '1rem',
              width: '90%',
              maxWidth: '420px',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.3)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1.25rem 1.5rem',
              background: 'linear-gradient(135deg, #0066cc 0%, #0052a3 100%)',
              color: 'white',
            }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <FileText size={20} /> 보고서 저장
              </h2>
              <button
                onClick={() => !reportLoading && setIsReportTemplateModalOpen(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  color: 'white',
                  width: '2rem',
                  height: '2rem',
                  borderRadius: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>&times;</span>
              </button>
            </div>

            {/* 본문 */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* 과제명 표시 */}
              <div style={{
                padding: '0.75rem 1rem',
                background: '#f0f7ff',
                borderRadius: '0.5rem',
                border: '1px solid #dbeafe',
              }}>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>과제명</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1f2937' }}>
                  {formData.과제명 || '(제목 없음)'}
                </div>
              </div>

              {/* 상세정보 줄 수 */}
              <div style={{
                padding: '0.75rem 1rem',
                background: '#fefce8',
                borderRadius: '0.5rem',
                border: '1px solid #fde68a',
              }}>
                <div style={{ fontSize: '0.75rem', color: '#92400e', marginBottom: '0.25rem' }}>상세정보 줄 수</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1f2937' }}>
                  {countDetailLines(formData)}줄
                </div>
              </div>

              {/* 템플릿 선택 */}
              <div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
                  보고서 템플릿
                </div>
                {templates.length > 0 ? (
                  <>
                    <select
                      value={selectedTemplate}
                      onChange={(e) => setSelectedTemplate(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.625rem 0.75rem',
                        border: '2px solid #e5e7eb',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        color: '#1f2937',
                        background: 'white',
                        cursor: 'pointer',
                        boxSizing: 'border-box',
                      }}
                    >
                      {templates.map((t) => (
                        <option key={t.filename} value={t.filename}>{t.name}</option>
                      ))}
                    </select>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.375rem' }}>
                      보고서에 사용할 PPT 템플릿을 선택하세요.
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>
                    기본 템플릿이 사용됩니다.
                  </div>
                )}
              </div>
            </div>

            {/* 푸터 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              padding: '1rem 1.5rem',
              borderTop: '1px solid #e5e7eb',
              background: '#f9fafb',
            }}>
              <button
                onClick={() => !reportLoading && setIsReportTemplateModalOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.625rem 1.25rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  background: 'white',
                  color: '#6b7280',
                  border: '1px solid #d1d5db',
                }}
              >
                취소
              </button>
              <button
                onClick={handleDownloadReport}
                disabled={reportLoading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.625rem 1.25rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  borderRadius: '0.5rem',
                  cursor: reportLoading ? 'not-allowed' : 'pointer',
                  background: 'linear-gradient(135deg, #0066cc 0%, #0052a3 100%)',
                  color: 'white',
                  border: 'none',
                  opacity: reportLoading ? 0.5 : 1,
                }}
              >
                <FileText size={16} />
                {reportLoading ? '생성 중...' : '보고서 저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 알림 다이얼로그 */}
      {alertDialog.isOpen && (
        <AlertDialog
          key="alert-dialog"
          isOpen={alertDialog.isOpen}
          onClose={() => setAlertDialog({ isOpen: false, message: '' })}
          title="알림"
          message={alertDialog.message}
          variant="error"
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
    </>
  );
};

export default EditProjectModal;