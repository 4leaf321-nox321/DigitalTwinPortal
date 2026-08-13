import React, { useState } from 'react';
import styled from 'styled-components';
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { STRAIN_SWEEP_COLUMNS, createEmptyStrainSweepRow } from '../../utils/strainSweepFileParser';

const Container = styled.div`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
`;

const Title = styled.h4`
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
`;

const RowCount = styled.span`
  font-size: 12px;
  color: #64748b;
  margin-left: 8px;
  font-weight: 400;
`;

const AddButton = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  background: #8b5cf6;
  color: white;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #7c3aed;
  }
`;

const TableWrapper = styled.div`
  max-height: 380px;
  overflow: auto;

  &::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
`;

const Thead = styled.thead`
  background: #f1f5f9;
  position: sticky;
  top: 0;
  z-index: 1;
`;

const Th = styled.th`
  padding: 8px 10px;
  text-align: left;
  font-weight: 600;
  color: #475569;
  border-bottom: 1px solid #e2e8f0;
  white-space: nowrap;
  min-width: 80px;

  &:last-child {
    width: 80px;
    text-align: center;
  }
`;

const Tbody = styled.tbody``;

const Tr = styled.tr`
  &:hover {
    background: #fafbfc;
  }

  &:not(:last-child) td {
    border-bottom: 1px solid #f1f5f9;
  }
`;

const Td = styled.td`
  padding: 6px 10px;
  color: #1e293b;

  &:last-child {
    text-align: center;
  }
`;

const Input = styled.input`
  width: 100%;
  padding: 4px 6px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 11px;
  text-align: right;

  &:focus {
    outline: none;
    border-color: #8b5cf6;
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.1);
  }

  &::-webkit-inner-spin-button,
  &::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
`;

const ValueCell = styled.span`
  display: block;
  text-align: right;
  font-family: 'Consolas', 'Monaco', monospace;
`;

const ActionButtons = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
`;

const IconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #f1f5f9;
    color: #1e293b;
  }

  &.delete:hover {
    background: #fee2e2;
    color: #dc2626;
  }

  &.confirm {
    color: #22c55e;
    &:hover {
      background: #dcfce7;
    }
  }

  &.cancel {
    color: #ef4444;
    &:hover {
      background: #fee2e2;
    }
  }
`;

const EmptyState = styled.div`
  padding: 32px;
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
`;

const StrainSweepDataTable = ({ data = [], onChange, readOnly = false }) => {
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});

  const handleAdd = () => {
    const newRow = createEmptyStrainSweepRow();
    onChange([...data, newRow]);
    setEditingId(newRow.id);
    setEditValues(newRow);
  };

  const handleDelete = (id) => {
    onChange(data.filter(row => row.id !== id));
  };

  const handleEdit = (row) => {
    setEditingId(row.id);
    setEditValues({ ...row });
  };

  const handleEditChange = (key, value) => {
    setEditValues(prev => ({
      ...prev,
      [key]: value === '' ? null : parseFloat(value) || 0,
    }));
  };

  const handleConfirmEdit = () => {
    onChange(data.map(row =>
      row.id === editingId ? { ...editValues } : row
    ));
    setEditingId(null);
    setEditValues({});
  };

  const handleCancelEdit = () => {
    const originalRow = data.find(r => r.id === editingId);
    if (originalRow &&
        originalRow.angularFrequency === 0 &&
        originalRow.storageModulus === 0) {
      onChange(data.filter(row => row.id !== editingId));
    }
    setEditingId(null);
    setEditValues({});
  };

  const formatValue = (value) => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'number') {
      if (Math.abs(value) < 0.0001 && value !== 0) {
        return value.toExponential(4);
      }
      return value.toFixed(4).replace(/\.?0+$/, '');
    }
    return value;
  };

  return (
    <Container>
      <Header>
        <Title>
          측정 데이터
          <RowCount>({data.length}행)</RowCount>
        </Title>
        {!readOnly && (
          <AddButton onClick={handleAdd}>
            <Plus size={14} />
            행 추가
          </AddButton>
        )}
      </Header>

      <TableWrapper>
        {data.length === 0 ? (
          <EmptyState>
            {readOnly ? '측정 데이터가 없습니다.' : '측정 데이터가 없습니다. 파일을 업로드하거나 직접 추가하세요.'}
          </EmptyState>
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>#</Th>
                {STRAIN_SWEEP_COLUMNS.map(col => (
                  <Th key={col.key}>{col.label}{col.unit ? ` (${col.unit})` : ''}</Th>
                ))}
                {!readOnly && <Th>작업</Th>}
              </tr>
            </Thead>
            <Tbody>
              {data.map((row, index) => (
                <Tr key={row.id || index}>
                  <Td>{index + 1}</Td>
                  {STRAIN_SWEEP_COLUMNS.map(col => (
                    <Td key={col.key}>
                      {editingId === row.id && !readOnly ? (
                        <Input
                          type="number"
                          step="any"
                          value={editValues[col.key] ?? ''}
                          onChange={(e) => handleEditChange(col.key, e.target.value)}
                          autoFocus={col.key === 'angularFrequency'}
                        />
                      ) : (
                        <ValueCell>{formatValue(row[col.key])}</ValueCell>
                      )}
                    </Td>
                  ))}
                  {!readOnly && (
                    <Td>
                      <ActionButtons>
                        {editingId === row.id ? (
                          <>
                            <IconButton className="confirm" onClick={handleConfirmEdit} title="확인">
                              <Check size={14} />
                            </IconButton>
                            <IconButton className="cancel" onClick={handleCancelEdit} title="취소">
                              <X size={14} />
                            </IconButton>
                          </>
                        ) : (
                          <>
                            <IconButton onClick={() => handleEdit(row)} title="수정">
                              <Edit2 size={14} />
                            </IconButton>
                            <IconButton className="delete" onClick={() => handleDelete(row.id)} title="삭제">
                              <Trash2 size={14} />
                            </IconButton>
                          </>
                        )}
                      </ActionButtons>
                    </Td>
                  )}
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </TableWrapper>
    </Container>
  );
};

export default StrainSweepDataTable;
