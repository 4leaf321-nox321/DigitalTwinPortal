import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { ChevronRight } from 'lucide-react';
import maturityApi from '../../services/maturityApi';
import ChainFlow from './ChainFlow';

/**
 * 「계획」 — 성숙도 조사의 배경과 얼개. (2026-08-31)
 *
 * ⚠️ 이름이 「요약」이 아니다 — 성숙도 판에 이미 「요약」 모드가 있어
 *    같은 화면에 같은 이름의 단추가 둘이 된다(2026-08-31).
 *
 * ⚠️ **부문 선택과 무관한 한 페이지.** 부문 토글 맨 왼쪽에 있다.
 *
 * ⚠️ **단순하게.** 경영진이 한 번 훑는 자료다. 절은 넷뿐이고, 지표 15개의 상세는
 *    기본으로 접어 둔다 — 처음부터 펼쳐 두면 표가 세 장이라 아무도 안 읽는다.
 *        1 지금 문제   왜 조사하나 (그림 하나)
 *        2 이 조사     무엇을 바꾸나 (부문마다 한 줄)
 *        3 지표        접어 둔 상세
 *        4 전제        세 줄
 *
 * ⚠️ 현재 수준·달성도는 담지 않는다 — 성숙도 판이 이미 보여 준다.
 */

const Wrap = styled.div`
  flex: 1; min-height: 0; overflow: auto;
  display: flex; flex-direction: column; gap: 1.1rem; padding-bottom: 2rem;
  & > * { flex: 0 0 auto; }        /* 넘치면 카드를 누르지 말고 바깥이 흐른다 */
`;
const Card = styled.section`
  background: white; border: 1px solid #e2e8f0; border-radius: 0.75rem; overflow: hidden;
`;
const Head = styled.div`
  display: flex; align-items: baseline; gap: 0.6rem; flex-wrap: wrap;
  padding: 0.85rem 1.25rem; border-bottom: 1px solid #e2e8f0; background: #f8fafc;
  b { font-size: 0.88rem; font-weight: 800; color: #94a3b8; }
  h3 { margin: 0; font-size: 1.1rem; font-weight: 700; color: #0f172a; }
  small { font-size: 0.88rem; color: #64748b; }
`;
const Body = styled.div`padding: 1.15rem 1.25rem;`;

const Chip = styled.span`
  display: inline-block; padding: 0.22rem 0.6rem; margin: 0.12rem 0.25rem 0.12rem 0;
  border-radius: 0.35rem; font-size: 0.88rem; font-weight: 600;
  background: ${p => p.$bg}; color: ${p => p.$fg};
`;
/* 초안 배지 — 정의된 부문과 한 목록에 서므로 구분이 눈에 띄어야 한다 */
const Draft = styled.span`
  display: inline-block; padding: 0.1rem 0.45rem; border-radius: 999px;
  border: 1px dashed #cbd5e1; color: #94a3b8; font-size: 0.74rem; font-weight: 600;
`;
const Say = styled.p`
  margin: 0.9rem 0 0; padding-top: 0.8rem; border-top: 1px solid #f1f5f9;
  font-size: 0.95rem; color: #334155; line-height: 1.75;
  b { color: #0f172a; }
`;
/* 1절 — 문장 넷. 그림 대신 말로 짚는다(2026-08-31 요청). */
const Points = styled.ul`
  margin: 0; padding-left: 1.15rem;
  li { font-size: 1rem; color: #1e293b; line-height: 1.85; margin-bottom: 0.7rem; }
  li:last-child { margin-bottom: 0; }
  li b { color: #0f172a; }
  li em { font-style: normal; display: block; margin-top: 0.2rem;
          font-size: 0.9rem; color: #64748b; }
`;
/* 개발시간의 세 갈래 — 인건비만 세면 가장 작은 갈래만 보는 셈이다. */
const Branch = styled.div`
  display: grid; grid-template-columns: 8.5rem 1fr; gap: 0.6rem; align-items: baseline;
  padding: 0.4rem 0; border-top: 1px solid #f1f5f9;
  &:first-of-type { border-top: none; }
  b { font-size: 0.92rem; color: ${p => (p.$hi ? '#1e40af' : '#334155')}; }
  span { font-size: 0.9rem; color: #64748b; line-height: 1.65; }
  @media (max-width: 700px) { grid-template-columns: 1fr; gap: 0.15rem; }
`;

/* ── 3. 지표 — 기본은 접혀 있다 ────────────────────────────────────────── */
const Fold = styled.button`
  width: 100%; display: flex; align-items: center; gap: 0.5rem; cursor: pointer;
  border: none; border-top: 1px solid #f1f5f9; background: white; font-family: inherit;
  padding: 0.75rem 1.25rem; text-align: left; color: #0f172a; font-size: 0.98rem; font-weight: 700;
  &:first-child { border-top: none; }
  &:hover { background: #f8fafc; }
  small { margin-left: auto; font-weight: 500; font-size: 0.85rem; color: #94a3b8; }
  svg { transition: transform 0.15s; transform: rotate(${p => (p.$open ? 90 : 0)}deg); color: #94a3b8; }
`;
const Table = styled.table`
  width: 100%; border-collapse: collapse; font-size: 0.88rem;
  th, td { padding: 0.55rem 0.6rem; border-bottom: 1px solid #f1f5f9; text-align: left; vertical-align: top; }
  th { font-size: 0.78rem; color: #64748b; font-weight: 700; background: #f8fafc; white-space: nowrap; }
  td.name { font-weight: 700; color: #0f172a; white-space: nowrap; }
  td.gate { white-space: nowrap; }
  td.chg { color: #1e293b; min-width: 11rem; }
`;
const Role = styled.span`
  display: inline-block; padding: 0.05rem 0.45rem; border-radius: 999px; margin-left: 0.35rem;
  font-size: 0.72rem; font-weight: 700; background: ${p => p.$bg}; color: ${p => p.$fg};
`;
const Gate = styled.span`
  display: inline-block; padding: 0.08rem 0.5rem; border-radius: 0.3rem;
  background: #1e3a8a; color: white; font-size: 0.78rem; font-weight: 700;
`;
const Slot = styled.span`
  display: inline-block; padding: 0.05rem 0.45rem; margin: 0.08rem 0.2rem 0.08rem 0;
  border: 1px dashed #cbd5e1; border-radius: 0.3rem; background: #f8fafc;
  color: #94a3b8; font-size: 0.78rem;
`;
const Why = styled.tr`
  td { padding: 0 0.6rem 0.7rem; border-bottom: 1px solid #e2e8f0;
       font-size: 0.83rem; color: #64748b; line-height: 1.6; }
  td b { color: #475569; }
`;
const Caveats = styled.ul`
  margin: 0; padding-left: 1.1rem;
  li { font-size: 0.92rem; color: #475569; line-height: 1.75; margin-bottom: 0.3rem; }
  li:last-child { margin-bottom: 0; }
  li strong { color: #0f172a; }
`;
const Muted = styled.div`padding: 3rem; text-align: center; color: #94a3b8; font-size: 1rem;`;

const ROLE_C = {
  prereq: { bg: '#fef3c7', fg: '#92400e' },
  driver: { bg: '#dbeafe', fg: '#1e40af' },
  multiplier: { bg: '#ede9fe', fg: '#5b21b6' },
};
const K_BG = t => (t === 'derived' ? '#fef3c7' : '#e0e7ff');
const K_FG = t => (t === 'derived' ? '#92400e' : '#3730a3');

/** 굵게(**…**)만 살려서 그린다 — 문구를 데이터에 두기 위한 최소 규칙. */
const bold = (s) => String(s).split(/\*\*(.+?)\*\*/g)
  .map((x, i) => (i % 2 ? <strong key={i}>{x}</strong> : x));

const OverviewView = () => {
  const [fw, setFw] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null);      // 펼친 부문 — 기본은 전부 접힘

  useEffect(() => {
    let alive = true;
    maturityApi.getOverview()
      .then(r => { if (alive) setFw(r.data); })
      .catch(e => { if (alive) setError(e.message); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, []);

  if (busy) return <Muted>불러오는 중</Muted>;
  if (error) return <Muted>{error}</Muted>;
  if (!fw?.sectors?.length) return <Muted>측정 체계가 아직 정의되지 않았습니다.</Muted>;

  const drafts = (fw.draft_sectors || []).map(d => ({ ...d, draft: true }));
  const nInd = fw.sectors.reduce((n, s) => n + s.indicators.length, 0);
  const nDraft = drafts.reduce((n, s) => n + s.indicators.length, 0);
  const nResult = (fw.kpis || []).filter(k => k.tier === 'result').length;
  // 개발시간 — 값어치가 세 갈래로 갈리는 유일한 성과다(1절이 그걸 적는다).
  const devTime = fw.outcomes.find(o => (o.branches || []).length);

  return (
    <Wrap>
      {/* 1. 지금 문제 */}
      <Card>
        <Head><b>1</b><h3>지금 문제</h3><small>단일 지표에 의한 역량 대변</small></Head>
        <Body>
          <Points>
            <li>
              <b>가상검증률은 시뮬레이션별 「정확도」의 평균.</b> 데이터 연결율 역시
              제조 「기본 계측」의 집계. 즉 현행 역량은 사실상 <b>지표 하나</b>로 대변되는 구조.
            </li>
            <li>
              자동화·시험 대체 범위·재현 범위는 <b>현행 체계에 미반영.</b>
              <em>「가상검증률 상승에도 시험 리드타임 정체」의 원인 설명 불가.</em>
            </li>
            <li>
              해당 지표가 <b>어느 비용에 닿는지도 미정의.</b>
              <em>역량 지표 1개로 성과형 KPI {nResult}개를 설명하는 구조.</em>
            </li>
            <li>
              현행 성과 넷은 전부 <b>비용 절감</b> — 매출·사업 확대 측면의 성과는
              <b> 정의 자체가 부재.</b>
              <em>비용 절감만 집계할 경우 디지털 트윈 가치의 절반만 가시화 — 본 조사에서
              제품 경쟁력·신사업·설비 투자 절감 셋을 성과 후보로 제안(대응 KPI 미정의).</em>
            </li>
          </Points>
          {devTime?.branches && (
            <div style={{ marginTop: '1.1rem', paddingTop: '0.9rem', borderTop: '1px solid #f1f5f9' }}>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', color: '#0f172a', fontWeight: 700 }}>
                「개발시간 단축」의 가치 — 세 갈래
              </p>
              {devTime.branches.map(b => (
                <Branch key={b.label} $hi={!!b.to}>
                  <b>{b.label}</b><span>{b.note}</span>
                </Branch>
              ))}
              <p style={{ margin: '0.6rem 0 0', fontSize: '0.9rem', color: '#64748b', lineHeight: 1.7 }}>
                현행 집계 범위는 첫째 갈래에 한정. 셋째 갈래가 <b>사업 확대로의 연결 고리</b> —
                기간 단축은 원가가 아닌 <b>재원</b>.
              </p>
            </div>
          )}
        </Body>
      </Card>

      {/* 2. 이 조사 */}
      <Card>
        <Head><b>2</b><h3>이 조사</h3>
          <small>정의 부문 {fw.sectors.length} · 지표 {nInd}개 &nbsp;|&nbsp; 초안 부문 {drafts.length} · 지표 {nDraft}개 — 업무·KPI·성과에 각각 연결</small></Head>
        <Body>
          <ChainFlow sectors={fw.sectors} kpis={fw.kpis} outcomes={fw.outcomes}
                     drafts={fw.draft_sectors || []} chain={fw.value_chain || {}} />
          <Say>
            단일 지표에 뭉쳐 있던 역량을 <b>여러 지표로 분해하고 각각을 업무·KPI·성과에 연결.</b>
            {' '}위·아래 띠는 <b>디지털 트윈 밖</b>의 개발·제조 업무 — 파란 선은 디지털 트윈이
            <b> 작용하는 업무</b>, 점 선은 업무 자체가 KPI 를 미는 <b>디지털 트윈 외 경로.</b>
            {' '}점선은 <b>대응 KPI 미정의</b> — 측정 불가.
          </Say>
          {/* 초안 부문 — 순서도에 끊긴 테두리로 서 있다. 정의된 것과 구분해 적는다. */}
          <p style={{ margin: '0.9rem 0 0', fontSize: '0.88rem', color: '#64748b', lineHeight: 1.7 }}>
            <b style={{ color: '#334155' }}>초안으로 세운 분야</b>(성숙도 축·수준 미정의) —
            {' '}{drafts.map(a => a.label).join(' · ') || '없음'}
          </p>
        </Body>
      </Card>

      {/* 3. 지표 — 기본은 접혀 있다 */}
      <Card>
        <Head><b>3</b><h3>지표</h3><small>부문 클릭 시 상세 표시 — 초안 부문 포함</small></Head>
        {[...fw.sectors, ...drafts].map(sec => (
          <React.Fragment key={sec.key}>
            <Fold type="button" $open={open === sec.key}
                  aria-expanded={open === sec.key}
                  onClick={() => setOpen(open === sec.key ? null : sec.key)}>
              <ChevronRight size={16} />
              {sec.label}
              {sec.draft && <Draft>초안</Draft>}
              <small>{sec.purpose}</small>
            </Fold>
            {open === sec.key && (
              <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
                <Table>
                  <thead>
                    <tr>
                      <th>지표</th><th>유효 수준</th><th>업무 변화</th><th>작용 업무</th>
                      <th>측정 지표</th><th>연계 KPI</th><th>기여 성과</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sec.indicators.map(ind => {
                      const c = ROLE_C[ind.role];
                      return (
                        <React.Fragment key={ind.axis}>
                          <tr>
                            <td className="name">
                              {ind.derived_label
                                ? `${ind.axis_label} (${ind.derived_label})` : ind.axis_label}
                              <Role $bg={c.bg} $fg={c.fg} title={fw.roles[ind.role].definition}>
                                {ind.role_label}
                              </Role>
                            </td>
                            <td className="gate">
                              {ind.level_label
                                ? <Gate title={(ind.levels || []).map(l => l.label).join(' → ')}>{ind.level_label}</Gate>
                                : <Slot>미정의</Slot>}
                            </td>
                            <td className="chg">{ind.change}</td>
                            <td>{(ind.acts_on || []).map(a => (
                              <Slot key={a.key} title={a.how}>{a.label}</Slot>))}</td>
                            <td>{ind.metric.map(m => <Slot key={m}>{m}</Slot>)}</td>
                            <td>{ind.kpi.map(k => (
                              <Chip key={k.key} $bg={K_BG(k.tier)} $fg={K_FG(k.tier)}>{k.label}</Chip>
                            ))}</td>
                            <td>
                              {/* ⚠️ 비용은 동인에만 — 전부에 달면 무엇이 비용을 움직이는지 안 보인다. */}
                              {ind.outcomes.map(o => (
                                <Chip key={o.key} $bg="#1e40af" $fg="white">{o.label}</Chip>))}
                              {/* 새로 짚는 성과 — KPI 를 건너뛰므로 회색으로 가른다. */}
                              {(ind.new_outcomes || []).map(o => (
                                <Chip key={o.key} $bg="#f1f5f9" $fg="#64748b"
                                      title="대응 KPI 미정의">{o.label}</Chip>))}
                              {!ind.outcomes.length && !(ind.new_outcomes || []).length
                                && <Slot>간접</Slot>}
                            </td>
                          </tr>
                          <Why>
                            <td colSpan={7}>
                              <b>조사 목적</b> — {ind.why}
                              {ind.gate_why
                                ? <> &nbsp;·&nbsp; <b>유효 수준 「{ind.level_label}」 근거</b> — {ind.gate_why}</>
                                : <> &nbsp;·&nbsp; <b>초안</b> — 성숙도 축·수준 미정의</>}
                            </td>
                          </Why>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            )}
          </React.Fragment>
        ))}
      </Card>

      {/* 4. 전제 */}
      <Card>
        <Head><b>4</b><h3>전제</h3></Head>
        <Body><Caveats>{fw.caveats.map(c => <li key={c}>{bold(c)}</li>)}</Caveats></Body>
      </Card>
    </Wrap>
  );
};

export default OverviewView;
