import React from 'react';
import styled from 'styled-components';

const TabsContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid #e2e8f0;
  background: white;
  overflow-x: auto;

  &::-webkit-scrollbar {
    height: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 2px;
  }
`;

const Tab = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  border: 1px solid ${props => props.$active ? '#8b5cf6' : '#e2e8f0'};
  border-radius: 0.5rem;
  background: ${props => props.$active ? '#8b5cf6' : 'white'};
  color: ${props => props.$active ? 'white' : '#475569'};
  font-size: 0.8125rem;
  font-weight: ${props => props.$active ? '600' : '500'};
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;

  &:hover {
    border-color: #8b5cf6;
    ${props => !props.$active && 'color: #8b5cf6;'}
  }
`;

const ColorDot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${props => props.$active ? 'rgba(255,255,255,0.8)' : props.$color};
  flex-shrink: 0;
`;

const AllTab = styled(Tab)`
  font-weight: ${props => props.$active ? '600' : '500'};
`;

const DivisionTabs = ({ departments, activeDivision, onSelect }) => {
  return (
    <TabsContainer>
      <AllTab
        $active={activeDivision === null}
        onClick={() => onSelect(null)}
      >
        전체
      </AllTab>
      {departments.map(dept => (
        <Tab
          key={dept.id}
          $active={activeDivision === dept.id}
          onClick={() => onSelect(dept.id)}
        >
          <ColorDot $color={dept.color} $active={activeDivision === dept.id} />
          {dept.name}
        </Tab>
      ))}
    </TabsContainer>
  );
};

export default DivisionTabs;
