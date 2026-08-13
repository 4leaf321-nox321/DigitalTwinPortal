import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { sortDivisionEntries } from '../../utils/divisionOrder';
// 진행률의 0 과 미입력은 다른 뜻이다 (levelValue.js 참조).
import { percentText } from '../../utils/levelValue';

const Container = styled(motion.div)`
  background: white;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid #e2e8f0;
  /* 기본적으로 화면 높이만큼 차지하되, 내용이 많으면 늘어남 */
  min-height: calc(100vh - 64px - 60px - 4rem);
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
    content: '📋';
    font-size: 1.25rem;
  }
`;

const DivisionsWrapper = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 0;
`;

const DivisionsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 1rem;
  flex: 1;
  min-height: 0;

  @media (max-width: 1400px) {
    grid-template-columns: repeat(4, 1fr);
  }

  @media (max-width: 1100px) {
    grid-template-columns: repeat(3, 1fr);
  }

  @media (max-width: 800px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 500px) {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
`;

const DivisionCard = styled(motion.div)`
  background: ${props => props.bgColor};
  border: 2px solid ${props => props.borderColor};
  border-radius: 0.75rem;
  padding: 0.75rem;
  transition: all 0.3s ease;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
  }
`;

const DivisionHeader = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.3);
`;

const DivisionName = styled.h4`
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: ${props => props.color};
  text-align: center;
  
  @media (max-width: 1800px) {
    font-size: 1.5rem;
  }
  
  @media (max-width: 1200px) {
    font-size: 1.375rem;
  }
`;

const MetricsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
  margin-bottom: 0.875rem;
  min-width: 0;
`;

const MetricItem = styled.div`
  background: rgba(255, 255, 255, 0.9);
  border-radius: 0.5rem;
  padding: 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.8);
  text-align: center;
  min-width: 0;
  word-break: keep-all;
`;

const ClickableMetricItem = styled(MetricItem)`
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 1);
    transform: translateY(-1px);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.12);
  }
`;

const MetricValue = styled.div`
  font-size: 1.5rem;
  font-weight: 700;
  color: ${props => props.color};
  line-height: 1;
  margin-bottom: 0.25rem;

  @media (max-width: 1800px) {
    font-size: 1.625rem;
  }

  @media (max-width: 1200px) {
    font-size: 1.375rem;
  }
`;

const MetricLabel = styled.div`
  font-size: 0.8rem;
  color: #64748b;
  font-weight: 500;
  line-height: 1.2;

  @media (max-width: 1800px) {
    font-size: 0.875rem;
  }

  @media (max-width: 1200px) {
    font-size: 0.8rem;
  }
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 0.25rem;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 0.125rem;
  margin-top: 0.25rem;
  overflow: hidden;
`;

const ProgressFill = styled.div`
  height: 100%;
  background: ${props => props.color || '#3b82f6'};
  border-radius: 0.125rem;
  width: ${props => props.percentage}%;
  transition: width 0.8s ease-out;
`;

const StatusSection = styled.div`
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.3);
`;

const StatusSectionTitle = styled.div`
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
  margin-bottom: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const StatusGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(50px, 1fr));
  gap: 0.2rem;
  min-width: 0;

  @media (max-width: 1800px) {
    grid-template-columns: repeat(auto-fit, minmax(60px, 1fr));
    gap: 0.25rem;
  }

  @media (max-width: 1200px) {
    grid-template-columns: repeat(auto-fit, minmax(55px, 1fr));
  }
`;

const StatusItem = styled.div`
  background: rgba(255, 255, 255, 0.9);
  border-radius: 0.375rem;
  padding: 0.375rem;
  border: 1px solid rgba(255, 255, 255, 0.8);
  text-align: center;
  transition: all 0.2s ease;
  min-width: 0;
  word-break: keep-all;
  cursor: pointer;

  &:hover {
    background: rgba(255, 255, 255, 1);
    transform: translateY(-1px);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.12);
  }
`;

const StatusDot = styled.div`
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: ${props => props.color};
  margin: 0 auto 0.25rem;
`;

const StatusCount = styled.div`
  font-size: 1.25rem;
  font-weight: 700;
  color: ${props => props.color};
  line-height: 1;
  margin-bottom: 0.125rem;

  @media (max-width: 1800px) {
    font-size: 1.375rem;
  }

  @media (max-width: 1200px) {
    font-size: 1.25rem;
  }
`;

const StatusLabel = styled.div`
  font-size: 0.7rem;
  color: #64748b;
  font-weight: 500;
  line-height: 1;

  @media (max-width: 1800px) {
    font-size: 0.75rem;
  }

  @media (max-width: 1200px) {
    font-size: 0.7rem;
  }
`;

const TotalItem = styled.div`
  background: rgba(255, 255, 255, 0.95);
  border-radius: 0.375rem;
  padding: 0.375rem;
  border: 2px solid rgba(255, 255, 255, 0.9);
  text-align: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 1);
    transform: translateY(-1px);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
  }
`;

const TotalDot = styled.div`
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: #64748b;
  margin: 0 auto 0.25rem;
`;

const TotalCount = styled.div`
  font-size: 1.25rem;
  font-weight: 700;
  color: #1e293b;
  line-height: 1;
  margin-bottom: 0.125rem;

  @media (max-width: 1800px) {
    font-size: 1.375rem;
  }

  @media (max-width: 1200px) {
    font-size: 1.25rem;
  }
`;

const TotalLabel = styled.div`
  font-size: 0.7rem;
  color: #64748b;
  font-weight: 600;
  line-height: 1;

  @media (max-width: 1800px) {
    font-size: 0.75rem;
  }

  @media (max-width: 1200px) {
    font-size: 0.7rem;
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

const ModalOverlay = styled(motion.div)`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
`;

const ModalContainer = styled(motion.div)`
  background: white;
  border-radius: 0.75rem;
  width: 100%;
  max-width: 900px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 45px rgba(0, 0, 0, 0.2);
  overflow: hidden;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  background: ${props => props.$bgColor || '#f1f5f9'};
  border-bottom: 1px solid #e2e8f0;
`;

const ModalTitle = styled.h3`
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const ModalCloseButton = styled.button`
  background: transparent;
  border: none;
  color: #475569;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 0.375rem;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: rgba(15, 23, 42, 0.08);
    color: #0f172a;
  }
`;

const ModalBody = styled.div`
  padding: 1rem 1.25rem;
  overflow-y: auto;
  flex: 1;
`;

const FormulaBox = styled.div`
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-left: 4px solid ${props => props.$accent || '#6366f1'};
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`;

const FormulaTitle = styled.div`
  font-size: 0.8rem;
  font-weight: 700;
  color: #334155;
  letter-spacing: -0.01em;
`;

const FormulaText = styled.div`
  font-size: 0.85rem;
  color: #475569;
  font-family: 'Consolas', 'Monaco', monospace;
  background: white;
  padding: 0.4rem 0.6rem;
  border-radius: 0.375rem;
  border: 1px solid #e2e8f0;
`;

const FormulaResult = styled.div`
  font-size: 0.95rem;
  font-weight: 700;
  color: ${props => props.$accent || '#6366f1'};
  letter-spacing: -0.01em;
`;

const FormulaNote = styled.div`
  font-size: 0.75rem;
  color: #64748b;
  font-style: italic;
`;

const ModalFooter = styled.div`
  padding: 0.75rem 1.25rem;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
  font-size: 0.85rem;
  color: #64748b;
`;

const ProjectListItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  margin-bottom: 0.5rem;
  background: white;
  transition: all 0.15s ease;

  &:hover {
    border-color: #cbd5e1;
    background: #f8fafc;
  }
`;

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.15rem 0.5rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
  background: ${props => props.$bgColor || '#e2e8f0'};
  color: ${props => props.$textColor || '#334155'};
  white-space: nowrap;
  flex-shrink: 0;
`;

const ProjectNameText = styled.div`
  flex: 1;
  min-width: 0;
  font-size: 0.9rem;
  font-weight: 500;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ProgressInline = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
  min-width: 120px;
`;

const ProgressTrack = styled.div`
  flex: 1;
  height: 6px;
  background: #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
  min-width: 70px;
`;

const ProgressValue = styled.div`
  height: 100%;
  background: ${props => props.color || '#3b82f6'};
  width: ${props => props.percentage || 0}%;
  transition: width 0.3s ease;
`;

const ProgressPercent = styled.span`
  font-size: 0.8rem;
  font-weight: 600;
  color: ${props => props.color || '#3b82f6'};
  min-width: 40px;
  text-align: right;
`;

const EmptyListMessage = styled.div`
  text-align: center;
  padding: 2rem;
  color: #94a3b8;
  font-size: 0.9rem;
`;

const ProjectSummary = ({ projects, divisionColors, statusColors, settingsData = {} }) => {
  // 상태별 과제 리스트 모달 상태
  const [selectedFilter, setSelectedFilter] = useState(null);

  // 사업부별 데이터 분석
  const divisionData = useMemo(() => {
    if (!projects || projects.length === 0) {
      return {};
    }

    const data = {};
    
    projects.forEach(project => {
      const division = project.사업부 || 'Unknown';
      
      if (!data[division]) {
        data[division] = {
          totalProjects: 0,
          completedProjects: 0,
          onTimeProjects: 0,
          pocProjects: 0,
          keyProjects: 0,
          statusCounts: {}
        };
      }
      
      data[division].totalProjects += 1;
      
      // 상태별 카운트
      const status = project.진행상태 || '미착수';
      data[division].statusCounts[status] = (data[division].statusCounts[status] || 0) + 1;
      
      // 완료된 프로젝트
      if (status === '완료') {
        data[division].completedProjects += 1;
      }
      
      // 정상 진행 프로젝트 (완료 + 정상진행 + 계획)
      if (status === '완료' || status === '정상진행' || status === '계획') {
        data[division].onTimeProjects += 1;
      }
      
      // PoC 프로젝트
      if (project.PoC과제여부) {
        data[division].pocProjects += 1;
      }
      
      // 중점 프로젝트
      if (project.중점과제여부) {
        data[division].keyProjects += 1;
      }
    });
    
    // 비율 계산 (완료율, 정상 진행율 모두 모수에서 '취소' 제외)
    Object.keys(data).forEach(division => {
      const divData = data[division];
      const cancelledCount = divData.statusCounts['취소'] || 0;
      const nonCancelledTotal = divData.totalProjects - cancelledCount;
      divData.completionRate = nonCancelledTotal > 0 ?
        (divData.completedProjects / nonCancelledTotal * 100) : 0;
      divData.onTimeRate = nonCancelledTotal > 0 ?
        (divData.onTimeProjects / nonCancelledTotal * 100) : 0;
    });
    
    return data;
  }, [projects]);

  // 모달용 필터링 과제 리스트
  // NOTE: hooks는 early return 전에 호출되어야 함 (React error #310 방지)
  const filteredProjects = useMemo(() => {
    if (!selectedFilter) return [];
    const { division, status, flag } = selectedFilter;
    return projects.filter(p => {
      const divMatch = (p.사업부 || 'Unknown') === division;
      if (!divMatch) return false;
      if (flag === 'poc') return !!p.PoC과제여부;
      if (flag === 'key') return !!p.중점과제여부;
      // 완료율: 모수 = 사업부 전체 - 취소
      if (flag === 'completionRate') {
        const pStatus = p.진행상태 || '미착수';
        return pStatus !== '취소';
      }
      // 정상 진행율: 모수 = 사업부 전체 - 취소
      if (flag === 'onTimeRate') {
        const pStatus = p.진행상태 || '미착수';
        return pStatus !== '취소';
      }
      if (!status) return true;
      const pStatus = p.진행상태 || '미착수';
      return pStatus === status;
    });
  }, [selectedFilter, projects]);

  // 산정 로직 정보 (rate flag 일 때만 표시)
  const formulaInfo = useMemo(() => {
    if (!selectedFilter || !selectedFilter.flag) return null;
    const { division, flag } = selectedFilter;
    const divData = divisionData[division];
    if (!divData) return null;

    const cancelled = divData.statusCounts['취소'] || 0;
    if (flag === 'completionRate') {
      return {
        title: '완료율 산정 로직',
        formula: '완료율 = 완료 과제 수 / (전체 과제 − 취소)',
        numerator: divData.completedProjects,
        denominator: divData.totalProjects - cancelled,
        percent: divData.completionRate,
        accent: statusColors['완료'] || '#3b82f6',
        note: `취소 과제(${cancelled}개)는 모수에서 제외됩니다.`,
        includedStatuses: new Set(['완료'])
      };
    }
    if (flag === 'onTimeRate') {
      return {
        title: '정상 진행율 산정 로직',
        formula: '정상 진행율 = (완료 + 정상진행 + 계획) / (전체 과제 − 취소)',
        numerator: divData.onTimeProjects,
        denominator: divData.totalProjects - cancelled,
        percent: divData.onTimeRate,
        accent: statusColors['정상진행'] || '#eab308',
        note: `취소 과제(${cancelled}개)는 모수에서 제외됩니다.`,
        includedStatuses: new Set(['완료', '정상진행', '계획'])
      };
    }
    return null;
  }, [selectedFilter, divisionData, statusColors]);

  // 데이터가 없는 경우
  if (!projects || projects.length === 0) {
    return (
      <Container
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Title>사업부별 과제 현황</Title>
        <EmptyState>
          <div className="icon">📋</div>
          <div className="message">
            분석할 프로젝트 데이터가 없습니다.<br />
            프로젝트를 추가해보세요.
          </div>
        </EmptyState>
      </Container>
    );
  }

  // 사업부 데이터를 정렬
  // 사업부 순서는 설정이 정본이다 (divisionOrder.js — 옛 표는 5개뿐이라 GTR·SR·CS 가 빠졌다)
  const sortedEntries = sortDivisionEntries(Object.entries(divisionData), settingsData);

  // 카드 렌더링 함수
  const renderDivisionCard = ([division, data], index) => {
    const divisionColor = divisionColors[division] || '#94a3b8';
    const bgColor = `${divisionColor}15`; // 15% 투명도
    const borderColor = `${divisionColor}30`; // 30% 투명도

    // 상태별 데이터를 개수 순으로 정렬
    const statusEntries = Object.entries(data.statusCounts)
      .sort(([,a], [,b]) => b - a);

    return (
      <DivisionCard
        key={division}
        bgColor={bgColor}
        borderColor={borderColor}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: index * 0.1 }}
      >
        <DivisionHeader>
          <DivisionName color={divisionColor}>
            {division}
          </DivisionName>
        </DivisionHeader>

        <MetricsGrid>
          {/* 완료율 */}
          <ClickableMetricItem
            onClick={() => setSelectedFilter({ division, flag: 'completionRate' })}
            title={`${division} · 완료율 산정 데이터 보기`}
          >
            <MetricValue color={statusColors['완료'] || '#3b82f6'}>
              {data.completionRate.toFixed(1)}%
            </MetricValue>
            <MetricLabel>완료율</MetricLabel>
            <ProgressBar>
              <ProgressFill
                color={statusColors['완료'] || '#3b82f6'}
                percentage={data.completionRate}
              />
            </ProgressBar>
          </ClickableMetricItem>

          {/* 정상 진행율 */}
          <ClickableMetricItem
            onClick={() => setSelectedFilter({ division, flag: 'onTimeRate' })}
            title={`${division} · 정상 진행율 산정 데이터 보기`}
          >
            <MetricValue color={statusColors['정상진행'] || '#eab308'}>
              {data.onTimeRate.toFixed(1)}%
            </MetricValue>
            <MetricLabel>정상 진행율</MetricLabel>
            <ProgressBar>
              <ProgressFill
                color={statusColors['정상진행'] || '#eab308'}
                percentage={data.onTimeRate}
              />
            </ProgressBar>
          </ClickableMetricItem>

          {/* PoC 과제 */}
          <ClickableMetricItem
            onClick={() => setSelectedFilter({ division, flag: 'poc' })}
            title={`${division} · PoC 과제 보기`}
          >
            <MetricValue color="#7c3aed">
              {data.pocProjects}
            </MetricValue>
            <MetricLabel>PoC 과제</MetricLabel>
          </ClickableMetricItem>

          {/* 중점 과제 */}
          <ClickableMetricItem
            onClick={() => setSelectedFilter({ division, flag: 'key' })}
            title={`${division} · 중점 과제 보기`}
          >
            <MetricValue color="#dc2626">
              {data.keyProjects}
            </MetricValue>
            <MetricLabel>중점 과제</MetricLabel>
          </ClickableMetricItem>
        </MetricsGrid>

        {/* 진행 상태별 현황 */}
        <StatusSection>
          <StatusSectionTitle>진행 상태별 현황</StatusSectionTitle>
          <StatusGrid>
            {/* 총 과제 수 */}
            <TotalItem
              onClick={() => setSelectedFilter({ division, status: null })}
              title={`${division} 전체 과제 보기`}
            >
              <TotalDot />
              <TotalCount>{data.totalProjects}</TotalCount>
              <TotalLabel>총 과제</TotalLabel>
            </TotalItem>

            {/* 개별 상태들 */}
            {statusEntries.map(([status, count]) => (
              <StatusItem
                key={status}
                onClick={() => setSelectedFilter({ division, status })}
                title={`${division} · ${status} 과제 보기`}
              >
                <StatusDot color={statusColors[status] || '#94a3b8'} />
                <StatusCount color={statusColors[status] || '#94a3b8'}>
                  {count}
                </StatusCount>
                <StatusLabel>{status}</StatusLabel>
              </StatusItem>
            ))}
          </StatusGrid>
        </StatusSection>
      </DivisionCard>
    );
  };

  const handleCloseModal = () => setSelectedFilter(null);

  const modalTitle = selectedFilter
    ? selectedFilter.flag === 'poc'
      ? `${selectedFilter.division} · PoC 과제`
      : selectedFilter.flag === 'key'
        ? `${selectedFilter.division} · 중점 과제`
        : selectedFilter.flag === 'completionRate'
          ? `${selectedFilter.division} · 완료율 산정 데이터`
          : selectedFilter.flag === 'onTimeRate'
            ? `${selectedFilter.division} · 정상 진행율 산정 데이터`
            : selectedFilter.status
              ? `${selectedFilter.division} · ${selectedFilter.status} 과제`
              : `${selectedFilter.division} · 전체 과제`
    : '';

  const modalHeaderBg = selectedFilter
    ? (selectedFilter.flag === 'poc'
        ? '#7c3aed20'
        : selectedFilter.flag === 'key'
          ? '#dc262620'
          : selectedFilter.flag === 'completionRate'
            ? `${statusColors['완료'] || '#3b82f6'}20`
            : selectedFilter.flag === 'onTimeRate'
              ? `${statusColors['정상진행'] || '#eab308'}20`
              : selectedFilter.status
                ? `${statusColors[selectedFilter.status] || '#94a3b8'}20`
                : `${divisionColors[selectedFilter.division] || '#94a3b8'}20`)
    : '#f1f5f9';

  return (
    <Container
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Title>사업부별 과제 현황</Title>

      <DivisionsWrapper>
        <DivisionsRow>
          {sortedEntries.map((entry, index) => renderDivisionCard(entry, index))}
        </DivisionsRow>
      </DivisionsWrapper>

      <AnimatePresence>
        {selectedFilter && (
          <ModalOverlay
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCloseModal}
          >
            <ModalContainer
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
            >
              <ModalHeader $bgColor={modalHeaderBg}>
                <ModalTitle>
                  <Badge
                    $bgColor={`${divisionColors[selectedFilter.division] || '#94a3b8'}30`}
                    $textColor={divisionColors[selectedFilter.division] || '#334155'}
                  >
                    {selectedFilter.division}
                  </Badge>
                  {selectedFilter.status && (
                    <Badge
                      $bgColor={`${statusColors[selectedFilter.status] || '#94a3b8'}30`}
                      $textColor={statusColors[selectedFilter.status] || '#334155'}
                    >
                      {selectedFilter.status}
                    </Badge>
                  )}
                  <span>{modalTitle}</span>
                </ModalTitle>
                <ModalCloseButton onClick={handleCloseModal} aria-label="닫기">
                  <X size={18} />
                </ModalCloseButton>
              </ModalHeader>
              <ModalBody>
                {formulaInfo && (
                  <FormulaBox $accent={formulaInfo.accent}>
                    <FormulaTitle>{formulaInfo.title}</FormulaTitle>
                    <FormulaText>{formulaInfo.formula}</FormulaText>
                    <FormulaResult $accent={formulaInfo.accent}>
                      = {formulaInfo.numerator} / {formulaInfo.denominator} = {formulaInfo.percent.toFixed(1)}%
                    </FormulaResult>
                    {formulaInfo.note && <FormulaNote>{formulaInfo.note}</FormulaNote>}
                  </FormulaBox>
                )}
                {filteredProjects.length === 0 ? (
                  <EmptyListMessage>표시할 과제가 없습니다.</EmptyListMessage>
                ) : (
                  [...filteredProjects]
                    .sort((a, b) => (b.진행률 ?? 0) - (a.진행률 ?? 0))
                    .map((project, idx) => {
                      const progress = project.진행률 ?? 0;
                      const progressColor = progress >= 80 ? '#22c55e' : progress >= 50 ? '#f59e0b' : '#ef4444';
                      const pStatus = project.진행상태 || '미착수';
                      const isInNumerator = formulaInfo ? formulaInfo.includedStatuses.has(pStatus) : false;
                      return (
                        <ProjectListItem key={project.id || `${project.과제명}-${idx}`}>
                          {formulaInfo && (
                            <Badge
                              $bgColor={isInNumerator ? '#dcfce7' : '#f1f5f9'}
                              $textColor={isInNumerator ? '#16a34a' : '#94a3b8'}
                              title={isInNumerator ? '분자에 포함되는 과제' : '분모에만 포함 (분자 미포함)'}
                            >
                              {isInNumerator ? '✓ 분자' : '분모만'}
                            </Badge>
                          )}
                          {!selectedFilter.status && (
                            <Badge
                              $bgColor={`${statusColors[pStatus] || '#94a3b8'}25`}
                              $textColor={statusColors[pStatus] || '#334155'}
                            >
                              {pStatus}
                            </Badge>
                          )}
                          {project.프로세스 && (
                            <Badge $bgColor="#dcfce7" $textColor="#16a34a">
                              {project.프로세스}
                            </Badge>
                          )}
                          <ProjectNameText title={project.과제명}>
                            {project.과제명 || '(과제명 없음)'}
                          </ProjectNameText>
                          {project.과제PL && (
                            <Badge $bgColor="#fef3c7" $textColor="#92400e">
                              PL: {project.과제PL}
                            </Badge>
                          )}
                          <ProgressInline>
                            <ProgressTrack>
                              <ProgressValue color={progressColor} percentage={progress} />
                            </ProgressTrack>
                            <ProgressPercent color={progressColor}>
                              {percentText(project.진행률)}
                            </ProgressPercent>
                          </ProgressInline>
                        </ProjectListItem>
                      );
                    })
                )}
              </ModalBody>
              <ModalFooter>
                총 {filteredProjects.length}개 과제
              </ModalFooter>
            </ModalContainer>
          </ModalOverlay>
        )}
      </AnimatePresence>
    </Container>
  );
};

export default ProjectSummary;