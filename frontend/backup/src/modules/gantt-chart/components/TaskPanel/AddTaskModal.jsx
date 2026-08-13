import React, { useState, useEffect } from 'react';
import { X, Calendar, User, BarChart, Tag, AlertCircle } from 'lucide-react';
import { categoryColors, priorityColors } from '../../data/sampleTasks';
import './EditTaskModal.css'; // 기존 EditTaskModal의 스타일을 재사용

const AddTaskModal = ({ 
  isOpen, 
  onClose, 
  onSave,
  allTasks = [] // 부모 태스크 선택을 위한 전체 태스크 목록
}) => {
  const [newTask, setNewTask] = useState({
    name: '',
    startDate: '',
    endDate: '',
    assignee: '',
    progress: 0,
    priority: 'medium',
    category: 'development',
    description: '',
    parentId: null
  });

  const [errors, setErrors] = useState({});

  // 모달이 열릴 때 초기값 설정
  useEffect(() => {
    if (isOpen) {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      setNewTask({
        name: '',
        startDate: today.toISOString().split('T')[0],
        endDate: tomorrow.toISOString().split('T')[0],
        assignee: '',
        progress: 0,
        priority: 'medium',
        category: 'development',
        description: '',
        parentId: null
      });
      setErrors({});
    }
  }, [isOpen]);

  const validateForm = () => {
    const newErrors = {};

    if (!newTask.name.trim()) {
      newErrors.name = '태스크 이름을 입력해주세요.';
    }

    if (!newTask.startDate) {
      newErrors.startDate = '시작일을 선택해주세요.';
    }

    if (!newTask.endDate) {
      newErrors.endDate = '종료일을 선택해주세요.';
    }

    if (newTask.startDate && newTask.endDate && 
        new Date(newTask.startDate) > new Date(newTask.endDate)) {
      newErrors.endDate = '종료일은 시작일보다 늦어야 합니다.';
    }

    if (newTask.progress < 0 || newTask.progress > 100) {
      newErrors.progress = '진행률은 0-100 사이의 값이어야 합니다.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validateForm()) {
      onSave(newTask);
    }
  };

  const handleInputChange = (field, value) => {
    setNewTask(prev => ({
      ...prev,
      [field]: value
    }));

    // 해당 필드의 에러 제거
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  // 부모 태스크로 선택 가능한 태스크들
  const availableParentTasks = allTasks.filter(t => {
    // 모든 태스크를 부모로 선택 가능
    return true;
  });
  
  // 트리 구조 순서대로 정렬하는 함수
  const buildTreeOrderedTasks = (tasks) => {
    const result = [];
    const taskMap = new Map();
    
    // 태스크 맵 생성
    tasks.forEach(task => {
      taskMap.set(task.id, {
        ...task,
        children: []
      });
    });
    
    // 부모-자식 관계 설정
    const rootTasks = [];
    tasks.forEach(task => {
      if (task.parentId && taskMap.has(task.parentId)) {
        taskMap.get(task.parentId).children.push(taskMap.get(task.id));
      } else {
        rootTasks.push(taskMap.get(task.id));
      }
    });
    
    // 자식들을 이름 순으로 정렬
    const sortChildren = (taskNode) => {
      taskNode.children.sort((a, b) => a.name.localeCompare(b.name));
      taskNode.children.forEach(child => sortChildren(child));
    };
    
    // 루트 태스크들을 이름 순으로 정렬하고 자식들도 정렬
    rootTasks.sort((a, b) => a.name.localeCompare(b.name));
    rootTasks.forEach(root => sortChildren(root));
    
    // DFS로 트리 순서대로 평면화
    const flattenTree = (taskNode) => {
      result.push(taskNode);
      taskNode.children.forEach(child => flattenTree(child));
    };
    
    rootTasks.forEach(root => flattenTree(root));
    
    return result;
  };
  
  // 트리 구조 순서로 정렬
  const sortedAvailableTasks = buildTreeOrderedTasks(availableParentTasks);

  if (!isOpen) return null;

  const priorities = [
    { id: 'low', label: '낮음', color: priorityColors.low },
    { id: 'medium', label: '보통', color: priorityColors.medium },
    { id: 'high', label: '높음', color: priorityColors.high },
    { id: 'critical', label: '긴급', color: priorityColors.critical }
  ];

  const categories = [
    { id: 'planning', label: '기획', color: categoryColors.planning },
    { id: 'design', label: '설계', color: categoryColors.design },
    { id: 'development', label: '개발', color: categoryColors.development },
    { id: 'testing', label: '테스트', color: categoryColors.testing },
    { id: 'deployment', label: '배포', color: categoryColors.deployment }
  ];

  return (
    <div className="modal-overlay">
      <div className="edit-task-modal">
        <div className="modal-header">
          <h2>태스크 추가</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-content">
          {/* 기본 정보 */}
          <div className="form-section">
            <h3>기본 정보</h3>
            
            <div className="form-group">
              <label htmlFor="taskName">
                <Tag size={16} />
                태스크 이름 *
              </label>
              <input
                id="taskName"
                type="text"
                value={newTask.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="태스크 이름을 입력하세요"
                className={errors.name ? 'error' : ''}
                autoFocus
              />
              {errors.name && (
                <div className="error-message">
                  <AlertCircle size={14} />
                  {errors.name}
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="description">설명</label>
              <textarea
                id="description"
                value={newTask.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="태스크에 대한 설명을 입력하세요"
                rows={3}
              />
            </div>
          </div>

          {/* 일정 */}
          <div className="form-section">
            <h3>
              <Calendar size={16} />
              일정
            </h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="startDate">시작일 *</label>
                <input
                  id="startDate"
                  type="date"
                  value={newTask.startDate}
                  onChange={(e) => handleInputChange('startDate', e.target.value)}
                  className={errors.startDate ? 'error' : ''}
                />
                {errors.startDate && (
                  <div className="error-message">
                    <AlertCircle size={14} />
                    {errors.startDate}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="endDate">종료일 *</label>
                <input
                  id="endDate"
                  type="date"
                  value={newTask.endDate}
                  onChange={(e) => handleInputChange('endDate', e.target.value)}
                  className={errors.endDate ? 'error' : ''}
                />
                {errors.endDate && (
                  <div className="error-message">
                    <AlertCircle size={14} />
                    {errors.endDate}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 담당자 및 진행률 */}
          <div className="form-section">
            <h3>할당 및 진행률</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="assignee">
                  <User size={16} />
                  담당자
                </label>
                <input
                  id="assignee"
                  type="text"
                  value={newTask.assignee}
                  onChange={(e) => handleInputChange('assignee', e.target.value)}
                  placeholder="담당자 이름"
                />
              </div>

              <div className="form-group">
                <label htmlFor="progress">
                  <BarChart size={16} />
                  진행률 (%)
                </label>
                <input
                  id="progress"
                  type="number"
                  min="0"
                  max="100"
                  value={newTask.progress}
                  onChange={(e) => handleInputChange('progress', parseInt(e.target.value) || 0)}
                  className={errors.progress ? 'error' : ''}
                />
                {errors.progress && (
                  <div className="error-message">
                    <AlertCircle size={14} />
                    {errors.progress}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 우선순위 및 카테고리 */}
          <div className="form-section">
            <h3>분류</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="priority">우선순위</label>
                <select
                  id="priority"
                  value={newTask.priority}
                  onChange={(e) => handleInputChange('priority', e.target.value)}
                >
                  {priorities.map(priority => (
                    <option key={priority.id} value={priority.id}>
                      {priority.label}
                    </option>
                  ))}
                </select>
                <div className="priority-preview">
                  <div 
                    className="priority-color"
                    style={{ backgroundColor: priorityColors[newTask.priority] }}
                  ></div>
                  <span>{priorities.find(p => p.id === newTask.priority)?.label}</span>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="category">카테고리</label>
                <select
                  id="category"
                  value={newTask.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                >
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
                </select>
                <div className="category-preview">
                  <div 
                    className="category-color"
                    style={{ backgroundColor: categoryColors[newTask.category] }}
                  ></div>
                  <span>{categories.find(c => c.id === newTask.category)?.label}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 계층 구조 */}
          <div className="form-section">
            <h3>계층 구조</h3>
            
            <div className="form-group">
              <label htmlFor="parentTask">부모 태스크</label>
              <select
                id="parentTask"
                value={newTask.parentId || ''}
                onChange={(e) => handleInputChange('parentId', e.target.value || null)}
              >
                <option value="">없음 (최상위 태스크)</option>
                {sortedAvailableTasks.length === 0 ? (
                  <option disabled>부모 태스크 없음</option>
                ) : (
                  sortedAvailableTasks.map((parentTask) => {
                    // 레벨에 따른 들여쓰기 시각화
                    const level = parentTask.level || 0;
                    const indent = '\u00a0\u00a0'.repeat(level * 2); // 2칸씩 들여쓰기
                    
                    // 계층 구조 시각적 표현
                    let prefix = '';
                    if (level > 0) {
                      prefix = '├─ '; // 트리 가지 모양
                    }
                    
                    // 태스크 유형과 카테고리 아이콘
                    const hasChildren = allTasks.some(t => t.parentId === parentTask.id);
                    let taskIcon = '';
                    
                    if (hasChildren) {
                      taskIcon = '📁 '; // 폴더 아이콘 (부모 태스크)
                    } else {
                      // 카테고리별 아이콘
                      const categoryIcons = {
                        planning: '📋',
                        design: '🎨',
                        development: '⚡',
                        testing: '🧪',
                        deployment: '🚀'
                      };
                      taskIcon = (categoryIcons[parentTask.category] || '📄') + ' ';
                    }
                    
                    return (
                      <option key={parentTask.id} value={parentTask.id}>
                        {indent}{prefix}{taskIcon}{parentTask.name}
                      </option>
                    );
                  })
                )}
              </select>
              {newTask.parentId && (
                <div className="parent-info">
                  <span className="parent-label">
                    선택된 부모: {sortedAvailableTasks.find(t => t.id === newTask.parentId)?.name}
                  </span>
                  <span className="parent-level">
                    (레벨 {(sortedAvailableTasks.find(t => t.id === newTask.parentId)?.level || 0) + 1})
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="cancel-btn" onClick={onClose}>
            취소
          </button>
          <button className="save-btn" onClick={handleSave}>
            추가
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddTaskModal;
