"""주간보고에서 붙여넣은 텍스트를 KPI 기록·주간 동향으로 읽는다. **순수 함수만.**

왜 붙여넣기인가
    원본은 사내 DRM 이 걸린 워드다. 파일을 올려도 서버가 받는 것은 암호화된
    덩어리라 python-docx 가 못 연다. 반면 **워드가 화면에 보여주고 있는 글자**는
    복사가 되므로, 사람이 표를 긁어 붙이면 탭 구분 텍스트로 들어온다.
    그래서 이 모듈의 입구는 파일이 아니라 **텍스트 한 덩이**다 —
    나중에 워드 매크로를 붙이든 DRM 이 풀린 파일이 생기든 뒤쪽은 그대로 쓴다.

⚠️ **기준일은 문서에 없다.** 주간보고에는 날짜 칸이 아예 없어서, 화면이 한 번
   받아 전 행에 적용한다. 여기서 날짜를 찾으려 들지 말 것.

⚠️ **아무것도 저장하지 않는다.** 이 파일은 읽고 판단만 하고, 무엇을 넣을지는
   사람이 미리보기에서 고른다. 자동 반입이 조용히 과거 값을 고치면 그게 제일 무섭다.

⚠️ **못 읽은 것을 반드시 말한다.** 개발 환경에는 진짜 문서가 없다(DRM). 그래서 이
   파서의 첫 목표는 "맞히기" 가 아니라 **"무엇을 못 읽었는지 알아볼 수 있게 말하기"** 다.
   그래야 운영에서 한 번 붙여 보고 고칠 수 있다. 조용히 건너뛰는 코드를 넣지 말 것.
"""
from __future__ import annotations

import re

# 표의 머리글을 찾을 때 쓰는 말들. 좌표(「2번째 열」)로 짜면 다음 주에 깨진다.
_H_DIVISION = ('사업부', '부문', '구분', 'division')
_H_KPI = ('kpi', '지표', '항목', '과제')
_H_VALUE = ('실적', '값', '현재', '결과', '금주', 'value')

# 값이 아니라 '비어 있음' 을 뜻하는 표기. 0 과 구분해야 한다.
_BLANK = {'', '-', '--', 'n/a', 'na', '해당없음', '미측정', '.', '·'}

# 주간 동향의 글머리표. 이 중 무엇으로 시작하든 한 항목으로 본다.
_BULLET_RE = re.compile(r'^\s*(?:[-–—·•*.]|\d+[.)]|\(\d+\))\s+')

# 개발/제조 구획을 여는 줄 (「개발」 「[제조]」 「■ 개발」 …)
_CATEGORY_RE = re.compile(r'^\s*[\[\(<■□▶●◆:]*\s*(개발|제조)\s*[\]\)>:]*\s*$')


def _norm(s):
    """이름 대조용 정규화 — 공백·괄호·기호를 지우고 소문자로."""
    return re.sub(r'[\s()\[\]{}/·.,\-_]', '', str(s or '')).lower()


def _cells(line):
    """한 줄 → 칸들. 워드 표를 복사하면 탭으로 갈라진다."""
    return [c.strip() for c in line.split('\t')]


def _looks_blank(v):
    return _norm(v) in {_norm(x) for x in _BLANK} or str(v).strip() in _BLANK


# ─────────────────────────────────────────────────────────────────────────────
# 값 읽기
# ─────────────────────────────────────────────────────────────────────────────

def parse_value(raw, unit=''):
    """
    칸 하나 → `(값, 분자, 분모)`. 못 읽으면 `(None, None, None)`.

    분수(`12/30`)는 분자·분모를 살려 둔다 — 이 모듈은 분자/분모를 따로 보관하고
    화면이 그걸 다시 보여준다(`show_raw_data`).

    ⚠️ 합성 규칙은 화면(`DxKpiManagementApp` 일괄 입력)에 있는 것을 **그대로** 옮겼다:
           단위가 '%' 면 (분자/분모)×100, 아니면 분자/분모 · 소수 한 자리
       여기서 다르게 계산하면 손으로 넣은 값과 붙여넣은 값이 서로 다른 숫자가 된다.
    """
    text = str(raw or '').strip()
    if _looks_blank(text):
        return None, None, None

    # 천단위 쉼표·단위 기호를 떼고 본다. 원문은 호출부가 따로 들고 있는다.
    cleaned = text.replace(',', '').replace('%', '').strip()

    m = re.match(r'^(-?\d+(?:\.\d+)?)\s*/\s*(-?\d+(?:\.\d+)?)$', cleaned)
    if m:
        num, den = m.group(1), m.group(2)
        try:
            n, d = float(num), float(den)
        except ValueError:
            return None, None, None
        if d == 0:
            return None, None, None            # 0 으로 나눌 수 없다
        value = (n / d) * 100 if unit == '%' else (n / d)
        return f'{value:.1f}', num, den

    m = re.match(r'^-?\d+(?:\.\d+)?$', cleaned)
    if m:
        return cleaned, None, None

    return None, None, None


# ─────────────────────────────────────────────────────────────────────────────
# KPI 표
# ─────────────────────────────────────────────────────────────────────────────

def _match_division(cell, divisions):
    """칸 하나가 사업부인가. 이름('MX')·코드('mx')·별칭('의료')을 다 받는다."""
    key = _norm(cell)
    if not key:
        return None
    for d in divisions:
        if key == _norm(d['name']) or key == _norm(d.get('id')):
            return d['name']
    # 부분 일치는 **한 곳만** 걸릴 때만 인정한다 — 여럿이면 사람이 골라야 한다.
    hits = [d['name'] for d in divisions
            if key and (key in _norm(d['name']) or _norm(d['name']) in key)]
    return hits[0] if len(hits) == 1 else None


# 이름 뒤에 붙는 군더더기. 「가상 검증률(%)」·「데이터 연결률 [건]」처럼 문서마다 다르다.
# `_norm` 이 괄호 **기호**는 지우지만 **안의 글자**는 남기므로 여기서 따로 뗀다.
_TRAIL_JUNK = re.compile(
    r'(?:[(\[<{][^)\]>}]*[)\]>}]|[%]|건수?|개수?|회수?|일수?|시간|분|억원|백만원|천원|원|점|명|건/월)+$')
# 이름 앞에 붙는 사업부 꼬리표 — 「[MX] TRP 오차율」
_LEAD_TAG = re.compile(r'^\s*[\[(<]\s*[A-Za-z가-힣]{1,6}\s*[\])>]\s*')


def _kpi_keys(text):
    """이름 하나에서 **대조에 쓸 열쇠들**을 만든다. 앞엣것일수록 확실하다."""
    text = str(text or '').strip()
    keys = [_norm(text)]
    bare = _LEAD_TAG.sub('', text)
    if bare != text:
        keys.append(_norm(bare))
    for base in (text, bare):
        cut = _TRAIL_JUNK.sub('', base).strip()
        if cut and cut != base:
            keys.append(_norm(cut))
    return [k for i, k in enumerate(keys) if k and k not in keys[:i]]


def _match_kpi(cell, definitions):
    """
    칸 하나가 어느 KPI 인가. `(정의, 어떻게 맞췄나)` · 없으면 `(None, None)`.

    단계를 나눈 이유 — **어떻게 맞췄는지를 화면에 말해 줘야** 하기 때문이다.
    글자가 똑같아서 맞춘 것과 비슷해서 맞춘 것은 사람이 확인할 필요가 다르다.

        exact   글자 그대로
        norm    공백·기호·단위 꼬리표를 떼면 같다
        near    한쪽이 다른 쪽을 품는다 — **딱 하나만 걸릴 때만** 인정한다

    🐞 예전에는 exact/norm 둘뿐이었다. 그런데 실제 주간보고는 이름 뒤에 단위를
       달고 다녀서(「가상 검증률(%)」) 한 표에서 **모르는 이름이 14개**나 나왔다.
       사람이 하나씩 골라 줘야 했다.
    """
    text = str(cell or '').strip()
    if not text:
        return None, None
    for d in definitions:
        if d['label'] == text:
            return d, 'exact'

    keys = _kpi_keys(text)
    for key in keys:
        for d in definitions:
            if key in _kpi_keys(d['label']):
                return d, 'norm'

    # 품기 — 짧은 이름은 아무 데나 걸리므로 네 글자 이상일 때만 본다
    key = keys[0]
    if len(key) >= 4:
        hits = [d for d in definitions
                if any(key in dk or dk in key for dk in _kpi_keys(d['label']))]
        if len(hits) == 1:
            return hits[0], 'near'
    return None, None


def _find_header(rows, divisions):
    """
    머리글 줄과 표의 모양을 찾는다. `(index, layout, info)` · 못 찾으면 `(None, ...)`.

    두 모양을 다 받는다 — 주간보고 표는 둘 다 흔하다.

        긴 형태(long)   사업부 | KPI | 실적          한 줄에 한 값
        넓은 형태(wide)  KPI    | MX | VD | DA …     열이 사업부
    """
    for i, cells in enumerate(rows):
        # ① 넓은 형태 — 머리글에 사업부 이름이 둘 이상 있다
        div_cols = {}
        for j, c in enumerate(cells):
            name = _match_division(c, divisions)
            if name and name not in div_cols.values():
                div_cols[j] = name
        if len(div_cols) >= 2:
            # KPI 이름이 들어갈 열 = 사업부 열보다 왼쪽 중 가장 오른쪽
            first_div = min(div_cols)
            label_col = first_div - 1 if first_div > 0 else None
            return i, 'wide', {'divCols': div_cols, 'labelCol': label_col}

        # ② 긴 형태 — 사업부 열과 KPI 열이 따로 있다
        low = [_norm(c) for c in cells]

        def find(words):
            for j, c in enumerate(low):
                if any(w in c for w in words):
                    return j
            return None

        d_col, k_col = find([_norm(w) for w in _H_DIVISION]), find([_norm(w) for w in _H_KPI])
        v_col = find([_norm(w) for w in _H_VALUE])
        if d_col is not None and k_col is not None and d_col != k_col:
            return i, 'long', {'divCol': d_col, 'kpiCol': k_col, 'valueCol': v_col}

    return None, None, {}


def parse_kpi_table(text, divisions, definitions, aliases=None):
    """
    붙여넣은 표 → 반입 후보 행들. **저장하지 않는다.**

    divisions    `[{id, name}]`
    definitions  `[{id, label, category, unit, valueType, divisions}]`
    aliases      `{정규화된이름: kpi label}` — 지난번에 사람이 골라 둔 것

    돌려주는 것
        layout    'wide' | 'long' | None
        rows      [{division, kpi, category, unit, value, numerator, denominator,
                    raw, source}]  — **기준일은 없다.** 화면이 넣는다
        unknown   [{name, raw, count}]  이름을 못 맞춘 것 — 화면이 물어본다
        warnings  사람이 읽을 설명. 못 읽은 이유가 여기 다 들어간다
    """
    aliases = aliases or {}
    warnings = []
    lines = [ln for ln in str(text or '').replace('\r\n', '\n').split('\n')]
    rows = [_cells(ln) for ln in lines if ln.strip()]
    if not rows:
        return {'layout': None, 'rows': [], 'unknown': [],
                'warnings': ['붙여넣은 내용이 비어 있습니다.']}

    if not any(len(r) > 1 for r in rows):
        warnings.append(
            '탭으로 나뉜 칸이 없습니다. 워드에서 **표를 통째로** 선택해 복사했는지 '
            '확인해 주세요(글자만 복사하면 표가 아니라 줄글로 붙습니다).')
        return {'layout': None, 'rows': [], 'unknown': [], 'warnings': warnings}

    h_idx, layout, info = _find_header(rows, divisions)
    if h_idx is None:
        warnings.append(
            '머리글을 찾지 못했습니다. 사업부 이름이 열에 늘어선 표(MX·VD·DA…)이거나, '
            "'사업부'·'KPI' 머리글이 있는 표여야 읽을 수 있습니다. "
            f'첫 줄에서 읽은 칸: {rows[0][:6]}')
        return {'layout': None, 'rows': [], 'unknown': [], 'warnings': warnings}

    by_label = {d['label']: d for d in definitions}
    out, unknown = [], {}

    near_hits = []          # 비슷해서 맞춘 것 — 사람에게 알려 주고 미리보기에서 보게 한다

    def resolve(name):
        """이름 → 정의. 별칭 표를 먼저 본다(사람이 이미 답한 것이라 가장 세다)."""
        for key in _kpi_keys(name):
            alias = aliases.get(key)
            if alias and alias in by_label:
                return by_label[alias]
        defn, how = _match_kpi(name, definitions)
        if defn is not None and how == 'near':
            pair = (str(name).strip(), defn['label'])
            if pair not in near_hits:
                near_hits.append(pair)
        return defn

    def add_unknown(name, raw):
        key = _norm(name)
        if not key:
            return
        item = unknown.setdefault(key, {'name': name.strip(), 'raw': raw, 'count': 0})
        item['count'] += 1

    body = rows[h_idx + 1:]

    if layout == 'wide':
        div_cols, label_col = info['divCols'], info['labelCol']
        for r in body:
            # KPI 이름 칸 — 지정된 열이 비었으면 사업부 열 왼쪽에서 처음 나오는 글자
            name = ''
            if label_col is not None and label_col < len(r):
                name = r[label_col].strip()
            if not name:
                left = [c for j, c in enumerate(r)
                        if j < min(div_cols) and c.strip()]
                name = left[-1].strip() if left else ''
            if not name:
                continue
            defn = resolve(name)
            if defn is None:
                add_unknown(name, '\t'.join(r)[:120])
                continue
            for col, div_name in div_cols.items():
                if col >= len(r):
                    continue
                raw = r[col]
                value, num, den = parse_value(raw, defn.get('unit', ''))
                if value is None:
                    continue                    # 빈 칸은 조용히 넘긴다(미입력이다)
                out.append({
                    'division': div_name, 'kpi': defn['label'],
                    'category': defn.get('category', ''),
                    'unit': defn.get('unit', ''),
                    'value': value, 'numerator': num, 'denominator': den,
                    'raw': raw,
                })
    else:
        d_col, k_col, v_col = info['divCol'], info['kpiCol'], info['valueCol']
        if v_col is None:
            warnings.append(
                "'실적'·'값' 머리글을 못 찾아, 사업부·KPI 칸을 뺀 **마지막 칸**을 "
                '값으로 읽었습니다. 주차가 여러 열이면 **가장 오른쪽(최근) 주차**를 '
                '읽습니다. 미리보기에서 값이 맞는지 봐 주세요.')

        width = len(rows[h_idx])
        last_div = None          # 셀 병합 — 비어 있으면 위 줄 것을 물려받는다
        merged = 0
        no_carry = 0
        bad_div = {}
        for r in body:
            # ── 사업부 칸 정하기 ──────────────────────────────────────
            # 🐞 세로로 합친 칸은 **이어지는 줄에 아예 안 실려 온다.** 그러면 그 줄만
            #    칸이 하나 모자라고 나머지가 왼쪽으로 밀린다. 밀린 줄을 그대로 읽으면
            #    KPI 이름이 사업부 칸에 들어가 "사업부를 못 알아봤습니다" 가 쏟아진다.
            #    합친 칸을 **빈 칸으로** 내보내는 경우도 있다. 그때는 밀리지 않았으니
            #    그냥 위 줄을 물려받으면 된다. 둘을 가르는 것은 **머릿칸이 비었는가** 다.
            short = max(0, width - len(r))
            head = r[d_col] if d_col < len(r) else ''
            shifted = bool(short) and d_col < k_col \
                and not _looks_blank(head) \
                and _match_division(head, divisions) is None
            kc = k_col - short if shifted else k_col
            vc = (None if v_col is None else (v_col - short if shifted else v_col))
            div_raw = '' if shifted else head

            if kc < 0 or kc >= len(r):
                continue
            name = r[kc].strip()
            if not name:
                continue

            div_name = _match_division(div_raw, divisions)
            if div_name is None:
                if _looks_blank(div_raw):
                    # 병합이거나 빈 칸 — 위 줄 사업부를 물려받는다
                    if last_div is None:
                        no_carry += 1
                        continue
                    div_name = last_div
                    merged += 1
                else:
                    bad_div[div_raw.strip()] = bad_div.get(div_raw.strip(), 0) + 1
                    continue
            else:
                last_div = div_name

            defn = resolve(name)
            if defn is None:
                add_unknown(name, '\t'.join(r)[:120])
                continue
            if vc is not None and 0 <= vc < len(r):
                raw = r[vc]
            else:
                skip = {kc} if shifted else {d_col, kc}
                tail = [c for j, c in enumerate(r) if j not in skip and c.strip()]
                raw = tail[-1] if tail else ''
            value, num, den = parse_value(raw, defn.get('unit', ''))
            if value is None:
                continue
            out.append({
                'division': div_name, 'kpi': defn['label'],
                'category': defn.get('category', ''),
                'unit': defn.get('unit', ''),
                'value': value, 'numerator': num, 'denominator': den,
                'raw': raw,
            })

        # 줄마다 한 줄씩 경고하면 화면이 경고로 덮인다 — **한 번에 모아** 말한다.
        if merged:
            warnings.append(
                f'사업부 칸이 빈 줄 {merged}개는 **바로 위 사업부**로 읽었습니다 '
                '(표에서 사업부를 세로로 합친 것으로 보입니다). '
                '미리보기에서 사업부가 맞는지 봐 주세요.')
        if no_carry:
            warnings.append(
                f'사업부 칸이 비었는데 **위에 물려받을 사업부가 없는 줄 {no_carry}개**는 '
                '건너뛰었습니다. 표 머리글 바로 아래부터 복사했는지 확인해 주세요.')
        if bad_div:
            items = ', '.join(f'{k!r}({v}줄)' for k, v in
                              sorted(bad_div.items(), key=lambda x: -x[1])[:5])
            warnings.append(f'사업부를 못 알아본 칸: {items} — 그 줄은 건너뛰었습니다.')

    if near_hits:
        items = ', '.join(f'{a} → {b}' for a, b in near_hits[:8])
        warnings.append(
            f'이름이 딱 맞지 않아 **비슷한 것으로 맞춘 KPI {len(near_hits)}개**가 있습니다: '
            f'{items}. 미리보기에서 확인해 주세요.')

    if not out and not unknown:
        warnings.append('머리글은 찾았는데 읽을 값이 한 줄도 없습니다. '
                        '표 아래쪽 내용까지 함께 복사했는지 확인해 주세요.')
    return {
        'layout': layout,
        'rows': out,
        'unknown': sorted(unknown.values(), key=lambda u: -u['count']),
        'warnings': warnings,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 주간 동향
# ─────────────────────────────────────────────────────────────────────────────

def parse_weekly(text, divisions, default_category='개발'):
    """
    붙여넣은 줄글 → `(사업부, 개발/제조)` 별 본문.

    문서가 사업부마다 `-`·`.` 로 항목을 적는 형식이라 그 규칙으로 읽는다.

        MX                       ← 사업부 이름만 있는 줄 = 구획 시작
          개발                    ← 개발/제조만 있는 줄 = 구분 전환
          - 설계 자동화 도구 배포
            (들여쓴 이어지는 줄은 앞 항목에 붙인다)
          - 해석 표준 3종 추가

    ⚠️ **본문을 다시 쓰지 않는다.** 원문 줄을 그대로 모아 넣는다 — 주간 동향은
       보고 근거라, 요약하거나 다듬으면 근거가 아니게 된다.
       (`WeeklyTrend.content` 가 Text 한 덩이라 항목을 쪼갤 필요도 없다.)
    """
    warnings = []
    lines = str(text or '').replace('\r\n', '\n').split('\n')

    sections = []          # {division, category, lines[], lineFrom}
    cur = None
    cur_div = None
    cur_cat = default_category
    saw_category = False

    def close():
        if cur and any(ln.strip() for ln in cur['lines']):
            cur['content'] = '\n'.join(cur['lines']).strip()
            sections.append(cur)

    for i, raw in enumerate(lines):
        line = raw.rstrip()
        stripped = line.strip()
        if not stripped:
            if cur:
                cur['lines'].append('')
            continue

        # ① 사업부 이름만 있는 줄인가 — 글머리표가 붙은 줄은 항목이지 제목이 아니다
        if not _BULLET_RE.match(line):
            name = _match_division(stripped, divisions)
            if name and len(stripped) <= 12:
                close()
                cur_div, cur_cat = name, default_category
                cur = {'division': name, 'category': cur_cat,
                       'lines': [], 'lineFrom': i + 1}
                continue

            # ② 개발/제조만 있는 줄인가
            m = _CATEGORY_RE.match(stripped)
            if m:
                saw_category = True
                if cur_div is None:
                    warnings.append(
                        f'{i + 1}번째 줄의 「{m.group(1)}」 앞에 사업부가 없어 건너뜁니다.')
                    continue
                close()
                cur_cat = m.group(1)
                cur = {'division': cur_div, 'category': cur_cat,
                       'lines': [], 'lineFrom': i + 1}
                continue

        if cur is None:
            # 사업부가 나오기 전의 글은 어디에 넣어야 할지 알 수 없다
            warnings.append(f'{i + 1}번째 줄이 어느 사업부 것인지 알 수 없어 건너뜁니다: '
                            f'{stripped[:30]}')
            continue
        cur['lines'].append(line)

    close()

    if not sections:
        warnings.append(
            '사업부 구획을 찾지 못했습니다. 사업부 이름(MX·VD·DA·NW·의료기기)이 '
            '한 줄에 단독으로 있어야 그 아래를 그 사업부 것으로 읽습니다.')
    if sections and not saw_category:
        warnings.append(
            f"'개발'·'제조' 구분 줄이 없어 전부 「{default_category}」 으로 놓았습니다. "
            '미리보기에서 바꿔 주세요.')

    return {
        'sections': [{'division': s['division'], 'category': s['category'],
                      'content': s['content'], 'lineFrom': s['lineFrom']}
                     for s in sections],
        'warnings': warnings,
    }
