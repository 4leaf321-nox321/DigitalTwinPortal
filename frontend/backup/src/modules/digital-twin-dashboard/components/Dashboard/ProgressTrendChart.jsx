import React, { useState } from 'react';
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
  height: fit-content;
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
  align-items: start;
`;



const ChartOnlySection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;



const DetailOnlySection = styled.div`
  display: flex;
  flex-direction: column;
  min-height: fit-content;
`;



const ChartContainer = styled.div`
  width: 100%;
  height: 380px;
  position: relative;
  margin-bottom: 1rem;
  flex: 1;
`;

const StackedChart = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: end;
  justify-content: space-between;
  padding: 1rem 0;
  gap: 0.5rem;
`;

const MonthColumn = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
`;

const StackedBar = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: ${props => props.height}px;
  position: relative;
`;

const DivisionSegment = styled(motion.div)`
  width: 100%;
  background: ${props => props.color};
  height: ${props => props.segmentHeight}px;
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
  min-height: fit-content;
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

const ProgressTrendChart = ({ projects, divisionColors }) => {
  const [selectedSegment, setSelectedSegment] = useState(null);

  // 데이터가 없는 경우
  if (!projects || projects.length === 0) {
    return (
      <Container
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Title>월별 진행 과제 현황</Title>
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

  // Y축 눈금 생성 (5단계) - 데이터에 따른 동적 스케일
  const yAxisLabels = [];
  for (let i = 0; i <= 4; i++) {
    yAxisLabels.push(Math.ceil((maxCount * i) / 4));
  }

  const maxBarHeight = 300; // 최대 막대 높이

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
      <Title>월별 진행 과제 현황</Title>
      
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
                const barHeight = maxCount > 0 ? (monthData.totalCount / maxCount) * maxBarHeight : 0;
                
                // 각 사업부 세그먼트 높이 계산
                const segments = divisions.map(division => ({
                  division,
                  count: monthData.divisionCounts[division] || 0,
                  color: divisionColors[division] || '#94a3b8'
                })).filter(s => s.count > 0);
                
                // 세그먼트 높이 계산
                let accumulatedHeight = 0;
                const segmentsWithHeight = segments.map((segment, segIndex) => {
                  const segmentHeight = barHeight > 0 ? (segment.count / monthData.totalCount) * barHeight : 0;
                  const result = {
                    ...segment,
                    segmentHeight,
                    yPosition: accumulatedHeight,
                    isFirst: segIndex === segments.length - 1,
                    isLast: segIndex === 0
                  };
                  accumulatedHeight += segmentHeight;
                  return result;
                }).reverse(); // 스택 순서를 위해 뒤집기
                
                return (
                  <MonthColumn key={monthIndex}>
                    <StackedBar height={barHeight}>
                      {segmentsWithHeight.map((segment, segIndex) => {
                        const isSegmentSelected = selectedSegment && 
                          selectedSegment.month === monthData.month && 
                          selectedSegment.division === segment.division &&
                          !selectedSegment.isMonthTotal;
                        
                        return (
                          <DivisionSegment
                            key={segment.division}
                            color={segment.color}
                            segmentHeight={segment.segmentHeight}
                            isFirst={segment.isFirst}
                            isLast={segment.isLast}
                            isSelected={isSegmentSelected}
                            initial={{ height: 0 }}
                            animate={{ height: segment.segmentHeight }}
                            transition={{ duration: 0.8, delay: monthIndex * 0.1 + segIndex * 0.05 }}
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
    </Container>
  );
};

export default ProgressTrendChart;
