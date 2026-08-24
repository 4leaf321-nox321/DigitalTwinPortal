"""테스트 공통 설비.

── 왜 이 디렉터리가 이제야 생겼나 ─────────────────────────────────────────
`backend\\tests` 가 없어서 CI 의 pytest 단계가 **통째로 건너뛰어지고 있었다.**
그래서 2026-08-15 에 모델 이름 충돌로 모든 DB 질의가 죽는 코드가 릴리스까지
나갔다. 이 디렉터리가 생기는 순간부터 그 단계가 실제로 돈다.

── DB 를 어떻게 준비하나 ──────────────────────────────────────────────────
`flask db upgrade` 를 쓰지 않는다. **이 저장소의 마이그레이션은 빈 DB 에서
안 올라간다** — 첫 리비전이 `users` 표를 이미 있다고 전제한다(초기에
create_all 로 만들고 그 위에 쌓은 흔적). 그래서 테스트는 모델 정의에서 직접
표를 만든다.

    TEST_DATABASE_URL   기본 postgresql+psycopg://postgres:32167@localhost:5432/dxdigitaltwin_test

⚠️ 이 DB 는 **매 테스트 세션마다 통째로 비운다.** 운영·개발 DB 를 절대 가리키면
   안 된다. 이름에 _test 가 없으면 아예 멈춘다(아래 안전장치).
"""
import os
import sys

import pytest
import sqlalchemy as sa

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app import create_app                      # noqa: E402
from app.extensions import db as _db            # noqa: E402
from app.modules.auth.models import User, UserRole   # noqa: E402


@pytest.fixture(scope='session')
def app():
    application = create_app('testing')

    uri = application.config['SQLALCHEMY_DATABASE_URI']
    # 안전장치. 실수로 개발 DB 를 가리키면 여기서 멈춘다 — 아래에서 표를 전부
    # 지우기 때문에, 틀린 DB 를 가리킨 채 도는 것이 가장 위험하다.
    if '_test' not in uri:
        pytest.exit(f'테스트 DB 가 아닙니다. TEST_DATABASE_URL 을 확인하세요: {uri}')

    with application.app_context():
        # drop_all() 이 아니라 스키마째 비운다.
        #
        # drop_all() 은 **지금 모델이 아는 표만** 지운다. 모델을 지우거나 이름을
        # 바꾸면 옛 표가 DB 에 남고, 그 표가 FK 로 다른 표를 붙잡아 다음
        # drop_all() 이 통째로 실패한다(2026-08-15 실제로 겪음).
        # 테스트 DB 는 언제든 처음부터 만들 수 있어야 한다.
        _db.session.execute(sa.text('DROP SCHEMA public CASCADE'))
        _db.session.execute(sa.text('CREATE SCHEMA public'))
        _db.session.commit()
        _db.create_all()
        yield application
        _db.session.remove()


# 설문이 고를 수 있는 프로세스는 **대시보드 마스터**에서 온다. 운영에 있는
# 값과 같은 것을 쓴다(2026-08-15 확인).
PROCESS_NAMES = ['개발', '제조', '품질', '디자인', '연계']


@pytest.fixture()
def db(app):
    """테스트마다 데이터를 비우고, 마스터 데이터를 다시 심는다.

    표를 다시 만들지 않고 내용만 지운다 — create_all 은 느리고, 표 구조는
    테스트 사이에 바뀌지 않는다.

    ⚠️ 마스터는 **매번 다시 심어야 한다.** 아래 비우기가 모든 표를 훑으므로
       세션 시작 때 한 번 심어 두면 첫 테스트가 끝나는 순간 사라지고, 그
       뒤로는 "쓸 수 있는 프로세스가 없음" 이 되어 관련 테스트가 전부 막힌다.
    """
    from app.modules.digital_twin_dashboard.models import ProcessCategory
    for i, name in enumerate(PROCESS_NAMES):
        _db.session.add(ProcessCategory(name=name, order=i, is_active=True))
    _db.session.commit()

    yield _db
    _db.session.rollback()
    for table in reversed(_db.metadata.sorted_tables):
        _db.session.execute(table.delete())
    _db.session.commit()


@pytest.fixture()
def client(app):
    return app.test_client()


def _make_user(email, role, name=None, department=None):
    user = User(
        email=email,
        name=name or email.split('@')[0],
        role=role,
        department=department,
        is_active=True,
    )
    user.set_password('test-password')
    _db.session.add(user)
    _db.session.flush()
    return user


@pytest.fixture()
def make_user(db):
    """테스트용 사용자 생성기."""
    def factory(email, role=UserRole.USER, name=None, department=None):
        user = _make_user(email, role, name, department)
        db.session.commit()
        return user
    return factory


@pytest.fixture()
def auth(app):
    """사용자의 Authorization 헤더를 만든다.

    ⚠️ `X-DT2-Allow-Write` 를 **같이 붙인다.** 안 붙이면 dt-v2 의 모든 쓰기 요청이
       권한 검사에 닿기도 전에 **503** 으로 끝난다(`_block_writes_before_cutover`).
       개발 PC 는 `.env` 가 V2 쓰기를 켜 둬서 없어도 통과하지만 **CI 는 아니라서**,
       빠뜨리면 로컬만 초록이고 CI 에서 죽는다 (2026-08-24 에 실제로 그랬다).

       이 헤더는 `DT2_ALLOW_TEST_WRITE_HEADER` 가 True 일 때만 먹고, 그 값은
       Testing·Development 설정에만 있다. **운영은 False 고정이고 환경변수로도
       못 켠다** — 열려 있으면 토큰만 있으면 누구나 dt2 에 직접 쓸 수 있다.
    """
    from flask_jwt_extended import create_access_token

    def factory(user):
        token = create_access_token(identity=str(user.id))
        return {'Authorization': f'Bearer {token}',
                'X-DT2-Allow-Write': 'test'}
    return factory
