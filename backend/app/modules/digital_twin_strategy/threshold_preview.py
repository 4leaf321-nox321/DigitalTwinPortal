"""
⚙ 임계값 미리보기 — 「이 값이면 몇 건인가」.

임계값 스물한 개가 **전부 짐작**이다. 어느 값이 맞는지는 실제 데이터를 봐야
알 수 있는데, 지금까지는 값을 바꾸고 → 저장하고 → 진단 화면으로 가서 → 목록을
눈으로 세는 수밖에 없었다. 그러면 아무도 안 고친다.

⚠️ **규칙을 다시 구현하지 않는다.** 여기서 "이 값이면 대충 이 정도" 를 따로
   계산하면, 미리보기와 실제 화면이 다른 숫자를 말하는 날이 온다. 대신
   `build_plan_payload()` 를 **후보 값으로 다시 부른다.** 느리더라도 그게 맞다 —
   이 모듈이 임계값을 한 곳에 모으고, 기획서가 본문을 안 베끼는 것과 같은 이유다.

⚠️ **한 번에 하나만 본다.** 스물한 개를 전부 훑으면 마흔 번 넘게 다시 계산해야
   해서 설정 화면이 삼 초쯤 멈춘다(실측). 사람은 한 번에 값 하나를 만지므로,
   **고른 값 하나만** 범위 전체로 훑는다. ±한 칸만 보여주는 것보다 낫다 —
   그 근처에서 아무것도 안 바뀌는 값이 실제로 많고, 그때 한 칸씩 보여주면
   "안 바뀐다"만 알 뿐 어디로 가야 하는지는 모른다.

⚠️ 근거 원천은 한 번만 읽는다(`_ReadOnce`). 같은 해의 과제 목록을 아홉 번
   읽을 이유가 없다.
"""
from .definitions import THRESHOLDS, threshold_step, threshold_counts

# 한 값을 훑을 때 찍어 볼 점의 수. 아홉이면 곡선의 모양이 보이면서 1초 안에
# 끝난다. 늘리면 더 촘촘해지지만 그만큼 기다린다.
MAX_POINTS = 9

# ④ 화면·기획서와 같은 기준. 세 곳에 두면 갈라진다.
_HIGH = 4


class _ReadOnce:
    """근거 원천을 감싸 **같은 질의를 두 번 하지 않게** 한다.

    임계값이 바뀌어도 과제와 KPI 는 그대로다. 읽는 것은 한 번이면 된다.
    """

    def __init__(self, inner):
        self._inner = inner
        self._projects = {}
        self._kpis = {}

    @property
    def mode(self):
        return self._inner.mode

    def get_projects(self, year):
        if year not in self._projects:
            self._projects[year] = self._inner.get_projects(year)
        return self._projects[year]

    def get_kpis(self, year):
        if year not in self._kpis:
            self._kpis[year] = self._inner.get_kpis(year)
        return self._kpis[year]


def _counts(payload):
    """한 벌의 계산 결과에서 셀 만한 것들."""
    solutions = payload.get('solutions') or []
    return {
        'findings': len(payload.get('findings') or []),
        'issueCandidates': len(payload.get('issueCandidates') or []),
        'elementCandidates': len(payload.get('elementCandidates') or []),
        'nowSolutions': sum(
            1 for s in solutions
            if (s.get('impact') or 0) >= _HIGH
            and (s.get('feasibility') or 0) >= _HIGH),
    }


def _spec(key):
    for t in THRESHOLDS:
        if t['key'] == key:
            return t
    return None


def _points(spec, now):
    """훑어 볼 값들. **지금 값은 반드시 넣는다** — 기준이 없으면 비교가 안 된다."""
    step = threshold_step(spec)
    top = float(spec.get('max', 100))
    low = step if spec.get('unit') == '단계' else 0.0

    span = top - low
    stride = step
    # 칸이 너무 많으면 걸음을 넓혀 아홉 점 안에 담는다. 걸음의 배수로만
    # 넓혀서, 찍히는 값이 사람이 실제로 넣을 수 있는 값과 어긋나지 않게 한다.
    while span / stride + 1 > MAX_POINTS:
        stride += step

    values = []
    v = low
    while v <= top + 1e-9:
        values.append(round(v, 3))
        v += stride
    if now is not None and round(float(now), 3) not in values:
        values.append(round(float(now), 3))
    return sorted(values)


def summarize(plan, build, values, source):
    """지금 설정으로 몇 건인가. **한 번만 계산한다** — 설정 화면을 열 때 쓴다."""
    return _counts(build(plan, thresholds=values, source=_ReadOnce(source)))


def curve(plan, build, values, source, key):
    """값 하나를 범위 전체로 훑는다.

    돌려주는 것:
        key      어느 값인가
        counts   무엇을 세는가 (findings / elementCandidates / nowSolutions)
        now      지금 값
        points   [{value, count}] — 지금 값이 반드시 들어 있다
        flat     범위 전체에서 건수가 안 바뀌는가. **이게 참이면 이 값을
                 어떻게 움직여도 소용없다** — 규칙이 잠들어 있거나 데이터가
                 그 근처에 없다는 뜻이고, 그 사실을 아는 것이 조정에 필요하다
    """
    spec = _spec(key)
    if not spec:
        raise ValueError(f'알 수 없는 임계값입니다: {key}')

    once = _ReadOnce(source)
    field = threshold_counts(key)
    now = values.get(key, spec['default'])

    points = []
    for value in _points(spec, now):
        got = _counts(build(plan, thresholds={**values, key: value},
                            source=once))
        points.append({'value': value, 'count': got[field]})

    counts = {p['count'] for p in points}
    return {
        'key': key,
        'counts': field,
        'now': round(float(now), 3),
        'points': points,
        'flat': len(counts) <= 1,
    }
