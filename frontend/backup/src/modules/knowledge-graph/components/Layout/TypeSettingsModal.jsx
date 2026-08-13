import React, { useState, useEffect, useMemo } from 'react';
import { X, Settings } from 'lucide-react';
import './TypeSettingsModal.css';
import NodeTypesSection from './TypeSettings/NodeTypesSection';
import EdgeTypesSection from './TypeSettings/EdgeTypesSection';
import { DEFAULT_NODE_TYPES, DEFAULT_EDGE_TYPES, validateId } from './TypeSettings/typeUtils';

const TypeSettingsModal = ({ 
  isOpen, 
  onClose,
  initialNodeTypes = [],
  initialEdgeTypes = [],
  onSave,
  // 현재 사용 중인 타입들을 전달받기 위한 prop
  currentGraphData = { nodes: [], edges: [] },
  // 커스텀 모달 함수들 추가
  showError,
  askWarningConfirm
}) => {
  const [nodeTypes, setNodeTypes] = useState([]);
  const [edgeTypes, setEdgeTypes] = useState([]);
  const [newNodeType, setNewNodeType] = useState('');
  const [newEdgeType, setNewEdgeType] = useState('');
  const [editingNodeType, setEditingNodeType] = useState(null);
  const [editingEdgeType, setEditingEdgeType] = useState(null);
  const [errors, setErrors] = useState({});

  // 현재 그래프에서 사용 중인 타입들 계산
  const usedNodeTypes = useMemo(() => {
    const types = new Set();
    currentGraphData.nodes.forEach(node => {
      if (node.type) {
        types.add(node.type);
      }
    });
    return types;
  }, [currentGraphData.nodes]);

  const usedEdgeTypes = useMemo(() => {
    const types = new Set();
    currentGraphData.edges.forEach(edge => {
      if (edge.type) {
        types.add(edge.type);
      }
    });
    return types;
  }, [currentGraphData.edges]);

  // 타입별 사용 개수 계산
  const nodeTypeUsage = useMemo(() => {
    const usage = {};
    currentGraphData.nodes.forEach(node => {
      if (node.type) {
        usage[node.type] = (usage[node.type] || 0) + 1;
      }
    });
    return usage;
  }, [currentGraphData.nodes]);

  const edgeTypeUsage = useMemo(() => {
    const usage = {};
    currentGraphData.edges.forEach(edge => {
      if (edge.type) {
        usage[edge.type] = (usage[edge.type] || 0) + 1;
      }
    });
    return usage;
  }, [currentGraphData.edges]);

  // JSON.stringify를 사용해서 깊은 비교를 통해 의존성을 체크합니다
  const initialNodeTypesString = JSON.stringify(initialNodeTypes);
  const initialEdgeTypesString = JSON.stringify(initialEdgeTypes);

  useEffect(() => {
    if (isOpen) {
      setNodeTypes(initialNodeTypes.length > 0 ? [...initialNodeTypes] : [...DEFAULT_NODE_TYPES]);
      setEdgeTypes(initialEdgeTypes.length > 0 ? [...initialEdgeTypes] : [...DEFAULT_EDGE_TYPES]);
      setNewNodeType('');
      setNewEdgeType('');
      setEditingNodeType(null);
      setEditingEdgeType(null);
      setErrors({});
    }
  }, [isOpen, initialNodeTypesString, initialEdgeTypesString]);

  const handleDeleteNodeType = async (id) => {
    // "unknown" 타입은 삭제할 수 없음
    if (id === 'unknown') {
      if (showError) {
        await showError('"알 수 없음" 타입은 삭제할 수 없습니다.\n\n이 타입은 시스템에서 기본적으로 필요한 타입입니다.', '타입 삭제 불가');
      } else {
        alert('"알 수 없음" 타입은 삭제할 수 없습니다.');
      }
      return;
    }

    const usage = nodeTypeUsage[id] || 0;
    
    if (usage > 0) {
      const confirmMessage = `이 노드 타입 "${id}"은(는) 현재 ${usage}개의 노드에서 사용되고 있습니다.

삭제하면 해당 노드들이 "unknown" 타입으로 변경됩니다.

계속하시겠습니까?`;
      
      let confirmed;
      if (askWarningConfirm) {
        confirmed = await askWarningConfirm(confirmMessage, '노드 타입 삭제 확인');
      } else {
        confirmed = window.confirm(confirmMessage);
      }
      
      if (!confirmed) {
        return;
      }
    }
    
    setNodeTypes(prev => prev.filter(type => type.id !== id));
  };

  const handleDeleteEdgeType = async (id) => {
    // "unknown" 타입은 삭제할 수 없음
    if (id === 'unknown') {
      if (showError) {
        await showError('"알 수 없음" 타입은 삭제할 수 없습니다.\n\n이 타입은 시스템에서 기본적으로 필요한 타입입니다.', '타입 삭제 불가');
      } else {
        alert('"알 수 없음" 타입은 삭제할 수 없습니다.');
      }
      return;
    }

    const usage = edgeTypeUsage[id] || 0;
    
    if (usage > 0) {
      const confirmMessage = `이 엣지 타입 "${id}"은(는) 현재 ${usage}개의 관계에서 사용되고 있습니다.

삭제하면 해당 관계들이 "unknown" 타입으로 변경됩니다.

계속하시겠습니까?`;
      
      let confirmed;
      if (askWarningConfirm) {
        confirmed = await askWarningConfirm(confirmMessage, '엣지 타입 삭제 확인');
      } else {
        confirmed = window.confirm(confirmMessage);
      }
      
      if (!confirmed) {
        return;
      }
    }
    
    setEdgeTypes(prev => prev.filter(type => type.id !== id));
  };

  const handleSave = () => {
    // 삭제된 타입들에 대한 정리 작업 정보도 함께 전달
    const deletedNodeTypes = [];
    const deletedEdgeTypes = [];
    
    // 기존에 있었지만 현재 없는 타입들 찾기
    const currentNodeTypeIds = new Set(nodeTypes.map(t => t.id));
    const currentEdgeTypeIds = new Set(edgeTypes.map(t => t.id));
    
    if (initialNodeTypes.length > 0) {
      initialNodeTypes.forEach(type => {
        if (!currentNodeTypeIds.has(type.id)) {
          deletedNodeTypes.push(type.id);
        }
      });
    } else {
      DEFAULT_NODE_TYPES.forEach(type => {
        if (!currentNodeTypeIds.has(type.id)) {
          deletedNodeTypes.push(type.id);
        }
      });
    }
    
    if (initialEdgeTypes.length > 0) {
      initialEdgeTypes.forEach(type => {
        if (!currentEdgeTypeIds.has(type.id)) {
          deletedEdgeTypes.push(type.id);
        }
      });
    } else {
      DEFAULT_EDGE_TYPES.forEach(type => {
        if (!currentEdgeTypeIds.has(type.id)) {
          deletedEdgeTypes.push(type.id);
        }
      });
    }

    onSave({
      nodeTypes,
      edgeTypes,
      deletedNodeTypes,
      deletedEdgeTypes
    });
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="type-settings-modal-overlay" onClick={onClose}>
      <div 
        className="type-settings-modal" 
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="modal-header">
          <h2>
            <Settings size={24} strokeWidth={2} />
            Type Settings
          </h2>
          <button 
            className="modal-close-btn"
            onClick={onClose}
            type="button"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>
        
        <div className="modal-body">
          <NodeTypesSection
            nodeTypes={nodeTypes}
            setNodeTypes={setNodeTypes}
            newNodeType={newNodeType}
            setNewNodeType={setNewNodeType}
            editingNodeType={editingNodeType}
            setEditingNodeType={setEditingNodeType}
            errors={errors}
            setErrors={setErrors}
            nodeTypeUsage={nodeTypeUsage}
            validateId={validateId}
            handleDeleteNodeType={handleDeleteNodeType}
          />

          <EdgeTypesSection
            edgeTypes={edgeTypes}
            setEdgeTypes={setEdgeTypes}
            newEdgeType={newEdgeType}
            setNewEdgeType={setNewEdgeType}
            editingEdgeType={editingEdgeType}
            setEditingEdgeType={setEditingEdgeType}
            errors={errors}
            setErrors={setErrors}
            edgeTypeUsage={edgeTypeUsage}
            validateId={validateId}
            handleDeleteEdgeType={handleDeleteEdgeType}
          />
        </div>

        <div className="modal-footer">
          <button 
            type="button" 
            className="btn-cancel"
            onClick={onClose}
          >
            Cancel
          </button>
          <button 
            type="button" 
            className="btn-save"
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default TypeSettingsModal;