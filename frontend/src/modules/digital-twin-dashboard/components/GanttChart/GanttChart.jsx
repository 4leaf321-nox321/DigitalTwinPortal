import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, User, Building, Edit, Trash2, CheckSquare, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import GanttFilters from './components/GanttFilters';
import EmptyStateGuide from './components/EmptyStateGuide';
import { compareProjects } from '../../utils/divisionOrder';
// 진행률의 0 과 미입력은 다른 뜻이다 (levelValue.js 참조).
import { percentText } from '../../utils/levelValue';

// 검색어 하이라이트용 컴포넌트
const Highlight = styled.mark`
  background-color: #fef08a;
  color: #854d0e;
  font-weight: 600;
  padding: 0.125rem 0;
  border-radius: 0.125rem;
`;

const GanttContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
  border-radius: 1rem;
  overflow: visible;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  position: relative;
`;

const GanttHeader = styled.div`
  background: linear-gradient(135deg, #374151 0%, #1f2937 100%);
  color: white;
  padding: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  flex-wrap: wrap;
  gap: 1rem;
  overflow: visible;
  position: relative;
  z-index: 100;
  
  .title {
    font-size: 1.25rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }
  
  .header-controls {
    display: flex;
    align-items: center;
    gap: 2rem;
    flex-wrap: wrap;
  }
  
  .year-selector {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .year-nav {
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 0.5rem;
    color: white;
    width: 2.5rem;
    height: 2.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 1.25rem;
    font-weight: bold;
    
    &:hover {
      background: rgba(255, 255, 255, 0.4);
      border-color: rgba(255, 255, 255, 0.5);
      transform: scale(1.05);
    }
    
    &:active {
      transform: scale(0.95);
    }
  }
  
  .current-year {
    font-size: 1.125rem;
    font-weight: 600;
    min-width: 4rem;
    text-align: center;
  }

  .collapse-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 0.5rem;
    color: white;
    padding: 0.5rem 0.85rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;

    &:hover {
      background: rgba(255, 255, 255, 0.3);
      border-color: rgba(255, 255, 255, 0.5);
    }

    &:active {
      transform: scale(0.97);
    }
  }
`;

const GanttContent = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow-y: auto;
  position: relative;
  z-index: 1;
  max-height: calc(100vh - 200px);
  width: 100%;
`;

const HeaderRow = styled.div`
  display: flex;
  position: sticky;
  top: 0;
  z-index: 50;
  background: #374151;
  color: white;
  font-weight: 600;
  font-size: 0.875rem;
  border-bottom: 1px solid #4b5563;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const HeaderTaskSection = styled.div`
  width: calc(67% - 1px);
  background: #374151;
  border-right: 2px solid #4b5563;
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  min-width: 600px;
  box-sizing: border-box;
  flex-shrink: 0;

  .division-header {
    flex: 0.27;
    min-width: 0;
    text-align: center;
  }

  /* 과제 내용 ↔ 성과 폭 — **본문(.task-info/.performance-section)과 반드시 같은 값**이라야
     머리글과 칸이 어긋나지 않는다. 둘의 합(5.36)은 건드리지 말 것 —
     기본 정보·진행 상태 칸과 우측 간트 눈금 위치가 그 합에 물려 있다.
     ⚠️ 이 주석은 템플릿 리터럴 안이다 — 백틱을 쓰지 말 것(문자열이 끊긴다). */
  .task-header {
    flex: 3.36;
    min-width: 0;
    border-left: 1px solid #6b7280;
    padding-left: 1rem;
  }

  .performance-header {
    flex: 2;
    min-width: 0;
    text-align: center;
    border-left: 1px solid #6b7280;
    padding-left: 1rem;
  }

  .status-header {
    flex: 0.27;
    min-width: 0;
    text-align: center;
    border-left: 1px solid #6b7280;
    padding-left: 1rem;
  }
`;

/**
 * 접기 모드 전용 헤더 — CompactTaskItem과 동일한 grid template으로 픽셀 단위 정렬
 * 좌측 4px 보더(투명) 자리까지 padding-left에 더해 정확한 정렬 유지
 */
const COMPACT_GRID_COLUMNS = '35% 1fr 7.5rem 60px';

const CompactHeaderTaskSection = styled.div`
  width: calc(67% - 1px);
  background: #374151;
  border-right: 2px solid #4b5563;
  /* 행의 padding(0.5rem 0.75rem) + 좌측 보더(4px) 만큼 맞춤 */
  padding: 0.6rem 0.75rem 0.6rem calc(0.75rem + 4px);
  display: grid;
  grid-template-columns: ${COMPACT_GRID_COLUMNS};
  column-gap: 0.75rem;
  align-items: center;
  min-width: 600px;
  box-sizing: border-box;
  flex-shrink: 0;
  font-size: 0.8rem;

  > div { min-width: 0; }

  .col-info { text-align: left; }

  .col-name {
    text-align: left;
    border-left: 1px solid #6b7280;
    padding-left: 0.75rem;
  }

  .col-status {
    text-align: center;
    border-left: 1px solid #6b7280;
    padding-left: 0.75rem;
  }
`;

const HeaderChartSection = styled.div`
  width: calc(33% + 1px);
  display: flex;
  background: #374151;
  min-width: 400px;
  box-sizing: border-box;
  flex-shrink: 0;
  
  .month-cell {
    flex: 1;
    padding: 1rem 0.5rem;
    text-align: center;
    font-weight: 600;
    font-size: 0.875rem;
    border-right: 1px solid #4b5563;
    min-width: 0;
    box-sizing: border-box;
    
    &:last-child {
      border-right: none;
    }
  }
`;

const DataRow = styled.div`
  display: flex;
  border-bottom: 1px solid #e5e7eb;
  background: white;
  min-height: auto;
  align-items: flex-start;
  
  &:hover {
    background: #f9fafb;
  }
`;

const TaskSection = styled.div`
  width: calc(67% - 1px);
  background: #f8fafc;
  border-right: 2px solid #e2e8f0;
  display: flex;
  min-width: 600px;
  box-sizing: border-box;
  flex-shrink: 0;
`;

const ChartSection = styled.div`
  width: calc(33% + 1px);
  display: flex;
  position: relative;
  min-width: 400px;
  box-sizing: border-box;
  flex-shrink: 0;
  align-items: center;
  align-self: stretch;
  
  .gantt-cell {
    width: 100%;
    position: relative;
    display: flex;
    align-items: center;
    box-sizing: border-box;
    height: 100%;
  }
`;

const TaskItem = styled(motion.div)`
  padding: 1rem;
  /* 사업부 내 공개 과제는 미묘한 슬레이트 톤 + 좌측 보더로 식별 */
  background: ${props => props.$isBuOnly ? '#f8fafc' : 'white'};
  border-left: 4px solid ${props => props.$isBuOnly ? '#64748b' : 'transparent'};
  transition: background 0.2s ease;
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  position: relative;
  width: 100%;
  box-sizing: border-box;
  height: auto;
  min-height: auto;

  &:hover {
    background: ${props => props.$isBuOnly ? '#e2e8f0' : '#f3f4f6'};

    .action-buttons {
      opacity: 1;
      pointer-events: auto;
    }
  }
  
  .division-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    flex: 0.27;
    min-width: 0;
    box-sizing: border-box;
    gap: 0.5rem;
    padding: 0.5rem 0;
  }
  
  .task-info {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: flex-start;
    gap: 0.75rem;
    width: 100%;
    max-width: 100%;
    overflow: hidden;
    /* 머리글 .task-header 와 같은 값을 쓴다 — 한쪽만 고치면 칸이 어긋난다 */
    flex: 3.36;
    min-width: 0;
    box-sizing: border-box;
    border-left: 1px solid #e5e7eb;
    padding: 1rem;
  }

  /*
    성과 칸 — 카드를 **2열**로 깐다(2026-08-08). 성과가 여럿인 과제에서 한 줄에
    하나씩 쌓이면 행이 세로로 한없이 길어져 우측 간트 막대와 눈으로 짝지을 수 없었다.
    폭은 머리글 .performance-header 와 같은 값이라야 한다.
    좁은 화면에서는 두 열이 다 뭉개지므로 1열로 되돌린다.
  */
  .performance-section {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-content: flex-start;
    gap: 0.75rem;
    border-left: 1px solid #e5e7eb;
    padding: 1rem;
    flex: 2;
    min-width: 0;
    box-sizing: border-box;
    height: auto;
    min-height: auto;
    overflow: visible;

    @media (max-width: 1280px) {
      grid-template-columns: 1fr;
    }
  }
  
  .status-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    flex: 0.27;
    min-width: 0;
    box-sizing: border-box;
    border-left: 1px solid #e5e7eb;
    padding-left: 1rem;
  }
  
  .task-title {
    font-weight: 600;
    font-size: 1rem;
    color: #1f2937;
    margin-bottom: 0.5rem;
    line-height: 1.4;
    word-break: keep-all;
    overflow-wrap: break-word;
    width: 100%;
    max-width: 100%;
  }
  
  .task-category {
    display: inline-flex;
    background: #10b981;
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    font-weight: 500;
    font-size: 0.75rem;
    margin-bottom: 0.75rem;
  }
  
  .task-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: #6b7280;
    margin-bottom: 0.25rem;
    align-items: center;
  }
  
  .department-list, .assignee-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    align-items: center;
    max-width: 100%;
  }
  
  .department-tag, .assignee-tag {
    background: #e0f2fe;
    color: #0369a1;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-size: 0.625rem;
    font-weight: 500;
    border: 1px solid #bae6fd;
    white-space: nowrap;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 0;
    cursor: default;
    transition: all 0.2s ease;
    
    &:hover {
      background: #0369a1;
      color: white;
      border-color: #0284c7;
      transform: translateY(-1px);
      box-shadow: 0 2px 4px rgba(3, 105, 161, 0.3);
    }
  }
  
  .assignee-tag {
    background: #f0f9ff;
    color: #0c4a6e;
    border-color: #7dd3fc;
    
    &:hover {
      background: #0c4a6e;
      color: white;
      border-color: #0369a1;
      box-shadow: 0 2px 4px rgba(12, 74, 110, 0.3);
    }
  }
  
  .action-buttons {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    opacity: 0;
    pointer-events: none;
    transition: all 0.2s ease;
    position: absolute;
    right: 0.5rem;
    top: 0.5rem;
    z-index: 10;
  }
  
  .action-btn {
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    
    &:hover {
      transform: scale(1.1);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    }
    
    &.edit-btn {
      color: #f59e0b;
      border-color: #fbbf24;
      
      &:hover {
        background: #f59e0b;
        color: white;
        border-color: #d97706;
      }
    }
    
    &.delete-btn {
      color: #ef4444;
      border-color: #f87171;
      
      &:hover {
        background: #ef4444;
        color: white;
        border-color: #dc2626;
      }
    }
  }
  
  .department-info, .assignee-info {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: #374151;
  }
  
  .division-badge {
    background: #06b6d4;
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-weight: 500;
    font-size: 0.75rem;
    text-align: center;
    white-space: nowrap;
  }
  
  .process-badge {
    background: #3b82f6;
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-weight: 500;
    font-size: 0.75rem;
    text-align: center;
    white-space: nowrap;
  }

  .domain-badge {
    background: #8b5cf6;
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-weight: 500;
    font-size: 0.75rem;
    text-align: center;
    white-space: nowrap;
  }

  .poc-badge {
    background: #f59e0b;
    color: white;
    padding: 0.2rem 0.4rem;
    border-radius: 0.25rem;
    font-weight: 500;
    font-size: 0.6875rem;
    text-align: center;
    white-space: nowrap;
  }
  
  .focus-badge {
    background: #ef4444;
    color: white;
    padding: 0.2rem 0.4rem;
    border-radius: 0.25rem;
    font-weight: 500;
    font-size: 0.6875rem;
    text-align: center;
    white-space: nowrap;
  }

  .bu-only-badge {
    background: #475569;
    color: white;
    padding: 0.2rem 0.4rem;
    border-radius: 0.25rem;
    font-weight: 500;
    font-size: 0.6875rem;
    text-align: center;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
  }
  
  .status-badge {
    background: ${props => props.statusColor || '#6b7280'};
    color: white;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-weight: 500;
    font-size: 0.6875rem;
  }
  
  .progress-display {
    font-weight: 600;
    font-size: 0.875rem;
    color: #374151;
    background: #f3f4f6;
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    border: 1px solid #d1d5db;
    min-width: 3rem;
    text-align: center;
  }
`;

/**
 * 한 줄로 컴팩트하게 보여주는 접기 모드 행
 * 표시: 사업부/프로세스/PoC/중점/사업부내공개 배지, 과제명, 진행상태, 진행률, 편집/삭제 버튼
 * 숨김: 액션아이템 목록, 성과 목록
 */
const CompactTaskItem = styled(motion.div)`
  /* 헤더와 동일한 grid template으로 컬럼 정렬 보장 */
  display: grid;
  grid-template-columns: ${COMPACT_GRID_COLUMNS};
  column-gap: 0.75rem;
  align-items: center;
  padding: 0.5rem 0.75rem;
  width: 100%;
  box-sizing: border-box;
  background: ${props => props.$isBuOnly ? '#f8fafc' : 'white'};
  border-left: 4px solid ${props => props.$isBuOnly ? '#64748b' : 'transparent'};
  transition: background 0.15s ease;
  min-height: 40px;

  > * { min-width: 0; }

  &:hover {
    background: ${props => props.$isBuOnly ? '#e2e8f0' : '#f3f4f6'};

    .action-buttons {
      opacity: 1;
      pointer-events: auto;
    }
  }

  .compact-badges {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.25rem;
    overflow: hidden;
  }

  .compact-badge {
    padding: 0.15rem 0.4rem;
    border-radius: 0.25rem;
    font-size: 0.6875rem;
    font-weight: 600;
    color: white;
    white-space: nowrap;
    line-height: 1.3;
  }

  .compact-badge.division {
    background: ${props => props.divisionColor || '#6b7280'};
  }
  .compact-badge.process { background: #3b82f6; }
  .compact-badge.domain  { background: #8b5cf6; }
  .compact-badge.poc     { background: #f59e0b; }
  .compact-badge.focus   { background: #ef4444; }
  .compact-badge.bu-only { background: #475569; display: inline-flex; align-items: center; gap: 0.15rem; }
  .compact-badge.id      { background: #2563eb; }
  .compact-badge.category { background: #10b981; }

  .compact-task-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: #1f2937;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    /* 헤더 .col-name과 동일한 좌측 보더/패딩 → 컬럼 정렬 일치 */
    border-left: 1px solid #e5e7eb;
    padding-left: 0.75rem;
  }

  .compact-status {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    /* 헤더 .col-status와 일치 */
    border-left: 1px solid #e5e7eb;
    padding-left: 0.75rem;
  }

  .compact-status-badge {
    padding: 0.15rem 0.4rem;
    border-radius: 0.25rem;
    font-size: 0.6875rem;
    font-weight: 600;
    color: white;
    background: ${props => props.statusColor || '#6b7280'};
    white-space: nowrap;
  }

  .compact-progress {
    font-size: 0.75rem;
    font-weight: 600;
    color: #374151;
    background: #f3f4f6;
    padding: 0.15rem 0.4rem;
    border-radius: 0.25rem;
    border: 1px solid #d1d5db;
    min-width: 2.5rem;
    text-align: center;
  }

  .action-buttons {
    display: flex;
    gap: 0.25rem;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s ease;
    justify-content: flex-end;
  }

  .action-btn {
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 0.25rem;
    padding: 0.25rem;
    cursor: pointer;
    color: #6b7280;
    display: inline-flex;
    align-items: center;
    justify-content: center;

    &:hover {
      background: #f3f4f6;
      color: #1f2937;
    }

    &.delete-btn:hover {
      background: #fee2e2;
      color: #dc2626;
      border-color: #fca5a5;
    }
  }
`;

const ActionItemSection = styled.div`
  width: 100%;
  
  .action-items-title {
    font-weight: 600;
    font-size: 0.875rem;
    color: #374151;
    margin-bottom: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .action-items-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .action-item {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 0.375rem;
    padding: 0.5rem 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    
    .action-item-title {
      font-weight: 500;
      font-size: 0.8rem;
      color: #1f2937;
      margin: 0;
      flex: 1;
      
      &.completed {
        color: #6b7280;
      }
    }
    
    .completion-badge {
      background: #10b981;
      color: white;
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
      font-size: 0.6rem;
      font-weight: 600;
      white-space: nowrap;
    }
  }
  
  .no-action-items {
    font-size: 0.75rem;
    color: #9ca3af;
    font-style: italic;
  }
`;

const PerformanceItem = styled.div`
  display: flex;
  flex-direction: column;
  padding: 0.75rem;
  background: #f8fafc;
  border-radius: 0.5rem;
  border: 1px solid #e5e7eb;
  width: 100%;
  box-sizing: border-box;
  height: auto;
  min-height: auto;
  overflow: visible;

  /* 카드 사이 간격은 부모(.performance-section) 의 grid gap 이 준다.
     여기서 margin 을 또 주면 2열의 행 간격만 벌어져 어긋난다. */

  /* '등록된 성과가 없습니다' 한 장짜리는 반 칸만 차지하면 어색하다 — 두 열을 다 쓴다 */
  &.empty {
    grid-column: 1 / -1;
  }


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
      line-height: 1.2;
    }
    
    .sub-category {
      color: #6b7280;
      font-size: 0.8rem;
      line-height: 1.2;
    }
    
    .performance-text {
      color: #059669;
      font-size: 0.875rem;
      font-weight: 500;
      line-height: 1.3;
      word-break: break-word;
      overflow-wrap: break-word;
      margin: 0.25rem 0;
    }
    
    .metrics-info {
      margin-top: 0.25rem;
      font-size: 0.75rem;
      line-height: 1.4;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      
      .contribution-info {
        color: #4b5563;
        word-break: break-word;
        overflow-wrap: break-word;
        
        .label {
          font-weight: 600;
          color: #374151;
        }
      }
      
      .level-info {
        color: #4b5563;
        word-break: break-word;
        overflow-wrap: break-word;
        
        .label {
          font-weight: 600;
          color: #374151;
        }
      }
    }
  }
  
  @media (max-width: 768px) {
    padding: 0.375rem 0.5rem;
    
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
      
      .metrics-info {
        font-size: 0.7rem;
      }
    }
  }
`;

const GanttBar = styled.div`
  position: absolute;
  top: 50%;
  left: ${props => props.startOffset}%;
  width: ${props => props.width}%;
  height: 24px;
  background: ${props => props.color};
  border-radius: 6px;
  transform: translateY(-50%);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
  transition: all 0.2s ease;
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.2);
  z-index: 1;
  
  &:hover {
    transform: translateY(-50%) scale(1.02);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    filter: brightness(1.1);
  }
  
  &:active {
    transform: translateY(-50%) scale(0.98);
  }
`;

const MONTHS = [
  '1월', '2월', '3월', '4월', '5월', '6월',
  '7월', '8월', '9월', '10월', '11월', '12월'
];

const GanttChart = ({ projects, statusColors, divisionColors, onYearChange, currentYear: propCurrentYear, onEditProject, onDeleteProject, settingsData, globalPerformances = [], onAddPerformance, onAddProject }) => {
  const [currentYear, setCurrentYear] = useState(propCurrentYear || 2025);
  // 펼치기/접기 상태 (기본: 펼치기)
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [filters, setFilters] = useState({
    사업부: [],
    진행상태: [],
    프로세스: [],
    과제영역: [],
    과제구분: []
  });
  const [periodFilter, setPeriodFilter] = useState('전체'); // 최근 1주일, 최근 1개월, 전체
  const [openDropdown, setOpenDropdown] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [monthlyDetailModalData, setMonthlyDetailModalData] = useState(null);
  // 빈 상태 가이드는 내렸다 (2026-08-11). 표시 여부를 정하던 상태·이펙트와
  // `localStorage.digitalTwinGuideHidden` 판정도 함께 지웠다 —
  // 되살릴 때 옛 판정을 그대로 쓰면 같은 증상(로딩 중 전체 화면 가림)이 돌아온다.

  const filterOptions = {
    사업부: settingsData?.divisions?.map(division => division.name) || [],
    진행상태: settingsData?.statuses?.map(status => status.name) || [],
    프로세스: settingsData?.processes?.map(process => process.name) || [], // categories → processes로 변경
    과제영역: settingsData?.projectDomains?.map(domain => domain.name) || [],
    과제구분: settingsData?.taskCategories?.map(taskCategory => taskCategory.name) || []
  };
  
  // 검색어 하이라이트 함수
  const highlightText = (text, query) => {
    if (!query || !text) return text;

    // 정규표현식 특수문자 이스케이프
    const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedQuery = escapeRegExp(query);

    const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));
    return parts.map((part, index) =>
      part.toLowerCase() === query.toLowerCase()
        ? <Highlight key={index}>{part}</Highlight>
        : part
    );
  };
  
  const filteredProjects = projects.filter(project => {
    const yearMatch = project.과제년도 === currentYear;
    const 사업부Match = filters.사업부.length === 0 || filters.사업부.includes(project.사업부);
    const 진행상태Match = filters.진행상태.length === 0 || filters.진행상태.includes(project.진행상태);
    const 프로세스Match = filters.프로세스.length === 0 || filters.프로세스.includes(project.프로세스 || project.부문); // 프로세스 필드와 기존 부문 필드 모두 지원
    const 과제영역Match = filters.과제영역.length === 0 || filters.과제영역.includes(project.과제영역);
    const 과제구분Match = filters.과제구분.length === 0 || filters.과제구분.includes(project.과제구분);

    // 기간 필터
    let periodMatch = true;
    if (periodFilter !== '전체' && project.updatedAt) {
      const now = new Date();
      const updatedAt = new Date(project.updatedAt);
      const diffTime = now - updatedAt;
      const diffDays = diffTime / (1000 * 60 * 60 * 24);

      if (periodFilter === '최근 1주일') {
        periodMatch = diffDays <= 7;
      } else if (periodFilter === '최근 1개월') {
        periodMatch = diffDays <= 30;
      }
    }

    // 검색어 필터
    if (!searchQuery) {
      return yearMatch && 사업부Match && 진행상태Match && 프로세스Match && 과제영역Match && 과제구분Match && periodMatch;
    }

    const query = searchQuery.toLowerCase();

    // 기본 필드 검색
    const basicFieldMatch =
      project.과제명?.toLowerCase().includes(query) ||
      project.사업부?.toLowerCase().includes(query) ||
      project.프로세스?.toLowerCase().includes(query) ||
      project.과제영역?.toLowerCase().includes(query) ||
      project.과제구분?.toLowerCase().includes(query) ||
      project.과제PL?.toLowerCase().includes(query) ||
      project.과제상세설명?.toLowerCase().includes(query);

    // 성과목록 검색
    const performanceMatch = project.성과목록?.some(perf =>
      perf.성과항목?.toLowerCase().includes(query) ||
      perf.대분류?.toLowerCase().includes(query) ||
      perf.소분류?.toLowerCase().includes(query) ||
      perf.단위?.toLowerCase().includes(query)
    );

    // 액션아이템 검색
    const actionItemMatch = project.액션아이템목록?.some(item =>
      item.제목?.toLowerCase().includes(query) ||
      item.상세설명?.toLowerCase().includes(query) ||
      item.담당자?.toLowerCase().includes(query)
    );

    // 과제참여인력 검색
    const personnelMatch = project.과제참여인력목록?.some(person =>
      person.이름?.toLowerCase().includes(query) ||
      person.knoxId?.toLowerCase().includes(query) ||
      person.부서?.toLowerCase().includes(query)
    );

    const searchMatch = basicFieldMatch || performanceMatch || actionItemMatch || personnelMatch;

    return yearMatch && 사업부Match && 진행상태Match && 프로세스Match && 과제영역Match && 과제구분Match && periodMatch && searchMatch;
  /*
    사업부(설정 순서) → 과제명. '모든 과제 현황'·편집창 네비게이션과 **같은 비교자**다
    (2026-08-07 요청 — 화면마다 순서가 달라 어디쯤인지 알 수 없었다).

    고친 것 둘 —
      · `getDivisionOrderIndex` 는 `DIVISION_ORDER` 가 **5개뿐**이라(MX·VD·DA·NW·의료기기)
        GTR·SR·CS 가 전부 999 로 묶여 뒤에서 순서가 없었다.
      · 2순위가 `a.id - b.id` 였는데 과제 ID 는 `'MX-26-001'` 같은 **문자열**이라
        빼기 결과가 **NaN** 이다. 즉 사업부 안에서는 정렬이 **한 번도 안 먹었고**,
        서버가 준 순서(= Postgres heap 순서, 저장하면 바뀐다)가 그대로 보였다.
  */
  }).sort(compareProjects(settingsData));
  
  const renderPerformanceList = (project) => {
    if (project.성과목록 && Array.isArray(project.성과목록) && project.성과목록.length > 0) {
      return project.성과목록.map((perfRef, index) => {
        // globalPerformances에서 실제 성과 데이터 찾기
        const perfId = typeof perfRef === 'object' ? (perfRef.id || perfRef.성과항목ID) : perfRef;
        const globalPerf = globalPerformances.find(gp => gp.id === perfId);

        // 성과 데이터 (globalPerf 우선, 없으면 perfRef 사용)
        const performance = globalPerf || perfRef;
        const isMonthly = globalPerf?.월별실적여부 || false;
        const contribution = typeof perfRef === 'object' ? perfRef.과제기여도 : '100';

        return (
          <PerformanceItem key={index}>
            <div className="performance-info">
              <div className="main-category">{highlightText(performance.대분류 || '미지정', searchQuery)}</div>
              <div className="sub-category">{highlightText(performance.소분류 || '미지정', searchQuery)}</div>
              <div className="performance-text">{highlightText(performance.성과항목 || '미지정', searchQuery)}</div>
              <div className="metrics-info">
                <div className="contribution-info">
                  <span className="label">성과 기여도: </span>{contribution}%
                </div>
                <div className="level-info">
                  <span className="label">현재: </span>{performance.현재수준} {performance.단위} |
                  <span className="label"> 목표: </span>{performance.목표수준} {performance.단위}
                  {isMonthly ? (
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
            {isMonthly && globalPerf && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMonthlyDetailModalData({
                    ...globalPerf,
                    contribution: contribution
                  });
                }}
                style={{
                  padding: '0.375rem 0.75rem',
                  background: '#e0f2fe',
                  color: '#0369a1',
                  border: '1px solid #bae6fd',
                  borderRadius: '0.375rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  marginTop: '0.5rem',
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#0369a1';
                  e.target.style.color = 'white';
                  e.target.style.borderColor = '#0284c7';
                  e.target.style.transform = 'translateY(-1px)';
                  e.target.style.boxShadow = '0 2px 4px rgba(3, 105, 161, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#e0f2fe';
                  e.target.style.color = '#0369a1';
                  e.target.style.borderColor = '#bae6fd';
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = 'none';
                }}
              >
                📊 월별 상세
              </button>
            )}
          </PerformanceItem>
        );
      });
    }
    
    return (
      <PerformanceItem className="empty">
        <div className="performance-info">
          <div className="main-category">미지정</div>
          <div className="sub-category">성과 없음</div>
          <div className="performance-text">등록된 성과가 없습니다</div>
        </div>
      </PerformanceItem>
    );
  };
  
  const calculateBarPosition = (start, end) => {
    const startOffset = ((start - 1) / 12) * 100;
    const duration = end - start + 1;
    const width = (duration / 12) * 100;
    return { startOffset, width };
  };
  
  const handlePrevYear = () => {
    const newYear = currentYear - 1;
    setCurrentYear(newYear);
    if (onYearChange) {
      onYearChange(newYear);
    }
  };
  
  const handleNextYear = () => {
    const newYear = currentYear + 1;
    setCurrentYear(newYear);
    if (onYearChange) {
      onYearChange(newYear);
    }
  };
  
  const handleFilterChange = (filterType, value) => {
    setFilters(prev => {
      const currentValues = prev[filterType] || [];
      const newValues = currentValues.includes(value)
        ? currentValues.filter(v => v !== value)
        : [...currentValues, value];
      
      return {
        ...prev,
        [filterType]: newValues
      };
    });
  };
  
  const handleClearFilter = (filterType) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: []
    }));
  };
  
  const handleClearAllFilters = () => {
    setFilters({
      사업부: [],
      진행상태: [],
      프로세스: [],
      과제영역: [],
      과제구분: []
    });
    setPeriodFilter('전체');
  };
  
  const toggleDropdown = (filterType) => {
    setOpenDropdown(openDropdown === filterType ? null : filterType);
  };
  
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      const isInsideFilterGroup = event.target.closest('.filter-group');
      
      if (!isInsideFilterGroup && openDropdown) {
        setOpenDropdown(null);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openDropdown]);
  
  React.useEffect(() => {
    if (propCurrentYear && propCurrentYear !== currentYear) {
      setCurrentYear(propCurrentYear);
    }
  }, [propCurrentYear, currentYear]);
  
  return (
    <GanttContainer>
      {/*
        빈 상태 가이드 — **2026-08-11 화면에서 내렸다** (사용자 요청).

        데이터가 아직 안 온 사이에 전체 화면을 덮어서, 들어올 때마다 한 번씩
        가로막는 것처럼 보였다(과제가 있어도 로딩 전에는 `projects` 가 비어 있다).

        컴포넌트(`components/EmptyStateGuide.jsx`)와 import 는 그대로 두었다 —
        스냅샷 관리·수동 업로드를 내렸을 때와 같은 방식이라, 이 블록의 주석만
        되돌리면 복원된다. 되살릴 때는 **로딩이 끝난 뒤에만** 뜨도록 조건을
        고칠 것(그게 원래 의도였다).
      */}

      <GanttHeader>
        <div className="title">
          <Calendar size={20} />
          디지털 트윈 과제 진행 현황
        </div>
        
        <div className="header-controls">
          <GanttFilters
            filters={filters}
            onFilterChange={handleFilterChange}
            onClearFilter={handleClearFilter}
            onClearAllFilters={handleClearAllFilters}
            openDropdown={openDropdown}
            onToggleDropdown={toggleDropdown}
            filterOptions={filterOptions}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            periodFilter={periodFilter}
            onPeriodFilterChange={setPeriodFilter}
          />
          
          <button
            className="collapse-toggle"
            onClick={() => setIsCollapsed(c => !c)}
            title={isCollapsed ? '펼치기 (상세 정보 보기)' : '접기 (한 줄로 컴팩트하게 보기)'}
          >
            {isCollapsed ? <ChevronsUpDown size={16} /> : <ChevronsDownUp size={16} />}
            <span>{isCollapsed ? '펼치기' : '접기'}</span>
          </button>

          <div className="year-selector">
            <button className="year-nav" onClick={handlePrevYear} title="이전 년도">
              ‹
            </button>
            <div className="current-year">{currentYear}</div>
            <button className="year-nav" onClick={handleNextYear} title="다음 년도">
              ›
            </button>
          </div>
        </div>
      </GanttHeader>
      
      <GanttContent>
        <HeaderRow>
          {isCollapsed ? (
            <CompactHeaderTaskSection>
              <div className="col-info">기본 정보</div>
              <div className="col-name">과제명</div>
              <div className="col-status">진행 상태</div>
              <div className="col-actions" />
            </CompactHeaderTaskSection>
          ) : (
            <HeaderTaskSection>
              <div className="division-header">
                기본 정보
              </div>
              <div className="task-header">
                과제 내용
              </div>
              <div className="performance-header">
                성과
              </div>
              <div className="status-header">
                진행 상태
              </div>
            </HeaderTaskSection>
          )}
          <HeaderChartSection>
            {MONTHS.map((month, index) => (
              <div key={index} className="month-cell">{month}</div>
            ))}
          </HeaderChartSection>
        </HeaderRow>
        
        {filteredProjects.map((project, index) => {
          const { startOffset, width } = calculateBarPosition(project.시작, project.종료);

          return (
            <DataRow key={project.uuid || `${project.id}-${index}`}>
              <TaskSection>
                {isCollapsed ? (
                  <CompactTaskItem
                    divisionColor={divisionColors[project.사업부]}
                    statusColor={statusColors[project.진행상태]}
                    $isBuOnly={!!project.사업부내공개여부}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.4) }}
                  >
                    <div className="compact-badges">
                      <span className="compact-badge division">
                        {highlightText(project.사업부, searchQuery)}
                      </span>
                      <span className="compact-badge process">
                        {highlightText(project.프로세스 || project.부문, searchQuery)}
                      </span>
                      {project.과제영역 && (
                        <span className="compact-badge domain">
                          {highlightText(project.과제영역, searchQuery)}
                        </span>
                      )}
                      <span className="compact-badge id">{project.id}</span>
                      {project.과제구분 && (
                        <span className="compact-badge category">
                          {highlightText(project.과제구분, searchQuery)}
                        </span>
                      )}
                      {project.PoC과제여부 && (
                        <span className="compact-badge poc">PoC</span>
                      )}
                      {project.중점과제여부 && (
                        <span className="compact-badge focus">중점</span>
                      )}
                      {project.사업부내공개여부 && (
                        <span className="compact-badge bu-only" title="사업부 내 공개 과제">
                          🔒 사업부내
                        </span>
                      )}
                    </div>
                    <div className="compact-task-name" title={project.과제명}>
                      {highlightText(project.과제명, searchQuery)}
                    </div>
                    <div className="compact-status">
                      <span className="compact-status-badge">{project.진행상태}</span>
                      <span className="compact-progress">{percentText(project.진행률)}</span>
                    </div>
                    <div className="action-buttons">
                      <button
                        className="action-btn edit-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditProject && onEditProject(project);
                        }}
                        title="과제 편집"
                      >
                        <Edit size={13} />
                      </button>
                      <button
                        className="action-btn delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteProject && onDeleteProject(project);
                        }}
                        title="과제 삭제"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </CompactTaskItem>
                ) : (
                <TaskItem
                  divisionColor={divisionColors[project.사업부]}
                  statusColor={statusColors[project.진행상태]}
                  $isBuOnly={!!project.사업부내공개여부}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <div className="division-section">
                    <span className="division-badge">{highlightText(project.사업부, searchQuery)}</span>
                    <span className="process-badge">{highlightText(project.프로세스 || project.부문, searchQuery)}</span> {/* 프로세스 필드와 기존 부문 필드 모두 지원 */}
                    {project.과제영역 && (
                      <span className="domain-badge">{highlightText(project.과제영역, searchQuery)}</span>
                    )}
                    {project.PoC과제여부 && (
                      <span className="poc-badge">PoC 과제</span>
                    )}
                    {project.중점과제여부 && (
                      <span className="focus-badge">중점 과제</span>
                    )}
                    {project.사업부내공개여부 && (
                      <span className="bu-only-badge" title="같은 사업부 사용자만 볼 수 있는 과제">
                        🔒 사업부 내 공개
                      </span>
                    )}
                  </div>
                  
                  <div className="task-info">
                    <div className="task-title">{highlightText(project.과제명, searchQuery)}</div>
                    <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem'}}>
                      <div style={{
                        background: '#2563eb',
                        color: 'white',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.375rem',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        display: 'inline-flex',
                        alignItems: 'center'
                      }}>ID: {project.id}</div>
                      <div style={{
                        background: '#10b981',
                        color: 'white',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.375rem',
                        fontWeight: '500',
                        fontSize: '0.75rem',
                        display: 'inline-flex',
                        alignItems: 'center'
                      }}>{highlightText(project.과제구분, searchQuery)}</div>
                    </div>
                    
                    <ActionItemSection>
                      <div className="action-items-title">
                        <CheckSquare size={12} />
                        액션 아이템
                      </div>
                      {project.액션아이템목록 && project.액션아이템목록.length > 0 ? (
                        <div className="action-items-list">
                          {project.액션아이템목록.map((actionItem, actionIndex) => (
                            <div key={actionIndex} className="action-item">
                              <div className={`action-item-title ${actionItem.완료여부 ? 'completed' : ''}`}>
                                {highlightText(actionItem.제목, searchQuery)}
                              </div>
                              {actionItem.완료여부 && (
                                <div className="completion-badge">완료</div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="no-action-items">등록된 액션 아이템이 없습니다</div>
                      )}
                    </ActionItemSection>
                  </div>
                  
                  <div className="performance-section">
                    {renderPerformanceList(project)}
                  </div>
                  
                  <div className="status-section">
                    <span className="status-badge">{project.진행상태}</span>
                    <div className="progress-display">
                      {percentText(project.진행률)}
                    </div>
                  </div>
                  
                  <div className="action-buttons">
                    <button 
                      className="action-btn edit-btn" 
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditProject && onEditProject(project);
                      }}
                      title="과제 편집"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      className="action-btn delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteProject && onDeleteProject(project);
                      }}
                      title="과제 삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </TaskItem>
                )}
              </TaskSection>
              
              <ChartSection>
                <div className="gantt-cell">
                  <GanttBar
                    startOffset={startOffset}
                    width={width}
                    color={statusColors[project.진행상태] || '#6b7280'}
                    title={`${project.과제명} (${project.시작}월-${project.종료}월)`}
                  />
                </div>
              </ChartSection>
            </DataRow>
          );
        })}
      </GanttContent>

      {/* 월별 상세 모달 */}
      <AnimatePresence>
        {monthlyDetailModalData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '1rem'
            }}
            onClick={() => setMonthlyDetailModalData(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'white',
                borderRadius: '1rem',
                padding: '2rem',
                maxWidth: '900px',
                width: '100%',
                maxHeight: '90vh',
                overflow: 'auto',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
              }}
            >
              {/* 헤더 */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '2rem',
                paddingBottom: '1rem',
                borderBottom: '2px solid #e5e7eb'
              }}>
                <div>
                  <h2 style={{
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    color: '#1f2937',
                    marginBottom: '0.5rem'
                  }}>
                    월별 실적 상세
                  </h2>
                  <div style={{ fontSize: '1rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                    {monthlyDetailModalData.성과항목}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                    {monthlyDetailModalData.대분류} &gt; {monthlyDetailModalData.소분류}
                  </div>
                </div>
                <button
                  onClick={() => setMonthlyDetailModalData(null)}
                  style={{
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.target.style.background = '#dc2626'}
                  onMouseLeave={(e) => e.target.style.background = '#ef4444'}
                >
                  닫기
                </button>
              </div>

              {/* 기본 정보 */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '1rem',
                marginBottom: '2rem',
                padding: '1rem',
                background: '#f9fafb',
                borderRadius: '0.5rem'
              }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>현재 수준</div>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1f2937' }}>
                    {monthlyDetailModalData.현재수준} {monthlyDetailModalData.단위}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>목표 수준</div>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1f2937' }}>
                    {monthlyDetailModalData.목표수준} {monthlyDetailModalData.단위}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>과제 기여도</div>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1f2937' }}>
                    {monthlyDetailModalData.contribution}%
                  </div>
                </div>
              </div>

              {/* 월별 실적 그리드 */}
              <div>
                <h3 style={{
                  fontSize: '1.125rem',
                  fontWeight: 600,
                  color: '#1f2937',
                  marginBottom: '1rem'
                }}>
                  월별 실적 현황
                </h3>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '1rem'
                }}>
                  {MONTHS.map((month, idx) => {
                    const value = monthlyDetailModalData.월별실적?.[idx] || '';
                    return (
                      <div
                        key={idx}
                        style={{
                          padding: '1rem',
                          background: value ? '#e0f2fe' : '#f9fafb',
                          borderRadius: '0.5rem',
                          border: value ? '2px solid #0ea5e9' : '1px solid #e5e7eb',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <div style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: '#6b7280',
                          marginBottom: '0.5rem'
                        }}>
                          {month}
                        </div>
                        <div style={{
                          fontSize: '1.25rem',
                          fontWeight: 700,
                          color: value ? '#0369a1' : '#9ca3af'
                        }}>
                          {value || '-'}
                        </div>
                        {value && (
                          <div style={{
                            fontSize: '0.75rem',
                            color: '#6b7280',
                            marginTop: '0.25rem'
                          }}>
                            {monthlyDetailModalData.단위}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </GanttContainer>
  );
};

export default GanttChart;
