import React, { useState } from 'react';
import styled from 'styled-components';
import { HelpCircle, ClipboardList } from 'lucide-react';
import MetricPanel from './MetricPanel';

// ① 현재 상태 진단. 세 겹이다.
//   A. 기술 성숙도  사업부 × 5차원, 사람이 매김
//   B. 활용과 성과  포탈 데이터로 자동 산출
//   C. 조직 역량    사업부 × 5축, 설문 위주
//
// 기술만 재면 "만들어놓고 아무도 안 쓰는" 상태를 잡아내지 못한다.

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
`;

const DivisionTabs = styled.div`
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
`;

const DivisionTab = styled.button`
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid ${p => (p.$active ? '#7c3aed' : '#e2e8f0')};
  background: ${p => (p.$active ? '#7c3aed' : 'white')};
  color: ${p => (p.$active ? 'white' : '#475569')};
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &:hover { border-color: #7c3aed; }
`;

const FilledCount = styled.span`
  font-size: 0.75rem;
  font-weight: 600;
  opacity: 0.75;
`;

const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
`;

const SectionHead = styled.div`
  display: flex;
  align-items: baseline;
  gap: 0.625rem;
  flex-wrap: wrap;
`;

const SectionTitle = styled.h3`
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 700;
  color: #1e293b;
`;

const SectionHint = styled.span`
  font-size: 0.8125rem;
  color: #94a3b8;
`;

const Table = styled.div`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  overflow: hidden;
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: 200px 1fr 1fr 90px minmax(160px, 1.1fr);
  align-items: center;
  gap: 1rem;
  padding: 0.875rem 1.25rem;
  border-bottom: 1px solid #f1f5f9;

  &:last-child { border-bottom: none; }
`;

const HeadRow = styled(Row)`
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  font-size: 0.8125rem;
  font-weight: 700;
  color: #475569;
`;

const DimensionCell = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
`;

const DimensionName = styled.div`
  font-weight: 600;
  color: #1e293b;
`;

const HintIcon = styled(HelpCircle)`
  color: #cbd5e1;
  cursor: help;
  flex-shrink: 0;
  &:hover { color: #7c3aed; }
`;

const SurveyMark = styled(ClipboardList)`
  color: #a78bfa;
  flex-shrink: 0;
`;

const LevelPicker = styled.div`
  display: flex;
  gap: 0.25rem;
  align-items: center;
`;

const LevelButton = styled.button`
  width: 2rem;
  height: 2rem;
  border-radius: 0.375rem;
  border: 1px solid ${p => (p.$active ? '#7c3aed' : '#cbd5e1')};
  background: ${p => (p.$active ? '#7c3aed' : 'white')};
  color: ${p => (p.$active ? 'white' : '#64748b')};
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: #7c3aed;
    color: ${p => (p.$active ? 'white' : '#7c3aed')};
  }
`;

const ClearButton = styled.button`
  margin-left: 0.25rem;
  padding: 0 0.5rem;
  height: 2rem;
  border-radius: 0.375rem;
  border: 1px dashed #cbd5e1;
  background: white;
  color: #94a3b8;
  font-size: 0.75rem;
  cursor: pointer;

  &:hover { color: #64748b; border-color: #94a3b8; }
`;

const Gap = styled.div`
  font-weight: 700;
  text-align: center;
  color: ${p => {
    if (p.$value === null || p.$value === undefined) return '#cbd5e1';
    if (p.$value <= 0) return '#10b981';
    if (p.$value >= 3) return '#ef4444';
    return '#f59e0b';
  }};
`;

const NoteInput = styled.input`
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  color: #334155;
  &:focus { outline: none; border-color: #7c3aed; }
`;

const LevelLegend = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 0.75rem 1.25rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  color: #64748b;
`;

const LegendItem = styled.div`
  display: flex;
  align-items: baseline;
  gap: 0.375rem;
`;

const LegendNum = styled.span`
  font-weight: 700;
  color: #7c3aed;
`;

const AssessmentView = ({
  categories, divisions, assessments,
  metricDefinitions, metrics, metricsError,
  onChange, onTargetChange, hideMetrics = false,
}) => {
  const [activeDivision, setActiveDivision] = useState(divisions?.[0]?.id ?? null);

  if (!divisions?.length) {
    return <Table><Row>진단 대상 사업부가 없습니다.</Row></Table>;
  }

  const division = divisions.find(d => d.id === activeDivision) || divisions[0];

  const lookup = {};
  (assessments || [])
    .filter(a => a.division_id === division.id)
    .forEach(a => { lookup[`${a.category}:${a.dimension}`] = a; });

  const totalSlots = (categories || []).reduce((n, c) => n + c.dimensions.length, 0);
  const filledCount = (divisionId) =>
    (assessments || []).filter(
      a => a.division_id === divisionId &&
        a.current_level !== null && a.current_level !== undefined
    ).length;

  const renderLevels = (category, dimension, field, value, levels) => (
    <LevelPicker>
      {levels.map(level => (
        <LevelButton
          key={level.value}
          $active={value === level.value}
          onClick={() => onChange(division.id, category, dimension, { [field]: level.value })}
          title={`${level.value} ${level.label}\n${level.detail}`}
        >
          {level.value}
        </LevelButton>
      ))}
      {value !== null && value !== undefined && (
        // 0 과 미입력은 다른 뜻이다. 지우면 null 로 되돌린다.
        <ClearButton
          onClick={() => onChange(division.id, category, dimension, { [field]: null })}
          title="미입력으로 되돌리기"
        >
          지움
        </ClearButton>
      )}
    </LevelPicker>
  );

  return (
    <Wrap>
      <DivisionTabs>
        {divisions.map(d => (
          <DivisionTab
            key={d.id}
            $active={d.id === division.id}
            onClick={() => setActiveDivision(d.id)}
          >
            {d.name}
            <FilledCount>{filledCount(d.id)}/{totalSlots}</FilledCount>
          </DivisionTab>
        ))}
      </DivisionTabs>

      {(categories || []).map(cat => (
        <Section key={cat.key}>
          <SectionHead>
            <SectionTitle>{cat.label}</SectionTitle>
            <SectionHint>{cat.hint}</SectionHint>
          </SectionHead>

          <LevelLegend>
            {cat.levels.map(l => (
              <LegendItem key={l.value} title={l.detail}>
                <LegendNum>{l.value}</LegendNum>
                {l.label}
              </LegendItem>
            ))}
          </LevelLegend>

          <Table>
            <HeadRow>
              <div>차원</div>
              <div>현재 수준</div>
              <div>목표 수준</div>
              <div style={{ textAlign: 'center' }}>격차</div>
              <div>메모</div>
            </HeadRow>

            {cat.dimensions.map(dim => {
              const a = lookup[`${cat.key}:${dim.key}`] || {};
              return (
                <Row key={dim.key}>
                  <DimensionCell>
                    <DimensionName>{dim.label}</DimensionName>
                    <HintIcon size={14} title={`${dim.question}\n${dim.detail}`} />
                    {dim.survey_recommended && (
                      <SurveyMark size={13} title="설문으로 채우는 것이 정석인 항목입니다." />
                    )}
                  </DimensionCell>
                  {renderLevels(cat.key, dim.key, 'current_level', a.current_level, cat.levels)}
                  {renderLevels(cat.key, dim.key, 'target_level', a.target_level, cat.levels)}
                  <Gap $value={a.gap}>
                    {a.gap === null || a.gap === undefined
                      ? '—'
                      : (a.gap > 0 ? `+${a.gap}` : a.gap)}
                  </Gap>
                  <NoteInput
                    key={`${division.id}-${cat.key}-${dim.key}-${a.note || ''}`}
                    defaultValue={a.note || ''}
                    placeholder="판단 근거나 메모"
                    onBlur={e => {
                      if ((a.note || '') !== e.target.value) {
                        onChange(division.id, cat.key, dim.key, { note: e.target.value });
                      }
                    }}
                  />
                </Row>
              );
            })}
          </Table>
        </Section>
      ))}

      {/* 진단 화면에서는 관측값을 맨 위 행렬로 이미 보여준다. 여기서는 목표를
          정할 때만 쓰이므로 중복 표시를 피한다. */}
      {!hideMetrics ? (
        <Section>
          <SectionHead>
            <SectionTitle>활용과 성과</SectionTitle>
            <SectionHint>포탈 데이터로 계산된 관측값. 사람이 매기지 않는다.</SectionHint>
          </SectionHead>
          <MetricPanel
            metrics={metrics}
            definitions={metricDefinitions}
            divisionId={division.id}
            error={metricsError}
            onTargetChange={onTargetChange}
          />
        </Section>
      ) : (
        <Section>
          <SectionHead>
            <SectionTitle>지표 목표</SectionTitle>
            <SectionHint>관측값은 위 표에 있습니다. 여기서는 목표만 정합니다.</SectionHint>
          </SectionHead>
          <MetricPanel
            metrics={metrics}
            definitions={metricDefinitions}
            divisionId={division.id}
            error={metricsError}
            onTargetChange={onTargetChange}
          />
        </Section>
      )}
    </Wrap>
  );
};

export default AssessmentView;
