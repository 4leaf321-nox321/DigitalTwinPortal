import { useEffect, useState } from 'react';

/**
 * 화면이 이 폭 이상인가. **곁가지를 펼칠지 정하는 데 쓴다.**
 *
 * ⚠️ CSS 미디어 쿼리로 한쪽을 감추면 같은 컴포넌트가 **두 곳에 그려진다.**
 *    그러면 고른 후보나 입력하던 제목 같은 상태가 두 벌이 되어, 한쪽에서
 *    고른 것이 다른 쪽에는 없다. 그래서 자바스크립트로 판단해 **한 곳만**
 *    그린다.
 */
export default function useWideScreen(minWidth) {
  const query = `(min-width: ${minWidth}px)`;
  const [wide, setWide] = useState(
    () => (typeof window !== 'undefined'
      ? window.matchMedia(query).matches
      : false),
  );

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (e) => setWide(e.matches);
    setWide(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);

  return wide;
}
