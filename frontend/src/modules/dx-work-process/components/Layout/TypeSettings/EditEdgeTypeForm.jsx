import React, { useState } from 'react';

// 기본 엣지 색상
const DEFAULT_EDGE_COLOR = '#666666';

const EditEdgeTypeForm = ({ type, onSave, onCancel, error }) => {
  const [editData, setEditData] = useState({
    id: type.id,
    label: type.label,
    defaultEdgeLabel: type.defaultEdgeLabel || type.label,
    color: type.color || DEFAULT_EDGE_COLOR
  });

  const handleSave = () => {
    onSave(editData);
  };

  return (
    <div className="edit-form-wrapper">
      <div className="edit-form">
        <div className="edit-inputs">
          <div className="input-group">
            <label className="input-label">ID (타입 식별자)</label>
            <input
              type="text"
              value={editData.id}
              onChange={(e) => setEditData(prev => ({ ...prev, id: e.target.value }))}
              placeholder="예: belongs_to"
              className={`edit-input ${error ? 'error' : ''}`}
            />
          </div>
          <div className="input-group">
            <label className="input-label">타입 표시명</label>
            <input
              type="text"
              value={editData.label}
              onChange={(e) => setEditData(prev => ({ ...prev, label: e.target.value }))}
              placeholder="예: 소속 관계"
              className="edit-input"
            />
          </div>
          <div className="input-group">
            <label className="input-label">기본 엣지 레이블</label>
            <input
              type="text"
              value={editData.defaultEdgeLabel}
              onChange={(e) => setEditData(prev => ({ ...prev, defaultEdgeLabel: e.target.value }))}
              placeholder="예: 소속"
              className="edit-input"
            />
          </div>
          <div className="input-group">
            <label className="input-label">색상</label>
            <div className="color-input-wrapper">
              <input
                type="color"
                value={editData.color}
                onChange={(e) => setEditData(prev => ({ ...prev, color: e.target.value }))}
                className="edit-color-input"
              />
              <span className="color-hex">{editData.color}</span>
            </div>
          </div>
        </div>
        <div className="edit-actions">
          <button onClick={handleSave} className="save-btn" title="Save">
            ✓
          </button>
          <button onClick={onCancel} className="cancel-btn" title="Cancel">
            ×
          </button>
        </div>
      </div>
      {error && <div className="error-message">{error}</div>}
    </div>
  );
};

export default EditEdgeTypeForm;