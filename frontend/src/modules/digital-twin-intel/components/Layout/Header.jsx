import React from 'react';
import styled from 'styled-components';
import { Radar, Plus, Newspaper } from 'lucide-react';
import { CommonHeader } from '../../../../shared/components/Header';

const Tabs = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: #eef2ff;
  padding: 0.1875rem;
  border-radius: 0.625rem;
`;

const Tab = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.875rem;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  background: ${(p) => (p.$on ? '#fff' : 'transparent')};
  color: ${(p) => (p.$on ? '#4338ca' : '#6366f1')};
  box-shadow: ${(p) => (p.$on ? '0 1px 3px rgba(67,56,202,0.18)' : 'none')};

  span.count {
    font-size: 0.6875rem;
    font-weight: 700;
    opacity: 0.7;
  }
`;

const Right = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

/*
  ⚠️ 설정(분류 목록 편집) 단추는 **아직 안 만들었으므로 안 보인다.** 눌러서
     「다음 단계에서 붙습니다」가 뜨는 것은 사용자에게 미완성을 내보이는 것이다.
     분류 기본값은 서버(`models.DEFAULT_SECTORS`)에 있고, 늘리는 길
     (`PUT /settings`)은 이미 열려 있다 — 화면만 나중에 붙인다.
*/

const AddButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.4rem 0.875rem;
  background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(79,70,229,0.3); }
`;

/**
 * 두 탭을 나란히 둔다 — **하나가 다른 하나의 근거**라 갈라 놓으면 안 된다.
 * 소식에서 기술이 만들어지고, 기술에서 그 소식을 되짚는다.
 */
const Header = ({ tab, onTab, newsCount, techCount, onAdd, onGoHome }) => (
  <CommonHeader
    logo={<Radar size={24} strokeWidth={2} />}
    title="디지털 트윈 기술정보"
    titleColor="#4f46e5"
    onGoHome={onGoHome}
    showStats={false}
    className="digital-twin-intel-header"
    centerContent={
      <Tabs>
        <Tab type="button" $on={tab === 'news'} onClick={() => onTab('news')}>
          <Newspaper size={15} /> 소식 <span className="count">{newsCount}</span>
        </Tab>
        <Tab type="button" $on={tab === 'tech'} onClick={() => onTab('tech')}>
          <Radar size={15} /> 기술 레이더 <span className="count">{techCount}</span>
        </Tab>
      </Tabs>
    }
    rightContent={
      <Right>
        <AddButton onClick={onAdd}>
          <Plus size={16} />
          {tab === 'news' ? '소식 등록' : '기술 추가'}
        </AddButton>
      </Right>
    }
  />
);

export default Header;
