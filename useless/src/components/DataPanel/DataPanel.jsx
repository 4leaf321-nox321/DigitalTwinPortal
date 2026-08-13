import React, { useState } from 'react';
import NodeInfo from './NodeInfo';
import EdgeInfo from './EdgeInfo';
import { X, Info, BarChart3, XCircle } from 'lucide-react';
import './DataPanel.css';

const DataPanel = ({
  selectedNode,
  selectedEdge,
  graphData,
  onNodeUpdate,
  onEdgeUpdate,
  onNodeDelete,
  onEdgeDelete,
  onClearSelection,
  nodeTypes = [],
  edgeTypes = [], // edgeTypes prop 추가
  // 모달 함수들 추가
  askWarningConfirm
}) => {
  const [activeTab, setActiveTab] = useState('info');

  if (!selectedNode && !selectedEdge) {
    return (
      <div className="data-panel empty">
        <div className="panel-header">
          <h3>정보 패널</h3>
        </div>
        <div className="panel-content">
          <div className="empty-state">
            <Info size={48} className="empty-icon" />
            <p>노드나 엣지를 선택하여 상세 정보를 확인하세요</p>
          </div>
          <div className="graph-stats">
            <h4>그래프 통계</h4>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">총 노드</span>
                <span className="stat-value">{graphData?.nodes?.length || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">총 엣지</span>
                <span className="stat-value">{graphData?.edges?.length || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">노드 타입</span>
                <span className="stat-value">
                  {graphData?.nodes ? 
                    new Set(graphData.nodes.map(n => n.type)).size : 0}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">관계 타입</span>
                <span className="stat-value">
                  {graphData?.edges ? 
                    new Set(graphData.edges.map(e => e.type)).size : 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const selectedItem = selectedNode ? 
    graphData.nodes.find(n => n.id === selectedNode) :
    graphData.edges.find(e => e.id === selectedEdge);

  return (
    <div className="data-panel">
      <div className="panel-header">
        <div className="panel-tabs">
          <button 
            className={`tab-btn ${activeTab === 'info' ? 'active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            <Info size={16} />
            정보
          </button>
          <button 
            className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            <BarChart3 size={16} />
            통계
          </button>
        </div>
        <button 
          className="close-btn"
          onClick={onClearSelection}
          title="선택 해제"
        >
          <XCircle size={20} strokeWidth={2} />
          <span className="close-btn-text">선택 해제</span>
        </button>
      </div>

      <div className="panel-content">
        {activeTab === 'info' && (
          <>
            {selectedNode && (
              <NodeInfo
                node={selectedItem}
                onUpdate={(updates) => onNodeUpdate(selectedNode, updates)}
                onDelete={() => onNodeDelete(selectedNode)}
                graphData={graphData}
                nodeTypes={nodeTypes}
                askWarningConfirm={askWarningConfirm}
              />
            )}
            
            {selectedEdge && (
              <EdgeInfo
                edge={selectedItem}
                onUpdate={(updates) => onEdgeUpdate(selectedEdge, updates)}
                onDelete={() => onEdgeDelete(selectedEdge)}
                graphData={graphData}
                edgeTypes={edgeTypes}
                askWarningConfirm={askWarningConfirm}
              />
            )}
          </>
        )}

        {activeTab === 'stats' && (
          <div className="stats-content">
            <h4>연결 통계</h4>
            {selectedNode && (
              <NodeStatistics 
                nodeId={selectedNode} 
                graphData={graphData} 
              />
            )}
            {selectedEdge && (
              <EdgeStatistics 
                edgeId={selectedEdge} 
                graphData={graphData} 
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const NodeStatistics = ({ nodeId, graphData }) => {
  const connectedEdges = graphData.edges.filter(
    edge => edge.from === nodeId || edge.to === nodeId
  );
  
  const incomingEdges = graphData.edges.filter(edge => edge.to === nodeId);
  const outgoingEdges = graphData.edges.filter(edge => edge.from === nodeId);
  
  const connectedNodes = new Set();
  connectedEdges.forEach(edge => {
    if (edge.from === nodeId) connectedNodes.add(edge.to);
    if (edge.to === nodeId) connectedNodes.add(edge.from);
  });

  const edgeTypes = {};
  connectedEdges.forEach(edge => {
    edgeTypes[edge.type] = (edgeTypes[edge.type] || 0) + 1;
  });

  return (
    <div className="node-stats">
      <div className="stats-grid">
        <div className="stat-item">
          <span className="stat-label">총 연결</span>
          <span className="stat-value">{connectedEdges.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">들어오는 연결</span>
          <span className="stat-value">{incomingEdges.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">나가는 연결</span>
          <span className="stat-value">{outgoingEdges.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">연결된 노드</span>
          <span className="stat-value">{connectedNodes.size}</span>
        </div>
      </div>

      <div className="edge-types">
        <h5>관계 유형별 분포</h5>
        {Object.entries(edgeTypes).map(([type, count]) => (
          <div key={type} className="type-item">
            <span className="type-label">{type}</span>
            <span className="type-count">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const EdgeStatistics = ({ edgeId, graphData }) => {
  const edge = graphData.edges.find(e => e.id === edgeId);
  const fromNode = graphData.nodes.find(n => n.id === edge.from);
  const toNode = graphData.nodes.find(n => n.id === edge.to);

  return (
    <div className="edge-stats">
      <div className="connection-info">
        <h5>연결 정보</h5>
        <div className="connection-detail">
          <div className="node-ref">
            <span className="node-label">시작:</span>
            <span className="node-name">{fromNode?.label || edge.from}</span>
            <span className="node-type">({fromNode?.type})</span>
          </div>
          <div className="arrow">→</div>
          <div className="node-ref">
            <span className="node-label">끝:</span>
            <span className="node-name">{toNode?.label || edge.to}</span>
            <span className="node-type">({toNode?.type})</span>
          </div>
        </div>
      </div>

      <div className="edge-properties">
        <h5>관계 속성</h5>
        <div className="property-item">
          <span className="prop-label">관계 유형:</span>
          <span className="prop-value">{edge.type}</span>
        </div>
        <div className="property-item">
          <span className="prop-label">방향성:</span>
          <span className="prop-value">방향 있음</span>
        </div>
      </div>
    </div>
  );
};

export default DataPanel;