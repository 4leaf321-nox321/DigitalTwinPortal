import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled from 'styled-components';
import { FileText, ChevronRight, ChevronLeft, Download, Loader2, CheckCircle, AlertCircle, Save, FolderOpen, Trash2, X, Search } from 'lucide-react';
import Header from './components/Layout/Header';
import { fetchTemplates, fetchPlaceholders, fetchDataSources, fetchStats, generateDocument, generateBatchDocument, fetchPresets, savePreset, deletePreset } from './services/api';
// AiChatSidebar 는 2026-08-01 에 화면에서 내렸다(아래 mount 자리 주석 참고).
// import AiChatSidebar from '../../components/AiChatSidebar';

// ─── Styled Components ──────────────────────────────────────────
const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f8fafc;
`;

const Content = styled.main`
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem 2rem;
`;

const Steps = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
`;

const Step = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: ${p => p.$active ? 600 : 400};
  color: ${p => p.$done ? '#10b981' : p.$active ? '#8b5cf6' : '#94a3b8'};
  background: ${p => p.$active ? '#f5f3ff' : 'transparent'};
`;

const StepNumber = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  font-size: 0.75rem;
  font-weight: 700;
  color: white;
  background: ${p => p.$done ? '#10b981' : p.$active ? '#8b5cf6' : '#cbd5e1'};
`;

const Card = styled.div`
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
`;

const CardTitle = styled.h3`
  font-size: 1rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 1rem 0;
`;

const TemplateGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.75rem;
`;

const TemplateCard = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 8px;
  border: 2px solid ${p => p.$selected ? '#8b5cf6' : '#e2e8f0'};
  background: ${p => p.$selected ? '#f5f3ff' : 'white'};
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: #8b5cf6;
  }
`;

const TemplateIcon = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8b5cf6;
  flex-shrink: 0;
`;

const TemplateName = styled.div`
  font-size: 0.875rem;
  font-weight: 500;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const TemplateTypeBadge = styled.span`
  font-size: 0.625rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  flex-shrink: 0;
  color: ${p => p.$type === 'docx' ? '#2563eb' : '#d97706'};
  background: ${p => p.$type === 'docx' ? '#dbeafe' : '#fef3c7'};
`;

const TemplateInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
  flex: 1;
`;

const TemplateNameRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const MappingTable = styled.table`
  width: 100%;
  border-collapse: collapse;

  th, td {
    padding: 0.625rem 0.75rem;
    text-align: left;
    border-bottom: 1px solid #f1f5f9;
    font-size: 0.875rem;
  }

  th {
    background: #f8fafc;
    font-weight: 600;
    color: #475569;
    position: sticky;
    top: 0;
    z-index: 20;
  }

  td:first-child {
    font-family: 'Consolas', 'Monaco', monospace;
    color: #8b5cf6;
    font-weight: 500;
    white-space: nowrap;
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 0.375rem 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.8125rem;
  color: #334155;
  background: white;

  &:focus {
    outline: none;
    border-color: #8b5cf6;
  }
`;

const SearchSelectWrapper = styled.div`
  position: relative;
  width: 100%;
`;

const SearchSelectInput = styled.input`
  width: 100%;
  padding: 0.375rem 0.5rem;
  border: 1px solid ${p => p.$open ? '#8b5cf6' : '#e2e8f0'};
  border-radius: 6px;
  font-size: 0.8125rem;
  color: #334155;
  background: white;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: #8b5cf6;
  }

  &::placeholder {
    color: #94a3b8;
  }
`;

const SearchSelectDropdown = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  max-height: 200px;
  overflow-y: auto;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  z-index: 30;
  margin-top: 2px;
`;

const SearchSelectGroup = styled.div`
  padding: 4px 8px;
  font-size: 0.7rem;
  font-weight: 700;
  color: #8b5cf6;
  background: #f8fafc;
  position: sticky;
  top: 0;
`;

const SearchSelectOption = styled.div`
  padding: 6px 10px;
  font-size: 0.8125rem;
  color: ${p => p.$selected ? '#8b5cf6' : '#334155'};
  background: ${p => p.$selected ? '#f5f3ff' : 'white'};
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  &:hover {
    background: #f1f5f9;
  }
`;

const SearchSelectClear = styled.span`
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  cursor: pointer;
  color: #94a3b8;
  font-size: 0.75rem;
  line-height: 1;

  &:hover {
    color: #64748b;
  }
`;

const SearchableSelect = ({ value, onChange, groups, placeholder = '— 검색 또는 선택 —' }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef(null);

  // 현재 선택된 값의 라벨
  const selectedLabel = value || '';

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = groups.map(g => ({
    ...g,
    items: g.items.filter(item =>
      !search || item.toLowerCase().includes(search.toLowerCase())
    )
  })).filter(g => g.items.length > 0);

  const handleSelect = (val) => {
    onChange(val);
    setOpen(false);
    setSearch('');
  };

  return (
    <SearchSelectWrapper ref={wrapperRef}>
      <SearchSelectInput
        $open={open}
        value={open ? search : selectedLabel}
        placeholder={selectedLabel || placeholder}
        onFocus={() => { setOpen(true); setSearch(''); }}
        onChange={e => setSearch(e.target.value)}
      />
      {value && !open && (
        <SearchSelectClear onClick={(e) => { e.stopPropagation(); onChange(''); }}>
          ✕
        </SearchSelectClear>
      )}
      {open && (
        <SearchSelectDropdown>
          {filtered.length === 0 && (
            <SearchSelectOption style={{ color: '#94a3b8', cursor: 'default' }}>
              검색 결과 없음
            </SearchSelectOption>
          )}
          {filtered.map(g => (
            <React.Fragment key={g.label}>
              {groups.length > 1 && <SearchSelectGroup>{g.label}</SearchSelectGroup>}
              {g.items.map(item => (
                <SearchSelectOption
                  key={item}
                  $selected={item === value}
                  onClick={() => handleSelect(item)}
                >
                  {item}
                </SearchSelectOption>
              ))}
            </React.Fragment>
          ))}
        </SearchSelectDropdown>
      )}
    </SearchSelectWrapper>
  );
};

const ValuePreview = styled.span`
  font-size: 0.8125rem;
  color: ${p => p.$hasValue ? '#1e293b' : '#94a3b8'};
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
`;

const ButtonRow = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1rem;
`;

const Button = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.15s;

  &.primary {
    background: #8b5cf6;
    color: white;
    &:hover { background: #7c3aed; }
    &:disabled { background: #c4b5fd; cursor: not-allowed; }
  }

  &.secondary {
    background: #f1f5f9;
    color: #475569;
    &:hover { background: #e2e8f0; }
  }
`;

const Toast = styled.div`
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  color: white;
  background: ${p => p.$type === 'error' ? '#ef4444' : '#10b981'};
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  z-index: 9999;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem 1rem;
  color: #94a3b8;
  font-size: 0.9375rem;
`;

const Spinner = styled(Loader2)`
  animation: spin 1s linear infinite;
  @keyframes spin { to { transform: rotate(360deg); } }
`;

const PresetBar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: #faf5ff;
  border: 1px solid #e9d5ff;
  border-radius: 8px;
  margin-bottom: 1rem;
`;

const SmallButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.3rem 0.625rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  border: 1px solid #e2e8f0;
  cursor: pointer;
  background: white;
  color: #475569;
  transition: all 0.15s;
  &:hover { background: #f1f5f9; }
  &.danger { color: #ef4444; &:hover { background: #fef2f2; border-color: #fca5a5; } }
  &.save { color: #8b5cf6; &:hover { background: #f5f3ff; border-color: #c4b5fd; } }
`;

// ─── Multi-Select Items ──────────────────────────────────────
const ItemCheckList = styled.div`
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 0.25rem;
`;

const ItemCheckRow = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.625rem;
  border-radius: 6px;
  font-size: 0.8125rem;
  color: #334155;
  cursor: pointer;
  transition: background 0.1s;
  &:hover { background: #f5f3ff; }
  input { accent-color: #8b5cf6; }
`;

const SelectAllBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.375rem 0.625rem;
  font-size: 0.75rem;
  color: #64748b;
  border-bottom: 1px solid #f1f5f9;
  margin-bottom: 0.25rem;
`;

const SelectedBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 600;
  background: #f5f3ff;
  color: #7c3aed;
`;

// ─── Preset Modal ────────────────────────────────────────────
const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
`;

const ModalBox = styled.div`
  background: white;
  border-radius: 14px;
  width: 560px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #e2e8f0;
`;

const ModalTitle = styled.h3`
  font-size: 1.0625rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ModalCloseBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  &:hover { background: #f1f5f9; color: #1e293b; }
`;

const ModalBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.5rem;
`;

const ModalFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.5rem;
  border-top: 1px solid #e2e8f0;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 0.5rem 0.75rem 0.5rem 2.25rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.8125rem;
  color: #334155;
  background: #f8fafc;
  margin-bottom: 0.75rem;
  &:focus { outline: none; border-color: #8b5cf6; background: white; }
`;

const SearchWrapper = styled.div`
  position: relative;
  svg { position: absolute; left: 0.625rem; top: 50%; transform: translateY(-50%); color: #94a3b8; margin-top: -0.375rem; }
`;

const PresetItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border: 1px solid ${p => p.$selected ? '#c4b5fd' : '#f1f5f9'};
  background: ${p => p.$selected ? '#f5f3ff' : 'white'};
  cursor: pointer;
  transition: all 0.15s;
  margin-bottom: 0.5rem;

  &:hover {
    border-color: #c4b5fd;
    background: #faf5ff;
  }
`;

const PresetInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const PresetName = styled.div`
  font-size: 0.875rem;
  font-weight: 600;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const PresetMeta = styled.div`
  font-size: 0.75rem;
  color: #94a3b8;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const PaginationRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: #64748b;
`;

const PageBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  color: #475569;
  &:hover { background: #f1f5f9; }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const PRESETS_PER_PAGE = 5;

const PresetModal = ({ presets, onSelect, onDelete, onClose }) => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState(null);

  const filtered = presets.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.template || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PRESETS_PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safePage * PRESETS_PER_PAGE, (safePage + 1) * PRESETS_PER_PAGE);

  const formatDate = (iso) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
    } catch { return ''; }
  };

  return (
    <ModalOverlay onClick={onClose}>
      <ModalBox onClick={e => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle><FolderOpen size={20} color="#8b5cf6" /> 프리셋 불러오기</ModalTitle>
          <ModalCloseBtn onClick={onClose}><X size={18} /></ModalCloseBtn>
        </ModalHeader>
        <ModalBody>
          <SearchWrapper>
            <Search size={16} />
            <SearchInput
              placeholder="프리셋 이름 또는 템플릿명으로 검색..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
            />
          </SearchWrapper>

          {filtered.length === 0 ? (
            <EmptyState style={{ padding: '2rem 1rem' }}>
              {presets.length === 0 ? '저장된 프리셋이 없습니다.' : '검색 결과가 없습니다.'}
            </EmptyState>
          ) : (
            paged.map(p => (
              <PresetItem
                key={p.id}
                $selected={selectedId === p.id}
                onClick={() => setSelectedId(p.id)}
                onDoubleClick={() => { onSelect(p); onClose(); }}
              >
                <FileText size={18} color="#8b5cf6" style={{ flexShrink: 0 }} />
                <PresetInfo>
                  <PresetName>{p.name}</PresetName>
                  <PresetMeta>
                    {p.template ? p.template.replace('.pptx', '') : '—'}
                    {p.year ? ` | ${p.year}년` : ''}
                    {` | 매핑 ${Object.keys(p.mappings || {}).length}개`}
                    {p.createdAt ? ` | ${formatDate(p.createdAt)}` : ''}
                  </PresetMeta>
                </PresetInfo>
                <SmallButton
                  className="danger"
                  onClick={e => { e.stopPropagation(); onDelete(p.id); }}
                  title="삭제"
                >
                  <Trash2 size={13} />
                </SmallButton>
              </PresetItem>
            ))
          )}
        </ModalBody>
        <ModalFooter>
          <PaginationRow>
            <PageBtn disabled={safePage === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft size={16} />
            </PageBtn>
            <span>{safePage + 1} / {totalPages}</span>
            <PageBtn disabled={safePage >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight size={16} />
            </PageBtn>
            <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>
              총 {filtered.length}개
            </span>
          </PaginationRow>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button className="secondary" onClick={onClose}>취소</Button>
            <Button
              className="primary"
              disabled={!selectedId}
              onClick={() => {
                const preset = presets.find(p => p.id === selectedId);
                if (preset) { onSelect(preset); onClose(); }
              }}
            >
              불러오기
            </Button>
          </div>
        </ModalFooter>
      </ModalBox>
    </ModalOverlay>
  );
};

// ─── Main Component ─────────────────────────────────────────────
const STEPS = ['템플릿 선택', '데이터 매핑', '문서 생성'];

const AutoDocumentApp = ({ onGoHome }) => {
  // 모드
  const [mode, setMode] = useState('single');

  // 상태
  const [currentStep, setCurrentStep] = useState(0);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [placeholders, setPlaceholders] = useState([]);
  const [dataSources, setDataSources] = useState([]);
  const [mappings, setMappings] = useState({});
  const [selectedSourceType, setSelectedSourceType] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState(null);
  const [presets, setPresets] = useState([]);
  const [showPresetModal, setShowPresetModal] = useState(false);

  // 단계별 ref (자동 스크롤용)
  const step2Ref = useRef(null);
  const step3Ref = useRef(null);

  const scrollToStep = useCallback((stepNum) => {
    setTimeout(() => {
      const ref = stepNum === 1 ? step2Ref : stepNum === 2 ? step3Ref : null;
      if (ref?.current) {
        ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }, []);

  // 프리셋 로드
  useEffect(() => {
    const loadPresets = async () => {
      try {
        const data = await fetchPresets('single');
        setPresets(data);
      } catch (e) { /* ignore */ }
    };
    loadPresets();
  }, []);

  const handleSavePreset = async () => {
    const name = window.prompt('프리셋 이름을 입력하세요:');
    if (!name) return;
    try {
      const preset = await savePreset({
        name,
        mode: 'single',
        template: selectedTemplate?.filename,
        mappings,
        sourceType: selectedSourceType,
      });
      setPresets(prev => [...prev, preset]);
      showToast('프리셋이 저장되었습니다.');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleLoadPreset = (preset) => {
    const tpl = templates.find(t => t.filename === preset.template);
    if (tpl && tpl.filename !== selectedTemplate?.filename) {
      handleSelectTemplate(tpl).then(() => {
        setSelectedSourceType(preset.sourceType || '');
        setMappings(preset.mappings || {});
      });
    } else {
      setSelectedSourceType(preset.sourceType || '');
      setMappings(preset.mappings || {});
    }
    showToast(`프리셋 "${preset.name}"을(를) 불러왔습니다.`);
  };

  const handleDeletePreset = async (presetId) => {
    if (!window.confirm('이 프리셋을 삭제하시겠습니까?')) return;
    try {
      await deletePreset(presetId);
      setPresets(prev => prev.filter(p => p.id !== presetId));
      showToast('프리셋이 삭제되었습니다.');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  // 토스트
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // 1단계: 템플릿 목록 로드
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchTemplates();
        setTemplates(data);
      } catch (e) {
        showToast(e.message, 'error');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // 템플릿 선택 시 플레이스홀더 스캔 + 데이터소스 로드
  const handleSelectTemplate = async (tpl) => {
    setSelectedTemplate(tpl);
    setMappings({});
    setSelectedSourceType('');
    setSelectedItems([]);
    try {
      setLoading(true);
      const [ph, ds] = await Promise.all([
        fetchPlaceholders(tpl.filename),
        fetchDataSources()
      ]);
      setPlaceholders(ph);
      setDataSources(ds);
      setCurrentStep(1);
      scrollToStep(1);
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // 현재 선택된 소스 타입의 데이터
  const currentSourceData = (() => {
    if (!dataSources.length || !selectedSourceType) return null;
    for (const source of dataSources) {
      for (const type of source.types) {
        if (type.id === selectedSourceType) return type;
      }
    }
    return null;
  })();

  // 선택된 항목들의 실제 데이터
  const selectedItemsData = (() => {
    if (!currentSourceData || !selectedItems.length) return [];
    return selectedItems
      .map(id => currentSourceData.data?.find(d => (d.uuid || d.id) === id))
      .filter(Boolean);
  })();

  // 첫 번째 선택 항목 (미리보기용)
  const firstItemData = selectedItemsData[0] || null;

  // 매핑 변경
  const handleMappingChange = (placeholder, field) => {
    if (!field) {
      setMappings(prev => {
        const next = { ...prev };
        delete next[placeholder];
        return next;
      });
      return;
    }
    setMappings(prev => ({ ...prev, [placeholder]: field }));
  };

  // 매핑된 값 미리보기 (첫 번째 항목 기준)
  const getPreviewValue = (placeholder) => {
    const field = mappings[placeholder];
    if (!field || !firstItemData) return null;
    const val = firstItemData[field];
    if (val === undefined || val === null) return null;
    if (typeof val === 'boolean') return val ? '예' : '아니오';
    if (Array.isArray(val)) return JSON.stringify(val).slice(0, 50);
    return String(val);
  };

  // 단일 항목의 최종 매핑 값 구성
  const buildItemMappings = (itemData) => {
    const result = {};
    for (const [placeholder, field] of Object.entries(mappings)) {
      let val = itemData[field];
      if (val === undefined || val === null) val = '';
      if (typeof val === 'boolean') val = val ? '예' : '아니오';
      if (Array.isArray(val)) {
        val = val.map(item => {
          if (typeof item === 'object') {
            return Object.values(item).join(', ');
          }
          return String(item);
        }).join('\n');
      }
      result[placeholder] = String(val);
    }
    return result;
  };

  // PPT 생성
  const handleGenerate = async () => {
    try {
      setGenerating(true);
      if (selectedItemsData.length === 1) {
        const finalMappings = buildItemMappings(selectedItemsData[0]);
        await generateDocument(selectedTemplate.filename, finalMappings);
        showToast('문서가 생성되었습니다.');
      } else {
        const batch = selectedItemsData.map(itemData => ({
          label: itemData.id || itemData.uuid || '',
          mappings: buildItemMappings(itemData),
        }));
        await generateBatchDocument(selectedTemplate.filename, batch);
        showToast(`${batch.length}건의 문서가 생성되었습니다.`);
      }
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setGenerating(false);
    }
  };

  // 항목 토글
  const handleToggleItem = (itemId) => {
    setSelectedItems(prev =>
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  const handleSelectAllItems = () => {
    if (!currentSourceData) return;
    const allIds = currentSourceData.items.map(i => i.id);
    if (selectedItems.length === allIds.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(allIds);
    }
  };

  // AI 기반 자동 매핑
  const [aiMapping, setAiMapping] = useState(false);
  const handleAiMapping = async () => {
    const fields = currentSourceData?.fields || [];
    if (!placeholders.length || !fields.length) {
      showToast('플레이스홀더와 데이터 필드가 모두 필요합니다.', 'error');
      return;
    }

    setAiMapping(true);
    try {
      const sampleData = firstItemData
        ? Object.fromEntries(
            fields.slice(0, 30).map(f => [f, firstItemData[f] != null ? String(firstItemData[f]).slice(0, 80) : ''])
          )
        : null;

      const prompt = `아래는 문서 템플릿의 플레이스홀더 목록과 데이터베이스 필드 목록입니다.
각 플레이스홀더에 가장 적합한 데이터 필드를 매핑해주세요.
매핑이 불확실하면 해당 플레이스홀더는 생략하세요.

반드시 JSON 객체만 반환하세요. 다른 텍스트는 포함하지 마세요.
형식: {"플레이스홀더1": "필드명1", "플레이스홀더2": "필드명2"}

## 플레이스홀더 목록
${placeholders.join(', ')}

## 데이터 필드 목록
${fields.join(', ')}
${sampleData ? `\n## 샘플 데이터 (참고용)\n${JSON.stringify(sampleData, null, 2)}` : ''}`;

      const response = await fetch('/llm/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'default',
          messages: [
            { role: 'system', content: '당신은 데이터 매핑 전문가입니다. JSON만 반환하세요.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.1,
          max_tokens: 2048,
          stream: false,
        }),
      });

      if (!response.ok) throw new Error(`LLM 서버 오류 (${response.status})`);

      const data = await response.json();
      const raw = data.choices?.[0]?.message?.content || '';

      // JSON 추출 (```json ... ``` 또는 { ... } )
      let jsonStr = raw;
      const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenced) {
        jsonStr = fenced[1];
      } else {
        const braces = raw.match(/\{[\s\S]*\}/);
        if (braces) jsonStr = braces[0];
      }

      const parsed = JSON.parse(jsonStr);

      // 유효한 매핑만 필터링 (필드가 실제로 존재하는지 확인)
      const validMappings = {};
      for (const [ph, field] of Object.entries(parsed)) {
        if (placeholders.includes(ph) && fields.includes(field)) {
          validMappings[ph] = field;
        }
      }

      setMappings(validMappings);
      showToast(`AI 매핑 완료: ${Object.keys(validMappings).length}/${placeholders.length}개 필드가 매핑되었습니다.`);
    } catch (err) {
      showToast(`AI 매핑 실패: ${err.message}`, 'error');
    } finally {
      setAiMapping(false);
    }
  };

  const mappedCount = Object.keys(mappings).length;

  return (
    <Container>
      <Header onGoHome={onGoHome} mode={mode} onModeChange={setMode} />
      <Content>
        {mode === 'stats' ? (
          <StatsReportSection
            templates={templates}
            loading={loading}
            showToast={showToast}
          />
        ) : (
        <>
        {/* 스텝 인디케이터 */}
        <Steps>
          {STEPS.map((label, i) => (
            <React.Fragment key={i}>
              {i > 0 && <ChevronRight size={16} color="#cbd5e1" />}
              <Step $active={currentStep === i} $done={currentStep > i}>
                <StepNumber $active={currentStep === i} $done={currentStep > i}>
                  {currentStep > i ? '✓' : i + 1}
                </StepNumber>
                {label}
              </Step>
            </React.Fragment>
          ))}
        </Steps>

        {/* 1단계: 템플릿 선택 */}
        <Card>
          <CardTitle>1. 템플릿 선택</CardTitle>
          {loading && !templates.length ? (
            <EmptyState><Spinner size={24} /> 로딩 중...</EmptyState>
          ) : templates.length === 0 ? (
            <EmptyState>
              등록된 템플릿이 없습니다.<br />
              <code style={{ fontSize: '0.8rem', color: '#64748b' }}>
                backend/templates/document_type_ppt/
              </code> 또는 <code style={{ fontSize: '0.8rem', color: '#64748b' }}>
                document_type_word/
              </code> 폴더에 파일을 추가하세요.
            </EmptyState>
          ) : (
            <TemplateGrid>
              {templates.map(tpl => (
                <TemplateCard
                  key={tpl.filename}
                  $selected={selectedTemplate?.filename === tpl.filename}
                  onClick={() => handleSelectTemplate(tpl)}
                >
                  <TemplateIcon><FileText size={20} /></TemplateIcon>
                  <TemplateInfo>
                    <TemplateNameRow>
                      <TemplateName title={tpl.name}>{tpl.name}</TemplateName>
                      <TemplateTypeBadge $type={tpl.type || 'pptx'}>{tpl.type === 'docx' ? 'Word' : 'PPT'}</TemplateTypeBadge>
                    </TemplateNameRow>
                  </TemplateInfo>
                </TemplateCard>
              ))}
            </TemplateGrid>
          )}
        </Card>

        {/* 2단계: 데이터 매핑 */}
        {currentStep >= 1 && (
          <Card ref={step2Ref}>
            <CardTitle>2. 데이터 매핑 ({mappedCount}/{placeholders.length})</CardTitle>

            {/* 프리셋 */}
            <PresetBar>
              <FolderOpen size={16} color="#7c3aed" />
              <SmallButton className="save" onClick={() => setShowPresetModal(true)}>
                <FolderOpen size={14} /> 프리셋 불러오기 ({presets.length})
              </SmallButton>
              {mappedCount > 0 && (
                <SmallButton className="save" onClick={handleSavePreset}>
                  <Save size={14} /> 현재 매핑 저장
                </SmallButton>
              )}
            </PresetBar>
            {showPresetModal && (
              <PresetModal
                presets={presets}
                onSelect={handleLoadPreset}
                onDelete={handleDeletePreset}
                onClose={() => setShowPresetModal(false)}
              />
            )}

            {/* 데이터 소스 선택 */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ marginBottom: '0.75rem', maxWidth: '400px' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#475569', marginBottom: '0.25rem', display: 'block' }}>
                  데이터 종류
                </label>
                <Select
                  value={selectedSourceType}
                  onChange={e => {
                    setSelectedSourceType(e.target.value);
                    setSelectedItems([]);
                    setMappings({});
                  }}
                >
                  <option value="">선택하세요</option>
                  {dataSources.flatMap(s =>
                    s.types.map(t => (
                      <option key={t.id} value={t.id}>{s.name} &gt; {t.name}</option>
                    ))
                  )}
                </Select>
              </div>

              {currentSourceData && (
                <div>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#475569', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    항목 선택 (복수 선택 가능)
                    {selectedItems.length > 0 && (
                      <SelectedBadge>{selectedItems.length}개 선택</SelectedBadge>
                    )}
                  </label>
                  <ItemCheckList>
                    <SelectAllBar>
                      <ItemCheckRow as="label" style={{ padding: '0.25rem 0', fontWeight: 600, fontSize: '0.75rem' }}>
                        <input
                          type="checkbox"
                          checked={selectedItems.length === currentSourceData.items.length && currentSourceData.items.length > 0}
                          onChange={handleSelectAllItems}
                        />
                        전체 선택
                      </ItemCheckRow>
                      <span>{currentSourceData.items.length}개 항목</span>
                    </SelectAllBar>
                    {currentSourceData.items.map(item => (
                      <ItemCheckRow key={item.id}>
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(item.id)}
                          onChange={() => handleToggleItem(item.id)}
                        />
                        {item.label}
                        {item.perfCount > 0 && (
                          <span style={{ fontSize: '0.6875rem', color: '#8b5cf6', marginLeft: '0.25rem' }}>
                            (성과 {item.perfCount})
                          </span>
                        )}
                      </ItemCheckRow>
                    ))}
                  </ItemCheckList>
                </div>
              )}
            </div>

            {/* 매핑 테이블 */}
            {selectedItems.length > 0 && placeholders.length > 0 && (
              <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <MappingTable>
                  <thead>
                    <tr>
                      <th style={{ width: '25%' }}>플레이스홀더</th>
                      <th style={{ width: '35%' }}>데이터 필드</th>
                      <th style={{ width: '40%' }}>미리보기 {selectedItems.length > 1 ? '(첫 번째 항목)' : ''}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {placeholders.map(ph => (
                      <tr key={ph}>
                        <td>{`{{${ph}}}`}</td>
                        <td>
                          <SearchableSelect
                            value={mappings[ph] || ''}
                            onChange={val => handleMappingChange(ph, val)}
                            groups={(() => {
                              const fields = currentSourceData?.fields || [];
                              const perfFields = fields.filter(f => f.match(/^성과\d+_/));
                              if (perfFields.length === 0) {
                                return [{ label: '필드', items: fields }];
                              }
                              const baseFields = fields.filter(f => !f.match(/^성과\d+_/));
                              return [
                                { label: '과제 필드', items: baseFields },
                                { label: '연결된 성과 필드', items: perfFields }
                              ];
                            })()}
                          />
                        </td>
                        <td>
                          <ValuePreview $hasValue={!!getPreviewValue(ph)}>
                            {getPreviewValue(ph) || '—'}
                          </ValuePreview>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </MappingTable>
              </div>
            )}

            {selectedItems.length > 0 && placeholders.length > 0 && (
              <ButtonRow>
                <Button
                  className="secondary"
                  onClick={() => {
                    const auto = {};
                    const fields = currentSourceData?.fields || [];
                    placeholders.forEach(ph => {
                      // 1. 정확히 일치
                      if (fields.includes(ph)) {
                        auto[ph] = ph;
                        return;
                      }
                      // 2. 대소문자 무시 일치
                      const lowerPh = ph.toLowerCase();
                      const exact = fields.find(f => f.toLowerCase() === lowerPh);
                      if (exact) {
                        auto[ph] = exact;
                        return;
                      }
                      // 3. 필드명이 플레이스홀더를 포함하거나 반대
                      const partial = fields.find(f =>
                        f.includes(ph) || ph.includes(f)
                      );
                      if (partial) {
                        auto[ph] = partial;
                      }
                    });
                    setMappings(auto);
                    showToast(`${Object.keys(auto).length}/${placeholders.length}개 필드가 자동 매핑되었습니다.`);
                  }}
                >
                  자동 매핑
                </Button>
                <Button
                  className="secondary"
                  disabled={aiMapping}
                  onClick={handleAiMapping}
                  style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)', color: 'white', border: 'none' }}
                >
                  {aiMapping ? <><Spinner size={16} /> AI 분석 중...</> : '🤖 AI 매핑'}
                </Button>
                <Button
                  className="primary"
                  disabled={mappedCount === 0}
                  onClick={() => { setCurrentStep(2); scrollToStep(2); }}
                >
                  다음 <ChevronRight size={16} />
                </Button>
              </ButtonRow>
            )}
          </Card>
        )}

        {/* 3단계: 생성 */}
        {currentStep >= 2 && (
          <Card ref={step3Ref}>
            <CardTitle>3. 문서 생성</CardTitle>
            <div style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '1rem' }}>
              <p>템플릿: <strong>{selectedTemplate?.name}</strong> <TemplateTypeBadge $type={selectedTemplate?.type || 'pptx'}>{selectedTemplate?.type === 'docx' ? 'Word' : 'PPT'}</TemplateTypeBadge></p>
              <p>선택 항목: <strong>{selectedItems.length}</strong>개
                {selectedItems.length > 1 && ' (항목별 슬라이드가 하나의 PPT로 합쳐집니다)'}
              </p>
              <p>매핑된 필드: <strong>{mappedCount}</strong> / {placeholders.length}</p>
              <p>매핑 안 된 필드: <strong>{placeholders.length - mappedCount}</strong>개 (빈 값으로 처리됨)</p>
            </div>
            <ButtonRow>
              <Button className="secondary" onClick={() => setCurrentStep(1)}>
                매핑 수정
              </Button>
              <Button
                className="primary"
                disabled={generating}
                onClick={handleGenerate}
              >
                {generating ? <><Spinner size={16} /> 생성 중...</> : <><Download size={16} /> 보고서 생성 및 다운로드</>}
              </Button>
            </ButtonRow>
          </Card>
        )}
        </>
        )}
      </Content>

      {/* 토스트 */}
      {toast && (
        <Toast $type={toast.type}>
          {toast.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
          {toast.message}
        </Toast>
      )}

      {/* 2026-08-01 AiChatSidebar 를 내렸다 — DT 대시보드의 AI 에이전트로 창구를 하나로
          모으는 중이다. ⚠️ 이 모듈이 직접 쓰는 `/llm` 호출(데이터 매핑 자동화)은 **그대로다** —
          그건 채팅이 아니라 이 화면의 기능이다.
          <AiChatSidebar pageName="auto-document" /> */}
    </Container>
  );
};

// ─── Stats Report Section ───────────────────────────────────────
const StatsFieldBadge = styled.span`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  background: #f1f5f9;
  color: #475569;
  margin: 2px;
`;

const StatsValue = styled.span`
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 0.8125rem;
  color: #1e293b;
  font-weight: 600;
`;

const FieldGroup = styled.div`
  margin-bottom: 1rem;
`;

const FieldGroupTitle = styled.div`
  font-size: 0.8125rem;
  font-weight: 600;
  color: #8b5cf6;
  margin-bottom: 0.5rem;
  padding-bottom: 0.25rem;
  border-bottom: 1px solid #f1f5f9;
`;

const STATS_STEPS = ['템플릿 선택', '통계 데이터 확인 및 매핑', '문서 생성'];

const StatsReportSection = ({ templates, loading: parentLoading, showToast }) => {
  const [step, setStep] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [placeholders, setPlaceholders] = useState([]);
  const [stats, setStats] = useState(null);
  const [flatFields, setFlatFields] = useState({});
  const [mappings, setMappings] = useState({});
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [presets, setPresets] = useState([]);
  const [showPresetModal, setShowPresetModal] = useState(false);

  const statsStep2Ref = useRef(null);
  const statsStep3Ref = useRef(null);

  const scrollToStatsStep = useCallback((stepNum) => {
    setTimeout(() => {
      const ref = stepNum === 1 ? statsStep2Ref : stepNum === 2 ? statsStep3Ref : null;
      if (ref?.current) {
        ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }, []);

  useEffect(() => {
    const loadPresets = async () => {
      try {
        const data = await fetchPresets('stats');
        setPresets(data);
      } catch (e) { /* ignore */ }
    };
    loadPresets();
  }, []);

  const handleSavePreset = async () => {
    const name = window.prompt('프리셋 이름을 입력하세요:');
    if (!name) return;
    try {
      const preset = await savePreset({
        name,
        mode: 'stats',
        template: selectedTemplate?.filename,
        mappings,
        year,
      });
      setPresets(prev => [...prev, preset]);
      showToast('프리셋이 저장되었습니다.');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleLoadPreset = (preset) => {
    const tpl = templates.find(t => t.filename === preset.template);
    if (tpl && tpl.filename !== selectedTemplate?.filename) {
      if (preset.year) setYear(preset.year);
      handleSelectTemplate(tpl).then(() => {
        setMappings(preset.mappings || {});
      });
    } else {
      if (preset.year) setYear(preset.year);
      setMappings(preset.mappings || {});
    }
    showToast(`프리셋 "${preset.name}"을(를) 불러왔습니다.`);
  };

  const handleDeletePreset = async (presetId) => {
    if (!window.confirm('이 프리셋을 삭제하시겠습니까?')) return;
    try {
      await deletePreset(presetId);
      setPresets(prev => prev.filter(p => p.id !== presetId));
      showToast('프리셋이 삭제되었습니다.');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleSelectTemplate = async (tpl) => {
    setSelectedTemplate(tpl);
    setMappings({});
    try {
      setLoading(true);
      const [ph, statsData] = await Promise.all([
        fetchPlaceholders(tpl.filename),
        fetchStats(year)
      ]);
      setPlaceholders(ph);
      setStats(statsData);
      setFlatFields(statsData.flat_fields || {});
      setStep(1);
      scrollToStatsStep(1);
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshStats = async () => {
    try {
      setLoading(true);
      const statsData = await fetchStats(year);
      setStats(statsData);
      setFlatFields(statsData.flat_fields || {});
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleMappingChange = (placeholder, fieldKey) => {
    if (!fieldKey) {
      setMappings(prev => { const next = { ...prev }; delete next[placeholder]; return next; });
      return;
    }
    setMappings(prev => ({ ...prev, [placeholder]: fieldKey }));
  };

  const handleAutoMap = () => {
    const auto = {};
    const fieldKeys = Object.keys(flatFields);
    placeholders.forEach(ph => {
      if (fieldKeys.includes(ph)) {
        auto[ph] = ph;
      }
    });
    setMappings(auto);
    showToast(`${Object.keys(auto).length}개 필드가 자동 매핑되었습니다.`);
  };

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      const finalMappings = {};
      for (const [ph, fieldKey] of Object.entries(mappings)) {
        finalMappings[ph] = String(flatFields[fieldKey] ?? '');
      }
      await generateDocument(selectedTemplate.filename, finalMappings);
      showToast('통계 보고서가 생성되었습니다.');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setGenerating(false);
    }
  };

  // 통계 필드를 카테고리별로 그룹핑
  const groupedFields = (() => {
    const groups = { '전체 현황': {}, '사업부별 과제': {}, '진행상태별': {}, 'KPI 대시보드': {}, '부서별 현황': {}, '성과 통계': {} };
    for (const [key, val] of Object.entries(flatFields)) {
      if (key.startsWith('KPI_')) {
        groups['KPI 대시보드'][key] = val;
      } else if (key.startsWith('부서_') || key === '전체부서수' || key === '전체인원수') {
        groups['부서별 현황'][key] = val;
      } else if (key.startsWith('전체') || key === '전체평균진행률') {
        groups['전체 현황'][key] = val;
      } else if (key.startsWith('진행상태_')) {
        groups['진행상태별'][key] = val;
      } else if (key.match(/^[A-Z가-힣]+_(과제수|평균진행률|성과수)$/) || key.match(/^[A-Z가-힣]+_[가-힣]+_과제수$/)) {
        groups['사업부별 과제'][key] = val;
      } else {
        groups['성과 통계'][key] = val;
      }
    }
    return groups;
  })();

  const fieldKeys = Object.keys(flatFields);
  const mappedCount = Object.keys(mappings).length;

  return (
    <>
      {/* 스텝 */}
      <Steps>
        {STATS_STEPS.map((label, i) => (
          <React.Fragment key={i}>
            {i > 0 && <ChevronRight size={16} color="#cbd5e1" />}
            <Step $active={step === i} $done={step > i}>
              <StepNumber $active={step === i} $done={step > i}>
                {step > i ? '✓' : i + 1}
              </StepNumber>
              {label}
            </Step>
          </React.Fragment>
        ))}
      </Steps>

      {/* 1단계: 템플릿 선택 */}
      <Card>
        <CardTitle>1. 템플릿 선택</CardTitle>
        {parentLoading && !templates.length ? (
          <EmptyState><Spinner size={24} /> 로딩 중...</EmptyState>
        ) : templates.length === 0 ? (
          <EmptyState>
            등록된 템플릿이 없습니다.<br />
            <code style={{ fontSize: '0.8rem', color: '#64748b' }}>
              backend/templates/document_type_ppt/
            </code> 또는 <code style={{ fontSize: '0.8rem', color: '#64748b' }}>
              document_type_word/
            </code> 폴더에 파일을 추가하세요.
          </EmptyState>
        ) : (
          <TemplateGrid>
            {templates.map(tpl => (
              <TemplateCard
                key={tpl.filename}
                $selected={selectedTemplate?.filename === tpl.filename}
                onClick={() => handleSelectTemplate(tpl)}
              >
                <TemplateIcon><FileText size={20} /></TemplateIcon>
                <TemplateInfo>
                  <TemplateNameRow>
                    <TemplateName title={tpl.name}>{tpl.name}</TemplateName>
                    <TemplateTypeBadge $type={tpl.type || 'pptx'}>{tpl.type === 'docx' ? 'Word' : 'PPT'}</TemplateTypeBadge>
                  </TemplateNameRow>
                </TemplateInfo>
              </TemplateCard>
            ))}
          </TemplateGrid>
        )}
      </Card>

      {/* 2단계: 통계 데이터 매핑 */}
      {step >= 1 && (
        <Card ref={statsStep2Ref}>
          <CardTitle>2. 통계 데이터 매핑 ({mappedCount}/{placeholders.length})</CardTitle>

          {/* 프리셋 */}
          <PresetBar>
            <FolderOpen size={16} color="#7c3aed" />
            <SmallButton className="save" onClick={() => setShowPresetModal(true)}>
              <FolderOpen size={14} /> 프리셋 불러오기 ({presets.length})
            </SmallButton>
            {mappedCount > 0 && (
              <SmallButton className="save" onClick={handleSavePreset}>
                <Save size={14} /> 현재 매핑 저장
              </SmallButton>
            )}
          </PresetBar>
          {showPresetModal && (
            <PresetModal
              presets={presets}
              onSelect={handleLoadPreset}
              onDelete={handleDeletePreset}
              onClose={() => setShowPresetModal(false)}
            />
          )}

          {/* 연도 선택 및 새로고침 */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'flex-end' }}>
            <div>
              <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#475569', marginBottom: '0.25rem', display: 'block' }}>
                기준 연도
              </label>
              <Select value={year} onChange={e => setYear(parseInt(e.target.value))} style={{ width: '120px' }}>
                {[2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>{y}년</option>
                ))}
              </Select>
            </div>
            <Button className="secondary" onClick={handleRefreshStats} disabled={loading}>
              {loading ? <Spinner size={14} /> : null} 통계 새로고침
            </Button>
          </div>

          {/* 사용 가능한 통계 필드 요약 */}
          <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', maxHeight: '200px', overflowY: 'auto' }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>
              사용 가능한 통계 필드 ({fieldKeys.length}개)
            </div>
            {Object.entries(groupedFields).map(([groupName, fields]) => {
              const entries = Object.entries(fields);
              if (entries.length === 0) return null;
              return (
                <FieldGroup key={groupName}>
                  <FieldGroupTitle>{groupName} ({entries.length})</FieldGroupTitle>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                    {entries.map(([key, val]) => (
                      <StatsFieldBadge key={key} title={`${key} = ${val}`}>
                        {key}: <StatsValue>{val}</StatsValue>
                      </StatsFieldBadge>
                    ))}
                  </div>
                </FieldGroup>
              );
            })}
          </div>

          {/* 매핑 테이블 */}
          {placeholders.length > 0 && (
            <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <MappingTable>
                <thead>
                  <tr>
                    <th style={{ width: '25%' }}>플레이스홀더</th>
                    <th style={{ width: '40%' }}>통계 필드</th>
                    <th style={{ width: '35%' }}>값</th>
                  </tr>
                </thead>
                <tbody>
                  {placeholders.map(ph => (
                    <tr key={ph}>
                      <td>{`{{${ph}}}`}</td>
                      <td>
                        <SearchableSelect
                          value={mappings[ph] || ''}
                          onChange={val => handleMappingChange(ph, val)}
                          groups={Object.entries(groupedFields)
                            .filter(([, fields]) => Object.keys(fields).length > 0)
                            .map(([groupName, fields]) => ({
                              label: groupName,
                              items: Object.keys(fields)
                            }))}
                        />
                      </td>
                      <td>
                        <ValuePreview $hasValue={!!mappings[ph]}>
                          {mappings[ph] ? flatFields[mappings[ph]] ?? '—' : '—'}
                        </ValuePreview>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </MappingTable>
            </div>
          )}

          {placeholders.length > 0 && (
            <ButtonRow>
              <Button className="secondary" onClick={handleAutoMap}>
                자동 매핑
              </Button>
              <Button
                className="primary"
                disabled={mappedCount === 0}
                onClick={() => { setStep(2); scrollToStatsStep(2); }}
              >
                다음 <ChevronRight size={16} />
              </Button>
            </ButtonRow>
          )}
        </Card>
      )}

      {/* 3단계: 생성 */}
      {step >= 2 && (
        <Card ref={statsStep3Ref}>
          <CardTitle>3. 통계 보고서 생성</CardTitle>
          <div style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '1rem' }}>
            <p>템플릿: <strong>{selectedTemplate?.name}</strong></p>
            <p>기준 연도: <strong>{year}년</strong></p>
            <p>매핑된 필드: <strong>{mappedCount}</strong> / {placeholders.length}</p>
            <p>매핑 안 된 필드: <strong>{placeholders.length - mappedCount}</strong>개 (빈 값으로 처리됨)</p>
          </div>
          <ButtonRow>
            <Button className="secondary" onClick={() => setStep(1)}>매핑 수정</Button>
            <Button className="primary" disabled={generating} onClick={handleGenerate}>
              {generating ? <><Spinner size={16} /> 생성 중...</> : <><Download size={16} /> 보고서 생성 및 다운로드</>}
            </Button>
          </ButtonRow>
        </Card>
      )}
    </>
  );
};

export default AutoDocumentApp;
