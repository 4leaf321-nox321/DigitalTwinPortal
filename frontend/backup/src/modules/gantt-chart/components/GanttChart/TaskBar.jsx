import React, { useState } from 'react';
import { categoryColors } from '../../data/sampleTasks';
import { formatDateKorean } from '../../utils/dateUtils';

const TaskBar = ({ 
  task, 
  position, 
  isSelected, 
  isDelayed, 
  isParent = false,
  onClick, 
  onUpdate 
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, originalLeft: 0 });

  const handleMouseDown = (e) => {
    e.stopPropagation();
    
    if (e.target.classList.contains('resize-handle')) {
      setIsResizing(true);
    } else {
      setIsDragging(true);
      setDragStart({
        x: e.clientX,
        originalLeft: position.left
      });
    }
  };

  // 부모 태스크와 자식 태스크 스타일 구분
  const getTaskBarStyle = () => {
    const baseStyle = {
      left: position.left,
      width: position.width,
      borderLeft: isDelayed ? '4px solid #e74c3c' : 'none'
    };

    if (isParent) {
      // 부모 태스크 스타일 - 더 두껍고 진한 색상
      return {
        ...baseStyle,
        backgroundColor: categoryColors[task.category] || '#95a5a6',
        opacity: 0.9,
        height: '32px',
        border: `2px solid ${categoryColors[task.category] || '#95a5a6'}`,
        background: `linear-gradient(135deg, ${categoryColors[task.category] || '#95a5a6'} 0%, ${adjustColorBrightness(categoryColors[task.category] || '#95a5a6', -20)} 100%)`,
        borderRadius: '6px',
        boxShadow: '0 3px 8px rgba(0, 0, 0, 0.2)',
        position: 'relative'
      };
    } else {
      // 자식 태스크 스타일 - 기본 스타일
      return {
        ...baseStyle,
        backgroundColor: categoryColors[task.category] || '#95a5a6',
        opacity: task.progress === 100 ? 0.7 : 1,
        height: '24px',
        borderRadius: '4px'
      };
    }
  };

  // 색상 밝기 조정 헬퍼 함수
  const adjustColorBrightness = (hex, percent) => {
    const num = parseInt(hex.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
  };

  const progressStyle = {
    width: `${task.progress}%`,
    backgroundColor: isParent ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.3)',
    borderRadius: 'inherit',
    height: '100%'
  };

  const taskBarStyle = getTaskBarStyle();

  return (
    <div 
      className={`task-bar ${isSelected ? 'selected' : ''} ${isDelayed ? 'delayed' : ''} ${isParent ? 'parent-task-bar' : 'child-task-bar'}`}
      style={taskBarStyle}
      onClick={onClick}
      onMouseDown={handleMouseDown}
      title={`${task.name}\n기간: ${formatDateKorean(task.startDate)} ~ ${formatDateKorean(task.endDate)}\n진행률: ${task.progress}%\n담당자: ${task.assignee}`}
    >
      {/* 진행률 표시 */}
      <div className="task-progress" style={progressStyle}>
        {/* 부모 태스크의 경우 진행률 패턴 추가 */}
        {isParent && (
          <div 
            className="parent-progress-pattern"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)',
              borderRadius: 'inherit'
            }}
          />
        )}
      </div>
      
      {/* 태스크 내용 */}
      <div className="task-bar-content">
        {/* 부모 태스크 표시 아이콘 */}
        {isParent && (
          <span className="parent-task-icon" style={{ marginRight: '4px', fontSize: '12px' }}>
            📋
          </span>
        )}
        
        <span className={`task-bar-name ${isParent ? 'parent-task-name' : ''}`}>
          {task.name}
        </span>
        
        {/* 지연 표시 */}
        {isDelayed && <span className="delayed-indicator">⚠️</span>}
        
        {/* 부모 태스크의 경우 자식 개수 표시 */}
        {isParent && task.children && task.children.length > 0 && (
          <span className="children-count" style={{ 
            marginLeft: 'auto', 
            fontSize: '10px', 
            background: 'rgba(255,255,255,0.3)', 
            padding: '1px 4px', 
            borderRadius: '8px',
            color: 'white',
            fontWeight: 'bold'
          }}>
            {task.children.length}
          </span>
        )}
      </div>

      {/* 리사이즈 핸들 */}
      {isSelected && (
        <>
          <div className="resize-handle resize-left"></div>
          <div className="resize-handle resize-right"></div>
        </>
      )}
    </div>
  );
};

export default TaskBar;
