import React from 'react';
import { ClipboardList, ListChecks, Settings2 } from 'lucide-react';
import styled from 'styled-components';
import CommonHeader from '../../../../shared/components/Header/CommonHeader';
import { ACCENT, ACCENT_TINT } from '../../theme';

// 껍데기는 다른 모듈과 같아야 한다. 이 모듈만 생김새가 다르면 사용자는 다른
// 시스템으로 넘어온 줄 안다 — 그래서 CommonHeader 를 감싸는 얇은 층만 둔다.
// 홈 버튼은 CommonHeader 가 항상 그리므로 여기서 만들지 않는다.
//
// onGoHome 은 **가공 없이 그대로** 넘긴다. 빠뜨리면 CommonHeader 가
// window.location.href='/' 로 폴백해 SPA 상태가 통째로 날아간다.

const Buttons = styled.div`
  display: flex;
  gap: 0.375rem;
`;

const ModeButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.4rem 0.875rem;
  background: ${p => (p.$active ? ACCENT_TINT : 'white')};
  color: ${p => (p.$active ? ACCENT : '#475569')};
  border: 1px solid ${p => (p.$active ? ACCENT : '#e2e8f0')};
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: ${ACCENT};
    color: ${ACCENT};
  }
`;

// 미응답 건수는 관리 화면에 가 있어도 보여야 한다 — 응답이 밀린 줄 모른 채
// 설문만 더 만드는 일을 막는다.
const Badge = styled.span`
  min-width: 1.15rem;
  padding: 0 0.3rem;
  border-radius: 0.6rem;
  background: #ef4444;
  color: white;
  font-size: 0.6875rem;
  font-weight: 700;
  line-height: 1.15rem;
  text-align: center;
`;

const Header = ({ onGoHome, canManage, mode, onChangeMode, pending = 0 }) => (
  <CommonHeader
    logo={<ClipboardList size={24} strokeWidth={2} />}
    title="설문"
    titleColor={ACCENT}
    onGoHome={onGoHome}
    showStats={false}
    className="survey-header"
    centerContent={
      // 전환 버튼은 권한이 있을 때만 그린다. **이건 방어가 아니라 정리다** —
      // 막는 곳은 백엔드의 manager_required 한 곳이고, 여기서 버튼을 감추는
      // 이유는 대부분의 사용자에게 쓸모없는 버튼을 안 보이게 하려는 것뿐이다.
      canManage ? (
        <Buttons>
          <ModeButton
            $active={mode === 'respond'}
            onClick={() => onChangeMode('respond')}
            title="내가 받은 설문에 응답합니다"
          >
            <ListChecks size={16} />
            내 설문
            {pending > 0 && <Badge>{pending}</Badge>}
          </ModeButton>
          <ModeButton
            $active={mode === 'manage'}
            onClick={() => onChangeMode('manage')}
            title="설문을 만들고 집계를 봅니다"
          >
            <Settings2 size={16} />
            설문 관리
          </ModeButton>
        </Buttons>
      ) : null
    }
  />
);

export default Header;
