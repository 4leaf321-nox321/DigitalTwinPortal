import React, { useState } from 'react';
import styled from 'styled-components';
import { X, Save, Loader } from 'lucide-react';
import { createDiagram } from '../../services/diagramApi';

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
  width: 450px;
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

const Textarea = styled.textarea`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.9rem;
  color: #1e293b;
  resize: vertical;
  min-height: 80px;

  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
`;

const InfoBox = styled.div`
  background: #f1f5f9;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
`;

const InfoItem = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  color: #64748b;
  margin-bottom: 4px;

  &:last-child {
    margin-bottom: 0;
  }

  span:last-child {
    font-weight: 600;
    color: #374151;
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

const ErrorMessage = styled.div`
  color: #ef4444;
  font-size: 0.85rem;
  margin-top: 8px;
  padding: 8px 12px;
  background: #fef2f2;
  border-radius: 6px;
`;

const SuccessMessage = styled.div`
  color: #10b981;
  font-size: 0.85rem;
  margin-top: 8px;
  padding: 8px 12px;
  background: #ecfdf5;
  border-radius: 6px;
`;

const SaveModal = ({ isOpen, onClose, nodes, edges, viewport, colorItems }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('저장 이름을 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const diagramData = {
        name: name.trim(),
        description: description.trim(),
        nodes: nodes,
        edges: edges,
        viewport: viewport,
        metadata: {
          nodeCount: nodes.length,
          edgeCount: edges.length,
          savedAt: new Date().toISOString(),
          colorItems: colorItems || [],  // 색상 설정 포함
        },
        created_by_name: 'Anonymous', // 향후 인증 시스템 연동
      };

      await createDiagram(diagramData);
      setSuccess('다이어그램이 저장되었습니다.');

      // 1초 후 모달 닫기
      setTimeout(() => {
        setName('');
        setDescription('');
        setSuccess('');
        onClose();
      }, 1000);
    } catch (err) {
      setError(err.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setError('');
    setSuccess('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Overlay onClick={handleClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>
            <Save size={20} />
            다이어그램 저장
          </ModalTitle>
          <CloseButton onClick={handleClose}>
            <X size={20} />
          </CloseButton>
        </ModalHeader>

        <ModalBody>
          <InfoBox>
            <InfoItem>
              <span>노드 수</span>
              <span>{nodes?.length || 0}개</span>
            </InfoItem>
            <InfoItem>
              <span>연결선 수</span>
              <span>{edges?.length || 0}개</span>
            </InfoItem>
          </InfoBox>

          <FormGroup>
            <Label>저장 이름 *</Label>
            <Input
              type="text"
              placeholder="다이어그램 이름을 입력하세요"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </FormGroup>

          <FormGroup>
            <Label>설명 (선택)</Label>
            <Textarea
              placeholder="다이어그램에 대한 설명을 입력하세요"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormGroup>

          {error && <ErrorMessage>{error}</ErrorMessage>}
          {success && <SuccessMessage>{success}</SuccessMessage>}
        </ModalBody>

        <ModalFooter>
          <Button className="secondary" onClick={handleClose}>
            취소
          </Button>
          <Button
            className="primary"
            onClick={handleSubmit}
            disabled={isLoading || !name.trim()}
          >
            {isLoading ? (
              <>
                <Loader size={16} className="animate-spin" />
                저장 중...
              </>
            ) : (
              <>
                <Save size={16} />
                저장
              </>
            )}
          </Button>
        </ModalFooter>
      </Modal>
    </Overlay>
  );
};

export default SaveModal;
