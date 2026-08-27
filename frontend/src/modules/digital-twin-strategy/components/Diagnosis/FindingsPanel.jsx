import React, { useState } from 'react';
import styled from 'styled-components';
import { ArrowDown, ChevronDown, ChevronRight } from 'lucide-react';

// 시스템이 짚은 것. 결론이 아니라 눈에 띄는 사실이다.
// 왜 그런지는 사람이 답하고, 무엇이 핵심 난제인지도 사람이 고른다.

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
`;

const Item = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.7rem 0.9rem;
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

// 어디서 나온 사실인가. 지표에서 계산된 것과 사람에게 물어 나온 것은 **무게가
// 다르다** — 설문은 응답자 수만큼의 의견이고 지표는 데이터다. 목록에서 섞여
// 있으면 그 차이가 안 보이고, "이건 어디서 나온 말이지"를 매번 되묻게 된다.
const Source = styled.span`
  flex-shrink: 0;
  padding: 0.15rem 0.45rem;
  border-radius: 0.25rem;
  font-size: 0.6875rem;
  font-weight: 700;
  background: ${p => (p.$survey ? '#f5f3ff' : p.$intel ? '#f0fdfa' : '#f1f5f9')};
  color: ${p => (p.$survey ? '#6d28d9' : p.$intel ? '#0f766e' : '#64748b')};
`;

// 어디서 나왔나 — key 접두어가 말한다(survey_link.py · intel_link.py).
const SOURCE = {
  survey: { label: '설문', title: '설문 응답에서 나온 사실입니다. 응답자 수만큼의 의견입니다.' },
  intel: { label: '기술', title: '기술 레이더의 사업부 기록에서 나온 사실입니다.' },
  metric: { label: '지표', title: '포탈 데이터에서 계산된 사실입니다.' },
};
const sourceOf = (f) => (String(f.key).startsWith('survey_') ? 'survey'
  : String(f.key).startsWith('intel_') ? 'intel' : 'metric');

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

// 같은 규칙에서 나온 것끼리 묶는다.
//
// ⚠️ 한 사이클을 돌려 보니 서른다섯 줄 중 다섯 줄이 **사업부만 다르고 문장이
//    거의 같았다.** 그러면 목록을 훑는 눈이 미끄러진다.
//
// ⚠️ **기본은 펼침이다.** 접어 두면 안 읽는다 — 이 목록은 사람이 읽으라고
//    있는 것이지 정리해 두라고 있는 것이 아니다. 접는 것은 이미 본 것을
//    치우는 용도다. 한 건짜리는 묶지 않는다(머리글이 줄을 반복할 뿐이다).
const GroupHead = styled.button`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  width: 100%;
  padding: 0.45rem 1rem;
  border: none;
  border-top: 1px solid #f1f5f9;
  background: #f8fafc;
  color: #475569;
  font-size: 0.75rem;
  font-weight: 700;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  &:hover { background: #f1f5f9; }
`;

const GroupCount = styled.span`
  margin-left: auto;
  font-weight: 700;
  color: #7c3aed;
`;

const FindingsPanel = ({ findings, onPromote }) => {
  // 접은 묶음. 기본은 전부 펼침이다.
  const [folded, setFolded] = useState({});
  const fold = (rule) => setFolded(f => ({ ...f, [rule]: !f[rule] }));
  if (!findings?.length) {
    return (
      <Empty>
        기준을 넘은 값이 없습니다. 너무 안 잡힌다 싶으면 ⚙설정에서 기준을
        조이세요 — 예를 들어 'KPI 미연결 비율 30%'를 20%로 낮추면 더 잡힙니다.
      </Empty>
    );
  }

  // 규칙별로 묶되 **순서는 유지한다.** 서버가 심각도 순으로 정렬해 뒀는데
  // 여기서 다시 흐트러뜨리면 위에 있어야 할 것이 아래로 간다.
  const groups = [];
  const index = {};
  for (const f of findings) {
    const rule = f.rule || f.key;
    if (index[rule] === undefined) {
      index[rule] = groups.length;
      groups.push({ rule, label: f.ruleLabel || rule, rows: [] });
    }
    groups[index[rule]].rows.push(f);
  }

  const row = (f, i) => (
        <Item key={`${f.key}-${f.division_id ?? 'all'}-${i}`} $accent={ACCENT[f.severity]}>
          <Badge $accent={ACCENT[f.severity]}>{LABEL[f.severity]}</Badge>
          <Source $survey={sourceOf(f) === 'survey'}
                  $intel={sourceOf(f) === 'intel'}
                  title={SOURCE[sourceOf(f)].title}>
            {SOURCE[sourceOf(f)].label}
          </Source>
          <Body>
            <Title>{f.title}</Title>
            <Detail>{f.detail}</Detail>
          </Body>
          {/* 안 넘겨받았으면 조회 전용이다. */}
          {onPromote && (
          <PromoteButton
            onClick={() => onPromote(f)}
            title="이것을 올해의 핵심 난제 후보로 올립니다"
          >
            <ArrowDown size={14} />
            핵심 난제로
          </PromoteButton>
          )}
        </Item>
  );

  return (
    <List>
      {groups.map(g => (g.rows.length < 2 ? g.rows.map(row) : (
        <React.Fragment key={g.rule}>
          <GroupHead onClick={() => fold(g.rule)}>
            {folded[g.rule] ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            {g.label}
            <GroupCount>{g.rows.length}건</GroupCount>
          </GroupHead>
          {!folded[g.rule] && g.rows.map(row)}
        </React.Fragment>
      )))}
    </List>
  );
};

export default FindingsPanel;
