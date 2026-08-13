import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import Header from './components/Layout/Header';
import TaskTable from './components/TaskTable';
import RoadmapView from './components/RoadmapView';
import SeedbedView from './components/SeedbedView';
import TaskModal from './components/TaskModal';
import BulkAddModal from './components/BulkAddModal';
import SettingsModal from './components/SettingsModal';
import TaskLinkModal from './components/TaskLinkModal';
import { dtReferenceApi } from './services/api';
import { useAuth } from '../../contexts/AuthContext';
import { todayLocalYmd } from '../../shared/utils/localDate';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f8fafc;
`;

const Toast = styled.div`
  position: fixed;
  bottom: 24px;
  right: 24px;
  padding: 12px 20px;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  color: white;
  background: ${props => props.$type === 'error' ? '#ef4444' : '#06b6d4'};
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 3000;
  animation: slideIn 0.3s ease;

  @keyframes slideIn {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
`;

const DigitalTwinReferenceApp = ({ onGoHome }) => {
  const { isAdmin } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [dashboardProjects, setDashboardProjects] = useState([]);
  const [categories, setCategories] = useState(['시뮬레이션', '검증 자동화', '설계 자동화']);
  const [statuses, setStatuses] = useState(['완료', '진행', '계획']);
  const [productFamilies, setProductFamilies] = useState([]);
  const [roadmapConfig, setRoadmapConfig] = useState({ itemOrder: {}, cellMerge: [] });

  const [viewMode, setViewMode] = useState('table');
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [bulkAddModalOpen, setBulkAddModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [taskLinkModalOpen, setTaskLinkModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  // --- Data fetching ---
  const fetchTasks = useCallback(async () => {
    try {
      const data = await dtReferenceApi.getTasks();
      setTasks(data);
    } catch (err) {
      console.error('과제 조회 실패:', err);
    }
  }, []);

  const fetchDivisions = useCallback(async () => {
    try {
      const data = await dtReferenceApi.getDivisions();
      setDivisions(data);
    } catch (err) {
      console.error('사업부 조회 실패:', err);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const data = await dtReferenceApi.getSettings();
      if (data.categories) setCategories(data.categories);
      if (data.statuses) setStatuses(data.statuses);
      setProductFamilies(data.product_families || data.productFamilies || []);
    } catch (err) {
      console.error('설정 조회 실패:', err);
    }
  }, []);

  const fetchDashboardProjects = useCallback(async () => {
    try {
      const data = await dtReferenceApi.getDashboardProjects();
      setDashboardProjects(data);
    } catch (err) {
      console.error('대시보드 과제 조회 실패:', err);
    }
  }, []);

  const fetchRoadmapConfig = useCallback(async () => {
    try {
      const data = await dtReferenceApi.getRoadmapConfig();
      setRoadmapConfig(data);
    } catch (err) {
      console.error('로드맵 설정 조회 실패:', err);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchDivisions();
    fetchSettings();
    fetchDashboardProjects();
    fetchRoadmapConfig();
  }, [fetchTasks, fetchDivisions, fetchSettings, fetchDashboardProjects, fetchRoadmapConfig]);

  // --- Task CRUD ---
  const handleAddTask = () => {
    setEditingTask(null);
    setTaskModalOpen(true);
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    setTaskModalOpen(true);
  };

  const handleSaveTask = async (formData) => {
    try {
      if (editingTask) {
        await dtReferenceApi.updateTask(editingTask.id, formData);
        showToast('과제가 수정되었습니다.');
      } else {
        await dtReferenceApi.createTask(formData);
        showToast('과제가 추가되었습니다.');
      }
      setTaskModalOpen(false);
      setEditingTask(null);
      fetchTasks();
    } catch (err) {
      showToast(err.message || '저장 실패', 'error');
    }
  };

  const handleDeleteTask = async (task) => {
    if (!window.confirm(`"${task.name}" 과제를 삭제하시겠습니까?`)) return;
    try {
      await dtReferenceApi.deleteTask(task.id);
      showToast('과제가 삭제되었습니다.');
      fetchTasks();
    } catch (err) {
      showToast(err.message || '삭제 실패', 'error');
    }
  };

  // --- Reorder ---
  const handleMoveTask = async (taskId, direction) => {
    const idx = tasks.findIndex(t => t.id === taskId);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= tasks.length) return;

    const newTasks = [...tasks];
    [newTasks[idx], newTasks[swapIdx]] = [newTasks[swapIdx], newTasks[idx]];
    setTasks(newTasks);

    try {
      await dtReferenceApi.reorderTasks(
        newTasks.map((t, i) => ({ id: t.id, order: i }))
      );
    } catch (err) {
      showToast('순서 변경 실패', 'error');
      fetchTasks();
    }
  };

  // --- Bulk Add ---
  const handleBulkSave = async (rows) => {
    try {
      await dtReferenceApi.createBulkTasks(rows);
      showToast(`${rows.length}건의 과제가 추가되었습니다.`);
      setBulkAddModalOpen(false);
      fetchTasks();
    } catch (err) {
      showToast(err.message || '일괄 추가 실패', 'error');
    }
  };

  // --- Settings ---
  const handleSaveSettings = async ({ categories: newCats, statuses: newStatuses, productFamilies: newPF }) => {
    try {
      await dtReferenceApi.updateSettings({ categories: newCats, statuses: newStatuses, product_families: newPF });
      setCategories(newCats);
      setStatuses(newStatuses);
      setProductFamilies(newPF);
      setSettingsModalOpen(false);
      showToast('설정이 저장되었습니다.');
    } catch (err) {
      showToast(err.message || '설정 저장 실패', 'error');
    }
  };

  const handleSaveRoadmapConfig = async (config) => {
    try {
      await dtReferenceApi.updateRoadmapConfig(config);
      setRoadmapConfig(config);
      showToast('로드맵 설정이 저장되었습니다.');
    } catch (err) {
      showToast(err.message || '로드맵 설정 저장 실패', 'error');
    }
  };

  // --- Task Link ---
  const handleSaveTaskLinks = async (updates) => {
    try {
      await Promise.all(
        updates.map(({ id, connectedDtTask }) =>
          dtReferenceApi.updateTask(id, { connectedDtTask })
        )
      );
      showToast(`${updates.length}건의 과제 연결이 저장되었습니다.`);
      setTaskLinkModalOpen(false);
      fetchTasks();
    } catch (err) {
      showToast(err.message || '과제 연결 저장 실패', 'error');
    }
  };

  const handleExportCsv = useCallback(() => {
    if (!tasks || tasks.length === 0) return;
    const headers = ['과제명', '사업부', '항목', '항목 상세', '구분', '적용 제품군', '연도', '상태', '설명'];
    const escCsv = (val) => {
      const s = String(val ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const getDivName = (id) => {
      if (!id) return '';
      const d = divisions.find(d => d.id === id);
      return d ? d.name : id;
    };
    const rows = tasks.map(t => [
      t.name || '', getDivName(t.divisionId), t.testItem || '', t.testItemDetail || '',
      t.category || '', Array.isArray(t.productFamily) ? t.productFamily.join(',') : '',
      t.year || '', t.status || '', t.description || '',
    ].map(escCsv).join(','));
    const csv = '\uFEFF' + headers.map(escCsv).join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dt_reference_tasks_${todayLocalYmd()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [tasks, divisions]);

  const handleDeleteAll = useCallback(async () => {
    if (!tasks || tasks.length === 0) return;
    if (!window.confirm(`총 ${tasks.length}개의 과제를 모두 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    try {
      await dtReferenceApi.deleteAllTasks();
      setTasks([]);
      showToast('전체 과제가 삭제되었습니다.');
    } catch (err) {
      showToast(err.message || '전체 삭제 실패', 'error');
    }
  }, [tasks]);

  return (
    <Container>
      <Header
        onGoHome={onGoHome}
        onAddTask={handleAddTask}
        onBulkAdd={() => setBulkAddModalOpen(true)}
        onOpenTaskLink={() => setTaskLinkModalOpen(true)}
        onExportCsv={handleExportCsv}
        onDeleteAll={handleDeleteAll}
        isAdmin={isAdmin}
        onOpenSettings={() => setSettingsModalOpen(true)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {viewMode === 'table' ? (
        <TaskTable
          tasks={tasks}
          divisions={divisions}
          onEdit={handleEditTask}
          onDelete={handleDeleteTask}
          onMoveTask={handleMoveTask}
        />
      ) : viewMode === 'seedbed' ? (
        <SeedbedView
          tasks={tasks}
          divisions={divisions}
          roadmapConfig={roadmapConfig}
        />
      ) : (
        <RoadmapView
          tasks={tasks}
          divisions={divisions}
          categories={categories}
          productFamilies={productFamilies}
          roadmapConfig={roadmapConfig}
          onSaveRoadmapConfig={handleSaveRoadmapConfig}
        />
      )}

      <TaskModal
        isOpen={taskModalOpen}
        onClose={() => { setTaskModalOpen(false); setEditingTask(null); }}
        onSave={handleSaveTask}
        task={editingTask}
        divisions={divisions}
        categories={categories}
        statuses={statuses}
        productFamilies={productFamilies}
        dashboardProjects={dashboardProjects}
      />

      <BulkAddModal
        isOpen={bulkAddModalOpen}
        onClose={() => setBulkAddModalOpen(false)}
        onSave={handleBulkSave}
        divisions={divisions}
        categories={categories}
        statuses={statuses}
        productFamilies={productFamilies}
      />

      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        categories={categories}
        statuses={statuses}
        productFamilies={productFamilies}
        divisions={divisions}
        onSave={handleSaveSettings}
        tasks={tasks}
        roadmapConfig={roadmapConfig}
        onSaveRoadmapConfig={handleSaveRoadmapConfig}
      />

      <TaskLinkModal
        isOpen={taskLinkModalOpen}
        onClose={() => setTaskLinkModalOpen(false)}
        tasks={tasks}
        dashboardProjects={dashboardProjects}
        onSave={handleSaveTaskLinks}
      />

      {toast && (
        <Toast $type={toast.type}>{toast.message}</Toast>
      )}
    </Container>
  );
};

export default DigitalTwinReferenceApp;
