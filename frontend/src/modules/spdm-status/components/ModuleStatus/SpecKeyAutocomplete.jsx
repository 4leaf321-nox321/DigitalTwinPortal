import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { spdmApi } from '../../services/spdmApi';

const Container = styled.div`
  position: relative;
  flex: 1;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.375rem 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  color: #1e293b;
  background: white;
  outline: none;
  box-sizing: border-box;

  &:focus {
    border-color: #8b5cf6;
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.15);
  }

  &::placeholder {
    color: #94a3b8;
  }
`;

const Dropdown = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 100;
  max-height: 200px;
  overflow-y: auto;
  margin-top: 2px;
`;

const Option = styled.div`
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
  color: #1e293b;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;

  &:hover {
    background: #f1f5f9;
  }

  ${props => props.$active && `
    background: #ede9fe;
  `}
`;

const UsageCount = styled.span`
  font-size: 0.6875rem;
  color: #94a3b8;
`;

const SpecKeyAutocomplete = ({ value, onChange, placeholder = '키 입력...' }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!value || value.length < 1) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const results = await spdmApi.getSpecKeySuggestions(value);
        setSuggestions(results);
        setIsOpen(results.length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (key) => {
    onChange(key);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!isOpen || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[activeIndex].key);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <Container ref={containerRef}>
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />
      {isOpen && suggestions.length > 0 && (
        <Dropdown>
          {suggestions.map((s, i) => (
            <Option
              key={s.id}
              $active={i === activeIndex}
              onClick={() => handleSelect(s.key)}
            >
              <span>{s.key}</span>
              <UsageCount>{s.usageCount}회</UsageCount>
            </Option>
          ))}
        </Dropdown>
      )}
    </Container>
  );
};

export default SpecKeyAutocomplete;
