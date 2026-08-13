"""
시스템 설정 초기화 스크립트
DB의 시스템 설정을 삭제하여 기본값(systemsetting.json)으로 되돌립니다.

사용법:
    python reset_system_settings.py
"""

import os
import sys
from dotenv import load_dotenv

# .env 파일 로드
load_dotenv()

def reset_settings():
    """시스템 설정 테이블 초기화"""
    try:
        from app import create_app
        from app.extensions import db
        from app.modules.digital_twin_dashboard.models import ModuleSettings

        app = create_app()

        with app.app_context():
            print("=" * 50)
            print("  시스템 설정 초기화")
            print("=" * 50)

            # 기존 설정 조회
            settings = ModuleSettings.query.filter_by(
                module_name='digital_twin_dashboard',
                setting_key='system_settings'
            ).first()

            if settings:
                print(f"\n[*] 기존 설정 발견")
                print(f"    ID: {settings.id}")
                print(f"    생성일: {settings.created_at}")
                print(f"    수정일: {settings.updated_at}")

                # 삭제 확인
                confirm = input("\n기존 설정을 삭제하시겠습니까? (y/n): ").strip().lower()
                if confirm == 'y':
                    db.session.delete(settings)
                    db.session.commit()
                    print("\n[OK] 기존 설정이 삭제되었습니다.")
                    print("     다음 앱 실행 시 systemsetting.json의 기본값이 사용됩니다.")
                else:
                    print("\n[*] 초기화가 취소되었습니다.")
            else:
                print("\n[*] DB에 저장된 설정이 없습니다.")
                print("     이미 기본값(systemsetting.json)을 사용하고 있습니다.")

            print("\n" + "=" * 50)
            print("  완료")
            print("=" * 50)

    except ImportError as e:
        print(f"[!] 모듈 import 실패: {e}")
        print("    가상환경이 활성화되어 있는지 확인하세요.")
        sys.exit(1)
    except Exception as e:
        print(f"[!] 오류 발생: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    # backend 폴더에서 실행되는지 확인
    if not os.path.exists('app'):
        print("\n[!] 이 스크립트는 backend 폴더에서 실행해야 합니다.")
        print("    cd backend")
        print("    python reset_system_settings.py")
        sys.exit(1)

    reset_settings()
