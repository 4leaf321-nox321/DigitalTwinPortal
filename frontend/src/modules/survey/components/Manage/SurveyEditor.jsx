import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import {
  Plus, Trash2, Wand2, GripVertical, ChevronDown, ChevronRight, AlertTriangle,
} from 'lucide-react';
import { QUESTION_TEMPLATES, linkKeyLabel } from '../../constants/questionTemplates';
import { ACCENT, ACCENT_DARK, ACCENT_LINE, ACCENT_TINT } from '../../theme';
import AxisPicker from './AxisPicker';
import surveyApi from '../../services/surveyApi';

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
//
// 분기(섹션·역할·프로세스)도 여기서 편집한다. 전에는 표 붙여넣기로만 넣을 수
// 있어서, 이 화면으로 만든 설문에는 분기를 넣을 방법이 아예 없었다.
//
// ⚠️ **빈 배열은 '전원'이다. '아무도'가 아니다.** 화면 전체가 이 규칙 위에
//    서 있다 — 빈칸을 '아무도 안 봄'으로 읽으면 아무도 답할 수 없는 설문이
//    만들어지고, 배포한 지 며칠 뒤 "설문에 문항이 하나도 없다"는 말로 돌아온다.
//    그래서 비어 있는 칸은 접혀 있을 때도 **글자로 '전원'이라고 못 박는다.**

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

// 접어 둔 분기 요약 줄. 카드 안에 카드를 또 그리면 문항 목록이 안 읽히므로
// 왼쪽 선 하나로만 묶는다.
const BranchHead = styled.div`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
  /* MetaTag 는 세로로 쌓이던 자리에서 왔다(align-self: flex-start).
     여기선 한 줄로 늘어서므로 가운데에 맞춘다. */
  > span { align-self: center; }
`;

const BranchToggle = styled.button`
  display: flex;
  align-items: center;
  gap: 0.1rem;
  padding: 0.1rem 0.35rem 0.1rem 0.15rem;
  border: none;
  border-radius: 0.25rem;
  background: transparent;
  color: #64748b;
  font-size: 0.6875rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  &:hover { background: ${ACCENT_TINT}; color: ${ACCENT_DARK}; }
`;

const BranchBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.15rem 0 0.25rem 0.7rem;
  border-left: 2px solid ${ACCENT_LINE};
`;

// 설문의 역할·프로세스 목록에 없는 이름을 가리키는 문항에 붙는 줄.
// **저장은 막지 않는다** — 문항을 먼저 쓰고 목록을 나중에 채우는 순서가
// 정상이다. 대신 눈에 띄게 두고, 접어도 안 사라지게 요약 줄 바로 아래 둔다.
const Warn = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  padding: 0.4rem 0.6rem;
  border-radius: 0.375rem;
  background: #fffbeb;
  border: 1px solid #fde68a;
  color: #92400e;
  font-size: 0.75rem;
  line-height: 1.55;
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

// ⚠️ 백엔드 QTYPES 와 **같은 집합**이어야 한다.
//    'multi' 가 빠져 있어서, 표로 만든 복수선택 문항을 편집기에서 열면 유형이
//    빈칸으로 보이고 보기도 못 고쳤다. 저장하면 그 문항이 조용히 망가진다.
const QTYPES = [
  { value: 'scale', label: '척도 1~5' },
  { value: 'choice', label: '객관식' },
  { value: 'multi', label: '복수선택' },
  { value: 'rank', label: '순위' },
  { value: 'text', label: '자유서술' },
];

const TARGETS = [
  { value: 'all', label: '전사' },
  { value: 'role', label: '역할' },
  { value: 'department', label: '부서' },
  { value: 'user', label: '지정 인원' },
];

const CHOICE_TYPES = new Set(['choice', 'multi', 'rank']);

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

/** 역할·프로세스 ↔ 쉼표 구분 한 줄. 보기(줄바꿈)와 규칙이 다른 이유는,
 *  보기 안에는 쉼표가 자주 들어가지만 역할·프로세스 이름에는 안 들어가기
 *  때문이다. 표 붙여넣기 화면(SurveyImport)과 같은 규칙이라 두 경로로 만든
 *  설문의 이름이 서로 다른 모양으로 갈리지 않는다. */
const splitAxis = (text) => {
  // ⚠️ **중복을 없앤다.** 서버(importer._split_axis, routes._axis_list)가
  //    없애므로 여기서 안 없애면 같은 글자를 넣어도 결과가 갈린다 — 화면에는
  //    'PL, PL' 이 남고 저장된 것은 'PL' 하나라, blur 때 "정규화한다"는 약속이
  //    거짓이 된다.
  const seen = new Set();
  return (text || '').split(',').map(x => x.trim()).filter(x => {
    if (!x || seen.has(x)) return false;
    seen.add(x);
    return true;
  });
};
const joinAxis = (list) => (Array.isArray(list) ? list : []).join(', ');

/** 문항이 가리키는 값 중 **설문 목록에 없는** 이름을 찾는다.
 *
 * 표에는 'PL' 이라 적었는데 설문 목록엔 'PL(과제리더)' 로 들어간 경우가 실제로
 * 난다. 이름이 한 글자만 달라도 다른 대상이라 그 문항은 아무에게도 안 보이는데,
 * 지금까지는 아무 신호도 없었다. 백엔드 unreachable_questions() 와 같은 판정을
 * 저장 전에 화면에서 미리 보여 준다.
 *
 * ⚠️ 빈 audience 는 '전원'이므로 여기 절대 걸리지 않는다. 걸리는 것은
 *    **적었는데 가리키는 곳이 없는** 경우뿐이다.
 */
const axisWarnings = (q, definedRoles, definedProcesses) => {
  const out = [];
  [
    ['역할', q.audience_roles || [], definedRoles],
    ['프로세스', q.audience_processes || [], definedProcesses],
  ].forEach(([label, picked, defined]) => {
    const unknown = picked.filter(v => !defined.includes(v));
    if (!unknown.length) return;
    // 적은 값이 **하나도** 목록에 없으면 그 문항은 통째로 사라진다. 일부만
    // 어긋난 것과 무게가 다르므로 문장을 갈라 쓴다.
    out.push({ label, unknown, dead: unknown.length === picked.length });
  });
  return out;
};

const SurveyEditor = ({ survey, onSave, onCancel }) => {
  // 잠금 판단은 **서버가 한다.** 화면이 응답 수로 따로 판단하면, 배포됐지만
  // 응답이 0건인 설문에서 "고칠 수 있어 보이는데 저장하면 409" 가 된다.
  // 옛 응답(question_lock_reason 미지원)에 대비해 응답 수도 함께 본다.
  const lockReason = survey?.question_lock_reason
    || ((survey?.response_count || 0) > 0 ? '이미 응답이 있어 문항을 바꿀 수 없습니다.' : null);
  const locked = !!lockReason;
  // 문항 번호 -> 보기 입력의 원문. 문항 개수가 바뀌면(추가·삭제·템플릿)
  // 번호가 밀리므로 통째로 버린다 — 남은 초안이 엉뚱한 문항에 붙는 것보다 낫다.
  // 고를 수 있는 값의 정본은 서버다(GET /manage/options).
  const [axisOptions, setAxisOptions] = useState({ roles: [], processes: [] });
  useEffect(() => {
    let alive = true;
    surveyApi.getOptions()
      .then(res => { if (alive && res?.data) setAxisOptions(res.data); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const [choiceDraft, setChoiceDraft] = useState({});
  // 역할·프로세스 입력의 원문. choiceDraft 와 같은 이유다 — 쉼표를 찍는 순간
  // 나눴다 다시 합치면 그 쉼표가 사라져서 다음 이름을 못 적는다.
  // 키는 `문항번호:칸이름`.
  const [axisDraft, setAxisDraft] = useState({});
  // 분기 칸을 손으로 펼치거나 접은 기록(문항번호 -> boolean).
  // 기록이 없는 문항은 '값이 있으면 펼침'을 기본으로 쓴다(아래 isOpen).
  const [branchOpen, setBranchOpen] = useState({});
  const [form, setForm] = useState({
    title: survey?.title || '',
    description: survey?.description || '',
    target_type: survey?.target_type || 'all',
    target_refs: (survey?.target_refs || []).join(', '),
    // 응답자에게 물을 축. 원문(쉼표 한 줄) 그대로 들고 있다가 저장할 때만
    // 나눈다 — 배열로 바로 바꾸면 위 axisDraft 와 같은 문제가 난다.
    roles: joinAxis(survey?.roles),
    processes: joinAxis(survey?.processes),
  });
  const [questions, setQuestions] = useState(
    survey?.questions?.length ? survey.questions.map(q => ({ ...q })) : [emptyQuestion()]
  );

  // 문항 개수가 바뀌면 보기 초안을 버린다(번호가 밀린다).
  useEffect(() => { setChoiceDraft({}); }, [questions.length]);
  // 분기 쪽 상태도 문항 **번호로** 기억하므로 같은 이유로 버린다. 안 버리면
  // 3번을 지웠을 때 4번이 3번 자리로 올라오면서 남의 초안과 펼침 상태를
  // 물려받아, 손대지도 않은 문항의 역할이 바뀐 것처럼 보인다.
  useEffect(() => { setAxisDraft({}); setBranchOpen({}); }, [questions.length]);

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));
  const setQ = (i, patch) =>
    setQuestions(qs => qs.map((q, n) => (n === i ? { ...q, ...patch } : q)));

  // 유형을 바꾸면 options 를 그 유형에 맞게 씻는다.
  //
  // 안 씻으면 척도였던 문항을 객관식으로 바꿔도 {min,max} 가 남고, 반대로
  // 객관식이었던 것을 척도로 바꿔도 choices 가 남는다. 화면에는 안 보이지만
  // 저장되고, **같은 내용의 문항이 만든 경로에 따라 서로 다른 모양**이 된다.
  const setQType = (i, qtype) => setQ(i, {
    qtype,
    options: qtype === 'scale' ? { min: 1, max: 5 }
      : CHOICE_TYPES.has(qtype) ? { choices: [] }
      : {},
  });
  const setOpt = (i, patch) =>
    setQuestions(qs => qs.map((q, n) => (
      n === i ? { ...q, options: { ...(q.options || {}), ...patch } } : q
    )));

  // 템플릿은 배열을 그대로 버튼으로 편다. 템플릿이 없으면 버튼도 안 뜬다 —
  // 템플릿을 늘리거나 줄이는 데 이 파일을 고칠 필요가 없다.
  const fillFromTemplate = (template) => {
    // 문항이 통째로 바뀌므로 번호로 기억하는 분기 상태를 버린다. 개수가 우연히
    // 같으면 위 useEffect 가 안 돌아서, 지워진 문항의 초안이 새 문항에 얹힌다.
    setAxisDraft({});
    setBranchOpen({});
    setQuestions(template.build());
  };

  // ── 분기 ────────────────────────────────────────────────────────────────

  // 문항의 분기 칸을 고칠 때는 **항상 펼친 것으로 기록**한다.
  // 마지막 이름을 지워 칸이 비면 hasBranch 가 false 가 되어 칸이 손 밑에서
  // 접혀 버린다 — 지우다 만 사람이 다시 펼쳐야 하는 것은 고장으로 읽힌다.
  const setBranch = (i, patch) => {
    setBranchOpen(o => ({ ...o, [i]: true }));
    setQ(i, patch);
  };

  const axisText = (i, key, q) => axisDraft[`${i}:${key}`] ?? joinAxis(q[key]);
  const onAxis = (i, key) => (e) => {
    const raw = e.target.value;
    setAxisDraft(d => ({ ...d, [`${i}:${key}`]: raw }));
    setBranch(i, { [key]: splitAxis(raw) });
  };
  const onAxisBlur = (i, key) => () => setAxisDraft(d => {
    // 손을 떼면 정규화된 모습(중복 공백·꼬리 쉼표 정리)으로 보여준다.
    const { [`${i}:${key}`]: _drop, ...rest } = d;
    return rest;
  });

  // 값이 있으면 펼치고 없으면 접는다.
  //
  // 왜 이렇게 균형을 잡았나: 문항 열댓 개짜리 설문에서 세 칸을 항상 펼쳐 두면
  // 카드 하나가 화면 절반을 먹어 **문항 목록 자체가 안 읽힌다.** 그렇다고 늘
  // 접어 두면 표로 만든 설문의 분기가 안 보여서, 손대면 안 될 문항을 지우거나
  // 순서를 바꾼다(이 화면에서 실제로 나던 사고다). 그래서 '값이 있는 문항 =
  // 볼 게 있는 문항'만 펼치고, 접힌 문항도 요약 줄(역할 · 전원)은 늘 남긴다.
  // 요약 줄이 있으므로 접힘이 '아무도 안 봄'으로 읽히지 않는다.
  const hasBranch = (q) =>
    !!(q.section || q.audience_roles?.length || q.audience_processes?.length);
  const isOpen = (q, i) => branchOpen[i] ?? hasBranch(q);

  // 설문이 묻는 축. **저장한 값이 아니라 지금 입력 중인 원문**에서 뽑는다 —
  // 저장해야 경고가 갱신되면, 이름을 맞춰 고치는 그 순간에 경고가 안 사라져서
  // 제대로 고쳤는지 알 수 없다.
  const definedRoles = useMemo(() => splitAxis(form.roles), [form.roles]);
  const definedProcesses = useMemo(() => splitAxis(form.processes), [form.processes]);
  const warnings = useMemo(
    () => questions.map(q => axisWarnings(q, definedRoles, definedProcesses)),
    [questions, definedRoles, definedProcesses],
  );
  const warnedCount = warnings.filter(w => w.length).length;
  // 어긋난 이름을 모아 한 줄로 보여준다. 응답이 들어와 문항이 잠기면 카드가
  // 아예 안 그려지므로, 그때는 이 줄이 유일한 단서가 된다.
  const unknownNames = useMemo(() => {
    const out = [];
    warnings.flat().forEach(w => w.unknown.forEach(v => {
      const tag = `${w.label} · ${v}`;
      if (!out.includes(tag)) out.push(tag);
    }));
    return out;
  }, [warnings]);

  const submit = () => {
    const refs = form.target_refs
      .split(',').map(s => s.trim()).filter(Boolean)
      .map(s => (/^\d+$/.test(s) ? Number(s) : s));
    const payload = {
      title: form.title.trim(),
      description: form.description || null,
      target_type: form.target_type,
      target_refs: form.target_type === 'all' ? [] : refs,
      // 응답자가 고를 축. **빈 문자열이면 빈 배열**을 싣는다(안 싣지 않는다) —
      // 서버는 키가 없으면 기존 값을 그대로 두므로, 화면에서 지운 것을 지운
      // 대로 반영하려면 빈 배열이라도 보내야 한다. 빈 배열은 '그 축을 묻지
      // 않는다'는 뜻이고, 문항 쪽 빈 배열('전원')과는 다른 자리의 뜻이다.
      roles: splitAxis(form.roles),
      processes: splitAxis(form.processes),
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
          // 서버의 _replace_questions 는 문항을 통째로 지우고 보낸 것으로 다시
          // 만든다. 그래서 여기서 안 실은 칸은 기본값(빈 값)이 된다 — 표로
          // 만든 설문을 이 화면에서 제목만 고치고 저장해도 역할·프로세스
          // 분기가 전부 날아간다. 화면에 안 보이는 값이라 아무도 눈치 못 챈다.
          // 빈 문자열은 null 로 눕힌다 — 섹션을 적었다 지운 문항이 ''(빈 이름)
          // 섹션으로 남으면 응답 화면에 이름 없는 묶음이 하나 더 생긴다.
          section: (q.section || '').trim() || null,
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

      {/* 응답자가 제출 전에 고를 축.
          '대상'(누구에게 설문이 가는가)과 다른 것이다 — 이건 답하는 사람이
          자기가 누구인지 고르는 목록이고, 문항 분기가 이 목록에 걸린다.

          ⚠️ 응답이 들어와 문항이 잠긴 뒤에도 이 두 칸은 열어 둔다. "역할 목록에
             내 역할이 없어 제출이 안 된다"는 사고는 배포 뒤에 드러나는데,
             고칠 곳이 바로 여기다. 문항을 안 건드리므로 이미 받은 답의 뜻도
             안 바뀐다(서버도 축 변경엔 409 를 주지 않는다). */}
      <Row>
        <div style={{ flex: 1, minWidth: '16rem' }}>
          <AxisPicker
            label="응답자가 고를 역할"
            options={axisOptions.roles}
            value={splitAxis(form.roles)}
            onChange={list => setForm(f => ({ ...f, roles: list.join(', ') }))}
            emptyMeans="역할을 묻지 않습니다" />
        </div>
        <div style={{ flex: 1, minWidth: '16rem' }}>
          <AxisPicker
            label="응답자가 고를 프로세스"
            options={axisOptions.processes}
            value={splitAxis(form.processes)}
            onChange={list => setForm(f => ({ ...f, processes: list.join(', ') }))}
            emptyMeans="프로세스를 묻지 않습니다" />
        </div>
      </Row>
      {/* ⚠️ 이 경고를 화면에서 빼지 마라. 이 목록을 문항에서 유도하면(전용
          문항이 있는 역할만 모으면) 공통 문항만 답하는 역할이 빠지는데, 그
          사람은 역할을 고를 수 없어 **제출 자체가 막힌다.** */}
      <Hint>
        <strong style={{ color: '#b45309' }}>전용 문항이 없는 역할도 여기 적어야 합니다.</strong>
        {' '}공통 문항만 답하는 사람(사무국장 같은)도 자기 역할을 골라야 제출할 수
        있습니다. 목록에 없으면 그 사람은 설문을 낼 수 없습니다.
      </Hint>

      <SectionHead>
        <SectionTitle>문항</SectionTitle>
        <Hint>{questions.length}개</Hint>
        {!locked && QUESTION_TEMPLATES.map(t => (
          <GhostButton key={t.id} onClick={() => fillFromTemplate(t)} title={t.hint}>
            <Wand2 size={14} /> {t.label}
          </GhostButton>
        ))}
      </SectionHead>

      {/* 문항 목록 위의 한 줄 요약. 문항이 많으면 카드에 붙은 경고를 지나쳐
          스크롤하기 쉽고, 응답이 들어와 잠긴 설문은 카드가 아예 안 그려진다. */}
      {warnedCount > 0 && (
        <Warn>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
          <span>
            <strong>{warnedCount}개 문항</strong>이 위 목록에 없는 이름을 가리킵니다
            ({unknownNames.join(', ')}). 이름이 한 글자라도 다르면 다른 대상이라,
            그 문항은 아무 신호 없이 <strong>아무에게도 안 보일 수 있습니다.</strong>{' '}
            {locked
              ? '문항은 잠겨 있어도 위 두 칸은 고칠 수 있습니다 — 목록에 같은 이름을 더하면 그 문항이 다시 보입니다.'
              : '위 두 칸의 이름과 아래 노란 줄이 붙은 문항의 이름을 맞추세요.'}
          </span>
        </Warn>
      )}

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
                  <Select value={q.qtype} onChange={e => setQType(i, e.target.value)}>
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

                {/* ── 분기 ────────────────────────────────────────────────
                    요약 줄은 접든 펼치든 **항상** 보인다. 값이 없을 때 칸만
                    비워 두면 "아무도 안 본다"로 읽히는데 규칙은 정반대라,
                    비어 있음을 '전원'이라는 글자로 바꿔서 남긴다. */}
                <BranchHead>
                  <BranchToggle type="button"
                                onClick={() => setBranchOpen(o => ({ ...o, [i]: !isOpen(q, i) }))}
                                title="섹션·역할·프로세스를 고칩니다">
                    {isOpen(q, i) ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    분기
                  </BranchToggle>
                  <MetaTag>섹션 · {q.section || '없음'}</MetaTag>
                  {/* 빈 배열은 전원이다. $limit(노란 테두리)은 '좁혀진 문항'
                      표시이므로 전원일 때는 붙이지 않는다. */}
                  <MetaTag $limit={!!q.audience_roles?.length}>
                    역할 · {q.audience_roles?.length ? q.audience_roles.join(', ') : '전원'}
                  </MetaTag>
                  <MetaTag $limit={!!q.audience_processes?.length}>
                    프로세스 · {q.audience_processes?.length ? q.audience_processes.join(', ') : '전원'}
                  </MetaTag>
                </BranchHead>

                {/* 경고는 접힌 상태에서도 보이게 펼침 칸 **바깥**에 둔다.
                    접어서 숨길 수 있는 경고는 없는 경고나 마찬가지다. */}
                {warnings[i].map(w => (
                  <Warn key={w.label}>
                    <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                    <span>
                      설문의 {w.label} 목록에 없는 이름: <strong>{w.unknown.join(', ')}</strong>
                      {w.dead
                        ? ' — 이대로 저장하면 이 문항은 아무에게도 보이지 않습니다.'
                        : ' — 이 이름을 고른 사람에게는 이 문항이 안 보입니다.'}
                      {' '}위 &ldquo;응답자가 고를 {w.label}&rdquo;에 같은 이름을 적거나 철자를 맞추세요.
                    </span>
                  </Warn>
                ))}

                {isOpen(q, i) && (
                  <BranchBox>
                    <Field>
                      섹션 (선택)
                      <Input value={q.section || ''}
                             onChange={e => setBranch(i, { section: e.target.value })}
                             placeholder="예: 공통 · 역할별 · 프로세스별" />
                    </Field>
                    {/* 고를 수 있는 값을 **설문이 묻는 것**으로 좁힌다.
                        설문이 안 묻는 역할을 문항에 걸면 그 문항은 아무에게도
                        안 보인다 — 고를 수 없게 하는 편이 경고보다 낫다.
                        아직 위에서 아무것도 안 골랐으면 전체 목록을 보여준다
                        (문항을 먼저 쓰는 순서도 정상이다). */}
                    <Row>
                      <div style={{ flex: 1, minWidth: '13rem' }}>
                        <AxisPicker
                          label="이 문항을 볼 역할"
                          options={definedRoles.length ? definedRoles : axisOptions.roles}
                          value={q.audience_roles || []}
                          onChange={list => setBranch(i, { audience_roles: list })}
                          emptyMeans="전원이 봅니다" />
                      </div>
                      <div style={{ flex: 1, minWidth: '13rem' }}>
                        <AxisPicker
                          label="이 문항을 볼 프로세스"
                          options={definedProcesses.length ? definedProcesses : axisOptions.processes}
                          value={q.audience_processes || []}
                          onChange={list => setBranch(i, { audience_processes: list })}
                          emptyMeans="전원이 봅니다" />
                      </div>
                    </Row>
                    <Hint>
                      비우면 <strong>전원</strong>이 보는 문항입니다 (아무도 안 보는 것이
                      아닙니다). 적은 이름은 위 &ldquo;응답자가 고를 역할·프로세스&rdquo;에도
                      있어야 합니다.
                    </Hint>
                  </BranchBox>
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
