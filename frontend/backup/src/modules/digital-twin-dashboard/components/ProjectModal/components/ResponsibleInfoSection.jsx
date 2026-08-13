import React, { useRef } from 'react';
import styled from 'styled-components';
import { User, Building, ShieldCheck, Plus } from 'lucide-react';

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
  width: 100%;
  min-width: 0;
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
  width: 100%;
  box-sizing: border-box;
  
  &:focus {
    outline: none;
    border-color: #10b981;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
  }
  
  &:invalid {
    border-color: #ef4444;
  }
  
  @media (max-width: 768px) {
    padding: 0.625rem 0.875rem;
    font-size: 0.8rem;
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

const PersonnelInputContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  background: #f9fafb;
  
  .input-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    align-items: end;
    
    @media (max-width: 1200px) {
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
    }
    
    @media (max-width: 768px) {
      grid-template-columns: 1fr;
      gap: 0.75rem;
      
      > div {
        grid-column: 1;
      }
    }
  }
  
  .button-row {
    display: flex;
    justify-content: center;
    padding-top: 0.5rem;
    border-top: 1px solid #e5e7eb;
    margin-top: 0.5rem;
  }
  
  @media (max-width: 768px) {
    padding: 0.75rem;
  }
`;

const AddButton = styled.button`
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border: none;
  border-radius: 0.5rem;
  padding: 0.75rem 1.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  &:hover {
    background: linear-gradient(135deg, #059669 0%, #047857 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
  
  @media (max-width: 768px) {
    padding: 0.625rem 1.25rem;
    font-size: 0.8rem;
  }
`;

const ItemList = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  margin-top: 1rem;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
`;

const ListItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  min-width: 0;
  
  .item-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
    min-width: 0;
    
    .main-text {
      font-weight: 600;
      color: #374151;
      font-size: 0.875rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .sub-text {
      color: #6b7280;
      font-size: 0.8rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
  
  @media (max-width: 768px) {
    padding: 0.625rem 0.75rem;
    
    .item-info {
      .main-text {
        font-size: 0.8rem;
      }
      
      .sub-text {
        font-size: 0.75rem;
      }
    }
  }
`;

const RemoveButton = styled.button`
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 0.375rem;
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
  font-size: 1.25rem;
  font-weight: bold;
  line-height: 1;
  
  &:hover {
    background: #dc2626;
    transform: scale(1.05);
  }
  
  &:disabled {
    background: #d1d5db;
    color: #9ca3af;
    cursor: not-allowed;
    transform: none;
  }
  
  @media (max-width: 768px) {
    width: 2rem;
    height: 2rem;
    font-size: 1rem;
  }
`;

const ResponsibleInfoSection = ({ 
  formData, 
  handleInputChange, 
  errors,
  personnelInput,
  handlePersonnelInputChange,
  addPersonnelToList,
  removePersonnelFromList,
  removeDepartmentFromList
}) => {
  const nameInputRef = useRef(null);
  
  const handleAddPersonnel = () => {
    addPersonnelToList();
    // 인력 추가 후 이름 필드로 포커스 이동
    setTimeout(() => {
      if (nameInputRef.current) {
        nameInputRef.current.focus();
      }
    }, 100);
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (personnelInput.이름 && personnelInput.부서) {
        handleAddPersonnel();
      }
    }
  };

  return (
    <SectionContainer>
      <SectionTitle>
        <User size={16} />
        담당 정보
      </SectionTitle>
      
      <FormGroup>
        <Label>
          <ShieldCheck size={16} />
          과제 PL <span className="required">*</span>
        </Label>
        <Input
          type="text"
          name="과제PL"
          value={formData.과제PL || ''}
          onChange={handleInputChange}
          placeholder="과제 PL 이름을 입력하세요"
          required
        />
        {errors.과제PL && <ErrorMessage>{errors.과제PL}</ErrorMessage>}
      </FormGroup>

      {/* 과제 참여 인력 입력 */}
      <FormGroup>
        <Label>과제 참여 인력 입력</Label>
        <PersonnelInputContainer>
          <div className="input-row">
            <div>
              <Label>
                <User size={16} />
                이름 <span className="required">*</span>
              </Label>
              <Input
                ref={nameInputRef}
                type="text"
                value={personnelInput.이름 || ''}
                onChange={(e) => handlePersonnelInputChange('이름', e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="참여 인력 이름"
              />
            </div>
            
            <div>
              <Label>
                <Building size={16} />
                부서 <span className="required">*</span>
              </Label>
              <Input
                type="text"
                value={personnelInput.부서 || ''}
                onChange={(e) => handlePersonnelInputChange('부서', e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Lab 또는 그룹 입력"
              />
            </div>
          </div>

          <div className="button-row">
            <AddButton
              type="button"
              onClick={handleAddPersonnel}
              disabled={!personnelInput.이름 || !personnelInput.부서}
            >
              <Plus size={16} />
              인력 추가
            </AddButton>
          </div>
        </PersonnelInputContainer>
      </FormGroup>

      {/* 등록된 과제 참여 인력 목록 */}
      {formData.과제참여인력목록 && formData.과제참여인력목록.length > 0 && (
        <FormGroup>
          <Label>등록된 과제 참여 인력 ({formData.과제참여인력목록.length}명)</Label>
          <ItemList>
            {formData.과제참여인력목록.map((person, index) => (
              <ListItem key={index}>
                <div className="item-info">
                  <div className="main-text">{person.이름}</div>
                  <div className="sub-text">
                    {person.부서}
                  </div>
                </div>
                <RemoveButton
                  type="button"
                  onClick={() => removePersonnelFromList(index)}
                  title="인력 삭제"
                >
                  ×
                </RemoveButton>
              </ListItem>
            ))}
          </ItemList>
        </FormGroup>
      )}

      {/* 담당부서 목록 (자동으로 생성됨) */}
      {formData.담당부서목록 && formData.담당부서목록.length > 0 && (
        <FormGroup>
          <Label>
            <Building size={16} />
            담당부서 ({formData.담당부서목록.length}개)
          </Label>
          <ItemList>
            {formData.담당부서목록.map((dept, index) => (
              <ListItem key={index}>
                <div className="item-info">
                  <div className="main-text">{dept}</div>
                  <div className="sub-text">
                    {formData.과제참여인력목록 ? formData.과제참여인력목록.filter(person => person.부서 === dept).length : 0}명 참여
                  </div>
                </div>
                <RemoveButton
                  type="button"
                  onClick={() => removeDepartmentFromList(index)}
                  title="부서 삭제 (해당 부서 소속 인력도 함께 삭제됩니다)"
                >
                  ×
                </RemoveButton>
              </ListItem>
            ))}
          </ItemList>
        </FormGroup>
      )}

      <FormGroup>
        <Label>
          <User size={16} />
          작성자
        </Label>
        <Input
          type="text"
          name="작성자"
          value={formData.작성자 || ''}
          onChange={handleInputChange}
          placeholder="작성자 이름을 입력하세요"
        />
      </FormGroup>

      {errors.과제참여인력목록 && <ErrorMessage>{errors.과제참여인력목록}</ErrorMessage>}
      {errors.담당부서목록 && <ErrorMessage>{errors.담당부서목록}</ErrorMessage>}
    </SectionContainer>
  );
};

export default ResponsibleInfoSection;