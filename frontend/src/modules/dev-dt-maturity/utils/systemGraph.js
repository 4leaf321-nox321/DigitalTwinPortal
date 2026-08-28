// 시스템 연결도의 **데이터 판단** — 무엇이 노드가 되고 무엇이 이어지는지(2026-08-29).
//
// 그리기(ThreadGraphCanvas)와 나눠 둔다. 여기는 화면이 없어서 `npm test` 로 곧바로 시험한다.
//
// 노드 = 시스템, 간선 = 구간. 한 구간은 출발 → 매개 → 도착으로 최대 두 간선이 된다.
// 간선 색 = 스레드, 선 모양 = 연결 방식(자동 전달 이상 실선 · 그 아래·미평가 점선).
// 같은 두 시스템 사이를 여러 스레드가 지나면 휘는 정도를 갈라 나란히 그린다.

export const THREAD_COLORS = ['#2563eb', '#dc2626', '#059669', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d'];
export const NO_THREAD_COLOR = '#94a3b8';

// 시스템 종류 색 — 사업부 요약의 시스템 지도와 같은 어휘를 쓴다.
export const KIND_COLORS = {
  plm: '#1d4ed8', cad: '#2563eb', cae: '#0891b2', spdm: '#0e7490', requirements: '#7c3aed',
  erp: '#059669', mes: '#16a34a', qms: '#d97706', cost: '#b45309', purchase: '#65a30d',
  cs: '#dc2626', test: '#ca8a04', hub: '#475569', informal: '#9ca3af', other: '#6b7280',
};

export const AUTO_IDX = 1;      // 연결 축 — 자동 전달부터 「이어진」 것 (사람이 옮김 = 0)
const CURVE_STEP = 0.22;        // 같은 쌍의 간선을 갈라 놓는 폭

/** 스레드마다 색 하나 — 목록 차례가 곧 색 차례라 화면이 바뀌어도 같은 색이다. */
export const threadColors = (threads = []) => {
  const m = {};
  threads.forEach((t, i) => { m[t.id] = THREAD_COLORS[i % THREAD_COLORS.length]; });
  return (tid) => m[tid] || NO_THREAD_COLOR;
};

/**
 * 구간들을 시스템 그래프로.
 *   nodes: { id, label, kind, count }        count = 지나는 구간 수(노드 크기의 근거)
 *   links: { source, target, thread_id, color, dashed, curvature, width, name, pair_id }
 */
export const buildSystemGraph = (segments = [], systems = [], threads = []) => {
  const sys = Object.fromEntries(systems.map(s => [s.id, s]));
  const colorOf = threadColors(threads);
  const nodes = {};
  const links = [];
  const touch = (id) => {
    if (!sys[id]) return;
    if (!nodes[id]) nodes[id] = { id, label: sys[id].name, kind: sys[id].kind, count: 0 };
    nodes[id].count += 1;
  };
  segments.forEach(seg => {
    const li = seg.pair?.assessments?.link_mode?.rung_index ?? null;
    const chain = [seg.from_system_id, seg.via_system_id, seg.to_system_id].filter(Boolean);
    chain.forEach(touch);
    const uniq = chain.filter((v, i) => chain.indexOf(v) === i && sys[v]);
    for (let i = 0; i + 1 < uniq.length; i += 1) {
      links.push({
        source: uniq[i], target: uniq[i + 1], thread_id: seg.thread_id ?? null,
        color: colorOf(seg.thread_id), dashed: !(li != null && li >= AUTO_IDX),
        width: li == null ? 1.4 : 1.6 + li * 0.7, link: li,
        name: seg.name, thread_name: seg.thread_name || null, pair_id: seg.pair_id ?? null,
      });
    }
  });
  return { nodes: Object.values(nodes), links: splay(links) };
};

/** 같은 두 시스템 사이의 간선들을 부채처럼 갈라 놓는다 — 겹쳐 그리면 한 줄로 보인다. */
export const splay = (links) => {
  const byPair = {};
  links.forEach(l => {
    const key = [l.source, l.target].sort((a, b) => a - b).join('-');
    (byPair[key] = byPair[key] || []).push(l);
  });
  Object.values(byPair).forEach(g => g.forEach((l, i) => {
    l.curvature = g.length === 1 ? 0.1 : (i - (g.length - 1) / 2) * CURVE_STEP;
  }));
  return links;
};

/** 고른 스레드가 지나는 시스템들 — 나머지는 흐리게 그린다. */
export const nodesOfThread = (links, threadId) => {
  const set = new Set();
  links.forEach(l => {
    if (l.thread_id !== threadId) return;
    set.add(typeof l.source === 'object' ? l.source.id : l.source);
    set.add(typeof l.target === 'object' ? l.target.id : l.target);
  });
  return set;
};
