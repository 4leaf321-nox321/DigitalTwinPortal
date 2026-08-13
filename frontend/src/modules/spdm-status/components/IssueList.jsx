import React from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Filter } from 'lucide-react';
import IssueCard from './IssueCard';

const ListContainer = styled.div`
  width: 360px;
  min-width: 360px;
  background: #f8fafc;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const ListHeader = styled.div`
  padding: 1rem;
  background: white;
  border-bottom: 1px solid #e2e8f0;
`;

const HeaderTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;

  h3 {
    font-size: 1rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0;
  }
`;

const AddButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
  }
`;

const SearchContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;

  input {
    flex: 1;
    border: none;
    background: transparent;
    font-size: 0.875rem;
    color: #1e293b;
    outline: none;

    &::placeholder {
      color: #94a3b8;
    }
  }
`;

const FilterTabs = styled.div`
  display: flex;
  gap: 0.25rem;
  margin-top: 0.75rem;
`;

const FilterTab = styled.button`
  padding: 0.375rem 0.75rem;
  background: ${props => props.$active ? '#8b5cf6' : 'transparent'};
  color: ${props => props.$active ? 'white' : '#64748b'};
  border: 1px solid ${props => props.$active ? '#8b5cf6' : '#e2e8f0'};
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.$active ? '#8b5cf6' : '#f1f5f9'};
  }
`;

const ListContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const EmptyState = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
  color: #94a3b8;

  svg {
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  p {
    font-size: 0.9375rem;
    margin: 0;
  }
`;

const IssueCount = styled.span`
  font-size: 0.75rem;
  color: #64748b;
  font-weight: 400;
`;

const IssueList = ({
  issues,
  selectedIssue,
  onSelectIssue,
  onAddIssue,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  historyMap,
  groups = [],
  departments = []
}) => {
  const sortOptions = [
    { id: 'newest', name: '최신순' },
    { id: 'oldest', name: '오래된순' },
    { id: 'updated', name: '업데이트순' },
  ];

  return (
    <ListContainer>
      <ListHeader>
        <HeaderTop>
          <h3>
            이슈 목록 <IssueCount>({issues.length})</IssueCount>
          </h3>
          <AddButton onClick={onAddIssue}>
            <Plus size={16} />
            이슈 등록
          </AddButton>
        </HeaderTop>
        <SearchContainer>
          <Search size={16} color="#94a3b8" />
          <input
            type="text"
            placeholder="이슈 검색..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </SearchContainer>
        <FilterTabs>
          {sortOptions.map(option => (
            <FilterTab
              key={option.id}
              $active={sortBy === option.id}
              onClick={() => onSortChange(option.id)}
            >
              {option.name}
            </FilterTab>
          ))}
        </FilterTabs>
      </ListHeader>

      <ListContent>
        <AnimatePresence>
          {issues.length > 0 ? (
            issues.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                selected={selectedIssue?.id === issue.id}
                onClick={() => onSelectIssue(issue)}
                commentCount={historyMap[issue.id]?.filter(h => h.type === 'comment').length || 0}
                groups={groups}
                departments={departments}
              />
            ))
          ) : (
            <EmptyState>
              <Filter size={48} />
              <p>해당 조건의 이슈가 없습니다.</p>
            </EmptyState>
          )}
        </AnimatePresence>
      </ListContent>
    </ListContainer>
  );
};

export default IssueList;
