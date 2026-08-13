import React, { useState, useCallback, useRef } from 'react';
import styled from 'styled-components';
import Header from './components/Layout/Header';
import WeeklyReport from './components/WeeklyReport';
import BulkAddModal from './components/WeeklyReport/BulkAddModal';
import BusinessContactTable from './components/BusinessContactTable/BusinessContactTable';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f8fafc;
`;

const Content = styled.main`
  flex: 1;
  display: flex;
  overflow: hidden;
`;

const PlaceholderContent = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  color: #64748b;
  font-weight: 500;
`;

const OfficeManagementApp = ({ onGoHome }) => {
  const [viewMode, setViewMode] = useState('weekly'); // 'weekly' | 'agenda' | 'business-contact'
  const [isBulkAddModalOpen, setIsBulkAddModalOpen] = useState(false);
  const bulkAddHandlerRef = useRef(null);
  const exportHandlerRef = useRef(null);

  const handleOpenBulkAdd = useCallback(() => {
    setIsBulkAddModalOpen(true);
  }, []);

  const handleCloseBulkAdd = useCallback(() => {
    setIsBulkAddModalOpen(false);
  }, []);

  const handleBulkAdd = useCallback((items) => {
    if (bulkAddHandlerRef.current) {
      bulkAddHandlerRef.current(items);
    }
  }, []);

  const handleRegisterBulkAddHandler = useCallback((handler) => {
    bulkAddHandlerRef.current = handler;
  }, []);

  const handleExportData = useCallback(() => {
    if (exportHandlerRef.current) {
      exportHandlerRef.current();
    }
  }, []);

  const handleRegisterExportHandler = useCallback((handler) => {
    exportHandlerRef.current = handler;
  }, []);

  return (
    <Container>
      <Header
        onGoHome={onGoHome}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onBulkAdd={handleOpenBulkAdd}
        onExportData={handleExportData}
      />
      <Content>
        {viewMode === 'business-contact' ? (
          <BusinessContactTable />
        ) : (
          <WeeklyReport
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onRegisterBulkAddHandler={handleRegisterBulkAddHandler}
            onRegisterExportHandler={handleRegisterExportHandler}
          />
        )}
      </Content>
      <BulkAddModal
        isOpen={isBulkAddModalOpen}
        onClose={handleCloseBulkAdd}
        onAdd={handleBulkAdd}
      />
    </Container>
  );
};

export default OfficeManagementApp;
