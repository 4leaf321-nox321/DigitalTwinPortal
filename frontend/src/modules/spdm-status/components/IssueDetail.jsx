import React, { useState } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Edit2,
  Trash2,
  User,
  Calendar,
  Clock,
  MessageSquare,
  FileText,
  ArrowRightCircle,
  Paperclip,
  ChevronDown,
  Target,
  Download
} from 'lucide-react';
import { ISSUE_STATUS } from '../data/sampleData';
import CommentForm from './CommentForm';

const DetailContainer = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
`;

const DetailHeader = styled.div`
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #e2e8f0;
  background: white;
`;

const HeaderTop = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
`;

const BadgeGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const GroupBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: ${props => props.$color}15;
  color: ${props => props.$color};
  border-radius: 9999px;
  font-size: 0.8125rem;
  font-weight: 500;

  &::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${props => props.$color};
  }
`;

const StatusDropdown = styled.div`
  position: relative;
`;

const StatusButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: ${props => props.$color}20;
  color: ${props => props.$color};
  border: 1px solid ${props => props.$color}40;
  border-radius: 9999px;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.$color}30;
  }
`;

const StatusMenu = styled(motion.div)`
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 0.25rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  z-index: 100;
  min-width: 140px;
  overflow: hidden;
`;

const StatusOption = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  background: ${props => props.$active ? '#f1f5f9' : 'transparent'};
  border: none;
  font-size: 0.875rem;
  color: #1e293b;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: #f1f5f9;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${props => props.$color};
  }
`;

const ActionButtons = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ActionButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: transparent;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
    color: #1e293b;
  }

  &.delete:hover {
    border-color: #fecaca;
    color: #ef4444;
    background: #fef2f2;
  }
`;

const IssueTitle = styled.h2`
  font-size: 1.375rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 1rem 0;
  line-height: 1.4;
`;

const MetaRow = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 1.5rem;
  font-size: 0.875rem;
  color: #64748b;

  .meta-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }
`;

const DepartmentTags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1rem;
`;

const DepartmentTag = styled.span`
  padding: 0.25rem 0.625rem;
  background: ${props => props.$color}15;
  color: ${props => props.$color};
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 500;
`;

const DetailContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
`;

const Section = styled.section`
  margin-bottom: 2rem;

  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionTitle = styled.h3`
  font-size: 0.875rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 1rem 0;
`;

const Description = styled.div`
  font-size: 0.9375rem;
  color: #374151;
  line-height: 1.7;
  background: #f8fafc;
  padding: 1rem;
  border-radius: 0.5rem;
  border: 1px solid #e2e8f0;

  /* Rich text content styles */
  p {
    margin-bottom: 0.5rem;
    &:last-child {
      margin-bottom: 0;
    }
  }

  h1, h2, h3 {
    margin-bottom: 0.5rem;
    font-weight: 600;
    color: #1e293b;
  }

  h1 { font-size: 1.5rem; }
  h2 { font-size: 1.25rem; }
  h3 { font-size: 1.125rem; }

  ul, ol {
    padding-left: 1.5rem;
    margin-bottom: 0.5rem;
  }

  li {
    margin-bottom: 0.25rem;
  }

  strong {
    font-weight: 600;
  }

  em {
    font-style: italic;
  }

  u {
    text-decoration: underline;
  }

  s {
    text-decoration: line-through;
  }

  a {
    color: #8b5cf6;
    text-decoration: underline;
    &:hover {
      color: #7c3aed;
    }
  }
`;

const Timeline = styled.div`
  position: relative;
  padding-left: 1.5rem;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 2px;
    background: #e2e8f0;
  }
`;


const TimelineContent = styled.div`
  background: ${props => props.$type === 'comment' ? '#f8fafc' : 'transparent'};
  border: ${props => props.$type === 'comment' ? '1px solid #e2e8f0' : 'none'};
  border-radius: 0.5rem;
  padding: ${props => props.$type === 'comment' ? '0.875rem' : '0'};
`;

const TimelineMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.375rem;
  font-size: 0.8125rem;

  .author {
    font-weight: 600;
    color: #1e293b;
  }

  .dept {
    padding: 0.125rem 0.5rem;
    background: ${props => props.$color}15;
    color: ${props => props.$color};
    border-radius: 0.25rem;
    font-size: 0.6875rem;
    font-weight: 500;
  }

  .time {
    color: #94a3b8;
    margin-left: auto;
  }

  .delete-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    background: transparent;
    border: none;
    border-radius: 0.25rem;
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.2s ease;
    opacity: 0;

    &:hover {
      background: #fef2f2;
      color: #ef4444;
    }
  }
`;

const TimelineItemWrapper = styled(motion.div)`
  position: relative;
  padding-bottom: 1.5rem;

  &:last-child {
    padding-bottom: 0;
  }

  &::before {
    content: '';
    position: absolute;
    left: -1.5rem;
    top: 0.25rem;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: ${props => {
      switch (props.$type) {
        case 'created': return '#10b981';
        case 'status-change': return '#f59e0b';
        case 'comment': return props.$deptColor || '#3b82f6';
        default: return '#94a3b8';
      }
    }};
    border: 2px solid white;
    box-shadow: 0 0 0 2px #e2e8f0;
    transform: translateX(-5px);
  }

  &:hover .delete-btn {
    opacity: 1;
  }
`;

const TimelineText = styled.div`
  font-size: 0.9375rem;
  color: ${props => props.$type === 'status-change' ? '#64748b' : '#374151'};
  line-height: 1.6;
  font-style: ${props => props.$type === 'status-change' ? 'italic' : 'normal'};
`;

const Attachment = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.5rem;
  padding: 0.375rem 0.625rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  color: #3b82f6;
  cursor: pointer;

  &:hover {
    background: #eff6ff;
    border-color: #3b82f6;
  }
`;

const CommentAttachments = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-top: 0.5rem;
`;

const CommentAttachmentItem = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.625rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  color: #3b82f6;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #eff6ff;
    border-color: #3b82f6;
  }

  .file-name {
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const EmptyState = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  text-align: center;
  color: #94a3b8;

  svg {
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  h3 {
    font-size: 1.125rem;
    font-weight: 600;
    color: #64748b;
    margin: 0 0 0.5rem 0;
  }

  p {
    font-size: 0.9375rem;
    margin: 0;
  }
`;

const AttachmentList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const AttachmentItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  transition: all 0.2s ease;

  &:hover {
    border-color: #8b5cf6;
    background: #faf5ff;
  }

  .file-icon {
    color: #8b5cf6;
    flex-shrink: 0;
  }

  .file-info {
    flex: 1;
    min-width: 0;

    .file-name {
      font-size: 0.875rem;
      font-weight: 500;
      color: #1e293b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .file-size {
      font-size: 0.75rem;
      color: #94a3b8;
    }
  }

  .download-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: #8b5cf6;
    border: none;
    border-radius: 0.375rem;
    color: white;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;

    &:hover {
      background: #7c3aed;
      transform: translateY(-1px);
    }
  }

  .delete-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 0.375rem;
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;

    &:hover {
      background: #fee2e2;
      border-color: #fecaca;
      color: #ef4444;
    }
  }
`;

const NoAttachments = styled.div`
  padding: 1rem;
  background: #f8fafc;
  border: 1px dashed #e2e8f0;
  border-radius: 0.5rem;
  text-align: center;
  color: #94a3b8;
  font-size: 0.875rem;
`;

const IssueDetail = ({
  issue,
  history,
  groups = [],
  departments = [],
  currentUser,
  onClose,
  onEdit,
  onDelete,
  onStatusChange,
  onAddComment,
  onDeleteHistory,
  onDownloadAttachment,
  onDeleteAttachment
}) => {
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!issue) {
    return (
      <DetailContainer>
        <EmptyState>
          <FileText size={64} />
          <h3>이슈를 선택해주세요</h3>
          <p>좌측 목록에서 이슈를 선택하면 상세 내용을 확인할 수 있습니다.</p>
        </EmptyState>
      </DetailContainer>
    );
  }

  const group = groups.find(g => g.id === issue.groupId);
  const status = ISSUE_STATUS.find(s => s.id === issue.status);
  const issueDepartments = issue.departments.map(dId => departments.find(d => d.id === dId)).filter(Boolean);

  // UTC 날짜 문자열을 한국 시간으로 변환 (datetime 필드용)
  const parseUTCDate = (dateString) => {
    if (!dateString) return null;
    // 백엔드에서 UTC로 저장되므로, timezone 정보가 없으면 UTC로 파싱
    let dateStr = dateString;
    if (dateStr && !dateStr.endsWith('Z') && !dateStr.includes('+')) {
      dateStr = dateStr + 'Z';
    }
    return new Date(dateStr);
  };

  // 날짜만 있는 필드를 로컬 시간으로 파싱 (date only 필드용)
  const parseLocalDate = (dateString) => {
    if (!dateString) return null;
    // YYYY-MM-DD 형식의 날짜를 로컬 자정으로 파싱
    // 시간 없이 파싱하면 UTC로 해석되어 하루가 밀릴 수 있음
    const dateStr = dateString.split('T')[0]; // 시간 부분 제거
    return new Date(dateStr + 'T00:00:00');
  };

  // 목표일정이 지났는지 확인
  const isDueDateOverdue = (dueDate) => {
    if (!dueDate) return false;
    const due = parseLocalDate(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today;
  };

  const formatDateTime = (dateString) => {
    const date = parseUTCDate(dateString);
    if (!date || isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTime = (dateString) => {
    const date = parseUTCDate(dateString);
    if (!date || isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const sortedHistory = [...(history || [])].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  return (
    <DetailContainer>
      <DetailHeader>
        <HeaderTop>
          <BadgeGroup>
            <GroupBadge $color={group?.color || '#6b7280'}>
              {group?.name || '미분류'}
            </GroupBadge>
            <StatusDropdown>
              <StatusButton
                $color={status?.color || '#94a3b8'}
                onClick={() => setShowStatusMenu(!showStatusMenu)}
              >
                {status?.name || '등록'}
                <ChevronDown size={14} />
              </StatusButton>
              <AnimatePresence>
                {showStatusMenu && (
                  <StatusMenu
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    {ISSUE_STATUS.map(s => (
                      <StatusOption
                        key={s.id}
                        $color={s.color}
                        $active={issue.status === s.id}
                        onClick={() => {
                          onStatusChange(issue.id, s.id);
                          setShowStatusMenu(false);
                        }}
                      >
                        <span className="dot" />
                        {s.name}
                      </StatusOption>
                    ))}
                  </StatusMenu>
                )}
              </AnimatePresence>
            </StatusDropdown>
          </BadgeGroup>
          <ActionButtons>
            <ActionButton onClick={() => onEdit(issue)}>
              <Edit2 size={16} />
            </ActionButton>
            <ActionButton className="delete" onClick={() => onDelete(issue.id)}>
              <Trash2 size={16} />
            </ActionButton>
          </ActionButtons>
        </HeaderTop>

        <IssueTitle>{issue.title}</IssueTitle>

        <MetaRow>
          <span className="meta-item">
            <User size={16} />
            개설자: {issue.assignee}
          </span>
          <span className="meta-item">
            <Calendar size={16} />
            등록일: {formatDateTime(issue.createdAt)}
          </span>
          <span className="meta-item">
            <Clock size={16} />
            수정일: {formatDateTime(issue.updatedAt)}
          </span>
          {issue.dueDate && (
            <span className="meta-item" style={{ color: isDueDateOverdue(issue.dueDate) && issue.status !== 'completed' ? '#ef4444' : '#64748b' }}>
              <Target size={16} />
              목표일정: {parseLocalDate(issue.dueDate)?.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' }) || '-'}
            </span>
          )}
        </MetaRow>

        {issueDepartments.length > 0 && (
          <DepartmentTags>
            {issueDepartments.map(dept => (
              <DepartmentTag key={dept.id} $color={dept.color}>
                {dept.name}
              </DepartmentTag>
            ))}
          </DepartmentTags>
        )}
      </DetailHeader>

      <DetailContent>
        <Section>
          <SectionTitle>내용</SectionTitle>
          <Description dangerouslySetInnerHTML={{ __html: issue.description || '<p>내용이 없습니다.</p>' }} />
        </Section>

        <Section>
          <SectionTitle>첨부파일 ({issue.attachments?.length || 0})</SectionTitle>
          {issue.attachments && issue.attachments.length > 0 ? (
            <AttachmentList>
              {issue.attachments.map((attachment) => (
                <AttachmentItem key={attachment.id}>
                  <FileText size={20} className="file-icon" />
                  <div className="file-info">
                    <div className="file-name">{attachment.originalFilename || attachment.original_filename || attachment.filename}</div>
                    <div className="file-size">{formatFileSize(attachment.size || attachment.fileSize)}</div>
                  </div>
                  <button
                    className="download-btn"
                    onClick={() => onDownloadAttachment(attachment)}
                    title="다운로드 (ZIP)"
                  >
                    <Download size={16} />
                  </button>
                  {onDeleteAttachment && (
                    <button
                      className="delete-btn"
                      onClick={() => onDeleteAttachment(attachment)}
                      title="삭제"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </AttachmentItem>
              ))}
            </AttachmentList>
          ) : (
            <NoAttachments>
              <Paperclip size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
              첨부된 파일이 없습니다.
            </NoAttachments>
          )}
        </Section>

        <Section>
          <SectionTitle>타임라인 ({sortedHistory.length})</SectionTitle>
          <Timeline>
            {sortedHistory.map((item, index) => {
              const dept = departments.find(d => d.id === item.departmentId);
              const canDelete = item.type === 'comment';
              return (
                <TimelineItemWrapper
                  key={item.id}
                  $type={item.type}
                  $deptColor={dept?.color}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <TimelineContent $type={item.type}>
                    <TimelineMeta $color={dept?.color}>
                      <span className="author">{item.author}</span>
                      {dept && <span className="dept">{dept.name}</span>}
                      <span className="time">{formatTime(item.createdAt)}</span>
                      {canDelete && onDeleteHistory && (
                        <button
                          className="delete-btn"
                          onClick={() => {
                            if (window.confirm('이 의견을 삭제하시겠습니까?')) {
                              onDeleteHistory(item.id);
                            }
                          }}
                          title="삭제"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </TimelineMeta>
                    <TimelineText $type={item.type}>
                      {item.type === 'status-change' && <ArrowRightCircle size={14} style={{ marginRight: '0.375rem', verticalAlign: 'middle' }} />}
                      {item.content}
                    </TimelineText>
                    {item.attachment && (() => {
                      // JSON 형태의 첨부파일 정보 파싱 시도
                      try {
                        const attachments = JSON.parse(item.attachment);
                        if (Array.isArray(attachments) && attachments.length > 0) {
                          return (
                            <CommentAttachments>
                              {attachments.map((att, attIdx) => (
                                <CommentAttachmentItem
                                  key={attIdx}
                                  onClick={() => onDownloadAttachment && onDownloadAttachment({
                                    id: att.id,
                                    originalFilename: att.filename,
                                    fileSize: att.size
                                  })}
                                  title={`다운로드: ${att.filename}`}
                                >
                                  <Download size={12} />
                                  <span className="file-name">{att.filename}</span>
                                </CommentAttachmentItem>
                              ))}
                            </CommentAttachments>
                          );
                        }
                      } catch (e) {
                        // JSON 파싱 실패 시 기존 방식으로 표시 (단순 텍스트)
                        return (
                          <Attachment>
                            <Paperclip size={14} />
                            {item.attachment}
                          </Attachment>
                        );
                      }
                      return null;
                    })()}
                  </TimelineContent>
                </TimelineItemWrapper>
              );
            })}
          </Timeline>
        </Section>
      </DetailContent>

      <CommentForm
        issueId={issue.id}
        onSubmit={onAddComment}
        departments={departments}
        currentUser={currentUser}
      />
    </DetailContainer>
  );
};

export default IssueDetail;
