import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, AlertTriangle, CheckCircle, X, Cloud, FileText, Activity, Lock } from 'lucide-react';
import { fetchServerData } from '../../services/settingsApi';
// 쓰기는 어댑터를 지난다 (services/dashboardWriteApi.js 머리말 참조).
import { saveManualUpsert, saveManualOverwrite } from '../../services/dashboardWriteApi';
import { getRecentLogs, logActivity, LOG_ACTIONS, TARGET_TYPES, LOG_SOURCES } from '../../utils/activityLogger';
import { useAuth } from '../../../../contexts/AuthContext';
import './ServerUploadModal.css';

const ServerUploadModal = ({
  isOpen,
  onClose,
  projects,
  performances,
  metadata,
  onUploadSuccess,
  showSuccess,
  showError
}) => {
  const { user } = useAuth();
  // Admin, Manager, DT Office만 덮어쓰기 가능
  const canOverwrite = ['admin', 'manager', 'dt_office'].includes(user?.role) || user?.is_admin;

  const [isUploading, setIsUploading] = useState(false);
  const [serverVersion, setServerVersion] = useState(0);
  const [clientVersion, setClientVersion] = useState(0);
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotDescription, setSnapshotDescription] = useState('');
  const [includeSnapshot, setIncludeSnapshot] = useState(true);
  const [includeActivityLogs, setIncludeActivityLogs] = useState(true);
  const [conflictInfo, setConflictInfo] = useState(null);
  const [activityLogs, setActivityLogs] = useState([]);
  const [uploadMode, setUploadMode] = useState('update'); // 'update' or 'overwrite'

  // 모달 열릴 때 서버 버전 확인 및 활동 로그 로드
  useEffect(() => {
    if (isOpen) {
      checkServerVersion();
      // 기본 스냅샷 이름 설정
      const now = new Date();
      setSnapshotName(`업로드 ${now.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })} ${now.toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' })}`);
      // 최근 활동 로그 로드
      const recentLogs = getRecentLogs(50);
      setActivityLogs(recentLogs);
    }
  }, [isOpen]);

  const checkServerVersion = async () => {
    try {
      const serverData = await fetchServerData();
      setServerVersion(serverData.version || 0);
      // 클라이언트 버전은 로컬 메타데이터에서 가져오거나 서버 버전과 동기화
      const storedVersion = localStorage.getItem('dashboardDataVersion');
      setClientVersion(storedVersion ? parseInt(storedVersion) : serverData.version || 0);
    } catch (error) {
      console.error('서버 버전 확인 실패:', error);
      setServerVersion(0);
      setClientVersion(0);
    }
  };

  const handleUpload = async (forceUpload = false) => {
    setIsUploading(true);
    setConflictInfo(null);

    try {
      // 삭제된 과제(_deleted: true)는 업로드에서 제외
      // 삭제는 이미 softDeleteProject/permanentDeleteProject API로 처리됨
      const activeProjects = projects.filter(p => !p._deleted);

      const uploadData = {
        version: clientVersion,
        projects: activeProjects,
        performances,
        metadata,
        forceUpload
      };

      // 스냅샷 포함 옵션
      if (includeSnapshot && snapshotName) {
        uploadData.snapshot = {
          name: snapshotName,
          description: snapshotDescription
        };
      }

      // 활동 로그 포함 옵션
      if (includeActivityLogs && activityLogs.length > 0) {
        // 최근 50개만 전송
        uploadData.activityLogs = activityLogs.slice(0, 50).map(log => ({
          action: log.action,
          targetType: log.targetType,
          targetId: log.targetId,
          targetName: log.targetName,
          changes: log.changes,
          summary: log.summary
        }));
      }

      let result;
      if (uploadMode === 'update') {
        // 업데이트 모드: UUID 기준으로 기존 데이터 업데이트 또는 신규 추가
        result = await saveManualUpsert(uploadData);

        // 재번호 부여된 성과가 있는지 확인
        if (result.renumbered_performances && result.renumbered_performances.length > 0) {
          const renumberedList = result.renumbered_performances
            .map(p => `• ${p.old_id} → ${p.new_id} (${p.name})`)
            .join('\n');

          // 알림 표시 (alert 사용)
          alert(
            `⚠️ 성과 ID 충돌로 인해 다음 성과들의 ID가 변경되었습니다:\n\n${renumberedList}\n\n` +
            `해당 성과를 사용하는 과제의 "과제-성과 연결"을 확인해주세요.`
          );

          showSuccess(`서버에 데이터가 업데이트되었습니다. (v${result.version}) - ${result.renumbered_performances.length}개 성과 ID 변경됨`);
        } else {
          showSuccess(`서버에 데이터가 업데이트되었습니다. (v${result.version})`);
        }
      } else {
        // 덮어쓰기 모드: 기존 방식대로 전체 데이터 교체
        result = await saveManualOverwrite(uploadData);
        showSuccess(`서버에 데이터가 업로드되었습니다. (v${result.version})`);
      }

      // 새 버전 반영 (localStorage 기록은 어댑터가 이미 했다)
      setClientVersion(result.version);
      setServerVersion(result.version);

      // 상세 로그 기록
      const uploadedProjectNames = activeProjects.map(p => p.과제명).filter(Boolean);
      const uploadedPerformanceNames = performances.map(p => p.성과항목).filter(Boolean);

      logActivity({
        action: LOG_ACTIONS.SERVER_UPLOAD,
        targetType: TARGET_TYPES.PROJECT,
        targetName: `서버 ${uploadMode === 'update' ? '업데이트' : '덮어쓰기'} (v${result.version})`,
        changes: {
          version: { before: clientVersion, after: result.version },
          projectCount: { before: null, after: activeProjects.length },
          performanceCount: { before: null, after: performances.length },
          uploadedProjects: { before: null, after: uploadedProjectNames },
          uploadedPerformances: { before: null, after: uploadedPerformanceNames },
          uploadMode: { before: null, after: uploadMode },
          includeSnapshot: { before: null, after: includeSnapshot },
          snapshotName: includeSnapshot ? { before: null, after: snapshotName } : undefined
        },
        metadata: {
          source: LOG_SOURCES.MODAL,
          uploadMode,
          hasSnapshot: includeSnapshot,
          snapshotName: includeSnapshot ? snapshotName : null
        }
      });

      if (onUploadSuccess) {
        onUploadSuccess(result);
      }

      onClose();

    } catch (error) {
      if (error.conflict) {
        // 버전 충돌 발생
        setConflictInfo(error.conflictData);
      } else {
        showError(`업로드 실패: ${error.message}`);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleForceUpload = () => {
    handleUpload(true);
  };

  const handleRefreshFromServer = async () => {
    try {
      const serverData = await fetchServerData();
      // 버전 동기화
      localStorage.setItem('dashboardDataVersion', serverData.version.toString());
      setClientVersion(serverData.version);
      setServerVersion(serverData.version);
      setConflictInfo(null);
      showSuccess('서버 버전과 동기화되었습니다. 다시 업로드해주세요.');
    } catch (error) {
      showError(`동기화 실패: ${error.message}`);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="server-upload-modal-overlay"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="server-upload-modal"
        >
          <div className="modal-header">
            <div className="header-title">
              <Cloud size={24} />
              <h2>서버 업로드</h2>
            </div>
            <button onClick={onClose} className="close-btn">
              <X size={20} />
            </button>
          </div>

          <div className="modal-content">
            {/* 충돌 경고 */}
            {conflictInfo && (
              <div className="conflict-warning">
                <AlertTriangle size={24} />
                <div className="conflict-info">
                  <h4>버전 충돌 발생</h4>
                  <p>다른 사용자가 데이터를 수정했습니다.</p>
                  <div className="conflict-details">
                    <span>서버 버전: v{conflictInfo.server_version}</span>
                    <span>내 버전: v{conflictInfo.client_version}</span>
                    {conflictInfo.last_modified_by && (
                      <span>마지막 수정: {conflictInfo.last_modified_by}</span>
                    )}
                  </div>
                  <div className="conflict-actions">
                    <button onClick={handleRefreshFromServer} className="refresh-btn">
                      서버 데이터로 새로고침
                    </button>
                    <button onClick={handleForceUpload} className="force-btn">
                      강제 덮어쓰기
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 업로드 데이터 요약 */}
            <div className="upload-summary">
              <h3>업로드할 데이터</h3>
              <div className="summary-items">
                <div className="summary-item">
                  <FileText size={18} />
                  <span>프로젝트: {projects.length}개</span>
                </div>
                <div className="summary-item">
                  <Activity size={18} />
                  <span>성과: {performances.length}개</span>
                </div>
              </div>
              <div className="version-info">
                <span>현재 버전: v{clientVersion}</span>
                <span>서버 버전: v{serverVersion}</span>
              </div>
            </div>

            {/* 업로드 모드 선택 */}
            <div className="upload-mode-section">
              <h3>저장 방식</h3>
              <div className="upload-mode-options">
                <label className={`mode-option ${uploadMode === 'update' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="uploadMode"
                    value="update"
                    checked={uploadMode === 'update'}
                    onChange={(e) => setUploadMode(e.target.value)}
                  />
                  <div className="mode-info">
                    <span className="mode-title">업데이트하기</span>
                    <span className="mode-desc">UUID 기준으로 기존 데이터 업데이트 또는 신규 추가</span>
                  </div>
                </label>
                <label className={`mode-option ${uploadMode === 'overwrite' ? 'selected' : ''} ${!canOverwrite ? 'disabled' : ''}`}>
                  <input
                    type="radio"
                    name="uploadMode"
                    value="overwrite"
                    checked={uploadMode === 'overwrite'}
                    onChange={(e) => canOverwrite && setUploadMode(e.target.value)}
                    disabled={!canOverwrite}
                  />
                  <div className="mode-info">
                    <span className="mode-title">
                      덮어쓰기
                      {!canOverwrite && <Lock size={14} style={{ marginLeft: '0.5rem', color: '#9ca3af' }} />}
                    </span>
                    <span className="mode-desc">기존 데이터를 삭제하고 새 데이터로 교체</span>
                    {!canOverwrite && (
                      <span className="mode-restricted">관리자 권한이 필요합니다</span>
                    )}
                  </div>
                </label>
              </div>
            </div>

            {/* 옵션 */}
            <div className="upload-options">
              <h3>추가 옵션</h3>

              {/* 스냅샷 옵션 */}
              <div className="option-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={includeSnapshot}
                    onChange={(e) => setIncludeSnapshot(e.target.checked)}
                  />
                  <span>스냅샷 생성</span>
                </label>

                {includeSnapshot && (
                  <div className="snapshot-fields">
                    <input
                      type="text"
                      placeholder="스냅샷 이름"
                      value={snapshotName}
                      onChange={(e) => setSnapshotName(e.target.value)}
                      className="snapshot-name-input"
                    />
                    <textarea
                      placeholder="설명 (선택사항)"
                      value={snapshotDescription}
                      onChange={(e) => setSnapshotDescription(e.target.value)}
                      className="snapshot-desc-input"
                      rows={2}
                    />
                  </div>
                )}
              </div>

              {/* 활동 로그 옵션 */}
              <div className="option-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={includeActivityLogs}
                    onChange={(e) => setIncludeActivityLogs(e.target.checked)}
                  />
                  <span>최근 활동 로그 포함 ({activityLogs.length}개)</span>
                </label>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button onClick={onClose} className="cancel-btn" disabled={isUploading}>
              취소
            </button>
            <button
              onClick={() => handleUpload(false)}
              className="upload-btn"
              disabled={isUploading || conflictInfo}
            >
              {isUploading ? (
                <>
                  <span className="spinner" />
                  업로드 중...
                </>
              ) : (
                <>
                  <Upload size={18} />
                  서버에 업로드
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ServerUploadModal;
