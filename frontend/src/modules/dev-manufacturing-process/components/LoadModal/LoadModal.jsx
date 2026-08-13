import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { X, FolderOpen, Loader, Trash2, RefreshCw, FileText } from 'lucide-react';
import { fetchDiagrams, fetchDiagram, deleteDiagram } from '../../services/diagramApi';

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
  width: 600px;
  max-height: 80vh;
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

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const IconButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
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
  padding: 20px;
  overflow-y: auto;
  flex: 1;
`;

const DiagramList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const DiagramItem = styled.div`
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border: 2px solid ${props => props.selected ? '#3b82f6' : '#e2e8f0'};
  border-radius: 8px;
  background: ${props => props.selected ? '#eff6ff' : 'white'};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: ${props => props.selected ? '#3b82f6' : '#cbd5e1'};
    background: ${props => props.selected ? '#eff6ff' : '#f8fafc'};
  }
`;

const DiagramIcon = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: ${props => props.selected ? '#3b82f6' : '#e2e8f0'};
  color: ${props => props.selected ? 'white' : '#64748b'};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const DiagramInfo = styled.div`
  flex: 1;
  margin-left: 12px;
  min-width: 0;
`;

const DiagramName = styled.div`
  font-weight: 600;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const DiagramMeta = styled.div`
  font-size: 0.8rem;
  color: #64748b;
  margin-top: 2px;
  display: flex;
  gap: 12px;
`;

const DiagramDescription = styled.div`
  font-size: 0.8rem;
  color: #94a3b8;
  margin-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const DeleteButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  color: #94a3b8;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  flex-shrink: 0;

  &:hover {
    background: #fee2e2;
    color: #ef4444;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 40px 20px;
  color: #64748b;
`;

const EmptyIcon = styled.div`
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: #f1f5f9;
  color: #94a3b8;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
`;

const LoadingState = styled.div`
  text-align: center;
  padding: 40px 20px;
  color: #64748b;
`;

const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
`;

const Button = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &.primary {
    background: #3b82f6;
    color: white;
    border: none;

    &:hover:not(:disabled) {
      background: #2563eb;
    }

    &:disabled {
      background: #94a3b8;
      cursor: not-allowed;
    }
  }

  &.secondary {
    background: white;
    color: #64748b;
    border: 1px solid #e2e8f0;

    &:hover {
      background: #f1f5f9;
    }
  }
`;

const ErrorMessage = styled.div`
  color: #ef4444;
  font-size: 0.85rem;
  padding: 8px 12px;
  background: #fef2f2;
  border-radius: 6px;
  margin-bottom: 12px;
`;

const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const LoadModal = ({ isOpen, onClose, onLoad }) => {
  const [diagrams, setDiagrams] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDiagram, setIsLoadingDiagram] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadDiagrams();
    }
  }, [isOpen]);

  const loadDiagrams = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetchDiagrams();
      setDiagrams(response.data || []);
    } catch (err) {
      setError(err.message || '목록을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (e, diagramId) => {
    e.stopPropagation();
    if (!window.confirm('이 다이어그램을 삭제하시겠습니까?')) {
      return;
    }

    try {
      await deleteDiagram(diagramId);
      setDiagrams(diagrams.filter(d => d.id !== diagramId));
      if (selectedId === diagramId) {
        setSelectedId(null);
      }
    } catch (err) {
      setError(err.message || '삭제에 실패했습니다.');
    }
  };

  const handleLoad = async () => {
    if (!selectedId) return;

    setIsLoadingDiagram(true);
    setError('');

    try {
      const response = await fetchDiagram(selectedId);
      const diagramData = response.data;

      onLoad({
        nodes: diagramData.nodes || [],
        edges: diagramData.edges || [],
        viewport: diagramData.viewport || { x: 0, y: 0, zoom: 1 },
        name: diagramData.name,
        colorItems: diagramData.metadata?.colorItems || null,  // 색상 설정 포함
      });

      handleClose();
    } catch (err) {
      setError(err.message || '불러오기에 실패했습니다.');
    } finally {
      setIsLoadingDiagram(false);
    }
  };

  const handleClose = () => {
    setSelectedId(null);
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Overlay onClick={handleClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>
            <FolderOpen size={20} />
            다이어그램 불러오기
          </ModalTitle>
          <HeaderActions>
            <IconButton onClick={loadDiagrams} title="새로고침">
              <RefreshCw size={18} />
            </IconButton>
            <IconButton onClick={handleClose}>
              <X size={20} />
            </IconButton>
          </HeaderActions>
        </ModalHeader>

        <ModalBody>
          {error && <ErrorMessage>{error}</ErrorMessage>}

          {isLoading ? (
            <LoadingState>
              <Loader size={32} className="animate-spin" style={{ margin: '0 auto 12px' }} />
              <div>목록을 불러오는 중...</div>
            </LoadingState>
          ) : diagrams.length === 0 ? (
            <EmptyState>
              <EmptyIcon>
                <FileText size={28} />
              </EmptyIcon>
              <div>저장된 다이어그램이 없습니다.</div>
              <div style={{ fontSize: '0.85rem', marginTop: '8px' }}>
                새 다이어그램을 만들고 저장해보세요.
              </div>
            </EmptyState>
          ) : (
            <DiagramList>
              {diagrams.map((diagram) => (
                <DiagramItem
                  key={diagram.id}
                  selected={selectedId === diagram.id}
                  onClick={() => setSelectedId(diagram.id)}
                >
                  <DiagramIcon selected={selectedId === diagram.id}>
                    <FileText size={20} />
                  </DiagramIcon>
                  <DiagramInfo>
                    <DiagramName>{diagram.name}</DiagramName>
                    <DiagramMeta>
                      <span>노드 {diagram.node_count}개</span>
                      <span>연결선 {diagram.edge_count}개</span>
                      <span>{formatDate(diagram.updated_at)}</span>
                    </DiagramMeta>
                    {diagram.description && (
                      <DiagramDescription>{diagram.description}</DiagramDescription>
                    )}
                  </DiagramInfo>
                  <DeleteButton
                    onClick={(e) => handleDelete(e, diagram.id)}
                    title="삭제"
                  >
                    <Trash2 size={16} />
                  </DeleteButton>
                </DiagramItem>
              ))}
            </DiagramList>
          )}
        </ModalBody>

        <ModalFooter>
          <Button className="secondary" onClick={handleClose}>
            취소
          </Button>
          <Button
            className="primary"
            onClick={handleLoad}
            disabled={!selectedId || isLoadingDiagram}
          >
            {isLoadingDiagram ? (
              <>
                <Loader size={16} className="animate-spin" />
                불러오는 중...
              </>
            ) : (
              <>
                <FolderOpen size={16} />
                불러오기
              </>
            )}
          </Button>
        </ModalFooter>
      </Modal>
    </Overlay>
  );
};

export default LoadModal;
