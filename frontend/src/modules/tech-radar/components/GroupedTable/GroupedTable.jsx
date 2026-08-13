import React, { useState, useMemo, useRef, useCallback } from 'react';
import { Edit, Trash2, Filter, Search, ChevronDown, ChevronRight } from 'lucide-react';
import MaturityPanel from '../MaturityPanel/MaturityPanel';
import './GroupedTable.css';

const GroupedTable = ({ 
  data, 
  selectedTechnology, 
  onTechnologyClick,
  onTechnologyEdit,
  onTechnologyDelete
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSector, setFilterSector] = useState('all');
  const [filterRing, setFilterRing] = useState('all');
  const [collapsedSectors, setCollapsedSectors] = useState(new Set());
  const [cardSize, setCardSize] = useState(360); // 기본 카드 크기
  const [isResizingCard, setIsResizingCard] = useState(false);
  const resizeStartX = useRef(0);
  const resizeStartSize = useRef(0);

  // 도메인별로 그룹화된 데이터 생성
  const groupedData = useMemo(() => {
    // 먼저 필터링
    let filtered = data.technologies.filter(tech => {
      const matchesSearch = tech.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           tech.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSector = filterSector === 'all' || tech.sector === filterSector;
      const matchesRing = filterRing === 'all' || tech.ring === filterRing;
      
      return matchesSearch && matchesSector && matchesRing;
    });

    // 도메인별로 그룹화
    const grouped = {};
    
    data.sectors.forEach(sector => {
      const sectorTechs = filtered.filter(tech => tech.sector === sector.id);
      if (sectorTechs.length > 0) {
        grouped[sector.id] = {
          sector,
          technologies: {
            adopt: sectorTechs.filter(t => t.ring === 'adopt'),
            trial: sectorTechs.filter(t => t.ring === 'trial'),
            assess: sectorTechs.filter(t => t.ring === 'assess'),
            hold: sectorTechs.filter(t => t.ring === 'hold')
          }
        };
      }
    });

    return grouped;
  }, [data, searchTerm, filterSector, filterRing]);

  const getRingDisplayName = (ringId) => {
    const ringNames = {
      'adopt': 'Adopt',
      'trial': 'Trial',
      'assess': 'Assess',
      'hold': 'Hold'
    };
    return ringNames[ringId] || ringId;
  };

  const getRingInfo = (ringId) => {
    return data.rings.find(r => r.id === ringId);
  };

  const toggleSectorCollapse = (sectorId) => {
    const newCollapsed = new Set(collapsedSectors);
    if (newCollapsed.has(sectorId)) {
      newCollapsed.delete(sectorId);
    } else {
      newCollapsed.add(sectorId);
    }
    setCollapsedSectors(newCollapsed);
  };

  const totalTechnologies = useMemo(() => {
    return Object.values(groupedData).reduce((total, sectorData) => {
      return total + Object.values(sectorData.technologies).reduce((sectorTotal, techs) => {
        return sectorTotal + techs.length;
      }, 0);
    }, 0);
  }, [groupedData]);

  // 디버깅 함수
  const handleEditClick = (e, tech) => {
    e.stopPropagation();
    console.log('Edit clicked for:', tech.name, 'Function available:', typeof onTechnologyEdit);
    if (onTechnologyEdit) {
      onTechnologyEdit(tech);
    }
  };

  const handleDeleteClick = (e, tech) => {
    e.stopPropagation();
    console.log('Delete clicked for:', tech.name, 'Function available:', typeof onTechnologyDelete);
    if (onTechnologyDelete) {
      onTechnologyDelete(tech.id);
    }
  };

  // 카드 크기 리사이징 핸들러
  const handleCardResizeMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsResizingCard(true);
    resizeStartX.current = e.clientX;
    resizeStartSize.current = cardSize;

    const handleMouseMove = (e) => {
      const diff = e.clientX - resizeStartX.current;
      const newSize = Math.max(200, Math.min(600, resizeStartSize.current + diff));
      setCardSize(newSize);
    };

    const handleMouseUp = () => {
      setIsResizingCard(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [cardSize]);

  const CardResizeHandle = () => (
    <div
      className={`card-resize-handle ${isResizingCard ? 'resizing' : ''}`}
      onMouseDown={handleCardResizeMouseDown}
      title="Drag to resize cards"
    >
      ↔
    </div>
  );

  if (!data.technologies || data.technologies.length === 0) {
    return (
      <div className="grouped-table-container">
        <div className="empty-table">
          <div className="empty-icon">📊</div>
          <h3>데이터가 없습니다</h3>
          <p>기술을 추가하여 그룹화된 뷰를 확인해보세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grouped-table-container">
      {/* 필터 및 검색 섹션 */}
      <div className="grouped-header">
        <div className="grouped-title">
          <h2>Technology Overview by Domain</h2>
          <div className="grouped-count">
            {totalTechnologies} of {data.technologies.length} technologies
          </div>
        </div>
        
        <div className="grouped-filters">
          <div className="maturity-panel-in-filters">
            <MaturityPanel />
          </div>
          
          <CardResizeHandle />
          
          <div className="search-box">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search technologies..."
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

      {/* 그룹화된 콘텐츠 */}
      <div className="grouped-content">
        {Object.entries(groupedData).map(([sectorId, sectorData]) => {
          const isCollapsed = collapsedSectors.has(sectorId);
          const sectorTotalCount = Object.values(sectorData.technologies).reduce((sum, techs) => sum + techs.length, 0);
          
          return (
            <div key={sectorId} className="sector-group">
              <div 
                className="sector-header"
                onClick={() => toggleSectorCollapse(sectorId)}
              >
                <div className="sector-title-area">
                  {isCollapsed ? 
                    <ChevronRight size={20} className="collapse-icon" /> :
                    <ChevronDown size={20} className="collapse-icon" />
                  }
                  <h3 
                    className="sector-title"
                    style={{ color: sectorData.sector.color }}
                  >
                    {sectorData.sector.name}
                  </h3>
                </div>
                <div className="sector-count">
                  {sectorTotalCount} technologies
                </div>
              </div>
              
              {!isCollapsed && (
                <div className="sector-content">
                  {['adopt', 'trial', 'assess', 'hold'].map(ringId => {
                    const technologies = sectorData.technologies[ringId];
                    if (!technologies || technologies.length === 0) return null;
                    
                    const ringInfo = getRingInfo(ringId);
                    
                    return (
                      <div key={ringId} className="ring-section">
                        <h4 
                          className={`ring-title ring-${ringId}`}
                          style={{ color: ringInfo?.color }}
                        >
                          {getRingDisplayName(ringId)}
                        </h4>
                        <div 
                          className="technology-grid"
                          style={{
                            gridTemplateColumns: `repeat(auto-fill, minmax(${cardSize}px, 1fr))`
                          }}
                        >
                          {technologies.map(tech => {
                            const isSelected = selectedTechnology?.id === tech.id;
                            const isAdopted = tech.isAdopted !== false; // 기본값은 true
                            
                            return (
                              <div 
                                key={tech.id}
                                className={`technology-chip ${isSelected ? 'selected' : ''} ${!isAdopted ? 'not-adopted' : ''}`}
                                onClick={() => onTechnologyClick(tech)}
                                title={tech.description || tech.name}
                              >
                                <div className="tech-info">
                                  <span className="tech-name">{tech.name}</span>
                                  {!isAdopted && (
                                    <span className="adoption-indicator">미도입</span>
                                  )}
                                </div>
                                <div className="tech-actions">
                                  <button 
                                    className="action-btn edit-btn"
                                    onClick={(e) => handleEditClick(e, tech)}
                                    title="Edit technology"
                                    type="button"
                                  >
                                    <Edit size={12} />
                                  </button>
                                  <button 
                                    className="action-btn delete-btn"
                                    onClick={(e) => handleDeleteClick(e, tech)}
                                    title="Delete technology"
                                    type="button"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {totalTechnologies === 0 && (
        <div className="no-results">
          <div className="no-results-icon">🔍</div>
          <h3>No results found</h3>
          <p>Try adjusting your search or filters</p>
        </div>
      )}
    </div>
  );
};

export default GroupedTable;