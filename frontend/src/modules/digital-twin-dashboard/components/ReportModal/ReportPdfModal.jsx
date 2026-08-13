import React, { useState, useMemo } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, X, Download, Search, FileArchive, File } from 'lucide-react';

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
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
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
      border-color: #dc2626;
      box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
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
    color: #dc2626;
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
  max-height: 320px;
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
  background: ${props => props.$checked ? '#fee2e2' : 'transparent'};
  &:hover { background: ${props => props.$checked ? '#fecaca' : '#f9fafb'}; }

  input[type="checkbox"] {
    width: 1rem;
    height: 1rem;
    accent-color: #dc2626;
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
  background: ${props => props.$active ? '#dc2626' : 'white'};
  color: ${props => props.$active ? 'white' : '#6b7280'};
  &:hover {
    background: ${props => props.$active ? '#b91c1c' : '#f3f4f6'};
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
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
  color: white;
  border: none;
  &:hover {
    background: linear-gradient(135deg, #b91c1c 0%, #991b1b 100%);
    box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
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
  background: rgba(255, 255, 255, 0.85);
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
  border-top-color: #dc2626;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  @keyframes spin { to { transform: rotate(360deg); } }
`;

const InfoNote = styled.div`
  background: #fef2f2;
  border: 1px solid #fee2e2;
  border-left: 3px solid #dc2626;
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  font-size: 0.8125rem;
  color: #7f1d1d;
  line-height: 1.5;
`;

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
      border-color: #dc2626;
    }
  }
`;

const ReportPdfModal = ({ isOpen, onClose, projects = [], settingsData, showSuccess, showError }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterYear, setFilterYear] = useState(() => String(new Date().getFullYear()));
  const [filterDivision, setFilterDivision] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [mode, setMode] = useState('single');
  const [loading, setLoading] = useState(false);

  const yearOptions = useMemo(() => {
    const years = new Set(projects.map(p => p.과제년도).filter(Boolean));
    return [...years].sort((a, b) => b - a);
  }, [projects]);

  const divisionOptions = useMemo(() => {
    const projectDivs = new Set(projects.map(p => p.사업부).filter(Boolean));
    const settingsDivs = (settingsData?.divisions || []).map(d => d.name);
    const ordered = settingsDivs.filter(d => projectDivs.has(d));
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

  const handleDownload = async () => {
    if (selectedIds.size === 0) return;

    const selectedProjects = projects.filter(p => selectedIds.has(p.id));
    setLoading(true);

    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const accessToken = localStorage.getItem('accessToken');

      const response = await fetch(`${API_BASE_URL}/digital-twin-dashboard/report/pdf/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          projects: selectedProjects,
          mode: mode
        })
      });

      if (!response.ok) {
        let errMsg = 'PDF 보고서 생성 실패';
        try {
          const errorData = await response.json();
          errMsg = errorData.message || errMsg;
        } catch (_) {
          // not JSON
        }
        throw new Error(errMsg);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = mode === 'single'
        ? `과제보고서_통합_${selectedProjects.length}건.pdf`
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

      showSuccess && showSuccess(`PDF 보고서가 성공적으로 저장되었습니다. (${selectedProjects.length}건)`);
      onClose();
    } catch (error) {
      console.error('PDF 보고서 생성 오류:', error);
      showError && showError('PDF 보고서 생성 중 오류가 발생했습니다: ' + error.message);
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
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <Overlay
        key="pdf-report-overlay"
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
            <h2><FileText size={20} /> PDF 보고서 저장</h2>
            <CloseButton onClick={handleClose}><X size={18} /></CloseButton>
          </ModalHeader>

          <Body>
            <InfoNote>
              HTML 기반 자동 페이지네이션 방식으로, 내용이 길어지면 자동으로 다음 페이지로 흘러갑니다.
              PPT와 달리 분량 오버플로 걱정 없이 모든 상세 정보가 빠짐없이 포함됩니다.
            </InfoNote>

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

            <SearchInput>
              <Search size={16} />
              <input
                type="text"
                placeholder="과제명, 사업부, PL로 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </SearchInput>

            <SelectionBar>
              <span>{selectedIds.size}개 선택됨 / 전체 {filteredProjects.length}개</span>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" onClick={selectAll}>전체 선택</button>
                <button type="button" onClick={deselectAll}>선택 해제</button>
              </div>
            </SelectionBar>

            <ProjectList>
              {filteredProjects.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
                  {searchQuery ? '검색 결과가 없습니다.' : '등록된 과제가 없습니다.'}
                </div>
              ) : (
                filteredProjects.map((project) => (
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
                  </ProjectRow>
                ))
              )}
            </ProjectList>

            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
                저장 방식
              </div>
              <ModeToggle>
                <ModeButton $active={mode === 'single'} onClick={() => setMode('single')}>
                  <File size={16} />
                  한개 파일로 저장 (.pdf)
                </ModeButton>
                <ModeButton $active={mode === 'individual'} onClick={() => setMode('individual')}>
                  <FileArchive size={16} />
                  과제별 파일로 저장 (.zip)
                </ModeButton>
              </ModeToggle>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.375rem' }}>
                {mode === 'single'
                  ? '선택한 모든 과제를 하나의 PDF 파일로 합쳐서 저장합니다.'
                  : '각 과제별 개별 PDF 파일을 ZIP으로 묶어 저장합니다.'}
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
              {loading ? '생성 중...' : `PDF 저장 (${selectedIds.size}건)`}
            </DownloadBtn>
          </Footer>

          {loading && (
            <LoadingOverlay>
              <Spinner />
              <div style={{ fontSize: '0.875rem', color: '#374151', fontWeight: 600 }}>
                PDF 보고서를 생성하고 있습니다...
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

export default ReportPdfModal;
