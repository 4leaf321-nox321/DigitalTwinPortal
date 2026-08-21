"""
「내 일」 — 로그인한 사람이 **지금 손대야 하는 것**만 모아 준다 (2026-08-11).

이 파일이 존재하는 이유
    기존 화면은 전부 **전사 조망**이다(종합 대시보드·진행률·트리맵·관계도·추이).
    로그인한 사람 기준의 화면이 하나도 없어서, 자기가 어느 과제의 담당인지조차
    화면이 알려주지 않았다. 컷오버 뒤 가장 흔한 문의가 "수정이 안 돼요" 였던 것도
    같은 결핍의 다른 얼굴이다.

설계 원칙 셋
    ① **새 계산을 만들지 않는다.** 카드는 전부 `ai/graph_agent.py` 의 기존 분석을
       `Scope(relation=...)` 로 좁혀 쓴다. 분석을 여기 복제하면 관계도 화면과
       숫자가 갈리는 날이 온다.
    ② **현황이 아니라 할 일이다.** 항목마다 "왜 떴는지" 와 "어디를 누르면 끝나는지"
       가 붙는다. 끝낼 수 없는 것은 넣지 않는다 — 그건 관계도 패널이 할 일이다.
    ③ **끌 수 없는 항목에는 「나중에」를 준다.** 아래 참조.

「나중에」(스누즈)를 붙이는 카드와 안 붙이는 카드
    스스로 사라지는 카드에는 **안 붙인다.** 액션아이템은 완료 체크하면, 데이터
    공백은 값을 채우면, 확인 대기는 승인하면 사라진다 — 버튼이 있으면 오히려
    "처리했다" 와 "숨겼다" 가 섞인다.

    반대로 「멈춘 과제」·「이슈 적체」·「일정 쏠림」은 **화면에서 없앨 방법이 없다.**
    협력사 계약을 기다리는 과제는 한 달 내내 같은 줄로 뜬다. 그런 게 서너 개
    쌓이면 사람은 배지 숫자를 안 믿게 되고, 그러면 정작 급한 항목도 묻힌다.

⚠️ **가시성은 `Scope` 한 줄에서 끝난다.** 이 파일은 그 뒤로 권한을 다시 묻지 않는다
   (묻는 곳이 늘면 한 곳만 빠뜨려도 구멍이 된다). 확인 대기만 예외인데, 그건
   과제가 아니라 제안이 대상이라 `can_review_proposal` 이 따로 판정한다.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy.orm.attributes import flag_modified

from app.extensions import db
from app.modules.auth.models import User, UserRole
from app.modules.digital_twin_dashboard import permissions as P
from app.modules.digital_twin_dashboard.ai import graph_agent as GA
from app.modules.digital_twin_dashboard.models import ModuleSettings
from app.modules.digital_twin_dashboard.models_v2 import (
    Dt2ChangeProposal, Dt2Project, Dt2WorklistDismissal,
)

# 「나중에」 를 누르면 이만큼 숨긴다. 사용자 확정(2026-08-11) — 기간 선택은 두지 않는다.
SNOOZE_DAYS = 30

# 카드 하나에 보일 최대 건수. 넘으면 `more` 로 몇 건이 더 있는지 알린다.
# ⚠️ **조용히 자르지 않는다** — 몇 건만 보여주고 "다 봤다" 고 믿게 하면 안 된다.
CARD_LIMIT = 8

# **이 화면에서 직접 처리하는 카드**는 상한이 훨씬 높다. 여기서 일을 끝내는 것이
# 목적이라, 5건만 보여주고 "나머지는 과제를 열어서" 라고 하면 화면의 뜻이 없어진다.
INLINE_CARD_LIMIT = 100
INLINE_CARDS = ('actions', 'openIssues', 'proposals', 'perfActuals')

# 배지가 세는 것 = **기한이 지났거나 남이 기다리는 것**.
#
# ⚠️ 「내 액션아이템」은 카드 전체가 급한 게 아니다 — 앞으로 할 것까지 들어 있어서
#    통째로 세면 숫자가 늘 커서 아무 뜻이 없어진다. 그래서 그 카드는 **기한이 지난
#    것만** 급한 것으로 센다(`_card_actions` 가 `urgent` 를 직접 넣는다).
#    아래 목록은 "카드 건수 = 급한 건수" 인 것들이다.
URGENT_CARDS = ('proposals', 'reportReject', 'reportRecheck')

# `summary`(배지용)에서 만드는 카드. **이력을 안 읽는 가벼운 것만.**
# 「멈춘 과제」는 진척 이력을 통째로 읽어서 첫 화면 로딩에 얹히면 안 된다.
SUMMARY_CARDS = ('actions', 'proposals', 'reportReject', 'reportRecheck')

# 렌즈별 카드 구성. 순서가 곧 화면 순서다(고정 — 매번 자리가 바뀌면 못 찾는다).
LENS_CARDS = {
    # 「내가 하는 일」은 **작업대**다 — 앞의 넷은 이 화면에서 바로 처리하고,
    # 뒤의 둘은 과제를 열어야 하는 것이라 뒤에 둔다.
    'mine':     ('actions', 'openIssues', 'proposals', 'perfActuals',
                 'reportDue', 'reportReject', 'stalled', 'gaps', 'readiness'),
    'division': ('reportDue', 'schedule', 'issues', 'keyGap', 'stalled', 'gaps'),
    'office':   ('reportRecheck', 'reportDue', 'gaps', 'proposals',
                 'readiness', 'divisions'),
}

# 관계가 강한 순으로 항목을 앞에 둔다 (permissions.RELATION_STRENGTH).
#   manager 는 자기 사업부 과제의 **작성자**인 경우가 흔해서, 섞어 두면 정작 자기가
#   PL 인 과제가 뒤로 밀리고 카드 상한(5건)에 걸려 안 보인다.
RELATION_LABEL = {'pl': 'PL', 'member': '참여', 'owner': '소유', 'author': '작성'}

# 「비어 있는 값」·「보고서에 빈 곳」에서 **이 화면에는 안 띄우는 블록**.
#
#   noImage  「그림이 없는 과제」 — 개발 실측 100/100 이 걸린다. 거의 모든 과제가
#            해당하면 그건 할 일 목록이 아니라 배경이고, 다른 항목을 덮는다.
#            (2026-08-11 사용자 요청)
#
# ⚠️ **`graph_agent.report_readiness` 자체는 안 건드렸다.** 관계도 화면의 보고
#    준비도 패널이 그 결과를 쓰고 있고, 그쪽은 "보고 전 점검표" 라서 그림 빠진
#    과제를 보여주는 것이 맞다. 여기서만 가린다.
HIDDEN_BLOCKS = frozenset({'noImage'})


def available_lenses(actor: User) -> list[str]:
    """이 사람이 쓸 수 있는 렌즈. 순서가 곧 탭 순서다."""
    if actor is None or not getattr(actor, 'is_active', False):
        return []
    if actor.role == UserRole.VIEWER:
        return []                      # 고칠 수 있는 게 없으면 할 일도 없다
    out = ['mine']
    if actor.role == UserRole.MANAGER and P.actor_division_id(actor) is not None:
        out.append('division')
    if actor.role in P.GLOBAL_EDIT_ROLES:
        out.append('division')         # 사무국·admin 도 자기 사업부를 볼 수 있다
        out.append('office')
    return out


def default_lens(actor: User) -> str:
    """역할이 **기본값만** 정한다. 벽이 아니다 — 화면에서 언제든 넘어간다."""
    if actor is not None and actor.role == UserRole.MANAGER:
        return 'division' if P.actor_division_id(actor) is not None else 'mine'
    return 'mine'


# ─────────────────────────────────────────────────────────────────────────────
# 「나중에」
# ─────────────────────────────────────────────────────────────────────────────

def active_dismissals(user_id: int) -> dict:
    """아직 유효한 미룸. `{item_key: until}`.

    ⚠️ `until` 은 **naive UTC** 다 — `BaseModel.created_at` 과 같은 기준.
       SQL `now()`(KST)와 직접 비교하면 9시간 어긋난다.
    """
    rows = (Dt2WorklistDismissal.query
            .filter(Dt2WorklistDismissal.user_id == user_id,
                    Dt2WorklistDismissal.until > datetime.utcnow()).all())
    return {r.item_key: r.until for r in rows}


def snooze(user_id: int, item_key: str, card=None, days=SNOOZE_DAYS):
    """같은 항목을 또 미루면 **덮어쓴다**(행을 쌓지 않는다)."""
    until = datetime.utcnow() + timedelta(days=days)
    row = (Dt2WorklistDismissal.query
           .filter_by(user_id=user_id, item_key=item_key).first())
    if row is None:
        row = Dt2WorklistDismissal(user_id=user_id, item_key=item_key)
        db.session.add(row)
    row.until = until
    row.card = card or (item_key.split(':')[0] if ':' in item_key else None)
    db.session.commit()
    return row


def unsnooze(user_id: int, item_key: str) -> bool:
    n = (Dt2WorklistDismissal.query
         .filter_by(user_id=user_id, item_key=item_key).delete())
    db.session.commit()
    return bool(n)


# ─────────────────────────────────────────────────────────────────────────────
# 카드 만들기 — 전부 graph_agent 의 기존 분석을 **좁혀** 쓴다
# ─────────────────────────────────────────────────────────────────────────────

def _card(key, title, why, items, *, snoozable=False, hidden=0, action=None,
          urgent=None):
    """카드 하나. `items` 는 이미 정렬·필터가 끝난 전체 목록이다.

    `urgent` 를 주면 배지가 그 수만 센다(안 주면 URGENT_CARDS 규칙을 따른다).
    """
    limit = INLINE_CARD_LIMIT if key in INLINE_CARDS else CARD_LIMIT
    return {
        # 배지에 들어갈 수. 카드 건수와 **다를 수 있다** (위 URGENT_CARDS 주석).
        'urgent': (urgent if urgent is not None
                   else (len(items) if key in URGENT_CARDS else 0)),
        'key': key, 'title': title, 'why': why,
        'count': len(items),
        'items': items[:limit],
        # 잘린 건수를 **밝힌다.** 안 밝히면 5건이 전부인 줄 안다.
        'more': max(0, len(items) - limit),
        'snoozable': snoozable,
        # 「나중에」로 가려진 건수. 0 이 아니면 화면이 "N건 미뤄둠" 을 보여준다 —
        # 숨긴 것을 숨기면 그것대로 못 믿을 화면이 된다.
        'snoozed': hidden,
        'action': action,          # 화면이 어디로 보낼지 (project | settings | none)
    }


def _brief(scope, p, relation=None):
    d = scope.project_brief(p)
    if relation:
        d['relation'] = relation
        d['relationLabel'] = RELATION_LABEL.get(relation, relation)
    return d


def _sorted_by_relation(scope, projects):
    """관계 강한 순 → 코드순. `relation_of` 가 없는 렌즈에서는 코드순만."""
    def key(p):
        rel = scope.relation_of.get(p.uuid)
        return (P.RELATION_STRENGTH.get(rel, 9), p.code or '', p.title or '')
    return sorted(projects, key=key)


def _filter_snoozed(items, dismissed):
    """미뤄둔 항목을 걷어내고 `(남은 것, 걷어낸 수)`."""
    kept = [x for x in items if x.get('key') not in dismissed]
    return kept, len(items) - len(kept)


# ── 급한 카드 셋 (summary 에서도 이것만 센다 — 이력을 안 읽어 가볍다) ──────────

def _card_actions(scope, dismissed):
    """
    **미완료 액션아이템 전부** — 기한이 안 지난 것도 포함한다.

    「기한 지난 항목」과 다른 물건이다. 그쪽은 *알림*(급한 것)이고 이쪽은 *작업대*다 —
    이 화면에서 과제에 안 들어가고 일을 끝내려면 **지금 해야 할 것뿐 아니라 앞으로
    할 것도** 같은 표에 있어야 한다.

    화면이 체크박스를 바로 저장할 수 있도록 **과제 uuid 와 항목 uuid** 를 함께 준다.
    ⚠️ `액션아이템목록` 은 **배열 통째 교체**라, 한 건만 바꿔도 화면이 그 과제의
       전체 배열을 다시 보내야 한다. 그래서 화면은 자기가 들고 있는 과제 목록에서
       배열을 꺼내 쓴다 — 서버가 여기서 배열 전체를 실어 보내지는 않는다(무겁다).
    """
    today = GA._today()
    rows = []
    for p in _sorted_by_relation(scope, scope.projects_all_years):
        rel = scope.relation_of.get(p.uuid)
        for it in GA._action_items(p):
            if it.get('완료여부'):
                continue
            auid = str(it.get('uuid') or '').strip()
            due = str(it.get('목표일') or '').strip()
            subs = [s for s in (it.get('세부항목목록') or []) if isinstance(s, dict)]
            rows.append({
                **_brief(scope, p, rel),
                'key': f'action:{p.uuid}:{auid or str(it.get("제목") or "")[:40]}',
                'projectUuid': p.uuid,
                'actionUuid': auid,
                'itemTitle': it.get('제목') or '(이름 없는 항목)',
                'due': due,
                'overdueDays': _days_between(due, today) if due else None,
                'subTotal': len(subs),
                'subDone': sum(1 for s in subs if s.get('완료여부')),
                # 세부항목(사업부에 따라 「액티비티」로 부른다)을 그대로 실어 준다 —
                # 화면에서 **하위만 체크**할 수 있어야 하기 때문이다.
                #
                # ⚠️ **세부항목에는 uuid 가 없다**(`normalize_action_items` 주석 참조).
                #    그래서 순번(`index`)을 함께 준다. 화면은 순번으로 찾되 `내용` 으로
                #    한 번 더 확인해서, 그 사이 목록이 바뀌었으면 손대지 않는다.
                'subs': [{'index': i,
                          'content': s.get('내용') or '(내용 없음)',
                          'done': bool(s.get('완료여부')),
                          'doneAt': str(s.get('완료일') or '')}
                         for i, s in enumerate(subs)],
            })
    # 목표일이 이른 것부터. 목표일이 없는 것은 맨 뒤로(판단할 근거가 없다).
    rows.sort(key=lambda r: (r['due'] or '9999-99-99', r.get('code') or ''))
    kept, hidden = _filter_snoozed(rows, dismissed)
    return _card('actions', '내 액션아이템',
                 '체크하면 바로 저장됩니다. 과제를 열지 않아도 됩니다.',
                 kept, hidden=hidden, action='inline',
                 # 배지는 **기한이 지난 것만** 센다 — 앞으로 할 것까지 세면 뜻이 없다.
                 urgent=sum(1 for r in kept if (r.get('overdueDays') or 0) > 0))


def _card_open_issues(scope, dismissed):
    """미해결 이슈 — **화면에서 바로 해결 체크**할 수 있게 항목 단위로 편다."""
    rows = []
    for p in _sorted_by_relation(scope, scope.projects):
        rel = scope.relation_of.get(p.uuid)
        for idx, iss in enumerate(p.issues_json or []):
            if not isinstance(iss, dict) or iss.get('해결여부'):
                continue
            rows.append({
                **_brief(scope, p, rel),
                # ⚠️ 이슈에는 uuid 가 없다. 내용으로 키를 만든다 — 순서(idx)를 키에
                #    넣으면 앞의 이슈가 하나 지워질 때 키가 어긋난다.
                'key': f'issue:{p.uuid}:{str(iss.get("내용") or "")[:40]}',
                'projectUuid': p.uuid,
                'issueIndex': idx,
                'content': iss.get('내용') or '(내용 없음)',
                'registeredAt': str(iss.get('등록일') or ''),
                'action': iss.get('조치내용') or '',
            })
    rows.sort(key=lambda r: (r['registeredAt'] or '9999', r.get('code') or ''))
    kept, hidden = _filter_snoozed(rows, dismissed)
    return _card('openIssues', '미해결 이슈',
                 '해결됐으면 체크하세요. 조치 내용도 여기서 적을 수 있습니다.',
                 kept, hidden=hidden, action='inline')


def _card_perf_actuals(scope, dismissed):
    """
    실적이 비어 있는 성과 — **여기서 바로 숫자를 넣는다.**

    `실적수준` 은 저위험 필드라 AI 도 즉시 쓸 수 있고, 사람은 당연히 쓸 수 있다.
    ⚠️ 성과는 **여러 과제가 공유**한다. 내 과제에 걸린 것이어도 남의 과제 숫자가
       같이 바뀌므로, 몇 개 과제가 이 성과를 쓰는지 함께 보여준다.
    """
    # 이 성과를 쓰는 과제가 몇 개인가 (Scope 에는 역방향 색인이 없어 여기서 만든다)
    shared = {}
    for l in scope.perf_links:
        shared[l.performance_uuid] = shared.get(l.performance_uuid, 0) + 1

    seen, rows = set(), []
    for p in _sorted_by_relation(scope, scope.projects):
        for l in scope.perfs_of.get(p.uuid, []):
            f = scope.perfs.get(l.performance_uuid)
            if f is None or f.uuid in seen:
                continue
            if f.actual_level not in (None, ''):
                continue
            seen.add(f.uuid)
            # 「목표 변화량」 = |목표 − 현재|. **절대값을 쓴다** —
            # 성과의 절반쯤이 「비용 절감」·「시간 단축」처럼 **줄이는** 목표라
            # 부호를 그대로 두면 늘리는 목표와 견줄 수가 없다.
            # 규칙의 정본은 `frontend/utils/unitConversion.js` 의 `cardDeltaAt` 다 —
            # 여기서 다르게 계산하면 KPI 화면과 숫자가 갈린다.
            tgt, cur = f.target_level, f.current_level
            delta = (abs(float(tgt) - float(cur))
                     if tgt is not None and cur is not None else None)
            rows.append({
                'key': f'perfActual:{f.uuid}',
                'performanceUuid': f.uuid,
                'code': f.code,
                'title': f.display_name or f.title,
                'unit': f.unit,
                # 표시는 문자열, 계산은 숫자로 따로 준다 — 화면이 다시 파싱하면
                # '0' 과 '' 을 가르는 규칙이 또 한 벌 생긴다(0 은 값이 있는 것이다).
                'targetLevel': (str(tgt) if tgt is not None else ''),
                'currentLevel': (str(cur) if cur is not None else ''),
                'targetNum': (float(tgt) if tgt is not None else None),
                'currentNum': (float(cur) if cur is not None else None),
                'targetDelta': delta,
                # 달성형은 "이뤘나" 를 묻는 종류라 변화량을 다르게 읽어야 한다.
                # 값을 숨기지는 않고 **표시로 알린다** (판단은 사람이 한다).
                'isAchievement': bool(f.is_achievement_type),
                'sharedBy': shared.get(f.uuid, 1),
                'viaProject': f'{p.code or ""} {p.title or ""}'.strip(),
            })
    kept, hidden = _filter_snoozed(rows, dismissed)
    return _card('perfActuals', '실적이 비어 있는 성과',
                 '목표만 있고 결과가 없습니다. 숫자를 여기서 바로 넣을 수 있습니다.',
                 kept, hidden=hidden, action='inline')


def _card_report_due(scope, dismissed):
    """
    **완료된 과제인데 결과 보고서가 아직인 것.**

    일이 끝난 순간이 보고서를 쓰기 가장 좋은 때인데, 그때는 아무도 알려주지 않아서
    한참 뒤 보고 시즌에 몰아 쓰게 된다. 그 시점에는 무엇을 했는지 흐릿해진다.

    「보고서에 빈 곳」(readiness)과 다른 물건이다 — 그쪽은 **모든 과제**의 빈칸을
    훑는 점검표이고, 이쪽은 **완료 과제만** 골라 "이제 쓸 차례다" 라고 말한다.

    ⚠️ 보고서 상태 판정은 **화면(`ProjectReportView.getReportStatus`)과 같은 규칙**이다:

            상세정보_입력완료(detail_completed) 켜짐  →  작성 완료 (여기 안 뜬다)
            어떤 섹션이라도 내용이 있음               →  작성 중
            아무 섹션도 비어 있음                     →  미작성

       줄이 있는지 세는 것은 `detail_rules.section_lines` 를 그대로 쓴다.
       규칙을 여기 옮겨 적으면 화면의 「결과 보고서」 목록과 숫자가 갈린다.
    """
    from app.modules.digital_twin_dashboard import detail_rules as DR

    rows = []
    for p in _sorted_by_relation(scope, scope.projects):
        if (p.status or '').strip() != '완료':
            continue
        if p.detail_completed:
            continue
        written = any(DR.section_lines(getattr(p, col, None))
                      for col in DR.DETAIL_SECTION_COLS)
        rows.append({
            **_brief(scope, p, scope.relation_of.get(p.uuid)),
            'key': f'reportDue:{p.uuid}',
            'projectUuid': p.uuid,
            'reportState': '작성 중' if written else '미작성',
            'completedAt': str(getattr(p, 'end_month', '') or ''),
        })
    # 아직 손도 안 댄 것(미작성)을 앞에 둔다 — 쓰다 만 것보다 먼저 시작해야 한다.
    rows.sort(key=lambda r: (r['reportState'] != '미작성', r.get('code') or ''))
    kept, hidden = _filter_snoozed(rows, dismissed)
    return _card('reportDue', '보고서를 써야 할 완료 과제',
                 '과제가 완료됐습니다. 기억이 선명할 때 결과 보고서를 채워 주세요.',
                 kept, snoozable=True, hidden=hidden, action='project')


def _card_overdue(scope, dismissed):
    """
    기한이 지난 **액션아이템**. 과제가 아니라 **항목 단위로 평평하게** 펼친다 —
    과제로 묶으면 무엇을 해야 끝나는지가 안 보인다.

    ⚠️ **연도 필터를 무시한다.** 작년 과제에 남은 기한 지난 항목도 지금 할 일이다
       (연도 위젯은 과제년도로 걸리므로 그대로 두면 12월에 사라진다).
       이 카드만 예외이고, 그래서 `scope` 가 아니라 `scope.all_years` 를 쓴다.
    """
    today = GA._today()
    rows = []
    for p in _sorted_by_relation(scope, scope.projects_all_years):
        rel = scope.relation_of.get(p.uuid)
        for it in GA._action_items(p):
            if not GA._overdue(it, today):
                continue
            auid = str(it.get('uuid') or '').strip()
            rows.append({
                **_brief(scope, p, rel),
                # uuid 가 없는 옛 항목은 제목으로 키를 만든다. 순서·번호는 절대 쓰지
                # 않는다 — 항목이 하나 늘면 키가 어긋나 미뤄둔 것이 되살아난다.
                # ⚠️ 액션아이템의 제목 키는 **`제목`** 이다(`액션아이템` 이 아니다).
                #    `graph_agent`·`routes_v2` 도 전부 `제목` 을 읽는다 — 틀리면
                #    모든 줄이 "(이름 없는 항목)" 으로 나온다. 실제로 한 번 그랬다.
                'key': f'overdue:{p.uuid}:{auid or str(it.get("제목") or "")[:40]}',
                'itemTitle': it.get('제목') or '(이름 없는 항목)',
                'due': str(it.get('목표일') or ''),
                'overdueDays': _days_between(str(it.get('목표일') or ''), today),
            })
    rows.sort(key=lambda r: (-(r['overdueDays'] or 0), r.get('code') or ''))
    kept, hidden = _filter_snoozed(rows, dismissed)
    return _card('overdue', '기한이 지난 항목',
                 '목표일이 지났는데 아직 완료가 아닙니다. 끝났으면 체크해 주세요.',
                 kept, hidden=hidden, action='project')


def _days_between(due, today):
    try:
        d1 = datetime.strptime(due[:10], '%Y-%m-%d').date()
        d2 = datetime.strptime(today[:10], '%Y-%m-%d').date()
        return (d2 - d1).days
    except Exception:
        return None


def _card_proposals(actor, dismissed, stale_days=None):
    """
    **내가 승인할 수 있는** 확인 대기. `list_proposals` 와 같은 판정을 쓴다.

    AI 가 핵심 필드를 고치려 하면 여기로 온다. 대화 안에서 `confirm_change` 로
    처리하는 것이 원래 설계라 화면이 없었는데, 폼 도우미·그래프 에이전트가
    늘면서 **대화 밖에서 만들어진 제안**이 아무 데도 안 보이게 됐다.

    `stale_days` 를 주면 그만큼 묵은 것만 (사무국 렌즈).
    """
    q = Dt2ChangeProposal.query.filter(Dt2ChangeProposal.status == 'pending')
    if stale_days:
        q = q.filter(Dt2ChangeProposal.created_at
                     < datetime.utcnow() - timedelta(days=stale_days))
    rows = []
    for pr in q.order_by(Dt2ChangeProposal.created_at.asc()).limit(500).all():
        proj = (Dt2Project.query.filter_by(uuid=pr.project_uuid).first()
                if pr.project_uuid else None)
        if pr.target_type == 'performance':
            # 성과 제안은 기준이 다르다 — 연결된 과제 중 하나라도 고칠 수 있으면 된다
            from app.modules.digital_twin_dashboard.models_v2 import Dt2Performance
            perf = Dt2Performance.query.filter_by(uuid=pr.performance_uuid).first()
            if not P.can_edit_performance(actor, perf):
                continue
        else:
            allowed, _why = P.can_review_proposal(actor, proj, pr)
            if not allowed:
                continue
        rows.append({
            'key': f'proposal:{pr.id}',
            'proposalId': pr.id,
            'ref': f'project:{pr.project_uuid}' if pr.project_uuid else None,
            'code': proj.code if proj else None,
            'title': proj.title if proj else '(과제 없음)',
            'fields': sorted((pr.patch or {}).keys()),
            'createdAt': pr.created_at.isoformat() if pr.created_at else None,
            'reason': pr.reason,
        })
    kept, hidden = _filter_snoozed(rows, dismissed)
    title = '오래 방치된 확인 대기' if stale_days else '내가 확인할 변경'
    return _card('proposals', title,
                 'AI 가 제안한 변경이 사람의 확인을 기다리고 있습니다.',
                 kept, hidden=hidden, action='project')


def _card_report_recheck(scope, dismissed):
    """
    **재확인 대기** — 받은 사람이 보완했다고 알려 온 보고서.

    이 카드가 「보완했습니다」의 **받는 쪽**이다. 이게 없으면 공이 넘어가도
    아무도 안 받는다 — 사람은 자기 목록에서 없어졌으니 끝난 줄 알고, 사무국은
    보완된 줄을 모른다.

    ⚠️ 사무국 렌즈에만 둔다. 재확인은 사무국이 하는 일이고, 여기 걸린 것은
       **남이 기다리는 것**이라 배지에도 센다(URGENT_CARDS).
    """
    row = ModuleSettings.query.filter_by(
        module_name='digital_twin_dashboard', settings_key='reportConfirmations').first()
    seals = (row.settings_data or {}) if row else {}
    if not seals:
        return _card('reportRecheck', '재확인 대기',
                     '보완했다고 알려 온 보고서가 없습니다.', [], action='report')

    rows = []
    for p in _sorted_by_relation(scope, scope.projects):
        seal = seals.get(p.uuid) or seals.get(getattr(p, 'code', None) or '')
        if not isinstance(seal, dict) or seal.get('status') != 'resubmitted':
            continue
        rows.append({
            **_brief(scope, p, scope.relation_of.get(p.uuid)),
            'key': f"reportRecheck:{p.uuid}:{seal.get('resubmittedAt') or ''}",
            'reason': seal.get('comment') or '',
            'resubmittedAt': str(seal.get('resubmittedAt') or '')[:10],
            'resubmittedByName': seal.get('resubmittedByName') or '',
        })
    kept, hidden = _filter_snoozed(rows, dismissed)
    return _card('reportRecheck', '재확인 대기',
                 '보완했다고 알려 왔습니다. 보고서를 다시 보고 확인하거나 '
                 '다시 요청해 주세요.',
                 kept, hidden=hidden, action='report')


def mark_resubmitted(actor, project_uuid: str):
    """
    재검토 요청을 받은 사람이 **「보완했습니다」**를 누른다.

    왜 필요한가
        예전에는 이 카드를 받은 사람이 **없앨 방법이 없었다.** 보고서를 고쳐도
        도장은 `rejected` 그대로였고, 사무국이 다시 열어 「사무국 확인」을 눌러
        주기 전까지 배지 숫자가 안 줄었다. 이 화면의 원칙이 「끝낼 수 없는 것은
        넣지 않는다」인데, 받은 사람 입장에서 끝낼 수 없는 카드였다.
        (2026-08-22 신고)

    무엇이 바뀌나
        도장의 `status` 가 `rejected` → `resubmitted` 가 된다. **지우지 않는다** —
        사유와 수신자를 남겨 둬야 사무국이 「무엇을 지적했더라」를 다시 읽는다.

    ⚠️ **공이 넘어가는 것이지 끝나는 것이 아니다.** 내 카드에서는 빠지고
       사무국의 「재확인 대기」로 뜬다. 최종 확인은 여전히 사무국이 한다.

    ⚠️ 누를 수 있는 사람 — **수신자이거나, 그 과제가 내 것**이어야 한다.
       카드를 보여 주는 규칙(`_card_report_reject`)과 **같은 잣대**다. 여기가
       느슨하면 남의 재검토 요청을 남이 닫아 줄 수 있다.
    """
    row = ModuleSettings.query.filter_by(
        module_name='digital_twin_dashboard', settings_key='reportConfirmations').first()
    seals = dict((row.settings_data or {}) if row else {})
    seal = seals.get(project_uuid)
    if not isinstance(seal, dict) or seal.get('status') != 'rejected':
        return None, '재검토 요청 상태가 아닙니다.'

    if not _may_resubmit(actor, project_uuid, seal):
        return None, '이 보고서의 재검토 요청 대상이 아닙니다.'

    seals[project_uuid] = {
        **seal,
        'status': 'resubmitted',
        'resubmittedAt': datetime.utcnow().isoformat(),
        'resubmittedBy': actor.id,
        'resubmittedByName': getattr(actor, 'name', None) or getattr(actor, 'email', ''),
    }
    if row is None:
        row = ModuleSettings(module_name='digital_twin_dashboard',
                             settings_key='reportConfirmations', settings_data={})
        db.session.add(row)
    row.settings_data = seals
    # JSON 칼럼은 통째로 갈아 끼워야 SQLAlchemy 가 바뀐 줄 안다.
    flag_modified(row, 'settings_data')
    db.session.commit()
    return seals[project_uuid], None


def _may_resubmit(actor, project_uuid, seal):
    """수신자이거나, 그 과제가 내 것이거나."""
    recips = seal.get('recipients') or []
    if any((r.get('id') is not None and r.get('id') == actor.id)
           or (r.get('email') and r.get('email') == actor.email)
           for r in recips if isinstance(r, dict)):
        return True
    # 수신자가 비어 있는 옛 도장 — 카드도 그때는 「내 과제면 보여준다」로 판정한다.
    mine = GA.Scope(actor, relation='mine')
    return any(p.uuid == project_uuid for p in mine.projects)


def _card_report_reject(scope, actor, dismissed):
    """
    재검토 요청. **기존 로그인 팝업을 흡수한다.**

    ⚠️ 값은 `module_settings.reportConfirmations`(과제 uuid → 도장)에 있다.
       `dt2_projects.report_confirmation` 컬럼도 있지만 운영·개발 모두 비어 있어
       (2026-08-11 확인) 화면이 쓰는 쪽을 그대로 읽는다. 두 곳을 합치는 것은
       별도 작업이다 — 여기서 정본을 바꾸면 팝업과 이 카드가 갈린다.

    ⚠️ 대상 판정은 **수신자 계정 id/email 로만** 한다. 팝업은 수신자가 비면
       `과제PL || 작성자` 이름으로 되짚었는데, 이름 매칭은 2026-08-11 에 권한
       판정에서 버린 규칙이라 여기서 되살리지 않는다. 대신 **내 과제**(scope 가
       이미 그렇게 좁혀져 있다)면 수신자가 비어 있어도 보여준다.
    """
    row = ModuleSettings.query.filter_by(
        module_name='digital_twin_dashboard', settings_key='reportConfirmations').first()
    seals = (row.settings_data or {}) if row else {}
    if not seals:
        return _card('reportReject', '재검토 요청', '보고서에 재검토 요청이 있습니다.',
                     [], action='project')

    rows = []
    for p in _sorted_by_relation(scope, scope.projects):
        seal = seals.get(p.uuid) or seals.get(getattr(p, 'code', None) or '')
        if not isinstance(seal, dict) or seal.get('status') != 'rejected':
            continue
        recips = seal.get('recipients') or []
        if recips:
            mine = any((r.get('id') is not None and r.get('id') == actor.id)
                       or (r.get('email') and r.get('email') == actor.email)
                       for r in recips if isinstance(r, dict))
            if not mine:
                continue
        sent = str(seal.get('sentAt') or seal.get('at') or '')
        rows.append({
            **_brief(scope, p, scope.relation_of.get(p.uuid)),
            'key': f'reportReject:{p.uuid}:{sent}',
            'reason': seal.get('reason') or seal.get('note') or '',
            'sentAt': sent,
        })
    kept, hidden = _filter_snoozed(rows, dismissed)
    return _card('reportReject', '재검토 요청',
                 '사유를 확인하고 보완한 뒤 「보완했습니다」를 누르세요. '
                 '사무국의 재확인 목록으로 넘어갑니다.',
                 kept, hidden=hidden, action='report')


# ── 나머지 카드 (분석을 그대로 쓴다) ─────────────────────────────────────────

def _card_stalled(scope, dismissed):
    out = GA.stalled_projects(scope)
    rows = []
    for kind, why in (('stalled', '상태는 진행 중인데 진행률이 그대로입니다.'),
                      ('regressed', '진행률이 내려갔습니다 — 계획이 커진 것일 수 있습니다.')):
        for x in (out.get(kind) or []):
            uuid = str(x.get('ref') or '').split(':')[-1]
            rows.append({**x, 'key': f'stalled:{uuid}', 'kind': kind, 'why': why,
                         'relationLabel': RELATION_LABEL.get(
                             scope.relation_of.get(uuid), '')})
    kept, hidden = _filter_snoozed(rows, dismissed)
    card = _card('stalled', '멈춰 있는 과제',
                 '진행률이 오래 그대로입니다. 진행률이 내려간 것은 나쁜 신호가 아니라 '
                 '계획이 커진 것일 수 있습니다.',
                 kept, snoozable=True, hidden=hidden, action='project')
    # "이력이 짧아 판단하지 않은 과제 N개" — 조용히 빼면 "문제 없음" 으로 읽힌다.
    # 「내 과제가 왜 안 뜨지」에 답할 수 있는 유일한 값이라 그대로 싣는다.
    card['note'] = out.get('note')
    return card


def _fill_labels(scope, items):
    """
    분석이 준 항목에 **과제명(code·title)을 채워 넣는다.**

    🐞 블록마다 항목 모양이 다르다(2026-08-11 실측). `graph_agent` 가 분석마다
       필요한 것만 담기 때문이다:

           noPerf · noKpi      {ref, code, title, division, status, progress}
           unlinkedPl          {ref, projectCode, name, kind}      ← title 없음
           noRelationType      {ref, projectCode, kpiDefinitionId} ← title 없음

       그래서 화면이 그대로 그리면 **어떤 블록은 과제 이름이 안 나온다.**
       화면이 블록마다 다른 규칙을 알게 하는 대신 여기서 모양을 맞춘다 —
       `graph_agent` 쪽은 관계도 화면이 쓰고 있어 손대지 않는다.

    덧붙여 항목에만 있는 정보(PL 이름·KPI 이름)를 `detail` 로 모아 준다.
    그게 없으면 "이 과제 왜 떴지" 를 알 수 없다.
    """
    # ⚠️ KPI 정의는 **다른 모듈**에 있고 이름 칸은 `label` 이다(`name` 이 아니다).
    #    `graph_agent.kpi_briefing` 도 같은 것을 쓴다.
    from app.modules.dx_kpi_management.models import KpiDefinition

    # 필요한 것만 **한 번에** 읽는다 — 항목마다 질의하면 20건에 20번 왕복한다.
    kids = {x.get('kpiDefinitionId') for x in items
            if isinstance(x, dict) and x.get('kpiDefinitionId') is not None}
    kpi_names = ({k.id: (k.label or f'KPI #{k.id}')
                  for k in KpiDefinition.query.filter(KpiDefinition.id.in_(kids)).all()}
                 if kids else {})
    out = []
    for x in items:
        if not isinstance(x, dict):
            continue
        row = dict(x)
        uuid = str(row.get('ref') or '').split(':')[-1]
        p = scope.by_uuid.get(uuid)
        if not row.get('code'):
            row['code'] = row.get('projectCode') or (p.code if p else None)
        if not row.get('title'):
            row['title'] = p.title if p else ''

        bits = []
        if row.get('name'):
            bits.append(f"{row.get('kind') or ''} {row['name']}".strip())
        kid = row.get('kpiDefinitionId')
        if kid is not None:
            bits.append(f'KPI: {kpi_names.get(kid, f"#{kid}")}')
        if bits:
            row['detail'] = ' · '.join(bits)
        out.append(row)
    return out


def _card_gaps(scope, dismissed):
    out = GA.data_gaps(scope)
    # 과제 목록을 **그대로 실어 준다** — 화면이 펼쳐서 과제별로 열 수 있어야 한다.
    # (집계만 주면 "그림이 없는 과제 100건" 이라고만 뜨고 어느 과제인지 알 수 없다)
    # 원본이 이미 20건에서 자른다(`graph_agent.data_gaps`). 자른 사실은 화면이
    # `count` 와 길이를 견줘 "외 N건" 으로 밝힌다.
    rows = [{'key': f'gap:{b["key"]}', 'blockKey': b['key'], 'title': b['title'],
             'why': b['why'], 'count': b['count'],
             'items': _fill_labels(scope, b['items'])}
            for b in (out.get('gaps') or [])
            if b.get('count') and b['key'] not in HIDDEN_BLOCKS]
    kept, hidden = _filter_snoozed(rows, dismissed)
    return _card('gaps', '비어 있는 값',
                 '채우면 분석과 보고서가 정확해집니다.',
                 kept, hidden=hidden, action='project')


def _card_readiness(scope, dismissed):
    out = GA.report_readiness(scope)
    # ⚠️ 키가 `blocks` 가 아니라 **`gaps`** 다 (data_gaps 와 같은 이름을 쓴다).
    #    함수 안의 지역변수 이름(`blocks`)을 보고 짐작하면 빈 카드가 나온다.
    rows = [{'key': f'ready:{b["key"]}', 'blockKey': b['key'], 'title': b['title'],
             'why': b['why'], 'count': b['count'],
             'items': _fill_labels(scope, b['items'])}
            for b in (out.get('gaps') or [])
            if b.get('count') and b['key'] not in HIDDEN_BLOCKS]
    kept, hidden = _filter_snoozed(rows, dismissed)
    return _card('readiness', '보고서에 빈 곳',
                 '결과 보고서를 내기 전에 채워야 할 것들입니다.',
                 kept, hidden=hidden, action='project')


def _card_issues(scope, dismissed):
    out = GA.issue_backlog(scope)
    rows = []
    for kind, why in (('stale', '오래 남아 있는 미해결 이슈입니다.'),
                      ('noAction', '이슈만 있고 대응 액션아이템이 없습니다.')):
        for x in (out.get(kind) or []):
            uuid = str(x.get('ref') or '').split(':')[-1]
            rows.append({**x, 'key': f'issue:{uuid}', 'kind': kind, 'why': why})
    kept, hidden = _filter_snoozed(rows, dismissed)
    return _card('issues', '쌓여 있는 이슈',
                 '미해결 이슈가 오래됐거나 대응 액션이 없습니다.',
                 kept, snoozable=True, hidden=hidden, action='project')


def _card_schedule(scope, dismissed):
    out = GA.schedule_crowding(scope)
    rows = [{**x, 'key': f'schedule:{str(x.get("ref") or "").split(":")[-1]}'}
            for x in (out.get('items') or [])]
    kept, hidden = _filter_snoozed(rows, dismissed)
    return _card('schedule', '한 달에 몰린 일정',
                 '남은 액션아이템의 목표일이 한 달에 쏠려 있습니다.',
                 kept, snoozable=True, hidden=hidden, action='project')


def _card_key_gap(scope, dismissed):
    out = GA.key_project_gap(scope)
    rows = [{**x, 'key': f'keyGap:{str(x.get("ref") or "").split(":")[-1]}'}
            for x in (out.get('items') or [])]
    kept, hidden = _filter_snoozed(rows, dismissed)
    return _card('keyGap', '중점과제인데 근거가 얇다',
                 '중점으로 선언했는데 성과·KPI 연결이나 진척이 따라오지 않습니다.',
                 kept, snoozable=True, hidden=hidden, action='project')


def _card_divisions(scope, dismissed):
    """사무국 렌즈에만 둔다 — 사업부를 줄 세우는 화면이라 관리 주체에게만 보인다."""
    out = GA.division_compare(scope)
    rows = [{'key': f'division:{x.get("division")}', **x}
            for x in (out.get('rows') or [])]
    return _card('divisions', '사업부별 채움 정도',
                 '어느 사업부가 무엇을 덜 채웠는지 봅니다.', rows, action='none')


_BUILDERS = {
    'actions': _card_actions, 'openIssues': _card_open_issues,
    'reportRecheck': _card_report_recheck,
    'perfActuals': _card_perf_actuals, 'reportDue': _card_report_due,
    'stalled': _card_stalled, 'gaps': _card_gaps, 'readiness': _card_readiness,
    'issues': _card_issues, 'schedule': _card_schedule, 'keyGap': _card_key_gap,
    'divisions': _card_divisions,
}


# ─────────────────────────────────────────────────────────────────────────────

def build(actor: User, lens=None, years=None, summary=False) -> dict:
    """
    「내 일」 한 판. `summary=True` 면 **급한 카드 셋만** 세고 끝낸다.

    왜 summary 를 가르나 — 배지 숫자는 로그인 직후 자동으로 부른다. 전체를 만들면
    `stalled` 가 진척 이력을 통째로 읽어(과제 × 이력행) 첫 화면 로딩에 그대로 얹힌다.
    급한 카드 셋은 과제 본체만 보므로 훨씬 가볍다.
    """
    lenses = available_lenses(actor)
    if not lenses:
        return {'lens': None, 'lenses': [], 'cards': [], 'urgentCount': 0,
                'totalCount': 0,
                'notes': ['읽기 전용 계정이라 「내 일」 목록이 없습니다.']}

    lens = lens if lens in lenses else default_lens(actor)
    if lens not in lenses:
        lens = lenses[0]

    relation = {'mine': 'mine', 'division': 'division', 'office': 'all'}[lens]
    scope = GA.Scope(actor, years=years, divisions=None, relation=relation)

    # 기한 지난 항목만은 **연도를 무시한다** — 작년에 안 끝낸 것도 지금 할 일이다.
    scope.projects_all_years = (
        scope.projects if not years
        else GA.Scope(actor, years=None, divisions=None, relation=relation).projects)

    dismissed = active_dismissals(actor.id)
    notes = []

    wanted = LENS_CARDS[lens]
    cards = []
    for key in wanted:
        if summary and key not in SUMMARY_CARDS:
            continue
        if key == 'overdue':
            cards.append(_card_overdue(scope, dismissed))
        elif key == 'proposals':
            cards.append(_card_proposals(
                actor, dismissed, stale_days=7 if lens == 'office' else None))
        elif key == 'reportReject':
            cards.append(_card_report_reject(scope, actor, dismissed))
        else:
            cards.append(_BUILDERS[key](scope, dismissed))

    urgent = sum(c.get('urgent', 0) for c in cards)
    total = sum(c['count'] for c in cards)

    if lens == 'division' and getattr(scope, 'division_id', None) is None:
        notes.append('소속 부서가 사업부에 연결되어 있지 않아 「우리 사업부」를 '
                     '판단할 수 없습니다. 설정 ▸ 부서에서 부서명을 맞춰 주세요.')
    if not summary and not scope.projects and lens == 'mine':
        notes.append('과제PL·참여인력·작성자·소유자로 등록된 과제가 없습니다. '
                     '이름만 적혀 있고 knoxId 가 비어 있으면 여기 잡히지 않습니다.')

    return {
        'lens': lens,
        'lenses': lenses,
        'summary': bool(summary),
        'year': (years[0] if years else None),
        'projectCount': len(scope.projects),
        'urgentCount': urgent,
        'totalCount': total,
        'snoozeDays': SNOOZE_DAYS,
        'cards': cards,
        'notes': notes,
    }
