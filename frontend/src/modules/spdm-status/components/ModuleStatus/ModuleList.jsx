import React, { useState, useMemo } from 'react';
import styled from 'styled-components';
import { Package, Plus, ListPlus, Trash2, Edit3, ArrowRight, Search, X } from 'lucide-react';

const Container = styled.div`
  width: 280px;
  min-width: 280px;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  background: #fafbfc;
`;

const ListHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e2e8f0;
`;

const ListTitle = styled.h3`
  font-size: 0.8125rem;
  font-weight: 600;
  color: #475569;
  margin: 0;
`;

const SearchBar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border-bottom: 1px solid #e2e8f0;
  background: white;
`;

const SearchIcon = styled.div`
  display: flex;
  color: #94a3b8;
  flex-shrink: 0;
`;

const SearchInput = styled.input`
  flex: 1;
  border: none;
  outline: none;
  font-size: 0.8125rem;
  color: #1e293b;
  background: transparent;
  min-width: 0;

  &::placeholder {
    color: #cbd5e1;
  }
`;

const ClearButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: none;
  background: #e2e8f0;
  border-radius: 50%;
  cursor: pointer;
  color: #64748b;
  padding: 0;
  flex-shrink: 0;

  &:hover {
    background: #cbd5e1;
    color: #334155;
  }
`;

const AddModuleButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  background: white;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: #8b5cf6;
    border-color: #8b5cf6;
    color: white;
  }
`;

const ModuleItems = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
`;

const ModuleItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.625rem 0.5rem 0.625rem 0.75rem;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.15s ease;
  background: ${props => props.$active ? '#ede9fe' : 'transparent'};
  border: 1px solid ${props => props.$active ? '#c4b5fd' : 'transparent'};
  margin-bottom: 0.25rem;

  &:hover {
    background: ${props => props.$active ? '#ede9fe' : '#f1f5f9'};
  }

  &:hover .module-actions {
    opacity: 1;
  }
`;

const ModuleIcon = styled.div`
  display: flex;
  align-items: center;
  color: ${props => props.$active ? '#8b5cf6' : '#94a3b8'};
  flex-shrink: 0;
`;

const ModuleInfo = styled.div`
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const BadgeRow = styled.div`
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
`;

const ModuleName = styled.span`
  font-size: 0.8125rem;
  font-weight: ${props => props.$active ? '600' : '500'};
  color: ${props => props.$active ? '#7c3aed' : '#334155'};
  word-break: break-word;
  line-height: 1.4;
`;

const CategoryBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.0625rem 0.375rem;
  background: #f1f5f9;
  color: #64748b;
  border-radius: 0.25rem;
  font-size: 0.625rem;
  font-weight: 600;
  flex-shrink: 0;
  line-height: 1.4;
`;

const SystemBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.0625rem 0.375rem;
  background: #eff6ff;
  color: #3b82f6;
  border-radius: 0.25rem;
  font-size: 0.625rem;
  font-weight: 600;
  flex-shrink: 0;
  line-height: 1.4;
`;

const DivisionBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.1875rem;
  padding: 0.0625rem 0.375rem;
  background: ${props => props.$color ? `${props.$color}18` : '#f5f3ff'};
  color: ${props => props.$color || '#7c3aed'};
  border-radius: 0.25rem;
  font-size: 0.625rem;
  font-weight: 600;
  flex-shrink: 0;
  line-height: 1.4;
`;

const LinkRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.625rem;
  font-weight: 600;
  color: #92400e;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 0.25rem;
  padding: 0.125rem 0.375rem;
  line-height: 1.3;
`;

const LinkSystem = styled.span`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 80px;
`;

const LinkArrow = styled.span`
  display: flex;
  align-items: center;
  color: #f59e0b;
  flex-shrink: 0;
`;

const ModuleActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  opacity: 0;
  transition: opacity 0.15s ease;
  flex-shrink: 0;
`;

const ActionButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  background: none;
  cursor: pointer;
  color: #94a3b8;
  padding: 0;
  border-radius: 0.25rem;

  &:hover {
    background: ${props => props.$danger ? '#fee2e2' : '#e2e8f0'};
    color: ${props => props.$danger ? '#ef4444' : '#475569'};
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  color: #94a3b8;
  text-align: center;

  p {
    margin: 0.5rem 0 0 0;
    font-size: 0.75rem;
    line-height: 1.4;
  }
`;

const CompareCheckbox = styled.input.attrs({ type: 'checkbox' })`
  width: 14px;
  height: 14px;
  accent-color: #8b5cf6;
  cursor: pointer;
  flex-shrink: 0;
`;

const HeaderButtons = styled.div`
  display: flex;
  gap: 4px;
`;

const ModuleList = ({
  modules,
  departments = [],
  selectedModuleId,
  compareMode,
  compareSelection,
  onSelect,
  onCompareToggle,
  onAdd,
  onBulkAdd,
  onEdit,
  onDelete
}) => {
  const deptMap = useMemo(() => {
    const map = {};
    departments.forEach(d => { map[d.id] = d; });
    map['__all__'] = { id: '__all__', name: '전체 (공용)', color: '#6366f1' };
    return map;
  }, [departments]);
  const [search, setSearch] = useState('');

  const filteredModules = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return modules;
    return modules.filter(m => m.name.toLowerCase().includes(q));
  }, [modules, search]);

  return (
    <Container>
      <ListHeader>
        <ListTitle>모듈 목록</ListTitle>
        <HeaderButtons>
          <AddModuleButton onClick={onAdd} title="모듈 추가">
            <Plus size={14} />
          </AddModuleButton>
          <AddModuleButton onClick={onBulkAdd} title="여러 모듈 추가">
            <ListPlus size={14} />
          </AddModuleButton>
        </HeaderButtons>
      </ListHeader>
      <SearchBar>
        <SearchIcon><Search size={14} /></SearchIcon>
        <SearchInput
          placeholder="모듈 검색..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <ClearButton onClick={() => setSearch('')}>
            <X size={10} />
          </ClearButton>
        )}
      </SearchBar>
      <ModuleItems>
        {modules.length === 0 ? (
          <EmptyState>
            <Package size={28} />
            <p>모듈이 없습니다.<br />+ 버튼으로 추가하세요.</p>
          </EmptyState>
        ) : filteredModules.length === 0 ? (
          <EmptyState>
            <Search size={24} />
            <p>'{search}' 검색 결과가 없습니다.</p>
          </EmptyState>
        ) : (
          filteredModules.map(mod => (
            <ModuleItem
              key={mod.id}
              $active={selectedModuleId === mod.id}
              onClick={() => onSelect(mod.id)}
            >
              {compareMode && (
                <CompareCheckbox
                  checked={compareSelection.includes(mod.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    onCompareToggle(mod.id);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              )}
              <ModuleIcon $active={selectedModuleId === mod.id}>
                <Package size={16} />
              </ModuleIcon>
              <ModuleInfo>
                <ModuleName $active={selectedModuleId === mod.id}>
                  {mod.name}
                </ModuleName>
                {((mod.categories && mod.categories.length > 0) || mod.systemType || deptMap[mod.divisionId]) && (
                  <BadgeRow>
                    {deptMap[mod.divisionId] && (
                      <DivisionBadge $color={deptMap[mod.divisionId].color}>
                        {deptMap[mod.divisionId].name}
                      </DivisionBadge>
                    )}
                    {mod.categories && mod.categories.map(cat => (
                      <CategoryBadge key={cat}>{cat}</CategoryBadge>
                    ))}
                    {mod.systemType && (
                      <SystemBadge>{mod.systemType}</SystemBadge>
                    )}
                  </BadgeRow>
                )}
                {mod.isLinked && mod.links && mod.links.map((link, idx) => {
                  if (!link.from && !link.to) return null;
                  const targetName = link.targetModuleId
                    ? (modules.find(m => m.id === link.targetModuleId)?.name || link.to)
                    : null;
                  return (
                    <LinkRow key={idx} title={`${link.from} → ${targetName || link.to}${link.method ? ` (${link.method})` : ''}`}>
                      <LinkSystem>{link.from}</LinkSystem>
                      <LinkArrow><ArrowRight size={10} /></LinkArrow>
                      <LinkSystem>{targetName || link.to}</LinkSystem>
                    </LinkRow>
                  );
                })}
              </ModuleInfo>
              <ModuleActions className="module-actions">
                <ActionButton
                  title="편집"
                  onClick={(e) => { e.stopPropagation(); onEdit(mod); }}
                >
                  <Edit3 size={12} />
                </ActionButton>
                <ActionButton
                  $danger
                  title="삭제"
                  onClick={(e) => { e.stopPropagation(); onDelete(mod.id); }}
                >
                  <Trash2 size={12} />
                </ActionButton>
              </ModuleActions>
            </ModuleItem>
          ))
        )}
      </ModuleItems>
    </Container>
  );
};

export default ModuleList;
