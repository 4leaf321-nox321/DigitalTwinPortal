import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import maturityApi from '../../services/maturityApi';
import SystemMap from './SystemMap';

// 디지털 스레드의 셈을 그리는 부품 둘(2026-08-28).
//   ThreadOverviewRows — 전체 요약 표의 아래 줄: 스레드마다 사업부별 연속성 % · 도달 단계 · 최약 구간
//   ThreadDivisionPanels — 사업부 요약의 아래: 스레드 줄 그림(단계를 가로로, 구간을 연결 방식 색으로) · 조직 연계표 · 시스템 허브도
// 축 판(정확도 자리의 연결 방식 …)은 시뮬레이션 부문과 같은 부품이 그리고, 여기는 「줄」 단위만 더한다.

const LINK_COLORS = ['#fca5a5', '#fdba74', '#93c5fd', '#3b82f6', '#1d4ed8', '#1e3a8a'];   // 문서·구두 → 폐루프
const linkColor = (i) => (i == null ? '#e2e8f0' : LINK_COLORS[Math.min(i, LINK_COLORS.length - 1)]);
const dark = (i) => i != null && i >= 3;

const Big = styled.div`font-size: 1.75rem; font-weight: 700; color: #1e293b; line-height: 1.1;`;
const Small = styled.div`font-size: 0.8125rem; color: #64748b; margin-top: 0.3rem; white-space: nowrap;`;
const Pill = styled.span`display: inline-block; margin-left: 0.3rem; padding: 0 0.45rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; background: ${p => (p.$warn ? '#fef3c7' : p.$good ? '#dcfce7' : '#f1f5f9')}; color: ${p => (p.$warn ? '#92400e' : p.$good ? '#166534' : '#64748b')};`;
const Name = styled.td`font-weight: 700; color: #1e293b; white-space: nowrap; font-size: 1rem; text-align: left !important; small { display: block; font-weight: 400; color: #94a3b8; font-size: 0.6875rem; }`;
const SecHead = styled.td`background: #f8fafc !important; text-align: left !important; border-top: 2px solid #e2e8f0; padding: 0.4rem 0.9rem !important; font-size: 0.8125rem; color: #64748b; strong { color: #1e293b; font-size: 0.9375rem; margin-right: 0.5rem; }`;
const TdAll = styled.td`border-left: 2px solid #e2e8f0; background: #fafafa;`;

const cellOf = (t) => {
  if (!t || t.segment_count === 0) return <Small style={{ color: '#94a3b8' }}>구간 없음</Small>;
  return (
    <>
      <Big>{t.continuity != null ? `${t.continuity}%` : '—'}<span style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 500 }}> 연속</span></Big>
      <Small>도달 {t.reach_label || '—'} · 구간 {t.assessed}/{t.segment_count}{t.unassessed > 0 && <Pill $warn>미평가 {t.unassessed}</Pill>}{t.closed_loop && <Pill $good>폐루프</Pill>}</Small>
      <Small>최약 {t.weakest ? `${t.weakest.name} · ${t.weakest.link_label}` : '—'}{t.informal_ratio > 0 && <Pill $warn>비공식 {t.informal_ratio}%</Pill>}</Small>
    </>
  );
};

/** 전체 요약 표의 스레드 줄들 — boards 의 사업부 순서를 그대로 따른다. 맨 오른쪽 「전체」는 구간 수로 가중. */
export const ThreadOverviewRows = ({ boards }) => {
  const [data, setData] = useState(null);
  useEffect(() => { maturityApi.threadStats('all').then(r => setData(r.data)).catch(() => setData(null)); }, []);
  const by = Object.fromEntries((data?.divisions || []).map(d => [d.division_id, d]));
  const threads = data?.divisions?.[0]?.threads || [];
  const whole = (key) => {
    const ts = boards.map(b => (by[b.division_id]?.threads || []).find(t => t.thread_key === key)).filter(Boolean);
    const segs = ts.reduce((n, t) => n + t.segment_count, 0);
    const assessed = ts.reduce((n, t) => n + t.assessed, 0);
    const linked = ts.reduce((n, t) => n + (t.continuity != null ? Math.round(t.continuity * t.assessed / 100) : 0), 0);
    return { segment_count: segs, assessed, unassessed: segs - assessed, continuity: assessed ? Math.round(100 * linked / assessed) : null,
      reach_label: null, weakest: null, closed_loop: ts.some(t => t.closed_loop), informal_ratio: null };
  };
  return (
    <>
      <tr><SecHead colSpan={boards.length + 2}><strong>스레드</strong>구간을 모아 줄로 — 연속성(자동 파일 교환 이상 %) · 도달 단계 · 최약 구간</SecHead></tr>
      {threads.map(t => (
        <tr key={t.thread_key}>
          <Name>{t.thread_name}<small>표준 구간 {t.def_count}</small></Name>
          {boards.map(b => <td key={b.division_id}>{cellOf((by[b.division_id]?.threads || []).find(x => x.thread_key === t.thread_key))}</td>)}
          <TdAll>{cellOf(whole(t.thread_key))}</TdAll>
        </tr>
      ))}
    </>
  );
};

// ── 사업부 요약의 스레드 판들 ──────────────────────────────────────────────
const Grid = styled.div`display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem;`;
const Panel = styled.section`
  display: flex; flex-direction: column; gap: 0.5rem; border: 1px solid #e2e8f0; border-radius: 0.6rem; background: white; padding: 0.8rem 0.9rem; min-height: 0;
  h4 { margin: 0; font-size: 1.05rem; color: #1e293b; } h4 span { font-size: 0.75rem; color: #94a3b8; font-weight: 400; margin-left: 0.4rem; }
`;
const Wide = styled(Panel)`grid-column: 1 / -1;`;
const Line = styled.div`display: flex; align-items: center; gap: 0.25rem; margin: 0.3rem 0;`;
const ThreadLabel = styled.div`width: 11rem; flex-shrink: 0; font-size: 0.8125rem; font-weight: 600; color: #1e293b; small { display: block; font-weight: 400; color: #64748b; font-size: 0.6875rem; }`;
const Seg = styled.button`
  flex: 1 1 0; min-width: 0; height: 2.1rem; border: none; border-radius: 0.3rem; font-family: inherit; font-size: 0.6875rem; font-weight: 600; cursor: pointer; padding: 0 0.3rem; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  background: ${p => p.$color}; color: ${p => (p.$dark ? 'white' : '#1e293b')}; opacity: ${p => (p.$missing ? 0.55 : 1)};
  ${p => (p.$missing ? 'border: 1px dashed #94a3b8; background: white; color: #94a3b8;' : '')}
  &:hover { outline: 2px solid #1d4ed8; }
`;
const Legend = styled.div`display: flex; flex-wrap: wrap; gap: 0.5rem 0.9rem; font-size: 0.6875rem; color: #64748b; i { display: inline-block; width: 0.7rem; height: 0.7rem; border-radius: 2px; margin-right: 0.25rem; vertical-align: -1px; }`;
const Table = styled.table`
  width: 100%; border-collapse: collapse; font-size: 0.8125rem;
  th { text-align: left; font-size: 0.6875rem; font-weight: 700; color: #64748b; padding: 0.3rem 0.5rem; border-bottom: 1px solid #e2e8f0; }
  td { padding: 0.3rem 0.5rem; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
`;
const LinkTag = styled.span`display: inline-block; padding: 0 0.45rem; border-radius: 999px; font-size: 0.6875rem; font-weight: 600; background: ${p => p.$color}; color: ${p => (p.$dark ? 'white' : '#1e293b')};`;
const Muted = styled.div`font-size: 0.8125rem; color: #94a3b8;`;

export const ThreadDivisionPanels = ({ divisionId, subjects = [], axes = [], onOpenPair }) => {
  const [stats, setStats] = useState(null);
  const [matrix, setMatrix] = useState([]);
  const [hubs, setHubs] = useState([]);
  const [threads, setThreads] = useState([]);
  useEffect(() => {
    if (divisionId == null || divisionId === 'all') return;
    maturityApi.threadStats(divisionId).then(r => setStats(r.data)).catch(() => setStats(null));
    maturityApi.orgMatrix(divisionId).then(r => setMatrix(r.data || [])).catch(() => setMatrix([]));
    maturityApi.systemHubs(divisionId).then(r => setHubs(r.data || [])).catch(() => setHubs([]));
    maturityApi.listThreads().then(r => setThreads(r.data || [])).catch(() => setThreads([]));
  }, [divisionId]);
  const linkAxis = axes.find(a => a.key === 'link_mode');
  const segBySubject = Object.fromEntries(subjects.map(s => [s.id, s]));
  const linkIdx = (s) => s?.pairs?.[0]?.assessments?.link_mode?.rung_index ?? null;
  return (
    <Grid>
      <Wide aria-label="스레드 줄">
        <h4>스레드<span>표준 구간을 왼쪽에서 오른쪽으로 — 색은 연결 방식, 점선은 아직 안 적은 구간. 누르면 그 구간</span></h4>
        {threads.map(t => {
          const st = (stats?.threads || []).find(x => x.thread_key === t.key);
          return (
            <Line key={t.key}>
              <ThreadLabel>{t.name}<small>{st ? `연속 ${st.continuity != null ? `${st.continuity}%` : '—'} · 도달 ${st.reach_label || '—'}${st.closed_loop ? ' · 폐루프' : ''}` : ''}</small></ThreadLabel>
              {t.segments.map(sd => {
                const inst = subjects.find(s => s.segment?.segment_def_id === sd.id);
                const idx = inst ? linkIdx(inst) : null;
                const label = linkAxis?.rungs?.[idx]?.label;
                return (
                  <Seg key={sd.id} type="button" $color={linkColor(idx)} $dark={dark(idx)} $missing={!inst}
                       title={`${sd.name}${inst ? ` — ${label || '미평가'}${inst.segment?.via_informal ? ' · 비공식 매개' : ''}` : ' — 아직 안 적음'}`}
                       onClick={() => inst?.pairs?.[0] && onOpenPair && onOpenPair(inst.pairs[0].id)}>
                    {sd.name}
                  </Seg>
                );
              })}
            </Line>
          );
        })}
        <Legend>{(linkAxis?.rungs || []).map((r, i) => <span key={r.key}><i style={{ background: linkColor(i) }} />{r.label}</span>)}<span><i style={{ border: '1px dashed #94a3b8' }} />안 적음</span></Legend>
      </Wide>
      <Panel aria-label="조직 연계표">
        <h4>조직 간 연계<span>둘 사이 구간 수 · 최약 연결 방식 · 지나는 시스템</span></h4>
        {matrix.length === 0 ? <Muted>조직을 적은 구간이 없습니다.</Muted> : (
          <Table>
            <thead><tr><th>출발</th><th>도착</th><th>구간</th><th>최약</th><th>시스템</th></tr></thead>
            <tbody>
              {matrix.map(c => (
                <tr key={`${c.from_org_id}-${c.to_org_id}`}>
                  <td>{c.from_org}</td><td>{c.to_org}</td><td>{c.count}{c.informal > 0 && <Pill $warn>비공식 {c.informal}</Pill>}</td>
                  <td>{c.min_link != null ? <LinkTag $color={linkColor(c.min_link)} $dark={dark(c.min_link)}>{c.min_link_label}</LinkTag> : <span style={{ color: '#94a3b8' }}>미평가</span>}</td>
                  <td style={{ color: '#64748b' }}>{c.systems.join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
      <Panel aria-label="시스템 허브도">
        <h4>시스템 허브도<span>지나는 스레드·구간 수 · 평균 연결 방식 · 연계 수단</span></h4>
        {hubs.length === 0 ? <Muted>시스템을 적은 구간이 없습니다.</Muted> : (
          <Table>
            <thead><tr><th>시스템</th><th>종류</th><th>스레드</th><th>구간</th><th>평균 연결</th><th>연계 수단</th></tr></thead>
            <tbody>
              {hubs.map(h => (
                <tr key={h.id}>
                  <td style={{ fontWeight: 600 }}>{h.name}</td><td style={{ color: '#64748b' }}>{h.kind}</td><td>{h.threads}</td><td>{h.segments}</td>
                  <td>{h.avg_link != null ? <LinkTag $color={linkColor(Math.round(h.avg_link))} $dark={dark(Math.round(h.avg_link))}>{linkAxis?.rungs?.[Math.round(h.avg_link)]?.label || h.avg_link}</LinkTag> : '—'}</td>
                  <td>{h.unknown_means ? <Pill $warn>미확인</Pill> : h.link_means}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
      <Wide aria-label="시스템 지도">
        <h4>시스템 지도<span>어느 시스템을 지나 어느 조직 사이를 건너나</span></h4>
        <SystemMap divisionId={divisionId} threads={threads} onOpenPair={onOpenPair} />
      </Wide>
      {Object.keys(segBySubject).length === 0 && <Muted>아직 구간이 없습니다 — 목록 탭에서 구간을 더하세요.</Muted>}
    </Grid>
  );
};

export default ThreadDivisionPanels;
