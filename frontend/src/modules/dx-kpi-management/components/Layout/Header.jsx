import React from 'react';
import { TrendingUp, PlusCircle, Settings, Database, BarChart3, Download, MessageSquarePlus, FileText, ClipboardPaste } from 'lucide-react';
import CommonHeader from '../../../../shared/components/Header/CommonHeader';

const Header = ({ onGoHome, onRecord, onAddTrend, onImport, onExcelExport, onSettings, viewMode, onViewModeChange }) => {
  return (
    <CommonHeader
      logo={<TrendingUp size={24} strokeWidth={2} />}
      title="DX 부문 KPI 관리"
      titleColor="#8b5cf6"
      onGoHome={onGoHome}
      showStats={false}
      className="dx-kpi-management-header"
      rightContent={
        <>
          <button
            className="header-btn add-btn"
            onClick={onRecord}
            title="KPI 입력"
          >
            <PlusCircle size={16} strokeWidth={2} />
            <span>KPI 입력</span>
          </button>
          <button
            className="header-btn add-btn"
            onClick={onAddTrend}
            title="주간 주요 동향 추가"
          >
            <MessageSquarePlus size={16} strokeWidth={2} />
            <span>주간 주요 동향 추가</span>
          </button>
          <button
            className="header-btn add-btn"
            onClick={onImport}
            title="주간보고 워드에서 표를 복사해 붙여 넣습니다"
          >
            <ClipboardPaste size={16} strokeWidth={2} />
            <span>주간보고 가져오기</span>
          </button>
          <button
            className="header-btn action-btn"
            onClick={onExcelExport}
            title="Excel 저장"
          >
            <Download size={16} strokeWidth={2} />
            <span>Excel 저장</span>
          </button>
          <div className="view-toggle" style={{ marginLeft: 4 }}>
            <button
              className={`toggle-btn ${viewMode === 'raw' ? 'active' : ''}`}
              onClick={() => onViewModeChange('raw')}
              title="KPI Raw 데이터"
            >
              <Database size={14} strokeWidth={2} />
              <span>KPI Raw 데이터</span>
            </button>
            <button
              className={`toggle-btn ${viewMode === 'summary' ? 'active' : ''}`}
              onClick={() => onViewModeChange('summary')}
              title="KPI 종합 데이터"
            >
              <BarChart3 size={14} strokeWidth={2} />
              <span>KPI 종합 데이터</span>
            </button>
            <button
              className={`toggle-btn ${viewMode === 'trend' ? 'active' : ''}`}
              onClick={() => onViewModeChange('trend')}
              title="주간 주요 동향"
            >
              <FileText size={14} strokeWidth={2} />
              <span>주간 주요 동향</span>
            </button>
          </div>
          <button
            className="header-btn action-btn"
            onClick={onSettings}
            title="KPI 목표치 설정"
          >
            <Settings size={16} strokeWidth={2} />
            <span>설정</span>
          </button>
        </>
      }
    />
  );
};

export default Header;
