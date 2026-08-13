import React from 'react';
import styled from 'styled-components';
import { Plus, Package, Trash2, CheckSquare, Square, MinusSquare } from 'lucide-react';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f8fafc;
  border-right: 1px solid #e2e8f0;
`;

const Header = styled.div`
  padding: 16px;
  border-bottom: 1px solid #e2e8f0;
  background: white;
`;

const Title = styled.h3`
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 13px;
  background: #f8fafc;

  &:focus {
    outline: none;
    border-color: #8b5cf6;
    background: white;
  }

  &::placeholder {
    color: #94a3b8;
  }
`;

const ListContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 12px;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
  }
`;

const MaterialCard = styled.div`
  padding: 14px;
  background: ${props => props.selected ? '#8b5cf6' : 'white'};
  border: 1px solid ${props => props.selected ? '#8b5cf6' : '#e2e8f0'};
  border-radius: 10px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: ${props => props.selected ? '#8b5cf6' : '#8b5cf6'};
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  &:last-child {
    margin-bottom: 0;
  }
`;

const MaterialCardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
`;

const MaterialIcon = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: ${props => props.selected ? 'rgba(255,255,255,0.2)' : '#f1f5f9'};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${props => props.selected ? 'white' : '#8b5cf6'};
  flex-shrink: 0;
`;

const MaterialHeaderInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const MaterialName = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: ${props => props.selected ? 'white' : '#1e293b'};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const MaterialGrade = styled.div`
  font-size: 11px;
  color: ${props => props.selected ? 'rgba(255,255,255,0.8)' : '#64748b'};
  margin-top: 2px;
`;

const TestCount = styled.div`
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  background: ${props => props.selected ? 'rgba(255,255,255,0.2)' : '#e2e8f0'};
  color: ${props => props.selected ? 'white' : '#64748b'};
  flex-shrink: 0;
`;

const MaterialProperties = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 10px;
  padding-top: 10px;
  border-top: 1px solid ${props => props.selected ? 'rgba(255,255,255,0.2)' : '#e2e8f0'};
`;

const PropertyItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
`;

const PropertyLabel = styled.span`
  font-size: 9px;
  color: ${props => props.selected ? 'rgba(255,255,255,0.6)' : '#94a3b8'};
  text-transform: uppercase;
  letter-spacing: 0.3px;
`;

const PropertyValue = styled.span`
  font-size: 11px;
  color: ${props => props.selected ? 'rgba(255,255,255,0.9)' : '#475569'};
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const AddButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 10px;
  margin-top: 12px;
  border: 2px dashed #d1d5db;
  border-radius: 8px;
  background: transparent;
  color: #64748b;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: #8b5cf6;
    color: #8b5cf6;
    background: #faf5ff;
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: #94a3b8;
  text-align: center;

  svg {
    margin-bottom: 12px;
    opacity: 0.5;
  }

  p {
    font-size: 13px;
    margin: 0;
  }
`;

const SelectionBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #f1f5f9;
  border-bottom: 1px solid #e2e8f0;
`;

const SelectAllContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;

  &:hover {
    color: #8b5cf6;
  }
`;

const SelectAllCheckbox = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${props => props.checked ? '#8b5cf6' : '#94a3b8'};
`;

const SelectAllLabel = styled.span`
  font-size: 12px;
  color: #64748b;
`;

const DeleteSelectedButton = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #dc2626;
  }

  &:disabled {
    background: #d1d5db;
    cursor: not-allowed;
  }
`;

const Checkbox = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  color: ${props => props.checked ? '#8b5cf6' : props.cardSelected ? 'rgba(255,255,255,0.6)' : '#94a3b8'};
  cursor: pointer;
  transition: color 0.2s;

  &:hover {
    color: ${props => props.cardSelected ? 'white' : '#8b5cf6'};
  }
`;

const MaterialListPanel = ({
  materials = [],
  selectedMaterialId,
  onSelectMaterial,
  onAddMaterial,
  searchQuery,
  onSearchChange,
  checkedIds = [],
  onCheckedIdsChange,
  onDeleteSelected
}) => {
  const filteredMaterials = materials.filter(material => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const data = material.data || {};

    const family = (data.family || '').toLowerCase();
    const category = (data.category || '').toLowerCase();
    const grade = (data.grade || '').toLowerCase();
    const details = (data.details || '').toLowerCase();
    const thickness = (data.specThickness || '').toLowerCase();
    const orientation = (data.orientation || '').toLowerCase();
    const manufacturer = (data.manufacturer || '').toLowerCase();

    return family.includes(query) ||
           category.includes(query) ||
           grade.includes(query) ||
           details.includes(query) ||
           thickness.includes(query) ||
           orientation.includes(query) ||
           manufacturer.includes(query);
  });

  // 필터된 항목들의 ID 목록
  const filteredIds = filteredMaterials.map(m => m.id);

  // 필터된 항목 중 체크된 것들
  const checkedFilteredIds = checkedIds.filter(id => filteredIds.includes(id));

  // 전체 선택 상태 계산
  const isAllChecked = filteredMaterials.length > 0 && checkedFilteredIds.length === filteredMaterials.length;
  const isPartialChecked = checkedFilteredIds.length > 0 && checkedFilteredIds.length < filteredMaterials.length;

  // 전체 선택/해제 토글
  const handleSelectAll = () => {
    if (isAllChecked) {
      // 필터된 항목들만 체크 해제
      onCheckedIdsChange(checkedIds.filter(id => !filteredIds.includes(id)));
    } else {
      // 필터된 항목들 모두 체크 (기존 체크 유지)
      const newCheckedIds = [...new Set([...checkedIds, ...filteredIds])];
      onCheckedIdsChange(newCheckedIds);
    }
  };

  // 개별 체크박스 토글
  const handleToggleCheck = (e, materialId) => {
    e.stopPropagation();
    if (checkedIds.includes(materialId)) {
      onCheckedIdsChange(checkedIds.filter(id => id !== materialId));
    } else {
      onCheckedIdsChange([...checkedIds, materialId]);
    }
  };

  const getTestCount = (material) => {
    let count = 0;
    if (material.tests) {
      Object.values(material.tests).forEach(tests => {
        count += tests.length;
      });
    }
    return count;
  };

  const getMaterialDisplayName = (material) => {
    const family = material.data?.family || '';
    const category = material.data?.category || '';
    const grade = material.data?.grade || '';

    if (family || category) {
      return `${family}${category ? '/' + category : ''}`;
    }
    return 'Unnamed Material';
  };

  return (
    <Container>
      <Header>
        <Title>Material 목록</Title>
        <SearchInput
          type="text"
          placeholder="검색..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <AddButton onClick={onAddMaterial}>
          <Plus size={16} />
          Material 추가
        </AddButton>
      </Header>

      {materials.length > 0 && (
        <SelectionBar>
          <SelectAllContainer onClick={handleSelectAll}>
            <SelectAllCheckbox checked={isAllChecked || isPartialChecked}>
              {isAllChecked ? (
                <CheckSquare size={18} />
              ) : isPartialChecked ? (
                <MinusSquare size={18} />
              ) : (
                <Square size={18} />
              )}
            </SelectAllCheckbox>
            <SelectAllLabel>
              {checkedFilteredIds.length > 0
                ? `${checkedFilteredIds.length}개 선택됨`
                : '전체 선택'}
            </SelectAllLabel>
          </SelectAllContainer>
          <DeleteSelectedButton
            onClick={onDeleteSelected}
            disabled={checkedIds.length === 0}
          >
            <Trash2 size={14} />
            삭제 ({checkedIds.length})
          </DeleteSelectedButton>
        </SelectionBar>
      )}

      <ListContainer>
        {filteredMaterials.length === 0 ? (
          <EmptyState>
            <Package size={40} />
            <p>등록된 Material이 없습니다.</p>
          </EmptyState>
        ) : (
          filteredMaterials.map(material => {
            const isSelected = selectedMaterialId === material.id;
            const data = material.data || {};

            const isChecked = checkedIds.includes(material.id);

            return (
              <MaterialCard
                key={material.id}
                selected={isSelected}
                onClick={() => onSelectMaterial(material.id)}
              >
                <MaterialCardHeader>
                  <Checkbox
                    checked={isChecked}
                    cardSelected={isSelected}
                    onClick={(e) => handleToggleCheck(e, material.id)}
                  >
                    {isChecked ? <CheckSquare size={18} /> : <Square size={18} />}
                  </Checkbox>
                  <MaterialIcon selected={isSelected}>
                    <Package size={18} />
                  </MaterialIcon>
                  <MaterialHeaderInfo>
                    <MaterialName selected={isSelected}>
                      {getMaterialDisplayName(material)}
                    </MaterialName>
                    <MaterialGrade selected={isSelected}>
                      {data.grade || 'No Grade'}
                    </MaterialGrade>
                  </MaterialHeaderInfo>
                  <TestCount selected={isSelected}>
                    {getTestCount(material)}건
                  </TestCount>
                </MaterialCardHeader>

                <MaterialProperties selected={isSelected}>
                  <PropertyItem>
                    <PropertyLabel selected={isSelected}>Details</PropertyLabel>
                    <PropertyValue selected={isSelected}>{data.details || '-'}</PropertyValue>
                  </PropertyItem>
                  <PropertyItem>
                    <PropertyLabel selected={isSelected}>Thickness</PropertyLabel>
                    <PropertyValue selected={isSelected}>{data.specThickness ? `${data.specThickness}mm` : '-'}</PropertyValue>
                  </PropertyItem>
                  <PropertyItem>
                    <PropertyLabel selected={isSelected}>Orientation</PropertyLabel>
                    <PropertyValue selected={isSelected}>{data.orientation || '-'}</PropertyValue>
                  </PropertyItem>
                  <PropertyItem>
                    <PropertyLabel selected={isSelected}>Manufacturer</PropertyLabel>
                    <PropertyValue selected={isSelected}>{data.manufacturer || '-'}</PropertyValue>
                  </PropertyItem>
                </MaterialProperties>
              </MaterialCard>
            );
          })
        )}
      </ListContainer>
    </Container>
  );
};

export default MaterialListPanel;
