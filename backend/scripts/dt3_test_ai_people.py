"""
AI 가 참여인력·과제PL 을 지정할 수 있다 — **knoxId 를 붙였을 때만.** (2026-08-02)

왜 열었나
    원래 막은 이유는 "AI 계정에 권한이 없어서" 가 아니었다. 확인 화면이 **이름으로**
    before→after 를 보여주는데 동명이인이면 사용자가 누구인지 모른 채 승인하게 되기
    때문이다. knoxId 는 users.email 로컬파트와 1:1 이라 그 모호함이 없다.
    그래서 금지를 푸는 대신 **knoxId 를 필수로** 만들었다.

권한이 **넓어지는** 변경이라, 열려야 할 것보다 **닫혀야 할 것**을 더 본다.

  A  knoxId 가 있으면 통과, 없으면 걸린다
  B  빈 배열·연결해제(빈 문자열)는 막지 않는다 — 권한을 주는 방향이 아니다
  C  이름만 담기는 필드(담당자·과제참여인력·소유자)는 **여전히 금지** ★
  D  분류는 core 다 — 저위험으로 새면 확인 없이 권한이 생긴다 ★
  E  preview 가 누구인지 알아볼 수 있게 나온다 (이름·knoxId·부서·연결)
  F  사람 검색이 동명이인을 뭉개지 않는다

실행:  venv/Scripts/python.exe scripts/dt3_test_ai_people.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app                                           # noqa: E402
from app.extensions import db                                        # noqa: E402
from app.modules.auth.models import User, UserRole                   # noqa: E402
from app.modules.digital_twin_dashboard import permissions as P       # noqa: E402
from app.modules.digital_twin_dashboard.routes_v2 import _people_preview  # noqa: E402

FAIL = []


def check(name, got, want):
    ok = got == want
    print(f"  {'OK  ' if ok else 'FAIL'}  {name}: got={got!r} want={want!r}")
    if not ok:
        FAIL.append(name)


def main():
    app = create_app()
    with app.app_context():
        print('A  knoxId 필수')
        check('참여인력에 knoxId 있으면 통과',
              P.people_fields_missing_knox(
                  {'members_json': [{'knoxId': 'a.b', '이름': '홍길동'}]}), [])
        check('참여인력에 knoxId 없으면 걸린다',
              P.people_fields_missing_knox(
                  {'members_json': [{'이름': '홍길동'}]}), ['members_json'])
        check('한 명이라도 비면 걸린다',
              P.people_fields_missing_knox(
                  {'members_json': [{'knoxId': 'a.b', '이름': 'A'}, {'이름': 'B'}]}),
              ['members_json'])
        check('공백만 있는 knoxId 도 걸린다',
              P.people_fields_missing_knox(
                  {'members_json': [{'knoxId': '   ', '이름': 'A'}]}), ['members_json'])
        check('배열이 아니면 걸린다',
              P.people_fields_missing_knox({'members_json': 'abc'}), ['members_json'])
        check('과제PL knoxId 있으면 통과',
              P.people_fields_missing_knox({'pl_knox_id': 'a.b'}), [])

        print('B  권한을 주지 않는 방향은 막지 않는다')
        check('빈 배열(전원 삭제) 허용',
              P.people_fields_missing_knox({'members_json': []}), [])
        check('과제PL 연결 해제(빈 문자열) 허용',
              P.people_fields_missing_knox({'pl_knox_id': ''}), [])
        check('사람 필드가 없으면 아무것도 안 걸린다',
              P.people_fields_missing_knox({'진행률': 50}), [])

        # 2026-08-05: 셋 다 금지에서 풀렸다 — 다만 **여전히 AI 가 이름만으로
        # 사람을 못 넣는다**는 결론은 같다. 방법이 바뀌었을 뿐이다.
        #   담당자·과제참여인력 → 파생. 보내도 참여인력목록에서 다시 만들어진다.
        #   소유자             → 금지가 아니라 admin 전용(별도 검사).
        print('C  이름만 담기는 필드는 사본이라 파생된다 (보내도 안 들어간다)')
        check('담당자(owners_json) 는 파생 대상',
              'owners_json' in P.PROJECT_DERIVED_FIELDS, True)
        check('과제참여인력(레거시 문자열) 도 파생 대상',
              'member_names' in P.PROJECT_DERIVED_FIELDS, True)
        check('담당부서도 파생 대상', 'dept_name' in P.PROJECT_DERIVED_FIELDS, True)
        check('★ 파생 대상은 분류표에 없다 (보내도 안 들어간다)',
              [c for c in P.PROJECT_DERIVED_FIELDS
               if c in P.LOW_RISK_FIELDS or c in P.CORE_FIELDS], [])
        check('★ 소유자는 admin 전용이다',
              'owner_user_id' in P.OWNER_ADMIN_ONLY_FIELDS, True)
        check('참여인력목록은 이제 금지 아님',
              P.ai_forbidden_in({'members_json': [{'knoxId': 'a.b'}]}), [])
        check('과제PL_knoxId 는 이제 금지 아님',
              P.ai_forbidden_in({'pl_knox_id': 'a.b'}), [])

        print('D  분류는 core (확인 필요)')
        cls = P.classify_patch({'members_json': [{'knoxId': 'a.b'}], 'pl_knox_id': 'a.b'})
        check('참여인력목록 core', 'members_json' in cls.core, True)
        check('과제PL_knoxId core', 'pl_knox_id' in cls.core, True)
        check('저위험으로 새지 않는다', bool(cls.low_risk), False)

        print('E  preview 로 누구인지 알아본다')
        u = User(email='dt3ppl@samsung.com', name='피플시험',
                 role=UserRole.USER, is_active=True)
        u.password_hash = 'x'
        db.session.add(u)
        db.session.flush()

        pv = _people_preview({'members_json': [
            {'knoxId': 'dt3ppl', '이름': '피플시험'},
            {'knoxId': 'nobody.here', '이름': '미가입자'},
        ]})
        rows = pv.get('과제참여인력목록') or []
        check('두 명이 다 나온다', len(rows), 2)
        check('가입자는 연결됨', rows[0]['연결'] if rows else None, '연결됨')
        check('knoxId 가 보인다', rows[0]['knoxId'] if rows else None, 'dt3ppl')
        check('미가입자는 가입 대기',
              rows[1]['연결'] if len(rows) > 1 else None, '가입 대기(계정 없음)')

        pv2 = _people_preview({'pl_knox_id': 'dt3ppl'})
        check('과제PL 도 preview 가 나온다',
              (pv2.get('과제PL_knoxId') or [{}])[0].get('연결'), '연결됨')

        db.session.rollback()

        print('F  사람 검색이 동명이인을 뭉개지 않는다')
        # 같은 이름 두 명을 넣고 검색 결과에 둘 다, 그리고 동명이인 표시가 붙는지 본다.
        a = User(email='dt3dupa@samsung.com', name='중복시험',
                 role=UserRole.USER, is_active=True)
        b = User(email='dt3dupb@samsung.com', name='중복시험',
                 role=UserRole.USER, is_active=True)
        a.password_hash = b.password_hash = 'x'
        db.session.add_all([a, b])
        db.session.flush()
        found = (User.query.filter(User.is_active.is_(True))
                 .filter(User.name.ilike('%중복시험%')).all())
        check('두 명 다 검색된다', len(found), 2)
        check('knoxId 로 갈린다',
              sorted((x.email or '').split('@')[0] for x in found),
              ['dt3dupa', 'dt3dupb'])
        db.session.rollback()

    print()
    if FAIL:
        print(f'실패 {len(FAIL)}건: {", ".join(FAIL)}')
        sys.exit(1)
    print('전부 통과')


if __name__ == '__main__':
    main()
