import React, { useState } from 'react';
import styled from 'styled-components';
import { X, Sparkles } from 'lucide-react';

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
`;

const Modal = styled.div`
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  width: 420px;
  max-height: 80vh;
  overflow: hidden;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
`;

const ModalTitle = styled.h3`
  margin: 0;
  font-size: 1.1rem;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: #1e293b;
  }
`;

const ModalBody = styled.div`
  padding: 20px;
`;

const FormGroup = styled.div`
  margin-bottom: 16px;
`;

const Label = styled.label`
  display: block;
  font-size: 0.85rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 6px;
`;

const Input = styled.input`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.9rem;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
`;

const ColorGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
`;

const ColorOption = styled.button`
  width: 100%;
  aspect-ratio: 1;
  border-radius: 8px;
  border: 3px solid ${props => props.selected ? '#1e293b' : 'transparent'};
  background: ${props => props.color};
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;

  &:hover {
    transform: scale(1.1);
  }

  ${props => props.selected && `
    &::after {
      content: '✓';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: white;
      font-weight: bold;
      text-shadow: 0 1px 2px rgba(0,0,0,0.5);
    }
  `}
`;

const PreviewSection = styled.div`
  margin-top: 20px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
`;

const PreviewTitle = styled.div`
  font-size: 0.8rem;
  color: #64748b;
  margin-bottom: 12px;
`;

const PreviewLine = styled.div`
  height: 6px;
  background: ${props => props.color};
  border-radius: 3px;
  box-shadow: 0 0 6px ${props => props.color}, 0 0 12px ${props => props.color}80, 0 0 18px ${props => props.color}40;
`;

const PreviewLabel = styled.div`
  margin-top: 8px;
  font-size: 0.85rem;
  font-weight: 500;
  color: ${props => props.color};
  text-align: center;
`;

const InfoText = styled.div`
  font-size: 0.8rem;
  color: #64748b;
  margin-bottom: 16px;
`;

const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
`;

const Button = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &.primary {
    background: #3b82f6;
    color: white;
    border: none;

    &:hover:not(:disabled) {
      background: #2563eb;
    }

    &:disabled {
      background: #94a3b8;
      cursor: not-allowed;
    }
  }

  &.secondary {
    background: white;
    color: #64748b;
    border: 1px solid #e2e8f0;

    &:hover {
      background: #f1f5f9;
    }
  }
`;

const HIGHLIGHT_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#f43f5e', // rose
  '#78716c', // stone
];

const CreateThreadModal = ({ isOpen, onClose, onConfirm, selectedEdgeCount = 0 }) => {
  const [threadName, setThreadName] = useState('');
  const [selectedColor, setSelectedColor] = useState(HIGHLIGHT_COLORS[0]);

  const handleConfirm = () => {
    if (!threadName.trim()) return;

    onConfirm({
      name: threadName.trim(),
      color: selectedColor,
    });

    setThreadName('');
    setSelectedColor(HIGHLIGHT_COLORS[0]);
  };

  const handleClose = () => {
    setThreadName('');
    setSelectedColor(HIGHLIGHT_COLORS[0]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Overlay onClick={handleClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>
            <Sparkles size={20} />
            스레드로 엮기
          </ModalTitle>
          <CloseButton onClick={handleClose}>
            <X size={20} />
          </CloseButton>
        </ModalHeader>

        <ModalBody>
          <InfoText>
            선택된 연결선 {selectedEdgeCount}개를 하나의 스레드로 묶습니다.
          </InfoText>

          <FormGroup>
            <Label>스레드 이름</Label>
            <Input
              type="text"
              value={threadName}
              onChange={(e) => setThreadName(e.target.value)}
              placeholder="예: 메인 프로세스, 데이터 흐름..."
              autoFocus
            />
          </FormGroup>

          <FormGroup>
            <Label>하이라이트 색상</Label>
            <ColorGrid>
              {HIGHLIGHT_COLORS.map((color) => (
                <ColorOption
                  key={color}
                  color={color}
                  selected={selectedColor === color}
                  onClick={() => setSelectedColor(color)}
                />
              ))}
            </ColorGrid>
          </FormGroup>

          <PreviewSection>
            <PreviewTitle>미리보기</PreviewTitle>
            <PreviewLine color={selectedColor} />
            <PreviewLabel color={selectedColor}>
              {threadName || '스레드 이름'}
            </PreviewLabel>
          </PreviewSection>
        </ModalBody>

        <ModalFooter>
          <Button className="secondary" onClick={handleClose}>
            취소
          </Button>
          <Button
            className="primary"
            onClick={handleConfirm}
            disabled={!threadName.trim()}
          >
            <Sparkles size={16} />
            스레드 생성
          </Button>
        </ModalFooter>
      </Modal>
    </Overlay>
  );
};

export default CreateThreadModal;
