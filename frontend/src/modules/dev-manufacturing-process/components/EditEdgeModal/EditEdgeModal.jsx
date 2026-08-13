import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { X } from 'lucide-react';

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
  display: grid;
  grid-template-columns: repeat(5, 1fr);
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

const StyleOptions = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
`;

const StyleOption = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  border: 2px solid ${props => props.selected ? '#3b82f6' : '#e2e8f0'};
  border-radius: 8px;
  background: ${props => props.selected ? '#eff6ff' : 'white'};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #f8fafc;
    border-color: #3b82f6;
  }
`;

const StyleLine = styled.div`
  width: 40px;
  height: 3px;
  background: ${props => props.color || '#64748b'};
  border-radius: 2px;
  ${props => props.dashed && `
    background: transparent;
    border-top: 3px dashed ${props.color || '#64748b'};
  `}
`;

const StyleLabel = styled.span`
  font-size: 0.8rem;
  color: #374151;
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

const PreviewEdge = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const PreviewNode = styled.div`
  width: 60px;
  height: 30px;
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  color: #64748b;
`;

const PreviewLine = styled.div`
  flex: 1;
  height: 3px;
  background: ${props => props.color};
  position: relative;
  ${props => props.dashed && `
    background: transparent;
    border-top: 3px dashed ${props.color};
  `}

  /* 정방향 화살표 (오른쪽) */
  ${props => props.arrowDirection === 'forward' && `
    &::after {
      content: '';
      position: absolute;
      right: -6px;
      top: 50%;
      transform: translateY(-50%);
      border-left: 8px solid ${props.color};
      border-top: 5px solid transparent;
      border-bottom: 5px solid transparent;
    }
  `}

  /* 역방향 화살표 (왼쪽) */
  ${props => props.arrowDirection === 'reverse' && `
    &::before {
      content: '';
      position: absolute;
      left: -6px;
      top: 50%;
      transform: translateY(-50%);
      border-right: 8px solid ${props.color};
      border-top: 5px solid transparent;
      border-bottom: 5px solid transparent;
    }
  `}
`;

const ArrowOptions = styled.div`
  display: flex;
  gap: 8px;
`;

const ArrowOption = styled.button`
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

const ArrowPreviewContainer = styled.div`
  width: 50px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ArrowPreviewLine = styled.div`
  width: 40px;
  height: 2px;
  background: #64748b;
  position: relative;

  /* 정방향 */
  ${props => props.direction === 'forward' && `
    &::after {
      content: '';
      position: absolute;
      right: -4px;
      top: 50%;
      transform: translateY(-50%);
      border-left: 6px solid #64748b;
      border-top: 4px solid transparent;
      border-bottom: 4px solid transparent;
    }
  `}

  /* 역방향 */
  ${props => props.direction === 'reverse' && `
    &::before {
      content: '';
      position: absolute;
      left: -4px;
      top: 50%;
      transform: translateY(-50%);
      border-right: 6px solid #64748b;
      border-top: 4px solid transparent;
      border-bottom: 4px solid transparent;
    }
  `}
`;

const ArrowLabel = styled.span`
  font-size: 0.8rem;
  color: ${props => props.selected ? '#3b82f6' : '#64748b'};
  font-weight: ${props => props.selected ? '600' : '500'};
`;

const PreviewEdgeLabel = styled.div`
  position: absolute;
  top: -18px;
  left: 50%;
  transform: translateX(-50%);
  background: white;
  padding: 2px 6px;
  font-size: 0.7rem;
  color: #374151;
  border-radius: 4px;
  white-space: nowrap;
`;

const COLORS = [
  { id: 'default', color: '#64748b' },
  { id: 'blue', color: '#3b82f6' },
  { id: 'purple', color: '#8b5cf6' },
  { id: 'orange', color: '#f59e0b' },
  { id: 'green', color: '#10b981' },
];

const ARROW_DIRECTIONS = [
  { value: 'forward', label: '정방향' },
  { value: 'reverse', label: '역방향' },
  { value: 'none', label: '없음' },
];

// edge에서 현재 화살표 방향 판별
const getArrowDirection = (edge) => {
  if (edge?.markerEnd) return 'forward';
  if (edge?.markerStart) return 'reverse';
  return 'none';
};

const EditEdgeModal = ({ isOpen, onClose, onSave, edge }) => {
  const [label, setLabel] = useState('');
  const [color, setColor] = useState('#64748b');
  const [isDashed, setIsDashed] = useState(false);
  const [arrowDirection, setArrowDirection] = useState('forward');

  useEffect(() => {
    if (edge && isOpen) {
      setLabel(edge.label || '');
      setColor(edge.style?.stroke || '#64748b');
      setIsDashed(edge.style?.strokeDasharray ? true : false);
      setArrowDirection(getArrowDirection(edge));
    }
  }, [edge, isOpen]);

  const handleSubmit = () => {
    const arrowMarker = {
      type: 'arrowclosed',
      width: 20,
      height: 20,
      color: color,
    };

    onSave({
      ...edge,
      label: label.trim() || undefined,
      style: {
        ...edge.style,
        stroke: color,
        strokeWidth: 2,
        ...(isDashed ? { strokeDasharray: '5,5' } : { strokeDasharray: undefined }),
      },
      markerEnd: arrowDirection === 'forward' ? arrowMarker : undefined,
      markerStart: arrowDirection === 'reverse' ? arrowMarker : undefined,
    });

    onClose();
  };

  const handleClose = () => {
    onClose();
  };

  if (!isOpen || !edge) return null;

  return (
    <Overlay onClick={handleClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>연결선 수정</ModalTitle>
          <CloseButton onClick={handleClose}>
            <X size={20} />
          </CloseButton>
        </ModalHeader>

        <ModalBody>
          <FormGroup>
            <Label>라벨 (선택)</Label>
            <Input
              type="text"
              placeholder="연결선에 표시할 텍스트"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </FormGroup>

          <FormGroup>
            <Label>색상</Label>
            <ColorOptions>
              {COLORS.map((c) => (
                <ColorOption
                  key={c.id}
                  selected={color === c.color}
                  color={c.color}
                  onClick={() => setColor(c.color)}
                >
                  <ColorCircle color={c.color} />
                </ColorOption>
              ))}
            </ColorOptions>
          </FormGroup>

          <FormGroup>
            <Label>스타일</Label>
            <StyleOptions>
              <StyleOption
                selected={!isDashed}
                onClick={() => setIsDashed(false)}
              >
                <StyleLine color={color} />
                <StyleLabel>실선</StyleLabel>
              </StyleOption>
              <StyleOption
                selected={isDashed}
                onClick={() => setIsDashed(true)}
              >
                <StyleLine color={color} dashed />
                <StyleLabel>점선</StyleLabel>
              </StyleOption>
            </StyleOptions>
          </FormGroup>

          <FormGroup>
            <Label>화살표 방향</Label>
            <ArrowOptions>
              {ARROW_DIRECTIONS.map((dir) => (
                <ArrowOption
                  key={dir.value}
                  selected={arrowDirection === dir.value}
                  onClick={() => setArrowDirection(dir.value)}
                >
                  <ArrowPreviewContainer>
                    <ArrowPreviewLine direction={dir.value} />
                  </ArrowPreviewContainer>
                  <ArrowLabel selected={arrowDirection === dir.value}>
                    {dir.label}
                  </ArrowLabel>
                </ArrowOption>
              ))}
            </ArrowOptions>
          </FormGroup>

          <PreviewSection>
            <PreviewLabel>미리보기</PreviewLabel>
            <PreviewEdge>
              <PreviewNode>노드</PreviewNode>
              <div style={{ flex: 1, position: 'relative' }}>
                <PreviewLine color={color} dashed={isDashed} arrowDirection={arrowDirection} />
                {label && <PreviewEdgeLabel>{label}</PreviewEdgeLabel>}
              </div>
              <PreviewNode>노드</PreviewNode>
            </PreviewEdge>
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

export default EditEdgeModal;
