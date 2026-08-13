import React, { useState, useRef, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { Plus } from 'lucide-react';
import ProcessBox from './components/ProcessBox';
import ConnectionRenderer from './components/ConnectionRenderer';
import ProcessDetailModal from './components/ProcessDetailModal';
import { ConfirmModal } from '../../../../shared/components/Modal';

const HeaderActions = styled.div`
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 8px;
  z-index: 1550;
`;

const AddProcessButton = styled.button`
  width: 40px;
  height: 40px;
  min-width: 40px;
  min-height: 40px;
  padding: 0;
  margin: 0;
  border: none;
  border-radius: 50%;
  background: #e5e7eb;
  color: #374151;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1600;
  position: relative;
  transition: all 0.2s ease;
  font-size: 20px;
  font-weight: 300;
  line-height: 1;
  box-sizing: border-box;
  font-family: Arial, Helvetica, sans-serif;
  
  &:hover {
    background: #d1d5db;
    transform: scale(1.1);
  }
  
  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.3);
  }
  
  &:active {
    transform: scale(0.95);
  }
`;

const ProcessCell = ({ 
  cellId,
  processes = [],
  connections = [],
  onAddProcess,
  onUpdateProcess,
  onDeleteProcess,
  onUpdateConnections,
  onUpdateCellData,
  containerRef,
  globalConnecting = false,
  connectingFrom = null,
  onStartConnection,
  onStartGlobalConnection,
  onEndConnection,
  onCancelConnection,
  allCellData = {},
  cellRefs = {},
  onRequestAddProcess,
  onRequestEditProcess,
  onModalStateChange // 모달 상태 변경 콜백 추가
}) => {
  const [selectedProcess, setSelectedProcess] = useState(null);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailModalProcess, setDetailModalProcess] = useState(null);
  const [detailModalMode, setDetailModalMode] = useState('add');
  
  // 프로세스 삭제 확인 모달 상태
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [processToDelete, setProcessToDelete] = useState(null);
  
  // 연결선 삭제 확인 모달 상태
  const [connectionDeleteConfirmOpen, setConnectionDeleteConfirmOpen] = useState(false);
  const [connectionToDelete, setConnectionToDelete] = useState(null);
  
  const cellRef = containerRef || useRef(null);
  const animationFrameRef = useRef(null);
  const pendingUpdateRef = useRef(null);

  // requestAnimationFrame을 사용한 부드러운 업데이트
  const smoothUpdateProcess = useCallback((cellId, processId, updatedProcess) => {
    // 이전 예약된 업데이트 취소
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    // 새로운 업데이트 예약
    pendingUpdateRef.current = { cellId, processId, updatedProcess };
    
    animationFrameRef.current = requestAnimationFrame(() => {
      if (pendingUpdateRef.current && onUpdateProcess) {
        const { cellId, processId, updatedProcess } = pendingUpdateRef.current;
        onUpdateProcess(cellId, processId, updatedProcess);
        pendingUpdateRef.current = null;
      }
    });
  }, [onUpdateProcess]);

  // 프로세스 추가 핸들러
  const handleAddProcess = () => {
    setDetailModalProcess(null);
    setDetailModalMode('add');
    setDetailModalOpen(true);
  };

  // 프로세스 상세 보기/편집
  const handleShowProcessDetails = (processId) => {
    const process = processes.find(p => p.id === processId);
    if (process) {
      setDetailModalProcess(process);
      setDetailModalMode('edit');
      setDetailModalOpen(true);
    }
  };

  // 프로세스 삭제 (간단하고 확실한 방법)
  const handleDeleteProcess = (processId) => {
    const processToDelete = processes.find(p => p.id === processId);
    if (processToDelete) {
      setProcessToDelete(processToDelete);
      setDeleteConfirmOpen(true);
    }
  };
  
  // 프로세스 삭제 확인 핸들러
  const handleConfirmDeleteProcess = (confirmed) => {
    if (confirmed && processToDelete) {
      // 현재 셀 데이터에서 프로세스와 연결선 삭제
      const updatedProcesses = processes.filter(p => p.id !== processToDelete.id);
      const updatedConnections = connections.filter(
        conn => conn.from !== processToDelete.id && conn.to !== processToDelete.id
      );
      
      const updatedCellData = {
        processes: updatedProcesses,
        connections: updatedConnections
      };
      
      // 상태 업데이트
      if (onUpdateCellData) {
        onUpdateCellData(cellId, updatedCellData);
      }
      
      // 선택 해제
      if (selectedProcess === processToDelete.id) {
        setSelectedProcess(null);
      }
      
      console.log('Process deleted:', processToDelete.id);
      console.log('Updated processes:', updatedProcesses);
      console.log('Updated connections:', updatedConnections);
    }
    
    // 모달 닫기
    setDeleteConfirmOpen(false);
    setProcessToDelete(null);
  };

  // 프로세스 클릭 핸들러
  const handleProcessClick = (processId) => {
    if (globalConnecting) {
      if (connectingFrom && connectingFrom.cellId === cellId && connectingFrom.processId === processId) {
        onCancelConnection();
      } else if (connectingFrom) {
        onEndConnection(cellId, processId);
      } else {
        onStartConnection(cellId, processId);
      }
    } else {
      setSelectedProcess(processId === selectedProcess ? null : processId);
      setSelectedConnection(null);
    }
  };

  // 드래그 관련 핸들러
  const handleMouseDown = (e, processId) => {
    if (globalConnecting) return;
    
    // 모달이 열려있을 때는 드래그 비활성화
    if (detailModalOpen || deleteConfirmOpen || connectionDeleteConfirmOpen) {
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    const rect = cellRef.current.getBoundingClientRect();
    const process = processes.find(p => p.id === processId);
    if (!process) return;
    
    // 마우스 위치와 프로세스 위치의 오프셋 저장
    const offsetX = e.clientX - rect.left - process.x;
    const offsetY = e.clientY - rect.top - process.y;
    
    setDragging({ processId, offsetX, offsetY });
    setSelectedProcess(processId);
  };

  const handleMouseMove = useCallback((e) => {
    if (!dragging || !cellRef.current) return;
    
    const rect = cellRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - dragging.offsetX;
    const y = e.clientY - rect.top - dragging.offsetY;
    
    const process = processes.find(p => p.id === dragging.processId);
    if (process) {
      // 실제 DOM 요소에서 크기 얻기
      const processElement = document.querySelector(`[data-process-id="${dragging.processId}"]`);
      let boxWidth = 280;
      let boxHeight = 120;
      
      if (processElement) {
        const processRect = processElement.getBoundingClientRect();
        boxWidth = processRect.width;
        boxHeight = processRect.height;
      }
      
      // 좌표 범위 제한
      const newX = Math.max(0, Math.min(x, rect.width - boxWidth));
      const newY = Math.max(0, Math.min(y, rect.height - boxHeight));
      
      // requestAnimationFrame을 사용한 부드러운 업데이트
      smoothUpdateProcess(cellId, dragging.processId, { 
        ...process, 
        x: newX,
        y: newY
      });
    }
  }, [dragging, cellId, processes, smoothUpdateProcess]);

  const handleMouseUp = () => {
    setDragging(null);
  };

  // 드래그 이벤트 등록 및 정리
  useEffect(() => {
    if (dragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove]);

  // 모달 상태 변경 시 부모에게 알리기
  useEffect(() => {
    const isAnyModalOpen = detailModalOpen || deleteConfirmOpen || connectionDeleteConfirmOpen;
    if (onModalStateChange) {
      onModalStateChange(cellId, isAnyModalOpen);
    }
  }, [detailModalOpen, deleteConfirmOpen, connectionDeleteConfirmOpen, cellId, onModalStateChange]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Delete 키로 선택된 연결선 삭제
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Delete' && selectedConnection && !globalConnecting) {
        handleDeleteConnection(selectedConnection);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedConnection, globalConnecting]);

  // 연결선 관련 핸들러
  const handleConnectionClick = (e, connectionId) => {
    e.stopPropagation();
    if (!globalConnecting) {
      setSelectedConnection(connectionId === selectedConnection ? null : connectionId);
      setSelectedProcess(null);
    }
  };

  const handleDeleteConnection = (connectionId) => {
    const connectionToDelete = connections.find(conn => conn.id === connectionId);
    if (connectionToDelete) {
      setConnectionToDelete(connectionToDelete);
      setConnectionDeleteConfirmOpen(true);
    }
  };
  
  // 연결선 삭제 확인 핸들러
  const handleConfirmDeleteConnection = (confirmed) => {
    if (confirmed && connectionToDelete) {
      const updatedConnections = connections.filter(conn => conn.id !== connectionToDelete.id);
      onUpdateConnections(cellId, updatedConnections);
      setSelectedConnection(null);
    }
    
    // 모달 닫기
    setConnectionDeleteConfirmOpen(false);
    setConnectionToDelete(null);
  };

  // 프로세스 상세 정보 저장
  const handleSaveProcessDetails = (processData) => {
    if (detailModalMode === 'add') {
      // 새 프로세스 추가
      const newProcess = {
        id: Date.now(),
        x: 20,
        y: 30 + (processes.length * 200),
        ...processData
      };
      
      const currentData = { 
        processes: [...processes, newProcess], 
        connections: [...connections] 
      };
      
      // onUpdateCellData를 사용하여 전체 셀 데이터 업데이트
      if (onUpdateCellData) {
        onUpdateCellData(cellId, currentData);
      }
    } else {
      // 기존 프로세스 업데이트
      const updatedProcess = {
        ...detailModalProcess,
        ...processData
      };
      
      const currentData = {
        processes: processes.map(p => 
          p.id === detailModalProcess.id ? updatedProcess : p
        ),
        connections: [...connections]
      };
      
      // onUpdateCellData를 사용하여 전체 셀 데이터 업데이트
      if (onUpdateCellData) {
        onUpdateCellData(cellId, currentData);
      }
    }
    
    setDetailModalOpen(false);
    setDetailModalProcess(null);
  };

  return (
    <>
      {/* 연결선 렌더링 */}
      <ConnectionRenderer
        connections={connections}
        processes={processes}
        cellId={cellId}
        selectedConnection={selectedConnection}
        globalConnecting={globalConnecting}
        onConnectionClick={handleConnectionClick}
        onDeleteConnection={handleDeleteConnection}
      />
      
      {/* 프로세스 추가 버튼 */}
      <HeaderActions>
        <AddProcessButton onClick={handleAddProcess} title="새 프로세스 추가">
          <Plus size={20} />
        </AddProcessButton>
      </HeaderActions>
      
      {/* 프로세스 박스들 */}
      {processes.map(process => (
        <ProcessBox
          key={process.id}
          process={process}
          selected={selectedProcess === process.id}
          connecting={connectingFrom && connectingFrom.cellId === cellId && connectingFrom.processId === process.id}
          showActions={!globalConnecting}
          style={{
            left: process.x,
            top: process.y
          }}
          onMouseDown={(e) => handleMouseDown(e, process.id)}
          onClick={() => handleProcessClick(process.id)}
          onDelete={() => handleDeleteProcess(process.id)}
          onShowDetails={() => handleShowProcessDetails(process.id)}
        />
      ))}
      
      {/* 프로세스 상세 정보 모달 */}
      <ProcessDetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        onSave={handleSaveProcessDetails}
        process={detailModalProcess}
        mode={detailModalMode}
      />
      
      {/* 프로세스 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setProcessToDelete(null);
        }}
        onConfirm={handleConfirmDeleteProcess}
        title="프로세스 삭제"
        message={
          <div>
            <p>다음 프로세스를 삭제하시겠습니까?</p>
            {processToDelete && (
              <div style={{ 
                marginTop: '12px', 
                padding: '12px', 
                backgroundColor: '#f8f9fa', 
                borderRadius: '8px',
                border: '1px solid #e9ecef'
              }}>
                <strong style={{ color: '#495057' }}>{processToDelete.text}</strong>
                {processToDelete.description && (
                  <p style={{ 
                    margin: '8px 0 0 0', 
                    fontSize: '14px', 
                    color: '#6c757d',
                    lineHeight: '1.4'
                  }}>
                    {processToDelete.description}
                  </p>
                )}
              </div>
            )}
            <p style={{ marginTop: '12px', fontSize: '14px', color: '#dc3545' }}>
              ⚠️ 이 작업은 취소할 수 없습니다. 연결된 모든 화살표도 함께 삭제됩니다.
            </p>
          </div>
        }
        type="warning"
        confirmText="삭제"
        cancelText="취소"
        destructive={true}
      />
      
      {/* 연결선 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={connectionDeleteConfirmOpen}
        onClose={() => {
          setConnectionDeleteConfirmOpen(false);
          setConnectionToDelete(null);
        }}
        onConfirm={handleConfirmDeleteConnection}
        title="연결선 삭제"
        message={
          <div>
            <p>이 연결선을 삭제하시겠습니까?</p>
            {connectionToDelete && (
              <div style={{
                marginTop: '12px',
                padding: '12px',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                border: '1px solid #e9ecef'
              }}>
                {(() => {
                  const fromProcess = processes.find(p => p.id === connectionToDelete.from);
                  const toProcess = processes.find(p => p.id === connectionToDelete.to);
                  return (
                    <div style={{ fontSize: '14px', color: '#495057' }}>
                      <div style={{ marginBottom: '4px' }}>
                        <strong>시작:</strong> {fromProcess?.text || '알 수 없는 프로세스'}
                      </div>
                      <div>
                        <strong>끝:</strong> {toProcess?.text || '알 수 없는 프로세스'}
                      </div>
                    </div>
                  );
                })()
                }
              </div>
            )}
            <p style={{ marginTop: '12px', fontSize: '14px', color: '#dc3545' }}>
              ⚠️ 이 작업은 취소할 수 없습니다.
            </p>
          </div>
        }
        type="warning"
        confirmText="삭제"
        cancelText="취소"
        destructive={true}
      />
    </>
  );
};

export default ProcessCell;
