import React, { useState } from 'react';
import styled from 'styled-components';
import { CheckSquare, Plus, Trash2, Calendar } from 'lucide-react';

const ActionItemsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  
  @media (max-width: 768px) {
    gap: 0.75rem;
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

const ActionItemCard = styled.div`
  border: 2px solid #e5e7eb;
  border-radius: 0.75rem;
  padding: 1rem;
  margin-bottom: 1rem;
  background: #f9fafb;
  
  @media (max-width: 768px) {
    padding: 0.75rem;
    margin-bottom: 0.75rem;
  }
`;

const ActionItemHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
  gap: 0.75rem;
  
  @media (max-width: 768px) {
    margin-bottom: 0.75rem;
    flex-direction: column;
    gap: 0.5rem;
  }
`;

const TitleAndCheckboxContainer = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  flex: 1;
  
  .checkbox-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    margin-top: 0.125rem;
  }
  
  .checkbox {
    width: 1.25rem;
    height: 1.25rem;
    cursor: pointer;
    accent-color: #10b981;
  }
  
  .checkbox-label {
    font-size: 0.7rem;
    color: #6b7280;
    font-weight: 500;
    text-align: center;
    white-space: nowrap;
  }
`;

const ActionItemTitle = styled.input`
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  
  &:focus {
    outline: none;
    border-color: #10b981;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
  }
  
  &.completed {
    background-color: #f0fdf4;
    color: #6b7280;
  }
  
  @media (max-width: 768px) {
    font-size: 0.8rem;
    padding: 0.4rem 0.6rem;
  }
`;

const DeleteButton = styled.button`
  padding: 0.5rem;
  margin-left: 0.75rem;
  background: #fee2e2;
  color: #dc2626;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;
  transition: all 0.2s ease;
  type: button;
  
  &:hover {
    background: #fecaca;
  }
  
  @media (max-width: 768px) {
    padding: 0.4rem;
    font-size: 0.8rem;
  }
`;

const MonthlyBulletsContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
`;

const MonthCard = styled.div`
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  padding: 0.75rem;
  background: white;
`;

const MonthHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  font-weight: 500;
  color: #374151;
  font-size: 0.875rem;
`;

const BulletList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const BulletItem = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
`;

const BulletInput = styled.input`
  flex: 1;
  padding: 0.375rem 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.8rem;
  
  &:focus {
    outline: none;
    border-color: #10b981;
    box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.1);
  }
  
  @media (max-width: 768px) {
    font-size: 0.75rem;
  }
`;

const RemoveBulletButton = styled.button`
  padding: 0.25rem;
  background: #fee2e2;
  color: #dc2626;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 0.75rem;
  type: button;
  
  &:hover {
    background: #fecaca;
  }
`;

const AddBulletButton = styled.button`
  padding: 0.375rem 0.75rem;
  background: #ecfdf5;
  color: #059669;
  border: 1px solid #10b981;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-top: 0.5rem;
  type: button;
  
  &:hover {
    background: #d1fae5;
  }
  
  @media (max-width: 768px) {
    font-size: 0.75rem;
    padding: 0.3rem 0.6rem;
  }
`;

const AddActionItemButton = styled.button`
  padding: 0.75rem 1rem;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  align-self: flex-start;
  transition: all 0.2s ease;
  type: button;
  
  &:hover {
    background: #059669;
  }
  
  @media (max-width: 768px) {
    font-size: 0.8rem;
    padding: 0.6rem 0.8rem;
  }
`;

const MONTHS = [
  { value: 1, label: '1월' },
  { value: 2, label: '2월' },
  { value: 3, label: '3월' },
  { value: 4, label: '4월' },
  { value: 5, label: '5월' },
  { value: 6, label: '6월' },
  { value: 7, label: '7월' },
  { value: 8, label: '8월' },
  { value: 9, label: '9월' },
  { value: 10, label: '10월' },
  { value: 11, label: '11월' },
  { value: 12, label: '12월' }
];

const ActionItemsSection = ({ formData, handleInputChange }) => {
  const [newActionItemTitle, setNewActionItemTitle] = useState('');

  const actionItems = formData.액션아이템목록 || [];

  // 새 액션 아이템 추가
  const addActionItem = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!newActionItemTitle.trim()) return;

    const newActionItem = {
      id: Date.now(),
      제목: newActionItemTitle.trim(),
      완료여부: false, // 완료 여부 필드 추가
      월별내용: MONTHS.reduce((acc, month) => {
        acc[month.value] = [];
        return acc;
      }, {})
    };

    const updatedActionItems = [...actionItems, newActionItem];
    
    const syntheticEvent = {
      target: {
        name: '액션아이템목록',
        value: updatedActionItems
      }
    };
    
    handleInputChange(syntheticEvent);
    setNewActionItemTitle('');
  };

  // 액션 아이템 삭제
  const removeActionItem = (actionItemId, e) => {
    e.preventDefault();
    e.stopPropagation();
    const updatedActionItems = actionItems.filter(item => item.id !== actionItemId);
    
    const syntheticEvent = {
      target: {
        name: '액션아이템목록',
        value: updatedActionItems
      }
    };
    
    handleInputChange(syntheticEvent);
  };

  // 액션 아이템 제목 변경
  const updateActionItemTitle = (actionItemId, newTitle) => {
    const updatedActionItems = actionItems.map(item =>
      item.id === actionItemId ? { ...item, 제목: newTitle } : item
    );
    
    const syntheticEvent = {
      target: {
        name: '액션아이템목록',
        value: updatedActionItems
      }
    };
    
    handleInputChange(syntheticEvent);
  };

  // 액션 아이템 완료 여부 변경
  const toggleActionItemCompletion = (actionItemId) => {
    const updatedActionItems = actionItems.map(item =>
      item.id === actionItemId ? { ...item, 완료여부: !item.완료여부 } : item
    );
    
    const syntheticEvent = {
      target: {
        name: '액션아이템목록',
        value: updatedActionItems
      }
    };
    
    handleInputChange(syntheticEvent);
  };
  const addBulletToMonth = (actionItemId, monthValue, e) => {
    e.preventDefault();
    e.stopPropagation();
    const updatedActionItems = actionItems.map(item => {
      if (item.id === actionItemId) {
        const updatedMonthlyContent = { ...(item.월별내용 || {}) };
        if (!updatedMonthlyContent[monthValue]) {
          updatedMonthlyContent[monthValue] = [];
        }
        updatedMonthlyContent[monthValue] = [...updatedMonthlyContent[monthValue], ''];
        return { ...item, 월별내용: updatedMonthlyContent };
      }
      return item;
    });
    
    const syntheticEvent = {
      target: {
        name: '액션아이템목록',
        value: updatedActionItems
      }
    };
    
    handleInputChange(syntheticEvent);
  };

  // 월별 bullet 내용 변경
  const updateBulletContent = (actionItemId, monthValue, bulletIndex, content) => {
    const updatedActionItems = actionItems.map(item => {
      if (item.id === actionItemId) {
        const updatedMonthlyContent = { ...(item.월별내용 || {}) };
        if (!updatedMonthlyContent[monthValue]) {
          updatedMonthlyContent[monthValue] = [];
        }
        updatedMonthlyContent[monthValue][bulletIndex] = content;
        return { ...item, 월별내용: updatedMonthlyContent };
      }
      return item;
    });
    
    const syntheticEvent = {
      target: {
        name: '액션아이템목록',
        value: updatedActionItems
      }
    };
    
    handleInputChange(syntheticEvent);
  };

  // 월별 bullet 삭제
  const removeBulletFromMonth = (actionItemId, monthValue, bulletIndex, e) => {
    e.preventDefault();
    e.stopPropagation();
    const updatedActionItems = actionItems.map(item => {
      if (item.id === actionItemId) {
        const updatedMonthlyContent = { ...(item.월별내용 || {}) };
        if (updatedMonthlyContent[monthValue]) {
          updatedMonthlyContent[monthValue] = updatedMonthlyContent[monthValue].filter((_, index) => index !== bulletIndex);
        }
        return { ...item, 월별내용: updatedMonthlyContent };
      }
      return item;
    });
    
    const syntheticEvent = {
      target: {
        name: '액션아이템목록',
        value: updatedActionItems
      }
    };
    
    handleInputChange(syntheticEvent);
  };

  return (
    <ActionItemsContainer>
      <SectionTitle>
        <CheckSquare size={16} />
        액션 아이템
      </SectionTitle>
      
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <ActionItemTitle
          type="text"
          value={newActionItemTitle}
          onChange={(e) => setNewActionItemTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addActionItem(e);
            }
          }}
          placeholder="새 액션 아이템 제목을 입력하세요"
          style={{ maxWidth: '600px', flex: '1', minWidth: '400px' }}
        />
        <AddActionItemButton type="button" onClick={addActionItem}>
          <Plus size={16} />
          액션 아이템 추가
        </AddActionItemButton>
      </div>
      
      {actionItems.map((actionItem) => (
        <ActionItemCard key={actionItem.id}>
          <ActionItemHeader>
            <TitleAndCheckboxContainer>
              <div className="checkbox-container">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={!!actionItem.완료여부}
                  onChange={() => toggleActionItemCompletion(actionItem.id)}
                />
                <span className="checkbox-label">완료</span>
              </div>
              <ActionItemTitle
                type="text"
                value={actionItem.제목 || ''}
                onChange={(e) => updateActionItemTitle(actionItem.id, e.target.value)}
                placeholder="액션 아이템 제목을 입력하세요"
                className={actionItem.완료여부 ? 'completed' : ''}
              />
            </TitleAndCheckboxContainer>
            <DeleteButton onClick={(e) => removeActionItem(actionItem.id, e)}>
              <Trash2 size={14} />
              삭제
            </DeleteButton>
          </ActionItemHeader>
          
          <MonthlyBulletsContainer>
            {MONTHS.map((month) => (
              <MonthCard key={month.value}>
                <MonthHeader>
                  <Calendar size={14} />
                  {month.label}
                </MonthHeader>
                
                <BulletList>
                  <AddBulletButton type="button" onClick={(e) => addBulletToMonth(actionItem.id, month.value, e)}>
                    <Plus size={12} />
                    항목 추가
                  </AddBulletButton>
                  
                  {((actionItem.월별내용 && actionItem.월별내용[month.value]) || []).map((bullet, bulletIndex) => (
                    <BulletItem key={bulletIndex}>
                      <span style={{ color: '#6b7280', fontSize: '0.8rem', marginTop: '0.375rem' }}>•</span>
                      <BulletInput
                        type="text"
                        value={bullet}
                        onChange={(e) => updateBulletContent(actionItem.id, month.value, bulletIndex, e.target.value)}
                        placeholder="내용을 입력하세요"
                      />
                      <RemoveBulletButton
                        onClick={(e) => removeBulletFromMonth(actionItem.id, month.value, bulletIndex, e)}
                      >
                        ×
                      </RemoveBulletButton>
                    </BulletItem>
                  ))}
                </BulletList>
              </MonthCard>
            ))}
          </MonthlyBulletsContainer>
        </ActionItemCard>
      ))}
    </ActionItemsContainer>
  );
};

export default ActionItemsSection;