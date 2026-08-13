import React, { useState, useRef, useEffect } from 'react';
import './TechRadar.css';

const TechRadar = ({ data, onTechnologyClick, selectedTechnology, showLabels = true }) => {
  const svgRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 600 });
  const [hoveredTech, setHoveredTech] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const center = { x: dimensions.width / 2, y: dimensions.height / 2 };

  useEffect(() => {
    const updateDimensions = () => {
      if (svgRef.current) {
        const container = svgRef.current.parentElement;
        const containerWidth = container.offsetWidth - 40;
        const containerHeight = container.offsetHeight - 40;
        const size = Math.min(containerWidth, containerHeight);
        setDimensions({ width: size, height: size });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // 안전한 데이터 접근을 위한 방어 코드
  const safeSectors = data?.sectors || [];
  const safeRings = data?.rings || [];
  const safeTechnologies = data?.technologies || [];

  const handleTechHover = (tech, event) => {
    setHoveredTech(tech);
    setTooltipPosition({
      x: event.pageX,
      y: event.pageY
    });
  };

  const handleTechMouseMove = (tech, event) => {
    if (hoveredTech) {
      setTooltipPosition({
        x: event.pageX,
        y: event.pageY
      });
    }
  };

  const handleTechLeave = () => {
    setHoveredTech(null);
  };

  // 기술을 원형으로 배치하기 위한 함수
  const getTechnologyPosition = (technology) => {
    const sectorIndex = safeSectors.findIndex(s => s.id === technology.sector);
    const ring = safeRings.find(r => r.id === technology.ring);
    
    if (sectorIndex === -1 || !ring) {
      // 기본 위치 반환
      return {
        x: center.x,
        y: center.y
      };
    }

    const actualRingRadius = getRingRadius(ring.id);
    const sectorAngle = (sectorIndex * 90) + 45;
    const sectorAngleRad = (sectorAngle * Math.PI) / 180;
    
    // 해당 섹터 및 링의 기술들
    const technologiesInThisSectorAndRing = safeTechnologies.filter(
      t => t.sector === technology.sector && t.ring === technology.ring
    );
    
    // 정렬을 위해 ID로 정렬 (일관된 위치 보장)
    const sortedTechs = [...technologiesInThisSectorAndRing].sort((a, b) => a.id.localeCompare(b.id));
    const techIndex = sortedTechs.findIndex(t => t.id === technology.id);
    const totalInRing = sortedTechs.length;
    
    // 섹터 내에서 기술들을 분산 배치 (각도 조정)
    const spreadAngle = totalInRing > 1 ? (60 / (totalInRing + 1)) * (techIndex + 1) - 30 : 0;
    const finalAngle = sectorAngleRad + (spreadAngle * Math.PI / 180);
    
    // 링 내에서 반지름 조정
    const minRadius = actualRingRadius * 0.8;
    const maxRadius = actualRingRadius * 0.95;
    const radiusVariation = totalInRing > 1 ? 
      (maxRadius - minRadius) * (techIndex / (totalInRing - 1)) : 0;
    const finalRadius = minRadius + radiusVariation;
    
    return {
      x: center.x + finalRadius * Math.cos(finalAngle),
      y: center.y + finalRadius * Math.sin(finalAngle)
    };
  };

  // 기술 라벨 위치 계산 함수
  const getTechnologyLabelPosition = (technology, dotPosition) => {
    const sectorIndex = safeSectors.findIndex(s => s.id === technology.sector);
    const ring = safeRings.find(r => r.id === technology.ring);
    
    if (sectorIndex === -1 || !ring) {
      return { x: dotPosition.x, y: dotPosition.y - 15 };
    }

    // 라벨을 점에서 바깥쪽으로 약간 이동
    const sectorAngle = (sectorIndex * 90) + 45;
    const sectorAngleRad = (sectorAngle * Math.PI) / 180;
    
    const labelOffset = 18; // 라벨과 점 사이의 거리
    const labelX = dotPosition.x + labelOffset * Math.cos(sectorAngleRad);
    const labelY = dotPosition.y + labelOffset * Math.sin(sectorAngleRad);
    
    // 텍스트 앵커 결정 (섹터에 따라)
    let textAnchor = 'middle';
    if (sectorIndex === 0 || sectorIndex === 3) { // 우측 섹터들
      textAnchor = 'start';
    } else if (sectorIndex === 1 || sectorIndex === 2) { // 좌측 섹터들
      textAnchor = 'end';
    }
    
    return { 
      x: labelX, 
      y: labelY,
      textAnchor
    };
  };

  // 링 반지름 계산 함수
  const getRingRadius = (ringId) => {
    const maxRadius = Math.min(dimensions.width, dimensions.height) * 0.38;
    const ringRatio = ringId === 'adopt' ? 0.25 : 
                     ringId === 'trial' ? 0.5 :
                     ringId === 'assess' ? 0.75 : 1.0;
    return maxRadius * ringRatio;
  };

  // 기술 점의 색상과 스타일 결정
  const getTechnologyPointStyle = (technology) => {
    const sector = safeSectors.find(s => s.id === technology.sector);
    const isAdopted = technology.isAdopted !== false; // 기본값은 true
    
    if (!isAdopted) {
      // 미도입 기술은 회색으로 표시
      return {
        fill: '#9ca3af',
        stroke: 'white',
        strokeWidth: 2,
        opacity: 0.7
      };
    }
    
    // 도입된 기술은 섹터 색상으로 표시
    return {
      fill: sector?.color || '#8B5CF6',
      stroke: 'white',
      strokeWidth: 2,
      opacity: 1
    };
  };

  // 기술 라벨의 색상 결정
  const getTechnologyLabelStyle = (technology) => {
    const sector = safeSectors.find(s => s.id === technology.sector);
    const isAdopted = technology.isAdopted !== false; // 기본값은 true
    
    if (!isAdopted) {
      // 미도입 기술 라벨은 회색으로 표시
      return {
        fill: '#9ca3af',
        opacity: 0.8
      };
    }
    
    // 도입된 기술 라벨은 섹터 색상으로 표시
    return {
      fill: sector?.color || '#8B5CF6',
      opacity: 1
    };
  };

  return (
    <div className="tech-radar-container">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        className="tech-radar-svg"
      >
        {/* 배경 그라데이션 정의 */}
        <defs>
          <radialGradient id="radarGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" style={{ stopColor: '#f8fafc', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#e2e8f0', stopOpacity: 1 }} />
          </radialGradient>
          
          {/* 섹터별 그라데이션 */}
          {safeSectors.map(sector => (
            <radialGradient key={`grad-${sector.id}`} id={`gradient-${sector.id}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" style={{ stopColor: sector.color || '#8B5CF6', stopOpacity: 0.1 }} />
              <stop offset="100%" style={{ stopColor: sector.color || '#8B5CF6', stopOpacity: 0.05 }} />
            </radialGradient>
          ))}
        </defs>

        {/* 배경 원 */}
        <circle
          cx={center.x}
          cy={center.y}
          r={getRingRadius('hold')}
          fill="url(#radarGradient)"
          stroke="#cbd5e1"
          strokeWidth="1"
        />

        {/* 섹터 영역 */}
        {safeSectors.map((sector, index) => {
          const angle1 = (index * 90 + 90) * Math.PI / 180;
          const angle2 = ((index + 1) * 90 + 90) * Math.PI / 180;
          const outerRadius = getRingRadius('hold');
          
          const x1 = center.x + outerRadius * Math.cos(angle1);
          const y1 = center.y + outerRadius * Math.sin(angle1);
          const x2 = center.x + outerRadius * Math.cos(angle2);
          const y2 = center.y + outerRadius * Math.sin(angle2);
          
          const pathData = `M ${center.x} ${center.y} L ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 0 1 ${x2} ${y2} Z`;
          
          return (
            <path
              key={sector.id}
              d={pathData}
              fill={`url(#gradient-${sector.id})`}
              stroke={sector.color || '#8B5CF6'}
              strokeWidth="1"
              strokeOpacity="0.3"
            />
          );
        })}

        {/* 링 경계선 */}
        {safeRings.map(ring => (
          <circle
            key={ring.id}
            cx={center.x}
            cy={center.y}
            r={getRingRadius(ring.id)}
            fill="none"
            stroke={ring.color || '#64748b'}
            strokeWidth="2"
            strokeOpacity="0.6"
            strokeDasharray={ring.id === 'hold' ? '5,5' : 'none'}
          />
        ))}

        {/* 섹터 구분선 */}
        {[0, 1, 2, 3].map(i => {
          const angle = (i * 90) * Math.PI / 180;
          const outerRadius = getRingRadius('hold');
          const x = center.x + outerRadius * Math.cos(angle);
          const y = center.y + outerRadius * Math.sin(angle);
          
          return (
            <line
              key={i}
              x1={center.x}
              y1={center.y}
              x2={x}
              y2={y}
              stroke="#64748b"
              strokeWidth="1"
              strokeOpacity="0.5"
            />
          );
        })}

        {/* 기술 항목들 */}
        {safeTechnologies.map((tech, index) => {
          const position = getTechnologyPosition(tech);
          const labelPosition = getTechnologyLabelPosition(tech, position);
          const isSelected = selectedTechnology?.id === tech.id;
          const sector = safeSectors.find(s => s.id === tech.sector);
          const ring = safeRings.find(r => r.id === tech.ring);
          const pointStyle = getTechnologyPointStyle(tech);
          const labelStyle = getTechnologyLabelStyle(tech);
          
          if (!sector || !ring) {
            return null; // sector나 ring을 찾을 수 없으면 렌더링하지 않음
          }
          
          return (
            <g key={tech.id}>
              {/* 선택된 기술 하이라이트 */}
              {isSelected && (
                <>
                  <circle
                    cx={position.x}
                    cy={position.y}
                    r="15"
                    fill="none"
                    stroke={pointStyle.fill}
                    strokeWidth="3"
                    strokeOpacity="0.8"
                    className="selected-highlight-ring"
                  />
                  <circle
                    cx={position.x}
                    cy={position.y}
                    r="12"
                    fill={pointStyle.fill}
                    fillOpacity="0.15"
                    className="selected-highlight-fill"
                  />
                </>
              )}
              
              {/* 기술 점 */}
              <circle
                cx={position.x}
                cy={position.y}
                r="8"
                fill={pointStyle.fill}
                stroke={pointStyle.stroke}
                strokeWidth={pointStyle.strokeWidth}
                opacity={pointStyle.opacity}
                className={`technology-point ${isSelected ? 'selected' : ''} ${tech.isAdopted === false ? 'not-adopted' : 'adopted'}`}
                onClick={() => onTechnologyClick(tech)}
                onMouseEnter={(e) => handleTechHover(tech, e)}
                onMouseMove={(e) => handleTechMouseMove(tech, e)}
                onMouseLeave={handleTechLeave}
                style={{ cursor: 'pointer' }}
              />
              
              {/* 기술 번호 - showLabels가 false일 때만 표시 */}
              {!showLabels && (
                <text
                  x={position.x}
                  y={position.y + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="technology-number"
                  fill={isSelected ? pointStyle.fill : "white"}
                  fontSize="10"
                  fontWeight="bold"
                  pointerEvents="none"
                >
                  {index + 1}
                </text>
              )}
              
              {/* 기술 이름 라벨 - showLabels가 true일 때만 표시 */}
              {showLabels && (
                <text
                  x={labelPosition.x}
                  y={labelPosition.y + 1}
                  textAnchor={labelPosition.textAnchor}
                  dominantBaseline="middle"
                  className="technology-label"
                  fill={labelStyle.fill}
                  opacity={labelStyle.opacity}
                  fontSize="11"
                  fontWeight="600"
                  pointerEvents="none"
                >
                  {tech.name}
                </text>
              )}
            </g>
          );
        })}

        {/* 링 라벨 */}
        {safeRings.map(ring => (
          <text
            key={`label-${ring.id}`}
            x={center.x + getRingRadius(ring.id) - 10}
            y={center.y - 5}
            textAnchor="end"
            className="ring-label"
            fill={ring.color || '#64748b'}
            fontSize="12"
            fontWeight="bold"
          >
            {ring.name}
          </text>
        ))}

        {/* 섹터 라벨 */}
        {safeSectors.map((sector, index) => {
          const angle = (index * 90 + 45) * Math.PI / 180;
          const labelRadius = getRingRadius('hold') + Math.min(dimensions.width, dimensions.height) * 0.06;
          const x = center.x + labelRadius * Math.cos(angle);
          const y = center.y + labelRadius * Math.sin(angle);
          
          return (
            <text
              key={`sector-label-${sector.id}`}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="sector-label"
              fill={sector.color || '#8B5CF6'}
              fontSize="16"
              fontWeight="bold"
            >
              <tspan x={x} dy="-8">{sector.name?.split(' ')[0] || 'Sector'}</tspan>
              <tspan x={x} dy="16">{sector.name?.split(' ').slice(1).join(' ') || ''}</tspan>
            </text>
          );
        })}
      </svg>
      
      {/* 툴팁 */}
      {hoveredTech && (
        <div 
          className="tech-tooltip"
          style={{
            left: tooltipPosition.x + 10,
            top: tooltipPosition.y - 10
          }}
        >
          <div className="tooltip-header">
            <span className="tooltip-title">{hoveredTech.name}</span>
            <span 
              className="tooltip-ring"
              style={{ 
                backgroundColor: safeRings.find(r => r.id === hoveredTech.ring)?.color || '#64748b'
              }}
            >
              {safeRings.find(r => r.id === hoveredTech.ring)?.name || 'Unknown'}
            </span>
          </div>
          <div className="tooltip-sector" style={{ color: safeSectors.find(s => s.id === hoveredTech.sector)?.color || '#8B5CF6' }}>
            {safeSectors.find(s => s.id === hoveredTech.sector)?.name || 'Unknown Sector'}
          </div>
          <div className="tooltip-adoption-status">
            <span className={`adoption-badge ${hoveredTech.isAdopted !== false ? 'adopted' : 'not-adopted'}`}>
              {hoveredTech.isAdopted !== false ? '도입됨' : '미도입'}
            </span>
          </div>
          {hoveredTech.description && (
            <div className="tooltip-description">
              {hoveredTech.description}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TechRadar;