import React from 'react';
import styled from 'styled-components';

// 진단이 어떻게 흘러가는지. (화면 오른쪽에 붙박이)
//
// 화면에 패널이 여섯 개인데 **서로 어떻게 이어지는지가 안 보였다.** "반영을
// 누르면 무엇이 바뀌나", "발견 사항은 어디서 나오나", "핵심 난제는 발견
// 사항에서만 오나" 를 매번 되물어야 했다. 문서로 답하면 그 문서를 아무도 안
// 편다 — 화면이 스스로 말해야 한다.
//
// ⚠️ **목차와 역할이 다르다.** 목차는 "지금 어디인가 · 거기로 가자" 이고
//    이것은 "무엇이 어디로 가는가" 다. 그래서 현재 위치를 여기서는 안 밝힌다 —
//    양쪽에서 동시에 강조하면 눈이 둘로 갈린다.
//
// ⚠️ 화면에 **없는 것은 안 그린다.** 설문이 없는 해에 설문 상자를 그려 두면,
//    그 화살표가 안 도는 이유를 찾느라 시간이 간다.

const Aside = styled.aside`
  display: none;

  /* 목차(왼쪽)보다 **늦게** 나타난다. 둘 다 띄우면 본문이 좁아지는데, 표가
     찌그러지는 것보다는 순서도를 안 보여주는 편이 낫다. */
  @media (min-width: 1536px) {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    position: sticky;
    top: 0;
    align-self: flex-start;
    flex-shrink: 0;
    width: 13rem;
    padding-left: 0.875rem;
    border-left: 1px solid #e2e8f0;
  }
`;

const Label = styled.div`
  padding: 0 0.25rem 0.4rem;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #94a3b8;
`;

const GroupLabel = styled.div`
  padding: 0.35rem 0.25rem 0.1rem;
  font-size: 0.625rem;
  font-weight: 700;
  color: #94a3b8;
`;

const Node = styled.button`
  display: block;
  width: 100%;
  padding: 0.3rem 0.5rem;
  border: 1px solid ${p => (p.$out ? '#ddd6fe' : '#e2e8f0')};
  border-radius: 0.375rem;
  background: ${p => (p.$out ? '#f5f3ff' : 'white')};
  color: ${p => (p.$out ? '#5b21b6' : '#334155')};
  font-size: 0.75rem;
  font-weight: ${p => (p.$out ? 700 : 500)};
  font-family: inherit;
  text-align: left;
  cursor: pointer;

  &:hover { border-color: #a78bfa; color: #5b21b6; }
`;

// 세로 연결선. 화살표 글자를 쓰지 않는 이유는, 글자는 줄높이에 따라 위아래로
// 흔들려서 상자와 안 맞기 때문이다.
const Link = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.15rem 0 0.15rem 0.9rem;
  min-height: 1.1rem;

  &::before {
    content: '';
    width: 1px;
    align-self: stretch;
    background: #cbd5e1;
  }
`;

const LinkNote = styled.span`
  font-size: 0.625rem;
  color: #94a3b8;
  line-height: 1.4;
`;

// 곁가지 — 본줄기로 들어오거나 빠져나가는 것.
const Branch = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.3rem;
  padding: 0.1rem 0.25rem 0.1rem 0.6rem;
  font-size: 0.6875rem;
  color: #64748b;
  line-height: 1.45;
`;

const Arrow = styled.span`
  flex-shrink: 0;
  color: #cbd5e1;
`;

// 이 화면 밖으로 나가는 칸(② 이슈). **안 눌린다** — 눌러도 아무 일이 없으면
// 고장으로 보이고, 여기서 단계를 바꿔 버리면 보던 자리를 잃는다.
const Exit = styled.div`
  padding: 0.3rem 0.5rem;
  border: 1px dashed #cbd5e1;
  border-radius: 0.375rem;
  background: #f8fafc;
  color: #64748b;
  font-size: 0.75rem;
  font-weight: 700;
`;

// 본줄기에서 비켜난 칸(세부 판단). 들여써서 곁가지임을 보인다.
const Side = styled(Node)`
  width: calc(100% - 0.9rem);
  margin-left: 0.9rem;
`;

const FlowMap = ({ hasSurvey, hasVoices, onJump }) => {
  const go = (id) => () => {
    document.getElementById(id)?.scrollIntoView({
      behavior: 'smooth', block: 'start',
    });
    onJump?.(id);
  };

  return (
    <Aside aria-label="진단 흐름">
      <Label>흐름</Label>

      <GroupLabel>근거</GroupLabel>
      <Node onClick={go('sec-observed')}>관측</Node>
      <Node onClick={go('sec-kpi')}>지표별 연결</Node>
      {hasSurvey && <Node onClick={go('sec-survey')}>설문 근거</Node>}

      {/* 설문 근거만 본줄기를 벗어난다 — 발견 사항이 아니라 진단값으로 간다.
          이 갈림이 화면에서 제일 안 보이던 것이다. */}
      {hasSurvey && (
        <Branch>
          <Arrow>└▸</Arrow>
          <span><strong>반영</strong>하면 조직 역량 칸으로</span>
        </Branch>
      )}
      {hasSurvey && <Side onClick={go('sec-grid')}>세부 판단</Side>}

      <Link><LinkNote>⚙기준을 넘은 것만</LinkNote></Link>

      <Node onClick={go('sec-findings')}>발견 사항</Node>

      <Link><LinkNote>사람이 골라 올림</LinkNote></Link>

      <Node $out onClick={go('sec-cruxes')}>핵심 난제</Node>

      {hasVoices && (
        <Branch>
          <Arrow>◂┘</Arrow>
          <span><strong>설문 이야기</strong>(AI)에서도 바로</span>
        </Branch>
      )}
      <Branch>
        <Arrow>◂┘</Arrow>
        <span>직접 적어서도</span>
      </Branch>

      <Link />

      <Exit>② 이슈 (다음 단계)</Exit>

      <Branch>
        <Arrow>◂┘</Arrow>
        <span><strong>세부 판단</strong>의 목표−현재 격차에서도</span>
      </Branch>
    </Aside>
  );
};

export default FlowMap;
