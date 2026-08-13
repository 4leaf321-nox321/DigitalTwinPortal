import React, { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, Copy, Check, AlertCircle, Calendar, User, BarChart, Tag } from 'lucide-react';
import { categoryColors, priorityColors } from '../../data/sampleTasks';
import './MultiTaskAddModal.css';

const MultiTaskAddModal = ({ 
  isOpen, 
  onClose, 
  onSave,
  allTasks = []
}) => {
  const [tasks, setTasks] = useState([]);
  const [errors, setErrors] = useState({});

  // 빈 태스크 템플릿
  const createEmptyTask = useCallback(() => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    return {
      tempId: `temp-${Date.now()}-${Math.random()}`,
      name: '',
      startDate: today.toISOString().split('T')[0],
      endDate: tomorrow.toISOString().split('T')[0],
      assignee: '',
      progress: 0,
      priority: 'medium',
      category: 'development',
      description: '',
      parentId: null
    };
  }, []);

  // 모달이 열릴 때 초기 태스크들 생성
  useEffect(() => {
    if (isOpen) {
      setTasks([
        createEmptyTask(),
        createEmptyTask(),
        createEmptyTask()
      ]);
      setErrors({});
    }
  }, [isOpen, createEmptyTask]);

  // 태스크 추가
  const addTask = () => {
    setTasks(prev => [...prev, createEmptyTask()]);
  };

  // 태스크 삭제
  const removeTask = (tempId) => {
    if (tasks.length <= 1) return;
    
    setTasks(prev => prev.filter(task => task.tempId !== tempId));
    
    // 해당 태스크의 에러도 제거
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[tempId];
      return newErrors;
    });
  };

  // 태스크 복제
  const duplicateTask = (tempId) => {
    const taskToDuplicate = tasks.find(task => task.tempId === tempId);
    if (!taskToDuplicate) return;

    const duplicated = {
      ...taskToDuplicate,
      tempId: `temp-${Date.now()}-${Math.random()}`,
      name: taskToDuplicate.name + ' (복사본)'
    };

    const taskIndex = tasks.findIndex(task => task.tempId === tempId);
    setTasks(prev => [
      ...prev.slice(0, taskIndex + 1),
      duplicated,
      ...prev.slice(taskIndex + 1)
    ]);
  };

  // 태스크 필드 업데이트
  const updateTask = (tempId, field, value) => {
    setTasks(prev => prev.map(task => 
      task.tempId === tempId ? { ...task, [field]: value } : task
    ));

    // 해당 필드의 에러 제거
    setErrors(prev => {
      const newErrors = { ...prev };
      if (newErrors[tempId] && newErrors[tempId][field]) {
        delete newErrors[tempId][field];
        if (Object.keys(newErrors[tempId]).length === 0) {
          delete newErrors[tempId];
        }
      }
      return newErrors;
    });
  };

  // 유효성 검사
  const validateTasks = () => {
    const newErrors = {};

    tasks.forEach(task => {
      const taskErrors = {};

      if (!task.name.trim()) {
        taskErrors.name = '태스크 이름을 입력해주세요.';
      }

      if (!task.startDate) {
        taskErrors.startDate = '시작일을 선택해주세요.';
      }

      if (!task.endDate) {
        taskErrors.endDate = '종료일을 선택해주세요.';
      }

      if (task.startDate && task.endDate && 
          new Date(task.startDate) > new Date(task.endDate)) {
        taskErrors.endDate = '종료일은 시작일보다 늦어야 합니다.';
      }

      if (task.progress < 0 || task.progress > 100) {
        taskErrors.progress = '진행률은 0-100 사이의 값이어야 합니다.';
      }

      if (Object.keys(taskErrors).length > 0) {
        newErrors[task.tempId] = taskErrors;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 저장
  const handleSave = () => {
    const validTasks = tasks.filter(task => task.name.trim()); // 이름이 있는 태스크만
    
    if (validTasks.length === 0) {
      setErrors({ general: '최소 1개 이상의 태스크를 입력해주세요.' });
      return;
    }

    // 이름이 있는 태스크들만 검증
    const tasksToValidate = validTasks;
    const tempTasks = tasks;
    setTasks(tasksToValidate);
    
    if (validateTasks()) {
      // tempId 제거하고 저장
      const finalTasks = tasksToValidate.map(({ tempId, ...task }) => task);
      onSave(finalTasks);
    } else {
      setTasks(tempTasks); // 원래 태스크 목록 복원
    }
  };

  // 부모 태스크 옵션 생성
  const buildParentOptions = () => {
    const result = [];
    const taskMap = new Map();
    
    allTasks.forEach(task => {
      taskMap.set(task.id, {
        ...task,
        children: []
      });
    });
    
    const rootTasks = [];
    allTasks.forEach(task => {
      if (task.parentId && taskMap.has(task.parentId)) {
        taskMap.get(task.parentId).children.push(taskMap.get(task.id));
      } else {
        rootTasks.push(taskMap.get(task.id));
      }
    });
    
    const sortChildren = (taskNode) => {
      taskNode.children.sort((a, b) => a.name.localeCompare(b.name));
      taskNode.children.forEach(child => sortChildren(child));
    };
    
    rootTasks.sort((a, b) => a.name.localeCompare(b.name));
    rootTasks.forEach(root => sortChildren(root));
    
    const flattenTree = (taskNode) => {
      result.push(taskNode);
      taskNode.children.forEach(child => flattenTree(child));
    };
    
    rootTasks.forEach(root => flattenTree(root));
    
    return result;
  };

  const parentOptions = buildParentOptions();

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

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="multi-task-modal">
        <div className="modal-header">
          <h2>멀티 태스크 추가</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-content">
          {errors.general && (
            <div className="general-error">
              <AlertCircle size={16} />
              {errors.general}
            </div>
          )}

          <div className="table-container">
            <table className="multi-task-table">
              <thead>
                <tr>
                  <th className="col-actions">작업</th>
                  <th className="col-name">태스크 이름 *</th>
                  <th className="col-date">시작일 *</th>
                  <th className="col-date">종료일 *</th>
                  <th className="col-assignee">담당자</th>
                  <th className="col-progress">진행률</th>
                  <th className="col-priority">우선순위</th>
                  <th className="col-category">카테고리</th>
                  <th className="col-parent">부모 태스크</th>
                  <th className="col-description">설명</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task, index) => (
                  <tr key={task.tempId} className={errors[task.tempId] ? 'has-error' : ''}>
                    <td className="col-actions">
                      <div className="action-buttons">
                        <button
                          type="button"
                          className="action-btn duplicate-btn"
                          onClick={() => duplicateTask(task.tempId)}
                          title="복제"
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          type="button"
                          className="action-btn remove-btn"
                          onClick={() => removeTask(task.tempId)}
                          disabled={tasks.length <= 1}
                          title="삭제"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>

                    <td className="col-name">
                      <input
                        type="text"
                        value={task.name}
                        onChange={(e) => updateTask(task.tempId, 'name', e.target.value)}
                        placeholder="태스크 이름"
                        className={errors[task.tempId]?.name ? 'error' : ''}
                      />
                      {errors[task.tempId]?.name && (
                        <div className="cell-error">{errors[task.tempId].name}</div>
                      )}
                    </td>

                    <td className="col-date">
                      <input
                        type="date"
                        value={task.startDate}
                        onChange={(e) => updateTask(task.tempId, 'startDate', e.target.value)}
                        className={errors[task.tempId]?.startDate ? 'error' : ''}
                      />
                      {errors[task.tempId]?.startDate && (
                        <div className="cell-error">{errors[task.tempId].startDate}</div>
                      )}
                    </td>

                    <td className="col-date">
                      <input
                        type="date"
                        value={task.endDate}
                        onChange={(e) => updateTask(task.tempId, 'endDate', e.target.value)}
                        className={errors[task.tempId]?.endDate ? 'error' : ''}
                      />
                      {errors[task.tempId]?.endDate && (
                        <div className="cell-error">{errors[task.tempId].endDate}</div>
                      )}
                    </td>

                    <td className="col-assignee">
                      <input
                        type="text"
                        value={task.assignee}
                        onChange={(e) => updateTask(task.tempId, 'assignee', e.target.value)}
                        placeholder="담당자"
                      />
                    </td>

                    <td className="col-progress">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={task.progress}
                        onChange={(e) => updateTask(task.tempId, 'progress', parseInt(e.target.value) || 0)}
                        className={errors[task.tempId]?.progress ? 'error' : ''}
                      />
                      {errors[task.tempId]?.progress && (
                        <div className="cell-error">{errors[task.tempId].progress}</div>
                      )}
                    </td>

                    <td className="col-priority">
                      <select
                        value={task.priority}
                        onChange={(e) => updateTask(task.tempId, 'priority', e.target.value)}
                        className="priority-select"
                        style={{ borderLeftColor: priorityColors[task.priority] }}
                      >
                        {priorities.map(priority => (
                          <option key={priority.id} value={priority.id}>
                            {priority.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="col-category">
                      <select
                        value={task.category}
                        onChange={(e) => updateTask(task.tempId, 'category', e.target.value)}
                        className="category-select"
                        style={{ borderLeftColor: categoryColors[task.category] }}
                      >
                        {categories.map(category => (
                          <option key={category.id} value={category.id}>
                            {category.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="col-parent">
                      <select
                        value={task.parentId || ''}
                        onChange={(e) => updateTask(task.tempId, 'parentId', e.target.value || null)}
                        className="parent-select"
                      >
                        <option value="">없음</option>
                        {parentOptions.map(parent => {
                          const level = parent.level || 0;
                          const indent = '\u00a0'.repeat(level * 2);
                          const hasChildren = allTasks.some(t => t.parentId === parent.id);
                          const icon = hasChildren ? '📁' : '📄';
                          
                          return (
                            <option key={parent.id} value={parent.id}>
                              {indent}{icon} {parent.name}
                            </option>
                          );
                        })}
                      </select>
                    </td>

                    <td className="col-description">
                      <textarea
                        value={task.description}
                        onChange={(e) => updateTask(task.tempId, 'description', e.target.value)}
                        placeholder="설명"
                        rows={2}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="table-actions">
            <button
              type="button"
              className="add-row-btn"
              onClick={addTask}
            >
              <Plus size={16} />
              행 추가
            </button>
            <div className="table-info">
              총 {tasks.length}개 태스크 • {tasks.filter(t => t.name.trim()).length}개 완성
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="cancel-btn" onClick={onClose}>
            취소
          </button>
          <button className="save-btn" onClick={handleSave}>
            <Check size={16} />
            모든 태스크 추가
          </button>
        </div>
      </div>
    </div>
  );
};

export default MultiTaskAddModal;