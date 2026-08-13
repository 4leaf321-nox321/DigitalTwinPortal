import React, { useState, useMemo, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { AnimatePresence } from 'framer-motion';
import { List, LayoutGrid, X, Filter, ChevronDown, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import Header from './components/Layout/Header';

import IssueGroupSidebar from './components/IssueGroupSidebar';
import IssueList from './components/IssueList';
import IssueDetail from './components/IssueDetail';
import IssueModal from './components/IssueModal';
import KanbanBoard from './components/KanbanBoard';
import SPDMDashboardView from './components/SPDMDashboardView';
import GroupModal from './components/GroupModal';
import ScheduleView from './components/ScheduleView';
import ModuleStatusView from './components/ModuleStatus/ModuleStatusView';
import SettingsModal from './components/SettingsModal';
import { ModuleCategoryProvider } from './contexts/ModuleCategoryContext';
import { ISSUE_STATUS } from './data/sampleData';
import { spdmApi } from './services/spdmApi';

// digital-twin-dashboard 시스템 설정에서 사업부 목록 가져오기
const fetchDivisions = async () => {
  try {
    const token = localStorage.getItem('accessToken');
    const response = await fetch('/api/digital-twin-dashboard/settings', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('설정 조회 실패');
    }

    const data = await response.json();
    // divisions 배열을 departments 형식으로 변환
    if (data.data?.divisions) {
      return data.data.divisions.map(div => ({
        id: div.id,
        name: div.name,
        color: div.color || '#64748b'
      }));
    }
    return [];
  } catch (error) {
    console.error('사업부 목록 조회 실패:', error);
    return [];
  }
};

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f8fafc;
`;

const MainContent = styled.main`
  flex: 1;
  display: flex;
  overflow: hidden;
`;

const Toast = styled.div`
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  padding: 1rem 1.5rem;
  background: #1e293b;
  color: white;
  border-radius: 0.75rem;
  font-size: 0.875rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  z-index: 1000;
  animation: slideIn 0.3s ease;

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const IssueViewToggle = styled.div`
  display: flex;
  background: #f1f5f9;
  border-radius: 0.5rem;
  padding: 3px;
  border: 1px solid #e2e8f0;
`;

const ViewToggleButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.875rem;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  background: ${props => props.$active ? '#8b5cf6' : 'transparent'};
  color: ${props => props.$active ? 'white' : '#64748b'};

  &:hover {
    background: ${props => props.$active ? '#7c3aed' : '#e2e8f0'};
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;

const IssueViewHeader = styled.div`
  padding: 0.75rem 1rem;
  background: white;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const FilterSection = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const FilterLabel = styled.span`
  font-size: 0.8125rem;
  color: #64748b;
  font-weight: 500;
`;

const FilterDropdown = styled.div`
  position: relative;
`;

const FilterButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: ${props => props.$active ? '#f0e7ff' : 'white'};
  border: 1px solid ${props => props.$active ? '#8b5cf6' : '#e2e8f0'};
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: ${props => props.$active ? '#7c3aed' : '#475569'};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: #8b5cf6;
    background: #faf5ff;
  }

  svg {
    width: 14px;
    height: 14px;
  }
`;

const FilterMenu = styled.div`
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 280px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  z-index: 50;
  padding: 0.5rem;
`;

const FilterMenuSection = styled.div`
  padding: 0.5rem;

  &:not(:last-child) {
    border-bottom: 1px solid #f1f5f9;
    margin-bottom: 0.5rem;
  }
`;

const FilterMenuLabel = styled.div`
  font-size: 0.6875rem;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
  padding: 0 0.5rem;
`;

const FilterOption = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: ${props => props.$active ? '#f0e7ff' : 'transparent'};
  border: none;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  color: ${props => props.$active ? '#7c3aed' : '#475569'};
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;

  &:hover {
    background: ${props => props.$active ? '#f0e7ff' : '#f8fafc'};
  }

  svg {
    width: 14px;
    height: 14px;
    color: #8b5cf6;
  }
`;

const ActiveFilterBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.625rem;
  background: #f0e7ff;
  color: #7c3aed;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;

  button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    background: transparent;
    border: none;
    color: #7c3aed;
    cursor: pointer;
    padding: 0;
    margin-left: 0.125rem;

    &:hover {
      color: #5b21b6;
    }
  }
`;

const KanbanWrapper = styled.div`
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
`;

const DetailSidebarOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 100;
  opacity: ${props => props.$isOpen ? 1 : 0};
  visibility: ${props => props.$isOpen ? 'visible' : 'hidden'};
  transition: all 0.3s ease;
`;

const DetailSidebar = styled.div`
  position: fixed;
  top: 0;
  right: 0;
  width: 1200px;
  max-width: 85vw;
  height: 100vh;
  background: white;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
  z-index: 101;
  transform: translateX(${props => props.$isOpen ? '0' : '100%'});
  transition: transform 0.3s ease;
  display: flex;
  flex-direction: column;
`;

const SidebarHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;

  span {
    font-size: 0.875rem;
    font-weight: 600;
    color: #64748b;
  }
`;

const SidebarCloseButton = styled.button`
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #fee2e2;
    border-color: #fecaca;
    color: #ef4444;
  }
`;

const SidebarContent = styled.div`
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const SPDMStatusApp = ({ onGoHome }) => {
  const { user } = useAuth();

  // 완료 이슈 필터 옵션
  const COMPLETED_FILTER_OPTIONS = [
    { id: 'all', name: '전체', days: null },
    { id: '1week', name: '최근 1주', days: 7 },
    { id: '1month', name: '최근 1개월', days: 30 },
    { id: '3months', name: '최근 3개월', days: 90 },
    { id: '6months', name: '최근 6개월', days: 180 },
  ];

  const DATE_FIELD_OPTIONS = [
    { id: 'updatedAt', name: '수정일 기준' },
    { id: 'createdAt', name: '등록일 기준' },
    { id: 'dueDate', name: '목표일정 기준' },
  ];

  // 상태 관리
  const [viewMode, setViewMode] = useState('schedule'); // 'dashboard' | 'issues' | 'modules' | 'schedule'
  const [issueViewMode, setIssueViewMode] = useState('list'); // 'list' | 'kanban'
  const [completedFilter, setCompletedFilter] = useState('1month'); // 완료 이슈 필터
  const [dateFieldFilter, setDateFieldFilter] = useState('updatedAt'); // 날짜 필드 기준
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [groups, setGroups] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [issues, setIssues] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedIssue, setSelectedIssue] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [showModal, setShowModal] = useState(false);
  const [editingIssue, setEditingIssue] = useState(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);

  // 데이터 로드
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [groupsData, issuesData, divisionsData] = await Promise.all([
        spdmApi.getGroups(),
        spdmApi.getIssues(),
        fetchDivisions()
      ]);
      setGroups(groupsData);
      setIssues(issuesData);
      setDepartments(divisionsData);
    } catch (error) {
      console.error('데이터 로드 실패:', error);
      showToast('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 선택된 이슈의 이력 로드
  useEffect(() => {
    const loadHistory = async () => {
      if (selectedIssue?.id) {
        try {
          const historyData = await spdmApi.getIssueHistory(selectedIssue.id);
          setHistory(historyData);
        } catch (error) {
          console.error('이력 로드 실패:', error);
        }
      } else {
        setHistory([]);
      }
    };
    loadHistory();
  }, [selectedIssue?.id]);

  // 필터 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showFilterMenu && !event.target.closest('[data-filter-dropdown]')) {
        setShowFilterMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFilterMenu]);

  // 토스트 메시지 표시
  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  };

  // 이슈 그룹별 개수 계산
  const issueCounts = useMemo(() => {
    const counts = {};
    groups.forEach(group => {
      counts[group.id] = issues.filter(issue => issue.groupId === group.id).length;
    });
    return counts;
  }, [issues, groups]);

  // 이슈별 히스토리 맵 (선택된 이슈용)
  const historyMap = useMemo(() => {
    const map = {};
    if (selectedIssue?.id) {
      map[selectedIssue.id] = history;
    }
    return map;
  }, [history, selectedIssue?.id]);

  // 필터링된 이슈 목록
  const filteredIssues = useMemo(() => {
    let result = [...issues];

    // 그룹 필터
    if (selectedGroup) {
      result = result.filter(issue => issue.groupId === selectedGroup);
    }

    // 완료 이슈 기간 필터 (완료되지 않은 이슈는 항상 표시)
    const filterOption = COMPLETED_FILTER_OPTIONS.find(opt => opt.id === completedFilter);
    if (filterOption && filterOption.days !== null) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - filterOption.days);
      cutoffDate.setHours(0, 0, 0, 0);

      result = result.filter(issue => {
        // 완료되지 않은 이슈는 항상 표시
        if (issue.status !== 'completed') {
          return true;
        }

        // 완료된 이슈는 날짜 기준으로 필터링
        let dateValue;
        switch (dateFieldFilter) {
          case 'createdAt':
            dateValue = issue.createdAt;
            break;
          case 'dueDate':
            dateValue = issue.dueDate;
            break;
          case 'updatedAt':
          default:
            dateValue = issue.updatedAt;
            break;
        }

        if (!dateValue) return true; // 날짜가 없으면 표시

        // 날짜 파싱
        let issueDate;
        if (dateFieldFilter === 'dueDate') {
          // dueDate는 YYYY-MM-DD 형식
          const dateStr = dateValue.split('T')[0];
          issueDate = new Date(dateStr + 'T00:00:00');
        } else {
          // createdAt, updatedAt은 datetime 형식
          let dateStr = dateValue;
          if (!dateStr.endsWith('Z') && !dateStr.includes('+')) {
            dateStr = dateStr + 'Z';
          }
          issueDate = new Date(dateStr);
        }

        return issueDate >= cutoffDate;
      });
    }

    // 검색 필터
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(issue =>
        issue.title.toLowerCase().includes(query) ||
        (issue.description || '').toLowerCase().includes(query) ||
        issue.assignee.toLowerCase().includes(query)
      );
    }

    // 정렬
    switch (sortBy) {
      case 'newest':
        result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
      case 'oldest':
        result.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        break;
      case 'updated':
        result.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        break;
      default:
        break;
    }

    return result;
  }, [issues, selectedGroup, searchQuery, sortBy, completedFilter, dateFieldFilter, COMPLETED_FILTER_OPTIONS]);

  // 그룹 추가/수정
  const handleSaveGroup = async (groupData) => {
    try {
      const isEdit = groupData.id && groups.some(g => g.id === groupData.id);

      if (isEdit) {
        const updated = await spdmApi.updateGroup(groupData.id, groupData);
        setGroups(prev => prev.map(g => g.id === updated.id ? updated : g));
        showToast(`"${updated.name}" 그룹이 수정되었습니다.`);
      } else {
        const created = await spdmApi.createGroup(groupData);
        setGroups(prev => [...prev, created]);
        showToast(`"${created.name}" 그룹이 추가되었습니다.`);
      }

      setShowGroupModal(false);
      setEditingGroup(null);
    } catch (error) {
      console.error('그룹 저장 실패:', error);
      showToast('그룹 저장에 실패했습니다.');
    }
  };

  // 그룹 삭제
  const handleDeleteGroup = async (groupId) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    if (window.confirm(`"${group.name}" 그룹을 삭제하시겠습니까?\n이 그룹에 속한 이슈들도 함께 삭제됩니다.`)) {
      try {
        await spdmApi.deleteGroup(groupId);
        setGroups(prev => prev.filter(g => g.id !== groupId));
        setIssues(prev => prev.filter(i => i.groupId !== groupId));

        if (selectedGroup === groupId) {
          setSelectedGroup(null);
        }
        if (selectedIssue?.groupId === groupId) {
          setSelectedIssue(null);
        }

        setShowGroupModal(false);
        setEditingGroup(null);
        showToast(`"${group.name}" 그룹이 삭제되었습니다.`);
      } catch (error) {
        console.error('그룹 삭제 실패:', error);
        showToast('그룹 삭제에 실패했습니다.');
      }
    }
  };

  // 이슈 추가/수정
  const handleSaveIssue = async (issueData) => {
    const { pendingFiles, id, createdAt, updatedAt, ...issuePayload } = issueData;
    const isEdit = id && issues.some(i => i.id === id);

    try {
      let savedIssue;

      if (isEdit) {
        savedIssue = await spdmApi.updateIssue(id, issuePayload);
        setIssues(prev => prev.map(i => i.id === savedIssue.id ? savedIssue : i));
        if (selectedIssue?.id === savedIssue.id) {
          setSelectedIssue(savedIssue);
        }
        showToast('이슈가 수정되었습니다.');
      } else {
        savedIssue = await spdmApi.createIssue(issuePayload);
        setIssues(prev => [savedIssue, ...prev]);
        showToast('새 이슈가 등록되었습니다.');
      }

      // 파일 업로드 처리
      if (pendingFiles && pendingFiles.length > 0) {
        try {
          const uploadedAttachments = [];
          for (const file of pendingFiles) {
            const result = await spdmApi.uploadAttachment(savedIssue.id, file);
            uploadedAttachments.push(result);
          }

          // 업로드된 파일 정보 추가
          const updatedIssue = {
            ...savedIssue,
            attachments: [...(savedIssue.attachments || []), ...uploadedAttachments]
          };
          setIssues(prev => prev.map(i =>
            i.id === savedIssue.id ? updatedIssue : i
          ));

          if (selectedIssue?.id === savedIssue.id) {
            setSelectedIssue(updatedIssue);
          }

          showToast(`${pendingFiles.length}개 파일이 업로드되었습니다.`);
        } catch (error) {
          console.error('파일 업로드 실패:', error);
          showToast('일부 파일 업로드에 실패했습니다.');
        }
      }

      setShowModal(false);
      setEditingIssue(null);
    } catch (error) {
      console.error('이슈 저장 실패:', error);
      showToast('이슈 저장에 실패했습니다.');
    }
  };

  // 이슈 삭제
  const handleDeleteIssue = async (issueId) => {
    if (window.confirm('정말 이 이슈를 삭제하시겠습니까?')) {
      try {
        await spdmApi.deleteIssue(issueId);
        setIssues(prev => prev.filter(i => i.id !== issueId));
        if (selectedIssue?.id === issueId) {
          setSelectedIssue(null);
        }
        showToast('이슈가 삭제되었습니다.');
      } catch (error) {
        console.error('이슈 삭제 실패:', error);
        showToast('이슈 삭제에 실패했습니다.');
      }
    }
  };

  // 상태 변경
  const handleStatusChange = async (issueId, newStatus) => {
    const issue = issues.find(i => i.id === issueId);
    const newStatusName = ISSUE_STATUS.find(s => s.id === newStatus)?.name;

    try {
      const updated = await spdmApi.changeIssueStatus(issueId, newStatus, user?.name || '시스템');
      setIssues(prev => prev.map(i =>
        i.id === issueId ? updated : i
      ));

      if (selectedIssue?.id === issueId) {
        setSelectedIssue(updated);
        // 이력 새로고침
        const historyData = await spdmApi.getIssueHistory(issueId);
        setHistory(historyData);
      }

      showToast(`상태가 "${newStatusName}"으로 변경되었습니다.`);
    } catch (error) {
      console.error('상태 변경 실패:', error);
      showToast('상태 변경에 실패했습니다.');
    }
  };

  // 댓글 추가
  const handleAddComment = async (commentData) => {
    try {
      const { pendingFiles, ...commentPayload } = commentData;
      let attachmentInfo = null;

      // 파일이 있으면 먼저 업로드
      if (pendingFiles && pendingFiles.length > 0) {
        const uploadedAttachments = [];
        for (const file of pendingFiles) {
          try {
            const result = await spdmApi.uploadAttachment(commentData.issueId, file);
            uploadedAttachments.push(result);
          } catch (err) {
            console.error('파일 업로드 실패:', err);
          }
        }

        // 업로드된 첨부파일 정보를 JSON 문자열로 저장
        if (uploadedAttachments.length > 0) {
          attachmentInfo = JSON.stringify(uploadedAttachments.map(att => ({
            id: att.id,
            filename: att.originalFilename || att.original_filename,
            size: att.fileSize || att.file_size
          })));

          // 이슈의 첨부파일 목록 업데이트
          const updatedIssue = {
            ...selectedIssue,
            attachments: [...(selectedIssue.attachments || []), ...uploadedAttachments]
          };
          setIssues(prev => prev.map(i =>
            i.id === commentData.issueId ? updatedIssue : i
          ));
          if (selectedIssue?.id === commentData.issueId) {
            setSelectedIssue(updatedIssue);
          }
        }
      }

      // 의견 등록
      await spdmApi.addComment(commentData.issueId, {
        content: commentPayload.content,
        author: commentPayload.author,
        departmentId: commentPayload.departmentId,
        attachment: attachmentInfo
      });

      // 이력 새로고침
      const historyData = await spdmApi.getIssueHistory(commentData.issueId);
      setHistory(historyData);

      // 이슈 업데이트 시간 갱신
      setIssues(prev => prev.map(i =>
        i.id === commentData.issueId
          ? { ...i, updatedAt: new Date().toISOString() }
          : i
      ));

      const fileMsg = pendingFiles?.length > 0 ? ` (${pendingFiles.length}개 파일 첨부)` : '';
      showToast(`의견이 등록되었습니다.${fileMsg}`);
    } catch (error) {
      console.error('의견 등록 실패:', error);
      showToast('의견 등록에 실패했습니다.');
    }
  };

  // 타임라인 항목 삭제
  const handleDeleteHistory = async (historyId) => {
    try {
      await spdmApi.deleteHistory(historyId);

      // 이력 새로고침
      if (selectedIssue?.id) {
        const historyData = await spdmApi.getIssueHistory(selectedIssue.id);
        setHistory(historyData);
      }

      showToast('의견이 삭제되었습니다.');
    } catch (error) {
      console.error('의견 삭제 실패:', error);
      showToast('의견 삭제에 실패했습니다.');
    }
  };

  // 이슈 선택 시 상세 데이터 업데이트
  const handleSelectIssue = (issue) => {
    setSelectedIssue(issue);
  };

  // 첨부파일 다운로드 (ZIP으로 압축하여 다운로드 - DRM 우회)
  const handleDownloadAttachment = async (attachment) => {
    try {
      await spdmApi.downloadAttachment(
        attachment.id,
        attachment.originalFilename || attachment.original_filename || attachment.filename
      );
    } catch (error) {
      console.error('다운로드 실패:', error);
      showToast('파일 다운로드에 실패했습니다.');
    }
  };

  // 첨부파일 삭제
  const handleDeleteAttachment = async (attachment) => {
    const filename = attachment.originalFilename || attachment.original_filename || attachment.filename;
    if (!window.confirm(`"${filename}" 파일을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      await spdmApi.deleteAttachment(attachment.id);

      // 이슈의 첨부파일 목록에서 삭제
      if (selectedIssue) {
        const updatedIssue = {
          ...selectedIssue,
          attachments: (selectedIssue.attachments || []).filter(a => a.id !== attachment.id)
        };
        setIssues(prev => prev.map(i =>
          i.id === selectedIssue.id ? updatedIssue : i
        ));
        setSelectedIssue(updatedIssue);
      }

      showToast('첨부파일이 삭제되었습니다.');
    } catch (error) {
      console.error('첨부파일 삭제 실패:', error);
      showToast('첨부파일 삭제에 실패했습니다.');
    }
  };

  return (
    <ModuleCategoryProvider>
    <Container>
      <Header
        onGoHome={onGoHome}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onOpenSettings={() => setShowSettingsModal(true)}
      />

      {viewMode === 'dashboard' ? (
        <MainContent>
          <SPDMDashboardView departments={departments} />
        </MainContent>
      ) : viewMode === 'issues' ? (
        <>
          <IssueViewHeader>
            <FilterSection>
              <FilterLabel>완료 이슈 표시:</FilterLabel>
              <FilterDropdown data-filter-dropdown>
                <FilterButton
                  $active={completedFilter !== 'all'}
                  onClick={() => setShowFilterMenu(!showFilterMenu)}
                >
                  <Filter />
                  {COMPLETED_FILTER_OPTIONS.find(opt => opt.id === completedFilter)?.name || '전체'}
                  <ChevronDown style={{ marginLeft: '0.25rem' }} />
                </FilterButton>
                {showFilterMenu && (
                  <FilterMenu>
                    <FilterMenuSection>
                      <FilterMenuLabel>표시 기간</FilterMenuLabel>
                      {COMPLETED_FILTER_OPTIONS.map(option => (
                        <FilterOption
                          key={option.id}
                          $active={completedFilter === option.id}
                          onClick={() => {
                            setCompletedFilter(option.id);
                          }}
                        >
                          {option.name}
                          {completedFilter === option.id && <Check />}
                        </FilterOption>
                      ))}
                    </FilterMenuSection>
                    <FilterMenuSection>
                      <FilterMenuLabel>기준 날짜</FilterMenuLabel>
                      {DATE_FIELD_OPTIONS.map(option => (
                        <FilterOption
                          key={option.id}
                          $active={dateFieldFilter === option.id}
                          onClick={() => {
                            setDateFieldFilter(option.id);
                          }}
                        >
                          {option.name}
                          {dateFieldFilter === option.id && <Check />}
                        </FilterOption>
                      ))}
                    </FilterMenuSection>
                  </FilterMenu>
                )}
              </FilterDropdown>
              {completedFilter !== 'all' && (
                <ActiveFilterBadge>
                  {DATE_FIELD_OPTIONS.find(opt => opt.id === dateFieldFilter)?.name}
                  <button onClick={() => setCompletedFilter('all')}>
                    <X size={12} />
                  </button>
                </ActiveFilterBadge>
              )}
            </FilterSection>
            <IssueViewToggle>
              <ViewToggleButton
                $active={issueViewMode === 'list'}
                onClick={() => setIssueViewMode('list')}
              >
                <List />
                리스트
              </ViewToggleButton>
              <ViewToggleButton
                $active={issueViewMode === 'kanban'}
                onClick={() => setIssueViewMode('kanban')}
              >
                <LayoutGrid />
                칸반
              </ViewToggleButton>
            </IssueViewToggle>
          </IssueViewHeader>
          {issueViewMode === 'list' ? (
            <MainContent>
              <IssueGroupSidebar
                groups={groups}
                selectedGroup={selectedGroup}
                onSelectGroup={setSelectedGroup}
                issueCounts={issueCounts}
                onAddGroup={() => {
                  setEditingGroup(null);
                  setShowGroupModal(true);
                }}
                onEditGroup={(group) => {
                  setEditingGroup(group);
                  setShowGroupModal(true);
                }}
                onDeleteGroup={handleDeleteGroup}
              />
              <IssueList
                issues={filteredIssues}
                selectedIssue={selectedIssue}
                onSelectIssue={handleSelectIssue}
                onAddIssue={() => {
                  setEditingIssue(null);
                  setShowModal(true);
                }}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                sortBy={sortBy}
                onSortChange={setSortBy}
                historyMap={historyMap}
                groups={groups}
                departments={departments}
              />
              <IssueDetail
                issue={selectedIssue}
                history={historyMap[selectedIssue?.id] || []}
                groups={groups}
                departments={departments}
                currentUser={user}
                onEdit={(issue) => {
                  setEditingIssue(issue);
                  setShowModal(true);
                }}
                onDelete={handleDeleteIssue}
                onStatusChange={handleStatusChange}
                onAddComment={handleAddComment}
                onDeleteHistory={handleDeleteHistory}
                onDownloadAttachment={handleDownloadAttachment}
                onDeleteAttachment={handleDeleteAttachment}
              />
            </MainContent>
          ) : (
            <>
              <KanbanWrapper>
                <IssueGroupSidebar
                  groups={groups}
                  selectedGroup={selectedGroup}
                  onSelectGroup={setSelectedGroup}
                  issueCounts={issueCounts}
                  onAddGroup={() => {
                    setEditingGroup(null);
                    setShowGroupModal(true);
                  }}
                  onEditGroup={(group) => {
                    setEditingGroup(group);
                    setShowGroupModal(true);
                  }}
                  onDeleteGroup={handleDeleteGroup}
                />
                <KanbanBoard
                  issues={filteredIssues}
                  selectedIssue={selectedIssue}
                  onSelectIssue={handleSelectIssue}
                  onAddIssue={() => {
                    setEditingIssue(null);
                    setShowModal(true);
                  }}
                  groups={groups}
                  departments={departments}
                  historyMap={historyMap}
                />
              </KanbanWrapper>
              <DetailSidebarOverlay
                $isOpen={!!selectedIssue}
                onClick={() => setSelectedIssue(null)}
              />
              <DetailSidebar $isOpen={!!selectedIssue}>
                <SidebarHeader>
                  <span>이슈 상세</span>
                  <SidebarCloseButton onClick={() => setSelectedIssue(null)}>
                    <X size={16} />
                  </SidebarCloseButton>
                </SidebarHeader>
                <SidebarContent>
                  <IssueDetail
                  issue={selectedIssue}
                  history={historyMap[selectedIssue?.id] || []}
                  groups={groups}
                  departments={departments}
                  currentUser={user}
                  onEdit={(issue) => {
                    setEditingIssue(issue);
                    setShowModal(true);
                  }}
                  onDelete={handleDeleteIssue}
                  onStatusChange={handleStatusChange}
                  onAddComment={handleAddComment}
                  onDeleteHistory={handleDeleteHistory}
                  onDownloadAttachment={handleDownloadAttachment}
                  onDeleteAttachment={handleDeleteAttachment}
                />
                </SidebarContent>
              </DetailSidebar>
            </>
          )}
        </>
      ) : viewMode === 'modules' ? (
        <ModuleStatusView departments={departments} />
      ) : (
        <ScheduleView departments={departments} />
      )}

      <IssueModal
        isOpen={showModal}
        issue={editingIssue}
        groups={groups}
        departments={departments}
        currentUser={user}
        onClose={() => {
          setShowModal(false);
          setEditingIssue(null);
        }}
        onSave={handleSaveIssue}
      />

      <GroupModal
        isOpen={showGroupModal}
        group={editingGroup}
        onClose={() => {
          setShowGroupModal(false);
          setEditingGroup(null);
        }}
        onSave={handleSaveGroup}
        onDelete={handleDeleteGroup}
      />

      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />

      <AnimatePresence>
        {toast && <Toast>{toast}</Toast>}
      </AnimatePresence>
    </Container>
    </ModuleCategoryProvider>
  );
};

export default SPDMStatusApp;
