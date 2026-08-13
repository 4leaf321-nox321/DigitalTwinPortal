import React from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

const ModalOverlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000; /* 기존 모달보다 위에 표시 */
  padding: 1rem;
`;

const ModalContainer = styled(motion.div)`
  background: white;
  border-radius: 1rem;
  width: 100%;
  max-width: 480px;
  overflow: hidden;
  box-shadow: 0 25px 80px rgba(0, 0, 0, 0.4);
  position: relative;
  display: flex;
  flex-direction: column;
`;

const ModalHeader = styled.div`
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
  padding: 1.5rem 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  
  .title {
    font-size: 1.1rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  
  .close-btn {
    background: rgba(255, 255, 255, 0.2);
    border: none;
    border-radius: 0.5rem;
    color: white;
    width: 2.25rem;
    height: 2.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    
    &:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: scale(1.05);
    }
  }
  
  @media (max-width: 768px) {
    padding: 1.25rem 1.5rem;
    
    .title {
      font-size: 1rem;
    }
    
    .close-btn {
      width: 2rem;
      height: 2rem;
    }
  }
`;

const ModalBody = styled.div`
  padding: 2rem;
  flex: 1;
  
  .message {
    font-size: 1rem;
    color: #374151;
    line-height: 1.6;
    text-align: center;
    margin: 0;
  }
  
  @media (max-width: 768px) {
    padding: 1.5rem;
    
    .message {
      font-size: 0.9rem;
    }
  }
`;

const ModalFooter = styled.div`
  padding: 1.5rem 2rem;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  background: #f9fafb;
  flex-shrink: 0;
  
  @media (max-width: 768px) {
    padding: 1.25rem 1.5rem;
    gap: 0.75rem;
  }
  
  @media (max-width: 480px) {
    flex-direction: column-reverse;
    gap: 0.5rem;
  }
`;

const Button = styled.button`
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  white-space: nowrap;
  min-width: 100px;
  
  &.secondary {
    background: #f3f4f6;
    color: #374151;
    border: 2px solid #d1d5db;
    
    &:hover {
      background: #e5e7eb;
      border-color: #9ca3af;
    }
  }
  
  &.danger {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
    border: 2px solid transparent;
    
    &:hover {
      background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
    }
  }
  
  @media (max-width: 768px) {
    padding: 0.625rem 1.25rem;
    font-size: 0.8rem;
    min-width: 90px;
  }
  
  @media (max-width: 480px) {
    width: 100%;
    padding: 0.75rem;
  }
`;

const ConfirmModal = ({ 
  isOpen, 
  onConfirm, 
  onCancel, 
  title = "확인", 
  message = "정말로 실행하시겠습니까?",
  confirmText = "확인",
  cancelText = "취소",
  isDanger = false
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <ModalOverlay
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onCancel();
          }
        }}
      >
        <ModalContainer
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 500 }}
        >
          <ModalHeader>
            <div className="title">
              <AlertTriangle size={20} />
              {title}
            </div>
            <button className="close-btn" onClick={onCancel}>
              <X size={16} />
            </button>
          </ModalHeader>

          <ModalBody>
            <p className="message">{message}</p>
          </ModalBody>

          <ModalFooter>
            <Button type="button" className="secondary" onClick={onCancel}>
              {cancelText}
            </Button>
            <Button 
              type="button" 
              className={isDanger ? "danger" : "primary"} 
              onClick={onConfirm}
            >
              {confirmText}
            </Button>
          </ModalFooter>
        </ModalContainer>
      </ModalOverlay>
    </AnimatePresence>
  );
};

export default ConfirmModal;
