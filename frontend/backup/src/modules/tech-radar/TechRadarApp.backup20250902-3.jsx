import React, { useRef, useState } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import Header from './components/Layout/Header';
import TechRadar from './components/TechRadar/TechRadar';
import TechTable from './components/TechTable/TechTable';
import GroupedTable from './components/GroupedTable/GroupedTable';
import TechnologyPanel from './components/TechnologyPanel/TechnologyPanel';
import MaturityPanel from './components/MaturityPanel/MaturityPanel';
import AddTechnologyModal from './components/TechnologyPanel/AddTechnologyModal';
import BulkAddTechnologyModal from './components/TechnologyPanel/BulkAddTechnologyModal';
import { useTechRadar } from './hooks/useTechRadar';

const Container = styled.div`
  background: #ECEFF1;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
`;

const Content = styled.div`
  flex: 1;
  padding: 1rem;
  display: grid;
  grid-template-columns: ${props => (props.viewMode === 'table' || props.viewMode === 'grouped') ? '1fr' : '1fr 400px'};
  gap: 1rem;
  max-width: 100%;
  margin: 0;
  width: 100%;
  height: calc(100vh - 80px); /* 헤더 높이 제외 */

  @media (max-width: 1200px) {
    grid-template-columns: ${props => (props.viewMode === 'table' || props.viewMode === 'grouped') ? '1fr' : '1fr 350px'};
  }

  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
    gap: 1rem;
    height: auto;
  }
`;

const RadarSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 0; /* 그리드 오버플로우 방지 */
`;

const TableSection = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 0; /* 그리드 오버플로우 방지 */
  grid-column: 1 / -1; /* 전체 너비 차지 */
`;

const PanelSection = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 0; /* 그리드 오버플로우 방지 */
  max-height: 100%; /* 패널이 화면을 넘지 않도록 */
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  background: white;
  border-radius: 1rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  text-align: center;
  color: #64748b;
  width: 100%;
  height: 100%;
  min-height: calc(100vh - 120px);
  
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
    max-width: 400px;
  }
  
  .actions {
    margin-top: 2rem;
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
    font-size: 0.9rem;
    font-weight: 500;
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
  
  .add-tech {
    background: #10b981;
    color: white;
  }
  
  .add-tech:hover {
    background: #059669;
    transform: translateY(-1px);
  }
  
  .bulk-add {
    background: #0ea5e9;
    color: white;
  }
  
  .bulk-add:hover {
    background: #0284c7;
    transform: translateY(-1px);
  }
`;

const TechRadarApp = () => {
  const {
    radarData,
    selectedTechnology,
    addTechnology,
    editTechnology,
    deleteTechnology,
    selectTechnology,
    loadSampleData,
    exportData,
    importData
  } = useTechRadar();

  const [notification, setNotification] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkAddModal, setShowBulkAddModal] = useState(false);
  const [editingTech, setEditingTech] = useState(null);
  const [viewMode, setViewMode] = useState('radar'); // 'radar', 'table', or 'grouped'
  const fileInputRef = useRef(null);
  const technologyPanelRef = useRef(null);

  const handleAddTechnology = () => {
    setEditingTech(null);
    setShowAddModal(true);
  };

  const handleBulkAddTechnology = () => {
    setShowBulkAddModal(true);
  };

  const handleEditTechnology = (tech) => {
    setEditingTech(tech);
    setShowAddModal(true);
  };

  const handleModalSubmit = (techData) => {
    if (editingTech) {
      editTechnology(editingTech.id, techData);
    } else {
      addTechnology(techData);
    }
    setShowAddModal(false);
    setEditingTech(null);
  };

  const handleBulkModalSubmit = (technologiesArray) => {
    // 여러 기술을 한 번에 추가
    technologiesArray.forEach(techData => {
      addTechnology(techData);
    });
    setShowBulkAddModal(false);
    
    // 성공 알림
    setNotification(`${technologiesArray.length}개의 기술이 성공적으로 추가되었습니다.`);
    setTimeout(() => setNotification(''), 3000);
  };

  const handleModalClose = () => {
    setShowAddModal(false);
    setEditingTech(null);
  };

  const handleBulkModalClose = () => {
    setShowBulkAddModal(false);
  };

  const handleImportData = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = async (event) => {
    const file = event.target.files[0];
    if (file) {
      try {
        const message = await importData(file);
        setNotification(message);
        setTimeout(() => setNotification(''), 3000);
      } catch (error) {
        alert(error.message);
      }
    }
    event.target.value = '';
  };

  const handleExportData = () => {
    if (radarData.technologies.length === 0) {
      alert('내보낼 데이터가 없습니다.');
      return;
    }
    exportData();
    setNotification('데이터가 성공적으로 내보내졌습니다.');
    setTimeout(() => setNotification(''), 3000);
  };

  const handleLoadSample = () => {
    loadSampleData();
    setNotification('샘플 데이터가 로드되었습니다.');
    setTimeout(() => setNotification(''), 3000);
  };

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
  };

  const handleDeleteTechnology = (techId) => {
    if (confirm('정말로 이 기술을 삭제하시겠습니까?')) {
      deleteTechnology(techId);
      setNotification('기술이 삭제되었습니다.');
      setTimeout(() => setNotification(''), 3000);
    }
  };

  const hasData = radarData.technologies.length > 0;

  const renderMainContent = () => {
    if (!hasData) {
      return (
        <div style={{ gridColumn: '1 / -1', height: '100%', display: 'flex' }}>
          <EmptyState>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="icon">🎯</div>
              <div className="title">Tech Radar에 오신 것을 환영합니다!</div>
              <div className="description">
                조직의 기술 현황을 한 눈에 파악하고 전략적 의사결정을 내려보세요.
                <br />
                샘플 데이터로 시작하거나 직접 기술을 추가해보세요.
              </div>
              <div className="actions">
                <button 
                  className="action-btn load-sample"
                  onClick={handleLoadSample}
                >
                  📊 샘플 데이터 로드
                </button>
                <button 
                  className="action-btn add-tech"
                  onClick={handleAddTechnology}
                >
                  ➕ 직접 기술 추가
                </button>
                <button 
                  className="action-btn bulk-add"
                  onClick={handleBulkAddTechnology}
                >
                  📋 여러 기술 추가
                </button>
              </div>
            </motion.div>
          </EmptyState>
        </div>
      );
    }

    switch (viewMode) {
      case 'radar':
        return (
          <>
            <RadarSection>
              <TechRadar 
                data={radarData}
                selectedTechnology={selectedTechnology}
                onTechnologyClick={selectTechnology}
              />
            </RadarSection>
            <PanelSection>
              <TechnologyPanel
                ref={technologyPanelRef}
                data={radarData}
                selectedTechnology={selectedTechnology}
                onTechnologySelect={selectTechnology}
                onTechnologyAdd={addTechnology}
                onTechnologyEdit={editTechnology}
                onTechnologyDelete={deleteTechnology}
                onEditRequest={handleEditTechnology}
              />
            </PanelSection>
          </>
        );
      
      case 'table':
        return (
          <TableSection>
            <TechTable 
              data={radarData}
              selectedTechnology={selectedTechnology}
              onTechnologyClick={selectTechnology}
              onTechnologyEdit={handleEditTechnology}
              onTechnologyDelete={handleDeleteTechnology}
            />
          </TableSection>
        );
      
      case 'grouped':
        return (
          <TableSection>
            <GroupedTable 
              data={radarData}
              selectedTechnology={selectedTechnology}
              onTechnologyClick={selectTechnology}
              onTechnologyEdit={handleEditTechnology}
              onTechnologyDelete={handleDeleteTechnology}
            />
          </TableSection>
        );
      
      default:
        return null;
    }
  };

  return (
    <Container>
      <Header 
        technologiesCount={radarData.technologies.length}
        onAddTechnology={handleAddTechnology}
        onBulkAddTechnology={handleBulkAddTechnology}
        onImportData={handleImportData}
        onExportData={handleExportData}
        onLoadSample={handleLoadSample}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
      />
      
      {/* 숨겨진 파일 입력 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileImport}
        style={{ display: 'none' }}
      />

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
            zIndex: 1001
          }}
        >
          {notification}
        </motion.div>
      )}

      {/* 기술 성숙도 가이드 패널 */}
      <MaturityPanel />

      {/* Add Technology Modal */}
      <AddTechnologyModal
        isOpen={showAddModal}
        onClose={handleModalClose}
        onSubmit={handleModalSubmit}
        data={radarData}
        editingTech={editingTech}
      />

      {/* Bulk Add Technology Modal */}
      <BulkAddTechnologyModal
        isOpen={showBulkAddModal}
        onClose={handleBulkModalClose}
        onSubmit={handleBulkModalSubmit}
        data={radarData}
      />

      <Content viewMode={viewMode}>
        {renderMainContent()}
      </Content>
    </Container>
  );
};

export default TechRadarApp;