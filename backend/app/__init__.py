"""
Flask Application Factory
"""
import os
import sys

# ★ .env 는 **여기서** 읽는다 (2026-08-01)
#
#   예전에는 run.py 에만 load_dotenv() 가 있었다. 그래서 run.py 를 거치지 않고
#   create_app() 을 직접 부르는 경로(scripts/dt3_test_*.py 21개)는 .env 없이 떴고,
#   DATABASE_URL·DT2_WRITE_ENABLED 가 전부 빠진 채 **개발 기본값으로 떨어졌다.**
#   그 상태에서 v2_sync 가 살아나 V1 기준으로 V2 를 덮어썼다.
#
#   진입점마다 설정을 읽으면 반드시 갈린다. 앱을 만드는 곳은 여기 하나뿐이므로
#   여기서 읽는다. 경로를 명시하는 것은 호출자의 작업 디렉터리에 안 휘둘리기 위해서다.
#   (이미 환경변수에 있으면 load_dotenv 는 덮어쓰지 않는다 — 셸 설정이 우선)
#
#   config.py 가 클래스 본문에서 os.environ 을 읽으므로 **그 import 보다 먼저** 와야 한다.
from dotenv import load_dotenv

_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(_BACKEND_DIR, '.env'))

import requests
from flask import Flask, send_from_directory, request, Response
from flask_cors import CORS

from app.config import config
from app.extensions import db, migrate, bcrypt, jwt

LLM_SERVER_URL = os.getenv('LLM_SERVER_URL', 'http://localhost:8080')

# Frontend dist folder path (relative to backend folder)
FRONTEND_DIST_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'frontend', 'dist')

# 정적 자산 판별은 404 핸들러와 같은 기준을 쓴다 (app/shared/errors.py)
from app.shared.errors import STATIC_ASSET_EXTS, is_static_asset_path


# ============================================
# 응답 gzip 압축 (Phase 1-4)
# ============================================
# 오프라인 환경이라 Flask-Compress / brotli wheel 을 반입할 수 없다.
# 표준 라이브러리 gzip 만으로 같은 일을 한다. 신규 패키지 0개.

COMPRESSIBLE_MIMETYPES = {
    'application/json',
    'application/javascript',
    'application/xml',
    'text/html',
    'text/css',
    'text/plain',
    'text/javascript',
    'text/xml',
    'text/csv',
    'image/svg+xml',
}

# 이보다 작으면 압축해도 이득이 없다 (헤더 오버헤드가 더 큼)
COMPRESS_MIN_BYTES = 1024
COMPRESS_LEVEL = 6          # 1(빠름)~9(작음). 6이 속도/크기 균형점


def init_compression(app):
    """응답을 gzip 으로 압축한다.

    JPEG/PNG 같이 **이미 압축된** 형식은 건너뛴다. 다시 압축해도 안 줄고 CPU 만 쓴다.
    (그래서 Phase 1-2 에서 이미지를 payload 밖으로 빼는 것이 먼저였다)
    """
    import gzip as _gzip

    @app.after_request
    def compress_response(response):
        try:
            # 클라이언트가 gzip 을 받을 수 있다고 했을 때만
            accept = request.headers.get('Accept-Encoding', '')
            if 'gzip' not in accept.lower():
                return response

            # 이미 인코딩된 응답은 건드리지 않는다
            if response.headers.get('Content-Encoding'):
                return response

            # 본문이 없는 응답 (204, 304 등)
            if response.status_code < 200 or response.status_code >= 300:
                return response

            # send_file 등 스트리밍 응답은 본문을 읽으면 안 된다.
            # (정적 파일은 파일명에 해시가 있어 브라우저가 캐시하므로 영향이 작다)
            if response.direct_passthrough:
                return response

            mimetype = (response.mimetype or '').lower()
            if mimetype not in COMPRESSIBLE_MIMETYPES:
                return response

            data = response.get_data()
            if len(data) < COMPRESS_MIN_BYTES:
                return response

            compressed = _gzip.compress(data, compresslevel=COMPRESS_LEVEL)
            # 압축 결과가 더 크면 원본을 쓴다 (이미 압축된 내용일 때 발생)
            if len(compressed) >= len(data):
                return response

            response.set_data(compressed)
            response.headers['Content-Encoding'] = 'gzip'
            response.headers['Content-Length'] = str(len(compressed))
            # 같은 URL 이라도 Accept-Encoding 에 따라 응답이 다르므로 캐시 구분자를 알린다
            response.headers.add('Vary', 'Accept-Encoding')

        except Exception as exc:
            # 압축은 부가 기능이다. 실패해도 원본 응답을 그대로 돌려준다.
            print(f"[Compress] 압축 건너뜀: {exc}")

        return response


def check_frontend_build(app):
    """
    기동 시 index.html 이 참조하는 자산이 실제로 존재하는지 확인한다.

    운영서버에서 npm run build 가 부분 실패하면(권한 오류 등) index.html 은 새 해시를 가리키는데
    그 파일이 없는 상태가 된다. 이 경우 화면은 뜨지만 스타일만 조용히 사라져 원인 파악이 어렵다.
    기동 로그에서 즉시 드러나게 한다. (2026-07-28 운영 사고)
    """
    import re

    index_path = os.path.join(FRONTEND_DIST_PATH, 'index.html')
    if not os.path.exists(index_path):
        print(f"[Frontend] index.html 없음: {index_path}")
        print("[Frontend] 프론트엔드가 빌드되지 않았습니다. (API 전용으로는 동작합니다)")
        return

    try:
        with open(index_path, 'r', encoding='utf-8', errors='replace') as fh:
            html = fh.read()
    except OSError as exc:
        print(f"[Frontend] index.html 읽기 실패: {exc}")
        return

    refs = re.findall(r'(?:src|href)="(/[^"]+)"', html)
    missing = [
        ref for ref in refs
        if os.path.splitext(ref)[1].lower() in STATIC_ASSET_EXTS
        and not os.path.exists(os.path.join(FRONTEND_DIST_PATH, ref.lstrip('/')))
    ]

    # 화면을 실제로 망가뜨리는 것과 아닌 것을 구분한다.
    # (아이콘 같은 것까지 크게 경고하면 정작 중요한 경고가 묻힌다)
    critical = [r for r in missing if os.path.splitext(r)[1].lower() in ('.js', '.mjs', '.css')]
    minor = [r for r in missing if r not in critical]

    if critical:
        print("=" * 70)
        print("[Frontend] ★ 경고 — 화면이 깨집니다. index.html 이 참조하는 파일이 없습니다:")
        for ref in critical:
            print(f"           {ref}")
        print()
        print("           프론트엔드 빌드가 불완전합니다.")
        print("           .css 가 없으면 에러 없이 '스타일만 사라지는' 증상이 납니다.")
        print("           조치: 백엔드 중지 → frontend/dist 삭제 → npm run build → 재시작")
        print("=" * 70)
    else:
        print(f"[Frontend] 빌드 자산 확인 완료 (핵심 자산 정상, 참조 {len(refs)}개)")

    if minor:
        print(f"[Frontend] 참고 — 없는 부가 파일: {', '.join(minor)} (화면 동작에는 영향 없음)")


def _entry_is_test_script() -> bool:
    """
    지금 프로세스의 진입점이 `backend/scripts/` 의 **시험** 스크립트인가.

    왜 이름으로 거르나
        운영 반입 절차도 scripts/ 를 쓴다(런북 4장: dt2_import · dt2_verify ·
        dt3_preflight …). 폴더 전체를 막으면 그 절차가 죽는다.
        막아야 하는 건 **시험용 데이터를 만들고 지우는** 것들이고, 이 저장소는
        그것들을 `*_test_*.py` 로 부른다 (dt3_test_*.py · dt_test_report_images.py).

    왜 스크립트를 하나씩 고치지 않나
        18개가 넘고, 새로 만든 것이 빠지면 그때 또 샌다. 진입점 한 곳에서 본다.
    """
    entry = sys.argv[0] if sys.argv else ''
    if not entry:
        return False
    try:
        path = os.path.abspath(entry)
        if os.path.dirname(path) != os.path.join(_BACKEND_DIR, 'scripts'):
            return False
        name = os.path.basename(path)
        return '_test_' in name or name.startswith('test_')
    except Exception:
        return False


# 없으면 기동을 막을 설정. 조용히 기본값으로 떨어지느니 여기서 죽는 편이 낫다.
_REQUIRED = ('SQLALCHEMY_DATABASE_URI', 'SECRET_KEY', 'JWT_SECRET_KEY')


def create_app(config_name=None):
    """
    Create and configure the Flask application.

    ★ config_name 기본값이 'production' 이다 (2026-08-01)
        예전 기본값은 'development' 였다. 그래서 인자 없이 부르는 모든 경로가
        **운영 .env 의 FLASK_ENV=production 과 무관하게** DevelopmentConfig 로 떴다.
        그 설정은 DT2_ALLOW_TEST_WRITE_HEADER=True · DEBUG=True 라, 운영 서버에서
        시험 스크립트를 한 번 돌리는 것만으로 쓰기 차단이 열린다.

        기본값은 **안전한 쪽**이어야 한다. 개발로 뜨려면 FLASK_ENV 로 명시한다.
    """
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'production')
    if config_name not in config:
        raise RuntimeError(
            f"알 수 없는 FLASK_ENV: {config_name!r} "
            f"(가능한 값: {', '.join(sorted(config))})")

    # 운영 기계에서 시험 스크립트를 돌리는 것은 사고다 —
    # 스크립트들은 시험용 과제를 만들고 지우며, 그 대상이 운영 데이터가 된다.
    #
    # ★ 판단 기준은 **환경변수**이지 인자가 아니다.
    #   `create_app('production')` 을 인자로 부르는 정당한 시험이 있다 —
    #   dt3_test_writeswitch.py 는 "운영 설정이면 쓰기가 막히는가" 를 검증하려고
    #   운영 설정 앱을 메모리에 만든다. 그건 개발 기계에서 도는 정상 동작이다.
    #   막아야 하는 것은 "여기가 운영 기계인가" 이고, 그건 FLASK_ENV 가 말한다.
    if _entry_is_test_script() and \
            os.environ.get('FLASK_ENV', '').strip().lower() == 'production':
        raise RuntimeError(
            f'운영 기계(FLASK_ENV=production)에서 시험 스크립트를 실행할 수 없습니다: '
            f'{os.path.basename(sys.argv[0])}\n'
            f'  시험 스크립트는 시험용 과제를 만들고 지웁니다 — 그 대상이 운영 '
            f'데이터가 됩니다.\n'
            f'  운영 절차용 스크립트(dt2_import · dt2_verify · dt3_preflight 등)는 '
            f'그대로 쓸 수 있습니다.')

    app = Flask(__name__, static_folder=FRONTEND_DIST_PATH, static_url_path='')

    # Load configuration
    app.config.from_object(config[config_name])
    # 어떤 환경으로 떴는지 앱에 남긴다 — 진입점이 다시 계산하면 둘이 갈린다.
    app.config['ENV_NAME'] = config_name

    missing = [k for k in _REQUIRED if not app.config.get(k)]
    if missing:
        raise RuntimeError(
            f"필수 설정이 비어 있습니다: {', '.join(missing)}\n"
            f"  backend/.env 를 확인하세요 (환경: {config_name}).\n"
            f"  예전에는 하드코딩 기본값으로 조용히 떴지만, 그러면 엉뚱한 DB 에 "
            f"붙은 것을 아무도 모릅니다.")

    # 디지털 트윈 V2 쓰기 스위치 상태를 기동 로그에 남긴다.
    # 코드가 아니라 환경변수로 켜지므로, "지금 어느 쪽인가" 를 눈으로 확인할
    # 수단이 필요하다. 컷오버 런북에서 이 줄을 대조한다.
    if app.config.get('DT2_WRITE_ENABLED'):
        print('[DT-V2] 쓰기 활성 (컷오버 완료 상태) — 정본=dt2_*, V1→V2 동기화 중단됨')
    else:
        print('[DT-V2] 쓰기 차단 (컷오버 전) — 정본=dashboard_data, 저장 시 dt2_* 동기화')
    if app.config.get('DT2_ALLOW_TEST_WRITE_HEADER'):
        print('[DT-V2] 시험 우회 헤더 허용됨 (개발/시험 설정). 운영에서는 나오면 안 되는 줄입니다.')

    # Initialize extensions
    init_extensions(app)

    # Register blueprints
    register_blueprints(app)

    # Register error handlers
    register_error_handlers(app)

    return app


def init_extensions(app):
    """Initialize Flask extensions."""
    # CORS - Allow frontend to access API
    import os

    # Get CORS origins from environment variable or use defaults
    cors_origins = os.getenv('CORS_ORIGINS', 'http://localhost:3000,http://localhost:5173,http://localhost:5174')
    allowed_origins = [origin.strip() for origin in cors_origins.split(',')]

    # If in development, allow all origins for easier testing
    if app.config.get('DEBUG', False):
        print(f"[CORS] Allowed origins: {allowed_origins}")

    CORS(app, resources={
        r"/api/*": {
            "origins": allowed_origins,
            "methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "supports_credentials": True
        }
    })

    # Database
    db.init_app(app)
    migrate.init_app(app, db)

    # Password hashing
    bcrypt.init_app(app)

    # JWT Authentication
    jwt.init_app(app)

    # JWT Error Handlers for debugging
    @jwt.invalid_token_loader
    def invalid_token_callback(error_string):
        print(f"[JWT ERROR] Invalid token: {error_string}")
        return {'success': False, 'message': f'Invalid token: {error_string}'}, 401

    @jwt.unauthorized_loader
    def missing_token_callback(error_string):
        print(f"[JWT ERROR] Missing token: {error_string}")
        return {'success': False, 'message': f'Missing token: {error_string}'}, 401

    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        print(f"[JWT ERROR] Expired token: {jwt_payload}")
        return {'success': False, 'message': 'Token has expired'}, 401

    @jwt.token_verification_failed_loader
    def token_verification_failed_callback(jwt_header, jwt_payload):
        print(f"[JWT ERROR] Token verification failed: {jwt_payload}")
        return {'success': False, 'message': 'Token verification failed'}, 401


def register_blueprints(app):
    """Register all module blueprints."""
    from app.modules import register_all_blueprints
    register_all_blueprints(app)

    # Initialize default data after first request
    @app.before_request
    def init_default_data():
        # Only run once
        if getattr(app, '_default_data_initialized', False):
            return
        app._default_data_initialized = True

        # Initialize collaboration board categories
        from app.modules.collaboration_board import init_default_categories
        try:
            init_default_categories()
        except Exception as e:
            print(f"[Init] Error initializing default categories: {e}")

    # LLM proxy - forward /llm/* requests to local LLM server (supports streaming)
    @app.route('/llm/<path:path>', methods=['GET', 'POST', 'OPTIONS'])
    def llm_proxy(path):
        target_url = f"{LLM_SERVER_URL}/{path}"
        try:
            # Check if this is a streaming request
            is_stream = False
            if request.method == 'POST' and request.is_json:
                try:
                    body = request.get_json(silent=True)
                    is_stream = body.get('stream', False) if body else False
                except Exception:
                    pass

            if is_stream:
                # Streaming: forward SSE response as a generator
                resp = requests.request(
                    method=request.method,
                    url=target_url,
                    headers={k: v for k, v in request.headers if k.lower() not in ('host', 'content-length')},
                    data=request.get_data(),
                    timeout=300,
                    stream=True,
                )

                def generate():
                    try:
                        for chunk in resp.iter_content(chunk_size=None):
                            if chunk:
                                yield chunk
                    finally:
                        resp.close()

                return Response(
                    generate(),
                    status=resp.status_code,
                    headers={
                        'Content-Type': resp.headers.get('Content-Type', 'text/event-stream'),
                        'Cache-Control': 'no-cache',
                        'X-Accel-Buffering': 'no',
                    },
                )
            else:
                # Non-streaming: original behavior
                resp = requests.request(
                    method=request.method,
                    url=target_url,
                    headers={k: v for k, v in request.headers if k.lower() not in ('host', 'content-length')},
                    data=request.get_data(),
                    timeout=300,
                )
                return Response(resp.content, status=resp.status_code,
                                headers={'Content-Type': resp.headers.get('Content-Type', 'application/json')})
        except requests.exceptions.ConnectionError:
            return {'success': False, 'message': 'LLM 서버에 연결할 수 없습니다.'}, 502
        except requests.exceptions.Timeout:
            return {'success': False, 'message': 'LLM 서버 응답 시간 초과'}, 504

    # [Phase 1-4] 한글을 \uXXXX 로 escape 하지 않는다.
    #   기본값(True)이면 한글 1자가 6바이트(한)로 나간다. UTF-8 로 보내면 3바이트다.
    #   압축 전 크기가 줄어들고, 압축 후에도 더 작아진다.
    app.json.ensure_ascii = False

    # [Phase 1-4] 응답 gzip 압축
    init_compression(app)

    # 기동 시 프론트엔드 빌드 완전성 확인 (불완전하면 로그로 경고)
    check_frontend_build(app)

    # 지금 도는 서버가 어느 릴리스인가. 화면 푸터가 이것을 자기 값과 견준다 —
    # 백엔드ㆍ프론트가 어긋나면 저장이 400 이 되는데, 그 원인을 한 줄로 알려면
    # 두 값이 나란히 보여야 한다.
    #
    # ⚠️ 로그인 없이 연다. 배포가 제대로 됐는지는 **못 들어가는 상태에서도**
    #    확인할 수 있어야 한다. 버전 문자열 하나뿐이라 새는 것이 없다.
    @app.route('/api/version')
    def api_version():
        from flask import jsonify
        from app.version import app_version
        return jsonify({'success': True, 'data': {'version': app_version()}})

    # Serve React SPA for non-API routes
    @app.route('/')
    def serve_index():
        return send_from_directory(app.static_folder, 'index.html')

    @app.route('/<path:path>')
    def serve_static(path):
        # API routes should be handled by blueprints, not this catch-all
        # If a request reaches here with /api prefix, it means no API route matched
        if path.startswith('api/'):
            from flask import jsonify
            return jsonify({
                'success': False,
                'message': f'API endpoint not found: /{path}'
            }), 404

        # If file exists in static folder, serve it
        if os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)

        # 정적 자산인데 파일이 없으면 index.html 로 폴백하지 않고 404 를 준다.
        # (실제로는 Flask 내장 static 라우트가 먼저 처리해 404 핸들러로 가지만,
        #  라우팅이 바뀌어도 같은 규칙이 적용되도록 여기에도 둔다. 판단 기준은 errors.py 와 공유)
        if is_static_asset_path('/' + path):
            from flask import jsonify
            return jsonify({
                'success': False,
                'message': f'정적 파일을 찾을 수 없습니다: /{path}',
                'hint': '프론트엔드 빌드(frontend/dist)가 불완전할 수 있습니다.'
            }), 404

        # 그 외 경로는 SPA 라우팅이므로 index.html 을 준다
        return send_from_directory(app.static_folder, 'index.html')


def register_error_handlers(app):
    """Register error handlers."""
    from app.shared.errors import (
        handle_400_error,
        handle_404_error,
        handle_405_error,
        handle_500_error
    )

    app.register_error_handler(400, handle_400_error)
    app.register_error_handler(404, handle_404_error)
    app.register_error_handler(405, handle_405_error)
    app.register_error_handler(500, handle_500_error)
