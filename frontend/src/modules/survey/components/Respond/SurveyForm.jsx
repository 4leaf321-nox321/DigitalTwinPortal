import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { ArrowLeft, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import surveyApi from '../../services/surveyApi';
import AnonymityNotice from './AnonymityNotice';
import QuestionField, { hasAnswer } from './QuestionField';
import { ACCENT, ACCENT_DARK, ACCENT_TINT, READING_WIDTH } from '../../theme';

// 설문 한 벌에 답하는 자리.
//
// 폭을 READING_WIDTH(52rem)로 좁힌다. 글이 많은 화면이라 1440px 를 그대로 쓰면
// 한 줄이 너무 길어져 읽는 눈이 줄을 놓친다. 모듈 껍데기는 포탈 공통 폭을
// 쓰고, 읽고 답하는 이 화면만 그 안에서 더 좁힌다.

const Wrap = styled.div`
  max-width: ${READING_WIDTH};
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
`;

const Back = styled.button`
  display: flex;
  align-items: center;
  gap: 0.3rem;
  align-self: flex-start;
  padding: 0;
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  &:hover { color: ${ACCENT}; }
`;

const Title = styled.h2`
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.4;
`;

const Description = styled.p`
  margin: 0;
  font-size: 0.875rem;
  color: #64748b;
  line-height: 1.7;
  white-space: pre-wrap;
`;

const Deadline = styled.div`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8125rem;
  color: #b45309;
  font-weight: 600;
`;

const Card = styled.div`
  padding: 1rem 1.25rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
`;

const SectionLabel = styled.div`
  font-size: 0.8125rem;
  font-weight: 700;
  color: #475569;
  margin-bottom: 0.5rem;
`;

const Select = styled.select`
  width: 100%;
  max-width: 20rem;
  padding: 0.5rem 0.7rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-family: inherit;
  background: white;
  color: #1e293b;
  &:focus { outline: none; border-color: ${ACCENT}; }
`;

const Note = styled.div`
  margin-top: 0.5rem;
  font-size: 0.8125rem;
  color: #94a3b8;
  line-height: 1.65;
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  justify-content: flex-end;
  padding-bottom: 1rem;
`;

// ⚠️ 막힌 상태에서도 **눌리기는 해야 한다.** HTML 의 disabled 를 걸면 클릭
// 자체가 안 잡혀서 "무엇이 빠졌는지" 알려줄 기회가 없어지고, 사용자는 버튼이
// 왜 안 먹는지 모른 채 화면을 뒤진다. 그래서 막힌 티는 내되(회색 + not-allowed)
// 클릭은 받아서 빠진 문항 목록을 펼친다. 진짜 disabled 는 제출 중일 때뿐이다.
const Submit = styled.button`
  padding: 0.625rem 1.5rem;
  border: none;
  border-radius: 0.5rem;
  background: ${p => (p.$blocked ? '#cbd5e1' : ACCENT)};
  color: white;
  font-size: 0.9375rem;
  font-weight: 700;
  font-family: inherit;
  cursor: ${p => (p.$blocked ? 'not-allowed' : 'pointer')};
  &:hover:not(:disabled) { background: ${p => (p.$blocked ? '#cbd5e1' : ACCENT_DARK)}; }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const Blocked = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.875rem 1rem;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 0.5rem;
  color: #9a3412;
  font-size: 0.8125rem;
  line-height: 1.65;
`;

const ErrorBox = styled.div`
  padding: 0.75rem 1rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.5rem;
  color: #b91c1c;
  font-size: 0.8125rem;
  line-height: 1.6;
`;

const Done = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  padding: 2.5rem 1.5rem;
  background: white;
  border: 1px solid ${ACCENT};
  border-radius: 0.5rem;
  color: ${ACCENT_DARK};
  text-align: center;
  font-size: 0.9375rem;
  line-height: 1.7;
`;

const Muted = styled.div`
  padding: 2rem 1.25rem;
  text-align: center;
  color: #94a3b8;
  font-size: 0.875rem;
`;

const MissingList = styled.ul`
  margin: 0.4rem 0 0;
  padding-left: 1.1rem;
  line-height: 1.7;
`;

const formatDeadline = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
};

const SurveyForm = ({ surveyId, divisions, onBack, onSubmitted }) => {
  const [form, setForm] = useState(null);
  const [answers, setAnswers] = useState({});
  const [divisionId, setDivisionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  // 제출을 눌러 본 뒤에야 '무엇이 빠졌는지'를 띄운다. 화면에 들어오자마자
  // 온통 빨간 것은 아직 아무것도 안 한 사람에게 하는 잔소리다.
  const [tried, setTried] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    surveyApi.getForm(surveyId)
      .then(res => {
        if (!alive) return;
        setForm(res.data);
        // 유도된 사업부가 있으면 기본값으로 둔다. 매번 처음부터 고르게 하면
        // 대충 고른다.
        if (res.data?.suggested_division_id != null) {
          setDivisionId(String(res.data.suggested_division_id));
        }
        setError(null);
      })
      .catch(e => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [surveyId]);

  const questions = useMemo(() => form?.questions || [], [form]);

  const missing = useMemo(
    () => questions.filter(q => q.required && !hasAnswer(answers[q.id])),
    [questions, answers],
  );

  const setAnswer = useCallback((qid, value) => {
    setAnswers(a => ({ ...a, [qid]: value }));
  }, []);

  const submit = async () => {
    setTried(true);
    if (missing.length > 0) return;   // 버튼도 막지만, 여기서도 한 번 더 본다
    setSubmitting(true);
    setError(null);
    try {
      const payload = { answers: {} };
      questions.forEach(q => {
        // 안 채운 선택 문항은 아예 보내지 않는다. null 을 보내면 '답한 것'으로
        // 세어져 집계의 응답 수가 부풀어 오른다.
        if (hasAnswer(answers[q.id])) payload.answers[String(q.id)] = answers[q.id];
      });
      if (divisionId) payload.division_id = Number(divisionId);
      await surveyApi.submitResponse(surveyId, payload);
      setSubmitted(true);
      onSubmitted?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Wrap><Muted>불러오는 중…</Muted></Wrap>;

  if (!form) {
    return (
      <Wrap>
        <Back onClick={onBack}><ArrowLeft size={15} /> 받은 설문</Back>
        <ErrorBox>{error || '설문을 불러오지 못했습니다.'}</ErrorBox>
      </Wrap>
    );
  }

  if (submitted) {
    return (
      <Wrap>
        <Back onClick={onBack}><ArrowLeft size={15} /> 받은 설문</Back>
        <Done>
          <CheckCircle2 size={32} />
          <strong>제출했습니다.</strong>
          <span>
            응답은 한 번만 낼 수 있어 이제 이 설문은 수정할 수 없습니다.
            고쳐야 할 내용이 있으면 설문을 만든 담당자에게 알려 주세요.
          </span>
        </Done>
      </Wrap>
    );
  }

  const deadline = formatDeadline(form.closes_at);
  const hasDivisionList = divisions.length > 0;

  return (
    <Wrap>
      <Back onClick={onBack}><ArrowLeft size={15} /> 받은 설문</Back>
      <Title>{form.title}</Title>
      {form.description && <Description>{form.description}</Description>}
      {deadline && <Deadline><Clock size={14} /> {deadline}까지</Deadline>}

      {/* 고지는 문항보다 위, 항상. 답을 적기 시작한 뒤에 알려주면 늦다. */}
      <AnonymityNotice />

      {form.already_answered ? (
        // 서버도 409 로 막지만, 다 적고 나서 거절당하는 것보다 처음부터 못
        // 적게 하는 편이 낫다.
        <Blocked>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
          <span>
            <strong>이미 응답하신 설문입니다.</strong> 응답은 1인 1회라 다시 낼 수
            없습니다. 낸 답은 집계에 이미 들어가 있습니다.
          </span>
        </Blocked>
      ) : (
        <>
          <Card>
            <SectionLabel>소속 사업부</SectionLabel>
            {hasDivisionList ? (
              <Select value={divisionId} onChange={e => setDivisionId(e.target.value)}>
                <option value="">모름 / 고르지 않음</option>
                {divisions.map(d => (
                  <option key={String(d.id)} value={String(d.id)}>{d.name}</option>
                ))}
              </Select>
            ) : (
              // ⚠️ 사업부 목록을 못 받아온 경우. **직접 입력을 열지 않는다** —
              // 손으로 적은 사업부 이름은 표기가 제각각이라 집계에서 묶이지
              // 않고, 그러면 '있는데 안 세어지는' 최악의 상태가 된다.
              // 모르는 채로 두고, 그 사실이 따로 세어진다는 것만 알린다.
              <Note style={{ marginTop: 0, color: '#475569' }}>
                지금은 사업부 목록을 불러올 수 없어 <strong>「모름」으로 제출</strong>됩니다.
              </Note>
            )}
            <Note>
              {form.division_source === 'profile' && form.suggested_division_id != null ? (
                <>
                  {form.department_name ? `프로필의 소속(${form.department_name})` : '프로필의 소속'}
                  에서 자동으로 확인한 값입니다. 다르면 바꿔 주세요.
                </>
              ) : (
                <>소속을 자동으로 확인하지 못했습니다.</>
              )}
              {' '}
              고르지 않으면 <strong>「소속 미확인」으로 따로 집계</strong>됩니다 —
              모르는 응답을 아무 사업부에나 넣으면 사업부별 평균이 거짓말을 하기
              때문에, 묶지 않고 별도로 셉니다. 답 자체는 그대로 반영됩니다.
            </Note>
          </Card>

          {questions.length === 0 ? (
            <Muted>문항이 없는 설문입니다.</Muted>
          ) : (
            questions.map((q, i) => (
              <QuestionField
                key={q.id}
                question={q}
                index={i}
                value={answers[q.id]}
                onChange={v => setAnswer(q.id, v)}
                missing={tried && q.required && !hasAnswer(answers[q.id])}
              />
            ))
          )}

          {error && <ErrorBox>{error}</ErrorBox>}

          {tried && missing.length > 0 && (
            // 버튼을 막기만 하면 사용자는 왜 안 눌리는지 모른 채 화면을 뒤진다.
            // 무엇이 몇 번 문항인지까지 적어 준다.
            <ErrorBox>
              <strong>필수 문항 {missing.length}개가 비어 있습니다.</strong>
              <MissingList>
                {missing.map(q => (
                  <li key={q.id}>
                    {questions.findIndex(x => x.id === q.id) + 1}번 — {q.text}
                  </li>
                ))}
              </MissingList>
            </ErrorBox>
          )}

          <Actions>
            {missing.length > 0 && (
              <span style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>
                필수 문항 {missing.length}개가 남았습니다
              </span>
            )}
            <Submit
              onClick={submit}
              $blocked={missing.length > 0}
              disabled={submitting || questions.length === 0}
              aria-disabled={missing.length > 0}
              title={missing.length > 0 ? '필수 문항을 모두 채워야 제출할 수 있습니다' : '제출'}
            >
              {submitting ? '제출 중…' : '제출'}
            </Submit>
          </Actions>
        </>
      )}
    </Wrap>
  );
};

export default SurveyForm;
