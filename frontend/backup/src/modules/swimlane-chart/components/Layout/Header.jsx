import React from 'react';
import { Users, RotateCcw, Plus, Link, Trash2, Info } from 'lucide-react';
import { CommonHeader } from '../../../../shared/components/Header';

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

  // 통계 데이터
  const statsData = [
    {
      label: `${organizationsCount}개 조직`,
      style: {
        backgroundColor: '#f0f8ff',
        color: '#646cff',
        borderColor: '#e0e8ff'
      }
    },
    {
      label: `${stepsCount}개 단계`,
      style: {
        backgroundColor: '#f0f8ff',
        color: '#646cff',
        borderColor: '#e0e8ff'
      }
    }
  ];

  // 중앙 액션 버튼들
  const centerContent = (
    <>
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
          style={{
            backgroundColor: globalConnecting ? '#ffebee' : '#e3f2fd',
            color: globalConnecting ? '#c62828' : '#1565c0',
            borderColor: globalConnecting ? '#ef9a9a' : '#90caf9'
          }}
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
        <div className="connection-status" style={{
          position: 'absolute',
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#28a745',
          border: '1px solid #20c997',
          borderRadius: '6px',
          padding: '8px 16px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          zIndex: 1001,
          whiteSpace: 'nowrap'
        }}>
          <div className="status-indicator" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            color: '#ffffff',
            fontWeight: '500'
          }}>
            <div className="status-dot" style={{
              width: '8px',
              height: '8px',
              backgroundColor: '#ffffff',
              borderRadius: '50%',
              animation: 'pulse 2s infinite'
            }}></div>
            <span>연결 모드 활성 - 프로세스를 클릭하여 연결하세요 (ESC로 종료)</span>
          </div>
        </div>
      )}
    </>
  );

  // 우측 콘텐츠 - 도움말 정보
  const rightContent = (
    <div className="delete-help-info" title="화살표 삭제 방법" style={{
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      padding: '8px',
      backgroundColor: '#f8f9fa',
      border: '1px solid #e9ecef',
      borderRadius: '6px',
      cursor: 'help',
      color: '#6c757d',
      transition: 'all 0.2s ease'
    }}>
      <Info size={16} strokeWidth={2} />
      <div className="delete-help-tooltip" style={{
        position: 'absolute',
        top: '100%',
        right: '-100px',
        backgroundColor: '#212529',
        color: 'white',
        padding: '12px',
        borderRadius: '6px',
        fontSize: '12px',
        whiteSpace: 'nowrap',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        opacity: 0,
        visibility: 'hidden',
        transform: 'translateY(-10px)',
        transition: 'all 0.2s ease',
        zIndex: 1002,
        minWidth: '300px'
      }}>
        <div className="help-item" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px'
        }}>
          <Trash2 size={14} strokeWidth={2} style={{color: '#6366f1'}} />
          <span style={{fontSize: '11px'}}>로컬 화살표 (파란색 실선): 클릭 선택 후 Delete키 또는 X버튼</span>
        </div>
        <div className="help-item" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Trash2 size={14} strokeWidth={2} style={{color: '#ef4444'}} />
          <span style={{fontSize: '11px'}}>글로벌 화살표 (빨간 점선): 클릭 선택 후 Delete키 또는 X버튼</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(255, 255, 255, 0); }
          100% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0); }
        }
        
        .delete-help-info:hover {
          background-color: #e9ecef !important;
          color: #495057 !important;
        }
        
        .delete-help-info:hover .delete-help-tooltip {
          opacity: 1 !important;
          visibility: visible !important;
          transform: translateY(8px) !important;
        }
        
        .delete-help-tooltip::after {
          content: '';
          position: absolute;
          bottom: 100%;
          right: 120px;
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-bottom: 6px solid #212529;
        }
      `}</style>
      
      <CommonHeader
        logo={<Users size={24} strokeWidth={2} />}
        title="Swimlane Chart"
        titleColor="#646cff"
        centerContent={centerContent}
        rightContent={rightContent}
        statsData={statsData}
        onGoHome={onGoHome}
        className="swimlane-header"
      />
    </>
  );
};

export default Header;
