import React from 'react';
import { formatDateKorean } from '../../../utils/dateUtils';

const GanttToolbar = ({
  viewModeState,
  scale,
  projectRange,
  todayPosition,
  onViewModeChange,
  onZoom,
  onScrollToToday
}) => {
  return (
    <div className="gantt-toolbar">
      <div className="toolbar-left">
        {/* 뷰 모드 선택 */}
        <div className="view-mode-controls">
          <span className="view-mode-label">뷰:</span>
          <div className="view-mode-buttons">
            <button 
              className={`view-mode-btn ${viewModeState === 'days' ? 'active' : ''}`}
              onClick={() => onViewModeChange('days')}
              title="일단위 보기"
            >
              일
            </button>
            <button 
              className={`view-mode-btn ${viewModeState === 'weeks' ? 'active' : ''}`}
              onClick={() => onViewModeChange('weeks')}
              title="주단위 보기"
            >
              주
            </button>
            <button 
              className={`view-mode-btn ${viewModeState === 'months' ? 'active' : ''}`}
              onClick={() => onViewModeChange('months')}
              title="월단위 보기"
            >
              월
            </button>
            <button 
              className={`view-mode-btn ${viewModeState === 'years' ? 'active' : ''}`}
              onClick={() => onViewModeChange('years')}
              title="연단위 보기"
            >
              연
            </button>
          </div>
        </div>
        
        <div className="zoom-controls">
          <button 
            className="zoom-btn" 
            onClick={() => onZoom('in')}
            title="확대"
          >
            ➕
          </button>
          <span className="zoom-level">{Math.round(scale * 100)}%</span>
          <button 
            className="zoom-btn" 
            onClick={() => onZoom('out')}
            title="축소"
          >
            ➖
          </button>
        </div>
      </div>
      
      <div className="toolbar-center">
        <div className="period-info">
          프로젝트 기간: {formatDateKorean(projectRange.start)} ~ {formatDateKorean(projectRange.end)}
        </div>
      </div>
      
      <div className="toolbar-right">
        {todayPosition >= 0 && (
          <button 
            className="today-btn" 
            onClick={onScrollToToday}
            title="오늘로 이동"
          >
            📅 오늘
          </button>
        )}
      </div>
    </div>
  );
};

export default GanttToolbar;
