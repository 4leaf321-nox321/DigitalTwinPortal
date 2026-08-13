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

const ColorOptions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const ColorOption = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
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

const StyleOptions = styled.div`
  display: flex;
  gap: 8px;
`;

const StyleOption = styled.button`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border: 2px solid ${props => props.selected ? '#3b82f6' : '#e2e8f0'};
  border-radius: 8px;
  background: ${props => props.selected ? '#eff6ff' : 'white'};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: ${props => props.selected ? '#3b82f6' : '#cbd5e1'};
    background: ${props => props.selected ? '#eff6ff' : '#f8fafc'};
  }
`;

const StylePreview = styled.div`
  width: 60px;
  height: ${props => props.lineWidth || 4}px;
  background: ${props => {
    switch (props.lineStyle) {
      case 'dashed':
        return `repeating-linear-gradient(to right, #64748b 0px, #64748b 8px, transparent 8px, transparent 12px)`;
      case 'dotted':
        return `repeating-linear-gradient(to right, #64748b 0px, #64748b 4px, transparent 4px, transparent 8px)`;
      default:
        return '#64748b';
    }
  }};
  border-radius: 2px;
`;

const WidthPreview = styled.div`
  width: 40px;
  height: ${props => props.lineWidth}px;
  background: #64748b;
  border-radius: 1px;
`;

const StyleLabel = styled.span`
  font-size: 0.8rem;
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

const PreviewSection = styled.div`
  margin-top: 16px;
  padding: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const PreviewLabel = styled.div`
  font-size: 0.75rem;
  color: #64748b;
  margin-bottom: 12px;
  align-self: flex-start;
`;

const PreviewDivider = styled.div`
  width: ${props => props.direction === 'vertical' ? `${props.lineWidth || 3}px` : '200px'};
  height: ${props => props.direction === 'vertical' ? '80px' : `${props.lineWidth || 3}px`};
  background: ${props => {
    const color = props.color || '#94a3b8';
    switch (props.lineStyle) {
      case 'dashed':
        return props.direction === 'vertical'
          ? `repeating-linear-gradient(to bottom, ${color} 0px, ${color} 8px, transparent 8px, transparent 12px)`
          : `repeating-linear-gradient(to right, ${color} 0px, ${color} 8px, transparent 8px, transparent 12px)`;
      case 'dotted':
        return props.direction === 'vertical'
          ? `repeating-linear-gradient(to bottom, ${color} 0px, ${color} 4px, transparent 4px, transparent 8px)`
          : `repeating-linear-gradient(to right, ${color} 0px, ${color} 4px, transparent 4px, transparent 8px)`;
      default:
        return color;
    }
  }};
  border-radius: 2px;
  position: relative;
`;

const PreviewDividerLabel = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: white;
  padding: 4px 12px;
  font-size: 0.75rem;
  font-weight: 600;
  color: ${props => props.color || '#64748b'};
  white-space: nowrap;
  border-radius: 4px;
`;

const LINE_STYLES = [
  { value: 'solid', label: '실선' },
  { value: 'dashed', label: '파선' },
  { value: 'dotted', label: '점선' },
];

const LINE_WIDTHS = [
  { value: 1, label: '얇게' },
  { value: 3, label: '보통' },
  { value: 5, label: '굵게' },
  { value: 8, label: '매우 굵게' },
];

const EditDividerModal = ({ isOpen, onClose, onSave, node }) => {
  const { colors } = useColorSettings();
  const [label, setLabel] = useState('');
  const [color, setColor] = useState('#94a3b8');
  const [lineStyle, setLineStyle] = useState('solid');
  const [lineWidth, setLineWidth] = useState(3);

  useEffect(() => {
    if (node && isOpen) {
      setLabel(node.data?.label || '');
      setColor(node.data?.color || '#94a3b8');
      setLineStyle(node.data?.lineStyle || 'solid');
      setLineWidth(node.data?.lineWidth || 3);
    }
  }, [node, isOpen]);

  const handleSubmit = () => {
    onSave({
      ...node,
      data: {
        ...node.data,
        label: label,
        color: color,
        lineStyle: lineStyle,
        lineWidth: lineWidth,
      },
    });

    onClose();
  };

  const handleClose = () => {
    onClose();
  };

  if (!isOpen || !node) return null;

  const direction = node.data?.direction || 'horizontal';
  const titleText = direction === 'vertical' ? '세로선 수정' : '가로선 수정';

  return (
    <Overlay onClick={handleClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>{titleText}</ModalTitle>
          <CloseButton onClick={handleClose}>
            <X size={20} />
          </CloseButton>
        </ModalHeader>

        <ModalBody>
          <FormGroup>
            <Label>라벨 (선택)</Label>
            <Input
              type="text"
              placeholder="구분선에 표시할 라벨 입력"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </FormGroup>

          <FormGroup>
            <Label>색상</Label>
            <ColorOptions>
              <ColorOption
                selected={color === '#94a3b8'}
                color="#94a3b8"
                onClick={() => setColor('#94a3b8')}
              >
                <ColorCircle color="#94a3b8" />
              </ColorOption>
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
            <Label>선 스타일</Label>
            <StyleOptions>
              {LINE_STYLES.map((style) => (
                <StyleOption
                  key={style.value}
                  selected={lineStyle === style.value}
                  onClick={() => setLineStyle(style.value)}
                >
                  <StylePreview lineStyle={style.value} />
                  <StyleLabel selected={lineStyle === style.value}>
                    {style.label}
                  </StyleLabel>
                </StyleOption>
              ))}
            </StyleOptions>
          </FormGroup>

          <FormGroup>
            <Label>선 굵기</Label>
            <StyleOptions>
              {LINE_WIDTHS.map((width) => (
                <StyleOption
                  key={width.value}
                  selected={lineWidth === width.value}
                  onClick={() => setLineWidth(width.value)}
                >
                  <WidthPreview lineWidth={width.value} />
                  <StyleLabel selected={lineWidth === width.value}>
                    {width.label}
                  </StyleLabel>
                </StyleOption>
              ))}
            </StyleOptions>
          </FormGroup>

          <PreviewSection>
            <PreviewLabel>미리보기</PreviewLabel>
            <PreviewDivider
              direction={direction}
              color={color}
              lineStyle={lineStyle}
              lineWidth={lineWidth}
            >
              {label && (
                <PreviewDividerLabel color={color}>
                  {label}
                </PreviewDividerLabel>
              )}
            </PreviewDivider>
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

export default EditDividerModal;
