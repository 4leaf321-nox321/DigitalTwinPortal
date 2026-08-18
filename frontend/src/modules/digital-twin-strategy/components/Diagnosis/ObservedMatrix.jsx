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

  /* ⚠️ **누를 수 있다는 것이 보여야 한다.** 숫자가 눌린다는 걸 모르면 그 기능은
     없는 것과 같다. 밑줄을 옅게 깔아 두고 올리면 진해진다. */
  ${p => p.$clickable && `
    cursor: pointer;
    text-decoration: underline dotted rgba(100, 116, 139, 0.45);
    text-underline-offset: 3px;
    &:hover {
      background: #f5f3ff;
      text-decoration-color: #7c3aed;
    }
  `}
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

// 근접으로 볼 범위. 기준의 10% 안쪽이면 아직 안 걸렸어도 노랗게 둔다.
const NEAR = 0.1;

// 색은 **⚙설정의 임계값을 그대로 쓴다.** 여기에 숫자를 따로 박으면 설정에서
// 기준을 바꿔도 색이 안 따라가서, 발견 사항에서는 사라졌는데 칸은 계속 붉은
// 상태가 된다. 지표↔임계값 짝은 백엔드가 /meta 로 내려준다(definitions.py).
//
//   붉음   기준을 넘음 — 발견 사항에 뜨는 것과 같은 값
//   노랑   아직 안 넘었지만 기준에 가까움
//   초록   여유 있음
function tone(value, direction, limit) {
  if (value === null || value === undefined) return { color: '#cbd5e1' };
  if (direction === 'neutral') return { color: '#0f172a' };
  // 짝이 없거나 설정을 아직 못 받았으면 칠하지 않는다.
  // 근거 없이 칠하느니 안 칠하는 편이 낫다.
  if (typeof limit !== 'number') return { color: '#0f172a' };

  const lower = direction === 'lower';       // 낮을수록 좋은 지표
  const bad = lower ? value >= limit : value <= limit;
  const near = lower
    ? value >= limit * (1 - NEAR)
    : value <= limit * (1 + NEAR);

  if (bad) return { color: '#b91c1c', bg: '#fef2f2' };
  if (near) return { color: '#b45309', bg: '#fffbeb' };
  return { color: '#047857' };
}

const ObservedMatrix = ({ definitions, divisions, metrics, thresholds, onOpen }) => {
  const byKey = {};
  (metrics || []).forEach(m => {
    byKey[`${m.division_id}:${m.metric_key}`] = m;
  });

  const limitOf = (def) => (thresholds || {})[def.threshold_key];

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
              const limit = limitOf(def);
              const t = tone(m.value, def.direction, limit);
              const empty = m.value === null || m.value === undefined;
              // 왜 이 색인지 칸에서 바로 확인되게 한다. 기준을 모르면
              // 붉은 칸을 보고도 얼마나 나쁜지 알 수 없다.
              const limitText = typeof limit === 'number'
                ? ` · 기준 ${def.direction === 'lower' ? '≥' : '≤'} ${limit}${def.unit}`
                : '';
              // 근거가 없는 칸은 눌러도 보여줄 것이 없다.
              const clickable = !empty && !!onOpen;
              return (
                <ValueCell key={d.id} $color={t.color} $bg={t.bg}
                  $clickable={clickable}
                  onClick={clickable ? () => onOpen(def, d) : undefined}
                  title={empty
                    ? '계산할 근거가 없습니다'
                    : `${def.label}: ${m.value}${def.unit}${limitText}`
                      + (clickable ? ' · 눌러서 셈법과 과제 보기' : '')}>
                  {empty ? '—' : m.value}
                  {!empty && <Unit>{def.unit}</Unit>}
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
