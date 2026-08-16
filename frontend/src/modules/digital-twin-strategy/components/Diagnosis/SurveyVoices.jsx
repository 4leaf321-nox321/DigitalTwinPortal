import React, { useState } from 'react';
import styled from 'styled-components';
import { MessageSquare, Loader2, ArrowUpRight, Info } from 'lucide-react';

// 설문 서술형을 AI 가 묶어 읽은 것. (LINK_PLAN 6-1)
//
// ⚠️ **「짚인 것」과 자리를 가른다.** 그쪽은 규칙이 **센** 것이고 이것은 AI 가
//    **읽은** 것이다. 한 목록에 섞으면 지어낸 문장이 세어진 사실과 똑같은
//    모양으로 앉는다. 그래서 색도 아이콘도 다르게 두고, 「AI 가 묶었다」고 적는다.
//
// ⚠️ **인용문을 항상 같이 보여준다.** 요약만 남기면 근거를 되짚을 수 없고,
//    그러면 이 묶음이 맞는지 아무도 확인하지 못한다. 서버가 원문에 없는 인용을
//    이미 버리지만, 화면에서 원문을 보여주는 것이 마지막 안전장치다.
//
// ⚠️ **누를 때만 부른다.** 화면을 열 때마다 LLM 을 부르면 느려지고 돈이 든다.

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const Button = styled.button`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  align-self: flex-start;
  padding: 0.45rem 0.8rem;
  border: 1px solid #c7d2fe;
  border-radius: 0.375rem;
  background: #eef2ff;
  color: #4338ca;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  &:hover:not(:disabled) { background: #e0e7ff; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const Theme = styled.div`
  padding: 0.75rem 0.875rem;
  background: white;
  border: 1px solid #c7d2fe;
  border-left: 3px solid #6366f1;
  border-radius: 0.5rem;
`;

const Head = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
`;

const Title = styled.div`
  flex: 1;
  font-size: 0.9375rem;
  font-weight: 700;
  color: #1e293b;
`;

const Summary = styled.div`
  margin-top: 0.3rem;
  font-size: 0.8125rem;
  color: #475569;
  line-height: 1.65;
`;

const Quotes = styled.ul`
  margin: 0.5rem 0 0;
  padding-left: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
`;

const Quote = styled.li`
  padding: 0.35rem 0.6rem;
  background: #f8fafc;
  border-left: 2px solid #cbd5e1;
  border-radius: 0 0.25rem 0.25rem 0;
  font-size: 0.8125rem;
  color: #334155;
  line-height: 1.6;
`;

const Promote = styled.button`
  display: flex;
  align-items: center;
  gap: 0.2rem;
  flex-shrink: 0;
  padding: 0.25rem 0.5rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.3rem;
  background: white;
  color: #475569;
  font-size: 0.75rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  &:hover { border-color: #6366f1; color: #4338ca; }
`;

const Note = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  padding: 0.6rem 0.75rem;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 0.5rem;
  color: #64748b;
  font-size: 0.8125rem;
  line-height: 1.6;
`;

const SurveyVoices = ({ available, onLoad, onPromote }) => {
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState(null);

  if (!available) {
    return (
      <Note>
        <Info size={15} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
        <span>
          LLM 서버가 설정되지 않아 서술형을 묶어 읽을 수 없습니다. 원문은{' '}
          <strong>설문 모듈의 집계 화면</strong>에서 그대로 보실 수 있습니다.
        </span>
      </Note>
    );
  }

  const load = async () => {
    setBusy(true);
    try {
      setData(await onLoad());
    } finally {
      setBusy(false);
    }
  };

  return (
    <Wrap>
      <Button onClick={load} disabled={busy}>
        {busy ? <Loader2 size={14} /> : <MessageSquare size={14} />}
        {busy ? '읽는 중…' : data ? '다시 묶어 읽기' : '서술형 묶어 읽기'}
      </Button>

      {data?.reason && (
        <Note>
          <Info size={15} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
          <span>{data.reason}</span>
        </Note>
      )}

      {(data?.themes || []).map((theme, i) => (
        <Theme key={i}>
          <Head>
            <Title>{theme.title}</Title>
            {/* 난제로 올릴 때 **인용을 근거로 같이 싣는다.** 요약만 올리면
                나중에 "왜 이게 난제지?" 에 답할 수 없다. */}
            <Promote
              onClick={() => onPromote({
                title: theme.title,
                rationale: [theme.summary, ...(theme.quotes || []).map(q => `· "${q}"`)]
                  .filter(Boolean).join('\n'),
                source_finding: 'survey_voice',
              })}
              title="이것을 올해의 핵심 난제 후보로 올립니다"
            >
              <ArrowUpRight size={13} /> 핵심 난제로
            </Promote>
          </Head>
          <Summary>{theme.summary}</Summary>
          <Quotes>
            {(theme.quotes || []).map((quote, n) => (
              <Quote key={n}>&ldquo;{quote}&rdquo;</Quote>
            ))}
          </Quotes>
        </Theme>
      ))}

      {data && (data.themes || []).length > 0 && (
        <Note>
          <Info size={15} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
          <span>
            <strong>AI 가 묶어 읽은 것입니다.</strong> 위 「짚인 것」이 규칙으로{' '}
            <strong>센</strong> 사실인 것과 달리 이것은 <strong>읽은</strong> 것이라,
            같은 무게로 두면 안 됩니다. 인용문이 근거이니 반드시 함께 보세요 —
            원문에 없는 인용은 서버가 걸러냈습니다
            {data.dropped_quotes > 0 && ` (${data.dropped_quotes}건 버림)`}.
            서술형 {data.answer_count}건을 읽었습니다.
          </span>
        </Note>
      )}
    </Wrap>
  );
};

export default SurveyVoices;
