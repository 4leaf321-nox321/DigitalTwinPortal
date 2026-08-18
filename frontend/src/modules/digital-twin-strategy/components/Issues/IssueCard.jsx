import React from 'react';
import styled from 'styled-components';
import { Pencil, Trash2, RotateCcw, MinusCircle } from 'lucide-react';

// 이슈 한 줄. 읽을 때는 조용하고, 손댈 때만 버튼이 드러난다.

// 방금 만든 이슈를 잠깐 밝힌다. 저장하면 그것이 **다른 곳에** 들어가므로
// (후보에서 만들면 난제 블록 안으로), 어디로 갔는지 눈으로 못 찾으면 사람은
// 같은 것을 또 만든다.
const Card = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.875rem;
  padding: 0.75rem 1rem;
  background: ${p => (p.$flash ? '#f5f3ff' : 'white')};
  border: 1px solid ${p => (p.$flash ? '#a78bfa' : '#e2e8f0')};
  border-radius: 0.5rem;
  opacity: ${p => (p.$dropped ? 0.55 : 1)};
  transition: background 0.4s ease, border-color 0.4s ease;

  &:hover .issue-actions { opacity: 1; }
`;

const Body = styled.div`
  flex: 1;
  min-width: 0;
`;

const Title = styled.div`
  font-size: 0.9375rem;
  font-weight: 600;
  color: #1e293b;
  text-decoration: ${p => (p.$dropped ? 'line-through' : 'none')};
`;

const Detail = styled.div`
  font-size: 0.8125rem;
  color: #64748b;
  line-height: 1.5;
  margin-top: 0.2rem;
`;

const Cause = styled.div`
  font-size: 0.8125rem;
  color: #7c3aed;
  line-height: 1.5;
  margin-top: 0.35rem;

  &::before {
    content: '왜 안 풀렸나 · ';
    font-weight: 700;
    color: #a78bfa;
  }
`;

const Tags = styled.div`
  display: flex;
  gap: 0.375rem;
  margin-top: 0.45rem;
  flex-wrap: wrap;
`;

const Tag = styled.span`
  padding: 0.1rem 0.45rem;
  border-radius: 0.25rem;
  font-size: 0.6875rem;
  font-weight: 600;
  background: ${p => p.$bg || '#f1f5f9'};
  color: ${p => p.$fg || '#64748b'};
`;

const Actions = styled.div`
  display: flex;
  gap: 0.125rem;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s ease;
`;

const IconButton = styled.button`
  padding: 0.3rem;
  border: none;
  border-radius: 0.3rem;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  display: flex;

  &:hover { background: #f1f5f9; color: ${p => p.$danger ? '#dc2626' : '#475569'}; }
`;

// 어디서 온 이슈인지. 화면에 쓰는 말은 설명 없이 읽혀야 한다 —
// '난제 분해' 같은 말은 이 모듈의 내부 용어지 사용자의 말이 아니다.
const SOURCE_LABEL = {
  gap: '진단 격차',
  metric: '지표 미달',
  crux: '난제에서',
  manual: '직접 입력',
};

const IssueCard = ({ issue, divisionName, flash,
                     onEdit, onToggleDrop, onDelete }) => {
  const dropped = issue.status === 'dropped';
  const scored = issue.impact !== null && issue.feasibility !== null;

  return (
    // id 로 찾아간다 — 저장 뒤 그 자리로 데려가려면 자리에 이름이 있어야 한다.
    <Card id={`issue-${issue.id}`} $dropped={dropped} $flash={flash}>
      <Body>
        <Title $dropped={dropped}>{issue.title}</Title>
        {issue.description && <Detail>{issue.description}</Detail>}
        {issue.root_cause && <Cause>{issue.root_cause}</Cause>}

        <Tags>
          {divisionName && <Tag>{divisionName}</Tag>}
          {issue.source_type !== 'manual' && (
            <Tag $bg="#eef2ff" $fg="#4f46e5">{SOURCE_LABEL[issue.source_type]}</Tag>
          )}
          {scored ? (
            <Tag $bg="#f5f3ff" $fg="#6d28d9">
              영향 {issue.impact} × 실행 {issue.feasibility} = {issue.priority_score}
            </Tag>
          ) : (
            <Tag>우선순위 미평가</Tag>
          )}
          {dropped && <Tag $bg="#fef2f2" $fg="#b91c1c">올해는 안 함</Tag>}
        </Tags>
      </Body>

      {/* ⚠️ 카드가 선택 영역 안에 있을 수 있다(고아 이슈 묶기). 그때 이 버튼들이
          클릭을 위로 흘리면, 「수정」을 눌렀는데 선택까지 같이 뒤집힌다. */}
      {/* 손댈 곳을 안 넘겨받았으면 조회 전용이다 — 단추를 아예 안 그린다. */}
      {onEdit && (
      <Actions className="issue-actions" onClick={e => e.stopPropagation()}>
        <IconButton onClick={() => onEdit(issue)} title="수정">
          <Pencil size={15} />
        </IconButton>
        <IconButton
          onClick={() => onToggleDrop(issue)}
          title={dropped ? '다시 다룬다' : '올해는 안 한다 (기록은 남습니다)'}
        >
          {dropped ? <RotateCcw size={15} /> : <MinusCircle size={15} />}
        </IconButton>
        <IconButton $danger onClick={() => onDelete(issue)} title="삭제">
          <Trash2 size={15} />
        </IconButton>
      </Actions>
      )}
    </Card>
  );
};

export default IssueCard;
