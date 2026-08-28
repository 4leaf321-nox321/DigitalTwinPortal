import React, { useEffect, useState } from 'react';
import maturityApi from '../../services/maturityApi';
import styled from 'styled-components';
import { colorFor, divisionSummary } from '../../utils/board';

// 전체 「요약」 — 축 × 사업부 표(가로가 사업부). 한 화면에 사업부 여섯이 들어가야 하고, **세로로 화면을 채운다**(2026-08-28).
//
// 축마다 대표 수치가 다르다 — 축이 다 순서형이 아니라서 「n단계 이상 %」 하나로 못 잰다.
//   정확도(값)     평균 % · 미평가 수                  + 세 영역 분포 막대
//   적용 범위(택1) 「신규 개발 전 모델」 이상 %          + 칸 분포 막대
//   자동화(묶음)   항목별 채택률 띠 (전처리·실행·후처리·보고·파이프라인)  + 적용 단계 수 (평균)
//   시험 대체(묶음) 항목별 채택률 띠                     + 완전 대체 수
//   모델링(표)     시험 불량 재현률 · 시장 재현률        + 바탕(형상·거동) 채택률
// 사업부 머리를 누르면 그 사업부 판으로 내려간다.

// 남는 높이를 이 칸이 갖고 스크롤도 여기 걸린다. 표는 그 80% 만 — 아래 20% 는 비워 둔다.
const Wrap = styled.div`overflow: auto; flex: 1; min-height: 0;`;
const Table = styled.table`
  width: 100%; height: 100%; border-collapse: separate; border-spacing: 0; font-size: 0.9375rem;   /* 아래 남는 공간 없이 채운다(2026-08-28) */
  th { text-align: left; position: sticky; top: 0; background: white; z-index: 1; font-size: 0.8125rem; font-weight: 700; color: #64748b; padding: 0.5rem 0.9rem; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
  td { padding: 0.75rem 0.9rem; border-bottom: 1px solid #e2e8f0; vertical-align: middle; text-align: center; }   /* 값은 열 가운데 — 사업부끼리 세로로 비교된다(2026-08-28) */
`;
// 사업부 머리 — 색 헤더. 누르면 그 사업부 판으로(2026-08-28).
const ThDiv = styled.th`
  cursor: pointer; padding: 0 0.3rem 0.3rem !important; background: white !important; border-bottom: none !important;
  & > span { display: block; font-size: 1.05rem; color: white; background: #1d4ed8; text-align: center; border-radius: 0.4rem 0.4rem 0 0; padding: 0.5rem 0.6rem; }
  &:hover > span { background: #1e40af; text-decoration: underline; }
`;
const Name = styled.td`font-weight: 700; color: #1e293b; white-space: nowrap; font-size: 1rem; text-align: left !important;`;
const Big = styled.div`font-size: 1.75rem; font-weight: 700; color: #1e293b; line-height: 1.1;`;
const Small = styled.div`font-size: 0.8125rem; color: #64748b; margin-top: 0.3rem; white-space: nowrap;`;
const Bar = styled.div`display: flex; height: 0.7rem; border-radius: 999px; overflow: hidden; background: #f1f5f9; margin: 0.5rem auto 0; min-width: 7rem; max-width: 14rem;`;
const Seg = styled.div`width: ${p => p.$pct}%; background: ${p => p.$color};`;
const Strip = styled.div`display: flex; gap: 3px; margin-top: 0.5rem; justify-content: center;`;
const Cellet = styled.div`
  flex: 1 1 0; height: 1.4rem; border-radius: 3px; min-width: 1.6rem; font-size: 0.6875rem; font-weight: 600; line-height: 1.4rem; text-align: center; overflow: hidden;
  background: ${p => p.$color}; color: ${p => (p.$dark ? 'white' : '#1e293b')};
`;
const Pill = styled.span`
  display: inline-block; margin-left: 0.3rem; padding: 0 0.45rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600;
  background: ${p => (p.$warn ? '#fef3c7' : '#f1f5f9')}; color: ${p => (p.$warn ? '#92400e' : '#64748b')};
`;
const Muted = styled.td`color: #94a3b8; font-size: 0.75rem;`;
const SecHead = styled.td`
  background: #f8fafc !important; text-align: left !important; border-top: 2px solid #e2e8f0; padding: 0.4rem 0.9rem !important; font-size: 0.8125rem; color: #64748b;
  strong { color: #1e293b; font-size: 0.9375rem; margin-right: 0.5rem; }
  select { float: right; padding: 0.2rem 0.4rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; font-family: inherit; font-size: 0.8125rem; }
`;
// 맨 오른쪽 「전체」 — 작고 옅게, 사업부 열과 구분되게
const ThAll = styled.th`
  width: 11rem; padding: 0 0.3rem 0.3rem !important; background: white !important; border-bottom: none !important; border-left: 2px solid #e2e8f0;
  & > span { display: block; font-size: 1.05rem; color: white; background: #334155; text-align: center; border-radius: 0.4rem 0.4rem 0 0; padding: 0.5rem 0.6rem; }
`;
const TdAll = styled.td`border-left: 2px solid #e2e8f0; background: #fafafa;`;

const pct = (n, d) => (d ? Math.round((n * 100) / d) : null);
const shade = (p) => (p == null ? '#e2e8f0' : p >= 75 ? '#1d4ed8' : p >= 50 ? '#3b82f6' : p >= 25 ? '#93c5fd' : '#dbeafe');
const dark = (c) => ['#3b82f6', '#1d4ed8', '#1e3a8a'].includes(c);

const AxisSummary = ({ axis, s }) => {
  if (!s || s.total === 0) return <Muted as="div">연계 없음</Muted>;
  if (axis.kind === 'value') {
    return (
      <>
        <Big>{s.mean != null ? `${s.mean}%` : '—'}</Big>
        <Small>평가 완료 {s.filled}/{s.total}{s.unassessed > 0 && <Pill $warn>미평가 {s.unassessed}</Pill>}</Small>
        <Bar title={axis.rungs.map((r, i) => `${r.label} ${s.counts[i]}`).join(' · ')}>
          {axis.rungs.map((r, i) => <Seg key={r.key} $pct={pct(s.counts[i], s.filled) || 0} $color={colorFor(i, axis.rungs.length)} />)}
        </Bar>
      </>
    );
  }
  if (axis.kind === 'rung') {
    const k = Math.max(0, axis.rungs.length - 2);   // 「끝에서 두 번째 칸」 이상 — 적용 범위면 「신규 개발 전 모델」 이상
    return (
      <>
        <Big>{s.atLeast[k] != null ? `${s.atLeast[k]}%` : '—'}</Big>
        <Small>{axis.rungs[k]?.label} 이상{s.unassessed > 0 && <Pill $warn>미평가 {s.unassessed}</Pill>}</Small>
        <Bar title={axis.rungs.map((r, i) => `${r.label} ${s.counts[i]}`).join(' · ')}>
          {axis.rungs.map((r, i) => <Seg key={r.key} $pct={pct(s.counts[i], s.assessed) || 0} $color={colorFor(i, axis.rungs.length)} />)}
        </Bar>
      </>
    );
  }
  if (axis.kind === 'set') {
    const full = axis.implies?.full != null ? s.adoption.full : null;
    return (
      <>
        <Big>{s.avg != null ? `${s.avg}/${s.flags.length}` : '—'}</Big>
        <Small>적용 단계 수 (평균){full != null && <> · 완전 대체 {s.adoptionCount.full}</>}{s.unassessed > 0 && <Pill $warn>미평가 {s.unassessed}</Pill>}</Small>
        <Strip>
          {s.flags.map(f => {
            const p = s.adoption[f.key];
            return <Cellet key={f.key} $color={shade(p)} $dark={dark(shade(p))} title={`${f.label} ${p ?? 0}%`}>{f.short || f.label.slice(0, 2)}</Cellet>;
          })}
        </Strip>
      </>
    );
  }
  if (axis.kind === 'matrix') {
    return (
      <>
        <Big>{s.testRate != null ? `${s.testRate}%` : '—'}<span style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 500 }}> 시험 불량 재현</span></Big>
        <Small>시장 불량 재현 {s.marketRate != null ? `${s.marketRate}%` : '—'} · 불량 유형 {s.defectTotal}{s.unassessed > 0 && <Pill $warn>미평가 {s.unassessed}</Pill>}</Small>
        <Strip>
          {axis.base.map(b => {
            const p = s.adoption[b.key];
            return <Cellet key={b.key} $color={shade(p)} $dark={dark(shade(p))} title={`${b.label} ${p ?? 0}%`}>{b.label.slice(0, 2)}</Cellet>;
          })}
        </Strip>
      </>
    );
  }
  return null;
};

// 가로가 사업부, 세로가 축 — 한 축을 한 줄로 두고 사업부를 옆으로 늘어놓아야 「이 축에서 누가 앞서나」가 바로 읽힌다(2026-08-28).
// 해석 활용 기록 줄도 **같은 표**에 붙는다 — 표를 따로 두면 열 폭이 달라 사업부 열과 어긋난다. 맨 오른쪽은 「전체」(평균·누계).
const pctText = (v) => (v == null ? '—' : `${v}%`);

const OverviewGrid = ({ boards, axes, review, onPickDivision }) => {
  const sums = boards.map(b => divisionSummary(b, axes));
  const whole = divisionSummary({ subjects: boards.flatMap(b => b.subjects || []) }, axes);   // 전체 = 사업부를 합쳐 다시 센다
  const [year, setYear] = useState(new Date().getFullYear());
  const [years, setYears] = useState([]);
  const [rv, setRv] = useState(null);
  useEffect(() => { if (review) maturityApi.reviewYears('').then(r => setYears(r.data || [])).catch(() => {}); }, [review]);
  useEffect(() => {
    if (!review) return;
    maturityApi.reviewStats('all', year).then(r => setRv(r.data)).catch(() => setRv(null));
  }, [year, review]);
  const rvBy = Object.fromEntries((rv?.divisions || []).map(d => [d.division_id, d]));
  // 전체 열의 검토 셈 — 건수는 누계, 비율은 건수로 가중, 리드타임은 사업부 중앙값의 평균
  const rvWhole = (kind) => {
    const ss = boards.map(b => rvBy[b.division_id]?.kinds?.[kind]).filter(Boolean);
    const count = ss.reduce((n, x) => n + (x.count || 0), 0);
    const w = (k) => { const xs = ss.filter(x => x[k] != null && x.count); const d = xs.reduce((n, x) => n + x.count, 0); return d ? Math.round(xs.reduce((n, x) => n + x[k] * x.count, 0) / d) : null; };
    const leads = ss.map(x => x.lead_median).filter(v => v != null);
    return { count, early: w('early'), gate: w('gate'), confirmed: w('confirmed'), lead_median: leads.length ? Math.round((leads.reduce((a, b) => a + b, 0) / leads.length) * 10) / 10 : null,
      promote: ss.flatMap(x => x.promote || []) };
  };
  const rvCell = (s) => (
    <>
      <Big>{s?.count ?? 0}<span style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 500 }}> 건</span></Big>
      <Small>스펙 확정 전 이상 {pctText(s?.early)} · 관문 이상 {pctText(s?.gate)} · 검증됨 {pctText(s?.confirmed)}</Small>
      <Small>리드타임 {s?.lead_median != null ? `${s.lead_median}일` : '—'}{(s?.promote || []).length > 0 && <Pill title={s.promote.map(p => `${p.agent_name} × ${p.item} ${p.count}건`).join('\n')}>정착 후보 {s.promote.length}</Pill>}</Small>
    </>
  );
  return (
    <Wrap>
      <Table>
        <thead>
          <tr>
            <th style={{ width: '9rem' }}>축</th>
            {boards.map(b => (
              <ThDiv key={b.division_id} onClick={() => onPickDivision && onPickDivision(b.division_id)} title="누르면 이 사업부 판으로"><span>{b.division_name}</span></ThDiv>
            ))}
            <ThAll title="사업부를 합쳐 다시 센 것 — 평균·누계"><span>전체</span></ThAll>
          </tr>
        </thead>
        <tbody>
          {axes.map(a => (
            <tr key={a.key}>
              <Name>{a.label}<Small>{a.question}</Small></Name>
              {boards.map((b, i) => <td key={b.division_id}><AxisSummary axis={a} s={sums[i].axes[a.key]} /></td>)}
              <TdAll><AxisSummary axis={a} s={whole.axes[a.key]} /></TdAll>
            </tr>
          ))}
          <tr>
            <Name>연계 · 미평가 · 재평가 필요</Name>
            {sums.map((s, i) => (
              <td key={boards[i].division_id}>
                <Big>{s.pairs}</Big>
                <Small>미평가 항목 {s.unassessed} · 재평가 필요 {s.stale}</Small>
              </td>
            ))}
            <TdAll><Big>{whole.pairs}</Big><Small>미평가 항목 {whole.unassessed} · 재평가 필요 {whole.stale}</Small></TdAll>
          </tr>
          {review && (
            <>
              <tr>
                <SecHead colSpan={boards.length + 2}>
                  <strong>해석 활용 기록</strong>
                  <select value={year} onChange={e => setYear(Number(e.target.value))} aria-label="해석 활용 기록 연도">
                    {[...new Set([...years, new Date().getFullYear()])].sort((a, b) => b - a).map(y => <option key={y} value={y}>{y}년</option>)}
                  </select>
                </SecHead>
              </tr>
              {review.kinds.map(k => (
                <tr key={k.key}>
                  <Name>{k.label}<Small>{k.key === 'cause' ? '재현 · 원인 · 대책' : '스펙 확정 전 · 관문 · 검증'}</Small></Name>
                  {boards.map(b => <td key={b.division_id}>{rvCell(rvBy[b.division_id]?.kinds?.[k.key])}</td>)}
                  <TdAll>{rvCell(rvWhole(k.key))}</TdAll>
                </tr>
              ))}
            </>
          )}
          {boards.length === 0 && <tr><Muted colSpan={2}>보이는 사업부가 없습니다 — 설정 「사업부 표시」를 확인하세요.</Muted></tr>}
        </tbody>
      </Table>
    </Wrap>
  );
};

export default OverviewGrid;
