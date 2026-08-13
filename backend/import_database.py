"""
Database Import Script
덤프 파일로부터 데이터베이스를 복원하는 스크립트

사용법:
    python import_database.py <dump_file.sql>

    예: python import_database.py database_dump_20250125_143022.sql

필요 조건:
    1. PostgreSQL이 설치되어 있어야 함 (psql 명령어)
    2. .env 파일에 DATABASE_URL이 설정되어 있어야 함
    3. 덤프 파일 (database_dump_*.sql)

주의사항:
    - 기존 데이터베이스가 있으면 삭제 후 재생성됩니다
    - 덤프 파일의 데이터베이스 이름과 .env의 이름이 일치해야 합니다
"""

import os
import sys
import subprocess
from urllib.parse import urlparse
from pathlib import Path


def load_env():
    """환경 변수 로드"""
    try:
        from dotenv import load_dotenv
        load_dotenv()
        return True
    except ImportError:
        print("[!] python-dotenv가 설치되지 않았습니다.")
        print("    pip install python-dotenv")
        return False


def get_db_config():
    """DATABASE_URL에서 DB 연결 정보 추출"""
    database_url = os.getenv('DATABASE_URL')

    if not database_url:
        print("[!] DATABASE_URL이 설정되지 않았습니다.")
        print("    .env 파일을 확인해주세요.")
        return None

    try:
        parsed = urlparse(database_url)

        # postgresql+psycopg:// 형식 처리
        scheme = parsed.scheme.split('+')[0]

        config = {
            'host': parsed.hostname or 'localhost',
            'port': parsed.port or 5432,
            'database': parsed.path.lstrip('/'),
            'username': parsed.username,
            'password': parsed.password,
        }

        return config

    except Exception as e:
        print(f"[!] DATABASE_URL 파싱 실패: {e}")
        return None


def check_psql():
    """psql 명령어 사용 가능 여부 확인"""
    try:
        result = subprocess.run(
            ['psql', '--version'],
            capture_output=True,
            text=True,
            timeout=5
        )

        if result.returncode == 0:
            version = result.stdout.strip()
            print(f"[OK] {version}")
            return True
        else:
            print("[!] psql을 실행할 수 없습니다.")
            return False

    except FileNotFoundError:
        print("[!] psql을 찾을 수 없습니다.")
        print("    PostgreSQL이 설치되어 있는지 확인하고,")
        print("    PostgreSQL bin 폴더가 PATH에 등록되어 있는지 확인해주세요.")
        print("    예: C:\\Program Files\\PostgreSQL\\16\\bin")
        return False
    except Exception as e:
        print(f"[!] psql 확인 중 오류: {e}")
        return False


def drop_and_create_database(config):
    """기존 데이터베이스 삭제 후 재생성"""

    print(f"\n[*] 데이터베이스 재생성 중...")
    print(f"    데이터베이스: {config['database']}")

    # 환경 변수 설정
    env = os.environ.copy()
    if config['password']:
        env['PGPASSWORD'] = config['password']

    try:
        # postgres 기본 DB에 연결
        base_cmd = [
            'psql',
            '-h', config['host'],
            '-p', str(config['port']),
            '-U', config['username'],
            '-d', 'postgres',
            '-c'
        ]

        # 1. 기존 연결 종료
        print(f"    [1/3] 기존 연결 종료 중...")
        terminate_cmd = base_cmd + [
            f"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '{config['database']}' AND pid <> pg_backend_pid();"
        ]

        subprocess.run(terminate_cmd, env=env, capture_output=True, timeout=10)

        # 2. 데이터베이스 삭제
        print(f"    [2/3] 기존 데이터베이스 삭제 중...")
        drop_cmd = base_cmd + [f"DROP DATABASE IF EXISTS \"{config['database']}\";"]

        result = subprocess.run(drop_cmd, env=env, capture_output=True, text=True, timeout=10)

        if result.returncode != 0 and 'does not exist' not in result.stderr:
            print(f"[!] 데이터베이스 삭제 실패: {result.stderr}")
            return False

        # 3. 새 데이터베이스 생성
        print(f"    [3/3] 새 데이터베이스 생성 중...")
        create_cmd = base_cmd + [f"CREATE DATABASE \"{config['database']}\" ENCODING 'UTF8';"]

        result = subprocess.run(create_cmd, env=env, capture_output=True, text=True, timeout=10)

        if result.returncode == 0:
            print(f"[OK] 데이터베이스 '{config['database']}'가 생성되었습니다.")
            return True
        else:
            print(f"[!] 데이터베이스 생성 실패: {result.stderr}")
            return False

    except subprocess.TimeoutExpired:
        print("[!] 데이터베이스 작업 시간 초과")
        return False
    except Exception as e:
        print(f"[!] 데이터베이스 재생성 중 오류: {e}")
        return False


def import_database(config, dump_file):
    """덤프 파일로부터 데이터베이스 복원"""

    if not os.path.exists(dump_file):
        print(f"[!] 덤프 파일을 찾을 수 없습니다: {dump_file}")
        return False

    file_size = os.path.getsize(dump_file)
    file_size_mb = file_size / (1024 * 1024)

    print(f"\n[*] 데이터베이스 복원 시작...")
    print(f"    덤프 파일: {dump_file}")
    print(f"    파일 크기: {file_size_mb:.2f} MB")
    print(f"    대상 DB: {config['database']}")

    # 환경 변수 설정
    env = os.environ.copy()
    if config['password']:
        env['PGPASSWORD'] = config['password']

    # psql 명령어 구성
    cmd = [
        'psql',
        '-h', config['host'],
        '-p', str(config['port']),
        '-U', config['username'],
        '-d', config['database'],
        '-f', dump_file,
        '--echo-errors'
    ]

    try:
        print("\n[*] psql 실행 중...")
        print("    (큰 덤프 파일의 경우 시간이 걸릴 수 있습니다)\n")

        result = subprocess.run(
            cmd,
            env=env,
            capture_output=True,
            text=True,
            timeout=1800  # 30분 타임아웃
        )

        if result.returncode == 0:
            print(f"\n[OK] 데이터베이스 복원 완료!")
            print(f"     데이터베이스: {config['database']}")
            print(f"     호스트: {config['host']}:{config['port']}")
            return True
        else:
            print(f"\n[!] 복원 중 오류 발생!")
            if result.stderr:
                print(f"    오류 메시지:\n{result.stderr[:500]}")  # 처음 500자만 표시
            return False

    except subprocess.TimeoutExpired:
        print("\n[!] 복원 시간 초과 (30분)")
        print("    덤프 파일이 너무 크거나 네트워크가 느립니다.")
        return False

    except Exception as e:
        print(f"\n[!] 복원 중 오류 발생: {e}")
        return False


def verify_import(config):
    """복원 검증 - 테이블 목록 확인"""

    print("\n[*] 복원 검증 중...")

    env = os.environ.copy()
    if config['password']:
        env['PGPASSWORD'] = config['password']

    cmd = [
        'psql',
        '-h', config['host'],
        '-p', str(config['port']),
        '-U', config['username'],
        '-d', config['database'],
        '-c', "\\dt",
        '-t'  # 튜플만 출력 (헤더 제외)
    ]

    try:
        result = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=10)

        if result.returncode == 0:
            tables = [line.strip() for line in result.stdout.strip().split('\n') if line.strip()]

            if tables:
                print(f"[OK] {len(tables)}개의 테이블이 복원되었습니다.")
                print("\n주요 테이블:")
                for table in tables[:10]:  # 처음 10개만 표시
                    print(f"    - {table.split('|')[1].strip() if '|' in table else table}")
                if len(tables) > 10:
                    print(f"    ... 외 {len(tables) - 10}개")
                return True
            else:
                print("[!] 테이블이 없습니다. 복원을 확인해주세요.")
                return False
        else:
            print(f"[!] 검증 실패: {result.stderr}")
            return False

    except Exception as e:
        print(f"[!] 검증 중 오류: {e}")
        return False


def main():
    print("=" * 60)
    print("  Database Import - PostgreSQL Restore")
    print("=" * 60)

    # 덤프 파일 인자 확인
    if len(sys.argv) < 2:
        print("\n[!] 사용법: python import_database.py <dump_file.sql>")
        print("\n예:")
        print("    python import_database.py database_dump_20250125_143022.sql")
        sys.exit(1)

    dump_file = sys.argv[1]

    # 현재 디렉토리가 backend인지 확인
    if not os.path.exists('app'):
        print("\n[!] 이 스크립트는 backend 폴더에서 실행해야 합니다.")
        print("    cd backend")
        print(f"    python import_database.py {dump_file}")
        sys.exit(1)

    # Step 1: 환경 변수 로드
    print("\n[Step 1/5] 환경 변수 로드...")
    if not load_env():
        print("\n[!] .env 파일을 생성하고 DATABASE_URL을 설정해주세요.")
        sys.exit(1)

    # Step 2: DB 설정 확인
    print("\n[Step 2/5] 데이터베이스 설정 확인...")
    config = get_db_config()
    if not config:
        sys.exit(1)
    print(f"[OK] Database: {config['database']}")

    # Step 3: psql 확인
    print("\n[Step 3/5] psql 확인...")
    if not check_psql():
        sys.exit(1)

    # Step 4: 데이터베이스 재생성
    print("\n[Step 4/5] 데이터베이스 재생성...")
    if not drop_and_create_database(config):
        print("\n[!] 데이터베이스 재생성에 실패했습니다.")
        sys.exit(1)

    # Step 5: 덤프 복원
    print("\n[Step 5/5] 데이터베이스 복원...")
    if not import_database(config, dump_file):
        print("\n[!] 데이터베이스 복원에 실패했습니다.")
        sys.exit(1)

    # 복원 검증
    verify_import(config)

    print("\n" + "=" * 60)
    print("  Import Complete!")
    print("=" * 60)
    print("\n다음 명령어로 서버를 시작할 수 있습니다:")
    print("    python run.py")
    print("\n또는:")
    print("    flask run --host=0.0.0.0 --port=5000")
    print()


if __name__ == '__main__':
    main()
