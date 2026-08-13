import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
// AiChatSidebar 는 2026-08-01 에 화면에서 내렸다(아래 mount 자리 주석 참고).
// import AiChatSidebar from '../../components/AiChatSidebar';
// AI 에이전트 패널(관리자 전용) — 백엔드가 MCP 도구를 권한 검사와 함께 실행한다.
import AiAgentPanel from './components/AiAgentPanel';
import { useVisibilityScope } from '../../contexts/VisibilityScopeContext';
import { useAuth } from '../../contexts/AuthContext';

// Components
import Header from './components/Layout/Header';
import GanttChart from './components/GanttChart/GanttChart';
import DashboardView from './components/Dashboard/DashboardView';
import KpiMatrixView from './components/Dashboard/KpiMatrixView';
import AddProjectModal from './components/ProjectModal/AddProjectModal';
import EditProjectModal from './components/ProjectModal/EditProjectModal';
import DeleteConfirmModal from './components/ProjectModal/DeleteConfirmModal';
import SettingsModal from './components/SettingsPanel/SettingsModal';
import ServerUploadModal from './components/ServerSync/ServerUploadModal';
import BulkYearDeleteModal from './components/BulkYearDelete/BulkYearDeleteModal';
import ServerKnowledgeGraphModal from './components/ServerSync/ServerKnowledgeGraphModal';
import ImportDataModal from './components/ImportExport/ImportDataModal';
import ExportDataModal from './components/ImportExport/ExportDataModal';
import LocalStorageModal from './components/ImportExport/LocalStorageModal';
import SnapshotModal from './components/ImportExport/SnapshotModal';
import MemberAuditModal from './components/MemberAudit/MemberAuditModal';
import BulkAddModal from './components/BulkAddModal/BulkAddModal';
import AddPerformanceModal from './components/PerformanceModal/AddPerformanceModal';
import ContributionEditModal from './components/ContributionEditModal/ContributionEditModal';
import ActivityLogModal from './components/ActivityLogModal/ActivityLogModal';
import ConfirmDialog from './components/common/ConfirmDialog';
import AlertDialog from './components/common/AlertDialog';
import ReportModal from './components/ReportModal/ReportModal';
import ReportPdfModal from './components/ReportModal/ReportPdfModal';

// Data and Utils - 새로운 구조
import {
  saveMetadata,
  updateMetadata,
  loadProjects,
  saveProjects,
  addProject,
  updateProject,
  deleteProject,
  generateNextProjectId,
  loadPerformances,
  savePerformances,
  addPerformance,
  updatePerformance,
  deletePerformance,
  // 로컬(IndexedDB/localStorage) 사본만 비운다. 옛 '전체 삭제'가 이것만 하면서
  // 서버까지 지운 것처럼 안내해 문제였다 — 지금은 '로컬 캐시 비우기'로만 쓴다.
  clearAllData,
  validateData,
  migrateLegacyData,
  initDataStorage
} from './utils/dataStructure';

import {
  convertProjectsToLegacyFormat,
  getProjectPerformancesWithData,
  getAllProjectsWithPerformanceData,
  cleanupOrphanedPerformanceLinks
} from './utils/projectPerformanceLink';

import {
  logActivity,
  logActionItemChanges,
  extractChanges,
  LOG_ACTIONS,
  TARGET_TYPES,
  LOG_SOURCES
} from './utils/activityLogger';

import {
  exportKnowledgeGraph,
  generateKnowledgeGraphData,
  generatePersonnelKnowledgeGraphData
} from './utils/importExportUtils';

import {
  createGraph,
  saveGraphData
} from '../dx-work-process/services/graphApi';

import {
  fetchSystemSettings,
  saveSystemSettings,
  downloadServerData,
  uploadProjectAttachment,
  downloadAllAttachments
} from './services/settingsApi';

// 서버에 쓰는 경로는 전부 이 어댑터를 지난다. 화면에서 직접 upsert 를 부르지 않는다.
// V2(과제별 PATCH) 전환은 이 파일이 아니라 어댑터 안에서 일어난다.
import {
  recentActivityLogs,
  saveAutoRepair,
  saveNewProject,
  saveProjectEdit,
  savePerformanceEdit,
  saveContributions,
  saveProjectPerformanceLinks,
  saveBulkAdd,
  saveCreatedAtBackfill,
  saveSettingsRename,
  saveErrorMessage,
  rethrowSaveError,
  checkProjectFreshness,
  softDeleteProject,
  restoreProject,
  permanentDeleteProject,
  deletePerformanceApi
} from './services/dashboardWriteApi';

import {
  sampleMetadata,
  STATUS_COLORS,
  DIVISION_COLORS,
  settingsData
} from './data/sampleDataV2';

// 기존 샘플 데이터와의 호환성을 위한 임포트
import { sampleProjects as legacySampleProjects } from './data/sampleData';

const Container = styled.div`
  background: #ECEFF1;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const Content = styled.div`
  flex: 1;
  padding: ${props => props.viewMode === 'gantt' ? '1rem' : '0'};
  display: flex;
  align-items: ${props => props.viewMode === 'dashboard' ? 'stretch' : 'center'};
  justify-content: center;
  max-width: 100%;
  margin: 0;
  width: 100%;
  overflow-y: auto;
  overflow-x: hidden;

  ${props => props.viewMode === 'gantt' && `
    align-items: stretch;
    padding: 1rem;
  `}

  ${props => props.viewMode === 'dashboard' && `
    padding: 0;
  `}

`;

const DigitalTwinDashboardApp = () => {
  // 가시성 범위 (사업부 내 공개 토글)
  const { filterProjects: filterByVisibility } = useVisibilityScope();

  // 기본 상태
  const [viewMode, setViewMode] = useState('gantt');
  const [dashboardSubTab, setDashboardSubTab] = useState('executive'); // 서브탭 상태 (기본: 경영진 보고)
  const [metadata, setMetadata] = useState(null);
  const [projects, setProjects] = useState([]);
  const [globalPerformances, setGlobalPerformances] = useState([]);
  const [currentSettingsData, setCurrentSettingsData] = useState(settingsData);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  // KPI 매트릭스 갱신 신호 — 과제를 저장할 때마다 올린다.
  // 매트릭스는 자기 데이터를 서버에서 직접 받아서(로컬 상태와 안 섞는다),
  // 여기서 KPI 연결을 고쳐도 알려주지 않으면 표가 그대로다.
  const [kpiReloadSignal, setKpiReloadSignal] = useState(0);
  const bumpKpiReload = () => setKpiReloadSignal((v) => v + 1);
  const { user } = useAuth();
  // 로그인 즉시: 내 과제 중 '재검토 요청' 알림 팝업
  const [reportRejectPopup, setReportRejectPopup] = useState([]);
  const [notification, setNotification] = useState('');
  
  // 모달 상태
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkAddModalOpen, setIsBulkAddModalOpen] = useState(false);
  const [isAddPerformanceModalOpen, setIsAddPerformanceModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editModalAutoOpenDetail, setEditModalAutoOpenDetail] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isLocalStorageModalOpen, setIsLocalStorageModalOpen] = useState(false); // 새로 추가
  const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState(false);
  const [isMemberAuditOpen, setIsMemberAuditOpen] = useState(false);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isPdfReportModalOpen, setIsPdfReportModalOpen] = useState(false);
  const [isServerUploadModalOpen, setIsServerUploadModalOpen] = useState(false);
  const [isBulkYearDeleteModalOpen, setIsBulkYearDeleteModalOpen] = useState(false);
  const [isServerKnowledgeGraphModalOpen, setIsServerKnowledgeGraphModalOpen] = useState(false);
  const [isContributionEditModalOpen, setIsContributionEditModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedPerformanceForEdit, setSelectedPerformanceForEdit] = useState(null); // 편집할 성과 항목

  // 공통 다이얼로그 상태
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'warning'
  });
  const [alertDialog, setAlertDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    variant: 'info'
  });

  // 컴포넌트 마운트 시 데이터 로드 및 서버 데이터 자동 불러오기
  useEffect(() => {
    const initAndLoadServerData = async () => {
      // IndexedDB 스토리지 초기화 (localStorage → IndexedDB 마이그레이션 포함)
      await initDataStorage();

      await initializeData();

      // 페이지 진입 시 자동으로 서버 데이터 불러오기
      try {
        const serverData = await downloadServerData();

        if (serverData && (serverData.projects?.length > 0 || serverData.performances?.length > 0)) {
          // 고아 성과 참조 정리 (존재하지 않는 성과 ID 제거)
          const { cleanedProjects, removedCount, affectedProjects } = cleanupOrphanedPerformanceLinks(
            serverData.projects || [],
            serverData.performances || []
          );

          // 진행상태-진행률 정합성 보정 (완료인데 100%가 아닌 과제 수정)
          let progressFixCount = 0;
          cleanedProjects.forEach(p => {
            if (p.진행상태 === '완료' && parseFloat(p.진행률) !== 100) {
              p.진행률 = 100;
              progressFixCount++;
            }
          });
          if (progressFixCount > 0) {
            console.log(`[데이터 보정] 진행상태 '완료'인데 진행률이 100%가 아닌 과제 ${progressFixCount}건을 보정했습니다.`);
          }

          // *** 중요: 상태를 먼저 업데이트한 후 서버 업로드 ***
          // React concurrent mode에서 await 중에 렌더링이 발생할 수 있으므로
          // 상태를 먼저 설정해야 경고 메시지가 나타나지 않음

          // 데이터 적용 - localStorage에도 저장하여 다음 렌더링에서 일관성 유지
          saveProjects(cleanedProjects);
          savePerformances(serverData.performances || []);

          setProjects(cleanedProjects);
          setGlobalPerformances(serverData.performances || []);

          if (serverData.metadata) {
            setMetadata(serverData.metadata);
          }

          // 버전 저장
          if (serverData.version) {
            localStorage.setItem('dashboardDataVersion', serverData.version.toString());
          }

          console.log(`서버 데이터 자동 로드 완료: v${serverData.version || '?'}, 프로젝트 ${cleanedProjects.length}개 (정리됨), 성과 ${serverData.performances?.length || 0}개`);

          // 고아 참조 또는 진행률 보정이 있으면 서버에도 업로드 (백그라운드)
          if (removedCount > 0 || progressFixCount > 0) {
            if (removedCount > 0) {
              console.log(`[데이터 정리] ${removedCount}개의 고아 성과 참조가 정리되었습니다.`);
              console.log('[데이터 정리] 영향받은 과제:', affectedProjects.map(p => `${p.id} - ${p.과제명}(${p.removedCount}개)`).join(', '));
            }

            saveAutoRepair({
              projects: cleanedProjects,
              performances: serverData.performances || [],
              metadata: serverData.metadata
            }).then(() => {
              console.log('[데이터 보정] 보정된 데이터가 서버에 저장되었습니다.');
            }).catch((cleanupUploadError) => {
              console.warn('[데이터 보정] 서버 저장 실패 (로컬에서만 보정됨):', cleanupUploadError.message);
            });
          }
        }
      } catch (error) {
        // 페이지 진입 시 자동 로드 실패는 조용히 무시 - 사용자가 수동으로 불러올 수 있음
        console.log('서버 데이터 자동 로드 실패 (무시됨):', error.message);
      }
    };
    initAndLoadServerData();
  }, []);

  // 메타데이터 변경 감지 (연도는 더 이상 서버 메타데이터에서 덮어쓰지 않음)
  // 진입 시 항상 현재 시스템 연도를 기본으로 사용
  // useEffect(() => {
  //   if (metadata?.settings?.currentYear) {
  //     setCurrentYear(metadata.settings.currentYear);
  //   }
  // }, [metadata]);

  // 데이터 초기화 함수 (빈 상태로 시작)
  const initializeData = async () => {
    try {
      // 빈 메타데이터로 초기화
      const initialMetadata = {
        version: sampleMetadata.version,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        projectCount: 0,
        performanceCount: 0,
        lastBackupDate: null,
        settings: {
          currentYear: new Date().getFullYear(),
          viewMode: 'gantt',
          autoSave: true
        }
      };

      // 상태를 빈 배열로 초기화
      setMetadata(initialMetadata);
      setProjects([]);
      setGlobalPerformances([]);
      setViewMode('gantt');

      // DB에서 시스템 설정 불러오기
      try {
        const dbSettings = await fetchSystemSettings();
        if (dbSettings && Object.keys(dbSettings).length > 0) {
          const hasData = dbSettings.divisions?.length > 0 ||
                          dbSettings.departments?.length > 0 ||
                          dbSettings.processes?.length > 0;
          if (hasData) {
            setCurrentSettingsData(dbSettings);
          }
        }
      } catch (settingsError) {
        // 실패해도 기본 settingsData 사용
      }

    } catch (error) {
      console.error('초기화 실패:', error);
      showError('초기화 중 오류가 발생했습니다: ' + error.message);
    }
  };

  // 샘플 데이터 로드
  const handleLoadSampleData = async () => {
    try {
      if (projects.length > 0 || globalPerformances.length > 0) {
        setConfirmDialog({
          isOpen: true,
          title: '샘플 데이터 로드',
          message: '현재 데이터가 있습니다. 샘플 데이터를 로드하면 기존 데이터가 모두 삭제됩니다.\n\n계속하시겠습니까?',
          variant: 'warning',
          onConfirm: async () => {
            await loadSampleDataConfirmed();
            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          }
        });
        return;
      }

      // 데이터가 없으면 바로 로드
      await loadSampleDataConfirmed();

    } catch (error) {
      console.error('샘플 데이터 로드 실패:', error);
      showError('샘플 데이터 로드 중 오류가 발생했습니다: ' + error.message);
    }
  };

  const loadSampleDataConfirmed = async () => {
    try {
      console.log('샘플 데이터 로드 시작...');

      // option.json 파일 불러오기 (public 폴더에서 제공)
      const response = await fetch('/sample/option.json');
      if (!response.ok) {
        throw new Error('샘플 데이터 파일을 불러올 수 없습니다.');
      }
      const data = await response.json();

      // 고아 성과 참조 정리
      const { cleanedProjects, removedCount } = cleanupOrphanedPerformanceLinks(
        data.projects || [],
        data.performances || []
      );
      if (removedCount > 0) {
        console.log(`[샘플 데이터 정리] ${removedCount}개의 고아 성과 참조가 정리되었습니다.`);
      }

      // 샘플 데이터 저장
      const savedProjects = saveProjects(cleanedProjects);
      const savedPerformances = savePerformances(data.performances);
      const savedMetadata = saveMetadata(data.metadata);

      // 상태 업데이트
      setProjects(savedProjects);
      setGlobalPerformances(savedPerformances);
      setMetadata(savedMetadata);

      console.log(`샘플 데이터 로드 완료: 프로젝트 ${savedProjects.length}개, 성과 ${savedPerformances.length}개`);
      showSuccess(`샘플 데이터가 로드되었습니다. (프로젝트 ${savedProjects.length}개, 성과 ${savedPerformances.length}개)`);

    } catch (error) {
      console.error('샘플 데이터 로드 실패:', error);
      showError('샘플 데이터 로드 중 오류가 발생했습니다: ' + error.message);
    }
  };

  // 뷰 모드 변경 처리
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    
    // 메타데이터에 뷰 모드 저장
    const updatedMetadata = updateMetadata({
      settings: {
        ...metadata?.settings,
        viewMode: mode
      }
    });
    setMetadata(updatedMetadata);
  };

  // ── 재검토 요청 알림 (로그인/데이터 로드 시) ──
  const rejectAckKey = `dtwin_reportRejectAck_${user?.id || user?.email || user?.name || 'anon'}`;
  useEffect(() => {
    if (!user) return;
    const myName = user?.name || '';
    const confirms = currentSettingsData?.reportConfirmations || {};
    let ack = [];
    try { ack = JSON.parse(localStorage.getItem(rejectAckKey) || '[]'); } catch { ack = []; }
    // 수신자 계정 ID/이메일로 정확 매칭 (수신자 미지정 레거시 건은 PL 이름 fallback)
    const isForMe = (project, seal) => {
      const recips = seal.recipients || [];
      if (recips.length) return recips.some(r => (r.id != null && r.id === user.id) || (r.email && r.email === user.email));
      return myName && (project.과제PL || project.작성자 || '') === myName;
    };
    const list = (projects || [])
      .filter(p => p && !p._deleted && p.과제년도 === currentYear)
      .map(p => ({ project: p, seal: confirms[p.uuid || p.id] || null }))
      .filter(({ project, seal }) => {
        if (seal?.status !== 'rejected') return false;
        if (!isForMe(project, seal)) return false;
        const sig = `${project.uuid || project.id}@${seal.sentAt || seal.at || ''}`;
        return !ack.includes(sig);
      });
    setReportRejectPopup(list);
  }, [projects, currentSettingsData, currentYear, user, rejectAckKey]);

  const dismissReportRejectPopup = () => {
    let ack = [];
    try { ack = JSON.parse(localStorage.getItem(rejectAckKey) || '[]'); } catch { ack = []; }
    reportRejectPopup.forEach(({ project, seal }) => {
      const sig = `${project.uuid || project.id}@${seal.sentAt || seal.at || ''}`;
      if (!ack.includes(sig)) ack.push(sig);
    });
    localStorage.setItem(rejectAckKey, JSON.stringify(ack));
    setReportRejectPopup([]);
  };
  const goToReportFromPopup = () => {
    setViewMode('dashboard');
    setDashboardSubTab('report');
    dismissReportRejectPopup();
  };

  // 알림 메시지 함수들
  const showSuccess = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(''), 4000);
  };

  const showError = (message) => {
    setAlertDialog({
      isOpen: true,
      title: '오류',
      message: message,
      variant: 'error'
    });
  };

  // 성공은 아니지만 흐름을 끊을 일도 아닌 알림. 같은 토스트를 쓰되 조금 더 오래 둔다.
  const showNotice = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(''), 7000);
  };

  // ============ 프로젝트 관리 함수들 ============

  const handleAddProject = () => {
    setIsAddModalOpen(true);
  };

  const handleSubmitProject = async (newProjectData) => {
    try {
      // 진행상태-진행률 정합성 보정
      if (newProjectData.진행상태 === '완료') newProjectData.진행률 = 100;

      // pendingFiles 추출 (로컬 스토리지에 저장하지 않음)
      const pendingFiles = newProjectData.pendingFiles || [];
      delete newProjectData.pendingFiles;

      // 현재 프로젝트 목록을 전달
      const updatedProjects = addProject(newProjectData, projects);

      // 추가된 프로젝트 찾기 (가장 마지막에 추가된 프로젝트)
      const addedProject = updatedProjects[updatedProjects.length - 1];

      setProjects(updatedProjects);

      // 메타데이터 업데이트
      const updatedMetadata = updateMetadata({ projectCount: updatedProjects.length });
      setMetadata(updatedMetadata);

      // 액티비티 로그 기록
      logActivity({
        action: LOG_ACTIONS.CREATE,
        targetType: TARGET_TYPES.PROJECT,
        targetId: addedProject.id,
        targetUuid: addedProject.uuid,
        targetName: addedProject.과제명,
        changes: {
          과제명: { before: null, after: addedProject.과제명 },
          사업부: { before: null, after: addedProject.사업부 },
          진행상태: { before: null, after: addedProject.진행상태 }
        },
        metadata: {
          source: LOG_SOURCES.MODAL
        }
      });

      // 액션아이템 단위 로그 (신규 과제이므로 모두 CREATE)
      logActionItemChanges([], addedProject.액션아이템목록 || [], addedProject, {
        source: LOG_SOURCES.MODAL
      });

      // 대기 중인 파일들을 서버에 업로드
      if (pendingFiles.length > 0) {
        const projectId = addedProject.uuid || addedProject.id;
        let uploadedCount = 0;

        for (const pendingFile of pendingFiles) {
          try {
            await uploadProjectAttachment(projectId, pendingFile.file);
            uploadedCount++;
          } catch (uploadError) {
            console.error('파일 업로드 실패:', pendingFile.name, uploadError);
          }
        }

        if (uploadedCount > 0) {
          showSuccess(`새 프로젝트 "${newProjectData.과제명}"이 추가되었습니다. (첨부파일 ${uploadedCount}개 업로드됨)`);
        } else {
          showSuccess(`새 프로젝트 "${newProjectData.과제명}"이 추가되었습니다. (첨부파일 업로드 실패)`);
        }
      } else {
        showSuccess(`새 프로젝트 "${newProjectData.과제명}"이 추가되었습니다.`);
      }

      console.log('새 과제가 추가되었습니다:', newProjectData);
    } catch (error) {
      showError('프로젝트 추가 중 오류가 발생했습니다: ' + error.message);
    }
  };

  // 과제 추가 후 서버 바로 업로드
  const handleSubmitProjectAndUpload = async (newProjectData) => {
    try {
      // pendingFiles 추출 (로컬 스토리지에 저장하지 않음)
      const pendingFiles = newProjectData.pendingFiles || [];
      delete newProjectData.pendingFiles;

      // 현재 프로젝트 목록을 전달
      const updatedProjects = addProject(newProjectData, projects);

      // 추가된 프로젝트 찾기 (가장 마지막에 추가된 프로젝트)
      const addedProject = updatedProjects[updatedProjects.length - 1];

      setProjects(updatedProjects);

      // 메타데이터 업데이트
      const updatedMetadata = updateMetadata({ projectCount: updatedProjects.length });
      setMetadata(updatedMetadata);

      // 액티비티 로그 기록 (로컬 저장 + 서버 전송용)
      const createLog = {
        action: LOG_ACTIONS.CREATE,
        targetType: TARGET_TYPES.PROJECT,
        targetId: addedProject.id,
        targetUuid: addedProject.uuid,
        targetName: addedProject.과제명,
        changes: {
          과제명: { before: null, after: addedProject.과제명 },
          사업부: { before: null, after: addedProject.사업부 },
          진행상태: { before: null, after: addedProject.진행상태 }
        },
        metadata: {
          source: LOG_SOURCES.MODAL
        }
      };
      logActivity(createLog);

      // 액션아이템 단위 로그 (신규 과제이므로 모두 CREATE)
      const actionItemLogCount = logActionItemChanges(
        [],
        addedProject.액션아이템목록 || [],
        addedProject,
        { source: LOG_SOURCES.MODAL }
      );

      // 서버에 업로드 — 활동 로그(과제 생성 + 액션아이템) 포함.
      // 버전 송수신은 어댑터가 맡는다.
      // project 는 V2 분기(POST /projects)가 쓴다. V1 경로에서는 쓰이지 않는다.
      await saveNewProject({
        projects: updatedProjects,
        performances: globalPerformances,
        metadata: updatedMetadata,
        activityLogs: recentActivityLogs(1 + actionItemLogCount),
        project: addedProject
      });

      // 대기 중인 파일들을 서버에 업로드
      if (pendingFiles.length > 0) {
        const projectId = addedProject.uuid || addedProject.id;
        let uploadedCount = 0;

        for (const pendingFile of pendingFiles) {
          try {
            await uploadProjectAttachment(projectId, pendingFile.file);
            uploadedCount++;
          } catch (uploadError) {
            console.error('파일 업로드 실패:', pendingFile.name, uploadError);
          }
        }

        if (uploadedCount > 0) {
          showSuccess(`새 프로젝트 "${newProjectData.과제명}"이 추가되고 서버에 업로드되었습니다. (첨부파일 ${uploadedCount}개 업로드됨)`);
        } else {
          showSuccess(`새 프로젝트 "${newProjectData.과제명}"이 추가되고 서버에 업로드되었습니다. (첨부파일 업로드 실패)`);
        }
      } else {
        showSuccess(`새 프로젝트 "${newProjectData.과제명}"이 추가되고 서버에 업로드되었습니다.`);
      }

      // 서버 데이터 동기화 (서버에서 최신 데이터 불러오기)
      await executeServerDownload({ silent: true, preserveMetadata: true });

      console.log('새 과제 추가 및 서버 업로드 완료:', newProjectData);
    } catch (error) {
      rethrowSaveError(error, '프로젝트 추가 및 서버 업로드 중 오류');
    }
  };

  /**
   * 편집창을 열 때 "지금 보고 있는 게 최신인가" 를 뒤따라 확인한다.
   *
   * **여는 것을 막지 않는다.** 확인이 늦거나 실패해도 편집은 시작할 수 있어야 한다
   * (오프라인 우선 구조). 알릴 일이 있을 때만 토스트가 뜬다.
   */
  const noticeIfStale = (project) => {
    checkProjectFreshness(project).then(notice => {
      if (notice) showNotice(notice);
    });
  };

  const handleEditProject = (project, opts = {}) => {
    setSelectedProject(project);
    setEditModalAutoOpenDetail(!!opts.openDetailInfo);
    setIsEditModalOpen(true);
    noticeIfStale(project);
  };

  const handleNavigateProject = (project) => {
    setSelectedProject(project);
    noticeIfStale(project);   // 모달 안에서 과제를 옮겨 다닐 때도 같은 확인
  };

  const handleUpdateProject = (updatedProjectData) => {
    try {
      console.log('[handleUpdateProject] 호출됨');
      console.log('[handleUpdateProject] updatedProjectData.id:', updatedProjectData.id);
      console.log('[handleUpdateProject] 현재 projects 배열 길이:', projects.length);
      console.log('[handleUpdateProject] 현재 projects ID들:', projects.map(p => p.id));

      // 진행상태-진행률 정합성 보정
      if (updatedProjectData.진행상태 === '완료') updatedProjectData.진행률 = 100;

      // 수정 전 프로젝트 데이터 찾기
      const beforeProject = projects.find(p => p.id === updatedProjectData.id);

      // 취소 전환 시각 기록(삭제의 _deletedAt과 대칭): 전환 순간 1회 기록, 이후 편집엔 불변. 모달이 값을 주면(관리자 수정) 존중.
      {
        const wasCanceled = beforeProject?.진행상태 === '취소';
        const nowCanceled = updatedProjectData.진행상태 === '취소';
        if (!nowCanceled) {
          delete updatedProjectData._canceledAt;                        // 취소 해제 → 제거
        } else if (!updatedProjectData._canceledAt) {                   // 모달이 값을 안 준 경우만 보정
          if (!wasCanceled) updatedProjectData._canceledAt = new Date().toISOString();               // 신규 전환 → 지금
          else if (beforeProject?._canceledAt) updatedProjectData._canceledAt = beforeProject._canceledAt; // 기존값 유지(레거시=없음 유지, 자동 now 금지)
        }
      }

      // 현재 프로젝트 목록을 전달
      const updatedProjects = updateProject(updatedProjectData.id, updatedProjectData, projects);

      console.log('[handleUpdateProject] updateProject 반환값 길이:', updatedProjects.length);
      console.log('[handleUpdateProject] updateProject 반환값 ID들:', updatedProjects.map(p => p.id));

      setProjects(updatedProjects);

      // 변경 사항 추출 및 로그 기록
      if (beforeProject) {
        console.log('🔍 [로그 디버깅] beforeProject:', beforeProject);
        console.log('🔍 [로그 디버깅] updatedProjectData:', updatedProjectData);

        const changes = extractChanges(beforeProject, updatedProjectData, [
          '과제명', '사업부', '프로세스', '과제영역', '과제구분', '시작', '종료',
          '진행상태', '과제PL', '작성자', '과제상세설명', 'PoC과제여부', '중점과제여부',
          '과제년도', '과제참여인력목록', '성과목록', '액션아이템목록', '이슈목록', '담당부서목록'
        ]);

        console.log('🔍 [로그 디버깅] 추출된 changes:', changes);
        console.log('🔍 [로그 디버깅] changes 개수:', Object.keys(changes).length);

        if (Object.keys(changes).length > 0) {
          console.log('✅ [로그 디버깅] 액티비티 로그 기록 중...');
          logActivity({
            action: LOG_ACTIONS.UPDATE,
            targetType: TARGET_TYPES.PROJECT,
            targetId: updatedProjectData.id,
            targetUuid: updatedProjectData.uuid,
            targetName: updatedProjectData.과제명,
            changes,
            metadata: {
              source: LOG_SOURCES.MODAL
            }
          });
        } else {
          console.log('❌ [로그 디버깅] 변경사항 없음 - 로그 기록 안됨');
        }

        // 액션아이템 단위 추가/삭제 로그
        logActionItemChanges(
          beforeProject.액션아이템목록,
          updatedProjectData.액션아이템목록,
          updatedProjectData,
          { source: LOG_SOURCES.MODAL }
        );
      } else {
        console.log('❌ [로그 디버깅] beforeProject를 찾을 수 없음');
      }

      bumpKpiReload();   // KPI 연결이 바뀌었을 수 있다 — 매트릭스를 다시 받게 한다
      showSuccess(`프로젝트 "${updatedProjectData.과제명}"이 업데이트되었습니다.`);
      console.log('과제가 업데이트되었습니다:', updatedProjectData);
    } catch (error) {
      showError('프로젝트 업데이트 중 오류가 발생했습니다: ' + error.message);
      console.error('[handleUpdateProject] 에러:', error);
    }
  };

  // 과제 편집 후 서버 바로 업로드
  const handleUpdateProjectAndUpload = async (updatedProjectData) => {
    try {
      console.log('[handleUpdateProjectAndUpload] 호출됨');
      console.log('[handleUpdateProjectAndUpload] updatedProjectData.id:', updatedProjectData.id);

      // 진행상태-진행률 정합성 보정
      if (updatedProjectData.진행상태 === '완료') updatedProjectData.진행률 = 100;

      // DX KPI 연결은 별도 테이블(dt2_project_kpi)이라 **과제 데이터가 아니다.**
      // 편집창이 실어 보낸 값을 여기서 꺼내고 곧바로 지운다 — 안 지우면 과제 목록과
      // localStorage 에 정체불명의 키가 섞이고, V1 upsert 본문에도 실려 나간다.
      const kpiLinks = updatedProjectData.__dtKpiLinks;
      delete updatedProjectData.__dtKpiLinks;

      // 수정 전 프로젝트 데이터 찾기
      const beforeProject = projects.find(p => p.id === updatedProjectData.id);

      // 취소 전환 시각 기록(삭제의 _deletedAt과 대칭): 전환 순간 1회 기록, 이후 편집엔 불변. 모달이 값을 주면(관리자 수정) 존중.
      {
        const wasCanceled = beforeProject?.진행상태 === '취소';
        const nowCanceled = updatedProjectData.진행상태 === '취소';
        if (!nowCanceled) {
          delete updatedProjectData._canceledAt;                        // 취소 해제 → 제거
        } else if (!updatedProjectData._canceledAt) {                   // 모달이 값을 안 준 경우만 보정
          if (!wasCanceled) updatedProjectData._canceledAt = new Date().toISOString();               // 신규 전환 → 지금
          else if (beforeProject?._canceledAt) updatedProjectData._canceledAt = beforeProject._canceledAt; // 기존값 유지(레거시=없음 유지, 자동 now 금지)
        }
      }

      // 현재 프로젝트 목록을 전달
      const updatedProjects = updateProject(updatedProjectData.id, updatedProjectData, projects);

      setProjects(updatedProjects);

      // 변경 사항 추출 및 로그 기록
      let activityLogsToSend = [];
      if (beforeProject) {
        const changes = extractChanges(beforeProject, updatedProjectData, [
          '과제명', '사업부', '프로세스', '과제영역', '과제구분', '시작', '종료',
          '진행상태', '과제PL', '작성자', '과제상세설명', 'PoC과제여부', '중점과제여부',
          '과제년도', '과제참여인력목록', '성과목록', '액션아이템목록', '이슈목록', '담당부서목록'
        ]);

        let projectLogCount = 0;
        if (Object.keys(changes).length > 0) {
          logActivity({
            action: LOG_ACTIONS.UPDATE,
            targetType: TARGET_TYPES.PROJECT,
            targetId: updatedProjectData.id,
            targetUuid: updatedProjectData.uuid,
            targetName: updatedProjectData.과제명,
            changes,
            metadata: {
              source: LOG_SOURCES.MODAL
            }
          });
          projectLogCount = 1;
        }

        // 액션아이템 단위 추가/삭제 로그
        const actionItemLogCount = logActionItemChanges(
          beforeProject.액션아이템목록,
          updatedProjectData.액션아이템목록,
          updatedProjectData,
          { source: LOG_SOURCES.MODAL }
        );

        // 최근 로그를 서버 전송 형태로 (과제 + 액션아이템). 0건이면 빈 배열이다.
        activityLogsToSend = recentActivityLogs(projectLogCount + actionItemLogCount);
      }

      // 서버에 업로드 — 버전 송수신은 어댑터가 맡는다.
      // project/before 는 V2 분기가 "무엇이 바뀌었나"를 계산하는 데 쓴다.
      // V1 경로에서는 쓰이지 않는다.
      const saveResult = await saveProjectEdit({
        projects: updatedProjects,
        performances: globalPerformances,
        metadata: metadata,
        activityLogs: activityLogsToSend,
        project: updatedProjectData,
        before: beforeProject,
        kpiLinks   // 바뀌었을 때만 값이 있다. 어댑터가 과제 저장보다 먼저 보낸다.
      });

      // 내가 편집하는 동안 다른 사람이 **다른 항목**을 바꿨다면 함께 알린다.
      // 둘 다 저장됐지만, 내 화면이 낡은 상태였다는 사실은 알려줘야 한다.
      const mergedWith = saveResult?.mergedWith || [];
      showSuccess(
        `프로젝트 "${updatedProjectData.과제명}"이 업데이트되고 서버에 업로드되었습니다.`
        + (mergedWith.length
          ? ` 그 사이 다른 사용자가 ${mergedWith.join(', ')}을(를) 수정해 함께 반영했습니다.`
          : ''));

      // 서버 데이터 동기화 (서버에서 최신 데이터 불러오기)
      await executeServerDownload({ silent: true, preserveMetadata: true });

      // KPI 매트릭스도 다시 받게 한다 — 위 kpiLinks 가 서버에 반영된 뒤여야 하므로
      // 다운로드가 끝난 여기서 올린다.
      bumpKpiReload();

      console.log('과제 업데이트 및 서버 업로드 완료:', updatedProjectData);
    } catch (error) {
      rethrowSaveError(error, '프로젝트 업데이트 및 서버 업로드 중 오류');
    }
  };

  const handleDeleteProject = (project) => {
    setSelectedProject(project);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async (projectToDelete) => {
    try {
      // 서버에 소프트 삭제 요청
      const projectUuid = projectToDelete.uuid || projectToDelete.id;
      await softDeleteProject(projectUuid);

      // 로컬 상태 업데이트 (삭제 플래그 설정)
      const now = new Date().toISOString();
      const updatedProjects = projects.map(p => {
        if (p.id === projectToDelete.id || p.uuid === projectToDelete.uuid) {
          return {
            ...p,
            _deleted: true,
            _deletedAt: now,
            updatedAt: now  // 다른 사용자의 오래된 데이터로 덮어쓰기 방지
          };
        }
        return p;
      });
      setProjects(updatedProjects);
      saveProjects(updatedProjects);

      // 메타데이터 업데이트 (삭제되지 않은 과제만 카운트)
      const activeProjects = updatedProjects.filter(p => !p._deleted);
      const updatedMetadata = updateMetadata({ projectCount: activeProjects.length });
      setMetadata(updatedMetadata);

      // 서버 버전 동기화는 어댑터가 한다.
      // (V2 경로에는 전역 version 이 없어서 여기서 올리면 안 된다)

      // 액티비티 로그 기록
      logActivity({
        action: LOG_ACTIONS.DELETE,
        targetType: TARGET_TYPES.PROJECT,
        targetId: projectToDelete.id,
        targetUuid: projectToDelete.uuid,
        targetName: projectToDelete.과제명,
        changes: {
          과제명: { before: projectToDelete.과제명, after: null },
          사업부: { before: projectToDelete.사업부, after: null }
        },
        metadata: {
          source: LOG_SOURCES.MODAL
        }
      });

      showSuccess(`프로젝트 "${projectToDelete.과제명}"이 삭제되었습니다. (휴지통에서 복구 가능)`);
      console.log('과제가 삭제되었습니다:', projectToDelete);
    } catch (error) {
      console.error('프로젝트 삭제 실패:', error);
      showError('프로젝트 삭제 중 오류가 발생했습니다: ' + error.message);
    }
  };

  // 삭제된 과제 복구
  const handleRestoreProject = async (projectToRestore) => {
    try {
      const projectUuid = projectToRestore.uuid || projectToRestore.id;
      await restoreProject(projectUuid);

      // 로컬 상태 업데이트
      const now = new Date().toISOString();
      const updatedProjects = projects.map(p => {
        if (p.id === projectToRestore.id || p.uuid === projectToRestore.uuid) {
          const { _deleted, _deletedAt, _deletedBy, _deletedByName, ...rest } = p;
          return {
            ...rest,
            updatedAt: now  // 다른 사용자의 오래된 데이터로 덮어쓰기 방지
          };
        }
        return p;
      });
      setProjects(updatedProjects);
      saveProjects(updatedProjects);

      // 메타데이터 업데이트
      const activeProjects = updatedProjects.filter(p => !p._deleted);
      const updatedMetadata = updateMetadata({ projectCount: activeProjects.length });
      setMetadata(updatedMetadata);

      // 서버 버전 동기화는 어댑터가 한다.
      // (V2 경로에는 전역 version 이 없어서 여기서 올리면 안 된다)

      showSuccess(`프로젝트 "${projectToRestore.과제명}"이 복구되었습니다.`);
    } catch (error) {
      console.error('프로젝트 복구 실패:', error);
      showError('프로젝트 복구 중 오류가 발생했습니다: ' + error.message);
    }
  };

  // 과제 완전 삭제
  const handlePermanentDeleteProject = async (projectToDelete) => {
    try {
      const projectUuid = projectToDelete.uuid || projectToDelete.id;
      await permanentDeleteProject(projectUuid);

      // 로컬 상태에서 완전히 제거
      const updatedProjects = projects.filter(p =>
        p.id !== projectToDelete.id && p.uuid !== projectToDelete.uuid
      );
      setProjects(updatedProjects);
      saveProjects(updatedProjects);

      // 메타데이터 업데이트
      const activeProjects = updatedProjects.filter(p => !p._deleted);
      const updatedMetadata = updateMetadata({ projectCount: activeProjects.length });
      setMetadata(updatedMetadata);

      // 서버 버전 동기화는 어댑터가 한다.
      // (V2 경로에는 전역 version 이 없어서 여기서 올리면 안 된다)

      showSuccess(`프로젝트 "${projectToDelete.과제명}"이 완전히 삭제되었습니다.`);
    } catch (error) {
      console.error('프로젝트 완전 삭제 실패:', error);
      showError('프로젝트 완전 삭제 중 오류가 발생했습니다: ' + error.message);
    }
  };

  // ============ 그룹별 보기 열 배치 설정 ============

  const handleColumnSettingsChange = async (newColumnSettings) => {
    try {
      // 로컬 설정 업데이트
      const updatedSettings = {
        ...currentSettingsData,
        groupedViewColumnSettings: newColumnSettings
      };
      setCurrentSettingsData(updatedSettings);

      // 열 배치 설정만 서버에 저장 (다른 설정과 충돌 방지)
      await saveSystemSettings({
        groupedViewColumnSettings: newColumnSettings
      });

      showSuccess('열 배치 설정이 저장되었습니다.');
    } catch (error) {
      console.error('열 배치 설정 저장 실패:', error);
      showError('열 배치 설정 저장 중 오류가 발생했습니다.');
    }
  };

  // ============ 피봇 보기 설정 ============

  const handlePivotSettingsChange = async (newPivotSettings) => {
    try {
      // 로컬 설정 업데이트
      const updatedSettings = {
        ...currentSettingsData,
        pivotViewSettings: newPivotSettings
      };
      setCurrentSettingsData(updatedSettings);

      // 피봇 설정만 서버에 저장
      await saveSystemSettings({
        pivotViewSettings: newPivotSettings
      });

      showSuccess('피봇 설정이 저장되었습니다.');
    } catch (error) {
      console.error('피봇 설정 저장 실패:', error);
      showError('피봇 설정 저장 중 오류가 발생했습니다.');
    }
  };

  // ============ 성과 관리 함수들 ============

  const handleAddPerformance = () => {
    setSelectedPerformanceForEdit(null);
    setIsAddPerformanceModalOpen(true);
  };

  // 특정 성과 항목을 편집 모드로 모달 열기
  const handleEditPerformance = (performance) => {
    setSelectedPerformanceForEdit(performance);
    setIsAddPerformanceModalOpen(true);
  };

  const handleSubmitPerformance = (performanceData) => {
    try {
      let updatedPerformances;

      if (performanceData.isEditing) {
        // 수정 모드 - 현재 성과 목록을 전달
        // ID가 변경된 경우 oldId로 기존 성과를 찾음
        const idChanged = performanceData._idChanged;
        const searchId = idChanged ? idChanged.oldId : performanceData.id;
        const beforePerformance = globalPerformances.find(p => p.id === searchId);

        // updatePerformance는 searchId(기존 ID)로 찾아서 업데이트
        updatedPerformances = updatePerformance(searchId, performanceData, globalPerformances);

        // ID가 변경된 경우 과제들의 성과목록도 업데이트
        if (idChanged) {
          const { oldId, newId } = idChanged;
          const updatedProjects = projects.map(project => {
            if (project.성과목록 && project.성과목록.includes(oldId)) {
              return {
                ...project,
                성과목록: project.성과목록.map(id => id === oldId ? newId : id),
                updatedAt: new Date().toISOString()
              };
            }
            return project;
          });

          // 변경된 과제가 있으면 저장
          const changedProjects = updatedProjects.filter((p, i) => p !== projects[i]);
          if (changedProjects.length > 0) {
            setProjects(updatedProjects);
            saveProjects(updatedProjects);
            console.log(`성과 ID 변경으로 ${changedProjects.length}개 과제의 연결이 업데이트됨`);
          }
        }

        // 변경 사항 추출 및 로그 기록
        if (beforePerformance) {
          const changes = extractChanges(beforePerformance, performanceData, [
            '성과항목', '성과년도', '대분류', '소분류', '단위', '현재수준',
            '목표수준', '실적수준', '월별실적여부', '월별실적', '설명'
          ]);

          // ID 변경도 로그에 포함
          if (idChanged) {
            changes['id'] = { before: idChanged.oldId, after: idChanged.newId };
          }

          if (Object.keys(changes).length > 0) {
            logActivity({
              action: LOG_ACTIONS.UPDATE,
              targetType: TARGET_TYPES.PERFORMANCE,
              targetId: performanceData.id,
              targetUuid: performanceData.uuid,
              targetName: performanceData.성과항목,
              changes,
              metadata: {
                source: LOG_SOURCES.MODAL
              }
            });
          }
        }

        showSuccess(`성과 항목 "${performanceData.성과항목}"이 수정되었습니다.`);
      } else {
        // 새로 생성 모드
        // 중복 체크
        const isDuplicate = globalPerformances.some(perf =>
          perf.성과항목.toLowerCase().trim() === performanceData.성과항목.toLowerCase().trim() &&
          perf.대분류 === performanceData.대분류 &&
          perf.소분류 === performanceData.소분류
        );

        if (isDuplicate) {
          showError('동일한 성과 항목이 이미 존재합니다.');
          return;
        }

        // 현재 성과 목록을 전달
        updatedPerformances = addPerformance(performanceData, globalPerformances);

        // 추가된 성과 찾기
        const addedPerformance = updatedPerformances[updatedPerformances.length - 1];

        // 액티비티 로그 기록
        logActivity({
          action: LOG_ACTIONS.CREATE,
          targetType: TARGET_TYPES.PERFORMANCE,
          targetId: addedPerformance.id,
          targetUuid: addedPerformance.uuid,
          targetName: addedPerformance.성과항목,
          changes: {
            성과항목: { before: null, after: addedPerformance.성과항목 },
            대분류: { before: null, after: addedPerformance.대분류 },
            목표수준: { before: null, after: addedPerformance.목표수준 }
          },
          metadata: {
            source: LOG_SOURCES.MODAL
          }
        });

        showSuccess(`새 성과 항목 "${performanceData.성과항목}"이 추가되었습니다.`);
      }

      setGlobalPerformances(updatedPerformances);

      // 메타데이터 업데이트
      const updatedMetadata = updateMetadata({ performanceCount: updatedPerformances.length });
      setMetadata(updatedMetadata);

      console.log('성과 항목 처리 완료:', performanceData);

    } catch (error) {
      const operation = performanceData.isEditing ? '수정' : '추가';
      showError(`성과 항목 ${operation} 중 오류가 발생했습니다: ` + error.message);
    }
  };

  // 성과 항목 생성/수정 후 서버 바로 업로드
  const handleSubmitPerformanceAndUpload = async (performanceData) => {
    try {
      let updatedPerformances;
      let updatedProjectsList = projects; // 과제 목록 (ID 변경 시 업데이트)

      // V2 분기가 쓰는 값들. 수정이면 before 가 차고, 생성이면 savedPerformance 만 찬다.
      let beforeForV2 = null;
      let savedPerformance = performanceData;
      const idChanged = performanceData._idChanged;

      if (performanceData.isEditing) {
        // 수정 모드
        // ID가 변경된 경우 oldId로 기존 성과를 찾음
        const searchId = idChanged ? idChanged.oldId : performanceData.id;
        const beforePerformance = globalPerformances.find(p => p.id === searchId);
        beforeForV2 = beforePerformance || null;

        // updatePerformance는 searchId(기존 ID)로 찾아서 업데이트
        updatedPerformances = updatePerformance(searchId, performanceData, globalPerformances);

        // ID가 변경된 경우 과제들의 성과목록도 업데이트
        if (idChanged) {
          const { oldId, newId } = idChanged;
          updatedProjectsList = projects.map(project => {
            if (project.성과목록 && project.성과목록.includes(oldId)) {
              return {
                ...project,
                성과목록: project.성과목록.map(id => id === oldId ? newId : id),
                updatedAt: new Date().toISOString()
              };
            }
            return project;
          });

          // 변경된 과제가 있으면 저장
          const changedProjects = updatedProjectsList.filter((p, i) => p !== projects[i]);
          if (changedProjects.length > 0) {
            setProjects(updatedProjectsList);
            saveProjects(updatedProjectsList);
            console.log(`성과 ID 변경으로 ${changedProjects.length}개 과제의 연결이 업데이트됨`);
          }
        }

        if (beforePerformance) {
          const changes = extractChanges(beforePerformance, performanceData, [
            '성과항목', '성과년도', '대분류', '소분류', '단위', '현재수준',
            '목표수준', '실적수준', '월별실적여부', '월별실적', '설명'
          ]);

          // ID 변경도 로그에 포함
          if (idChanged) {
            changes['id'] = { before: idChanged.oldId, after: idChanged.newId };
          }

          if (Object.keys(changes).length > 0) {
            logActivity({
              action: LOG_ACTIONS.UPDATE,
              targetType: TARGET_TYPES.PERFORMANCE,
              targetId: performanceData.id,
              targetUuid: performanceData.uuid,
              targetName: performanceData.성과항목,
              changes,
              metadata: { source: LOG_SOURCES.MODAL }
            });
          }
        }
      } else {
        // 새로 생성 모드
        const isDuplicate = globalPerformances.some(perf =>
          perf.성과항목.toLowerCase().trim() === performanceData.성과항목.toLowerCase().trim() &&
          perf.대분류 === performanceData.대분류 &&
          perf.소분류 === performanceData.소분류
        );

        if (isDuplicate) {
          showError('동일한 성과 항목이 이미 존재합니다.');
          return;
        }

        updatedPerformances = addPerformance(performanceData, globalPerformances);
        const addedPerformance = updatedPerformances[updatedPerformances.length - 1];
        savedPerformance = addedPerformance;   // uuid·id 가 채워진 최종본

        logActivity({
          action: LOG_ACTIONS.CREATE,
          targetType: TARGET_TYPES.PERFORMANCE,
          targetId: addedPerformance.id,
          targetUuid: addedPerformance.uuid,
          targetName: addedPerformance.성과항목,
          changes: {
            성과항목: { before: null, after: addedPerformance.성과항목 },
            대분류: { before: null, after: addedPerformance.대분류 },
            목표수준: { before: null, after: addedPerformance.목표수준 }
          },
          metadata: { source: LOG_SOURCES.MODAL }
        });
      }

      // 로컬 상태 업데이트
      setGlobalPerformances(updatedPerformances);
      const updatedMetadata = updateMetadata({ performanceCount: updatedPerformances.length });
      setMetadata(updatedMetadata);

      // 서버에 업로드 — 활동 로그 포함. 버전 송수신은 어댑터가 맡는다.
      // ID 변경 시 과제 목록도 업데이트된 것을 사용
      // performance/before/idChanged 는 V2 분기가 쓴다. V1 경로에서는 쓰이지 않는다.
      await savePerformanceEdit({
        projects: updatedProjectsList,
        performances: updatedPerformances,
        metadata: updatedMetadata,
        activityLogs: recentActivityLogs(1),
        performance: savedPerformance,
        before: beforeForV2,
        idChanged
      });

      // 서버 업로드 완료 후 상태를 다시 설정하여 UI 갱신 보장
      setGlobalPerformances([...updatedPerformances]);

      // 서버 데이터 동기화 (서버에서 최신 데이터 불러오기)
      await executeServerDownload({ silent: true, preserveMetadata: true });

      console.log('성과 항목 처리 및 서버 업로드 완료:', performanceData);

    } catch (error) {
      const operation = performanceData.isEditing ? '수정' : '추가';
      rethrowSaveError(error, `성과 항목 ${operation} 및 서버 업로드 중 오류`);
    }
  };

  const handleDeletePerformance = async (performanceId) => {
    try {
      // 특별한 경우: 'ALL' ID로 전체 삭제 처리
      if (performanceId === 'ALL') {
        console.log('모든 성과 항목 삭제 시작...');

        // 모든 프로젝트에서 성과 목록 비우기
        const updatedProjects = projects.map(project => ({
          ...project,
          성과목록: []
        }));

        saveProjects(updatedProjects);
        setProjects(updatedProjects);

        // 모든 성과 삭제
        savePerformances([]);
        setGlobalPerformances([]);

        // 메타데이터 업데이트
        const updatedMetadata = updateMetadata({
          projectCount: updatedProjects.length,
          performanceCount: 0
        });
        setMetadata(updatedMetadata);

        showSuccess('모든 성과 항목이 삭제되었습니다.');
        console.log('모든 성과 항목 삭제 완료');
        return;
      }

      // 단일 성과 항목 삭제 처리
      const performanceToDelete = globalPerformances.find(perf => perf.id === performanceId);
      if (!performanceToDelete) {
        showError('삭제할 성과 항목을 찾을 수 없습니다.');
        return;
      }

      // 서버에 성과 삭제 요청
      const performanceUuid = performanceToDelete.uuid || performanceToDelete.id;
      const deleteResult = await deletePerformanceApi(performanceUuid);

      // 이 성과 항목을 사용하는 모든 프로젝트에서 해당 성과 제거
      const now = new Date().toISOString();
      const updatedProjects = projects.map(project => {
        if (project.성과목록 && project.성과목록.length > 0) {
          const filteredPerformances = project.성과목록.filter(perfRef => {
            // 다양한 형식 지원: 문자열, {id: ...}, {성과항목ID: ...}
            const perfId = typeof perfRef === 'string' ? perfRef : (perfRef.id || perfRef.성과항목ID);
            return perfId !== performanceId;
          });

          // 성과가 삭제된 경우 로그 출력 및 updatedAt 갱신
          if (filteredPerformances.length !== project.성과목록.length) {
            console.log(`프로젝트 "${project.과제명}"에서 성과 "${performanceToDelete.성과항목}" 제거됨`);
            return {
              ...project,
              성과목록: filteredPerformances,
              updatedAt: now  // 다른 사용자의 오래된 데이터로 덮어쓰기 방지
            };
          }

          return {
            ...project,
            성과목록: filteredPerformances
          };
        }
        return project;
      });

      // 글로벌 성과 목록에서 제거 - 현재 성과 목록을 전달
      const updatedPerformances = deletePerformance(performanceId, globalPerformances);

      // 상태 업데이트
      saveProjects(updatedProjects);
      setProjects(updatedProjects);
      setGlobalPerformances(updatedPerformances);

      // 메타데이터 업데이트
      const updatedMetadata = updateMetadata({
        projectCount: updatedProjects.length,
        performanceCount: updatedPerformances.length
      });
      setMetadata(updatedMetadata);

      // 서버 반환 버전으로 동기화 (수동 증가 대신 서버 실제 버전 사용)
      if (deleteResult && deleteResult.version) {
        localStorage.setItem('dashboardDataVersion', deleteResult.version.toString());
      }

      // 액티비티 로그 기록
      logActivity({
        action: LOG_ACTIONS.DELETE,
        targetType: TARGET_TYPES.PERFORMANCE,
        targetId: performanceToDelete.id,
        targetUuid: performanceToDelete.uuid,
        targetName: performanceToDelete.성과항목,
        changes: {
          성과항목: { before: performanceToDelete.성과항목, after: null },
          대분류: { before: performanceToDelete.대분류, after: null }
        },
        metadata: {
          source: LOG_SOURCES.MODAL
        }
      });

      showSuccess(`성과 항목 "${performanceToDelete.성과항목}"이 삭제되었습니다.`);
      console.log('성과 항목 삭제 완료:', performanceToDelete);

      // 서버 데이터 동기화 (다른 작업들과 동일한 패턴 - 삭제 후 서버 최신 상태 반영)
      await executeServerDownload({ silent: true, preserveMetadata: true });

    } catch (error) {
      console.error('성과 항목 삭제 실패:', error);
      showError('성과 항목 삭제 중 오류가 발생했습니다: ' + error.message);
    }
  };

  // ============ 기타 기능들 ============

  const handleAddMultipleProjects = () => {
    setIsBulkAddModalOpen(true);
  };

  const handleEditContributions = () => {
    setIsContributionEditModalOpen(true);
  };

  // 기여도 저장 핸들러
  const handleSaveContributions = (projectUpdates) => {
    try {
      // 각 프로젝트별로 기여도 업데이트
      const updatedProjects = projects.map(project => {
        const updates = projectUpdates[project.id];
        if (!updates) return project;

        // 성과목록에서 기여도 업데이트 (getProjectPerformancesWithData와 동일한 로직)
        const updatedPerformances = (project.성과목록 || []).map(perf => {
          // 성과 식별자 추출 (getProjectPerformancesWithData와 동일)
          const perfIdentifier = typeof perf === 'string'
            ? perf
            : (perf.성과항목UUID || perf.id || perf.성과항목ID);

          // globalPerformances에서 해당 성과 찾기 (id 또는 uuid로 매칭)
          const globalPerf = globalPerformances.find(gp =>
            gp.id === perfIdentifier || gp.uuid === perfIdentifier
          );

          // 업데이트에서 해당 성과의 변경사항 찾기 (globalPerformance의 id로 찾음)
          const update = globalPerf ? updates.find(u => u.performanceId === globalPerf.id) : null;

          if (update) {
            if (typeof perf === 'object') {
              return { ...perf, 과제기여도: update.contribution };
            } else {
              // 문자열이면 객체로 변환
              return { 성과항목ID: perf, 과제기여도: update.contribution };
            }
          }
          return perf;
        });

        return { ...project, 성과목록: updatedPerformances };
      });

      // 저장
      saveProjects(updatedProjects);
      setProjects(updatedProjects);

      // 로그 - 수정된 과제명 목록 포함
      const updatedProjectNames = Object.keys(projectUpdates).map(id => {
        const project = updatedProjects.find(p => p.id === id);
        return project?.과제명 || id;
      });
      logActivity({
        action: LOG_ACTIONS.BULK_UPDATE,
        targetType: TARGET_TYPES.PROJECT,
        targetName: `기여도 수정 (${Object.keys(projectUpdates).length}개 과제)`,
        changes: {
          contributionUpdates: { before: null, after: Object.keys(projectUpdates).length },
          updatedProjects: { before: null, after: updatedProjectNames }
        },
        metadata: { source: LOG_SOURCES.MODAL }
      });

      showSuccess(`${Object.keys(projectUpdates).length}개 과제의 기여도가 수정되었습니다.`);
      setIsContributionEditModalOpen(false);
    } catch (error) {
      console.error('기여도 저장 실패:', error);
      showError('기여도 저장 중 오류가 발생했습니다: ' + error.message);
    }
  };

  // 기여도 저장 및 서버 업로드 핸들러
  const handleSaveContributionsAndUpload = async (projectUpdates) => {
    try {
      // 각 프로젝트별로 기여도 업데이트
      const updatedProjects = projects.map(project => {
        const updates = projectUpdates[project.id];
        if (!updates) return project;

        // 성과목록에서 기여도 업데이트 (getProjectPerformancesWithData와 동일한 로직)
        const updatedPerformances = (project.성과목록 || []).map(perf => {
          // 성과 식별자 추출 (getProjectPerformancesWithData와 동일)
          const perfIdentifier = typeof perf === 'string'
            ? perf
            : (perf.성과항목UUID || perf.id || perf.성과항목ID);

          // globalPerformances에서 해당 성과 찾기 (id 또는 uuid로 매칭)
          const globalPerf = globalPerformances.find(gp =>
            gp.id === perfIdentifier || gp.uuid === perfIdentifier
          );

          // 업데이트에서 해당 성과의 변경사항 찾기 (globalPerformance의 id로 찾음)
          const update = globalPerf ? updates.find(u => u.performanceId === globalPerf.id) : null;

          if (update) {
            if (typeof perf === 'object') {
              return { ...perf, 과제기여도: update.contribution };
            } else {
              // 문자열이면 객체로 변환
              return { 성과항목ID: perf, 과제기여도: update.contribution };
            }
          }
          return perf;
        });

        return { ...project, 성과목록: updatedPerformances };
      });

      // 로컬 저장
      saveProjects(updatedProjects);
      setProjects(updatedProjects);

      // 서버 업로드
      const projectsToUpload = updatedProjects.filter(p => projectUpdates[p.id]);

      if (projectsToUpload.length > 0) {
        // 로그 먼저 기록 - 수정된 과제명 목록 포함
        const uploadedProjectNames = projectsToUpload.map(p => p.과제명);
        logActivity({
          action: LOG_ACTIONS.BULK_UPDATE,
          targetType: TARGET_TYPES.PROJECT,
          targetName: `기여도 수정 (${Object.keys(projectUpdates).length}개 과제)`,
          changes: {
            contributionUpdates: { before: null, after: Object.keys(projectUpdates).length },
            updatedProjects: { before: null, after: uploadedProjectNames }
          },
          metadata: { source: LOG_SOURCES.MODAL }
        });

        // 바뀐 과제만 보낸다 — V1 upsert 의 부분 머지 성질을 이용한다.
        await saveContributions({
          projects: projectsToUpload.map(p => convertProjectsToLegacyFormat([p], globalPerformances)[0]),
          performances: globalPerformances,   // V2 분기가 성과 참조를 uuid 로 풀 때 쓴다
          activityLogs: recentActivityLogs(1)
        });
      }

      showSuccess(`${Object.keys(projectUpdates).length}개 과제의 기여도가 수정되고 서버에 업로드되었습니다.`);

      // 서버 데이터 동기화 (서버에서 최신 데이터 불러오기)
      await executeServerDownload({ silent: true, preserveMetadata: true });

      setIsContributionEditModalOpen(false);
    } catch (error) {
      console.error('기여도 저장 및 업로드 실패:', error);
      showError('기여도 저장 중 오류가 발생했습니다: ' + error.message);
    }
  };

  // 성과에서 과제 연결 핸들러
  const handleLinkProjectToPerformance = async (linkData) => {
    try {
      const { performanceId, performanceName, linkedProjects: newLinks } = linkData;

      // 변경된 과제 추적
      const changedProjectIds = new Set();

      // 모든 과제에서 해당 성과 연결 정보 업데이트
      const updatedProjects = projects.map(project => {
        const projectId = project.id || project.uuid;
        const linkedInfo = newLinks.find(lp => lp.projectId === projectId);

        // 현재 성과목록 복사
        let newPerformanceList = project.성과목록 ? [...project.성과목록] : [];

        // 기존 연결 찾기 (다양한 키 형식 지원)
        const existingIndex = newPerformanceList.findIndex(p => {
          const pId = typeof p === 'object' ? (p.성과항목UUID || p.성과항목ID || p.성과UUID || p.uuid || p.id) : p;
          return pId === performanceId;
        });

        let changed = false;

        if (linkedInfo) {
          // 연결 추가/업데이트 - getProjectPerformancesWithData와 호환되는 형식 사용
          const perfLink = {
            성과항목ID: performanceId,
            성과항목UUID: performanceId,
            과제기여도: linkedInfo.contribution || ''
          };

          if (existingIndex >= 0) {
            // 기존 기여도와 다르면 변경된 것
            const existing = newPerformanceList[existingIndex];
            if (existing.과제기여도 !== perfLink.과제기여도) {
              changed = true;
            }
            newPerformanceList[existingIndex] = perfLink;
          } else {
            newPerformanceList.push(perfLink);
            changed = true;
          }
        } else {
          // 연결 제거
          if (existingIndex >= 0) {
            newPerformanceList.splice(existingIndex, 1);
            changed = true;
          }
        }

        if (changed) {
          changedProjectIds.add(projectId);
        }

        return {
          ...project,
          성과목록: newPerformanceList,
          // 변경된 경우 updatedAt 갱신 (서버 동기화 시 최신 데이터로 인식되도록)
          ...(changed ? { updatedAt: new Date().toISOString() } : {})
        };
      });

      // 로컬 저장
      saveProjects(updatedProjects);
      setProjects(updatedProjects);

      // 서버에 변경된 과제만 업로드
      if (changedProjectIds.size > 0) {
        const changedProjects = updatedProjects.filter(p =>
          changedProjectIds.has(p.id || p.uuid)
        );

        const projectsToUpload = changedProjects.map(p =>
          convertProjectsToLegacyFormat([p], globalPerformances)[0]
        );

        await saveProjectPerformanceLinks({
          projects: projectsToUpload,
          performances: globalPerformances   // V2 분기가 성과 참조를 uuid 로 풀 때 쓴다
        });

        showSuccess(`"${performanceName}" 과제 연결이 저장되고 서버에 업로드되었습니다.`);
      } else {
        showSuccess(`"${performanceName}" 과제 연결에 변경사항이 없습니다.`);
      }
    } catch (error) {
      console.error('과제 연결 저장 실패:', error);
      showError('과제 연결 저장 중 오류가 발생했습니다: ' + error.message);
    }
  };

  const handleBulkAddProjects = (bulkData) => {
    try {
      const { type, data } = bulkData;

      if (!data || data.length === 0) {
        showError('추가할 데이터가 없습니다.');
        return;
      }

      switch (type) {
        case 'projects':
          handleBulkUpdateProjects(data);
          break;
        case 'performances':
          handleBulkUpdatePerformanceLinks(data);
          break;
        case 'actionItems':
          handleBulkUpdateActionItems(data);
          break;
        case 'teamMembers':
          handleBulkUpdateTeamMembers(data);
          break;
        case 'globalPerformances':
          handleBulkAddPerformances(data);
          break;
        default:
          showError('알 수 없는 데이터 타입입니다.');
          return;
      }

      setIsBulkAddModalOpen(false);

    } catch (error) {
      console.error('벌크 추가 실패:', error);
      showError('데이터 처리 중 오류가 발생했습니다: ' + error.message);
    }
  };

  // 벌크 추가 후 서버 업로드
  const handleBulkAddProjectsAndUpload = async (bulkData) => {
    try {
      const { type, data } = bulkData;

      if (!data || data.length === 0) {
        showError('추가할 데이터가 없습니다.');
        return;
      }

      let updatedProjects = projects;
      let updatedGlobalPerformances = globalPerformances;

      switch (type) {
        case 'projects':
          updatedProjects = handleBulkUpdateProjectsWithReturn(data);
          break;
        case 'performances':
          updatedProjects = handleBulkUpdatePerformanceLinksWithReturn(data);
          break;
        case 'actionItems':
          updatedProjects = handleBulkUpdateActionItemsWithReturn(data);
          break;
        case 'teamMembers':
          updatedProjects = handleBulkUpdateTeamMembersWithReturn(data);
          break;
        case 'globalPerformances':
          updatedGlobalPerformances = handleBulkAddPerformancesWithReturn(data);
          break;
        default:
          showError('알 수 없는 데이터 타입입니다.');
          return;
      }

      // 벌크 추가 로그 기록
      const typeLabel = {
        'projects': '과제',
        'performances': '성과 연결',
        'actionItems': '액션 아이템',
        'teamMembers': '팀 멤버',
        'globalPerformances': '성과 항목'
      }[type] || type;

      logActivity({
        action: LOG_ACTIONS.BULK_CREATE,
        targetType: type === 'globalPerformances' ? TARGET_TYPES.PERFORMANCE : TARGET_TYPES.PROJECT,
        targetName: `${typeLabel} 일괄 추가 (${data.length}개)`,
        changes: {
          type: { before: null, after: type },
          count: { before: null, after: data.length }
        },
        metadata: { source: LOG_SOURCES.MODAL }
      });

      const bulkMetadata = updateMetadata({ projectCount: updatedProjects.length });

      // 서버에 업로드 - 활동 로그 포함.
      // 실패하면 에러를 throw 하므로 아래 상태 갱신은 성공했을 때만 실행된다.
      // before* 는 V2 분기가 "무엇이 새로 생겼고 무엇이 바뀌었나" 를 가려내는 데 쓴다.
      // 이 시점의 projects/globalPerformances 는 아직 일괄 결과가 반영되기 전 상태다
      // (setProjects 는 저장 성공 후에 부른다).
      await saveBulkAdd({
        projects: updatedProjects,
        performances: updatedGlobalPerformances,
        settings: currentSettingsData,
        metadata: bulkMetadata,
        activityLogs: recentActivityLogs(1),
        beforeProjects: projects,
        beforePerformances: globalPerformances
      });

      // 상태 업데이트
      setProjects(updatedProjects);
      setGlobalPerformances(updatedGlobalPerformances);
      setMetadata(bulkMetadata);

      setIsBulkAddModalOpen(false);
      showSuccess(`데이터가 추가되고 서버에 업로드되었습니다. (${data.length}개 항목)`);

    } catch (error) {
      console.error('벌크 추가 및 서버 업로드 실패:', error);
      showError(saveErrorMessage(error, '데이터 처리 및 서버 업로드 중 오류가 발생했습니다'));
    }
  };

  // 상태를 반환하는 벌크 업데이트 함수들 (서버 업로드용)
  const handleBulkUpdateProjectsWithReturn = (projectsData) => {
    let currentProjects = [...projects];

    projectsData.forEach((projectData) => {
      // uuid로 기존 프로젝트 찾기
      if (projectData.uuid) {
        const existingProject = currentProjects.find(p => p.uuid === projectData.uuid);
        if (existingProject) {
          currentProjects = updateProject(existingProject.id, { ...projectData, uuid: existingProject.uuid }, currentProjects);
          return;
        }
      }

      // id로 기존 프로젝트 찾기 (uuid가 없거나 uuid로 못 찾은 경우)
      if (projectData.id) {
        const existingProject = currentProjects.find(p => p.id === projectData.id);
        if (existingProject) {
          currentProjects = updateProject(existingProject.id, { ...projectData, uuid: existingProject.uuid }, currentProjects);
          return;
        }
      }

      // 새 프로젝트 추가
      const finalProjectId = projectData.id || generateNextProjectId(projectData.사업부);
      currentProjects = addProject({ ...projectData, id: finalProjectId }, currentProjects);
    });

    return currentProjects;
  };

  const handleBulkUpdatePerformanceLinksWithReturn = (linksData) => {
    let currentProjects = [...projects];

    const groupedByProject = {};
    linksData.forEach(link => {
      if (!groupedByProject[link.project_id]) {
        groupedByProject[link.project_id] = [];
      }
      groupedByProject[link.project_id].push(link);
    });

    Object.keys(groupedByProject).forEach(projectId => {
      const projectIndex = currentProjects.findIndex(p => p.id === projectId);
      if (projectIndex === -1) return;

      const project = currentProjects[projectIndex];
      const links = groupedByProject[projectId];
      const updated성과목록 = [];

      links.forEach(link => {
        const globalPerf = globalPerformances.find(
          gp => gp.id === link.performance_id || gp.성과항목ID === link.performance_id
        );

        updated성과목록.push({
          ...(globalPerf || {}),
          id: link.performance_id,
          성과항목ID: link.performance_id,
          성과항목: link.성과항목명 || globalPerf?.성과항목,
          과제기여도: link.과제기여도 || ''
        });
      });

      currentProjects[projectIndex] = { ...project, 성과목록: updated성과목록 };
    });

    return currentProjects;
  };

  const handleBulkUpdateActionItemsWithReturn = (actionItemsData) => {
    let currentProjects = [...projects];

    const groupedByProject = {};
    actionItemsData.forEach(item => {
      if (!groupedByProject[item.project_id]) {
        groupedByProject[item.project_id] = [];
      }
      groupedByProject[item.project_id].push(item);
    });

    Object.keys(groupedByProject).forEach(projectId => {
      const projectIndex = currentProjects.findIndex(p => p.id === projectId);
      if (projectIndex === -1) return;

      const project = currentProjects[projectIndex];
      const items = groupedByProject[projectId];

      const newActionItems = items.map((item, index) => ({
        id: `action-${Date.now()}-${index}`,
        제목: item.제목 || '',
        완료여부: item.완료여부 || false,
        월별진행상황: item.월별진행상황 || Array(12).fill('').map(() => [])
      }));

      currentProjects[projectIndex] = { ...project, 액션아이템목록: newActionItems };
    });

    return currentProjects;
  };

  const handleBulkUpdateTeamMembersWithReturn = (membersData) => {
    let currentProjects = [...projects];

    const groupedByProject = {};
    membersData.forEach(member => {
      if (!groupedByProject[member.project_id]) {
        groupedByProject[member.project_id] = [];
      }
      groupedByProject[member.project_id].push(member);
    });

    Object.keys(groupedByProject).forEach(projectId => {
      const projectIndex = currentProjects.findIndex(p => p.id === projectId);
      if (projectIndex === -1) return;

      const project = currentProjects[projectIndex];
      const members = groupedByProject[projectId];

      const newMembers = members.map(member => ({
        이름: member.이름 || '',
        knoxId: member.knoxId || '',
        부서: member.부서 || ''
      }));

      currentProjects[projectIndex] = { ...project, 과제참여인력목록: newMembers };
    });

    return currentProjects;
  };

  const handleBulkAddPerformancesWithReturn = (performancesData) => {
    let currentPerformances = [...globalPerformances];
    let nextId = currentPerformances.length > 0
      ? Math.max(...currentPerformances.map(p => parseInt(p.id) || 0)) + 1
      : 1;

    performancesData.forEach((perfData) => {
      if (perfData.uuid) {
        const existingIndex = currentPerformances.findIndex(p => p.uuid === perfData.uuid);
        if (existingIndex !== -1) {
          currentPerformances[existingIndex] = { ...currentPerformances[existingIndex], ...perfData };
        }
      } else {
        const 월별실적 = [
          perfData.실적_1월, perfData.실적_2월, perfData.실적_3월, perfData.실적_4월,
          perfData.실적_5월, perfData.실적_6월, perfData.실적_7월, perfData.실적_8월,
          perfData.실적_9월, perfData.실적_10월, perfData.실적_11월, perfData.실적_12월
        ].map(v => v !== undefined && v !== '' ? v : '');

        const newPerformance = {
          uuid: crypto.randomUUID ? crypto.randomUUID() : `perf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          id: perfData.id || String(nextId++),
          성과년도: perfData.성과년도,
          성과항목: perfData.성과항목,
          대분류: perfData.대분류,
          소분류: perfData.소분류 || '',
          단위: perfData.단위 || '',
          현재수준: perfData.현재수준 || '',
          목표수준: perfData.목표수준 || '',
          월별실적여부: perfData.월별실적여부 || false,
          실적수준: perfData.실적수준 || '',
          월별실적: 월별실적,
          설명: perfData.설명 || ''
        };

        currentPerformances.push(newPerformance);
      }
    });

    return currentPerformances;
  };

  const handleBulkUpdateProjects = (projectsData) => {
    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    // 현재 프로젝트 목록을 복사하여 누적 처리
    let currentProjects = [...projects];

    projectsData.forEach((projectData) => {
      // uuid로 기존 프로젝트 찾기
      if (projectData.uuid) {
        const existingProject = currentProjects.find(p => p.uuid === projectData.uuid);
        if (existingProject) {
          currentProjects = updateProject(existingProject.id, { ...projectData, uuid: existingProject.uuid }, currentProjects);
          updatedCount++;
          return;
        } else {
          // UUID는 입력했는데 해당하는 프로젝트가 없으면 스킵
          console.warn(`UUID "${projectData.uuid}"에 해당하는 프로젝트를 찾을 수 없습니다. (과제명: ${projectData.과제명})`);
          skippedCount++;
          return;
        }
      }

      // id로 기존 프로젝트 찾기 (uuid가 없는 경우)
      if (projectData.id) {
        const existingProject = currentProjects.find(p => p.id === projectData.id);
        if (existingProject) {
          currentProjects = updateProject(existingProject.id, { ...projectData, uuid: existingProject.uuid }, currentProjects);
          updatedCount++;
          return;
        }
      }

      // 새 프로젝트 추가
      const finalProjectId = projectData.id || generateNextProjectId(projectData.사업부);
      currentProjects = addProject({ ...projectData, id: finalProjectId }, currentProjects);
      addedCount++;
    });

    // 최종 업데이트된 프로젝트 목록을 상태에 반영
    setProjects(currentProjects);

    // 메타데이터 업데이트
    const updatedMetadata = updateMetadata({ projectCount: currentProjects.length });
    setMetadata(updatedMetadata);

    // 결과 요약
    const summary = [];
    if (addedCount > 0) summary.push(`신규 프로젝트 ${addedCount}개`);
    if (updatedCount > 0) summary.push(`프로젝트 업데이트 ${updatedCount}개`);
    if (skippedCount > 0) summary.push(`⚠️ UUID 미매칭으로 스킵 ${skippedCount}개`);

    const message = summary.length > 0 ?
      `프로젝트 데이터 처리 완료:\n${summary.join('\n')}` :
      '처리된 데이터가 없습니다.';

    showSuccess(message);
  };

  const handleBulkUpdatePerformanceLinks = (linksData) => {
    let updatedProjectCount = 0;
    let totalLinksCount = 0;
    let errorCount = 0;

    // 현재 프로젝트 목록을 복사하여 누적 처리
    let currentProjects = [...projects];

    // project_id별로 그룹화
    const groupedByProject = {};
    linksData.forEach(link => {
      if (!groupedByProject[link.project_id]) {
        groupedByProject[link.project_id] = [];
      }
      groupedByProject[link.project_id].push(link);
    });

    // 각 프로젝트의 성과를 한번에 처리
    Object.keys(groupedByProject).forEach(projectId => {
      const project = currentProjects.find(p => p.id === projectId);

      if (!project) {
        errorCount++;
        console.warn(`프로젝트를 찾을 수 없습니다: ${projectId}`);
        return;
      }

      const links = groupedByProject[projectId];
      const updated성과목록 = [...(project.성과목록 || [])];

      // 이 프로젝트의 모든 성과 링크를 처리
      links.forEach(link => {
        // globalPerformances에서 성과 전체 정보 조회
        const globalPerf = globalPerformances.find(
          gp => gp.id === link.performance_id || gp.성과항목ID === link.performance_id
        );

        // 프로젝트의 성과목록에서 해당 성과 찾기
        const existingPerfIndex = updated성과목록.findIndex(
          perf => (typeof perf === 'object' ? (perf.id || perf.성과항목ID) : perf) === link.performance_id
        );

        if (existingPerfIndex !== undefined && existingPerfIndex >= 0) {
          // 기존 성과 업데이트
          const existingPerf = typeof updated성과목록[existingPerfIndex] === 'object'
            ? updated성과목록[existingPerfIndex]
            : {};

          updated성과목록[existingPerfIndex] = {
            // 1순위: 기존 프로젝트의 성과 데이터 (모든 필드 보존)
            ...existingPerf,
            // 2순위: globalPerformances의 성과 데이터 (없는 필드 보완)
            ...(globalPerf || {}),
            // 3순위: link 데이터로 덮어쓰기
            id: link.performance_id,
            성과항목ID: link.performance_id,
            성과항목: link.성과항목명 || existingPerf.성과항목 || globalPerf?.성과항목,
            과제기여도: link.과제기여도 !== undefined && link.과제기여도 !== ''
              ? link.과제기여도
              : (existingPerf.과제기여도 || '')
          };
        } else {
          // 새 성과 추가
          updated성과목록.push({
            // globalPerformances에서 전체 정보 가져오기
            ...(globalPerf || {}),
            id: link.performance_id,
            성과항목ID: link.performance_id,
            성과항목: link.성과항목명 || globalPerf?.성과항목,
            과제기여도: link.과제기여도 || ''
          });
        }

        totalLinksCount++;
      });

      // 프로젝트 업데이트 (한 번만) - 누적
      currentProjects = updateProject(project.id, {
        ...project,
        성과목록: updated성과목록
      }, currentProjects);

      updatedProjectCount++;
    });

    // 최종 업데이트된 프로젝트 목록을 상태에 반영
    setProjects(currentProjects);

    const message = `과제-성과 연결 처리 완료:\n프로젝트 ${updatedProjectCount}개, 연결 ${totalLinksCount}개${errorCount > 0 ? `\n오류 ${errorCount}개` : ''}`;
    showSuccess(message);
  };

  const handleBulkUpdateActionItems = (actionItemsData) => {
    let updatedProjectCount = 0;
    let totalItemsCount = 0;
    let errorCount = 0;

    // 현재 프로젝트 목록을 복사하여 누적 처리
    let currentProjects = [...projects];

    // project_id별로 그룹화
    const groupedByProject = {};
    actionItemsData.forEach(item => {
      if (!groupedByProject[item.project_id]) {
        groupedByProject[item.project_id] = [];
      }
      groupedByProject[item.project_id].push(item);
    });

    Object.keys(groupedByProject).forEach(projectId => {
      const project = currentProjects.find(p => p.id === projectId);

      if (!project) {
        errorCount++;
        console.warn(`프로젝트를 찾을 수 없습니다: ${projectId}`);
        return;
      }

      const newActionItems = groupedByProject[projectId].map((item, index) => ({
        순번: index + 1,  // Auto-assign based on position
        제목: item.제목,
        완료여부: item.완료여부 || false
      }));

      totalItemsCount += newActionItems.length;

      currentProjects = updateProject(project.id, {
        ...project,
        액션아이템목록: newActionItems
      }, currentProjects);

      updatedProjectCount++;
    });

    // 최종 업데이트된 프로젝트 목록을 상태에 반영
    setProjects(currentProjects);

    const message = `액션아이템 처리 완료:\n프로젝트 ${updatedProjectCount}개, 아이템 ${totalItemsCount}개${errorCount > 0 ? `\n오류 ${errorCount}개` : ''}`;
    showSuccess(message);
  };

  const handleBulkUpdateTeamMembers = (teamMembersData) => {
    let updatedProjectCount = 0;
    let totalMembersCount = 0;
    let errorCount = 0;

    // 현재 프로젝트 목록을 복사하여 누적 처리
    let currentProjects = [...projects];

    // project_id별로 그룹화
    const groupedByProject = {};
    teamMembersData.forEach(member => {
      if (!groupedByProject[member.project_id]) {
        groupedByProject[member.project_id] = [];
      }
      groupedByProject[member.project_id].push(member);
    });

    Object.keys(groupedByProject).forEach(projectId => {
      const project = currentProjects.find(p => p.id === projectId);

      if (!project) {
        errorCount++;
        console.warn(`프로젝트를 찾을 수 없습니다: ${projectId}`);
        return;
      }

      const newTeamMembers = groupedByProject[projectId].map((member, index) => ({
        순번: index + 1,  // Auto-assign based on position
        이름: member.이름,
        knoxId: member.knoxId || '',
        부서: member.부서
      }));

      totalMembersCount += newTeamMembers.length;

      // 담당부서목록 추출
      const departmentSet = new Set(newTeamMembers.map(m => m.부서));
      const newDepartmentList = Array.from(departmentSet);

      currentProjects = updateProject(project.id, {
        ...project,
        과제참여인력목록: newTeamMembers,
        담당부서목록: newDepartmentList
      }, currentProjects);

      updatedProjectCount++;
    });

    // 최종 업데이트된 프로젝트 목록을 상태에 반영
    setProjects(currentProjects);

    const message = `팀멤버 처리 완료:\n프로젝트 ${updatedProjectCount}개, 멤버 ${totalMembersCount}명${errorCount > 0 ? `\n오류 ${errorCount}개` : ''}`;
    showSuccess(message);
  };

  const handleBulkAddPerformances = (performancesData) => {
    try {
      if (!performancesData || performancesData.length === 0) {
        showError('추가할 성과 데이터가 없습니다.');
        return;
      }

      let addedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      // 현재 성과 목록을 복사하여 누적 처리
      let currentPerformances = [...globalPerformances];

      performancesData.forEach((perfData) => {
        // 월별 실적 데이터 변환 (실적_1월 ~ 실적_12월 → 월별실적 배열)
        const 월별실적여부 = perfData.월별실적여부 === true || perfData.월별실적여부 === 'TRUE' || perfData.월별실적여부 === 'true';
        const 월별실적 = [
          perfData.실적_1월 || '',
          perfData.실적_2월 || '',
          perfData.실적_3월 || '',
          perfData.실적_4월 || '',
          perfData.실적_5월 || '',
          perfData.실적_6월 || '',
          perfData.실적_7월 || '',
          perfData.실적_8월 || '',
          perfData.실적_9월 || '',
          perfData.실적_10월 || '',
          perfData.실적_11월 || '',
          perfData.실적_12월 || ''
        ];

        const performanceDataToSave = {
          uuid: perfData.uuid,
          id: perfData.id,
          대분류: perfData.대분류,
          소분류: perfData.소분류 || '',
          성과항목: perfData.성과항목,
          성과년도: perfData.성과년도,
          단위: perfData.단위 || '',
          현재수준: perfData.현재수준 || '',
          목표수준: perfData.목표수준 || '',
          월별실적여부: 월별실적여부,
          실적수준: 월별실적여부 ? '' : (perfData.실적수준 || ''),
          월별실적: 월별실적여부 ? 월별실적 : Array(12).fill(''),
          설명: perfData.설명 || '',
          createdAt: perfData.createdAt,
          isActive: perfData.isActive !== undefined ? perfData.isActive : true
        };

        if (perfData.uuid) {
          // UUID가 입력된 경우: 해당 UUID로 기존 성과를 찾아서 수정만 가능
          const existingPerformance = currentPerformances.find(p => p.uuid === perfData.uuid);

          if (existingPerformance) {
            // 기존 성과 업데이트
            currentPerformances = updatePerformance(existingPerformance.id, {
              ...performanceDataToSave,
              uuid: existingPerformance.uuid,
              id: existingPerformance.id,
              createdAt: existingPerformance.createdAt
            }, currentPerformances);
            updatedCount++;
          } else {
            // UUID는 입력했는데 해당하는 성과가 없으면 스킵
            console.warn(`UUID "${perfData.uuid}"에 해당하는 성과를 찾을 수 없습니다. (성과항목: ${perfData.성과항목})`);
            skippedCount++;
          }
        } else {
          // UUID가 입력되지 않은 경우: 신규 성과로 추가 (UUID 자동 생성)
          // addPerformance는 업데이트된 배열을 반환하므로 누적
          currentPerformances = addPerformance(performanceDataToSave, currentPerformances);
          addedCount++;
        }
      });

      // 최종 업데이트된 성과 목록을 상태에 반영
      setGlobalPerformances(currentPerformances);

      // 메타데이터 업데이트
      const updatedMetadata = updateMetadata({ performanceCount: currentPerformances.length });
      setMetadata(updatedMetadata);

      // 결과 메시지
      const messages = [];
      if (addedCount > 0) messages.push(`신규 성과 ${addedCount}개 추가`);
      if (updatedCount > 0) messages.push(`기존 성과 ${updatedCount}개 업데이트`);
      if (skippedCount > 0) messages.push(`⚠️ UUID 미매칭으로 스킵 ${skippedCount}개`);

      const message = messages.length > 0 ?
        `성과 처리 완료:\n${messages.join('\n')}` :
        '처리된 성과가 없습니다.';

      showSuccess(message);

    } catch (error) {
      console.error('성과 벌크 추가 실패:', error);
      showError('성과 추가 중 오류가 발생했습니다: ' + error.message);
    }
  };

  const handleManageSettings = () => {
    setIsSettingsModalOpen(true);
  };

  const handleUpdateSettings = async (newSettingsData) => {
    // DB에 설정 저장
    try {
      await saveSystemSettings(newSettingsData);
      console.log('시스템 설정이 DB에 저장되었습니다.');
    } catch (error) {
      console.error('시스템 설정 DB 저장 실패:', error);
      throw error; // 오류를 상위로 전달하여 사용자에게 알림
    }

    // 사업부 이름 변경 감지
    //
    // (2026-07-31 추가) 원래 여기에 **사업부만 빠져 있었다** — 부서·프로세스·과제구분
    // 셋만 있었다. 그래서 사업부 이름을 바꾸면 과제는 옛 이름으로 남아 목록·간트에 옛
    // 이름이 계속 보이고, 편집창의 사업부가 **미선택**으로 떴다(옵션엔 새 이름뿐인데
    // 과제 값은 옛 이름이라 아무 옵션과도 안 맞는다).
    //
    // 표시보다 권한이 더 문제다. 서버는 `division` 텍스트를 **활성 사업부 이름과 정확히
    // 맞춰** `division_id` 를 푼다(permissions.resolve_division_id). 옛 이름은 어디에도
    // 안 맞아 id 가 None 이 되고, 그러면 can_edit_project 의 manager 분기가 비교 자체를
    // 건너뛴다 → **그 사업부 manager 가 자기 과제를 못 고친다.** 지금은 권한 검사가
    // 사실상 무검사라 안 드러나고, **컷오버 직후에 드러난다.**
    const divisionNameChanges = [];
    if (currentSettingsData.divisions && newSettingsData.divisions) {
      currentSettingsData.divisions.forEach(oldDiv => {
        const newDiv = newSettingsData.divisions.find(d => d.id === oldDiv.id);
        if (newDiv && oldDiv.name !== newDiv.name) {
          divisionNameChanges.push({
            oldName: oldDiv.name,
            newName: newDiv.name
          });
        }
      });
    }

    // 부서 이름 변경 감지
    const departmentNameChanges = [];
    if (currentSettingsData.departments && newSettingsData.departments) {
      currentSettingsData.departments.forEach(oldDept => {
        const newDept = newSettingsData.departments.find(d => d.id === oldDept.id);
        if (newDept && oldDept.name !== newDept.name) {
          departmentNameChanges.push({
            oldName: oldDept.name,
            newName: newDept.name
          });
        }
      });
    }

    // 프로세스 이름 변경 감지
    const processNameChanges = [];
    if (currentSettingsData.processes && newSettingsData.processes) {
      currentSettingsData.processes.forEach(oldProc => {
        const newProc = newSettingsData.processes.find(p => p.id === oldProc.id);
        if (newProc && oldProc.name !== newProc.name) {
          processNameChanges.push({
            oldName: oldProc.name,
            newName: newProc.name
          });
        }
      });
    }

    // 과제 구분 이름 변경 감지
    const taskCategoryNameChanges = [];
    if (currentSettingsData.taskCategories && newSettingsData.taskCategories) {
      currentSettingsData.taskCategories.forEach(oldCat => {
        const newCat = newSettingsData.taskCategories.find(c => c.id === oldCat.id);
        if (newCat && oldCat.name !== newCat.name) {
          taskCategoryNameChanges.push({
            oldName: oldCat.name,
            newName: newCat.name
          });
        }
      });
    }

    // 이름 변경이 있으면 모든 프로젝트 업데이트
    if (divisionNameChanges.length > 0 || departmentNameChanges.length > 0 ||
        processNameChanges.length > 0 || taskCategoryNameChanges.length > 0) {
      const updatedProjects = projects.map(project => {
        let updated = { ...project };
        let hasChanges = false;

        // 사업부 이름 업데이트
        if (divisionNameChanges.length > 0 && updated.사업부) {
          const change = divisionNameChanges.find(c => c.oldName === updated.사업부);
          if (change) {
            updated.사업부 = change.newName;
            hasChanges = true;
          }
        }

        // 부서 이름 업데이트
        if (departmentNameChanges.length > 0) {
          // 과제참여인력목록의 부서 이름 업데이트
          if (updated.과제참여인력목록 && Array.isArray(updated.과제참여인력목록)) {
            updated.과제참여인력목록 = updated.과제참여인력목록.map(person => {
              const change = departmentNameChanges.find(c => c.oldName === person.부서);
              if (change) {
                hasChanges = true;
                return { ...person, 부서: change.newName };
              }
              return person;
            });
          }

          // 담당부서목록의 부서 이름 업데이트
          if (updated.담당부서목록 && Array.isArray(updated.담당부서목록)) {
            updated.담당부서목록 = updated.담당부서목록.map(dept => {
              const change = departmentNameChanges.find(c => c.oldName === dept);
              if (change) {
                hasChanges = true;
                return change.newName;
              }
              return dept;
            });
          }
        }

        // 프로세스 이름 업데이트
        if (processNameChanges.length > 0 && updated.프로세스) {
          const change = processNameChanges.find(c => c.oldName === updated.프로세스);
          if (change) {
            updated.프로세스 = change.newName;
            hasChanges = true;
          }
        }

        // 과제 구분 이름 업데이트
        if (taskCategoryNameChanges.length > 0 && updated.과제구분) {
          const change = taskCategoryNameChanges.find(c => c.oldName === updated.과제구분);
          if (change) {
            updated.과제구분 = change.newName;
            hasChanges = true;
          }
        }

        return hasChanges ? updated : project;
      });

      // 변경사항이 있으면 프로젝트 저장
      const changedCount = updatedProjects.filter((p, i) => p !== projects[i]).length;
      if (changedCount > 0) {
        setProjects(updatedProjects);
        saveProjects(updatedProjects);

        // 사용자에게 알림
        const messages = [];
        if (divisionNameChanges.length > 0) messages.push(`사업부 ${divisionNameChanges.length}개`);
        if (departmentNameChanges.length > 0) messages.push(`부서 ${departmentNameChanges.length}개`);
        if (processNameChanges.length > 0) messages.push(`프로세스 ${processNameChanges.length}개`);
        if (taskCategoryNameChanges.length > 0) messages.push(`과제 구분 ${taskCategoryNameChanges.length}개`);

        // 위 saveProjects 는 **IndexedDB 까지만** 간다. 서버에도 보내지 않으면 화면은
        // 새 이름인데 서버는 옛 이름인 채로 갈라지고, 새로고침에 옛 이름이 돌아온다.
        // 그래서 성공 문구는 **서버 전송이 끝난 뒤에만** 띄운다.
        try {
          const result = await saveSettingsRename({
            projects: updatedProjects,
            performances: globalPerformances,
            beforeProjects: projects
          });

          showSuccess(
            `${messages.join(', ')} 이름이 변경되어 과제 ${changedCount}건이 업데이트되었습니다.`
            + (result?.skipped ? '' : ' (서버 반영 완료)')
          );
        } catch (error) {
          console.error('이름 변경 서버 반영 실패:', error);
          // ⚠️ 여기서 "다시 저장해 주세요" 라고 하면 안 된다 — 설정은 이미 새 이름으로
          //    저장돼서, 다시 저장해도 옛 이름/새 이름 비교에 걸리는 게 없어 캐스케이드가
          //    아예 돌지 않는다. 되돌렸다 다시 바꾸는 것이 유일하게 통하는 방법이다.
          showError(
            `${messages.join(', ')} 이름은 설정에 저장됐지만 과제 반영이 중간에 멈췄습니다: `
            + `${error.message}\n\n`
            + '새로고침하면 서버 기준으로 다시 맞춰집니다. '
            + '남은 과제까지 반영하려면 이름을 원래대로 되돌렸다가 다시 바꿔 주세요.'
          );
        }
      }
    }

    setCurrentSettingsData(newSettingsData);
  };

  // 로컬 저장 (기존 onExportData를 LocalStorageModal로 변경)
  const handleExportData = () => {
    setIsLocalStorageModalOpen(true);
  };

  const handleLocalSaveComplete = () => {
    console.log('로컬 저장 완료');
    showSuccess('파일이 성공적으로 저장되었습니다.');
  };

  // 지식 그래프 내보내기
  const handleExportKnowledgeGraph = () => {
    try {
      console.log('지식 그래프 내보내기 시작');

      const success = exportKnowledgeGraph(projects, globalPerformances, 'knowledge-graph');

      if (success) {
        showSuccess('지식 그래프가 성공적으로 저장되었습니다.');
      } else {
        showError('지식 그래프 저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('지식 그래프 내보내기 실패:', error);
      showError('지식 그래프 저장 중 오류가 발생했습니다: ' + error.message);
    }
  };

  // 지식 그래프 서버 저장 모달 열기
  const handleServerKnowledgeGraphSave = () => {
    setIsServerKnowledgeGraphModalOpen(true);
  };

  // 지식 그래프를 서버에 저장 (모달에서 호출)
  const handleServerKnowledgeGraphSaveConfirm = async (saveOptions) => {
    try {
      console.log('지식 그래프 서버 저장 시작', saveOptions);

      const { name, isPublic, filteredProjects, connectionType } = saveOptions;

      // 연결 유형에 따라 다른 지식 그래프 데이터 생성
      let knowledgeGraphData;
      let graphDescription;

      if (connectionType === 'project-personnel') {
        // 과제-인력 연결
        knowledgeGraphData = generatePersonnelKnowledgeGraphData(filteredProjects);
        graphDescription = `과제-인력 연결 지식 그래프 (노드: ${knowledgeGraphData?.nodes?.length || 0}개, 엣지: ${knowledgeGraphData?.edges?.length || 0}개)`;
      } else {
        // 과제-성과 연결 (기본값)
        knowledgeGraphData = generateKnowledgeGraphData(filteredProjects, globalPerformances);
        graphDescription = `과제-성과 연결 지식 그래프 (노드: ${knowledgeGraphData?.nodes?.length || 0}개, 엣지: ${knowledgeGraphData?.edges?.length || 0}개)`;
      }

      if (!knowledgeGraphData || !knowledgeGraphData.nodes || knowledgeGraphData.nodes.length === 0) {
        showError('저장할 지식 그래프 데이터가 없습니다.');
        return;
      }

      // 새 그래프 생성 (객체 형태로 전달)
      const newGraph = await createGraph({
        name: name,
        description: graphDescription,
        is_public: isPublic
      });

      if (!newGraph || !newGraph.id) {
        showError('그래프 생성에 실패했습니다.');
        return;
      }

      // 그래프 데이터 저장 (객체 형태로 전달)
      await saveGraphData(newGraph.id, {
        nodes: knowledgeGraphData.nodes,
        edges: knowledgeGraphData.edges
      });

      setIsServerKnowledgeGraphModalOpen(false);
      const connectionTypeLabel = connectionType === 'project-personnel' ? '과제-인력' : '과제-성과';
      showSuccess(`지식 그래프가 서버에 저장되었습니다. (${name}, ${connectionTypeLabel} 연결)`);
      console.log('지식 그래프 서버 저장 완료:', newGraph);

    } catch (error) {
      console.error('지식 그래프 서버 저장 실패:', error);
      showError('지식 그래프 서버 저장 중 오류가 발생했습니다: ' + error.message);
    }
  };

  // 스냅샷 관리 모달 열기
  const handleManageSnapshots = () => {
    setIsSnapshotModalOpen(true);
  };

  // 서버로부터 데이터 불러오기
  const handleServerDownload = async () => {
    // 현재 데이터가 있으면 확인 요청
    if (projects.length > 0 || globalPerformances.length > 0) {
      setConfirmDialog({
        isOpen: true,
        title: '서버 데이터 불러오기',
        message: '현재 로컬 데이터가 있습니다. 서버 데이터로 덮어쓰시겠습니까?\n\n(현재 데이터는 손실됩니다)',
        variant: 'warning',
        onConfirm: async () => {
          await executeServerDownload();
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      });
      return;
    }

    await executeServerDownload();
  };

  const executeServerDownload = async (options = {}) => {
    const { silent = false, preserveMetadata = false } = options;
    try {
      const serverData = await downloadServerData();

      if (!serverData || (!serverData.projects?.length && !serverData.performances?.length)) {
        if (!silent) {
          showError('서버에 저장된 데이터가 없습니다.');
        }
        return;
      }

      // 데이터 적용
      setProjects(serverData.projects || []);
      setGlobalPerformances(serverData.performances || []);

      // preserveMetadata가 true이면 metadata는 덮어쓰지 않음 (설정 보존)
      if (serverData.metadata && !preserveMetadata) {
        setMetadata(serverData.metadata);
      }

      // 버전 저장
      localStorage.setItem('dashboardDataVersion', serverData.version.toString());

      // 서버 다운로드 로그 기록 (silent 모드가 아닐 때만)
      if (!silent) {
        const downloadedProjectNames = (serverData.projects || []).map(p => p.과제명).filter(Boolean);
        const downloadedPerformanceNames = (serverData.performances || []).map(p => p.성과항목).filter(Boolean);

        logActivity({
          action: LOG_ACTIONS.SERVER_DOWNLOAD,
          targetType: TARGET_TYPES.PROJECT,
          targetName: `서버 데이터 불러오기 (v${serverData.version})`,
          changes: {
            version: { before: null, after: serverData.version },
            projectCount: { before: null, after: serverData.projects?.length || 0 },
            performanceCount: { before: null, after: serverData.performances?.length || 0 },
            downloadedProjects: { before: null, after: downloadedProjectNames },
            downloadedPerformances: { before: null, after: downloadedPerformanceNames }
          },
          metadata: {
            source: LOG_SOURCES.MODAL,
            preserveMetadata
          }
        });

        showSuccess(`서버 데이터를 불러왔습니다. (v${serverData.version}, 프로젝트 ${serverData.projects?.length || 0}개, 성과 ${serverData.performances?.length || 0}개)`);
      }

    } catch (error) {
      console.error('서버 다운로드 실패:', error);
      if (!silent) {
        showError(`서버 데이터 불러오기 실패: ${error.message}`);
      }
    }
  };

  // 스냅샷 복원
  const handleRestoreSnapshot = (snapshotData) => {
    try {
      // 프로젝트 복원
      if (snapshotData.projects) {
        saveProjects(snapshotData.projects);
        setProjects(snapshotData.projects);
      }

      // 성과 복원
      if (snapshotData.performances) {
        savePerformances(snapshotData.performances);
        setGlobalPerformances(snapshotData.performances);
      }

      // 설정 복원
      if (snapshotData.settings) {
        setCurrentSettingsData(snapshotData.settings);
        localStorage.setItem('digitalTwinDashboardSettings', JSON.stringify(snapshotData.settings));
      }

      // 메타데이터 복원
      if (snapshotData.metadata) {
        saveMetadata(snapshotData.metadata);
        setMetadata(snapshotData.metadata);
      }

      showSuccess('스냅샷이 성공적으로 복원되었습니다.');
    } catch (error) {
      console.error('스냅샷 복원 실패:', error);
      showError('스냅샷 복원 중 오류가 발생했습니다: ' + error.message);
    }
  };

  // 기존 ExportDataModal용 함수 (필요시 사용)
  const handleExportComplete = (exportInfo) => {
    try {
      const formatInfo = exportInfo.format === 'json' ? 'JSON' : 'CSV';
      const message = exportInfo.performanceCount 
        ? `${exportInfo.projectCount}개 프로젝트와 ${exportInfo.performanceCount}개 성과 항목이 ${formatInfo} 형식으로 성공적으로 저장되었습니다.`
        : `${exportInfo.projectCount}개 프로젝트가 ${formatInfo} 형식으로 성공적으로 저장되었습니다.`;
      
      showSuccess(message);
      setIsExportModalOpen(false);
    } catch (error) {
      showError('내보내기 완료 처리 중 오류가 발생했습니다: ' + error.message);
    }
  };

  // 데이터 가져오기
  const handleImportData = () => {
    setIsImportModalOpen(true);
  };

  const handleImportComplete = (importedData) => {
    try {
      console.log('가져온 데이터:', importedData);
      
      // 프로젝트 데이터 처리
      let importedProjects = importedData.projects || [];
      let importedPerformances = importedData.performances || [];
      
      // 프로젝트 데이터 저장
      const savedProjects = saveProjects(importedProjects);
      setProjects(savedProjects);
      
      // 성과 데이터 저장
      const savedPerformances = savePerformances(importedPerformances);
      setGlobalPerformances(savedPerformances);
      
      // 메타데이터 업데이트
      const updatedMetadata = updateMetadata({ 
        projectCount: savedProjects.length,
        performanceCount: savedPerformances.length 
      });
      setMetadata(updatedMetadata);
      
      const message = importedPerformances.length > 0 
        ? `${importedProjects.length}개 프로젝트와 ${importedPerformances.length}개 성과 항목이 성공적으로 가져와졌습니다.`
        : `${importedProjects.length}개 프로젝트가 성공적으로 가져와졌습니다.`;
      
      showSuccess(message);
      setIsImportModalOpen(false);
      
    } catch (error) {
      console.error('데이터 가져오기 실패:', error);
      showError('데이터 가져오기 중 오류가 발생했습니다: ' + error.message);
    }
  };

  // 연도별 과제 삭제 (관리자 전용)
  //
  // 옛 '전체 데이터 삭제'를 대신한다. 그건 `clearAllData()` 로 IndexedDB/localStorage
  // 만 비웠고, 확정은 '서버에 저장'(수동 업로드)이 맡는 2단 동작이었다. 그 업로드
  // 메뉴가 V2 컷오버 때 내려가면서(Header.jsx 주석) **서버에 닿지 않는 버튼**이 됐다 —
  // 눌러도 마운트 시 자동 다운로드가 그대로 되살려 놓는데 화면은 "삭제되었습니다" 라고
  // 말했다. 안 되는 것보다 **됐다고 믿게 만드는 것**이 문제라 경로 자체를 바꾼다.
  const handleClearAllData = () => {
    setIsBulkYearDeleteModalOpen(true);
  };

  // 일괄 삭제/복구 후 로컬 반영.
  //
  // 서버가 지운 uuid 만 골라 `_deleted` 를 켠다 — 로컬을 통째로 비우지 않는 이유는
  // 다른 연도 과제가 그대로 남아야 하고, 휴지통 화면이 이 플래그로 그려지기 때문이다.
  // (개별 삭제 handleConfirmDelete 와 같은 방식)
  const applyBulkDeleteResult = (result) => {
    const uuids = new Set((result?.projects || []).map(p => p.uuid));
    if (uuids.size === 0) return;

    const now = new Date().toISOString();
    const updatedProjects = projects.map(p =>
      uuids.has(p.uuid) ? { ...p, _deleted: true, _deletedAt: now, updatedAt: now } : p
    );
    setProjects(updatedProjects);
    saveProjects(updatedProjects);
    setMetadata(updateMetadata({
      projectCount: updatedProjects.filter(p => !p._deleted).length,
    }));

    logActivity({
      action: LOG_ACTIONS.BULK_DELETE,
      targetType: TARGET_TYPES.PROJECT,
      targetName: `${(result.years || []).map(y => `${y}년`).join(', ')} 과제 일괄 삭제 (${result.count}건)`,
      changes: {
        years: { before: null, after: result.years },
        count: { before: null, after: result.count },
      },
      metadata: { source: LOG_SOURCES.MODAL }
    });
  };

  // 로컬 캐시 비우기 — 복구 도구 (서버는 건드리지 않는다)
  //
  // 왜 남겨두나
  //     이 브라우저에 있는 사본이 서버와 어긋나 화면이 이상해지는 경우가 있다.
  //     저장이 중간에 끊겼거나, 낡은 `dashboardDataVersion` 때문에 저장이 계속
  //     409 로 튕기거나, **다른 포트에서 만든 사본이 남아 있는** 경우다
  //     (localhost:5173 과 localhost:5174 는 origin 이 달라 저장소가 완전히 따로다 —
  //      5173 은 Vite 개발서버, 5174 는 dist 를 서빙하는 Flask 다).
  //
  // 옛 '전체 삭제'가 실제로 하던 일이 바로 이것이었다. 문제는 하는 일이 아니라
  // **이름과 안내**였다 — "모든 데이터 삭제 · 되돌릴 수 없습니다" 라고 해서
  // 서버까지 지운 줄 알게 했다. 동작은 그대로 두고 이름과 문구만 사실에 맞춘다.
  //
  // 비운 뒤 곧바로 서버에서 다시 받는다. 비우기만 하면 빈 화면이 남아서
  // '복구 도구'가 아니라 '고장내는 버튼'이 된다.
  const handleClearLocalCache = () => {
    setConfirmDialog({
      isOpen: true,
      title: '로컬 캐시 비우기',
      message: '이 브라우저에 저장된 사본만 지우고 서버에서 다시 받아옵니다.\n\n'
             + '• 서버 데이터는 그대로입니다 — 다른 사용자에게 영향이 없습니다.\n'
             + '• 화면이 서버와 어긋나 보이거나 저장이 계속 실패할 때 쓰세요.',
      variant: 'warning',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          clearAllData();
          // clearAllData 는 STORAGE_KEYS 3개만 지운다. 저장 충돌 감지에 쓰는 전역
          // 버전은 별도 키라 남는데, 이게 낡으면 저장이 계속 409 로 튕긴다 —
          // '꼬임'의 대표적인 형태라 같이 지운다.
          localStorage.removeItem('dashboardDataVersion');

          // (행 버전 캐시는 settingsApi 의 메모리 Map 이고 다운로드가 통째로
          //  다시 채우므로 여기서 따로 지울 것이 없다)

          const serverData = await downloadServerData();
          const freshProjects = serverData?.projects || [];
          const freshPerformances = serverData?.performances || [];

          saveProjects(freshProjects);
          savePerformances(freshPerformances);
          setProjects(freshProjects);
          setGlobalPerformances(freshPerformances);
          if (serverData?.metadata) setMetadata(serverData.metadata);
          if (serverData?.version) {
            localStorage.setItem('dashboardDataVersion', String(serverData.version));
          }

          showSuccess(`로컬 캐시를 비우고 서버에서 다시 받았습니다. `
                      + `(과제 ${freshProjects.length}개, 성과 ${freshPerformances.length}개)`);
        } catch (error) {
          // 캐시는 이미 비웠는데 다시 받기가 실패한 상태다. 새로고침하면 마운트 시
          // 자동 다운로드가 다시 시도하므로 **그 사실을 알려야** 사용자가 멈추지 않는다.
          console.error('로컬 캐시 비우기 후 재다운로드 실패:', error);
          showError(`캐시는 비웠지만 서버에서 다시 받지 못했습니다: ${error.message} `
                    + `— 새로고침하면 다시 시도합니다.`);
        }
      }
    });
  };

  const applyBulkRestoreResult = (result) => {
    const uuids = new Set((result?.projects || []).map(p => p.uuid));
    if (uuids.size === 0) return;

    const now = new Date().toISOString();
    const updatedProjects = projects.map(p => {
      if (!uuids.has(p.uuid)) return p;
      const { _deleted, _deletedAt, _deletedBy, _deletedByName, ...rest } = p;
      return { ...rest, updatedAt: now };
    });
    setProjects(updatedProjects);
    saveProjects(updatedProjects);
    setMetadata(updateMetadata({
      projectCount: updatedProjects.filter(p => !p._deleted).length,
    }));
  };


  // 모든 첨부파일 다운로드 (관리자 전용)
  const handleDownloadAllAttachments = async () => {
    try {
      showSuccess('모든 첨부파일 다운로드를 시작합니다...');
      await downloadAllAttachments();
      showSuccess('모든 첨부파일이 다운로드되었습니다.');
    } catch (error) {
      console.error('첨부파일 다운로드 실패:', error);
      showError(error.message || '첨부파일 다운로드 중 오류가 발생했습니다.');
    }
  };

  // 전체 과제 액션아이템/액티비티 생성 날짜 일괄 채우기 (관리자 전용)
  // - createdAt 이 없는 액션아이템/세부항목에 대해
  //   ①id 가 ms 타임스탬프면 그것을 ISO 로 변환, ②아니면 상위 항목의 createdAt 사용
  // - 완료 후 서버에 자동 업로드
  const handleBackfillAllCreatedAt = () => {
    if (!projects || projects.length === 0) {
      showError('과제 데이터가 없습니다.');
      return;
    }

    const idToIso = (id) => {
      if (typeof id === 'number' && id > 1e12) {
        return new Date(id).toISOString();
      }
      return null;
    };

    let projectsChanged = 0;
    let actionItemsFilled = 0;
    let detailItemsFilled = 0;
    let skippedNoSource = 0;

    const backfilledProjects = projects.map(project => {
      const projectCreatedAt = project?.createdAt || null;
      const actionItems = project.액션아이템목록 || [];
      if (actionItems.length === 0) return project;

      let projectMutated = false;

      const newActionItems = actionItems.map(item => {
        let nextItem = item;

        // 액션아이템 createdAt 백필
        if (!item.createdAt) {
          const filled = idToIso(item.id) || projectCreatedAt;
          if (filled) {
            nextItem = { ...nextItem, createdAt: filled };
            actionItemsFilled++;
            projectMutated = true;
          } else {
            skippedNoSource++;
          }
        }

        // 세부항목(액티비티) createdAt 백필
        const details = nextItem.세부항목목록 || [];
        if (details.length > 0) {
          let detailsMutated = false;
          const parentCreatedAt = nextItem.createdAt || projectCreatedAt;

          const newDetails = details.map(detail => {
            if (detail.createdAt) return detail;
            const filled = idToIso(detail.id) || parentCreatedAt;
            if (filled) {
              detailItemsFilled++;
              detailsMutated = true;
              return { ...detail, createdAt: filled };
            }
            skippedNoSource++;
            return detail;
          });

          if (detailsMutated) {
            nextItem = { ...nextItem, 세부항목목록: newDetails };
            projectMutated = true;
          }
        }

        return nextItem;
      });

      if (projectMutated) {
        projectsChanged++;
        return { ...project, 액션아이템목록: newActionItems };
      }
      return project;
    });

    if (actionItemsFilled === 0 && detailItemsFilled === 0) {
      setAlertDialog({
        isOpen: true,
        title: '생성 날짜 일괄 채우기',
        message: skippedNoSource > 0
          ? `채울 수 있는 항목이 없습니다.\n\n참조할 날짜(부모 과제 createdAt / id 타임스탬프)가 없는 항목 ${skippedNoSource}개를 건너뛰었습니다.`
          : '모든 액션아이템/액티비티에 이미 생성 날짜가 설정되어 있습니다.',
        variant: 'info'
      });
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: '생성 날짜 일괄 채우기 (전체 과제)',
      message:
        `다음 항목의 생성 날짜를 일괄로 채우고 서버에 업로드합니다.\n\n` +
        `• 영향 받는 과제: ${projectsChanged}개\n` +
        `• 액션아이템 채움: ${actionItemsFilled}개\n` +
        `• 액티비티 채움: ${detailItemsFilled}개` +
        (skippedNoSource > 0 ? `\n• 참조 날짜 없어 건너뜀: ${skippedNoSource}개` : '') +
        `\n\n계속하시겠습니까?`,
      variant: 'warning',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          setProjects(backfilledProjects);

          // 활동 로그 기록
          logActivity({
            action: LOG_ACTIONS.BULK_UPDATE,
            targetType: TARGET_TYPES.ACTION_ITEM,
            targetId: null,
            targetName: `전체 과제 생성 날짜 일괄 채우기`,
            changes: {
              영향받은과제수: { before: null, after: projectsChanged },
              액션아이템채움수: { before: null, after: actionItemsFilled },
              액티비티채움수: { before: null, after: detailItemsFilled }
            },
            metadata: { source: LOG_SOURCES.BULK_EDIT }
          });
          // 서버 업로드 — 버전 송수신은 어댑터가 맡는다.
          // beforeProjects 로 "무엇이 실제로 채워졌나" 를 가려낸다.
          // backfilledProjects 는 전 과제를 담고 있지만 대부분은 그대로다.
          await saveCreatedAtBackfill({
            projects: backfilledProjects,
            performances: globalPerformances,
            metadata: metadata,
            activityLogs: recentActivityLogs(1),
            beforeProjects: projects
          });

          showSuccess(
            `생성 날짜 일괄 채우기 완료 (과제 ${projectsChanged}개, 액션아이템 ${actionItemsFilled}개, 액티비티 ${detailItemsFilled}개). 서버에 업로드되었습니다.`
          );

          // 서버 최신 데이터 동기화
          await executeServerDownload({ silent: true, preserveMetadata: true });
        } catch (error) {
          console.error('생성 날짜 일괄 채우기 실패:', error);
          showError('일괄 채우기 중 오류가 발생했습니다: ' + error.message);
        }
      }
    });
  };

  // 모달 닫기 함수들
  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedProject(null);
    setEditModalAutoOpenDetail(false);
  };

  const handleCloseDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setSelectedProject(null);
  };

  // 컨텐츠 렌더링
  const renderContent = () => {
    // 레거시 형식으로 변환된 프로젝트 데이터 (기존 컴포넌트 호환성)
    // 가시성 범위(공개만/사업부 내 포함) 필터를 단일 진입점에서 적용
    const legacyProjects = filterByVisibility(
      convertProjectsToLegacyFormat(projects, globalPerformances)
    );

    // 삭제되지 않은 과제만 필터링 (GanttChart, 대시보드 overview 등에서 사용)
    const activeProjects = legacyProjects.filter(p => !p._deleted);

    // DX KPI 연결 매트릭스 — 대시보드의 서브탭이지만 DashboardView 를 타지 않는다.
    // 그 파일이 12,000줄이라 여기서 갈라 두는 편이 유지보수에 낫고,
    // 매트릭스는 자기 데이터를 서버에서 직접 받아 오므로 넘길 것도 없다.
    if (viewMode === 'dashboard' && dashboardSubTab === 'kpiMatrix') {
      return (
        <motion.div
          key="kpiMatrix"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          style={{ width: '100%', height: '100%' }}
        >
          {/*
            매트릭스는 서버에서 자기 데이터를 직접 받는다 — 셀 숫자가 화면 상태와
            어긋나면 안 되기 때문이다(보고에 쓰이는 숫자다). 여기서는 연도만 넘긴다.
            드릴다운에서 과제를 열 때만 로컬 목록에서 원본을 찾아 편집창에 넘긴다.
          */}
          <KpiMatrixView
            currentYear={currentYear}
            onYearChange={setCurrentYear}
            reloadSignal={kpiReloadSignal}
            onOpenProject={(p) => {
              const full = projects.find(x => x.uuid === p.uuid || x.id === p.code);
              if (full) handleEditProject(full);
            }}
          />
        </motion.div>
      );
    }

    if (viewMode === 'dashboard') {
      return (
        <motion.div
          key={viewMode}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{ width: '100%', height: '100%' }}
        >
          <DashboardView
            projects={legacyProjects}
            statusColors={STATUS_COLORS}
            divisionColors={DIVISION_COLORS}
            globalPerformances={globalPerformances}
            subTab={dashboardSubTab}
            currentYear={currentYear}
            onYearChange={setCurrentYear}
            settingsData={currentSettingsData}
            onRestoreProject={handleRestoreProject}
            onPermanentDeleteProject={handlePermanentDeleteProject}
            columnSettings={currentSettingsData.groupedViewColumnSettings}
            onColumnSettingsChange={handleColumnSettingsChange}
            pivotSettings={currentSettingsData.pivotViewSettings}
            onPivotSettingsChange={handlePivotSettingsChange}
            onEditPerformance={handleEditPerformance}
            onLinkProjectToPerformance={handleLinkProjectToPerformance}
            onEditProject={handleEditProject}
          />
        </motion.div>
      );
    } else {
      return (
        <motion.div
          key={viewMode}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{ width: '100%', height: '100%' }}
        >
          <GanttChart
            projects={activeProjects}
            statusColors={STATUS_COLORS}
            divisionColors={DIVISION_COLORS}
            onYearChange={setCurrentYear}
            currentYear={currentYear}
            onEditProject={handleEditProject}
            onDeleteProject={handleDeleteProject}
            settingsData={currentSettingsData}
            globalPerformances={globalPerformances}
            onAddPerformance={handleAddPerformance}
            onAddProject={handleAddProject}
          />
        </motion.div>
      );
    }
  };
  
  return (
    <Container>
      <Header
        onGoHome={() => window.location.href = '/'}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        dashboardSubTab={dashboardSubTab}
        onDashboardSubTabChange={setDashboardSubTab}
        onAddProject={handleAddProject}
        onAddMultipleProjects={handleAddMultipleProjects}
        onEditContributions={handleEditContributions}
        onAddPerformance={handleAddPerformance}
        onManageSettings={handleManageSettings}
        onExportData={handleExportData}
        onImportData={handleImportData}
        onExportKnowledgeGraph={handleExportKnowledgeGraph}
        onClearAllData={handleClearAllData}
        onClearLocalCache={handleClearLocalCache}
        // onLoadSampleData={handleLoadSampleData}  // 샘플 데이터 버튼 비활성화
        onManageSnapshots={handleManageSnapshots}
        onViewActivityLog={() => setIsActivityLogOpen(true)}
        onServerUpload={() => setIsServerUploadModalOpen(true)}
        onServerDownload={handleServerDownload}
        onServerKnowledgeGraphSave={handleServerKnowledgeGraphSave}
        onDownloadAllAttachments={handleDownloadAllAttachments}
        onBackfillAllCreatedAt={handleBackfillAllCreatedAt}
        onAuditMembers={() => setIsMemberAuditOpen(true)}
        onGenerateReport={() => setIsReportModalOpen(true)}
        onGeneratePdfReport={() => setIsPdfReportModalOpen(true)}
      />

      {/* 재검토 요청 알림 팝업 (작성자 본인 · 로그인 시) */}
      {reportRejectPopup.length > 0 && (
        <div
          onClick={dismissReportRejectPopup}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '0.75rem', width: 'min(520px, 92vw)', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden' }}
          >
            <div style={{ padding: '1rem 1.25rem', background: '#fef2f2', borderBottom: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.2rem' }}>⚠️</span>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#991b1b' }}>재검토 요청 알림 ({reportRejectPopup.length})</div>
            </div>
            <div style={{ padding: '1rem 1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div style={{ fontSize: '0.85rem', color: '#475569' }}>담당하신 보고서에 재검토 요청이 있습니다. 사유를 확인하고 보고서를 보완해 주세요.</div>
              {reportRejectPopup.map(({ project, seal }) => (
                <div
                  key={project.uuid || project.id}
                  style={{ padding: '0.7rem 0.85rem', border: '1px solid #fecaca', background: '#fff', borderLeft: '4px solid #ef4444', borderRadius: '0.5rem' }}
                >
                  <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.9rem' }}>{project.과제명} <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 500 }}>· {project.사업부 || ''}</span></div>
                  <div style={{ marginTop: '0.25rem', fontSize: '0.82rem', color: '#991b1b' }}>
                    사유: {seal.comment || '(사유 미기재)'}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                onClick={dismissReportRejectPopup}
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 600, color: '#475569', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '0.5rem', cursor: 'pointer' }}
              >닫기</button>
              <button
                onClick={goToReportFromPopup}
                style={{ padding: '0.5rem 1.1rem', fontSize: '0.85rem', fontWeight: 700, color: '#fff', background: '#dc2626', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}
              >결과 보고서로 이동</button>
            </div>
          </div>
        </div>
      )}

      <Content viewMode={viewMode}>
        {renderContent()}
      </Content>
      
      {/* 알림 메시지 */}
      {notification && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          style={{
            position: 'fixed',
            top: '80px',
            right: '20px',
            background: '#10b981',
            color: 'white',
            padding: '1rem 1.5rem',
            borderRadius: '0.5rem',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 1001,
            maxWidth: '400px',
            fontSize: '0.875rem',
            lineHeight: '1.4'
          }}
        >
          {notification}
        </motion.div>
      )}
      
      {/* 모달들 */}
      <AddProjectModal
        isOpen={isAddModalOpen}
        onClose={handleCloseAddModal}
        onSubmit={handleSubmitProject}
        onSubmitAndUpload={handleSubmitProjectAndUpload}
        currentYear={currentYear}
        settingsData={currentSettingsData}
        existingProjects={projects}
        globalPerformances={globalPerformances}
        onSubmitPerformance={handleSubmitPerformance}
      />
      
      <BulkAddModal
        isOpen={isBulkAddModalOpen}
        onClose={() => setIsBulkAddModalOpen(false)}
        onApply={handleBulkAddProjects}
        onApplyAndUpload={handleBulkAddProjectsAndUpload}
        existingProjects={projects}
        globalPerformances={globalPerformances}
        settingsData={currentSettingsData}
      />

      <ContributionEditModal
        isOpen={isContributionEditModalOpen}
        onClose={() => setIsContributionEditModalOpen(false)}
        globalPerformances={globalPerformances}
        projects={projects}
        divisionColors={DIVISION_COLORS}
        performanceCategories={currentSettingsData.performanceCategories || []}
        onSave={handleSaveContributions}
        onSaveAndUpload={handleSaveContributionsAndUpload}
      />

      <AddPerformanceModal
        isOpen={isAddPerformanceModalOpen}
        onClose={() => {
          setIsAddPerformanceModalOpen(false);
          setSelectedPerformanceForEdit(null);
        }}
        onSubmit={handleSubmitPerformance}
        onSubmitAndUpload={handleSubmitPerformanceAndUpload}
        onDelete={handleDeletePerformance}
        settingsData={currentSettingsData}
        globalPerformances={globalPerformances}
        showSuccess={showSuccess}
        showError={showError}
        initialPerformanceToEdit={selectedPerformanceForEdit}
        currentYear={currentYear}
      />
      
      <EditProjectModal
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        onSubmit={handleUpdateProject}
        onSubmitAndUpload={handleUpdateProjectAndUpload}
        // 2026-08-01 서버 경로로 연결 — 예전엔 handleSubmitProject(로컬 전용)였다.
        // 컷오버로 '서버에 저장' 일괄 업로드가 없어져서, 로컬에만 저장하면
        // 복제해 만든 과제가 새로고침에 통째로 사라진다.
        onSaveAsNew={handleSubmitProjectAndUpload}
        project={selectedProject}
        currentYear={currentYear}
        settingsData={currentSettingsData}
        globalPerformances={globalPerformances}
        onSubmitPerformance={handleSubmitPerformance}
        allProjects={projects}
        onNavigate={handleNavigateProject}
        autoOpenDetailInfo={editModalAutoOpenDetail}
      />
      
      <DeleteConfirmModal 
        isOpen={isDeleteModalOpen}
        onClose={handleCloseDeleteModal}
        onConfirm={handleConfirmDelete}
        project={selectedProject}
      />
      
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settingsData={currentSettingsData}
        onUpdateSettings={handleUpdateSettings}
        showSuccess={showSuccess}
        showError={showError}
      />

      <ImportDataModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImportComplete}
        existingProjects={projects}
        existingPerformances={globalPerformances}
      />

      <ExportDataModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        projects={projects}
        performances={globalPerformances}
        onExportComplete={handleExportComplete}
      />

      {/* 새로 추가된 LocalStorageModal */}
      <LocalStorageModal
        isOpen={isLocalStorageModalOpen}
        onClose={() => setIsLocalStorageModalOpen(false)}
        projects={projects}
        performances={globalPerformances}
        settingsData={currentSettingsData}
        onSaveComplete={handleLocalSaveComplete}
      />

      {/* 스냅샷 관리 모달 */}
      {/*
        참여인력 계정 점검 (설정 ▸ 관리자 구역).
        knoxId 를 고치면 **서버의 members_json 만** 바뀌고 화면이 든 `projects` 는 낡는다.
        그대로 두면 그 과제를 열었을 때 옛 knoxId 가 보이고 배지도 틀린다 —
        그래서 적용 후 서버 데이터를 조용히 다시 받는다.
      */}
      <MemberAuditModal
        isOpen={isMemberAuditOpen}
        onClose={() => setIsMemberAuditOpen(false)}
        onApplied={() => executeServerDownload({ silent: true })}
        showSuccess={showSuccess}
        showError={showError}
      />

      <SnapshotModal
        isOpen={isSnapshotModalOpen}
        onClose={() => setIsSnapshotModalOpen(false)}
        projects={projects}
        performances={globalPerformances}
        settings={currentSettingsData}
        metadata={metadata}
        onRestore={handleRestoreSnapshot}
        showSuccess={showSuccess}
        showError={showError}
      />

      {/* 액티비티 로그 모달 */}
      <ActivityLogModal
        isOpen={isActivityLogOpen}
        onClose={() => setIsActivityLogOpen(false)}
      />

      {/* 서버 업로드 모달 */}
      <ServerUploadModal
        isOpen={isServerUploadModalOpen}
        onClose={() => setIsServerUploadModalOpen(false)}
        projects={projects}
        performances={globalPerformances}
        metadata={metadata}
        onUploadSuccess={(result) => {
          console.log('서버 업로드 성공:', result);
        }}
        showSuccess={showSuccess}
        showError={showError}
      />

      {/* 연도별 과제 삭제 모달 (관리자 전용 — 서버에 실제로 반영된다) */}
      <BulkYearDeleteModal
        isOpen={isBulkYearDeleteModalOpen}
        onClose={() => setIsBulkYearDeleteModalOpen(false)}
        onDeleted={applyBulkDeleteResult}
        onRestored={applyBulkRestoreResult}
        showSuccess={showSuccess}
        showError={showError}
      />

      {/* 서버 지식 그래프 저장 모달 */}
      <ServerKnowledgeGraphModal
        isOpen={isServerKnowledgeGraphModalOpen}
        onClose={() => setIsServerKnowledgeGraphModalOpen(false)}
        onSave={handleServerKnowledgeGraphSaveConfirm}
        projects={projects}
        performances={globalPerformances}
        settingsData={currentSettingsData}
      />

      {/* PPT 보고서 모달 */}
      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        projects={projects}
        settingsData={currentSettingsData}
        showSuccess={showSuccess}
        showError={showError}
      />

      {/* PDF 보고서 모달 (HTML→PDF, 자동 페이지네이션) */}
      <ReportPdfModal
        isOpen={isPdfReportModalOpen}
        onClose={() => setIsPdfReportModalOpen(false)}
        projects={projects}
        settingsData={currentSettingsData}
        showSuccess={showSuccess}
        showError={showError}
      />

      {/* 공통 다이얼로그 */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
      />

      <AlertDialog
        isOpen={alertDialog.isOpen}
        onClose={() => setAlertDialog(prev => ({ ...prev, isOpen: false }))}
        title={alertDialog.title}
        message={alertDialog.message}
        variant={alertDialog.variant}
      />

      {/* 2026-08-01 AiChatSidebar 를 내렸다 — 아래 AI 에이전트와 채팅창이 둘이 되어
          사용자가 어느 쪽에 물어야 하는지 알 수 없었다. 진입점만 없앴고 컴포넌트와
          백엔드(`/api/ai/*`·`/llm` 프록시)는 그대로다. 되살리려면 이 주석을 되돌린다.
          <AiChatSidebar pageName="dashboard" /> */}

      {/* AI 에이전트 (도구로 과제를 조회·수정) — **관리자만**.
          화면을 숨기는 것은 안내일 뿐이고, 관문은 서버가 잡는다
          (`/api/dt-v2/ai/agent` 가 admin 아니면 403). */}
      {(user?.role === 'admin' || user?.is_admin) && <AiAgentPanel />}
    </Container>
  );
};

export default DigitalTwinDashboardApp;