import React, { useCallback } from 'react';
import styled from 'styled-components';
import { Plus, FolderPlus } from 'lucide-react';
import SpecNodeRow from './SpecNodeRow';

const Container = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e2e8f0;
  background: #fafbfc;
`;

const Title = styled.h3`
  font-size: 0.875rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 0.375rem;
`;

const AddButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  background: white;
  font-size: 0.75rem;
  color: #475569;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: #f8fafc;
    border-color: #8b5cf6;
    color: #8b5cf6;
  }
`;

const TreeContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  color: #94a3b8;
  text-align: center;

  p {
    margin: 0.5rem 0 0 0;
    font-size: 0.8125rem;
  }
`;

const generateId = () => {
  return `spec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const SpecTreeEditor = ({ specs, onChange, moduleName }) => {
  const handleNodeUpdate = useCallback((updatedNode) => {
    const newSpecs = specs.map(s => s.id === updatedNode.id ? updatedNode : s);
    onChange(newSpecs);
  }, [specs, onChange]);

  const handleNodeDelete = useCallback((nodeId) => {
    const newSpecs = specs.filter(s => s.id !== nodeId);
    onChange(newSpecs);
  }, [specs, onChange]);

  const addItem = useCallback(() => {
    const newNode = { id: generateId(), key: '', value: '' };
    onChange([...specs, newNode]);
  }, [specs, onChange]);

  const addGroup = useCallback(() => {
    const newNode = { id: generateId(), key: '', children: [] };
    onChange([...specs, newNode]);
  }, [specs, onChange]);

  const addChildItem = useCallback((parentId) => {
    const newChild = { id: generateId(), key: '', value: '' };
    const addToNode = (nodes) => {
      return nodes.map(node => {
        if (node.id === parentId && Array.isArray(node.children)) {
          return { ...node, children: [...node.children, newChild] };
        }
        if (node.children) {
          return { ...node, children: addToNode(node.children) };
        }
        return node;
      });
    };
    onChange(addToNode(specs));
  }, [specs, onChange]);

  const addChildGroup = useCallback((parentId) => {
    const newChild = { id: generateId(), key: '', children: [] };
    const addToNode = (nodes) => {
      return nodes.map(node => {
        if (node.id === parentId && Array.isArray(node.children)) {
          return { ...node, children: [...node.children, newChild] };
        }
        if (node.children) {
          return { ...node, children: addToNode(node.children) };
        }
        return node;
      });
    };
    onChange(addToNode(specs));
  }, [specs, onChange]);

  return (
    <Container>
      <Header>
        <Title>{moduleName ? `${moduleName} - 스펙 정의` : '스펙 정의'}</Title>
        <HeaderActions>
          <AddButton onClick={addItem}>
            <Plus size={14} />
            항목 추가
          </AddButton>
          <AddButton onClick={addGroup}>
            <FolderPlus size={14} />
            그룹 추가
          </AddButton>
        </HeaderActions>
      </Header>
      <TreeContent>
        {specs.length === 0 ? (
          <EmptyState>
            <FolderPlus size={32} />
            <p>스펙 항목이 없습니다.<br />위 버튼으로 항목 또는 그룹을 추가하세요.</p>
          </EmptyState>
        ) : (
          specs.map(node => (
            <SpecNodeRow
              key={node.id}
              node={node}
              depth={0}
              onUpdate={handleNodeUpdate}
              onDelete={handleNodeDelete}
              onAddChild={addChildItem}
              onAddGroup={addChildGroup}
            />
          ))
        )}
      </TreeContent>
    </Container>
  );
};

export default SpecTreeEditor;
