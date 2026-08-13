import React from 'react';
import { Activity, BarChart3, Calendar, Plus, Settings, Download, Upload, FileText, Database, Trash2, Target, Save } from 'lucide-react';
import { CommonHeader } from '../../../../shared/components/Header';

const Header = ({ 
  onGoHome,
  viewMode = 'dashboard',
  onViewModeChange,
  onAddProject,
  onAddMultipleProjects,
  onAddPerformance,
  onManageSettings,
  onExportData,
  onImportData,
  onClearAllData,
  onCreateBackup
}) => {
  // 간단한 통계 데이터 (개발중이므로 기본값)
  const statsData = [
    {
      label: '개발중',
      style: {
        backgroundColor: '#e7f3ff',
        color: '#0066cc',
        borderColor: '#b3d9ff'
      }
    }
  ];

  const handleClearAllData = () => {
    if (window.confirm('⚠️ 모든 데이터를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.\n계속하려면 "확인"을 클릭하세요.')) {
      if (window.confirm('정말로 모든 프로젝트 데이터를 삭제하시겠습니까?\n\n마지막 확인입니다.')) {
        onClearAllData && onClearAllData();
      }
    }
  };

  // 중앙 액션 버튼들
  const centerContent = (
    <div className="header-center-content">
      {/* 새 과제 추가 버튼들 - 간트 뷰에서만 표시 */}
      {viewMode === 'gantt' && (
        <div className="header-gantt-actions">
          <div className="add-project-buttons">
            <button 
              className="add-performance-btn"
              onClick={onAddPerformance}
              title="새 성과 추가"
            >
              <Target size={16} strokeWidth={2} />
              <span>새 성과 추가</span>
            </button>
            
            <button 
              className="add-project-btn"
              onClick={onAddProject}
              title="새 과제 추가"
            >
              <Plus size={16} strokeWidth={2} />
              <span>새 과제 추가</span>
            </button>
            
            <button 
              className="add-multiple-projects-btn"
              onClick={onAddMultipleProjects}
              title="여러 과제 한번에 추가"
            >
              <Database size={16} strokeWidth={2} />
              <span>여러 과제 추가</span>
            </button>
          </div>
          
          {/* 데이터 가져오기/내보내기 버튼들 */}
          <div className="import-export-buttons">
            <button 
              className="import-export-btn backup-btn"
              onClick={onCreateBackup}
              title="전체 데이터 백업 파일 생성"
            >
              <Save size={16} strokeWidth={2} />
              <span>💾 백업 생성</span>
            </button>

            <button 
              className="import-export-btn export-btn hybrid-btn"
              onClick={onExportData}
              title="JSON/CSV 형식으로 데이터 내보내기 (로컬 저장)"
            >
              <Target size={16} strokeWidth={2} />
              <span>🎯 로컬 저장</span>
            </button>
            
            <button 
              className="import-export-btn import-btn"
              onClick={onImportData}
              title="JSON/CSV 파일 불러오기 (자동 형식 감지)"
            >
              <Upload size={16} strokeWidth={2} />
              <span>📂 파일 불러오기</span>
            </button>

            <button 
              className="import-export-btn clear-btn"
              onClick={handleClearAllData}
              title="모든 데이터 삭제"
            >
              <Trash2 size={16} strokeWidth={2} />
              <span>전체 삭제</span>
            </button>
          </div>
        </div>
      )}
      
      {/* View Toggle */}
      <div className="header-actions">
        <div className="view-toggle">
          <button 
            className={`toggle-btn ${viewMode === 'dashboard' ? 'active' : ''}`}
            onClick={() => onViewModeChange('dashboard')}
            title="대시보드 뷰"
          >
            <BarChart3 size={16} strokeWidth={2} />
            <span>대시보드</span>
          </button>
          <button 
            className={`toggle-btn ${viewMode === 'gantt' ? 'active' : ''}`}
            onClick={() => onViewModeChange('gantt')}
            title="간트 차트 뷰"
          >
            <Calendar size={16} strokeWidth={2} />
            <span>과제 진행 현황</span>
          </button>
        </div>
      </div>
    </div>
  );

  // 설정 버튼 (홈 버튼 왼쪽에 표시)
  const settingsButton = (
    <button 
      className="header-btn action-btn settings-btn"
      onClick={onManageSettings}
      title="시스템 설정"
      style={{
        backgroundColor: '#8b5cf6',
        color: '#ffffff',
        borderColor: '#7c3aed',
        marginRight: '0.75rem'
      }}
    >
      <Settings size={18} strokeWidth={2} />
      <span>설정</span>
    </button>
  );

  return (
    <>
      <CommonHeader
        logo={<Activity size={24} strokeWidth={2} />}
        title="Digital Twin Dashboard"
        titleColor="#0066cc"
        centerContent={centerContent}
        rightContent={settingsButton}
        statsData={statsData}
        onGoHome={onGoHome}
        className="digital-twin-dashboard-header"
      />
      
      {/* 추가 스타일 */}
      <style>{`
        .header-gantt-actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        
        .add-project-buttons {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .import-export-buttons {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        
        .import-export-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          border: 1px solid;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          background: white;
          white-space: nowrap;
        }
        
        .export-btn.hybrid-btn {
          color: #059669;
          border-color: #059669;
          background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
          position: relative;
        }
        
        .export-btn.hybrid-btn:hover {
          background: linear-gradient(135deg, #dcfce7 0%, #d1fae5 100%);
          border-color: #047857;
          color: #047857;
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(5, 150, 105, 0.2);
        }
        
        .import-btn {
          color: #0066cc;
          border-color: #0066cc;
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
        }
        
        .import-btn:hover {
          background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
          border-color: #1d4ed8;
          color: #1d4ed8;
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(0, 102, 204, 0.2);
        }
        
        .clear-btn {
          color: #ef4444;
          border-color: #ef4444;
        }
        
        .clear-btn:hover {
          background: #fef2f2;
          border-color: #dc2626;
          color: #dc2626;
          transform: scale(1.05);
        }
        
        .clear-btn:active {
          transform: scale(0.95);
        }
        
        .backup-btn {
          color: #8b5cf6;
          border-color: #8b5cf6;
          background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%);
        }
        
        .backup-btn:hover {
          background: linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%);
          border-color: #7c3aed;
          color: #7c3aed;
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(139, 92, 246, 0.2);
        }
        
        .add-performance-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: #f59e0b;
          color: white;
          border: 1px solid #d97706;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .add-performance-btn:hover {
          background: #d97706;
          border-color: #b45309;
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(245, 158, 11, 0.3);
        }
        
        .add-project-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: #0066cc;
          color: white;
          border: 1px solid #004499;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .add-project-btn:hover {
          background: #004499;
          border-color: #003366;
        }
        
        .add-multiple-projects-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: #8b5cf6;
          color: white;
          border: 1px solid #7c3aed;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .add-multiple-projects-btn:hover {
          background: #7c3aed;
          border-color: #6d28d9;
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(139, 92, 246, 0.3);
        }
        
        /* 하이브리드 버튼에 특별한 강조 효과 */
        .export-btn.hybrid-btn::before {
          content: '';
          position: absolute;
          top: -2px;
          left: -2px;
          right: -2px;
          bottom: -2px;
          background: linear-gradient(45deg, #10b981, #059669, #047857);
          border-radius: 0.5rem;
          z-index: -1;
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        
        .export-btn.hybrid-btn:hover::before {
          opacity: 0.2;
        }
      `}</style>
    </>
  );
};

export default Header;