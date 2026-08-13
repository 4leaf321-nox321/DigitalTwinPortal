import React from 'react';
import { progressColors, priorityColors } from '../../../data/sampleTasks';

const GanttLegend = () => {
  return (
    <div className="gantt-legend">
      <div className="legend-group">
        <span className="legend-title">진행 상태:</span>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: progressColors.notStarted }}></div>
          <span>미시작</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: progressColors.inProgress }}></div>
          <span>진행중</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: progressColors.completed }}></div>
          <span>완료</span>
        </div>
      </div>
      
      <div className="legend-group">
        <span className="legend-title">우선순위:</span>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: priorityColors.low }}></div>
          <span>낮음</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: priorityColors.medium }}></div>
          <span>보통</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: priorityColors.high }}></div>
          <span>높음</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: priorityColors.critical }}></div>
          <span>긴급</span>
        </div>
      </div>
      
      <div className="legend-group">
        <span className="legend-title">계층 구조:</span>
        <div className="legend-item">
          <div className="legend-symbol">📋</div>
          <span>부모 태스크</span>
        </div>
        <div className="legend-item">
          <div className="legend-symbol">📄</div>
          <span>테스크</span>
        </div>
      </div>
      
      <div className="legend-group">
        <span className="legend-title">단축키:</span>
        <div className="legend-item keyboard-shortcut">
          <kbd className="legend-kbd">Delete</kbd>
          <span>선택된 태스크 삭제</span>
        </div>
      </div>
    </div>
  );
};

export default GanttLegend;