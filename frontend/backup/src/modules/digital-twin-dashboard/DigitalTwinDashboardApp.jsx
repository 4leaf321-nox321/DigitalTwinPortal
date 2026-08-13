import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

// Components
import Header from './components/Layout/Header';
import GanttChart from './components/GanttChart/GanttChart';
import DashboardView from './components/Dashboard/DashboardView';
import AddProjectModal from './components/ProjectModal/AddProjectModal';
import EditProjectModal from './components/ProjectModal/EditProjectModal';
import DeleteConfirmModal from './components/ProjectModal/DeleteConfirmModal';
import SettingsModal from './components/SettingsPanel/SettingsModal';
import ImportDataModal from './components/ImportExport/ImportDataModal';
import ExportDataModal from './components/ImportExport/ExportDataModal';
import LocalStorageModal from './components/ImportExport/LocalStorageModal';
import BulkAddModal from './components/BulkAddModal/BulkAddModal';
import AddPerformanceModal from './components/PerformanceModal/AddPerformanceModal';

// Data and Utils - 새로운 구조
import { 
  loadMetadata, 
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
  clearAllData,
  createBackup,
  validateData,
  migrateLegacyData
} from './utils/dataStructure';

import { 
  convertProjectsToLegacyFormat,
  getProjectPerformancesWithData,
  getAllProjectsWithPerformanceData
} from './utils/projectPerformanceLink';

import { 
  sampleProjects, 
  samplePerformances, 
  sampleMetadata,
  STATUS_COLORS, 
  DIVISION_COLORS, 
  settingsData 
} from './data/sampleDataV2';

// 기존 샘플 데이터와의 호환성을 위한 임포트
import { sampleProjects as legacySampleProjects } from './data/sampleData';

const Container = styled.div`
  background: #ECEFF1;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: visible;
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
  min-height: calc(100vh - 80px);
  
  ${props => props.viewMode === 'gantt' && `
    align-items: stretch;
    padding: 1rem;
    height: calc(100vh - 80px);
  `}
  
  ${props => props.viewMode === 'dashboard' && `
    padding: 0;
    min-height: calc(100vh - 80px);
  `}
`;

const DigitalTwinDashboardApp = () => {
  // 기본 상태
  const [viewMode, setViewMode] = useState('dashboard');
  const [metadata, setMetadata] = useState(null);
  const [projects, setProjects] = useState([]);
  const [globalPerformances, setGlobalPerformances] = useState([]);
  const [currentSettingsData, setCurrentSettingsData] = useState(settingsData);
  const [currentYear, setCurrentYear] = useState(2025);
  const [notification, setNotification] = useState('');
  
  // 모달 상태
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkAddModalOpen, setIsBulkAddModalOpen] = useState(false);
  const [isAddPerformanceModalOpen, setIsAddPerformanceModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isLocalStorageModalOpen, setIsLocalStorageModalOpen] = useState(false); // 새로 추가
  const [selectedProject, setSelectedProject] = useState(null);

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    initializeData();
  }, []);

  // 메타데이터 변경 감지하여 연도 업데이트
  useEffect(() => {
    if (metadata?.settings?.currentYear) {
      setCurrentYear(metadata.settings.currentYear);
    }
  }, [metadata]);

  // 데이터 초기화 함수
  const initializeData = async () => {
    try {
      console.log('디지털 트윈 대시보드 데이터 초기화 시작...');
      
      // 메타데이터 로드
      let loadedMetadata = loadMetadata();
      console.log('메타데이터 로드:', loadedMetadata);
      
      // 프로젝트 및 성과 로드
      let loadedProjects = loadProjects();
      let loadedPerformances = loadPerformances();
      
      console.log(`로드된 데이터: 프로젝트 ${loadedProjects.length}개, 성과 ${loadedPerformances.length}개`);
      
      // 데이터가 없으면 마이그레이션 시도 또는 샘플 데이터 로드
      if (loadedProjects.length === 0 && loadedPerformances.length === 0) {
        console.log('저장된 데이터가 없음 - 레거시 데이터 확인 중...');
        
        // 레거시 데이터 확인 (기존 로컬스토리지에서)
        const legacyData = localStorage.getItem('digitalTwinDashboard_projects');
        
        if (legacyData) {
          try {
            const legacyProjects = JSON.parse(legacyData);
            console.log(`레거시 데이터 발견: ${legacyProjects.length}개 프로젝트`);
            
            // 레거시 데이터 마이그레이션
            const migratedData = migrateLegacyData(legacyProjects);
            loadedProjects = migratedData.projects;
            loadedPerformances = migratedData.performances;
            loadedMetadata = migratedData.metadata;
            
            console.log(`마이그레이션 완료: 프로젝트 ${loadedProjects.length}개, 성과 ${loadedPerformances.length}개`);
            showSuccess(`레거시 데이터가 새로운 구조로 마이그레이션되었습니다. (프로젝트 ${loadedProjects.length}개, 성과 ${loadedPerformances.length}개)`);
            
          } catch (error) {
            console.error('레거시 데이터 마이그레이션 실패:', error);
            console.log('샘플 데이터로 초기화');
            await initializeSampleData();
            return;
          }
        } else {
          console.log('레거시 데이터 없음 - 샘플 데이터로 초기화');
          await initializeSampleData();
          return;
        }
      } else if (loadedProjects.length > 0 && loadedPerformances.length === 0) {
        // 프로젝트는 있지만 성과가 없는 경우 - 데이터 일관성 문제
        console.warn('프로젝트는 있지만 성과 데이터가 없음 - 샘플 성과 데이터 초기화');
        loadedPerformances = [...samplePerformances];
        savePerformances(loadedPerformances);
      }
      
      // 데이터 검증
      const validation = validateData();
      if (!validation.isValid) {
        console.warn('데이터 검증 실패:', validation.errors);
        showError(`데이터 검증 중 ${validation.errors.length}개의 오류가 발견되었습니다.`);
      }
      
      // 상태 업데이트
      setMetadata(loadedMetadata);
      setProjects(loadedProjects);
      setGlobalPerformances(loadedPerformances);
      setViewMode(loadedMetadata.settings?.viewMode || 'dashboard');
      
      console.log('데이터 초기화 완료');
      
    } catch (error) {
      console.error('데이터 초기화 실패:', error);
      showError('데이터 로드 중 오류가 발생했습니다: ' + error.message);
      
      // 실패 시 샘플 데이터로 복구
      await initializeSampleData();
    }
  };

  // 샘플 데이터 초기화
  const initializeSampleData = async () => {
    try {
      console.log('샘플 데이터 초기화 시작...');
      
      // 샘플 데이터 저장
      const savedProjects = saveProjects(sampleProjects);
      const savedPerformances = savePerformances(samplePerformances);
      const savedMetadata = saveMetadata(sampleMetadata);
      
      // 상태 업데이트
      setProjects(savedProjects);
      setGlobalPerformances(savedPerformances);
      setMetadata(savedMetadata);
      
      console.log(`샘플 데이터 초기화 완료: 프로젝트 ${savedProjects.length}개, 성과 ${savedPerformances.length}개`);
      showSuccess(`샘플 데이터로 초기화되었습니다. (프로젝트 ${savedProjects.length}개, 성과 ${savedPerformances.length}개)`);
      
    } catch (error) {
      console.error('샘플 데이터 초기화 실패:', error);
      showError('샘플 데이터 초기화 중 오류가 발생했습니다: ' + error.message);
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

  // 알림 메시지 함수들
  const showSuccess = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(''), 4000);
  };

  const showError = (message) => {
    alert(message);
  };

  // ============ 프로젝트 관리 함수들 ============

  const handleAddProject = () => {
    setIsAddModalOpen(true);
  };

  const handleSubmitProject = (newProjectData) => {
    try {
      const updatedProjects = addProject(newProjectData);
      setProjects(updatedProjects);
      
      // 메타데이터 업데이트
      const updatedMetadata = updateMetadata({ projectCount: updatedProjects.length });
      setMetadata(updatedMetadata);
      
      showSuccess(`새 프로젝트 "${newProjectData.과제명}"이 추가되었습니다.`);
      console.log('새 과제가 추가되었습니다:', newProjectData);
    } catch (error) {
      showError('프로젝트 추가 중 오류가 발생했습니다: ' + error.message);
    }
  };

  const handleEditProject = (project) => {
    setSelectedProject(project);
    setIsEditModalOpen(true);
  };

  const handleUpdateProject = (updatedProjectData) => {
    try {
      const updatedProjects = updateProject(updatedProjectData.id, updatedProjectData);
      setProjects(updatedProjects);
      
      showSuccess(`프로젝트 "${updatedProjectData.과제명}"이 업데이트되었습니다.`);
      console.log('과제가 업데이트되었습니다:', updatedProjectData);
    } catch (error) {
      showError('프로젝트 업데이트 중 오류가 발생했습니다: ' + error.message);
    }
  };

  const handleDeleteProject = (project) => {
    setSelectedProject(project);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = (projectToDelete) => {
    try {
      const updatedProjects = deleteProject(projectToDelete.id);
      setProjects(updatedProjects);
      
      // 메타데이터 업데이트
      const updatedMetadata = updateMetadata({ projectCount: updatedProjects.length });
      setMetadata(updatedMetadata);
      
      showSuccess(`프로젝트 "${projectToDelete.과제명}"이 삭제되었습니다.`);
      console.log('과제가 삭제되었습니다:', projectToDelete);
    } catch (error) {
      showError('프로젝트 삭제 중 오류가 발생했습니다: ' + error.message);
    }
  };

  // ============ 성과 관리 함수들 ============

  const handleAddPerformance = () => {
    setIsAddPerformanceModalOpen(true);
  };

  const handleSubmitPerformance = (performanceData) => {
    try {
      let updatedPerformances;
      
      if (performanceData.isEditing) {
        // 수정 모드
        updatedPerformances = updatePerformance(performanceData.id, performanceData);
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

        updatedPerformances = addPerformance(performanceData);
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

  const handleDeletePerformance = (performanceId) => {
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

      // 이 성과 항목을 사용하는 모든 프로젝트에서 해당 성과 제거
      const updatedProjects = projects.map(project => {
        if (project.성과목록 && project.성과목록.length > 0) {
          const filteredPerformances = project.성과목록.filter(perfRef => {
            const perfId = typeof perfRef === 'string' ? perfRef : perfRef.id;
            return perfId !== performanceId;
          });
          
          // 성과가 삭제된 경우 로그 출력
          if (filteredPerformances.length !== project.성과목록.length) {
            console.log(`프로젝트 "${project.과제명}"에서 성과 "${performanceToDelete.성과항목}" 제거됨`);
          }
          
          return {
            ...project,
            성과목록: filteredPerformances
          };
        }
        return project;
      });

      // 글로벌 성과 목록에서 제거
      const updatedPerformances = deletePerformance(performanceId);
      
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
      
      showSuccess(`성과 항목 "${performanceToDelete.성과항목}"이 삭제되었습니다.`);
      console.log('성과 항목 삭제 완료:', performanceToDelete);
      
    } catch (error) {
      console.error('성과 항목 삭제 실패:', error);
      showError('성과 항목 삭제 중 오류가 발생했습니다: ' + error.message);
    }
  };

  // ============ 기타 기능들 ============

  const handleAddMultipleProjects = () => {
    setIsBulkAddModalOpen(true);
  };

  const handleBulkAddProjects = (bulkData) => {
    try {
      const { projects: projectsData } = bulkData;
      
      if (!projectsData || projectsData.length === 0) {
        showError('추가할 프로젝트 데이터가 없습니다.');
        return;
      }

      let addedCount = 0;
      let updatedCount = 0;
      
      projectsData.forEach((projectData) => {
        const existingProject = projects.find(p => p.id === projectData.id);
        
        if (existingProject) {
          // 기존 프로젝트 업데이트
          updateProject(projectData.id, projectData);
          updatedCount++;
        } else {
          // 새 프로젝트 추가
          const finalProjectId = projectData.id || generateNextProjectId(projectData.사업부);
          addProject({ ...projectData, id: finalProjectId });
          addedCount++;
        }
      });
      
      // 업데이트된 프로젝트 목록 다시 로드
      const updatedProjects = loadProjects();
      setProjects(updatedProjects);
      
      // 메타데이터 업데이트
      const updatedMetadata = updateMetadata({ projectCount: updatedProjects.length });
      setMetadata(updatedMetadata);
      
      setIsBulkAddModalOpen(false);
      
      // 결과 요약
      const summary = [];
      if (addedCount > 0) summary.push(`신규 프로젝트 ${addedCount}개`);
      if (updatedCount > 0) summary.push(`프로젝트 업데이트 ${updatedCount}개`);
      
      const message = summary.length > 0 ? 
        `데이터 처리 완료:\n${summary.join('\n')}` :
        '처리된 데이터가 없습니다.';
        
      showSuccess(message);
      
    } catch (error) {
      console.error('벌크 추가 실패:', error);
      showError('과제 추가 중 오류가 발생했습니다: ' + error.message);
    }
  };

  const handleManageSettings = () => {
    setIsSettingsModalOpen(true);
  };

  const handleUpdateSettings = (newSettingsData) => {
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

  // 전체 데이터 삭제
  const handleClearAllData = () => {
    try {
      if (window.confirm('정말로 모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
        clearAllData();
        
        // 상태 초기화
        setProjects([]);
        setGlobalPerformances([]);
        setMetadata(loadMetadata()); // 기본 메타데이터로 재설정
        
        showSuccess('모든 데이터가 삭제되었습니다.');
        console.log('All data cleared');
      }
    } catch (error) {
      showError('데이터 삭제 중 오류가 발생했습니다: ' + error.message);
    }
  };

  // 백업 생성
  const handleCreateBackup = () => {
    try {
      const success = createBackup();
      if (success) {
        const updatedMetadata = updateMetadata({ lastBackupDate: new Date().toISOString() });
        setMetadata(updatedMetadata);
        showSuccess('데이터 백업이 성공적으로 생성되었습니다.');
      } else {
        showError('백업 생성 중 오류가 발생했습니다.');
      }
    } catch (error) {
      showError('백업 생성 중 오류가 발생했습니다: ' + error.message);
    }
  };

  // 모달 닫기 함수들
  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedProject(null);
  };

  const handleCloseDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setSelectedProject(null);
  };

  // 컨텐츠 렌더링
  const renderContent = () => {
    // 레거시 형식으로 변환된 프로젝트 데이터 (기존 컴포넌트 호환성)
    const legacyProjects = convertProjectsToLegacyFormat(projects, globalPerformances);
    
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
            projects={legacyProjects}
            statusColors={STATUS_COLORS}
            divisionColors={DIVISION_COLORS}
            onYearChange={setCurrentYear}
            currentYear={currentYear}
            onEditProject={handleEditProject}
            onDeleteProject={handleDeleteProject}
            settingsData={currentSettingsData}
            globalPerformances={globalPerformances}
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
        onAddProject={handleAddProject}
        onAddMultipleProjects={handleAddMultipleProjects}
        onAddPerformance={handleAddPerformance}
        onManageSettings={handleManageSettings}
        onExportData={handleExportData}
        onImportData={handleImportData}
        onClearAllData={handleClearAllData}
        onCreateBackup={handleCreateBackup}
      />

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
        currentYear={currentYear}
        settingsData={currentSettingsData}
        existingProjects={projects}
        globalPerformances={globalPerformances}
      />
      
      <BulkAddModal
        isOpen={isBulkAddModalOpen}
        onClose={() => setIsBulkAddModalOpen(false)}
        onApply={handleBulkAddProjects}
        existingProjects={projects}
      />

      <AddPerformanceModal
        isOpen={isAddPerformanceModalOpen}
        onClose={() => setIsAddPerformanceModalOpen(false)}
        onSubmit={handleSubmitPerformance}
        onDelete={handleDeletePerformance}
        settingsData={currentSettingsData}
        globalPerformances={globalPerformances}
        showSuccess={showSuccess}
        showError={showError}
      />
      
      <EditProjectModal 
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        onSubmit={handleUpdateProject}
        project={selectedProject}
        settingsData={currentSettingsData}
        globalPerformances={globalPerformances}
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
        onSaveComplete={handleLocalSaveComplete}
      />
    </Container>
  );
};

export default DigitalTwinDashboardApp;