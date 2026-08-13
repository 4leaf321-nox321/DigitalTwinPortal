import React from 'react';
import { X, Edit3, Trash2, Copy, Calendar, User, BarChart } from 'lucide-react';
import { formatDateKorean, getDaysBetween } from '../../utils/dateUtils';
import { getTaskStatus, isTaskDelayed } from '../../utils/taskUtils';
import { categoryColors, priorityColors } from '../../data/sampleTasks';
import './TaskPanel.css';

const TaskPanel = ({ 
  task, 
  onClose, 
  onEdit, 
  onDelete, 
  onDuplicate 
}) => {
  if (!task) return null;

  const status = getTaskStatus(task.progress);
  const isDelayed = isTaskDelayed(task);
  const duration = getDaysBetween(task.startDate, task.endDate) + 1;

  const statusLabels = {
    notStarted: '미시작',
    inProgress: '진행중',
    completed: '완료'
  };

  const priorityLabels = {
    low: '낮음',
    medium: '보통',
    high: '높음',
    critical: '긴급'
  };

  const categoryLabels = {
    planning: '기획',
    design: '설계',
    development: '개발',
    testing: '테스트',
    deployment: '배포'
  };

  return (
    <div className="task-panel">
      <div className="panel-header">
        <div className="panel-title">
          <div 
            className="task-priority-dot"
            style={{ backgroundColor: priorityColors[task.priority] }}
          ></div>
          <h3>{task.name}</h3>
        </div>
        <button 
          className="close-btn"
          onClick={onClose}
          title="패널 닫기"
        >
          <X size={20} />
        </button>
      </div>

      <div className="panel-content">
        {/* 기본 정보 */}
        <div className="info-section">
          <h4>기본 정보</h4>
          <div className="info-grid">
            <div className="info-item">
              <Calendar size={16} />
              <div className="info-content">
                <label>기간</label>
                <span>{formatDateKorean(task.startDate)} ~ {formatDateKorean(task.endDate)}</span>
                <small>{duration}일</small>
              </div>
            </div>
            
            <div className="info-item">
              <User size={16} />
              <div className="info-content">
                <label>담당자</label>
                <span>{task.assignee || '미지정'}</span>
              </div>
            </div>
            
            <div className="info-item">
              <BarChart size={16} />
              <div className="info-content">
                <label>진행률</label>
                <div className="progress-info">
                  <div className="progress-bar-mini">
                    <div 
                      className="progress-fill"
                      style={{ 
                        width: `${task.progress}%`,
                        backgroundColor: isDelayed ? '#f44336' : '#4caf50'
                      }}
                    ></div>
                  </div>
                  <span className="progress-value">{task.progress}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 상태 정보 */}
        <div className="info-section">
          <h4>상태</h4>
          <div className="status-grid">
            <div className="status-item">
              <label>진행 상태</label>
              <span 
                className={`status-badge ${status}`}
              >
                {statusLabels[status]}
              </span>
            </div>
            
            <div className="status-item">
              <label>우선순위</label>
              <span 
                className={`priority-badge ${task.priority}`}
                style={{ backgroundColor: priorityColors[task.priority] }}
              >
                {priorityLabels[task.priority]}
              </span>
            </div>
            
            <div className="status-item">
              <label>카테고리</label>
              <span 
                className="category-badge"
                style={{ 
                  backgroundColor: categoryColors[task.category] || '#95a5a6',
                  color: 'white'
                }}
              >
                {categoryLabels[task.category] || task.category}
              </span>
            </div>

            {isDelayed && (
              <div className="status-item warning">
                <label>⚠️ 지연</label>
                <span className="delayed-text">
                  종료일이 지났습니다
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 설명 */}
        {task.description && (
          <div className="info-section">
            <h4>설명</h4>
            <div className="description-content">
              {task.description}
            </div>
          </div>
        )}

        {/* 계층 구조 정보 */}
        <div className="info-section">
          <h4>계층 구조</h4>
          <div className="hierarchy-info">
            <div className="hierarchy-item">
              <label>유형</label>
              <span className={`task-type-badge ${task.isParent ? 'parent' : 'child'}`}>
                {task.isParent ? '📋 부모 태스크' : '테스크'}
              </span>
            </div>
            
            <div className="hierarchy-item">
              <label>레벨</label>
              <span className="level-badge">
                Level {task.level}
              </span>
            </div>
            
            {task.isParent && task.children && task.children.length > 0 && (
              <div className="hierarchy-item">
                <label>테스크</label>
                <span className="children-badge">
                  {task.children.length}개
                </span>
              </div>
            )}
            
            {task.parentId && (
              <div className="hierarchy-item">
                <label>부모 태스크</label>
                <span className="parent-badge">
                  {task.parentId}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 의존성 */}
        {task.dependencies && task.dependencies.length > 0 && (
          <div className="info-section">
            <h4>의존성</h4>
            <div className="dependencies-list">
              {task.dependencies.map((depId, index) => (
                <span key={index} className="dependency-item">
                  {depId}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 액션 버튼들 */}
      <div className="panel-actions">
        <button 
          className="action-btn edit-btn"
          onClick={() => onEdit(task)}
          title="태스크 편집"
        >
          <Edit3 size={16} />
          <span>편집</span>
        </button>
        
        <button 
          className="action-btn duplicate-btn"
          onClick={() => onDuplicate(task.id)}
          title="태스크 복제"
        >
          <Copy size={16} />
          <span>복제</span>
        </button>
        
        <button 
          className="action-btn delete-btn"
          onClick={() => onDelete(task.id)}
          title="태스크 삭제"
        >
          <Trash2 size={16} />
          <span>삭제</span>
        </button>
      </div>
    </div>
  );
};

export default TaskPanel;
