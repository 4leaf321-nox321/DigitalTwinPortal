import React, { useState } from 'react';
import styled from 'styled-components';
import { Eye, AlertTriangle, ArrowLeft } from 'lucide-react';
import { linkKeyLabel } from '../../constants/questionTemplates';
import { ACCENT, ACCENT_DARK, ACCENT_TINT } from '../../theme';

// 집계.
//
// **응답 수를 평균 옆에 항상 같이 둔다.** "3.2점" 만 있는 화면은 몇 명이
// 답했는지 모르는 평균이라 판단에 못 쓴다. 7명이 답한 3.2 와 2명이 답한 3.2 는
// 다른 이야기다.
//
// **소속 미확인도 숨기지 않는다.** 숨기면 그럴듯한 사업부별 평균이 나오는데
// 실은 절반이 어디 것인지 모르는 상태가 된다(SURVEY_PLAN 5절).

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

const Values = styled.ul`
  margin: 0.5rem 0 0;
  padding-left: 1.1rem;
  font-size: 0.8125rem;
  color: #475569;
  line-height: 1.6;
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

// divisions 기본값이 [] 인 것이 중요하다. 사업부 목록을 못 받아왔을 때
// undefined 가 오면 아래 .find 에서 화면이 통째로 터진다 — 집계는 사업부
// 이름을 몰라도 보여줄 수 있어야 한다.
const SurveyResults = ({ results, divisions = [], onBack, onReveal }) => {
  const [identities, setIdentities] = useState(null);

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

  const { survey, target_count, response_count, unknown_division_count, questions } = results;
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
      </Summary>

      {response_count === 0 && (
        <Empty>아직 응답이 없습니다. 배포 상태와 대상 설정을 확인하세요.</Empty>
      )}

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

      {questions.map(q => (
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
              <Values>
                {(q.values || []).slice(0, 20).map((v, i) => (
                  <li key={i}>{typeof v === 'object' ? JSON.stringify(v) : v}</li>
                ))}
              </Values>
            </>
          )}
        </QCard>
      ))}

      {/* 누르기 **전에** 기록이 남는다고 적어 둔다. 누른 뒤에 알려주면 고지가
          아니라 통보다. */}
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
