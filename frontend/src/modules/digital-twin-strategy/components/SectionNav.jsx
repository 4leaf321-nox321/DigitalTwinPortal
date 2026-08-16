import React, { useEffect, useState } from 'react';
import styled from 'styled-components';

// 긴 화면의 목차. **지금 어느 단위를 보고 있는지**를 같이 알려준다.
//
// 진단 한 단계가 세로로 대여섯 화면이라, 위아래로 옮겨 다니려면 스크롤을
// 굴려서 눈으로 찾는 수밖에 없었다. 그러다 보면 지금 보는 것이 관측인지
// 발견 사항인지도 헷갈린다.
//
// ⚠️ **position: fixed 로 띄우지 않는다.** 이 앱은 창이 아니라 MainContent 가
//    스크롤된다(overflow-y: auto). 그 안에서 sticky 로 두면 스크롤 영역과 함께
//    움직여서 위치 계산이 필요 없고, 내용 위에 겹치지도 않는다. fixed 로 두면
//    본문 폭(1440px)이 어디서 시작하는지를 매번 재야 하고, 창 크기가 바뀔 때마다
//    어긋난다.
//
// ⚠️ 좁은 화면에서는 **아예 감춘다.** 목차가 본문을 밀어내면 표가 찌그러진다.
//    목차는 편의지 필수가 아니다.

const Nav = styled.nav`
  display: none;

  @media (min-width: 1280px) {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    position: sticky;
    top: 0;
    align-self: flex-start;
    flex-shrink: 0;
    /* 항목 이름이 잘리면 목차 구실을 못 한다. 제일 긴 이름이 들어갈 만큼. */
    width: 13rem;
    padding-right: 0.75rem;
    border-right: 1px solid #e2e8f0;
  }
`;

const Label = styled.div`
  padding: 0 0.5rem 0.35rem;
  font-size: 0.6875rem;
  font-weight: 700;
  color: #94a3b8;
  letter-spacing: 0.02em;
`;

const Item = styled.button`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  padding: 0.35rem 0.5rem;
  border: none;
  border-radius: 0.375rem;
  background: ${p => (p.$active ? '#f5f3ff' : 'transparent')};
  color: ${p => (p.$active ? '#6d28d9' : '#64748b')};
  font-size: 0.8125rem;
  font-weight: ${p => (p.$active ? 700 : 500)};
  font-family: inherit;
  text-align: left;
  line-height: 1.35;
  cursor: pointer;

  &:hover {
    background: ${p => (p.$active ? '#f5f3ff' : '#f8fafc')};
    color: ${p => (p.$active ? '#6d28d9' : '#334155')};
  }
`;

// 단계 번호. 지금 보는 것이 ①관측인지 ②발견 사항인지가 이것으로 읽힌다.
//
// ⚠️ **단계가 바뀌는 줄에만 찍는다.** 관측 단계에는 패널이 넷이라(관측·지표별
//    연결·설문 근거·설문 이야기) 줄마다 찍으면 ① 이 네 번 나오고, 그러면
//    단계가 아니라 번호 매기기 실수로 보인다. 번호가 나오는 자리가 곧
//    단계가 바뀌는 자리다.
const Step = styled.span`
  flex-shrink: 0;
  width: 1.1rem;
  height: 1.1rem;
  border-radius: 0.25rem;
  display: grid;
  place-items: center;
  font-size: 0.625rem;
  font-weight: 700;
  background: ${p => (p.$active ? '#7c3aed' : '#e2e8f0')};
  color: ${p => (p.$active ? 'white' : '#94a3b8')};
  /* 번호가 없는 줄도 라벨 세로줄이 맞아야 목록으로 읽힌다. */
  visibility: ${p => (p.$hidden ? 'hidden' : 'visible')};
`;

// 번호가 아예 없는 부분(세부 판단)을 가르는 줄. 단계에 속하지 않는다는 것을
// 선 하나로 말한다 — 없는 번호를 지어내 붙이는 것보다 낫다.
const Divider = styled.div`
  height: 1px;
  margin: 0.35rem 0.5rem;
  background: #e2e8f0;
`;

const Text = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

/**
 * items: [{id, label, step}] — id 는 화면의 섹션 element id 와 같아야 한다.
 *        step 이 null 이면 단계에 속하지 않는 보조 영역이다(구분선으로 가른다).
 * onJump: 옮겨 가기 **전에** 부른다. 접혀 있는 섹션을 펴는 데 쓴다 —
 *         접힌 채로 옮겨 가면 제목만 보여서 왜 눌렀는지 알 수 없다.
 */
const SectionNav = ({ items, onJump }) => {
  const [active, setActive] = useState(items[0]?.id);

  useEffect(() => {
    const nodes = items
      .map(item => document.getElementById(item.id))
      .filter(Boolean);
    if (nodes.length === 0) return undefined;

    // ⚠️ root 를 주지 않아도 된다. IntersectionObserver 는 중간 스크롤 영역의
    //    잘림까지 계산하므로, MainContent 밖으로 밀려난 섹션은 안 겹친 것으로
    //    잡힌다.
    //
    // 아래쪽 70% 를 빼서 **위쪽에 있는 섹션**이 현재로 잡히게 한다. 안 그러면
    // 화면 한가운데 큰 표가 지나갈 때 목차가 앞뒤로 튄다.
    const observer = new IntersectionObserver(
      (entries) => {
        const seen = entries.filter(e => e.isIntersecting);
        if (seen.length === 0) return;
        // 여러 개가 걸리면 제일 위의 것.
        const top = seen.reduce((a, b) => (
          a.boundingClientRect.top <= b.boundingClientRect.top ? a : b
        ));
        setActive(top.target.id);
      },
      { rootMargin: '0px 0px -70% 0px', threshold: 0 },
    );
    nodes.forEach(node => observer.observe(node));
    return () => observer.disconnect();
    // items 가 바뀌면(설문 섹션이 생기고 사라진다) 다시 건다.
  }, [items]);

  const jump = (id) => {
    onJump?.(id);
    // 펴지는 데 한 프레임 걸린다. 바로 옮기면 접힌 높이 기준으로 멈춘다.
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({
        behavior: 'smooth', block: 'start',
      });
    });
  };

  return (
    <Nav aria-label="진단 목차">
      <Label>목차</Label>
      {items.map((item, i) => {
        const prev = items[i - 1];
        // 단계가 바뀌는 줄에만 번호를 찍는다.
        const showStep = item.step != null && item.step !== prev?.step;
        const cut = item.step == null && prev?.step != null;
        return (
          <React.Fragment key={item.id}>
            {cut && <Divider />}
            <Item
              $active={active === item.id}
              onClick={() => jump(item.id)}
              title={item.step != null ? `${item.step}단계 · ${item.label}` : item.label}
            >
              <Step $active={active === item.id} $hidden={!showStep}>
                {item.step}
              </Step>
              <Text>{item.label}</Text>
            </Item>
          </React.Fragment>
        );
      })}
    </Nav>
  );
};

export default SectionNav;
