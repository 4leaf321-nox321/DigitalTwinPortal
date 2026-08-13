import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { GitCompare, Workflow, LayoutGrid, Building2 } from 'lucide-react';
import DivisionTabs from './DivisionTabs';
import ModuleList from './ModuleList';
import ModuleFlowView from './ModuleFlowView';
import ModuleMatrixView from './ModuleMatrixView';
import CompareView from './CompareView';
import DivisionCompareView from './DivisionCompareView';
import ModuleModal from './ModuleModal';
import BulkModuleModal from './BulkModuleModal';
import { spdmApi } from '../../services/spdmApi';

const Container = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #f8fafc;
`;

const TopBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: white;
`;

const TabsArea = styled.div`
  flex: 1;
`;

const TopActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 1rem;
`;

const CompareButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.875rem;
  border: 1px solid ${props => props.$active ? '#8b5cf6' : '#e2e8f0'};
  border-radius: 0.5rem;
  background: ${props => props.$active ? '#ede9fe' : 'white'};
  color: ${props => props.$active ? '#7c3aed' : '#475569'};
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;

  &:hover {
    border-color: #8b5cf6;
    color: #7c3aed;
  }
`;

const ViewToggle = styled.div`
  display: flex;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  overflow: hidden;
`;

const ViewToggleBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.4375rem 0.75rem;
  border: none;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  background: ${props => props.$active ? '#8b5cf6' : 'white'};
  color: ${props => props.$active ? 'white' : '#64748b'};

  &:not(:last-child) {
    border-right: 1px solid #e2e8f0;
  }

  &:hover {
    background: ${props => props.$active ? '#8b5cf6' : '#f8fafc'};
  }
`;

const ContentArea = styled.div`
  flex: 1;
  display: flex;
  overflow: hidden;
`;

const EditorArea = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;


const Toast = styled.div`
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  padding: 0.75rem 1.25rem;
  background: #1e293b;
  color: white;
  border-radius: 0.75rem;
  font-size: 0.8125rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  z-index: 1000;
  animation: slideIn 0.3s ease;

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const ModuleStatusView = ({ departments }) => {
  const [modules, setModules] = useState([]);
  const [activeDivision, setActiveDivision] = useState(null);
  const [selectedModuleId, setSelectedModuleId] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelection, setCompareSelection] = useState([]);
  const [showCompare, setShowCompare] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingModule, setEditingModule] = useState(null);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('flow'); // 'flow' | 'matrix'
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showDivisionCompare, setShowDivisionCompare] = useState(false);

  const showToast = useCallback((message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2000);
  }, []);

  // Load modules
  const loadModules = useCallback(async () => {
    try {
      setLoading(true);
      const data = await spdmApi.getModules(activeDivision);
      setModules(data);
    } catch (err) {
      console.error('모듈 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  }, [activeDivision]);

  useEffect(() => {
    loadModules();
  }, [loadModules]);

  // Reset selection when division changes
  useEffect(() => {
    setSelectedModuleId(null);
    setCompareMode(false);
    setCompareSelection([]);
    setShowCompare(false);
  }, [activeDivision]);

  const compareModules = modules.filter(m => compareSelection.includes(m.id));

  const handleSaveModule = async (moduleData) => {
    try {
      if (moduleData.id) {
        await spdmApi.updateModule(moduleData.id, moduleData);
        showToast('모듈이 수정되었습니다.');
      } else {
        const created = await spdmApi.createModule(moduleData);
        setSelectedModuleId(created.id);
        showToast('모듈이 추가되었습니다.');
      }
      await loadModules();
      setShowModal(false);
      setEditingModule(null);
    } catch (err) {
      console.error('모듈 저장 실패:', err);
      showToast('모듈 저장에 실패했습니다.');
    }
  };

  const handleBulkSave = async (modulesToCreate) => {
    try {
      for (const mod of modulesToCreate) {
        await spdmApi.createModule(mod);
      }
      await loadModules();
      showToast(`${modulesToCreate.length}개 모듈이 추가되었습니다.`);
    } catch (err) {
      console.error('일괄 모듈 추가 실패:', err);
      showToast('모듈 추가에 실패했습니다.');
    }
  };

  const handleDeleteModule = async (moduleId) => {
    if (!window.confirm('이 모듈을 삭제하시겠습니까?')) return;
    try {
      await spdmApi.deleteModule(moduleId);
      if (selectedModuleId === moduleId) {
        setSelectedModuleId(null);
      }
      setCompareSelection(prev => prev.filter(id => id !== moduleId));
      await loadModules();
      showToast('모듈이 삭제되었습니다.');
    } catch (err) {
      console.error('모듈 삭제 실패:', err);
      showToast('모듈 삭제에 실패했습니다.');
    }
  };

  const handleCompareToggle = (moduleId) => {
    setCompareSelection(prev =>
      prev.includes(moduleId)
        ? prev.filter(id => id !== moduleId)
        : [...prev, moduleId]
    );
  };

  const handleStartCompare = () => {
    if (compareSelection.length >= 2) {
      setShowCompare(true);
    }
  };

  const toggleCompareMode = () => {
    if (compareMode) {
      setCompareMode(false);
      setCompareSelection([]);
      setShowCompare(false);
    } else {
      setCompareMode(true);
    }
  };

  return (
    <Container>
      <TopBar>
        <TabsArea>
          <DivisionTabs
            departments={departments}
            activeDivision={activeDivision}
            onSelect={setActiveDivision}
          />
        </TabsArea>
        <TopActions>
          <ViewToggle>
            <ViewToggleBtn $active={viewMode === 'flow'} onClick={() => setViewMode('flow')}>
              <Workflow size={14} />
              다이어그램
            </ViewToggleBtn>
            <ViewToggleBtn $active={viewMode === 'matrix'} onClick={() => setViewMode('matrix')}>
              <LayoutGrid size={14} />
              매트릭스
            </ViewToggleBtn>
          </ViewToggle>
          {compareMode && compareSelection.length >= 2 && (
            <CompareButton onClick={handleStartCompare}>
              비교 실행 ({compareSelection.length})
            </CompareButton>
          )}
          <CompareButton $active={compareMode} onClick={toggleCompareMode}>
            <GitCompare size={14} />
            비교
          </CompareButton>
          <CompareButton $active={showDivisionCompare} onClick={() => {
            setShowDivisionCompare(prev => !prev);
            if (!showDivisionCompare) {
              setCompareMode(false);
              setCompareSelection([]);
              setShowCompare(false);
            }
          }}>
            <Building2 size={14} />
            사업부 비교
          </CompareButton>
        </TopActions>
      </TopBar>

      <ContentArea>
        {showDivisionCompare ? (
          <DivisionCompareView
            departments={departments}
            onBack={() => setShowDivisionCompare(false)}
          />
        ) : showCompare && compareModules.length >= 2 ? (
          <CompareView
            modules={compareModules}
            onBack={() => setShowCompare(false)}
          />
        ) : (
          <>
            <ModuleList
              modules={modules}
              departments={departments}
              selectedModuleId={selectedModuleId}
              compareMode={compareMode}
              compareSelection={compareSelection}
              onSelect={setSelectedModuleId}
              onCompareToggle={handleCompareToggle}
              onAdd={() => { setEditingModule(null); setShowModal(true); }}
              onBulkAdd={() => setShowBulkModal(true)}
              onEdit={(mod) => { setEditingModule(mod); setShowModal(true); }}
              onDelete={handleDeleteModule}
            />
            <EditorArea>
              {viewMode === 'flow' ? (
                <ModuleFlowView
                  modules={modules}
                  onEditModule={(mod) => { setEditingModule(mod); setShowModal(true); }}
                  onDeleteModule={handleDeleteModule}
                />
              ) : (
                <ModuleMatrixView modules={modules} />
              )}
            </EditorArea>
          </>
        )}
      </ContentArea>

      <ModuleModal
        isOpen={showModal}
        module={editingModule}
        departments={departments}
        activeDivision={activeDivision}
        allModules={modules}
        onClose={() => { setShowModal(false); setEditingModule(null); }}
        onSave={handleSaveModule}
      />

      <BulkModuleModal
        isOpen={showBulkModal}
        departments={departments}
        activeDivision={activeDivision}
        onClose={() => setShowBulkModal(false)}
        onSave={handleBulkSave}
      />

      {toast && <Toast>{toast}</Toast>}
    </Container>
  );
};

export default ModuleStatusView;
