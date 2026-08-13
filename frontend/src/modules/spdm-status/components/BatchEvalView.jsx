import React, { useMemo, useState, useCallback } from 'react';
import styled from 'styled-components';
import { Check, Save, ChevronDown, ChevronRight } from 'lucide-react';
import { useModuleCategories } from '../contexts/ModuleCategoryContext';

const DIVISIONS = ['MX', 'VD', 'DA', 'NW', '의료기기'];

/* ===== Styled Components ===== */

const Wrapper = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const Container = styled.div`
  flex: 1;
  overflow: auto;
  padding: 1.5rem;
`;

const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 12px 24px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
  flex-shrink: 0;
`;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 1rem;
  flex-wrap: wrap;
`;

const DivisionTab = styled.button`
  padding: 6px 16px;
  border: 1px solid ${p => p.$active ? '#8b5cf6' : '#e2e8f0'};
  border-radius: 6px;
  background: ${p => p.$active ? '#f5f3ff' : 'white'};
  color: ${p => p.$active ? '#7c3aed' : '#64748b'};
  font-size: 0.85rem;
  font-weight: ${p => p.$active ? 600 : 500};
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: #8b5cf6;
    background: #faf5ff;
  }
`;

const SaveAllBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border: none;
  border-radius: 6px;
  background: #8b5cf6;
  color: white;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;

  &:hover { background: #7c3aed; }
  &:disabled { opacity: 0.5; cursor: default; }
`;

const ChangeBadge = styled.span`
  background: #fbbf24;
  color: #78350f;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 10px;
`;

const CategorySection = styled.div`
  margin-bottom: 1.25rem;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
`;

const CategoryHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0.75rem 1rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  cursor: pointer;
  user-select: none;

  &:hover { background: #f1f5f9; }
`;

const CategoryName = styled.span`
  font-size: 0.9rem;
  font-weight: 700;
  color: #1e293b;
`;

const CategoryCount = styled.span`
  font-size: 0.75rem;
  color: #94a3b8;
`;

const DetailList = styled.div`
  display: flex;
  flex-direction: column;
`;

const DetailRow = styled.div`
  display: flex;
  gap: 1rem;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid #f1f5f9;
  align-items: flex-start;

  &:last-child { border-bottom: none; }
`;

const DetailInfo = styled.div`
  width: 180px;
  flex-shrink: 0;
`;

const DetailName = styled.div`
  font-size: 0.85rem;
  font-weight: 600;
  color: #334155;
`;

const DetailType = styled.div`
  font-size: 0.7rem;
  color: #94a3b8;
  margin-top: 2px;
`;

const EvalSection = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const CriteriaRow = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
`;

const CriteriaBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border: 1px solid ${p => p.$selected ? '#8b5cf6' : '#e2e8f0'};
  border-radius: 5px;
  background: ${p => p.$selected ? '#f5f3ff' : 'white'};
  color: ${p => p.$selected ? '#7c3aed' : '#64748b'};
  font-size: 0.8rem;
  font-weight: ${p => p.$selected ? 600 : 400};
  cursor: pointer;
  transition: all 0.12s;

  &:hover {
    border-color: #a78bfa;
    background: #faf5ff;
  }
`;

const CommentInput = styled.textarea`
  width: 100%;
  min-height: 32px;
  max-height: 80px;
  padding: 6px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 5px;
  font-size: 0.8rem;
  color: #334155;
  resize: vertical;
  font-family: inherit;

  &:focus {
    outline: none;
    border-color: #8b5cf6;
  }
`;

const CurrentScore = styled.span`
  font-size: 0.7rem;
  color: #94a3b8;
  margin-left: 4px;
`;

const EmptyMsg = styled.div`
  padding: 2rem;
  text-align: center;
  color: #94a3b8;
  font-size: 0.9rem;
`;

const SuccessToast = styled.div`
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  background: #10b981;
  color: white;
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  z-index: 999;
  animation: fadeInOut 2s ease forwards;

  @keyframes fadeInOut {
    0% { opacity: 0; transform: translateX(-50%) translateY(10px); }
    15% { opacity: 1; transform: translateX(-50%) translateY(0); }
    85% { opacity: 1; }
    100% { opacity: 0; }
  }
`;

/* ===== Component ===== */

const BatchEvalView = () => {
  const {
    groups, categories, categoryGroups, categoryDetails,
    divisionScores, updateDivisionScore,
    divisionComments, updateDivisionComment,
  } = useModuleCategories();

  const [selectedDivision, setSelectedDivision] = useState(DIVISIONS[0]);
  const [collapsedCats, setCollapsedCats] = useState(new Set());
  const [toast, setToast] = useState(false);

  // Draft state: { [detailId]: { score, comment } }
  const [drafts, setDrafts] = useState({});

  // Build all detail items grouped by category
  const allDetails = useMemo(() => {
    // Order categories by group ordering
    const orderedCats = [];
    const linkedSet = new Set();

    groups.forEach(group => {
      const linked = categories.filter(cat => (categoryGroups[cat] || []).includes(group.id));
      linked.forEach(cat => {
        if (!linkedSet.has(cat)) {
          orderedCats.push({ groupName: group.name, catName: cat });
          linkedSet.add(cat);
        }
      });
    });

    // Unlinked
    categories.forEach(cat => {
      if (!linkedSet.has(cat)) {
        orderedCats.push({ groupName: '(미분류)', catName: cat });
      }
    });

    return orderedCats.map(({ groupName, catName }) => {
      const details = (categoryDetails[catName] || []).map(d => ({
        ...d,
        categoryName: catName,
        groupName,
      }));
      return { catName, groupName, details };
    }).filter(c => c.details.length > 0);
  }, [groups, categories, categoryGroups, categoryDetails]);

  // Initialize drafts when division changes
  const initDrafts = useCallback(() => {
    const init = {};
    allDetails.forEach(cat => {
      cat.details.forEach(d => {
        const currentScore = divisionScores[d.id]?.[selectedDivision];
        const currentComment = divisionComments[d.id]?.[selectedDivision] || '';
        init[d.id] = {
          score: currentScore,
          comment: currentComment,
          type: d.type || 'score',
          originalScore: currentScore,
          originalComment: currentComment,
        };
      });
    });
    setDrafts(init);
  }, [allDetails, selectedDivision, divisionScores, divisionComments]);

  // Re-init drafts when division changes
  React.useEffect(() => {
    initDrafts();
  }, [initDrafts]);

  const handleScoreChange = (detailId, score) => {
    setDrafts(prev => ({
      ...prev,
      [detailId]: {
        ...prev[detailId],
        score: prev[detailId]?.score === score ? undefined : score,
      }
    }));
  };

  const handleCheckToggle = (detailId, index) => {
    setDrafts(prev => {
      const current = prev[detailId]?.score;
      const arr = Array.isArray(current) ? [...current] : [];
      const next = arr.includes(index) ? arr.filter(i => i !== index) : [...arr, index];
      return {
        ...prev,
        [detailId]: { ...prev[detailId], score: next }
      };
    });
  };

  const handleCommentChange = (detailId, value) => {
    setDrafts(prev => ({
      ...prev,
      [detailId]: { ...prev[detailId], comment: value }
    }));
  };

  // Count changes
  const changeCount = useMemo(() => {
    let count = 0;
    Object.entries(drafts).forEach(([, d]) => {
      if (JSON.stringify(d.score) !== JSON.stringify(d.originalScore)) count++;
      if ((d.comment || '') !== (d.originalComment || '')) count++;
    });
    return count;
  }, [drafts]);

  const handleSaveAll = () => {
    Object.entries(drafts).forEach(([detailId, d]) => {
      if (JSON.stringify(d.score) !== JSON.stringify(d.originalScore)) {
        updateDivisionScore(detailId, selectedDivision, d.score);
      }
      if ((d.comment || '') !== (d.originalComment || '')) {
        updateDivisionComment(detailId, selectedDivision, (d.comment || '').trim());
      }
    });
    setToast(true);
    setTimeout(() => setToast(false), 2000);
    // Re-init to update originals
    setTimeout(() => initDrafts(), 100);
  };

  const toggleCollapse = (catName) => {
    setCollapsedCats(prev => {
      const next = new Set(prev);
      next.has(catName) ? next.delete(catName) : next.add(catName);
      return next;
    });
  };

  return (
    <Wrapper>
      <Container>
        <Toolbar>
          {DIVISIONS.map(div => (
            <DivisionTab
              key={div}
              $active={selectedDivision === div}
              onClick={() => setSelectedDivision(div)}
            >
              {div}
            </DivisionTab>
          ))}
        </Toolbar>

        {allDetails.length === 0 ? (
          <EmptyMsg>설정에서 카테고리와 세부 항목을 추가해주세요.</EmptyMsg>
        ) : (
          allDetails.map(({ catName, details }) => {
            const isCollapsed = collapsedCats.has(catName);
            return (
              <CategorySection key={catName}>
                <CategoryHeader onClick={() => toggleCollapse(catName)}>
                  {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                  <CategoryName>{catName}</CategoryName>
                  <CategoryCount>{details.length}개 항목</CategoryCount>
                </CategoryHeader>
                {!isCollapsed && (
                  <DetailList>
                    {details.map(detail => {
                      const draft = drafts[detail.id] || {};
                      const criteria = detail.criteria || [];
                      const isChecklist = (detail.type || 'score') === 'checklist';

                      return (
                        <DetailRow key={detail.id}>
                          <DetailInfo>
                            <DetailName>{detail.name}</DetailName>
                            <DetailType>{isChecklist ? '체크리스트' : '점수 평가'}</DetailType>
                          </DetailInfo>
                          <EvalSection>
                            {criteria.length > 0 ? (
                              <CriteriaRow>
                                {isChecklist ? (
                                  criteria.map((c, ci) => {
                                    const checked = Array.isArray(draft.score) && draft.score.includes(ci);
                                    return (
                                      <CriteriaBtn
                                        key={ci}
                                        $selected={checked}
                                        onClick={() => handleCheckToggle(detail.id, ci)}
                                      >
                                        <Check size={13} style={{ opacity: checked ? 1 : 0.2 }} />
                                        {c.label || `항목 ${ci + 1}`}
                                      </CriteriaBtn>
                                    );
                                  })
                                ) : (
                                  criteria.map(c => {
                                    const isSelected = draft.score === c.score;
                                    return (
                                      <CriteriaBtn
                                        key={c.score}
                                        $selected={isSelected}
                                        onClick={() => handleScoreChange(detail.id, c.score)}
                                      >
                                        {c.score}점
                                        <CurrentScore>{c.label}</CurrentScore>
                                        {isSelected && <Check size={13} />}
                                      </CriteriaBtn>
                                    );
                                  })
                                )}
                              </CriteriaRow>
                            ) : (
                              <CriteriaRow>
                                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>기준 미설정</span>
                              </CriteriaRow>
                            )}
                            <CommentInput
                              placeholder="코멘트..."
                              value={draft.comment || ''}
                              onChange={e => handleCommentChange(detail.id, e.target.value)}
                              rows={1}
                            />
                          </EvalSection>
                        </DetailRow>
                      );
                    })}
                  </DetailList>
                )}
              </CategorySection>
            );
          })
        )}
      </Container>

      <Footer>
        <SaveAllBtn onClick={handleSaveAll} disabled={changeCount === 0}>
          <Save size={15} />
          일괄 저장
          {changeCount > 0 && <ChangeBadge>{changeCount}</ChangeBadge>}
        </SaveAllBtn>
      </Footer>

      {toast && <SuccessToast>일괄 저장 완료</SuccessToast>}
    </Wrapper>
  );
};

export default BatchEvalView;
