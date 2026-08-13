import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Plus, Edit, Trash2, Search, Filter } from 'lucide-react';
import './TechnologyPanel.css';

const TechnologyPanel = forwardRef(({ 
  data, 
  selectedTechnology, 
  onTechnologySelect, 
  onTechnologyAdd, 
  onTechnologyEdit, 
  onTechnologyDelete,
  onEditRequest
}, ref) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState('');
  const [selectedRing, setSelectedRing] = useState('');

  // ref를 통해 상위 컴포넌트에서 호출할 수 있는 메서드들 (현재는 사용안함)
  useImperativeHandle(ref, () => ({
    // 더 이상 필요없지만 호환성을 위해 남겨둘 수 있음
  }));

  // 필터링된 기술 목록
  const filteredTechnologies = data.technologies?.filter(tech => {
    const matchesSearch = tech.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tech.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSector = !selectedSector || tech.sector === selectedSector;
    const matchesRing = !selectedRing || tech.ring === selectedRing;
    return matchesSearch && matchesSector && matchesRing;
  }) || [];

  const handleEditTechnology = (tech) => {
    // 상위 컴포넌트에 편집 요청을 위임
    if (onEditRequest) {
      onEditRequest(tech);
    }
  };

  const getSectorColor = (sectorId) => {
    const sector = data.sectors?.find(s => s.id === sectorId);
    return sector ? sector.color : '#64748b';
  };

  const getRingColor = (ringId) => {
    const ring = data.rings?.find(r => r.id === ringId);
    return ring ? ring.color : '#64748b';
  };

  return (
    <div className="technology-panel">
      <div className="panel-header">
        <h3>Technology List</h3>
      </div>

      {/* 검색 및 필터 */}
      <div className="filters-section">
        <div className="search-container">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="기술 이름이나 설명으로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="filter-container">
          <Filter size={16} className="filter-icon" />
          <select
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            className="filter-select"
          >
            <option value="">All Sectors</option>
            {data.sectors?.map(sector => (
              <option key={sector.id} value={sector.id}>
                {sector.name}
              </option>
            ))}
          </select>
          
          <select
            value={selectedRing}
            onChange={(e) => setSelectedRing(e.target.value)}
            className="filter-select"
          >
            <option value="">All Rings</option>
            {data.rings?.map(ring => (
              <option key={ring.id} value={ring.id}>
                {ring.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 기술 목록 */}
      <div className="technology-list">
        <div className="list-header">
          <span className="count-badge">{filteredTechnologies.length} technologies</span>
        </div>
        
        {filteredTechnologies.map((tech, index) => {
          const sector = data.sectors?.find(s => s.id === tech.sector);
          const ring = data.rings?.find(r => r.id === tech.ring);
          const isSelected = selectedTechnology?.id === tech.id;
          
          return (
            <div 
              key={tech.id} 
              className={`technology-item ${isSelected ? 'selected' : ''}`}
              onClick={() => onTechnologySelect(tech)}
            >
              <div className="tech-header">
                <div className="tech-info">
                  <div className="tech-number">{index + 1}</div>
                  <div className="tech-details">
                    <div className="tech-name">{tech.name}</div>
                    <div className="tech-meta">
                      <span 
                        className="sector-badge"
                        style={{ backgroundColor: getSectorColor(tech.sector) }}
                      >
                        {sector?.name || 'Unknown'}
                      </span>
                      <span 
                        className="ring-badge"
                        style={{ backgroundColor: getRingColor(tech.ring) }}
                      >
                        {ring?.name || 'Unknown'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="tech-actions">
                  <button 
                    className="action-btn edit-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditTechnology(tech);
                    }}
                    title="편집"
                  >
                    <Edit size={14} />
                  </button>
                  <button 
                    className="action-btn delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`"${tech.name}"을(를) 삭제하시겠습니까?`)) {
                        onTechnologyDelete(tech.id);
                      }
                    }}
                    title="삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              
              {tech.description && (
                <div className="tech-description">
                  {tech.description}
                </div>
              )}
              
              {isSelected && (
                <div className="selected-indicator">
                  레이더에서 선택됨
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredTechnologies.length === 0 && (
        <div className="empty-state">
          <p>검색 조건에 맞는 기술이 없습니다.</p>
        </div>
      )}
    </div>
  );
});

export default TechnologyPanel;