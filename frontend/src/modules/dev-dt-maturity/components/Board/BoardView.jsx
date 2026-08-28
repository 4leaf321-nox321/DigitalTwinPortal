import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import maturityApi from '../../services/maturityApi';
import OverviewGrid from './OverviewGrid';
import DivisionSummary from './DivisionSummary';
import {
  colorFor, distribution, applyFilters, accuracyLabel, changesByMonth,
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
const Totals = styled.div`
  display: flex; gap: 0.75rem; flex-wrap: wrap; font-size: 0.8125rem; color: #475569;
  strong { color: #1e293b; }
`;
const Dist = styled.div`display: flex; gap: 1rem; flex-wrap: wrap;`;
const DistAxis = styled.div`min-width: 160px; font-size: 0.75rem; color: #64748b;`;
const DistBar = styled.div`display: flex; height: 10px; border-radius: 3px; overflow: hidden; background: #e2e8f0; margin-top: 0.2rem;`;
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
  padding: 0.45rem 0.6rem; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #f1f5f9; background: #fcfcfd; vertical-align: top; font-size: 0.8125rem;
`;
const SimName = styled.button`border: none; background: transparent; font-family: inherit; font-size: 0.8125rem; font-weight: 600; color: #1e293b; cursor: pointer; padding: 0; text-align: left; &:hover { color: #1d4ed8; text-decoration: underline; }`;
const PairRow = styled.tr`background: #fcfcfd;`;
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
// 상세의 묶음·표 축 — 선택한 것들의 배지 묶음. 왼쪽 띠가 서열 색, 배지는 그 색으로 채운다.
const Badges = styled.div`
  display: inline-flex; flex-wrap: wrap; gap: 0.2rem; padding: 0.15rem 0.3rem 0.15rem 0.45rem; border-radius: 0.3rem; cursor: pointer; min-width: 4.5rem;
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
  const label = idx == null ? '미평가'
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
    <Cell $dense={dense} $color={color} $dark={isDark(color)} $stale={a?.stale} title={title} onClick={onClick}>
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
const BoardView = ({ divisionId, axes, filters, onFiltersChange, onOpenPair, onPickDivision, refreshKey, review }) => {
  const [board, setBoard] = useState(null);
  const [changes, setChanges] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!divisionId) return;
    let alive = true;
    (async () => {
      try {
        if (divisionId === 'all') {
          // 전체 — 사업부마다의 판을 묶는다. 셈(문턱·재평가 필요)은 사업부별로 이미 돼 있다.
          const b = await maturityApi.getBoard('all');
          const boards = b.data.boards || [];
          const cs = await Promise.all(boards.map(x => maturityApi.getChanges(x.division_id).catch(() => ({ data: [] }))));
          if (!alive) return;
          setBoard({
            ...b.data,
            subjects: boards.flatMap(x => x.subjects),
            stale_days: boards[0]?.stale_days ?? 365,
            deny_reason: null,
          });
          setChanges(cs.flatMap(c => c.data || [])); setError(null);
          return;
        }
        const [b, c] = await Promise.all([
          maturityApi.getBoard(divisionId),
          maturityApi.getChanges(divisionId),
        ]);
        if (!alive) return;
        setBoard(b.data); setChanges(c.data || []); setError(null);
      } catch (e) {
        if (alive) setError(e.message);
      }
    })();
    return () => { alive = false; };
  }, [divisionId, refreshKey]);

  if (error) return <Notice><AlertTriangle size={14} /> <span>{error}</span></Notice>;
  if (!board) return <Empty>불러오는 중…</Empty>;
  return (
    <BoardBody board={board} changes={changes} axes={axes} filters={filters} onPickDivision={onPickDivision} review={review}
               onFiltersChange={onFiltersChange} onOpenPair={onOpenPair} />
  );
};

export const BoardBody = ({ board, changes, axes, filters, onFiltersChange, onOpenPair, onPickDivision, review }) => {
  const [mode, setMode] = useState(board?.boards ? 'scan' : 'read');       // scan | read | progress — 전체는 요약부터
  const subjects = useMemo(() => applyFilters(board?.subjects || [], filters), [board, filters]);
  const dist = useMemo(() => distribution(subjects, axes), [subjects, axes]);
  const families = useMemo(() => {
    const s = new Set();
    (board?.subjects || []).forEach(x => (x.product_families || []).forEach(f => s.add(f)));
    return [...s].sort();
  }, [board]);
  const byMonth = useMemo(() => changesByMonth(changes), [changes]);

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
      </Totals>

      <Dist>
        {axes.map(axis => {
          const d = dist[axis.key];
          const total = d.counts.reduce((a, b) => a + b, 0) + d.unassessed;
          return (
            <DistAxis key={axis.key} title={axis.rungs.map((r, i) => `${r.label} ${d.counts[i]}`).join(' · ') + ` · 미평가 ${d.unassessed}`}>
              {axis.label} — 미평가 {d.unassessed}
              <DistBar>
                {axis.rungs.map((r, i) => (
                  <Seg key={r.key} $color={colorFor(i, axis.rungs.length)} $pct={total ? (d.counts[i] * 100) / total : 0} />
                ))}
              </DistBar>
            </DistAxis>
          );
        })}
      </Dist>

      {mode === 'scan' && board.boards ? (
        // 전체 「요약」 — 사업부 × 축. 한 화면에 사업부 여섯. 행을 누르면 그 사업부로.
        <OverviewGrid boards={board.boards} axes={axes} review={review} onPickDivision={onPickDivision} />
      ) : mode === 'scan' ? (
        // 사업부 하나의 「요약」 — 축마다 판 하나, 화면 가득. 앞선 연계·취약 연계가 근거로 붙는다.
        <DivisionSummary board={board} subjects={subjects} axes={axes} onOpenPair={onOpenPair} />
      ) : mode !== 'progress' ? (
        // 「상세」 — 늘 펼친 표. 한 줄에 시뮬레이션 하나, 시험 항목은 셀을 합친다(목록 탭과 같은 문법, 2026-08-28).
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th style={{ width: '18%' }}>시험 항목</Th>
                <Th style={{ width: '14%' }}>시뮬레이션</Th>
                <Th style={{ width: '9%' }}>담당 그룹</Th>
                {axes.map(a => <Th key={a.key}>{a.label}</Th>)}
                <Th>미평가</Th>
              </tr>
            </thead>
            <tbody>
              {subjects.map(s => {
                const span = Math.max(1, s.pairs.length);
                const acc = axes.find(a => a.key === 'accuracy');
                const cell = (
                  <SubjectTd rowSpan={span}>
                    {s.division_name && <DivTag>{s.division_name}</DivTag>}
                    <Name>{s.name}</Name>
                    <div><Sub>연계 {s.pairs.length}</Sub>{acc && s.summary.accuracy != null && <Sub> · 항목 정확도 {accuracyLabel(s.summary)}</Sub>}</div>
                  </SubjectTd>
                );
                if (s.pairs.length === 0) {
                  return <tr key={s.id}>{cell}<Td colSpan={axes.length + 3}><Muted>아직 이은 시뮬레이션이 없습니다.</Muted></Td></tr>;
                }
                return s.pairs.map((p, i) => (
                  <PairRow key={p.id}>
                    {i === 0 && cell}
                    <Td>
                      <SimName onClick={() => onOpenPair(p.id)} title="연계 상세 열기">{p.agent?.name}</SimName>
                      {(p.agent?.tools || []).length > 0 && <div><Sub>{p.agent.tools.join(', ')}</Sub></div>}
                    </Td>
                    <Td>{p.agent?.department_name || <Muted>—</Muted>}</Td>
                    {axes.map(a => (
                      <Td key={a.key}>
                        <AxisCell a={p.assessments[a.key]} axis={a} dense={false} onClick={() => onOpenPair(p.id)} />
                      </Td>
                    ))}
                    <Td>{p.unassessed.length ? <Muted>{p.unassessed.length}</Muted> : ''}</Td>
                  </PairRow>
                ));
              })}
            </tbody>
          </Table>
        </TableWrap>
      ) : (
        <ProgressView subjects={subjects} axes={axes} byMonth={byMonth} onOpenPair={onOpenPair} />
      )}
    </Wrap>
  );
};

// ── 진전 — 달마다 「어느 축이 올라갔나」 점 ─────────────────────────────────
const months = () => {
  const out = [];
  const d = new Date();
  for (let i = 11; i >= 0; i -= 1) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
};
const Dot = styled.button`
  width: 0.9rem; height: 0.9rem; border-radius: 50%; border: none; cursor: pointer; margin: 0 1px;
  background: ${p => p.$color};
`;

const ProgressView = ({ subjects, axes, byMonth, onOpenPair }) => {
  const cols = months();
  const rows = subjects.flatMap(s => s.pairs.map(p => ({ s, p })));
  const any = rows.some(({ p }) => byMonth[p.id]);
  if (!any) return <Empty>지난 12개월에 바뀐 칸이 없습니다. 연계 상세에서 칸을 옮기면 여기에 찍힙니다.</Empty>;
  return (
    <TableWrap>
      <Table>
        <thead>
          <tr><Th>시험 × 시뮬레이션</Th>{cols.map(m => <Th key={m}>{m.slice(2)}</Th>)}</tr>
        </thead>
        <tbody>
          {rows.filter(({ p }) => byMonth[p.id]).map(({ s, p }) => (
            <tr key={p.id}>
              <Td>{s.division_name && <DivTag>{s.division_name}</DivTag>}<Name>{s.name}</Name> <Sub>× {p.agent?.name}</Sub></Td>
              {cols.map(m => (
                <Td key={m}>
                  {(byMonth[p.id]?.[m] || []).map(c => {
                    const axis = axes.find(a => a.key === c.axis);
                    const idx = axis ? axis.rungs.findIndex(r => r.key === c.after) : -1;
                    const label = axis?.rungs[idx]?.label || c.after;
                    return (
                      <Dot key={c.id} $color={colorFor(idx < 0 ? null : idx, axis?.rungs.length || 1)}
                           title={`${axis?.label || c.axis}: ${label} (${(c.created_at || '').slice(0, 10)}, ${c.actor_name || ''})`}
                           onClick={() => onOpenPair(p.id)} />
                    );
                  })}
                </Td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
    </TableWrap>
  );
};

export default BoardView;
