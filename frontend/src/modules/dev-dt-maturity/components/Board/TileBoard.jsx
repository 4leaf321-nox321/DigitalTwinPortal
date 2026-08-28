import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { hierarchy, treemap, treemapSquarify } from 'd3-hierarchy';
import { flagDefs } from '../../utils/board';

// 「모판」(2026-08-29) — 미술관 벽의 액자 모음처럼, 화면 전체가 한 뭉치다(트리맵).
// 바깥 액자 = 묶음(시뮬레이션은 담당 부서, 디지털 스레드는 스레드), 그 안의 액자 = 연계·구간 하나.
// 고른 축의 칸이 액자의 색이 된다. 액자 크기는 균등 — 색만 정보고, 배치가 축을 바꿔도 안정적이다.
// 묶음 이름표를 누르면 그 묶음만 벽 전체로 펼친다(드릴다운) — 「← 전체」로 돌아온다(2026-08-29).

const Wrap = styled.div`display: flex; flex-direction: column; gap: 0.6rem; flex: 1; min-height: 0;`;
const Bar = styled.div`display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap;`;
const AxisBtn = styled.button`
  padding: 0.3rem 0.8rem; border: 1px solid ${p => (p.$on ? '#1d4ed8' : '#cbd5e1')}; border-radius: 999px; font-family: inherit; font-size: 0.8125rem; font-weight: 600; cursor: pointer;
  background: ${p => (p.$on ? '#1d4ed8' : 'white')}; color: ${p => (p.$on ? 'white' : '#475569')};
  &:hover { border-color: #1d4ed8; }
`;
const Legend = styled.div`
  display: flex; gap: 0.7rem; flex-wrap: wrap; align-items: center; font-size: 0.75rem; color: #475569; margin-left: auto;
  i { display: inline-block; width: 0.8rem; height: 0.8rem; border-radius: 3px; margin-right: 0.3rem; vertical-align: -2px; }
`;
const Sw = styled.i`background: ${p => p.$c}; ${p => (p.$dashed ? 'background: white; border: 1.5px dashed #94a3b8;' : '')}`;
const Wall = styled.div`position: relative; flex: 1; min-height: 24rem; border-radius: 0.6rem; overflow: hidden; background: #0f172a;`;
const GroupBox = styled.div`position: absolute; border: 1px solid rgba(255, 255, 255, 0.35); border-radius: 4px; overflow: hidden;`;
const GroupLabel = styled.div`
  position: absolute; left: 0; right: 0; top: 0; height: 1.25rem; line-height: 1.25rem; padding: 0 0.45rem;
  font-size: 0.6875rem; font-weight: 700; color: #e2e8f0; background: rgba(15, 23, 42, 0.85); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
`;
const Frame = styled.button`
  position: absolute; font-family: inherit; cursor: pointer; padding: 0; overflow: hidden; text-align: left; border-radius: 2px;
  background: ${p => p.$c}; border: ${p => (p.$empty ? '1.5px dashed #64748b' : '1px solid rgba(15, 23, 42, 0.55)')};
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.25);   /* 재평가 필요 표시는 모판엔 없다(2026-08-29) — 색이 곧 정보 */
  &:hover { outline: 2px solid white; z-index: 2; }
`;
const FName = styled.span`
  position: absolute; left: 0.25rem; right: 0.2rem; top: 0.15rem; font-size: 0.66rem; font-weight: 700; line-height: 1.2;
  color: ${p => (p.$dark ? 'white' : '#0f172a')}; overflow: hidden; display: -webkit-box; -webkit-line-clamp: ${p => p.$lines}; -webkit-box-orient: vertical; word-break: keep-all;
`;
const FBadge = styled.span`position: absolute; right: 0.25rem; bottom: 0.1rem; font-size: 0.62rem; font-weight: 700; color: ${p => (p.$dark ? 'rgba(255,255,255,0.9)' : 'rgba(15,23,42,0.75)')};`;
const Muted = styled.div`font-size: 0.8125rem; color: #94a3b8;`;

const EMPTY = '#334155';
// 어두운 벽 전용 팔레트 — 판의 옅은 첫 칸(#dbeafe)은 벽 위에서 흰색으로 읽혀 미평가와 헷갈린다(2026-08-29).
const WALL_COLORS = ['#93c5fd', '#60a5fa', '#3b82f6', '#1d4ed8', '#172e78'];
const wallColor = (idx, count) => {
  if (idx == null) return EMPTY;
  const slot = Math.round((idx / Math.max(1, count - 1)) * (WALL_COLORS.length - 1));
  return WALL_COLORS[Math.min(WALL_COLORS.length - 1, Math.max(0, slot))];
};
const isDark = (c) => ['#3b82f6', '#1d4ed8', '#172e78', EMPTY].includes(c);

/** 고른 축에서 이 연계의 칸 index 와 짧은 표기. 미평가는 null. */
export const tileValue = (axis, p) => {
  const a = p.assessments?.[axis.key];
  if (!a || a.rung_index == null) return { idx: null, text: a?.unknown ? '?' : null, stale: !!a?.stale };
  if (axis.kind === 'value') return { idx: a.rung_index, text: `${a.value}%`, stale: a.stale };
  if (axis.kind === 'set') return { idx: a.rung_index, text: `${(a.flags || []).length}/${flagDefs(axis).length}`, stale: a.stale };
  if (axis.kind === 'matrix') return { idx: a.rung_index, text: a.summary ? `${a.summary.test}/${a.summary.total}` : null, stale: a.stale };
  return { idx: a.rung_index, text: null, stale: a.stale };
};

const W = 100, H = 100;   // 트리맵의 가상 크기(%) — 화면 비율은 CSS 가 맡는다

const TileBoard = ({ subjects = [], axes = [], onOpenPair, allMode = false, sector = 'simulation' }) => {
  const isThread = sector === 'digital_thread';
  const [axisKey, setAxisKey] = useState(axes[0]?.key);
  const [focus, setFocus] = useState(null);   // 드릴다운한 묶음 이름
  const axis = axes.find(a => a.key === axisKey) || axes[0];
  const total = axis ? axis.rungs.length : 1;

  const root = useMemo(() => {
    if (!axis) return null;
    const groups = new Map();
    subjects.forEach(s => (s.pairs || []).forEach(p => {
      const g = isThread ? (s.segment?.thread_name || '스레드 없음') : (p.agent?.department_name || '부서 미지정');
      const key = allMode && s.division_name ? `${s.division_name} · ${g}` : g;
      if (!groups.has(key)) groups.set(key, []);
      const v = tileValue(axis, p);
      groups.get(key).push({
        id: p.id, name: isThread ? s.name : (p.agent?.name || s.name), sub: isThread ? '' : s.name,
        idx: v.idx, text: v.text, stale: v.stale,
        // 균등(2026-08-29) — 색만 정보다. 크기까지 서열이면 미평가가 작아져 「채울 곳」이 안 보인다.
        value: 1,
      });
    }));
    const entries = [...groups.entries()].filter(([name]) => focus == null || name === focus);
    if (focus != null && entries.length === 0) return null;          // 필터로 사라졌으면 밖에서 되돌린다
    const h = hierarchy({ children: entries.map(([name, children]) => ({ name, children })) })
      .sum(d => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));
    treemap().tile(treemapSquarify.ratio(1.35)).size([W, H]).paddingInner(0.35).paddingOuter(0.5).paddingTop(3.2)(h);
    return h;
  }, [subjects, axis, allMode, isThread, focus]);
  // 드릴다운한 묶음이 필터로 사라지면 전체로
  if (focus != null && root == null) setFocus(null);

  if (!axis || !root) return null;
  const pairsCount = subjects.reduce((n, s) => n + (s.pairs || []).length, 0);
  return (
    <Wrap>
      <Bar>
        {focus != null && (
          <AxisBtn type="button" onClick={() => setFocus(null)} title="벽 전체로 돌아간다" style={{ fontWeight: 700 }}>← 전체</AxisBtn>
        )}
        {focus != null && <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b' }}>{focus}</span>}
        <span style={{ fontSize: '0.8125rem', color: '#64748b', fontWeight: 700, marginLeft: focus != null ? '0.5rem' : 0 }}>색의 기준</span>
        {axes.map(a => <AxisBtn key={a.key} type="button" $on={a.key === axis.key} aria-pressed={a.key === axis.key} onClick={() => setAxisKey(a.key)}>{a.label}</AxisBtn>)}
        <Legend aria-label="범례">
          {axis.rungs.map((r, i) => (axis.hide_empty && i === 0 ? null : <span key={r.key}><Sw $c={wallColor(i, total)} />{r.label}</span>))}
          <span><Sw $dashed />미평가</span>
        </Legend>
      </Bar>
      {pairsCount === 0 ? <Muted>아직 {isThread ? '구간' : '연계'}이 없습니다 — 목록 탭에서 더하세요.</Muted> : (
        <Wall aria-label={`모판 — ${axis.label}`}>
          {(root.children || []).map(g => (
            <GroupBox key={g.data.name} style={{ left: `${g.x0}%`, top: `${g.y0}%`, width: `${g.x1 - g.x0}%`, height: `${g.y1 - g.y0}%` }}
                      title={focus == null ? `${g.data.name} — ${g.children?.length || 0}개 · 누르면 이 묶음만 펼칩니다` : `${g.data.name} — ${g.children?.length || 0}개`}>
              <GroupLabel as="button" type="button" aria-label={`${g.data.name} 펼치기`}
                          onClick={() => setFocus(f => (f == null ? g.data.name : null))}
                          style={{ cursor: 'pointer', border: 'none', width: '100%', textAlign: 'left', fontFamily: 'inherit' }}>
                {g.data.name} <span style={{ opacity: 0.7, fontWeight: 400 }}>{g.children?.length || 0}</span>{focus == null && <span style={{ float: 'right', opacity: 0.7 }}>⤢</span>}
              </GroupLabel>
            </GroupBox>
          ))}
          {root.leaves().map(n => {
            const d = n.data;
            const c = d.idx == null ? EMPTY : wallColor(d.idx, total);
            const w = n.x1 - n.x0, h = n.y1 - n.y0;
            const label = d.idx == null ? (d.text === '?' ? '확인 필요' : '미평가') : axis.rungs[d.idx]?.label;
            const showName = w > 6 && h > 3.2;
            const lines = h > 8 ? 3 : h > 5 ? 2 : 1;
            return (
              <Frame key={d.id} type="button" $c={c} $empty={d.idx == null}
                     style={{ left: `${n.x0}%`, top: `${n.y0}%`, width: `${w}%`, height: `${h}%` }}
                     title={`${d.name}${d.sub ? ` — ${d.sub}` : ''} · ${axis.label}: ${label}`}
                     onClick={() => onOpenPair && onOpenPair(d.id)}>
                {showName && <FName $dark={isDark(c)} $lines={lines}>{d.name}</FName>}
                {showName && d.text && h > 5 && <FBadge $dark={isDark(c)}>{d.text}</FBadge>}
              </Frame>
            );
          })}
        </Wall>
      )}
    </Wrap>
  );
};

export default TileBoard;
