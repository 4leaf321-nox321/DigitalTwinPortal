import React, { useMemo } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { getDivisionOrderIndex } from '../../utils/divisionSorting';

const Container = styled(motion.div)`
  background: white;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid #e2e8f0;
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
    content: '✅';
    font-size: 1.25rem;
  }
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
`;

const StatCard = styled(motion.div)`
  background: ${props => props.bgColor || '#f8fafc'};
  border: 2px solid ${props => props.borderColor || '#e2e8f0'};
  border-radius: 0.75rem;
  padding: 1rem;
  text-align: center;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
  }
`;

const StatValue = styled.div`
  font-size: 1.75rem;
  font-weight: 700;
  color: ${props => props.color || '#1e293b'};
  line-height: 1;
  margin-bottom: 0.25rem;
`;

const StatLabel = styled.div`
  font-size: 0.75rem;
  color: #64748b;
  font-weight: 500;
  line-height: 1.3;
`;

const ProgressContainer = styled.div`
  margin-bottom: 1.5rem;
`;

const ProgressLabel = styled.div`
  display: flex;
  justify-content: between;
  align-items: center;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 0.75rem;
  background: #e2e8f0;
  border-radius: 0.375rem;
  overflow: hidden;
  position: relative;
`;

const ProgressFill = styled(motion.div)`
  height: 100%;
  background: linear-gradient(90deg, ${props => props.color}dd, ${props => props.color});
  border-radius: 0.375rem;
  width: ${props => props.percentage}%;
  transition: width 0.8s ease-out;
`;

const ProjectsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-height: 200px;
  overflow-y: auto;
`;

const ProjectItem = styled(motion.div)`
  display: flex;
  justify-content: between;
  align-items: center;
  padding: 0.75rem;
  background: #f8fafc;
  border-radius: 0.5rem;
  border: 1px solid #e2e8f0;
  transition: all 0.2s ease;
  
  &:hover {
    background: #f1f5f9;
    border-color: #cbd5e1;
  }
`;

const ProjectInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const ProjectName = styled.div`
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.25rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ProjectStats = styled.div`
  font-size: 0.75rem;
  color: #64748b;
`;

const ProjectBadge = styled.div`
  background: ${props => props.bgColor || '#f1f5f9'};
  color: ${props => props.color || '#64748b'};
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
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

const ActionItemsStatus = ({ projects, statusColors }) => {
  // 액션 아이템 분석
  const actionItemsData = useMemo(() => {
    if (!projects || projects.length === 0) {
      return {
        totalItems: 0,
        completedItems: 0,
        completionRate: 0,
        projectsWithItems: []
      };
    }

    let totalItems = 0;
    let completedItems = 0;
    const projectsWithItems = [];

    projects.forEach(project => {
      const items = project.액션아이템목록 || [];
      if (items.length > 0) {
        const completed = items.filter(item => item.완료여부).length;
        const total = items.length;
        const rate = total > 0 ? (completed / total * 100) : 0;
        
        projectsWithItems.push({
          id: project.id,
          name: project.과제명,
          division: project.사업부,
          status: project.진행상태,
          totalItems: total,
          completedItems: completed,
          completionRate: rate
        });
        
        totalItems += total;
        completedItems += completed;
      }
    });

    const completionRate = totalItems > 0 ? (completedItems / totalItems * 100) : 0;

    return {
      totalItems,
      completedItems,
      completionRate,
      projectsWithItems: projectsWithItems.sort((a, b) => {
        // 1순위: 사업부 순서
        const aDivisionIndex = getDivisionOrderIndex(a.division);
        const bDivisionIndex = getDivisionOrderIndex(b.division);
        if (aDivisionIndex !== bDivisionIndex) {
          return aDivisionIndex - bDivisionIndex;
        }
        // 2순위: 총 아이템 수 (많은 순)
        return b.totalItems - a.totalItems;
      })
    };
  }, [projects]);

  // 데이터가 없는 경우
  if (!projects || projects.length === 0 || actionItemsData.totalItems === 0) {
    return (
      <Container
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Title>액션 아이템 현황</Title>
        <EmptyState>
          <div className="icon">✅</div>
          <div className="message">
            등록된 액션 아이템이 없습니다.<br />
            프로젝트에 액션 아이템을 추가해보세요.
          </div>
        </EmptyState>
      </Container>
    );
  }

  const stats = [
    {
      value: actionItemsData.totalItems,
      label: '총 액션 아이템',
      bgColor: '#eff6ff',
      borderColor: '#bfdbfe',
      valueColor: '#1e40af'
    },
    {
      value: actionItemsData.completedItems,
      label: '완료된 아이템',
      bgColor: '#f0fdf4',
      borderColor: '#bbf7d0',
      valueColor: '#15803d'
    },
    {
      value: `${actionItemsData.completionRate.toFixed(1)}%`,
      label: '완료율',
      bgColor: '#fefce8',
      borderColor: '#fde047',
      valueColor: '#ca8a04'
    },
    {
      value: actionItemsData.projectsWithItems.length,
      label: '관련 과제',
      bgColor: '#fdf4ff',
      borderColor: '#e9d5ff',
      valueColor: '#7c3aed'
    }
  ];

  return (
    <Container
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Title>액션 아이템 현황</Title>
      
      <StatsGrid>
        {stats.map((stat, index) => (
          <StatCard
            key={index}
            bgColor={stat.bgColor}
            borderColor={stat.borderColor}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
          >
            <StatValue color={stat.valueColor}>
              {stat.value}
            </StatValue>
            <StatLabel>{stat.label}</StatLabel>
          </StatCard>
        ))}
      </StatsGrid>
      
      <ProgressContainer>
        <ProgressLabel>
          <span>전체 완료율</span>
          <span>{actionItemsData.completionRate.toFixed(1)}%</span>
        </ProgressLabel>
        <ProgressBar>
          <ProgressFill 
            color={statusColors['완료'] || '#15803d'}
            percentage={actionItemsData.completionRate}
          />
        </ProgressBar>
      </ProgressContainer>
      
      {actionItemsData.projectsWithItems.length > 0 && (
        <ProjectsList>
          {actionItemsData.projectsWithItems.slice(0, 4).map((project, index) => {
            // 완료율에 따른 배지 색상 결정
            let badgeColor = '#64748b';
            let badgeBg = '#f1f5f9';
            if (project.completionRate === 100) {
              badgeColor = '#15803d';
              badgeBg = '#f0fdf4';
            } else if (project.completionRate >= 70) {
              badgeColor = '#ca8a04';
              badgeBg = '#fefce8';
            } else if (project.completionRate < 50) {
              badgeColor = '#dc2626';
              badgeBg = '#fef2f2';
            }

            return (
              <ProjectItem
                key={project.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <ProjectInfo>
                  <ProjectName title={project.name}>
                    {project.name}
                  </ProjectName>
                  <ProjectStats>
                    {project.division} • {project.completedItems}/{project.totalItems} 완료
                  </ProjectStats>
                </ProjectInfo>
                <ProjectBadge 
                  color={badgeColor} 
                  bgColor={badgeBg}
                >
                  {project.completionRate.toFixed(0)}%
                </ProjectBadge>
              </ProjectItem>
            );
          })}
        </ProjectsList>
      )}
    </Container>
  );
};

export default ActionItemsStatus;