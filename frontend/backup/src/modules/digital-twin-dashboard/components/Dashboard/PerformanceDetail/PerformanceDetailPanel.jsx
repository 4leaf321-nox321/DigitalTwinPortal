import React, { useMemo } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';

const Container = styled(motion.div)`
  background: white;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid #e2e8f0;
  min-height: 100%; /* height 대신 min-height 사용 */
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: visible; /* overflow: hidden 제거 */
`;

const Title = styled.h3`
  margin: 0 0 1rem 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
  
  &::before {
    content: '📝';
    font-size: 1.25rem;
  }
`;

const SelectedInfo = styled.div`
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
`;

const CategoryInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const CategoryBadge = styled.div`
  background: ${props => props.color};
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 600;
`;

const CategoryName = styled.div`
  font-weight: 600;
  color: #1e293b;
  font-size: 0.9rem;
`;

const SubcategoryName = styled.div`
  color: #64748b;
  font-size: 0.8rem;
`;

const CountBadge = styled.div`
  background: #3b82f6;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
`;

const PerformanceList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  /* 스크롤 제거 - 자연스럽게 아래로 확장 */
  width: 100%;
`;

const PerformanceGroup = styled(motion.div)`
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  padding: 1.25rem;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: #3b82f6;
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
  }
`;

const PerformanceHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
  gap: 1rem;
`;

const PerformanceTitle = styled.div`
  font-weight: 700;
  color: #1e293b;
  font-size: 1rem;
  line-height: 1.3;
  flex: 1;
`;

const PerformanceMetrics = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding: 1rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
`;

const MetricItem = styled.div`
  text-align: center;
  padding: 0.5rem;
`;

const MetricLabel = styled.div`
  font-size: 0.7rem;
  color: #64748b;
  font-weight: 600;
  margin-bottom: 0.25rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const MetricValue = styled.div`
  font-size: 0.9rem;
  font-weight: 700;
  color: #1e293b;
`;

const ProjectsSection = styled.div`
  margin-top: 0.5rem;
`;

const ProjectsSectionTitle = styled.div`
  font-weight: 600;
  color: #475569;
  font-size: 0.85rem;
  margin-bottom: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  &::before {
    content: '📊';
    font-size: 0.9rem;
  }
`;

const ProjectList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const ProjectItem = styled.div`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  padding: 0.75rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: #60a5fa;
    background: #f0f9ff;
  }
`;



const ProjectName = styled.div`
  font-weight: 600;
  color: #1e293b;
  font-size: 0.85rem;
  flex: 1; /* 프로젝트명이 가능한 공간을 차지 */
`;

const ProjectMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: 1rem; /* 프로젝트명과 간격 */
`;

const ProjectBadge = styled.div`
  background: ${props => props.color || '#64748b'};
  color: white;
  padding: 0.2rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.65rem;
  font-weight: 500;
`;

const StatusBadge = styled.div`
  background: ${props => props.color || '#64748b'};
  color: white;
  padding: 0.2rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.65rem;
  font-weight: 500;
`;

const ContributionInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: 0.75rem; /* 메타 정보와 간격 */
`;

const ContributionBadge = styled.div`
  background: ${props => {
    if (props.level === 'high') return '#3b82f6';    // 파란색 (높음)
    if (props.level === 'medium') return '#f59e0b';  // 주황색 (중간)
    if (props.level === 'low') return '#dc2626';     // 빨간색 (낮음)
    return '#6b7280';                                // 회색 (미설정)
  }};
  color: white;
  padding: 0.25rem 0.6rem;
  border-radius: 0.375rem;
  font-size: 0.7rem;
  font-weight: 600;
  white-space: nowrap; /* 텍스트 줄바꿈 방지 */
`;



const EmptyState = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #64748b;
  text-align: center;
  
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

const PerformanceDetailPanel = ({ 
  selectedPerformance, 
  divisionColors, 
  statusColors,
  onClearSelection 
}) => {
  // 성과 기여도에 따른 레벨 계산
  const getContributionLevel = (contribution) => {
    if (!contribution) return 'none'; // 미설정은 별도 레벨로 구분
    const value = parseFloat(contribution.toString().replace('%', '').replace('높음', '80').replace('중간', '50').replace('낮음', '20'));
    if (value >= 70) return 'high';
    if (value >= 40) return 'medium';
    return 'low';
  };

  const getContributionText = (contribution) => {
    if (!contribution) return '기여도: 미설정';
    return `기여도: ${contribution}`;
  };

  // 성과별로 그룹화 (성과항목을 기준으로)
  const groupedByPerformance = useMemo(() => {
    if (!selectedPerformance?.performances) return [];
    
    const performanceGroups = {};
    
    selectedPerformance.performances.forEach(perf => {
      const performanceKey = perf.performanceItem || '성과 항목 미설정';
      
      if (!performanceGroups[performanceKey]) {
        performanceGroups[performanceKey] = {
          performanceItem: performanceKey,
          current: perf.current,
          target: perf.target,
          actual: perf.actual,
          unit: perf.unit,
          projects: []
        };
      }
      
      // 프로젝트 정보 추가
      performanceGroups[performanceKey].projects.push({
        projectId: perf.projectId,
        projectName: perf.projectName,
        division: perf.division,
        status: perf.status,
        contribution: perf.contribution
      });
    });
    
    // 성과항목별로 정렬하고 프로젝트는 기여도순으로 정렬
    return Object.values(performanceGroups)
      .sort((a, b) => a.performanceItem.localeCompare(b.performanceItem))
      .map(group => ({
        ...group,
        projects: group.projects.sort((a, b) => {
          const aContrib = parseFloat((a.contribution || '0').toString().replace('%', '').replace('높음', '80').replace('중간', '50').replace('낮음', '20'));
          const bContrib = parseFloat((b.contribution || '0').toString().replace('%', '').replace('높음', '80').replace('중간', '50').replace('낮음', '20'));
          return bContrib - aContrib; // 기여도 높은 순으로 정렬
        })
      }));
  }, [selectedPerformance]);

  if (!selectedPerformance) {
    return (
      <Container
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Title>성과 항목 상세</Title>
        <EmptyState>
          <div className="icon">🎯</div>
          <div className="title">성과 분류를 선택해보세요</div>
          <div className="message">
            트리맵에서 성과 분류를 클릭하면<br />
            관련된 성과 항목들이 여기에 표시됩니다.
          </div>
        </EmptyState>
      </Container>
    );
  }

  return (
    <Container
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Title>성과 항목 상세</Title>
      
      <SelectedInfo>
        <CategoryInfo>
          <CategoryBadge color={selectedPerformance.categoryColor}>
            {selectedPerformance.category}
          </CategoryBadge>
          <div>
            <CategoryName>{selectedPerformance.name}</CategoryName>
            <SubcategoryName>소분류</SubcategoryName>
          </div>
        </CategoryInfo>
        <CountBadge>{groupedByPerformance.length}개 성과</CountBadge>
      </SelectedInfo>
      
      <PerformanceList>
        <AnimatePresence>
          {groupedByPerformance.map((performanceGroup, index) => (
            <PerformanceGroup
              key={performanceGroup.performanceItem}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              whileHover={{ scale: 1.005 }}
            >
              <PerformanceHeader>
                <PerformanceTitle>
                  {performanceGroup.performanceItem}
                </PerformanceTitle>
              </PerformanceHeader>
              
              <PerformanceMetrics>
                <MetricItem>
                  <MetricLabel>현재 수준</MetricLabel>
                  <MetricValue>
                    {performanceGroup.current || '-'} {performanceGroup.unit || ''}
                  </MetricValue>
                </MetricItem>
                <MetricItem>
                  <MetricLabel>목표 수준</MetricLabel>
                  <MetricValue>
                    {performanceGroup.target || '-'} {performanceGroup.unit || ''}
                  </MetricValue>
                </MetricItem>
                <MetricItem>
                  <MetricLabel>실적 수준</MetricLabel>
                  <MetricValue>
                    {performanceGroup.actual || '-'} {performanceGroup.unit || ''}
                  </MetricValue>
                </MetricItem>
              </PerformanceMetrics>
              
              <ProjectsSection>
                <ProjectsSectionTitle>
                  관련 과제 ({performanceGroup.projects.length}개)
                </ProjectsSectionTitle>
                
                <ProjectList>
                  {performanceGroup.projects.map((project, projIndex) => (
                    <ProjectItem key={`${project.projectId}-${projIndex}`}>
                      <ProjectName>{project.projectName}</ProjectName>
                      
                      <ProjectMeta>
                        <ProjectBadge color={divisionColors[project.division] || '#64748b'}>
                          {project.division}
                        </ProjectBadge>
                        <StatusBadge color={statusColors[project.status] || '#64748b'}>
                          {project.status}
                        </StatusBadge>
                      </ProjectMeta>
                      
                      <ContributionInfo>
                        <ContributionBadge level={getContributionLevel(project.contribution)}>
                          {getContributionText(project.contribution)}
                        </ContributionBadge>
                      </ContributionInfo>
                    </ProjectItem>
                  ))}
                </ProjectList>
              </ProjectsSection>
            </PerformanceGroup>
          ))}
        </AnimatePresence>
      </PerformanceList>
    </Container>
  );
};

export default PerformanceDetailPanel;