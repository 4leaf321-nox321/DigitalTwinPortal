import React from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize, 
  Plus, 
  GitBranch, 
  RotateCcw,
  RefreshCw
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
  currentLayout
}) => {
  return (
    <div className="graph-controls">
      {/* 줌 컨트롤 */}
      <div className="control-group">
        <button 
          className="control-btn" 
          onClick={onZoomIn}
          title="확대"
        >
          <ZoomIn size={18} />
        </button>
        
        <button 
          className="control-btn" 
          onClick={onZoomOut}
          title="축소"
        >
          <ZoomOut size={18} />
        </button>
        
        <button 
          className="control-btn" 
          onClick={onFitToView}
          title="전체 보기"
        >
          <Maximize size={18} />
        </button>
      </div>

      {/* 편집 컨트롤 */}
      <div className="control-group">
        <button 
          className={`control-btn ${isAddingNode ? 'active' : ''}`}
          onClick={onToggleAddNode}
          title="노드 추가"
        >
          <Plus size={18} />
        </button>
        
        <button 
          className={`control-btn ${isAddingEdge ? 'active' : ''}`}
          onClick={onToggleAddEdge}
          title="엣지 추가"
        >
          <GitBranch size={18} />
        </button>
      </div>

      {/* 레이아웃 컨트롤 */}
      <div className="control-group">
        <button 
          className="control-btn"
          onClick={onTogglePhysics}
          title="물리 시뮬레이션 토글"
        >
          <RotateCcw size={18} />
        </button>

        <button 
          className="control-btn"
          onClick={onReapplyLayout}
          title="레이아웃 재적용"
        >
          <RefreshCw size={18} />
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