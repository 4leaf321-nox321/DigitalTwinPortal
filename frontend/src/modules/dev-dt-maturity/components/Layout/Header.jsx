import React from 'react';
import styled from 'styled-components';
import { Gauge, FlaskConical, Cpu, Upload, Settings, Eye } from 'lucide-react';
import CommonHeader from '../../../../shared/components/Header/CommonHeader';

// 로드맵 정보(「언제」)의 형제 — 이 모듈은 「얼마나」를 말한다.
// 단추는 로드맵 정보 헤더와 같은 모양 — 포탈 안에서 헤더 문법이 갈리면 안 된다.

const Buttons = styled.div`display: flex; gap: 0.5rem; align-items: center;`;

const HeaderButton = styled.button`
  display: flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 6px;
  font-size: 0.8rem; font-weight: 600; font-family: inherit; cursor: pointer; transition: all 0.2s ease;
  background: ${p => (p.$variant === 'primary' ? '#1d4ed8' : 'transparent')};
  color: ${p => (p.$variant === 'primary' ? 'white' : '#64748b')};
  border: ${p => (p.$variant === 'primary' ? 'none' : '1px solid #e2e8f0')};
  &:hover { background: ${p => (p.$variant === 'primary' ? '#1e40af' : '#f1f5f9')}; color: ${p => (p.$variant === 'primary' ? 'white' : '#475569')}; }
`;
const Count = styled.span`font-size: 0.7rem; color: #94a3b8; font-weight: 500;`;

const Header = ({ onGoHome, onOpen, counts = {}, canCurate = false, sample = false, onToggleSample }) => (
  <CommonHeader
    logo={<Gauge size={24} strokeWidth={2} />}
    title="개발 디지털 트윈 성숙도"
    titleColor="#1d4ed8"
    onGoHome={onGoHome}
    showStats={false}
    className="dev-dt-maturity-header"
    centerContent={
      <Buttons>
        <HeaderButton onClick={() => onOpen('subject')} title="시험 항목 추가·수정·삭제">
          <FlaskConical size={16} /> 시험 항목 관리 {counts.subjects != null && <Count>{counts.subjects}</Count>}
        </HeaderButton>
        <HeaderButton onClick={() => onOpen('agent')} title="시뮬레이션 추가·수정·삭제 (엑셀 행 단위)">
          <Cpu size={16} /> 시뮬레이션 관리 {counts.agents != null && <Count>{counts.agents}</Count>}
        </HeaderButton>
        <HeaderButton $variant="primary" onClick={() => onOpen('import')} title="틀 내려받기 → 채워서 붙여넣기 → 미리보기 → 넣기">
          <Upload size={16} /> 가져오기
        </HeaderButton>
        {canCurate && (
          <HeaderButton onClick={() => onOpen('settings')} title="정확도 문턱과 경계 — 사무국·관리자" style={{ marginLeft: '0.5rem' }}>
            <Settings size={16} /> 설정
          </HeaderButton>
        )}
        {canCurate && onToggleSample && (
          <HeaderButton onClick={onToggleSample} title="개발용 목업 자료로 화면을 그려 본다 — 보고용. 저장되지 않는다"
                        style={sample ? { background: '#fef3c7', color: '#92400e', borderColor: '#f59e0b' } : undefined}>
            <Eye size={16} /> {sample ? '샘플 뷰 끄기' : '샘플 뷰'}
          </HeaderButton>
        )}
      </Buttons>
    }
  />
);

export default Header;
