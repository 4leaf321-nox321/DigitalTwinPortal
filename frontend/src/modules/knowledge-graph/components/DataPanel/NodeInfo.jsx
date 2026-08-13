import React, { useState, useEffect } from 'react';
import { Edit2, Save, X, Trash2, Tag, Hash } from 'lucide-react';
import { getNodeColorByType } from '@/utils/colorUtils';
import PropertyModal from './PropertyModal';

// 노드 타입을 한글로 변환하는 함수
const getNodeTypeDisplayName = (type) => {
  const typeNames = {
    'person': '사람',
    'company': '회사',
    'project': '프로젝트',
    'skill': '기술',
    'department': '부서',
    'technology': '기술',
    'team': '팀',
    'product': '제품',
    'service': '서비스',
    'location': '위치',
    'default': '기본',
    'unknown': '알 수 없음'
  };
  return typeNames[type] || type;
};

const NodeInfo = ({ 
  node, 
  onUpdate, 
  onDelete, 
  graphData, 
  nodeTypes = [],
  // 모달 함수 추가
  askWarningConfirm
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedNode, setEditedNode] = useState(node);
  const [isPropertyModalOpen, setIsPropertyModalOpen] = useState(false);

  useEffect(() => {
    console.log('🔄 NodeInfo: node prop 변경됨', node);
    setEditedNode(node);
    setIsEditing(false);
  }, [node]);

  const handleSave = () => {
    console.log('💾 NodeInfo: 노드 저장 시작');
    console.log('원본 노드:', node);
    console.log('편집된 노드:', editedNode);
    
    // 타입이 변경되었으면 색상도 업데이트
    const updatedNode = {
      ...editedNode,
      color: getNodeColorByType(editedNode.type, nodeTypes)
    };
    
    console.log('업데이트할 노드:', updatedNode);
    console.log('새로운 색상:', updatedNode.color);
    console.log('onUpdate 함수 호출...');
    
    onUpdate(updatedNode);
    setIsEditing(false);
    
    console.log('✅ NodeInfo: 노드 저장 완료');
  };

  const handleCancel = () => {
    setEditedNode(node);
    setIsEditing(false);
  };

  const handlePropertyChange = (key, value) => {
    setEditedNode(prev => ({
      ...prev,
      properties: {
        ...prev.properties,
        [key]: value
      }
    }));
  };

  const handleAddProperty = (key, value) => {
    setEditedNode(prev => ({
      ...prev,
      properties: {
        ...prev.properties,
        [key]: value
      }
    }));
    // 속성을 추가한 후 편집 모드로 전환
    if (!isEditing) {
      setIsEditing(true);
    }
  };

  const handleDeleteProperty = (key) => {
    setEditedNode(prev => {
      const newProperties = { ...prev.properties };
      delete newProperties[key];
      return {
        ...prev,
        properties: newProperties
      };
    });
  };

  const getConnectedNodes = () => {
    const connections = graphData.edges
      .filter(edge => edge.from === node.id || edge.to === node.id)
      .map(edge => {
        const isOutgoing = edge.from === node.id;
        const connectedNodeId = isOutgoing ? edge.to : edge.from;
        const connectedNode = graphData.nodes.find(n => n.id === connectedNodeId);
        
        return {
          node: connectedNode,
          edge,
          direction: isOutgoing ? 'outgoing' : 'incoming'
        };
      });
    
    return connections;
  };

  const connections = getConnectedNodes();

  // 사용 가능한 노드 타입 목록 가져오기
  const availableNodeTypes = nodeTypes.length > 0 ? nodeTypes : [
    { id: 'person', label: '사람' },
    { id: 'company', label: '회사' },
    { id: 'project', label: '프로젝트' },
    { id: 'skill', label: '기술' },
    { id: 'department', label: '부서' },
    { id: 'technology', label: '기술' },
    { id: 'team', label: '팀' },
    { id: 'product', label: '제품' },
    { id: 'service', label: '서비스' },
    { id: 'location', label: '위치' },
    { id: 'default', label: '기본' },
    { id: 'unknown', label: '알 수 없음' }
  ];

  return (
    <div className="node-info">
      <div className="info-header">
        <div className="node-type-badge" style={{ 
          backgroundColor: isEditing ? 
            getNodeColorByType(editedNode.type, nodeTypes) : 
            (node.color || getNodeColorByType(node.type, nodeTypes))
        }}>
          <Tag size={14} strokeWidth={2} />
          {isEditing ? editedNode.type : node.type}
        </div>
        <div className="action-buttons">
          {!isEditing ? (
            <button 
              className="action-btn edit"
              onClick={() => setIsEditing(true)}
              title="편집"
            >
              <Edit2 size={16} strokeWidth={2} />
            </button>
          ) : (
            <>
              <button 
                className="action-btn save"
                onClick={handleSave}
                title="저장"
              >
                <Save size={16} strokeWidth={2} />
              </button>
              <button 
                className="action-btn cancel"
                onClick={handleCancel}
                title="취소"
              >
                <X size={16} strokeWidth={2} />
              </button>
            </>
          )}
          <button 
            className="action-btn delete"
            onClick={() => {
              if (askWarningConfirm) {
                askWarningConfirm(
                  `노드 "${node.label}"을(를) 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`,
                  '노드 삭제 확인'
                ).then((confirmed) => {
                  if (confirmed) {
                    onDelete();
                  }
                });
              }
            }}
            title="삭제"
          >
            <Trash2 size={16} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="info-content">
        {/* 기본 정보 */}
        <div className="info-section">
          <h4>기본 정보</h4>
          
          <div className="info-item">
            <label>ID:</label>
            <span className="value id-value">
              <Hash size={14} strokeWidth={2} />
              {node.id}
            </span>
          </div>
          
          <div className="info-item">
            <label>라벨:</label>
            {isEditing ? (
              <input
                type="text"
                value={editedNode.label}
                onChange={(e) => setEditedNode(prev => ({
                  ...prev,
                  label: e.target.value
                }))}
                className="edit-input"
              />
            ) : (
              <span className="value">{node.label}</span>
            )}
          </div>
          
          <div className="info-item">
            <label>타입:</label>
            {isEditing ? (
              <select
                value={editedNode.type}
                onChange={(e) => setEditedNode(prev => ({
                  ...prev,
                  type: e.target.value
                }))}
                className="edit-select"
              >
                {availableNodeTypes.map(type => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
              </select>
            ) : (
              <span className="value">{getNodeTypeDisplayName(node.type)}</span>
            )}
          </div>
        </div>

        {/* 속성 */}
        <div className="info-section">
          <div className="section-header">
            <h4>속성</h4>
            <button 
              className="add-property-btn"
              onClick={() => setIsPropertyModalOpen(true)}
              title="속성 추가"
            >
              + 추가
            </button>
          </div>
          
          <div className="properties">
            {editedNode.properties && Object.entries(editedNode.properties)
              .filter(([key, value]) => value !== undefined && value !== null)
              .map(([key, value]) => (
              <div key={key} className="property-item">
                <label>{key}:</label>
                <div className="property-value">
                  {isEditing ? (
                    <>
                      <input
                        type="text"
                        value={editedNode.properties[key] || ''}
                        onChange={(e) => handlePropertyChange(key, e.target.value)}
                        className="edit-input"
                      />
                      <button
                        className="delete-property-btn"
                        onClick={() => handleDeleteProperty(key)}
                        title="속성 삭제"
                      >
                        <X size={14} strokeWidth={2} />
                      </button>
                    </>
                  ) : (
                    <span className="value">{value}</span>
                  )}
                </div>
              </div>
            ))}
            
            {(!editedNode.properties || Object.entries(editedNode.properties)
              .filter(([key, value]) => value !== undefined && value !== null).length === 0) && (
              <div className="no-properties">
                속성이 없습니다
              </div>
            )}
          </div>
        </div>

        {/* 연결된 노드들 */}
        <div className="info-section">
          <h4>연결 ({connections.length})</h4>
          <div className="connections">
            {connections.map(({ node: connectedNode, edge, direction }, index) => (
              <div key={index} className="connection-item">
                <div className={`connection-direction ${direction}`}>
                  {direction === 'outgoing' ? '→' : '←'}
                </div>
                <div className="connection-info">
                  <div className="connection-node">
                    <span 
                      className="node-badge"
                      style={{ backgroundColor: connectedNode?.color || '#ccc' }}
                    >
                      {connectedNode?.label || 'Unknown'}
                    </span>
                    <span className="node-type">
                      ({connectedNode?.type || 'unknown'})
                    </span>
                  </div>
                  <div className="connection-edge">
                    <span className="edge-label">{edge.label}</span>
                    <span className="edge-type">({edge.type})</span>
                  </div>
                </div>
              </div>
            ))}
            
            {connections.length === 0 && (
              <div className="no-connections">
                연결된 노드가 없습니다
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* 속성 추가 모달 */}
      <PropertyModal
        isOpen={isPropertyModalOpen}
        onClose={() => setIsPropertyModalOpen(false)}
        onAddProperty={handleAddProperty}
        existingProperties={editedNode.properties || {}}
        title="노드 속성 추가"
      />
    </div>
  );
};

export default NodeInfo;