import React, { useState } from 'react';
import styled from 'styled-components';
import { toLocalYmd } from '../../../../../shared/utils/localDate';
import {
  AlertCircle, Plus, Trash2, CheckCircle, MessageSquare, ChevronUp, ChevronDown,
} from 'lucide-react';

const IssuesContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 0;

  @media (max-width: 768px) {
    gap: 0.75rem;
  }
`;

/* 제목 + 추가 입력줄 — 목록이 길어져도 항상 보이게 고정한다 */
const StickyHeaderArea = styled.div`
  flex-shrink: 0;
`;

/* 순서 이동 (위/아래) + 현재 번호 — 액션아이템 섹션과 같은 형태 */
const OrderControls = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
  flex-shrink: 0;
`;

const OrderButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.125rem;
  padding: 0;
  border: 1px solid #e5e7eb;
  border-radius: 0.25rem;
  background: white;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover:not(:disabled) {
    background: #eef2ff;
    border-color: #c7d2fe;
    color: #4f46e5;
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
`;

const OrderIndex = styled.span`
  font-size: 0.6875rem;
  font-weight: 600;
  color: #9ca3af;
  line-height: 1;
`;

/*
 * 이슈 목록만 스크롤한다.
 * 추가 입력줄까지 함께 스크롤되면 이슈를 연달아 넣을 때마다 위로 올라가야 한다.
 * (액션아이템 섹션과 같은 규칙)
 */
const IssueList = styled.div`
  flex: 1;
  min-height: 0;
  max-height: 50vh;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 0.25rem;

  &::-webkit-scrollbar {
    width: 10px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 5px;
  }

  &::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 5px;

    &:hover {
      background: #94a3b8;
    }
  }

  @media (max-width: 768px) {
    max-height: 45vh;
  }
`;

const SectionTitle = styled.h3`
  font-size: 1rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 1rem 0;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #e5e7eb;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  @media (max-width: 768px) {
    font-size: 0.9rem;
    margin-bottom: 0.75rem;
  }
`;

const IssueCard = styled.div`
  border: 2px solid ${props => props.$resolved ? '#d1fae5' : '#fecaca'};
  border-radius: 0.75rem;
  padding: 1rem;
  margin-bottom: 0.5rem;
  background: ${props => props.$resolved ? '#f0fdf4' : '#fef2f2'};
  transition: all 0.2s ease;

  @media (max-width: 768px) {
    padding: 0.75rem;
  }
`;

const IssueHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 0.5rem;
  }
`;

const IssueTitleContainer = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  flex: 1;

  .checkbox-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    margin-top: 0.125rem;
  }

  .checkbox {
    width: 1.25rem;
    height: 1.25rem;
    cursor: pointer;
    accent-color: #10b981;
  }

  .checkbox-label {
    font-size: 0.65rem;
    color: #6b7280;
  }
`;

const IssueTitle = styled.input`
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  background: white;

  &:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
  }

  &:disabled {
    background: #f3f4f6;
    color: #6b7280;
  }
`;

const DateField = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: #6b7280;

  label {
    white-space: nowrap;
  }

  input {
    padding: 0.375rem 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.8rem;
    background: white;

    &:focus {
      outline: none;
      border-color: #6366f1;
    }
  }
`;

const DeleteButton = styled.button`
  padding: 0.5rem;
  background: #fee2e2;
  color: #dc2626;
  border: 1px solid #fecaca;
  border-radius: 0.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;

  &:hover {
    background: #fecaca;
  }
`;

const CommentSection = styled.div`
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px dashed #d1d5db;
`;

const CommentLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.5rem;
`;

const CommentTextarea = styled.textarea`
  width: 100%;
  min-height: 60px;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 0.8rem;
  resize: vertical;
  background: white;

  &:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
  }

  &::placeholder {
    color: #9ca3af;
  }
`;

const AddIssueContainer = styled.div`
  display: flex;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
`;

const AddIssueInput = styled.input`
  flex: 1;
  min-width: 300px;
  max-width: 600px;
  padding: 0.75rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  font-size: 0.875rem;

  &:focus {
    outline: none;
    border-color: #ef4444;
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
  }

  &::placeholder {
    color: #9ca3af;
  }
`;

const AddIssueButton = styled.button`
  padding: 0.75rem 1rem;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  align-self: flex-start;
  transition: all 0.2s ease;

  &:hover {
    background: #dc2626;
  }

  @media (max-width: 768px) {
    font-size: 0.8rem;
    padding: 0.6rem 0.8rem;
  }
`;

const ResolvedBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  background: #10b981;
  color: white;
  font-size: 0.7rem;
  font-weight: 600;
  border-radius: 0.375rem;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 2rem;
  color: #9ca3af;
  font-size: 0.875rem;
`;

const IssuesSection = ({ formData, handleInputChange }) => {
  const [newIssueTitle, setNewIssueTitle] = useState('');

  const issues = formData.이슈목록 || [];

  // 오늘 날짜 (YYYY-MM-DD 형식)
  const getTodayDate = () => {
    const today = new Date();
    return toLocalYmd(today);
  };

  // 새 이슈 추가
  const addIssue = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!newIssueTitle.trim()) return;

    const newIssue = {
      id: Date.now(),
      제목: newIssueTitle.trim(),
      등록일: getTodayDate(),
      해결여부: false,
      해결일: '',
      코멘트: ''
    };

    const updatedIssues = [...issues, newIssue];

    handleInputChange({
      target: {
        name: '이슈목록',
        value: updatedIssues
      }
    });

    setNewIssueTitle('');
  };

  /**
   * 이슈 순서 이동.
   * 저장 구조상 배열 순서가 곧 표시 순서라 배열만 바꾸면 된다. (백엔드 변경 불필요)
   */
  const moveIssue = (index, direction, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const target = index + direction;
    if (target < 0 || target >= issues.length) return;

    const updated = [...issues];
    [updated[index], updated[target]] = [updated[target], updated[index]];

    handleInputChange({
      target: { name: '이슈목록', value: updated }
    });
  };

  // 이슈 삭제
  const removeIssue = (index, e) => {
    e.preventDefault();
    e.stopPropagation();

    const updatedIssues = issues.filter((_, i) => i !== index);

    handleInputChange({
      target: {
        name: '이슈목록',
        value: updatedIssues
      }
    });
  };

  // 이슈 제목 변경
  const updateIssueTitle = (index, title) => {
    const updatedIssues = issues.map((issue, i) =>
      i === index ? { ...issue, 제목: title } : issue
    );

    handleInputChange({
      target: {
        name: '이슈목록',
        value: updatedIssues
      }
    });
  };

  // 등록일 변경
  const updateIssueDate = (index, date) => {
    const updatedIssues = issues.map((issue, i) =>
      i === index ? { ...issue, 등록일: date } : issue
    );

    handleInputChange({
      target: {
        name: '이슈목록',
        value: updatedIssues
      }
    });
  };

  // 해결 여부 토글
  const toggleResolved = (index) => {
    const updatedIssues = issues.map((issue, i) => {
      if (i === index) {
        const newResolved = !issue.해결여부;
        return {
          ...issue,
          해결여부: newResolved,
          해결일: newResolved ? getTodayDate() : ''
        };
      }
      return issue;
    });

    handleInputChange({
      target: {
        name: '이슈목록',
        value: updatedIssues
      }
    });
  };

  // 코멘트 변경
  const updateComment = (index, comment) => {
    const updatedIssues = issues.map((issue, i) =>
      i === index ? { ...issue, 코멘트: comment } : issue
    );

    handleInputChange({
      target: {
        name: '이슈목록',
        value: updatedIssues
      }
    });
  };

  const projectYear = formData.과제년도 || new Date().getFullYear();

  return (
    <IssuesContainer>
      <StickyHeaderArea>
        <SectionTitle>
          <AlertCircle size={16} />
          이슈 사항
          {issues.length > 0 && (
            <span style={{ marginLeft: '0.5rem', fontSize: '0.8125rem', color: '#6b7280', fontWeight: 500 }}>
              {issues.length}개
              {issues.filter(i => !i.해결여부).length > 0 && (
                <span style={{ color: '#dc2626' }}>
                  {' '}(미해결 {issues.filter(i => !i.해결여부).length})
                </span>
              )}
            </span>
          )}
        </SectionTitle>

        <AddIssueContainer>
          <AddIssueInput
            type="text"
            value={newIssueTitle}
            onChange={(e) => setNewIssueTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addIssue(e);
              }
            }}
            placeholder="새 이슈를 입력하세요"
          />
          <AddIssueButton type="button" onClick={addIssue}>
            <Plus size={16} />
            이슈 추가
          </AddIssueButton>
        </AddIssueContainer>
      </StickyHeaderArea>

      <IssueList>
      {issues.length === 0 ? (
        <EmptyState>
          등록된 이슈가 없습니다.
        </EmptyState>
      ) : (
        issues.map((issue, index) => (
          <IssueCard key={issue.id || index} $resolved={issue.해결여부}>
            <IssueHeader>
              <IssueTitleContainer>
                <div className="checkbox-container">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={!!issue.해결여부}
                    onChange={() => toggleResolved(index)}
                  />
                  <span className="checkbox-label">해결</span>
                </div>
                <IssueTitle
                  type="text"
                  value={issue.제목}
                  onChange={(e) => updateIssueTitle(index, e.target.value)}
                  placeholder="이슈 제목"
                />
                {issue.해결여부 && (
                  <ResolvedBadge>
                    <CheckCircle size={12} />
                    해결됨
                  </ResolvedBadge>
                )}
              </IssueTitleContainer>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <DateField>
                  <label>등록일:</label>
                  <input
                    type="date"
                    value={issue.등록일 || ''}
                    onChange={(e) => updateIssueDate(index, e.target.value)}
                    min={`${projectYear}-01-01`}
                    max={`${projectYear}-12-31`}
                  />
                </DateField>
                {issue.해결여부 && issue.해결일 && (
                  <DateField style={{ color: '#10b981' }}>
                    <label>해결일:</label>
                    <span style={{ fontWeight: 500 }}>{issue.해결일}</span>
                  </DateField>
                )}
                <OrderControls>
                  <OrderButton
                    type="button"
                    onClick={(e) => moveIssue(index, -1, e)}
                    disabled={index === 0}
                    title="위로 이동"
                    aria-label="위로 이동"
                  >
                    <ChevronUp size={14} />
                  </OrderButton>
                  <OrderIndex>{index + 1}</OrderIndex>
                  <OrderButton
                    type="button"
                    onClick={(e) => moveIssue(index, 1, e)}
                    disabled={index === issues.length - 1}
                    title="아래로 이동"
                    aria-label="아래로 이동"
                  >
                    <ChevronDown size={14} />
                  </OrderButton>
                </OrderControls>
                <DeleteButton type="button" onClick={(e) => removeIssue(index, e)}>
                  <Trash2 size={16} />
                </DeleteButton>
              </div>
            </IssueHeader>

            <CommentSection>
              <CommentLabel>
                <MessageSquare size={14} />
                {issue.해결여부 ? '해결 코멘트' : '이슈 상세 / 해결 시 코멘트'}
              </CommentLabel>
              <CommentTextarea
                value={issue.코멘트 || ''}
                onChange={(e) => updateComment(index, e.target.value)}
                placeholder={issue.해결여부 ? '해결 방법이나 조치 사항을 기록하세요...' : '이슈에 대한 상세 내용이나 해결 시 코멘트를 작성하세요...'}
              />
            </CommentSection>
          </IssueCard>
        ))
      )}
      </IssueList>
    </IssuesContainer>
  );
};

export default IssuesSection;
