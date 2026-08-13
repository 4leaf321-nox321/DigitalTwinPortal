import React, { useState, useMemo } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';

const NavigationContainer = styled.div`
  background: white;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid #e5e7eb;
  
  @media (max-width: 768px) {
    max-height: none;
    height: auto;
    border-right: none;
    border-radius: 1rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;

const NavigationContent = styled.div`
  flex: 1;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  overflow-y: auto;
  overflow-x: hidden;
`;

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const SectionTitle = styled.h3`
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const FilterGroupContainer = styled.div`
  border: 2px solid #e5e7eb;
  border-radius: 0.75rem;
  overflow: hidden;
  background: #f9fafb;
`;

const FilterGroupHeader = styled(motion.button)`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border: none;
  background: #f3f4f6;
  color: #374151;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  border-bottom: ${props => props.expanded ? '2px solid #e5e7eb' : 'none'};

  &:hover {
    background: #e5e7eb;
  }
`;

const FilterGroupTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.95rem;
`;

const FilterGroupIcon = styled.span`
  font-size: 1.1rem;
  transition: transform 0.2s ease;
  transform: ${props => props.expanded ? 'rotate(90deg)' : 'rotate(0deg)'};
`;

const FilterGroupContent = styled(motion.div)`
  background: white;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const FilterActiveCount = styled.span`
  background: #3b82f6;
  color: white;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  min-width: 1.5rem;
  text-align: center;
`;

const SearchBox = styled.div`
  position: relative;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 0.75rem 1rem 0.75rem 2.5rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  transition: all 0.2s ease;
  background: #f9fafb;

  &:focus {
    outline: none;
    border-color: #3b82f6;
    background: white;
  }

  &::placeholder {
    color: #9ca3af;
  }
`;

const SearchIcon = styled.div`
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: #9ca3af;
  font-size: 1rem;
`;

const TreeContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const TreeNode = styled.div`
  display: flex;
  flex-direction: column;
`;

const TreeNodeHeader = styled(motion.button)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 0.5rem;
  background: ${props => props.active ? '#eff6ff' : 'transparent'};
  color: ${props => props.active ? '#1d4ed8' : '#4b5563'};
  font-size: 0.875rem;
  font-weight: ${props => props.active ? '600' : '500'};
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  width: 100%;

  &:hover {
    background: ${props => props.active ? '#dbeafe' : '#f3f4f6'};
  }
`;

const NodeInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const NodeIcon = styled.span`
  font-size: 1rem;
  transition: transform 0.2s ease;
  transform: ${props => props.expanded ? 'rotate(90deg)' : 'rotate(0deg)'};
`;

const NodeName = styled.span`
  flex: 1;
`;

const NodeCount = styled.span`
  background: ${props => props.active ? '#3b82f6' : '#e5e7eb'};
  color: ${props => props.active ? 'white' : '#6b7280'};
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  min-width: 1.5rem;
  text-align: center;
`;

const TreeNodeChildren = styled(motion.div)`
  margin-left: 1rem;
  border-left: 2px solid #f3f4f6;
  padding-left: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const ChildNode = styled(motion.button)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  border: none;
  border-radius: 0.375rem;
  background: ${props => props.active ? '#eff6ff' : 'transparent'};
  color: ${props => props.active ? '#1d4ed8' : '#6b7280'};
  font-size: 0.8rem;
  font-weight: ${props => props.active ? '600' : '500'};
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  width: 100%;

  &:hover {
    background: ${props => props.active ? '#dbeafe' : '#f9fafb'};
  }
`;

const FilterSubSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const FilterSubTitle = styled.h4`
  font-size: 0.8rem;
  font-weight: 600;
  color: #6b7280;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const TagsSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const TagsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
`;

const TagChip = styled(motion.button)`
  background: ${props => props.selected ? '#3b82f6' : '#f3f4f6'};
  color: ${props => props.selected ? 'white' : '#374151'};
  border: 2px solid ${props => props.selected ? '#3b82f6' : '#e5e7eb'};
  padding: 0.375rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;

  &:hover {
    border-color: #3b82f6;
    background: ${props => props.selected ? '#2563eb' : '#eff6ff'};
  }
`;

const TagCount = styled.span`
  margin-left: 0.375rem;
  font-size: 0.7rem;
  opacity: 0.8;
`;

const SortSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const SortDropdown = styled.select`
  padding: 0.5rem 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  background: #f9fafb;
  color: #374151;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: #3b82f6;
    background: white;
  }
`;

const SortOrder = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const SortButton = styled.button`
  flex: 1;
  padding: 0.5rem;
  border: 2px solid ${props => props.active ? '#3b82f6' : '#e5e7eb'};
  border-radius: 0.5rem;
  background: ${props => props.active ? '#eff6ff' : '#f9fafb'};
  color: ${props => props.active ? '#1d4ed8' : '#6b7280'};
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: #3b82f6;
  }
`;

const DateRangeSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const DateInput = styled.input`
  padding: 0.5rem 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  background: #f9fafb;
  color: #374151;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: #3b82f6;
    background: white;
  }

  &::-webkit-calendar-picker-indicator {
    cursor: pointer;
    opacity: 0.7;
  }
`;

const DateRangeContainer = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
`;

const DateLabel = styled.span`
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 500;
  min-width: 30px;
`;

const ResetButton = styled.button`
  padding: 0.75rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  background: white;
  color: #6b7280;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: #f87171;
    color: #ef4444;
  }
`;

const Divider = styled.div`
  height: 1px;
  background: #e5e7eb;
  margin: 0.5rem 0;
`;

const Navigation = ({
  searchQuery,
  onSearchChange,
  categories,
  selectedCategory,
  onCategoryChange,
  documentTypes,
  selectedType,
  onTypeChange,
  statusOptions,
  selectedStatus,
  onStatusChange,
  selectedTags,
  onTagsChange,
  availableTags,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
  onResetFilters,
  dateRange,
  onDateRangeChange
}) => {
  const [expandedNodes, setExpandedNodes] = useState({
    filters: true, // 필터 그룹 전체 확장 상태
    categories: true,
    types: true,
    status: true,
    tags: true,
    dateRange: true,
    sortGroup: true // 정렬 그룹 확장 상태
  });

  const [expandedFilterGroup, setExpandedFilterGroup] = useState(true);

  const toggleNode = (nodeKey) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeKey]: !prev[nodeKey]
    }));
  };

  const toggleFilterGroup = () => {
    setExpandedFilterGroup(prev => !prev);
  };

  const handleTagToggle = (tagName) => {
    const newTags = selectedTags.includes(tagName)
      ? selectedTags.filter(tag => tag !== tagName)
      : [...selectedTags, tagName];
    onTagsChange(newTags);
  };

  const handleDateRangeChange = (field, value) => {
    const newDateRange = {
      ...dateRange,
      [field]: value
    };
    onDateRangeChange(newDateRange);
  };

  const sortOptions = [
    { value: 'updatedAt', label: '최근 수정일' },
    { value: 'createdAt', label: '생성일' },
    { value: 'title', label: '제목' },
    { value: 'author', label: '작성자' },
    { value: 'readCount', label: '조회수' },
    { value: 'likes', label: '좋아요' }
  ];

  // 태그별 문서 수 계산
  const tagCounts = useMemo(() => {
    const counts = {};
    availableTags.forEach(tag => {
      counts[tag.name] = tag.count;
    });
    return counts;
  }, [availableTags]);

  // 활성 필터 개수 계산
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (dateRange?.startDate || dateRange?.endDate) count++;
    if (selectedCategory !== 'all') count++;
    if (selectedType !== 'all') count++;
    if (selectedStatus !== 'all') count++;
    count += selectedTags.length;
    return count;
  }, [dateRange, selectedCategory, selectedType, selectedStatus, selectedTags]);

  const isDateRangeActive = dateRange?.startDate || dateRange?.endDate;

  return (
    <NavigationContainer>
      <NavigationContent>
        {/* 검색 */}
        <Section>
          <SectionTitle>🔍 검색</SectionTitle>
          <SearchBox>
            <SearchIcon>🔍</SearchIcon>
            <SearchInput
              type="text"
              placeholder="문서 검색..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </SearchBox>
        </Section>

        <Divider />

        {/* 필터 그룹 */}
        <Section>
          <FilterGroupContainer>
            <FilterGroupHeader
              onClick={toggleFilterGroup}
              expanded={expandedFilterGroup}
            >
              <FilterGroupTitle>
                <FilterGroupIcon expanded={expandedFilterGroup}>▶</FilterGroupIcon>
                🔧 필터
              </FilterGroupTitle>
              {activeFilterCount > 0 && (
                <FilterActiveCount>
                  {activeFilterCount}
                </FilterActiveCount>
              )}
            </FilterGroupHeader>
            
            <AnimatePresence>
              {expandedFilterGroup && (
                <FilterGroupContent
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* 날짜 기간 필터 */}
                  <FilterSubSection>
                    <TreeNode>
                      <TreeNodeHeader
                        onClick={() => toggleNode('dateRange')}
                        active={isDateRangeActive}
                      >
                        <NodeInfo>
                          <NodeIcon expanded={expandedNodes.dateRange}>▶</NodeIcon>
                          <NodeName>날짜 기간</NodeName>
                        </NodeInfo>
                        {isDateRangeActive && (
                          <NodeCount active={true}>
                            활성
                          </NodeCount>
                        )}
                      </TreeNodeHeader>
                      <AnimatePresence>
                        {expandedNodes.dateRange && (
                          <TreeNodeChildren
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <DateRangeSection>
                              <DateRangeContainer>
                                <DateLabel>시작</DateLabel>
                                <DateInput
                                  type="date"
                                  value={dateRange?.startDate || ''}
                                  onChange={(e) => handleDateRangeChange('startDate', e.target.value)}
                                />
                              </DateRangeContainer>
                              <DateRangeContainer>
                                <DateLabel>종료</DateLabel>
                                <DateInput
                                  type="date"
                                  value={dateRange?.endDate || ''}
                                  onChange={(e) => handleDateRangeChange('endDate', e.target.value)}
                                />
                              </DateRangeContainer>
                            </DateRangeSection>
                          </TreeNodeChildren>
                        )}
                      </AnimatePresence>
                    </TreeNode>
                  </FilterSubSection>

                  {/* 담당 조직 필터 */}
                  <FilterSubSection>
                    <TreeNode>
                      <TreeNodeHeader
                        onClick={() => toggleNode('categories')}
                        active={selectedCategory !== 'all'}
                      >
                        <NodeInfo>
                          <NodeIcon expanded={expandedNodes.categories}>▶</NodeIcon>
                          <NodeName>담당 조직</NodeName>
                        </NodeInfo>
                        {selectedCategory !== 'all' && (
                          <NodeCount active={true}>선택됨</NodeCount>
                        )}
                      </TreeNodeHeader>
                      <AnimatePresence>
                        {expandedNodes.categories && (
                          <TreeNodeChildren
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            {categories.map(category => (
                              <ChildNode
                                key={category.id}
                                active={selectedCategory === category.id}
                                onClick={() => onCategoryChange(category.id)}
                                whileHover={{ x: 2 }}
                                whileTap={{ scale: 0.98 }}
                              >
                                <NodeInfo>
                                  <span>{category.icon}</span>
                                  <NodeName>{category.name}</NodeName>
                                </NodeInfo>
                                <NodeCount active={selectedCategory === category.id}>
                                  {category.count}
                                </NodeCount>
                              </ChildNode>
                            ))}
                          </TreeNodeChildren>
                        )}
                      </AnimatePresence>
                    </TreeNode>
                  </FilterSubSection>

                  {/* 프로젝트 타입 필터 */}
                  <FilterSubSection>
                    <TreeNode>
                      <TreeNodeHeader
                        onClick={() => toggleNode('types')}
                        active={selectedType !== 'all'}
                      >
                        <NodeInfo>
                          <NodeIcon expanded={expandedNodes.types}>▶</NodeIcon>
                          <NodeName>프로젝트 타입</NodeName>
                        </NodeInfo>
                        {selectedType !== 'all' && (
                          <NodeCount active={true}>선택됨</NodeCount>
                        )}
                      </TreeNodeHeader>
                      <AnimatePresence>
                        {expandedNodes.types && (
                          <TreeNodeChildren
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            {documentTypes.map(type => (
                              <ChildNode
                                key={type.id}
                                active={selectedType === type.id}
                                onClick={() => onTypeChange(type.id)}
                                whileHover={{ x: 2 }}
                                whileTap={{ scale: 0.98 }}
                              >
                                <NodeInfo>
                                  <span>{type.icon}</span>
                                  <NodeName>{type.name}</NodeName>
                                </NodeInfo>
                              </ChildNode>
                            ))}
                          </TreeNodeChildren>
                        )}
                      </AnimatePresence>
                    </TreeNode>
                  </FilterSubSection>

                  {/* 상태 필터 */}
                  <FilterSubSection>
                    <TreeNode>
                      <TreeNodeHeader
                        onClick={() => toggleNode('status')}
                        active={selectedStatus !== 'all'}
                      >
                        <NodeInfo>
                          <NodeIcon expanded={expandedNodes.status}>▶</NodeIcon>
                          <NodeName>상태</NodeName>
                        </NodeInfo>
                        {selectedStatus !== 'all' && (
                          <NodeCount active={true}>선택됨</NodeCount>
                        )}
                      </TreeNodeHeader>
                      <AnimatePresence>
                        {expandedNodes.status && (
                          <TreeNodeChildren
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            {statusOptions.map(status => (
                              <ChildNode
                                key={status.id}
                                active={selectedStatus === status.id}
                                onClick={() => onStatusChange(status.id)}
                                whileHover={{ x: 2 }}
                                whileTap={{ scale: 0.98 }}
                              >
                                <NodeInfo>
                                  <span style={{ color: status.color, fontSize: '0.75rem' }}>●</span>
                                  <NodeName>{status.name}</NodeName>
                                </NodeInfo>
                              </ChildNode>
                            ))}
                          </TreeNodeChildren>
                        )}
                      </AnimatePresence>
                    </TreeNode>
                  </FilterSubSection>

                  {/* 태그 필터 */}
                  <FilterSubSection>
                    <TagsSection>
                      <TreeNode>
                        <TreeNodeHeader
                          onClick={() => toggleNode('tags')}
                          active={selectedTags.length > 0}
                        >
                          <NodeInfo>
                            <NodeIcon expanded={expandedNodes.tags}>▶</NodeIcon>
                            <NodeName>태그</NodeName>
                          </NodeInfo>
                          {selectedTags.length > 0 && (
                            <NodeCount active={true}>
                              {selectedTags.length}
                            </NodeCount>
                          )}
                        </TreeNodeHeader>
                        <AnimatePresence>
                          {expandedNodes.tags && (
                            <TreeNodeChildren
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <TagsContainer>
                                {availableTags.map(tag => (
                                  <TagChip
                                    key={tag.name}
                                    selected={selectedTags.includes(tag.name)}
                                    onClick={() => handleTagToggle(tag.name)}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                  >
                                    #{tag.name}
                                    <TagCount>
                                      {tag.count}
                                    </TagCount>
                                  </TagChip>
                                ))}
                              </TagsContainer>
                            </TreeNodeChildren>
                          )}
                        </AnimatePresence>
                      </TreeNode>
                    </TagsSection>
                  </FilterSubSection>

                  {/* 필터 초기화 */}
                  <FilterSubSection>
                    <ResetButton onClick={onResetFilters}>
                      🔄 필터 초기화
                    </ResetButton>
                  </FilterSubSection>
                </FilterGroupContent>
              )}
            </AnimatePresence>
          </FilterGroupContainer>
        </Section>

        <Divider />

        {/* 정렬 그룹 */}
        <Section>
          <FilterGroupContainer>
            <FilterGroupHeader
              onClick={() => toggleNode('sortGroup')}
              expanded={expandedNodes.sortGroup}
            >
              <FilterGroupTitle>
                <FilterGroupIcon expanded={expandedNodes.sortGroup}>▶</FilterGroupIcon>
                📋 정렬
              </FilterGroupTitle>
            </FilterGroupHeader>
            
            <AnimatePresence>
              {expandedNodes.sortGroup && (
                <FilterGroupContent
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <FilterSubSection>
                    <SortSection>
                      <SortDropdown
                        value={sortBy}
                        onChange={(e) => onSortByChange(e.target.value)}
                      >
                        {sortOptions.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </SortDropdown>
                      <SortOrder>
                        <SortButton
                          active={sortOrder === 'asc'}
                          onClick={() => onSortOrderChange('asc')}
                        >
                          오름차순
                        </SortButton>
                        <SortButton
                          active={sortOrder === 'desc'}
                          onClick={() => onSortOrderChange('desc')}
                        >
                          내림차순
                        </SortButton>
                      </SortOrder>
                    </SortSection>
                  </FilterSubSection>
                </FilterGroupContent>
              )}
            </AnimatePresence>
          </FilterGroupContainer>
        </Section>


      </NavigationContent>
    </NavigationContainer>
  );
};

export default Navigation;
