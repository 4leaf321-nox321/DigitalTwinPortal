import React, { useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Trash2 } from 'lucide-react';

const ModalOverlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
`;

const ModalContainer = styled(motion.div)`
  background: white;
  border-radius: 1rem;
  max-width: 500px;
  width: 100%;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  position: relative;
`;

const ModalHeader = styled.div`
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
  padding: 1.5rem 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  
  .title {
    font-size: 1.25rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .close-btn {
    background: rgba(255, 255, 255, 0.2);
    border: none;
    border-radius: 0.5rem;
    color: white;
    width: 2.5rem;
    height: 2.5rem;
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
`;

const ModalBody = styled.div`
  padding: 2rem;
`;

const WarningIcon = styled.div`
  width: 4rem;
  height: 4rem;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1.5rem;
  border: 3px solid #f59e0b;
`;

const Message = styled.div`
  text-align: center;
  margin-bottom: 1.5rem;
  
  .title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 0.5rem;
  }
  
  .description {
    font-size: 1rem;
    color: #6b7280;
    line-height: 1.5;
    margin-bottom: 1rem;
  }
  
  .project-name {
    font-weight: 600;
    color: #dc2626;
    background: #fef2f2;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    border: 1px solid #fecaca;
    display: inline-block;
    max-width: 100%;
    word-break: break-word;
  }
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: center;
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
  gap: 0.5rem;
  
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
    
    &:active {
      transform: translateY(0);
      box-shadow: 0 2px 6px rgba(239, 68, 68, 0.2);
    }
  }
`;

const DeleteConfirmModal = ({ isOpen, onClose, onConfirm, project }) => {
  const handleConfirm = useCallback(() => {
    onConfirm(project);
    onClose();
  }, [onConfirm, onClose, project]);

  // Enter 키로 삭제 실행
  useEffect(() => {
    if (!isOpen || !project) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, project, handleConfirm]);

  if (!isOpen || !project) return null;

  return (
    <AnimatePresence>
      <ModalOverlay
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
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
              <Trash2 size={20} />
              과제 삭제
            </div>
            <button className="close-btn" onClick={onClose}>
              <X size={18} />
            </button>
          </ModalHeader>

          <ModalBody>
            <WarningIcon>
              <AlertTriangle size={28} color="#f59e0b" />
            </WarningIcon>
            
            <Message>
              <div className="title">정말 삭제하시겠습니까?</div>
              <div className="description">
                다음 과제를 삭제하려고 합니다.<br />
                이 작업은 되돌릴 수 없습니다.
              </div>
              <div className="project-name">
                {project.과제명}
              </div>
            </Message>

            <ButtonContainer>
              <Button type="button" className="secondary" onClick={onClose}>
                취소
              </Button>
              <Button type="button" className="danger" onClick={handleConfirm}>
                <Trash2 size={16} />
                삭제
              </Button>
            </ButtonContainer>
          </ModalBody>
        </ModalContainer>
      </ModalOverlay>
    </AnimatePresence>
  );
};

export default DeleteConfirmModal;