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
const Main = styled.div`
  flex: 1; min-height: 0; overflow-y: auto; padding: 1rem 1.5rem 2rem;
  display: flex; flex-direction: column;
  /* 목록 탭은 좌 표·우 상세가 화면을 다 쓰고 각자 스크롤된다 — 바깥은 안 흐른다 */
  ${p => (p.$fill ? 'overflow: hidden; padding-bottom: 1rem;' : '')}
`;
const Tab = styled.button`
  padding: 0.4rem 0.9rem; border: none; border-bottom: 2px solid ${p => (p.$on ? '#1d4ed8' : 'transparent')};
  background: transparent; color: ${p => (p.$on ? '#1d4ed8' : '#64748b')}; font-weight: 700; font-size: 0.9rem;
  font-family: inherit; cursor: pointer;
`;
// 사업부는 드롭다운이 아니라 **토글**이다 — 지금 어느 사업부를 보는지와 다른 사업부가
// 무엇이 있는지가 함께 보여야 한다(인텔 분야 토글과 같은 이유). 「전체」는 모든 사업부를
// 사업부별로 묶어 보여 준다.
const DivBar = styled.div`display: flex; gap: 0.25rem; align-items: center; flex-wrap: wrap;`;
const DivBtn = styled.button`
  padding: 0.3rem 0.7rem; border: 1px solid ${p => (p.$on ? '#1d4ed8' : '#e2e8f0')}; border-radius: 999px;
  background: ${p => (p.$on ? '#1d4ed8' : 'white')}; color: ${p => (p.$on ? 'white' : p.$muted ? '#94a3b8' : '#475569')};
  font-size: 0.8125rem; font-weight: 600; font-family: inherit; cursor: pointer;
  &:hover { border-color: #1d4ed8; }
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
  const [modal, setModal] = useState(null);        // { kind: 'subject'|'agent'|'import', id?: number } | null
  const [counts, setCounts] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const [d, v] = await Promise.all([maturityApi.getDefinitions(), maturityApi.getDivisions()]);
        setDefs(d.data); setDivisions(v.data); setError(null);
      } catch (e) { setError(e.message); }
    })();
  }, []);

  // 사업부: URL → 내 사업부 → 첫 사업부. 'all' 은 전체.
  const divisionId = useMemo(() => {
    if (params.get('division') === 'all') return 'all';
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
      <Header onGoHome={onGoHome} onOpen={(kind) => setModal({ kind })} counts={counts} />
      <StickyBar>
        <DivBar>
          <DivBtn type="button" $on={divisionId === 'all'} onClick={() => patch({ division: 'all', pair: null })} title="모든 사업부를 사업부별로 묶어 봅니다">전체</DivBtn>
          {divisions.map(d => (
            <DivBtn key={d.id} type="button" $on={divisionId === d.id} $muted={!!d.deny_reason}
                    title={d.deny_reason ? `${d.deny_reason} 조회만 됩니다.` : d.name}
                    onClick={() => patch({ division: d.id, pair: null })}>{d.name}</DivBtn>
          ))}
        </DivBar>
        <Tab $on={tab === 'board'} onClick={() => patch({ tab: null })}>성숙도</Tab>
        <Tab $on={tab === 'list'} onClick={() => patch({ tab: 'list' })}>목록</Tab>
        <Hint>시뮬레이션 부문 · 시험 × 시뮬레이션 쌍마다 정확도·자동화·모델링·범위·대체를 매깁니다. DX KPI(가상 검증률)와는 무관합니다.</Hint>
      </StickyBar>
      <Main $fill={tab === 'list'}>
        {error && <Notice><AlertTriangle size={14} /> <span>{error}</span></Notice>}
        {defs && divisionId && (tab === 'board' ? (
          <BoardView divisionId={divisionId} axes={axes} filters={filters} onFiltersChange={setFilters}
                     onOpenPair={(id) => patch({ pair: id })} refreshKey={refreshKey} />
        ) : (
          <ListView divisionId={divisionId} divisions={divisions} denyReason={division?.deny_reason || null}
                    axes={axes} pairId={pairId}
                    onOpenPair={(id) => patch({ pair: id })} onClosePair={() => patch({ pair: null })}
                    onEditSubject={(id) => setModal({ kind: 'subject', id })}
                    onEditAgent={(id) => setModal({ kind: 'agent', id })}
                    onChanged={bump} refreshKey={refreshKey} />
        ))}
        {pairId && defs && tab !== 'list' && (
          <PairModal pairId={pairId} axes={axes} onClose={() => patch({ pair: null })} onChanged={bump} />
        )}
        {modal && defs && divisionId && (
          <ModalHost kind={modal.kind} initialId={modal.id ?? null} divisionId={divisionId} divisionName={divisionId === 'all' ? '전체' : division?.name} divisions={divisions}
                     denyReason={division?.deny_reason || null} modelKinds={defs.model_kinds}
                     onClose={() => setModal(null)} onChanged={bump} />
        )}
      </Main>
    </Container>
  );
};

export default DevDtMaturityApp;
