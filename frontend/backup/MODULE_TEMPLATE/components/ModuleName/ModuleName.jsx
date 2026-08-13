import React, { useState } from 'react';
import './ModuleName.css';

/**
 * [MODULE_NAME] 메인 컴포넌트
 * 
 * Props:
 * @param {Function} showSuccess - 성공 모달 표시 함수
 * @param {Function} showError - 에러 모달 표시 함수  
 * @param {Function} showInfo - 정보 모달 표시 함수
 * @param {Function} askWarningConfirm - 확인 모달 표시 함수
 */
const ModuleName = ({ 
  showSuccess, 
  showError, 
  showInfo, 
  askWarningConfirm 
}) => {
  // 모듈 상태 관리
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 예시 액션 핸들러
  const handleAction = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 실제 로직을 여기에 구현하세요
      await new Promise(resolve => setTimeout(resolve, 1000)); // 시뮬레이션
      
      setData('작업 완료!');
      await showSuccess('작업이 성공적으로 완료되었습니다!');
      
    } catch (err) {
      setError(err.message);
      await showError(`작업 중 오류가 발생했습니다: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 삭제 확인 예시
  const handleDelete = async () => {
    const confirmed = await askWarningConfirm(
      '정말로 삭제하시겠습니까?',
      '이 작업은 되돌릴 수 없습니다.'
    );
    
    if (confirmed) {
      setData(null);
      await showInfo('삭제가 완료되었습니다.');
    }
  };

  return (
    <div className="module-name">
      {/* 헤더 섹션 */}
      <header className="module-header">
        <div className="header-content">
          <h1 className="module-title">
            🚀 [MODULE_NAME]
          </h1>
          <p className="module-description">
            이 모듈에 대한 설명을 여기에 작성하세요.
            사용자가 이 모듈로 무엇을 할 수 있는지 명확히 설명해주세요.
          </p>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="module-content">
        <div className="content-container">
          
          {/* 상태 표시 */}
          {error && (
            <div className="error-message">
              ❌ {error}
            </div>
          )}
          
          {loading && (
            <div className="loading-message">
              🔄 처리 중...
            </div>
          )}
          
          {data && (
            <div className="success-message">
              ✅ {data}
            </div>
          )}

          {/* 액션 버튼들 */}
          <div className="action-section">
            <h2>작업 수행</h2>
            <div className="button-group">
              <button 
                onClick={handleAction}
                disabled={loading}
                className="action-button primary"
              >
                {loading ? '처리 중...' : '작업 시작'}
              </button>
              
              <button 
                onClick={handleDelete}
                disabled={loading || !data}
                className="action-button danger"
              >
                삭제하기
              </button>
              
              <button 
                onClick={() => showInfo('이것은 정보 모달 테스트입니다.')}
                className="action-button secondary"
              >
                정보 보기
              </button>
            </div>
          </div>

          {/* 데이터 표시 영역 */}
          <div className="data-section">
            <h2>데이터 영역</h2>
            <div className="data-container">
              {data ? (
                <div className="data-content">
                  <p>현재 데이터: {data}</p>
                  {/* 실제 데이터 표시 로직을 여기에 구현하세요 */}
                </div>
              ) : (
                <div className="empty-state">
                  <p>데이터가 없습니다.</p>
                  <p>위의 "작업 시작" 버튼을 클릭해보세요.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default ModuleName;
