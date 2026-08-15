import React from 'react';
import styled from 'styled-components';
import { ChevronUp, ChevronDown, Check } from 'lucide-react';
import { ACCENT, ACCENT_DARK, ACCENT_TINT, ACCENT_LINE } from '../../theme';

// 문항 하나를 그리는 자리. 유형은 넷이고(scale/choice/rank/text) **넷 다
// 여기서만 처리한다** — 폼 쪽에 유형별 분기를 흘리면 유형이 늘 때마다 두 군데를
// 고쳐야 하고, 한쪽을 빠뜨리면 답을 못 내는 문항이 조용히 생긴다.
//
// 답의 모양은 백엔드가 값을 어느 칸에 넣는지에 맞춘다(survey/routes.py:645-650):
//   scale  → 숫자        (value_number)
//   text   → 문자열      (value_text)
//   choice → 보기 값     (value_json)
//   rank   → 보기 값 배열 (value_json)

const Wrap = styled.div`
  padding: 1.125rem 1.25rem;
  background: white;
  border: 1px solid ${p => (p.$missing ? '#fca5a5' : '#e2e8f0')};
  border-radius: 0.5rem;
`;

const Text = styled.div`
  font-size: 0.9375rem;
  font-weight: 600;
  color: #1e293b;
  line-height: 1.6;
`;

const Required = styled.span`
  margin-left: 0.3rem;
  color: #dc2626;
  font-weight: 700;
`;

const Help = styled.div`
  margin-top: 0.3rem;
  font-size: 0.8125rem;
  color: #94a3b8;
  line-height: 1.6;
`;

// ── 척도 ──────────────────────────────────────────────────────────────────

const ScaleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.625rem;
  margin-top: 0.875rem;
  flex-wrap: wrap;
`;

const EndLabel = styled.span`
  font-size: 0.75rem;
  color: #94a3b8;
  font-weight: 600;
  white-space: nowrap;
`;

const Dots = styled.div`
  display: flex;
  gap: 0.375rem;
`;

const Dot = styled.button`
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.5rem;
  border: 1px solid ${p => (p.$on ? ACCENT : '#cbd5e1')};
  background: ${p => (p.$on ? ACCENT : 'white')};
  color: ${p => (p.$on ? 'white' : '#64748b')};
  font-size: 0.9375rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: ${ACCENT};
    color: ${p => (p.$on ? 'white' : ACCENT)};
  }
`;

// ── 객관식 ────────────────────────────────────────────────────────────────

const Options = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin-top: 0.875rem;
`;

const Option = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.75rem;
  text-align: left;
  border: 1px solid ${p => (p.$on ? ACCENT : '#e2e8f0')};
  background: ${p => (p.$on ? ACCENT_TINT : 'white')};
  color: ${p => (p.$on ? ACCENT_DARK : '#334155')};
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: ${p => (p.$on ? 600 : 400)};
  font-family: inherit;
  cursor: pointer;

  &:hover { border-color: ${ACCENT}; }
`;

const Mark = styled.span`
  flex-shrink: 0;
  width: 1.1rem;
  height: 1.1rem;
  border-radius: 999px;
  border: 1px solid ${p => (p.$on ? ACCENT : '#cbd5e1')};
  background: ${p => (p.$on ? ACCENT : 'white')};
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
`;

// ── 순위 ──────────────────────────────────────────────────────────────────

const RankRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.6rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  background: white;
  font-size: 0.875rem;
  color: #334155;
`;

const RankNo = styled.span`
  flex-shrink: 0;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 0.375rem;
  background: ${ACCENT_TINT};
  color: ${ACCENT_DARK};
  font-size: 0.75rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const MoveButton = styled.button`
  flex-shrink: 0;
  padding: 0.2rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.3rem;
  background: white;
  color: #64748b;
  cursor: pointer;
  display: flex;

  &:hover:not(:disabled) { border-color: ${ACCENT}; color: ${ACCENT}; }
  &:disabled { opacity: 0.3; cursor: not-allowed; }
`;

const ConfirmRank = styled.button`
  align-self: flex-start;
  margin-top: 0.25rem;
  padding: 0.35rem 0.7rem;
  border: 1px dashed ${ACCENT_LINE};
  border-radius: 0.375rem;
  background: transparent;
  color: ${ACCENT_DARK};
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;

  &:hover { background: ${ACCENT_TINT}; }
`;

// ── 자유서술 ──────────────────────────────────────────────────────────────

const Textarea = styled.textarea`
  width: 100%;
  margin-top: 0.875rem;
  padding: 0.625rem 0.75rem;
  min-height: 5rem;
  resize: vertical;
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-family: inherit;
  line-height: 1.6;
  color: #1e293b;

  &:focus { outline: none; border-color: ${ACCENT}; }
`;

const Note = styled.div`
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: #b45309;
  line-height: 1.6;
`;

/**
 * 보기를 한 모양으로 맞춘다. 문항의 options 는 자유 JSON 이라 저장된 모양이
 * 제각각일 수 있다 — 문자열 배열일 수도, {value,label} 배열일 수도 있다.
 */
export function normalizeChoices(options) {
  const raw = options?.choices ?? options?.options ?? [];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c, i) => (c && typeof c === 'object'
      ? { value: c.value ?? c.label ?? String(i), label: String(c.label ?? c.value ?? i) }
      : { value: c, label: String(c) }))
    .filter(c => c.label !== '');
}

/** 답이 실제로 들어 있는가. 필수 판정과 제출 payload 가 **같은 함수**를 쓴다. */
export function hasAnswer(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

const QuestionField = ({ question, index, value, onChange, missing }) => {
  const { qtype, options } = question;
  const choices = normalizeChoices(options);

  const renderInput = () => {
    if (qtype === 'scale') {
      // min/max 가 없는 옛 문항도 있을 수 있다. 1~5 가 기본이다.
      const min = Number(options?.min ?? 1);
      const max = Number(options?.max ?? 5);
      const steps = [];
      for (let n = min; n <= max; n += 1) steps.push(n);
      return (
        <ScaleRow>
          {options?.minLabel && <EndLabel>{options.minLabel}</EndLabel>}
          <Dots>
            {steps.map(n => (
              <Dot
                key={n}
                type="button"
                $on={Number(value) === n}
                onClick={() => onChange(n)}
                aria-pressed={Number(value) === n}
              >
                {n}
              </Dot>
            ))}
          </Dots>
          {options?.maxLabel && <EndLabel>{options.maxLabel}</EndLabel>}
        </ScaleRow>
      );
    }

    if (qtype === 'choice') {
      if (choices.length === 0) {
        // 보기 없이 저장된 객관식. 답할 방법이 없으면 막다른 길이라, 자유
        // 입력으로 내려 준다 — 값은 어차피 value_json 한 칸에 들어간다.
        return (
          <>
            <Textarea
              value={value ?? ''}
              onChange={e => onChange(e.target.value)}
              placeholder="답을 적어 주세요"
            />
            <Note>이 문항에는 보기가 등록돼 있지 않아 직접 적도록 두었습니다.</Note>
          </>
        );
      }
      return (
        <Options>
          {choices.map(c => {
            const on = value === c.value;
            return (
              <Option key={String(c.value)} type="button" $on={on}
                      onClick={() => onChange(on ? undefined : c.value)}>
                <Mark $on={on}>{on && <Check size={12} strokeWidth={3} />}</Mark>
                {c.label}
              </Option>
            );
          })}
        </Options>
      );
    }

    if (qtype === 'rank') {
      if (choices.length === 0) {
        return <Note>이 문항에는 순위를 매길 보기가 등록돼 있지 않습니다.</Note>;
      }
      // 아직 손대지 않았으면 등록된 순서를 그대로 보여준다. 다만 그 상태는
      // '답한 것'이 아니다 — 기본 순서를 자동으로 답으로 삼으면 아무도 생각
      // 안 한 순위가 집계에 섞인다. 그래서 확정 버튼을 따로 둔다.
      const order = Array.isArray(value) && value.length
        ? value
        : choices.map(c => c.value);
      const labelOf = (v) => choices.find(c => c.value === v)?.label ?? String(v);
      const move = (from, to) => {
        if (to < 0 || to >= order.length) return;
        const next = [...order];
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
        onChange(next);
      };
      return (
        <Options>
          {order.map((v, i) => (
            <RankRow key={String(v)}>
              <RankNo>{i + 1}</RankNo>
              <span style={{ flex: 1 }}>{labelOf(v)}</span>
              <MoveButton type="button" disabled={i === 0}
                          onClick={() => move(i, i - 1)} title="위로">
                <ChevronUp size={14} />
              </MoveButton>
              <MoveButton type="button" disabled={i === order.length - 1}
                          onClick={() => move(i, i + 1)} title="아래로">
                <ChevronDown size={14} />
              </MoveButton>
            </RankRow>
          ))}
          {!hasAnswer(value) && (
            <ConfirmRank type="button" onClick={() => onChange(order)}>
              이 순서 그대로 답하기
            </ConfirmRank>
          )}
        </Options>
      );
    }

    return (
      <Textarea
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        placeholder="자유롭게 적어 주세요"
      />
    );
  };

  return (
    <Wrap $missing={missing}>
      <Text>
        {index + 1}. {question.text}
        {question.required && <Required title="필수 문항">*</Required>}
      </Text>
      {question.help_text && <Help>{question.help_text}</Help>}
      {renderInput()}
    </Wrap>
  );
};

export default QuestionField;
