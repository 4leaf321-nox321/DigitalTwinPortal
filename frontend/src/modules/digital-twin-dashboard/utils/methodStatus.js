// KPI 연계 현황의 셈 — 조직마다 (과제 → 연계 → 기여방법). (2026-08-30)
//
// 화면(KpiMatrixView)에서 떼어 둔다 — 무엇을 세고 무엇을 빼는가는 그림이 아니라
// 셈이라, 여기 두어야 `npm test` 가 그대로 읽는다.
//
// 두 단을 나눠 센다. **자릿수가 아니라 단위가 다르다.**
//     과제 → 연계   단위는 **과제**. 한 과제가 KPI 셋에 걸려도 「연계된 과제 1건」이다.
//     연계 → 기여방법  단위는 **연결**. 같은 과제라도 KPI 마다 따로 적어야 한다.
//   한 표에 섞어 놓고 하나로 세면 「과제 4건인데 연결 7건」이 모순처럼 보인다.
//
// ⚠️ 줄의 기준은 **과제의 소속 조직**이다(대상 사업부가 아니다).
//    · 그래야 GTR·CS 같은 기능조직도 줄이 선다 — 대상 기준이면 이들은 표에서 아예 빠진다.
//    · 그래야 과제·연결이 표 전체에서 **정확히 한 번씩** 세어진다. 대상 기준이면
//      기능조직 과제가 지원하는 사업부마다 겹쳐 세어져 합계가 부풀었다.
//    합계(연결 수·미입력 수)는 어느 기준이든 같다 — 연결 하나에 소속도 대상도 하나씩이다.
//
// ⚠️ 「KPI 선택」에서 감춘 지표도 **센다.** 이 표는 「지금 표에 뭐가 보이나」가 아니라
//    「무엇을 채워야 하나」다. 보기 설정으로 할 일이 줄어들면 안 된다.

/** 비율(%). 분모가 0 이면 **null** — 0% 로 칠하면 「안 했다」로 읽혀 없는 안건을 만든다. */
export const rateOf = (part, whole) => (whole ? Math.round((part / whole) * 100) : null);

/**
 * @param {object} src
 * @param {{name:string}[]} src.owners        KPI 를 가진 사업부
 * @param {{name:string}[]} src.funcs         기능조직 (GTR·CS…)
 * @param {{uuid:string, division:string}[]} src.projects  취소를 뺀 과제
 * @param {Array} src.links                   [과제uuid, kpiId, 대상, 기여방법(note), 등급]
 * @param {Map} src.projById                  uuid → 과제 (여기 없으면 취소·삭제된 것)
 * @param {Set} src.taggedProjects            어느 KPI든 한 번이라도 걸린 과제
 */
export const orgStatusOf = ({
  owners = [], funcs = [], projects = [], links = [], projById = new Map(),
  taggedProjects = new Set(),
} = {}) => {
  // 조직 → 연결 셈. 링크를 한 번만 훑는다(조직마다 다시 훑으면 조직 수만큼 는다).
  const byOrg = new Map();
  const bump = (name, filled) => {
    if (!byOrg.has(name)) byOrg.set(name, { links: 0, filled: 0 });
    const x = byOrg.get(name);
    x.links += 1;
    if (filled) x.filled += 1;
  };
  links.forEach(([puid, , target, note]) => {
    const p = projById.get(puid);
    // 과제가 없으면(취소·삭제) 셈에서 뺀다. 대상이 없는 줄은 연결이 아니다.
    if (!p || !target) return;
    bump(p.division, String(note || '').trim().length > 0);
  });

  const row = (d, isOwner) => {
    const mine = projects.filter((p) => p.division === d.name);
    const linked = mine.filter((p) => taggedProjects.has(p.uuid)).length;
    const { links: n = 0, filled = 0 } = byOrg.get(d.name) || {};
    return {
      division: d.name,
      isOwner,
      projects: mine.length,
      linked,
      unlinked: mine.length - linked,
      linkRate: rateOf(linked, mine.length),
      links: n,
      filled,
      missing: n - filled,
      fillRate: rateOf(filled, n),
    };
  };

  const rows = [...owners.map((d) => row(d, true)), ...funcs.map((d) => row(d, false))];
  const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
  const totals = {
    projects: sum('projects'),
    linked: sum('linked'),
    unlinked: sum('unlinked'),
    linkRate: rateOf(sum('linked'), sum('projects')),
    links: sum('links'),
    filled: sum('filled'),
    missing: sum('missing'),
    fillRate: rateOf(sum('filled'), sum('links')),
  };
  return { rows, totals };
};

// ── 엑셀로 뽑을 판 ──────────────────────────────────────────────────────────
//
// 판을 짜는 셈은 여기 둔다(시험이 본다). 그리기·저장은 services/exportKpiStatus 다.
// 비율은 **숫자**로 담는다 — 「33%」 라고 글자로 넣으면 엑셀에서 정렬도 합계도 안 된다.

const BAND = (isOwner) => (isOwner ? '사업부' : '기능조직');

/** 현황 판 — 모달의 표 그대로. */
export const statusSheet = ({ rows = [], totals = {} } = {}) => [
  ['구분', '조직', '과제', 'KPI 연계', '미연계', '연계율(%)',
    '연결', '기여방법 정의됨', '미입력', '채움률(%)'],
  ...rows.map((r) => [
    BAND(r.isOwner), r.division,
    r.projects, r.linked, r.unlinked, r.linkRate ?? '',
    r.links, r.filled, r.missing, r.fillRate ?? '',
  ]),
  ['합계', '',
    totals.projects ?? 0, totals.linked ?? 0, totals.unlinked ?? 0, totals.linkRate ?? '',
    totals.links ?? 0, totals.filled ?? 0, totals.missing ?? 0, totals.fillRate ?? ''],
];

/**
 * 아직 할 일 둘 — 엑셀에서 이걸 보고 채우러 간다.
 * 숫자만 있는 판은 「몇 건 남았다」까지만 말한다. **무엇이** 남았는지가 있어야 일이 된다.
 */
export const todoSheets = ({
  owners = [], funcs = [], projects = [], links = [], projById = new Map(),
  taggedProjects = new Set(), kpis = [],
} = {}) => {
  const order = new Map([...owners, ...funcs].map((d, i) => [d.name, i]));
  const rank = (name) => (order.has(name) ? order.get(name) : 999);
  const kpiOf = new Map(kpis.map((k) => [k.kpiDefinitionId, k]));

  const unlinked = projects
    .filter((p) => !taggedProjects.has(p.uuid))
    .sort((a, b) => rank(a.division) - rank(b.division)
      || String(a.title || '').localeCompare(String(b.title || '')))
    .map((p) => [p.division || '', p.code || '', p.title || '', p.status || '', p.progress ?? '']);

  const noMethod = links
    .filter(([puid, , target, note]) => projById.get(puid) && target && !String(note || '').trim())
    .map(([puid, kid, target]) => {
      const p = projById.get(puid);
      const k = kpiOf.get(kid);
      return [p.division || '', p.code || '', p.title || '',
        k?.category || '', k?.label || String(kid), target, p.status || ''];
    })
    .sort((a, b) => rank(a[0]) - rank(b[0]) || String(a[2]).localeCompare(String(b[2])));

  return {
    unlinked: [['조직', '과제코드', '과제명', '상태', '진행률(%)'], ...unlinked],
    noMethod: [['조직', '과제코드', '과제명', 'KPI 분류', 'KPI', '대상 사업부', '상태'], ...noMethod],
  };
};

/** 기여 등급 — 서버 KPI_RELATION_TYPES 와 같은 값. 엑셀에는 문구로 적는다. */
const REL_LABEL = { primary: '주기여', support: '보조기여', indirect: '간접기여' };
/** 기여 방법 — note 한 칸에 줄바꿈으로 여럿(KpiLinkSection 의 NOTE_SEP 과 같다). */
export const methodsOf = (note) =>
  String(note || '').split('\n').map((x) => x.trim()).filter(Boolean);

/**
 * 과제-기여방법-KPI 연결 한 판 — **전 사업부**, 연결 한 줄에 한 행(2026-09-02 요청).
 *
 * ⚠️ 미연계 과제도 넣는다(KPI 칸 비움, 「미연계」). 빼면 「연결된 것만 있는 목록」이 되어
 *    빠진 과제가 있는지 엑셀에서 알 길이 없다. 기여방법이 빈 연결은 「미입력」으로 적어
 *    필터 한 번으로 남은 일이 걸러지게 한다.
 * ⚠️ 기여 방법은 셀 안 줄바꿈(엑셀에서 Alt+Enter 와 같다)으로 여럿을 담고, 개수 열을 따로
 *    둔다 — 「몇 개 적었나」는 세로로 세지 않아도 보여야 한다.
 */
export const linkSheet = ({
  owners = [], funcs = [], projects = [], links = [], projById = new Map(),
  taggedProjects = new Set(), kpis = [],
} = {}) => {
  const order = new Map([...owners, ...funcs].map((d, i) => [d.name, i]));
  const rank = (name) => (order.has(name) ? order.get(name) : 999);
  const kpiOf = new Map(kpis.map((k) => [k.kpiDefinitionId, k]));
  const rows = [];
  links.forEach(([puid, kid, target, note, rel]) => {
    const p = projById.get(puid);
    if (!p || !target) return;
    const k = kpiOf.get(kid);
    const ms = methodsOf(note);
    rows.push([p.division || '', p.code || '', p.title || '', p.status || '',
      target, k?.category || '', k?.label || String(kid),
      REL_LABEL[rel] || (rel ? String(rel) : '미지정'),
      ms.length, ms.length ? ms.join('\n') : '미입력']);
  });
  projects.filter((p) => !taggedProjects.has(p.uuid)).forEach((p) => {
    rows.push([p.division || '', p.code || '', p.title || '', p.status || '',
      '', '', '미연계', '', 0, '']);
  });
  rows.sort((a, b) => rank(a[0]) - rank(b[0])
    || String(a[2]).localeCompare(String(b[2])) || String(a[6]).localeCompare(String(b[6])));
  return [['조직', '과제코드', '과제명', '상태', '대상 사업부', 'KPI 분류', 'KPI',
    '기여 등급', '기여 방법 수', '기여 방법'], ...rows];
};

export const linkFileName = (year, now = new Date()) => {
  const p = (n) => String(n).padStart(2, '0');
  return `과제-기여방법-KPI연결_${year}_${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}.xlsx`;
};

/** 파일 이름 — 무엇을·언제 뽑았는지가 이름에 있어야 폴더에서 찾는다. */
export const statusFileName = (year, now = new Date()) => {
  const p = (n) => String(n).padStart(2, '0');
  return `KPI연계현황_${year}_${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}.xlsx`;
};
