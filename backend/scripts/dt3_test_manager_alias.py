"""
`관리자`(manager_name)는 과제PL 의 사본이다 — 독립 필드가 아니다. (2026-08-02)

전에 무슨 일이 있었나
    화면에는 입력 칸이 없는데 저장할 때 과제PL 값이 복사돼 들어갔고, 그러면서
    별도 필드로 노출돼 있어 **AI 는 이것만 따로 바꿀 수 있었다.** 확인(202)까지
    거쳐 반영한 값이 다음 저장 때 조용히 덮였고, 읽는 코드가 없어 아무도 몰랐다.

확인하는 것
  A  분류상 불변이다 — 사람이든 AI 든 직접 못 쓴다
  B  과제PL 을 쓰면 관리자가 따라온다 (_derive_manager)
  C  과제PL 을 안 건드리면 관리자도 그대로다 (엉뚱한 덮어쓰기 없음)
  D  DB 에 과제PL 과 어긋난 행이 없다

실행:  venv/Scripts/python.exe scripts/dt3_test_manager_alias.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app                                           # noqa: E402
from app.extensions import db                                        # noqa: E402
from app.modules.digital_twin_dashboard import permissions as P       # noqa: E402
from app.modules.digital_twin_dashboard.models_v2 import Dt2Project   # noqa: E402
from app.modules.digital_twin_dashboard.routes_v2 import _derive_manager  # noqa: E402

FAIL = []


def check(name, got, want):
    ok = got == want
    print(f"  {'OK  ' if ok else 'FAIL'}  {name}: got={got!r} want={want!r}")
    if not ok:
        FAIL.append(name)


def main():
    app = create_app()
    with app.app_context():
        print('A  분류상 불변')
        cls = P.classify_patch({'manager_name': '아무개'})
        check('직접 쓰기는 거부된다', 'manager_name' in cls.rejected, True)
        check('핵심 필드가 아니다', 'manager_name' in cls.core, False)
        check('저위험도 아니다', 'manager_name' in cls.low_risk, False)

        print('B  과제PL 을 쓰면 따라온다')
        d = {'pl_name': '홍길동'}
        _derive_manager(d)
        check('관리자가 채워진다', d.get('manager_name'), '홍길동')

        d2 = {'pl_name': ''}
        _derive_manager(d2)
        check('빈 PL 도 그대로 따라간다', d2.get('manager_name'), '')

        print('C  과제PL 을 안 건드리면 그대로')
        d3 = {'progress': 50}
        _derive_manager(d3)
        check('관리자를 건드리지 않는다', 'manager_name' in d3, False)

        print('D  DB 정합성')
        bad = (db.session.query(db.func.count(Dt2Project.uuid))
               .filter(Dt2Project.is_deleted.is_(False))
               .filter(db.func.btrim(db.func.coalesce(Dt2Project.manager_name, '')) !=
                       db.func.btrim(db.func.coalesce(Dt2Project.pl_name, '')))
               .scalar())
        check('과제PL 과 어긋난 활성 과제 수', bad, 0)

    print()
    if FAIL:
        print(f'실패 {len(FAIL)}건: {", ".join(FAIL)}')
        sys.exit(1)
    print('전부 통과')


if __name__ == '__main__':
    main()
