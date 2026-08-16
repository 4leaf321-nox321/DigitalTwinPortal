import React from 'react';
import styled from 'styled-components';

// 사업부별로 보기. ② 이슈와 ③ 분석이 같이 쓴다.
//
// 진단은 처음부터 사업부 × 축 격자였는데 이슈·분석은 전사로 뭉쳐 있었다.
// 데이터에는 `division_id` 가 있었는데 화면이 안 썼을 뿐이다.
//
// ⚠️ **사업부를 고르면 전사 항목도 같이 보인다.** MX 를 보는 사람에게 전사
//    이슈는 남의 것이 아니다 — MX 에도 적용된다. 대신 카드에 「전사」 표를 달아
//    그 항목이 MX 만의 것이 아님을 보인다.
//
// ⚠️ 항목이 하나도 없는 사업부도 **버튼은 남긴다.** 없는 것을 감추면 "그 사업부는
//    아직 아무것도 없다"는 사실이 안 보인다. 0 을 적어서 보여준다.

const Bar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
`;

const Label = styled.span`
  font-size: 0.75rem;
  font-weight: 700;
  color: #94a3b8;
  margin-right: 0.15rem;
`;

const Chip = styled.button`
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.6rem;
  border: 1px solid ${p => (p.$on ? '#7c3aed' : '#e2e8f0')};
  border-radius: 999px;
  background: ${p => (p.$on ? '#7c3aed' : 'white')};
  color: ${p => (p.$on ? 'white' : '#475569')};
  font-size: 0.8125rem;
  font-weight: ${p => (p.$on ? 700 : 500)};
  font-family: inherit;
  cursor: pointer;

  &:hover { border-color: #a78bfa; }
`;

const Num = styled.span`
  font-size: 0.6875rem;
  font-weight: 700;
  color: ${p => (p.$on ? 'rgba(255,255,255,0.75)' : '#94a3b8')};
  font-variant-numeric: tabular-nums;
`;

/**
 * value: null 이면 전체
 * counts: {divisionId: 건수, all: 전체 건수, company: 전사 건수}
 */
const DivisionFilter = ({ divisions, value, onChange, counts = {} }) => (
  <Bar role="group" aria-label="사업부별 보기">
    <Label>보기</Label>
    <Chip $on={value === null} onClick={() => onChange(null)}>
      전체 전략
      <Num $on={value === null}>{counts.all ?? 0}</Num>
    </Chip>
    {divisions.map(d => (
      <Chip key={d.id} $on={value === d.id} onClick={() => onChange(d.id)}
            title={`${d.name} 것과 전사 공통을 함께 봅니다`}>
        {d.name}
        <Num $on={value === d.id}>{counts[d.id] ?? 0}</Num>
      </Chip>
    ))}
  </Bar>
);

/** 이 항목이 지금 고른 사업부에서 보여야 하는가. **전사(비어 있음)는 언제나 보인다.** */
export const inDivision = (item, divisionId) => (
  divisionId === null || item.division_id === null
  || item.division_id === undefined || item.division_id === divisionId
);

/** 칩에 붙일 건수. 전사 항목은 사업부마다 같이 세어진다 — 화면에 그렇게 보이므로. */
export const countByDivision = (items, divisions) => {
  const counts = { all: items.length, company: 0 };
  divisions.forEach(d => { counts[d.id] = 0; });
  items.forEach(item => {
    if (item.division_id === null || item.division_id === undefined) {
      counts.company += 1;
      divisions.forEach(d => { counts[d.id] += 1; });
    } else if (counts[item.division_id] !== undefined) {
      counts[item.division_id] += 1;
    }
  });
  return counts;
};

export default DivisionFilter;
