import React from 'react';
import Header from './Header';
import './Layout.css';

const Layout = ({
  children,
  searchQuery,
  onSearchChange,
  layoutType,
  onLayoutChange,
  onDataImport,
  onDataExport,
  onLoadSampleData,
  onLoadFromServer,
  filterOptions,
  onFilterChange,
  onTypeSettingsChange,
  currentGraphData = { nodes: [], edges: [] },
  typeSettings = { nodeTypes: [], edgeTypes: [] },
  showError,
  showSuccess,
  showInfo,
  askWarningConfirm
}) => {
  return (
    <div className="layout">
      <Header
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        layoutType={layoutType}
        onLayoutChange={onLayoutChange}
        onDataImport={onDataImport}
        onDataExport={onDataExport}
        onLoadSampleData={onLoadSampleData}
        onLoadFromServer={onLoadFromServer}
        filterOptions={filterOptions}
        onFilterChange={onFilterChange}
        onTypeSettingsChange={onTypeSettingsChange}
        currentGraphData={currentGraphData}
        typeSettings={typeSettings}
        showError={showError}
        showSuccess={showSuccess}
        showInfo={showInfo}
        askWarningConfirm={askWarningConfirm}
      />
      <main className="layout-main">
        {children}
      </main>
    </div>
  );
};

export default Layout;