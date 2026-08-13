import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled from 'styled-components';
import {
  X, Search, Send, MessageSquare, ChevronDown, ChevronUp,
  CheckCircle2, Circle, Trash2, CornerDownRight, Filter
} from 'lucide-react';
import { meetingApi } from '../services/meetingApi';
import { useAuth } from '../../../contexts/AuthContext';

// ============== Styled Components ==============

const PanelContainer = styled.div`
  width: 340px;
  min-width: 340px;
  background: white;
  border-left: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
`;

const PanelHeader = styled.div`
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #faf5ff;
  flex-shrink: 0;
`;

const PanelTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: #1e293b;
`;

const CommentCount = styled.span`
  font-size: 0.75rem;
  font-weight: 500;
  color: white;
  background: #8b5cf6;
  border-radius: 9999px;
  padding: 0.1rem 0.5rem;
  min-width: 20px;
  text-align: center;
`;

const CloseBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 0.375rem;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: #f1f5f9;
    color: #1e293b;
  }
`;

const ToolbarRow = styled.div`
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  flex-shrink: 0;
`;

const SearchRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.5rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;

  input {
    flex: 1;
    border: none;
    background: none;
    font-size: 0.8rem;
    color: #1e293b;
    outline: none;

    &::placeholder {
      color: #94a3b8;
    }
  }
`;

const FilterRow = styled.div`
  display: flex;
  gap: 0.25rem;
`;

const FilterBtn = styled.button`
  flex: 1;
  padding: 0.3rem 0.5rem;
  border: 1px solid ${props => props.$active ? '#8b5cf6' : '#e2e8f0'};
  border-radius: 0.25rem;
  font-size: 0.72rem;
  font-weight: 500;
  cursor: pointer;
  background: ${props => props.$active ? '#f5f3ff' : 'white'};
  color: ${props => props.$active ? '#7c3aed' : '#64748b'};
  transition: all 0.15s;

  &:hover {
    border-color: #8b5cf6;
    color: #7c3aed;
  }
`;

const CommentList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  color: #94a3b8;
  font-size: 0.85rem;
  gap: 0.5rem;
`;

const CommentThread = styled.div`
  margin-bottom: 0.5rem;
  border: 1px solid ${props =>
    props.$status === '완료' ? '#d1fae5' :
    props.$status === '보류' ? '#fde68a' : '#e2e8f0'};
  border-radius: 0.5rem;
  overflow: hidden;
  background: ${props =>
    props.$status === '완료' ? '#f0fdf4' :
    props.$status === '보류' ? '#fffbeb' : 'white'};
  transition: border-color 0.15s;
`;

const CommentItem = styled.div`
  padding: 0.625rem 0.75rem;
  border-bottom: ${props => props.$hasBorder ? '1px solid #f1f5f9' : 'none'};
`;

const CommentHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.25rem;
`;

const AuthorName = styled.span`
  font-size: 0.8rem;
  font-weight: 600;
  color: #334155;
`;

const CommentDate = styled.span`
  font-size: 0.68rem;
  color: #94a3b8;
`;

const CommentContent = styled.div`
  font-size: 0.82rem;
  color: #475569;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
`;

const CommentActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-top: 0.375rem;
`;

const ActionButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.2rem 0.4rem;
  border: none;
  border-radius: 0.25rem;
  font-size: 0.68rem;
  cursor: pointer;
  background: transparent;
  color: ${props => props.$color || '#94a3b8'};
  transition: all 0.15s;

  &:hover {
    background: #f1f5f9;
    color: ${props => props.$hoverColor || '#475569'};
  }
`;

const ReplyToggle = styled.button`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.75rem;
  border: none;
  border-top: 1px solid #f1f5f9;
  background: #fafbfc;
  font-size: 0.72rem;
  color: #8b5cf6;
  cursor: pointer;
  width: 100%;
  font-weight: 500;
  transition: background 0.15s;

  &:hover {
    background: #f5f3ff;
  }
`;

const ReplySection = styled.div`
  border-top: 1px solid #f1f5f9;
  background: #fafbfc;
`;

const ReplyItem = styled.div`
  padding: 0.5rem 0.75rem 0.5rem 1.25rem;
  border-bottom: 1px solid #f1f5f9;

  &:last-of-type {
    border-bottom: none;
  }
`;

const ReplyInputRow = styled.div`
  display: flex;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  border-top: 1px solid #f1f5f9;
  background: #fafbfc;
`;

const ReplyInput = styled.input`
  flex: 1;
  padding: 0.375rem 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.25rem;
  font-size: 0.78rem;
  color: #334155;
  outline: none;
  font-family: inherit;

  &:focus {
    border-color: #8b5cf6;
  }
`;

const SendBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 0.25rem;
  background: #8b5cf6;
  color: white;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s;

  &:hover {
    background: #7c3aed;
  }

  &:disabled {
    background: #cbd5e1;
    cursor: default;
  }
`;

const NewCommentSection = styled.div`
  padding: 0.75rem;
  border-top: 1px solid #e2e8f0;
  background: #fafbfc;
  flex-shrink: 0;
`;

const NewCommentLabel = styled.div`
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
  margin-bottom: 0.375rem;
`;

const ContentTextarea = styled.textarea`
  width: 100%;
  padding: 0.375rem 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.25rem;
  font-size: 0.8rem;
  color: #334155;
  outline: none;
  resize: vertical;
  min-height: 60px;
  font-family: inherit;
  line-height: 1.5;
  box-sizing: border-box;

  &:focus {
    border-color: #8b5cf6;
  }
`;

const SubmitRow = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-top: 0.375rem;
`;

const SubmitBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.4rem 0.75rem;
  border: none;
  border-radius: 0.375rem;
  background: #8b5cf6;
  color: white;
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: #7c3aed;
  }

  &:disabled {
    background: #cbd5e1;
    cursor: default;
  }
`;

const StatusBadge = styled.span`
  font-size: 0.65rem;
  font-weight: 500;
  color: ${props => props.$color || '#64748b'};
  background: ${props => props.$bg || '#f1f5f9'};
  padding: 0.1rem 0.4rem;
  border-radius: 9999px;
  border: 1px solid ${props => props.$border || '#e2e8f0'};
`;

const COMMENT_STATUSES = {
  '완료': { color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0' },
  '보류': { color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
};

// ============== Helpers ==============

const formatDate = (isoStr) => {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${month}/${day} ${hours}:${mins}`;
};

// ============== Component ==============

const ReportPlanCommentPanel = ({ tabKey, onClose }) => {
  const { user } = useAuth();
  const author = user?.name || '';

  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filter, setFilter] = useState('all'); // 'all', '', '완료', '보류'
  const [expandedReplies, setExpandedReplies] = useState({});
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');

  // New comment form
  const [newContent, setNewContent] = useState('');

  const listRef = useRef(null);
  const replyInputRef = useRef(null);

  // Load comments
  const loadComments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await meetingApi.getReportPlanComments(tabKey);
      setComments(data);
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setLoading(false);
    }
  }, [tabKey]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // Focus reply input
  useEffect(() => {
    if (replyingTo && replyInputRef.current) {
      replyInputRef.current.focus();
    }
  }, [replyingTo]);

  // Create new comment
  const handleSubmitComment = async () => {
    if (!author.trim() || !newContent.trim()) return;
    try {
      await meetingApi.createReportPlanComment(tabKey, {
        author: author.trim(),
        content: newContent.trim(),
      });
      setNewContent('');
      loadComments();
    } catch (err) {
      console.error('Failed to create comment:', err);
    }
  };

  // Create reply
  const handleSubmitReply = async (parentId) => {
    if (!author.trim() || !replyText.trim()) return;
    try {
      await meetingApi.createReportPlanComment(tabKey, {
        author: author.trim(),
        content: replyText.trim(),
        parentId,
      });
      setReplyText('');
      setReplyingTo(null);
      setExpandedReplies(prev => ({ ...prev, [parentId]: true }));
      loadComments();
    } catch (err) {
      console.error('Failed to create reply:', err);
    }
  };

  // Set comment status (완료/보류)
  const handleSetStatus = async (comment, newStatus) => {
    try {
      await meetingApi.updateReportPlanComment(comment.id, {
        status: comment.status === newStatus ? '' : newStatus,
      });
      loadComments();
    } catch (err) {
      console.error('Failed to update comment:', err);
    }
  };

  // Delete comment
  const handleDelete = async (commentId) => {
    if (!confirm('이 의견을 삭제하시겠습니까?')) return;
    try {
      await meetingApi.deleteReportPlanComment(commentId);
      loadComments();
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  };

  // Toggle replies visibility
  const toggleReplies = (commentId) => {
    setExpandedReplies(prev => ({ ...prev, [commentId]: !prev[commentId] }));
  };

  // Filter & search
  const filteredComments = comments.filter(c => {
    if (filter === 'pending' && c.status) return false;
    if (filter === '완료' && c.status !== '완료') return false;
    if (filter === '보류' && c.status !== '보류') return false;
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      const matchMain = c.author.toLowerCase().includes(q) || c.content.toLowerCase().includes(q);
      const matchReplies = (c.replies || []).some(
        r => r.author.toLowerCase().includes(q) || r.content.toLowerCase().includes(q)
      );
      return matchMain || matchReplies;
    }
    return true;
  });

  const pendingCount = comments.filter(c => !c.status).length;
  const adoptedCount = comments.filter(c => c.status === '완료').length;
  const holdCount = comments.filter(c => c.status === '보류').length;

  return (
    <PanelContainer>
      <PanelHeader>
        <PanelTitle>
          <MessageSquare size={16} color="#8b5cf6" />
          의견
          <CommentCount>{comments.length}</CommentCount>
        </PanelTitle>
        <CloseBtn onClick={onClose} title="닫기">
          <X size={16} />
        </CloseBtn>
      </PanelHeader>

      <ToolbarRow>
        <SearchRow>
          <Search size={14} color="#94a3b8" />
          <input
            placeholder="검색..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </SearchRow>
        <FilterRow>
          <FilterBtn $active={filter === 'all'} onClick={() => setFilter('all')}>
            전체 ({comments.length})
          </FilterBtn>
          <FilterBtn $active={filter === 'pending'} onClick={() => setFilter('pending')}>
            미정 ({pendingCount})
          </FilterBtn>
          <FilterBtn $active={filter === '완료'} onClick={() => setFilter('완료')}>
            완료 ({adoptedCount})
          </FilterBtn>
          <FilterBtn $active={filter === '보류'} onClick={() => setFilter('보류')}>
            보류 ({holdCount})
          </FilterBtn>
        </FilterRow>
      </ToolbarRow>

      <CommentList ref={listRef}>
        {loading && <EmptyState>로딩 중...</EmptyState>}
        {!loading && filteredComments.length === 0 && (
          <EmptyState>
            <MessageSquare size={32} color="#cbd5e1" />
            {searchText ? '검색 결과가 없습니다.' : '등록된 의견이 없습니다.'}
          </EmptyState>
        )}
        {filteredComments.map(comment => {
          const replies = comment.replies || [];
          const isExpanded = expandedReplies[comment.id];
          const isReplying = replyingTo === comment.id;

          return (
            <CommentThread key={comment.id} $status={comment.status}>
              <CommentItem $hasBorder={replies.length > 0 || isReplying}>
                <CommentHeader>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <AuthorName>{comment.author}</AuthorName>
                    {comment.status && COMMENT_STATUSES[comment.status] && (
                      <StatusBadge
                        $color={COMMENT_STATUSES[comment.status].color}
                        $bg={COMMENT_STATUSES[comment.status].bg}
                        $border={COMMENT_STATUSES[comment.status].border}
                      >
                        {comment.status}
                      </StatusBadge>
                    )}
                  </div>
                  <CommentDate>{formatDate(comment.createdAt)}</CommentDate>
                </CommentHeader>
                <CommentContent>{comment.content}</CommentContent>
                <CommentActions>
                  <ActionButton
                    onClick={() => {
                      setReplyingTo(isReplying ? null : comment.id);
                      setReplyText('');
                    }}
                    $color="#8b5cf6"
                    $hoverColor="#7c3aed"
                  >
                    <CornerDownRight size={11} /> 답글
                  </ActionButton>
                  <ActionButton
                    onClick={() => handleSetStatus(comment, '완료')}
                    $color={comment.status === '완료' ? '#10b981' : '#94a3b8'}
                    $hoverColor="#10b981"
                  >
                    <CheckCircle2 size={11} /> 완료
                  </ActionButton>
                  <ActionButton
                    onClick={() => handleSetStatus(comment, '보류')}
                    $color={comment.status === '보류' ? '#f59e0b' : '#94a3b8'}
                    $hoverColor="#f59e0b"
                  >
                    <Circle size={11} /> 보류
                  </ActionButton>
                  <ActionButton
                    onClick={() => handleDelete(comment.id)}
                    $color="#94a3b8"
                    $hoverColor="#ef4444"
                  >
                    <Trash2 size={11} />
                  </ActionButton>
                </CommentActions>
              </CommentItem>

              {/* Reply toggle */}
              {replies.length > 0 && (
                <ReplyToggle onClick={() => toggleReplies(comment.id)}>
                  {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  답글 {replies.length}개
                </ReplyToggle>
              )}

              {/* Replies */}
              {isExpanded && replies.length > 0 && (
                <ReplySection>
                  {replies.map(reply => (
                    <ReplyItem key={reply.id}>
                      <CommentHeader>
                        <AuthorName>{reply.author}</AuthorName>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          <CommentDate>{formatDate(reply.createdAt)}</CommentDate>
                          <ActionButton
                            onClick={() => handleDelete(reply.id)}
                            $color="#94a3b8"
                            $hoverColor="#ef4444"
                            style={{ padding: '0.1rem' }}
                          >
                            <Trash2 size={10} />
                          </ActionButton>
                        </div>
                      </CommentHeader>
                      <CommentContent>{reply.content}</CommentContent>
                    </ReplyItem>
                  ))}
                </ReplySection>
              )}

              {/* Reply input */}
              {isReplying && (
                <ReplyInputRow>
                  <ReplyInput
                    ref={replyInputRef}
                    placeholder="답글 입력..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmitReply(comment.id);
                      }
                      if (e.key === 'Escape') {
                        setReplyingTo(null);
                      }
                    }}
                  />
                  <SendBtn
                    onClick={() => handleSubmitReply(comment.id)}
                    disabled={!replyText.trim() || !author.trim()}
                    title="답글 전송"
                  >
                    <Send size={13} />
                  </SendBtn>
                </ReplyInputRow>
              )}
            </CommentThread>
          );
        })}
      </CommentList>

      {/* New comment form */}
      <NewCommentSection>
        <NewCommentLabel>새 의견 작성 ({author || '로그인 필요'})</NewCommentLabel>
        <ContentTextarea
          placeholder="의견을 입력하세요..."
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              handleSubmitComment();
            }
          }}
        />
        <SubmitRow>
          <SubmitBtn
            onClick={handleSubmitComment}
            disabled={!author.trim() || !newContent.trim()}
          >
            <Send size={12} /> 등록
          </SubmitBtn>
        </SubmitRow>
      </NewCommentSection>
    </PanelContainer>
  );
};

export default ReportPlanCommentPanel;
