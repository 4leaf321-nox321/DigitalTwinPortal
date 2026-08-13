import React from 'react';
import styled from 'styled-components';
import { X, ChevronDown, Search } from 'lucide-react';

const FiltersSection = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  background: rgba(55, 65, 81, 0.3);
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  overflow: visible;
  position: relative;
`;

const FilterGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  position: relative;
  z-index: 1;
  
  &.open {
    z-index: 1000;
  }
  
  /* filter-group 클래스를 추가하여 외부 클릭 감지가 가능하도록 함 */
  &.filter-group {
    /* 기존 스타일 유지 */
  }
`;

const FilterLabel = styled.label`
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
`;

const FilterButton = styled.button`
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: 0.375rem;
  color: #374151;
  padding: 0.5rem 2.2rem 0.5rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: ${props => props.isTaskCategory ? '330px' : '110px'};
  text-align: left;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  
  &:hover {
    background: rgba(255, 255, 255, 1);
    border-color: #374151;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  
  &.open {
    background: rgba(255, 255, 255, 1);
    border-color: #374151;
    box-shadow: 0 0 0 3px rgba(55, 65, 81, 0.2);
  }
  
  .dropdown-icon {
    position: absolute;
    right: 0.5rem;
    transition: transform 0.2s ease;
  }
  
  &.open .dropdown-icon {
    transform: rotate(180deg);
  }
`;

const FilterDropdown = styled.div`
  position: absolute;
  top: calc(100% + 0.25rem);
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  z-index: 1001;
  max-height: ${props => props.isTaskCategory ? 'none' : '200px'};
  overflow-y: ${props => props.isTaskCategory ? 'visible' : 'auto'};
  min-width: ${props => props.isTaskCategory ? '330px' : '150px'};
`;

const FilterOption = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  color: #374151;
  cursor: pointer;
  transition: background 0.2s ease;
  
  &:hover {
    background: #f3f4f6;
  }
  
  &.selected {
    background: #ecfdf5;
    color: #374151;
    font-weight: 600;
  }
`;

const FilterCheckbox = styled.div`
  width: 1rem;
  height: 1rem;
  border: 2px solid #d1d5db;
  border-radius: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  transition: all 0.2s ease;
  flex-shrink: 0;
  
  &.checked {
    background: #374151;
    border-color: #374151;
    color: white;
  }
`;

const FilterClear = styled.button`
  position: absolute;
  right: 2.2rem;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(107, 114, 128, 0.2);
  border: none;
  color: #6b7280;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 0.25rem;
  transition: all 0.2s ease;
  z-index: 10;
  width: 1.25rem;
  height: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    color: white;
    background: rgba(239, 68, 68, 0.8);
    transform: translateY(-50%) scale(1.1);
  }
`;

const ClearAllButton = styled.button`
  background: rgba(239, 68, 68, 0.2);
  border: 1px solid rgba(239, 68, 68, 0.5);
  border-radius: 0.375rem;
  color: white;
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.25rem;

  &:hover {
    background: rgba(239, 68, 68, 0.3);
  }
`;

const PeriodFilterGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const PeriodButtonGroup = styled.div`
  display: flex;
  gap: 0.25rem;
  background: rgba(55, 65, 81, 0.5);
  border-radius: 0.375rem;
  padding: 0.25rem;
`;

const PeriodButton = styled.button`
  background: ${props => props.active ? 'rgba(139, 92, 246, 0.8)' : 'transparent'};
  border: 1px solid ${props => props.active ? 'rgba(139, 92, 246, 1)' : 'rgba(255, 255, 255, 0.2)'};
  border-radius: 0.25rem;
  color: white;
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  font-weight: ${props => props.active ? '600' : '500'};
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;

  &:hover {
    background: ${props => props.active ? 'rgba(139, 92, 246, 0.9)' : 'rgba(255, 255, 255, 0.1)'};
  }
`;

const SearchGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-left: auto;
`;

const SearchInputWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const SearchInput = styled.input`
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: 0.375rem;
  color: #374151;
  padding: 0.5rem 0.75rem 0.5rem 2.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  min-width: 250px;
  transition: all 0.2s ease;

  &::placeholder {
    color: #9ca3af;
  }

  &:focus {
    outline: none;
    background: rgba(255, 255, 255, 1);
    border-color: #374151;
    box-shadow: 0 0 0 3px rgba(55, 65, 81, 0.2);
  }

  &:hover {
    background: rgba(255, 255, 255, 1);
    border-color: #9ca3af;
  }
`;

const SearchIcon = styled(Search)`
  position: absolute;
  left: 0.625rem;
  color: #6b7280;
  pointer-events: none;
`;

const SearchClearButton = styled.button`
  position: absolute;
  right: 0.5rem;
  background: rgba(107, 114, 128, 0.2);
  border: none;
  color: #6b7280;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 0.25rem;
  transition: all 0.2s ease;
  width: 1.25rem;
  height: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: white;
    background: rgba(239, 68, 68, 0.8);
    transform: scale(1.1);
  }
`;

const GanttFilters = ({
  filters,
  onFilterChange,
  onClearFilter,
  onClearAllFilters,
  openDropdown,
  onToggleDropdown,
  filterOptions,
  searchQuery,
  onSearchChange,
  periodFilter,
  onPeriodFilterChange
}) => {
  const getFilterDisplayText = (filterType, options) => {
    const selected = filters[filterType] || [];
    if (selected.length === 0) return '전체';
    if (selected.length === 1) return selected[0];
    if (selected.length === options.length) return '전체 선택됨';
    return `${selected.length}개 선택됨`;
  };

  const hasActiveFilters = Object.values(filters).some(filter => filter.length > 0) || periodFilter !== '전체';

  const FILTER_LABELS = {
    진행상태: '진행 상태'
  };
  const getFilterLabel = (filterType) => FILTER_LABELS[filterType] || filterType;

  return (
    <FiltersSection>
      {hasActiveFilters && (
        <ClearAllButton
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClearAllFilters();
          }}
          title="모든 필터 지우기"
        >
          <X size={12} />
          전체 해제
        </ClearAllButton>
      )}

      <PeriodFilterGroup>
        <FilterLabel>기간</FilterLabel>
        <PeriodButtonGroup>
          <PeriodButton
            active={periodFilter === '최근 1주일'}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPeriodFilterChange('최근 1주일');
            }}
          >
            최근 1주일
          </PeriodButton>
          <PeriodButton
            active={periodFilter === '최근 1개월'}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPeriodFilterChange('최근 1개월');
            }}
          >
            최근 1개월
          </PeriodButton>
          <PeriodButton
            active={periodFilter === '전체'}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPeriodFilterChange('전체');
            }}
          >
            전체
          </PeriodButton>
        </PeriodButtonGroup>
      </PeriodFilterGroup>

      {Object.entries(filterOptions).map(([filterType, options]) => (
        <FilterGroup
          key={filterType}
          className={`filter-group ${openDropdown === filterType ? 'open' : ''}`}
        >
          <FilterLabel>{getFilterLabel(filterType)}</FilterLabel>
          <div style={{ position: 'relative' }}>
            <FilterButton
              className={openDropdown === filterType ? 'open' : ''}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleDropdown(filterType);
              }}
              type="button"
              isTaskCategory={filterType === '과제구분'}
            >
              <span>{getFilterDisplayText(filterType, options)}</span>
              <ChevronDown size={14} className="dropdown-icon" />
            </FilterButton>
            {openDropdown === filterType && (
              <FilterDropdown isTaskCategory={filterType === '과제구분'}>
                {options.map(option => {
                  const isSelected = filters[filterType].includes(option);
                  return (
                    <FilterOption
                      key={option}
                      className={isSelected ? 'selected' : ''}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onFilterChange(filterType, option);
                      }}
                    >
                      <FilterCheckbox className={isSelected ? 'checked' : ''}>
                        {isSelected && '✓'}
                      </FilterCheckbox>
                      {option}
                    </FilterOption>
                  );
                })}
              </FilterDropdown>
            )}
            {filters[filterType].length > 0 && (
              <FilterClear
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onClearFilter(filterType);
                }}
                title="필터 지우기"
                type="button"
              >
                <X size={14} />
              </FilterClear>
            )}
          </div>
        </FilterGroup>
      ))}

      <SearchGroup>
        <FilterLabel>검색</FilterLabel>
        <SearchInputWrapper>
          <SearchIcon size={16} />
          <SearchInput
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="과제, 성과, 액션아이템, 참여인력 검색..."
          />
          {searchQuery && (
            <SearchClearButton
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSearchChange('');
              }}
              title="검색 지우기"
              type="button"
            >
              <X size={14} />
            </SearchClearButton>
          )}
        </SearchInputWrapper>
      </SearchGroup>
    </FiltersSection>
  );
};

export default GanttFilters;