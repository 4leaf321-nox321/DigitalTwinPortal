import React, { useState, useEffect, useMemo, useRef } from 'react';
import styled from 'styled-components';
import { X, Search, Link2, Unlink } from 'lucide-react';

const Overlay = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
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
  width: 85vw;
  max-width: 1100px;
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
  display: flex;
  align-items: center;
  gap: 8px;
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
  &:hover { background: #e2e8f0; color: #1e293b; }
`;

const ModalBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0;
`;

const ModalFooter = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
`;

const FooterInfo = styled.span`
  font-size: 0.78rem;
  color: #94a3b8;
`;

const SaveButton = styled.button`
  padding: 8px 20px;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  background: #06b6d4;
  color: white;
  &:hover { background: #0891b2; }
`;

/* ── Table ── */
const TaskTable = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const Th = styled.th`
  position: sticky;
  top: 0;
  background: #f1f5f9;
  padding: 10px 14px;
  font-size: 0.75rem;
  font-weight: 700;
  color: #475569;
  text-align: left;
  border-bottom: 2px solid #e2e8f0;
  z-index: 5;
  white-space: nowrap;
`;

const Tr = styled.tr`
  &:hover { background: #f8fafc; }
  border-bottom: 1px solid #f1f5f9;
`;

const Td = styled.td`
  padding: 10px 14px;
  font-size: 0.82rem;
  color: #334155;
  vertical-align: top;
`;

const TaskName = styled.div`
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 2px;
`;

const TaskMeta = styled.div`
  font-size: 0.72rem;
  color: #94a3b8;
`;

const StatusBadge = styled.span`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.7rem;
  font-weight: 600;
  background: ${p => {
    switch (p.$status) {
      case '완료': return '#f0fdf4';
      case '진행': return '#eff6ff';
      case '계획': return '#fffbeb';
      default: return '#f1f5f9';
    }
  }};
  color: ${p => {
    switch (p.$status) {
      case '완료': return '#16a34a';
      case '진행': return '#2563eb';
      case '계획': return '#d97706';
      default: return '#64748b';
    }
  }};
`;

/* ── Linked chips ── */
const LinkedArea = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const LinkedChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
`;

const Chip = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 8px 3px 10px;
  background: #ecfeff;
  border: 1px solid #a5f3fc;
  border-radius: 14px;
  font-size: 0.73rem;
  color: #0e7490;
  white-space: nowrap;
`;

const ChipYear = styled.span`
  font-size: 0.65rem;
  color: #94a3b8;
  margin-left: 1px;
`;

const ChipRemove = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  padding: 1px;
  color: #67e8f9;
  border-radius: 50%;
  &:hover { background: #cffafe; color: #0891b2; }
`;

const NoLink = styled.span`
  font-size: 0.75rem;
  color: #cbd5e1;
`;

/* ── Inline picker ── */
const PickerWrapper = styled.div`
  position: relative;
  display: inline-flex;
`;

const AddLinkButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 8px;
  border: 1px dashed #cbd5e1;
  border-radius: 14px;
  background: white;
  font-size: 0.73rem;
  color: #94a3b8;
  cursor: pointer;
  &:hover { border-color: #06b6d4; color: #0891b2; }
`;

const Dropdown = styled.div`
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  width: 360px;
  max-height: 260px;
  overflow: hidden;
  background: white;
  border: 1px solid #06b6d4;
  border-radius: 8px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
  z-index: 100;
  display: flex;
  flex-direction: column;
`;

const SearchRow = styled.div`
  display: flex;
  gap: 6px;
  padding: 8px;
  border-bottom: 1px solid #e2e8f0;
`;

const SearchInputWrapper = styled.div`
  position: relative;
  flex: 1;
`;

const SearchIcon = styled.div`
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  color: #94a3b8;
  display: flex;
  align-items: center;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 6px 8px 6px 28px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 0.8rem;
  color: #1e293b;
  box-sizing: border-box;
  &:focus { outline: none; border-color: #06b6d4; }
`;

const YearFilter = styled.select`
  padding: 6px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 0.8rem;
  color: #1e293b;
  background: white;
  min-width: 80px;
  &:focus { outline: none; border-color: #06b6d4; }
`;

const DropdownList = styled.div`
  overflow-y: auto;
  flex: 1;
`;

const DropdownItem = styled.div`
  padding: 7px 12px;
  cursor: pointer;
  font-size: 0.8rem;
  color: #334155;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  justify-content: space-between;
  align-items: center;
  &:last-child { border-bottom: none; }
  &:hover { background: #ecfeff; color: #0891b2; }
`;

const DropdownMeta = styled.span`
  font-size: 0.7rem;
  color: #94a3b8;
`;

const DropdownEmpty = styled.div`
  padding: 16px;
  text-align: center;
  color: #94a3b8;
  font-size: 0.8rem;
`;


const TaskLinkModal = ({ isOpen, onClose, tasks = [], dashboardProjects = [], onSave }) => {
  // local copy of connectedDtTask per task id
  const [linkMap, setLinkMap] = useState({});
  // which row's picker is open
  const [openPickerId, setOpenPickerId] = useState(null);
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const pickerRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      const map = {};
      tasks.forEach(t => {
        map[t.id] = Array.isArray(t.connectedDtTask) ? [...t.connectedDtTask] : [];
      });
      setLinkMap(map);
      setOpenPickerId(null);
      setSearch('');
      setYearFilter('');
    }
  }, [isOpen, tasks]);

  // Close picker on outside click
  useEffect(() => {
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setOpenPickerId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const projectYears = useMemo(() => {
    const years = [...new Set(dashboardProjects.map(p => p.year).filter(Boolean))];
    return years.sort((a, b) => String(b).localeCompare(String(a)));
  }, [dashboardProjects]);

  const getLinkedIds = (taskId) => {
    return new Set((linkMap[taskId] || []).map(p => p.projectId));
  };

  const filteredProjects = useMemo(() => {
    const linkedIds = openPickerId ? getLinkedIds(openPickerId) : new Set();
    return dashboardProjects.filter(p => {
      if (linkedIds.has(p.projectId)) return false;
      if (yearFilter && String(p.year) !== String(yearFilter)) return false;
      if (search) {
        const term = search.toLowerCase();
        return p.projectName.toLowerCase().includes(term) ||
               (p.division && p.division.toLowerCase().includes(term));
      }
      return true;
    });
  }, [dashboardProjects, openPickerId, linkMap, yearFilter, search]);

  const handleAddLink = (taskId, project) => {
    setLinkMap(prev => ({
      ...prev,
      [taskId]: [...(prev[taskId] || []), { ...project }],
    }));
    setOpenPickerId(null);
    setSearch('');
  };

  const handleRemoveLink = (taskId, projectId) => {
    setLinkMap(prev => ({
      ...prev,
      [taskId]: (prev[taskId] || []).filter(p => p.projectId !== projectId),
    }));
  };

  const handleOpenPicker = (taskId) => {
    setOpenPickerId(openPickerId === taskId ? null : taskId);
    setSearch('');
    setYearFilter('');
  };

  // Count how many tasks were changed
  const changedCount = useMemo(() => {
    let count = 0;
    tasks.forEach(t => {
      const original = Array.isArray(t.connectedDtTask) ? t.connectedDtTask : [];
      const current = linkMap[t.id] || [];
      const origIds = original.map(p => p.projectId).sort().join(',');
      const currIds = current.map(p => p.projectId).sort().join(',');
      if (origIds !== currIds) count++;
    });
    return count;
  }, [tasks, linkMap]);

  const handleSave = () => {
    // Collect only changed tasks
    const updates = [];
    tasks.forEach(t => {
      const original = Array.isArray(t.connectedDtTask) ? t.connectedDtTask : [];
      const current = linkMap[t.id] || [];
      const origIds = original.map(p => p.projectId).sort().join(',');
      const currIds = current.map(p => p.projectId).sort().join(',');
      if (origIds !== currIds) {
        updates.push({ id: t.id, connectedDtTask: current });
      }
    });
    onSave(updates);
  };

  if (!isOpen) return null;

  return (
    <Overlay onClick={onClose}>
      <Modal onClick={e => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>
            <Link2 size={20} />
            과제 연결 관리
          </ModalTitle>
          <CloseButton onClick={onClose}><X size={20} /></CloseButton>
        </ModalHeader>

        <ModalBody>
          <TaskTable>
            <thead>
              <tr>
                <Th style={{ width: '30%' }}>과제</Th>
                <Th style={{ width: '10%' }}>상태</Th>
                <Th style={{ width: '10%' }}>연도</Th>
                <Th>연결된 DT 과제</Th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => {
                const linked = linkMap[task.id] || [];
                return (
                  <Tr key={task.id}>
                    <Td>
                      <TaskName>{task.name}</TaskName>
                      <TaskMeta>
                        {[task.category, task.testItem].filter(Boolean).join(' / ')}
                      </TaskMeta>
                    </Td>
                    <Td>
                      {task.status && <StatusBadge $status={task.status}>{task.status}</StatusBadge>}
                    </Td>
                    <Td>{task.year || '-'}</Td>
                    <Td>
                      <LinkedArea>
                        <LinkedChips>
                          {linked.map(p => (
                            <Chip key={p.projectId}>
                              {p.projectName}
                              {p.year && <ChipYear>({p.year})</ChipYear>}
                              <ChipRemove onClick={() => handleRemoveLink(task.id, p.projectId)}>
                                <X size={11} />
                              </ChipRemove>
                            </Chip>
                          ))}
                          <PickerWrapper ref={openPickerId === task.id ? pickerRef : null}>
                            <AddLinkButton onClick={() => handleOpenPicker(task.id)}>
                              + 연결
                            </AddLinkButton>
                            {openPickerId === task.id && (
                              <Dropdown>
                                <SearchRow>
                                  <YearFilter
                                    value={yearFilter}
                                    onChange={e => setYearFilter(e.target.value)}
                                  >
                                    <option value="">전체 연도</option>
                                    {projectYears.map(y => (
                                      <option key={y} value={y}>{y}</option>
                                    ))}
                                  </YearFilter>
                                  <SearchInputWrapper>
                                    <SearchIcon><Search size={13} /></SearchIcon>
                                    <SearchInput
                                      type="text"
                                      placeholder="과제명 검색..."
                                      value={search}
                                      onChange={e => setSearch(e.target.value)}
                                      autoFocus
                                    />
                                  </SearchInputWrapper>
                                </SearchRow>
                                <DropdownList>
                                  {filteredProjects.length > 0 ? (
                                    filteredProjects.map(project => (
                                      <DropdownItem
                                        key={project.projectId}
                                        onClick={() => handleAddLink(task.id, project)}
                                      >
                                        <span>{project.projectName}</span>
                                        <DropdownMeta>
                                          {[project.division, project.year].filter(Boolean).join(' / ')}
                                        </DropdownMeta>
                                      </DropdownItem>
                                    ))
                                  ) : (
                                    <DropdownEmpty>
                                      {dashboardProjects.length === 0
                                        ? '대시보드에 등록된 과제가 없습니다'
                                        : '검색 결과가 없습니다'}
                                    </DropdownEmpty>
                                  )}
                                </DropdownList>
                              </Dropdown>
                            )}
                          </PickerWrapper>
                        </LinkedChips>
                      </LinkedArea>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </TaskTable>
        </ModalBody>

        <ModalFooter>
          <FooterInfo>
            {changedCount > 0 ? `${changedCount}건의 과제가 변경됨` : '변경사항 없음'}
          </FooterInfo>
          <SaveButton onClick={handleSave} disabled={changedCount === 0}>
            저장
          </SaveButton>
        </ModalFooter>
      </Modal>
    </Overlay>
  );
};

export default TaskLinkModal;
