import React, { useState } from 'react';
import styled from 'styled-components';
import { ChevronRight, ChevronDown, Plus, FolderPlus, Trash2, GripVertical } from 'lucide-react';
import SpecKeyAutocomplete from './SpecKeyAutocomplete';

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0;
  padding-left: ${props => props.$depth * 24}px;
  border-radius: 0.375rem;
  transition: background 0.15s ease;

  &:hover {
    background: #f8fafc;
  }

  &:hover .row-actions {
    opacity: 1;
  }
`;

const DragHandle = styled.div`
  cursor: grab;
  color: #cbd5e1;
  display: flex;
  align-items: center;
  padding: 0.125rem;

  &:hover {
    color: #94a3b8;
  }
`;

const ExpandButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  background: none;
  cursor: pointer;
  color: #64748b;
  padding: 0;
  border-radius: 0.25rem;
  flex-shrink: 0;

  &:hover {
    background: #e2e8f0;
    color: #1e293b;
  }
`;

const ExpandPlaceholder = styled.div`
  width: 20px;
  flex-shrink: 0;
`;

const KeyCell = styled.div`
  flex: 0 0 200px;
  min-width: 0;
`;

const ValueCell = styled.div`
  flex: 1;
  min-width: 0;
`;

const ValueInput = styled.input`
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
`;

const GroupLabel = styled.span`
  font-size: 0.75rem;
  color: #8b5cf6;
  background: #ede9fe;
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  font-weight: 500;
`;

const RowActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.125rem;
  opacity: 0;
  transition: opacity 0.15s ease;
  flex-shrink: 0;
`;

const ActionButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: none;
  cursor: pointer;
  color: #94a3b8;
  padding: 0;
  border-radius: 0.25rem;

  &:hover {
    background: ${props => props.$danger ? '#fee2e2' : '#f1f5f9'};
    color: ${props => props.$danger ? '#ef4444' : '#475569'};
  }
`;

const ChildrenContainer = styled.div`
  ${props => !props.$expanded && 'display: none;'}
`;

const SpecNodeRow = ({ node, depth = 0, onUpdate, onDelete, onAddChild, onAddGroup }) => {
  const [expanded, setExpanded] = useState(true);
  const isGroup = Array.isArray(node.children);

  const handleKeyChange = (newKey) => {
    onUpdate({ ...node, key: newKey });
  };

  const handleValueChange = (e) => {
    onUpdate({ ...node, value: e.target.value });
  };

  const handleChildUpdate = (updatedChild) => {
    const newChildren = node.children.map(c =>
      c.id === updatedChild.id ? updatedChild : c
    );
    onUpdate({ ...node, children: newChildren });
  };

  const handleChildDelete = (childId) => {
    const newChildren = node.children.filter(c => c.id !== childId);
    onUpdate({ ...node, children: newChildren });
  };

  const handleAddChildItem = () => {
    if (onAddChild) onAddChild(node.id);
  };

  const handleAddChildGroup = () => {
    if (onAddGroup) onAddGroup(node.id);
  };

  return (
    <>
      <Row $depth={depth}>
        <DragHandle>
          <GripVertical size={14} />
        </DragHandle>

        {isGroup ? (
          <ExpandButton onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </ExpandButton>
        ) : (
          <ExpandPlaceholder />
        )}

        <KeyCell>
          <SpecKeyAutocomplete
            value={node.key}
            onChange={handleKeyChange}
            placeholder="키 입력..."
          />
        </KeyCell>

        {isGroup ? (
          <ValueCell>
            <GroupLabel>그룹 ({node.children.length}개)</GroupLabel>
          </ValueCell>
        ) : (
          <ValueCell>
            <ValueInput
              value={node.value || ''}
              onChange={handleValueChange}
              placeholder="값 입력..."
            />
          </ValueCell>
        )}

        <RowActions className="row-actions">
          {isGroup && (
            <>
              <ActionButton title="항목 추가" onClick={handleAddChildItem}>
                <Plus size={14} />
              </ActionButton>
              <ActionButton title="그룹 추가" onClick={handleAddChildGroup}>
                <FolderPlus size={14} />
              </ActionButton>
            </>
          )}
          <ActionButton $danger title="삭제" onClick={() => onDelete(node.id)}>
            <Trash2 size={14} />
          </ActionButton>
        </RowActions>
      </Row>

      {isGroup && (
        <ChildrenContainer $expanded={expanded}>
          {node.children.map(child => (
            <SpecNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              onUpdate={handleChildUpdate}
              onDelete={handleChildDelete}
              onAddChild={onAddChild}
              onAddGroup={onAddGroup}
            />
          ))}
        </ChildrenContainer>
      )}
    </>
  );
};

export default SpecNodeRow;
