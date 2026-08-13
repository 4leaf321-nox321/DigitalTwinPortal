import React, { useState } from 'react';

const EditNodeTypeForm = ({ type, onSave, onCancel, error }) => {
  const [editData, setEditData] = useState({
    id: type.id,
    label: type.label,
    color: type.color
  });

  const handleSave = () => {
    onSave(editData);
  };

  return (
    <div className="edit-form">
      <div className="edit-inputs">
        <input
          type="text"
          value={editData.id}
          onChange={(e) => setEditData(prev => ({ ...prev, id: e.target.value }))}
          placeholder="ID"
          className={`edit-input ${error ? 'error' : ''}`}
        />
        <input
          type="text"
          value={editData.label}
          onChange={(e) => setEditData(prev => ({ ...prev, label: e.target.value }))}
          placeholder="Label"
          className="edit-input"
        />
        <input
          type="color"
          value={editData.color}
          onChange={(e) => setEditData(prev => ({ ...prev, color: e.target.value }))}
          className="edit-color-input"
        />
      </div>
      {error && <div className="error-message">{error}</div>}
      <div className="edit-actions">
        <button onClick={handleSave} className="save-btn" title="Save">
          ✓
        </button>
        <button onClick={onCancel} className="cancel-btn" title="Cancel">
          ×
        </button>
      </div>
    </div>
  );
};

export default EditNodeTypeForm;
