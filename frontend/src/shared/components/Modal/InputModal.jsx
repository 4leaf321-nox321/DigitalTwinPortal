import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import './InputModal.css';

const InputModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = '입력', 
  message = '값을 입력하세요:', 
  placeholder = '',
  initialValue = '',
  confirmText = '확인',
  cancelText = '취소',
  maxLength = 100,
  required = true
}) => {
  const [inputValue, setInputValue] = useState(initialValue);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  // 모달이 열릴 때마다 초기값 설정 및 포커스
  useEffect(() => {
    if (isOpen) {
      setInputValue(initialValue);
      setError('');
      // 약간의 지연을 두고 포커스 설정 (모달 애니메이션 완료 후)
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select(); // 기존 텍스트가 있으면 선택
        }
      }, 100);
    }
  }, [isOpen, initialValue]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);
    
    // 실시간 유효성 검사
    if (required && value.trim() === '') {
      setError('값을 입력해주세요.');
    } else if (value.length > maxLength) {
      setError(`최대 ${maxLength}자까지 입력 가능합니다.`);
    } else {
      setError('');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const trimmedValue = inputValue.trim();
    
    // 유효성 검사
    if (required && trimmedValue === '') {
      setError('값을 입력해주세요.');
      return;
    }
    
    if (trimmedValue.length > maxLength) {
      setError(`최대 ${maxLength}자까지 입력 가능합니다.`);
      return;
    }
    
    onConfirm(trimmedValue);
    handleClose();
  };

  const handleClose = () => {
    setInputValue('');
    setError('');
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
    }
  };

  const isValid = !error && (!required || inputValue.trim() !== '');

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="small">
      <div className="input-modal">
        <div className="input-modal-header">
          <h3>{title}</h3>
        </div>
        
        <div className="input-modal-body">
          <form onSubmit={handleSubmit}>
            {message && (
              <p className="input-modal-message">{message}</p>
            )}
            
            <div className="input-group">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                maxLength={maxLength + 10} // 약간의 여유를 두어 타이핑 경험 개선
                className={`input-field ${error ? 'error' : ''}`}
                autoComplete="off"
              />
              
              <div className="input-info">
                <span className={`char-count ${inputValue.length > maxLength ? 'over-limit' : ''}`}>
                  {inputValue.length}/{maxLength}
                </span>
              </div>
              
              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}
            </div>
          </form>
        </div>
        
        <div className="input-modal-footer">
          <button
            type="button"
            onClick={handleClose}
            className="btn btn-secondary"
          >
            {cancelText}
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            className={`btn btn-primary ${!isValid ? 'disabled' : ''}`}
            disabled={!isValid}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default InputModal;
