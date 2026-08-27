import React from 'react';
import { Gauge } from 'lucide-react';
import CommonHeader from '../../../../shared/components/Header/CommonHeader';

// 로드맵 정보(「언제」)의 형제 — 이 모듈은 「얼마나」를 말한다.
const Header = ({ onGoHome }) => (
  <CommonHeader
    logo={<Gauge size={24} strokeWidth={2} />}
    title="개발 디지털 트윈 성숙도"
    titleColor="#1d4ed8"
    onGoHome={onGoHome}
    showStats={false}
    className="dev-dt-maturity-header"
  />
);

export default Header;
