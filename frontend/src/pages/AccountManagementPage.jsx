import React, { useState, useEffect, useMemo, useCallback } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CommonHeader } from '../shared/components/Header';
import { User, Shield, Users, Search, ChevronLeft, ChevronRight, Key, Eye, EyeOff, Check, X, Building, Edit3, UserCog, Trash2, AlertTriangle, Download, Filter, Clock, RefreshCw, Monitor, Lock, Plug } from 'lucide-react';
import { MODULE_NAMES, invalidateRolePermissionsCache } from '../components/ProtectedRoute';
// MCP 연결(개인 액세스 토큰). "내 계정 정보" 옆 우측 카드다 — 역할 제한이 없어 누구나 자기 토큰을
// 만들 수 있다. PAT 은 개인 것이고, MCP 로 자기 과제를 고치는 건 담당자가 할 일이라
// 관리자 전용 자리에 두면 안 된다. 카드 제목은 여기서 그리고, 본문만 컴포넌트가 그린다.
import McpTokenSection from '../modules/auth/components/McpTokenSection';
import { todayLocalYmd } from '../shared/utils/localDate';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const Container = styled.div`
  background: #ECEFF1;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
`;

const ScrollArea = styled.div`
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  padding: 2rem;
`;

// 탭 막대. 헤더 바로 아래에 붙어 스크롤과 함께 올라가지 않는다(ScrollArea 밖).
const TabBar = styled.div`
  display: flex;
  gap: 0.25rem;
  padding: 0 2rem;
  background: white;
  border-bottom: 1px solid #e2e8f0;
  overflow-x: auto;
  flex-shrink: 0;
`;

const TabButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1.25rem;
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  font-size: 0.9375rem;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.15s, border-color 0.15s, background 0.15s;

  &:hover {
    color: #0066cc;
    background: #f8fafc;
  }

  &.active {
    color: #0066cc;
    border-bottom-color: #0066cc;
    font-weight: 600;
  }
`;

const Content = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 2rem;

  @media (max-width: 1024px) {
    flex-direction: column;
  }
`;

const AccessLogSection = styled.div`
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  overflow: hidden;
`;

const AccessLogHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  flex-wrap: wrap;
  gap: 0.75rem;
`;

const AccessLogTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  color: #1e293b;
`;

const AccessLogControls = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const AccessLogFilterSelect = styled.select`
  padding: 0.4rem 0.6rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.8rem;
  color: #374151;
  background: white;
  outline: none;
  &:focus { border-color: #6366f1; }
`;

const AccessLogIconBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.7rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background: white;
  color: #374151;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { background: #f3f4f6; border-color: #9ca3af; }
`;

const AccessLogTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
`;

const AccessLogTh = styled.th`
  text-align: left;
  padding: 0.6rem 1rem;
  background: #f8fafc;
  color: #64748b;
  font-weight: 600;
  font-size: 0.75rem;
  border-bottom: 1px solid #e2e8f0;
  white-space: nowrap;
`;

const AccessLogTd = styled.td`
  padding: 0.5rem 1rem;
  border-bottom: 1px solid #f1f5f9;
  color: #374151;
  vertical-align: middle;
`;

const AccessLogActionBadge = styled.span`
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.7rem;
  font-weight: 600;
  ${p => p.$action === 'LOGIN' ? `
    background: #dcfce7; color: #166534;
  ` : p.$action === 'LOGOUT' ? `
    background: #fee2e2; color: #991b1b;
  ` : `
    background: #dbeafe; color: #1e40af;
  `}
`;

const AccessLogPagination = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid #e5e7eb;
  font-size: 0.8rem;
  color: #64748b;
`;

const AccessLogPageBtn = styled.button`
  padding: 0.3rem 0.6rem;
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
  background: ${p => p.$active ? '#4f46e5' : 'white'};
  color: ${p => p.$active ? 'white' : '#374151'};
  cursor: pointer;
  font-size: 0.75rem;
  &:hover:not(:disabled) { background: ${p => p.$active ? '#4338ca' : '#f3f4f6'}; }
  &:disabled { opacity: 0.4; cursor: default; }
`;

// 내 계정 정보 · MCP 연결 을 **반반**으로 나눈다 (둘 다 flex-basis 0 + grow 1).
// min-width: 0 이 없으면 안쪽 표·긴 명령줄이 패널을 밀어내 반반이 깨진다.
const LeftPanel = styled.div`
  flex: 1 1 0;
  min-width: 0;
`;

const RightPanel = styled.div`
  flex: 1 1 0;
  min-width: 0;
`;

/**
 * 사용자 권한 관리 자리.
 *
 * `flex: 1 0 100%` 가 **줄을 강제로 넘긴다**(`Content` 가 `flex-wrap: wrap`).
 * 그래서 위 두 패널(내 계정 정보 · MCP 연결)과 같은 줄에 끼지 않고 **아래에 전체 폭**으로 놓인다.
 * 표가 넓어서(이름·이메일·부서·역할·작업) 좌우 분할에 넣으면 열이 짓눌린다.
 */
const WidePanel = styled.div`
  flex: 1 0 100%;
  min-width: 0;

  /* 세로로 쌓이는 폭에서는 줄바꿈용 100% 가 필요 없다 (LeftPanel 과 같은 처리) */
  @media (max-width: 1024px) {
    flex: 1;
  }
`;

const Card = styled.div`
  background: white;
  border-radius: 1rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  padding: 2rem;
  height: fit-content;

  /*
   * .split — 카드 본문을 좌우 두 칸으로 나눈다 (내 계정 정보 | 비밀번호 변경).
   *
   * 감싸는 <div> 를 새로 두지 않고 **카드 자체를 grid** 로 만든다. 그래야 안쪽 JSX 를
   * 한 줄도 안 건드린다. 첫 자식(CardHeader)만 두 칸을 가로지른다.
   *
   * 1440px 이하에서는 한 칸으로 되돌린다 — 화면을 반으로 나눈 패널 안에서 또 반을 나누면
   * 비밀번호 입력칸이 너무 좁아진다. (1024px 이하에선 바깥이 세로로 쌓여 카드가 다시
   * 넓어지지만, 거기서 두 칸으로 되돌리지는 않는다. 지금까지 보던 모양 그대로다.)
   */
  &.split {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 2rem;
    align-items: start;

    > *:first-child {
      grid-column: 1 / -1;
    }

    @media (max-width: 1440px) {
      grid-template-columns: 1fr;
    }
  }
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #e5e7eb;
`;

const IconWrapper = styled.div`
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: ${props => props.color || 'linear-gradient(135deg, #0066cc 0%, #0052a3 100%)'};
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
`;

const HeaderText = styled.div`
  h1 {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1e293b;
    margin: 0 0 0.25rem 0;
  }
  p {
    font-size: 0.875rem;
    color: #64748b;
    margin: 0;
  }
`;

const InfoSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const InfoRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Label = styled.div`
  font-size: 0.875rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const Value = styled.div`
  font-size: 1.125rem;
  font-weight: 500;
  color: #1e293b;
  padding: 0.75rem 1rem;
  background: #f8fafc;
  border-radius: 0.5rem;
  border: 1px solid #e2e8f0;
`;

const RoleBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 600;
  background: ${props => {
    switch (props.role) {
      case 'admin': return 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)';
      case 'manager': return 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)';
      case 'dt_office': return 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
      case 'user': return 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)';
      case 'viewer': return 'linear-gradient(135deg, #64748b 0%, #475569 100%)';
      default: return '#64748b';
    }
  }};
  color: white;
`;

const SearchContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;

  &:focus-within {
    border-color: #0066cc;
    box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.1);
  }
`;

const SearchInput = styled.input`
  flex: 1;
  border: none;
  background: transparent;
  font-size: 0.875rem;
  outline: none;

  &::placeholder {
    color: #94a3b8;
  }
`;

const UserTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
`;

const TableHead = styled.thead`
  background: #f8fafc;

  th {
    padding: 1rem;
    text-align: left;
    font-weight: 600;
    color: #64748b;
    font-size: 0.875rem;
    border-bottom: 2px solid #e2e8f0;
  }
`;

const TableBody = styled.tbody`
  tr {
    border-bottom: 1px solid #e2e8f0;

    &:hover {
      background: #f8fafc;
    }
  }

  td {
    padding: 1rem;
    font-size: 0.875rem;
    color: #1e293b;
  }
`;

const RoleSelect = styled.select`
  padding: 0.5rem 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  background: white;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: #0066cc;
    box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.1);
  }

  &:disabled {
    background: #f1f5f9;
    cursor: not-allowed;
  }
`;

const LoadingText = styled.div`
  text-align: center;
  padding: 2rem;
  color: #64748b;
`;

const ErrorText = styled.div`
  text-align: center;
  padding: 1rem;
  color: #dc2626;
  background: #fef2f2;
  border-radius: 0.5rem;
  margin-bottom: 1rem;
`;

const Pagination = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid #e2e8f0;
`;

const PageButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid ${props => props.active ? '#0066cc' : '#e2e8f0'};
  background: ${props => props.active ? '#0066cc' : 'white'};
  color: ${props => props.active ? 'white' : '#64748b'};
  border-radius: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    border-color: #0066cc;
    color: ${props => props.active ? 'white' : '#0066cc'};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const PageInfo = styled.span`
  font-size: 0.875rem;
  color: #64748b;
  margin: 0 0.5rem;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem;
  color: #64748b;
`;

// 계정 정보 **오른쪽 칸**에 선다 — 구분선은 위가 아니라 왼쪽이다.
// 한 칸으로 되돌아가는 폭에서는(Card.split 의 1440px) 예전처럼 위에 선을 긋는다.
const PasswordSection = styled.div`
  padding-left: 2rem;
  border-left: 2px solid #e5e7eb;

  @media (max-width: 1440px) {
    margin-top: 2rem;
    padding: 2rem 0 0;
    border-left: none;
    border-top: 2px solid #e5e7eb;
  }
`;

const PasswordHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;

  h3 {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0;
  }
`;

const PasswordForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const PasswordInputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const PasswordInputWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const PasswordInput = styled.input`
  width: 100%;
  padding: 0.75rem 2.5rem 0.75rem 1rem;
  border: 1px solid ${props => props.error ? '#dc2626' : '#e2e8f0'};
  border-radius: 0.5rem;
  font-size: 1rem;
  background: #f8fafc;
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: ${props => props.error ? '#dc2626' : '#0066cc'};
    box-shadow: 0 0 0 3px ${props => props.error ? 'rgba(220, 38, 38, 0.1)' : 'rgba(0, 102, 204, 0.1)'};
    background: white;
  }

  &::placeholder {
    color: #94a3b8;
  }
`;

const PasswordToggle = styled.button`
  position: absolute;
  right: 0.75rem;
  background: none;
  border: none;
  cursor: pointer;
  color: #64748b;
  padding: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: #0066cc;
  }
`;

const PasswordButtonGroup = styled.div`
  display: flex;
  gap: 0.75rem;
  margin-top: 0.5rem;
`;

const PasswordButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &.primary {
    background: linear-gradient(135deg, #0066cc 0%, #0052a3 100%);
    border: none;
    color: white;

    &:hover:not(:disabled) {
      background: linear-gradient(135deg, #0052a3 0%, #004080 100%);
      box-shadow: 0 4px 12px rgba(0, 102, 204, 0.3);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }

  &.secondary {
    background: white;
    border: 1px solid #e2e8f0;
    color: #64748b;

    &:hover {
      background: #f8fafc;
      border-color: #cbd5e1;
    }
  }
`;

const PasswordMessage = styled.div`
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &.success {
    background: #f0fdf4;
    color: #16a34a;
    border: 1px solid #bbf7d0;
  }

  &.error {
    background: #fef2f2;
    color: #dc2626;
    border: 1px solid #fecaca;
  }
`;

const PasswordHint = styled.p`
  font-size: 0.75rem;
  color: #64748b;
  margin: 0.25rem 0 0 0;
`;

const EditableValue = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const EditInput = styled.input`
  flex: 1;
  font-size: 1.125rem;
  font-weight: 500;
  color: #1e293b;
  padding: 0.75rem 1rem;
  background: white;
  border-radius: 0.5rem;
  border: 2px solid #0066cc;
  outline: none;

  &:focus {
    box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.1);
  }
`;

const EditButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 0.5rem;
  border: none;
  cursor: pointer;
  transition: all 0.2s;

  svg {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }

  &.edit {
    background: #f1f5f9;
    color: #64748b;

    &:hover {
      background: #e2e8f0;
      color: #0066cc;
    }

    svg {
      color: inherit;
    }
  }

  &.save {
    background: #16a34a;
    color: white;

    &:hover {
      background: #15803d;
    }

    svg {
      color: white;
    }
  }

  &.cancel {
    background: #f1f5f9;
    color: #64748b;

    &:hover {
      background: #fecaca;
      color: #dc2626;
    }

    svg {
      color: inherit;
    }
  }
`;

// 사용자 편집 모달 스타일
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

const ModalContainer = styled.div`
  background: white;
  border-radius: 1rem;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid #e2e8f0;
  background: linear-gradient(135deg, #0066cc 0%, #0052a3 100%);
  border-radius: 1rem 1rem 0 0;
  color: white;

  h2 {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
  }
`;

const CloseButton = styled.button`
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 0.5rem;
  color: white;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.3);
  }
`;

const ModalBody = styled.div`
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const FormLabel = styled.label`
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
`;

const FormInput = styled.input`
  padding: 0.75rem 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 1rem;
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: #0066cc;
    box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.1);
  }

  &:disabled {
    background: #f1f5f9;
    color: #64748b;
  }
`;

const FormSelect = styled.select`
  padding: 0.75rem 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 1rem;
  background: white;
  cursor: pointer;
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: #0066cc;
    box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.1);
  }
`;

const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1.5rem;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
  border-radius: 0 0 1rem 1rem;
`;

const ModalButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &.primary {
    background: linear-gradient(135deg, #0066cc 0%, #0052a3 100%);
    border: none;
    color: white;

    &:hover:not(:disabled) {
      background: linear-gradient(135deg, #0052a3 0%, #004080 100%);
      box-shadow: 0 4px 12px rgba(0, 102, 204, 0.3);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }

  &.secondary {
    background: white;
    border: 1px solid #e2e8f0;
    color: #64748b;

    &:hover {
      background: #f8fafc;
      border-color: #cbd5e1;
    }
  }
`;

const EditIcon = styled.button`
  background: #f1f5f9;
  border: none;
  border-radius: 0.375rem;
  padding: 0.5rem;
  cursor: pointer;
  color: #64748b;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: #e2e8f0;
    color: #0066cc;
  }
`;

const DeleteIcon = styled.button`
  background: #fef2f2;
  border: none;
  border-radius: 0.375rem;
  padding: 0.5rem;
  cursor: pointer;
  color: #ef4444;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: #fee2e2;
    color: #dc2626;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const DeleteModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid #e2e8f0;
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
  border-radius: 1rem 1rem 0 0;
  color: white;

  h2 {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
  }
`;

const DeleteWarning = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.5rem;
  margin-bottom: 1rem;

  svg {
    flex-shrink: 0;
    color: #dc2626;
  }

  p {
    margin: 0;
    font-size: 0.875rem;
    color: #991b1b;
    line-height: 1.5;
  }
`;

const DeleteUserInfo = styled.div`
  padding: 1rem;
  background: #f8fafc;
  border-radius: 0.5rem;
  border: 1px solid #e2e8f0;

  p {
    margin: 0 0 0.5rem 0;
    font-size: 0.875rem;
    color: #64748b;

    &:last-child {
      margin-bottom: 0;
    }

    strong {
      color: #1e293b;
    }
  }
`;

const DeleteButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
  border: none;
  color: white;

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, #b91c1c 0%, #991b1b 100%);
    box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

// Export 버튼 그룹
const ExportButtonGroup = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-left: auto;
`;

const ExportButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.813rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
  border: none;
  color: white;

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, #15803d 0%, #166534 100%);
    box-shadow: 0 4px 12px rgba(22, 163, 74, 0.3);
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
`;

const EmailExportModalOverlay = styled.div`
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

const EmailExportModal = styled.div`
  background: white;
  border-radius: 0.75rem;
  width: 420px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
`;

const EmailExportModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #e2e8f0;
`;

const EmailExportModalTitle = styled.h3`
  font-size: 0.9375rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const EmailExportModalClose = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: none;
  cursor: pointer;
  color: #64748b;
  border-radius: 0.375rem;
  &:hover { background: #f1f5f9; color: #1e293b; }
`;

const EmailExportModalBody = styled.div`
  padding: 0.75rem 1.25rem;
  overflow-y: auto;
  flex: 1;
`;

const EmailExportSelectAll = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0;
  margin-bottom: 0.5rem;
  border-bottom: 1px solid #e2e8f0;
`;

const EmailExportSelectAllLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #1e293b;
  cursor: pointer;
`;

const EmailExportSelectedCount = styled.span`
  font-size: 0.75rem;
  color: #64748b;
  font-weight: 500;
`;

const EmailExportSearchWrapper = styled.div`
  padding: 0 0.25rem 0.5rem;
  position: relative;
`;

const EmailExportSearchInput = styled.input`
  width: 100%;
  padding: 0.5rem 0.625rem 0.5rem 2rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  color: #334155;
  outline: none;
  box-sizing: border-box;

  &::placeholder { color: #94a3b8; }
  &:focus { border-color: #8b5cf6; box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.1); }
`;

const EmailExportSearchIcon = styled.div`
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(calc(-50% - 0.25rem));
  color: #94a3b8;
  pointer-events: none;
  display: flex;
  align-items: center;
`;

const EmailExportDeptList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const EmailExportDeptItem = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.625rem;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: background 0.1s ease;
  background: ${props => props.$checked ? '#f5f3ff' : 'transparent'};

  &:hover {
    background: ${props => props.$checked ? '#f5f3ff' : '#f8fafc'};
  }
`;

const EmailExportCheckbox = styled.input.attrs({ type: 'checkbox' })`
  width: 16px;
  height: 16px;
  accent-color: #8b5cf6;
  cursor: pointer;
  flex-shrink: 0;
`;

const EmailExportDeptName = styled.span`
  flex: 1;
  font-size: 0.8125rem;
  color: #334155;
  font-weight: ${props => props.$checked ? '600' : '400'};
`;

const EmailExportDeptCount = styled.span`
  font-size: 0.6875rem;
  color: #94a3b8;
  font-weight: 500;
`;

const EmailExportModalFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.25rem;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
`;

const EmailExportTotalInfo = styled.span`
  font-size: 0.8125rem;
  color: #475569;
  font-weight: 600;
`;

const EmailExportModalButtons = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const EmailExportCancelBtn = styled.button`
  padding: 0.5rem 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  background: white;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  &:hover { background: #f8fafc; }
`;

const EmailExportConfirmBtn = styled.button`
  padding: 0.5rem 1.25rem;
  border: none;
  border-radius: 0.5rem;
  background: linear-gradient(135deg, #0066cc 0%, #0052a3 100%);
  font-size: 0.8125rem;
  font-weight: 600;
  color: white;
  cursor: pointer;
  &:hover:not(:disabled) { box-shadow: 0 4px 12px rgba(0, 102, 204, 0.3); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const ROLE_LABELS = {
  admin: 'Admin (관리자)',
  manager: 'Manager (매니저)',
  dt_office: 'DT Office (디지털 트윈 사무국)',
  user: 'User (사용자)',
  viewer: 'Viewer (뷰어)'
};

const ITEMS_PER_PAGE = 10;

/**
 * 계정 관리 탭.
 *
 * 전에는 넷이 한 페이지에 세로로 쌓여 있어서 관리자 화면이 아주 길었다 —
 * 접속 이력을 보려면 사용자 표와 부서 표를 지나 한참 내려가야 했다.
 *
 * `adminOnly` 탭은 관리자가 아니면 **막대에 나오지도 않는다.** 안 보이는 탭을 고를 수는
 * 없지만, 그래도 렌더링 조건은 각 자리에 그대로 남겨 둔다(탭은 보이기 규칙이지 권한이 아니다).
 */
const TABS = [
  { key: 'me', label: '내 정보', icon: User, adminOnly: false },
  { key: 'users', label: '사용자 권한 관리', icon: Users, adminOnly: true },
  { key: 'depts', label: '부서 정보 관리', icon: Building, adminOnly: true },
  { key: 'logs', label: '접속 이력', icon: Clock, adminOnly: true },
];

const AccountManagementPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('me');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // 비밀번호 변경 관련 상태
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });

  // 부서명 수정 관련 상태
  const [isEditingDepartment, setIsEditingDepartment] = useState(false);
  const [departmentValue, setDepartmentValue] = useState(user?.department || '');
  const [departmentLoading, setDepartmentLoading] = useState(false);

  // 접속 이력 관련 상태
  const [accessLogs, setAccessLogs] = useState([]);
  const [accessLogPage, setAccessLogPage] = useState(1);
  const [accessLogTotal, setAccessLogTotal] = useState(0);
  const [accessLogTotalPages, setAccessLogTotalPages] = useState(0);
  const [accessLogLoading, setAccessLogLoading] = useState(false);
  const [accessLogUserFilter, setAccessLogUserFilter] = useState('');
  const [accessLogActionFilter, setAccessLogActionFilter] = useState('');

  // 이메일 Export 부서 필터 모달
  const [emailExportModalOpen, setEmailExportModalOpen] = useState(false);
  const [emailExportSelectedDepts, setEmailExportSelectedDepts] = useState([]);
  const [emailExportSearch, setEmailExportSearch] = useState('');

  // 사용자 편집 모달 관련 상태
  const [isUserEditModalOpen, setIsUserEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editUserForm, setEditUserForm] = useState({
    name: '',
    email: '',
    department: '',
    role: 'user'
  });
  const [userEditLoading, setUserEditLoading] = useState(false);

  // 비밀번호 재설정 관련 상태
  const [isPasswordResetModalOpen, setIsPasswordResetModalOpen] = useState(false);
  const [passwordResetUser, setPasswordResetUser] = useState(null);
  const [newPasswordForReset, setNewPasswordForReset] = useState('');
  const [confirmPasswordForReset, setConfirmPasswordForReset] = useState('');
  const [showNewPasswordForReset, setShowNewPasswordForReset] = useState(false);
  const [showConfirmPasswordForReset, setShowConfirmPasswordForReset] = useState(false);
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);
  const [passwordResetMessage, setPasswordResetMessage] = useState({ type: '', text: '' });

  // 사용자 삭제 모달 관련 상태
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // 역할별 모듈 권한 상태
  const [rolePermissions, setRolePermissions] = useState({});
  const [rolePermLoading, setRolePermLoading] = useState(false);
  const [rolePermSaving, setRolePermSaving] = useState(false);
  const [rolePermMessage, setRolePermMessage] = useState('');

  // 부서 정보 관리 상태 (Division <-> Department 매핑)
  const [divisions, setDivisions] = useState([]);
  const [departments, setDepartments] = useState([]); // DB에 저장된 부서 (id 보유)
  const [deptDraft, setDeptDraft] = useState({}); // key: 부서명, value: { divisionId, isNew }
  const [deptInfoLoading, setDeptInfoLoading] = useState(false);
  const [deptInfoSaving, setDeptInfoSaving] = useState(false);
  const [deptInfoMessage, setDeptInfoMessage] = useState('');
  const [newDivisionName, setNewDivisionName] = useState('');
  const [showNewDivisionInput, setShowNewDivisionInput] = useState(false);


  const isAdmin = user?.role === 'admin' || user?.is_admin;

  // 관리자 탭은 관리자에게만 보인다.
  // `currentTab` 을 따로 두는 이유 — 사용자 정보는 **나중에 도착한다.** 관리자였다가
  // 로그아웃하거나 권한이 내려가면 `activeTab` 은 'logs' 로 남는데, 그때 빈 화면을
  // 보여주지 않고 '내 정보' 로 되돌린다. state 를 되돌리는 useEffect 는 두지 않는다
  // (렌더 중 값으로 정하면 한 번에 끝난다).
  const visibleTabs = TABS.filter((t) => !t.adminOnly || isAdmin);
  const currentTab = visibleTabs.some((t) => t.key === activeTab) ? activeTab : 'me';

  // 이메일 Export 부서 목록 (users에서 동적 추출)
  const departmentList = useMemo(() => {
    const deptMap = new Map();
    users.forEach(u => {
      const dept = u.department || '미설정';
      const emailCount = u.email ? 1 : 0;
      if (deptMap.has(dept)) {
        deptMap.set(dept, deptMap.get(dept) + emailCount);
      } else {
        deptMap.set(dept, emailCount);
      }
    });
    return [...deptMap.entries()]
      .sort((a, b) => {
        if (a[0] === '미설정') return 1;
        if (b[0] === '미설정') return -1;
        return a[0].localeCompare(b[0]);
      })
      .map(([name, count]) => ({ name, count }));
  }, [users]);

  // 검색 필터된 부서 목록
  const filteredDepartmentList = useMemo(() => {
    if (!emailExportSearch.trim()) return departmentList;
    const keyword = emailExportSearch.trim().toLowerCase();
    return departmentList.filter(d => d.name.toLowerCase().includes(keyword));
  }, [departmentList, emailExportSearch]);

  // 부서 정보 관리: DB에 저장된 부서 + users에서 추출한 부서명 병합
  const mergedDeptList = useMemo(() => {
    const userDeptCount = new Map();
    users.forEach(u => {
      const name = (u.department || '').trim();
      if (!name) return;
      userDeptCount.set(name, (userDeptCount.get(name) || 0) + 1);
    });

    const result = [];
    const seen = new Set();

    // 1) DB에 저장된 부서 우선
    departments.forEach(d => {
      const name = (d.name || '').trim();
      if (!name || seen.has(name)) return;
      seen.add(name);
      result.push({
        name,
        dbId: d.id, // 문자열
        savedDivisionId: d.divisionId || '',
        userCount: userDeptCount.get(name) || 0,
        isNew: false,
      });
    });

    // 2) users에서만 발견된 부서
    [...userDeptCount.keys()].forEach(name => {
      if (seen.has(name)) return;
      seen.add(name);
      result.push({
        name,
        dbId: null,
        savedDivisionId: '',
        userCount: userDeptCount.get(name) || 0,
        isNew: true,
      });
    });

    return result.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [departments, users]);

  const getEffectiveDivisionId = useCallback((dept) => {
    return deptDraft[dept.name] !== undefined
      ? deptDraft[dept.name]
      : dept.savedDivisionId || '';
  }, [deptDraft]);

  const setDeptDivision = useCallback((deptName, divisionId) => {
    setDeptDraft(prev => ({ ...prev, [deptName]: divisionId }));
  }, []);

  const isDeptDirty = useCallback((dept) => {
    if (dept.isNew && deptDraft[dept.name] !== undefined) return true;
    if (deptDraft[dept.name] === undefined) return false;
    return deptDraft[dept.name] !== (dept.savedDivisionId || '');
  }, [deptDraft]);

  const dirtyCount = useMemo(
    () => mergedDeptList.filter(isDeptDirty).length,
    [mergedDeptList, isDeptDirty]
  );

  const handleSaveDeptInfo = async () => {
    setDeptInfoSaving(true);
    setDeptInfoMessage('');
    try {
      const token = localStorage.getItem('accessToken');
      // 변경된 항목만 반영하여 전체 부서 목록 재구성
      const payload = mergedDeptList.map(d => {
        const divisionId = getEffectiveDivisionId(d) || null;
        const item = {
          name: d.name,
          divisionId: divisionId || null,
          description: '',
        };
        if (d.dbId) item.id = d.dbId;
        return item;
      }).filter(item => item.id || item.divisionId); // 신규 부서는 사업부가 지정된 경우만 등록

      const res = await fetch(`${API_BASE_URL}/digital-twin-dashboard/settings`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ departments: payload })
      });
      const json = await res.json();
      if (res.ok && json.success !== false) {
        setDeptInfoMessage('저장되었습니다.');
        setDeptDraft({});
        await fetchDeptInfo();
        setTimeout(() => setDeptInfoMessage(''), 2000);
      } else {
        setDeptInfoMessage(json.message || '저장 실패');
      }
    } catch (err) {
      console.error('Save dept info error:', err);
      setDeptInfoMessage('저장 실패');
    } finally {
      setDeptInfoSaving(false);
    }
  };

  const handleAddDivision = async () => {
    const name = newDivisionName.trim();
    if (!name) return;
    setDeptInfoSaving(true);
    try {
      const token = localStorage.getItem('accessToken');
      // 기존 사업부 목록 + 새 사업부 추가
      const payload = [
        ...divisions.map(d => ({
          id: d.id,
          name: d.name,
          color: d.color,
          description: d.description,
        })),
        { name, color: '#64748B', description: '' }
      ];
      const res = await fetch(`${API_BASE_URL}/digital-twin-dashboard/settings`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ divisions: payload })
      });
      if (res.ok) {
        await fetchDeptInfo();
        setNewDivisionName('');
        setShowNewDivisionInput(false);
      }
    } catch (err) {
      console.error('Add division error:', err);
    } finally {
      setDeptInfoSaving(false);
    }
  };

  // 이메일 Export 모달 열기
  const openEmailExportModal = useCallback(() => {
    setEmailExportSelectedDepts(departmentList.map(d => d.name));
    setEmailExportSearch('');
    setEmailExportModalOpen(true);
  }, [departmentList]);

  // 이메일 Export 부서 토글
  const toggleEmailExportDept = useCallback((deptName) => {
    setEmailExportSelectedDepts(prev =>
      prev.includes(deptName) ? prev.filter(d => d !== deptName) : [...prev, deptName]
    );
  }, []);

  // 이메일 Export 전체 선택/해제
  const toggleEmailExportAll = useCallback(() => {
    setEmailExportSelectedDepts(prev =>
      prev.length === departmentList.length ? [] : departmentList.map(d => d.name)
    );
  }, [departmentList]);

  // 선택된 부서의 이메일 수 계산
  const emailExportCount = useMemo(() => {
    if (emailExportSelectedDepts.length === 0) return 0;
    return users.filter(u =>
      u.email && emailExportSelectedDepts.includes(u.department || '미설정')
    ).length;
  }, [users, emailExportSelectedDepts]);

  // 이메일 Export 실행
  const handleExportEmails = useCallback(() => {
    if (!isAdmin || emailExportCount === 0) return;

    const filtered = users.filter(u =>
      u.email && emailExportSelectedDepts.includes(u.department || '미설정')
    );

    const emailList = filtered.map(u => u.email).join(';');

    const blob = new Blob([emailList], { type: 'text/plain;charset=ascii;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const timestamp = todayLocalYmd();
    const isAll = emailExportSelectedDepts.length === departmentList.length;
    const suffix = isAll ? '전체' : emailExportSelectedDepts.join('_');
    const filename = `이메일목록_${suffix}_${timestamp}.txt`;

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setEmailExportModalOpen(false);
  }, [isAdmin, users, emailExportSelectedDepts, emailExportCount, departmentList]);

  // 관리자인 경우 모든 사용자 목록 + 역할별 모듈 권한 + 사업부/부서 정보 가져오기
  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchRolePermissions();
      fetchDeptInfo();
    }
  }, [isAdmin]);

  // 사업부/부서 정보 조회
  const fetchDeptInfo = async () => {
    setDeptInfoLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${API_BASE_URL}/digital-twin-dashboard/settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success && json.data) {
        setDivisions(json.data.divisions || []);
        setDepartments(json.data.departments || []);
      }
    } catch (err) {
      console.error('Fetch dept info error:', err);
    } finally {
      setDeptInfoLoading(false);
    }
  };

  const fetchRolePermissions = async () => {
    setRolePermLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${API_BASE_URL}/auth/role-permissions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setRolePermissions(data.data || {});
    } catch (err) {
      console.error('Fetch role permissions error:', err);
    } finally {
      setRolePermLoading(false);
    }
  };

  const handleSaveRolePermissions = async () => {
    setRolePermSaving(true);
    setRolePermMessage('');
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${API_BASE_URL}/auth/role-permissions`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(rolePermissions)
      });
      const data = await res.json();
      if (data.success) {
        setRolePermMessage('저장되었습니다.');
        invalidateRolePermissionsCache();
        setTimeout(() => setRolePermMessage(''), 2000);
      }
    } catch (err) {
      console.error('Save role permissions error:', err);
      setRolePermMessage('저장 실패');
    } finally {
      setRolePermSaving(false);
    }
  };

  const toggleRoleModulePerm = (role, path) => {
    setRolePermissions(prev => {
      const next = { ...prev };
      if (!next[role]) next[role] = {};
      else next[role] = { ...next[role] };
      if (next[role][path] === false) {
        delete next[role][path];
        if (Object.keys(next[role]).length === 0) delete next[role];
      } else {
        next[role][path] = false;
      }
      return next;
    });
  };

  // 검색어 변경 시 첫 페이지로 이동
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE_URL}/auth/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.success) {
        setUsers(data.data);
      } else {
        setError(data.message || '사용자 목록을 불러오는데 실패했습니다.');
      }
    } catch (err) {
      console.error('Fetch users error:', err);
      setError('사용자 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 접속 이력 조회
  const fetchAccessLogs = useCallback(async (page = 1) => {
    if (!user?.is_admin) return;
    setAccessLogLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const params = new URLSearchParams({ page, per_page: 30 });
      if (accessLogUserFilter) params.append('user_id', accessLogUserFilter);
      if (accessLogActionFilter) params.append('action', accessLogActionFilter);

      const response = await fetch(`${API_BASE_URL}/auth/access-logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setAccessLogs(data.data.logs);
        setAccessLogTotal(data.data.total);
        setAccessLogTotalPages(data.data.total_pages);
        setAccessLogPage(data.data.page);
      }
    } catch (err) {
      console.error('Fetch access logs error:', err);
    } finally {
      setAccessLogLoading(false);
    }
  }, [user, accessLogUserFilter, accessLogActionFilter]);

  useEffect(() => {
    if (user?.is_admin) fetchAccessLogs(1);
  }, [fetchAccessLogs]);

  const handleClearAccessLogs = async () => {
    if (!window.confirm('모든 접속 이력을 삭제하시겠습니까?')) return;
    try {
      const token = localStorage.getItem('accessToken');
      await fetch(`${API_BASE_URL}/auth/access-logs`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchAccessLogs(1);
    } catch (err) {
      console.error('Clear access logs error:', err);
    }
  };

  const handleExportAccessLogs = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      // 전체 데이터를 가져오기 위해 per_page를 크게 설정
      const params = new URLSearchParams({ page: 1, per_page: 10000 });
      if (accessLogUserFilter) params.append('user_id', accessLogUserFilter);
      if (accessLogActionFilter) params.append('action', accessLogActionFilter);

      const response = await fetch(`${API_BASE_URL}/auth/access-logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!data.success) return;

      const logs = data.data.logs;
      const actionLabel = (a) => a === 'LOGIN' ? '로그인' : a === 'LOGOUT' ? '로그아웃' : '모듈 접근';
      const csvRows = [
        ['시간', '사용자', '이메일', '활동', '모듈', 'IP'].join(','),
        ...logs.map(log => [
          `"${new Date(log.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}"`,
          `"${log.user_name}"`,
          `"${log.user_email}"`,
          `"${actionLabel(log.action)}"`,
          `"${log.module_name || ''}"`,
          `"${log.ip_address || ''}"`,
        ].join(','))
      ];

      const bom = '\uFEFF';
      const blob = new Blob([bom + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `접속이력_${todayLocalYmd()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export access logs error:', err);
    }
  };

  const handleRoleChange = async (targetUserId, newRole) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE_URL}/auth/users/${targetUserId}/role`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: newRole })
      });

      const data = await response.json();
      if (data.success) {
        fetchUsers();
      } else {
        setError(data.message || '권한 변경에 실패했습니다.');
      }
    } catch (err) {
      console.error('Update role error:', err);
      setError('권한 변경에 실패했습니다.');
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordMessage({ type: '', text: '' });

    // 유효성 검사
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMessage({ type: 'error', text: '모든 필드를 입력해주세요.' });
      return;
    }

    if (newPassword.length < 4) {
      setPasswordMessage({ type: 'error', text: '새 비밀번호는 최소 4자 이상이어야 합니다.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: '새 비밀번호가 일치하지 않습니다.' });
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordMessage({ type: 'error', text: '현재 비밀번호와 다른 비밀번호를 입력해주세요.' });
      return;
    }

    setPasswordLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE_URL}/auth/me/password`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });

      const data = await response.json();
      if (data.success) {
        setPasswordMessage({ type: 'success', text: '비밀번호가 성공적으로 변경되었습니다. 다시 로그인해주세요.' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        // 3초 후 로그아웃
        setTimeout(() => {
          logout();
          navigate('/login');
        }, 3000);
      } else {
        setPasswordMessage({ type: 'error', text: data.message || '비밀번호 변경에 실패했습니다.' });
      }
    } catch (err) {
      console.error('Password change error:', err);
      setPasswordMessage({ type: 'error', text: '비밀번호 변경 중 오류가 발생했습니다.' });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handlePasswordReset = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordMessage({ type: '', text: '' });
  };

  // 부서명 수정
  const handleDepartmentEdit = () => {
    setDepartmentValue(user?.department || '');
    setIsEditingDepartment(true);
  };

  const handleDepartmentCancel = () => {
    setDepartmentValue(user?.department || '');
    setIsEditingDepartment(false);
  };

  const handleDepartmentSave = async () => {
    setDepartmentLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ department: departmentValue.trim() })
      });

      const data = await response.json();
      if (data.success) {
        // 로컬 스토리지의 user 정보 업데이트
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        storedUser.department = departmentValue.trim();
        localStorage.setItem('user', JSON.stringify(storedUser));

        // 페이지 새로고침으로 상태 업데이트
        window.location.reload();
      } else {
        alert(data.message || '부서명 변경에 실패했습니다.');
      }
    } catch (err) {
      console.error('Department update error:', err);
      alert('부서명 변경 중 오류가 발생했습니다.');
    } finally {
      setDepartmentLoading(false);
      setIsEditingDepartment(false);
    }
  };

  // 사용자 편집 모달 열기
  const handleOpenUserEditModal = (targetUser) => {
    setSelectedUser(targetUser);
    setEditUserForm({
      name: targetUser.name || '',
      email: targetUser.email || '',
      department: targetUser.department || '',
      role: targetUser.role || 'user'
    });
    setIsUserEditModalOpen(true);
  };

  // 사용자 편집 모달 닫기
  const handleCloseUserEditModal = () => {
    setIsUserEditModalOpen(false);
    setSelectedUser(null);
    setEditUserForm({
      name: '',
      email: '',
      department: '',
      role: 'user'
    });
  };

  // 사용자 정보 저장
  const handleSaveUserEdit = async () => {
    if (!selectedUser) return;

    setUserEditLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE_URL}/auth/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: editUserForm.name.trim(),
          department: editUserForm.department.trim(),
          role: editUserForm.role
        })
      });

      const data = await response.json();
      if (data.success) {
        // 사용자 목록 새로고침
        fetchUsers();
        handleCloseUserEditModal();
      } else {
        setError(data.message || '사용자 정보 수정에 실패했습니다.');
      }
    } catch (err) {
      console.error('User update error:', err);
      setError('사용자 정보 수정 중 오류가 발생했습니다.');
    } finally {
      setUserEditLoading(false);
    }
  };

  // 사용자 삭제 모달 열기
  const handleOpenDeleteModal = (targetUser) => {
    setUserToDelete(targetUser);
    setIsDeleteModalOpen(true);
  };

  // 사용자 삭제 모달 닫기
  const handleCloseDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setUserToDelete(null);
  };

  // 사용자 삭제
  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setDeleteLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE_URL}/auth/users/${userToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.success) {
        // 사용자 목록 새로고침
        fetchUsers();
        handleCloseDeleteModal();
      } else {
        setError(data.message || '사용자 삭제에 실패했습니다.');
      }
    } catch (err) {
      console.error('User delete error:', err);
      setError('사용자 삭제 중 오류가 발생했습니다.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // 사용자 목록 CSV Export 기능 (관리자 전용) - 이름, 이메일
  const handleExportUsersCSV = () => {
    if (!isAdmin || users.length === 0) return;

    // CSV 헤더
    const headers = ['이름', '이메일', '부서', '권한'];

    // CSV 데이터 생성
    const csvData = users.map(u => {
      const name = u.name || '';
      const email = u.email || '';
      const department = u.department || '';
      const role = ROLE_LABELS[u.role] || u.role || '';
      return [name, email, department, role];
    });

    // CSV 문자열 생성 (BOM 추가하여 Excel에서 한글 깨짐 방지)
    const BOM = '\uFEFF';
    const csvContent = BOM + [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // 파일 다운로드
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const timestamp = todayLocalYmd();
    const filename = `사용자목록_${timestamp}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 비밀번호 재설정 모달 열기
  const handleOpenPasswordResetModal = (targetUser) => {
    setPasswordResetUser(targetUser);
    setNewPasswordForReset('');
    setConfirmPasswordForReset('');
    setPasswordResetMessage({ type: '', text: '' });
    setIsPasswordResetModalOpen(true);
  };

  // 비밀번호 재설정 모달 닫기
  const handleClosePasswordResetModal = () => {
    setIsPasswordResetModalOpen(false);
    setPasswordResetUser(null);
    setNewPasswordForReset('');
    setConfirmPasswordForReset('');
    setPasswordResetMessage({ type: '', text: '' });
  };

  // 관리자 비밀번호 재설정
  const handleAdminPasswordReset = async () => {
    if (!passwordResetUser) return;

    // 유효성 검사
    if (!newPasswordForReset) {
      setPasswordResetMessage({ type: 'error', text: '새 비밀번호를 입력해주세요.' });
      return;
    }

    if (newPasswordForReset.length < 4) {
      setPasswordResetMessage({ type: 'error', text: '비밀번호는 최소 4자 이상이어야 합니다.' });
      return;
    }

    if (newPasswordForReset !== confirmPasswordForReset) {
      setPasswordResetMessage({ type: 'error', text: '비밀번호가 일치하지 않습니다.' });
      return;
    }

    setPasswordResetLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE_URL}/auth/users/${passwordResetUser.id}/password`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ new_password: newPasswordForReset })
      });

      const data = await response.json();
      if (data.success) {
        setPasswordResetMessage({ type: 'success', text: data.message || '비밀번호가 성공적으로 변경되었습니다.' });
        // 2초 후 모달 닫기
        setTimeout(() => {
          handleClosePasswordResetModal();
        }, 2000);
      } else {
        setPasswordResetMessage({ type: 'error', text: data.message || '비밀번호 변경에 실패했습니다.' });
      }
    } catch (err) {
      console.error('Password reset error:', err);
      setPasswordResetMessage({ type: 'error', text: '비밀번호 변경 중 오류가 발생했습니다.' });
    } finally {
      setPasswordResetLoading(false);
    }
  };

  // 검색 필터링
  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 페이지네이션
  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // 페이지 버튼 생성
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  return (
    <Container>
      <CommonHeader
        logo={<User size={24} strokeWidth={2} />}
        title="계정 관리"
        titleColor="#0066cc"
        onGoHome={() => navigate('/')}
        className="account-management-header"
      />

      {/* 탭이 하나뿐이면(관리자가 아니면) 막대를 안 그린다 — 고를 것이 없는 탭 막대는
          자리만 차지하고 아무것도 알려주지 않는다. 일반 사용자는 예전 화면 그대로다. */}
      {visibleTabs.length > 1 && (
      <TabBar>
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabButton
              key={tab.key}
              type="button"
              className={currentTab === tab.key ? 'active' : ''}
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon size={16} />
              {tab.label}
            </TabButton>
          );
        })}
      </TabBar>
      )}

      <ScrollArea>
      {(currentTab === 'me' || currentTab === 'users') && (
      <Content>
        {/* 내 정보 탭 — 내 계정 정보 | MCP 연결 을 반반으로 */}
        {currentTab === 'me' && (
        <>
        {/* 좌측: 내 계정 정보 — `split` 이 본문을 계정 정보 | 비밀번호 변경 두 칸으로 나눈다 */}
        <LeftPanel>
          <Card className="split">
            <CardHeader>
              <IconWrapper>
                <User size={32} strokeWidth={2} />
              </IconWrapper>
              <HeaderText>
                <h1>내 계정 정보</h1>
                <p>현재 로그인 중인 계정의 정보입니다</p>
              </HeaderText>
            </CardHeader>

            <InfoSection>
              <InfoRow>
                <Label>계정 ID</Label>
                <Value>{user?.email?.split('@')[0] || '알 수 없음'}</Value>
              </InfoRow>

              <InfoRow>
                <Label>사용자 이름</Label>
                <Value>{user?.name || user?.username || '알 수 없음'}</Value>
              </InfoRow>

              <InfoRow>
                <Label>이메일</Label>
                <Value>{user?.email || '정보 없음'}</Value>
              </InfoRow>

              <InfoRow>
                <Label>
                  <Building size={14} style={{ display: 'inline', marginRight: '0.25rem', verticalAlign: 'middle' }} />
                  부서명
                </Label>
                {isEditingDepartment ? (
                  <EditableValue>
                    <EditInput
                      type="text"
                      value={departmentValue}
                      onChange={(e) => setDepartmentValue(e.target.value)}
                      placeholder="부서명을 입력하세요"
                      disabled={departmentLoading}
                      autoFocus
                    />
                    <EditButton
                      className="save"
                      onClick={handleDepartmentSave}
                      disabled={departmentLoading}
                      title="저장"
                    >
                      <Check size={18} />
                    </EditButton>
                    <EditButton
                      className="cancel"
                      onClick={handleDepartmentCancel}
                      disabled={departmentLoading}
                      title="취소"
                    >
                      <X size={18} />
                    </EditButton>
                  </EditableValue>
                ) : (
                  <EditableValue>
                    <Value style={{ flex: 1 }}>{user?.department || '미설정'}</Value>
                    <EditButton
                      className="edit"
                      onClick={handleDepartmentEdit}
                      title="수정"
                    >
                      <Edit3 size={18} />
                    </EditButton>
                  </EditableValue>
                )}
              </InfoRow>

              <InfoRow>
                <Label>권한</Label>
                <Value>
                  <RoleBadge role={user?.role || 'user'}>
                    <Shield size={16} />
                    {ROLE_LABELS[user?.role] || ROLE_LABELS.user}
                  </RoleBadge>
                </Value>
              </InfoRow>
            </InfoSection>

            {/* 비밀번호 변경 섹션 */}
            <PasswordSection>
              <PasswordHeader>
                <Key size={20} color="#0066cc" />
                <h3>비밀번호 변경</h3>
              </PasswordHeader>

              {passwordMessage.text && (
                <PasswordMessage className={passwordMessage.type}>
                  {passwordMessage.type === 'success' ? <Check size={16} /> : <X size={16} />}
                  {passwordMessage.text}
                </PasswordMessage>
              )}

              <PasswordForm onSubmit={handlePasswordChange}>
                <PasswordInputGroup>
                  <Label>현재 비밀번호</Label>
                  <PasswordInputWrapper>
                    <PasswordInput
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="현재 비밀번호를 입력하세요"
                      disabled={passwordLoading}
                    />
                    <PasswordToggle
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </PasswordToggle>
                  </PasswordInputWrapper>
                </PasswordInputGroup>

                <PasswordInputGroup>
                  <Label>새 비밀번호</Label>
                  <PasswordInputWrapper>
                    <PasswordInput
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="새 비밀번호를 입력하세요"
                      disabled={passwordLoading}
                    />
                    <PasswordToggle
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </PasswordToggle>
                  </PasswordInputWrapper>
                  <PasswordHint>최소 4자 이상 입력해주세요</PasswordHint>
                </PasswordInputGroup>

                <PasswordInputGroup>
                  <Label>새 비밀번호 확인</Label>
                  <PasswordInputWrapper>
                    <PasswordInput
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="새 비밀번호를 다시 입력하세요"
                      error={confirmPassword && newPassword !== confirmPassword}
                      disabled={passwordLoading}
                    />
                    <PasswordToggle
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </PasswordToggle>
                  </PasswordInputWrapper>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <PasswordHint style={{ color: '#dc2626' }}>비밀번호가 일치하지 않습니다</PasswordHint>
                  )}
                </PasswordInputGroup>

                <PasswordButtonGroup>
                  <PasswordButton
                    type="submit"
                    className="primary"
                    disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
                  >
                    {passwordLoading ? '변경 중...' : '비밀번호 변경'}
                  </PasswordButton>
                  <PasswordButton
                    type="button"
                    className="secondary"
                    onClick={handlePasswordReset}
                    disabled={passwordLoading}
                  >
                    초기화
                  </PasswordButton>
                </PasswordButtonGroup>
              </PasswordForm>
            </PasswordSection>
          </Card>
        </LeftPanel>

        {/* 우측: MCP 연결 — 내 계정 정보와 **한 화면에 나란히** 둔다.
            역할 제한을 걸지 않는다. PAT 은 개인 것이라 과제 담당자도 자기 토큰이 필요하다. */}
        <RightPanel>
          <Card>
            <CardHeader>
              <IconWrapper color="linear-gradient(135deg, #0891b2 0%, #0e7490 100%)">
                <Plug size={32} strokeWidth={2} />
              </IconWrapper>
              <HeaderText>
                <h1>MCP 연결</h1>
                <p>Claude Code · Gemini CLI 등 외부 AI 가 내 권한으로 과제를 조회·수정합니다</p>
              </HeaderText>
            </CardHeader>

            <McpTokenSection />
          </Card>
        </RightPanel>
        </>
        )}

        {/* 사용자 권한 관리 탭 — 표가 넓어 WidePanel 로 전체 폭을 쓴다 */}
        {currentTab === 'users' && isAdmin && (
          <WidePanel>
            <Card>
              <CardHeader>
                <IconWrapper color="linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)">
                  <Users size={32} strokeWidth={2} />
                </IconWrapper>
                <HeaderText>
                  <h1>사용자 권한 관리</h1>
                  <p>관리자 전용 - 사용자 권한을 변경할 수 있습니다 (총 {users.length}명)</p>
                </HeaderText>
              </CardHeader>

              {/* Export 버튼 그룹 (관리자 전용) */}
              <HeaderActions>
                <ExportButtonGroup>
                  <ExportButton
                    onClick={handleExportUsersCSV}
                    disabled={users.length === 0}
                    title="이름, 이메일을 CSV 파일로 내보내기"
                  >
                    <Download size={16} />
                    CSV Export
                  </ExportButton>
                  <ExportButton
                    onClick={openEmailExportModal}
                    disabled={users.length === 0}
                    title="이메일 주소만 세미콜론으로 연결하여 TXT 파일로 내보내기"
                    style={{ background: 'linear-gradient(135deg, #0066cc 0%, #0052a3 100%)' }}
                  >
                    <Download size={16} />
                    이메일 TXT Export
                  </ExportButton>
                </ExportButtonGroup>
              </HeaderActions>

              {/* 검색 */}
              <SearchContainer>
                <Search size={18} color="#94a3b8" />
                <SearchInput
                  type="text"
                  placeholder="이름으로 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </SearchContainer>

              {error && <ErrorText>{error}</ErrorText>}

              {loading ? (
                <LoadingText>사용자 목록을 불러오는 중...</LoadingText>
              ) : paginatedUsers.length === 0 ? (
                <EmptyState>
                  {searchTerm ? '검색 결과가 없습니다.' : '등록된 사용자가 없습니다.'}
                </EmptyState>
              ) : (
                <>
                  <UserTable>
                    <TableHead>
                      <tr>
                        <th>이름</th>
                        <th>이메일</th>
                        <th>부서</th>
                        <th>현재 권한</th>
                        <th>권한 변경</th>
                        <th>관리</th>
                      </tr>
                    </TableHead>
                    <TableBody>
                      {paginatedUsers.map(u => (
                        <tr key={u.id}>
                          <td>{u.name}</td>
                          <td>{u.email}</td>
                          <td>{u.department || '-'}</td>
                          <td>
                            <RoleBadge role={u.role || 'user'}>
                              {ROLE_LABELS[u.role] || ROLE_LABELS.user}
                            </RoleBadge>
                          </td>
                          <td>
                            <RoleSelect
                              value={u.role || 'user'}
                              onChange={(e) => handleRoleChange(u.id, e.target.value)}
                              disabled={u.id === user?.id}
                            >
                              <option value="admin">Admin</option>
                              <option value="manager">Manager</option>
                              <option value="dt_office">DT Office</option>
                              <option value="user">User</option>
                              <option value="viewer">Viewer</option>
                            </RoleSelect>
                          </td>
                          <td>
                            <ActionButtons>
                              <EditIcon
                                onClick={() => handleOpenUserEditModal(u)}
                                title="사용자 정보 수정"
                              >
                                <Edit3 size={16} />
                              </EditIcon>
                              <EditIcon
                                onClick={() => handleOpenPasswordResetModal(u)}
                                title="비밀번호 초기화"
                                disabled={u.id === user?.id}
                                style={{ background: u.id === user?.id ? '#f1f5f9' : '#fef3c7', color: u.id === user?.id ? '#94a3b8' : '#d97706' }}
                              >
                                <Key size={16} />
                              </EditIcon>
                              <DeleteIcon
                                onClick={() => handleOpenDeleteModal(u)}
                                title="사용자 삭제"
                                disabled={u.id === user?.id}
                              >
                                <Trash2 size={16} />
                              </DeleteIcon>
                            </ActionButtons>
                          </td>
                        </tr>
                      ))}
                    </TableBody>
                  </UserTable>

                  {/* 페이지네이션 */}
                  {totalPages > 1 && (
                    <Pagination>
                      <PageButton
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft size={18} />
                      </PageButton>

                      {getPageNumbers().map((page, index) => (
                        page === '...' ? (
                          <PageInfo key={`ellipsis-${index}`}>...</PageInfo>
                        ) : (
                          <PageButton
                            key={page}
                            active={page === currentPage}
                            onClick={() => handlePageChange(page)}
                          >
                            {page}
                          </PageButton>
                        )
                      ))}

                      <PageButton
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                      >
                        <ChevronRight size={18} />
                      </PageButton>

                      <PageInfo>
                        ({startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, filteredUsers.length)} / {filteredUsers.length}명)
                      </PageInfo>
                    </Pagination>
                  )}
                </>
              )}
            </Card>
          </WidePanel>
        )}
      </Content>
      )}

      {/* 역할별 모듈 접근 권한 — '사용자 권한 관리' 탭에서 표 아래에 이어 붙는다 */}
      {currentTab === 'users' && isAdmin && (
        <AccessLogSection>
          <AccessLogHeader>
            <AccessLogTitle>
              <Lock size={18} />
              역할별 모듈 접근 권한
            </AccessLogTitle>
            <AccessLogControls>
              {rolePermMessage && (
                <span style={{ fontSize: '0.8rem', color: rolePermMessage === '저장되었습니다.' ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                  {rolePermMessage}
                </span>
              )}
              <AccessLogIconBtn onClick={handleSaveRolePermissions} disabled={rolePermSaving}>
                <Check size={14} />
                {rolePermSaving ? '저장 중...' : '저장'}
              </AccessLogIconBtn>
            </AccessLogControls>
          </AccessLogHeader>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ textAlign: 'left', padding: '0.6rem 1rem', borderBottom: '1px solid #e2e8f0', fontWeight: 600, color: '#64748b', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                    모듈
                  </th>
                  {['manager', 'dt_office', 'user', 'viewer'].map(role => (
                    <th key={role} style={{ textAlign: 'center', padding: '0.6rem 0.75rem', borderBottom: '1px solid #e2e8f0', fontWeight: 600, color: '#64748b', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                      {ROLE_LABELS[role]?.split(' (')[0] || role}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(MODULE_NAMES)
                  .filter(([path]) => path !== '/account-management')
                  .flatMap(([path, name]) => {
                    const rows = [(
                      <tr key={path} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.5rem 1rem', color: '#1e293b', fontWeight: 500 }}>
                          {path === '/meeting-management' ? `${name} (접근)` : name}
                        </td>
                        {['manager', 'dt_office', 'user', 'viewer'].map(role => {
                          const allowed = rolePermissions[role]?.[path] !== false;
                          return (
                            <td key={role} style={{ textAlign: 'center', padding: '0.5rem 0.75rem' }}>
                              <input
                                type="checkbox"
                                checked={allowed}
                                onChange={() => toggleRoleModulePerm(role, path)}
                                disabled={rolePermSaving}
                                style={{ accentColor: '#0066cc', width: '16px', height: '16px', cursor: 'pointer' }}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    )];
                    // 협의체/회의체/보고 모듈에 "편집" 행 추가
                    if (path === '/meeting-management') {
                      const editPath = '/meeting-management-edit';
                      rows.push(
                        <tr key={editPath} style={{ borderBottom: '1px solid #f1f5f9', background: '#fefce8' }}>
                          <td style={{ padding: '0.5rem 1rem 0.5rem 2rem', color: '#92400e', fontWeight: 500, fontSize: '0.78rem' }}>
                            ↳ {name} (편집)
                          </td>
                          {['manager', 'dt_office', 'user', 'viewer'].map(role => {
                            const accessAllowed = rolePermissions[role]?.[path] !== false;
                            const editAllowed = rolePermissions[role]?.[editPath] !== false;
                            return (
                              <td key={role} style={{ textAlign: 'center', padding: '0.5rem 0.75rem' }}>
                                <input
                                  type="checkbox"
                                  checked={editAllowed && accessAllowed}
                                  onChange={() => toggleRoleModulePerm(role, editPath)}
                                  disabled={rolePermSaving || !accessAllowed}
                                  style={{ accentColor: '#d97706', width: '16px', height: '16px', cursor: accessAllowed ? 'pointer' : 'not-allowed' }}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    }
                    return rows;
                  })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', color: '#64748b', borderTop: '1px solid #e2e8f0' }}>
            Admin(관리자)은 항상 모든 모듈에 접근 가능합니다. 체크 해제 시 해당 역할의 모듈 접근이 차단됩니다. "협의체/회의체/보고 (편집)" 해제 시 보고계획 수정이 제한되며, 의견 작성은 접근 권한만 있으면 가능합니다.
          </div>
        </AccessLogSection>
      )}

      {/* 부서 정보 관리 (관리자 전용) */}
      {currentTab === 'depts' && isAdmin && (
        <AccessLogSection>
          <AccessLogHeader>
            <AccessLogTitle>
              <Building size={18} />
              부서 정보 관리 ({mergedDeptList.length}개 부서)
            </AccessLogTitle>
            <AccessLogControls>
              {deptInfoMessage && (
                <span style={{ fontSize: '0.8rem', color: deptInfoMessage === '저장되었습니다.' ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                  {deptInfoMessage}
                </span>
              )}
              {showNewDivisionInput ? (
                <>
                  <input
                    type="text"
                    value={newDivisionName}
                    onChange={(e) => setNewDivisionName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddDivision(); }}
                    placeholder="새 사업부명"
                    autoFocus
                    style={{ padding: '0.4rem 0.6rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.8rem' }}
                  />
                  <AccessLogIconBtn onClick={handleAddDivision} disabled={!newDivisionName.trim() || deptInfoSaving}>
                    <Check size={14} />
                  </AccessLogIconBtn>
                  <AccessLogIconBtn onClick={() => { setShowNewDivisionInput(false); setNewDivisionName(''); }}>
                    <X size={14} />
                  </AccessLogIconBtn>
                </>
              ) : (
                <AccessLogIconBtn onClick={() => setShowNewDivisionInput(true)}>
                  + 사업부 추가
                </AccessLogIconBtn>
              )}
              <AccessLogIconBtn onClick={fetchDeptInfo} title="새로고침" disabled={deptInfoLoading}>
                <RefreshCw size={13} />
              </AccessLogIconBtn>
              <AccessLogIconBtn
                onClick={handleSaveDeptInfo}
                disabled={deptInfoSaving || dirtyCount === 0}
                style={dirtyCount > 0 ? { background: '#0066cc', color: 'white', borderColor: '#0066cc' } : {}}
              >
                <Check size={14} />
                {deptInfoSaving ? '저장 중...' : `저장${dirtyCount > 0 ? ` (${dirtyCount})` : ''}`}
              </AccessLogIconBtn>
            </AccessLogControls>
          </AccessLogHeader>
          <div style={{ overflowX: 'auto' }}>
            <AccessLogTable>
              <thead>
                <tr>
                  <AccessLogTh>부서명</AccessLogTh>
                  <AccessLogTh>상태</AccessLogTh>
                  <AccessLogTh style={{ textAlign: 'center' }}>사용자 수</AccessLogTh>
                  <AccessLogTh>소속 사업부</AccessLogTh>
                </tr>
              </thead>
              <tbody>
                {deptInfoLoading ? (
                  <tr><AccessLogTd colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>로딩 중...</AccessLogTd></tr>
                ) : mergedDeptList.length === 0 ? (
                  <tr><AccessLogTd colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>등록된 부서가 없습니다.</AccessLogTd></tr>
                ) : (
                  mergedDeptList.map(dept => {
                    const dirty = isDeptDirty(dept);
                    const effectiveDivId = getEffectiveDivisionId(dept);
                    return (
                      <tr key={dept.name} style={dirty ? { background: '#fffbeb' } : {}}>
                        <AccessLogTd style={{ fontWeight: 500, color: '#1e293b' }}>{dept.name}</AccessLogTd>
                        <AccessLogTd>
                          {dept.isNew ? (
                            <span style={{ display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 600, background: '#fef3c7', color: '#92400e' }}>
                              신규 (사용자 정보에서 발견)
                            </span>
                          ) : (
                            <span style={{ display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 600, background: '#dbeafe', color: '#1e40af' }}>
                              등록됨
                            </span>
                          )}
                        </AccessLogTd>
                        <AccessLogTd style={{ textAlign: 'center', color: '#475569' }}>{dept.userCount}명</AccessLogTd>
                        <AccessLogTd>
                          <AccessLogFilterSelect
                            value={effectiveDivId}
                            onChange={(e) => setDeptDivision(dept.name, e.target.value)}
                            disabled={deptInfoSaving}
                            style={{ minWidth: '200px' }}
                          >
                            <option value="">— 사업부 미지정 —</option>
                            {divisions.map(div => (
                              <option key={div.id} value={div.id}>{div.name}</option>
                            ))}
                          </AccessLogFilterSelect>
                          {dirty && (
                            <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: '#d97706', fontWeight: 600 }}>변경됨</span>
                          )}
                        </AccessLogTd>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </AccessLogTable>
          </div>
          <div style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', color: '#64748b', borderTop: '1px solid #e2e8f0' }}>
            "신규" 부서는 사용자 정보에서 발견되었으나 부서 목록에 아직 등록되지 않은 부서입니다. 사업부를 지정하고 저장하면 부서 목록에 등록됩니다. 변경된 행은 노란색으로 표시되며, 저장 시 일괄 반영됩니다.
          </div>
        </AccessLogSection>
      )}

      {/* 접속 이력 (관리자 전용) */}
      {/* ⚠️ 조건이 `isAdmin` 이 아니라 `user?.is_admin` 이다 — 원래 그랬고 그대로 둔다.
          `to_dict()` 가 `is_admin: is_admin or role=='admin'` 로 내려주므로 실제로는 같다. */}
      {currentTab === 'logs' && user?.is_admin && (
        <AccessLogSection>
          <AccessLogHeader>
            <AccessLogTitle>
              <Clock size={18} />
              접속 이력 ({accessLogTotal}건)
            </AccessLogTitle>
            <AccessLogControls>
              <AccessLogFilterSelect
                value={accessLogUserFilter}
                onChange={(e) => { setAccessLogUserFilter(e.target.value); }}
              >
                <option value="">전체 사용자</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
              </AccessLogFilterSelect>
              <AccessLogFilterSelect
                value={accessLogActionFilter}
                onChange={(e) => { setAccessLogActionFilter(e.target.value); }}
              >
                <option value="">전체 활동</option>
                <option value="LOGIN">로그인</option>
                <option value="MODULE_ACCESS">모듈 접근</option>
              </AccessLogFilterSelect>
              <AccessLogIconBtn onClick={handleExportAccessLogs} title="CSV 내보내기">
                <Download size={13} />
                Export
              </AccessLogIconBtn>
              <AccessLogIconBtn onClick={() => fetchAccessLogs(accessLogPage)} title="새로고침">
                <RefreshCw size={13} />
              </AccessLogIconBtn>
              <AccessLogIconBtn onClick={handleClearAccessLogs} title="전체 삭제" style={{ color: '#dc2626' }}>
                <Trash2 size={13} />
              </AccessLogIconBtn>
            </AccessLogControls>
          </AccessLogHeader>

          <div style={{ overflowX: 'auto' }}>
            <AccessLogTable>
              <thead>
                <tr>
                  <AccessLogTh>시간</AccessLogTh>
                  <AccessLogTh>사용자</AccessLogTh>
                  <AccessLogTh>이메일</AccessLogTh>
                  <AccessLogTh>활동</AccessLogTh>
                  <AccessLogTh>모듈</AccessLogTh>
                  <AccessLogTh>IP</AccessLogTh>
                </tr>
              </thead>
              <tbody>
                {accessLogLoading ? (
                  <tr><AccessLogTd colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>로딩 중...</AccessLogTd></tr>
                ) : accessLogs.length === 0 ? (
                  <tr><AccessLogTd colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>접속 이력이 없습니다</AccessLogTd></tr>
                ) : (
                  accessLogs.map(log => (
                    <tr key={log.id}>
                      <AccessLogTd style={{ whiteSpace: 'nowrap', fontSize: '0.75rem' }}>
                        {new Date(log.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </AccessLogTd>
                      <AccessLogTd style={{ fontWeight: 500 }}>{log.user_name}</AccessLogTd>
                      <AccessLogTd style={{ color: '#6b7280', fontSize: '0.75rem' }}>{log.user_email}</AccessLogTd>
                      <AccessLogTd>
                        <AccessLogActionBadge $action={log.action}>
                          {log.action === 'LOGIN' ? '로그인' : log.action === 'LOGOUT' ? '로그아웃' : '모듈 접근'}
                        </AccessLogActionBadge>
                      </AccessLogTd>
                      <AccessLogTd>
                        {log.module_name ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Monitor size={12} color="#6b7280" />
                            {log.module_name}
                          </span>
                        ) : '-'}
                      </AccessLogTd>
                      <AccessLogTd style={{ color: '#9ca3af', fontSize: '0.7rem', fontFamily: 'monospace' }}>{log.ip_address || '-'}</AccessLogTd>
                    </tr>
                  ))
                )}
              </tbody>
            </AccessLogTable>
          </div>

          {accessLogTotalPages > 1 && (
            <AccessLogPagination>
              <AccessLogPageBtn disabled={accessLogPage <= 1} onClick={() => fetchAccessLogs(accessLogPage - 1)}>
                <ChevronLeft size={14} />
              </AccessLogPageBtn>
              <span>{accessLogPage} / {accessLogTotalPages}</span>
              <AccessLogPageBtn disabled={accessLogPage >= accessLogTotalPages} onClick={() => fetchAccessLogs(accessLogPage + 1)}>
                <ChevronRight size={14} />
              </AccessLogPageBtn>
            </AccessLogPagination>
          )}
        </AccessLogSection>
      )}
      </ScrollArea>

      {/* 사용자 편집 모달 */}
      {isUserEditModalOpen && selectedUser && (
        <ModalOverlay onClick={handleCloseUserEditModal}>
          <ModalContainer onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <h2>
                <UserCog size={24} />
                사용자 정보 수정
              </h2>
              <CloseButton onClick={handleCloseUserEditModal}>
                <X size={20} />
              </CloseButton>
            </ModalHeader>

            <ModalBody>
              <FormGroup>
                <FormLabel>이름</FormLabel>
                <FormInput
                  type="text"
                  value={editUserForm.name}
                  onChange={(e) => setEditUserForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="이름을 입력하세요"
                  disabled={userEditLoading}
                />
              </FormGroup>

              <FormGroup>
                <FormLabel>이메일</FormLabel>
                <FormInput
                  type="email"
                  value={editUserForm.email}
                  disabled
                  style={{ cursor: 'not-allowed' }}
                />
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>이메일은 수정할 수 없습니다</span>
              </FormGroup>

              <FormGroup>
                <FormLabel>부서</FormLabel>
                <FormInput
                  type="text"
                  value={editUserForm.department}
                  onChange={(e) => setEditUserForm(prev => ({ ...prev, department: e.target.value }))}
                  placeholder="부서명을 입력하세요"
                  disabled={userEditLoading}
                />
              </FormGroup>

              <FormGroup>
                <FormLabel>권한</FormLabel>
                <FormSelect
                  value={editUserForm.role}
                  onChange={(e) => setEditUserForm(prev => ({ ...prev, role: e.target.value }))}
                  disabled={userEditLoading || selectedUser.id === user?.id}
                >
                  <option value="admin">Admin (관리자)</option>
                  <option value="manager">Manager (매니저)</option>
                  <option value="dt_office">DT Office (디지털 트윈 사무국)</option>
                  <option value="user">User (사용자)</option>
                  <option value="viewer">Viewer (뷰어)</option>
                </FormSelect>
                {selectedUser.id === user?.id && (
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>자신의 권한은 변경할 수 없습니다</span>
                )}
              </FormGroup>
            </ModalBody>

            <ModalFooter>
              <ModalButton
                className="secondary"
                onClick={handleCloseUserEditModal}
                disabled={userEditLoading}
              >
                취소
              </ModalButton>
              <ModalButton
                className="primary"
                onClick={handleSaveUserEdit}
                disabled={userEditLoading || !editUserForm.name.trim()}
              >
                {userEditLoading ? '저장 중...' : '저장'}
              </ModalButton>
            </ModalFooter>
          </ModalContainer>
        </ModalOverlay>
      )}

      {/* 사용자 삭제 확인 모달 */}
      {isDeleteModalOpen && userToDelete && (
        <ModalOverlay onClick={handleCloseDeleteModal}>
          <ModalContainer onClick={(e) => e.stopPropagation()}>
            <DeleteModalHeader>
              <h2>
                <Trash2 size={24} />
                사용자 삭제
              </h2>
              <CloseButton onClick={handleCloseDeleteModal}>
                <X size={20} />
              </CloseButton>
            </DeleteModalHeader>

            <ModalBody>
              <DeleteWarning>
                <AlertTriangle size={24} />
                <p>
                  이 작업은 되돌릴 수 없습니다.<br />
                  해당 사용자의 모든 데이터가 영구적으로 삭제됩니다.
                </p>
              </DeleteWarning>

              <DeleteUserInfo>
                <p><strong>이름:</strong> {userToDelete.name}</p>
                <p><strong>이메일:</strong> {userToDelete.email}</p>
                <p><strong>부서:</strong> {userToDelete.department || '-'}</p>
                <p><strong>권한:</strong> {ROLE_LABELS[userToDelete.role] || ROLE_LABELS.user}</p>
              </DeleteUserInfo>
            </ModalBody>

            <ModalFooter>
              <ModalButton
                className="secondary"
                onClick={handleCloseDeleteModal}
                disabled={deleteLoading}
              >
                취소
              </ModalButton>
              <DeleteButton
                onClick={handleDeleteUser}
                disabled={deleteLoading}
              >
                <Trash2 size={16} />
                {deleteLoading ? '삭제 중...' : '삭제'}
              </DeleteButton>
            </ModalFooter>
          </ModalContainer>
        </ModalOverlay>
      )}

      {/* 비밀번호 재설정 모달 */}
      {isPasswordResetModalOpen && passwordResetUser && (
        <ModalOverlay onClick={handleClosePasswordResetModal}>
          <ModalContainer onClick={(e) => e.stopPropagation()}>
            <ModalHeader style={{ background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)' }}>
              <h2>
                <Key size={24} />
                비밀번호 초기화
              </h2>
              <CloseButton onClick={handleClosePasswordResetModal}>
                <X size={20} />
              </CloseButton>
            </ModalHeader>

            <ModalBody>
              <DeleteUserInfo style={{ marginBottom: '1rem' }}>
                <p><strong>대상 사용자:</strong> {passwordResetUser.name}</p>
                <p><strong>이메일:</strong> {passwordResetUser.email}</p>
              </DeleteUserInfo>

              {passwordResetMessage.text && (
                <PasswordMessage className={passwordResetMessage.type}>
                  {passwordResetMessage.type === 'success' ? <Check size={16} /> : <X size={16} />}
                  {passwordResetMessage.text}
                </PasswordMessage>
              )}

              <FormGroup>
                <FormLabel>새 비밀번호</FormLabel>
                <PasswordInputWrapper>
                  <PasswordInput
                    type={showNewPasswordForReset ? 'text' : 'password'}
                    value={newPasswordForReset}
                    onChange={(e) => setNewPasswordForReset(e.target.value)}
                    placeholder="새 비밀번호를 입력하세요"
                    disabled={passwordResetLoading}
                  />
                  <PasswordToggle
                    type="button"
                    onClick={() => setShowNewPasswordForReset(!showNewPasswordForReset)}
                  >
                    {showNewPasswordForReset ? <EyeOff size={18} /> : <Eye size={18} />}
                  </PasswordToggle>
                </PasswordInputWrapper>
                <PasswordHint>최소 4자 이상 입력해주세요</PasswordHint>
              </FormGroup>

              <FormGroup>
                <FormLabel>새 비밀번호 확인</FormLabel>
                <PasswordInputWrapper>
                  <PasswordInput
                    type={showConfirmPasswordForReset ? 'text' : 'password'}
                    value={confirmPasswordForReset}
                    onChange={(e) => setConfirmPasswordForReset(e.target.value)}
                    placeholder="새 비밀번호를 다시 입력하세요"
                    disabled={passwordResetLoading}
                    error={confirmPasswordForReset && newPasswordForReset !== confirmPasswordForReset}
                  />
                  <PasswordToggle
                    type="button"
                    onClick={() => setShowConfirmPasswordForReset(!showConfirmPasswordForReset)}
                  >
                    {showConfirmPasswordForReset ? <EyeOff size={18} /> : <Eye size={18} />}
                  </PasswordToggle>
                </PasswordInputWrapper>
                {confirmPasswordForReset && newPasswordForReset !== confirmPasswordForReset && (
                  <PasswordHint style={{ color: '#dc2626' }}>비밀번호가 일치하지 않습니다</PasswordHint>
                )}
              </FormGroup>
            </ModalBody>

            <ModalFooter>
              <ModalButton
                className="secondary"
                onClick={handleClosePasswordResetModal}
                disabled={passwordResetLoading}
              >
                취소
              </ModalButton>
              <ModalButton
                className="primary"
                onClick={handleAdminPasswordReset}
                disabled={passwordResetLoading || !newPasswordForReset || !confirmPasswordForReset || newPasswordForReset !== confirmPasswordForReset}
                style={{ background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)' }}
              >
                <Key size={16} />
                {passwordResetLoading ? '변경 중...' : '비밀번호 변경'}
              </ModalButton>
            </ModalFooter>
          </ModalContainer>
        </ModalOverlay>
      )}
      {/* 이메일 Export 부서 선택 모달 */}
      {emailExportModalOpen && (
        <EmailExportModalOverlay onClick={() => setEmailExportModalOpen(false)}>
          <EmailExportModal onClick={(e) => e.stopPropagation()}>
            <EmailExportModalHeader>
              <EmailExportModalTitle>
                <Filter size={16} />
                이메일 Export - 부서 선택
              </EmailExportModalTitle>
              <EmailExportModalClose onClick={() => setEmailExportModalOpen(false)}>
                <X size={16} />
              </EmailExportModalClose>
            </EmailExportModalHeader>
            <EmailExportModalBody>
              <EmailExportSelectAll>
                <EmailExportSelectAllLabel onClick={toggleEmailExportAll}>
                  <EmailExportCheckbox
                    checked={emailExportSelectedDepts.length === departmentList.length}
                    readOnly
                  />
                  전체 선택
                </EmailExportSelectAllLabel>
                <EmailExportSelectedCount>
                  {emailExportSelectedDepts.length}/{departmentList.length}개 부서 선택
                </EmailExportSelectedCount>
              </EmailExportSelectAll>
              <EmailExportSearchWrapper>
                <EmailExportSearchIcon>
                  <Search size={14} />
                </EmailExportSearchIcon>
                <EmailExportSearchInput
                  placeholder="부서 검색..."
                  value={emailExportSearch}
                  onChange={(e) => setEmailExportSearch(e.target.value)}
                />
              </EmailExportSearchWrapper>
              <EmailExportDeptList>
                {filteredDepartmentList.map(dept => {
                  const checked = emailExportSelectedDepts.includes(dept.name);
                  return (
                    <EmailExportDeptItem
                      key={dept.name}
                      $checked={checked}
                      onClick={() => toggleEmailExportDept(dept.name)}
                    >
                      <EmailExportCheckbox checked={checked} readOnly />
                      <EmailExportDeptName $checked={checked}>{dept.name}</EmailExportDeptName>
                      <EmailExportDeptCount>{dept.count}명</EmailExportDeptCount>
                    </EmailExportDeptItem>
                  );
                })}
              </EmailExportDeptList>
            </EmailExportModalBody>
            <EmailExportModalFooter>
              <EmailExportTotalInfo>
                선택된 이메일: {emailExportCount}명
              </EmailExportTotalInfo>
              <EmailExportModalButtons>
                <EmailExportCancelBtn onClick={() => setEmailExportModalOpen(false)}>
                  취소
                </EmailExportCancelBtn>
                <EmailExportConfirmBtn
                  onClick={handleExportEmails}
                  disabled={emailExportCount === 0}
                >
                  <Download size={14} />
                  Export
                </EmailExportConfirmBtn>
              </EmailExportModalButtons>
            </EmailExportModalFooter>
          </EmailExportModal>
        </EmailExportModalOverlay>
      )}
    </Container>
  );
};

export default AccountManagementPage;
