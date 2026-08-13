import React from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Info, CheckCircle, AlertTriangle, X } from 'lucide-react';

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
  background: ${props => {
    switch (props.variant) {
      case 'success': return 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
      case 'error': return 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
      case 'warning': return 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
      default: return 'linear-gradient(135deg, #0066cc 0%, #004499 100%)';
    }
  }};
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

const Icon = styled.div`
  width: 4rem;
  height: 4rem;
  background: ${props => {
    switch (props.variant) {
      case 'success': return 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)';
      case 'error': return 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)';
      case 'warning': return 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)';
      default: return 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)';
    }
  }};
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1.5rem;
  border: 3px solid ${props => {
    switch (props.variant) {
      case 'success': return '#10b981';
      case 'error': return '#ef4444';
      case 'warning': return '#f59e0b';
      default: return '#0066cc';
    }
  }};
`;

const Message = styled.div`
  text-align: center;
  margin-bottom: 1.5rem;

  .description {
    font-size: 1rem;
    color: #6b7280;
    line-height: 1.5;
    white-space: pre-line;
  }
`;

const ButtonContainer = styled.div`
  display: flex;
  justify-content: center;
`;

const Button = styled.button`
  padding: 0.75rem 2rem;
  border-radius: 0.5rem;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: 2px solid transparent;

  background: ${props => {
    switch (props.variant) {
      case 'success': return 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
      case 'error': return 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
      case 'warning': return 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
      default: return 'linear-gradient(135deg, #0066cc 0%, #004499 100%)';
    }
  }};
  color: white;

  &:hover {
    background: ${props => {
      switch (props.variant) {
        case 'success': return 'linear-gradient(135deg, #059669 0%, #047857 100%)';
        case 'error': return 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)';
        case 'warning': return 'linear-gradient(135deg, #d97706 0%, #b45309 100%)';
        default: return 'linear-gradient(135deg, #004499 0%, #003366 100%)';
      }
    }};
    transform: translateY(-1px);
    box-shadow: ${props => {
      switch (props.variant) {
        case 'success': return '0 4px 12px rgba(16, 185, 129, 0.3)';
        case 'error': return '0 4px 12px rgba(239, 68, 68, 0.3)';
        case 'warning': return '0 4px 12px rgba(245, 158, 11, 0.3)';
        default: return '0 4px 12px rgba(0, 102, 204, 0.3)';
      }
    }};
  }

  &:active {
    transform: translateY(0);
  }
`;

const AlertDialog = ({
  isOpen,
  onClose,
  message = '',
  title = '알림',
  variant = 'info', // 'info', 'success', 'error', 'warning'
  buttonText = '확인'
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (variant) {
      case 'success': return <CheckCircle size={28} color="#10b981" />;
      case 'error': return <AlertCircle size={28} color="#ef4444" />;
      case 'warning': return <AlertTriangle size={28} color="#f59e0b" />;
      default: return <Info size={28} color="#0066cc" />;
    }
  };

  const getHeaderIcon = () => {
    switch (variant) {
      case 'success': return <CheckCircle size={20} />;
      case 'error': return <AlertCircle size={20} />;
      case 'warning': return <AlertTriangle size={20} />;
      default: return <Info size={20} />;
    }
  };

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
          <ModalHeader variant={variant}>
            <div className="title">
              {getHeaderIcon()}
              {title}
            </div>
            <button className="close-btn" onClick={onClose}>
              <X size={18} />
            </button>
          </ModalHeader>

          <ModalBody>
            <Icon variant={variant}>
              {getIcon()}
            </Icon>

            <Message>
              <div className="description">{message}</div>
            </Message>

            <ButtonContainer>
              <Button type="button" variant={variant} onClick={onClose}>
                {buttonText}
              </Button>
            </ButtonContainer>
          </ModalBody>
        </ModalContainer>
      </ModalOverlay>
    </AnimatePresence>
  );
};

export default AlertDialog;
