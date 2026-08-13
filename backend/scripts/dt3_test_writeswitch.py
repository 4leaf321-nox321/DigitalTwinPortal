"""
V2 쓰기 스위치 시험 — 컷오버 전/후가 설계대로 갈리는지 확인한다.

왜 별도 시험인가
    이 스위치는 **틀리면 조용히 데이터를 잃는** 종류다. 두 방향 다 위험하다.

      · 운영에서 실수로 열리면 — 유효 토큰만 있으면 누구나 dt2 에 직접 쓸 수 있고,
        그 값은 다음 저장 시 v2_sync 에 덮여 사라진다 (2026-07-29 실측).
      · 컷오버 후에도 v2_sync 가 돌면 — V2 에 쓴 값을 V1 기준으로 덮어써 같은 일이 난다.

    그래서 스위치를 코드 상수에서 환경변수(config.DT2_WRITE_ENABLED)로 옮기고,
    v2_sync 가 같은 값을 보고 스스로 멈추게 해 **둘을 상호배타로** 만들었다.
    이 시험은 그 상호배타가 실제로 서는지 HTTP 경로까지 내려가 확인한다.

무엇을 확인하나
    1. 기본값은 차단          — 환경변수를 안 넣으면 무조건 막힌다
    2. 값 파싱               — true/1/on/yes 만 켠다. 오타는 켜지지 않는다
    3. 운영에서 우회 헤더 차단   — X-DT2-Allow-Write 는 운영에서 통하지 않는다
                              (환경변수로도 못 연다 — 여는 경로 자체가 없다)
    4. 인증 우선순위          — 토큰 문제는 503 보다 먼저 401 로 답한다
    5. 읽기는 안 막힘         — GET 은 언제나 통과
    6. 컷오버 스위치 동작      — 켜면 운영 설정에서도 쓰기가 열린다
    7. 상호배타             — 켜지면 v2_sync 가 스스로 멈춘다

안전성
    존재하지 않는 uuid 로만 요청한다. 데이터를 만들지도 고치지도 않는다.

사용법
    python scripts\\dt3_test_writeswitch.py
"""

from __future__ import annotations

import importlib
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

_BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(_BACKEND, '.env'))   # 운영 설정은 env 에서 DSN 을 읽는다
except ImportError:
    pass

DEAD_UUID = '00000000-0000-0000-0000-000000000000'   # 존재하지 않는 과제
results = []


def check(desc, cond, extra=''):
    results.append((desc, bool(cond)))
    print(f"  {'[OK]  ' if cond else '[FAIL]'} {desc}" + (f"   {extra}" if not cond and extra else ''))


def _reload_config(env_value):
    """환경변수를 바꾼 뒤 config 모듈을 다시 읽는다 (import 시점에 평가되므로).

    주의: `import app.config as C` 는 안 된다. app 패키지가 `config` 라는 이름의
    **딕셔너리**를 export 하고 있어 속성 조회가 모듈보다 먼저 잡힌다.
    """
    def _set():
        if env_value is None:
            os.environ.pop('DT2_WRITE_ENABLED', None)
        else:
            os.environ['DT2_WRITE_ENABLED'] = env_value

    _set()
    # `app.config` 를 처음 import 하면 `app` 패키지가 먼저 실행되고, 거기서
    # load_dotenv() 가 돌아 방금 지운 값을 **.env 에서 되살린다**(2026-08-01).
    # 그래서 import 뒤에 한 번 더 맞춘다 — 실제로 값을 읽는 것은 아래 reload 다.
    importlib.import_module('app.config')
    _set()
    return importlib.reload(sys.modules['app.config'])


def _fresh_app(config_name, write_enabled):
    """
    환경변수를 반영해 앱을 처음부터 다시 만든다.

    끄는 쪽을 **pop 이 아니라 'false' 로** 적는 이유 (2026-08-01)
        아래에서 `app` 패키지를 지우고 다시 import 하는데, 그때 `app/__init__.py`
        의 `load_dotenv()` 가 다시 돌아 `.env` 의 DT2_WRITE_ENABLED=true 를
        **되살린다**(load_dotenv 는 이미 있는 값만 안 덮는다).
        지워 버리면 되살아나고, 명시하면 그대로 남는다.
        '변수가 아예 없을 때의 기본값' 검사는 _reload_config(None) 이 따로 한다 —
        그쪽은 app.config 만 reload 하므로 dotenv 가 다시 돌지 않는다.
    """
    if write_enabled:
        os.environ['DT2_WRITE_ENABLED'] = 'true'
    else:
        os.environ['DT2_WRITE_ENABLED'] = 'false'
    for mod in [m for m in sys.modules if m == 'app' or m.startswith('app.')]:
        del sys.modules[mod]
    from app import create_app
    return create_app(config_name)


def _admin_headers(app, extra=None):
    from flask_jwt_extended import create_access_token
    from app.modules.auth.models import User, UserRole
    with app.app_context():
        admin = User.query.filter_by(role=UserRole.ADMIN, is_active=True).first()
        if admin is None:
            print('[FAIL] 개발 DB 에 활성 admin 이 없습니다. 시험을 진행할 수 없습니다.')
            sys.exit(1)
        headers = {'Authorization': f'Bearer {create_access_token(identity=str(admin.id))}'}
    headers.update(extra or {})
    return headers


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    print('\n[1] 기본값 — 환경변수가 없으면 어느 설정에서도 차단')
    C = _reload_config(None)
    check('development 기본 차단', C.DevelopmentConfig.DT2_WRITE_ENABLED is False)
    check('production  기본 차단', C.ProductionConfig.DT2_WRITE_ENABLED is False)

    print('\n[2] 값 파싱 — 오타로 켜지면 안 된다')
    for raw, want in [('true', True), ('TRUE', True), ('1', True), ('on', True),
                      ('yes', True), ('  true  ', True),
                      ('false', False), ('0', False), ('', False),
                      ('ture', False), ('enabled', False)]:
        C = _reload_config(raw)
        check(f'{raw!r:12} → {want}', C.Config.DT2_WRITE_ENABLED is want)

    print('\n[3] 시험 우회 헤더 — 운영에서는 환경변수로도 열 수 없다')
    os.environ['DT2_ALLOW_TEST_WRITE_HEADER'] = 'true'      # 일부러 켜본다
    C = _reload_config(None)
    check('production  우회 헤더 닫힘', C.ProductionConfig.DT2_ALLOW_TEST_WRITE_HEADER is False)
    check('base        우회 헤더 닫힘', C.Config.DT2_ALLOW_TEST_WRITE_HEADER is False)
    check('development 우회 헤더 열림 (dt3 시험용)',
          C.DevelopmentConfig.DT2_ALLOW_TEST_WRITE_HEADER is True)
    check('testing     우회 헤더 열림', C.TestingConfig.DT2_ALLOW_TEST_WRITE_HEADER is True)
    os.environ.pop('DT2_ALLOW_TEST_WRITE_HEADER', None)

    print('\n[4] 컷오버 전 · 운영 설정 — HTTP 경로')
    app = _fresh_app('production', write_enabled=False)
    client = app.test_client()
    plain = _admin_headers(app)
    bypass = _admin_headers(app, {'X-DT2-Allow-Write': 'test'})
    body = {'patch': {'progress': 1}}

    r = client.patch(f'/api/dt-v2/projects/{DEAD_UUID}', headers=plain, json=body)
    check('토큰만 → 503 차단', r.status_code == 503, f'실제 {r.status_code}')

    r = client.patch(f'/api/dt-v2/projects/{DEAD_UUID}', headers=bypass, json=body)
    check('토큰 + 우회 헤더 → 503 차단 (뚫리면 안 됨)',
          r.status_code == 503, f'실제 {r.status_code}')

    r = client.post('/api/dt-v2/projects', headers=bypass, json={'과제명': 'x'})
    check('POST 도 우회 불가', r.status_code == 503, f'실제 {r.status_code}')

    r = client.delete(f'/api/dt-v2/projects/{DEAD_UUID}', headers=bypass)
    check('DELETE 도 우회 불가', r.status_code == 503, f'실제 {r.status_code}')

    r = client.patch(f'/api/dt-v2/projects/{DEAD_UUID}', json=body)
    check('토큰 없음 → 인증 오류가 503 보다 먼저',
          r.status_code in (401, 422), f'실제 {r.status_code}')

    r = client.get('/api/dt-v2/data', headers=plain)
    check('읽기(GET)는 막히지 않는다', r.status_code == 200, f'실제 {r.status_code}')

    print('\n[5] 컷오버 후 · 운영 설정 — 스위치로 열린다')
    app2 = _fresh_app('production', write_enabled=True)
    client2 = app2.test_client()
    check('config 쓰기 활성', app2.config['DT2_WRITE_ENABLED'] is True)
    check('우회 헤더는 여전히 닫힘', app2.config['DT2_ALLOW_TEST_WRITE_HEADER'] is False)

    r = client2.patch(f'/api/dt-v2/projects/{DEAD_UUID}',
                      headers=_admin_headers(app2), json=body)
    check('쓰기 통과 — 없는 과제라 404 (503 이 아니어야 한다)',
          r.status_code == 404, f'실제 {r.status_code}')

    print('\n[6] 상호배타 — 쓰기가 켜지면 v2_sync 가 멈춘다')
    from app.modules.digital_twin_dashboard import v2_sync
    with app2.test_request_context():
        check('_cutover_done() 참', v2_sync._cutover_done() is True)
        v2_sync.request_sync('writeswitch-test')      # 스레드가 뜨면 안 된다
        st = v2_sync.sync_status()
        check('동기화 스레드 미기동', st['running'] is False)
        check('중단 사유 기록됨', 'V2 쓰기 활성' in (st['lastDetail'] or ''),
              f"실제 {st['lastDetail']!r}")

    ok = sum(1 for _, c in results if c)
    bad = len(results) - ok
    print('\n' + '=' * 72)
    print(f'결과: {ok}/{len(results)} 통과' + (f' — [FAIL] {bad}건' if bad else ' — [OK]'))
    if bad:
        for desc, c in results:
            if not c:
                print(f'  [FAIL] {desc}')
    print('=' * 72)
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
