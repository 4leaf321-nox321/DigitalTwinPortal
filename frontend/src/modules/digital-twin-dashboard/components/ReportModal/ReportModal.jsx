import React, { useState, useMemo, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, X, Download, Search, FileArchive, File } from 'lucide-react';
import { countDetailLines } from '../ProjectModal/utils/formUtils';

const Overlay = styled(motion.div)`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
`;

const Modal = styled(motion.div)`
  background: white;
  border-radius: 1rem;
  width: 90%;
  max-width: 700px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  background: linear-gradient(135deg, #0066cc 0%, #0052a3 100%);
  color: white;

  h2 {
    font-size: 1.125rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
  }
`;

const CloseButton = styled.button`
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  width: 2rem;
  height: 2rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s;
  &:hover { background: rgba(255, 255, 255, 0.3); }
`;

const Body = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
`;

const SearchInput = styled.div`
  position: relative;
  svg {
    position: absolute;
    left: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    color: #9ca3af;
  }
  input {
    width: 100%;
    padding: 0.625rem 0.75rem 0.625rem 2.5rem;
    border: 2px solid #e5e7eb;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    box-sizing: border-box;
    &:focus {
      outline: none;
      border-color: #0066cc;
      box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.1);
    }
  }
`;

const SelectionBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.8125rem;
  color: #6b7280;
  button {
    background: none;
    border: none;
    color: #0066cc;
    cursor: pointer;
    font-size: 0.8125rem;
    font-weight: 600;
    &:hover { text-decoration: underline; }
  }
`;

const ProjectList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  max-height: 280px;
  overflow-y: auto;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 0.5rem;
`;

const ProjectRow = styled.label`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: background 0.15s;
  background: ${props => props.$checked ? '#eff6ff' : 'transparent'};
  &:hover { background: ${props => props.$checked ? '#dbeafe' : '#f9fafb'}; }

  input[type="checkbox"] {
    width: 1rem;
    height: 1rem;
    accent-color: #0066cc;
    flex-shrink: 0;
  }
`;

const ProjectInfo = styled.div`
  flex: 1;
  min-width: 0;
  .name {
    font-size: 0.875rem;
    font-weight: 600;
    color: #1f2937;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .meta {
    font-size: 0.75rem;
    color: #6b7280;
    margin-top: 0.125rem;
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
`;

const LineBadge = styled.span`
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
  flex-shrink: 0;
  background: ${props => {
    if (props.$lines === 0) return '#f3f4f6';
    if (props.$lines <= 8) return '#dcfce7';
    if (props.$lines <= 16) return '#fef9c3';
    return '#fee2e2';
  }};
  color: ${props => {
    if (props.$lines === 0) return '#6b7280';
    if (props.$lines <= 8) return '#166534';
    if (props.$lines <= 16) return '#854d0e';
    return '#991b1b';
  }};
`;

const ModeToggle = styled.div`
  display: flex;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  overflow: hidden;
`;

const ModeButton = styled.button`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  background: ${props => props.$active ? '#0066cc' : 'white'};
  color: ${props => props.$active ? 'white' : '#6b7280'};
  &:hover {
    background: ${props => props.$active ? '#0052a3' : '#f3f4f6'};
  }
`;

const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
`;

const Btn = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 600;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
`;

const CancelBtn = styled(Btn)`
  background: white;
  color: #6b7280;
  border: 1px solid #d1d5db;
  &:hover { background: #f3f4f6; }
`;

const DownloadBtn = styled(Btn)`
  background: linear-gradient(135deg, #0066cc 0%, #0052a3 100%);
  color: white;
  border: none;
  &:hover {
    background: linear-gradient(135deg, #0052a3 0%, #004080 100%);
    box-shadow: 0 4px 12px rgba(0, 102, 204, 0.3);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
  }
`;

const LoadingOverlay = styled.div`
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  z-index: 10;
  border-radius: 1rem;
`;

const Spinner = styled.div`
  width: 2.5rem;
  height: 2.5rem;
  border: 3px solid #e5e7eb;
  border-top-color: #0066cc;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  @keyframes spin { to { transform: rotate(360deg); } }
`;

const GroupCard = styled.div`
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  overflow: hidden;

  & + & {
    margin-top: 0.5rem;
  }
`;

const GroupHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.625rem 0.75rem;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  gap: 0.75rem;
`;

const GroupLabel = styled.div`
  font-size: 0.8125rem;
  font-weight: 600;
  color: #374151;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
`;

const GroupProjects = styled.div`
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  color: #6b7280;
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.5rem;
  max-height: 80px;
  overflow-y: auto;
`;

const selectStyle = {
  flex: 1,
  minWidth: 0,
  padding: '0.4rem 0.5rem',
  border: '2px solid #e5e7eb',
  borderRadius: '0.375rem',
  fontSize: '0.8125rem',
  color: '#1f2937',
  background: 'white',
  cursor: 'pointer',
  boxSizing: 'border-box',
};

const FilterRow = styled.div`
  display: flex;
  gap: 0.5rem;

  select {
    flex: 1;
    padding: 0.5rem 0.625rem;
    border: 2px solid #e5e7eb;
    border-radius: 0.5rem;
    font-size: 0.8125rem;
    color: #1f2937;
    background: white;
    cursor: pointer;
    box-sizing: border-box;
    &:focus {
      outline: none;
      border-color: #0066cc;
    }
  }
`;

const ReportModal = ({ isOpen, onClose, projects = [], settingsData, showSuccess, showError }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterYear, setFilterYear] = useState(() => String(new Date().getFullYear()));
  const [filterDivision, setFilterDivision] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [mode, setMode] = useState('single'); // 'single' | 'individual'
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [groupTemplates, setGroupTemplates] = useState({}); // { lineCount: templateFilename }

  // 모달 열릴 때 템플릿 목록 로드
  useEffect(() => {
    if (!isOpen) return;
    const fetchTemplates = async () => {
      try {
        const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const accessToken = localStorage.getItem('accessToken');
        const res = await fetch(`${API_BASE_URL}/digital-twin-dashboard/report/templates`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (res.ok) {
          const json = await res.json();
          const list = json.data || [];
          setTemplates(list);
        }
      } catch (err) {
        console.error('템플릿 목록 조회 실패:', err);
      }
    };
    fetchTemplates();
  }, [isOpen]);

  // 과제별 줄 수 캐시
  const lineCountMap = useMemo(() => {
    const map = {};
    for (const p of projects) {
      map[p.id] = countDetailLines(p);
    }
    return map;
  }, [projects]);

  // 연도/사업부 옵션 추출
  const yearOptions = useMemo(() => {
    const years = new Set(projects.map(p => p.과제년도).filter(Boolean));
    return [...years].sort((a, b) => b - a);
  }, [projects]);

  const divisionOptions = useMemo(() => {
    const projectDivs = new Set(projects.map(p => p.사업부).filter(Boolean));
    // settingsData의 divisions 순서를 따르되, 과제에 존재하는 것만 표시
    const settingsDivs = (settingsData?.divisions || []).map(d => d.name);
    const ordered = settingsDivs.filter(d => projectDivs.has(d));
    // settings에 없지만 과제에 있는 사업부는 뒤에 추가
    for (const d of projectDivs) {
      if (!ordered.includes(d)) ordered.push(d);
    }
    return ordered;
  }, [projects, settingsData]);

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (filterYear && String(p.과제년도) !== String(filterYear)) return false;
      if (filterDivision && p.사업부 !== filterDivision) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (
          !(p.과제명 || '').toLowerCase().includes(q) &&
          !(p.사업부 || '').toLowerCase().includes(q) &&
          !(p.과제PL || '').toLowerCase().includes(q) &&
          !(p.프로세스 || '').toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [projects, searchQuery, filterYear, filterDivision]);

  // 선택된 과제를 줄 수별로 그룹화
  const lineGroups = useMemo(() => {
    const selected = projects.filter(p => selectedIds.has(p.id));
    if (selected.length === 0) return [];

    // 줄 수별로 모으기
    const byCount = {};
    for (const p of selected) {
      const lines = lineCountMap[p.id] || 0;
      if (!byCount[lines]) byCount[lines] = [];
      byCount[lines].push(p);
    }

    // 줄 수 오름차순 정렬
    return Object.entries(byCount)
      .map(([lines, projs]) => ({ lines: parseInt(lines), projects: projs }))
      .sort((a, b) => a.lines - b.lines);
  }, [projects, selectedIds, lineCountMap]);

  // 새 그룹이 등장하면 기본 템플릿 할당
  useEffect(() => {
    if (templates.length === 0 || lineGroups.length === 0) return;
    const defaultTemplate = templates[0].filename;
    setGroupTemplates(prev => {
      const next = { ...prev };
      let changed = false;
      for (const g of lineGroups) {
        if (!next[g.lines]) {
          next[g.lines] = defaultTemplate;
          changed = true;
        }
      }
      // 더 이상 존재하지 않는 그룹 제거
      const validKeys = new Set(lineGroups.map(g => g.lines));
      for (const key of Object.keys(next)) {
        if (!validKeys.has(parseInt(key))) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [lineGroups, templates]);

  const toggleProject = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(filteredProjects.map(p => p.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const updateGroupTemplate = useCallback((lines, filename) => {
    setGroupTemplates(prev => ({ ...prev, [lines]: filename }));
  }, []);

  const handleDownload = async () => {
    if (selectedIds.size === 0) return;

    const selectedProjects = projects.filter(p => selectedIds.has(p.id));
    setLoading(true);

    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const accessToken = localStorage.getItem('accessToken');

      // 과제별 템플릿 매핑 생성 (줄 수 기반)
      const projectTemplateMap = {};
      for (const p of selectedProjects) {
        const lines = lineCountMap[p.id] || 0;
        projectTemplateMap[p.id] = groupTemplates[lines] || templates[0]?.filename || undefined;
      }

      const response = await fetch(`${API_BASE_URL}/digital-twin-dashboard/report/ppt/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          projects: selectedProjects,
          mode: mode,
          template: templates[0]?.filename || undefined, // 폴백용
          projectTemplateMap: projectTemplateMap
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '보고서 생성 실패');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = mode === 'single'
        ? `과제보고서_통합_${selectedProjects.length}건.pptx`
        : `과제보고서_개별_${selectedProjects.length}건.zip`;
      if (contentDisposition) {
        const starMatch = contentDisposition.match(/filename\*=UTF-8''([^;\r\n]*)/i);
        if (starMatch && starMatch[1]) {
          filename = decodeURIComponent(starMatch[1]);
        } else {
          const plainMatch = contentDisposition.match(/filename=['"]?([^;\r\n"']*)['"]?/i);
          if (plainMatch && plainMatch[1]) {
            filename = plainMatch[1];
          }
        }
      }

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      showSuccess && showSuccess(`보고서가 성공적으로 저장되었습니다. (${selectedProjects.length}건)`);
      onClose();
    } catch (error) {
      console.error('보고서 생성 오류:', error);
      showError && showError('보고서 생성 중 오류가 발생했습니다: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setSearchQuery('');
    setFilterYear(String(new Date().getFullYear()));
    setFilterDivision('');
    setSelectedIds(new Set());
    setMode('single');
    setGroupTemplates({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <Overlay
        key="report-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
      >
        <Modal
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          style={{ position: 'relative' }}
        >
          <ModalHeader>
            <h2><FileText size={20} /> PPT 보고서 저장</h2>
            <CloseButton onClick={handleClose}><X size={18} /></CloseButton>
          </ModalHeader>

          <Body>
            {/* 연도/사업부 필터 */}
            <FilterRow>
              <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
                <option value="">전체 연도</option>
                {yearOptions.map(y => (
                  <option key={y} value={y}>{y}년</option>
                ))}
              </select>
              <select value={filterDivision} onChange={(e) => setFilterDivision(e.target.value)}>
                <option value="">전체 사업부</option>
                {divisionOptions.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </FilterRow>

            {/* 검색 */}
            <SearchInput>
              <Search size={16} />
              <input
                type="text"
                placeholder="과제명, 사업부, PL로 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </SearchInput>

            {/* 선택 바 */}
            <SelectionBar>
              <span>{selectedIds.size}개 선택됨 / 전체 {filteredProjects.length}개</span>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" onClick={selectAll}>전체 선택</button>
                <button type="button" onClick={deselectAll}>선택 해제</button>
              </div>
            </SelectionBar>

            {/* 과제 리스트 */}
            <ProjectList>
              {filteredProjects.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
                  {searchQuery ? '검색 결과가 없습니다.' : '등록된 과제가 없습니다.'}
                </div>
              ) : (
                filteredProjects.map((project) => {
                  const lines = lineCountMap[project.id] || 0;
                  return (
                    <ProjectRow key={project.id} $checked={selectedIds.has(project.id)}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(project.id)}
                        onChange={() => toggleProject(project.id)}
                      />
                      <ProjectInfo>
                        <div className="name">{project.과제명 || '(제목 없음)'}</div>
                        <div className="meta">
                          <span>{project.사업부 || '-'}</span>
                          <span>{project.프로세스 || '-'}</span>
                          <span>PL: {project.과제PL || '-'}</span>
                          <span>{project.진행상태 || '-'}</span>
                        </div>
                      </ProjectInfo>
                      <LineBadge $lines={lines}>{lines}줄</LineBadge>
                    </ProjectRow>
                  );
                })
              )}
            </ProjectList>

            {/* 줄 수별 그룹 템플릿 선택 */}
            {lineGroups.length > 0 && templates.length > 0 && (
              <div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
                  줄 수별 템플릿 선택
                </div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
                  상세정보 줄 수가 같은 과제끼리 그룹화됩니다. 그룹별로 다른 템플릿을 지정할 수 있습니다.
                </div>
                {lineGroups.map(({ lines, projects: groupProjects }) => (
                  <GroupCard key={lines}>
                    <GroupHeader>
                      <GroupLabel>
                        <LineBadge $lines={lines}>{lines}줄</LineBadge>
                        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                          {groupProjects.length}건
                        </span>
                      </GroupLabel>
                      <select
                        value={groupTemplates[lines] || ''}
                        onChange={(e) => updateGroupTemplate(lines, e.target.value)}
                        style={selectStyle}
                      >
                        {templates.map((t) => (
                          <option key={t.filename} value={t.filename}>{t.name}</option>
                        ))}
                      </select>
                    </GroupHeader>
                    <GroupProjects>
                      {groupProjects.map(p => (
                        <span key={p.id}>{p.과제명 || '(제목 없음)'}</span>
                      ))}
                    </GroupProjects>
                  </GroupCard>
                ))}
              </div>
            )}

            {/* 템플릿이 없을 때 안내 */}
            {lineGroups.length > 0 && templates.length === 0 && (
              <div style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>
                기본 템플릿이 사용됩니다.
              </div>
            )}

            {/* 저장 모드 */}
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
                저장 방식
              </div>
              <ModeToggle>
                <ModeButton $active={mode === 'single'} onClick={() => setMode('single')}>
                  <File size={16} />
                  한개 파일로 저장 (.pptx)
                </ModeButton>
                <ModeButton $active={mode === 'individual'} onClick={() => setMode('individual')}>
                  <FileArchive size={16} />
                  과제별 파일로 저장 (.zip)
                </ModeButton>
              </ModeToggle>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.375rem' }}>
                {mode === 'single'
                  ? '선택한 모든 과제를 하나의 PPT 파일로 합쳐서 저장합니다.'
                  : '각 과제별 개별 PPT 파일을 ZIP으로 묶어 저장합니다.'}
              </div>
            </div>
          </Body>

          <Footer>
            <CancelBtn onClick={handleClose}>취소</CancelBtn>
            <DownloadBtn
              onClick={handleDownload}
              disabled={selectedIds.size === 0 || loading}
            >
              <Download size={16} />
              {loading ? '생성 중...' : `보고서 저장 (${selectedIds.size}건)`}
            </DownloadBtn>
          </Footer>

          {/* 로딩 오버레이 */}
          {loading && (
            <LoadingOverlay>
              <Spinner />
              <div style={{ fontSize: '0.875rem', color: '#374151', fontWeight: 600 }}>
                보고서를 생성하고 있습니다...
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                {selectedIds.size}개 과제 처리 중
              </div>
            </LoadingOverlay>
          )}
        </Modal>
      </Overlay>
    </AnimatePresence>
  );
};

export default ReportModal;
