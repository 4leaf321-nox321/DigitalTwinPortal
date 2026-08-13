import React, { useState } from 'react';
import { Plus, Download } from 'lucide-react';
import EditNodeTypeForm from './EditNodeTypeForm';
import BulkAddModal from './BulkAddModal';

const NodeTypesSection = ({
  nodeTypes,
  setNodeTypes,
  newNodeType,
  setNewNodeType,
  editingNodeType,
  setEditingNodeType,
  errors,
  setErrors,
  nodeTypeUsage,
  validateId,
  handleDeleteNodeType
}) => {
  const [showBulkAdd, setShowBulkAdd] = useState(false);

  const handleAddNodeType = () => {
    const error = validateId(newNodeType, nodeTypes);
    if (error) {
      setErrors(prev => ({ ...prev, newNodeType: error }));
      return;
    }

    const newType = {
      id: newNodeType.trim(),
      label: newNodeType.trim(),
      color: '#' + Math.floor(Math.random()*16777215).toString(16)
    };

    setNodeTypes(prev => [...prev, newType]);
    setNewNodeType('');
    setErrors(prev => ({ ...prev, newNodeType: null }));
  };

  const handleUpdateNodeType = (id, updates) => {
    if (updates.id && updates.id !== id) {
      const error = validateId(updates.id, nodeTypes, id);
      if (error) {
        setErrors(prev => ({ ...prev, [`editNodeType_${id}`]: error }));
        return;
      }
    }

    setNodeTypes(prev => prev.map(type => 
      type.id === id ? { ...type, ...updates } : type
    ));
    setEditingNodeType(null);
    setErrors(prev => ({ ...prev, [`editNodeType_${id}`]: null }));
  };

  const handleBulkAdd = (bulkTypes) => {
    setNodeTypes(prev => [...prev, ...bulkTypes]);
  };

  return (
    <div className="type-section">
      <h3>Node Types</h3>
      <div className="section-actions">
        <div className="add-type-form">
          <input
            type="text"
            value={newNodeType}
            onChange={(e) => {
              setNewNodeType(e.target.value);
              if (errors.newNodeType) {
                setErrors(prev => ({ ...prev, newNodeType: null }));
              }
            }}
            placeholder="New node type ID (e.g. organization)"
            className={`add-type-input ${errors.newNodeType ? 'error' : ''}`}
            onKeyDown={(e) => e.key === 'Enter' && handleAddNodeType()}
          />
          <button 
            onClick={handleAddNodeType}
            className="add-type-btn"
            type="button"
            title="Add single node type"
          >
            <Plus size={16} strokeWidth={2} />
            Add
          </button>
        </div>
        <button 
          onClick={() => setShowBulkAdd(true)}
          className="bulk-add-btn"
          type="button"
          title="Add multiple node types at once"
        >
          <Download size={16} strokeWidth={2} />
          Bulk Add
        </button>
      </div>

      {errors.newNodeType && (
        <div className="error-message">{errors.newNodeType}</div>
      )}
      
      <div className="type-list">
        {nodeTypes.map((type) => {
          const usage = nodeTypeUsage[type.id] || 0;
          const isUsed = usage > 0;
          
          return (
            <div key={type.id} className="type-item">
              <div 
                className="color-indicator"
                style={{ backgroundColor: type.color }}
              ></div>
              
              {editingNodeType === type.id ? (
                <EditNodeTypeForm
                  type={type}
                  onSave={(updates) => handleUpdateNodeType(type.id, updates)}
                  onCancel={() => setEditingNodeType(null)}
                  error={errors[`editNodeType_${type.id}`]}
                />
              ) : (
                <>
                  <div className="type-info">
                    <span className="type-id">{type.id}</span>
                    <span className="type-label">{type.label}</span>
                    {isUsed && (
                      <span className="usage-indicator" title={`${usage} nodes using this type`}>
                        ({usage} used)
                      </span>
                    )}
                  </div>
                  
                  <div className="type-actions">
                    <button 
                      onClick={() => setEditingNodeType(type.id)}
                      className="edit-btn node-edit-btn"
                      title="Edit"
                    >
                      ✎
                    </button>
                    <button 
                      onClick={() => handleDeleteNodeType(type.id)}
                      className={`delete-btn node-delete-btn ${isUsed ? 'used' : ''} ${type.id === 'unknown' ? 'disabled' : ''}`}
                      title={type.id === 'unknown' ? 'Cannot delete Unknown type' : (isUsed ? `Delete (${usage} nodes will be affected)` : "Delete")}
                      disabled={type.id === 'unknown'}
                    >
                      ✕
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <BulkAddModal
        isOpen={showBulkAdd}
        onClose={() => setShowBulkAdd(false)}
        onAdd={handleBulkAdd}
        type="node"
        existingTypes={nodeTypes}
      />
    </div>
  );
};

export default NodeTypesSection;