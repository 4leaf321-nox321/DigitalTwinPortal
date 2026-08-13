import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import Header from './components/Layout/Header';
import Navigation from './components/Navigation/Navigation';
import DocumentList from './components/Viewer/DocumentList';
import DocumentViewer from './components/Viewer/DocumentViewer';
import AddProjectModal from './components/ProjectModal/AddProjectModal';
import { useTechArchive } from './hooks/useTechArchive';

const Container = styled.div`
  height: 100vh;
  background: #ECEFF1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const Content = styled.div`
  flex: 1;
  display: grid;
  grid-template-columns: 400px 1fr;
  height: calc(100vh - 80px);
  max-width: 100%;
  position: relative;
  overflow: hidden;

  @media (max-width: 1400px) {
    grid-template-columns: 360px 1fr;
  }

  @media (max-width: 1200px) {
    grid-template-columns: 320px 1fr;
  }

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    height: calc(100vh - 120px);
    
    .navigation-panel {
      display: ${props => props.showMobileNav ? 'block' : 'none'};
    }
    
    .document-list {
      display: ${props => props.showViewer ? 'none' : 'block'};
    }
    
    .document-viewer {
      display: ${props => props.showViewer ? 'block' : 'none'};
    }
  }
`;

const NavigationPanel = styled.div`
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  
  @media (max-width: 768px) {
    min-height: auto;
    height: auto;
  }
`;

const DocumentListPanel = styled.div`
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  
  @media (max-width: 768px) {
    min-height: auto;
    height: auto;
  }
`;

const ViewerPanel = styled.div`
  position: fixed;
  top: 0;
  right: ${props => props.isOpen ? '0' : '-750px'};
  width: 750px;
  height: 100vh;
  background: white;
  box-shadow: ${props => props.isOpen ? '-4px 0 20px rgba(0, 0, 0, 0.15)' : 'none'};
  z-index: 1000;
  transition: right 0.3s ease-in-out;
  overflow: hidden;
  
  @media (max-width: 1024px) {
    width: 600px;
    right: ${props => props.isOpen ? '0' : '-600px'};
  }
  
  @media (max-width: 768px) {
    width: 100vw;
    right: ${props => props.isOpen ? '0' : '-100vw'};
    position: fixed;
    top: 0;
    left: 0;
  }
`;

// 사이드 패널 오버레이
const ViewerOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  opacity: ${props => props.isOpen ? 1 : 0};
  visibility: ${props => props.isOpen ? 'visible' : 'hidden'};
  transition: opacity 0.3s ease-in-out, visibility 0.3s ease-in-out;
  
  @media (min-width: 1025px) {
    display: none;
  }
`;

const MobileControls = styled.div`
  display: none;
  
  @media (max-width: 768px) {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: white;
    border-radius: 0.5rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    margin: 1rem;
  }
`;

const MobileButton = styled.button`
  padding: 0.5rem 1rem;
  border: 2px solid #3b82f6;
  border-radius: 0.5rem;
  background: ${props => props.active ? '#3b82f6' : 'white'};
  color: ${props => props.active ? 'white' : '#3b82f6'};
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #3b82f6;
    color: white;
  }
`;

const EmptyContent = styled.div`
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  background: white;
  border-radius: 1rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  text-align: center;
  color: #6b7280;
  height: 100%;
  
  .icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }
  
  .title {
    font-size: 1.5rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: #374151;
  }
  
  .description {
    font-size: 1rem;
    line-height: 1.6;
    max-width: 500px;
    margin-bottom: 2rem;
  }
  
  .actions {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    justify-content: center;
  }
  
  .action-btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 0.5rem;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 600;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .load-sample {
    background: #3b82f6;
    color: white;
  }
  
  .load-sample:hover {
    background: #2563eb;
    transform: translateY(-1px);
  }
`;

const Notification = styled(motion.div)`
  position: fixed;
  top: 100px;
  right: 20px;
  background: ${props => props.type === 'error' ? '#ef4444' : '#10b981'};
  color: white;
  padding: 1rem 1.5rem;
  border-radius: 0.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1001;
  max-width: 400px;
`;

const TechArchiveApp = ({ onGoHome }) => {
  const {
    documents,
    allDocuments,
    selectedDocument,
    searchQuery,
    selectedCategory,
    selectedType,
    selectedStatus,
    selectedTags,
    sortBy,
    sortOrder,
    isLoading,
    categoriesWithCount,
    documentTypes,
    statusOptions,
    availableTags,
    selectDocument,
    addDocument,
    updateDocument,
    deleteDocument,
    toggleLike,
    loadSampleData,
    clearData,
    exportData,
    importData,
    resetFilters,
    setSearchQuery,
    setSelectedCategory,
    setSelectedType,
    setSelectedStatus,
    setSelectedTags,
    setSortBy,
    setSortOrder
  } = useTechArchive();

  const [notification, setNotification] = useState('');
  const [notificationType, setNotificationType] = useState('success');
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [showViewer, setShowViewer] = useState(false);
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);

  const handleCloseViewer = useCallback(() => {
    setShowViewer(false);
    selectDocument(null);
  }, [selectDocument]);

  // 사이드 패널이 열렸을 때 body 스크롤 비활성화 및 ESC 키 처리
  useEffect(() => {
    if (showViewer && selectedDocument) {
      document.body.style.overflow = 'hidden';
      
      // ESC 키 이벤트 리스너 추가
      const handleEscKey = (event) => {
        if (event.key === 'Escape') {
          handleCloseViewer();
        }
      };
      
      document.addEventListener('keydown', handleEscKey);
      
      return () => {
        document.body.style.overflow = 'unset';
        document.removeEventListener('keydown', handleEscKey);
      };
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [showViewer, selectedDocument, handleCloseViewer]);

  const showSuccess = (message) => {
    setNotification(message);
    setNotificationType('success');
    setTimeout(() => setNotification(''), 3000);
  };

  const showError = (message) => {
    setNotification(message);
    setNotificationType('error');
    setTimeout(() => setNotification(''), 3000);
  };

  const handleDocumentSelect = (doc) => {
    selectDocument(doc);
    setShowViewer(true);
    setShowMobileNav(false);
  };

  const handleLike = (docId) => {
    toggleLike(docId);
    showSuccess('좋아요를 눌렀습니다!');
  };

  const handleEdit = (doc) => {
    showSuccess('편집 기능은 추후 구현 예정입니다.');
  };

  const handleDelete = (docId) => {
    if (confirm('정말로 이 문서를 삭제하시겠습니까?')) {
      deleteDocument(docId);
      setShowViewer(false);
      showSuccess('문서가 삭제되었습니다.');
    }
  };

  const handleLoadSample = () => {
    loadSampleData();
    showSuccess('샘플 데이터가 로드되었습니다.');
  };

  const handleClearData = () => {
    if (confirm('정말로 모든 데이터를 삭제하시겠습니까?')) {
      clearData();
      setShowViewer(false);
      showSuccess('모든 데이터가 삭제되었습니다.');
    }
  };

  const handleExport = () => {
    if (allDocuments.length === 0) {
      showError('내보낼 문서가 없습니다.');
      return;
    }
    exportData();
    showSuccess('데이터가 성공적으로 내보내졌습니다.');
  };

  const handleImport = async (data) => {
    try {
      const count = importData(data);
      showSuccess(`${count}개의 문서를 성공적으로 가져왔습니다.`);
    } catch (error) {
      showError(error.message);
    }
  };

  const handleAddProject = () => {
    setShowAddProjectModal(true);
  };

  const handleProjectSubmit = (projectData) => {
    // 프로젝트를 문서로 변환하여 추가
    const projectDocument = {
      title: projectData.title,
      description: projectData.description,
      content: `# ${projectData.title}

## 프로젝트 개요
${projectData.description}

## 프로젝트 정보
- **유형**: ${getProjectTypeLabel(projectData.type)}
- **상태**: ${getStatusLabel(projectData.status)}
- **담당자**: ${projectData.assignees.join(', ')}
- **담당팀**: ${getTeamLabel(projectData.team)}
${projectData.startDate ? `- **시작일**: ${projectData.startDate}` : ''}
${projectData.endDate ? `- **종료일**: ${projectData.endDate}` : ''}

## 진행 상황
프로젝트가 시작되었습니다.

## 관련 문서
이 섹션에 관련 문서들을 추가해보세요.

## 마일스톤
주요 마일스톤을 여기에 기록하세요.`,
      category: projectData.team, // 담당팀 코드 (필수 선택)
      type: projectData.type, // 선택한 타입을 그대로 사용
      status: projectData.status,
      tags: ['프로젝트', ...projectData.tags],
      author: getTeamLabel(projectData.team), // 담당팀 이름
      assignees: projectData.assignees, // 담당자 배열
      projectData: projectData // 원본 프로젝트 데이터 보관
    };

    addDocument(projectDocument);
    showSuccess(`프로젝트 "${projectData.title}"이(가) 성공적으로 생성되었습니다.`);
  };

  // 헬퍼 함수들
  const getProjectTypeLabel = (type) => {
    const types = {
      'new-simulation': '신규 시뮬레이션 기법 개발',
      'simulation-automation': '시뮬레이션 자동화',
      'ai-model-development': 'AI 모델 개발',
      'platform-development': '플랫폼 개발&도입',
      'infrastructure': '인프라 구축&도입',
      'data-acquisition': '데이터 확보',
      'process-development': '신규 프로세스 구축'
    };
    return types[type] || type;
  };

  const getTeamLabel = (teamCode) => {
    const teams = {
      'gtr': 'GTR',
      'mx': 'MX',
      'vd': 'VD',
      'da': 'DA',
      'network': '네트워크',
      'medical-device': '의료기기'
    };
    return teams[teamCode] || teamCode;
  };

  const getStatusLabel = (status) => {
    const statuses = {
      planning: '계획 중',
      active: '진행 중',
      completed: '완료됨'
    };
    return statuses[status] || status;
  };

  const hasData = allDocuments.length > 0;

  if (!hasData && !isLoading) {
    return (
      <Container>
        <Header 
          documentsCount={allDocuments.length}
          onGoHome={onGoHome}
          onLoadSample={handleLoadSample}
          onClearData={handleClearData}
          onExport={handleExport}
          onImport={handleImport}
          onAddProject={handleAddProject}
          showError={showError}
          showSuccess={showSuccess}
        />
        
        {notification && (
          <Notification
            type={notificationType}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {notification}
          </Notification>
        )}

        <Content>
          <EmptyContent>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="icon">📚</div>
              <div className="title">Tech Archive에 오신 것을 환영합니다!</div>
              <div className="description">
                기술 문서, 가이드라인, 베스트 프랙티스를 체계적으로 관리하고 공유하세요.
                샘플 데이터로 시작하거나 직접 문서를 추가할 수 있습니다.
              </div>
              <div className="actions">
                <button 
                  className="action-btn load-sample"
                  onClick={handleLoadSample}
                >
                  📊 샘플 데이터 로드
                </button>
              </div>
            </motion.div>
          </EmptyContent>
        </Content>
      </Container>
    );
  }

  return (
    <Container>
      <Header 
        documentsCount={allDocuments.length}
        onGoHome={onGoHome}
        onLoadSample={handleLoadSample}
        onClearData={handleClearData}
        onExport={handleExport}
        onImport={handleImport}
        onAddProject={handleAddProject}
        showError={showError}
        showSuccess={showSuccess}
      />

      {notification && (
        <Notification
          type={notificationType}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          {notification}
        </Notification>
      )}

      <MobileControls>
        <MobileButton 
          active={showMobileNav}
          onClick={() => {
            setShowMobileNav(!showMobileNav);
            setShowViewer(false);
          }}
        >
          🔍 필터
        </MobileButton>
        <MobileButton 
          active={!showViewer && !showMobileNav}
          onClick={() => {
            setShowMobileNav(false);
            setShowViewer(false);
          }}
        >
          📋 목록
        </MobileButton>
        {selectedDocument && (
          <MobileButton 
            active={showViewer}
            onClick={() => {
              setShowViewer(true);
              setShowMobileNav(false);
            }}
          >
            📖 문서
          </MobileButton>
        )}
      </MobileControls>

      <Content showMobileNav={showMobileNav} showViewer={showViewer}>
        <NavigationPanel className="navigation-panel">
          <Navigation
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            categories={categoriesWithCount}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            documentTypes={documentTypes}
            selectedType={selectedType}
            onTypeChange={setSelectedType}
            statusOptions={statusOptions}
            selectedStatus={selectedStatus}
            onStatusChange={setSelectedStatus}
            selectedTags={selectedTags}
            onTagsChange={setSelectedTags}
            availableTags={availableTags}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            sortOrder={sortOrder}
            onSortOrderChange={setSortOrder}
            onResetFilters={resetFilters}
            dateRange={{ startDate: '', endDate: '' }}
            onDateRangeChange={() => {}}
          />
        </NavigationPanel>

        <DocumentListPanel className="document-list">
          <DocumentList
            documents={documents}
            selectedDocument={selectedDocument}
            onDocumentSelect={handleDocumentSelect}
            isLoading={isLoading}
            searchQuery={searchQuery}
            statusOptions={statusOptions}
          />
        </DocumentListPanel>
      </Content>

      {/* 사이드 뷰어 오버레이 */}
      <ViewerOverlay 
        isOpen={showViewer && selectedDocument}
        onClick={handleCloseViewer}
      />

      {/* 사이드 뷰어 패널 */}
      <ViewerPanel 
        isOpen={showViewer && selectedDocument}
        className="document-viewer"
      >
        <DocumentViewer
          document={selectedDocument}
          onClose={handleCloseViewer}
          onLike={handleLike}
          onEdit={handleEdit}
          onDelete={handleDelete}
          statusOptions={statusOptions}
        />
      </ViewerPanel>

      {/* 프로젝트 추가 모달 */}
      <AddProjectModal
        isOpen={showAddProjectModal}
        onClose={() => setShowAddProjectModal(false)}
        onSubmit={handleProjectSubmit}
        showError={showError}
      />
    </Container>
  );
};

export default TechArchiveApp;