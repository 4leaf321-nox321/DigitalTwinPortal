/**
 * "무엇이 무엇에서 무엇으로 바뀌었나" 를 사람이 읽을 형태로 만든다.
 *
 * 왜 공용인가
 *     두 화면이 같은 것을 그린다 — 활동로그 모달(`dashboard_activity_logs.changes`)과
 *     과제 편집창의 변경 이력 탭(`dt2_project_changes`). 데이터 출처는 다르지만
 *     **값을 읽기 좋게 만드는 규칙은 같아야 한다.** 복제하면 한쪽만 고쳐져서 갈린다.
 *
 * 이 규칙들은 **개발 DB 실데이터 3000건으로 검증했다**(2026-07-31). 가정으로 짜면 틀린다:
 *     · `changes` 모양이 네 가지였다 — 필드별 diff · 그냥 값 · **한 객체에 둘이 섞임** · null
 *     · 값 타입이 int·list·str·None·bool·dict 전부 나왔다 (안 다루면 `[object Object]`)
 *     · 배열이 바뀐 로그 중 **길이가 그대로인 것이 161건**, 길이가 달라진 건 39건뿐이었다
 *       → 건수만 보이면 "3건 → 3건" 이 되어 아무 정보가 없다. 그래서 원소 단위로 본다.
 */

// 값이 길면 줄인다. 원문은 title 로 붙여 마우스를 올리면 보이게 한다.
export const VALUE_MAX = 80;
export const TITLE_MAX = 500;

/*
  ── 화면에서 감추는 필드 ───────────────────────────────────────────────
  **서버가 만드는 사본**이다. 사람이 고치는 값이 아니라, 저장할 때 원본에서
  다시 만들어진다(`routes_v2._derive_columns`).

      담당자        owners_json    ← 과제참여인력목록의 **이름만** 사본. 권한 판정용
      과제참여인력  member_names   ← 같은 목록을 쉼표로 이은 문자열 (레거시)
      담당부서      dept_name      ← 담당부서목록을 이은 문자열
      관리자        manager_name   ← 과제PL 사본

  왜 감추나
      **넷 다 화면에 그리는 곳이 없다.** 그런데 변경 이력에는 원본과 나란히 남아서,
      참여인력을 한 번 고치면 같은 말이 세 줄로 나온다:
          과제참여인력목록  2건 추가   ← 사람이 한 일
          담당자            2건 추가   ← 같은 말
          과제참여인력      김A → 김A, 이B
      화면 어디에도 없는 이름의 칸이 바뀌었다고 하니 읽는 사람이 헷갈린다.
      (개발 DB 실측 — 사본만 혼자 남은 저장이 11개 있었다. 사람이 한 일이 아니라
       원본은 그대로인데 사본만 어긋나 있다가 저장할 때 맞춰진 것이다.)

  ⚠️ **화면에서만 뺀다.** `dt2_project_changes` 는 감사 추적이라 그대로 쌓인다 —
     사고를 되짚을 때 파생이 언제 어긋났는지가 단서가 된다.
  ⚠️ 컬럼명과 한글 이름을 **둘 다** 넣는다. 변경 이력은 컬럼명(`owners_json`)으로,
     활동로그는 한글 키(`담당자`)로 오기 때문이다.
  ⚠️ `과제참여인력`(사본)과 `과제참여인력목록`(원본)은 **다른 것이다.** 앞부분이
     겹치므로 반드시 **정확히 일치**할 때만 감춘다.
*/
const HIDDEN_FIELDS = new Set([
  'owners_json', '담당자',
  'member_names', '과제참여인력',
  'dept_name', '담당부서',
  'manager_name', '관리자',
]);

/** 이 칸을 화면에서 감출 것인가. 컬럼명·한글 이름 중 하나라도 걸리면 감춘다. */
export const isHiddenField = (...names) =>
  names.some(n => typeof n === 'string' && HIDDEN_FIELDS.has(n.trim()));

/*
  배열 안에서 같은 원소를 찾아 짝짓는 키. 앞에 있는 것부터 쓴다.

  🐞 `id` 가 맨 앞이었다. 그런데 액션아이템의 `id` 는 `action_MX-26-001_1` 처럼
     **자리 번호**라서 하나를 지우면 뒤엣것이 그 번호를 물려받는다. 그래서 실제로는
     "가 삭제" 인 저장이 "가→나, 나→다 로 제목 수정" 두 건으로 보였다.
     **uuid 를 먼저 본다** — 그건 원소를 따라다닌다.

  연결 필드(성과·KPI·선행과제)에는 `id` 자체가 없어 예전에는 순번으로 짝지어졌고,
  가운데에 하나를 끼우면 그 뒤가 전부 바뀐 것으로 보였다. 그래서 함께 넣는다.
*/
const ELEMENT_ID_KEYS = ['uuid', '성과항목UUID', 'performanceUuid', 'dependsOnUuid',
  'knoxId', 'id', 'kpiDefinitionId', 'imageId'];
// 원소를 사람에게 가리킬 이름표. (`내용` 은 액션아이템의 세부항목, `fileName` 은 이미지)
const ELEMENT_LABEL_KEYS = ['제목', '성과항목', '이름', '부서', '내용',
  'title', 'label', 'code', 'fileName'];
// 사람이 볼 값이 아닌 살림용 속성. 이것만 달라진 원소는 '수정' 으로 세지 않는다.
// (순서 값인 `position`·`순번` 은 뺀다 — 차례가 바뀐 건 사람이 한 일이다.)
const NOISE_PROPS = new Set(['id', 'uuid', 'createdAt', 'updatedAt']);
// 배열 하나에서 펼칠 세부 줄 수 상한.
const DETAIL_MAX = 6;

/*
  ── 상세정보 필드(개요형) ─────────────────────────────────────────────
  `{enabled, items: [{text, children: [...]}]}` 모양이다. 과제 상세의 개요·배경·
  목표·내용·결과·산출물·계획이 전부 이 꼴이다.

  🐞 예전에는 이게 그냥 객체로 떨어져 `JSON.stringify` 된 채 화면에 나왔다 —
     `{"enabled":true,"items":[{"children":[],"text":"TRP/TIS 예측 …` 처럼.
     무엇이 바뀌었는지는커녕 무슨 내용인지도 못 읽었다.
     줄 단위로 갈라 **어느 줄이 늘고 줄었는지**를 보여 준다.
*/
const isOutline = (v) => !!v && typeof v === 'object' && !Array.isArray(v)
  && Array.isArray(v.items);

/**
 * 개요형 → 줄 목록 `[{text, depth}]`. 자식은 한 칸 들여쓴 줄로 편다.
 *
 * ⚠️ **옛 모양(그냥 문자열 배열)도 받는다.** 개발 DB 의 `detail_overview_json` 에
 *    `["...", "..."]` 로 남은 행이 있다. 옛 모양 → 새 모양으로 바뀐 저장에서 이걸
 *    안 받으면 **없어진 줄이 통째로 안 보인다**(한쪽만 비어 "N줄 추가" 로만 나온다).
 */
export const flattenOutline = (value, depth = 0) => {
  const items = Array.isArray(value) ? value
    : (value && Array.isArray(value.items) ? value.items : null);
  if (!items) return [];
  const out = [];
  items.forEach((item) => {
    if (typeof item === 'string') {
      if (item.trim()) out.push({ text: item.trim(), depth });
      return;
    }
    if (!item || typeof item !== 'object') return;
    const text = String(item.text ?? '').trim();
    if (text) out.push({ text, depth });
    if (Array.isArray(item.children) && item.children.length) {
      out.push(...flattenOutline({ items: item.children }, depth + 1));
    }
  });
  return out;
};

/** 들여쓰기를 눈에 보이게. 깊이가 깊어도 두 칸까지만 — 그 아래는 실제로 없다. */
const outlineLabel = ({ text, depth }) =>
  `${'· '.repeat(Math.min(depth, 2))}${text}`;

/**
 * 개요형 두 벌을 **줄 단위**로 견준다.
 *
 * 짝은 **글자**로 맞춘다. 순번으로 맞추면 중간에 한 줄을 끼워 넣었을 때 그 뒤가
 * 전부 바뀐 것으로 보인다 — 실제로는 한 줄만 는 것이다.
 * 대신 글자를 고친 줄은 "빠짐 + 늘어남" 두 줄로 나온다. 그게 덜 놀랍다.
 */
export const diffOutline = (before, after) => {
  const prev = flattenOutline(before);
  const next = flattenOutline(after);
  const prevSet = new Set(prev.map(outlineLabel));
  const nextSet = new Set(next.map(outlineLabel));

  const removed = prev.filter(x => !nextSet.has(outlineLabel(x)));
  const added = next.filter(x => !prevSet.has(outlineLabel(x)));

  // 표시 켜고 끄기도 변경이다 — 내용이 그대로여도 화면에서 사라진다.
  const wasOn = before ? before.enabled !== false : false;
  const nowOn = after ? after.enabled !== false : false;
  const toggled = Boolean(before) && Boolean(after) && wasOn !== nowOn;

  const parts = [];
  if (toggled) parts.push(nowOn ? '표시 켬' : '표시 끔');
  if (added.length) parts.push(`${added.length}줄 추가`);
  if (removed.length) parts.push(`${removed.length}줄 삭제`);
  // 🐞 예전엔 "줄 수가 같으면 순서 변경" 이라고 했다. 그러면 **아무것도 안 바뀐
  //    경우까지** 순서 변경으로 나온다. 실제로 차례가 다른지 이어 붙여 견준다.
  if (!parts.length) {
    const sep = String.fromCharCode(0);
    const prevSeq = prev.map(outlineLabel).join(sep);
    const nextSeq = next.map(outlineLabel).join(sep);
    if (prevSeq !== nextSeq) parts.push('순서 변경');
  }

  const rows = [
    ...removed.map(x => ({ sign: '−', label: outlineLabel(x) })),
    ...added.map(x => ({ sign: '+', label: outlineLabel(x) })),
  ];
  const details = rows.length > DETAIL_MAX
    ? [...rows.slice(0, DETAIL_MAX),
       { sign: '', label: `… 외 ${rows.length - DETAIL_MAX}줄` }]
    : rows;

  return { summary: parts.join(' · ') || '변경 없음', details };
};

/*
  ── 그냥 객체(키-값 지도) ──────────────────────────────────────────────
  개요형이 아닌 객체도 있다. 실데이터에서 셋이다:
      monthly_progress_json  {"3": "□ 조립 순서 …", "4": "…"}   ← 키가 **월 번호**
      image_refs_json        {이미지_개요그림: [{fileName, …}]}
      __created__            {code, title}
  이것들도 예전에는 `JSON.stringify` 로 떨어져 화면에 중괄호가 그대로 나왔다.
  키마다 갈라서 **어느 칸이 바뀌었는지**를 보여 준다.
*/
const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

// 월 지도는 키가 곧 월이다. 전부 1~12 일 때만 '월' 을 붙인다 — 하나라도 아니면
// 다른 뜻의 숫자 키일 수 있어 지어내지 않는다.
const MONTH_KEY = /^(1[0-2]|[1-9])$/;
const isMonthMap = (obj) => {
  const keys = Object.keys(obj || {});
  return keys.length > 0 && keys.every(k => MONTH_KEY.test(k));
};

const objectKeys = (obj, monthly) => {
  const keys = Object.keys(obj || {});
  // 월 지도는 **숫자 순**으로. 객체 키 순서는 저장할 때마다 뒤집힐 수 있다.
  return monthly ? keys.sort((a, b) => Number(a) - Number(b)) : keys;
};

const objectKeyLabel = (key, monthly) => (monthly ? `${key}월` : key);

/** 빈 칸(빈 문자열·null)은 없는 것으로 본다 — 월 지도가 12칸 다 차 있는 일이 드물다. */
const hasContent = (v) => v !== null && v !== undefined && v !== ''
  && !(Array.isArray(v) && v.length === 0);

/**
 * 값 하나를 사람이 읽을 형태로.
 *
 * 배열은 내용을 다 펼치지 않고 **건수**로 줄인다 — 원소가 객체라 통째로 찍으면 한 줄이
 * 화면을 덮는다. 원소 안의 변화는 `diffList` 가 따로 짚는다.
 */
export const describeValue = (value) => {
  if (value === null || value === undefined) return '(없음)';
  if (typeof value === 'boolean') return value ? '예' : '아니오';
  if (Array.isArray(value)) return `${value.length}건`;
  if (isOutline(value)) {
    const lines = flattenOutline(value);
    const on = value.enabled === false ? '표시 끔' : '표시 켬';
    if (!lines.length) return `${on} · 비어 있음`;
    // 첫 줄을 함께 보여 준다 — 줄 수만으로는 무엇인지 알 수 없다.
    const head = lines[0].text;
    const more = lines.length > 1 ? ` 외 ${lines.length - 1}줄` : '';
    const text = `${on} · ${head}${more}`;
    return text.length > VALUE_MAX ? `${text.slice(0, VALUE_MAX)}…` : text;
  }
  if (isPlainObject(value)) {
    const monthly = isMonthMap(value);
    const keys = objectKeys(value, monthly).filter(k => hasContent(value[k]));
    if (!keys.length) return '(비어 있음)';
    const text = keys
      .map(k => `${objectKeyLabel(k, monthly)}: ${describeValue(value[k])}`)
      .join(' · ');
    return text.length > VALUE_MAX ? `${text.slice(0, VALUE_MAX)}…` : text;
  }
  // 줄바꿈은 한 칸으로 눕힌다 — 월간진척처럼 여러 줄인 값이 요약 칸에서
  // 글자끼리 들러붙어 보이는 것을 막는다. 원문은 `rawText` 가 그대로 들고 있다.
  const text = String(value).replace(/\s+/g, ' ').trim();
  if (text === '') return '(비어 있음)';
  return text.length > VALUE_MAX ? `${text.slice(0, VALUE_MAX)}…` : text;
};

/**
 * 툴팁 안에서 쓰는 **속값 풀어쓰기**. `describeValue` 와 달리 줄이지 않는다 —
 * 마우스를 올려 보는 자리는 원문을 보러 오는 자리다.
 */
const plainText = (value) => {
  if (value === null || value === undefined) return '(없음)';
  if (typeof value === 'boolean') return value ? '예' : '아니오';
  if (isOutline(value)) return flattenOutline(value).map(outlineLabel).join(' / ');
  if (Array.isArray(value)) return value.map(plainText).join(', ');
  if (isPlainObject(value)) {
    return Object.keys(value).filter(k => hasContent(value[k]))
      .map(k => `${k}: ${plainText(value[k])}`).join(', ');
  }
  return String(value);
};

/** 마우스를 올렸을 때 보여줄 원문. 너무 길면 툴팁이 화면을 덮으므로 상한을 둔다. */
export const rawText = (value) => {
  if (value === null || value === undefined) return '';
  // 개요형은 **줄글**로 보여 준다. JSON 을 툴팁에 띄워 봐야 읽히지 않는다.
  if (isOutline(value)) {
    const lines = flattenOutline(value).map(outlineLabel);
    const text = lines.join(String.fromCharCode(10)) || '(비어 있음)';
    return text.length > TITLE_MAX ? `${text.slice(0, TITLE_MAX)}…` : text;
  }
  // 배열도 줄글로. 활동로그는 값을 통째로 보여 주는 자리가 있어서(`projects`,
  // `performances`) 여기서 안 풀면 `[{"code":"MX-39",…}]` 가 툴팁에 그대로 뜬다.
  if (Array.isArray(value)) {
    const text = value.map(plainText).join(String.fromCharCode(10)) || '(비어 있음)';
    return text.length > TITLE_MAX ? `${text.slice(0, TITLE_MAX)}…` : text;
  }
  // 그냥 객체도 줄글로. 툴팁은 줄바꿈을 살려 주므로 칸마다 한 줄씩 준다.
  if (isPlainObject(value)) {
    const monthly = isMonthMap(value);
    const keys = objectKeys(value, monthly).filter(k => hasContent(value[k]));
    const text = keys
      .map(k => `${objectKeyLabel(k, monthly)}: ${plainText(value[k])}`)
      .join(String.fromCharCode(10)) || '(비어 있음)';
    return text.length > TITLE_MAX ? `${text.slice(0, TITLE_MAX)}…` : text;
  }
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return text.length > TITLE_MAX ? `${text.slice(0, TITLE_MAX)}…` : text;
};

const elementKey = (element, index) => {
  if (!element || typeof element !== 'object') return `#${index}`;
  const found = ELEMENT_ID_KEYS.find(k =>
    element[k] !== undefined && element[k] !== null && element[k] !== '');
  // 짝지을 키가 없으면 **순서**로 짝짓는다. 중간에 끼워 넣으면 그 뒤가 전부 바뀐 것으로
  // 보이지만, 그런 배열(담당부서목록 등)은 원소가 문자열이라 어차피 값으로 드러난다.
  return found ? `${found}=${element[found]}` : `#${index}`;
};

const elementLabel = (element, index) => {
  if (!element || typeof element !== 'object') return describeValue(element);
  const found = ELEMENT_LABEL_KEYS.find(k =>
    typeof element[k] === 'string' && element[k].trim() !== '');
  return found ? element[found] : `${index + 1}번째`;
};

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const hasDuplicate = (keys) => new Set(keys).size !== keys.length;

/** 배열 필드의 before/after 를 **원소 단위**로 비교한다. */
export const diffList = (before, after) => {
  const prev = Array.isArray(before) ? before : [];
  const next = Array.isArray(after) ? after : [];

  // 🐞 짝짓기 키가 겹치면 Map 이 **뒤엣것으로 덮어써서** 원소가 조용히 사라진다.
  //    (같은 KPI 를 사업부만 달리해 두 번 잇는 것이 실제로 가능하다.)
  //    한쪽이라도 겹치면 양쪽 다 순번으로 짝짓는다 — 덜 똑똑해도 세는 건 맞는다.
  let key = elementKey;
  if (hasDuplicate(prev.map(elementKey)) || hasDuplicate(next.map(elementKey))) {
    key = (el, i) => `#${i}`;
  }

  const prevMap = new Map(prev.map((el, i) => [key(el, i), { el, i }]));
  const nextMap = new Map(next.map((el, i) => [key(el, i), { el, i }]));

  const added = [];
  const removed = [];
  const changed = [];

  nextMap.forEach((cur, key) => {
    if (!prevMap.has(key)) added.push(cur);
  });
  prevMap.forEach((old, key) => {
    const cur = nextMap.get(key);
    if (!cur) {
      removed.push(old);
      return;
    }
    if (sameJson(old.el, cur.el)) return;

    const bothObjects = isPlainObject(old.el) && isPlainObject(cur.el);
    const props = [];
    if (bothObjects) {
      new Set([...Object.keys(old.el), ...Object.keys(cur.el)]).forEach(prop => {
        if (NOISE_PROPS.has(prop)) return;
        if (!sameJson(old.el[prop], cur.el[prop])) {
          props.push({ prop, before: old.el[prop], after: cur.el[prop] });
        }
      });
      // 살림용 값만 달라진 것은 **변경이 아니다.** 액션아이템 하나를 지우면 뒤엣것의
      // `id` 가 통째로 밀리는데, 그걸 세면 "1건 삭제" 가 "1건 삭제 · 2건 수정" 이 된다.
      if (!props.length) return;
    }
    changed.push({ old, cur, props });
  });

  return { added, removed, changed };
};

export const listSummary = ({ added, removed, changed }) => {
  const parts = [];
  if (added.length) parts.push(`${added.length}건 추가`);
  if (removed.length) parts.push(`${removed.length}건 삭제`);
  if (changed.length) parts.push(`${changed.length}건 수정`);
  return parts.join(' · ');
};

/**
 * `depth` 는 **재귀 한 겹만** 허용하려고 있다. 액션아이템 안에 `세부항목목록` 이 또 배열이라,
 * 여기서 멈추면 바깥과 똑같이 "3건 → 3건" 이 되어 문제가 한 겹 아래에서 반복된다.
 * 두 겹 아래는 실제 데이터에 없으므로 거기서 끊는다 — 라벨이 끝없이 길어지는 것도 막는다.
 */
export const listDetails = ({ added, removed, changed }, depth = 0) => {
  const rows = [];
  removed.forEach(({ el, i }) => rows.push({ sign: '−', label: elementLabel(el, i) }));
  added.forEach(({ el, i }) => rows.push({ sign: '+', label: elementLabel(el, i) }));

  // 고친 원소가 하나뿐이면 이름표가 군더더기다 — 속성 이름만으로 충분히 읽힌다.
  const many = changed.length > 1;
  changed.forEach(({ old, cur, props }) => {
    const name = elementLabel(old.el, old.i);
    const prefix = many ? `${name} · ` : '';

    if (props.length === 0) {
      // 원소가 객체가 아니면(담당자 이름 배열 등) 속성이랄 게 없다. 이름표에 옛 값을
      // 그대로 쓰면 "~ 엉뚱한이름" 으로 끝나 **바뀐 값이 안 보인다.** 짝을 보여 준다.
      if (!isPlainObject(old.el) || !isPlainObject(cur.el)) {
        rows.push({
          sign: '~', label: `${old.i + 1}번째`,
          before: describeValue(old.el), after: describeValue(cur.el),
          beforeRaw: rawText(old.el), afterRaw: rawText(cur.el),
        });
        return;
      }
      rows.push({ sign: '~', label: name });
      return;
    }

    props.forEach(({ prop, before, after }) => {
      if (depth < 1 && Array.isArray(before) && Array.isArray(after)) {
        const subRows = listDetails(diffList(before, after), depth + 1);
        // 안쪽에서 짚어낸 게 있으면 그걸 쓰고, 없으면(순서만 바뀐 경우 등) 건수로 떨어진다
        if (subRows.length) {
          subRows.forEach(sub => rows.push({
            ...sub, label: `${prefix}${prop} · ${sub.label}`,
          }));
          return;
        }
      }
      rows.push({
        sign: '~',
        label: `${prefix}${prop}`,
        before: describeValue(before), after: describeValue(after),
        beforeRaw: rawText(before), afterRaw: rawText(after),
      });
    });
  });

  if (rows.length > DETAIL_MAX) {
    const rest = rows.length - DETAIL_MAX;
    return [...rows.slice(0, DETAIL_MAX), { sign: '', label: `… 외 ${rest}건` }];
  }
  return rows;
};

/**
 * 그냥 객체 두 벌을 **칸(키) 단위**로 견준다.
 *
 * 요약에 건수 대신 **칸 이름**을 적는다 — "2개 수정" 보다 "3월 · 5월 수정" 이
 * 훨씬 쓸모 있다. 이름이 너무 많으면 앞의 셋만 적고 나머지는 세어서 붙인다.
 */
export const diffObject = (before, after) => {
  const prev = isPlainObject(before) ? before : {};
  const next = isPlainObject(after) ? after : {};
  const monthly = isMonthMap(prev) && isMonthMap(next);
  const keys = objectKeys(
    { ...prev, ...next },   // 합집합. 값이 아니라 키만 쓴다
    monthly,
  );
  const lab = (k) => objectKeyLabel(k, monthly);

  const added = [];
  const removed = [];
  const changed = [];
  keys.forEach((k) => {
    const a = hasContent(prev[k]);
    const b = hasContent(next[k]);
    if (!a && !b) return;
    if (!a) added.push(k);
    else if (!b) removed.push(k);
    else if (!sameJson(prev[k], next[k])) changed.push(k);
  });

  const names = (list) => (list.length > 3
    ? `${list.slice(0, 3).map(lab).join(', ')} 외 ${list.length - 3}개`
    : list.map(lab).join(', '));

  const parts = [];
  if (added.length) parts.push(`${names(added)} 추가`);
  if (removed.length) parts.push(`${names(removed)} 삭제`);
  if (changed.length) parts.push(`${names(changed)} 수정`);

  const rows = [];
  removed.forEach(k => rows.push({ sign: '−', label: `${lab(k)} · ${describeValue(prev[k])}` }));
  added.forEach(k => rows.push({ sign: '+', label: `${lab(k)} · ${describeValue(next[k])}` }));
  changed.forEach((k) => {
    // 칸 값이 배열이면 한 겹 더 판다 (보고서 이미지가 이 꼴이다)
    if (Array.isArray(prev[k]) && Array.isArray(next[k])) {
      const sub = listDetails(diffList(prev[k], next[k]));
      if (sub.length) {
        sub.forEach(s => rows.push({ ...s, label: `${lab(k)} · ${s.label}` }));
        return;
      }
    }
    rows.push({
      sign: '~',
      label: lab(k),
      before: describeValue(prev[k]), after: describeValue(next[k]),
      beforeRaw: rawText(prev[k]), afterRaw: rawText(next[k]),
    });
  });

  const details = rows.length > DETAIL_MAX
    ? [...rows.slice(0, DETAIL_MAX),
       { sign: '', label: `… 외 ${rows.length - DETAIL_MAX}칸` }]
    : rows;

  return { summary: parts.join(' · ') || '변경 없음', details };
};

/**
 * before/after 한 쌍을 화면에 그릴 항목으로. 배열이면 원소 단위로 펼친다.
 *
 * 활동로그(키가 여럿인 객체)와 변경 이력(행마다 필드 하나)이 **같은 모양**을 쓰도록
 * 여기서 형태를 맞춘다.
 */
export const toChangeEntry = (label, before, after) => {
  // 상세정보(개요형)는 줄 단위로 펼친다 — 통째로 찍으면 JSON 이 그대로 보인다.
  if (isOutline(before) || isOutline(after)) {
    const { summary, details } = diffOutline(before, after);
    return { key: label, summary, details };
  }
  if (Array.isArray(before) || Array.isArray(after)) {
    const result = diffList(before, after);
    // 짚어낸 게 없는데 값은 다르다면, 사람이 볼 게 아닌 것만 달라진 것이다
    // (자리 번호가 밀렸거나 `createdAt` 이 붙었거나). 그냥 '순서 변경' 이라고 하면
    // 거짓말이 되므로 **내용 기준으로** 말한다.
    return {
      key: label,
      summary: listSummary(result)
        || (sameJson(before, after) ? '변경 없음' : '내용 변화 없음'),
      details: listDetails(result),
    };
  }
  // 개요형도 배열도 아닌 객체(월간진척·보고서 이미지)는 칸 단위로 펼친다.
  // **양쪽 다 객체일 때만.** 한쪽이 없으면 "칸이 다 늘었다" 가 되어 오히려 시끄럽다 —
  // 그 경우는 아래 일반 경로에서 `describeValue` 가 읽을 수 있게 적어 준다.
  if (isPlainObject(before) && isPlainObject(after)) {
    const { summary, details } = diffObject(before, after);
    return { key: label, summary, details };
  }
  return {
    key: label,
    before: describeValue(before), after: describeValue(after),
    beforeRaw: rawText(before), afterRaw: rawText(after),
  };
};
