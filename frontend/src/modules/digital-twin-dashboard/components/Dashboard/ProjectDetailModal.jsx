/**
 * 과제 상세 모달 — **결과 보고서와 같은 양식**으로 과제 하나를 보여준다. 읽기 전용.
 *
 * 어디서 쓰나
 *     · '모든 과제 현황' 에서 과제를 눌렀을 때
 *     · '전체 요약' 의 여러 상세 모달(지표·사업부·AI 현황…) 안의 과제 줄을 눌렀을 때
 *
 * 왜 컴포넌트로 뺐나 (2026-08-08)
 *     원래 `AllProjectsView` 안에만 있었다. 전체 요약에서도 같은 것을 띄우려면
 *     **복사**밖에 방법이 없었는데, 그러면 한쪽만 고쳐지는 화면이 또 하나 생긴다.
 *     지금은 `project` 하나만 주면 어디서든 같은 모달이 뜬다.
 *
 * 안은 전부 공용 조각이라 **보고서와 같은 것을 본다** —
 *   `ProjectBasicInfo`(기본 정보 표+개요·배경) · `ProjectMilestones`(마일스톤)
 *   · `ProjectDetailSections`(상세 5섹션+성과 표+그림)
 */
import React from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, CheckCircle2, Target } from 'lucide-react';

import ProjectBasicInfo from './ProjectBasicInfo';
import ProjectMilestones, { MilestoneBadge, getActionItemProgress } from './ProjectMilestones';
import ProjectDetailSections from './ProjectDetailSections';

const ProjectDetailModal = ({
  project, onClose, performances = [], divisionColors = {}, statusColors = {},
}) => (
  <AnimatePresence>
    {project && (
      <Overlay
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <Content
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <Header>
            <HeaderLeft>
              <Title>{project.과제명}</Title>
              <Badges>
                {project.사업부 && <Badge $bg={divisionColors[project.사업부]}>{project.사업부}</Badge>}
                {project.프로세스 && <Badge $bg="#3b82f6">{project.프로세스}</Badge>}
                {project.진행상태 && <Badge $bg={statusColors[project.진행상태]}>{project.진행상태}</Badge>}
                {project.PoC과제여부 && <Badge $bg="#f59e0b">PoC</Badge>}
                {project.중점과제여부 && <Badge $bg="#ef4444">중점</Badge>}
                {project.사업부내공개여부 && (
                  <Badge $bg="#475569" title="사업부 내 공개">🔒 사업부내</Badge>
                )}
              </Badges>
            </HeaderLeft>
            <CloseBtn onClick={onClose}><X size={20} /></CloseBtn>
          </Header>

          <Body>
            <TwoCol>
              {/* 좌: 기본 정보 표 · 마일스톤 · 상세 설명 · 연결된 성과 (보고서 좌측 순서) */}
              <Col>
                {/*
                  기본 정보 표 — **보고서 좌측 첫 칸과 같은 컴포넌트**다.
                  과제년도·사업부·진행상태·진행률·담당/참여·과제 개요·추진 배경이 전부 이 안에 있다.
                  진행률을 위에 크게 따로 뽑던 블록은 걷어냈다 — 같은 숫자가 두 번 나오면
                  어느 쪽이 정본인지 묻게 된다.
                */}
                <Section>
                  <ProjectBasicInfo project={project} />
                </Section>

                <Section>
                  <SectionTitle>
                    <CheckCircle2 size={16} />
                    마일스톤 ({project.액션아이템목록?.length || 0}개)
                    {(project.액션아이템목록?.length || 0) > 0 && (() => {
                      const prog = getActionItemProgress(project);
                      return <MilestoneBadge>{prog.completed}/{prog.total} ({prog.rate}%)</MilestoneBadge>;
                    })()}
                  </SectionTitle>
                  {project.액션아이템목록?.length > 0 ? (
                    <ProjectMilestones project={project} />
                  ) : (
                    <Empty>등록된 액션 아이템이 없습니다.</Empty>
                  )}
                </Section>

                {/*
                  과제 상세 설명 — **보고서에는 없는 칸**이지만 남긴다. 이 값은 다른 어느
                  화면에도 안 나와서, 빼면 볼 데가 사라진다. 자리는 마일스톤 아래다(2026-08-08 요청).
                */}
                {project.과제상세설명 && (
                  <Section>
                    <SectionTitle>
                      <FileText size={16} />
                      과제 상세 설명
                    </SectionTitle>
                    <Description dangerouslySetInnerHTML={{ __html: project.과제상세설명 }} />
                  </Section>
                )}

                {/*
                  연결된 성과 — 보고서에는 없다(그쪽은 '성과' 섹션의 표로만 보여준다).
                  여기서는 남긴다: **성과 섹션 글이 비면 그 표가 아예 안 나와서** 볼 데가 사라진다.
                */}
                <Section>
                  <SectionTitle>
                    <Target size={16} />
                    연결된 성과 ({project.성과목록?.length || 0}개)
                  </SectionTitle>
                  {project.성과목록?.length > 0 ? (
                    <PerfList>
                      {project.성과목록.map((perf, i) => (
                        <PerfItem key={i}>
                          <PerfName>
                            {typeof perf === 'object' ? (perf.성과항목 || perf.name || '-') : perf}
                          </PerfName>
                          {typeof perf === 'object' && perf.대분류 && (
                            <PerfCategory>{perf.대분류}</PerfCategory>
                          )}
                        </PerfItem>
                      ))}
                    </PerfList>
                  ) : (
                    <Empty>연결된 성과가 없습니다.</Empty>
                  )}
                </Section>
              </Col>

              {/* 우: 상세 과제 정보 — 보고서 우측 패널과 같은 컴포넌트·같은 양식 */}
              <Col>
                <Section>
                  <SectionTitle>
                    <FileText size={16} />
                    상세 과제 정보
                    {project.상세정보_입력완료 && (
                      <Badge $bg="#16a34a" style={{ marginLeft: '0.5rem' }}>작성 완료</Badge>
                    )}
                  </SectionTitle>
                  <ProjectDetailSections
                    project={project}
                    performances={performances}
                    exclude={['과제개요', '추진배경']}
                    emptyHint
                  />
                </Section>
              </Col>
            </TwoCol>
          </Body>
        </Content>
      </Overlay>
    )}
  </AnimatePresence>
);

/* ── 스타일 ── */

const Overlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
`;

const Content = styled(motion.div)`
  background: white;
  border-radius: 1rem;
  /* 화면의 90% — 보고서와 같은 내용을 좌우로 나눠 담아야 해서 넓게 쓴다.
     max-width 를 두면 큰 모니터에서 다시 좁아지므로 두지 않는다.
     세로는 상한이다 — 내용이 짧으면 그만큼만 뜨고, 길면 여기서 멈추고 안에서 스크롤된다.
     ⚠️ 이 주석은 템플릿 리터럴 안이다 — 백틱을 쓰지 말 것(문자열이 끊긴다). */
  width: 90vw;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 1rem 2rem;
  background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
  color: white;
`;

const HeaderLeft = styled.div`
  flex: 1;
  min-width: 0;
`;

const Title = styled.h2`
  font-size: 1.125rem;
  font-weight: 700;
  margin: 0 0 0.5rem 0;
  line-height: 1.3;
  word-break: break-word;
`;

const Badges = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const Badge = styled.span`
  padding: 0.25rem 0.625rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  color: white;
  background: ${props => props.$bg || 'rgba(255, 255, 255, 0.25)'};
`;

const CloseBtn = styled.button`
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;

  &:hover { background: rgba(255, 255, 255, 0.32); }
`;

const Body = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem 2rem;

  &::-webkit-scrollbar { width: 8px; }
  &::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
  &::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
`;

const TwoCol = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
  height: 100%;

  @media (max-width: 1100px) {
    grid-template-columns: 1fr;
  }
`;

const Col = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow-y: auto;
`;

const Section = styled.div`
  margin-bottom: 1.25rem;

  &:last-child { margin-bottom: 0; }
`;

const SectionTitle = styled.h3`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9375rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 0.625rem;
`;

const Description = styled.div`
  font-size: 0.85rem;
  color: #334155;
  line-height: 1.7;
  word-break: break-word;

  img { max-width: 100%; }
  p { margin: 0 0 0.375rem; }
`;

const Empty = styled.div`
  padding: 0.75rem;
  text-align: center;
  color: #94a3b8;
  font-size: 0.8125rem;
  border: 1px dashed #e2e8f0;
  border-radius: 0.5rem;
`;

const PerfList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
`;

const PerfItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  background: #f8fafc;
`;

const PerfName = styled.span`
  font-size: 0.8125rem;
  color: #1e293b;
  min-width: 0;
  word-break: break-word;
`;

const PerfCategory = styled.span`
  flex-shrink: 0;
  font-size: 0.6875rem;
  font-weight: 600;
  color: #4338ca;
  background: #e0e7ff;
  border-radius: 0.25rem;
  padding: 0.0625rem 0.375rem;
`;

export default ProjectDetailModal;
