import React, { useState } from 'react';
import { Plus, Download } from 'lucide-react';
import EditEdgeTypeForm from './EditEdgeTypeForm';
import BulkAddModal from './BulkAddModal';

const EdgeTypesSection = ({
  edgeTypes,
  setEdgeTypes,
  newEdgeType,
  setNewEdgeType,
  editingEdgeType,
  setEditingEdgeType,
  errors,
  setErrors,
  edgeTypeUsage,
  validateId,
  handleDeleteEdgeType
}) => {
  const [showBulkAdd, setShowBulkAdd] = useState(false);

  const handleAddEdgeType = () => {
    const error = validateId(newEdgeType, edgeTypes);
    if (error) {
      setErrors(prev => ({ ...prev, newEdgeType: error }));
      return;
    }

    const newType = {
      id: newEdgeType.trim(),
      label: newEdgeType.trim()
    };

    setEdgeTypes(prev => [...prev, newType]);
    setNewEdgeType('');
    setErrors(prev => ({ ...prev, newEdgeType: null }));
  };

  const handleUpdateEdgeType = (id, updates) => {
    if (updates.id && updates.id !== id) {
      const error = validateId(updates.id, edgeTypes, id);
      if (error) {
        setErrors(prev => ({ ...prev, [`editEdgeType_${id}`]: error }));
        return;
      }
    }

    setEdgeTypes(prev => prev.map(type => 
      type.id === id ? { ...type, ...updates } : type
    ));
    setEditingEdgeType(null);
    setErrors(prev => ({ ...prev, [`editEdgeType_${id}`]: null }));
  };

  const handleBulkAdd = (bulkTypes) => {
    setEdgeTypes(prev => [...prev, ...bulkTypes]);
  };

  return (
    <div className="type-section">
      <h3>Edge Types</h3>
      <div className="section-actions">
        <div className="add-type-form">
          <input
            type="text"
            value={newEdgeType}
            onChange={(e) => {
              setNewEdgeType(e.target.value);
              if (errors.newEdgeType) {
                setErrors(prev => ({ ...prev, newEdgeType: null }));
              }
            }}
            placeholder="New edge type ID (e.g. manages)"
            className={`add-type-input ${errors.newEdgeType ? 'error' : ''}`}
            onKeyDown={(e) => e.key === 'Enter' && handleAddEdgeType()}
          />
          <button 
            onClick={handleAddEdgeType}
            className="add-type-btn"
            type="button"
            title="Add single edge type"
          >
            <Plus size={16} strokeWidth={2} />
            Add
          </button>
        </div>
        <button 
          onClick={() => setShowBulkAdd(true)}
          className="bulk-add-btn"
          type="button"
          title="Add multiple edge types at once"
        >
          <Download size={16} strokeWidth={2} />
          Bulk Add
        </button>
      </div>

      {errors.newEdgeType && (
        <div className="error-message">{errors.newEdgeType}</div>
      )}
      
      <div className="type-list">
        {edgeTypes.map((type) => {
          const usage = edgeTypeUsage[type.id] || 0;
          const isUsed = usage > 0;
          
          return (
            <div key={type.id} className="type-item edge-type">
              {editingEdgeType === type.id ? (
                <EditEdgeTypeForm
                  type={type}
                  onSave={(updates) => handleUpdateEdgeType(type.id, updates)}
                  onCancel={() => setEditingEdgeType(null)}
                  error={errors[`editEdgeType_${type.id}`]}
                />
              ) : (
                <>
                  <div className="type-info">
                    <span className="type-id">{type.id}</span>
                    <span className="type-label">{type.label}</span>
                    {isUsed && (
                      <span className="usage-indicator" title={`${usage} edges using this type`}>
                        ({usage} used)
                      </span>
                    )}
                  </div>
                  
                  <div className="type-actions">
                    <button 
                      onClick={() => setEditingEdgeType(type.id)}
                      className="edit-btn edge-edit-btn"
                      title="Edit"
                    >
                      ✎
                    </button>
                    <button 
                      onClick={() => handleDeleteEdgeType(type.id)}
                      className={`delete-btn edge-delete-btn ${isUsed ? 'used' : ''} ${type.id === 'unknown' ? 'disabled' : ''}`}
                      title={type.id === 'unknown' ? 'Cannot delete Unknown type' : (isUsed ? `Delete (${usage} edges will be affected)` : "Delete")}
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
        type="edge"
        existingTypes={edgeTypes}
      />
    </div>
  );
};

export default EdgeTypesSection;
