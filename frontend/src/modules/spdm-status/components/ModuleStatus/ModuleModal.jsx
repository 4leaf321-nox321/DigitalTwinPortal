import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import styled from 'styled-components';
import { X, ChevronDown, Search, Plus, FolderPlus, ListPlus, Trash2, Link2 } from 'lucide-react';
import { useModuleCategories } from '../../contexts/ModuleCategoryContext';
import SpecNodeRow from './SpecNodeRow';

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const Modal = styled.div`
  background: white;
  border-radius: 1rem;
  width: 80vw;
  height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
`;

const ModalTitle = styled.h2`
  font-size: 1.0625rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
`;

const CloseButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  cursor: pointer;
  color: #64748b;
  border-radius: 0.375rem;

  &:hover {
    background: #f1f5f9;
    color: #1e293b;
  }
`;

const ModalBodyLayout = styled.div`
  flex: 1;
  display: flex;
  overflow: hidden;
`;

const FormPanel = styled.div`
  width: 420px;
  flex-shrink: 0;
  overflow-y: auto;
  padding: 1.5rem;
  border-right: 1px solid #e2e8f0;
`;

const SpecPanel = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const SpecPanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e2e8f0;
  background: #fafbfc;
  flex-shrink: 0;
`;

const SpecTitle = styled.h3`
  font-size: 0.875rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
`;

const SpecHeaderActions = styled.div`
  display: flex;
  gap: 0.375rem;
`;

const SpecAddButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  background: white;
  font-size: 0.75rem;
  color: #475569;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: #f8fafc;
    border-color: #8b5cf6;
    color: #8b5cf6;
  }
`;

const SpecTreeContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
`;

const SpecEmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  color: #94a3b8;
  text-align: center;

  p {
    margin: 0.5rem 0 0 0;
    font-size: 0.8125rem;
  }
`;

const Field = styled.div`
  margin-bottom: 1.25rem;

  &:last-child {
    margin-bottom: 0;
  }
`;

const Label = styled.label`
  display: block;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #475569;
  margin-bottom: 0.375rem;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.625rem 0.875rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  color: #1e293b;
  background: white;
  outline: none;
  box-sizing: border-box;

  &:focus {
    border-color: #8b5cf6;
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 0.625rem 0.875rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  color: #1e293b;
  background: white;
  outline: none;
  resize: vertical;
  min-height: 80px;
  font-family: inherit;
  box-sizing: border-box;

  &:focus {
    border-color: #8b5cf6;
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 0.625rem 0.875rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  color: #1e293b;
  background: white;
  outline: none;
  cursor: pointer;
  box-sizing: border-box;

  &:focus {
    border-color: #8b5cf6;
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }
`;

const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid #e2e8f0;
  flex-shrink: 0;
`;

const Button = styled.button`
  padding: 0.5rem 1.25rem;
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
`;

const CancelButton = styled(Button)`
  border: 1px solid #e2e8f0;
  background: white;
  color: #475569;

  &:hover {
    background: #f8fafc;
  }
`;

const SaveButton = styled(Button)`
  border: none;
  background: #8b5cf6;
  color: white;

  &:hover {
    background: #7c3aed;
  }

  &:disabled {
    background: #c4b5fd;
    cursor: not-allowed;
  }
`;

// ===== SearchableSelect 컴포넌트 =====

const ComboWrapper = styled.div`
  position: relative;
`;

const ComboTrigger = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  padding: 0.625rem 0.875rem;
  border: 1px solid ${props => props.$open ? '#8b5cf6' : '#e2e8f0'};
  border-radius: 0.5rem;
  font-size: 0.875rem;
  color: ${props => props.$hasValue ? '#1e293b' : '#94a3b8'};
  background: white;
  cursor: pointer;
  box-sizing: border-box;
  transition: border-color 0.15s ease;

  ${props => props.$open && `box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);`}

  &:hover {
    border-color: #cbd5e1;
  }
`;

const ComboValueText = styled.span`
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ComboClear = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: none;
  background: #e2e8f0;
  color: #64748b;
  border-radius: 50%;
  cursor: pointer;
  padding: 0;
  margin-right: 4px;
  flex-shrink: 0;

  &:hover {
    background: #cbd5e1;
    color: #1e293b;
  }
`;

const ComboChevron = styled.div`
  display: flex;
  align-items: center;
  color: #94a3b8;
  flex-shrink: 0;
  transition: transform 0.15s ease;
  transform: ${props => props.$open ? 'rotate(180deg)' : 'none'};
`;

const ComboDropdown = styled.div`
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 100%;
  width: max-content;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  z-index: 100;
  overflow: hidden;
`;

const ComboSearchWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #f1f5f9;
`;

const ComboSearchIcon = styled.div`
  color: #94a3b8;
  flex-shrink: 0;
  display: flex;
`;

const ComboSearchInput = styled.input`
  flex: 1;
  border: none;
  outline: none;
  font-size: 0.8125rem;
  color: #1e293b;
  background: transparent;

  &::placeholder {
    color: #cbd5e1;
  }
`;

const ComboOptionsList = styled.div`
  max-height: 200px;
  overflow-y: auto;
`;

const ComboOption = styled.div`
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
  color: ${props => props.$active ? '#7c3aed' : '#334155'};
  background: ${props => props.$active ? '#f5f3ff' : 'transparent'};
  font-weight: ${props => props.$active ? '600' : '400'};
  cursor: pointer;
  transition: background 0.1s ease;

  &:hover {
    background: ${props => props.$active ? '#f5f3ff' : '#f8fafc'};
  }
`;

const ComboEmpty = styled.div`
  padding: 0.75rem;
  font-size: 0.8125rem;
  color: #94a3b8;
  text-align: center;
`;

const SearchableSelect = ({ options, value, onChange, placeholder }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef(null);
  const searchRef = useRef(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(opt => opt.toLowerCase().includes(q));
  }, [options, search]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (open && searchRef.current) {
      searchRef.current.focus();
    }
  }, [open]);

  const handleSelect = (opt) => {
    onChange(opt);
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
  };

  return (
    <ComboWrapper ref={wrapperRef}>
      <ComboTrigger
        $open={open}
        $hasValue={!!value}
        onClick={() => setOpen(!open)}
      >
        <ComboValueText>{value || placeholder}</ComboValueText>
        {value && (
          <ComboClear type="button" onClick={handleClear} tabIndex={-1}>
            <X size={10} />
          </ComboClear>
        )}
        <ComboChevron $open={open}>
          <ChevronDown size={14} />
        </ComboChevron>
      </ComboTrigger>
      {open && (
        <ComboDropdown>
          <ComboSearchWrap>
            <ComboSearchIcon><Search size={14} /></ComboSearchIcon>
            <ComboSearchInput
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="검색..."
              onClick={(e) => e.stopPropagation()}
            />
          </ComboSearchWrap>
          <ComboOptionsList>
            {filtered.length > 0 ? (
              filtered.map(opt => (
                <ComboOption
                  key={opt}
                  $active={value === opt}
                  onClick={() => handleSelect(opt)}
                >
                  {opt}
                </ComboOption>
              ))
            ) : (
              <ComboEmpty>일치하는 항목이 없습니다</ComboEmpty>
            )}
          </ComboOptionsList>
        </ComboDropdown>
      )}
    </ComboWrapper>
  );
};

// ===== ModuleModal 컴포넌트 =====

const CheckboxRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;
`;

const Checkbox = styled.input.attrs({ type: 'checkbox' })`
  width: 16px;
  height: 16px;
  accent-color: #8b5cf6;
  cursor: pointer;
`;

const CheckboxLabel = styled.span`
  font-size: 0.875rem;
  color: #1e293b;
  font-weight: 500;
`;

const MultiSelectWrapper = styled.div`
  position: relative;
`;

const MultiSelectTrigger = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem;
  min-height: 38px;
  width: 100%;
  padding: 0.375rem 0.625rem;
  border: 1px solid ${props => props.$open ? '#8b5cf6' : '#e2e8f0'};
  border-radius: 0.5rem;
  font-size: 0.875rem;
  background: white;
  cursor: pointer;
  box-sizing: border-box;
  transition: border-color 0.15s ease;

  ${props => props.$open && `box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);`}

  &:hover {
    border-color: #cbd5e1;
  }
`;

const MultiSelectPlaceholder = styled.span`
  color: #94a3b8;
  font-size: 0.875rem;
`;

const MultiSelectTag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: #334155;
  white-space: nowrap;
`;

const MultiSelectTagRemove = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border: none;
  background: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 0;
  border-radius: 50%;

  &:hover {
    background: #e2e8f0;
    color: #475569;
  }
`;

const MultiSelectChevron = styled.div`
  display: flex;
  align-items: center;
  color: #94a3b8;
  flex-shrink: 0;
  margin-left: auto;
  transition: transform 0.15s ease;
  transform: ${props => props.$open ? 'rotate(180deg)' : 'none'};
`;

const MultiSelectDropdown = styled.div`
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 100%;
  width: max-content;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  z-index: 100;
  overflow: hidden;
`;

const MultiSelectOption = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
  color: ${props => props.$selected ? '#7c3aed' : '#334155'};
  background: ${props => props.$selected ? '#f5f3ff' : 'transparent'};
  font-weight: ${props => props.$selected ? '600' : '400'};
  cursor: pointer;
  transition: background 0.1s ease;

  &:hover {
    background: ${props => props.$selected ? '#f5f3ff' : '#f8fafc'};
  }
`;

const MultiSelectCheck = styled.span`
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid ${props => props.$checked ? '#8b5cf6' : '#d1d5db'};
  border-radius: 3px;
  background: ${props => props.$checked ? '#8b5cf6' : 'white'};
  color: white;
  font-size: 0.625rem;
  flex-shrink: 0;
`;

const SearchableMultiSelect = ({ options, value, onChange, placeholder }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef(null);
  const searchRef = useRef(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(opt => opt.toLowerCase().includes(q));
  }, [options, search]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (open && searchRef.current) {
      searchRef.current.focus();
    }
  }, [open]);

  const toggleOption = (opt) => {
    if (value.includes(opt)) {
      onChange(value.filter(v => v !== opt));
    } else {
      onChange([...value, opt]);
    }
  };

  const removeTag = (e, opt) => {
    e.stopPropagation();
    onChange(value.filter(v => v !== opt));
  };

  return (
    <MultiSelectWrapper ref={wrapperRef}>
      <MultiSelectTrigger $open={open} onClick={() => setOpen(!open)}>
        {value.length === 0 ? (
          <MultiSelectPlaceholder>{placeholder}</MultiSelectPlaceholder>
        ) : (
          value.map(v => (
            <MultiSelectTag key={v}>
              {v}
              <MultiSelectTagRemove type="button" onClick={(e) => removeTag(e, v)} tabIndex={-1}>
                <X size={10} />
              </MultiSelectTagRemove>
            </MultiSelectTag>
          ))
        )}
        <MultiSelectChevron $open={open}>
          <ChevronDown size={14} />
        </MultiSelectChevron>
      </MultiSelectTrigger>
      {open && (
        <MultiSelectDropdown>
          <ComboSearchWrap>
            <ComboSearchIcon><Search size={14} /></ComboSearchIcon>
            <ComboSearchInput
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="검색..."
              onClick={(e) => e.stopPropagation()}
            />
          </ComboSearchWrap>
          <ComboOptionsList>
            {filtered.length > 0 ? (
              filtered.map(opt => (
                <MultiSelectOption
                  key={opt}
                  $selected={value.includes(opt)}
                  onClick={() => toggleOption(opt)}
                >
                  <MultiSelectCheck $checked={value.includes(opt)}>
                    {value.includes(opt) && '✓'}
                  </MultiSelectCheck>
                  {opt}
                </MultiSelectOption>
              ))
            ) : (
              <ComboEmpty>일치하는 항목이 없습니다</ComboEmpty>
            )}
          </ComboOptionsList>
        </MultiSelectDropdown>
      )}
    </MultiSelectWrapper>
  );
};

const LinkedFieldGroup = styled.div`
  margin-top: 0.75rem;
  padding: 0.875rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
`;

const LinkedSystemRow = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  margin-bottom: 1rem;
`;

const LinkedSystemField = styled.div`
  flex: 1;
  min-width: 0;
`;

const LinkedArrow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding-bottom: 0.5rem;
  font-size: 1rem;
  color: #94a3b8;
  font-weight: 600;
  flex-shrink: 0;
`;

const LinkInstanceCard = styled.div`
  position: relative;
  padding: 0.75rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  margin-bottom: 0.5rem;

  &:last-child {
    margin-bottom: 0;
  }
`;

const LinkInstanceHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
`;

const LinkInstanceLabel = styled.span`
  font-size: 0.6875rem;
  font-weight: 600;
  color: #94a3b8;
`;

const LinkDeleteBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  background: none;
  cursor: pointer;
  color: #cbd5e1;
  border-radius: 0.25rem;
  padding: 0;

  &:hover {
    background: #fee2e2;
    color: #ef4444;
  }
`;

const AddLinkBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  width: 100%;
  padding: 0.5rem;
  margin-top: 0.5rem;
  border: 1px dashed #cbd5e1;
  border-radius: 0.5rem;
  background: white;
  font-size: 0.75rem;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s ease;
  justify-content: center;

  &:hover {
    border-color: #f59e0b;
    color: #f59e0b;
    background: #fffbeb;
  }
`;

const FixedSystemBox = styled.div`
  width: 100%;
  padding: 0.625rem 0.875rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  color: #7c3aed;
  background: #f5f3ff;
  box-sizing: border-box;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const DirectionBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid #e2e8f0;
  border-radius: 50%;
  background: white;
  color: #f59e0b;
  cursor: pointer;
  padding: 0;
  margin-bottom: 0.5rem;
  flex-shrink: 0;
  font-size: 0.875rem;
  font-weight: 700;
  transition: all 0.15s ease;

  &:hover {
    background: #fffbeb;
    border-color: #f59e0b;
    transform: scale(1.1);
  }
`;

const LinkNoSystemHint = styled.div`
  padding: 0.75rem;
  text-align: center;
  font-size: 0.75rem;
  color: #94a3b8;
  background: white;
  border: 1px dashed #e2e8f0;
  border-radius: 0.5rem;
`;

const TargetToggle = styled.div`
  display: flex;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  overflow: hidden;
  margin-bottom: 0.5rem;
`;

const TargetToggleBtn = styled.button`
  flex: 1;
  padding: 0.3125rem 0.5rem;
  border: none;
  font-size: 0.6875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  background: ${props => props.$active ? '#f1f5f9' : 'white'};
  color: ${props => props.$active ? '#334155' : '#94a3b8'};
  font-weight: ${props => props.$active ? '600' : '400'};

  &:not(:last-child) {
    border-right: 1px solid #e2e8f0;
  }

  &:hover {
    background: #f8fafc;
    color: #475569;
  }
`;

const TargetModuleRow = styled.div`
  margin-top: 0.5rem;
`;

const generateId = () => {
  return `spec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// ===== BulkAddModal 컴포넌트 =====

const BulkOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
`;

const BulkModal = styled.div`
  background: white;
  border-radius: 1rem;
  width: 700px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
`;

const BulkHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
`;

const BulkTitle = styled.h3`
  font-size: 1rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
`;

const BulkBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem 1.5rem;
`;

const BulkTable = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const BulkTh = styled.th`
  text-align: left;
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
  padding: 0.5rem 0.5rem;
  border-bottom: 2px solid #e2e8f0;
  white-space: nowrap;

  &:last-child {
    width: 40px;
    text-align: center;
  }
`;

const BulkTd = styled.td`
  padding: 0.375rem 0.5rem;
  vertical-align: middle;

  &:last-child {
    width: 40px;
    text-align: center;
  }
`;

const BulkInput = styled.input`
  width: 100%;
  padding: 0.5rem 0.625rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  color: #1e293b;
  background: white;
  outline: none;
  box-sizing: border-box;

  &:focus {
    border-color: #8b5cf6;
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.1);
  }
`;

const BulkSelect = styled.select`
  width: 100%;
  padding: 0.5rem 0.625rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  color: #1e293b;
  background: white;
  outline: none;
  cursor: pointer;
  box-sizing: border-box;

  &:focus {
    border-color: #8b5cf6;
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.1);
  }
`;

const BulkDeleteBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: none;
  cursor: pointer;
  color: #cbd5e1;
  border-radius: 0.25rem;
  padding: 0;

  &:hover {
    background: #fee2e2;
    color: #ef4444;
  }
`;

const BulkAddRowBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.75rem;
  padding: 0.5rem 0.875rem;
  border: 1px dashed #cbd5e1;
  border-radius: 0.5rem;
  background: #fafbfc;
  font-size: 0.8125rem;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: #8b5cf6;
    color: #8b5cf6;
    background: #f5f3ff;
  }
`;

const BulkFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-top: 1px solid #e2e8f0;
  flex-shrink: 0;
`;

const BulkCount = styled.span`
  font-size: 0.8125rem;
  color: #64748b;
`;

const BulkFooterButtons = styled.div`
  display: flex;
  gap: 0.5rem;
`;

// 스펙 트리에서 모든 그룹(children이 있는 노드)을 재귀적으로 수집
const collectGroups = (nodes, prefix = '') => {
  const groups = [];
  for (const node of nodes) {
    if (Array.isArray(node.children)) {
      const label = prefix ? `${prefix} > ${node.key}` : node.key;
      groups.push({ id: node.id, label: label || '(이름 없음)' });
      groups.push(...collectGroups(node.children, label));
    }
  }
  return groups;
};

const TypeToggle = styled.div`
  display: flex;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  overflow: hidden;
`;

const TypeBtn = styled.button`
  flex: 1;
  padding: 0.375rem 0.5rem;
  border: none;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  background: ${props => props.$active ? '#8b5cf6' : 'white'};
  color: ${props => props.$active ? 'white' : '#64748b'};

  &:not(:last-child) {
    border-right: 1px solid #e2e8f0;
  }

  &:hover {
    background: ${props => props.$active ? '#8b5cf6' : '#f8fafc'};
  }
`;

const DisabledInput = styled.div`
  width: 100%;
  padding: 0.5rem 0.625rem;
  border: 1px solid #f1f5f9;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  color: #94a3b8;
  background: #f8fafc;
  box-sizing: border-box;
`;

const PasteHint = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  margin-bottom: 0.75rem;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  color: #1e40af;

  kbd {
    display: inline-block;
    padding: 0.125rem 0.375rem;
    background: white;
    border: 1px solid #93c5fd;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-family: inherit;
    font-weight: 600;
  }
`;

const PasteToast = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  padding: 0.75rem 1.5rem;
  background: #1e293b;
  color: white;
  border-radius: 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  z-index: 10;
  pointer-events: none;
  animation: bulkFadeOut 1.5s ease forwards;

  @keyframes bulkFadeOut {
    0%, 70% { opacity: 1; }
    100% { opacity: 0; }
  }
`;

const BulkAddModal = ({ isOpen, specs, onClose, onApply }) => {
  const [rows, setRows] = useState([]);
  const [pasteMsg, setPasteMsg] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setRows([
        { id: generateId(), type: 'item', key: '', value: '', parentId: '' },
        { id: generateId(), type: 'item', key: '', value: '', parentId: '' },
        { id: generateId(), type: 'item', key: '', value: '', parentId: '' },
      ]);
      setPasteMsg(null);
    }
  }, [isOpen]);

  const groups = useMemo(() => collectGroups(specs), [specs]);

  const handleChange = (rowId, field, val) => {
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, [field]: val } : r));
  };

  const handleTypeChange = (rowId, type) => {
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, type, value: type === 'group' ? '' : r.value } : r));
  };

  const handleDeleteRow = (rowId) => {
    setRows(prev => prev.filter(r => r.id !== rowId));
  };

  const handleAddRow = () => {
    setRows(prev => [...prev, { id: generateId(), type: 'item', key: '', value: '', parentId: '' }]);
  };

  // 엑셀 클립보드 붙여넣기 핸들러
  const handlePaste = useCallback((e) => {
    const text = e.clipboardData?.getData('text/plain');
    if (!text) return;

    // 탭이 포함된 경우만 엑셀 붙여넣기로 처리 (단일 셀 입력은 기본 동작 유지)
    if (!text.includes('\t')) return;

    e.preventDefault();

    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) return;

    // 그룹명 → id 매핑 (key 기준, label 경로 기준 모두 매칭)
    const groupMap = new Map();
    for (const g of groups) {
      // "부모 > 자식" 전체 경로로 매칭
      groupMap.set(g.label.toLowerCase(), g.id);
      // 마지막 이름만으로도 매칭 (경로에 >가 포함된 경우)
      const lastSegment = g.label.split(' > ').pop().trim();
      if (!groupMap.has(lastSegment.toLowerCase())) {
        groupMap.set(lastSegment.toLowerCase(), g.id);
      }
    }

    const newRows = lines.map(line => {
      const cols = line.split('\t');
      const key = (cols[0] || '').trim();
      const value = (cols[1] || '').trim();
      const parentName = (cols[2] || '').trim();

      // 3열이 있으면 그룹명으로 parentId 매칭
      let parentId = '';
      if (parentName) {
        parentId = groupMap.get(parentName.toLowerCase()) || '';
      }

      return {
        id: generateId(),
        type: 'item',
        key,
        value,
        parentId,
      };
    });

    setRows(prev => {
      // 비어있는 기존 행은 제거하고 붙여넣기 데이터로 대체
      const filledRows = prev.filter(r => r.key.trim());
      return [...filledRows, ...newRows];
    });

    const matched = newRows.filter(r => r.parentId).length;
    const msg = matched > 0
      ? `${newRows.length}개 행 붙여넣기 (Parent 매칭: ${matched}개)`
      : `${newRows.length}개 행이 붙여넣기 되었습니다`;
    setPasteMsg(msg);
    setTimeout(() => setPasteMsg(null), 2000);
  }, [groups]);

  const validRows = rows.filter(r => r.key.trim());

  const handleApply = () => {
    if (validRows.length === 0) return;
    onApply(validRows);
    onClose();
  };

  if (!isOpen) return null;

  const itemCount = validRows.filter(r => r.type === 'item').length;
  const groupCount = validRows.filter(r => r.type === 'group').length;
  const countParts = [];
  if (itemCount > 0) countParts.push(`항목 ${itemCount}개`);
  if (groupCount > 0) countParts.push(`그룹 ${groupCount}개`);

  return (
    <BulkOverlay onClick={onClose}>
      <BulkModal onClick={(e) => e.stopPropagation()} onPaste={handlePaste} style={{ position: 'relative' }}>
        <BulkHeader>
          <BulkTitle>여러 데이터 추가</BulkTitle>
          <CloseButton type="button" onClick={onClose}>
            <X size={18} />
          </CloseButton>
        </BulkHeader>
        <BulkBody>
          <PasteHint>
            엑셀에서 복사 후 <kbd>Ctrl</kbd>+<kbd>V</kbd> 붙여넣기 (2열: Key, Value / 3열: Key, Value, Parent 그룹명)
          </PasteHint>
          <BulkTable>
            <thead>
              <tr>
                <BulkTh style={{ width: '120px' }}>유형</BulkTh>
                <BulkTh>Key *</BulkTh>
                <BulkTh>Value</BulkTh>
                <BulkTh style={{ width: '180px' }}>Parent (그룹)</BulkTh>
                <BulkTh></BulkTh>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.id}>
                  <BulkTd>
                    <TypeToggle>
                      <TypeBtn
                        type="button"
                        $active={row.type === 'item'}
                        onClick={() => handleTypeChange(row.id, 'item')}
                      >
                        항목
                      </TypeBtn>
                      <TypeBtn
                        type="button"
                        $active={row.type === 'group'}
                        onClick={() => handleTypeChange(row.id, 'group')}
                      >
                        그룹
                      </TypeBtn>
                    </TypeToggle>
                  </BulkTd>
                  <BulkTd>
                    <BulkInput
                      value={row.key}
                      onChange={(e) => handleChange(row.id, 'key', e.target.value)}
                      placeholder={row.type === 'group' ? '그룹명 입력...' : '키 입력...'}
                      autoFocus={idx === 0}
                    />
                  </BulkTd>
                  <BulkTd>
                    {row.type === 'group' ? (
                      <DisabledInput>-</DisabledInput>
                    ) : (
                      <BulkInput
                        value={row.value}
                        onChange={(e) => handleChange(row.id, 'value', e.target.value)}
                        placeholder="값 입력..."
                      />
                    )}
                  </BulkTd>
                  <BulkTd>
                    <BulkSelect
                      value={row.parentId}
                      onChange={(e) => handleChange(row.id, 'parentId', e.target.value)}
                    >
                      <option value="">(최상위)</option>
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.label}</option>
                      ))}
                    </BulkSelect>
                  </BulkTd>
                  <BulkTd>
                    <BulkDeleteBtn type="button" onClick={() => handleDeleteRow(row.id)}>
                      <Trash2 size={14} />
                    </BulkDeleteBtn>
                  </BulkTd>
                </tr>
              ))}
            </tbody>
          </BulkTable>
          <BulkAddRowBtn type="button" onClick={handleAddRow}>
            <Plus size={14} />
            행 추가
          </BulkAddRowBtn>
        </BulkBody>
        <BulkFooter>
          <BulkCount>
            {countParts.length > 0 ? `${countParts.join(', ')} 추가 예정` : 'Key를 입력하세요'}
          </BulkCount>
          <BulkFooterButtons>
            <CancelButton type="button" onClick={onClose}>취소</CancelButton>
            <SaveButton type="button" onClick={handleApply} disabled={validRows.length === 0}>
              추가
            </SaveButton>
          </BulkFooterButtons>
        </BulkFooter>
        {pasteMsg && <PasteToast>{pasteMsg}</PasteToast>}
      </BulkModal>
    </BulkOverlay>
  );
};

const ModuleModal = ({ isOpen, module, departments, activeDivision, allModules = [], onClose, onSave }) => {
  const { categories, systems, linkMethodLabels } = useModuleCategories();
  const [name, setName] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [systemType, setSystemType] = useState('');
  const [isLinked, setIsLinked] = useState(false);
  const [links, setLinks] = useState([]);
  const [description, setDescription] = useState('');
  const [specs, setSpecs] = useState([]);
  const [showBulkModal, setShowBulkModal] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (module) {
        setName(module.name || '');
        setDivisionId(module.divisionId || '');
        setSelectedCategories(module.categories || []);
        setSystemType(module.systemType || '');
        const moduleLinks = (module.links && module.links.length > 0)
          ? module.links.map(l => ({ id: generateId(), from: l.from || '', to: l.to || '', method: l.method || '', targetModuleId: l.targetModuleId || null }))
          : [];
        setLinks(moduleLinks);
        setIsLinked(moduleLinks.length > 0);
        setDescription(module.description || '');
        setSpecs(module.specs || []);
      } else {
        setName('');
        setDivisionId(activeDivision || (departments.length > 0 ? departments[0].id : ''));
        setSelectedCategories([]);
        setSystemType('');
        setIsLinked(false);
        setLinks([]);
        setDescription('');
        setSpecs([]);
      }
    }
  }, [isOpen, module, activeDivision, departments]);

  // 구현 시스템 변경 시 기존 링크의 고정 측을 업데이트
  const prevSystemTypeRef = useRef(systemType);
  useEffect(() => {
    const prev = prevSystemTypeRef.current;
    prevSystemTypeRef.current = systemType;
    if (!systemType || prev === systemType) return;

    setLinks(prevLinks => prevLinks.map(link => {
      // 이전 시스템과 일치하던 쪽을 새 시스템으로 교체
      if (link.from === prev || (!link.from && !link.to)) {
        return { ...link, from: systemType };
      }
      if (link.to === prev) {
        return { ...link, to: systemType };
      }
      // from/to 어느 쪽도 일치하지 않으면 from을 새 시스템으로 설정
      if (link.from !== systemType && link.to !== systemType) {
        return { ...link, from: systemType };
      }
      return link;
    }));
  }, [systemType]);

  // ===== Spec tree handlers =====
  const handleNodeUpdate = useCallback((updatedNode) => {
    setSpecs(prev => prev.map(s => s.id === updatedNode.id ? updatedNode : s));
  }, []);

  const handleNodeDelete = useCallback((nodeId) => {
    setSpecs(prev => prev.filter(s => s.id !== nodeId));
  }, []);

  const addItem = useCallback(() => {
    const newNode = { id: generateId(), key: '', value: '' };
    setSpecs(prev => [...prev, newNode]);
  }, []);

  const addGroup = useCallback(() => {
    const newNode = { id: generateId(), key: '', children: [] };
    setSpecs(prev => [...prev, newNode]);
  }, []);

  const addChildItem = useCallback((parentId) => {
    const newChild = { id: generateId(), key: '', value: '' };
    const addToNode = (nodes) => {
      return nodes.map(node => {
        if (node.id === parentId && Array.isArray(node.children)) {
          return { ...node, children: [...node.children, newChild] };
        }
        if (node.children) {
          return { ...node, children: addToNode(node.children) };
        }
        return node;
      });
    };
    setSpecs(prev => addToNode(prev));
  }, []);

  const addChildGroup = useCallback((parentId) => {
    const newChild = { id: generateId(), key: '', children: [] };
    const addToNode = (nodes) => {
      return nodes.map(node => {
        if (node.id === parentId && Array.isArray(node.children)) {
          return { ...node, children: [...node.children, newChild] };
        }
        if (node.children) {
          return { ...node, children: addToNode(node.children) };
        }
        return node;
      });
    };
    setSpecs(prev => addToNode(prev));
  }, []);

  const handleBulkApply = useCallback((rows) => {
    setSpecs(prev => {
      let newSpecs = [...prev];

      const addToParent = (nodes, parentId, child) => {
        return nodes.map(node => {
          if (node.id === parentId && Array.isArray(node.children)) {
            return { ...node, children: [...node.children, child] };
          }
          if (node.children) {
            return { ...node, children: addToParent(node.children, parentId, child) };
          }
          return node;
        });
      };

      for (const row of rows) {
        const newNode = row.type === 'group'
          ? { id: generateId(), key: row.key.trim(), children: [] }
          : { id: generateId(), key: row.key.trim(), value: row.value.trim() };

        if (row.parentId) {
          newSpecs = addToParent(newSpecs, row.parentId, newNode);
        } else {
          newSpecs = [...newSpecs, newNode];
        }
      }

      return newSpecs;
    });
  }, []);

  const handleLinkChange = useCallback((linkId, field, value) => {
    setLinks(prev => prev.map(l => l.id === linkId ? { ...l, [field]: value } : l));
  }, []);

  const handleAddLink = useCallback(() => {
    setLinks(prev => [...prev, { id: generateId(), from: systemType || '', to: '', method: '' }]);
  }, [systemType]);

  const handleToggleLinkDirection = useCallback((linkId) => {
    setLinks(prev => prev.map(l => l.id === linkId
      ? { ...l, from: l.to, to: l.from, targetModuleId: l.targetModuleId || null }
      : l
    ));
  }, []);

  const handleRemoveLink = useCallback((linkId) => {
    setLinks(prev => {
      const next = prev.filter(l => l.id !== linkId);
      if (next.length === 0) setIsLinked(false);
      return next;
    });
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !divisionId) {
      return;
    }

    const validLinks = isLinked
      ? links.filter(l => l.from || l.to || l.method).map(({ id, ...rest }) => ({
          from: rest.from,
          to: rest.to,
          method: rest.method,
          ...(rest.targetModuleId ? { targetModuleId: rest.targetModuleId } : {}),
        }))
      : [];

    onSave({
      id: module?.id,
      name: name.trim(),
      divisionId,
      categories: selectedCategories,
      systemType: systemType || null,
      links: validLinks,
      description: description.trim() || null,
      specs,
    });
  };

  if (!isOpen) return null;

  return (
    <Overlay onClick={onClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>{module ? '모듈 수정' : '모듈 추가'}</ModalTitle>
          <CloseButton type="button" onClick={onClose}>
            <X size={18} />
          </CloseButton>
        </ModalHeader>
        <ModalBodyLayout>
          <FormPanel>
            <Field>
              <Label>모듈 이름 *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="모듈 이름을 입력하세요"
                autoFocus
              />
            </Field>
            <Field>
              <Label>사업부 *</Label>
              <Select
                value={divisionId}
                onChange={(e) => setDivisionId(e.target.value)}
              >
                <option value="">사업부 선택</option>
                <option value="__all__">전체 (공용)</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </Select>
            </Field>
            <Field>
              <Label>모듈 구분</Label>
              <SearchableMultiSelect
                options={categories}
                value={selectedCategories}
                onChange={setSelectedCategories}
                placeholder="구분 선택 (복수 선택 가능)"
              />
            </Field>
            <Field>
              <Label>구현 시스템</Label>
              <SearchableSelect
                options={systems}
                value={systemType}
                onChange={setSystemType}
                placeholder="시스템 선택 (선택)"
              />
            </Field>
            <Field>
              <CheckboxRow onClick={() => {
                const next = !isLinked;
                setIsLinked(next);
                if (next && links.length === 0) {
                  setLinks([{ id: generateId(), from: systemType || '', to: '', method: '' }]);
                }
              }}>
                <Checkbox
                  checked={isLinked}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setIsLinked(next);
                    if (next && links.length === 0) {
                      setLinks([{ id: generateId(), from: systemType || '', to: '', method: '' }]);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <CheckboxLabel>연계 모듈</CheckboxLabel>
              </CheckboxRow>
              {isLinked && (
                <LinkedFieldGroup>
                  {!systemType && (
                    <LinkNoSystemHint>
                      구현 시스템을 먼저 선택하면 연계 설정이 더 편리합니다.
                    </LinkNoSystemHint>
                  )}
                  {links.map((link, idx) => {
                    // systemType이 있으면: 한쪽은 고정, 다른쪽만 선택
                    const isOutgoing = link.from === systemType;
                    const otherSystem = isOutgoing ? link.to : link.from;
                    const hasTargetModule = !!link.targetModuleId;

                    // 상대 시스템에 속한 모듈 목록 (자기 자신 제외)
                    const otherModules = otherSystem
                      ? allModules.filter(m =>
                          m.systemType === otherSystem && m.id !== module?.id
                        )
                      : [];

                    const targetModuleName = hasTargetModule
                      ? allModules.find(m => m.id === link.targetModuleId)?.name
                      : null;

                    return (
                      <LinkInstanceCard key={link.id}>
                        <LinkInstanceHeader>
                          <LinkInstanceLabel>연계 {idx + 1}</LinkInstanceLabel>
                          <LinkDeleteBtn
                            type="button"
                            title="연계 삭제"
                            onClick={() => handleRemoveLink(link.id)}
                          >
                            <X size={12} />
                          </LinkDeleteBtn>
                        </LinkInstanceHeader>
                        {systemType ? (
                          <>
                            <LinkedSystemRow>
                              <LinkedSystemField>
                                <Label>{isOutgoing ? 'From (구현 시스템)' : 'From (상대)'}</Label>
                                {isOutgoing ? (
                                  <FixedSystemBox>{systemType}</FixedSystemBox>
                                ) : (
                                  <SearchableSelect
                                    options={systems.filter(s => s !== systemType)}
                                    value={otherSystem}
                                    onChange={(val) => {
                                      handleLinkChange(link.id, 'from', val);
                                      // 시스템 변경 시 모듈 선택 초기화
                                      if (link.targetModuleId) {
                                        handleLinkChange(link.id, 'targetModuleId', null);
                                      }
                                    }}
                                    placeholder="시스템 선택"
                                  />
                                )}
                              </LinkedSystemField>
                              <DirectionBtn
                                type="button"
                                title="방향 전환"
                                onClick={() => handleToggleLinkDirection(link.id)}
                              >
                                ⇄
                              </DirectionBtn>
                              <LinkedSystemField>
                                <Label>{isOutgoing ? 'To (상대)' : 'To (구현 시스템)'}</Label>
                                {isOutgoing ? (
                                  <SearchableSelect
                                    options={systems.filter(s => s !== systemType)}
                                    value={otherSystem}
                                    onChange={(val) => {
                                      handleLinkChange(link.id, 'to', val);
                                      if (link.targetModuleId) {
                                        handleLinkChange(link.id, 'targetModuleId', null);
                                      }
                                    }}
                                    placeholder="시스템 선택"
                                  />
                                ) : (
                                  <FixedSystemBox>{systemType}</FixedSystemBox>
                                )}
                              </LinkedSystemField>
                            </LinkedSystemRow>
                            {otherSystem && otherModules.length > 0 && (
                              <TargetModuleRow>
                                <TargetToggle>
                                  <TargetToggleBtn
                                    type="button"
                                    $active={!hasTargetModule}
                                    onClick={() => handleLinkChange(link.id, 'targetModuleId', null)}
                                  >
                                    시스템 연결
                                  </TargetToggleBtn>
                                  <TargetToggleBtn
                                    type="button"
                                    $active={hasTargetModule}
                                    onClick={() => {
                                      if (!hasTargetModule && otherModules.length > 0) {
                                        handleLinkChange(link.id, 'targetModuleId', otherModules[0].id);
                                      }
                                    }}
                                  >
                                    모듈 연결
                                  </TargetToggleBtn>
                                </TargetToggle>
                                {hasTargetModule && (
                                  <SearchableSelect
                                    options={otherModules.map(m => m.name)}
                                    value={targetModuleName || ''}
                                    onChange={(val) => {
                                      const found = otherModules.find(m => m.name === val);
                                      handleLinkChange(link.id, 'targetModuleId', found ? found.id : null);
                                    }}
                                    placeholder="모듈 선택"
                                  />
                                )}
                              </TargetModuleRow>
                            )}
                            <Field style={{ marginBottom: 0 }}>
                              <Label>연계 방식</Label>
                              <SearchableSelect
                                options={linkMethodLabels}
                                value={link.method}
                                onChange={(val) => handleLinkChange(link.id, 'method', val)}
                                placeholder="연계 방식 선택"
                              />
                            </Field>
                          </>
                        ) : (
                          <>
                            <LinkedSystemRow>
                              <LinkedSystemField>
                                <Label>From 시스템</Label>
                                <SearchableSelect
                                  options={systems}
                                  value={link.from}
                                  onChange={(val) => handleLinkChange(link.id, 'from', val)}
                                  placeholder="출발 시스템"
                                />
                              </LinkedSystemField>
                              <LinkedArrow>→</LinkedArrow>
                              <LinkedSystemField>
                                <Label>To 시스템</Label>
                                <SearchableSelect
                                  options={systems}
                                  value={link.to}
                                  onChange={(val) => handleLinkChange(link.id, 'to', val)}
                                  placeholder="도착 시스템"
                                />
                              </LinkedSystemField>
                            </LinkedSystemRow>
                            <Field style={{ marginBottom: 0 }}>
                              <Label>연계 방식</Label>
                              <SearchableSelect
                                options={linkMethodLabels}
                                value={link.method}
                                onChange={(val) => handleLinkChange(link.id, 'method', val)}
                                placeholder="연계 방식 선택"
                              />
                            </Field>
                          </>
                        )}
                      </LinkInstanceCard>
                    );
                  })}
                  <AddLinkBtn type="button" onClick={handleAddLink}>
                    <Plus size={14} />
                    연계 추가
                  </AddLinkBtn>
                </LinkedFieldGroup>
              )}
            </Field>
            <Field>
              <Label>설명</Label>
              <TextArea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="모듈에 대한 설명을 입력하세요 (선택)"
              />
            </Field>
          </FormPanel>
          <SpecPanel>
            <SpecPanelHeader>
              <SpecTitle>스펙 정의</SpecTitle>
              <SpecHeaderActions>
                <SpecAddButton type="button" onClick={addItem}>
                  <Plus size={14} />
                  항목 추가
                </SpecAddButton>
                <SpecAddButton type="button" onClick={addGroup}>
                  <FolderPlus size={14} />
                  그룹 추가
                </SpecAddButton>
                <SpecAddButton type="button" onClick={() => setShowBulkModal(true)}>
                  <ListPlus size={14} />
                  여러 데이터 추가
                </SpecAddButton>
              </SpecHeaderActions>
            </SpecPanelHeader>
            <SpecTreeContent>
              {specs.length === 0 ? (
                <SpecEmptyState>
                  <FolderPlus size={32} />
                  <p>스펙 항목이 없습니다.<br />위 버튼으로 항목 또는 그룹을 추가하세요.</p>
                </SpecEmptyState>
              ) : (
                specs.map(node => (
                  <SpecNodeRow
                    key={node.id}
                    node={node}
                    depth={0}
                    onUpdate={handleNodeUpdate}
                    onDelete={handleNodeDelete}
                    onAddChild={addChildItem}
                    onAddGroup={addChildGroup}
                  />
                ))
              )}
            </SpecTreeContent>
          </SpecPanel>
        </ModalBodyLayout>
        <ModalFooter>
          <CancelButton type="button" onClick={onClose}>취소</CancelButton>
          <SaveButton
            type="button"
            onClick={handleSubmit}
            disabled={!name.trim() || !divisionId}
          >
            {module ? '수정' : '추가'}
          </SaveButton>
        </ModalFooter>
      </Modal>

      <BulkAddModal
        isOpen={showBulkModal}
        specs={specs}
        onClose={() => setShowBulkModal(false)}
        onApply={handleBulkApply}
      />
    </Overlay>
  );
};

export default ModuleModal;
