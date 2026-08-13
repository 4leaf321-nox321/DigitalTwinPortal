import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './BulkAddModal.css';

const BulkAddModal = ({
  isOpen,
  onClose,
  onAdd,
  categoryType,
  categoryLabel,
  performanceCategories = [],
  divisions = []
}) => {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  // 카테고리별 컬럼 정의
  const getColumns = () => {
    switch (categoryType) {
      case 'departments':
        return [
          { key: 'name', label: '부서명', type: 'text', required: true, placeholder: '부서명 입력' },
          { key: 'divisionId', label: '소속 사업부', type: 'select', required: false, options: [
            { value: '', label: '공통 부서 (사업부 미지정)' },
            ...divisions.map(d => ({ value: d.id, label: d.name }))
          ]},
          { key: 'description', label: '설명', type: 'text', required: false, placeholder: '설명 (선택사항)' }
        ];
      case 'performanceCategories':
        return [
          { key: 'name', label: '대분류명', type: 'text', required: true, placeholder: '대분류명 입력' },
          { key: 'color', label: '색상', type: 'color', required: false, defaultValue: '#64748B' },
          { key: 'description', label: '설명', type: 'text', required: false, placeholder: '설명 (선택사항)' }
        ];
      case 'performanceSubcategories':
        return [
          { key: 'name', label: '소분류명', type: 'text', required: true, placeholder: '소분류명 입력' },
          { key: 'categoryId', label: '대분류', type: 'select', required: true, options: [
            { value: '', label: '대분류 선택' },
            ...performanceCategories.map(c => ({ value: c.id, label: c.name }))
          ]},
          { key: 'unit', label: '단위', type: 'text', required: false, placeholder: '예: hrs, %, 억원' },
          { key: 'description', label: '설명', type: 'text', required: false, placeholder: '설명 (선택사항)' }
        ];
      default:
        return [
          { key: 'name', label: '이름', type: 'text', required: true, placeholder: '이름 입력' }
        ];
    }
  };

  const columns = getColumns();

  // 초기화
  useEffect(() => {
    if (isOpen) {
      // 빈 행 5개로 시작
      const initialRows = Array(5).fill(null).map((_, index) => {
        const row = { _id: Date.now() + index };
        columns.forEach(col => {
          row[col.key] = col.defaultValue || '';
        });
        return row;
      });
      setRows(initialRows);
      setError('');
    }
  }, [isOpen, categoryType]);

  const handleAddRow = () => {
    const newRow = { _id: Date.now() + Math.random() };
    columns.forEach(col => {
      newRow[col.key] = col.defaultValue || '';
    });
    setRows(prev => [...prev, newRow]);
  };

  const handleRemoveRow = (index) => {
    if (rows.length <= 1) return;
    setRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleCellChange = (index, key, value) => {
    setRows(prev => prev.map((row, i) =>
      i === index ? { ...row, [key]: value } : row
    ));
    setError('');
  };

  const handleSubmit = () => {
    // 빈 행 필터링 (name이 있는 행만)
    const validRows = rows.filter(row => row.name && row.name.trim());

    if (validRows.length === 0) {
      setError('최소 하나 이상의 항목을 입력해주세요.');
      return;
    }

    // 필수 필드 검증
    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      for (const col of columns) {
        if (col.required && (!row[col.key] || !row[col.key].toString().trim())) {
          setError(`${i + 1}번째 항목의 "${col.label}" 필드는 필수입니다.`);
          return;
        }
      }
    }

    // 데이터 정리 후 추가
    const cleanedRows = validRows.map(row => {
      const cleaned = {};
      columns.forEach(col => {
        cleaned[col.key] = row[col.key];
      });
      return cleaned;
    });

    onAdd(cleanedRows);
    onClose();
  };

  // 붙여넣은 텍스트를 드롭다운 옵션의 value로 변환
  const matchSelectValue = (column, pastedText) => {
    if (column.type !== 'select' || !column.options) {
      return pastedText;
    }

    const trimmedText = pastedText.trim();

    // 1. 정확히 일치하는 label 찾기
    const exactMatch = column.options.find(
      opt => opt.label === trimmedText || opt.label.toLowerCase() === trimmedText.toLowerCase()
    );
    if (exactMatch) {
      return exactMatch.value;
    }

    // 2. 부분 일치하는 label 찾기 (포함 관계)
    const partialMatch = column.options.find(
      opt => opt.label.toLowerCase().includes(trimmedText.toLowerCase()) ||
             trimmedText.toLowerCase().includes(opt.label.toLowerCase())
    );
    if (partialMatch) {
      return partialMatch.value;
    }

    // 3. value로 직접 입력된 경우
    const valueMatch = column.options.find(
      opt => opt.value.toString() === trimmedText
    );
    if (valueMatch) {
      return valueMatch.value;
    }

    // 매칭 실패 시 빈 값 반환 (기본 선택)
    return '';
  };

  const handlePaste = (e, rowIndex, colKey) => {
    const pasteData = e.clipboardData.getData('text');

    // 탭이나 줄바꿈이 포함된 경우 (엑셀에서 복사한 경우)
    if (pasteData.includes('\t') || pasteData.includes('\n')) {
      e.preventDefault();

      const lines = pasteData.split('\n').filter(line => line.trim());
      const colIndex = columns.findIndex(c => c.key === colKey);

      // 필요한 만큼 행 추가
      const neededRows = rowIndex + lines.length;
      let newRows = [...rows];

      while (newRows.length < neededRows) {
        const newRow = { _id: Date.now() + Math.random() + newRows.length };
        columns.forEach(col => {
          newRow[col.key] = col.defaultValue || '';
        });
        newRows.push(newRow);
      }

      // 데이터 채우기
      lines.forEach((line, lineIdx) => {
        const cells = line.split('\t');
        cells.forEach((cell, cellIdx) => {
          const targetColIndex = colIndex + cellIdx;
          if (targetColIndex < columns.length) {
            const targetRowIndex = rowIndex + lineIdx;
            if (targetRowIndex < newRows.length) {
              const targetColumn = columns[targetColIndex];
              const cellValue = cell.trim();

              // 드롭다운 컬럼인 경우 값 매칭
              const finalValue = matchSelectValue(targetColumn, cellValue);
              newRows[targetRowIndex][targetColumn.key] = finalValue;
            }
          }
        });
      });

      setRows(newRows);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="bulk-add-modal-overlay"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", damping: 20 }}
          className="bulk-add-modal"
        >
          <div className="bulk-add-header">
            <h3>{categoryLabel} 일괄 추가</h3>
            <button onClick={onClose} className="close-btn">×</button>
          </div>

          <div className="bulk-add-content">
            <div className="bulk-add-instructions">
              <p>여러 항목을 한 번에 추가할 수 있습니다. 엑셀에서 복사하여 붙여넣기도 가능합니다.</p>
            </div>

            {error && (
              <div className="bulk-add-error">
                {error}
              </div>
            )}

            <div className="bulk-add-table-wrapper">
              <table className="bulk-add-table">
                <thead>
                  <tr>
                    <th className="row-number">#</th>
                    {columns.map(col => (
                      <th key={col.key} className={col.required ? 'required' : ''}>
                        {col.label}
                        {col.required && <span className="required-mark">*</span>}
                      </th>
                    ))}
                    <th className="actions">삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr key={row._id}>
                      <td className="row-number">{rowIndex + 1}</td>
                      {columns.map(col => (
                        <td key={col.key}>
                          {col.type === 'select' ? (
                            <select
                              value={row[col.key] || ''}
                              onChange={(e) => handleCellChange(rowIndex, col.key, e.target.value)}
                              className="bulk-input"
                            >
                              {col.options.map(opt => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          ) : col.type === 'color' ? (
                            <input
                              type="color"
                              value={row[col.key] || col.defaultValue || '#64748B'}
                              onChange={(e) => handleCellChange(rowIndex, col.key, e.target.value)}
                              className="bulk-color-input"
                            />
                          ) : (
                            <input
                              type="text"
                              value={row[col.key] || ''}
                              onChange={(e) => handleCellChange(rowIndex, col.key, e.target.value)}
                              onPaste={(e) => handlePaste(e, rowIndex, col.key)}
                              placeholder={col.placeholder}
                              className="bulk-input"
                            />
                          )}
                        </td>
                      ))}
                      <td className="actions">
                        <button
                          onClick={() => handleRemoveRow(rowIndex)}
                          className="remove-row-btn"
                          disabled={rows.length <= 1}
                          title="행 삭제"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button onClick={handleAddRow} className="add-row-btn">
              + 행 추가
            </button>
          </div>

          <div className="bulk-add-footer">
            <button onClick={onClose} className="cancel-btn">
              취소
            </button>
            <button onClick={handleSubmit} className="submit-btn">
              {rows.filter(r => r.name && r.name.trim()).length}개 항목 추가
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default BulkAddModal;
