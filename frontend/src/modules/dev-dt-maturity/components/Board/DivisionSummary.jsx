import React from 'react';
import styled from 'styled-components';
import { colorFor, divisionSummary, flagDefs, headlineIndex } from '../../utils/board';

// 사업부 하나의 「요약」 — 축마다 판 하나, 화면 가득(2026-08-28).
// 큰 숫자(대표 수치) + 분포 + **근거**: 어느 연계가 앞서고(기여) 어느 연계가 처지는지(취약)를 한눈에.
// 요약 표(OverviewGrid)의 셈과 같은 divisionSummary 를 쓰고, 연계 목록만 여기서 더 고른다.

// 사업부 탭을 눌러 들어오는 화면이라 **한 사업부가 화면을 다 차지한다** — 3 × 2 격자가 높이를 채운다(2026-08-28).
const Grid = styled.div`
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); grid-auto-rows: minmax(0, 1fr); gap: 0.75rem; flex: 1; min-height: 0; overflow: auto;
  @media (max-width: 1100px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
`;
const Panel = styled.section`
  display: flex; flex-direction: column; gap: 0.5rem; border: 1px solid #e2e8f0; border-radius: 0.6rem; background: white; padding: 0.8rem 0.9rem; min-height: 0;
`;
const Head = styled.div`display: flex; align-items: baseline; gap: 0.5rem; h4 { margin: 0; font-size: 1.05rem; color: #1e293b; } span { font-size: 0.75rem; color: #94a3b8; }`;
const Big = styled.div`font-size: 2.6rem; font-weight: 700; color: #1e293b; line-height: 1; small { font-size: 0.9rem; font-weight: 500; color: #64748b; margin-left: 0.3rem; }`;
const Line = styled.div`font-size: 0.8125rem; color: #64748b;`;
const Bar = styled.div`display: flex; height: 0.8rem; border-radius: 999px; overflow: hidden; background: #f1f5f9;`;
const Seg = styled.div`width: ${p => p.$pct}%; background: ${p => p.$color};`;
const Legend = styled.div`display: flex; flex-wrap: wrap; gap: 0.4rem 0.8rem; font-size: 0.6875rem; color: #64748b; i { display: inline-block; width: 0.6rem; height: 0.6rem; border-radius: 2px; margin-right: 0.25rem; vertical-align: -1px; background: ${p => p.$c}; }`;
const Strip = styled.div`display: flex; gap: 3px;`;
const Cellet = styled.div`
  flex: 1 1 0; height: 1.5rem; border-radius: 3px; font-size: 0.6875rem; font-weight: 600; line-height: 1.5rem; text-align: center; overflow: hidden; white-space: nowrap;
  background: ${p => p.$color}; color: ${p => (p.$dark ? 'white' : '#1e293b')};
`;
const Two = styled.div`display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; flex: 1; min-height: 0;`;
const List = styled.div`
  display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8125rem; min-height: 0; overflow: auto;
  h5 { margin: 0 0 0.15rem; font-size: 0.6875rem; font-weight: 700; color: ${p => (p.$weak ? '#b45309' : '#166534')}; }
`;
const Item = styled.button`
  display: flex; gap: 0.4rem; align-items: center; text-align: left; border: none; background: ${p => (p.$weak ? '#fffbeb' : '#f0fdf4')}; border-radius: 0.3rem;
  padding: 0.3rem 0.5rem; font-family: inherit; font-size: 0.8125rem; color: #1e293b; cursor: pointer; min-width: 0;
  &:hover { outline: 2px solid ${p => (p.$weak ? '#f59e0b' : '#22c55e')}; }
  b { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; flex: 1; }
  em { font-style: normal; color: #64748b; white-space: nowrap; }
`;
const Muted = styled.div`font-size: 0.75rem; color: #94a3b8;`;

const pct = (n, d) => (d ? Math.round((n * 100) / d) : null);
const shade = (p) => (p == null ? '#e2e8f0' : p >= 75 ? '#1d4ed8' : p >= 50 ? '#3b82f6' : p >= 25 ? '#93c5fd' : '#dbeafe');
const dark = (c) => ['#3b82f6', '#1d4ed8', '#1e3a8a'].includes(c);

/** 연계마다 이 축의 「점수」와 한 줄 설명 — 앞선 것·처진 것을 고르는 재료. */
const scoreOf = (axis, p) => {
  const a = p.assessments?.[axis.key];
  if (a && a.unknown) return { score: -1, text: '확인 필요(모름)', stale: false };
  if (!a || a.rung_index == null) return { score: -1, text: '미평가', stale: false };
  if (axis.kind === 'value') return { score: Number(a.value), text: `${a.value}% · ${axis.rungs[a.rung_index]?.label || ''}`, stale: a.stale };
  if (axis.kind === 'set') {
    const on = flagDefs(axis).filter(f => (a.flags || []).includes(f.key));
    return { score: on.length, text: on.length ? on.map(f => f.short || f.label).join('·') : axis.rungs[0].label, stale: a.stale };
  }
  if (axis.kind === 'matrix') {
    const s = a.summary || { test: 0, market: 0, total: 0 };
    const base = flagDefs(axis).filter(f => (a.flags || []).includes(f.key)).map(f => f.label.slice(0, 2)).join('·');
    return { score: a.rung_index + (s.total ? s.test / s.total : 0), text: `${base || '바탕 없음'} · 시험 ${s.test}/${s.total} · 시장 ${s.market}/${s.total}`, stale: a.stale };
  }
  return { score: a.rung_index, text: axis.rungs[a.rung_index]?.label || '', stale: a.stale };
};

const Headline = ({ axis, s }) => {
  if (!s || s.total === 0) return <Big>—<small>연계 없음</small></Big>;
  if (axis.kind === 'value') return <Big>{s.mean != null ? `${s.mean}%` : '—'}<small>평균 정확도 · 평가 완료 {s.filled}/{s.total}</small></Big>;
  if (axis.kind === 'rung') {
    const k = headlineIndex(axis);
    return <Big>{s.atLeast[k] != null ? `${s.atLeast[k]}%` : '—'}<small>{axis.rungs[k]?.label} 이상</small></Big>;
  }
  if (axis.kind === 'set') return <Big>{s.avg != null ? `${s.avg}` : '—'}<small>/ {s.flags.length} 적용 단계 수 (평균)</small></Big>;
  if (axis.kind === 'matrix') return <Big>{s.testRate != null ? `${s.testRate}%` : '—'}<small>시험 불량 재현 · 시장 {s.marketRate != null ? `${s.marketRate}%` : '—'} · 불량 유형 {s.defectTotal}</small></Big>;
  return null;
};

const Distribution = ({ axis, s }) => {
  if (!s || s.total === 0) return null;
  if (axis.kind === 'value' || axis.kind === 'rung') {
    const denom = axis.kind === 'value' ? s.filled : s.assessed;
    return (
      <>
        <Bar>{axis.rungs.map((r, i) => <Seg key={r.key} $pct={pct(s.counts[i], denom) || 0} $color={colorFor(i, axis.rungs.length)} />)}</Bar>
        <Legend>{axis.rungs.map((r, i) => <span key={r.key}><i style={{ background: colorFor(i, axis.rungs.length) }} />{r.label} {s.counts[i]}</span>)}{s.unassessed > 0 && <span>미평가 {s.unassessed}</span>}</Legend>
      </>
    );
  }
  const defs = axis.kind === 'set' ? s.flags : (axis.base || []);
  return (
    <>
      <Strip>{defs.map(f => { const p = s.adoption[f.key]; return <Cellet key={f.key} $color={shade(p)} $dark={dark(shade(p))} title={`${f.label} ${p ?? 0}%`}>{f.short || f.label.slice(0, 2)} {p ?? 0}%</Cellet>; })}</Strip>
      <Legend>항목별 적용률 — 연계 {s.assessed}개 기준{s.unassessed > 0 && <span>· 미평가 {s.unassessed}</span>}</Legend>
    </>
  );
};

const DivisionSummary = ({ board, subjects, axes, onOpenPair }) => {
  const s = divisionSummary({ subjects }, axes);
  const pairs = subjects.flatMap(sub => (sub.pairs || []).map(p => ({ ...p, subject_name: sub.name })));
  return (
    <Grid>
      {axes.map(axis => {
        const scored = pairs.map(p => ({ p, ...scoreOf(axis, p) }));
        const top = scored.filter(x => x.score >= 0).sort((a, b) => b.score - a.score).slice(0, 6);
        const weak = scored.filter(x => x.score < 0 || x.stale).concat(scored.filter(x => x.score >= 0 && !x.stale).sort((a, b) => a.score - b.score)).slice(0, 6);
        const key = (x) => `${x.p.subject_name} × ${x.p.agent?.name || ''}`;
        return (
          <Panel key={axis.key} aria-label={axis.label}>
            <Head><h4>{axis.label}</h4><span>{axis.question}</span></Head>
            <Headline axis={axis} s={s.axes[axis.key]} />
            <Distribution axis={axis} s={s.axes[axis.key]} />
            <Two>
              <List>
                <h5>앞선 연계</h5>
                {top.length === 0 && <Muted>아직 없음</Muted>}
                {top.map(x => <Item key={x.p.id} type="button" onClick={() => onOpenPair(x.p.id)} title={`${key(x)} — ${x.text}`}><b>{key(x)}</b><em>{x.text}</em></Item>)}
              </List>
              <List $weak>
                <h5>취약 연계</h5>
                {weak.length === 0 && <Muted>없음</Muted>}
                {weak.map(x => <Item key={x.p.id} type="button" $weak onClick={() => onOpenPair(x.p.id)} title={`${key(x)} — ${x.text}${x.stale ? ' · 재평가 필요' : ''}`}><b>{key(x)}</b><em>{x.stale ? `${x.text} · 재평가 필요` : x.text}</em></Item>)}
              </List>
            </Two>
          </Panel>
        );
      })}
      <Panel aria-label="전체">
        <Head><h4>전체</h4><span>연계 · 미평가 · 재평가 필요</span></Head>
        <Big>{s.pairs}<small>연계</small></Big>
        <Line>미평가 항목 {s.unassessed} · 재평가 필요 {s.stale} · 시험 항목 {subjects.length}{board?.stale_days ? ` · 재평가 기준 ${board.stale_days}일` : ''}</Line>
      </Panel>
    </Grid>
  );
};

export default DivisionSummary;
