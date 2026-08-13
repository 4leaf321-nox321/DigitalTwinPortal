import React from 'react';
import { Users } from 'lucide-react';
import { CommonHeader } from '../../../../shared/components/Header';

const Header = ({ onGoHome }) => {
  return (
    <CommonHeader
      logo={<Users size={24} strokeWidth={2} />}
      title="조직도"
      titleColor="#14b8a6"
      onGoHome={onGoHome}
      showStats={false}
      className="organization-chart-header"
    />
  );
};

export default Header;
