import { useState, useEffect } from 'react';

export const useGlobalConnection = (globalConnecting, onToggleGlobalConnection) => {
  const [connectingFrom, setConnectingFrom] = useState(null); // { cellId, processId }

  // ESC 키로 글로벌 연결 종료
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && globalConnecting) {
        handleCancelConnection();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [globalConnecting]);

  // 글로벌 연결 핸들러 - 연결 모드를 유지하도록 수정
  const handleGlobalConnect = (fromCellId, fromProcessId, toCellId, toProcessId, cellData, onUpdateCellData) => {
    // 두 셀이 같으면 로컬 연결
    if (fromCellId === toCellId) {
      const currentData = cellData[fromCellId] || { processes: [], connections: [] };
      const newConnection = {
        id: Date.now(),
        from: fromProcessId,
        to: toProcessId
      };
      const updatedData = {
        ...currentData,
        connections: [...currentData.connections, newConnection]
      };
      onUpdateCellData(fromCellId, updatedData);
    } else {
      // 다른 셀 간 연결 - 첫 번째 셀에 연결 정보 저장
      const fromData = cellData[fromCellId] || { processes: [], connections: [] };
      const newConnection = {
        id: Date.now(),
        from: fromProcessId,
        to: toProcessId,
        targetCell: toCellId // 타겟 셀 정보 추가
      };
      const updatedData = {
        ...fromData,
        connections: [...fromData.connections, newConnection]
      };
      onUpdateCellData(fromCellId, updatedData);
    }
    
    // 연결 완료 후 다음 연결을 위해 시작점 초기화 (연결 모드는 유지)
    setConnectingFrom(null);
  };

  const handleStartConnection = (cellId, processId) => {
    if (!globalConnecting) {
      // 연결 모드 활성화 - 상단에서 관리
      onToggleGlobalConnection && onToggleGlobalConnection();
    }
    setConnectingFrom({ cellId, processId });
  };

  const handleStartGlobalConnection = () => {
    // 연결 버튼을 눌렀을 때 글로벌 연결 모드 시작 - 상단에서 관리
    if (!globalConnecting) {
      onToggleGlobalConnection && onToggleGlobalConnection();
    }
    setConnectingFrom(null); // 아직 시작점 선택 안함
  };

  const handleEndConnection = (cellId, processId, cellData, onUpdateCellData) => {
    if (globalConnecting) {
      if (connectingFrom) {
        // 시작점이 있는 경우 - 연결 완료
        if (connectingFrom.cellId !== cellId || connectingFrom.processId !== processId) {
          handleGlobalConnect(connectingFrom.cellId, connectingFrom.processId, cellId, processId, cellData, onUpdateCellData);
        } else {
          // 같은 프로세스를 클릭한 경우 시작점 초기화
          setConnectingFrom(null);
        }
      } else {
        // 시작점이 없는 경우 - 시작점 설정
        setConnectingFrom({ cellId, processId });
      }
    }
  };

  const handleCancelConnection = () => {
    // 상단에서 글로벌 연결 상태 관리
    if (globalConnecting) {
      onToggleGlobalConnection && onToggleGlobalConnection();
    }
    setConnectingFrom(null);
  };

  return {
    connectingFrom,
    handleStartConnection,
    handleStartGlobalConnection,
    handleEndConnection,
    handleCancelConnection
  };
};
