/**
 * 과제 기본 정보 표 — **결과 보고서와 '모든 과제 현황' 상세 보기가 같이 쓴다.**
 *
 * 보고서 좌측 첫 칸(과제년도 … 담당/참여 … 과제 개요 · 추진 배경)을 그대로 옮긴 것이다.
 * 2026-08-08 에 상세 모달이 같은 표를 쓰게 하면서 빼냈다 — 같은 과제 정보를 두 화면이
 * 다른 표로 보여주면 사람이 다른 값으로 읽는다.
 *
 * ⚠️ **진행률은 이 표 안에 있다.** 상세 모달이 위에 따로 뽑아 두던 큰 진행률 블록은
 *    걷어냈다(2026-08-08 요청) — 같은 숫자가 한 화면에 두 번 나오면 어느 쪽이 정본인지
 *    묻게 된다.
 * ⚠️ 스타일을 고치면 **보고서도 같이 바뀐다.** 보고서는 PPT/PDF 내보내기와 짝이다.
 */
import React from 'react';
import styled from 'styled-components';
import { ZoomIn } from 'lucide-react';

import ReportImg from '../ReportImage/ReportImg';
import { percentText } from '../../utils/levelValue';
import { getSectionData } from '../../utils/detailSections';
import useImageLightbox from './useImageLightbox';

/** 진행상태 배지 색. 화면 여러 곳이 같은 색을 써야 해서 여기 하나만 둔다. */
export const getStatusStyle = (status) => {
  const statusMap = {
    '완료': { bg: '#dcfce7', text: '#16a34a' },
    '정상진행': { bg: '#dbeafe', text: '#2563eb' },
    '지연': { bg: '#fee2e2', text: '#dc2626' },
    '미착수': { bg: '#f3f4f6', text: '#6b7280' },
    '미배정': { bg: '#fef3c7', text: '#d97706' },
    '계획': { bg: '#e0e7ff', text: '#4f46e5' },
    '취소': { bg: '#fce7f3', text: '#be185d' },
  };
  return statusMap[status] || { bg: '#f3f4f6', text: '#6b7280' };
};

const ProjectBasicInfo = ({ project, onImageClick }) => {
  const [openImage, lightboxNode] = useImageLightbox(onImageClick);
  if (!project) return null;

  const overview = getSectionData(project, '과제개요');
  const background = getSectionData(project, '추진배경');
  const overviewImages = project['이미지_개요그림'] || [];
  const status = getStatusStyle(project.진행상태);

  return (
    <>
      <BasicInfoGrid>
        <InfoField>
          <InfoLabel>과제년도</InfoLabel>
          <InfoValue>{project.과제년도 || '-'}년</InfoValue>
        </InfoField>
        <InfoField>
          <InfoLabel>사업부</InfoLabel>
          <InfoValue>{project.사업부 || '-'}</InfoValue>
        </InfoField>
        <InfoField>
          <InfoLabel>프로세스</InfoLabel>
          <InfoValue>{project.프로세스 || '-'}</InfoValue>
        </InfoField>
        <InfoField>
          <InfoLabel>과제영역</InfoLabel>
          <InfoValue>{project.과제영역 || '-'}</InfoValue>
        </InfoField>
        <InfoField>
          <InfoLabel>과제구분</InfoLabel>
          <InfoValue>{project.과제구분 || '-'}</InfoValue>
        </InfoField>
        <InfoField>
          <InfoLabel>진행상태</InfoLabel>
          <InfoValue>
            <StatusBadge $bgColor={status.bg} $textColor={status.text}>
              {project.진행상태 || '미착수'}
            </StatusBadge>
          </InfoValue>
        </InfoField>
        <InfoField>
          <InfoLabel>진행률</InfoLabel>
          <InfoValue>
            <ProgressBarContainer>
              <ProgressBar>
                <ProgressFill $value={project.진행률 || 0} />
              </ProgressBar>
              <ProgressText $value={project.진행률 || 0}>
                {percentText(project.진행률)}
              </ProgressText>
            </ProgressBarContainer>
          </InfoValue>
        </InfoField>
        <InfoField>
          <InfoLabel>기간</InfoLabel>
          <InfoValue>{project.시작 || '-'}월 ~ {project.종료 || '-'}월</InfoValue>
        </InfoField>
        <InfoField>
          <InfoLabel>구분</InfoLabel>
          <InfoValue>
            {project.PoC과제여부 && (
              <StatusBadge $bgColor="#fef3c7" $textColor="#92400e" style={{ marginRight: '0.5rem' }}>PoC</StatusBadge>
            )}
            {project.중점과제여부 && (
              <StatusBadge $bgColor="#fce7f3" $textColor="#be185d">중점과제</StatusBadge>
            )}
            {!project.PoC과제여부 && !project.중점과제여부 && '-'}
          </InfoValue>
        </InfoField>
        <InfoField>
          <InfoLabel>과제PL</InfoLabel>
          <InfoValue>
            {project.과제PL ? <PersonBadge $highlight><span>{project.과제PL}</span></PersonBadge> : '-'}
          </InfoValue>
        </InfoField>

        {/* 담당/참여 — **부서별로 묶어** 보여준다. 이름만 늘어놓으면 누가 어느 팀인지 안 보인다. */}
        <InfoField style={{ gridColumn: '1 / -1' }}>
          <InfoLabel>담당/참여</InfoLabel>
          <InfoValue>
            {(() => {
              const members = project.과제참여인력목록 || [];
              const depts = project.담당부서목록 || [];
              const grouped = {};
              depts.forEach((d) => { if (!grouped[d]) grouped[d] = []; });
              members.forEach((p) => {
                const dept = p.부서 || '기타';
                if (!grouped[dept]) grouped[dept] = [];
                grouped[dept].push(p.이름);
              });
              const entries = Object.entries(grouped);
              if (entries.length === 0) return '-';
              return (
                <PersonnelGroupWrap>
                  {entries.map(([dept, names], idx) => (
                    <PersonnelGroupItem key={idx}>
                      <DeptBadge>{dept}</DeptBadge>
                      {names.map((name, nIdx) => (
                        <PersonBadge key={nIdx}><span>{name}</span></PersonBadge>
                      ))}
                    </PersonnelGroupItem>
                  ))}
                </PersonnelGroupWrap>
              );
            })()}
          </InfoValue>
        </InfoField>

        {/* 과제 개요 · 추진 배경 — 상세 정보 7섹션 중 이 둘만 여기 있다.
            나머지 다섯은 오른쪽(`ProjectDetailSections`)이다. */}
        {overview && (
          <InfoField style={{ gridColumn: '1 / -1' }}>
            <InfoLabel>과제 개요</InfoLabel>
            <InfoValue style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
              {overview.items.map((item, i) => item.text && <span key={i}>- {item.text}</span>)}
              {overviewImages.length > 0 && (
                <DetailInlineImages style={{ marginTop: '0.5rem' }}>
                  {overviewImages.map((img, imgIdx) => (
                    <ImageItem key={imgIdx}>
                      <ImagePreview
                        onClick={() => openImage(overviewImages, imgIdx)}
                        title="클릭하여 크게 보기"
                      >
                        <ReportImg img={img} />
                        <ZoomHint className="zoom-hint"><ZoomIn size={12} />크게 보기</ZoomHint>
                      </ImagePreview>
                      {img.caption && <ImageCaption>{img.caption}</ImageCaption>}
                    </ImageItem>
                  ))}
                </DetailInlineImages>
              )}
            </InfoValue>
          </InfoField>
        )}
        {background && (
          <InfoField style={{ gridColumn: '1 / -1' }}>
            <InfoLabel>추진 배경</InfoLabel>
            <InfoValue style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.125rem' }}>
              {background.items.map((item, i) => item.text && <span key={i}>- {item.text}</span>)}
            </InfoValue>
          </InfoField>
        )}
      </BasicInfoGrid>
      {lightboxNode}
    </>
  );
};

/* ── 스타일 — **보고서에서 그대로 옮겨온 것이다.** ── */

const BasicInfoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0;
`;

const InfoField = styled.div`
  display: flex;
  border-bottom: 1px solid #f1f5f9;
  border-right: 1px solid #f1f5f9;
  min-height: 44px;
`;

const InfoLabel = styled.div`
  width: 110px;
  min-width: 110px;
  padding: 0.75rem 1rem;
  background: #f8fafc;
  font-size: 0.8rem;
  font-weight: 600;
  color: #475569;
  display: flex;
  align-items: center;
  border-right: 1px solid #f1f5f9;
`;

const InfoValue = styled.div`
  flex: 1;
  padding: 0.75rem 1rem;
  font-size: 0.85rem;
  color: #1e293b;
  display: flex;
  align-items: center;
  word-break: break-word;
`;

const StatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  background: ${props => props.$bgColor || '#e2e8f0'};
  color: ${props => props.$textColor || '#475569'};
`;

const ProgressBarContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
`;

const ProgressBar = styled.div`
  flex: 1;
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
  max-width: 200px;
`;

const ProgressFill = styled.div`
  height: 100%;
  background: ${props => {
    if (props.$value >= 100) return '#10b981';
    if (props.$value >= 70) return '#3b82f6';
    if (props.$value >= 30) return '#f59e0b';
    return '#ef4444';
  }};
  border-radius: 4px;
  width: ${props => Math.min(props.$value, 100)}%;
  transition: width 0.3s ease;
`;

const ProgressText = styled.span`
  font-size: 0.85rem;
  font-weight: 700;
  color: ${props => {
    if (props.$value >= 100) return '#10b981';
    if (props.$value >= 70) return '#3b82f6';
    if (props.$value >= 30) return '#f59e0b';
    return '#ef4444';
  }};
  min-width: 40px;
`;

const PersonnelGroupWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
`;

const PersonnelGroupItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-wrap: wrap;
`;

const DeptBadge = styled.div`
  padding: 0.3rem 0.625rem;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 0.375rem;
  font-size: 0.78rem;
  color: #16a34a;
  font-weight: 500;
`;

const PersonBadge = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.3rem 0.625rem;
  background: ${props => props.$highlight ? '#ede9fe' : '#f5f3ff'};
  border: 1px solid ${props => props.$highlight ? '#c4b5fd' : '#e9d5ff'};
  border-radius: 0.375rem;
  font-size: 0.78rem;
  color: #6d28d9;
  font-weight: ${props => props.$highlight ? '600' : '500'};
`;

const DetailInlineImages = styled.div`
  display: flex;
  gap: 0.75rem;
  margin-top: 0.75rem;
  flex-wrap: wrap;
`;

const ImageItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  flex: 1;
  min-width: 250px;
`;

const ImagePreview = styled.div`
  position: relative;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  overflow: hidden;
  background: #f8fafc;
  cursor: zoom-in;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  img {
    width: 100%;
    display: block;
    object-fit: contain;
    max-height: 400px;
  }

  &:hover {
    border-color: #6366f1;
    box-shadow: 0 4px 14px rgba(99, 102, 241, 0.2);
  }

  &:hover .zoom-hint {
    opacity: 1;
  }
`;

const ZoomHint = styled.div`
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  background: rgba(15, 23, 42, 0.7);
  color: white;
  font-size: 0.7rem;
  font-weight: 600;
  opacity: 0;
  transition: opacity 0.15s ease;
  pointer-events: none;
`;

const ImageCaption = styled.div`
  font-size: 0.75rem;
  color: #64748b;
  text-align: center;
  font-style: italic;
`;

export default ProjectBasicInfo;
