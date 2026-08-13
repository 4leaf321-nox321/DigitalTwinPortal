"""KPI 이름 짝짓기 AI (`dx_kpi_management/name_ai.py`).

이 시험이 지키는 것은 "AI 가 잘 맞힌다" 가 **아니다.** 그건 운영 모델에 달렸고
여기서는 확인할 방법도 없다. 지키는 것은 셋이다:

    ① **목록 밖 이름은 버린다.** 모델이 없는 KPI 를 지어내는 일은 실제로 일어난다.
       그게 통과하면 화면에 존재하지 않는 지표가 뜨고, 사람이 그걸 고르면
       엉뚱한 데 값이 들어간다.
    ② **묻지 않은 것에는 답을 안 받는다.** 모델이 목록을 늘려 오는 것도 막는다.
    ③ **AI 가 없어도 무너지지 않는다.** 운영 LLM 은 403 으로 막혀 있을 수 있다.
       그때도 `{ok: False, reason}` 으로 조용히 돌아와야 반입이 계속된다.

⚠️ 개발서버에는 GLM 이 없다. `scripts/llm_stub.py` 를 띄우고 돌린다 — 스텁은
   글자 겹침으로 고를 뿐이지만, **응답 파싱·검증 경로는 진짜 코드가 그대로** 탄다.

실행: python scripts\\dxkpi_test_name_ai.py
"""
from __future__ import annotations

import os
import subprocess
import sys
import time

import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app                                        # noqa: E402
from app.modules.dx_kpi_management import name_ai                 # noqa: E402

PORT = 9107
BASE = f'http://127.0.0.1:{PORT}/v1'

DEFS = [
    {'label': '가상 검증률', 'category': '개발', 'unit': '%'},
    {'label': 'One Time Pass율', 'category': '개발', 'unit': '%'},
    {'label': '시험 완료 Lead Time', 'category': '개발', 'unit': '일'},
    {'label': '데이터 연결률', 'category': '제조', 'unit': '%'},
]

fails = []


def check(desc, ok, extra=''):
    print(f"  {'[OK]  ' if ok else '[FAIL]'} {desc}" + (f'   {extra}' if not ok and extra else ''))
    if not ok:
        fails.append(desc)


def start_stub():
    proc = subprocess.Popen(
        [sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'llm_stub.py'),
         '--port', str(PORT)],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(60):
        try:
            if requests.get(f'{BASE}/models', timeout=1).ok:
                return proc
        except requests.RequestException:
            time.sleep(0.25)
    proc.terminate()
    raise RuntimeError('스텁이 안 떴습니다.')


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    app = create_app()

    # ── ① AI 가 꺼져 있을 때 ────────────────────────────────────────────
    print('── AI 가 없을 때 ──')
    with app.app_context():
        app.config['LLM_BASE_URL'] = ''
        r = name_ai.suggest(['가상검증 적용률'], DEFS)
        check('★ 설정이 없으면 예외가 아니라 사유를 돌려준다',
              r['ok'] is False and bool(r['reason']), str(r))
        check('제안은 비어 있다', r['suggestions'] == [], str(r))

        app.config['LLM_BASE_URL'] = 'http://127.0.0.1:9/v1'      # 아무도 안 듣는 포트
        r = name_ai.suggest(['가상검증 적용률'], DEFS)
        check('★ 서버에 못 닿아도 예외를 던지지 않는다',
              r['ok'] is False and bool(r['reason']), str(r))

        app.config['LLM_BASE_URL'] = BASE
        r = name_ai.suggest([], DEFS)
        check('물을 것이 없으면 부르지도 않는다',
              r['ok'] is True and r['suggestions'] == [], str(r))
        r = name_ai.suggest(['x'], [])
        check('등록된 KPI 가 없으면 그렇게 말한다', r['ok'] is False, str(r))

    # ── ② 스텁을 띄우고 진짜 경로로 ────────────────────────────────────
    print('── 스텁과 붙여서 ──')
    proc = start_stub()
    try:
        with app.app_context():
            app.config['LLM_BASE_URL'] = BASE
            app.config['LLM_MODEL'] = 'GLM-5-2'
            app.config['LLM_API_KEY'] = ''
            app.config['LLM_TIMEOUT'] = 20

            asked = ['가상 검증 비율', 'One Time Pass 율', '전혀 상관없는 무언가']
            r = name_ai.suggest(asked, DEFS)
            check('불러서 답을 받는다', r['ok'] is True, str(r))

            names = [s['name'] for s in r['suggestions']]
            labels = {s['kpi'] for s in r['suggestions']}

            check('★ 목록에 없는 KPI 는 버린다 (스텁이 일부러 섞어 보낸다)',
                  '스텁이 지어낸 KPI' not in labels, str(labels))
            check('★ 제안은 전부 등록된 KPI 다',
                  labels <= {d['label'] for d in DEFS}, str(labels))
            check('★ 묻지 않은 이름은 안 받는다',
                  set(names) <= set(asked), str(names))
            check('같은 이름을 두 번 제안하지 않는다',
                  len(names) == len(set(names)), str(names))
            check('닮은 이름은 짝지어 준다',
                  any(s['name'] == '가상 검증 비율' and s['kpi'] == '가상 검증률'
                      for s in r['suggestions']), str(r['suggestions']))
            check('닮은 것이 없으면 제안하지 않는다',
                  all(s['name'] != '전혀 상관없는 무언가' for s in r['suggestions']),
                  str(names))
            check('확신도를 함께 준다',
                  all(s['confidence'] in ('high', 'medium', 'low')
                      for s in r['suggestions']), str(r['suggestions']))

            # 한 번에 묻는 수 제한 — 답이 길어지면 잘린다
            many = [f'이름{i}' for i in range(name_ai.MAX_ASK + 5)]
            r = name_ai.suggest(many, DEFS)
            check('★ 너무 많으면 나눠서 묻고 남은 수를 알려 준다',
                  r['skipped'] == 5, str(r.get('skipped')))
    finally:
        proc.terminate()

    print()
    if fails:
        print(f'[FAIL] {len(fails)}건 실패')
        for f in fails:
            print(f'   - {f}')
        sys.exit(1)
    print('[OK] 전부 통과')


if __name__ == '__main__':
    main()
