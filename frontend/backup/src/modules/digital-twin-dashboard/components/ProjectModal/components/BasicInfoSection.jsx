import React from 'react';
import styled from 'styled-components';
import { Building, FileText, Calendar } from 'lucide-react';

const ThreeColumnRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 2fr;
  gap: 0.75rem;
  
  @media (max-width: 1024px) {
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    
    > div:nth-child(3) {
      grid-column: 1 / -1;
    }
  }
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 0.75rem;
    
    > div {
      grid-column: 1;
    }
  }
`;

const TwoColumnRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
`;

const FullWidthRow = styled.div`
  width: 100%;
`;

const CheckboxRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
`;

const CheckboxGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const CheckboxContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  padding: 0.75rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  background: #f9fafb;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: #10b981;
    background: #f0fdf4;
  }
  
  &.checked {
    border-color: #10b981;
    background: #ecfdf5;
  }
  
  @media (max-width: 768px) {
    padding: 0.625rem 0.875rem;
  }
`;

const Checkbox = styled.input`
  width: 1.25rem;
  height: 1.25rem;
  cursor: pointer;
  accent-color: #10b981;
  
  @media (max-width: 768px) {
    width: 1rem;
    height: 1rem;
  }
`;

const CheckboxLabelContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
  
  .main-text {
    font-weight: 600;
    color: #374151;
    font-size: 0.875rem;
  }
  
  .sub-text {
    color: #6b7280;
    font-size: 0.8rem;
    font-style: italic;
  }
  
  @media (max-width: 768px) {
    .main-text {
      font-size: 0.8rem;
    }
    
    .sub-text {
      font-size: 0.75rem;
    }
  }
`;

const SectionContainer = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  min-width: 0;
  
  @media (max-width: 1200px) {
    flex: none;
    width: 100%;
  }
  
  @media (max-width: 768px) {
    gap: 1rem;
  }
`;

const SectionTitle = styled.h3`
  font-size: 1rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 1rem 0;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #e5e7eb;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  @media (max-width: 768px) {
    font-size: 0.9rem;
    margin-bottom: 0.75rem;
  }
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Label = styled.label`
  font-weight: 600;
  color: #374151;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  
  .required {
    color: #ef4444;
  }
  
  @media (max-width: 768px) {
    font-size: 0.8rem;
  }
`;

const Input = styled.input`
  padding: 0.75rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  transition: all 0.2s ease;
  min-width: 0;
  
  &:focus {
    outline: none;
    border-color: #10b981;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
  }
  
  &:invalid {
    border-color: #ef4444;
  }
  
  &:disabled {
    background-color: #f3f4f6;
    color: #9ca3af;
    border-color: #d1d5db;
    cursor: not-allowed;
  }
  
  @media (max-width: 768px) {
    padding: 0.625rem 0.875rem;
    font-size: 0.8rem;
  }
`;

const Select = styled.select`
  padding: 0.75rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  background: white;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 0;
  
  &:focus {
    outline: none;
    border-color: #10b981;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
  }
  
  &:disabled {
    background: #f3f4f6;
    cursor: not-allowed;
  }
  
  @media (max-width: 768px) {
    padding: 0.625rem 0.875rem;
    font-size: 0.8rem;
  }
`;

const DateRangeContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  
  @media (max-width: 768px) {
    gap: 0.75rem;
  }
  
  @media (max-width: 480px) {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
`;

const ErrorMessage = styled.div`
  color: #ef4444;
  font-size: 0.75rem;
  margin-top: 0.25rem;
  word-break: break-word;
  
  @media (max-width: 768px) {
    font-size: 0.7rem;
  }
`;

const BasicInfoSection = ({ 
  formData, 
  handleInputChange, 
  errors, 
  divisionOptions, 
  processOptions, 
  categoryOptions, 
  statusOptions, 
  monthOptions 
}) => {
  // 액션아이템 기반 진행률 계산 함수
  const calculateProgressFromActionItems = (actionItems) => {
    if (!actionItems || actionItems.length === 0) {
      return null; // 액션아이템이 없으면 수동 입력
    }
    
    const completedItems = actionItems.filter(item => item.완료여부).length;
    const totalItems = actionItems.length;
    
    if (totalItems === 0) return 0;
    
    const percentage = (completedItems / totalItems) * 100;
    return Math.round(percentage); // 소수점 제거하고 정수로 반환
  };
  
  // 액션아이템에서 진행률을 계산할 수 있는지 확인
  const canCalculateProgressFromActionItems = () => {
    const status = formData.진행상태;
    return (status === '정상진행' || status === '지연') && 
           formData.액션아이템목록 && 
           formData.액션아이템목록.length > 0;
  };
  
  // 진행률 자동 계산 및 업데이트
  const updateProgressFromActionItems = () => {
    if (canCalculateProgressFromActionItems()) {
      const calculatedProgress = calculateProgressFromActionItems(formData.액션아이템목록);
      if (calculatedProgress !== null && calculatedProgress !== formData.진행률) {
        const syntheticEvent = {
          target: { name: '진행률', value: calculatedProgress }
        };
        handleInputChange(syntheticEvent);
      }
    }
  };
  
  // 액션아이템이 변경될 때마다 진행률 업데이트
  React.useEffect(() => {
    updateProgressFromActionItems();
  }, [formData.액션아이템목록]);

  // 진행상태 변경 시 진행률 자동 설정
  const handleStatusChange = (e) => {
    const { name, value } = e.target;
    
    let updatedFormData = { [name]: value };
    
    // 진행상태에 따른 진행률 자동 설정
    if (name === '진행상태') {
      if (value === '미착수' || value === '미배정' || value === '계획') {
        updatedFormData.진행률 = 0;
      } else if (value === '완료') {
        updatedFormData.진행률 = 100;
        
        // 진행상태가 완료일 때 모든 액션아이템을 완료로 설정
        if (formData.액션아이템목록 && formData.액션아이템목록.length > 0) {
          const updatedActionItems = formData.액션아이템목록.map(item => ({
            ...item,
            완료여부: true
          }));
          updatedFormData.액션아이템목록 = updatedActionItems;
        }
      } else if (value === '정상진행' || value === '지연') {
        // 액션아이템이 있으면 자동 계산, 없으면 기존 값 유지
        if (formData.액션아이템목록 && formData.액션아이템목록.length > 0) {
          const calculatedProgress = calculateProgressFromActionItems(formData.액션아이템목록);
          if (calculatedProgress !== null) {
            updatedFormData.진행률 = calculatedProgress;
          }
        }
        // 액션아이템이 없으면 기존 진행률 유지
      }
    }
    
    // 모든 변경사항을 한 번에 전달
    Object.keys(updatedFormData).forEach(key => {
      const syntheticEvent = {
        target: { name: key, value: updatedFormData[key] }
      };
      handleInputChange(syntheticEvent);
    });
  };
  
  // 진행률 변경 시 유효성 검사
  const handleProgressChange = (e) => {
    const { name, value } = e.target;
    const numericValue = parseFloat(value) || 0;
    
    // 진행상태에 따른 제한 사항 경고
    const currentStatus = formData.진행상태;
    if ((currentStatus === '미착수' || currentStatus === '미배정' || currentStatus === '계획') && numericValue !== 0) {
      alert('미착수, 미배정, 계획 상태에서는 진행률을 0%로 설정해야 합니다.');
      return;
    }
    if (currentStatus === '완료' && numericValue !== 100) {
      alert('완료 상태에서는 진행률을 100%로 설정해야 합니다.');
      return;
    }
    
    handleInputChange(e);
  };

  return (
    <SectionContainer>
      <SectionTitle>
        <Building size={16} />
        기본 정보
      </SectionTitle>
      
      {/* 첫 번째 줄: 사업부, 프로세스, 과제구분 */}
      <ThreeColumnRow>
        <FormGroup>
          <Label>
            <Building size={16} />
            사업부 <span className="required">*</span>
          </Label>
          <Select
            name="사업부"
            value={formData.사업부 || ''}
            onChange={handleInputChange}
            required
          >
            <option value="">사업부 선택</option>
            {divisionOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </Select>
          {errors.사업부 && <ErrorMessage>{errors.사업부}</ErrorMessage>}
        </FormGroup>

        <FormGroup>
          <Label>프로세스 <span className="required">*</span></Label>
          <Select
            name="프로세스"
            value={formData.프로세스 || ''}
            onChange={handleInputChange}
            required
          >
            <option value="">프로세스 선택</option>
            {processOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </Select>
          {errors.프로세스 && <ErrorMessage>{errors.프로세스}</ErrorMessage>}
        </FormGroup>

        <FormGroup>
          <Label>과제 구분 <span className="required">*</span></Label>
          <Select
            name="과제구분"
            value={formData.과제구분 || ''}
            onChange={handleInputChange}
            required
          >
            <option value="">과제 구분 선택</option>
            {categoryOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </Select>
          {errors.과제구분 && <ErrorMessage>{errors.과제구분}</ErrorMessage>}
        </FormGroup>
      </ThreeColumnRow>

      {/* 두 번째 줄: 과제명 */}
      <FullWidthRow>
        <FormGroup>
          <Label>
            <FileText size={16} />
            과제명 <span className="required">*</span>
          </Label>
          <Input
            type="text"
            name="과제명"
            value={formData.과제명 || ''}
            onChange={handleInputChange}
            placeholder="과제명을 입력하세요"
            required
          />
          {errors.과제명 && <ErrorMessage>{errors.과제명}</ErrorMessage>}
        </FormGroup>
      </FullWidthRow>

      {/* 세 번째 줄: 진행상태, 진행률, 진행기간 */}
      <ThreeColumnRow>
        <FormGroup>
          <Label>
            <FileText size={16} />
            진행상태
          </Label>
          <Select
            name="진행상태"
            value={formData.진행상태 || '미착수'}
            onChange={handleStatusChange}
          >
            {statusOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </Select>
        </FormGroup>

        <FormGroup>
          <Label>
            <FileText size={16} />
            진행률 <span className="required">*</span>
          </Label>
          <div style={{ position: 'relative' }}>
            <Input
              type="number"
              name="진행률"
              value={formData.진행률 || ''}
              onChange={handleProgressChange}
              placeholder="0"
              min="0"
              max="100"
              style={{ paddingRight: '2rem' }}
              disabled={(
                formData.진행상태 === '미착수' || 
                formData.진행상태 === '미배정' || 
                formData.진행상태 === '계획' || 
                formData.진행상태 === '완료' ||
                canCalculateProgressFromActionItems()
              )}
            />
            <span style={{
              position: 'absolute',
              right: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#6b7280',
              fontSize: '0.875rem',
              pointerEvents: 'none'
            }}>%</span>
          </div>
          {canCalculateProgressFromActionItems() && (
            <div style={{
              fontSize: '0.7rem',
              color: '#10b981',
              marginTop: '0.25rem',
              fontWeight: '500'
            }}>
              액션아이템 기반 자동 계산
            </div>
          )}
          {errors.진행률 && <ErrorMessage>{errors.진행률}</ErrorMessage>}
        </FormGroup>

        <FormGroup>
          <Label>
            <Calendar size={16} />
            진행 기간
          </Label>
          <DateRangeContainer>
            <Select
              name="시작"
              value={formData.시작 || 1}
              onChange={handleInputChange}
            >
              {monthOptions.map(({ value, label }) => (
                <option key={value} value={value}>{label} 시작</option>
              ))}
            </Select>
            <Select
              name="종료"
              value={formData.종료 || 12}
              onChange={handleInputChange}
            >
              {monthOptions.map(({ value, label }) => (
                <option key={value} value={value}>{label} 종료</option>
              ))}
            </Select>
          </DateRangeContainer>
          {errors.종료 && <ErrorMessage>{errors.종료}</ErrorMessage>}
        </FormGroup>
      </ThreeColumnRow>

      {/* 네 번째 줄: PoC 과제 여부, 중점 과제 여부 */}
      <CheckboxRow>
        <CheckboxGroup>
          <Label>PoC 과제 여부</Label>
          <CheckboxContainer 
            className={formData.PoC과제여부 ? 'checked' : ''}
            onClick={() => {
              const fakeEvent = {
                target: {
                  name: 'PoC과제여부',
                  type: 'checkbox',
                  value: 'on',
                  checked: !formData.PoC과제여부
                }
              };
              handleInputChange(fakeEvent);
            }}
          >
            <Checkbox
              type="checkbox"
              name="PoC과제여부"
              checked={!!formData.PoC과제여부}
              onChange={handleInputChange}
              onClick={(e) => e.stopPropagation()}
            />
            <CheckboxLabelContent>
              <div className="main-text">PoC 과제로 지정</div>
              <div className="sub-text">전사 지정 PoC</div>
            </CheckboxLabelContent>
          </CheckboxContainer>
        </CheckboxGroup>

        <CheckboxGroup>
          <Label>중점 과제 여부</Label>
          <CheckboxContainer 
            className={formData.중점과제여부 ? 'checked' : ''}
            onClick={() => {
              const fakeEvent = {
                target: {
                  name: '중점과제여부',
                  type: 'checkbox',
                  value: 'on',
                  checked: !formData.중점과제여부
                }
              };
              handleInputChange(fakeEvent);
            }}
          >
            <Checkbox
              type="checkbox"
              name="중점과제여부"
              checked={!!formData.중점과제여부}
              onChange={handleInputChange}
              onClick={(e) => e.stopPropagation()}
            />
            <CheckboxLabelContent>
              <div className="main-text">중점 과제로 지정</div>
            </CheckboxLabelContent>
          </CheckboxContainer>
        </CheckboxGroup>
      </CheckboxRow>
    </SectionContainer>
  );
};

export default BasicInfoSection;