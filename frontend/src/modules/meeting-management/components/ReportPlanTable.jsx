import React, { useState, useRef, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { Plus, Trash2, Calendar, Unlink, Link, Link2, ChevronUp, ChevronDown, X } from 'lucide-react';
import settingsData from '../../../option/systemsetting.json';

// ============== Constants ==============

const STATUSES = [
  { value: '미정', color: '#94a3b8', bg: '#f1f5f9', rowBg: 'transparent' },
  { value: '계획', color: '#3b82f6', bg: '#eff6ff', rowBg: '#f8fbff' },
  { value: '안건 확정', color: '#f59e0b', bg: '#fffbeb', rowBg: '#fff7ed' },
  { value: '준비 중', color: '#8b5cf6', bg: '#f5f3ff', rowBg: '#fefce8' },
  { value: '완료', color: '#10b981', bg: '#ecfdf5', rowBg: '#f0fdf4' },
];

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

const DIVISIONS = (settingsData?.divisions || []).map(d => ({
  id: d.id,
  name: d.name,
  color: d.color,
}));

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const formatScheduleDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const dayName = DAY_NAMES[d.getDay()];
  return `${month}/${day} (${dayName})`;
};

// 해당 날짜가 그 해의 몇 번째 주인지 계산 (ISO 8601 기준)
const getWeekNumber = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  const oneJan = new Date(d.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((d - oneJan) / 86400000) + 1;
  return Math.ceil((dayOfYear + oneJan.getDay()) / 7);
};

// ============== Styled Components ==============

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  padding: 1.25rem;
`;

const TableContainer = styled.div`
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  overflow: auto;
  max-height: calc(100vh - 220px);
`;

const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;

  th {
    padding: 0.625rem 0.75rem;
    text-align: left;
    font-size: 0.9rem;
    font-weight: 600;
    color: #475569;
    background: #f8fafc;
    border-bottom: 2px solid #cbd5e1;
    border-right: 1px solid #e2e8f0;
    white-space: nowrap;
    position: sticky;
    top: 0;
    z-index: 2;
  }

  th:last-child {
    border-right: none;
  }

  td {
    padding: 0;
    border-bottom: 1px solid #e2e8f0;
    border-right: 1px solid #e2e8f0;
    font-size: 0.95rem;
    color: #334155;
    vertical-align: middle;
    position: relative;
  }

  td:last-child {
    border-right: none;
  }
`;

/*
  Column widths — 구분:Agenda:주요내용 = 1:5:5
  회차(64) + 일정(100) + 구분(1fr) + Agenda(5fr) + 주요내용(5fr) + 진행현황(100) + 삭제(36)
  Using percentage for the 1:5:5 trio after fixed columns.
  Fixed total ≈ 300px, remaining split as ~9% : ~45.5% : ~45.5%
*/
const ColRound = styled.col`width: 80px;`;
const ColSchedule = styled.col`width: 170px;`;
const ColStatus = styled.col`width: 110px;`;
const ColAction = styled.col`width: 200px;`;

const Cell = styled.div`
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: ${props => props.center ? 'center' : 'flex-start'};
  padding: 0.5rem 0.75rem;
  cursor: ${props => props.readOnly ? 'default' : 'text'};
  width: 100%;
  box-sizing: border-box;

  &:hover {
    background: ${props => props.readOnly ? 'transparent' : '#faf5ff'};
  }
`;

const CellInput = styled.input`
  width: 100%;
  border: none;
  outline: none;
  padding: 0.5rem 0.75rem;
  font-size: 0.95rem;
  color: #334155;
  background: #faf5ff;
  box-shadow: inset 0 0 0 2px #8b5cf6;
  min-height: 36px;
  font-family: inherit;
`;

const CellTextarea = styled.textarea`
  width: 100%;
  border: none;
  outline: none;
  padding: 0.5rem 0.75rem;
  font-size: 0.95rem;
  color: #334155;
  background: #faf5ff;
  box-shadow: inset 0 0 0 2px #8b5cf6;
  min-height: 60px;
  resize: vertical;
  font-family: inherit;
  line-height: 1.5;
`;

const StatusSelect = styled.select`
  width: 100%;
  border: none;
  outline: none;
  padding: 0.5rem 0.5rem;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  min-height: 36px;
  background: transparent;
  color: ${props => props.$statusColor || '#334155'};
  font-family: inherit;
  appearance: auto;

  &:focus {
    box-shadow: inset 0 0 0 2px #8b5cf6;
    background: #faf5ff;
  }
`;

const AddRoundButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.75rem;
  padding: 0.5rem 1rem;
  border: 1px dashed #cbd5e1;
  border-radius: 0.5rem;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  background: white;
  color: #64748b;
  transition: all 0.2s;

  &:hover {
    border-color: #8b5cf6;
    color: #8b5cf6;
    background: #faf5ff;
  }
`;

const AddItemButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border: none;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  cursor: pointer;
  background: transparent;
  color: #94a3b8;
  transition: all 0.15s;
  white-space: nowrap;

  &:hover {
    background: #f1f5f9;
    color: #8b5cf6;
  }
`;

const ActionCell = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.125rem;
  min-height: 36px;
  padding: 0.25rem;
`;

const ActionBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 0.25rem;
  background: transparent;
  color: ${props => props.$color || '#94a3b8'};
  cursor: pointer;
  padding: 0;
  transition: all 0.15s;
  flex-shrink: 0;

  &:hover {
    background: ${props => props.$hoverBg || '#f1f5f9'};
    color: ${props => props.$hoverColor || '#475569'};
  }

  &:disabled {
    opacity: 0.25;
    cursor: default;
    &:hover {
      background: transparent;
      color: ${props => props.$color || '#94a3b8'};
    }
  }
`;

const MoveToSelect = styled.select`
  height: 24px;
  border: 1px solid #e2e8f0;
  border-radius: 0.25rem;
  background: white;
  color: #64748b;
  cursor: pointer;
  padding: 0 0.25rem;
  font-size: 0.7rem;
  font-family: inherit;
  transition: all 0.15s;
  flex-shrink: 0;

  &:hover {
    border-color: #8b5cf6;
    color: #475569;
  }

  &:focus {
    outline: none;
    border-color: #8b5cf6;
  }
`;

const RoundCell = styled.td`
  background: #f8f7ff;
  border-right: 2px solid #d6d3e8 !important;
`;

const EmptyMessage = styled.div`
  text-align: center;
  padding: 3rem 1rem;
  color: #94a3b8;
  font-size: 0.9rem;
`;

const CellText = styled.span`
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
`;

const MergedCategoryCell = styled.td`
  border-right: 1px solid #f1f5f9;
`;

const CategoryCellContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;

  &:hover .merge-toggle-btn {
    opacity: 1;
  }
`;

const MergeToggleButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.125rem 0.375rem;
  border: none;
  border-top: 1px dashed #e2e8f0;
  background: transparent;
  color: #b0b8c4;
  font-size: 0.65rem;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  opacity: 0;

  &:hover {
    background: #f1f5f9;
    color: #8b5cf6;
  }
`;

// ---- Date picker styled components ----

const DateCellWrapper = styled.div`
  min-height: 36px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0.375rem 0.5rem;
  gap: 0.25rem;
  position: relative;
`;

const DateRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
`;

const DateDisplay = styled.span`
  font-size: 0.8rem;
  color: ${props => props.$hasValue ? '#334155' : '#cbd5e1'};
  white-space: nowrap;
`;

const DatePickerButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  background: white;
  color: #8b5cf6;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: all 0.15s;

  &:hover {
    background: #faf5ff;
    border-color: #8b5cf6;
  }
`;

const HiddenDateInput = styled.input`
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;
`;

const TimeDisplay = styled.div`
  font-size: 0.75rem;
  color: ${props => props.$hasValue ? '#64748b' : '#cbd5e1'};
  text-align: center;
  cursor: pointer;
  padding: 0.125rem 0;
  border-radius: 0.25rem;
  transition: background 0.15s;

  &:hover {
    background: #f5f3ff;
    color: #7c3aed;
  }
`;

const TimeEditInput = styled.input`
  width: 100%;
  padding: 0.25rem 0.375rem;
  border: 1px solid #8b5cf6;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  color: #334155;
  text-align: center;
  font-family: inherit;
  background: #faf5ff;
  outline: none;
`;

// ============== DateCell Component ==============

const TimeEditor = ({ timeStart, timeEnd, onTimeChange }) => {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState('');
  const inputRef = useRef(null);

  const displayText = (timeStart || timeEnd)
    ? `${timeStart || '00:00'} ~ ${timeEnd || '00:00'}`
    : '';

  useEffect(() => {
    if (editing) {
      setLocalValue(displayText || '00:00 ~ 00:00');
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const match = localValue.match(/(\d{1,2}:\d{2})\s*~\s*(\d{1,2}:\d{2})/);
    if (match) {
      onTimeChange('timeStart', match[1].padStart(5, '0'));
      onTimeChange('timeEnd', match[2].padStart(5, '0'));
    }
  };

  if (editing) {
    return (
      <TimeEditInput
        ref={inputRef}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        placeholder="00:00 ~ 00:00"
      />
    );
  }

  return (
    <TimeDisplay $hasValue={!!displayText} onClick={() => setEditing(true)}>
      {displayText || '시간 입력'}
    </TimeDisplay>
  );
};

const DateCell = ({ value, timeStart, timeEnd, onChange, onTimeChange }) => {
  const inputRef = useRef(null);

  const handleClick = () => {
    if (inputRef.current) {
      inputRef.current.showPicker?.();
      inputRef.current.click();
    }
  };

  return (
    <DateCellWrapper>
      <DateRow>
        <DateDisplay $hasValue={!!value}>
          {value ? formatScheduleDate(value) : '날짜 선택'}
        </DateDisplay>
        <DatePickerButton onClick={handleClick} title="날짜 선택">
          <Calendar size={13} />
        </DatePickerButton>
        <HiddenDateInput
          ref={inputRef}
          type="date"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      </DateRow>
      <TimeEditor
        timeStart={timeStart}
        timeEnd={timeEnd}
        onTimeChange={onTimeChange}
      />
    </DateCellWrapper>
  );
};

// ============== EditableCell Component ==============

const EditableCell = ({ value, onChange, multiline = false, placeholder = '', center = false }) => {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current.select) {
        inputRef.current.select();
      }
    }
  }, [editing]);

  const handleBlur = () => {
    setEditing(false);
    if (localValue !== value) {
      onChange(localValue);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setLocalValue(value);
      setEditing(false);
    }
    if (!multiline && e.key === 'Enter') {
      e.preventDefault();
      handleBlur();
    }
    if (e.key === 'Tab') {
      handleBlur();
    }
  };

  if (editing) {
    if (multiline) {
      return (
        <CellTextarea
          ref={inputRef}
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
        />
      );
    }
    return (
      <CellInput
        ref={inputRef}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />
    );
  }

  return (
    <Cell onClick={() => setEditing(true)} center={center}>
      {value ? <CellText>{value}</CellText> : <span style={{ color: '#cbd5e1' }}>{placeholder || '클릭하여 입력'}</span>}
    </Cell>
  );
};

// ============== CategoryAutocomplete Component ==============

const AutocompleteWrapper = styled.div`
  position: relative;
  width: 100%;
`;

const SuggestionList = styled.ul`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 10;
  background: white;
  border: 1px solid #e2e8f0;
  border-top: none;
  border-radius: 0 0 0.375rem 0.375rem;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  max-height: 160px;
  overflow-y: auto;
  margin: 0;
  padding: 0;
  list-style: none;
`;

const SuggestionItem = styled.li`
  padding: 0.5rem 0.75rem;
  font-size: 0.85rem;
  color: #334155;
  cursor: pointer;
  background: ${props => props.$active ? '#f5f3ff' : 'white'};

  &:hover {
    background: #f5f3ff;
    color: #7c3aed;
  }
`;

const CategoryAutocomplete = ({ value, onChange, suggestions, placeholder = '구분' }) => {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const filtered = suggestions.filter(
    s => s !== '' && s.toLowerCase().includes((localValue || '').toLowerCase()) && s !== localValue
  );

  const commit = (val) => {
    setEditing(false);
    setActiveIdx(-1);
    if (val !== value) {
      onChange(val);
    }
  };

  const handleBlur = (e) => {
    // delay so click on suggestion fires first
    setTimeout(() => {
      if (wrapperRef.current && !wrapperRef.current.contains(document.activeElement)) {
        commit(localValue);
      }
    }, 150);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setLocalValue(value);
      setEditing(false);
      setActiveIdx(-1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && activeIdx < filtered.length) {
        setLocalValue(filtered[activeIdx]);
        commit(filtered[activeIdx]);
      } else {
        commit(localValue);
      }
    } else if (e.key === 'Tab') {
      commit(localValue);
    }
  };

  if (editing) {
    return (
      <AutocompleteWrapper ref={wrapperRef}>
        <CellTextarea
          ref={inputRef}
          value={localValue}
          onChange={(e) => { setLocalValue(e.target.value); setActiveIdx(-1); }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          style={{ minHeight: '36px' }}
        />
        {filtered.length > 0 && (
          <SuggestionList>
            {filtered.map((s, i) => (
              <SuggestionItem
                key={s}
                $active={i === activeIdx}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setLocalValue(s);
                  commit(s);
                }}
              >
                {s}
              </SuggestionItem>
            ))}
          </SuggestionList>
        )}
      </AutocompleteWrapper>
    );
  }

  return (
    <Cell onClick={() => setEditing(true)}>
      {value ? <CellText>{value}</CellText> : <span style={{ color: '#cbd5e1' }}>{placeholder}</span>}
    </Cell>
  );
};

// ============== DivisionPicker Component ==============

const DivisionCellWrapper = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  padding: 0.375rem 0.5rem;
  min-height: 36px;
  align-items: center;
  cursor: pointer;
  position: relative;
  overflow: visible;

  &:hover {
    background: #faf5ff;
  }
`;

const DivisionTag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.7rem;
  font-weight: 600;
  color: white;
  background: ${props => props.$color || '#8b5cf6'};
  white-space: nowrap;
`;

const DivisionTagRemove = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: rgba(255,255,255,0.7);
  cursor: pointer;
  padding: 0;
  margin-left: 0.125rem;
  line-height: 1;

  &:hover {
    color: white;
  }
`;

const DivisionDropdown = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 9999;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  box-shadow: 0 4px 12px rgba(0,0,0,0.12);
  padding: 0.25rem;
`;

const DivisionOption = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.8rem;
  cursor: pointer;
  color: #334155;
  transition: background 0.1s;

  &:hover {
    background: #f5f3ff;
  }

  input {
    accent-color: #8b5cf6;
  }
`;

const DivisionColorDot = styled.span`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${props => props.$color};
  flex-shrink: 0;
`;

const DivisionPlaceholder = styled.span`
  color: #cbd5e1;
  font-size: 0.8rem;
`;

const DivisionPicker = ({ selected = [], onChange }) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const toggleDiv = (divId) => {
    if (selected.includes(divId)) {
      onChange(selected.filter(id => id !== divId));
    } else {
      onChange([...selected, divId]);
    }
  };

  const removeDiv = (e, divId) => {
    e.stopPropagation();
    onChange(selected.filter(id => id !== divId));
  };

  return (
    <DivisionCellWrapper ref={wrapperRef} onClick={() => setOpen(!open)}>
      {selected.length > 0 ? (
        selected.map(divId => {
          const div = DIVISIONS.find(d => d.id === divId);
          if (!div) return null;
          return (
            <DivisionTag key={divId} $color={div.color}>
              {div.name}
              <DivisionTagRemove onClick={(e) => removeDiv(e, divId)}>
                <X size={10} />
              </DivisionTagRemove>
            </DivisionTag>
          );
        })
      ) : (
        <DivisionPlaceholder>사업부 선택</DivisionPlaceholder>
      )}
      {open && (
        <DivisionDropdown onClick={(e) => e.stopPropagation()}>
          {DIVISIONS.map(div => (
            <DivisionOption key={div.id}>
              <input
                type="checkbox"
                checked={selected.includes(div.id)}
                onChange={() => toggleDiv(div.id)}
              />
              <DivisionColorDot $color={div.color} />
              {div.name}
            </DivisionOption>
          ))}
        </DivisionDropdown>
      )}
    </DivisionCellWrapper>
  );
};

// ============== Helper: compute category rowSpans ==============

const computeCategorySpans = (items) => {
  // categoryMerged: undefined/true = auto-merge, false = force split
  const spans = {};
  let i = 0;
  while (i < items.length) {
    let span = 1;
    const cat = items[i].category;
    if (cat !== '') {
      while (
        i + span < items.length &&
        items[i + span].category === cat &&
        items[i + span].categoryMerged !== false
      ) {
        span++;
      }
    }
    spans[i] = { show: true, rowSpan: span };
    for (let j = 1; j < span; j++) {
      spans[i + j] = { show: false, rowSpan: 0 };
    }
    i += span;
  }
  return spans;
};

// ============== Main Component ==============

const ReportPlanTable = ({ rounds, onRoundsChange, planTab, otherTabs, onLinkToOther, onUnlink, readOnly = false }) => {
  // otherTabs: [{ tabKey, label, shortLabel, rounds, roundFmt }]
  const otherTabsArr = otherTabs || [];
  const formatRoundLabel = (round, fmt) => {
    if (fmt === 'week') {
      const wk = getWeekNumber(round.schedule);
      return wk ? `${wk}주차` : '날짜 미정';
    }
    return `${round.roundNumber}회차`;
  };

  const bottomRef = useRef(null);

  // ---- Mutators ----

  const addRound = useCallback(() => {
    const newRound = {
      id: generateId(),
      roundNumber: rounds.length + 1,
      schedule: '',
      timeStart: '',
      timeEnd: '',
      status: '미정',
      items: [
        { id: generateId(), category: '', agenda: '', content: '', divisions: [] }
      ]
    };
    onRoundsChange([...rounds, newRound]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, [rounds, onRoundsChange]);

  const addItem = useCallback((roundId) => {
    onRoundsChange(rounds.map(r => {
      if (r.id === roundId) {
        return {
          ...r,
          items: [...r.items, { id: generateId(), category: '', agenda: '', content: '', divisions: [] }]
        };
      }
      return r;
    }));
  }, [rounds, onRoundsChange]);

  const updateRound = useCallback((roundId, field, value) => {
    onRoundsChange(rounds.map(r => r.id === roundId ? { ...r, [field]: value } : r));
  }, [rounds, onRoundsChange]);

  const updateItem = useCallback((roundId, itemId, field, value) => {
    onRoundsChange(rounds.map(r => {
      if (r.id === roundId) {
        return {
          ...r,
          items: r.items.map(item =>
            item.id === itemId ? { ...item, [field]: value } : item
          )
        };
      }
      return r;
    }));
  }, [rounds, onRoundsChange]);

  const deleteRound = useCallback((roundId) => {
    const updated = rounds.filter(r => r.id !== roundId);
    onRoundsChange(updated.map((r, i) => ({ ...r, roundNumber: i + 1 })));
  }, [rounds, onRoundsChange]);

  const deleteItem = useCallback((roundId, itemId) => {
    const updated = rounds.map(r => {
      if (r.id === roundId) {
        const newItems = r.items.filter(item => item.id !== itemId);
        if (newItems.length === 0) return null;
        return { ...r, items: newItems };
      }
      return r;
    }).filter(Boolean);
    onRoundsChange(updated.map((r, i) => ({ ...r, roundNumber: i + 1 })));
  }, [rounds, onRoundsChange]);

  // Split a merged category group at a given item index
  const splitCategory = useCallback((roundId, itemIdx) => {
    onRoundsChange(rounds.map(r => {
      if (r.id === roundId) {
        return {
          ...r,
          items: r.items.map((it, idx) =>
            idx === itemIdx ? { ...it, categoryMerged: false } : it
          )
        };
      }
      return r;
    }));
  }, [rounds, onRoundsChange]);

  // Merge an item back with the group above it
  const mergeCategory = useCallback((roundId, itemIdx) => {
    onRoundsChange(rounds.map(r => {
      if (r.id === roundId) {
        return {
          ...r,
          items: r.items.map((it, idx) =>
            idx === itemIdx ? { ...it, categoryMerged: true } : it
          )
        };
      }
      return r;
    }));
  }, [rounds, onRoundsChange]);

  // Move item up within round
  const moveItemUp = useCallback((roundId, itemIdx) => {
    if (itemIdx <= 0) return;
    onRoundsChange(rounds.map(r => {
      if (r.id === roundId) {
        const newItems = [...r.items];
        [newItems[itemIdx - 1], newItems[itemIdx]] = [newItems[itemIdx], newItems[itemIdx - 1]];
        return { ...r, items: newItems };
      }
      return r;
    }));
  }, [rounds, onRoundsChange]);

  // Move item down within round
  const moveItemDown = useCallback((roundId, itemIdx, itemCount) => {
    if (itemIdx >= itemCount - 1) return;
    onRoundsChange(rounds.map(r => {
      if (r.id === roundId) {
        const newItems = [...r.items];
        [newItems[itemIdx], newItems[itemIdx + 1]] = [newItems[itemIdx + 1], newItems[itemIdx]];
        return { ...r, items: newItems };
      }
      return r;
    }));
  }, [rounds, onRoundsChange]);

  // Move item to a different round
  const moveItemToRound = useCallback((sourceRoundId, itemId, targetRoundId) => {
    if (sourceRoundId === targetRoundId) return;
    let movedItem = null;
    let updated = rounds.map(r => {
      if (r.id === sourceRoundId) {
        movedItem = r.items.find(it => it.id === itemId);
        const newItems = r.items.filter(it => it.id !== itemId);
        if (newItems.length === 0) {
          // 마지막 아이템 이동 시 빈 행 유지 (회차 삭제 방지)
          return { ...r, items: [{ id: generateId(), category: '', agenda: '', content: '', divisions: [] }] };
        }
        return { ...r, items: newItems };
      }
      return r;
    });
    if (movedItem) {
      updated = updated.map(r => {
        if (r.id === targetRoundId) {
          return { ...r, items: [...r.items, { ...movedItem, categoryMerged: undefined }] };
        }
        return r;
      });
    }
    onRoundsChange(updated.map((r, i) => ({ ...r, roundNumber: i + 1 })));
  }, [rounds, onRoundsChange]);

  // Collect all unique category values for autocomplete
  const allCategories = React.useMemo(() => {
    const set = new Set();
    rounds.forEach(r => r.items.forEach(it => {
      if (it.category) set.add(it.category);
    }));
    return [...set].sort();
  }, [rounds]);

  // ---- Render ----

  const renderRoundRows = (round) => {
    const totalItems = round.items.length;
    const categorySpans = computeCategorySpans(round.items);

    return round.items.map((item, itemIdx) => {
      const isFirst = itemIdx === 0;
      const catSpan = categorySpans[itemIdx];
      const statusInfo = STATUSES.find(s => s.value === round.status) || STATUSES[3];

      return (
        <tr key={item.id} style={{ backgroundColor: statusInfo.rowBg }}>
          {/* 회차 */}
          {isFirst && (
            <RoundCell rowSpan={totalItems + 1}>
              <Cell center readOnly>
                <strong>
                  {planTab === 'cfo'
                    ? `${getWeekNumber(round.schedule) ? getWeekNumber(round.schedule) + '주차 주간회의' : '주간회의 날짜 미정'}`
                    : `${round.roundNumber}회차`
                  }
                </strong>
              </Cell>
            </RoundCell>
          )}

          {/* 일정 */}
          {isFirst && (
            <td rowSpan={totalItems + 1} >
              {readOnly ? (
                <DateCellWrapper>
                  <DateRow>
                    <DateDisplay $hasValue={!!round.schedule}>
                      {round.schedule ? formatScheduleDate(round.schedule) : '-'}
                    </DateDisplay>
                  </DateRow>
                  {(round.timeStart || round.timeEnd) && (
                    <div style={{ fontSize: '0.75rem', color: '#64748b', padding: '0.25rem 0.5rem' }}>
                      {round.timeStart || ''}{round.timeStart && round.timeEnd ? ' ~ ' : ''}{round.timeEnd || ''}
                    </div>
                  )}
                </DateCellWrapper>
              ) : (
                <DateCell
                  value={round.schedule}
                  timeStart={round.timeStart}
                  timeEnd={round.timeEnd}
                  onChange={(v) => updateRound(round.id, 'schedule', v)}
                  onTimeChange={(field, v) => updateRound(round.id, field, v)}
                />
              )}
            </td>
          )}

          {/* 구분 */}
          {catSpan.show && (
            <MergedCategoryCell rowSpan={catSpan.rowSpan}>
              {readOnly ? (
                <Cell readOnly>{item.category || ''}</Cell>
              ) : (
                <CategoryCellContent>
                  <CategoryAutocomplete
                    value={item.category}
                    suggestions={allCategories}
                    onChange={(v) => {
                      const startIdx = itemIdx;
                      const endIdx = itemIdx + catSpan.rowSpan;
                      onRoundsChange(rounds.map(r => {
                        if (r.id === round.id) {
                          return {
                            ...r,
                            items: r.items.map((it, idx) => {
                              if (idx >= startIdx && idx < endIdx) {
                                return { ...it, category: v };
                              }
                              return it;
                            })
                          };
                        }
                        return r;
                      }));
                    }}
                    placeholder="구분"
                  />
                  {/* 병합된 셀이면 분리 버튼 표시 */}
                  {catSpan.rowSpan > 1 && (
                    <MergeToggleButton
                      className="merge-toggle-btn"
                      onClick={() => {
                        const splitIdx = itemIdx + 1;
                        splitCategory(round.id, splitIdx);
                      }}
                      title="셀 분리"
                    >
                      <Unlink size={10} />
                      분리
                    </MergeToggleButton>
                  )}
                  {/* 분리된 셀인데 위 행과 같은 값이면 병합 버튼 표시 */}
                  {catSpan.rowSpan === 1 &&
                    itemIdx > 0 &&
                    item.category !== '' &&
                    round.items[itemIdx - 1].category === item.category &&
                    item.categoryMerged === false && (
                    <MergeToggleButton
                      className="merge-toggle-btn"
                      onClick={() => mergeCategory(round.id, itemIdx)}
                      title="위 셀과 병합"
                    >
                      <Link size={10} />
                      병합
                    </MergeToggleButton>
                  )}
                </CategoryCellContent>
              )}
            </MergedCategoryCell>
          )}

          {/* 담당 사업부 */}
          <td>
            {readOnly ? (
              <Cell readOnly>
                {(item.divisions || []).map(d => {
                  const div = DIVISIONS.find(dd => dd.id === d);
                  return div ? div.name : d;
                }).join(', ') || ''}
              </Cell>
            ) : (
              <DivisionPicker
                selected={item.divisions || []}
                onChange={(v) => updateItem(round.id, item.id, 'divisions', v)}
              />
            )}
          </td>

          {/* Agenda 구성 */}
          <td style={item.linkedId ? { borderLeft: '3px solid #3b82f6' } : undefined}>
            {item.linkedId && (() => {
              // 모든 다른 탭에서 동일 linkedId를 가진 회차를 찾아 표시
              const linkedParts = [];
              otherTabsArr.forEach(ot => {
                (ot.rounds || []).forEach(r => {
                  if (r.items.some(it => it.linkedId === item.linkedId)) {
                    linkedParts.push(`${ot.label} ${formatRoundLabel(r, ot.roundFmt)}`);
                  }
                });
              });
              const tooltipText = linkedParts.length > 0
                ? `${linkedParts.join(', ')}에 연결됨`
                : '연결됨';
              return (
                <div
                  title={tooltipText}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.25rem',
                    padding: '0.125rem 0.5rem 0', cursor: 'default',
                    color: '#3b82f6', fontSize: '0.65rem', fontWeight: 600,
                  }}
                >
                  <Link2 size={10} />
                  {linkedParts.length > 0 ? linkedParts.join(' · ') : '연결됨'}
                </div>
              );
            })()}
            {readOnly ? (
              <Cell readOnly style={{ whiteSpace: 'pre-wrap' }}>{item.agenda || ''}</Cell>
            ) : (
              <EditableCell
                value={item.agenda}
                onChange={(v) => updateItem(round.id, item.id, 'agenda', v)}
                multiline
                placeholder="Agenda"
              />
            )}
          </td>

          {/* 주요 내용 */}
          <td>
            {readOnly ? (
              <Cell readOnly style={{ whiteSpace: 'pre-wrap' }}>{item.content || ''}</Cell>
            ) : (
              <EditableCell
                value={item.content}
                onChange={(v) => updateItem(round.id, item.id, 'content', v)}
                multiline
                placeholder="주요 내용 (방법 포함)"
              />
            )}
          </td>

          {/* 진행 현황 */}
          {isFirst && (
            <td rowSpan={totalItems + 1} >
              {readOnly ? (
                <Cell readOnly center style={{ color: statusInfo.color, fontWeight: 500 }}>
                  {round.status}
                </Cell>
              ) : (
                <StatusSelect
                  value={round.status}
                  onChange={(e) => updateRound(round.id, 'status', e.target.value)}
                  $statusColor={statusInfo.color}
                >
                  {STATUSES.map(s => (
                    <option key={s.value} value={s.value}>{s.value}</option>
                  ))}
                </StatusSelect>
              )}
            </td>
          )}

          {/* 액션 */}
          {!readOnly && (
          <td>
            <ActionCell>
              <ActionBtn
                onClick={() => moveItemUp(round.id, itemIdx)}
                disabled={itemIdx === 0}
                title="위로 이동"
              >
                <ChevronUp size={14} />
              </ActionBtn>
              <ActionBtn
                onClick={() => moveItemDown(round.id, itemIdx, totalItems)}
                disabled={itemIdx === totalItems - 1}
                title="아래로 이동"
              >
                <ChevronDown size={14} />
              </ActionBtn>
              {rounds.length > 1 && (
                <MoveToSelect
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      moveItemToRound(round.id, item.id, e.target.value);
                    }
                  }}
                  title="다른 회차로 이동"
                >
                  <option value="">이동</option>
                  {rounds.filter(r => r.id !== round.id).map(r => {
                    const datePart = r.schedule ? ` (${r.schedule.slice(5)})` : '';
                    return (
                      <option key={r.id} value={r.id}>
                        {planTab === 'cfo'
                          ? `${getWeekNumber(r.schedule) ? getWeekNumber(r.schedule) + '주차로' : '날짜 미정'}${datePart}`
                          : `${r.roundNumber}회차로${datePart}`
                        }
                      </option>
                    );
                  })}
                </MoveToSelect>
              )}
              {onLinkToOther && otherTabsArr.map(ot => {
                // 이미 해당 탭에 같은 linkedId 항목이 존재하면 추가 연결 비활성화
                const alreadyLinked = item.linkedId && (ot.rounds || []).some(r =>
                  r.items.some(it => it.linkedId === item.linkedId)
                );
                if (alreadyLinked) return null;
                return (
                  <MoveToSelect
                    key={`link-${ot.tabKey}`}
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        onLinkToOther(item, round.id, e.target.value, ot.tabKey);
                      }
                    }}
                    title={`${ot.label}에 연결`}
                    style={{ color: '#0369a1' }}
                  >
                    <option value="">{`⇄ ${ot.shortLabel || ot.label}`}</option>
                    {(ot.rounds || []).map(r => {
                      const datePart = r.schedule ? ` (${r.schedule.slice(5)})` : '';
                      return (
                        <option key={r.id} value={r.id}>
                          {`${formatRoundLabel(r, ot.roundFmt)}${datePart}`}
                        </option>
                      );
                    })}
                  </MoveToSelect>
                );
              })}
              {item.linkedId && (
                <ActionBtn
                  onClick={() => onUnlink && onUnlink(item)}
                  title="연결 해제"
                  $color="#0ea5e9"
                  $hoverBg="#fef2f2"
                  $hoverColor="#ef4444"
                >
                  <Link2 size={13} />
                </ActionBtn>
              )}
              <ActionBtn
                onClick={() => totalItems > 1 ? deleteItem(round.id, item.id) : deleteRound(round.id)}
                title={totalItems > 1 ? '행 삭제' : (planTab === 'cfo' ? '주간회의 삭제' : '회차 삭제')}
                $color="#cbd5e1"
                $hoverBg="#fef2f2"
                $hoverColor="#ef4444"
              >
                <Trash2 size={13} />
              </ActionBtn>
            </ActionCell>
          </td>
          )}
        </tr>
      );
    });
  };

  const renderAddItemRow = (round) => {
    if (readOnly) {
      return (
        <tr key={`add-${round.id}`}>
          <td colSpan={7} style={{ borderBottom: '3px solid #cbd5e1', padding: 0 }} />
        </tr>
      );
    }
    const addRowStatus = STATUSES.find(s => s.value === round.status) || STATUSES[0];
    return (
    <tr key={`add-${round.id}`} style={{ backgroundColor: addRowStatus.rowBg }}>
      <td colSpan={4} style={{ borderBottom: '3px solid #cbd5e1' }}>
        <AddItemButton onClick={() => addItem(round.id)}>
          <Plus size={13} />
          행 추가
        </AddItemButton>
      </td>
      <td style={{ borderBottom: '3px solid #cbd5e1' }} />
    </tr>
    );
  };

  return (
    <Wrapper>
      <TableContainer>
        <StyledTable>
          <colgroup>
            <ColRound />
            <ColSchedule />
            <col style={{ width: '240px' }} />
            <col style={{ width: '320px' }} />
            <col style={{ minWidth: '200px' }} />
            <col style={{ minWidth: '200px' }} />
            <ColStatus />
            {!readOnly && <ColAction />}
          </colgroup>
          <thead>
            <tr>
              <th>{planTab === 'cfo' ? '주차' : '회차'}</th>
              <th>일정</th>
              <th>구분</th>
              <th>담당 사업부</th>
              <th>Agenda 구성</th>
              <th>주요 내용 (방법 포함)</th>
              <th>진행 현황</th>
              {!readOnly && <th>Action</th>}
            </tr>
          </thead>
          <tbody>
            {rounds.length > 0 ? (
              rounds.map((round) => (
                <React.Fragment key={round.id}>
                  {renderRoundRows(round)}
                  {renderAddItemRow(round)}
                </React.Fragment>
              ))
            ) : (
              <tr>
                <td colSpan={readOnly ? 7 : 8}>
                  <EmptyMessage>
                    {readOnly
                      ? '등록된 보고 계획이 없습니다.'
                      : `아래 버튼을 클릭하여 ${planTab === 'cfo' ? '주간회의를' : '회차를'} 추가하세요.`
                    }
                  </EmptyMessage>
                </td>
              </tr>
            )}
          </tbody>
        </StyledTable>
      </TableContainer>
      {!readOnly && (
        <AddRoundButton onClick={addRound}>
          <Plus size={16} />
          {planTab === 'cfo' ? '주간회의 추가' : '회차 추가'}
        </AddRoundButton>
      )}
      <div ref={bottomRef} />
    </Wrapper>
  );
};

export default ReportPlanTable;
