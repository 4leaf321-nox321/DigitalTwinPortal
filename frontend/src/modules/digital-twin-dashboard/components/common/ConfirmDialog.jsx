import React from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Check } from 'lucide-react';

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
  z-index: 3000;
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
  background: ${props => props.variant === 'danger'
    ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
    : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'};
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
  background: ${props => props.variant === 'danger'
    ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'
    : 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'};
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
    white-space: pre-line;
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

  &.primary {
    background: linear-gradient(135deg, #0066cc 0%, #004499 100%);
    color: white;
    border: 2px solid transparent;

    &:hover {
      background: linear-gradient(135deg, #004499 0%, #003366 100%);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 102, 204, 0.3);
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

  &:active {
    transform: translateY(0);
  }
`;

const ConfirmDialog = ({
  isOpen,
  onConfirm,
  onCancel,
  title = '확인',
  message = '계속하시겠습니까?',
  confirmText = '확인',
  cancelText = '취소',
  variant = 'warning', // 'warning' or 'danger'
  /**
   * 선택지가 **셋**일 때 쓰는 세 번째 버튼 (2026-08-07).
   * `{ label, onClick }`. 예 — 기여 방법 삭제: 취소 / 목록에서만 빼기 / 연결에서도 지우기.
   * 예/아니오로 못 줄이는 결정을 억지로 두 개로 접으면 사용자가 무엇을 고른 건지 모른다.
   */
  extraAction = null
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
  };

  const handleCancel = () => {
    onCancel();
  };

  return (
    <AnimatePresence>
      <ModalOverlay
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            handleCancel();
          }
        }}
      >
        <ModalContainer
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 500 }}
        >
          <ModalHeader variant={variant}>
            <div className="title">
              <AlertTriangle size={20} />
              {title}
            </div>
            <button className="close-btn" onClick={handleCancel}>
              <X size={18} />
            </button>
          </ModalHeader>

          <ModalBody>
            <WarningIcon variant={variant}>
              <AlertTriangle size={28} color="#f59e0b" />
            </WarningIcon>

            <Message>
              {/* 줄바꿈을 살린다 — 선택지를 줄로 나눠 설명하는 경우가 있다 */}
              <div className="description" style={{ whiteSpace: 'pre-line' }}>{message}</div>
            </Message>

            <ButtonContainer>
              <Button type="button" className="secondary" onClick={handleCancel}>
                {cancelText}
              </Button>
              {extraAction && (
                <Button type="button" className="danger" onClick={extraAction.onClick}>
                  {extraAction.label}
                </Button>
              )}
              <Button
                type="button"
                className={variant === 'danger' ? 'danger' : 'primary'}
                onClick={handleConfirm}
              >
                <Check size={16} />
                {confirmText}
              </Button>
            </ButtonContainer>
          </ModalBody>
        </ModalContainer>
      </ModalOverlay>
    </AnimatePresence>
  );
};

export default ConfirmDialog;
