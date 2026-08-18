/**
 * 관측값 하나를 풀어 보여준다 — 셈법, 분자·분모, 그리고 **그 수를 만든 과제들.**
 *
 * ⚠️ 숫자만 보여주는 진단은 읽고 끝난다. 「KPI 미연결 62.5%」에서 사람이 다음
 *    행동으로 가려면 그 62.5% 가 어느 과제인지 알아야 한다.
 *
 * ⚠️ **세는 단위가 과제가 아닌 지표가 있다.** 연결 등급 둘은 과제가 아니라
 *    연결을 센다. 그래서 분모 이름을 그대로 적는다 — 「12건 중 5건」을 과제 수로
 *    읽으면 목록 길이와 안 맞아 보인다.
 */
import React from 'react';
import styled from 'styled-components';
import { X, Loader2 } from 'lucide-react';

const Dim = styled.div`
  position: fixed; inset: 0; z-index: 1200;
  background: rgba(15, 23, 42, 0.45);
  display: flex; align-items: center; justify-content: center;
  padding: 1.5rem;
`;

const Box = styled.div`
  background: white; border-radius: 0.75rem;
  width: min(760px, 100%); max-height: 86vh;
  display: flex; flex-direction: column;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);
`;

const Head = styled.div`
  padding: 1rem 1.25rem; border-bottom: 1px solid #e2e8f0;
  display: flex; align-items: flex-start; gap: 0.75rem;
`;

const Title = styled.div`
  font-size: 1rem; font-weight: 700; color: #0f172a;
  display: flex; align-items: baseline; gap: 0.5rem;
`;

const Scope = styled.span`
  font-size: 0.75rem; font-weight: 600; color: #7c3aed;
  background: #f5f3ff; border-radius: 999px; padding: 0.1rem 0.5rem;
`;

const Sub = styled.div`
  margin-top: 0.3rem; font-size: 0.78rem; color: #64748b; line-height: 1.5;
`;

const Close = styled.button`
  margin-left: auto; border: none; background: transparent; cursor: pointer;
  color: #94a3b8; padding: 0.2rem; &:hover { color: #475569; }
`;

const Body = styled.div`overflow-y: auto; padding: 1rem 1.25rem 1.25rem;`;

const Formula = styled.div`
  background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.5rem;
  padding: 0.7rem 0.85rem; font-size: 0.8rem; color: #334155; line-height: 1.6;
  strong { color: #0f172a; }
`;

const Frac = styled.div`
  margin-top: 0.6rem; display: flex; align-items: center; gap: 0.6rem;
  font-size: 0.82rem; color: #334155; flex-wrap: wrap;
`;

const Part = styled.span`
  b { color: #0f172a; font-size: 0.95rem; }
  span { color: #64748b; font-size: 0.75rem; margin-left: 0.25rem; }
`;

const SectionTitle = styled.div`
  margin: 1.1rem 0 0.5rem; font-size: 0.82rem; font-weight: 700; color: #0f172a;
  display: flex; align-items: baseline; gap: 0.4rem;
  small { font-weight: 500; color: #94a3b8; }
`;

const Bars = styled.div`display: flex; flex-direction: column; gap: 0.3rem;`;

const Bar = styled.div`
  display: grid; grid-template-columns: 8.5rem 1fr 4.5rem; gap: 0.5rem;
  align-items: center; font-size: 0.78rem; color: #475569;
`;

const Track = styled.div`
  height: 0.5rem; background: #f1f5f9; border-radius: 999px; overflow: hidden;
`;

const Fill = styled.div`
  height: 100%; width: ${p => p.$pct}%; background: #7c3aed; border-radius: 999px;
`;

const Rows = styled.div`
  border: 1px solid #e2e8f0; border-radius: 0.5rem; overflow: hidden;
`;

const Row = styled.div`
  padding: 0.5rem 0.75rem; font-size: 0.8rem; color: #334155;
  border-bottom: 1px solid #f1f5f9;
  &:last-child { border-bottom: none; }
`;

const Meta = styled.div`
  margin-top: 0.15rem; font-size: 0.72rem; color: #94a3b8;
  display: flex; gap: 0.5rem; flex-wrap: wrap;
`;

const Empty = styled.div`
  padding: 0.9rem; text-align: center; font-size: 0.78rem; color: #94a3b8;
  border: 1px dashed #cbd5e1; border-radius: 0.5rem;
`;

const Center = styled.div`
  padding: 2.5rem; text-align: center; color: #94a3b8;
  svg { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

const MetricDetail = ({ data, loading, error, onClose }) => (
  <Dim onClick={onClose}>
    <Box onClick={e => e.stopPropagation()}>
      <Head>
        <div>
          <Title>
            {data?.label || '관측값'}
            {data?.scope && <Scope>{data.scope}</Scope>}
          </Title>
          {data?.detail && <Sub>{data.detail}</Sub>}
        </div>
        <Close onClick={onClose} title="닫기"><X size={18} /></Close>
      </Head>

      <Body>
        {loading && <Center><Loader2 size={22} /></Center>}
        {error && <Empty>{error}</Empty>}

        {!loading && !error && data && (
          <>
            <Formula>{data.formula}</Formula>

            {(data.numerator || data.denominator) && (
              <Frac>
                {data.numerator && (
                  <Part>
                    <b>{data.numerator.count}</b>
                    <span>{data.numerator.label}</span>
                  </Part>
                )}
                {data.denominator && <span style={{ color: '#cbd5e1' }}>÷</span>}
                {data.denominator && (
                  <Part>
                    <b>{data.denominator.count}</b>
                    <span>{data.denominator.label}</span>
                  </Part>
                )}
              </Frac>
            )}

            {data.isCompany && (
              <Sub>
                <strong>전사 합계입니다.</strong> 사업부를 고르면 그 조직만 봅니다.
              </Sub>
            )}

            {data.breakdown?.length > 0 && (
              <>
                <SectionTitle>내역</SectionTitle>
                <Bars>
                  {data.breakdown.map(b => (
                    <Bar key={b.name}>
                      <span title={b.name}>{b.name}</span>
                      <Track><Fill $pct={b.share ?? 0} /></Track>
                      <span>{b.count}건{b.share != null && ` · ${b.share}%`}</span>
                    </Bar>
                  ))}
                </Bars>
              </>
            )}

            <SectionTitle>
              해당 과제
              <small>{data.projects?.length || 0}건</small>
            </SectionTitle>
            {data.projects?.length > 0 ? (
              <Rows>
                {data.projects.map(p => (
                  <Row key={p.uuid || p.title}>
                    {p.title}
                    <Meta>
                      {p.division && <span>{p.division}</span>}
                      {p.process && <span>· {p.process}</span>}
                      {p.pl && <span>· PL {p.pl}</span>}
                      {p.depts?.length > 0 && <span>· {p.depts.join(', ')}</span>}
                      {p.status && <span>· {p.status}</span>}
                      {p.why && <span>· {p.why}</span>}
                    </Meta>
                  </Row>
                ))}
              </Rows>
            ) : (
              /* 0건도 답이다 — 「없다」와 「못 불러왔다」를 가른다. */
              <Empty>이 값에 해당하는 과제가 없습니다.</Empty>
            )}
          </>
        )}
      </Body>
    </Box>
  </Dim>
);

export default MetricDetail;
