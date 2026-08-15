import React, { useState, useMemo } from 'react';
import styled from 'styled-components';
import { ArrowLeft, Eye, AlertTriangle } from 'lucide-react';
import { ACCENT, ACCENT_DARK, ACCENT_LINE, ACCENT_TINT } from '../../theme';

// 배포 전에 **응답자가 무엇을 보는지** 확인하는 자리.
//
// ⚠️ 배포하고 응답이 한 건이라도 들어오면 문항이 잠겨서 못 고친다. 그러니
//    확인할 마지막 기회가 배포 직전인데, 지금까지는 그 수단이 없었다.
//    관리 화면의 문항 목록은 **전부** 보여주므로, 실제로 한 사람이 몇 개를
//    받는지는 거기서 알 수 없다.
//
// 역할·프로세스를 바꿔가며 **그 사람이 받는 문항만** 추린다. 여기서 흔히
// 드러나는 것 둘:
//   · 어떤 조합은 받는 문항이 0개다 — 그 사람은 제출조차 못 한다(서버가 409).
//   · 공통 문항이 하나도 없다 — 역할을 안 고르면 아무것도 안 보인다.

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

const Bar = styled.div`
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  padding: 0.75rem 0.875rem;
  background: ${ACCENT_TINT};
  border: 1px solid ${ACCENT_LINE};
  border-radius: 0.5rem;
`;

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: ${ACCENT_DARK};
`;

const Select = styled.select`
  padding: 0.4rem 0.6rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  font-family: inherit;
  background: white;
  color: #1e293b;
`;

const Count = styled.div`
  align-self: flex-end;
  font-size: 0.8125rem;
  font-weight: 700;
  color: ${p => (p.$zero ? '#b91c1c' : ACCENT_DARK)};
`;

const Warn = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.75rem 0.875rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.5rem;
  color: #b91c1c;
  font-size: 0.8125rem;
  line-height: 1.6;
`;

const SectionHead = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 700;
  color: #475569;
  &::after { content: ''; flex: 1; height: 1px; background: #e2e8f0; }
`;

const QCard = styled.div`
  padding: 0.75rem 1rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
`;

const QText = styled.div`
  font-size: 0.9375rem;
  font-weight: 600;
  color: #1e293b;
`;

const QMeta = styled.div`
  margin-top: 0.3rem;
  font-size: 0.75rem;
  color: #94a3b8;
`;

const Choices = styled.div`
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
  margin-top: 0.4rem;
`;

const Choice = styled.span`
  padding: 0.15rem 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.3rem;
  font-size: 0.75rem;
  color: #475569;
`;

const Empty = styled.div`
  padding: 1.75rem 1.25rem;
  text-align: center;
  color: #94a3b8;
  background: white;
  border: 1px dashed #cbd5e1;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  line-height: 1.7;
`;

const QTYPE_LABEL = {
  scale: '척도', choice: '객관식', multi: '복수선택', rank: '순위', text: '자유서술',
};

/** 서버의 question_applies() 와 **같은 규칙**. 빈 대상은 전원이다. */
const applies = (q, role, process) => {
  const roles = q.audience_roles || [];
  const procs = q.audience_processes || [];
  if (roles.length && !roles.includes(role)) return false;
  if (procs.length && !procs.includes(process)) return false;
  return true;
};

const SurveyPreview = ({ survey, onBack }) => {
  const roles = survey?.roles || [];
  const processes = survey?.processes || [];
  const [role, setRole] = useState(roles[0] || '');
  const [process, setProcess] = useState(processes[0] || '');

  const questions = survey?.questions || [];
  const shown = useMemo(
    () => questions.filter(q => applies(q, role, process)),
    [questions, role, process],
  );

  // 섹션으로 묶되 **표에 적힌 순서**를 지킨다. 이름으로 모으면 떨어져 있던
  // 같은 이름이 붙어 순서가 표와 달라지고, 미리보기가 실제와 어긋난다.
  const groups = [];
  shown.forEach(q => {
    const name = q.section || '';
    const last = groups[groups.length - 1];
    if (last && last.name === name) last.items.push(q);
    else groups.push({ name, items: [q] });
  });

  // 아무 역할도 안 고른 사람이 받는 문항(= 전원 대상만).
  const commonCount = questions.filter(
    q => !(q.audience_roles || []).length && !(q.audience_processes || []).length
  ).length;

  return (
    <Wrap>
      <Back onClick={onBack}><ArrowLeft size={15} /> 설문 목록</Back>
      <Title><Eye size={16} /> {survey?.title} — 응답 화면 미리보기</Title>

      <Bar>
        {roles.length > 0 && (
          <Field>
            역할
            <Select value={role} onChange={e => setRole(e.target.value)}>
              {roles.map(r => <option key={r} value={r}>{r}</option>)}
            </Select>
          </Field>
        )}
        {processes.length > 0 && (
          <Field>
            프로세스
            <Select value={process} onChange={e => setProcess(e.target.value)}>
              {processes.map(p => <option key={p} value={p}>{p}</option>)}
            </Select>
          </Field>
        )}
        <Count $zero={shown.length === 0}>
          이 사람이 받는 문항 {shown.length}개 / 전체 {questions.length}개
        </Count>
      </Bar>

      {shown.length === 0 && (
        <Warn>
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
          <span>
            <strong>이 조합은 받는 문항이 하나도 없습니다.</strong> 이대로 배포하면
            해당하는 사람은 <strong>제출조차 못 합니다.</strong> 전원 대상 문항을
            두거나, 이 조합에 맞는 문항을 넣으세요.
          </span>
        </Warn>
      )}

      {commonCount === 0 && questions.length > 0 && (
        <Warn>
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
          <span>
            <strong>전원이 보는 문항이 하나도 없습니다.</strong> 모든 문항이
            역할이나 프로세스에 묶여 있어, 목록에 없는 조합인 사람은 빈 설문을
            받습니다.
          </span>
        </Warn>
      )}

      {groups.length === 0 ? (
        <Empty>보여줄 문항이 없습니다.</Empty>
      ) : groups.map((g, gi) => (
        <React.Fragment key={`${g.name}-${gi}`}>
          {g.name && <SectionHead>{g.name}</SectionHead>}
          {g.items.map(q => (
            <QCard key={q.id ?? `${gi}-${q.text}`}>
              <QText>{q.text}{q.required && ' *'}</QText>
              <QMeta>
                {QTYPE_LABEL[q.qtype] || q.qtype}
                {q.required ? ' · 필수' : ' · 선택'}
                {q.help_text ? ` · ${q.help_text}` : ''}
              </QMeta>
              {(q.options?.choices || []).length > 0 && (
                <Choices>
                  {q.options.choices.map((c, i) => (
                    <Choice key={i}>{typeof c === 'object' ? (c.label ?? c.value) : c}</Choice>
                  ))}
                </Choices>
              )}
            </QCard>
          ))}
        </React.Fragment>
      ))}
    </Wrap>
  );
};

export default SurveyPreview;
