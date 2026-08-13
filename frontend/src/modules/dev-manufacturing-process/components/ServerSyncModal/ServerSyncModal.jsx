import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import {
  Cloud,
  Upload,
  Download,
  Trash2,
  Edit2,
  Save,
  X,
  RotateCw,
  Plus,
  AlertCircle,
  Globe,
  Lock,
  User,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  FolderOpen
} from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import {
  fetchMyDiagrams,
  fetchPublicDiagrams,
  fetchDiagram,
  createDiagram,
  updateDiagram,
  deleteDiagram
} from '../../services/diagramApi';

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
  background: #f8fafc;
`;

const ModalTitle = styled.h3`
  margin: 0;
  font-size: 1.1rem;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;

  &:hover {
    background: #e2e8f0;
    color: #1e293b;
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
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border: 1px solid #bae6fd;
  border-radius: 8px;
  padding: 16px;

  h4 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: #0369a1;
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

  &.nodes {
    background-color: #dcfce7;
    color: #166534;
  }

  &.edges {
    background-color: #dbeafe;
    color: #1e40af;
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
  background: ${props => props.active ? '#3b82f6' : '#f3f4f6'};
  color: ${props => props.active ? 'white' : '#6b7280'};
  border: 1px solid ${props => props.active ? '#3b82f6' : '#e5e7eb'};
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: ${props => props.active ? '#3b82f6' : '#e5e7eb'};
    color: ${props => props.active ? 'white' : '#374151'};
  }
`;

const NewDiagramSection = styled.div`
  padding-bottom: 16px;
  border-bottom: 1px solid #e5e7eb;
`;

const NewDiagramButton = styled.button`
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

const NewDiagramInputContainer = styled.div`
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

  svg {
    color: #10b981;
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
    border-color: #3b82f6;
    background: white;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
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
      background: #eff6ff;
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

  .col-nodes,
  .col-edges {
    width: 60px;
    text-align: center;
    font-weight: 500;
  }

  .col-nodes {
    color: #059669;
  }

  .col-edges {
    color: #2563eb;
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
    min-width: 14px !important;
    min-height: 14px !important;
    max-width: 14px !important;
    max-height: 14px !important;
  }

  &:hover:not(:disabled) {
    border-color: #d1d5db !important;
    transform: none !important;
    box-shadow: none !important;
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

      &:hover:not(:disabled) {
        background: #dcfce7 !important;
        border-color: #10b981 !important;
      }
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
  background: ${props => props.active ? '#3b82f6' : 'white'};
  border: 1px solid ${props => props.active ? '#3b82f6' : '#e5e7eb'};
  border-radius: 6px;
  color: ${props => props.active ? 'white' : '#374151'};
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: ${props => props.active ? '#3b82f6' : '#f3f4f6'};
    border-color: ${props => props.active ? '#3b82f6' : '#d1d5db'};
  }
`;

const PaginationEllipsis = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  color: #9ca3af;
  font-size: 13px;
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
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
  }
`;

const UserInfo = styled.div`
  padding-top: 12px;
  border-top: 1px solid #e5e7eb;
  font-size: 12px;
  color: #6b7280;
  text-align: right;

  .not-logged-in {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #f59e0b;
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
  border: 1px solid #3b82f6;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  outline: none;
  width: 100%;
`;

const TableGraphName = styled.span`
  font-weight: 500;
  color: #1f2937;
`;

const ServerSyncModal = ({
  isOpen,
  onClose,
  currentDiagramData,
  colorItems,
  onLoad
}) => {
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('my');
  const [diagrams, setDiagrams] = useState([]);
  const [publicDiagrams, setPublicDiagrams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDiagram, setSelectedDiagram] = useState(null);
  const [editingDiagram, setEditingDiagram] = useState(null);
  const [newDiagramName, setNewDiagramName] = useState('');
  const [newDiagramIsPublic, setNewDiagramIsPublic] = useState(false);
  const [showNewDiagramInput, setShowNewDiagramInput] = useState(false);
  const [savingTo, setSavingTo] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const loadDiagrams = async () => {
    setLoading(true);
    try {
      if (isAuthenticated()) {
        const response = await fetchMyDiagrams();
        setDiagrams(response.data || []);
      }

      const publicResponse = await fetchPublicDiagrams();
      setPublicDiagrams(publicResponse.data || []);
    } catch (error) {
      console.error('다이어그램 목록 불러오기 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDiagrams();
      if (!isAuthenticated()) {
        setActiveTab('public');
      }
    }
  }, [isOpen]);

  useEffect(() => {
    setSearchQuery('');
    setCurrentPage(1);
  }, [activeTab]);

  const filteredDiagrams = useMemo(() => {
    const sourceDiagrams = activeTab === 'my' ? diagrams : publicDiagrams;
    if (!searchQuery.trim()) return sourceDiagrams;

    const query = searchQuery.toLowerCase();
    return sourceDiagrams.filter(diagram =>
      diagram.name.toLowerCase().includes(query)
    );
  }, [activeTab, diagrams, publicDiagrams, searchQuery]);

  const paginationData = useMemo(() => {
    const totalItems = filteredDiagrams.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedDiagrams = filteredDiagrams.slice(startIndex, endIndex);

    return {
      totalItems,
      totalPages,
      startIndex,
      endIndex: Math.min(endIndex, totalItems),
      paginatedDiagrams
    };
  }, [filteredDiagrams, currentPage, itemsPerPage]);

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
    if (!newDiagramName.trim()) return;

    setLoading(true);
    try {
      const diagramData = {
        name: newDiagramName.trim(),
        description: `노드 ${currentDiagramData.nodes.length}개, 엣지 ${currentDiagramData.edges.length}개`,
        nodes: currentDiagramData.nodes,
        edges: currentDiagramData.edges,
        viewport: currentDiagramData.viewport,
        threads: currentDiagramData.threads || [],
        is_public: newDiagramIsPublic,
        metadata: {
          nodeCount: currentDiagramData.nodes.length,
          edgeCount: currentDiagramData.edges.length,
          savedAt: new Date().toISOString(),
          colorItems: colorItems || []
        }
      };

      await createDiagram(diagramData);
      setNewDiagramName('');
      setNewDiagramIsPublic(false);
      setShowNewDiagramInput(false);
      await loadDiagrams();
    } catch (error) {
      console.error('다이어그램 저장 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToExisting = async (diagram) => {
    setSavingTo(diagram.id);
    try {
      const diagramData = {
        nodes: currentDiagramData.nodes,
        edges: currentDiagramData.edges,
        viewport: currentDiagramData.viewport,
        threads: currentDiagramData.threads || [],
        description: `노드 ${currentDiagramData.nodes.length}개, 엣지 ${currentDiagramData.edges.length}개`,
        metadata: {
          nodeCount: currentDiagramData.nodes.length,
          edgeCount: currentDiagramData.edges.length,
          savedAt: new Date().toISOString(),
          colorItems: colorItems || []
        }
      };

      await updateDiagram(diagram.id, diagramData);
      await loadDiagrams();
    } catch (error) {
      console.error('다이어그램 저장 실패:', error);
    } finally {
      setSavingTo(null);
    }
  };

  const handleLoadDiagram = async (diagram) => {
    setLoading(true);
    try {
      const response = await fetchDiagram(diagram.id);
      const diagramData = response.data;

      onLoad({
        nodes: diagramData.nodes || [],
        edges: diagramData.edges || [],
        viewport: diagramData.viewport || { x: 0, y: 0, zoom: 1 },
        threads: diagramData.threads || [],
        name: diagramData.name,
        colorItems: diagramData.metadata?.colorItems || null
      });

      onClose();
    } catch (error) {
      console.error('다이어그램 불러오기 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDiagram = async (diagram) => {
    if (!window.confirm(`"${diagram.name}" 다이어그램을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    setLoading(true);
    try {
      await deleteDiagram(diagram.id);
      await loadDiagrams();
    } catch (error) {
      console.error('다이어그램 삭제 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDiagramName = async (diagram, newName) => {
    if (!newName.trim() || newName === diagram.name) {
      setEditingDiagram(null);
      return;
    }

    try {
      await updateDiagram(diagram.id, { name: newName.trim() });
      await loadDiagrams();
    } catch (error) {
      console.error('다이어그램 이름 수정 실패:', error);
    } finally {
      setEditingDiagram(null);
    }
  };

  const handleTogglePublic = async (diagram) => {
    try {
      await updateDiagram(diagram.id, { is_public: !diagram.is_public });
      await loadDiagrams();
    } catch (error) {
      console.error('공개 상태 변경 실패:', error);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderDiagramRow = (diagram, isPublic = false, isOwner = true) => {
    return (
      <tr
        key={diagram.id}
        className={selectedDiagram?.id === diagram.id ? 'selected' : ''}
        onClick={() => setSelectedDiagram(diagram)}
      >
        <td className="col-status">
          <StatusIcon isPublic={diagram.is_public} title={diagram.is_public ? '공용' : '비공개'}>
            {diagram.is_public ? <Globe size={16} /> : <Lock size={16} />}
          </StatusIcon>
        </td>
        <td className="col-name">
          {editingDiagram === diagram.id ? (
            <NameInput
              type="text"
              defaultValue={diagram.name}
              onBlur={(e) => handleUpdateDiagramName(diagram, e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleUpdateDiagramName(diagram, e.target.value);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          ) : (
            <TableGraphName>{diagram.name}</TableGraphName>
          )}
        </td>
        <td className="col-nodes">{diagram.node_count || '-'}</td>
        <td className="col-edges">{diagram.edge_count || '-'}</td>
        <td className="col-date">
          <TableDate>{formatDate(diagram.updated_at)}</TableDate>
        </td>
        <td className="col-actions">
          <TableActions>
            <ActionButton
              className="load-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleLoadDiagram(diagram);
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
                    handleSaveToExisting(diagram);
                  }}
                  disabled={loading || savingTo === diagram.id || currentDiagramData.nodes.length === 0}
                  title="덮어쓰기"
                >
                  {savingTo === diagram.id ? (
                    <Spinning><Loader2 size={14} /></Spinning>
                  ) : (
                    <Upload size={14} />
                  )}
                  <span>덮어쓰기</span>
                </ActionButton>
                <ActionButton
                  className={`public-btn ${diagram.is_public ? 'is-public' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTogglePublic(diagram);
                  }}
                  disabled={loading}
                  title={diagram.is_public ? '비공개로 변경' : '공용으로 변경'}
                >
                  {diagram.is_public ? <Globe size={14} /> : <Lock size={14} />}
                  <span>{diagram.is_public ? '공용' : '비공개'}</span>
                </ActionButton>
                <ActionButton
                  className="edit-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingDiagram(diagram.id);
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
                    handleDeleteDiagram(diagram);
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
              <StatBadge className="nodes">
                노드 {currentDiagramData.nodes.length}개
              </StatBadge>
              <StatBadge className="edges">
                연결선 {currentDiagramData.edges.length}개
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
                내 다이어그램
              </TabButton>
            )}
            <TabButton
              active={activeTab === 'public'}
              onClick={() => setActiveTab('public')}
            >
              <Globe size={16} />
              공용 다이어그램
            </TabButton>
          </TabContainer>

          {isAuthenticated() && activeTab === 'my' && (
            <NewDiagramSection>
              {!showNewDiagramInput ? (
                <NewDiagramButton
                  onClick={() => setShowNewDiagramInput(true)}
                  disabled={loading || currentDiagramData.nodes.length === 0}
                >
                  <Plus size={18} />
                  새 다이어그램으로 저장
                </NewDiagramButton>
              ) : (
                <NewDiagramInputContainer>
                  <input
                    type="text"
                    placeholder="다이어그램 이름을 입력하세요"
                    value={newDiagramName}
                    onChange={(e) => setNewDiagramName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleCreateAndSave()}
                    autoFocus
                  />
                  <PublicCheckbox>
                    <input
                      type="checkbox"
                      checked={newDiagramIsPublic}
                      onChange={(e) => setNewDiagramIsPublic(e.target.checked)}
                    />
                    <Globe size={14} />
                    공용
                  </PublicCheckbox>
                  <InputSaveButton
                    onClick={handleCreateAndSave}
                    disabled={loading || !newDiagramName.trim()}
                  >
                    <Save size={16} />
                    저장
                  </InputSaveButton>
                  <CancelButton
                    onClick={() => {
                      setShowNewDiagramInput(false);
                      setNewDiagramName('');
                      setNewDiagramIsPublic(false);
                    }}
                  >
                    <X size={16} />
                  </CancelButton>
                </NewDiagramInputContainer>
              )}
            </NewDiagramSection>
          )}

          <ListSection>
            <ListHeader>
              <h4>{activeTab === 'my' ? '내 다이어그램 목록' : '공용 다이어그램 목록'} ({filteredDiagrams.length}개)</h4>
              <ListControls>
                <SearchBox>
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="다이어그램 이름 검색..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                  />
                  {searchQuery && (
                    <SearchClear onClick={() => { setSearchQuery(''); setCurrentPage(1); }}>
                      <X size={14} />
                    </SearchClear>
                  )}
                </SearchBox>
                <RefreshButton
                  onClick={loadDiagrams}
                  disabled={loading}
                  title="새로고침"
                >
                  {loading ? <Spinning><Loader2 size={16} /></Spinning> : <RotateCw size={16} />}
                </RefreshButton>
              </ListControls>
            </ListHeader>

            {loading && (activeTab === 'my' ? diagrams : publicDiagrams).length === 0 ? (
              <LoadingState>
                <Spinning><Loader2 size={24} /></Spinning>
                <span>불러오는 중...</span>
              </LoadingState>
            ) : (activeTab === 'my' ? diagrams : publicDiagrams).length === 0 ? (
              <EmptyState>
                <Cloud size={48} />
                {activeTab === 'my' ? (
                  <>
                    <p>저장된 다이어그램이 없습니다.</p>
                    <p>위의 "새 다이어그램으로 저장" 버튼을 눌러 현재 데이터를 저장하세요.</p>
                  </>
                ) : (
                  <p>공용 다이어그램이 없습니다.</p>
                )}
              </EmptyState>
            ) : filteredDiagrams.length === 0 ? (
              <EmptyState>
                <Search size={48} />
                <p>"{searchQuery}"에 대한 검색 결과가 없습니다.</p>
              </EmptyState>
            ) : (
              <>
                <TableContainer>
                  <Table>
                    <thead>
                      <tr>
                        <th className="col-status">공개</th>
                        <th className="col-name">다이어그램 이름</th>
                        <th className="col-nodes">노드</th>
                        <th className="col-edges">연결선</th>
                        <th className="col-date">수정일</th>
                        <th className="col-actions">작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeTab === 'my'
                        ? paginationData.paginatedDiagrams.map((diagram) => renderDiagramRow(diagram, false, true))
                        : paginationData.paginatedDiagrams.map((diagram) => {
                            // 소유자이거나, 관리자이면서 소유자가 없는 경우(레거시 데이터) 수정/삭제 가능
                            const isAdmin = user?.is_admin || user?.role === 'admin';
                            const isOwner = isAuthenticated() && diagram.user_id === user?.id;
                            const canManage = isOwner || (isAdmin && !diagram.user_id);
                            return renderDiagramRow(diagram, true, canManage);
                          })
                      }
                    </tbody>
                  </Table>
                </TableContainer>

                {paginationData.totalPages > 1 && (
                  <Pagination>
                    <PaginationInfo>
                      {paginationData.startIndex + 1}-{paginationData.endIndex} / {paginationData.totalItems}개
                    </PaginationInfo>
                    <PaginationControls>
                      <PaginationButton
                        onClick={() => handlePageChange(1)}
                        disabled={currentPage === 1}
                        title="첫 페이지"
                      >
                        <ChevronsLeft size={16} />
                      </PaginationButton>
                      <PaginationButton
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        title="이전 페이지"
                      >
                        <ChevronLeft size={16} />
                      </PaginationButton>
                      <PaginationPages>
                        {Array.from({ length: paginationData.totalPages }, (_, i) => i + 1)
                          .filter(page => {
                            return page === 1 ||
                              page === paginationData.totalPages ||
                              Math.abs(page - currentPage) <= 2;
                          })
                          .map((page, index, arr) => (
                            <React.Fragment key={page}>
                              {index > 0 && arr[index - 1] !== page - 1 && (
                                <PaginationEllipsis>...</PaginationEllipsis>
                              )}
                              <PaginationPage
                                active={currentPage === page}
                                onClick={() => handlePageChange(page)}
                              >
                                {page}
                              </PaginationPage>
                            </React.Fragment>
                          ))
                        }
                      </PaginationPages>
                      <PaginationButton
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === paginationData.totalPages}
                        title="다음 페이지"
                      >
                        <ChevronRight size={16} />
                      </PaginationButton>
                      <PaginationButton
                        onClick={() => handlePageChange(paginationData.totalPages)}
                        disabled={currentPage === paginationData.totalPages}
                        title="마지막 페이지"
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
              </>
            )}
          </ListSection>

          <UserInfo>
            {isAuthenticated() ? (
              <span>로그인: {user?.name || user?.email}</span>
            ) : (
              <span className="not-logged-in">
                <AlertCircle size={14} />
                로그인하면 내 다이어그램을 저장할 수 있습니다
              </span>
            )}
          </UserInfo>
        </ModalBody>
      </Modal>
    </Overlay>
  );
};

export default ServerSyncModal;
