import React, { useRef, useCallback, useState } from 'react';
import styled from 'styled-components';
import { Plus, Trash2, Copy, AlertCircle, X } from 'lucide-react';

const TableContainer = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: white;
`;

const TableHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
`;

const TableInfo = styled.div`
  h3 {
    margin: 0 0 0.25rem 0;
    font-size: 1rem;
    font-weight: 600;
    color: #1e293b;
  }

  p {
    margin: 0;
    font-size: 0.875rem;
    color: #64748b;
  }
`;

const TableActions = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const ActionButton = styled.button`
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  border: 1px solid;

  &.add {
    background: #10b981;
    color: white;
    border-color: #059669;

    &:hover {
      background: #059669;
      border-color: #047857;
    }
  }

  &.clear {
    background: #ef4444;
    color: white;
    border-color: #dc2626;

    &:hover {
      background: #dc2626;
      border-color: #b91c1c;
    }
  }

  &.paste {
    background: #3b82f6;
    color: white;
    border-color: #2563eb;

    &:hover {
      background: #2563eb;
      border-color: #1d4ed8;
    }
  }
`;

const TableWrapper = styled.div`
  flex: 1;
  overflow: auto;
  border: 1px solid #e2e8f0;
  border-top: none;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
`;

const TableHead = styled.thead`
  background: #f1f5f9;
  position: sticky;
  top: 0;
  z-index: 10;
`;

const TableBody = styled.tbody``;

const HeaderCell = styled.th`
  padding: 0.75rem 0.5rem;
  text-align: left;
  font-weight: 600;
  color: #374151;
  border-bottom: 2px solid #e2e8f0;
  border-right: 1px solid #e2e8f0;
  background: #f8fafc;
  white-space: nowrap;
  min-width: 120px;
  position: relative;

  &.required::after {
    content: '*';
    color: #ef4444;
    margin-left: 0.25rem;
  }

  &:last-child {
    border-right: none;
  }
`;

const TableRow = styled.tr`
  &:nth-child(even) {
    background: #f9fafb;
  }

  &:hover {
    background: #f3f4f6;
  }

  &.has-error {
    background: #fef2f2;

    &:hover {
      background: #fee2e2;
    }
  }
`;

const TableCell = styled.td`
  padding: 0.5rem;
  border-bottom: 1px solid #e2e8f0;
  border-right: 1px solid #e2e8f0;
  vertical-align: top;

  &:last-child {
    border-right: none;
  }

  &.actions {
    width: 60px;
    text-align: center;
  }
`;

const Input = styled.input`
  width: 100%;
  padding: 0.375rem 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  background: white;

  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  }

  &.error {
    border-color: #ef4444;
    background: #fef2f2;

    &:focus {
      border-color: #ef4444;
      box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.1);
    }
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 0.375rem 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  background: white;

  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  }

  &.error {
    border-color: #ef4444;
    background: #fef2f2;
  }
`;

const DeleteButton = styled.button`
  padding: 0.25rem;
  background: #fee2e2;
  color: #dc2626;
  border: 1px solid #fecaca;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: #fecaca;
    border-color: #fca5a5;
  }
`;

const ErrorText = styled.div`
  font-size: 0.75rem;
  color: #ef4444;
  margin-top: 0.25rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const RowNumber = styled.div`
  background: #f1f5f9;
  color: #64748b;
  text-align: center;
  font-weight: 500;
  font-size: 0.75rem;
  padding: 0.375rem 0.5rem;
  border-right: 1px solid #e2e8f0;
  min-width: 40px;
`;

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
  z-index: 10000;
`;

const PasteModalContainer = styled.div`
  background: white;
  border-radius: 0.75rem;
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
  padding: 1.25rem 1.5rem;
  border-bottom: 2px solid #e5e7eb;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  border-radius: 0.75rem 0.75rem 0 0;
`;

const PasteModalTitle = styled.h3`
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const PasteModalClose = styled.button`
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  border-radius: 0.5rem;
  padding: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: rgba(255, 255, 255, 0.3);
    border-color: rgba(255, 255, 255, 0.5);
  }
`;

const PasteModalBody = styled.div`
  padding: 1.5rem;
  flex: 1;
  overflow: auto;
`;

const PasteTextArea = styled.textarea`
  width: 100%;
  min-height: 300px;
  padding: 1rem;
  border: 2px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-family: 'Courier New', monospace;
  resize: vertical;

  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
`;

const PasteInstructions = styled.div`
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border: 1px solid #93c5fd;
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 1rem;

  h4 {
    margin: 0 0 0.5rem 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: #1e40af;
  }

  p {
    margin: 0;
    font-size: 0.8rem;
    color: #1e40af;
    line-height: 1.5;
  }

  ul {
    margin: 0.5rem 0 0 0;
    padding-left: 1.25rem;
    font-size: 0.8rem;
    color: #1e40af;
  }

  li {
    margin: 0.25rem 0;
  }
`;

const PasteModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 2px solid #e5e7eb;
  background: #f9fafb;
  border-radius: 0 0 0.75rem 0.75rem;
`;

const PasteButton = styled.button`
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid;

  &.confirm {
    background: #3b82f6;
    color: white;
    border-color: #2563eb;

    &:hover {
      background: #2563eb;
      border-color: #1d4ed8;
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
    }

    &:disabled {
      background: #9ca3af;
      border-color: #6b7280;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }
  }

  &.cancel {
    background: white;
    color: #6b7280;
    border-color: #d1d5db;

    &:hover {
      background: #f9fafb;
      border-color: #9ca3af;
      color: #374151;
    }
  }
`;

const BulkEditTable = ({ headers, data, onChange, errors = {}, title = 'Material', description = 'Material 데이터를 입력합니다' }) => {
  const tableRef = useRef(null);
  const containerRef = useRef(null);
  const textAreaRef = useRef(null);

  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const addRow = useCallback(() => {
    const newData = [...data, {}];
    onChange(newData);
  }, [data, onChange]);

  const deleteRow = useCallback((index) => {
    if (data.length <= 1) return;
    const newData = data.filter((_, i) => i !== index);
    onChange(newData);
  }, [data, onChange]);

  const clearAll = useCallback(() => {
    if (window.confirm('모든 데이터를 삭제하시겠습니까?')) {
      onChange([{}]);
    }
  }, [onChange]);

  const updateCell = useCallback((rowIndex, key, value) => {
    const newData = [...data];
    if (!newData[rowIndex]) {
      newData[rowIndex] = {};
    }

    const header = headers.find(h => h.key === key);
    if (header) {
      if (header.type === 'number') {
        newData[rowIndex][key] = value === '' ? '' : Number(value);
      } else if (header.type === 'boolean') {
        newData[rowIndex][key] = value === 'true' || value === true;
      } else {
        newData[rowIndex][key] = value;
      }
    } else {
      newData[rowIndex][key] = value;
    }

    onChange(newData);
  }, [data, onChange, headers]);

  const handleOpenPasteModal = useCallback(() => {
    setIsPasteModalOpen(true);
    setPasteText('');
    setTimeout(() => {
      if (textAreaRef.current) {
        textAreaRef.current.focus();
      }
    }, 100);
  }, []);

  const handleClosePasteModal = useCallback(() => {
    setIsPasteModalOpen(false);
    setPasteText('');
  }, []);

  const handleManualPaste = useCallback((text) => {
    try {
      if (!text || text.trim() === '') {
        alert('데이터가 비어있습니다.');
        return false;
      }

      const rows = text.trim().split('\n');
      const newData = [];

      rows.forEach(row => {
        const cells = row.split('\t');
        const rowData = {};

        headers.forEach((header, index) => {
          if (cells[index] !== undefined) {
            let value = cells[index].trim();

            if (header.type === 'number' && value !== '') {
              const numValue = Number(value);
              value = isNaN(numValue) ? value : numValue;
            } else if (header.type === 'boolean') {
              value = value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'yes' || value.toLowerCase() === 'y';
            }

            rowData[header.key] = value;
          }
        });

        if (Object.values(rowData).some(v => v !== '' && v !== null && v !== undefined)) {
          newData.push(rowData);
        }
      });

      if (newData.length > 0) {
        onChange(newData);
        alert(`${newData.length}개 행이 성공적으로 추가되었습니다.`);
        return true;
      } else {
        alert('사용 가능한 데이터가 없습니다.\n\n엑셀에서 데이터를 선택하고 Ctrl+C로 복사하여 다시 시도해주세요.');
        return false;
      }
    } catch (error) {
      console.error('수동 붙여넣기 실패:', error);
      alert('데이터 처리 중 오류가 발생했습니다.');
      return false;
    }
  }, [headers, onChange]);

  const handlePaste = useCallback(async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        try {
          const text = await navigator.clipboard.readText();
          if (text && text.trim()) {
            handleManualPaste(text);
            return;
          }
        } catch (clipboardError) {
          console.warn('Clipboard API 사용 불가:', clipboardError);
        }
      }
    } catch (error) {
      console.warn('Clipboard API 접근 실패:', error);
    }

    handleOpenPasteModal();
  }, [handleManualPaste, handleOpenPasteModal]);

  const handleConfirmPaste = useCallback(() => {
    if (handleManualPaste(pasteText)) {
      handleClosePasteModal();
    }
  }, [pasteText, handleManualPaste, handleClosePasteModal]);

  const handleKeyDown = useCallback((e) => {
    if (isPasteModalOpen) {
      return;
    }

    if (e.ctrlKey && e.key === 'v') {
      e.preventDefault();
      handlePaste();
    }
  }, [handlePaste, isPasteModalOpen]);

  const renderInput = (header, value, rowIndex) => {
    const hasError = errors[rowIndex] && errors[rowIndex][header.key];
    const commonProps = {
      value: value || '',
      onChange: (e) => updateCell(rowIndex, header.key, e.target.value),
      className: hasError ? 'error' : ''
    };

    if (header.type === 'boolean') {
      return (
        <Select {...commonProps} value={value === true ? 'true' : value === false ? 'false' : ''}>
          <option value="">선택</option>
          <option value="true">예</option>
          <option value="false">아니오</option>
        </Select>
      );
    }

    if (header.options && header.options.length > 0) {
      return (
        <Select {...commonProps}>
          <option value="">{header.placeholder || '선택'}</option>
          {header.options.map((opt, idx) => (
            <option key={idx} value={opt}>{opt}</option>
          ))}
        </Select>
      );
    }

    return (
      <Input
        {...commonProps}
        type={header.type === 'number' ? 'number' : 'text'}
        placeholder={header.placeholder || (header.required ? '필수' : '선택')}
      />
    );
  };

  return (
    <TableContainer
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{ outline: 'none' }}
    >
      <TableHeader>
        <TableInfo>
          <h3>{title}</h3>
          <p>{description}</p>
        </TableInfo>
        <TableActions>
          <ActionButton className="paste" onClick={handlePaste} title="엑셀에서 복사한 데이터를 붙여넣습니다">
            <Copy size={14} strokeWidth={2} />
            엑셀 붙여넣기
          </ActionButton>
          <ActionButton className="add" onClick={addRow}>
            <Plus size={14} strokeWidth={2} />
            행 추가
          </ActionButton>
          <ActionButton className="clear" onClick={clearAll}>
            <Trash2 size={14} strokeWidth={2} />
            전체 삭제
          </ActionButton>
        </TableActions>
      </TableHeader>

      <TableWrapper>
        <Table ref={tableRef}>
          <TableHead>
            <tr>
              <HeaderCell style={{ width: '50px', minWidth: '50px' }}>#</HeaderCell>
              {headers.map(header => (
                <HeaderCell
                  key={header.key}
                  className={header.required ? 'required' : ''}
                  style={header.width ? { width: header.width, minWidth: header.width } : {}}
                >
                  {header.label}
                </HeaderCell>
              ))}
              <HeaderCell style={{ width: '60px', minWidth: '60px' }}>삭제</HeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {data.map((row, rowIndex) => {
              const hasRowError = errors && errors[rowIndex] && Object.keys(errors[rowIndex]).length > 0;

              return (
                <TableRow key={rowIndex} className={hasRowError ? 'has-error' : ''}>
                  <TableCell>
                    <RowNumber>{rowIndex + 1}</RowNumber>
                  </TableCell>
                  {headers.map(header => {
                    const hasError = errors && errors[rowIndex] && errors[rowIndex][header.key];
                    return (
                      <TableCell key={header.key}>
                        {renderInput(header, row[header.key], rowIndex)}
                        {hasError && (
                          <ErrorText>
                            <AlertCircle size={12} strokeWidth={2} />
                            {hasError}
                          </ErrorText>
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell className="actions">
                    {data.length > 1 && (
                      <DeleteButton onClick={() => deleteRow(rowIndex)}>
                        <Trash2 size={14} strokeWidth={2} />
                      </DeleteButton>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableWrapper>

      {isPasteModalOpen && (
        <PasteModalOverlay onClick={(e) => e.target === e.currentTarget && handleClosePasteModal()}>
          <PasteModalContainer>
            <PasteModalHeader>
              <PasteModalTitle>
                <Copy size={20} strokeWidth={2} />
                엑셀 데이터 붙여넣기
              </PasteModalTitle>
              <PasteModalClose onClick={handleClosePasteModal}>
                <X size={20} strokeWidth={2} />
              </PasteModalClose>
            </PasteModalHeader>

            <PasteModalBody>
              <PasteInstructions>
                <h4>사용 방법</h4>
                <p>
                  <strong>1단계:</strong> 엑셀에서 데이터를 선택하고 <kbd>Ctrl+C</kbd>로 복사하세요.<br/>
                  <strong>2단계:</strong> 아래 입력창을 클릭하고 <kbd>Ctrl+V</kbd>로 붙여넣으세요.<br/>
                  <strong>3단계:</strong> "데이터 가져오기" 버튼을 클릭하세요.
                </p>
                <ul>
                  <li>탭으로 구분된 데이터를 자동으로 인식합니다</li>
                  <li>엑셀 복사 형식 그대로 사용 가능합니다</li>
                </ul>
              </PasteInstructions>

              <PasteTextArea
                ref={textAreaRef}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="여기에 엑셀 데이터를 붙여넣으세요 (Ctrl+V)..."
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
                <Copy size={16} strokeWidth={2} />
                데이터 가져오기
              </PasteButton>
            </PasteModalFooter>
          </PasteModalContainer>
        </PasteModalOverlay>
      )}
    </TableContainer>
  );
};

export default BulkEditTable;
