import React, { useState } from 'react';
import styled from 'styled-components';
import { X, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
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

const LabelRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
`;

const Label = styled.label`
  font-size: 0.85rem;
  font-weight: 600;
  color: #374151;
`;

const ApplyCheckbox = styled.label`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: #64748b;
  cursor: pointer;

  input {
    cursor: pointer;
  }
`;

const ColorOptions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  opacity: ${props => props.disabled ? 0.5 : 1};
  pointer-events: ${props => props.disabled ? 'none' : 'auto'};
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

const ToggleContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  opacity: ${props => props.disabled ? 0.5 : 1};
  pointer-events: ${props => props.disabled ? 'none' : 'auto'};
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

const AlignOptions = styled.div`
  display: flex;
  gap: 8px;
  opacity: ${props => props.disabled ? 0.5 : 1};
  pointer-events: ${props => props.disabled ? 'none' : 'auto'};
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

const TEXT_COLORS = [
  { value: 'white', label: '흰색', color: '#ffffff' },
  { value: 'black', label: '검은색', color: '#000000' },
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

const InfoBox = styled.div`
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
  font-size: 0.85rem;
  color: #0369a1;
`;

const BulkEditNodeModal = ({ isOpen, onClose, onSave, nodes }) => {
  const { colors } = useColorSettings();

  // 적용할 항목 체크 상태
  const [applyColor, setApplyColor] = useState(false);
  const [applyHeaderOnly, setApplyHeaderOnly] = useState(false);
  const [applyTextAlign, setApplyTextAlign] = useState(false);
  const [applyHeaderTextColor, setApplyHeaderTextColor] = useState(false);

  // 값 상태
  const [color, setColor] = useState(colors[0] || '#3b82f6');
  const [headerOnly, setHeaderOnly] = useState(false);
  const [textAlign, setTextAlign] = useState('left');
  const [headerTextColor, setHeaderTextColor] = useState('white');

  const handleSubmit = () => {
    // 적용할 변경사항만 포함
    const changes = {};
    if (applyColor) changes.color = color;
    if (applyHeaderOnly) changes.headerOnly = headerOnly;
    if (applyTextAlign) changes.textAlign = textAlign;
    if (applyHeaderTextColor) changes.headerTextColor = headerTextColor;

    onSave(changes);
    handleClose();
  };

  const handleClose = () => {
    // Reset form
    setApplyColor(false);
    setApplyHeaderOnly(false);
    setApplyTextAlign(false);
    setApplyHeaderTextColor(false);
    setColor(colors[0] || '#3b82f6');
    setHeaderOnly(false);
    setTextAlign('left');
    setHeaderTextColor('white');
    onClose();
  };

  const hasAnyChanges = applyColor || applyHeaderOnly || applyTextAlign || applyHeaderTextColor;

  if (!isOpen || !nodes || nodes.length === 0) return null;

  return (
    <Overlay onClick={handleClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>노드 일괄 수정 ({nodes.length}개)</ModalTitle>
          <CloseButton onClick={handleClose}>
            <X size={20} />
          </CloseButton>
        </ModalHeader>

        <ModalBody>
          <InfoBox>
            선택된 {nodes.length}개의 노드를 일괄 수정합니다.<br />
            적용할 항목만 체크하면, 해당 항목만 변경되고 나머지는 유지됩니다.
          </InfoBox>

          <FormGroup>
            <LabelRow>
              <Label>색상</Label>
              <ApplyCheckbox>
                <input
                  type="checkbox"
                  checked={applyColor}
                  onChange={(e) => setApplyColor(e.target.checked)}
                />
                적용
              </ApplyCheckbox>
            </LabelRow>
            <ColorOptions disabled={!applyColor}>
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
            <LabelRow>
              <Label>Header Only</Label>
              <ApplyCheckbox>
                <input
                  type="checkbox"
                  checked={applyHeaderOnly}
                  onChange={(e) => setApplyHeaderOnly(e.target.checked)}
                />
                적용
              </ApplyCheckbox>
            </LabelRow>
            <ToggleContainer disabled={!applyHeaderOnly}>
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
            <LabelRow>
              <Label>텍스트 정렬</Label>
              <ApplyCheckbox>
                <input
                  type="checkbox"
                  checked={applyTextAlign}
                  onChange={(e) => setApplyTextAlign(e.target.checked)}
                />
                적용
              </ApplyCheckbox>
            </LabelRow>
            <AlignOptions disabled={!applyTextAlign}>
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
            <LabelRow>
              <Label>헤더 텍스트 색상</Label>
              <ApplyCheckbox>
                <input
                  type="checkbox"
                  checked={applyHeaderTextColor}
                  onChange={(e) => setApplyHeaderTextColor(e.target.checked)}
                />
                적용
              </ApplyCheckbox>
            </LabelRow>
            <AlignOptions disabled={!applyHeaderTextColor}>
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
        </ModalBody>

        <ModalFooter>
          <Button className="secondary" onClick={handleClose}>
            취소
          </Button>
          <Button className="primary" onClick={handleSubmit} disabled={!hasAnyChanges}>
            일괄 적용
          </Button>
        </ModalFooter>
      </Modal>
    </Overlay>
  );
};

export default BulkEditNodeModal;
