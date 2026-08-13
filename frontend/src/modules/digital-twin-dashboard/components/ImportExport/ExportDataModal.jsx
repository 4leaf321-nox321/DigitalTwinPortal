import React, { useState } from 'react';
import { X, Download, Database, Check, Info, Target, AlertCircle } from 'lucide-react';
import { 
  exportProjectsToJSON
} from '../../utils/importExportUtils';

const ExportDataModal = ({ 
  isOpen, 
  onClose, 
  projects = [],
  performances = [],
  onExportComplete 
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState(null); // 'success' | 'error'
  const [error, setError] = useState('');

  const handleExport = async () => {
    if (!projects || projects.length === 0) {
      setError('내보낼 프로젝트 데이터가 없습니다.');
      return;
    }

    try {
      setIsExporting(true);
      setError('');
      setExportStatus(null);

      const filename = `digital-twin-dashboard`;

      await exportProjectsToJSON(projects, performances, filename);

      setExportStatus('success');
      
      // 부모 컴포넌트에 완료 알림
      if (onExportComplete) {
        onExportComplete({
          format: 'json',
          projectCount: projects.length,
          performanceCount: performances.length
        });
      }

      // 1.5초 후 모달 닫기
      setTimeout(() => {
        handleClose();
      }, 1500);

    } catch (err) {
      setError(err.message);
      setExportStatus('error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleClose = () => {
    setIsExporting(false);
    setExportStatus(null);
    setError('');
    onClose();
  };

  const getProjectStats = () => {
    if (!projects || projects.length === 0) {
      return {
        totalProjects: 0,
        totalPerformances: 0,
        totalActionItems: 0,
        totalTeamMembers: 0,
        globalPerformances: performances?.length || 0
      };
    }

    const totalProjectPerformances = projects.reduce((sum, p) => sum + (p.성과목록?.length || 0), 0);
    const totalActionItems = projects.reduce((sum, p) => sum + (p.액션아이템목록?.length || 0), 0);
    const totalTeamMembers = projects.reduce((sum, p) => sum + (p.과제참여인력목록?.length || 0), 0);

    return {
      totalProjects: projects.length,
      totalProjectPerformances,
      totalActionItems,
      totalTeamMembers,
      globalPerformances: performances?.length || 0
    };
  };

  const stats = getProjectStats();

  const getEstimatedFileSize = () => {
    if (!projects || projects.length === 0) return '0 KB';

    // JSON 파일 크기 추정
    const avgProjectSize = 2500; // bytes per project
    const avgPerformanceSize = 800; // bytes per performance
    const totalSize = (projects.length * avgProjectSize) + (performances.length * avgPerformanceSize);

    return `~${Math.round(totalSize / 1024)} KB`;
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container export-modal">
        <div className="modal-header">
          <h2>데이터 저장</h2>
          <button className="close-button" onClick={handleClose}>
            <X size={24} />
          </button>
        </div>

        <div className="modal-content">
          {exportStatus === 'success' ? (
            <div className="export-success">
              <div className="success-icon">
                <Check size={48} />
              </div>
              <h3>저장 완료!</h3>
              <p>
                JSON 파일이 성공적으로 저장되었습니다.
                <br />
                <small>🎯 프로젝트와 성과가 분리된 효율적인 구조로 저장되었습니다</small>
              </p>
            </div>
          ) : (
            <>
              {/* 프로젝트 통계 */}
              <div className="data-stats">
                <h3>저장할 데이터 현황</h3>
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-value">{stats.totalProjects}</span>
                    <span className="stat-label">프로젝트</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{stats.globalPerformances}</span>
                    <span className="stat-label">글로벌 성과</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{stats.totalActionItems}</span>
                    <span className="stat-label">액션아이템</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{getEstimatedFileSize()}</span>
                    <span className="stat-label">예상 크기</span>
                  </div>
                </div>
              </div>

              {/* 메인 설명 영역 */}
              <div className="format-explanation">
                <div className="format-card">
                  <div className="format-header">
                    <Database size={32} />
                    <div>
                      <h3>JSON 통합 형식</h3>
                      <p>프로젝트와 성과를 분리된 구조로 저장</p>
                    </div>
                  </div>
                  
                  <div className="format-details">
                    <div className="data-structure">
                      <h4>📊 데이터 구조</h4>
                      <div className="structure-item">
                        <strong>metadata:</strong> 파일 정보 및 통계
                      </div>
                      <div className="structure-item">
                        <strong>projects:</strong> 프로젝트 목록 (성과 ID로 연결)
                      </div>
                      <div className="structure-item">
                        <strong>performances:</strong> 글로벌 성과 항목 목록
                      </div>
                    </div>

                    <div className="advantages">
                      <h4>🎯 주요 장점</h4>
                      <ul>
                        <li>데이터 정규화로 중복 제거</li>
                        <li>성과 항목 중앙 관리</li>
                        <li>관계 구조 명확화</li>
                        <li>확장성 및 유지보수성 향상</li>
                        <li>프로그래밍 언어 호환성 우수</li>
                      </ul>
                    </div>

                    <div className="use-cases">
                      <h4>📋 권장 사용 사례</h4>
                      <ul>
                        <li>시스템 간 데이터 이전</li>
                        <li>백업 및 복원</li>
                        <li>API 데이터 교환</li>
                        <li>데이터 분석 및 처리</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* 에러 메시지 */}
              {error && (
                <div className="error-message">
                  <AlertCircle size={20} />
                  <span>{error}</span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          {exportStatus === 'success' ? (
            <button className="close-btn" onClick={handleClose}>
              닫기
            </button>
          ) : (
            <>
              <button className="cancel-btn" onClick={handleClose}>
                취소
              </button>
              <button 
                className="export-btn"
                onClick={handleExport}
                disabled={isExporting || stats.totalProjects === 0}
              >
                {isExporting ? (
                  <>
                    <div className="spinner"></div>
                    저장 중...
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    JSON 저장
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .export-modal {
          background: white;
          border-radius: 1rem;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          width: 900px;
          max-height: 90vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem 2rem;
          border-bottom: 1px solid #e5e7eb;
          flex-shrink: 0;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 600;
          color: #111827;
        }

        .close-button {
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.25rem;
          color: #6b7280;
          border-radius: 0.25rem;
          transition: color 0.2s ease;
        }

        .close-button:hover {
          color: #374151;
        }

        .modal-content {
          padding: 2rem;
          flex: 1;
          overflow-y: auto;
        }

        .export-success {
          text-align: center;
          padding: 3rem 1rem;
        }

        .success-icon {
          width: 64px;
          height: 64px;
          margin: 0 auto 1rem;
          background: #10b981;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          animation: successBounce 0.6s ease-out;
        }

        .export-success h3 {
          margin: 0 0 0.5rem 0;
          font-size: 1.5rem;
          font-weight: 600;
          color: #111827;
        }

        .export-success p {
          margin: 0;
          color: #6b7280;
          font-size: 1.1rem;
        }

        .export-success small {
          color: #059669;
          font-weight: 500;
        }

        @keyframes successBounce {
          0% { transform: scale(0); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }

        .data-stats {
          background: #f9fafb;
          border-radius: 0.75rem;
          padding: 2rem;
          margin-bottom: 2rem;
        }

        .data-stats h3 {
          margin: 0 0 1.5rem 0;
          font-size: 1.1rem;
          font-weight: 600;
          color: #111827;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 1rem;
          background: white;
          border-radius: 0.5rem;
          border: 1px solid #e5e7eb;
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: #0066cc;
          margin-bottom: 0.25rem;
        }

        .stat-label {
          font-size: 0.875rem;
          color: #6b7280;
          text-align: center;
        }

        .format-explanation {
          margin-bottom: 2rem;
        }

        .format-card {
          background: #f8fafc;
          border-radius: 0.75rem;
          padding: 2rem;
          border: 1px solid #e2e8f0;
        }

        .format-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 2rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid #e2e8f0;
        }

        .format-header h3 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 600;
          color: #111827;
        }

        .format-header p {
          margin: 0;
          color: #6b7280;
          font-size: 0.875rem;
        }

        .format-details {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.5rem;
        }

        .data-structure,
        .advantages,
        .use-cases {
          background: white;
          border-radius: 0.5rem;
          padding: 1.5rem;
          border: 1px solid #e5e7eb;
        }

        .data-structure h4,
        .advantages h4,
        .use-cases h4 {
          margin: 0 0 1rem 0;
          font-size: 1rem;
          font-weight: 600;
          color: #374151;
        }

        .structure-item {
          margin-bottom: 0.75rem;
          font-size: 0.875rem;
          color: #6b7280;
        }

        .structure-item strong {
          color: #374151;
          font-weight: 600;
        }

        .advantages ul,
        .use-cases ul {
          margin: 0;
          padding-left: 1rem;
          list-style-type: disc;
        }

        .advantages li,
        .use-cases li {
          margin-bottom: 0.5rem;
          color: #6b7280;
          font-size: 0.875rem;
        }

        .error-message {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 0.5rem;
          color: #dc2626;
          margin-top: 1rem;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
          padding: 1.5rem 2rem;
          border-top: 1px solid #e5e7eb;
          flex-shrink: 0;
        }

        .cancel-btn,
        .close-btn {
          padding: 0.75rem 1.5rem;
          border: 1px solid #d1d5db;
          background: white;
          color: #374151;
          border-radius: 0.5rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .cancel-btn:hover,
        .close-btn:hover {
          background: #f9fafb;
          border-color: #9ca3af;
        }

        .export-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.5rem;
          background: #059669;
          color: white;
          border: none;
          border-radius: 0.5rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .export-btn:hover:not(:disabled) {
          background: #047857;
        }

        .export-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top: 2px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ExportDataModal;