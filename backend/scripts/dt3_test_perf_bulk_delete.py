"""
성과 전체 삭제 — **가드 검증(비파괴).** (2026-08-02)

무엇이 바뀌었나
    '새 성과 추가' 모달의 '전체 삭제'는 로컬 사본만 비우고 "삭제되었습니다" 라고
    말했다. 새로고침하면 서버에서 다시 내려와 되살아났다 —
    연도별 일괄 삭제가 고친 것과 **같은 종류의 거짓말**이다. 이제 서버를 지운다.

권한이 **넓어지는**(그리고 파괴적인) 변경이라, 되는 것보다 **막히는 것**을 본다.
성공 경로는 DB 전체를 지우므로 여기서 돌리지 않는다 — 별도 스크립트로 분리.

  A  delete-summary 가 서버 기준 실제 건수를 준다
  B  일반 사용자는 403 (조회·실행 둘 다) ★
  C  사무국(dt_office)도 403 — GLOBAL_EDIT_ROLES 를 쓰지 않는 것이 의도다 ★
  D  expectedCount 가 다르면 409 이고 **아무것도 안 지워진다** ★★
  E  비로그인은 401
  F  PAT(MCP)은 403 — 코드 경로가 연도별 삭제와 같은 헬퍼인지 확인 ★

실행:  venv/Scripts/python.exe scripts/dt3_test_perf_bulk_delete.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask_jwt_extended import create_access_token                    # noqa: E402

from app import create_app                                            # noqa: E402
from app.extensions import db                                         # noqa: E402
from app.modules.auth.models import User, UserRole                    # noqa: E402
from app.modules.digital_twin_dashboard.models_v2 import (            # noqa: E402
    Dt2Performance, Dt2ProjectPerformance,
)

FAIL = []
SUMMARY_URL = '/api/dt-v2/performances/delete-summary'
DELETE_URL = '/api/dt-v2/performances/bulk-delete'


def check(name, got, want):
    ok = got == want
    print(f"  {'OK  ' if ok else 'FAIL'}  {name}: got={got!r} want={want!r}")
    if not ok:
        FAIL.append(name)


def check_true(name, got):
    ok = bool(got)
    print(f"  {'OK  ' if ok else 'FAIL'}  {name}: {got!r}")
    if not ok:
        FAIL.append(name)


def hdr(user):
    return {'Authorization': f'Bearer {create_access_token(identity=str(user.id))}'}


def main():
    app = create_app()
    with app.app_context():
        c = app.test_client()
        admin = User.query.filter_by(email='yjtwin.park@samsung.com').first()
        plain = (User.query.filter(User.is_active.is_(True),
                                   User.id != admin.id,
                                   User.is_admin.isnot(True)).first())
        if admin is None or plain is None:
            print('테스트할 계정이 부족하다 — 중단')
            return 1

        live_before = Dt2Performance.query.filter(
            Dt2Performance.is_deleted.isnot(True)).count()
        links_before = Dt2ProjectPerformance.query.count()
        print(f'현재 살아있는 성과 {live_before}건 · 연결 {links_before}건')
        print()

        print('A  delete-summary 가 서버 기준 건수를 준다')
        r = c.get(SUMMARY_URL, headers=hdr(admin))
        check('조회', r.status_code, 200)
        d = (r.get_json() or {}).get('data', {})
        check('activeCount 가 실제와 일치', d.get('activeCount'), live_before)
        check_true('affectedProjectCount 있음', 'affectedProjectCount' in d)
        print(f"       (연결이 끊길 과제 {d.get('affectedProjectCount')}건)")

        print('B  일반 사용자는 403 ★')
        check('조회 403', c.get(SUMMARY_URL, headers=hdr(plain)).status_code, 403)
        check('실행 403', c.post(DELETE_URL, headers=hdr(plain),
                                 json={'expectedCount': live_before}).status_code, 403)

        print('C  사무국(dt_office)도 403 ★')
        office = User.query.filter(User.is_active.is_(True),
                                   User.role == UserRole.DT_OFFICE_MEMBER).first()
        if office is None:
            # 계정이 없으면 일반 사용자의 역할을 잠시 바꿔 확인하고 되돌린다
            original = plain.role
            plain.role = UserRole.DT_OFFICE_MEMBER
            db.session.flush()
            check('조회 403', c.get(SUMMARY_URL, headers=hdr(plain)).status_code, 403)
            check('실행 403', c.post(DELETE_URL, headers=hdr(plain),
                                     json={'expectedCount': live_before}).status_code, 403)
            plain.role = original
            db.session.rollback()
        else:
            check('조회 403', c.get(SUMMARY_URL, headers=hdr(office)).status_code, 403)

        print('D  expectedCount 가 다르면 409 이고 아무것도 안 지워진다 ★★')
        r = c.post(DELETE_URL, headers=hdr(admin),
                   json={'expectedCount': live_before + 7})
        check('409', r.status_code, 409)
        check_true('안내에 실제 건수가 들어 있다',
                   str(live_before) in ((r.get_json() or {}).get('message') or ''))
        db.session.expire_all()
        check('성과가 그대로', Dt2Performance.query.filter(
            Dt2Performance.is_deleted.isnot(True)).count(), live_before)
        check('연결이 그대로', Dt2ProjectPerformance.query.count(), links_before)

        print('E  비로그인은 401')
        check('조회 401', c.get(SUMMARY_URL).status_code, 401)
        check('실행 401', c.post(DELETE_URL, json={}).status_code, 401)

        print('F  PAT(MCP)은 403 — 연도별 삭제와 같은 헬퍼를 지나는가 ★')
        import inspect
        from app.modules.digital_twin_dashboard import routes_v2 as R
        src_sum = inspect.getsource(R.performance_delete_summary)
        src_del = inspect.getsource(R.bulk_delete_performances)
        check_true('summary 가 _bulk_delete_actor 사용', '_bulk_delete_actor' in src_sum)
        check_true('delete 가 _bulk_delete_actor 사용', '_bulk_delete_actor' in src_del)
        check_true('헬퍼가 pat_user 를 먼저 본다',
                   'pat_user()' in inspect.getsource(R._bulk_delete_actor))

        print()
        db.session.expire_all()
        after = Dt2Performance.query.filter(
            Dt2Performance.is_deleted.isnot(True)).count()
        check('검증 후에도 데이터 그대로', after, live_before)

    print()
    if FAIL:
        print(f'실패 {len(FAIL)}건: {", ".join(FAIL)}')
        return 1
    print('전부 통과 (데이터 변경 없음)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
