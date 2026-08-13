import React from 'react';
import { Users2, FileText, CalendarCheck } from 'lucide-react';
import { CommonHeader } from '../../../../shared/components/Header';

const Header = ({ onGoHome, viewMode = 'summary', onViewModeChange }) => {
  const centerContent = (
    <div className="header-center-content">
      <div className="header-actions">
        <div className="view-toggle">
          <button
            className={`toggle-btn ${viewMode === 'summary' ? 'active' : ''}`}
            onClick={() => onViewModeChange && onViewModeChange('summary')}
            title="보고 내용 요약"
          >
            <FileText size={16} strokeWidth={2} />
            <span>보고 내용 요약</span>
          </button>
          <button
            className={`toggle-btn ${viewMode === 'plan' ? 'active' : ''}`}
            onClick={() => onViewModeChange && onViewModeChange('plan')}
            title="보고 계획"
          >
            <CalendarCheck size={16} strokeWidth={2} />
            <span>보고 계획</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <CommonHeader
        logo={<Users2 size={24} strokeWidth={2} />}
        title="협의체/회의체/보고"
        titleColor="#8b5cf6"
        onGoHome={onGoHome}
        showStats={false}
        centerContent={centerContent}
        className="meeting-management-header"
      />

      <style>{`
        .meeting-management-header .header-center-content {
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          gap: 0 !important;
        }

        .meeting-management-header .header-actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .meeting-management-header .view-toggle {
          display: flex;
          background: #f1f5f9;
          border-radius: 0.5rem;
          padding: 0.25rem;
        }

        .meeting-management-header .toggle-btn {
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

        .meeting-management-header .toggle-btn:hover {
          color: #1e293b;
        }

        .meeting-management-header .toggle-btn.active {
          background: white;
          color: #8b5cf6;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
      `}</style>
    </>
  );
};

export default Header;
