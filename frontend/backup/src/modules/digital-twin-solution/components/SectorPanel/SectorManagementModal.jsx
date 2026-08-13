import React, { useState, useEffect } from 'react';
import { X, Plus, Edit, Trash2, Save, AlertCircle } from 'lucide-react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
`;

const Modal = styled(motion.div)`
  background: white;
  border-radius: 1rem;
  padding: 2rem;
  width: 100%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e5e7eb;

  h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0;
  }
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: #6b7280;
  padding: 0.5rem;
  border-radius: 0.5rem;
  transition: all 0.2s;

  &:hover {
    color: #374151;
    background: #f3f4f6;
  }
`;

const SectorGrid = styled.div`
  display: grid;
  gap: 1rem;
  margin-bottom: 2rem;
`;

const SectorItem = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 0.75rem;
  border: 1px solid #e5e7eb;
  transition: all 0.2s;

  &:hover {
    border-color: #d1d5db;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
`;

const ColorIndicator = styled.div`
  width: 20px;
  height: 20px;
  border-radius: 50%;
  flex-shrink: 0;
  border: 2px solid white;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1);
`;

const SectorInfo = styled.div`
  flex: 1;
  min-width: 0;

  .name {
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 0.25rem;
  }

  .description {
    font-size: 0.875rem;
    color: #6b7280;
  }
`;

const SectorActions = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const ActionButton = styled.button`
  padding: 0.5rem;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;

  &.edit {
    background: #dbeafe;
    color: #1d4ed8;

    &:hover {
      background: #bfdbfe;
    }
  }

  &.delete {
    background: #fee2e2;
    color: #dc2626;

    &:hover {
      background: #fecaca;
    }
  }
`;

const AddSectorForm = styled.div`
  padding: 1.5rem;
  background: #f8fafc;
  border-radius: 0.75rem;
  border: 2px dashed #cbd5e1;
  margin-bottom: 2rem;
`;

const FormGroup = styled.div`
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr 100px 1fr;
  align-items: end;
  margin-bottom: 1rem;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;

  label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    margin-bottom: 0.5rem;
  }

  input {
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    transition: border-color 0.2s;

    &:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
  }
`;

const ColorInput = styled.input`
  width: 60px;
  height: 40px;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  cursor: pointer;
  background: none;

  &::-webkit-color-swatch {
    border: none;
    border-radius: 0.25rem;
  }
`;

const FormActions = styled.div`
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
`;

const Button = styled.button`
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 0.5rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &.primary {
    background: #3b82f6;
    color: white;

    &:hover:not(:disabled) {
      background: #2563eb;
    }

    &:disabled {
      background: #9ca3af;
      cursor: not-allowed;
    }
  }

  &.secondary {
    background: #f3f4f6;
    color: #374151;

    &:hover {
      background: #e5e7eb;
    }
  }
`;

const WarningMessage = styled.div`
  display: flex;
  align-items: start;
  gap: 0.75rem;
  padding: 1rem;
  background: #fef3c7;
  border: 1px solid #f59e0b;
  border-radius: 0.75rem;
  margin-top: 1rem;

  .icon {
    color: #d97706;
    margin-top: 0.125rem;
    flex-shrink: 0;
  }

  .content {
    font-size: 0.875rem;
    color: #92400e;

    .title {
      font-weight: 600;
      margin-bottom: 0.25rem;
    }

    .description {
      line-height: 1.5;
    }
  }
`;

const SectorManagementModal = ({ 
  isOpen, 
  onClose, 
  data, 
  onAddSector,
  onUpdateSector, 
  onDeleteSector,
  showSuccess,
  showError 
}) => {
  const [editingSector, setEditingSector] = useState(null);
  const [newSector, setNewSector] = useState({
    name: '',
    description: '',
    color: '#3B82F6'
  });

  // 컬러 팔레트
  const colorPalette = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', 
    '#8B5CF6', '#06B6D4', '#EC4899', '#84CC16',
    '#F97316', '#6366F1', '#14B8A6', '#EAB308'
  ];

  // 편집 모드 시작
  const startEdit = (sector) => {
    setEditingSector({
      ...sector,
      originalId: sector.id
    });
  };

  // 편집 취소
  const cancelEdit = () => {
    setEditingSector(null);
  };

  // 편집 저장
  const saveEdit = () => {
    if (!editingSector.name.trim()) {
      showError('섹터 이름을 입력해주세요.');
      return;
    }

    // ID 중복 검사 (이름이 변경된 경우)
    const existingSector = data.sectors.find(s => 
      s.id !== editingSector.originalId && 
      s.name.toLowerCase() === editingSector.name.toLowerCase()
    );

    if (existingSector) {
      showError('이미 존재하는 섹터 이름입니다.');
      return;
    }

    const updatedSector = {
      id: editingSector.name.toLowerCase().replace(/\s+/g, '-'),
      name: editingSector.name.trim(),
      description: editingSector.description.trim(),
      color: editingSector.color
    };

    onUpdateSector(editingSector.originalId, updatedSector);
    setEditingSector(null);
    showSuccess('섹터가 수정되었습니다.');
  };

  // 섹터 삭제
  const deleteSector = (sectorId) => {
    const sector = data.sectors.find(s => s.id === sectorId);
    const relatedSolutions = data.technologies.filter(tech => tech.sector === sectorId);
    
    if (relatedSolutions.length > 0) {
      const confirmMessage = `"${sector.name}" 섹터를 삭제하면 관련된 ${relatedSolutions.length}개의 솔루션도 함께 삭제됩니다.\n\n삭제될 솔루션들:\n${relatedSolutions.map(tech => `• ${tech.name}`).join('\n')}\n\n정말로 삭제하시겠습니까?`;
      
      if (!window.confirm(confirmMessage)) {
        return;
      }
    } else {
      if (!window.confirm(`"${sector.name}" 섹터를 삭제하시겠습니까?`)) {
        return;
      }
    }

    onDeleteSector(sectorId);
    showSuccess(`섹터 "${sector.name}"${relatedSolutions.length > 0 ? `와 관련 솔루션 ${relatedSolutions.length}개` : ''}가 삭제되었습니다.`);
  };

  // 새 섹터 추가
  const addSector = () => {
    if (!newSector.name.trim()) {
      showError('섹터 이름을 입력해주세요.');
      return;
    }

    // 중복 검사
    const existingSector = data.sectors.find(s => 
      s.name.toLowerCase() === newSector.name.toLowerCase()
    );

    if (existingSector) {
      showError('이미 존재하는 섹터 이름입니다.');
      return;
    }

    const sectorToAdd = {
      id: newSector.name.toLowerCase().replace(/\s+/g, '-'),
      name: newSector.name.trim(),
      description: newSector.description.trim(),
      color: newSector.color
    };

    onAddSector(sectorToAdd);
    setNewSector({ name: '', description: '', color: '#3B82F6' });
    showSuccess('새 섹터가 추가되었습니다.');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <Overlay onClick={onClose}>
        <Modal
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          onClick={e => e.stopPropagation()}
        >
          <Header>
            <h2>섹터 관리</h2>
            <CloseButton onClick={onClose}>
              <X size={20} />
            </CloseButton>
          </Header>

          {/* 새 섹터 추가 폼 */}
          <AddSectorForm>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: '600', color: '#374151' }}>
              새 섹터 추가
            </h3>
            <FormGroup>
              <InputGroup>
                <label>섹터 이름</label>
                <input
                  type="text"
                  placeholder="예: Smart City"
                  value={newSector.name}
                  onChange={(e) => setNewSector(prev => ({ ...prev, name: e.target.value }))}
                />
              </InputGroup>
              <InputGroup>
                <label>색상</label>
                <ColorInput
                  type="color"
                  value={newSector.color}
                  onChange={(e) => setNewSector(prev => ({ ...prev, color: e.target.value }))}
                />
              </InputGroup>
              <InputGroup>
                <label>설명</label>
                <input
                  type="text"
                  placeholder="섹터 설명"
                  value={newSector.description}
                  onChange={(e) => setNewSector(prev => ({ ...prev, description: e.target.value }))}
                />
              </InputGroup>
            </FormGroup>
            
            {/* 색상 팔레트 */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                추천 색상
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {colorPalette.map(color => (
                  <button
                    key={color}
                    style={{
                      width: '32px',
                      height: '32px',
                      backgroundColor: color,
                      border: newSector.color === color ? '3px solid #1f2937' : '1px solid #d1d5db',
                      borderRadius: '50%',
                      cursor: 'pointer'
                    }}
                    onClick={() => setNewSector(prev => ({ ...prev, color }))}
                  />
                ))}
              </div>
            </div>

            <FormActions>
              <Button 
                className="primary" 
                onClick={addSector}
                disabled={!newSector.name.trim()}
              >
                <Plus size={16} />
                섹터 추가
              </Button>
            </FormActions>
          </AddSectorForm>

          {/* 기존 섹터 목록 */}
          <div>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: '600', color: '#374151' }}>
              기존 섹터 ({data.sectors.length}개)
            </h3>
            <SectorGrid>
              {data.sectors.map(sector => (
                <SectorItem key={sector.id}>
                  {editingSector?.originalId === sector.id ? (
                    <>
                      <ColorInput
                        type="color"
                        value={editingSector.color}
                        onChange={(e) => setEditingSector(prev => ({ ...prev, color: e.target.value }))}
                      />
                      <div style={{ flex: 1, display: 'grid', gap: '0.5rem' }}>
                        <input
                          style={{
                            padding: '0.5rem',
                            border: '1px solid #d1d5db',
                            borderRadius: '0.25rem',
                            fontWeight: '600'
                          }}
                          value={editingSector.name}
                          onChange={(e) => setEditingSector(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="섹터 이름"
                        />
                        <input
                          style={{
                            padding: '0.5rem',
                            border: '1px solid #d1d5db',
                            borderRadius: '0.25rem',
                            fontSize: '0.875rem'
                          }}
                          value={editingSector.description}
                          onChange={(e) => setEditingSector(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="섹터 설명"
                        />
                      </div>
                      <SectorActions>
                        <ActionButton className="edit" onClick={saveEdit}>
                          <Save size={16} />
                        </ActionButton>
                        <ActionButton className="delete" onClick={cancelEdit}>
                          <X size={16} />
                        </ActionButton>
                      </SectorActions>
                    </>
                  ) : (
                    <>
                      <ColorIndicator style={{ backgroundColor: sector.color }} />
                      <SectorInfo>
                        <div className="name">{sector.name}</div>
                        <div className="description">{sector.description}</div>
                      </SectorInfo>
                      <SectorActions>
                        <ActionButton className="edit" onClick={() => startEdit(sector)}>
                          <Edit size={16} />
                        </ActionButton>
                        <ActionButton 
                          className="delete" 
                          onClick={() => deleteSector(sector.id)}
                        >
                          <Trash2 size={16} />
                        </ActionButton>
                      </SectorActions>
                    </>
                  )}
                </SectorItem>
              ))}
            </SectorGrid>

            {data.sectors.length === 0 && (
              <div style={{
                textAlign: 'center',
                padding: '2rem',
                color: '#6b7280',
                fontStyle: 'italic'
              }}>
                아직 등록된 섹터가 없습니다.
              </div>
            )}
          </div>

          {/* 경고 메시지 */}
          <WarningMessage>
            <div className="icon">
              <AlertCircle size={20} />
            </div>
            <div className="content">
              <div className="title">섹터 삭제 시 주의사항</div>
              <div className="description">
                섹터를 삭제하면 해당 섹터에 속한 모든 솔루션이 함께 삭제됩니다. 
                삭제된 데이터는 복구할 수 없으니 신중히 결정해주세요.
              </div>
            </div>
          </WarningMessage>
        </Modal>
      </Overlay>
    </AnimatePresence>
  );
};

export default SectorManagementModal;
