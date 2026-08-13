"""AI 기능이 왜 실패하는지 **한 번에** 본다. 읽기만 하고 아무것도 고치지 않는다.

왜 이게 필요한가
    화면에는 "AI 호출 실패" 한 줄만 뜬다. 그런데 그 한 줄 뒤에는 서로 다른 세 가지가
    숨어 있고 **고칠 곳이 전부 다르다**:

        ① 우리 앱이 낸 것          권한·설정 문제      (한국어 메시지)
        ② LLM 서버가 낸 것         모델·토큰 문제      (모델 이름이 나온다)
        ③ 중간 관문이 낸 것         망 정책 문제        (영어, 'policy'/'denied')

    ③ 은 우리 코드에 그런 문구가 아예 없다는 것으로 가려낼 수 있다. 이 스크립트는
    **실제로 나간 요청과 돌아온 응답**을 그대로 보여줘서 셋 중 무엇인지 못 박는다.

무엇을 보나
    1. 설정      LLM 주소·모델·키 유무 (키는 가린다)
    2. 실행 기록 `dt2_agent_runs.error` — 실패한 요청이 받은 **원문**
    3. 직접 호출 이 서버에서 LLM 으로 실제 요청을 한 번 쏴 본다
    4. 자기 호출 도구가 자기 REST API 를 부를 때 쓰는 주소가 닿는지

실행: python scripts\\dt5_diag_ai.py
"""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import requests                                                    # noqa: E402

from app import create_app                                         # noqa: E402
from app.modules.digital_twin_dashboard.models_v2 import Dt2AgentRun  # noqa: E402

LINE = '─' * 68


def mask(value):
    """키는 있는지만 보여 준다. 진단 로그가 그대로 붙여 넣어질 수 있다."""
    if not value:
        return '(없음)'
    s = str(value)
    return f'{s[:4]}…{s[-2:]} (길이 {len(s)})' if len(s) > 8 else '****'


def classify(text):
    """이 오류가 **누가 낸 것인지** 가른다. 고칠 곳이 갈리는 지점이다."""
    t = (text or '').lower()
    if not t:
        return '(없음)'
    if 'policy' in t or 'access denied' in t or 'forbidden by' in t:
        return '③ 중간 관문(망 정책) — 방화벽·프록시가 막았다'
    if 'connection' in t or 'timed out' in t or 'timeout' in t \
            or 'max retries' in t or 'refused' in t:
        return '③ 중간 관문 — 아예 닿지 못했다(주소·방화벽)'
    if 'llm 호출이 실패' in t or 'model' in t or 'token' in t:
        return '② LLM 서버'
    if '권한' in text or '로그인' in text:
        return '① 우리 앱(권한·인증)'
    return '(판단 못 함 — 아래 원문을 보세요)'


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    app = create_app()
    with app.app_context():
        cfg = app.config

        # ── 1. 설정 ────────────────────────────────────────────────────
        print(LINE)
        print('1. 설정')
        print(LINE)
        base = (cfg.get('LLM_BASE_URL') or '').rstrip('/')
        print(f"  LLM_BASE_URL         {base or '(비어 있음 — AI 기능이 꺼진 상태)'}")
        print(f"  LLM_MODEL            {cfg.get('LLM_MODEL')}")
        print(f"  LLM_API_KEY          {mask(cfg.get('LLM_API_KEY'))}")
        print(f"  LLM_TIMEOUT          {cfg.get('LLM_TIMEOUT')}")
        print(f"  LLM_MAX_TOKENS       {cfg.get('LLM_MAX_TOKENS')}")
        print(f"  LLM_AGENT_API_BASE   "
              f"{cfg.get('LLM_AGENT_API_BASE') or 'http://127.0.0.1:5174 (기본값)'}")
        # ⚠️ 프록시 환경변수가 껴 있으면 requests 가 **몰래 그리로 돈다.**
        #    사내망에서 이것 때문에 관문에 걸리는 일이 흔하다.
        proxies = {k: v for k, v in os.environ.items()
                   if k.lower() in ('http_proxy', 'https_proxy', 'no_proxy')}
        print(f"  프록시 환경변수        {proxies or '(없음)'}")
        if proxies and base:
            host = base.split('//', 1)[-1].split('/')[0].split(':')[0]
            no_proxy = (os.environ.get('no_proxy') or os.environ.get('NO_PROXY') or '')
            if host not in no_proxy:
                print(f'  ⚠️ {host} 가 no_proxy 에 없습니다 — 프록시를 거쳐 나갑니다.')

        # ── 2. 실행 기록 ───────────────────────────────────────────────
        print()
        print(LINE)
        print('2. 최근 실행 기록 (dt2_agent_runs)')
        print(LINE)
        runs = (Dt2AgentRun.query
                .order_by(Dt2AgentRun.created_at.desc()).limit(10).all())
        if not runs:
            print('  기록이 없습니다. AI 를 한 번도 안 썼거나, 요청이 이 서버까지'
                  ' 오지 않았습니다(앞단에서 막혔을 수 있습니다).')
        fails = [r for r in runs if r.error]
        print(f'  최근 {len(runs)}건 중 실패 {len(fails)}건')
        for r in runs[:5]:
            mark = 'FAIL' if r.error else ' OK '
            print(f'\n  [{mark}] {r.created_at} · {r.duration_ms}ms '
                  f'· hop {r.hops} · 도구 {r.tool_calls}')
            print(f'         질문: {(r.question or "")[:60]}')
            if r.error:
                print(f'         분류: {classify(r.error)}')
                print(f'         원문: {r.error[:400]}')

        # ── 3. LLM 으로 직접 쏴 본다 ────────────────────────────────────
        print()
        print(LINE)
        print('3. 이 서버에서 LLM 으로 직접 호출')
        print(LINE)
        if not base:
            print('  LLM_BASE_URL 이 없어 건너뜁니다. .env 를 확인하세요.')
        else:
            headers = {'Content-Type': 'application/json'}
            if cfg.get('LLM_API_KEY'):
                headers['Authorization'] = f"Bearer {cfg['LLM_API_KEY']}"
            body = {
                'model': cfg.get('LLM_MODEL') or 'GLM-5-2',
                'messages': [{'role': 'user', 'content': 'ping'}],
                'max_tokens': 8,
            }
            url = f'{base}/chat/completions'
            print(f'  POST {url}')
            try:
                r = requests.post(url, json=body, headers=headers, timeout=20)
                print(f'  상태 {r.status_code}')
                # 응답 헤더도 본다 — 관문이 끼면 서버 이름이 여기서 드러난다.
                for k in ('server', 'via', 'x-cache', 'cf-ray', 'x-envoy-upstream-service-time'):
                    if k in {h.lower() for h in r.headers}:
                        print(f'  헤더 {k}: {r.headers.get(k)}')
                text = (r.text or '')[:600]
                print(f'  본문 {text}')
                if not r.ok:
                    print(f'  → 분류: {classify(text)}')
            except requests.RequestException as exc:
                print(f'  예외 {type(exc).__name__}: {exc}')
                print(f'  → 분류: {classify(str(exc))}')

        # ── 4. 도구가 부르는 자기 자신 ─────────────────────────────────
        print()
        print(LINE)
        print('4. 도구가 부를 자기 REST API')
        print(LINE)
        self_base = cfg.get('LLM_AGENT_API_BASE') or 'http://127.0.0.1:5174'
        url = f'{self_base}/api/dt-v2/trend/projects'
        print(f'  GET {url}  (토큰 없이 — 401 이 나와야 정상)')
        try:
            r = requests.get(url, timeout=10)
            print(f'  상태 {r.status_code} · {(r.text or "")[:160]}')
            if r.status_code in (401, 422):
                print('  → 정상입니다. 주소가 맞고 앱이 응답합니다.')
            elif r.status_code == 403:
                print('  → ⚠️ 403 입니다. **앱 앞단(리버스 프록시·WAF)** 이 막고 있습니다 — '
                      '우리 앱은 토큰이 없을 때 401 을 냅니다.')
            else:
                print('  → 예상 밖입니다. 이 주소가 정말 우리 앱인지 확인하세요.')
        except requests.RequestException as exc:
            print(f'  예외 {type(exc).__name__}: {exc}')
            print('  → 도구가 자기 API 에 못 닿습니다. LLM_AGENT_API_BASE 를 확인하세요 '
                  '(운영 포트가 5174 가 아닐 수 있습니다).')

        print()
        print(LINE)
        print('읽는 법')
        print(LINE)
        print("  · 3번이 403 인데 본문이 영어(policy/denied)면 → **망 정책**입니다.")
        print("    앱 설정으로는 못 고칩니다. 운영 서버에서 LLM 주소로 나가는 것을")
        print("    허용해 달라고 요청해야 합니다(출발지 IP·포트·도메인).")
        print("  · 3번은 200 인데 화면만 실패하면 → 2번의 원문을 보세요.")
        print("    도구가 자기 API 를 부르다 막힌 것일 수 있습니다(4번).")
        print("  · 4번이 403 이면 → 우리 앱이 아니라 **앞단**이 막은 것입니다.")
    return 0


if __name__ == '__main__':
    sys.exit(main())
