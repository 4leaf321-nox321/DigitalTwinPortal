import React, { useState } from 'react';
import styled from 'styled-components';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import ObservedMatrix from './ObservedMatrix';
import MetricDetail from './MetricDetail';
import KpiCoverage from './KpiCoverage';
import FindingsPanel from './FindingsPanel';
import PromoteCrux from './PromoteCrux';
import CruxPanel from './CruxPanel';
import SurveyEvidence from './SurveyEvidence';
import IntelEvidence from './IntelEvidence';
import SurveyVoices from './SurveyVoices';
import FlowMap from '../FlowMap';
import AssessmentGrid from '../Assessment/AssessmentView';

// ① 진단.
//
// 순서가 설계다. 사람에게 격자부터 채우게 하면 근거 없는 점수가 3점으로
// 수렴하고, 채우는 것 자체가 목적이 된다. 그래서 데이터가 먼저 말하고,
// 사람은 발견 사항에 답하며, 결과로 핵심 난제를 고른다.
//
//   1. 관측       사람이 아무것도 안 해도 보이는 것
//   2. 발견 사항    시스템이 규칙으로 뽑은 사실
//   3. 핵심 난제  사람이 고르는 진단의 산출물  ← 다음 단계로 넘어감
//   4. 세부 판단  필요한 곳만. 전부 채울 의무가 없다

const Layout = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 1.25rem;
`;

const Wrap = styled.div`
  flex: 1;
  min-width: 0;   /* 표가 넓어도 목차를 밀어내지 않게 */
  /* 글줄 상한. 본문이 이보다 넓어지면 한 줄이 너무 길어 눈이 줄을 놓친다.
     곁가지(흐름도·후보 열)는 이 상한 **밖**이다. */
  max-width: 1200px;

  display: flex;
  flex-direction: column;
  gap: 1.25rem;
`;

const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  min-width: 0;   /* 표가 넓어도 격자 칸을 밀어내지 않게 */
`;

// 발견 사항 → 핵심 난제는 흐름이라 한동안 가로로 나란히 두었다. 그런데 둘 다
// 목록이라 나란히 두면 한쪽이 길어질 때 다른 쪽 아래가 텅 비고, 좁은 화면에서는
// 어차피 세로로 떨어져 규칙이 화면 폭마다 달랐다. 지금은 **항상 세로**다 —
// 흐름은 [핵심 난제로 ↓] 버튼과 목차의 ②③ 이 말해 준다.

const Head = styled.div`
  display: flex;
  align-items: baseline;
  gap: 0.625rem;
  flex-wrap: wrap;
`;

const StepBadge = styled.span`
  flex-shrink: 0;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background: #ede9fe;
  color: #6d28d9;
  font-size: 0.75rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: #1e293b;
`;

const Hint = styled.span`
  font-size: 0.8125rem;
  color: #94a3b8;
`;

const Count = styled.span`
  font-size: 0.8125rem;
  font-weight: 700;
  color: #7c3aed;
`;

const Toggle = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  color: inherit;
  font: inherit;
`;

// 관측을 어느 축으로 볼 것인가. **같은 과제를 다르게 자르는 것**이라 사람이
// 채울 격자가 늘지 않는다 — 사업부 축이 "누가 못 하고 있나"를, 프로세스 축이
// "어디가 약한가"를 본다.
const AxisTabs = styled.div`
  display: flex;
  gap: 0.3rem;
  margin-left: auto;
`;

const AxisTab = styled.button`
  padding: 0.2rem 0.6rem;
  border: 1px solid ${p => (p.$on ? '#7c3aed' : '#e2e8f0')};
  border-radius: 999px;
  background: ${p => (p.$on ? '#7c3aed' : 'white')};
  color: ${p => (p.$on ? 'white' : '#64748b')};
  font-size: 0.75rem;
  font-weight: ${p => (p.$on ? 700 : 500)};
  font-family: inherit;
  cursor: pointer;
  &:hover { border-color: #a78bfa; }
`;

const AxisSelect = styled.select`
  padding: 0.2rem 0.4rem;
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  background: white;
  color: #475569;
  font-size: 0.75rem;
  font-family: inherit;
  cursor: pointer;
  &:focus { outline: none; border-color: #7c3aed; }
`;

const Notice = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.6rem 0.875rem;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 0.5rem;
  color: #92400e;
  font-size: 0.8125rem;
  line-height: 1.6;
`;

const Collapsed = styled.div`
  padding: 0.875rem 1.125rem;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 0.5rem;
  color: #64748b;
  font-size: 0.8125rem;
  line-height: 1.6;
`;

const DiagnosisView = ({
  categories, divisions, metricDefinitions, thresholds,
  assessments, metrics, metricsError, kpiCoverage, findings, cruxes,
  surveyEvidence, surveyVoicesAvailable, onApplySurvey, onLoadVoices,
  intelEvidence, intelError, onApplyIntel,
  processMetrics, canEdit, onMetricDetail,
  onChange, onTargetChange, onBumpTargets,
  onCruxAdd, onCruxUpdate, onCruxDelete, onCruxDemote,
  issues,
}) => {
  const [showGrid, setShowGrid] = useState(false);
  // 'division' | 'process'
  const [axis, setAxis] = useState('division');
  // 프로세스 축에서 어느 사업부를 볼 것인가. '' 이면 전사 합계.
  const [processIn, setProcessIn] = useState('');

  const filledCount = (assessments || []).filter(
    a => a.current_level !== null && a.current_level !== undefined
  ).length;
  const totalSlots = (divisions?.length || 0) *
    (categories || []).reduce((n, c) => n + c.dimensions.length, 0);

  // ⚠️ 화면에 **실제로 그린 것만** 넣는다. 없는 곳을 가리키면 눌러도 아무 일이
  //    안 일어나서, 사용자는 흐름도가 고장 난 줄 안다.
  const hasSurvey = surveyEvidence?.cells?.length > 0
    || surveyEvidence?.surveys?.length > 0;
  const hasVoices = surveyEvidence?.surveys?.length > 0;
  // 인텔 모듈이 없거나 비어 있으면(역량 0) 자리 자체를 안 만든다. 읽기 실패는
  // 다르다 — 그건 비어 있는 게 아니라 고장이라, 자리를 만들어 이유를 적는다.
  const hasIntel = Boolean(intelError) || intelEvidence?.total_caps > 0;
  const intelRows = (intelEvidence?.cells || [])
    .filter(c => c.recorded > 0).length;
  // 목표는 아래 「세부 판단」의 지표 줄에 적는다. 하나도 없으면 격차(목표−현재)가
  // 구조적으로 안 생겨, 지표에서 이슈 후보가 나오는 길이 통째로 막힌다 —
  // 막지 않되 왜 안 도는지는 그 자리에서 말한다(사이클 완주 장치).
  const targetCount = (metrics || [])
    .filter(m => m.target_value != null).length;
  const techDimLabel = Object.fromEntries(
    ((categories || []).find(c => c.key === 'technical')?.dimensions || [])
      .map(d => [d.key, d.label]));

  const flow = [
    { kind: 'group', label: '근거' },
    { kind: 'node', id: 'sec-observed', label: '관측' },
    ...(!metricsError ? [{ kind: 'node', id: 'sec-kpi', label: '지표별 연결' }] : []),
    ...(hasSurvey ? [{ kind: 'node', id: 'sec-survey', label: '설문 근거' }] : []),
    ...(hasIntel ? [{ kind: 'node', id: 'sec-intel', label: '기술 근거' }] : []),
    // 설문·기술 근거만 본줄기를 벗어난다 — 발견 사항이 아니라 진단값으로 간다.
    // 이 갈림이 화면에서 제일 안 보이던 것이다.
    ...((hasSurvey || hasIntel) ? [
      {
        kind: 'branch',
        text: <><strong>반영</strong>하면{' '}
          {hasSurvey && '조직 역량'}{hasSurvey && hasIntel && '·'}
          {hasIntel && '기술'} 칸으로</>,
      },
      { kind: 'side', id: 'sec-grid', label: '세부 판단' },
    ] : []),
    { kind: 'link', note: '⚙기준을 넘은 것만' },
    { kind: 'node', id: 'sec-findings', label: '발견 사항' },
    { kind: 'link', note: '사람이 골라 올림' },
    { kind: 'node', id: 'sec-cruxes', label: '핵심 난제', out: true },
    ...(hasVoices ? [{
      kind: 'branch', into: true,
      text: <><strong>설문 이야기</strong>(AI)에서도 바로</>,
    }] : []),
    { kind: 'branch', into: true, text: '직접 적어서도' },
    { kind: 'link' },
    { kind: 'exit', label: '② 이슈 (다음 단계)' },
    {
      kind: 'branch', into: true,
      text: <><strong>세부 판단</strong>의 목표−현재 격차에서도</>,
    },
  ];

  // ⚠️ **프로세스는 사업부 아래에 있다.** MX 의 개발과 VD 의 개발은 서로
  //    독립적인 조직이라, 둘을 더한 "개발 49.5%" 는 어느 사업부 이야기인지
  //    말해 주지 않는다. 그래서 프로세스를 볼 때 **어느 사업부 안인지**를
  //    함께 고르게 한다. 전사 합계도 볼 수 있게 두되 합친 값임을 적는다.
  const processAxis = processMetrics?.processes || [];
  const processRows = processAxis.map(name => ({ id: name, name }));
  const processSource = processIn === ''
    ? (processMetrics?.totals || {})
    : (processMetrics?.byDivision?.[processIn] || {});
  const processCells = processAxis.flatMap(name => (
    Object.entries(processSource[name] || {}).map(([key, value]) => ({
      division_id: name, metric_key: key, value,
    }))
  ));
  const onProcess = axis === 'process' && processAxis.length > 0;

  // ⚠️ **바로 만들지 않는다.** 발견 사항 제목을 그대로 난제로 삼으면 관측이
  //    난제 자리에 앉고, 그런 난제에는 할 일이 안 붙는다 — 실제로 열 개 중
  //    여덟 개가 이슈 0건이었다(PromoteCrux 주석). 제목을 다시 쓰게 한다.
  const [promoting, setPromoting] = useState(null);

  // 관측값 하나를 풀어 보는 창. **누를 때만 부른다** — 미리 다 풀어 두면
  // payload 가 열 배가 된다(임계값 미리보기와 같은 규칙).
  const [detail, setDetail] = useState(null);

  const openDetail = async (def, col) => {
    // ⚠️ 프로세스 축이면 **사업부도 같이** 보낸다. MX 의 개발과 VD 의 개발은
    //    다른 조직이라, 프로세스만 보내면 합친 값이 돌아온다. 전사 합계를
    //    보고 있을 때(processIn === '')만 사업부 없이 보낸다.
    const scope = onProcess
      ? { process: col.id, divisionId: processIn || undefined }
      : { divisionId: col.id };
    setDetail({ loading: true, data: null, error: null });
    try {
      const data = await onMetricDetail(def.key, scope);
      setDetail({ loading: false, data, error: null });
    } catch (e) {
      setDetail({ loading: false, data: null,
                  error: e?.message || '불러오지 못했습니다.' });
    }
  };

  const promote = (finding) => setPromoting(finding);

  const confirmPromote = async (payload) => {
    const ok = await onCruxAdd(payload);
    if (ok !== false) setPromoting(null);
  };

  return (
    <Layout>
      {detail && (
        <MetricDetail
          {...detail}
          onClose={() => setDetail(null)}
        />
      )}
      {promoting && (
        <PromoteCrux
          finding={promoting}
          cruxCount={(cruxes || []).length}
          onConfirm={confirmPromote}
          onCancel={() => setPromoting(null)}
        />
      )}
      {/* 무엇이 어디로 가는지 + 지금 어디인지. 한동안 목차를 따로 두었는데
          이름이 겹쳐 두 벌이 나란히 있는 꼴이라 이것 하나로 합쳤다. */}
      <FlowMap items={flow} onJump={(id) => {
        if (id === 'sec-grid') setShowGrid(true);
      }} />
      <Wrap>
        <Section id="sec-observed">
          <Head>
            <StepBadge>1</StepBadge>
            <Title>관측</Title>
            <Hint>
              디지털 트윈 대시보드·DX KPI 관리에서 계산합니다.
              붉은 칸이 ⚙설정의 기준을 넘은 값입니다 — 칸에 대면 기준이 보입니다.
            </Hint>
            {processAxis.length > 0 && !metricsError && (
              <AxisTabs>
                <AxisTab $on={!onProcess} onClick={() => setAxis('division')}
                         title="누가 못 하고 있나">사업부</AxisTab>
                <AxisTab $on={onProcess} onClick={() => setAxis('process')}
                         title="사업부 안에서 어느 프로세스가 약한가">
                  사업부 안 프로세스
                </AxisTab>
                {/* 프로세스는 사업부 아래에 있다. 그래서 축을 고르면 **어느
                    사업부 안인지**를 바로 옆에서 고르게 한다. */}
                {onProcess && (
                  <AxisSelect value={processIn}
                              onChange={e => setProcessIn(e.target.value)}>
                    <option value="">전사 합계 (합친 값)</option>
                    {divisions.map(d => (
                      <option key={d.id} value={d.id}>{d.name} 안에서</option>
                    ))}
                  </AxisSelect>
                )}
              </AxisTabs>
            )}
          </Head>

          {!metricsError && (metrics || []).length > 0 && targetCount === 0 && (
            <Notice>
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '0.15rem' }} />
              <span>
                <strong>목표가 하나도 없어 격차를 못 잽니다.</strong> 관측값은
                보이지만 「목표−현재」가 없으면 지표에서 ② 이슈의 후보가 나오는
                길이 막힙니다. 아래 <strong>세부 판단</strong>을 펴면 지표 줄에
                목표를 적을 수 있습니다 — 전부 채울 의무는 없습니다.
              </span>
            </Notice>
          )}

          {metricsError
            ? <Collapsed>{metricsError}</Collapsed>
            : (
              <>
                <ObservedMatrix
                  definitions={onProcess
                    // KPI 달성률은 사업부에 붙은 값이라 프로세스로 나눌 수 없다.
                    // 빈 줄로 두면 "계산이 안 됐나" 로 읽히므로 아예 뺀다.
                    ? (metricDefinitions || []).filter(d => d.key !== 'kpi_achievement')
                    : metricDefinitions}
                  divisions={onProcess ? processRows : divisions}
                  metrics={onProcess ? processCells : metrics}
                  thresholds={thresholds}
                  onOpen={onMetricDetail ? openDetail : undefined}
                />
                {onProcess && (
                  <Hint>
                    {processIn === '' ? (
                      <>
                        <strong>전사 합계입니다.</strong> 프로세스는 사업부 아래에
                        있어서 — MX 의 개발과 VD 의 개발은 서로 독립적인 조직입니다 —
                        이 값은 그것들을 <strong>합친 것</strong>입니다. 어느
                        사업부 이야기인지 보려면 위에서 사업부를 고르세요.
                      </>
                    ) : (
                      <>
                        <strong>{divisions.find(d => String(d.id) === String(processIn))?.name}</strong>
                        {' '}안에서만 본 값입니다.
                      </>
                    )}
                    {' '}KPI 달성률은 지표가 사업부에 붙어 있어 이 축에서는 낼 수
                    없습니다.
                    {processMetrics?.unknownCount > 0 && (
                      <> 프로세스를 안 적은 과제 {processMetrics.unknownCount}건은
                      어느 칸에도 안 들어갔습니다.</>
                    )}
                  </Hint>
                )}
              </>
            )}
        </Section>

        {!metricsError && (
          <Section id="sec-kpi">
            <Head>
              <StepBadge>1</StepBadge>
              <Title>지표별 연결</Title>
              <Hint>
                지표마다 그것을 미는 과제가 있는지 봅니다. '주'가 0이면 목표만
                있고 그 지표를 직접 미는 과제는 없다는 뜻입니다.
              </Hint>
            </Head>
            <KpiCoverage coverage={kpiCoverage} />
          </Section>
        )}

        {/* 사람에게 물어야만 아는 것. 지표는 '무엇이 벌어졌나'를 말하지만
            '왜'와 '어떻게 느끼나'는 말하지 못한다. 그 자리를 설문이 채운다.

            ⚠️ 여기서 아무것도 자동으로 바뀌지 않는다. 제안값일 뿐이고,
               누르는 것은 사람이다. */}
        <Section id="sec-survey">
          <Head>
            <StepBadge>1</StepBadge>
            <Title>설문 근거</Title>
            {surveyEvidence?.cells?.length > 0 && (
              <Count>{surveyEvidence.cells.length}칸</Count>
            )}
            <Hint>
              마감된 설문의 조직 역량 문항을 <strong>1인 1표</strong>로 모았습니다.
              제안값일 뿐이라 누르기 전에는 진단이 바뀌지 않습니다 — 평균을 같이
              적어 두었으니 반올림된 자리를 보고 판단하세요.{' '}
              <strong>「반영」을 누르면</strong> 맨 아래 <strong>세부 판단</strong>의
              조직 역량 칸이 그 값으로 바뀝니다.
            </Hint>
          </Head>
          <SurveyEvidence evidence={surveyEvidence}
                          onApply={canEdit ? onApplySurvey : null} />
        </Section>

        {/* 기술 레이더가 아는 것. 설문이 조직 역량을 채우듯 여기는 기술 축을
            채운다 — 사업부별 단계(도입·시험·관찰·감지)가 곧 근거다.

            ⚠️ 여기서도 아무것도 자동으로 바뀌지 않는다. 후보일 뿐이고,
               누르는 것은 사람이다. */}
        {hasIntel && (
          <Section id="sec-intel">
            <Head>
              <StepBadge>1</StepBadge>
              <Title>기술 근거</Title>
              {intelRows > 0 && <Count>{intelRows}칸</Count>}
              <Hint>
                기술 레이더의 <strong>사업부별 단계</strong>를 기술 축의 후보
                레벨로 환산했습니다. 어느 역량을 보고 나온 값인지 같이 적혀
                있습니다. <strong>응용 축에는 후보를 내지 않습니다</strong> —
                도구를 들인 것과 의사결정에 쓰는 것은 다른 일입니다.{' '}
                <strong>「반영」을 누르면</strong> 맨 아래{' '}
                <strong>세부 판단</strong>의 기술 칸이 그 값으로 바뀝니다.
              </Hint>
            </Head>
            <IntelEvidence evidence={intelEvidence} error={intelError}
                           dimensionLabel={techDimLabel}
                           onApply={canEdit ? onApplyIntel : null} />
          </Section>
        )}

        {/* 서술형은 규칙으로 못 짚는다. "이런 말이 많았다"는 판단이라 AI 의 일이다.
            ⚠️ 「발견 사항」과 **자리를 갈라 둔다** — 센 것과 읽은 것을 한 목록에 두면
               지어낸 문장이 세어진 사실과 같은 모양으로 앉는다. */}
        {surveyEvidence?.surveys?.length > 0 && (
          <Section id="sec-voices">
            <Head>
              <StepBadge>1</StepBadge>
              <Title>설문에서 나온 이야기</Title>
              <Hint>
                자유서술 답을 사내 AI 가 묶어 읽습니다. <strong>인용문이 근거</strong>
                이니 함께 보세요 — 숫자가 못 말하는 &lsquo;왜&rsquo;가 여기 있습니다.
                여기 묶음은 발견 사항에는 안 들어가고{' '}
                <strong>바로 핵심 난제로</strong> 올릴 수 있습니다.
              </Hint>
            </Head>
            {/* ⚠️ 서술형은 **원문 인용**을 읽는다. 설문 응답자에게 「관리자는
                확인 가능」이라고 고지했지 「전 직원이 확인 가능」이라고 하지
                않았다. 열람은 감사 로그에도 남는다. */}
            {canEdit ? (
              <SurveyVoices
                available={surveyVoicesAvailable}
                onLoad={onLoadVoices}
                // ⚠️ 서술형 요약도 **AI 가 붙인 제목**이다. 그대로 난제로
                //    삼지 않고 같은 대화상자를 태운다 — 난제의 말은 사람이
                //    골라야 한다.
                onPromote={(p) => promote({
                  title: p.title, detail: p.rationale,
                  division_id: null, key: p.source_finding,
                })}
              />
            ) : (
              <Hint>
                서술형에서 나온 이야기는 <strong>편집 권한이 있는 분만</strong>{' '}
                볼 수 있습니다. 응답자에게 그렇게 고지하고 받은 답변입니다.
              </Hint>
            )}
          </Section>
        )}

        <Section id="sec-findings">
          <Head>
            <StepBadge>2</StepBadge>
            <Title>발견 사항</Title>
            {findings?.length > 0 && <Count>{findings.length}건</Count>}
            <Hint>
              위의 <strong>관측·지표별 연결·설문·기술 근거</strong>에서 ⚙설정의 기준을 넘은
              것만 규칙이 골라 문장으로 세운 것입니다. 줄마다 어디서 나왔는지
              적혀 있습니다. 중요한 것을 아래로 올리세요.
            </Hint>
          </Head>
          <FindingsPanel findings={findings}
                         onPromote={canEdit ? promote : null} />
        </Section>

        <Section id="sec-cruxes">
          <Head>
            <StepBadge>3</StepBadge>
            <Title>핵심 난제</Title>
            <Hint>
              올해 이것만은 넘겠다고 정하는 자리. 1~3개. ② 이슈에서 할 일로
              이어집니다. 들어오는 길은 셋입니다 — <strong>발견 사항</strong>에서
              올리거나, <strong>설문에서 나온 이야기</strong>에서 올리거나,
              직접 적습니다.
            </Hint>
          </Head>
          <CruxPanel
            cruxes={cruxes}
            issueCounts={(issues || []).reduce((acc, i) => {
              if (i.crux_id && i.status !== 'dropped') {
                acc[i.crux_id] = (acc[i.crux_id] || 0) + 1;
              }
              return acc;
            }, {})}
            onDemote={canEdit ? onCruxDemote : null}
            onAdd={canEdit ? onCruxAdd : null}
            onUpdate={canEdit ? onCruxUpdate : null}
            onDelete={canEdit ? onCruxDelete : null}
          />
        </Section>

        <Section id="sec-grid">
          <Head>
            <Toggle onClick={() => setShowGrid(v => !v)}>
              {showGrid ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              <Title>세부 판단</Title>
            </Toggle>
            <Hint>
              성숙도·조직 역량을 직접 매깁니다. {filledCount}/{totalSlots} 입력됨 —
              전부 채울 의무는 없습니다. <strong>현재와 목표의 차이가 ② 이슈의
              후보</strong>가 되고, 위 「설문 근거」의 <strong>「반영」도 이 표의
              조직 역량 칸에 씁니다.</strong>
            </Hint>
          </Head>

          {showGrid ? (
            <AssessmentGrid
              categories={categories}
              divisions={divisions}
              metricDefinitions={metricDefinitions}
              assessments={assessments}
              metrics={metrics}
              metricsError={metricsError}
              onChange={canEdit ? onChange : null}
              onTargetChange={canEdit ? onTargetChange : null}
              onBumpTargets={canEdit ? onBumpTargets : null}
              hideMetrics
            />
          ) : (
            <Collapsed>
              핵심 난제와 관련된 항목만 매기면 됩니다. 격자를 다 채우는 것이 진단의
              목적이 아닙니다 — 근거 없이 매긴 점수는 판단을 돕지 못합니다.
            </Collapsed>
          )}
        </Section>
      </Wrap>
    </Layout>
  );
};

export default DiagnosisView;
