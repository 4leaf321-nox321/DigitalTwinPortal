import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { X, Camera, RotateCcw, Trash2, Clock, Database, Loader2, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchSnapshots, createSnapshot, deleteSnapshot } from '../../services/settingsApi';

const ITEMS_PER_PAGE = 9;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 2rem;

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .spin {
    animation: spin 1s linear infinite;
  }
`;

const ModalContainer = styled.div`
  background: white;
  border-radius: 1rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  width: 80vw;
  height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 2px solid #e5e7eb;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
`;

const ModalTitle = styled.h2`
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const CloseButton = styled.button`
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  border-radius: 0.5rem;
  padding: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: rgba(255, 255, 255, 0.3);
  }
`;

const ModalContent = styled.div`
  flex: 1;
  padding: 1.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const ActionSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #e5e7eb;
`;

const InputGroup = styled.div`
  display: flex;
  gap: 1rem;
  align-items: center;
`;

const SnapshotNameInput = styled.input`
  flex: 1;
  padding: 0.75rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  font-size: 1rem;
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: #f59e0b;
    box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1);
  }

  &::placeholder {
    color: #9ca3af;
  }
`;

const SaveButton = styled.button`
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
  border: none;
  border-radius: 0.5rem;
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

const SnapshotListContainer = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const SnapshotList = styled.div`
  flex: 1;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  align-content: start;
`;

const Pagination = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
  margin-top: auto;
`;

const PageButton = styled.button`
  background: ${props => props.active ? '#f59e0b' : 'white'};
  color: ${props => props.active ? 'white' : '#374151'};
  border: 1px solid ${props => props.active ? '#f59e0b' : '#e5e7eb'};
  border-radius: 0.375rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background: ${props => props.active ? '#d97706' : '#f3f4f6'};
    border-color: ${props => props.active ? '#d97706' : '#d1d5db'};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const PageInfo = styled.span`
  color: #6b7280;
  font-size: 0.875rem;
  padding: 0 0.5rem;
`;

const SnapshotItem = styled.div`
  background: ${props => props.isLatest ? 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)' : '#f9fafb'};
  border: 2px solid ${props => props.isLatest ? '#f59e0b' : '#e5e7eb'};
  border-radius: 0.75rem;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: all 0.2s ease;

  &:hover {
    border-color: #f59e0b;
    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.1);
  }
`;

const SnapshotInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const SnapshotTitle = styled.div`
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const LatestBadge = styled.span`
  background: #f59e0b;
  color: white;
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
`;

const SnapshotMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.8rem;
  color: #6b7280;
`;

const MetaItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const SnapshotActions = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-top: auto;
`;

const ActionButton = styled.button`
  flex: 1;
  background: ${props => props.variant === 'restore' ? '#10b981' : '#ef4444'};
  color: white;
  border: none;
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px ${props => props.variant === 'restore' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'};
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem 1rem;
  color: #9ca3af;

  svg {
    margin: 0 auto 1rem;
    opacity: 0.5;
  }

  p {
    margin: 0;
    font-size: 1rem;
  }
`;

const SnapshotModal = ({ isOpen, onClose, projects, performances, settings, metadata, onRestore, showSuccess, showError }) => {
  const [snapshots, setSnapshots] = useState([]);
  const [snapshotName, setSnapshotName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  // 페이지네이션 계산
  const totalPages = Math.ceil(snapshots.length / ITEMS_PER_PAGE);
  const paginatedSnapshots = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return snapshots.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [snapshots, currentPage]);

  useEffect(() => {
    if (isOpen) {
      loadSnapshots();
      setCurrentPage(1); // 모달 열릴 때 첫 페이지로
    }
  }, [isOpen]);

  // 스냅샷 삭제 후 현재 페이지에 항목이 없으면 이전 페이지로
  useEffect(() => {
    if (currentPage > 1 && paginatedSnapshots.length === 0) {
      setCurrentPage(prev => prev - 1);
    }
  }, [snapshots, currentPage, paginatedSnapshots.length]);

  const loadSnapshots = async () => {
    setIsLoading(true);
    try {
      const response = await fetchSnapshots();
      // API 응답은 배열 형태
      const snapshotsArray = Array.isArray(response) ? response : [];
      // API 응답 형식을 컴포넌트에서 사용하는 형식으로 변환
      const loadedSnapshots = snapshotsArray.map(s => ({
        id: s.id,
        timestamp: s.created_at,
        description: s.name,
        createdBy: s.created_by_name,
        snapshotType: s.snapshot_type,
        data: s.snapshot_data
      }));
      setSnapshots(loadedSnapshots);
    } catch (error) {
      console.error('스냅샷 로드 실패:', error);
      showError('스냅샷을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSnapshot = async () => {
    if (!snapshotName.trim()) {
      showError('스냅샷 이름을 입력해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      // 삭제된 과제(_deleted: true)는 스냅샷에서 제외
      const activeProjects = projects.filter(p => !p._deleted);

      const snapshotPayload = {
        name: snapshotName.trim(),
        description: '',
        snapshotType: 'manual',
        snapshotData: {
          projects: activeProjects,
          performances,
          settings,
          metadata
        }
      };

      await createSnapshot(snapshotPayload);
      setSnapshotName(''); // 입력 필드 초기화
      showSuccess('스냅샷이 성공적으로 저장되었습니다.');
      // 목록 새로고침
      await loadSnapshots();
    } catch (error) {
      console.error('스냅샷 저장 실패:', error);
      showError('스냅샷 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestoreSnapshot = (snapshot) => {
    if (window.confirm('이 스냅샷으로 복원하시겠습니까? 현재 데이터는 덮어씌워집니다.')) {
      try {
        onRestore(snapshot.data);
        showSuccess('스냅샷이 성공적으로 복원되었습니다.');
        onClose();
      } catch (error) {
        console.error('스냅샷 복원 실패:', error);
        showError('스냅샷 복원 중 오류가 발생했습니다.');
      }
    }
  };

  const handleDeleteSnapshot = async (snapshotId) => {
    if (window.confirm('이 스냅샷을 삭제하시겠습니까?')) {
      setDeletingId(snapshotId);
      try {
        await deleteSnapshot(snapshotId);
        setSnapshots(prev => prev.filter(s => s.id !== snapshotId));
        showSuccess('스냅샷이 삭제되었습니다.');
      } catch (error) {
        console.error('스냅샷 삭제 실패:', error);
        showError('스냅샷 삭제 중 오류가 발생했습니다.');
      } finally {
        setDeletingId(null);
      }
    }
  };

  const formatTimestamp = (timestamp) => {
    // 백엔드에서 UTC로 저장되므로, timezone 정보가 없으면 UTC로 파싱
    let dateStr = timestamp;
    if (dateStr && !dateStr.endsWith('Z') && !dateStr.includes('+')) {
      dateStr = dateStr + 'Z';
    }
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;

    return date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

  return (
    <ModalOverlay onClick={onClose}>
      <ModalContainer onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>
            <Camera size={24} />
            스냅샷 관리
          </ModalTitle>
          <CloseButton onClick={onClose}>
            <X size={20} />
          </CloseButton>
        </ModalHeader>

        <ModalContent>
          <ActionSection>
            <InputGroup>
              <SnapshotNameInput
                type="text"
                value={snapshotName}
                onChange={(e) => setSnapshotName(e.target.value)}
                placeholder="스냅샷 이름을 입력하세요 (예: 2025년 1월 백업)"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveSnapshot();
                  }
                }}
              />
              <SaveButton onClick={handleSaveSnapshot} disabled={isSaving}>
                {isSaving ? <Loader2 size={18} className="spin" /> : <Camera size={18} />}
                {isSaving ? '저장 중...' : '저장'}
              </SaveButton>
            </InputGroup>
          </ActionSection>

          <SnapshotListContainer>
            <h3 style={{ margin: '0 0 1rem 0', color: '#374151', fontSize: '1.125rem', fontWeight: '600' }}>
              저장된 스냅샷 ({snapshots.length}개)
            </h3>

            {isLoading ? (
              <EmptyState>
                <Loader2 size={48} className="spin" />
                <p>스냅샷을 불러오는 중...</p>
              </EmptyState>
            ) : snapshots.length === 0 ? (
              <EmptyState>
                <Camera size={48} />
                <p>저장된 스냅샷이 없습니다.</p>
                <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>위의 버튼을 눌러 현재 상태를 저장하세요.</p>
              </EmptyState>
            ) : (
              <>
                <SnapshotList>
                  {paginatedSnapshots.map((snapshot, index) => {
                    const globalIndex = (currentPage - 1) * ITEMS_PER_PAGE + index;
                    return (
                      <SnapshotItem key={snapshot.id} isLatest={globalIndex === 0}>
                        <SnapshotInfo>
                          <SnapshotTitle>
                            {snapshot.description}
                            {globalIndex === 0 && <LatestBadge>최신</LatestBadge>}
                            {snapshot.snapshotType === 'auto' && (
                              <span style={{ background: '#6b7280', color: 'white', padding: '0.125rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: '600' }}>자동</span>
                            )}
                          </SnapshotTitle>
                          <SnapshotMeta>
                            <MetaItem>
                              <Clock size={14} />
                              {formatTimestamp(snapshot.timestamp)}
                            </MetaItem>
                            <MetaItem>
                              <Database size={14} />
                              프로젝트 {snapshot.data?.projects?.length || 0}개
                            </MetaItem>
                            {snapshot.createdBy && (
                              <MetaItem>
                                <User size={14} />
                                {snapshot.createdBy}
                              </MetaItem>
                            )}
                          </SnapshotMeta>
                        </SnapshotInfo>
                        <SnapshotActions>
                          <ActionButton variant="restore" onClick={() => handleRestoreSnapshot(snapshot)}>
                            <RotateCcw size={16} />
                            복원
                          </ActionButton>
                          <ActionButton
                            variant="delete"
                            onClick={() => handleDeleteSnapshot(snapshot.id)}
                            disabled={deletingId === snapshot.id}
                          >
                            {deletingId === snapshot.id ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />}
                            삭제
                          </ActionButton>
                        </SnapshotActions>
                      </SnapshotItem>
                    );
                  })}
                </SnapshotList>

                {totalPages > 1 && (
                  <Pagination>
                    <PageButton
                      onClick={() => setCurrentPage(prev => prev - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft size={16} />
                    </PageButton>

                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <PageButton
                        key={page}
                        active={currentPage === page}
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </PageButton>
                    ))}

                    <PageButton
                      onClick={() => setCurrentPage(prev => prev + 1)}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight size={16} />
                    </PageButton>
                  </Pagination>
                )}
              </>
            )}
          </SnapshotListContainer>
        </ModalContent>
      </ModalContainer>
    </ModalOverlay>
  );
};

export default SnapshotModal;
