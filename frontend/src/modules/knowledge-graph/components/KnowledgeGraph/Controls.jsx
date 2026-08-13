import React from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize, 
  Plus, 
  GitBranch, 
  RotateCcw,
  RefreshCw,
  Database,
  Link
} from 'lucide-react';

const Controls = ({
  onFitToView,
  onZoomIn,
  onZoomOut,
  onTogglePhysics,
  onReapplyLayout,
  isAddingNode,
  isAddingEdge,
  onToggleAddNode,
  onToggleAddEdge,
  sourceNodeForEdge,
  currentLayout,
  isFitActive = false,
  onShowBulkModal,
  onShowBulkEdgeModal
}) => {
  return (
    <div className="graph-controls">
      {/* 줌 컨트롤 */}
      <div className="control-group">
        <button 
          className="control-btn" 
          onClick={onZoomIn}
          title="확대"
          aria-label="확대"
        >
          <ZoomIn size={18} strokeWidth={2} />
        </button>
        
        <button 
          className="control-btn" 
          onClick={onZoomOut}
          title="축소"
          aria-label="축소"
        >
          <ZoomOut size={18} strokeWidth={2} />
        </button>
        
        <button 
          className={`control-btn ${isFitActive ? 'fit-active' : ''}`}
          onClick={onFitToView}
          title="전체 보기 (단축키: f)"
          aria-label="전체 보기"
        >
          <Maximize size={18} strokeWidth={2} />
        </button>
      </div>

      {/* 편집 컨트롤 */}
      <div className="control-group">
        <button 
          className={`control-btn ${isAddingNode ? 'active' : ''}`}
          onClick={onToggleAddNode}
          title="노드 추가 모드 (빈 공간을 더블클릭하여 노드 추가)"
          aria-label="노드 추가 모드"
        >
          <Plus size={18} strokeWidth={2} />
        </button>

        <button 
          className="control-btn"
          onClick={onShowBulkModal}
          title="일괄 노드 추가 (여러 노드를 한번에 추가)"
          aria-label="일괄 노드 추가"
        >
          <Database size={18} strokeWidth={2} />
        </button>
        
        <button 
          className={`control-btn ${isAddingEdge ? 'active' : ''}`}
          onClick={onToggleAddEdge}
          title="엣지 추가"
          aria-label="엣지 추가"
        >
          <GitBranch size={18} strokeWidth={2} />
        </button>

        <button 
          className="control-btn"
          onClick={onShowBulkEdgeModal}
          title="일괄 엣지 추가 (여러 엣지를 한번에 추가)"
          aria-label="일괄 엣지 추가"
        >
          <Link size={18} strokeWidth={2} />
        </button>
      </div>

      {/* 레이아웃 컨트롤 */}
      <div className="control-group">
        <button 
          className="control-btn"
          onClick={onTogglePhysics}
          title="물리 시뮬레이션 토글"
          aria-label="물리 시뮬레이션 토글"
        >
          <RotateCcw size={18} strokeWidth={2} />
        </button>

        <button 
          className="control-btn"
          onClick={onReapplyLayout}
          title="레이아웃 재적용"
          aria-label="레이아웃 재적용"
        >
          <RefreshCw size={18} strokeWidth={2} />
        </button>
      </div>

      {/* 현재 레이아웃 표시 */}
      {currentLayout && (
        <div className="layout-indicator">
          <span>{getLayoutDisplayName(currentLayout)}</span>
        </div>
      )}

      {/* 엣지 추가 상태 표시 */}
      {isAddingEdge && sourceNodeForEdge && (
        <div className="edge-status">
          <span>시작: {sourceNodeForEdge}</span>
        </div>
      )}
    </div>
  );
};

const getLayoutDisplayName = (layoutType) => {
  const layoutNames = {
    'force-directed': '힘 기반',
    'circular': '원형',
    'grid': '그리드'
  };
  
  return layoutNames[layoutType] || layoutType;
};

export default Controls;