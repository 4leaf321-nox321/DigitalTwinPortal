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
  overflow: visible;
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
  height: calc(100vh - 80px);
  overflow: visible;

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

const TechRadarApp = () => {
  const {
    radarData,
    selectedTechnology,
    addTechnology,
    editTechnology,
    deleteTechnology,
    selectTechnology,
    loadSampleData,
    clearData,
    exportData,
    importData
  } = useTechRadar();

  const [notification, setNotification] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkAddModal, setShowBulkAddModal] = useState(false);
  const [editingTech, setEditingTech] = useState(null);
  const [viewMode, setViewMode] = useState('radar');
  
  // 라벨 표시 상태 추가
  const [showLabels, setShowLabels] = useState(true);

  const showSuccess = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(''), 3000);
  };

  const showError = (message) => {
    alert(message);
  };

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
    technologiesArray.forEach(techData => {
      addTechnology(techData);
    });
    setShowBulkAddModal(false);
    showSuccess(`${technologiesArray.length}개의 기술이 성공적으로 추가되었습니다.`);
  };

  const handleModalClose = () => {
    setShowAddModal(false);
    setEditingTech(null);
  };

  const handleBulkModalClose = () => {
    setShowBulkAddModal(false);
  };

  // 라벨 표시/숨김 핸들러
  const handleShowLabelsChange = (show) => {
    setShowLabels(show);
  };

  // 개선된 Import 핸들러 (JSON, CSV 통합)
  const handleImportData = async (data, type, filename) => {
    try {
      let technologiesToLoad = [];
      
      if (type === 'json') {
        // JSON 데이터 처리 개선
        if (Array.isArray(data)) {
          technologiesToLoad = data;
        } else if (data && typeof data === 'object') {
          if (Array.isArray(data.technologies)) {
            technologiesToLoad = data.technologies;
          } else if (Array.isArray(data.data)) {
            technologiesToLoad = data.data;
          } else {
            throw new Error('JSON 데이터에서 기술 배열을 찾을 수 없습니다. "technologies" 또는 "data" 키를 포함하거나 배열 형태로 제공해주세요.');
          }
        } else {
          throw new Error('올바른 JSON 형식이 아닙니다.');
        }
      } else if (type === 'csv') {
        // CSV 데이터는 이미 변환된 상태로 받음
        technologiesToLoad = data;
      }

      if (!Array.isArray(technologiesToLoad) || technologiesToLoad.length === 0) {
        throw new Error('불러올 기술 데이터가 없습니다.');
      }

      // 데이터 정규화 - ID와 고유성 보장
      const processedTechnologies = technologiesToLoad.map((tech, index) => {
        const processedTech = {
          ...tech,
          id: tech.id || tech.ID || `imported_tech_${Date.now()}_${index}`,
          name: tech.name || tech.Name || `Technology ${index + 1}`,
          sector: tech.sector || tech.Sector || tech.quadrant || tech.Quadrant || 'tools',
          ring: tech.ring || tech.Ring || 'assess',
          description: tech.description || tech.Description || '',
          isNew: Boolean(tech.isNew || tech['Is New'] === 'true'),
          moved: parseInt(tech.moved || tech.Moved || 0),
          category: tech.category || tech.Category || '',
          tags: Array.isArray(tech.tags) ? tech.tags : 
                (typeof tech.tags === 'string' ? tech.tags.split(';').filter(t => t.trim()) : []),
          website: tech.website || tech.Website || '',
          createdAt: tech.createdAt || tech['Created At'] || new Date().toISOString(),
          updatedAt: tech.updatedAt || tech['Updated At'] || new Date().toISOString()
        };

        // quadrant 필드도 유지 (하위 호환성)
        processedTech.quadrant = processedTech.sector;

        return processedTech;
      });
      
      // 기존 데이터 클리어하고 새 데이터 로드
      clearData();
      processedTechnologies.forEach(tech => {
        addTechnology(tech);
      });
      
      showSuccess(`${type.toUpperCase()} 파일에서 ${processedTechnologies.length}개의 기술을 성공적으로 불러왔습니다.`);
    } catch (error) {
      console.error('Import error:', error);
      throw new Error(`파일 불러오기 실패: ${error.message}`);
    }
  };

  // Export 핸들러
  const handleExportData = async (type = 'json') => {
    if (radarData.technologies.length === 0) {
      showError('내보낼 기술이 없습니다.');
      return;
    }

    if (type === 'json') {
      exportData();
      showSuccess('JSON 데이터가 성공적으로 내보내졌습니다.');
    }
  };

  const handleLoadSample = () => {
    loadSampleData();
    showSuccess('샘플 데이터가 로드되었습니다.');
  };

  const handleClearData = () => {
    if (confirm('정말로 모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      clearData();
      showSuccess('모든 데이터가 삭제되었습니다.');
    }
  };

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
  };

  const handleDeleteTechnology = (techId) => {
    if (confirm('정말로 이 기술을 삭제하시겠습니까?')) {
      deleteTechnology(techId);
      showSuccess('기술이 삭제되었습니다.');
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
                showLabels={showLabels} // 라벨 표시 상태 전달
              />
            </RadarSection>
            <PanelSection>
              <TechnologyPanel
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
        technologies={radarData.technologies}
        onAddTechnology={handleAddTechnology}
        onBulkAddTechnology={handleBulkAddTechnology}
        onImportData={handleImportData}
        onExportData={handleExportData}
        onLoadSample={handleLoadSample}
        onClearData={handleClearData}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        showError={showError}
        showSuccess={showSuccess}
        // 라벨 표시 관련 props 전달
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