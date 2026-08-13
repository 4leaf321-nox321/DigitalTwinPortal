/**
 * 보고서 이미지 표시 컴포넌트 (Phase 1-2)
 *
 * 원소가 imageId 를 가지면 서버에서 받아오고, 없거나 실패하면 레거시 dataUrl 로 폴백한다.
 * 자세한 배경은 utils/reportImageHelper.js 참조.
 *
 * 부모의 styled-components 가 `img { ... }` 로 스타일을 주고 있으므로
 * 반드시 평범한 <img> 엘리먼트를 렌더링한다.
 */

import React from 'react';
import { useReportImageSrc } from '../../utils/reportImageHelper';

const placeholderStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '100%',
  minHeight: '60px',
  fontSize: '0.75rem',
  color: '#9ca3af',
  backgroundColor: '#f3f4f6',
};

const ReportImg = ({ img, alt, ...rest }) => {
  const { src, loading, error } = useReportImageSrc(img);

  if (!src) {
    return (
      <div style={placeholderStyle}>
        {error ? '이미지를 불러올 수 없습니다' : (loading ? '불러오는 중…' : '이미지 없음')}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt ?? (img?.caption || img?.fileName || '보고서 이미지')}
      {...rest}
    />
  );
};

export default ReportImg;
