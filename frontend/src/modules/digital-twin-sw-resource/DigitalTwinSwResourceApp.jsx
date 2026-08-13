import React, { useState, useEffect, useMemo, useRef } from 'react';
import styled from 'styled-components';
import { Cpu, Edit2, Trash2, Search, X, ChevronDown, Plus } from 'lucide-react';
import Header from './components/Layout/Header';
import BulkAddModal from './components/BulkAddModal';
import Dashboard from './components/Dashboard';
import { useAuth } from '../../contexts/AuthContext';

const API_BASE = '/api/digital-twin-sw-resource';
const DASHBOARD_API = '/api/digital-twin-dashboard';

const DEFAULT_CATEGORIES = [
  '구조해석', '유동해석', '열해석', '전자기해석',
  '시스템 시뮬레이션', '최적화', '전/후처리', '데이터 플랫폼',
  'CAD', 'CAM'
];

const DEFAULT_LICENSE_TYPES = [
  '오픈소스', '영구 라이선스', '임차 라이선스'
];

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f8fafc;
`;

const MainContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
`;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
  gap: 0.75rem;
  flex-wrap: wrap;
`;

const ToolbarLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const SearchBox = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;

  input {
    border: none;
    outline: none;
    font-size: 0.875rem;
    width: 200px;
    background: transparent;
    color: #1e293b;
    &::placeholder { color: #94a3b8; }
  }
`;

const FilterSelect = styled.select`
  padding: 0.5rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  background: white;
  color: #1e293b;
  cursor: pointer;
`;

const CountBadge = styled.span`
  font-size: 0.8rem;
  color: #64748b;
  margin-left: 0.25rem;
`;

const TableWrapper = styled.div`
  background: white;
  border-radius: 0.75rem;
  border: 1px solid #e2e8f0;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;

  th {
    background: #f8fafc;
    color: #475569;
    font-weight: 600;
    padding: 0.75rem 1rem;
    text-align: left;
    border-bottom: 2px solid #e2e8f0;
    white-space: nowrap;
    position: sticky;
    top: 0;
    z-index: 1;
  }

  td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #f1f5f9;
    color: #334155;
    vertical-align: middle;
  }

  tbody tr {
    transition: background 0.15s ease;
    &:hover {
      background: #f8fafc;
    }
  }
`;

const CategoryBadge = styled.span`
  display: inline-block;
  padding: 0.2rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  background: #e0f2fe;
  color: #0369a1;
`;

const LicenseTypeBadge = styled.span`
  display: inline-block;
  padding: 0.2rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  background: ${({ type }) =>
    type === '오픈소스' ? '#dcfce7' :
    type === '영구 라이선스' ? '#ede9fe' :
    type === '임차 라이선스' ? '#fef3c7' : '#f1f5f9'};
  color: ${({ type }) =>
    type === '오픈소스' ? '#166534' :
    type === '영구 라이선스' ? '#5b21b6' :
    type === '임차 라이선스' ? '#92400e' : '#475569'};
`;

const NatureBadge = styled.span`
  display: inline-block;
  padding: 0.2rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  background: ${({ nature }) => nature === 'addon' ? '#fef3c7' : '#dcfce7'};
  color: ${({ nature }) => nature === 'addon' ? '#92400e' : '#166534'};
`;

const ActionGroup = styled.div`
  display: flex;
  gap: 0.25rem;
`;

const IconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.375rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  background: white;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #f8fafc;
    border-color: ${({ variant }) => variant === 'danger' ? '#ef4444' : '#0ea5e9'};
    color: ${({ variant }) => variant === 'danger' ? '#ef4444' : '#0ea5e9'};
  }
`;

const EmptyState = styled.div`
  padding: 4rem 2rem;
  text-align: center;
  color: #94a3b8;

  svg { margin-bottom: 1rem; opacity: 0.5; }
  p { font-size: 0.9375rem; margin: 0.25rem 0; }
`;


/* ---- Modal ---- */
const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 1rem;
`;

const ModalBox = styled.div`
  background: white;
  border-radius: 1rem;
  width: 100%;
  max-width: 600px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px rgba(0,0,0,0.15);
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #e2e8f0;

  h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: #1e293b;
  }
`;

const CloseBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.375rem;
  border: none;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  border-radius: 0.5rem;
  &:hover { background: #f1f5f9; color: #1e293b; }
`;

const ModalBody = styled.div`
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`;

const FormGroup = styled.div`
  &.full { grid-column: 1 / -1; }

  label {
    display: block;
    font-size: 0.8125rem;
    font-weight: 600;
    color: #475569;
    margin-bottom: 0.375rem;
  }

  input, select, textarea {
    width: 100%;
    padding: 0.625rem 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    color: #1e293b;
    transition: border-color 0.2s;
    box-sizing: border-box;
    &:focus { outline: none; border-color: #0ea5e9; }
  }

  textarea { min-height: 80px; resize: vertical; }
`;

const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid #e2e8f0;
`;

const Btn = styled.button`
  padding: 0.625rem 1.25rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;

  &.primary {
    background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
    color: white;
    &:hover { box-shadow: 0 4px 12px rgba(14,165,233,0.3); }
  }

  &.secondary {
    background: white;
    color: #64748b;
    border: 1px solid #e2e8f0;
    &:hover { background: #f8fafc; }
  }
`;

/* ---- Multi-Select ComboBox (태그 방식) ---- */
const ComboWrapper = styled.div`
  position: relative;
`;

const ComboInput = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.375rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  padding: 0.375rem 0.5rem;
  min-height: 2.5rem;
  transition: border-color 0.2s;
  &:focus-within { border-color: #0ea5e9; }

  input {
    flex: 1;
    min-width: 80px;
    padding: 0.25rem 0.25rem;
    border: none;
    outline: none;
    font-size: 0.875rem;
    color: #1e293b;
    background: transparent;
    &::placeholder { color: #94a3b8; }
  }

  .toggle-btn {
    padding: 0 0.25rem;
    border: none;
    background: transparent;
    color: #94a3b8;
    cursor: pointer;
    display: flex;
    align-items: center;
    flex-shrink: 0;
    &:hover { color: #475569; }
  }
`;

const Tag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.15rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  background: #e0f2fe;
  color: #0369a1;

  button {
    display: flex;
    align-items: center;
    border: none;
    background: transparent;
    color: #0369a1;
    cursor: pointer;
    padding: 0;
    &:hover { color: #ef4444; }
  }
`;

const ComboDropdown = styled.div`
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
  max-height: 200px;
  overflow-y: auto;
  z-index: 20;
`;

const ComboOption = styled.div`
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  color: #334155;
  cursor: pointer;
  transition: background 0.1s;
  &:hover { background: #f0f9ff; color: #0369a1; }

  &.selected {
    background: #f0f9ff;
    color: #0369a1;
    font-weight: 500;
  }

  &.add-new {
    color: #0ea5e9;
    font-weight: 500;
    border-top: 1px solid #f1f5f9;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
`;

const CategoryComboBox = ({ value = [], onChange, options, onAddOption }) => {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter(o =>
    !inputValue || o.toLowerCase().includes(inputValue.toLowerCase())
  );
  const exactMatch = options.some(o => o.toLowerCase() === inputValue.trim().toLowerCase());
  const showAddNew = inputValue.trim() && !exactMatch;

  const toggleItem = (item) => {
    if (value.includes(item)) {
      onChange(value.filter(v => v !== item));
    } else {
      onChange([...value, item]);
    }
    setInputValue('');
  };

  const removeItem = (item) => {
    onChange(value.filter(v => v !== item));
  };

  const handleAdd = () => {
    const trimmed = inputValue.trim();
    if (trimmed) {
      onAddOption(trimmed);
      if (!value.includes(trimmed)) {
        onChange([...value, trimmed]);
      }
      setInputValue('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = inputValue.trim();
      if (!trimmed) return;
      const match = options.find(o => o.toLowerCase() === trimmed.toLowerCase());
      if (match) {
        toggleItem(match);
      } else {
        handleAdd();
      }
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <ComboWrapper ref={wrapperRef}>
      <ComboInput>
        {value.map(v => (
          <Tag key={v}>
            {v}
            <button type="button" onClick={() => removeItem(v)}>
              <X size={12} />
            </button>
          </Tag>
        ))}
        <input
          value={inputValue}
          onChange={e => { setInputValue(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? '선택 또는 입력' : ''}
        />
        <button type="button" className="toggle-btn" onClick={() => setOpen(!open)}>
          <ChevronDown size={16} />
        </button>
      </ComboInput>
      {open && (
        <ComboDropdown>
          {filtered.map(o => (
            <ComboOption
              key={o}
              className={value.includes(o) ? 'selected' : ''}
              onClick={() => toggleItem(o)}
            >
              {value.includes(o) ? '✓ ' : ''}{o}
            </ComboOption>
          ))}
          {showAddNew && (
            <ComboOption className="add-new" onClick={handleAdd}>
              <Plus size={14} /> "{inputValue.trim()}" 추가
            </ComboOption>
          )}
          {filtered.length === 0 && !showAddNew && (
            <ComboOption style={{ color: '#94a3b8', cursor: 'default' }}>항목 없음</ComboOption>
          )}
        </ComboDropdown>
      )}
    </ComboWrapper>
  );
};

/* ---- Single-Select ComboBox (단일 선택 + 새 항목 추가) ---- */
const SingleComboBox = ({ value, onChange, options, onAddOption, placeholder }) => {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const wrapperRef = useRef(null);

  useEffect(() => { setInputValue(value); }, [value]);

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        // 닫힐 때 입력값 확정
        if (inputValue.trim() && inputValue !== value) {
          const trimmed = inputValue.trim();
          if (!options.includes(trimmed)) onAddOption(trimmed);
          onChange(trimmed);
        }
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [inputValue, value, options, onChange, onAddOption]);

  const filtered = options.filter(o =>
    !inputValue || o.toLowerCase().includes(inputValue.toLowerCase())
  );
  const exactMatch = options.some(o => o.toLowerCase() === inputValue.trim().toLowerCase());
  const showAddNew = inputValue.trim() && !exactMatch;

  const select = (val) => {
    onChange(val);
    setInputValue(val);
    setOpen(false);
  };

  const handleAdd = () => {
    const trimmed = inputValue.trim();
    if (trimmed) {
      onAddOption(trimmed);
      select(trimmed);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = inputValue.trim();
      if (!trimmed) return;
      const match = options.find(o => o.toLowerCase() === trimmed.toLowerCase());
      if (match) {
        select(match);
      } else {
        handleAdd();
      }
    }
  };

  return (
    <ComboWrapper ref={wrapperRef}>
      <ComboInput>
        <input
          value={inputValue}
          onChange={e => { setInputValue(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || '선택 또는 입력'}
        />
        <button type="button" className="toggle-btn" onClick={() => setOpen(!open)}>
          <ChevronDown size={16} />
        </button>
      </ComboInput>
      {open && (
        <ComboDropdown>
          {filtered.map(o => (
            <ComboOption key={o} onClick={() => select(o)}>{o}</ComboOption>
          ))}
          {showAddNew && (
            <ComboOption className="add-new" onClick={handleAdd}>
              <Plus size={14} /> "{inputValue.trim()}" 추가
            </ComboOption>
          )}
          {filtered.length === 0 && !showAddNew && (
            <ComboOption style={{ color: '#94a3b8', cursor: 'default' }}>항목 없음</ComboOption>
          )}
        </ComboDropdown>
      )}
    </ComboWrapper>
  );
};

const EMPTY_FORM = {
  name: '',
  vendor: '',
  category: [],
  version: '',
  licenseType: '',
  licenseNature: 'base',
  licenseCount: 0,
  licenseUnit: '',
  copyCount: 0,
  description: '',
  division: '',
  department: '',
  usingDepartments: [],
};

const DigitalTwinSwResourceApp = ({ onGoHome }) => {
  const { token } = useAuth();
  const [resources, setResources] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [categories, setCategories] = useState([...DEFAULT_CATEGORIES]);
  const [swNames, setSwNames] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [licenseTypes, setLicenseTypes] = useState([...DEFAULT_LICENSE_TYPES]);
  const [licenseUnits, setLicenseUnits] = useState(['core', 'unit']);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [viewMode, setViewMode] = useState('table');
  const [dashboardDivision, setDashboardDivision] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const fetchResources = async () => {
    try {
      const res = await fetch(`${API_BASE}/resources`);
      const result = await res.json();
      if (result.success) {
        const data = result.data || [];
        setResources(data);
        // 기존 데이터에서 선택지 목록 병합
        const existingCats = data.flatMap(r => r.category || []).filter(Boolean);
        setCategories(prev => [...new Set([...prev, ...existingCats])]);
        const existingNames = data.map(r => r.name).filter(Boolean);
        setSwNames(prev => [...new Set([...prev, ...existingNames])]);
        const existingVendors = data.map(r => r.vendor).filter(Boolean);
        setVendors(prev => [...new Set([...prev, ...existingVendors])]);
        const existingLicTypes = data.map(r => r.licenseType).filter(Boolean);
        setLicenseTypes(prev => [...new Set([...prev, ...existingLicTypes])]);
        const existingLicUnits = data.map(r => r.licenseUnit).filter(Boolean);
        setLicenseUnits(prev => [...new Set([...prev, ...existingLicUnits])]);
        const existingDepts = [
          ...data.map(r => r.department).filter(Boolean),
          ...data.flatMap(r => r.usingDepartments || []).filter(Boolean),
        ];
        setDepartments(prev => [...new Set([...prev, ...existingDepts])]);
      }
    } catch (e) {
      console.error('S/W 자원 조회 실패:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchDivisions = async () => {
    try {
      const res = await fetch(`${DASHBOARD_API}/settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.success && result.data) {
        if (result.data.divisions) {
          setDivisions(result.data.divisions.filter(d => d.is_active !== false));
        }
        if (result.data.departments) {
          const deptNames = result.data.departments
            .filter(d => d.is_active !== false)
            .map(d => d.name);
          setDepartments(prev => [...new Set([...prev, ...deptNames])]);
        }
      }
    } catch (e) {
      console.error('사업부 조회 실패:', e);
    }
  };

  useEffect(() => { fetchResources(); fetchDivisions(); }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return resources.filter(r => {
      const matchSearch = !term ||
        r.name?.toLowerCase().includes(term) ||
        r.vendor?.toLowerCase().includes(term) ||
        r.division?.toLowerCase().includes(term) ||
        r.department?.toLowerCase().includes(term);
      const matchCategory = !filterCategory || (r.category || []).includes(filterCategory);
      return matchSearch && matchCategory;
    });
  }, [resources, search, filterCategory]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setShowModal(true);
  };

  const openEdit = (r) => {
    setEditingId(r.id);
    setForm({
      name: r.name || '',
      vendor: r.vendor || '',
      category: r.category || [],
      version: r.version || '',
      licenseType: r.licenseType || '',
      licenseNature: r.licenseNature || 'base',
      licenseCount: r.licenseCount || 0,
      licenseUnit: r.licenseUnit || '',
      copyCount: r.copyCount || 0,
      description: r.description || '',
      division: r.division || '',
      department: r.department || '',
      usingDepartments: r.usingDepartments || [],
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return alert('S/W 명을 입력해주세요.');

    const url = editingId
      ? `${API_BASE}/resources/${editingId}`
      : `${API_BASE}/resources`;
    const method = editingId ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = await res.json();
      if (result.success) {
        setShowModal(false);
        fetchResources();
      } else {
        alert(result.error || '저장 실패');
      }
    } catch (e) {
      console.error('저장 실패:', e);
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  const handleBulkSave = async (rows) => {
    try {
      const res = await fetch(`${API_BASE}/resources/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resources: rows }),
      });
      const result = await res.json();
      if (result.success) {
        setShowBulkModal(false);
        fetchResources();
        alert(`${(result.data || []).length}건이 등록되었습니다.`);
      } else {
        alert(result.error || '일괄 등록 실패');
      }
    } catch (e) {
      console.error('일괄 등록 실패:', e);
      alert('일괄 등록 중 오류가 발생했습니다.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`${API_BASE}/resources/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) fetchResources();
    } catch (e) {
      console.error('삭제 실패:', e);
    }
  };

  const updateForm = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <Container>
      <Header
        onGoHome={onGoHome}
        onAdd={openCreate}
        onBulkAdd={() => setShowBulkModal(true)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />
      <MainContent>
        {viewMode === 'table' ? (
        <>
        <Toolbar>
          <ToolbarLeft>
            <SearchBox>
              <Search size={16} color="#94a3b8" />
              <input
                placeholder="S/W명, 벤더, 사업부 검색..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </SearchBox>
            <FilterSelect
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
            >
              <option value="">전체 카테고리</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </FilterSelect>
            <CountBadge>총 {filtered.length}건</CountBadge>
          </ToolbarLeft>
        </Toolbar>

        <TableWrapper>
          {loading ? (
            <EmptyState><p>불러오는 중...</p></EmptyState>
          ) : filtered.length === 0 ? (
            <EmptyState>
              <Cpu size={48} />
              <p>등록된 S/W 자원이 없습니다.</p>
              <p style={{ fontSize: '0.8125rem' }}>위 "S/W 등록" 버튼으로 추가해주세요.</p>
            </EmptyState>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <Table>
                <thead>
                  <tr>
                    <th>S/W 명</th>
                    <th>벤더/개발사</th>
                    <th>카테고리</th>
                    <th>버전</th>
                    <th>라이선스 유형</th>
                    <th>라이선스 성격</th>
                    <th>보유 수</th>
                    <th>라이선스 단위</th>
                    <th>카피 수 (환산)</th>
                    <th>담당 사업부</th>
                    <th>담당 부서</th>
                    <th>사용 부서</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>{r.name}</td>
                      <td>{r.vendor || '-'}</td>
                      <td>{(r.category || []).length > 0
                        ? (r.category || []).map(c => <CategoryBadge key={c} style={{ marginRight: '0.25rem' }}>{c}</CategoryBadge>)
                        : '-'}</td>
                      <td>{r.version || '-'}</td>
                      <td>{r.licenseType ? <LicenseTypeBadge type={r.licenseType}>{r.licenseType}</LicenseTypeBadge> : '-'}</td>
                      <td><NatureBadge nature={r.licenseNature}>{r.licenseNature === 'addon' ? 'Add-on' : 'Base'}</NatureBadge></td>
                      <td>{r.licenseCount ?? '-'}</td>
                      <td>{r.licenseUnit || '-'}</td>
                      <td>{r.copyCount || '-'}</td>
                      <td>{r.division || '-'}</td>
                      <td>{r.department || '-'}</td>
                      <td>{(r.usingDepartments || []).length > 0
                        ? (r.usingDepartments || []).map(d => <CategoryBadge key={d} style={{ marginRight: '0.25rem' }}>{d}</CategoryBadge>)
                        : '-'}</td>
                      <td>
                        <ActionGroup>
                          <IconButton onClick={() => openEdit(r)} title="수정">
                            <Edit2 size={14} />
                          </IconButton>
                          <IconButton variant="danger" onClick={() => handleDelete(r.id)} title="삭제">
                            <Trash2 size={14} />
                          </IconButton>
                        </ActionGroup>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </TableWrapper>
        </>
        ) : (
          <Dashboard
            resources={resources}
            divisions={divisions}
            selectedDivision={dashboardDivision}
            onDivisionChange={setDashboardDivision}
          />
        )}
      </MainContent>

      {/* 등록/수정 모달 */}
      {showModal && (
        <ModalOverlay
          onMouseDown={e => { e.currentTarget._mouseDownTarget = e.target; }}
          onClick={e => {
            if (e.target !== e.currentTarget) return;
            if (e.currentTarget._mouseDownTarget !== e.currentTarget) return;
            if (window.confirm('작성 중인 내용이 있습니다. 닫으시겠습니까?')) {
              setShowModal(false);
            }
          }}
        >
          <ModalBox onClick={e => e.stopPropagation()}>
            <ModalHeader>
              <h3>{editingId ? 'S/W 자원 수정' : '새 S/W 자원 등록'}</h3>
              <CloseBtn onClick={() => setShowModal(false)}>
                <X size={18} />
              </CloseBtn>
            </ModalHeader>
            <ModalBody>
              <FormGrid>
                <FormGroup>
                  <label>S/W 명 *</label>
                  <SingleComboBox
                    value={form.name}
                    onChange={val => updateForm('name', val)}
                    options={swNames}
                    onAddOption={v => {
                      if (!swNames.includes(v)) setSwNames(prev => [...prev, v]);
                    }}
                    placeholder="예: ANSYS Mechanical"
                  />
                </FormGroup>
                <FormGroup>
                  <label>벤더/개발사</label>
                  <SingleComboBox
                    value={form.vendor}
                    onChange={val => updateForm('vendor', val)}
                    options={vendors}
                    onAddOption={v => {
                      if (!vendors.includes(v)) setVendors(prev => [...prev, v]);
                    }}
                    placeholder="예: Ansys Inc."
                  />
                </FormGroup>
                <FormGroup>
                  <label>카테고리</label>
                  <CategoryComboBox
                    value={form.category}
                    onChange={val => updateForm('category', val)}
                    options={categories}
                    onAddOption={newCat => {
                      if (!categories.includes(newCat)) {
                        setCategories(prev => [...prev, newCat]);
                      }
                    }}
                  />
                </FormGroup>
                <FormGroup>
                  <label>버전</label>
                  <input
                    value={form.version}
                    onChange={e => updateForm('version', e.target.value)}
                    placeholder="예: 2024 R1"
                  />
                </FormGroup>
                <FormGroup>
                  <label>라이선스 유형</label>
                  <SingleComboBox
                    value={form.licenseType}
                    onChange={val => updateForm('licenseType', val)}
                    options={licenseTypes}
                    onAddOption={v => {
                      if (!licenseTypes.includes(v)) setLicenseTypes(prev => [...prev, v]);
                    }}
                    placeholder="선택 또는 입력"
                  />
                </FormGroup>
                <FormGroup>
                  <label>라이선스 성격</label>
                  <select
                    value={form.licenseNature}
                    onChange={e => updateForm('licenseNature', e.target.value)}
                  >
                    <option value="base">기본 (Base)</option>
                    <option value="addon">확장 (Add-on)</option>
                  </select>
                </FormGroup>
                <FormGroup>
                  <label>보유 라이선스 수</label>
                  <input
                    type="number"
                    min="0"
                    value={form.licenseCount}
                    onChange={e => updateForm('licenseCount', parseInt(e.target.value) || 0)}
                  />
                </FormGroup>
                <FormGroup>
                  <label>라이선스 단위</label>
                  <SingleComboBox
                    value={form.licenseUnit}
                    onChange={val => updateForm('licenseUnit', val)}
                    options={licenseUnits}
                    onAddOption={v => {
                      if (!licenseUnits.includes(v)) setLicenseUnits(prev => [...prev, v]);
                    }}
                    placeholder="예: core, unit"
                  />
                </FormGroup>
                <FormGroup>
                  <label>카피 수 (환산)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.copyCount}
                    onChange={e => updateForm('copyCount', parseInt(e.target.value) || 0)}
                  />
                </FormGroup>
                <FormGroup>
                  <label>담당 사업부</label>
                  <select
                    value={form.division}
                    onChange={e => updateForm('division', e.target.value)}
                  >
                    <option value="">선택</option>
                    {divisions.map(d => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </FormGroup>
                <FormGroup>
                  <label>담당 부서</label>
                  <SingleComboBox
                    value={form.department}
                    onChange={val => {
                      setForm(prev => {
                        const usingDepts = val && !prev.usingDepartments.includes(val)
                          ? [...prev.usingDepartments, val]
                          : prev.usingDepartments;
                        return { ...prev, department: val, usingDepartments: usingDepts };
                      });
                    }}
                    options={departments}
                    onAddOption={v => {
                      if (!departments.includes(v)) setDepartments(prev => [...prev, v]);
                    }}
                    placeholder=""
                  />
                </FormGroup>
                <FormGroup className="full">
                  <label>사용 부서</label>
                  <CategoryComboBox
                    value={form.usingDepartments}
                    onChange={val => updateForm('usingDepartments', val)}
                    options={departments}
                    onAddOption={v => {
                      if (!departments.includes(v)) setDepartments(prev => [...prev, v]);
                    }}
                  />
                </FormGroup>
                <FormGroup className="full">
                  <label>상세 설명</label>
                  <textarea
                    value={form.description}
                    onChange={e => updateForm('description', e.target.value)}
                    placeholder="S/W에 대한 상세 설명을 입력하세요"
                  />
                </FormGroup>
              </FormGrid>
            </ModalBody>
            <ModalFooter>
              <Btn className="secondary" onClick={() => setShowModal(false)}>취소</Btn>
              <Btn className="primary" onClick={handleSave}>
                {editingId ? '수정' : '등록'}
              </Btn>
            </ModalFooter>
          </ModalBox>
        </ModalOverlay>
      )}

      {/* 일괄 등록 모달 */}
      <BulkAddModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        onSave={handleBulkSave}
        divisions={divisions}
        categories={categories}
        departments={departments}
      />
    </Container>
  );
};

export default DigitalTwinSwResourceApp;
