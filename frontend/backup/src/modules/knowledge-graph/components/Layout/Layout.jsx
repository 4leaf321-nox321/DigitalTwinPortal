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
  onLoadSampleData, // 샘플 데이터 로드 함수 추가
  filterOptions,
  onFilterChange,
  onTypeSettingsChange,
  currentGraphData = { nodes: [], edges: [] }, // 현재 그래프 데이터
  typeSettings = { nodeTypes: [], edgeTypes: [] }, // 타입 설정 추가
  // 모달 함수들
  showError,
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
      filterOptions={filterOptions}
      onFilterChange={onFilterChange}
      onTypeSettingsChange={onTypeSettingsChange}
      currentGraphData={currentGraphData}
      typeSettings={typeSettings}
      showError={showError}
        askWarningConfirm={askWarningConfirm}
        />
      <main className="layout-main">
        {children}
      </main>
    </div>
  );
};

export default Layout;