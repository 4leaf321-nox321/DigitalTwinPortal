# -*- coding: utf-8 -*-
"""가져오기 — 처음 채우기와 정확도 채우기가 **같은 틀**을 쓴다. (PLAN.md 6절)

    ① 틀 내려받기   로드맵에서 그 사업부의 시험 항목·연결 과제를 뽑아 틀(CSV)로
    ② 사람이 손보기  과제 단위로 묶인 것을 시뮬레이션 단위로 쪼개고 이름을 맞춤
    ③ 미리보기       못 맞춘 줄·겹친 줄·다른 사업부 줄을 먼저 센다. 저장 안 함
    ④ 넣기           오류 없는 줄만. 이름이 같으면 있는 것을 쓴다 — 여러 번 넣어도 같다

⚠️ **동기화가 아니다.** 한 번 뽑아 넣고 그 뒤 이 모듈이 정본이다. 로드맵과 자동으로
   맞추지 않는다 — 대신 어긋남을 세는 칸(reconcile)이 있다.

⚠️ 표는 설문 가져오기와 같은 규칙으로 읽는다 — 탭이 하나라도 있으면 탭(엑셀
   붙여넣기), 없으면 쉼표. csv 모듈을 쓰므로 따옴표 안의 구분자는 구분자가 아니다.

⚠️ 오류난 줄도 목록에 남긴다. 빼고 돌려주면 「왜 이 줄이 사라졌지」가 된다.
"""
import csv
import io
import re
from datetime import datetime

from app.extensions import db

from . import definitions as D
from . import services as S
from .models import MaturityAgent, MaturityPair, MaturitySubject

SECTOR = 'simulation'


class TableFormatError(Exception):
    """표 구조가 깨져 행 단위로 말할 수 없다."""


# ── 이름 맞추기 ──────────────────────────────────────────────────────────────

def norm(s):
    """이름 비교의 규칙 하나 — 앞뒤 공백·연속 공백·대소문자를 무시한다."""
    return re.sub(r'\s+', ' ', (s or '').strip()).lower()


def _model_kind_by_label():
    """기준 정보에서 고칠 수 있으므로 **부를 때마다** 짠다(불러올 때 한 번이 아니라)."""
    by = {m['label']: m['key'] for m in D.vocab('model_kinds')}
    by.update({m['key']: m['key'] for m in D.vocab('model_kinds')})
    return by

_UUID_RE = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)


# ── ① 틀 ───────────────────────────────────────────────────────────────────

def template_rows(division_id):
    """로드맵에서 뽑는다. 시험 항목 × 연결 과제 한 줄씩. 연결이 없으면 수단 빈 줄 하나.

    ⚠️ 로드맵의 연결 과제는 **과제 단위**라 시뮬레이션보다 굵다. 그래서 이건
       출발점이지 답이 아니다 — 사람이 쪼개서 올린다(②).
    ⚠️ 로드맵의 projectId 는 레거시 id 와 uuid 가 섞여 있다. uuid 모양인 것만
       과제 uuid 칸에 넣고, 나머지는 비운다 — 틀린 참고 링크는 없는 것보다 나쁘다.
    """
    from app.modules.digital_twin_dashboard.models import Division
    from app.modules.digital_twin_reference.models import DtReferenceTask

    division = Division.query.get(int(division_id))
    name = division.name if division else ''
    tasks = (DtReferenceTask.query
             .filter(DtReferenceTask.division_id == str(division_id))
             .order_by(DtReferenceTask.order, DtReferenceTask.id).all())
    rows = []
    for t in tasks:
        subject = (t.test_item or '').strip()
        if not subject:
            continue
        links = [c for c in (t.connected_dt_task or []) if isinstance(c, dict)] or [None]
        for c in links:
            pid = str((c or {}).get('projectId') or '')
            rows.append({
                'division': name,
                'subject': subject,
                'subject_detail': (t.test_item_detail or '').strip(),
                'product_families': ', '.join(t.product_family or []),
                'agent': ((c or {}).get('projectName') or '').strip(),
                'model_kind': '',
                'accuracy': '',
                'roadmap_task_id': t.id,
                'project_uuid': pid if _UUID_RE.match(pid) else '',
            })
    return rows


def render_csv(rows):
    """UTF-8 BOM CSV — 엑셀이 한글을 제대로 연다."""
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([c['label'] for c in D.IMPORT_COLUMNS])
    for r in rows:
        w.writerow([r.get(c['key'], '') for c in D.IMPORT_COLUMNS])
    return '﻿' + buf.getvalue()


# ── ③ 읽기 · 미리보기 ─────────────────────────────────────────────────────

def _read_rows(text):
    if text.count('"') % 2:
        raise TableFormatError('따옴표(")가 안 닫힌 곳이 있습니다. 표를 다시 복사해 주세요.')
    delimiter = '\t' if '\t' in text else ','
    reader = csv.reader(io.StringIO(text.lstrip('﻿')), delimiter=delimiter)
    out, line = [], 0
    for cells in reader:
        line += 1
        if not any((c or '').strip() for c in cells):
            continue
        out.append((line, [(c or '').strip() for c in cells]))
    return out


def _header_map(header):
    """머리글 → 열 key. 라벨(사업부·시험 항목…)과 key(division·subject…) 둘 다 받는다."""
    by = {}
    for c in D.IMPORT_COLUMNS:
        by[norm(c['label'])] = c['key']
        by[norm(c['key'])] = c['key']
    mapping = {}
    for i, h in enumerate(header):
        key = by.get(norm(h))
        if key and key not in mapping.values():
            mapping[key] = i
    missing = [c['label'] for c in D.IMPORT_COLUMNS if c['required'] and c['key'] not in mapping]
    if missing:
        raise TableFormatError(
            f'머리글에 {" · ".join(missing)} 열이 없습니다. 틀을 내려받아 그 머리글로 올려 주세요.')
    return mapping


def parse_table(text, division_id):
    """표 → 줄 목록(+오류). **저장하지 않는다.**

    사업부 칸은 요청한 사업부와 같아야 한다 — 다른 사업부 줄이 섞여 들어오는 것을
    막는다(비어 있으면 요청한 사업부로 본다).
    """
    from app.modules.digital_twin_dashboard.models import Division

    raw = _read_rows(text or '')
    if not raw:
        raise TableFormatError('읽을 줄이 없습니다.')
    header_line, header = raw[0]
    mapping = _header_map(header)
    division = Division.query.get(int(division_id))
    div_name = division.name if division else ''

    rows, seen = [], {}
    for line, cells in raw[1:]:
        get = lambda k: cells[mapping[k]] if k in mapping and mapping[k] < len(cells) else ''
        errors = []
        r = {
            'line': line,
            'division': get('division') or div_name,
            'subject': get('subject'),
            'subject_detail': get('subject_detail'),
            'product_families': S._clean_list(get('product_families')),
            'agent': get('agent'),
            'model_kind': None,
            'accuracy': None,
            'roadmap_task_id': None,
            'project_uuid': get('project_uuid') or None,
        }
        if norm(r['division']) != norm(div_name):
            errors.append(f'사업부가 「{r["division"]}」입니다 — 이 가져오기는 {div_name} 것만 넣습니다.')
        if not r['subject']:
            errors.append('시험 항목이 비었습니다.')
        if not r['agent']:
            errors.append('시뮬레이션이 비었습니다. 로드맵의 과제를 시뮬레이션 단위로 쪼개 적으세요.')
        mk = get('model_kind')
        if mk:
            by = _model_kind_by_label()
            r['model_kind'] = by.get(mk.strip()) or by.get(norm(mk))
            if r['model_kind'] is None:
                errors.append('모델 종류는 물리 기반 · 데이터 기반 · 하이브리드 중 하나입니다.')
        acc = get('accuracy').replace('%', '')
        if acc:
            try:
                r['accuracy'] = float(acc)
                if not (0 <= r['accuracy'] <= 100):
                    errors.append('정확도는 0~100 사이입니다.')
            except ValueError:
                errors.append(f'정확도 「{acc}」를 숫자로 읽을 수 없습니다.')
        rid = get('roadmap_task_id')
        if rid:
            try:
                r['roadmap_task_id'] = int(float(rid))
            except ValueError:
                errors.append('로드맵 항목 id 는 숫자입니다.')
        if r['project_uuid'] and not _UUID_RE.match(r['project_uuid']):
            errors.append('대시보드 과제 uuid 모양이 아닙니다.')
        key = (norm(r['subject']), norm(r['agent']))
        if r['subject'] and r['agent']:
            if key in seen:
                errors.append(f'{seen[key]}행과 같은 시험×시뮬레이션입니다.')
            else:
                seen[key] = line
        r['errors'] = errors
        rows.append(r)

    return {'header': header, 'rows': rows}


def plan(text, division_id):
    """미리보기 — 무엇이 새로 생기고 무엇이 이미 있는지. **저장하지 않는다.**"""
    parsed = parse_table(text, division_id)
    subjects = {norm(s.name): s for s in MaturitySubject.query
                .filter_by(division_id=division_id, sector=SECTOR).all()}
    agents = {norm(a.name): a for a in MaturityAgent.query
              .filter_by(division_id=division_id, sector=SECTOR).all()}
    pairs = {(p.subject_id, p.agent_id) for p in MaturityPair.query
             .join(MaturitySubject).filter(MaturitySubject.division_id == division_id,
                                           MaturitySubject.sector == SECTOR).all()}
    new_subj, new_agent = set(), set()
    summary = {'rows': 0, 'errors': 0, 'new_subjects': 0, 'new_agents': 0,
               'new_pairs': 0, 'existing_pairs': 0, 'accuracy_values': 0}
    for r in parsed['rows']:
        summary['rows'] += 1
        if r['errors']:
            r['status'] = 'error'
            summary['errors'] += 1
            continue
        s = subjects.get(norm(r['subject']))
        a = agents.get(norm(r['agent']))
        if s is None and norm(r['subject']) not in new_subj:
            new_subj.add(norm(r['subject']))
            summary['new_subjects'] += 1
        if a is None and norm(r['agent']) not in new_agent:
            new_agent.add(norm(r['agent']))
            summary['new_agents'] += 1
        if s is not None and a is not None and (s.id, a.id) in pairs:
            r['status'] = 'exists'
            summary['existing_pairs'] += 1
        else:
            r['status'] = 'new_pair'
            summary['new_pairs'] += 1
        if r['accuracy'] is not None:
            summary['accuracy_values'] += 1
    parsed['summary'] = summary
    return parsed


# ── ④ 넣기 ─────────────────────────────────────────────────────────────────

def apply(text, division_id, actor, with_accuracy=False, source_label=None):
    """오류 없는 줄만 넣는다. 이름이 같으면 있는 것을 쓴다 — 여러 번 넣어도 같다.

    정확도는 `with_accuracy` 일 때만 쓴다. 근거는 「표 가져오기 (날짜)」 — 값의
    출처가 파일이라는 사실 자체가 근거다. 이미 값이 있으면 덮는다(같은 자료를
    다시 올리는 경우가 정상 경로라서). 이력은 값이 바뀐 때만 남는다(services.assess).
    """
    p = plan(text, division_id)
    subjects = {norm(s.name): s for s in MaturitySubject.query
                .filter_by(division_id=division_id, sector=SECTOR).all()}
    agents = {norm(a.name): a for a in MaturityAgent.query
              .filter_by(division_id=division_id, sector=SECTOR).all()}
    stamp = datetime.utcnow().strftime('%Y-%m-%d')
    note = f'표 가져오기 ({source_label or stamp})'
    done = {'subjects': 0, 'agents': 0, 'pairs': 0, 'accuracy': 0, 'skipped': p['summary']['errors']}

    for r in p['rows']:
        if r['status'] == 'error':
            continue
        s = subjects.get(norm(r['subject']))
        if s is None:
            s = S.create_subject(division_id, SECTOR, r['subject'], r['subject_detail'],
                                 r['product_families'], 'auto', r['roadmap_task_id'])
            subjects[norm(s.name)] = s
            done['subjects'] += 1
        elif r['roadmap_task_id'] and not s.roadmap_task_id:
            s.roadmap_task_id = r['roadmap_task_id']
        a = agents.get(norm(r['agent']))
        if a is None:
            a = S.create_agent(division_id, SECTOR, r['agent'], None, r['model_kind'],
                               r['project_uuid'])
            agents[norm(a.name)] = a
            done['agents'] += 1
        else:
            if r['model_kind'] and not a.model_kind:
                a.model_kind = r['model_kind']
            if r['project_uuid'] and not a.project_uuid:
                a.project_uuid = r['project_uuid']
        pair = MaturityPair.query.filter_by(subject_id=s.id, agent_id=a.id).first()
        if pair is None:
            pair = S.create_pair(s, a)
            done['pairs'] += 1
        if with_accuracy and r['accuracy'] is not None:
            S.assess(pair, 'accuracy', {'value': r['accuracy'], 'note': note}, actor)
            done['accuracy'] += 1
    db.session.flush()
    return {'summary': p['summary'], 'done': done}


# ── 어긋남 — 로드맵과 여기 ────────────────────────────────────────────────

def reconcile(division_id):
    """「로드맵에는 있는데 여기 없는 시험 / 여기만 있는 시험」. 고치라고 강제하지 않는다."""
    from app.modules.digital_twin_reference.models import DtReferenceTask
    roadmap = {}
    for t in DtReferenceTask.query.filter(DtReferenceTask.division_id == str(division_id)).all():
        if (t.test_item or '').strip():
            roadmap.setdefault(norm(t.test_item), t.test_item.strip())
    here = {norm(s.name): s.name for s in MaturitySubject.query
            .filter_by(division_id=division_id, sector=SECTOR).all()}
    return {
        'missing_here': sorted(v for k, v in roadmap.items() if k not in here),
        'only_here': sorted(v for k, v in here.items() if k not in roadmap),
        'roadmap_count': len(roadmap), 'here_count': len(here),
    }
