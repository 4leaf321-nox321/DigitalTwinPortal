import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { LineChart, Line, BarChart, Bar as RBar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import maturityApi from '../../services/maturityApi';
import { monthlySeries, monthKeys, monthRange, pairSeries, headlineIndex, colorFor } from '../../utils/board';

// 「변화」 — 축마다 선 그래프 하나(2026-08-28). 표는 없다.
// 이력을 달마다 되감아 「그 달 말의 상태」를 복원하고 요약과 같은 셈으로 대표 수치를 낸다 —
// 그래서 마지막 점이 요약의 지금 숫자와 같다. 「전체」면 사업부마다 선 하나.

const Wrap = styled.div`display: flex; flex-direction: column; gap: 0.6rem; flex: 1; min-height: 0;`;
const Bar = styled.div`display: flex; gap: 0.4rem; align-items: center; font-size: 0.8125rem; color: #64748b;`;
const Chip = styled.button`
  padding: 0.25rem 0.65rem; border: 1px solid ${p => (p.$on ? '#1d4ed8' : '#e2e8f0')}; border-radius: 999px; font-family: inherit; font-size: 0.8125rem; cursor: pointer;
  background: ${p => (p.$on ? '#1d4ed8' : 'white')}; color: ${p => (p.$on ? 'white' : '#475569')};
`;
// 6:4 — 왼쪽에 여섯 판(2 × 3), 오른쪽에 「상세」(연계마다 선). 겹치지 않는다(2026-08-28).
const Body = styled.div`display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; flex: 1; min-height: 0;`;   // 5:5
const Grid = styled.div`
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: minmax(0, 1fr); gap: 0.6rem; min-height: 0; overflow: auto;
`;
const Side = styled.section`
  display: flex; flex-direction: column; border: 1px solid #bfdbfe; border-radius: 0.6rem; background: #f8fbff; padding: 0.7rem 0.8rem 0.4rem; min-height: 0;
  h4 { margin: 0 0 0.3rem; font-size: 0.9375rem; color: #1e293b; display: flex; align-items: center; gap: 0.4rem; } h4 span { font-size: 0.75rem; color: #94a3b8; font-weight: 400; }
`;
const Panel = styled.section`
  display: flex; flex-direction: column; border: 1px solid ${p => (p.$on ? '#1d4ed8' : '#e2e8f0')}; border-radius: 0.6rem; background: white; padding: 0.6rem 0.7rem 0.3rem; min-height: 11rem;
  h4 { margin: 0; font-size: 0.875rem; color: #1e293b; display: flex; align-items: center; gap: 0.4rem; } h4 span { font-size: 0.6875rem; color: #94a3b8; font-weight: 400; }
`;
const Detail = styled.button`
  margin-left: auto; padding: 0.15rem 0.55rem; border: 1px solid ${p => (p.$on ? '#1d4ed8' : '#cbd5e1')}; border-radius: 999px; font-family: inherit; font-size: 0.6875rem; cursor: pointer;
  background: ${p => (p.$on ? '#1d4ed8' : 'white')}; color: ${p => (p.$on ? 'white' : '#475569')};
`;
// 상세 = 그래프 + 오른쪽 끝의 세로 범례(연계 목록). 범례는 높이를 다 쓰고 안에서 스크롤한다(2026-08-28).
const Split = styled.div`display: grid; grid-template-columns: minmax(0, 1fr) 15rem; gap: 0.6rem; flex: 1; min-height: 0;`;
const Picker = styled.div`
  display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.75rem; overflow: auto; min-height: 0; height: 100%; border-left: 1px solid #e2e8f0; padding-left: 0.6rem;
  input[type=text] { padding: 0.25rem 0.4rem; border: 1px solid #cbd5e1; border-radius: 0.3rem; font-family: inherit; font-size: 0.75rem; margin-bottom: 0.2rem; }
  label { display: flex; align-items: center; gap: 0.35rem; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  i { display: inline-block; width: 0.7rem; height: 0.2rem; border-radius: 2px; flex-shrink: 0; }
`;
const PickBar = styled.div`display: flex; gap: 0.3rem; flex-wrap: wrap; font-size: 0.6875rem; color: #64748b; position: sticky; top: 0; background: #f8fbff; padding-bottom: 0.2rem; button { border: none; background: transparent; color: #1d4ed8; cursor: pointer; font-family: inherit; font-size: 0.6875rem; padding: 0; }`;
const Now = styled.div`font-size: 1.35rem; font-weight: 700; color: #1e293b; line-height: 1.1; margin: 0.2rem 0 0.3rem; small { font-size: 0.75rem; color: #64748b; font-weight: 500; margin-left: 0.3rem; }`;
const ChartBox = styled.div`flex: 1; min-height: 7rem;`;
// 칸 축의 상세 — 가로가 달, 세로가 연계, 칸 색이 그 달의 단계(2026-08-30).
// 값이 정수 몇 개뿐인 축(자동화·적용 범위…)은 선으로 그리면 같은 높이에 수십 줄이 겹쳐
// 한 줄처럼 보인다. 히트맵은 **겹칠 수가 없고**, 언제 올라갔는지가 색 경계로 드러난다.
const HeatWrap = styled.div`flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 0.3rem;`;
const HeatScroll = styled.div`flex: 1; min-height: 0; overflow: auto;`;
const HeatTable = styled.table`
  /* ⚠️ table-layout: fixed — 머리글은 3칸마다만 적는데, 내용에 맞춰 폭을 잡으면 **글자가 있는
     칸만 넓어진다.** 달 칸은 무조건 같은 폭이어야 그림으로 읽힌다(2026-08-30). */
  border-collapse: separate; border-spacing: 0; width: 100%; font-size: 0.6875rem; table-layout: fixed;
  th { position: sticky; top: 0; z-index: 1; background: #f8fbff; color: #94a3b8; font-weight: 600; padding: 0 0.15rem 0.2rem; white-space: nowrap; overflow: visible; }
  th:first-child { left: 0; z-index: 2; text-align: left; width: 11rem; }
  td { padding: 0; height: 1.15rem; }
  td:first-child {
    position: sticky; left: 0; background: #f8fbff; color: #334155; padding-right: 0.4rem; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis; max-width: 11rem;
  }
`;
const Cell = styled.div`
  height: 0.95rem; border-radius: 2px; margin: 0.05rem 0.05rem;
  background: ${p => (p.$c || 'white')};
  ${p => (p.$empty ? 'border: 1px dashed #cbd5e1;' : '')}
`;
// 위에 얇게 얹는 분포 띠 — 그 달에 몇 개가 어느 칸에 있었나. 전체 흐름을 먼저 읽는다.
const DistRow = styled.div`display: flex; gap: 1px; height: 0.5rem;`;
const DistCol = styled.div`flex: 1; display: flex; flex-direction: column-reverse; border-radius: 1px; overflow: hidden; background: #f1f5f9;`;
const DistSeg = styled.div`height: ${p => p.$pct}%; background: ${p => p.$c};`;

const PALETTE = ['#1d4ed8', '#059669', '#d97706', '#7c3aed', '#dc2626', '#0891b2', '#4b5563', '#db2777'];

/** 축마다 y 축의 뜻과 단위 — 요약 표와 같은 대표 수치. */
/** 상세(연계마다 선)에서의 y 축 — 대표 수치와 같은 자. 택1은 칸 index 라 눈금에 칸 이름을 붙인다. */
const pairMetricOf = (axis) => {
  if (axis.kind === 'value' || axis.kind === 'matrix') return { domain: [0, 100], ticks: undefined, fmt: (v) => `${v}%` };
  if (axis.kind === 'rung') return { domain: [0, axis.rungs.length - 1], ticks: axis.rungs.map((_, i) => i), fmt: (v) => axis.rungs[v]?.label ?? v };
  const n = (axis.base || axis.rungs.slice(1)).length;
  return { domain: [0, n], ticks: Array.from({ length: n + 1 }, (_, i) => i), fmt: (v) => `${v}/${n}` };
};

const MANY = 12;   // 상세에서 처음에 켜 두는 선의 수 — 그 이상은 목록에서 골라 켠다

/** 한 축의 상세.
 *
 *   값 축(정확도·모델링 재현률) → **선 그래프.** 값이 흩어져 있어 선이 제일 잘 읽힌다.
 *   칸 축(자동화·적용 범위·시험 대체…) → **히트맵.** 값이 정수 몇 개뿐이라 선은 겹쳐 못 읽는다.
 *
 * 색은 모판·요약과 같은 규칙(colorFor)이라 화면 사이에 문법이 통일된다.
 */
const PairDetail = ({ axis, series, months }) => {
  const m = pairMetricOf(axis);
  const isValue = axis.kind === 'value' || axis.kind === 'matrix';
  const levels = axis.kind === 'rung' ? axis.rungs.length : (axis.base || axis.rungs.slice(1)).length + 1;
  const lines = useMemo(() => series.flatMap(s => pairSeries(s.subjects, s.changes, axis, months)
    .map(l => ({ ...l, key: `${s.name}|${l.id}`, name: series.length > 1 ? `${s.name} · ${l.name}` : l.name }))), [series, axis, months]);
  const [on, setOn] = useState(() => new Set(lines.slice(0, MANY).map(l => l.key)));
  const [q, setQ] = useState('');
  const shown = lines.filter(l => on.has(l.key));
  const rows = months.map((month, i) => { const row = { month: month.slice(2).replace('-', '/') }; shown.forEach(l => { row[l.key] = l.points[i]; }); return row; });
  const toggle = (k) => setOn(prev => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const visible = lines.filter(l => !q || l.name.toLowerCase().includes(q.toLowerCase()));
  const color = (i) => PALETTE[i % PALETTE.length];
  // 분포 띠 — 그 달에 몇 개가 어느 칸에 있었나(히트맵 위에 얇게)
  const dist = useMemo(() => (isValue ? null : months.map((_, i) => {
    const counts = Array.from({ length: levels }, () => 0);
    let none = 0;
    lines.forEach(l => { const v = l.points[i]; if (v == null) none += 1; else counts[Math.min(v, levels - 1)] += 1; });
    return { counts, none, total: lines.length };
  })), [lines, months, isValue, levels]);

  if (!isValue) {
    return (
      <Split>
        <HeatWrap>
          <DistRow aria-label="달마다 칸 분포">
            {dist.map((d, i) => (
              <DistCol key={i} title={`${months[i]} — ${axis.rungs.map((r, j) => `${r.label} ${d.counts[j] || 0}`).join(' · ')}${d.none ? ` · 미평가 ${d.none}` : ''}`}>
                {d.counts.map((n, j) => n > 0 && <DistSeg key={j} $c={colorFor(j, levels)} $pct={(n * 100) / Math.max(1, d.total)} />)}
              </DistCol>
            ))}
          </DistRow>
          <HeatScroll>
            <HeatTable>
              <thead>
                <tr>
                  <th>연계 {visible.length}</th>
                  {months.map((mo, i) => <th key={mo}>{i % 3 === 0 ? mo.slice(2).replace('-', '/') : ''}</th>)}
                </tr>
              </thead>
              <tbody>
                {visible.map(l => (
                  <tr key={l.key}>
                    <td title={l.name}>{l.name}</td>
                    {months.map((mo, i) => {
                      const v = l.points[i];
                      return (
                        <td key={mo}>
                          <Cell $c={v == null ? 'white' : colorFor(Math.min(v, levels - 1), levels)} $empty={v == null}
                               title={`${l.name} · ${mo} — ${v == null ? '미평가' : m.fmt(v)}`} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {visible.length === 0 && <tr><td colSpan={months.length + 1} style={{ color: '#94a3b8', padding: '0.4rem 0' }}>이력이 있는 연계가 없습니다.</td></tr>}
              </tbody>
            </HeatTable>
          </HeatScroll>
        </HeatWrap>
        <Picker aria-label={`${axis.label} 범례`}>
          <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="연계 찾기" aria-label="연계 찾기" style={{ position: 'sticky', top: 0 }} />
          <PickBar><span>색 = 칸</span></PickBar>
          {axis.rungs.map((r, i) => (
            <label key={r.key} title={r.description || r.label} style={{ cursor: 'default' }}>
              <i style={{ background: colorFor(i, levels), width: '0.9rem', height: '0.6rem' }} />
              {axis.kind === 'rung' ? r.label : `${i}/${levels - 1}${i === 0 ? ' (아무것도 안 켬)' : ''}`}
            </label>
          )).slice(0, levels)}
          <label style={{ cursor: 'default' }}><i style={{ border: '1px dashed #cbd5e1', width: '0.9rem', height: '0.6rem' }} />미평가</label>
        </Picker>
      </Split>
    );
  }

  return (
    <Split>
      <ChartBox>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: axis.kind === 'rung' ? 40 : -18 }}>
            <CartesianGrid stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} interval="preserveStartEnd" />
            <YAxis domain={m.domain} ticks={m.ticks} tickFormatter={m.fmt} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={axis.kind === 'rung' ? 100 : 44} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} formatter={(v, key) => [v == null ? '—' : m.fmt(v), lines.find(l => l.key === key)?.name || key]} />
            {shown.map((l) => (
              <Line key={l.key} type="stepAfter" dataKey={l.key} stroke={color(lines.indexOf(l))} strokeWidth={1.6} dot={{ r: 2 }} activeDot={{ r: 4 }} connectNulls isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartBox>
      <Picker aria-label={`${axis.label} 연계 고르기`}>
        <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="연계 찾기" aria-label="연계 찾기" style={{ position: 'sticky', top: 0 }} />
        <PickBar>
          <span>{shown.length}/{lines.length} 선</span>
          <button type="button" onClick={() => setOn(new Set(visible.map(l => l.key)))}>보이는 것 전부</button>
          <button type="button" onClick={() => setOn(new Set())}>전부 끔</button>
        </PickBar>
        {visible.map(l => (
          <label key={l.key} title={l.name}>
            <input type="checkbox" checked={on.has(l.key)} onChange={() => toggle(l.key)} />
            <i style={{ background: on.has(l.key) ? color(lines.indexOf(l)) : '#e2e8f0' }} />
            {l.name}
          </label>
        ))}
        {lines.length === 0 && <span style={{ color: '#94a3b8' }}>이력이 있는 연계가 없습니다.</span>}
      </Picker>
    </Split>
  );
};

export const metricOf = (axis) => {
  if (axis.kind === 'value') return { label: '평균 정확도', unit: '%', domain: [0, 100] };
  if (axis.kind === 'rung') return { label: `${axis.rungs[headlineIndex(axis)]?.label} 이상`, unit: '%', domain: [0, 100] };
  if (axis.kind === 'matrix') return { label: '시험 불량 재현', unit: '%', domain: [0, 100] };
  const n = (axis.base || axis.rungs.slice(1)).length;
  return { label: '적용 단계 수 (평균)', unit: `/${n}`, domain: [0, n] };
};

/** 해석 활용 기록 — 사업부들의 건을 달마다 종류별로 센다. 12/24개월에 걸치는 두 해를 받는다. */
const useReviewMonthly = (series, months) => {
  const [rows, setRows] = useState([]);
  const ids = series.map(s => s.divisionId).filter(id => id != null).join(',');
  const years = [...new Set(months.map(m => Number(m.slice(0, 4))))].join(',');
  useEffect(() => {
    if (!ids) { setRows([]); return; }
    let alive = true;
    const want = ids.split(',').flatMap(id => years.split(',').map(y => [Number(id), Number(y)]));
    Promise.all(want.map(([id, y]) => maturityApi.listReviews(id, y, '').then(r => r.data || []).catch(() => [])))
      .then(lists => { if (alive) setRows(lists.flat()); });
    return () => { alive = false; };
  }, [ids, years]);
  return useMemo(() => months.map(month => {
    const row = { month: month.slice(2).replace('-', '/'), spec: 0, cause: 0 };
    rows.forEach(r => { if ((r.month || '').slice(0, 7) === month) row[r.kind === 'cause' ? 'cause' : 'spec'] += 1; });
    return row;
  }), [rows, months]);
};

const ChartsView = ({ series, axes, review }) => {
  const [span, setSpan] = useState(12);                       // 12 | 24 | 'custom'
  const nowKey = monthKeys(1)[0];
  const [range, setRange] = useState({ from: monthKeys(12)[0], to: nowKey });   // 「기간 설정」의 두 연-월
  const [detail, setDetail] = useState(axes[0]?.key || null);   // 오른쪽 「상세」에 보일 축
  const months = useMemo(() => (span === 'custom' ? monthRange(range.from, range.to) : monthKeys(span)), [span, range]);
  const data = useMemo(() => series.map(s => ({ name: s.name, rows: monthlySeries(s.subjects, s.changes, axes, months) })), [series, axes, months]);
  const reviewRows = useReviewMonthly(review ? series : [], months);
  const reviewTotal = reviewRows.reduce((n, r) => n + r.spec + r.cause, 0);
  const detailAxis = axes.find(a => a.key === detail) || null;
  return (
    <Wrap>
      <Bar>
        <span>기간</span>
        <Chip $on={span === 12} onClick={() => setSpan(12)}>12개월</Chip>
        <Chip $on={span === 24} onClick={() => setSpan(24)}>24개월</Chip>
        <Chip $on={span === 'custom'} onClick={() => setSpan('custom')} title="두 연-월 사이로 본다 (최대 60달)">기간 설정</Chip>
        {span === 'custom' && (
          <>
            <input type="month" value={range.from} max={nowKey} aria-label="시작 연-월" onChange={e => setRange(r => ({ ...r, from: e.target.value }))} style={{ fontFamily: 'inherit', fontSize: '0.8125rem', padding: '0.2rem 0.4rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem' }} />
            <span>~</span>
            <input type="month" value={range.to} max={nowKey} aria-label="끝 연-월" onChange={e => setRange(r => ({ ...r, to: e.target.value }))} style={{ fontFamily: 'inherit', fontSize: '0.8125rem', padding: '0.2rem 0.4rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem' }} />
            <span>{months.length ? `${months.length}달` : '연-월을 둘 다 고르세요'}</span>
          </>
        )}
        <span style={{ marginLeft: '0.5rem' }}>달마다 「그 달 말의 상태」를 이력에서 되감아 셉니다 — 마지막 점이 요약의 지금 값입니다. 점에 대면 그 달의 변화 수.</span>
      </Bar>
      <Body>
      <Grid>
        {axes.map(axis => {
          const m = metricOf(axis);
          // recharts 한 표의 자료: [{month, <이름>: 값, <이름>_n: 변화 수}, …]
          const rows = months.map((month, i) => {
            const row = { month: month.slice(2).replace('-', '/') };
            data.forEach(d => { row[d.name] = d.rows[i]?.[axis.key]?.value ?? null; row[`${d.name}_n`] = d.rows[i]?.[axis.key]?.changes ?? 0; });
            return row;
          });
          const last = data.length === 1 ? data[0].rows[months.length - 1]?.[axis.key]?.value : null;
          return (
            <Panel key={axis.key} aria-label={axis.label} $on={detail === axis.key}>
              <h4>{axis.label}<span>{m.label} {m.unit}</span>
                <Detail type="button" $on={detail === axis.key} onClick={() => setDetail(axis.key)} aria-pressed={detail === axis.key}
                        title="오른쪽에 연계(시험 × 시뮬레이션)마다 선으로 본다">상세</Detail>
              </h4>
              {data.length === 1 && <Now>{last != null ? `${last}${m.unit === '%' ? '%' : ''}` : '—'}<small>지금</small></Now>}
              <ChartBox>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
                    <CartesianGrid stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} interval="preserveStartEnd" />
                    <YAxis domain={m.domain} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={44} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }}
                             formatter={(v, name, item) => [v == null ? '—' : `${v}${m.unit === '%' ? '%' : m.unit}` + (item?.payload?.[`${name}_n`] ? ` · 변화 ${item.payload[`${name}_n`]}` : ''), name]} />
                    {/* ⚠️ itemSorter={null} — recharts 3 의 기본값은 'value' 라 **범례를 이름순으로 정렬한다**.
                        사업부 차례는 대시보드 설정(Division.order)이 정본이므로 선을 그린 차례 그대로 둔다(2026-08-30). */}
                    {data.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} itemSorter={null} />}
                    {data.map((d, i) => (
                      <Line key={d.name} type="monotone" dataKey={d.name} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2}
                            dot={{ r: 2.5 }} activeDot={{ r: 4 }} connectNulls isAnimationActive={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </ChartBox>
            </Panel>
          );
        })}
        {review && (
        <Panel aria-label="해석 활용 기록">
          <h4>해석 활용 기록<span>달마다 건수 — {review?.kinds?.map(k => k.label).join(' · ') || '설계 스펙 검토 · 원인 분석'}</span></h4>
          {data.length >= 1 && <Now>{reviewTotal}<small>건 / {months.length}개월</small></Now>}
          <ChartBox>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reviewRows} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={44} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} formatter={(v, name) => [`${v}건`, name === 'spec' ? '설계 스펙 검토' : '원인 분석']} />
                <RBar dataKey="spec" stackId="r" fill="#1d4ed8" isAnimationActive={false} />
                <RBar dataKey="cause" stackId="r" fill="#f59e0b" isAnimationActive={false} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartBox>
        </Panel>
        )}
      </Grid>
      <Side aria-label="상세">
        <h4>상세<span>{detailAxis
          ? `${detailAxis.label} — ${detailAxis.kind === 'value' || detailAxis.kind === 'matrix' ? '연계마다 선 하나' : '연계마다 한 줄 · 색이 칸'}`
          : '왼쪽 판의 「상세」를 누르세요'}</span></h4>
        {detailAxis && <PairDetail key={detailAxis.key} axis={detailAxis} series={series} months={months} />}
      </Side>
      </Body>
    </Wrap>
  );
};

export default ChartsView;
