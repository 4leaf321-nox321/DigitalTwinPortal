import React, { useState, useEffect } from 'react';
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
  min-height: 40px;

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

const FONT_SIZES = [
  { value: '0.7rem', label: '작게' },
  { value: '0.85rem', label: '보통' },
  { value: '1rem', label: '크게' },
  { value: '1.2rem', label: '매우 크게' },
];

const FontSizeOptions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const FontSizeOption = styled.button`
  flex: 1;
  padding: 8px 12px;
  border: 2px solid ${props => props.selected ? '#3b82f6' : '#e2e8f0'};
  border-radius: 6px;
  background: ${props => props.selected ? '#eff6ff' : 'white'};
  color: ${props => props.selected ? '#3b82f6' : '#64748b'};
  font-size: 0.85rem;
  font-weight: ${props => props.selected ? '600' : '500'};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: ${props => props.selected ? '#3b82f6' : '#cbd5e1'};
    background: ${props => props.selected ? '#eff6ff' : '#f8fafc'};
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

const PreviewArrow = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 24px 12px 16px;
  background: ${props => props.color};
  color: white;
  font-weight: 600;
  font-size: 0.9rem;
  clip-path: polygon(0% 0%, calc(100% - 16px) 0%, 100% 50%, calc(100% - 16px) 100%, 0% 100%);
`;

const EditArrowModal = ({ isOpen, onClose, onSave, node }) => {
  const { colors } = useColorSettings();
  const [label, setLabel] = useState('');
  const [color, setColor] = useState(colors[0] || '#3b82f6');
  const [fontSize, setFontSize] = useState('0.85rem');

  useEffect(() => {
    if (node && isOpen) {
      setLabel(node.data?.label || '');
      setColor(node.data?.color || '#3b82f6');
      setFontSize(node.data?.fontSize || '0.85rem');
    }
  }, [node, isOpen]);

  const handleSubmit = () => {
    onSave({
      ...node,
      data: {
        ...node.data,
        label: label,
        color: color,
        fontSize: fontSize,
      },
    });

    onClose();
  };

  const handleClose = () => {
    onClose();
  };

  if (!isOpen || !node) return null;

  return (
    <Overlay onClick={handleClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>화살표 수정</ModalTitle>
          <CloseButton onClick={handleClose}>
            <X size={20} />
          </CloseButton>
        </ModalHeader>

        <ModalBody>
          <FormGroup>
            <Label>이름</Label>
            <TextArea
              placeholder="화살표에 표시할 이름을 입력하세요 (Enter로 줄바꿈)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
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

          <FormGroup>
            <Label>글자 크기</Label>
            <FontSizeOptions>
              {FONT_SIZES.map((fs) => (
                <FontSizeOption
                  key={fs.value}
                  selected={fontSize === fs.value}
                  onClick={() => setFontSize(fs.value)}
                >
                  {fs.label}
                </FontSizeOption>
              ))}
            </FontSizeOptions>
          </FormGroup>

          <PreviewSection>
            <PreviewLabel>미리보기</PreviewLabel>
            <PreviewArrow color={color} style={{ fontSize: fontSize }}>
              {label || '단계명'}
            </PreviewArrow>
          </PreviewSection>
        </ModalBody>

        <ModalFooter>
          <Button className="secondary" onClick={handleClose}>
            취소
          </Button>
          <Button className="primary" onClick={handleSubmit}>
            저장
          </Button>
        </ModalFooter>
      </Modal>
    </Overlay>
  );
};

export default EditArrowModal;
