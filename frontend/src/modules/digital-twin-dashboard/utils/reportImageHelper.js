/**
 * 보고서 이미지 헬퍼 (Phase 1-2)
 *
 * 배경
 *   보고서 이미지가 base64 data URI 로 과제 JSON 안에 인라인 저장되어 있었다.
 *   운영 실측(2026-07-28): 23개 과제 / 33.9 MB / 저장 payload 의 94.4%.
 *   과제 하나의 진행률만 바꿔도 그 33.9 MB 가 통째로 왕복했다.
 *
 * 전환 방식 — "복사" 원칙
 *   이관 스크립트가 base64 를 파일로 복사하고 원소에 imageId 를 붙인다.
 *   이 시점에는 imageId 와 dataUrl 이 **둘 다** 존재한다.
 *   따라서 표시 로직은 아래 순서를 따른다:
 *
 *     1) imageId 가 있으면 서버에서 받아온다   ← 새 경로
 *     2) 실패하거나 imageId 가 없으면 dataUrl  ← 기존 경로 (폴백)
 *
 *   덕분에 dataUrl 을 지우기(--strip) 전에 새 경로가 실제로 동작하는지 확인할 수 있고,
 *   서버 이미지에 문제가 생겨도 화면이 깨지지 않는다.
 *
 * 이미지 내용은 불변이므로(수정 시 새 레코드 생성) objectURL 을 캐시해 재사용한다.
 */

import { useEffect, useState } from 'react';
import { fetchReportImageBlob } from '../services/settingsApi';

// imageId → objectURL (성공) / Promise (진행 중)
const objectUrlCache = new Map();
const inFlight = new Map();

/**
 * imageId 에 해당하는 objectURL 을 얻는다. 같은 이미지는 한 번만 내려받는다.
 * @param {number} imageId
 * @returns {Promise<string>} objectURL
 */
export const getReportImageObjectUrl = async (imageId) => {
  if (objectUrlCache.has(imageId)) {
    return objectUrlCache.get(imageId);
  }
  if (inFlight.has(imageId)) {
    return inFlight.get(imageId);
  }

  const promise = fetchReportImageBlob(imageId)
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      objectUrlCache.set(imageId, url);
      inFlight.delete(imageId);
      return url;
    })
    .catch((err) => {
      inFlight.delete(imageId);
      throw err;
    });

  inFlight.set(imageId, promise);
  return promise;
};

/**
 * 즉시 사용 가능한 src 를 반환한다 (비동기 로딩 없이).
 * 캐시된 objectURL 이 있으면 그것을, 없으면 dataUrl(레거시)을 준다.
 * @param {Object} img - { imageId?, dataUrl?, caption?, fileName? }
 * @returns {string|null}
 */
export const getImmediateSrc = (img) => {
  if (!img) return null;
  if (img.imageId && objectUrlCache.has(img.imageId)) {
    return objectUrlCache.get(img.imageId);
  }
  return img.dataUrl || null;
};

/**
 * 보고서 이미지 하나의 src 를 해석하는 React 훅.
 *
 * @param {Object} img - { imageId?, dataUrl? }
 * @returns {{ src: string|null, loading: boolean, error: boolean }}
 */
export const useReportImageSrc = (img) => {
  const [src, setSrc] = useState(() => getImmediateSrc(img));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const imageId = img?.imageId;
  const dataUrl = img?.dataUrl;

  useEffect(() => {
    let cancelled = false;

    // imageId 가 없으면 레거시 dataUrl 을 그대로 쓴다
    if (!imageId) {
      setSrc(dataUrl || null);
      setLoading(false);
      setError(false);
      return undefined;
    }

    // 이미 받아둔 것이 있으면 즉시 사용
    if (objectUrlCache.has(imageId)) {
      setSrc(objectUrlCache.get(imageId));
      setLoading(false);
      setError(false);
      return undefined;
    }

    setLoading(true);
    setError(false);
    // 로딩 중에도 dataUrl 이 있으면 먼저 보여준다 (전환기에는 둘 다 존재)
    if (dataUrl) setSrc(dataUrl);

    getReportImageObjectUrl(imageId)
      .then((url) => {
        if (cancelled) return;
        setSrc(url);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        // 서버에서 못 받아오면 레거시 dataUrl 로 폴백한다
        setLoading(false);
        if (dataUrl) {
          setSrc(dataUrl);
        } else {
          setError(true);
          setSrc(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [imageId, dataUrl]);

  return { src, loading, error };
};

/**
 * 이미지 리사이즈 + JPEG 압축 (Phase 1-3 재발 방지)
 *
 * 원본을 그대로 올리면 스마트폰 사진 한 장이 수 MB 다.
 * 보고서 표시 용도로는 긴 변 1600px / 품질 0.75 면 충분하고, 통상 10~20배 작아진다.
 *
 * @param {File} file
 * @param {Object} [opts] - { maxSize = 1600, quality = 0.75 }
 * @returns {Promise<Blob>} 압축된 JPEG Blob (실패 시 원본 File 을 그대로 반환)
 */
export const compressImageFile = (file, opts = {}) => {
  const { maxSize = 1600, quality = 0.75 } = opts;

  return new Promise((resolve) => {
    // GIF 는 애니메이션이 깨지므로 건드리지 않는다
    if (!file || !file.type || !file.type.startsWith('image/') || file.type === 'image/gif') {
      resolve(file);
      return;
    }

    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      try {
        const { width, height } = image;
        const scale = Math.min(1, maxSize / Math.max(width, height));
        const w = Math.max(1, Math.round(width * scale));
        const h = Math.max(1, Math.round(height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        // 투명 PNG 를 JPEG 로 바꾸면 검게 나오므로 흰 배경을 먼저 깐다
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(image, 0, 0, w, h);

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            // 압축 결과가 원본보다 크면 원본을 쓴다
            resolve(blob && blob.size < file.size ? blob : file);
          },
          'image/jpeg',
          quality
        );
      } catch (err) {
        URL.revokeObjectURL(url);
        resolve(file);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    image.src = url;
  });
};
