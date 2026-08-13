import React, { useState, useRef } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

// Components
import Header from './components/Layout/Header';
import TechRadar from './components/TechRadar/TechRadar';
import TechnologyPanel from './components/TechnologyPanel/TechnologyPanel';
import TechTable from './components/TechTable/TechTable';
import GroupedTable from './components/GroupedTable/GroupedTable';
import MaturityPanel from './components/MaturityPanel/MaturityPanel';
import AddTechnologyModal from './components/TechnologyPanel/AddTechnologyModal';
import BulkAddTechnologyModal from './components/TechnologyPanel/BulkAddTechnologyModal';
import SectorManagementModal from './components/SectorPanel/SectorManagementModal';
import SettingsModal from './components/SettingsPanel/SettingsModal';

// Hooks
import useDigitalTwinSolutionData from './hooks/useDigitalTwinSolutionData';

const Container = styled.div`
  background: #ECEFF1;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: visible;
`;

const Content = styled.div`
  flex: 1;
  padding: 1rem;
  display: grid;
  grid-template-columns: ${props => {
    if (props.viewMode === 'table' || props.viewMode === 'grouped') {
      return '1fr';
    } else {
      return '2fr 1fr 1fr'; // 40% 20% 20%
    }
  }};
  gap: 1rem;
  max-width: 100%;
  margin: 0;
  width: 100%;
  height: calc(100vh - 80px);
  overflow: visible;

  @media (max-width: 1200px) {
    grid-template-columns: ${props => (props.viewMode === 'table' || props.viewMode === 'grouped') ? '1fr' : '1.5fr 1fr 1fr'};
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
  min-height: 0;
`;

const TableSection = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 0;
  grid-column: 1 / -1;
`;

const PanelSection = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 0;
  max-height: 100%;
`;

const AdditionalSection = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 0;
  max-height: 100%;
  background: white;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  
  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #9ca3af;
    text-align: center;
  }
  
  .placeholder-icon {
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }
  
  .placeholder-text {
    font-size: 0.9rem;
    font-weight: 500;
  }
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
    gap: 1.5rem;
    flex-wrap: wrap;
    justify-content: center;
  }
  
  .action-btn {
    padding: 1rem 2rem;
    border: none;
    border-radius: 0.75rem;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 600;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 180px;
    height: 56px;
    justify-content: center;
    white-space: nowrap;
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

const DigitalTwinSolutionApp = () => {
  const {
    data,
    selectedTechnology,
    setSelectedTechnology,
    addTechnology,
    updateTechnology,
    deleteTechnology,
    addSector,
    updateSector,
    deleteSector,
    updateSettings,
    loadSampleData,
    clearData,
    exportData,
    importData
  } = useDigitalTwinSolutionData();

  const [notification, setNotification] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkAddModal, setShowBulkAddModal] = useState(false);
  const [showSectorModal, setShowSectorModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editingTechnology, setEditingTechnology] = useState(null);
  const [viewMode, setViewMode] = useState('radar');
  const [showLabels, setShowLabels] = useState(true);
  
  const fileInputRef = useRef(null);
  const technologyPanelRef = useRef(null);

  const showSuccess = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(''), 3000);
  };

  const showError = (message) => {
    alert(message);
  };

  // 솔루션 선택 핸들러
  const handleTechnologySelect = (tech) => {
    setSelectedTechnology(tech);
  };

  // 솔루션 편집 핸들러
  const handleTechnologyEdit = (tech) => {
    setEditingTechnology(tech);
    setShowAddModal(true);
  };

  // 솔루션 삭제 핸들러
  const handleTechnologyDelete = (techId) => {
    if (window.confirm('정말 이 솔루션을 삭제하시겠습니까?')) {
      deleteTechnology(techId);
      showSuccess('솔루션이 삭제되었습니다.');
    }
  };

  // 단일 솔루션 추가/수정 핸들러
  const handleAddOrUpdateTechnology = (techData) => {
    if (editingTechnology) {
      updateTechnology(editingTechnology.id, techData);
      showSuccess('솔루션이 수정되었습니다.');
    } else {
      addTechnology(techData);
      showSuccess('솔루션이 추가되었습니다.');
    }
    setEditingTechnology(null);
  };

  // 일괄 솔루션 추가 핸들러
  const handleBulkAddTechnologies = (technologies) => {
    technologies.forEach(tech => addTechnology(tech));
    showSuccess(`${technologies.length}개의 솔루션이 성공적으로 추가되었습니다.`);
  };

  // 모달 닫기 핸들러
  const handleCloseAddModal = () => {
    setShowAddModal(false);
    setEditingTechnology(null);
  };

  // 파일 가져오기 핸들러
  const handleImportData = (file) => {
    importData(file);
    showSuccess('데이터를 성공적으로 가져왔습니다.');
  };

  // 내보내기 핸들러
  const handleExportData = () => {
    exportData();
    showSuccess('데이터가 성공적으로 내보내졌습니다.');
  };

  // 샘플 데이터 로드
  const handleLoadSample = () => {
    loadSampleData();
    showSuccess('샘플 데이터가 로드되었습니다.');
  };

  // 데이터 삭제
  const handleClearData = () => {
    if (window.confirm('정말로 모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      clearData();
      showSuccess('모든 데이터가 삭제되었습니다.');
    }
  };

  // 뷰 모드 변경
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
  };

  // 라벨 표시/숨김 핸들러
  const handleShowLabelsChange = (show) => {
    setShowLabels(show);
  };

  // 섹터 관리 모달 열기
  const handleManageSectors = () => {
    setShowSectorModal(true);
  };

  // 설정 모달 열기
  const handleManageSettings = () => {
    setShowSettingsModal(true);
  };

  // 섹터 추가 핸들러
  const handleAddSector = (sectorData) => {
    addSector(sectorData);
  };

  // 섹터 수정 핸들러
  const handleUpdateSector = (sectorId, updatedData) => {
    updateSector(sectorId, updatedData);
  };

  // 섹터 삭제 핸들러
  const handleDeleteSector = (sectorId) => {
    deleteSector(sectorId);
  };

  const hasData = data.technologies.length > 0;

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
              <div className="icon">🔮</div>
              <div className="title">Digital Twin Solution Radar에 오신 것을 환영합니다!</div>
              <div className="description">
                디지털 트윈 솔루션 현황을 한 눈에 파악하고 전략적 의사결정을 내려보세요.
                <br />
                샘플 데이터로 시작하거나 직접 솔루션을 추가해보세요.
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
                  onClick={() => setShowAddModal(true)}
                >
                  ➕ 직접 솔루션 추가
                </button>
                <button 
                  className="action-btn bulk-add"
                  onClick={() => setShowBulkAddModal(true)}
                >
                  📋 여러 솔루션 추가
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
                data={data}
                selectedTechnology={selectedTechnology}
                onTechnologyClick={handleTechnologySelect}
                showLabels={showLabels}
              />
            </RadarSection>
            <PanelSection>
              <TechnologyPanel
                ref={technologyPanelRef}
                data={data}
                selectedTechnology={selectedTechnology}
                onTechnologySelect={handleTechnologySelect}
                onEditRequest={handleTechnologyEdit}
                onTechnologyDelete={handleTechnologyDelete}
              />
            </PanelSection>
            <AdditionalSection>
              <div className="placeholder">
                <div className="placeholder-icon">⚡</div>
                <div className="placeholder-text">
                  추가 기능을 위한
                  <br />
                  영역입니다
                </div>
              </div>
            </AdditionalSection>
          </>
        );
      
      case 'table':
        return (
          <TableSection>
            <TechTable
              data={data}
              selectedTechnology={selectedTechnology}
              onTechnologyClick={handleTechnologySelect}
              onTechnologyEdit={handleTechnologyEdit}
              onTechnologyDelete={handleTechnologyDelete}
            />
          </TableSection>
        );
      
      case 'grouped':
        return (
          <TableSection>
            <GroupedTable
              data={data}
              selectedTechnology={selectedTechnology}
              onTechnologyClick={handleTechnologySelect}
              onTechnologyEdit={handleTechnologyEdit}
              onTechnologyDelete={handleTechnologyDelete}
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
        technologiesCount={data.technologies.length}
        technologies={data.technologies}
        onAddTechnology={() => setShowAddModal(true)}
        onBulkAddTechnology={() => setShowBulkAddModal(true)}
        onManageSectors={handleManageSectors}
        onManageSettings={handleManageSettings}
        onImportData={handleImportData}
        onExportData={handleExportData}
        onLoadSample={handleLoadSample}
        onClearData={handleClearData}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        showError={showError}
        showSuccess={showSuccess}
        showLabels={showLabels}
        onShowLabelsChange={handleShowLabelsChange}
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

      {/* RADAR 모드일 때만 MaturityPanel을 하단에 표시 */}
      {viewMode === 'radar' && (
        <MaturityPanel className={viewMode === 'table' || viewMode === 'grouped' ? 'centered' : ''} />
      )}

      {/* Add Technology Modal */}
      <AddTechnologyModal
        isOpen={showAddModal}
        onClose={handleCloseAddModal}
        onSubmit={handleAddOrUpdateTechnology}
        data={data}
        editingTech={editingTechnology}
      />

      {/* Bulk Add Technology Modal */}
      <BulkAddTechnologyModal
        isOpen={showBulkAddModal}
        onClose={() => setShowBulkAddModal(false)}
        onSubmit={handleBulkAddTechnologies}
        data={data}
      />

      {/* Sector Management Modal */}
      <SectorManagementModal
        isOpen={showSectorModal}
        onClose={() => setShowSectorModal(false)}
        data={data}
        onAddSector={handleAddSector}
        onUpdateSector={handleUpdateSector}
        onDeleteSector={handleDeleteSector}
        showSuccess={showSuccess}
        showError={showError}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        data={data}
        onUpdateSettings={updateSettings}
        showSuccess={showSuccess}
        showError={showError}
      />

      <Content viewMode={viewMode}>
        {renderMainContent()}
      </Content>
    </Container>
  );
};

export default DigitalTwinSolutionApp;
