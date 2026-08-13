"""
DX KPI 달성률 — **계산 규칙의 단일 출처**

왜 이 파일이 생겼나 (2026-08-01)
    달성률 구현이 화면마다 따로 있었고, 둘이 달랐다.
      · DT 대시보드 '전체 요약'   direction 반영     (DashboardView.jsx:6150)
      · DX KPI 관리 '종합 데이터'  direction 무시 ✗  (DxKpiManagementApp.jsx:729)
    그래서 망소 지표의 달성률이 종합표에서 뒤집혀 있었다. 실측:
      라인 유실률 MX Q1  목표 1% / 실적 2%  → 200% 로 표시(초록). 실제는 50%(빨강).
      Lead Time  MX Q1  목표 10일 / 실적 7.6일 → 76% 로 표시(빨강). 실제는 131.6%(초록).
    숫자만 틀린 게 아니라 **색이 정확히 반대**였다. 매트릭스가 셀을 색으로 칠하기
    시작하면 그 거짓말이 그대로 보고에 올라간다. 그래서 규칙을 여기 한 곳에 모은다.

망대 / 망소 (`KpiDefinition.direction`)
    higher  달성률 = 실적 / 목표      (가상 검증률·OTP율 …)
    lower   달성률 = 목표 / 실적      (Lead Time·라인 유실률·ASR …)
    망소는 "목표보다 낮게" 가 잘한 것이므로 분자·분모가 뒤집힌다.

'실적 없음' 과 '목표 없음' 을 구분한다
    매트릭스에서 이 둘은 다른 안건이다 —
      목표 없음  아직 목표를 안 세웠다 (관리 시작 전)
      실적 없음  목표는 있는데 측정을 안 하고 있다
    하나로 뭉개면 "어디부터 채워야 하는가" 를 화면이 말해주지 못한다.

숫자가 문자열인 이유
    kpi_records.value · kpi_targets.target_value 가 String 컬럼이다. 사람이
    '-' · '미측정' 같은 값을 넣기도 한다. 파싱 실패는 예외가 아니라 **없음**으로 본다.
"""

from __future__ import annotations

# 달성 판정 경계. 종합표(DxKpiManagementApp.jsx:2557)가 쓰던 값을 그대로 가져왔다 —
# 화면마다 경계가 다르면 같은 칸이 어디선 노랑, 어디선 빨강이 된다.
NEAR_THRESHOLD = 80.0
OK_THRESHOLD = 100.0

# 분기 → 월, 월 → 분기. 목표는 분기로만 세우고 실적은 월로 쌓는 경우가 많아
# 목표를 찾을 때 한 단계 올려서 다시 본다.
QUARTERS = ('Q1', 'Q2', 'Q3', 'Q4')
MONTHS = tuple(f'{m}월' for m in range(1, 13))
MONTH_TO_QUARTER = {f'{m}월': QUARTERS[(m - 1) // 3] for m in range(1, 13)}


def to_number(v):
    """문자열/숫자 → float. 비었거나 숫자가 아니면 None (예외를 던지지 않는다)."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip()
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def target_number(entry):
    """
    목표 1건 → 숫자.

    `kpi_targets` 는 값(value)과 분자/분모를 따로 들고 있다. 분수로만 입력된 목표는
    value 가 비어 있으므로 분자/분모로 계산해야 한다 — 안 그러면 '목표 없음' 이 된다.
    (DxKpiManagementApp.getTargetValue 가 value 만 봐서 생기던 구멍. 현재 해당
     데이터는 0건이지만, 입력 화면이 분수를 받으므로 언제든 생긴다)
    """
    if entry is None:
        return None
    if isinstance(entry, dict):
        v = to_number(entry.get('value'))
        if v is not None:
            return v
        num = to_number(entry.get('numerator'))
        den = to_number(entry.get('denominator'))
        if num is not None and den not in (None, 0):
            return num / den
        return None
    return to_number(entry)


def achievement(target, actual, direction='higher'):
    """
    달성률(%). 계산할 수 없으면 None.

    목표가 0이면 나눌 수 없고, 망소에서 실적이 0이면 역시 나눌 수 없다.
    '무한대 달성' 으로 만들지 않고 없음으로 둔다 — 100%를 넘는 값이 표에 섞이면
    평균·정렬이 조용히 망가진다.
    """
    t = to_number(target)
    a = to_number(actual)
    if t is None or a is None or t == 0:
        return None
    if (direction or 'higher') == 'lower':
        if a == 0:
            return None
        return (t / a) * 100.0
    return (a / t) * 100.0


def status(rate, *, has_target, has_actual, applicable=True):
    """
    셀 하나의 상태. 매트릭스의 색이 이 값 하나로 정해진다.

        n_a        이 사업부가 관리하지 않는 지표 (구조적 빈칸 — 구멍이 아니다)
        no_target  목표 미설정
        no_data    목표는 있는데 실적이 없음
        miss / near / ok
    """
    if not applicable:
        return 'n_a'
    if not has_target:
        return 'no_target'
    if not has_actual or rate is None:
        return 'no_data'
    if rate >= OK_THRESHOLD:
        return 'ok'
    if rate >= NEAR_THRESHOLD:
        return 'near'
    return 'miss'


def pick_latest(records, up_to=None):
    """
    가장 최근 실적 1건. `up_to` 가 있으면 그 날짜 이하만 본다.

    같은 날짜가 여럿이면 나중에 입력된 것(id 큰 쪽)을 쓴다 — 정정 입력이
    원본을 이기게 하려는 것이다. 종합표·전체 요약이 이미 같은 규칙을 쓴다.
    """
    latest = None
    for r in records:
        base = r.get('baseDate') if isinstance(r, dict) else getattr(r, 'base_date', None)
        if not base:
            continue
        if up_to is not None and base > up_to:
            continue
        if latest is None:
            latest = r
            continue
        lbase = latest.get('baseDate') if isinstance(latest, dict) else latest.base_date
        rid = r.get('id') if isinstance(r, dict) else r.id
        lid = latest.get('id') if isinstance(latest, dict) else latest.id
        if base > lbase or (base == lbase and (rid or 0) > (lid or 0)):
            latest = r
    return latest


def yearly_target(targets, division, year, label):
    """
    연 목표 — Q4 → Q3 → Q2 → Q1 순으로 **처음 나오는 유효값**.

    분기 목표를 합산하지 않는다. 대부분이 비율 지표라 더해도 뜻이 없고, 연말 목표가
    그 해의 도달점이기 때문이다. DT 대시보드 '전체 요약'(DashboardView:6115)이
    쓰던 규칙 그대로다 — 매트릭스가 같은 질문("올해 잘 가고 있나")에 답하므로 같아야 한다.
    """
    for q in reversed(QUARTERS):
        v = target_number(targets.get(f'{division}|{year}|{label}|{q}'))
        if v is not None:
            return v
    return None


def period_target(targets, division, year, label, period):
    """
    특정 기간의 목표. 그 기간에 없으면 **분기로 한 단계 올려** 다시 본다.

    월 단위로 목표를 다 적는 조직은 드물다. 폴백이 없으면 월 뷰가 통째로 '목표 없음'
    이 된다. 종합표(DxKpiManagementApp:876)와 같은 폴백이다.
    """
    v = target_number(targets.get(f'{division}|{year}|{label}|{period}'))
    if v is not None:
        return v
    q = MONTH_TO_QUARTER.get(period)
    if q:
        return target_number(targets.get(f'{division}|{year}|{label}|{q}'))
    return None


def change_of(prev, cur, direction='higher'):
    """
    직전 대비 어느 쪽으로 움직였나 — 'better' | 'worse' | 'same' | None.

    왜 boolean 이 아닌가
        처음엔 '좋아졌는가'(True/False)로 만들었는데, False 가 **악화와 변화없음을
        한데 묶어** 버렸다. 실측에서 가상 검증률 VD 가 25 → 9.09 로 급락한 칸과
        아무 변화 없는 칸이 화면에 똑같이 보였다. 셋은 다른 소식이라 나눈다.

    왜 화면에 맡기지 않나
        망소 지표는 값이 **내려가야** 좋아진 것이다. 화면이 이걸 다시 판단하면
        방금 한 곳으로 모은 망대/망소 규칙이 또 갈리고, 그때는 숫자가 아니라
        **화살표 방향이 거짓말을 한다.**
    """
    p = to_number(prev)
    c = to_number(cur)
    if p is None or c is None:
        return None
    if p == c:
        return 'same'
    rose = c > p
    good = (not rose) if (direction or 'higher') == 'lower' else rose
    return 'better' if good else 'worse'


def monthly_series(records, year):
    """
    월별 실적 12칸. 그 달에 기록이 없으면 None (0 이 아니다 — 0 은 측정값이다).

    스파크라인용이다. 셀 하나가 "지금 얼마" 만 말하면 목표에 다가가는 중인지
    멀어지는 중인지 알 수 없다. 같은 40% 라도 30→40 과 50→40 은 다른 얘기다.
    """
    best = [None] * 12
    for r in records:
        base = r.get('baseDate') if isinstance(r, dict) else getattr(r, 'base_date', None)
        if not base or not str(base).startswith(str(year)):
            continue
        try:
            mi = int(str(base)[5:7]) - 1
        except ValueError:
            continue
        if not 0 <= mi <= 11:
            continue
        cur = best[mi]
        rid = r.get('id') if isinstance(r, dict) else r.id
        if cur is None or base > cur[0] or (base == cur[0] and (rid or 0) > cur[1]):
            val = to_number(r.get('value') if isinstance(r, dict) else r.value)
            best[mi] = (base, rid or 0, val)
    return [b[2] if b else None for b in best]


def previous_period(period):
    """'Q3' → 'Q2', '7월' → '6월'. 연초 이전은 None (전년도까지 보지 않는다)."""
    if period in QUARTERS:
        i = QUARTERS.index(period)
        return QUARTERS[i - 1] if i > 0 else None
    if period in MONTHS:
        i = MONTHS.index(period)
        return MONTHS[i - 1] if i > 0 else None
    return None


def period_of(base_date, kind='quarter'):
    """
    기준일('YYYY-MM-DD') → 그 날이 속한 기간 이름. 못 읽으면 None.

    문자열을 자르는 이유는 `base_date` 가 String 컬럼이기 때문이다. 날짜로 파싱하면
    '2026-07' 같은 반쪽 값에서 예외가 나는데, 그건 버릴 게 아니라 월까지는 쓸 수 있다.
    """
    if not base_date or len(str(base_date)) < 7:
        return None
    try:
        month = int(str(base_date)[5:7])
    except ValueError:
        return None
    if not 1 <= month <= 12:
        return None
    return MONTHS[month - 1] if kind == 'month' else QUARTERS[(month - 1) // 3]


def period_kind(period):
    """'Q3' → 'quarter', '7월' → 'month'. 그 외는 None."""
    if period in QUARTERS:
        return 'quarter'
    if period in MONTHS:
        return 'month'
    return None


def is_applicable(kpi_divisions, division_code):
    """
    이 지표가 이 사업부에서 측정되는가.

    `KpiDefinition.divisions` 가 비어 있으면 전사 공통이다. 값이 있으면 그 사업부
    전용이라 다른 열은 **구조적으로** 비어 있는 게 정상이다 — 이걸 구멍으로 세면
    가짜 경고가 대량으로 생긴다.
    """
    scope = kpi_divisions or []
    if not scope:
        return True
    return division_code in scope
