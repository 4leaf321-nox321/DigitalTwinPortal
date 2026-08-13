import React, { useState, useRef, useCallback } from 'react';
import styled from 'styled-components';
import Header from './components/Layout/Header';
import ProcessDiagram from './components/ProcessDiagram/ProcessDiagram';
import AddNodeModal from './components/AddNodeModal';
import BulkAddNodesModal from './components/BulkAddNodesModal';
import BulkEditDataModal from './components/BulkEditDataModal';
import AddGroupModal from './components/AddGroupModal';
import AddArrowModal from './components/AddArrowModal';
import AddDividerModal from './components/AddDividerModal';
import SettingsModal from './components/SettingsModal';
import ServerSyncModal from './components/ServerSyncModal';
import { ColorSettingsProvider, useColorSettings } from './contexts/ColorSettingsContext';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f8fafc;
  user-select: none;
`;

const Content = styled.main`
  flex: 1;
  display: flex;
  overflow: hidden;
`;

const DevManufacturingProcessApp = ({ onGoHome }) => {
  const [isAddNodeModalOpen, setIsAddNodeModalOpen] = useState(false);
  const [isBulkAddNodesModalOpen, setIsBulkAddNodesModalOpen] = useState(false);
  const [isBulkEditDataModalOpen, setIsBulkEditDataModalOpen] = useState(false);
  const [isAddGroupModalOpen, setIsAddGroupModalOpen] = useState(false);
  const [isAddArrowModalOpen, setIsAddArrowModalOpen] = useState(false);
  const [isAddDividerModalOpen, setIsAddDividerModalOpen] = useState(false);
  const [dividerDirection, setDividerDirection] = useState('horizontal');
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isServerSyncModalOpen, setIsServerSyncModalOpen] = useState(false);
  const diagramRef = useRef(null);
  const { colorItems, loadColorItems } = useColorSettings();

  const handleAddNode = useCallback((nodeData) => {
    if (diagramRef.current?.addNode) {
      diagramRef.current.addNode(nodeData);
    }
  }, []);

  const handleBulkAddNodes = useCallback((nodesData) => {
    if (diagramRef.current?.addNode && diagramRef.current?.getViewportCenter) {
      const center = diagramRef.current.getViewportCenter();
      // 전체 노드를 화면 중심 기준으로 배치
      const cols = 5;
      const nodeWidth = 200;
      const nodeHeight = 120;
      const totalCols = Math.min(nodesData.length, cols);
      const totalRows = Math.ceil(nodesData.length / cols);
      const startX = center.x - (totalCols * nodeWidth) / 2;
      const startY = center.y - (totalRows * nodeHeight) / 2;

      nodesData.forEach((nodeData, index) => {
        const offsetX = (index % cols) * nodeWidth;
        const offsetY = Math.floor(index / cols) * nodeHeight;
        diagramRef.current.addNode({
          ...nodeData,
          position: { x: startX + offsetX, y: startY + offsetY }
        });
      });
    }
  }, []);

  const handleAddGroup = useCallback((groupData) => {
    if (diagramRef.current?.addGroup) {
      diagramRef.current.addGroup(groupData);
    }
  }, []);

  const handleOpenDividerModal = useCallback((direction) => {
    setDividerDirection(direction);
    setIsAddDividerModalOpen(true);
  }, []);

  const handleAddDivider = useCallback((dividerData) => {
    if (diagramRef.current?.addDivider) {
      diagramRef.current.addDivider(dividerData);
    }
  }, []);

  const handleAddArrow = useCallback((arrowData) => {
    if (diagramRef.current?.addArrow) {
      diagramRef.current.addArrow(arrowData);
    }
  }, []);

  const handleBulkEditNodes = useCallback((updates) => {
    if (diagramRef.current?.updateNodes) {
      diagramRef.current.updateNodes(updates);
    }
  }, []);

  const handleLoadDiagram = useCallback((diagramData) => {
    if (diagramRef.current?.loadDiagram) {
      diagramRef.current.loadDiagram(diagramData);
    }
    // 색상 설정 복원
    if (diagramData.colorItems && Array.isArray(diagramData.colorItems)) {
      loadColorItems(diagramData.colorItems);
    }
  }, [loadColorItems]);

  const handleLoadSample = useCallback(() => {
    if (diagramRef.current?.loadSample) {
      diagramRef.current.loadSample();
    }
  }, []);

  const handleClear = useCallback(() => {
    if (diagramRef.current?.clear) {
      diagramRef.current.clear();
    }
  }, []);

  const getDiagramData = useCallback(() => {
    if (diagramRef.current?.getDiagramData) {
      return diagramRef.current.getDiagramData();
    }
    return { nodes: [], edges: [], viewport: {} };
  }, []);

  return (
    <Container>
      <Header
        onGoHome={onGoHome}
        onAddNode={() => setIsAddNodeModalOpen(true)}
        onBulkAddNodes={() => setIsBulkAddNodesModalOpen(true)}
        onBulkEditData={() => setIsBulkEditDataModalOpen(true)}
        onAddGroup={() => setIsAddGroupModalOpen(true)}
        onAddDivider={handleOpenDividerModal}
        onAddArrow={() => setIsAddArrowModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onServerSync={() => setIsServerSyncModalOpen(true)}
        onLoadSample={handleLoadSample}
        onClear={handleClear}
      />
      <Content>
        <ProcessDiagram ref={diagramRef} />
      </Content>

      <AddNodeModal
        isOpen={isAddNodeModalOpen}
        onClose={() => setIsAddNodeModalOpen(false)}
        onAddNode={handleAddNode}
      />

      <BulkAddNodesModal
        isOpen={isBulkAddNodesModalOpen}
        onClose={() => setIsBulkAddNodesModalOpen(false)}
        onAddNodes={handleBulkAddNodes}
      />

      <BulkEditDataModal
        isOpen={isBulkEditDataModalOpen}
        onClose={() => setIsBulkEditDataModalOpen(false)}
        nodes={getDiagramData().nodes}
        onSave={handleBulkEditNodes}
      />

      <AddGroupModal
        isOpen={isAddGroupModalOpen}
        onClose={() => setIsAddGroupModalOpen(false)}
        onAddGroup={handleAddGroup}
      />

      <AddArrowModal
        isOpen={isAddArrowModalOpen}
        onClose={() => setIsAddArrowModalOpen(false)}
        onAddArrow={handleAddArrow}
      />

      <AddDividerModal
        isOpen={isAddDividerModalOpen}
        onClose={() => setIsAddDividerModalOpen(false)}
        onAddDivider={handleAddDivider}
        direction={dividerDirection}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />

      <ServerSyncModal
        isOpen={isServerSyncModalOpen}
        onClose={() => setIsServerSyncModalOpen(false)}
        currentDiagramData={getDiagramData()}
        colorItems={colorItems}
        onLoad={handleLoadDiagram}
      />
    </Container>
  );
};

const DevManufacturingProcessAppWithProvider = (props) => (
  <ColorSettingsProvider>
    <DevManufacturingProcessApp {...props} />
  </ColorSettingsProvider>
);

export default DevManufacturingProcessAppWithProvider;
