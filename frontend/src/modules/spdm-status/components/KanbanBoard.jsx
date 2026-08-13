import React from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, User, Calendar, MessageSquare, Target } from 'lucide-react';
import { ISSUE_STATUS } from '../data/sampleData';

const BoardContainer = styled.div`
  flex: 1;
  display: flex;
  gap: 1rem;
  padding: 1rem;
  overflow-x: auto;
  background: #f8fafc;
`;

const Column = styled.div`
  flex: 1;
  min-width: 280px;
  background: #f1f5f9;
  border-radius: 0.75rem;
  display: flex;
  flex-direction: column;
  max-height: 100%;
`;

const ColumnHeader = styled.div`
  padding: 1rem;
  background: white;
  border-radius: 0.75rem 0.75rem 0 0;
  border-bottom: 2px solid ${props => props.$color};
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ColumnTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: #1e293b;

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: ${props => props.$color};
  }
`;

const ColumnCount = styled.span`
  background: ${props => props.$color}20;
  color: ${props => props.$color};
  padding: 0.25rem 0.625rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
`;

const ColumnContent = styled.div`
  flex: 1;
  padding: 0.75rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const KanbanCard = styled(motion.div)`
  background: white;
  border-radius: 0.5rem;
  padding: 0.875rem;
  cursor: pointer;
  border: 1px solid #e2e8f0;
  transition: all 0.2s ease;

  &:hover {
    border-color: #8b5cf6;
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.15);
    transform: translateY(-2px);
  }

  ${props => props.$selected && `
    border-color: #8b5cf6;
    box-shadow: 0 0 0 2px #8b5cf633;
  `}
`;

const CardTitle = styled.h4`
  font-size: 0.9375rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 0.5rem 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const GroupBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  background: ${props => props.$color}15;
  color: ${props => props.$color};
  border-radius: 0.25rem;
  font-size: 0.6875rem;
  font-weight: 500;
  margin-bottom: 0.5rem;

  &::before {
    content: '';
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: ${props => props.$color};
  }
`;

const CardMeta = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.625rem;
  font-size: 0.75rem;
  color: #64748b;
  margin-top: 0.5rem;

  .meta-item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
`;

const DepartmentTags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-top: 0.5rem;
`;

const DepartmentTag = styled.span`
  padding: 0.125rem 0.375rem;
  background: ${props => props.$color}15;
  color: ${props => props.$color};
  border-radius: 0.25rem;
  font-size: 0.625rem;
  font-weight: 500;
`;

const EmptyColumn = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
  color: #94a3b8;
  font-size: 0.875rem;
`;

const KanbanBoard = ({
  issues,
  selectedIssue,
  onSelectIssue,
  onAddIssue,
  groups = [],
  departments = [],
  historyMap = {}
}) => {
  // 상태별로 이슈 그룹화
  const issuesByStatus = ISSUE_STATUS.reduce((acc, status) => {
    acc[status.id] = issues.filter(issue => issue.status === status.id);
    return acc;
  }, {});

  // datetime 필드 포맷팅
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    let dateStr = dateString;
    if (dateStr && !dateStr.endsWith('Z') && !dateStr.includes('+')) {
      dateStr = dateStr + 'Z';
    }
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'short', day: 'numeric' });
  };

  // date only 필드 포맷팅
  const formatDateOnly = (dateString) => {
    if (!dateString) return '-';
    const dateStr = dateString.split('T')[0];
    const date = new Date(dateStr + 'T00:00:00');
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'short', day: 'numeric' });
  };

  // 목표일정 지났는지 확인
  const isDueDateOverdue = (dueDate, status) => {
    if (!dueDate || status === 'completed') return false;
    const dateStr = dueDate.split('T')[0];
    const due = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today;
  };

  return (
    <BoardContainer>
      {ISSUE_STATUS.map(status => (
        <Column key={status.id}>
          <ColumnHeader $color={status.color}>
            <ColumnTitle $color={status.color}>
              <span className="dot" />
              {status.name}
            </ColumnTitle>
            <ColumnCount $color={status.color}>
              {issuesByStatus[status.id]?.length || 0}
            </ColumnCount>
          </ColumnHeader>
          <ColumnContent>
            <AnimatePresence>
              {issuesByStatus[status.id]?.length > 0 ? (
                issuesByStatus[status.id].map(issue => {
                  const group = groups.find(g => g.id === issue.groupId);
                  const issueDepartments = issue.departments
                    .map(dId => departments.find(d => d.id === dId))
                    .filter(Boolean);
                  const commentCount = historyMap[issue.id]?.filter(h => h.type === 'comment').length || 0;

                  return (
                    <KanbanCard
                      key={issue.id}
                      $selected={selectedIssue?.id === issue.id}
                      onClick={() => onSelectIssue(issue)}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      layout
                    >
                      <GroupBadge $color={group?.color || '#6b7280'}>
                        {group?.name || '미분류'}
                      </GroupBadge>
                      <CardTitle>{issue.title}</CardTitle>
                      <CardMeta>
                        <span className="meta-item">
                          <User size={12} />
                          {issue.assignee}
                        </span>
                        <span className="meta-item">
                          <Calendar size={12} />
                          {formatDate(issue.createdAt)}
                        </span>
                        {issue.dueDate && (
                          <span
                            className="meta-item"
                            style={{
                              color: isDueDateOverdue(issue.dueDate, issue.status) ? '#ef4444' : '#64748b'
                            }}
                          >
                            <Target size={12} />
                            {formatDateOnly(issue.dueDate)}
                          </span>
                        )}
                        <span className="meta-item">
                          <MessageSquare size={12} />
                          {commentCount}
                        </span>
                      </CardMeta>
                      {issueDepartments.length > 0 && (
                        <DepartmentTags>
                          {issueDepartments.slice(0, 3).map(dept => (
                            <DepartmentTag key={dept.id} $color={dept.color}>
                              {dept.name}
                            </DepartmentTag>
                          ))}
                          {issueDepartments.length > 3 && (
                            <DepartmentTag $color="#64748b">
                              +{issueDepartments.length - 3}
                            </DepartmentTag>
                          )}
                        </DepartmentTags>
                      )}
                    </KanbanCard>
                  );
                })
              ) : (
                <EmptyColumn>
                  이슈가 없습니다
                </EmptyColumn>
              )}
            </AnimatePresence>
          </ColumnContent>
        </Column>
      ))}
    </BoardContainer>
  );
};

export default KanbanBoard;
