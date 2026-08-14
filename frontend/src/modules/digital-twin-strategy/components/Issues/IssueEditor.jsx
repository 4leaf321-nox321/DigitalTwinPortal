import React, { useState } from 'react';
import styled from 'styled-components';

// 이슈 하나를 쓰는 자리. 추가와 수정이 같은 폼을 쓴다.
//
// 영향도·실행가능성은 **비워둘 수 있다.** 근거 없이 매긴 점수는 판단을 돕지
// 못한다 — 진단 격자에서 배운 것과 같다. 필요할 때만 매긴다.
//
// 핵심 난제는 **이미 정해져서 들어오면 다시 묻지 않는다**(lockedCrux). 난제
// 카드 안에서 '이슈 추가'를 눌렀는데 드롭다운이 뜨면, 이미 고른 것을 또
// 고르라는 말로 읽힌다. 옮기는 것은 드문 일이라 한 번 더 누르게 둔다.

const Form = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  padding: 1rem 1.125rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
`;

const Input = styled.input`
  padding: 0.5rem 0.75rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.375rem;
  font-size: 0.9375rem;
  font-family: inherit;
  color: #1e293b;

  &:focus { outline: none; border-color: #a78bfa; }
`;

const Textarea = styled.textarea`
  padding: 0.5rem 0.75rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  font-family: inherit;
  color: #475569;
  resize: vertical;
  min-height: 3.5rem;

  &:focus { outline: none; border-color: #a78bfa; }
`;

const Row = styled.div`
  display: flex;
  gap: 1.25rem;
  flex-wrap: wrap;
  align-items: center;
`;

const Field = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: #64748b;
`;

const Select = styled.select`
  padding: 0.3rem 0.5rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  font-family: inherit;
  color: #1e293b;
  background: white;
`;

const Actions = styled.div`
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
`;

const Button = styled.button`
  padding: 0.45rem 0.9rem;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid ${p => (p.$primary ? 'transparent' : '#cbd5e1')};
  background: ${p => (p.$primary ? '#7c3aed' : 'white')};
  color: ${p => (p.$primary ? 'white' : '#64748b')};

  &:hover { opacity: 0.9; }
  &:disabled { opacity: 0.45; cursor: not-allowed; }
`;

const LockedCrux = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.55rem;
  border-radius: 0.3rem;
  background: #f5f3ff;
  color: #6d28d9;
  font-size: 0.8125rem;
  font-weight: 600;
  max-width: 22rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const LinkButton = styled.button`
  padding: 0;
  border: none;
  background: transparent;
  color: #94a3b8;
  font-size: 0.75rem;
  font-family: inherit;
  cursor: pointer;
  text-decoration: underline;

  &:hover { color: #64748b; }
`;

const SCORES = [1, 2, 3, 4, 5];

const IssueEditor = ({ issue, cruxes, divisions, lockedCrux, onSave, onCancel }) => {
  // 난제를 옮기는 것은 드문 일이다. 눌러야 드롭다운이 나온다.
  const [moving, setMoving] = useState(false);
  const [form, setForm] = useState({
    title: issue?.title || '',
    description: issue?.description || '',
    root_cause: issue?.root_cause || '',
    crux_id: issue?.crux_id ?? '',
    division_id: issue?.division_id ?? '',
    impact: issue?.impact ?? '',
    feasibility: issue?.feasibility ?? '',
  });

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const submit = () => {
    if (!form.title.trim()) return;
    onSave({
      title: form.title.trim(),
      description: form.description || null,
      root_cause: form.root_cause || null,
      // 빈 문자열은 "안 고름"이다. null 로 보내야 서버가 비운다.
      crux_id: form.crux_id === '' ? null : Number(form.crux_id),
      division_id: form.division_id === '' ? null : Number(form.division_id),
      impact: form.impact === '' ? null : Number(form.impact),
      feasibility: form.feasibility === '' ? null : Number(form.feasibility),
      // 어디서 온 이슈인지는 폼에 없지만 그대로 지켜야 한다. 진단 격차에서
      // 가져온 것은 그 사실이 남아야 후보 목록에서 다시 안 뜬다.
      ...(issue?.source_type ? { source_type: issue.source_type } : {}),
      ...(issue?.source_ref ? { source_ref: issue.source_ref } : {}),
    });
  };

  return (
    <Form>
      <Input
        autoFocus
        value={form.title}
        onChange={set('title')}
        placeholder="무엇을 해야 합니까? (예: 과제 등록 시 성과 정의를 필수로 만든다)"
      />
      <Textarea
        value={form.description}
        onChange={set('description')}
        placeholder="무엇이 문제인가 (선택)"
      />
      <Textarea
        value={form.root_cause}
        onChange={set('root_cause')}
        placeholder="왜 아직 안 풀렸는가 — 여기가 비어 있으면 대개 증상만 적은 것입니다 (선택)"
      />

      <Row>
        <Field>
          핵심 난제
          {lockedCrux && !moving ? (
            <>
              <LockedCrux title={lockedCrux.title}>{lockedCrux.title}</LockedCrux>
              <LinkButton onClick={() => setMoving(true)}>옮기기</LinkButton>
            </>
          ) : (
            <Select value={form.crux_id} onChange={set('crux_id')}>
              <option value="">— 없음 —</option>
              {cruxes.map(c => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </Select>
          )}
        </Field>

        <Field>
          사업부
          <Select value={form.division_id} onChange={set('division_id')}>
            <option value="">전사</option>
            {divisions.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </Select>
        </Field>

        <Field title="풀면 얼마나 달라지는가. 근거가 없으면 비워두세요.">
          영향도
          <Select value={form.impact} onChange={set('impact')}>
            <option value="">—</option>
            {SCORES.map(n => <option key={n} value={n}>{n}</option>)}
          </Select>
        </Field>

        <Field title="올해 손댈 수 있는가. 근거가 없으면 비워두세요.">
          실행가능성
          <Select value={form.feasibility} onChange={set('feasibility')}>
            <option value="">—</option>
            {SCORES.map(n => <option key={n} value={n}>{n}</option>)}
          </Select>
        </Field>
      </Row>

      <Actions>
        <Button onClick={onCancel}>취소</Button>
        <Button $primary onClick={submit} disabled={!form.title.trim()}>저장</Button>
      </Actions>
    </Form>
  );
};

export default IssueEditor;
