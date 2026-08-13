import React, { useEffect, useRef } from 'react';
import styled from 'styled-components';
import { X, Calendar, Download } from 'lucide-react';

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  key: i + 1,
  label: `${i + 1}월`,
}));

/**
 * 완료일 문자열에서 월(1~12)을 추출
 */
const getMonthFromDate = (dateStr) => {
  if (!dateStr) return null;
  const match = dateStr.match(/-(\d{2})-/);
  if (match) return parseInt(match[1], 10);
  return null;
};

/**
 * 액션아이템 목록에서 특정 월에 완료된 항목을 텍스트로 변환
 * - 액션아이템: □ 제목
 * - 액티비티:   - 내용
 */
const buildCompletedText = (actionItems, targetMonth) => {
  const lines = [];

  (actionItems || []).forEach((item) => {
    const subs = item.세부항목목록 || [];

    // 해당 월에 완료된 액티비티 필터
    const completedSubs = subs.filter((sub) => {
      if (!sub.완료여부) return false;
      return getMonthFromDate(sub.완료일) === targetMonth;
    });

    // 액션아이템 자체가 해당 월에 완료되었는지
    const actionCompletedThisMonth =
      item.완료여부 && getMonthFromDate(item.완료일) === targetMonth;

    if (actionCompletedThisMonth || completedSubs.length > 0) {
      lines.push(`□ ${item.제목 || '(제목 없음)'}`);
      completedSubs.forEach((sub) => {
        const rawContent = (sub.내용 || '').trim();
        if (!rawContent) {
          lines.push(`  - (내용 없음)`);
        } else {
          const contentLines = rawContent.split('\n');
          lines.push(`  - ${contentLines[0]}`);
          for (let i = 1; i < contentLines.length; i++) {
            lines.push(`    ${contentLines[i]}`);
          }
        }
      });
    }
  });

  return lines.join('\n');
};

/**
 * 전체 월에 대해 한번에 불러오기
 */
const buildAllMonthsData = (actionItems) => {
  const result = {};
  MONTHS.forEach(({ key }) => {
    const text = buildCompletedText(actionItems, key);
    if (text) result[key] = text;
  });
  return result;
};

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
`;

const ModalContainer = styled.div`
  background: white;
  border-radius: 0.75rem;
  width: 85vw;
  height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);

  @media (max-width: 768px) {
    width: 95vw;
    height: 90vh;
  }
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const ModalTitle = styled.h2`
  font-size: 1.1rem;
  font-weight: 700;
  color: #111827;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ImportAllButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: #eff6ff;
  color: #2563eb;
  border: 1px solid #bfdbfe;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #dbeafe;
    border-color: #93c5fd;
  }
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: #6b7280;
  padding: 0.25rem;
  border-radius: 0.25rem;
  display: flex;
  align-items: center;

  &:hover {
    background: #f3f4f6;
    color: #111827;
  }
`;

const ModalBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
`;

const MonthGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const MonthCard = styled.div`
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  overflow: hidden;
  transition: border-color 0.2s ease;

  &:focus-within {
    border-color: #10b981;
  }
`;

const MonthLabel = styled.div`
  background: #f9fafb;
  padding: 0.5rem 0.75rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: #374151;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const MonthLabelLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
`;

const ImportButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.5rem;
  background: #f0fdf4;
  color: #059669;
  border: 1px solid #bbf7d0;
  border-radius: 0.25rem;
  font-size: 0.65rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #dcfce7;
    border-color: #86efac;
  }
`;

const MonthTextarea = styled.textarea`
  width: 100%;
  min-height: 120px;
  padding: 0.625rem 0.75rem;
  border: none;
  font-size: 0.8rem;
  font-family: inherit;
  line-height: 1.5;
  color: #374151;
  resize: vertical;
  box-sizing: border-box;

  &:focus {
    outline: none;
    background: #f0fdf4;
  }

  &::placeholder {
    color: #9ca3af;
  }
`;

const ModalFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0.75rem 1.5rem;
  border-top: 1px solid #e5e7eb;
  gap: 0.75rem;
  flex-shrink: 0;
`;

const FooterButton = styled.button`
  padding: 0.5rem 1.25rem;
  border-radius: 0.375rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  ${props => props.primary
    ? `
      background: #10b981;
      color: white;
      border: none;
      &:hover { background: #059669; }
    `
    : `
      background: white;
      color: #374151;
      border: 1px solid #d1d5db;
      &:hover { background: #f3f4f6; }
    `
  }
`;

const MonthlyProgressModal = ({ isOpen, onClose, formData, handleInputChange }) => {
  const overlayRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const monthlyData = formData.월간진척현황 || {};
  const actionItems = formData.액션아이템목록 || [];

  const updateMonthlyData = (updated) => {
    handleInputChange({
      target: { name: '월간진척현황', value: updated }
    });
  };

  const handleMonthChange = (month, value) => {
    updateMonthlyData({ ...monthlyData, [month]: value });
  };

  const handleImportMonth = (month) => {
    const text = buildCompletedText(actionItems, month);
    if (!text) {
      alert(`${month}월에 완료된 액션아이템/액티비티가 없습니다.`);
      return;
    }
    const existing = monthlyData[month] || '';
    const newValue = existing ? `${existing}\n${text}` : text;
    updateMonthlyData({ ...monthlyData, [month]: newValue });
  };

  const handleImportAll = () => {
    const allData = buildAllMonthsData(actionItems);
    if (Object.keys(allData).length === 0) {
      alert('완료된 액션아이템/액티비티가 없습니다.');
      return;
    }
    const updated = { ...monthlyData };
    Object.entries(allData).forEach(([month, text]) => {
      const existing = updated[month] || '';
      updated[month] = existing ? `${existing}\n${text}` : text;
    });
    updateMonthlyData(updated);
  };

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <Overlay ref={overlayRef} onClick={handleOverlayClick}>
      <ModalContainer onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <HeaderLeft>
            <ModalTitle>
              <Calendar size={18} />
              월간 진척 현황 요약
            </ModalTitle>
            <ImportAllButton type="button" onClick={handleImportAll}>
              <Download size={13} />
              완료된 액션아이템/액티비티로부터 전체 불러오기
            </ImportAllButton>
          </HeaderLeft>
          <CloseButton onClick={onClose}>
            <X size={20} />
          </CloseButton>
        </ModalHeader>

        <ModalBody>
          <MonthGrid>
            {MONTHS.map(({ key, label }) => (
              <MonthCard key={key}>
                <MonthLabel>
                  <MonthLabelLeft>
                    <Calendar size={14} />
                    {label}
                  </MonthLabelLeft>
                  <ImportButton type="button" onClick={() => handleImportMonth(key)}>
                    <Download size={11} />
                    불러오기
                  </ImportButton>
                </MonthLabel>
                <MonthTextarea
                  value={monthlyData[key] || ''}
                  onChange={(e) => handleMonthChange(key, e.target.value)}
                  placeholder={`${label} 진척 현황을 입력하세요...`}
                />
              </MonthCard>
            ))}
          </MonthGrid>
        </ModalBody>

        <ModalFooter>
          <FooterButton onClick={onClose}>닫기</FooterButton>
          <FooterButton primary onClick={onClose}>확인</FooterButton>
        </ModalFooter>
      </ModalContainer>
    </Overlay>
  );
};

export default MonthlyProgressModal;
