import React from 'react';

const StatusIndicators = ({
  selectedNodes,
  deleteSelectedNodes,
  isAddingNode,
  isAddingEdge,
  sourceNodeForEdge,
  selectedNode,
  selectedEdge,
  isBoxSelecting,
  isCtrlPressed,
  isShiftPressed,
  isModifierPressed
}) => {
  return (
    <>
      {/* 박스 선택 상태 표시 */}
      {isModifierPressed && !isBoxSelecting && (
        <div className="box-select-ready-indicator">
          드래그하여 여러 노드를 선택하세요 ({isCtrlPressed ? 'Ctrl' : 'Shift'} + 드래그)
        </div>
      )}

      {/* 박스 선택 진행 중 표시 */}
      {isBoxSelecting && (
        <div className="box-select-progress-indicator">
          마우스를 떼어 선택을 완료하세요
        </div>
      )}

      {/* 다중 선택 상태 표시 */}
      {selectedNodes.size > 1 && (
        <div className="multi-select-status">
          <div className="status-message">
            <strong>{selectedNodes.size}개 노드 선택됨</strong>
          </div>
          <button 
            className="delete-selected-btn"
            onClick={deleteSelectedNodes}
            title="선택된 노드들 삭제"
          >
            🗑️ 선택 삭제 ({selectedNodes.size}개)
          </button>
        </div>
      )}

      {/* 노드 추가 모드 상태 */}
      {isAddingNode && (
        <div className="status-indicator node-add-mode">
          <div className="status-message">
            <strong>노드 추가 모드</strong><br/>
            그래프의 빈 공간을 더블클릭하여 노드를 추가하세요<br/>
            <em>클릭할 때마다 노드가 계속 추가됩니다</em>
          </div>
          <div className="status-hint">
            (<kbd>ESC</kbd> 또는 <kbd>Enter</kbd> 키를 눌러 종료할 수 있습니다)
          </div>
        </div>
      )}
      
      {/* 엣지 추가 모드 상태 */}
      {isAddingEdge && (
        <div className="status-indicator">
          {!sourceNodeForEdge 
            ? '시작 노드를 클릭하세요' 
            : '끝 노드를 클릭하여 연결하세요'
          }
        </div>
      )}
      
      {/* 삭제 및 다중 선택 힌트 */}
      {!isAddingNode && !isAddingEdge && (
        <div className="control-hints">
          {selectedNodes.size > 0 ? (
            <div className="delete-hint selected-nodes">
              <kbd>Delete</kbd> 키를 눌러 선택된 <strong>{selectedNodes.size}개 노드</strong>를 삭제할 수 있습니다
            </div>
          ) : (selectedNode || selectedEdge) ? (
            <div className="delete-hint">
              <kbd>Delete</kbd> 키를 눌러 {selectedNode ? '노드' : '관계'}를 삭제할 수 있습니다
            </div>
          ) : null}
          
          <div className="multi-select-hint">
            <kbd>Ctrl</kbd>/<kbd>Shift</kbd> + 클릭으로 여러 노드 선택 | <kbd>Ctrl</kbd>/<kbd>Shift</kbd> + 드래그로 박스 선택 | <kbd>F</kbd> 전체 보기 | <kbd>Space</kbd> 물리 시뮬레이션 토글
          </div>
        </div>
      )}
    </>
  );
};

export default StatusIndicators;