import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import maturityApi from '../../services/maturityApi';
import ThreadGraphCanvas from './ThreadGraphCanvas';
import SystemDetailModal from './SystemDetailModal';
import { buildSystemGraph, threadColors } from '../../utils/systemGraph';

// 시스템 연결도(2026-08-29) — 모판 옆의 다섯째 보기.
// 시스템이 노드, 구간이 간선인 건 사업부 요약의 시스템 지도와 같지만, 여기선 **간선 색 = 스레드**다
// (지도는 연결 방식 색 — 역할 분담). 연결 방식은 선 모양으로: 자동 전달 이상 실선, 그 아래·미평가 점선.
// 같은 두 시스템 사이를 여러 스레드가 지나면 부채처럼 갈라 나란히 — 두 시스템이 몇 줄의 등뼈인지 보인다.
//
// 그림은 관계도와 같은 force-graph 캔버스(ThreadGraphCanvas)가 그리고, 무엇을 그릴지는
// utils/systemGraph 가 정한다. 여기는 **불러오기와 범례**만 맡는다.

const Wrap = styled.div`display: flex; flex-direction: column; gap: 0.4rem; flex: 1; min-height: 0;`;
const Bar = styled.div`display: flex; gap: 0.3rem; flex-wrap: wrap; font-size: 0.75rem; align-items: center;`;
const Chip = styled.button`
  display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.15rem 0.6rem; border-radius: 999px; font-family: inherit; font-size: 0.75rem; cursor: pointer;
  border: 1px solid ${p => p.$c || '#cbd5e1'}; background: ${p => (p.$on ? p.$c || '#1d4ed8' : 'white')}; color: ${p => (p.$on ? 'white' : '#475569')};
`;
const Dot = styled.span`width: 0.55rem; height: 0.55rem; border-radius: 999px; background: ${p => (p.$on ? 'white' : p.$c)};`;
const Muted = styled.div`padding: 1rem; color: #94a3b8; font-size: 0.8125rem;`;

const ThreadSystemGraph = ({ divisionId, thread, onOpenPair }) => {
  const [segments, setSegments] = useState(null);
  const [systems, setSystems] = useState([]);
  const [threads, setThreads] = useState([]);
  const [focus, setFocus] = useState(null);
  const [labels, setLabels] = useState(false);      // 간선에 스레드 이름을 붙였다 뺐다
  const [pick, setPick] = useState(null);           // 누른 시스템 — 창을 연다
  useEffect(() => {
    setSegments(null);
    Promise.all([maturityApi.listSegments(divisionId ?? 'all'), maturityApi.listSystems(), maturityApi.listThreads()])
      .then(([s, sy, t]) => { setSegments(s.data || []); setSystems(sy.data || []); setThreads(t.data || []); })
      .catch(() => setSegments([]));
  }, [divisionId]);
  const graph = useMemo(() => buildSystemGraph(segments || [], systems, threads), [segments, systems, threads]);
  const colorOf = useMemo(() => threadColors(threads), [threads]);
  if (segments == null) return <Muted>불러오는 중…</Muted>;
  if (!graph.nodes.length) return <Muted>시스템을 적은 구간이 없습니다 — 목록에서 구간에 출발·매개·도착 시스템을 채우면 여기 그려집니다.</Muted>;
  const used = threads.filter(t => graph.links.some(l => l.thread_id === t.id));
  return (
    <Wrap>
      <Bar>
        <Chip type="button" $on={focus == null} onClick={() => setFocus(null)}>전부</Chip>
        {used.map(t => (
          <Chip key={t.id} type="button" $on={focus === t.id} $c={colorOf(t.id)} onClick={() => setFocus(focus === t.id ? null : t.id)}>
            <Dot $c={colorOf(t.id)} $on={focus === t.id} />{t.name}
          </Chip>
        ))}
        <Chip type="button" $on={labels} aria-pressed={labels} onClick={() => setLabels(v => !v)}
              title="간선마다 어느 스레드인지 이름을 선 위에 적습니다" style={{ marginLeft: '0.5rem' }}>스레드 이름</Chip>
        <span style={{ color: '#94a3b8', marginLeft: 'auto' }}>
          간선 색 = 스레드 · 실선 = 자동 전달 이상 · 점선 = 사람이 옮김·미평가 · 끌어 옮기면 그 자리에 고정 · 간선을 누르면 그 구간
        </span>
      </Bar>
      <ThreadGraphCanvas nodes={graph.nodes} links={graph.links} focusThread={focus} showLabels={labels}
                         onOpenPair={onOpenPair} onPickSystem={(id) => setPick(id)} />
      {pick != null && (
        <SystemDetailModal
          system={(() => {
            const s = systems.find(x => x.id === pick);
            if (!s) return null;
            return {
              ...s,
              kind_label: (thread?.system_kinds || []).find(k => k.key === s.kind)?.label,
              stage_labels: (s.stages || []).map(k => (thread?.stages || []).find(x => x.key === k)?.label || k),
            };
          })()}
          segments={segments || []} systems={systems} divisionId={divisionId}
          onOpenPair={(id) => { setPick(null); onOpenPair && onOpenPair(id); }}
          onClose={() => setPick(null)} />
      )}
    </Wrap>
  );
};

export default ThreadSystemGraph;
