import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';

const ModalOverlay = styled(motion.div)`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
`;

const ModalContent = styled(motion.div)`
  background: white;
  border-radius: 1rem;
  width: 100%;
  max-width: 450px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #e2e8f0;

  h2 {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0;
  }
`;

const CloseButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: transparent;
  border: none;
  border-radius: 0.5rem;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #f1f5f9;
    color: #1e293b;
  }
`;

const ModalBody = styled.div`
  padding: 1.5rem;
`;

const FormGroup = styled.div`
  margin-bottom: 1.25rem;

  &:last-child {
    margin-bottom: 0;
  }

  label {
    display: block;
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.5rem;
  }
`;

const Input = styled.input`
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.9375rem;
  color: #1e293b;
  transition: border-color 0.2s ease;

  &:focus {
    outline: none;
    border-color: #8b5cf6;
  }

  &::placeholder {
    color: #94a3b8;
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 80px;
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.9375rem;
  color: #1e293b;
  resize: vertical;
  transition: border-color 0.2s ease;

  &:focus {
    outline: none;
    border-color: #8b5cf6;
  }

  &::placeholder {
    color: #94a3b8;
  }
`;

const ColorPickerLabel = styled.label`
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.5rem;
`;

const ColorGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 0.5rem;
`;

const ColorOption = styled.button`
  width: 100%;
  aspect-ratio: 1;
  border-radius: 0.5rem;
  background: ${props => props.$color};
  border: 2px solid ${props => props.$selected ? '#1e293b' : 'transparent'};
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    transform: scale(1.1);
  }

  svg {
    color: white;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
  }
`;

const CustomColorInput = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.75rem;

  input[type="color"] {
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 0.5rem;
    cursor: pointer;
    padding: 0;

    &::-webkit-color-swatch-wrapper {
      padding: 0;
    }

    &::-webkit-color-swatch {
      border: none;
      border-radius: 0.5rem;
    }
  }

  span {
    font-size: 0.875rem;
    color: #64748b;
  }
`;

const PreviewSection = styled.div`
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e2e8f0;
`;

const PreviewLabel = styled.div`
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.75rem;
`;

const PreviewItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: #f8fafc;
  border-radius: 0.5rem;
  border-left: 3px solid ${props => props.$color};

  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: ${props => props.$color};
  }

  .info {
    flex: 1;

    .name {
      font-size: 0.9375rem;
      font-weight: 500;
      color: #1e293b;
    }

    .desc {
      font-size: 0.75rem;
      color: #64748b;
      margin-top: 0.125rem;
    }
  }
`;

const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1.25rem 1.5rem;
  border-top: 1px solid #e2e8f0;
`;

const Button = styled.button`
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &.secondary {
    background: white;
    border: 1px solid #e2e8f0;
    color: #64748b;

    &:hover {
      background: #f8fafc;
      border-color: #cbd5e1;
    }
  }

  &.primary {
    background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
    border: none;
    color: white;

    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }
  }

  &.danger {
    background: #ef4444;
    border: none;
    color: white;

    &:hover {
      background: #dc2626;
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
    }
  }
`;

const PRESET_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#a855f7', // purple
  '#22c55e', // green-500
  '#eab308', // yellow
  '#64748b', // slate
  '#78716c', // stone
];

const GroupModal = ({ isOpen, group, onClose, onSave, onDelete }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3b82f6'
  });

  useEffect(() => {
    if (group) {
      setFormData({
        name: group.name || '',
        description: group.description || '',
        color: group.color || '#3b82f6'
      });
    } else {
      setFormData({
        name: '',
        description: '',
        color: '#3b82f6'
      });
    }
  }, [group, isOpen]);

  const handleSubmit = () => {
    if (!formData.name.trim()) return;

    const groupId = group?.id || formData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now();

    onSave({
      ...group,
      id: group?.id || groupId,
      name: formData.name.trim(),
      description: formData.description.trim(),
      color: formData.color
    });
  };

  const handleDelete = () => {
    if (group && window.confirm(`"${group.name}" 그룹을 삭제하시겠습니까?\n이 그룹에 속한 이슈들은 "기타" 그룹으로 이동됩니다.`)) {
      onDelete(group.id);
    }
  };

  const isValid = formData.name.trim().length > 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <ModalOverlay
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <ModalContent
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <ModalHeader>
              <h2>{group ? '그룹 수정' : '새 그룹 추가'}</h2>
              <CloseButton onClick={onClose}>
                <X size={20} />
              </CloseButton>
            </ModalHeader>

            <ModalBody>
              <FormGroup>
                <label>그룹명 *</label>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="예: 데이터 표준"
                />
              </FormGroup>

              <FormGroup>
                <label>설명</label>
                <TextArea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="그룹에 대한 간단한 설명을 입력하세요"
                />
              </FormGroup>

              <FormGroup>
                <ColorPickerLabel>색상</ColorPickerLabel>
                <ColorGrid>
                  {PRESET_COLORS.map(color => (
                    <ColorOption
                      key={color}
                      $color={color}
                      $selected={formData.color === color}
                      onClick={() => setFormData({ ...formData, color })}
                    >
                      {formData.color === color && <Check size={16} />}
                    </ColorOption>
                  ))}
                </ColorGrid>
                <CustomColorInput>
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  />
                  <span>직접 선택: {formData.color}</span>
                </CustomColorInput>
              </FormGroup>

              <PreviewSection>
                <PreviewLabel>미리보기</PreviewLabel>
                <PreviewItem $color={formData.color}>
                  <div className="dot" />
                  <div className="info">
                    <div className="name">{formData.name || '그룹명'}</div>
                    <div className="desc">{formData.description || '설명이 여기에 표시됩니다'}</div>
                  </div>
                </PreviewItem>
              </PreviewSection>
            </ModalBody>

            <ModalFooter>
              {group && group.id !== 'etc' && (
                <Button className="danger" onClick={handleDelete} style={{ marginRight: 'auto' }}>
                  삭제
                </Button>
              )}
              <Button className="secondary" onClick={onClose}>
                취소
              </Button>
              <Button className="primary" onClick={handleSubmit} disabled={!isValid}>
                {group ? '수정' : '추가'}
              </Button>
            </ModalFooter>
          </ModalContent>
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
};

export default GroupModal;
