import React, { useState } from 'react';
import styled from 'styled-components';
import { ChevronDown, ChevronRight } from 'lucide-react';
import ObservedMatrix from './ObservedMatrix';
import KpiCoverage from './KpiCoverage';
import FindingsPanel from './FindingsPanel';
import CruxPanel from './CruxPanel';
import AssessmentGrid from '../Assessment/AssessmentView';

// ① 진단.
//
// 순서가 설계다. 사람에게 격자부터 채우게 하면 근거 없는 점수가 3점으로
// 수렴하고, 채우는 것 자체가 목적이 된다. 그래서 데이터가 먼저 말하고,
// 사람은 짚인 것에 답하며, 결과로 크럭스를 고른다.
//
//   1. 관측       사람이 아무것도 안 해도 보이는 것
//   2. 짚인 것    시스템이 규칙으로 뽑은 사실
//   3. 크럭스     사람이 고르는 진단의 산출물  ← 다음 단계로 넘어감
//   4. 세부 판단  필요한 곳만. 전부 채울 의무가 없다

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
`;

const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
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
  categories, divisions, metricDefinitions,
  assessments, metrics, metricsError, kpiCoverage, findings, cruxes,
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
          <Hint>포탈 데이터로 계산된 값. 사람이 매기지 않습니다.</Hint>
        </Head>
        {metricsError
          ? <Collapsed>{metricsError}</Collapsed>
          : (
            <ObservedMatrix
              definitions={metricDefinitions}
              divisions={divisions}
              metrics={metrics}
            />
          )}
      </Section>

      {!metricsError && (
        <Section>
          <Head>
            <StepBadge>1</StepBadge>
            <Title>지표별 연결</Title>
            <Hint>
              사업부에서 보면 안 드러납니다 — 아무도 주기여로 밀지 않는 지표는
              뒤집어 봐야 보입니다.
            </Hint>
          </Head>
          <KpiCoverage coverage={kpiCoverage} />
        </Section>
      )}

      <Section>
        <Head>
          <StepBadge>2</StepBadge>
          <Title>짚인 것</Title>
          {findings?.length > 0 && <Count>{findings.length}건</Count>}
          <Hint>결론이 아니라 눈에 띄는 사실입니다. 왜 그런지는 사람이 답합니다.</Hint>
        </Head>
        <FindingsPanel findings={findings} onPromote={promote} />
      </Section>

      <Section>
        <Head>
          <StepBadge>3</StepBadge>
          <Title>크럭스</Title>
          <Hint>올해 넘어야 할 결정적 지점. 여기 남는 것이 다음 단계로 넘어갑니다.</Hint>
        </Head>
        <CruxPanel
          cruxes={cruxes}
          onAdd={onCruxAdd}
          onUpdate={onCruxUpdate}
          onDelete={onCruxDelete}
        />
      </Section>

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
            크럭스와 관련된 항목만 매기면 됩니다. 격자를 다 채우는 것이 진단의
            목적이 아닙니다 — 근거 없이 매긴 점수는 판단을 돕지 못합니다.
          </Collapsed>
        )}
      </Section>
    </Wrap>
  );
};

export default DiagnosisView;
