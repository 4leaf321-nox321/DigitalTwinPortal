# -*- coding: utf-8 -*-
"""일괄 입력 — 「추출」과 같은 머리글의 표를 붙여넣어 한 번에 세운다(2026-08-30).

왜 있나
    처음 세팅할 때 시스템·조직·시험 항목·시뮬레이션을 화면에서 하나씩 만들면 몇 시간이 간다.
    엑셀로 쓰는 사람이 많으니, **추출한 판을 그대로 채워 돌려주는 길**을 연다.

무엇이 되나 (부문에 따라 고른다)
    대상 · 수단 · 연계 · (디지털 스레드) 시스템 · 조직 · 구간

무엇이 안 되나
    **평가는 여기서 안 받는다.** 평가는 근거가 필수이고 이력이 남는 자리라, 표로 쓸어 넣으면
    근거 없는 칸이 무더기로 생긴다. 대상·수단을 세운 뒤 화면에서 매긴다.

규칙
    · 이름이 같으면 **다시 만들지 않는다**(가져오기와 같은 규칙 — 여러 번 올려도 같다).
    · 미리보기는 **아무것도 저장하지 않는다.** 오류 줄도 그대로 돌려준다 — 빼면 몇 번째 줄이
      틀렸는지 알 수 없다.
    · 한 줄이라도 틀리면 그 줄만 건너뛴다. 나머지는 들어간다.
"""
from . import definitions as D
from . import services as S
from .importer import TableFormatError, _read_rows, norm
from .models import MaturityAgent, MaturityPair, MaturitySubject


# 종류마다 — 머리글(추출과 같은 말), 필수 열, 만드는 법.
def kinds_for(sector, division_id=None):
    """그 부문에서 고를 수 있는 종류와 **열마다 고를 수 있는 값**.

    화면은 이걸로 표를 그린다 — 값이 정해진 열은 드롭다운이 되고, 엑셀에서 붙여넣은 값이
    그 목록에 있으면 골라지고 없으면 「못 찾음」으로 남는다. 무엇을 쓸 수 있는지 화면이
    말해 주지 않으면 사람이 글자를 추측해서 적게 된다(2026-08-30).
    """
    sec = D.sector_of(sector)
    subject_label = sec.get('subject_label') or '대상'
    agent_label = sec.get('agent_label') or '수단'
    out = []
    if sector == 'digital_thread':
        out.append({'key': 'system', 'label': '시스템', 'columns': ['시스템', '종류', '주관 조직', '생애 단계', '연계 수단', '상태', '메모'],
                    'required': ['시스템'], 'hint': '전사 하나의 사전입니다. 이름이 같으면 다시 만들지 않습니다.'})
        out.append({'key': 'org', 'label': '조직', 'columns': ['조직'], 'required': ['조직'],
                    'hint': '이 사업부의 조직입니다. 「그룹명(사업부)」 꼴로 적으면 화면과 같아집니다.'})
        out.append({'key': 'segment', 'label': subject_label,
                    'columns': ['스레드', '구간', '출발 조직', '출발 시스템', '매개 시스템', '도착 조직', '도착 시스템', '데이터 종류'],
                    'required': ['스레드', '구간'],
                    'hint': '조직·시스템은 **이름으로 찾습니다** — 없으면 그 줄이 오류입니다. 시스템·조직을 먼저 올리세요.'})
        return _with_choices(out, sector, division_id)      # ⚠️ 여기서도 선택지를 붙인다 — 빼먹으면 드롭다운이 안 뜬다
    out.append({'key': 'subject', 'label': subject_label,
                # ⚠️ 「공정 단계」다 — 모니터링은 대상의 이름표가 「공정」이라 그냥 「공정」이면
                #    머리글이 겹쳐 **이름 칸이 공정 단계로 읽힌다**(2026-08-30 실측).
                'columns': (['사업부', subject_label, '라인·사업장', '공정 단계', '세부'] if sector == 'manufacturing_monitoring'
                            else ['사업부', subject_label, '세부', '제품군']),
                'required': [subject_label],
                'hint': '「전체」로 열었으면 사업부 열이 필요합니다. 제품군·데이터는 · 로 나눠 적습니다.'})
    if sec.get('has_agent'):
        out.append({'key': 'agent', 'label': agent_label,
                    'columns': (['사업부', agent_label, '수단 종류', '담당 부서'] if sector == 'manufacturing_monitoring'
                                else ['사업부', agent_label, '종류', '모델 종류', '사용 툴', '불량 유형', '담당 부서']),
                    'required': [agent_label], 'hint': '도구·불량 유형은 · 로 나눠 적습니다.'})
        out.append({'key': 'pair', 'label': '연계',
                    'columns': ['사업부', subject_label, agent_label], 'required': [subject_label, agent_label],
                    'hint': '이름으로 찾아 잇습니다 — 없는 이름이면 그 줄이 오류입니다. 대상·수단을 먼저 올리세요.'})
    return _with_choices(out, sector, division_id)


def _with_choices(kinds, sector, division_id):
    for k in kinds:
        k['choices'] = _choices(sector, k['key'], division_id)
    return kinds


def _labels(items):
    return [x['label'] for x in items]


def _choices(sector, kind, division_id):
    """열 이름 → 고를 수 있는 값. 목록이 없는 열(이름·메모)은 안 넣는다 — 그건 그냥 적는 칸이다.

    사업부·조직·시스템처럼 **자료에서 오는 목록**은 사업부를 골라야 채워진다.
    """
    from . import threads as T
    out = {}
    div = division_id if isinstance(division_id, int) else None
    if kind == 'system':
        out['종류'] = _labels(D.vocab('system_kinds'))
        out['생애 단계'] = _labels(D.vocab('thread_stages'))          # 여럿 — 화면이 · 로 잇는다
        out['연계 수단'] = _labels(D.vocab('link_means'))
        out['상태'] = _labels(D.vocab('system_status'))
    elif kind == 'segment':
        out['스레드'] = [t['name'] for t in T.list_threads()]
        out['구간'] = [sd['name'] for t in T.list_threads() for sd in t['segments']]
        systems = [x['name'] for x in T.list_systems()]
        orgs = [o['name'] for o in T.list_orgs(div)] if div else []
        out['출발 조직'] = orgs
        out['도착 조직'] = orgs
        out['출발 시스템'] = systems
        out['매개 시스템'] = systems
        out['도착 시스템'] = systems
        out['데이터 종류'] = _labels(D.vocab('data_kinds'))
    elif kind == 'org':
        return {}                    # 조직은 이름 한 칸뿐 — 고를 것이 없다
    else:
        from app.modules.digital_twin_dashboard.models import Division
        hidden = D.get_hidden_divisions()
        out['사업부'] = [d.name for d in Division.query.filter_by(is_active=True).order_by(Division.order, Division.id).all()
                       if d.id not in hidden]
        if kind == 'subject' and sector == 'manufacturing_monitoring':
            out['공정 단계'] = _labels(D.vocab('process_steps'))
        if kind == 'agent':
            # ⚠️ 모니터링의 수단 표에는 「모델 종류」 열이 없다(「수단 종류」다) — 없는 열에
            #    선택지를 붙이면 화면은 그릴 데가 없고, AI 는 있는 줄 알고 적는다(2026-08-30).
            if sector != 'manufacturing_monitoring':
                out['모델 종류'] = _labels(D.vocab('model_kinds'))
            if div:
                out['담당 부서'] = [x['name'] for x in S.departments_of(div)]
        if kind == 'pair' and div:
            sec = D.SECTOR_BY_KEY[sector]
            out[sec['subject_label']] = [r.name for r in MaturitySubject.query
                                         .filter_by(division_id=div, sector=sector).order_by(MaturitySubject.order, MaturitySubject.id).all()]
            out[sec['agent_label']] = [r.name for r in MaturityAgent.query
                                       .filter_by(division_id=div, sector=sector).order_by(MaturityAgent.name).all()]
    return {k: v for k, v in out.items() if v}


def _spec(sector, kind):
    for k in kinds_for(sector):        # 넣을 때는 선택지가 필요 없다 — 이름만 맞으면 된다
        if k['key'] == kind:
            return k
    raise TableFormatError('이 부문에 없는 종류입니다.')


def _map_header(header, spec):
    by = {norm(c): c for c in spec['columns']}
    mapping = {}
    for i, h in enumerate(header):
        col = by.get(norm(h))
        if col and col not in mapping:
            mapping[col] = i
    missing = [c for c in spec['required'] if c not in mapping]
    if missing:
        raise TableFormatError(f'머리글에 {" · ".join(missing)} 열이 없습니다 — 추출한 판의 머리글을 그대로 쓰세요.')
    return mapping


def _split(v):
    """한 칸에 여럿 — 「LS-DYNA · HyperMesh」. 쉼표로 적어도 받는다."""
    if not v:
        return []
    parts = [p.strip() for p in v.replace(',', '·').split('·')]
    return [p for p in parts if p]


def _label_key(items, text, what):
    """라벨(또는 key)로 코드 값을 찾는다. 빈 칸이면 None."""
    if not text:
        return None
    n = norm(text)
    for it in items:
        if norm(it['label']) == n or norm(it['key']) == n:
            return it['key']
    raise TableFormatError(f'{what} 「{text}」 을(를) 모르겠습니다.')


def run(division_id, sector, kind, text, actor, dry_run=True):
    """미리보기(dry_run=True)와 넣기(False)가 **같은 길**을 간다 — 미리보기에서 통과한 줄은 들어간다."""
    from app.extensions import db
    from . import threads as T

    spec = _spec(sector, kind)
    rows = _read_rows(text)
    if not rows:
        raise TableFormatError('붙여넣은 표가 비어 있습니다.')
    mapping = _map_header(rows[0][1], spec)
    body = rows[1:]
    if not body:
        raise TableFormatError('머리글만 있고 줄이 없습니다.')

    def cell(cells, col):
        i = mapping.get(col)
        return (cells[i].strip() if i is not None and i < len(cells) else '')

    out, made, reused, errors = [], 0, 0, 0
    for (line, cells) in body:
        try:
            status, what = _one(division_id, sector, kind, spec, cell, cells, actor, dry_run, T)
            if status == 'new':
                made += 1
            else:
                reused += 1
            out.append({'line': line, 'status': status, 'name': what})
        except Exception as e:                                  # noqa: BLE001 — 줄마다 이유를 남긴다
            errors += 1
            out.append({'line': line, 'status': 'error', 'name': cell(cells, spec['required'][0]),
                        'message': str(e) if isinstance(e, (TableFormatError, S.Refused)) else '넣지 못했습니다.'})
    if dry_run:
        db.session.rollback()
    else:
        db.session.commit()
    return {'kind': kind, 'summary': {'rows': len(body), 'new': made, 'exists': reused, 'errors': errors}, 'rows': out}


def _one(division_id, sector, kind, spec, cell, cells, actor, dry_run, T):
    """한 줄. 만들었으면 'new', 이미 있으면 'exists'. 오류는 올린다."""
    sec = D.SECTOR_BY_KEY[sector]
    subject_label = sec.get('subject_label') or '대상'
    agent_label = sec.get('agent_label') or '수단'

    if kind == 'system':
        name = cell(cells, '시스템')
        if not name:
            raise TableFormatError('시스템 이름이 없습니다.')
        row = next((s for s in T.list_systems() if norm(s['name']) == norm(name)), None)
        if row:
            return 'exists', name
        T.create_system({
            'name': name, 'kind': _label_key(D.vocab('system_kinds'), cell(cells, '종류'), '시스템 종류') or 'other',
            'owner_org': cell(cells, '주관 조직') or None,
            'stages': [_label_key(D.vocab('thread_stages'), s, '생애 단계') for s in _split(cell(cells, '생애 단계'))],
            'link_means': _label_key(D.vocab('link_means'), cell(cells, '연계 수단'), '연계 수단') or 'unknown',
            'status': _label_key(D.vocab('system_status'), cell(cells, '상태'), '상태') or 'active',
            'note': cell(cells, '메모') or None,
        }, division_id if isinstance(division_id, int) else None)
        return 'new', name

    if kind == 'org':
        name = cell(cells, '조직')
        if not name:
            raise TableFormatError('조직 이름이 없습니다.')
        div = _division_or_refuse(division_id)
        if any(norm(o['name']) == norm(name) for o in T.list_orgs(div)):
            return 'exists', name
        T.create_org({'name': name}, div)
        return 'new', name

    if kind == 'segment':
        return _segment(division_id, cell, cells, T)

    # ── 대상 · 수단 · 연계 ────────────────────────────────────────────────
    div = _row_division(division_id, cell(cells, '사업부'))
    if kind == 'subject':
        name = cell(cells, subject_label)
        if not name:
            raise TableFormatError(f'{subject_label} 이름이 없습니다.')
        row = MaturitySubject.query.filter_by(division_id=div, sector=sector).all()
        if any(norm(r.name) == norm(name) for r in row):
            return 'exists', name
        S.create_subject(div, sector, name, cell(cells, '세부'), _split(cell(cells, '제품군')),
                         'auto', None, cell(cells, '라인·사업장'),
                         _label_key(D.vocab('process_steps'), cell(cells, '공정 단계'), '공정 단계')
                         if cell(cells, '공정 단계') else None)
        return 'new', name

    if kind == 'agent':
        name = cell(cells, agent_label)
        if not name:
            raise TableFormatError(f'{agent_label} 이름이 없습니다.')
        if any(norm(r.name) == norm(name) for r in MaturityAgent.query.filter_by(division_id=div, sector=sector).all()):
            return 'exists', name
        dept = cell(cells, '담당 부서')
        dept_id = next((d['id'] for d in S.departments_of(div) if norm(d['name']) == norm(dept)), None) if dept else None
        if dept and dept_id is None:
            raise TableFormatError(f'담당 부서 「{dept}」 을(를) 이 사업부에서 못 찾았습니다.')
        S.create_agent(div, sector, name, cell(cells, '종류') or cell(cells, '수단 종류'),
                       _label_key(D.vocab('model_kinds'), cell(cells, '모델 종류'), '모델 종류') if cell(cells, '모델 종류') else None,
                       None, _split(cell(cells, '사용 툴')), dept_id, _split(cell(cells, '불량 유형')))
        return 'new', name

    if kind == 'pair':
        sname, aname = cell(cells, subject_label), cell(cells, agent_label)
        subject = next((r for r in MaturitySubject.query.filter_by(division_id=div, sector=sector).all() if norm(r.name) == norm(sname)), None)
        agent = next((r for r in MaturityAgent.query.filter_by(division_id=div, sector=sector).all() if norm(r.name) == norm(aname)), None)
        if subject is None:
            raise TableFormatError(f'{subject_label} 「{sname}」 을(를) 못 찾았습니다 — 먼저 올리세요.')
        if agent is None:
            raise TableFormatError(f'{agent_label} 「{aname}」 을(를) 못 찾았습니다 — 먼저 올리세요.')
        if MaturityPair.query.filter_by(subject_id=subject.id, agent_id=agent.id).first():
            return 'exists', f'{sname} × {aname}'
        S.create_pair(subject, agent)
        return 'new', f'{sname} × {aname}'

    raise TableFormatError('이 부문에 없는 종류입니다.')


def _segment(division_id, cell, cells, T):
    """구간 — 스레드·표준 구간·조직·시스템을 **이름으로 찾는다.** 없으면 그 줄이 오류다."""
    div = _division_or_refuse(division_id)
    tname, sname = cell(cells, '스레드'), cell(cells, '구간')
    thread = next((t for t in T.list_threads() if norm(t['name']) == norm(tname) or norm(t['key']) == norm(tname)), None)
    if thread is None:
        raise TableFormatError(f'스레드 「{tname}」 을(를) 못 찾았습니다.')
    if any(norm(s['name']) == norm(sname) for s in T.list_segments(div)):
        return 'exists', sname
    sd = next((s for s in thread['segments'] if norm(s['name']) == norm(sname)), None)
    orgs = {norm(o['name']): o['id'] for o in T.list_orgs(div)}
    systems = {norm(s['name']): s['id'] for s in T.list_systems()}

    def pick(table, col, what):
        v = cell(cells, col)
        if not v:
            return None
        if norm(v) not in table:
            raise TableFormatError(f'{what} 「{v}」 을(를) 못 찾았습니다 — 먼저 올리세요.')
        return table[norm(v)]

    T.create_segment(div, {
        'thread_id': thread['id'], 'segment_def_id': sd['id'] if sd else None, 'name': None if sd else sname,
        'from_org_id': pick(orgs, '출발 조직', '조직'), 'from_system_id': pick(systems, '출발 시스템', '시스템'),
        'via_system_id': pick(systems, '매개 시스템', '시스템'),
        'to_org_id': pick(orgs, '도착 조직', '조직'), 'to_system_id': pick(systems, '도착 시스템', '시스템'),
        'data_kinds': _split(cell(cells, '데이터 종류')),
    })
    return 'new', sname


def _division_or_refuse(division_id):
    if not isinstance(division_id, int):
        raise TableFormatError('사업부를 하나 고르고 올리세요 — 「전체」에서는 이 종류를 못 넣습니다.')
    return division_id


def _row_division(division_id, text):
    """사업부 — 하나를 골라 열었으면 그것, 「전체」면 줄의 사업부 열을 본다."""
    if isinstance(division_id, int):
        return division_id
    if not text:
        raise TableFormatError('「전체」로 열었으면 줄마다 사업부가 필요합니다.')
    from app.modules.digital_twin_dashboard.models import Division
    row = next((d for d in Division.query.filter_by(is_active=True).all() if norm(d.name) == norm(text)), None)
    if row is None:
        raise TableFormatError(f'사업부 「{text}」 을(를) 못 찾았습니다.')
    return row.id
