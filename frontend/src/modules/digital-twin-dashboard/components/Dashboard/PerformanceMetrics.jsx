import React, { useMemo } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
// 수준값의 0 과 미입력은 다른 뜻이다.
import { hasLevel } from '../../utils/levelValue';

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
    content: '🎯';
    font-size: 1.25rem;
  }
`;

const MetricsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
`;

const MetricCard = styled(motion.div)`
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

const MetricValue = styled.div`
  font-size: 1.75rem;
  font-weight: 700;
  color: ${props => props.color || '#1e293b'};
  line-height: 1;
  margin-bottom: 0.25rem;
`;

const MetricLabel = styled.div`
  font-size: 0.75rem;
  color: #64748b;
  font-weight: 500;
  line-height: 1.3;
`;

const MetricSubtext = styled.div`
  font-size: 0.625rem;
  color: ${props => props.color || '#94a3b8'};
  margin-top: 0.25rem;
  font-weight: 500;
`;

const DetailsList = styled.div`
  margin-top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const DetailItem = styled.div`
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

const DetailLabel = styled.div`
  font-size: 0.875rem;
  color: #374151;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const DetailValue = styled.div`
  font-size: 0.875rem;
  font-weight: 600;
  color: ${props => props.color || '#1e293b'};
  background: white;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  border: 1px solid #e2e8f0;
`;

const DetailIcon = styled.div`
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: ${props => props.color};
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

const PerformanceMetrics = ({ projects, statusColors }) => {
  // 성과 지표 계산
  const metrics = useMemo(() => {
    if (!projects || projects.length === 0) {
      return {
        totalPerformances: 0,
        achievedPerformances: 0,
        achievementRate: 0,
        avgContribution: 0,
        performancesByCategory: {}
      };
    }

    let totalPerformances = 0;
    let achievedPerformances = 0;
    let totalContribution = 0;
    const performancesByCategory = {};

    projects.forEach(project => {
      const performances = project.성과목록 || [];
      totalPerformances += performances.length;

      performances.forEach(perf => {
        // 기여도 합계
        const contribution = parseFloat(perf.과제기여도) || 0;
        totalContribution += contribution;
        
        // 대분류별 성과 분류
        const category = perf.대분류 || '기타';
        if (!performancesByCategory[category]) {
          performancesByCategory[category] = 0;
        }
        performancesByCategory[category] += 1;
        
        // 실적수준이 있으면 달성된 것으로 간주
        if (hasLevel(perf.실적수준)) {
          achievedPerformances += 1;
        }
      });
    });

    const achievementRate = totalPerformances > 0 ? (achievedPerformances / totalPerformances * 100) : 0;
    const avgContribution = totalPerformances > 0 ? (totalContribution / totalPerformances) : 0;

    return {
      totalPerformances,
      achievedPerformances,
      achievementRate,
      avgContribution,
      performancesByCategory
    };
  }, [projects]);

  // 데이터가 없는 경우
  if (!projects || projects.length === 0) {
    return (
      <Container
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Title>성과 지표 현황</Title>
        <EmptyState>
          <div className="icon">🎯</div>
          <div className="message">
            분석할 성과 데이터가 없습니다.<br />
            프로젝트에 성과를 추가해보세요.
          </div>
        </EmptyState>
      </Container>
    );
  }

  const mainMetrics = [
    {
      value: metrics.totalPerformances,
      label: '총 성과 지표',
      subtext: '등록된 성과',
      bgColor: '#eff6ff',
      borderColor: '#bfdbfe',
      valueColor: '#1e40af'
    },
    {
      value: `${metrics.achievementRate.toFixed(1)}%`,
      label: '달성률',
      subtext: `${metrics.achievedPerformances}/${metrics.totalPerformances}`,
      bgColor: '#f0fdf4',
      borderColor: '#bbf7d0',
      valueColor: '#15803d'
    },
    {
      value: `${metrics.avgContribution.toFixed(1)}%`,
      label: '평균 기여도',
      subtext: '과제 기여도',
      bgColor: '#fefce8',
      borderColor: '#fde047',
      valueColor: '#ca8a04'
    },
    {
      value: Object.keys(metrics.performancesByCategory).length,
      label: '성과 영역',
      subtext: '대분류 수',
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
      <Title>성과 지표 현황</Title>
      
      <MetricsGrid>
        {mainMetrics.map((metric, index) => (
          <MetricCard
            key={index}
            bgColor={metric.bgColor}
            borderColor={metric.borderColor}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
          >
            <MetricValue color={metric.valueColor}>
              {metric.value}
            </MetricValue>
            <MetricLabel>{metric.label}</MetricLabel>
            <MetricSubtext color={metric.valueColor}>
              {metric.subtext}
            </MetricSubtext>
          </MetricCard>
        ))}
      </MetricsGrid>
      
      {/* 성과 분류별 상세 정보 */}
      {Object.keys(metrics.performancesByCategory).length > 0 && (
        <DetailsList>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <h4 style={{ 
              margin: '0 0 0.75rem 0', 
              fontSize: '0.875rem', 
              fontWeight: '600', 
              color: '#374151' 
            }}>
              성과 분류별 현황
            </h4>
            {Object.entries(metrics.performancesByCategory)
              .sort(([,a], [,b]) => b - a)
              .slice(0, 4) // 상위 4개만 표시
              .map(([category, count], index) => (
                <DetailItem key={category}>
                  <DetailLabel>
                    <DetailIcon color={statusColors['완료'] || '#3b82f6'} />
                    {category}
                  </DetailLabel>
                  <DetailValue color="#1e40af">
                    {count}개
                  </DetailValue>
                </DetailItem>
              ))}
          </motion.div>
        </DetailsList>
      )}
    </Container>
  );
};

export default PerformanceMetrics;