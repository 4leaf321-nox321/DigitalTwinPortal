import React from 'react';
import { Compass } from 'lucide-react';
import CommonHeader from '../../../../shared/components/Header/CommonHeader';

const Header = ({ onGoHome }) => {
  return (
    <CommonHeader
      logo={<Compass size={24} strokeWidth={2} />}
      title="디지털 트윈 전략 기획"
      titleColor="#7c3aed"
      onGoHome={onGoHome}
      showStats={false}
      className="digital-twin-strategy-header"
    />
  );
};

export default Header;
