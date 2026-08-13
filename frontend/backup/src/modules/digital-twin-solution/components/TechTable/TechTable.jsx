import React, { useState, useMemo, useRef, useCallback } from 'react';
import { Edit, Trash2, Filter, Search, ChevronUp, ChevronDown } from 'lucide-react';
import MaturityPanel from '../MaturityPanel/MaturityPanel';
import './TechTable.css';

const TechTable = ({ 
  data, 
  selectedTechnology, 
  onTechnologyClick,
  onTechnologyEdit,
  onTechnologyDelete
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSector, setFilterSector] = useState('all');
  const [filterRing, setFilterRing] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  // 필터링 및 정렬된 솔루션 목록
  const filteredAndSortedTechnologies = useMemo(() => {
    let filtered = data.technologies.filter(tech => {
      const matchesSearch = tech.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           tech.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSector = filterSector === 'all' || tech.sector === filterSector;
      const matchesRing = filterRing === 'all' || tech.ring === filterRing;
      
      return matchesSearch && matchesSector && matchesRing;
    });

    // 정렬
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'sector':
          aValue = data.sectors.find(s => s.id === a.sector)?.name || '';
          bValue = data.sectors.find(s => s.id === b.sector)?.name || '';
          break;
        case 'ring':
          // 링의 순서를 정의 (adopt이 가장 높은 우선순위)
          const ringOrder = { 'adopt': 1, 'trial': 2, 'assess': 3, 'hold': 4 };
          aValue = ringOrder[a.ring] || 999;
          bValue = ringOrder[b.ring] || 999;
          break;
        default:
          aValue = a[sortBy] || '';
          bValue = b[sortBy] || '';
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });

    return filtered;
  }, [data, searchTerm, filterSector, filterRing, sortBy, sortOrder]);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const getSectorInfo = (sectorId) => {
    return data.sectors.find(s => s.id === sectorId);
  };

  const getRingInfo = (ringId) => {
    return data.rings.find(r => r.id === ringId);
  };

  const getRingDisplayName = (ringId) => {
    const ringNames = {
      'adopt': 'ADOPT',
      'trial': 'TRIAL', 
      'assess': 'ASSESS',
      'hold': 'HOLD'
    };
    return ringNames[ringId] || ringId.toUpperCase();
  };

  const SortIcon = ({ field }) => {
    if (sortBy !== field) return <ChevronUp className="sort-icon invisible" />;
    return sortOrder === 'asc' ? 
      <ChevronUp className="sort-icon active" /> : 
      <ChevronDown className="sort-icon active" />;
  };

  if (!data.technologies || data.technologies.length === 0) {
    return (
      <div className="tech-table-container">
        <div className="empty-table">
          <div className="empty-icon">📊</div>
          <h3>데이터가 없습니다</h3>
          <p>솔루션을 추가하여 테이블 뷰를 확인해보세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tech-table-container">
      {/* 필터 및 검색 섹션 */}
      <div className="table-header">
        <div className="table-title">
          <h2>Digital Twin Solution Overview</h2>
          <div className="table-count">
            {filteredAndSortedTechnologies.length} of {data.technologies.length} solutions
          </div>
        </div>
        
        <div className="table-filters">
          <div className="maturity-panel-in-filters">
            <MaturityPanel />
          </div>
          
          <div className="search-box">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search solutions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="filter-group">
            <div className="filter-item">
              <Filter size={14} />
              <select 
                value={filterSector} 
                onChange={(e) => setFilterSector(e.target.value)}
              >
                <option value="all">All Domains</option>
                {data.sectors.map(sector => (
                  <option key={sector.id} value={sector.id}>
                    {sector.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="filter-item">
              <select 
                value={filterRing} 
                onChange={(e) => setFilterRing(e.target.value)}
              >
                <option value="all">All Stages</option>
                {data.rings.map(ring => (
                  <option key={ring.id} value={ring.id}>
                    {getRingDisplayName(ring.id)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 테이블 */}
      <div className="table-wrapper">
        <table className="tech-table">
          <thead>
            <tr>
              <th 
                className="sortable"
                onClick={() => handleSort('name')}
              >
                Solution
                <SortIcon field="name" />
              </th>
              <th 
                className="sortable"
                onClick={() => handleSort('sector')}
              >
                Domain
                <SortIcon field="sector" />
              </th>
              <th 
                className="sortable"
                onClick={() => handleSort('ring')}
              >
                Stage
                <SortIcon field="ring" />
              </th>
              <th>Description</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedTechnologies.map((tech, index) => {
              const sector = getSectorInfo(tech.sector);
              const ring = getRingInfo(tech.ring);
              const isSelected = selectedTechnology?.id === tech.id;
              const isAdopted = tech.isAdopted !== false; // 기본값은 true
              
              return (
                <tr 
                  key={tech.id}
                  className={`${isSelected ? 'selected' : ''} ${!isAdopted ? 'not-adopted' : ''}`}
                  onClick={() => onTechnologyClick(tech)}
                >
                  <td className="tech-name">
                    <div className="name-cell">
                      <span className="tech-title">{tech.name}</span>
                      {!isAdopted && (
                        <span className="adoption-indicator">미도입</span>
                      )}
                    </div>
                  </td>
                  <td className="sector-cell">
                    <div 
                      className="sector-badge"
                      style={{ backgroundColor: sector?.color + '20', color: sector?.color }}
                    >
                      {sector?.name || 'Unknown'}
                    </div>
                  </td>
                  <td className="ring-cell">
                    <div 
                      className={`ring-badge ring-${tech.ring}`}
                      style={{ backgroundColor: ring?.color + '20', color: ring?.color }}
                    >
                      {getRingDisplayName(tech.ring)}
                    </div>
                  </td>
                  <td className="description-cell">
                    <span className="description-text">
                      {tech.description || 'No description available'}
                    </span>
                  </td>
                  <td className="actions-cell">
                    <button 
                      className="action-btn edit-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTechnologyEdit(tech);
                      }}
                      title="Edit solution"
                    >
                      <Edit size={14} />
                    </button>
                    <button 
                      className="action-btn delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTechnologyDelete(tech.id);
                      }}
                      title="Delete solution"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredAndSortedTechnologies.length === 0 && (
        <div className="no-results">
          <div className="no-results-icon">🔍</div>
          <h3>No results found</h3>
          <p>Try adjusting your search or filters</p>
        </div>
      )}
    </div>
  );
};

export default TechTable;
