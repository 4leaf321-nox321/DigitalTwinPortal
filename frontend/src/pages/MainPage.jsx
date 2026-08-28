import React, { useMemo, useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ModuleStatusModal from '../components/ModuleStatusModal';
import { fetchModuleStatuses } from '../services/portalApi';
import {
  Search,
  Settings,
  Code,
  BarChart3,
  GitBranch,
  Layers,
  FileText,
  Cpu,
  Calculator,
  Package,
  Volume2,
  Wrench,
  Home,
  Zap,
  Play,
  Cog,
  Brain,
  Users,
  Users2,
  Network,
  Target,
  Compass,
  LogOut,
  User as UserIcon,
  X,
  Plus,
  Edit2,
  Trash2,
  MessageSquare,
  FlaskConical,
  Share2,
  Database,
  ShieldCheck,
  TrendingUp,
  ClipboardList,
  Coins,
  Radar,
  Gauge
} from 'lucide-react';
import { APP_VERSION, versionState, versionText } from '../shared/utils/appVersion';
// AiChatSidebar 는 2026-08-01 에 화면에서 내렸다(아래 mount 자리 주석 참고).
// import AiChatSidebar from '../components/AiChatSidebar';

// ---- Styled Components ----------------------------------------------------
const Container = styled.div`
  height: 100vh;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  color: #1e293b;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const Header = styled.header`
  padding: 1rem;
  border-bottom: 1px solid #e2e8f0;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(12px);
  position: sticky;
  top: 0;
  z-index: 10;
`;

const HeaderContent = styled.div`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
`;

const LogoSection = styled(motion.div)`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const LogoIcon = styled.div`
  padding: 0.5rem;
  border-radius: 0.75rem;
  background: #1e293b;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const LogoText = styled.div`
  h1 {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0;
    color: #1e293b;
  }
  p {
    font-size: 0.75rem;
    color: #64748b;
    margin: 0;
  }
`;

const HeaderControls = styled(motion.div)`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const SearchContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: white;
  border-radius: 0.75rem;
  border: 1px solid #e2e8f0;
  padding: 0.5rem;
  
  @media (max-width: 768px) {
    display: none;
  }
`;

const SearchInput = styled.input`
  outline: none;
  border: none;
  font-size: 0.875rem;
  width: 256px;
  background: transparent;
  color: #1e293b;
  
  &::placeholder {
    color: #94a3b8;
  }
`;

const RoleSelect = styled.select`
  font-size: 0.875rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  padding: 0.25rem 0.5rem;
  background: white;
  color: #1e293b;
`;

const UserInfoBox = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
  color: #1e293b;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #f8fafc;
    border-color: #0066CC;
    color: #0066CC;
  }
`;

const SettingsButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  background: white;
  color: #475569;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #f8fafc;
    border-color: #0066CC;
    color: #0066CC;
  }
`;

const LogoutButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  background: linear-gradient(135deg, #0066CC 0%, #003399 100%);
  color: white;
  border: none;
  border-radius: 0.75rem;
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 102, 204, 0.3);
  }

  &:active {
    transform: translateY(0);
  }
`;

const Main = styled.main`
  flex: 1;
  padding: 0.5rem;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
`;

const MainContent = styled.div`
  width: 100%;
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 0.5rem;
  overflow: hidden;

  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr auto;
  }
`;

const MetroGrid = styled.section`
  width: 100%;
  height: 100%;
  overflow-y: auto;
  padding: 1rem;

  /* 스크롤바 스타일링 */
  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
  }
  &::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }
`;

const TileGrid = styled(motion.div)`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: clamp(140px, 17vh, 210px);
  gap: 0.5rem;
  width: 100%;

  @media (max-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;

const StatusGroupSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 1rem 1rem;

  & + & {
    border-top: 1px dashed #e2e8f0;
    margin-top: 0.25rem;
    padding-top: 0.75rem;
  }
`;

const StatusGroupHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.25rem 0.375rem;
`;

const StatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0.65rem;
  border-radius: 9999px;
  font-size: 0.78rem;
  font-weight: 700;
  color: ${p => p.$color};
  background: ${p => p.$bg};
  border: 1px solid ${p => p.$border};
  letter-spacing: 0.01em;

  &::before {
    content: '';
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: ${p => p.$color};
  }
`;

const StatusCount = styled.span`
  font-size: 0.72rem;
  color: #94a3b8;
  font-weight: 500;
`;

const StatusEmpty = styled.div`
  font-size: 0.85rem;
  color: #94a3b8;
  padding: 0.5rem 0.25rem;
`;

const Sidebar = styled.aside`
  width: 300px;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  overflow-y: auto;
  padding: 0 0.25rem;

  /* 스크롤바 스타일링 */
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }

  @media (max-width: 1024px) {
    width: 100%;
    height: auto;
    max-height: 40vh;
  }
`;

const Widget = styled(motion.div)`
  border-radius: 1rem;
  border: 1px solid #e2e8f0;
  background: white;
  padding: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`;

const KPIGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
`;

const KPICard = styled.div`
  border-radius: 0.75rem;
  border: 1px solid #e2e8f0;
  background: white;
  padding: 0.75rem;

  .label {
    font-size: 0.625rem;
    color: #64748b;
    margin-bottom: 0.25rem;
    line-height: 1.2;
    word-break: keep-all;
  }

  .value {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1e293b;
  }
`;

const WidgetTitle = styled.div`
  font-size: 0.75rem;
  color: #64748b;
  margin-bottom: 0.5rem;
`;

const AnnouncementHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
`;

const ManageButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  background: white;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #f8fafc;
    border-color: #0066CC;
    color: #0066CC;
  }
`;

const AnnouncementList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
`;

const AnnouncementItem = styled.div`
  padding: 0.5rem;
  border-radius: 0.5rem;
  border: 1px solid #e2e8f0;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #f8fafc;
    border-color: #0066CC;
  }

  .title {
    font-size: 0.875rem;
    color: #1e293b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .date {
    font-size: 0.75rem;
    color: #94a3b8;
    margin-top: 0.125rem;
  }
`;

const NoAnnouncement = styled.div`
  padding: 1rem;
  text-align: center;
  color: #94a3b8;
  font-size: 0.875rem;
`;

// 모달 오버레이
const ModalOverlay = styled(motion.div)`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 1rem;
`;

const ModalContent = styled(motion.div)`
  background: white;
  border-radius: 1rem;
  width: 100%;
  max-width: 500px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #e2e8f0;

  h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: #1e293b;
  }
`;

const ModalCloseButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.375rem;
  border: none;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  border-radius: 0.5rem;
  transition: all 0.2s ease;

  &:hover {
    background: #f1f5f9;
    color: #1e293b;
  }
`;

const ModalBody = styled.div`
  padding: 1.25rem;
  overflow-y: auto;
  flex: 1;

  .meta {
    font-size: 0.75rem;
    color: #94a3b8;
    margin-bottom: 1rem;
  }

  .content {
    font-size: 0.9375rem;
    color: #374151;
    line-height: 1.6;
    white-space: pre-wrap;
  }
`;

// 관리 모달
const ManageModalContent = styled(ModalContent)`
  max-width: 600px;
`;

const NoticeListContainer = styled.div`
  flex: 1;
  overflow-y: auto;
`;

const NoticeListItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #f1f5f9;
  gap: 0.75rem;

  &:last-child {
    border-bottom: none;
  }

  .info {
    flex: 1;
    min-width: 0;

    .title {
      font-size: 0.9375rem;
      font-weight: 500;
      color: #1e293b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .meta {
      font-size: 0.75rem;
      color: #94a3b8;
      margin-top: 0.125rem;
    }
  }

  .actions {
    display: flex;
    gap: 0.375rem;
  }

  .status {
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.6875rem;
    font-weight: 500;

    &.active {
      background: #dcfce7;
      color: #166534;
    }

    &.inactive {
      background: #fef2f2;
      color: #991b1b;
    }
  }
`;

const ActionButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.375rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  background: white;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #f8fafc;
    border-color: #0066CC;
    color: #0066CC;
  }

  &.delete:hover {
    border-color: #ef4444;
    color: #ef4444;
  }
`;

const AddNoticeButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  width: 100%;
  padding: 0.75rem;
  border: 2px dashed #e2e8f0;
  border-radius: 0.5rem;
  background: transparent;
  color: #64748b;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: #0066CC;
    color: #0066CC;
    background: #f8fafc;
  }
`;

const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid #e2e8f0;
`;

const FormGroup = styled.div`
  margin-bottom: 1rem;

  label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    margin-bottom: 0.375rem;
  }

  input, textarea {
    width: 100%;
    padding: 0.625rem 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    font-size: 0.9375rem;
    color: #1e293b;
    transition: border-color 0.2s ease;

    &:focus {
      outline: none;
      border-color: #0066CC;
    }
  }

  textarea {
    min-height: 150px;
    resize: vertical;
  }
`;

const CheckboxGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;

  input[type="checkbox"] {
    width: 1rem;
    height: 1rem;
    cursor: pointer;
  }

  label {
    font-size: 0.875rem;
    color: #374151;
    cursor: pointer;
    margin: 0;
  }
`;

const SubmitButton = styled.button`
  padding: 0.625rem 1.25rem;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &.primary {
    background: linear-gradient(135deg, #0066CC 0%, #003399 100%);
    color: white;

    &:hover {
      box-shadow: 0 4px 12px rgba(0, 102, 204, 0.3);
    }
  }

  &.secondary {
    background: white;
    color: #64748b;
    border: 1px solid #e2e8f0;

    &:hover {
      background: #f8fafc;
    }
  }
`;

const RecentList = styled.div`
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const RecentItem = styled.div`
  padding: 0.5rem;
  border-radius: 0.75rem;
  border: 1px solid #e2e8f0;
  transition: background-color 0.2s ease;
  cursor: pointer;
  
  &:hover {
    background: #f8fafc;
  }
  
  .title {
    font-size: 0.875rem;
    font-weight: 500;
    color: #1e293b;
  }
  
  .tag {
    font-size: 0.6875rem;
    color: #64748b;
    margin-top: 0.125rem;
  }
`;

const QuickActions = styled.div`
  margin-top: 0.5rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
`;

const QuickButton = styled.button`
  padding: 0.375rem 0.75rem;
  border-radius: 0.75rem;
  border: 1px solid #e2e8f0;
  font-size: 0.875rem;
  background: white;
  color: #1e293b;
  transition: all 0.2s ease;
  cursor: pointer;
  
  &:hover {
    background: #f8fafc;
  }
`;

const Toast = styled(motion.div)`
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  padding: 1rem 1.5rem;
  border-radius: 0.75rem;
  background: #1e293b;
  color: white;
  font-size: 0.875rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  z-index: 50;
`;

/* 평소엔 눈에 안 띄고, **어긋났을 때만** 눈에 든다. 버전은 찾을 때만 보는 값이다. */
const VersionTag = styled.span`
  font-weight: ${p => (p.$state === 'mismatch' ? 700 : 400)};
  color: ${p => (p.$state === 'mismatch' ? '#b91c1c' : 'inherit')};
  cursor: help;
`;

const Footer = styled.footer`
  padding: 0 1rem 1.5rem 1rem;
  text-align: center;
  font-size: 0.75rem;
  color: #64748b;
`;

// ---- Tile Component -------------------------------------------------------
const TileWrapper = styled.div`
  position: relative;
  display: flex;
  width: 100%;
  height: 100%;
`;

const TileTooltip = styled.div`
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  padding: 0.55rem 0.85rem;
  background: rgba(15, 23, 42, 0.95);
  color: #f8fafc;
  font-size: 0.78rem;
  font-weight: 500;
  line-height: 1.5;
  border-radius: 0.5rem;
  width: max-content;
  max-width: 260px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.18s ease, visibility 0s linear 0.18s;
  z-index: 1000;
  white-space: normal;
  word-break: keep-all;

  &::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 6px solid transparent;
    border-top-color: rgba(15, 23, 42, 0.95);
  }

  ${TileWrapper}:hover & {
    opacity: 1;
    visibility: visible;
    transition: opacity 0.18s ease 0.15s, visibility 0s linear 0.15s;
  }
`;

const TileButton = styled(motion.button)`
  position: relative;
  overflow: hidden;
  border-radius: 1rem;
  color: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;
  border: 2px solid transparent;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 1.5rem;
  width: 100%;
  height: 100%;
  z-index: 1;
  
  &:hover {
    transform: scale(1.05);
    border: 2px solid rgba(255, 255, 255, 0.8);
    box-shadow: 
      0 0 30px rgba(255, 255, 255, 0.3),
      0 0 60px rgba(255, 255, 255, 0.2),
      0 8px 25px rgba(0, 0, 0, 0.2);
    z-index: 10;
  }
  
  &:active {
    transform: scale(1.02);
    transition: all 0.1s ease;
    z-index: 10;
  }
`;

const TileGradient = styled.div`
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.1) 0%, rgba(0, 0, 0, 0) 100%);
  transition: opacity 0.3s ease;
  
  ${TileButton}:hover & {
    background: linear-gradient(135deg, 
      rgba(255, 255, 255, 0.1) 0%, 
      rgba(255, 255, 255, 0.05) 50%,
      rgba(0, 0, 0, 0.1) 100%);
  }
`;

const TileBadge = styled.div`
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  padding: 0.125rem 0.375rem;
  font-size: 0.625rem;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.9);
  color: #374151;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  
  ${TileButton}:hover & {
    background: rgba(255, 255, 255, 1);
    transform: scale(1.1);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }
`;

const TileContent = styled.div`
  position: relative;
  z-index: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
`;

const TileTop = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  align-items: flex-start;
  transition: transform 0.3s ease;
  
  svg {
    transition: all 0.3s ease;
  }
  
  ${TileButton}:hover & {
    transform: translateY(-2px);
    
    svg {
      transform: scale(1.1);
      filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.6));
    }
  }
`;

const TileTitle = styled.div`
  font-weight: 600;
  line-height: 1.2;
  font-size: 1.1rem;
  text-align: left;
  margin-top: 0.5rem;
  color: white;
  transition: all 0.3s ease;
  
  ${TileButton}:hover & {
    text-shadow: 0 0 10px rgba(255, 255, 255, 0.8);
    transform: translateY(-1px);
  }
  
  @media (max-width: 768px) {
    font-size: 1rem;
  }
`;

const TileDescription = styled.div`
  font-size: 0.85rem;
  opacity: 0.95;
  text-align: left;
  line-height: 1.4;
  margin-top: auto;
  color: white;
  transition: all 0.3s ease;
  
  ${TileButton}:hover & {
    opacity: 1;
    text-shadow: 0 0 8px rgba(255, 255, 255, 0.6);
  }
  
  @media (max-width: 768px) {
    font-size: 0.75rem;
  }
`;

const TILE_COLORS = [
  "#4f46e5", "#0ea5e9", "#10b981", "#14b8a6",
  "#f59e0b", "#ef4444", "#374151", "#c026d3",
  "#06b6d4", // cyan - 전사 디지털 트윈 자원 관리용
];

// ─── 모듈 상태 그룹핑 ─────────────────────────────────────────────
// 각 모듈을 상태별로 분류. 여기에 없는 모듈은 자동으로 '기획 중'으로 분류됨.
//
// ⚠️ 이 표는 이제 **기본값일 뿐**이다. 정본은 서버(/api/portal/module-statuses)에
//    있고 우측 상단 「설정」에서 바꾼다. 예전에는 여기가 정본이라 상태 하나를
//    바꾸려면 프론트를 다시 빌드해 반입해야 했다 — 상태는 운영하며 자주 바뀌는
//    값이지 코드가 아니다.
const DEFAULT_STATUS_BY_ID = {
  // 운영 중
  'dx-kpi-management': 'operating',
  'engineering-hub': 'operating',
  'office-management': 'operating',
  'meeting-management': 'operating',
  // 개발 중
  'digital-twin-task-management': 'developing',
  'spdm-status': 'developing',
  'auto-document-verify': 'developing',
};

const STATUS_GROUPS = [
  { key: 'operating',  label: '운영 중', color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0' },
  { key: 'developing', label: '운영 준비', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
  { key: 'planning',   label: '기획 중', color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
];

// 호버 시 표시할 모듈별 상세 설명. 매핑된 모듈만 툴팁이 뜸.
const TILE_TOOLTIPS = {
  // 운영 중
  'dx-kpi-management':            '디지털 트윈 사업부별 KPI 이력 관리',
  'engineering-hub':              '전사 디지털 트윈 과제 정보 관리',
  'office-management':            '사무국 내 주간 보고 / 업무 컨택쳐 관리',
  'meeting-management':           '경영진 보고자료 확인 및 보고 계획 공유',
  // 운영 준비
  'spdm-status':                  'SPDM / NPLM 의 일정 및 이슈 공유',
  'digital-twin-task-management': '제조 시뮬레이션 관련 현황 관리',
  'auto-document-verify':         '문서 취합 시 내용 검증',
};

const SIMULATION_FEATURES = [
  // { 
  //   id: "simulation-tools", 
  //   name: "DX 부문 디지털 트윈 솔루션 맵", 
  //   desc: "시뮬레이션 툴/기술 정보 공유", 
  //   color: 0, 
  //   gridColumn: "span 1", 
  //   gridRow: "span 1",
  //   badge: "8개",
  //   icon: Cog,
  //   route: "/digital-twin-solution"
  // },
  // { 
  //   id: "self-simulation", 
  //   name: "디지털 트윈 인력/교육 운영", 
  //   desc: "시뮬레이션/플랫폼/AI 인력 현황", 
  //   color: 1, 
  //   gridColumn: "span 1", 
  //   gridRow: "span 1",
  //   badge: "BETA",
  //   icon: Play
  // },
  // {
  //   id: "organization-chart",
  //   name: "조직도",
  //   desc: "조직도 관리",
  //   color: 3,
  //   gridColumn: "span 1",
  //   gridRow: "span 1",
  //   icon: Users,
  //   route: "/organization-chart"
  // },
  // { 
  //   id: "company-projects", 
  //   name: "게시판", 
  //   desc: "커뮤니케이션 게시판", 
  //   color: 4, 
  //   gridColumn: "span 1", 
  //   gridRow: "span 1",
  //   badge: "24개",
  //   icon: Users
  // },
  // { 
  //   id: "system-level", 
  //   name: "인프라 현황", 
  //   desc: "SW/HW 인프라 현황", 
  //   color: 5, 
  //   gridColumn: "span 1", 
  //   gridRow: "span 1",
  //   icon: Network
  // },
  {
    id: "dx-kpi-management",
    name: "DX 부문 KPI 관리",
    desc: "DX 부문 KPI 관리",
    color: 3,
    gridColumn: "span 1",
    gridRow: "span 1",
    icon: TrendingUp,
    route: "/dx-kpi-management"
  },  
  {
    id: "engineering-hub",
    name: "디지털 트윈 과제 대시보드",
    desc: "과제 정보 취합",
    color: 6,
    gridColumn: "span 1",
    gridRow: "span 1",
    icon: Home,
    route: "/digital-twin-dashboard"
  },
  {
    id: "digital-twin-strategy",
    name: "디지털 트윈 전략 기획",
    desc: "연도별 전략 수립",
    color: 4,
    gridColumn: "span 1",
    gridRow: "span 1",
    icon: Compass,
    route: "/digital-twin-strategy",
    allowedRoles: ['admin', 'dt_office']  // 전략 산출물은 사무국/관리자 전용
  },
  {
    id: "survey",
    name: "설문",
    // ⚠️ 이름만 "설문"이면 설문을 **만드는** 곳으로 오해한다. 대부분의 사용자에게
    //    이 카드는 답하러 가는 곳이라 desc 로 그것을 못박는다.
    desc: "받은 설문에 응답합니다",
    color: 1,
    gridColumn: "span 1",
    gridRow: "span 1",
    icon: ClipboardList,
    route: "/survey"
    // allowedRoles 를 적지 않는다 = 전원 공개. 설문 응답은 전사 대상이고,
    // 만들기/집계는 같은 모듈 안에서 백엔드 권한(manager_required)이 가른다.
  },
  {
    id: "office-management",
    name: "사무국 운영",
    desc: "디지털 트윈 사무국 주간 업무",
    color: 0,
    gridColumn: "span 1",
    gridRow: "span 1",
    icon: BarChart3,
    route: "/office-management",
    allowedRoles: ['admin', 'dt_office']  // admin, dt_office만 접근 가능
  },
  {
    id: "dev-manufacturing-process",
    name: "데이터/프로세스 가시화",
    desc: "데이터/프로세스 관리",
    color: 4,
    gridColumn: "span 1",
    gridRow: "span 1",
    icon: Cog,
    route: "/dev-manufacturing-process"
  },
  {
    id: "meeting-management",
    name: "협의체/회의체/보고",
    desc: "협의체, 회의체, 보고 관리",
    color: 1,
    gridColumn: "span 1",
    gridRow: "span 1",
    icon: Users2,
    route: "/meeting-management",
    allowedRoles: ['admin', 'dt_office', 'manager']
  },
  {
    id: "collaboration-board",
    name: "협업 게시판",
    desc: "팀 간 협업 및 소통 게시판",
    color: 5,
    gridColumn: "span 1",
    gridRow: "span 1",
    icon: MessageSquare,
    route: "/collaboration-board"
  },
  {
    id: "company-material-council",
    name: "전사 물성 협의체",
    desc: "전사 물성 협의체 관리",
    color: 7,
    gridColumn: "span 1",
    gridRow: "span 1",
    icon: FlaskConical,
    route: "/company-material-council"
  },
  {
    id: "digital-twin-tech-level",
    name: "디지털 트윈 메가 과제 기획",
    desc: "메가 과제 기획 관리",
    color: 3,
    gridColumn: "span 1",
    gridRow: "span 1",
    icon: Share2,
    route: "/digital-twin-tech-level"
  },
  {
    id: "spdm-status",
    name: "플랫폼 현황",
    desc: "SPDM 현황 관리",
    color: 7,
    gridColumn: "span 1",
    gridRow: "span 1",
    icon: FileText,
    route: "/spdm-status"
  },
  {
    id: "digital-twin-reference",
    name: "개발 디지털 트윈 로드맵 정보",
    desc: "개발 디지털 트윈 로드맵 정보 관리",
    color: 8,
    gridColumn: "span 1",
    gridRow: "span 1",
    icon: Database,
    route: "/digital-twin-reference"
  },
  {
    id: "dev-dt-maturity",
    name: "디지털 트윈 성숙도",
    desc: "시험별 시뮬레이션 정확도·자동화·대체 수준",
    color: 8,
    gridColumn: "span 1",
    gridRow: "span 1",
    icon: Gauge,
    route: "/dev-dt-maturity"
  },
  {
    id: "digital-twin-task-management",
    name: "제조 디지털 트윈 과제 관리",
    desc: "제조 디지털 트윈 과제 관리",
    color: 2,
    gridColumn: "span 1",
    gridRow: "span 1",
    icon: Target,
    route: "/digital-twin-task-management"
  },
  {
    id: "digital-twin-sw-resource",
    name: "전사 디지털 트윈 S/W 자원 정보",
    desc: "디지털 트윈 S/W 자원 정보 관리",
    color: 8,
    gridColumn: "span 1",
    gridRow: "span 1",
    icon: Cpu,
    route: "/digital-twin-sw-resource"
  },
  {
    id: "digital-twin-investment",
    name: "디지털 트윈 투자 현황",
    desc: "디지털 트윈 투자 현황 관리",
    color: 0,
    gridColumn: "span 1",
    gridRow: "span 1",
    icon: Coins,
    route: "/digital-twin-investment"
  },
  {
    id: "digital-twin-intel",
    name: "디지털 트윈 기술정보",
    desc: "업계 소식과 기술 레이더",
    color: 4,
    gridColumn: "span 1",
    gridRow: "span 1",
    icon: Radar,
    route: "/digital-twin-intel"
  },
  {
    id: "element-tech",
    name: "지식 그래프 모듈",
    desc: "데이터 계층화/시각화",
    color: 2,
    gridColumn: "span 1",
    gridRow: "span 1",
    icon: Layers,
    route: "/dx-work-process"
  },  
  {
    id: "auto-document",
    name: "문서 자동 작성",
    desc: "문서 자동 작성 및 관리",
    color: 6,
    gridColumn: "span 1",
    gridRow: "span 1",
    icon: FileText,
    route: "/auto-document",
    allowedRoles: ['admin']
  },
  {
    id: "auto-document-verify",
    name: "문서 자동 검증",
    desc: "문서 자동 검증",
    color: 6,
    gridColumn: "span 1",
    gridRow: "span 1",
    icon: ShieldCheck,
    route: "/auto-document-verify",
    allowedRoles: ['admin']
  },
];

function Tile({ item, onOpen, tooltip }) {
  const color = TILE_COLORS[item.color % TILE_COLORS.length];
  const IconComponent = item.icon || Zap;

  return (
    <TileWrapper>
      <TileButton
        onClick={() => onOpen?.(item)}
        style={{
          backgroundColor: color,
          gridColumn: item.gridColumn,
          gridRow: item.gridRow,
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 1.02 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <TileGradient />
        {item.badge && <TileBadge>{item.badge}</TileBadge>}
        <TileContent>
          <TileTop>
            <IconComponent size={28} style={{ opacity: 0.95, color: 'white' }} />
            <TileTitle>{item.name}</TileTitle>
          </TileTop>
          <TileDescription>{item.desc}</TileDescription>
        </TileContent>
      </TileButton>
      {tooltip && <TileTooltip>{tooltip}</TileTooltip>}
    </TileWrapper>
  );
}


// ---- Main Component -------------------------------------------------------
const MainPage = () => {
  const navigate = useNavigate();
  const { user, logout, token } = useAuth();
  const [toastMsg, setToastMsg] = useState(null);
  const [role, setRole] = useState("All");
  const [q, setQ] = useState("");
  const [stats, setStats] = useState({
    projectCount: 0,
    graphCount: 0,
    diagramCount: 0
  });
  const [moduleUpdates, setModuleUpdates] = useState([]);

  // 공지사항 관련 상태
  const [notices, setNotices] = useState([]);
  const [allNotices, setAllNotices] = useState([]);
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingNotice, setEditingNotice] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    is_active: true,
    priority: 0
  });

  // 관리자 여부 확인
  const isAdmin = user?.is_admin || user?.role === 'admin';

  // 통계 데이터 로드
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/auth/stats');
        const result = await response.json();
        if (result.success && result.data) {
          setStats(result.data);
        }
      } catch (error) {
        console.error('통계 조회 실패:', error);
      }
    };
    fetchStats();
  }, []);

  // 모듈 업데이트 시간 로드
  useEffect(() => {
    const fetchModuleUpdates = async () => {
      try {
        const response = await fetch('/api/auth/module-updates');
        const result = await response.json();
        if (result.success && result.data) {
          setModuleUpdates(result.data);
        }
      } catch (error) {
        console.error('모듈 업데이트 조회 실패:', error);
      }
    };
    fetchModuleUpdates();
  }, []);

  // 공지사항 로드
  useEffect(() => {
    fetchNotices();
  }, []);

  const fetchNotices = async () => {
    try {
      const response = await fetch('/api/auth/notices');
      const result = await response.json();
      if (result.success && result.data) {
        setNotices(result.data);
      }
    } catch (error) {
      console.error('공지사항 조회 실패:', error);
    }
  };

  // 모든 공지사항 로드 (관리자용)
  const fetchAllNotices = async () => {
    try {
      const response = await fetch('/api/auth/notices/all', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      if (result.success && result.data) {
        setAllNotices(result.data);
      }
    } catch (error) {
      console.error('공지사항 전체 조회 실패:', error);
    }
  };

  // 공지사항 상세 조회
  const handleNoticeClick = async (noticeId) => {
    try {
      const response = await fetch(`/api/auth/notices/${noticeId}`);
      const result = await response.json();
      if (result.success && result.data) {
        setSelectedNotice(result.data);
        setShowDetailModal(true);
      }
    } catch (error) {
      console.error('공지사항 상세 조회 실패:', error);
    }
  };

  // 관리 모달 열기
  const handleOpenManageModal = () => {
    fetchAllNotices();
    setShowManageModal(true);
  };

  // 새 공지사항 작성
  const handleAddNotice = () => {
    setEditingNotice(null);
    setFormData({
      title: '',
      content: '',
      is_active: true,
      priority: 0
    });
    setShowEditModal(true);
  };

  // 공지사항 수정
  const handleEditNotice = (notice) => {
    setEditingNotice(notice);
    setFormData({
      title: notice.title,
      content: notice.content,
      is_active: notice.is_active,
      priority: notice.priority
    });
    setShowEditModal(true);
  };

  // 공지사항 저장
  const handleSaveNotice = async () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      setToastMsg('제목과 내용을 입력해주세요.');
      setTimeout(() => setToastMsg(null), 2000);
      return;
    }

    try {
      const url = editingNotice
        ? `/api/auth/notices/${editingNotice.id}`
        : '/api/auth/notices';
      const method = editingNotice ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();
      if (result.success) {
        setToastMsg(editingNotice ? '공지사항이 수정되었습니다.' : '공지사항이 등록되었습니다.');
        setTimeout(() => setToastMsg(null), 2000);
        setShowEditModal(false);
        fetchAllNotices();
        fetchNotices();
      } else {
        setToastMsg(result.error || '저장 실패');
        setTimeout(() => setToastMsg(null), 2000);
      }
    } catch (error) {
      console.error('공지사항 저장 실패:', error);
      setToastMsg('저장 중 오류가 발생했습니다.');
      setTimeout(() => setToastMsg(null), 2000);
    }
  };

  // 공지사항 삭제
  const handleDeleteNotice = async (noticeId) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/auth/notices/${noticeId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();
      if (result.success) {
        setToastMsg('공지사항이 삭제되었습니다.');
        setTimeout(() => setToastMsg(null), 2000);
        fetchAllNotices();
        fetchNotices();
      } else {
        setToastMsg(result.error || '삭제 실패');
        setTimeout(() => setToastMsg(null), 2000);
      }
    } catch (error) {
      console.error('공지사항 삭제 실패:', error);
      setToastMsg('삭제 중 오류가 발생했습니다.');
      setTimeout(() => setToastMsg(null), 2000);
    }
  };

  // 날짜 포맷팅
  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatShortDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul',
      month: 'short',
      day: 'numeric'
    });
  };

  // 날짜 포맷팅 함수
  const formatUpdateTime = (isoString) => {
    if (!isoString) return '업데이트 없음';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;

    return date.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul',
      month: 'short',
      day: 'numeric'
    });
  };

  /*
    모듈 상태 — **서버가 정본, 위의 표는 기본값.**
    못 읽어도 화면이 죽지 않게 기본값으로 시작한다(첫 화면이라 특히 중요하다).
  */
  const [statusById, setStatusById] = useState(DEFAULT_STATUS_BY_ID);
  // 모듈 차례. 빈 배열이면 코드에 적힌 원래 차례를 그대로 쓴다.
  const [moduleOrder, setModuleOrder] = useState([]);
  /*
    지금 도는 것이 어느 릴리스인가. **화면과 서버를 함께** 본다 —
    반출 체크리스트가 「백엔드ㆍ프론트를 함께 올린다. 구 프론트 + 신 백엔드는
    저장이 400 이 된다」고 적어 두었는데, 어긋났는지를 볼 길이 없으면 그 400 의
    원인을 한참 찾게 된다.

    ⚠️ 못 받아도 화면은 그대로 돈다. 옛 서버에는 이 엔드포인트가 없고, 그때는
       **어긋남이 아니라 「모름」**이다 — 거짓 경고를 한 번 보면 그다음부터는
       진짜 경고도 안 본다.
  */
  const [serverVersion, setServerVersion] = useState(null);
  useEffect(() => {
    let alive = true;
    fetch('/api/version')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive) setServerVersion(d?.data?.version ?? null); })
      .catch(() => { if (alive) setServerVersion(null); });
    return () => { alive = false; };
  }, []);

  const versionLabel = versionText(APP_VERSION, serverVersion);
  const versionInfo = {
    state: versionState(APP_VERSION, serverVersion),
    title: (versionState(APP_VERSION, serverVersion) === 'mismatch'
      ? '화면과 서버의 버전이 다릅니다. 둘을 함께 올려야 합니다 — 구 프론트 + 신 백엔드는 저장이 실패합니다.'
      : `포털 버전 v${APP_VERSION}`),
  };

  const [showModuleSettings, setShowModuleSettings] = useState(false);
  const [canEditModules, setCanEditModules] = useState(false);

  useEffect(() => {
    fetchModuleStatuses()
      .then(d => {
        setCanEditModules(!!d.canEdit);
        if (d.statuses && Object.keys(d.statuses).length) {
          setStatusById({ ...DEFAULT_STATUS_BY_ID, ...d.statuses });
        }
        if (Array.isArray(d.order) && d.order.length) setModuleOrder(d.order);
      })
      .catch(() => { /* 못 읽으면 기본값 그대로 — 첫 화면을 막지 않는다 */ });
  }, []);

  /*
    설문 미응답 건수 — 「설문」 카드 배지용.

    ⚠️ 배지는 **부가 정보다.** 못 읽으면 0으로 두고 배지를 안 그릴 뿐,
       홈 화면은 그대로 뜬다(위 모듈 상태와 같은 원칙). 그래서 실패를 삼키고
       toast 도 띄우지 않는다 — 첫 화면에서 사용자가 할 수 있는 일이 없다.
  */
  const [pendingSurveys, setPendingSurveys] = useState(0);

  useEffect(() => {
    if (!token) return;          // 서버가 jwt_required 라 토큰 없이 부를 이유가 없다
    let alive = true;            // 응답 전에 화면을 뜨면 setState 를 버린다
    const fetchPendingSurveys = async () => {
      try {
        const response = await fetch('/api/surveys/mine/count', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const result = await response.json();
        if (alive && result.success && result.data) {
          setPendingSurveys(result.data.pending || 0);
        }
      } catch (error) {
        console.error('설문 미응답 건수 조회 실패:', error);  // 배지만 안 뜬다
      }
    };
    fetchPendingSurveys();
    return () => { alive = false; };
  }, [token]);

  const handleLogout = () => {
    if (window.confirm('로그아웃 하시겠습니까?')) {
      logout();
      navigate('/login');
    }
  };

  /**
   * 설정에서 정한 차례대로 늘어놓은 모듈.
   *
   * ⚠️ 차례에 없는 모듈은 **뒤로** 붙인다(코드에 적힌 원래 차례 그대로).
   *    새 모듈을 만들었는데 설정을 안 고쳤다고 사라지면 안 된다.
   */
  const orderedFeatures = useMemo(() => {
    if (!moduleOrder.length) return SIMULATION_FEATURES;
    const rank = new Map(moduleOrder.map((id, i) => [id, i]));
    return [...SIMULATION_FEATURES].sort((a, b) =>
      (rank.has(a.id) ? rank.get(a.id) : Infinity)
      - (rank.has(b.id) ? rank.get(b.id) : Infinity));
  }, [moduleOrder]);

  /**
   * 서버에서 온 값을 배지로 얹은 모듈 목록.
   *
   * `SIMULATION_FEATURES` 는 모듈 최상위 상수라 그 안에는 못 넣는다. 그리고
   * **원본을 고쳐 쓰지 않는다** — 같은 배열이 `ModuleStatusModal` 로 그대로
   * 넘어가므로 mutate 하면 거기까지 오염된다. 사본에만 얹는다.
   *
   * 0건이면 `badge` 를 아예 안 단다 — Tile 이 `item.badge &&` 로 그리므로
   * "0건" 이라는 빈 배지가 붙는 일이 없다.
   */
  const featuresWithBadge = useMemo(() => {
    if (!pendingSurveys) return orderedFeatures;
    return orderedFeatures.map((f) =>
      f.id === 'survey' ? { ...f, badge: `${pendingSurveys}건` } : f);
  }, [orderedFeatures, pendingSurveys]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    // '숨김' 은 목록에서 아예 뺀다 — 묶음이 없어 안 그려지는 게 아니라, 없는 것으로 둔다.
    return featuresWithBadge.filter((x) => statusById[x.id] !== 'hidden').filter((x) =>
      (!term || x.name.toLowerCase().includes(term) || x.desc.toLowerCase().includes(term)) &&
      (role === "All" ||
       (role === "Engineer" && ["self-simulation","element-tech","ai-hub","simulation-tools"].includes(x.id)) ||
       (role === "Manager" && ["company-projects","system-level","kpi-dashboard","engineering-hub"].includes(x.id)))
    );
    // 🐞 `statusById` 를 빠뜨렸었다. 본문에서 읽는 값을 의존성에 안 적으면 **옛 값이
    //    닫혀 버려**, 설정에서 상태를 바꿔도 화면이 그대로였다(2026-08-10).
    //    `featuresWithBadge` 도 같은 이유로 반드시 여기 있어야 한다 — 빠뜨리면
    //    설문 건수가 와도 배지가 안 붙는다.
  }, [q, role, statusById, featuresWithBadge]);

  // 상태별 그룹핑 (검색/역할 필터 적용 후)
  const groupedFiltered = useMemo(() => {
    const out = { operating: [], developing: [], planning: [] };
    filtered.forEach(f => {
      const status = statusById[f.id] || 'planning';
      (out[status] || out.planning).push(f);
    });
    return out;
  }, [filtered, statusById]);   // 묶음도 statusById 로 정한다 — 같은 이유로 빠뜨리면 안 된다

  const onOpen = (feature) => {
    // 권한 체크
    if (feature.allowedRoles && feature.allowedRoles.length > 0) {
      const userRole = user?.role || 'user';
      const isAdmin = user?.is_admin;

      if (!isAdmin && !feature.allowedRoles.includes(userRole)) {
        setToastMsg('⚠️ 접근 권한이 없습니다.');
        setTimeout(() => setToastMsg(null), 2500);
        return;
      }
    }

    if (feature.route) {
      navigate(feature.route);
    } else {
      setToastMsg(`➡️ "${feature.name}" 모듈로 이동 (라우팅 연동 예정)`);
      setTimeout(() => setToastMsg(null), 2300);
    }
  };

  return (
    <Container>
      {/* Header */}
      <Header>
        <HeaderContent>
          <LogoSection
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <LogoIcon>
              <Target size={20} />
            </LogoIcon>
            <LogoText>
              <h1>디지털 트윈 포털</h1>
              <p>전사 통합 정보 공유 포탈</p>
            </LogoText>
          </LogoSection>
          
          <HeaderControls
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <SearchContainer>
              <Search size={16} color="#94a3b8" />
              <SearchInput
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="검색: 시뮬레이션/AI/과제"
              />
            </SearchContainer>
            <RoleSelect
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option>All</option>
              <option>Engineer</option>
              <option>Manager</option>
            </RoleSelect>
            {/* 모듈 상태 설정 — 관리자에게만 보인다. 서버가 canEdit 으로 알려 주므로
                눌러 본 다음에 403 을 만나게 하지 않는다. */}
            {canEditModules && (
              <SettingsButton
                onClick={() => setShowModuleSettings(true)}
                title="메인 화면에 어떤 모듈을 어느 묶음으로 보일지 정합니다"
              >
                <Settings size={14} />
                설정
              </SettingsButton>
            )}
            <UserInfoBox onClick={() => navigate('/account-management')}>
              <UserIcon size={14} />
              <span>{user?.name || user?.username}</span>
            </UserInfoBox>
            <LogoutButton onClick={handleLogout}>
              <LogOut size={14} />
              로그아웃
            </LogoutButton>
          </HeaderControls>
        </HeaderContent>
      </Header>

      {/* Body */}
      <Main>
        <MainContent>
          {/* Metro Grid — 상태별 그룹 */}
          <MetroGrid>
            {STATUS_GROUPS.map((grp, gIdx) => {
              const items = groupedFiltered[grp.key] || [];
              if (items.length === 0 && q.trim()) return null; // 검색 중일 때 빈 그룹은 숨김
              return (
                <StatusGroupSection key={grp.key}>
                  <StatusGroupHeader>
                    <StatusBadge $color={grp.color} $bg={grp.bg} $border={grp.border}>
                      {grp.label}
                    </StatusBadge>
                    <StatusCount>{items.length}개</StatusCount>
                  </StatusGroupHeader>
                  {items.length > 0 ? (
                    <TileGrid
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5, delay: 0.2 + gIdx * 0.1 }}
                    >
                      {items.map((item, index) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.04 }}
                          style={{
                            gridColumn: item.gridColumn,
                            gridRow: item.gridRow,
                            display: 'flex'
                          }}
                        >
                          <Tile item={item} onOpen={onOpen} tooltip={TILE_TOOLTIPS[item.id]} />
                        </motion.div>
                      ))}
                    </TileGrid>
                  ) : (
                    <StatusEmpty>해당 모듈이 없습니다.</StatusEmpty>
                  )}
                </StatusGroupSection>
              );
            })}
          </MetroGrid>

          {/* Sidebar */}
          <Sidebar>
            {/* Announcements */}
            <Widget
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <AnnouncementHeader>
                <WidgetTitle style={{ marginBottom: 0 }}>공지사항</WidgetTitle>
                {isAdmin && (
                  <ManageButton onClick={handleOpenManageModal}>
                    <Settings size={12} />
                    관리
                  </ManageButton>
                )}
              </AnnouncementHeader>
              <AnnouncementList>
                {notices.length > 0 ? (
                  notices.map((notice) => (
                    <AnnouncementItem
                      key={notice.id}
                      onClick={() => handleNoticeClick(notice.id)}
                    >
                      <div className="title">{notice.title}</div>
                      <div className="date">{formatShortDate(notice.created_at)}</div>
                    </AnnouncementItem>
                  ))
                ) : (
                  <NoAnnouncement>등록된 공지사항이 없습니다.</NoAnnouncement>
                )}
              </AnnouncementList>
            </Widget>

            {/* KPI Cards */}
            <KPIGrid>
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
              >
                <KPICard>
                  <div className="label">디지털 트윈 과제 수</div>
                  <div className="value">{stats.projectCount.toLocaleString()}</div>
                </KPICard>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.6 }}
              >
                <KPICard>
                  <div className="label">지식 그래프 수</div>
                  <div className="value">{stats.graphCount.toLocaleString()}</div>
                </KPICard>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.7 }}
              >
                <KPICard>
                  <div className="label">데이터/프로세스 정의 수</div>
                  <div className="value">{stats.diagramCount.toLocaleString()}</div>
                </KPICard>
              </motion.div>
            </KPIGrid>

            {/* Recent Updates */}
            <Widget
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 1.0 }}
            >
              <WidgetTitle>최근 업데이트</WidgetTitle>
              <RecentList>
                {moduleUpdates.length > 0 ? (
                  moduleUpdates.map((module) => (
                    <RecentItem
                      key={module.id}
                      onClick={() => navigate(`/${module.id}`)}
                    >
                      <div className="title">{module.name}</div>
                      <div className="tag">{formatUpdateTime(module.updated_at)}</div>
                    </RecentItem>
                  ))
                ) : (
                  <RecentItem>
                    <div className="title">업데이트 정보 없음</div>
                    <div className="tag">-</div>
                  </RecentItem>
                )}
              </RecentList>
            </Widget>

            {/* Module Test */}
            <Widget
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 1.1 }}
            >
              <WidgetTitle>모듈 테스트</WidgetTitle>
              <QuickActions>
                <QuickButton onClick={() => navigate('/engineeringhub')}>
                  통합 도구 허브
                </QuickButton>
              </QuickActions>
            </Widget>
          </Sidebar>
        </MainContent>
      </Main>

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <Toast
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            {toastMsg}
          </Toast>
        )}
      </AnimatePresence>

      {/* 공지사항 상세 모달 */}
      <AnimatePresence>
        {showDetailModal && selectedNotice && (
          <ModalOverlay
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowDetailModal(false)}
          >
            <ModalContent
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <ModalHeader>
                <h3>{selectedNotice.title}</h3>
                <ModalCloseButton onClick={() => setShowDetailModal(false)}>
                  <X size={18} />
                </ModalCloseButton>
              </ModalHeader>
              <ModalBody>
                <div className="meta">
                  {selectedNotice.author_name && `작성자: ${selectedNotice.author_name} | `}
                  {formatDate(selectedNotice.created_at)}
                </div>
                <div className="content">{selectedNotice.content}</div>
              </ModalBody>
            </ModalContent>
          </ModalOverlay>
        )}
      </AnimatePresence>

      {/* 공지사항 관리 모달 */}
      <AnimatePresence>
        {showManageModal && (
          <ModalOverlay
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowManageModal(false)}
          >
            <ManageModalContent
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <ModalHeader>
                <h3>공지사항 관리</h3>
                <ModalCloseButton onClick={() => setShowManageModal(false)}>
                  <X size={18} />
                </ModalCloseButton>
              </ModalHeader>
              <NoticeListContainer>
                {allNotices.map((notice) => (
                  <NoticeListItem key={notice.id}>
                    <div className="info">
                      <div className="title">{notice.title}</div>
                      <div className="meta">
                        {formatShortDate(notice.created_at)}
                        {notice.author_name && ` | ${notice.author_name}`}
                      </div>
                    </div>
                    <span className={`status ${notice.is_active ? 'active' : 'inactive'}`}>
                      {notice.is_active ? '활성' : '비활성'}
                    </span>
                    <div className="actions">
                      <ActionButton onClick={() => handleEditNotice(notice)}>
                        <Edit2 size={14} />
                      </ActionButton>
                      <ActionButton className="delete" onClick={() => handleDeleteNotice(notice.id)}>
                        <Trash2 size={14} />
                      </ActionButton>
                    </div>
                  </NoticeListItem>
                ))}
                <div style={{ padding: '0.75rem 1rem' }}>
                  <AddNoticeButton onClick={handleAddNotice}>
                    <Plus size={16} />
                    새 공지사항 추가
                  </AddNoticeButton>
                </div>
              </NoticeListContainer>
            </ManageModalContent>
          </ModalOverlay>
        )}
      </AnimatePresence>

      {/* 공지사항 작성/수정 모달 */}
      <AnimatePresence>
        {showEditModal && (
          <ModalOverlay
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowEditModal(false)}
          >
            <ModalContent
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <ModalHeader>
                <h3>{editingNotice ? '공지사항 수정' : '새 공지사항'}</h3>
                <ModalCloseButton onClick={() => setShowEditModal(false)}>
                  <X size={18} />
                </ModalCloseButton>
              </ModalHeader>
              <ModalBody>
                <FormGroup>
                  <label>제목</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="공지사항 제목을 입력하세요"
                  />
                </FormGroup>
                <FormGroup>
                  <label>내용</label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="공지사항 내용을 입력하세요"
                  />
                </FormGroup>
                <FormGroup>
                  <label>우선순위 (높을수록 상위 노출)</label>
                  <input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                    min="0"
                    max="100"
                  />
                </FormGroup>
                <CheckboxGroup>
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                  <label htmlFor="is_active">활성화 (체크 해제 시 메인 페이지에 표시되지 않음)</label>
                </CheckboxGroup>
              </ModalBody>
              <ModalFooter>
                <SubmitButton className="secondary" onClick={() => setShowEditModal(false)}>
                  취소
                </SubmitButton>
                <SubmitButton className="primary" onClick={handleSaveNotice}>
                  {editingNotice ? '수정' : '등록'}
                </SubmitButton>
              </ModalFooter>
            </ModalContent>
          </ModalOverlay>
        )}
      </AnimatePresence>

      <Footer>
        © 2025 디지털 트윈 포털
        {versionLabel && (
          <>
            {' · '}
            <VersionTag $state={versionInfo.state} title={versionInfo.title}>
              {versionInfo.state === 'mismatch' && '⚠ '}
              {versionLabel}
            </VersionTag>
          </>
        )}
      </Footer>

      {/* 2026-08-01 AiChatSidebar 를 내렸다 — DT 대시보드의 AI 에이전트로 창구를 하나로
          모으는 중이다. 진입점만 없앴고 컴포넌트·백엔드는 그대로다.
          <AiChatSidebar pageName="main" /> */}

      <ModuleStatusModal
        open={showModuleSettings}
        onClose={() => setShowModuleSettings(false)}
        modules={SIMULATION_FEATURES}
        statusGroups={STATUS_GROUPS}
        defaultStatusById={DEFAULT_STATUS_BY_ID}
        /* 저장하면 **바로 반영한다** — 다시 읽어 오려고 새로고침하게 두지 않는다 */
        onSaved={(next, nextOrder) => {
          setStatusById({ ...DEFAULT_STATUS_BY_ID, ...next });
          setModuleOrder(nextOrder || []);
        }}
      />
    </Container>
  );
};

export default MainPage;