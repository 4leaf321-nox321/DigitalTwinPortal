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
  const [selectedAdoption, setSelectedAdoption] = useState(''); // 도입 여부 필터 추가

  // ref를 통해 상위 컴포넌트에서 호출할 수 있는 메서드들
  useImperativeHandle(ref, () => ({
    // 호환성을 위해 유지
  }));

  // 안전한 데이터 접근
  const safeTechnologies = data?.technologies || [];
  const safeSectors = data?.sectors || [];
  const safeRings = data?.rings || [];

  // 필터링된 기술 목록
  const filteredTechnologies = safeTechnologies.filter(tech => {
    const matchesSearch = (tech.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (tech.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSector = !selectedSector || tech.sector === selectedSector;
    const matchesRing = !selectedRing || tech.ring === selectedRing;
    const matchesAdoption = !selectedAdoption || 
                          (selectedAdoption === 'adopted' && tech.isAdopted !== false) ||
                          (selectedAdoption === 'not-adopted' && tech.isAdopted === false);
    return matchesSearch && matchesSector && matchesRing && matchesAdoption;
  });

  const handleEditTechnology = (e, tech) => {
    e.stopPropagation();
    console.log('Edit button clicked for solution:', tech.name);
    if (onEditRequest) {
      onEditRequest(tech);
    }
  };

  const handleDeleteTechnology = (e, tech) => {
    e.stopPropagation();
    console.log('Delete button clicked for solution:', tech.name);
    if (window.confirm(`"${tech.name}"을(를) 삭제하시겠습니까?`)) {
      onTechnologyDelete(tech.id);
    }
  };

  const getSectorColor = (sectorId) => {
    const sector = safeSectors.find(s => s.id === sectorId);
    return sector?.color || '#64748b';
  };

  const getRingColor = (ringId) => {
    const ring = safeRings.find(r => r.id === ringId);
    return ring?.color || '#64748b';
  };

  return (
    <div className="technology-panel">
      <div className="panel-header">
        <h3>기술 리스트</h3>
      </div>

      {/* 필터 */}
      <div className="filters-section">
        <div className="filter-container">
          <div className="filter-row">
            <Filter size={16} className="filter-icon" />
            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="filter-select"
            >
              <option value="">All Sectors</option>
              {safeSectors.map(sector => (
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
              {safeRings.map(ring => (
                <option key={ring.id} value={ring.id}>
                  {ring.name}
                </option>
              ))}
            </select>

            <select
              value={selectedAdoption}
              onChange={(e) => setSelectedAdoption(e.target.value)}
              className="filter-select adoption-filter"
            >
              <option value="">All Status</option>
              <option value="adopted">도입됨</option>
              <option value="not-adopted">미도입</option>
            </select>
          </div>
          
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
        </div>
      </div>

      {/* 솔루션 목록 */}
      <div className="technology-list">
        <div className="list-header">
          <span className="count-badge">{filteredTechnologies.length} solutions</span>
        </div>
        
        {filteredTechnologies.map((tech, index) => {
          const sector = safeSectors.find(s => s.id === tech.sector);
          const ring = safeRings.find(r => r.id === tech.ring);
          const isSelected = selectedTechnology?.id === tech.id;
          const isAdopted = tech.isAdopted !== false; // 기본값은 true
          
          // 고유한 키 생성 - tech.id가 없을 경우 fallback
          const uniqueKey = tech.id || `tech-${index}-${tech.name?.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now()}`;
          
          return (
            <div 
              key={uniqueKey}
              className={`technology-item ${isSelected ? 'selected' : ''} ${!isAdopted ? 'not-adopted' : ''}`}
              onClick={() => onTechnologySelect(tech)}
            >
              <div className="tech-header">
                <div className="tech-info">
                  <div className="tech-number">{index + 1}</div>
                  <div className="tech-details">
                    <div className="tech-name">
                      {tech.name || 'Unnamed Solution'}
                      <span className={`adoption-status-indicator ${isAdopted ? 'adopted' : 'not-adopted'}`}>
                        {isAdopted ? '도입됨' : '미도입'}
                      </span>
                    </div>
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
                
                {/* 액션 버튼들 */}
                <div className="tech-actions">
                  <button 
                    className="action-btn edit-btn"
                    onClick={(e) => handleEditTechnology(e, tech)}
                    title="편집"
                    type="button"
                  >
                    <Edit size={16} />
                  </button>
                  <button 
                    className="action-btn delete-btn"
                    onClick={(e) => handleDeleteTechnology(e, tech)}
                    title="삭제"
                    type="button"
                  >
                    <Trash2 size={16} />
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
          <p>검색 조건에 맞는 솔루션이 없습니다.</p>
        </div>
      )}
    </div>
  );
});

TechnologyPanel.displayName = 'TechnologyPanel';

export default TechnologyPanel;
