// 사업부 판의 셈 — 화면이 아니라 여기서. 화면은 그리기만 한다.
//
// ⚠️ 축은 순서형이다. 평균을 내지 않는다 — 분포와 최고 칸만 센다(PLAN 7-4).

/** 칸 색. 서열(index)이 높을수록 진하다. 미평가는 회색, 재평가 필요은 테두리로 따로. */
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
 *   unassessedOnly  미평가 축이 하나라도 있는 연계
 *   staleOnly       재평가 필요가 하나라도 있는 연계
 *   family          적용 제품군에 이 값이 든 시험
 *   modelKind       수단의 모델 종류
 *   axis + minRung  그 축이 이 칸 이상인 연계
 * 연계 조건(미평가·재평가 필요·모델 종류·축)이 하나라도 켜져 있을 때만, 연계이 안 남는 시험을 뺀다 —
 * 시험만 남기면 「왜 비었지」가 된다. 조건이 없으면 **연계 없는 시험도 보인다**(2026-08-28):
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
 *  선택했다 해제한 항목·내려온 칸은 시점이 없고, 다시 올라오면 그 날부터다(2026-08-28). 이력을 시간순으로
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

/**
 * 사업부 판 하나를 축별 대표 수치로 접는다 — 전체 「요약」 표의 재료(2026-08-28).
 * 축이 다 순서형이 아니라 종류마다 다르게 센다:
 *   value  { mean, filled, total, unassessed, counts[칸] }              평균 %(값 있는 연계) · 세 영역 분포
 *   rung   { counts[칸], assessed, unassessed, total, atLeast[i]=% }     i번째 칸 이상인 연계의 %
 *   set    { flags, adoption{key:%}, adoptionCount{key:n}, avg, assessed, unassessed, total }   항목별 채택률 · 적용 단계 수 (평균)
 *   matrix { adoption{base:%}, testRate, marketRate, defectTotal, assessed, unassessed, total } 바탕 채택률 · 시험/시장 재현률(유형 칸 기준)
 */
export const divisionSummary = (board, axes) => {
  const pairs = (board?.subjects || []).flatMap(s => s.pairs || []);
  const out = { pairs: pairs.length, unassessed: 0, stale: 0, axes: {} };
  pairs.forEach(p => {
    out.unassessed += (p.unassessed || []).length;
    out.stale += Object.values(p.assessments || {}).filter(a => a && a.stale).length;
  });
  axes.forEach(axis => {
    const rows = pairs.map(p => p.assessments?.[axis.key] || null);
    const got = rows.filter(a => a && a.rung_index != null);
    const total = rows.length, unassessed = total - got.length;
    if (axis.kind === 'value') {
      const vals = got.map(a => Number(a.value)).filter(v => !Number.isNaN(v));
      const counts = axis.rungs.map((_, i) => got.filter(a => a.rung_index === i).length);
      out.axes[axis.key] = { total, unassessed, filled: vals.length, counts,
        mean: vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null };
    } else if (axis.kind === 'rung') {
      const counts = axis.rungs.map((_, i) => got.filter(a => a.rung_index === i).length);
      const atLeast = axis.rungs.map((_, i) => (got.length ? Math.round((got.filter(a => a.rung_index >= i).length * 100) / got.length) : null));
      out.axes[axis.key] = { total, unassessed, assessed: got.length, counts, atLeast };
    } else if (axis.kind === 'set') {
      const flags = flagDefs(axis);
      const adoptionCount = {}, adoption = {};
      flags.forEach(f => {
        adoptionCount[f.key] = got.filter(a => (a.flags || []).includes(f.key)).length;
        adoption[f.key] = got.length ? Math.round((adoptionCount[f.key] * 100) / got.length) : null;
      });
      const avg = got.length ? Math.round((got.reduce((n, a) => n + (a.flags || []).length, 0) / got.length) * 10) / 10 : null;
      out.axes[axis.key] = { total, unassessed, assessed: got.length, flags, adoption, adoptionCount, avg };
    } else if (axis.kind === 'matrix') {
      const adoption = {};
      (axis.base || []).forEach(b => { adoption[b.key] = got.length ? Math.round((got.filter(a => (a.flags || []).includes(b.key)).length * 100) / got.length) : null; });
      let cells = 0, test = 0, market = 0;
      pairs.forEach((p, i) => {
        const names = p.agent?.defect_types || [];
        const a = rows[i];
        cells += names.length;
        if (a?.summary) { test += a.summary.test || 0; market += a.summary.market || 0; }
      });
      out.axes[axis.key] = { total, unassessed, assessed: got.length, adoption, defectTotal: cells,
        testRate: cells ? Math.round((test * 100) / cells) : null, marketRate: cells ? Math.round((market * 100) / cells) : null };
    }
  });
  return out;
};

// ── 「변화」 그래프 — 이력을 달마다 되감아 그 달 말의 상태를 복원한다(2026-08-28) ──────────

/** 최근 n 달의 'YYYY-MM' 목록(오래된 달부터). now 를 주면 시험에서 고정할 수 있다. */
export const monthKeys = (n = 12, now = new Date()) => {
  const out = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
};

/** 두 연-월 사이(양 끝 포함)의 'YYYY-MM' 목록. 거꾸로면 바로잡고, 60달을 넘으면 뒤에서 60달만. */
export const monthRange = (from, to) => {
  const ok = (v) => /^\d{4}-\d{2}$/.test(v || '');
  if (!ok(from) || !ok(to)) return [];
  let [a, b] = [from, to].sort();
  const out = [];
  let [y, m] = a.split('-').map(Number);
  const [ey, em] = b.split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1; if (m > 12) { m = 1; y += 1; }
  }
  return out.slice(-60);
};

/** 이력 한 줄의 after 를 그 축의 상태로 — value 는 숫자, set/matrix 는 켠 목록(+시험·시장 수), rung 은 칸 index. */
const stateOf = (axis, after) => {
  if (after == null || after === '') return null;
  const str = String(after);
  if (axis.kind === 'value') { const v = Number(str); return Number.isNaN(v) ? null : { value: v }; }
  const [head, tail] = str.split('|');
  const keys = flagDefs(axis).map(r => r.key);
  if (axis.kind === 'set' || axis.kind === 'matrix') {
    const flags = head.split(',').filter(k => keys.includes(k));
    const mm = /t(\d+)\/m(\d+)/.exec(tail || '');
    return { flags, test: mm ? Number(mm[1]) : 0, market: mm ? Number(mm[2]) : 0 };
  }
  const idx = axis.rungs.findIndex(r => r.key === head);
  return idx < 0 ? null : { idx };
};

/**
 * 달마다 축별 대표 수치 — [{month, <axis.key>: {value, changes, n}}, …]. 요약(divisionSummary)과 같은 셈:
 *   value 평균 % · rung 「끝에서 둘째 칸」 이상 % · set 적용 단계 수 평균 · matrix 시험 불량 재현 %(유형 칸 기준)
 * 연계는 그 달까지 이력이 하나라도 있어야 분모에 든다(생기기 전엔 셈에 없다). 「시점 적기」 이력은 뺀다.
 */
export const monthlySeries = (subjects, changes, axes, months) => {
  const pairs = (subjects || []).flatMap(s => s.pairs || []);
  const defectTotal = Object.fromEntries(pairs.map(p => [p.id, (p.agent?.defect_types || []).length]));
  const byPairAxis = {};
  (changes || []).filter(c => !(c.before == null && c.note === REACHED_NOTE)).forEach(c => {
    const k = `${c.pair_id}|${c.axis}`;
    (byPairAxis[k] = byPairAxis[k] || []).push(c);
  });
  Object.values(byPairAxis).forEach(list => list.sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id - b.id)));
  return months.map(month => {
    const end = `${month}-99`;                       // 그 달 말까지(문자열 비교)
    const row = { month };
    axes.forEach(axis => {
      let n = 0, changed = 0;
      const states = [];
      pairs.forEach(p => {
        const list = byPairAxis[`${p.id}|${axis.key}`] || [];
        const upto = list.filter(c => c.created_at.slice(0, 10) <= end);
        changed += upto.filter(c => c.created_at.slice(0, 7) === month).length;
        if (!upto.length) return;
        const st = stateOf(axis, upto[upto.length - 1].after);
        if (st) { states.push({ st, total: defectTotal[p.id] || 0 }); n += 1; }
      });
      let value = null;
      if (n) {
        if (axis.kind === 'value') value = Math.round((states.reduce((a, x) => a + x.st.value, 0) / n) * 10) / 10;
        else if (axis.kind === 'rung') { const k = Math.max(0, axis.rungs.length - 2); value = Math.round((states.filter(x => x.st.idx >= k).length * 100) / n); }
        else if (axis.kind === 'set') value = Math.round((states.reduce((a, x) => a + x.st.flags.length, 0) / n) * 10) / 10;
        else if (axis.kind === 'matrix') { const cells = states.reduce((a, x) => a + x.total, 0); value = cells ? Math.round((states.reduce((a, x) => a + x.st.test, 0) * 100) / cells) : null; }
      }
      row[axis.key] = { value, changes: changed, n };
    });
    return row;
  });
};

/**
 * 한 축을 **연계마다** 되감는다 — [{id, name, points: [값|null …]}]. 값은 그 축의 대표 수치와 같은 자(척도):
 *   value 정확도 % · rung 칸 index · set 켠 수 · matrix 시험 불량 재현 %(그 연계의 유형 칸 기준)
 */
export const pairSeries = (subjects, changes, axis, months) => {
  const kept = (changes || []).filter(c => c.axis === axis.key && !(c.before == null && c.note === REACHED_NOTE));
  const byPair = {};
  kept.forEach(c => { (byPair[c.pair_id] = byPair[c.pair_id] || []).push(c); });
  Object.values(byPair).forEach(l => l.sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id - b.id)));
  const out = [];
  (subjects || []).forEach(sub => (sub.pairs || []).forEach(p => {
    const list = byPair[p.id];
    if (!list) return;
    const total = (p.agent?.defect_types || []).length;
    const points = months.map(month => {
      const upto = list.filter(c => c.created_at.slice(0, 10) <= `${month}-99`);
      if (!upto.length) return null;
      const st = stateOf(axis, upto[upto.length - 1].after);
      if (!st) return null;
      if (axis.kind === 'value') return st.value;
      if (axis.kind === 'rung') return st.idx;
      if (axis.kind === 'set') return st.flags.length;
      return total ? Math.round((st.test * 100) / total) : null;
    });
    out.push({ id: p.id, name: `${sub.name} × ${p.agent?.name || ''}`, points });
  }));
  return out;
};
