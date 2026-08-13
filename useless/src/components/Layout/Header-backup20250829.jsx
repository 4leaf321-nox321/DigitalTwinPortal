import React, { useState, useRef } from 'react';
import { 
  Search, 
  Network, 
  Download, 
  Upload, 
  Filter,
  Settings,
  MoreVertical
} from 'lucide-react';

const Header = ({
  searchQuery,
  onSearchChange,
  layoutType,
  onLayoutChange,
  onDataImport,
  onDataExport,
  filterOptions,
  onFilterChange
}) => {
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const fileInputRef = useRef(null);

  const layoutOptions = [
    { value: 'force-directed', label: '힘 기반 레이아웃' },
    { value: 'circular', label: '원형 레이아웃' },
    { value: 'grid', label: '그리드 레이아웃' }
  ];

  const handleFileImport = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/json') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          onDataImport(data);
        } catch (error) {
          alert('잘못된 JSON 파일입니다.');
        }
      };
      reader.readAsText(file);
    }
    event.target.value = '';
  };

  const nodeTypes = ['person', 'company', 'project', 'skill', 'department', 'technology'];
  const edgeTypes = ['works_for', 'participates_in', 'has_skill', 'belongs_to', 'uses_technology', 'utilizes', 'part_of', 'collaborates_with'];

  return (
    <header className="header">
      <div className="header-left">
        <div className="logo">
          <Network size={24} strokeWidth={2} />
          <h1>지식 그래프</h1>
        </div>
      </div>

      <div className="header-center">
        <div className="search-container">
          <Search size={18} className="search-icon" strokeWidth={2} />
          <input
            type="text"
            placeholder="노드나 관계를 검색하세요..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      <div className="header-right">
        {/* 레이아웃 선택 */}
        <div className="dropdown-container">
          <button 
            className="header-btn"
            onClick={() => setShowLayoutMenu(!showLayoutMenu)}
            title="레이아웃 변경"
            aria-label="레이아웃 변경"
          >
            <Settings size={18} strokeWidth={2} />
            <span>레이아웃</span>
          </button>
          {showLayoutMenu && (
            <div className="dropdown-menu">
              {layoutOptions.map(option => (
                <button
                  key={option.value}
                  className={`dropdown-item ${layoutType === option.value ? 'active' : ''}`}
                  onClick={() => {
                    onLayoutChange(option.value);
                    setShowLayoutMenu(false);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 필터 */}
        <div className="dropdown-container">
          <button 
            className="header-btn"
            onClick={() => setShowFilterMenu(!showFilterMenu)}
            title="필터 설정"
            aria-label="필터 설정"
          >
            <Filter size={18} strokeWidth={2} />
            <span>필터</span>
          </button>
          {showFilterMenu && (
            <div className="dropdown-menu filter-menu">
              <div className="filter-section">
                <h4>노드 타입</h4>
                {nodeTypes.map(type => (
                  <label key={type} className="filter-checkbox">
                    <input
                      type="checkbox"
                      checked={filterOptions.nodeTypes.includes(type)}
                      onChange={(e) => {
                        const newTypes = e.target.checked
                          ? [...filterOptions.nodeTypes, type]
                          : filterOptions.nodeTypes.filter(t => t !== type);
                        onFilterChange({
                          ...filterOptions,
                          nodeTypes: newTypes
                        });
                      }}
                    />
                    {type}
                  </label>
                ))}
              </div>
              <div className="filter-section">
                <h4>관계 타입</h4>
                {edgeTypes.map(type => (
                  <label key={type} className="filter-checkbox">
                    <input
                      type="checkbox"
                      checked={filterOptions.edgeTypes.includes(type)}
                      onChange={(e) => {
                        const newTypes = e.target.checked
                          ? [...filterOptions.edgeTypes, type]
                          : filterOptions.edgeTypes.filter(t => t !== type);
                        onFilterChange({
                          ...filterOptions,
                          edgeTypes: newTypes
                        });
                      }}
                    />
                    {type}
                  </label>
                ))}
              </div>
              <div className="filter-section">
                <h4>최소 연결 수</h4>
                <input
                  type="number"
                  min="0"
                  value={filterOptions.minConnections}
                  onChange={(e) => onFilterChange({
                    ...filterOptions,
                    minConnections: parseInt(e.target.value) || 0
                  })}
                  className="filter-input"
                />
              </div>
              <div className="filter-actions">
                <button
                  className="filter-reset-btn"
                  onClick={() => onFilterChange({
                    nodeTypes: [],
                    edgeTypes: [],
                    minConnections: 0
                  })}
                >
                  필터 초기화
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 데이터 가져오기 */}
        <button 
          className="header-btn"
          onClick={() => fileInputRef.current.click()}
          title="데이터 가져오기"
          aria-label="데이터 가져오기"
        >
          <Upload size={18} strokeWidth={2} />
          <span>가져오기</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileImport}
          style={{ display: 'none' }}
        />

        {/* 데이터 내보내기 */}
        <button 
          className="header-btn"
          onClick={onDataExport}
          title="데이터 내보내기"
          aria-label="데이터 내보내기"
        >
          <Download size={18} strokeWidth={2} />
          <span>내보내기</span>
        </button>
      </div>
    </header>
  );
};

export default Header;