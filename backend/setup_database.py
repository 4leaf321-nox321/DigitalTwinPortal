"""
Database Setup Script
새로운 환경에서 DB 테이블 구조를 생성하는 스크립트

사용법:
    python setup_database.py

필요 조건:
    1. PostgreSQL이 설치되어 있어야 함
    2. .env 파일에 DATABASE_URL이 설정되어 있어야 함
       예: DATABASE_URL=postgresql://postgres:password@localhost:5432/dbname
    3. pip 패키지가 설치되어 있어야 함
"""

import os
import sys
from getpass import getpass

def check_env_file():
    """환경 설정 파일 확인"""
    if not os.path.exists('.env'):
        print("\n[!] .env 파일이 없습니다.")
        print("    .env.example을 복사하여 .env를 만들고 설정을 수정해주세요.")

        # 기본 .env 파일 생성 옵션
        create_env = input("\n기본 .env 파일을 생성하시겠습니까? (y/n): ").strip().lower()
        if create_env == 'y':
            create_default_env()
            return True
        return False
    return True


def create_default_env():
    """기본 .env 파일 생성"""
    print("\n=== DB 연결 정보 입력 ===")

    db_host = input("PostgreSQL 호스트 (기본: localhost): ").strip() or "localhost"
    db_port = input("PostgreSQL 포트 (기본: 5432): ").strip() or "5432"
    db_name = input("데이터베이스 이름 (기본: knowledge_graph): ").strip() or "knowledge_graph"
    db_user = input("DB 사용자명 (기본: postgres): ").strip() or "postgres"
    db_password = getpass("DB 비밀번호: ")

    jwt_secret = input("JWT 시크릿 키 (기본: 자동생성): ").strip()
    if not jwt_secret:
        import secrets
        jwt_secret = secrets.token_hex(32)

    env_content = f"""# Flask Configuration
FLASK_ENV=production
FLASK_DEBUG=False

# Database
DATABASE_URL=postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}

# JWT Configuration
JWT_SECRET_KEY={jwt_secret}
JWT_ACCESS_TOKEN_EXPIRES=3600
JWT_REFRESH_TOKEN_EXPIRES=2592000

# CORS (쉼표로 구분된 허용 origin 목록)
CORS_ORIGINS=http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173
"""

    with open('.env', 'w', encoding='utf-8') as f:
        f.write(env_content)

    print("\n[OK] .env 파일이 생성되었습니다.")
    print(f"     DATABASE_URL: postgresql://{db_user}:****@{db_host}:{db_port}/{db_name}")


def create_database_if_not_exists():
    """데이터베이스가 없으면 생성"""
    from dotenv import load_dotenv
    load_dotenv()

    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("[!] DATABASE_URL이 설정되지 않았습니다.")
        return False

    # URL에서 데이터베이스 이름 추출
    # postgresql://user:pass@host:port/dbname
    try:
        from urllib.parse import urlparse
        parsed = urlparse(database_url)
        db_name = parsed.path.lstrip('/')

        # postgres 기본 DB에 연결하여 새 DB 생성
        base_url = f"{parsed.scheme}://{parsed.username}:{parsed.password}@{parsed.hostname}:{parsed.port}/postgres"

        import psycopg2
        from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

        conn = psycopg2.connect(base_url)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()

        # 데이터베이스 존재 여부 확인
        cursor.execute(f"SELECT 1 FROM pg_database WHERE datname = '{db_name}'")
        exists = cursor.fetchone()

        if not exists:
            print(f"\n[*] 데이터베이스 '{db_name}' 생성 중...")
            cursor.execute(f'CREATE DATABASE "{db_name}"')
            print(f"[OK] 데이터베이스 '{db_name}'가 생성되었습니다.")
        else:
            print(f"\n[OK] 데이터베이스 '{db_name}'가 이미 존재합니다.")

        cursor.close()
        conn.close()
        return True

    except ImportError:
        print("[!] psycopg2가 설치되지 않았습니다. pip install psycopg2-binary")
        return False
    except Exception as e:
        print(f"[!] 데이터베이스 확인/생성 실패: {e}")
        print("    PostgreSQL이 실행 중인지 확인해주세요.")
        return False


def create_tables():
    """모든 테이블 생성"""
    print("\n[*] 테이블 생성 중...")

    try:
        from app import create_app
        from app.extensions import db

        # 모든 모델 import (테이블 생성에 필요)
        from app.modules.auth.models import User, RefreshToken
        from app.modules.dx_work_process.models import Graph, Node, Edge, NodeType, EdgeType
        from app.modules.digital_twin_dashboard.models import (
            ModuleSettings, Division, Department, ProcessCategory,
            ProjectDomain, TaskCategory, TaskStatus,
            PerformanceCategory, PerformanceSubcategory,
            DashboardData, DashboardSnapshot, DashboardActivityLog
        )

        app = create_app()

        with app.app_context():
            # 모든 테이블 생성
            db.create_all()

            print("[OK] 테이블이 생성되었습니다.")

            # 생성된 테이블 목록 출력
            tables = db.engine.table_names()
            print(f"\n=== 생성된 테이블 ({len(tables)}개) ===")
            for table in sorted(tables):
                print(f"    - {table}")

            return True

    except Exception as e:
        print(f"[!] 테이블 생성 실패: {e}")
        import traceback
        traceback.print_exc()
        return False


def create_admin_user():
    """기본 관리자 계정 생성"""
    print("\n=== 관리자 계정 생성 ===")

    create_admin = input("관리자 계정을 생성하시겠습니까? (y/n): ").strip().lower()
    if create_admin != 'y':
        print("[*] 관리자 계정 생성을 건너뜁니다.")
        return True

    try:
        from app import create_app
        from app.extensions import db
        from app.modules.auth.models import User, UserRole

        app = create_app()

        with app.app_context():
            # 기존 관리자 확인
            existing_admin = User.query.filter_by(role=UserRole.ADMIN).first()
            if existing_admin:
                print(f"[!] 관리자 계정이 이미 존재합니다: {existing_admin.email}")
                return True

            # 관리자 정보 입력
            admin_email = input("관리자 이메일: ").strip()
            admin_name = input("관리자 이름: ").strip()
            admin_password = getpass("관리자 비밀번호: ")
            admin_password_confirm = getpass("비밀번호 확인: ")

            if admin_password != admin_password_confirm:
                print("[!] 비밀번호가 일치하지 않습니다.")
                return False

            if not admin_email or not admin_name or not admin_password:
                print("[!] 모든 필드를 입력해주세요.")
                return False

            # 관리자 계정 생성
            admin = User(
                email=admin_email,
                name=admin_name,
                role=UserRole.ADMIN,
                is_admin=True,
                is_active=True
            )
            admin.set_password(admin_password)

            db.session.add(admin)
            db.session.commit()

            print(f"\n[OK] 관리자 계정이 생성되었습니다.")
            print(f"     이메일: {admin_email}")
            print(f"     이름: {admin_name}")
            print(f"     권한: admin")

            return True

    except Exception as e:
        print(f"[!] 관리자 계정 생성 실패: {e}")
        return False


def main():
    """메인 실행 함수"""
    print("=" * 50)
    print("  Knowledge Graph Project - Database Setup")
    print("=" * 50)

    # 현재 디렉토리가 backend인지 확인
    if not os.path.exists('app'):
        print("\n[!] 이 스크립트는 backend 폴더에서 실행해야 합니다.")
        print("    cd backend")
        print("    python setup_database.py")
        sys.exit(1)

    # Step 1: 환경 설정 파일 확인
    print("\n[Step 1/4] 환경 설정 확인...")
    if not check_env_file():
        print("\n[!] .env 파일을 설정한 후 다시 실행해주세요.")
        sys.exit(1)

    # Step 2: 데이터베이스 생성
    print("\n[Step 2/4] 데이터베이스 확인...")
    if not create_database_if_not_exists():
        print("\n[!] 데이터베이스 설정을 확인한 후 다시 실행해주세요.")
        sys.exit(1)

    # Step 3: 테이블 생성
    print("\n[Step 3/4] 테이블 생성...")
    if not create_tables():
        print("\n[!] 테이블 생성에 실패했습니다.")
        sys.exit(1)

    # Step 4: 관리자 계정 생성
    print("\n[Step 4/4] 관리자 계정 설정...")
    create_admin_user()

    print("\n" + "=" * 50)
    print("  Database Setup Complete!")
    print("=" * 50)
    print("\n다음 명령어로 서버를 시작할 수 있습니다:")
    print("    python run.py")
    print("\n또는:")
    print("    flask run --host=0.0.0.0 --port=5000")


if __name__ == '__main__':
    main()
