import React, { useState, useEffect } from 'react';
import { Edit2, Save, X, Trash2, ArrowRight, Hash } from 'lucide-react';
import PropertyModal from './PropertyModal';

// 엣지 타입을 한글로 변환하는 함수 (기본값)
const getEdgeTypeDisplayName = (type, edgeTypes = []) => {
  // edgeTypes에서 해당 타입 찾기
  const edgeType = edgeTypes.find(t => t.id === type);
  if (edgeType) {
    return edgeType.label;
  }
  
  // 기본 타입 이름들 (fallback)
  const typeNames = {
    'works_for': '근무',
    'participates_in': '참여',
    'has_skill': '보유',
    'belongs_to': '소속',
    'uses_technology': '사용',
    'utilizes': '활용',
    'part_of': '부분',
    'collaborates_with': '협업',
    'default': '기본',
    'unknown': '알 수 없음'
  };
  return typeNames[type] || type;
};

const EdgeInfo = ({ 
  edge, 
  onUpdate, 
  onDelete, 
  graphData, 
  edgeTypes = [], // edgeTypes prop 추가
  // 모달 함수 추가
  askWarningConfirm
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedEdge, setEditedEdge] = useState(edge);
  const [isPropertyModalOpen, setIsPropertyModalOpen] = useState(false);

  useEffect(() => {
    setEditedEdge(edge);
    setIsEditing(false);
  }, [edge]);

  const handleSave = () => {
    onUpdate(editedEdge);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedEdge(edge);
    setIsEditing(false);
  };

  const handlePropertyChange = (key, value) => {
    setEditedEdge(prev => ({
      ...prev,
      properties: {
        ...prev.properties,
        [key]: value
      }
    }));
  };

  const handleAddProperty = (key, value) => {
    setEditedEdge(prev => ({
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
    setEditedEdge(prev => {
      const newProperties = { ...prev.properties };
      delete newProperties[key];
      return {
        ...prev,
        properties: newProperties
      };
    });
  };

  const fromNode = graphData.nodes.find(n => n.id === edge.from);
  const toNode = graphData.nodes.find(n => n.id === edge.to);

  // 기본 엣지 타입들 (edgeTypes가 비어있을 경우 fallback)
  const defaultEdgeTypes = [
    { id: 'works_for', label: '근무' },
    { id: 'participates_in', label: '참여' },
    { id: 'has_skill', label: '보유' },
    { id: 'belongs_to', label: '소속' },
    { id: 'uses_technology', label: '사용' },
    { id: 'utilizes', label: '활용' },
    { id: 'part_of', label: '부분' },
    { id: 'collaborates_with', label: '협업' },
    { id: 'unknown', label: '알 수 없음' }
  ];

  const availableEdgeTypes = edgeTypes.length > 0 ? edgeTypes : defaultEdgeTypes;

  // 현재 엣지의 타입이 목록에 없으면 추가
  const currentEdgeType = isEditing ? editedEdge.type : edge.type;
  const typeExists = availableEdgeTypes.some(t => t.id === currentEdgeType);
  if (!typeExists && currentEdgeType) {
    availableEdgeTypes.push({
      id: currentEdgeType,
      label: getEdgeTypeDisplayName(currentEdgeType, edgeTypes)
    });
  }

  return (
    <div className="edge-info">
      <div className="info-header">
        <div className="edge-type-badge">
          <ArrowRight size={14} strokeWidth={2} />
          {getEdgeTypeDisplayName(edge.type, edgeTypes)}
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
                const edgeLabel = edge.label || edge.type || '엣지';
                askWarningConfirm(
                  `관계 "${edgeLabel}"을(를) 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`,
                  '관계 삭제 확인'
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
              {edge.id}
            </span>
          </div>
          
          <div className="info-item">
            <label>레이블:</label>
            {isEditing ? (
              <input
                type="text"
                value={editedEdge.label || ''}
                onChange={(e) => setEditedEdge(prev => ({
                  ...prev,
                  label: e.target.value
                }))}
                className="edit-input"
                placeholder="관계 레이블"
              />
            ) : (
              <span className="value">{edge.label || '레이블 없음'}</span>
            )}
          </div>
          
          <div className="info-item">
            <label>타입:</label>
            {isEditing ? (
              <select
                value={editedEdge.type}
                onChange={(e) => {
                  const selectedType = e.target.value;
                  const selectedEdgeType = availableEdgeTypes.find(t => t.id === selectedType);
                  setEditedEdge(prev => ({
                    ...prev,
                    type: selectedType,
                    // defaultEdgeLabel이 있으면 사용, 없으면 타입 label 사용
                    label: selectedEdgeType?.defaultEdgeLabel || selectedEdgeType?.label || selectedType
                  }));
                }}
                className="edit-select"
              >
                {availableEdgeTypes.map(edgeType => (
                  <option key={edgeType.id} value={edgeType.id}>
                    {edgeType.label}
                  </option>
                ))}
              </select>
            ) : (
              <span className="value">{getEdgeTypeDisplayName(edge.type, edgeTypes)}</span>
            )}
          </div>
        </div>

        {/* 연결 정보 */}
        <div className="info-section">
          <h4>연결 정보</h4>
          
          <div className="connection-flow">
            <div className="connection-node from-node">
              <div className="node-info">
                <span 
                  className="node-badge"
                  style={{ backgroundColor: fromNode?.color || '#ccc' }}
                >
                  {fromNode?.label || 'Unknown'}
                </span>
                <span className="node-type">({fromNode?.type || 'unknown'})</span>
                <span className="node-id">#{edge.from}</span>
              </div>
            </div>
            
            <div className="connection-arrow">
              <ArrowRight size={20} strokeWidth={2} />
            </div>
            
            <div className="connection-node to-node">
              <div className="node-info">
                <span 
                  className="node-badge"
                  style={{ backgroundColor: toNode?.color || '#ccc' }}
                >
                  {toNode?.label || 'Unknown'}
                </span>
                <span className="node-type">({toNode?.type || 'unknown'})</span>
                <span className="node-id">#{edge.to}</span>
              </div>
            </div>
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
            {editedEdge.properties && Object.entries(editedEdge.properties)
              .filter(([key, value]) => value !== undefined && value !== null)
              .map(([key, value]) => (
              <div key={key} className="property-item">
                <label>{key}:</label>
                <div className="property-value">
                  {isEditing ? (
                    <>
                      <input
                        type="text"
                        value={editedEdge.properties[key] || ''}
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
            
            {(!editedEdge.properties || Object.entries(editedEdge.properties)
              .filter(([key, value]) => value !== undefined && value !== null).length === 0) && (
              <div className="no-properties">
                속성이 없습니다
              </div>
            )}
          </div>
        </div>

        {/* 스타일 정보 */}
        <div className="info-section">
          <h4>스타일</h4>
          
          <div className="style-info">
            <div className="style-item">
              <label>색상:</label>
              <div className="color-display">
                <div 
                  className="color-swatch"
                  style={{ backgroundColor: edge.color }}
                ></div>
                <span className="color-value">{edge.color}</span>
              </div>
            </div>
            
            <div className="style-item">
              <label>두께:</label>
              <span className="value">{edge.width}px</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* 속성 추가 모달 */}
      <PropertyModal
        isOpen={isPropertyModalOpen}
        onClose={() => setIsPropertyModalOpen(false)}
        onAddProperty={handleAddProperty}
        existingProperties={editedEdge.properties || {}}
        title="엣지 속성 추가"
      />
    </div>
  );
};

export default EdgeInfo;