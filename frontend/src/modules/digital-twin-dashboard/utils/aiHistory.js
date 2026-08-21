/**
 * 액션아이템 진척률의 **과거 값**을 어디서 가져올지 정하는 곳.
 *
 * 왜 있나
 *     과거 값을 오늘 데이터로 되짚으면 틀린다. 되짚기는 **오늘 남아 있는 항목만**
 *     볼 수 있어서, 그동안 지워진 항목은 분모에도 분자에도 안 들어간다. 완료
 *     체크를 되돌렸거나 완료일을 고친 것도 과거를 흔든다. 곧 되짚은 값은
 *     「지금 기준으로 본 과거」이지 「그때의 값」이 아니다.
 *
 *     서버가 그 시점의 분자ㆍ분모를 그대로 갖고 있다(dt2_project_history).
 *     그것을 쓰고, 없는 과제만 예전 방식으로 떨어뜨린다.
 *
 * ⚠️ 이력이 없는 과제를 **조용히 빼면 안 된다.** 그러면 그 과제가 기준일 집합에서
 *    통째로 사라져, 기준일 값이 「그 과제를 뺀 나머지」가 된다. 낙차가 얼마나
 *    커질지는 그 과제가 평균보다 위냐 아래냐에 달렸고, 한계가 없다. 지금 고치려는
 *    바로 그 병이라 폴백을 반드시 둔다.
 */

/** DateTime → KST 'YYYY-MM-DD'. 서버가 보내는 날짜도 KST 기준이라 그대로 견줄 수 있다. */
export const ymdOf = (date) => {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const EMPTY = { has: () => false, at: () => null, projectCount: 0, missingCount: 0 };

/**
 * 서버 응답을 조회용으로 바꾼다.
 *
 *     has(uuid)        이 과제에 쓸 이력이 있나
 *     at(uuid, ymd)    그 날짜 **이전 마지막** 기록. 없으면 null
 *
 * ⚠️ `at` 이 null 을 내는 경우가 둘이다 — 이력이 아예 없거나, 있어도 **첫 기록보다
 *    앞선 날짜**를 물었거나. 둘 다 「그때 값을 모른다」이지 「0 이었다」가 아니다.
 *    0 으로 채우면 이력이 늦게 시작한 과제가 과거에 진척 0 으로 그려진다.
 */
export const buildAiHistoryIndex = (payload) => {
  const series = payload?.series;
  if (!Array.isArray(series) || series.length === 0) return EMPTY;

  const byUuid = new Map();
  series.forEach(s => {
    if (!s?.uuid || !Array.isArray(s.rows) || s.rows.length === 0) return;
    // 서버가 날짜순으로 보내지만 믿고 쓰지 않는다 — 어긋나면 이분 탐색이 조용히 틀린다.
    const rows = [...s.rows]
      .filter(r => r && typeof r.date === 'string')
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    if (rows.length) byUuid.set(s.uuid, rows);
  });

  return {
    projectCount: byUuid.size,
    missingCount: Array.isArray(payload?.missing) ? payload.missing.length : 0,
    has: (uuid) => byUuid.has(uuid),
    at: (uuid, ymd) => {
      const rows = byUuid.get(uuid);
      if (!rows || !ymd) return null;
      // 그 날짜 이전 마지막 것. 값이 안 바뀌면 기록도 안 남으므로 **앞의 값을 끌고 온다**.
      let lo = 0, hi = rows.length - 1, found = null;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (rows[mid].date <= ymd) { found = rows[mid]; lo = mid + 1; }
        else hi = mid - 1;
      }
      if (!found) return null;                 // 첫 기록보다 앞선 날 — 모른다
      return { total: Number(found.total) || 0, done: Number(found.done) || 0 };
    },
  };
};

/** 이력이 하나도 없을 때 쓰는 빈 조회기. 화면은 늘 예전 방식으로 떨어진다. */
export const emptyAiHistoryIndex = () => EMPTY;
