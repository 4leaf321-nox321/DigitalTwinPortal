import React from 'react';
import styled from 'styled-components';
import { Trash2, Info, User, Users, BarChart3 } from 'lucide-react';

const ProcessContainer = styled.div`
  position: absolute;
  background: ${props => {
    if (props.selected) return '#dbeafe';
    return '#f9fafb';
  }};
  border: 2px solid ${props => {
    if (props.connecting) return '#ef4444';
    if (props.selected) return '#3b82f6';
    return '#d1d5db';
  }};
  border-radius: 12px;
  padding: 16px;
  min-width: 280px;
  max-width: 400px;
  min-height: 120px;
  cursor: move;
  user-select: none;
  font-size: 14px;
  line-height: 1.4;
  z-index: 1500;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: #6366f1;
    box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3);
  }
`;

const ProcessHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
`;

const ProcessTitle = styled.div`
  font-weight: 600;
  color: #111827;
  font-size: 16px;
  line-height: 1.3;
  word-break: break-word;
  flex: 1;
  margin-right: 8px;
`;

const ProcessActions = styled.div`
  display: ${props => props.visible ? 'flex' : 'none'};
  gap: 4px;
  flex-shrink: 0;
`;

const ActionButton = styled.button`
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: ${props => {
    if (props.danger) return '#ef4444';
    if (props.info) return '#10b981';
    return '#6366f1';
  }};
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${props => {
      if (props.danger) return '#dc2626';
      if (props.info) return '#059669';
      return '#4f46e5';
    }};
    transform: scale(1.05);
  }
`;

const ProcessInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const InfoRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6b7280;
`;

const InfoIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
`;

const InfoText = styled.span`
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const StatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  background: ${props => {
    switch (props.status) {
      case 'not_started': return '#f3f4f6';
      case 'in_progress': return '#dbeafe';
      case 'review': return '#fef3c7';
      case 'completed': return '#d1fae5';
      case 'blocked': return '#fee2e2';
      default: return '#f3f4f6';
    }
  }};
  color: ${props => {
    switch (props.status) {
      case 'not_started': return '#6b7280';
      case 'in_progress': return '#1d4ed8';
      case 'review': return '#d97706';
      case 'completed': return '#059669';
      case 'blocked': return '#dc2626';
      default: return '#6b7280';
    }
  }};
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 4px;
  background: #e5e7eb;
  border-radius: 2px;
  overflow: hidden;
  margin-top: 4px;
  
  .fill {
    height: 100%;
    background: ${props => {
      if (props.progress >= 100) return '#10b981';
      if (props.progress >= 75) return '#3b82f6';
      if (props.progress >= 25) return '#f59e0b';
      return '#6b7280';
    }};
    transition: width 0.3s ease;
    width: ${props => props.progress}%;
  }
`;

const CategoryBadge = styled.span`
  display: inline-block;
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 500;
  background: #e0e7ff;
  color: #3730a3;
  margin-top: 4px;
`;

const STATUS_LABELS = {
  'not_started': '시작 안함',
  'in_progress': '진행 중',
  'review': '검토 중',
  'completed': '완료',
  'blocked': '차단됨'
};

const CATEGORY_LABELS = {
  'cae_development': 'CAE Dev',
  'program_development': 'Program Dev',
  'testing': 'Testing',
  'documentation': 'Documentation'
};

const ProcessBox = ({ 
  process, 
  selected, 
  connecting,
  onMouseDown, 
  onClick,
  onDelete,
  onShowDetails,
  style,
  showActions = false
}) => {
  const handleActionClick = (e, action) => {
    e.stopPropagation();
    action();
  };

  const renderProcessInfo = () => {
    const info = [];
    
    // 담당자 정보
    if (process.primaryOwner) {
      info.push(
        <InfoRow key="owner">
          <InfoIcon><User size={14} /></InfoIcon>
          <InfoText>{process.primaryOwner}</InfoText>
        </InfoRow>
      );
    }
    
    // 협업자 정보
    if (process.collaborators) {
      info.push(
        <InfoRow key="collaborators">
          <InfoIcon><Users size={14} /></InfoIcon>
          <InfoText>{process.collaborators}</InfoText>
        </InfoRow>
      );
    }
    
    // 상태 및 진행률
    if (process.status || (process.progress !== undefined && process.progress !== null)) {
      info.push(
        <InfoRow key="status">
          <InfoIcon><BarChart3 size={14} /></InfoIcon>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
            {process.status && (
              <StatusBadge status={process.status}>
                {STATUS_LABELS[process.status] || process.status}
              </StatusBadge>
            )}
            {(process.progress !== undefined && process.progress !== null) && (
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                {process.progress}%
              </span>
            )}
          </div>
        </InfoRow>
      );
    }
    
    return info;
  };

  return (
    <ProcessContainer
      selected={selected}
      connecting={connecting}
      style={style}
      onMouseDown={onMouseDown}
      onClick={onClick}
      data-process-id={process.id}
    >
      <ProcessHeader>
        <ProcessTitle>{process.text}</ProcessTitle>
        <ProcessActions visible={showActions}>
          <ActionButton
            info
            onClick={(e) => handleActionClick(e, onShowDetails)}
            title="상세 정보 보기/편집"
          >
            <Info size={14} />
          </ActionButton>
          <ActionButton 
            danger
            onClick={(e) => handleActionClick(e, onDelete)}
            title="프로세스 삭제"
          >
            <Trash2 size={14} />
          </ActionButton>
        </ProcessActions>
      </ProcessHeader>
      
      <ProcessInfo>
        {renderProcessInfo()}
        
        {/* 진행률 바 */}
        {(process.progress !== undefined && process.progress !== null && process.progress > 0) && (
          <ProgressBar progress={process.progress}>
            <div className="fill" />
          </ProgressBar>
        )}
        
        {/* 카테고리 */}
        {process.category && (
          <CategoryBadge>
            {CATEGORY_LABELS[process.category] || process.category}
          </CategoryBadge>
        )}
      </ProcessInfo>
    </ProcessContainer>
  );
};

export default ProcessBox;
