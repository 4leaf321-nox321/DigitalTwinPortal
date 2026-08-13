import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import {
  CheckSquare, Plus, Trash2, ChevronRight, ChevronDown, CalendarRange, RotateCcw,
  ChevronUp, ChevronDown as ChevronDownIcon, Sparkles,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../../../../../contexts/AuthContext';
import { toLocalYmd, todayLocalYmd, projectCompletedYmd } from '../../../../../shared/utils/localDate';
import AiActionItemsModal from './AiActionItemsModal';

/*
  액션아이템의 **정체성은 `uuid` 다. `id` 가 아니다.**

  `id` 는 저장할 때마다 `formUtils.processFormData` 가 위치 순서로 다시 매긴다
  (`action_<과제id>_1`, `_2` …). 그래서 3개 중 첫 번째를 지우면 남은 둘의 id 가
  1,2 로 당겨지고, id 로 비교하는 활동 로그가 **엉뚱한 항목이 삭제됐다고 기록한다.**

  여기서 만드는 항목에는 uuid 를 함께 넣는다. 빠뜨려도 서버가 채워 주지만
  (`routes_v2._assign_action_uuids`), 저장 전까지는 서버 값이 없으므로 편집 중의
  비교가 여전히 id 에 기댄다. 만들 때 붙이는 편이 낫다.

  ⚠️ `id` 는 그대로 둔다 — React key 와 기존 목록 조작이 전부 그것을 쓴다.
*/

// 액션아이템 생성 시각 조회 (레거시 데이터는 id가 Date.now() 밀리초였으므로 역산)
export const getActionItemCreatedAt = (item) => {
  if (!item) return null;
  if (item.createdAt) return item.createdAt;
  if (typeof item.id === 'number' && item.id > 1e12) {
    return new Date(item.id).toISOString();
  }
  return null;
};

const ActionItemsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 0;

  @media (max-width: 768px) {
    gap: 0.75rem;
  }
`;

/* 제목 + 추가 입력줄 — 목록이 길어져도 항상 보이게 고정한다 */
const StickyHeaderArea = styled.div`
  flex-shrink: 0;
`;

/* 순서 이동 (위/아래) + 현재 번호 */
const OrderControls = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
  flex-shrink: 0;
`;

const OrderButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.125rem;
  padding: 0;
  border: 1px solid #e5e7eb;
  border-radius: 0.25rem;
  background: white;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover:not(:disabled) {
    background: #eef2ff;
    border-color: #c7d2fe;
    color: #4f46e5;
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
`;

const OrderIndex = styled.span`
  font-size: 0.6875rem;
  font-weight: 600;
  color: #9ca3af;
  line-height: 1;
`;

/*
 * 액션아이템 목록만 스크롤한다.
 *
 * 예전에는 추가 입력줄까지 함께 스크롤돼서, 항목을 하나 넣을 때마다
 * 위로 올라갔다 다시 내려와야 했다.
 */
const ActionItemList = styled.div`
  flex: 1;
  min-height: 0;
  max-height: 50vh;
  overflow-y: auto;
  overflow-x: hidden;
  /* 스크롤바가 카드 테두리에 붙지 않도록 */
  padding-right: 0.25rem;

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

  @media (max-width: 768px) {
    max-height: 45vh;
  }
`;

const EmptyListHint = styled.div`
  padding: 2rem 1rem;
  text-align: center;
  color: #9ca3af;
  font-size: 0.875rem;
  border: 2px dashed #e5e7eb;
  border-radius: 0.75rem;
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
  gap: 0.75rem;

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 0.5rem;
  }
`;

const ToggleButton = styled.button`
  padding: 0.5rem;
  background: #e0f2fe;
  color: #0284c7;
  border: 1px solid #0284c7;
  border-radius: 0.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  type: button;
  min-width: 2.5rem;
  height: 2.5rem;

  &:hover {
    background: #bae6fd;
  }

  @media (max-width: 768px) {
    padding: 0.4rem;
    min-width: 2rem;
    height: 2rem;
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
    text-decoration: line-through;
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

const DetailItemsContainer = styled.div`
  margin-top: 1rem;
  padding: 1rem;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
`;

const DetailItemsHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
  font-weight: 500;
  color: #374151;
  font-size: 0.875rem;
`;

const DetailItemsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const DetailItem = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.5rem;
  background: ${props => props.completed ? '#f0fdf4' : '#f9fafb'};
  border: 1px solid ${props => props.completed ? '#bbf7d0' : '#e5e7eb'};
  border-radius: 0.375rem;
  transition: all 0.2s ease;

  .detail-checkbox {
    width: 1.1rem;
    height: 1.1rem;
    margin-top: 0.25rem;
    cursor: pointer;
    accent-color: #10b981;
    flex-shrink: 0;
  }
`;

const DetailItemInput = styled.textarea`
  flex: 1;
  padding: 0.375rem 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.8rem;
  font-family: inherit;
  background: ${props => props.completed ? '#f0fdf4' : 'white'};
  text-decoration: ${props => props.completed ? 'line-through' : 'none'};
  color: ${props => props.completed ? '#6b7280' : '#374151'};
  resize: none;
  overflow: hidden;
  min-height: 1.8rem;
  line-height: 1.4;

  &:focus {
    outline: none;
    border-color: #10b981;
    box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.1);
  }

  @media (max-width: 768px) {
    font-size: 0.75rem;
  }
`;

const RemoveDetailButton = styled.button`
  padding: 0.25rem 0.5rem;
  background: #fee2e2;
  color: #dc2626;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 0.75rem;
  type: button;
  flex-shrink: 0;

  &:hover {
    background: #fecaca;
  }
`;

const AddDetailButton = styled.button`
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

/* AI 관련 버튼은 청록으로 통일한다 — 대시보드 우하단 에이전트와 같은 색이라
   "이건 AI 가 하는 일" 이 색만 보고도 읽힌다. */
const AiExtractButton = styled.button`
  padding: 0.75rem 1rem;
  background: #0891b2;
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
    background: #0e7490;
  }

  @media (max-width: 768px) {
    font-size: 0.8rem;
    padding: 0.6rem 0.8rem;
  }
`;

const DistributeDatesButton = styled.button`
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

  &:disabled {
    background: #6ee7b7;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    font-size: 0.8rem;
    padding: 0.6rem 0.8rem;
  }
`;

const ProgressInfo = styled.div`
  font-size: 0.75rem;
  color: #6b7280;
  margin-left: auto;
`;

const ResetDatesButton = styled.button`
  padding: 0.75rem 1rem;
  background: #fef3c7;
  color: #b45309;
  border: 1px solid #f59e0b;
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
    background: #fde68a;
  }

  @media (max-width: 768px) {
    font-size: 0.8rem;
    padding: 0.6rem 0.8rem;
  }
`;

const DateFieldsContainer = styled.div`
  display: flex;
  gap: 1rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px dashed #e5e7eb;

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 0.5rem;
  }
`;

const DateField = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;

  label {
    font-size: 0.8rem;
    font-weight: 500;
    color: #6b7280;
    white-space: nowrap;
  }

  input[type="date"] {
    padding: 0.375rem 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.8rem;
    color: #374151;
    background: white;

    &:focus {
      outline: none;
      border-color: #10b981;
      box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.1);
    }

    &:disabled {
      background: #f3f4f6;
      color: #9ca3af;
    }
  }
`;

const CompletedDateField = styled(DateField)`
  input[type="date"] {
    background: ${props => props.hasValue ? '#f0fdf4' : 'white'};
    border-color: ${props => props.hasValue ? '#86efac' : '#d1d5db'};
  }
`;

const QuickDateSelect = styled.select`
  padding: 0.375rem 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  color: #6b7280;
  background: #f9fafb;
  cursor: pointer;
  min-width: 110px;

  &:focus {
    outline: none;
    border-color: #10b981;
    box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.1);
  }

  &:hover {
    background: #f3f4f6;
  }
`;

const ActionItemsSection = ({ formData, handleInputChange, projectUuid, onAiFilled }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.is_admin;

  const [newActionItemTitle, setNewActionItemTitle] = useState('');
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState({});
  const [isInitialized, setIsInitialized] = useState(false);
  const [focusTarget, setFocusTarget] = useState(null); // { actionItemIndex, detailIndex }
  const detailInputRefs = useRef({});

  const actionItems = formData.액션아이템목록 || [];

  // 초기 로드 시 모든 액션아이템을 펼친 상태로 설정
  useEffect(() => {
    if (!isInitialized && actionItems.length > 0) {
      const initialExpanded = {};
      actionItems.forEach((_, index) => {
        initialExpanded[index] = true;
      });
      setExpandedItems(initialExpanded);
      setIsInitialized(true);
    }
  }, [actionItems, isInitialized]);

  // 새로 추가된 세부 항목에 포커스
  useEffect(() => {
    if (focusTarget) {
      const key = `${focusTarget.actionItemIndex}-${focusTarget.detailIndex}`;
      const inputRef = detailInputRefs.current[key];
      if (inputRef) {
        inputRef.focus();
      }
      setFocusTarget(null);
    }
  }, [focusTarget, actionItems]);

  // 과제년도 기준 완료일 계산 — 규칙은 shared/utils/localDate 에 한 곳으로 뒀다.
  // 진행상태를 완료로 바꿀 때(BasicInfoSection)도 같은 날짜가 나와야 한다.
  const getCompletedDate = () => projectCompletedYmd(formData.과제년도);

  // 세부 항목 완료 여부에 따라 상위 액션아이템 자동 체크
  const updateActionItemsWithAutoCheck = (items) => {
    const completedDate = getCompletedDate();
    return items.map(item => {
      const detailItems = item.세부항목목록 || [];
      if (detailItems.length > 0) {
        const allCompleted = detailItems.every(detail => detail.완료여부);
        // 자동 완료 시 완료일도 함께 설정
        if (allCompleted && !item.완료여부) {
          return { ...item, 완료여부: allCompleted, 완료일: completedDate };
        } else if (!allCompleted && item.완료여부) {
          return { ...item, 완료여부: allCompleted, 완료일: '' };
        }
        return { ...item, 완료여부: allCompleted };
      }
      return item;
    });
  };

  // 액션아이템 완료 상태에 따라 과제 진행상태 계산
  //
  // **사람이 정한 상태를 함부로 덮지 않는다.** `지연`·`취소` 는 액션아이템 진행과
  // 별개의 판단이다. 예전에는 완료된 액션아이템이 1건만 생겨도 `정상진행` 으로
  // 바꿔서, 액티비티 하나를 체크하는 순간 **지연 표시가 조용히 사라졌다.**
  //
  // 반대로 **바꿔야만 하는** 경우는 남긴다. 서버가 진행상태와 액션아이템의 모순을
  // 400 으로 막기 때문에(routes_v2 `_status_conflict`), 그대로 두면 저장이 안 된다.
  //   · 미착수·계획·미배정 인데 완료된 액션아이템이 생겼다 → 정상진행
  //   · 완료 인데 완료가 풀린 액션아이템이 생겼다          → 정상진행
  const calculateProjectStatus = (items, currentStatus) => {
    if (!items || items.length === 0) return null; // 변경 없음

    // 취소는 어떤 경우에도 자동으로 되살리지 않는다.
    if (currentStatus === '취소') return null;

    const completedCount = items.filter(item => item.완료여부).length;
    const totalCount = items.length;

    if (completedCount === totalCount) {
      return '완료'; // 모든 액션아이템 완료 — 지연이었더라도 일은 다 끝난 것이다
    }
    if (completedCount === 0) {
      // 하나도 완료가 아닌데 `완료` 로 남아 있으면 서버가 막는다.
      return currentStatus === '완료' ? '정상진행' : null;
    }
    // 일부만 완료 — 지연은 그대로 둔다. 지연이 풀렸는지는 사람이 판단한다.
    if (currentStatus === '지연') return null;
    return '정상진행';
  };

  // 액션아이템 기반 진행률 계산 (각 액션아이템이 동일한 기여도)
  const calculateProgress = (items) => {
    if (!items || items.length === 0) return 0;

    const actionItemCount = items.length;
    const contributionPerActionItem = 100 / actionItemCount;

    let totalProgress = 0;

    items.forEach(item => {
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

    return Math.round(totalProgress);
  };

  // 액션아이템 목록, 진행상태, 진행률을 함께 업데이트
  const updateActionItemsAndStatus = (updatedActionItems) => {
    const newStatus = calculateProjectStatus(updatedActionItems, formData.진행상태);
    const newProgress = calculateProgress(updatedActionItems);

    // 액션아이템 목록 업데이트
    handleInputChange({
      target: {
        name: '액션아이템목록',
        value: updatedActionItems
      }
    });

    // 진행률 업데이트
    if (formData.진행률 !== newProgress) {
      handleInputChange({
        target: {
          name: '진행률',
          value: newProgress
        }
      });
    }

    // 진행상태 업데이트 (변경이 필요한 경우만)
    if (newStatus && formData.진행상태 !== newStatus) {
      handleInputChange({
        target: {
          name: '진행상태',
          value: newStatus
        }
      });
    }
  };

  // 액션 아이템 확장/축소 토글
  const toggleExpand = (actionItemId) => {
    setExpandedItems(prev => ({
      ...prev,
      [actionItemId]: !prev[actionItemId]
    }));
  };

  /**
   * 액션아이템 순서 이동.
   *
   * 저장 구조상 **배열 순서가 곧 표시 순서**라 배열만 바꾸면 된다. (백엔드 변경 불필요)
   * `순번` 필드가 데이터에 남아 있지만 화면·정렬 어디서도 쓰이지 않으므로 건드리지 않는다.
   *
   * 주의: 펼침 상태(expandedItems)가 **인덱스로** 관리되므로 함께 옮기지 않으면
   *       엉뚱한 항목이 펼쳐진 것처럼 보인다.
   */
  const moveActionItem = (index, direction, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const target = index + direction;
    if (target < 0 || target >= actionItems.length) return;

    const updated = [...actionItems];
    [updated[index], updated[target]] = [updated[target], updated[index]];

    setExpandedItems(prev => ({
      ...prev,
      [index]: prev[target],
      [target]: prev[index],
    }));

    updateActionItemsAndStatus(updated);
  };

  // 새 액션 아이템 추가
  const addActionItem = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!newActionItemTitle.trim()) return;

    const newActionItem = {
      id: Date.now(),
      uuid: uuidv4(),          // 정체성. id 와 달리 저장해도 안 바뀐다 (위 머리말 참조)
      createdAt: new Date().toISOString(),
      제목: newActionItemTitle.trim(),
      완료여부: false,
      목표일: '',
      완료일: '',
      세부항목목록: []
    };

    const updatedActionItems = [...actionItems, newActionItem];
    const newIndex = updatedActionItems.length - 1;

    const syntheticEvent = {
      target: {
        name: '액션아이템목록',
        value: updatedActionItems
      }
    };

    handleInputChange(syntheticEvent);
    setNewActionItemTitle('');

    // 새로 추가된 액션아이템을 펼친 상태로 설정
    setExpandedItems(prev => ({
      ...prev,
      [newIndex]: true
    }));
  };

  /**
   * AI 가 뽑은 후보를 목록에 **덧붙인다**(통째 교체가 아니다).
   *
   * · **전부 미완료로 들어간다.** 완료 여부가 진행률·진행상태를 정하므로 사람이 체크한다
   *   (서버는 완료 표시를 아예 뽑지 않는다 — AiActionItemsModal 머리말 참고).
   * · **id 를 하나씩 다르게 만든다.** `Date.now()` 한 값으로 여러 건을 만들면 id 가 겹쳐
   *   React key 가 충돌하고, 목록 조작이 엉뚱한 항목에 걸린다. 기존 `addActionItem` 은
   *   한 번에 한 건이라 그 문제가 없었다 — 여기서 처음 생긴다.
   * · 마지막에 `updateActionItemsAndStatus` 를 태운다. 항목이 늘면 **진행률이 다시
   *   계산**되고, `완료` 였던 과제는 `정상진행` 으로 내려가야 저장이 400 을 안 낸다.
   */
  const addAiActionItems = (items) => {
    if (!items || items.length === 0) return;

    const base = Date.now();
    const createdAt = new Date().toISOString();

    const added = (items || []).map((item, i) => ({
      id: base + i,
      uuid: uuidv4(),          // 한 건씩 다르다 — id 와 달리 저장 뒤에도 그대로다
      createdAt,
      제목: (item.제목 || '').trim(),
      완료여부: false,
      목표일: item.목표일 || '',
      완료일: '',
      세부항목목록: (item.세부항목목록 || [])
        .map((d, j) => ({
          id: base + (i + 1) * 1000 + j,
          내용: (d.내용 || '').trim(),
          완료여부: false,
          완료일: '',
        }))
        .filter(d => d.내용),
    })).filter(item => item.제목);

    if (added.length === 0) return;

    updateActionItemsAndStatus([...actionItems, ...added]);

    // 변경 이력에 **AI 가 만든 항목**이라고 남긴다. 진행률·진행상태는 그 결과로
    // 서버가 파생시킨 값이라 표식을 붙이지 않는다 — 사람이 체크해서 움직인 것과
    // 구분이 안 되기 때문이다.
    onAiFilled?.(['액션아이템목록']);

    // 새로 들어온 것들을 펼쳐 둔다 — 붙여넣은 결과를 바로 확인하고 고칠 수 있어야 한다.
    setExpandedItems(prev => {
      const next = { ...prev };
      added.forEach((_, i) => { next[actionItems.length + i] = true; });
      return next;
    });
  };

  // 목표 날짜 균일 분배
  const distributeTargetDates = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (actionItems.length === 0) return;

    const projectYear = formData.과제년도 || new Date().getFullYear();
    const startMonth = parseInt(formData.시작) || 1;
    const endMonth = parseInt(formData.종료) || 12;
    const count = actionItems.length;

    const updatedActionItems = actionItems.map((item, index) => {
      // 1-indexed for calculation
      const i = index + 1;
      // Calculate target month: evenly distributed across the project period
      const targetMonth = Math.round(startMonth + (endMonth - startMonth) * (i / count));
      // Get last day of that month
      const lastDay = new Date(projectYear, targetMonth, 0).getDate();
      // Format as YYYY-MM-DD
      const targetDate = `${projectYear}-${String(targetMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      return {
        ...item,
        목표일: targetDate
      };
    });

    updateActionItemsAndStatus(updatedActionItems);
  };

  // 오기입 완료일 초기화 (완료체크 안된 항목의 완료일 삭제)
  const resetMisenteredCompletionDates = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (actionItems.length === 0) return;

    let resetCount = 0;

    const updatedActionItems = actionItems.map(item => {
      // 액션아이템의 완료일 초기화 (완료체크 안됨 + 완료일 있음)
      let updatedItem = { ...item };
      if (!item.완료여부 && item.완료일) {
        updatedItem.완료일 = '';
        resetCount++;
      }

      // 세부항목(액티비티)의 완료일 초기화
      if (item.세부항목목록 && item.세부항목목록.length > 0) {
        const updatedDetails = item.세부항목목록.map(detail => {
          if (!detail.완료여부 && detail.완료일) {
            resetCount++;
            return { ...detail, 완료일: '' };
          }
          return detail;
        });
        updatedItem.세부항목목록 = updatedDetails;
      }

      return updatedItem;
    });

    if (resetCount > 0) {
      updateActionItemsAndStatus(updatedActionItems);
      alert(`${resetCount}개의 오기입 완료일이 초기화되었습니다.`);
    } else {
      alert('초기화할 오기입 완료일이 없습니다.');
    }
  };

  // 액션 아이템 삭제
  const removeActionItem = (index, e) => {
    e.preventDefault();
    e.stopPropagation();
    const updatedActionItems = actionItems.filter((_, i) => i !== index);

    const syntheticEvent = {
      target: {
        name: '액션아이템목록',
        value: updatedActionItems
      }
    };

    handleInputChange(syntheticEvent);
  };

  // 액션 아이템 제목 변경
  const updateActionItemTitle = (index, newTitle) => {
    const updatedActionItems = actionItems.map((item, i) =>
      i === index ? { ...item, 제목: newTitle } : item
    );

    const syntheticEvent = {
      target: {
        name: '액션아이템목록',
        value: updatedActionItems
      }
    };

    handleInputChange(syntheticEvent);
  };

  // 액션 아이템 완료 여부 변경 (수동 체크)
  const toggleActionItemCompletion = (index) => {
    const item = actionItems[index];
    const detailItems = item.세부항목목록 || [];

    // 세부 항목이 있는 경우, 모든 세부 항목의 완료 상태를 함께 변경
    const newCompletionState = !item.완료여부;

    // 완료 시 과제년도 기준 날짜를 완료일로 설정
    const newCompletedDate = newCompletionState ? getCompletedDate() : '';

    const updatedActionItems = actionItems.map((actionItem, i) => {
      if (i === index) {
        if (detailItems.length > 0) {
          // 세부 항목이 있으면 모든 세부 항목도 함께 변경
          //
          // **완료일도 같이 채운다.** 예전에는 완료여부만 켜서 액티비티의 완료일이
          // 빈 채로 남았다. 그러면 (1) 서버가 상위 완료일을 세부항목의 마지막
          // 완료일에서 파생시킬 때 근거가 없고, (2) 월별 진척은 액티비티 완료일로
          // 달을 가르므로 그 액티비티가 어느 달에도 안 잡힌다.
          // 이미 들어 있는 날짜는 실제로 끝난 날이므로 덮지 않는다.
          const updatedDetails = detailItems.map(detail => ({
            ...detail,
            완료여부: newCompletionState,
            완료일: newCompletionState ? (detail.완료일 || newCompletedDate) : ''
          }));
          return {
            ...actionItem,
            완료여부: newCompletionState,
            완료일: newCompletedDate,
            세부항목목록: updatedDetails
          };
        }
        return {
          ...actionItem,
          완료여부: newCompletionState,
          완료일: newCompletedDate
        };
      }
      return actionItem;
    });

    updateActionItemsAndStatus(updatedActionItems);
  };

  // 목표일 변경
  const updateActionItemTargetDate = (index, targetDate) => {
    const updatedActionItems = actionItems.map((item, i) =>
      i === index ? { ...item, 목표일: targetDate } : item
    );

    const syntheticEvent = {
      target: {
        name: '액션아이템목록',
        value: updatedActionItems
      }
    };

    handleInputChange(syntheticEvent);
  };

  // 월말 날짜 계산 (해당 월의 마지막 날)
  const getLastDayOfMonth = (year, month) => {
    // month는 1-12 기준, Date에서는 다음달의 0일이 해당 월의 마지막 날
    const lastDay = new Date(year, month, 0).getDate();
    const monthStr = String(month).padStart(2, '0');
    const dayStr = String(lastDay).padStart(2, '0');
    return `${year}-${monthStr}-${dayStr}`;
  };

  // 빠른 날짜 선택 핸들러
  const handleQuickDateSelect = (index, monthValue) => {
    if (!monthValue) return;
    const year = formData.과제년도 || new Date().getFullYear();
    const month = parseInt(monthValue, 10);
    const targetDate = getLastDayOfMonth(year, month);
    updateActionItemTargetDate(index, targetDate);
  };

  // 생성 날짜 변경 (관리자 전용, 커스텀)
  const updateActionItemCreatedAt = (index, dateStr) => {
    // dateStr: 'YYYY-MM-DD' 또는 '' (빈값이면 createdAt 제거)
    const newCreatedAt = dateStr
      ? new Date(`${dateStr}T00:00:00`).toISOString()
      : '';

    const updatedActionItems = actionItems.map((item, i) => {
      if (i !== index) return item;
      if (newCreatedAt) return { ...item, createdAt: newCreatedAt };
      // 빈 값으로 설정 시 createdAt 필드 자체를 제거
      const { createdAt, ...rest } = item;
      return rest;
    });

    handleInputChange({
      target: {
        name: '액션아이템목록',
        value: updatedActionItems
      }
    });
  };

  // 레거시 액션아이템 생성일 일괄 채우기 (관리자 전용)
  // - createdAt 이 없는 항목에 한해 부모 과제 createdAt 으로 채움
  // - id 가 Date.now() 밀리초 타임스탬프인 경우 이를 우선 사용 (더 정확함)
  const backfillMissingCreatedAt = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (actionItems.length === 0) return;

    const projectCreatedAt = formData?.createdAt || null;

    let filled = 0;
    let skippedNoSource = 0;

    const updatedActionItems = actionItems.map(item => {
      if (item.createdAt) return item;

      let newCreatedAt = null;
      if (typeof item.id === 'number' && item.id > 1e12) {
        newCreatedAt = new Date(item.id).toISOString();
      } else if (projectCreatedAt) {
        newCreatedAt = projectCreatedAt;
      }

      if (!newCreatedAt) {
        skippedNoSource++;
        return item;
      }

      filled++;
      return { ...item, createdAt: newCreatedAt };
    });

    if (filled === 0 && skippedNoSource === 0) {
      alert('모든 액션아이템에 이미 생성 날짜가 설정되어 있습니다.');
      return;
    }

    if (filled > 0) {
      handleInputChange({
        target: {
          name: '액션아이템목록',
          value: updatedActionItems
        }
      });
    }

    const messages = [];
    if (filled > 0) messages.push(`${filled}개 항목의 생성 날짜를 채웠습니다.`);
    if (skippedNoSource > 0) messages.push(`${skippedNoSource}개 항목은 참조할 날짜가 없어 건너뛰었습니다.`);
    alert(messages.join('\n'));
  };

  // 완료일 변경 (커스텀)
  const updateActionItemCompletedDate = (index, completedDate) => {
    const updatedActionItems = actionItems.map((item, i) =>
      i === index ? { ...item, 완료일: completedDate } : item
    );

    const syntheticEvent = {
      target: {
        name: '액션아이템목록',
        value: updatedActionItems
      }
    };

    handleInputChange(syntheticEvent);
  };

  // 세부 항목 추가
  const addDetailItem = (actionItemIndex, e) => {
    e.preventDefault();
    e.stopPropagation();

    const currentDetails = actionItems[actionItemIndex]?.세부항목목록 || [];
    const newDetailIndex = currentDetails.length;

    const updatedActionItems = actionItems.map((item, i) => {
      if (i === actionItemIndex) {
        const newDetail = {
          id: Date.now(),
          내용: '',
          완료여부: false,
          완료일: ''
        };
        return { ...item, 세부항목목록: [...currentDetails, newDetail] };
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

    // 새로 추가된 항목에 포커스 설정
    setFocusTarget({ actionItemIndex, detailIndex: newDetailIndex });
  };

  // 세부 항목 내용 변경
  const updateDetailContent = (actionItemIndex, detailIndex, content) => {
    const updatedActionItems = actionItems.map((item, i) => {
      if (i === actionItemIndex) {
        const updatedDetails = (item.세부항목목록 || []).map((detail, di) =>
          di === detailIndex ? { ...detail, 내용: content } : detail
        );
        return { ...item, 세부항목목록: updatedDetails };
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

  // 액티비티 완료일 변경 (커스텀)
  const updateDetailCompletedDate = (actionItemIndex, detailIndex, completedDate) => {
    const updatedActionItems = actionItems.map((item, i) => {
      if (i === actionItemIndex) {
        const updatedDetails = (item.세부항목목록 || []).map((detail, di) =>
          di === detailIndex ? { ...detail, 완료일: completedDate } : detail
        );
        return { ...item, 세부항목목록: updatedDetails };
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

  // 세부 항목 완료 여부 변경
  const toggleDetailCompletion = (actionItemIndex, detailIndex) => {
    const completedDate = getCompletedDate();
    let updatedActionItems = actionItems.map((item, i) => {
      if (i === actionItemIndex) {
        const updatedDetails = (item.세부항목목록 || []).map((detail, di) => {
          if (di === detailIndex) {
            const newCompletionState = !detail.완료여부;
            return {
              ...detail,
              완료여부: newCompletionState,
              완료일: newCompletionState ? completedDate : ''
            };
          }
          return detail;
        });
        return { ...item, 세부항목목록: updatedDetails };
      }
      return item;
    });

    // 세부 항목 모두 완료 시 상위 액션아이템 자동 체크
    updatedActionItems = updateActionItemsWithAutoCheck(updatedActionItems);

    updateActionItemsAndStatus(updatedActionItems);
  };

  // 세부 항목 삭제
  const removeDetailItem = (actionItemIndex, detailIndex, e) => {
    e.preventDefault();
    e.stopPropagation();

    let updatedActionItems = actionItems.map((item, i) => {
      if (i === actionItemIndex) {
        const updatedDetails = (item.세부항목목록 || []).filter((_, di) => di !== detailIndex);
        return { ...item, 세부항목목록: updatedDetails };
      }
      return item;
    });

    // 세부 항목 삭제 후 자동 체크 업데이트
    updatedActionItems = updateActionItemsWithAutoCheck(updatedActionItems);

    updateActionItemsAndStatus(updatedActionItems);
  };

  // 세부 항목 진행률 계산
  const getDetailProgress = (detailItems) => {
    if (!detailItems || detailItems.length === 0) return null;
    const completed = detailItems.filter(d => d.완료여부).length;
    return { completed, total: detailItems.length };
  };

  return (
    <ActionItemsContainer>
      <StickyHeaderArea>
      <SectionTitle>
        <CheckSquare size={16} />
        액션 아이템
        {actionItems.length > 0 && (
          <span style={{ marginLeft: '0.5rem', fontSize: '0.8125rem', color: '#6b7280', fontWeight: 500 }}>
            {actionItems.length}개
          </span>
        )}
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
        {/*
          붙여넣기로 여러 건을 한 번에. **저장된 과제에서만** 쓴다 —
          권한을 그 과제로 판정하고 목표일을 과제년도로 제한하기 때문에 uuid 가 필요하다.

          이름에 **"AI" 를 넣는다.** 처음엔 "붙여넣기로 만들기" 였는데, 그러면 AI 가
          하는 일인 줄 모른다 — 사람은 자기가 무엇에 동의하는지 알아야 한다.
          어휘는 편집창 위의 `AiFillPanel`("AI로 채우기")과 맞춘다.
        */}
        {projectUuid && (
          <AiExtractButton
            type="button"
            onClick={() => setIsAiModalOpen(true)}
            title="회의록·메일·주간보고를 붙여넣으면 AI 가 액션아이템 후보를 만들어 줍니다 (저장은 직접 누릅니다)"
          >
            <Sparkles size={16} />
            AI로 액션아이템 뽑기
          </AiExtractButton>
        )}
        <DistributeDatesButton
          type="button"
          onClick={distributeTargetDates}
          disabled={actionItems.length === 0}
          title="모든 액션아이템의 목표일을 과제 기간에 균일하게 분배합니다"
        >
          <CalendarRange size={16} />
          목표 날짜 균일 분배
        </DistributeDatesButton>
        {isAdmin && (
          <ResetDatesButton
            type="button"
            onClick={resetMisenteredCompletionDates}
            disabled={actionItems.length === 0}
            title="완료 체크가 안된 항목 중 완료일이 입력된 항목들의 완료일을 일괄 삭제합니다"
          >
            <RotateCcw size={16} />
            오기입 초기화
          </ResetDatesButton>
        )}
        {isAdmin && (
          <ResetDatesButton
            type="button"
            onClick={backfillMissingCreatedAt}
            disabled={actionItems.length === 0}
            title="생성 날짜가 없는 액션아이템에 부모 과제의 생성일(또는 id 타임스탬프)을 일괄 채웁니다"
          >
            <CalendarRange size={16} />
            생성 날짜 일괄 채우기
          </ResetDatesButton>
        )}
      </div>
      </StickyHeaderArea>

      <ActionItemList>
      {actionItems.length === 0 && (
        <EmptyListHint>
          아직 액션 아이템이 없습니다. 위에서 제목을 입력해 추가하세요.
        </EmptyListHint>
      )}
      {actionItems.map((actionItem, itemIndex) => {
        const detailProgress = getDetailProgress(actionItem.세부항목목록);

        return (
          <ActionItemCard key={actionItem.id || itemIndex}>
            <ActionItemHeader>
              <TitleAndCheckboxContainer>
                <div className="checkbox-container">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={!!actionItem.완료여부}
                    onChange={() => toggleActionItemCompletion(itemIndex)}
                  />
                  <span className="checkbox-label">완료</span>
                </div>
                <ActionItemTitle
                  type="text"
                  value={actionItem.제목 || ''}
                  onChange={(e) => updateActionItemTitle(itemIndex, e.target.value)}
                  placeholder="액션 아이템 제목을 입력하세요"
                  className={actionItem.완료여부 ? 'completed' : ''}
                />
                {detailProgress && (
                  <ProgressInfo>
                    {detailProgress.completed}/{detailProgress.total} 완료
                  </ProgressInfo>
                )}
              </TitleAndCheckboxContainer>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <OrderControls>
                  <OrderButton
                    type="button"
                    onClick={(e) => moveActionItem(itemIndex, -1, e)}
                    disabled={itemIndex === 0}
                    title="위로 이동"
                    aria-label="위로 이동"
                  >
                    <ChevronUp size={14} />
                  </OrderButton>
                  <OrderIndex>{itemIndex + 1}</OrderIndex>
                  <OrderButton
                    type="button"
                    onClick={(e) => moveActionItem(itemIndex, 1, e)}
                    disabled={itemIndex === actionItems.length - 1}
                    title="아래로 이동"
                    aria-label="아래로 이동"
                  >
                    <ChevronDownIcon size={14} />
                  </OrderButton>
                </OrderControls>
                <ToggleButton
                  type="button"
                  onClick={() => toggleExpand(itemIndex)}
                  title={expandedItems[itemIndex] ? '상세 내용 접기' : '상세 내용 펼치기'}
                >
                  {expandedItems[itemIndex] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </ToggleButton>
                <DeleteButton onClick={(e) => removeActionItem(itemIndex, e)}>
                  <Trash2 size={14} />
                  삭제
                </DeleteButton>
              </div>
            </ActionItemHeader>

            <DateFieldsContainer>
              <DateField>
                <QuickDateSelect
                  value=""
                  onChange={(e) => handleQuickDateSelect(itemIndex, e.target.value)}
                >
                  <option value="">빠른 날짜 입력</option>
                  <option value="1">1월말</option>
                  <option value="2">2월말</option>
                  <option value="3">3월말</option>
                  <option value="4">4월말</option>
                  <option value="5">5월말</option>
                  <option value="6">6월말</option>
                  <option value="7">7월말</option>
                  <option value="8">8월말</option>
                  <option value="9">9월말</option>
                  <option value="10">10월말</option>
                  <option value="11">11월말</option>
                  <option value="12">12월말</option>
                </QuickDateSelect>
                <label>목표일:</label>
                <input
                  type="date"
                  value={actionItem.목표일 || ''}
                  onChange={(e) => updateActionItemTargetDate(itemIndex, e.target.value)}
                  min={`${formData.과제년도 || new Date().getFullYear()}-01-01`}
                  max={`${formData.과제년도 || new Date().getFullYear()}-12-31`}
                />
              </DateField>
              <CompletedDateField hasValue={!!actionItem.완료일}>
                <label>완료일:</label>
                <input
                  type="date"
                  value={actionItem.완료일 || ''}
                  onChange={(e) => updateActionItemCompletedDate(itemIndex, e.target.value)}
                  min={`${formData.과제년도 || new Date().getFullYear()}-01-01`}
                  max={`${formData.과제년도 || new Date().getFullYear()}-12-31`}
                  disabled={!actionItem.완료여부}
                  title={!actionItem.완료여부 ? '완료 체크 후 입력 가능' : '완료일'}
                />
              </CompletedDateField>
              {isAdmin && (() => {
                // ⚠️ value 와 max 를 **같은 함수로** 만든다.
                //    max 만 toISOString()(UTC)으로 만들었더니 KST 새벽에 하루 밀려
                //    value(오늘) > max(어제) 가 됐고, 폼 검증이 걸려 **저장 버튼이
                //    아무 일도 하지 않았다**(2026-08-02). 자세한 내용은 utils/localDate.js.
                const inputValue = toLocalYmd(actionItem.createdAt || '');
                return (
                  <DateField title="관리자 전용: 액션아이템 생성 날짜 수정">
                    <label>생성 날짜:</label>
                    <input
                      type="date"
                      value={inputValue}
                      onChange={(e) => updateActionItemCreatedAt(itemIndex, e.target.value)}
                      max={todayLocalYmd()}
                    />
                  </DateField>
                );
              })()}
            </DateFieldsContainer>

            {expandedItems[itemIndex] && (
              <DetailItemsContainer>
                <DetailItemsHeader>
                  <span>액티비티</span>
                  <AddDetailButton type="button" onClick={(e) => addDetailItem(itemIndex, e)}>
                    <Plus size={12} />
                    항목 추가
                  </AddDetailButton>
                </DetailItemsHeader>

                <DetailItemsList>
                  {(actionItem.세부항목목록 || []).map((detail, detailIndex) => (
                    <DetailItem key={detail.id || detailIndex} completed={detail.완료여부}>
                      <input
                        type="checkbox"
                        className="detail-checkbox"
                        checked={!!detail.완료여부}
                        onChange={() => toggleDetailCompletion(itemIndex, detailIndex)}
                      />
                      <DetailItemInput
                        ref={(el) => {
                          detailInputRefs.current[`${itemIndex}-${detailIndex}`] = el;
                          if (el) {
                            el.style.height = 'auto';
                            el.style.height = el.scrollHeight + 'px';
                          }
                        }}
                        rows={1}
                        value={detail.내용 || ''}
                        completed={detail.완료여부}
                        onChange={(e) => {
                          updateDetailContent(itemIndex, detailIndex, e.target.value);
                          e.target.style.height = 'auto';
                          e.target.style.height = e.target.scrollHeight + 'px';
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            e.stopPropagation();
                            addDetailItem(itemIndex, e);
                          }
                        }}
                        placeholder="액티비티 내용을 입력하세요 (Shift+Enter로 줄바꿈)"
                      />
                      <span style={{
                        fontSize: '0.7rem',
                        color: '#6b7280',
                        fontWeight: '500',
                        whiteSpace: 'nowrap',
                        marginLeft: '0.5rem'
                      }}>완료일</span>
                      <input
                        type="date"
                        value={detail.완료일 || ''}
                        onChange={(e) => updateDetailCompletedDate(itemIndex, detailIndex, e.target.value)}
                        min={`${formData.과제년도 || new Date().getFullYear()}-01-01`}
                        max={`${formData.과제년도 || new Date().getFullYear()}-12-31`}
                        disabled={!detail.완료여부}
                        style={{
                          padding: '0.25rem 0.4rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem',
                          color: !detail.완료여부 ? '#9ca3af' : '#374151',
                          background: !detail.완료여부 ? '#f3f4f6' : (detail.완료일 ? '#f0fdf4' : 'white'),
                          borderColor: detail.완료일 ? '#86efac' : '#d1d5db',
                          minWidth: '110px',
                          cursor: !detail.완료여부 ? 'not-allowed' : 'pointer'
                        }}
                        title={!detail.완료여부 ? '완료 체크 후 입력 가능' : '완료일'}
                      />
                      <RemoveDetailButton
                        onClick={(e) => removeDetailItem(itemIndex, detailIndex, e)}
                      >
                        ×
                      </RemoveDetailButton>
                    </DetailItem>
                  ))}
                  {(!actionItem.세부항목목록 || actionItem.세부항목목록.length === 0) && (
                    <div style={{ color: '#9ca3af', fontSize: '0.8rem', padding: '0.5rem', textAlign: 'center' }}>
                      액티비티가 없습니다. 위 버튼을 클릭하여 추가하세요.
                    </div>
                  )}
                </DetailItemsList>
              </DetailItemsContainer>
            )}
          </ActionItemCard>
        );
      })}
      </ActionItemList>

      <AiActionItemsModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        projectUuid={projectUuid}
        projectYear={formData.과제년도 || new Date().getFullYear()}
        existingTitles={actionItems.map(it => it.제목).filter(Boolean)}
        onAdd={addAiActionItems}
      />
    </ActionItemsContainer>
  );
};

export default ActionItemsSection;