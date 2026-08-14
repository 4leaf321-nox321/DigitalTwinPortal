import React, { useState } from 'react';
import styled from 'styled-components';
import { HelpCircle } from 'lucide-react';

// ① 현재 상태 진단.
// 사업부 × 차원으로 현재/목표 수준을 매긴다. 목표에서 현재를 뺀 격차가
// 다음 단계의 이슈 후보가 된다.
//
// 차원과 레벨의 정의를 화면에 붙인다. 정의 없이 1~5 만 두면 사람마다 다르게
// 매겨 격차 숫자가 의미를 잃는다.

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
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

  &:hover {
    border-color: #7c3aed;
  }
`;

const FilledCount = styled.span`
  font-size: 0.75rem;
  font-weight: 600;
  opacity: 0.75;
`;

const Table = styled.div`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  overflow: hidden;
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: 200px 1fr 1fr 90px minmax(180px, 1.2fr);
  align-items: center;
  gap: 1rem;
  padding: 0.875rem 1.25rem;
  border-bottom: 1px solid #f1f5f9;

  &:last-child {
    border-bottom: none;
  }
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

  &:hover {
    color: #7c3aed;
  }
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

  &:hover {
    color: #64748b;
    border-color: #94a3b8;
  }
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

  &:focus {
    outline: none;
    border-color: #7c3aed;
  }
`;

const LevelLegend = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 0.875rem 1.25rem;
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

const AssessmentView = ({ dimensions, levels, divisions, assessments, onChange }) => {
  const [activeDivision, setActiveDivision] = useState(divisions?.[0]?.id ?? null);

  if (!divisions?.length) {
    return <Table><Row>진단 대상 사업부가 없습니다.</Row></Table>;
  }

  const currentDivision = divisions.find(d => d.id === activeDivision) || divisions[0];

  const byKey = {};
  (assessments || [])
    .filter(a => a.division_id === currentDivision.id)
    .forEach(a => { byKey[a.dimension] = a; });

  // 사업부 탭에 진행 정도를 보여준다. 25칸을 채우는 일이라 어디까지 했는지가 보여야 한다.
  const filledCount = (divisionId) =>
    (assessments || []).filter(
      a => a.division_id === divisionId && a.current_level !== null && a.current_level !== undefined
    ).length;

  const levelTitle = (levels || [])
    .map(l => `${l.value} ${l.label} — ${l.detail}`)
    .join('\n');

  const renderLevels = (dimension, field, value) => (
    <LevelPicker>
      {(levels || []).map(level => (
        <LevelButton
          key={level.value}
          $active={value === level.value}
          onClick={() => onChange(currentDivision.id, dimension, { [field]: level.value })}
          title={`${level.value} ${level.label}\n${level.detail}`}
        >
          {level.value}
        </LevelButton>
      ))}
      {value !== null && value !== undefined && (
        // 0 과 미입력은 다른 뜻이다. 지우면 null 로 되돌린다.
        <ClearButton
          onClick={() => onChange(currentDivision.id, dimension, { [field]: null })}
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
            $active={d.id === currentDivision.id}
            onClick={() => setActiveDivision(d.id)}
          >
            {d.name}
            <FilledCount>{filledCount(d.id)}/{dimensions.length}</FilledCount>
          </DivisionTab>
        ))}
      </DivisionTabs>

      <LevelLegend>
        {(levels || []).map(l => (
          <LegendItem key={l.value} title={l.detail}>
            <LegendNum>{l.value}</LegendNum>
            {l.label}
          </LegendItem>
        ))}
      </LevelLegend>

      <Table>
        <HeadRow>
          <div>차원</div>
          <div title={levelTitle}>현재 수준</div>
          <div title={levelTitle}>목표 수준</div>
          <div style={{ textAlign: 'center' }}>격차</div>
          <div>메모</div>
        </HeadRow>

        {dimensions.map(dim => {
          const a = byKey[dim.key] || {};
          return (
            <Row key={dim.key}>
              <DimensionCell>
                <DimensionName>{dim.label}</DimensionName>
                <HintIcon size={14} title={`${dim.question}\n${dim.detail}`} />
              </DimensionCell>
              {renderLevels(dim.key, 'current_level', a.current_level)}
              {renderLevels(dim.key, 'target_level', a.target_level)}
              <Gap $value={a.gap}>
                {a.gap === null || a.gap === undefined ? '—' : (a.gap > 0 ? `+${a.gap}` : a.gap)}
              </Gap>
              <NoteInput
                key={`${currentDivision.id}-${dim.key}-${a.note || ''}`}
                defaultValue={a.note || ''}
                placeholder="판단 근거나 메모"
                onBlur={e => {
                  if ((a.note || '') !== e.target.value) {
                    onChange(currentDivision.id, dim.key, { note: e.target.value });
                  }
                }}
              />
            </Row>
          );
        })}
      </Table>
    </Wrap>
  );
};

export default AssessmentView;
