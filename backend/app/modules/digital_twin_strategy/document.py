"""
⑤ 기획서 — ①~④ 를 문서로 조립한다.

**다시 적지 않는다.** 진단·이슈·SWOT·솔루션은 이미 각 단계에 있다. 문서가
그것을 옮겨 적게 하면 그 순간부터 둘이 갈라지고, 며칠 뒤에는 어느 쪽이 맞는지
아무도 모른다. 그래서 여기서는 **조립만** 한다 — 사람이 쓰는 것은 어느 단계도
만들어 줄 수 없는 것(배경·맺음말)뿐이다.

⚠️ **빈 구간을 감추지 않는다.** 이슈가 하나도 없으면 「이슈」 장을 빼는 것이
   문서로는 깔끔하지만, 읽는 사람은 그 장이 없다는 것 자체를 모른다. 없는 것은
   **없다고 적어야** 검토가 된다. 이 모듈이 "안 매긴 것은 낮은 점수가 아니다"를
   지켜온 것과 같은 규칙이다.

⚠️ **로드맵은 날짜가 아니라 순서다.** 일정 데이터가 없다. 분기 격자를 그리면
   그 칸을 채우는 것이 목적이 되고, 근거 없는 날짜가 문서에 박힌다. 우리가 아는
   것은 **무엇부터 하는가**(④ 사분면)이므로 그 순서만 적는다.

조립 결과는 블록 목록이다. 화면 미리보기와 Word 내보내기가 **같은 블록**을
읽는다 — 두 곳에서 따로 그리면 화면과 문서가 다른 모양이 된다.

    {'type': 'text',  'text': ...}
    {'type': 'list',  'items': [{'title', 'detail', 'tag'}]}
    {'type': 'table', 'head': [...], 'rows': [[...]]}
    {'type': 'note',  'text': ...}     비어 있음·주의 같은 곁말
"""
from .definitions import (
    CATEGORIES, CATEGORY_TECHNICAL, CATEGORY_ORGANIZATION, GATES, METRICS,
)

# 문서의 뼈대. 순서가 곧 목차다.
#
# kind='auto'   단계에서 조립한다. 사람이 손대지 않는다
# kind='manual' 어느 단계도 만들어 줄 수 없는 것. 사람이 쓴다
SECTIONS = [
    # ⚠️ **임원은 첫 장만 봅니다.** 본문을 다 읽게 만드는 문서는 안 읽힙니다.
    #    이 장은 사람이 안 써도 되게 앞 단계에서 조립합니다 — 요약을 손으로
    #    쓰게 두면 본문과 갈라지고, 그때 갈라진 쪽은 늘 요약입니다.
    {'key': 'summary', 'title': '0. 한 장 요약', 'kind': 'auto',
     'hint': '넘으려는 것 · 먼저 할 일 · 아직 비어 있는 장'},
    {'key': 'background', 'title': '1. 배경과 목적', 'kind': 'manual',
     'hint': '왜 올해 이 전략을 세우는지. 어느 단계도 대신 써 줄 수 없습니다.'},
    {'key': 'diagnosis', 'title': '2. 현재 상태 진단', 'kind': 'auto',
     'hint': '① 진단의 성숙도·조직 역량과 포탈 관측값'},
    {'key': 'findings', 'title': '3. 발견 사항', 'kind': 'auto',
     'hint': '데이터가 먼저 말한 것'},
    {'key': 'cruxes', 'title': '4. 핵심 난제', 'kind': 'auto',
     'hint': '이 전략이 넘으려는 지점'},
    {'key': 'issues', 'title': '5. 이슈', 'kind': 'auto',
     'hint': '난제를 넘으려면 무엇을 해야 하는가'},
    {'key': 'swot', 'title': '6. 전략 요소 (SWOT)', 'kind': 'auto',
     'hint': '③ 분석'},
    {'key': 'solutions', 'title': '7. 솔루션 (TOWS)', 'kind': 'auto',
     'hint': '④ 솔루션과 AX-5R 게이트'},
    {'key': 'portfolio', 'title': '8. 무엇부터 하는가', 'kind': 'auto',
     'hint': '영향 × 실행가능성. **날짜가 아니라 순서입니다**'},
    {'key': 'kpi', 'title': '9. 지표 연결', 'kind': 'auto',
     'hint': '어느 지표를 움직이려 하는가. 뒤집어 보면 빈 지표가 드러납니다'},
    {'key': 'closing', 'title': '10. 맺음말', 'kind': 'manual',
     'hint': '검토 요청 사항이나 전제. 비워도 됩니다.'},
]

SECTION_KEYS = [s['key'] for s in SECTIONS]
MANUAL_KEYS = [s['key'] for s in SECTIONS if s['kind'] == 'manual']

TOWS_LABEL = {
    'SO': 'SO 강점으로 기회를', 'WO': 'WO 기회로 약점을',
    'ST': 'ST 강점으로 위협을', 'WT': 'WT 약점과 위협이 겹치는 곳',
}
KIND_LABEL = {'S': '강점', 'W': '약점', 'O': '기회', 'T': '위협'}
SEVERITY_LABEL = {'high': '높음', 'medium': '보통', 'info': '참고'}

# ④ 화면과 **같은 기준**이다. 두 곳에 두면 문서와 화면의 칸이 달라진다.
HIGH = 4
QUADRANTS = [
    ('먼저 한다', True, True), ('준비해서 한다', True, False),
    ('틈틈이', False, True), ('하지 않는다', False, False),
]


def _text(t):
    return {'type': 'text', 'text': t}


def _note(t):
    return {'type': 'note', 'text': t}


def _table(head, rows):
    return {'type': 'table', 'head': head, 'rows': rows}


def _list(items):
    return {'type': 'list', 'items': items}


def _levels_table(assessments, divisions, category):
    """사업부 × 차원의 「현재→목표」 표.

    ⚠️ **평균 내지 않는다.** 다섯 축을 평균하면 데이터 1·응용 5 가 3 이 되어
       "보통"으로 읽히는데, 그건 어느 쪽도 말해주지 않는다. 칸을 그대로 둔다.
    """
    spec = next(c for c in CATEGORIES if c['key'] == category)
    dims = spec['dimensions']
    by = {(a['division_id'], a['dimension']): a
          for a in assessments if a['category'] == category}

    rows = []
    for d in divisions:
        cells = []
        for dim in dims:
            a = by.get((d['id'], dim['key'])) or {}
            cur, tgt = a.get('current_level'), a.get('target_level')
            if cur is None and tgt is None:
                cells.append('—')          # 안 매긴 칸. 빈 문자열로 두면 0 처럼 읽힌다
            elif tgt is None:
                cells.append(str(cur))
            else:
                cells.append(f'{cur if cur is not None else "—"}→{tgt}')
        rows.append([d['name']] + cells)
    return _table(['사업부'] + [x['label'] for x in dims], rows)


def _diagnosis(payload, divisions):
    blocks = [
        _levels_table(payload['assessments'], divisions, CATEGORY_TECHNICAL),
        _note('기술 성숙도 — 「현재→목표」. — 는 아직 안 매긴 칸입니다.'),
        _levels_table(payload['assessments'], divisions, CATEGORY_ORGANIZATION),
        _note('조직 역량 — 무엇을 할 수 있는가가 아니라 얼마나 자리잡았는가입니다.'),
    ]

    if payload.get('metricsError'):
        blocks.append(_note(f"관측값을 읽지 못했습니다: {payload['metricsError']}"))
        return blocks

    # 관측은 지표가 열여덟 개라 다 싣지 않는다. 구조적 결함을 보는 넷만 낸다.
    keys = ['project_count', 'no_performance_rate', 'no_kpi_link_rate',
            'dept_concentration']
    labels = {m['key']: m['label'] for m in METRICS}
    by = {(m['division_id'], m['metric_key']): m for m in payload['metrics']}
    rows = []
    for d in divisions:
        cells = []
        for k in keys:
            v = (by.get((d['id'], k)) or {}).get('value')
            cells.append('—' if v is None else str(v))
        rows.append([d['name']] + cells)
    blocks.append(_table(['사업부'] + [labels.get(k, k) for k in keys], rows))
    blocks.append(_note('포탈 데이터에서 계산한 값입니다. 사람이 매기지 않습니다.'))
    if payload.get('metricsMode') == 'fixture':
        blocks.append(_note('⚠️ 합성 데이터로 계산한 값입니다. 실제가 아닙니다.'))
    return blocks


def _findings(payload):
    """규칙별로 묶는다.

    ⚠️ 한 사이클을 돌려 보니 서른다섯 줄 중 다섯 줄이 사업부만 다르고 문장이
       거의 같았다(「DA 과제 22건(100%)이…」 「MX 과제 60건(100%)이…」).
       종이에서는 접을 수 없으니 **묶고 건수를 적는다** — 읽는 사람이 규칙
       단위로 보게 된다.

    ⚠️ 한 건짜리는 안 묶는다. 「전략에 안 걸린 과제 1건」이라는 머리글은
       그 아래 한 줄을 반복할 뿐이다.
    """
    findings = payload.get('findings') or []
    if not findings:
        return []

    grouped = {}
    for f in findings:
        grouped.setdefault(f.get('rule') or f.get('key', ''), []).append(f)

    def item(f):
        return {
            'title': f['title'],
            'detail': f.get('detail'),
            'tag': ' · '.join(x for x in
                              [SEVERITY_LABEL.get(f.get('severity'), ''),
                               f.get('division_name')] if x),
        }

    blocks, singles = [], []
    for rule, rows in grouped.items():
        if len(rows) < 2:
            singles.extend(rows)
            continue
        label = rows[0].get('ruleLabel') or rule
        blocks.append(_text(f'{label} · {len(rows)}건'))
        blocks.append(_list([item(f) for f in rows]))

    if singles:
        if blocks:
            blocks.append(_text('그 밖에'))
        blocks.append(_list([item(f) for f in singles]))
    return blocks


def _cruxes(payload, names):
    cruxes = payload.get('cruxes') or []
    if not cruxes:
        return []
    issues = payload.get('issues') or []
    counts = {}
    for i in issues:
        if i.get('crux_id') and i.get('status') != 'dropped':
            counts[i['crux_id']] = counts.get(i['crux_id'], 0) + 1

    items = []
    for c in cruxes:
        n = counts.get(c['id'], 0)
        items.append({
            'title': c['title'],
            'detail': c.get('rationale'),          # 난제는 rationale 이다
            # ⚠️ 할 일이 없는 난제를 조용히 넘기지 않는다. 넘겠다고 적어 놓고
            #    아무것도 안 하는 것이 문서에 그대로 보여야 검토가 된다.
            'tag': f'이슈 {n}건' if n else '이슈 없음',
        })
    return [_list(items)]


def _issues(payload, names):
    live = [i for i in (payload.get('issues') or []) if i.get('status') != 'dropped']
    dropped = [i for i in (payload.get('issues') or []) if i.get('status') == 'dropped']
    if not live and not dropped:
        return []

    by_crux = {c['id']: c for c in payload.get('cruxes') or []}
    blocks = []
    for crux_id, crux in by_crux.items():
        mine = [i for i in live if i.get('crux_id') == crux_id]
        if not mine:
            continue
        blocks.append(_text(crux['title']))
        blocks.append(_list([{'title': i['title'], 'detail': i.get('description'),
                              'tag': names.get(i.get('division_id'))} for i in mine]))

    orphans = [i for i in live if not i.get('crux_id')]
    if orphans:
        blocks.append(_text('난제에 안 걸린 이슈'))
        blocks.append(_list([{'title': i['title'], 'detail': i.get('description'),
                              'tag': names.get(i.get('division_id'))} for i in orphans]))
        blocks.append(_note('어느 난제를 넘기 위한 것인지 아직 정하지 않았습니다.'))

    if dropped:
        # 안 하기로 한 것도 판단이다. 빼면 내년에 같은 것을 다시 검토한다.
        blocks.append(_text('올해는 안 하기로 한 것'))
        blocks.append(_list([{'title': i['title'], 'detail': i.get('description')}
                             for i in dropped]))
    return blocks


def _swot(payload, names):
    elements = payload.get('elements') or []
    if not elements:
        return []
    blocks = []
    for kind in ('S', 'W', 'O', 'T'):
        mine = [e for e in elements if e['kind'] == kind]
        blocks.append(_text(f'{kind} {KIND_LABEL[kind]} ({len(mine)}건)'))
        if mine:
            blocks.append(_list([{'title': e['title'], 'detail': e.get('detail'),
                                  'tag': names.get(e.get('division_id'))} for e in mine]))
        else:
            blocks.append(_note('없습니다.'))
    return blocks


def _solutions(payload):
    solutions = payload.get('solutions') or []
    if not solutions:
        return []
    elements = {e['id']: e for e in payload.get('elements') or []}
    blocks = []
    for tows, label in TOWS_LABEL.items():
        mine = [s for s in solutions if s['tows'] == tows]
        if not mine:
            continue
        blocks.append(_text(label))
        items = []
        for s in mine:
            basis = [elements[i]['title'] for i in (s.get('element_ids') or [])
                     if i in elements]
            answered = sum(1 for g in GATES if (s.get('gates') or {}).get(g['key']))
            detail = s.get('detail') or ''
            if basis:
                detail = (detail + '\n' if detail else '') + '근거: ' + ' · '.join(basis)
            items.append({
                'title': s['title'], 'detail': detail or None,
                'tag': f'AX-5R {answered}/{len(GATES)}',
            })
        blocks.append(_list(items))

    short = [s for s in solutions
             if sum(1 for g in GATES if (s.get('gates') or {}).get(g['key'])) < len(GATES)]
    if short:
        blocks.append(_note(
            f'다섯 질문({" · ".join(g["label"] for g in GATES)})에 다 답하지 않은 '
            f'솔루션이 {len(short)}건 있습니다. 실행 단계에서 막히는 자리가 대개 '
            f'여기입니다.'))
    return blocks


def _portfolio(payload):
    solutions = payload.get('solutions') or []
    if not solutions:
        return []
    scored = [s for s in solutions
              if s.get('impact') is not None and s.get('feasibility') is not None]
    unscored = [s for s in solutions if s not in scored]

    blocks = [_note('영향 × 실행가능성으로 나눈 순서입니다. **날짜가 아닙니다** — '
                    '일정은 이 문서가 만들어 낼 수 있는 것이 아닙니다.')]
    for name, want_impact, want_easy in QUADRANTS:
        mine = [s for s in scored
                if (s['impact'] >= HIGH) == want_impact
                and (s['feasibility'] >= HIGH) == want_easy]
        if not mine:
            continue
        blocks.append(_text(name))
        blocks.append(_list([{
            'title': s['title'], 'tag': f"{s['tows']} · 영향 {s['impact']} × 실행 {s['feasibility']}",
        } for s in mine]))

    if unscored:
        # ⚠️ 안 매긴 것을 낮은 점수로 밀어 넣지 않는다. 그러면 아직 판단하지 않은
        #    솔루션이 '하지 않는다' 칸에서 조용히 사라진다.
        blocks.append(_text('아직 안 매긴 것'))
        blocks.append(_list([{'title': s['title'], 'tag': s['tows']} for s in unscored]))
        blocks.append(_note('안 매긴 것은 낮은 점수가 아닙니다. 근거가 없어 '
                            '비워 둔 것입니다.'))
    return blocks


def _summary(payload, names, empty_titles):
    """첫 장. **본문에서 뽑을 뿐 새로 판단하지 않는다.**

    ⚠️ 「아직 비어 있음」을 여기에 싣는 것은 문서로는 불편하지만, 그게 이 모듈이
       지켜 온 것이다. 첫 장에 안 적으면 읽는 사람은 그 장이 비었다는 사실을
       열 장 뒤에서야 알거나, 끝내 모른다.
    """
    blocks = []

    cruxes = payload.get('cruxes') or []
    counts = {}
    for i in (payload.get('issues') or []):
        if i.get('crux_id') and i.get('status') != 'dropped':
            counts[i['crux_id']] = counts.get(i['crux_id'], 0) + 1
    if cruxes:
        blocks.append(_text('넘으려는 것'))
        blocks.append(_list([{
            'title': c['title'],
            'tag': f"이슈 {counts.get(c['id'], 0)}건" if counts.get(c['id'])
                   else '이슈 없음',
        } for c in cruxes]))

    # 「먼저 한다」 칸. 사분면과 **같은 기준**을 쓴다 — 두 곳에 두면 갈라진다.
    now = [x for x in (payload.get('solutions') or [])
           if (x.get('impact') or 0) >= HIGH and (x.get('feasibility') or 0) >= HIGH]
    if now:
        blocks.append(_text('먼저 할 일'))
        blocks.append(_list([{
            'title': x['title'],
            'tag': f"{x['tows']} · 영향 {x['impact']} × 실행 {x['feasibility']}"
                   + (f" · 과제 {len(x.get('project_uuids') or [])}건"
                      if x.get('project_uuids') else ' · 과제 없음'),
        } for x in now]))

    if empty_titles:
        blocks.append(_text('아직 비어 있음'))
        blocks.append(_note(' · '.join(empty_titles)
                            + ' — 검토하지 않은 것인지, 올해는 안 보기로 한 것인지'
                              ' 이 문서만으로는 알 수 없습니다.'))
    return blocks


def _kpi(payload, kpis):
    solutions = payload.get('solutions') or []
    if not kpis:
        return []
    by_kpi = {}
    for s in solutions:
        for kid in (s.get('kpi_ids') or []):
            by_kpi.setdefault(kid, []).append(s['title'])

    linked = [k for k in kpis if by_kpi.get(k['id'])]
    if linked:
        rows = [[k['label'], str(len(by_kpi[k['id']])), ' · '.join(by_kpi[k['id']])]
                for k in linked]
        blocks = [_table(['지표', '솔루션', '무엇으로'], rows)]
    else:
        blocks = []

    # 뒤집어 본다. **이쪽이 더 중요하다** — 아무도 겨누지 않는 지표가 드러난다.
    empty = [k['label'] for k in kpis if not by_kpi.get(k['id'])]
    if empty:
        blocks.append(_note(
            f'이 전략의 어느 솔루션도 겨누지 않는 지표가 {len(empty)}개 있습니다: '
            + ' · '.join(empty)
            + '. 올해 안 건드리기로 한 것인지, 빠뜨린 것인지는 사람이 답해야 합니다.'))
    return blocks


# ⚠️ 사업부 이름은 모델에 없다. 화면이 divisions 로 풀어 쓰듯 여기서도 푼다 —
#    id 를 그대로 적으면 문서에 「사업부 18」 같은 것이 박힌다.
BUILDERS = {
    # summary 는 여기 없다. **다른 장이 다 조립된 뒤에야** 무엇이 비었는지
    # 알 수 있어서, assemble() 이 두 번째 바퀴에서 채운다.
    'diagnosis': lambda p, d, n, k: _diagnosis(p, d),
    'findings': lambda p, d, n, k: _findings(p),
    'cruxes': lambda p, d, n, k: _cruxes(p, n),
    'issues': lambda p, d, n, k: _issues(p, n),
    'swot': lambda p, d, n, k: _swot(p, n),
    'solutions': lambda p, d, n, k: _solutions(p),
    'portfolio': lambda p, d, n, k: _portfolio(p),
    'kpi': lambda p, d, n, k: _kpi(p, k),
}


def assemble(payload, divisions, kpis, config=None):
    """기획서 한 벌을 조립한다.

    config 는 사람이 정한 것 — {key: {'included': bool, 'text': str}}.
    포함하지 않기로 한 구간도 **목록에는 남긴다**(included=False). 목차에서
    사라지면 왜 빠졌는지 다음 사람이 알 수 없다.
    """
    config = config or {}
    names = {d['id']: d['name'] for d in divisions}
    out = []
    for spec in SECTIONS:
        conf = config.get(spec['key']) or {}
        included = conf.get('included', True)
        if spec['key'] == 'summary':
            blocks = []                       # 아래 두 번째 바퀴에서 채운다
        elif spec['kind'] == 'manual':
            text = (conf.get('text') or '').strip()
            blocks = [_text(text)] if text else []
        else:
            blocks = BUILDERS[spec['key']](payload, divisions, names, kpis)

        out.append({
            **spec,
            'included': included,
            # ⚠️ 비었다는 사실 자체가 정보다. 장을 없애면 읽는 사람은 그 장이
            #    없다는 것도 모른 채 "검토했겠거니" 한다.
            'empty': not blocks,
            'blocks': blocks,
        })

    # ── 두 번째 바퀴 ──────────────────────────────────────────────────
    #
    # ⚠️ 요약은 **다른 장이 다 조립된 뒤에야** 쓸 수 있다. 무엇이 비었는지가
    #    요약의 내용이라, 한 바퀴로는 자기 자신을 세는 셈이 된다.
    empty_titles = [x['title'] for x in out
                    if x['included'] and x['empty'] and x['key'] != 'summary']
    head = next(x for x in out if x['key'] == 'summary')
    head['blocks'] = _summary(payload, names, empty_titles)
    head['empty'] = not head['blocks']
    return out


def summarize(sections):
    """무엇이 비었는지. 화면이 한 줄로 보여준다."""
    empty = [s['title'] for s in sections if s['included'] and s['empty']]
    return {
        'total': len(sections),
        'included': sum(1 for s in sections if s['included']),
        'emptyTitles': empty,
    }
