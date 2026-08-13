import React, { useRef, useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { User, Building, ShieldCheck, Plus, BadgeCheck, Clock, AlertTriangle, Users } from 'lucide-react';
import { resolveMembersV2 } from '../../../services/settingsApi';
import AiPeopleModal from './AiPeopleModal';

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
  width: 100%;
  min-width: 0;
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

const ErrorMessage = styled.div`
  color: #ef4444;
  font-size: 0.75rem;
  margin-top: 0.25rem;
  word-break: break-word;

  @media (max-width: 768px) {
    font-size: 0.7rem;
  }
`;

const PersonnelInputContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  background: #f9fafb;

  .input-row {
    display: grid;
    grid-template-columns: 1.2fr 1fr 1fr 1.2fr;
    gap: 0.75rem;
    align-items: end;

    @media (max-width: 1200px) {
      grid-template-columns: 1fr 1fr;
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

  /* 버튼이 둘 이상이다 (인력 추가 · AI로 참여인력 찾기).
     gap 없이 두면 두 버튼이 맞붙어 하나처럼 보인다 — 원래 버튼 하나짜리 줄이었다. */
  .button-row {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.625rem;
    flex-wrap: wrap;
    padding-top: 0.5rem;
    border-top: 1px solid #e5e7eb;
    margin-top: 0.5rem;
  }

  @media (max-width: 768px) {
    padding: 0.75rem;
  }
`;

/* AI 관련 버튼은 청록으로 통일한다 — 다른 AI 진입점(폼 채우기·액션아이템)과 같은 색 */
const AiPeopleButton = styled.button`
  background: #0891b2;
  color: white;
  border: none;
  border-radius: 0.5rem;
  padding: 0.75rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &:hover {
    background: #0e7490;
    transform: translateY(-1px);
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

const ItemList = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  margin-top: 1rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
`;

const ListItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  min-width: 0;

  .item-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
    min-width: 0;

    .main-text {
      font-weight: 600;
      color: #374151;
      font-size: 0.875rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .sub-text {
      color: #6b7280;
      font-size: 0.8rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  @media (max-width: 768px) {
    padding: 0.625rem 0.75rem;

    .item-info {
      .main-text {
        font-size: 0.8rem;
      }

      .sub-text {
        font-size: 0.75rem;
      }
    }
  }
`;

const BADGE_TONE = {
  ok:   { bg: '#ecfdf5', fg: '#047857', bd: '#a7f3d0' },
  warn: { bg: '#fffbeb', fg: '#b45309', bd: '#fde68a' },
  wait: { bg: '#f3f4f6', fg: '#4b5563', bd: '#e5e7eb' },
};

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.1875rem;
  margin-left: 0.5rem;
  padding: 0.0625rem 0.375rem;
  border: 1px solid ${p => BADGE_TONE[p.$tone].bd};
  border-radius: 0.25rem;
  background: ${p => BADGE_TONE[p.$tone].bg};
  color: ${p => BADGE_TONE[p.$tone].fg};
  font-size: 0.6875rem;
  font-weight: 600;
  vertical-align: middle;
  cursor: help;
`;

/**
 * 배지 안에 붙는 knoxId.
 *
 * '연결됨' 만으로는 **어느 계정인지** 알 수 없다. 동명이인이 있는 조직이라
 * 이름만 보고는 맞게 이어졌는지 확인할 수 없고, '가입 대기' 일 때는 오타를
 * 눈으로 잡아야 하는데 그 값이 화면에 없으면 고칠 수가 없다.
 * 툴팁에만 두면 마우스를 올려야 보인다 — 확인하려고 하나씩 올려보게 된다.
 */
const BadgeId = styled.span`
  margin-left: 0.125rem;
  padding-left: 0.3125rem;
  border-left: 1px solid currentColor;
  /* 배지 색을 그대로 쓰되 한 단계 죽여서, 상태(연결됨/대기)가 먼저 읽히고
     id 는 그 다음에 읽히게 한다. */
  opacity: 0.7;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-weight: 500;
  letter-spacing: -0.01em;
`;

const MemberHint = styled.p`
  margin: 0.5rem 0 0;
  font-size: 0.75rem;
  line-height: 1.6;
  color: #9ca3af;
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

const AutocompleteWrapper = styled.div`
  position: relative;
  width: 100%;
`;

const DropdownList = styled.ul`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 1000;
  background: white;
  border: 2px solid #10b981;
  border-top: none;
  border-radius: 0 0 0.5rem 0.5rem;
  max-height: 200px;
  overflow-y: auto;
  list-style: none;
  margin: 0;
  padding: 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
`;

const DropdownItem = styled.li`
  padding: 0.625rem 1rem;
  cursor: pointer;
  font-size: 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  background: ${props => props.$active ? '#f0fdf4' : 'white'};

  &:hover {
    background: #f0fdf4;
  }

  .dropdown-name {
    font-weight: 600;
    color: #374151;
  }

  .dropdown-detail {
    font-size: 0.75rem;
    color: #6b7280;
  }
`;

// Debounce hook
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

// Autocomplete hook
function useAutocomplete(searchUsers) {
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef(null);
  const searchUsersRef = useRef(searchUsers);

  // searchUsers를 ref로 보관하여 useEffect dependency에서 제거
  useEffect(() => {
    searchUsersRef.current = searchUsers;
  }, [searchUsers]);

  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (!searchUsersRef.current || debouncedQuery.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    let cancelled = false;
    searchUsersRef.current(debouncedQuery).then(results => {
      if (!cancelled) {
        setSuggestions(results || []);
        setShowDropdown((results || []).length > 0);
        setActiveIndex(-1);
      }
    }).catch(() => {
      if (!cancelled) {
        setSuggestions([]);
        setShowDropdown(false);
      }
    });
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e, onSelect) => {
    if (!showDropdown || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      onSelect(suggestions[activeIndex]);
      setShowDropdown(false);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const close = () => {
    setShowDropdown(false);
    setQuery('');
  };

  return { suggestions, showDropdown, activeIndex, query, setQuery, handleKeyDown, wrapperRef, close };
}

/**
 * 참여인력 한 명의 계정 연결 상태.
 *
 * 세 가지를 **구분해서** 보여주는 것이 요점이다. 하나로 뭉뚱그리면
 * "131명을 다 고쳐야 하나?" 가 되는데, 실제로 손댈 것은 '미입력' 뿐이다.
 */
const MemberBadge = ({ status }) => {
  if (status.matched && status.via === 'knoxId') {
    return (
      <Badge $tone="ok" title={`${status.userName} 계정과 연결됨 — 이 과제를 직접 수정할 수 있습니다`}>
        <BadgeCheck size={12} />연결됨
        <BadgeId>{status.knoxId}</BadgeId>
      </Badge>
    );
  }
  if (status.via === 'name') {
    // ⚠️ **2026-08-11: 서버가 이름 매칭을 버렸다.** 예전에는 이름이 유일하면
    //    권한이 열렸고(`matched === true`) 이 배지는 "끊길 수 있음" 경고였다.
    //    이제는 **이미 안 열린다** — 그래서 `matched` 를 보지 않고 `via` 만 본다
    //    (서버가 어느 계정인지는 계속 알려준다. 그 값을 그대로 채우면 되기 때문이다).
    return (
      <Badge $tone="warn" title={`이름은 ${status.userName} 계정과 같지만 knoxId가 없어 이 사람은 이 과제를 수정할 수 없습니다. 이름을 자동완성에서 다시 고르면 knoxId가 채워집니다`}>
        <AlertTriangle size={12} />knoxId 필요
        {status.knoxId && <BadgeId>{status.knoxId}</BadgeId>}
      </Badge>
    );
  }
  if (!status.knoxId) {
    return (
      <Badge $tone="warn" title="knoxId가 비어 있어 이 사람은 이 과제를 직접 수정할 수 없습니다. 이름을 자동완성에서 다시 고르면 채워집니다">
        <AlertTriangle size={12} />knoxId 없음
      </Badge>
    );
  }
  // knoxId 는 있는데 그 계정이 없다 — **오타일 수도, 아직 가입 안 한 것일 수도** 있다.
  // 서버는 둘을 구분할 수 없다. 가입하면 저절로 풀리므로 '대기' 로 표현한다.
  return (
    <Badge $tone="wait" title="이 knoxId로 가입한 계정이 아직 없습니다. 본인이 가입하면 자동으로 수정 권한이 생깁니다 (표기가 틀렸다면 고쳐 주세요)">
      <Clock size={12} />가입 대기
      <BadgeId>{status.knoxId}</BadgeId>
    </Badge>
  );
};

/**
 * 과제PL·작성자 한 명의 계정 연결 상태.
 *
 * ✅ **2026-08-11 부터 참여인력용 MemberBadge 와 판정이 같아졌다.** 서버가
 * 참여인력도 knoxId 로만 인정하게 바뀌었기 때문이다(그전에는 참여인력만
 * 이름 매칭을 허용해서, 같은 상태가 참여인력에서는 '권한 있음' 이고
 * 여기서는 '권한 없음' 이었다 — 그래서 배지를 갈라 두었다).
 * 배지를 합칠 수 있게 됐지만, 문구가 서로 달라야 할 이유(작성자는 권한 문구를
 * 빼는 등)가 남아 있어 지금은 그대로 둔다.
 *
 * grantsEdit=false 면 권한 문구를 빼고 표시 연결만 말한다(작성자).
 */
const OwnerLinkBadge = ({ status, grantsEdit }) => {
  if (!status) return null;
  if (status.matched && status.via === 'knoxId') {
    return (
      <Badge $tone="ok" title={grantsEdit
        ? `${status.userName} 계정과 연결됨 — 이 과제를 직접 수정할 수 있습니다`
        : `${status.userName} 계정과 연결됨`}>
        <BadgeCheck size={12} />연결됨
        <BadgeId>{status.knoxId}</BadgeId>
      </Badge>
    );
  }
  if (!status.knoxId) {
    return (
      <Badge $tone="warn" title={grantsEdit
        ? '이름만 적혀 있어 계정과 이어지지 않았습니다. 자동완성에서 다시 고르면 연결되고, 그때부터 이 과제를 직접 수정할 수 있습니다'
        : '이름만 적혀 있어 계정과 이어지지 않았습니다. 자동완성에서 다시 고르면 연결됩니다'}>
        <AlertTriangle size={12} />연결 안 됨
      </Badge>
    );
  }
  return (
    <Badge $tone="wait" title={grantsEdit
      ? '이 knoxId로 가입한 계정이 아직 없습니다. 본인이 가입하면 자동으로 수정 권한이 생깁니다 (표기가 틀렸다면 고쳐 주세요)'
      : '이 knoxId로 가입한 계정이 아직 없습니다 (표기가 틀렸다면 고쳐 주세요)'}>
      <Clock size={12} />가입 대기
      <BadgeId>{status.knoxId}</BadgeId>
    </Badge>
  );
};

const ResponsibleInfoSection = ({
  formData,
  handleInputChange,
  errors,
  personnelInput,
  handlePersonnelInputChange,
  addPersonnelToList,
  removePersonnelFromList,
  removeDepartmentFromList,
  settingsData,
  searchUsers,
  // 아래 둘이 함께 있을 때만 'AI로 참여인력 찾기' 가 보인다 (저장된 과제 + 추가 경로)
  projectUuid,
  onAddPeople
}) => {
  const nameInputRef = useRef(null);
  const [isAiPeopleOpen, setIsAiPeopleOpen] = useState(false);

  // 과제PL 자동완성
  const plAc = useAutocomplete(searchUsers);
  // 작성자 자동완성
  const authorAc = useAutocomplete(searchUsers);
  // 참여인력 이름 자동완성
  const personnelAc = useAutocomplete(searchUsers);

  /**
   * 참여인력이 **계정과 연결되는지** 서버에 물어 표시한다.
   *
   * 컷오버 후에는 이 연결이 곧 **편집 권한**이다(`is_project_member`). 그런데 화면에
   * 아무 표시가 없어서, 담당자가 왜 자기 과제를 못 고치는지 알 수 없었다.
   *
   * ⚠️ SSO 가 없어 **본인이 직접 가입**해야 한다. 다만 knoxId 는 사내 이메일 @앞부분이라
   *    **가입 전에도 미리 채워둘 수 있고**, 그러면 가입하는 순간 권한이 생긴다.
   *    그래서 '미입력'(손댈 것)과 '가입 대기'(그냥 두면 되는 것)를 나눠 보여준다.
   */
  const [memberStatus, setMemberStatus] = useState({});   // "이름|knoxId" → 결과
  const members = formData.과제참여인력목록;

  useEffect(() => {
    const list = Array.isArray(members) ? members : [];
    if (list.length === 0) {
      setMemberStatus({});
      return;
    }
    let alive = true;
    resolveMembersV2(list.map(p => ({ knoxId: p.knoxId || '', 이름: p.이름 || '' })))
      .then(rows => {
        if (!alive) return;
        const map = {};
        rows.forEach(r => { map[`${r.name}|${r.knoxId}`] = r; });
        setMemberStatus(map);
      })
      // 조회 실패는 조용히 넘긴다 — 배지가 안 보일 뿐 편집을 막을 이유가 없다
      .catch(() => { if (alive) setMemberStatus({}); });
    return () => { alive = false; };
  }, [members]);

  const statusOf = (person) =>
    memberStatus[`${person.이름 || ''}|${person.knoxId || ''}`];

  /**
   * 과제PL·작성자의 계정 연결 상태. 참여인력과 **같은 API** 를 쓴다
   * (`/members/resolve` 는 [{knoxId, 이름}] 을 받을 뿐 참여인력 전용이 아니다).
   *
   * ⚠️ 이름만 맞은 경우는 **과제PL·작성자·참여인력 누구도 권한을 얻지 못한다**
   *    (2026-08-11 부터 참여인력도 같다). 서버는 전부 knoxId 로만 판정한다 —
   *    이름 매칭을 인정하면 표시용 이름을 고치는 것만으로 권한이 생기고,
   *    동명이인이 한 명만 생겨도 엉뚱한 사람에게 간다.
   */
  const [ownerStatus, setOwnerStatus] = useState({});
  const plName = formData.과제PL;
  const plKnox = formData.과제PL_knoxId;
  const authorName = formData.작성자;
  const authorKnox = formData.작성자_knoxId;

  useEffect(() => {
    const rows = [
      { knoxId: plKnox || '', 이름: plName || '' },
      { knoxId: authorKnox || '', 이름: authorName || '' },
    ].filter(r => r.knoxId || r.이름);
    if (rows.length === 0) {
      setOwnerStatus({});
      return;
    }
    let alive = true;
    resolveMembersV2(rows)
      .then(res => {
        if (!alive) return;
        const map = {};
        res.forEach(r => { map[`${r.name}|${r.knoxId}`] = r; });
        setOwnerStatus(map);
      })
      .catch(() => { if (alive) setOwnerStatus({}); });
    return () => { alive = false; };
  }, [plName, plKnox, authorName, authorKnox]);

  const plStatus = ownerStatus[`${plName || ''}|${plKnox || ''}`];
  const authorStatus = ownerStatus[`${authorName || ''}|${authorKnox || ''}`];

  // 과제PL 선택 시 — 이름과 **계정(knoxId)** 을 같이 잡는다.
  // 예전에는 user.name 만 저장하고 email 을 버려서, 자동완성으로 골라도
  // 계정과 이어지지 않았다(그래서 PL 이 자기 과제를 못 고쳤다).
  const applyUserToField = (nameField, knoxField, user) => {
    handleInputChange({ target: { name: nameField, value: user.name, type: 'text' } });
    handleInputChange({
      target: {
        name: knoxField,
        value: user.email ? user.email.split('@')[0] : '',
        type: 'text',
      },
    });
  };

  // 인력 입력용 사업부 목록
  const availableDivisions = settingsData?.divisions || [];

  // 선택된 사업부(인력 입력용)에 해당하는 부서 목록 필터링
  const getAvailableDepartments = () => {
    if (!settingsData || !settingsData.departments) return [];

    // 인력 입력에서 선택된 사업부 사용 (없으면 과제 사업부 사용)
    const selectedDivision = personnelInput.선택사업부 || formData.사업부;
    if (!selectedDivision) {
      // 사업부가 선택되지 않았으면 공통 부서만 표시
      return settingsData.departments.filter(dept => !dept.divisionId);
    }

    // 선택된 사업부의 ID 찾기
    const division = settingsData.divisions?.find(d => d.name === selectedDivision);
    if (!division) return settingsData.departments.filter(dept => !dept.divisionId);

    // 해당 사업부의 부서와 공통 부서 반환
    return settingsData.departments.filter(dept =>
      dept.divisionId === division.id || dept.divisionId === null
    );
  };

  const availableDepartments = getAvailableDepartments();

  // 사업부 변경 시 부서 초기화
  const handleDivisionChange = (value) => {
    handlePersonnelInputChange('선택사업부', value);
    handlePersonnelInputChange('부서', ''); // 부서 초기화
  };

  // 부서명으로 소속 사업부 찾기
  const findDivisionByDepartment = useCallback((departmentName) => {
    if (!settingsData?.departments || !settingsData?.divisions) return null;
    const dept = settingsData.departments.find(d => d.name === departmentName);
    if (!dept || !dept.divisionId) return null;
    const division = settingsData.divisions.find(d => d.id === dept.divisionId);
    return division ? division.name : null;
  }, [settingsData]);

  const handleAddPersonnel = () => {
    addPersonnelToList();
    // 인력 추가 후 이름 필드로 포커스 이동
    setTimeout(() => {
      if (nameInputRef.current) {
        nameInputRef.current.focus();
      }
    }, 100);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (personnelInput.이름 && personnelInput.부서) {
        handleAddPersonnel();
      }
    }
  };

  // 과제PL 선택 시
  const handlePLSelect = (user) => {
    applyUserToField('과제PL', '과제PL_knoxId', user);
    plAc.close();
  };

  // 작성자 선택 시
  const handleAuthorSelect = (user) => {
    applyUserToField('작성자', '작성자_knoxId', user);
    authorAc.close();
  };

  // 참여인력 이름에서 사용자 선택 시
  const handlePersonnelSelect = (user) => {
    handlePersonnelInputChange('이름', user.name);
    // knoxId: email에서 @ 앞 부분
    const knoxId = user.email ? user.email.split('@')[0] : '';
    handlePersonnelInputChange('knoxId', knoxId);
    // 부서 자동 채움
    if (user.department) {
      handlePersonnelInputChange('부서', user.department);
      // 소속 사업부 자동 설정
      const divisionName = findDivisionByDepartment(user.department);
      if (divisionName) {
        handlePersonnelInputChange('선택사업부', divisionName);
      }
    }
    personnelAc.close();
  };

  return (
    <SectionContainer>
      <SectionTitle>
        <User size={16} />
        담당 정보
      </SectionTitle>

      <FormGroup>
        <Label>
          <ShieldCheck size={16} />
          과제 PL <span className="required">*</span>
          <OwnerLinkBadge status={plStatus} grantsEdit />
        </Label>
        <AutocompleteWrapper ref={plAc.wrapperRef}>
          <Input
            type="text"
            name="과제PL"
            value={formData.과제PL || ''}
            onChange={(e) => {
              handleInputChange(e);
              // 손으로 이름을 고치면 **연결을 끊는다.** 안 끊으면 이름은 A 인데
              // knoxId 는 B 를 가리킨 채로 남아, 화면에 안 보이는 B 가 이 과제의
              // 편집 권한을 갖는다. 다시 자동완성에서 고르면 연결된다.
              if (formData.과제PL_knoxId) {
                handleInputChange({ target: { name: '과제PL_knoxId', value: '', type: 'text' } });
              }
              plAc.setQuery(e.target.value);
            }}
            onKeyDown={(e) => plAc.handleKeyDown(e, handlePLSelect)}
            placeholder="과제 PL 이름을 입력하세요"
            autoComplete="off"
            required
          />
          {plAc.showDropdown && (
            <DropdownList>
              {plAc.suggestions.map((user, idx) => (
                <DropdownItem
                  key={user.id}
                  $active={idx === plAc.activeIndex}
                  onMouseDown={() => handlePLSelect(user)}
                >
                  <span className="dropdown-name">{user.name}</span>
                  <span className="dropdown-detail">{user.department}{user.email ? ` - ${user.email}` : ''}</span>
                </DropdownItem>
              ))}
            </DropdownList>
          )}
        </AutocompleteWrapper>
        {errors.과제PL && <ErrorMessage>{errors.과제PL}</ErrorMessage>}
      </FormGroup>

      {/* 과제 참여 인력 입력 */}
      <FormGroup>
        <Label>과제 참여 인력 입력</Label>
        <PersonnelInputContainer>
          <div className="input-row">
            <div>
              <Label>
                <User size={16} />
                이름 <span className="required">*</span>
              </Label>
              <AutocompleteWrapper ref={personnelAc.wrapperRef}>
                <Input
                  ref={nameInputRef}
                  type="text"
                  value={personnelInput.이름 || ''}
                  onChange={(e) => {
                    handlePersonnelInputChange('이름', e.target.value);
                    personnelAc.setQuery(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    personnelAc.handleKeyDown(e, handlePersonnelSelect);
                    // 자동완성 드롭다운이 열려있지 않거나 선택된 항목이 없을 때만 Enter로 인력 추가
                    if (!personnelAc.showDropdown || personnelAc.activeIndex < 0) {
                      handleKeyDown(e);
                    }
                  }}
                  placeholder="참여 인력 이름"
                  autoComplete="off"
                />
                {personnelAc.showDropdown && (
                  <DropdownList>
                    {personnelAc.suggestions.map((user, idx) => (
                      <DropdownItem
                        key={user.id}
                        $active={idx === personnelAc.activeIndex}
                        onMouseDown={() => handlePersonnelSelect(user)}
                      >
                        <span className="dropdown-name">{user.name}</span>
                        <span className="dropdown-detail">{user.department}{user.email ? ` - ${user.email}` : ''}</span>
                      </DropdownItem>
                    ))}
                  </DropdownList>
                )}
              </AutocompleteWrapper>
            </div>

            <div>
              <Label>
                <BadgeCheck size={16} />
                Knox ID
              </Label>
              <Input
                type="text"
                value={personnelInput.knoxId || ''}
                onChange={(e) => handlePersonnelInputChange('knoxId', e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Knox ID 입력"
              />
            </div>

            <div>
              <Label>
                <Building size={16} />
                소속 사업부
              </Label>
              <Select
                value={personnelInput.선택사업부 || formData.사업부 || ''}
                onChange={(e) => handleDivisionChange(e.target.value)}
              >
                <option value="">사업부 선택</option>
                {availableDivisions.map(div => (
                  <option key={div.id} value={div.name}>
                    {div.name}
                    {div.name === formData.사업부 && ' (과제 사업부)'}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label>
                <Building size={16} />
                부서 <span className="required">*</span>
              </Label>
              <Select
                value={personnelInput.부서 || ''}
                onChange={(e) => handlePersonnelInputChange('부서', e.target.value)}
                disabled={!personnelInput.선택사업부 && !formData.사업부}
              >
                <option value="">부서 선택</option>
                {availableDepartments.map(dept => (
                  <option key={dept.id} value={dept.name}>
                    {dept.name}
                    {dept.divisionId === null && ' (공통)'}
                  </option>
                ))}
              </Select>
              {!personnelInput.선택사업부 && !formData.사업부 && (
                <div style={{
                  fontSize: '0.75rem',
                  color: '#6b7280',
                  marginTop: '0.25rem'
                }}>
                  먼저 사업부를 선택하세요
                </div>
              )}
            </div>
          </div>

          <div className="button-row">
            <AddButton
              type="button"
              onClick={handleAddPersonnel}
              disabled={!personnelInput.이름 || !personnelInput.부서}
            >
              <Plus size={16} />
              인력 추가
            </AddButton>
            {/*
              여러 명을 한 번에. **저장된 과제에서만** 쓴다(권한을 그 과제로 판정한다).
              ⚠️ 이름만 찾아 오고 **누구인지는 사람이 고른다** — 여기 들어간 사람은
                 이 과제를 고칠 수 있게 되기 때문이다(AiPeopleModal 머리말).
            */}
            {projectUuid && onAddPeople && (
              <AiPeopleButton type="button" onClick={() => setIsAiPeopleOpen(true)}
                title="회의록·메일을 붙여넣으면 AI 가 이름을 찾아 줍니다. 계정은 직접 고릅니다">
                <Users size={16} />
                AI로 참여인력 찾기
              </AiPeopleButton>
            )}
          </div>
        </PersonnelInputContainer>
      </FormGroup>

      <AiPeopleModal
        isOpen={isAiPeopleOpen}
        onClose={() => setIsAiPeopleOpen(false)}
        projectUuid={projectUuid}
        existingNames={(formData.과제참여인력목록 || []).map(p => p.이름).filter(Boolean)}
        onAdd={onAddPeople}
      />

      {/* 등록된 과제 참여 인력 목록 */}
      {formData.과제참여인력목록 && formData.과제참여인력목록.length > 0 && (
        <FormGroup>
          <Label>등록된 과제 참여 인력 ({formData.과제참여인력목록.length}명)</Label>
          <ItemList>
            {formData.과제참여인력목록.map((person, index) => {
              const st = statusOf(person);
              return (
              <ListItem key={index}>
                <div className="item-info">
                  <div className="main-text">
                    {person.이름}
                    {person.knoxId && <span style={{ color: '#6b7280', fontWeight: 400, marginLeft: '0.5rem' }}>({person.knoxId})</span>}
                    {st && <MemberBadge status={st} />}
                  </div>
                  <div className="sub-text">
                    {person.부서}
                  </div>
                </div>
                <RemoveButton
                  type="button"
                  onClick={() => removePersonnelFromList(index)}
                  title="인력 삭제"
                >
                  ×
                </RemoveButton>
              </ListItem>
              );
            })}
          </ItemList>
          <MemberHint>
            참여인력은 <strong>본인이 직접 이 과제를 수정할 수 있는 사람</strong>입니다.
            이름을 <strong>자동완성에서 고르면</strong> knoxId가 자동으로 채워집니다.
          </MemberHint>
        </FormGroup>
      )}

      {/* 담당부서 목록 (자동으로 생성됨) */}
      {formData.담당부서목록 && formData.담당부서목록.length > 0 && (
        <FormGroup>
          <Label>
            <Building size={16} />
            담당부서 ({formData.담당부서목록.length}개)
          </Label>
          <ItemList>
            {formData.담당부서목록.map((dept, index) => (
              <ListItem key={index}>
                <div className="item-info">
                  <div className="main-text">{dept}</div>
                  <div className="sub-text">
                    {formData.과제참여인력목록 ? formData.과제참여인력목록.filter(person => person.부서 === dept).length : 0}명 참여
                  </div>
                </div>
                <RemoveButton
                  type="button"
                  onClick={() => removeDepartmentFromList(index)}
                  title="부서 삭제 (해당 부서 소속 인력도 함께 삭제됩니다)"
                >
                  ×
                </RemoveButton>
              </ListItem>
            ))}
          </ItemList>
        </FormGroup>
      )}

      <FormGroup>
        <Label>
          <User size={16} />
          작성자
          <OwnerLinkBadge status={authorStatus} />
        </Label>
        <AutocompleteWrapper ref={authorAc.wrapperRef}>
          <Input
            type="text"
            name="작성자"
            value={formData.작성자 || ''}
            onChange={(e) => {
              handleInputChange(e);
              // 과제PL 과 같은 이유로 손입력이면 연결을 끊는다.
              // 작성자는 권한을 주지 않지만, 이름과 계정이 어긋난 채 남으면
              // 화면이 거짓말을 한다(A 라고 적혀 있는데 배지는 B 를 가리킴).
              if (formData.작성자_knoxId) {
                handleInputChange({ target: { name: '작성자_knoxId', value: '', type: 'text' } });
              }
              authorAc.setQuery(e.target.value);
            }}
            onKeyDown={(e) => authorAc.handleKeyDown(e, handleAuthorSelect)}
            placeholder="작성자 이름을 입력하세요"
            autoComplete="off"
          />
          {authorAc.showDropdown && (
            <DropdownList>
              {authorAc.suggestions.map((user, idx) => (
                <DropdownItem
                  key={user.id}
                  $active={idx === authorAc.activeIndex}
                  onMouseDown={() => handleAuthorSelect(user)}
                >
                  <span className="dropdown-name">{user.name}</span>
                  <span className="dropdown-detail">{user.department}{user.email ? ` - ${user.email}` : ''}</span>
                </DropdownItem>
              ))}
            </DropdownList>
          )}
        </AutocompleteWrapper>
      </FormGroup>

      {errors.과제참여인력목록 && <ErrorMessage>{errors.과제참여인력목록}</ErrorMessage>}
      {errors.담당부서목록 && <ErrorMessage>{errors.담당부서목록}</ErrorMessage>}
    </SectionContainer>
  );
};

export default ResponsibleInfoSection;
