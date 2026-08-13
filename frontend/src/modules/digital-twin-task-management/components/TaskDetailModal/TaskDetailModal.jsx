import React from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Pencil, FileText, Layers, Target } from 'lucide-react';
import { todayLocalYmd } from '../../../../shared/utils/localDate';

// === Helpers ===

const groupActivities = (task) => {
  const catMap = {};
  (task.대분류액티비티 || []).forEach(cat => {
    catMap[cat.categoryId] = { ...cat, subcategories: [] };
  });
  (task.분석액티비티 || []).forEach(sub => {
    if (!catMap[sub.categoryId]) {
      catMap[sub.categoryId] = { categoryId: sub.categoryId, categoryName: sub.categoryId, subcategories: [] };
    }
    catMap[sub.categoryId].subcategories.push(sub);
  });
  return Object.values(catMap);
};

const calcCatProgress = (cat) => {
  const subs = cat.subcategories || [];
  if (subs.length === 0) return 0;
  const total = subs.reduce((sum, s) => {
    if (s.상태 === '완료') return sum + 100;
    if (s.상태 === '진행') return sum + (s.진행률 ?? 0);
    return sum;
  }, 0);
  return Math.round(total / subs.length);
};

const calcTaskStatus = (groups) => {
  if (groups.length === 0) return { status: '계획', progress: 0 };
  let totalProgress = 0, catCount = 0;
  groups.forEach(cat => {
    totalProgress += calcCatProgress(cat);
    catCount++;
  });
  const avg = catCount > 0 ? Math.round(totalProgress / catCount) : 0;
  if (avg >= 100) return { status: '완료', progress: 100 };
  const today = todayLocalYmd();
  const isOverdue = groups.some(cat => {
    const p = calcCatProgress(cat);
    return p < 100 && !cat.완료일 && cat.목표일 && today > cat.목표일;
  });
  if (isOverdue) return { status: '지연', progress: avg };
  if (avg > 0) return { status: '진행', progress: avg };
  return { status: '계획', progress: 0 };
};

// === Styled ===

const Overlay = styled(motion.div)`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 22000;
`;

const Box = styled(motion.div)`
  background: #ffffff;
  border-radius: 16px;
  width: min(960px, 92vw);
  height: min(86vh, 900px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.3);
  overflow: hidden;
`;

const Header = styled.div`
  padding: 18px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid #e2e8f0;
  background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
  flex-shrink: 0;
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
`;

const TaskIdBadge = styled.span`
  display: inline-block;
  padding: 3px 10px;
  border-radius: 10px;
  font-size: 0.74rem;
  font-weight: 700;
  color: #4f46e5;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  flex-shrink: 0;
`;

const TaskNameTitle = styled.h2`
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
`;

const EditBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border: 1px solid #6366f1;
  background: #6366f1;
  color: #ffffff;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { background: #4f46e5; border-color: #4f46e5; }
`;

const CloseBtn = styled.button`
  width: 34px;
  height: 34px;
  border: none;
  background: #f1f5f9;
  color: #64748b;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { background: #e2e8f0; color: #1e293b; }
`;

const Body = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px 28px;
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

const StatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 700;
  background: ${p => p.$s === '완료' ? '#dcfce7' : p.$s === '진행' ? '#dbeafe' : p.$s === '지연' ? '#fef2f2' : '#f1f5f9'};
  color: ${p => p.$s === '완료' ? '#16a34a' : p.$s === '진행' ? '#2563eb' : p.$s === '지연' ? '#ef4444' : '#64748b'};
`;

const InfoBar = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 14px;
  padding: 14px 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
`;

const InfoBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
`;

const InfoLabel = styled.div`
  font-size: 0.7rem;
  font-weight: 700;
  color: #94a3b8;
  letter-spacing: 0.04em;
  text-transform: uppercase;
`;

const InfoValue = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  font-size: 0.85rem;
  color: #1e293b;
`;

const DivisionTag = styled.span`
  display: inline-block;
  padding: 2px 9px;
  border-radius: 10px;
  font-size: 0.74rem;
  font-weight: 600;
  color: #ffffff;
  background: ${p => p.$color || '#64748b'};
`;

const CorpTag = styled.span`
  display: inline-block;
  padding: 2px 9px;
  border-radius: 10px;
  font-size: 0.74rem;
  font-weight: 500;
  color: #065f46;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
`;

const LpTag = styled.span`
  display: inline-block;
  padding: 2px 9px;
  border-radius: 10px;
  font-size: 0.74rem;
  font-weight: 500;
  color: #713f12;
  background: #fefce8;
  border: 1px solid #fde68a;
`;

const NoData = styled.span`
  color: #cbd5e1;
  font-size: 0.8rem;
`;

const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const SectionTitle = styled.h3`
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: #1e293b;
  display: inline-flex;
  align-items: center;
  gap: 6px;
`;

const CategoryCard = styled.div`
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #ffffff;
  overflow: hidden;
`;

const CategoryHeader = styled.div`
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
`;

const CategoryName = styled.div`
  font-size: 0.92rem;
  font-weight: 700;
  color: #4f46e5;
`;

const ProgressBlock = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
`;

const ProgressTrack = styled.div`
  width: 80px;
  height: 6px;
  background: #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
`;

const ProgressFill = styled.div`
  height: 100%;
  border-radius: 3px;
  background: ${p => p.$v >= 100 ? '#16a34a' : p.$v > 0 ? '#3b82f6' : '#e2e8f0'};
`;

const ProgressLabel = styled.span`
  font-size: 0.78rem;
  font-weight: 700;
  color: ${p => p.$v >= 100 ? '#16a34a' : p.$v > 0 ? '#3b82f6' : '#94a3b8'};
  min-width: 36px;
  text-align: right;
`;

const CategoryBody = styled.div`
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const DateRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const DateChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 0.76rem;
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #e2e8f0;
  strong {
    color: #1e293b;
    font-weight: 600;
  }
`;

const SubSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const SubSectionLabel = styled.div`
  font-size: 0.74rem;
  font-weight: 700;
  color: #64748b;
  letter-spacing: 0.03em;
`;

const FileList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const FileChip = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.76rem;
  color: #1e293b;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
`;

const EffectList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const EffectCard = styled.div`
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fafbfc;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const EffectName = styled.div`
  font-size: 0.85rem;
  font-weight: 700;
  color: #1e293b;
  display: inline-flex;
  align-items: center;
  gap: 5px;
`;

const EffectChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
`;

const EffectChip = styled.span`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.72rem;
  color: #475569;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  strong { color: #1e293b; font-weight: 600; }
`;

const EffectDesc = styled.div`
  font-size: 0.78rem;
  color: #475569;
  white-space: pre-wrap;
`;

const SubList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const SubCard = styled.div`
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const SubHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const SubName = styled.div`
  font-size: 0.86rem;
  font-weight: 700;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const SubMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  font-size: 0.78rem;
  color: #475569;
`;

const SubMetaChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 6px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  color: #475569;
  strong { color: #1e293b; font-weight: 600; }
`;

const PersonnelChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 8px;
  font-size: 0.76rem;
  color: #1e293b;
  background: ${p => p.$isPL ? '#fef3c7' : '#f1f5f9'};
  border: 1px solid ${p => p.$isPL ? '#fde68a' : '#e2e8f0'};
`;

const PLBadge = styled.span`
  display: inline-block;
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 0.65rem;
  font-weight: 700;
  color: #ffffff;
  background: #f59e0b;
`;

const DetailText = styled.div`
  padding: 8px 10px;
  background: #f8fafc;
  border-radius: 6px;
  font-size: 0.8rem;
  color: #1e293b;
  white-space: pre-wrap;
  line-height: 1.5;
`;

const TaskDetailModal = ({ isOpen, task, onClose, onEdit, divisionColors = {} }) => {
  if (!task) return null;
  const groups = groupActivities(task);
  const overall = calcTaskStatus(groups);

  return (
    <AnimatePresence>
      {isOpen && (
        <Overlay
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
        >
          <Box
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
          >
            <Header>
              <HeaderLeft>
                {task.식별ID && <TaskIdBadge>{task.식별ID}</TaskIdBadge>}
                <TaskNameTitle title={task.과제명}>{task.과제명 || '제목 없음'}</TaskNameTitle>
                <StatusBadge $s={overall.status}>
                  {overall.status}
                  {(overall.status === '진행' || overall.status === '지연') && ` ${overall.progress}%`}
                </StatusBadge>
              </HeaderLeft>
              <HeaderActions>
                <EditBtn type="button" onClick={() => onEdit && onEdit(task)} title="수정">
                  <Pencil size={14} /> 수정
                </EditBtn>
                <CloseBtn type="button" onClick={onClose} title="닫기">
                  <X size={18} />
                </CloseBtn>
              </HeaderActions>
            </Header>

            <Body>
              <InfoBar>
                <InfoBlock>
                  <InfoLabel>사업부</InfoLabel>
                  <InfoValue>
                    {(task.사업부 || []).length > 0
                      ? task.사업부.map(n => <DivisionTag key={n} $color={divisionColors[n]}>{n}</DivisionTag>)
                      : <NoData>-</NoData>}
                  </InfoValue>
                </InfoBlock>
                <InfoBlock>
                  <InfoLabel>법인</InfoLabel>
                  <InfoValue>
                    {(task.법인 || []).length > 0
                      ? task.법인.map(n => <CorpTag key={n}>{n}</CorpTag>)
                      : <NoData>-</NoData>}
                  </InfoValue>
                </InfoBlock>
                <InfoBlock>
                  <InfoLabel>라인 / 제품</InfoLabel>
                  <InfoValue>
                    {(task['라인/제품'] || []).length > 0
                      ? task['라인/제품'].map(n => <LpTag key={n}>{n}</LpTag>)
                      : <NoData>-</NoData>}
                  </InfoValue>
                </InfoBlock>
              </InfoBar>

              <Section>
                <SectionTitle><Layers size={15} /> 대분류 / 액티비티</SectionTitle>
                {groups.length === 0 ? (
                  <NoData>등록된 대분류가 없습니다.</NoData>
                ) : groups.map(cat => {
                  const catProgress = calcCatProgress(cat);
                  return (
                    <CategoryCard key={cat.categoryId}>
                      <CategoryHeader>
                        <CategoryName>{cat.categoryName || cat.categoryId}</CategoryName>
                        <ProgressBlock>
                          <ProgressLabel $v={catProgress}>{catProgress}%</ProgressLabel>
                          <ProgressTrack>
                            <ProgressFill $v={catProgress} style={{ width: `${catProgress}%` }} />
                          </ProgressTrack>
                        </ProgressBlock>
                      </CategoryHeader>
                      <CategoryBody>
                        <DateRow>
                          <DateChip>시작 <strong>{cat.시작일 || '-'}</strong></DateChip>
                          <DateChip>종료 계획 <strong>{cat.목표일 || '-'}</strong></DateChip>
                          <DateChip>완료 <strong>{cat.완료일 || '-'}</strong></DateChip>
                        </DateRow>

                        {(cat.산출물 || []).length > 0 && (
                          <SubSection>
                            <SubSectionLabel>산출물</SubSectionLabel>
                            <FileList>
                              {cat.산출물.map((f, i) => (
                                <FileChip key={i}>
                                  <FileText size={12} />
                                  {f.name || f.fileName || '파일'}
                                </FileChip>
                              ))}
                            </FileList>
                          </SubSection>
                        )}

                        {(cat.기대효과 || []).length > 0 && (
                          <SubSection>
                            <SubSectionLabel>기대 효과</SubSectionLabel>
                            <EffectList>
                              {cat.기대효과.map(eff => (
                                <EffectCard key={eff.id}>
                                  <EffectName>
                                    <Target size={13} />
                                    {eff.기대효과명 || '효과명 미입력'}
                                  </EffectName>
                                  <EffectChipRow>
                                    <EffectChip>대분류 <strong>{eff.대분류 || '-'}</strong></EffectChip>
                                    <EffectChip>소분류 <strong>{eff.소분류 || '-'}</strong></EffectChip>
                                    <EffectChip>단위 <strong>{eff.단위 || '-'}</strong></EffectChip>
                                    <EffectChip>현재 <strong>{eff.현재 || '-'}</strong></EffectChip>
                                    <EffectChip>목표 <strong>{eff.목표 || '-'}</strong></EffectChip>
                                    <EffectChip>실적 <strong>{eff.실적 || '-'}</strong></EffectChip>
                                  </EffectChipRow>
                                  {eff.상세설명 && <EffectDesc>{eff.상세설명}</EffectDesc>}
                                </EffectCard>
                              ))}
                            </EffectList>
                          </SubSection>
                        )}

                        {cat.subcategories.length > 0 && (
                          <SubSection>
                            <SubSectionLabel>중분류 활동</SubSectionLabel>
                            <SubList>
                              {cat.subcategories.map(sub => (
                                <SubCard key={sub.subcategoryId}>
                                  <SubHeader>
                                    <SubName>{sub.subcategoryName}</SubName>
                                    <StatusBadge $s={sub.상태}>
                                      {sub.상태 || '계획'}
                                      {sub.상태 === '진행' && ` ${sub.진행률 ?? 0}%`}
                                    </StatusBadge>
                                  </SubHeader>
                                  <SubMeta>
                                    {sub.주관부서 && <SubMetaChip>주관부서 <strong>{sub.주관부서}</strong></SubMetaChip>}
                                    {sub.활용솔루션 && <SubMetaChip>활용솔루션 <strong>{sub.활용솔루션}</strong></SubMetaChip>}
                                    {sub.완료일 && <SubMetaChip>완료일 <strong>{sub.완료일}</strong></SubMetaChip>}
                                  </SubMeta>
                                  {(sub.담당자목록 || []).length > 0 && (
                                    <SubMeta>
                                      <SubSectionLabel style={{ marginRight: 4 }}>담당자</SubSectionLabel>
                                      {sub.담당자목록.map((p, i) => (
                                        <PersonnelChip key={i} $isPL={p.isPL}>
                                          {p.isPL && <PLBadge>PL</PLBadge>}
                                          {p.이름}
                                          {p.knoxId ? ` (${p.knoxId})` : ''}
                                          {p.부서 ? ` · ${p.부서}` : ''}
                                        </PersonnelChip>
                                      ))}
                                    </SubMeta>
                                  )}
                                  {sub.상세내용 && (
                                    <DetailText>{sub.상세내용}</DetailText>
                                  )}
                                </SubCard>
                              ))}
                            </SubList>
                          </SubSection>
                        )}
                      </CategoryBody>
                    </CategoryCard>
                  );
                })}
              </Section>
            </Body>
          </Box>
        </Overlay>
      )}
    </AnimatePresence>
  );
};

export default TaskDetailModal;
