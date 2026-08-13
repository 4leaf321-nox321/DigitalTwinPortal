"""
Database Export Script
현재 DB의 모든 데이터를 덤프 파일로 저장하는 스크립트

사용법:
    python export_database.py

필요 조건:
    1. PostgreSQL이 설치되어 있어야 함 (pg_dump 명령어)
    2. .env 파일에 DATABASE_URL이 설정되어 있어야 함
    3. 현재 작업 중인 데이터베이스에 접근 가능해야 함

생성 파일:
    - database_dump.sql: 전체 데이터베이스 백업 파일
    - database_dump_info.txt: 덤프 정보 (날짜, DB 이름 등)
"""

import os
import sys
import subprocess
from datetime import datetime
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


def check_pg_dump():
    """pg_dump 명령어 사용 가능 여부 확인"""
    try:
        result = subprocess.run(
            ['pg_dump', '--version'],
            capture_output=True,
            text=True,
            timeout=5
        )

        if result.returncode == 0:
            version = result.stdout.strip()
            print(f"[OK] {version}")
            return True
        else:
            print("[!] pg_dump를 실행할 수 없습니다.")
            return False

    except FileNotFoundError:
        print("[!] pg_dump를 찾을 수 없습니다.")
        print("    PostgreSQL이 설치되어 있는지 확인하고,")
        print("    PostgreSQL bin 폴더가 PATH에 등록되어 있는지 확인해주세요.")
        print("    예: C:\\Program Files\\PostgreSQL\\16\\bin")
        return False
    except Exception as e:
        print(f"[!] pg_dump 확인 중 오류: {e}")
        return False


def export_database(config, output_dir='.'):
    """데이터베이스를 SQL 파일로 덤프"""

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_file = os.path.join(output_dir, f'database_dump_{timestamp}.sql')
    info_file = os.path.join(output_dir, f'database_dump_{timestamp}_info.txt')

    print(f"\n[*] 데이터베이스 덤프 시작...")
    print(f"    데이터베이스: {config['database']}")
    print(f"    호스트: {config['host']}:{config['port']}")
    print(f"    사용자: {config['username']}")
    print(f"    출력 파일: {output_file}")

    # 환경 변수 설정 (비밀번호 전달)
    env = os.environ.copy()
    if config['password']:
        env['PGPASSWORD'] = config['password']

    # pg_dump 명령어 구성
    cmd = [
        'pg_dump',
        '-h', config['host'],
        '-p', str(config['port']),
        '-U', config['username'],
        '-d', config['database'],
        '--format=plain',           # SQL 텍스트 형식
        '--encoding=UTF8',          # UTF-8 인코딩
        '--no-owner',               # 소유자 정보 제외
        '--no-privileges',          # 권한 정보 제외
        '--verbose',                # 진행 상황 표시
        '-f', output_file
    ]

    try:
        print("\n[*] pg_dump 실행 중...")
        print("    (큰 데이터베이스의 경우 시간이 걸릴 수 있습니다)\n")

        result = subprocess.run(
            cmd,
            env=env,
            capture_output=True,
            text=True,
            timeout=600  # 10분 타임아웃
        )

        if result.returncode == 0:
            # 파일 크기 확인
            file_size = os.path.getsize(output_file)
            file_size_mb = file_size / (1024 * 1024)

            print(f"\n[OK] 데이터베이스 덤프 완료!")
            print(f"     파일: {output_file}")
            print(f"     크기: {file_size_mb:.2f} MB")

            # 덤프 정보 파일 생성
            info_content = f"""데이터베이스 덤프 정보
{'='*50}

덤프 일시: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
데이터베이스: {config['database']}
호스트: {config['host']}:{config['port']}
사용자: {config['username']}

덤프 파일: {output_file}
파일 크기: {file_size_mb:.2f} MB

복원 방법:
    1. 오프라인 환경에서 PostgreSQL 설치
    2. .env 파일 생성 및 DB 연결 정보 입력
    3. python import_database.py {os.path.basename(output_file)}

주의사항:
    - 덤프 파일과 이 정보 파일을 함께 보관하세요
    - 덤프 파일에는 모든 데이터가 포함되어 있습니다
    - 복원 시 동일한 데이터베이스 이름을 사용하세요
"""

            with open(info_file, 'w', encoding='utf-8') as f:
                f.write(info_content)

            print(f"\n[OK] 덤프 정보 파일 생성: {info_file}")

            return True
        else:
            print(f"\n[!] 덤프 실패!")
            print(f"    오류 메시지:\n{result.stderr}")

            # 생성된 파일이 있으면 삭제
            if os.path.exists(output_file):
                os.remove(output_file)

            return False

    except subprocess.TimeoutExpired:
        print("\n[!] 덤프 시간 초과 (10분)")
        print("    데이터베이스가 너무 크거나 네트워크가 느립니다.")
        return False

    except Exception as e:
        print(f"\n[!] 덤프 중 오류 발생: {e}")
        return False


def main():
    print("=" * 60)
    print("  Database Export - PostgreSQL Dump")
    print("=" * 60)

    # 현재 디렉토리가 backend인지 확인
    if not os.path.exists('app'):
        print("\n[!] 이 스크립트는 backend 폴더에서 실행해야 합니다.")
        print("    cd backend")
        print("    python export_database.py")
        sys.exit(1)

    # Step 1: 환경 변수 로드
    print("\n[Step 1/4] 환경 변수 로드...")
    if not load_env():
        sys.exit(1)

    # Step 2: DB 설정 확인
    print("\n[Step 2/4] 데이터베이스 설정 확인...")
    config = get_db_config()
    if not config:
        sys.exit(1)
    print(f"[OK] Database: {config['database']}")

    # Step 3: pg_dump 확인
    print("\n[Step 3/4] pg_dump 확인...")
    if not check_pg_dump():
        sys.exit(1)

    # Step 4: 덤프 실행
    print("\n[Step 4/4] 데이터베이스 덤프...")
    if not export_database(config):
        sys.exit(1)

    print("\n" + "=" * 60)
    print("  Export Complete!")
    print("=" * 60)
    print("\n다음 파일들을 오프라인 환경으로 복사하세요:")
    print("  1. database_dump_*.sql")
    print("  2. database_dump_*_info.txt")
    print("  3. import_database.py")
    print("  4. 전체 backend 폴더 (앱 코드 포함)")
    print("\n오프라인 환경에서:")
    print("  python import_database.py database_dump_YYYYMMDD_HHMMSS.sql")
    print()


if __name__ == '__main__':
    main()
