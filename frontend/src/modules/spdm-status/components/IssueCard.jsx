import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { MessageSquare, User, Calendar, Target } from 'lucide-react';
import { ISSUE_STATUS } from '../data/sampleData';

const Card = styled(motion.div)`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: #8b5cf6;
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.15);
  }

  ${props => props.$selected && `
    border-color: #8b5cf6;
    box-shadow: 0 0 0 2px #8b5cf633;
  `}
`;

const CardHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
`;

const GroupBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.625rem;
  background: ${props => props.$color}15;
  color: ${props => props.$color};
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;

  &::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${props => props.$color};
  }
`;

const StatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.625rem;
  background: ${props => props.$color}20;
  color: ${props => props.$color};
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 600;
  white-space: nowrap;
`;

const CardTitle = styled.h4`
  font-size: 1rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 0.5rem 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const CardMeta = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  font-size: 0.8125rem;
  color: #64748b;

  .meta-item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
`;

const DepartmentTags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #f1f5f9;
`;

const DepartmentTag = styled.span`
  padding: 0.125rem 0.5rem;
  background: ${props => props.$color}15;
  color: ${props => props.$color};
  border-radius: 0.25rem;
  font-size: 0.6875rem;
  font-weight: 500;
`;

const IssueCard = ({ issue, selected, onClick, commentCount = 0, groups = [], departments = [] }) => {
  const group = groups.find(g => g.id === issue.groupId);
  const status = ISSUE_STATUS.find(s => s.id === issue.status);
  const issueDepartments = issue.departments.map(dId => departments.find(d => d.id === dId)).filter(Boolean);

  // datetime 필드 포맷팅 (createdAt, updatedAt 등)
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    // 백엔드에서 UTC로 저장되므로, timezone 정보가 없으면 UTC로 파싱
    let dateStr = dateString;
    if (dateStr && !dateStr.endsWith('Z') && !dateStr.includes('+')) {
      dateStr = dateStr + 'Z';
    }
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'short', day: 'numeric' });
  };

  // date only 필드 포맷팅 (dueDate 등)
  const formatDateOnly = (dateString) => {
    if (!dateString) return '-';
    // YYYY-MM-DD 형식의 날짜를 로컬 자정으로 파싱
    const dateStr = dateString.split('T')[0];
    const date = new Date(dateStr + 'T00:00:00');
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'short', day: 'numeric' });
  };

  // 목표일정이 지났는지 확인
  const isDueDateOverdue = (dueDate) => {
    if (!dueDate) return false;
    const dateStr = dueDate.split('T')[0];
    const due = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today;
  };

  return (
    <Card
      $selected={selected}
      onClick={onClick}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
    >
      <CardHeader>
        <GroupBadge $color={group?.color || '#6b7280'}>
          {group?.name || '미분류'}
        </GroupBadge>
        <StatusBadge $color={status?.color || '#94a3b8'}>
          {status?.name || '등록'}
        </StatusBadge>
      </CardHeader>

      <CardTitle>{issue.title}</CardTitle>

      <CardMeta>
        <span className="meta-item">
          <User size={14} />
          {issue.assignee}
        </span>
        <span className="meta-item">
          <Calendar size={14} />
          {formatDate(issue.createdAt)}
        </span>
        {issue.dueDate && (
          <span className="meta-item" style={{ color: isDueDateOverdue(issue.dueDate) && issue.status !== 'completed' ? '#ef4444' : '#64748b' }}>
            <Target size={14} />
            {formatDateOnly(issue.dueDate)}
          </span>
        )}
        <span className="meta-item">
          <MessageSquare size={14} />
          {commentCount}
        </span>
      </CardMeta>

      {issueDepartments.length > 0 && (
        <DepartmentTags>
          {issueDepartments.map(dept => (
            <DepartmentTag key={dept.id} $color={dept.color}>
              {dept.name}
            </DepartmentTag>
          ))}
        </DepartmentTags>
      )}
    </Card>
  );
};

export default IssueCard;
