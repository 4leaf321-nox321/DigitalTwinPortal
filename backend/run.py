"""
Flask Application Entry Point
"""
import os

# .env 로딩은 app/__init__.py 가 한다 — 진입점마다 따로 읽으면 갈린다.
# (여기서 읽던 것을 2026-08-01 에 옮겼다. 이유는 그쪽 주석 참조)
from app import create_app

# 환경 결정도 create_app 이 한다 (FLASK_ENV, 기본값 production).
# 배너에 쓸 값만 여기서 다시 읽는다 — 판단이 아니라 표시용이다.
app = create_app()
config_name = app.config.get('ENV_NAME') or os.environ.get('FLASK_ENV', 'production')

if __name__ == '__main__':
    # Get host and port from environment or use defaults
    host = os.environ.get('FLASK_HOST', '0.0.0.0')
    port = int(os.environ.get('FLASK_PORT', 5000))

    if config_name == 'development':
        # 개발 환경: Flask 개발 서버 (디버그 모드, 핫 리로드)
        print(f"""
    ================================================================
    |         Knowledge Graph Backend API Server                   |
    ================================================================
    |  Environment: {config_name:<45} |
    |  Server:      Flask Development Server                       |
    |  Running on:  http://{host}:{port:<36} |
    |  Debug Mode:  ON                                             |
    ================================================================
        """)
        app.run(host=host, port=port, debug=True)
    else:
        # 프로덕션 환경: Waitress (멀티스레드, 안정적)
        from waitress import serve
        threads = int(os.environ.get('WAITRESS_THREADS', 8))
        print(f"""
    ================================================================
    |         Knowledge Graph Backend API Server                   |
    ================================================================
    |  Environment: {config_name:<45} |
    |  Server:      Waitress (Production)                          |
    |  Running on:  http://{host}:{port:<36} |
    |  Threads:     {threads:<48} |
    ================================================================
        """)
        serve(app, host=host, port=port, threads=threads)
