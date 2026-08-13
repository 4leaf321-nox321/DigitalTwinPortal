import React, { useState, useEffect } from 'react';
import { X, Plus, AlertCircle } from 'lucide-react';
import './PropertyModal.css';

const PropertyModal = ({ 
  isOpen, 
  onClose, 
  onAddProperty, 
  existingProperties = {},
  title = "새 속성 추가" 
}) => {
  const [propertyName, setPropertyName] = useState('');
  const [propertyValue, setPropertyValue] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPropertyName('');
      setPropertyValue('');
      setError('');
      // 모달이 열릴 때 첫 번째 입력창에 포커스
      setTimeout(() => {
        const input = document.querySelector('.property-modal .property-name-input');
        if (input) input.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!propertyName.trim()) {
      setError('속성 이름을 입력해주세요.');
      return;
    }
    
    if (propertyName.trim().toLowerCase() === 'id' || 
        propertyName.trim().toLowerCase() === 'label' || 
        propertyName.trim().toLowerCase() === 'type') {
      setError('예약된 속성 이름입니다.');
      return;
    }
    
    if (existingProperties.hasOwnProperty(propertyName.trim())) {
      setError('이미 존재하는 속성 이름입니다.');
      return;
    }
    
    if (propertyName.trim().length > 50) {
      setError('속성 이름이 너무 깁니다 (최대 50자).');
      return;
    }

    onAddProperty(propertyName.trim(), propertyValue);
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="property-modal-overlay" onClick={onClose}>
      <div 
        className="property-modal" 
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="modal-header">
          <h3>{title}</h3>
          <button 
            className="modal-close-btn"
            onClick={onClose}
            type="button"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="propertyName">속성 이름 *</label>
            <input
              id="propertyName"
              type="text"
              value={propertyName}
              onChange={(e) => {
                setPropertyName(e.target.value);
                setError(''); // 입력 시 에러 클리어
              }}
              className="property-name-input"
              placeholder="예: 나이, 직위, 설명 등"
              maxLength={50}
            />
            <small className="form-help">
              영문, 숫자, 한글, 언더스코어(_)를 사용할 수 있습니다.
            </small>
          </div>
          
          <div className="form-group">
            <label htmlFor="propertyValue">초기값 (선택사항)</label>
            <input
              id="propertyValue"
              type="text"
              value={propertyValue}
              onChange={(e) => setPropertyValue(e.target.value)}
              className="property-value-input"
              placeholder="속성의 초기값을 입력하세요"
            />
            <small className="form-help">
              나중에 편집할 수 있으니 비워두셔도 됩니다.
            </small>
          </div>

          {error && (
            <div className="error-message">
              <AlertCircle size={16} strokeWidth={2} />
              {error}
            </div>
          )}

          <div className="modal-actions">
            <button 
              type="button" 
              className="btn-cancel"
              onClick={onClose}
            >
              취소
            </button>
            <button 
              type="submit" 
              className="btn-submit"
            >
              <Plus size={16} strokeWidth={2} />
              속성 추가
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PropertyModal;