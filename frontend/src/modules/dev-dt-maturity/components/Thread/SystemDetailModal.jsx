import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { X } from 'lucide-react';
import maturityApi from '../../services/maturityApi';
import { KIND_COLORS } from '../../utils/systemGraph';

// 시스템 창(2026-08-29) — 연결도의 노드를 누르면 **그 시스템 관점으로** 모든 것을 모아 본다.
//   머리   이름·종류·상태·연계 수단·주관 조직·생애 단계·메모
//   수치   지나는 구간 · 스레드 · 사업부 · 자동 전달 이상 % + 연결 단계 분포 띠
//   이웃   이 시스템과 직접 이어진 시스템들(건수·자동 전달 이상 수)
//   구간   이 시스템을 지나는 구간 전부 — 역할(출발·매개·도착)과 연결 단계. 누르면 그 구간의 평가판
//   기록   연계 개발 기록 중 이 시스템의 건들
// 자료는 연결도가 이미 불러 둔 구간·시스템을 그대로 쓰고, 기록만 창을 열 때 따로 부른다.

const Backdrop = styled.div`position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); display: flex; align-items: center; justify-content: center; z-index: 60;`;
const Box = styled.div`width: min(88rem, 97vw); height: min(52rem, 94vh); display: flex; flex-direction: column; background: white; border-radius: 0.75rem; box-shadow: 0 20px 60px rgba(15, 23, 42, 0.3); overflow: hidden;`;
const Head = styled.div`display: flex; align-items: center; gap: 0.5rem; padding: 0.8rem 1.1rem; border-bottom: 1px solid #e2e8f0;`;
const Ball = styled.span`width: 0.9rem; height: 0.9rem; border-radius: 999px; background: ${p => p.$c}; flex: none;`;
const Title = styled.h3`margin: 0; font-size: 1.05rem; color: #1e293b; flex: 1; small { font-weight: 400; font-size: 0.8125rem; color: #94a3b8; margin-left: 0.4rem; }`;
const IconBtn = styled.button`border: none; background: transparent; color: #64748b; cursor: pointer; padding: 0.25rem; border-radius: 0.3rem; &:hover { background: #f1f5f9; }`;
// 몸통을 좌우로 — 왼쪽(지표·이웃)은 **늘 보이고**, 오른쪽 표만 스크롤한다(2026-08-29 요청).
const Body = styled.div`flex: 1; min-height: 0; display: grid; grid-template-columns: 22rem minmax(0, 1fr); @media (max-width: 900px) { grid-template-columns: 1fr; }`;
const Side = styled.div`padding: 0.9rem 1.1rem; border-right: 1px solid #e2e8f0; background: #f8fafc; display: flex; flex-direction: column; gap: 0.9rem; overflow: auto;`;
const Main = styled.div`min-height: 0; display: grid; grid-template-rows: minmax(0, 3fr) minmax(0, 2fr);`;
const Panel = styled.section`
  min-height: 0; display: flex; flex-direction: column; padding: 0.7rem 1.1rem 0.9rem;
  & + & { border-top: 1px solid #e2e8f0; }
  h4 { margin: 0 0 0.35rem; font-size: 0.875rem; color: #1e293b; flex: none; }
  h4 span { font-weight: 400; font-size: 0.75rem; color: #94a3b8; margin-left: 0.35rem; }
`;
const Scroll = styled.div`flex: 1; min-height: 0; overflow: auto;`;
const Tag = styled.span`display: inline-block; padding: 0.1rem 0.5rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; background: ${p => p.$bg || '#f1f5f9'}; color: ${p => p.$fg || '#475569'};`;
const Tags = styled.div`display: flex; flex-wrap: wrap; gap: 0.3rem; align-items: center;`;
const Stats = styled.div`display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.5rem;`;
const Stat = styled.div`border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 0.5rem 0.6rem; text-align: center; b { display: block; font-size: 1.35rem; color: #1e293b; } span { font-size: 0.75rem; color: #64748b; }`;
const Bar = styled.div`display: flex; height: 0.6rem; border-radius: 999px; overflow: hidden; background: #f1f5f9;`;
const Seg = styled.div`width: ${p => p.$pct}%; background: ${p => p.$c};`;
const Sec = styled.section`display: flex; flex-direction: column; gap: 0.35rem; h4 { margin: 0; font-size: 0.875rem; color: #1e293b; } h4 span { font-weight: 400; font-size: 0.75rem; color: #94a3b8; margin-left: 0.35rem; }`;
const Table = styled.table`width: 100%; border-collapse: collapse; font-size: 0.8125rem;
  th { position: sticky; top: 0; background: white; z-index: 1; text-align: left; font-size: 0.6875rem; color: #64748b; font-weight: 700; padding: 0.25rem 0.4rem; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
  td { padding: 0.3rem 0.4rem; border-bottom: 1px solid #f1f5f9; color: #1e293b; vertical-align: middle; }
`;
const RowBtn = styled.button`border: none; background: transparent; font-family: inherit; font-size: 0.8125rem; font-weight: 600; color: #1e293b; cursor: pointer; padding: 0; text-align: left; &:hover { color: #1d4ed8; text-decoration: underline; }`;
const Muted = styled.div`font-size: 0.8125rem; color: #94a3b8;`;

// ⚠️ 말은 **서버가 준다** — 연계 수단·상태·연계 개발은 기준 정보에서, 「연결」 칸은
//    사다리 문구에서 고친다. 여기에 표를 굳혀 두면 고쳐도 이 창만 옛말이 남는다.
//    색과 칸 수는 화면의 것이라 여기 남긴다(칸의 차례가 곧 서열이다).
const RUNG_COLORS = ['#fca5a5', '#93c5fd', '#3b82f6', '#1e3a8a'];
const STATUS_COLORS = { active: ['#dcfce7', '#166534'], adopting: ['#dbeafe', '#1e40af'], retiring: ['#fef3c7', '#92400e'] };
const labelsOf = (rows) => Object.fromEntries((rows || []).map(r => [r.key, r.label]));

const roleOf = (seg, id) => [
  seg.from_system_id === id && '출발', seg.via_system_id === id && '매개', seg.to_system_id === id && '도착',
].filter(Boolean).join('·');

const linkIdx = (seg) => seg.pair?.assessments?.link_mode?.rung_index ?? null;

const SystemDetailModal = ({ system, segments = [], systems = [], divisionId, thread, linkRungs = [], onOpenPair, onClose }) => {
  const LINK_RUNGS = useMemo(() => (linkRungs.length ? linkRungs
    : [{ key: 'manual', label: '사람이 옮김' }, { key: 'auto_transfer', label: '자동 전달' },
       { key: 'integrated', label: '시스템 연동' }, { key: 'closed_loop', label: '폐루프' }])
    .map((r, i) => ({ ...r, color: RUNG_COLORS[i] || RUNG_COLORS[RUNG_COLORS.length - 1] })), [linkRungs]);
  const MEANS = labelsOf(thread?.link_means);
  const STATUS_LABEL = labelsOf(thread?.system_status);
  const ACTIONS = labelsOf(thread?.case_actions);
  const CASE_STATUS = labelsOf(thread?.case_status);
  const [cases, setCases] = useState(null);
  useEffect(() => {
    if (!system) return;
    maturityApi.listThreadCases(divisionId ?? 'all').then(r => setCases(r.data || [])).catch(() => setCases([]));
  }, [system, divisionId]);
  const mine = useMemo(() => segments.filter(s => [s.from_system_id, s.via_system_id, s.to_system_id].includes(system?.id)), [segments, system]);
  const stat = useMemo(() => {
    const idx = mine.map(linkIdx).filter(v => v != null);
    const counts = LINK_RUNGS.map((_, i) => idx.filter(v => v === i).length);
    return {
      segments: mine.length,
      threads: new Set(mine.map(s => s.thread_id).filter(Boolean)).size,
      divisions: new Set(mine.map(s => s.division_id).filter(Boolean)).size,
      autoPct: idx.length ? Math.round((100 * idx.filter(v => v >= 1).length) / idx.length) : null,
      counts, assessed: idx.length, unassessed: mine.length - idx.length,
    };
  }, [mine, LINK_RUNGS]);
  // 이웃 — 같은 구간 안에서 이 시스템과 맞닿은 시스템들
  const neighbors = useMemo(() => {
    const byId = Object.fromEntries(systems.map(s => [s.id, s]));
    const acc = {};
    mine.forEach(seg => {
      const chain = [seg.from_system_id, seg.via_system_id, seg.to_system_id].filter(Boolean);
      const uniq = chain.filter((v, i) => chain.indexOf(v) === i);
      uniq.forEach(id => {
        if (id === system.id || !byId[id]) return;
        const a = (acc[id] = acc[id] || { id, name: byId[id].name, kind: byId[id].kind, count: 0, auto: 0 });
        a.count += 1;
        if ((linkIdx(seg) ?? -1) >= 1) a.auto += 1;
      });
    });
    return Object.values(acc).sort((x, y) => y.count - x.count);
  }, [mine, systems, system]);
  const myCases = useMemo(() => (cases || []).filter(c => c.system_id === system?.id), [cases, system]);
  if (!system) return null;
  const statusLabel = STATUS_LABEL[system.status] || system.status;
  const [statusBg, statusFg] = STATUS_COLORS[system.status] || ['#f1f5f9', '#475569'];
  const total = stat.assessed + stat.unassessed;
  return (
    <Backdrop onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <Box role="dialog" aria-label="시스템 상세">
        <Head>
          <Ball $c={KIND_COLORS[system.kind] || KIND_COLORS.other} />
          <Title>{system.name}<small>{system.kind_label || system.kind}</small></Title>
          <IconBtn type="button" onClick={onClose} aria-label="닫기"><X size={18} /></IconBtn>
        </Head>
        <Body>
          <Side>
          <Tags>
            <Tag $bg={statusBg} $fg={statusFg}>{statusLabel}</Tag>
            <Tag>{MEANS[system.link_means] || system.link_means}</Tag>
            {system.owner_org && <Tag>주관 {system.owner_org}</Tag>}
            {(system.stage_labels || system.stages || []).map(s => <Tag key={s}>{s}</Tag>)}
            {system.note && <Muted>· {system.note}</Muted>}
          </Tags>

          <Stats>
            <Stat><b>{stat.segments}</b><span>지나는 구간</span></Stat>
            <Stat><b>{stat.threads}</b><span>스레드</span></Stat>
            <Stat><b>{stat.divisions}</b><span>사업부</span></Stat>
            <Stat><b>{stat.autoPct != null ? `${stat.autoPct}%` : '—'}</b><span>자동 전달 이상</span></Stat>
          </Stats>
          {total > 0 && (
            <Sec>
              <Bar aria-label="연결 단계 분포">
                {LINK_RUNGS.map((r, i) => <Seg key={r.key} $c={r.color} $pct={(stat.counts[i] * 100) / total} />)}
                {stat.unassessed > 0 && <Seg $c="#e2e8f0" $pct={(stat.unassessed * 100) / total} />}
              </Bar>
              <Tags>
                {LINK_RUNGS.map((r, i) => stat.counts[i] > 0 && (
                  <Muted key={r.key} as="span" style={{ fontSize: '0.75rem' }}>
                    <span style={{ color: r.color }}>■</span> {r.label} {stat.counts[i]}
                  </Muted>
                ))}
                {stat.unassessed > 0 && <Muted as="span" style={{ fontSize: '0.75rem' }}>■ 미평가 {stat.unassessed}</Muted>}
              </Tags>
            </Sec>
          )}

          <Sec>
            <h4>맞닿은 시스템<span>바로 이어지는 것</span></h4>
            {neighbors.length === 0 ? <Muted>맞닿은 시스템이 없습니다.</Muted> : (
              <Tags>
                {neighbors.map(n => (
                  <Tag key={n.id} $bg="#f8fafc">
                    <span style={{ color: KIND_COLORS[n.kind] || KIND_COLORS.other }}>●</span> {n.name} {n.count}
                    {n.auto > 0 && <span style={{ color: '#94a3b8' }}> · 자동 {n.auto}</span>}
                  </Tag>
                ))}
              </Tags>
            )}
          </Sec>
          </Side>

          <Main>
          <Panel>
            <h4>지나는 구간<span>누르면 그 구간의 평가판</span></h4>
            <Scroll>
            {mine.length === 0 ? <Muted>이 시스템을 적은 구간이 없습니다.</Muted> : (
              <Table>
                <thead><tr><th>사업부</th><th>스레드</th><th>구간</th><th>역할</th><th>조직</th><th>연결</th></tr></thead>
                <tbody>
                  {mine.map(s => {
                    const i = linkIdx(s);
                    return (
                      <tr key={s.id}>
                        <td>{s.division_name || '—'}</td>
                        <td>{s.thread_name || '—'}</td>
                        <td><RowBtn type="button" onClick={() => s.pair_id && onOpenPair && onOpenPair(s.pair_id)}>{s.name}</RowBtn></td>
                        <td><Tag>{roleOf(s, system.id)}</Tag></td>
                        <td>{s.from_org_name || '—'} → {s.to_org_name || '—'}</td>
                        <td>{i == null
                          ? <Tag>미평가</Tag>
                          : <Tag $bg={LINK_RUNGS[i]?.color} $fg={i >= 2 ? 'white' : '#1e293b'}>{LINK_RUNGS[i]?.label}</Tag>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
            </Scroll>
          </Panel>

          <Panel>
            <h4>연계 개발 기록<span>이 시스템으로 한 일</span></h4>
            <Scroll>
            {cases == null ? <Muted>불러오는 중…</Muted> : myCases.length === 0 ? <Muted>이 시스템의 기록이 없습니다.</Muted> : (
              <Table>
                <thead><tr><th>시점</th><th>무엇을</th><th>상태</th><th>대상</th><th>연결</th><th>메모</th></tr></thead>
                <tbody>
                  {myCases.map(c => (
                    <tr key={c.id}>
                      <td>{(c.month || '').slice(0, 7)}</td>
                      <td>{ACTIONS[c.action] || c.action}</td>
                      <td><Tag>{CASE_STATUS[c.status] || c.status}</Tag></td>
                      <td>{c.segment_name || c.thread_name || '—'}</td>
                      <td>{c.link_from_label && c.link_to_label ? `${c.link_from_label} → ${c.link_to_label}` : '—'}</td>
                      <td>{c.note || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            </Scroll>
          </Panel>
          </Main>
        </Body>
      </Box>
    </Backdrop>
  );
};

export default SystemDetailModal;
