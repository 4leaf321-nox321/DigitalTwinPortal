"""
Application Configuration
"""
import os
from datetime import timedelta


class Config:
    """
    Base configuration.

    ★ 기본값을 두지 않는다 (2026-08-01)
        예전에는 DATABASE_URL·SECRET_KEY·JWT_SECRET_KEY 에 하드코딩 폴백이 있었다.
        그래서 환경변수를 **못 읽어도 앱이 그냥 떴고**, 조용히 개발 DB(localhost)에
        붙었다. 어제 개발서버에서 난 일이 정확히 그 경로다 —
        `.env` 를 로드하지 않는 시험 스크립트가 실제 DB 에 붙어 v2_sync 를 돌렸다.

        설정을 못 읽었으면 **즉시 실패하는 편이 낫다.** 조용히 틀린 DB 에 붙는 것보다
        기동이 안 되는 쪽이 훨씬 빨리 발견된다. 누락 검사는 create_app() 이 한다.
    """
    SECRET_KEY = os.environ.get('SECRET_KEY')

    # Database - PostgreSQL (using psycopg3)
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ECHO = False

    # JWT Configuration
    # ProductionConfig 가 재정의하지 않으므로 여기 값이 운영에도 그대로 쓰인다.
    # 폴백을 두면 .env 에서 빠졌을 때 **공개된 시크릿으로 토큰이 서명된다.**
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=12)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
    JWT_TOKEN_LOCATION = ['headers']
    JWT_HEADER_NAME = 'Authorization'
    JWT_HEADER_TYPE = 'Bearer'

    # JSON configuration
    JSON_AS_ASCII = False  # Support Korean characters
    JSON_SORT_KEYS = False

    # File upload
    MAX_CONTENT_LENGTH = 1024 * 1024 * 1024  # 1GB max file size

    # Pagination
    DEFAULT_PAGE_SIZE = 20
    MAX_PAGE_SIZE = 100

    # ── 디지털 트윈 V2(dt2_*) 쓰기 스위치 ─────────────────────────────────
    # 컷오버 전에는 V1(dashboard_data)이 정본이고, 저장할 때마다 v2_sync 가
    # dt2 를 V1 기준으로 덮어쓴다. 그래서 이 스위치와 v2_sync 는 **동시에 켜져
    # 있으면 안 된다** — 켜져 있으면 V2 에 쓴 값이 다음 저장 한 번에 사라진다
    # (2026-07-29 동시성 시험에서 실측). 이 상호배타는 코드가 강제한다:
    # v2_sync.request_sync() 가 이 값이 True 면 스스로 멈춘다.
    #
    # 그래서 컷오버 절차는 이것 하나다 —
    #   운영 .env 에 DT2_WRITE_ENABLED=true 를 넣고 재기동.
    # 코드를 고쳐서 켜지 않는다. 코드에 두면 개발에서 켠 파일이 그대로 반입돼
    # 운영에서도 켜진다.
    DT2_WRITE_ENABLED = os.environ.get(
        'DT2_WRITE_ENABLED', ''
    ).strip().lower() in ('1', 'true', 'yes', 'on')

    # 시험 스크립트(dt3_test_*.py)가 쓰기 차단을 통과할 때 쓰는 헤더의 허용 여부.
    # 기본은 닫힘. 개발·시험 설정에서만 연다(아래). **환경변수로 열 수 없다** —
    # 운영에서 실수로 켜지는 경로 자체를 만들지 않기 위해서다.
    DT2_ALLOW_TEST_WRITE_HEADER = False

    # ── 전략 기획 모듈의 근거 원천 ────────────────────────────────────────
    #
    #   local     포탈 DB 를 실제로 읽는다
    #   fixture   합성 데이터 (기본값)
    #
    # 기본이 fixture 인 이유는 안전 쪽이다 — 잘못 켜서 남의 DB 를 긁는 것보다,
    # 안 켜서 가짜 데이터가 나오는 편이 되돌리기 쉽다.
    #
    # ⚠️ 그래서 **운영 .env 에 STRATEGY_EVIDENCE_SOURCE=local 을 넣어야** 진짜
    #    데이터를 본다. 안 넣으면 운영에서도 합성 데이터가 나오고, 화면 상단에
    #    "개발용 합성 데이터로 동작 중" 띠가 뜬다. 그 띠가 안내다.
    #
    # 개발에서 local 로 두는 것도 유효하다. 개발 DB 는 시드라 **숫자는 현실이
    # 아니지만**, LocalDbSource 의 조인·KPI 매칭 경로가 실제로 돌아 쿼리 버그를
    # 잡는다. fixture 로는 그 코드가 아예 안 탄다.
    STRATEGY_EVIDENCE_SOURCE = os.environ.get(
        'STRATEGY_EVIDENCE_SOURCE', 'fixture'
    ).strip().lower()

    # ── 사내 LLM (Phase 5 — AI 에이전트) ──────────────────────────────────
    #
    # OpenAI 호환 `/v1/chat/completions` 를 쓴다. 운영은 GPU 서버의 GLM-5.2 이고,
    # **개발서버는 그 주소에 못 닿는다.** 그래서 개발에서는 같은 응답 모양을 흉내내는
    # 스텁(`scripts/llm_stub.py`)을 띄우고 이 값을 그쪽으로 돌린다 —
    # 어댑터(요청 바디·응답 파싱·타임아웃)와 에이전트 루프는 **진짜 코드가 그대로** 돈다.
    #
    # ⚠️ `LLM_BASE_URL` 은 **`/v1` 까지** 포함한다. 어댑터가 뒤에 `/chat/completions`
    #    만 붙이므로, 빼먹으면 404 가 난다.
    #
    # 기본값을 두지 않는다 — 비어 있으면 에이전트 기능만 꺼지고(503) 나머지는 그대로다.
    # 엉뚱한 주소로 조용히 붙는 것보다 안 켜지는 게 낫다.
    LLM_BASE_URL = os.environ.get('LLM_BASE_URL', '').strip().rstrip('/')
    LLM_MODEL = os.environ.get('LLM_MODEL', 'GLM-5-2').strip()
    LLM_API_KEY = os.environ.get('LLM_API_KEY', '').strip()
    LLM_TIMEOUT = float(os.environ.get('LLM_TIMEOUT', '120'))

    # 한 번의 응답에서 모델이 **뱉을 수 있는** 토큰 수. 입력(컨텍스트)과는 다른 값이다 —
    # 입력 길이는 모델의 컨텍스트 창이 정하고, 우리 쪽 상한은 아래 문자 수로 건다.
    #
    # 낮추면 긴 답이 **중간에서 잘린다**(`finish_reason='length'`). 폼 도우미는 JSON 을
    # 받으므로 잘리면 파싱이 통째로 실패한다 — 그때 llm.py 가 "길이 제한에 걸렸다" 고
    # 갈라서 알려준다. 조용히 실패하지 않게 하려는 것이다.
    LLM_MAX_TOKENS = int(os.environ.get('LLM_MAX_TOKENS', '3000'))

    # 폼 도우미가 한 번에 읽는 **붙여넣은 원문**의 문자 수 상한.
    # 넘으면 자르고 사용자에게 잘랐다고 알린다. 모델의 컨텍스트 창이 작으면 줄인다.
    LLM_FORM_SOURCE_CHARS = int(os.environ.get('LLM_FORM_SOURCE_CHARS', '12000'))
    # GLM reasoning 옵션. 서버 chat_template 으로 넘어간다. 비우면 안 보낸다.
    LLM_REASONING_EFFORT = os.environ.get('LLM_REASONING_EFFORT', '').strip()

    # ── 에이전트 전용 ────────────────────────────────────────────────────
    # 에이전트는 **여러 홉을 계획**해야 한다. 사고가 꺼져 있으면 도구를 한 번 부르고
    # 바로 답해 버려서(2026-08-11 운영 실측) 다단계 조사가 아예 안 나온다.
    # 그래서 이 경로만 기본으로 켠다. 끄려면 `.env` 에 `LLM_AGENT_REASONING=` (빈 값).
    #
    # ⚠️ 모델이 `chat_template_kwargs` 를 모르면 400 이 날 수 있다. 그때는 어댑터가
    #    **한 번만 사고 없이 다시** 부른다(agent.py `_chat`) — AI 가 통째로 죽지 않게.
    LLM_AGENT_REASONING = os.environ.get('LLM_AGENT_REASONING', 'medium').strip()

    # 계획을 세우는 자리다. 온도가 높으면 같은 질문에 매번 다른 데로 샌다.
    LLM_AGENT_TEMPERATURE = float(os.environ.get('LLM_AGENT_TEMPERATURE', '0.2'))

    # 한 홉이 뱉을 수 있는 양. **사고 토큰도 여기 포함된다** — 사고를 켜면 평소보다
    # 더 든다. 모자라면 `finish_reason='length'` 로 잘려 답이 통째로 비고, 그러면
    # 루프가 거기서 끊긴다. 비우면 `LLM_MAX_TOKENS` 를 따른다.
    LLM_AGENT_MAX_TOKENS = int(os.environ.get('LLM_AGENT_MAX_TOKENS', '0')) or None

    # 에이전트가 자기 REST API 를 부를 주소(도구 실행 경로).
    # 판단을 복제하지 않으려고 **MCP 와 똑같이 REST 로** 부른다 — 자세한 이유는
    # `digital_twin_dashboard/ai/agent_tools.py` 머리말.
    LLM_AGENT_API_BASE = os.environ.get(
        'LLM_AGENT_API_BASE', 'http://127.0.0.1:5174'
    ).strip().rstrip('/')


class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True
    SQLALCHEMY_ECHO = True  # Log SQL queries

    # 개발서버에서는 쓰기 경로를 시험할 수 있어야 한다.
    # 막힌 상태로는 프론트 PATCH 전환을 검증할 방법이 없다.
    DT2_ALLOW_TEST_WRITE_HEADER = True


class TestingConfig(Config):
    """Testing configuration."""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'TEST_DATABASE_URL',
        'postgresql+psycopg://postgres:32167@localhost:5432/dxdigitaltwin_test'
    )

    DT2_ALLOW_TEST_WRITE_HEADER = True


class ProductionConfig(Config):
    """Production configuration."""
    DEBUG = False

    # In production, these should be set via environment variables
    SECRET_KEY = os.environ.get('SECRET_KEY')
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL')

    # 운영에서는 시험 우회구를 **하드코딩으로 닫는다.** 환경변수로도 못 연다.
    # 이 헤더가 운영에서 통하면, 유효한 토큰만 있으면 누구나 dt2 에 직접 쓸 수 있고
    # 그 값은 다음 저장 시 v2_sync 에 덮여 조용히 사라진다.
    DT2_ALLOW_TEST_WRITE_HEADER = False


config = {
    'development': DevelopmentConfig,
    'testing': TestingConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
