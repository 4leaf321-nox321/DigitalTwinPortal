import React from 'react';
import styled from 'styled-components';

/**
 * 여러 개를 함께 고르는 걸개 토글.
 *
 * 드롭다운은 한 번에 하나뿐이고 무엇이 골라져 있는지 열어 봐야 안다.
 * 걸개는 고른 것이 늘 보이고 둘 이상을 함께 걸 수 있다.
 * 아무것도 안 고르면 「전체」다.
 */

const Group = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-wrap: wrap;
`;

const Label = styled.span`
  font-size: 0.78rem;
  font-weight: 600;
  color: #64748b;
  margin-right: 0.15rem;
`;

const Chip = styled.button`
  padding: 0.3rem 0.6rem;
  border-radius: 999px;
  border: 1px solid ${props => (props.$active ? '#4f46e5' : '#e2e8f0')};
  background: ${props => (props.$active ? '#4f46e5' : 'white')};
  color: ${props => (props.$active ? 'white' : '#475569')};
  font-size: 0.78rem;
  font-weight: ${props => (props.$active ? 700 : 500)};
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;

  &:hover {
    border-color: #4f46e5;
    color: ${props => (props.$active ? 'white' : '#4338ca')};
    background: ${props => (props.$active ? '#4338ca' : '#eef2ff')};
  }
`;

/** 고른 것을 넣거나 뺀다. */
export const toggleValue = (selected = [], value) =>
  (selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]);

const ToggleFilter = ({ label, options = [], selected = [], onChange }) => {
  if (options.length === 0) return null;

  return (
    <Group>
      <Label>{label}</Label>
      <Chip
        type="button"
        $active={selected.length === 0}
        onClick={() => onChange([])}
        title={`${label} 전체 보기`}
      >
        전체
      </Chip>
      {options.map(opt => (
        <Chip
          key={opt}
          type="button"
          $active={selected.includes(opt)}
          onClick={() => onChange(toggleValue(selected, opt))}
        >
          {opt}
        </Chip>
      ))}
    </Group>
  );
};

export default ToggleFilter;
