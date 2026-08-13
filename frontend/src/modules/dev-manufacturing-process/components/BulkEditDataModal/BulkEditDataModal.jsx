import React, { useState, useCallback, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { X, Save, ClipboardPaste, Info, AlertCircle, Copy, ClipboardCopy } from 'lucide-react';
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
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
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
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border: 1px solid #f59e0b;
  border-radius: 8px;
  padding: 12px 16px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 0.85rem;
  color: #92400e;

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
  border: 1px solid ${props => props.primary ? '#f59e0b' : '#e2e8f0'};
  border-radius: 6px;
  background: ${props => props.primary ? '#f59e0b' : 'white'};
  color: ${props => props.primary ? 'white' : '#374151'};
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.primary ? '#d97706' : '#f1f5f9'};
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
  background: ${props => props.error ? '#fef2f2' : props.modified ? '#fefce8' : 'white'};

  &:focus {
    outline: none;
    border-color: #f59e0b;
    box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.1);
  }

  &::placeholder {
    color: #94a3b8;
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
    color: #f59e0b;
  }
`;

const Button = styled.button`
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 6px;

  &.primary {
    background: #f59e0b;
    color: white;
    border: none;

    &:hover {
      background: #d97706;
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
  background: ${props => props.modified ? '#fefce8' : 'white'};
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: #f59e0b;
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #64748b;
  text-align: center;

  svg {
    margin-bottom: 16px;
    color: #94a3b8;
  }

  h4 {
    margin: 0 0 8px 0;
    font-size: 1rem;
    color: #374151;
  }

  p {
    margin: 0;
    font-size: 0.875rem;
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
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
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
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border: 1px solid #f59e0b;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;

  h4 {
    margin: 0 0 12px 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: #92400e;
  }

  p {
    margin: 0;
    font-size: 0.85rem;
    color: #92400e;
    line-height: 1.6;
  }

  kbd {
    background: white;
    border: 1px solid #f59e0b;
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
    border-color: #f59e0b;
    box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1);
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
    background: #f59e0b;
    color: white;
    border: none;

    &:hover {
      background: #d97706;
    }

    &:disabled {
      background: #94a3b8;
      cursor: not-allowed;
    }
  }
`;

const BulkEditDataModal = ({ isOpen, onClose, nodes, onSave }) => {
  const { colors } = useColorSettings();
  const [rows, setRows] = useState([]);
  const [originalRows, setOriginalRows] = useState([]);
  const [error, setError] = useState('');
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const textAreaRef = useRef(null);

  // 노드 데이터를 테이블 행으로 변환
  useEffect(() => {
    if (isOpen && nodes && nodes.length > 0) {
      const processNodes = nodes.filter(n => n.type === 'process');
      const tableRows = processNodes.map(node => {
        const data = node.data || {};
        const attributes = data.attributes || [];

        return {
          id: node.id,
          이름: data.label || '',
          설명: data.description || '',
          색상: data.color || '',
          속성1_이름: attributes[0]?.name || '',
          속성1_값: attributes[0]?.value || '',
          속성2_이름: attributes[1]?.name || '',
          속성2_값: attributes[1]?.value || '',
          속성3_이름: attributes[2]?.name || '',
          속성3_값: attributes[2]?.value || '',
          속성4_이름: attributes[3]?.name || '',
          속성4_값: attributes[3]?.value || '',
          속성5_이름: attributes[4]?.name || '',
          속성5_값: attributes[4]?.value || '',
        };
      });
      setRows(tableRows);
      setOriginalRows(JSON.parse(JSON.stringify(tableRows)));
    }
  }, [isOpen, nodes]);

  const handleCellChange = useCallback((rowIndex, field, value) => {
    setRows(prev => {
      const newRows = [...prev];
      newRows[rowIndex] = { ...newRows[rowIndex], [field]: value };
      return newRows;
    });
    setError('');
  }, []);

  // 변경 여부 확인
  const isModified = useCallback((rowIndex, field) => {
    if (!originalRows[rowIndex]) return false;
    return rows[rowIndex]?.[field] !== originalRows[rowIndex]?.[field];
  }, [rows, originalRows]);

  // 변경된 행 수 계산
  const getModifiedCount = useCallback(() => {
    let count = 0;
    rows.forEach((row, index) => {
      const original = originalRows[index];
      if (!original) return;

      const fields = ['이름', '설명', '색상', '속성1_이름', '속성1_값', '속성2_이름', '속성2_값', '속성3_이름', '속성3_값', '속성4_이름', '속성4_값', '속성5_이름', '속성5_값'];
      const hasChange = fields.some(field => row[field] !== original[field]);
      if (hasChange) count++;
    });
    return count;
  }, [rows, originalRows]);

  // 대체 클립보드 복사 방법
  const fallbackCopyToClipboard = useCallback((text) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand('copy');
      if (successful) {
        alert('클립보드에 복사되었습니다.\n엑셀에서 Ctrl+V로 붙여넣기 할 수 있습니다.');
      } else {
        alert('클립보드 복사에 실패했습니다.');
      }
    } catch (err) {
      alert('클립보드 복사에 실패했습니다.');
    }

    document.body.removeChild(textArea);
  }, []);

  // 클립보드 복사 (엑셀 호환)
  const handleExportToClipboard = useCallback(() => {
    const headers = ['이름', '설명', '색상', '속성1_이름', '속성1_값', '속성2_이름', '속성2_값', '속성3_이름', '속성3_값', '속성4_이름', '속성4_값', '속성5_이름', '속성5_값'];
    const headerRow = headers.join('\t');
    const dataRows = rows.map(row => {
      return headers.map(h => row[h] || '').join('\t');
    });
    const text = [headerRow, ...dataRows].join('\n');

    // navigator.clipboard이 없는 환경(HTTP)에서는 대체 방법 사용
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        alert('클립보드에 복사되었습니다.\n엑셀에서 Ctrl+V로 붙여넣기 할 수 있습니다.');
      }).catch(() => {
        fallbackCopyToClipboard(text);
      });
    } else {
      fallbackCopyToClipboard(text);
    }
  }, [rows, fallbackCopyToClipboard]);

  // 텍스트 파싱 함수
  const parseText = useCallback((text) => {
    if (!text.trim()) {
      return null;
    }

    const lines = text.trim().split('\n');
    const newRows = [];

    // 첫 줄이 헤더인지 확인 (이름, 설명 등이 포함되어 있으면 헤더로 간주)
    let startIndex = 0;
    if (lines[0].includes('이름') && lines[0].includes('설명')) {
      startIndex = 1;
    }

    for (let i = startIndex; i < lines.length; i++) {
      const cells = lines[i].split('\t');
      if (cells.length === 0 || (cells.length === 1 && !cells[0].trim())) {
        continue;
      }

      // 기존 행 인덱스 계산 (헤더 제외)
      const rowIndex = newRows.length;
      const existingRow = rows[rowIndex];

      const row = existingRow ? { ...existingRow } : {
        id: `new-${Date.now()}-${rowIndex}`,
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
      };

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
  }, [rows]);

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
    // 유효성 검사 - 이름이 비어있는 행 확인
    const invalidRows = rows.filter(row => !row.이름.trim());
    if (invalidRows.length > 0) {
      setError('모든 노드에 이름이 필요합니다.');
      return;
    }

    // 노드 업데이트 데이터 생성
    const updates = rows.map(row => {
      const attributes = [];
      for (let i = 1; i <= 5; i++) {
        const name = row[`속성${i}_이름`];
        const value = row[`속성${i}_값`];
        if (name && value) {
          attributes.push({ name, value });
        }
      }

      return {
        id: row.id,
        data: {
          label: row.이름,
          description: row.설명,
          color: row.색상 || colors[0] || '#3b82f6',
          attributes,
        },
      };
    });

    onSave(updates);
    handleClose();
  }, [rows, colors, onSave]);

  const handleClose = useCallback(() => {
    setRows([]);
    setOriginalRows([]);
    setError('');
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <>
      <Overlay onClick={handleClose}>
        <Modal onClick={(e) => e.stopPropagation()}>
          <ModalHeader>
            <ModalTitle>
              <Save size={20} />
              여러 데이터 일괄 수정
            </ModalTitle>
            <CloseButton onClick={handleClose}>
              <X size={20} />
            </CloseButton>
          </ModalHeader>

          <ModalBody>
            <InfoBox>
              <Info size={18} />
              <InfoContent>
                <strong>현재 다이어그램의 모든 노드 데이터를 표로 불러왔습니다.</strong><br />
                각 셀을 직접 수정하거나, 엑셀에서 복사한 데이터를 붙여넣을 수 있습니다. 수정된 셀은 노란색으로 표시됩니다.
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
                <TableTitle>노드 목록 ({rows.length}개)</TableTitle>
                <TableActions>
                  <ActionButton onClick={handleExportToClipboard} title="클립보드 복사">
                    <ClipboardCopy size={14} />
                    클립보드 복사
                  </ActionButton>
                  <ActionButton onClick={handleOpenPasteModal} primary>
                    <ClipboardPaste size={14} />
                    엑셀 붙여넣기
                  </ActionButton>
                </TableActions>
              </TableHeader>

              <TableContainer>
                {rows.length === 0 ? (
                  <EmptyState>
                    <Info size={48} />
                    <h4>수정할 노드가 없습니다</h4>
                    <p>다이어그램에 노드를 먼저 추가해주세요.</p>
                  </EmptyState>
                ) : (
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
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, index) => (
                        <tr key={row.id}>
                          <Td>
                            <RowNumber>{index + 1}</RowNumber>
                          </Td>
                          <Td>
                            <Input
                              type="text"
                              value={row.이름}
                              onChange={(e) => handleCellChange(index, '이름', e.target.value)}
                              placeholder="노드 이름"
                              error={!row.이름.trim()}
                              modified={isModified(index, '이름')}
                            />
                          </Td>
                          <Td>
                            <Input
                              type="text"
                              value={row.설명}
                              onChange={(e) => handleCellChange(index, '설명', e.target.value)}
                              placeholder="설명"
                              modified={isModified(index, '설명')}
                            />
                          </Td>
                          <Td>
                            <ColorSelect
                              value={row.색상}
                              onChange={(e) => handleCellChange(index, '색상', e.target.value)}
                              modified={isModified(index, '색상')}
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
                                  modified={isModified(index, `속성${num}_이름`)}
                                />
                              </Td>
                              <Td>
                                <Input
                                  type="text"
                                  value={row[`속성${num}_값`]}
                                  onChange={(e) => handleCellChange(index, `속성${num}_값`, e.target.value)}
                                  placeholder="값"
                                  modified={isModified(index, `속성${num}_값`)}
                                />
                              </Td>
                            </React.Fragment>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </TableContainer>
            </TableWrapper>
          </ModalBody>

          <ModalFooter>
            <FooterLeft>
              <StatusText>
                총 <span>{rows.length}</span>개 노드 / 수정됨 <span>{getModifiedCount()}</span>개
              </StatusText>
            </FooterLeft>
            <FooterRight>
              <Button className="secondary" onClick={handleClose}>
                취소
              </Button>
              <Button
                className="primary"
                onClick={handleSubmit}
                disabled={rows.length === 0}
              >
                <Save size={16} />
                변경사항 저장
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
                  <strong>3단계:</strong> "데이터 가져오기" 버튼을 클릭하세요.<br/><br/>
                  <strong>주의:</strong> 기존 노드 순서에 맞게 데이터가 덮어씌워집니다.
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

export default BulkEditDataModal;
