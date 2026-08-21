/**
 * 관계도 AI 에이전트 패널 — 우측 380px.
 *
 * 새 화면도 모달도 만들지 않는다. **분석의 근거가 그래프 위 강조**이므로
 * 그래프가 가려지면 기능이 죽는다(계획서 §3).
 *
 * 화면이 지키는 두 가지
 *
 *   ① **숫자를 먼저 그리고 문장을 나중에 붙인다.**
 *      분석 GET 은 LLM 을 안 타서 빠르다. 서술은 그 뒤에 따로 붙는다 —
 *      LLM 이 느려도 화면이 멈추지 않고, **죽어도 숫자는 남는다.**
 *
 *   ② **단계·항목을 누르면 그래프가 그 집합만 남긴다.**
 *      이것이 「Agent Reasoning Graph」다. 두 번째 그림을 그리는 대신
 *      이미 있는 하이라이트를 재사용한다.
 *
 * 맨 아래 **신뢰도 한 줄**은 지우지 말 것 — 빈칸을 모르고 낸 결론은 자신 있게
 * 틀린다. PMO 도구에서 그 한 줄이 신뢰를 만든다(계획서 §1-③).
 */
import React from 'react';
import styled from 'styled-components';
import {
  AlertTriangle, ArrowLeft, ChevronRight, Info, Loader2, Sparkles,
} from 'lucide-react';

import Markdown from '../../../../shared/components/Markdown';

const AgentPanel = ({
  analysis,          // 서버가 준 분석 결과 그대로
  loading,
  error,
  narrative,         // {narrative, error} — 늦게 온다
  narrating,
  activeStep,        // 지금 강조 중인 단계 key
  onPickRefs,        // (key, refs[]) — 그래프 강조를 바꾼다
  onOpenKpi,         // 위험 지표에서 KPI 브리핑으로 파고들기
  onBack,
}) => {
  const cov = analysis?.coverage;

  return (
    <Wrap>
      <Head>
        <BackBtn onClick={onBack} title="범례로 돌아가기"><ArrowLeft size={14} /></BackBtn>
        <HeadText>
          <Sparkles size={13} />
          {analysis?.title || 'AI 분석'}
        </HeadText>
      </Head>

      {loading && <Center><Loader2 size={16} className="spin" />분석 중…</Center>}
      {error && <Warn><AlertTriangle size={14} />{error}</Warn>}

      {!loading && analysis && (
        <Body>
          {analysis.subtitle && <Sub>{analysis.subtitle}</Sub>}
          <Headline>{analysis.headline}</Headline>

          {/*
            서술을 **헤드라인 바로 아래**에 둔다.

            ⚠️ 예전에는 목록ㆍ단계를 전부 지나 맨 아래에 있었다. 가장 작은 글씨로
               가장 밑에 있으니 아무도 거기까지 안 내려갔다 — AI 가 「무엇이
               걸리는가」를 이미 쓰고 있는데 읽히지 않았다(2026-08-21 신고).

            ⚠️ 그린다고 **숫자보다 먼저 오는 것은 아니다.** 분석 GET 은 LLM 을 안
               타서 빨리 오고, 서술은 그 뒤에 따로 온다. 자리만 위일 뿐 여전히
               「숫자 먼저, 문장 나중」이고, 서술이 죽어도 아래 숫자는 그대로다.

            자리를 미리 잡아 둔다(비어 있어도 칸을 남긴다) — 늦게 온 문장이
            아래 목록을 밀어 내리면 읽던 자리를 잃는다.
          */}
          {(narrating || narrative?.narrative || narrative?.error) && (
            <Narrative>
              {narrating && <Muted><Loader2 size={12} className="spin" />읽어 보는 중…</Muted>}
              {!narrating && narrative?.narrative && <Markdown text={narrative.narrative} />}
              {!narrating && !narrative?.narrative && narrative?.error && (
                <Muted>
                  <Info size={12} />
                  서술은 못 만들었습니다 — 아래 숫자는 서버가 계산한 값 그대로입니다.
                  <em>{narrative.error}</em>
                </Muted>
              )}
            </Narrative>
          )}


          {/* ── 1단계: KPI 브리핑의 단계들 ── */}
          {analysis.kind === 'kpi' && (
            <>
              <Steps>
                {analysis.steps.map((s, i) => (
                  <Step
                    key={s.key}
                    $on={activeStep === s.key}
                    $warn={s.warn && s.count > 0}
                    onClick={() => onPickRefs(s.key, s.refs)}
                    title="그래프에서 이것만 보기"
                  >
                    <StepNo>{i + 1}</StepNo>
                    <StepLabel>{s.label}</StepLabel>
                    <StepCount>{s.count}</StepCount>
                    <ChevronRight size={12} />
                  </Step>
                ))}
              </Steps>

              {analysis.priority?.length > 0 && (
                <Block>
                  <BlockTitle>우선 볼 과제</BlockTitle>
                  {analysis.priority.map(p => (
                    <Row key={p.ref} onClick={() => onPickRefs(`p:${p.ref}`, [p.ref])}>
                      <RowMain>{p.code ? `${p.code} ` : ''}{p.title}</RowMain>
                      <RowSub>{p.reasons.join(' · ')}</RowSub>
                    </Row>
                  ))}
                </Block>
              )}

              {analysis.overdueActions?.length > 0 && (
                <Block>
                  <BlockTitle>목표일이 지난 액션</BlockTitle>
                  {analysis.overdueActions.slice(0, 6).map((a, i) => (
                    <Row key={i} onClick={() => onPickRefs(`a:${i}`,
                      [a.ref, a.projectRef].filter(Boolean))}>
                      <RowMain>{a.title || '(제목 없음)'}</RowMain>
                      <RowSub>{a.projectCode} · 목표 {a.dueDate}</RowSub>
                    </Row>
                  ))}
                </Block>
              )}

              {analysis.bottleneck?.length > 0 && (
                <Block>
                  <BlockTitle>미완료가 몰린 담당자</BlockTitle>
                  {analysis.bottleneck.map(b => (
                    <Row key={b.ref} onClick={() => onPickRefs(`b:${b.ref}`, [b.ref])}>
                      <RowMain>{b.name}</RowMain>
                      <RowSub>미완료 {b.openActions}건 (중앙값 {b.median})</RowSub>
                    </Row>
                  ))}
                </Block>
              )}
            </>
          )}

          {/* ── 단계형 분석: 멈춘 과제 · 이슈 적체 ── */}
          {['stalled', 'issues'].includes(analysis.kind) && (
            <Steps>
              {analysis.steps.map(s => (
                <Step
                  key={s.key}
                  $on={activeStep === s.key}
                  $warn={s.warn && s.count > 0}
                  $muted={s.count === 0}
                  onClick={() => s.count > 0 && onPickRefs(s.key, s.refs)}
                >
                  <StepLabel>{s.label}</StepLabel>
                  <StepCount>{s.count}</StepCount>
                  {s.count > 0 && <ChevronRight size={12} />}
                </Step>
              ))}
            </Steps>
          )}

          {/*
            지난주 대비. **견줄 수 없으면 숫자를 안 낸다** — 그때 이력이 없었으면
            「0건이었다」가 아니라 모르는 것이다. 0 으로 적으면 없던 증가가 생긴다.
          */}
          {analysis.trend && (
            analysis.trend.unavailable ? (
              <TrendNote>
                지난 {analysis.trend.days}일 전과는 견줄 수 없습니다 — {analysis.trend.unavailable}
              </TrendNote>
            ) : (
              <TrendRow>
                <TrendLabel>지난주 대비</TrendLabel>
                <TrendItem $delta={analysis.trend.deltaStalled}>
                  멈춤 {analysis.trend.prevStalled} → {analysis.trend.prevStalled + analysis.trend.deltaStalled}
                  <b>{analysis.trend.deltaStalled > 0 ? `+${analysis.trend.deltaStalled}`
                     : analysis.trend.deltaStalled < 0 ? analysis.trend.deltaStalled : '변화 없음'}</b>
                </TrendItem>
                <TrendItem $delta={analysis.trend.deltaRegressed}>
                  내려감 {analysis.trend.prevRegressed} → {analysis.trend.prevRegressed + analysis.trend.deltaRegressed}
                  <b>{analysis.trend.deltaRegressed > 0 ? `+${analysis.trend.deltaRegressed}`
                     : analysis.trend.deltaRegressed < 0 ? analysis.trend.deltaRegressed : '변화 없음'}</b>
                </TrendItem>
              </TrendRow>
            )
          )}

          {analysis.kind === 'stalled' && analysis.stalled?.length > 0 && (
            <Block>
              <BlockTitle>가장 오래 멈춘 것</BlockTitle>
              {analysis.stalled.slice(0, 8).map(x => (
                <Row key={x.ref} onClick={() => onPickRefs(`s:${x.ref}`, [x.ref])}>
                  <RowMain>{x.code ? `${x.code} ` : ''}{x.title}</RowMain>
                  <RowSub>
                    {x.idleDays}일째 진행률 {x.progress}% · {x.status}
                  </RowSub>
                </Row>
              ))}
            </Block>
          )}

          {analysis.kind === 'issues' && analysis.stale?.length > 0 && (
            <Block>
              <BlockTitle>오래 남은 미해결 이슈</BlockTitle>
              {analysis.stale.slice(0, 8).map(x => (
                <Row key={x.ref} onClick={() => onPickRefs(`i:${x.ref}`, [x.ref])}>
                  <RowMain>{x.code ? `${x.code} ` : ''}{x.title}</RowMain>
                  <RowSub>미해결 {x.openIssues}건 · 가장 오래된 {x.oldest}</RowSub>
                </Row>
              ))}
            </Block>
          )}

          {/* ── 일정 쏠림 ── */}
          {analysis.kind === 'schedule' && (
            <>
              {analysis.months?.length > 0 && (
                <Block>
                  <BlockTitle>미완료 액션의 목표월</BlockTitle>
                  <Bars>
                    {analysis.months.map(m => {
                      const max = Math.max(...analysis.months.map(x => x.count), 1);
                      return (
                        <BarRow key={m.month}>
                          <BarLabel>{m.month.slice(2)}</BarLabel>
                          <BarTrack><BarFill style={{ width: `${(m.count / max) * 100}%` }} /></BarTrack>
                          <BarNum>{m.count}</BarNum>
                        </BarRow>
                      );
                    })}
                  </Bars>
                </Block>
              )}
              <Block>
                <BlockTitle>한 달에 몰린 과제</BlockTitle>
                {analysis.items.map(x => (
                  <Row key={x.ref} $on={activeStep === `c:${x.ref}`}
                       onClick={() => onPickRefs(`c:${x.ref}`, [x.ref])}>
                    <RowMain>
                      {x.code ? `${x.code} ` : ''}{x.title}
                      {x.overdueMonth && <Tag>이미 지남</Tag>}
                    </RowMain>
                    <RowSub>
                      미완료 {x.openTotal}건 중 {x.peakCount}건이 {x.peakMonth}
                      {' '}({x.share}%)
                    </RowSub>
                  </Row>
                ))}
              </Block>
            </>
          )}

          {/* ── 중점과제의 말과 실제 ── */}
          {analysis.kind === 'keyProjects' && (
            <Block>
              {analysis.stats && (
                <Note>
                  <Info size={12} />
                  중점 {analysis.stats.keyCount}개 · 평균 진행률{' '}
                  {analysis.stats.keyAvgProgress}% (그 외 {analysis.stats.otherAvgProgress}%)
                </Note>
              )}
              {analysis.items.map(x => (
                <Row key={x.ref} $on={activeStep === `k2:${x.ref}`}
                     onClick={() => onPickRefs(`k2:${x.ref}`, [x.ref])}>
                  <RowMain>{x.code ? `${x.code} ` : ''}{x.title}</RowMain>
                  <RowSub>{x.flags.join(' · ')}</RowSub>
                </Row>
              ))}
            </Block>
          )}

          {/* ── 0단계: 데이터 공백 · 보고 준비도 (같은 모양) ── */}
          {analysis.kind === 'readiness' && (
            <Steps>
              {analysis.gaps.map(g => (
                <Step
                  key={g.key}
                  $on={activeStep === g.key}
                  $warn={g.count > 0}
                  $muted={g.count === 0}
                  onClick={() => g.count > 0 && onPickRefs(g.key, g.refs)}
                  title={g.why}
                >
                  <StepLabel>{g.title}</StepLabel>
                  <StepCount>{g.count}</StepCount>
                  {g.count > 0 && <ChevronRight size={12} />}
                </Step>
              ))}
            </Steps>
          )}

          {analysis.kind === 'gaps' && (
            <Steps>
              {analysis.gaps.map(g => (
                <Step
                  key={g.key}
                  $on={activeStep === g.key}
                  $warn={g.count > 0}
                  $muted={g.count === 0}
                  onClick={() => g.count > 0 && onPickRefs(g.key, g.refs)}
                  title={g.why}
                >
                  <StepLabel>{g.title}</StepLabel>
                  <StepCount>{g.count}</StepCount>
                  {g.count > 0 && <ChevronRight size={12} />}
                </Step>
              ))}
            </Steps>
          )}

          {/* ── 3단계: 위험 지표 ── */}
          {analysis.kind === 'risky' && (
            <Block>
              {analysis.items.map(i => (
                <Row key={i.kpiDefinitionId}
                     $on={activeStep === `k:${i.kpiDefinitionId}`}
                     onClick={() => onPickRefs(`k:${i.kpiDefinitionId}`, i.refs)}>
                  <RowMain>{i.label}</RowMain>
                  <RowSub>
                    {i.worstAchievement != null && `최저 달성 ${i.worstAchievement}% · `}
                    미달 {i.missCells}칸 · 과제 {i.projectCount}개
                    {i.noProjects && ' · 미는 과제 없음'}
                  </RowSub>
                  <DrillBtn
                    onClick={(e) => { e.stopPropagation(); onOpenKpi(i.kpiDefinitionId); }}
                    title="이 지표를 한 장으로 분석"
                  >
                    분석 <ChevronRight size={11} />
                  </DrillBtn>
                </Row>
              ))}
            </Block>
          )}

          {/* ── 4단계: 숨은 연결 ── */}
          {analysis.kind === 'hidden' && (
            <Block>
              {analysis.items.map((x, i) => (
                <Row key={i} $on={activeStep === `h:${i}`}
                     onClick={() => onPickRefs(`h:${i}`, x.refs)}>
                  <RowMain>
                    {x.a.code || x.a.title} ↔ {x.b.code || x.b.title}
                    {x.crossDivision && <Tag>사업부 교차</Tag>}
                  </RowMain>
                  <RowSub>
                    {x.a.division} / {x.b.division} · 공통 고리 {x.viaCount}개
                  </RowSub>
                </Row>
              ))}
              {/* `note` 는 아래에서 한 번만 그린다 — 여기서도 그리면 두 번 나온다 */}
            </Block>
          )}

          {/* ── 사업부별 데이터 채움 ── */}
          {analysis.kind === 'divisions' && (
            <>
              {/*
                **일부러 뺀 것을 먼저 밝힌다.** 표만 보면 "왜 진행률이 없지" 하고
                각자 짐작하게 된다. 뺀 이유가 이 표의 설계 그 자체다.
              */}
              {(analysis.excluded || []).map((e, i) => (
                <Excluded key={i}>
                  <Info size={12} />
                  <span><b>{e.label}</b> 는 넣지 않았습니다 — {e.why}</span>
                </Excluded>
              ))}

              <Block>
                {analysis.rows.map(r => (
                  <DivRow key={r.division} $on={activeStep === `d:${r.division}`}>
                    <DivHead onClick={() => onPickRefs(`d:${r.division}`, r.refs)}>
                      <RowMain>
                        {r.division}
                        {r.isFunctional && <Tag>기능조직</Tag>}
                        {r.smallSample && <Tag $warn>표본 작음</Tag>}
                      </RowMain>
                      <DivFill>{r.fillRate}%</DivFill>
                    </DivHead>
                    <RowSub>과제 {r.projectCount}개 · 안 채운 항목 {r.todo}건</RowSub>
                    <Cells>
                      {analysis.metrics.map(m => {
                        const c = r.cells[m.key];
                        if (!c || c.total === 0) return null;
                        return (
                          <Cell
                            key={m.key}
                            title={`${m.label} — ${m.why}`}
                            $on={activeStep === `d:${r.division}:${m.key}`}
                            $bad={c.rate != null && c.rate < 60}
                            onClick={(e) => {
                              e.stopPropagation();
                              onPickRefs(`d:${r.division}:${m.key}`, c.refs);
                            }}
                          >
                            <CellLabel>{m.label}</CellLabel>
                            {/* 비율만 보이면 3/4 와 12/16 이 같아 보인다 —
                                손이 가는 일의 양은 네 배 다르다. 건수를 같이 쓴다. */}
                            <CellVal>{c.filled}/{c.total}</CellVal>
                          </Cell>
                        );
                      })}
                    </Cells>
                  </DivRow>
                ))}
              </Block>
            </>
          )}

          {/* 판단할 수 없어 뺀 것 · 읽는 법. 조용히 빼면 "문제 없음" 으로 읽힌다. */}
          {analysis.note && <Note><Info size={12} />{analysis.note}</Note>}
          {analysis.hint && (
            <Note><Info size={12} /><Markdown text={analysis.hint} /></Note>
          )}

          {/* ── 신뢰도: 답보다 먼저 말해야 하는 것 ── */}
          {cov && (
            <Coverage $warn={cov.peopleReliable === false}>
              <Info size={12} />
              <span>
                과제 {cov.projectCount}개 기준
                {cov.memberLinkRate != null && ` · 참여인력 계정 연결 ${cov.memberLinkRate}%`}
                {(cov.notes || []).map((n, i) => <em key={i}>{n}</em>)}
              </span>
            </Coverage>
          )}
        </Body>
      )}
    </Wrap>
  );
};

/* ── 스타일 ── */

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  overflow: hidden;
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.625rem;
  border-bottom: 1px solid #f1f5f9;
  background: #f8fafc;
  flex-shrink: 0;
`;

const BackBtn = styled.button`
  display: flex;
  padding: 3px;
  border: none;
  background: none;
  color: #64748b;
  cursor: pointer;
  border-radius: 4px;
  &:hover { background: #e2e8f0; color: #1e293b; }
`;

const HeadText = styled.div`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8125rem;
  font-weight: 700;
  color: #1e293b;
  min-width: 0;
  word-break: break-word;
`;

const Body = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.625rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
`;

const Sub = styled.div`
  font-size: 0.7rem;
  color: #94a3b8;
  margin-top: -0.25rem;
`;

const Headline = styled.div`
  font-size: 0.8125rem;
  font-weight: 600;
  color: #1e293b;
  line-height: 1.5;
`;

const Steps = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
`;

const Step = styled.button`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  padding: 0.4rem 0.5rem;
  font-size: 0.75rem;
  text-align: left;
  border-radius: 0.375rem;
  cursor: ${p => (p.$muted ? 'default' : 'pointer')};
  border: 1px solid ${p => (p.$on ? '#6366f1' : 'transparent')};
  background: ${p => {
    if (p.$on) return '#eef2ff';
    if (p.$muted) return 'transparent';
    return '#f8fafc';
  }};
  color: ${p => (p.$muted ? '#cbd5e1' : '#1e293b')};

  &:hover { background: ${p => (p.$muted ? 'transparent' : '#eef2ff')}; }
`;

const StepNo = styled.span`
  width: 15px;
  height: 15px;
  flex-shrink: 0;
  border-radius: 50%;
  background: #e2e8f0;
  color: #475569;
  font-size: 0.6rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const StepLabel = styled.span`
  flex: 1;
  min-width: 0;
`;

const StepCount = styled.span`
  font-weight: 700;
  font-variant-numeric: tabular-nums;
`;

const Block = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
`;

const BlockTitle = styled.div`
  font-size: 0.7rem;
  font-weight: 700;
  color: #64748b;
  margin-bottom: 0.1rem;
`;

const Row = styled.div`
  position: relative;
  padding: 0.35rem 0.5rem;
  border-radius: 0.375rem;
  cursor: pointer;
  border: 1px solid ${p => (p.$on ? '#6366f1' : '#f1f5f9')};
  background: ${p => (p.$on ? '#eef2ff' : 'white')};

  &:hover { background: #f8fafc; }
`;

const RowMain = styled.div`
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-wrap: wrap;
  font-size: 0.75rem;
  color: #1e293b;
  word-break: break-word;
`;

const RowSub = styled.div`
  font-size: 0.68rem;
  color: #94a3b8;
  margin-top: 1px;
`;

const Tag = styled.span`
  font-size: 0.6rem;
  font-weight: 700;
  color: ${p => (p.$warn ? '#92400e' : '#0e7490')};
  background: ${p => (p.$warn ? '#fef3c7' : '#cffafe')};
  border-radius: 3px;
  padding: 0 4px;
`;

const DrillBtn = styled.button`
  position: absolute;
  right: 4px;
  top: 4px;
  display: flex;
  align-items: center;
  gap: 1px;
  font-size: 0.65rem;
  font-weight: 600;
  color: #4f46e5;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  border-radius: 0.25rem;
  padding: 1px 4px;
  cursor: pointer;

  &:hover { background: #e0e7ff; }
`;

/* 사업부별 채움 — 순위표가 아니라 "어디부터 손댈지" 를 보는 표다. */
const DivRow = styled.div`
  padding: 0.4rem 0.5rem;
  border-radius: 0.375rem;
  border: 1px solid ${p => (p.$on ? '#6366f1' : '#f1f5f9')};
  background: ${p => (p.$on ? '#eef2ff' : 'white')};
  margin-bottom: 0.2rem;
`;

const DivHead = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
`;

const DivFill = styled.span`
  margin-left: auto;
  font-size: 0.8rem;
  font-weight: 700;
  color: #1e293b;
  font-variant-numeric: tabular-nums;
`;

const Cells = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem;
  margin-top: 0.3rem;
`;

const Cell = styled.button`
  display: flex;
  align-items: baseline;
  gap: 0.2rem;
  padding: 1px 5px;
  font-size: 0.64rem;
  border-radius: 0.25rem;
  cursor: pointer;
  border: 1px solid ${p => {
    if (p.$on) return '#6366f1';
    return p.$bad ? '#fcd34d' : '#e2e8f0';
  }};
  background: ${p => {
    if (p.$on) return '#e0e7ff';
    return p.$bad ? '#fffbeb' : '#f8fafc';
  }};
  color: ${p => (p.$bad ? '#92400e' : '#475569')};

  &:hover { border-color: #6366f1; }
`;

const CellLabel = styled.span``;

const CellVal = styled.span`
  font-weight: 700;
  font-variant-numeric: tabular-nums;
`;

const Excluded = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  padding: 0.4rem 0.5rem;
  font-size: 0.68rem;
  line-height: 1.5;
  color: #475569;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 0.375rem;

  svg { flex-shrink: 0; margin-top: 2px; }
  b { color: #1e293b; }
`;

/* 목표월 분포 — 작은 막대. 차트 라이브러리를 쓸 만큼의 것이 아니다. */
const Bars = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const BarRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.66rem;
  color: #64748b;
`;

const BarLabel = styled.span`
  width: 2.6rem;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
`;

const BarTrack = styled.span`
  flex: 1;
  height: 7px;
  background: #f1f5f9;
  border-radius: 3px;
  overflow: hidden;
`;

const BarFill = styled.span`
  display: block;
  height: 100%;
  background: #818cf8;
`;

const BarNum = styled.span`
  width: 1.8rem;
  text-align: right;
  font-variant-numeric: tabular-nums;
`;

/*
  지난주 대비. **늘어난 것이 붉고 줄어든 것이 푸르다** — 여기서는 「멈춘 과제」와
  「진행률이 내려간 과제」라, 느는 것이 나쁜 쪽이다.

  ⚠️ 다른 분석에 붙일 때는 방향을 다시 볼 것. 「완료」처럼 느는 것이 좋은
     수치에 그대로 쓰면 색이 거꾸로 된다.
*/
const TrendRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  font-size: 0.72rem;
`;

const TrendLabel = styled.span`
  color: #94a3b8;
  font-weight: 600;
`;

const TrendItem = styled.span`
  display: inline-flex;
  align-items: baseline;
  gap: 0.25rem;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  background: ${p => (p.$delta > 0 ? '#fef2f2' : p.$delta < 0 ? '#ecfdf5' : '#f1f5f9')};
  color: ${p => (p.$delta > 0 ? '#b91c1c' : p.$delta < 0 ? '#047857' : '#64748b')};

  b { font-weight: 700; }
`;

const TrendNote = styled.div`
  font-size: 0.7rem;
  color: #94a3b8;
  line-height: 1.5;
`;

const Narrative = styled.div`
  padding: 0.5rem 0.7rem;
  background: #f5f3ff;
  border-left: 3px solid #8b5cf6;
  border-radius: 0 0.5rem 0.5rem 0;
  /* 헤드라인과 같은 크기다. 아래 목록보다 작으면 또 안 읽힌다. */
  font-size: 0.8125rem;
  color: #312e81;
  line-height: 1.7;
  min-height: 1.7em;

  p { margin: 0; }
  strong { color: #5b21b6; }
`;

const Coverage = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  font-size: 0.68rem;
  line-height: 1.5;
  color: ${p => (p.$warn ? '#92400e' : '#94a3b8')};
  background: ${p => (p.$warn ? '#fffbeb' : 'transparent')};
  border-radius: 0.375rem;
  padding: ${p => (p.$warn ? '0.35rem 0.5rem' : '0')};

  svg { flex-shrink: 0; margin-top: 2px; }
  em { display: block; font-style: normal; margin-top: 2px; }
`;

const Muted = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.3rem;
  font-size: 0.7rem;
  color: #94a3b8;

  svg { flex-shrink: 0; margin-top: 2px; }
  em { display: block; font-style: normal; opacity: 0.8; margin-top: 2px; }
  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

const Center = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 1.5rem;
  font-size: 0.8rem;
  color: #64748b;

  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

const Warn = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  margin: 0.625rem;
  padding: 0.5rem 0.625rem;
  font-size: 0.75rem;
  border-radius: 0.5rem;
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fcd34d;
`;

const Note = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.3rem;
  margin-top: 0.25rem;
  font-size: 0.68rem;
  color: #94a3b8;
  line-height: 1.5;

  svg { flex-shrink: 0; margin-top: 2px; }
`;

export default AgentPanel;
