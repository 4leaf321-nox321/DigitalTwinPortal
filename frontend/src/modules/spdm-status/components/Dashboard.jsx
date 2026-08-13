import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { FileText, Clock, CheckCircle, PauseCircle } from 'lucide-react';

const DashboardContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  padding: 1rem;
  background: white;
  border-bottom: 1px solid #e2e8f0;

  @media (max-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const StatCard = styled(motion.div)`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  background: ${props => props.$bgColor || '#f8fafc'};
  border-radius: 0.75rem;
  border: 1px solid ${props => props.$borderColor || '#e2e8f0'};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  ${props => props.$active && `
    border-color: ${props.$borderColor || '#3b82f6'};
    box-shadow: 0 0 0 2px ${props.$borderColor || '#3b82f6'}33;
  `}
`;

const IconWrapper = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 0.75rem;
  background: ${props => props.$color || '#3b82f6'};
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
`;

const StatInfo = styled.div`
  flex: 1;

  .label {
    font-size: 0.875rem;
    color: #64748b;
    margin-bottom: 0.25rem;
  }

  .value {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1e293b;
  }
`;

const Dashboard = ({ issues, statusFilter, onStatusFilterChange }) => {
  const stats = {
    total: issues.length,
    inProgress: issues.filter(i => i.status === 'in-progress').length,
    completed: issues.filter(i => i.status === 'completed').length,
    onHold: issues.filter(i => i.status === 'on-hold').length,
  };

  const statItems = [
    {
      key: 'all',
      label: '전체 이슈',
      value: stats.total,
      icon: FileText,
      color: '#6366f1',
      bgColor: '#eef2ff',
      borderColor: '#6366f1'
    },
    {
      key: 'active',
      label: '진행중',
      value: stats.inProgress,
      icon: Clock,
      color: '#3b82f6',
      bgColor: '#eff6ff',
      borderColor: '#3b82f6'
    },
    {
      key: 'completed',
      label: '완료',
      value: stats.completed,
      icon: CheckCircle,
      color: '#10b981',
      bgColor: '#ecfdf5',
      borderColor: '#10b981'
    },
    {
      key: 'on-hold',
      label: '보류',
      value: stats.onHold,
      icon: PauseCircle,
      color: '#ef4444',
      bgColor: '#fef2f2',
      borderColor: '#ef4444'
    },
  ];

  return (
    <DashboardContainer>
      {statItems.map((item, index) => (
        <StatCard
          key={item.key}
          $bgColor={item.bgColor}
          $borderColor={item.borderColor}
          $active={statusFilter === item.key}
          onClick={() => onStatusFilterChange(statusFilter === item.key ? null : item.key)}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <IconWrapper $color={item.color}>
            <item.icon size={24} />
          </IconWrapper>
          <StatInfo>
            <div className="label">{item.label}</div>
            <div className="value">{item.value}</div>
          </StatInfo>
        </StatCard>
      ))}
    </DashboardContainer>
  );
};

export default Dashboard;
