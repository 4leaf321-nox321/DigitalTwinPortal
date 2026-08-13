import React, { useState, useCallback, useRef } from 'react';
import styled from 'styled-components';
import { X, Plus, Trash2, ClipboardPaste, Info, AlertCircle, Copy } from 'lucide-react';
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
  width: 95vw;
  max-width: 1400px;
  max-height: 90vh;
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
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
`;

const ModalTitle = styled.h3`
  margin: 0;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const CloseButton = styled.button`
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  cursor: pointer;
  padding: 6px;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.3);
  }
`;

const ModalBody = styled.div`
  padding: 20px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const InfoBox = styled.div`
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border: 1px solid #93c5fd;
  border-radius: 8px;
  padding: 12px 16px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 0.85rem;
  color: #1e40af;

  svg {
    flex-shrink: 0;
    margin-top: 2px;
  }
`;

const InfoContent = styled.div`
  flex: 1;
  line-height: 1.5;

  strong {
    font-weight: 600;
  }
`;

const TableWrapper = styled.div`
  flex: 1;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 400px;
`;

const TableHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
`;

const TableTitle = styled.div`
  font-weight: 600;
  font-size: 0.9rem;
  color: #374151;
`;

const TableActions = styled.div`
  display: flex;
  gap: 8px;
`;

const ActionButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid ${props => props.primary ? '#3b82f6' : '#e2e8f0'};
  border-radius: 6px;
  background: ${props => props.primary ? '#3b82f6' : 'white'};
  color: ${props => props.primary ? 'white' : '#374151'};
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.primary ? '#2563eb' : '#f1f5f9'};
  }
`;

const TableContainer = styled.div`
  flex: 1;
  overflow: auto;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
`;

const Th = styled.th`
  position: sticky;
  top: 0;
  background: #f1f5f9;
  padding: 10px 12px;
  text-align: left;
  font-weight: 600;
  color: #374151;
  border-bottom: 2px solid #e2e8f0;
  white-space: nowrap;
  min-width: ${props => props.width || 'auto'};

  &.required::after {
    content: ' *';
    color: #ef4444;
  }
`;

const Td = styled.td`
  padding: 8px 12px;
  border-bottom: 1px solid #e2e8f0;
  vertical-align: top;
`;

const Input = styled.input`
  width: 100%;
  padding: 8px 10px;
  border: 1px solid ${props => props.error ? '#ef4444' : '#e2e8f0'};
  border-radius: 4px;
  font-size: 0.85rem;
  color: #1e293b;
  background: ${props => props.error ? '#fef2f2' : 'white'};

  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  }

  &::placeholder {
    color: #94a3b8;
  }
`;

const DeleteButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  background: white;
  color: #ef4444;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #fef2f2;
    border-color: #ef4444;
  }
`;

const RowNumber = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: #e2e8f0;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
`;

const ModalFooter = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
`;

const FooterLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

const FooterRight = styled.div`
  display: flex;
  gap: 10px;
`;

const StatusText = styled.div`
  font-size: 0.85rem;
  color: #64748b;

  span {
    font-weight: 600;
    color: #3b82f6;
  }
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

const ErrorMessage = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  color: #dc2626;
  font-size: 0.85rem;
`;

const ColorSelect = styled.select`
  padding: 8px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 0.85rem;
  color: #1e293b;
  background: white;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: #3b82f6;
  }
`;

// 붙여넣기 모달 스타일
const PasteModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 3000;
`;

const PasteModalContainer = styled.div`
  background: white;
  border-radius: 12px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  width: 90%;
  max-width: 800px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
`;

const PasteModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  border-radius: 12px 12px 0 0;
`;

const PasteModalTitle = styled.h3`
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const PasteModalBody = styled.div`
  padding: 20px;
  flex: 1;
  overflow: auto;
`;

const PasteInstructions = styled.div`
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border: 1px solid #93c5fd;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;

  h4 {
    margin: 0 0 12px 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: #1e40af;
  }

  p {
    margin: 0;
    font-size: 0.85rem;
    color: #1e40af;
    line-height: 1.6;
  }

  kbd {
    background: white;
    border: 1px solid #93c5fd;
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 0.8rem;
    font-family: monospace;
  }
`;

const PasteTextArea = styled.textarea`
  width: 100%;
  min-height: 250px;
  padding: 12px;
  border: 2px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.875rem;
  font-family: 'Courier New', monospace;
  resize: vertical;
  line-height: 1.5;

  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  &::placeholder {
    color: #9ca3af;
  }
`;

const PasteModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
  border-radius: 0 0 12px 12px;
`;

const PasteButton = styled.button`
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 6px;

  &.cancel {
    background: white;
    color: #64748b;
    border: 1px solid #e2e8f0;

    &:hover {
      background: #f1f5f9;
    }
  }

  &.confirm {
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
`;

const createEmptyRow = () => ({
  이름: '',
  설명: '',
  색상: '',
  속성1_이름: '',
  속성1_값: '',
  속성2_이름: '',
  속성2_값: '',
  속성3_이름: '',
  속성3_값: '',
  속성4_이름: '',
  속성4_값: '',
  속성5_이름: '',
  속성5_값: '',
});

const BulkAddNodesModal = ({ isOpen, onClose, onAddNodes }) => {
  const { colors } = useColorSettings();
  const [rows, setRows] = useState([createEmptyRow()]);
  const [error, setError] = useState('');
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const textAreaRef = useRef(null);

  const handleAddRow = useCallback(() => {
    setRows(prev => [...prev, createEmptyRow()]);
  }, []);

  const handleDeleteRow = useCallback((index) => {
    setRows(prev => {
      if (prev.length === 1) {
        return [createEmptyRow()];
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleCellChange = useCallback((rowIndex, field, value) => {
    setRows(prev => {
      const newRows = [...prev];
      newRows[rowIndex] = { ...newRows[rowIndex], [field]: value };
      return newRows;
    });
    setError('');
  }, []);

  // 텍스트 파싱 함수
  const parseText = useCallback((text) => {
    if (!text.trim()) {
      return null;
    }

    const lines = text.trim().split('\n');
    const newRows = [];

    for (const line of lines) {
      const cells = line.split('\t');
      if (cells.length === 0 || (cells.length === 1 && !cells[0].trim())) {
        continue;
      }

      const row = createEmptyRow();
      const fields = [
        '이름', '설명', '색상',
        '속성1_이름', '속성1_값',
        '속성2_이름', '속성2_값',
        '속성3_이름', '속성3_값',
        '속성4_이름', '속성4_값',
        '속성5_이름', '속성5_값',
      ];

      cells.forEach((cell, idx) => {
        if (idx < fields.length) {
          row[fields[idx]] = cell.trim();
        }
      });

      newRows.push(row);
    }

    return newRows.length > 0 ? newRows : null;
  }, []);

  // 붙여넣기 모달 열기
  const handleOpenPasteModal = useCallback(() => {
    setIsPasteModalOpen(true);
    setPasteText('');
    setTimeout(() => {
      if (textAreaRef.current) {
        textAreaRef.current.focus();
      }
    }, 100);
  }, []);

  // 붙여넣기 모달 닫기
  const handleClosePasteModal = useCallback(() => {
    setIsPasteModalOpen(false);
    setPasteText('');
  }, []);

  // 모달에서 확인 버튼 클릭
  const handleConfirmPaste = useCallback(() => {
    const newRows = parseText(pasteText);
    if (newRows) {
      setRows(newRows);
      setError('');
      handleClosePasteModal();
    } else {
      setError('유효한 데이터가 없습니다.');
    }
  }, [pasteText, parseText, handleClosePasteModal]);

  const handleSubmit = useCallback(() => {
    const validRows = rows.filter(row => row.이름.trim());

    if (validRows.length === 0) {
      setError('최소 하나의 노드 이름을 입력해주세요.');
      return;
    }

    const nodes = validRows.map(row => {
      const attributes = [];
      for (let i = 1; i <= 5; i++) {
        const name = row[`속성${i}_이름`];
        const value = row[`속성${i}_값`];
        if (name && value) {
          attributes.push({ name, value });
        }
      }

      return {
        type: 'process',
        label: row.이름,
        description: row.설명,
        color: row.색상 || colors[0] || '#3b82f6',
        attributes,
        headerOnly: false,
        textAlign: 'left',
        headerTextColor: 'white',
      };
    });

    onAddNodes(nodes);
    handleClose();
  }, [rows, colors, onAddNodes]);

  const handleClose = useCallback(() => {
    setRows([createEmptyRow()]);
    setError('');
    onClose();
  }, [onClose]);

  const getValidRowCount = useCallback(() => {
    return rows.filter(row => row.이름.trim()).length;
  }, [rows]);

  if (!isOpen) return null;

  return (
    <>
      <Overlay onClick={handleClose}>
        <Modal onClick={(e) => e.stopPropagation()}>
          <ModalHeader>
            <ModalTitle>
              <Plus size={20} />
              여러 노드 추가
            </ModalTitle>
            <CloseButton onClick={handleClose}>
              <X size={20} />
            </CloseButton>
          </ModalHeader>

          <ModalBody>
            <InfoBox>
              <Info size={18} />
              <InfoContent>
                <strong>엑셀에서 붙여넣기:</strong> 엑셀에서 데이터를 복사(Ctrl+C)한 후 "엑셀 붙여넣기" 버튼을 클릭하세요.<br />
                <strong>열 순서:</strong> 이름, 설명, 색상(hex), 속성1_이름, 속성1_값, 속성2_이름, 속성2_값, ... (최대 5개 속성)
              </InfoContent>
            </InfoBox>

            {error && (
              <ErrorMessage>
                <AlertCircle size={16} />
                {error}
              </ErrorMessage>
            )}

            <TableWrapper>
              <TableHeader>
                <TableTitle>노드 목록</TableTitle>
                <TableActions>
                  <ActionButton onClick={handleOpenPasteModal} primary>
                    <ClipboardPaste size={14} />
                    엑셀 붙여넣기
                  </ActionButton>
                  <ActionButton onClick={handleAddRow}>
                    <Plus size={14} />
                    행 추가
                  </ActionButton>
                </TableActions>
              </TableHeader>

              <TableContainer>
                <Table>
                  <thead>
                    <tr>
                      <Th width="40px">#</Th>
                      <Th width="150px" className="required">이름</Th>
                      <Th width="200px">설명</Th>
                      <Th width="120px">색상</Th>
                      <Th width="100px">속성1 이름</Th>
                      <Th width="100px">속성1 값</Th>
                      <Th width="100px">속성2 이름</Th>
                      <Th width="100px">속성2 값</Th>
                      <Th width="100px">속성3 이름</Th>
                      <Th width="100px">속성3 값</Th>
                      <Th width="100px">속성4 이름</Th>
                      <Th width="100px">속성4 값</Th>
                      <Th width="100px">속성5 이름</Th>
                      <Th width="100px">속성5 값</Th>
                      <Th width="50px"></Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={index}>
                        <Td>
                          <RowNumber>{index + 1}</RowNumber>
                        </Td>
                        <Td>
                          <Input
                            type="text"
                            value={row.이름}
                            onChange={(e) => handleCellChange(index, '이름', e.target.value)}
                            placeholder="노드 이름"
                            error={!row.이름.trim() && rows.some(r => r.이름.trim())}
                          />
                        </Td>
                        <Td>
                          <Input
                            type="text"
                            value={row.설명}
                            onChange={(e) => handleCellChange(index, '설명', e.target.value)}
                            placeholder="설명"
                          />
                        </Td>
                        <Td>
                          <ColorSelect
                            value={row.색상}
                            onChange={(e) => handleCellChange(index, '색상', e.target.value)}
                          >
                            <option value="">기본 색상</option>
                            {colors.map((color, idx) => (
                              <option key={idx} value={color}>
                                {color}
                              </option>
                            ))}
                          </ColorSelect>
                        </Td>
                        {[1, 2, 3, 4, 5].map(num => (
                          <React.Fragment key={num}>
                            <Td>
                              <Input
                                type="text"
                                value={row[`속성${num}_이름`]}
                                onChange={(e) => handleCellChange(index, `속성${num}_이름`, e.target.value)}
                                placeholder="이름"
                              />
                            </Td>
                            <Td>
                              <Input
                                type="text"
                                value={row[`속성${num}_값`]}
                                onChange={(e) => handleCellChange(index, `속성${num}_값`, e.target.value)}
                                placeholder="값"
                              />
                            </Td>
                          </React.Fragment>
                        ))}
                        <Td>
                          <DeleteButton onClick={() => handleDeleteRow(index)}>
                            <Trash2 size={14} />
                          </DeleteButton>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableContainer>
            </TableWrapper>
          </ModalBody>

          <ModalFooter>
            <FooterLeft>
              <StatusText>
                총 <span>{rows.length}</span>행 / 유효한 노드 <span>{getValidRowCount()}</span>개
              </StatusText>
            </FooterLeft>
            <FooterRight>
              <Button className="secondary" onClick={handleClose}>
                취소
              </Button>
              <Button
                className="primary"
                onClick={handleSubmit}
                disabled={getValidRowCount() === 0}
              >
                {getValidRowCount()}개 노드 추가
              </Button>
            </FooterRight>
          </ModalFooter>
        </Modal>
      </Overlay>

      {/* 붙여넣기 모달 */}
      {isPasteModalOpen && (
        <PasteModalOverlay onClick={(e) => e.target === e.currentTarget && handleClosePasteModal()}>
          <PasteModalContainer>
            <PasteModalHeader>
              <PasteModalTitle>
                <Copy size={20} />
                엑셀 데이터 붙여넣기
              </PasteModalTitle>
              <CloseButton onClick={handleClosePasteModal}>
                <X size={20} />
              </CloseButton>
            </PasteModalHeader>

            <PasteModalBody>
              <PasteInstructions>
                <h4>📋 사용 방법</h4>
                <p>
                  <strong>1단계:</strong> 엑셀에서 데이터를 선택하고 <kbd>Ctrl+C</kbd> (또는 <kbd>Cmd+C</kbd>)로 복사하세요.<br/>
                  <strong>2단계:</strong> 아래 입력창을 클릭하고 <kbd>Ctrl+V</kbd> (또는 <kbd>Cmd+V</kbd>)로 붙여넣으세요.<br/>
                  <strong>3단계:</strong> "데이터 가져오기" 버튼을 클릭하세요.
                </p>
              </PasteInstructions>

              <PasteTextArea
                ref={textAreaRef}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="여기에 엑셀에서 복사한 데이터를 붙여넣으세요 (Ctrl+V)&#10;&#10;열 순서: 이름, 설명, 색상, 속성1_이름, 속성1_값, ..."
              />
            </PasteModalBody>

            <PasteModalFooter>
              <PasteButton className="cancel" onClick={handleClosePasteModal}>
                취소
              </PasteButton>
              <PasteButton
                className="confirm"
                onClick={handleConfirmPaste}
                disabled={!pasteText.trim()}
              >
                <Copy size={16} />
                데이터 가져오기
              </PasteButton>
            </PasteModalFooter>
          </PasteModalContainer>
        </PasteModalOverlay>
      )}
    </>
  );
};

export default BulkAddNodesModal;
