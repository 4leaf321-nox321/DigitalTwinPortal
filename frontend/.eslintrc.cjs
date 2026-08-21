/**
 * 화면 코드 검사 규칙.
 *
 * 왜 생겼나
 *     ESLint 와 플러그인은 처음부터 devDependencies 에 있었고 `npm run lint`
 *     스크립트도 있었는데 **설정 파일이 없어서 한 번도 돈 적이 없다.** 그 빈자리로
 *     같은 종류의 사고가 세 번 났다.
 *
 *         0.4.2  getISOWeek 를 import 에 안 넣어 KPI 화면이 진입 즉시 죽었다.
 *                세 릴리스가 그 상태로 나갔다.            -> no-undef
 *         0.5.0  useMemo 의존성에 aiHistory 를 안 넣어 전체 카드가 낡은 값을
 *                붙들고 있었다.                          -> exhaustive-deps
 *
 *     ⚠️ **빌드는 이 부류를 못 잡는다.** 정의되지 않은 이름은 빌드 오류가 아니라
 *        실행 오류이고, 의존성 누락은 문법이 멀쩡한 채 **틀린 값만 조용히** 낸다.
 *        빌드가 통과했다는 것은 화면이 제대로 돈다는 뜻이 아니다.
 *
 * 무엇을 켜나
 *     지금은 **실제로 물린 두 가지만** 켠다. 큰 코드밑에 규칙을 한꺼번에 켜면
 *     수백 건이 쏟아지고, 그러면 아무도 안 읽고 --max-warnings 를 올려 버린다.
 *     그 순간 검사는 있으나 마나가 된다. 늘리려면 한 번에 하나씩, 그때마다
 *     기존 위반을 먼저 치우고 켤 것.
 */
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  // 빌드가 심는 전역(vite.config.js 의 define). lint 는 빌드를 안 보므로
  // 여기 적어 두지 않으면 no-undef 가 운다.
  //
  // ⚠️ vite.config.js 의 define 을 늘리면 **여기도 함께** 늘릴 것. 안 그러면
  //    쓰는 순간 CI 가 막힌다.
  globals: { __APP_VERSION__: 'readonly' },
  settings: { react: { version: 'detect' } },
  plugins: ['react-hooks'],
  // 손으로 남긴 사본들. 열어 보면 파싱부터 안 되는 것도 있어(파일 첫 줄이 깨졌다)
  // 검사 대상이 아니다. 살아 있는 코드가 아니므로 고칠 이유도 없다.
  ignorePatterns: [
    'dist',
    'node_modules',
    '**/*.backup*.jsx',
    '**/*_backup/**',
    '**/*_old/**',
  ],
  rules: {
    // 있지도 않은 이름을 부르는 것. 화면이 열리자마자 죽는다.
    'no-undef': 'error',

    'react-hooks/rules-of-hooks': 'error',

    // 의존성 누락. **경고로 둔다** — 아래 CI 설명 참고.
    'react-hooks/exhaustive-deps': 'warn',
  },
};
