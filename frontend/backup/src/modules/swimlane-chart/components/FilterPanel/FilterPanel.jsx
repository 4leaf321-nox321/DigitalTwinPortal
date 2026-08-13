import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Filter, X, Calendar, Tag, Users, BarChart3, FileText } from 'lucide-react';
import './FilterPanel.css';

const FilterPanel = ({ 
  cellData, 
  onFilterChange,
  isVisible = true,
  onToggleVisibility 
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeFilters, setActiveFilters] = useState({
    dateRange: { start: '', end: '' },
    categories: [],
    statuses: [],
    tags: [],
    owners: [],
    progressRange: { min: 0, max: 100 }
  });

  // 모든 프로세스 데이터에서 필터 옵션 추출
  const filterOptions = useMemo(() => {
    const allProcesses = [];
    Object.values(cellData || {}).forEach(cell => {
      if (cell.processes) {
        allProcesses.push(...cell.processes);
      }
    });

    const categories = [...new Set(allProcesses.map(p => p.category).filter(Boolean))];
    const statuses = [...new Set(allProcesses.map(p => p.status).filter(Boolean))];
    const tags = [...new Set(
      allProcesses.flatMap(p => 
        p.tags ? p.tags.split(',').map(tag => tag.trim()).filter(Boolean) : []
      )
    )];
    const owners = [...new Set(
      allProcesses.flatMap(p => {
        const owners = [];
        if (p.primaryOwner) owners.push(p.primaryOwner);
        if (p.collaborators) {
          owners.push(...p.collaborators.split(',').map(c => c.trim()).filter(Boolean));
        }
        return owners;
      })
    )];

    return { categories, statuses, tags, owners };
  }, [cellData]);

  // 카테고리별 한국어 표시명
  const categoryLabels = {
    'documentation': '문서화',
    'program_development': '프로그램 개발',
    'cae_development': 'CAE 개발',
    'testing': '테스트',
    'analysis': '분석',
    'design': '설계'
  };

  // 상태별 한국어 표시명과 색상
  const statusLabels = {
    'not_started': { label: '시작 전', color: '#6c757d' },
    'in_progress': { label: '진행 중', color: '#007bff' },
    'review': { label: '검토 중', color: '#ffc107' },
    'completed': { label: '완료', color: '#28a745' },
    'blocked': { label: '차단됨', color: '#dc3545' },
    'paused': { label: '일시 중단', color: '#fd7e14' }
  };

  const handleFilterChange = (filterType, value, isAdd = true) => {
    const newFilters = { ...activeFilters };
    
    switch (filterType) {
      case 'dateRange':
        newFilters.dateRange = { ...newFilters.dateRange, ...value };
        break;
      case 'progressRange':
        newFilters.progressRange = { ...newFilters.progressRange, ...value };
        break;
      case 'categories':
      case 'statuses':
      case 'tags':
      case 'owners':
        if (isAdd && !newFilters[filterType].includes(value)) {
          newFilters[filterType] = [...newFilters[filterType], value];
        } else if (!isAdd) {
          newFilters[filterType] = newFilters[filterType].filter(item => item !== value);
        }
        break;
    }

    setActiveFilters(newFilters);
    onFilterChange && onFilterChange(newFilters);
  };

  const clearFilter = (filterType, value = null) => {
    const newFilters = { ...activeFilters };
    
    if (value) {
      // 특정 값만 제거
      newFilters[filterType] = newFilters[filterType].filter(item => item !== value);
    } else {
      // 전체 필터 타입 초기화
      switch (filterType) {
        case 'dateRange':
          newFilters.dateRange = { start: '', end: '' };
          break;
        case 'progressRange':
          newFilters.progressRange = { min: 0, max: 100 };
          break;
        default:
          newFilters[filterType] = [];
      }
    }

    setActiveFilters(newFilters);
    onFilterChange && onFilterChange(newFilters);
  };

  const clearAllFilters = () => {
    const newFilters = {
      dateRange: { start: '', end: '' },
      categories: [],
      statuses: [],
      tags: [],
      owners: [],
      progressRange: { min: 0, max: 100 }
    };
    setActiveFilters(newFilters);
    onFilterChange && onFilterChange(newFilters);
  };

  // 활성 필터 개수 계산
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (activeFilters.dateRange.start || activeFilters.dateRange.end) count++;
    if (activeFilters.progressRange.min > 0 || activeFilters.progressRange.max < 100) count++;
    count += activeFilters.categories.length;
    count += activeFilters.statuses.length;
    count += activeFilters.tags.length;
    count += activeFilters.owners.length;
    return count;
  }, [activeFilters]);

  if (!isVisible) return null;

  return (
    <div className="filter-panel">
      <div className="filter-header">
        <div className="filter-title">
          <button 
            className="filter-toggle-btn"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            <Filter size={18} />
            <span>필터</span>
            {activeFilterCount > 0 && (
              <span className="filter-count">{activeFilterCount}</span>
            )}
          </button>
        </div>
        
        <div className="filter-actions">
          {activeFilterCount > 0 && (
            <button 
              className="clear-all-btn"
              onClick={clearAllFilters}
              title="모든 필터 초기화"
            >
              전체 초기화
            </button>
          )}
          <button 
            className="panel-close-btn"
            onClick={onToggleVisibility}
            title="필터 패널 닫기"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="filter-content">
          {/* 활성 필터 표시 */}
          {activeFilterCount > 0 && (
            <div className="active-filters">
              <div className="active-filters-title">활성 필터:</div>
              <div className="active-filter-chips">
                {/* 날짜 범위 필터 */}
                {(activeFilters.dateRange.start || activeFilters.dateRange.end) && (
                  <div className="filter-chip">
                    <Calendar size={12} />
                    <span>
                      {activeFilters.dateRange.start || '시작'} ~ {activeFilters.dateRange.end || '종료'}
                    </span>
                    <button onClick={() => clearFilter('dateRange')}>
                      <X size={12} />
                    </button>
                  </div>
                )}

                {/* 진행률 범위 필터 */}
                {(activeFilters.progressRange.min > 0 || activeFilters.progressRange.max < 100) && (
                  <div className="filter-chip">
                    <BarChart3 size={12} />
                    <span>
                      {activeFilters.progressRange.min}% ~ {activeFilters.progressRange.max}%
                    </span>
                    <button onClick={() => clearFilter('progressRange')}>
                      <X size={12} />
                    </button>
                  </div>
                )}

                {/* 카테고리 필터 */}
                {activeFilters.categories.map(category => (
                  <div key={category} className="filter-chip category-chip">
                    <FileText size={12} />
                    <span>{categoryLabels[category] || category}</span>
                    <button onClick={() => clearFilter('categories', category)}>
                      <X size={12} />
                    </button>
                  </div>
                ))}

                {/* 상태 필터 */}
                {activeFilters.statuses.map(status => (
                  <div key={status} className="filter-chip status-chip">
                    <div 
                      className="status-indicator"
                      style={{ backgroundColor: statusLabels[status]?.color || '#6c757d' }}
                    />
                    <span>{statusLabels[status]?.label || status}</span>
                    <button onClick={() => clearFilter('statuses', status)}>
                      <X size={12} />
                    </button>
                  </div>
                ))}

                {/* 태그 필터 */}
                {activeFilters.tags.map(tag => (
                  <div key={tag} className="filter-chip tag-chip">
                    <Tag size={12} />
                    <span>{tag}</span>
                    <button onClick={() => clearFilter('tags', tag)}>
                      <X size={12} />
                    </button>
                  </div>
                ))}

                {/* 담당자 필터 */}
                {activeFilters.owners.map(owner => (
                  <div key={owner} className="filter-chip owner-chip">
                    <Users size={12} />
                    <span>{owner}</span>
                    <button onClick={() => clearFilter('owners', owner)}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 필터 그룹들 */}
          <div className="filter-groups">
            {/* 날짜 기간 필터 */}
            <div className="filter-group">
              <div className="filter-group-title">
                <Calendar size={16} />
                <span>날짜 기간</span>
              </div>
              <div className="date-range-inputs">
                <input
                  type="date"
                  value={activeFilters.dateRange.start}
                  onChange={(e) => handleFilterChange('dateRange', { start: e.target.value })}
                  className="date-input"
                  placeholder="시작일"
                />
                <span className="date-separator">~</span>
                <input
                  type="date"
                  value={activeFilters.dateRange.end}
                  onChange={(e) => handleFilterChange('dateRange', { end: e.target.value })}
                  className="date-input"
                  placeholder="종료일"
                />
              </div>
            </div>

            {/* 카테고리 필터 */}
            <div className="filter-group">
              <div className="filter-group-title">
                <FileText size={16} />
                <span>카테고리</span>
              </div>
              <div className="filter-options">
                {filterOptions.categories.map(category => (
                  <label key={category} className="filter-option">
                    <input
                      type="checkbox"
                      checked={activeFilters.categories.includes(category)}
                      onChange={(e) => handleFilterChange('categories', category, e.target.checked)}
                    />
                    <span>{categoryLabels[category] || category}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 상태 필터 */}
            <div className="filter-group">
              <div className="filter-group-title">
                <BarChart3 size={16} />
                <span>상태</span>
              </div>
              <div className="filter-options">
                {filterOptions.statuses.map(status => (
                  <label key={status} className="filter-option status-option">
                    <input
                      type="checkbox"
                      checked={activeFilters.statuses.includes(status)}
                      onChange={(e) => handleFilterChange('statuses', status, e.target.checked)}
                    />
                    <div className="status-content">
                      <div 
                        className="status-indicator"
                        style={{ backgroundColor: statusLabels[status]?.color || '#6c757d' }}
                      />
                      <span>{statusLabels[status]?.label || status}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* 태그 필터 */}
            <div className="filter-group">
              <div className="filter-group-title">
                <Tag size={16} />
                <span>태그</span>
              </div>
              <div className="filter-options">
                {filterOptions.tags.map(tag => (
                  <label key={tag} className="filter-option">
                    <input
                      type="checkbox"
                      checked={activeFilters.tags.includes(tag)}
                      onChange={(e) => handleFilterChange('tags', tag, e.target.checked)}
                    />
                    <span>{tag}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 담당자 필터 */}
            <div className="filter-group">
              <div className="filter-group-title">
                <Users size={16} />
                <span>담당자</span>
              </div>
              <div className="filter-options">
                {filterOptions.owners.map(owner => (
                  <label key={owner} className="filter-option">
                    <input
                      type="checkbox"
                      checked={activeFilters.owners.includes(owner)}
                      onChange={(e) => handleFilterChange('owners', owner, e.target.checked)}
                    />
                    <span>{owner}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 진행률 필터 */}
            <div className="filter-group">
              <div className="filter-group-title">
                <BarChart3 size={16} />
                <span>진행률</span>
              </div>
              <div className="progress-range-inputs">
                <div className="range-input-group">
                  <label>최소:</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={activeFilters.progressRange.min}
                    onChange={(e) => handleFilterChange('progressRange', { min: parseInt(e.target.value) || 0 })}
                    className="progress-input"
                  />
                  <span>%</span>
                </div>
                <div className="range-input-group">
                  <label>최대:</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={activeFilters.progressRange.max}
                    onChange={(e) => handleFilterChange('progressRange', { max: parseInt(e.target.value) || 100 })}
                    className="progress-input"
                  />
                  <span>%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterPanel;