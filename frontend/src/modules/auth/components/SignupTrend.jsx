import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend,
} from 'recharts';
import { UNITS, signupSeries } from '../utils/signupStats';

/**
 * 가입자 현황 — 플랫폼에 가입한 사람이 언제 늘었나(2026-08-30).
 *
 * 자료는 **이미 받아 둔 사용자 목록**(`/auth/users`)의 `created_at` 하나로 충분하다.
 * 새 API 를 두지 않는다 — 가입 시각 말고는 셀 것이 없고, 관리자만 보는 화면이라
 * 목록이 이미 손에 있다.
 *
 * 눈금 셋(주·월·연)은 **같은 자료를 다르게 묶는 것**뿐이다. 막대는 그 칸의 신규 가입,
 * 선은 그때까지의 누계 — 「이번 달에 몇 명 늘었나」와 「지금 몇 명인가」를 한 그림에서 읽는다.
 */

const Wrap = styled.div`display: flex; flex-direction: column; gap: 1rem;`;
const Bar2 = styled.div`display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap;`;
const Chip = styled.button`
  padding: 0.35rem 0.9rem; border-radius: 999px; font-family: inherit; font-size: 0.875rem; font-weight: 600; cursor: pointer;
  border: 1px solid ${p => (p.$on ? '#0066cc' : '#d1d5db')};
  background: ${p => (p.$on ? '#0066cc' : 'white')}; color: ${p => (p.$on ? 'white' : '#4b5563')};
`;
const Stats = styled.div`display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.75rem;
  @media (max-width: 900px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
`;
const Stat = styled.div`
  border: 1px solid #e5e7eb; border-radius: 0.75rem; padding: 0.9rem 1rem; background: #f9fafb;
  b { display: block; font-size: 1.75rem; color: #111827; line-height: 1.15; }
  span { font-size: 0.8125rem; color: #6b7280; }
`;
const ChartBox = styled.div`height: 22rem;`;
const Muted = styled.div`color: #9ca3af; font-size: 0.9375rem; padding: 2rem 0; text-align: center;`;
const Note = styled.p`margin: 0; color: #6b7280; font-size: 0.8125rem;`;

const label = (key, unit) => {
  if (unit === 'year') return `${key}년`;
  if (unit === 'month') return key.slice(2).replace('-', '/');
  return key.slice(5).replace('-', '/');
};

const SignupTrend = ({ users = [], loading = false }) => {
  const [unit, setUnit] = useState('month');
  const keep = UNITS.find(u => u.key === unit)?.keep ?? 24;
  const { rows, unknown, total } = useMemo(() => signupSeries(users, unit, keep), [users, unit, keep]);
  const data = rows.map(r => ({ ...r, name: label(r.bucket, unit) }));
  const lastRow = data[data.length - 1];
  const recent = data.slice(-4).reduce((n, r) => n + r.신규, 0);
  const busiest = data.reduce((a, b) => (b.신규 > (a?.신규 ?? -1) ? b : a), null);

  if (loading) return <Muted>불러오는 중…</Muted>;
  if (!users.length) return <Muted>가입한 사람이 없습니다.</Muted>;

  return (
    <Wrap>
      <Bar2>
        {UNITS.map(u => (
          <Chip key={u.key} type="button" $on={unit === u.key} aria-pressed={unit === u.key}
                onClick={() => setUnit(u.key)}>{u.label}</Chip>
        ))}
        <Note style={{ marginLeft: 'auto' }}>
          막대 = 그 칸의 신규 가입 · 선 = 누계{unknown > 0 ? ` · 가입 시각이 없는 ${unknown}명은 뺐습니다` : ''}
        </Note>
      </Bar2>

      <Stats>
        <Stat><b>{total}</b><span>전체 가입자</span></Stat>
        <Stat><b>{lastRow?.신규 ?? 0}</b><span>이번 {unit === 'year' ? '해' : unit === 'month' ? '달' : '주'} 신규</span></Stat>
        <Stat><b>{recent}</b><span>최근 4{unit === 'year' ? '해' : unit === 'month' ? '달' : '주'} 신규</span></Stat>
        <Stat><b>{busiest ? busiest.신규 : 0}</b><span>가장 많았던 칸{busiest ? ` — ${busiest.name}` : ''}</span></Stat>
      </Stats>

      <ChartBox>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="#f3f4f6" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} interval="preserveStartEnd" />
            <YAxis yAxisId="l" allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={44} />
            <YAxis yAxisId="r" orientation="right" allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={44} />
            <Tooltip contentStyle={{ fontSize: 13, borderRadius: 8 }} formatter={(v, n) => [`${v}명`, n]} />
            <Legend wrapperStyle={{ fontSize: 12 }} itemSorter={null} />
            <Bar yAxisId="l" dataKey="신규" fill="#0066cc" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Line yAxisId="r" type="monotone" dataKey="누계" stroke="#f59e0b" strokeWidth={2} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartBox>
    </Wrap>
  );
};

export default SignupTrend;
