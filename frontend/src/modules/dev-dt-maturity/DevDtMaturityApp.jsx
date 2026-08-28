import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import { AlertTriangle } from 'lucide-react';
import Header from './components/Layout/Header';
import BoardView from './components/Board/BoardView';
import ListView from './components/List/ListView';
import ReviewLedger from './components/Review/ReviewLedger';
import ThreadListView from './components/Thread/ThreadListView';
import ThreadDictModal from './components/Thread/ThreadDictModal';
import ThreadCaseLedger from './components/Thread/ThreadCaseLedger';
import PairModal from './components/Pair/PairModal';
import ModalHost from './components/List/ModalHost';
import SettingsModal from './components/Settings/SettingsModal';
import maturityApi from './services/maturityApi';
import { setSampleMode } from './sample/sampleStore';
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
// 사업부 차례 — 대시보드 설정(Division.order)이 정본. 서버가 실어 준 order 로 세운다.
const byOrder = (rows) => [...(rows || [])].sort((a, b) => ((a.order ?? 0) - (b.order ?? 0)) || (a.id - b.id));

const SampleBar = styled.div`
  flex-shrink: 0; display: flex; align-items: center; gap: 0.5rem; padding: 0.45rem 1.5rem; background: #fef3c7; border-bottom: 1px solid #fde68a; color: #92400e; font-size: 0.8125rem;
  strong { color: #78350f; } button { margin-left: auto; border: 1px solid #f59e0b; background: white; color: #92400e; border-radius: 999px; padding: 0.15rem 0.6rem; font-family: inherit; font-size: 0.75rem; cursor: pointer; }
`;
const StickyBar = styled.div`
  flex-shrink: 0; display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;
  padding: 0.875rem 1.5rem; border-bottom: 1px solid #e2e8f0; background: #f8fafc;
`;
const Main = styled.div`
  flex: 1; min-height: 0; overflow-y: auto; padding: 1rem 1.5rem 2rem;
  display: flex; flex-direction: column;
  /* 목록은 좌 표·우 상세가, 성숙도는 아래 표가 각자 스크롤된다 — 바깥은 안 흐른다(2026-08-28) */
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
const Tabs = styled.div`margin-left: auto; display: flex; gap: 0.25rem;`;   // 성숙도·목록은 오른쪽 끝(2026-08-28)
const DivBtn = styled.button`
  padding: 0.3rem 0.7rem; border: 1px solid ${p => (p.$on ? '#1d4ed8' : '#e2e8f0')}; border-radius: 999px;
  background: ${p => (p.$on ? '#1d4ed8' : 'white')}; color: ${p => (p.$on ? 'white' : p.$muted ? '#94a3b8' : '#475569')};
  font-size: 0.8125rem; font-weight: 600; font-family: inherit; cursor: pointer;
  &:hover { border-color: #1d4ed8; }
`;
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

  // 샘플 뷰 — URL ?sample=1 이고 관리자·사무국이면 서버 대신 목업을 읽는다. 정의는 먼저 서버에서 받아 권한을 본다.
  const wantSample = params.get('sample') === '1';
  const [sample, setSample] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        setSampleMode(false);
        const d = await maturityApi.getDefinitions();
        const allowed = wantSample && !!d.data?.can_curate;
        setSampleMode(allowed); setSample(allowed);
        const [d2, v] = await Promise.all([allowed ? maturityApi.getDefinitions() : Promise.resolve(d), maturityApi.getDivisions()]);
        setDefs(d2.data); setDivisions(byOrder(v.data)); setError(null);
        setRefreshKey(k => k + 1);
      } catch (e) { setError(e.message); }
    })();
    return () => setSampleMode(false);
  }, [wantSample]);
  // 설정(뺀 조직)이 바뀌면 사업부 줄만 다시 — 정의는 그대로
  useEffect(() => {
    if (!refreshKey) return;
    maturityApi.getDivisions().then(v => setDivisions(byOrder(v.data))).catch(() => {});
  }, [refreshKey]);

  // 사업부: URL → 내 사업부 → 첫 사업부. 'all' 은 전체.
  // 들어오면 「성숙도 · 전체 · 요약」이 기본이다(2026-08-28) — URL 에 사업부가 있을 때만 그 사업부.
  const divisionId = useMemo(() => {
    const raw = params.get('division');
    if (!raw || raw === 'all') return divisions.length ? 'all' : null;
    const fromUrl = Number(raw);
    if (fromUrl && divisions.some(d => d.id === fromUrl)) return fromUrl;
    return 'all';
  }, [params, divisions]);
  const division = divisions.find(d => d.id === divisionId);
  const tab = ['list', 'reviews', 'cases'].includes(params.get('tab')) ? params.get('tab') : 'board';
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
    // 필터를 바꿔도 부문·샘플 뷰는 남아야 한다 — 빠지면 시뮬레이션으로 튄다(2026-08-28)
    ['division', 'tab', 'pair', 'sector', 'sample'].forEach(k => { if (params.get(k)) keep.set(k, params.get(k)); });
    Object.entries(filtersToParams(f)).forEach(([k, v]) => keep.set(k, v));
    setParams(keep, { replace: true });
  };

  // 부문 — URL ?sector=. 열린 부문만(정의의 active). 시뮬레이션이 기본.
  const sector = useMemo(() => {
    const raw = params.get('sector');
    const ok = (defs?.sectors || []).some(s => s.key === raw && s.active);
    return ok ? raw : 'simulation';
  }, [params, defs]);
  const isThread = sector === 'digital_thread';
  const axes = defs?.axes?.[sector] || [];
  const bump = () => setRefreshKey(k => k + 1);

  // 헤더 단추에 붙는 수 — 사업부가 바뀌거나 무엇이 바뀌면 다시 센다.
  useEffect(() => {
    if (isThread) { setCounts({}); return undefined; }
    if (!divisionId) return;
    let alive = true;
    Promise.all([maturityApi.listSubjects(divisionId), maturityApi.listAgents(divisionId)])
      .then(([s, a]) => { if (alive) setCounts({ subjects: s.data.length, agents: a.data.length }); })
      .catch(() => {});
    return () => { alive = false; };
  }, [isThread, divisionId, refreshKey]);

  return (
    <Container>
      <Header onGoHome={onGoHome} onOpen={(kind) => setModal({ kind })} counts={counts} canCurate={!!defs?.can_curate}
              sample={sample} onToggleSample={() => patch({ sample: sample ? null : '1', pair: null })}
              sector={sector} sectors={defs?.sectors || []} onSector={(k) => patch({ sector: k === 'simulation' ? null : k, pair: null, tab: null })} />
      {sample && (
        <SampleBar role="status">
          <strong>샘플 뷰</strong> — 개발용 목업 자료로 그린 화면입니다. 실제 자료가 아니며, 저장되지 않습니다.
          <button type="button" onClick={() => patch({ sample: null, pair: null })}>실제 자료로</button>
        </SampleBar>
      )}
      <StickyBar>
        <DivBar>
          <DivBtn type="button" $on={divisionId === 'all'} onClick={() => patch({ division: 'all', pair: null })} title="모든 사업부를 사업부별로 묶어 봅니다">전체</DivBtn>
          {divisions.map(d => (
            <DivBtn key={d.id} type="button" $on={divisionId === d.id} $muted={!!d.deny_reason}
                    title={d.deny_reason ? `${d.deny_reason} 조회만 됩니다.` : d.name}
                    onClick={() => patch({ division: d.id, pair: null })}>{d.name}</DivBtn>
          ))}
        </DivBar>
        <Tabs>
          {/* 탭을 옮기면 고른 연계은 푼다 — 목록에서 고른 채 성숙도로 가면 모달이 떠 있었다(2026-08-28) */}
          <Tab $on={tab === 'board'} onClick={() => patch({ tab: null, pair: null })}>성숙도</Tab>
          <Tab $on={tab === 'list'} onClick={() => patch({ tab: 'list', pair: null })}>목록</Tab>
          {!isThread && <Tab $on={tab === 'reviews'} onClick={() => patch({ tab: 'reviews', pair: null })} title="시험과 짝이 없는 스팟성 시뮬레이션 — 설계 스펙 검토·원인 분석을 건으로 쌓는다">해석 활용 기록</Tab>}
          {isThread && <Tab $on={tab === 'cases'} onClick={() => patch({ tab: 'cases', pair: null })} title="시스템 연동·도입·정합화·자동화·폐지 건을 쌓는다 — 끝나면 구간의 연결 방식이 몇 칸 올라갔나">연계 개발 기록</Tab>}
        </Tabs>
      </StickyBar>
      <Main $fill>
        {error && <Notice><AlertTriangle size={14} /> <span>{error}</span></Notice>}
        {defs && divisionId && (tab === 'board' ? (
          <BoardView divisionId={divisionId} axes={axes} filters={filters} onFiltersChange={setFilters} sector={sector} sectorDef={(defs.sectors || []).find(s => s.key === sector)}
                     onOpenPair={(id) => patch({ pair: id })} onPickDivision={(id) => patch({ division: id, pair: null })} refreshKey={refreshKey} review={isThread ? null : defs.review} />
        ) : isThread && tab === 'cases' ? (
          <ThreadCaseLedger divisionId={divisionId} divisions={divisions} denyReason={division?.deny_reason || null} thread={defs.thread} axes={axes} refreshKey={refreshKey} />
        ) : isThread ? (
          <ThreadListView divisionId={divisionId} divisions={divisions} denyReason={division?.deny_reason || null} axes={axes} pairId={pairId} thread={defs.thread}
                          onOpenPair={(id) => patch({ pair: id })} onClosePair={() => patch({ pair: null })} onChanged={bump} refreshKey={refreshKey}
                          onManage={(kind) => setModal({ kind })} />
        ) : tab === 'reviews' ? (
          <ReviewLedger divisionId={divisionId} divisions={divisions} denyReason={division?.deny_reason || null} review={defs.review} refreshKey={refreshKey} />
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
        {modal && ['system', 'org', 'thread'].includes(modal.kind) && defs && (
          <ThreadDictModal kind={modal.kind} divisionId={divisionId} divisions={divisions} thread={defs.thread} axes={defs.axes?.digital_thread || []}
                           canCurate={!!defs.can_curate} denyReason={division?.deny_reason || null} onClose={() => setModal(null)} onChanged={bump} />
        )}
        {modal?.kind === 'settings' && defs && (
          <SettingsModal divisions={divisions} accuracyRungs={(axes.find(a => a.key === 'accuracy') || {}).rungs || []}
                         onClose={() => setModal(null)} onChanged={bump} />
        )}
        {modal && !['settings', 'system', 'org', 'thread'].includes(modal.kind) && defs && divisionId && (
          <ModalHost kind={modal.kind} initialId={modal.id ?? null} divisionId={divisionId} divisionName={divisionId === 'all' ? '전체' : division?.name} divisions={divisions}
                     denyReason={division?.deny_reason || null} modelKinds={defs.model_kinds}
                     onClose={() => setModal(null)} onChanged={bump} />
        )}
      </Main>
    </Container>
  );
};

export default DevDtMaturityApp;
