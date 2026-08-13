import React, { useState, useEffect, useRef, useMemo } from 'react';
import styled from 'styled-components';
import { X, Search, ChevronDown } from 'lucide-react';

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
`;

const Modal = styled.div`
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  width: 80vw;
  height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
`;

const ModalTitle = styled.h3`
  margin: 0;
  font-size: 1.1rem;
  color: #1e293b;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;

  &:hover {
    background: #e2e8f0;
    color: #1e293b;
  }
`;

const ModalBody = styled.div`
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Label = styled.label`
  font-size: 0.8rem;
  font-weight: 600;
  color: #475569;
`;

const Required = styled.span`
  color: #ef4444;
  margin-left: 2px;
`;

const Input = styled.input`
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.875rem;
  color: #1e293b;

  &:focus {
    outline: none;
    border-color: #06b6d4;
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.1);
  }
`;

const Select = styled.select`
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.875rem;
  color: #1e293b;
  background: white;

  &:focus {
    outline: none;
    border-color: #06b6d4;
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.1);
  }
`;

const TextArea = styled.textarea`
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.875rem;
  color: #1e293b;
  resize: vertical;
  min-height: 80px;

  &:focus {
    outline: none;
    border-color: #06b6d4;
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.1);
  }
`;

const FormRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
`;

const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
`;

const CancelButton = styled.button`
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid #e2e8f0;
  background: white;
  color: #64748b;

  &:hover {
    background: #f1f5f9;
  }
`;

const SaveButton = styled.button`
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  background: #06b6d4;
  color: white;

  &:hover {
    background: #0891b2;
  }

  &:disabled {
    background: #94a3b8;
    cursor: not-allowed;
  }
`;

/* ---- Project Picker styles ---- */

const ProjectPickerWrapper = styled.div`
  position: relative;
`;

const ProjectSearchRow = styled.div`
  display: flex;
  gap: 8px;
  align-items: stretch;
`;

const ProjectSearchInputWrapper = styled.div`
  position: relative;
  flex: 1;
`;

const ProjectSearchIcon = styled.div`
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: #94a3b8;
  display: flex;
  align-items: center;
`;

const ProjectSearchInput = styled.input`
  width: 100%;
  padding: 8px 12px 8px 32px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.85rem;
  color: #1e293b;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: #06b6d4;
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.1);
  }
`;

const YearFilter = styled.select`
  padding: 8px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.85rem;
  color: #1e293b;
  background: white;
  min-width: 90px;

  &:focus {
    outline: none;
    border-color: #06b6d4;
  }
`;

const ProjectDropdown = styled.div`
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  max-height: 200px;
  overflow-y: auto;
  background: white;
  border: 1px solid #06b6d4;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  z-index: 100;
`;

const ProjectDropdownItem = styled.div`
  padding: 8px 12px;
  cursor: pointer;
  font-size: 0.85rem;
  color: #334155;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  justify-content: space-between;
  align-items: center;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: #ecfeff;
    color: #0891b2;
  }
`;

const ProjectDropdownMeta = styled.span`
  font-size: 0.75rem;
  color: #94a3b8;
`;

const ProjectDropdownEmpty = styled.div`
  padding: 12px;
  text-align: center;
  color: #94a3b8;
  font-size: 0.85rem;
`;

const LinkedProjectsList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
`;

const LinkedProjectChip = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px 4px 10px;
  background: #ecfeff;
  border: 1px solid #a5f3fc;
  border-radius: 16px;
  font-size: 0.78rem;
  color: #0e7490;
`;

const ChipRemoveButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  padding: 1px;
  color: #67e8f9;
  border-radius: 50%;

  &:hover {
    background: #cffafe;
    color: #0891b2;
  }
`;

const ChipYear = styled.span`
  font-size: 0.7rem;
  color: #94a3b8;
  margin-left: 2px;
`;

/* ---- end Project Picker styles ---- */

const EMPTY_FORM = {
  name: '',
  divisionId: '',
  testItem: '',
  testItemDetail: '',
  category: '',
  productFamily: [],
  year: '',
  status: '',
  connectedDtTask: [],
  description: '',
};

const TaskModal = ({ isOpen, onClose, onSave, task, divisions, categories, statuses, productFamilies = [], dashboardProjects = [] }) => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [projectSearch, setProjectSearch] = useState('');
  const [projectYearFilter, setProjectYearFilter] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setForm(task ? {
        name: task.name || '',
        divisionId: task.divisionId || '',
        testItem: task.testItem || '',
        testItemDetail: task.testItemDetail || '',
        category: task.category || '',
        productFamily: Array.isArray(task.productFamily) ? task.productFamily : (task.productFamily ? [task.productFamily] : []),
        year: task.year || '',
        status: task.status || '',
        connectedDtTask: Array.isArray(task.connectedDtTask) ? task.connectedDtTask : [],
        description: task.description || '',
      } : EMPTY_FORM);
      setProjectSearch('');
      setProjectYearFilter('');
      setIsDropdownOpen(false);
    }
  }, [isOpen, task]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  // Unique years from dashboard projects
  const projectYears = useMemo(() => {
    const years = [...new Set(dashboardProjects.map(p => p.year).filter(Boolean))];
    return years.sort((a, b) => String(b).localeCompare(String(a)));
  }, [dashboardProjects]);

  // Already linked project IDs
  const linkedIds = useMemo(() => {
    return new Set(form.connectedDtTask.map(p => p.projectId));
  }, [form.connectedDtTask]);

  // Filtered project list
  const filteredProjects = useMemo(() => {
    return dashboardProjects.filter(p => {
      if (linkedIds.has(p.projectId)) return false;
      if (projectYearFilter && String(p.year) !== String(projectYearFilter)) return false;
      if (projectSearch) {
        const term = projectSearch.toLowerCase();
        return p.projectName.toLowerCase().includes(term) ||
               (p.division && p.division.toLowerCase().includes(term));
      }
      return true;
    });
  }, [dashboardProjects, linkedIds, projectYearFilter, projectSearch]);

  const handleAddProject = (project) => {
    setForm(prev => ({
      ...prev,
      connectedDtTask: [...prev.connectedDtTask, { ...project }],
    }));
    setProjectSearch('');
    setIsDropdownOpen(false);
  };

  const handleRemoveProject = (projectId) => {
    setForm(prev => ({
      ...prev,
      connectedDtTask: prev.connectedDtTask.filter(p => p.projectId !== projectId),
    }));
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    onSave({ ...form, name: form.name.trim() });
  };

  if (!isOpen) return null;

  return (
    <Overlay onClick={onClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>{task ? '과제 수정' : '새 과제 추가'}</ModalTitle>
          <CloseButton onClick={onClose}>
            <X size={20} />
          </CloseButton>
        </ModalHeader>

        <ModalBody>
          <FormGroup>
            <Label>과제명<Required>*</Required></Label>
            <Input
              type="text"
              value={form.name}
              onChange={handleChange('name')}
              placeholder="과제명을 입력하세요"
              autoFocus
            />
          </FormGroup>

          <FormRow>
            <FormGroup>
              <Label>사업부</Label>
              <Select value={form.divisionId} onChange={handleChange('divisionId')}>
                <option value="">선택</option>
                {divisions.map(div => (
                  <option key={div.id} value={div.id}>{div.name}</option>
                ))}
              </Select>
            </FormGroup>

            <FormGroup>
              <Label>항목</Label>
              <Input
                type="text"
                value={form.testItem}
                onChange={handleChange('testItem')}
                placeholder="항목명"
              />
            </FormGroup>
          </FormRow>

          <FormRow>
            <FormGroup>
              <Label>항목 상세</Label>
              <Input
                type="text"
                value={form.testItemDetail}
                onChange={handleChange('testItemDetail')}
                placeholder="항목 상세"
              />
            </FormGroup>
            <div />
          </FormRow>

          <FormRow>
            <FormGroup>
              <Label>구분</Label>
              <Select value={form.category} onChange={handleChange('category')}>
                <option value="">선택</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </Select>
            </FormGroup>

            <FormGroup>
              <Label>적용 제품군</Label>
              <Select
                value=""
                onChange={(e) => {
                  const val = e.target.value;
                  if (val && !form.productFamily.includes(val)) {
                    setForm(prev => ({ ...prev, productFamily: [...prev.productFamily, val] }));
                  }
                }}
              >
                <option value="">선택하여 추가</option>
                {productFamilies
                  .filter(pf => !form.divisionId || pf.divisionId === form.divisionId)
                  .filter(pf => !form.productFamily.includes(pf.name))
                  .map(pf => (
                    <option key={pf.name} value={pf.name}>{pf.name}</option>
                  ))}
              </Select>
              {form.productFamily.length > 0 && (
                <LinkedProjectsList>
                  {form.productFamily.map(name => (
                    <LinkedProjectChip key={name}>
                      {name}
                      <ChipRemoveButton onClick={() => {
                        setForm(prev => ({ ...prev, productFamily: prev.productFamily.filter(n => n !== name) }));
                      }}>
                        <X size={12} />
                      </ChipRemoveButton>
                    </LinkedProjectChip>
                  ))}
                </LinkedProjectsList>
              )}
            </FormGroup>
          </FormRow>

          <FormRow>
            <FormGroup>
              <Label>연도</Label>
              <Input
                type="text"
                value={form.year}
                onChange={handleChange('year')}
                placeholder="예: 2026"
              />
            </FormGroup>

            <FormGroup>
              <Label>상태</Label>
              <Select value={form.status} onChange={handleChange('status')}>
                <option value="">선택</option>
                {statuses.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </FormGroup>
          </FormRow>

          {/* 연결 DT 과제 - Searchable Multi-Project Picker */}
          <FormGroup>
            <Label>연결 DT 과제</Label>
            <ProjectPickerWrapper ref={dropdownRef}>
              <ProjectSearchRow>
                <YearFilter
                  value={projectYearFilter}
                  onChange={(e) => setProjectYearFilter(e.target.value)}
                >
                  <option value="">전체 연도</option>
                  {projectYears.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </YearFilter>
                <ProjectSearchInputWrapper>
                  <ProjectSearchIcon>
                    <Search size={14} />
                  </ProjectSearchIcon>
                  <ProjectSearchInput
                    type="text"
                    placeholder="과제명 검색..."
                    value={projectSearch}
                    onChange={(e) => {
                      setProjectSearch(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                  />
                </ProjectSearchInputWrapper>
              </ProjectSearchRow>

              {isDropdownOpen && (
                <ProjectDropdown>
                  {filteredProjects.length > 0 ? (
                    filteredProjects.map(project => (
                      <ProjectDropdownItem
                        key={project.projectId}
                        onClick={() => handleAddProject(project)}
                      >
                        <span>{project.projectName}</span>
                        <ProjectDropdownMeta>
                          {[project.division, project.year].filter(Boolean).join(' / ')}
                        </ProjectDropdownMeta>
                      </ProjectDropdownItem>
                    ))
                  ) : (
                    <ProjectDropdownEmpty>
                      {dashboardProjects.length === 0 ? '대시보드에 등록된 과제가 없습니다' : '검색 결과가 없습니다'}
                    </ProjectDropdownEmpty>
                  )}
                </ProjectDropdown>
              )}
            </ProjectPickerWrapper>

            {form.connectedDtTask.length > 0 && (
              <LinkedProjectsList>
                {form.connectedDtTask.map(p => (
                  <LinkedProjectChip key={p.projectId}>
                    {p.projectName}
                    {p.year && <ChipYear>({p.year})</ChipYear>}
                    <ChipRemoveButton onClick={() => handleRemoveProject(p.projectId)}>
                      <X size={12} />
                    </ChipRemoveButton>
                  </LinkedProjectChip>
                ))}
              </LinkedProjectsList>
            )}
          </FormGroup>

          <FormGroup>
            <Label>설명</Label>
            <TextArea
              value={form.description}
              onChange={handleChange('description')}
              placeholder="과제 설명을 입력하세요"
            />
          </FormGroup>
        </ModalBody>

        <ModalFooter>
          <CancelButton onClick={onClose}>취소</CancelButton>
          <SaveButton onClick={handleSubmit} disabled={!form.name.trim()}>
            {task ? '수정' : '추가'}
          </SaveButton>
        </ModalFooter>
      </Modal>
    </Overlay>
  );
};

export default TaskModal;
