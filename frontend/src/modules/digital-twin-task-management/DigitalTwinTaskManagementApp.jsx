import React, { useState, useCallback, useEffect, useRef } from 'react';
import styled from 'styled-components';
import Header from './components/Layout/Header';
import AddTaskModal from './components/AddTaskModal/AddTaskModal';
import BulkAddTaskModal from './components/AddTaskModal/BulkAddTaskModal';
import TaskSettingsModal, { loadTaskSettings, saveTaskSettings } from './components/TaskSettingsModal/TaskSettingsModal';
import TaskTable from './components/TaskTable/TaskTable';
import TaskDashboard from './components/Dashboard/TaskDashboard';
import TaskDetailModal from './components/TaskDetailModal/TaskDetailModal';
import { fetchSystemSettings } from '../digital-twin-dashboard/services/settingsApi';
import { settingsData as defaultSettingsData } from '../digital-twin-dashboard/data/sampleDataV2';
import { fetchTaskData, upsertTaskData, softDeleteTask, generateUUID } from './services/taskSettingsApi';

const TASKS_STORAGE_KEY = 'digitalTwinTaskManagement_tasks';
const VERSION_STORAGE_KEY = 'digitalTwinTaskManagement_version';

// localStorage 캐시 (오프라인 지원 + 빠른 초기 로드)
const loadLocalTasks = () => {
  try {
    const saved = localStorage.getItem(TASKS_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) { /* ignore */ }
  return [];
};

const saveLocalTasks = (tasks) => {
  try {
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
  } catch (e) { /* ignore */ }
};

const loadLocalVersion = () => {
  try {
    return parseInt(localStorage.getItem(VERSION_STORAGE_KEY) || '0', 10);
  } catch (e) { return 0; }
};

const saveLocalVersion = (version) => {
  try {
    localStorage.setItem(VERSION_STORAGE_KEY, String(version));
  } catch (e) { /* ignore */ }
};

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f8fafc;
`;

const MainContent = styled.div`
  flex: 1;
  overflow-y: auto;
`;

const DashboardPlaceholder = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 1.1rem;
  color: #94a3b8;
`;

const DigitalTwinTaskManagementApp = ({ onGoHome }) => {
  const [viewMode, setViewMode] = useState('tasks');
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [isBulkAddModalOpen, setIsBulkAddModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [viewingTask, setViewingTask] = useState(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [taskSettings, setTaskSettings] = useState({ corporations: [] });
  const [tasks, setTasks] = useState([]);
  const [serverVersion, setServerVersion] = useState(0);
  const [divisionColors, setDivisionColors] = useState({});
  const syncInProgress = useRef(false);

  // 서버 동기화: 서버 데이터 다운로드 후 로컬과 병합
  const syncFromServer = useCallback(async () => {
    if (syncInProgress.current) return;
    syncInProgress.current = true;
    try {
      const serverData = await fetchTaskData();
      const serverTasks = (serverData.tasks || []).filter(t => !t._deleted);
      setServerVersion(serverData.version || 0);
      saveLocalVersion(serverData.version || 0);
      saveLocalTasks(serverTasks);
      setTasks(serverTasks);
    } catch (e) {
      console.warn('[TaskMgmt] 서버 동기화 실패, 로컬 데이터 사용:', e.message);
      // 서버 불가 시 로컬 데이터 사용
      setTasks(loadLocalTasks());
      setServerVersion(loadLocalVersion());
    } finally {
      syncInProgress.current = false;
    }
  }, []);

  // 서버에 업서트 후 로컬 동기화
  const syncToServer = useCallback(async (updatedTasks) => {
    // 로컬 먼저 저장 (빠른 UI 반영)
    const activeTasks = updatedTasks.filter(t => !t._deleted);
    saveLocalTasks(activeTasks);
    setTasks(activeTasks);

    try {
      const result = await upsertTaskData({
        tasks: updatedTasks,
        metadata: { lastSyncAt: new Date().toISOString() },
      });
      setServerVersion(result.version);
      saveLocalVersion(result.version);
      // 서버 응답의 병합된 데이터로 로컬 갱신
      const serverTasks = (result.tasks || []).filter(t => !t._deleted);
      saveLocalTasks(serverTasks);
      setTasks(serverTasks);
    } catch (e) {
      console.warn('[TaskMgmt] 서버 업서트 실패, 로컬만 유지:', e.message);
    }
  }, []);

  // 초기 데이터 로드
  useEffect(() => {
    // 로컬 데이터 먼저 표시 (빠른 초기 로드)
    setTasks(loadLocalTasks());
    setServerVersion(loadLocalVersion());

    loadTaskSettings().then(settings => setTaskSettings(settings));

    // 서버에서 최신 데이터 동기화
    syncFromServer();

    // 사업부 색상 맵 구축
    const loadColors = async () => {
      let divisions = defaultSettingsData?.divisions || [];
      try {
        const dbSettings = await fetchSystemSettings();
        if (dbSettings?.divisions?.length > 0) divisions = dbSettings.divisions;
      } catch (e) { /* fallback */ }
      const colorMap = {};
      divisions.forEach(d => { colorMap[d.name] = d.color; });
      setDivisionColors(colorMap);
    };
    loadColors();
  }, [syncFromServer]);

  const handleAddTask = useCallback(() => {
    setIsAddTaskModalOpen(true);
  }, []);

  const handleAddTaskSubmit = useCallback((taskData) => {
    const now = new Date().toISOString();

    if (editingTask) {
      // 수정 모드 - 기존 uuid 유지
      setTasks(prev => {
        const updated = prev.map(t =>
          t.uuid === editingTask.uuid
            ? { ...t, ...taskData, updatedAt: now }
            : t
        );
        syncToServer(updated);
        return updated;
      });
      setEditingTask(null);
    } else {
      // 추가 모드 - uuid와 고유 ID 생성
      const uuid = generateUUID();
      const taskId = `TM-${Date.now().toString(36).toUpperCase()}`;
      const newTask = {
        ...taskData,
        id: taskId,
        uuid,
        createdAt: now,
        updatedAt: now,
      };
      setTasks(prev => {
        const updated = [...prev, newTask];
        syncToServer(updated);
        return updated;
      });
    }
  }, [editingTask, syncToServer]);

  const handleBulkAddSubmit = useCallback((tasksToAdd) => {
    const now = new Date().toISOString();
    const newTasks = tasksToAdd.map(taskData => ({
      ...taskData,
      id: `TM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
      uuid: generateUUID(),
      createdAt: now,
      updatedAt: now,
    }));
    setTasks(prev => {
      const updated = [...prev, ...newTasks];
      syncToServer(updated);
      return updated;
    });
  }, [syncToServer]);

  const handleEditTask = useCallback((task) => {
    setEditingTask(task);
    setIsAddTaskModalOpen(true);
  }, []);

  const handleNavigateTask = useCallback((task) => {
    setEditingTask(task);
  }, []);

  const handleDeleteTask = useCallback((id) => {
    setTasks(prev => {
      const target = prev.find(t => t.id === id);
      if (!target) return prev;

      const now = new Date().toISOString();
      // 로컬에서는 즉시 제거하되, 서버에는 소프트 삭제로 동기화
      const updated = prev.filter(t => t.id !== id);
      saveLocalTasks(updated);

      // 서버 소프트 삭제 (비동기, 실패해도 로컬은 이미 반영)
      if (target.uuid) {
        softDeleteTask(target.uuid).catch(e => {
          console.warn('[TaskMgmt] 서버 삭제 실패:', e.message);
        });
      }

      return updated;
    });
  }, []);

  const handleSaveSettings = useCallback(async (newSettings) => {
    setTaskSettings(newSettings);
    await saveTaskSettings(newSettings);
    setIsSettingsModalOpen(false);
  }, []);

  return (
    <Container>
      <Header
        onGoHome={onGoHome}
        onAddTask={handleAddTask}
        onBulkAddTask={() => setIsBulkAddModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />
      <MainContent>
        {viewMode === 'tasks' ? (
          <TaskTable
            tasks={tasks}
            divisionColors={divisionColors}
            onDelete={handleDeleteTask}
            onEdit={handleEditTask}
            onView={setViewingTask}
          />
        ) : (
          <TaskDashboard
            tasks={tasks}
            divisionColors={divisionColors}
            onView={setViewingTask}
          />
        )}
      </MainContent>
      <TaskDetailModal
        isOpen={!!viewingTask}
        task={viewingTask}
        divisionColors={divisionColors}
        onClose={() => setViewingTask(null)}
        onEdit={(t) => { setViewingTask(null); handleEditTask(t); }}
      />
      <AddTaskModal
        isOpen={isAddTaskModalOpen}
        onClose={() => { setIsAddTaskModalOpen(false); setEditingTask(null); }}
        onSubmit={handleAddTaskSubmit}
        editData={editingTask}
        corporations={taskSettings.corporations}
        solutions={taskSettings.solutions}
        lineProducts={taskSettings.lineProducts}
        activityCategories={taskSettings.activityCategories}
        activitySubcategories={taskSettings.activitySubcategories}
        allTasks={tasks}
        onNavigate={handleNavigateTask}
      />
      <BulkAddTaskModal
        isOpen={isBulkAddModalOpen}
        onClose={() => setIsBulkAddModalOpen(false)}
        onSubmit={handleBulkAddSubmit}
        corporations={taskSettings.corporations}
      />
      <TaskSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={taskSettings}
        onSave={handleSaveSettings}
      />
    </Container>
  );
};

export default DigitalTwinTaskManagementApp;
