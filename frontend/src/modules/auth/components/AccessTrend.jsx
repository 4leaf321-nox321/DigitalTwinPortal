import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend,
} from 'recharts';
import { UNITS, viewSeries, bucketLabel as label } from '../utils/signupStats';

/**
 * 조회수 현황 — 화면을 언제 얼마나 열어 봤나(2026-08-30).
 *
 * 가입자 현황과 **한 그림에 섞지 않는다.** 사람 수(수십)와 클릭 수(수천)는 자릿수가
 * 달라 겹쳐 놓으면 둘 다 안 읽힌다. 위의 토글로 갈아 끼운다.
 *
 * ⚠️ 자료를 화면에서 세지 않는다. 가입자는 이미 받아 둔 사용자 목록으로 충분하지만,
 *    접속 이력은 사람 수가 아니라 **클릭 수**로 늘어 목록 API(한 번에 200줄)로는
 *    그래프를 못 그린다. 서버가 묶어 준 것(/auth/access-logs/stats)을 받는다.
 *
 * 무엇을 세나
 *     조회   화면 하나를 연 것(MODULE_ACCESS). 같은 화면을 다시 열면 다시 센다.
 *     방문자 그 칸에 실제로 들어온 사람 수 — 조회가 몇 사람의 것인지 보려고 함께 둔다.
 *     로그인 그 칸의 로그인 수. 조회는 많은데 로그인이 적으면 오래 붙어 있었다는 뜻이다.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const Wrap = styled.div`display: flex; flex-direction: column; gap: 0.9rem; min-height: 0;`;
const Bar2 = styled.div`display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap;`;
const Chip = styled.button`
  padding: 0.35rem 0.9rem; border-radius: 999px; font-family: inherit; font-size: 0.875rem; font-weight: 600; cursor: pointer;
  border: 1px solid ${p => (p.$on ? '#0891b2' : '#d1d5db')};
  background: ${p => (p.$on ? '#0891b2' : 'white')}; color: ${p => (p.$on ? 'white' : '#4b5563')};
`;
const Stats = styled.div`display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.75rem;
  @media (max-width: 900px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
`;
const Stat = styled.div`
  border: 1px solid #e5e7eb; border-radius: 0.75rem; padding: 0.7rem 0.9rem; background: #f9fafb;
  b { display: block; font-size: 1.6rem; color: #111827; line-height: 1.15; }
  span { font-size: 0.8125rem; color: #6b7280; }
`;
/* 가입자 현황과 같은 높이 규칙 — 토글로 갈아 낄 때 화면이 튀면 안 된다.
   다만 아래에 「많이 본 화면」 줄이 하나 더 붙어 그만큼(3rem) 뺀다. */
const ChartBox = styled.div`height: clamp(18rem, calc(100vh - 37rem), 52rem);`;
const Muted = styled.div`color: #9ca3af; font-size: 0.9375rem; padding: 2rem 0; text-align: center;`;
const Note = styled.p`margin: 0; color: #6b7280; font-size: 0.8125rem;`;
const Top = styled.div`
  display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center;
  span { font-size: 0.8125rem; color: #6b7280; }
  em { font-style: normal; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 999px;
       padding: 0.15rem 0.6rem; font-size: 0.8125rem; color: #334155; }
  b { font-weight: 700; color: #0891b2; margin-left: 0.3rem; }
`;

const AccessTrend = () => {
  const [unit, setUnit] = useState('month');
  const [raw, setRaw] = useState(null);
  const [modules, setModules] = useState([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async (u) => {
    setBusy(true); setError(null);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${API_BASE_URL}/auth/access-logs/stats?unit=${u}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || '조회수를 받지 못했습니다.');
      setRaw(json.data.rows || []);
      setModules(json.data.modules || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, []);

  // 눈금이 바뀌면 다시 묶어 받는다 — 주·월·연은 DB 에서 묶는 단위라 화면에서 못 바꾼다.
  useEffect(() => { load(unit); }, [unit, load]);

  const keep = UNITS.find(u => u.key === unit)?.keep ?? 24;
  const { rows, total, logins } = useMemo(
    () => viewSeries(raw || [], unit, keep), [raw, unit, keep],
  );
  const data = rows.map(r => ({ ...r, name: label(r.bucket, unit) }));
  const lastRow = data[data.length - 1];
  const recent = data.slice(-4).reduce((n, r) => n + r.조회, 0);
  const busiest = data.reduce((a, b) => (b.조회 > (a?.조회 ?? -1) ? b : a), null);
  const span = unit === 'year' ? '해' : unit === 'month' ? '달' : '주';

  if (error) return <Muted>{error}</Muted>;
  if (busy && raw === null) return <Muted>불러오는 중…</Muted>;
  if (!data.length) return <Muted>접속 이력이 없습니다.</Muted>;

  return (
    <Wrap>
      <Bar2>
        {UNITS.map(u => (
          <Chip key={u.key} type="button" $on={unit === u.key} aria-pressed={unit === u.key}
                onClick={() => setUnit(u.key)}>{u.label}</Chip>
        ))}
        <Note style={{ marginLeft: 'auto' }}>
          막대 = 그 칸의 조회 · 선 = 누계 · 조회는 화면 하나를 연 것을 셉니다
        </Note>
      </Bar2>

      <Stats>
        <Stat><b>{total.toLocaleString()}</b><span>전체 조회</span></Stat>
        <Stat><b>{(lastRow?.조회 ?? 0).toLocaleString()}</b><span>이번 {span} 조회 · 방문자 {lastRow?.방문자 ?? 0}명</span></Stat>
        <Stat><b>{recent.toLocaleString()}</b><span>최근 4{span} 조회</span></Stat>
        <Stat><b>{busiest ? busiest.조회.toLocaleString() : 0}</b><span>가장 많았던 칸{busiest ? ` — ${busiest.name}` : ''}</span></Stat>
      </Stats>

      <ChartBox>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="#f3f4f6" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} interval="preserveStartEnd" />
            <YAxis yAxisId="l" allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={52} />
            <YAxis yAxisId="r" orientation="right" allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={56} />
            <Tooltip contentStyle={{ fontSize: 13, borderRadius: 8 }}
                     formatter={(v, n) => [n === '방문자' ? `${v}명` : `${v.toLocaleString()}회`, n]} />
            {/* ⚠️ itemSorter={null} — recharts v3 는 기본으로 값 순서로 뒤섞는다(2026-08 실측). */}
            <Legend wrapperStyle={{ fontSize: 12 }} itemSorter={null} />
            <Bar yAxisId="l" dataKey="조회" fill="#0891b2" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Line yAxisId="r" type="monotone" dataKey="누계" stroke="#f59e0b" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line yAxisId="l" type="monotone" dataKey="방문자" stroke="#7c3aed" strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartBox>

      {modules.length > 0 && (
        <Top>
          <span>많이 본 화면</span>
          {modules.slice(0, 6).map(m => (
            <em key={m.name}>{m.name}<b>{m.views.toLocaleString()}</b></em>
          ))}
          <Note style={{ marginLeft: 'auto' }}>로그인 {logins.toLocaleString()}회</Note>
        </Top>
      )}
    </Wrap>
  );
};

export default AccessTrend;
