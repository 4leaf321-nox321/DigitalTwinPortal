import React, { useRef, useEffect } from 'react';
import styled from 'styled-components';
import { Target, Plus, Pencil } from 'lucide-react';
import { PERFORMANCE_CATEGORIES } from '../constants/formConstants';
import { validatePerformanceInput, validateNumericInput, validateContributionInput } from '../utils/formUtils';
// 수준값의 0 과 미입력은 다른 뜻이다. `|| ''` 로 다루면 0 이 사라진다.
import { hasLevel, levelText } from '../../../utils/levelValue';
import { sortDivisionNames } from '../../../utils/divisionOrder';

/**
 * 연결 행(`성과목록` 원소)이 이 성과 정의를 가리키는가.
 *
 * ⚠️ **AddPerformanceModal 의 초기 편집 대상 찾기와 같은 규칙이어야 한다.**
 *    거기서는 찾아지는데 여기서는 못 찾으면, 연필 버튼은 제대로 열리는데 목록은
 *    옛 값을 그리는 상태가 된다 — 2026-08-07 에 실제로 그랬다. 참조 키가 데이터마다
 *    제각각(옛 행은 `성과항목ID`+`성과UUID`, V2 로 새로 만든 행은 `성과항목UUID`)
 *    이라 후보를 넓게 잡고, **이름까지 마지막 수단으로** 본다.
 *    이름 대조는 성과명을 바꾸면 못 맞춘다 — 그건 연필 버튼도 마찬가지다.
 */
const matchesPerformanceRef = (p, row) => (
  (row.uuid && p.uuid === row.uuid)
  || (row.성과항목UUID && p.uuid === row.성과항목UUID)
  || (row.성과UUID && p.uuid === row.성과UUID)
  || (row.id && p.id === row.id)
  || (row.성과항목ID && p.id === row.성과항목ID)
  || (row.성과항목 && p.성과항목 === row.성과항목)
);

const RemarksSection = styled.div`
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

const Select = styled.select`
  padding: 0.75rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  background: white;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
  box-sizing: border-box;
  
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

const PerformanceContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  
  @media (max-width: 768px) {
    gap: 0.75rem;
  }
`;

const PerformanceInputContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  background: #f9fafb;
  
  .input-row {
    display: grid;
    grid-template-columns: 2fr 2fr 5fr 1fr;
    gap: 0.75rem;
    align-items: end;
    
    @media (max-width: 1200px) {
      grid-template-columns: 1fr 1fr 2fr 1fr;
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

const PerformanceList = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  margin-top: 1rem;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
`;

const PerformanceItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  min-width: 0;
  
  .performance-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
    min-width: 0;
    
    .main-category {
      font-weight: 600;
      color: #374151;
      font-size: 0.875rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .sub-category {
      color: #6b7280;
      font-size: 0.8rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .performance-text {
      color: #059669;
      font-size: 0.875rem;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .metrics-info {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0.25rem;
      margin-top: 0.25rem;
      font-size: 0.8rem;
      
      .level-info {
        color: #4b5563;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        
        .label {
          font-weight: 600;
          color: #374151;
        }
      }
    }
  }
  
  @media (max-width: 768px) {
    padding: 0.625rem 0.75rem;
    
    .performance-info {
      .main-category {
        font-size: 0.8rem;
      }
      
      .sub-category {
        font-size: 0.75rem;
      }
      
      .performance-text {
        font-size: 0.8rem;
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

const ErrorMessage = styled.div`
  color: #ef4444;
  font-size: 0.75rem;
  margin-top: 0.25rem;
  word-break: break-word;

  @media (max-width: 768px) {
    font-size: 0.7rem;
  }
`;

const NewPerformanceButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.75rem;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-left: auto;

  &:hover {
    background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
  }

  &:active {
    transform: translateY(0);
  }

  @media (max-width: 768px) {
    padding: 0.3rem 0.6rem;
    font-size: 0.7rem;
  }
`;

const PercentInputContainer = styled.div`
  position: relative;
  display: flex;
  align-items: center;

  .percent-symbol {
    position: absolute;
    right: 1rem;
    color: #6b7280;
    font-size: 0.875rem;
    pointer-events: none;
    z-index: 1;
  }
`;

const InlineContributionInput = styled.input`
  width: 50px;
  padding: 0.125rem 0.25rem;
  border: 1px solid #10b981;
  border-radius: 0.25rem;
  font-size: 0.8rem;
  text-align: center;
  outline: none;
  background: white;

  &:focus {
    box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
  }
`;

const EditableContribution = styled.span`
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  background: #fef3c7;
  border: 1px solid #f59e0b;
  border-radius: 0.25rem;
  color: #92400e;
  font-weight: 600;
  transition: all 0.15s ease;

  .edit-icon {
    opacity: 0.6;
    transition: opacity 0.15s ease;
  }

  &:hover {
    background: #fde68a;
    border-color: #d97706;
    color: #78350f;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3);

    .edit-icon {
      opacity: 1;
    }
  }

  &:active {
    transform: translateY(0);
  }
`;

const InfoDisplayContainer = styled.div`
  padding: 1rem;
  background-color: #f0f9ff;
  border: 1px solid #0ea5e9;
  border-radius: 0.5rem;
  margin-top: 0.5rem;
  width: 50%;
  max-width: 500px;

  .info-title {
    font-weight: 600;
    color: #0369a1;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
    
    @media (max-width: 768px) {
      font-size: 0.8rem;
    }
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 0.75rem;
    font-size: 0.875rem;
    
    @media (max-width: 768px) {
      font-size: 0.8rem;
      grid-template-columns: 1fr;
      gap: 0.5rem;
    }
    
    .info-item {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      
      strong {
        margin-right: 0.25rem;
        color: #374151;
      }
      
      span {
        color: #6b7280;
      }
    }
  }
  
  @media (max-width: 768px) {
    width: 100%;
  }
`;

const EditButton = styled.button`
  background: #3b82f6;
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

  &:hover {
    background: #2563eb;
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
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
`;

const SearchableDropdown = styled.div`
  position: relative;
  width: 100%;
  opacity: ${props => props.$disabled ? 0.6 : 1};
  pointer-events: ${props => props.$disabled ? 'none' : 'auto'};
`;

/* 대분류·소분류가 필수가 아니라 필터임을 라벨에서 알린다 */
const FilterHint = styled.span`
  margin-left: 0.375rem;
  padding: 0.0625rem 0.375rem;
  border-radius: 9999px;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 0.625rem;
  font-weight: 600;
  vertical-align: middle;
`;

const FilterClearButton = styled.button`
  margin-left: 0.5rem;
  padding: 0;
  border: none;
  background: none;
  color: #6366f1;
  font-size: 0.6875rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;

  &:hover {
    color: #4338ca;
  }
`;

/* 분류를 안 좁혔을 때 항목이 어디 소속인지 보여준다 (이름이 겹칠 수 있으므로) */
const ItemPath = styled.span`
  display: block;
  margin-top: 0.125rem;
  font-size: 0.6875rem;
  color: #9ca3af;
`;

const SearchableDropdownInput = styled.input`
  padding: 0.75rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  transition: all 0.2s ease;
  width: 100%;
  box-sizing: border-box;
  background: ${props => props.$hasValue ? '#f0fdf4' : 'white'};

  &:focus {
    outline: none;
    border-color: #10b981;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
  }

  &:disabled {
    background: #f3f4f6;
    cursor: not-allowed;
  }

  &::placeholder {
    color: ${props => props.$hasValue ? '#059669' : '#9ca3af'};
    font-weight: ${props => props.$hasValue ? '500' : 'normal'};
  }

  @media (max-width: 768px) {
    padding: 0.625rem 0.875rem;
    font-size: 0.8rem;
  }
`;

const SearchableDropdownList = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  max-height: 250px;
  overflow-y: auto;
  background: white;
  border: 2px solid #10b981;
  border-top: none;
  border-radius: 0 0 0.5rem 0.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
`;

const SearchableDropdownItem = styled.div`
  padding: 0.75rem 1rem;
  cursor: pointer;
  transition: background-color 0.15s ease;
  font-size: 0.875rem;
  color: #374151;
  border-bottom: 1px solid #f3f4f6;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background-color: #ecfdf5;
    color: #059669;
  }
`;

const SearchableDropdownEmpty = styled.div`
  padding: 1rem;
  text-align: center;
  color: #9ca3af;
  font-size: 0.875rem;
`;

const PerformanceSection = ({
  performanceInput,
  handlePerformanceInputChange,
  addPerformanceToList,
  formData,
  removePerformanceFromList,
  onUpdatePerformanceContribution,
  errors,
  UNIT_OPTIONS,
  SUBCATEGORY_OPTIONS,
  settingsData,
  globalPerformances = [],
  onOpenAddPerformanceModal,
  onEditPerformanceInModal
}) => {
  // 대분류 select에 대한 ref
  const categorySelectRef = useRef(null);

  // 성과 항목 검색 드롭다운 ref 및 상태
  const performanceItemDropdownRef = useRef(null);
  const [performanceItemSearchTerm, setPerformanceItemSearchTerm] = React.useState('');
  const [isPerformanceItemDropdownOpen, setIsPerformanceItemDropdownOpen] = React.useState(false);

  // 인라인 편집 상태 (편집 중인 성과 인덱스, -1이면 편집 안함)
  const [editingContributionIndex, setEditingContributionIndex] = React.useState(-1);
  const [editingContributionValue, setEditingContributionValue] = React.useState('');

  // 사업부 필터 상태 (기본값: 전체)
  const [divisionFilter, setDivisionFilter] = React.useState('전체');

  // 년도 필터 상태 (기본값: 과제년도와 연동)
  const [yearFilter, setYearFilter] = React.useState(() => {
    return formData.과제년도 ? String(formData.과제년도) : '전체';
  });

  // 과제년도가 변경되면 년도 필터도 연동하여 업데이트
  useEffect(() => {
    if (formData.과제년도) {
      setYearFilter(String(formData.과제년도));
    }
  }, [formData.과제년도]);

  // 성과 항목 검색 드롭다운 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (performanceItemDropdownRef.current && !performanceItemDropdownRef.current.contains(event.target)) {
        setIsPerformanceItemDropdownOpen(false);
      }
    };

    if (isPerformanceItemDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPerformanceItemDropdownOpen]);

  // 사업부 목록 추출 (성과항목명에서 [사업부] 추출 + "전체" 옵션)
  //
  // 차례는 **설정이 정본**이다(utils/divisionOrder). 예전에는 `.sort()` 라
  // 이름순(CSㆍDAㆍGTRㆍMX…)이었는데, 다른 화면은 전부 설정 순서
  // (MXㆍVDㆍDAㆍNWㆍ의료기기ㆍSRㆍGTRㆍCS)로 보여 준다. 같은 사람이 화면을
  // 옮길 때마다 목록이 뒤바뀌면 "내가 어디쯤 있나" 를 잃는다.
  const divisionOptions = React.useMemo(() => {
    const divisions = new Set();
    globalPerformances.forEach(perf => {
      const match = perf.성과항목?.match(/^\[(.+?)\]/);
      if (match) {
        divisions.add(match[1]);
      }
    });
    return ['전체', ...sortDivisionNames(Array.from(divisions), settingsData)];
  }, [globalPerformances, settingsData]);

  // 년도 목록 추출 (globalPerformances에서 성과년도 추출 + "전체" 옵션)
  const yearOptions = React.useMemo(() => {
    const years = new Set();
    globalPerformances.forEach(perf => {
      if (perf.성과년도) {
        years.add(String(perf.성과년도));
      }
    });
    return ['전체', ...Array.from(years).sort((a, b) => Number(b) - Number(a))]; // 최신년도 먼저
  }, [globalPerformances]);

  // globalPerformances에서 필터링 (년도 필터 + 사업부 필터 적용)
  const filteredPerformances = React.useMemo(() => {
    let filtered = globalPerformances;

    // 성과년도 필터 (전체가 아닐 경우에만 적용)
    if (yearFilter && yearFilter !== '전체') {
      const targetYear = parseInt(yearFilter, 10);
      filtered = filtered.filter(perf => parseInt(perf.성과년도, 10) === targetYear);
    }

    // 사업부 필터 (전체가 아닐 경우에만 적용)
    if (divisionFilter && divisionFilter !== '전체') {
      filtered = filtered.filter(perf => {
        const match = perf.성과항목?.match(/^\[(.+?)\]/);
        return match && match[1] === divisionFilter;
      });
    }

    return filtered;
  }, [globalPerformances, yearFilter, divisionFilter]);

  // filteredPerformances에서 고유한 대분류 추출
  const performanceCategories = React.useMemo(() => {
    const uniqueCategories = [...new Set(filteredPerformances.map(perf => perf.대분류))].filter(Boolean);
    return uniqueCategories.map((name, index) => ({
      id: `category-${index}`,
      name: name
    }));
  }, [filteredPerformances]);

  // filteredPerformances에서 고유한 소분류 추출
  const performanceSubcategories = React.useMemo(() => {
    const subcategoryMap = new Map();
    filteredPerformances.forEach(perf => {
      if (perf.대분류 && perf.소분류) {
        const key = `${perf.대분류}-${perf.소분류}`;
        if (!subcategoryMap.has(key)) {
          const category = performanceCategories.find(cat => cat.name === perf.대분류);
          subcategoryMap.set(key, {
            id: `subcategory-${subcategoryMap.size}`,
            categoryId: category?.id || `category-0`,
            name: perf.소분류
          });
        }
      }
    });
    return Array.from(subcategoryMap.values());
  }, [filteredPerformances, performanceCategories]);

  // filteredPerformances에서 성과 항목 목록 (이미 등록된 성과항목)
  const performanceItems = React.useMemo(() => {
    return filteredPerformances.map(perf => {
      const category = performanceCategories.find(cat => cat.name === perf.대분류);
      const subcategory = performanceSubcategories.find(sub =>
        sub.name === perf.소분류 && sub.categoryId === category?.id
      );
      return {
        id: perf.id,
        uuid: perf.uuid || '',  // UUID 추가 (우선 조회용)
        // 드롭다운 value로 사용할 고유 키 (uuid 우선, 없으면 id)
        uniqueKey: perf.uuid || perf.id,
        subcategoryId: subcategory?.id || '',
        // 검색만으로 항목을 고를 수 있어야 하므로, 항목이 자기 분류를 알고 있어야 한다
        categoryId: category?.id || '',
        categoryName: perf.대분류 || '',
        subcategoryName: perf.소분류 || '',
        name: perf.성과항목,
        unit: perf.단위 || '',
        // 0 도 값이다 — `|| ''` 로 접으면 그 성과는 아래 '추가' 버튼이
        // 영영 비활성이라 **과제에 연결할 수 없다.** (2026-08-06)
        currentLevel: levelText(perf.현재수준),
        targetLevel: levelText(perf.목표수준),
        actualLevel: levelText(perf.실적수준),
        isMonthly: perf.월별실적여부 || false,
        monthlyActuals: perf.월별실적 || Array(12).fill('')
      };
    });
  }, [filteredPerformances, performanceCategories, performanceSubcategories]);

  // 선택된 대분류에 따른 소분류 필터링
  const getSubcategoriesForCategory = (categoryId) => {
    return performanceSubcategories.filter(sub => sub.categoryId === categoryId);
  };

  // 선택된 소분류에 따른 성과 항목 필터링
  const getItemsForSubcategory = (subcategoryId) => {
    return performanceItems.filter(item => item.subcategoryId === subcategoryId);
  };

  /**
   * 검색 결과 목록.
   *
   * 대분류·소분류는 **필수 선택이 아니라 필터**다.
   * 아무것도 안 고르면 전체에서 이름으로 바로 검색할 수 있고,
   * 고르면 그 범위로 좁혀진다. (예전에는 소분류를 골라야만 검색창이 열렸다)
   */
  const searchableItems = React.useMemo(() => {
    let items = performanceItems;

    if (performanceInput.소분류ID) {
      items = items.filter(item => item.subcategoryId === performanceInput.소분류ID);
    } else if (performanceInput.대분류ID) {
      items = items.filter(item => item.categoryId === performanceInput.대분류ID);
    }

    const term = (performanceItemSearchTerm || '').trim().toLowerCase();
    if (term) {
      items = items.filter(item =>
        (item.name || '').toLowerCase().includes(term) ||
        (item.subcategoryName || '').toLowerCase().includes(term) ||
        (item.categoryName || '').toLowerCase().includes(term)
      );
    }
    return items;
  }, [performanceItems, performanceInput.대분류ID, performanceInput.소분류ID, performanceItemSearchTerm]);

  // 소분류 옵션 — 대분류를 안 골랐으면 전체를 보여준다 (소분류만으로도 좁힐 수 있게)
  const subcategoryOptions = React.useMemo(() => {
    if (performanceInput.대분류ID) {
      return getSubcategoriesForCategory(performanceInput.대분류ID)
        .map(sub => ({ ...sub, label: sub.name }));
    }
    return performanceSubcategories.map(sub => ({
      ...sub,
      // 대분류를 안 골랐을 때는 어느 대분류 소속인지 같이 보여준다
      label: `${performanceCategories.find(c => c.id === sub.categoryId)?.name || '?'} > ${sub.name}`,
    }));
  }, [performanceInput.대분류ID, performanceSubcategories, performanceCategories]);

  // 대분류 ID로 대분류 이름 찾기
  const getCategoryName = (categoryId) => {
    const category = performanceCategories.find(cat => cat.id === categoryId);
    return category ? category.name : categoryId;
  };

  // 소분류 ID로 소분류 이름 찾기
  const getSubcategoryName = (subcategoryId) => {
    const subcategory = performanceSubcategories.find(sub => sub.id === subcategoryId);
    return subcategory ? subcategory.name : subcategoryId;
  };

  // 성과 항목 ID 또는 UUID로 성과 항목 이름 찾기 (하위 호환)
  const getItemName = (itemIdOrUuid, itemUuid = null) => {
    // 1. performanceItems에서 ID로 찾기
    const item = performanceItems.find(item => item.id === itemIdOrUuid);
    if (item) return item.name;

    // 2. globalPerformances에서 ID 또는 UUID로 찾기 (하위 호환)
    const perf = globalPerformances.find(p =>
      p.id === itemIdOrUuid ||
      p.uuid === itemIdOrUuid ||
      (itemUuid && p.uuid === itemUuid)
    );
    return perf ? perf.성과항목 : itemIdOrUuid;
  };

  /**
   * 연결 행 → **지금의 성과 정의**를 얹어 돌려준다. (2026-08-07)
   *
   * 왜 필요한가
   *     `성과목록` 원소는 연결할 때의 값을 베껴 들고 있는데, 서버가 실제로 저장하는
   *     모양이 **두 가지**다 (개발서버 실측) —
   *       · V1 에서 이관된 행 : 성과 본체가 통째로 복제돼 있다 → 정의를 고쳐도
   *                             **옛 값이 그대로** 보인다
   *       · V2 연결 API 로 만든 행 : `{성과항목UUID, 과제기여도, 실적수준}` 뿐이라
   *                             단위·현재·목표가 **아예 비어** 보인다
   *     둘 다 사본을 믿어서 생긴 문제다. 그래서 사본이 아니라 정의를 읽는다 —
   *     성과항목명이 원래부터 `getItemName()` 으로 그렇게 동작하고 있었고
   *     (`models_v2.Dt2ProjectPerformance`: "나머지는 성과 테이블에서 조인한다"),
   *     나머지 필드도 같은 규칙으로 맞춘 것뿐이다.
   *
   * ⚠️ 과제별 값은 **`과제기여도` 하나뿐이다.** 이것만 행의 값을 지킨다.
   *
   *    한때 `실적수준`·`월별실적` 도 과제별이라고 보고 지켰는데 **틀렸다**
   *    (2026-08-07, 실적수준을 고쳐도 화면이 안 바뀐다는 신고로 드러났다).
   *    근거 —
   *      · 화면에 **과제별 실적을 입력하는 칸이 없다.** 성과를 고를 때 정의값을
   *        베껴 오고(`handlePerformanceSelect`) 그 뒤로는 읽기 전용으로 보여주기만 한다.
   *      · `ProjectReportView` 는 이미 `{...행, ...정의, 과제기여도: 행.과제기여도}`
   *        로 그린다 — 정의가 이기고 기여도만 지킨다. 같은 규칙을 쓴다.
   *    서버 모델(`Dt2ProjectPerformance`)이 실적수준을 관계 속성이라 부르는 것은
   *    **V1 원소를 그대로 복원하기 위한 저장 얘기**이지, 제품이 그렇게 쓰라는 뜻이 아니다.
   */
  const withLiveDefinition = (row) => {
    const def = globalPerformances.find(p => matchesPerformanceRef(p, row));
    if (!def) {
      // 못 찾으면 사본이라도 보여준다. 다만 **조용히 옛 값을 그리는 것**이 이 버그의
      // 정체였으므로, 왜 못 찾았는지 알 수 있게 흔적은 남긴다.
      console.warn('[DT] 성과 정의를 못 찾아 옛 사본을 그립니다 — 연결 참조 키:', {
        성과항목UUID: row.성과항목UUID, 성과UUID: row.성과UUID,
        성과항목ID: row.성과항목ID, uuid: row.uuid, id: row.id,
        성과항목: row.성과항목,
      });
      return row;
    }
    return {
      ...row,
      성과항목: def.성과항목 ?? row.성과항목,
      대분류: def.대분류 ?? row.대분류,
      소분류: def.소분류 ?? row.소분류,
      단위: def.단위 ?? row.단위,
      // 0 도 값이다 — `??` 로 받아야 0 이 사라지지 않는다 (levelValue.js 참조)
      현재수준: levelText(def.현재수준 ?? row.현재수준),
      목표수준: levelText(def.목표수준 ?? row.목표수준),
      실적수준: levelText(def.실적수준 ?? row.실적수준),
      월별실적여부: def.월별실적여부 ?? row.월별실적여부,
      월별실적: def.월별실적 ?? row.월별실적,
      // 과제기여도는 **얹지 않는다** — row 의 값이 그대로 남는다 (위 ⚠️ 참조)
    };
  };

  // 성과 항목 uniqueKey(uuid 우선)로 단위 찾기
  const getItemUnit = (itemKey) => {
    // uniqueKey(uuid 우선)로 먼저 찾고, 없으면 id로 찾기 (하위 호환)
    const item = performanceItems.find(item => item.uniqueKey === itemKey) ||
                 performanceItems.find(item => item.id === itemKey);
    return item ? item.unit : '';
  };

  // 성과 항목 uniqueKey(uuid 우선)로 수준 값들 찾기
  const getItemLevels = (itemKey) => {
    // uniqueKey(uuid 우선)로 먼저 찾고, 없으면 id로 찾기 (하위 호환)
    const item = performanceItems.find(item => item.uniqueKey === itemKey) ||
                 performanceItems.find(item => item.id === itemKey);
    return item ? {
      currentLevel: levelText(item.currentLevel),
      targetLevel: levelText(item.targetLevel),
      actualLevel: levelText(item.actualLevel),
      isMonthly: item.isMonthly || false,
      monthlyActuals: item.monthlyActuals || Array(12).fill('')
    } : {
      currentLevel: '',
      targetLevel: '',
      actualLevel: '',
      isMonthly: false,
      monthlyActuals: Array(12).fill('')
    };
  };
  
  /** 선택된 성과 항목만 비운다 (필터를 바꾸면 고른 항목이 범위 밖일 수 있으므로) */
  const clearSelectedItem = () => {
    handlePerformanceInputChange('성과항목ID', '');
    handlePerformanceInputChange('성과항목UUID', '');
    handlePerformanceInputChange('성과항목', '');
    handlePerformanceInputChange('단위', '');
    handlePerformanceInputChange('현재수준', '');
    handlePerformanceInputChange('목표수준', '');
    handlePerformanceInputChange('실적수준', '');
  };

  // 대분류 변경 — 이제 "필터"다. 검색어는 지우지 않는다.
  const handleCategoryChange = (categoryId) => {
    // 대분류 ID와 함께 이름도 저장 (export 시 이름이 정상적으로 출력되도록)
    const category = performanceCategories.find(cat => cat.id === categoryId);
    handlePerformanceInputChange('대분류ID', categoryId);
    handlePerformanceInputChange('대분류', category?.name || '');
    // 대분류를 바꾸면 기존 소분류는 범위 밖이 되므로 비운다
    handlePerformanceInputChange('소분류ID', '');
    handlePerformanceInputChange('소분류', '');
    clearSelectedItem();
  };

  // 소분류 변경 — 대분류를 안 골랐어도 선택할 수 있고, 이때 대분류는 자동으로 채워진다
  const handleSubcategoryChange = (subcategoryId) => {
    const subcategory = performanceSubcategories.find(sub => sub.id === subcategoryId);
    handlePerformanceInputChange('소분류ID', subcategoryId);
    handlePerformanceInputChange('소분류', subcategory?.name || '');

    if (subcategory?.categoryId) {
      const category = performanceCategories.find(cat => cat.id === subcategory.categoryId);
      handlePerformanceInputChange('대분류ID', subcategory.categoryId);
      handlePerformanceInputChange('대분류', category?.name || '');
    }
    clearSelectedItem();
  };

  /** 대분류·소분류 필터 해제 */
  const clearCategoryFilters = () => {
    handlePerformanceInputChange('대분류ID', '');
    handlePerformanceInputChange('대분류', '');
    handlePerformanceInputChange('소분류ID', '');
    handlePerformanceInputChange('소분류', '');
    clearSelectedItem();
  };
  
  // 성과 항목 변경 시 자동으로 단위와 수준 값들 설정
  // itemKey는 uniqueKey(uuid 우선) 또는 id
  const handleItemChange = (itemKey) => {
    // uniqueKey(uuid 우선)로 성과 찾기, 없으면 id로 찾기 (하위 호환)
    const perfItem = globalPerformances.find(p => (p.uuid || p.id) === itemKey) ||
                     globalPerformances.find(p => p.id === itemKey);

    if (!perfItem) {
      console.warn('성과 항목을 찾을 수 없습니다:', itemKey);
      return;
    }

    // 성과항목 ID, UUID, 이름 모두 저장
    handlePerformanceInputChange('성과항목ID', perfItem.id);
    handlePerformanceInputChange('성과항목UUID', perfItem.uuid || '');
    handlePerformanceInputChange('성과항목', perfItem.성과항목 || getItemName(itemKey));

    // 검색만으로 바로 고른 경우 대분류·소분류가 비어 있다.
    // 저장에는 둘 다 필요하므로 고른 항목에서 채워 넣는다.
    const meta = performanceItems.find(i => i.uniqueKey === itemKey) ||
                 performanceItems.find(i => i.id === itemKey);
    if (meta) {
      handlePerformanceInputChange('대분류ID', meta.categoryId || '');
      handlePerformanceInputChange('대분류', meta.categoryName || '');
      handlePerformanceInputChange('소분류ID', meta.subcategoryId || '');
      handlePerformanceInputChange('소분류', meta.subcategoryName || '');
    }

    const unit = getItemUnit(itemKey);
    const levels = getItemLevels(itemKey);

    handlePerformanceInputChange('단위', unit);
    handlePerformanceInputChange('현재수준', levels.currentLevel);
    handlePerformanceInputChange('목표수준', levels.targetLevel);
    handlePerformanceInputChange('실적수준', levels.actualLevel);
    handlePerformanceInputChange('월별실적여부', levels.isMonthly);
    handlePerformanceInputChange('월별실적', levels.monthlyActuals);
  };

  // 성과 기여도 입력 핸들러 (퍼센트 전용)
  const handleContributionValueChange = (value) => {
    const validatedValue = validateContributionInput ? validateContributionInput(value) : value;
    handlePerformanceInputChange('과제기여도', validatedValue);
  };

  // 성과 추가 후 포커스 이동 처리
  const handleAddPerformance = () => {
    addPerformanceToList();

    // 성과 추가 후 대분류 select로 포커스 이동
    setTimeout(() => {
      if (categorySelectRef.current) {
        categorySelectRef.current.focus();
      }
    }, 100);
  };

  /**
   * 성과를 과제에 붙일 수 있는가.
   *
   * 수준값은 `hasLevel` 로 본다 — **0 은 입력된 값이다.** `!performanceInput.현재수준`
   * 으로 보면 현재수준이 0 인 성과(개발서버 실측 112건 중 54건)는 '추가' 버튼이
   * 영영 비활성이라 과제에 연결할 방법이 없었다. (2026-08-06)
   */
  const canAddPerformance = Boolean(
    performanceInput.대분류ID && performanceInput.소분류ID && performanceInput.성과항목ID &&
    performanceInput.과제기여도 && performanceInput.단위 &&
    hasLevel(performanceInput.현재수준) && hasLevel(performanceInput.목표수준)
  );

  // 성과 입력 필드에서 엔터 키 핸들러
  const handlePerformanceKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (canAddPerformance) {
        handleAddPerformance();
      }
    }
  };

  // 기여도 인라인 편집 시작
  const handleStartEditContribution = (index, currentValue) => {
    setEditingContributionIndex(index);
    setEditingContributionValue(currentValue || '');
  };

  // 기여도 인라인 편집 저장
  const handleSaveContribution = (index) => {
    // 유효성 검사 (0-100 사이 숫자)
    const numValue = parseInt(editingContributionValue, 10);
    if (isNaN(numValue) || numValue < 0 || numValue > 100) {
      // 유효하지 않으면 원래 값으로 복원
      setEditingContributionIndex(-1);
      setEditingContributionValue('');
      return;
    }

    // 콜백 함수가 있으면 호출
    if (onUpdatePerformanceContribution) {
      onUpdatePerformanceContribution(index, numValue.toString());
    }

    setEditingContributionIndex(-1);
    setEditingContributionValue('');
  };

  // 기여도 인라인 편집 취소
  const handleCancelEditContribution = () => {
    setEditingContributionIndex(-1);
    setEditingContributionValue('');
  };

  // 기여도 입력 키 핸들러
  const handleContributionKeyDown = (e, index) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveContribution(index);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEditContribution();
    }
  };

  return (
    <RemarksSection>
      <SectionTitle>
        <Target size={16} />
        과제 성과
        {onOpenAddPerformanceModal && (
          <NewPerformanceButton
            type="button"
            onClick={onOpenAddPerformanceModal}
            title="새 성과 항목 생성"
          >
            <Plus size={14} />
            새 성과 추가
          </NewPerformanceButton>
        )}
      </SectionTitle>

      <PerformanceContainer>
        {/* 성과 입력 영역 */}
        <div>
          <Label>성과 입력</Label>
          <PerformanceInputContainer>
            {/* 필터 영역: 사업부 필터 + 년도 필터 */}
            <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
              {/* 사업부 필터 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Label style={{ margin: 0, minWidth: 'fit-content' }}>사업부:</Label>
                <Select
                  value={divisionFilter}
                  onChange={(e) => {
                    setDivisionFilter(e.target.value);
                    // 사업부 변경 시 선택 초기화
                    handlePerformanceInputChange('대분류ID', '');
                    handlePerformanceInputChange('대분류', '');
                    handlePerformanceInputChange('소분류ID', '');
                    handlePerformanceInputChange('소분류', '');
                    handlePerformanceInputChange('성과항목ID', '');
                    handlePerformanceInputChange('성과항목', '');
                    handlePerformanceInputChange('단위', '');
                    handlePerformanceInputChange('현재수준', '');
                    handlePerformanceInputChange('목표수준', '');
                    handlePerformanceInputChange('실적수준', '');
                  }}
                  style={{ minWidth: '120px', maxWidth: '180px' }}
                >
                  {divisionOptions.map(division => (
                    <option key={division} value={division}>{division}</option>
                  ))}
                </Select>
              </div>

              {/* 년도 필터 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Label style={{ margin: 0, minWidth: 'fit-content' }}>성과년도:</Label>
                <Select
                  value={yearFilter}
                  onChange={(e) => {
                    setYearFilter(e.target.value);
                    // 년도 변경 시 선택 초기화
                    handlePerformanceInputChange('대분류ID', '');
                    handlePerformanceInputChange('대분류', '');
                    handlePerformanceInputChange('소분류ID', '');
                    handlePerformanceInputChange('소분류', '');
                    handlePerformanceInputChange('성과항목ID', '');
                    handlePerformanceInputChange('성과항목', '');
                    handlePerformanceInputChange('단위', '');
                    handlePerformanceInputChange('현재수준', '');
                    handlePerformanceInputChange('목표수준', '');
                    handlePerformanceInputChange('실적수준', '');
                  }}
                  style={{ minWidth: '100px', maxWidth: '120px' }}
                >
                  {yearOptions.map(year => (
                    <option key={year} value={year}>{year === '전체' ? '전체' : `${year}년`}</option>
                  ))}
                </Select>
              </div>

              <span style={{ fontSize: '0.75rem', color: '#6b7280', fontStyle: 'italic' }}>
                * 기본 선택: 과제년도 설정과 연동
              </span>
            </div>

            {/* 성과 입력 줄: 대분류, 소분류, 성과 항목, 성과 기여도 (2:2:5:1 비율) */}
            <div className="input-row">
              <div>
                <Label>
                  대분류
                  <FilterHint>필터</FilterHint>
                </Label>
                <Select
                  ref={categorySelectRef}
                  value={performanceInput.대분류ID || ''}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  onKeyDown={handlePerformanceKeyDown}
                >
                  <option value="">전체</option>
                  {performanceCategories.map(category => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </Select>
              </div>

              <div>
                <Label>
                  소분류
                  <FilterHint>필터</FilterHint>
                </Label>
                <Select
                  value={performanceInput.소분류ID || ''}
                  onChange={(e) => handleSubcategoryChange(e.target.value)}
                  onKeyDown={handlePerformanceKeyDown}
                >
                  <option value="">전체</option>
                  {subcategoryOptions.map(subcategory => (
                    <option key={subcategory.id} value={subcategory.id}>{subcategory.label}</option>
                  ))}
                </Select>
              </div>

              <div>
                <Label>
                  성과 항목 <span className="required">*</span>
                  {(performanceInput.대분류ID || performanceInput.소분류ID) && (
                    <FilterClearButton type="button" onClick={clearCategoryFilters}>
                      필터 해제
                    </FilterClearButton>
                  )}
                </Label>
                <SearchableDropdown ref={performanceItemDropdownRef}>
                  <SearchableDropdownInput
                    type="text"
                    placeholder={performanceInput.성과항목 || '성과 이름으로 검색…'}
                    value={performanceItemSearchTerm}
                    onChange={(e) => {
                      setPerformanceItemSearchTerm(e.target.value);
                      setIsPerformanceItemDropdownOpen(true);
                    }}
                    onFocus={() => setIsPerformanceItemDropdownOpen(true)}
                    onKeyDown={handlePerformanceKeyDown}
                    $hasValue={!!performanceInput.성과항목ID}
                  />
                  {isPerformanceItemDropdownOpen && (
                    <SearchableDropdownList>
                      {searchableItems.slice(0, 100).map(item => (
                        <SearchableDropdownItem
                          key={item.uniqueKey}
                          onClick={() => {
                            handleItemChange(item.uniqueKey);
                            setPerformanceItemSearchTerm('');
                            setIsPerformanceItemDropdownOpen(false);
                          }}
                        >
                          <span>{item.name}</span>
                          {/* 분류를 안 좁혔을 때는 어느 분류의 항목인지 함께 보여준다 */}
                          {!performanceInput.소분류ID && (item.categoryName || item.subcategoryName) && (
                            <ItemPath>{item.categoryName} &gt; {item.subcategoryName}</ItemPath>
                          )}
                        </SearchableDropdownItem>
                      ))}
                      {searchableItems.length > 100 && (
                        <SearchableDropdownEmpty>
                          {searchableItems.length.toLocaleString()}건 중 100건만 표시 — 검색어를 더 입력하세요
                        </SearchableDropdownEmpty>
                      )}
                      {searchableItems.length === 0 && (
                        <SearchableDropdownEmpty>
                          검색 결과가 없습니다
                        </SearchableDropdownEmpty>
                      )}
                    </SearchableDropdownList>
                  )}
                </SearchableDropdown>
              </div>
              
              <div>
                <Label>기여도 <span className="required">*</span></Label>
                <PercentInputContainer>
                  <Input
                    type="text"
                    value={performanceInput.과제기여도 || ''}
                    onChange={(e) => handleContributionValueChange(e.target.value)}
                    onKeyDown={handlePerformanceKeyDown}
                    placeholder="0~100"
                    title="0부터 100까지 숫자만 입력 가능합니다"
                  />
                  <span className="percent-symbol">%</span>
                </PercentInputContainer>
              </div>
            </div>

            {/* 선택된 성과 항목의 정보 표시 */}
            {performanceInput.성과항목ID && (
              <InfoDisplayContainer>
                <div className="info-title">선택된 성과 항목 정보</div>
                <div className="info-grid">
                  <div className="info-item">
                    <strong>단위:</strong>
                    <span>{performanceInput.단위 || '-'}</span>
                  </div>
                  <div className="info-item">
                    <strong>현재 수준:</strong>
                    <span>{levelText(performanceInput.현재수준, '-')} {performanceInput.단위}</span>
                  </div>
                  <div className="info-item">
                    <strong>목표 수준:</strong>
                    <span>{levelText(performanceInput.목표수준, '-')} {performanceInput.단위}</span>
                  </div>
                  {performanceInput.월별실적여부 ? (
                    <div className="info-item" style={{ gridColumn: '1 / -1' }}>
                      <strong>실적 관리:</strong>
                      <span style={{ color: '#1e40af', fontWeight: 600 }}>월별 실적 관리</span>
                    </div>
                  ) : hasLevel(performanceInput.실적수준) ? (
                    <div className="info-item">
                      <strong>실적 수준:</strong>
                      <span>{performanceInput.실적수준} {performanceInput.단위}</span>
                    </div>
                  ) : null}
                </div>
              </InfoDisplayContainer>
            )}

            {/* 버튼 행 */}
            <div className="button-row">
              <AddButton
                type="button"
                onClick={handleAddPerformance}
                disabled={!canAddPerformance}
                title={canAddPerformance
                       ? "성과 항목 추가"
                       : "기여도가 입력되었는지 확인하고, 추가하고자 하는 성과 항목의 현재, 목표 수준이 모두 입력되어있는지 확인하세요"}
              >
                <Plus size={16} />
                추가
              </AddButton>
            </div>
          </PerformanceInputContainer>
        </div>
        
        {/* 성과 목록 */}
        {formData.성과목록 && formData.성과목록.length > 0 && (
          <div>
            <Label>등록된 성과 ({formData.성과목록.length}개)</Label>
            <PerformanceList>
              {formData.성과목록.map((row, index) => {
                // 사본이 아니라 **지금의 정의**로 그린다 (withLiveDefinition 머리말).
                // 삭제·기여도 수정은 여전히 index 로 원본 배열을 건드린다.
                const performance = withLiveDefinition(row);
                return (
                <PerformanceItem key={index}>
                  <div className="performance-info">
                    <div className="main-category">{getCategoryName(performance.대분류ID || performance.대분류)}</div>
                    <div className="sub-category">{getSubcategoryName(performance.소분류ID || performance.소분류)}</div>
                    <div className="performance-text">{getItemName(performance.성과항목ID, performance.성과항목UUID || performance.성과UUID) || performance.성과항목}</div>
                    <div className="metrics-info">
                      <div className="level-info">
                        <span className="label">성과 기여도: </span>
                        {editingContributionIndex === index ? (
                          <InlineContributionInput
                            type="text"
                            value={editingContributionValue}
                            onChange={(e) => setEditingContributionValue(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
                            onKeyDown={(e) => handleContributionKeyDown(e, index)}
                            onBlur={() => handleSaveContribution(index)}
                            autoFocus
                            placeholder="0-100"
                          />
                        ) : (
                          <EditableContribution
                            onClick={() => handleStartEditContribution(index, performance.과제기여도)}
                            title="클릭하여 기여도 수정"
                          >
                            {performance.과제기여도}%
                            <Pencil size={12} className="edit-icon" />
                          </EditableContribution>
                        )}
                        {' | '}
                        <span className="label">현재: </span>{performance.현재수준} {performance.단위} |
                        <span className="label"> 목표: </span>{performance.목표수준} {performance.단위}
                        {performance.월별실적여부 ? (
                          <>
                            <span className="label"> | 실적: </span>
                            <span style={{ color: '#1e40af', fontWeight: 600 }}>월별 관리</span>
                          </>
                        ) : performance.실적수준 ? (
                          <>
                            <span className="label"> | 실적: </span>{performance.실적수준} {performance.단위}
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <ButtonGroup>
                    {onEditPerformanceInModal && (
                      <EditButton
                        type="button"
                        onClick={() => onEditPerformanceInModal(performance)}
                        title="성과 항목 수정"
                      >
                        <Pencil size={14} />
                      </EditButton>
                    )}
                    <RemoveButton
                      type="button"
                      onClick={() => removePerformanceFromList(index)}
                      title="성과 삭제"
                    >
                      ×
                    </RemoveButton>
                  </ButtonGroup>
                </PerformanceItem>
                );
              })}
            </PerformanceList>
          </div>
        )}
        
        {errors.성과목록 && <ErrorMessage>{errors.성과목록}</ErrorMessage>}
      </PerformanceContainer>
    </RemarksSection>
  );
};

export default PerformanceSection;