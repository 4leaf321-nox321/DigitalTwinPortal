import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Search, UserPlus } from 'lucide-react';
import authApi from '../../../auth/services/authApi';

// ============== Styled Components ==============

const Overlay = styled(motion.div)`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 30000;
`;

const ModalContainer = styled(motion.div)`
  background: #ffffff;
  border-radius: 14px;
  width: 900px;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
`;

const ModalHeader = styled.div`
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  padding: 14px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: white;
  flex-shrink: 0;
`;

const ModalTitle = styled.h3`
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const CloseBtn = styled.button`
  background: rgba(255,255,255,0.2);
  border: none;
  color: white;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  &:hover { background: rgba(255,255,255,0.3); }
`;

const ModalBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const ModalFooter = styled.div`
  padding: 14px 20px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
`;

const FooterInfo = styled.span`
  font-size: 0.78rem;
  color: #64748b;
`;

const ConfirmBtn = styled.button`
  padding: 8px 18px;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  color: white;
  display: flex;
  align-items: center;
  gap: 6px;
  &:hover { background: linear-gradient(135deg, #4f46e5, #4338ca); }
`;

const SectionLabel = styled.label`
  font-size: 0.78rem;
  font-weight: 600;
  color: #64748b;
`;

const InputRow = styled.div`
  display: grid;
  grid-template-columns: ${props => props.$cols || '1fr 1fr 1fr 1fr auto'};
  gap: 8px;
  align-items: end;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const FieldLabel = styled.label`
  font-size: 0.7rem;
  font-weight: 600;
  color: #94a3b8;
`;

const Input = styled.input`
  padding: 7px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.82rem;
  color: #1e293b;
  outline: none;
  &:focus { border-color: #818cf8; }
  &::placeholder { color: #94a3b8; }
`;

const Select = styled.select`
  padding: 7px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.82rem;
  color: #1e293b;
  outline: none;
  cursor: pointer;
  &:focus { border-color: #818cf8; }
`;

const AddBtn = styled.button`
  padding: 7px 14px;
  border: 1px solid #a5b4fc;
  background: #eef2ff;
  color: #4f46e5;
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 3px;
  &:hover:not(:disabled) { background: #e0e7ff; }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

// 검색 자동완성
const SearchWrapper = styled.div`
  position: relative;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 7px 10px 7px 30px;
  border: 1px solid ${props => props.$hasResults ? '#818cf8' : '#d1d5db'};
  border-radius: 6px;
  font-size: 0.82rem;
  color: #1e293b;
  outline: none;
  box-sizing: border-box;
  &:focus { border-color: #818cf8; }
  &::placeholder { color: #94a3b8; }
`;

const SearchIcon = styled.div`
  position: absolute;
  left: 9px;
  top: 50%;
  transform: translateY(-50%);
  color: #94a3b8;
  pointer-events: none;
`;

const Dropdown = styled.ul`
  position: absolute;
  top: calc(100% + 3px);
  left: 0; right: 0;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  max-height: 200px;
  overflow-y: auto;
  z-index: 20;
  margin: 0;
  padding: 4px;
  list-style: none;
`;

const DropdownItem = styled.li`
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.1s;
  &:hover, &[data-active="true"] { background: #eef2ff; }
`;

const DropdownName = styled.div`
  font-size: 0.82rem;
  font-weight: 600;
  color: #1e293b;
`;

const DropdownDetail = styled.div`
  font-size: 0.72rem;
  color: #64748b;
  margin-top: 1px;
`;

const DropdownHighlight = styled.span`
  font-weight: 700;
  color: #6366f1;
`;

// 추가된 인원 목록
const AddedList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const AddedItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
`;

const AddedInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const AddedName = styled.span`
  font-size: 0.82rem;
  font-weight: 600;
  color: #1e293b;
`;

const AddedMeta = styled.span`
  font-size: 0.72rem;
  color: #64748b;
  margin-left: 6px;
`;

const RemoveBtn = styled.button`
  width: 22px;
  height: 22px;
  border: none;
  background: transparent;
  color: #94a3b8;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  &:hover { background: #fef2f2; color: #ef4444; }
`;

const Divider = styled.div`
  border-top: 1px dashed #e2e8f0;
  margin: 4px 0;
`;

const EmptyHint = styled.div`
  text-align: center;
  padding: 20px;
  color: #94a3b8;
  font-size: 0.82rem;
`;

// ============== Component ==============

const PersonnelModal = ({ isOpen, onClose, onConfirm, divisions = [], departments = [] }) => {
  const [pendingList, setPendingList] = useState([]);
  const [nameQuery, setNameQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [input, setInput] = useState({ 이름: '', knoxId: '', 사업부: '', 부서: '' });
  const searchTimerRef = useRef(null);
  const wrapperRef = useRef(null);
  const nameInputRef = useRef(null);
  const mouseDownInsideRef = useRef(false);

  // 사업부에 따른 부서 필터
  const filteredDepts = useMemo(() => {
    if (!input.사업부) return departments;
    const div = divisions.find(d => d.name === input.사업부);
    if (!div) return departments;
    return departments.filter(d => d.divisionId === div.id || d.divisionId === null);
  }, [input.사업부, departments, divisions]);

  // 모달 열릴 때 초기화
  useEffect(() => {
    if (isOpen) {
      setPendingList([]);
      setNameQuery('');
      setSearchResults([]);
      setDropdownOpen(false);
      setInput({ 이름: '', knoxId: '', 사업부: '', 부서: '' });
    }
  }, [isOpen]);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // 이름 검색 (debounce 300ms)
  const handleNameSearch = useCallback((q) => {
    setNameQuery(q);
    setInput(prev => ({ ...prev, 이름: q }));
    setActiveIdx(-1);

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (q.trim().length < 2) {
      setSearchResults([]);
      setDropdownOpen(false);
      return;
    }

    searchTimerRef.current = setTimeout(async () => {
      try {
        const results = await authApi.searchUsers(q.trim());
        setSearchResults(results || []);
        setDropdownOpen((results || []).length > 0);
      } catch (e) {
        setSearchResults([]);
        setDropdownOpen(false);
      }
    }, 300);
  }, []);

  // 검색 결과에서 사용자 선택
  const selectUser = useCallback((user) => {
    const knoxId = user.email ? user.email.split('@')[0] : '';
    // 부서로부터 사업부 자동 매칭
    let matchedDiv = '';
    if (user.department) {
      const dept = departments.find(d => d.name === user.department);
      if (dept && dept.divisionId) {
        const div = divisions.find(d => d.id === dept.divisionId || String(d.id) === String(dept.divisionId));
        if (div) matchedDiv = div.name;
      }
    }
    setInput({
      이름: user.name,
      knoxId,
      사업부: matchedDiv,
      부서: user.department || '',
    });
    setNameQuery(user.name);
    setDropdownOpen(false);
    setSearchResults([]);
  }, [departments, divisions]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(prev => (prev < searchResults.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && activeIdx < searchResults.length) {
        selectUser(searchResults[activeIdx]);
      }
    } else if (e.key === 'Escape') {
      setDropdownOpen(false);
    }
  }, [activeIdx, searchResults, selectUser]);

  const handleInputField = useCallback((field, value) => {
    setInput(prev => {
      const next = { ...prev, [field]: value };
      if (field === '사업부') next.부서 = '';
      return next;
    });
  }, []);

  // 목록에 추가
  const addToPending = useCallback(() => {
    if (!input.이름.trim()) return;
    const entry = {
      이름: input.이름.trim(),
      knoxId: input.knoxId.trim(),
      사업부: input.사업부,
      부서: input.부서,
    };
    setPendingList(prev => [...prev, entry]);
    setInput({ 이름: '', knoxId: '', 사업부: '', 부서: '' });
    setNameQuery('');
    setTimeout(() => nameInputRef.current?.focus(), 0);
  }, [input]);

  const removeFromPending = useCallback((index) => {
    setPendingList(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleConfirm = useCallback(() => {
    onConfirm(pendingList);
    onClose();
  }, [pendingList, onConfirm, onClose]);

  const handleOverlayClose = useCallback(() => {
    if (pendingList.length > 0) {
      if (!window.confirm('추가 대기 중인 담당자가 있습니다. 닫으시겠습니까?')) return;
    }
    onClose();
  }, [pendingList, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <Overlay
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onMouseDown={() => { mouseDownInsideRef.current = false; }}
        onClick={() => {
          if (mouseDownInsideRef.current) { mouseDownInsideRef.current = false; return; }
          handleOverlayClose();
        }}
      >
        <ModalContainer
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.15 }}
          onMouseDown={() => { mouseDownInsideRef.current = true; }}
          onClick={(e) => e.stopPropagation()}
        >
          <ModalHeader>
            <ModalTitle><UserPlus size={16} /> 담당자 추가</ModalTitle>
            <CloseBtn onClick={handleOverlayClose}><X size={16} /></CloseBtn>
          </ModalHeader>

          <ModalBody>
            <SectionLabel>인원 정보 입력</SectionLabel>
            <InputRow $cols="1fr 1fr 1fr 1fr auto">
              <Field>
                <FieldLabel>이름 *</FieldLabel>
                <SearchWrapper ref={wrapperRef}>
                  <SearchIcon><Search size={13} /></SearchIcon>
                  <SearchInput
                    ref={nameInputRef}
                    value={nameQuery}
                    $hasResults={dropdownOpen}
                    onChange={(e) => handleNameSearch(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="이름 검색"
                  />
                  {dropdownOpen && searchResults.length > 0 && (
                    <Dropdown>
                      {searchResults.map((user, idx) => {
                        const q = nameQuery.trim().toLowerCase();
                        const mi = user.name.toLowerCase().indexOf(q);
                        return (
                          <DropdownItem key={user.id}
                            data-active={idx === activeIdx ? 'true' : undefined}
                            onMouseDown={() => selectUser(user)}
                            onMouseEnter={() => setActiveIdx(idx)}>
                            <DropdownName>
                              {mi >= 0 ? (
                                <>{user.name.slice(0, mi)}<DropdownHighlight>{user.name.slice(mi, mi + q.length)}</DropdownHighlight>{user.name.slice(mi + q.length)}</>
                              ) : user.name}
                            </DropdownName>
                            <DropdownDetail>
                              {user.department && `${user.department} · `}{user.email || ''}
                            </DropdownDetail>
                          </DropdownItem>
                        );
                      })}
                    </Dropdown>
                  )}
                </SearchWrapper>
              </Field>
              <Field>
                <FieldLabel>Knox ID</FieldLabel>
                <Input value={input.knoxId}
                  onChange={(e) => handleInputField('knoxId', e.target.value)}
                  placeholder="Knox ID" />
              </Field>
              <Field>
                <FieldLabel>사업부</FieldLabel>
                <Select value={input.사업부}
                  onChange={(e) => handleInputField('사업부', e.target.value)}>
                  <option value="">선택</option>
                  {divisions.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                </Select>
              </Field>
              <Field>
                <FieldLabel>부서</FieldLabel>
                <Select value={input.부서}
                  onChange={(e) => handleInputField('부서', e.target.value)}>
                  <option value="">선택</option>
                  {filteredDepts.map(d => (
                    <option key={d.id} value={d.name}>
                      {d.name}{d.divisionId === null ? ' (공통)' : ''}
                    </option>
                  ))}
                </Select>
              </Field>
              <AddBtn type="button" disabled={!input.이름.trim()} onClick={addToPending}>
                <Plus size={12} /> 추가
              </AddBtn>
            </InputRow>

            <Divider />

            <SectionLabel>추가 대기 목록 ({pendingList.length}명)</SectionLabel>
            {pendingList.length === 0 ? (
              <EmptyHint>위에서 인원을 검색하거나 직접 입력하여 추가하세요.</EmptyHint>
            ) : (
              <AddedList>
                {pendingList.map((p, idx) => (
                  <AddedItem key={idx}>
                    <AddedInfo>
                      <AddedName>{p.이름}</AddedName>
                      {p.knoxId && <AddedMeta>({p.knoxId})</AddedMeta>}
                      {p.부서 && <AddedMeta>· {p.부서}</AddedMeta>}
                      {p.사업부 && <AddedMeta>· {p.사업부}</AddedMeta>}
                    </AddedInfo>
                    <RemoveBtn onClick={() => removeFromPending(idx)} title="삭제">
                      <X size={12} />
                    </RemoveBtn>
                  </AddedItem>
                ))}
              </AddedList>
            )}
          </ModalBody>

          <ModalFooter>
            <FooterInfo>{pendingList.length}명 선택됨</FooterInfo>
            <ConfirmBtn onClick={handleConfirm} disabled={pendingList.length === 0}>
              확인
            </ConfirmBtn>
          </ModalFooter>
        </ModalContainer>
      </Overlay>
    </AnimatePresence>
  );
};

export default PersonnelModal;
