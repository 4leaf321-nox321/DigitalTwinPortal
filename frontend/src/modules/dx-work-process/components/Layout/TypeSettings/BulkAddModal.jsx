import React, { useState } from 'react';
import { Plus } from 'lucide-react';

const BulkAddModal = ({ 
  isOpen, 
  onClose, 
  onAdd, 
  type = 'node', // 'node' or 'edge'
  existingTypes = []
}) => {
  const [bulkInput, setBulkInput] = useState('');
  const [errors, setErrors] = useState([]);
  const [previewTypes, setPreviewTypes] = useState([]);

  const validateId = (id) => {
    if (!id.trim()) {
      return 'ID는 비워둘 수 없습니다';
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(id.trim())) {
      return 'ID는 영문자나 언더스코어로 시작해야 하며, 영문자, 숫자, 언더스코어만 포함할 수 있습니다';
    }
    if (existingTypes.some(existingType => existingType.id === id.trim())) {
      return 'ID가 이미 존재합니다';
    }
    return null;
  };

  const parseInput = (input) => {
    const lines = input.split('\n').filter(line => line.trim());
    const types = [];
    const validationErrors = [];

    // 중복 체크를 위한 Set
    const newIds = new Set();

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;

      let id, label, color;

      // 다양한 형식 지원
      // 1. "id:label:color" 형식
      // 2. "id:label" 형식  
      // 3. "id" 형식 (label은 id와 동일)
      if (trimmedLine.includes(':')) {
        const parts = trimmedLine.split(':').map(p => p.trim());
        id = parts[0];
        label = parts[1] || id;
        color = parts[2];
      } else {
        // 단순히 ID만 입력된 경우
        id = trimmedLine;
        label = id;
      }

      // ID 유효성 검사
      const validationError = validateId(id);
      if (validationError) {
        validationErrors.push(`${index + 1}번째 줄: ${validationError}`);
        return;
      }

      // 새로 추가할 타입들 간의 중복 체크
      if (newIds.has(id)) {
        validationErrors.push(`${index + 1}번째 줄: 중복된 ID "${id}"`);
        return;
      }
      newIds.add(id);

      // 색상이 지정되지 않은 경우 랜덤 색상 생성 (node type만)
      if (type === 'node' && !color) {
        color = '#' + Math.floor(Math.random() * 16777215).toString(16);
      }

      const newType = { id, label };
      if (type === 'node') {
        newType.color = color;
      }

      types.push(newType);
    });

    return { types, errors: validationErrors };
  };

  const handleInputChange = (e) => {
    const input = e.target.value;
    setBulkInput(input);

    if (input.trim()) {
      const { types, errors } = parseInput(input);
      setPreviewTypes(types);
      setErrors(errors);
    } else {
      setPreviewTypes([]);
      setErrors([]);
    }
  };

  const handleAdd = () => {
    if (errors.length > 0) {
      return;
    }

    if (previewTypes.length === 0) {
      setErrors(['최소 하나의 타입을 입력해주세요']);
      return;
    }

    onAdd(previewTypes);
    setBulkInput('');
    setPreviewTypes([]);
    setErrors([]);
    onClose();
  };

  const handleClose = () => {
    setBulkInput('');
    setPreviewTypes([]);
    setErrors([]);
    onClose();
  };

  if (!isOpen) return null;

  const placeholder = type === 'node'
    ? `노드 타입을 입력하세요 (한 줄에 하나씩):

예시:
organization
company:회사명
person:사람:red
team:팀명:#3498db

형식:
- id (레이블은 id와 동일)
- id:레이블
- id:레이블:색상 (노드 타입만 해당)`
    : `엣지 타입을 입력하세요 (한 줄에 하나씩):

예시:
manages
works_for:근무
collaborates_with:협업

형식:
- id (레이블은 id와 동일)
- id:레이블`;

  return (
    <div className="type-settings-modal-overlay" onClick={handleClose}>
      <div 
        className="type-settings-modal bulk-add-modal" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>
            <Plus size={20} strokeWidth={2} />
            {type === 'node' ? '노드' : '엣지'} 타입 일괄 추가
          </h3>
          <button
            className="modal-close-btn"
            onClick={handleClose}
            type="button"
          >
            ×
          </button>
        </div>
        
        <div className="modal-body">
          <div className="bulk-input-section">
            <textarea
              value={bulkInput}
              onChange={handleInputChange}
              placeholder={placeholder}
              className="bulk-input-textarea"
              rows={10}
            />
          </div>

          {errors.length > 0 && (
            <div className="error-section">
              <h4>오류:</h4>
              {errors.map((error, index) => (
                <div key={index} className="error-message">{error}</div>
              ))}
            </div>
          )}

          {previewTypes.length > 0 && (
            <div className="preview-section">
              <h4>미리보기 ({previewTypes.length}개 타입):</h4>
              <div className="preview-list">
                {previewTypes.map((previewType, index) => (
                  <div key={index} className="preview-item">
                    {type === 'node' && (
                      <div
                        className="color-indicator small"
                        style={{ backgroundColor: previewType.color }}
                      ></div>
                    )}
                    <span className="preview-id">{previewType.id}</span>
                    <span className="preview-label">{previewType.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn-cancel"
            onClick={handleClose}
          >
            취소
          </button>
          <button
            type="button"
            className="btn-save"
            onClick={handleAdd}
            disabled={errors.length > 0 || previewTypes.length === 0}
          >
            {previewTypes.length}개 타입 추가
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkAddModal;