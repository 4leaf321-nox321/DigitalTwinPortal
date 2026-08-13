import React, { useState, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import {
  saveTargets as saveTargetsApi,
  saveCriteria as saveCriteriaApi,
  createKpiDefinition,
  updateKpiDefinition,
  deleteKpiDefinition,
} from '../services/kpiApi';

const DIVISIONS = [
  { id: 'mx', name: 'MX' },
  { id: 'vd', name: 'VD' },
  { id: 'da', name: 'DA' },
  { id: 'nw', name: 'NW' },
  { id: 'medical', name: '의료기기' },
];

const DIVISION_ID_BY_NAME = DIVISIONS.reduce((acc, d) => { acc[d.name] = d.id; return acc; }, {});

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
const MONTHS_LIST = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

const CATEGORY_COLORS = {
  '개발': '#1d4ed8',
  '제조': '#15803d',
  '품질': '#b45309',
};

/* ── Styled ── */
const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
`;

const Modal = styled.div`
  background: #fff;
  border-radius: 16px;
  width: 80vw;
  height: 80vh;
  display: grid;
  grid-template-rows: auto auto 1fr auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
  overflow: hidden;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
`;

const CloseBtn = styled.button`
  background: none;
  border: none;
  font-size: 22px;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px;
  line-height: 1;
  &:hover { color: #475569; }
`;

const Body = styled.div`
  min-height: 0;
  max-height: calc(80vh - 170px);
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const Controls = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
`;

const Label = styled.label`
  font-size: 13px;
  font-weight: 600;
  color: #475569;
`;

const Select = styled.select`
  padding: 8px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 14px;
  color: #334155;
  background: #fff;
  outline: none;
  &:focus { border-color: #8b5cf6; box-shadow: 0 0 0 3px rgba(139,92,246,0.15); }
`;

const YearSelector = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: white;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid #e2e8f0;
`;

const YearButton = styled.button`
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #475569;
  padding: 0.375rem 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #e2e8f0;
    border-color: #94a3b8;
    color: #334155;
  }

  &:active {
    transform: scale(0.98);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const YearDisplay = styled.div`
  font-size: 1rem;
  font-weight: 700;
  color: #1e293b;
  min-width: 60px;
  text-align: center;
`;

const TableWrap = styled.div`
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;

  th {
    background: #f8fafc;
    padding: 10px 14px;
    text-align: center;
    font-size: 13px;
    font-weight: 600;
    color: #64748b;
    border-bottom: 1px solid #e2e8f0;
    white-space: nowrap;
  }

  td {
    padding: 8px 10px;
    font-size: 14px;
    color: #334155;
    border-bottom: 1px solid #f1f5f9;
    text-align: center;
  }

  tr:last-child td {
    border-bottom: none;
  }

  tr:hover td {
    background: #fafbfc;
  }
`;

const KpiName = styled.td`
  text-align: left !important;
  font-weight: 500;
  white-space: nowrap;
`;

const UnitSpan = styled.span`
  font-size: 11px;
  color: #94a3b8;
  margin-left: 4px;
`;

const CategoryCell = styled.td`
  font-size: 12px;
  font-weight: 600;
  color: ${p => p.$color};
`;

const TargetInput = styled.input`
  width: 80px;
  padding: 6px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 13px;
  text-align: center;
  color: #334155;
  outline: none;
  background: #fff;
  transition: border-color 0.15s;
  &:focus {
    border-color: #8b5cf6;
    box-shadow: 0 0 0 2px rgba(139,92,246,0.12);
  }
  &::placeholder { color: #cbd5e1; }
`;

const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 24px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
  flex-shrink: 0;
`;

const Btn = styled.button`
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s;
`;

const CancelBtn = styled(Btn)`
  background: #fff;
  color: #64748b;
  border-color: #e2e8f0;
  &:hover { background: #f1f5f9; }
`;

const SaveBtn = styled(Btn)`
  background: #8b5cf6;
  color: #fff;
  &:hover { background: #7c3aed; }
`;

const PeriodToggle = styled.div`
  display: flex;
  background: #f1f5f9;
  border-radius: 8px;
  padding: 3px;
  border: 1px solid #e2e8f0;
`;

const PeriodBtn = styled.button`
  padding: 6px 14px;
  border: none;
  background: ${p => p.$active ? '#8b5cf6' : 'transparent'};
  color: ${p => p.$active ? '#fff' : '#64748b'};
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  &:hover {
    background: ${p => p.$active ? '#7c3aed' : '#e2e8f0'};
  }
`;

const CriteriaInput = styled.input`
  width: 100%;
  min-width: 120px;
  padding: 6px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 12px;
  color: #334155;
  outline: none;
  background: #fff;
  transition: border-color 0.15s;
  &:focus {
    border-color: #8b5cf6;
    box-shadow: 0 0 0 2px rgba(139,92,246,0.12);
  }
  &::placeholder { color: #cbd5e1; }
`;

const TabBar = styled.div`
  display: flex;
  gap: 4px;
  border-bottom: 1px solid #e2e8f0;
  padding: 0 24px;
  background: #fff;
  flex-shrink: 0;
`;

// 모달 본문 스크롤 컨테이너
// 주의: display:flex column + 자식 flex-shrink:1 조합이면 자식이 압축돼서 overflow가 발생하지 않음
// 따라서 일반 블록 레이아웃 + 자식 간 margin-top으로 간격 처리
const ScrollBody = styled.div`
  position: absolute;
  top: 116px;
  height: calc(80vh - 181px);
  left: 0;
  right: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 24px;
  box-sizing: border-box;

  > * + * {
    margin-top: 16px;
  }
`;

const Tab = styled.button`
  padding: 12px 18px;
  background: none;
  border: none;
  border-bottom: 2px solid ${p => p.$active ? '#8b5cf6' : 'transparent'};
  color: ${p => p.$active ? '#7c3aed' : '#64748b'};
  font-size: 14px;
  font-weight: ${p => p.$active ? 700 : 500};
  cursor: pointer;
  transition: all 0.15s;
  &:hover { color: ${p => p.$active ? '#7c3aed' : '#334155'}; }
`;

const FractionInputGroup = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 2px;
`;

const FracInput = styled.input`
  width: 38px;
  padding: 5px 4px;
  border: 1px solid #e2e8f0;
  border-radius: 5px;
  font-size: 12px;
  text-align: center;
  outline: none;
  background: #fff;
  &:focus {
    border-color: #8b5cf6;
    box-shadow: 0 0 0 2px rgba(139,92,246,0.12);
  }
`;

const ComputedSpan = styled.span`
  font-size: 11px;
  font-weight: 700;
  color: ${p => p.$has ? '#0891b2' : '#cbd5e1'};
  margin-left: 2px;
  white-space: nowrap;
`;

const DefRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 90px 70px 110px 110px 90px 1fr 80px;
  gap: 8px;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #f1f5f9;
  &:last-child { border-bottom: none; }
`;

const DefHeader = styled(DefRow)`
  background: #f8fafc;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  border-bottom: 1px solid #e2e8f0;
`;

const TextInput = styled.input`
  padding: 6px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
  background: #fff;
  width: 100%;
  &:focus {
    border-color: #8b5cf6;
    box-shadow: 0 0 0 2px rgba(139,92,246,0.12);
  }
`;

const SmallSelect = styled.select`
  padding: 6px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 13px;
  background: #fff;
  outline: none;
  width: 100%;
  &:focus {
    border-color: #8b5cf6;
  }
`;

const DivChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
`;

const DivChip = styled.button`
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 12px;
  border: 1px solid ${p => p.$active ? '#8b5cf6' : '#e2e8f0'};
  background: ${p => p.$active ? '#8b5cf6' : '#fff'};
  color: ${p => p.$active ? '#fff' : '#64748b'};
  cursor: pointer;
  transition: all 0.15s;
  &:hover {
    border-color: #8b5cf6;
  }
`;

const IconBtn = styled.button`
  background: none;
  border: 1px solid #e2e8f0;
  color: ${p => p.$danger ? '#ef4444' : '#64748b'};
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  &:hover {
    background: ${p => p.$danger ? '#fef2f2' : '#f1f5f9'};
    border-color: ${p => p.$danger ? '#fecaca' : '#cbd5e1'};
  }
`;

// targets는 {value, numerator, denominator} 또는 문자열(역호환)
const normalizeTarget = (raw) => {
  if (raw == null) return { value: '', numerator: '', denominator: '' };
  if (typeof raw === 'string' || typeof raw === 'number') return { value: String(raw), numerator: '', denominator: '' };
  return {
    value: raw.value ?? '',
    numerator: raw.numerator ?? '',
    denominator: raw.denominator ?? '',
  };
};

const filterKpisForDivisionName = (definitions, divisionName) => {
  const id = DIVISION_ID_BY_NAME[divisionName];
  return definitions.filter(item => !item.divisions || item.divisions.length === 0 || item.divisions.includes(id));
};

const SettingsModal = ({
  targets,
  criteria,
  kpiDefinitions = [],
  onSave,
  onSaveCriteria,
  onKpiDefinitionsChange,
  onClose,
}) => {
  const baseYear = new Date().getFullYear();
  const minYear = baseYear - 2;
  const maxYear = baseYear + 10;

  const [activeTab, setActiveTab] = useState('targets'); // 'targets' | 'definitions'
  const [selectedYear, setSelectedYear] = useState(baseYear);
  const [selectedDivision, setSelectedDivision] = useState(DIVISIONS[0].name);
  // draft: key → {value, numerator, denominator}
  const [draft, setDraft] = useState(() => {
    const init = {};
    Object.entries(targets || {}).forEach(([k, v]) => { init[k] = normalizeTarget(v); });
    return init;
  });
  const [criteriaDraft, setCriteriaDraft] = useState(() => ({ ...criteria }));
  const [period, setPeriod] = useState('quarter');

  // KPI 정의 편집용 임시 상태 (id → {label, category, unit, valueType, divisions})
  const [editingDef, setEditingDef] = useState(null); // {id, label, ...} or null
  const [newDef, setNewDef] = useState({ label: '', category: '개발', unit: '', valueType: 'single', divisions: [], showRawData: true, direction: 'higher' });

  const columns = period === 'quarter' ? QUARTERS : MONTHS_LIST;

  const makeKey = (div, year, kpi, col) => `${div}|${year}|${kpi}|${col}`;

  const getDraftEntry = useCallback((kpi, col) => {
    const key = makeKey(selectedDivision, selectedYear, kpi, col);
    return draft[key] || { value: '', numerator: '', denominator: '' };
  }, [draft, selectedDivision, selectedYear]);

  const setDraftField = useCallback((kpi, col, field, val) => {
    const key = makeKey(selectedDivision, selectedYear, kpi, col);
    const kpiUnit = kpiDefinitions.find(k => k.label === kpi)?.unit ?? '';
    setDraft(prev => {
      const cur = prev[key] || { value: '', numerator: '', denominator: '' };
      const next = { ...cur, [field]: val };
      // fraction 입력 변경 시 value 자동 계산
      if (field === 'numerator' || field === 'denominator') {
        const n = parseFloat(field === 'numerator' ? val : next.numerator);
        const d = parseFloat(field === 'denominator' ? val : next.denominator);
        if (!isNaN(n) && !isNaN(d) && d !== 0) {
          next.value = (kpiUnit === '%' ? (n / d) * 100 : n / d).toFixed(1);
        } else {
          next.value = '';
        }
      }
      return { ...prev, [key]: next };
    });
  }, [selectedDivision, selectedYear, kpiDefinitions]);

  const filteredKpis = useMemo(
    () => filterKpisForDivisionName(kpiDefinitions, selectedDivision),
    [kpiDefinitions, selectedDivision]
  );

  const handleSave = async () => {
    try {
      // 빈 값은 보낼 필요 없음
      const cleanDraft = {};
      Object.entries(draft).forEach(([k, v]) => {
        const val = v?.value ?? '';
        if (val || v?.numerator || v?.denominator) {
          cleanDraft[k] = {
            value: val,
            numerator: v?.numerator || null,
            denominator: v?.denominator || null,
          };
        }
      });
      await Promise.all([
        saveTargetsApi(cleanDraft),
        saveCriteriaApi(criteriaDraft),
      ]);
      onSave(cleanDraft);
      onSaveCriteria(criteriaDraft);
      onClose();
    } catch (err) {
      console.error('설정 저장 실패:', err);
    }
  };

  // KPI 정의 핸들러
  const handleAddDefinition = async () => {
    if (!newDef.label.trim()) {
      alert('KPI 항목명을 입력하세요.');
      return;
    }
    try {
      const created = await createKpiDefinition({
        label: newDef.label.trim(),
        category: newDef.category,
        unit: newDef.unit,
        valueType: newDef.valueType,
        divisions: newDef.divisions,
        showRawData: newDef.valueType === 'fraction' ? !!newDef.showRawData : true,
        direction: newDef.direction || 'higher',
      });
      onKpiDefinitionsChange?.([...kpiDefinitions, created]);
      setNewDef({ label: '', category: '개발', unit: '', valueType: 'single', divisions: [], showRawData: true, direction: 'higher' });
    } catch (err) {
      alert(err.message || 'KPI 추가에 실패했습니다.');
    }
  };

  const handleSaveDefinition = async () => {
    if (!editingDef) return;
    if (!editingDef.label.trim()) {
      alert('KPI 항목명을 입력하세요.');
      return;
    }
    try {
      const updated = await updateKpiDefinition(editingDef.id, {
        label: editingDef.label.trim(),
        category: editingDef.category,
        unit: editingDef.unit,
        valueType: editingDef.valueType,
        divisions: editingDef.divisions,
        showRawData: editingDef.valueType === 'fraction' ? !!editingDef.showRawData : true,
        direction: editingDef.direction || 'higher',
      });
      onKpiDefinitionsChange?.(kpiDefinitions.map(d => d.id === updated.id ? updated : d));
      setEditingDef(null);
    } catch (err) {
      alert(err.message || 'KPI 수정에 실패했습니다.');
    }
  };

  const handleDeleteDefinition = async (id, label) => {
    if (!confirm(`"${label}" 항목을 삭제하시겠습니까?\n(이미 입력된 데이터/목표치는 유지되지만 항목 목록에서는 사라집니다)`)) return;
    try {
      await deleteKpiDefinition(id);
      onKpiDefinitionsChange?.(kpiDefinitions.filter(d => d.id !== id));
    } catch (err) {
      alert(err.message || 'KPI 삭제에 실패했습니다.');
    }
  };

  const toggleDivisionInDef = (defObj, setFn, divId) => {
    const next = (defObj.divisions || []).includes(divId)
      ? defObj.divisions.filter(x => x !== divId)
      : [...(defObj.divisions || []), divId];
    setFn({ ...defObj, divisions: next });
  };

  return (
    <Overlay onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative',
          background: '#fff',
          borderRadius: 16,
          width: '80vw',
          height: '80vh',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          overflow: 'hidden',
        }}
      >
        <ModalHeader style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1 }}>
          <Title>KPI 설정</Title>
          <CloseBtn onClick={onClose}>&times;</CloseBtn>
        </ModalHeader>
        <TabBar style={{ position: 'absolute', top: 65, left: 0, right: 0, zIndex: 1 }}>
          <Tab $active={activeTab === 'targets'} onClick={() => setActiveTab('targets')}>목표치 설정</Tab>
          <Tab $active={activeTab === 'definitions'} onClick={() => setActiveTab('definitions')}>KPI 정의 관리</Tab>
        </TabBar>
        <ScrollBody>
          {activeTab === 'targets' ? (
            <>
              <Controls>
                <Label>사업부</Label>
                <Select value={selectedDivision} onChange={e => setSelectedDivision(e.target.value)}>
                  {DIVISIONS.map(d => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </Select>
                <PeriodToggle style={{ marginLeft: 8 }}>
                  <PeriodBtn $active={period === 'quarter'} onClick={() => setPeriod('quarter')}>분기별</PeriodBtn>
                  <PeriodBtn $active={period === 'month'} onClick={() => setPeriod('month')}>월별</PeriodBtn>
                </PeriodToggle>
                <YearSelector style={{ marginLeft: 8 }}>
                  <YearButton
                    onClick={() => setSelectedYear(y => Math.max(minYear, y - 1))}
                    disabled={selectedYear <= minYear}
                    title="이전 년도"
                  >
                    ‹
                  </YearButton>
                  <YearDisplay>{selectedYear}년</YearDisplay>
                  <YearButton
                    onClick={() => setSelectedYear(y => Math.min(maxYear, y + 1))}
                    disabled={selectedYear >= maxYear}
                    title="다음 년도"
                  >
                    ›
                  </YearButton>
                </YearSelector>
              </Controls>

              <TableWrap style={{ overflowX: 'auto' }}>
                <Table>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', width: 60 }}>구분</th>
                      <th style={{ textAlign: 'left' }}>KPI 항목</th>
                      {columns.map(col => (
                        <th key={col} style={{ width: period === 'quarter' ? 140 : 110 }}>{col}</th>
                      ))}
                      {period === 'quarter' && <th style={{ textAlign: 'left', minWidth: 150 }}>산출 기준</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredKpis.map(item => {
                      const isFraction = item.valueType === 'fraction';
                      return (
                        <tr key={item.label}>
                          <CategoryCell $color={CATEGORY_COLORS[item.category] || '#64748b'}>
                            {item.category}
                          </CategoryCell>
                          <KpiName>
                            {item.label}
                            {item.unit && <UnitSpan>({item.unit})</UnitSpan>}
                            {isFraction && <UnitSpan style={{ color: '#0891b2' }}>분자/분모</UnitSpan>}
                          </KpiName>
                          {columns.map(col => {
                            const entry = getDraftEntry(item.label, col);
                            if (isFraction) {
                              const n = parseFloat(entry.numerator);
                              const d = parseFloat(entry.denominator);
                              const has = !isNaN(n) && !isNaN(d) && d !== 0;
                              return (
                                <td key={col}>
                                  <FractionInputGroup>
                                    <FracInput
                                      type="text"
                                      placeholder="분자"
                                      value={entry.numerator}
                                      onChange={e => setDraftField(item.label, col, 'numerator', e.target.value)}
                                    />
                                    <span style={{ fontSize: 11, color: '#94a3b8' }}>/</span>
                                    <FracInput
                                      type="text"
                                      placeholder="분모"
                                      value={entry.denominator}
                                      onChange={e => setDraftField(item.label, col, 'denominator', e.target.value)}
                                    />
                                    <ComputedSpan $has={has}>
                                      = {has ? `${entry.value}${item.unit || ''}` : '-'}
                                    </ComputedSpan>
                                  </FractionInputGroup>
                                </td>
                              );
                            }
                            return (
                              <td key={col}>
                                <TargetInput
                                  type="text"
                                  placeholder="-"
                                  style={period === 'month' ? { width: 60 } : undefined}
                                  value={entry.value}
                                  onChange={e => setDraftField(item.label, col, 'value', e.target.value)}
                                />
                              </td>
                            );
                          })}
                          {period === 'quarter' && (
                            <td>
                              <CriteriaInput
                                type="text"
                                placeholder="산출 기준 입력"
                                value={criteriaDraft[item.label] ?? ''}
                                onChange={e => setCriteriaDraft(prev => ({ ...prev, [item.label]: e.target.value }))}
                              />
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </TableWrap>
            </>
          ) : (
            <>
              {/* KPI 정의 관리 */}
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>
                KPI 항목을 추가/수정/삭제할 수 있습니다. 입력방식이 "분자/분모"인 항목은 데이터 입력 시 분자와 분모를 모두 입력하고 자동으로 % 값이 계산됩니다.
              </div>

              {/* 추가 폼 */}
              <div style={{ background: '#f8fafc', borderRadius: 12, padding: 12, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>+ 새 KPI 추가</div>
                <DefRow style={{ background: 'transparent', border: 'none' }}>
                  <TextInput
                    placeholder="KPI 항목명"
                    value={newDef.label}
                    onChange={e => setNewDef(d => ({ ...d, label: e.target.value }))}
                  />
                  <SmallSelect value={newDef.category} onChange={e => setNewDef(d => ({ ...d, category: e.target.value }))}>
                    <option value="개발">개발</option>
                    <option value="제조">제조</option>
                    <option value="품질">품질</option>
                  </SmallSelect>
                  <TextInput
                    placeholder="단위"
                    value={newDef.unit}
                    onChange={e => setNewDef(d => ({ ...d, unit: e.target.value }))}
                  />
                  <SmallSelect value={newDef.valueType} onChange={e => setNewDef(d => ({ ...d, valueType: e.target.value }))}>
                    <option value="single">단일값</option>
                    <option value="fraction">분자/분모</option>
                  </SmallSelect>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      fontSize: 12,
                      color: newDef.valueType === 'fraction' ? '#0891b2' : '#cbd5e1',
                      cursor: newDef.valueType === 'fraction' ? 'pointer' : 'not-allowed',
                      whiteSpace: 'nowrap',
                    }}
                    title={newDef.valueType === 'fraction' ? '체크 시 종합 표에 분자/분모 원본도 함께 표기' : '분자/분모 입력방식에서만 사용'}
                  >
                    <input
                      type="checkbox"
                      checked={newDef.valueType === 'fraction' ? !!newDef.showRawData : false}
                      disabled={newDef.valueType !== 'fraction'}
                      onChange={e => setNewDef(d => ({ ...d, showRawData: e.target.checked }))}
                    />
                    원본 표기
                  </label>
                  <SmallSelect
                    value={newDef.direction || 'higher'}
                    onChange={e => setNewDef(d => ({ ...d, direction: e.target.value }))}
                    title="망대: 높을수록 좋음 (달성률=실적/목표) / 망소: 낮을수록 좋음 (달성률=목표/실적)"
                  >
                    <option value="higher">↑ 망대</option>
                    <option value="lower">↓ 망소</option>
                  </SmallSelect>
                  <DivChips>
                    {DIVISIONS.map(d => {
                      const active = (newDef.divisions || []).includes(d.id);
                      return (
                        <DivChip
                          key={d.id}
                          $active={active}
                          onClick={() => toggleDivisionInDef(newDef, setNewDef, d.id)}
                          type="button"
                        >
                          {d.name}
                        </DivChip>
                      );
                    })}
                  </DivChips>
                  <SaveBtn style={{ padding: '8px 12px', fontSize: 13 }} onClick={handleAddDefinition}>추가</SaveBtn>
                </DefRow>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
                  사업부 미선택 시 전 사업부에 공통 적용됩니다.
                </div>
              </div>

              {/* 목록 */}
              <TableWrap style={{ marginTop: 12 }}>
                <DefHeader>
                  <div>KPI 항목명</div>
                  <div style={{ textAlign: 'center' }}>구분</div>
                  <div style={{ textAlign: 'center' }}>단위</div>
                  <div style={{ textAlign: 'center' }}>입력방식</div>
                  <div style={{ textAlign: 'center' }}>원본 표기</div>
                  <div style={{ textAlign: 'center' }} title="달성률 계산 방향">방향</div>
                  <div>적용 사업부</div>
                  <div style={{ textAlign: 'center' }}>관리</div>
                </DefHeader>
                {kpiDefinitions.map(item => {
                  const isEditing = editingDef?.id === item.id;
                  const cur = isEditing ? editingDef : item;
                  return (
                    <DefRow key={item.id}>
                      {isEditing ? (
                        <TextInput value={cur.label} onChange={e => setEditingDef(d => ({ ...d, label: e.target.value }))} />
                      ) : (
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{cur.label}</div>
                      )}
                      {isEditing ? (
                        <SmallSelect value={cur.category} onChange={e => setEditingDef(d => ({ ...d, category: e.target.value }))}>
                          <option value="개발">개발</option>
                          <option value="제조">제조</option>
                          <option value="품질">품질</option>
                        </SmallSelect>
                      ) : (
                        <div style={{ fontSize: 12, fontWeight: 600, color: CATEGORY_COLORS[cur.category] || '#64748b', textAlign: 'center' }}>
                          {cur.category}
                        </div>
                      )}
                      {isEditing ? (
                        <TextInput value={cur.unit || ''} onChange={e => setEditingDef(d => ({ ...d, unit: e.target.value }))} />
                      ) : (
                        <div style={{ fontSize: 12, color: '#64748b', textAlign: 'center' }}>{cur.unit || '-'}</div>
                      )}
                      {isEditing ? (
                        <SmallSelect value={cur.valueType} onChange={e => setEditingDef(d => ({ ...d, valueType: e.target.value }))}>
                          <option value="single">단일값</option>
                          <option value="fraction">분자/분모</option>
                        </SmallSelect>
                      ) : (
                        <div style={{ fontSize: 12, color: cur.valueType === 'fraction' ? '#0891b2' : '#64748b', textAlign: 'center', fontWeight: 600 }}>
                          {cur.valueType === 'fraction' ? '분자/분모' : '단일값'}
                        </div>
                      )}
                      {isEditing ? (
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            fontSize: 12,
                            color: cur.valueType === 'fraction' ? '#0891b2' : '#cbd5e1',
                            cursor: cur.valueType === 'fraction' ? 'pointer' : 'not-allowed',
                            whiteSpace: 'nowrap',
                          }}
                          title={cur.valueType === 'fraction' ? '체크 시 종합 표에 분자/분모 원본도 함께 표기' : '분자/분모 입력방식에서만 사용'}
                        >
                          <input
                            type="checkbox"
                            checked={cur.valueType === 'fraction' ? !!cur.showRawData : false}
                            disabled={cur.valueType !== 'fraction'}
                            onChange={e => setEditingDef(d => ({ ...d, showRawData: e.target.checked }))}
                          />
                          원본
                        </label>
                      ) : (
                        <div style={{ fontSize: 12, textAlign: 'center', color: cur.valueType === 'fraction' ? (cur.showRawData ? '#0891b2' : '#94a3b8') : '#cbd5e1', fontWeight: 600 }}>
                          {cur.valueType === 'fraction' ? (cur.showRawData ? '✓ 표기' : '미표기') : '-'}
                        </div>
                      )}
                      {isEditing ? (
                        <SmallSelect
                          value={cur.direction || 'higher'}
                          onChange={e => setEditingDef(d => ({ ...d, direction: e.target.value }))}
                          title="망대: 높을수록 좋음 / 망소: 낮을수록 좋음"
                        >
                          <option value="higher">↑ 망대</option>
                          <option value="lower">↓ 망소</option>
                        </SmallSelect>
                      ) : (
                        <div style={{
                          fontSize: 12, fontWeight: 600, textAlign: 'center',
                          color: (cur.direction || 'higher') === 'lower' ? '#dc2626' : '#059669',
                        }}>
                          {(cur.direction || 'higher') === 'lower' ? '↓ 망소' : '↑ 망대'}
                        </div>
                      )}
                      {isEditing ? (
                        <DivChips>
                          {DIVISIONS.map(d => {
                            const active = (cur.divisions || []).includes(d.id);
                            return (
                              <DivChip
                                key={d.id}
                                $active={active}
                                onClick={() => toggleDivisionInDef(cur, setEditingDef, d.id)}
                                type="button"
                              >
                                {d.name}
                              </DivChip>
                            );
                          })}
                        </DivChips>
                      ) : (
                        <div style={{ fontSize: 12, color: '#64748b' }}>
                          {(!cur.divisions || cur.divisions.length === 0) ? (
                            <span style={{ color: '#0891b2', fontWeight: 600 }}>전체</span>
                          ) : (
                            cur.divisions.map(id => DIVISIONS.find(x => x.id === id)?.name).filter(Boolean).join(', ')
                          )}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        {isEditing ? (
                          <>
                            <IconBtn onClick={handleSaveDefinition}>저장</IconBtn>
                            <IconBtn onClick={() => setEditingDef(null)}>취소</IconBtn>
                          </>
                        ) : (
                          <>
                            <IconBtn onClick={() => setEditingDef({ ...item, divisions: item.divisions || [], showRawData: item.showRawData !== false, direction: item.direction || 'higher' })}>수정</IconBtn>
                            <IconBtn $danger onClick={() => handleDeleteDefinition(item.id, item.label)}>삭제</IconBtn>
                          </>
                        )}
                      </div>
                    </DefRow>
                  );
                })}
              </TableWrap>
            </>
          )}
        </ScrollBody>
        <Footer style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1 }}>
          <CancelBtn onClick={onClose}>{activeTab === 'targets' ? '취소' : '닫기'}</CancelBtn>
          {activeTab === 'targets' && <SaveBtn onClick={handleSave}>저장</SaveBtn>}
        </Footer>
      </div>
    </Overlay>
  );
};

export default SettingsModal;
