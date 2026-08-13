import React, { useState } from 'react';
import { Plus, Download } from 'lucide-react';
import EditEdgeTypeForm from './EditEdgeTypeForm';
import BulkAddModal from './BulkAddModal';

// 기본 엣지 색상 팔레트
const DEFAULT_EDGE_COLORS = [
  '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#e74c3c',
  '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b'
];

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
  const [newEdgeTypeLabel, setNewEdgeTypeLabel] = useState('');
  const [newEdgeTypeDefaultLabel, setNewEdgeTypeDefaultLabel] = useState('');
  const [newEdgeTypeColor, setNewEdgeTypeColor] = useState('#666666');

  // 다음 기본 색상 가져오기
  const getNextDefaultColor = () => {
    const usedColors = edgeTypes.map(t => t.color).filter(Boolean);
    const availableColor = DEFAULT_EDGE_COLORS.find(c => !usedColors.includes(c));
    return availableColor || '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
  };

  const handleAddEdgeType = () => {
    const error = validateId(newEdgeType, edgeTypes);
    if (error) {
      setErrors(prev => ({ ...prev, newEdgeType: error }));
      return;
    }

    const typeLabel = newEdgeTypeLabel.trim() || newEdgeType.trim();
    const newType = {
      id: newEdgeType.trim(),
      label: typeLabel,
      defaultEdgeLabel: newEdgeTypeDefaultLabel.trim() || typeLabel,
      color: newEdgeTypeColor || getNextDefaultColor()
    };

    setEdgeTypes(prev => [...prev, newType]);
    setNewEdgeType('');
    setNewEdgeTypeLabel('');
    setNewEdgeTypeDefaultLabel('');
    setNewEdgeTypeColor(getNextDefaultColor());
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
      <div className="add-type-description">
        <small>
          • ID: 타입 식별자 (예: belongs_to)<br/>
          • 타입 표시명: 설정에서 보이는 이름 (예: 소속 관계)<br/>
          • 기본 레이블: 뷰포트에 표시될 텍스트 (예: 소속)
        </small>
      </div>
      <div className="section-actions">
        <div className="add-type-form edge-add-form">
          <input
            type="text"
            value={newEdgeType}
            onChange={(e) => {
              setNewEdgeType(e.target.value);
              if (errors.newEdgeType) {
                setErrors(prev => ({ ...prev, newEdgeType: null }));
              }
            }}
            placeholder="ID (예: belongs_to)"
            className={`add-type-input ${errors.newEdgeType ? 'error' : ''}`}
            onKeyDown={(e) => e.key === 'Enter' && handleAddEdgeType()}
          />
          <input
            type="text"
            value={newEdgeTypeLabel}
            onChange={(e) => setNewEdgeTypeLabel(e.target.value)}
            placeholder="타입 표시명 (예: 소속 관계)"
            className="add-type-input"
            onKeyDown={(e) => e.key === 'Enter' && handleAddEdgeType()}
          />
          <input
            type="text"
            value={newEdgeTypeDefaultLabel}
            onChange={(e) => setNewEdgeTypeDefaultLabel(e.target.value)}
            placeholder="기본 레이블 (예: 소속)"
            className="add-type-input"
            onKeyDown={(e) => e.key === 'Enter' && handleAddEdgeType()}
          />
          <input
            type="color"
            value={newEdgeTypeColor}
            onChange={(e) => setNewEdgeTypeColor(e.target.value)}
            className="add-type-color-input"
            title="엣지 색상 선택"
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
              <div
                className="color-indicator edge-color-indicator"
                style={{ backgroundColor: type.color || '#666666' }}
                title={type.color || '#666666'}
              ></div>

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