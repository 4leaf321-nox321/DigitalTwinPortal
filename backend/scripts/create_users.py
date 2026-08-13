"""
계정 일괄 생성 — 개발 DB.

왜 스크립트인가
    이 시스템은 SSO 가 없어 원래 **본인이 직접 가입**한다. 그런데 과제 참여인력의
    knoxId(= 사내 이메일 @앞부분)는 **가입 전에도 미리 채워둘 수 있고**, 그러면
    그 사람이 가입하는 순간 편집 권한이 붙는다. 여기서 미리 만드는 계정도 같은
    자리를 차지한다 — 이름만 있는 참여인력을 실제 계정과 잇는 것이 목적이다.

무엇을 따르나
    `AuthService.register` 를 그대로 쓴다. 이메일 소문자화·중복 검사·비밀번호 정책
    (8자 이상 + 영문 + 숫자)이 전부 거기 있다. 여기서 규칙을 복제하지 않는다.

⚠️ 같은 이메일이 이미 있으면 **건너뛴다.** 덮어쓰지 않는다 —
   이미 쓰고 있는 계정의 비밀번호를 이 스크립트가 초기화하면 안 된다.

사용법
    python scripts\\create_users.py            # 미리보기 (아무것도 안 쓴다)
    python scripts\\create_users.py --apply    # 실제 생성
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app                              # noqa: E402
from app.modules.auth.models import User, UserRole      # noqa: E402
from app.modules.auth.services import AuthService       # noqa: E402

# 이메일 로컬파트가 곧 knoxId 다 (참여인력 대조가 이 값을 본다).
# 기존 관리자 계정이 'yjtwin.park@samsung.com' 이라 <이름>.<성> 형태를 따랐다.
DOMAIN = 'samsung.com'

PEOPLE = [
    # (이름,   knoxId)
    ('박국진', 'gukjin.park'),
    ('박미희', 'mihee.park'),
    ('김일권', 'ilkwon.kim'),
    ('한선수', 'sunsoo.han'),
    ('이현성', 'hyunsung.lee'),
    ('김경호', 'kyungho.kim'),
]

# 임시 비밀번호. 정책(8자 이상·영문·숫자)을 만족한다.
# **첫 로그인 후 반드시 바꾸게 안내할 것.**
TEMP_PASSWORD = 'Dtwin2026!'


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    apply = '--apply' in sys.argv
    app = create_app()

    with app.app_context():
        print('=' * 74)
        print(' 계정 생성 ' + ('(실제 반영)' if apply else '(미리보기 — --apply 를 붙여야 씁니다)'))
        print('=' * 74)

        created, skipped, failed = [], [], []
        for name, knox in PEOPLE:
            email = f'{knox}@{DOMAIN}'.lower()
            existing = User.query.filter_by(email=email).first()
            if existing is not None:
                skipped.append((name, email, f'이미 있음 (id={existing.id})'))
                continue

            if not apply:
                created.append((name, email, '생성 예정'))
                continue

            user, err = AuthService.register(
                email=email,
                password=TEMP_PASSWORD,
                name=name,
                # 부서는 비워 둔다. 이 값이 사업부로 풀려 **볼 수 있는 과제 범위**를
                # 정하기 때문에(VisibilityScopeContext), 모르는 채로 넣으면 안 된다.
                department=None,
            )
            if user is None:
                failed.append((name, email, err))
            else:
                created.append((name, email, f'생성됨 (id={user.id}, role={user.role})'))

        for label, rows in (('생성', created), ('건너뜀', skipped), ('실패', failed)):
            if not rows:
                continue
            print(f'\n[{label}] {len(rows)}건')
            for name, email, note in rows:
                print(f'  {name:<6} {email:<28} {note}')

        print('\n' + '-' * 74)
        print(f' 임시 비밀번호: {TEMP_PASSWORD}   (전원 동일 — 첫 로그인 후 변경 안내 필요)')
        print(f' 역할: {UserRole.USER} (기본값) · 부서: 미지정')
        print('-' * 74)
        if not apply:
            print(' ※ 미리보기였습니다. 실제로 만들려면: python scripts\\create_users.py --apply')

        return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
