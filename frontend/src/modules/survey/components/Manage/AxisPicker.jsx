import React from 'react';
import styled from 'styled-components';
import { ACCENT, ACCENT_DARK, ACCENT_LINE, ACCENT_TINT } from '../../theme';

// 역할·프로세스를 고르는 자리.
//
// **자유 텍스트로 두면 안 된다.** 오타 하나로 '개발'과 '개발 '이 다른 대상이
// 되어 한쪽 문항이 아무에게도 안 보이고, 그 사실은 응답이 들어와 문항이 잠긴
// 뒤에야 드러난다. 그래서 서버가 아는 값만 고르게 한다.
//
// 목록은 `GET /api/surveys/manage/options` 가 준다. 화면이 자기 목록을
// 하드코딩하면 서버가 받는 값과 갈린다 — 화면엔 있는데 저장하면 400 이 나거나,
// 화면엔 없는 값이 표로는 들어간다.

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
`;

const Label = styled.span`
  font-size: 0.8125rem;
  font-weight: 600;
  color: #475569;
`;

const Options = styled.div`
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
`;

const Option = styled.button`
  padding: 0.3rem 0.65rem;
  border-radius: 0.375rem;
  border: 1px solid ${p => (p.$on ? ACCENT : '#cbd5e1')};
  background: ${p => (p.$on ? ACCENT_TINT : 'white')};
  color: ${p => (p.$on ? ACCENT_DARK : '#64748b')};
  font-size: 0.8125rem;
  font-weight: ${p => (p.$on ? 700 : 500)};
  font-family: inherit;
  cursor: pointer;
  &:hover { border-color: ${p => (p.$on ? ACCENT : ACCENT_LINE)}; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const Hint = styled.span`
  font-size: 0.75rem;
  color: #94a3b8;
  line-height: 1.6;
`;

const Empty = styled.span`
  font-size: 0.75rem;
  color: #b45309;
`;

/**
 * @param {string[]} options  고를 수 있는 값 (서버가 준 것)
 * @param {string[]} value    지금 고른 값
 * @param {string}   emptyMeans  아무것도 안 골랐을 때의 뜻. 이걸 반드시 적는다 —
 *                   빈 상태의 뜻이 자리마다 다르다. 설문의 축은 '안 물음',
 *                   문항의 대상은 '전원'이다. 안 적으면 정반대로 읽힌다.
 */
const AxisPicker = ({
  label, options = [], value = [], onChange, disabled, emptyMeans, hint,
}) => {
  const toggle = (name) => {
    const next = value.includes(name)
      ? value.filter(v => v !== name)
      : [...value, name];
    // 고른 순서가 아니라 **목록 순서**로 맞춘다. 순서가 화면마다 달라지면
    // 응답자가 보는 선택지 순서도 설문마다 뒤바뀐다.
    onChange(options.filter(o => next.includes(o)));
  };

  return (
    <Wrap>
      {label && <Label>{label}</Label>}
      {options.length === 0 ? (
        <Empty>고를 수 있는 값이 없습니다. 대시보드 설정을 확인하세요.</Empty>
      ) : (
        <Options>
          {options.map(name => (
            <Option
              key={name}
              type="button"
              $on={value.includes(name)}
              disabled={disabled}
              onClick={() => toggle(name)}
            >
              {name}
            </Option>
          ))}
        </Options>
      )}
      {value.length === 0 && emptyMeans && <Hint>아무것도 안 고르면 — {emptyMeans}</Hint>}
      {hint && <Hint>{hint}</Hint>}
    </Wrap>
  );
};

export default AxisPicker;
