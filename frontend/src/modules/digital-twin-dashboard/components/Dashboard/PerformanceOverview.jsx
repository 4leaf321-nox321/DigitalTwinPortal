import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import * as d3 from 'd3';
import { sortDivisionNames } from '../../utils/divisionOrder';
import PerformanceDetailPanel from './PerformanceDetail/PerformanceDetailPanel';

const Container = styled(motion.div)`
  background: white;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid #e2e8f0;
  /* 부모(MiddleSection)의 높이를 100% 채움 */
  height: 100%;
  min-height: calc(100vh - 64px - 2rem);
  display: flex;
  flex-direction: column;
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

const ContentArea = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
`;

const ContentGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 2rem;
  flex: 1;
  min-height: 0;
  width: 100%;
  height: 100%;
  align-items: stretch;
`;

const TreemapSection = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  width: 100%;
  min-width: 0;
  overflow: visible;
  gap: 1rem;
  flex: 1;
`;

const FilterTabs = styled.div`
  display: flex;
  gap: 0.5rem;
  padding: 0.25rem;
  background: #f1f5f9;
  border-radius: 0.5rem;
  overflow-x: auto;
  flex-shrink: 0;
  height: 3rem;
  align-items: center;
  
  &::-webkit-scrollbar {
    height: 4px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 2px;
  }
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
  min-width: 0;
  /* 화면 높이에서 헤더(64px), 타이틀/필터/레전드/마진 등을 뺀 높이 */
  height: calc(100vh - 64px - 280px);
  min-height: 350px;
  max-height: calc(100vh - 64px - 280px);
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  overflow: hidden;
  position: relative;
  background: #f8fafc;
  flex: 1;
  padding: 0;
  box-sizing: border-box;

  &::before {
    content: '';
    display: block;
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    z-index: -1;
  }

  svg {
    width: 100%;
    height: 100%;
    display: block;
    overflow: visible;
    max-height: 100%;
    max-width: 100%;
    position: absolute;
    top: 0;
    left: 0;
  }
`;

const Legend = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1rem;
  padding: 0.75rem;
  background: #f8fafc;
  border-radius: 0.5rem;
  border: 1px solid #e2e8f0;
  flex-shrink: 0;
  font-size: 0.75rem;
`;

const LegendItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: #374151;
`;

const LegendColor = styled.div`
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 0.125rem;
  background: ${props => props.color};
  border: 1px solid ${props => props.borderColor || props.color};
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

const Tooltip = styled.div`
  position: fixed;
  background: rgba(30, 41, 59, 0.95);
  color: white;
  padding: 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  pointer-events: none;
  z-index: 10000;
  max-width: 280px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  white-space: pre-line;
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
`;

const PerformanceOverview = ({ projects, divisionColors, statusColors, globalPerformances = [], performanceCategories = [], settingsData = {} }) => {
  const [selectedFilter, setSelectedFilter] = useState('전체');
  const [selectedPerformance, setSelectedPerformance] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const svgRef = useRef(null);
  const containerRef = useRef(null);

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
      (project.성과목록 || []).forEach(perfRef => {
        // 성과 ID 추출
        const perfId = typeof perfRef === 'object' ? (perfRef.id || perfRef.성과항목ID) : perfRef;

        // globalPerformances에서 실제 성과 데이터 찾기
        const globalPerf = globalPerformances.find(gp => gp.id === perfId);

        if (!globalPerf) return; // 성과 데이터가 없으면 스킵

        const 대분류 = globalPerf.대분류 || '기타';
        const 소분류 = globalPerf.소분류 || '기타';

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
          performanceItem: globalPerf.성과항목,
          contribution: typeof perfRef === 'object' ? perfRef.과제기여도 : '100',
          current: globalPerf.현재수준,
          target: globalPerf.목표수준,
          actual: globalPerf.실적수준,
          isMonthly: globalPerf.월별실적여부 || false,
          monthlyActuals: globalPerf.월별실적 || Array(12).fill(''),
          unit: globalPerf.단위,
          status: project.진행상태,
          division: project.사업부
        });

        data[division].categories[대분류].total++;
        data[division].total++;
        totalPerformances++;
      });
    });
    
    return { data, totalPerformances };
  }, [projects, globalPerformances]);

  // 필터 옵션 생성
  const filterOptions = useMemo(() => {
    if (!performanceData.data) return ['전체'];
    // 사업부 순서는 설정이 정본이다 (divisionOrder.js 머리말 참조)
    const divisions = sortDivisionNames(Object.keys(performanceData.data), settingsData);
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

  // 색상 밝기 조절 헬퍼 함수
  const adjustColorBrightness = useCallback((hex, factor) => {
    // hex를 RGB로 변환
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    if (factor > 0) {
      // 밝게 만들기 (흰색 방향으로)
      const newR = Math.round(r + (255 - r) * factor);
      const newG = Math.round(g + (255 - g) * factor);
      const newB = Math.round(b + (255 - b) * factor);
      return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
    } else {
      // 어둡게 만들기
      const newR = Math.round(r * (1 + factor));
      const newG = Math.round(g * (1 + factor));
      const newB = Math.round(b * (1 + factor));
      return `#${Math.max(0, newR).toString(16).padStart(2, '0')}${Math.max(0, newG).toString(16).padStart(2, '0')}${Math.max(0, newB).toString(16).padStart(2, '0')}`;
    }
  }, []);

  // 대분류별 색상 정의 - performanceCategories에서 동적으로 생성
  const getCategoryColors = useMemo(() => {
    const colors = {};

    // performanceCategories에서 색상 정보 추출
    performanceCategories.forEach(category => {
      const baseColor = category.color || '#374151';
      colors[category.name] = {
        primary: baseColor,
        light: adjustColorBrightness(baseColor, 0.85), // 밝은 버전
        dark: adjustColorBrightness(baseColor, -0.2)   // 어두운 버전
      };
    });

    // 기본값 (기타)가 없는 경우 추가
    if (!colors['기타']) {
      colors['기타'] = {
        primary: '#374151',
        light: '#f3f4f6',
        dark: '#1f2937'
      };
    }

    return colors;
  }, [performanceCategories, adjustColorBrightness]);

  const getCategoryColor = (category) => {
    return getCategoryColors[category] || getCategoryColors['기타'] || {
      primary: '#374151',
      light: '#f3f4f6',
      dark: '#1f2937'
    };
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

  // 트리맵 렌더링 함수 (고정 크기 사용)
  const renderTreemap = useCallback(() => {
    if (!flatTreemapData || !svgRef.current || !containerRef.current || !flatTreemapData.children?.length) {
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // 컨테이너 크기를 직접 계산하여 정확한 크기 확보
    const containerRect = containerRef.current.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(containerRef.current);
    
    // 실제 사용 가능한 너비와 높이 계산 (패딩과 보더 제외)
    const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
    const paddingRight = parseFloat(computedStyle.paddingRight) || 0;
    const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
    const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0;
    const borderLeft = parseFloat(computedStyle.borderLeftWidth) || 0;
    const borderRight = parseFloat(computedStyle.borderRightWidth) || 0;
    const borderTop = parseFloat(computedStyle.borderTopWidth) || 0;
    const borderBottom = parseFloat(computedStyle.borderBottomWidth) || 0;
    
    const availableWidth = containerRect.width - paddingLeft - paddingRight - borderLeft - borderRight;
    const availableHeight = containerRect.height - paddingTop - paddingBottom - borderTop - borderBottom;
    
    const width = Math.max(availableWidth, 300);
    const height = Math.max(availableHeight, 400);

    // SVG 크기 설정
    svg
      .attr('width', width)
      .attr('height', height)
      .style('width', width + 'px')
      .style('height', height + 'px');

    // 트리맵 레이아웃 생성
    const hierarchy = d3.hierarchy(flatTreemapData)
      .sum(d => d.value)
      .sort((a, b) => {
        const categoryCompare = a.data.category.localeCompare(b.data.category);
        if (categoryCompare !== 0) return categoryCompare;
        
        const nameCompare = a.data.name.localeCompare(b.data.name);
        if (nameCompare !== 0) return nameCompare;
        
        return b.value - a.value;
      });

    const treemap = d3.treemap()
      .size([width, height])
      .paddingOuter(4)
      .paddingInner(2)
      .round(true)
      .tile(d3.treemapSquarify);

    const root = treemap(hierarchy);

    // 메인 그룹
    const mainGroup = svg.append('g');

    // 소분류 그룹 생성
    const subcategoryGroups = mainGroup.selectAll('.subcategory')
      .data(root.children)
      .enter()
      .append('g')
      .attr('class', 'subcategory')
      .style('cursor', 'pointer');

    // 소분류 사각형
    const rects = subcategoryGroups.append('rect')
      .attr('x', d => d.x0)
      .attr('y', d => d.y0)
      .attr('width', d => Math.max(0, d.x1 - d.x0))
      .attr('height', d => Math.max(0, d.y1 - d.y0))
      .attr('fill', d => {
        const categoryColors = getCategoryColor(d.data.category);
        return categoryColors.primary;
      })
      .attr('stroke', d => {
        return getCategoryColor(d.data.category).dark;
      })
      .attr('stroke-width', 2)
      .attr('rx', 4);

    // 클릭 이벤트 - 그룹에 걸어서 텍스트 위에서도 클릭 가능하게
    subcategoryGroups.on('click', function(event, d) {
        const categoryColors = getCategoryColor(d.data.category);

        // 현재 상태를 직접 확인하여 토글 처리
        setSelectedPerformance(currentSelection => {
          // 이미 선택된 항목을 다시 클릭하면 선택 해제
          if (currentSelection &&
              currentSelection.name === d.data.name &&
              currentSelection.category === d.data.category) {
            return null;
          }

          // 새로운 항목 선택
          return {
            name: d.data.name,
            category: d.data.category,
            value: d.data.value,
            performances: d.data.performances,
            categoryColor: categoryColors.primary
          };
        });
      });

    // 마우스 이벤트 - 그룹에 걸어서 텍스트 위에서도 동작하게
    subcategoryGroups.on('mouseover', function(event, d) {
        const performanceItems = d.data.performances || [];
        const itemList = performanceItems
          .slice(0, 5)
          .map(p => `• ${p.performanceItem || p.projectName}`)
          .join('\n');
        const moreText = performanceItems.length > 5 ? `\n... 외 ${performanceItems.length - 5}개` : '';

        setTooltip({
          x: event.clientX + 15,
          y: event.clientY + 15,
          content: `[${d.data.category}] ${d.data.name}\n성과 ${d.data.value}개\n\n${itemList}${moreText}\n\n클릭시 상세 정보를 볼 수 있습니다.`
        });

        d3.select(this).select('rect').attr('opacity', 0.8);
      })
      .on('mousemove', function(event, d) {
        const performanceItems = d.data.performances || [];
        const itemList = performanceItems
          .slice(0, 5)
          .map(p => `• ${p.performanceItem || p.projectName}`)
          .join('\n');
        const moreText = performanceItems.length > 5 ? `\n... 외 ${performanceItems.length - 5}개` : '';

        setTooltip({
          x: event.clientX + 15,
          y: event.clientY + 15,
          content: `[${d.data.category}] ${d.data.name}\n성과 ${d.data.value}개\n\n${itemList}${moreText}\n\n클릭시 상세 정보를 볼 수 있습니다.`
        });
      })
      .on('mouseout', function() {
        setTooltip(null);
        d3.select(this).select('rect').attr('opacity', 1);
      });

    // 대분류 라벨
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
      
      if (rectWidth < 35 || rectHeight < 25) return;
      
      const group = d3.select(this);
      const centerX = d.x0 + rectWidth / 2;
      const centerY = d.y0 + rectHeight / 2;
      
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
      
      const textLines = wrapText(d.data.name, maxCharsPerLine);
      const totalTextHeight = textLines.length * lineHeight;
      
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
      
      const actualTextHeight = textLines.length * lineHeight;
      const textStartY = centerY - actualTextHeight / 2 - numberSpace / 2;
      
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
      
      // 숫자 표시
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

  }, [flatTreemapData, selectedFilter, getCategoryColors, getCategoryColor]);

  // 선택된 아이템 하이라이트 업데이트
  const updateSelection = useCallback(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const mainGroup = svg.select('g');

    if (mainGroup.empty()) return;

    mainGroup.selectAll('.subcategory rect')
      .attr('stroke', function(d) {
        const categoryColors = getCategoryColors[d.data.category] || getCategoryColors['기타'];
        return categoryColors?.dark || '#1f2937';
      })
      .attr('stroke-width', 2)
      .attr('opacity', 1);

    if (selectedPerformance) {
      mainGroup.selectAll('.subcategory rect')
        .filter(d => d.data.name === selectedPerformance.name && d.data.category === selectedPerformance.category)
        .attr('stroke', '#fbbf24')
        .attr('stroke-width', 3);
    }
  }, [selectedPerformance, getCategoryColors]);
  
  // 선택 상태 업데이트
  useEffect(() => {
    updateSelection();
  }, [selectedPerformance, updateSelection]);

  // 초기 렌더링
  useEffect(() => {
    if (flatTreemapData && flatTreemapData.children?.length) {
      const renderWithDelay = () => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          if (rect.width > 0) {
            renderTreemap();
            requestAnimationFrame(() => {
              updateSelection();
              setIsInitialized(true);
            });
          } else {
            setTimeout(renderWithDelay, 50);
          }
        }
      };
      
      const timer = setTimeout(renderWithDelay, 150);
      return () => clearTimeout(timer);
    }
  }, [flatTreemapData, selectedFilter, renderTreemap, updateSelection]);

  // 리사이즈 처리
  useEffect(() => {
    if (!isInitialized) return;

    let resizeTimer;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        renderTreemap();
      }, 300);
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
      
      <ContentArea>
        <ContentGrid>
          <TreemapSection>
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
            
            {/* 레전드를 TreemapSection 안으로 이동 */}
            <Legend>
              {Object.entries(getCategoryColors).map(([category, colors]) => (
                <LegendItem key={category}>
                  <LegendColor
                    color={colors.primary}
                    borderColor={colors.dark}
                  />
                  <span>{category}</span>
                </LegendItem>
              ))}
            </Legend>
          </TreemapSection>
          
          <PerformanceDetailPanel
            selectedPerformance={selectedPerformance}
            divisionColors={divisionColors}
            statusColors={statusColors}
            onClearSelection={() => setSelectedPerformance(null)}
            globalPerformances={globalPerformances}
            projects={projects}
          />
        </ContentGrid>
      </ContentArea>
    </Container>
  );
};

export default PerformanceOverview;