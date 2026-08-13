import React, { useState, useEffect, useCallback, useRef } from 'react';
import styled from 'styled-components';
import { X, Plus, Trash2, ChevronDown } from 'lucide-react';
import { useModuleCategories } from '../../contexts/ModuleCategoryContext';

const Overlay = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const Modal = styled.div`
  background: white;
  border-radius: 1rem;
  width: 960px;
  max-height: 85vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  position: relative;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
`;

const Title = styled.h3`
  font-size: 1rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
`;

const CloseBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px; height: 32px;
  border: none; background: none;
  cursor: pointer; color: #64748b;
  border-radius: 0.375rem;
  &:hover { background: #f1f5f9; color: #1e293b; }
`;

const Body = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem 1.5rem;
`;

const PasteHint = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  margin-bottom: 0.75rem;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  color: #1e40af;

  kbd {
    display: inline-block;
    padding: 0.125rem 0.375rem;
    background: white;
    border: 1px solid #93c5fd;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-family: inherit;
    font-weight: 600;
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const Th = styled.th`
  text-align: left;
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
  padding: 0.5rem;
  border-bottom: 2px solid #e2e8f0;
  white-space: nowrap;

  &:last-child {
    width: 36px;
    text-align: center;
  }
`;

const Td = styled.td`
  padding: 0.375rem 0.5rem;
  vertical-align: middle;

  &:last-child {
    width: 36px;
    text-align: center;
  }
`;

const Input = styled.input`
  width: 100%;
  padding: 0.5rem 0.625rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  color: #1e293b;
  background: white;
  outline: none;
  box-sizing: border-box;

  &:focus {
    border-color: #8b5cf6;
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.1);
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 0.5rem 0.625rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  color: #1e293b;
  background: white;
  outline: none;
  cursor: pointer;
  box-sizing: border-box;

  &:focus {
    border-color: #8b5cf6;
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.1);
  }
`;

const DeleteBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px; height: 28px;
  border: none; background: none;
  cursor: pointer; color: #cbd5e1;
  border-radius: 0.25rem; padding: 0;
  &:hover { background: #fee2e2; color: #ef4444; }
`;

const AddRowBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.75rem;
  padding: 0.5rem 0.875rem;
  border: 1px dashed #cbd5e1;
  border-radius: 0.5rem;
  background: #fafbfc;
  font-size: 0.8125rem;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: #8b5cf6;
    color: #8b5cf6;
    background: #f5f3ff;
  }
`;

const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-top: 1px solid #e2e8f0;
  flex-shrink: 0;
`;

const Count = styled.span`
  font-size: 0.8125rem;
  color: #64748b;
`;

const FooterButtons = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const Btn = styled.button`
  padding: 0.5rem 1.25rem;
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
`;

const CancelBtn = styled(Btn)`
  border: 1px solid #e2e8f0;
  background: white;
  color: #475569;
  &:hover { background: #f8fafc; }
`;

const SaveBtn = styled(Btn)`
  border: none;
  background: #8b5cf6;
  color: white;
  &:hover { background: #7c3aed; }
  &:disabled { background: #c4b5fd; cursor: not-allowed; }
`;

const PasteToast = styled.div`
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  padding: 0.75rem 1.5rem;
  background: #1e293b;
  color: white;
  border-radius: 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  z-index: 10;
  pointer-events: none;
  animation: fadeOut 1.5s ease forwards;

  @keyframes fadeOut {
    0%, 70% { opacity: 1; }
    100% { opacity: 0; }
  }
`;

// ===== Compact Multi-Select for Bulk Modal =====
const BulkMultiWrapper = styled.div`
  position: relative;
`;

const BulkMultiTrigger = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px;
  min-height: 32px;
  width: 100%;
  padding: 0.25rem 0.5rem;
  border: 1px solid ${props => props.$open ? '#8b5cf6' : '#e2e8f0'};
  border-radius: 0.375rem;
  font-size: 0.75rem;
  background: white;
  cursor: pointer;
  box-sizing: border-box;
`;

const BulkMultiTag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 0 0.375rem;
  background: #f1f5f9;
  border-radius: 3px;
  font-size: 0.6875rem;
  color: #334155;
  white-space: nowrap;
  line-height: 1.6;
`;

const BulkMultiTagX = styled.button`
  display: flex;
  align-items: center;
  border: none;
  background: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 0;
  &:hover { color: #475569; }
`;

const BulkMultiPlaceholder = styled.span`
  color: #94a3b8;
  font-size: 0.75rem;
`;

const BulkMultiDrop = styled.div`
  position: absolute;
  top: calc(100% + 2px);
  left: 0;
  min-width: 100%;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  box-shadow: 0 6px 16px rgba(0,0,0,0.1);
  z-index: 200;
  max-height: 160px;
  overflow-y: auto;
`;

const BulkMultiOpt = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.5rem;
  font-size: 0.75rem;
  cursor: pointer;
  background: ${props => props.$sel ? '#f5f3ff' : 'transparent'};
  color: ${props => props.$sel ? '#7c3aed' : '#334155'};
  font-weight: ${props => props.$sel ? '600' : '400'};
  &:hover { background: ${props => props.$sel ? '#f5f3ff' : '#f8fafc'}; }
`;

const BulkMultiCheck = styled.span`
  width: 12px;
  height: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid ${props => props.$c ? '#8b5cf6' : '#d1d5db'};
  border-radius: 2px;
  background: ${props => props.$c ? '#8b5cf6' : 'white'};
  color: white;
  font-size: 0.5rem;
  flex-shrink: 0;
`;

const BulkCategorySelect = ({ options, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const toggle = (opt) => {
    if (value.includes(opt)) onChange(value.filter(v => v !== opt));
    else onChange([...value, opt]);
  };

  const removeTag = (e, opt) => { e.stopPropagation(); onChange(value.filter(v => v !== opt)); };

  return (
    <BulkMultiWrapper ref={ref}>
      <BulkMultiTrigger $open={open} onClick={() => setOpen(!open)}>
        {value.length === 0 ? (
          <BulkMultiPlaceholder>(선택)</BulkMultiPlaceholder>
        ) : (
          value.map(v => (
            <BulkMultiTag key={v}>
              {v}
              <BulkMultiTagX type="button" onClick={(e) => removeTag(e, v)}><X size={8} /></BulkMultiTagX>
            </BulkMultiTag>
          ))
        )}
      </BulkMultiTrigger>
      {open && (
        <BulkMultiDrop>
          {options.map(opt => (
            <BulkMultiOpt key={opt} $sel={value.includes(opt)} onClick={() => toggle(opt)}>
              <BulkMultiCheck $c={value.includes(opt)}>{value.includes(opt) && '✓'}</BulkMultiCheck>
              {opt}
            </BulkMultiOpt>
          ))}
        </BulkMultiDrop>
      )}
    </BulkMultiWrapper>
  );
};

const genId = () => `row-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

const emptyRow = (divisionId) => ({ id: genId(), divisionId: divisionId || '', name: '', categories: [], systemType: '' });

const BulkModuleModal = ({ isOpen, departments, activeDivision, onClose, onSave }) => {
  const { categories, systems } = useModuleCategories();
  const [rows, setRows] = useState([]);
  const [pasteMsg, setPasteMsg] = useState(null);

  const defaultDivision = activeDivision || (departments.length > 0 ? departments[0].id : '');

  useEffect(() => {
    if (isOpen) {
      setRows([emptyRow(defaultDivision), emptyRow(defaultDivision), emptyRow(defaultDivision)]);
      setPasteMsg(null);
    }
  }, [isOpen]);

  const handleChange = (rowId, field, val) => {
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, [field]: val } : r));
  };

  const handleDelete = (rowId) => {
    setRows(prev => prev.filter(r => r.id !== rowId));
  };

  const handleAddRow = () => {
    setRows(prev => [...prev, emptyRow(defaultDivision)]);
  };

  const handlePaste = useCallback((e) => {
    const text = e.clipboardData?.getData('text/plain');
    if (!text || !text.includes('\t')) return;
    e.preventDefault();

    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) return;

    // category, systemType, department 매칭 (대소문자 무시)
    const catMap = new Map(categories.map(c => [c.toLowerCase(), c]));
    const sysMap = new Map(systems.map(s => [s.toLowerCase(), s]));
    const deptMap = new Map(departments.map(d => [d.name.toLowerCase(), d.id]));

    const newRows = lines.map(line => {
      const cols = line.split('\t');
      const name = (cols[0] || '').trim();
      const catRaw = (cols[1] || '').trim();
      const sysRaw = (cols[2] || '').trim();
      const deptRaw = (cols[3] || '').trim();
      const matchedDept = deptRaw ? deptMap.get(deptRaw.toLowerCase()) : null;
      // 쉼표(,)로 구분된 복수 카테고리 지원
      const parsedCats = catRaw
        ? catRaw.split(',').map(c => c.trim()).filter(Boolean).map(c => catMap.get(c.toLowerCase()) || c)
        : [];
      return {
        id: genId(),
        divisionId: matchedDept || defaultDivision,
        name,
        categories: parsedCats,
        systemType: sysMap.get(sysRaw.toLowerCase()) || sysRaw,
      };
    });

    setRows(prev => {
      const filled = prev.filter(r => r.name.trim());
      return [...filled, ...newRows];
    });

    setPasteMsg(`${newRows.length}개 행이 붙여넣기 되었습니다`);
    setTimeout(() => setPasteMsg(null), 2000);
  }, [categories, systems, departments, defaultDivision]);

  const validRows = rows.filter(r => r.name.trim());

  const handleApply = async () => {
    if (validRows.length === 0) return;

    const modulesToCreate = validRows.map(r => ({
      name: r.name.trim(),
      divisionId: r.divisionId || defaultDivision,
      categories: r.categories || [],
      systemType: r.systemType || null,
      links: [],
      description: null,
      specs: [],
    }));

    await onSave(modulesToCreate);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Overlay onClick={onClose}>
      <Modal onClick={(e) => e.stopPropagation()} onPaste={handlePaste}>
        <Header>
          <Title>여러 모듈 추가</Title>
          <CloseBtn onClick={onClose}><X size={18} /></CloseBtn>
        </Header>
        <Body>
          <PasteHint>
            엑셀에서 복사 후 <kbd>Ctrl</kbd>+<kbd>V</kbd> 붙여넣기 (열 순서: 모듈명, 구분, 시스템, 사업부)
          </PasteHint>
          <Table>
            <thead>
              <tr>
                <Th style={{ width: '30%' }}>모듈명 *</Th>
                <Th style={{ width: '20%' }}>구분</Th>
                <Th style={{ width: '20%' }}>시스템</Th>
                <Th style={{ width: '20%' }}>사업부</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.id}>
                  <Td>
                    <Input
                      value={row.name}
                      onChange={(e) => handleChange(row.id, 'name', e.target.value)}
                      placeholder="모듈명 입력..."
                      autoFocus={idx === 0}
                    />
                  </Td>
                  <Td>
                    <BulkCategorySelect
                      options={categories}
                      value={row.categories || []}
                      onChange={(val) => handleChange(row.id, 'categories', val)}
                    />
                  </Td>
                  <Td>
                    <Select
                      value={row.systemType}
                      onChange={(e) => handleChange(row.id, 'systemType', e.target.value)}
                    >
                      <option value="">(선택)</option>
                      {systems.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </Select>
                  </Td>
                  <Td>
                    <Select
                      value={row.divisionId}
                      onChange={(e) => handleChange(row.id, 'divisionId', e.target.value)}
                    >
                      <option value="">(선택)</option>
                      <option value="__all__">전체 (공용)</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </Select>
                  </Td>
                  <Td>
                    <DeleteBtn onClick={() => handleDelete(row.id)}>
                      <Trash2 size={14} />
                    </DeleteBtn>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <AddRowBtn onClick={handleAddRow}>
            <Plus size={14} />
            행 추가
          </AddRowBtn>
        </Body>
        <Footer>
          <Count>
            {validRows.length > 0 ? `${validRows.length}개 모듈 추가 예정` : '모듈명을 입력하세요'}
          </Count>
          <FooterButtons>
            <CancelBtn onClick={onClose}>취소</CancelBtn>
            <SaveBtn onClick={handleApply} disabled={validRows.length === 0}>
              추가
            </SaveBtn>
          </FooterButtons>
        </Footer>
        {pasteMsg && <PasteToast>{pasteMsg}</PasteToast>}
      </Modal>
    </Overlay>
  );
};

export default BulkModuleModal;
