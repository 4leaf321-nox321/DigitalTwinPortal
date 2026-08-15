import React, { useState, useMemo } from 'react';
import styled from 'styled-components';
import { Eye, AlertTriangle, ArrowLeft, Download } from 'lucide-react';
import { linkKeyLabel } from '../../constants/questionTemplates';
import { ACCENT, ACCENT_DARK, ACCENT_TINT, ACCENT_LINE } from '../../theme';

// 집계.
//
// **응답 수를 평균 옆에 항상 같이 둔다.** "3.2점" 만 있는 화면은 몇 명이
// 답했는지 모르는 평균이라 판단에 못 쓴다. 7명이 답한 3.2 와 2명이 답한 3.2 는
// 다른 이야기다.
//
// **소속 미확인도 숨기지 않는다.** 숨기면 그럴듯한 사업부별 평균이 나오는데
// 실은 절반이 어디 것인지 모르는 상태가 된다(SURVEY_PLAN 5절).
//
// 여기에 **축(전체·역할별·프로세스별) 전환**이 붙는다. 한 설문 안에서 역할과
// 프로세스에 따라 다른 문항을 묻기 때문에, 전체 평균 하나만 보면 서로 다른
// 질문에 답한 사람들의 숫자가 한 칸에 섞인다.
//
// ⚠️ **by_role / by_process 가 없어도 깨지지 않아야 한다.** 구버전 서버는 이
//    두 칸을 안 싣는다. 그때는 탭 자체를 안 그리고 예전 그대로 전체만 보인다.

// 표본이 적은 칸을 경고색으로 칠하는 문턱.
//
// 3명으로 정한 근거:
//  - 5점 척도에서 2명이면 한 사람이 평균을 최대 2.0점 움직인다. 그 평균은
//    사실상 '개인 의견'이라 역할별 비교에 쓰면 안 된다. 3명부터는 한 사람의
//    영향이 1.33점 이하로 떨어진다.
//  - 3명 미만은 익명성도 위태롭다. "그 역할에서 답한 사람"이 한둘이면
//    응답 내용으로 사람이 특정된다(설문 화면에서 익명이라고 고지한 것과 직결).
//  - 문턱을 5로 올리는 안도 있었지만, 사무국장처럼 **원래 인원이 1~2명인
//    역할**이 있어서 거의 모든 칸이 경고가 된다. 전부 경고면 경고가 아니다.
const SMALL_SAMPLE = 3;

// ⚠️ 백엔드 UNSET_BUCKET 과 **같은 문자열**이어야 한다(survey/routes.py).
//    역할·프로세스를 안 고른 응답이 모이는 칸의 키다. 여기가 어긋나면 미지정
//    칸이 평범한 역할 하나로 섞여 들어가서 "미지정 N건" 경고가 영영 안 뜬다.
const UNSET_BUCKET = '미지정';

// 축 하나를 그리는 데 필요한 것 전부를 한 줄에 모은다. 축이 하나 더 늘어도
// 아래 렌더 코드를 복사하지 않고 이 배열만 늘리면 된다.
const AXES = [
  {
    key: 'role',
    label: '역할별',
    slicesKey: 'by_role',
    definedKey: 'roles',            // survey.roles — 설문이 물은 역할 목록
    audienceKey: 'audience_roles',  // 문항이 어느 역할에게 보였는가
    unsetLabel: '역할 미지정',
    notAsked: '이 역할에게는 묻지 않은 문항입니다. 응답 0 과 다릅니다.',
    warnHead: '건은 역할을 고르지 않았습니다.',
  },
  {
    key: 'process',
    label: '프로세스별',
    slicesKey: 'by_process',
    definedKey: 'processes',
    audienceKey: 'audience_processes',
    unsetLabel: '프로세스 미지정',
    notAsked: '이 프로세스에서는 묻지 않은 문항입니다. 응답 0 과 다릅니다.',
    warnHead: '건은 프로세스를 고르지 않았습니다.',
  },
];

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
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

const Title = styled.h3`
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: #1e293b;
`;

const Summary = styled.div`
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
  padding: 0.875rem 1.125rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
`;

const Stat = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
`;

const StatLabel = styled.span`
  font-size: 0.75rem;
  color: #94a3b8;
  font-weight: 600;
`;

const StatValue = styled.span`
  font-size: 1.125rem;
  font-weight: 700;
  color: ${p => (p.$warn ? '#b45309' : '#1e293b')};
`;

const Tabs = styled.div`
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
`;

const Tab = styled.button`
  padding: 0.4rem 0.85rem;
  border: 1px solid ${p => (p.$on ? ACCENT : '#e2e8f0')};
  border-radius: 0.375rem;
  background: ${p => (p.$on ? ACCENT_TINT : 'white')};
  color: ${p => (p.$on ? ACCENT_DARK : '#64748b')};
  font-size: 0.8125rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  &:hover { border-color: ${p => (p.$on ? ACCENT : ACCENT_LINE)}; }
`;

const Warn = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.75rem 0.875rem;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 0.5rem;
  color: #92400e;
  font-size: 0.8125rem;
  line-height: 1.55;
`;

const Note = styled.div`
  font-size: 0.75rem;
  color: #94a3b8;
  line-height: 1.65;
`;

// 섹션 제목. 문항 묶음의 경계를 눈으로 잡아 준다 — 수십 문항짜리 설문에서
// 카드가 줄줄이 이어지면 어디서 주제가 바뀌는지 알 수 없다.
const SectionHead = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 700;
  color: #475569;
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: #e2e8f0;
  }
`;

const QCard = styled.div`
  padding: 0.875rem 1.125rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
`;

const QText = styled.div`
  font-size: 0.9375rem;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 0.5rem;
`;

const LinkTag = styled.span`
  display: inline-block;
  margin-left: 0.4rem;
  padding: 0.1rem 0.45rem;
  border-radius: 0.25rem;
  font-size: 0.6875rem;
  font-weight: 700;
  background: ${ACCENT_TINT};
  color: ${ACCENT_DARK};
  vertical-align: middle;
`;

const Bars = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-top: 0.5rem;
`;

const BarRow = styled.div`
  display: grid;
  grid-template-columns: 2.5rem 1fr 3rem;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: #64748b;
`;

const BarTrack = styled.div`
  height: 0.6rem;
  background: #f1f5f9;
  border-radius: 0.3rem;
  overflow: hidden;
`;

const BarFill = styled.div`
  height: 100%;
  width: ${p => p.$pct}%;
  background: ${ACCENT};
`;

const ChoiceRow = styled(BarRow)`
  grid-template-columns: minmax(6rem, 12rem) 1fr auto;
  > span:first-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const Values = styled.ul`
  margin: 0.5rem 0 0;
  padding-left: 1.1rem;
  font-size: 0.8125rem;
  color: #475569;
  line-height: 1.6;
`;

// 축별 카드. 미지정 칸은 테두리부터 경고색이다 — 목록을 훑을 때 진짜 역할
// 하나로 읽히면 안 된다.
const SliceCard = styled.div`
  padding: 0.875rem 1.125rem;
  background: white;
  border: 1px solid ${p => (p.$unset ? '#fde68a' : '#e2e8f0')};
  border-radius: 0.5rem;
`;

const SliceHead = styled.div`
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.25rem;
`;

const SliceName = styled.span`
  font-size: 0.9375rem;
  font-weight: 700;
  color: #1e293b;
`;

const CountTag = styled.span`
  padding: 0.1rem 0.45rem;
  border-radius: 0.25rem;
  font-size: 0.6875rem;
  font-weight: 700;
  background: ${p => (p.$warn ? '#fffbeb' : '#f1f5f9')};
  border: 1px solid ${p => (p.$warn ? '#fde68a' : 'transparent')};
  color: ${p => (p.$warn ? '#b45309' : '#64748b')};
`;

const SubSection = styled.div`
  margin-top: 0.6rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: #94a3b8;
`;

const QRow = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: baseline;
  gap: 0.75rem;
  padding: 0.35rem 0;
  border-top: 1px solid #f1f5f9;
  font-size: 0.8125rem;
  line-height: 1.5;
`;

const QRowText = styled.span`
  color: ${p => (p.$muted ? '#cbd5e1' : '#475569')};
`;

const Metric = styled.span`
  white-space: nowrap;
  font-weight: 700;
  color: ${p => (p.$warn ? '#b45309' : ACCENT_DARK)};
`;

// '묻지 않음' 은 숫자가 아니라 상태다. 평균 자리에 회색 표식으로 둬서
// 0점·응답없음과 한눈에 갈라 보이게 한다.
const NotAskedTag = styled.span`
  white-space: nowrap;
  padding: 0.05rem 0.4rem;
  border: 1px dashed #cbd5e1;
  border-radius: 0.25rem;
  font-size: 0.6875rem;
  font-weight: 700;
  color: #94a3b8;
`;

const NoAnswer = styled.span`
  white-space: nowrap;
  font-size: 0.75rem;
  font-weight: 600;
  color: #94a3b8;
`;

const RevealButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  align-self: flex-start;
  padding: 0.45rem 0.8rem;
  border: 1px solid #fecaca;
  border-radius: 0.375rem;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  &:hover { background: #fee2e2; }
`;

const ExportButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  align-self: flex-start;
  padding: 0.45rem 0.8rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.375rem;
  background: white;
  color: #475569;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  &:hover { border-color: ${ACCENT}; color: ${ACCENT_DARK}; }
`;

const IdentityTable = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.75rem 0.875rem;
  background: white;
  border: 1px solid #fecaca;
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  color: #475569;
`;

const Empty = styled.div`
  padding: 2rem 1.25rem;
  text-align: center;
  color: #94a3b8;
  background: white;
  border: 1px dashed #cbd5e1;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  line-height: 1.7;
`;

/**
 * 문항을 섹션으로 묶는다.
 *
 * ⚠️ 같은 이름이 떨어져서 나오면 **합치지 않는다.** 연속된 구간만 한 묶음으로
 *    본다. 합치려면 문항 순서를 바꿔야 하는데, 순서는 설문을 만든 사람이 정한
 *    것이고 집계 화면이 임의로 재배열하면 원본 설문과 대조가 안 된다.
 *    (표 임포트는 섹션을 빈 칸으로 이어받으므로 실제로는 늘 연속이다.)
 */
function groupBySection(questions) {
  const groups = [];
  questions.forEach(q => {
    const section = q.section || '';
    const last = groups[groups.length - 1];
    if (last && last.section === section) last.items.push(q);
    else groups.push({ section, items: [q] });
  });
  return groups;
}

/**
 * 축 칸의 순서를 정한다. 설문이 정의한 순서(survey.roles)를 우선하고, 정의에
 * 없는데 응답에 등장한 값은 뒤에 붙인다.
 *
 * 미지정은 **항상 맨 끝**이다. 역할 사이에 끼면 목록을 훑을 때 진짜 역할
 * 하나로 읽힌다.
 */
function sliceOrder(slices, defined) {
  const keys = Object.keys(slices || {});
  const out = [];
  (defined || []).forEach(k => {
    if (keys.includes(k) && !out.includes(k)) out.push(k);
  });
  keys.forEach(k => {
    if (k !== UNSET_BUCKET && !out.includes(k)) out.push(k);
  });
  if (keys.includes(UNSET_BUCKET)) out.push(UNSET_BUCKET);
  return out;
}

// divisions 기본값이 [] 인 것이 중요하다. 사업부 목록을 못 받아왔을 때
// undefined 가 오면 아래 .find 에서 화면이 통째로 터진다 — 집계는 사업부
// 이름을 몰라도 보여줄 수 있어야 한다.
const SurveyResults = ({ results, divisions = [], onBack, onReveal, onExport,
                        onExportSummary }) => {
  const [identities, setIdentities] = useState(null);
  const [axisKey, setAxisKey] = useState('all');

  const questions = useMemo(() => results?.questions || [], [results]);
  const groups = useMemo(() => groupBySection(questions), [questions]);

  // 문항의 대상 역할·프로세스는 집계 응답의 questions[] 에 같이 실리는 것이
  // 정상이지만, 서버 버전에 따라 survey.questions 쪽으로 오기도 한다. 두 곳을
  // 다 본다 — 둘 다 없으면 '모른다'로 두고 '묻지 않음'이라고 **단정하지 않는다**
  // (아래 questionAsked 참고).
  const surveyQuestions = useMemo(() => {
    const map = {};
    (results?.survey?.questions || []).forEach(q => { map[String(q.id)] = q; });
    return map;
  }, [results]);

  // ⚠️ 여기서 그냥 return 하면 **뒤로 가는 길이 사라진다.**
  //
  // 집계 조회가 403·500·네트워크로 실패하면 results 가 계속 null 이라
  // '불러오는 중…' 에 갇히고, 목록으로 돌아갈 방법이 새로고침뿐이 된다.
  // 오류 메시지는 바깥(SurveyManager)이 띄우므로, 여기서는 **나갈 길만**
  // 반드시 같이 그린다.
  if (!results) {
    return (
      <Wrap>
        <Back onClick={onBack}><ArrowLeft size={15} /> 설문 목록</Back>
        <Empty>불러오는 중…</Empty>
      </Wrap>
    );
  }

  const { survey, target_count, response_count, unknown_division_count } = results;

  // 사업부 id 는 설정 API 가 문자열로, 응답 집계는 숫자 기반 키로 준다.
  // 양쪽을 String 으로 맞춰야 조용히 '#3' 으로만 찍히는 일이 없다.
  const divisionName = (key) =>
    key === 'unknown' ? '소속 미확인'
      : (divisions.find(d => String(d.id) === String(key))?.name || `#${key}`);

  const rate = target_count ? Math.round(response_count * 100 / target_count) : null;

  const reveal = async () => {
    const rows = await onReveal();
    if (rows) setIdentities(rows);
  };

  const audienceOf = (q, field) => {
    const own = q[field];
    if (Array.isArray(own)) return own;
    const fallback = surveyQuestions[String(q.question_id)]?.[field];
    return Array.isArray(fallback) ? fallback : null;
  };

  /**
   * 이 문항이 이 칸(역할·프로세스 값)의 응답자에게 **보였는가.**
   *   true  → 물었다
   *   false → 안 물었다 (응답 0 은 당연하다. 0점이 아니다)
   *   null  → 대상 정보가 안 실려 와서 판단할 수 없다
   *
   * ⚠️ 빈 배열은 **전원**이다(SURVEY_PLAN). 반대로 구현하면 아무에게도 안 물은
   *    문항 취급이 되어, 멀쩡히 답이 쌓인 문항이 전부 '묻지 않음'으로 찍힌다.
   * ⚠️ null 을 false 로 뭉개지 않는다. 모르는 것을 '안 물었다'고 단정하면
   *    실제로는 물었는데 아무도 안 답한 문항 — 봐야 할 신호 — 이 조용히 사라진다.
   */
  const questionAsked = (q, axis, sliceKey) => {
    const list = audienceOf(q, axis.audienceKey);
    if (list === null) return null;
    if (list.length === 0) return true;
    // 축을 안 고른 응답자에게는 대상이 지정된 문항이 아예 안 보였다
    // (서버 question_applies 와 같은 규칙).
    if (sliceKey === UNSET_BUCKET) return false;
    return list.includes(sliceKey);
  };

  // 탭 목록. by_role / by_process 가 없는 구버전 응답에서는 축 탭이 아예 안
  // 생기고, 아래에서 탭 줄 자체를 안 그린다 — 예전 화면 그대로다.
  const axes = AXES.filter(axis => {
    const slices = results[axis.slicesKey];
    if (!slices || typeof slices !== 'object') return false;
    // 설문이 그 축을 묻지 않으면 모든 응답이 '미지정' 한 칸에 몰린다. 그런
    // 탭은 볼 것이 없으므로 안 만든다.
    return Object.keys(slices).some(k => k !== UNSET_BUCKET)
      || (survey?.[axis.definedKey] || []).length > 0;
  });

  // 없는 축이 골라져 있으면 전체로 되돌린다(설문을 바꿔 들어온 경우).
  const activeAxis = axes.find(a => a.key === axisKey) || null;
  const unsetCountOf = (axis) => results[axis.slicesKey]?.[UNSET_BUCKET]?.count || 0;

  const renderQuestionCard = (q) => (
    <QCard key={q.question_id}>
      <QText>
        {q.text}
        {q.link_key && <LinkTag>진단 연결 · {linkKeyLabel(q.link_key)}</LinkTag>}
      </QText>
      {q.qtype === 'scale' ? (
        <>
          <div style={{ fontSize: '0.875rem', color: '#475569' }}>
            평균 <strong style={{ color: ACCENT_DARK }}>{q.average ?? '—'}</strong>
            <span style={{ color: '#94a3b8' }}> · {q.answer_count}명 응답</span>
          </div>
          <Bars>
            {[1, 2, 3, 4, 5].map(n => {
              const count = q.distribution?.[String(n)] || 0;
              const pct = q.answer_count ? (count * 100 / q.answer_count) : 0;
              return (
                <BarRow key={n}>
                  <span>{n}점</span>
                  <BarTrack><BarFill $pct={pct} /></BarTrack>
                  <span>{count}명</span>
                </BarRow>
              );
            })}
          </Bars>
          {Object.keys(q.by_division || {}).length > 0 && (
            <Bars style={{ marginTop: '0.75rem' }}>
              {Object.entries(q.by_division).map(([key, v]) => (
                <BarRow key={key}>
                  <span style={{ gridColumn: 'span 2' }}>{divisionName(key)}</span>
                  <span>{v.average} ({v.count})</span>
                </BarRow>
              ))}
            </Bars>
          )}
        </>
      ) : (
        <>
          <div style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>
            {q.answer_count}명 응답
          </div>

          {/* 객관식은 **세어서** 보여준다. 원문만 스무 줄 늘어놓으면 읽다가
              포기하게 되고, 유형화하려고 객관식으로 만든 이유가 사라진다.
              아무도 안 고른 보기도 남긴다 — 그것도 결과다. */}
          {(q.choice_counts || []).length > 0 && (
            <Bars>
              {q.choice_counts.map((c, i) => {
                const pct = q.answer_count ? (c.count * 100 / q.answer_count) : 0;
                const rank = q.rank_average?.[c.value];
                return (
                  <ChoiceRow key={i}>
                    <span title={c.unlisted ? '보기에 없는 답입니다. 배포 뒤 보기를 고쳤거나 옛 화면으로 낸 응답일 수 있습니다.' : c.value}>
                      {c.value}{c.unlisted && ' *'}
                    </span>
                    <BarTrack><BarFill $pct={pct} /></BarTrack>
                    <span>
                      {c.count}명 ({Math.round(pct)}%)
                      {rank != null && ` · 평균 ${rank}순위`}
                    </span>
                  </ChoiceRow>
                );
              })}
            </Bars>
          )}

          {/* 자유서술 원문. 객관식에도 '기타' 서술이 섞이므로 같이 둔다. */}
          {(q.values || []).length > 0 && q.qtype === 'text' && (
            <Values>
              {q.values.slice(0, 20).map((v, i) => (
                <li key={i}>{typeof v === 'object' ? JSON.stringify(v) : v}</li>
              ))}
              {q.values.length > 20 && (
                <li style={{ color: '#94a3b8' }}>
                  … 외 {q.values.length - 20}건. 전부 보시려면 원자료를 내려받으세요.
                </li>
              )}
            </Values>
          )}
        </>
      )}
    </QCard>
  );

  // 축 칸 하나 안에서 문항 한 줄.
  const renderSliceRow = (q, axis, sliceKey, cells) => {
    const asked = questionAsked(q, axis, sliceKey);
    const cell = cells[String(q.question_id)];
    const count = cell?.answer_count || 0;

    let right;
    if (asked === false) {
      // 5번 요구사항의 핵심. 안 물어본 것과 0점은 다르다.
      right = <NotAskedTag title={axis.notAsked}>묻지 않음</NotAskedTag>;
    } else if (count === 0) {
      right = (
        <NoAnswer title={asked === null
          ? '이 문항이 이 칸의 대상이었는지는 집계에 실려 오지 않았습니다. 응답만 없는 것일 수 있습니다.'
          : '물었지만 아무도 답하지 않았습니다.'}
        >
          응답 없음{asked === null ? ' (대상 여부 미상)' : ''}
        </NoAnswer>
      );
    } else if (q.qtype === 'scale') {
      right = (
        <Metric $warn={count < SMALL_SAMPLE} title={count < SMALL_SAMPLE
          ? `${count}명뿐입니다 — 한 사람이 평균을 크게 움직입니다`
          : undefined}
        >
          {cell.average ?? '—'} <span style={{ fontWeight: 600 }}>({count}명)</span>
        </Metric>
      );
    } else {
      right = (
        <Metric $warn={count < SMALL_SAMPLE} title={count < SMALL_SAMPLE
          ? `${count}명뿐입니다 — 표본이 너무 작습니다`
          : undefined}
        >
          {count}명 응답
        </Metric>
      );
    }

    return (
      <QRow key={q.question_id}>
        <QRowText $muted={asked === false}>{q.text}</QRowText>
        {right}
      </QRow>
    );
  };

  const renderAxis = (axis) => {
    const slices = results[axis.slicesKey] || {};
    const order = sliceOrder(slices, survey?.[axis.definedKey]);
    const unset = unsetCountOf(axis);

    return (
      <>
        <Note>
          응답 {SMALL_SAMPLE}명 미만인 칸은 <strong style={{ color: '#b45309' }}>주황</strong>으로
          표시합니다 — 한 사람이 평균을 크게 흔들어서 그 숫자를 전사 결론처럼 읽으면 안 됩니다.
          {' '}대상이 아니었던 문항은 <strong>묻지 않음</strong>으로 따로 표시합니다(응답 0 과 다릅니다).
          {' '}서술형 원문은 역할로 한 번 더 나누면 응답자가 특정되므로 여기 싣지 않습니다 —
          {' '}원문은 [전체]에서 봅니다.
        </Note>

        {/* 미지정도 숨기지 않는다. 소속 미확인을 다루는 방식과 같다 —
            아무 역할에나 섞으면 그 역할의 평균이 조용히 바뀐다. */}
        {unset > 0 && (
          <Warn>
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
            <span>
              <strong>{unset}{axis.warnHead}</strong>{' '}
              이 응답들은 어느 칸에도 섞이지 않고 아래 <strong>{UNSET_BUCKET}</strong> 칸에
              따로 모여 있습니다. 비율이 크면 축별 비교 자체를 그대로 믿지 마세요.
            </span>
          </Warn>
        )}

        {order.length === 0 ? (
          <Empty>아직 이 축으로 나눌 응답이 없습니다.</Empty>
        ) : order.map(key => {
          const slice = slices[key] || { count: 0, questions: {} };
          const cells = slice.questions || {};
          const isUnset = key === UNSET_BUCKET;
          return (
            <SliceCard key={key} $unset={isUnset}>
              <SliceHead>
                <SliceName>{isUnset ? axis.unsetLabel : key}</SliceName>
                <CountTag
                  $warn={isUnset || slice.count < SMALL_SAMPLE}
                  title={slice.count < SMALL_SAMPLE
                    ? `응답 ${slice.count}명 — 표본이 작습니다`
                    : undefined}
                >
                  응답 {slice.count}명
                </CountTag>
              </SliceHead>
              {groups.map((g, gi) => (
                <div key={gi}>
                  {g.section && <SubSection>{g.section}</SubSection>}
                  {g.items.map(q => renderSliceRow(q, axis, key, cells))}
                </div>
              ))}
            </SliceCard>
          );
        })}
      </>
    );
  };

  return (
    <Wrap>
      <Back onClick={onBack}><ArrowLeft size={15} /> 설문 목록</Back>
      <Title>{survey.title}</Title>

      <Summary>
        <Stat>
          <StatLabel>응답</StatLabel>
          <StatValue>
            {response_count}명 / 대상 {target_count}명
            {rate !== null && ` (${rate}%)`}
          </StatValue>
        </Stat>
        <Stat>
          <StatLabel>소속 미확인</StatLabel>
          <StatValue $warn={unknown_division_count > 0}>{unknown_division_count}건</StatValue>
        </Stat>
        {/* 미지정 건수는 탭을 안 열어도 늘 보인다. 축 화면 안에만 두면
            '전체'만 보는 사람에게는 없는 숫자가 된다. */}
        {axes.map(axis => (
          <Stat key={axis.key}>
            <StatLabel>{axis.unsetLabel}</StatLabel>
            <StatValue $warn={unsetCountOf(axis) > 0}>{unsetCountOf(axis)}건</StatValue>
          </Stat>
        ))}
      </Summary>

      {/* 축이 하나도 없으면(구버전 응답) 탭 줄 자체를 안 그린다 — '전체' 하나만
          떠 있는 탭은 아무 것도 알려주지 않는다. */}
      {axes.length > 0 && (
        <Tabs>
          <Tab $on={!activeAxis} onClick={() => setAxisKey('all')}>전체</Tab>
          {axes.map(axis => (
            <Tab
              key={axis.key}
              $on={activeAxis?.key === axis.key}
              onClick={() => setAxisKey(axis.key)}
            >
              {axis.label}
            </Tab>
          ))}
        </Tabs>
      )}

      {response_count === 0 && (
        <Empty>아직 응답이 없습니다. 배포 상태와 대상 설정을 확인하세요.</Empty>
      )}

      {/* 소속 미확인 경고는 축을 무엇으로 보든 늘 뜬다. 사업부별 평균을
          왜곡하는 사실은 탭과 무관하다. */}
      {unknown_division_count > 0 && (
        <Warn>
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
          <span>
            <strong>{unknown_division_count}건은 사업부를 정하지 못했습니다.</strong>{' '}
            응답자 소속에서 사업부를 유도하지 못했고 본인도 고르지 않은 경우입니다.
            사업부별 평균에는 이 응답이 빠져 있으니, 비율이 크면 그 숫자를 그대로
            믿지 마세요.
          </span>
        </Warn>
      )}

      {activeAxis
        ? renderAxis(activeAxis)
        : groups.map((g, gi) => (
          <React.Fragment key={gi}>
            {g.section && <SectionHead>{g.section}</SectionHead>}
            {g.items.map(renderQuestionCard)}
          </React.Fragment>
        ))}

      {/* 누르기 **전에** 기록이 남는다고 적어 둔다. 누른 뒤에 알려주면 고지가
          아니라 통보다. */}
      {response_count > 0 && (
        <ExportButton onClick={onExportSummary}>
          <Download size={15} />
          집계표 내려받기 (CSV) — 화면의 숫자 그대로, 보고서용
        </ExportButton>
      )}

      {response_count > 0 && (
        <ExportButton onClick={onExport}>
          <Download size={15} />
          응답 원자료 내려받기 (CSV) — 응답자 이름은 들어가지 않습니다
        </ExportButton>
      )}

      {response_count > 0 && !identities && (
        <RevealButton onClick={reveal}>
          <Eye size={15} />
          응답자 확인 — 누르면 열람 기록이 남습니다
        </RevealButton>
      )}

      {identities && (
        <IdentityTable>
          {identities.map(r => (
            <div key={r.id}>
              {r.department_name || '소속 미상'} · <strong>{r.user_name}</strong>
            </div>
          ))}
        </IdentityTable>
      )}
    </Wrap>
  );
};

export default SurveyResults;
