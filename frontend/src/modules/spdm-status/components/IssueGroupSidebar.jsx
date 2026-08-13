import React, { useState } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { Plus, FolderOpen, MoreVertical, Edit2, Trash2 } from 'lucide-react';

const SidebarContainer = styled.div`
  width: 240px;
  min-width: 240px;
  background: white;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const SidebarHeader = styled.div`
  padding: 1rem;
  border-bottom: 1px solid #e2e8f0;

  h3 {
    font-size: 0.875rem;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0;
  }
`;

const GroupList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
`;

const GroupItemWrapper = styled.div`
  position: relative;
`;

const GroupItem = styled(motion.button)`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  padding-right: 2.5rem;
  background: ${props => props.$active ? '#f1f5f9' : 'transparent'};
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;

  &:hover {
    background: #f1f5f9;
  }

  ${props => props.$active && `
    background: ${props.$color}15;
    border-left: 3px solid ${props.$color};
  `}
`;

const ColorDot = styled.div`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: ${props => props.$color};
  flex-shrink: 0;
`;

const GroupInfo = styled.div`
  flex: 1;
  min-width: 0;

  .name {
    font-size: 0.9375rem;
    font-weight: 500;
    color: #1e293b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .count {
    font-size: 0.75rem;
    color: #64748b;
    margin-top: 0.125rem;
  }
`;

const AllGroupItem = styled(GroupItem)`
  margin-bottom: 0.5rem;
  border-bottom: 1px solid #e2e8f0;
  border-radius: 0.5rem 0.5rem 0 0;
  padding-bottom: 1rem;
  padding-right: 1rem;
`;

const MoreButton = styled.button`
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  border-radius: 0.375rem;
  color: #94a3b8;
  cursor: pointer;
  opacity: 0;
  transition: all 0.2s ease;

  ${GroupItemWrapper}:hover & {
    opacity: 1;
  }

  &:hover {
    background: #e2e8f0;
    color: #64748b;
  }
`;

const DropdownMenu = styled(motion.div)`
  position: absolute;
  right: 0;
  top: 100%;
  margin-top: 0.25rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  z-index: 100;
  min-width: 120px;
  overflow: hidden;
`;

const DropdownItem = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  background: transparent;
  border: none;
  font-size: 0.875rem;
  color: #374151;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;

  &:hover {
    background: #f1f5f9;
  }

  &.delete {
    color: #ef4444;

    &:hover {
      background: #fef2f2;
    }
  }
`;

const AddGroupButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: calc(100% - 1rem);
  margin: 0.5rem;
  padding: 0.75rem;
  background: transparent;
  border: 2px dashed #e2e8f0;
  border-radius: 0.5rem;
  color: #64748b;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: #8b5cf6;
    color: #8b5cf6;
    background: #f5f3ff;
  }
`;

const IssueGroupSidebar = ({
  groups,
  selectedGroup,
  onSelectGroup,
  issueCounts,
  onAddGroup,
  onEditGroup,
  onDeleteGroup
}) => {
  const [openMenuId, setOpenMenuId] = useState(null);
  const totalCount = Object.values(issueCounts).reduce((sum, count) => sum + count, 0);

  const handleMoreClick = (e, groupId) => {
    e.stopPropagation();
    setOpenMenuId(openMenuId === groupId ? null : groupId);
  };

  const handleEdit = (e, group) => {
    e.stopPropagation();
    setOpenMenuId(null);
    onEditGroup(group);
  };

  const handleDelete = (e, groupId) => {
    e.stopPropagation();
    setOpenMenuId(null);
    onDeleteGroup(groupId);
  };

  // 외부 클릭 시 메뉴 닫기
  React.useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    if (openMenuId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openMenuId]);

  return (
    <SidebarContainer>
      <SidebarHeader>
        <h3>이슈 그룹</h3>
      </SidebarHeader>
      <GroupList>
        <AllGroupItem
          $active={selectedGroup === null}
          $color="#6366f1"
          onClick={() => onSelectGroup(null)}
          whileHover={{ x: 2 }}
          whileTap={{ scale: 0.98 }}
        >
          <FolderOpen size={18} color="#6366f1" />
          <GroupInfo>
            <div className="name">전체 보기</div>
            <div className="count">{totalCount}개 이슈</div>
          </GroupInfo>
        </AllGroupItem>

        {groups.map((group, index) => (
          <GroupItemWrapper key={group.id}>
            <GroupItem
              $active={selectedGroup === group.id}
              $color={group.color}
              onClick={() => onSelectGroup(group.id)}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
            >
              <ColorDot $color={group.color} />
              <GroupInfo>
                <div className="name">{group.name}</div>
                <div className="count">{issueCounts[group.id] || 0}개 이슈</div>
              </GroupInfo>
            </GroupItem>
            <MoreButton onClick={(e) => handleMoreClick(e, group.id)}>
              <MoreVertical size={16} />
            </MoreButton>
            {openMenuId === group.id && (
              <DropdownMenu
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownItem onClick={(e) => handleEdit(e, group)}>
                  <Edit2 size={14} />
                  수정
                </DropdownItem>
                {group.id !== 'etc' && (
                  <DropdownItem className="delete" onClick={(e) => handleDelete(e, group.id)}>
                    <Trash2 size={14} />
                    삭제
                  </DropdownItem>
                )}
              </DropdownMenu>
            )}
          </GroupItemWrapper>
        ))}
      </GroupList>
      <AddGroupButton onClick={onAddGroup}>
        <Plus size={16} />
        그룹 추가
      </AddGroupButton>
    </SidebarContainer>
  );
};

export default IssueGroupSidebar;
