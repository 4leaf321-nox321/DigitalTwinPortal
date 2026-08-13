"""
과제PL 계정 연결 → 편집 권한. (2026-08-02 추가)

확인하는 것
  A  pl_knox_id 가 본인이면 편집 가능 (소유자도 참여인력도 아닌 사람)
  B  이름만 같고 knoxId 가 비면 **편집 불가** — is_project_pl 은 이름을 안 본다
  C  대소문자·공백이 달라도 매칭된다
  D  파이썬 판정(is_project_pl)과 SQL 판정(member_sql_condition)이 일치한다
     ← 갈리면 "목록에는 보이는데 못 고치는" 과제가 생긴다
  E  AI 는 pl_knox_id 를 못 바꾼다 (권한 상승 경로 차단)
  F  viewer 는 PL 이어도 못 고친다

실행:  venv/Scripts/python.exe scripts/dt3_test_pl_link.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app                                        # noqa: E402
from app.extensions import db                                     # noqa: E402
from app.modules.auth.models import User, UserRole                # noqa: E402
from app.modules.digital_twin_dashboard import permissions as P    # noqa: E402
from app.modules.digital_twin_dashboard.models_v2 import Dt2Project  # noqa: E402

FAIL = []


def check(name, got, want):
    ok = got == want
    print(f"  {'OK  ' if ok else 'FAIL'}  {name}: got={got!r} want={want!r}")
    if not ok:
        FAIL.append(name)


def main():
    app = create_app()
    with app.app_context():
        # 실제 계정을 쓰지 않고 임시 사용자를 만든다. 롤백하므로 남지 않는다.
        pl = User(email='dt3plx@samsung.com', name='PL시험',
                  role=UserRole.USER, is_active=True)
        other = User(email='dt3othx@samsung.com', name='남시험',
                     role=UserRole.USER, is_active=True)
        viewer = User(email='dt3viewx@samsung.com', name='뷰어시험',
                      role=UserRole.VIEWER, is_active=True)
        # 소유자도 PL 도 참여인력도 아닌 사람. 권한이 새는지 보는 대조군이다.
        stranger = User(email='dt3strx@samsung.com', name='무관시험',
                        role=UserRole.USER, is_active=True)
        for u in (pl, other, viewer, stranger):
            u.password_hash = 'x'      # NOT NULL 이라 채운다. 로그인은 하지 않는다.
        db.session.add_all([pl, other, viewer, stranger])
        db.session.flush()

        # 소유자는 other — PL 은 소유자가 아니다. 참여인력도 비어 있다.
        p = Dt2Project(uuid='dt3-pl-link-test', code='ZZ-PLTEST', title='PL 연결 시험',
                       owner_user_id=other.id, row_version=1, extra_fields={},
                       members_json=[], owners_json=[],
                       pl_name='PL시험', pl_knox_id='dt3plx')
        db.session.add(p)
        db.session.flush()

        print('A  pl_knox_id 로 편집 권한')
        check('PL 본인 편집 가능', P.can_edit_project(pl, p), True)
        check('소유자도 편집 가능(기존 경로)', P.can_edit_project(other, p), True)
        check('무관한 사람 편집 불가', P.can_edit_project(stranger, p), False)

        print('B  이름만 있고 knoxId 가 비면 권한 없음')
        p.pl_knox_id = None
        db.session.flush()
        check('이름만으로는 불가', P.can_edit_project(pl, p), False)
        check('is_project_pl 도 False', P.is_project_pl(pl, p), False)

        print('C  대소문자·공백 무시')
        p.pl_knox_id = '  DT3PLX  '
        db.session.flush()
        check('대소문자/공백 달라도 매칭', P.is_project_pl(pl, p), True)

        print('D  파이썬 판정 == SQL 판정')
        p.pl_knox_id = 'dt3plx'
        db.session.flush()
        cond = P.member_sql_condition(pl)
        rows = db.session.query(Dt2Project.uuid).filter(cond).all() if cond is not None else []
        sql_hit = ('dt3-pl-link-test',) in rows
        check('SQL 이 PL 과제를 잡는다', sql_hit, True)
        check('파이썬과 일치', sql_hit, P.is_project_pl(pl, p))

        # 남의 knoxId 로는 안 잡혀야 한다
        cond_o = P.member_sql_condition(other)
        rows_o = db.session.query(Dt2Project.uuid).filter(cond_o).all() if cond_o is not None else []
        check('남에게는 안 잡힌다', ('dt3-pl-link-test',) in rows_o, False)

        # 2026-08-02 완화: AI 도 pl_knox_id 를 바꿀 수 있게 됐다. 대신 **knoxId 가
        # 필수이고 확인(core)을 거친다.** 자세한 규칙은 dt3_test_ai_people.py.
        # 이 시험은 "이름만으로는 안 된다" 는 선만 지킨다.
        print('E  AI 는 pl_knox_id 를 knoxId 와 함께만 바꾼다')
        check('금지가 아니다', P.ai_forbidden_in({'pl_knox_id': 'x'}), [])
        check('확인은 거친다(core)',
              'pl_knox_id' in P.classify_patch({'pl_knox_id': 'x'}).core, True)
        check('표시용 pl_name 은 금지 아님', P.ai_forbidden_in({'pl_name': 'x'}), [])
        check('author_knox_id 는 금지 아님', P.ai_forbidden_in({'author_knox_id': 'x'}), [])
        cls = P.classify_patch({'pl_knox_id': 'x'})
        check('pl_knox_id 는 핵심(확인 필요)', 'pl_knox_id' in cls.core, True)
        # ⚠️ **2026-08-11 부터 핵심(core)이다.** 그전에는 저위험이었다 —
        #    작성자가 편집 권한을 갖게 되면서 pl_knox_id 와 같은 취급이 됐다.
        cls2 = P.classify_patch({'author_knox_id': 'x'})
        check('★ author_knox_id 는 이제 핵심(확인 필요)',
              'author_knox_id' in cls2.core, True)
        check('  저위험이 아니다', 'author_knox_id' in cls2.low_risk, False)

        print('F  viewer 는 PL 이어도 불가')
        p.pl_knox_id = 'dt3viewx'
        db.session.flush()
        check('viewer 차단', P.can_edit_project(viewer, p), False)

        db.session.rollback()

    print()
    if FAIL:
        print(f'실패 {len(FAIL)}건: {", ".join(FAIL)}')
        sys.exit(1)
    print('전부 통과')


if __name__ == '__main__':
    main()
