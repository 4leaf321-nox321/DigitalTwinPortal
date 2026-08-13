"""관계도 AI 에이전트 — **분석은 파이썬이, 서술은 LLM 이.**

이 파일에는 **LLM 호출이 하나도 없다.** 숫자·순위·경로를 만드는 일만 한다.
서술(문장 엮기)은 `graph_narrate.py` 가 따로 맡는다.

왜 갈랐나 (`디지털트윈_관계도_AI에이전트_계획.md` §1-①)
    경영 도구에서 **틀린 숫자는 답이 없는 것보다 나쁘다.** "관련 과제 7개" 가 실제로
    6개면 그 화면 전체를 못 믿게 되고, 한 번 못 믿게 된 화면은 안 쓴다.
    그래서 셈은 전부 여기서 결정적으로 하고, LLM 은 **이미 나온 숫자를 문장으로만**
    바꾼다. 덕분에 **LLM 이 죽어도 브리핑의 숫자는 그대로 나온다.**

계산을 새로 만들지 않는다 — **화면이 쓰는 것과 같은 함수**를 쓴다.
    기여도 합 이상   `routes_v2.contribution_report`
    KPI 달성률       `routes_v2._kpi_metrics` → `dx_kpi_management.achievement`
    가시성           `permissions.can_view_project`
    그래프 투영      `graph_view`
새로 만들면 화면과 AI 가 다른 숫자를 말하는 날이 온다(규칙 복제 금지).

모든 분석은 **`refs`(근거 경로)** 를 함께 낸다. 화면이 그것만 남기고 흐리게 해서
"말이 아니라 그림으로 근거를 대는" 것이 이 기능의 핵심이다.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from datetime import date

from app.extensions import db
from app.modules.auth.models import UserRole
from app.modules.digital_twin_dashboard import permissions as P
from app.modules.digital_twin_dashboard.graph_view import _ref
from app.modules.digital_twin_dashboard.models_v2 import (
    Dt2Performance, Dt2Project, Dt2ProjectDependency, Dt2ProjectHistory,
    Dt2ProjectKpi, Dt2ProjectPerformance,
)

# 「병목 담당자」 판정.
#
# ⚠️ **절대 건수만 보면 안 된다.** 개발 DB 로 처음 돌렸을 때 관련자 8명이 **전원**
#    병목으로 잡혔다. 다들 비슷하게 많이 맡고 있으면 그건 병목이 아니라 그냥
#    바쁜 팀이다. "몰려 있다" 는 **상대적인 말**이므로 남들과 견줘서 판정한다.
#
#   · 최소 건수를 넘고(너무 적은 수로 병목이라 하지 않는다)
#   · **중앙값의 배수**를 넘어야 한다(남들보다 확실히 많아야 한다)
BOTTLENECK_MIN_ACTIONS = 3
BOTTLENECK_RATIO = 1.8

# 「숨은 연결」에서 **흔한 고리는 셈에서 뺀다**. 과제 이만큼 넘게 걸린 KPI·사람은
# 거의 모두를 잇기 때문에 신호가 아니라 잡음이다(계획서 §2 참조).
COMMON_HUB_MIN = 8

# 숨은 연결로 내보낼 최대 쌍 수. 더 내면 사람이 안 읽는다.
HIDDEN_LIMIT = 12

# 「멈췄다」로 볼 최소 기간(일). 이력이 이보다 짧게 쌓인 과제는 판단하지 않는다 —
# 어제 만든 과제를 "3일째 그대로" 라고 하면 안 된다.
STALLED_MIN_DAYS = 14

# 「일정 쏠림」 — 남은 미완료 액션의 이 비율 넘게 한 달에 몰려 있으면 짚는다.
CROWDED_RATIO = 0.6

# 「오래된 이슈」 기준(일).
STALE_ISSUE_DAYS = 60


# ─────────────────────────────────────────────────────────────────────────────
# 공통 — 볼 수 있는 과제와 그 주변을 한 번에 모은다
# ─────────────────────────────────────────────────────────────────────────────

class Scope:
    """
    한 번의 분석이 보는 범위. **가시성이 여기 한 곳에서 걸린다** —
    이후 모든 셈은 이 안에서만 이뤄지므로, 이 줄이 권한의 전부다.
    """

    def __init__(self, actor, years=None, divisions=None, relation='all'):
        """
        `relation` — 「내 일」 화면의 렌즈 (2026-08-11 추가).

            'all'       지금까지의 동작. 볼 수 있는 것 전부
            'mine'      **소유자·PL·참여인력·작성자로 직접 이어진 과제만**
                        (`P.is_my_project`. 역할로는 안 열린다 — manager 의 「내 일」이
                         사업부 전체가 되어버리는 것을 막는다)
            'division'  본인 사업부의 과제. 사업부를 못 풀면 **빈 범위**다
                        (`actor_division_id` 가 None 이면 판단할 수 없으므로 0건.
                         화면이 "부서가 사업부에 연결되지 않았다" 를 말해야 한다)

        ⚠️ 가시성(`can_view_project`)은 **어느 렌즈에서도 먼저 걸린다.** 렌즈는
           그 안에서 더 좁히기만 한다 — 넓히지 않는다.
        """
        q = Dt2Project.query.filter(
            Dt2Project.is_deleted.is_(False),
            Dt2Project.is_permanently_deleted.is_(False))
        if years:
            q = q.filter(Dt2Project.year.in_(
                [int(y) for y in years if str(y).isdigit()]))
        if divisions:
            q = q.filter(Dt2Project.division.in_(divisions))

        # ⚠️ **취소 과제는 뺀다.** 관계도(`graph_view.build_graph`)와 **같은 모수**여야
        #    한다 — 그림에는 없는 과제를 분석만 세면, 화면과 브리핑의 숫자가 갈린다.
        #    다른 화면들도 이미 모수에서 뺀다(`ProjectSummary` 완료율 등).
        #
        #    SQL 이 아니라 여기서 거르는 이유: `status != '취소'` 는 NULL 을 떨어뜨려
        #    상태가 안 적힌 과제가 통째로 사라진다.
        self.projects = [p for p in q.all()
                         if P.can_view_project(actor, p)
                         and (p.status or '').strip() != '취소']

        # ── 렌즈 (2026-08-11) ────────────────────────────────────────────
        self.relation = relation if relation in ('all', 'mine', 'division') else 'all'
        # 왜 관계를 여기서 미리 계산해 두나 — 카드마다 다시 물으면 과제 × 카드 만큼
        # `is_project_*` 가 돌고, 그 안에서 `actor_match_tokens` 가 DB 를 탄다
        # (요청 캐시가 있지만 셈 자체가 반복된다). 여기서 한 번에 굳힌다.
        self.relation_of = {}
        self.division_id = None
        if self.relation == 'mine':
            # viewer 는 아무것도 못 고치므로 「내 일」이 성립하지 않는다
            # (`is_my_project` 와 같은 판단. 여기서 걸러야 카드가 전부 빈다).
            if getattr(actor, 'role', None) == UserRole.VIEWER:
                self.projects = []
            else:
                for p in self.projects:
                    rel = P.project_relation(actor, p)
                    if rel is not None:
                        self.relation_of[p.uuid] = rel
                self.projects = [p for p in self.projects if p.uuid in self.relation_of]
        elif self.relation == 'division':
            div = P.actor_division_id(actor)
            # 사업부를 못 풀면 **판단하지 않는다** — 빈 범위다. None == None 을 참으로
            # 처리하면 '사업부 미상' 인 사람이 '사업부 미상' 과제를 전부 갖게 된다.
            self.projects = ([p for p in self.projects if p.division_id == div]
                             if div is not None else [])
            self.division_id = div

        self.by_uuid = {p.uuid: p for p in self.projects}
        self.uuids = set(self.by_uuid)

        self.perf_links = [l for l in Dt2ProjectPerformance.query.all()
                           if l.project_uuid in self.uuids]
        puids = {l.performance_uuid for l in self.perf_links}
        self.perfs = {f.uuid: f for f in Dt2Performance.query.filter(
            Dt2Performance.uuid.in_(puids)).all() if not f.is_deleted} if puids else {}
        # 지워진 성과를 가리키는 연결은 셈에서 뺀다 — 없는 것을 성과로 세면 안 된다.
        self.perf_links = [l for l in self.perf_links if l.performance_uuid in self.perfs]

        self.kpi_links = [r for r in Dt2ProjectKpi.query.all()
                          if r.project_uuid in self.uuids]

        self.perfs_of = defaultdict(list)
        for l in self.perf_links:
            self.perfs_of[l.project_uuid].append(l)
        self.kpis_of = defaultdict(list)
        for r in self.kpi_links:
            self.kpis_of[r.project_uuid].append(r)
        self.projects_of_kpi = defaultdict(list)
        for r in self.kpi_links:
            self.projects_of_kpi[r.kpi_definition_id].append(r.project_uuid)

    def label(self, p):
        return f'{p.code} {p.title}'.strip() if p.code else (p.title or '(이름 없음)')

    def project_brief(self, p):
        return {'ref': _ref('project', p.uuid), 'code': p.code, 'title': p.title,
                'division': p.division, 'status': p.status, 'progress': p.progress}


def _today():
    return date.today().isoformat()


def _action_items(p):
    return [it for it in (p.action_items_json or []) if isinstance(it, dict)]


def _overdue(item, today):
    """목표일이 지났는데 아직 미완료인가. 목표일이 없으면 판단하지 않는다."""
    if item.get('완료여부'):
        return False
    due = str(item.get('목표일') or '').strip()
    return bool(due) and due < today


def _people_of(p):
    """`(knoxId, 이름, 관계)` — 그래프와 **같은 기준**(knoxId 있는 사람만)."""
    out = []
    if (p.pl_knox_id or '').strip():
        out.append((p.pl_knox_id.strip(), (p.pl_name or '').strip(), 'PL'))
    for m in (p.members_json or []):
        if isinstance(m, dict) and str(m.get('knoxId') or '').strip():
            out.append((str(m['knoxId']).strip(),
                        str(m.get('이름') or '').strip(), '참여'))
    return out


# ─────────────────────────────────────────────────────────────────────────────
# 신뢰도 — **답보다 먼저 말한다** (계획서 §1-③)
# ─────────────────────────────────────────────────────────────────────────────

def coverage(scope: Scope) -> dict:
    """
    이 분석이 무엇을 기준으로 하는지. 모든 응답에 함께 실린다.

    빈칸을 모르고 낸 결론은 **자신 있게 틀린다.** 특히 사람 관련 분석이 그렇다 —
    그래프의 사람 노드는 knoxId 가 있는 사람뿐이라, 연결률이 낮으면 부하의 상당수가
    안 보이는 채로 "특정인에게 몰려 있다" 고 단정하게 된다.
    """
    named = knox = 0
    for p in scope.projects:
        for m in (p.members_json or []):
            if isinstance(m, dict) and str(m.get('이름') or '').strip():
                named += 1
                if str(m.get('knoxId') or '').strip():
                    knox += 1
    pl_named = sum(1 for p in scope.projects if (p.pl_name or '').strip())
    pl_knox = sum(1 for p in scope.projects if (p.pl_knox_id or '').strip())

    def pct(a, b):
        return round(100.0 * a / b, 1) if b else None

    member_rate = pct(knox, named)
    pl_rate = pct(pl_knox, pl_named)

    notes = []
    if member_rate is not None and member_rate < 80:
        notes.append(f'참여인력의 {100 - member_rate:.0f}% 가 계정에 연결되어 있지 않아 '
                     f'사람 관련 분석(담당자 부하·병목)에서 빠집니다.')
    if pl_rate is not None and pl_rate < 80:
        notes.append(f'과제PL 의 {100 - pl_rate:.0f}% 가 계정 미연결입니다.')
    if not scope.projects:
        notes.append('조건에 맞는 과제가 없습니다.')

    return {
        'projectCount': len(scope.projects),
        'memberLinkRate': member_rate,
        'plLinkRate': pl_rate,
        # 사람 분석을 믿어도 되는가. 화면이 이 값으로 경고를 띄운다.
        'peopleReliable': bool(member_rate is not None and member_rate >= 80),
        'notes': notes,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 0단계 — 데이터 공백 리포트 (LLM 없이도 그 자체로 쓸모 있다)
# ─────────────────────────────────────────────────────────────────────────────

def data_gaps(scope: Scope) -> dict:
    """
    에이전트의 **체온계**. 이것 없이 다른 분석을 만들면 답에 신뢰도를 못 붙인다.

    각 항목은 `refs`(그래프에서 강조할 노드)와 `items`(사람이 읽을 목록)를 함께 낸다.
    """
    from app.modules.digital_twin_dashboard.routes_v2 import contribution_report

    today = _today()
    gaps = []

    def add(key, title, why, items, refs):
        gaps.append({'key': key, 'title': title, 'why': why,
                     'count': len(items), 'items': items[:20], 'refs': refs})

    # ① 성과가 안 걸린 과제 — "무엇을 이뤘나" 를 말할 수 없는 과제다
    no_perf = [p for p in scope.projects if not scope.perfs_of.get(p.uuid)]
    add('noPerf', '성과가 연결되지 않은 과제',
        '무엇을 이뤘는지 셀 수 없어 KPI 기여를 따질 수 없습니다.',
        [scope.project_brief(p) for p in no_perf],
        [_ref('project', p.uuid) for p in no_perf])

    # ② KPI 가 안 걸린 과제
    no_kpi = [p for p in scope.projects if not scope.kpis_of.get(p.uuid)]
    add('noKpi', 'DX KPI 가 연결되지 않은 과제',
        '어느 지표를 밀고 있는지 알 수 없어 기여도 분석에서 빠집니다.',
        [scope.project_brief(p) for p in no_kpi],
        [_ref('project', p.uuid) for p in no_kpi])

    # ③ 기여도 합이 100 이 아닌 성과 — 화면이 쓰는 계산을 그대로 쓴다
    warn = contribution_report([l.performance_uuid for l in scope.perf_links])
    add('contribution', '기여도 합이 100% 가 아닌 성과',
        '여러 과제가 한 성과를 나눠 가질 때 합이 100 이어야 합니다.',
        [{'ref': _ref('perf', w['performanceUuid']), 'title': w.get('title'),
          'sum': w.get('sum'), 'projectCount': w.get('projectCount')} for w in warn],
        [_ref('perf', w['performanceUuid']) for w in warn])

    # ④ 목표일이 지난 미완료 액션
    overdue = []
    for p in scope.projects:
        for it in _action_items(p):
            if _overdue(it, today):
                uid = str(it.get('uuid') or '').strip()
                overdue.append({
                    # uuid 없는 옛 항목은 그래프에 노드가 없다 — 강조 대상에서 뺀다.
                    'ref': _ref('action', uid) if uid else None,
                    'projectRef': _ref('project', p.uuid),
                    'projectCode': p.code, 'title': it.get('제목'),
                    'dueDate': it.get('목표일'),
                })
    overdue.sort(key=lambda x: x['dueDate'] or '')
    add('overdue', '목표일이 지난 미완료 액션아이템',
        '가장 오래 밀린 것부터 봅니다.', overdue,
        [x['ref'] for x in overdue if x['ref']])

    # ⑤ 계정 미연결 — 사람 분석의 전제
    unlinked = []
    for p in scope.projects:
        if (p.pl_name or '').strip() and not (p.pl_knox_id or '').strip():
            unlinked.append({'ref': _ref('project', p.uuid), 'projectCode': p.code,
                             'name': p.pl_name, 'kind': '과제PL'})
    add('unlinkedPl', '계정이 연결되지 않은 과제PL',
        'PL 은 계정이 연결되어야 자기 과제를 고칠 수 있고, 그래프에도 나타납니다.',
        unlinked, [x['ref'] for x in unlinked])

    # ⑥ 기여등급 미지정
    no_rel = [r for r in scope.kpi_links if not (r.relation_type or '').strip()]
    add('noRelationType', '기여등급이 비어 있는 KPI 연결',
        '주기여·보조·간접 중 무엇인지 몰라 기여도 순위에서 뒤로 밀립니다.',
        [{'ref': _ref('project', r.project_uuid),
          'projectCode': (scope.by_uuid.get(r.project_uuid) or Dt2Project()).code,
          'kpiDefinitionId': r.kpi_definition_id} for r in no_rel],
        [_ref('project', r.project_uuid) for r in no_rel])

    total = sum(g['count'] for g in gaps)
    return {
        'kind': 'gaps',
        'title': '데이터 공백 리포트',
        'headline': (f'{len(scope.projects)}개 과제에서 손볼 곳 {total}건을 찾았습니다.'
                     if total else f'{len(scope.projects)}개 과제에서 눈에 띄는 공백이 없습니다.'),
        'gaps': gaps,
        'coverage': coverage(scope),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 1단계 — KPI 한 장 브리핑 (메인)
# ─────────────────────────────────────────────────────────────────────────────

def kpi_briefing(scope: Scope, kpi_definition_id: int) -> dict:
    """
    KPI 하나를 붙들고 **기여 과제 → 성과 → 미완료 액션 → 병목 → 우선 대응**까지.

    각 단계는 `refs` 를 들고 있어서, 화면에서 그 단계를 누르면 그래프가 그 집합만
    남기고 흐려진다. 그것이 이 기능의 「근거」다.
    """
    from app.modules.dx_kpi_management.models import KpiDefinition

    kdef = KpiDefinition.query.get(kpi_definition_id)
    if kdef is None:
        return {'kind': 'kpi', 'error': '지표를 찾을 수 없습니다.'}

    today = _today()
    kref = _ref('kpi', kdef.id)
    links = [r for r in scope.kpi_links if r.kpi_definition_id == kdef.id]
    projs = [scope.by_uuid[r.project_uuid] for r in links
             if r.project_uuid in scope.by_uuid]
    rel_of = {r.project_uuid: (r.relation_type or '') for r in links}

    # ── 성과가 확인된 과제 / 아닌 과제 ────────────────────────────────────
    # "성과가 났다" 의 기준은 **연결만이 아니라 실적값**이다. 연결만 보고
    # 성과가 있다고 하면, 목표만 세워 둔 과제가 성과를 낸 것으로 잡힌다.
    with_result, without_result = [], []
    for p in projs:
        got = any(scope.perfs[l.performance_uuid].actual_level not in (None, '')
                  for l in scope.perfs_of.get(p.uuid, []))
        (with_result if got else without_result).append(p)

    # ── 미완료 액션 (그중 지연) ───────────────────────────────────────────
    open_actions, overdue_actions = [], []
    for p in projs:
        for it in _action_items(p):
            if it.get('완료여부'):
                continue
            # uuid 가 없는 옛 항목(백필 전)은 그래프에 노드가 없다. 셈에는 넣되
            # `ref` 는 비워 둔다 — 없는 노드를 가리키면 화면이 유령을 강조한다.
            uid = str(it.get('uuid') or '').strip()
            row = {'ref': _ref('action', uid) if uid else None,
                   'projectRef': _ref('project', p.uuid), 'projectCode': p.code,
                   'title': it.get('제목'), 'dueDate': it.get('목표일')}
            open_actions.append(row)
            if _overdue(it, today):
                overdue_actions.append(row)
    overdue_actions.sort(key=lambda x: x['dueDate'] or '')

    def _arefs(rows):
        return ([a['ref'] for a in rows if a['ref']]
                + [a['projectRef'] for a in rows])

    # ── 병목 담당자 ───────────────────────────────────────────────────────
    # 미완료 액션이 **남들보다 유독 몰린** 사람. `knoxId` 가 있는 사람만 보이므로
    # 신뢰도(`coverage`)를 함께 낸다.
    load = Counter()
    names = {}
    for p in projs:
        open_n = sum(1 for it in _action_items(p) if not it.get('완료여부'))
        if not open_n:
            continue
        for knox, name, _kind in _people_of(p):
            load[knox] += open_n
            names.setdefault(knox, name or knox)

    bottleneck = []
    if load:
        vals = sorted(load.values())
        mid = vals[len(vals) // 2] if len(vals) % 2 else \
            (vals[len(vals) // 2 - 1] + vals[len(vals) // 2]) / 2
        cut = max(BOTTLENECK_MIN_ACTIONS, mid * BOTTLENECK_RATIO)
        bottleneck = [{'ref': _ref('person', k), 'name': names[k],
                       'openActions': n, 'median': mid}
                      for k, n in load.most_common() if n >= cut]

    # ── 우선 대응 과제 ────────────────────────────────────────────────────
    # 순위는 **설명할 수 있어야 한다.** 왜 위로 왔는지 항목마다 이유를 적는다.
    ranked = []
    for p in projs:
        reasons = []
        score = 0
        if p in without_result:
            score += 3
            reasons.append('성과 실적 없음')
        n_over = sum(1 for it in _action_items(p) if _overdue(it, today))
        if n_over:
            score += min(n_over, 3)
            reasons.append(f'지연 액션 {n_over}건')
        if rel_of.get(p.uuid) == 'primary':
            score += 2
            reasons.append('주기여 과제')
        if (p.progress or 0) < 30:
            score += 1
            reasons.append(f'진행률 {p.progress or 0}%')
        if score:
            ranked.append({**scope.project_brief(p), 'score': score,
                           'reasons': reasons})
    ranked.sort(key=lambda x: -x['score'])
    priority = ranked[:5]

    steps = [
        {'key': 'projects', 'label': '기여 과제', 'count': len(projs),
         'refs': [_ref('project', p.uuid) for p in projs] + [kref]},
        {'key': 'withResult', 'label': '성과 실적 확인', 'count': len(with_result),
         'refs': [_ref('project', p.uuid) for p in with_result] + [kref]},
        {'key': 'withoutResult', 'label': '성과 실적 없음', 'count': len(without_result),
         'warn': bool(without_result),
         'refs': [_ref('project', p.uuid) for p in without_result] + [kref]},
        {'key': 'openActions', 'label': '미완료 액션', 'count': len(open_actions),
         'refs': _arefs(open_actions)},
        {'key': 'overdue', 'label': '그중 목표일 지남', 'count': len(overdue_actions),
         'warn': bool(overdue_actions), 'refs': _arefs(overdue_actions)},
        {'key': 'bottleneck', 'label': '병목 담당자', 'count': len(bottleneck),
         'warn': bool(bottleneck),
         'refs': [b['ref'] for b in bottleneck]},
    ]

    cov = coverage(scope)
    return {
        'kind': 'kpi',
        'title': kdef.label,
        'subtitle': kdef.category or '',
        'focusRef': kref,
        'headline': (f'기여 과제 {len(projs)}개 중 성과 실적이 확인된 것은 '
                     f'{len(with_result)}개입니다.'),
        'steps': steps,
        'openActions': open_actions[:20],
        'overdueActions': overdue_actions[:20],
        'bottleneck': bottleneck,
        'priority': priority,
        'withoutResult': [scope.project_brief(p) for p in without_result][:20],
        'coverage': cov,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 멈춘 과제 — **유일하게 시간 축을 여는 분석**
#
# 지금 화면들은 전부 스냅샷이다. 「종합 대시보드」도 「진행률 현황」도 지금 값을 보여줄
# 뿐, "이 과제가 3주째 그대로다" 는 어디에도 없다. `dt2_project_history` 는 쌓이고
# 있었는데 **읽는 코드가 하나도 없었다.**
# ─────────────────────────────────────────────────────────────────────────────

def stalled_projects(scope: Scope, min_days=STALLED_MIN_DAYS) -> dict:
    """
    궤적으로 본 이상 신호.

        멈춤    상태는 진행 중인데 **진행률이 그대로**다
        역주행  진행률이 **내려갔다** — 나쁜 게 아니라 **계획이 커진 것**일 수 있다
                (액션아이템을 늘리면 파생 진행률이 내려간다). 그렇게 읽어야 한다

    이력이 `min_days` 보다 짧게 쌓인 과제는 **판단하지 않는다** — 어제 만든 과제를
    "그대로다" 라고 하면 안 된다. 판단할 수 없는 것은 판단하지 않고 세어서 알린다.
    """
    from datetime import datetime, timedelta

    rows = (Dt2ProjectHistory.query
            .filter(Dt2ProjectHistory.project_uuid.in_(list(scope.uuids)))
            .order_by(Dt2ProjectHistory.project_uuid.asc(),
                      Dt2ProjectHistory.observed_at.asc()).all()) if scope.uuids else []
    series = defaultdict(list)
    for r in rows:
        series[r.project_uuid].append(r)

    now = datetime.utcnow()
    stalled, regressed = [], []
    too_short = 0

    for p in scope.projects:
        hist = series.get(p.uuid) or []
        if len(hist) < 2:
            too_short += 1
            continue
        first, last = hist[0], hist[-1]
        span = (last.observed_at - first.observed_at).days
        if span < min_days:
            too_short += 1
            continue

        # 진행 중이라고 말하는 과제만 본다. 완료·취소·미착수는 안 움직이는 게 정상이다.
        moving_claim = (p.status or '') in ('정상진행', '지연')

        # 마지막으로 **값이 실제로 달라진** 시점. `changed_fields` 가 있으므로
        # 그것을 보면 "저장만 하고 값은 그대로" 인 기록에 속지 않는다.
        last_move = None
        prev = None
        for h in hist:
            if prev is not None and h.progress != prev.progress:
                last_move = h.observed_at
            prev = h
        idle_days = (now - (last_move or first.observed_at)).days

        row = {**scope.project_brief(p),
               'progress': last.progress,
               'idleDays': idle_days,
               'spanDays': span,
               'firstProgress': first.progress,
               'points': len(hist)}

        if moving_claim and idle_days >= min_days:
            stalled.append(row)
        if (last.progress or 0) < (first.progress or 0):
            regressed.append({**row,
                              'drop': (first.progress or 0) - (last.progress or 0)})

    stalled.sort(key=lambda x: -x['idleDays'])
    regressed.sort(key=lambda x: -x['drop'])

    # 🐞 **"없습니다" 와 "모릅니다" 는 다르다.**
    #    이력이 짧아 한 건도 판단 못 했는데 "멈춘 과제가 없습니다" 라고 하면,
    #    아래 `note` 를 안 읽은 사람은 문제가 없다고 믿는다. 판단 못 한 것이
    #    전부라면 **그 사실이 헤드라인**이어야 한다.
    judged = len(scope.projects) - too_short
    if judged <= 0:
        headline = (f'아직 판단할 수 없습니다 — 진척 이력이 {min_days}일치 쌓인 과제가 '
                    f'없습니다(이력은 계속 쌓이는 중입니다).')
    elif stalled:
        headline = (f'진행 중이라고 되어 있는데 {min_days}일 넘게 진행률이 그대로인 '
                    f'과제가 {len(stalled)}개입니다. (판단한 과제 {judged}개)')
    else:
        headline = f'판단한 과제 {judged}개 중 오래 멈춰 있는 것은 없습니다.'

    return {
        'kind': 'stalled',
        'title': '멈춘 과제 (진척 궤적)',
        'headline': headline,
        'steps': [
            {'key': 'stalled', 'label': f'{min_days}일 이상 그대로', 'count': len(stalled),
             'warn': bool(stalled), 'refs': [x['ref'] for x in stalled]},
            {'key': 'regressed', 'label': '진행률이 내려감', 'count': len(regressed),
             'refs': [x['ref'] for x in regressed]},
        ],
        'stalled': stalled[:20],
        'regressed': regressed[:20],
        # 판단할 수 없는 것을 조용히 빼면 "문제 없음" 으로 읽힌다. 세어서 말한다.
        'note': (f'이력이 {min_days}일치 못 미쳐 판단하지 않은 과제가 {too_short}개 '
                 f'있습니다.' if too_short else None),
        'hint': '진행률이 내려간 것은 대개 **액션아이템을 늘려 계획이 커진 것**입니다.',
        'coverage': coverage(scope),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 일정 쏠림 — "12월에 다 하겠다는 계획"
# ─────────────────────────────────────────────────────────────────────────────

def schedule_crowding(scope: Scope, ratio=CROWDED_RATIO) -> dict:
    """
    미완료 액션의 **목표일이 한 달에 몰려 있는** 과제.

    실측(개발 DB): 미완료 181건 중 **91건이 2026-12** 목표였다. 이건 계획이 아니라
    미루기의 흔적이라, 한 화면으로 보여줄 값어치가 있다.
    """
    today = _today()
    month_all = Counter()
    rows = []

    for p in scope.projects:
        months = Counter()
        for it in _action_items(p):
            if it.get('완료여부'):
                continue
            due = str(it.get('목표일') or '').strip()
            if len(due) >= 7:
                months[due[:7]] += 1
                month_all[due[:7]] += 1
        total = sum(months.values())
        if total < 2:
            continue          # 한 건짜리는 쏠림이라 부를 것이 없다
        top_month, top_n = months.most_common(1)[0]
        if top_n / total < ratio:
            continue
        rows.append({**scope.project_brief(p),
                     'openTotal': total, 'peakMonth': top_month, 'peakCount': top_n,
                     'share': round(100.0 * top_n / total),
                     # 이미 지난 달에 몰려 있으면 미루기가 아니라 **밀린 것**이다.
                     'overdueMonth': top_month < today[:7]})
    rows.sort(key=lambda x: (-x['peakCount'], x['peakMonth']))

    # 🐞 쏠림은 **과제별로 보면 안 보이고 전체로 봐야 보인다.** 과제 하나에 미완료가
    #    한두 건뿐이면 그 안에서는 쏠림이라 할 것이 없는데, 100개를 합치면
    #    "절반이 12월" 같은 그림이 나온다(개발 DB 실측: 181건 중 91건).
    #    그래서 **헤드라인은 전체 그림**이고, 과제별 목록은 파고들기다.
    total_open = sum(month_all.values())
    peak_month, peak_n = month_all.most_common(1)[0] if month_all else (None, 0)
    if not total_open:
        headline = '목표일이 남아 있는 미완료 액션이 없습니다.'
    else:
        share = round(100.0 * peak_n / total_open)
        headline = (f'미완료 액션 {total_open}건 중 {peak_n}건({share}%)이 '
                    f'{peak_month} 에 몰려 있습니다.')

    return {
        'kind': 'schedule',
        'title': '일정 쏠림',
        'headline': headline,
        'months': [{'month': m, 'count': n} for m, n in sorted(month_all.items())],
        'items': rows[:20],
        'refs': [x['ref'] for x in rows],
        'note': (f'과제 하나 안에서만 봐도 한 달에 몰린 과제는 {len(rows)}개입니다.'
                 if total_open else None),
        'coverage': coverage(scope),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 이슈 적체
# ─────────────────────────────────────────────────────────────────────────────

def issue_backlog(scope: Scope, stale_days=STALE_ISSUE_DAYS) -> dict:
    """
    미해결 이슈가 오래 남아 있거나, 이슈만 쌓이고 **대응 액션이 없는** 과제.

    이슈는 관계도에 노드로 없다(노드로 만들면 수가 급격히 는다). 그래도 분석은
    할 수 있다 — 근거 경로는 **과제**를 가리킨다.
    """
    from datetime import datetime, timedelta

    cutoff = (datetime.utcnow() - timedelta(days=stale_days)).strftime('%Y-%m-%d')
    stale, no_action = [], []
    total = open_n = 0

    for p in scope.projects:
        issues = [i for i in (p.issues_json or []) if isinstance(i, dict)]
        opens = [i for i in issues if not i.get('해결여부')]
        total += len(issues)
        open_n += len(opens)
        if not opens:
            continue

        old = [i for i in opens
               if str(i.get('등록일') or '').strip() and str(i['등록일']).strip() < cutoff]
        if old:
            stale.append({**scope.project_brief(p), 'openIssues': len(opens),
                          'staleIssues': len(old),
                          'oldest': min(str(i.get('등록일') or '') for i in old),
                          'titles': [str(i.get('제목') or '')[:40] for i in old[:3]]})

        # 이슈는 있는데 **미완료 액션이 없다** = 문제를 알면서 대응을 안 걸어 둔 것
        if not any(not it.get('완료여부') for it in _action_items(p)):
            no_action.append({**scope.project_brief(p), 'openIssues': len(opens)})

    stale.sort(key=lambda x: x['oldest'])
    no_action.sort(key=lambda x: -x['openIssues'])

    return {
        'kind': 'issues',
        'title': '이슈 적체',
        'headline': (f'미해결 이슈 {open_n}건 중 {stale_days}일 넘게 남아 있는 것이 '
                     f'{sum(x["staleIssues"] for x in stale)}건입니다.'
                     if open_n else '미해결 이슈가 없습니다.'),
        'steps': [
            {'key': 'stale', 'label': f'{stale_days}일 넘은 미해결 이슈가 있는 과제',
             'count': len(stale), 'warn': bool(stale),
             'refs': [x['ref'] for x in stale]},
            {'key': 'noAction', 'label': '이슈는 있는데 대응 액션이 없는 과제',
             'count': len(no_action), 'warn': bool(no_action),
             'refs': [x['ref'] for x in no_action]},
        ],
        'stale': stale[:20],
        'noAction': no_action[:20],
        'coverage': coverage(scope),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 중점과제의 말과 실제
# ─────────────────────────────────────────────────────────────────────────────

def key_project_gap(scope: Scope) -> dict:
    """
    **중점이라고 선언한 과제**가 실제로 그렇게 다뤄지고 있는가.

    중점과제는 사람이 손으로 표시한 값(`is_key`)이다. 그 선언과 실제 데이터가
    어긋나는 곳을 짚는다 — 데이터가 틀렸을 수도, 선언이 낡았을 수도 있다.
    **어느 쪽인지는 우리가 정하지 않는다.** 어긋났다는 사실만 보여준다.
    """
    today = _today()
    keys = [p for p in scope.projects if p.is_key]
    rest = [p for p in scope.projects if not p.is_key]

    def avg(vals):
        vals = [v for v in vals if v is not None]
        return round(sum(vals) / len(vals), 1) if vals else None

    key_avg = avg([p.progress for p in keys])
    rest_avg = avg([p.progress for p in rest])

    rows = []
    for p in keys:
        flags = []
        perfs = scope.perfs_of.get(p.uuid, [])
        kpis = scope.kpis_of.get(p.uuid, [])
        if not perfs:
            flags.append('성과 연결 없음')
        elif not any(scope.perfs[l.performance_uuid].actual_level not in (None, '')
                     for l in perfs):
            flags.append('성과 실적 없음')
        if not kpis:
            flags.append('KPI 연결 없음')
        elif all((r.relation_type or '') != 'primary' for r in kpis):
            flags.append('주기여 KPI 없음')
        if rest_avg is not None and (p.progress or 0) < rest_avg:
            flags.append(f'진행률 {p.progress or 0}% (중점 외 평균 {rest_avg}%)')
        n_over = sum(1 for it in _action_items(p) if _overdue(it, today))
        if n_over:
            flags.append(f'지연 액션 {n_over}건')
        if flags:
            rows.append({**scope.project_brief(p), 'flags': flags,
                         'score': len(flags)})
    rows.sort(key=lambda x: -x['score'])

    return {
        'kind': 'keyProjects',
        'title': '중점과제의 말과 실제',
        'headline': (f'중점과제 {len(keys)}개 중 {len(rows)}개가 선언과 데이터가 '
                     f'어긋납니다.' if keys else '중점으로 표시된 과제가 없습니다.'),
        'items': rows[:20],
        'refs': [x['ref'] for x in rows],
        'stats': {'keyCount': len(keys), 'keyAvgProgress': key_avg,
                  'otherAvgProgress': rest_avg},
        'hint': '데이터가 덜 찬 것일 수도, 중점 표시가 낡은 것일 수도 있습니다.',
        'coverage': coverage(scope),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 보고 준비도 — 「결과 보고서」 를 쓰기 전 체크리스트
# ─────────────────────────────────────────────────────────────────────────────

def report_readiness(scope: Scope) -> dict:
    """
    보고서에 넣을 것이 갖춰졌는가.

    0단계(데이터 공백)와 재료가 겹치지만 **목적이 다르다** —
    그건 *분석의 신뢰도*를 정하려는 것이고, 이건 *보고 준비*를 위한 것이다.
    그래서 보는 항목도 다르다(그림·상세정보·마일스톤).
    """
    no_detail, no_image, no_milestone, no_actual = [], [], [], []

    for p in scope.projects:
        brief = scope.project_brief(p)
        if not p.detail_completed:
            no_detail.append(brief)
        if not (p.image_refs_json or {}):
            no_image.append(brief)
        if not _action_items(p):
            no_milestone.append(brief)
        links = scope.perfs_of.get(p.uuid, [])
        if links and not any(
                scope.perfs[l.performance_uuid].actual_level not in (None, '')
                for l in links):
            no_actual.append(brief)

    def blk(key, title, why, items):
        return {'key': key, 'title': title, 'why': why, 'count': len(items),
                'items': items[:20], 'refs': [x['ref'] for x in items]}

    blocks = [
        blk('noDetail', '상세 과제 정보 미작성',
            '보고서 우측 패널이 통째로 빕니다.', no_detail),
        blk('noImage', '그림이 없는 과제',
            '보고서·PPT 에서 가장 눈에 띄는 빈칸입니다.', no_image),
        blk('noMilestone', '마일스톤(액션아이템)이 없는 과제',
            '무엇을 언제까지 하는지 보여줄 것이 없습니다.', no_milestone),
        blk('noActual', '성과는 걸었는데 실적이 없는 과제',
            '목표만 있고 결과가 없어 성과 표가 비어 보입니다.', no_actual),
    ]
    total = sum(b['count'] for b in blocks)

    return {
        'kind': 'readiness',
        'title': '보고 준비도',
        'headline': (f'{len(scope.projects)}개 과제에서 보고 전에 채울 곳 {total}건이 '
                     f'있습니다.' if total else '보고에 필요한 것이 다 갖춰져 있습니다.'),
        'gaps': blocks,
        'coverage': coverage(scope),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 사업부별 데이터 채움 — **성과가 아니라 채움만 비교한다**
#
# 왜 채움만 보나 (계획서 §6-2 k)
#     진행률·KPI 달성률로 사업부를 줄 세우면 **구조적으로 불공정하다.**
#       ① 기능조직(GTR·SR·CS)은 자체 KPI 가 없다(`divisions.is_kpi_owner`).
#          달성률로 세우면 못해서가 아니라 **잴 것이 없어서** 꼴찌가 된다.
#       ② 사업부마다 과제가 13~18건이라 분모가 작다. 한두 건에 순위가 뒤집힌다.
#       ③ 과제 성격이 다르다 — GTR 은 제조뿐, MX 는 다섯 프로세스에 걸쳐 있다.
#          진행률을 나란히 놓으면 실은 "제조 과제 vs 개발 과제" 를 비교하는 것이다.
#
#     반면 **채움(입력했는가)은 조직 성격과 무관하게 공정하다.** 기능조직도 성과를
#     걸고 상세정보를 쓰고 계정을 연결한다. 그래서 이것만 비교한다.
#
# ⚠️ **진행률·달성률을 여기에 넣지 말 것.** 넣는 순간 위 셋이 되살아난다.
#    무엇을 일부러 뺐는지 응답(`excluded`)에도 실어 화면이 밝히게 한다.
# ─────────────────────────────────────────────────────────────────────────────

# 분모가 이보다 적은 사업부는 비율을 **믿지 말라고 표시한다.** 과제 5건짜리
# 조직에서 1건은 20%p 라, 비율만 보면 실제보다 크게 흔들려 보인다.
SMALL_DENOM = 8

DIVISION_METRICS = [
    {'key': 'perf', 'label': '성과 연결', 'why': '무엇을 이뤘는지 셀 수 있는가'},
    {'key': 'kpi', 'label': 'KPI 연결', 'why': '어느 지표를 미는지 밝혔는가'},
    {'key': 'relType', 'label': '기여등급 지정', 'why': '주기여·보조·간접을 골랐는가'},
    {'key': 'actual', 'label': '성과 실적 입력', 'why': '목표만이 아니라 결과가 있는가'},
    {'key': 'detail', 'label': '상세정보 작성', 'why': '보고서 우측 패널이 채워지는가'},
    {'key': 'image', 'label': '그림 첨부', 'why': '보고서에서 가장 눈에 띄는 빈칸'},
    {'key': 'plLink', 'label': 'PL 계정 연결', 'why': 'PL 이 자기 과제를 고칠 수 있는가'},
]


def division_compare(scope: Scope) -> dict:
    """
    사업부별 **데이터 채움률**. 순위표가 아니라 "어디를 채워야 하나" 를 보는 표다.

    비율과 함께 **분자·분모를 항상 같이** 낸다 — 비율만 보여주면 3/4(75%)와
    12/16(75%)이 같아 보이는데, 손이 가는 일의 양은 네 배 다르다.
    """
    from app.modules.digital_twin_dashboard.routes_v2 import _kpi_owner_divisions

    owners = {d['name']: d for d in _kpi_owner_divisions()}

    by_div = defaultdict(list)
    for p in scope.projects:
        by_div[(p.division or '(미지정)').strip() or '(미지정)'].append(p)

    rows = []
    for name, projs in by_div.items():
        n = len(projs)
        # 각 지표의 (채워진 수, 분모). 분모가 지표마다 다르다 — 성과 실적은
        # "성과를 건 과제" 가 분모다(안 건 과제에 실적을 요구할 수 없다).
        cells = {}

        def put(key, filled, total, refs):
            cells[key] = {
                'filled': filled, 'total': total,
                'rate': round(100.0 * filled / total, 1) if total else None,
                'refs': refs,
            }

        with_perf = [p for p in projs if scope.perfs_of.get(p.uuid)]
        put('perf', len(with_perf), n,
            [_ref('project', p.uuid) for p in projs if not scope.perfs_of.get(p.uuid)])

        with_kpi = [p for p in projs if scope.kpis_of.get(p.uuid)]
        put('kpi', len(with_kpi), n,
            [_ref('project', p.uuid) for p in projs if not scope.kpis_of.get(p.uuid)])

        links = [r for p in projs for r in scope.kpis_of.get(p.uuid, [])]
        typed = [r for r in links if (r.relation_type or '').strip()]
        put('relType', len(typed), len(links),
            [_ref('project', r.project_uuid) for r in links
             if not (r.relation_type or '').strip()])

        # 성과 실적 — 분모는 **성과를 건 과제**다
        got_actual = [p for p in with_perf
                      if any(scope.perfs[l.performance_uuid].actual_level not in (None, '')
                             for l in scope.perfs_of[p.uuid])]
        put('actual', len(got_actual), len(with_perf),
            [_ref('project', p.uuid) for p in with_perf if p not in got_actual])

        detail = [p for p in projs if p.detail_completed]
        put('detail', len(detail), n,
            [_ref('project', p.uuid) for p in projs if not p.detail_completed])

        image = [p for p in projs if (p.image_refs_json or {})]
        put('image', len(image), n,
            [_ref('project', p.uuid) for p in projs if not (p.image_refs_json or {})])

        named = [p for p in projs if (p.pl_name or '').strip()]
        linked = [p for p in named if (p.pl_knox_id or '').strip()]
        put('plLink', len(linked), len(named),
            [_ref('project', p.uuid) for p in named if not (p.pl_knox_id or '').strip()])

        rates = [c['rate'] for c in cells.values() if c['rate'] is not None]
        rows.append({
            'division': name,
            'projectCount': n,
            'isKpiOwner': bool(owners.get(name, {}).get('isKpiOwner')),
            # 기능조직 표시는 **참고**다. 이 표의 지표들은 기능조직에도 공정하다 —
            # 달성률과 달리 조직 성격과 무관하게 "입력했는가" 를 묻기 때문이다.
            'isFunctional': name in owners and not owners[name]['isKpiOwner'],
            'smallSample': n < SMALL_DENOM,
            'cells': cells,
            'fillRate': round(sum(rates) / len(rates), 1) if rates else None,
            # 아직 안 채운 것의 총 건수 — **손이 가는 일의 양**이다.
            'todo': sum(c['total'] - c['filled'] for c in cells.values()),
            'refs': [_ref('project', p.uuid) for p in projs],
        })

    # 채움률이 낮은 곳부터. 순위를 매기려는 것이 아니라 **어디부터 손댈지**를 본다.
    rows.sort(key=lambda r: (r['fillRate'] if r['fillRate'] is not None else 999))

    worst = rows[0] if rows else None
    return {
        'kind': 'divisions',
        'title': '사업부별 데이터 채움',
        'headline': (f'채움률이 가장 낮은 곳은 {worst["division"]}'
                     f'({worst["fillRate"]}%)이고, 전체로 아직 안 채운 항목이 '
                     f'{sum(r["todo"] for r in rows)}건입니다.'
                     if worst else '비교할 과제가 없습니다.'),
        'metrics': DIVISION_METRICS,
        'rows': rows,
        # **일부러 뺀 것을 화면이 밝히게 한다.** 코드 주석에만 있으면 보는 사람은
        # "왜 진행률이 없지" 하고 자기 나름대로 짐작한다.
        'excluded': [
            {'label': '진행률·KPI 달성률',
             'why': '기능조직은 자체 지표가 없고 과제 성격도 달라, 나란히 놓으면 '
                    '못해서가 아니라 구조 때문에 낮게 보입니다.'},
        ],
        'note': (f'과제가 {SMALL_DENOM}건 미만인 사업부는 비율이 크게 흔들립니다 — '
                 f'비율보다 옆의 건수를 보세요.'
                 if any(r['smallSample'] for r in rows) else None),
        'coverage': coverage(scope),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 3단계 — 위험 KPI Top-N (추정이 아니라 사실이다)
# ─────────────────────────────────────────────────────────────────────────────

def risky_kpis(scope: Scope, year, limit=5) -> dict:
    """
    달성률이 낮거나 실적이 없는 지표를 짚는다.

    달성률은 **`routes_v2._kpi_metrics` 가 계산한 것을 그대로** 쓴다. 화면의
    KPI 매트릭스와 같은 숫자라야 하기 때문이다 — 여기서 다시 계산하면 언젠가 갈린다.
    """
    from app.modules.digital_twin_dashboard.routes_v2 import (
        _kpi_metrics, _kpi_owner_divisions,
    )
    from app.modules.dx_kpi_management.models import KpiDefinition

    defs = (KpiDefinition.query
            .order_by(KpiDefinition.sort_order.asc(), KpiDefinition.id.asc()).all())
    divisions = _kpi_owner_divisions()
    # ⚠️ `(metrics, unmatched)` 튜플을 돌려준다. `unmatched` 는 지표 라벨과
    #    실적 데이터가 안 맞은 것으로, 매트릭스 화면이 경고에 쓴다.
    metrics, _unmatched = _kpi_metrics(defs, divisions, year)

    label_of = {d.id: d.label for d in defs}
    by_kpi = defaultdict(list)
    for m in metrics:
        by_kpi[m['kpiDefinitionId']].append(m)

    rows = []
    for kid, cells in by_kpi.items():
        # 'n_a'(그 사업부가 관리하지 않음)·'platform'(측정값 없음)은 구멍이 아니다.
        real = [c for c in cells if c['status'] not in ('n_a', 'platform')]
        if not real:
            continue
        miss = [c for c in real if c['status'] == 'miss']
        near = [c for c in real if c['status'] == 'near']
        no_data = [c for c in real if c['status'] in ('no_data', 'no_target')]
        rates = [c['achievement'] for c in real if c['achievement'] is not None]
        worst = min(rates) if rates else None

        # 위험도 — 미달이 많을수록, 달성률이 낮을수록, 실적이 없을수록.
        risk = len(miss) * 3 + len(near) + len(no_data) * 2
        if worst is not None and worst < 100:
            risk += (100 - worst) / 25.0
        if not risk:
            continue

        projs = [scope.by_uuid[u] for u in scope.projects_of_kpi.get(kid, [])
                 if u in scope.by_uuid]
        rows.append({
            'kpiDefinitionId': kid,
            'label': label_of.get(kid, str(kid)),
            'risk': round(risk, 1),
            'missCells': len(miss), 'nearCells': len(near), 'noDataCells': len(no_data),
            'worstAchievement': round(worst, 1) if worst is not None else None,
            'projectCount': len(projs),
            'refs': [_ref('kpi', kid)] + [_ref('project', p.uuid) for p in projs],
            # 미는 과제가 없는데 미달인 지표 — 가장 곧바로 손댈 곳이다.
            'noProjects': not projs,
        })

    rows.sort(key=lambda x: -x['risk'])
    top = rows[:limit]
    return {
        'kind': 'risky',
        'title': f'{year} 위험 지표' if year else '위험 지표',
        'headline': (f'지표 {len(rows)}개가 미달·무실적 구간에 있고, 그중 '
                     f'{sum(1 for r in top if r["noProjects"])}개는 미는 과제가 없습니다.'
                     if rows else '미달 구간의 지표가 없습니다.'),
        'items': top,
        'refs': [r for row in top for r in row['refs']],
        'coverage': coverage(scope),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 4단계 — 숨은 연결 (희소성 가중)
# ─────────────────────────────────────────────────────────────────────────────

def hidden_links(scope: Scope, limit=HIDDEN_LIMIT) -> dict:
    """
    **직접 연결은 없는데 간접으로만 강하게 묶인** 과제 쌍.

    ⚠️ 그냥 "같은 KPI 를 공유" 로 세면 **잡음이다.** 실측(개발 DB): 과제당 KPI 3.1개,
       KPI 는 16개뿐이라 97/100 과제가 KPI 를 2개 이상 갖는다 — 아무 두 과제나
       KPI 를 공유해서 "협업 가능성 높음" 이 거의 모든 쌍에 대해 참이 된다.

    그래서 **희소성으로 가중한다** (TF-IDF 와 같은 발상).
        · 과제 `COMMON_HUB_MIN` 개 넘게 걸린 고리는 **아예 뺀다** (흔해서 뜻이 없다)
        · 남은 고리는 `1 / (고리에 걸린 과제 수)` 만큼만 센다
    그리고 **이미 선행 관계로 이어진 쌍은 뺀다** — 이미 아는 사이는 발견이 아니다.
    """
    # 고리(성과·KPI·사람)마다 걸린 과제
    hubs = defaultdict(set)
    for l in scope.perf_links:
        hubs[('perf', l.performance_uuid)].add(l.project_uuid)
    for r in scope.kpi_links:
        hubs[('kpi', r.kpi_definition_id)].add(r.project_uuid)
    for p in scope.projects:
        for knox, _n, _k in _people_of(p):
            hubs[('person', knox)].add(p.uuid)

    # 이미 직접 이어진 쌍 — 발견 대상이 아니다
    direct = set()
    for d in Dt2ProjectDependency.query.all():
        if d.project_uuid in scope.uuids and d.depends_on_uuid in scope.uuids:
            direct.add(frozenset((d.project_uuid, d.depends_on_uuid)))

    pair_score = defaultdict(float)
    pair_via = defaultdict(list)
    dropped_common = 0

    for (kind, key), members in hubs.items():
        n = len(members)
        if n < 2:
            continue
        if n > COMMON_HUB_MIN:
            dropped_common += 1
            continue                      # 너무 흔한 고리 — 셈에서 뺀다
        weight = 1.0 / n
        ms = sorted(members)
        for i in range(len(ms)):
            for j in range(i + 1, len(ms)):
                pair = frozenset((ms[i], ms[j]))
                if pair in direct:
                    continue
                pair_score[pair] += weight
                pair_via[pair].append({'kind': kind, 'key': str(key), 'shared': n})

    rows = []
    for pair, score in pair_score.items():
        a, b = sorted(pair)
        pa, pb = scope.by_uuid.get(a), scope.by_uuid.get(b)
        if pa is None or pb is None:
            continue
        via = sorted(pair_via[pair], key=lambda v: v['shared'])[:4]
        rows.append({
            'a': scope.project_brief(pa), 'b': scope.project_brief(pb),
            'score': round(score, 3),
            'viaCount': len(pair_via[pair]),
            'via': via,
            'crossDivision': (pa.division or '') != (pb.division or ''),
            'refs': [_ref('project', a), _ref('project', b)]
                    + [_ref('perf' if v['kind'] == 'perf' else v['kind'], v['key'])
                       for v in via],
        })
    # 사업부가 다른 쌍을 위로 — 같은 사업부끼리는 이미 서로 안다.
    rows.sort(key=lambda x: (-(x['score'] + (0.15 if x['crossDivision'] else 0))))
    top = rows[:limit]

    return {
        'kind': 'hidden',
        'title': '숨은 연결',
        'headline': (f'직접 이어져 있지 않은데 드문 고리로 묶인 과제 쌍 {len(rows)}개를 '
                     f'찾았습니다.' if rows else '드문 고리로 묶인 과제 쌍이 없습니다.'),
        'items': top,
        'refs': [r for row in top for r in row['refs']],
        'note': (f'과제 {COMMON_HUB_MIN}개 넘게 걸린 흔한 고리 {dropped_common}개는 '
                 f'셈에서 뺐습니다 — 거의 모든 과제를 이어서 뜻이 없습니다.'),
        'coverage': coverage(scope),
    }
