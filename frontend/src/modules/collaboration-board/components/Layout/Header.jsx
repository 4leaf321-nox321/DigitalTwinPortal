import React from 'react';
import { MessageSquare } from 'lucide-react';
import { CommonHeader } from '../../../../shared/components/Header';

const Header = ({ onGoHome }) => {
  return (
    <CommonHeader
      logo={<MessageSquare size={24} strokeWidth={2} />}
      title="협업 게시판"
      titleColor="#8b5cf6"
      onGoHome={onGoHome}
      showStats={false}
      className="collaboration-board-header"
    />
  );
};

export default Header;
