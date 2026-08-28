import React from 'react';
import styled from 'styled-components';
import { colorFor, divisionSummary } from '../../utils/board';

// 전체 「요약」 — 사업부 × 축 표. 한 화면에 사업부 여섯이 들어가야 한다(2026-08-28).
//
// 축마다 대표 수치가 다르다 — 축이 다 순서형이 아니라서 「n단계 이상 %」 하나로 못 잰다.
//   정확도(값)     평균 % · 미검증 수                  + 세 영역 분포 막대
//   적용 범위(택1) 「신규 개발 전 모델」 이상 %          + 칸 분포 막대
//   자동화(묶음)   항목별 채택률 띠 (전처리·실행·후처리·보고·파이프라인)  + 평균 켠 수
//   시험 대체(묶음) 항목별 채택률 띠                     + 완전 대체 수
//   모델링(표)     시험 불량 재현률 · 시장 재현률        + 바탕(형상·거동) 채택률
// 행을 누르면 그 사업부 판으로 내려간다.

const Wrap = styled.div`overflow: auto;`;
const Table = styled.table`
  width: 100%; border-collapse: separate; border-spacing: 0; font-size: 0.8125rem;
  th { text-align: left; position: sticky; top: 0; background: white; z-index: 1; font-size: 0.6875rem; font-weight: 700; color: #64748b; padding: 0.35rem 0.6rem; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
  td { padding: 0.55rem 0.6rem; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
`;
const ThDiv = styled.th`cursor: pointer; font-size: 0.875rem !important; color: #1e293b !important; &:hover { color: #1d4ed8 !important; text-decoration: underline; }`;
const Name = styled.td`font-weight: 700; color: #1e293b; white-space: nowrap; vertical-align: top !important;`;
const Big = styled.div`font-size: 1rem; font-weight: 700; color: #1e293b; line-height: 1.1;`;
const Small = styled.div`font-size: 0.6875rem; color: #64748b; margin-top: 0.15rem; white-space: nowrap;`;
const Bar = styled.div`display: flex; height: 0.45rem; border-radius: 999px; overflow: hidden; background: #f1f5f9; margin-top: 0.3rem; min-width: 7rem;`;
const Seg = styled.div`width: ${p => p.$pct}%; background: ${p => p.$color};`;
const Strip = styled.div`display: flex; gap: 2px; margin-top: 0.3rem;`;
const Cellet = styled.div`
  flex: 1 1 0; height: 0.9rem; border-radius: 2px; min-width: 1.1rem; font-size: 0.5625rem; line-height: 0.9rem; text-align: center; overflow: hidden;
  background: ${p => p.$color}; color: ${p => (p.$dark ? 'white' : '#1e293b')};
`;
const Pill = styled.span`
  display: inline-block; margin-left: 0.3rem; padding: 0 0.4rem; border-radius: 999px; font-size: 0.625rem; font-weight: 600;
  background: ${p => (p.$warn ? '#fef3c7' : '#f1f5f9')}; color: ${p => (p.$warn ? '#92400e' : '#64748b')};
`;
const Muted = styled.td`color: #94a3b8; font-size: 0.75rem;`;

const pct = (n, d) => (d ? Math.round((n * 100) / d) : null);
const shade = (p) => (p == null ? '#e2e8f0' : p >= 75 ? '#1d4ed8' : p >= 50 ? '#3b82f6' : p >= 25 ? '#93c5fd' : '#dbeafe');
const dark = (c) => ['#3b82f6', '#1d4ed8', '#1e3a8a'].includes(c);

const AxisSummary = ({ axis, s }) => {
  if (!s || s.total === 0) return <Muted as="div">쌍 없음</Muted>;
  if (axis.kind === 'value') {
    return (
      <>
        <Big>{s.mean != null ? `${s.mean}%` : '—'}</Big>
        <Small>값 있음 {s.filled}/{s.total}{s.unassessed > 0 && <Pill $warn>미검증 {s.unassessed}</Pill>}</Small>
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
        <Small>평균 켠 수{full != null && <> · 완전 대체 {s.adoptionCount.full}</>}{s.unassessed > 0 && <Pill $warn>미평가 {s.unassessed}</Pill>}</Small>
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
        <Big>{s.testRate != null ? `${s.testRate}%` : '—'}<span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}> 시험 재현</span></Big>
        <Small>시장 재현 {s.marketRate != null ? `${s.marketRate}%` : '—'} · 유형 {s.defectTotal}{s.unassessed > 0 && <Pill $warn>미평가 {s.unassessed}</Pill>}</Small>
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
const OverviewGrid = ({ boards, axes, onPickDivision }) => {
  const sums = boards.map(b => divisionSummary(b, axes));
  return (
    <Wrap>
      <Table>
        <thead>
          <tr>
            <th style={{ width: '9rem' }}>축</th>
            {boards.map(b => (
              <ThDiv key={b.division_id} onClick={() => onPickDivision && onPickDivision(b.division_id)} title="누르면 이 사업부 판으로">{b.division_name}</ThDiv>
            ))}
          </tr>
        </thead>
        <tbody>
          {axes.map(a => (
            <tr key={a.key}>
              <Name>{a.label}<Small>{a.question}</Small></Name>
              {boards.map((b, i) => <td key={b.division_id}><AxisSummary axis={a} s={sums[i].axes[a.key]} /></td>)}
            </tr>
          ))}
          <tr>
            <Name>쌍 · 미평가 · 낡음</Name>
            {sums.map((s, i) => (
              <td key={boards[i].division_id}>
                <Big>{s.pairs}</Big>
                <Small>미평가 칸 {s.unassessed} · 낡음 {s.stale}</Small>
              </td>
            ))}
          </tr>
          {boards.length === 0 && <tr><Muted colSpan={2}>보이는 사업부가 없습니다 — 설정 「사업부 표시」를 확인하세요.</Muted></tr>}
        </tbody>
      </Table>
    </Wrap>
  );
};

export default OverviewGrid;
