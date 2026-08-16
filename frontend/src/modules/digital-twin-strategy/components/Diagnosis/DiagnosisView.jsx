import React, { useState } from 'react';
import styled from 'styled-components';
import { ChevronDown, ChevronRight } from 'lucide-react';
import ObservedMatrix from './ObservedMatrix';
import KpiCoverage from './KpiCoverage';
import FindingsPanel from './FindingsPanel';
import CruxPanel from './CruxPanel';
import SurveyEvidence from './SurveyEvidence';
import SurveyVoices from './SurveyVoices';
import AssessmentGrid from '../Assessment/AssessmentView';

// ① 진단.
//
// 순서가 설계다. 사람에게 격자부터 채우게 하면 근거 없는 점수가 3점으로
// 수렴하고, 채우는 것 자체가 목적이 된다. 그래서 데이터가 먼저 말하고,
// 사람은 짚인 것에 답하며, 결과로 핵심 난제를 고른다.
//
//   1. 관측       사람이 아무것도 안 해도 보이는 것
//   2. 짚인 것    시스템이 규칙으로 뽑은 사실
//   3. 핵심 난제  사람이 고르는 진단의 산출물  ← 다음 단계로 넘어감
//   4. 세부 판단  필요한 곳만. 전부 채울 의무가 없다

const Wrap = styled.div`
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

// 짚인 것 → 핵심 난제는 흐름이다. [핵심 난제로 →] 버튼이 왼쪽에서 오른쪽으로
// 보내는 것이므로, 세로로 쌓아 스크롤로 갈라놓으면 그 관계가 안 보인다.
// 좁은 화면에서는 한 줄로 되돌아간다.
const Columns = styled.div`
  display: grid;
  gap: 1.25rem;
  grid-template-columns: 1fr;
  align-items: start;

  @media (min-width: 1200px) {
    grid-template-columns: 1.4fr 1fr;
  }
`;

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
  onChange, onTargetChange, onCruxAdd, onCruxUpdate, onCruxDelete,
}) => {
  const [showGrid, setShowGrid] = useState(false);

  const filledCount = (assessments || []).filter(
    a => a.current_level !== null && a.current_level !== undefined
  ).length;
  const totalSlots = (divisions?.length || 0) *
    (categories || []).reduce((n, c) => n + c.dimensions.length, 0);

  const promote = (finding) => {
    onCruxAdd({
      title: finding.title,
      rationale: finding.detail,
      division_id: finding.division_id ?? null,
      source_finding: finding.key,
    });
  };

  return (
    <Wrap>
      <Section>
        <Head>
          <StepBadge>1</StepBadge>
          <Title>관측</Title>
          <Hint>
            디지털 트윈 대시보드·DX KPI 관리에서 계산합니다.
            붉은 칸이 ⚙설정의 기준을 넘은 값입니다 — 칸에 대면 기준이 보입니다.
          </Hint>
        </Head>
        {metricsError
          ? <Collapsed>{metricsError}</Collapsed>
          : (
            <ObservedMatrix
              definitions={metricDefinitions}
              divisions={divisions}
              metrics={metrics}
              thresholds={thresholds}
            />
          )}
      </Section>

      {!metricsError && (
        <Section>
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
      <Section>
        <Head>
          <StepBadge>1</StepBadge>
          <Title>설문 근거</Title>
          {surveyEvidence?.cells?.length > 0 && (
            <Count>{surveyEvidence.cells.length}칸</Count>
          )}
          <Hint>
            마감된 설문의 조직 역량 문항을 <strong>1인 1표</strong>로 모았습니다.
            제안값일 뿐이라 누르기 전에는 진단이 바뀌지 않습니다 — 평균을 같이
            적어 두었으니 반올림된 자리를 보고 판단하세요.
          </Hint>
        </Head>
        <SurveyEvidence evidence={surveyEvidence} onApply={onApplySurvey} />
      </Section>

      {/* 서술형은 규칙으로 못 짚는다. "이런 말이 많았다"는 판단이라 AI 의 일이다.
          ⚠️ 「짚인 것」과 **자리를 갈라 둔다** — 센 것과 읽은 것을 한 목록에 두면
             지어낸 문장이 세어진 사실과 같은 모양으로 앉는다. */}
      {surveyEvidence?.surveys?.length > 0 && (
        <Section>
          <Head>
            <StepBadge>1</StepBadge>
            <Title>설문에서 나온 이야기</Title>
            <Hint>
              자유서술 답을 AI 가 묶어 읽습니다. <strong>인용문이 근거</strong>이니
              함께 보세요 — 숫자가 못 말하는 &lsquo;왜&rsquo;가 여기 있습니다.
            </Hint>
          </Head>
          <SurveyVoices
            available={surveyVoicesAvailable}
            onLoad={onLoadVoices}
            onPromote={onCruxAdd}
          />
        </Section>
      )}

      <Columns>
        <Section>
          <Head>
            <StepBadge>2</StepBadge>
            <Title>짚인 것</Title>
            {findings?.length > 0 && <Count>{findings.length}건</Count>}
            <Hint>위 값 중 ⚙설정의 기준을 넘은 것을 골랐습니다. 중요한 것을 오른쪽으로 올리세요.</Hint>
          </Head>
          <FindingsPanel findings={findings} onPromote={promote} />
        </Section>

        <Section>
          <Head>
            <StepBadge>3</StepBadge>
            <Title>핵심 난제</Title>
            <Hint>올해 이것만은 넘겠다고 정하는 자리. 1~3개. ② 이슈에서 할 일로 이어집니다.</Hint>
          </Head>
          <CruxPanel
            cruxes={cruxes}
            onAdd={onCruxAdd}
            onUpdate={onCruxUpdate}
            onDelete={onCruxDelete}
          />
        </Section>
      </Columns>

      <Section>
        <Head>
          <Toggle onClick={() => setShowGrid(v => !v)}>
            {showGrid ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            <Title>세부 판단</Title>
          </Toggle>
          <Hint>
            성숙도·조직 역량을 직접 매깁니다. {filledCount}/{totalSlots} 입력됨 — 전부 채울 의무는 없습니다.
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
            onChange={onChange}
            onTargetChange={onTargetChange}
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
  );
};

export default DiagnosisView;
