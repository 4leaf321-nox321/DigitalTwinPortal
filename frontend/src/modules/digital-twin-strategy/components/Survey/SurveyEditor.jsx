import React, { useState } from 'react';
import styled from 'styled-components';
import { Plus, Trash2, Wand2, GripVertical } from 'lucide-react';

// 설문 하나를 짓는 자리.
//
// **매번 백지에서 설문을 설계하면 아무도 안 씁니다.** 그래서 진단의 조직 역량
// 5축을 한 번에 채우는 버튼을 둔다. 그 5축은 시스템이 알 방법이 없어 설문이
// 정석인 항목들이고(definitions.py 의 survey_recommended), 문항에
// link_dimension 이 붙어야 나중에 집계값이 진단 칸으로 들어갈 수 있다.

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #475569;
`;

const Input = styled.input`
  padding: 0.5rem 0.75rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.375rem;
  font-size: 0.9375rem;
  font-family: inherit;
  font-weight: 400;
  color: #1e293b;
  &:focus { outline: none; border-color: #a78bfa; }
`;

const Textarea = styled(Input).attrs({ as: 'textarea' })`
  font-size: 0.8125rem;
  min-height: 3rem;
  resize: vertical;
`;

const Select = styled.select`
  padding: 0.45rem 0.6rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  font-family: inherit;
  background: white;
  color: #1e293b;
`;

const Row = styled.div`
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  align-items: flex-end;
`;

const SectionHead = styled.div`
  display: flex;
  align-items: center;
  gap: 0.625rem;
  margin-top: 0.5rem;
`;

const SectionTitle = styled.h4`
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 700;
  color: #1e293b;
`;

const Hint = styled.span`
  font-size: 0.8125rem;
  color: #94a3b8;
`;

const GhostButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.35rem 0.7rem;
  border: 1px dashed #c4b5fd;
  border-radius: 0.375rem;
  background: transparent;
  color: #7c3aed;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  &:hover { background: #f5f3ff; }
`;

const QuestionCard = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  padding: 0.75rem 0.875rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
`;

const Handle = styled.div`
  color: #cbd5e1;
  padding-top: 0.35rem;
  flex-shrink: 0;
`;

const QBody = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const IconButton = styled.button`
  flex-shrink: 0;
  padding: 0.3rem;
  border: none;
  border-radius: 0.3rem;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  display: flex;
  &:hover { background: #fef2f2; color: #dc2626; }
`;

const LinkTag = styled.span`
  align-self: flex-start;
  padding: 0.1rem 0.45rem;
  border-radius: 0.25rem;
  font-size: 0.6875rem;
  font-weight: 700;
  background: #ede9fe;
  color: #6d28d9;
`;

const Actions = styled.div`
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  margin-top: 0.5rem;
`;

const Button = styled.button`
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  border: 1px solid ${p => (p.$primary ? 'transparent' : '#cbd5e1')};
  background: ${p => (p.$primary ? '#7c3aed' : 'white')};
  color: ${p => (p.$primary ? 'white' : '#64748b')};
  &:hover { opacity: 0.9; }
  &:disabled { opacity: 0.45; cursor: not-allowed; }
`;

const Locked = styled.div`
  padding: 0.75rem 0.875rem;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 0.375rem;
  color: #92400e;
  font-size: 0.8125rem;
  line-height: 1.55;
`;

const QTYPES = [
  { value: 'scale', label: '척도 1~5' },
  { value: 'choice', label: '객관식' },
  { value: 'rank', label: '순위' },
  { value: 'text', label: '자유서술' },
];

const TARGETS = [
  { value: 'all', label: '전사' },
  { value: 'role', label: '역할' },
  { value: 'department', label: '부서' },
  { value: 'user', label: '지정 인원' },
];

const emptyQuestion = () => ({
  text: '', qtype: 'scale', required: true, options: { min: 1, max: 5 },
  link_category: null, link_dimension: null,
});

const SurveyEditor = ({ survey, categories, onSave, onCancel }) => {
  const locked = (survey?.response_count || 0) > 0;
  const [form, setForm] = useState({
    title: survey?.title || '',
    description: survey?.description || '',
    target_type: survey?.target_type || 'all',
    target_refs: (survey?.target_refs || []).join(', '),
  });
  const [questions, setQuestions] = useState(
    survey?.questions?.length ? survey.questions.map(q => ({ ...q })) : [emptyQuestion()]
  );

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));
  const setQ = (i, patch) =>
    setQuestions(qs => qs.map((q, n) => (n === i ? { ...q, ...patch } : q)));

  // 진단의 조직 역량 5축을 그대로 문항으로 옮긴다. link_dimension 이 붙어 있어야
  // 나중에 집계값이 그 축의 현재 수준 후보로 들어갈 수 있다.
  const fillFromDiagnosis = () => {
    const org = (categories || []).find(c => c.key === 'organization');
    if (!org) return;
    setQuestions(org.dimensions.map(d => ({
      text: `우리 조직의 '${d.label}' 는 어느 수준입니까? — ${d.question}`,
      help_text: d.detail,
      qtype: 'scale',
      required: true,
      options: { min: 1, max: 5, minLabel: '없음', maxLabel: '지속 개선' },
      link_category: 'organization',
      link_dimension: d.key,
    })));
  };

  const submit = () => {
    const refs = form.target_refs
      .split(',').map(s => s.trim()).filter(Boolean)
      .map(s => (/^\d+$/.test(s) ? Number(s) : s));
    const payload = {
      title: form.title.trim(),
      description: form.description || null,
      target_type: form.target_type,
      target_refs: form.target_type === 'all' ? [] : refs,
    };
    // 응답이 있으면 문항은 아예 보내지 않는다. 서버도 막지만, 화면에서
    // 보내놓고 409 를 받는 것보다 안 보내는 편이 낫다.
    if (!locked) payload.questions = questions.filter(q => q.text.trim());
    onSave(payload);
  };

  const valid = form.title.trim() &&
    (locked || questions.some(q => q.text.trim()));

  return (
    <Wrap>
      <Field>
        제목
        <Input value={form.title} onChange={set('title')}
               placeholder="예: 2026년 조직 역량 진단 설문" />
      </Field>

      <Field>
        설명 (선택)
        <Textarea value={form.description} onChange={set('description')}
                  placeholder="무엇을 위한 설문인지 응답자에게 알립니다" />
      </Field>

      <Row>
        <Field>
          대상
          <Select value={form.target_type} onChange={set('target_type')}>
            {TARGETS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
        </Field>
        {form.target_type !== 'all' && (
          <Field style={{ flex: 1, minWidth: '16rem' }}>
            {form.target_type === 'role' ? '역할 (쉼표로 구분: user, manager)'
              : form.target_type === 'department' ? '부서명 (쉼표로 구분)'
              : '사용자 id (쉼표로 구분)'}
            <Input value={form.target_refs} onChange={set('target_refs')} />
          </Field>
        )}
      </Row>

      <SectionHead>
        <SectionTitle>문항</SectionTitle>
        <Hint>{questions.length}개</Hint>
        {!locked && (
          <GhostButton onClick={fillFromDiagnosis}
                       title="진단의 조직 역량 5축을 문항으로 채웁니다">
            <Wand2 size={14} /> 조직 역량 5축으로 채우기
          </GhostButton>
        )}
      </SectionHead>

      {locked ? (
        <Locked>
          이미 응답이 들어와 <strong>문항은 수정할 수 없습니다.</strong> 문항을
          바꾸면 이미 받은 답이 무엇에 대한 답이었는지 알 수 없게 됩니다.
          바꿔야 한다면 새 설문을 만드세요.
        </Locked>
      ) : (
        <>
          {questions.map((q, i) => (
            <QuestionCard key={i}>
              <Handle><GripVertical size={16} /></Handle>
              <QBody>
                <Input value={q.text} onChange={e => setQ(i, { text: e.target.value })}
                       placeholder={`${i + 1}번 문항`} />
                <Row>
                  <Select value={q.qtype} onChange={e => setQ(i, { qtype: e.target.value })}>
                    {QTYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </Select>
                  <label style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                    <input type="checkbox" checked={q.required}
                           onChange={e => setQ(i, { required: e.target.checked })} />
                    {' '}필수
                  </label>
                </Row>
                {q.link_dimension && (
                  <LinkTag>진단 연결 · {q.link_dimension}</LinkTag>
                )}
              </QBody>
              {questions.length > 1 && (
                <IconButton onClick={() => setQuestions(qs => qs.filter((_, n) => n !== i))}
                            title="문항 삭제">
                  <Trash2 size={15} />
                </IconButton>
              )}
            </QuestionCard>
          ))}
          <GhostButton onClick={() => setQuestions(qs => [...qs, emptyQuestion()])}
                       style={{ alignSelf: 'flex-start' }}>
            <Plus size={14} /> 문항 추가
          </GhostButton>
        </>
      )}

      <Actions>
        <Button onClick={onCancel}>취소</Button>
        <Button $primary onClick={submit} disabled={!valid}>저장</Button>
      </Actions>
    </Wrap>
  );
};

export default SurveyEditor;
