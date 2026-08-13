import React from 'react';
import { X } from 'lucide-react';
import NodeInfo from '../DataPanel/NodeInfo';
import EdgeInfo from '../DataPanel/EdgeInfo';
import './EditModal.css';

const EditModal = ({
  isOpen,
  onClose,
  type, // 'node' | 'edge'
  data, // node or edge data
  graphData,
  nodeTypes,
  edgeTypes,
  onNodeUpdate,
  onNodeDelete,
  onEdgeUpdate,
  onEdgeDelete,
  askWarningConfirm
}) => {
  if (!isOpen || !data) return null;

  const handleClose = () => {
    onClose();
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  return (
    <div className="edit-modal-overlay" onClick={handleOverlayClick}>
      <div className="edit-modal">
        <div className="edit-modal-header">
          <h3>{type === 'node' ? '노드 편집' : '관계 편집'}</h3>
          <button className="edit-modal-close" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>
        <div className="edit-modal-body">
          {type === 'node' && (
            <NodeInfo
              node={data}
              onUpdate={(updatedNode) => {
                onNodeUpdate(updatedNode);
              }}
              onDelete={() => {
                onNodeDelete();
                handleClose();
              }}
              graphData={graphData}
              nodeTypes={nodeTypes}
              askWarningConfirm={askWarningConfirm}
            />
          )}
          {type === 'edge' && (
            <EdgeInfo
              edge={data}
              onUpdate={(updatedEdge) => {
                onEdgeUpdate(updatedEdge);
              }}
              onDelete={() => {
                onEdgeDelete();
                handleClose();
              }}
              graphData={graphData}
              edgeTypes={edgeTypes}
              askWarningConfirm={askWarningConfirm}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default EditModal;
