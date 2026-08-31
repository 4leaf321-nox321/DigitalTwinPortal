// 「완료 현황」의 셈 — 과제 하나가 **몇 월 칸에 서는가**. (2026-08-31)
//
// 화면(AllProjectsView)에서 떼어 둔다 — 어느 칸에 세울지 정하는 규칙은 그림이 아니라
// 셈이라, 여기 두어야 `npm test` 가 그대로 읽는다.
//
// ⚠️ **완료와 미완료는 기준이 다르다.** 그래서 피봇(필드 값 하나로 묶기)으로는
//    표현할 수 없고 이렇게 파생값을 만든다.
//
//      완료   실제로 끝난 달 = 액션아이템 완료일 중 **가장 늦은 것**
//      미완료 끝내기로 한 달 = 종료 월(end_month)
//
// ⚠️ 완료인데 **완료일을 못 구하는 과제가 많다.** 액션아이템을 안 쓰고 상태만 「완료」로
//    바꾼 것들이다(2026-08-31 개발 DB: 완료 22건 중 16건). 그래서 완료일이 없으면
//    종료 월로 떨어뜨리되 `estimated` 로 **표시를 남긴다** — 빼면 완료의 3/4 가 표에서
//    사라지고, 조용히 종료 월로 세면 「실제 완료일 기준」이라는 말이 거짓이 된다.
//    화면은 이 표시를 별표로 드러내고, 그 별표 수가 곧 자료 품질이 된다.

/** 이 표에서 아예 빼는 것 — 취소는 「안 한 일」이지 「못 끝낸 일」이 아니다. */
const DROP = new Set(['취소']);

const monthOfYmd = (ymd) => {
  const m = /^(\d{4})-(\d{2})/.exec(String(ymd || '').trim());
  return m ? { year: Number(m[1]), month: Number(m[2]) } : null;
};

/** 그 과제의 실제 완료일 — 액션아이템(그리고 세부항목) 완료일 중 가장 늦은 것. */
export const lastDoneDate = (project) => {
  let best = null;
  (project?.액션아이템목록 || []).forEach((a) => {
    const pick = (x) => {
      if (!x || !x.완료여부) return;
      const d = String(x.완료일 || '').trim();
      if (d && (best === null || d > best)) best = d;
    };
    pick(a);
    (a.세부항목목록 || []).forEach(pick);
  });
  return best;
};

/**
 * 과제 하나가 설 자리.
 *
 * @returns null            표에 안 서는 것(취소)
 * @returns {kind}          'done' 끝남 · 'pending' 아직 · 'late' 기한이 지났는데 아직
 * @returns {month}         1~12, 「범위 밖」이거나 월을 모르면 null
 * @returns {outOfRange}    완료일이 **그 해 밖**일 때(작년에 끝낸 것이 올해 표에 섞이면 안 된다)
 * @returns {estimated}     완료인데 완료일이 없어 **종료 월로 대신** 셌을 때
 * @returns {doneDate}      실제 완료일(있으면)
 */
export const slotOf = (project, year, now = new Date()) => {
  const status = String(project?.진행상태 || '').trim();
  if (DROP.has(status)) return null;

  const end = Number(project?.종료) || null;

  if (status === '완료') {
    const d = lastDoneDate(project);
    const at = d ? monthOfYmd(d) : null;
    if (at && at.year !== Number(year)) {
      // 그 해 밖 — 12월 칸에 몰아넣으면 거짓말이 된다. 따로 센다.
      return { kind: 'done', month: null, outOfRange: true, estimated: false, doneDate: d };
    }
    if (at) return { kind: 'done', month: at.month, outOfRange: false, estimated: false, doneDate: d };
    // 완료일이 없다 — 종료 월로 대신하되 그렇다고 말한다
    return { kind: 'done', month: end, outOfRange: false, estimated: true, doneDate: null };
  }

  // 아직 안 끝난 것 — 끝내기로 한 달에 선다
  const late = end != null
    && Number(year) < now.getFullYear() + 1
    && (Number(year) < now.getFullYear()
      || (Number(year) === now.getFullYear() && end < now.getMonth() + 1));
  return { kind: late ? 'late' : 'pending', month: end, outOfRange: false, estimated: false, doneDate: null };
};

const emptyCell = () => ({ done: 0, pending: 0, late: 0, estimated: 0, projects: [] });

/**
 * 사업부 × 12개월 표.
 *
 * @param divisions 줄 차례. 안 주면 과제에 나온 순서대로.
 * @returns {{rows, totals, months}} rows = [{division, cells[12], out, total}]
 *          out  = 「범위 밖」 칸(완료일이 그 해 밖) · total = 그 줄의 합
 */
export const completionTable = ({ projects = [], year, divisions = null, now = new Date() } = {}) => {
  const names = divisions
    ? [...divisions]
    : [...new Set(projects.map((p) => p.사업부).filter(Boolean))];

  const blank = () => ({
    cells: Array.from({ length: 12 }, emptyCell),
    out: emptyCell(),      // 완료일이 그 해 밖
    none: emptyCell(),     // 설 달을 모르는 것(종료 월이 비었다)
    total: emptyCell(),
  });
  const by = new Map(names.map((n) => [n, blank()]));

  projects.forEach((p) => {
    const slot = slotOf(p, year, now);
    if (!slot) return;
    const name = p.사업부 || '(사업부 없음)';
    if (!by.has(name)) { by.set(name, blank()); names.push(name); }
    const row = by.get(name);
    const target = slot.outOfRange ? row.out
      : (slot.month >= 1 && slot.month <= 12 ? row.cells[slot.month - 1] : row.none);
    [target, row.total].forEach((c) => {
      c[slot.kind] += 1;
      if (slot.estimated) c.estimated += 1;
      c.projects.push({ ...p, _slot: slot });
    });
  });

  const rows = names.map((n) => ({ division: n, ...by.get(n) }));
  const totals = blank();
  rows.forEach((r) => {
    r.cells.forEach((c, i) => {
      ['done', 'pending', 'late', 'estimated'].forEach((k) => { totals.cells[i][k] += c[k]; });
      totals.cells[i].projects.push(...c.projects);
    });
    ['out', 'none', 'total'].forEach((where) => {
      ['done', 'pending', 'late', 'estimated'].forEach((k) => { totals[where][k] += r[where][k]; });
      totals[where].projects.push(...r[where].projects);
    });
  });
  return { rows, totals, months: Array.from({ length: 12 }, (_, i) => i + 1) };
};

/** 칸에 보일 수 — 고른 갈래만 센다. 「둘 다」면 완료와 아직(지연 포함)을 따로 준다. */
export const cellCounts = (cell, show = 'both') => ({
  done: show === 'pending' ? 0 : cell.done,
  open: show === 'done' ? 0 : cell.pending + cell.late,
  late: show === 'done' ? 0 : cell.late,
  estimated: show === 'pending' ? 0 : cell.estimated,
});

/** 그 칸에서 보여 줄 과제 — 고른 갈래만. */
export const cellProjects = (cell, show = 'both') => (cell.projects || []).filter((p) => {
  if (show === 'done') return p._slot.kind === 'done';
  if (show === 'pending') return p._slot.kind !== 'done';
  return true;
});
