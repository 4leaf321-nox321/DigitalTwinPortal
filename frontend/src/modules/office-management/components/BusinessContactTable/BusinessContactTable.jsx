import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { Edit2, Check, X, Plus, Trash2, Download, ChevronUp, ChevronDown, Pencil } from 'lucide-react';
import { officeApi } from '../../services/officeApi';

// ============== Styled Components ==============

const Container = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  overflow: auto;
`;

const HeaderSection = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
`;

const Title = styled.h2`
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const Button = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid #e2e8f0;
  background: white;
  color: #475569;

  &:hover {
    background: #f8fafc;
  }

  &.primary {
    background: #4f46e5;
    border-color: #4f46e5;
    color: white;

    &:hover {
      background: #4338ca;
    }
  }

  &.success {
    background: #10b981;
    border-color: #10b981;
    color: white;

    &:hover {
      background: #059669;
    }
  }

  &.danger {
    color: #ef4444;
    border-color: #fecaca;

    &:hover {
      background: #fef2f2;
    }
  }
`;

const TableWrapper = styled.div`
  background: white;
  border-radius: 0.75rem;
  border: 1px solid #e2e8f0;
  overflow: auto;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  min-width: 800px;
`;

const Th = styled.th`
  padding: 0.875rem 1rem;
  background: #f8fafc;
  border-bottom: 2px solid #e2e8f0;
  font-size: 0.875rem;
  font-weight: 600;
  color: #475569;
  text-align: center;
  white-space: nowrap;

  &:first-child {
    text-align: left;
    background: #f1f5f9;
    position: sticky;
    left: 0;
    z-index: 1;
  }
`;

const Td = styled.td`
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e2e8f0;
  font-size: 0.875rem;
  color: #1e293b;
  vertical-align: top;
  min-width: 150px;

  &:first-child {
    font-weight: 600;
    background: #f8fafc;
    position: sticky;
    left: 0;
    z-index: 1;
    white-space: nowrap;
  }
`;

const CellContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  min-height: 2rem;
`;

const PersonTag = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  background: #eef2ff;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  color: #4f46e5;

  .action-btn {
    display: none;
    padding: 0.125rem;
    background: none;
    border: none;
    cursor: pointer;
    border-radius: 0.25rem;

    &.edit-btn {
      color: #4f46e5;
      &:hover {
        background: #e0e7ff;
      }
    }

    &.delete-btn {
      color: #ef4444;
      &:hover {
        background: #fef2f2;
      }
    }

    &.order-btn {
      color: #64748b;
      &:hover {
        background: #f1f5f9;
      }
      &:disabled {
        opacity: 0.3;
        cursor: not-allowed;
      }
    }
  }

  &:hover .action-btn {
    display: flex;
  }
`;

const PersonActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.125rem;
  margin-left: 0.25rem;
`;

const EditPersonForm = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 0.5rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
`;

const AddPersonButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  background: none;
  border: 1px dashed #cbd5e1;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: #4f46e5;
    color: #4f46e5;
    background: #f5f3ff;
  }
`;

const EditForm = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
`;

const InputRow = styled.div`
  display: flex;
  gap: 0.375rem;
  align-items: center;
`;

const Input = styled.input`
  flex: 1;
  padding: 0.375rem 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  min-width: 0;

  &:focus {
    outline: none;
    border-color: #4f46e5;
  }

  &::placeholder {
    color: #94a3b8;
  }
`;

const SmallButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.375rem;
  background: ${props => props.variant === 'primary' ? '#4f46e5' : props.variant === 'danger' ? '#fef2f2' : 'white'};
  color: ${props => props.variant === 'primary' ? 'white' : props.variant === 'danger' ? '#ef4444' : '#64748b'};
  border: 1px solid ${props => props.variant === 'primary' ? '#4f46e5' : props.variant === 'danger' ? '#fecaca' : '#e2e8f0'};
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: ${props => props.variant === 'primary' ? '#4338ca' : props.variant === 'danger' ? '#fee2e2' : '#f8fafc'};
  }
`;

// ============== Header Edit Styled Components ==============

const HeaderCell = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: ${props => props.isFirst ? 'flex-start' : 'center'};
`;

const HeaderInput = styled.input`
  padding: 0.25rem 0.5rem;
  border: 1px solid #c7d2fe;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 600;
  text-align: center;
  background: white;
  width: 100px;

  &:focus {
    outline: none;
    border-color: #4f46e5;
  }
`;

const RowHeaderInput = styled(HeaderInput)`
  text-align: left;
  width: 80px;
`;

const AddButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem;
  background: #f0fdf4;
  color: #16a34a;
  border: 1px dashed #86efac;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #dcfce7;
    border-color: #22c55e;
  }
`;

const DeleteHeaderButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.125rem;
  background: none;
  color: #ef4444;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  opacity: 0.6;
  transition: all 0.2s;

  &:hover {
    opacity: 1;
    background: #fef2f2;
  }
`;

// ============== Modal Styled Components ==============

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background: white;
  border-radius: 0.75rem;
  padding: 1.5rem;
  min-width: 400px;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
`;

const ModalTitle = styled.h3`
  font-size: 1.125rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 1rem 0;
`;

const ModalSection = styled.div`
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 1rem;

  &:last-of-type {
    margin-bottom: 1.5rem;
  }
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e2e8f0;
`;

const SectionTitle = styled.div`
  font-size: 0.875rem;
  font-weight: 600;
  color: #1e293b;
`;

const SelectAllButton = styled.button`
  font-size: 0.75rem;
  color: #4f46e5;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  border-radius: 0.375rem;
  padding: 0.25rem 0.5rem;
  cursor: pointer;

  &:hover {
    background: #e0e7ff;
  }
`;

const CheckboxGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
`;

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
  color: #475569;

  input {
    width: 1rem;
    height: 1rem;
    cursor: pointer;
  }
`;

const ModalButtons = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
`;

// ============== Constants ==============

const DEFAULT_COLUMNS = ['챔피언', '사무국장', '실무 포스트', '실무 담당'];
const DEFAULT_ROWS = ['MX', 'VD', 'DA', 'NW', '의료기기', 'SR', 'GTR(개발)', 'GTR(제조)', 'G-CS'];

// ============== Main Component ==============

const BusinessContactTable = () => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [cells, setCells] = useState({});
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [rows, setRows] = useState(DEFAULT_ROWS);
  const [addingCell, setAddingCell] = useState(null);
  const [newPerson, setNewPerson] = useState({ name: '', id: '' });
  const [loading, setLoading] = useState(true);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    name: true,
    id: false,
    selectedRows: [],
    selectedColumns: []
  });
  // 인력 수정 상태
  const [editingPerson, setEditingPerson] = useState(null); // { row, col, index, name, id }
  const [editPersonData, setEditPersonData] = useState({ name: '', id: '' });

  // 데이터 로드
  const loadData = useCallback(async () => {
    try {
      const result = await officeApi.getBusinessContacts();
      if (result) {
        setCells(result.cells || {});
        setColumns(result.columns || DEFAULT_COLUMNS);
        setRows(result.rows || DEFAULT_ROWS);
      }
    } catch (error) {
      console.error('Failed to load business contacts:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 데이터 저장
  const saveData = useCallback(async () => {
    try {
      const data = { cells, columns, rows };
      await officeApi.saveBusinessContacts(data);
      setIsEditMode(false);
      setAddingCell(null);
      setNewPerson({ name: '', id: '' });
      setEditingPerson(null);
      setEditPersonData({ name: '', id: '' });
    } catch (error) {
      console.error('Failed to save business contacts:', error);
      alert('저장에 실패했습니다.');
    }
  }, [cells, columns, rows]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 셀 키 생성
  const getCellKey = (row, col) => `${row}_${col}`;

  // 인력 추가
  const handleAddPerson = (row, col) => {
    if (!newPerson.name.trim()) {
      alert('이름을 입력해주세요.');
      return;
    }

    const cellKey = getCellKey(row, col);
    const currentList = cells[cellKey] || [];

    setCells(prev => ({
      ...prev,
      [cellKey]: [...currentList, { name: newPerson.name.trim(), id: newPerson.id.trim() }]
    }));

    setNewPerson({ name: '', id: '' });
    setAddingCell(null);
  };

  // 인력 삭제
  const handleRemovePerson = (row, col, index) => {
    const cellKey = getCellKey(row, col);
    const currentList = cells[cellKey] || [];

    setCells(prev => ({
      ...prev,
      [cellKey]: currentList.filter((_, i) => i !== index)
    }));
  };

  // 인력 수정 시작
  const handleStartEditPerson = (row, col, index) => {
    const cellKey = getCellKey(row, col);
    const person = cells[cellKey]?.[index];
    if (person) {
      setEditingPerson({ row, col, index });
      setEditPersonData({ name: person.name, id: person.id || '' });
    }
  };

  // 인력 수정 저장
  const handleSaveEditPerson = () => {
    if (!editingPerson) return;
    if (!editPersonData.name.trim()) {
      alert('이름을 입력해주세요.');
      return;
    }

    const { row, col, index } = editingPerson;
    const cellKey = getCellKey(row, col);
    const currentList = cells[cellKey] || [];

    const updatedList = [...currentList];
    updatedList[index] = {
      name: editPersonData.name.trim(),
      id: editPersonData.id.trim()
    };

    setCells(prev => ({
      ...prev,
      [cellKey]: updatedList
    }));

    setEditingPerson(null);
    setEditPersonData({ name: '', id: '' });
  };

  // 인력 수정 취소
  const handleCancelEditPerson = () => {
    setEditingPerson(null);
    setEditPersonData({ name: '', id: '' });
  };

  // 인력 순서 위로 이동
  const handleMovePersonUp = (row, col, index) => {
    if (index === 0) return;

    const cellKey = getCellKey(row, col);
    const currentList = cells[cellKey] || [];

    const newList = [...currentList];
    [newList[index - 1], newList[index]] = [newList[index], newList[index - 1]];

    setCells(prev => ({
      ...prev,
      [cellKey]: newList
    }));
  };

  // 인력 순서 아래로 이동
  const handleMovePersonDown = (row, col, index) => {
    const cellKey = getCellKey(row, col);
    const currentList = cells[cellKey] || [];

    if (index >= currentList.length - 1) return;

    const newList = [...currentList];
    [newList[index], newList[index + 1]] = [newList[index + 1], newList[index]];

    setCells(prev => ({
      ...prev,
      [cellKey]: newList
    }));
  };

  // 추가 모드 취소
  const handleCancelAdd = () => {
    setNewPerson({ name: '', id: '' });
    setAddingCell(null);
  };

  // 편집 모드 취소
  const handleCancelEdit = () => {
    loadData();
    setIsEditMode(false);
    setAddingCell(null);
    setNewPerson({ name: '', id: '' });
    setEditingPerson(null);
    setEditPersonData({ name: '', id: '' });
  };

  // 열 이름 변경
  const handleColumnNameChange = (index, newName) => {
    const oldName = columns[index];
    const newColumns = [...columns];
    newColumns[index] = newName;
    setColumns(newColumns);

    // 셀 키 업데이트
    const newCells = {};
    Object.entries(cells).forEach(([key, value]) => {
      const [row, col] = key.split('_');
      if (col === oldName) {
        newCells[`${row}_${newName}`] = value;
      } else {
        newCells[key] = value;
      }
    });
    setCells(newCells);
  };

  // 열 추가
  const handleAddColumn = () => {
    const newColName = `새 열 ${columns.length + 1}`;
    setColumns([...columns, newColName]);
  };

  // 열 삭제
  const handleDeleteColumn = (index) => {
    if (columns.length <= 1) {
      alert('최소 1개의 열이 필요합니다.');
      return;
    }
    const colName = columns[index];
    const newColumns = columns.filter((_, i) => i !== index);
    setColumns(newColumns);

    // 해당 열의 셀 데이터 삭제
    const newCells = {};
    Object.entries(cells).forEach(([key, value]) => {
      const [, col] = key.split('_');
      if (col !== colName) {
        newCells[key] = value;
      }
    });
    setCells(newCells);
  };

  // 행 이름 변경
  const handleRowNameChange = (index, newName) => {
    const oldName = rows[index];
    const newRows = [...rows];
    newRows[index] = newName;
    setRows(newRows);

    // 셀 키 업데이트
    const newCells = {};
    Object.entries(cells).forEach(([key, value]) => {
      const [row, col] = key.split('_');
      if (row === oldName) {
        newCells[`${newName}_${col}`] = value;
      } else {
        newCells[key] = value;
      }
    });
    setCells(newCells);
  };

  // 행 추가
  const handleAddRow = () => {
    const newRowName = `새 행 ${rows.length + 1}`;
    setRows([...rows, newRowName]);
  };

  // 행 삭제
  const handleDeleteRow = (index) => {
    if (rows.length <= 1) {
      alert('최소 1개의 행이 필요합니다.');
      return;
    }
    const rowName = rows[index];
    const newRows = rows.filter((_, i) => i !== index);
    setRows(newRows);

    // 해당 행의 셀 데이터 삭제
    const newCells = {};
    Object.entries(cells).forEach(([key, value]) => {
      const [row] = key.split('_');
      if (row !== rowName) {
        newCells[key] = value;
      }
    });
    setCells(newCells);
  };

  // 모달 열기
  const handleOpenExportModal = () => {
    setExportOptions({
      name: false,
      id: true,
      selectedRows: [...rows],
      selectedColumns: [...columns]
    });
    setIsExportModalOpen(true);
  };

  // 행 선택 토글
  const toggleRowSelection = (row) => {
    setExportOptions(prev => ({
      ...prev,
      selectedRows: prev.selectedRows.includes(row)
        ? prev.selectedRows.filter(r => r !== row)
        : [...prev.selectedRows, row]
    }));
  };

  // 열 선택 토글
  const toggleColumnSelection = (col) => {
    setExportOptions(prev => ({
      ...prev,
      selectedColumns: prev.selectedColumns.includes(col)
        ? prev.selectedColumns.filter(c => c !== col)
        : [...prev.selectedColumns, col]
    }));
  };

  // 전체 행 선택/해제
  const toggleAllRows = () => {
    setExportOptions(prev => ({
      ...prev,
      selectedRows: prev.selectedRows.length === rows.length ? [] : [...rows]
    }));
  };

  // 전체 열 선택/해제
  const toggleAllColumns = () => {
    setExportOptions(prev => ({
      ...prev,
      selectedColumns: prev.selectedColumns.length === columns.length ? [] : [...columns]
    }));
  };

  // 데이터 추출
  const handleExportData = () => {
    if (!exportOptions.name && !exportOptions.id) {
      alert('최소 하나의 데이터 항목(이름/ID)을 선택해주세요.');
      return;
    }
    if (exportOptions.selectedRows.length === 0) {
      alert('최소 하나의 행을 선택해주세요.');
      return;
    }
    if (exportOptions.selectedColumns.length === 0) {
      alert('최소 하나의 열을 선택해주세요.');
      return;
    }

    // 테이블 순서대로 정렬된 행/열
    const orderedRows = rows.filter(row => exportOptions.selectedRows.includes(row));
    const orderedColumns = columns.filter(col => exportOptions.selectedColumns.includes(col));

    // 선택된 열/행에서 데이터 수집 (열 우선, 상단에서 하단 순서)
    const allPersons = [];
    orderedColumns.forEach(col => {
      orderedRows.forEach(row => {
        const cellKey = getCellKey(row, col);
        const persons = cells[cellKey] || [];
        persons.forEach(person => {
          allPersons.push(person);
        });
      });
    });

    const lines = [];
    if (exportOptions.name) {
      const names = allPersons.map(p => p.name).filter(Boolean);
      lines.push(names.join(';'));
    }
    if (exportOptions.id) {
      const ids = allPersons.map(p => p.id).filter(Boolean).map(id => {
        // ID에 @가 없으면 @samsung.com 추가
        if (!id.includes('@')) {
          return `${id}@samsung.com`;
        }
        return id;
      });
      lines.push(ids.join(';'));
    }

    const content = lines.join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '사업부_담당_창구_데이터.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setIsExportModalOpen(false);
  };

  // 셀 렌더링
  const renderCell = (row, col) => {
    const cellKey = getCellKey(row, col);
    const persons = cells[cellKey] || [];
    const isAddingHere = addingCell?.row === row && addingCell?.col === col;
    const personCount = persons.length;

    return (
      <CellContent>
        {persons.map((person, index) => {
          const isEditingThis = editingPerson?.row === row &&
                                editingPerson?.col === col &&
                                editingPerson?.index === index;

          if (isEditingThis) {
            // 수정 폼 표시
            return (
              <EditPersonForm key={index}>
                <InputRow>
                  <Input
                    placeholder="이름"
                    value={editPersonData.name}
                    onChange={(e) => setEditPersonData(prev => ({ ...prev, name: e.target.value }))}
                    autoFocus
                  />
                  <Input
                    placeholder="ID"
                    value={editPersonData.id}
                    onChange={(e) => setEditPersonData(prev => ({ ...prev, id: e.target.value }))}
                  />
                </InputRow>
                <InputRow>
                  <SmallButton variant="primary" onClick={handleSaveEditPerson}>
                    <Check size={14} />
                  </SmallButton>
                  <SmallButton onClick={handleCancelEditPerson}>
                    <X size={14} />
                  </SmallButton>
                </InputRow>
              </EditPersonForm>
            );
          }

          return (
            <PersonTag key={index} title={person.id ? `ID: ${person.id}` : ''}>
              {person.name}
              {isEditMode && (
                <PersonActions>
                  {/* 수정 버튼 */}
                  <button
                    className="action-btn edit-btn"
                    onClick={() => handleStartEditPerson(row, col, index)}
                    title="수정"
                  >
                    <Pencil size={12} />
                  </button>
                  {/* 삭제 버튼 */}
                  <button
                    className="action-btn delete-btn"
                    onClick={() => handleRemovePerson(row, col, index)}
                    title="삭제"
                  >
                    <X size={12} />
                  </button>
                  {/* 순서 변경 버튼 */}
                  <button
                    className="action-btn order-btn"
                    onClick={() => handleMovePersonUp(row, col, index)}
                    disabled={index === 0}
                    title="위로 이동"
                  >
                    <ChevronUp size={12} />
                  </button>
                  <button
                    className="action-btn order-btn"
                    onClick={() => handleMovePersonDown(row, col, index)}
                    disabled={index === personCount - 1}
                    title="아래로 이동"
                  >
                    <ChevronDown size={12} />
                  </button>
                </PersonActions>
              )}
            </PersonTag>
          );
        })}

        {isEditMode && (
          isAddingHere ? (
            <EditForm>
              <InputRow>
                <Input
                  placeholder="이름"
                  value={newPerson.name}
                  onChange={(e) => setNewPerson(prev => ({ ...prev, name: e.target.value }))}
                  autoFocus
                />
                <Input
                  placeholder="ID"
                  value={newPerson.id}
                  onChange={(e) => setNewPerson(prev => ({ ...prev, id: e.target.value }))}
                />
              </InputRow>
              <InputRow>
                <SmallButton variant="primary" onClick={() => handleAddPerson(row, col)}>
                  <Check size={14} />
                </SmallButton>
                <SmallButton onClick={handleCancelAdd}>
                  <X size={14} />
                </SmallButton>
              </InputRow>
            </EditForm>
          ) : (
            <AddPersonButton onClick={() => setAddingCell({ row, col })}>
              <Plus size={12} />
              추가
            </AddPersonButton>
          )
        )}
      </CellContent>
    );
  };

  if (loading) {
    return (
      <Container>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
          로딩 중...
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <HeaderSection>
        <Title>사업부 담당 창구</Title>
        <ActionButtons>
          {isEditMode ? (
            <>
              <Button className="danger" onClick={handleCancelEdit}>
                <X size={16} />
                취소
              </Button>
              <Button className="success" onClick={saveData}>
                <Check size={16} />
                수정 완료
              </Button>
            </>
          ) : (
            <>
              <Button onClick={handleOpenExportModal}>
                <Download size={16} />
                데이터 추출
              </Button>
              <Button className="primary" onClick={() => setIsEditMode(true)}>
                <Edit2 size={16} />
                편집
              </Button>
            </>
          )}
        </ActionButtons>
      </HeaderSection>

      <TableWrapper>
        <Table>
          <thead>
            <tr>
              <Th>사업부</Th>
              {columns.map((col, index) => (
                <Th key={index}>
                  {isEditMode ? (
                    <HeaderCell>
                      <HeaderInput
                        value={col}
                        onChange={(e) => handleColumnNameChange(index, e.target.value)}
                      />
                      <DeleteHeaderButton
                        onClick={() => handleDeleteColumn(index)}
                        title="열 삭제"
                      >
                        <Trash2 size={14} />
                      </DeleteHeaderButton>
                    </HeaderCell>
                  ) : (
                    col
                  )}
                </Th>
              ))}
              {isEditMode && (
                <Th>
                  <AddButton onClick={handleAddColumn} title="열 추가">
                    <Plus size={16} />
                  </AddButton>
                </Th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <Td>
                  {isEditMode ? (
                    <HeaderCell isFirst>
                      <RowHeaderInput
                        value={row}
                        onChange={(e) => handleRowNameChange(rowIndex, e.target.value)}
                      />
                      <DeleteHeaderButton
                        onClick={() => handleDeleteRow(rowIndex)}
                        title="행 삭제"
                      >
                        <Trash2 size={14} />
                      </DeleteHeaderButton>
                    </HeaderCell>
                  ) : (
                    row
                  )}
                </Td>
                {columns.map((col, colIndex) => (
                  <Td key={colIndex}>
                    {renderCell(row, col)}
                  </Td>
                ))}
                {isEditMode && <Td />}
              </tr>
            ))}
            {isEditMode && (
              <tr>
                <Td>
                  <AddButton onClick={handleAddRow} title="행 추가">
                    <Plus size={16} />
                  </AddButton>
                </Td>
                {columns.map((_, index) => (
                  <Td key={index} />
                ))}
                <Td />
              </tr>
            )}
          </tbody>
        </Table>
      </TableWrapper>

      {/* 데이터 추출 모달 */}
      {isExportModalOpen && (
        <ModalOverlay onClick={() => setIsExportModalOpen(false)}>
          <ModalContent onClick={e => e.stopPropagation()}>
            <ModalTitle>데이터 추출</ModalTitle>

            {/* 행 선택 */}
            <ModalSection>
              <SectionHeader>
                <SectionTitle>행 선택</SectionTitle>
                <SelectAllButton onClick={toggleAllRows}>
                  {exportOptions.selectedRows.length === rows.length ? '전체 해제' : '전체 선택'}
                </SelectAllButton>
              </SectionHeader>
              <CheckboxGrid>
                {rows.map(row => (
                  <CheckboxLabel key={row}>
                    <input
                      type="checkbox"
                      checked={exportOptions.selectedRows.includes(row)}
                      onChange={() => toggleRowSelection(row)}
                    />
                    {row}
                  </CheckboxLabel>
                ))}
              </CheckboxGrid>
            </ModalSection>

            {/* 열 선택 */}
            <ModalSection>
              <SectionHeader>
                <SectionTitle>열 선택</SectionTitle>
                <SelectAllButton onClick={toggleAllColumns}>
                  {exportOptions.selectedColumns.length === columns.length ? '전체 해제' : '전체 선택'}
                </SelectAllButton>
              </SectionHeader>
              <CheckboxGrid>
                {columns.map(col => (
                  <CheckboxLabel key={col}>
                    <input
                      type="checkbox"
                      checked={exportOptions.selectedColumns.includes(col)}
                      onChange={() => toggleColumnSelection(col)}
                    />
                    {col}
                  </CheckboxLabel>
                ))}
              </CheckboxGrid>
            </ModalSection>

            {/* 데이터 항목 선택 */}
            <ModalSection>
              <SectionHeader>
                <SectionTitle>데이터 항목</SectionTitle>
              </SectionHeader>
              <CheckboxGrid>
                <CheckboxLabel>
                  <input
                    type="checkbox"
                    checked={exportOptions.name}
                    onChange={e => setExportOptions(prev => ({ ...prev, name: e.target.checked }))}
                  />
                  이름
                </CheckboxLabel>
                <CheckboxLabel>
                  <input
                    type="checkbox"
                    checked={exportOptions.id}
                    onChange={e => setExportOptions(prev => ({ ...prev, id: e.target.checked }))}
                  />
                  ID
                </CheckboxLabel>
              </CheckboxGrid>
            </ModalSection>

            <ModalButtons>
              <Button onClick={() => setIsExportModalOpen(false)}>
                취소
              </Button>
              <Button className="primary" onClick={handleExportData}>
                확인
              </Button>
            </ModalButtons>
          </ModalContent>
        </ModalOverlay>
      )}
    </Container>
  );
};

export default BusinessContactTable;
