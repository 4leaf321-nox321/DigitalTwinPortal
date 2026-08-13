import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { X, Clock, User, Calendar, Filter, Loader2, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchActivityLogs } from '../../services/settingsApi';
// LOG_ACTIONS 는 일부러 안 쓴다 — 서버가 적는 값과 어긋나 있다. 아래 ACTION_META 참조.
import { TARGET_TYPES } from '../../utils/activityLogger';
// 값 표시 규칙은 **과제 편집창의 변경 이력 탭과 공용**이다. 복제하면 한쪽만 고쳐진다.
import {
  toChangeEntry, describeValue, rawText, isHiddenField,
} from '../../utils/changeFormat';

const ITEMS_PER_PAGE = 20;

// 한 로그에서 접지 않고 바로 보여줄 변경 항목 수
const CHANGE_PREVIEW_COUNT = 5;

/**
 * 활동로그 `action` — **코드가 실제로 적는 값** 기준. 필터·라벨·색이 전부 여기서 나온다.
 *
 * ⚠️ `utils/activityLogger.js` 의 `LOG_ACTIONS` 를 그대로 쓰면 안 된다. 두 곳이 어긋나 있다.
 *      상수에만 있고 아무도 안 쓰는 값   `SERVER_SYNC` · `BULK_DELETE` · `IMPORT`
 *                                        → 필터에 두면 **항상 빈 결과**가 나와
 *                                          사용자는 "로그가 없다" 고 오해한다
 *      서버만 쓰고 상수에 없는 값        `DOWNLOAD` · `UPSERT` · `PERMANENT_DELETE` ·
 *                                        `RESTORE` · `UPLOAD` · `EXPORT`
 *                                        → **필터로 고를 수가 없었다**
 *    2026-07-31 개발 DB 실측 기준 전체 로그의 약 86% 가 필터 불가였다.
 *
 * 목록 근거 — 백엔드 `routes.py`/`routes_v2.py` 의 `action='...'` 과
 *            프론트 `logActivity({ action: LOG_ACTIONS.* })` 호출부를 모두 훑은 합집합이다.
 *            action 은 데이터가 아니라 **코드가 정하는 값**이라 운영도 같은 집합이 나온다.
 */
const ACTION_META = {
  CREATE: { label: '생성', color: '#10b981' },
  UPDATE: { label: '수정', color: '#3b82f6' },
  DELETE: { label: '삭제', color: '#ef4444' },
  RESTORE: { label: '복구', color: '#22c55e' },
  PERMANENT_DELETE: { label: '영구 삭제', color: '#b91c1c' },
  BULK_CREATE: { label: '대량 생성', color: '#10b981' },
  BULK_UPDATE: { label: '대량 수정', color: '#3b82f6' },
  UPSERT: { label: '저장', color: '#6366f1' },
  UPLOAD: { label: '업로드', color: '#06b6d4' },
  SERVER_UPLOAD: { label: '서버 업로드', color: '#06b6d4' },
  DOWNLOAD: { label: '다운로드', color: '#14b8a6' },
  SERVER_DOWNLOAD: { label: '서버 다운로드', color: '#14b8a6' },
  EXPORT: { label: '내보내기', color: '#f59e0b' },
};

// 다운로드 로그의 `changes` 는 요약 문장과 같은 내용이라 목록으로 다시 그리지 않는다.
const DOWNLOAD_ACTION = 'DOWNLOAD';

/**
 * `changes` 를 화면에 그릴 목록으로 바꾼다.
 *
 * ⚠️ **`changes` 는 모양이 한 가지가 아니다.** 개발 DB 최근 3000건 실측:
 *      diff   255건  `{ 과제명: { before, after }, ... }`      필드별 변경
 *      plain 1616건  `{ version, projectCount, source }`       그냥 값들 (대부분 다운로드)
 *      mixed  322건  `{ version: {before,after}, projectCount: 332 }`  **한 객체에 섞여 있다**
 *      none   807건  `null`
 *    그래서 객체 전체를 한 모양으로 가정하면 안 되고, **항목마다 따로** 판정한다.
 *    (한쪽만 가정하고 그리면 다른 쪽에서 `[object Object]` 가 찍힌다)
 *
 * 무엇을 보여줄지
 *    변경(before/after) 항목이 하나라도 있으면 **그것만** 보여준다. 같이 실린 일반값
 *    (`projectCount` 등)은 맥락일 뿐 변경이 아니다.
 *    변경이 하나도 없으면 일반값을 보여주되 **다운로드 로그는 제외**한다 —
 *    거기 실린 숫자는 요약 문장에 이미 그대로 들어 있어(`v730, 과제 227개…`)
 *    그리면 절반이 넘는 로그에 같은 내용이 두 번 나온다.
 *    (실측: 변경이 하나도 없는 로그는 DOWNLOAD 1616건뿐이고, UPSERT·UPDATE·CREATE·
 *     BULK_* · DELETE · SERVER_UPLOAD 는 전부 변경 항목을 갖고 있다)
 */
const toChangeEntries = (changes, action) => {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return [];

  const isDiffValue = (value) =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
    && ('before' in value || 'after' in value);

  const all = Object.entries(changes).filter(([key]) => key !== 'source');
  // 서버가 만드는 사본(담당자·관리자 등)은 뺀다 — 화면에 없는 칸이라 헷갈리기만
  // 한다. 왜 그런지는 `changeFormat.js` 의 HIDDEN_FIELDS 머리말에 적어 뒀다.
  const pairs = all.filter(([key]) => !isHiddenField(key));

  // ⚠️ **어느 갈래로 갈지는 감추기 전 기준으로 정한다.** 감춘 뒤에 세면, 사본만
  //    바뀐 로그가 "변경이 하나도 없는 로그" 로 넘어가 `projectCount` 같은 맥락
  //    숫자가 대신 나온다 — 감춘 자리에 엉뚱한 것이 들어차는 꼴이다.
  const hasDiff = all.some(([, value]) => isDiffValue(value));

  // 값 표시 규칙은 utils/changeFormat.js 공용 — 배열이면 원소 단위로 펼쳐 준다
  if (hasDiff) {
    return pairs.filter(([, value]) => isDiffValue(value))
      .map(([key, value]) => toChangeEntry(key, value.before, value.after));
  }

  if (action === DOWNLOAD_ACTION) return [];

  return pairs.map(([key, value]) => ({
    key, value: describeValue(value), valueRaw: rawText(value),
  }));
};

/** 로그 한 건의 "무엇이 뭐에서 뭐로 바뀌었나". 데이터는 이미 `changes` 에 들어 있다. */
const LogChanges = ({ changes, action }) => {
  const [expanded, setExpanded] = useState(false);
  const entries = useMemo(() => toChangeEntries(changes, action), [changes, action]);

  if (entries.length === 0) return null;

  const shown = expanded ? entries : entries.slice(0, CHANGE_PREVIEW_COUNT);
  const hidden = entries.length - shown.length;

  return (
    <ChangeList>
      {shown.map(entry => (
        <ChangeRow key={entry.key}>
          <ChangeField>{entry.key}</ChangeField>
          {entry.details ? (
            <ChangeBody>
              <ListSummary>{entry.summary}</ListSummary>
              {entry.details.map((detail, index) => (
                <DetailRow key={`${detail.sign}${detail.label}${index}`}>
                  <DetailSign>{detail.sign}</DetailSign>
                  <DetailLabel>{detail.label}</DetailLabel>
                  {detail.before !== undefined && (
                    <span>
                      <BeforeValue title={detail.beforeRaw}>{detail.before}</BeforeValue>
                      <Arrow>→</Arrow>
                      <AfterValue title={detail.afterRaw}>{detail.after}</AfterValue>
                    </span>
                  )}
                </DetailRow>
              ))}
            </ChangeBody>
          ) : entry.before !== undefined ? (
            <ValueBody>
              <BeforeValue title={entry.beforeRaw}>{entry.before}</BeforeValue>
              <Arrow>→</Arrow>
              <AfterValue title={entry.afterRaw}>{entry.after}</AfterValue>
            </ValueBody>
          ) : (
            <ValueBody title={entry.valueRaw}>{entry.value}</ValueBody>
          )}
        </ChangeRow>
      ))}
      {(hidden > 0 || expanded) && (
        <ChangeToggle type="button" onClick={() => setExpanded(prev => !prev)}>
          {expanded ? '접기' : `${hidden}개 더 보기`}
        </ChangeToggle>
      )}
    </ChangeList>
  );
};

const ActivityLogModal = ({ isOpen, onClose }) => {
  const [filterAction, setFilterAction] = useState('ALL');
  const [filterTargetType, setFilterTargetType] = useState('ALL');
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  // DB에서 로그 가져오기
  const loadLogs = useCallback(async () => {
    if (!isOpen) return;

    setIsLoading(true);
    try {
      const options = {
        limit: ITEMS_PER_PAGE,
        offset: (currentPage - 1) * ITEMS_PER_PAGE
      };
      if (filterAction !== 'ALL') {
        options.action = filterAction;
      }
      if (filterTargetType !== 'ALL') {
        options.targetType = filterTargetType;
      }

      const response = await fetchActivityLogs(options);
      const logsArray = Array.isArray(response) ? response : (response.logs || []);
      const total = response.total || logsArray.length;

      // API 응답 형식을 컴포넌트에서 사용하는 형식으로 변환
      const formattedLogs = logsArray.map(log => ({
        logId: log.id,
        action: log.action,
        targetType: log.target_type,
        targetId: log.target_id,
        targetName: log.target_name,
        timestamp: log.created_at,
        userName: log.user_name || '알 수 없음',
        sentence: log.summary || `${log.target_name || '항목'}을(를) ${log.action}했습니다.`,
        metadata: log.changes
      }));

      setLogs(formattedLogs);
      setTotalCount(total);
    } catch (error) {
      console.error('활동 로그 로드 실패:', error);
      setLogs([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, filterAction, filterTargetType, currentPage]);

  // 다운로드 (현재 필터 적용 상태로 전체 로그)
  const handleExport = useCallback(async (format) => {
    setIsExporting(true);
    try {
      const options = { limit: 10000, offset: 0 };
      if (filterAction !== 'ALL') options.action = filterAction;
      if (filterTargetType !== 'ALL') options.targetType = filterTargetType;

      const response = await fetchActivityLogs(options);
      const logsArray = Array.isArray(response) ? response : (response.logs || []);

      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
      const filterPart = [
        filterAction !== 'ALL' ? filterAction : null,
        filterTargetType !== 'ALL' ? filterTargetType : null
      ].filter(Boolean).join('_');
      const baseName = `activity-logs_${stamp}${filterPart ? `_${filterPart}` : ''}`;

      let blob;
      let filename;

      if (format === 'json') {
        blob = new Blob([JSON.stringify(logsArray, null, 2)], { type: 'application/json' });
        filename = `${baseName}.json`;
      } else {
        const escapeCSV = (val) => {
          if (val === null || val === undefined) return '';
          const s = typeof val === 'object' ? JSON.stringify(val) : String(val);
          return `"${s.replace(/"/g, '""')}"`;
        };
        const headers = ['시간', '사용자', '액션', '대상유형', '대상', '요약', '변경내용'];
        const rows = logsArray.map(log => [
          log.created_at || '',
          log.user_name || '',
          log.action || '',
          log.target_type || '',
          log.target_name || '',
          log.summary || '',
          log.changes ? JSON.stringify(log.changes) : ''
        ].map(escapeCSV).join(','));
        const BOM = String.fromCharCode(0xFEFF);
        const csv = BOM + [headers.map(escapeCSV).join(','), ...rows].join('\r\n');
        blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        filename = `${baseName}.csv`;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('로그 다운로드 실패:', error);
      alert('로그 다운로드에 실패했습니다.');
    } finally {
      setIsExporting(false);
    }
  }, [filterAction, filterTargetType]);

  // 모달 열릴 때, 필터 변경 시 로그 로드
  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // 필터 변경 시 첫 페이지로 이동
  useEffect(() => {
    setCurrentPage(1);
  }, [filterAction, filterTargetType]);

  // 날짜 포맷팅
  const formatDate = (isoString) => {
    // 백엔드에서 UTC로 저장되므로, timezone 정보가 없으면 UTC로 파싱
    let dateStr = isoString;
    if (dateStr && !dateStr.endsWith('Z') && !dateStr.includes('+')) {
      dateStr = dateStr + 'Z';
    }
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;

    return date.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 액션 타입별 색상
  // 색·라벨 모두 ACTION_META 한 곳에서 — 모르는 값이 와도 회색 + 원문으로 떨어진다
  const getActionColor = (action) => ACTION_META[action]?.color || '#6b7280';

  const getActionLabel = (action) => ACTION_META[action]?.label || action;

  // 대상 타입 한글 레이블
  const getTargetTypeLabel = (targetType) => {
    switch (targetType) {
      case TARGET_TYPES.PROJECT: return '과제';
      case TARGET_TYPES.PERFORMANCE: return '성과';
      case TARGET_TYPES.ACTION_ITEM: return '액션 아이템';
      case TARGET_TYPES.TEAM_MEMBER: return '팀 멤버';
      case TARGET_TYPES.SETTINGS: return '설정';
      default: return targetType;
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <Overlay
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <ModalContainer
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <Header>
            <HeaderTitle>
              <Clock size={24} />
              <span>로그 기록</span>
            </HeaderTitle>
            <CloseButton onClick={onClose}>
              <X size={24} />
            </CloseButton>
          </Header>

          <FilterSection>
            <FilterGroup>
              <FilterLabel>
                <Filter size={16} />
                <span>액션 유형</span>
              </FilterLabel>
              <Select value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
                <option value="ALL">전체</option>
                {Object.entries(ACTION_META).map(([value, meta]) => (
                  <option key={value} value={value}>{meta.label}</option>
                ))}
              </Select>
            </FilterGroup>

            <FilterGroup>
              <FilterLabel>
                <Filter size={16} />
                <span>대상 유형</span>
              </FilterLabel>
              <Select value={filterTargetType} onChange={(e) => setFilterTargetType(e.target.value)}>
                <option value="ALL">전체</option>
                <option value={TARGET_TYPES.PROJECT}>과제</option>
                <option value={TARGET_TYPES.ACTION_ITEM}>액션 아이템</option>
                <option value={TARGET_TYPES.PERFORMANCE}>성과</option>
              </Select>
            </FilterGroup>

            <FilterGroup>
              <TotalCount>총 {totalCount}개의 로그</TotalCount>
            </FilterGroup>

            <DownloadGroup>
              <FilterLabel>
                <Download size={16} />
                <span>다운로드</span>
              </FilterLabel>
              <DownloadButtons>
                <DownloadButton
                  type="button"
                  onClick={() => handleExport('csv')}
                  disabled={isExporting || totalCount === 0}
                  title="CSV로 다운로드 (엑셀에서 열기)"
                >
                  {isExporting ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
                  CSV
                </DownloadButton>
                <DownloadButton
                  type="button"
                  onClick={() => handleExport('json')}
                  disabled={isExporting || totalCount === 0}
                  title="JSON으로 다운로드"
                >
                  {isExporting ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
                  JSON
                </DownloadButton>
              </DownloadButtons>
            </DownloadGroup>
          </FilterSection>

          <LogList>
            {isLoading ? (
              <EmptyState>
                <Loader2 size={48} className="spin" />
                <p>로그를 불러오는 중...</p>
              </EmptyState>
            ) : logs.length === 0 ? (
              <EmptyState>
                <Clock size={48} />
                <p>활동 기록이 없습니다.</p>
              </EmptyState>
            ) : (
              logs.map((log) => (
                <LogItem key={log.logId}>
                  <LogHeader>
                    <ActionBadge color={getActionColor(log.action)}>
                      {getActionLabel(log.action)}
                    </ActionBadge>
                    <TargetTypeBadge>
                      {getTargetTypeLabel(log.targetType)}
                    </TargetTypeBadge>
                    <TimeStamp>
                      <Calendar size={14} />
                      {formatDate(log.timestamp)}
                    </TimeStamp>
                  </LogHeader>
                  <LogMessage>{log.sentence}</LogMessage>
                  <LogChanges changes={log.metadata} action={log.action} />
                  <LogMeta>
                    <UserInfo>
                      <User size={14} />
                      {log.userName}
                    </UserInfo>
                    {log.metadata?.source && (
                      <SourceInfo>
                        출처: {log.metadata.source}
                      </SourceInfo>
                    )}
                  </LogMeta>
                </LogItem>
              ))
            )}
          </LogList>

          {totalPages > 1 && (
            <Pagination>
              <PageButton
                onClick={() => setCurrentPage(prev => prev - 1)}
                disabled={currentPage === 1 || isLoading}
              >
                <ChevronLeft size={16} />
              </PageButton>

              {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
                let page;
                if (totalPages <= 10) {
                  page = i + 1;
                } else if (currentPage <= 5) {
                  page = i + 1;
                } else if (currentPage >= totalPages - 4) {
                  page = totalPages - 9 + i;
                } else {
                  page = currentPage - 4 + i;
                }
                return (
                  <PageButton
                    key={page}
                    active={currentPage === page}
                    onClick={() => setCurrentPage(page)}
                    disabled={isLoading}
                  >
                    {page}
                  </PageButton>
                );
              })}

              <PageButton
                onClick={() => setCurrentPage(prev => prev + 1)}
                disabled={currentPage === totalPages || isLoading}
              >
                <ChevronRight size={16} />
              </PageButton>

              <PageInfo>
                {currentPage} / {totalPages} 페이지
              </PageInfo>
            </Pagination>
          )}
        </ModalContainer>
      </Overlay>
    </AnimatePresence>
  );
};

export default ActivityLogModal;

// Styled Components
const Overlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 2rem;

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .spin {
    animation: spin 1s linear infinite;
  }
`;

const ModalContainer = styled(motion.div)`
  background: white;
  border-radius: 1rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 80vw;
  height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem 2rem;
  border-bottom: 2px solid #e5e7eb;
  background: linear-gradient(135deg, #0066cc 0%, #0052a3 100%);
  color: white;
`;

const HeaderTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 1.5rem;
  font-weight: 700;
`;

const CloseButton = styled.button`
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 0.5rem;
  padding: 0.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  transition: background 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.3);
  }
`;

const FilterSection = styled.div`
  display: flex;
  gap: 1rem;
  padding: 1.5rem 2rem;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
  flex-wrap: wrap;
`;

const FilterGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
  min-width: 150px;
`;

const DownloadGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 180px;
`;

const DownloadButtons = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const DownloadButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background: white;
  color: #374151;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    border-color: #0066cc;
    color: #0066cc;
    background: #eff6ff;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const FilterLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
`;

const Select = styled.select`
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  color: #374151;
  background: white;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: #9ca3af;
  }

  &:focus {
    outline: none;
    border-color: #0066cc;
    box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.1);
  }
`;

const LogList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem 2rem;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  color: #9ca3af;
  gap: 1rem;

  svg {
    opacity: 0.5;
  }

  p {
    font-size: 1.125rem;
    font-weight: 500;
  }
`;

const LogItem = styled.div`
  padding: 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  margin-bottom: 1rem;
  transition: all 0.2s;
  background: white;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    border-color: #d1d5db;
  }

  &:last-child {
    margin-bottom: 0;
  }
`;

const LogHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
`;

const ActionBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.625rem;
  background: ${props => props.color};
  color: white;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
`;

const TargetTypeBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.625rem;
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
`;

const TimeStamp = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: #6b7280;
  font-size: 0.8125rem;
  margin-left: auto;
`;

const LogMessage = styled.p`
  font-size: 0.9375rem;
  color: #1f2937;
  line-height: 1.6;
  margin-bottom: 0.75rem;
`;

const LogMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.8125rem;
  color: #6b7280;
`;

const UserInfo = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
`;

const SourceInfo = styled.span`
  font-size: 0.75rem;
  color: #9ca3af;
`;

const ChangeList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin-bottom: 0.75rem;
  padding: 0.625rem 0.75rem;
  background: #f9fafb;
  border: 1px solid #f3f4f6;
  border-radius: 0.375rem;
`;

const ChangeRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  font-size: 0.8125rem;
  line-height: 1.5;
`;

const ChangeField = styled.span`
  flex: 0 0 auto;
  min-width: 7rem;
  color: #374151;
  font-weight: 600;
`;

const ChangeBody = styled.span`
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  color: #6b7280;
  min-width: 0;
  word-break: break-all;
`;

/*
  값 한 쌍(전 → 후)을 담는 자리. **한 줄로 흐른다.**
  `ChangeBody` 는 세로 flex 라 전·화살표·후가 각각 한 줄을 차지했다.
  (편집창 변경 이력의 `ValueBody` 와 같은 이유 — 두 화면이 같은 규칙을 쓴다)
*/
const ValueBody = styled.span`
  min-width: 0;
  color: #6b7280;
  overflow-wrap: anywhere;
`;

const ListSummary = styled.span`
  color: #4b5563;
`;

const DetailRow = styled.span`
  display: flex;
  align-items: baseline;
  gap: 0.375rem;
  padding-left: 0.5rem;
`;

const DetailSign = styled.span`
  flex: 0 0 auto;
  width: 0.75rem;
  color: #9ca3af;
`;

const DetailLabel = styled.span`
  flex: 0 0 auto;
  color: #6b7280;
`;

const BeforeValue = styled.span`
  color: #9ca3af;
  text-decoration: line-through;
`;

const Arrow = styled.span`
  margin: 0 0.25rem;
  color: #9ca3af;
`;

const AfterValue = styled.span`
  color: #1f2937;
  font-weight: 500;
`;

const ChangeToggle = styled.button`
  align-self: flex-start;
  padding: 0;
  border: none;
  background: none;
  color: #2563eb;
  font-size: 0.75rem;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
`;

const TotalCount = styled.span`
  display: flex;
  align-items: center;
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  height: 100%;
  padding-top: 1.5rem;
`;

const Pagination = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 2rem;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
`;

const PageButton = styled.button`
  background: ${props => props.active ? '#0066cc' : 'white'};
  color: ${props => props.active ? 'white' : '#374151'};
  border: 1px solid ${props => props.active ? '#0066cc' : '#e5e7eb'};
  border-radius: 0.375rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background: ${props => props.active ? '#0052a3' : '#f3f4f6'};
    border-color: ${props => props.active ? '#0052a3' : '#d1d5db'};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const PageInfo = styled.span`
  color: #6b7280;
  font-size: 0.875rem;
  padding: 0 0.5rem;
  margin-left: 0.5rem;
`;
