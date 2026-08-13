import React, { useState } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { Calendar, User, Building, Edit, Trash2, CheckSquare } from 'lucide-react';
import GanttFilters from './components/GanttFilters';
import { getDivisionOrderIndex } from '../../utils/divisionSorting';

const GanttContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
  border-radius: 1rem;
  overflow: visible;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  position: relative;
`;

const GanttHeader = styled.div`
  background: linear-gradient(135deg, #374151 0%, #1f2937 100%);
  color: white;
  padding: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  flex-wrap: wrap;
  gap: 1rem;
  overflow: visible;
  position: relative;
  z-index: 100;
  
  .title {
    font-size: 1.25rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }
  
  .header-controls {
    display: flex;
    align-items: center;
    gap: 2rem;
    flex-wrap: wrap;
  }
  
  .year-selector {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .year-nav {
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 0.5rem;
    color: white;
    width: 2.5rem;
    height: 2.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 1.25rem;
    font-weight: bold;
    
    &:hover {
      background: rgba(255, 255, 255, 0.4);
      border-color: rgba(255, 255, 255, 0.5);
      transform: scale(1.05);
    }
    
    &:active {
      transform: scale(0.95);
    }
  }
  
  .current-year {
    font-size: 1.125rem;
    font-weight: 600;
    min-width: 4rem;
    text-align: center;
  }
`;

const GanttContent = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow-y: auto;
  position: relative;
  z-index: 1;
  max-height: calc(100vh - 200px);
  width: 100%;
`;

const HeaderRow = styled.div`
  display: flex;
  position: sticky;
  top: 0;
  z-index: 50;
  background: #374151;
  color: white;
  font-weight: 600;
  font-size: 0.875rem;
  border-bottom: 1px solid #4b5563;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const HeaderTaskSection = styled.div`
  width: calc(67% - 1px);
  background: #374151;
  border-right: 2px solid #4b5563;
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  min-width: 600px;
  box-sizing: border-box;
  flex-shrink: 0;
  
  .division-header {
    flex: 0.27;
    min-width: 0;
    text-align: center;
  }
  
  .task-header {
    flex: 4.16;
    min-width: 0;
    border-left: 1px solid #6b7280;
    padding-left: 1rem;
  }
  
  .performance-header {
    flex: 1.2;
    min-width: 0;
    text-align: center;
    border-left: 1px solid #6b7280;
    padding-left: 1rem;
  }
  
  .status-header {
    flex: 0.27;
    min-width: 0;
    text-align: center;
    border-left: 1px solid #6b7280;
    padding-left: 1rem;
  }
`;

const HeaderChartSection = styled.div`
  width: calc(33% + 1px);
  display: flex;
  background: #374151;
  min-width: 400px;
  box-sizing: border-box;
  flex-shrink: 0;
  
  .month-cell {
    flex: 1;
    padding: 1rem 0.5rem;
    text-align: center;
    font-weight: 600;
    font-size: 0.875rem;
    border-right: 1px solid #4b5563;
    min-width: 0;
    box-sizing: border-box;
    
    &:last-child {
      border-right: none;
    }
  }
`;

const DataRow = styled.div`
  display: flex;
  border-bottom: 1px solid #e5e7eb;
  background: white;
  min-height: auto;
  align-items: flex-start;
  
  &:hover {
    background: #f9fafb;
  }
`;

const TaskSection = styled.div`
  width: calc(67% - 1px);
  background: #f8fafc;
  border-right: 2px solid #e2e8f0;
  display: flex;
  min-width: 600px;
  box-sizing: border-box;
  flex-shrink: 0;
`;

const ChartSection = styled.div`
  width: calc(33% + 1px);
  display: flex;
  position: relative;
  min-width: 400px;
  box-sizing: border-box;
  flex-shrink: 0;
  align-items: center;
  align-self: stretch;
  
  .gantt-cell {
    width: 100%;
    position: relative;
    display: flex;
    align-items: center;
    box-sizing: border-box;
    height: 100%;
  }
`;

const TaskItem = styled(motion.div)`
  padding: 1rem;
  background: white;
  transition: background 0.2s ease;
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  position: relative;
  width: 100%;
  box-sizing: border-box;
  height: auto;
  min-height: auto;
  
  &:hover {
    background: #f3f4f6;
    
    .action-buttons {
      opacity: 1;
      pointer-events: auto;
    }
  }
  
  .division-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    flex: 0.27;
    min-width: 0;
    box-sizing: border-box;
    gap: 0.5rem;
    padding: 0.5rem 0;
  }
  
  .task-info {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: flex-start;
    gap: 0.75rem;
    width: 100%;
    max-width: 100%;
    overflow: hidden;
    flex: 4.16;
    min-width: 0;
    box-sizing: border-box;
    border-left: 1px solid #e5e7eb;
    padding: 1rem;
  }
  
  .performance-section {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-start;
    gap: 0.75rem;
    border-left: 1px solid #e5e7eb;
    padding: 1rem;
    flex-wrap: nowrap;
    flex: 1.2;
    min-width: 0;
    box-sizing: border-box;
    height: auto;
    min-height: auto;
    overflow: visible;
  }
  
  .status-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    flex: 0.27;
    min-width: 0;
    box-sizing: border-box;
    border-left: 1px solid #e5e7eb;
    padding-left: 1rem;
  }
  
  .task-title {
    font-weight: 600;
    font-size: 1rem;
    color: #1f2937;
    margin-bottom: 0.5rem;
    line-height: 1.4;
    word-break: keep-all;
    overflow-wrap: break-word;
    width: 100%;
    max-width: 100%;
  }
  
  .task-category {
    display: inline-flex;
    background: #10b981;
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    font-weight: 500;
    font-size: 0.75rem;
    margin-bottom: 0.75rem;
  }
  
  .task-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: #6b7280;
    margin-bottom: 0.25rem;
    align-items: center;
  }
  
  .department-list, .assignee-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    align-items: center;
    max-width: 100%;
  }
  
  .department-tag, .assignee-tag {
    background: #e0f2fe;
    color: #0369a1;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-size: 0.625rem;
    font-weight: 500;
    border: 1px solid #bae6fd;
    white-space: nowrap;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 0;
    cursor: default;
    transition: all 0.2s ease;
    
    &:hover {
      background: #0369a1;
      color: white;
      border-color: #0284c7;
      transform: translateY(-1px);
      box-shadow: 0 2px 4px rgba(3, 105, 161, 0.3);
    }
  }
  
  .assignee-tag {
    background: #f0f9ff;
    color: #0c4a6e;
    border-color: #7dd3fc;
    
    &:hover {
      background: #0c4a6e;
      color: white;
      border-color: #0369a1;
      box-shadow: 0 2px 4px rgba(12, 74, 110, 0.3);
    }
  }
  
  .action-buttons {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    opacity: 0;
    pointer-events: none;
    transition: all 0.2s ease;
    position: absolute;
    right: 0.5rem;
    top: 0.5rem;
    z-index: 10;
  }
  
  .action-btn {
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    
    &:hover {
      transform: scale(1.1);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    }
    
    &.edit-btn {
      color: #f59e0b;
      border-color: #fbbf24;
      
      &:hover {
        background: #f59e0b;
        color: white;
        border-color: #d97706;
      }
    }
    
    &.delete-btn {
      color: #ef4444;
      border-color: #f87171;
      
      &:hover {
        background: #ef4444;
        color: white;
        border-color: #dc2626;
      }
    }
  }
  
  .department-info, .assignee-info {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: #374151;
  }
  
  .division-badge {
    background: ${props => props.divisionColor || '#6b7280'};
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-weight: 500;
    font-size: 0.75rem;
    text-align: center;
    white-space: nowrap;
  }
  
  .process-badge {
    background: #3b82f6;
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-weight: 500;
    font-size: 0.75rem;
    text-align: center;
    white-space: nowrap;
  }
  
  .poc-badge {
    background: #f59e0b;
    color: white;
    padding: 0.2rem 0.4rem;
    border-radius: 0.25rem;
    font-weight: 500;
    font-size: 0.6875rem;
    text-align: center;
    white-space: nowrap;
  }
  
  .focus-badge {
    background: #ef4444;
    color: white;
    padding: 0.2rem 0.4rem;
    border-radius: 0.25rem;
    font-weight: 500;
    font-size: 0.6875rem;
    text-align: center;
    white-space: nowrap;
  }
  
  .status-badge {
    background: ${props => props.statusColor || '#6b7280'};
    color: white;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-weight: 500;
    font-size: 0.6875rem;
  }
  
  .progress-display {
    font-weight: 600;
    font-size: 0.875rem;
    color: #374151;
    background: #f3f4f6;
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    border: 1px solid #d1d5db;
    min-width: 3rem;
    text-align: center;
  }
`;

const ActionItemSection = styled.div`
  width: 100%;
  
  .action-items-title {
    font-weight: 600;
    font-size: 0.875rem;
    color: #374151;
    margin-bottom: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .action-items-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .action-item {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 0.375rem;
    padding: 0.5rem 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    
    .action-item-title {
      font-weight: 500;
      font-size: 0.8rem;
      color: #1f2937;
      margin: 0;
      flex: 1;
      
      &.completed {
        color: #6b7280;
      }
    }
    
    .completion-badge {
      background: #10b981;
      color: white;
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
      font-size: 0.6rem;
      font-weight: 600;
      white-space: nowrap;
    }
  }
  
  .no-action-items {
    font-size: 0.75rem;
    color: #9ca3af;
    font-style: italic;
  }
`;

const PerformanceItem = styled.div`
  display: flex;
  flex-direction: column;
  padding: 0.75rem;
  margin-bottom: 0.75rem;
  background: #f8fafc;
  border-radius: 0.5rem;
  border: 1px solid #e5e7eb;
  width: 100%;
  box-sizing: border-box;
  height: auto;
  min-height: auto;
  overflow: visible;
  
  &:last-child {
    margin-bottom: 0;
  }
  
  .performance-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
    min-width: 0;
    
    .main-category {
      font-weight: 600;
      color: #374151;
      font-size: 0.875rem;
      line-height: 1.2;
    }
    
    .sub-category {
      color: #6b7280;
      font-size: 0.8rem;
      line-height: 1.2;
    }
    
    .performance-text {
      color: #059669;
      font-size: 0.875rem;
      font-weight: 500;
      line-height: 1.3;
      word-break: break-word;
      overflow-wrap: break-word;
      margin: 0.25rem 0;
    }
    
    .metrics-info {
      margin-top: 0.25rem;
      font-size: 0.75rem;
      line-height: 1.4;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      
      .contribution-info {
        color: #4b5563;
        word-break: break-word;
        overflow-wrap: break-word;
        
        .label {
          font-weight: 600;
          color: #374151;
        }
      }
      
      .level-info {
        color: #4b5563;
        word-break: break-word;
        overflow-wrap: break-word;
        
        .label {
          font-weight: 600;
          color: #374151;
        }
      }
    }
  }
  
  @media (max-width: 768px) {
    padding: 0.375rem 0.5rem;
    
    .performance-info {
      .main-category {
        font-size: 0.8rem;
      }
      
      .sub-category {
        font-size: 0.75rem;
      }
      
      .performance-text {
        font-size: 0.8rem;
      }
      
      .metrics-info {
        font-size: 0.7rem;
      }
    }
  }
`;

const GanttBar = styled.div`
  position: absolute;
  top: 50%;
  left: ${props => props.startOffset}%;
  width: ${props => props.width}%;
  height: 24px;
  background: ${props => props.color};
  border-radius: 6px;
  transform: translateY(-50%);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
  transition: all 0.2s ease;
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.2);
  z-index: 1;
  
  &:hover {
    transform: translateY(-50%) scale(1.02);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    filter: brightness(1.1);
  }
  
  &:active {
    transform: translateY(-50%) scale(0.98);
  }
`;

const MONTHS = [
  '1월', '2월', '3월', '4월', '5월', '6월',
  '7월', '8월', '9월', '10월', '11월', '12월'
];

const GanttChart = ({ projects, statusColors, divisionColors, onYearChange, currentYear: propCurrentYear, onEditProject, onDeleteProject, settingsData }) => {
  const [currentYear, setCurrentYear] = useState(propCurrentYear || 2025);
  const [filters, setFilters] = useState({
    사업부: [],
    프로세스: [],
    과제구분: []
  });
  const [openDropdown, setOpenDropdown] = useState(null);
  
  const filterOptions = {
    사업부: settingsData?.divisions?.map(division => division.name) || [],
    프로세스: settingsData?.processes?.map(process => process.name) || [], // categories → processes로 변경
    과제구분: settingsData?.taskCategories?.map(taskCategory => taskCategory.name) || []
  };
  
  // 진행률 계산 함수
  const calculateProgress = (project) => {
    if (!project.액션아이템목록 || project.액션아이템목록.length === 0) {
      return 0;
    }
    
    const completedCount = project.액션아이템목록.filter(item => item.완료여부 === true).length;
    const totalCount = project.액션아이템목록.length;
    
    return Math.round((completedCount / totalCount) * 100);
  };
  
  const filteredProjects = projects.filter(project => {
    const yearMatch = project.과제년도 === currentYear;
    const 사업부Match = filters.사업부.length === 0 || filters.사업부.includes(project.사업부);
    const 프로세스Match = filters.프로세스.length === 0 || filters.프로세스.includes(project.프로세스 || project.부문); // 프로세스 필드와 기존 부문 필드 모두 지원
    const 과제구분Match = filters.과제구분.length === 0 || filters.과제구분.includes(project.과제구분);
    
    return yearMatch && 사업부Match && 프로세스Match && 과제구분Match;
  }).sort((a, b) => {
    // 1순위: 사업부 순서
    const aDivisionIndex = getDivisionOrderIndex(a.사업부);
    const bDivisionIndex = getDivisionOrderIndex(b.사업부);
    if (aDivisionIndex !== bDivisionIndex) {
      return aDivisionIndex - bDivisionIndex;
    }
    // 2순위: 과제 ID (작은 순)
    return a.id - b.id;
  });
  
  const renderPerformanceList = (project) => {
    if (project.성과목록 && Array.isArray(project.성과목록) && project.성과목록.length > 0) {
      return project.성과목록.map((performance, index) => (
        <PerformanceItem key={index}>
          <div className="performance-info">
            <div className="main-category">{performance.대분류 || '미지정'}</div>
            <div className="sub-category">{performance.소분류 || '미지정'}</div>
            <div className="performance-text">{performance.성과항목 || '미지정'}</div>
            <div className="metrics-info">
              <div className="contribution-info">
                <span className="label">성과 기여도: </span>{performance.과제기여도}%
              </div>
              <div className="level-info">
                <span className="label">현재: </span>{performance.현재수준} {performance.단위} | 
                <span className="label"> 목표: </span>{performance.목표수준} {performance.단위}
                {performance.실적수준 && (
                  <>
                    <span className="label"> | 실적: </span>{performance.실적수준} {performance.단위}
                  </>
                )}
              </div>
            </div>
          </div>
        </PerformanceItem>
      ));
    }
    
    return (
      <PerformanceItem>
        <div className="performance-info">
          <div className="main-category">미지정</div>
          <div className="sub-category">성과 없음</div>
          <div className="performance-text">등록된 성과가 없습니다</div>
        </div>
      </PerformanceItem>
    );
  };
  
  const calculateBarPosition = (start, end) => {
    const startOffset = ((start - 1) / 12) * 100;
    const duration = end - start + 1;
    const width = (duration / 12) * 100;
    return { startOffset, width };
  };
  
  const handlePrevYear = () => {
    const newYear = currentYear - 1;
    setCurrentYear(newYear);
    if (onYearChange) {
      onYearChange(newYear);
    }
  };
  
  const handleNextYear = () => {
    const newYear = currentYear + 1;
    setCurrentYear(newYear);
    if (onYearChange) {
      onYearChange(newYear);
    }
  };
  
  const handleFilterChange = (filterType, value) => {
    setFilters(prev => {
      const currentValues = prev[filterType] || [];
      const newValues = currentValues.includes(value)
        ? currentValues.filter(v => v !== value)
        : [...currentValues, value];
      
      return {
        ...prev,
        [filterType]: newValues
      };
    });
  };
  
  const handleClearFilter = (filterType) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: []
    }));
  };
  
  const handleClearAllFilters = () => {
    setFilters({
      사업부: [],
      프로세스: [],
      과제구분: []
    });
  };
  
  const toggleDropdown = (filterType) => {
    setOpenDropdown(openDropdown === filterType ? null : filterType);
  };
  
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      const isInsideFilterGroup = event.target.closest('.filter-group');
      
      if (!isInsideFilterGroup && openDropdown) {
        setOpenDropdown(null);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openDropdown]);
  
  React.useEffect(() => {
    if (propCurrentYear && propCurrentYear !== currentYear) {
      setCurrentYear(propCurrentYear);
    }
  }, [propCurrentYear, currentYear]);
  
  return (
    <GanttContainer>
      <GanttHeader>
        <div className="title">
          <Calendar size={20} />
          디지털 트윈 과제 진행 현황
        </div>
        
        <div className="header-controls">
          <GanttFilters
            filters={filters}
            onFilterChange={handleFilterChange}
            onClearFilter={handleClearFilter}
            onClearAllFilters={handleClearAllFilters}
            openDropdown={openDropdown}
            onToggleDropdown={toggleDropdown}
            filterOptions={filterOptions}
          />
          
          <div className="year-selector">
            <button className="year-nav" onClick={handlePrevYear} title="이전 년도">
              ‹
            </button>
            <div className="current-year">{currentYear}</div>
            <button className="year-nav" onClick={handleNextYear} title="다음 년도">
              ›
            </button>
          </div>
        </div>
      </GanttHeader>
      
      <GanttContent>
        <HeaderRow>
          <HeaderTaskSection>
            <div className="division-header">
              기본 정보
            </div>
            <div className="task-header">
              과제 내용
            </div>
            <div className="performance-header">
              성과
            </div>
            <div className="status-header">
              진행 상태
            </div>
          </HeaderTaskSection>
          <HeaderChartSection>
            {MONTHS.map((month, index) => (
              <div key={index} className="month-cell">{month}</div>
            ))}
          </HeaderChartSection>
        </HeaderRow>
        
        {filteredProjects.map((project, index) => {
          const { startOffset, width } = calculateBarPosition(project.시작, project.종료);
          const progressRate = calculateProgress(project); // 동적으로 진행률 계산
          
          return (
            <DataRow key={project.id}>
              <TaskSection>
                <TaskItem
                  divisionColor={divisionColors[project.사업부]}
                  statusColor={statusColors[project.진행상태]}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <div className="division-section">
                    <span className="division-badge">{project.사업부}</span>
                    <span className="process-badge">{project.프로세스 || project.부문}</span> {/* 프로세스 필드와 기존 부문 필드 모두 지원 */}
                    {project.PoC과제여부 && (
                      <span className="poc-badge">PoC 과제</span>
                    )}
                    {project.중점과제여부 && (
                      <span className="focus-badge">중점 과제</span>
                    )}
                  </div>
                  
                  <div className="task-info">
                    <div className="task-title">{project.과제명}</div>
                    <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem'}}>
                      <div style={{
                        background: '#2563eb',
                        color: 'white',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.375rem',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        display: 'inline-flex',
                        alignItems: 'center'
                      }}>ID: {project.id}</div>
                      <div style={{
                        background: '#10b981',
                        color: 'white',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.375rem',
                        fontWeight: '500',
                        fontSize: '0.75rem',
                        display: 'inline-flex',
                        alignItems: 'center'
                      }}>{project.과제구분}</div>
                    </div>
                    
                    <ActionItemSection>
                      <div className="action-items-title">
                        <CheckSquare size={12} />
                        액션 아이템
                      </div>
                      {project.액션아이템목록 && project.액션아이템목록.length > 0 ? (
                        <div className="action-items-list">
                          {project.액션아이템목록.map((actionItem, actionIndex) => (
                            <div key={actionIndex} className="action-item">
                              <div className={`action-item-title ${actionItem.완료여부 ? 'completed' : ''}`}>
                                {actionItem.제목}
                              </div>
                              {actionItem.완료여부 && (
                                <div className="completion-badge">완료</div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="no-action-items">등록된 액션 아이템이 없습니다</div>
                      )}
                    </ActionItemSection>
                  </div>
                  
                  <div className="performance-section">
                    {renderPerformanceList(project)}
                  </div>
                  
                  <div className="status-section">
                    <span className="status-badge">{project.진행상태}</span>
                    <div className="progress-display">
                      {progressRate}%
                    </div>
                  </div>
                  
                  <div className="action-buttons">
                    <button 
                      className="action-btn edit-btn" 
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditProject && onEditProject(project);
                      }}
                      title="과제 편집"
                    >
                      <Edit size={14} />
                    </button>
                    <button 
                      className="action-btn delete-btn" 
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteProject && onDeleteProject(project);
                      }}
                      title="과제 삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </TaskItem>
              </TaskSection>
              
              <ChartSection>
                <div className="gantt-cell">
                  <GanttBar
                    startOffset={startOffset}
                    width={width}
                    color={statusColors[project.진행상태] || '#6b7280'}
                    title={`${project.과제명} (${project.시작}월-${project.종료}월)`}
                  />
                </div>
              </ChartSection>
            </DataRow>
          );
        })}
      </GanttContent>
    </GanttContainer>
  );
};

export default GanttChart;
