import React, { useEffect, useRef, useState, useMemo } from 'react';
import './TechRadar.css';

const TechRadar = ({ data, selectedTechnology, onTechnologyClick, showLabels = true }) => {
  const svgRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 800 });
  
  const centerX = dimensions.width / 2;
  const centerY = dimensions.height / 2;
  const maxRadius = Math.min(dimensions.width, dimensions.height) / 2 - 80; // 여백을 더 크게 조정

  // 컨테이너 크기에 따라 SVG 크기 조정
  useEffect(() => {
    const handleResize = () => {
      if (svgRef.current && svgRef.current.parentElement) {
        const container = svgRef.current.parentElement;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const size = Math.min(containerWidth, containerHeight) - 20; // 컴테이너 여백 최소화
        setDimensions({ width: size, height: size });
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 각도를 라디안으로 변환
  const toRadians = (degrees) => degrees * (Math.PI / 180);

  // 섹터의 각도 계산 (6개 섹터)
  const getSectorAngle = (sectorIndex) => {
    const anglePerSector = 360 / data.sectors.length;
    return sectorIndex * anglePerSector;
  };

  // 좌표 계산
  const getCoordinates = (angle, radius) => {
    const radian = toRadians(angle - 90); // -90도로 12시 방향을 0도로 조정
    return {
      x: centerX + radius * Math.cos(radian),
      y: centerY + radius * Math.sin(radian)
    };
  };

  // 섹터 내에서 기술들을 배치할 고정 위치 생성 (랜덤 대신 해시 기반)
  const getTechnologyPosition = (tech, sectorIndex) => {
    const ring = data.rings.find(r => r.id === tech.ring);
    if (!ring) return { x: centerX, y: centerY };

    const sectorAngle = getSectorAngle(sectorIndex);
    const anglePerSector = 360 / data.sectors.length;
    
    // 기술 이름을 기반으로 고정된 시드 생성
    const seed = tech.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const seededRandom1 = (seed * 9301 + 49297) % 233280 / 233280;
    const seededRandom2 = ((seed + 1) * 9301 + 49297) % 233280 / 233280;
    
    // 섹터 내에서 고정된 각도 (여백을 두고)
    const angleOffset = (seededRandom1 - 0.5) * (anglePerSector * 0.8);
    const finalAngle = sectorAngle + angleOffset;
    
    // 링 내에서 고정된 반지름
    const prevRing = data.rings.find(r => r.radius < ring.radius);
    const minRadius = prevRing ? prevRing.radius : 0;
    const radiusRange = (ring.radius - minRadius) * maxRadius / 400;
    const minRadiusActual = minRadius * maxRadius / 400;
    const fixedRadius = minRadiusActual + seededRandom2 * radiusRange * 0.8 + radiusRange * 0.1;
    
    return getCoordinates(finalAngle, fixedRadius);
  };

  // 섹터별 기술들 그룹화 (useMemo로 성능 최적화)
  const technologiesBySector = useMemo(() => 
    data.sectors.map(sector => ({
      sector,
      technologies: data.technologies.filter(tech => tech.sector === sector.id)
    })), [data.sectors, data.technologies]
  );

  return (
    <div className="tech-radar-container">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        viewBox={`-50 -50 ${dimensions.width + 100} ${dimensions.height + 100}`} // viewBox를 확장하여 라벨 영역 포함
        className="tech-radar-svg"
      >
        {/* 배경 그라데이션 정의 */}
        <defs>
          <radialGradient id="radarGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.1)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.05)" />
          </radialGradient>
          
          {/* 섹터별 그라데이션 */}
          {data.sectors.map(sector => (
            <linearGradient key={sector.id} id={`gradient-${sector.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={sector.color} stopOpacity="0.1" />
              <stop offset="100%" stopColor={sector.color} stopOpacity="0.05" />
            </linearGradient>
          ))}
        </defs>

        {/* 섹터 배경 */}
        {data.sectors.map((sector, index) => {
          const startAngle = getSectorAngle(index) - 180 / data.sectors.length;
          const endAngle = getSectorAngle(index) + 180 / data.sectors.length;
          
          const startCoord = getCoordinates(startAngle, maxRadius);
          const endCoord = getCoordinates(endAngle, maxRadius);
          
          const largeArcFlag = (endAngle - startAngle) > 180 ? 1 : 0;
          
          const pathData = [
            `M ${centerX} ${centerY}`,
            `L ${startCoord.x} ${startCoord.y}`,
            `A ${maxRadius} ${maxRadius} 0 ${largeArcFlag} 1 ${endCoord.x} ${endCoord.y}`,
            'Z'
          ].join(' ');

          return (
            <path
              key={sector.id}
              d={pathData}
              fill={`url(#gradient-${sector.id})`}
              stroke={sector.color}
              strokeWidth="1"
              strokeOpacity="0.3"
              className="sector-background"
            />
          );
        })}

        {/* 동심원 (링) */}
        {data.rings.map(ring => (
          <circle
            key={ring.id}
            cx={centerX}
            cy={centerY}
            r={ring.radius * maxRadius / 400}
            fill="none"
            stroke={ring.color}
            strokeWidth="2"
            strokeOpacity="0.4"
            strokeDasharray="5,5"
            className="radar-ring"
          />
        ))}

        {/* 섹터 구분선 */}
        {data.sectors.map((sector, index) => {
          const angle = getSectorAngle(index) - 180 / data.sectors.length;
          const coord = getCoordinates(angle, maxRadius);
          
          return (
            <line
              key={`line-${sector.id}`}
              x1={centerX}
              y1={centerY}
              x2={coord.x}
              y2={coord.y}
              stroke="#e5e7eb"
              strokeWidth="1"
              strokeOpacity="0.6"
              className="sector-line"
            />
          );
        })}

        {/* 기술 포인트들 */}
        {technologiesBySector.map((sectorGroup, sectorIndex) =>
          sectorGroup.technologies.map(tech => {
            const position = getTechnologyPosition(tech, sectorIndex);
            const isSelected = selectedTechnology?.id === tech.id;
            const isAdopted = tech.isAdopted !== false;
            
            return (
              <g key={tech.id} className="technology-point">
                {/* 선택 효과 */}
                {isSelected && (
                  <circle
                    cx={position.x}
                    cy={position.y}
                    r="20"
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="3"
                    strokeOpacity="0.6"
                    className="selection-ring"
                  >
                    <animate
                      attributeName="r"
                      values="15;25;15"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="stroke-opacity"
                      values="0.8;0.3;0.8"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
                
                {/* 기술 포인트 */}
                <circle
                  cx={position.x}
                  cy={position.y}
                  r={isSelected ? "10" : "6"}
                  fill={isAdopted ? sectorGroup.sector.color : '#9ca3af'}
                  stroke="white"
                  strokeWidth={isSelected ? "3" : "2"}
                  className={`tech-point ${isSelected ? 'selected' : ''} ${!isAdopted ? 'not-adopted' : ''}`}
                  style={{
                    cursor: 'pointer',
                    opacity: isAdopted ? 1 : 0.6,
                    filter: isSelected ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
                    transition: 'all 0.3s ease',
                    transformOrigin: `${position.x}px ${position.y}px`
                  }}
                  onClick={() => onTechnologyClick(tech)}
                >
                  {/* 새로 추가된 포인트에 애니메이션 효과 */}
                  <animateTransform
                    attributeName="transform"
                    type="scale"
                    values="0;1.2;1"
                    dur="0.6s"
                    begin="0s"
                  />
                </circle>
                
                {/* 기술 이름 라벨 */}
                {showLabels && (
                  <text
                    x={position.x}
                    y={position.y - (isSelected ? 16 : 12)}
                    textAnchor="middle"
                    className={`tech-label ${isSelected ? 'selected' : ''}`}
                    style={{
                      fontSize: isSelected ? '13px' : '10px',
                      fontWeight: isSelected ? '700' : '500',
                      fill: isSelected ? '#1f2937' : '#6b7280',
                      pointerEvents: 'none',
                      opacity: isAdopted ? 1 : 0.7,
                      transition: 'all 0.3s ease'
                    }}
                  >
                    {tech.name}
                  </text>
                )}
                
                {/* 미도입 표시 */}
                {!isAdopted && (
                  <text
                    x={position.x}
                    y={position.y + (isSelected ? 22 : 20)}
                    textAnchor="middle"
                    className="adoption-status"
                    style={{
                      fontSize: '8px',
                      fontWeight: '600',
                      fill: '#9ca3af',
                      pointerEvents: 'none',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    미도입
                  </text>
                )}
              </g>
            );
          })
        )}

        {/* 중심 포인트 */}
        <circle
          cx={centerX}
          cy={centerY}
          r="3"
          fill="#6b7280"
          className="center-point"
        />

        {/* 링 라벨 */}
        {data.rings.map(ring => {
          const radius = ring.radius * maxRadius / 400;
          return (
            <text
              key={`ring-label-${ring.id}`}
              x={centerX + radius - 10}
              y={centerY - 5}
              textAnchor="end"
              className="ring-label"
              style={{
                fontSize: '11px',
                fontWeight: '600',
                fill: ring.color,
                textTransform: 'uppercase'
              }}
            >
              {ring.name}
            </text>
          );
        })}
        
        {/* 섹터 라벨 - 가장 마지막에 렌더링하여 앞에 표시 */}
        <g className="sector-labels">
          {data.sectors.map((sector, index) => {
            const angle = getSectorAngle(index);
            const labelRadius = maxRadius + 50; // 라벨 거리를 더 크게 조정
            const position = getCoordinates(angle, labelRadius);
            
            return (
              <g key={`label-group-${sector.id}`}>
                {/* 배경 원형 영역 (선택사항) */}
                <circle
                  cx={position.x}
                  cy={position.y}
                  r="20"
                  fill="rgba(255, 255, 255, 0.8)"
                  stroke="rgba(255, 255, 255, 0.9)"
                  strokeWidth="1"
                  opacity="0.9"
                  className="sector-label-background"
                />
                <text
                  x={position.x}
                  y={position.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="sector-label"
                  style={{
                    fontSize: '14px',
                    fontWeight: '700',
                    fill: sector.color,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    pointerEvents: 'none'
                  }}
                >
                  {sector.name}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      
      {/* 범례 */}
      <div className="radar-legend">
        <div className="legend-section">
          <h4>성숙도</h4>
          {data.rings.map(ring => (
            <div key={ring.id} className="legend-item">
              <div 
                className="legend-color"
                style={{ backgroundColor: ring.color }}
              />
              <span>{ring.name}</span>
            </div>
          ))}
        </div>
        
        <div className="legend-section">
          <h4>도메인</h4>
          {data.sectors.map(sector => {
            const sectorTechCount = data.technologies.filter(tech => tech.sector === sector.id).length;
            return (
              <div key={sector.id} className="legend-item">
                <div 
                  className="legend-color"
                  style={{ backgroundColor: sector.color }}
                />
                <span>{sector.name} ({sectorTechCount})</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TechRadar;
