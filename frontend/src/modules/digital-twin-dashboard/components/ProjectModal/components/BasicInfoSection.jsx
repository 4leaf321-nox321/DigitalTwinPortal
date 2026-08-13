import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Building, FileText, Calendar, ClipboardList, BarChart3 } from 'lucide-react';
import DetailInfoModal from './DetailInfoModal';
import MonthlyProgressModal from './MonthlyProgressModal';
import { projectCompletedYmd } from '../../../../../shared/utils/localDate';
// 숫자 0 과 미입력은 다른 뜻이다. `|| ''` 로 다루면 0 이 빈칸으로 보인다.
import { levelText } from '../../../utils/levelValue';

// ISO 시각 → datetime-local input 값(로컬 타임 'YYYY-MM-DDTHH:mm')
const toLocalInputValue = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const FourColumnRow = styled.div`
  display: grid;
  grid-template-columns: 0.8fr 1fr 1fr 2fr;
  gap: 0.75rem;

  @media (max-width: 1024px) {
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;

    > div:nth-child(n+3) {
      grid-column: span 1;
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
  grid-template-columns: 1fr 1fr 1fr;
  gap: 1.5rem;

  @media (max-width: 1024px) {
    grid-template-columns: 1fr 1fr;
  }

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

const DetailInfoButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.75rem 1rem;
  border: 2px dashed #d1d5db;
  border-radius: 0.5rem;
  background: #f9fafb;
  color: #374151;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: #10b981;
    background: #f0fdf4;
    color: #059669;
  }

  @media (max-width: 768px) {
    padding: 0.625rem 0.875rem;
    font-size: 0.8rem;
  }
`;

const BasicInfoSection = ({
  formData,
  handleInputChange,
  isAdmin,
  errors,
  divisionOptions,
  processOptions,
  domainOptions,
  categoryOptions,
  statusOptions,
  monthOptions,
  showError,
  onSaveAndUpload,
  autoOpenDetailInfo = false,
  // [Phase 1-2] 보고서 이미지를 서버에 올릴 때 필요한 과제 식별자.
  //   formData 에는 uuid 가 없다(화이트리스트로 만들어짐). 부모에서 project 로부터 받아 넘긴다.
  //   신규 과제 추가 화면에서는 아직 없으므로 undefined 이고, 그때는 base64 로 임시 보관한다.
  projectId
}) => {
  const [isDetailInfoModalOpen, setIsDetailInfoModalOpen] = useState(false);
  const [isMonthlyProgressModalOpen, setIsMonthlyProgressModalOpen] = useState(false);

  useEffect(() => {
    if (autoOpenDetailInfo) {
      setIsDetailInfoModalOpen(true);
    }
  }, [autoOpenDetailInfo]);

  // 액션아이템 기반 진행률 계산 함수 (액션아이템별 동일 기여도 방식)
  // 각 액션아이템이 동일한 기여도(100% / 액션아이템 수)를 가지고,
  // 해당 기여도 내에서 세부항목별로 비율을 분배
  const calculateProgressFromActionItems = (actionItems) => {
    if (!actionItems || actionItems.length === 0) {
      return null; // 액션아이템이 없으면 수동 입력
    }

    const actionItemCount = actionItems.length;
    const contributionPerActionItem = 100 / actionItemCount; // 각 액션 아이템의 기여도

    let totalProgress = 0;

    actionItems.forEach(item => {
      const detailItems = item.세부항목목록 || [];

      if (detailItems.length > 0) {
        // 세부 항목이 있으면 해당 액션 아이템의 기여도를 세부 항목별로 분배
        const completedDetails = detailItems.filter(detail => detail.완료여부).length;
        const progressForThisItem = (completedDetails / detailItems.length) * contributionPerActionItem;
        totalProgress += progressForThisItem;
      } else {
        // 세부 항목이 없으면 액션아이템 자체의 완료여부로 계산
        if (item.완료여부) {
          totalProgress += contributionPerActionItem;
        }
      }
    });

    return Math.round(totalProgress); // 소수점 제거하고 정수로 반환
  };
  
  // 액션아이템에서 진행률을 계산할 수 있는지 확인
  //
  // 액션아이템이 있으면 진행률은 거기서 나온다. **진행상태는 이 계산에 관여하지 않는다.**
  // 예전에는 `정상진행`·`지연` 일 때만 계산해서, 상태를 `완료` 로 바꿔 두면 진행률이
  // 액션아이템과 무관하게 굳었다. 이제 서버가 같은 규칙으로 파생시키므로(routes_v2
  // derive_progress) 여기 조건이 남아 있으면 화면 미리보기만 서버와 갈린다.
  const canCalculateProgressFromActionItems = () => {
    return formData.액션아이템목록 && formData.액션아이템목록.length > 0;
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
        //
        // **세부항목까지 같이 켜야 한다.** 상위만 켜면 서버가 세부항목에서 상위
        // 완료여부를 다시 파생시키면서 도로 미완료가 되고, 진행상태와 어긋나
        // 저장이 400 으로 거절된다(routes_v2 _status_conflict).
        // 완료일 규칙은 shared/utils/localDate 한 곳에 있다 — 액션아이템 탭에서
        // 체크할 때와 같은 날짜가 나와야 한다. 이미 들어 있는 날짜는 실제로 끝난
        // 날이므로 덮지 않는다.
        if (formData.액션아이템목록 && formData.액션아이템목록.length > 0) {
          const doneDate = projectCompletedYmd(formData.과제년도);
          const updatedActionItems = formData.액션아이템목록.map(item => ({
            ...item,
            완료여부: true,
            완료일: item.완료일 || doneDate,
            세부항목목록: (item.세부항목목록 || []).map(detail => ({
              ...detail,
              완료여부: true,
              완료일: detail.완료일 || doneDate
            }))
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
      if (showError) {
        showError('미착수, 미배정, 계획 상태에서는 진행률을 0%로 설정해야 합니다.');
      }
      return;
    }
    if (currentStatus === '완료' && numericValue !== 100) {
      if (showError) {
        showError('완료 상태에서는 진행률을 100%로 설정해야 합니다.');
      }
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
      
      {/* 첫 번째 줄: 과제년도, 사업부 */}
      <TwoColumnRow>
        <FormGroup>
          <Label>
            <Calendar size={16} />
            년도
          </Label>
          <Input
            type="number"
            name="과제년도"
            value={formData.과제년도 || ''}
            onChange={handleInputChange}
            placeholder="예: 2026"
            min="2020"
            max="2100"
          />
        </FormGroup>

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
      </TwoColumnRow>

      {/* 두 번째 줄: 프로세스, 과제영역, 과제구분 */}
      <ThreeColumnRow>
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
          <Label>과제 영역</Label>
          <Select
            name="과제영역"
            value={formData.과제영역 || ''}
            onChange={handleInputChange}
          >
            <option value="">영역 선택</option>
            {domainOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </Select>
          {errors.과제영역 && <ErrorMessage>{errors.과제영역}</ErrorMessage>}
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

      {/* 세 번째 줄: 과제명 */}
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

      {/* 네 번째 줄: 진행상태, 진행률, 진행기간 */}
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
            {/* 필수가 아니다 — 비우면 '미입력'으로 남는다 (formUtils.validateForm 참조) */}
            진행률
          </Label>
          {/*
            진행률 값은 `|| ''` 로 다루면 안 된다 — **0 이 빈칸으로 보인다.**
            placeholder 의 회색 0 과 겹쳐 미입력처럼 읽히는데, 저장하면 0 이 들어간다
            (formUtils.processFormData). 화면과 저장될 값을 맞춘다. (2026-08-06)
          */}
          <div style={{ position: 'relative' }}>
            <Input
              type="number"
              name="진행률"
              value={levelText(formData.진행률)}
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

      {/* 취소 전환 시각 (진행상태가 '취소'일 때만) — 표시 + 관리자 수정 */}
      {formData.진행상태 === '취소' && (
        <FormGroup>
          <Label>
            <Calendar size={16} />
            취소 전환 시각
          </Label>
          {isAdmin ? (
            <>
              <Input
                type="datetime-local"
                name="_canceledAt"
                value={toLocalInputValue(formData._canceledAt)}
                onChange={(e) => {
                  const v = e.target.value;
                  const iso = v ? new Date(v).toISOString() : '';
                  handleInputChange({ target: { name: '_canceledAt', value: iso } });
                }}
              />
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                관리자만 수정 가능 · 비워두면 저장 시 자동 기록됩니다
              </div>
            </>
          ) : (
            <div style={{ padding: '0.5rem 0', fontSize: '0.9rem', color: formData._canceledAt ? '#374151' : '#9ca3af' }}>
              {formData._canceledAt ? new Date(formData._canceledAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '저장 시 자동 기록됩니다'}
            </div>
          )}
        </FormGroup>
      )}

      {/* 다섯 번째 줄: PoC 과제 여부, 중점 과제 여부 */}
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

        <CheckboxGroup>
          <Label>사업부 내 공개</Label>
          <CheckboxContainer
            className={formData.사업부내공개여부 ? 'checked' : ''}
            onClick={() => {
              const fakeEvent = {
                target: {
                  name: '사업부내공개여부',
                  type: 'checkbox',
                  value: 'on',
                  checked: !formData.사업부내공개여부
                }
              };
              handleInputChange(fakeEvent);
            }}
          >
            <Checkbox
              type="checkbox"
              name="사업부내공개여부"
              checked={!!formData.사업부내공개여부}
              onChange={handleInputChange}
              onClick={(e) => e.stopPropagation()}
            />
            <CheckboxLabelContent>
              <div className="main-text">사업부 내 공개</div>
              <div className="sub-text">같은 사업부 사용자에게만 노출</div>
            </CheckboxLabelContent>
          </CheckboxContainer>
        </CheckboxGroup>
      </CheckboxRow>

      {/* 상세 과제 정보 입력 버튼 */}
      <DetailInfoButton type="button" onClick={() => setIsDetailInfoModalOpen(true)}>
        <ClipboardList size={16} />
        상세 과제 정보 입력
      </DetailInfoButton>

      {/* 상세 과제 정보 모달 */}
      <DetailInfoModal
        isOpen={isDetailInfoModalOpen}
        onClose={() => setIsDetailInfoModalOpen(false)}
        formData={formData}
        handleInputChange={handleInputChange}
        onSaveAndUpload={onSaveAndUpload}
        projectId={projectId}
      />

      {/* 월간 진척 현황 요약 버튼 */}
      <DetailInfoButton type="button" onClick={() => setIsMonthlyProgressModalOpen(true)}>
        <BarChart3 size={16} />
        월간 진척 현황 요약
      </DetailInfoButton>

      {/* 월간 진척 현황 요약 모달 */}
      <MonthlyProgressModal
        isOpen={isMonthlyProgressModalOpen}
        onClose={() => setIsMonthlyProgressModalOpen(false)}
        formData={formData}
        handleInputChange={handleInputChange}
      />
    </SectionContainer>
  );
};

export default BasicInfoSection;