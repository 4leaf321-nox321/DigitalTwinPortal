import React, { useState } from 'react';
import styled from 'styled-components';
import { X } from 'lucide-react';
import { useColorSettings } from '../../contexts/ColorSettingsContext';

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
  width: 400px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
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
  border-radius: 4px;

  &:hover {
    background: #e2e8f0;
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
  font-weight: 600;
  color: #374151;
  margin-bottom: 6px;
`;

const Input = styled.input`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.9rem;
  color: #1e293b;

  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.9rem;
  color: #1e293b;
  resize: vertical;
  min-height: 60px;

  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
`;

const ColorOptions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const ColorOption = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 8px;
  border: 2px solid ${props => props.selected ? props.color : 'transparent'};
  border-radius: 8px;
  background: ${props => props.selected ? `${props.color}15` : 'white'};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.color}10;
    border-color: ${props => props.color}50;
  }
`;

const ColorCircle = styled.div`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: ${props => props.color};
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

    &:hover {
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

const PreviewSection = styled.div`
  margin-top: 16px;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
`;

const PreviewLabel = styled.div`
  font-size: 0.75rem;
  color: #64748b;
  margin-bottom: 8px;
`;

const PreviewGroup = styled.div`
  border: 2px dashed ${props => props.color};
  border-radius: 8px;
  background: ${props => props.color}08;
  padding: 8px 12px;
`;

const PreviewHeader = styled.div`
  color: ${props => props.color};
  font-weight: 700;
  font-size: 0.85rem;
  padding-bottom: 6px;
  border-bottom: 1px solid ${props => props.color}30;
`;

const PreviewDescription = styled.div`
  font-size: 0.75rem;
  color: #64748b;
  margin-top: 6px;
`;

const AddGroupModal = ({ isOpen, onClose, onAddGroup }) => {
  const { colors } = useColorSettings();
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(colors[0] || '#3b82f6');

  const handleSubmit = () => {
    if (!label.trim()) return;

    onAddGroup({
      label: label.trim(),
      description: description.trim(),
      color: color,
    });

    // Reset form
    setLabel('');
    setDescription('');
    setColor(colors[0] || '#3b82f6');
    onClose();
  };

  const handleClose = () => {
    setLabel('');
    setDescription('');
    setColor(colors[0] || '#3b82f6');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Overlay onClick={handleClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>그룹 추가</ModalTitle>
          <CloseButton onClick={handleClose}>
            <X size={20} />
          </CloseButton>
        </ModalHeader>

        <ModalBody>
          <FormGroup>
            <Label>그룹 이름</Label>
            <Input
              type="text"
              placeholder="그룹 이름을 입력하세요"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </FormGroup>

          <FormGroup>
            <Label>설명 (선택)</Label>
            <TextArea
              placeholder="그룹에 대한 설명을 입력하세요"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormGroup>

          <FormGroup>
            <Label>색상</Label>
            <ColorOptions>
              {colors.map((c) => (
                <ColorOption
                  key={c}
                  selected={color === c}
                  color={c}
                  onClick={() => setColor(c)}
                >
                  <ColorCircle color={c} />
                </ColorOption>
              ))}
            </ColorOptions>
          </FormGroup>

          <PreviewSection>
            <PreviewLabel>미리보기</PreviewLabel>
            <PreviewGroup color={color}>
              <PreviewHeader color={color}>
                {label || '그룹 이름'}
              </PreviewHeader>
              {(description || '그룹 설명') && (
                <PreviewDescription>
                  {description || '그룹 설명이 여기에 표시됩니다'}
                </PreviewDescription>
              )}
            </PreviewGroup>
          </PreviewSection>
        </ModalBody>

        <ModalFooter>
          <Button className="secondary" onClick={handleClose}>
            취소
          </Button>
          <Button className="primary" onClick={handleSubmit} disabled={!label.trim()}>
            추가
          </Button>
        </ModalFooter>
      </Modal>
    </Overlay>
  );
};

export default AddGroupModal;
