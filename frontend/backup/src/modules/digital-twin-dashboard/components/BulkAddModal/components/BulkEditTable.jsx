import React, { useRef, useCallback } from 'react';
import styled from 'styled-components';
import { Plus, Trash2, Copy, AlertCircle } from 'lucide-react';

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

const BulkEditTable = ({ table, data, onChange, errors = {} }) => {
  const tableRef = useRef(null);
  const containerRef = useRef(null);

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

  // 클립보드에서 붙여넣기
  const handlePaste = useCallback(async () => {
    try {
      // 먼저 권한 확인
      if (!navigator.clipboard) {
        throw new Error('클립보드 API를 사용할 수 없습니다. HTTPS 연결이 필요합니다.');
      }

      // 클립보드 읽기 권한 요청 및 데이터 읽기
      let text;
      try {
        text = await navigator.clipboard.readText();
      } catch (permissionError) {
        // 권한이 거부된 경우 사용자에게 안내
        console.warn('클립보드 권한 거부:', permissionError);
        alert('클립보드 접근 권한이 필요합니다.\n\n해결 방법:\n1. 브라우저 주소창의 자물쇠 아이콘 클릭\n2. "클립보드" 권한을 "허용"으로 변경\n3. 페이지 새로고침 후 다시 시도\n\n또는 직접 입력하거나 테이블에 포커스 후 Ctrl+V를 시도해보세요.');
        return;
      }

      if (!text || text.trim() === '') {
        alert('클립보드가 비어있습니다. 엑셀에서 데이터를 복사한 후 다시 시도해주세요.');
        return;
      }

      console.log('클립보드 데이터:', text.substring(0, 200) + '...');
      
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
        alert(`${newData.length}개 행이 성공적으로 붙여넣어졌습니다.`);
      } else {
        alert('붙여넣을 데이터가 없습니다.\n\n엑셀에서 데이터를 선택하고 Ctrl+C로 복사했는지 확인해주세요.');
      }
    } catch (error) {
      console.error('클립보드 읽기 실패:', error);
      alert(`클립보드에서 데이터를 읽을 수 없습니다.\n\n오류: ${error.message}\n\n해결 방법:\n1. HTTPS 연결 확인\n2. 브라우저 클립보드 권한 허용\n3. 테이블에 직접 입력 사용`);
    }
  }, [table.headers, onChange]);

  // 수동 붙여넣기 (대체 방법)
  const handleManualPaste = useCallback((text) => {
    try {
      if (!text || text.trim() === '') {
        alert('데이터가 비어있습니다.');
        return;
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
      } else {
        alert('사용 가능한 데이터가 없습니다.\n\n엑셀에서 데이터를 선택하고 Ctrl+C로 복사하여 다시 시도해주세요.');
      }
    } catch (error) {
      console.error('수동 붙여넣기 실패:', error);
      alert('데이터 처리 중 오류가 발생했습니다.');
    }
  }, [table.headers, onChange]);

  // 키보드 이벤트로 붙여넣기 (대체 방법)
  const handleKeyDown = useCallback((e) => {
    if (e.ctrlKey && e.key === 'v') {
      e.preventDefault();
      handlePaste();
    }
  }, [handlePaste]);

  // 입력 컴포넌트 렌더링
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

    return (
      <Input
        {...commonProps}
        type={header.type === 'number' ? 'number' : 'text'}
        placeholder={header.required ? '필수' : '선택'}
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
          <ActionButton className="paste" onClick={handlePaste} title="엑셀에서 복사한 데이터를 붙여넣습니다 (Ctrl+C → 붙여넣기 버튼)">
            <Copy size={14} strokeWidth={2} />
            📋 붙여넣기
          </ActionButton>
          <ActionButton className="paste" onClick={() => {
            const text = prompt('엑셀에서 복사한 데이터를 여기에 붙여넣으세요 (Ctrl+V):', '');
            if (text) {
              handleManualPaste(text);
            }
          }} title="수동으로 데이터를 입력합니다">
            <Copy size={14} strokeWidth={2} />
            ✍️ 수동 입력
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
              <HeaderCell style={{ width: '50px' }}>#</HeaderCell>
              {table.headers.map(header => (
                <HeaderCell key={header.key} className={header.required ? 'required' : ''}>
                  {header.label}
                  {header.type === 'number' && <span style={{ color: '#6b7280', fontSize: '0.75rem' }}> (숫자)</span>}
                  {header.type === 'boolean' && <span style={{ color: '#6b7280', fontSize: '0.75rem' }}> (예/아니오)</span>}
                </HeaderCell>
              ))}
              <HeaderCell style={{ width: '60px' }}>삭제</HeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {data.map((row, rowIndex) => {
              const hasRowError = errors[rowIndex] && Object.keys(errors[rowIndex]).length > 0;
              return (
                <TableRow key={rowIndex} className={hasRowError ? 'has-error' : ''}>
                  <TableCell>
                    <RowNumber>{rowIndex + 1}</RowNumber>
                  </TableCell>
                  {table.headers.map(header => {
                    const hasError = errors[rowIndex] && errors[rowIndex][header.key];
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
    </TableContainer>
  );
};

export default BulkEditTable;
