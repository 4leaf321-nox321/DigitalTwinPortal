import React, { useState, useMemo, useRef, useCallback } from 'react';
import { Edit, Trash2, Filter, Search, ChevronUp, ChevronDown } from 'lucide-react';
import MaturityPanel from '../MaturityPanel/MaturityPanel';
import './TechTable.css';

console.log('📋 TechTable 컴포넌트 모듈이 로드되었습니다!');

const TechTable = ({ 
  data, 
  selectedTechnology, 
  onTechnologyClick,
  onTechnologyEdit,
  onTechnologyDelete
}) => {
  console.log('🔥 TechTable 컴포넌트가 렌더링됩니다!', {
    hasData: !!data,
    technologiesCount: data?.technologies?.length || 0,
    props: { selectedTechnology, onTechnologyClick, onTechnologyEdit, onTechnologyDelete }
  });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSector, setFilterSector] = useState('all');
  const [filterRing, setFilterRing] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [columnWidths, setColumnWidths] = useState({
    name: 160,
    sector: 200,
    ring: 100,
    description: 300,
    actions: 80
  });
  const [rowHeight, setRowHeight] = useState(60);
  const [isResizing, setIsResizing] = useState(false);
  const [resizingColumn, setResizingColumn] = useState(null);
  const [isResizingRow, setIsResizingRow] = useState(false);
  const resizeStartX = useRef(0);
  const resizeStartY = useRef(0);
  const resizeStartWidth = useRef(0);
  const resizeStartHeight = useRef(0);
  const tableRef = useRef(null);

  // 디버그용 상태 로깅
  React.useEffect(() => {
    console.log('Column widths updated:', columnWidths);
  }, [columnWidths]);

  React.useEffect(() => {
    console.log('Row height updated:', rowHeight);
  }, [rowHeight]);

  // 필터링 및 정렬된 기술 목록
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

  // 열 리사이징 핸들러
  const handleMouseDown = useCallback((e, columnKey) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('Column resize started for:', columnKey, 'Current width:', columnWidths[columnKey]);
    
    setIsResizing(true);
    setResizingColumn(columnKey);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = columnWidths[columnKey];

    const handleMouseMove = (e) => {
      const diff = e.clientX - resizeStartX.current;
      const newWidth = Math.max(50, resizeStartWidth.current + diff);
      
      console.log('Resizing column:', columnKey, 'New width:', newWidth);
      
      setColumnWidths(prev => ({
        ...prev,
        [columnKey]: newWidth
      }));
    };

    const handleMouseUp = () => {
      console.log('Column resize ended for:', columnKey);
      setIsResizing(false);
      setResizingColumn(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [columnWidths]);

  // 행 높이 리사이징 핸들러
  const handleRowMouseDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('Row resize started. Current height:', rowHeight);
    
    setIsResizingRow(true);
    resizeStartY.current = e.clientY;
    resizeStartHeight.current = rowHeight;

    const handleMouseMove = (e) => {
      const diff = e.clientY - resizeStartY.current;
      const newHeight = Math.max(40, resizeStartHeight.current + diff);
      
      console.log('Resizing row. New height:', newHeight);
      
      setRowHeight(newHeight);
    };

    const handleMouseUp = () => {
      console.log('Row resize ended. Final height:', rowHeight);
      setIsResizingRow(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [rowHeight]);

  // 간단한 테스트 함수
  const testClick = (type, key = null) => {
    console.log('TEST CLICK:', type, key);
    alert(`${type} ${key || ''} clicked!`);
  };

  const ResizeHandle = ({ columnKey }) => {
    console.log('Rendering ResizeHandle for:', columnKey);
    
    return (
      <div
        className={`resize-handle test-resize-handle ${isResizing && resizingColumn === columnKey ? 'resizing' : ''}`}
        onMouseDown={(e) => {
          console.log('ResizeHandle mousedown for:', columnKey);
          handleMouseDown(e, columnKey);
        }}
        onClick={(e) => {
          console.log('ResizeHandle clicked for:', columnKey);
          e.stopPropagation();
          testClick('Column', columnKey);
        }}
        style={{ cursor: 'col-resize' }}
        title={`Resize ${columnKey} column`}
      />
    );
  };

  const RowResizeHandle = () => {
    console.log('Rendering RowResizeHandle');
    
    return (
      <div
        className="my-custom-row-resize-handle"
        style={{
          position: 'absolute',
          bottom: '-5px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '150px',
          height: '10px',
          backgroundColor: '#ff6600',
          cursor: 'row-resize',
          zIndex: 9999,
          opacity: 1
        }}
        onMouseDown={(e) => {
          console.log('MY RowResizeHandle mousedown');
          handleRowMouseDown(e);
        }}
        onClick={(e) => {
          console.log('MY RowResizeHandle clicked');
          e.stopPropagation();
          testClick('Row');
        }}
        title="Drag to resize row height"
      >
        ROW RESIZE
      </div>
    );
  };

  if (!data.technologies || data.technologies.length === 0) {
    return (
      <div className="tech-table-container">
        <div className="empty-table">
          <div className="empty-icon">📊</div>
          <h3>데이터가 없습니다</h3>
          <p>기술을 추가하여 테이블 뷰를 확인해보세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tech-table-container">
      {/* 필터 및 검색 섹션 */}
      <div className="table-header">
        <div className="table-title">
          <h2>Technology Overview</h2>
          <div className="table-count">
            {filteredAndSortedTechnologies.length} of {data.technologies.length} technologies
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

      {/* 테이블 */}
      <div className="table-wrapper">
        <table className={`tech-table ${isResizing || isResizingRow ? 'resizing' : ''}`} ref={tableRef}>
          <thead>
            <tr>
              <th 
                className="sortable"
                onClick={(e) => {
                  if (!isResizing) {
                    handleSort('name');
                  }
                }}
                style={{ 
                  width: `${columnWidths.name}px`, 
                  minWidth: `${columnWidths.name}px`,
                  maxWidth: `${columnWidths.name}px`
                }}
              >
                Technology
                <SortIcon field="name" />
                <ResizeHandle columnKey="name" />
              </th>
              <th 
                className="sortable"
                onClick={(e) => {
                  if (!isResizing) {
                    handleSort('sector');
                  }
                }}
                style={{ 
                  width: `${columnWidths.sector}px`, 
                  minWidth: `${columnWidths.sector}px`,
                  maxWidth: `${columnWidths.sector}px`
                }}
              >
                Domain
                <SortIcon field="sector" />
                <ResizeHandle columnKey="sector" />
              </th>
              <th 
                className="sortable"
                onClick={(e) => {
                  if (!isResizing) {
                    handleSort('ring');
                  }
                }}
                style={{ 
                  width: `${columnWidths.ring}px`, 
                  minWidth: `${columnWidths.ring}px`,
                  maxWidth: `${columnWidths.ring}px`
                }}
              >
                Stage
                <SortIcon field="ring" />
                <ResizeHandle columnKey="ring" />
              </th>
              <th style={{ 
                width: `${columnWidths.description}px`, 
                minWidth: `${columnWidths.description}px`,
                maxWidth: `${columnWidths.description}px`
              }}>
                Description
                <ResizeHandle columnKey="description" />
              </th>
              <th style={{ 
                width: `${columnWidths.actions}px`, 
                minWidth: `${columnWidths.actions}px`,
                maxWidth: `${columnWidths.actions}px`
              }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedTechnologies.map((tech, index) => {
              const sector = getSectorInfo(tech.sector);
              const ring = getRingInfo(tech.ring);
              const isSelected = selectedTechnology?.id === tech.id;
              
              return (
                <tr 
                  key={tech.id}
                  className={isSelected ? 'selected' : ''}
                  onClick={(e) => {
                    if (!isResizingRow) {
                      onTechnologyClick(tech);
                    }
                  }}
                  style={{ height: `${rowHeight}px`, position: 'relative' }}
                >
                  <td className="tech-name" style={{ 
                    width: `${columnWidths.name}px`, 
                    minWidth: `${columnWidths.name}px`,
                    maxWidth: `${columnWidths.name}px`
                  }}>
                    <div className="name-cell">
                      <span className="tech-title">{tech.name}</span>
                    </div>
                    <RowResizeHandle />
                  </td>
                  <td className="sector-cell" style={{ 
                    width: `${columnWidths.sector}px`, 
                    minWidth: `${columnWidths.sector}px`,
                    maxWidth: `${columnWidths.sector}px`
                  }}>
                    <div 
                      className="sector-badge"
                      style={{ backgroundColor: sector?.color + '20', color: sector?.color }}
                    >
                      {sector?.name || 'Unknown'}
                    </div>
                  </td>
                  <td className="ring-cell" style={{ 
                    width: `${columnWidths.ring}px`, 
                    minWidth: `${columnWidths.ring}px`,
                    maxWidth: `${columnWidths.ring}px`
                  }}>
                    <div 
                      className={`ring-badge ring-${tech.ring}`}
                      style={{ backgroundColor: ring?.color + '20', color: ring?.color }}
                    >
                      {getRingDisplayName(tech.ring)}
                    </div>
                  </td>
                  <td className="description-cell" style={{ 
                    width: `${columnWidths.description}px`, 
                    minWidth: `${columnWidths.description}px`,
                    maxWidth: `${columnWidths.description}px`
                  }}>
                    <span className="description-text">
                      {tech.description || 'No description available'}
                    </span>
                  </td>
                  <td className="actions-cell" style={{ 
                    width: `${columnWidths.actions}px`, 
                    minWidth: `${columnWidths.actions}px`,
                    maxWidth: `${columnWidths.actions}px`,
                    position: 'relative'
                  }}>
                    <button 
                      className="action-btn edit-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTechnologyEdit(tech);
                      }}
                      title="Edit technology"
                    >
                      <Edit size={14} />
                    </button>
                    <button 
                      className="action-btn delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTechnologyDelete(tech.id);
                      }}
                      title="Delete technology"
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