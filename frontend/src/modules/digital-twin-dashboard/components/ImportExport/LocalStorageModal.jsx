import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { X, Save, Download, Database, FileText, Table, Check, AlertCircle, Info, ChevronDown } from 'lucide-react';
import {
  exportProjectsToJSON,
  exportProjectsToCSV,
  exportProjectsToExcel,
  EXPORT_MODES,
  EXPORT_MODE_DESCRIPTIONS
} from '../../utils/importExportUtils';

const ModalOverlay = styled.div`
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

const ModalContainer = styled.div`
  background: white;
  border-radius: 0.5rem;
  width: 90%;
  max-width: 1200px;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
`;

const HeaderContent = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const IconWrapper = styled.div`
  padding: 0.5rem;
  background: #dbeafe;
  border-radius: 0.5rem;
`;

const HeaderText = styled.div`
  h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: #111827;
  }
  
  p {
    margin: 0;
    font-size: 0.875rem;
    color: #6b7280;
  }
`;

const CloseButton = styled.button`
  padding: 0.5rem;
  background: none;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: background-color 0.2s;
  
  &:hover {
    background: #e5e7eb;
  }
  
  &:disabled {
    opacity: 0.5;
  }
`;

const ModalBody = styled.div`
  padding: 1.5rem;
  max-height: calc(90vh - 200px);
  overflow-y: auto;
`;

const ContentGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 1.5rem;
  
  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
  }
`;

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const SectionTitle = styled.h3`
  margin: 0 0 1rem 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #374151;
`;

const FormatGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 1rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const FormatOption = styled.div`
  padding: 1rem;
  border: 2px solid ${props => props.selected ? '#3b82f6' : '#e5e7eb'};
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
  background: ${props => props.selected ? '#eff6ff' : 'white'};
  
  &:hover {
    border-color: ${props => props.selected ? '#3b82f6' : '#9ca3af'};
  }
`;

const FormatHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
`;

const FormatIcon = styled.div`
  padding: 0.5rem;
  border-radius: 0.5rem;
  background: ${props => props.selected ? '#dbeafe' : '#f3f4f6'};
`;

const FormatInfo = styled.div`
  .title {
    font-weight: 500;
    color: #111827;
    margin-bottom: 0.25rem;
  }
  
  .subtitle {
    font-size: 0.875rem;
    color: #6b7280;
  }
`;

const FeatureList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const FeatureItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: #6b7280;
`;

const ModeOption = styled.div`
  padding: 1rem;
  border: 2px solid ${props => props.selected ? '#3b82f6' : '#e5e7eb'};
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
  background: ${props => props.selected ? '#eff6ff' : 'white'};
  margin-bottom: 0.75rem;
  
  &:hover {
    border-color: ${props => props.selected ? '#3b82f6' : '#9ca3af'};
  }
`;

const ModeHeader = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
`;

const ModeIcon = styled.div`
  padding: 0.5rem;
  border-radius: 0.5rem;
  background: ${props => props.selected ? '#dbeafe' : '#f3f4f6'};
  margin-top: 0.25rem;
  
  span {
    font-size: 1.125rem;
  }
`;

const ModeContent = styled.div`
  flex: 1;
  
  .title {
    font-weight: 500;
    color: #111827;
    margin-bottom: 0.25rem;
  }
  
  .description {
    font-size: 0.875rem;
    color: #6b7280;
    margin-bottom: 0.5rem;
  }
  
  .pros {
    font-size: 0.75rem;
    color: #059669;
    margin-bottom: 0.25rem;
  }
  
  .cons {
    font-size: 0.75rem;
    color: #d97706;
  }
`;

const ModeCheck = styled.div`
  margin-top: 0.25rem;
`;

const DataSummary = styled.div`
  background: #f9fafb;
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 1rem;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 0.75rem;
`;

const StatCard = styled.div`
  text-align: center;
  padding: 0.75rem;
  background: white;
  border-radius: 0.5rem;
  
  .number {
    font-size: 1.5rem;
    font-weight: 700;
    color: ${props => props.color || '#3b82f6'};
    margin-bottom: 0.25rem;
  }
  
  .label {
    font-size: 0.875rem;
    color: #6b7280;
  }
`;

const InfoBox = styled.div`
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 0.5rem;
  padding: 1rem;
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  
  .content {
    font-size: 0.75rem;
    color: #1e40af;
    
    .title {
      font-weight: 500;
      margin-bottom: 0.25rem;
    }
    
    .list {
      margin-top: 0.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
  }
`;

const StatusMessage = styled.div`
  padding: 1rem;
  border-radius: 0.5rem;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  &.success {
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    color: #166534;
  }
  
  &.error {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #dc2626;
  }
  
  .message {
    font-weight: 500;
  }
  
  .details {
    font-size: 0.875rem;
    margin-top: 0.25rem;
  }
`;

const ModalFooter = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
`;

const FooterInfo = styled.div`
  font-size: 0.875rem;
  color: #6b7280;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 0.75rem;
`;

const Button = styled.button`
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  &.cancel {
    background: none;
    color: #6b7280;
    
    &:hover {
      color: #374151;
    }
  }
  
  &.save {
    background: #3b82f6;
    color: white;
    
    &:hover:not(:disabled) {
      background: #2563eb;
    }
    
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
`;

const Spinner = styled.div`
  width: 1rem;
  height: 1rem;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const DivisionSelect = styled.div`
  margin-bottom: 1rem;
`;

const DivisionSelectHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
`;

const DivisionSelectTitle = styled.div`
  font-weight: 500;
  color: #374151;
  font-size: 0.875rem;
`;

const SelectAllButton = styled.button`
  padding: 0.25rem 0.5rem;
  background: none;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #f3f4f6;
    border-color: #9ca3af;
  }
`;

const DivisionGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.5rem;
  padding: 0.75rem;
  background: #f9fafb;
  border-radius: 0.5rem;
  border: 1px solid #e5e7eb;
  max-height: 200px;
  overflow-y: auto;
`;

const DivisionCheckbox = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background: #e5e7eb;
  }

  input[type="checkbox"] {
    cursor: pointer;
  }

  span {
    font-size: 0.875rem;
    color: #374151;
  }
`;

const YearSelectWrapper = styled.div`
  position: relative;
  margin-bottom: 1rem;
`;

const YearSelectLabel = styled.div`
  font-weight: 500;
  color: #374151;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
`;

const YearSelectBox = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.375rem;
  min-height: 2.25rem;
  padding: 0.375rem 0.5rem;
  border: 1px solid ${props => props.$isOpen ? '#3b82f6' : '#d1d5db'};
  border-radius: 0.5rem;
  background: white;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: ${props => props.$isOpen ? '#3b82f6' : '#9ca3af'};
  }
`;

const YearTag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.5rem;
  background: #eff6ff;
  color: #2563eb;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;

  .remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 0.7rem;
    line-height: 1;
    color: #3b82f6;
    transition: all 0.15s;

    &:hover {
      background: #bfdbfe;
      color: #1d4ed8;
    }
  }
`;

const YearPlaceholder = styled.span`
  color: #9ca3af;
  font-size: 0.8rem;
`;

const YearChevron = styled.div`
  margin-left: auto;
  display: flex;
  align-items: center;
  color: #9ca3af;
  transition: transform 0.2s;
  transform: ${props => props.$isOpen ? 'rotate(180deg)' : 'rotate(0)'};
  flex-shrink: 0;
`;

const YearDropdown = styled.div`
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 50;
  overflow: hidden;
`;

const YearDropdownHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
`;

const YearDropdownList = styled.div`
  max-height: 180px;
  overflow-y: auto;
`;

const YearDropdownItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  font-size: 0.8rem;
  color: #374151;
  transition: background 0.15s;

  &:hover {
    background: #f3f4f6;
  }

  input[type="checkbox"] {
    cursor: pointer;
    accent-color: #3b82f6;
  }
`;

const LocalStorageModal = ({
  isOpen,
  onClose,
  projects = [],
  performances = [],
  settingsData = {},
  onSaveComplete
}) => {
  const [storageFormat, setStorageFormat] = useState('json');
  const [csvMode, setCsvMode] = useState(EXPORT_MODES.MULTI_TABLE);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [error, setError] = useState('');
  const [selectedDivisions, setSelectedDivisions] = useState([]);
  const [selectedYears, setSelectedYears] = useState([]);
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
  const yearDropdownRef = useRef(null);

  // 연도 드롭다운 외부 클릭 닫기
  useEffect(() => {
    if (!isYearDropdownOpen) return;
    const handleClickOutside = (e) => {
      if (yearDropdownRef.current && !yearDropdownRef.current.contains(e.target)) {
        setIsYearDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isYearDropdownOpen]);

  if (!isOpen) return null;

  // 사업부 목록
  const divisions = settingsData.divisions || [];

  // ���로젝트에서 연도 목록 추출 (중복 제거, 내림차순 정렬)
  const availableYears = [...new Set(
    projects
      .filter(p => !p._deleted && p.과제년도)
      .map(p => Number(p.과제년도))
  )].sort((a, b) => b - a);

  // 선택된 사업부 ID를 name으로 변환하는 헬퍼 함수
  const getSelectedDivisionNames = () => {
    return selectedDivisions.map(divId => {
      const division = divisions.find(d => d.id === divId);
      return division ? division.name : divId;
    });
  };

  // 전체 선택/해제
  const handleSelectAll = () => {
    if (selectedDivisions.length === divisions.length) {
      setSelectedDivisions([]);
    } else {
      setSelectedDivisions(divisions.map(d => d.id));
    }
  };

  // 사업부 선택 토글
  const handleDivisionToggle = (divisionId) => {
    setSelectedDivisions(prev => {
      if (prev.includes(divisionId)) {
        return prev.filter(id => id !== divisionId);
      } else {
        return [...prev, divisionId];
      }
    });
  };

  // 연도 전체 선택/해제
  const handleSelectAllYears = () => {
    if (selectedYears.length === availableYears.length) {
      setSelectedYears([]);
    } else {
      setSelectedYears([...availableYears]);
    }
  };

  // 연도 선택 토글
  const handleYearToggle = (year) => {
    setSelectedYears(prev => {
      if (prev.includes(year)) {
        return prev.filter(y => y !== year);
      } else {
        return [...prev, year];
      }
    });
  };

  const handleLocalSave = () => {
    if (!projects || projects.length === 0) {
      setError('저장할 프로젝트 데이터가 없습니다.');
      return;
    }

    // 사업부가 선택되지 않았으면 경고
    if (selectedDivisions.length === 0) {
      setError('저장할 사업부를 최소 1개 이상 선택해주세요.');
      return;
    }

    // 연도가 선택되지 않았으면 경고
    if (selectedYears.length === 0) {
      setError('저장할 연도를 최소 1개 이상 선택해주세요.');
      return;
    }

    try {
      setIsSaving(true);
      setError('');
      setSaveStatus(null);

      // 선택된 사업부 + 연도의 프로젝트만 필터링
      // 삭제된 과제(_deleted: true)는 제외
      const selectedDivisionNames = getSelectedDivisionNames();
      const filteredProjects = projects.filter(project =>
        selectedDivisionNames.includes(project.사업부) &&
        selectedYears.includes(Number(project.과제년도)) &&
        !project._deleted
      );

      if (filteredProjects.length === 0) {
        setError('선택된 사업부에 해당하는 프로젝트가 없습니다.');
        setIsSaving(false);
        return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `digital-twin-dashboard-${timestamp}`;

      let success = false;

      if (storageFormat === 'json') {
        // 성과는 모두 export (사업부 구분 없음)
        success = exportProjectsToJSON(filteredProjects, performances, filename);
      } else if (storageFormat === 'excel') {
        success = exportProjectsToExcel(filteredProjects, performances, filename);
      } else {
        // CSV도 performances props를 전달하여 최신 데이터 사용
        success = exportProjectsToCSV(filteredProjects, performances, filename, csvMode);
      }

      if (success) {
        setSaveStatus('success');
        onSaveComplete && onSaveComplete();

        // 2초 후 모달 닫기
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setError('파일 저장에 실패했습니다.');
        setSaveStatus('error');
      }
    } catch (err) {
      console.error('Save error:', err);
      setError(err.message || '파일 저장 중 오류가 발생했습니다.');
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalOverlay>
      <ModalContainer>
        {/* 헤더 */}
        <ModalHeader>
          <HeaderContent>
            <IconWrapper>
              <Save size={24} color="#2563eb" />
            </IconWrapper>
            <HeaderText>
              <h2>로컬 저장</h2>
              <p>프로젝트 데이터를 파일로 저장</p>
            </HeaderText>
          </HeaderContent>
          <CloseButton onClick={onClose} disabled={isSaving}>
            <X size={20} color="#6b7280" />
          </CloseButton>
        </ModalHeader>

        {/* 본문 */}
        <ModalBody>
          {/* 상태 메시지 */}
          {saveStatus === 'success' && (
            <StatusMessage className="success">
              <Check size={20} />
              <div>
                <div className="message">✅ 로컬 저장이 완료되었습니다!</div>
                <div className="details">파일이 다운로드 폴더에 저장되었습니다.</div>
              </div>
            </StatusMessage>
          )}

          {(saveStatus === 'error' || error) && (
            <StatusMessage className="error">
              <AlertCircle size={20} />
              <div>
                <div className="message">오류 발생</div>
                <div className="details">{error || '파일 저장 중 오류가 발생했습니다.'}</div>
              </div>
            </StatusMessage>
          )}

          {/* 사업부 선택 */}
          <DivisionSelect>
            <DivisionSelectHeader>
              <DivisionSelectTitle>🏢 사업부 선택 (필수)</DivisionSelectTitle>
              <SelectAllButton onClick={handleSelectAll}>
                {selectedDivisions.length === divisions.length ? '전체 해제' : '전체 선택'}
              </SelectAllButton>
            </DivisionSelectHeader>
            <DivisionGrid>
              {divisions.map(division => (
                <DivisionCheckbox key={division.id}>
                  <input
                    type="checkbox"
                    checked={selectedDivisions.includes(division.id)}
                    onChange={() => handleDivisionToggle(division.id)}
                  />
                  <span>{division.name}</span>
                </DivisionCheckbox>
              ))}
            </DivisionGrid>
          </DivisionSelect>

          {/* 연도 선택 */}
          <YearSelectWrapper ref={yearDropdownRef}>
            <YearSelectLabel>📅 연도 선택 (필수)</YearSelectLabel>
            <YearSelectBox
              $isOpen={isYearDropdownOpen}
              onClick={() => setIsYearDropdownOpen(prev => !prev)}
            >
              {selectedYears.length > 0 ? (
                [...selectedYears].sort().map(year => (
                  <YearTag key={year}>
                    {year}년
                    <span
                      className="remove"
                      onClick={(e) => { e.stopPropagation(); handleYearToggle(year); }}
                    >×</span>
                  </YearTag>
                ))
              ) : (
                <YearPlaceholder>연도를 선택하세요</YearPlaceholder>
              )}
              <YearChevron $isOpen={isYearDropdownOpen}>
                <ChevronDown size={16} />
              </YearChevron>
            </YearSelectBox>

            {isYearDropdownOpen && (
              <YearDropdown>
                <YearDropdownHeader>
                  <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    {selectedYears.length}개 선택됨
                  </span>
                  <SelectAllButton onClick={(e) => { e.stopPropagation(); handleSelectAllYears(); }}>
                    {selectedYears.length === availableYears.length ? '전체 해제' : '전체 선택'}
                  </SelectAllButton>
                </YearDropdownHeader>
                <YearDropdownList>
                  {availableYears.length > 0 ? (
                    availableYears.map(year => (
                      <YearDropdownItem
                        key={year}
                        onClick={(e) => { e.stopPropagation(); handleYearToggle(year); }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedYears.includes(year)}
                          readOnly
                        />
                        <span>{year}년</span>
                      </YearDropdownItem>
                    ))
                  ) : (
                    <YearDropdownItem style={{ color: '#9ca3af', cursor: 'default' }}>
                      프로젝트가 없습니다
                    </YearDropdownItem>
                  )}
                </YearDropdownList>
              </YearDropdown>
            )}
          </YearSelectWrapper>

          {/* 콘텐츠 */}
          <ContentGrid>
            {/* 왼쪽: 저장 형식 선택 */}
            <Section>
              <SectionTitle>📁 저장 형식 선택</SectionTitle>
              
              <FormatGrid>
                {/* JSON 옵션 */}
                <FormatOption selected={storageFormat === 'json'} onClick={() => setStorageFormat('json')}>
                  <FormatHeader>
                    <FormatIcon selected={storageFormat === 'json'}>
                      <Database size={20} color={storageFormat === 'json' ? '#2563eb' : '#6b7280'} />
                    </FormatIcon>
                    <FormatInfo>
                      <div className="title">JSON</div>
                    </FormatInfo>
                  </FormatHeader>
                  
                  <FeatureList>
                    <FeatureItem>
                      <Check size={12} color="#10b981" />
                      <span>완전한 데이터 보존</span>
                    </FeatureItem>
                    <FeatureItem>
                      <Check size={12} color="#10b981" />
                      <span>시스템 간 호환성</span>
                    </FeatureItem>
                    <FeatureItem>
                      <Check size={12} color="#10b981" />
                      <span>메타데이터 포함</span>
                    </FeatureItem>
                  </FeatureList>
                </FormatOption>

                {/* CSV 옵션 */}
                <FormatOption selected={storageFormat === 'csv'} onClick={() => setStorageFormat('csv')}>
                  <FormatHeader>
                    <FormatIcon selected={storageFormat === 'csv'}>
                      <FileText size={20} color={storageFormat === 'csv' ? '#2563eb' : '#6b7280'} />
                    </FormatIcon>
                    <FormatInfo>
                      <div className="title">CSV</div>
                    </FormatInfo>
                  </FormatHeader>

                  <FeatureList>
                    <FeatureItem>
                      <Check size={12} color="#10b981" />
                      <span>Excel에서 편집 가능</span>
                    </FeatureItem>
                    <FeatureItem>
                      <Check size={12} color="#10b981" />
                      <span>분석 도구 호환</span>
                    </FeatureItem>
                    <FeatureItem>
                      <Check size={12} color="#10b981" />
                      <span>가벼운 파일 크기</span>
                    </FeatureItem>
                  </FeatureList>
                </FormatOption>

                {/* Excel 옵션 */}
                <FormatOption selected={storageFormat === 'excel'} onClick={() => setStorageFormat('excel')}>
                  <FormatHeader>
                    <FormatIcon selected={storageFormat === 'excel'}>
                      <Table size={20} color={storageFormat === 'excel' ? '#2563eb' : '#6b7280'} />
                    </FormatIcon>
                    <FormatInfo>
                      <div className="title">Excel</div>
                    </FormatInfo>
                  </FormatHeader>

                  <FeatureList>
                    <FeatureItem>
                      <Check size={12} color="#10b981" />
                      <span>서식/색상 헤더 포함</span>
                    </FeatureItem>
                    <FeatureItem>
                      <Check size={12} color="#10b981" />
                      <span>사업부/프로세스/과제영역</span>
                    </FeatureItem>
                    <FeatureItem>
                      <Check size={12} color="#10b981" />
                      <span>보고서 활용 최적화</span>
                    </FeatureItem>
                  </FeatureList>
                </FormatOption>
              </FormatGrid>
            </Section>

            {/* 가운데: 형식별 옵션 */}
            <Section>
              {storageFormat === 'csv' && (
                <>
                  <SectionTitle>⚙️ CSV 저장 방식</SectionTitle>
                  
                  {Object.entries(EXPORT_MODE_DESCRIPTIONS).filter(([key]) => key !== EXPORT_MODES.JSON).map(([mode, description]) => (
                    <ModeOption 
                      key={mode} 
                      selected={csvMode === mode} 
                      onClick={() => setCsvMode(mode)}
                    >
                      <ModeHeader>
                        <ModeIcon selected={csvMode === mode}>
                          <span>{description.icon}</span>
                        </ModeIcon>
                        <ModeContent>
                          <div className="title">{description.name}</div>
                          <div className="description">{description.description}</div>
                          <div className="pros"><strong>장점:</strong> {description.pros.join(', ')}</div>
                          <div className="cons"><strong>참고:</strong> {description.cons.join(', ')}</div>
                        </ModeContent>
                        {csvMode === mode && (
                          <ModeCheck>
                            <Check size={20} color="#2563eb" />
                          </ModeCheck>
                        )}
                      </ModeHeader>
                    </ModeOption>
                  ))}
                </>
              )}
              
              {storageFormat === 'json' && (
                <>
                  <SectionTitle>📋 JSON 저장 옵션</SectionTitle>

                  <InfoBox>
                    <Database size={16} color="#2563eb" />
                    <div className="content">
                      <div className="title">완전한 데이터 구조 보존</div>
                      <div>모든 프로젝트 데이터가 원본 구조 그대로 저장됩니다.</div>
                      <div className="list">
                        <div>✓ 성과 데이터 완전 보존</div>
                        <div>✓ 액션아이템 상세 정보</div>
                        <div>✓ 팀 멤버 정보</div>
                        <div>✓ 메타데이터 포함</div>
                      </div>
                    </div>
                  </InfoBox>
                </>
              )}

              {storageFormat === 'excel' && (
                <>
                  <SectionTitle>📊 Excel 저장 옵션</SectionTitle>

                  <InfoBox>
                    <Table size={16} color="#2563eb" />
                    <div className="content">
                      <div className="title">보고서용 Excel 파일</div>
                      <div>사업부/프로세스/과제영역 기준으로 정리된 Excel 파일이 생성됩니다.</div>
                      <div className="list">
                        <div>✓ 1열: 사업부 / 2열: 프로세스 / 3열: 과제영역</div>
                        <div>✓ 2줄 헤더 (옅은 파란색 배경)</div>
                        <div>✓ 과제 정보 + 성과 정보 + 월별 실적</div>
                        <div>✓ .xlsx 형식 (Excel 원본)</div>
                      </div>
                    </div>
                  </InfoBox>
                </>
              )}
            </Section>

            {/* 오른쪽: 데이터 요약 */}
            <Section>
              <SectionTitle>📊 저장될 데이터</SectionTitle>

              <DataSummary>
                <StatsGrid>
                  <StatCard color="#2563eb">
                    <div className="number">
                      {(() => {
                        if (selectedDivisions.length === 0 || selectedYears.length === 0) return 0;
                        const names = getSelectedDivisionNames();
                        return projects.filter(p =>
                          names.includes(p.사업부) && selectedYears.includes(Number(p.과제년도)) && !p._deleted
                        ).length;
                      })()}
                    </div>
                    <div className="label">프로젝트 ({selectedDivisions.length}개 사업부, {selectedYears.length}개 연도)</div>
                  </StatCard>
                  <StatCard color="#10b981">
                    <div className="number">{performances.length}</div>
                    <div className="label">성과 (전체)</div>
                  </StatCard>
                </StatsGrid>

                <StatsGrid>
                  <StatCard color="#f59e0b">
                    <div className="number">
                      {(() => {
                        if (selectedDivisions.length === 0 || selectedYears.length === 0) return 0;
                        const names = getSelectedDivisionNames();
                        return projects
                          .filter(p => names.includes(p.사업부) && selectedYears.includes(Number(p.과제년도)) && !p._deleted)
                          .reduce((total, p) => total + (p.액션아이템목록?.length || 0), 0);
                      })()}
                    </div>
                    <div className="label">액션아이템</div>
                  </StatCard>
                  <StatCard color="#8b5cf6">
                    <div className="number">
                      {(() => {
                        if (selectedDivisions.length === 0 || selectedYears.length === 0) return 0;
                        const names = getSelectedDivisionNames();
                        return projects
                          .filter(p => names.includes(p.사업부) && selectedYears.includes(Number(p.과제년도)) && !p._deleted)
                          .reduce((total, p) => total + (p.과제참여인력목록?.length || 0), 0);
                      })()}
                    </div>
                    <div className="label">팀 멤버</div>
                  </StatCard>
                </StatsGrid>
              </DataSummary>

              {/* 저장 형식별 안내 */}
              <InfoBox>
                <Info size={16} color="#2563eb" />
                <div className="content">
                  {storageFormat === 'json' ? (
                    <div>
                      <div className="title">JSON 저장 방식:</div>
                      <div>모든 데이터가 원본 구조 그대로 저장되어 완전한 복원이 가능합니다.</div>
                    </div>
                  ) : storageFormat === 'excel' ? (
                    <div>
                      <div className="title">Excel 저장 방식:</div>
                      <div>1열 사업부, 2열 프로세스, 3열 과제영역으로 정리된 .xlsx 파일이 저장됩니다. 헤더는 옅은 파란색 배경의 2줄 구조입니다.</div>
                    </div>
                  ) : (
                    <div>
                      <div className="title">CSV 저장 방식:</div>
                      {csvMode === EXPORT_MODES.MULTI_TABLE ? (
                        <div>
                          <div>5개 테이블로 분리 저장:</div>
                          <div className="list">
                            <div>• [GLOBAL_PERFORMANCES]: 글로벌 성과 항목 목록</div>
                            <div>• [PROJECTS]: 기본 프로젝트 정보 (과제명, 사업부, PL담당자 등)</div>
                            <div>• [PROJECT_PERFORMANCE_LINKS]: 과제-성과 연결 (project_id + performance_id)</div>
                            <div>• [ACTION_ITEMS]: 액션아이템 (project_id로 연결)</div>
                            <div>• [TEAM_MEMBERS]: 팀 멤버 (project_id로 연결)</div>
                          </div>
                        </div>
                      ) : (
                        <div>기존 방식으로 모든 데이터가 하나의 테이블에 저장됩니다.</div>
                      )}
                    </div>
                  )}
                </div>
              </InfoBox>
            </Section>
          </ContentGrid>
        </ModalBody>

        {/* 푸터 */}
        <ModalFooter>
          <FooterInfo>
            {selectedDivisions.length > 0 && selectedYears.length > 0 ? (
              <>
                사업부 {selectedDivisions.length}개 · 연도 {selectedYears.sort().join(', ')} /
                프로젝트 {(() => {
                  const names = getSelectedDivisionNames();
                  return projects.filter(p =>
                    names.includes(p.사업부) && selectedYears.includes(Number(p.과제년도)) && !p._deleted
                  ).length;
                })()}개를
                {' '}{storageFormat.toUpperCase()}로 저장
              </>
            ) : (
              '사업부와 연도를 선택해주세요'
            )}
          </FooterInfo>

          <ButtonGroup>
            <Button className="cancel" onClick={onClose} disabled={isSaving}>
              취소
            </Button>

            <Button
              className="save"
              onClick={handleLocalSave}
              disabled={isSaving || projects.length === 0 || selectedDivisions.length === 0 || selectedYears.length === 0}
            >
              {isSaving ? (
                <>
                  <Spinner />
                  <span>저장 중...</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>로컬 저장</span>
                </>
              )}
            </Button>
          </ButtonGroup>
        </ModalFooter>
      </ModalContainer>
    </ModalOverlay>
  );
};

export default LocalStorageModal;