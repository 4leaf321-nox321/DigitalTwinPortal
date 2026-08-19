import React, { useCallback, useState } from 'react';
import styled from 'styled-components';
import { X, Plus, Trash2 } from 'lucide-react';
import {
  Overlay, Modal, ModalHeader, ModalTitle, CloseButton,
  ModalFooter, FooterRight, HelpText, CancelButton, SaveButton,
} from './modalStyles';
import { CATEGORY1_OPTIONS, COLUMNS, EMPTY_INVESTMENT, departmentsFor } from '../constants';

const TableWrapper = styled.div`
  flex: 1;
  overflow: auto;
  padding: 12px 20px 16px;
`;

const PasteHint = styled.div`
  font-size: 0.78rem;
  color: #94a3b8;
  margin-bottom: 10px;
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
`;

const cellStyle = `
  width: 100%;
  border: none;
  outline: none;
  padding: 2px 0;
  font-size: 0.82rem;
  color: #1e293b;
  background: transparent;
  box-sizing: border-box;
  &:focus { background: #eef2ff; }
`;

const CellInput = styled.input`${cellStyle}`;
const CellSelect = styled.select`${cellStyle} cursor: pointer;`;

const RowNumber = styled.td`
  width: 34px;
  text-align: center !important;
  color: #94a3b8;
  background: #f8fafc;
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
  &:hover { border-color: #4f46e5; color: #4338ca; background: #eef2ff; }
`;

const INITIAL_ROW_COUNT = 5;
const createEmptyRow = () => ({ ...EMPTY_INVESTMENT });

/**
 * 붙여넣은 문자열 한 칸을 그 열의 형식에 맞춰 다듬는다.
 * optionsFor 는 그 행의 상태에 따라 달라지는 선택지를 돌려준다 —
 * 투자부서가 사업부에 따라 갈리기 때문이다.
 */
const coerceCell = (col, raw, optionsFor) => {
  const text = raw.trim();
  if (col.type === 'amount') {
    // "1.5억원", "1,200" 처럼 단위나 자릿점이 붙어 와도 숫자만 건진다.
    const num = parseFloat(text.replace(/[^0-9.-]/g, ''));
    return Number.isNaN(num) ? '' : num;
  }
  if (col.type === 'year') {
    const num = parseInt(text.replace(/[^0-9]/g, ''), 10);
    return Number.isNaN(num) ? '' : num;
  }
  if (col.type === 'text') return text;
  // 선택형 열은 목록에 있는 값만 받는다 — 오타가 그대로 들어와 쌓이는 걸 막는다.
  return optionsFor(col.type).includes(text) ? text : '';
};

const BulkAddModal = ({
  isOpen,
  onClose,
  onSave,
  divisions = [],
  processes = [],
  departments = [],
  departmentsByDivision = {},
  category2Options = [],
}) => {
  const [rows, setRows] = useState(() => Array.from({ length: INITIAL_ROW_COUNT }, createEmptyRow));
  const [focusCell, setFocusCell] = useState({ row: 0, col: 0 });

  // 투자부서만 행마다 다르다 — 그 행에서 고른 사업부에 딸린 것만 보여 준다.
  const optionsFor = (type, row) => {
    if (type === 'department') return departmentsFor(row?.division, departments, departmentsByDivision);
    return {
      division: divisions,
      process: processes,
      category1: CATEGORY1_OPTIONS,
      category2: category2Options,
    }[type] || [];
  };

  const reset = useCallback(() => {
    setRows(Array.from({ length: INITIAL_ROW_COUNT }, createEmptyRow));
    setFocusCell({ row: 0, col: 0 });
  }, []);

  const handleClose = useCallback(() => { reset(); onClose(); }, [reset, onClose]);

  const handleCellChange = useCallback((rowIdx, key, value) => {
    setRows(prev => prev.map((row, i) => {
      if (i !== rowIdx) return row;
      const next = { ...row, [key]: value };
      // 사업부를 바꾸면 그 아래에 없는 투자부서는 털어 낸다.
      if (key === 'division') {
        const allowed = departmentsFor(value, departments, departmentsByDivision);
        if (!allowed.includes(next.department)) next.department = '';
      }
      return next;
    }));
  }, [departments, departmentsByDivision]);

  const handleDeleteRow = useCallback((rowIdx) => {
    setRows(prev => (prev.length <= 1 ? [createEmptyRow()] : prev.filter((_, i) => i !== rowIdx)));
  }, []);

  const handlePaste = (e) => {
    const clipboard = e.clipboardData.getData('text/plain');
    if (!clipboard) return;

    // 한 칸짜리 붙여넣기는 브라우저 기본 동작에 맡긴다.
    const isGrid = clipboard.includes('\t') || clipboard.split('\n').filter(l => l.trim()).length > 1;
    if (!isGrid) return;
    e.preventDefault();

    const pasted = clipboard
      .split('\n')
      .map(line => line.replace(/\r$/, ''))
      .filter(line => line.length > 0)
      .map(line => line.split('\t'));
    if (pasted.length === 0) return;

    setRows(prev => {
      const next = [...prev];
      while (next.length < focusCell.row + pasted.length) next.push(createEmptyRow());

      pasted.forEach((cells, ri) => {
        const targetRow = focusCell.row + ri;
        cells.forEach((cellValue, ci) => {
          const col = COLUMNS[focusCell.col + ci];
          if (!col) return;
          // 사업부 열이 투자부서 열보다 앞이라, 부서를 볼 때는 같은 붙여넣기로
          // 들어온 사업부가 이미 이 행에 반영돼 있다.
          next[targetRow] = {
            ...next[targetRow],
            [col.key]: coerceCell(col, cellValue, type => optionsFor(type, next[targetRow])),
          };
        });
      });
      return next;
    });
  };

  const validRows = rows.filter(r => r.name.trim());

  const handleSave = () => {
    if (validRows.length === 0) return;
    onSave(validRows.map(r => ({ ...r, name: r.name.trim() })));
    reset();
  };

  if (!isOpen) return null;

  const renderCell = (row, rowIdx, col, colIdx) => {
    const onFocus = () => setFocusCell({ row: rowIdx, col: colIdx });

    if (col.type === 'text' || col.type === 'amount' || col.type === 'year') {
      return (
        <CellInput
          type={col.type === 'text' ? 'text' : 'number'}
          step={col.type === 'amount' ? '0.01' : '1'}
          value={row[col.key] ?? ''}
          onChange={e => handleCellChange(rowIdx, col.key, e.target.value)}
          onFocus={onFocus}
        />
      );
    }

    const options = optionsFor(col.type, row);
    const emptyForDivision = col.type === 'department' && row.division && options.length === 0;
    return (
      <CellSelect
        value={row[col.key] || ''}
        onChange={e => handleCellChange(rowIdx, col.key, e.target.value)}
        onFocus={onFocus}
      >
        <option value="">{emptyForDivision ? '등록된 부서 없음' : '선택'}</option>
        {options.map(name => <option key={name} value={name}>{name}</option>)}
      </CellSelect>
    );
  };

  return (
    <Overlay onClick={e => { if (e.target === e.currentTarget) handleClose(); }}>
      <Modal $width="94vw" style={{ height: '82vh' }}>
        <ModalHeader>
          <ModalTitle>투자 일괄 등록</ModalTitle>
          <CloseButton onClick={handleClose}><X size={18} /></CloseButton>
        </ModalHeader>

        <TableWrapper onPaste={handlePaste}>
          <PasteHint>
            엑셀에서 복사한 표를 셀에 바로 붙여넣을 수 있습니다. 투자명이 빈 행은 저장되지 않습니다.
          </PasteHint>
          <StyledTable>
            <thead>
              <tr>
                <th style={{ width: 34 }}>#</th>
                {COLUMNS.map(col => <th key={col.key}>{col.label}</th>)}
                <th style={{ width: 34 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  <RowNumber>{rowIdx + 1}</RowNumber>
                  {COLUMNS.map((col, colIdx) => (
                    <td key={col.key}>{renderCell(row, rowIdx, col, colIdx)}</td>
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
          <AddRowButton onClick={() => setRows(prev => [...prev, createEmptyRow()])}>
            <Plus size={14} /> 행 추가
          </AddRowButton>
          <HelpText>{validRows.length}건 입력됨</HelpText>
          <FooterRight>
            <CancelButton onClick={handleClose}>취소</CancelButton>
            <SaveButton onClick={handleSave} disabled={validRows.length === 0}>
              {validRows.length}건 저장
            </SaveButton>
          </FooterRight>
        </ModalFooter>
      </Modal>
    </Overlay>
  );
};

export default BulkAddModal;
