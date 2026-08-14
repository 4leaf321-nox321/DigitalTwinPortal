import React from 'react';
import styled from 'styled-components';
import { ArrowUpRight } from 'lucide-react';

// 시스템이 짚은 것. 결론이 아니라 눈에 띄는 사실이다.
// 왜 그런지는 사람이 답하고, 무엇이 핵심 난제인지도 사람이 고른다.

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Item = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.875rem;
  padding: 0.875rem 1.125rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-left: 3px solid ${p => p.$accent};
  border-radius: 0.5rem;
`;

const Body = styled.div`
  flex: 1;
  min-width: 0;
`;

const Title = styled.div`
  font-size: 0.9375rem;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 0.2rem;
`;

const Detail = styled.div`
  font-size: 0.8125rem;
  color: #64748b;
  line-height: 1.5;
`;

const Badge = styled.span`
  flex-shrink: 0;
  padding: 0.15rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.6875rem;
  font-weight: 700;
  color: white;
  background: ${p => p.$accent};
`;

const PromoteButton = styled.button`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.4rem 0.7rem;
  border: 1px solid #ddd6fe;
  border-radius: 0.375rem;
  background: #f5f3ff;
  color: #6d28d9;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;

  &:hover { background: #ede9fe; border-color: #c4b5fd; }
`;

const Empty = styled.div`
  padding: 2rem 1.25rem;
  text-align: center;
  color: #94a3b8;
  background: white;
  border: 1px dashed #cbd5e1;
  border-radius: 0.5rem;
  font-size: 0.875rem;
`;

const ACCENT = { high: '#dc2626', medium: '#f59e0b', info: '#64748b' };
const LABEL = { high: '높음', medium: '보통', info: '참고' };

const FindingsPanel = ({ findings, onPromote }) => {
  if (!findings?.length) {
    return <Empty>짚인 것이 없습니다. 관측값이 임계값을 넘지 않았거나 근거가 부족합니다.</Empty>;
  }

  return (
    <List>
      {findings.map((f, i) => (
        <Item key={`${f.key}-${f.division_id ?? 'all'}-${i}`} $accent={ACCENT[f.severity]}>
          <Badge $accent={ACCENT[f.severity]}>{LABEL[f.severity]}</Badge>
          <Body>
            <Title>{f.title}</Title>
            <Detail>{f.detail}</Detail>
          </Body>
          <PromoteButton
            onClick={() => onPromote(f)}
            title="이것을 올해의 핵심 난제 후보로 올립니다"
          >
            <ArrowUpRight size={14} />
            핵심 난제로
          </PromoteButton>
        </Item>
      ))}
    </List>
  );
};

export default FindingsPanel;
