import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { CommonHeader } from '../../../../shared/components/Header';

const Header = ({ onGoHome }) => {
  return (
    <CommonHeader
      logo={<ShieldCheck size={24} strokeWidth={2} />}
      title="문서 자동 검증"
      titleColor="#8b5cf6"
      onGoHome={onGoHome}
      showStats={false}
      className="auto-document-verify-header"
    />
  );
};

export default Header;
