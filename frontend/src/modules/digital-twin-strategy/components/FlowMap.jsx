import React, { useEffect, useState } from 'react';
import styled from 'styled-components';

// 진단이 어떻게 흘러가는지. (화면 오른쪽에 붙박이)
//
// 화면에 패널이 여섯 개인데 **서로 어떻게 이어지는지가 안 보였다.** "반영을
// 누르면 무엇이 바뀌나", "발견 사항은 어디서 나오나", "핵심 난제는 발견
// 사항에서만 오나" 를 매번 되물어야 했다. 문서로 답하면 그 문서를 아무도 안
// 편다 — 화면이 스스로 말해야 한다.
//
// 한동안 목차를 따로 왼쪽에 두었는데, 이름이 겹쳐 두 벌이 나란히 있는 꼴이라
// 목차를 걷어내고 **이것 하나로 합쳤다.** 그래서 길잡이 노릇도 여기서 한다 —
// 지금 보고 있는 칸을 밝히고, 누르면 그리로 간다.
//
// ⚠️ 화면에 **없는 것은 안 그린다.** 설문이 없는 해에 설문 상자를 그려 두면,
//    그 화살표가 안 도는 이유를 찾느라 시간이 간다.

const Aside = styled.aside`
  display: none;

  /* 좁은 화면에서는 **아예 감춘다.** 본문을 밀어내면 관측 표가 찌그러진다.
     길잡이는 편의지 필수가 아니다. */
  @media (min-width: 1280px) {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    position: sticky;
    top: 0;
    align-self: flex-start;
    flex-shrink: 0;
    width: 13rem;
    padding-right: 0.875rem;
    border-right: 1px solid #e2e8f0;
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
  border: 1px solid ${p => (p.$active ? '#7c3aed' : p.$out ? '#ddd6fe' : '#e2e8f0')};
  border-radius: 0.375rem;
  background: ${p => (p.$active || p.$out ? '#f5f3ff' : 'white')};
  color: ${p => (p.$active || p.$out ? '#5b21b6' : '#334155')};
  font-size: 0.75rem;
  font-weight: ${p => (p.$active || p.$out ? 700 : 500)};
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

/**
 * items: 위에서 아래로 그릴 것들. 화면마다 흐름이 다르므로 **밖에서 준다** —
 *        여기에 진단 흐름을 박아 두면 이슈 화면은 이 컴포넌트를 못 쓴다.
 *
 *   {kind:'group',  label}            묶음 제목
 *   {kind:'node',   id, label, out}   상자. id 로 그 자리로 간다. out 이면 산출물
 *   {kind:'side',   id, label}        본줄기에서 비켜난 상자 (들여씀)
 *   {kind:'link',   note}             세로 연결선. note 는 그 위에 붙는 말
 *   {kind:'branch', text}             곁가지 한 줄
 *   {kind:'exit',   label}            이 화면 밖으로 나가는 칸. **안 눌린다**
 */
const FlowMap = ({ items, onJump }) => {
  const [active, setActive] = useState(null);

  const ids = items.filter(i => i.id).map(i => i.id).join(',');

  // 지금 보고 있는 칸을 밝힌다. 목차가 하던 일이다.
  //
  // ⚠️ root 를 안 줘도 된다 — IntersectionObserver 는 중간 스크롤 영역
  //    (MainContent)의 잘림까지 계산한다. 아래 70% 를 빼서 **위쪽 섹션**이
  //    잡히게 한다. 안 그러면 큰 표가 화면 가운데를 지날 때 앞뒤로 튄다.
  useEffect(() => {
    const nodes = ids.split(',').filter(Boolean)
      .map(id => document.getElementById(id))
      .filter(Boolean);
    if (nodes.length === 0) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const seen = entries.filter(e => e.isIntersecting);
        if (seen.length === 0) return;
        const top = seen.reduce((a, b) => (
          a.boundingClientRect.top <= b.boundingClientRect.top ? a : b
        ));
        setActive(top.target.id);
      },
      { rootMargin: '0px 0px -70% 0px', threshold: 0 },
    );
    nodes.forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, [ids]);

  const go = (id) => () => {
    onJump?.(id);
    // 펴지는 데 한 프레임 걸린다. 바로 옮기면 접힌 높이 기준으로 멈춘다.
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({
        behavior: 'smooth', block: 'start',
      });
    });
  };

  return (
    <Aside aria-label="흐름">
      <Label>흐름</Label>
      {items.map((item, i) => {
        const key = `${item.kind}-${item.id || i}`;
        if (item.kind === 'group') return <GroupLabel key={key}>{item.label}</GroupLabel>;
        if (item.kind === 'link') {
          return (
            <Link key={key}>{item.note && <LinkNote>{item.note}</LinkNote>}</Link>
          );
        }
        if (item.kind === 'branch') {
          return (
            <Branch key={key}>
              <Arrow>{item.into ? '◂┘' : '└▸'}</Arrow>
              <span>{item.text}</span>
            </Branch>
          );
        }
        if (item.kind === 'exit') return <Exit key={key}>{item.label}</Exit>;
        const Box = item.kind === 'side' ? Side : Node;
        return (
          <Box key={key} $out={item.out} $active={active === item.id}
               onClick={go(item.id)}>
            {item.label}
          </Box>
        );
      })}
    </Aside>
  );
};

export default FlowMap;
