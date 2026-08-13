import React from 'react';
import { Home } from 'lucide-react';
import './CommonHeader.css';

const CommonHeader = ({ 
  logo,
  title,
  titleColor = '#646cff',
  leftContent,
  centerContent,
  rightContent,
  onGoHome,
  showStats = true,
  statsData = [],
  className = ''
}) => {
  const handleGoHome = () => {
    if (onGoHome) {
      onGoHome();
    } else {
      window.location.href = '/';
    }
  };

  return (
    <header className={`common-header ${className}`}>
      <div className="header-left">
        <div className="logo" style={{ color: titleColor }}>
          {logo}
          <h1>{title}</h1>
        </div>
        {showStats && statsData.length > 0 && (
          <div className="stats-badges">
            {statsData.map((stat, index) => (
              <div key={index} className="stat-badge" style={stat.style}>
                {stat.label}
              </div>
            ))}
          </div>
        )}
        {leftContent}
      </div>

      <div className="header-right">
        <div className="header-center-content">
          {centerContent}
        </div>
        {rightContent}
        <button
          className="header-btn home-btn"
          onClick={handleGoHome}
          title="메인 화면으로 돌아가기"
        >
          <Home size={18} strokeWidth={2} />
          <span>홈</span>
        </button>
      </div>
    </header>
  );
};

export default CommonHeader;
