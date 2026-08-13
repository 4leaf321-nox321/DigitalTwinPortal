import React, { useState, useCallback, useRef } from 'react';
import styled from 'styled-components';
import { X, Plus, Trash2, XCircle } from 'lucide-react';

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
  width: 80vw;
  height: 80vh;
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

const HeaderRight = styled.div`
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

const TableWrapper = styled.div`
  flex: 1;
  overflow: auto;
  padding: 16px 20px;
`;

const HelpText = styled.div`
  font-size: 0.78rem;
  color: #94a3b8;
  margin-bottom: 12px;
`;

const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;

  th, td {
    border: 1px solid #e2e8f0;
    padding: 6px 8px;
    text-align: left;
  }

  th {
    background: #f1f5f9;
    font-weight: 600;
    color: #475569;
    position: sticky;
    top: 0;
    z-index: 1;
    white-space: nowrap;
  }

  td {
    vertical-align: top;
  }
`;

const CellInput = styled.input`
  width: 100%;
  border: none;
  outline: none;
  padding: 2px 0;
  font-size: 0.82rem;
  color: #1e293b;
  background: transparent;
  box-sizing: border-box;

  &:focus {
    background: #f0fdfa;
  }
`;

const CellSelect = styled.select`
  width: 100%;
  border: none;
  outline: none;
  padding: 2px 0;
  font-size: 0.82rem;
  color: #1e293b;
  background: transparent;
  cursor: pointer;

  &:focus {
    background: #f0fdfa;
  }
`;

const CellChipList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  margin-bottom: 2px;
`;

const CellChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 5px;
  background: #ecfeff;
  border: 1px solid #a5f3fc;
  border-radius: 8px;
  font-size: 0.7rem;
  color: #0e7490;
  white-space: nowrap;
`;

const CellChipRemove = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  color: #67e8f9;
  font-size: 0.65rem;
  line-height: 1;

  &:hover {
    color: #0891b2;
  }
`;

const DeleteRowButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
  color: #cbd5e1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;

  &:hover {
    color: #ef4444;
    background: #fef2f2;
  }
`;

const ModalFooter = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
`;

const AddRowButton = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: 1px dashed #cbd5e1;
  border-radius: 6px;
  background: white;
  color: #64748b;
  font-size: 0.8rem;
  cursor: pointer;

  &:hover {
    border-color: #06b6d4;
    color: #06b6d4;
    background: #ecfeff;
  }
`;

const FooterRight = styled.div`
  display: flex;
  gap: 10px;
`;

const CancelButton = styled.button`
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid #e2e8f0;
  background: white;
  color: #64748b;

  &:hover {
    background: #f1f5f9;
  }
`;

const SaveButton = styled.button`
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  background: #06b6d4;
  color: white;

  &:hover {
    background: #0891b2;
  }

  &:disabled {
    background: #94a3b8;
    cursor: not-allowed;
  }
`;

const COLUMNS = [
  { key: 'name', label: '과제명', type: 'text' },
  { key: 'divisionId', label: '사업부', type: 'division' },
  { key: 'testItem', label: '항목', type: 'text' },
  { key: 'testItemDetail', label: '항목 상세', type: 'text' },
  { key: 'category', label: '구분', type: 'category' },
  { key: 'productFamily', label: '적용 제품군', type: 'productFamily' },
  { key: 'year', label: '연도', type: 'text' },
  { key: 'status', label: '상태', type: 'status' },
  { key: 'description', label: '설명', type: 'text' },
];

const createEmptyRow = () => ({
  name: '',
  divisionId: '',
  testItem: '',
  testItemDetail: '',
  category: '',
  productFamily: [],
  year: '',
  status: '',
  description: '',
});

const BulkAddModal = ({ isOpen, onClose, onSave, divisions, categories, statuses, productFamilies = [] }) => {
  const [rows, setRows] = useState(() => Array.from({ length: 5 }, createEmptyRow));
  const [focusCell, setFocusCell] = useState({ row: 0, col: 0 });
  const tableRef = useRef(null);

  const handleReset = useCallback(() => {
    setRows(Array.from({ length: 5 }, createEmptyRow));
    setFocusCell({ row: 0, col: 0 });
  }, []);

  const handleClose = useCallback(() => {
    handleReset();
    onClose();
  }, [onClose, handleReset]);

  const handleCellChange = useCallback((rowIdx, key, value) => {
    setRows(prev => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], [key]: value };
      return next;
    });
  }, []);

  const handleDeleteRow = useCallback((rowIdx) => {
    setRows(prev => {
      if (prev.length <= 1) return [createEmptyRow()];
      return prev.filter((_, i) => i !== rowIdx);
    });
  }, []);

  const handleAddRow = useCallback(() => {
    setRows(prev => [...prev, createEmptyRow()]);
  }, []);

  const matchDivision = useCallback((text) => {
    const trimmed = text.trim();
    if (!trimmed) return '';
    const found = divisions.find(d => d.name === trimmed);
    return found ? found.id : '';
  }, [divisions]);

  const matchCategory = useCallback((text) => {
    const trimmed = text.trim();
    if (!trimmed) return '';
    return categories.includes(trimmed) ? trimmed : '';
  }, [categories]);

  const matchStatus = useCallback((text) => {
    const trimmed = text.trim();
    if (!trimmed) return '';
    return statuses.includes(trimmed) ? trimmed : '';
  }, [statuses]);

  const matchProductFamily = useCallback((text, divisionId) => {
    const trimmed = text.trim();
    if (!trimmed) return [];
    // 쉼표로 구분된 여러 제품군 지원, 사업부 기준 필터
    const names = trimmed.split(',').map(s => s.trim()).filter(Boolean);
    return names.filter(n => productFamilies.some(pf =>
      pf.name === n && (!divisionId || pf.divisionId === divisionId)
    ));
  }, [productFamilies]);

  const handlePaste = useCallback((e) => {
    const clipboardData = e.clipboardData.getData('text/plain');
    if (!clipboardData) return;

    // Check if it's multi-cell data (contains tabs or multiple lines)
    const hasMultipleCells = clipboardData.includes('\t') || clipboardData.split('\n').filter(l => l.trim()).length > 1;
    if (!hasMultipleCells) return; // Let native paste handle single-cell

    e.preventDefault();

    const pastedRows = clipboardData
      .split('\n')
      .map(line => line.replace(/\r$/, ''))
      .filter(line => line.length > 0)
      .map(line => line.split('\t'));

    if (pastedRows.length === 0) return;

    setRows(prev => {
      const startRow = focusCell.row;
      const startCol = focusCell.col;
      const totalRowsNeeded = startRow + pastedRows.length;
      let next = [...prev];

      // Add rows if needed
      while (next.length < totalRowsNeeded) {
        next.push(createEmptyRow());
      }

      pastedRows.forEach((cells, ri) => {
        const targetRow = startRow + ri;
        cells.forEach((cellValue, ci) => {
          const targetColIdx = startCol + ci;
          if (targetColIdx >= COLUMNS.length) return;
          const col = COLUMNS[targetColIdx];

          let value = cellValue.trim();
          if (col.type === 'division') {
            value = matchDivision(value);
          } else if (col.type === 'category') {
            value = matchCategory(value);
          } else if (col.type === 'productFamily') {
            value = matchProductFamily(value, next[targetRow].divisionId);
          } else if (col.type === 'status') {
            value = matchStatus(value);
          }

          next[targetRow] = { ...next[targetRow], [col.key]: value };
        });
      });

      return next;
    });
  }, [focusCell, matchDivision, matchCategory, matchStatus, matchProductFamily]);

  const handleSave = useCallback(() => {
    const validRows = rows.filter(r => r.name.trim());
    if (validRows.length === 0) return;
    onSave(validRows);
    handleReset();
  }, [rows, onSave, handleReset]);

  const validCount = rows.filter(r => r.name.trim()).length;

  if (!isOpen) return null;

  return (
    <Overlay onClick={handleClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>여러 과제 추가</ModalTitle>
          <HeaderRight>
            <CloseButton onClick={handleClose}>
              <X size={20} />
            </CloseButton>
          </HeaderRight>
        </ModalHeader>

        <TableWrapper>
          <HelpText>
            엑셀에서 복사한 데이터를 테이블에 붙여넣기(Ctrl+V)할 수 있습니다.
            컬럼 순서: 과제명, 사업부, 항목, 항목 상세, 구분, 적용 제품군, 연도, 상태, 설명
          </HelpText>
          <StyledTable ref={tableRef} onPaste={handlePaste}>
            <thead>
              <tr>
                <th style={{ width: '36px' }}>#</th>
                {COLUMNS.map(col => (
                  <th key={col.key}>{col.label}</th>
                ))}
                <th style={{ width: '36px' }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  <td style={{ color: '#94a3b8', textAlign: 'center', fontSize: '0.75rem' }}>
                    {rowIdx + 1}
                  </td>
                  {COLUMNS.map((col, colIdx) => (
                    <td key={col.key}>
                      {col.type === 'division' ? (
                        <CellSelect
                          value={row.divisionId}
                          onChange={(e) => handleCellChange(rowIdx, 'divisionId', e.target.value)}
                          onFocus={() => setFocusCell({ row: rowIdx, col: colIdx })}
                        >
                          <option value="">선택</option>
                          {divisions.map(div => (
                            <option key={div.id} value={div.id}>{div.name}</option>
                          ))}
                        </CellSelect>
                      ) : col.type === 'category' ? (
                        <CellSelect
                          value={row.category}
                          onChange={(e) => handleCellChange(rowIdx, 'category', e.target.value)}
                          onFocus={() => setFocusCell({ row: rowIdx, col: colIdx })}
                        >
                          <option value="">선택</option>
                          {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </CellSelect>
                      ) : col.type === 'productFamily' ? (
                        <div onFocus={() => setFocusCell({ row: rowIdx, col: colIdx })}>
                          {row.productFamily.length > 0 && (
                            <CellChipList>
                              {row.productFamily.map(name => (
                                <CellChip key={name}>
                                  {name}
                                  <CellChipRemove onClick={() => {
                                    handleCellChange(rowIdx, 'productFamily', row.productFamily.filter(n => n !== name));
                                  }}>
                                    <X size={10} />
                                  </CellChipRemove>
                                </CellChip>
                              ))}
                            </CellChipList>
                          )}
                          <CellSelect
                            value=""
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val && !row.productFamily.includes(val)) {
                                handleCellChange(rowIdx, 'productFamily', [...row.productFamily, val]);
                              }
                            }}
                          >
                            <option value="">추가</option>
                            {productFamilies
                              .filter(pf => !row.divisionId || pf.divisionId === row.divisionId)
                              .filter(pf => !row.productFamily.includes(pf.name))
                              .map(pf => (
                                <option key={pf.name} value={pf.name}>{pf.name}</option>
                              ))}
                          </CellSelect>
                        </div>
                      ) : col.type === 'status' ? (
                        <CellSelect
                          value={row.status}
                          onChange={(e) => handleCellChange(rowIdx, 'status', e.target.value)}
                          onFocus={() => setFocusCell({ row: rowIdx, col: colIdx })}
                        >
                          <option value="">선택</option>
                          {statuses.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </CellSelect>
                      ) : (
                        <CellInput
                          type="text"
                          value={row[col.key]}
                          onChange={(e) => handleCellChange(rowIdx, col.key, e.target.value)}
                          onFocus={() => setFocusCell({ row: rowIdx, col: colIdx })}
                        />
                      )}
                    </td>
                  ))}
                  <td>
                    <DeleteRowButton onClick={() => handleDeleteRow(rowIdx)} title="행 삭제">
                      <Trash2 size={14} />
                    </DeleteRowButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </StyledTable>
        </TableWrapper>

        <ModalFooter>
          <AddRowButton onClick={handleAddRow}>
            <Plus size={14} />
            행 추가
          </AddRowButton>
          <FooterRight>
            <CancelButton onClick={handleClose}>취소</CancelButton>
            <SaveButton onClick={handleSave} disabled={validCount === 0}>
              추가 ({validCount}건)
            </SaveButton>
          </FooterRight>
        </ModalFooter>
      </Modal>
    </Overlay>
  );
};

export default BulkAddModal;
