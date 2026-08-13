import React from 'react';
import { Target, Plus, ListPlus, Settings, BarChart3, List } from 'lucide-react';
import CommonHeader from '../../../../shared/components/Header/CommonHeader';

const Header = ({ onGoHome, onAddTask, onBulkAddTask, onOpenSettings, viewMode, onViewModeChange }) => {
  return (
    <CommonHeader
      logo={<Target size={24} strokeWidth={2} />}
      title="제조 디지털 트윈 과제 관리"
      titleColor="#10b981"
      onGoHome={onGoHome}
      showStats={false}
      className="digital-twin-task-management-header"
      rightContent={
        <>
          <button
            className="header-btn add-btn"
            onClick={onAddTask}
            title="새 과제 추가"
          >
            <Plus size={18} strokeWidth={2} />
            <span>새 과제 추가</span>
          </button>
          <button
            className="header-btn action-btn"
            onClick={onBulkAddTask}
            title="여러 과제 추가"
          >
            <ListPlus size={18} strokeWidth={2} />
            <span>여러 과제 추가</span>
          </button>
          <div className="view-toggle">
            <button
              className={`toggle-btn ${viewMode === 'dashboard' ? 'active' : ''}`}
              onClick={() => onViewModeChange('dashboard')}
              title="대시보드"
            >
              <BarChart3 size={16} strokeWidth={2} />
              <span>대시보드</span>
            </button>
            <button
              className={`toggle-btn ${viewMode === 'tasks' ? 'active' : ''}`}
              onClick={() => onViewModeChange('tasks')}
              title="전체 과제 현황"
            >
              <List size={16} strokeWidth={2} />
              <span>전체 과제 현황</span>
            </button>
          </div>
          <button
            className="header-btn action-btn"
            onClick={onOpenSettings}
            title="설정"
          >
            <Settings size={18} strokeWidth={2} />
            <span>설정</span>
          </button>
        </>
      }
    />
  );
};

export default Header;
