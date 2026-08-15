import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { Inbox, CheckCircle2, Clock, FileText } from 'lucide-react';
import surveyApi from '../../services/surveyApi';
import SurveyForm from './SurveyForm';
import { ACCENT, ACCENT_DARK, ACCENT_TINT, READING_WIDTH } from '../../theme';

// 응답자의 얼굴 — 받은 설문 목록과 응답 폼.
//
// 목록과 폼을 한 컴포넌트가 들고 있는 이유는, 폼에서 제출하면 목록의 상태
// (응답함 표시·미응답 건수)가 **같이** 바뀌어야 하기 때문이다. 둘을 갈라 두면
// 제출 후 목록이 옛 상태로 남아 "냈는데 안 낸 것으로 보이는" 화면이 된다.
//
// 목록 순서는 서버가 정한다(미응답 먼저). 프론트에서 다시 정렬하지 않는다 —
// 정렬 규칙이 두 군데 있으면 언젠가 어긋난다.

const Wrap = styled.div`
  max-width: ${READING_WIDTH};
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const Head = styled.div`
  display: flex;
  align-items: baseline;
  gap: 0.625rem;
  flex-wrap: wrap;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: #1e293b;
`;

const Hint = styled.span`
  font-size: 0.8125rem;
  color: #94a3b8;
`;

const Row = styled.button`
  display: flex;
  align-items: flex-start;
  gap: 0.875rem;
  width: 100%;
  padding: 1rem 1.25rem;
  text-align: left;
  background: white;
  border: 1px solid ${p => (p.$done ? '#e2e8f0' : ACCENT)};
  border-radius: 0.5rem;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover { box-shadow: 0 1px 6px rgba(15, 23, 42, 0.08); }
`;

const Body = styled.div`
  flex: 1;
  min-width: 0;
`;

const RowTitle = styled.div`
  font-size: 0.9375rem;
  font-weight: 600;
  color: ${p => (p.$done ? '#64748b' : '#1e293b')};
  line-height: 1.5;
`;

const RowDesc = styled.div`
  margin-top: 0.25rem;
  font-size: 0.8125rem;
  color: #94a3b8;
  line-height: 1.6;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`;

const Meta = styled.div`
  display: flex;
  gap: 0.75rem;
  margin-top: 0.5rem;
  flex-wrap: wrap;
  font-size: 0.75rem;
  color: #94a3b8;
`;

const MetaItem = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
`;

const Status = styled.span`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.55rem;
  border-radius: 0.3rem;
  font-size: 0.6875rem;
  font-weight: 700;
  background: ${p => (p.$done ? '#f1f5f9' : ACCENT_TINT)};
  color: ${p => (p.$done ? '#94a3b8' : ACCENT_DARK)};
`;

const Empty = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem 1.5rem;
  text-align: center;
  color: #94a3b8;
  background: white;
  border: 1px dashed #cbd5e1;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  line-height: 1.75;
`;

const ErrorBox = styled.div`
  padding: 0.75rem 1rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.5rem;
  color: #b91c1c;
  font-size: 0.8125rem;
`;

const Muted = styled.div`
  padding: 2rem 1.25rem;
  text-align: center;
  color: #94a3b8;
  font-size: 0.875rem;
`;

const formatDeadline = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getMonth() + 1}. ${d.getDate()}.까지`;
};

const MySurveys = ({ onPendingChange }) => {
  const [surveys, setSurveys] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await surveyApi.listMine();
      const rows = res.data || [];
      setSurveys(rows);
      // 헤더 배지가 쓰는 값. 목록을 이미 받았으므로 /mine/count 를 또 부르지
      // 않는다 — 두 번 부르면 두 값이 어긋나는 순간이 생긴다.
      onPendingChange?.(rows.filter(s => !s.answered).length);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [onPendingChange]);

  useEffect(() => { load(); }, [load]);

  if (openId != null) {
    return (
      <SurveyForm
        surveyId={openId}
        onBack={() => { setOpenId(null); load(); }}
        onSubmitted={load}
      />
    );
  }

  const pending = surveys.filter(s => !s.answered).length;

  return (
    <Wrap>
      <Head>
        <Title>받은 설문</Title>
        <Hint>
          {loading ? '불러오는 중…'
            : pending > 0 ? `아직 답하지 않은 설문 ${pending}건`
            : '답하지 않은 설문이 없습니다'}
        </Hint>
      </Head>

      {error && <ErrorBox>{error}</ErrorBox>}

      {loading ? (
        <Muted>불러오는 중…</Muted>
      ) : surveys.length === 0 ? (
        <Empty>
          <Inbox size={32} strokeWidth={1.5} />
          <span>
            <strong>받은 설문이 없습니다.</strong><br />
            설문이 배포되면 여기에 나타납니다. 대상이 아닌 설문은 보이지 않습니다.
          </span>
        </Empty>
      ) : (
        surveys.map(s => (
          <Row key={s.id} $done={s.answered} onClick={() => setOpenId(s.id)}>
            <Body>
              <RowTitle $done={s.answered}>{s.title}</RowTitle>
              {s.description && <RowDesc>{s.description}</RowDesc>}
              <Meta>
                <MetaItem><FileText size={12} /> 문항 {s.question_count}개</MetaItem>
                {formatDeadline(s.closes_at) && (
                  <MetaItem><Clock size={12} /> {formatDeadline(s.closes_at)}</MetaItem>
                )}
              </Meta>
            </Body>
            {/* 이미 답한 설문도 목록에서 지우지 않는다. 사라지면 '냈는지 안
                냈는지'를 확인할 방법이 없어져서 같은 걱정을 반복하게 된다. */}
            <Status $done={s.answered}>
              {s.answered && <CheckCircle2 size={12} />}
              {s.answered ? '응답함' : '응답하기'}
            </Status>
          </Row>
        ))
      )}
    </Wrap>
  );
};

export default MySurveys;
