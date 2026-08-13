import React, { useState, useMemo } from 'react';
import styled from 'styled-components';
import { Eye, Edit, Trash2, FileText, Wrench, Calendar, Paperclip, Search, Filter, X, Image } from 'lucide-react';

const Container = styled.div`
  flex: 1;
  padding: 24px;
  background: #f8fafc;
  overflow-y: auto;
`;

const Header = styled.div`
  margin-bottom: 24px;
`;

const HeaderTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
`;

const TitleSection = styled.div``;

const Title = styled.h2`
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 8px 0;
`;

const Subtitle = styled.p`
  font-size: 14px;
  color: #64748b;
  margin: 0;
`;

const SearchFilterSection = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
`;

const SearchBox = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  min-width: 300px;
  transition: all 0.2s;

  &:focus-within {
    border-color: #8b5cf6;
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }
`;

const SearchInput = styled.input`
  flex: 1;
  border: none;
  outline: none;
  font-size: 14px;
  color: #1e293b;

  &::placeholder {
    color: #94a3b8;
  }
`;

const FilterDropdown = styled.div`
  position: relative;
`;

const FilterButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  color: ${props => props.$active ? '#8b5cf6' : '#64748b'};
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: #cbd5e1;
    background: #f8fafc;
  }
`;

const FilterMenu = styled.div`
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  min-width: 200px;
  z-index: 100;
  padding: 8px;
`;

const FilterOption = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  background: ${props => props.$selected ? '#f5f3ff' : 'transparent'};
  border: none;
  border-radius: 6px;
  font-size: 14px;
  color: ${props => props.$selected ? '#8b5cf6' : '#475569'};
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;

  &:hover {
    background: #f5f3ff;
  }
`;

const ActiveFilters = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const FilterTag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #f5f3ff;
  border-radius: 20px;
  font-size: 13px;
  color: #7c3aed;
`;

const FilterTagClose = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  color: #8b5cf6;
  border-radius: 50%;
  transition: all 0.2s;

  &:hover {
    background: #ddd6fe;
  }
`;

const ClearAllButton = styled.button`
  padding: 6px 12px;
  background: transparent;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  font-size: 13px;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #f1f5f9;
  }
`;

const ResultCount = styled.div`
  font-size: 13px;
  color: #64748b;
  padding: 8px 0;
`;

const CardsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
`;

const Card = styled.div`
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
  transition: all 0.2s;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    transform: translateY(-2px);
  }
`;

const CardThumbnail = styled.div`
  width: 100%;
  height: 200px;
  background: ${props => props.$hasImage ? 'transparent' : '#f1f5f9'};
  display: flex;
  align-items: center;
  justify-content: center;
  color: #cbd5e1;
  overflow: hidden;
`;

const ThumbnailImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #f8fafc;
`;

const CardHeader = styled.div`
  padding: 16px 20px;
  border-bottom: 1px solid #f1f5f9;
`;

const CardTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 8px 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const CardIcon = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #f5f3ff;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8b5cf6;
`;

const CardBody = styled.div`
  padding: 16px 20px;
`;

const InfoRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 14px;
  color: #64748b;

  &:last-child {
    margin-bottom: 0;
  }

  svg {
    flex-shrink: 0;
  }
`;

const InfoLabel = styled.span`
  color: #94a3b8;
  min-width: 70px;
`;

const InfoValue = styled.span`
  color: #475569;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const DescriptionPreview = styled.div`
  font-size: 13px;
  color: #64748b;
  line-height: 1.5;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f1f5f9;
  max-height: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;

  img {
    display: none;
  }
`;

const CardFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px;
  background: #f8fafc;
  border-top: 1px solid #f1f5f9;
`;

const ActionButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  background: ${props => props.$variant === 'view' ? '#eff6ff' :
                          props.$variant === 'edit' ? '#f0fdf4' :
                          props.$variant === 'delete' ? '#fef2f2' : '#f1f5f9'};
  color: ${props => props.$variant === 'view' ? '#3b82f6' :
                     props.$variant === 'edit' ? '#10b981' :
                     props.$variant === 'delete' ? '#ef4444' : '#64748b'};

  &:hover {
    background: ${props => props.$variant === 'view' ? '#dbeafe' :
                            props.$variant === 'edit' ? '#dcfce7' :
                            props.$variant === 'delete' ? '#fee2e2' : '#e2e8f0'};
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 60px 40px;
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
`;

const EmptyIcon = styled.div`
  width: 80px;
  height: 80px;
  background: #f5f3ff;
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
  color: #8b5cf6;
`;

const EmptyTitle = styled.h3`
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 8px 0;
`;

const EmptyText = styled.p`
  font-size: 14px;
  color: #64748b;
  margin: 0;
`;

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: #f1f5f9;
  border-radius: 4px;
  font-size: 12px;
  color: #64748b;
`;

const TestMethodsView = ({ testMethods = [], onView, onEdit, onDelete }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [filters, setFilters] = useState({
    hasAttachment: false,
    hasThumbnail: false,
    recentOnly: false,
  });

  // Get unique equipment list for potential future filtering
  const equipmentList = useMemo(() => {
    const equipments = testMethods
      .map(m => m.equipment)
      .filter(e => e && e.trim());
    return [...new Set(equipments)];
  }, [testMethods]);

  // Filter and search
  const filteredMethods = useMemo(() => {
    let result = [...testMethods];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(method =>
        (method.testName && method.testName.toLowerCase().includes(query)) ||
        (method.equipment && method.equipment.toLowerCase().includes(query)) ||
        (method.description && method.description.toLowerCase().includes(query))
      );
    }

    // Has attachment filter
    if (filters.hasAttachment) {
      result = result.filter(method => method.files && method.files.length > 0);
    }

    // Has thumbnail filter
    if (filters.hasThumbnail) {
      result = result.filter(method => method.thumbnail);
    }

    // Recent only filter (last 30 days)
    if (filters.recentOnly) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      result = result.filter(method => {
        if (!method.createdAt) return false;
        return new Date(method.createdAt) >= thirtyDaysAgo;
      });
    }

    return result;
  }, [testMethods, searchQuery, filters]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const toggleFilter = (filterKey) => {
    setFilters(prev => ({
      ...prev,
      [filterKey]: !prev[filterKey]
    }));
  };

  const clearAllFilters = () => {
    setFilters({
      hasAttachment: false,
      hasThumbnail: false,
      recentOnly: false,
    });
    setSearchQuery('');
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  if (testMethods.length === 0) {
    return (
      <Container>
        <Header>
          <Title>물성 시험 방법</Title>
          <Subtitle>시험 방법 및 절차를 관리합니다</Subtitle>
        </Header>
        <EmptyState>
          <EmptyIcon>
            <FileText size={40} />
          </EmptyIcon>
          <EmptyTitle>등록된 시험 방법이 없습니다</EmptyTitle>
          <EmptyText>
            상단의 "시험 방법 추가" 버튼을 클릭하여 새로운 시험 방법을 등록해주세요.
          </EmptyText>
        </EmptyState>
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <HeaderTop>
          <TitleSection>
            <Title>물성 시험 방법</Title>
            <Subtitle>총 {testMethods.length}개의 시험 방법이 등록되어 있습니다</Subtitle>
          </TitleSection>
        </HeaderTop>

        <SearchFilterSection>
          <SearchBox>
            <Search size={18} color="#94a3b8" />
            <SearchInput
              type="text"
              placeholder="시험명, 장비명으로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
              >
                <X size={16} color="#94a3b8" />
              </button>
            )}
          </SearchBox>

          <FilterDropdown>
            <FilterButton
              $active={activeFilterCount > 0}
              onClick={() => setShowFilterMenu(!showFilterMenu)}
            >
              <Filter size={16} />
              필터
              {activeFilterCount > 0 && ` (${activeFilterCount})`}
            </FilterButton>

            {showFilterMenu && (
              <FilterMenu>
                <FilterOption
                  $selected={filters.hasAttachment}
                  onClick={() => toggleFilter('hasAttachment')}
                >
                  <Paperclip size={16} />
                  첨부파일 있음
                </FilterOption>
                <FilterOption
                  $selected={filters.hasThumbnail}
                  onClick={() => toggleFilter('hasThumbnail')}
                >
                  <Image size={16} />
                  대표이미지 있음
                </FilterOption>
                <FilterOption
                  $selected={filters.recentOnly}
                  onClick={() => toggleFilter('recentOnly')}
                >
                  <Calendar size={16} />
                  최근 30일
                </FilterOption>
              </FilterMenu>
            )}
          </FilterDropdown>
        </SearchFilterSection>

        {(activeFilterCount > 0 || searchQuery) && (
          <ActiveFilters style={{ marginTop: '12px' }}>
            {searchQuery && (
              <FilterTag>
                검색: "{searchQuery}"
                <FilterTagClose onClick={() => setSearchQuery('')}>
                  <X size={12} />
                </FilterTagClose>
              </FilterTag>
            )}
            {filters.hasAttachment && (
              <FilterTag>
                첨부파일 있음
                <FilterTagClose onClick={() => toggleFilter('hasAttachment')}>
                  <X size={12} />
                </FilterTagClose>
              </FilterTag>
            )}
            {filters.hasThumbnail && (
              <FilterTag>
                대표이미지 있음
                <FilterTagClose onClick={() => toggleFilter('hasThumbnail')}>
                  <X size={12} />
                </FilterTagClose>
              </FilterTag>
            )}
            {filters.recentOnly && (
              <FilterTag>
                최근 30일
                <FilterTagClose onClick={() => toggleFilter('recentOnly')}>
                  <X size={12} />
                </FilterTagClose>
              </FilterTag>
            )}
            <ClearAllButton onClick={clearAllFilters}>
              모두 지우기
            </ClearAllButton>
          </ActiveFilters>
        )}

        {(searchQuery || activeFilterCount > 0) && (
          <ResultCount>
            검색 결과: {filteredMethods.length}개
          </ResultCount>
        )}
      </Header>

      {filteredMethods.length === 0 ? (
        <EmptyState>
          <EmptyIcon>
            <Search size={40} />
          </EmptyIcon>
          <EmptyTitle>검색 결과가 없습니다</EmptyTitle>
          <EmptyText>
            다른 검색어나 필터를 시도해보세요.
          </EmptyText>
        </EmptyState>
      ) : (
        <CardsGrid>
          {filteredMethods.map(method => (
            <Card key={method.id}>
              <CardThumbnail $hasImage={!!method.thumbnail}>
                {method.thumbnail ? (
                  <ThumbnailImage src={method.thumbnail} alt={method.testName} />
                ) : (
                  <Image size={48} />
                )}
              </CardThumbnail>

              <CardHeader>
                <CardTitle>
                  <CardIcon>
                    <FileText size={18} />
                  </CardIcon>
                  {method.testName}
                </CardTitle>
              </CardHeader>

              <CardBody>
                <InfoRow>
                  <Wrench size={16} />
                  <InfoLabel>장비:</InfoLabel>
                  <InfoValue>{method.equipment || '-'}</InfoValue>
                </InfoRow>

                <InfoRow>
                  <Calendar size={16} />
                  <InfoLabel>등록일:</InfoLabel>
                  <InfoValue>{formatDate(method.createdAt)}</InfoValue>
                </InfoRow>

                {method.files && method.files.length > 0 && (
                  <InfoRow>
                    <Paperclip size={16} />
                    <InfoLabel>첨부:</InfoLabel>
                    <Badge>
                      {method.files.length}개 파일
                    </Badge>
                  </InfoRow>
                )}

                {method.description && (
                  <DescriptionPreview
                    dangerouslySetInnerHTML={{ __html: method.description }}
                  />
                )}
              </CardBody>

              <CardFooter>
                <ActionButton $variant="view" onClick={() => onView(method)}>
                  <Eye size={14} />
                  보기
                </ActionButton>
                <ActionButton $variant="edit" onClick={() => onEdit(method)}>
                  <Edit size={14} />
                  수정
                </ActionButton>
                <ActionButton $variant="delete" onClick={() => onDelete(method.id)}>
                  <Trash2 size={14} />
                  삭제
                </ActionButton>
              </CardFooter>
            </Card>
          ))}
        </CardsGrid>
      )}
    </Container>
  );
};

export default TestMethodsView;
