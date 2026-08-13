import React, { useState, useCallback, useRef } from 'react';
import styled from 'styled-components';
import { X, Plus, Trash2 } from 'lucide-react';

const Overlay = styled.div`
  position: fixed;
  inset: 0;
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
  width: 90vw;
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

const CloseButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: #64748b;
  display: flex;
  align-items: center;
  border-radius: 4px;
  &:hover { background: #e2e8f0; color: #1e293b; }
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

  td { vertical-align: top; }
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
  &:focus { background: #f0f9ff; }
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
  &:focus { background: #f0f9ff; }
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
  background: #e0f2fe;
  border: 1px solid #bae6fd;
  border-radius: 8px;
  font-size: 0.7rem;
  color: #0369a1;
  white-space: nowrap;
`;

const CellChipRemove = styled.button`
  display: inline-flex;
  align-items: center;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  color: #7dd3fc;
  &:hover { color: #0284c7; }
`;

const DeleteRowButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
  color: #cbd5e1;
  display: flex;
  align-items: center;
  border-radius: 4px;
  &:hover { color: #ef4444; background: #fef2f2; }
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
  &:hover { border-color: #0ea5e9; color: #0ea5e9; background: #f0f9ff; }
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
  &:hover { background: #f1f5f9; }
`;

const SaveButton = styled.button`
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  background: #0ea5e9;
  color: white;
  &:hover { background: #0284c7; }
  &:disabled { background: #94a3b8; cursor: not-allowed; }
`;

const COLUMNS = [
  { key: 'name', label: 'S/W 명', type: 'text' },
  { key: 'vendor', label: '벤더/개발사', type: 'text' },
  { key: 'category', label: '카테고리', type: 'chips' },
  { key: 'version', label: '버전', type: 'text' },
  { key: 'licenseType', label: '라이선스 유형', type: 'text' },
  { key: 'licenseNature', label: '라이선스 성격', type: 'nature' },
  { key: 'licenseCount', label: '보유 수', type: 'number' },
  { key: 'licenseUnit', label: '라이선스 단위', type: 'text' },
  { key: 'copyCount', label: '카피 수 (환산)', type: 'number' },
  { key: 'division', label: '담당 사업부', type: 'division' },
  { key: 'department', label: '담당 부서', type: 'text' },
  { key: 'usingDepartments', label: '사용 부서', type: 'chips' },
  { key: 'description', label: '상세 설명', type: 'text' },
];

const createEmptyRow = () => ({
  name: '',
  vendor: '',
  category: [],
  version: '',
  licenseType: '',
  licenseNature: 'base',
  licenseCount: 0,
  licenseUnit: '',
  copyCount: 0,
  division: '',
  department: '',
  usingDepartments: [],
  description: '',
});

const BulkAddModal = ({
  isOpen,
  onClose,
  onSave,
  divisions = [],
  categories = [],
  departments = [],
}) => {
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
    return found ? found.name : trimmed;
  }, [divisions]);

  const handlePaste = useCallback((e) => {
    const clipboardData = e.clipboardData.getData('text/plain');
    if (!clipboardData) return;

    const hasMultipleCells = clipboardData.includes('\t') || clipboardData.split('\n').filter(l => l.trim()).length > 1;
    if (!hasMultipleCells) return;

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

          if (col.type === 'chips') {
            // 쉼표로 구분된 다중 값
            const arr = value.split(',').map(s => s.trim()).filter(Boolean);
            value = arr;
          } else if (col.type === 'division') {
            value = matchDivision(value);
          } else if (col.type === 'nature') {
            const lower = value.toLowerCase();
            value = (lower.includes('add') || lower.includes('확장')) ? 'addon' : 'base';
          } else if (col.type === 'number') {
            value = parseInt(value) || 0;
          }

          next[targetRow] = { ...next[targetRow], [col.key]: value };
        });
      });

      return next;
    });
  }, [focusCell, matchDivision]);

  const handleSave = useCallback(() => {
    const validRows = rows.filter(r => r.name.trim());
    if (validRows.length === 0) return;
    onSave(validRows);
    handleReset();
  }, [rows, onSave, handleReset]);

  const handleOverlayClick = useCallback((e) => {
    if (e.target !== e.currentTarget) return;
    if (e.currentTarget._mouseDownTarget !== e.currentTarget) return;
    if (window.confirm('작성 중인 내용이 있습니다. 닫으시겠습니까?')) {
      handleClose();
    }
  }, [handleClose]);

  const validCount = rows.filter(r => r.name.trim()).length;

  if (!isOpen) return null;

  const renderCell = (row, rowIdx, col, colIdx) => {
    if (col.type === 'division') {
      return (
        <CellSelect
          value={row.division}
          onChange={e => handleCellChange(rowIdx, 'division', e.target.value)}
          onFocus={() => setFocusCell({ row: rowIdx, col: colIdx })}
        >
          <option value="">선택</option>
          {divisions.map(d => (
            <option key={d.id} value={d.name}>{d.name}</option>
          ))}
        </CellSelect>
      );
    }

    if (col.type === 'nature') {
      return (
        <CellSelect
          value={row.licenseNature}
          onChange={e => handleCellChange(rowIdx, 'licenseNature', e.target.value)}
          onFocus={() => setFocusCell({ row: rowIdx, col: colIdx })}
        >
          <option value="base">Base</option>
          <option value="addon">Add-on</option>
        </CellSelect>
      );
    }

    if (col.type === 'chips') {
      const items = row[col.key] || [];
      const optionList = col.key === 'category' ? categories : departments;
      return (
        <div onFocus={() => setFocusCell({ row: rowIdx, col: colIdx })}>
          {items.length > 0 && (
            <CellChipList>
              {items.map(name => (
                <CellChip key={name}>
                  {name}
                  <CellChipRemove onClick={() => {
                    handleCellChange(rowIdx, col.key, items.filter(n => n !== name));
                  }}>
                    <X size={10} />
                  </CellChipRemove>
                </CellChip>
              ))}
            </CellChipList>
          )}
          <CellSelect
            value=""
            onChange={e => {
              const val = e.target.value;
              if (val && !items.includes(val)) {
                handleCellChange(rowIdx, col.key, [...items, val]);
              }
            }}
          >
            <option value="">추가</option>
            {optionList
              .filter(o => !items.includes(o))
              .map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
          </CellSelect>
        </div>
      );
    }

    if (col.type === 'number') {
      return (
        <CellInput
          type="number"
          min="0"
          value={row[col.key]}
          onChange={e => handleCellChange(rowIdx, col.key, parseInt(e.target.value) || 0)}
          onFocus={() => setFocusCell({ row: rowIdx, col: colIdx })}
        />
      );
    }

    return (
      <CellInput
        type="text"
        value={row[col.key]}
        onChange={e => handleCellChange(rowIdx, col.key, e.target.value)}
        onFocus={() => setFocusCell({ row: rowIdx, col: colIdx })}
      />
    );
  };

  return (
    <Overlay
      onMouseDown={e => { e.currentTarget._mouseDownTarget = e.target; }}
      onClick={handleOverlayClick}
    >
      <Modal onClick={e => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>S/W 일괄 등록</ModalTitle>
          <CloseButton onClick={handleClose}>
            <X size={20} />
          </CloseButton>
        </ModalHeader>

        <TableWrapper>
          <HelpText>
            엑셀에서 복사한 데이터를 테이블에 붙여넣기(Ctrl+V)할 수 있습니다.
            컬럼 순서: S/W 명, 벤더/개발사, 카테고리, 버전, 라이선스 유형, 보유 수, 라이선스 단위, 담당 사업부, 담당 부서, 사용 부서, 상세 설명
            (카테고리·사용 부서는 쉼표로 구분)
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
                      {renderCell(row, rowIdx, col, colIdx)}
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
              등록 ({validCount}건)
            </SaveButton>
          </FooterRight>
        </ModalFooter>
      </Modal>
    </Overlay>
  );
};

export default BulkAddModal;
