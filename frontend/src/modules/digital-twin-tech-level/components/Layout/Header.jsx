import React from 'react';
import { Share2, Plus, Settings, Database, Table, Target, Box, Cloud } from 'lucide-react';
import { CommonHeader } from '../../../../shared/components/Header';

const Header = ({ onGoHome, onAddData, onBulkAdd, onOpenSettings, onServerSync, viewMode = 'table', onViewModeChange }) => {
  // 중앙 액션 버튼
  const centerContent = (
    <div className="header-center-content">
      <button
        className="add-data-btn"
        onClick={onAddData}
        title="데이터 추가"
      >
        <Plus size={16} strokeWidth={2} />
        <span>데이터 추가</span>
      </button>
      <button
        className="bulk-add-btn"
        onClick={onBulkAdd}
        title="데이터 일괄 추가"
      >
        <Database size={16} strokeWidth={2} />
        <span>데이터 일괄 추가</span>
      </button>
      <button
        className="server-sync-btn"
        onClick={onServerSync}
        title="서버 저장/불러오기"
      >
        <Cloud size={16} strokeWidth={2} />
        <span>서버 저장/불러오기</span>
      </button>
      <button
        className="settings-btn"
        onClick={onOpenSettings}
        title="설정"
      >
        <Settings size={16} strokeWidth={2} />
        <span>설정</span>
      </button>
      <div className="header-actions">
        <div className="view-toggle">
          <button
            className={`toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
            onClick={() => onViewModeChange && onViewModeChange('table')}
            title="메가 과제 리스트"
          >
            <Table size={16} strokeWidth={2} />
            <span>메가 과제 리스트</span>
          </button>
          <button
            className={`toggle-btn ${viewMode === 'radar' ? 'active' : ''}`}
            onClick={() => onViewModeChange && onViewModeChange('radar')}
            title="테크 레이더 뷰"
          >
            <Target size={16} strokeWidth={2} />
            <span>테크 레이더 뷰</span>
          </button>
          <button
            className={`toggle-btn ${viewMode === 'component' ? 'active' : ''}`}
            onClick={() => onViewModeChange && onViewModeChange('component')}
            title="구성 요소 현황"
          >
            <Box size={16} strokeWidth={2} />
            <span>구성 요소 현황</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <CommonHeader
        logo={<Share2 size={24} strokeWidth={2} />}
        title="디지털 트윈 메가 과제 기획"
        titleColor="#8b5cf6"
        onGoHome={onGoHome}
        centerContent={centerContent}
        showStats={false}
        className="digital-twin-tech-level-header"
      />

      <style>{`
        .digital-twin-tech-level-header .header-center-content {
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          gap: 0 !important;
        }

        .digital-twin-tech-level-header .header-actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .digital-twin-tech-level-header .view-toggle {
          display: flex;
          background: #f1f5f9;
          border-radius: 0.5rem;
          padding: 0.25rem;
        }

        .digital-twin-tech-level-header .toggle-btn {
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

        .digital-twin-tech-level-header .toggle-btn:hover {
          color: #1e293b;
        }

        .digital-twin-tech-level-header .toggle-btn.active {
          background: white;
          color: #8b5cf6;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .digital-twin-tech-level-header .add-data-btn {
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
          color: #8b5cf6;
          margin-right: 0.75rem;
        }

        .digital-twin-tech-level-header .add-data-btn:hover {
          background: #f5f3ff;
          border-color: #c4b5fd;
        }

        .digital-twin-tech-level-header .bulk-add-btn {
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
          color: #7c3aed;
          margin-right: 0.75rem;
        }

        .digital-twin-tech-level-header .bulk-add-btn:hover {
          background: #f5f3ff;
          border-color: #c4b5fd;
        }

        .digital-twin-tech-level-header .server-sync-btn {
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
          background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
          color: white;
          margin-right: 0.75rem;
        }

        .digital-twin-tech-level-header .server-sync-btn:hover {
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
        }

        .digital-twin-tech-level-header .settings-btn {
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
          color: #64748b;
          margin-right: 0.75rem;
        }

        .digital-twin-tech-level-header .settings-btn:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }
      `}</style>
    </>
  );
};

export default Header;
