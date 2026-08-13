import React, { useState } from 'react';
import styled from 'styled-components';
import { X, Plus, Trash2, RotateCcw } from 'lucide-react';
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
  width: 500px;
  max-height: 80vh;
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
  overflow-y: auto;
`;

const Section = styled.div`
  margin-bottom: 20px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionTitle = styled.div`
  font-size: 0.85rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ResetButton = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  background: white;
  color: #64748b;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #f1f5f9;
    color: #374151;
  }
`;

const ColorList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ColorItem = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: white;
`;

const ColorCircle = styled.div`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: ${props => props.color};
  border: 2px solid white;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1);
  flex-shrink: 0;
`;

const ColorCode = styled.span`
  font-size: 0.75rem;
  color: #94a3b8;
  font-family: monospace;
  width: 70px;
  flex-shrink: 0;
`;

const LabelInput = styled.input`
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 0.85rem;
  color: #1e293b;

  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  }

  &::placeholder {
    color: #94a3b8;
  }
`;

const DeleteColorButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  border: none;
  background: none;
  color: #94a3b8;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s ease;
  flex-shrink: 0;

  &:hover {
    background: #fee2e2;
    color: #ef4444;
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
    &:hover {
      background: none;
      color: #94a3b8;
    }
  }
`;

const AddColorSection = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 12px;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  background: #f8fafc;
`;

const ColorInput = styled.input`
  width: 40px;
  height: 32px;
  padding: 0;
  border: 2px solid #e2e8f0;
  border-radius: 6px;
  cursor: pointer;
  flex-shrink: 0;

  &::-webkit-color-swatch-wrapper {
    padding: 2px;
  }

  &::-webkit-color-swatch {
    border: none;
    border-radius: 4px;
  }
`;

const TextInput = styled.input`
  width: 80px;
  padding: 6px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 0.8rem;
  font-family: monospace;
  color: #1e293b;
  flex-shrink: 0;

  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  }
`;

const NewLabelInput = styled.input`
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 0.85rem;
  color: #1e293b;

  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  }

  &::placeholder {
    color: #94a3b8;
  }
`;

const AddButton = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  background: #3b82f6;
  color: white;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;

  &:hover {
    background: #2563eb;
  }

  &:disabled {
    background: #94a3b8;
    cursor: not-allowed;
  }
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

const HelpText = styled.p`
  font-size: 0.75rem;
  color: #64748b;
  margin: 8px 0 0 0;
`;

const SettingsModal = ({ isOpen, onClose }) => {
  const { colors, colorItems, addColor, removeColor, updateColorLabel, resetColors } = useColorSettings();
  const [newColor, setNewColor] = useState('#6366f1');
  const [newLabel, setNewLabel] = useState('');

  const handleAddColor = () => {
    if (newColor && !colors.includes(newColor.toLowerCase())) {
      addColor(newColor.toLowerCase(), newLabel.trim());
      setNewColor('#6366f1');
      setNewLabel('');
    }
  };

  const handleColorInputChange = (e) => {
    setNewColor(e.target.value);
  };

  const handleTextInputChange = (e) => {
    const value = e.target.value;
    if (value.match(/^#[0-9a-fA-F]{0,6}$/)) {
      setNewColor(value);
    }
  };

  const handleLabelChange = (color, label) => {
    updateColorLabel(color, label);
  };

  const isValidColor = newColor.match(/^#[0-9a-fA-F]{6}$/);
  const isDuplicate = colors.includes(newColor.toLowerCase());

  if (!isOpen) return null;

  return (
    <Overlay onClick={onClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>설정</ModalTitle>
          <CloseButton onClick={onClose}>
            <X size={20} />
          </CloseButton>
        </ModalHeader>

        <ModalBody>
          <Section>
            <SectionTitle>
              <span>색상 팔레트</span>
              <ResetButton onClick={resetColors}>
                <RotateCcw size={12} />
                기본값으로 복원
              </ResetButton>
            </SectionTitle>

            <ColorList>
              {colorItems.map((item) => (
                <ColorItem key={item.color}>
                  <ColorCircle color={item.color} />
                  <ColorCode>{item.color}</ColorCode>
                  <LabelInput
                    type="text"
                    value={item.label}
                    onChange={(e) => handleLabelChange(item.color, e.target.value)}
                    placeholder="라벨 입력"
                  />
                  <DeleteColorButton
                    onClick={() => removeColor(item.color)}
                    disabled={colorItems.length <= 1}
                    title={colorItems.length <= 1 ? '최소 1개의 색상이 필요합니다' : '색상 삭제'}
                  >
                    <Trash2 size={16} />
                  </DeleteColorButton>
                </ColorItem>
              ))}
            </ColorList>

            <AddColorSection>
              <ColorInput
                type="color"
                value={newColor}
                onChange={handleColorInputChange}
              />
              <TextInput
                type="text"
                value={newColor}
                onChange={handleTextInputChange}
                placeholder="#000000"
                maxLength={7}
              />
              <NewLabelInput
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="라벨 (선택)"
              />
              <AddButton
                onClick={handleAddColor}
                disabled={!isValidColor || isDuplicate}
              >
                <Plus size={14} />
                추가
              </AddButton>
            </AddColorSection>

            <HelpText>
              {isDuplicate ? '이미 존재하는 색상입니다.' :
               !isValidColor ? '올바른 HEX 색상 코드를 입력하세요 (예: #ff5500)' :
               '색상과 라벨을 입력하여 추가하세요. 라벨은 범례에 표시됩니다.'}
            </HelpText>
          </Section>
        </ModalBody>

        <ModalFooter>
          <Button className="primary" onClick={onClose}>
            닫기
          </Button>
        </ModalFooter>
      </Modal>
    </Overlay>
  );
};

export default SettingsModal;
