import React from 'react';
import styled from 'styled-components';
import { HelpCircle } from 'lucide-react';

// 관측값 — 사람이 아무것도 안 매겨도 보이는 것.
// 사업부 × 지표 행렬로 한눈에 놓는다. 탭으로 나누면 "어디가 나쁜가"가 안 보인다.

const Wrap = styled.div`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  overflow-x: auto;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: minmax(200px, 1.4fr) repeat(${p => p.$cols}, minmax(96px, 1fr));
  min-width: 720px;
`;

const Cell = styled.div`
  padding: 0.7rem 0.875rem;
  border-bottom: 1px solid #f1f5f9;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.375rem;
`;

const HeadCell = styled(Cell)`
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  font-size: 0.8125rem;
  font-weight: 700;
  color: #475569;
  justify-content: ${p => (p.$first ? 'flex-start' : 'center')};
`;

const NameCell = styled(Cell)`
  font-weight: 600;
  color: #1e293b;
`;

const ValueCell = styled(Cell)`
  justify-content: center;
  font-weight: 700;
  color: ${p => p.$color};
  background: ${p => p.$bg || 'transparent'};
`;

const HintIcon = styled(HelpCircle)`
  color: #cbd5e1;
  cursor: help;
  flex-shrink: 0;
  &:hover { color: #7c3aed; }
`;

const Unit = styled.span`
  font-size: 0.75rem;
  font-weight: 500;
  color: #94a3b8;
  margin-left: 0.15rem;
`;

// 방향에 따라 나쁜 쪽을 붉게 칠한다. neutral 은 크기만 보는 값이라 칠하지 않는다.
function tone(value, direction) {
  if (value === null || value === undefined) return { color: '#cbd5e1' };
  if (direction === 'neutral') return { color: '#0f172a' };

  const bad = direction === 'lower' ? value >= 40 : value <= 60;
  const warn = direction === 'lower' ? value >= 25 : value <= 80;

  if (bad) return { color: '#b91c1c', bg: '#fef2f2' };
  if (warn) return { color: '#b45309', bg: '#fffbeb' };
  return { color: '#047857' };
}

const ObservedMatrix = ({ definitions, divisions, metrics }) => {
  const byKey = {};
  (metrics || []).forEach(m => {
    byKey[`${m.division_id}:${m.metric_key}`] = m;
  });

  return (
    <Wrap>
      <Grid $cols={divisions.length}>
        <HeadCell $first>지표</HeadCell>
        {divisions.map(d => <HeadCell key={d.id}>{d.name}</HeadCell>)}

        {(definitions || []).map(def => (
          <React.Fragment key={def.key}>
            <NameCell>
              {def.label}
              <HintIcon size={14} title={def.detail} />
            </NameCell>
            {divisions.map(d => {
              const m = byKey[`${d.id}:${def.key}`] || {};
              const t = tone(m.value, def.direction);
              return (
                <ValueCell key={d.id} $color={t.color} $bg={t.bg}
                  title={m.value === null || m.value === undefined
                    ? '계산할 근거가 없습니다'
                    : `${def.label}: ${m.value}${def.unit}`}>
                  {m.value === null || m.value === undefined ? '—' : m.value}
                  {m.value !== null && m.value !== undefined && <Unit>{def.unit}</Unit>}
                </ValueCell>
              );
            })}
          </React.Fragment>
        ))}
      </Grid>
    </Wrap>
  );
};

export default ObservedMatrix;
