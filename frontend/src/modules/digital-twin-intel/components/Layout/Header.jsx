import React from 'react';
import styled from 'styled-components';
import { Radar, Plus, Newspaper, Wrench, ClipboardList, Layers } from 'lucide-react';
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

/*
  도구 관리. ⚠️ **기술 탭에서만 보인다** — 소식을 보는 중에 나오면 무엇에 대한
  도구인지가 안 잡힌다.
*/
const ToolButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.4rem 0.75rem;
  background: #fff;
  color: #4338ca;
  border: 1px solid #c7d2fe;
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;

  &:hover { background: #eef2ff; }

  em {
    font-style: normal;
    font-size: 0.6875rem;
    font-weight: 700;
    color: #b45309;
  }
`;

const SheetButton = styled(ToolButton)`
  background: #eef2ff;
  border-color: #a5b4fc;

  &:hover { background: #e0e7ff; }
`;

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
const Header = ({ tab, onTab, newsCount, techCount, onAdd, onGoHome,
                  onTools, onSheet, onCaps, orphanCount = 0 }) => (
  <CommonHeader
    logo={<Radar size={24} strokeWidth={2} />}
    title="디지털 트윈 기술정보"
    titleColor="#4f46e5"
    onGoHome={onGoHome}
    showStats={false}
    className="digital-twin-intel-header"
    /*
      ⚠️ 탭을 **홈 단추 바로 왼쪽**에 붙인다(2026-08-25 요청). 원래는 가운데 자리에
         있었는데, 그 사이에 「도구 관리」ㆍ「기술 추가」가 끼어 있어 탭과 홈이
         멀찍이 떨어져 보였다. `CommonHeader` 는 가운데→오른쪽→홈 차례로 놓으므로,
         **오른쪽 묶음의 맨 뒤**에 두면 홈 옆에 온다.
      ⚠️ 공용 머리글(`CommonHeader`)은 안 건드린다 — 다른 화면이 같이 흔들린다.
    */
    rightContent={
      <Right>
        {/*
          ⚠️ **적는 자리를 도구 관리 앞에 세운다.** 지금 이 화면의 병목은 「무엇이
             있나」가 아니라 「우리가 무엇을 쓰나가 안 적혀 있다」이다 — 504칸 중
             24칸(4.8%)만 찼다. 먼저 눈에 띄어야 할 단추가 이것이다.
        */}
        {tab === 'tech' && onSheet && (
          <SheetButton type="button" onClick={onSheet}
                       title="우리 사업부가 어느 역량을 무엇으로 하는지 한 판에 적습니다">
            <ClipboardList size={15} /> 사업부 적기
          </SheetButton>
        )}
        {/* ⚠️ 도구 관리와 **짝**으로 나란히 둔다 — 두 층이 있다는 것이 머리에서
            보여야 한다. 역량만 관리할 자리가 없으면, 아무 사업부도 안 적어
            레이더에 점이 없는 48개는 화면 어디에서도 못 찾는다. */}
        {tab === 'tech' && onCaps && (
          <ToolButton type="button" onClick={onCaps}
                      title="역량 목록을 보고 고칩니다">
            <Layers size={15} /> 역량 관리
          </ToolButton>
        )}
        {tab === 'tech' && onTools && (
          <ToolButton type="button" onClick={onTools}
                      title="역량마다 쓸 수 있는 S/W 목록을 정합니다">
            <Wrench size={15} /> 도구 관리
            {/*
              ⚠️ **안 매단 도구 수를 단추에 붙인다.** 그 도구들은 어느 사업부
                 표에도 안 나오는데, 화면 어디에서도 그 사실이 안 보이면 아무도
                 안 매단다. 0 이면 안 붙는다 — 늘 붙어 있으면 눈이 지나친다.
            */}
            {orphanCount > 0 && <em>{orphanCount}</em>}
          </ToolButton>
        )}
        <AddButton onClick={onAdd}>
          <Plus size={16} />
          {tab === 'news' ? '소식 등록' : '기술 추가'}
        </AddButton>

        <Tabs>
          <Tab type="button" $on={tab === 'news'} onClick={() => onTab('news')}>
            <Newspaper size={15} /> 소식 <span className="count">{newsCount}</span>
          </Tab>
          <Tab type="button" $on={tab === 'tech'} onClick={() => onTab('tech')}>
            <Radar size={15} /> 기술 레이더 <span className="count">{techCount}</span>
          </Tab>
        </Tabs>
      </Right>
    }
  />
);

export default Header;
