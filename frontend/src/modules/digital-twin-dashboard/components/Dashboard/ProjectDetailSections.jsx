/**
 * 상세 과제 정보 렌더러 — **결과 보고서와 '모든 과제 현황' 상세 보기가 같이 쓴다.**
 *
 * 왜 하나로 합쳤나
 *     둘 다 같은 데이터(상세 과제 정보 7섹션)를 보여주는데 **양식이 다르면 사람이
 *     헷갈린다.** 처음엔 상세 보기를 따로 그렸다가 2026-08-08 에 보고서 쪽 마크업을
 *     그대로 끌어와 하나로 만들었다 — 이제 한쪽을 고치면 양쪽이 같이 바뀐다.
 *
 * 화면마다 다른 것은 **셋뿐**이고 전부 prop 으로 받는다.
 *     exclude       보고서는 과제개요·추진배경을 **왼쪽 기본정보 칸**에 따로 그린다
 *     onImageClick  보고서는 자기 라이트박스를 쓴다. 안 주면 이 컴포넌트가 하나 띄운다
 *                   (상세 모달은 이미 모달 안이라 자기 것이 필요하다)
 *     performances  성과 테이블 보강용 전역 성과 목록. 없으면 과제에 실린 값만 쓴다
 *
 * ⚠️ 스타일을 여기서 바꾸면 **보고서 화면도 같이 바뀐다.** 보고서는 PPT/PDF 내보내기와
 *    짝이라 눈으로 확인하고 고칠 것.
 */
import React from 'react';
import styled from 'styled-components';
import { ZoomIn, FileText } from 'lucide-react';

import ReportImg from '../ReportImage/ReportImg';
import useImageLightbox from './useImageLightbox';
// 수준값의 0 과 미입력은 다른 뜻이다. `|| '-'` 로 다루면 0 이 '-' 로 찍힌다.
import { levelText } from '../../utils/levelValue';
import {
  DETAIL_SECTIONS, PARENT_ONLY_SECTIONS, SECTION_IMAGE_KEY,
  getSectionData, hasAnyDetail,
} from '../../utils/detailSections';

/**
 * 과제에 실린 성과에 전역 성과 정보를 얹는다(단위·수준값은 성과 본체가 정본).
 * `과제기여도` 만은 **연결 쪽 값**이라 덮어쓰지 않는다.
 */
export const enrichPerformances = (project, performances = []) => {
  const list = project?.성과목록 || [];
  if (list.length === 0) return [];
  return list.map((perf) => {
    const found = (performances || []).find((gp) =>
      (perf.uuid && gp.uuid && perf.uuid === gp.uuid)
      || (perf.id && gp.id && perf.id === gp.id));
    return { ...perf, ...(found || {}), 과제기여도: perf.과제기여도 };
  });
};

const ProjectDetailSections = ({
  project,
  performances = [],
  exclude = [],
  onImageClick,
  emptyHint = false,
}) => {
  // `onImageClick` 을 안 준 화면(상세 모달)에서는 훅이 라이트박스를 대신 띄운다.
  const [openImage, lightboxNode] = useImageLightbox(onImageClick);

  if (!project) return null;

  const sections = DETAIL_SECTIONS.filter((s) => !exclude.includes(s.key));

  if (emptyHint && !hasAnyDetail(project)) {
    return (
      <Empty>
        <FileText size={15} />
        상세 과제 정보가 아직 작성되지 않았습니다.
        <em>과제 편집창 ▸ 기본정보 탭 ▸ [상세 과제 정보] 에서 채웁니다.</em>
      </Empty>
    );
  }

  return (
    <>
      {sections.map(({ key, label }) => {
        const data = getSectionData(project, key);
        const imgKey = SECTION_IMAGE_KEY[key];
        const sectionImages = imgKey ? (project[`이미지_${imgKey}`] || []) : [];

        // 🐞 예전에는 **글이 비면 그림도 통째로 사라졌다**(섹션에서 먼저 빠져나갔다).
        //    그림만 붙여 둔 과제에서는 "이미지 연결이 끊긴 것" 처럼 보인다 —
        //    붙여 둔 그림은 글이 없어도 보여준다(2026-08-08).
        if (!data && sectionImages.length === 0) return null;

        return (
          <DetailParagraph key={key}>
            <DetailParagraphLabel>{label}</DetailParagraphLabel>
            <DetailParagraphContent>
              {(data?.items || []).map((item, pIdx) => (
                <span key={pIdx}>
                  {item.text && <DetailParentLine>- {item.text}</DetailParentLine>}
                  {/* 부모 전용 섹션은 하위 줄을 그리지 않는다 — 편집 화면이 만들지
                      못하게 막아 둔 자리라, 옛 데이터에 남아 있어도 보여주지 않는다 */}
                  {!PARENT_ONLY_SECTIONS.has(key)
                    && item.children && item.children.filter((c) => c.text).length > 0 && (
                    <DetailChildList>
                      {item.children.filter((c) => c.text).map((child, cIdx) => (
                        <DetailChildItem key={cIdx}>
                          <DetailChildBullet>&middot;</DetailChildBullet>{child.text}
                        </DetailChildItem>
                      ))}
                    </DetailChildList>
                  )}
                </span>
              ))}
            </DetailParagraphContent>

            {/* 성과 섹션에는 연결된 성과의 수치 표를 함께 — 글만 있으면 "얼마나" 를 못 본다 */}
            {key === '성과' && (project.성과목록 || []).length > 0 && (
              <PerfTable>
                <thead>
                  <tr>
                    <PerfTh>성과분류</PerfTh>
                    <PerfTh>성과항목명</PerfTh>
                    <PerfTh>기존</PerfTh>
                    <PerfTh>목표</PerfTh>
                    <PerfTh>실적</PerfTh>
                  </tr>
                </thead>
                <tbody>
                  {enrichPerformances(project, performances).map((perf, i) => {
                    const unit = perf.단위 || '';
                    const base = parseFloat(perf.현재수준);
                    const target = parseFloat(perf.목표수준);
                    const actual = parseFloat(perf.실적수준);
                    const fmtDelta = (v) => {
                      if (isNaN(base) || isNaN(v)) return null;
                      const d = +(v - base).toFixed(2);
                      return d >= 0 ? `+${d}` : `${d}`;
                    };
                    const targetDelta = fmtDelta(target);
                    const actualDelta = fmtDelta(actual);
                    return (
                      <tr key={i}>
                        <PerfTd style={{ textAlign: 'left' }}>{perf.소분류 || perf.대분류 || '-'}</PerfTd>
                        <PerfTd style={{ textAlign: 'left' }}>{(perf.성과항목 || '-').replace(/^\[.+?\]\s*/, '')}</PerfTd>
                        <PerfTd>{levelText(perf.현재수준, '-')}{unit && ` ${unit}`}</PerfTd>
                        <PerfTd>
                          {levelText(perf.목표수준, '-')}{unit && ` ${unit}`}
                          {targetDelta && <PerfDelta>{targetDelta}</PerfDelta>}
                        </PerfTd>
                        <PerfTd>
                          {levelText(perf.실적수준, '-')}{unit && ` ${unit}`}
                          {actualDelta && <PerfDelta $positive={actual >= target}>{actualDelta}</PerfDelta>}
                        </PerfTd>
                      </tr>
                    );
                  })}
                </tbody>
              </PerfTable>
            )}

            {sectionImages.length > 0 && (
              <DetailInlineImages>
                {sectionImages.map((img, imgIdx) => (
                  <ImageItem key={imgIdx}>
                    <ImagePreview
                      onClick={() => openImage(sectionImages, imgIdx)}
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
          </DetailParagraph>
        );
      })}

      {lightboxNode}
    </>
  );
};

/* ── 스타일 — **보고서에서 그대로 옮겨온 것이다.** 여기를 고치면 보고서도 바뀐다. ── */

const DetailParagraph = styled.div`
  margin-bottom: 1.25rem;
  &:last-child {
    margin-bottom: 0;
  }
`;

const DetailParagraphLabel = styled.div`
  font-size: 0.95rem;
  font-weight: 700;
  color: #6366f1;
  margin-bottom: 0.5rem;
  letter-spacing: 0.02em;
`;

const DetailParagraphContent = styled.div`
  font-size: 0.85rem;
  color: #334155;
  line-height: 1.7;

  & > span {
    display: block;
    margin-bottom: 0.25rem;
    &:last-child { margin-bottom: 0; }
  }
`;

const DetailParentLine = styled.div`
  display: block;
  margin-bottom: 0.25rem;
`;

const DetailChildList = styled.div`
  margin: 0.125rem 0 0.375rem 0.75rem;
`;

const DetailChildItem = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.375rem;
  font-size: 0.82rem;
  color: #475569;
  line-height: 1.6;
  margin-bottom: 0.125rem;
`;

const DetailChildBullet = styled.span`
  color: #94a3b8;
  font-weight: 700;
  font-size: 1rem;
  line-height: 1.4;
  flex-shrink: 0;
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

const PerfTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
  margin-top: 0.75rem;
`;

const PerfTh = styled.th`
  padding: 0.625rem 0.75rem;
  background: #f1f5f9;
  color: #475569;
  font-weight: 600;
  text-align: center;
  border: 1px solid #e2e8f0;
  white-space: nowrap;
`;

const PerfTd = styled.td`
  padding: 0.5rem 0.75rem;
  border: 1px solid #e2e8f0;
  text-align: center;
  color: #1e293b;
`;

const PerfDelta = styled.span`
  display: block;
  font-size: 0.68rem;
  font-weight: 600;
  color: ${props => props.$positive === false ? '#dc2626' : '#6b7280'};
  margin-top: 0.125rem;
`;

/* ── 아래는 이 컴포넌트에만 있는 것 (보고서는 자기 라이트박스를 쓴다) ── */

const Empty = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-wrap: wrap;
  padding: 0.75rem;
  border: 1px dashed #cbd5e1;
  border-radius: 0.5rem;
  color: #64748b;
  font-size: 0.8125rem;

  em { font-style: normal; color: #94a3b8; font-size: 0.75rem; }
`;

/* 상세 모달(z-index 1000대) 위에 뜬다 */
export default ProjectDetailSections;
