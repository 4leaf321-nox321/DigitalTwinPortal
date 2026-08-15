import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { ArrowLeft, CheckCircle2, AlertTriangle, Clock, ListChecks, RotateCcw } from 'lucide-react';
import surveyApi from '../../services/surveyApi';
import AnonymityNotice from './AnonymityNotice';
import QuestionField, { hasAnswer } from './QuestionField';
import RoleSelect, { questionApplies } from './RoleSelect';
import { ACCENT, ACCENT_DARK, ACCENT_LINE, ACCENT_TINT, READING_WIDTH } from '../../theme';

// 설문 한 벌에 답하는 자리.
//
// 폭을 READING_WIDTH(52rem)로 좁힌다. 글이 많은 화면이라 1440px 를 그대로 쓰면
// 한 줄이 너무 길어져 읽는 눈이 줄을 놓친다. 모듈 껍데기는 포탈 공통 폭을
// 쓰고, 읽고 답하는 이 화면만 그 안에서 더 좁힌다.
//
// 화면의 순서가 곧 규칙이다:
//   고지 → 역할·프로세스 → 사업부 → (걸러진) 문항 → 제출
// 역할·프로세스를 문항보다 위에 두는 이유는 **그 선택이 무엇을 묻는지를
// 정하기 때문**이다. 고르기 전에 문항을 먼저 보여주면, 답을 적다가 역할을
// 고치는 순간 적은 것이 화면에서 사라지는 일이 생긴다.

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

// ── 역할을 고르기 전 ──────────────────────────────────────────────────────
//
// 오류가 아니라 안내다. 빨강이 아니라 모듈 강조색을 쓴다 — 아직 아무것도
// 잘못하지 않은 사람에게 경고를 띄우면 첫 화면이 온통 잘못된 것처럼 보인다.
const Gate = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 1.25rem 1.25rem;
  background: ${ACCENT_TINT};
  border: 1px dashed ${ACCENT_LINE};
  border-radius: 0.5rem;
  color: ${ACCENT_DARK};
  font-size: 0.875rem;
  line-height: 1.7;
`;

// ── 섹션 소제목 ───────────────────────────────────────────────────────────
//
// 수십 문항이 평평하게 나열되면 어디쯤 왔는지 모른다. 소제목마다 그 묶음의
// 진행(3/5)을 같이 적는 이유도 같다 — 전체 막대 하나만 있으면 "남은 것이
// 어느 묶음에 있는지"를 스크롤해서 찾아야 한다.
const GroupHead = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  margin: 0.625rem 0 -0.25rem;
  padding-bottom: 0.4rem;
  border-bottom: 2px solid ${ACCENT_LINE};
`;

const GroupTitle = styled.h3`
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.5;
`;

const GroupCount = styled.span`
  flex-shrink: 0;
  font-size: 0.75rem;
  font-weight: 700;
  color: ${p => (p.$done ? ACCENT_DARK : '#94a3b8')};
`;

const ProgressRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.625rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #64748b;
`;

const Bar = styled.div`
  flex: 1;
  height: 0.375rem;
  border-radius: 999px;
  background: #e2e8f0;
  overflow: hidden;
`;

const Fill = styled.div`
  height: 100%;
  width: ${p => p.$pct}%;
  background: ${ACCENT};
  transition: width 0.2s ease;
`;

// 역할을 바꿔 답이 화면에서 사라졌을 때의 안내. **답을 지우지 않기 때문에**
// 필요한 문구다 — 지우지 않는다는 사실을 말해 주지 않으면, 사라진 것을 본
// 사람은 지워진 줄 알고 되돌아가 다시 적는다.
const KeptNote = styled.div`
  padding: 0.6rem 0.875rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  color: #64748b;
  font-size: 0.8125rem;
  line-height: 1.65;
`;

const formatDeadline = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
};

const Answered = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.75rem 0.875rem;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 0.5rem;
  color: #15803d;
  font-size: 0.8125rem;
  line-height: 1.6;
`;

const SurveyForm = ({ surveyId, divisions, onBack, onSubmitted }) => {
  const [form, setForm] = useState(null);
  // ⚠️ 문항 id → 값의 **평면 맵**이다. 역할·프로세스로 문항을 걸러도 이 맵은
  //    건드리지 않는다 — 그래서 역할을 바꿨다 되돌아오면 답이 그대로 남아
  //    있다. 걸러진 문항의 답을 지우는 코드를 여기에 넣지 마라.
  const [answers, setAnswers] = useState({});
  const [divisionId, setDivisionId] = useState('');
  // 응답자가 고른 축. 설문이 묻지 않는 축은 '' 로 남고 제출에도 안 실린다.
  const [role, setRole] = useState('');
  const [process, setProcess] = useState('');
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
        // 역할도 마찬가지다. 데이터로 확인된 역할이 있으면 **그것으로 채운다.**
        // 빈 채로 두면 사람들은 목록의 첫 항목이나 자기에게 편한 것을 고르고,
        // 역할별 집계는 자칭의 모음이 된다. 여럿이면 가장 좁은 것(목록 순서상
        // 앞선 것)을 쓰고, 본인이 바꿀 수 있게 둔다.
        const derived = res.data?.derived_roles || [];
        if (derived.length > 0) setRole(derived[0]);
        // 이미 낸 적이 있으면 **그때 고른 역할·프로세스와 답을 그대로 채운다.**
        // 유도값보다 본인이 실제로 낸 것이 우선이다 — 고치러 온 사람에게
        // 다른 역할을 들이밀면 문항이 바뀌어 버린다.
        if (res.data?.my_role) setRole(res.data.my_role);
        if (res.data?.my_process) setProcess(res.data.my_process);
        if (res.data?.my_answers) setAnswers(res.data.my_answers);
        setError(null);
      })
      .catch(e => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [surveyId]);

  const questions = useMemo(() => form?.questions || [], [form]);

  // 설문이 묻는 축. 비어 있으면 그 선택을 아예 안 묻는다(계획서: "비면 안 묻는다").
  const askRoles = useMemo(() => form?.roles || [], [form]);
  const askProcesses = useMemo(() => form?.processes || [], [form]);
  // 묻는 축을 다 골랐는가. 안 묻는 축은 판정에서 빠진다 — 그래야 역할·프로세스가
  // 없는 **기존 설문이 지금까지와 똑같이** 동작한다.
  const axisReady = (askRoles.length === 0 || !!role)
    && (askProcesses.length === 0 || !!process);

  // 이 응답자에게 해당하는 문항.
  //
  // ⚠️ 서버가 걸러 보내지 않는다. 응답자가 역할을 바꿔가며 볼 수 있어야 하는데
  //    서버가 거르면 고를 때마다 다시 불러야 하고, 그 사이 적어 둔 답이 날아간다.
  //    **거르는 것은 화면이 하고 검증은 서버가 한다.**
  const visible = useMemo(() => {
    if (!axisReady) return [];   // 아직 안 골랐으면 무엇을 물을지 모른다
    return questions.filter(q => questionApplies(q, role, process));
  }, [questions, role, process, axisReady]);

  // 섹션 묶음. 등장 순서를 지키되, **섹션 없는 문항은 소제목 없이 맨 위로**
  // 올린다 — 소제목 사이에 끼면 어느 묶음에 속한 것처럼 읽힌다.
  const groups = useMemo(() => {
    const map = new Map();
    visible.forEach(q => {
      const key = (q.section || '').trim();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(q);
    });
    const out = [];
    if (map.has('')) out.push({ section: '', questions: map.get('') });
    map.forEach((qs, key) => { if (key !== '') out.push({ section: key, questions: qs }); });
    return out;
  }, [visible]);

  // 화면에 보이는 순번(0부터). 걸러진 뒤 기준이라 번호가 1,2,3… 으로 이어진다.
  // 원래 문항 순서가 아니라 **묶은 뒤의 순서**여야 화면 번호와 안내 문구의
  // 번호가 어긋나지 않는다.
  const orderOf = useMemo(() => {
    const m = new Map();
    let n = 0;
    groups.forEach(g => g.questions.forEach(q => { m.set(q.id, n); n += 1; }));
    return m;
  }, [groups]);

  // ⚠️ **여기가 가장 사고나기 쉬운 자리다.** 전체 questions 로 세면 화면에 없는
  //    필수 문항이 제출을 막고, 사용자는 화면 어디에도 없는 것을 찾게 된다.
  //    보이는 문항만 센다 — 서버도 같은 집합으로 검증한다.
  const missing = useMemo(
    () => visible.filter(q => q.required && !hasAnswer(answers[q.id])),
    [visible, answers],
  );

  const answeredCount = useMemo(
    () => visible.filter(q => hasAnswer(answers[q.id])).length,
    [visible, answers],
  );

  // 역할을 바꿔 화면에서 사라졌지만 **답은 남아 있는** 문항 수.
  const hiddenAnswered = useMemo(() => {
    const shown = new Set(visible.map(q => q.id));
    return questions.filter(q => !shown.has(q.id) && hasAnswer(answers[q.id])).length;
  }, [questions, visible, answers]);

  const setAnswer = useCallback((qid, value) => {
    setAnswers(a => ({ ...a, [qid]: value }));
  }, []);

  // 축을 바꾸면 문항이 통째로 바뀐다. 그때까지 띄워 둔 '빠진 문항' 표시를 그대로
  // 두면 **방금 처음 본 문항들이 이미 빨갛게 칠해진 채로** 나타난다. 그래서
  // tried 만 되돌린다 — ⚠️ answers 는 절대 건드리지 않는다. 되돌아오면 답이
  // 그대로 남아 있어야 한다.
  const changeRole = useCallback((v) => { setRole(v); setTried(false); }, []);
  const changeProcess = useCallback((v) => { setProcess(v); setTried(false); }, []);

  const submit = async () => {
    setTried(true);
    if (!axisReady || visible.length === 0) return;
    if (missing.length > 0) return;   // 버튼도 막지만, 여기서도 한 번 더 본다
    setSubmitting(true);
    setError(null);
    try {
      const payload = { answers: {} };
      // ⚠️ visible 이 아니라 **questions 전체**를 훑는다. 해당 없는 문항의 답이
      //    섞여 가도 서버가 조용히 버린다(routes.py 의 `qid not in asked`).
      //    여기서 한 번 더 거르면 거르는 규칙이 두 군데가 되고, 두 규칙이
      //    어긋나는 날 어느 쪽이 맞는지 알 수 없게 된다.
      questions.forEach(q => {
        // 안 채운 선택 문항은 아예 보내지 않는다. null 을 보내면 '답한 것'으로
        // 세어져 집계의 응답 수가 부풀어 오른다.
        if (hasAnswer(answers[q.id])) payload.answers[String(q.id)] = answers[q.id];
      });
      if (divisionId) payload.division_id = Number(divisionId);
      // 설문이 안 묻는 축은 싣지 않는다. 서버는 안 묻는 축의 값을 버리지만,
      // 안 보내는 편이 "무엇을 물었는지"가 payload 에 그대로 남아 읽기 쉽다.
      if (askRoles.length > 0) payload.respondent_role = role;
      if (askProcesses.length > 0) payload.respondent_process = process;
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
  // 안내 문구에 쓸 축 이름. **설문이 묻는 축만** 적는다 — 안 묻는 '프로세스'를
  // 문구에 끼워 넣으면 어디서 고르는 것인지 찾다가 헤맨다.
  const axisNames = [
    ...(askRoles.length > 0 ? ['역할'] : []),
    ...(askProcesses.length > 0 ? ['프로세스'] : []),
  ];

  return (
    <Wrap>
      <Back onClick={onBack}><ArrowLeft size={15} /> 받은 설문</Back>
      <Title>{form.title}</Title>
      {form.description && <Description>{form.description}</Description>}
      {deadline && <Deadline><Clock size={14} /> {deadline}까지</Deadline>}

      {/* 고지는 문항보다 위, 항상. 답을 적기 시작한 뒤에 알려주면 늦다. */}
      <AnonymityNotice />

      {/* 이미 냈어도 **마감 전이면 고칠 수 있다.** 그래서 막지 않고, 낸 적이
          있다는 것과 다시 내면 갈아끼워진다는 것만 알린다. 한 번 내면 끝이면
          사람들은 확신이 설 때까지 안 내고 미루거나 잘못 낸 채로 둔다. */}
      {form.already_answered && (
        <Answered>
          <RotateCcw size={16} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
          <span>
            <strong>이미 응답하셨습니다. 아래에 낸 답이 그대로 있습니다.</strong>{' '}
            마감 전까지는 고쳐서 다시 내실 수 있고, 다시 내시면 이전 답을
            갈아끼웁니다. 답이 여러 벌 쌓이지는 않습니다.
          </span>
        </Answered>
      )}

      {false ? null : (
        <>
          {/* 문항보다 **먼저**. 무엇을 묻는지가 이 선택으로 정해진다. */}
          <RoleSelect
            derivedRoles={form.derived_roles || []}
            roles={askRoles}
            processes={askProcesses}
            role={role}
            process={process}
            onRoleChange={changeRole}
            onProcessChange={changeProcess}
          />

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

          {!axisReady ? (
            // 요구 1. 고르기 전에는 문항도 제출 버튼도 안 보여준다. 문항만
            // 감추고 제출은 남겨 두면 아무것도 안 답한 응답이 들어온다.
            <Gate>
              <ListChecks size={18} style={{ flexShrink: 0, marginTop: '0.15rem' }} />
              <span>
                먼저 위에서 <strong>{axisNames.join('·')}</strong>을(를) 골라 주세요.
                {' '}무엇을 여쭤볼지가 그 선택으로 정해져서, 고르기 전에는 문항을
                보여드리지 않습니다.
              </span>
            </Gate>
          ) : (
            <>
              {hiddenAnswered > 0 && (
                <KeptNote>
                  지금 고르신 {axisNames.join('·')}에 해당하지 않는 문항 {hiddenAnswered}개가
                  숨겨져 있습니다. <strong>적어 두신 답은 그대로 남아 있고</strong>,
                  {' '}{axisNames.join('·')}을(를) 되돌리면 다시 보입니다. 제출할 때는
                  지금 보이는 문항의 답만 반영됩니다.
                </KeptNote>
              )}

              {visible.length === 0 ? (
                // 문항이 아예 없는 설문과, 문항은 있는데 나에게 해당하는 것이
                // 하나도 없는 경우는 **다른 말이어야 한다.** 뒤쪽은 대개 설문을
                // 만들 때 역할 이름이 어긋난 것이라(백엔드 unreachable_questions),
                // 응답자가 할 수 있는 일은 자기 선택을 다시 보는 것뿐이다.
                <Muted>
                  {questions.length === 0
                    ? '문항이 없는 설문입니다.'
                    : axisNames.length > 0
                      ? `고르신 ${axisNames.join('·')}에 해당하는 문항이 없습니다. 잘못 고르지 않으셨는지 위에서 확인해 주세요.`
                      : '지금 답하실 수 있는 문항이 없습니다. 설문을 만든 담당자에게 알려 주세요.'}
                </Muted>
              ) : (
                <>
                  {/* 요구 7. 전체 진행 + 묶음별 진행. 수십 문항짜리 설문에서
                      "얼마나 남았나"를 스크롤로 세게 두면 중간에 포기한다. */}
                  <ProgressRow>
                    <span>{visible.length}문항 중 {answeredCount}개 답함</span>
                    <Bar>
                      <Fill $pct={Math.round((answeredCount / visible.length) * 100)} />
                    </Bar>
                  </ProgressRow>

                  {groups.map(g => {
                    const done = g.questions.filter(q => hasAnswer(answers[q.id])).length;
                    return (
                      <React.Fragment key={g.section || '__none__'}>
                        {/* 섹션이 없는 묶음은 소제목을 안 그린다 — 「기타」같은
                            이름을 지어 붙이면 없던 분류가 생긴다. */}
                        {g.section && (
                          <GroupHead>
                            <GroupTitle>{g.section}</GroupTitle>
                            <GroupCount $done={done === g.questions.length}>
                              {done}/{g.questions.length}
                            </GroupCount>
                          </GroupHead>
                        )}
                        {g.questions.map(q => (
                          <QuestionField
                            key={q.id}
                            question={q}
                            index={orderOf.get(q.id)}
                            value={answers[q.id]}
                            onChange={v => setAnswer(q.id, v)}
                            missing={tried && q.required && !hasAnswer(answers[q.id])}
                          />
                        ))}
                      </React.Fragment>
                    );
                  })}
                </>
              )}

              {error && <ErrorBox>{error}</ErrorBox>}

              {tried && missing.length > 0 && (
                // 버튼을 막기만 하면 사용자는 왜 안 눌리는지 모른 채 화면을 뒤진다.
                // 무엇이 몇 번 문항인지까지 적어 준다. 번호는 **걸러진 뒤 순번**이라
                // 화면에 찍힌 번호와 정확히 같다.
                <ErrorBox>
                  <strong>필수 문항 {missing.length}개가 비어 있습니다.</strong>
                  <MissingList>
                    {missing.map(q => (
                      <li key={q.id}>
                        {orderOf.get(q.id) + 1}번
                        {q.section ? ` (${q.section})` : ''} — {q.text}
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
                  disabled={submitting || visible.length === 0}
                  aria-disabled={missing.length > 0}
                  title={missing.length > 0 ? '필수 문항을 모두 채워야 제출할 수 있습니다' : '제출'}
                >
                  {submitting ? '제출 중…' : '제출'}
                </Submit>
              </Actions>
            </>
          )}
        </>
      )}
    </Wrap>
  );
};

export default SurveyForm;
