/**
 * KPI 한 개의 시계열 차트 — **사업부별 선 + 목표선.**
 *
 * 왜 따로 뺐나
 *     예전에는 그래프 보기에 차트가 **하나뿐**이고 위에서 KPI 를 골라 갈아 끼웠다.
 *     그런데 KPI 는 서로 견주며 보는 것이라, 하나를 보려고 나머지를 지우는 조작이
 *     매번 들어갔다. 이제 KPI 마다 한 장씩 그리므로 이 파일이 그 "한 장" 이다.
 *
 * ⚠️ 세로축을 KPI 끼리 맞추지 않는다. 단위가 %·일·대로 섞여 있어서, 함께 맞추면
 *    작은 단위가 바닥에 눌린다. 각 장이 자기 범위를 쓴다 — 대신 제목에 단위를 적는다.
 */
import React, { useRef, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const KpiLineChart = ({
  data,                 // [{period, target, [사업부]: 값}]
  divisions,            // 보여 줄 사업부 이름들 (선 순서도 이것을 따른다)
  divisionColors,
  targetDiv,            // 목표선의 기준 사업부
  height = 260,
}) => {
  // 마우스를 떼도 값을 남겨 두고 싶을 때가 있다 — 눌러서 얼린다.
  const hoverRef = useRef(null);
  const [frozen, setFrozen] = useState(null);

  const body = (payload, label) => {
    const ordered = [];
    divisions.forEach(div => {
      const found = payload.find(p => p.dataKey === div);
      if (found) ordered.push(found);
    });
    const t = payload.find(p => p.dataKey === 'target');
    if (t) ordered.push(t);
    return (
      <div style={{
        background: 'rgba(255,255,255,0.97)', border: '1px solid #e2e8f0',
        borderRadius: 4, padding: '8px 10px', fontSize: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
      }}>
        <div style={{ fontWeight: 600, marginBottom: 4, color: '#1e293b' }}>{label}</div>
        {ordered.map((p, i) => (
          <div key={i} style={{
            color: p.color || p.stroke, display: 'flex',
            justifyContent: 'space-between', gap: 12, lineHeight: 1.6,
          }}>
            <span>{p.name || p.dataKey}</span>
            <span style={{ fontWeight: 500 }}>{p.value}</span>
          </div>
        ))}
      </div>
    );
  };

  const tooltip = ({ active, payload, label, coordinate }) => {
    if (active && payload && payload.length && coordinate) {
      hoverRef.current = {
        payload: payload.map(p => ({ ...p })),
        label,
        coordinate: { x: coordinate.x, y: coordinate.y },
      };
    }
    if (!active || !payload || !payload.length) return null;
    return body(payload, label);
  };

  return (
    <div style={{ width: '100%', height, position: 'relative' }}
         onClick={() => setFrozen(frozen ? null : hoverRef.current)}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="period" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} width={38} />
          <Tooltip
            content={tooltip}
            isAnimationActive={false}
            wrapperStyle={{ visibility: frozen ? 'hidden' : 'visible' }}
          />
          {/* 범례는 **차트마다 되풀이하지 않는다** — 여러 장을 늘어놓으면 같은 줄이
              열 번 반복돼 자리만 먹는다. 위쪽에 한 번만 둔다(부모가 그린다). */}
          <Legend content={() => null} wrapperStyle={{ display: 'none' }} />
          {divisions.map(div => (
            <Line
              key={div}
              type="monotone"
              dataKey={div}
              stroke={divisionColors[div] || '#64748b'}
              strokeWidth={2}
              dot={{ r: 2.5 }}
              activeDot={{ r: 4.5 }}
              connectNulls
            />
          ))}
          <Line
            type="stepAfter"
            dataKey="target"
            name={`목표 (${targetDiv} 기준)`}
            stroke="#0f172a"
            strokeDasharray="5 5"
            strokeWidth={1.5}
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
      {frozen && (
        <div style={{
          position: 'absolute', left: frozen.coordinate.x + 12,
          top: frozen.coordinate.y + 12, pointerEvents: 'none', zIndex: 5,
        }}>
          {body(frozen.payload, frozen.label)}
          <div style={{ marginTop: 4, fontSize: 10, color: '#94a3b8', textAlign: 'right' }}>
            클릭하여 해제
          </div>
        </div>
      )}
    </div>
  );
};

export default KpiLineChart;
