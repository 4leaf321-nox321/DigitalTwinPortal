import React, { useState } from 'react';
import styled from 'styled-components';
import { X, Plus, Trash2, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
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
  flex: 1;
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

const AttributesSection = styled.div`
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
  background: #f8fafc;
`;

const AttributeRow = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;

  &:last-child {
    margin-bottom: 0;
  }
`;

const AttributeInput = styled.input`
  flex: 1;
  padding: 8px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.85rem;
  color: #1e293b;
  background: white;

  &:focus {
    outline: none;
    border-color: #3b82f6;
  }
`;

const IconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: white;
  color: ${props => props.danger ? '#ef4444' : '#64748b'};
  cursor: pointer;

  &:hover {
    background: ${props => props.danger ? '#fef2f2' : '#f1f5f9'};
    border-color: ${props => props.danger ? '#ef4444' : '#e2e8f0'};
  }
`;

const AddAttributeButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 8px;
  border: 1px dashed #cbd5e1;
  border-radius: 6px;
  background: white;
  color: #64748b;
  font-size: 0.85rem;
  cursor: pointer;
  margin-top: 8px;

  &:hover {
    border-color: #3b82f6;
    color: #3b82f6;
    background: #f0f9ff;
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

const PreviewNode = styled.div`
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 2px solid ${props => props.borderColor};
  overflow: hidden;
  max-width: 200px;
`;

const PreviewNodeHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: ${props => props.bgColor};
  color: white;
  font-size: 0.8rem;
  font-weight: 600;
`;

const PreviewNodeContent = styled.div`
  padding: 8px 10px;
  font-size: 0.75rem;
  color: #64748b;
`;

const ToggleContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const AlignOptions = styled.div`
  display: flex;
  gap: 8px;
`;

const AlignOption = styled.button`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 12px;
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

const ToggleSwitch = styled.label`
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
`;

const ToggleInput = styled.input`
  opacity: 0;
  width: 0;
  height: 0;

  &:checked + span {
    background-color: #3b82f6;
  }

  &:checked + span:before {
    transform: translateX(20px);
  }
`;

const ToggleSlider = styled.span`
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #cbd5e1;
  transition: 0.3s;
  border-radius: 24px;

  &:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.3s;
    border-radius: 50%;
  }
`;

const TEXT_ALIGNS = [
  { value: 'left', label: '왼쪽' },
  { value: 'center', label: '가운데' },
  { value: 'right', label: '오른쪽' },
];

const TEXT_COLORS = [
  { value: 'white', label: '흰색', color: '#ffffff' },
  { value: 'black', label: '검은색', color: '#000000' },
];

const FONT_SIZES = [
  { value: '0.7rem', label: '작게' },
  { value: '0.8rem', label: '보통' },
  { value: '0.9rem', label: '크게' },
  { value: '1rem', label: '매우 크게' },
  { value: '1.2rem', label: '특대' },
];

const TextColorOption = styled.button`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 12px;
  border: 2px solid ${props => props.selected ? '#3b82f6' : '#e2e8f0'};
  border-radius: 6px;
  background: ${props => props.selected ? '#eff6ff' : 'white'};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: ${props => props.selected ? '#3b82f6' : '#cbd5e1'};
    background: ${props => props.selected ? '#eff6ff' : '#f8fafc'};
  }
`;

const TextColorCircle = styled.div`
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: ${props => props.color};
  border: 1px solid #e2e8f0;
`;

const TextColorLabel = styled.span`
  font-size: 0.85rem;
  color: ${props => props.selected ? '#3b82f6' : '#64748b'};
  font-weight: ${props => props.selected ? '600' : '500'};
`;

const AddNodeModal = ({ isOpen, onClose, onAddNode }) => {
  const { colors } = useColorSettings();
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(colors[0] || '#3b82f6');
  const [attributes, setAttributes] = useState([]);
  const [headerOnly, setHeaderOnly] = useState(false);
  const [textAlign, setTextAlign] = useState('left');
  const [headerTextColor, setHeaderTextColor] = useState('white');
  const [fontSize, setFontSize] = useState('0.8rem');

  const handleAddAttribute = () => {
    setAttributes([...attributes, { name: '', value: '' }]);
  };

  const handleRemoveAttribute = (index) => {
    setAttributes(attributes.filter((_, i) => i !== index));
  };

  const handleAttributeChange = (index, field, value) => {
    const newAttributes = [...attributes];
    newAttributes[index][field] = value;
    setAttributes(newAttributes);
  };

  const handleSubmit = () => {
    const validAttributes = attributes.filter(attr => attr.name.trim() && attr.value.trim());

    onAddNode({
      type: 'process',
      label: label.trim(),
      description: description,
      color: color,
      attributes: validAttributes,
      headerOnly: headerOnly,
      textAlign: textAlign,
      headerTextColor: headerTextColor,
      fontSize: fontSize,
    });

    // Reset form
    setLabel('');
    setDescription('');
    setColor(colors[0] || '#3b82f6');
    setAttributes([]);
    setHeaderOnly(false);
    setTextAlign('left');
    setHeaderTextColor('white');
    setFontSize('0.8rem');
    onClose();
  };

  const handleClose = () => {
    setLabel('');
    setDescription('');
    setColor(colors[0] || '#3b82f6');
    setAttributes([]);
    setHeaderOnly(false);
    setTextAlign('left');
    setHeaderTextColor('white');
    setFontSize('0.8rem');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Overlay onClick={handleClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>노드 추가</ModalTitle>
          <CloseButton onClick={handleClose}>
            <X size={20} />
          </CloseButton>
        </ModalHeader>

        <ModalBody>
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
            <Label>이름</Label>
            <TextArea
              placeholder="노드 이름을 입력하세요 (Enter로 줄바꿈)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              style={{ minHeight: '40px' }}
            />
          </FormGroup>

          <FormGroup>
            <Label>Header Only</Label>
            <ToggleContainer>
              <ToggleSwitch>
                <ToggleInput
                  type="checkbox"
                  checked={headerOnly}
                  onChange={(e) => setHeaderOnly(e.target.checked)}
                />
                <ToggleSlider />
              </ToggleSwitch>
              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                {headerOnly ? '헤더만 표시' : '헤더 + 내용 표시'}
              </span>
            </ToggleContainer>
          </FormGroup>

          <FormGroup>
            <Label>텍스트 정렬</Label>
            <AlignOptions>
              <AlignOption
                selected={textAlign === 'left'}
                onClick={() => setTextAlign('left')}
              >
                <AlignLeft size={16} />
                왼쪽
              </AlignOption>
              <AlignOption
                selected={textAlign === 'center'}
                onClick={() => setTextAlign('center')}
              >
                <AlignCenter size={16} />
                가운데
              </AlignOption>
              <AlignOption
                selected={textAlign === 'right'}
                onClick={() => setTextAlign('right')}
              >
                <AlignRight size={16} />
                오른쪽
              </AlignOption>
            </AlignOptions>
          </FormGroup>

          <FormGroup>
            <Label>헤더 텍스트 색상</Label>
            <AlignOptions>
              {TEXT_COLORS.map((tc) => (
                <TextColorOption
                  key={tc.value}
                  selected={headerTextColor === tc.value}
                  onClick={() => setHeaderTextColor(tc.value)}
                >
                  <TextColorCircle color={tc.color} />
                  <TextColorLabel selected={headerTextColor === tc.value}>
                    {tc.label}
                  </TextColorLabel>
                </TextColorOption>
              ))}
            </AlignOptions>
          </FormGroup>

          <FormGroup>
            <Label>글자 크기</Label>
            <AlignOptions>
              {FONT_SIZES.map((fs) => (
                <AlignOption
                  key={fs.value}
                  selected={fontSize === fs.value}
                  onClick={() => setFontSize(fs.value)}
                >
                  {fs.label}
                </AlignOption>
              ))}
            </AlignOptions>
          </FormGroup>

          <FormGroup>
            <Label>설명</Label>
            <TextArea
              placeholder="노드에 대한 설명을 입력하세요"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormGroup>

          <FormGroup>
            <Label>속성</Label>
            <AttributesSection>
              {attributes.length === 0 && (
                <div style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', padding: '8px' }}>
                  속성이 없습니다
                </div>
              )}
              {attributes.map((attr, index) => (
                <AttributeRow key={index}>
                  <AttributeInput
                    placeholder="속성 이름"
                    value={attr.name}
                    onChange={(e) => handleAttributeChange(index, 'name', e.target.value)}
                  />
                  <AttributeInput
                    placeholder="값"
                    value={attr.value}
                    onChange={(e) => handleAttributeChange(index, 'value', e.target.value)}
                  />
                  <IconButton danger onClick={() => handleRemoveAttribute(index)}>
                    <Trash2 size={16} />
                  </IconButton>
                </AttributeRow>
              ))}
              <AddAttributeButton onClick={handleAddAttribute}>
                <Plus size={16} />
                속성 추가
              </AddAttributeButton>
            </AttributesSection>
          </FormGroup>

          <PreviewSection>
            <PreviewLabel>미리보기</PreviewLabel>
            <PreviewNode borderColor={color}>
              <PreviewNodeHeader bgColor={color} style={{ textAlign: textAlign, justifyContent: textAlign === 'center' ? 'center' : textAlign === 'right' ? 'flex-end' : 'flex-start', color: headerTextColor === 'black' ? '#000000' : '#ffffff' }}>
                {label || '노드 이름'}
              </PreviewNodeHeader>
              {!headerOnly && (
                <PreviewNodeContent>
                  {description || '설명이 여기에 표시됩니다'}
                </PreviewNodeContent>
              )}
            </PreviewNode>
          </PreviewSection>
        </ModalBody>

        <ModalFooter>
          <Button className="secondary" onClick={handleClose}>
            취소
          </Button>
          <Button className="primary" onClick={handleSubmit}>
            추가
          </Button>
        </ModalFooter>
      </Modal>
    </Overlay>
  );
};

export default AddNodeModal;
