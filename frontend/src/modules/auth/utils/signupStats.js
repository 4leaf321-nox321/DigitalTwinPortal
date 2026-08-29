// 가입자 현황의 셈 — 사용자 목록의 `created_at` 하나를 주·월·연으로 묶는다(2026-08-30).
//
// 화면(SignupTrend)에서 떼어 둔다 — 눈금의 규칙(주는 월요일 시작·빈 칸은 0·오늘까지 잇기)은
// 그림이 아니라 셈이라, 여기 두어야 `npm test` 가 그대로 읽는다.

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

/** 사용자 목록 → [{ bucket, 신규, 누계 }] — 빈 칸을 채우고 뒤에서 keep 개만 남긴다. */
export const signupSeries = (users = [], unit = 'month', keep = 24, now = new Date()) => {
  const counts = new Map();
  let unknown = 0;
  users.forEach(u => {
    const b = u?.created_at ? bucketOf(u.created_at, unit) : null;
    if (!b) { unknown += 1; return; }
    counts.set(b, (counts.get(b) || 0) + 1);
  });
  if (counts.size === 0) return { rows: [], unknown, total: users.length };
  const keys = [...counts.keys()].sort();
  const last = bucketOf(now.toISOString(), unit);
  const rows = [];
  let cur = keys[0];
  let sum = 0;
  // 첫 가입부터 오늘이 속한 칸까지 이어 그린다 — 가운데가 비어도 줄이 끊기지 않는다.
  for (let guard = 0; guard < 2000; guard += 1) {
    const n = counts.get(cur) || 0;
    sum += n;
    rows.push({ bucket: cur, 신규: n, 누계: sum });
    if (cur >= last) break;
    cur = nextBucket(cur, unit);
  }
  return { rows: rows.slice(-keep), unknown, total: users.length };
};

