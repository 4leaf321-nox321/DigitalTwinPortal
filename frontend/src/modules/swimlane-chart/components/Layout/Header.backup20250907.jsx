import React from 'react';
import { Users, Home, RotateCcw, Plus, Link, Trash2, Info } from 'lucide-react';
import './Header.css';

const Header = ({ 
  onGoHome,
  onAddStep,
  onAddOrganization,
  onLoadSample,
  stepsCount = 0,
  organizationsCount = 0,
  globalConnecting = false,
  onToggleGlobalConnection
}) => {
  const handleGoHome = () => {
    if (onGoHome) {
      onGoHome();
    }
  };

  return (
    <header className="swimlane-header">
      <div className="header-left">
        <div className="logo">
          <Users size={24} strokeWidth={2} />
          <h1>Swimlane Chart</h1>
        </div>
        <div className="count-badges">
          <div className="count-badge">
            {organizationsCount}개 조직
          </div>
          <div className="count-badge">
            {stepsCount}개 단계
          </div>
        </div>
      </div>

      <div className="header-center">
        <div className="header-actions">
          <button 
            className="header-btn action-btn add-btn"
            onClick={onAddOrganization}
            title="새 조직 추가"
          >
            <Plus size={18} strokeWidth={2} />
            <span>조직 추가</span>
          </button>
          
          <button 
            className="header-btn action-btn add-btn"
            onClick={onAddStep}
            title="새 단계 추가"
          >
            <Plus size={18} strokeWidth={2} />
            <span>단계 추가</span>
          </button>
          
          <div className="header-divider"></div>
          
          <button 
            className={`header-btn action-btn ${globalConnecting ? 'connect-btn active' : 'connect-btn'}`}
            onClick={onToggleGlobalConnection}
            title={globalConnecting ? "연결 모드 종료 (ESC)" : "연결 모드 시작"}
          >
            <Link size={18} strokeWidth={2} />
            <span>{globalConnecting ? '연결 종료' : '연결'}</span>
          </button>
          
          <div className="header-divider"></div>
          
          <button 
            className="header-btn action-btn sample-btn"
            onClick={onLoadSample}
            title="샘플 데이터 로드"
          >
            <RotateCcw size={18} strokeWidth={2} />
            <span>샘플</span>
          </button>
        </div>

        {/* 연결 모드 상태 표시 */}
        {globalConnecting && (
          <div className="connection-status">
            <div className="status-indicator">
              <div className="status-dot"></div>
              <span>연결 모드 활성 - 프로세스를 클릭하여 연결하세요 (ESC로 종료)</span>
            </div>
          </div>
        )}
      </div>

      <div className="header-right">
        <div className="delete-help-info" title="화살표 삭제 방법">
          <Info size={16} strokeWidth={2} />
          <div className="delete-help-tooltip">
            <div className="help-item">
              <Trash2 size={14} strokeWidth={2} style={{color: '#6366f1'}} />
              <span>로컬 화살표 (파란색 실선): 클릭 선택 후 Delete키 또는 X버튼</span>
            </div>
            <div className="help-item">
              <Trash2 size={14} strokeWidth={2} style={{color: '#ef4444'}} />
              <span>글로벌 화살표 (빨간 점선): 클릭 선택 후 Delete키 또는 X버튼</span>
            </div>
          </div>
        </div>
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

export default Header;
