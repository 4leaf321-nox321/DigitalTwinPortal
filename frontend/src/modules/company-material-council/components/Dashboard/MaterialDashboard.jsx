import React, { useState, useMemo } from 'react';
import styled from 'styled-components';
import {
  FlaskConical,
  TestTube,
  Activity,
  Thermometer,
  Users,
  Layers,
  LayoutGrid,
  Tag,
  Filter
} from 'lucide-react';

const DashboardContainer = styled.div`
  flex: 1;
  padding: 24px;
  background: #f8fafc;
  overflow-y: auto;
`;

const DashboardHeader = styled.div`
  margin-bottom: 24px;
`;

const DashboardTitle = styled.h2`
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 8px 0;
`;

const DashboardSubtitle = styled.p`
  font-size: 14px;
  color: #64748b;
  margin: 0;
`;

const FilterSection = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
  padding: 16px;
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
`;

const FilterLabel = styled.span`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: #475569;
`;

const FilterSelect = styled.select`
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  color: #1e293b;
  background: white;
  cursor: pointer;
  min-width: 200px;

  &:focus {
    outline: none;
    border-color: #8b5cf6;
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;

  @media (max-width: 1200px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const StatCard = styled.div`
  background: white;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #e2e8f0;
  transition: all 0.2s;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    transform: translateY(-2px);
  }
`;

const StatHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
`;

const StatIcon = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${props => props.$bgColor || '#f1f5f9'};
  color: ${props => props.$color || '#64748b'};
`;

const StatLabel = styled.span`
  font-size: 13px;
  color: #64748b;
  font-weight: 500;
`;

const StatValue = styled.div`
  font-size: 28px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 4px;
`;

const StatSubtext = styled.span`
  font-size: 12px;
  color: #94a3b8;
`;

const SectionTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 16px 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ChartSection = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
  margin-bottom: 24px;

  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
  }
`;

const ChartCard = styled.div`
  background: white;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #e2e8f0;
`;

const ChartHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
`;

const ChartTitle = styled.h4`
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const BarChartContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const BarItem = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const BarLabel = styled.span`
  font-size: 13px;
  color: #475569;
  min-width: 100px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const BarWrapper = styled.div`
  flex: 1;
  height: 24px;
  background: #f1f5f9;
  border-radius: 6px;
  overflow: hidden;
  position: relative;
`;

const Bar = styled.div`
  height: 100%;
  background: ${props => props.$color || '#8b5cf6'};
  border-radius: 6px;
  transition: width 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 8px;
`;

const BarValue = styled.span`
  font-size: 11px;
  font-weight: 600;
  color: ${props => props.$dark ? '#1e293b' : 'white'};
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
`;

const TestingGroupCard = styled.div`
  background: white;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #e2e8f0;
  margin-bottom: 24px;
`;

const TestingGroupGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
`;

const TestingGroupItem = styled.div`
  padding: 16px;
  background: ${props => props.$active ? '#f5f3ff' : '#f8fafc'};
  border: 1px solid ${props => props.$active ? '#c4b5fd' : '#e2e8f0'};
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: #c4b5fd;
    background: #faf5ff;
  }
`;

const TestingGroupName = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 4px;
`;

const TestingGroupCount = styled.div`
  font-size: 12px;
  color: #64748b;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 40px;
  color: #94a3b8;
`;

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16'];

const MaterialDashboard = ({ materials = [], tabsData = {} }) => {
  const [selectedTestingGroup, setSelectedTestingGroup] = useState('all');

  // tabsData에서 Testing Group 필드명 찾기
  const testingGroupFieldName = useMemo(() => {
    // 기본값
    let fieldName = 'testingGroup';

    // tabsData의 각 탭에서 Testing Group 관련 필드 찾기
    Object.values(tabsData).forEach(tab => {
      if (tab.groups) {
        tab.groups.forEach(group => {
          if (group.fields) {
            group.fields.forEach(field => {
              // label이나 id로 Testing Group 필드 찾기
              if (field.label?.toLowerCase().includes('testing group') ||
                  field.id?.includes('testing_group') ||
                  field.name === 'testingGroup') {
                fieldName = field.name;
              }
            });
          }
        });
      }
    });

    return fieldName;
  }, [tabsData]);

  // Testing Group 목록 추출
  const testingGroups = useMemo(() => {
    const groups = new Set();
    materials.forEach(material => {
      const tests = material.tests || {};
      Object.values(tests).forEach(testList => {
        testList.forEach(test => {
          const group = test.data?.[testingGroupFieldName];
          if (group) groups.add(group);
        });
      });
    });
    return Array.from(groups).sort();
  }, [materials, testingGroupFieldName]);

  // 필터링된 Materials (Testing Group 기준)
  const filteredMaterials = useMemo(() => {
    if (selectedTestingGroup === 'all') return materials;

    return materials.filter(material => {
      const tests = material.tests || {};
      return Object.values(tests).some(testList =>
        testList.some(test => test.data?.[testingGroupFieldName] === selectedTestingGroup)
      );
    });
  }, [materials, selectedTestingGroup, testingGroupFieldName]);

  // 통계 계산
  const stats = useMemo(() => {
    const totalMaterials = filteredMaterials.length;

    // 테스트 수 계산
    let tensileTests = 0;
    let dmaStrainTests = 0;
    let dmaFreqTempTests = 0;

    // Family별 분포
    const familyCount = {};
    // Category별 분포
    const categoryCount = {};
    // Grade별 분포
    const gradeCount = {};
    // Testing Group별 테스트 수
    const testingGroupCount = {};

    filteredMaterials.forEach(material => {
      // Family 집계
      const family = material.data?.family || '미분류';
      familyCount[family] = (familyCount[family] || 0) + 1;

      // Category 집계
      const category = material.data?.category || '미분류';
      categoryCount[category] = (categoryCount[category] || 0) + 1;

      // Grade 집계
      const grade = material.data?.grade || '미분류';
      gradeCount[grade] = (gradeCount[grade] || 0) + 1;

      // 테스트 집계
      const tests = material.tests || {};

      if (tests['tensile-test']) {
        tests['tensile-test'].forEach(test => {
          tensileTests++;
          const group = test.data?.[testingGroupFieldName] || '미분류';
          testingGroupCount[group] = (testingGroupCount[group] || 0) + 1;
        });
      }

      if (tests['dma-strain-sweep']) {
        tests['dma-strain-sweep'].forEach(test => {
          dmaStrainTests++;
          const group = test.data?.[testingGroupFieldName] || '미분류';
          testingGroupCount[group] = (testingGroupCount[group] || 0) + 1;
        });
      }

      if (tests['dma-freq-temp-sweep']) {
        tests['dma-freq-temp-sweep'].forEach(test => {
          dmaFreqTempTests++;
          const group = test.data?.[testingGroupFieldName] || '미분류';
          testingGroupCount[group] = (testingGroupCount[group] || 0) + 1;
        });
      }
    });

    const totalTests = tensileTests + dmaStrainTests + dmaFreqTempTests;

    return {
      totalMaterials,
      totalTests,
      tensileTests,
      dmaStrainTests,
      dmaFreqTempTests,
      familyCount,
      categoryCount,
      gradeCount,
      testingGroupCount
    };
  }, [filteredMaterials, testingGroupFieldName]);

  // 차트 데이터 정렬
  const sortedFamilyData = Object.entries(stats.familyCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const sortedCategoryData = Object.entries(stats.categoryCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const sortedGradeData = Object.entries(stats.gradeCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const maxFamilyCount = Math.max(...sortedFamilyData.map(d => d[1]), 1);
  const maxCategoryCount = Math.max(...sortedCategoryData.map(d => d[1]), 1);
  const maxGradeCount = Math.max(...sortedGradeData.map(d => d[1]), 1);

  if (materials.length === 0) {
    return (
      <DashboardContainer>
        <DashboardHeader>
          <DashboardTitle>물성 대시보드</DashboardTitle>
          <DashboardSubtitle>Material 데이터 분석 및 통계</DashboardSubtitle>
        </DashboardHeader>
        <EmptyState>
          <FlaskConical size={48} color="#cbd5e1" />
          <p>등록된 Material 데이터가 없습니다.</p>
          <p>데이터 관리 화면에서 Material을 추가해주세요.</p>
        </EmptyState>
      </DashboardContainer>
    );
  }

  return (
    <DashboardContainer>
      <DashboardHeader>
        <DashboardTitle>물성 대시보드</DashboardTitle>
        <DashboardSubtitle>Material 데이터 분석 및 통계</DashboardSubtitle>
      </DashboardHeader>

      {/* Testing Group 필터 */}
      <FilterSection>
        <FilterLabel>
          <Filter size={16} />
          Testing Group 필터
        </FilterLabel>
        <FilterSelect
          value={selectedTestingGroup}
          onChange={(e) => setSelectedTestingGroup(e.target.value)}
        >
          <option value="all">전체 그룹</option>
          {testingGroups.map(group => (
            <option key={group} value={group}>{group}</option>
          ))}
        </FilterSelect>
        {selectedTestingGroup !== 'all' && (
          <StatSubtext>
            {filteredMaterials.length}개 Material 필터링됨
          </StatSubtext>
        )}
      </FilterSection>

      {/* 요약 통계 카드 */}
      <StatsGrid>
        <StatCard>
          <StatHeader>
            <StatLabel>전체 Material</StatLabel>
            <StatIcon $bgColor="#f5f3ff" $color="#8b5cf6">
              <FlaskConical size={20} />
            </StatIcon>
          </StatHeader>
          <StatValue>{stats.totalMaterials}</StatValue>
          <StatSubtext>등록된 물성 수</StatSubtext>
        </StatCard>

        <StatCard>
          <StatHeader>
            <StatLabel>Tensile Test</StatLabel>
            <StatIcon $bgColor="#fef3c7" $color="#f59e0b">
              <TestTube size={20} />
            </StatIcon>
          </StatHeader>
          <StatValue>{stats.tensileTests}</StatValue>
          <StatSubtext>인장 시험 데이터</StatSubtext>
        </StatCard>

        <StatCard>
          <StatHeader>
            <StatLabel>DMA Strain Sweep</StatLabel>
            <StatIcon $bgColor="#dcfce7" $color="#10b981">
              <Activity size={20} />
            </StatIcon>
          </StatHeader>
          <StatValue>{stats.dmaStrainTests}</StatValue>
          <StatSubtext>스트레인 스윕 데이터</StatSubtext>
        </StatCard>

        <StatCard>
          <StatHeader>
            <StatLabel>DMA Freq-Temp</StatLabel>
            <StatIcon $bgColor="#dbeafe" $color="#3b82f6">
              <Thermometer size={20} />
            </StatIcon>
          </StatHeader>
          <StatValue>{stats.dmaFreqTempTests}</StatValue>
          <StatSubtext>주파수-온도 스윕 데이터</StatSubtext>
        </StatCard>
      </StatsGrid>

      {/* Testing Group별 분포 */}
      {Object.keys(stats.testingGroupCount).length > 0 && (
        <TestingGroupCard>
          <SectionTitle>
            <Users size={18} />
            Testing Group별 시험 데이터
          </SectionTitle>
          <TestingGroupGrid>
            {Object.entries(stats.testingGroupCount)
              .sort((a, b) => b[1] - a[1])
              .map(([group, count]) => (
                <TestingGroupItem
                  key={group}
                  $active={selectedTestingGroup === group}
                  onClick={() => setSelectedTestingGroup(
                    selectedTestingGroup === group ? 'all' : group
                  )}
                >
                  <TestingGroupName>{group}</TestingGroupName>
                  <TestingGroupCount>{count}개 시험</TestingGroupCount>
                </TestingGroupItem>
              ))}
          </TestingGroupGrid>
        </TestingGroupCard>
      )}

      {/* 차트 섹션 */}
      <ChartSection>
        {/* Family별 분포 */}
        <ChartCard>
          <ChartHeader>
            <ChartTitle>
              <Layers size={16} />
              Family별 Material 분포
            </ChartTitle>
          </ChartHeader>
          <BarChartContainer>
            {sortedFamilyData.length > 0 ? (
              sortedFamilyData.map(([name, count], index) => (
                <BarItem key={name}>
                  <BarLabel title={name}>{name}</BarLabel>
                  <BarWrapper>
                    <Bar
                      $color={COLORS[index % COLORS.length]}
                      style={{ width: `${(count / maxFamilyCount) * 100}%` }}
                    />
                    <BarValue $dark={(count / maxFamilyCount) < 0.3}>
                      {count}
                    </BarValue>
                  </BarWrapper>
                </BarItem>
              ))
            ) : (
              <EmptyState>데이터 없음</EmptyState>
            )}
          </BarChartContainer>
        </ChartCard>

        {/* Category별 분포 */}
        <ChartCard>
          <ChartHeader>
            <ChartTitle>
              <LayoutGrid size={16} />
              Category별 Material 분포
            </ChartTitle>
          </ChartHeader>
          <BarChartContainer>
            {sortedCategoryData.length > 0 ? (
              sortedCategoryData.map(([name, count], index) => (
                <BarItem key={name}>
                  <BarLabel title={name}>{name}</BarLabel>
                  <BarWrapper>
                    <Bar
                      $color={COLORS[(index + 2) % COLORS.length]}
                      style={{ width: `${(count / maxCategoryCount) * 100}%` }}
                    />
                    <BarValue $dark={(count / maxCategoryCount) < 0.3}>
                      {count}
                    </BarValue>
                  </BarWrapper>
                </BarItem>
              ))
            ) : (
              <EmptyState>데이터 없음</EmptyState>
            )}
          </BarChartContainer>
        </ChartCard>
      </ChartSection>

      {/* Grade별 분포 */}
      <ChartCard>
        <ChartHeader>
          <ChartTitle>
            <Tag size={16} />
            Grade별 Material 분포 (상위 8개)
          </ChartTitle>
        </ChartHeader>
        <BarChartContainer>
          {sortedGradeData.length > 0 ? (
            sortedGradeData.map(([name, count], index) => (
              <BarItem key={name}>
                <BarLabel title={name}>{name}</BarLabel>
                <BarWrapper>
                  <Bar
                    $color={COLORS[(index + 4) % COLORS.length]}
                    style={{ width: `${(count / maxGradeCount) * 100}%` }}
                  />
                  <BarValue $dark={(count / maxGradeCount) < 0.3}>
                    {count}
                  </BarValue>
                </BarWrapper>
              </BarItem>
            ))
          ) : (
            <EmptyState>데이터 없음</EmptyState>
          )}
        </BarChartContainer>
      </ChartCard>
    </DashboardContainer>
  );
};

export default MaterialDashboard;
