import React, { useState } from 'react';
import styled from 'styled-components';
import { ChevronDown, ChevronRight, ArrowRight } from 'lucide-react';

// 진단·발견 사항에서 뽑은 SWOT 요소 후보.
//
// 백지에서 시작하지 않게 하는 장치다. 다만 **자동으로 요소가 되지는 않는다** —
// 진단 레벨이 낮다고 그것이 곧 '약점'인 것은 아니다. 올해 그 축을 안 보기로 한
// 것일 수도 있다. 사람이 고른다.
//
// ⚠️ 이슈의 「진단 격차에서 가져오기」와 **같은 자리·같은 모양**이다. 두 화면이
//    같은 일(후보를 보며 고르기)을 하는데 하나는 옆에 있고 하나는 바닥에 있으면
//    쓰는 사람이 매번 어디 있는지부터 찾는다.

const Wrap = styled.div`
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  background: white;
  overflow: hidden;
`;

const Head = styled.button`
  width: 100%;
  cursor: ${p => (p.$fixed ? 'default' : 'pointer')};
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border: none;
  background: #f8fafc;
  font: inherit;
  text-align: left;
  color: #475569;

  &:hover { background: ${p => (p.$fixed ? '#f8fafc' : '#f1f5f9')}; }
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
  gap: 0.625rem;
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
  line-height: 1.5;
`;

const Detail = styled.div`
  font-size: 0.8125rem;
  color: #64748b;
  line-height: 1.5;
  margin-top: 0.15rem;
`;

const Kind = styled.span`
  flex-shrink: 0;
  margin-top: 0.1rem;
  width: 1.4rem;
  height: 1.4rem;
  border-radius: 0.3rem;
  display: grid;
  place-items: center;
  font-size: 0.75rem;
  font-weight: 800;
  color: white;
  background: ${p => p.$color};
`;

// ⚠️ **여기만 누르는 자리다.** 이슈 쪽은 카드 전체가 「고르기」라 표적을 넓혔지만
//    여기는 누르는 즉시 요소가 생긴다. 카드 전체를 표적으로 두면 목록을 훑다가
//    잘못 눌러 요소가 만들어지고, 그건 되돌리려면 지워야 한다.
const PromoteButton = styled.button`
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
  font-family: inherit;
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

const More = styled.button`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  width: 100%;
  padding: 0.6rem 1rem;
  border: none;
  border-top: 1px solid #f1f5f9;
  background: white;
  color: #64748b;
  font-size: 0.75rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  &:hover { color: #6d28d9; background: #fafafa; }
`;

// 바닥에 붙을 때만 접는다. 길면 그 아래가 안 보인다.
const VISIBLE = 8;

const ElementCandidatePanel = ({ candidates, kinds, onPromote, rail = false }) => {
  // 곁열에서는 늘 펴 둔다. 접는 것은 바닥에 있을 때의 배려지, 옆에 자리를
  // 잡아 두고도 접어 두면 그 자리가 낭비다.
  const [open, setOpen] = useState(rail);
  const [showAll, setShowAll] = useState(false);

  // 곁열은 안에서 스크롤되므로 다 편다. 바닥이면 여덟 건에서 끊는다.
  const shown = (rail || showAll) ? candidates : candidates.slice(0, VISIBLE);
  const rest = candidates.length - shown.length;

  return (
    <Wrap>
      <Head onClick={() => !rail && setOpen(v => !v)} $fixed={rail}>
        {!rail && (open ? <ChevronDown size={16} /> : <ChevronRight size={16} />)}
        <HeadTitle>진단에서 가져오기</HeadTitle>
        {candidates.length > 0 && <Count>{candidates.length}건</Count>}
        <Hint>고르는 것은 사람입니다</Hint>
      </Head>

      {open && (
        <List>
          {candidates.length === 0 ? (
            <Empty>
              가져올 후보가 없습니다. ① 진단에서 <strong>수준</strong>을 매기거나
              {' '}<strong>발견 사항</strong>이 생기면 여기에 강점·약점 후보로 뜹니다.
              기회·위협은 포탈에 없는 정보라 <strong>설문</strong>에서만 옵니다.
            </Empty>
          ) : (
            <>
              {shown.map(c => (
                <Item key={c.key}>
                  <Kind $color={kinds[c.kind].color}>{c.kind}</Kind>
                  <Body>
                    <Title>{c.title}</Title>
                    {c.detail && <Detail>{c.detail}</Detail>}
                  </Body>
                  <PromoteButton
                    onClick={() => onPromote(c)}
                    title={`${kinds[c.kind].label}으로 올립니다`}
                  >
                    <ArrowRight size={13} />
                    {kinds[c.kind].label}으로
                  </PromoteButton>
                </Item>
              ))}
              {rest > 0 && (
                <More onClick={() => setShowAll(true)}>
                  <ChevronDown size={13} /> 나머지 {rest}건 더 보기
                </More>
              )}
            </>
          )}
        </List>
      )}
    </Wrap>
  );
};

export default ElementCandidatePanel;
