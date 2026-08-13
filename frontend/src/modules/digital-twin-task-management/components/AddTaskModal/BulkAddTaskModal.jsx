import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { X, Plus, Trash2, Copy } from 'lucide-react';
import { fetchSystemSettings } from '../../../digital-twin-dashboard/services/settingsApi';
import { settingsData as defaultSettingsData } from '../../../digital-twin-dashboard/data/sampleDataV2';

const Overlay = styled.div`
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
`;

const Modal = styled.div`
  background: white;
  border-radius: 16px;
  width: 90%;
  max-width: 1100px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,0.25);
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #e2e8f0;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const CloseBtn = styled.button`
  background: none; border: none;
  color: #64748b; cursor: pointer;
  padding: 4px; border-radius: 6px;
  &:hover { background: #f1f5f9; color: #1e293b; }
`;

const Body = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem 1.5rem;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const Th = styled.th`
  padding: 8px 10px;
  text-align: left;
  font-size: 0.75rem;
  font-weight: 700;
  color: #475569;
  border-bottom: 2px solid #e2e8f0;
  white-space: nowrap;
  &:last-child { width: 40px; text-align: center; }
`;

const Td = styled.td`
  padding: 6px 6px;
  vertical-align: top;
  border-bottom: 1px solid #f1f5f9;
  &:last-child { text-align: center; vertical-align: middle; }
`;

const Input = styled.input`
  width: 100%;
  padding: 6px 10px;
  border: 1px solid ${p => p.$error ? '#ef4444' : '#e2e8f0'};
  border-radius: 6px;
  font-size: 0.82rem;
  color: #1e293b;
  outline: none;
  &:focus { border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99,102,241,0.15); }
  &::placeholder { color: #cbd5e1; }
`;

const SimIdGroup = styled.div`
  display: flex;
  align-items: center;
`;

const SimPrefix = styled.span`
  padding: 6px 8px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-right: none;
  border-radius: 6px 0 0 6px;
  font-size: 0.78rem;
  font-weight: 600;
  color: #475569;
  white-space: nowrap;
`;

const SimInput = styled.input`
  width: 60px;
  padding: 6px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 0 6px 6px 0;
  font-size: 0.82rem;
  color: #1e293b;
  outline: none;
  &:focus { border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99,102,241,0.15); }
  &::placeholder { color: #cbd5e1; }
`;

const DivisionToggle = styled.button`
  display: inline-block;
  padding: 3px 8px;
  margin: 2px;
  border-radius: 12px;
  font-size: 0.68rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid ${p => p.$active ? p.$color || '#6366f1' : '#d1d5db'};
  background: ${p => p.$active ? p.$color || '#6366f1' : 'white'};
  color: ${p => p.$active ? 'white' : '#6b7280'};
  transition: all 0.15s;
`;

const CorpInput = styled.input`
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.78rem;
  color: #1e293b;
  outline: none;
  &:focus { border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99,102,241,0.15); }
  &::placeholder { color: #cbd5e1; }
`;

const CorpTags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  margin-top: 4px;
`;

const CorpTag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 7px;
  border-radius: 10px;
  font-size: 0.68rem;
  font-weight: 500;
  color: #065f46;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  cursor: pointer;
  &:hover { background: #fef2f2; color: #ef4444; border-color: #fca5a5; }
`;

const ActionBtn = styled.button`
  background: none; border: none;
  color: #94a3b8; cursor: pointer;
  padding: 4px; border-radius: 6px;
  &:hover { background: ${p => p.$danger ? '#fef2f2' : '#f1f5f9'}; color: ${p => p.$danger ? '#ef4444' : '#3b82f6'}; }
`;

const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-top: 1px solid #e2e8f0;
`;

const AddRowBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  background: white;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  &:hover { border-color: #6366f1; color: #6366f1; background: #f5f3ff; }
`;

const SubmitBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 20px;
  background: #6366f1;
  border: none;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  color: white;
  cursor: pointer;
  &:hover { background: #4f46e5; }
  &:disabled { background: #c7d2fe; cursor: not-allowed; }
`;

const RowNum = styled.span`
  font-size: 0.75rem;
  color: #94a3b8;
  font-weight: 600;
`;

const EMPTY_ROW = { 식별번호: '', 과제명: '', 사업부: [], 법인입력: '', 법인: [] };

const BulkAddTaskModal = ({ isOpen, onClose, onSubmit, corporations = [] }) => {
  const [rows, setRows] = useState([{ ...EMPTY_ROW }]);
  const [divisions, setDivisions] = useState([]);
  const [divisionColors, setDivisionColors] = useState({});

  useEffect(() => {
    if (!isOpen) return;
    setRows([{ ...EMPTY_ROW }, { ...EMPTY_ROW }, { ...EMPTY_ROW }]);
    const load = async () => {
      let divs = defaultSettingsData?.divisions || [];
      try {
        const db = await fetchSystemSettings();
        if (db?.divisions?.length > 0) divs = db.divisions;
      } catch (e) { /* fallback */ }
      setDivisions(divs);
      const cm = {};
      divs.forEach(d => { cm[d.name] = d.color; });
      setDivisionColors(cm);
    };
    load();
  }, [isOpen]);

  const updateRow = useCallback((idx, field, value) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }, []);

  const toggleDivision = useCallback((idx, divName) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const has = r.사업부.includes(divName);
      return { ...r, 사업부: has ? r.사업부.filter(n => n !== divName) : [...r.사업부, divName] };
    }));
  }, []);

  // 법인 추가: corporations 리스트에 있는 값만 허용
  const addCorp = useCallback((idx) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const val = r.법인입력.trim();
      if (!val || r.법인.includes(val)) return { ...r, 법인입력: '' };
      const match = corporations.find(c => c.name === val || c.name.toLowerCase() === val.toLowerCase());
      if (!match) return r;
      if (r.법인.includes(match.name)) return { ...r, 법인입력: '' };
      return { ...r, 법인: [...r.법인, match.name], 법인입력: '' };
    }));
  }, [corporations]);

  // 테이블 전체 붙여넣기 핸들러
  // 엑셀/스프레드시트에서 복사한 데이터를 행(줄바꿈)/열(탭) 기준으로 파싱
  // 열 순서: 식별번호, 과제명, 사업부, 법인
  const handleTablePaste = useCallback((e) => {
    const text = e.clipboardData?.getData('text') || '';
    if (!text.trim()) return;

    // 탭이나 줄바꿈이 포함된 경우만 테이블 파싱 (단일 셀 입력은 기본 동작 유지)
    if (!text.includes('\t') && !text.includes('\n')) return;

    e.preventDefault();

    const divNames = divisions.map(d => d.name);
    const corpNames = corporations.map(c => c.name);

    // 포커스된 셀의 행/열 인덱스 파악
    const activeEl = document.activeElement;
    let startRow = 0;
    let startCol = 0;
    if (activeEl) {
      const td = activeEl.closest('td');
      const tr = td?.closest('tr');
      const tbody = tr?.closest('tbody');
      if (tbody && tr && td) {
        const allRows = Array.from(tbody.querySelectorAll('tr'));
        startRow = allRows.indexOf(tr);
        const allCells = Array.from(tr.querySelectorAll('td'));
        const cellIdx = allCells.indexOf(td);
        // 셀 인덱스 → 데이터 열 매핑: 0=#, 1=식별ID, 2=과제명, 3=사업부, 4=법인, 5=액션
        const colMap = { 1: 0, 2: 1, 3: 2, 4: 3 };
        startCol = colMap[cellIdx] ?? 0;
      }
    }

    const pastedRows = text.split(/\r?\n/).filter(line => line.trim());

    setRows(prev => {
      const next = [...prev];
      // 부족한 행 자동 추가
      while (next.length < startRow + pastedRows.length) {
        next.push({ ...EMPTY_ROW });
      }

      pastedRows.forEach((line, ri) => {
        const cols = line.split('\t');
        const rowIdx = startRow + ri;
        const row = { ...next[rowIdx], 사업부: [...next[rowIdx].사업부], 법인: [...next[rowIdx].법인] };

        cols.forEach((cellVal, ci) => {
          const val = cellVal.trim();
          if (!val) return;
          const colIdx = startCol + ci;

          switch (colIdx) {
            case 0: // 식별번호
              row.식별번호 = val.replace(/[^0-9]/g, '');
              break;
            case 1: // 과제명
              row.과제명 = val;
              break;
            case 2: { // 사업부
              const tokens = val.split(/[,;/]+/).map(s => s.trim()).filter(Boolean);
              const matched = tokens.filter(t => divNames.includes(t));
              row.사업부 = [...new Set([...row.사업부, ...matched])];
              break;
            }
            case 3: { // 법인
              const tokens = val.split(/[,;/]+/).map(s => s.trim()).filter(Boolean);
              const matched = tokens.filter(t => corpNames.includes(t));
              row.법인 = [...new Set([...row.법인, ...matched])];
              break;
            }
            default:
              break;
          }
        });

        next[rowIdx] = row;
      });

      return next;
    });
  }, [divisions, corporations]);

  const removeCorp = useCallback((idx, corp) => {
    setRows(prev => prev.map((r, i) =>
      i === idx ? { ...r, 법인: r.법인.filter(c => c !== corp) } : r
    ));
  }, []);

  const addRow = () => setRows(prev => [...prev, { ...EMPTY_ROW }]);

  const duplicateRow = (idx) => {
    setRows(prev => {
      const copy = { ...prev[idx], 사업부: [...prev[idx].사업부], 법인: [...prev[idx].법인] };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  };

  const removeRow = (idx) => {
    setRows(prev => prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = () => {
    const validRows = rows.filter(r => r.과제명.trim());
    if (validRows.length === 0) return;

    const tasksToAdd = validRows.map(r => ({
      식별번호: r.식별번호,
      식별ID: r.식별번호 ? `Sim-${r.식별번호.padStart(3, '0')}` : '',
      과제명: r.과제명.trim(),
      사업부: r.사업부,
      법인: r.법인,
      '라인/제품': [],
      선택대분류: [],
      분석액티비티: [],
      대분류액티비티: [],
    }));

    onSubmit(tasksToAdd);
    onClose();
  };

  const validCount = rows.filter(r => r.과제명.trim()).length;

  if (!isOpen) return null;

  return (
    <Overlay onClick={onClose}>
      <Modal onClick={e => e.stopPropagation()}>
        <Header>
          <Title><Plus size={20} /> 여러 과제 추가</Title>
          <CloseBtn onClick={onClose}><X size={18} /></CloseBtn>
        </Header>

        <Body onPaste={handleTablePaste}>
          <Table>
            <thead>
              <tr>
                <Th style={{ width: '36px' }}>#</Th>
                <Th style={{ width: '100px' }}>식별 ID</Th>
                <Th style={{ width: '28%' }}>과제명 *</Th>
                <Th style={{ width: '25%' }}>사업부</Th>
                <Th>법인</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx}>
                  <Td><RowNum>{idx + 1}</RowNum></Td>
                  <Td>
                    <SimIdGroup>
                      <SimPrefix>Sim-</SimPrefix>
                      <SimInput
                        value={row.식별번호}
                        onChange={e => updateRow(idx, '식별번호', e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="001"
                      />
                    </SimIdGroup>
                  </Td>
                  <Td>
                    <Input
                      value={row.과제명}
                      onChange={e => updateRow(idx, '과제명', e.target.value)}
                      placeholder="과제명을 입력하세요"
                      $error={false}
                    />
                  </Td>
                  <Td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                      {divisions.map(div => (
                        <DivisionToggle
                          key={div.id}
                          type="button"
                          $active={row.사업부.includes(div.name)}
                          $color={div.color}
                          onClick={() => toggleDivision(idx, div.name)}
                        >
                          {div.name}
                        </DivisionToggle>
                      ))}
                    </div>
                  </Td>
                  <Td>
                    <CorpInput
                      value={row.법인입력}
                      onChange={e => updateRow(idx, '법인입력', e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCorp(idx); } }}
                      placeholder={corporations.length > 0 ? '법인명 입력 후 Enter (붙여넣기 가능)' : '설정에서 법인을 등록하세요'}
                      list={`corp-list-${idx}`}
                    />
                    <datalist id={`corp-list-${idx}`}>
                      {corporations.map(c => <option key={c.name} value={c.name} />)}
                    </datalist>
                    {row.법인.length > 0 && (
                      <CorpTags>
                        {row.법인.map(c => (
                          <CorpTag key={c} onClick={() => removeCorp(idx, c)}>
                            {c} ×
                          </CorpTag>
                        ))}
                      </CorpTags>
                    )}
                  </Td>
                  <Td>
                    <div style={{ display: 'flex', gap: '2px' }}>
                      <ActionBtn type="button" title="복제" onClick={() => duplicateRow(idx)}>
                        <Copy size={14} />
                      </ActionBtn>
                      <ActionBtn type="button" $danger title="삭제" onClick={() => removeRow(idx)}>
                        <Trash2 size={14} />
                      </ActionBtn>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Body>

        <Footer>
          <AddRowBtn type="button" onClick={addRow}>
            <Plus size={16} /> 행 추가
          </AddRowBtn>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
              {validCount}개 과제 입력됨
            </span>
            <SubmitBtn onClick={handleSubmit} disabled={validCount === 0}>
              <Plus size={16} /> {validCount}개 과제 추가
            </SubmitBtn>
          </div>
        </Footer>
      </Modal>
    </Overlay>
  );
};

export default BulkAddTaskModal;
