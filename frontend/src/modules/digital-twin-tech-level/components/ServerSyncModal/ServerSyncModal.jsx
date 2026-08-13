import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import {
  Cloud,
  Upload,
  Download,
  Trash2,
  Edit2,
  X,
  RotateCw,
  Plus,
  Globe,
  Lock,
  User,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  FolderOpen,
  Target,
  Box
} from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import {
  fetchMyData,
  fetchPublicData,
  fetchData,
  createData,
  updateData,
  deleteData
} from '../../services/techLevelApi';

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
`;

const Modal = styled.div`
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  width: 80vw;
  height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  color: white;
`;

const ModalTitle = styled.h3`
  margin: 0;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const CloseButton = styled.button`
  background: rgba(255, 255, 255, 0.2);
  border: none;
  cursor: pointer;
  padding: 6px;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;

  &:hover {
    background: rgba(255, 255, 255, 0.3);
  }
`;

const ModalBody = styled.div`
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 20px;
  gap: 16px;
`;

const CurrentDataSection = styled.div`
  background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);
  border: 1px solid #c4b5fd;
  border-radius: 8px;
  padding: 16px;

  h4 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: #7c3aed;
  }
`;

const StatsContainer = styled.div`
  display: flex;
  gap: 12px;
`;

const StatBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;

  &.goals {
    background-color: #dbeafe;
    color: #1e40af;
  }

  &.components {
    background-color: #dcfce7;
    color: #166534;
  }
`;

const TabContainer = styled.div`
  display: flex;
  gap: 8px;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 12px;
`;

const TabButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: ${props => props.active ? '#8b5cf6' : '#f3f4f6'};
  color: ${props => props.active ? 'white' : '#6b7280'};
  border: 1px solid ${props => props.active ? '#8b5cf6' : '#e5e7eb'};
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: ${props => props.active ? '#8b5cf6' : '#e5e7eb'};
    color: ${props => props.active ? 'white' : '#374151'};
  }
`;

const NewDataSection = styled.div`
  padding-bottom: 16px;
  border-bottom: 1px solid #e5e7eb;
`;

const NewDataButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const NewDataInputContainer = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;

  input {
    flex: 1;
    padding: 10px 14px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;

    &:focus {
      border-color: #10b981;
      box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
    }
  }
`;

const PublicCheckbox = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #e5e7eb;
  }

  input[type="checkbox"] {
    margin: 0;
    cursor: pointer;
  }
`;

const InputSaveButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover:not(:disabled) {
    background: #059669;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const CancelButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: #f3f4f6;
  color: #6b7280;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #e5e7eb;
    color: #374151;
  }
`;

const ListSection = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const ListHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  flex-shrink: 0;
  gap: 16px;

  h4 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: #374151;
    white-space: nowrap;
  }
`;

const ListControls = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const SearchBox = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  transition: all 0.2s;

  &:focus-within {
    border-color: #8b5cf6;
    background: white;
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }

  svg {
    color: #9ca3af;
    flex-shrink: 0;
  }

  input {
    border: none;
    background: transparent;
    outline: none;
    font-size: 14px;
    width: 200px;
    color: #374151;

    &::placeholder {
      color: #9ca3af;
    }
  }
`;

const SearchClear = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  background: #e5e7eb;
  border: none;
  border-radius: 50%;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: #d1d5db;
    color: #374151;
  }
`;

const RefreshButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    border-color: #d1d5db;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const TableContainer = styled.div`
  flex: 1;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;

  thead {
    display: block;
    width: 100%;
    flex-shrink: 0;
    overflow-y: scroll;
  }

  tbody {
    display: block;
    overflow-y: scroll;
    flex: 1;
    min-height: 0;
  }

  thead tr,
  tbody tr {
    display: table;
    width: 100%;
    table-layout: fixed;
  }

  tbody tr {
    cursor: pointer;
    transition: background 0.15s;

    &:hover {
      background: #f8fafc;
    }

    &.selected {
      background: #f5f3ff;
    }
  }

  th {
    background: #f8fafc;
    border-bottom: 2px solid #e5e7eb;
    padding: 12px 16px;
    text-align: left;
    font-weight: 600;
    color: #374151;
    white-space: nowrap;
  }

  td {
    padding: 12px 16px;
    border-bottom: 1px solid #f1f5f9;
    vertical-align: middle;
  }

  .col-status {
    width: 60px;
    text-align: center;
  }

  .col-name {
    width: 400px;
  }

  .col-goals,
  .col-components {
    width: 80px;
    text-align: center;
    font-weight: 500;
  }

  .col-goals {
    color: #2563eb;
  }

  .col-components {
    color: #059669;
  }

  .col-date {
    width: 180px;
  }

  .col-actions {
    width: auto;
    text-align: center;
  }
`;

const StatusIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: ${props => props.isPublic ? '#10b981' : '#9ca3af'};
`;

const TableDate = styled.span`
  font-size: 13px;
  color: #6b7280;
`;

const TableActions = styled.div`
  display: flex;
  gap: 6px;
  justify-content: center;
  flex-wrap: wrap;
`;

const ActionButton = styled.button`
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 4px !important;
  padding: 0 10px !important;
  width: auto !important;
  height: 28px !important;
  min-height: 28px !important;
  max-height: 28px !important;
  box-sizing: border-box !important;
  background: #f9fafb !important;
  border: 1px solid #e5e7eb !important;
  border-radius: 4px !important;
  cursor: pointer !important;
  transition: all 0.2s !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  white-space: nowrap !important;
  transform: none !important;
  box-shadow: none !important;
  line-height: 1 !important;

  span {
    line-height: 1 !important;
    display: inline-flex !important;
    align-items: center !important;
  }

  svg {
    flex-shrink: 0 !important;
    width: 14px !important;
    height: 14px !important;
  }

  &:hover:not(:disabled) {
    border-color: #d1d5db !important;
  }

  &:disabled {
    opacity: 0.5 !important;
    cursor: not-allowed !important;
  }

  &.load-btn {
    background: #eff6ff !important;
    border-color: #bfdbfe !important;
    color: #2563eb !important;

    &:hover:not(:disabled) {
      background: #dbeafe !important;
      border-color: #3b82f6 !important;
    }
  }

  &.save-btn {
    background: #ecfdf5 !important;
    border-color: #a7f3d0 !important;
    color: #059669 !important;
    font-weight: 600 !important;

    &:hover:not(:disabled) {
      background: #d1fae5 !important;
      border-color: #10b981 !important;
    }
  }

  &.public-btn {
    background: #f3f4f6 !important;
    border-color: #d1d5db !important;
    color: #6b7280 !important;

    &:hover:not(:disabled) {
      background: #e5e7eb !important;
      border-color: #9ca3af !important;
    }

    &.is-public {
      background: #f0fdf4 !important;
      border-color: #a7f3d0 !important;
      color: #059669 !important;
    }
  }

  &.edit-btn {
    background: #fffbeb !important;
    border-color: #fde68a !important;
    color: #d97706 !important;

    &:hover:not(:disabled) {
      background: #fef3c7 !important;
      border-color: #f59e0b !important;
    }
  }

  &.delete-btn {
    background: #fef2f2 !important;
    border-color: #fecaca !important;
    color: #dc2626 !important;

    &:hover:not(:disabled) {
      background: #fee2e2 !important;
      border-color: #ef4444 !important;
    }
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px;
  color: #9ca3af;
  text-align: center;
  flex: 1;

  p {
    margin: 0;
    font-size: 14px;
  }
`;

const LoadingState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px;
  color: #6b7280;
  flex: 1;
`;

const Pagination = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-top: 1px solid #e5e7eb;
  flex-shrink: 0;
  gap: 16px;
`;

const PaginationInfo = styled.div`
  font-size: 13px;
  color: #6b7280;
  white-space: nowrap;
`;

const PaginationControls = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const PaginationButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s;

  &:hover:not(:disabled) {
    background: #f3f4f6;
    border-color: #d1d5db;
    color: #374151;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const PaginationPages = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  margin: 0 4px;
`;

const PaginationPage = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  padding: 0 8px;
  background: ${props => props.active ? '#8b5cf6' : 'white'};
  border: 1px solid ${props => props.active ? '#8b5cf6' : '#e5e7eb'};
  border-radius: 6px;
  color: ${props => props.active ? 'white' : '#374151'};
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: ${props => props.active ? '#8b5cf6' : '#f3f4f6'};
    border-color: ${props => props.active ? '#8b5cf6' : '#d1d5db'};
  }
`;

const PaginationPerPage = styled.div`
  display: flex;
  align-items: center;

  select {
    padding: 6px 28px 6px 10px;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-size: 13px;
    color: #374151;
    cursor: pointer;
    outline: none;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 6px center;
    background-size: 16px;

    &:hover {
      border-color: #d1d5db;
    }

    &:focus {
      border-color: #8b5cf6;
      box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
    }
  }
`;

const Spinning = styled.span`
  display: inline-flex;
  animation: spin 1s linear infinite;

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;

const NameInput = styled.input`
  padding: 6px 10px;
  border: 1px solid #8b5cf6;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  outline: none;
  width: 100%;
`;

const TableDataName = styled.span`
  font-weight: 500;
  color: #1f2937;
`;

const ServerSyncModal = ({
  isOpen,
  onClose,
  currentData,
  onLoad
}) => {
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('my');
  const [dataList, setDataList] = useState([]);
  const [publicDataList, setPublicDataList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedData, setSelectedData] = useState(null);
  const [editingData, setEditingData] = useState(null);
  const [newDataName, setNewDataName] = useState('');
  const [newDataIsPublic, setNewDataIsPublic] = useState(false);
  const [showNewDataInput, setShowNewDataInput] = useState(false);
  const [savingTo, setSavingTo] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const loadDataList = async () => {
    setLoading(true);
    try {
      if (isAuthenticated()) {
        const response = await fetchMyData();
        setDataList(response.data || []);
      }

      const publicResponse = await fetchPublicData();
      setPublicDataList(publicResponse.data || []);
    } catch (error) {
      console.error('데이터 목록 불러오기 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDataList();
      if (!isAuthenticated()) {
        setActiveTab('public');
      }
    }
  }, [isOpen]);

  useEffect(() => {
    setSearchQuery('');
    setCurrentPage(1);
  }, [activeTab]);

  const filteredData = useMemo(() => {
    const sourceData = activeTab === 'my' ? dataList : publicDataList;
    if (!searchQuery.trim()) return sourceData;

    const query = searchQuery.toLowerCase();
    return sourceData.filter(item =>
      item.name.toLowerCase().includes(query)
    );
  }, [activeTab, dataList, publicDataList, searchQuery]);

  const paginationData = useMemo(() => {
    const totalItems = filteredData.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedData = filteredData.slice(startIndex, endIndex);

    return {
      totalItems,
      totalPages,
      startIndex,
      endIndex: Math.min(endIndex, totalItems),
      paginatedData
    };
  }, [filteredData, currentPage, itemsPerPage]);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= paginationData.totalPages) {
      setCurrentPage(page);
    }
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const handleCreateAndSave = async () => {
    if (!newDataName.trim()) return;

    setLoading(true);
    try {
      const saveData = {
        name: newDataName.trim(),
        description: `메가 과제 ${currentData.goals.length}개, 구성 요소 ${currentData.components.length}개`,
        goals: currentData.goals,
        components: currentData.components,
        level_options: currentData.levelOptions,
        category_options: currentData.categoryOptions,
        business_unit_options: currentData.businessUnitOptions,
        tech_type_options: currentData.techTypeOptions,
        graph_heights: currentData.graphHeights,
        card_graph_zoom_pan: currentData.cardGraphZoomPan,
        graph_view_state: currentData.graphViewState,
        is_public: newDataIsPublic,
        metadata: {
          goalCount: currentData.goals.length,
          componentCount: currentData.components.length,
          savedAt: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).replace(' ', 'T') + '+09:00'
        }
      };

      await createData(saveData);
      setNewDataName('');
      setNewDataIsPublic(false);
      setShowNewDataInput(false);
      await loadDataList();
    } catch (error) {
      console.error('데이터 저장 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToExisting = async (item) => {
    setSavingTo(item.id);
    try {
      const saveData = {
        goals: currentData.goals,
        components: currentData.components,
        level_options: currentData.levelOptions,
        category_options: currentData.categoryOptions,
        business_unit_options: currentData.businessUnitOptions,
        tech_type_options: currentData.techTypeOptions,
        graph_heights: currentData.graphHeights,
        card_graph_zoom_pan: currentData.cardGraphZoomPan,
        graph_view_state: currentData.graphViewState,
        description: `메가 과제 ${currentData.goals.length}개, 구성 요소 ${currentData.components.length}개`,
        metadata: {
          goalCount: currentData.goals.length,
          componentCount: currentData.components.length,
          savedAt: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).replace(' ', 'T') + '+09:00'
        }
      };

      await updateData(item.id, saveData);
      await loadDataList();
    } catch (error) {
      console.error('데이터 저장 실패:', error);
    } finally {
      setSavingTo(null);
    }
  };

  const handleLoadData = async (item) => {
    setLoading(true);
    try {
      const response = await fetchData(item.id);
      const loadedData = response.data;

      onLoad({
        goals: loadedData.goals || [],
        components: loadedData.components || [],
        levelOptions: loadedData.level_options || null,
        categoryOptions: loadedData.category_options || null,
        businessUnitOptions: loadedData.business_unit_options || null,
        techTypeOptions: loadedData.tech_type_options || null,
        graphHeights: loadedData.graph_heights || null,
        cardGraphZoomPan: loadedData.card_graph_zoom_pan || null,
        graphViewState: loadedData.graph_view_state || null,
        name: loadedData.name
      });

      onClose();
    } catch (error) {
      console.error('데이터 불러오기 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteData = async (item) => {
    if (!window.confirm(`"${item.name}" 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    setLoading(true);
    try {
      await deleteData(item.id);
      await loadDataList();
    } catch (error) {
      console.error('데이터 삭제 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDataName = async (item, newName) => {
    if (!newName.trim() || newName === item.name) {
      setEditingData(null);
      return;
    }

    try {
      await updateData(item.id, { name: newName.trim() });
      await loadDataList();
    } catch (error) {
      console.error('데이터 이름 수정 실패:', error);
    } finally {
      setEditingData(null);
    }
  };

  const handleTogglePublic = async (item) => {
    try {
      await updateData(item.id, { is_public: !item.is_public });
      await loadDataList();
    } catch (error) {
      console.error('공개 상태 변경 실패:', error);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderDataRow = (item, isOwner = true) => {
    return (
      <tr
        key={item.id}
        className={selectedData?.id === item.id ? 'selected' : ''}
        onClick={() => setSelectedData(item)}
      >
        <td className="col-status">
          <StatusIcon isPublic={item.is_public} title={item.is_public ? '공용' : '비공개'}>
            {item.is_public ? <Globe size={16} /> : <Lock size={16} />}
          </StatusIcon>
        </td>
        <td className="col-name">
          {editingData === item.id ? (
            <NameInput
              type="text"
              defaultValue={item.name}
              onBlur={(e) => handleUpdateDataName(item, e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleUpdateDataName(item, e.target.value);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          ) : (
            <TableDataName>{item.name}</TableDataName>
          )}
        </td>
        <td className="col-goals">{item.goal_count || 0}</td>
        <td className="col-components">{item.component_count || 0}</td>
        <td className="col-date">
          <TableDate>{formatDate(item.updated_at)}</TableDate>
        </td>
        <td className="col-actions">
          <TableActions>
            <ActionButton
              className="load-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleLoadData(item);
              }}
              disabled={loading}
              title="불러오기"
            >
              <Download size={14} />
              <span>불러오기</span>
            </ActionButton>
            {isOwner && (
              <>
                <ActionButton
                  className="save-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSaveToExisting(item);
                  }}
                  disabled={loading || savingTo === item.id}
                  title="덮어쓰기"
                >
                  {savingTo === item.id ? (
                    <Spinning><Loader2 size={14} /></Spinning>
                  ) : (
                    <Upload size={14} />
                  )}
                  <span>덮어쓰기</span>
                </ActionButton>
                <ActionButton
                  className={`public-btn ${item.is_public ? 'is-public' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTogglePublic(item);
                  }}
                  disabled={loading}
                  title={item.is_public ? '비공개로 변경' : '공용으로 변경'}
                >
                  {item.is_public ? <Globe size={14} /> : <Lock size={14} />}
                  <span>{item.is_public ? '공용' : '비공개'}</span>
                </ActionButton>
                <ActionButton
                  className="edit-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingData(item.id);
                  }}
                  disabled={loading}
                  title="이름 수정"
                >
                  <Edit2 size={14} />
                  <span>수정</span>
                </ActionButton>
                <ActionButton
                  className="delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteData(item);
                  }}
                  disabled={loading}
                  title="삭제"
                >
                  <Trash2 size={14} />
                  <span>삭제</span>
                </ActionButton>
              </>
            )}
          </TableActions>
        </td>
      </tr>
    );
  };

  if (!isOpen) return null;

  return (
    <Overlay onClick={onClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>
            <Cloud size={20} />
            서버 저장/불러오기
          </ModalTitle>
          <CloseButton onClick={onClose}>
            <X size={20} />
          </CloseButton>
        </ModalHeader>

        <ModalBody>
          <CurrentDataSection>
            <h4>현재 작업 데이터</h4>
            <StatsContainer>
              <StatBadge className="goals">
                <Target size={14} />
                메가 과제 {currentData.goals.length}개
              </StatBadge>
              <StatBadge className="components">
                <Box size={14} />
                구성 요소 {currentData.components.length}개
              </StatBadge>
            </StatsContainer>
          </CurrentDataSection>

          <TabContainer>
            {isAuthenticated() && (
              <TabButton
                active={activeTab === 'my'}
                onClick={() => setActiveTab('my')}
              >
                <User size={16} />
                내 데이터
              </TabButton>
            )}
            <TabButton
              active={activeTab === 'public'}
              onClick={() => setActiveTab('public')}
            >
              <Globe size={16} />
              공용 데이터
            </TabButton>
          </TabContainer>

          {activeTab === 'my' && isAuthenticated() && (
            <NewDataSection>
              {!showNewDataInput ? (
                <NewDataButton
                  onClick={() => setShowNewDataInput(true)}
                  disabled={loading}
                >
                  <Plus size={16} />
                  새 데이터로 저장
                </NewDataButton>
              ) : (
                <NewDataInputContainer>
                  <input
                    type="text"
                    placeholder="저장할 이름을 입력하세요"
                    value={newDataName}
                    onChange={(e) => setNewDataName(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleCreateAndSave();
                      }
                    }}
                    autoFocus
                  />
                  <PublicCheckbox>
                    <input
                      type="checkbox"
                      checked={newDataIsPublic}
                      onChange={(e) => setNewDataIsPublic(e.target.checked)}
                    />
                    <Globe size={14} />
                    공용
                  </PublicCheckbox>
                  <InputSaveButton
                    onClick={handleCreateAndSave}
                    disabled={!newDataName.trim() || loading}
                  >
                    {loading ? <Spinning><Loader2 size={14} /></Spinning> : <Upload size={14} />}
                    저장
                  </InputSaveButton>
                  <CancelButton onClick={() => {
                    setShowNewDataInput(false);
                    setNewDataName('');
                    setNewDataIsPublic(false);
                  }}>
                    <X size={16} />
                  </CancelButton>
                </NewDataInputContainer>
              )}
            </NewDataSection>
          )}

          <ListSection>
            <ListHeader>
              <h4>{activeTab === 'my' ? '내 데이터 목록' : '공용 데이터 목록'}</h4>
              <ListControls>
                <SearchBox>
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="검색..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                  />
                  {searchQuery && (
                    <SearchClear onClick={() => setSearchQuery('')}>
                      <X size={12} />
                    </SearchClear>
                  )}
                </SearchBox>
                <RefreshButton onClick={loadDataList} disabled={loading}>
                  <RotateCw size={16} className={loading ? 'spinning' : ''} />
                </RefreshButton>
              </ListControls>
            </ListHeader>

            <TableContainer>
              {loading && paginationData.paginatedData.length === 0 ? (
                <LoadingState>
                  <Spinning><Loader2 size={24} /></Spinning>
                  <span>데이터를 불러오는 중...</span>
                </LoadingState>
              ) : paginationData.paginatedData.length === 0 ? (
                <EmptyState>
                  <FolderOpen size={40} />
                  <p>
                    {searchQuery
                      ? '검색 결과가 없습니다.'
                      : activeTab === 'my'
                        ? '저장된 데이터가 없습니다.\n"새 데이터로 저장" 버튼을 클릭하여 현재 작업을 저장하세요.'
                        : '공용 데이터가 없습니다.'
                    }
                  </p>
                </EmptyState>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <th className="col-status">상태</th>
                      <th className="col-name">이름</th>
                      <th className="col-goals">과제</th>
                      <th className="col-components">구성요소</th>
                      <th className="col-date">수정일</th>
                      <th className="col-actions">작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginationData.paginatedData.map((item) =>
                      renderDataRow(item, activeTab === 'my')
                    )}
                  </tbody>
                </Table>
              )}
            </TableContainer>

            {paginationData.totalPages > 1 && (
              <Pagination>
                <PaginationInfo>
                  {paginationData.startIndex + 1}-{paginationData.endIndex} / 총 {paginationData.totalItems}개
                </PaginationInfo>
                <PaginationControls>
                  <PaginationButton
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronsLeft size={16} />
                  </PaginationButton>
                  <PaginationButton
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft size={16} />
                  </PaginationButton>
                  <PaginationPages>
                    {Array.from({ length: Math.min(5, paginationData.totalPages) }, (_, i) => {
                      let pageNum;
                      if (paginationData.totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= paginationData.totalPages - 2) {
                        pageNum = paginationData.totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <PaginationPage
                          key={pageNum}
                          active={currentPage === pageNum}
                          onClick={() => handlePageChange(pageNum)}
                        >
                          {pageNum}
                        </PaginationPage>
                      );
                    })}
                  </PaginationPages>
                  <PaginationButton
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === paginationData.totalPages}
                  >
                    <ChevronRight size={16} />
                  </PaginationButton>
                  <PaginationButton
                    onClick={() => handlePageChange(paginationData.totalPages)}
                    disabled={currentPage === paginationData.totalPages}
                  >
                    <ChevronsRight size={16} />
                  </PaginationButton>
                </PaginationControls>
                <PaginationPerPage>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                  >
                    <option value={5}>5개</option>
                    <option value={10}>10개</option>
                    <option value={20}>20개</option>
                    <option value={50}>50개</option>
                  </select>
                </PaginationPerPage>
              </Pagination>
            )}
          </ListSection>
        </ModalBody>
      </Modal>
    </Overlay>
  );
};

export default ServerSyncModal;
