import React from 'react';
import Modal from './Modal';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import './ConfirmModal.css';

const ConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm,
  title, 
  message, 
  type = 'question', // 'warning', 'question'
  confirmText = '확인',
  cancelText = '취소',
  destructive = false // 위험한 작업인지 (빨간색 버튼)
}) => {
  const getIcon = () => {
    switch (type) {
      case 'warning':
        return <AlertTriangle size={24} className="confirm-icon warning" />;
      default:
        return <HelpCircle size={24} className="confirm-icon question" />;
    }
  };

  const getTypeClass = () => {
    return `confirm-modal ${type}`;
  };

  const handleConfirm = () => {
    onConfirm(true);
    onClose();
  };

  const handleCancel = () => {
    onConfirm(false);
    onClose();
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleCancel}
      className={getTypeClass()}
      maxWidth="400px"
      closeOnBackdropClick={false}
      showCloseButton={false}
    >
      <div className="confirm-modal-content">
        <div className="confirm-header">
          {getIcon()}
          {title && <h3 className="confirm-title">{title}</h3>}
        </div>
        
        <div className="confirm-message">
          {typeof message === 'string' ? (
            <p>{message}</p>
          ) : (
            message
          )}
        </div>
        
        <div className="confirm-actions">
          <button 
            className="confirm-cancel-btn"
            onClick={handleCancel}
          >
            {cancelText}
          </button>
          <button 
            className={`confirm-confirm-btn ${destructive ? 'destructive' : ''}`}
            onClick={handleConfirm}
            autoFocus
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmModal;