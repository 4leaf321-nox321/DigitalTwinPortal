import React, { useState, useMemo } from 'react';
import styled from 'styled-components';
import { Link2, Plus, Trash2, Search, X, Check } from 'lucide-react';

// ============== Styled Components ==============

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const SectionTitle = styled.h3`
  font-size: 1rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 0.75rem 0;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #e5e7eb;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  @media (max-width: 768px) {
    font-size: 0.9rem;
    margin-bottom: 0.5rem;
  }
`;

const AddButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.85rem;
  font-size: 0.8rem;
  font-weight: 500;
  color: #6366f1;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: #e0e7ff;
    border-color: #a5b4fc;
  }
`;

const LinkedCard = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  transition: background 0.15s;

  &:hover {
    background: #f1f5f9;
  }

  /* 지워졌거나 볼 수 없는 과제로의 연결. 지우라고 강요하지는 않는다 —
     휴지통에서 되살아날 수 있고, 연결을 지우는 것은 사람이 정할 일이다. */
  ${p => p.$muted && `
    opacity: 0.6;
    border-style: dashed;
  `}
`;

const CardInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const CardName = styled.div`
  font-size: 0.85rem;
  font-weight: 500;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const CardMeta = styled.div`
  font-size: 0.7rem;
  color: #9ca3af;
  margin-top: 1px;
`;

const DivisionBadge = styled.span`
  font-size: 0.7rem;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  background: #eef2ff;
  color: #4f46e5;
  flex-shrink: 0;
`;

const DeleteBtn = styled.button`
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  flex-shrink: 0;

  &:hover {
    color: #ef4444;
    background: #fef2f2;
  }
`;

const EmptyHint = styled.p`
  font-size: 0.8rem;
  color: #9ca3af;
  margin: 0;
  padding: 0.5rem 0;
`;

// ============== Modal Styled Components ==============

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
`;

const ModalBox = styled.div`
  background: white;
  border-radius: 0.75rem;
  width: 90%;
  max-width: 640px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
`;

const ModalTitle = styled.h4`
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const CloseBtn = styled.button`
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;

  &:hover {
    color: #374151;
    background: #f3f4f6;
  }
`;

const ModalToolbar = styled.div`
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid #f3f4f6;
  flex-shrink: 0;
  flex-wrap: wrap;
  align-items: center;
`;

const YearSelect = styled.select`
  padding: 0.4rem 0.6rem;
  border: 1px solid #d1d5db;
  border-radius: 0.4rem;
  font-size: 0.8rem;
  color: #374151;
  background: white;
  outline: none;
  flex-shrink: 0;

  &:focus {
    border-color: #6366f1;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
  }
`;

const SearchBox = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex: 1;
  min-width: 150px;
  padding: 0.4rem 0.6rem;
  border: 1px solid #d1d5db;
  border-radius: 0.4rem;
  background: white;

  &:focus-within {
    border-color: #6366f1;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
  }
`;

const SearchInput = styled.input`
  border: none;
  outline: none;
  font-size: 0.8rem;
  flex: 1;
  min-width: 0;
  color: #374151;

  &::placeholder {
    color: #9ca3af;
  }
`;

const ModalList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 0;
`;

const ListItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 1.25rem;
  cursor: pointer;
  transition: background 0.1s;
  border-bottom: 1px solid #f9fafb;

  &:hover {
    background: #f8fafc;
  }

  ${p => p.$selected && `
    background: #eef2ff;
    &:hover { background: #e0e7ff; }
  `}

  ${p => p.$disabled && `
    opacity: 0.45;
    cursor: default;
    &:hover { background: transparent; }
  `}
`;

const CheckBox = styled.div`
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 1.5px solid ${p => p.$checked ? '#6366f1' : '#cbd5e1'};
  background: ${p => p.$checked ? '#6366f1' : 'white'};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;
`;

const ItemInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const ItemName = styled.div`
  font-size: 0.83rem;
  font-weight: 500;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ItemMeta = styled.div`
  font-size: 0.7rem;
  color: #9ca3af;
  margin-top: 1px;
`;

const ModalFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.25rem;
  border-top: 1px solid #e5e7eb;
  flex-shrink: 0;
`;

const FooterInfo = styled.span`
  font-size: 0.8rem;
  color: #6b7280;
`;

const FooterActions = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const ModalBtn = styled.button`
  padding: 0.45rem 1rem;
  font-size: 0.8rem;
  font-weight: 500;
  border-radius: 0.4rem;
  cursor: pointer;
  transition: all 0.15s;

  ${p => p.$primary ? `
    background: #6366f1;
    color: white;
    border: 1px solid #6366f1;
    &:hover { background: #4f46e5; }
    &:disabled { opacity: 0.5; cursor: default; }
  ` : `
    background: white;
    color: #374151;
    border: 1px solid #d1d5db;
    &:hover { background: #f9fafb; }
  `}
`;

const ListEmpty = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2.5rem 1rem;
  color: #9ca3af;
  font-size: 0.85rem;
`;

// ============== Component ==============

const PredecessorSection = ({ formData, setFormData, allProjects = [], currentProjectId }) => {
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [pendingSelections, setPendingSelections] = useState(new Set());

  const predecessors = formData.선행과제목록 || [];
  const linkedIds = useMemo(() => new Set(predecessors.map(p => p.uuid)), [predecessors]);

  /**
   * 고를 수 있는 과제. **휴지통에 있는 과제를 뺀다.**
   *
   * `/data` 는 소프트 삭제 과제도 함께 내려준다(휴지통 화면이 그 배열을 쓴다).
   * 이 컴포넌트는 그 배열을 그대로 받으므로, 거르지 않으면 **지운 과제가 후보로 뜬다.**
   * 대시보드·성과 화면이 전부 `!p._deleted` 로 거르는 것과 같은 이유다.
   * 영구 삭제는 서버가 `/data` 에서 이미 뺐다.
   *
   * ⚠️ 서버는 소프트 삭제 과제로의 연결을 **막지 않는다**(일부러 그렇다).
   *    이미 걸어 둔 선행과제가 나중에 휴지통에 들어갔을 때, 그 과제를 저장하려면
   *    기존 연결을 그대로 다시 보내야 하기 때문이다 — 거기서 400 이 나면 그 과제를
   *    아예 저장할 수 없게 된다. 그래서 "새로 고르는 것" 만 여기서 막는다.
   */
  const selectableProjects = useMemo(
    () => (allProjects || []).filter(p => !p._deleted && !p._permanentlyDeleted),
    [allProjects]);

  /** 연결된 과제의 **지금 상태**를 보려고 든다 (휴지통에 들어갔는지·사라졌는지). */
  const projectByUuid = useMemo(() => {
    const map = new Map();
    (allProjects || []).forEach(p => {
      const id = p.uuid || p.id;
      if (id) map.set(id, p);
    });
    return map;
  }, [allProjects]);

  // 사용 가능한 연도 목록
  const availableYears = useMemo(() => {
    const years = new Set();
    selectableProjects.forEach(p => {
      const y = p.과제년도;
      if (y) years.add(String(y));
    });
    return [...years].sort((a, b) => b - a);
  }, [selectableProjects]);

  // 모달 내 필터링된 과제 리스트
  const filteredProjects = useMemo(() => {
    return selectableProjects.filter(p => {
      const id = p.uuid || p.id;
      if (id === currentProjectId) return false;

      // 연도 필터
      if (yearFilter && String(p.과제년도 || '') !== yearFilter) return false;

      // 검색어 필터
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const name = (p.과제명 || p.taskName || '').toLowerCase();
        const division = (p.사업부 || '').toLowerCase();
        const pl = (p.과제PL || '').toLowerCase();
        if (!name.includes(term) && !division.includes(term) && !pl.includes(term)) return false;
      }

      return true;
    });
  }, [selectableProjects, currentProjectId, yearFilter, searchTerm]);

  const openModal = () => {
    setSearchTerm('');
    // 기본 연도 필터: 가장 최근 연도
    setYearFilter(availableYears.length > 0 ? availableYears[0] : '');
    setPendingSelections(new Set());
    setShowModal(true);
  };

  const toggleSelection = (project) => {
    const id = project.uuid || project.id;
    if (linkedIds.has(id)) return; // 이미 연결된 건 토글 불가
    setPendingSelections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    if (pendingSelections.size === 0) {
      setShowModal(false);
      return;
    }

    // 고를 수 있는 것에서만 만든다 — 후보 목록과 같은 기준이라야 필터를 우회할 수 없다
    const newPredecessors = [];
    selectableProjects.forEach(p => {
      const id = p.uuid || p.id;
      if (pendingSelections.has(id)) {
        newPredecessors.push({
          uuid: id,
          과제명: p.과제명 || p.taskName || '',
          사업부: p.사업부 || '',
          과제년도: p.과제년도 || '',
          과제PL: p.과제PL || ''
        });
      }
    });

    setFormData(prev => ({
      ...prev,
      선행과제목록: [...(prev.선행과제목록 || []), ...newPredecessors]
    }));

    setShowModal(false);
  };

  const handleRemove = (uuid) => {
    setFormData(prev => ({
      ...prev,
      선행과제목록: (prev.선행과제목록 || []).filter(p => p.uuid !== uuid)
    }));
  };

  return (
    <Container>
      <SectionTitle>
        <Link2 size={18} color="#6366f1" />
        이전 과제 연결
      </SectionTitle>

      <AddButton type="button" onClick={openModal}>
        <Plus size={14} />
        이전 과제 추가
      </AddButton>

      {predecessors.length > 0 ? (
        predecessors.map(pred => {
          /*
            이미 걸어 둔 연결의 **지금 상태**를 보여준다.
            후보 목록에서 휴지통 과제를 뺐으므로 새로 고를 수는 없지만, 걸어 둔 뒤에
            상대가 지워지는 것은 막을 수 없다. 아무 표시가 없으면 멀쩡한 연결로 보인다.
              휴지통  `/data` 에는 오지만 지워진 것이다
              없음    영구 삭제됐거나 내가 볼 수 없는 과제다 (서버는 사본으로 이름만 준다)
          */
          const live = projectByUuid.get(pred.uuid);
          const trashed = !!live?._deleted;
          const gone = !live;
          return (
            <LinkedCard key={pred.uuid} $muted={trashed || gone}>
              {pred.사업부 && <DivisionBadge>{pred.사업부}</DivisionBadge>}
              <CardInfo>
                <CardName>{live?.과제명 || pred.과제명 || '(제목 없음)'}</CardName>
                <CardMeta>
                  {pred.과제년도 && `${pred.과제년도}년`}
                  {pred.과제PL && ` · PL: ${pred.과제PL}`}
                  {trashed && ' · 휴지통에 있는 과제'}
                  {gone && ' · 삭제되었거나 볼 수 없는 과제'}
                </CardMeta>
              </CardInfo>
              <DeleteBtn onClick={() => handleRemove(pred.uuid)} title="연결 해제">
                <Trash2 size={14} />
              </DeleteBtn>
            </LinkedCard>
          );
        })
      ) : (
        <EmptyHint>연결된 이전 과제가 없습니다.</EmptyHint>
      )}

      {/* ====== 과제 선택 모달 ====== */}
      {showModal && (
        <Overlay
          onClick={(e) => { e.stopPropagation(); setShowModal(false); }}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
        >
          <ModalBox onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>
                <Link2 size={18} color="#6366f1" />
                이전 과제 선택
              </ModalTitle>
              <CloseBtn onClick={() => setShowModal(false)}>
                <X size={18} />
              </CloseBtn>
            </ModalHeader>

            <ModalToolbar>
              <YearSelect value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
                <option value="">전체 연도</option>
                {availableYears.map(y => (
                  <option key={y} value={y}>{y}년</option>
                ))}
              </YearSelect>
              <SearchBox>
                <Search size={14} color="#9ca3af" />
                <SearchInput
                  placeholder="과제명, 사업부, PL 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoFocus
                />
                {searchTerm && (
                  <CloseBtn onClick={() => setSearchTerm('')} style={{ padding: '2px' }}>
                    <X size={14} />
                  </CloseBtn>
                )}
              </SearchBox>
            </ModalToolbar>

            <ModalList>
              {filteredProjects.length > 0 ? (
                filteredProjects.map(p => {
                  const id = p.uuid || p.id;
                  const alreadyLinked = linkedIds.has(id);
                  const selected = alreadyLinked || pendingSelections.has(id);
                  return (
                    <ListItem
                      key={id}
                      $selected={selected}
                      $disabled={alreadyLinked}
                      onClick={() => !alreadyLinked && toggleSelection(p)}
                    >
                      <CheckBox $checked={selected}>
                        {selected && <Check size={12} color="white" strokeWidth={3} />}
                      </CheckBox>
                      {p.사업부 && <DivisionBadge>{p.사업부}</DivisionBadge>}
                      <ItemInfo>
                        <ItemName>{p.과제명 || p.taskName || '(제목 없음)'}</ItemName>
                        <ItemMeta>
                          {p.과제년도 && `${p.과제년도}년`}
                          {p.과제PL && ` · PL: ${p.과제PL}`}
                          {alreadyLinked && ' · 이미 연결됨'}
                        </ItemMeta>
                      </ItemInfo>
                    </ListItem>
                  );
                })
              ) : (
                <ListEmpty>
                  <Search size={32} color="#d1d5db" />
                  <p style={{ marginTop: '0.75rem' }}>조건에 맞는 과제가 없습니다</p>
                </ListEmpty>
              )}
            </ModalList>

            <ModalFooter>
              <FooterInfo>
                {pendingSelections.size > 0
                  ? `${pendingSelections.size}개 선택됨`
                  : `${filteredProjects.length}개 과제`
                }
              </FooterInfo>
              <FooterActions>
                <ModalBtn onClick={() => setShowModal(false)}>취소</ModalBtn>
                <ModalBtn $primary onClick={handleConfirm} disabled={pendingSelections.size === 0}>
                  추가
                </ModalBtn>
              </FooterActions>
            </ModalFooter>
          </ModalBox>
        </Overlay>
      )}
    </Container>
  );
};

export default PredecessorSection;
