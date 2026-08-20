import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { Download, Search } from 'lucide-react';

import Header from './components/Layout/Header';
import InvestmentModal from './components/InvestmentModal';
import BulkAddModal from './components/BulkAddModal';
import SettingsModal from './components/SettingsModal';
import InvestmentTable from './components/InvestmentTable';
import PivotView from './components/PivotView';
import ToggleFilter from './components/ToggleFilter';
import api from './services/api';
import { CATEGORY1_OPTIONS, DEFAULT_CATEGORY2_OPTIONS } from './constants';
import { nextSort, sortInvestments } from './utils/sortInvestments';
import { investmentsToCsv, pivotToCsv } from './utils/exportCsv';
import { todayLocalYmd } from '../../shared/utils/localDate';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f8fafc;
`;

// 세로 스크롤은 이 바깥에서 받는다. 스크롤바가 가운데 상자 옆이 아니라
// 창 오른쪽 끝에 붙어야 표가 좌우로 흔들리지 않는다.
const Scroller = styled.main`
  flex: 1;
  overflow: auto;
`;

// 표를 창 끝까지 붙여 두면 읽기 힘들어서 좌우로 여백을 둔다.
// 넓은 화면에서는 max-width 가, 좁은 화면에서는 padding 이 여백을 만든다.
const Content = styled.div`
  width: 100%;
  max-width: 1600px;
  margin: 0 auto;
  padding: 1.5rem 2rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;

  @media (max-width: 900px) {
    padding: 1rem;
  }
`;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
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
    width: 220px;
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

// 걸개 토글 줄. 갈래가 둘이라 사이를 넉넉히 벌려 서로 섞여 보이지 않게 한다.
const FilterRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 1.5rem;
  flex-wrap: wrap;
`;

const CountBadge = styled.span`
  margin-left: auto;
  font-size: 0.8rem;
  color: #64748b;
`;

const SaveButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  background: white;
  color: #475569;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) { border-color: #4f46e5; color: #4338ca; background: #eef2ff; }
  &:disabled { color: #cbd5e1; cursor: not-allowed; }
`;

const Message = styled.div`
  padding: 3rem 1rem;
  text-align: center;
  color: #94a3b8;
`;

const ErrorBanner = styled.div`
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
  font-size: 0.85rem;
`;

const DigitalTwinInvestmentApp = ({ onGoHome }) => {
  const [investments, setInvestments] = useState([]);
  const [category2Options, setCategory2Options] = useState([...DEFAULT_CATEGORY2_OPTIONS]);
  const [options, setOptions] = useState({
    divisions: [], processes: [], departments: [], departmentsByDivision: {},
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [filterYear, setFilterYear] = useState('');
  // 사업부·투자 유형은 여러 개를 함께 걸 수 있다. 빈 배열이면 전체다.
  const [filterDivisions, setFilterDivisions] = useState([]);
  const [filterCategory1s, setFilterCategory1s] = useState([]);

  // 들어오면 피벗부터 본다 — 목록은 찾아 고칠 때 쓰고, 현황 파악은 피벗이 먼저다.
  const [viewMode, setViewMode] = useState('pivot');   // 'table' | 'pivot'
  // 정렬 상태를 여기 둔다 — 표도 쓰고, 「로컬 저장」도 같은 차례로 내보내야 해서.
  const [sort, setSort] = useState({ key: null, dir: null });

  const [showFormModal, setShowFormModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const loadInvestments = async () => {
    const data = await api.getInvestments();
    setInvestments(data);
    return data;
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // 사업부/프로세스/부서는 대시보드 설정에서 온다. 그쪽이 막혀 있어도
        // 투자 목록 자체는 보여야 하므로 실패를 따로 삼킨다.
        const [, settings] = await Promise.all([
          loadInvestments(),
          api.getSettings(),
          api.getDashboardOptions()
            .then(o => { if (alive) setOptions(o); })
            .catch(e => console.error('대시보드 설정 조회 실패:', e)),
        ]);
        if (!alive) return;
        if (settings?.category2Options?.length) {
          setCategory2Options(settings.category2Options);
        }
      } catch (e) {
        if (alive) setError(e.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // 피벗에서 기준열을 늘어놓는 차례. 넷 모두 정해 둔 차례가 있다
  // (투자 유형 고정 목록, 사업부/프로세스는 대시보드 차례, 디지털 트윈 영역은 설정 차례).
  const pivotOrders = useMemo(() => ({
    category1: CATEGORY1_OPTIONS,
    division: options.divisions,
    process: options.processes,
    category2: category2Options,
  }), [options.divisions, options.processes, category2Options]);

  const years = useMemo(() => {
    const set = new Set(investments.map(r => r.year).filter(Boolean));
    return [...set].sort((a, b) => b - a);
  }, [investments]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return investments.filter(r => {
      const matchesTerm = !term || [r.name, r.division, r.process, r.department, r.category1, r.category2]
        .some(v => v?.toLowerCase().includes(term));
      return matchesTerm
        && (!filterYear || String(r.year) === filterYear)
        && (filterDivisions.length === 0 || filterDivisions.includes(r.division))
        && (filterCategory1s.length === 0 || filterCategory1s.includes(r.category1));
    });
  }, [investments, search, filterYear, filterDivisions, filterCategory1s]);

  // 화면에 보이는 그대로의 차례. 표와 저장이 이 하나를 같이 본다.
  const visibleRows = useMemo(() => sortInvestments(filtered, sort), [filtered, sort]);

  const saveLocally = (csv, kind) => {
    // UTF-8 BOM 을 붙여야 엑셀이 한글을 깨뜨리지 않는다.
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `투자현황_${kind}_${todayLocalYmd()}.csv`;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSaveLocally = () => {
    if (viewMode === 'pivot') {
      saveLocally(pivotToCsv(filtered, pivotOrders), '피벗');
    } else {
      saveLocally(investmentsToCsv(visibleRows), '목록');
    }
  };

  const run = async (action) => {
    setError('');
    try {
      await action();
      await loadInvestments();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleSaveOne = (form) => run(async () => {
    if (editing) {
      await api.updateInvestment(editing.id, form);
    } else {
      await api.createInvestment(form);
    }
    setShowFormModal(false);
    setEditing(null);
  });

  const handleSaveBulk = (rows) => run(async () => {
    await api.createInvestments(rows);
    setShowBulkModal(false);
  });

  const handleDelete = (row) => {
    if (!window.confirm(`「${row.name}」 투자를 삭제하시겠습니까?`)) return;
    run(() => api.deleteInvestment(row.id));
  };

  const handleSaveSettings = async (nextOptions) => {
    setError('');
    try {
      await api.saveCategory2Options(nextOptions);
      setCategory2Options(nextOptions);
      setShowSettingsModal(false);
    } catch (e) {
      setError(e.message);
    }
  };

  const openAdd = () => { setEditing(null); setShowFormModal(true); };
  const openEdit = (row) => { setEditing(row); setShowFormModal(true); };

  return (
    <Container>
      <Header
        onGoHome={onGoHome}
        onAdd={openAdd}
        onBulkAdd={() => setShowBulkModal(true)}
        onOpenSettings={() => setShowSettingsModal(true)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      <Scroller>
        <Content>
          {error && <ErrorBanner>{error}</ErrorBanner>}

          <Toolbar>
            <SearchBox>
              <Search size={16} color="#94a3b8" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="투자명, 사업부, 부서 검색"
              />
            </SearchBox>

            <FilterSelect value={filterYear} onChange={e => setFilterYear(e.target.value)}>
              <option value="">전체 년도</option>
              {years.map(y => <option key={y} value={String(y)}>{y}년</option>)}
            </FilterSelect>

            <CountBadge>{filtered.length} / {investments.length}건</CountBadge>

            <SaveButton
              onClick={handleSaveLocally}
              disabled={filtered.length === 0}
              title={viewMode === 'pivot'
                ? '지금 보이는 피벗을 CSV 로 저장합니다'
                : '지금 보이는 목록을 CSV 로 저장합니다'}
            >
              <Download size={15} />
              로컬 저장
            </SaveButton>
          </Toolbar>

          <FilterRow>
            <ToggleFilter
              label="사업부"
              options={options.divisions}
              selected={filterDivisions}
              onChange={setFilterDivisions}
            />
            <ToggleFilter
              label="투자 유형"
              options={CATEGORY1_OPTIONS}
              selected={filterCategory1s}
              onChange={setFilterCategory1s}
            />
          </FilterRow>

          {loading && <Message>불러오는 중...</Message>}
          {!loading && viewMode === 'table' && (
            <InvestmentTable
              investments={visibleRows}
              sort={sort}
              onToggleSort={key => setSort(prev => nextSort(prev, key))}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          )}
          {!loading && viewMode === 'pivot' && (
            <PivotView investments={filtered} orders={pivotOrders} />
          )}
        </Content>
      </Scroller>

      <InvestmentModal
        isOpen={showFormModal}
        onClose={() => { setShowFormModal(false); setEditing(null); }}
        onSave={handleSaveOne}
        initialValue={editing}
        divisions={options.divisions}
        processes={options.processes}
        departments={options.departments}
        departmentsByDivision={options.departmentsByDivision}
        category2Options={category2Options}
      />

      <BulkAddModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        onSave={handleSaveBulk}
        divisions={options.divisions}
        processes={options.processes}
        departments={options.departments}
        departmentsByDivision={options.departmentsByDivision}
        category2Options={category2Options}
      />

      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onSave={handleSaveSettings}
        category2Options={category2Options}
        usedCategory2={[...new Set(investments.map(r => r.category2).filter(Boolean))]}
      />
    </Container>
  );
};

export default DigitalTwinInvestmentApp;
