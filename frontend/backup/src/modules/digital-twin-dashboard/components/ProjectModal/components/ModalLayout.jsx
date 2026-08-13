import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { X, Plus, Save } from 'lucide-react';
import ConfirmModal from './ConfirmModal';

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
  
  @media (max-width: 768px) {
    padding: 0.5rem;
    align-items: flex-start;
    padding-top: 1rem;
  }
  
  @media (max-width: 480px) {
    padding: 0;
    align-items: stretch;
  }
`;

const ModalContainer = styled(motion.div)`
  background: white;
  border-radius: 1rem;
  width: 80vw;
  height: auto;
  max-width: 1400px;
  max-height: 90vh;
  min-height: 300px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  position: relative;
  display: flex;
  flex-direction: column;
  
  @media (max-width: 1024px) {
    width: 90vw;
    max-height: 85vh;
  }
  
  @media (max-width: 768px) {
    width: calc(100vw - 1rem);
    max-height: calc(100vh - 2rem);
    border-radius: 0.5rem;
    min-height: auto;
  }
  
  @media (max-width: 480px) {
    width: 100vw;
    max-height: 100vh;
    border-radius: 0;
    min-height: auto;
  }
`;

const ModalHeader = styled.div`
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  padding: 1.5rem 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  
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
  
  @media (max-width: 768px) {
    padding: 1rem 1.5rem;
    
    .title {
      font-size: 1.1rem;
    }
    
    .close-btn {
      width: 2rem;
      height: 2rem;
    }
  }
  
  @media (max-width: 480px) {
    padding: 1rem;
  }
`;

const ModalBody = styled.div`
  flex: 1;
  padding: 2rem;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  min-height: 0;
  max-height: calc(90vh - 200px);
  
  &::-webkit-scrollbar {
    width: 12px;
  }
  
  &::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 6px;
    margin: 4px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #10b981;
    border-radius: 6px;
    border: 2px solid #f1f5f9;
    
    &:hover {
      background: #059669;
    }
    
    &:active {
      background: #047857;
    }
  }
  
  scrollbar-width: thin;
  scrollbar-color: #10b981 #f1f5f9;
  
  @media (max-width: 1024px) {
    max-height: calc(85vh - 180px);
  }
  
  @media (max-width: 768px) {
    padding: 1.5rem;
    gap: 1.5rem;
    max-height: calc(100vh - 160px);
    
    &::-webkit-scrollbar {
      width: 8px;
    }
  }
  
  @media (max-width: 480px) {
    padding: 1rem;
    gap: 1rem;
    max-height: calc(100vh - 140px);
    
    &::-webkit-scrollbar {
      width: 6px;
    }
  }
`;

const HorizontalSectionsContainer = styled.div`
  display: flex;
  gap: 2rem;
  
  @media (max-width: 1200px) {
    flex-direction: column;
    gap: 1.5rem;
  }
  
  @media (max-width: 768px) {
    gap: 1rem;
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
    padding: 1rem 1.5rem;
    gap: 0.75rem;
  }
  
  @media (max-width: 480px) {
    padding: 1rem;
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
  
  &.secondary {
    background: #f3f4f6;
    color: #374151;
    border: 2px solid #d1d5db;
    
    &:hover {
      background: #e5e7eb;
      border-color: #9ca3af;
    }
  }
  
  &.primary {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    border: 2px solid transparent;
    
    &:hover {
      background: linear-gradient(135deg, #059669 0%, #047857 100%);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    }
    
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }
  }
  
  @media (max-width: 768px) {
    padding: 0.625rem 1.25rem;
    font-size: 0.8rem;
  }
  
  @media (max-width: 480px) {
    width: 100%;
    padding: 0.75rem;
  }
`;

const ModalLayout = ({ children, handleClose, currentYear, handleSubmit, isEditMode = false }) => {
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStartPos, setDragStartPos] = React.useState({ x: 0, y: 0 });
  const [showConfirmModal, setShowConfirmModal] = React.useState(false);

  const handleMouseDown = (e) => {
    setIsDragging(false);
    setDragStartPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e) => {
    if (dragStartPos.x !== 0 || dragStartPos.y !== 0) {
      const distance = Math.sqrt(
        Math.pow(e.clientX - dragStartPos.x, 2) + Math.pow(e.clientY - dragStartPos.y, 2)
      );
      // 5픽셀 이상 이동하면 드래그로 간주
      if (distance > 5) {
        setIsDragging(true);
      }
    }
  };

  const handleMouseUp = (e) => {
    // 드래그가 아니고, 오버레이를 직접 클릭한 경우에만 모달 닫기 확인
    if (!isDragging && e.target === e.currentTarget) {
      setShowConfirmModal(true);
    }
    setIsDragging(false);
    setDragStartPos({ x: 0, y: 0 });
  };

  const handleCloseClick = () => {
    setShowConfirmModal(true);
  };

  const handleConfirmClose = () => {
    setShowConfirmModal(false);
    handleClose();
  };

  const handleCancelClose = () => {
    setShowConfirmModal(false);
  };
  return (
    <ModalOverlay
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <ModalContainer
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 500 }}
      >
        <ModalHeader>
          <div className="title">
            {isEditMode ? (
              <>
                <Save size={20} />
                과제 편집 ({currentYear}년)
              </>
            ) : (
              <>
                <Plus size={20} />
                새 과제 추가 ({currentYear}년)
              </>
            )}
          </div>
          <button className="close-btn" onClick={handleCloseClick}>
            <X size={18} />
          </button>
        </ModalHeader>

        <form onSubmit={handleSubmit}>
          <ModalBody>
            <HorizontalSectionsContainer>
              {children[0]} {/* BasicInfoSection */}
              {children[1]} {/* ResponsibleInfoSection */}
            </HorizontalSectionsContainer>
            {children.slice(2)} {/* 나머지 모든 섹션들 */}
          </ModalBody>

          <ModalFooter>
            <Button type="button" className="secondary" onClick={handleCloseClick}>
              취소
            </Button>
            <Button type="submit" className="primary">
              <Save size={16} />
              {isEditMode ? '변경 저장' : '과제 추가'}
            </Button>
          </ModalFooter>
        </form>
      </ModalContainer>
      
      <ConfirmModal
        isOpen={showConfirmModal}
        onConfirm={handleConfirmClose}
        onCancel={handleCancelClose}
        title="창 닫기 확인"
        message="작성 중인 내용이 손실될 수 있습니다. 정말로 창을 닫으시겠습니까?"
        confirmText="닫기"
        cancelText="취소"
        isDanger={true}
      />
    </ModalOverlay>
  );
};

export default ModalLayout;
