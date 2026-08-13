import React, { useState, useMemo, useCallback } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Target, Briefcase, Percent, Save, ChevronDown, ChevronRight, AlertCircle, Cloud, Calendar, Building2 } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';

const Overlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 2rem;
`;

const ModalContainer = styled(motion.div)`
  background: white;
  border-radius: 1rem;
  width: 80vw;
  height: 80vh;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
`;

const ModalHeader = styled.div`
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
  padding: 1.25rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
`;

const HeaderTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const CloseButton = styled.button`
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 0.5rem;
  color: white;
  width: 2.25rem;
  height: 2.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: scale(1.05);
  }
`;

const SearchBar = styled.div`
  padding: 1rem 1.5rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-shrink: 0;
  flex-wrap: wrap;
`;

const SearchInput = styled.div`
  flex: 1;
  min-width: 250px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  padding: 0.5rem 1rem;

  input {
    flex: 1;
    border: none;
    outline: none;
    font-size: 0.875rem;
    color: #1e293b;

    &::placeholder {
      color: #94a3b8;
    }
  }
`;

const FilterGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const FilterSelect = styled.select`
  padding: 0.5rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.8rem;
  color: #1e293b;
  background: white;
  cursor: pointer;
  min-width: 120px;

  &:focus {
    outline: none;
    border-color: #f59e0b;
    box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1);
  }
`;

const FilterLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: #64748b;
  font-weight: 500;
`;

const StatBadge = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.8rem;
  color: #64748b;

  span {
    font-weight: 600;
    color: #1e293b;
  }
`;

const ModalBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.5rem;

  &::-webkit-scrollbar {
    width: 10px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 5px;
  }

  &::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 5px;

    &:hover {
      background: #94a3b8;
    }
  }
`;

const PerformanceList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const PerformanceCard = styled.div`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  overflow: hidden;
  transition: all 0.2s ease;

  &:hover {
    border-color: #cbd5e1;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }
`;

const PerformanceHeader = styled.div`
  padding: 1rem 1.25rem;
  background: ${props => props.$isExpanded ? '#f8fafc' : 'white'};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 1rem;
  transition: background 0.2s ease;

  &:hover {
    background: #f8fafc;
  }
`;

const ExpandIcon = styled.div`
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
  transform: ${props => props.$isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'};
`;

const PerformanceInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const PerformanceName = styled.div`
  font-size: 1rem;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 0.25rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const PerformanceMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.8rem;
  color: #64748b;
`;

const CategoryBadge = styled.span`
  padding: 0.125rem 0.5rem;
  background: ${props => props.$color || '#e2e8f0'};
  color: white;
  border-radius: 0.25rem;
  font-size: 0.7rem;
  font-weight: 500;
`;

const ProjectCount = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.75rem;
  background: #f1f5f9;
  border-radius: 0.375rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: #475569;
`;

const TotalContribution = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.75rem;
  background: ${props => props.$isWarning ? '#fef3c7' : '#dcfce7'};
  border: 1px solid ${props => props.$isWarning ? '#fcd34d' : '#86efac'};
  border-radius: 0.375rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: ${props => props.$isWarning ? '#92400e' : '#166534'};
`;

const ProjectsContainer = styled(motion.div)`
  border-top: 1px solid #e2e8f0;
  background: #fafafa;
  overflow: hidden;
`;

const ProjectsList = styled.div`
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const ProjectRow = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
`;

const ProjectInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const ProjectName = styled.div`
  font-size: 0.875rem;
  font-weight: 500;
  color: #1e293b;
  margin-bottom: 0.125rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ProjectMeta = styled.div`
  font-size: 0.75rem;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const DivisionBadge = styled.span`
  padding: 0.125rem 0.375rem;
  background: ${props => props.$color || '#e2e8f0'};
  color: white;
  border-radius: 0.25rem;
  font-size: 0.65rem;
  font-weight: 500;
`;

const ContributionInput = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 120px;

  input {
    width: 70px;
    padding: 0.5rem 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    text-align: right;
    color: #1e293b;
    font-weight: 500;
    transition: all 0.2s ease;

    &:focus {
      outline: none;
      border-color: #f59e0b;
      box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1);
    }

    &::-webkit-inner-spin-button,
    &::-webkit-outer-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
  }

  span {
    color: #64748b;
    font-weight: 500;
  }
`;

const EmptyProjects = styled.div`
  padding: 1.5rem;
  text-align: center;
  color: #94a3b8;
  font-size: 0.875rem;
`;

const ModalFooter = styled.div`
  padding: 1rem 1.5rem;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
`;

const FooterInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: #64748b;
`;

const FooterButtons = styled.div`
  display: flex;
  gap: 0.75rem;
`;

const Button = styled.button`
  padding: 0.625rem 1.25rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &.secondary {
    background: white;
    color: #475569;
    border: 1px solid #d1d5db;

    &:hover {
      background: #f3f4f6;
      border-color: #9ca3af;
    }
  }

  &.primary {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: white;
    border: none;

    &:hover {
      background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }
  }

  &.primary-upload {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: white;
    border: none;

    &:hover {
      background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }
  }
`;

const EmptyState = styled.div`
  padding: 3rem;
  text-align: center;
  color: #94a3b8;

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

const ContributionEditModal = ({
  isOpen,
  onClose,
  globalPerformances = [],
  projects = [],
  divisionColors = {},
  performanceCategories = [],
  onSave,
  onSaveAndUpload
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.is_admin;

  const [searchTerm, setSearchTerm] = useState('');
  const [expandedPerformances, setExpandedPerformances] = useState(new Set());
  const [editedContributions, setEditedContributions] = useState({});
  const [yearFilter, setYearFilter] = useState('');
  const [divisionFilter, setDivisionFilter] = useState('');
  const [mismatchFilter, setMismatchFilter] = useState(false);

  // 성과명에서 [사업부명] 접두사 추출
  const extractDivisionFromName = useCallback((performanceName) => {
    if (!performanceName) return null;
    const match = performanceName.match(/^\[([^\]]+)\]/);
    return match ? match[1] : null;
  }, []);

  // 성과별로 연결된 과제 데이터 구성
  const performanceProjectsData = useMemo(() => {
    const data = [];

    globalPerformances.forEach(perf => {
      // 이 성과에 연결된 프로젝트들 찾기
      const linkedProjects = [];

      projects.forEach(project => {
        if (project.성과목록 && Array.isArray(project.성과목록)) {
          // getProjectPerformancesWithData와 동일한 로직으로 성과 연결 찾기
          const perfLink = project.성과목록.find(p => {
            const linkId = typeof p === 'string'
              ? p
              : (p.성과항목UUID || p.id || p.성과항목ID);
            return linkId === perf.id || linkId === perf.uuid;
          });

          if (perfLink) {
            // 기여도 값을 숫자로 변환 (문자열일 수 있음)
            let contributionValue = 100;
            if (typeof perfLink === 'object') {
              const rawValue = perfLink.과제기여도;
              if (rawValue !== undefined && rawValue !== null && rawValue !== '') {
                contributionValue = Number(rawValue) || 100;
              }
            }

            linkedProjects.push({
              projectId: project.id,
              projectName: project.과제명,
              division: project.사업부,
              process: project.프로세스,
              contribution: contributionValue
            });
          }
        }
      });

      if (linkedProjects.length > 0) {
        const totalContribution = linkedProjects.reduce((sum, p) => sum + Number(p.contribution || 0), 0);

        // 성과의 연도 가져오기 (성과년도 필드 또는 연결된 과제의 년도)
        const performanceYear = perf.성과년도 || null;

        // 성과의 사업부 추출 (성과명의 [사업부명] 접두사 또는 연결된 과제들의 사업부)
        const divisionFromName = extractDivisionFromName(perf.성과항목);
        const divisionsFromProjects = [...new Set(linkedProjects.map(p => p.division).filter(Boolean))];

        data.push({
          performanceId: perf.id,
          performanceName: perf.성과항목,
          category: perf.대분류,
          subcategory: perf.소분류,
          unit: perf.단위,
          performanceYear,
          divisionFromName,
          divisionsFromProjects,
          linkedProjects,
          totalContribution
        });
      }
    });

    return data;
  }, [globalPerformances, projects, extractDivisionFromName]);

  // 사용 가능한 연도 목록 추출
  const availableYears = useMemo(() => {
    const yearsSet = new Set();

    // 성과 데이터의 성과년도
    globalPerformances.forEach(perf => {
      if (perf.성과년도) {
        yearsSet.add(String(perf.성과년도));
      }
    });

    return [...yearsSet].sort((a, b) => b.localeCompare(a));
  }, [globalPerformances]);

  // 사용 가능한 사업부 목록 추출 (성과명의 [사업부명] 접두사에서만)
  const availableDivisions = useMemo(() => {
    const divisionsSet = new Set();

    // 성과명에서 [사업부명] 추출
    globalPerformances.forEach(perf => {
      const div = extractDivisionFromName(perf.성과항목);
      if (div) divisionsSet.add(div);
    });

    return [...divisionsSet].sort();
  }, [globalPerformances, extractDivisionFromName]);

  // 검색 및 필터링
  const filteredData = useMemo(() => {
    let data = performanceProjectsData;

    // 연도 필터 적용
    if (yearFilter) {
      data = data.filter(perf => {
        // 성과년도가 일치하거나 연결된 과제의 년도가 일치
        return String(perf.performanceYear) === yearFilter;
      });
    }

    // 사업부 필터 적용 (성과명의 [사업부명] 접두사에서만)
    if (divisionFilter) {
      data = data.filter(perf => perf.divisionFromName === divisionFilter);
    }

    // 기여도 부적합 필터 적용 (총합이 100%가 아닌 것만)
    if (mismatchFilter) {
      data = data.filter(perf => perf.totalContribution !== 100);
    }

    // 검색어 필터 적용
    if (searchTerm.trim()) {
      const lowerSearch = searchTerm.toLowerCase();
      data = data.filter(perf =>
        perf.performanceName?.toLowerCase().includes(lowerSearch) ||
        perf.category?.toLowerCase().includes(lowerSearch) ||
        perf.subcategory?.toLowerCase().includes(lowerSearch) ||
        perf.linkedProjects.some(p =>
          p.projectName?.toLowerCase().includes(lowerSearch) ||
          p.division?.toLowerCase().includes(lowerSearch)
        )
      );
    }

    return data;
  }, [performanceProjectsData, searchTerm, yearFilter, divisionFilter, mismatchFilter]);

  // 카테고리 색상 가져오기
  const getCategoryColor = useCallback((categoryName) => {
    const category = performanceCategories.find(c => c.name === categoryName);
    return category?.color || '#64748b';
  }, [performanceCategories]);

  // 성과 확장/축소 토글
  const toggleExpand = useCallback((perfId) => {
    setExpandedPerformances(prev => {
      const newSet = new Set(prev);
      if (newSet.has(perfId)) {
        newSet.delete(perfId);
      } else {
        newSet.add(perfId);
      }
      return newSet;
    });
  }, []);

  // 기여도 변경 핸들러
  // 구분자로 ':::' 사용 (ID에 '-'가 포함될 수 있으므로)
  const handleContributionChange = useCallback((performanceId, projectId, newValue) => {
    const numValue = Math.max(0, Math.min(100, Number(newValue) || 0));

    setEditedContributions(prev => ({
      ...prev,
      [`${performanceId}:::${projectId}`]: numValue
    }));
  }, []);

  // 현재 기여도 값 가져오기 (편집된 값 또는 원본) - 항상 숫자 반환
  const getCurrentContribution = useCallback((performanceId, projectId, originalValue) => {
    const key = `${performanceId}:::${projectId}`;
    if (editedContributions.hasOwnProperty(key)) {
      return Number(editedContributions[key]) || 0;
    }
    return Number(originalValue) || 0;
  }, [editedContributions]);

  // 변경사항 있는지 확인
  const hasChanges = Object.keys(editedContributions).length > 0;

  // 저장 처리
  const handleSave = () => {
    if (!hasChanges) {
      onClose();
      return;
    }

    // 변경사항을 프로젝트별로 그룹화
    const projectUpdates = {};

    Object.entries(editedContributions).forEach(([key, newContribution]) => {
      const [performanceId, projectId] = key.split(':::');

      if (!projectUpdates[projectId]) {
        projectUpdates[projectId] = [];
      }

      projectUpdates[projectId].push({
        performanceId,
        contribution: newContribution
      });
    });

    onSave && onSave(projectUpdates);
    setEditedContributions({});
  };

  // 저장 및 서버 업로드 처리
  const handleSaveAndUpload = () => {
    if (!hasChanges) {
      onClose();
      return;
    }

    // 변경사항을 프로젝트별로 그룹화
    const projectUpdates = {};

    Object.entries(editedContributions).forEach(([key, newContribution]) => {
      const [performanceId, projectId] = key.split(':::');

      if (!projectUpdates[projectId]) {
        projectUpdates[projectId] = [];
      }

      projectUpdates[projectId].push({
        performanceId,
        contribution: newContribution
      });
    });

    onSaveAndUpload && onSaveAndUpload(projectUpdates);
    setEditedContributions({});
  };

  // 특정 성과의 현재 총 기여도 계산
  const calculateCurrentTotal = (perfData) => {
    if (!perfData || !perfData.linkedProjects) return 0;
    return perfData.linkedProjects.reduce((sum, p) => {
      const contribution = getCurrentContribution(perfData.performanceId, p.projectId, p.contribution);
      return sum + contribution;
    }, 0);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <Overlay
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <ModalContainer
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 500 }}
          onClick={e => e.stopPropagation()}
        >
          <ModalHeader>
            <HeaderTitle>
              <Percent size={22} />
              성과별 과제 기여도 수정
            </HeaderTitle>
            <CloseButton onClick={onClose}>
              <X size={18} />
            </CloseButton>
          </ModalHeader>

          <SearchBar>
            <SearchInput>
              <Search size={18} color="#94a3b8" />
              <input
                type="text"
                placeholder="성과명, 과제명, 사업부로 검색..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <X
                  size={16}
                  color="#94a3b8"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSearchTerm('')}
                />
              )}
            </SearchInput>

            <FilterGroup>
              <FilterLabel>
                <Calendar size={14} />
                연도
              </FilterLabel>
              <FilterSelect
                value={yearFilter}
                onChange={e => setYearFilter(e.target.value)}
              >
                <option value="">전체 연도</option>
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}년</option>
                ))}
              </FilterSelect>
            </FilterGroup>

            <FilterGroup>
              <FilterLabel>
                <Building2 size={14} />
                사업부
              </FilterLabel>
              <FilterSelect
                value={divisionFilter}
                onChange={e => setDivisionFilter(e.target.value)}
              >
                <option value="">전체 사업부</option>
                {availableDivisions.map(div => (
                  <option key={div} value={div}>{div}</option>
                ))}
              </FilterSelect>
            </FilterGroup>

            <FilterGroup>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                padding: '0.5rem 0.75rem',
                background: mismatchFilter ? '#fef3c7' : 'white',
                border: `1px solid ${mismatchFilter ? '#fcd34d' : '#e2e8f0'}`,
                borderRadius: '0.5rem',
                fontSize: '0.8rem',
                fontWeight: 500,
                color: mismatchFilter ? '#92400e' : '#64748b',
                transition: 'all 0.2s ease'
              }}>
                <input
                  type="checkbox"
                  checked={mismatchFilter}
                  onChange={e => setMismatchFilter(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <AlertCircle size={14} />
                기여도 부적합
              </label>
            </FilterGroup>

            <StatBadge>
              <Target size={16} />
              총 <span>{filteredData.length}</span>개 성과
            </StatBadge>
            <StatBadge>
              <Briefcase size={16} />
              총 <span>{filteredData.reduce((sum, p) => sum + p.linkedProjects.length, 0)}</span>개 연결
            </StatBadge>
          </SearchBar>

          <ModalBody>
            {filteredData.length === 0 ? (
              <EmptyState>
                <div className="icon">📊</div>
                <div className="message">
                  {searchTerm
                    ? '검색 결과가 없습니다.'
                    : '과제에 연결된 성과가 없습니다.'}
                </div>
              </EmptyState>
            ) : (
              <PerformanceList>
                {filteredData.map(perfData => {
                  const isExpanded = expandedPerformances.has(perfData.performanceId);
                  const currentTotal = calculateCurrentTotal(perfData);
                  const isWarning = currentTotal !== 100;

                  return (
                    <PerformanceCard key={perfData.performanceId}>
                      <PerformanceHeader
                        $isExpanded={isExpanded}
                        onClick={() => toggleExpand(perfData.performanceId)}
                      >
                        <ExpandIcon $isExpanded={isExpanded}>
                          <ChevronRight size={18} />
                        </ExpandIcon>

                        <PerformanceInfo>
                          <PerformanceName>
                            {perfData.performanceName}
                            {perfData.unit && (
                              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 400 }}>
                                ({perfData.unit})
                              </span>
                            )}
                          </PerformanceName>
                          <PerformanceMeta>
                            <CategoryBadge $color={getCategoryColor(perfData.category)}>
                              {perfData.category}
                            </CategoryBadge>
                            {perfData.subcategory && (
                              <span>{perfData.subcategory}</span>
                            )}
                          </PerformanceMeta>
                        </PerformanceInfo>

                        <ProjectCount>
                          <Briefcase size={14} />
                          {perfData.linkedProjects.length}개 과제
                        </ProjectCount>

                        <TotalContribution $isWarning={isWarning}>
                          {isWarning && <AlertCircle size={14} />}
                          합계: {currentTotal}%
                        </TotalContribution>
                      </PerformanceHeader>

                      <AnimatePresence>
                        {isExpanded && (
                          <ProjectsContainer
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ProjectsList>
                              {perfData.linkedProjects.length === 0 ? (
                                <EmptyProjects>연결된 과제가 없습니다.</EmptyProjects>
                              ) : (
                                perfData.linkedProjects.map(project => (
                                  <ProjectRow key={project.projectId}>
                                    <ProjectInfo>
                                      <ProjectName title={project.projectName}>
                                        {project.projectName}
                                      </ProjectName>
                                      <ProjectMeta>
                                        <DivisionBadge $color={divisionColors[project.division]}>
                                          {project.division}
                                        </DivisionBadge>
                                        <span>{project.process}</span>
                                      </ProjectMeta>
                                    </ProjectInfo>

                                    <ContributionInput>
                                      <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={getCurrentContribution(
                                          perfData.performanceId,
                                          project.projectId,
                                          project.contribution
                                        )}
                                        onChange={e => handleContributionChange(
                                          perfData.performanceId,
                                          project.projectId,
                                          e.target.value
                                        )}
                                        onClick={e => e.stopPropagation()}
                                      />
                                      <span>%</span>
                                    </ContributionInput>
                                  </ProjectRow>
                                ))
                              )}
                            </ProjectsList>
                          </ProjectsContainer>
                        )}
                      </AnimatePresence>
                    </PerformanceCard>
                  );
                })}
              </PerformanceList>
            )}
          </ModalBody>

          <ModalFooter>
            <FooterInfo>
              {hasChanges ? (
                <>
                  <AlertCircle size={16} color="#f59e0b" />
                  {Object.keys(editedContributions).length}개 항목이 수정되었습니다.
                </>
              ) : (
                <span>성과 항목을 클릭하여 연결된 과제의 기여도를 수정할 수 있습니다.</span>
              )}
            </FooterInfo>

            <FooterButtons>
              <Button className="secondary" onClick={onClose}>
                취소
              </Button>
              {isAdmin && (
                <Button
                  className="primary"
                  onClick={handleSave}
                  disabled={!hasChanges}
                  title="내 컴퓨터에만 저장됩니다. (관리자 전용)"
                >
                  <Save size={16} />
                  저장
                </Button>
              )}
              <Button
                className="primary-upload"
                onClick={handleSaveAndUpload}
                disabled={!hasChanges}
                title="서버에 저장되어 모든 사용자와 공유됩니다."
              >
                <Cloud size={16} />
                저장 및 서버 업로드
              </Button>
            </FooterButtons>
          </ModalFooter>
        </ModalContainer>
      </Overlay>
    </AnimatePresence>
  );
};

export default ContributionEditModal;
