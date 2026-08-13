import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import * as d3 from 'd3';
import { sortDivisions, sortDivisionEntries } from '../../utils/divisionSorting';

const Container = styled(motion.div)`
  background: white;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid #e2e8f0;
  height: fit-content;
  min-height: 600px;
`;

const Title = styled.h3`
  margin: 0 0 1.5rem 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  &::before {
    content: '📊';
    font-size: 1.25rem;
  }
`;

const FilterTabs = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding: 0.25rem;
  background: #f1f5f9;
  border-radius: 0.5rem;
  overflow-x: auto;
`;

const FilterTab = styled.button`
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 0.375rem;
  background: ${props => props.active ? '#3b82f6' : 'transparent'};
  color: ${props => props.active ? 'white' : '#64748b'};
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  
  &:hover {
    background: ${props => props.active ? '#3b82f6' : '#e2e8f0'};
  }
`;

const TreemapContainer = styled.div`
  width: 100%;
  height: 500px;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  overflow: hidden;
  position: relative;
  background: #f8fafc;
  
  svg {
    width: 100%;
    height: 100%;
    display: block;
    /* SVG 크기를 컨테이너에 고정 */
    max-width: 100%;
    max-height: 100%;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  color: #64748b;
  padding: 2rem;
  
  .icon {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }
  
  .message {
    font-size: 1rem;
    line-height: 1.5;
  }
`;

const Legend = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 1rem;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 0.5rem;
  border: 1px solid #e2e8f0;
`;

const LegendItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #374151;
`;

const LegendColor = styled.div`
  width: 1rem;
  height: 1rem;
  border-radius: 0.125rem;
  background: ${props => props.color};
  border: 1px solid ${props => props.borderColor || props.color};
`;

const StatsPanel = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 0.5rem;
`;

const StatItem = styled.div`
  text-align: center;
  padding: 0.5rem;
  background: white;
  border-radius: 0.375rem;
  border: 1px solid #e2e8f0;
`;

const StatValue = styled.div`
  font-size: 1.25rem;
  font-weight: 700;
  color: ${props => props.color || '#1e293b'};
  margin-bottom: 0.25rem;
`;

const StatLabel = styled.div`
  font-size: 0.75rem;
  color: #64748b;
  font-weight: 500;
`;

const Tooltip = styled.div`
  position: absolute;
  background: rgba(30, 41, 59, 0.95);
  color: white;
  padding: 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  pointer-events: none;
  z-index: 1000;
  max-width: 280px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  white-space: pre-line;
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  
  &::before {
    content: '';
    position: absolute;
    top: -6px;
    left: 20px;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-bottom: 6px solid rgba(30, 41, 59, 0.95);
  }
`;

const PerformanceTreemap = ({ projects, divisionColors, statusColors }) => {
  const [selectedFilter, setSelectedFilter] = useState('전체');
  const [tooltip, setTooltip] = useState(null);
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // 성과 데이터 분석 - 사업부별로 대분류 정리
  const performanceData = useMemo(() => {
    if (!projects || projects.length === 0) {
      return {};
    }

    const data = {};
    let totalPerformances = 0;
    
    projects.forEach(project => {
      const division = project.사업부 || 'Unknown';
      
      if (!data[division]) {
        data[division] = {
          categories: {},
          total: 0
        };
      }
      
      // 각 프로젝트의 성과목록을 순회
      (project.성과목록 || []).forEach(performance => {
        const 대분류 = performance.대분류 || '기타';
        const 소분류 = performance.소분류 || '기타';
        
        if (!data[division].categories[대분류]) {
          data[division].categories[대분류] = {
            subcategories: {},
            total: 0
          };
        }
        
        if (!data[division].categories[대분류].subcategories[소분류]) {
          data[division].categories[대분류].subcategories[소분류] = [];
        }
        
        data[division].categories[대분류].subcategories[소분류].push({
          projectId: project.id,
          projectName: project.과제명,
          performanceItem: performance.성과항목,
          contribution: performance.과제기여도,
          current: performance.현재수준,
          target: performance.목표수준,
          actual: performance.실적수준,
          unit: performance.단위,
          status: project.진행상태,
          division: project.사업부
        });
        
        data[division].categories[대분류].total++;
        data[division].total++;
        totalPerformances++;
      });
    });
    
    return { data, totalPerformances };
  }, [projects]);

  // 필터 옵션 생성
  const filterOptions = useMemo(() => {
    if (!performanceData.data) return ['전체'];
    const divisions = sortDivisions(Object.keys(performanceData.data));
    return ['전체', ...divisions];
  }, [performanceData]);

  // 필터링된 데이터 - 전체 탭일 때는 대분류별로 통합
  const filteredData = useMemo(() => {
    if (!performanceData.data) return {};
    
    if (selectedFilter === '전체') {
      // 모든 사업부의 성과를 대분류별로 통합
      const aggregatedData = {};
      
      Object.values(performanceData.data).forEach(divisionData => {
        Object.entries(divisionData.categories).forEach(([categoryName, categoryData]) => {
          if (!aggregatedData[categoryName]) {
            aggregatedData[categoryName] = {
              subcategories: {},
              total: 0
            };
          }
          
          // 소분류별로 성과들을 통합
          Object.entries(categoryData.subcategories).forEach(([subcategoryName, performances]) => {
            if (!aggregatedData[categoryName].subcategories[subcategoryName]) {
              aggregatedData[categoryName].subcategories[subcategoryName] = [];
            }
            
            aggregatedData[categoryName].subcategories[subcategoryName] = [
              ...aggregatedData[categoryName].subcategories[subcategoryName],
              ...performances
            ];
          });
          
          aggregatedData[categoryName].total += categoryData.total;
        });
      });
      
      return aggregatedData;
    } else {
      // 특정 사업부 선택 시
      const divisionData = performanceData.data[selectedFilter];
      return divisionData ? divisionData.categories : {};
    }
  }, [performanceData, selectedFilter]);

  // 통계 계산
  const stats = useMemo(() => {
    const categories = Object.keys(filteredData);
    const totalCategories = categories.length;
    let totalSubcategories = 0;
    let totalPerformances = 0;
    
    categories.forEach(category => {
      const categoryData = filteredData[category];
      if (categoryData && categoryData.subcategories) {
        totalSubcategories += Object.keys(categoryData.subcategories).length;
        totalPerformances += categoryData.total;
      }
    });
    
    return {
      categories: totalCategories,
      subcategories: totalSubcategories,
      performances: totalPerformances
    };
  }, [filteredData]);

  // 소분류만을 위한 플랫 데이터 구조 생성
  const flatTreemapData = useMemo(() => {
    const subcategoryItems = [];
    
    Object.entries(filteredData).forEach(([categoryName, categoryData]) => {
      Object.entries(categoryData.subcategories || {}).forEach(([subcategoryName, performances]) => {
        subcategoryItems.push({
          name: subcategoryName,
          category: categoryName,
          value: performances.length,
          performances: performances
        });
      });
    });

    return {
      name: 'root',
      children: subcategoryItems
    };
  }, [filteredData]);

  // 대분류별 색상 정의
  const getCategoryColors = () => {
    return {
      '리드타임단축': {
        primary: '#1e40af',
        light: '#dbeafe',
        dark: '#1e3a8a'
      },
      '비용절감': {
        primary: '#047857',
        light: '#d1fae5',
        dark: '#064e3b'
      },
      '품질향상': {
        primary: '#d97706',
        light: '#fef3c7',
        dark: '#92400e'
      },
      '기술혁신': {
        primary: '#7c3aed',
        light: '#ede9fe',
        dark: '#5b21b6'
      },
      '제조성과': {
        primary: '#dc2626',
        light: '#fecaca',
        dark: '#991b1b'
      },
      '기타': {
        primary: '#374151',
        light: '#f3f4f6',
        dark: '#1f2937'
      }
    };
  };

  const getCategoryColor = (category) => {
    const colors = getCategoryColors();
    return colors[category] || colors['기타'];
  };

  // 텍스트를 여러 줄로 나누는 함수
  const wrapText = (text, maxCharsPerLine) => {
    if (!text) return [];
    
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      
      if (testLine.length <= maxCharsPerLine) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          // 단어 자체가 너무 긴 경우 강제로 자름
          lines.push(word.substring(0, maxCharsPerLine));
          currentLine = word.substring(maxCharsPerLine);
        }
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines;
  };

  // 트리맵 렌더링 함수 (컨테이너 크기에 의존하지 않음)
  const renderTreemap = useCallback(() => {
    if (!flatTreemapData || !svgRef.current || !containerRef.current || !flatTreemapData.children?.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // 컨테이너의 실제 크기 가져오기 (한 번만)
    const containerRect = containerRef.current.getBoundingClientRect();
    const width = containerRect.width;
    const height = 500; // 고정 높이

    console.log('TreeMap render - Width:', width, 'Height:', height); // 디버깅용

    // SVG 크기를 명시적으로 설정 (viewBox 사용하지 않음)
    svg
      .attr('width', width)
      .attr('height', height)
      .style('width', width + 'px')
      .style('height', height + 'px');

    // 트리맵 레이아웃 생성 (소분류만)
    const hierarchy = d3.hierarchy(flatTreemapData)
      .sum(d => d.value)
      .sort((a, b) => b.value - a.value);

    const treemap = d3.treemap()
      .size([width, height])
      .paddingOuter(4)
      .paddingInner(2)
      .round(true);

    const root = treemap(hierarchy);

    // 소분류 그룹 생성
    const subcategoryGroups = svg.selectAll('.subcategory')
      .data(root.children)
      .enter()
      .append('g')
      .attr('class', 'subcategory');

    // 소분류 사각형
    subcategoryGroups.append('rect')
      .attr('x', d => d.x0)
      .attr('y', d => d.y0)
      .attr('width', d => Math.max(0, d.x1 - d.x0))
      .attr('height', d => Math.max(0, d.y1 - d.y0))
      .attr('fill', d => {
        const categoryColors = getCategoryColor(d.data.category);
        return categoryColors.primary;
      })
      .attr('stroke', d => getCategoryColor(d.data.category).dark)
      .attr('stroke-width', 2)
      .attr('rx', 4)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        const uniqueProjects = [...new Set(d.data.performances.map(p => p.projectName))];
        const uniqueDivisions = [...new Set(d.data.performances.map(p => p.division))];
        
        // 마우스 위치 기반 툴팁 위치 계산
        const rectCenterX = d.x0 + (d.x1 - d.x0) / 2;
        const rectCenterY = d.y0 + (d.y1 - d.y0) / 2;
        
        // 툴팁이 컨테이너를 벗어나지 않도록 위치 조정
        let tooltipX = rectCenterX - 140;
        let tooltipY = rectCenterY - 80;
        
        // 경계 체크 및 조정
        if (tooltipX < 10) tooltipX = 10;
        if (tooltipX + 280 > width - 10) tooltipX = width - 290;
        if (tooltipY < 10) tooltipY = rectCenterY + 20;
        if (tooltipY + 100 > height - 10) tooltipY = height - 110;
        
        setTooltip({
          x: tooltipX,
          y: tooltipY,
          content: `${d.data.category} > ${d.data.name}\n성과 개수: ${d.value}개\n${selectedFilter === '전체' ? `관련 사업부: ${uniqueDivisions.join(', ')}\n` : ''}관련 프로젝트: ${uniqueProjects.join(', ')}`
        });
        
        d3.select(this).attr('opacity', 0.8);
      })
      .on('mouseout', function() {
        setTooltip(null);
        d3.select(this).attr('opacity', 1);
      })
      .on('click', function(event, d) {
        // 클릭 이벤트 처리 (툴팁만 제거)
        setTooltip(null);
        // 다른 클릭 핸들링이 필요하면 여기에 추가
        console.log('Clicked:', d.data.name);
      });

    // 대분류 라벨 (오버레이)
    subcategoryGroups.append('text')
      .attr('x', d => d.x0 + 4)
      .attr('y', d => d.y0 + 14)
      .attr('font-size', d => {
        const rectWidth = d.x1 - d.x0;
        const rectHeight = d.y1 - d.y0;
        if (rectWidth > 120 && rectHeight > 60) return '11px';
        if (rectWidth > 80 && rectHeight > 40) return '10px';
        if (rectWidth > 60 && rectHeight > 30) return '9px';
        return '0px';
      })
      .attr('font-weight', 'bold')
      .attr('fill', 'white')
      .attr('opacity', 0.8)
      .attr('pointer-events', 'none')
      .text(d => {
        const rectWidth = d.x1 - d.x0;
        const rectHeight = d.y1 - d.y0;
        if (rectWidth > 60 && rectHeight > 30) {
          return d.data.category;
        }
        return '';
      });

    // 소분류 이름 - 멀티라인 텍스트
    subcategoryGroups.each(function(d) {
      const rectWidth = d.x1 - d.x0;
      const rectHeight = d.y1 - d.y0;
      
      // 최소 크기 체크
      if (rectWidth < 35 || rectHeight < 25) return;
      
      const group = d3.select(this);
      const centerX = d.x0 + rectWidth / 2;
      const centerY = d.y0 + rectHeight / 2;
      
      // 폰트 크기 결정
      let fontSize, maxCharsPerLine, lineHeight;
      if (rectWidth > 140 && rectHeight > 80) {
        fontSize = 12;
        maxCharsPerLine = Math.floor(rectWidth / 8);
        lineHeight = 14;
      } else if (rectWidth > 100 && rectHeight > 60) {
        fontSize = 11;
        maxCharsPerLine = Math.floor(rectWidth / 7);
        lineHeight = 13;
      } else if (rectWidth > 70 && rectHeight > 45) {
        fontSize = 10;
        maxCharsPerLine = Math.floor(rectWidth / 6.5);
        lineHeight = 12;
      } else if (rectWidth > 50 && rectHeight > 35) {
        fontSize = 9;
        maxCharsPerLine = Math.floor(rectWidth / 6);
        lineHeight = 11;
      } else {
        fontSize = 8;
        maxCharsPerLine = Math.floor(rectWidth / 5.5);
        lineHeight = 10;
      }
      
      // 텍스트를 줄바꿈 처리
      const textLines = wrapText(d.data.name, maxCharsPerLine);
      const totalTextHeight = textLines.length * lineHeight;
      
      // 숫자 표시를 위한 공간 확보
      const numberSpace = 20;
      const availableTextHeight = rectHeight - numberSpace;
      
      if (totalTextHeight > availableTextHeight) {
        const maxLines = Math.floor(availableTextHeight / lineHeight);
        textLines.splice(maxLines);
        if (textLines.length > 0 && maxLines > 0) {
          const lastLine = textLines[textLines.length - 1];
          if (lastLine.length > 3) {
            textLines[textLines.length - 1] = lastLine.substring(0, lastLine.length - 3) + '...';
          }
        }
      }
      
      // 텍스트 시작 Y 위치 계산
      const actualTextHeight = textLines.length * lineHeight;
      const textStartY = centerY - actualTextHeight / 2 - numberSpace / 2;
      
      // 각 줄을 렌더링
      textLines.forEach((line, index) => {
        group.append('text')
          .attr('x', centerX)
          .attr('y', textStartY + (index + 1) * lineHeight)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('font-size', `${fontSize}px`)
          .attr('font-weight', 'bold')
          .attr('fill', 'white')
          .attr('pointer-events', 'none')
          .text(line);
      });
      
      // 숫자는 별도로 하단에 표시
      group.append('text')
        .attr('x', centerX)
        .attr('y', centerY + actualTextHeight / 2 + 5)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', d => {
          if (rectWidth > 120 && rectHeight > 70) return '16px';
          if (rectWidth > 80 && rectHeight > 50) return '14px';
          if (rectWidth > 60 && rectHeight > 40) return '13px';
          if (rectWidth > 45 && rectHeight > 30) return '12px';
          if (rectWidth > 30 && rectHeight > 20) return '11px';
          return '10px';
        })
        .attr('font-weight', 'bold')
        .attr('fill', 'white')
        .attr('pointer-events', 'none')
        .text(d.value);
    });

  }, [flatTreemapData, selectedFilter, getCategoryColor, wrapText]);

  // 초기 렌더링 및 데이터 변경 시에만 렌더링
  useEffect(() => {
    if (flatTreemapData && flatTreemapData.children?.length) {
      // 초기화 지연을 위한 타이머
      const timer = setTimeout(() => {
        renderTreemap();
        setIsInitialized(true);
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [flatTreemapData, selectedFilter, renderTreemap]);

  // 리사이즈 이벤트 (최소한으로만 처리)
  useEffect(() => {
    if (!isInitialized) return;

    let resizeTimer;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        renderTreemap();
      }, 200); // 더 긴 디바운스
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
    };
  }, [isInitialized, renderTreemap]);

  // 데이터가 없는 경우
  if (!performanceData.data || Object.keys(performanceData.data).length === 0) {
    return (
      <Container
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Title>
          {selectedFilter === '전체' ? '전체 성과 분류 현황' : `${selectedFilter} 성과 분류 현황`}
        </Title>
        <EmptyState>
          <div className="icon">📊</div>
          <div className="message">
            분석할 성과 데이터가 없습니다.<br />
            프로젝트에 성과를 추가해보세요.
          </div>
        </EmptyState>
      </Container>
    );
  }

  return (
    <Container
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Title>
        {selectedFilter === '전체' ? '전체 성과 분류 현황' : `${selectedFilter} 성과 분류 현황`}
      </Title>
      
      <FilterTabs>
        {filterOptions.map(option => (
          <FilterTab
            key={option}
            active={selectedFilter === option}
            onClick={() => setSelectedFilter(option)}
          >
            {option}
          </FilterTab>
        ))}
      </FilterTabs>
      
      <TreemapContainer ref={containerRef}>
        <svg ref={svgRef} />
        {tooltip && (
          <Tooltip
            style={{
              left: tooltip.x,
              top: tooltip.y
            }}
          >
            {tooltip.content}
          </Tooltip>
        )}
      </TreemapContainer>
      
      <Legend>
        {Object.entries(getCategoryColors()).map(([category, colors]) => (
          <LegendItem key={category}>
            <LegendColor 
              color={colors.primary} 
              borderColor={colors.dark}
            />
            <span>{category}</span>
          </LegendItem>
        ))}
      </Legend>
      
      <StatsPanel>
        <StatItem>
          <StatValue color="#8b5cf6">{stats.categories}</StatValue>
          <StatLabel>대분류</StatLabel>
        </StatItem>
        <StatItem>
          <StatValue color="#f59e0b">{stats.subcategories}</StatValue>
          <StatLabel>소분류</StatLabel>
        </StatItem>
        <StatItem>
          <StatValue color="#10b981">{stats.performances}</StatValue>
          <StatLabel>총 성과</StatLabel>
        </StatItem>
      </StatsPanel>
    </Container>
  );
};

export default PerformanceTreemap;