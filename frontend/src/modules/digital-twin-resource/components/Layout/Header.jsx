import React from 'react';
import { Database } from 'lucide-react';
import { CommonHeader } from '../../../../shared/components/Header';

const Header = ({ onGoHome }) => {
  return (
    <CommonHeader
      logo={<Database size={24} strokeWidth={2} />}
      title="전사 디지털 트윈 자원 관리"
      titleColor="#0ea5e9"
      onGoHome={onGoHome}
      showStats={false}
      className="digital-twin-resource-header"
    />
  );
};

export default Header;
