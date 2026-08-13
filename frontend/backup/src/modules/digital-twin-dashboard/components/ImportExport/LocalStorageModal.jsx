import React, { useState } from 'react';
import styled from 'styled-components';
import { X, Save, Download, Database, FileText, Check, AlertCircle, Info } from 'lucide-react';
import { 
  exportProjectsToJSON, 
  exportProjectsToCSV,
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
  grid-template-columns: 1fr 1fr;
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

const LocalStorageModal = ({ 
  isOpen, 
  onClose, 
  projects = [],
  performances = [],
  onSaveComplete 
}) => {
  const [storageFormat, setStorageFormat] = useState('json');
  const [csvMode, setCsvMode] = useState(EXPORT_MODES.MULTI_TABLE);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleLocalSave = () => {
    if (!projects || projects.length === 0) {
      setError('저장할 프로젝트 데이터가 없습니다.');
      return;
    }

    try {
      setIsSaving(true);
      setError('');
      setSaveStatus(null);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `digital-twin-dashboard-${timestamp}`;

      let success = false;

      if (storageFormat === 'json') {
        success = exportProjectsToJSON(projects, performances, filename);
      } else {
        success = exportProjectsToCSV(projects, filename, csvMode);
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
                      <div className="subtitle">구조화된 데이터</div>
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
                      <div className="subtitle">Excel 호환</div>
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
            </Section>

            {/* 오른쪽: 데이터 요약 */}
            <Section>
              <SectionTitle>📊 저장될 데이터</SectionTitle>
              
              <DataSummary>
                <StatsGrid>
                  <StatCard color="#2563eb">
                    <div className="number">{projects.length}</div>
                    <div className="label">프로젝트</div>
                  </StatCard>
                  <StatCard color="#10b981">
                    <div className="number">
                      {projects.reduce((total, p) => total + (p.성과목록?.length || 0), 0)}
                    </div>
                    <div className="label">성과 항목</div>
                  </StatCard>
                </StatsGrid>
                
                <StatsGrid>
                  <StatCard color="#f59e0b">
                    <div className="number">
                      {projects.reduce((total, p) => total + (p.액션아이템목록?.length || 0), 0)}
                    </div>
                    <div className="label">액션아이템</div>
                  </StatCard>
                  <StatCard color="#8b5cf6">
                    <div className="number">
                      {projects.reduce((total, p) => total + (p.과제참여인력목록?.length || 0), 0)}
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
                  ) : (
                    <div>
                      <div className="title">CSV 저장 방식:</div>
                      {csvMode === EXPORT_MODES.MULTI_TABLE ? (
                        <div>
                          <div>4개 테이블로 분리 저장:</div>
                          <div className="list">
                            <div>• [PROJECTS]: 기본 프로젝트 정보</div>
                            <div>• [PERFORMANCES]: 성과 데이터</div>
                            <div>• [ACTION_ITEMS]: 액션아이템 (제목, 완료여부)</div>
                            <div>• [TEAM_MEMBERS]: 팀 멤버 (이름, 부서)</div>
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
            총 {projects.length}개 프로젝트를 {storageFormat.toUpperCase()}로 저장
          </FooterInfo>
          
          <ButtonGroup>
            <Button className="cancel" onClick={onClose} disabled={isSaving}>
              취소
            </Button>
            
            <Button 
              className="save" 
              onClick={handleLocalSave}
              disabled={isSaving || projects.length === 0}
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