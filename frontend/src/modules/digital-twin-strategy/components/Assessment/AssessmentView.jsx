import React from 'react';
import styled from 'styled-components';

// ① 현재 상태 진단.
// 이슈를 격차(gap)로 정의하기 위한 출발점이다. 목표에서 현재를 뺀 값이
// 다음 단계의 이슈 후보가 된다.

const Table = styled.div`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  overflow: hidden;
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: 140px 1fr 1fr 90px minmax(200px, 1.5fr);
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

const DimensionName = styled.div`
  font-weight: 600;
  color: #1e293b;
`;

const LevelPicker = styled.div`
  display: flex;
  gap: 0.25rem;
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

const LEVELS = [1, 2, 3, 4, 5];

const AssessmentView = ({ dimensions, assessments, onChange, disabled }) => {
  const byKey = {};
  (assessments || []).forEach(a => { byKey[a.dimension] = a; });

  const renderLevels = (dimension, field, value) => (
    <LevelPicker>
      {LEVELS.map(level => (
        <LevelButton
          key={level}
          $active={value === level}
          disabled={disabled}
          onClick={() => onChange(dimension, { [field]: level })}
          title={`${level}단계`}
        >
          {level}
        </LevelButton>
      ))}
      {value !== null && value !== undefined && (
        // 0 과 미입력은 다른 뜻이다. 지우면 null 로 되돌린다.
        <ClearButton
          disabled={disabled}
          onClick={() => onChange(dimension, { [field]: null })}
          title="미입력으로 되돌리기"
        >
          지움
        </ClearButton>
      )}
    </LevelPicker>
  );

  return (
    <Table>
      <HeadRow>
        <div>차원</div>
        <div>현재 수준</div>
        <div>목표 수준</div>
        <div style={{ textAlign: 'center' }}>격차</div>
        <div>메모</div>
      </HeadRow>

      {dimensions.map(dim => {
        const a = byKey[dim.key] || {};
        return (
          <Row key={dim.key}>
            <DimensionName>{dim.label}</DimensionName>
            {renderLevels(dim.key, 'current_level', a.current_level)}
            {renderLevels(dim.key, 'target_level', a.target_level)}
            <Gap $value={a.gap}>
              {a.gap === null || a.gap === undefined ? '—' : (a.gap > 0 ? `+${a.gap}` : a.gap)}
            </Gap>
            <NoteInput
              defaultValue={a.note || ''}
              placeholder="판단 근거나 메모"
              disabled={disabled}
              onBlur={e => {
                if ((a.note || '') !== e.target.value) {
                  onChange(dim.key, { note: e.target.value });
                }
              }}
            />
          </Row>
        );
      })}
    </Table>
  );
};

export default AssessmentView;
