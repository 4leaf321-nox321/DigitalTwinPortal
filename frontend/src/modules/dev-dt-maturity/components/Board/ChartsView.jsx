import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { monthlySeries, monthKeys } from '../../utils/board';

// 「변화」 — 축마다 선 그래프 하나(2026-08-28). 표는 없다.
// 이력을 달마다 되감아 「그 달 말의 상태」를 복원하고 요약과 같은 셈으로 대표 수치를 낸다 —
// 그래서 마지막 점이 요약의 지금 숫자와 같다. 「전체」면 사업부마다 선 하나.

const Wrap = styled.div`display: flex; flex-direction: column; gap: 0.6rem; flex: 1; min-height: 0;`;
const Bar = styled.div`display: flex; gap: 0.4rem; align-items: center; font-size: 0.8125rem; color: #64748b;`;
const Chip = styled.button`
  padding: 0.25rem 0.65rem; border: 1px solid ${p => (p.$on ? '#1d4ed8' : '#e2e8f0')}; border-radius: 999px; font-family: inherit; font-size: 0.8125rem; cursor: pointer;
  background: ${p => (p.$on ? '#1d4ed8' : 'white')}; color: ${p => (p.$on ? 'white' : '#475569')};
`;
const Grid = styled.div`
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); grid-auto-rows: minmax(0, 1fr); gap: 0.75rem; flex: 1; min-height: 0; overflow: auto;
  @media (max-width: 1100px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
`;
const Panel = styled.section`
  display: flex; flex-direction: column; border: 1px solid #e2e8f0; border-radius: 0.6rem; background: white; padding: 0.7rem 0.8rem 0.4rem; min-height: 14rem;
  h4 { margin: 0; font-size: 0.9375rem; color: #1e293b; } h4 span { font-size: 0.75rem; color: #94a3b8; font-weight: 400; margin-left: 0.4rem; }
`;
const Now = styled.div`font-size: 1.6rem; font-weight: 700; color: #1e293b; line-height: 1.1; margin: 0.2rem 0 0.3rem; small { font-size: 0.75rem; color: #64748b; font-weight: 500; margin-left: 0.3rem; }`;
const ChartBox = styled.div`flex: 1; min-height: 9rem;`;

const PALETTE = ['#1d4ed8', '#059669', '#d97706', '#7c3aed', '#dc2626', '#0891b2', '#4b5563', '#db2777'];

/** 축마다 y 축의 뜻과 단위 — 요약 표와 같은 대표 수치. */
export const metricOf = (axis) => {
  if (axis.kind === 'value') return { label: '평균 정확도', unit: '%', domain: [0, 100] };
  if (axis.kind === 'rung') return { label: `${axis.rungs[Math.max(0, axis.rungs.length - 2)]?.label} 이상`, unit: '%', domain: [0, 100] };
  if (axis.kind === 'matrix') return { label: '시험 불량 재현', unit: '%', domain: [0, 100] };
  const n = (axis.base || axis.rungs.slice(1)).length;
  return { label: '적용 단계 수 (평균)', unit: `/${n}`, domain: [0, n] };
};

const ChartsView = ({ series, axes }) => {
  const [span, setSpan] = useState(12);
  const months = useMemo(() => monthKeys(span), [span]);
  const data = useMemo(() => series.map(s => ({ name: s.name, rows: monthlySeries(s.subjects, s.changes, axes, months) })), [series, axes, months]);
  return (
    <Wrap>
      <Bar>
        <span>기간</span>
        <Chip $on={span === 12} onClick={() => setSpan(12)}>12개월</Chip>
        <Chip $on={span === 24} onClick={() => setSpan(24)}>24개월</Chip>
        <span style={{ marginLeft: '0.5rem' }}>달마다 「그 달 말의 상태」를 이력에서 되감아 셉니다 — 마지막 점이 요약의 지금 값입니다. 점에 대면 그 달의 변화 수.</span>
      </Bar>
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
            <Panel key={axis.key} aria-label={axis.label}>
              <h4>{axis.label}<span>{m.label} {m.unit}</span></h4>
              {data.length === 1 && <Now>{last != null ? `${last}${m.unit === '%' ? '%' : ''}` : '—'}<small>지금</small></Now>}
              <ChartBox>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
                    <CartesianGrid stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} interval="preserveStartEnd" />
                    <YAxis domain={m.domain} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={44} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }}
                             formatter={(v, name, item) => [v == null ? '—' : `${v}${m.unit === '%' ? '%' : m.unit}` + (item?.payload?.[`${name}_n`] ? ` · 변화 ${item.payload[`${name}_n`]}` : ''), name]} />
                    {data.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
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
      </Grid>
    </Wrap>
  );
};

export default ChartsView;
