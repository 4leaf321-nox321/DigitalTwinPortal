import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
// 수준값의 0 과 미입력은 다른 뜻이다. `값 &&` 로 다루면 0 이 숨는다.
import { hasLevel } from '../../../utils/levelValue';

const Container = styled(motion.div)`
  background: white;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid #e2e8f0;
  /* 화면 높이에서 헤더와 여백을 뺀 높이로 고정 */
  height: calc(100vh - 64px - 200px);
  max-height: calc(100vh - 64px - 200px);
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
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
  width: 100%;
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

const PerformanceGroup = styled(motion.div)`
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  padding: 1.25rem;
  transition: all 0.2s ease;
  position: relative;

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
  position: relative;
`;

const PerformanceTitle = styled.div`
  font-weight: 700;
  color: #1e293b;
  font-size: 1rem;
  line-height: 1.3;
  flex: 1;
`;

const DetailButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid #3b82f6;
  background: white;
  color: #3b82f6;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
  font-size: 14px;
  font-weight: 700;

  &:hover {
    background: #3b82f6;
    color: white;
    transform: scale(1.1);
  }

  &:active {
    transform: scale(0.95);
  }
`;

const PerformanceMetrics = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding: 1rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  flex-wrap: wrap;
`;

const MetricCard = styled.div`
  background: ${props => props.$bgColor || '#f8fafc'};
  border: 2px solid ${props => props.$borderColor || '#e2e8f0'};
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  min-width: 100px;
  text-align: center;
  position: relative;
`;

const MetricCardLabel = styled.div`
  font-size: 0.7rem;
  color: #64748b;
  font-weight: 600;
  margin-bottom: 0.25rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const MetricCardValue = styled.div`
  font-size: 1.25rem;
  font-weight: 700;
  color: ${props => props.$color || '#1e293b'};
  line-height: 1.2;
`;

const MetricCardUnit = styled.div`
  font-size: 0.7rem;
  color: #64748b;
  margin-top: 0.125rem;
`;

const MetricCardRate = styled.div`
  font-size: 0.7rem;
  font-weight: 600;
  color: ${props => props.$color || '#64748b'};
  margin-top: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
`;

const MetricArrow = styled.span`
  font-size: 1.25rem;
  color: #94a3b8;
  display: flex;
  align-items: center;
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
  position: relative;

  &:hover {
    border-color: #60a5fa;
    background: #f0f9ff;
  }

  &:hover .project-detail-button {
    opacity: 1;
    pointer-events: auto;
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

// 모달 스타일
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
  z-index: 10000;
  padding: 2rem;
`;

const ModalContent = styled(motion.div)`
  background: white;
  border-radius: 1rem;
  padding: 2rem;
  max-width: none;
  width: 70%;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #e2e8f0;
`;

const ModalTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
`;

const CloseButton = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: #f1f5f9;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  font-size: 1.25rem;

  &:hover {
    background: #e2e8f0;
    color: #1e293b;
  }
`;

const ModalBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const DetailSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const DetailLabel = styled.div`
  font-size: 0.875rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const DetailValue = styled.div`
  font-size: 1rem;
  font-weight: 500;
  color: #1e293b;
  line-height: 1.6;
`;

const DetailGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr 2fr 1fr 1fr 1fr;
  gap: 1rem;
`;

const PersonnelGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 4fr 4fr;
  gap: 1rem;
`;

const DetailCard = styled.div`
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  padding: 1rem;
`;

const ProjectDetailButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid #60a5fa;
  background: white;
  color: #60a5fa;
  cursor: pointer;
  transition: all 0.2s ease;
  opacity: 0;
  pointer-events: none;
  flex-shrink: 0;
  margin-left: 0.5rem;
  font-size: 12px;
  font-weight: 700;

  &:hover {
    background: #60a5fa;
    color: white;
    transform: scale(1.1);
  }

  &:active {
    transform: scale(0.95);
  }
`;

const PerformanceDetailPanel = ({
  selectedPerformance,
  divisionColors,
  statusColors,
  onClearSelection,
  globalPerformances = [],
  projects = []
}) => {
  // 모달 상태 관리
  const [performanceModalData, setPerformanceModalData] = useState(null);
  const [projectModalData, setProjectModalData] = useState(null);

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

  // 감소 목표인지 판단 (비용, 시간 관련은 줄이는 것이 목표)
  const isReductionGoal = (category, unit) => {
    const reductionCategories = ['비용절감', '리드타임단축'];
    const reductionUnits = ['억원', 'hours', 'ppm', '시간'];

    return reductionCategories.includes(category) || reductionUnits.includes(unit);
  };

  // 목표율 계산 (현재 대비 목표가 얼마나 변화해야 하는지)
  const calculateTargetRate = (current, target, category, unit) => {
    const currentVal = parseFloat(current);
    const targetVal = parseFloat(target);

    if (isNaN(currentVal) || isNaN(targetVal) || currentVal === 0) return null;

    const isReduction = isReductionGoal(category, unit);

    if (isReduction) {
      // 감소 목표: (현재 - 목표) / 현재 * 100
      const rate = ((currentVal - targetVal) / currentVal * 100).toFixed(0);
      return { rate: Math.abs(rate), direction: 'down', isPositive: targetVal < currentVal };
    } else {
      // 증가 목표: (목표 - 현재) / 현재 * 100
      const rate = ((targetVal - currentVal) / currentVal * 100).toFixed(0);
      return { rate: Math.abs(rate), direction: 'up', isPositive: targetVal > currentVal };
    }
  };

  // 달성률 계산 (현재 수준 대비 실적 변화율)
  const calculateAchievementRate = (current, target, actual, category, unit) => {
    const currentVal = parseFloat(current);
    const targetVal = parseFloat(target);
    const actualVal = parseFloat(actual);

    if (isNaN(currentVal) || isNaN(targetVal) || isNaN(actualVal) || currentVal === 0) return null;

    const isReduction = isReductionGoal(category, unit);

    let rate;
    let isAchieved;

    if (isReduction) {
      // 감소 목표: (현재 - 실적) / 현재 * 100
      rate = ((currentVal - actualVal) / currentVal * 100).toFixed(1);
      isAchieved = actualVal <= targetVal;
    } else {
      // 증가 목표: (실적 - 현재) / 현재 * 100
      rate = ((actualVal - currentVal) / currentVal * 100).toFixed(1);
      isAchieved = actualVal >= targetVal;
    }

    return {
      rate: parseFloat(rate),
      isAchieved,
      direction: isReduction ? 'down' : 'up'
    };
  };

  // 성과 상세 정보 가져오기
  const getPerformanceDetail = (performanceItem) => {
    // globalPerformances에서 해당 성과 찾기
    return globalPerformances.find(p => p.성과항목 === performanceItem);
  };

  // 과제 상세 정보 가져오기
  const getProjectDetail = (projectId) => {
    return projects.find(p => p.id === projectId);
  };

  // 성과 상세 보기 버튼 클릭
  const handlePerformanceDetailClick = (performanceGroup) => {
    const detail = getPerformanceDetail(performanceGroup.performanceItem);
    setPerformanceModalData({
      ...performanceGroup,
      detail
    });
  };

  // 과제 상세 보기 버튼 클릭
  const handleProjectDetailClick = (project) => {
    const detail = getProjectDetail(project.projectId);
    setProjectModalData({
      ...project,
      detail
    });
  };

  // 모달 닫기
  const closeModals = () => {
    setPerformanceModalData(null);
    setProjectModalData(null);
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
          isMonthly: perf.isMonthly || false,
          monthlyActuals: perf.monthlyActuals || Array(12).fill(''),
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
                <DetailButton
                  className="detail-button"
                  onClick={() => handlePerformanceDetailClick(performanceGroup)}
                  title="성과 상세 정보 보기"
                >
                  ⓘ
                </DetailButton>
              </PerformanceHeader>
              
              <PerformanceMetrics>
                {(() => {
                  const targetRate = calculateTargetRate(
                    performanceGroup.current,
                    performanceGroup.target,
                    selectedPerformance.category,
                    performanceGroup.unit
                  );
                  const achievementRate = calculateAchievementRate(
                    performanceGroup.current,
                    performanceGroup.target,
                    performanceGroup.actual,
                    selectedPerformance.category,
                    performanceGroup.unit
                  );

                  return (
                    <>
                      {/* 현재 수준 카드 */}
                      <MetricCard $bgColor="#f8fafc" $borderColor="#e2e8f0">
                        <MetricCardLabel>현재 수준</MetricCardLabel>
                        <MetricCardValue>
                          {performanceGroup.current || '-'} <MetricCardUnit as="span">{performanceGroup.unit || ''}</MetricCardUnit>
                        </MetricCardValue>
                      </MetricCard>

                      <MetricArrow>→</MetricArrow>

                      {/* 목표 수준 카드 */}
                      <MetricCard $bgColor="#eff6ff" $borderColor="#3b82f6">
                        <MetricCardLabel>목표 수준</MetricCardLabel>
                        <MetricCardValue $color="#3b82f6">
                          {performanceGroup.target || '-'} <MetricCardUnit as="span">{performanceGroup.unit || ''}</MetricCardUnit>
                        </MetricCardValue>
                        {targetRate && (
                          <MetricCardRate $color="#3b82f6">
                            {targetRate.direction === 'down' ? '▼' : '▲'}
                            {targetRate.rate}% 목표
                          </MetricCardRate>
                        )}
                      </MetricCard>

                      <MetricArrow>→</MetricArrow>

                      {/* 실적 수준 카드 */}
                      <MetricCard
                        $bgColor={achievementRate?.isAchieved ? '#f0fdf4' : performanceGroup.actual ? '#fef2f2' : '#f8fafc'}
                        $borderColor={achievementRate?.isAchieved ? '#10b981' : performanceGroup.actual ? '#ef4444' : '#e2e8f0'}
                      >
                        <MetricCardLabel>실적 수준</MetricCardLabel>
                        <MetricCardValue $color={achievementRate?.isAchieved ? '#10b981' : performanceGroup.actual ? '#ef4444' : '#1e293b'}>
                          {performanceGroup.actual || '-'} <MetricCardUnit as="span">{performanceGroup.unit || ''}</MetricCardUnit>
                        </MetricCardValue>
                        {achievementRate && (
                          <MetricCardRate $color={achievementRate.isAchieved ? '#10b981' : '#ef4444'}>
                            {achievementRate.direction === 'down' ? '▼' : '▲'}
                            {achievementRate.rate}% 달성
                          </MetricCardRate>
                        )}
                      </MetricCard>
                    </>
                  );
                })()}
              </PerformanceMetrics>

              {/* 월별 실적 (있는 경우) */}
              {performanceGroup.isMonthly && performanceGroup.monthlyActuals && (
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.5rem',
                  padding: '0.75rem',
                  marginBottom: '1rem'
                }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', marginBottom: '0.5rem' }}>
                    월별 실적
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.5rem' }}>
                    {performanceGroup.monthlyActuals.map((value, idx) => (
                      <div key={idx} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginBottom: '0.125rem' }}>{idx + 1}월</div>
                        <div style={{
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          color: value ? '#1e293b' : '#cbd5e1'
                        }}>
                          {value || '-'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
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

                      <ProjectDetailButton
                        className="project-detail-button"
                        onClick={() => handleProjectDetailClick(project)}
                        title="과제 상세 정보 보기"
                      >
                        ⓘ
                      </ProjectDetailButton>
                    </ProjectItem>
                  ))}
                </ProjectList>
              </ProjectsSection>
            </PerformanceGroup>
          ))}
        </AnimatePresence>
      </PerformanceList>

      {/* 성과 상세 정보 모달 */}
      <AnimatePresence>
        {performanceModalData && (
          <ModalOverlay
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModals}
          >
            <ModalContent
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <ModalHeader>
                <ModalTitle>📊 성과 항목 상세 정보</ModalTitle>
                <CloseButton onClick={closeModals}>×</CloseButton>
              </ModalHeader>

              <ModalBody>
                <DetailSection>
                  <DetailLabel>성과 항목명</DetailLabel>
                  <DetailValue>{performanceModalData.performanceItem}</DetailValue>
                </DetailSection>

                {performanceModalData.detail && (
                  <>
                    <DetailSection>
                      <DetailLabel>분류</DetailLabel>
                      <DetailValue>
                        {performanceModalData.detail.대분류} &gt; {performanceModalData.detail.소분류}
                      </DetailValue>
                    </DetailSection>

                    <DetailSection>
                      <DetailLabel>측정 지표</DetailLabel>
                      <DetailGrid>
                        <DetailCard>
                          <DetailLabel>현재 수준</DetailLabel>
                          <DetailValue>
                            {performanceModalData.current || '-'} {performanceModalData.unit || ''}
                          </DetailValue>
                        </DetailCard>
                        <DetailCard>
                          <DetailLabel>목표 수준</DetailLabel>
                          <DetailValue>
                            {performanceModalData.target || '-'} {performanceModalData.unit || ''}
                          </DetailValue>
                        </DetailCard>
                        {performanceModalData.isMonthly ? (
                          <DetailCard style={{ gridColumn: '1 / -1' }}>
                            <DetailLabel>월별 실적</DetailLabel>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.5rem', marginTop: '0.5rem' }}>
                              {performanceModalData.monthlyActuals?.map((value, idx) => (
                                <div key={idx} style={{ textAlign: 'center', padding: '0.5rem', background: '#f8fafc', borderRadius: '0.375rem' }}>
                                  <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.25rem', fontWeight: 600 }}>{idx + 1}월</div>
                                  <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1e293b' }}>
                                    {value || '-'} {value ? performanceModalData.unit : ''}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </DetailCard>
                        ) : (
                          <DetailCard>
                            <DetailLabel>실적 수준</DetailLabel>
                            <DetailValue>
                              {performanceModalData.actual || '-'} {performanceModalData.unit || ''}
                            </DetailValue>
                          </DetailCard>
                        )}
                      </DetailGrid>
                    </DetailSection>

                    {performanceModalData.detail.설명 && (
                      <DetailSection>
                        <DetailLabel>설명</DetailLabel>
                        <DetailValue>{performanceModalData.detail.설명}</DetailValue>
                      </DetailSection>
                    )}

                    <DetailSection>
                      <DetailLabel>연결된 과제</DetailLabel>
                      <DetailValue>{performanceModalData.projects.length}개 과제</DetailValue>
                    </DetailSection>
                  </>
                )}
              </ModalBody>
            </ModalContent>
          </ModalOverlay>
        )}
      </AnimatePresence>

      {/* 과제 상세 정보 모달 */}
      <AnimatePresence>
        {projectModalData && projectModalData.detail && (
          <ModalOverlay
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModals}
          >
            <ModalContent
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <ModalHeader>
                <ModalTitle>📋 과제 상세 정보</ModalTitle>
                <CloseButton onClick={closeModals}>×</CloseButton>
              </ModalHeader>

              <ModalBody>
                <DetailSection>
                  <DetailLabel>과제명</DetailLabel>
                  <DetailValue>{projectModalData.projectName}</DetailValue>
                </DetailSection>

                <DetailSection>
                  <DetailLabel>기간</DetailLabel>
                  <DetailValue>
                    {projectModalData.detail.과제년도}년 {projectModalData.detail.시작}월 ~ {projectModalData.detail.종료}월
                  </DetailValue>
                </DetailSection>

                {projectModalData.detail.과제상세설명 && (
                  <DetailSection>
                    <DetailLabel>상세 설명</DetailLabel>
                    <DetailValue>{projectModalData.detail.과제상세설명}</DetailValue>
                  </DetailSection>
                )}

                <DetailGrid>
                  <DetailCard>
                    <DetailLabel>과제 ID</DetailLabel>
                    <DetailValue>{projectModalData.projectId}</DetailValue>
                  </DetailCard>
                  <DetailCard>
                    <DetailLabel>사업부</DetailLabel>
                    <DetailValue>{projectModalData.detail.사업부}</DetailValue>
                  </DetailCard>
                  <DetailCard>
                    <DetailLabel>진행 상태</DetailLabel>
                    <DetailValue>{projectModalData.detail.진행상태}</DetailValue>
                  </DetailCard>
                  <DetailCard>
                    <DetailLabel>프로세스</DetailLabel>
                    <DetailValue>{projectModalData.detail.프로세스}</DetailValue>
                  </DetailCard>
                  <DetailCard>
                    <DetailLabel>과제 구분</DetailLabel>
                    <DetailValue>{projectModalData.detail.과제구분}</DetailValue>
                  </DetailCard>
                  <DetailCard>
                    <DetailLabel>PoC 과제 여부</DetailLabel>
                    <DetailValue>{projectModalData.detail.PoC과제여부 ? '예' : '아니오'}</DetailValue>
                  </DetailCard>
                  <DetailCard>
                    <DetailLabel>중점 과제 여부</DetailLabel>
                    <DetailValue>{projectModalData.detail.중점과제여부 ? '예' : '아니오'}</DetailValue>
                  </DetailCard>
                  <DetailCard>
                    <DetailLabel>성과 기여도</DetailLabel>
                    <DetailValue>{projectModalData.contribution || '미설정'}</DetailValue>
                  </DetailCard>
                </DetailGrid>

                <PersonnelGrid>
                  <DetailCard>
                    <DetailLabel>과제 PL</DetailLabel>
                    <DetailValue>{projectModalData.detail.과제PL || '미배정'}</DetailValue>
                  </DetailCard>
                  <DetailCard>
                    <DetailLabel>작성자</DetailLabel>
                    <DetailValue>{projectModalData.detail.작성자 || '-'}</DetailValue>
                  </DetailCard>
                  <DetailCard>
                    <DetailLabel>담당 부서</DetailLabel>
                    <DetailValue>
                      {projectModalData.detail.담당부서목록 && projectModalData.detail.담당부서목록.length > 0
                        ? projectModalData.detail.담당부서목록.join(', ')
                        : '-'}
                    </DetailValue>
                  </DetailCard>
                  <DetailCard>
                    <DetailLabel>참여 인력</DetailLabel>
                    <DetailValue>
                      {projectModalData.detail.과제참여인력목록 && projectModalData.detail.과제참여인력목록.length > 0
                        ? projectModalData.detail.과제참여인력목록.map(m => m.이름).join(', ') + ` (${projectModalData.detail.과제참여인력목록.length}명)`
                        : '-'}
                    </DetailValue>
                  </DetailCard>
                </PersonnelGrid>

                {/* 성과 목록 섹션 */}
                {projectModalData.detail.성과목록 && projectModalData.detail.성과목록.length > 0 && (
                  <DetailSection>
                    <DetailLabel>연결된 성과 ({projectModalData.detail.성과목록.length}개)</DetailLabel>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                      {projectModalData.detail.성과목록.map((perfRef, idx) => {
                        const perfId = typeof perfRef === 'object' ? (perfRef.id || perfRef.성과항목ID) : perfRef;
                        const globalPerf = globalPerformances.find(gp => gp.id === perfId);
                        if (!globalPerf) return null;

                        const isMonthly = globalPerf.월별실적여부 || false;
                        const contribution = typeof perfRef === 'object' ? perfRef.과제기여도 : '100';

                        return (
                          <div key={idx} style={{
                            padding: '1rem',
                            background: '#f8fafc',
                            borderRadius: '0.5rem',
                            border: '1px solid #e2e8f0'
                          }}>
                            <div style={{ marginBottom: '0.75rem' }}>
                              <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '0.25rem' }}>
                                {globalPerf.성과항목}
                              </div>
                              <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                                {globalPerf.대분류} &gt; {globalPerf.소분류}
                              </div>
                            </div>

                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                              gap: '0.5rem',
                              fontSize: '0.875rem',
                              marginBottom: isMonthly ? '1rem' : '0'
                            }}>
                              <div>
                                <span style={{ color: '#64748b' }}>기여도: </span>
                                <span style={{ fontWeight: 600, color: '#1e293b' }}>{contribution}%</span>
                              </div>
                              <div>
                                <span style={{ color: '#64748b' }}>현재: </span>
                                <span style={{ fontWeight: 600, color: '#1e293b' }}>{globalPerf.현재수준} {globalPerf.단위}</span>
                              </div>
                              <div>
                                <span style={{ color: '#64748b' }}>목표: </span>
                                <span style={{ fontWeight: 600, color: '#1e293b' }}>{globalPerf.목표수준} {globalPerf.단위}</span>
                              </div>
                              {!isMonthly && hasLevel(globalPerf.실적수준) && (
                                <div>
                                  <span style={{ color: '#64748b' }}>실적: </span>
                                  <span style={{ fontWeight: 600, color: '#1e293b' }}>{globalPerf.실적수준} {globalPerf.단위}</span>
                                </div>
                              )}
                            </div>

                            {/* 월별 실적 그리드 */}
                            {isMonthly && (
                              <div>
                                <div style={{
                                  fontSize: '0.875rem',
                                  fontWeight: 600,
                                  color: '#1e40af',
                                  marginBottom: '0.75rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem'
                                }}>
                                  📅 월별 실적 현황
                                </div>
                                <div style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(4, 1fr)',
                                  gap: '0.5rem'
                                }}>
                                  {(globalPerf.월별실적 || Array(12).fill('')).map((value, monthIdx) => (
                                    <div
                                      key={monthIdx}
                                      style={{
                                        padding: '0.75rem',
                                        background: value ? '#e0f2fe' : 'white',
                                        borderRadius: '0.375rem',
                                        textAlign: 'center',
                                        border: value ? '1px solid #0ea5e9' : '1px solid #e2e8f0',
                                        transition: 'all 0.2s ease'
                                      }}
                                    >
                                      <div style={{
                                        fontSize: '0.7rem',
                                        color: '#64748b',
                                        marginBottom: '0.25rem',
                                        fontWeight: 600
                                      }}>
                                        {monthIdx + 1}월
                                      </div>
                                      <div style={{
                                        fontSize: '0.875rem',
                                        fontWeight: 700,
                                        color: value ? '#0369a1' : '#cbd5e1'
                                      }}>
                                        {value || '-'}
                                      </div>
                                      {value && (
                                        <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '0.125rem' }}>
                                          {globalPerf.단위}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </DetailSection>
                )}
              </ModalBody>
            </ModalContent>
          </ModalOverlay>
        )}
      </AnimatePresence>

    </Container>
  );
};

export default PerformanceDetailPanel;