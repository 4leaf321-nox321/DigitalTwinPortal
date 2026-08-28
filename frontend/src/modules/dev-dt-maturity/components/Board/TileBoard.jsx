import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { colorFor, flagDefs } from '../../utils/board';

// 「모판」(2026-08-29) — 연계(시험 × 시뮬레이션) 하나가 네모 하나. 고른 축의 칸이 네모의 색이 된다.
// 담당 부서로 묶어, 「어느 부서가 어디까지 왔나」가 색의 밭으로 한눈에 보인다.
// 축을 바꾸면 같은 밭이 다른 기준으로 다시 물든다 — 진행현황을 훑는 화면이지, 값을 고치는 화면이 아니다(누르면 상세).

const Wrap = styled.div`display: flex; flex-direction: column; gap: 0.6rem; flex: 1; min-height: 0;`;
const Bar = styled.div`display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap;`;
const AxisBtn = styled.button`
  padding: 0.3rem 0.8rem; border: 1px solid ${p => (p.$on ? '#1d4ed8' : '#cbd5e1')}; border-radius: 999px; font-family: inherit; font-size: 0.8125rem; font-weight: 600; cursor: pointer;
  background: ${p => (p.$on ? '#1d4ed8' : 'white')}; color: ${p => (p.$on ? 'white' : '#475569')};
  &:hover { border-color: #1d4ed8; }
`;
const Legend = styled.div`
  display: flex; gap: 0.7rem; flex-wrap: wrap; align-items: center; font-size: 0.75rem; color: #475569; margin-left: auto;
  i { display: inline-block; width: 0.8rem; height: 0.8rem; border-radius: 3px; margin-right: 0.3rem; vertical-align: -2px; background: ${p => p.$c}; }
`;
const Sw = styled.i`background: ${p => p.$c} !important; ${p => (p.$dashed ? 'background: white !important; border: 1.5px dashed #94a3b8;' : '')}`;
const Field = styled.div`flex: 1; min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: 0.9rem; padding-bottom: 0.5rem;`;
const Group = styled.section``;
const GroupHead = styled.div`
  display: flex; align-items: baseline; gap: 0.6rem; margin-bottom: 0.4rem; padding-bottom: 0.25rem; border-bottom: 2px solid #e2e8f0;
  h4 { margin: 0; font-size: 0.9375rem; color: #1e293b; } span { font-size: 0.75rem; color: #94a3b8; }
`;
const MiniBar = styled.div`display: inline-flex; height: 0.5rem; width: 7rem; border-radius: 999px; overflow: hidden; background: #f1f5f9; margin-left: auto; align-self: center;`;
const MiniSeg = styled.span`display: block; width: ${p => p.$pct}%; background: ${p => p.$c};`;
// 촘촘히(기본): 40~50개도 한 화면 — 한 줄 이름만, 시험 이름은 대면. 크게: 두 줄.
const Tiles = styled.div`display: grid; grid-template-columns: repeat(auto-fill, minmax(${p => (p.$big ? '11rem' : '7.5rem')}, 1fr)); gap: ${p => (p.$big ? '0.45rem' : '0.3rem')};`;
const Tile = styled.button`
  position: relative; text-align: left; border-radius: ${p => (p.$big ? '0.5rem' : '0.375rem')}; padding: ${p => (p.$big ? '0.5rem 0.6rem' : '0.3rem 0.45rem')}; min-height: ${p => (p.$big ? '3.6rem' : '1.9rem')}; font-family: inherit; cursor: pointer;
  background: ${p => p.$c}; color: ${p => (p.$dark ? 'white' : '#1e293b')};
  border: ${p => (p.$empty ? '1.5px dashed #94a3b8' : '1px solid rgba(15, 23, 42, 0.08)')};
  box-shadow: ${p => (p.$stale ? 'inset 0 0 0 2px #f59e0b' : 'none')};
  transition: transform 0.06s ease; &:hover { transform: translateY(-2px); box-shadow: 0 4px 10px rgba(15, 23, 42, 0.18); z-index: 1; }
`;
const TName = styled.div`font-size: ${p => (p.$big ? '0.8125rem' : '0.71rem')}; font-weight: 700; line-height: 1.25; overflow: hidden; ${p => (p.$big ? 'display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;' : 'white-space: nowrap; text-overflow: ellipsis; padding-right: 1.7rem;')}`;
const TSub = styled.div`font-size: 0.6875rem; opacity: 0.85; margin-top: 0.15rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`;
const TBadge = styled.span`position: absolute; top: 0.35rem; right: 0.45rem; font-size: 0.625rem; font-weight: 700; opacity: 0.9;`;
const Muted = styled.div`font-size: 0.8125rem; color: #94a3b8;`;

const EMPTY = '#f1f5f9';
const isDark = (c) => ['#3b82f6', '#1d4ed8', '#1e3a8a'].includes(c);

/** 고른 축에서 이 연계의 칸 index 와 짧은 표기. 미평가는 null. */
export const tileValue = (axis, p) => {
  const a = p.assessments?.[axis.key];
  if (!a || a.rung_index == null) return { idx: null, text: a?.unknown ? '?' : null, stale: !!a?.stale };
  if (axis.kind === 'value') return { idx: a.rung_index, text: `${a.value}%`, stale: a.stale };
  if (axis.kind === 'set') return { idx: a.rung_index, text: `${(a.flags || []).length}/${flagDefs(axis).length}`, stale: a.stale };
  if (axis.kind === 'matrix') return { idx: a.rung_index, text: a.summary ? `${a.summary.test}/${a.summary.total}` : null, stale: a.stale };
  return { idx: a.rung_index, text: null, stale: a.stale };
};

const TileBoard = ({ subjects = [], axes = [], onOpenPair, allMode = false, sector = 'simulation' }) => {
  const isThread = sector === 'digital_thread';
  const [big, setBig] = useState(false);
  const [axisKey, setAxisKey] = useState(axes[0]?.key);
  const axis = axes.find(a => a.key === axisKey) || axes[0];
  // 연계 → 네모. 담당 부서로 묶는다(전체면 사업부 · 부서).
  const groups = useMemo(() => {
    const map = new Map();
    subjects.forEach(s => (s.pairs || []).forEach(p => {
      // 묶음 — 시뮬레이션은 담당 부서, 디지털 스레드는 스레드
      const dept = isThread ? (s.segment?.thread_name || '스레드 없음') : (p.agent?.department_name || '부서 미지정');
      const key = allMode && s.division_name ? `${s.division_name} · ${dept}` : dept;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({ p, subject: s });
    }));
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'ko'));
  }, [subjects, allMode, isThread]);
  if (!axis) return null;
  const total = axis.rungs.length;
  return (
    <Wrap>
      <Bar>
        <span style={{ fontSize: '0.8125rem', color: '#64748b', fontWeight: 700 }}>색의 기준</span>
        {axes.map(a => <AxisBtn key={a.key} type="button" $on={a.key === axis.key} aria-pressed={a.key === axis.key} onClick={() => setAxisKey(a.key)}>{a.label}</AxisBtn>)}
        <AxisBtn type="button" $on={big} aria-pressed={big} onClick={() => setBig(b => !b)} title="네모를 키워 시험 이름까지 보인다" style={{ marginLeft: '0.4rem' }}>크게</AxisBtn>
        <Legend aria-label="범례">
          {axis.rungs.map((r, i) => (axis.hide_empty && i === 0 ? null : <span key={r.key}><Sw $c={colorFor(i, total)} />{r.label}</span>))}
          <span><Sw $dashed />미평가</span>
          <span><Sw $c="white" style={{ border: '2px solid #f59e0b', background: 'white' }} />재평가 필요</span>
        </Legend>
      </Bar>
      <Field>
        {groups.length === 0 && <Muted>아직 연계가 없습니다 — 목록 탭에서 이으세요.</Muted>}
        {groups.map(([dept, rows]) => {
          const counts = new Array(total).fill(0);
          let empty = 0;
          rows.forEach(({ p }) => { const v = tileValue(axis, p); if (v.idx == null) empty += 1; else counts[v.idx] += 1; });
          return (
            <Group key={dept} aria-label={dept}>
              <GroupHead>
                <h4>{dept}</h4>
                <span>{rows.length}개{empty > 0 ? ` · 미평가 ${empty}` : ''}</span>
                <MiniBar title={axis.rungs.map((r, i) => `${r.label} ${counts[i]}`).join(' · ') + ` · 미평가 ${empty}`}>
                  {counts.map((n, i) => <MiniSeg key={i} $pct={(n * 100) / rows.length} $c={colorFor(i, total)} />)}
                  <MiniSeg $pct={(empty * 100) / rows.length} $c={EMPTY} />
                </MiniBar>
              </GroupHead>
              <Tiles $big={big}>
                {rows.map(({ p, subject }) => {
                  const v = tileValue(axis, p);
                  const c = v.idx == null ? EMPTY : colorFor(v.idx, total);
                  const label = v.idx == null ? (v.text === '?' ? '확인 필요' : '미평가') : axis.rungs[v.idx]?.label;
                  return (
                    <Tile key={p.id} type="button" $big={big} $c={c} $dark={isDark(c)} $empty={v.idx == null} $stale={v.stale}
                          title={`${isThread ? subject.name : `${subject.name} × ${p.agent?.name || ''}`} — ${axis.label}: ${label}${v.stale ? ' · 재평가 필요' : ''}`}
                          onClick={() => onOpenPair && onOpenPair(p.id)}>
                      <TName $big={big}>{isThread ? subject.name : (p.agent?.name || subject.name)}</TName>
                      {big && !isThread && <TSub>{subject.name}</TSub>}
                      {big && isThread && <TSub>{subject.segment ? `${subject.segment.from_org_name || ''} → ${subject.segment.to_org_name || ''}` : ''}</TSub>}
                      {v.text && <TBadge>{v.text}</TBadge>}
                    </Tile>
                  );
                })}
              </Tiles>
            </Group>
          );
        })}
      </Field>
    </Wrap>
  );
};

export default TileBoard;
