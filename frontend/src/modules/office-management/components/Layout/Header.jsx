import React from 'react';
import { BarChart3, CalendarDays, List, TableProperties, Download, Building2 } from 'lucide-react';
import { CommonHeader } from '../../../../shared/components/Header';

const Header = ({ onGoHome, viewMode = 'weekly', onViewModeChange, onBulkAdd, onExportData }) => {
  const centerContent = (
    <div className="header-center-content">
      <button
        className="bulk-add-btn"
        onClick={onBulkAdd}
        title="엑셀에서 여러 안건 붙여넣기"
      >
        <TableProperties size={16} strokeWidth={2} />
        <span>여러 안건 추가</span>
      </button>
      <button
        className="export-btn"
        onClick={onExportData}
        title="CSV 파일로 저장"
      >
        <Download size={16} strokeWidth={2} />
        <span>로컬 데이터 저장</span>
      </button>
      <div className="header-actions">
        <div className="view-toggle">
          <button
            className={`toggle-btn ${viewMode === 'weekly' ? 'active' : ''}`}
            onClick={() => onViewModeChange && onViewModeChange('weekly')}
            title="주간 업무 보기"
          >
            <CalendarDays size={16} strokeWidth={2} />
            <span>주간 업무</span>
          </button>
          <button
            className={`toggle-btn ${viewMode === 'agenda' ? 'active' : ''}`}
            onClick={() => onViewModeChange && onViewModeChange('agenda')}
            title="주간 업무 (안건별) 보기"
          >
            <List size={16} strokeWidth={2} />
            <span>주간 업무 (안건별)</span>
          </button>
          <button
            className={`toggle-btn ${viewMode === 'business-contact' ? 'active' : ''}`}
            onClick={() => onViewModeChange && onViewModeChange('business-contact')}
            title="사업부 담당 창구"
          >
            <Building2 size={16} strokeWidth={2} />
            <span>사업부 담당 창구</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <CommonHeader
        logo={<BarChart3 size={24} strokeWidth={2} />}
        title="사무국 운영"
        titleColor="#4f46e5"
        onGoHome={onGoHome}
        showStats={false}
        centerContent={centerContent}
        className="office-management-header"
      />

      <style>{`
        .office-management-header .header-center-content {
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          gap: 0 !important;
        }

        .office-management-header .header-actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .office-management-header .view-toggle {
          display: flex;
          background: #f1f5f9;
          border-radius: 0.5rem;
          padding: 0.25rem;
        }

        .office-management-header .toggle-btn {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          background: transparent;
          color: #64748b;
        }

        .office-management-header .toggle-btn:hover {
          color: #1e293b;
        }

        .office-management-header .toggle-btn.active {
          background: white;
          color: #4f46e5;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .office-management-header .bulk-add-btn {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.5rem 1rem;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          background: white;
          color: #4f46e5;
          margin-right: 0.75rem;
        }

        .office-management-header .bulk-add-btn:hover {
          background: #eef2ff;
          border-color: #c7d2fe;
        }

        .office-management-header .export-btn {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.5rem 1rem;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          background: white;
          color: #16a34a;
          margin-right: 0.75rem;
        }

        .office-management-header .export-btn:hover {
          background: #f0fdf4;
          border-color: #bbf7d0;
        }
      `}</style>
    </>
  );
};

export default Header;
