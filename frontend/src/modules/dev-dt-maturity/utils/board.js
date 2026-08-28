// 사업부 판의 셈 — 화면이 아니라 여기서. 화면은 그리기만 한다.
//
// ⚠️ 축은 순서형이다. 평균을 내지 않는다 — 분포와 최고 칸만 센다(PLAN 7-4).

/** 칸 색. 서열(index)이 높을수록 진하다. 미평가는 회색, 낡음은 테두리로 따로. */
/** 켤 수 있는 항목의 정의 — 묶음 축은 첫 칸을 뺀 칸들, 표(matrix) 축은 바탕. */
export const flagDefs = (axis) => (axis.kind === 'matrix' ? (axis.base || []) : axis.rungs.slice(1));

/** 표 축을 판의 서열 하나로 — 서버 matrix_level 과 같은 셈(편집 중 미리보기용). */
export const matrixLevel = (axis, flags, defects, names) => {
  let level = 0;
  if ((flags || []).includes('geometry')) level = 1;
  if ((flags || []).includes('performance')) level = 2;
  const list = names || [];
  const d = defects || {};
  const test = list.filter(n => d[n]?.test).length;
  const market = list.filter(n => d[n]?.market).length;
  if (test > 0) level = Math.max(level, 3);
  if (list.length && test === list.length) level = Math.max(level, 4);
  if (market > 0) level = Math.max(level, 5);
  return { level, test, market, total: list.length };
};

export const RUNG_COLORS = ['#dbeafe', '#93c5fd', '#3b82f6', '#1d4ed8', '#1e3a8a'];

export const colorFor = (rungIndex, rungCount) => {
  if (rungIndex == null) return '#e2e8f0';
  const steps = Math.max(1, rungCount - 1);
  const slot = Math.round((rungIndex / steps) * (RUNG_COLORS.length - 1));
  return RUNG_COLORS[Math.min(RUNG_COLORS.length - 1, Math.max(0, slot))];
};

/** 축마다 칸 분포. {axis: [n0, n1, …, unassessed]} — 막대 그래프의 재료. */
export const distribution = (subjects, axes) => {
  const out = {};
  axes.forEach(axis => {
    const counts = new Array(axis.rungs.length).fill(0);
    let unassessed = 0;
    subjects.forEach(s => (s.pairs || []).forEach(p => {
      const a = p.assessments?.[axis.key];
      if (!a || a.rung_index == null) unassessed += 1;
      else counts[a.rung_index] += 1;
    }));
    out[axis.key] = { counts, unassessed };
  });
  return out;
};

/**
 * 필터. 전부 「좁히기」다 — 이 화면에서 사람이 하는 일은 전부 보기가 아니라
 * 채울 것 찾기와 자랑할 것 찾기라서, 필터가 스크롤보다 먼저 온다.
 *   unassessedOnly  미평가 축이 하나라도 있는 쌍
 *   staleOnly       낡은 평가가 하나라도 있는 쌍
 *   family          적용 제품군에 이 값이 든 시험
 *   modelKind       수단의 모델 종류
 *   axis + minRung  그 축이 이 칸 이상인 쌍
 * 쌍 조건(미평가·낡음·모델 종류·축)이 하나라도 켜져 있을 때만, 쌍이 안 남는 시험을 뺀다 —
 * 시험만 남기면 「왜 비었지」가 된다. 조건이 없으면 **쌍 없는 시험도 보인다**(2026-08-28):
 * 아직 시뮬레이션을 안 이은 시험이 판에서 사라지면 잇는 것을 잊는다.
 */
export const applyFilters = (subjects, f = {}) => {
  const pairFilter = !!(f.unassessedOnly || f.staleOnly || f.modelKind || (f.axis && f.minRung != null));
  return subjects.map(s => {
    if (f.family && !(s.product_families || []).includes(f.family)) return null;
    const pairs = (s.pairs || []).filter(p => {
      if (f.unassessedOnly && !(p.unassessed || []).length) return false;
      if (f.staleOnly && !Object.values(p.assessments || {}).some(a => a && a.stale)) return false;
      if (f.modelKind && p.agent?.model_kind !== f.modelKind) return false;
      if (f.axis && f.minRung != null) {
        const a = p.assessments?.[f.axis];
        if (!a || a.rung_index == null || a.rung_index < f.minRung) return false;
      }
      return true;
    });
    if (!pairs.length && pairFilter) return null;
    return { ...s, pairs };
  }).filter(Boolean);
};

/** 필터 상태 ↔ URL. 공유되게. */
export const filtersToParams = (f) => {
  const p = {};
  if (f.unassessedOnly) p.unassessed = '1';
  if (f.staleOnly) p.stale = '1';
  if (f.family) p.family = f.family;
  if (f.modelKind) p.model = f.modelKind;
  if (f.axis && f.minRung != null) { p.axis = f.axis; p.min = String(f.minRung); }
  return p;
};

export const filtersFromParams = (get) => {
  const axis = get('axis') || '';
  const min = get('min');
  return {
    unassessedOnly: get('unassessed') === '1',
    staleOnly: get('stale') === '1',
    family: get('family') || '',
    modelKind: get('model') || '',
    axis,
    minRung: axis && min !== null && min !== '' && !Number.isNaN(Number(min)) ? Number(min) : null,
  };
};

/** 항목 정확도 한 줄 — 값 · 몇 개 중 몇 개. 값 없으면 「—」. */
export const accuracyLabel = (summary) => {
  if (!summary) return '—';
  if (summary.accuracy == null) {
    return summary.accuracy_total ? `미입력 ${summary.accuracy_total - summary.accuracy_filled}/${summary.accuracy_total}` : '—';
  }
  const partial = summary.accuracy_filled < summary.accuracy_total
    ? ` (${summary.accuracy_filled}/${summary.accuracy_total})` : '';
  return `${summary.accuracy}%${partial}`;
};

/** 타임라인 재료 — 이력을 달로 묶는다. {pairId: {month: [change…]}} */
export const changesByMonth = (changes) => {
  const out = {};
  (changes || []).forEach(c => {
    const month = (c.created_at || '').slice(0, 7);
    if (!month) return;
    out[c.pair_id] = out[c.pair_id] || {};
    (out[c.pair_id][month] = out[c.pair_id][month] || []).push(c);
  });
  return out;
};

export const REACHED_NOTE = '시점 적기';   // 서버가 칸의 시점만 적은 이력 — 다른 칸을 내린 것으로 읽지 않는다

/** 이력에서 「이 칸에 언제 올라왔나」 — **지금 이어지고 있는 도달의 시작**.
 *  켰다 끈 항목·내려온 칸은 시점이 없고, 다시 올라오면 그 날부터다(2026-08-28). 이력을 시간순으로
 *  훑으며, 그 칸을 잃은 이력이 나오면 지운다. 묶음(set) 축은 after 가 'pre,run' 꼴. */
export const reachedDates = (changes, axis) => {
  const out = {};
  const rows = (changes || []).filter(c => c.axis === axis.key)
    .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id - b.id));
  const order = axis.rungs.map(r => r.key);
  const flagKeys = flagDefs(axis).map(r => r.key);
  rows.forEach(c => {
    const marker = c.before == null && c.note === REACHED_NOTE;
    if (axis.kind === 'set' || axis.kind === 'matrix') {
      const on = String(c.after || '').split('|')[0].split(',').filter(k => k && k !== order[0]);
      if (marker) { on.forEach(k => { out[k] = c.created_at; }); return; }
      flagKeys.forEach(k => {
        if (on.includes(k)) { if (!out[k]) out[k] = c.created_at; } else delete out[k];
      });
      return;
    }
    const idx = order.indexOf(c.after);
    if (idx < 0) return;
    if (marker) { out[c.after] = c.created_at; return; }
    order.forEach((k, i) => {
      if (i <= idx) { if (!out[k]) out[k] = c.created_at; } else delete out[k];
    });
  });
  return out;
};
