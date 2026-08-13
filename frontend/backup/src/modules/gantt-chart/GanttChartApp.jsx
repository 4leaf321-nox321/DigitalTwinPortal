import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from './components/Layout/Header';
import GanttChart from './components/GanttChart/GanttChart';
import TaskPanel from './components/TaskPanel/TaskPanel';
import EditTaskModal from './components/TaskPanel/EditTaskModal';
import AddTaskModal from './components/TaskPanel/AddTaskModal';
import MultiTaskAddModal from './components/TaskPanel/MultiTaskAddModal';
import { useTaskData } from './hooks/useTaskData';
import { sampleTasks } from './data/sampleTasks';
import { useModal } from '../../shared/hooks/useModal';
import ModalProvider from '../../shared/components/Modal/ModalProvider';
import './GanttChartApp.css';

const GanttChartApp = () => {
  const navigate = useNavigate();
  const [showTaskPanel, setShowTaskPanel] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMultiAddModal, setShowMultiAddModal] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState(null);
  
  const {
    tasks,
    displayTasks, // 계층 구조로 정렬된 태스크 목록
    selectedTask,
    setSelectedTask,
    addTask,
    addMultipleTasks, // 멀티 태스크 추가 함수
    updateTask,
    deleteTask,
    duplicateTask,
    toggleTask, // 태스크 접기/펼치기
    clearAllTasks,
    setTasksData
  } = useTaskData([]);

  const {
    modals,
    closeAlert,
    closeConfirm,
    showSuccess,
    showError,
    showInfo,
    askWarningConfirm
  } = useModal();

  // selectedTask가 tasks 상태 변경에 따라 자동으로 업데이트되도록 처리
  useEffect(() => {
    if (selectedTask) {
      const updatedTask = tasks.find(t => t.id === selectedTask.id);
      if (updatedTask) {
        setSelectedTask(updatedTask);
      }
    }
  }, [tasks]); // selectedTask를 의존성에서 제외하여 무한 루프 방지

  const handleGoHome = () => {
    navigate('/engineeringhub');
  };

  const handleTaskSelect = (task) => {
    setSelectedTask(task);
    setShowTaskPanel(true);
  };

  const handleCloseTaskPanel = () => {
    setShowTaskPanel(false);
    setSelectedTask(null);
  };

  const handleTaskToggle = (taskId) => {
    toggleTask(taskId);
  };

  const handleAddTask = () => {
    setShowAddModal(true);
  };

  const handleAddMultipleTasks = () => {
    setShowMultiAddModal(true);
  };

  const handleSaveNewTask = async (newTaskData) => {
    try {
      const addedTask = addTask(newTaskData);
      
      // 모달 닫기
      setShowAddModal(false);
      
      // 성공 메시지
      await showSuccess(`새 태스크 "${addedTask.name}"가 추가되었습니다.`);
      
      // 추가된 태스크 선택
      handleTaskSelect(addedTask);
      
    } catch (error) {
      await showError(`태스크 추가 중 오류가 발생했습니다: ${error.message}`);
    }
  };

  const handleSaveMultipleTasks = async (newTasksData) => {
    try {
      const addedTasks = addMultipleTasks(newTasksData);
      
      // 모달 닫기
      setShowMultiAddModal(false);
      
      // 결과 메시지
      let successMessage = `${addedTasks.length}개의 태스크가 추가되었습니다.`;
      
      await showSuccess(successMessage);
      
      // 마지막으로 추가된 태스크 선택
      if (addedTasks.length > 0) {
        handleTaskSelect(addedTasks[addedTasks.length - 1]);
      }
      
    } catch (error) {
      await showError(`멀티 태스크 추가 중 오류가 발생했습니다: ${error.message}`);
    }
  };

  const handleCloseAddModal = () => {
    setShowAddModal(false);
  };

  const handleCloseMultiAddModal = () => {
    setShowMultiAddModal(false);
  };

  const handleEditTask = (task) => {
    setTaskToEdit(task);
    setShowEditModal(true);
  };

  const handleSaveEditedTask = async (editedTaskData) => {
    try {
      // 태스크 업데이트 실행
      updateTask(taskToEdit.id, editedTaskData);
      
      // 모달 닫기
      setShowEditModal(false);
      setTaskToEdit(null);
      
      // 성공 메시지
      await showSuccess('태스크가 성공적으로 수정되었습니다.');
      
      // 패널에서 업데이트된 태스크 정보를 자동으로 반영
      // tasks 상태가 변경되면 useEffect에서 자동 처리됨
      
    } catch (error) {
      await showError(`태스크 수정 중 오류가 발생했습니다: ${error.message}`);
    }
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setTaskToEdit(null);
  };

  const handleDeleteTask = async (taskId) => {
    const taskToDelete = tasks.find(t => t.id === taskId);
    if (!taskToDelete) return;

    let confirmMessage = '태스크를 삭제하시겠습니까?';
    
    // 부모 태스크인 경우 추가 경고
    const { isParentTask, getChildrenIds } = await import('./utils/taskUtils');
    const childrenIds = getChildrenIds(taskId, tasks);
    if (childrenIds.length > 0) {
      confirmMessage = `부모 태스크 "${taskToDelete.name}"을(를) 삭제하면 ${childrenIds.length}개의 하위 테스크도 함께 삭제됩니다.\n\n정말 삭제하시겠습니까?`;
    }
    
    const confirmed = await askWarningConfirm(
      confirmMessage,
      '삭제된 태스크는 복구할 수 없습니다.'
    );
    
    if (confirmed) {
      try {
        deleteTask(taskId);
        setShowTaskPanel(false);
        
        if (childrenIds.length > 0) {
          await showSuccess(`부모 태스크와 ${childrenIds.length}개의 하위 테스크가 삭제되었습니다.`);
        } else {
          await showSuccess('태스크가 삭제되었습니다.');
        }
      } catch (error) {
        await showError('태스크 삭제 중 오류가 발생했습니다.');
      }
    }
  };

  const handleDuplicateTask = async (taskId) => {
    try {
      const duplicatedTask = duplicateTask(taskId);
      if (duplicatedTask) {
        const { isParentTask } = await import('./utils/taskUtils');
        const originalTask = tasks.find(t => t.id === taskId);
        let successMessage = `태스크가 복제되었습니다: ${duplicatedTask.name}`;
        
        if (isParentTask(taskId, tasks)) {
          successMessage += '\n\n참고: 부모 태스크를 복제했지만 하위 테스크는 복제되지 않습니다.';
        }
        
        await showSuccess(successMessage);
        handleTaskSelect(duplicatedTask);
      }
    } catch (error) {
      await showError('태스크 복제 중 오류가 발생했습니다.');
    }
  };

  // 새로운 Import 핸들러 (JSON, CSV 모두 처리)
  const handleImportData = async (data, type, filename) => {
    if (tasks.length > 0) {
      const confirmed = await askWarningConfirm(
        `${type.toUpperCase()} 파일을 불러오시겠습니까?`,
        '기존 태스크가 모두 삭제되고 새 데이터로 대체됩니다.'
      );
      
      if (!confirmed) return;
    }

    try {
      let tasksToLoad = [];
      
      if (type === 'json') {
        // JSON 데이터 처리
        if (Array.isArray(data)) {
          tasksToLoad = data;
        } else if (data.tasks && Array.isArray(data.tasks)) {
          tasksToLoad = data.tasks;
        } else if (data.data && data.data.tasks && Array.isArray(data.data.tasks)) {
          tasksToLoad = data.data.tasks;
        } else {
          throw new Error('올바른 태스크 데이터 형식이 아닙니다.');
        }
      } else if (type === 'csv') {
        // CSV 데이터는 이미 변환된 상태로 받음
        tasksToLoad = data;
      }
      
      setTasksData(tasksToLoad);
      setShowTaskPanel(false);
      
      const { isParentTask } = await import('./utils/taskUtils');
      const parentCount = tasksToLoad.filter(t => isParentTask(t.id, tasksToLoad)).length;
      const childCount = tasksToLoad.filter(t => !isParentTask(t.id, tasksToLoad)).length;
      
      let successMessage = `${type.toUpperCase()} 파일에서 ${tasksToLoad.length}개의 태스크를 불러왔습니다.`;
      if (parentCount > 0 || childCount > 0) {
        successMessage += `\n\n📋 부모 태스크: ${parentCount}개\n📝 하위 태스크: ${childCount}개`;
      }
      
      await showSuccess(successMessage);
    } catch (error) {
      await showError(`파일 불러오기 실패: ${error.message}`);
    }
  };

  // 새로운 Export 핸들러 (type에 따라 JSON 또는 CSV)
  const handleExportData = async (type = 'json') => {
    if (tasks.length === 0) {
      await showInfo('내보낼 태스크가 없습니다.');
      return;
    }

    try {
      if (type === 'json') {
        const exportData = {
          version: '1.0',
          timestamp: new Date().toISOString(),
          tasks: tasks,
          metadata: {
            totalTasks: tasks.length,
            parentTasks: tasks.filter(t => t.isParent).length,
            subTasks: tasks.filter(t => !t.isParent).length
          }
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        
        const timestamp = new Date().toISOString().split('T')[0];
        link.download = `gantt-tasks-hierarchical-${timestamp}.json`;
        
        link.click();
        URL.revokeObjectURL(url);
        
        await showSuccess(`${tasks.length}개의 태스크를 JSON으로 내보냈습니다.`);
      }
      // CSV는 헤더의 handleCSVExport에서 처리됨
    } catch (error) {
      await showError('데이터 내보내기 중 오류가 발생했습니다.');
    }
  };

  const handleLoadSample = async () => {
    if (tasks.length > 0) {
      const confirmed = await askWarningConfirm(
        '계층 구조 샘플 데이터를 로드하시겠습니까?',
        '기존 데이터가 모두 삭제되고 5단계 프로젝트 구조로 대체됩니다.\n\n• 1단계: 프로젝트 기획\n• 2단계: 시스템 설계\n• 3단계: 개발\n• 4단계: 테스트\n• 5단계: 배포'
      );
      
      if (!confirmed) return;
    }

    try {
      setTasksData(sampleTasks);
      setShowTaskPanel(false);
      
      const { isParentTask } = await import('./utils/taskUtils');
      const parentCount = sampleTasks.filter(t => isParentTask(t.id, sampleTasks)).length;
      const childCount = sampleTasks.filter(t => !isParentTask(t.id, sampleTasks)).length;
      
      await showSuccess(
        `계층 구조 샘플 데이터를 로드했습니다!\n\n` +
        `📋 부모 태스크: ${parentCount}개\n` +
        `📝 하위 태스크: ${childCount}개\n\n` +
        `부모 태스크를 클릭하면 접기/펼치기가 가능합니다.`
      );
    } catch (error) {
      await showError('샘플 데이터 로드 중 오류가 발생했습니다.');
    }
  };

  const handleTaskUpdate = async (taskId, updates) => {
    try {
      updateTask(taskId, updates);
      await showSuccess('태스크가 업데이트되었습니다.');
    } catch (error) {
      await showError(`태스크 업데이트 실패: ${error.message}`);
    }
  };

  // 실제 표시되는 태스크 개수 (접힌 태스크 제외)
  const visibleTaskCount = displayTasks.length;
  const totalTaskCount = tasks.length;

  return (
    <div className="gantt-layout">
      <Header
        onGoHome={handleGoHome}
        onAddTask={handleAddTask}
        onAddMultipleTasks={handleAddMultipleTasks}
        onImport={handleImportData}
        onExport={handleExportData}
        onLoadSample={handleLoadSample}
        tasksCount={visibleTaskCount !== totalTaskCount ? 
          `${visibleTaskCount}/${totalTaskCount}` : 
          totalTaskCount
        }
        tasks={tasks}
        showError={showError}
        showSuccess={showSuccess}
      />

      <main className="gantt-main">
        <div className="gantt-content">
          <div className="chart-container">
            <GanttChart
              tasks={tasks} // 전체 태스크 (날짜 범위 계산용)
              displayTasks={displayTasks} // 표시할 태스크 (계층 구조)
              selectedTask={selectedTask}
              onTaskSelect={handleTaskSelect}
              onTaskUpdate={handleTaskUpdate}
              onTaskToggle={handleTaskToggle} // 토글 핸들러 추가
              onTaskDelete={handleDeleteTask} // 삭제 핸들러 추가
            />
          </div>
          
          {showTaskPanel && selectedTask && (
            <div className="panel-container">
              <TaskPanel
                task={selectedTask}
                onClose={handleCloseTaskPanel}
                onEdit={handleEditTask}
                onDelete={handleDeleteTask}
                onDuplicate={handleDuplicateTask}
              />
            </div>
          )}
        </div>
      </main>

      <ModalProvider
        modals={modals}
        onCloseAlert={closeAlert}
        onCloseConfirm={closeConfirm}
      />
      
      {/* 태스크 편집 모달 */}
      <EditTaskModal
        task={taskToEdit}
        isOpen={showEditModal}
        onClose={handleCloseEditModal}
        onSave={handleSaveEditedTask}
        allTasks={tasks}
      />
      
      {/* 태스크 추가 모달 */}
      <AddTaskModal
        isOpen={showAddModal}
        onClose={handleCloseAddModal}
        onSave={handleSaveNewTask}
        allTasks={tasks}
      />
      
      {/* 멀티 태스크 추가 모달 */}
      <MultiTaskAddModal
        isOpen={showMultiAddModal}
        onClose={handleCloseMultiAddModal}
        onSave={handleSaveMultipleTasks}
        allTasks={tasks}
      />
    </div>
  );
};

export default GanttChartApp;