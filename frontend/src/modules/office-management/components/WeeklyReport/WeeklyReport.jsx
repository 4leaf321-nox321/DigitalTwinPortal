import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { Calendar, Plus, FileText, Trash2, Edit2, X, Link2, CalendarDays, List, ChevronRight, Search, Loader, Paperclip, Download, Upload, AlertTriangle, Check, FolderDown } from 'lucide-react';
import { officeApi } from '../../services/officeApi';
import { todayLocalYmd } from '../../../../shared/utils/localDate';

// 검색 가능한 드롭다운 컴포넌트
const SearchableSelect = ({ value, onChange, options, placeholder = '검색...' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const filteredOptions = useMemo(() => {
    if (!searchText) return options;
    const lower = searchText.toLowerCase();
    return options.filter(opt => opt.toLowerCase().includes(lower));
  }, [options, searchText]);

  // "연결 안함" 옵션을 포함한 전체 옵션 리스트
  const allOptions = useMemo(() => ['', ...filteredOptions], [filteredOptions]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 드롭다운이 열릴 때 현재 선택된 값의 인덱스로 하이라이트 설정
  useEffect(() => {
    if (isOpen) {
      const currentIndex = allOptions.findIndex(opt => opt === value);
      setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
    }
  }, [isOpen, allOptions, value]);

  // 하이라이트된 항목이 보이도록 스크롤
  useEffect(() => {
    if (isOpen && listRef.current && highlightedIndex >= 0) {
      const items = listRef.current.querySelectorAll('[data-dropdown-item]');
      if (items[highlightedIndex]) {
        items[highlightedIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = (option) => {
    onChange(option);
    setSearchText('');
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setSearchText('');
  };

  const handleInputChange = (e) => {
    setSearchText(e.target.value);
    if (!isOpen) setIsOpen(true);
    setHighlightedIndex(0); // 검색어 변경 시 첫 번째 항목으로 리셋
  };

  const handleFocus = () => {
    setIsOpen(true);
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < allOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : prev);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < allOptions.length) {
          handleSelect(allOptions[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
      default:
        break;
    }
  };

  const displayValue = isOpen ? searchText : value || '';

  return (
    <SearchableSelectContainer ref={containerRef}>
      <SearchInput
        ref={inputRef}
        value={displayValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={value ? value : placeholder}
        isOpen={isOpen}
      />
      {value && !isOpen && (
        <ClearButton onClick={handleClear}>
          <X size={12} />
        </ClearButton>
      )}
      {isOpen && (
        <DropdownList ref={listRef}>
          <DropdownItem
            data-dropdown-item
            selected={!value}
            highlighted={highlightedIndex === 0}
            onClick={() => handleSelect('')}
            onMouseEnter={() => setHighlightedIndex(0)}
          >
            연결 안함
          </DropdownItem>
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => (
              <DropdownItem
                key={option}
                data-dropdown-item
                selected={option === value}
                highlighted={highlightedIndex === index + 1}
                onClick={() => handleSelect(option)}
                onMouseEnter={() => setHighlightedIndex(index + 1)}
              >
                {option}
              </DropdownItem>
            ))
          ) : (
            <NoResults>검색 결과 없음</NoResults>
          )}
        </DropdownList>
      )}
    </SearchableSelectContainer>
  );
};

const Container = styled.div`
  display: flex;
  flex: 1;
  height: 100%;
  overflow: hidden;
`;

// 좌측 마스터 패널
const MasterPanel = styled.div`
  width: 280px;
  min-width: 280px;
  background: white;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
`;

const MasterHeader = styled.div`
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const MasterTitle = styled.h2`
  font-size: 1rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const AddButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.75rem;
  background: #4f46e5;
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #4338ca;
  }
`;

const MasterList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
`;

const SearchBox = styled.div`
  padding: 0.5rem;
  border-bottom: 1px solid #e2e8f0;
`;

const SearchInputWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const SearchIcon = styled.div`
  position: absolute;
  left: 0.75rem;
  color: #94a3b8;
  display: flex;
  align-items: center;
  pointer-events: none;
`;

const AgendaSearchInput = styled.input`
  width: 100%;
  padding: 0.5rem 0.75rem 0.5rem 2.25rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  font-size: 0.8rem;
  transition: border-color 0.2s;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: #4f46e5;
    box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.1);
  }

  &::placeholder {
    color: #94a3b8;
  }
`;

const EmptySearchResult = styled.div`
  padding: 1.5rem 1rem;
  text-align: center;
  color: #94a3b8;
  font-size: 0.875rem;
`;

const ListItem = styled.div`
  padding: 0.875rem 1rem;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: ${props => props.selected ? '#eef2ff' : 'transparent'};
  border: 1px solid ${props => props.selected ? '#c7d2fe' : 'transparent'};

  &:hover {
    background: ${props => props.selected ? '#eef2ff' : '#f8fafc'};
  }
`;

const ItemInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const ItemTitle = styled.div`
  font-size: 0.875rem;
  font-weight: 600;
  color: #1e293b;
`;

const ItemSubtitle = styled.div`
  font-size: 0.75rem;
  color: #64748b;
`;

const ItemCount = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: #64748b;
  background: #f1f5f9;
  padding: 0.25rem 0.5rem;
  border-radius: 1rem;
`;

const ItemActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const DeleteWeekButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: #94a3b8;
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 12px;
  opacity: 0;
  transition: all 0.2s;

  ${ListItem}:hover & {
    opacity: 1;
  }

  &:hover {
    background: #fee2e2;
    color: #ef4444;
  }
`;

// 우측 디테일 패널
const DetailPanel = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #f8fafc;
  overflow: hidden;
`;

const DetailHeader = styled.div`
  padding: 1rem 1.5rem;
  background: white;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const DetailTitleSection = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const DetailTitle = styled.h2`
  font-size: 1.125rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
`;

const DetailSubtitle = styled.span`
  font-size: 0.875rem;
  color: #64748b;
  font-weight: 400;
  margin-left: 0.75rem;
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const AddAgendaButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #4f46e5;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #4338ca;
  }
`;

const DownloadAllButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #059669;
  }
`;

const AgendaList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  align-content: start;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const AllViewWeekHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 1rem;
  background: #eef2ff;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 700;
  color: #4338ca;
  grid-column: 1 / -1;
  position: sticky;
  top: 0;
  z-index: 5;
`;

const AllViewWeekDate = styled.span`
  font-size: 0.75rem;
  font-weight: 400;
  color: #6366f1;
`;

const AllViewWeekCount = styled.span`
  margin-left: auto;
  font-size: 0.75rem;
  font-weight: 500;
  color: #818cf8;
`;

const AgendaCard = styled.div`
  background: white;
  border-radius: 0.75rem;
  border: 1px solid #e2e8f0;
  overflow: hidden;
  transition: box-shadow 0.2s;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  }
`;

const AgendaHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
  border-bottom: 1px solid #c7d2fe;
`;

const AgendaTitle = styled.h3`
  font-size: 0.9rem;
  font-weight: 600;
  color: #3730a3;
  margin: 0;
  line-height: 1.4;
`;

const AgendaActions = styled.div`
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
`;

const IconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: rgba(255, 255, 255, 0.5);
  color: #4338ca;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;

  &:hover {
    background: rgba(255, 255, 255, 0.9);
    color: ${props => props.danger ? '#ef4444' : '#4f46e5'};
  }
`;

const AgendaContent = styled.div`
  padding: 1rem 1.25rem;
  font-size: 0.875rem;
  color: #475569;
  line-height: 1.6;
  white-space: pre-wrap;
`;

const LinkedAgendaInfo = styled.div`
  padding: 0.5rem 1rem;
  background: #fefce8;
  border-top: 1px solid #fef08a;
  font-size: 0.75rem;
  color: #854d0e;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const AttachmentSection = styled.div`
  padding: 0.5rem 1rem;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
`;

const AttachmentList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
`;

const AttachmentItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.5rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  color: #475569;
  transition: all 0.2s;

  &:hover {
    background: #eef2ff;
    border-color: #c7d2fe;
  }

  svg {
    flex-shrink: 0;
  }
`;

const AttachmentDownloadBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 0;
  font-size: inherit;

  &:hover {
    color: #4f46e5;
  }
`;

const AttachmentDeleteBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  border-radius: 0.25rem;
  padding: 0;
  margin-left: 0.25rem;
  opacity: 0;
  transition: all 0.2s;

  ${AttachmentItem}:hover & {
    opacity: 1;
  }

  &:hover {
    background: #fee2e2;
    color: #ef4444;
  }
`;

const AttachmentName = styled.span`
  word-break: break-all;
`;

const LoadingState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: #64748b;
  gap: 1rem;

  svg {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

const ErrorState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: #ef4444;
  gap: 1rem;
  text-align: center;
`;

const EmptyState = styled.div`
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  gap: 1rem;
  padding: 3rem 1rem;
`;

const EmptyIcon = styled.div`
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const EmptyText = styled.div`
  font-size: 0.875rem;
`;

// 안건별 보기 스타일
const AgendaTimelineList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
`;

const TimelineCard = styled.div`
  background: white;
  border-radius: 0.75rem;
  border: 1px solid #e2e8f0;
  margin-bottom: 1rem;
  overflow: hidden;
`;

const TimelineHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  border-bottom: 1px solid #bbf7d0;
`;

const TimelineTitle = styled.h3`
  font-size: 1rem;
  font-weight: 600;
  color: #166534;
  margin: 0;
`;

const TimelineWeekCount = styled.span`
  font-size: 0.75rem;
  color: #15803d;
  background: white;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
`;

const TimelineEntries = styled.div`
  padding: 0.5rem 0;
`;

const TimelineEntry = styled.div`
  display: flex;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid #f1f5f9;

  &:last-child {
    border-bottom: none;
  }
`;

const TimelineWeek = styled.div`
  width: 120px;
  flex-shrink: 0;
  font-size: 0.8rem;
  font-weight: 500;
  color: #4f46e5;
`;

const TimelineContent = styled.div`
  flex: 1;
  font-size: 0.875rem;
  color: #475569;
  white-space: pre-wrap;
  line-height: 1.5;
`;

// 모달 스타일
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

const Modal = styled.div`
  background: white;
  border-radius: 0.75rem;
  width: 100%;
  max-width: 1250px;
  max-height: 85vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e2e8f0;
`;

const ModalTitle = styled.h3`
  font-size: 1.125rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
`;

const ModalCloseButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: #64748b;
  border-radius: 0.375rem;
  cursor: pointer;

  &:hover {
    background: #f1f5f9;
  }
`;

const ModalContent = styled.div`
  padding: 1.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Label = styled.label`
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
`;

const Input = styled.input`
  padding: 0.625rem 0.875rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: #4f46e5;
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
  }
`;

const Select = styled.select`
  padding: 0.625rem 0.875rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  background: white;
  cursor: pointer;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: #4f46e5;
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
  }
`;

// 검색 가능한 드롭다운 스타일
const SearchableSelectContainer = styled.div`
  position: relative;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 0.625rem 0.875rem;
  border: 1px solid ${props => props.isOpen ? '#4f46e5' : '#e2e8f0'};
  border-radius: 0.5rem;
  font-size: 0.875rem;
  transition: border-color 0.2s;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: #4f46e5;
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
  }

  &::placeholder {
    color: #94a3b8;
  }
`;

const DropdownList = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  margin-top: 0.25rem;
  max-height: 200px;
  overflow-y: auto;
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
`;

const DropdownItem = styled.div`
  padding: 0.625rem 0.875rem;
  font-size: 0.875rem;
  cursor: pointer;
  background: ${props => props.highlighted ? '#e0e7ff' : props.selected ? '#eef2ff' : 'white'};
  color: ${props => props.highlighted || props.selected ? '#4f46e5' : '#374151'};

  &:hover {
    background: ${props => props.selected ? '#eef2ff' : '#f8fafc'};
  }

  &:first-child {
    border-radius: 0.5rem 0.5rem 0 0;
  }

  &:last-child {
    border-radius: 0 0 0.5rem 0.5rem;
  }
`;

const NoResults = styled.div`
  padding: 0.75rem;
  font-size: 0.875rem;
  color: #94a3b8;
  text-align: center;
`;

const ClearButton = styled.button`
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  background: #e2e8f0;
  color: #64748b;
  border-radius: 50%;
  cursor: pointer;
  font-size: 0.75rem;

  &:hover {
    background: #cbd5e1;
    color: #475569;
  }
`;

const FormRow = styled.div`
  display: flex;
  gap: 1rem;

  & > * {
    flex: 1;
  }
`;

const WeekPreview = styled.div`
  padding: 0.75rem 1rem;
  background: #f1f5f9;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  color: #475569;
  text-align: center;
`;

// 파일 업로드 관련 스타일
const FileUploadSection = styled.div`
  border: 2px dashed #e2e8f0;
  border-radius: 0.5rem;
  padding: 1rem;
  transition: all 0.2s;

  &:hover {
    border-color: #c7d2fe;
    background: #fafaff;
  }
`;

const FileUploadHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
`;

const FileUploadLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #4f46e5;
  color: white;
  border-radius: 0.375rem;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #4338ca;
  }
`;

const HiddenFileInput = styled.input`
  display: none;
`;

const UploadedFileList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const UploadedFileItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
`;

const FileInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
`;

const FileName = styled.span`
  font-size: 0.8rem;
  color: #374151;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const FileSize = styled.span`
  font-size: 0.7rem;
  color: #94a3b8;
  flex-shrink: 0;
`;

const FileActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-left: 0.5rem;
`;

const FileActionButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: #64748b;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: ${props => props.danger ? '#fee2e2' : '#f1f5f9'};
    color: ${props => props.danger ? '#ef4444' : '#4f46e5'};
  }
`;

const UploadingIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: #64748b;
  padding: 0.5rem;

  svg {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

const EmptyFileList = styled.div`
  text-align: center;
  padding: 1rem;
  color: #94a3b8;
  font-size: 0.8rem;
`;

const TextArea = styled.textarea`
  padding: 0.625rem 0.875rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  min-height: 350px;
  resize: vertical;
  font-family: inherit;
  line-height: 1.5;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: #4f46e5;
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
  }
`;

// 충돌 비교 모달 스타일
const ConflictModal = styled.div`
  background: white;
  border-radius: 0.75rem;
  width: 100%;
  max-width: 1400px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const ConflictHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-bottom: 1px solid #f59e0b;
`;

const ConflictTitle = styled.h3`
  font-size: 1.125rem;
  font-weight: 600;
  color: #92400e;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ConflictDescription = styled.p`
  font-size: 0.875rem;
  color: #a16207;
  margin: 0;
  margin-left: auto;
`;

const ConflictContent = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
`;

const ConflictPane = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  border-right: ${props => props.$isLeft ? '1px solid #e2e8f0' : 'none'};
  overflow: hidden;
`;

const ConflictPaneHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: ${props => props.$selected ? '#eef2ff' : '#f8fafc'};
  border-bottom: 1px solid #e2e8f0;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: ${props => props.$selected ? '#eef2ff' : '#f1f5f9'};
  }
`;

const ConflictPaneTitle = styled.div`
  font-size: 0.875rem;
  font-weight: 600;
  color: ${props => props.$selected ? '#4f46e5' : '#475569'};
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ConflictPaneTime = styled.span`
  font-size: 0.75rem;
  color: #94a3b8;
  font-weight: 400;
`;

const SelectButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: ${props => props.$selected ? '#4f46e5' : 'white'};
  color: ${props => props.$selected ? 'white' : '#64748b'};
  border: 1px solid ${props => props.$selected ? '#4f46e5' : '#e2e8f0'};
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: ${props => props.$selected ? '#4338ca' : '#f8fafc'};
  }
`;

const ConflictPaneBody = styled.div`
  flex: 1;
  padding: 1rem;
  overflow-y: auto;
  background: ${props => props.$selected ? '#fafaff' : 'white'};
`;

const ConflictFieldGroup = styled.div`
  margin-bottom: 1rem;

  &:last-child {
    margin-bottom: 0;
  }
`;

const ConflictFieldLabel = styled.div`
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
  margin-bottom: 0.375rem;
  text-transform: uppercase;
  letter-spacing: 0.025em;
`;

const ConflictFieldValue = styled.div`
  font-size: 0.875rem;
  color: #1e293b;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  padding: 0.625rem 0.75rem;
  white-space: pre-wrap;
  line-height: 1.5;
  max-height: 300px;
  overflow-y: auto;
`;

const ConflictEditSection = styled.div`
  padding: 1rem 1.5rem;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
`;

const ConflictEditHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
`;

const ConflictEditTitle = styled.div`
  font-size: 0.875rem;
  font-weight: 600;
  color: #1e293b;
`;

const ConflictEditHint = styled.div`
  font-size: 0.75rem;
  color: #64748b;
`;

const ConflictEditArea = styled.textarea`
  width: 100%;
  padding: 0.625rem 0.875rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  min-height: 150px;
  resize: vertical;
  font-family: inherit;
  line-height: 1.5;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: #4f46e5;
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
  }
`;

const ConflictFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid #e2e8f0;
  background: white;
`;

const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
`;

const Button = styled.button`
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  ${props => props.primary ? `
    background: #4f46e5;
    color: white;
    border: none;

    &:hover {
      background: #4338ca;
    }
  ` : `
    background: white;
    color: #64748b;
    border: 1px solid #e2e8f0;

    &:hover {
      background: #f8fafc;
    }
  `}
`;

// 유틸리티 함수
const getWeekNumber = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return weekNo;
};

const getWeekDateRange = (year, week) => {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const startDate = new Date(simple);
  if (dow <= 4)
    startDate.setDate(simple.getDate() - simple.getDay() + 1);
  else
    startDate.setDate(simple.getDate() + 8 - simple.getDay());
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);

  const formatDate = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
};

// 파일 크기 포맷
const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const WeeklyReport = ({ viewMode = 'weekly', onViewModeChange, onRegisterBulkAddHandler, onRegisterExportHandler }) => {
  const currentYear = new Date().getFullYear();
  const currentWeek = getWeekNumber(new Date());

  // 서버에서 데이터 로드
  const [weeks, setWeeks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedWeekId, setSelectedWeekId] = useState(null);
  const [selectedAgendaTitle, setSelectedAgendaTitle] = useState(null);
  const [isAddAgendaModalOpen, setIsAddAgendaModalOpen] = useState(false);
  const [isAddWeekModalOpen, setIsAddWeekModalOpen] = useState(false);
  const [editingAgenda, setEditingAgenda] = useState(null);
  const [agendaForm, setAgendaForm] = useState({ title: '', content: '', linkedAgendaTitle: '' });
  const [weekForm, setWeekForm] = useState({ year: currentYear, week: currentWeek });
  const [agendaSearchText, setAgendaSearchText] = useState('');

  // 첨부파일 관련 상태
  const [pendingFiles, setPendingFiles] = useState([]); // 새로 추가할 파일들
  const [existingAttachments, setExistingAttachments] = useState([]); // 기존 첨부파일
  const [deletedAttachmentIds, setDeletedAttachmentIds] = useState([]); // 삭제할 첨부파일 ID
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  // 충돌 비교 모달 관련 상태
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [conflictData, setConflictData] = useState(null); // { myData, serverData }
  const [selectedVersion, setSelectedVersion] = useState('mine'); // 'mine' | 'server'
  const [conflictEditContent, setConflictEditContent] = useState('');

  const selectedWeek = weeks.find(w => w.id === selectedWeekId);

  // 서버에서 데이터 로드
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await officeApi.getWeeks();
      setWeeks(data);
      if (data.length > 0 && !selectedWeekId) {
        setSelectedWeekId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedWeekId]);

  useEffect(() => {
    loadData();
  }, []);

  // 모든 안건 제목 목록 (중복 제거)
  const allAgendaTitles = useMemo(() => {
    const titles = new Set();
    weeks.forEach(week => {
      week.agendas.forEach(agenda => {
        titles.add(agenda.title);
      });
    });
    return Array.from(titles).sort();
  }, [weeks]);

  // 검색어로 필터링된 안건 제목 목록
  const filteredAgendaTitles = useMemo(() => {
    if (!agendaSearchText.trim()) return allAgendaTitles;
    const searchLower = agendaSearchText.toLowerCase();
    return allAgendaTitles.filter(title =>
      title.toLowerCase().includes(searchLower)
    );
  }, [allAgendaTitles, agendaSearchText]);

  // 안건별 보기로 전환 시 첫 번째 안건 자동 선택
  useEffect(() => {
    if (viewMode === 'agenda' && !selectedAgendaTitle && allAgendaTitles.length > 0) {
      setSelectedAgendaTitle(allAgendaTitles[0]);
    }
  }, [viewMode, selectedAgendaTitle, allAgendaTitles]);

  // 안건별 보기를 위한 데이터 구조
  const agendaByTitle = useMemo(() => {
    const map = {};
    weeks.forEach(week => {
      week.agendas.forEach(agenda => {
        if (!map[agenda.title]) {
          map[agenda.title] = [];
        }
        map[agenda.title].push({
          ...agenda,
          weekId: week.id,
          year: week.year,
          week: week.week,
        });
      });
    });
    // 각 안건 내에서 주차순 정렬
    Object.keys(map).forEach(title => {
      map[title].sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.week - a.week;
      });
    });
    return map;
  }, [weeks]);

  // 년도에 따른 최대 주차 계산 (ISO 8601 기준)
  const getMaxWeeksInYear = useCallback((year) => {
    const dec28 = new Date(year, 11, 28);
    const d = new Date(dec28);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }, []);

  const handleOpenAddWeek = useCallback(() => {
    setWeekForm({ year: currentYear, week: currentWeek });
    setIsAddWeekModalOpen(true);
  }, [currentYear, currentWeek]);

  const handleCloseWeekModal = useCallback(() => {
    setIsAddWeekModalOpen(false);
  }, []);

  const handleAddWeek = useCallback(async () => {
    const exists = weeks.some(w => w.year === weekForm.year && w.week === weekForm.week);
    if (exists) {
      alert('이미 존재하는 주차입니다.');
      return;
    }

    try {
      const newWeek = await officeApi.createWeek(weekForm.year, weekForm.week);
      setWeeks(prev => {
        const updated = [newWeek, ...prev];
        return updated.sort((a, b) => {
          if (a.year !== b.year) return b.year - a.year;
          return b.week - a.week;
        });
      });
      setSelectedWeekId(newWeek.id);
      handleCloseWeekModal();
    } catch (err) {
      alert('주차 추가에 실패했습니다: ' + err.message);
    }
  }, [weekForm, weeks, handleCloseWeekModal]);

  const handleOpenAddAgenda = useCallback(() => {
    setAgendaForm({ title: '', content: '', linkedAgendaTitle: '' });
    setEditingAgenda(null);
    setPendingFiles([]);
    setExistingAttachments([]);
    setDeletedAttachmentIds([]);
    setIsAddAgendaModalOpen(true);
  }, []);

  const handleOpenEditAgenda = useCallback((agenda) => {
    setAgendaForm({
      title: agenda.title,
      content: agenda.content,
      linkedAgendaTitle: agenda.linkedAgendaTitle || ''
    });
    setEditingAgenda(agenda);
    setPendingFiles([]);
    setExistingAttachments(agenda.attachments || []);
    setDeletedAttachmentIds([]);
    setIsAddAgendaModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsAddAgendaModalOpen(false);
    setEditingAgenda(null);
    setAgendaForm({ title: '', content: '', linkedAgendaTitle: '' });
    setPendingFiles([]);
    setExistingAttachments([]);
    setDeletedAttachmentIds([]);
  }, []);

  const handleSaveAgenda = useCallback(async () => {
    if (!agendaForm.title.trim()) return;

    try {
      setIsUploading(true);
      let agendaId;

      if (editingAgenda) {
        // 수정 (낙관적 잠금을 위해 updated_at 전송)
        const updatedAgenda = await officeApi.updateAgenda(
          editingAgenda.id,
          {
            title: agendaForm.title,
            content: agendaForm.content,
            linkedAgendaTitle: agendaForm.linkedAgendaTitle || null
          },
          editingAgenda.updated_at  // 원본 updated_at 전송
        );
        agendaId = editingAgenda.id;

        // 삭제 표시된 첨부파일 삭제
        for (const attachmentId of deletedAttachmentIds) {
          try {
            await officeApi.deleteAttachment(attachmentId);
          } catch (err) {
            console.error('Failed to delete attachment:', err);
          }
        }
      } else {
        // 신규 추가
        const newAgenda = await officeApi.createAgenda(
          selectedWeekId,
          agendaForm.title,
          agendaForm.content,
          agendaForm.linkedAgendaTitle || null
        );
        agendaId = newAgenda.id;
      }

      // 새 파일 업로드
      for (const file of pendingFiles) {
        try {
          await officeApi.uploadAttachment(agendaId, file);
        } catch (err) {
          console.error('Failed to upload file:', err);
        }
      }

      // 데이터 다시 로드
      await loadData();
      handleCloseModal();
    } catch (err) {
      // 낙관적 잠금 충돌 처리 - 비교 모달 열기
      if (err.isConflict && err.conflictData?.current) {
        const serverData = err.conflictData.current;
        setConflictData({
          myData: {
            title: agendaForm.title,
            content: agendaForm.content,
            linkedAgendaTitle: agendaForm.linkedAgendaTitle,
            updated_at: editingAgenda?.updated_at
          },
          serverData: {
            title: serverData.title,
            content: serverData.content,
            linkedAgendaTitle: serverData.linkedAgendaTitle,
            updated_at: serverData.updated_at
          }
        });
        setSelectedVersion('mine');
        setConflictEditContent(agendaForm.content);
        setIsConflictModalOpen(true);
      } else {
        alert('안건 저장에 실패했습니다: ' + err.message);
      }
    } finally {
      setIsUploading(false);
    }
  }, [selectedWeekId, agendaForm, editingAgenda, pendingFiles, deletedAttachmentIds, handleCloseModal, loadData]);

  // 충돌 버전 선택 핸들러
  const handleSelectVersion = useCallback((version) => {
    setSelectedVersion(version);
    if (conflictData) {
      const content = version === 'mine' ? conflictData.myData.content : conflictData.serverData.content;
      setConflictEditContent(content || '');
    }
  }, [conflictData]);

  // 충돌 해결 후 저장
  const handleResolveConflict = useCallback(async () => {
    if (!editingAgenda || !conflictData) return;

    try {
      setIsUploading(true);

      // 선택한 버전의 제목 사용, 내용은 편집된 내용 사용
      const resolvedTitle = selectedVersion === 'mine'
        ? conflictData.myData.title
        : conflictData.serverData.title;

      // 서버의 최신 updated_at으로 강제 저장 (잠금 우회)
      await officeApi.updateAgenda(
        editingAgenda.id,
        {
          title: resolvedTitle,
          content: conflictEditContent,
          linkedAgendaTitle: selectedVersion === 'mine'
            ? conflictData.myData.linkedAgendaTitle
            : conflictData.serverData.linkedAgendaTitle
        },
        conflictData.serverData.updated_at  // 서버의 최신 updated_at 사용
      );

      // 삭제 표시된 첨부파일 삭제
      for (const attachmentId of deletedAttachmentIds) {
        try {
          await officeApi.deleteAttachment(attachmentId);
        } catch (err) {
          console.error('Failed to delete attachment:', err);
        }
      }

      // 새 파일 업로드
      for (const file of pendingFiles) {
        try {
          await officeApi.uploadAttachment(editingAgenda.id, file);
        } catch (err) {
          console.error('Failed to upload file:', err);
        }
      }

      // 데이터 다시 로드
      await loadData();

      // 모달 닫기
      setIsConflictModalOpen(false);
      setConflictData(null);
      handleCloseModal();
    } catch (err) {
      alert('저장에 실패했습니다: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  }, [editingAgenda, conflictData, selectedVersion, conflictEditContent, deletedAttachmentIds, pendingFiles, loadData, handleCloseModal]);

  // 충돌 모달 닫기
  const handleCloseConflictModal = useCallback(() => {
    setIsConflictModalOpen(false);
    setConflictData(null);
  }, []);

  // 파일 선택 핸들러
  const handleFileSelect = useCallback((e) => {
    const files = Array.from(e.target.files);
    setPendingFiles(prev => [...prev, ...files]);
    // 입력 초기화
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // 대기 중인 파일 제거
  const handleRemovePendingFile = useCallback((index) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  // 기존 첨부파일 삭제 표시
  const handleMarkAttachmentForDeletion = useCallback((attachmentId) => {
    setDeletedAttachmentIds(prev => [...prev, attachmentId]);
    setExistingAttachments(prev => prev.filter(a => a.id !== attachmentId));
  }, []);

  // 첨부파일 다운로드
  const handleDownloadAttachment = useCallback((attachment) => {
    const url = officeApi.getAttachmentDownloadUrl(attachment.id);
    window.open(url, '_blank');
  }, []);

  // 주차별 모든 첨부파일 다운로드 (개별 파일)
  const handleDownloadAllWeekAttachments = useCallback(() => {
    if (!selectedWeek) return;

    // 해당 주차의 모든 첨부파일 수집
    const allAttachments = [];
    selectedWeek.agendas.forEach(agenda => {
      if (agenda.attachments && agenda.attachments.length > 0) {
        allAttachments.push(...agenda.attachments);
      }
    });

    if (allAttachments.length === 0) {
      alert('다운로드할 첨부파일이 없습니다.');
      return;
    }

    // 각 파일 개별 다운로드
    allAttachments.forEach(attachment => {
      const url = officeApi.getAttachmentDownloadUrl(attachment.id);
      window.open(url, '_blank');
    });
  }, [selectedWeek]);

  // 안건별 모든 첨부파일 다운로드 (개별 파일)
  const handleDownloadAllAgendaAttachments = useCallback(() => {
    if (!selectedAgendaTitle || !agendaByTitle[selectedAgendaTitle]) return;

    // 해당 안건의 모든 주차에서 첨부파일 수집
    const allAttachments = [];
    agendaByTitle[selectedAgendaTitle].forEach(entry => {
      if (entry.attachments && entry.attachments.length > 0) {
        allAttachments.push(...entry.attachments);
      }
    });

    if (allAttachments.length === 0) {
      alert('다운로드할 첨부파일이 없습니다.');
      return;
    }

    // 각 파일 개별 다운로드
    allAttachments.forEach(attachment => {
      const url = officeApi.getAttachmentDownloadUrl(attachment.id);
      window.open(url, '_blank');
    });
  }, [selectedAgendaTitle, agendaByTitle]);

  // 안건 카드에서 첨부파일 직접 삭제
  const handleDeleteAttachmentFromCard = useCallback(async (e, attachment, agendaId) => {
    e.stopPropagation();
    if (!window.confirm(`"${attachment.originalFilename}" 파일을 삭제하시겠습니까?`)) return;

    try {
      await officeApi.deleteAttachment(attachment.id);
      // 로컬 상태 업데이트
      setWeeks(prev => prev.map(week => ({
        ...week,
        agendas: week.agendas.map(agenda => {
          if (agenda.id !== agendaId) return agenda;
          return {
            ...agenda,
            attachments: agenda.attachments.filter(a => a.id !== attachment.id)
          };
        })
      })));
    } catch (err) {
      alert('파일 삭제에 실패했습니다: ' + err.message);
    }
  }, []);

  const handleDeleteAgenda = useCallback(async (agendaId) => {
    if (!window.confirm('이 안건을 삭제하시겠습니까?')) return;

    try {
      await officeApi.deleteAgenda(agendaId);
      setWeeks(prev => prev.map(week => {
        if (week.id !== selectedWeekId) return week;
        return {
          ...week,
          agendas: week.agendas.filter(a => a.id !== agendaId)
        };
      }));
    } catch (err) {
      alert('안건 삭제에 실패했습니다: ' + err.message);
    }
  }, [selectedWeekId]);

  const handleDeleteWeek = useCallback(async (e, weekId) => {
    e.stopPropagation(); // ListItem 클릭 이벤트 방지
    const weekToDelete = weeks.find(w => w.id === weekId);
    if (!weekToDelete) return;

    const message = weekToDelete.agendas.length > 0
      ? `${weekToDelete.year}년 ${weekToDelete.week}주차를 삭제하시겠습니까?\n(${weekToDelete.agendas.length}개의 안건도 함께 삭제됩니다)`
      : `${weekToDelete.year}년 ${weekToDelete.week}주차를 삭제하시겠습니까?`;

    if (!window.confirm(message)) return;

    try {
      await officeApi.deleteWeek(weekId);
      setWeeks(prev => prev.filter(w => w.id !== weekId));

      // 삭제된 주차가 선택된 주차였다면 다른 주차 선택
      if (selectedWeekId === weekId) {
        const remaining = weeks.filter(w => w.id !== weekId);
        setSelectedWeekId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err) {
      alert('주차 삭제에 실패했습니다: ' + err.message);
    }
  }, [weeks, selectedWeekId]);

  // 연결된 안건 제목이 유효한지 확인
  const isLinkedAgendaTitleValid = useCallback((linkedAgendaTitle) => {
    if (!linkedAgendaTitle) return false;
    return allAgendaTitles.includes(linkedAgendaTitle);
  }, [allAgendaTitles]);

  // 여러 안건 일괄 추가 핸들러
  const handleBulkAdd = useCallback(async (items) => {
    try {
      await officeApi.bulkAddAgendas(items);
      // 데이터 다시 로드
      await loadData();
    } catch (err) {
      alert('안건 일괄 추가에 실패했습니다: ' + err.message);
    }
  }, [loadData]);

  // CSV 내보내기 핸들러
  const handleExportData = useCallback(() => {
    // CSV 형식으로 변환 (연도, 주차, 안건명, 내용)
    const escapeCSV = (str) => {
      if (!str) return '';
      // 쌍따옴표, 쉼표, 줄바꿈이 포함되면 쌍따옴표로 감싸기
      if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headers = ['연도', '주차', '안건명', '내용'];
    const rows = [];

    weeks.forEach(week => {
      week.agendas.forEach(agenda => {
        rows.push([
          week.year,
          week.week,
          escapeCSV(agenda.title),
          escapeCSV(agenda.content)
        ].join(','));
      });
    });

    const csvContent = [headers.join(','), ...rows].join('\n');

    // BOM 추가 (엑셀에서 한글 깨짐 방지)
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

    // 파일 다운로드
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `주간업무_${todayLocalYmd()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [weeks]);

  // 부모 컴포넌트에 핸들러 등록
  useEffect(() => {
    if (onRegisterBulkAddHandler) {
      onRegisterBulkAddHandler(handleBulkAdd);
    }
  }, [onRegisterBulkAddHandler, handleBulkAdd]);

  useEffect(() => {
    if (onRegisterExportHandler) {
      onRegisterExportHandler(handleExportData);
    }
  }, [onRegisterExportHandler, handleExportData]);

  // 로딩 상태
  if (isLoading) {
    return (
      <Container>
        <LoadingState>
          <Loader size={32} />
          <span>데이터를 불러오는 중...</span>
        </LoadingState>
      </Container>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <Container>
        <ErrorState>
          <span>데이터 로드 실패: {error}</span>
          <Button primary onClick={loadData}>다시 시도</Button>
        </ErrorState>
      </Container>
    );
  }

  return (
    <Container>
      {/* 마스터 패널 */}
      <MasterPanel>
        <MasterHeader>
          <MasterTitle>
            {viewMode === 'weekly' ? <Calendar size={18} /> : <List size={18} />}
            {viewMode === 'weekly' ? '주간업무' : '안건 목록'}
          </MasterTitle>
          {viewMode === 'weekly' && (
            <AddButton onClick={handleOpenAddWeek}>
              <Plus size={14} />
              주차 추가
            </AddButton>
          )}
        </MasterHeader>
        {viewMode === 'agenda' && (
          <SearchBox>
            <SearchInputWrapper>
              <SearchIcon>
                <Search size={14} />
              </SearchIcon>
              <AgendaSearchInput
                type="text"
                placeholder="안건 검색..."
                value={agendaSearchText}
                onChange={(e) => setAgendaSearchText(e.target.value)}
              />
            </SearchInputWrapper>
          </SearchBox>
        )}
        <MasterList>
          {viewMode === 'weekly' ? (
            // 주차별 보기 - 주차 목록
            <>
              <ListItem
                selected={selectedWeekId === 'all'}
                onClick={() => setSelectedWeekId('all')}
              >
                <ItemInfo>
                  <ItemTitle>전체 보기</ItemTitle>
                  <ItemSubtitle>모든 주차 안건 ({weeks.reduce((sum, w) => sum + w.agendas.length, 0)}건)</ItemSubtitle>
                </ItemInfo>
                <ItemCount>
                  <CalendarDays size={12} />
                  {weeks.length}
                </ItemCount>
              </ListItem>
              {weeks.map(week => (
                <ListItem
                  key={week.id}
                  selected={week.id === selectedWeekId}
                  onClick={() => setSelectedWeekId(week.id)}
                >
                  <ItemInfo>
                    <ItemTitle>{week.year}년 {week.week}주차</ItemTitle>
                    <ItemSubtitle>{getWeekDateRange(week.year, week.week)}</ItemSubtitle>
                  </ItemInfo>
                  <ItemActions>
                    <ItemCount>
                      <FileText size={12} />
                      {week.agendas.length}
                    </ItemCount>
                    <DeleteWeekButton
                      onClick={(e) => handleDeleteWeek(e, week.id)}
                      title="주차 삭제"
                    >
                      ✕
                    </DeleteWeekButton>
                  </ItemActions>
                </ListItem>
              ))}
            </>
          ) : (
            // 안건별 보기 - 안건 제목 목록 (검색 필터 적용)
            filteredAgendaTitles.length > 0 ? (
              filteredAgendaTitles.map(title => (
                <ListItem
                  key={title}
                  selected={title === selectedAgendaTitle}
                  onClick={() => setSelectedAgendaTitle(title)}
                >
                  <ItemInfo>
                    <ItemTitle>{title}</ItemTitle>
                    <ItemSubtitle>{agendaByTitle[title]?.length || 0}개 주차에 등록</ItemSubtitle>
                  </ItemInfo>
                  <ItemCount>
                    <CalendarDays size={12} />
                    {agendaByTitle[title]?.length || 0}
                  </ItemCount>
                </ListItem>
              ))
            ) : (
              <EmptySearchResult>
                검색 결과가 없습니다
              </EmptySearchResult>
            )
          )}
        </MasterList>
      </MasterPanel>

      {/* 디테일 패널 */}
      <DetailPanel>
        <DetailHeader>
          <DetailTitleSection>
            {viewMode === 'weekly' && selectedWeekId === 'all' ? (
              <DetailTitle>
                전체 주차 보기
                <DetailSubtitle>
                  {weeks.length}개 주차 · {weeks.reduce((sum, w) => sum + w.agendas.length, 0)}건의 안건
                </DetailSubtitle>
              </DetailTitle>
            ) : viewMode === 'weekly' && selectedWeek ? (
              <DetailTitle>
                {selectedWeek.year}년 {selectedWeek.week}주차
                <DetailSubtitle>
                  {getWeekDateRange(selectedWeek.year, selectedWeek.week)}
                </DetailSubtitle>
              </DetailTitle>
            ) : viewMode === 'agenda' && selectedAgendaTitle ? (
              <DetailTitle>{selectedAgendaTitle}</DetailTitle>
            ) : (
              <DetailTitle>
                {viewMode === 'weekly' ? '주차를 선택하세요' : '안건을 선택하세요'}
              </DetailTitle>
            )}
          </DetailTitleSection>
          <HeaderActions>
            {viewMode === 'weekly' && selectedWeek && (
              <>
                <AddAgendaButton onClick={handleOpenAddAgenda}>
                  <Plus size={16} />
                  안건 추가
                </AddAgendaButton>
                <DownloadAllButton
                  onClick={handleDownloadAllWeekAttachments}
                  title="해당 주차의 모든 첨부파일 다운로드"
                >
                  <FolderDown size={16} />
                  모든 파일 다운로드
                </DownloadAllButton>
              </>
            )}
            {viewMode === 'agenda' && selectedAgendaTitle && (
              <DownloadAllButton
                onClick={handleDownloadAllAgendaAttachments}
                title="해당 안건의 모든 첨부파일 다운로드"
              >
                <FolderDown size={16} />
                모든 파일 다운로드
              </DownloadAllButton>
            )}
          </HeaderActions>
        </DetailHeader>

        {viewMode === 'weekly' ? (
          // 주차별 보기
          selectedWeekId === 'all' ? (
            // 전체 주차 보기
            <AgendaList>
              {weeks.length > 0 ? (
                weeks.map(week => (
                  <React.Fragment key={week.id}>
                    <AllViewWeekHeader>
                      <span>{week.year}년 {week.week}주차</span>
                      <AllViewWeekDate>{getWeekDateRange(week.year, week.week)}</AllViewWeekDate>
                      <AllViewWeekCount>{week.agendas.length}건</AllViewWeekCount>
                    </AllViewWeekHeader>
                    {week.agendas.map(agenda => (
                      <AgendaCard key={agenda.id}>
                        <AgendaHeader>
                          <AgendaTitle>{agenda.title}</AgendaTitle>
                          <AgendaActions>
                            <IconButton onClick={() => { setSelectedWeekId(week.id); handleOpenEditAgenda(agenda); }} title="수정">
                              ✏️
                            </IconButton>
                            <IconButton danger onClick={() => { setSelectedWeekId(week.id); handleDeleteAgenda(agenda.id); }} title="삭제">
                              🗑️
                            </IconButton>
                          </AgendaActions>
                        </AgendaHeader>
                        <AgendaContent>{agenda.content}</AgendaContent>
                        {agenda.linkedAgendaTitle && isLinkedAgendaTitleValid(agenda.linkedAgendaTitle) && (
                          <LinkedAgendaInfo>
                            <Link2 size={12} />
                            연결: {agenda.linkedAgendaTitle}
                          </LinkedAgendaInfo>
                        )}
                        {agenda.attachments && agenda.attachments.length > 0 && (
                          <AttachmentSection>
                            <AttachmentList>
                              {agenda.attachments.map(attachment => (
                                <AttachmentItem key={attachment.id}>
                                  <AttachmentDownloadBtn
                                    onClick={() => handleDownloadAttachment(attachment)}
                                    title="클릭하여 다운로드"
                                  >
                                    <Paperclip size={12} />
                                    <AttachmentName>{attachment.originalFilename}</AttachmentName>
                                    <Download size={12} />
                                  </AttachmentDownloadBtn>
                                </AttachmentItem>
                              ))}
                            </AttachmentList>
                          </AttachmentSection>
                        )}
                      </AgendaCard>
                    ))}
                  </React.Fragment>
                ))
              ) : (
                <EmptyState>
                  <EmptyIcon><Calendar size={28} /></EmptyIcon>
                  <EmptyText>등록된 주차가 없습니다.</EmptyText>
                </EmptyState>
              )}
            </AgendaList>
          ) : selectedWeek ? (
            <AgendaList>
              {selectedWeek.agendas.length > 0 ? (
                selectedWeek.agendas.map(agenda => (
                    <AgendaCard key={agenda.id}>
                      <AgendaHeader>
                        <AgendaTitle>{agenda.title}</AgendaTitle>
                        <AgendaActions>
                          <IconButton onClick={() => handleOpenEditAgenda(agenda)} title="수정">
                            ✏️
                          </IconButton>
                          <IconButton danger onClick={() => handleDeleteAgenda(agenda.id)} title="삭제">
                            🗑️
                          </IconButton>
                        </AgendaActions>
                      </AgendaHeader>
                      <AgendaContent>{agenda.content}</AgendaContent>
                      {agenda.linkedAgendaTitle && isLinkedAgendaTitleValid(agenda.linkedAgendaTitle) && (
                        <LinkedAgendaInfo>
                          <Link2 size={12} />
                          연결: {agenda.linkedAgendaTitle}
                        </LinkedAgendaInfo>
                      )}
                      {agenda.attachments && agenda.attachments.length > 0 && (
                        <AttachmentSection>
                          <AttachmentList>
                            {agenda.attachments.map(attachment => (
                              <AttachmentItem key={attachment.id}>
                                <AttachmentDownloadBtn
                                  onClick={() => handleDownloadAttachment(attachment)}
                                  title="클릭하여 다운로드"
                                >
                                  <Paperclip size={12} />
                                  <AttachmentName>{attachment.originalFilename}</AttachmentName>
                                  <Download size={12} />
                                </AttachmentDownloadBtn>
                                <AttachmentDeleteBtn
                                  onClick={(e) => handleDeleteAttachmentFromCard(e, attachment, agenda.id)}
                                  title="삭제"
                                >
                                  <X size={12} />
                                </AttachmentDeleteBtn>
                              </AttachmentItem>
                            ))}
                          </AttachmentList>
                        </AttachmentSection>
                      )}
                    </AgendaCard>
                  ))
              ) : (
                <EmptyState>
                  <EmptyIcon>
                    <FileText size={28} />
                  </EmptyIcon>
                  <EmptyText>등록된 안건이 없습니다.</EmptyText>
                  <AddAgendaButton onClick={handleOpenAddAgenda}>
                    <Plus size={16} />
                    안건 추가
                  </AddAgendaButton>
                </EmptyState>
              )}
            </AgendaList>
          ) : (
            <EmptyState style={{ flex: 1, padding: '3rem' }}>
              <EmptyIcon>
                <Calendar size={28} />
              </EmptyIcon>
              <EmptyText>주차를 선택하거나 추가해주세요.</EmptyText>
            </EmptyState>
          )
        ) : (
          // 안건별 보기
          selectedAgendaTitle && agendaByTitle[selectedAgendaTitle] ? (
            <AgendaTimelineList>
              <TimelineCard>
                <TimelineHeader>
                  <TimelineTitle>{selectedAgendaTitle}</TimelineTitle>
                  <TimelineWeekCount>
                    {agendaByTitle[selectedAgendaTitle].length}개 주차
                  </TimelineWeekCount>
                </TimelineHeader>
                <TimelineEntries>
                  {agendaByTitle[selectedAgendaTitle].map(entry => (
                    <TimelineEntry key={entry.id}>
                      <TimelineWeek>
                        {entry.year}년 {entry.week}주차
                      </TimelineWeek>
                      <TimelineContent>{entry.content}</TimelineContent>
                      {entry.attachments && entry.attachments.length > 0 && (
                        <AttachmentSection>
                          <AttachmentList>
                            {entry.attachments.map(attachment => (
                              <AttachmentItem key={attachment.id}>
                                <AttachmentDownloadBtn
                                  onClick={() => handleDownloadAttachment(attachment)}
                                  title="클릭하여 다운로드"
                                >
                                  <Paperclip size={12} />
                                  <AttachmentName>{attachment.originalFilename}</AttachmentName>
                                  <Download size={12} />
                                </AttachmentDownloadBtn>
                              </AttachmentItem>
                            ))}
                          </AttachmentList>
                        </AttachmentSection>
                      )}
                    </TimelineEntry>
                  ))}
                </TimelineEntries>
              </TimelineCard>
            </AgendaTimelineList>
          ) : (
            <EmptyState style={{ flex: 1, padding: '3rem' }}>
              <EmptyIcon>
                <List size={28} />
              </EmptyIcon>
              <EmptyText>안건을 선택하세요.</EmptyText>
            </EmptyState>
          )
        )}
      </DetailPanel>

      {/* 주차 추가 모달 */}
      {isAddWeekModalOpen && (
        <ModalOverlay onClick={(e) => e.target === e.currentTarget && handleCloseWeekModal()}>
          <Modal>
            <ModalHeader>
              <ModalTitle>주차 추가</ModalTitle>
              <ModalCloseButton onClick={handleCloseWeekModal}>
                <X size={18} />
              </ModalCloseButton>
            </ModalHeader>
            <ModalContent>
              <FormRow>
                <FormGroup>
                  <Label>년도</Label>
                  <Select
                    value={weekForm.year}
                    onChange={(e) => {
                      const newYear = parseInt(e.target.value);
                      const maxWeek = getMaxWeeksInYear(newYear);
                      setWeekForm(prev => ({
                        year: newYear,
                        week: prev.week > maxWeek ? maxWeek : prev.week
                      }));
                    }}
                  >
                    {Array.from({ length: 14 }, (_, i) => currentYear - 3 + i).map(year => (
                      <option key={year} value={year}>{year}년</option>
                    ))}
                  </Select>
                </FormGroup>
                <FormGroup>
                  <Label>주차</Label>
                  <Select
                    value={weekForm.week}
                    onChange={(e) => setWeekForm(prev => ({ ...prev, week: parseInt(e.target.value) }))}
                  >
                    {Array.from({ length: getMaxWeeksInYear(weekForm.year) }, (_, i) => i + 1).map(week => (
                      <option key={week} value={week}>{week}주차</option>
                    ))}
                  </Select>
                </FormGroup>
              </FormRow>
              <WeekPreview>
                {weekForm.year}년 {weekForm.week}주차: {getWeekDateRange(weekForm.year, weekForm.week)}
              </WeekPreview>
            </ModalContent>
            <ModalFooter>
              <Button onClick={handleCloseWeekModal}>취소</Button>
              <Button primary onClick={handleAddWeek}>추가</Button>
            </ModalFooter>
          </Modal>
        </ModalOverlay>
      )}

      {/* 안건 추가/수정 모달 */}
      {isAddAgendaModalOpen && (
        <ModalOverlay onClick={(e) => e.target === e.currentTarget && handleCloseModal()}>
          <Modal>
            <ModalHeader>
              <ModalTitle>{editingAgenda ? '안건 수정' : '안건 추가'}</ModalTitle>
              <ModalCloseButton onClick={handleCloseModal}>
                <X size={18} />
              </ModalCloseButton>
            </ModalHeader>
            <ModalContent>
              <FormGroup>
                <Label>안건 제목</Label>
                <Input
                  type="text"
                  placeholder="안건 제목을 입력하세요"
                  value={agendaForm.title}
                  onChange={(e) => setAgendaForm(prev => ({ ...prev, title: e.target.value }))}
                  autoFocus
                />
              </FormGroup>
              <FormGroup>
                <Label>이전 안건 연결 (선택)</Label>
                <SearchableSelect
                  value={agendaForm.linkedAgendaTitle}
                  onChange={(value) => setAgendaForm(prev => ({
                    ...prev,
                    linkedAgendaTitle: value,
                    title: value || prev.title  // 연결 안건 선택 시 제목 자동 설정
                  }))}
                  options={allAgendaTitles}
                  placeholder="안건 제목 검색..."
                />
              </FormGroup>
              <FormGroup>
                <Label>내용</Label>
                <TextArea
                  placeholder="안건 내용을 입력하세요"
                  value={agendaForm.content}
                  onChange={(e) => setAgendaForm(prev => ({ ...prev, content: e.target.value }))}
                />
              </FormGroup>
              <FormGroup>
                <Label>첨부파일</Label>
                <FileUploadSection>
                  <FileUploadHeader>
                    <FileUploadLabel>
                      <Upload size={14} />
                      파일 선택
                      <HiddenFileInput
                        ref={fileInputRef}
                        type="file"
                        multiple
                        onChange={handleFileSelect}
                      />
                    </FileUploadLabel>
                  </FileUploadHeader>
                  <UploadedFileList>
                    {/* 기존 첨부파일 */}
                    {existingAttachments.map(attachment => (
                      <UploadedFileItem key={attachment.id}>
                        <FileInfo>
                          <Paperclip size={14} />
                          <FileName>{attachment.originalFilename}</FileName>
                          <FileSize>{formatFileSize(attachment.fileSize)}</FileSize>
                        </FileInfo>
                        <FileActions>
                          <FileActionButton
                            onClick={() => handleDownloadAttachment(attachment)}
                            title="다운로드"
                          >
                            <Download size={14} />
                          </FileActionButton>
                          <FileActionButton
                            danger
                            onClick={() => handleMarkAttachmentForDeletion(attachment.id)}
                            title="삭제"
                          >
                            <Trash2 size={14} />
                          </FileActionButton>
                        </FileActions>
                      </UploadedFileItem>
                    ))}
                    {/* 새로 추가할 파일 */}
                    {pendingFiles.map((file, index) => (
                      <UploadedFileItem key={`pending-${index}`}>
                        <FileInfo>
                          <Paperclip size={14} />
                          <FileName>{file.name}</FileName>
                          <FileSize>{formatFileSize(file.size)}</FileSize>
                        </FileInfo>
                        <FileActions>
                          <FileActionButton
                            danger
                            onClick={() => handleRemovePendingFile(index)}
                            title="제거"
                          >
                            <X size={14} />
                          </FileActionButton>
                        </FileActions>
                      </UploadedFileItem>
                    ))}
                    {existingAttachments.length === 0 && pendingFiles.length === 0 && (
                      <EmptyFileList>첨부된 파일이 없습니다</EmptyFileList>
                    )}
                  </UploadedFileList>
                </FileUploadSection>
              </FormGroup>
            </ModalContent>
            <ModalFooter>
              <Button onClick={handleCloseModal} disabled={isUploading}>취소</Button>
              <Button primary onClick={handleSaveAgenda} disabled={isUploading}>
                {isUploading ? (
                  <>
                    <Loader size={14} />
                    저장 중...
                  </>
                ) : editingAgenda ? '수정' : '추가'}
              </Button>
            </ModalFooter>
          </Modal>
        </ModalOverlay>
      )}

      {/* 충돌 비교 모달 */}
      {isConflictModalOpen && conflictData && (
        <ModalOverlay onClick={(e) => e.target === e.currentTarget && handleCloseConflictModal()}>
          <ConflictModal>
            <ConflictHeader>
              <ConflictTitle>
                <AlertTriangle size={20} />
                수정 충돌 발생
              </ConflictTitle>
              <ConflictDescription>
                다른 사용자가 이 안건을 먼저 수정했습니다. 아래에서 버전을 선택하고 내용을 확인 후 저장하세요.
              </ConflictDescription>
            </ConflictHeader>

            <ConflictContent>
              {/* 내 버전 */}
              <ConflictPane $isLeft>
                <ConflictPaneHeader
                  $selected={selectedVersion === 'mine'}
                  onClick={() => handleSelectVersion('mine')}
                >
                  <ConflictPaneTitle $selected={selectedVersion === 'mine'}>
                    📝 내가 작성한 내용
                    <ConflictPaneTime>
                      (편집 시작: {conflictData.myData.updated_at
                        ? new Date(conflictData.myData.updated_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
                        : '-'})
                    </ConflictPaneTime>
                  </ConflictPaneTitle>
                  <SelectButton
                    $selected={selectedVersion === 'mine'}
                    onClick={(e) => { e.stopPropagation(); handleSelectVersion('mine'); }}
                  >
                    {selectedVersion === 'mine' && <Check size={12} />}
                    {selectedVersion === 'mine' ? '선택됨' : '선택'}
                  </SelectButton>
                </ConflictPaneHeader>
                <ConflictPaneBody $selected={selectedVersion === 'mine'}>
                  <ConflictFieldGroup>
                    <ConflictFieldLabel>제목</ConflictFieldLabel>
                    <ConflictFieldValue>{conflictData.myData.title || '(없음)'}</ConflictFieldValue>
                  </ConflictFieldGroup>
                  <ConflictFieldGroup>
                    <ConflictFieldLabel>내용</ConflictFieldLabel>
                    <ConflictFieldValue>{conflictData.myData.content || '(없음)'}</ConflictFieldValue>
                  </ConflictFieldGroup>
                  {conflictData.myData.linkedAgendaTitle && (
                    <ConflictFieldGroup>
                      <ConflictFieldLabel>연결 안건</ConflictFieldLabel>
                      <ConflictFieldValue>{conflictData.myData.linkedAgendaTitle}</ConflictFieldValue>
                    </ConflictFieldGroup>
                  )}
                </ConflictPaneBody>
              </ConflictPane>

              {/* 서버 버전 */}
              <ConflictPane>
                <ConflictPaneHeader
                  $selected={selectedVersion === 'server'}
                  onClick={() => handleSelectVersion('server')}
                >
                  <ConflictPaneTitle $selected={selectedVersion === 'server'}>
                    🌐 서버의 최신 내용
                    <ConflictPaneTime>
                      (수정: {conflictData.serverData.updated_at
                        ? new Date(conflictData.serverData.updated_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
                        : '-'})
                    </ConflictPaneTime>
                  </ConflictPaneTitle>
                  <SelectButton
                    $selected={selectedVersion === 'server'}
                    onClick={(e) => { e.stopPropagation(); handleSelectVersion('server'); }}
                  >
                    {selectedVersion === 'server' && <Check size={12} />}
                    {selectedVersion === 'server' ? '선택됨' : '선택'}
                  </SelectButton>
                </ConflictPaneHeader>
                <ConflictPaneBody $selected={selectedVersion === 'server'}>
                  <ConflictFieldGroup>
                    <ConflictFieldLabel>제목</ConflictFieldLabel>
                    <ConflictFieldValue>{conflictData.serverData.title || '(없음)'}</ConflictFieldValue>
                  </ConflictFieldGroup>
                  <ConflictFieldGroup>
                    <ConflictFieldLabel>내용</ConflictFieldLabel>
                    <ConflictFieldValue>{conflictData.serverData.content || '(없음)'}</ConflictFieldValue>
                  </ConflictFieldGroup>
                  {conflictData.serverData.linkedAgendaTitle && (
                    <ConflictFieldGroup>
                      <ConflictFieldLabel>연결 안건</ConflictFieldLabel>
                      <ConflictFieldValue>{conflictData.serverData.linkedAgendaTitle}</ConflictFieldValue>
                    </ConflictFieldGroup>
                  )}
                </ConflictPaneBody>
              </ConflictPane>
            </ConflictContent>

            <ConflictEditSection>
              <ConflictEditHeader>
                <ConflictEditTitle>
                  최종 저장할 내용 (선택한 버전을 기반으로 수정 가능)
                </ConflictEditTitle>
                <ConflictEditHint>
                  위에서 버전을 선택하면 해당 내용이 아래에 표시됩니다. 필요시 추가 수정 후 저장하세요.
                </ConflictEditHint>
              </ConflictEditHeader>
              <ConflictEditArea
                value={conflictEditContent}
                onChange={(e) => setConflictEditContent(e.target.value)}
                placeholder="저장할 내용을 입력하세요..."
              />
            </ConflictEditSection>

            <ConflictFooter>
              <Button onClick={handleCloseConflictModal} disabled={isUploading}>
                취소
              </Button>
              <Button primary onClick={handleResolveConflict} disabled={isUploading}>
                {isUploading ? (
                  <>
                    <Loader size={14} />
                    저장 중...
                  </>
                ) : '선택한 버전으로 저장'}
              </Button>
            </ConflictFooter>
          </ConflictModal>
        </ModalOverlay>
      )}
    </Container>
  );
};

export default WeeklyReport;
