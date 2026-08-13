import React, { useMemo } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import ProjectSummary from './ProjectSummary';
import ProgressTrendChart from './ProgressTrendChart';
import PerformanceOverview from './PerformanceOverview';

const Container = styled.div`
  width: 100%;
  min-height: calc(100vh - 80px);
  padding: 2rem;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: 2rem;
`;

const TopSection = styled.div`
  width: 100%;
  margin-bottom: 2rem;
`;

const MiddleSection = styled.div`
  width: 100%;
  margin-bottom: 2rem;
`;

const BottomGrid = styled.div`
  display: flex;
  width: 100%;
  
  @media (max-width: 1200px) {
    flex-direction: column;
  }
`;

const EmptyPlaceholder = styled.div`
  background: white;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  font-size: 0.875rem;
  min-height: 300px;
`;

const DashboardView = ({ projects, statusColors, divisionColors }) => {
  return (
    <Container>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* 상단 섹션: 사업부별 과제 현황 */}
        <TopSection>
          <ProjectSummary
            projects={projects}
            divisionColors={divisionColors}
            statusColors={statusColors}
          />
        </TopSection>

        {/* 중간 섹션: 성과 분류 현황 (전체 폭) */}
        <MiddleSection>
          <PerformanceOverview
            projects={projects}
            divisionColors={divisionColors}
            statusColors={statusColors}
          />
        </MiddleSection>

        {/* 하단: 월별 진행 과제 현황 */}
        <BottomGrid>
          <ProgressTrendChart
            projects={projects}
            divisionColors={divisionColors}
          />
        </BottomGrid>
      </motion.div>
    </Container>
  );
};

export default DashboardView;