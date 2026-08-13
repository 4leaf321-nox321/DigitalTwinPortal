import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { X, User, Users, Calendar, BarChart3, Tag, FileText, AlertTriangle, Link } from 'lucide-react';

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
`;

const ModalContent = styled.div`
  background: white;
  border-radius: 16px;
  width: 90%;
  max-width: 1200px; /* 더 넓게 변경 */
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
`;

const ModalHeader = styled.div`
  padding: 24px 32px 0;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
  border-radius: 16px 16px 0 0;
  
  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 20px;
  }
  
  .title {
    font-size: 24px;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }
  
  .subtitle {
    font-size: 14px;
    color: #6b7280;
    margin-top: 4px;
  }
`;

const CloseButton = styled.button`
  width: 40px;
  height: 40px;
  border: none;
  background: #f3f4f6;
  border-radius: 8px;
  color: #6b7280;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s ease;
  font-size: 20px;
  font-weight: 400;
  line-height: 1;
  
  svg {
    width: 20px;
    height: 20px;
    stroke-width: 2;
  }
  
  &:hover {
    background: #e5e7eb;
    color: #374151;
  }
  
  &:active {
    transform: scale(0.95);
  }
`;

const ModalBody = styled.div`
  padding: 32px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
  
  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    gap: 32px;
  }
`;

const LeftColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 32px;
`;

const RightColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 32px;
`;

const FormSection = styled.div`
  margin-bottom: 0;
`;

const SectionTitle = styled.h3`
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 16px 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
  
  &.two-column {
    grid-template-columns: 1fr 1fr;
    
    @media (max-width: 640px) {
      grid-template-columns: 1fr;
    }
  }
`;

const FormField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Label = styled.label`
  font-size: 14px;
  font-weight: 500;
  color: #374151;
`;

const Input = styled.input`
  padding: 12px 16px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.2s ease;
  
  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
`;

const TextArea = styled.textarea`
  padding: 12px 16px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  resize: vertical;
  min-height: 100px;
  font-family: inherit;
  transition: all 0.2s ease;
  
  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
`;

const Select = styled.select`
  padding: 12px 16px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  background: white;
  transition: all 0.2s ease;
  
  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
`;

const ProgressContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const ProgressBar = styled.div`
  flex: 1;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  
  .progress-fill {
    height: 100%;
    background: #3b82f6;
    transition: width 0.3s ease;
  }
`;

const ProgressInput = styled.input`
  width: 80px;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  text-align: center;
  
  &:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
`;

const TagsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
`;

const TagItem = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #e0e7ff;
  color: #3730a3;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
`;

const RemoveTagButton = styled.button`
  border: none;
  background: none;
  color: #6366f1;
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;
  line-height: 1;
  
  &:hover {
    color: #4f46e5;
  }
`;

const ModalFooter = styled.div`
  padding: 24px 32px;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
  border-radius: 0 0 16px 16px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
`;

const Button = styled.button`
  padding: 12px 24px;
  border: 1px solid ${props => props.primary ? '#3b82f6' : '#d1d5db'};
  background: ${props => props.primary ? '#3b82f6' : 'white'};
  color: ${props => props.primary ? 'white' : '#374151'};
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${props => props.primary ? '#2563eb' : '#f9fafb'};
    border-color: ${props => props.primary ? '#2563eb' : '#9ca3af'};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const STATUS_OPTIONS = [
  { value: 'not_started', label: '시작 안함', color: '#6b7280' },
  { value: 'in_progress', label: '진행 중', color: '#3b82f6' },
  { value: 'review', label: '검토 중', color: '#f59e0b' },
  { value: 'completed', label: '완료', color: '#10b981' },
  { value: 'blocked', label: '차단됨', color: '#ef4444' }
];

const CATEGORY_OPTIONS = [
  { value: 'cae_development', label: 'CAE Development' },
  { value: 'program_development', label: 'Program Development' },
  { value: 'platform_development', label: 'Platform Development' },
  { value: 'testing', label: 'Testing' },
  { value: 'documentation', label: 'Documentation' }
];

const ProcessDetailModal = ({ isOpen, onClose, onSave, process = null, mode = 'add' }) => {
  const [formData, setFormData] = useState({
    text: '',
    primaryOwner: '',
    collaborators: '',
    status: 'not_started',
    progress: 0,
    category: 'cae_development',
    tags: '',
    description: '',
    risks: '',
    referenceLinks: ''
  });
  
  const [tagInput, setTagInput] = useState('');
  const [parsedTags, setParsedTags] = useState([]);

  useEffect(() => {
    if (process) {
      setFormData({
        text: process.text || '',
        primaryOwner: process.primaryOwner || '',
        collaborators: process.collaborators || '',
        status: process.status || 'not_started',
        progress: process.progress || 0,
        category: process.category || 'cae_development',
        tags: process.tags || '',
        description: process.description || '',
        risks: process.risks || '',
        referenceLinks: process.referenceLinks || ''
      });
      
      const tags = process.tags ? process.tags.split(',').map(tag => tag.trim()).filter(Boolean) : [];
      setParsedTags(tags);
    } else {
      // 새로 추가하는 경우 기본값으로 리셋
      setFormData({
        text: '',
        primaryOwner: '',
        collaborators: '',
        status: 'not_started',
        progress: 0,
        category: 'cae_development',
        tags: '',
        description: '',
        risks: '',
        referenceLinks: ''
      });
      setParsedTags([]);
    }
    setTagInput('');
  }, [process, isOpen]);

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleProgressChange = (value) => {
    const numValue = Math.max(0, Math.min(100, parseInt(value) || 0));
    handleChange('progress', numValue);
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !parsedTags.includes(tagInput.trim())) {
      const newTags = [...parsedTags, tagInput.trim()];
      setParsedTags(newTags);
      setFormData(prev => ({
        ...prev,
        tags: newTags.join(', ')
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    const newTags = parsedTags.filter(tag => tag !== tagToRemove);
    setParsedTags(newTags);
    setFormData(prev => ({
      ...prev,
      tags: newTags.join(', ')
    }));
  };

  const handleTagInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSave = () => {
    if (!formData.text.trim()) {
      alert('프로세스 이름을 입력해주세요.');
      return;
    }
    
    const processData = {
      ...formData,
      progress: parseInt(formData.progress) || 0
    };
    
    onSave(processData);
  };

  if (!isOpen) return null;

  return (
    <ModalOverlay>
      <ModalContent>
        <ModalHeader>
          <div className="header-content">
            <div>
              <h2 className="title">
                {mode === 'add' ? '새 프로세스 추가' : '프로세스 상세 정보'}
              </h2>
              <p className="subtitle">
                프로세스의 상세 정보를 입력하거나 수정하세요
              </p>
            </div>
            <CloseButton onClick={onClose} title="모달 닫기">
              ×
            </CloseButton>
          </div>
        </ModalHeader>

        <ModalBody>
          {/* 좌측 컬럼 */}
          <LeftColumn>
            {/* 기본 정보 */}
            <FormSection>
              <SectionTitle>
                <FileText size={20} />
                기본 정보
              </SectionTitle>
              <FormGrid className="two-column">
                <FormField>
                  <Label>프로세스 이름 *</Label>
                  <Input
                    type="text"
                    value={formData.text}
                    onChange={(e) => handleChange('text', e.target.value)}
                    placeholder="프로세스 이름을 입력하세요"
                    maxLength={100}
                  />
                </FormField>
                <FormField>
                  <Label>카테고리</Label>
                  <Select
                    value={formData.category}
                    onChange={(e) => handleChange('category', e.target.value)}
                  >
                    {CATEGORY_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </FormGrid>
            </FormSection>

            {/* 담당자 정보 */}
            <FormSection>
              <SectionTitle>
                <Users size={20} />
                담당자 정보
              </SectionTitle>
              <FormGrid className="two-column">
                <FormField>
                  <Label>담당자 (Primary Owner)</Label>
                  <Input
                    type="text"
                    value={formData.primaryOwner}
                    onChange={(e) => handleChange('primaryOwner', e.target.value)}
                    placeholder="담당자 이름을 입력하세요"
                  />
                </FormField>
                <FormField>
                  <Label>협업자 (Collaborators)</Label>
                  <Input
                    type="text"
                    value={formData.collaborators}
                    onChange={(e) => handleChange('collaborators', e.target.value)}
                    placeholder="협업자들을 쉼표로 구분하여 입력하세요"
                  />
                </FormField>
              </FormGrid>
            </FormSection>

            {/* 상태 및 진행률 */}
            <FormSection>
              <SectionTitle>
                <BarChart3 size={20} />
                상태 및 진행률
              </SectionTitle>
              <FormGrid className="two-column">
                <FormField>
                  <Label>진행 상태</Label>
                  <Select
                    value={formData.status}
                    onChange={(e) => handleChange('status', e.target.value)}
                  >
                    {STATUS_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField>
                  <Label>완료율 (%)</Label>
                  <ProgressContainer>
                    <ProgressBar>
                      <div 
                        className="progress-fill" 
                        style={{ width: `${formData.progress}%` }}
                      />
                    </ProgressBar>
                    <ProgressInput
                      type="number"
                      min="0"
                      max="100"
                      value={formData.progress}
                      onChange={(e) => handleProgressChange(e.target.value)}
                    />
                    <span>%</span>
                  </ProgressContainer>
                </FormField>
              </FormGrid>
            </FormSection>

            {/* 태그 */}
            <FormSection>
              <SectionTitle>
                <Tag size={20} />
                태그
              </SectionTitle>
              <FormField>
                <Label>태그 추가</Label>
                <Input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={handleTagInputKeyPress}
                  placeholder="태그를 입력하고 Enter를 누르세요"
                  onBlur={handleAddTag}
                />
                {parsedTags.length > 0 && (
                  <TagsContainer>
                    {parsedTags.map((tag, index) => (
                      <TagItem key={index}>
                        {tag}
                        <RemoveTagButton onClick={() => handleRemoveTag(tag)}>
                          ×
                        </RemoveTagButton>
                      </TagItem>
                    ))}
                  </TagsContainer>
                )}
              </FormField>
            </FormSection>
          </LeftColumn>
          
          {/* 우측 컬럼 */}
          <RightColumn>
            {/* 상세 설명 */}
            <FormSection>
              <SectionTitle>
                <FileText size={20} />
                상세 정보
              </SectionTitle>
              <FormField>
                <Label>상세 설명</Label>
                <TextArea
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="프로세스에 대한 상세한 설명을 입력하세요"
                  style={{ minHeight: '150px' }}
                />
              </FormField>
            </FormSection>

            {/* 위험 요소 */}
            <FormSection>
              <SectionTitle>
                <AlertTriangle size={20} />
                위험 요소
              </SectionTitle>
              <FormField>
                <Label>위험 요소</Label>
                <TextArea
                  value={formData.risks}
                  onChange={(e) => handleChange('risks', e.target.value)}
                  placeholder="이 프로세스와 관련된 위험 요소를 입력하세요"
                  style={{ minHeight: '120px' }}
                />
              </FormField>
            </FormSection>

            {/* 참고 링크 */}
            <FormSection>
              <SectionTitle>
                <Link size={20} />
                참고 자료
              </SectionTitle>
              <FormField>
                <Label>참고 링크/문서</Label>
                <TextArea
                  value={formData.referenceLinks}
                  onChange={(e) => handleChange('referenceLinks', e.target.value)}
                  placeholder="관련 링크나 문서를 한 줄씩 입력하세요"
                  style={{ minHeight: '120px' }}
                />
              </FormField>
            </FormSection>
          </RightColumn>
        </ModalBody>

        <ModalFooter>
          <Button onClick={onClose}>취소</Button>
          <Button primary onClick={handleSave}>
            {mode === 'add' ? '추가' : '저장'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </ModalOverlay>
  );
};

export default ProcessDetailModal;