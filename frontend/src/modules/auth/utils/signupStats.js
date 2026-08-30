// 가입자·조회수 현황의 셈 — 시각을 주·월·연으로 묶는다(2026-08-30).
//
// 화면(SignupTrend·AccessTrend)에서 떼어 둔다 — 눈금의 규칙(주는 월요일 시작·빈 칸은 0·
// 오늘까지 잇기)은 그림이 아니라 셈이라, 여기 두어야 `npm test` 가 그대로 읽는다.
//
// 가입자는 **이미 받아 둔 사용자 목록**에서 세고, 조회수는 **서버가 묶어 준 것**을 받는다.
// 접속 이력은 사람 수가 아니라 클릭 수로 늘어 다 내려받을 수 없기 때문이다. 그래도
// 빈 칸을 채우고 누계를 내는 규칙은 **같은 함수**를 쓴다 — 둘이 어긋나면 안 된다.

export const UNITS = [
  { key: 'week', label: '주별', keep: 26 },
  { key: 'month', label: '월별', keep: 24 },
  { key: 'year', label: '연별', keep: 10 },
];

/** 그 날짜가 속한 칸의 이름. 주는 **월요일 시작**(ISO 와 같은 결). */
export const bucketOf = (iso, unit) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  if (unit === 'year') return String(d.getFullYear());
  if (unit === 'month') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  return `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, '0')}-${String(mon.getDate()).padStart(2, '0')}`;
};

/** 칸 이름을 가로 눈금의 글자로. 두 그림이 같은 글자를 써야 나란히 읽힌다. */
export const bucketLabel = (key, unit) => {
  if (unit === 'year') return `${key}년`;
  if (unit === 'month') return key.slice(2).replace('-', '/');
  return key.slice(5).replace('-', '/');
};

/** 다음 칸 — 가입이 없던 칸도 0 으로 채워야 그래프에 빈 자리가 생기지 않는다. */
const nextBucket = (key, unit) => {
  if (unit === 'year') return String(Number(key) + 1);
  if (unit === 'month') {
    const [y, m] = key.split('-').map(Number);
    return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  }
  const [y, m, d] = key.split('-').map(Number);
  const nx = new Date(y, m - 1, d + 7);
  return `${nx.getFullYear()}-${String(nx.getMonth() + 1).padStart(2, '0')}-${String(nx.getDate()).padStart(2, '0')}`;
};

/** 칸 → 수 → [{ bucket, n, sum }]. 첫 칸부터 오늘 칸까지 잇고 뒤에서 keep 개만 남긴다.
 *
 * ⚠️ 누계는 **자르기 전에** 쌓는다 — 잘라 낸 앞쪽도 누계에는 들어가야 「지금 몇인가」가 맞다. */
export const fillBuckets = (counts, unit = 'month', keep = 24, now = new Date()) => {
  if (!counts.size) return [];
  const keys = [...counts.keys()].sort();
  const last = bucketOf(now.toISOString(), unit);
  const out = [];
  let cur = keys[0];
  let sum = 0;
  // 가운데가 비어도 줄이 끊기지 않게 0 으로 채운다.
  for (let guard = 0; guard < 2000; guard += 1) {
    const n = counts.get(cur) || 0;
    sum += n;
    out.push({ bucket: cur, n, sum });
    if (cur >= last) break;
    cur = nextBucket(cur, unit);
  }
  return out.slice(-keep);
};

/** 사용자 목록 → [{ bucket, 신규, 누계 }]. */
export const signupSeries = (users = [], unit = 'month', keep = 24, now = new Date()) => {
  const counts = new Map();
  let unknown = 0;
  users.forEach(u => {
    const b = u?.created_at ? bucketOf(u.created_at, unit) : null;
    if (!b) { unknown += 1; return; }
    counts.set(b, (counts.get(b) || 0) + 1);
  });
  const rows = fillBuckets(counts, unit, keep, now)
    .map(x => ({ bucket: x.bucket, 신규: x.n, 누계: x.sum }));
  return { rows, unknown, total: users.length };
};

/** 서버가 묶어 준 접속 이력 → [{ bucket, 조회, 누계, 방문자, 로그인 }].
 *
 * 서버는 **자기가 가진 칸만** 준다(빈 달은 아예 없다). 채우는 것은 여기서 한다 —
 * 가입자와 같은 함수를 쓰므로 두 그림의 가로 눈금이 같은 규칙으로 선다. */
export const viewSeries = (raw = [], unit = 'month', keep = 24, now = new Date()) => {
  const by = new Map(raw.map(r => [r.bucket, r]));
  const counts = new Map(raw.map(r => [r.bucket, r.views || 0]));
  const rows = fillBuckets(counts, unit, keep, now).map(x => ({
    bucket: x.bucket,
    조회: x.n,
    누계: x.sum,
    방문자: by.get(x.bucket)?.visitors || 0,
    로그인: by.get(x.bucket)?.logins || 0,
  }));
  return {
    rows,
    total: raw.reduce((n, r) => n + (r.views || 0), 0),
    logins: raw.reduce((n, r) => n + (r.logins || 0), 0),
  };
};

