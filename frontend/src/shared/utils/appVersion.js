/**
 * 화면과 서버의 버전이 맞나.
 *
 * 왜 둘을 견주나
 *     반출 체크리스트가 「백엔드ㆍ프론트를 함께 올린다 — **구 프론트 + 신 백엔드는
 *     저장이 400 이 된다**」고 적어 두었다. 그런데 어긋났는지를 화면에서 볼 길이
 *     없어서, 그 400 의 원인을 한참 찾게 된다. 두 값이 나란히 보이면 한 줄로 끝난다.
 *
 * ⚠️ **모르는 것과 다른 것은 다르다.** 서버 버전을 못 받았을 때(옛 서버라 그
 *    엔드포인트가 없거나, 네트워크가 끊겼거나) 「어긋났다」고 하면 안 된다.
 *    거짓 경고를 한 번 보면 그다음부터는 진짜 경고도 안 본다.
 */

/** 빌드할 때 심는다(vite.config.js 의 define). 개발 서버에서도 들어간다. */
export const APP_VERSION =
  typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '';

/** 서버가 「모른다」고 답할 때 쓰는 값. `backend/app/version.py` 와 같은 문자열. */
const UNKNOWN = 'unknown';

/**
 * 두 값을 견준 결과.
 *
 *     'ok'        같다
 *     'mismatch'  다르다 — 함께 안 올렸다는 뜻이다
 *     'unknown'   서버 값을 모른다 (아직 안 받았거나, 옛 서버라 답을 못 한다)
 */
export const versionState = (app, server) => {
  if (!app) return 'unknown';                 // 빌드에 안 심겼다 — 견줄 것이 없다
  if (!server || server === UNKNOWN) return 'unknown';
  return app === server ? 'ok' : 'mismatch';
};

/**
 * 푸터에 적을 한 줄.
 *
 * ⚠️ 같을 때는 **한 번만** 적는다. 「화면 v0.6.4 · 서버 v0.6.4」는 같은 값을 두 번
 *    읽게 해서, 정작 달라졌을 때 눈이 그 자리를 그냥 지나친다. 다를 때만 갈라 적는다.
 */
export const versionText = (app, server) => {
  const state = versionState(app, server);
  if (!app) return '';
  if (state === 'ok') return `v${app}`;
  if (state === 'mismatch') return `화면 v${app} · 서버 v${server}`;
  return `v${app}`;                            // 서버를 모르면 화면 것만
};
