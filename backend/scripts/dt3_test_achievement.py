"""
달성률 구현 **두 벌이 갈리지 않는지** 대조한다.

왜 이 시험이 필요한가
    계산 자체는 나눗셈 한 줄이라 어렵지 않다. 어려운 것은 **같게 유지하는 일**이다.
    2026-08-01 이전에 이미 갈려 있었다 —
      · DT 대시보드 '전체 요약'    direction 반영     (맞음)
      · DX KPI 관리 '종합 데이터'  direction 무시     (틀림)
    같은 지표가 두 화면에서 다른 숫자로, 심지어 **반대 색으로** 보였다.
    (라인 유실률 MX 목표1%/실적2% → 한쪽 200% 초록, 실제는 50% 빨강)

무엇을 대조하나
    정본  backend/app/modules/dx_kpi_management/achievement.py   (파이썬)
    사본  frontend/src/shared/utils/kpiAchievement.js            (자바스크립트)

    매트릭스는 서버 계산을 그대로 그리므로 사본이 필요 없지만, 'KPI 종합 데이터'
    표는 분기·월·주 세 축에 Excel 3종까지 화면에서 만든다. 그래서 사본을 두되
    **갈리는 순간 이 시험이 깨지도록** 한다. 규칙을 고치면 양쪽을 같이 고친다.

    이 시험이 깨지면 **두 파일을 맞추라는 뜻**이지 시험을 고치라는 뜻이 아니다.

실행: python scripts\\dt3_test_achievement.py   (node 필요)
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys

_BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _BACKEND)

from app.modules.dx_kpi_management import achievement as A     # noqa: E402

_JS = os.path.join(os.path.dirname(_BACKEND), 'frontend', 'src', 'shared',
                   'utils', 'kpiAchievement.js')

# (목표, 실적, 방향) — 경계·부호·0·빈값·문자열을 고루 덮는다.
CASES = [
    # 망대
    ('100', '120', 'higher'), ('100', '100', 'higher'), ('100', '80', 'higher'),
    ('100', '79.9', 'higher'), ('100', '0', 'higher'),
    # 망소 — 여기가 갈렸던 자리다
    ('10', '7.6', 'lower'), ('1', '2', 'lower'), ('2', '3', 'lower'),
    ('10', '10', 'lower'), ('10', '12.5', 'lower'), ('10', '0', 'lower'),
    # 나눌 수 없음 / 값 없음
    ('0', '5', 'higher'), ('0', '5', 'lower'),
    ('', '5', 'higher'), ('5', '', 'higher'), (None, None, 'higher'),
    ('-', '5', 'higher'), ('미측정', '5', 'lower'),
    # 공백·부호
    ('  100  ', ' 90 ', 'higher'), ('100', '-10', 'higher'),
    # 방향 미지정 → 망대로 떨어져야 한다
    ('100', '120', None),
]

# (직전, 현재, 방향) — 값의 방향과 **좋고 나쁨**이 갈리는 자리를 덮는다.
CHANGES = [
    ('40', '45', 'higher'), ('45', '40', 'higher'),
    ('3', '2', 'lower'), ('2', '3', 'lower'),      # 망소: 내려가야 좋다
    ('5', '5', 'higher'), ('5', '5', 'lower'),
    (None, '5', 'higher'), ('5', None, 'lower'), (None, None, 'higher'),
    ('', '5', 'higher'), ('미측정', '5', 'lower'),
    ('0', '1', 'lower'), ('1', '0', 'lower'),
]

# 목표 entry (분수 폴백) 대조
TARGET_ENTRIES = [
    {'value': '80', 'numerator': None, 'denominator': None},
    {'value': '', 'numerator': '300', 'denominator': '400'},
    {'value': None, 'numerator': '1', 'denominator': '0'},
    {'value': None, 'numerator': None, 'denominator': None},
    '75',
    None,
]

fails = []


def check(desc, ok, extra=''):
    print(f"  {'[OK]  ' if ok else '[FAIL]'} {desc}" + (f'\n         {extra}' if not ok else ''))
    if not ok:
        fails.append(desc)


def run_js():
    """node 로 사본을 실행해 같은 입력의 결과를 받아온다."""
    node = shutil.which('node')
    if not node:
        return None
    # Windows 절대경로는 ESM import 에서 file:// URL 이어야 한다 ('F:/…' 는 프로토콜로 읽힌다)
    js_url = 'file:///' + _JS.replace(os.sep, '/').lstrip('/')
    script = f"""
import {{ achievement, targetNumber, status, changeOf, NEAR_THRESHOLD, OK_THRESHOLD }}
  from {json.dumps(js_url)};
const cases = {json.dumps(CASES)};
const entries = {json.dumps(TARGET_ENTRIES)};
const changes = {json.dumps(CHANGES)};
const out = {{
  thresholds: [NEAR_THRESHOLD, OK_THRESHOLD],
  rates: cases.map(([t, a, d]) => achievement(t, a, d === null ? undefined : d)),
  targets: entries.map((e) => targetNumber(e)),
  statuses: cases.map(([t, a, d]) => {{
    const r = achievement(t, a, d === null ? undefined : d);
    return status(r, {{ hasTarget: t !== null && t !== '', hasActual: a !== null && a !== '' }});
  }}),
  changes: changes.map(([p, c, d]) => changeOf(p, c, d === null ? undefined : d)),
}};
console.log(JSON.stringify(out));
"""
    tmp = os.path.join(_BACKEND, 'scripts', '_ach_probe.mjs')
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write(script)
    try:
        r = subprocess.run([node, tmp], capture_output=True, text=True,
                           encoding='utf-8', errors='replace')
        if r.returncode != 0:
            print(r.stdout)
            print(r.stderr)
            return False
        return json.loads(r.stdout.strip().splitlines()[-1])
    finally:
        os.remove(tmp)


def close(a, b):
    """부동소수 비교. 둘 다 None 이면 같다."""
    if a is None or b is None:
        return a is None and b is None
    return abs(a - b) < 1e-9


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    print('=' * 72)
    print(' 달성률 — 정본(achievement.py) vs 사본(kpiAchievement.js) 대조')
    print('=' * 72)

    js = run_js()
    if js is None:
        print('\n[SKIP] node 를 찾을 수 없어 대조를 건너뜁니다.')
        print('       파이썬 쪽 규칙만 확인합니다.')
    elif js is False:
        print('\n[FAIL] 사본(js)을 실행하지 못했습니다.')
        return 1

    print('\n[1] 파이썬 쪽 규칙 — 망소가 뒤집혀 계산되는가')
    check('망소: 목표10 실적7.6 → 131.6%',
          round(A.achievement('10', '7.6', 'lower'), 1) == 131.6)
    check('망대: 목표10 실적7.6 → 76.0%',
          round(A.achievement('10', '7.6', 'higher'), 1) == 76.0)
    check('망소: 목표1 실적2 → 50.0% (미달)',
          round(A.achievement('1', '2', 'lower'), 1) == 50.0)
    check('망소에서 실적 0 → 없음', A.achievement('10', '0', 'lower') is None)
    check('목표 0 → 없음', A.achievement('0', '5', 'higher') is None)
    check('숫자가 아니면 없음', A.achievement('미측정', '5', 'higher') is None)
    check("분수만 있는 목표 → 0.75",
          close(A.target_number({'value': '', 'numerator': '300',
                                 'denominator': '400'}), 0.75))
    check('상태: 목표 없음 → no_target',
          A.status(None, has_target=False, has_actual=True) == 'no_target')
    check('상태: 목표만 있고 실적 없음 → no_data',
          A.status(None, has_target=True, has_actual=False) == 'no_data')
    check('상태: 해당 없음이 최우선 → n_a',
          A.status(120, has_target=True, has_actual=True, applicable=False) == 'n_a')
    check('경계: 정확히 80 → near', A.status(80.0, has_target=True, has_actual=True) == 'near')
    check('경계: 정확히 100 → ok', A.status(100.0, has_target=True, has_actual=True) == 'ok')

    print('\n[1-2] 직전 대비 — 값의 방향과 좋고 나쁨이 다르다')
    check('망소: 3→2 (내려감) = 개선', A.change_of('3', '2', 'lower') == 'better')
    check('망소: 2→3 (올라감) = 악화', A.change_of('2', '3', 'lower') == 'worse')
    check('망대: 40→45 = 개선', A.change_of('40', '45', 'higher') == 'better')
    check('망대: 45→40 = 악화', A.change_of('45', '40', 'higher') == 'worse')
    check('변화 없음은 악화와 구분된다', A.change_of('5', '5', 'higher') == 'same')
    check('직전이 없으면 판단 불가', A.change_of(None, '5', 'higher') is None)

    if isinstance(js, dict):
        print('\n[2] 두 구현이 같은 답을 내는가')
        check('경계값(80·100)이 같다',
              js['thresholds'] == [A.NEAR_THRESHOLD, A.OK_THRESHOLD],
              f"js={js['thresholds']} py=[{A.NEAR_THRESHOLD}, {A.OK_THRESHOLD}]")

        bad = []
        for (t, a, d), jrate in zip(CASES, js['rates']):
            prate = A.achievement(t, a, d or 'higher')
            if not close(prate, jrate):
                bad.append(f'({t!r},{a!r},{d!r}) py={prate} js={jrate}')
        check(f'달성률 {len(CASES)}건 일치', not bad, '\n         '.join(bad))

        bad = []
        for e, jt in zip(TARGET_ENTRIES, js['targets']):
            pt = A.target_number(e)
            if not close(pt, jt):
                bad.append(f'{e!r} py={pt} js={jt}')
        check(f'목표값 해석 {len(TARGET_ENTRIES)}건 일치', not bad, '\n         '.join(bad))

        bad = []
        for (t, a, d), jst in zip(CASES, js['statuses']):
            prate = A.achievement(t, a, d or 'higher')
            pst = A.status(prate,
                           has_target=t not in (None, ''),
                           has_actual=a not in (None, ''))
            if pst != jst:
                bad.append(f'({t!r},{a!r},{d!r}) py={pst} js={jst}')
        check(f'상태 판정 {len(CASES)}건 일치', not bad, '\n         '.join(bad))

        bad = []
        for (p, c, d), jch in zip(CHANGES, js['changes']):
            pch = A.change_of(p, c, d or 'higher')
            if pch != jch:
                bad.append(f'({p!r},{c!r},{d!r}) py={pch} js={jch}')
        check(f'직전 대비 판정 {len(CHANGES)}건 일치', not bad, '\n         '.join(bad))

    print('\n' + '=' * 72)
    if fails:
        print(f' 결과: [FAIL] {len(fails)}건')
        for f in fails:
            print(f'   - {f}')
        print('\n 두 파일을 맞추세요. 시험을 고치는 것이 아닙니다.')
        print('   정본 backend/app/modules/dx_kpi_management/achievement.py')
        print('   사본 frontend/src/shared/utils/kpiAchievement.js')
    else:
        print(' 결과: [OK] 전부 통과')
    print('=' * 72)
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
