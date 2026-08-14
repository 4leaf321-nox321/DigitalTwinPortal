import React, { useState } from 'react';
import styled from 'styled-components';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';

// 진단 격차에서 뽑은 이슈 후보.
//
// 백지에서 시작하지 않게 하는 장치다. 다만 **자동으로 이슈가 되지는 않는다** —
// 격차가 곧 이슈는 아니기 때문이다. 목표를 높게 잡아서 생긴 격차일 수도 있고,
// 그건 이슈가 아니라 목표를 고칠 일이다. 사람이 고른다.

const Wrap = styled.div`
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  background: white;
  overflow: hidden;
`;

const Head = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border: none;
  background: #f8fafc;
  cursor: pointer;
  font: inherit;
  text-align: left;
  color: #475569;

  &:hover { background: #f1f5f9; }
`;

const HeadTitle = styled.span`
  font-size: 0.875rem;
  font-weight: 600;
  color: #334155;
`;

const Count = styled.span`
  font-size: 0.8125rem;
  font-weight: 700;
  color: #7c3aed;
`;

const Hint = styled.span`
  font-size: 0.8125rem;
  color: #94a3b8;
  margin-left: auto;
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
`;

const Item = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.875rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid #f1f5f9;

  &:hover { background: #fafafa; }
`;

const Body = styled.div`
  flex: 1;
  min-width: 0;
`;

const Title = styled.div`
  font-size: 0.875rem;
  font-weight: 600;
  color: #1e293b;
`;

const Detail = styled.div`
  font-size: 0.8125rem;
  color: #64748b;
  line-height: 1.5;
  margin-top: 0.15rem;
`;

const Group = styled.span`
  display: inline-block;
  padding: 0.1rem 0.45rem;
  margin-right: 0.4rem;
  border-radius: 0.25rem;
  font-size: 0.6875rem;
  font-weight: 600;
  background: #eef2ff;
  color: #4f46e5;
`;

const AddButton = styled.button`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.35rem 0.65rem;
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
  padding: 1.25rem 1rem;
  border-top: 1px solid #f1f5f9;
  color: #94a3b8;
  font-size: 0.8125rem;
  line-height: 1.6;
`;

const CandidatePanel = ({ candidates, onPick }) => {
  const [open, setOpen] = useState(false);

  return (
    <Wrap>
      <Head onClick={() => setOpen(v => !v)}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <HeadTitle>진단 격차에서 가져오기</HeadTitle>
        {candidates.length > 0 && <Count>{candidates.length}건</Count>}
        <Hint>목표를 정한 항목 중 차이가 큰 것</Hint>
      </Head>

      {open && (
        <List>
          {candidates.length === 0 ? (
            <Empty>
              가져올 격차가 없습니다. 진단에서 <strong>목표 수준</strong>이나
              {' '}<strong>지표 목표값</strong>을 정하면 현재와의 차이가 여기에 후보로 뜹니다.
              목표를 안 정하면 격차를 말할 수 없습니다.
            </Empty>
          ) : (
            candidates.map(c => (
              <Item key={c.key}>
                <Body>
                  <Title><Group>{c.group}</Group>{c.title}</Title>
                  <Detail>{c.detail}</Detail>
                </Body>
                <AddButton onClick={() => onPick(c)} title="이 격차를 이슈로 만듭니다">
                  <Plus size={13} />
                  이슈로
                </AddButton>
              </Item>
            ))
          )}
        </List>
      )}
    </Wrap>
  );
};

export default CandidatePanel;
