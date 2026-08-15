import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import {
  MessageSquare, FileText, HelpCircle, Coffee, Megaphone,
  Plus, Search, ChevronLeft, ChevronRight, Eye, MessageCircle,
  Paperclip, Pin, Bell, Edit2, Trash2, Download, X, Send,
  CornerDownRight, Clock, User, FolderOpen, Users, MessagesSquare,
  ChevronDown, ChevronUp, ArrowLeft, ClipboardList, UserX
} from 'lucide-react';
import Header from './components/Layout/Header';
import { boardApi } from './services/boardApi';
import { useAuth } from '../../contexts/AuthContext';

// ============== Styled Components ==============

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f8fafc;
`;

const Content = styled.main`
  flex: 1;
  display: flex;
  overflow: hidden;
`;

const Sidebar = styled.aside`
  width: 280px;
  background: white;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
`;

const SidebarHeader = styled.div`
  padding: 1.5rem;
  border-bottom: 1px solid #e2e8f0;
`;

const SidebarTitle = styled.h2`
  font-size: 1.125rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
`;

const CategoryList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
`;

const CategoryItem = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border: none;
  background: ${props => props.$active ? '#f0f9ff' : 'transparent'};
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;

  &:hover {
    background: ${props => props.$active ? '#f0f9ff' : '#f8fafc'};
  }

  svg {
    color: ${props => props.$color || '#64748b'};
    flex-shrink: 0;
  }
`;

const CategoryName = styled.span`
  flex: 1;
  font-size: 0.9375rem;
  font-weight: ${props => props.$active ? '600' : '500'};
  color: ${props => props.$active ? '#0369a1' : '#334155'};
`;

const CategoryCount = styled.span`
  font-size: 0.8125rem;
  color: #94a3b8;
  background: #f1f5f9;
  padding: 0.125rem 0.5rem;
  border-radius: 1rem;
`;

const MainContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const BoardHeader = styled.div`
  padding: 1.5rem;
  background: white;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
`;

const BoardTitle = styled.h1`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
`;

const BoardActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const SearchWrapper = styled.div`
  position: relative;
  width: 280px;
`;

const SearchIcon = styled.div`
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: #94a3b8;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 0.625rem 0.75rem 0.625rem 2.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
`;

const Button = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &.primary {
    background: #3b82f6;
    color: white;

    &:hover {
      background: #2563eb;
    }
  }

  &.secondary {
    background: #f1f5f9;
    color: #475569;

    &:hover {
      background: #e2e8f0;
    }
  }
`;

const PostList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
`;

// ============== Table Style Board (Arca-live style) ==============

const TableBoardContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  background: white;
`;

const BoardTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
`;

const TableHead = styled.thead`
  background: #f8fafc;
  border-bottom: 2px solid #e2e8f0;
  position: sticky;
  top: 0;
  z-index: 1;
`;

const TableHeadCell = styled.th`
  padding: 0.75rem 0.5rem;
  font-weight: 600;
  color: #64748b;
  text-align: ${props => props.$align || 'center'};
  white-space: nowrap;

  &.num { width: 60px; }
  &.category { width: 80px; }
  &.title { text-align: left; }
  &.author { width: 100px; }
  &.date { width: 90px; }
  &.views { width: 60px; }
  &.comments { width: 50px; }
`;

const TableBody = styled.tbody``;

const TableRow = styled.tr`
  border-bottom: 1px solid #f1f5f9;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: #f8fafc;
  }

  &.notice {
    background: #fffbeb;

    &:hover {
      background: #fef3c7;
    }
  }

  &.pinned {
    background: #f0f9ff;

    &:hover {
      background: #e0f2fe;
    }
  }
`;

const TableCell = styled.td`
  padding: 0.625rem 0.5rem;
  color: #334155;
  text-align: ${props => props.$align || 'center'};
  vertical-align: middle;

  &.num {
    color: #94a3b8;
    font-size: 0.8125rem;
  }

  &.title {
    text-align: left;
    max-width: 0;
  }

  &.author {
    color: #64748b;
    font-size: 0.8125rem;
  }

  &.date {
    color: #94a3b8;
    font-size: 0.8125rem;
  }

  &.views, &.comments {
    color: #94a3b8;
    font-size: 0.8125rem;
  }
`;

const TableTitleWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
`;

const TableBadge = styled.span`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;

  &.notice {
    background: #fef2f2;
    color: #dc2626;
  }

  &.pinned {
    background: #fef3c7;
    color: #d97706;
  }

  &.category {
    background: #f1f5f9;
    color: #64748b;
  }

  &.answered {
    background: #dcfce7;
    color: #166534;
  }

  &.waiting {
    background: #fee2e2;
    color: #dc2626;
  }
`;

const TableTitleText = styled.span`
  font-weight: 500;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:hover {
    color: #3b82f6;
  }
`;

const TableCommentCount = styled.span`
  flex-shrink: 0;
  color: #3b82f6;
  font-size: 0.8125rem;
  font-weight: 600;
`;

const TableAttachmentIcon = styled.span`
  flex-shrink: 0;
  color: #94a3b8;
  display: flex;
  align-items: center;
`;

const PostItem = styled.div`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  padding: 1rem 1.25rem;
  margin-bottom: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: #cbd5e1;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }
`;

const PostHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
`;

const PostBadge = styled.span`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 0.1875rem 0.5rem;
  border-radius: 0.25rem;

  &.notice {
    background: #fef2f2;
    color: #dc2626;
  }

  &.pinned {
    background: #fef3c7;
    color: #d97706;
  }
`;

const PostTitle = styled.h3`
  font-size: 0.9375rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 0.5rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const PostMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.8125rem;
  color: #64748b;
`;

const MetaItem = styled.span`
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const Pagination = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 1rem;
  background: white;
  border-top: 1px solid #e2e8f0;
`;

const PageButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 2rem;
  height: 2rem;
  padding: 0 0.5rem;
  border: 1px solid ${props => props.$active ? '#3b82f6' : '#e2e8f0'};
  background: ${props => props.$active ? '#3b82f6' : 'white'};
  color: ${props => props.$active ? 'white' : '#64748b'};
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    border-color: #3b82f6;
    color: ${props => props.$active ? 'white' : '#3b82f6'};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

// ============== Post Detail View Styles ==============

const PostDetailContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
`;

const PostDetailWrapper = styled.div`
  flex: 1;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
`;

const BackButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  margin-bottom: 1rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #f8fafc;
    color: #334155;
  }
`;

const PostDetailCard = styled.div`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  overflow: hidden;
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const PostDetailHeader = styled.div`
  padding: 1.5rem;
  border-bottom: 1px solid #e2e8f0;
`;

const PostDetailTitle = styled.h1`
  font-size: 1.5rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 1rem 0;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
`;

const PostDetailMeta = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
`;

const PostDetailInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 1.5rem;
  font-size: 0.875rem;
  color: #64748b;
`;

const PostDetailActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const PostDetailBody = styled.div`
  padding: 1.5rem;
  flex: 1;
  overflow-y: auto;
`;

const PostContent = styled.div`
  font-size: 1rem;
  line-height: 1.75;
  color: #334155;
  white-space: pre-wrap;
`;

const AttachmentList = styled.div`
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e2e8f0;
`;

const AttachmentTitle = styled.h4`
  font-size: 0.875rem;
  font-weight: 600;
  color: #64748b;
  margin: 0 0 0.75rem 0;
`;

const AttachmentItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: #f8fafc;
  border-radius: 0.5rem;
  margin-bottom: 0.5rem;
`;

const AttachmentName = styled.span`
  flex: 1;
  font-size: 0.875rem;
  color: #334155;
`;

const AttachmentSize = styled.span`
  font-size: 0.75rem;
  color: #94a3b8;
`;

// ============== Comments Section ==============

const CommentsSection = styled.div`
  margin-top: 1rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  flex-shrink: 0;
`;

const CommentsSectionHeader = styled.div`
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e2e8f0;
  font-size: 1rem;
  font-weight: 600;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const CommentsList = styled.div`
  padding: 1rem 1.5rem;
`;

const CommentItem = styled.div`
  padding: 1rem 0;
  border-bottom: 1px solid #f1f5f9;

  &:last-child {
    border-bottom: none;
  }

  ${props => props.$isReply && `
    margin-left: 2rem;
    padding-left: 1rem;
    border-left: 2px solid #e2e8f0;
  `}
`;

const CommentAuthor = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
`;

const CommentAuthorName = styled.span`
  font-weight: 600;
  font-size: 0.875rem;
  color: #1e293b;
`;

const CommentDate = styled.span`
  font-size: 0.75rem;
  color: #94a3b8;
`;

const CommentContent = styled.div`
  font-size: 0.9375rem;
  color: #334155;
  line-height: 1.6;
  white-space: pre-wrap;
`;

const CommentActions = styled.div`
  display: flex;
  gap: 0.75rem;
  margin-top: 0.5rem;
`;

const CommentActionButton = styled.button`
  background: none;
  border: none;
  color: #64748b;
  font-size: 0.75rem;
  cursor: pointer;
  padding: 0;

  &:hover {
    color: #3b82f6;
  }
`;

const CommentForm = styled.div`
  padding: 1rem 1.5rem;
  border-top: 1px solid #e2e8f0;
`;

const CommentInput = styled.textarea`
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  resize: none;
  min-height: 80px;
  font-family: inherit;

  &:focus {
    outline: none;
    border-color: #3b82f6;
  }
`;

const CommentFormActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.75rem;
`;

// ============== Modal Styles ==============

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background: white;
  border-radius: 0.75rem;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
`;

const ModalHeader = styled.div`
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ModalTitle = styled.h2`
  font-size: 1.125rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
`;

const ModalBody = styled.div`
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
`;

const ModalFooter = styled.div`
  padding: 1rem 1.5rem;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
`;

const FormGroup = styled.div`
  margin-bottom: 1.25rem;
`;

const Label = styled.label`
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #334155;
  margin-bottom: 0.5rem;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.875rem;

  &:focus {
    outline: none;
    border-color: #3b82f6;
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  background: white;

  &:focus {
    outline: none;
    border-color: #3b82f6;
  }
`;

const Textarea = styled.textarea`
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  resize: vertical;
  min-height: 200px;
  font-family: inherit;

  &:focus {
    outline: none;
    border-color: #3b82f6;
  }
`;

const CheckboxGroup = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #334155;
  cursor: pointer;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #94a3b8;
  text-align: center;
  padding: 3rem;

  svg {
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  h3 {
    font-size: 1.125rem;
    color: #64748b;
    margin: 0 0 0.5rem 0;
  }

  p {
    margin: 0;
  }
`;

// ============== Discussion Thread Styles ==============
const DiscussionList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
`;

const ThreadCard = styled.div`
  background: white;
  border: 1px solid ${props => props.$expanded ? '#8b5cf6' : '#e2e8f0'};
  border-radius: 0.75rem;
  margin-bottom: 1rem;
  transition: all 0.2s;
  box-shadow: ${props => props.$expanded ? '0 4px 12px rgba(139, 92, 246, 0.15)' : 'none'};

  &:hover {
    border-color: ${props => props.$expanded ? '#8b5cf6' : '#cbd5e1'};
  }
`;

const ThreadHeader = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.25rem;
  cursor: pointer;

  &:hover {
    background: #fafafa;
  }
`;

const ThreadExpandIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: ${props => props.$expanded ? '#8b5cf6' : '#f1f5f9'};
  color: ${props => props.$expanded ? 'white' : '#64748b'};
  flex-shrink: 0;
  margin-top: 2px;
  transition: all 0.2s;
`;

const ThreadMain = styled.div`
  flex: 1;
  min-width: 0;
`;

const ThreadTitle = styled.h3`
  font-size: 1.0625rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 0.5rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ThreadStatusBadge = styled.span`
  font-size: 0.6875rem;
  font-weight: 500;
  padding: 0.1875rem 0.5rem;
  border-radius: 1rem;
  background: ${props => {
    if (props.$status === 'active') return '#dcfce7';
    if (props.$status === 'closed') return '#f1f5f9';
    return '#fef3c7';
  }};
  color: ${props => {
    if (props.$status === 'active') return '#166534';
    if (props.$status === 'closed') return '#64748b';
    return '#92400e';
  }};
`;

const ThreadPreview = styled.p`
  font-size: 0.9375rem;
  color: #64748b;
  margin: 0 0 0.75rem 0;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const ThreadMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.8125rem;
  color: #94a3b8;
`;

const ThreadMetaItem = styled.span`
  display: flex;
  align-items: center;
  gap: 0.375rem;
`;

const ThreadStats = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
  flex-shrink: 0;
`;

const ThreadReplyCount = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: ${props => props.$count > 0 ? '#8b5cf6' : '#94a3b8'};
`;

const ThreadLastActivity = styled.div`
  font-size: 0.75rem;
  color: #94a3b8;
`;

const ThreadBody = styled.div`
  border-top: 1px solid #e2e8f0;
  background: #fafafa;
`;

const ThreadContent = styled.div`
  padding: 1.25rem;
  border-bottom: 1px solid #e2e8f0;
  background: white;
`;

const ThreadContentText = styled.div`
  font-size: 0.9375rem;
  line-height: 1.7;
  color: #334155;
  white-space: pre-wrap;
`;

const ThreadReplies = styled.div`
  max-height: 400px;
  overflow-y: auto;
`;

const ThreadReply = styled.div`
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #e2e8f0;
  background: ${props => props.$isAuthor ? '#f5f3ff' : 'white'};

  &:last-child {
    border-bottom: none;
  }
`;

const ReplyHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
`;

const ReplyAuthor = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
`;

const ReplyAuthorName = styled.span`
  font-weight: 600;
  color: #1e293b;
`;

const ReplyAuthorBadge = styled.span`
  font-size: 0.6875rem;
  font-weight: 500;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  background: #8b5cf6;
  color: white;
`;

const ReplyDate = styled.span`
  font-size: 0.75rem;
  color: #94a3b8;
`;

const ReplyContent = styled.div`
  font-size: 0.9375rem;
  line-height: 1.6;
  color: #334155;
  white-space: pre-wrap;
`;

const ReplyActionButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 0.75rem;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #f1f5f9;
    color: #334155;
  }
`;

const ThreadReplyForm = styled.div`
  padding: 1rem 1.25rem;
  background: white;
  border-top: 1px solid #e2e8f0;
`;

const ReplyInputWrapper = styled.div`
  display: flex;
  gap: 0.75rem;
`;

const ReplyTextarea = styled.textarea`
  flex: 1;
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  resize: none;
  min-height: 60px;
  font-family: inherit;

  &:focus {
    outline: none;
    border-color: #8b5cf6;
  }

  &::placeholder {
    color: #94a3b8;
  }
`;

const ReplySubmitButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 1rem;
  background: #8b5cf6;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #7c3aed;
  }

  &:disabled {
    background: #cbd5e1;
    cursor: not-allowed;
  }
`;

// ============== Icon Map ==============
const iconMap = {
  FileText: FileText,
  HelpCircle: HelpCircle,
  Coffee: Coffee,
  Megaphone: Megaphone,
  MessageSquare: MessageSquare,
  Bell: Bell,
  FolderOpen: FolderOpen,
  Users: Users,
  MessagesSquare: MessagesSquare,
  ClipboardList: ClipboardList,
  UserX: UserX
};

// ============== Default Categories ==============
// 가상 카테고리 (UI 전용, 백엔드에 생성 불필요)
const virtualCategories = [
  { id: 'all', name: '전체 게시글', slug: 'all', icon: 'FileText', color: '#64748b', postCount: 0 }
];

// 실제 카테고리 (백엔드에 생성 필요)
const requiredCategories = [
  { name: '자유 게시판', slug: 'free', icon: 'Coffee', color: '#22c55e', description: '자유롭게 이야기를 나누는 공간입니다.' },
  { name: '익명 게시판', slug: 'anonymous', icon: 'UserX', color: '#6366f1', description: '익명으로 의견을 나누는 공간입니다.', isAnonymous: true }
];

const defaultCategories = virtualCategories;

// ============== Main Component ==============
const CollaborationBoardApp = ({ onGoHome }) => {
  const { user } = useAuth();
  const [categories, setCategories] = useState(defaultCategories);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [posts, setPosts] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, pages: 1, currentPage: 1 });
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // View states
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'detail'
  const [selectedPost, setSelectedPost] = useState(null);
  const [showPostModal, setShowPostModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    categoryId: '',
    title: '',
    content: '',
    isPinned: false,
    isNotice: false
  });
  const [pendingFiles, setPendingFiles] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState(null);

  // Discussion thread states
  const [expandedThreads, setExpandedThreads] = useState({});
  const [threadReplies, setThreadReplies] = useState({});
  const [replyTexts, setReplyTexts] = useState({});

  // Fetch categories and create required ones if missing
  const fetchCategories = useCallback(async () => {
    try {
      let data = await boardApi.getCategories();

      // API 응답이 배열이 아니면 빈 배열로 처리
      if (!Array.isArray(data)) {
        console.warn('Categories API returned non-array:', data);
        data = [];
      }

      // 필수 카테고리 중 백엔드에 없는 것들을 생성
      const existingSlugs = data.map(c => c.slug);
      const missingCategories = requiredCategories.filter(rc => !existingSlugs.includes(rc.slug));

      if (missingCategories.length > 0 && user?.role === 'admin') {
        for (const cat of missingCategories) {
          try {
            await boardApi.createCategory(cat);
          } catch (err) {
            console.log(`Category ${cat.slug} creation skipped:`, err.message);
          }
        }
        // 생성 후 다시 가져오기
        try {
          data = await boardApi.getCategories();
          if (!Array.isArray(data)) data = [];
        } catch (e) {
          console.error('Failed to refetch categories:', e);
        }
      }

      // isAnonymous 플래그 설정 (익명 게시판 처리)
      const processedData = data.map(cat => ({
        ...cat,
        isAnonymous: cat.slug === 'anonymous' || cat.isAnonymous
      }));

      // 가상 카테고리 + 백엔드 카테고리 합치기
      setCategories([...defaultCategories, ...processedData]);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      // 에러 시에도 가상 카테고리는 유지
      setCategories([...defaultCategories]);
    }
  }, [user]);

  // Fetch posts
  const fetchPosts = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = {
        page,
        perPage: 10,
        search: searchTerm || undefined,
        categoryId: selectedCategory !== 'all' ? selectedCategory : undefined
      };
      const data = await boardApi.getPosts(params);
      setPosts(data.posts || []);
      setPagination({
        total: data.total,
        pages: data.pages,
        currentPage: data.currentPage,
        hasNext: data.hasNext,
        hasPrev: data.hasPrev
      });
    } catch (error) {
      console.error('Failed to fetch posts:', error);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, searchTerm]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // 카테고리나 검색어가 바뀌면 첫 페이지부터 다시 불러온다
  useEffect(() => {
    fetchPosts(1);
  }, [fetchPosts]);

  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId);
    setViewMode('list');
    setSelectedPost(null);
  };

  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      fetchPosts(1);
    }
  };

  const handleOpenPostModal = (post = null) => {
    if (post) {
      setIsEditing(true);
      setFormData({
        categoryId: post.categoryId,
        title: post.title,
        content: post.content,
        isPinned: post.isPinned,
        isNotice: post.isNotice
      });
      setSelectedPost(post);
    } else {
      setIsEditing(false);
      const defaultCategoryId = selectedCategory !== 'all'
        ? selectedCategory
        : categories.find(c => c.id !== 'all')?.id || '';
      setFormData({
        categoryId: defaultCategoryId,
        title: '',
        content: '',
        isPinned: false,
        isNotice: false
      });
    }
    setPendingFiles([]);
    setShowPostModal(true);
  };

  const handleClosePostModal = () => {
    setShowPostModal(false);
    setFormData({ categoryId: '', title: '', content: '', isPinned: false, isNotice: false });
    setPendingFiles([]);
    setIsEditing(false);
  };

  const handleSubmitPost = async () => {
    if (!formData.categoryId || !formData.title || !formData.content) {
      alert('카테고리, 제목, 내용을 모두 입력해주세요.');
      return;
    }

    try {
      let post;
      if (isEditing && selectedPost) {
        post = await boardApi.updatePost(selectedPost.id, formData);
      } else {
        post = await boardApi.createPost(formData);
      }

      // Upload pending files
      for (const file of pendingFiles) {
        await boardApi.uploadAttachment(post.id, file);
      }

      handleClosePostModal();
      fetchPosts(pagination.currentPage);
      fetchCategories();
    } catch (error) {
      console.error('Failed to save post:', error);
      alert('저장에 실패했습니다.');
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;

    try {
      await boardApi.deletePost(postId);
      // Reset thread state for the deleted post
      setExpandedThreads(prev => {
        const newState = { ...prev };
        delete newState[postId];
        return newState;
      });
      setThreadReplies(prev => {
        const newState = { ...prev };
        delete newState[postId];
        return newState;
      });
      setViewMode('list');
      setSelectedPost(null);
      fetchPosts(pagination.currentPage);
      fetchCategories();
    } catch (error) {
      console.error('Failed to delete post:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  // Regular board handlers
  const handleViewPost = async (post) => {
    try {
      const fullPost = await boardApi.getPost(post.id);
      setSelectedPost(fullPost);
      setViewMode('detail');
    } catch (error) {
      console.error('Failed to fetch post:', error);
      alert('게시글을 불러오는데 실패했습니다.');
    }
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedPost(null);
    setCommentText('');
    setReplyTo(null);
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim()) return;

    try {
      await boardApi.createComment({
        postId: selectedPost.id,
        content: commentText,
        parentId: replyTo
      });

      const updatedPost = await boardApi.getPost(selectedPost.id);
      setSelectedPost(updatedPost);
      setCommentText('');
      setReplyTo(null);
      fetchPosts(pagination.currentPage);
    } catch (error) {
      console.error('Failed to add comment:', error);
      alert('댓글 작성에 실패했습니다.');
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('댓글을 삭제하시겠습니까?')) return;

    try {
      await boardApi.deleteComment(commentId);
      const updatedPost = await boardApi.getPost(selectedPost.id);
      setSelectedPost(updatedPost);
      fetchPosts(pagination.currentPage);
    } catch (error) {
      console.error('Failed to delete comment:', error);
      alert('댓글 삭제에 실패했습니다.');
    }
  };

  const handleDownloadAttachment = async (attachment) => {
    try {
      await boardApi.downloadAttachment(attachment.id, attachment.originalFilename);
    } catch (error) {
      console.error('Download failed:', error);
      alert('파일 다운로드에 실패했습니다.');
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    // 서버에서 받은 UTC 시간을 Date 객체로 파싱
    const date = new Date(dateStr);
    const now = new Date();
    // 상대 시간 계산 (브라우저가 자동으로 로컬 시간 기준으로 처리)
    const diff = now - date;

    if (diff < 60000) return '방금 전';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;

    // 날짜 표시는 로컬 시간(KST)으로 자동 변환됨
    return date.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    // 브라우저가 자동으로 로컬 시간(KST)으로 변환
    return date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Discussion thread handlers
  const toggleThread = async (postId) => {
    const isExpanding = !expandedThreads[postId];
    setExpandedThreads(prev => ({
      ...prev,
      [postId]: isExpanding
    }));

    if (isExpanding && !threadReplies[postId]) {
      try {
        const fullPost = await boardApi.getPost(postId);
        setThreadReplies(prev => ({
          ...prev,
          [postId]: fullPost
        }));
      } catch (error) {
        console.error('Failed to fetch thread:', error);
      }
    }
  };

  const handleThreadReplyChange = (postId, text) => {
    setReplyTexts(prev => ({
      ...prev,
      [postId]: text
    }));
  };

  const handleSubmitThreadReply = async (postId) => {
    const replyText = replyTexts[postId]?.trim();
    if (!replyText) return;

    try {
      await boardApi.createComment({
        postId,
        content: replyText
      });

      setReplyTexts(prev => ({
        ...prev,
        [postId]: ''
      }));

      const fullPost = await boardApi.getPost(postId);
      setThreadReplies(prev => ({
        ...prev,
        [postId]: fullPost
      }));

      fetchPosts(pagination.currentPage);
    } catch (error) {
      console.error('Failed to submit reply:', error);
      alert('답글 등록에 실패했습니다.');
    }
  };

  const handleDeleteThreadReply = async (commentId, postId) => {
    if (!window.confirm('이 답글을 삭제하시겠습니까?')) return;

    try {
      await boardApi.deleteComment(commentId);

      const fullPost = await boardApi.getPost(postId);
      setThreadReplies(prev => ({
        ...prev,
        [postId]: fullPost
      }));

      fetchPosts(pagination.currentPage);
    } catch (error) {
      console.error('Failed to delete reply:', error);
      alert('답글 삭제에 실패했습니다.');
    }
  };

  const currentCategory = categories.find(c => c.id === selectedCategory) || defaultCategories[0];
  const isDiscussionBoard = currentCategory?.isDiscussion || currentCategory?.slug === 'discussion';
  const isTableBoard = ['resources', 'qna'].includes(currentCategory?.slug);
  const isQnaBoard = currentCategory?.slug === 'qna';
  const isAnonymousBoard = currentCategory?.isAnonymous || currentCategory?.slug === 'anonymous';
  const IconComponent = iconMap[currentCategory.icon] || FileText;

  // Helper function to display author name (anonymous if in anonymous board)
  const getDisplayAuthorName = (authorName) => {
    return isAnonymousBoard ? '익명' : authorName;
  };

  // Format short date for table view
  const formatShortDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit' }).replace('. ', '/').replace('.', '');
  };

  // Render comments for regular board
  const renderComments = (comments, isReply = false) => {
    if (!comments || comments.length === 0) return null;

    return comments.map(comment => (
      <React.Fragment key={comment.id}>
        <CommentItem $isReply={isReply}>
          <CommentAuthor>
            <User size={14} />
            <CommentAuthorName>{getDisplayAuthorName(comment.authorName)}</CommentAuthorName>
            <CommentDate>{formatDate(comment.createdAt)}</CommentDate>
          </CommentAuthor>
          <CommentContent>{comment.content}</CommentContent>
          <CommentActions>
            {!isReply && (
              <CommentActionButton onClick={() => setReplyTo(comment.id)}>
                답글
              </CommentActionButton>
            )}
            {user?.id === comment.authorId && (
              <CommentActionButton onClick={() => handleDeleteComment(comment.id)}>
                삭제
              </CommentActionButton>
            )}
          </CommentActions>
        </CommentItem>
        {comment.replies && renderComments(comment.replies, true)}
      </React.Fragment>
    ));
  };

  // Pagination component
  const renderPagination = () => {
    if (pagination.pages <= 1) return null;

    const pages = [];
    const maxVisiblePages = 10;
    let startPage = Math.max(1, pagination.currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(pagination.pages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return (
      <Pagination>
        <PageButton
          disabled={!pagination.hasPrev}
          onClick={() => fetchPosts(pagination.currentPage - 1)}
        >
          <ChevronLeft size={16} />
        </PageButton>
        {startPage > 1 && (
          <>
            <PageButton onClick={() => fetchPosts(1)}>1</PageButton>
            {startPage > 2 && <span style={{ color: '#94a3b8' }}>...</span>}
          </>
        )}
        {pages.map(page => (
          <PageButton
            key={page}
            $active={page === pagination.currentPage}
            onClick={() => fetchPosts(page)}
          >
            {page}
          </PageButton>
        ))}
        {endPage < pagination.pages && (
          <>
            {endPage < pagination.pages - 1 && <span style={{ color: '#94a3b8' }}>...</span>}
            <PageButton onClick={() => fetchPosts(pagination.pages)}>{pagination.pages}</PageButton>
          </>
        )}
        <PageButton
          disabled={!pagination.hasNext}
          onClick={() => fetchPosts(pagination.currentPage + 1)}
        >
          <ChevronRight size={16} />
        </PageButton>
      </Pagination>
    );
  };

  return (
    <Container>
      <Header onGoHome={onGoHome} />
      <Content>
        <Sidebar>
          <SidebarHeader>
            <SidebarTitle>게시판 목록</SidebarTitle>
          </SidebarHeader>
          <CategoryList>
            {categories.map(category => {
              const CatIcon = iconMap[category.icon] || FileText;
              return (
                <CategoryItem
                  key={category.id}
                  $active={selectedCategory === category.id}
                  $color={category.color}
                  onClick={() => handleCategorySelect(category.id)}
                >
                  <CatIcon size={18} />
                  <CategoryName $active={selectedCategory === category.id}>
                    {category.name}
                  </CategoryName>
                  {category.postCount > 0 && (
                    <CategoryCount>{category.postCount}</CategoryCount>
                  )}
                </CategoryItem>
              );
            })}
          </CategoryList>
        </Sidebar>

        <MainContent>
          {viewMode === 'list' ? (
            <>
              <BoardHeader>
                <BoardTitle>
                  <IconComponent size={24} color={currentCategory.color} />
                  {currentCategory.name}
                </BoardTitle>
                <BoardActions>
                  <SearchWrapper>
                    <SearchIcon>
                      <Search size={16} />
                    </SearchIcon>
                    <SearchInput
                      placeholder="검색어를 입력하세요..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={handleSearch}
                    />
                  </SearchWrapper>
                  <Button className="primary" onClick={() => handleOpenPostModal()}>
                    <Plus size={16} />
                    {isDiscussionBoard ? '새 안건' : '글쓰기'}
                  </Button>
                </BoardActions>
              </BoardHeader>

              {isDiscussionBoard ? (
                <DiscussionList>
                  {loading ? (
                    <EmptyState>
                      <p>로딩 중...</p>
                    </EmptyState>
                  ) : posts.length === 0 ? (
                    <EmptyState>
                      <MessagesSquare size={48} />
                      <h3>토론 안건이 없습니다</h3>
                      <p>첫 번째 토론 안건을 등록해보세요!</p>
                    </EmptyState>
                  ) : (
                    posts.map(post => {
                      const isExpanded = expandedThreads[post.id];
                      const threadData = threadReplies[post.id];
                      const comments = threadData?.comments || [];

                      const getAllComments = (cmts) => {
                        let all = [];
                        cmts.forEach(c => {
                          all.push(c);
                          if (c.replies && c.replies.length > 0) {
                            all = all.concat(getAllComments(c.replies));
                          }
                        });
                        return all;
                      };
                      const allComments = threadData ? getAllComments(comments) : [];

                      return (
                        <ThreadCard key={post.id} $expanded={isExpanded}>
                          <ThreadHeader onClick={() => toggleThread(post.id)}>
                            <ThreadExpandIcon $expanded={isExpanded}>
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </ThreadExpandIcon>
                            <ThreadMain>
                              <ThreadTitle>
                                {post.isPinned && <Pin size={14} color="#f59e0b" />}
                                {post.title}
                              </ThreadTitle>
                              <ThreadPreview>
                                {threadData?.content || '클릭하여 토론 내용을 확인하세요...'}
                              </ThreadPreview>
                              <ThreadMeta>
                                <ThreadMetaItem>
                                  <User size={14} />
                                  {getDisplayAuthorName(post.authorName)}
                                </ThreadMetaItem>
                                <ThreadMetaItem>
                                  <Clock size={14} />
                                  {formatDate(post.createdAt)}
                                </ThreadMetaItem>
                              </ThreadMeta>
                            </ThreadMain>
                            <ThreadStats>
                              <ThreadReplyCount $count={post.commentCount}>
                                <MessageCircle size={16} />
                                {post.commentCount}개 의견
                              </ThreadReplyCount>
                              <ThreadLastActivity>
                                조회 {post.viewCount}
                              </ThreadLastActivity>
                            </ThreadStats>
                          </ThreadHeader>

                          {isExpanded && threadData && (
                            <ThreadBody>
                              <ThreadContent>
                                <ThreadContentText>{threadData.content}</ThreadContentText>
                                {threadData.attachments && threadData.attachments.length > 0 && (
                                  <AttachmentList style={{ marginTop: '1rem' }}>
                                    {threadData.attachments.map(att => (
                                      <AttachmentItem key={att.id}>
                                        <Paperclip size={14} />
                                        <AttachmentName>{att.originalFilename}</AttachmentName>
                                        <AttachmentSize>{formatFileSize(att.fileSize)}</AttachmentSize>
                                        <Button
                                          className="secondary"
                                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                          onClick={() => handleDownloadAttachment(att)}
                                        >
                                          <Download size={12} />
                                        </Button>
                                      </AttachmentItem>
                                    ))}
                                  </AttachmentList>
                                )}
                                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                                  {(user?.id === post.authorId || user?.role === 'admin') && (
                                    <>
                                      <Button
                                        className="secondary"
                                        style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                                        onClick={(e) => { e.stopPropagation(); handleOpenPostModal(threadData); }}
                                      >
                                        <Edit2 size={14} />
                                        수정
                                      </Button>
                                      <Button
                                        className="secondary"
                                        style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem', color: '#ef4444' }}
                                        onClick={(e) => { e.stopPropagation(); handleDeletePost(post.id); }}
                                      >
                                        <Trash2 size={14} />
                                        삭제
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </ThreadContent>

                              {allComments.length > 0 && (
                                <ThreadReplies>
                                  {comments.map(comment => (
                                    <React.Fragment key={comment.id}>
                                      <ThreadReply $isAuthor={comment.authorId === post.authorId}>
                                        <ReplyHeader>
                                          <ReplyAuthor>
                                            <User size={14} />
                                            <ReplyAuthorName>{getDisplayAuthorName(comment.authorName)}</ReplyAuthorName>
                                            {!isAnonymousBoard && comment.authorId === post.authorId && (
                                              <ReplyAuthorBadge>작성자</ReplyAuthorBadge>
                                            )}
                                            <ReplyDate>{formatDate(comment.createdAt)}</ReplyDate>
                                          </ReplyAuthor>
                                          {user?.id === comment.authorId && (
                                            <ReplyActionButton
                                              onClick={() => handleDeleteThreadReply(comment.id, post.id)}
                                            >
                                              <Trash2 size={12} />
                                              삭제
                                            </ReplyActionButton>
                                          )}
                                        </ReplyHeader>
                                        <ReplyContent>{comment.content}</ReplyContent>
                                      </ThreadReply>
                                      {comment.replies && comment.replies.map(reply => (
                                        <ThreadReply key={reply.id} $isAuthor={reply.authorId === post.authorId} style={{ paddingLeft: '2.5rem', background: reply.authorId === post.authorId ? '#f5f3ff' : '#fafafa' }}>
                                          <ReplyHeader>
                                            <ReplyAuthor>
                                              <CornerDownRight size={12} color="#94a3b8" />
                                              <User size={14} />
                                              <ReplyAuthorName>{getDisplayAuthorName(reply.authorName)}</ReplyAuthorName>
                                              {!isAnonymousBoard && reply.authorId === post.authorId && (
                                                <ReplyAuthorBadge>작성자</ReplyAuthorBadge>
                                              )}
                                              <ReplyDate>{formatDate(reply.createdAt)}</ReplyDate>
                                            </ReplyAuthor>
                                            {user?.id === reply.authorId && (
                                              <ReplyActionButton
                                                onClick={() => handleDeleteThreadReply(reply.id, post.id)}
                                              >
                                                <Trash2 size={12} />
                                                삭제
                                              </ReplyActionButton>
                                            )}
                                          </ReplyHeader>
                                          <ReplyContent>{reply.content}</ReplyContent>
                                        </ThreadReply>
                                      ))}
                                    </React.Fragment>
                                  ))}
                                </ThreadReplies>
                              )}

                              <ThreadReplyForm>
                                <ReplyInputWrapper>
                                  <ReplyTextarea
                                    placeholder="의견을 남겨주세요..."
                                    value={replyTexts[post.id] || ''}
                                    onChange={(e) => handleThreadReplyChange(post.id, e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && e.ctrlKey) {
                                        handleSubmitThreadReply(post.id);
                                      }
                                    }}
                                  />
                                  <ReplySubmitButton
                                    disabled={!replyTexts[post.id]?.trim()}
                                    onClick={() => handleSubmitThreadReply(post.id)}
                                  >
                                    <Send size={16} />
                                  </ReplySubmitButton>
                                </ReplyInputWrapper>
                              </ThreadReplyForm>
                            </ThreadBody>
                          )}
                        </ThreadCard>
                      );
                    })
                  )}
                </DiscussionList>
              ) : isTableBoard ? (
                /* Table Style Board - Resources & QNA */
                <TableBoardContainer>
                  {loading ? (
                    <EmptyState>
                      <p>로딩 중...</p>
                    </EmptyState>
                  ) : posts.length === 0 ? (
                    <EmptyState>
                      <IconComponent size={48} />
                      <h3>게시글이 없습니다</h3>
                      <p>첫 번째 게시글을 작성해보세요!</p>
                    </EmptyState>
                  ) : (
                    <BoardTable>
                      <TableHead>
                        <tr>
                          <TableHeadCell className="num">번호</TableHeadCell>
                          {isQnaBoard && <TableHeadCell className="category">상태</TableHeadCell>}
                          <TableHeadCell className="title">제목</TableHeadCell>
                          <TableHeadCell className="author">글쓴이</TableHeadCell>
                          <TableHeadCell className="date">날짜</TableHeadCell>
                          <TableHeadCell className="views">조회</TableHeadCell>
                        </tr>
                      </TableHead>
                      <TableBody>
                        {posts.map((post, index) => (
                          <TableRow
                            key={post.id}
                            className={post.isNotice ? 'notice' : post.isPinned ? 'pinned' : ''}
                            onClick={() => handleViewPost(post)}
                          >
                            <TableCell className="num">
                              {post.isNotice ? (
                                <TableBadge className="notice">공지</TableBadge>
                              ) : post.isPinned ? (
                                <TableBadge className="pinned">고정</TableBadge>
                              ) : (
                                pagination.total - ((pagination.currentPage - 1) * 10) - index
                              )}
                            </TableCell>
                            {isQnaBoard && (
                              <TableCell>
                                {post.commentCount > 0 ? (
                                  <TableBadge className="answered">답변완료</TableBadge>
                                ) : (
                                  <TableBadge className="waiting">미답변</TableBadge>
                                )}
                              </TableCell>
                            )}
                            <TableCell className="title">
                              <TableTitleWrapper>
                                <TableTitleText>{post.title}</TableTitleText>
                                {post.commentCount > 0 && (
                                  <TableCommentCount>[{post.commentCount}]</TableCommentCount>
                                )}
                                {post.attachmentCount > 0 && (
                                  <TableAttachmentIcon>
                                    <Paperclip size={12} />
                                  </TableAttachmentIcon>
                                )}
                              </TableTitleWrapper>
                            </TableCell>
                            <TableCell className="author">{getDisplayAuthorName(post.authorName)}</TableCell>
                            <TableCell className="date">{formatShortDate(post.createdAt)}</TableCell>
                            <TableCell className="views">{post.viewCount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </BoardTable>
                  )}
                </TableBoardContainer>
              ) : (
                /* Regular Board - Card View */
                <PostList>
                  {loading ? (
                    <EmptyState>
                      <p>로딩 중...</p>
                    </EmptyState>
                  ) : posts.length === 0 ? (
                    <EmptyState>
                      <IconComponent size={48} />
                      <h3>게시글이 없습니다</h3>
                      <p>첫 번째 게시글을 작성해보세요!</p>
                    </EmptyState>
                  ) : (
                    posts.map(post => (
                      <PostItem key={post.id} onClick={() => handleViewPost(post)}>
                        <PostHeader>
                          {post.isNotice && (
                            <PostBadge className="notice">
                              <Bell size={12} />
                              공지
                            </PostBadge>
                          )}
                          {post.isPinned && (
                            <PostBadge className="pinned">
                              <Pin size={12} />
                              고정
                            </PostBadge>
                          )}
                        </PostHeader>
                        <PostTitle>
                          {post.title}
                          {post.attachmentCount > 0 && <Paperclip size={14} color="#94a3b8" />}
                        </PostTitle>
                        <PostMeta>
                          <MetaItem>
                            <User size={14} />
                            {getDisplayAuthorName(post.authorName)}
                          </MetaItem>
                          <MetaItem>
                            <Clock size={14} />
                            {formatDate(post.createdAt)}
                          </MetaItem>
                          <MetaItem>
                            <Eye size={14} />
                            {post.viewCount}
                          </MetaItem>
                          <MetaItem>
                            <MessageCircle size={14} />
                            {post.commentCount}
                          </MetaItem>
                        </PostMeta>
                      </PostItem>
                    ))
                  )}
                </PostList>
              )}

              {renderPagination()}
            </>
          ) : (
            /* Post Detail View - For Regular Board */
            <PostDetailContainer>
              <PostDetailWrapper>
                <BackButton onClick={handleBackToList}>
                  <ArrowLeft size={16} />
                  목록으로
                </BackButton>

                {selectedPost && (
                  <>
                    <PostDetailCard>
                      <PostDetailHeader>
                        <PostDetailTitle>
                          {selectedPost.isNotice && (
                            <PostBadge className="notice">
                              <Bell size={12} />
                              공지
                            </PostBadge>
                          )}
                          {selectedPost.isPinned && (
                            <PostBadge className="pinned">
                              <Pin size={12} />
                              고정
                            </PostBadge>
                          )}
                          {selectedPost.title}
                        </PostDetailTitle>
                        <PostDetailMeta>
                          <PostDetailInfo>
                            <MetaItem>
                              <User size={16} />
                              {getDisplayAuthorName(selectedPost.authorName)}
                            </MetaItem>
                            <MetaItem>
                              <Clock size={16} />
                              {formatDateTime(selectedPost.createdAt)}
                            </MetaItem>
                            <MetaItem>
                              <Eye size={16} />
                              조회 {selectedPost.viewCount}
                            </MetaItem>
                          </PostDetailInfo>
                          <PostDetailActions>
                            {(user?.id === selectedPost.authorId || user?.role === 'admin') && (
                              <>
                                <Button className="secondary" onClick={() => handleOpenPostModal(selectedPost)}>
                                  <Edit2 size={14} />
                                  수정
                                </Button>
                                <Button className="secondary" style={{ color: '#ef4444' }} onClick={() => handleDeletePost(selectedPost.id)}>
                                  <Trash2 size={14} />
                                  삭제
                                </Button>
                              </>
                            )}
                          </PostDetailActions>
                        </PostDetailMeta>
                      </PostDetailHeader>
                      <PostDetailBody>
                        <PostContent>{selectedPost.content}</PostContent>

                        {selectedPost.attachments && selectedPost.attachments.length > 0 && (
                          <AttachmentList>
                            <AttachmentTitle>
                              <Paperclip size={14} />
                              첨부파일 ({selectedPost.attachments.length})
                            </AttachmentTitle>
                            {selectedPost.attachments.map(att => (
                              <AttachmentItem key={att.id}>
                                <Paperclip size={14} />
                                <AttachmentName>{att.originalFilename}</AttachmentName>
                                <AttachmentSize>{formatFileSize(att.fileSize)}</AttachmentSize>
                                <Button
                                  className="secondary"
                                  style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                                  onClick={() => handleDownloadAttachment(att)}
                                >
                                  <Download size={14} />
                                  다운로드
                                </Button>
                              </AttachmentItem>
                            ))}
                          </AttachmentList>
                        )}
                      </PostDetailBody>
                    </PostDetailCard>

                    {/* Comments Section */}
                    <CommentsSection>
                      <CommentsSectionHeader>
                        <MessageCircle size={18} />
                        댓글 {selectedPost.comments?.length || 0}개
                      </CommentsSectionHeader>
                      <CommentsList>
                        {renderComments(selectedPost.comments)}
                        {(!selectedPost.comments || selectedPost.comments.length === 0) && (
                          <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                            첫 번째 댓글을 남겨보세요!
                          </div>
                        )}
                      </CommentsList>
                      <CommentForm>
                        {replyTo && (
                          <div style={{ marginBottom: '0.5rem', fontSize: '0.875rem', color: '#64748b' }}>
                            답글 작성 중...
                            <button
                              style={{ marginLeft: '0.5rem', color: '#3b82f6', border: 'none', background: 'none', cursor: 'pointer' }}
                              onClick={() => setReplyTo(null)}
                            >
                              취소
                            </button>
                          </div>
                        )}
                        <CommentInput
                          placeholder="댓글을 입력하세요..."
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                        />
                        <CommentFormActions>
                          <Button className="primary" onClick={handleSubmitComment}>
                            <Send size={14} />
                            등록
                          </Button>
                        </CommentFormActions>
                      </CommentForm>
                    </CommentsSection>
                  </>
                )}
              </PostDetailWrapper>
            </PostDetailContainer>
          )}
        </MainContent>
      </Content>

      {/* Post Create/Edit Modal */}
      {showPostModal && (
        <ModalOverlay onClick={handleClosePostModal}>
          <ModalContent onClick={e => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>{isEditing ? '게시글 수정' : '새 게시글 작성'}</ModalTitle>
              <Button className="secondary" onClick={handleClosePostModal}>
                <X size={16} />
              </Button>
            </ModalHeader>
            <ModalBody>
              <FormGroup>
                <Label>카테고리</Label>
                <Select
                  value={formData.categoryId || ''}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value ? parseInt(e.target.value) : '' })}
                >
                  <option value="">카테고리 선택</option>
                  {categories.filter(c => c.id !== 'all').map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </Select>
              </FormGroup>
              <FormGroup>
                <Label>제목</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="제목을 입력하세요"
                />
              </FormGroup>
              <FormGroup>
                <Label>내용</Label>
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="내용을 입력하세요"
                />
              </FormGroup>
              <FormGroup>
                <Label>첨부파일</Label>
                <Input
                  type="file"
                  multiple
                  onChange={(e) => setPendingFiles([...e.target.files])}
                />
                {pendingFiles.length > 0 && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#64748b' }}>
                    {pendingFiles.length}개 파일 선택됨
                  </div>
                )}
              </FormGroup>
              {user?.is_admin && (
                <FormGroup style={{ display: 'flex', gap: '1.5rem' }}>
                  <CheckboxGroup>
                    <input
                      type="checkbox"
                      checked={formData.isPinned}
                      onChange={(e) => setFormData({ ...formData, isPinned: e.target.checked })}
                    />
                    상단 고정
                  </CheckboxGroup>
                  <CheckboxGroup>
                    <input
                      type="checkbox"
                      checked={formData.isNotice}
                      onChange={(e) => setFormData({ ...formData, isNotice: e.target.checked })}
                    />
                    공지사항
                  </CheckboxGroup>
                </FormGroup>
              )}
            </ModalBody>
            <ModalFooter>
              <Button className="secondary" onClick={handleClosePostModal}>취소</Button>
              <Button className="primary" onClick={handleSubmitPost}>
                {isEditing ? '수정' : '등록'}
              </Button>
            </ModalFooter>
          </ModalContent>
        </ModalOverlay>
      )}
    </Container>
  );
};

export default CollaborationBoardApp;
