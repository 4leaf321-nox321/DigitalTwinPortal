import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import maturityApi from '../../services/maturityApi';
import OverviewGrid from './OverviewGrid';
import DivisionSummary from './DivisionSummary';
import ChartsView from './ChartsView';
import ThreadDivisionPanels from '../Thread/ThreadSummary';
import TileBoard from './TileBoard';
import ThreadSystemGraph from '../Thread/ThreadSystemGraph';
import {
  colorFor, distribution, applyFilters, accuracyLabel,
} from '../../utils/board';

// 사업부 판 — 모드 셋: 요약(히트맵) · 상세(접힌 표) · 변화(타임라인). (PLAN 7-2)
//
// ⚠️ 확대·축소는 없다. 표가 커지지 않게 하는 것(접힘·필터)이 답이다.
// ⚠️ 축은 순서형이라 평균이 없다 — 분포와 최고 칸만.

// 판은 세로로 화면을 채우고, 스크롤은 **아래 표에만** 걸린다 — 모드 줄·합계·분포는 고정(2026-08-28).
const Wrap = styled.div`display: flex; flex-direction: column; gap: 0.875rem; flex: 1; min-height: 0;`;
const Bar = styled.div`display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;`;
const ModeBtn = styled.button`
  padding: 0.35rem 0.75rem; border: 1px solid ${p => (p.$on ? '#1d4ed8' : '#cbd5e1')}; border-radius: 0.375rem;
  background: ${p => (p.$on ? '#eff6ff' : 'white')}; color: ${p => (p.$on ? '#1d4ed8' : '#475569')};
  font-size: 0.8125rem; font-weight: 600; font-family: inherit; cursor: pointer;
`;
const Chip = styled.button`
  padding: 0.25rem 0.6rem; border: 1px solid ${p => (p.$on ? '#b45309' : '#e2e8f0')}; border-radius: 999px;
  background: ${p => (p.$on ? '#fffbeb' : 'white')}; color: ${p => (p.$on ? '#92400e' : '#64748b')};
  font-size: 0.75rem; font-family: inherit; cursor: pointer;
`;
const Select = styled.select`
  padding: 0.3rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; font-family: inherit; font-size: 0.8125rem;
`;
// 합계와 축 분포를 한 줄로 — 표가 세로로 밀려 스크롤이 생기지 않게(2026-08-29)
const Totals = styled.div`
  display: flex; gap: 0.9rem; flex-wrap: nowrap; align-items: center; font-size: 0.8125rem; color: #475569;
  overflow-x: auto; min-width: 0; white-space: nowrap;
  strong { color: #1e293b; }
`;
const Sep = styled.span`width: 1px; align-self: stretch; background: #e2e8f0; flex: none;`;
const DistAxis = styled.span`display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.75rem; color: #64748b; flex: none;`;
const DistBar = styled.span`display: inline-flex; width: 72px; height: 8px; border-radius: 3px; overflow: hidden; background: #e2e8f0;`;
const Seg = styled.div`background: ${p => p.$color}; width: ${p => p.$pct}%;`;
const Notice = styled.div`
  display: flex; gap: 0.4rem; align-items: flex-start; padding: 0.6rem 0.75rem; border-radius: 0.5rem;
  background: #fffbeb; border: 1px solid #fde68a; color: #92400e; font-size: 0.8125rem; line-height: 1.5;
`;
const Empty = styled.div`
  padding: 1rem 1.125rem; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 0.5rem;
  color: #64748b; font-size: 0.8125rem; line-height: 1.6;
`;

// ── 표 (읽기 · 훑기 공용 뼈대) ──────────────────────────────────────────────
const TableWrap = styled.div`overflow: auto; border: 1px solid #e2e8f0; border-radius: 0.5rem; background: white; flex: 1; min-height: 0;`;
const Table = styled.table`border-collapse: separate; border-spacing: 0; width: 100%; font-size: 0.8125rem;`;
const Th = styled.th`
  position: sticky; top: 0; z-index: 2; background: #f8fafc; padding: 0.45rem 0.6rem; text-align: left;
  font-size: 0.6875rem; font-weight: 700; color: #64748b; border-bottom: 1px solid #e2e8f0; white-space: nowrap;
  &:first-child { left: 0; z-index: 3; }
`;
const Td = styled.td`
  padding: ${p => (p.$dense ? '0.2rem 0.6rem' : '0.45rem 0.6rem')}; border-bottom: 1px solid #f1f5f9;
  color: #1e293b; vertical-align: middle; white-space: nowrap;
  &:first-child { position: sticky; left: 0; background: white; z-index: 1; }
`;
const SubjectTd = styled.td`
  padding: 0.45rem 0.6rem; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; background: transparent; vertical-align: top; font-size: 0.8125rem; overflow-wrap: anywhere;
`;
const SimName = styled.button`border: none; background: transparent; font-family: inherit; font-size: 0.8125rem; font-weight: 600; color: #1e293b; cursor: pointer; padding: 0; text-align: left; &:hover { color: #1d4ed8; text-decoration: underline; }`;
// 시험 항목 묶음마다 얼룩말 + 묶음 경계선 — 목록 탭과 같은 문법(2026-08-28)
const PairRow = styled.tr`
  background: ${p => (p.$band ? '#f8fafc' : 'white')};
  ${p => (p.$first ? '& > td { border-top: 2px solid #cbd5e1; }' : '')}
`;
const Name = styled.span`font-weight: 600;`;
const DivTag = styled.span`
  display: inline-block; font-size: 0.6875rem; font-weight: 700; color: #1e40af; background: #eff6ff;
  border-radius: 0.25rem; padding: 0.05rem 0.35rem; margin-right: 0.35rem;
`;
const Sub = styled.span`color: #94a3b8; font-size: 0.75rem;`;
const Cell = styled.button`
  display: inline-block; min-width: ${p => (p.$dense ? '1.1rem' : '4.5rem')}; height: ${p => (p.$dense ? '1.1rem' : 'auto')};
  padding: ${p => (p.$dense ? 0 : '0.15rem 0.45rem')}; border-radius: 0.3rem; font-family: inherit; font-size: 0.75rem;
  border: 2px solid ${p => (p.$stale ? '#f59e0b' : 'transparent')}; background: ${p => p.$color};
  color: ${p => (p.$dark ? 'white' : '#1e293b')}; cursor: pointer; text-align: center;
`;
const Muted = styled.span`color: #94a3b8;`;
const ScrollCol = styled.div`flex: 1; min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: 0.75rem; & > :first-child { flex: 0 0 auto; min-height: 34rem; }`;
const InformalTag = styled.span`display: inline-block; padding: 0 0.4rem; border-radius: 999px; font-size: 0.6875rem; font-weight: 600; background: #fef3c7; color: #92400e;`;
// 상세의 묶음·표 축 — 선택한 것들의 배지 묶음. 왼쪽 띠가 서열 색, 배지는 그 색으로 채운다.
const Badges = styled.div`
  display: inline-flex; flex-wrap: nowrap; gap: 0.2rem; padding: 0.15rem 0.3rem 0.15rem 0.45rem; border-radius: 0.3rem; cursor: pointer; min-width: 4.5rem;   /* 한 줄 표시 — 좁으면 표가 가로로 흐른다(2026-08-29) */
  border-left: 4px solid ${p => p.$color}; border-top: 2px solid ${p => (p.$stale ? '#f59e0b' : 'transparent')}; border-bottom: 2px solid ${p => (p.$stale ? '#f59e0b' : 'transparent')};
  &:hover { background: #f8fafc; }
`;
const Badge = styled.span`
  display: inline-block; padding: 0.05rem 0.45rem; border-radius: 999px; font-size: 0.6875rem; font-weight: 600; white-space: nowrap;
  background: ${p => p.$color}; color: ${p => (p.$dark ? 'white' : '#1e293b')};
`;
const Ghost = styled.span`display: inline-block; padding: 0.05rem 0.45rem; border-radius: 999px; font-size: 0.6875rem; white-space: nowrap; color: #cbd5e1; border: 1px dashed #e2e8f0;`;

const isDark = (c) => ['#3b82f6', '#1d4ed8', '#1e3a8a'].includes(c);

const AxisCell = ({ a, axis, dense, onClick }) => {
  const idx = a?.rung_index ?? null;
  const color = colorFor(idx, axis.rungs.length);
  // 묶음 축은 「켠 수/전체」 — 서열이 칸 이름이 아니라 개수다. 어느 것을 켰는지는 대면 보인다.
  const total = axis.rungs.length - 1;
  const label = a?.unknown ? '확인 필요' : idx == null ? '미평가'
    : axis.kind === 'set' ? (idx === 0 ? axis.rungs[0].label : `${idx}/${total}`)
    : axis.rungs[idx]?.label;
  const flagsText = axis.kind === 'set' && a?.flags?.length
    ? axis.rungs.filter(r => a.flags.includes(r.key)).map(r => r.label).join(' · ')
    : axis.kind === 'matrix' && a?.summary
      ? `${label} — 시험 ${a.summary.test}/${a.summary.total} · 시장 ${a.summary.market}/${a.summary.total}` : null;
  const title = `${axis.label}: ${flagsText || label}${a?.stale ? ' · 재평가 필요' : ''}${a?.note ? ` — ${a.note}` : ''}`;
  // 「상세」에서 묶음·표 축은 선택한 것들을 **배지로 늘어놓는다** — 「3/5」로는 무엇을 켰는지 안 보인다(2026-08-28).
  if (!dense && idx != null && (axis.kind === 'set' || axis.kind === 'matrix')) {
    const defs = axis.kind === 'matrix' ? (axis.base || []) : axis.rungs.slice(1);
    const on = defs.filter(r => (a.flags || []).includes(r.key));
    const extra = axis.kind === 'matrix' && a.summary
      ? [{ key: '_t', label: `시험 ${a.summary.test}/${a.summary.total}`, on: a.summary.test > 0 }, { key: '_m', label: `시장 ${a.summary.market}/${a.summary.total}`, on: a.summary.market > 0 }]
      : [];
    return (
      <Badges $color={color} $stale={a?.stale} title={title} onClick={onClick} role="button" tabIndex={0}>
        {on.length === 0 && extra.every(e => !e.on) && <Muted>{axis.rungs[0].label}</Muted>}
        {on.map(r => <Badge key={r.key} $color={color} $dark={isDark(color)}>{r.short || r.label}</Badge>)}
        {extra.filter(e => e.on).map(e => <Badge key={e.key} $color={color} $dark={isDark(color)}>{e.label}</Badge>)}
      </Badges>
    );
  }
  if (!dense && idx != null && axis.kind === 'rung') {
    // 택1 축은 선택지 전부를 늘어놓고 고른 칸만 채운다 — 어디쯤인지가 보인다(2026-08-28)
    return (
      <Badges $color={color} $stale={a?.stale} title={title} onClick={onClick} role="button" tabIndex={0}>
        {axis.rungs.map((r, i) => (i === idx
          ? <Badge key={r.key} $color={color} $dark={isDark(color)}>{r.label}</Badge>
          : <Ghost key={r.key}>{r.label}</Ghost>))}
      </Badges>
    );
  }
  return (
    <Cell $dense={dense} $color={a?.unknown ? '#fef3c7' : color} $dark={isDark(color) && !a?.unknown} $stale={a?.stale} title={title} onClick={onClick}>
      {dense ? '' : (axis.kind === 'value' && a?.value != null ? `${a.value}%` : label)}
    </Cell>
  );
};

/** 시험 행의 요약 칸 — 축별 최고 칸(평균이 아니다). */
const BestCell = ({ idx, axis, dense }) => {
  const color = colorFor(idx, axis.rungs.length);
  const label = idx == null ? null
    : axis.kind === 'set' ? (idx === 0 ? axis.rungs[0].label : `${idx}/${axis.rungs.length - 1}`)
    : axis.rungs[idx]?.label;
  return (
    <Cell as="span" $dense={dense} $color={color} $dark={isDark(color)}
          title={`${axis.label} 최고: ${label ?? '미평가'}`}>
      {dense ? '' : (label ?? '—')}
    </Cell>
  );
};

// 읽기와 그리기를 가른다 — 그리기(BoardBody)는 props 만 받아 시험·SSR 로 그릴 수 있다.
const BoardView = ({ divisionId, axes, filters, onFiltersChange, onOpenPair, onPickDivision, refreshKey, review, sector = 'simulation', sectorDef }) => {
  
  const [board, setBoard] = useState(null);
  const [changes, setChanges] = useState([]);
  const [changeSets, setChangeSets] = useState({});   // 전체일 때 사업부별 이력 — 그래프가 사업부마다 선을 그린다
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!divisionId) return;
    let alive = true;
    (async () => {
      try {
        if (divisionId === 'all') {
          // 전체 — 사업부마다의 판을 묶는다. 셈(문턱·재평가 필요)은 사업부별로 이미 돼 있다.
          const b = await maturityApi.getBoard('all', sector);
          const boards = b.data.boards || [];
          const cs = await Promise.all(boards.map(x => maturityApi.getChanges(x.division_id, sector, 1825).catch(() => ({ data: [] }))));
          if (!alive) return;
          setBoard({
            ...b.data,
            subjects: boards.flatMap(x => x.subjects),
            stale_days: boards[0]?.stale_days ?? 365,
            deny_reason: null,
          });
          setChanges(cs.flatMap(c => c.data || []));
          setChangeSets(Object.fromEntries(boards.map((x, i) => [x.division_id, cs[i].data || []])));
          setError(null);
          return;
        }
        const [b, c] = await Promise.all([
          maturityApi.getBoard(divisionId, sector),
          maturityApi.getChanges(divisionId, sector, 1825),
        ]);
        if (!alive) return;
        setBoard(b.data); setChanges(c.data || []); setChangeSets({}); setError(null);
      } catch (e) {
        if (alive) setError(e.message);
      }
    })();
    return () => { alive = false; };
  }, [divisionId, refreshKey, sector]);

  if (error) return <Notice><AlertTriangle size={14} /> <span>{error}</span></Notice>;
  if (!board) return <Empty>불러오는 중…</Empty>;
  return (
    <BoardBody board={board} changes={changes} changeSets={changeSets} axes={axes} filters={filters} onPickDivision={onPickDivision} review={review} sector={sector} sectorDef={sectorDef}
               onFiltersChange={onFiltersChange} onOpenPair={onOpenPair} />
  );
};

export const BoardBody = ({ board, changes, changeSets = {}, axes, filters, onFiltersChange, onOpenPair, onPickDivision, review, sector = 'simulation', sectorDef }) => {
  const isThread = sector === 'digital_thread';
  const [mode, setMode] = useState(board?.boards ? 'scan' : 'read');       // scan | read | progress — 전체는 요약부터
  useEffect(() => { if (!isThread && mode === 'sysgraph') setMode('scan'); }, [isThread, mode]);   // 시스템 연결도는 스레드 부문에만
  const subjects = useMemo(() => applyFilters(board?.subjects || [], filters), [board, filters]);
  const dist = useMemo(() => distribution(subjects, axes), [subjects, axes]);
  const families = useMemo(() => {
    const s = new Set();
    (board?.subjects || []).forEach(x => (x.product_families || []).forEach(f => s.add(f)));
    return [...s].sort();
  }, [board]);

  if (!board.subjects.length) {
    return (
      <Empty>
        아직 시험 항목이 없습니다. 헤더의 <strong>가져오기</strong>로 로드맵의 틀을
        내려받아 시뮬레이션 단위로 쪼개 올리거나, <strong>시험 항목 관리</strong>에서 직접 적으세요.
      </Empty>
    );
  }

  const set = (patch) => onFiltersChange({ ...filters, ...patch });

  return (
    <Wrap>
      <Bar>
        <ModeBtn $on={mode === 'scan'} onClick={() => setMode('scan')} title="축마다 대표 수치와 근거(앞선·취약 연계)">요약</ModeBtn>
        <ModeBtn $on={mode === 'read'} onClick={() => setMode('read')} title="한 줄에 시뮬레이션 하나 — 켠 것들을 배지로">상세</ModeBtn>
        <ModeBtn $on={mode === 'progress'} onClick={() => setMode('progress')} title="올해 어느 칸이 언제 올라갔나">변화</ModeBtn>
        <ModeBtn $on={mode === 'tiles'} onClick={() => setMode('tiles')} title={isThread ? '구간 하나가 네모 하나 — 스레드로 묶어 밭처럼 훑는다' : '연계 하나가 네모 하나 — 고른 축의 색으로 밭처럼 훑는다'}>모판</ModeBtn>
        {isThread && <ModeBtn $on={mode === 'sysgraph'} onClick={() => setMode('sysgraph')} title="시스템이 노드, 구간이 간선 — 간선 색은 스레드">시스템 연결도</ModeBtn>}
        <span style={{ width: '0.5rem' }} />
        <Chip $on={filters.unassessedOnly} onClick={() => set({ unassessedOnly: !filters.unassessedOnly })}>미평가만</Chip>
        <Chip $on={filters.staleOnly} onClick={() => set({ staleOnly: !filters.staleOnly })}>재평가 필요만</Chip>
        <Select value={filters.family} onChange={e => set({ family: e.target.value })}>
          <option value="">제품군 전체</option>
          {families.map(f => <option key={f} value={f}>{f}</option>)}
        </Select>
        <Select value={filters.modelKind} onChange={e => set({ modelKind: e.target.value })}>
          <option value="">모델 종류 전체</option>
          <option value="physics">물리 기반</option>
          <option value="data">데이터 기반</option>
          <option value="hybrid">하이브리드</option>
        </Select>
        <Select value={filters.axis} onChange={e => set({ axis: e.target.value, minRung: e.target.value ? (filters.minRung ?? 1) : null })}>
          <option value="">축 조건 없음</option>
          {axes.map(a => <option key={a.key} value={a.key}>{a.label} 이상…</option>)}
        </Select>
        {filters.axis && (
          <Select value={filters.minRung ?? 0} onChange={e => set({ minRung: Number(e.target.value) })}>
            {(axes.find(a => a.key === filters.axis)?.rungs || []).map((r, i) => (
              <option key={r.key} value={i}>{r.label} 이상</option>
            ))}
          </Select>
        )}
      </Bar>

      <Totals>
        <span>시험 <strong>{subjects.length}</strong>/{board.totals.subjects}</span>
        <span>연계 <strong>{subjects.reduce((n, s) => n + s.pairs.length, 0)}</strong>/{board.totals.pairs}</span>
        <span>미평가 항목 <strong>{board.totals.unassessed}</strong></span>
        <span>재평가 필요 <strong>{board.totals.stale}</strong> ({board.stale_days}일 기준)</span>
        {board.deny_reason && <Muted>· {board.deny_reason}</Muted>}
        <Sep />
        {axes.map(axis => {
          const d = dist[axis.key];
          const total = d.counts.reduce((a, b) => a + b, 0) + d.unassessed;
          return (
            <DistAxis key={axis.key} title={axis.rungs.map((r, i) => `${r.label} ${d.counts[i]}`).join(' · ') + ` · 미평가 ${d.unassessed}`}>
              {axis.label} 미평가 {d.unassessed}
              <DistBar>
                {axis.rungs.map((r, i) => (
                  <Seg key={r.key} $color={colorFor(i, axis.rungs.length)} $pct={total ? (d.counts[i] * 100) / total : 0} />
                ))}
              </DistBar>
            </DistAxis>
          );
        })}
      </Totals>

      {mode === 'sysgraph' && isThread ? (
        // 「시스템 연결도」 — 시스템이 노드, 구간이 간선, 간선 색 = 스레드(2026-08-29)
        <ThreadSystemGraph divisionId={board.boards ? 'all' : board.division_id} onOpenPair={onOpenPair} />
      ) : mode === 'tiles' ? (
        // 「모판」 — 연계가 네모, 고른 축이 색. 담당 부서로 묶는다.
        <TileBoard subjects={subjects} axes={axes} onOpenPair={onOpenPair} allMode={!!board.boards} sector={sector} changes={changes} />
      ) : mode === 'scan' && board.boards ? (
        // 전체 「요약」 — 사업부 × 축. 한 화면에 사업부 여섯. 행을 누르면 그 사업부로.
        <OverviewGrid boards={board.boards} axes={axes} review={review} onPickDivision={onPickDivision} sector={sector} changeSets={changeSets} />
      ) : mode === 'scan' ? (
        // 사업부 하나의 「요약」 — 축마다 판 하나, 화면 가득. 앞선 연계·취약 연계가 근거로 붙는다.
        isThread ? (
          // 스레드 부문 — 축 판 아래에 스레드 줄 그림 · 조직 연계표 · 시스템 허브도
          <ScrollCol>
            <DivisionSummary board={board} subjects={subjects} axes={axes} onOpenPair={onOpenPair} />
            <ThreadDivisionPanels divisionId={board.division_id} subjects={subjects} axes={axes} onOpenPair={onOpenPair} />
          </ScrollCol>
        ) : (
          <DivisionSummary board={board} subjects={subjects} axes={axes} onOpenPair={onOpenPair} />
        )
      ) : mode !== 'progress' ? (
        // 「상세」 — 늘 펼친 표. 한 줄에 시뮬레이션 하나, 시험 항목은 셀을 합친다(목록 탭과 같은 문법, 2026-08-28).
        <TableWrap>
          <Table>
            <thead>
              <tr>
                {isThread && <Th style={{ width: '8%' }}>스레드</Th>}
                <Th style={{ width: '12%' }}>{isThread ? '구간' : (sectorDef?.subject_label || '시험 항목')}</Th>
                <Th style={{ width: isThread ? '20%' : '12%' }}>{isThread ? '출발 → 매개 → 도착' : (sectorDef?.agent_label || '시뮬레이션')}</Th>
                {!isThread && <Th style={{ width: '8%' }}>담당 그룹</Th>}
                {axes.map(a => <Th key={a.key}>{a.label}</Th>)}
                <Th>미평가</Th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                // 스레드 부문 — 연이은 같은 스레드를 한 칸으로(셀 합치기). 얼룩말·경계선도 스레드 묶음 단위(2026-08-29).
                const threadKey = (x) => (x.segment?.thread_id ?? `x${x.id}`);
                const groupSpan = {};
                const groupIdx = {};
                if (isThread) {
                  let g = -1;
                  let headId = null;
                  subjects.forEach((x, i) => {
                    if (i === 0 || threadKey(x) !== threadKey(subjects[i - 1])) { g += 1; headId = x.id; groupSpan[headId] = 0; }
                    groupSpan[headId] += 1;
                    groupIdx[x.id] = g;
                  });
                }
                return subjects.map((s, gi) => {
                const span = Math.max(1, s.pairs.length);
                const band = isThread ? groupIdx[s.id] % 2 === 1 : gi % 2 === 1;
                const first = isThread ? groupSpan[s.id] != null : true;
                const acc = axes.find(a => a.key === 'accuracy');
                const threadCell = isThread && groupSpan[s.id] != null ? (
                  <SubjectTd rowSpan={groupSpan[s.id]} style={{ fontWeight: 700 }}>
                    {s.segment?.thread_name || <Muted>스레드 없음</Muted>}
                  </SubjectTd>
                ) : null;
                const cell = (
                  <SubjectTd rowSpan={span}>
                    {s.division_name && <DivTag>{s.division_name}</DivTag>}
                    <Name>{s.name}</Name>
                    {isThread && (s.segment?.data_kind_labels || []).length > 0 && <div><Sub>{s.segment.data_kind_labels.join(' · ')}</Sub></div>}
                    {!isThread && <div><Sub>연계 {s.pairs.length}</Sub>{acc && s.summary.accuracy != null && <Sub> · 항목 정확도 {accuracyLabel(s.summary)}</Sub>}</div>}
                  </SubjectTd>
                );
                if (s.pairs.length === 0) {
                  return <PairRow key={s.id} $band={band} $first={first}>{threadCell}{cell}<Td colSpan={axes.length + (isThread ? 2 : 3)}><Muted>{isThread ? '연계가 없습니다.' : '아직 이은 시뮬레이션이 없습니다.'}</Muted></Td></PairRow>;
                }
                return s.pairs.map((p, i) => (
                  <PairRow key={p.id} $band={band} $first={i === 0 && first}>
                    {i === 0 && threadCell}
                    {i === 0 && cell}
                    {isThread ? (
                      <Td>
                        <SimName onClick={() => onOpenPair(p.id)} title="구간 상세 열기">
                          {s.segment ? <>{s.segment.from_org_name || '—'} <Sub>{s.segment.from_system_name}</Sub> → {s.segment.via_informal ? <InformalTag>{s.segment.via_system_name}</InformalTag> : <Sub>{s.segment.via_system_name || '(매개 없음)'}</Sub>} → {s.segment.to_org_name || '—'} <Sub>{s.segment.to_system_name}</Sub></> : '열기'}
                        </SimName>
                      </Td>
                    ) : (
                      <>
                        <Td>
                          <SimName onClick={() => onOpenPair(p.id)} title="연계 상세 열기">{p.agent?.name}</SimName>
                          {(p.agent?.tools || []).length > 0 && <div><Sub>{p.agent.tools.join(', ')}</Sub></div>}
                        </Td>
                        <Td>{p.agent?.department_name || <Muted>—</Muted>}</Td>
                      </>
                    )}
                    {axes.map(a => (
                      <Td key={a.key}>
                        <AxisCell a={p.assessments[a.key]} axis={a} dense={false} onClick={() => onOpenPair(p.id)} />
                      </Td>
                    ))}
                    <Td>{p.unassessed.length ? <Muted>{p.unassessed.length}</Muted> : ''}</Td>
                  </PairRow>
                ));
                });
              })()}
            </tbody>
          </Table>
        </TableWrap>
      ) : (
        // 「변화」 — 축마다 선 그래프. 「전체」면 사업부마다 선 하나.
        <ChartsView axes={axes} review={review} series={board.boards
          ? board.boards.map(b => ({ name: b.division_name, divisionId: b.division_id, subjects: applyFilters(b.subjects || [], filters), changes: changeSets[b.division_id] || [] }))
          : [{ name: '이 사업부', divisionId: board.division_id, subjects, changes }]} />
      )}
    </Wrap>
  );
};

export default BoardView;
