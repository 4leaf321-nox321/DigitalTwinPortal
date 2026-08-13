import React, { useState, useMemo } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';

const Container = styled(motion.div)`
  background: white;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  width: 100%;
  /* "전체 성과 분류 현황"과 동일한 높이 */
  height: calc(100vh - 64px - 2rem);
  min-height: calc(100vh - 64px - 2rem);
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

const ContentSection = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  align-items: stretch;
  flex: 1;
  min-height: 0;
`;



const ChartOnlySection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
  min-height: 0;
`;



const DetailOnlySection = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
`;



const ChartContainer = styled.div`
  width: 100%;
  position: relative;
  margin-bottom: 1rem;
  flex: 1;
  min-height: 300px;
`;

const StackedChart = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 1rem 0;
  gap: 0.5rem;
`;

const MonthColumn = styled.div`
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  position: relative;
`;

const StackedBar = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  height: ${props => props.$heightPercent}%;
  position: relative;
`;

const DivisionSegment = styled(motion.div)`
  width: 100%;
  background: ${props => props.color};
  flex: ${props => props.$segmentPercent};
  min-height: 2px;
  position: relative;
  border-radius: ${props => props.isFirst ? '0.25rem 0.25rem 0 0' : props.isLast ? '0 0 0.25rem 0.25rem' : '0'};
  transition: all 0.3s ease;
  cursor: pointer;
  border-top: ${props => props.isFirst ? 'none' : '1px solid rgba(255,255,255,0.3)'};

  &:hover {
    opacity: 0.8;
    transform: scaleX(1.05);
  }
  
  ${props => props.isSelected && `
    box-shadow: 0 0 0 3px #fbbf24;
    z-index: 10;
  `}
`;

const TotalLabel = styled.div`
  position: absolute;
  top: -1.8rem;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.75rem;
  font-weight: 600;
  color: #374151;
  white-space: nowrap;
  background: white;
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: #3b82f6;
    color: white;
    transform: translateX(-50%) scale(1.05);
  }
  
  ${props => props.isSelected && `
    background: #fbbf24;
    color: white;
    box-shadow: 0 0 0 2px #fbbf24;
  `}
`;

const XAxis = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 0 0.25rem;
`;

const MonthLabel = styled.div`
  font-size: 0.75rem;
  color: #64748b;
  font-weight: 500;
  text-align: center;
  flex: 1;
`;

const YAxis = styled.div`
  position: absolute;
  left: -2rem;
  top: 0;
  height: 100%;
  display: flex;
  flex-direction: column-reverse;
  justify-content: space-between;
  padding: 1rem 0;
`;

const YAxisLabel = styled.div`
  font-size: 0.65rem;
  color: #64748b;
  font-weight: 500;
  text-align: right;
  width: 1.5rem;
`;

const YAxisTitle = styled.div`
  position: absolute;
  left: -3rem;
  top: 50%;
  transform: translateY(-50%) rotate(-90deg);
  font-size: 0.75rem;
  color: #374151;
  font-weight: 600;
  white-space: nowrap;
`;

const Legend = styled.div`
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
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
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 0.125rem;
  background: ${props => props.color};
`;

const DetailPanel = styled.div`
  background: #f8fafc;
  border-radius: 0.75rem;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  border: 1px solid #e2e8f0;
  height: 100%;
  min-height: 0;
  overflow: hidden;
`;

const DetailTitle = styled.h4`
  margin: 0 0 1rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  &::before {
    content: '📋';
    font-size: 1rem;
  }
`;

const SelectedInfo = styled.div`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  padding: 0.75rem;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const SelectionBadge = styled.div`
  background: ${props => props.color || '#3b82f6'};
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 600;
`;

const ProjectList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  flex: 1;
  overflow-y: auto;
  padding-right: 0.5rem;

  /* 스크롤바 스타일링 */
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;

    &:hover {
      background: #94a3b8;
    }
  }
`;

const ProjectItem = styled(motion.div)`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  padding: 1rem;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: #60a5fa;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;

const ProjectName = styled.div`
  font-weight: 600;
  color: #1e293b;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
  line-height: 1.3;
`;

const ProjectMeta = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
`;

const ProjectInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const MetaBadge = styled.div`
  background: ${props => props.color || '#64748b'};
  color: white;
  padding: 0.2rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.65rem;
  font-weight: 500;
`;

const ProjectPeriod = styled.div`
  font-size: 0.75rem;
  color: #64748b;
  font-weight: 500;
`;

const ActionItemsSection = styled.div`
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #e2e8f0;
`;

const ActionItemsTitle = styled.div`
  font-size: 0.75rem;
  font-weight: 600;
  color: #475569;
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  
  &::before {
    content: '📝';
    font-size: 0.75rem;
  }
`;

const ActionItemsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const ActionItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: #64748b;
`;

const ActionItemCheckbox = styled.div`
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 0.125rem;
  background: ${props => props.completed ? '#22c55e' : '#e5e7eb'};
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.5rem;
  flex-shrink: 0;
  
  &::after {
    content: ${props => props.completed ? "'✓'" : "''"};;
  }
`;

const ActionItemText = styled.div`
  flex: 1;
  color: ${props => props.completed ? '#9ca3af' : '#64748b'};
  text-decoration: ${props => props.completed ? 'line-through' : 'none'};
`;

const ActionItemsProgress = styled.div`
  font-size: 0.7rem;
  color: #64748b;
  font-weight: 500;
  margin-left: auto;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #64748b;
  text-align: center;
  padding: 3rem 2rem;
  
  .icon {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }
  
  .title {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }
  
  .message {
    font-size: 0.875rem;
    line-height: 1.5;
  }
`;

const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

// View Toggle Styles
const ViewToggleContainer = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-left: auto;
`;

const ViewToggleButton = styled.button`
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
  border: 1px solid ${props => props.$active ? '#3b82f6' : '#e2e8f0'};
  background: ${props => props.$active ? '#3b82f6' : 'white'};
  color: ${props => props.$active ? 'white' : '#64748b'};
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.$active ? '#2563eb' : '#f8fafc'};
    border-color: ${props => props.$active ? '#2563eb' : '#cbd5e1'};
  }
`;

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 1.5rem;
`;

// Tooltip Styles
const TooltipContainer = styled(motion.div)`
  position: absolute;
  top: -4.5rem;
  left: 50%;
  transform: translateX(-50%);
  background: #1e293b;
  color: white;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  white-space: nowrap;
  z-index: 100;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);

  &::after {
    content: '';
    position: absolute;
    bottom: -6px;
    left: 50%;
    transform: translateX(-50%);
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-top: 6px solid #1e293b;
  }
`;

const TooltipRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.125rem 0;
`;

const TooltipDot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${props => props.color};
`;

// Weekly Modal Styles
const ModalOverlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled(motion.div)`
  background: white;
  border-radius: 1rem;
  padding: 1.5rem;
  width: 90%;
  max-width: 800px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e2e8f0;
`;

const ModalTitle = styled.h3`
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #64748b;
  cursor: pointer;
  padding: 0.25rem;
  line-height: 1;

  &:hover {
    color: #1e293b;
  }
`;

const ModalBody = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  flex: 1;
  overflow: hidden;
`;

const ItemSection = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 0;
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid ${props => props.color || '#e2e8f0'};
`;

const SectionIcon = styled.span`
  font-size: 1.25rem;
`;

const SectionTitle = styled.h4`
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #1e293b;
`;

const SectionCount = styled.span`
  background: ${props => props.color || '#64748b'};
  color: white;
  padding: 0.125rem 0.5rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  margin-left: auto;
`;

const ItemList = styled.div`
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-right: 0.5rem;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
    &:hover {
      background: #94a3b8;
    }
  }
`;

const ItemCard = styled.div`
  background: ${props => props.$bgColor || '#f8fafc'};
  border: 1px solid ${props => props.$borderColor || '#e2e8f0'};
  border-radius: 0.5rem;
  padding: 0.75rem;
`;

const ItemProjectName = styled.div`
  font-size: 0.75rem;
  color: #64748b;
  margin-bottom: 0.25rem;
`;

const ItemActionName = styled.div`
  font-size: 0.875rem;
  font-weight: 500;
  color: #1e293b;
  margin-bottom: 0.5rem;
`;

const ItemMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: #64748b;
`;

const ItemDate = styled.span`
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const EmptyItemState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: #94a3b8;
  text-align: center;
  font-size: 0.875rem;
`;

// Weekly chart specific styles
const WeekColumn = styled.div`
  flex: 1;
  max-width: 60px;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  position: relative;
  cursor: pointer;

  &:hover {
    .week-tooltip {
      opacity: 1;
      visibility: visible;
    }
  }
`;

const WeekBar = styled(motion.div)`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  height: ${props => props.$heightPercent}%;
  position: relative;
  min-height: ${props => props.$heightPercent > 0 ? '4px' : '0'};
`;

const WeekSegment = styled(motion.div)`
  width: 85%;
  background: ${props => props.color};
  flex: ${props => props.$segmentPercent};
  min-height: ${props => props.$segmentPercent > 0 ? '2px' : '0'};
  border-radius: ${props => props.$isTop ? '0.25rem 0.25rem 0 0' : '0'};
  transition: all 0.2s ease;

  &:hover {
    opacity: 0.85;
    transform: scaleX(1.05);
  }
`;

const WeekLabel = styled.div`
  font-size: 0.65rem;
  color: #64748b;
  font-weight: 500;
  text-align: center;
  margin-top: 0.5rem;
  white-space: nowrap;
`;

const ProgressTrendChart = ({ projects, divisionColors }) => {
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [viewMode, setViewMode] = useState('monthly'); // 'monthly' or 'weekly'
  const [hoveredWeek, setHoveredWeek] = useState(null);
  const [selectedWeekModal, setSelectedWeekModal] = useState(null);

  // Helper: Get week number from date
  const getWeekNumber = (date) => {
    const d = new Date(date);
    const startOfYear = new Date(d.getFullYear(), 0, 1);
    const days = Math.floor((d - startOfYear) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + startOfYear.getDay() + 1) / 7);
  };

  // Helper: Get week date range
  const getWeekDateRange = (year, weekNum) => {
    const firstDayOfYear = new Date(year, 0, 1);
    const daysOffset = (weekNum - 1) * 7 - firstDayOfYear.getDay();
    const startDate = new Date(year, 0, 1 + daysOffset);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    return { startDate, endDate };
  };

  // Helper: Format date as MM/DD
  const formatShortDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  // Calculate weekly data with planned/completed items
  const weeklyData = useMemo(() => {
    if (!projects || projects.length === 0) return [];

    const currentYear = new Date().getFullYear();
    const weeks = [];

    // Generate weeks for the current year (52 weeks)
    for (let week = 1; week <= 52; week++) {
      const { startDate, endDate } = getWeekDateRange(currentYear, week);

      const plannedItems = [];
      const completedItems = [];

      projects.forEach(project => {
        const actionItems = project.액션아이템목록 || [];
        actionItems.forEach(item => {
          if (item.완료여부 && item.완료일) {
            // 완료된 항목: 완료에만 표시
            const completionDate = new Date(item.완료일);
            if (completionDate >= startDate && completionDate <= endDate) {
              completedItems.push({
                ...item,
                projectId: project.id,
                projectName: project.과제명,
                division: project.사업부
              });
            }
          } else if (item.목표일) {
            // 미완료 항목: 계획에만 표시
            const targetDate = new Date(item.목표일);
            if (targetDate >= startDate && targetDate <= endDate) {
              plannedItems.push({
                ...item,
                projectId: project.id,
                projectName: project.과제명,
                division: project.사업부
              });
            }
          }
        });
      });

      weeks.push({
        weekNum: week,
        startDate,
        endDate,
        plannedItems,
        completedItems,
        plannedCount: plannedItems.length,
        completedCount: completedItems.length,
        totalCount: plannedItems.length + completedItems.length
      });
    }

    return weeks;
  }, [projects]);

  // Get current week for highlighting
  const currentWeek = getWeekNumber(new Date());

  // Filter to show only weeks with data or around current week
  const visibleWeeks = useMemo(() => {
    const weeksWithData = weeklyData.filter(w => w.totalCount > 0);
    if (weeksWithData.length === 0) {
      // Show weeks around current week if no data
      return weeklyData.slice(Math.max(0, currentWeek - 8), Math.min(52, currentWeek + 8));
    }

    // Find range of weeks with data
    const minWeek = Math.min(...weeksWithData.map(w => w.weekNum));
    const maxWeek = Math.max(...weeksWithData.map(w => w.weekNum));

    // Extend range a bit and include current week
    const start = Math.max(1, Math.min(minWeek - 2, currentWeek - 4));
    const end = Math.min(52, Math.max(maxWeek + 2, currentWeek + 4));

    return weeklyData.slice(start - 1, end);
  }, [weeklyData, currentWeek]);

  // Max count for weekly chart scaling
  const maxWeeklyCount = Math.max(...visibleWeeks.map(w => w.totalCount), 1);
  const weeklyAxisMax = Math.ceil(maxWeeklyCount / 5) * 5 || 5;

  // Handle week click for modal
  const handleWeekClick = (weekData) => {
    if (weekData.totalCount === 0) return;
    setSelectedWeekModal(weekData);
  };

  // 데이터가 없는 경우
  if (!projects || projects.length === 0) {
    return (
      <Container
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <TitleRow>
          <Title style={{ margin: 0 }}>
            {viewMode === 'monthly' ? '월별 진행 과제 현황' : '주차별 계획/완료 현황'}
          </Title>
          <ViewToggleContainer>
            <ViewToggleButton
              $active={viewMode === 'monthly'}
              onClick={() => setViewMode('monthly')}
            >
              월별
            </ViewToggleButton>
            <ViewToggleButton
              $active={viewMode === 'weekly'}
              onClick={() => setViewMode('weekly')}
            >
              주차별
            </ViewToggleButton>
          </ViewToggleContainer>
        </TitleRow>
        <EmptyState>
          <div className="icon">📊</div>
          <div className="message">
            분석할 프로젝트 데이터가 없습니다.<br />
            프로젝트를 추가해보세요.
          </div>
        </EmptyState>
      </Container>
    );
  }

  // 실제 프로젝트에서 사업부 목록 추출 (동적으로 생성)
  const divisions = [...new Set(projects.map(p => p.사업부))].filter(div => div).sort((a, b) => {
    // 사업부 정렬 순서 정의 (GTR 포함)
    const order = ['MX', 'VD', 'DA', 'NW', '의료기기', 'GTR'];
    const aIndex = order.indexOf(a);
    const bIndex = order.indexOf(b);
    
    // 정의된 순서에 있는 경우 해당 순서 사용
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }
    
    // 정의된 순서에 없는 경우 알파벳 순
    if (aIndex === -1 && bIndex === -1) {
      return a.localeCompare(b);
    }
    
    // 한쪽만 정의된 순서에 있는 경우 정의된 것을 앞으로
    return aIndex !== -1 ? -1 : 1;
  });

  // 월별 사업부별 과제 수 계산
  const monthlyData = MONTHS.map((month, index) => {
    const monthNumber = index + 1;
    
    // 해당 월에 진행 중인 프로젝트들
    const activeProjects = projects.filter(project => {
      const startMonth = project.시작 || 1;
      const endMonth = project.종료 || 12;
      return startMonth <= monthNumber && monthNumber <= endMonth;
    });
    
    // 사업부별 과제 수 계산
    const divisionCounts = {};
    const divisionProjects = {};
    
    divisions.forEach(division => {
      const divisionProjectList = activeProjects.filter(p => p.사업부 === division);
      divisionCounts[division] = divisionProjectList.length;
      divisionProjects[division] = divisionProjectList;
    });
    
    const totalCount = activeProjects.length;
    
    return {
      month,
      monthNumber,
      divisionCounts,
      divisionProjects,
      totalCount,
      activeProjects
    };
  });

  // 최대 과제 수 찾기 (차트 스케일링용)
  const maxCount = Math.max(...monthlyData.map(m => m.totalCount), 1);

  // Y축 최대값을 적절한 단위로 올림 (여유 공간 최소화)
  const getAxisMax = (max) => {
    if (max <= 5) return max + 1;
    if (max <= 10) return Math.ceil(max / 2) * 2 + 2;
    if (max <= 20) return Math.ceil(max / 5) * 5;
    return Math.ceil(max / 10) * 10;
  };
  const axisMax = getAxisMax(maxCount);

  // Y축 눈금 생성 (5단계) - 최대값 기준
  const yAxisLabels = [];
  for (let i = 0; i <= 4; i++) {
    yAxisLabels.push(Math.round((axisMax * i) / 4));
  }

  // 막대 높이는 axisMax 기준으로 계산 (100% 활용)
  const maxBarHeightPercent = 100; // 퍼센트 기준

  // 세그먼트 클릭 핸들러
  const handleSegmentClick = (monthData, division) => {
    const projects = monthData.divisionProjects[division] || [];
    if (projects.length === 0) return;

    // 이미 선택된 세그먼트를 다시 클릭하면 해제
    if (selectedSegment && 
        selectedSegment.month === monthData.month && 
        selectedSegment.division === division &&
        !selectedSegment.isMonthTotal) {
      setSelectedSegment(null);
      return;
    }

    setSelectedSegment({
      month: monthData.month,
      monthNumber: monthData.monthNumber,
      division,
      projects,
      color: divisionColors[division] || '#64748b',
      isMonthTotal: false
    });
  };
  
  // 월별 전체 과제 클릭 핸들러
  const handleMonthTotalClick = (monthData) => {
    if (monthData.activeProjects.length === 0) return;
    
    // 이미 선택된 월별 전체를 다시 클릭하면 해제
    if (selectedSegment && 
        selectedSegment.month === monthData.month && 
        selectedSegment.isMonthTotal) {
      setSelectedSegment(null);
      return;
    }
    
    setSelectedSegment({
      month: monthData.month,
      monthNumber: monthData.monthNumber,
      division: '전체', // 전체 사업부
      projects: monthData.activeProjects,
      color: '#3b82f6',
      isMonthTotal: true
    });
  };

  return (
    <Container
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <TitleRow>
        <Title style={{ margin: 0 }}>
          {viewMode === 'monthly' ? '월별 진행 과제 현황' : '주차별 계획/완료 현황'}
        </Title>
        <ViewToggleContainer>
          <ViewToggleButton
            $active={viewMode === 'monthly'}
            onClick={() => setViewMode('monthly')}
          >
            월별
          </ViewToggleButton>
          <ViewToggleButton
            $active={viewMode === 'weekly'}
            onClick={() => setViewMode('weekly')}
          >
            주차별
          </ViewToggleButton>
        </ViewToggleContainer>
      </TitleRow>
      
      {viewMode === 'monthly' ? (
      <ContentSection>
        <ChartOnlySection>
          {/* 레전드를 차트 위쪽으로 이동 */}
          <Legend>
            {divisions.map(division => (
              <LegendItem key={division}>
                <LegendColor color={divisionColors[division] || '#94a3b8'} />
                <span>{division}</span>
              </LegendItem>
            ))}
          </Legend>
          <ChartContainer>
            <YAxis>
              {yAxisLabels.map((label, index) => (
                <YAxisLabel key={index}>{label}</YAxisLabel>
              ))}
            </YAxis>
            <YAxisTitle>과제 수</YAxisTitle>
            
            <StackedChart>
              {monthlyData.map((monthData, monthIndex) => {
                // 막대 높이를 퍼센트로 계산 (axisMax 기준)
                const barHeightPercent = axisMax > 0 ? (monthData.totalCount / axisMax) * maxBarHeightPercent : 0;

                // 각 사업부 세그먼트 높이 계산
                const segments = divisions.map(division => ({
                  division,
                  count: monthData.divisionCounts[division] || 0,
                  color: divisionColors[division] || '#94a3b8'
                })).filter(s => s.count > 0);

                // 세그먼트 높이를 퍼센트로 계산
                const segmentsWithHeight = segments.map((segment, segIndex) => {
                  const segmentPercent = monthData.totalCount > 0 ? (segment.count / monthData.totalCount) * 100 : 0;
                  return {
                    ...segment,
                    segmentPercent,
                    isFirst: segIndex === segments.length - 1,
                    isLast: segIndex === 0
                  };
                }).reverse(); // 스택 순서를 위해 뒤집기

                return (
                  <MonthColumn key={monthIndex}>
                    <StackedBar $heightPercent={barHeightPercent}>
                      {segmentsWithHeight.map((segment, segIndex) => {
                        const isSegmentSelected = selectedSegment && 
                          selectedSegment.month === monthData.month && 
                          selectedSegment.division === segment.division &&
                          !selectedSegment.isMonthTotal;
                        
                        return (
                          <DivisionSegment
                            key={segment.division}
                            color={segment.color}
                            $segmentPercent={segment.segmentPercent}
                            isFirst={segment.isFirst}
                            isLast={segment.isLast}
                            isSelected={isSegmentSelected}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.5, delay: monthIndex * 0.05 + segIndex * 0.02 }}
                            onClick={() => handleSegmentClick(monthData, segment.division)}
                          />
                        );
                      })}
                      
                      {monthData.totalCount > 0 && (
                        <TotalLabel 
                          isSelected={selectedSegment && 
                                    selectedSegment.month === monthData.month && 
                                    selectedSegment.isMonthTotal}
                          onClick={() => handleMonthTotalClick(monthData)}
                        >
                          {monthData.totalCount}
                        </TotalLabel>
                      )}
                    </StackedBar>
                  </MonthColumn>
                );
              })}
            </StackedChart>
          </ChartContainer>
          
          <XAxis>
            {MONTHS.map((month, index) => (
              <MonthLabel key={index}>{month}</MonthLabel>
            ))}
          </XAxis>
        </ChartOnlySection>
        
        <DetailOnlySection>
          <DetailPanel>
            <DetailTitle>과제 상세</DetailTitle>
            
            {selectedSegment ? (
              <>
                <SelectedInfo>
                  <div>
                    <SelectionBadge color={selectedSegment.color}>
                      {selectedSegment.isMonthTotal ? '전체 사업부' : selectedSegment.division}
                    </SelectionBadge>
                    <span style={{marginLeft: '0.5rem', fontSize: '0.875rem', color: '#64748b'}}>
                      {selectedSegment.month} {selectedSegment.isMonthTotal ? '전체' : ''} 진행 과제
                    </span>
                  </div>
                  <div style={{fontSize: '0.75rem', color: '#64748b'}}>
                    {selectedSegment.projects.length}개 과제
                  </div>
                </SelectedInfo>
                
                <ProjectList>
                  <AnimatePresence>
                    {selectedSegment.projects.map((project, index) => {
                      const actionItems = project.액션아이템목록 || [];
                      const completedActions = actionItems.filter(item => item.완료여부);
                      const progressPercentage = actionItems.length > 0 ? 
                        Math.round((completedActions.length / actionItems.length) * 100) : 0;
                      
                      return (
                        <ProjectItem
                          key={project.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
                        >
                          <ProjectName>{project.과제명}</ProjectName>
                          <ProjectMeta>
                            <ProjectInfo>
                              <MetaBadge color="#2563eb">
                                ID: {project.id}
                              </MetaBadge>
                              <MetaBadge color={divisionColors[project.사업부] || '#64748b'}>
                                {project.사업부}
                              </MetaBadge>
                              <MetaBadge color="#64748b">
                                {project.진행상태}
                              </MetaBadge>
                            </ProjectInfo>
                            <ProjectPeriod>
                              {project.시작}월 ~ {project.종료}월
                            </ProjectPeriod>
                          </ProjectMeta>
                          
                          {actionItems.length > 0 && (
                            <ActionItemsSection>
                              <ActionItemsTitle>
                                액션 아이템 ({completedActions.length}/{actionItems.length})
                                <ActionItemsProgress>
                                  {progressPercentage}% 완료
                                </ActionItemsProgress>
                              </ActionItemsTitle>
                              <ActionItemsList>
                                {actionItems.map((actionItem, actionIndex) => (
                                  <ActionItem key={actionIndex}>
                                    <ActionItemCheckbox completed={actionItem.완료여부} />
                                    <ActionItemText completed={actionItem.완료여부}>
                                      {actionItem.제목}
                                    </ActionItemText>
                                  </ActionItem>
                                ))}
                              </ActionItemsList>
                            </ActionItemsSection>
                          )}
                        </ProjectItem>
                      );
                    })}
                  </AnimatePresence>
                </ProjectList>
              </>
            ) : (
              <EmptyState>
                <div className="icon">📋</div>
                <div className="title">과제 영역을 선택해보세요</div>
                <div className="message">
                  좌측 차트에서 월별 사업부 영역을 클릭하면<br />
                  해당 과제들의 상세 정보가 표시됩니다.
                </div>
              </EmptyState>
            )}
          </DetailPanel>
        </DetailOnlySection>
      </ContentSection>
      ) : (
      /* Weekly View */
      <ContentSection>
        <ChartOnlySection>
          <Legend>
            <LegendItem>
              <LegendColor color="#3b82f6" />
              <span>계획 (미완료, 목표일 기준)</span>
            </LegendItem>
            <LegendItem>
              <LegendColor color="#22c55e" />
              <span>완료 (완료일 기준)</span>
            </LegendItem>
          </Legend>
          <ChartContainer>
            <YAxis>
              {[0, 1, 2, 3, 4].map((i) => (
                <YAxisLabel key={i}>{Math.round((weeklyAxisMax * i) / 4)}</YAxisLabel>
              ))}
            </YAxis>
            <YAxisTitle>아이템 수</YAxisTitle>

            <StackedChart>
              {visibleWeeks.map((weekData, idx) => {
                const barHeightPercent = weeklyAxisMax > 0
                  ? (weekData.totalCount / weeklyAxisMax) * 100
                  : 0;
                const plannedPercent = weekData.totalCount > 0
                  ? (weekData.plannedCount / weekData.totalCount) * 100
                  : 0;
                const completedPercent = weekData.totalCount > 0
                  ? (weekData.completedCount / weekData.totalCount) * 100
                  : 0;

                const isCurrentWeek = weekData.weekNum === currentWeek;
                const isHovered = hoveredWeek === weekData.weekNum;

                return (
                  <WeekColumn
                    key={weekData.weekNum}
                    onMouseEnter={() => setHoveredWeek(weekData.weekNum)}
                    onMouseLeave={() => setHoveredWeek(null)}
                    onClick={() => handleWeekClick(weekData)}
                    style={{
                      background: isCurrentWeek ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                      borderRadius: '0.25rem'
                    }}
                  >
                    <WeekBar $heightPercent={barHeightPercent}>
                      {weekData.plannedCount > 0 && (
                        <WeekSegment
                          color="#3b82f6"
                          $segmentPercent={plannedPercent}
                          $isTop={weekData.completedCount === 0}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: idx * 0.02 }}
                        />
                      )}
                      {weekData.completedCount > 0 && (
                        <WeekSegment
                          color="#22c55e"
                          $segmentPercent={completedPercent}
                          $isTop={true}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: idx * 0.02 + 0.01 }}
                        />
                      )}

                      {/* Tooltip */}
                      <AnimatePresence>
                        {isHovered && weekData.totalCount > 0 && (
                          <TooltipContainer
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 5 }}
                          >
                            <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                              {weekData.weekNum}주차 (총 {weekData.totalCount}건)
                            </div>
                            <TooltipRow>
                              <TooltipDot color="#3b82f6" />
                              <span>계획: {weekData.plannedCount}건</span>
                            </TooltipRow>
                            <TooltipRow>
                              <TooltipDot color="#22c55e" />
                              <span>완료: {weekData.completedCount}건</span>
                            </TooltipRow>
                            <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                              클릭하여 상세 보기
                            </div>
                          </TooltipContainer>
                        )}
                      </AnimatePresence>

                      {weekData.totalCount > 0 && (
                        <TotalLabel style={{ fontSize: '0.65rem' }}>
                          {weekData.totalCount}
                        </TotalLabel>
                      )}
                    </WeekBar>
                    <WeekLabel style={{
                      fontWeight: isCurrentWeek ? 600 : 500,
                      color: isCurrentWeek ? '#3b82f6' : '#64748b'
                    }}>
                      {weekData.weekNum}주
                    </WeekLabel>
                  </WeekColumn>
                );
              })}
            </StackedChart>
          </ChartContainer>

          <XAxis style={{ justifyContent: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              {visibleWeeks.length > 0 && (
                <>
                  {formatShortDate(visibleWeeks[0].startDate)} ~ {formatShortDate(visibleWeeks[visibleWeeks.length - 1].endDate)}
                </>
              )}
            </span>
          </XAxis>
        </ChartOnlySection>

        <DetailOnlySection>
          <DetailPanel>
            <DetailTitle>주차별 상세</DetailTitle>
            <EmptyState>
              <div className="icon">📅</div>
              <div className="title">주차를 선택해보세요</div>
              <div className="message">
                차트에서 주차 막대를 클릭하면<br />
                해당 주차의 계획/완료 아이템이 표시됩니다.
              </div>
            </EmptyState>
          </DetailPanel>
        </DetailOnlySection>
      </ContentSection>
      )}

      {/* Weekly Detail Modal */}
      <AnimatePresence>
        {selectedWeekModal && (
          <ModalOverlay
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedWeekModal(null)}
          >
            <ModalContent
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <ModalHeader>
                <ModalTitle>
                  <span>📅</span>
                  {selectedWeekModal.weekNum}주차 상세 현황
                  <span style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 400 }}>
                    ({formatShortDate(selectedWeekModal.startDate)} ~ {formatShortDate(selectedWeekModal.endDate)})
                  </span>
                </ModalTitle>
                <CloseButton onClick={() => setSelectedWeekModal(null)}>&times;</CloseButton>
              </ModalHeader>

              <ModalBody>
                {/* Planned Items Section */}
                <ItemSection>
                  <SectionHeader color="#3b82f6">
                    <SectionIcon>📋</SectionIcon>
                    <SectionTitle>계획 아이템 (미완료, 목표일 기준)</SectionTitle>
                    <SectionCount color="#3b82f6">{selectedWeekModal.plannedCount}</SectionCount>
                  </SectionHeader>
                  <ItemList>
                    {selectedWeekModal.plannedItems.length > 0 ? (
                      selectedWeekModal.plannedItems.map((item, idx) => (
                        <ItemCard
                          key={idx}
                          $bgColor="#eff6ff"
                          $borderColor="#bfdbfe"
                        >
                          <ItemProjectName>
                            <MetaBadge color={divisionColors[item.division] || '#64748b'} style={{ marginRight: '0.5rem' }}>
                              {item.division}
                            </MetaBadge>
                            {item.projectName}
                          </ItemProjectName>
                          <ItemActionName>{item.제목}</ItemActionName>
                          <ItemMeta>
                            <ItemDate>
                              <span>🎯</span>
                              목표일: {item.목표일}
                            </ItemDate>
                            {item.완료여부 && (
                              <MetaBadge color="#22c55e">완료</MetaBadge>
                            )}
                          </ItemMeta>
                        </ItemCard>
                      ))
                    ) : (
                      <EmptyItemState>
                        <span style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</span>
                        해당 주차에 계획된 아이템이 없습니다.
                      </EmptyItemState>
                    )}
                  </ItemList>
                </ItemSection>

                {/* Completed Items Section */}
                <ItemSection>
                  <SectionHeader color="#22c55e">
                    <SectionIcon>✅</SectionIcon>
                    <SectionTitle>완료된 아이템 (완료일 기준)</SectionTitle>
                    <SectionCount color="#22c55e">{selectedWeekModal.completedCount}</SectionCount>
                  </SectionHeader>
                  <ItemList>
                    {selectedWeekModal.completedItems.length > 0 ? (
                      selectedWeekModal.completedItems.map((item, idx) => (
                        <ItemCard
                          key={idx}
                          $bgColor="#f0fdf4"
                          $borderColor="#bbf7d0"
                        >
                          <ItemProjectName>
                            <MetaBadge color={divisionColors[item.division] || '#64748b'} style={{ marginRight: '0.5rem' }}>
                              {item.division}
                            </MetaBadge>
                            {item.projectName}
                          </ItemProjectName>
                          <ItemActionName>{item.제목}</ItemActionName>
                          <ItemMeta>
                            <ItemDate>
                              <span>✓</span>
                              완료일: {item.완료일}
                            </ItemDate>
                            {item.목표일 && (
                              <ItemDate style={{ color: '#94a3b8' }}>
                                (목표: {item.목표일})
                              </ItemDate>
                            )}
                          </ItemMeta>
                        </ItemCard>
                      ))
                    ) : (
                      <EmptyItemState>
                        <span style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</span>
                        해당 주차에 완료된 아이템이 없습니다.
                      </EmptyItemState>
                    )}
                  </ItemList>
                </ItemSection>

              </ModalBody>
            </ModalContent>
          </ModalOverlay>
        )}
      </AnimatePresence>
    </Container>
  );
};

export default ProgressTrendChart;
