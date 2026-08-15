import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Plus, Trash2, Wand2, GripVertical } from 'lucide-react';
import { QUESTION_TEMPLATES, linkKeyLabel } from '../../constants/questionTemplates';
import { ACCENT, ACCENT_DARK, ACCENT_LINE, ACCENT_TINT } from '../../theme';

// 설문 하나를 짓는 자리.
//
// **매번 백지에서 설문을 설계하면 아무도 안 씁니다.** 그래서 자주 쓰는 문항
// 묶음을 버튼 하나로 채운다. 그 템플릿은 이 모듈 안의 상수다
// (constants/questionTemplates.js) — 전략 API 를 부르면 백엔드에서 지킨 모듈
// 독립성이 프론트에서 깨진다.
//
// ⚠️ 템플릿 문항에는 link_type/link_key 가 붙어 있어야 나중에 집계값이 진단
// 칸으로 들어갈 수 있다. 옛 이름(link_category/link_dimension)으로 보내면
// 백엔드가 **에러 없이 201 을 주고 link 만 NULL 로 저장한다** — 겉보기엔 멀쩡한데
// 연결이 영영 안 되는, 제일 잡기 어려운 종류의 고장이다.

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
  &:focus { outline: none; border-color: ${ACCENT}; }
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
  flex-wrap: wrap;
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
  background: ${ACCENT_TINT};
  color: ${ACCENT_DARK};
`;

// 분기·섹션 표식. 역할·프로세스가 걸린 문항은 테두리를 줘서 '전원이 보는 문항'과
// 눈으로 갈라 보이게 한다.
const MetaTag = styled.span`
  align-self: flex-start;
  padding: 0.1rem 0.45rem;
  border-radius: 0.25rem;
  font-size: 0.6875rem;
  font-weight: 700;
  background: ${p => (p.$limit ? '#fffbeb' : '#f1f5f9')};
  border: 1px solid ${p => (p.$limit ? '#fde68a' : 'transparent')};
  color: ${p => (p.$limit ? '#b45309' : '#64748b')};
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
  background: ${p => (p.$primary ? ACCENT : 'white')};
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

const CHOICE_TYPES = new Set(['choice', 'rank']);

const emptyQuestion = () => ({
  text: '', help_text: '', qtype: 'scale', required: true,
  options: { min: 1, max: 5 },
  link_type: null, link_key: null,
});

/** options.choices ↔ 여러 줄 텍스트. 보기를 한 줄에 하나씩 적게 하는 편이
 *  쉼표보다 낫다 — 보기 안에 쉼표가 들어가는 경우가 실제로 많다. */
const choicesToText = (options) => {
  const raw = options?.choices;
  if (!Array.isArray(raw)) return '';
  return raw.map(c => (c && typeof c === 'object' ? (c.label ?? c.value ?? '') : c)).join('\n');
};
const textToChoices = (text) =>
  text.split('\n').map(s => s.trim()).filter(Boolean);

const SurveyEditor = ({ survey, onSave, onCancel }) => {
  const locked = (survey?.response_count || 0) > 0;
  // 문항 번호 -> 보기 입력의 원문. 문항 개수가 바뀌면(추가·삭제·템플릿)
  // 번호가 밀리므로 통째로 버린다 — 남은 초안이 엉뚱한 문항에 붙는 것보다 낫다.
  const [choiceDraft, setChoiceDraft] = useState({});
  const [form, setForm] = useState({
    title: survey?.title || '',
    description: survey?.description || '',
    target_type: survey?.target_type || 'all',
    target_refs: (survey?.target_refs || []).join(', '),
  });
  const [questions, setQuestions] = useState(
    survey?.questions?.length ? survey.questions.map(q => ({ ...q })) : [emptyQuestion()]
  );

  // 문항 개수가 바뀌면 보기 초안을 버린다(번호가 밀린다).
  useEffect(() => { setChoiceDraft({}); }, [questions.length]);

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));
  const setQ = (i, patch) =>
    setQuestions(qs => qs.map((q, n) => (n === i ? { ...q, ...patch } : q)));
  const setOpt = (i, patch) =>
    setQuestions(qs => qs.map((q, n) => (
      n === i ? { ...q, options: { ...(q.options || {}), ...patch } } : q
    )));

  // 템플릿은 배열을 그대로 버튼으로 편다. 템플릿이 없으면 버튼도 안 뜬다 —
  // 템플릿을 늘리거나 줄이는 데 이 파일을 고칠 필요가 없다.
  const fillFromTemplate = (template) => setQuestions(template.build());

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
    if (!locked) {
      payload.questions = questions
        .filter(q => q.text.trim())
        .map((q, i) => ({
          order: i,
          text: q.text.trim(),
          help_text: q.help_text || null,
          qtype: q.qtype,
          required: !!q.required,
          options: q.options || {},
          // 옛 이름으로 보내면 조용히 버려진다. 이 두 키가 정확해야 한다.
          link_type: q.link_type ?? null,
          link_key: q.link_key ?? null,
          // ⚠️ **이 세 칸을 빠뜨리면 분기가 통째로 지워진다.**
          //
          // 서버의 _apply_questions 는 문항을 통째로 지우고 보낸 것으로 다시
          // 만든다. 그래서 여기서 안 실은 칸은 기본값(빈 값)이 된다 — 표로
          // 만든 설문을 이 화면에서 제목만 고치고 저장해도 역할·프로세스
          // 분기가 전부 날아간다. 화면에 안 보이는 값이라 아무도 눈치 못 챈다.
          section: q.section ?? null,
          audience_roles: q.audience_roles || [],
          audience_processes: q.audience_processes || [],
        }));
    }
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
        {!locked && QUESTION_TEMPLATES.map(t => (
          <GhostButton key={t.id} onClick={() => fillFromTemplate(t)} title={t.hint}>
            <Wand2 size={14} /> {t.label}
          </GhostButton>
        ))}
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
                <Textarea value={q.help_text || ''}
                          onChange={e => setQ(i, { help_text: e.target.value })}
                          placeholder="도움말 (선택) — 무엇을 묻는지 풀어 씁니다" />
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

                {/* 척도의 양끝 라벨. 숫자만 있는 1~5 는 응답자마다 다른 뜻으로
                    읽혀서 집계가 흔들린다. */}
                {q.qtype === 'scale' && (
                  <Row>
                    <Field>
                      1점 라벨
                      <Input value={q.options?.minLabel || ''}
                             onChange={e => setOpt(i, { minLabel: e.target.value })}
                             placeholder="예: 없음" />
                    </Field>
                    <Field>
                      5점 라벨
                      <Input value={q.options?.maxLabel || ''}
                             onChange={e => setOpt(i, { maxLabel: e.target.value })}
                             placeholder="예: 지속 개선" />
                    </Field>
                  </Row>
                )}

                {/* 보기가 없는 객관식·순위는 응답 화면에서 막다른 길이 된다.
                    만들 때 여기서 받아 둔다. */}
                {CHOICE_TYPES.has(q.qtype) && (
                  <Field>
                    보기 (한 줄에 하나)
                    <Textarea
                      value={choiceDraft[i] ?? choicesToText(q.options)}
                      onChange={e => {
                        const raw = e.target.value;
                        setChoiceDraft(d => ({ ...d, [i]: raw }));
                        setOpt(i, { choices: textToChoices(raw) });
                      }}
                      onBlur={() => setChoiceDraft(d => {
                        // 손을 떼면 정규화된 모습으로 정리해 보여준다.
                        const { [i]: _drop, ...rest } = d;
                        return rest;
                      })}
                      placeholder={'첫 번째 보기\n두 번째 보기'} />
                  </Field>
                )}

                {/* 분기가 걸린 문항은 **보이게** 둔다.
                    이 화면에서 편집할 수단은 아직 없지만(표로 만든다), 보이지도
                    않으면 "이 문항은 전원이 본다"고 오해한 채 지우거나 순서를
                    바꾼다. 값이 있다는 사실만이라도 알려야 한다. */}
                {q.section && <MetaTag>섹션 · {q.section}</MetaTag>}
                {q.audience_roles?.length > 0 && (
                  <MetaTag $limit>역할 · {q.audience_roles.join(', ')}</MetaTag>
                )}
                {q.audience_processes?.length > 0 && (
                  <MetaTag $limit>프로세스 · {q.audience_processes.join(', ')}</MetaTag>
                )}
                {q.link_key && (
                  // 'organization:readiness' 를 그대로 찍으면 사람이 못 읽는다.
                  <LinkTag>진단 연결 · {linkKeyLabel(q.link_key)}</LinkTag>
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
