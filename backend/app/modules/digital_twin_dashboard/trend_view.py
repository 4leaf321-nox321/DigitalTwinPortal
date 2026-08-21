"""과제·성과 추이 — **원시 시계열만** 만들어 준다.

무엇을 하나
    과제   날짜별 **사업부별 총 과제 수**. 완료는 포함하고 **취소는 뺀** "그날 세던 수" 다.
           올라가면 새로 편성된 것이고 내려가면 지워진 것이라, 곡선 자체가 편성 이력이다.
    성과   **성과 속성 카드**(`kpi_dashboard_cards`)별로, 그 카드가 고른 성과들의
           날짜별 현재·목표·실적. 카드가 이미 `logic`(합계/평균)과 사업부를 정해 놨다.

⚠️ **단위 환산과 집계를 여기서 하지 않는다.** 성과는 단위가 5종(%·hrs·억원·건·종)이고
   `hrs → 억원` 같은 환산 규칙이 설정(`ModuleSettings.unitConversions`)에 있는데,
   그 규칙을 적용하는 `applyConversion` 은 **화면에 있다**(`KPIDashboard.jsx`,
   `KPITreemap.jsx` 가 그걸 쓴다).

   여기서 다시 구현하면 **트리맵과 이 차트가 다른 숫자를 말하는 날이 온다.**
   그래서 서버는 "언제 얼마였나" 만 답하고, "그걸 어떻게 합치나" 는 이미 있는 곳에
   그대로 둔다. 이 파일에 환산·합계 코드를 넣지 말 것.

⚠️ **생성일이 진짜가 아닌 과제가 있다.** 이관이 원본에 없던 `createdAt` 을 지어내
   넣었고(개발 DB: 과제 200건이 전부 2026-08-04), `extra_fields._synthesizedTs` 에
   그렇게 표시돼 있다. 그대로 그리면 그날 절벽처럼 솟는다 — **숨기지 않고
   `estimated` 로 함께 내보내** 화면이 "이관으로 찍힌 날" 이라고 밝히게 한다.
"""
from __future__ import annotations

from collections import defaultdict

from app.shared.timeutil import kst_date, today_kst
from app.modules.digital_twin_dashboard import permissions as P
from app.modules.digital_twin_dashboard.models import Division, KPIDashboardCard
from app.modules.digital_twin_dashboard.models_v2 import (
    Dt2Performance, Dt2PerformanceHistory, Dt2Project, Dt2ProjectHistory,
)

# 이관이 지어낸 타임스탬프 표식 (`assemble._SYNTH_TS_KEY` 와 같은 문자열)
_SYNTH_KEY = '_synthesizedTs'


def _d(value):
    """
    DateTime/date → **KST 기준** 'YYYY-MM-DD'. 없으면 None.

    🐞 예전엔 `str(value)[:10]` 이었다. DB 가 naive UTC 로 저장하므로 그건 **UTC
       날짜**이고, KST 오전 9시 이전에 한 일이 전날 칸으로 갔다. 반면 '오늘' 선은
       서버 로컬(KST) 날짜라, 아침에 저장한 값이 **오늘 선보다 왼쪽**에 찍혔다.
       규칙은 `shared/timeutil` 한 곳에 있다.
    """
    if not value:
        return None
    return kst_date(value)


def _project_span(p):
    """
    이 과제가 **세는 대상이던 구간** `(시작, 끝)`. 끝이 None 이면 아직 센다.

    끝은 영구삭제가 먼저다 — 휴지통에 넣었다가 영구삭제한 과제는 두 날짜가 다
    있는데, 화면에서 사라진 시점은 휴지통에 들어간 날이다. 그런데 **되살릴 수
    있으므로** `is_deleted` 가 꺼져 있으면 `deleted_at` 이 남아 있어도 살아 있는 것으로 본다.

    ⚠️ **취소는 세지 않는다.** 삭제와는 다른 일이지만 모수에서 빠지는 것은 같고,
       다른 화면들이 이미 그렇게 한다(`ProjectSummary` 의 완료율·정상진행율,
       `DashboardView` 의 경영진 보고 모집단이 모두 `진행상태 !== '취소'`).
       여기서만 세면 같은 사업부의 과제 수가 화면마다 달라진다.

       취소된 **날부터** 뺀다 — 그날까지는 실제로 굴러가던 과제였다. 다만
       `canceled_at` 이 없으면 언제부터인지 알 수 없으므로 **아예 세지 않는다**
       (남겨 두면 취소된 과제가 곡선에 영원히 얹혀 있게 된다).
    """
    start = _d(p.created_at)
    end = None
    if p.is_permanently_deleted:
        end = _d(p.permanently_deleted_at) or _d(p.deleted_at)
    elif p.is_deleted:
        end = _d(p.deleted_at)
    if (p.status or '').strip() == '취소':
        canceled = _d(p.canceled_at) or start
        if canceled and (end is None or canceled < end):
            end = canceled
    return start, end


def project_trend(actor, years=None, divisions=None):
    """
    날짜별 **사업부별 총 과제 수**.

    세는 기준을 화면이 밝힐 수 있게 `basis` 로 함께 낸다 — 435건 중 335건이
    휴지통인 데이터라, 무엇을 세는지 말하지 않으면 숫자가 세 배로 달라 보인다.
    """
    q = Dt2Project.query
    if years:
        nums = [int(y) for y in years if str(y).isdigit()]
        if nums:
            q = q.filter(Dt2Project.year.in_(nums))
    if divisions:
        q = q.filter(Dt2Project.division.in_(divisions))
    # ⚠️ 삭제된 과제도 **가져온다.** 지워진 시점에 곡선이 내려가는 것이 이 화면의 핵심이다.
    projects = [p for p in q.all() if P.can_view_project(actor, p)]

    spans = []
    est_by_date = defaultdict(lambda: defaultdict(int))   # 날짜 → 사업부 → 건수
    for p in projects:
        start, end = _project_span(p)
        if not start:
            continue          # 생성일이 아예 없으면 선을 그릴 수 없다
        div = (p.division or '(미지정)').strip() or '(미지정)'
        spans.append((start, end, div))
        if 'createdAt' in ((p.extra_fields or {}).get(_SYNTH_KEY) or []):
            est_by_date[start][div] += 1

    # 눈금은 **뭔가 달라진 날만**. 매일 찍으면 값이 같은 점이 수백 개 생기고,
    # 계단 차트에서는 그것들이 아무 정보도 더하지 않는다.
    marks = {s for s, _e, _d2 in spans} | {e for _s, e, _d2 in spans if e}
    today = today_kst().isoformat()

    # 연도를 고르면 **그 해 1월 1일부터 12월 31일까지**를 축으로 잡는다 —
    # 해마다 축이 달라지면 두 해를 견줄 수가 없다. 그 해 밖의 눈금은 뺀다
    # (2025년에 만들어진 과제는 1월 1일 값에 이미 들어 있다).
    year_start = year_end = None
    if years:
        nums = [int(y) for y in years if str(y).isdigit()]
        if len(nums) == 1:
            year_start = f'{nums[0]}-01-01'
            year_end = f'{nums[0]}-12-31'
            marks = {m for m in marks if year_start <= m <= year_end}
            marks |= {year_start, year_end}
    if year_start is None:
        marks.add(today)
    elif year_start <= today <= year_end:
        marks.add(today)
    dates = sorted(marks)

    # 사업부 순서는 **설정의 표준 순서**(`divisions.order`)를 따른다.
    # 가나다·알파벳으로 늘어놓으면 다른 화면과 범례 순서가 달라 눈이 헷갈린다.
    #
    # ⚠️ **활성 행만** 본다. 설정을 저장할 때마다 옛 행이 쌓여서 같은 이름이 여러 번
    #    나온다(개발 DB: MX 가 3번, 비활성 'CS2' 까지). 안 거르면 어느 행의 `order`
    #    가 이기는지가 우연에 달린다 — `_kpi_owner_divisions` 도 같은 이유로 거른다.
    ordered = (Division.query.filter(Division.is_active.is_(True))
               .order_by(Division.order.asc(), Division.id.asc()).all())
    rank, colors = {}, {}
    for i, d in enumerate(ordered):
        rank.setdefault(d.name, i)          # 같은 이름이 또 나오면 **먼저 것**이 이긴다
        colors.setdefault(d.name, d.color)
    names = sorted({d for _s, _e, d in spans},
                   key=lambda n: (rank.get(n, 10_000), n))

    series = []
    for div in names:
        mine = [(s, e) for s, e, d in spans if d == div]
        counts = []
        for day in dates:
            # 아직 오지 않은 날은 **비워 둔다.** 0 이나 마지막 값을 채우면
            # 12월까지 선이 이어져 "앞으로도 이렇다" 로 읽힌다.
            if day > today:
                counts.append(None)
                continue
            counts.append(sum(1 for s, e in mine if s <= day and (e is None or day < e)))
        series.append({'division': div, 'color': colors.get(div), 'counts': counts})

    return {
        'dates': dates,
        'series': series,
        'total': [None if dates[i] > today
                  else sum((s['counts'][i] or 0) for s in series)
                  for i in range(len(dates))],
        # 화면이 "오늘까지만 그린다" 를 안내할 수 있게 알려준다
        'today': today,
        'range': {'from': year_start or (dates[0] if dates else None),
                  'to': year_end or (dates[-1] if dates else None)},
        # 이관으로 생성일이 찍힌 날. 화면이 그 자리에 "이관" 이라고 표시한다.
        'estimated': [{'date': d, 'byDivision': dict(v), 'total': sum(v.values())}
                      for d, v in sorted(est_by_date.items())],
        'basis': ('완료를 포함한 그날 존재하던 과제 수입니다. '
                  '휴지통에 들어간 날, 취소된 날부터는 빠집니다.'),
        'projectCount': len(projects),
    }


def performance_trend(actor, years=None, divisions=None):
    """
    **성과 속성 카드**별 시계열. 값은 **환산 전 원본**이다.

    카드가 이미 정해 놓은 것을 그대로 따른다 — 어떤 성과를 묶을지
    (`selected_perf_keys`), 합계인지 평균인지(`logic`), 어느 사업부 기준인지
    (`division`, 환산 배율이 사업부마다 다를 수 있다).

    화면이 할 일: 날짜마다 각 성과의 `actual` 에 `applyConversion` 을 걸고
    카드의 `logic` 대로 합치는 것. **그 계산을 여기서 하지 않는다**(파일 머리말 참조).
    """
    # 가시성 — **성과에는 안 건다.**
    #
    #   과제는 `is_division_public` 으로 가려지지만(`filterByVisibility`),
    #   **성과에는 그런 장치가 없다.** 「모든 성과 현황」과 KPI 대시보드가 이미 전사에
    #   전부 보여준다. 그러니 이 화면에서만 막으면 다른 화면과 어긋난다.
    #
    #   ⚠️ 처음엔 관계도처럼 "볼 수 있는 과제에 걸린 성과만" 으로 짰다. 그런데
    #      **성과를 지우면 과제 연결이 함께 정리돼** 이력이 통째로 사라졌다
    #      (개발 DB: 카드 9개 중 8개가 빈 채로 나왔다). 관계도는 성과가 과제에
    #      매달린 노드라 그 기준이 맞지만, 여기서는 카드가 주인공이라 다르다.
    cq = KPIDashboardCard.query.filter(KPIDashboardCard.is_active.is_(True))
    if years:
        nums = [int(y) for y in years if str(y).isdigit()]
        if nums:
            cq = cq.filter(KPIDashboardCard.year.in_(nums))
    if divisions:
        # 카드의 사업부가 '전체' 면 어느 필터에서도 남긴다 — 전사 카드다.
        cq = cq.filter(KPIDashboardCard.division.in_(list(divisions) + ['전체']))
    cards = cq.order_by(KPIDashboardCard.order.asc(), KPIDashboardCard.id.asc()).all()

    perfs = {f.uuid: f for f in Dt2Performance.query.all()}
    # 카드는 성과를 여러 이름의 키로 가리킨다(화면 `getLinkedKpiCards` 와 같은 후보들).
    by_key = {}
    for f in perfs.values():
        for k in (f.uuid, f.legacy_uuid, f.id, f.title):
            if k not in (None, ''):
                by_key.setdefault(str(k), f)

    # 성과별 이력 — 날짜 → {현재·목표·실적}. 같은 날 여러 건이면 마지막 것이 그날 값이다.
    #
    # ⚠️ **실적만 보면 안 된다.** 카드는 화면에서 **현재·목표·실적 셋을 다** 보여준다
    #    (`KPIDashboard.computeUnitGroup`). 실적이 비어 있고 현재·목표만 들어간 성과가
    #    흔해서, 실적만 그리면 "화면에는 값이 있는데 차트만 빈" 상태가 된다
    #    (개발 DB: 「개발 비용(DA)」이 현재 4·목표 1.5·실적 없음).
    hist = defaultdict(dict)
    for h in (Dt2PerformanceHistory.query
              .order_by(Dt2PerformanceHistory.observed_at.asc()).all()):
        day = _d(h.observed_at)
        if day:
            hist[h.performance_uuid][day] = {
                'actual': h.actual_level,
                'current': h.current_level,
                'target': h.target_level,
            }

    out_cards = []
    marks = set()
    for card in cards:
        chosen, seen = [], set()
        for raw in (card.selected_perf_keys or []):
            f = by_key.get(str(raw))
            if f is None or f.uuid in seen:
                continue
            # 지워진 성과는 **빼지 않는다.** 과제 곡선과 같은 이치로, 그때는 실제로
            # 있었던 값이다. 대신 아래에서 **지워진 날부터 선을 끊는다** —
            # 안 끊으면 지금도 그만큼 있는 것처럼 합계가 부풀어 오른다.
            seen.add(f.uuid)
            chosen.append(f)
        if not chosen:
            continue
        marks |= {d for f in chosen for d in hist.get(f.uuid, {})}
        # 이력이 한 줄도 없는 성과라도 **오늘 값은 있을 수 있다**(본체에 입력만 하고
        # 그 뒤로 안 바뀐 경우). 오늘은 아래에서 늘 눈금에 넣으므로 여기서는 둔다.
        out_cards.append({'card': card, 'perfs': chosen})

    today = today_kst().isoformat()

    # 과제 쪽과 같은 축을 쓴다 — 두 패널의 가로축이 다르면 나란히 못 읽는다.
    year_start = year_end = None
    if years:
        nums = [int(y) for y in years if str(y).isdigit()]
        if len(nums) == 1:
            year_start = f'{nums[0]}-01-01'
            year_end = f'{nums[0]}-12-31'
            marks = {m for m in marks if year_start <= m <= year_end}
            marks |= {year_start, year_end}
    if year_start is None or year_start <= today <= year_end:
        marks.add(today)
    dates = sorted(marks)

    result = []
    for item in out_cards:
        card, chosen = item['card'], item['perfs']
        rows = []
        for f in chosen:
            h = dict(hist.get(f.uuid, {}))
            gone = _d(f.deleted_at) if f.is_deleted else None

            # 🐞 **오늘 값은 성과 본체가 정본이다.**
            #    이력(`dt2_performance_history`)은 값이 바뀔 때만 쌓이고, 수집을
            #    시작한 것도 2026-07-28 부터다. 그래서 그전에 입력된 성과는 이력에
            #    한 줄도 없어 **선이 아예 안 그려졌다** — 「모든 성과 현황」에는 값이
            #    보이는데 이 차트만 비어 있는 상태가 된다.
            #    지금 값을 오늘 자리에 놓아 두 화면이 같은 숫자를 말하게 한다.
            if not gone:
                live = {'actual': f.actual_level, 'current': f.current_level,
                        'target': f.target_level}
                merged = dict(h.get(today) or {})
                for key, val in live.items():
                    if val not in (None, '') and merged.get(key) in (None, ''):
                        merged[key] = val
                if merged:
                    h[today] = merged

            series = {'actual': [], 'current': [], 'target': []}
            last = {'actual': None, 'current': None, 'target': None}
            for day in dates:
                # 그날 기록이 없으면 **직전 값을 이어간다** — 값은 바뀔 때만
                # 기록되므로, 빈칸으로 두면 선이 끊겨 "값이 사라진" 것처럼 보인다.
                if day in h:
                    for key in series:
                        v = h[day].get(key)
                        if v not in (None, ''):
                            last[key] = v
                for key in series:
                    if day > today or (gone and day >= gone):
                        # 아직 안 온 날 / 지워진 뒤 — 값이 없는 것이다
                        series[key].append(None)
                    else:
                        # 빈 문자열은 **미입력**이다. 그대로 두면 화면이 0 으로 읽어
                        # 합계가 틀어진다 — 없는 값은 없는 값으로 낸다.
                        v = last[key]
                        series[key].append(None if v in (None, '') else str(v))
            rows.append({'uuid': f.uuid, 'title': f.title, 'unit': f.unit,
                         'category': f.category,
                         'actuals': series['actual'],
                         'currents': series['current'],
                         'targets': series['target'],
                         'removedAt': gone,
                         'isMonthly': bool(f.is_monthly)})
        result.append({
            'cardId': card.id, 'name': card.name, 'division': card.division,
            'category': card.category, 'logic': card.logic, 'year': card.year,
            'perfs': rows,
        })

    return {
        'dates': dates,
        'cards': result,
        'today': today,
        'range': {'from': year_start or (dates[0] if dates else None),
                  'to': year_end or (dates[-1] if dates else None)},
        # 화면이 환산·집계를 할 때 쓸 재료. 규칙 자체는 설정에서 따로 읽는다.
        'note': ('값은 **환산 전 원본**입니다. 단위 환산과 합계·평균은 화면이 '
                 '기존 규칙(applyConversion)으로 계산합니다.'),
        'cardCount': len(result),
    }


def project_ai_history(actor, years=None, divisions=None):
    """
    과제별 **액션아이템 분모ㆍ분자의 시계열**. 그때 실제로 몇 개였고 몇 개가
    끝나 있었나.

    화면이 왜 이걸 필요로 하나
        진척률의 과거 값을 **오늘 데이터로 되짚으면 틀린다.** 되짚기는 오늘
        남아 있는 항목만 볼 수 있어서, 그동안 지워진 항목은 분모에도 분자에도
        안 들어간다. 완료 체크를 되돌렸거나 완료일을 고친 것도 과거를 흔든다.
        곧 되짚은 값은 '지금 기준으로 본 과거' 이지 '그때의 값' 이 아니다.
        (Dt2ProjectHistory 의 주석이 같은 말을 한다 — 이 표는 그래서 있다.)

        그래서 서버는 **그 시점의 분자ㆍ분모를 그대로** 돌려주고, 화면은
        되짚기를 그만둔다.

    ⚠️ **합계도 진척률도 여기서 내지 않는다.** 무엇을 모수로 삼을지(취소 포함
       여부, 삭제 시점, 사업부 묶음)는 화면이 이미 정하고 있고, 여기서 다시
       정하면 두 곳이 다른 숫자를 말하는 날이 온다. 이 파일의 다른 함수들과
       같은 규칙이다.

    ⚠️ 하루에 여러 번 바뀐 날은 **그날 마지막 값만** 남긴다. 화면이 날짜
       단위로 '그 날짜 이전 마지막 값' 을 찾기 때문에 그 앞의 것은 쓰이지
       않는다. 그대로 보내면 덩치만 커진다.

    이력이 없는 과제는 `missing` 에 담아 함께 보낸다 — 화면이 그것만 예전
    방식(되짚기)으로 떨어뜨릴 수 있어야 한다. 조용히 빼면 그 과제가 기준일
    집합에서 통째로 사라져, 지금 고치려는 바로 그 병이 다시 생긴다.
    """
    q = Dt2Project.query
    if years:
        nums = [int(y) for y in years if str(y).isdigit()]
        if nums:
            q = q.filter(Dt2Project.year.in_(nums))
    if divisions:
        q = q.filter(Dt2Project.division.in_(divisions))
    # 지워진 과제도 가져온다. 기준일에는 살아 있었을 수 있고, 그때 값이 필요하다.
    projects = [p for p in q.all() if P.can_view_project(actor, p)]
    if not projects:
        return {'series': [], 'missing': [], 'projectCount': 0, 'rowCount': 0}

    by_uuid = {p.uuid: p for p in projects}
    rows = (Dt2ProjectHistory.query
            .filter(Dt2ProjectHistory.project_uuid.in_(list(by_uuid.keys())))
            .order_by(Dt2ProjectHistory.observed_at.asc(), Dt2ProjectHistory.id.asc())
            .all())

    # 과제 → 날짜 → 그날 마지막 값
    per = defaultdict(dict)
    for h in rows:
        d = _d(h.observed_at)
        if not d:
            continue
        per[h.project_uuid][d] = {
            'date': d,
            'total': int(h.action_total or 0),
            'done': int(h.action_done or 0),
            'status': h.status,
            'progress': h.progress,
        }

    series, missing, row_count = [], [], 0
    for uuid, p in by_uuid.items():
        days = per.get(uuid)
        if not days:
            missing.append(uuid)
            continue
        ordered = [days[d] for d in sorted(days)]
        row_count += len(ordered)
        series.append({
            'uuid': uuid,
            'division': (p.division or '(미지정)').strip() or '(미지정)',
            'year': p.year,
            'rows': ordered,
        })

    return {
        'series': series,
        'missing': missing,
        'projectCount': len(by_uuid),
        'rowCount': row_count,
        'note': ('그 시점에 저장된 액션아이템 분자ㆍ분모입니다. 되짚은 값이 아닙니다. '
                 'missing 에 담긴 과제는 이력이 없으니 화면이 예전 방식으로 처리해야 합니다.'),
    }
