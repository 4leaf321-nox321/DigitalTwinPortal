// 사업부 판의 셈 — 화면이 아니라 여기서. 화면은 그리기만 한다.
//
// ⚠️ 축은 순서형이다. 평균을 내지 않는다 — 분포와 최고 칸만 센다(PLAN 7-4).

/** 칸 색. 서열(index)이 높을수록 진하다. 미평가는 회색, 낡음은 테두리로 따로. */
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
