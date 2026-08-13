import React from 'react';
import Modal from './Modal';
import { CheckCircle, AlertCircle, XCircle, Info } from 'lucide-react';
import './AlertModal.css';

const AlertModal = ({ 
  isOpen, 
  onClose, 
  title, 
  message, 
  type = 'info', // 'success', 'warning', 'error', 'info'
  confirmText = '확인'
}) => {
  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle size={24} className="alert-icon success" />;
      case 'warning':
        return <AlertCircle size={24} className="alert-icon warning" />;
      case 'error':
        return <XCircle size={24} className="alert-icon error" />;
      default:
        return <Info size={24} className="alert-icon info" />;
    }
  };

  const getTypeClass = () => {
    return `alert-modal ${type}`;
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose}
      className={getTypeClass()}
      maxWidth="400px"
      closeOnBackdropClick={false}
      showCloseButton={false}
    >
      <div className="alert-modal-content">
        <div className="alert-header">
          {getIcon()}
          {title && <h3 className="alert-title">{title}</h3>}
        </div>
        
        <div className="alert-message">
          {typeof message === 'string' ? (
            <p>{message}</p>
          ) : (
            message
          )}
        </div>
        
        <div className="alert-actions">
          <button 
            className={`alert-confirm-btn ${type}`}
            onClick={onClose}
            autoFocus
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default AlertModal;