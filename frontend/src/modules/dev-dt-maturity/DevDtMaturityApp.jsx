import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import { AlertTriangle } from 'lucide-react';
import Header from './components/Layout/Header';
import BoardView from './components/Board/BoardView';
import ListView from './components/List/ListView';
import PairModal from './components/Pair/PairModal';
import ModalHost from './components/List/ModalHost';
import maturityApi from './services/maturityApi';
import { filtersFromParams, filtersToParams } from './utils/board';

// 개발 디지털 트윈 성숙도 — 시험 하나에 대해 시뮬레이션이 어디까지 왔는가.
// 계획: ./PLAN.md
//
// 최상위 상태는 **사업부**다. 이 모듈에는 「전체」가 없다(PLAN 7-1) — 전 사업부 ×
// 시험 100줄 × 축 6열은 아무도 안 읽는다. 기본값은 로그인한 사람의 사업부.
//
// URL 이 상태를 든다: ?division=…&tab=…&pair=…&필터. 공유·북마크·다른 모듈의 링크가
// 전부 이 주소로 온다.

const Container = styled.div`display: flex; flex-direction: column; height: 100vh; background: #f8fafc;`;
const StickyBar = styled.div`
  flex-shrink: 0; display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;
  padding: 0.875rem 1.5rem; border-bottom: 1px solid #e2e8f0; background: #f8fafc;
`;
const Main = styled.div`flex: 1; overflow-y: auto; padding: 1rem 1.5rem 2rem;`;
const Tab = styled.button`
  padding: 0.4rem 0.9rem; border: none; border-bottom: 2px solid ${p => (p.$on ? '#1d4ed8' : 'transparent')};
  background: transparent; color: ${p => (p.$on ? '#1d4ed8' : '#64748b')}; font-weight: 700; font-size: 0.9rem;
  font-family: inherit; cursor: pointer;
`;
const Select = styled.select`
  padding: 0.35rem 0.6rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; font-family: inherit; font-size: 0.875rem; font-weight: 600;
`;
const Hint = styled.span`font-size: 0.75rem; color: #94a3b8;`;
const Notice = styled.div`
  display: flex; gap: 0.4rem; align-items: flex-start; padding: 0.6rem 0.75rem; border-radius: 0.5rem; margin-bottom: 0.75rem;
  background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; font-size: 0.8125rem;
`;

const DevDtMaturityApp = ({ onGoHome }) => {
  const [params, setParams] = useSearchParams();
  const [defs, setDefs] = useState(null);
  const [divisions, setDivisions] = useState([]);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [modal, setModal] = useState(null);        // 'subject' | 'agent' | 'import' | null
  const [counts, setCounts] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const [d, v] = await Promise.all([maturityApi.getDefinitions(), maturityApi.getDivisions()]);
        setDefs(d.data); setDivisions(v.data); setError(null);
      } catch (e) { setError(e.message); }
    })();
  }, []);

  // 사업부: URL → 내 사업부 → 첫 사업부
  const divisionId = useMemo(() => {
    const fromUrl = Number(params.get('division'));
    if (fromUrl && divisions.some(d => d.id === fromUrl)) return fromUrl;
    if (defs?.my_division_id && divisions.some(d => d.id === defs.my_division_id)) return defs.my_division_id;
    return divisions[0]?.id ?? null;
  }, [params, divisions, defs]);
  const division = divisions.find(d => d.id === divisionId);
  const tab = params.get('tab') === 'list' ? 'list' : 'board';
  const pairId = Number(params.get('pair')) || null;
  const filters = useMemo(() => filtersFromParams(k => params.get(k)), [params]);

  const patch = useCallback((changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => {
      if (v === null || v === undefined || v === '' || v === false) next.delete(k); else next.set(k, String(v));
    });
    setParams(next, { replace: true });
  }, [params, setParams]);

  const setFilters = (f) => {
    const keep = new URLSearchParams();
    ['division', 'tab', 'pair'].forEach(k => { if (params.get(k)) keep.set(k, params.get(k)); });
    Object.entries(filtersToParams(f)).forEach(([k, v]) => keep.set(k, v));
    setParams(keep, { replace: true });
  };

  const axes = defs?.axes?.simulation || [];
  const bump = () => setRefreshKey(k => k + 1);

  // 헤더 단추에 붙는 수 — 사업부가 바뀌거나 무엇이 바뀌면 다시 센다.
  useEffect(() => {
    if (!divisionId) return;
    let alive = true;
    Promise.all([maturityApi.listSubjects(divisionId), maturityApi.listAgents(divisionId)])
      .then(([s, a]) => { if (alive) setCounts({ subjects: s.data.length, agents: a.data.length }); })
      .catch(() => {});
    return () => { alive = false; };
  }, [divisionId, refreshKey]);

  return (
    <Container>
      <Header onGoHome={onGoHome} onOpen={setModal} counts={counts} />
      <StickyBar>
        <Select value={divisionId ?? ''} onChange={e => patch({ division: e.target.value, pair: null })}>
          {divisions.map(d => <option key={d.id} value={d.id}>{d.name}{d.deny_reason ? ' (조회)' : ''}</option>)}
        </Select>
        <Tab $on={tab === 'board'} onClick={() => patch({ tab: null })}>성숙도</Tab>
        <Tab $on={tab === 'list'} onClick={() => patch({ tab: 'list' })}>목록</Tab>
        <Hint>시뮬레이션 부문 · 시험 × 시뮬레이션 쌍마다 정확도·자동화·모델링·범위·대체를 매깁니다. DX KPI(가상 검증률)와는 무관합니다.</Hint>
      </StickyBar>
      <Main>
        {error && <Notice><AlertTriangle size={14} /> <span>{error}</span></Notice>}
        {defs && divisionId && (tab === 'board' ? (
          <BoardView divisionId={divisionId} axes={axes} filters={filters} onFiltersChange={setFilters}
                     onOpenPair={(id) => patch({ pair: id })} refreshKey={refreshKey} />
        ) : (
          <ListView divisionId={divisionId} denyReason={division?.deny_reason || null}
                    onOpenPair={(id) => patch({ pair: id })} onChanged={bump} refreshKey={refreshKey} />
        ))}
        {pairId && defs && (
          <PairModal pairId={pairId} axes={axes} onClose={() => patch({ pair: null })} onChanged={bump} />
        )}
        {modal && defs && divisionId && (
          <ModalHost kind={modal} divisionId={divisionId} divisionName={division?.name}
                     denyReason={division?.deny_reason || null} modelKinds={defs.model_kinds}
                     onClose={() => setModal(null)} onChanged={bump} />
        )}
      </Main>
    </Container>
  );
};

export default DevDtMaturityApp;
