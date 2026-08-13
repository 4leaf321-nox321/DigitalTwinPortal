/**
 * 이미지 크게 보기 — 화면이 자기 라이트박스를 안 갖고 있을 때 대신 띄운다.
 *
 * 왜 훅인가
 *     보고서 화면은 **자기 라이트박스**가 이미 있다(다른 UI 와 엮여 있다).
 *     상세 모달은 없다. 그래서 공용 컴포넌트들(`ProjectBasicInfo`·`ProjectDetailSections`)이
 *     `onImageClick` 을 받으면 그걸 쓰고, 없으면 이 훅이 만든 것을 쓴다.
 *     같은 코드를 두 컴포넌트에 복사하지 않으려고 뺐다.
 *
 * 반환: `[openImage(images, index), lightboxNode]`
 *       `lightboxNode` 를 렌더 트리에 그대로 끼워 넣으면 된다.
 */
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { X } from 'lucide-react';

import ReportImg from '../ReportImage/ReportImg';

const useImageLightbox = (onImageClick) => {
  const [lightbox, setLightbox] = useState(null);   // {images, index}

  useEffect(() => {
    if (!lightbox) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setLightbox(null);
      if (e.key === 'ArrowRight') setLightbox((l) => l && ({ ...l, index: (l.index + 1) % l.images.length }));
      if (e.key === 'ArrowLeft') setLightbox((l) => l && ({ ...l, index: (l.index - 1 + l.images.length) % l.images.length }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  const openImage = onImageClick || ((images, index) => setLightbox({ images, index }));

  const node = lightbox ? (
    <Overlay onClick={() => setLightbox(null)}>
      <CloseBtn type="button" onClick={() => setLightbox(null)} title="닫기 (Esc)">
        <X size={20} />
      </CloseBtn>
      <Body onClick={(e) => e.stopPropagation()}>
        <ReportImg img={lightbox.images[lightbox.index]} />
        {lightbox.images.length > 1 && (
          <Nav>
            {lightbox.index + 1} / {lightbox.images.length}
            <span>← → 로 넘기기</span>
          </Nav>
        )}
      </Body>
    </Overlay>
  ) : null;

  return [openImage, node];
};

/* 상세 모달(z-index 1000대) 위에 떠야 한다 */
const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 4000;
  background: rgba(0, 0, 0, 0.82);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  cursor: zoom-out;
`;

const Body = styled.div`
  max-width: 92vw;
  max-height: 88vh;
  cursor: default;
  text-align: center;

  img { max-width: 92vw; max-height: 82vh; object-fit: contain; }
`;

const CloseBtn = styled.button`
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 2.25rem;
  height: 2.25rem;
  border: none;
  border-radius: 0.5rem;
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover { background: rgba(255, 255, 255, 0.28); }
`;

const Nav = styled.div`
  margin-top: 0.5rem;
  color: #e2e8f0;
  font-size: 0.75rem;

  span { margin-left: 0.5rem; color: #94a3b8; }
`;

export default useImageLightbox;
