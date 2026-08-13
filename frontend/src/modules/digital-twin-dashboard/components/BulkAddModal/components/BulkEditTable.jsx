import React, { useRef, useCallback, useState } from 'react';
import styled from 'styled-components';
import { Plus, Trash2, Copy, AlertCircle, X, ChevronUp, ChevronDown } from 'lucide-react';

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

  /* 스크롤바 스타일 - 더 두껍게 */
  &::-webkit-scrollbar {
    width: 14px;
    height: 14px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 7px;
  }

  &::-webkit-scrollbar-thumb {
    background: #94a3b8;
    border-radius: 7px;
    border: 2px solid #f1f5f9;

    &:hover {
      background: #64748b;
    }
  }

  &::-webkit-scrollbar-corner {
    background: #f1f5f9;
  }
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

const ReorderButton = styled.button`
  padding: 0.25rem;
  background: ${props => props.disabled ? '#f3f4f6' : '#dbeafe'};
  color: ${props => props.disabled ? '#9ca3af' : '#2563eb'};
  border: 1px solid ${props => props.disabled ? '#e5e7eb' : '#bfdbfe'};
  border-radius: 0.25rem;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: ${props => props.disabled ? '#f3f4f6' : '#bfdbfe'};
    border-color: ${props => props.disabled ? '#e5e7eb' : '#93c5fd'};
  }
`;

const ReorderButtonGroup = styled.div`
  display: flex;
  gap: 0.25rem;
  align-items: center;
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

const BulkEditTable = ({ table, data, onChange, errors = {} }) => {
  const tableRef = useRef(null);
  const containerRef = useRef(null);
  const textAreaRef = useRef(null);

  // 붙여넣기 모달 상태
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');

  // 새 행 추가
  const addRow = useCallback(() => {
    const newData = [...data, {}];
    onChange(newData);
  }, [data, onChange]);

  // 행 삭제
  const deleteRow = useCallback((index) => {
    if (data.length <= 1) return; // 최소 1개 행은 유지
    const newData = data.filter((_, i) => i !== index);
    onChange(newData);
  }, [data, onChange]);

  // 행 위로 이동 (같은 groupBy 값을 가진 행들 사이에서만)
  const moveRowUp = useCallback((index) => {
    if (index === 0) return;

    // groupBy가 설정되어 있으면 같은 그룹 내에서만 이동
    if (table.groupBy) {
      const currentRow = data[index];
      const currentGroupValue = currentRow[table.groupBy];

      // 바로 위 행이 같은 그룹인지 확인
      const prevRow = data[index - 1];
      if (prevRow[table.groupBy] !== currentGroupValue) {
        return; // 다른 그룹이면 이동 불가
      }
    }

    const newData = [...data];
    [newData[index - 1], newData[index]] = [newData[index], newData[index - 1]];
    onChange(newData);
  }, [data, onChange, table.groupBy]);

  // 행 아래로 이동 (같은 groupBy 값을 가진 행들 사이에서만)
  const moveRowDown = useCallback((index) => {
    if (index === data.length - 1) return;

    // groupBy가 설정되어 있으면 같은 그룹 내에서만 이동
    if (table.groupBy) {
      const currentRow = data[index];
      const currentGroupValue = currentRow[table.groupBy];

      // 바로 아래 행이 같은 그룹인지 확인
      const nextRow = data[index + 1];
      if (nextRow[table.groupBy] !== currentGroupValue) {
        return; // 다른 그룹이면 이동 불가
      }
    }

    const newData = [...data];
    [newData[index], newData[index + 1]] = [newData[index + 1], newData[index]];
    onChange(newData);
  }, [data, onChange, table.groupBy]);

  // 모든 데이터 클리어
  const clearAll = useCallback(() => {
    if (window.confirm('모든 데이터를 삭제하시겠습니까?')) {
      onChange([{}]);
    }
  }, [onChange]);

  // 셀 값 변경
  const updateCell = useCallback((rowIndex, key, value) => {
    const newData = [...data];
    if (!newData[rowIndex]) {
      newData[rowIndex] = {};
    }
    
    // 타입에 따른 값 변환
    const header = table.headers.find(h => h.key === key);
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
  }, [data, onChange, table.headers]);

  // 붙여넣기 모달 열기
  const handleOpenPasteModal = useCallback(() => {
    setIsPasteModalOpen(true);
    setPasteText('');
    // 모달이 열린 후 textarea에 포커스
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

  // 붙여넣은 텍스트를 select 옵션과 매칭하는 헬퍼 함수
  // rowData: 현재 행의 데이터 (dependsOn 필터링에 사용)
  const matchSelectValue = useCallback((header, pastedText, rowData = {}) => {
    if (header.type !== 'select' || !header.options) {
      return pastedText;
    }

    const trimmedText = pastedText.trim();
    if (!trimmedText) return '';

    // dependsOn이 있으면 부모 필드 값으로 옵션 필터링
    let filteredOptions = header.options;
    if (header.dependsOn && rowData) {
      const parentValue = rowData[header.dependsOn] || '';
      if (parentValue) {
        filteredOptions = header.options.filter(opt => {
          if (opt.value === '') return true;
          return opt.parentValue === parentValue;
        });
      }
    }

    // 1. 정확히 일치하는 label 찾기 (대소문자 무시)
    const exactMatch = filteredOptions.find(
      opt => opt.label === trimmedText || opt.label.toLowerCase() === trimmedText.toLowerCase()
    );
    if (exactMatch) {
      return exactMatch.value;
    }

    // 2. value로 직접 입력된 경우
    const valueMatch = filteredOptions.find(
      opt => opt.value === trimmedText || opt.value.toString().toLowerCase() === trimmedText.toLowerCase()
    );
    if (valueMatch) {
      return valueMatch.value;
    }

    // 3. 부분 일치하는 label 찾기
    const partialMatch = filteredOptions.find(
      opt => opt.label && opt.label.toLowerCase().includes(trimmedText.toLowerCase())
    );
    if (partialMatch) {
      return partialMatch.value;
    }

    // 매칭 실패 시 빈 값 반환
    return '';
  }, []);

  // 수동 붙여넣기 (대체 방법) - handlePaste보다 먼저 정의해야 함
  const handleManualPaste = useCallback((text) => {
    try {
      if (!text || text.trim() === '') {
        alert('데이터가 비어있습니다.');
        return false;
      }

      console.log('수동 입력 데이터:', text.substring(0, 200) + '...');

      const rows = text.trim().split('\n');
      const newData = [];

      rows.forEach(row => {
        const cells = row.split('\t'); // 탭으로 구분된 값
        const rowData = {};

        table.headers.forEach((header, index) => {
          if (cells[index] !== undefined) {
            let value = cells[index].trim();

            // 타입에 따른 변환
            if (header.type === 'number' && value !== '') {
              const numValue = Number(value);
              value = isNaN(numValue) ? value : numValue;
            } else if (header.type === 'boolean') {
              value = value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'yes' || value.toLowerCase() === 'y';
            } else if (header.type === 'select' && header.options) {
              // select 타입: 붙여넣은 텍스트를 드롭다운 옵션과 매칭
              // rowData를 전달하여 dependsOn 필터링 적용 (대분류 → 소분류)
              value = matchSelectValue(header, value, rowData);
            }

            rowData[header.key] = value;
          }
        });

        // 빈 행이 아닌 경우에만 추가
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
  }, [table.headers, onChange, matchSelectValue]);

  // 클립보드에서 붙여넣기 (자동 시도 - HTTPS에서만 작동)
  const handlePaste = useCallback(async () => {
    try {
      // Clipboard API 사용 가능 여부 확인
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

    // Clipboard API 실패 시 또는 HTTP 환경에서는 모달 열기
    handleOpenPasteModal();
  }, [handleManualPaste, handleOpenPasteModal]);

  // 모달에서 확인 버튼 클릭
  const handleConfirmPaste = useCallback(() => {
    if (handleManualPaste(pasteText)) {
      handleClosePasteModal();
    }
  }, [pasteText, handleManualPaste, handleClosePasteModal]);

  // 키보드 이벤트로 붙여넣기 (대체 방법)
  const handleKeyDown = useCallback((e) => {
    // 모달이 열려있으면 키보드 이벤트를 처리하지 않음
    if (isPasteModalOpen) {
      return;
    }

    if (e.ctrlKey && e.key === 'v') {
      e.preventDefault();
      handlePaste();
    }
  }, [handlePaste, isPasteModalOpen]);

  // 입력 컴포넌트 렌더링 (row 추가로 dependsOn 처리)
  const renderInput = (header, value, rowIndex, row) => {
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

    // select 타입 처리 (대분류, 소분류 등)
    if (header.type === 'select' && header.options) {
      // dependsOn이 있으면 부모 필드 값으로 옵션 필터링
      let filteredOptions = header.options;
      if (header.dependsOn && row) {
        const parentValue = row[header.dependsOn] || '';
        filteredOptions = header.options.filter(opt => {
          // 빈 값 옵션(선택하세요)은 항상 표시
          if (opt.value === '') return true;
          // parentValue가 비어있으면 전체 표시
          if (!parentValue) return true;
          // parentValue와 일치하는 옵션만 표시
          return opt.parentValue === parentValue;
        });
      }

      return (
        <Select {...commonProps}>
          {filteredOptions.map((opt, idx) => (
            <option key={idx} value={opt.value}>
              {opt.label}
            </option>
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
          <h3>{table.title} ({table.name})</h3>
          <p>{table.description}</p>
        </TableInfo>
        <TableActions>
          <ActionButton className="paste" onClick={handlePaste} title="엑셀에서 복사한 데이터를 붙여넣습니다 (HTTP/HTTPS 모두 지원)">
            <Copy size={14} strokeWidth={2} />
            📋 엑셀 붙여넣기
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
              {table.headers.map(header => (
                <HeaderCell
                  key={header.key}
                  className={header.required ? 'required' : ''}
                  style={header.width ? { width: header.width, minWidth: header.width } : {}}
                >
                  {header.label}
                  {header.type === 'number' && <span style={{ color: '#6b7280', fontSize: '0.75rem' }}> (숫자)</span>}
                  {header.type === 'boolean' && <span style={{ color: '#6b7280', fontSize: '0.75rem' }}> (예/아니오)</span>}
                </HeaderCell>
              ))}
              {table.enableReorder && (
                <HeaderCell style={{ width: '100px', minWidth: '100px' }}>순서</HeaderCell>
              )}
              <HeaderCell style={{ width: '60px', minWidth: '60px' }}>삭제</HeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {data.map((row, rowIndex) => {
              const hasRowError = errors && errors[rowIndex] && Object.keys(errors[rowIndex]).length > 0;

              // 순서 조정 버튼 활성화/비활성화 체크
              let canMoveUp = rowIndex > 0;
              let canMoveDown = rowIndex < data.length - 1;

              if (table.enableReorder && table.groupBy) {
                const currentGroupValue = row[table.groupBy];

                // 위로 이동 가능 여부
                if (rowIndex > 0) {
                  const prevRow = data[rowIndex - 1];
                  canMoveUp = prevRow[table.groupBy] === currentGroupValue;
                }

                // 아래로 이동 가능 여부
                if (rowIndex < data.length - 1) {
                  const nextRow = data[rowIndex + 1];
                  canMoveDown = nextRow[table.groupBy] === currentGroupValue;
                }
              }

              return (
                <TableRow key={rowIndex} className={hasRowError ? 'has-error' : ''}>
                  <TableCell>
                    <RowNumber>{rowIndex + 1}</RowNumber>
                  </TableCell>
                  {table.headers.map(header => {
                    const hasError = errors && errors[rowIndex] && errors[rowIndex][header.key];
                    return (
                      <TableCell key={header.key}>
                        {renderInput(header, row[header.key], rowIndex, row)}
                        {hasError && (
                          <ErrorText>
                            <AlertCircle size={12} strokeWidth={2} />
                            {hasError}
                          </ErrorText>
                        )}
                      </TableCell>
                    );
                  })}
                  {table.enableReorder && (
                    <TableCell className="actions">
                      <ReorderButtonGroup>
                        <ReorderButton
                          onClick={() => moveRowUp(rowIndex)}
                          disabled={!canMoveUp}
                          title={canMoveUp ? "위로 이동" : "같은 프로젝트 내에서만 이동 가능"}
                        >
                          <ChevronUp size={14} strokeWidth={2} />
                        </ReorderButton>
                        <ReorderButton
                          onClick={() => moveRowDown(rowIndex)}
                          disabled={!canMoveDown}
                          title={canMoveDown ? "아래로 이동" : "같은 프로젝트 내에서만 이동 가능"}
                        >
                          <ChevronDown size={14} strokeWidth={2} />
                        </ReorderButton>
                      </ReorderButtonGroup>
                    </TableCell>
                  )}
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

      {/* 붙여넣기 모달 */}
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
                <h4>📋 사용 방법</h4>
                <p>
                  <strong>1단계:</strong> 엑셀에서 데이터를 선택하고 <kbd>Ctrl+C</kbd> (또는 <kbd>Cmd+C</kbd>)로 복사하세요.<br/>
                  <strong>2단계:</strong> 아래 입력창을 클릭하고 <kbd>Ctrl+V</kbd> (또는 <kbd>Cmd+V</kbd>)로 붙여넣으세요.<br/>
                  <strong>3단계:</strong> "데이터 가져오기" 버튼을 클릭하세요.
                </p>
                <ul>
                  <li>✅ HTTP 환경에서도 작동합니다</li>
                  <li>✅ 탭으로 구분된 데이터를 자동으로 인식합니다</li>
                  <li>✅ 엑셀 복사 형식 그대로 사용 가능</li>
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
