"""
참여인력 편집 권한 시험 (2026-07-29 결정) — 개발 DB 전용.

    "소유자 말고, 담당자(참여인력)에 등록된 사람도 수정 권한이 있어야 한다."

권한이 **넓어지는** 변경이라, 열려야 할 것보다 **닫혀야 할 것**을 더 본다.

    knoxId 매칭       이메일 로컬파트와 1:1. 대소문자·공백 흔들림
    빈 knoxId         "" 가 아무나 매칭시키면 안 된다 ★
    이름 매칭         동명이인이면 인정하지 않는다 ★
    owners_json       문자열 배열 형태
    viewer            참여인력이어도 쓰기 금지 ★
    목록 ↔ 권한       editable=true 와 can_edit 이 일치하는가 ★

사용법
    python scripts\\dt3_test_member.py
"""

from __future__ import annotations

import os
import sys
import uuid as uuidlib

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.extensions import db
from app.modules.auth.models import User, UserRole
from app.modules.digital_twin_dashboard import permissions as P
from app.modules.digital_twin_dashboard.models_v2 import (
    Dt2Project, Dt2ProjectChange, Dt2ProjectHistory, Dt2ProjectPerformance,
    Dt2ChangeProposal,
)
from flask_jwt_extended import create_access_token
from sqlalchemy import or_

MARK = '__dt3_mem__'
results = []


def check(desc, cond, extra=''):
    results.append((desc, bool(cond)))
    print(f"  {'[OK]  ' if cond else '[FAIL]'} {desc}" + (f"   {extra}" if not cond and extra else ''))


def auth(u):
    return {'Authorization': f'Bearer {create_access_token(identity=str(u.id))}',
            'X-DT2-Allow-Write': 'test'}


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    app = create_app()
    with app.app_context():
        client = app.test_client()
        n_proj, n_user = Dt2Project.query.count(), User.query.count()
        admin = User.query.filter_by(role=UserRole.ADMIN, is_active=True).first()

        made = []

        def mk(tag, name, role=UserRole.USER, email=None):
            u = User(email=email or f'{MARK}{tag}@t.local', name=name,
                     role=role, is_active=True)
            u.set_password('x' * 16)
            db.session.add(u); db.session.commit()
            made.append(u)
            return u

        # knoxId 로 매칭될 사람 (email 로컬파트 = MARKknox)
        by_knox = mk('knox', f'{MARK}녹스', email=f'{MARK}KNOX@t.local')
        # 이름으로 매칭될 사람 (유일한 이름)
        by_name = mk('name', f'{MARK}유일한이름')
        # 동명이인 2명 — 이름으로 매칭되면 안 된다
        dup1 = mk('dup1', f'{MARK}동명이인')
        dup2 = mk('dup2', f'{MARK}동명이인')
        # 전혀 무관
        outsider = mk('out', f'{MARK}무관')
        # viewer 인데 참여인력에 들어 있음
        viewer = mk('view', f'{MARK}뷰어', role=UserRole.VIEWER)

        puid = str(uuidlib.uuid4())
        try:
            db.session.add(Dt2Project(
                uuid=puid, code=MARK, title=MARK, status='정상진행', progress=10,
                owner_user_id=admin.id, row_version=1, extra_fields={},
                members_json=[
                    {'knoxId': f'{MARK}Knox', '부서': 'X', '이름': '아무개'},   # 대소문자 다름
                    {'knoxId': '  ', '이름': f'{MARK}유일한이름'},              # 공백 knoxId
                    {'knoxId': '', '이름': f'{MARK}동명이인'},                  # 빈 knoxId
                    {'knoxId': '', '이름': f'{MARK}뷰어'},
                ],
                owners_json=[f'{MARK}유일한이름'],
                is_deleted=False, is_permanently_deleted=False))
            db.session.commit()

            print("\n── knoxId 매칭 ──")
            r = client.get(f'/api/dt-v2/projects/{puid}', headers=auth(by_knox))
            check('★ knoxId 로 등록된 사람 canEdit=True',
                  r.get_json()['data'].get('canEdit') is True)
            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'progress': 21}}, headers=auth(by_knox))
            check('  실제 수정 200 (대소문자 달라도 매칭)', r.status_code == 200,
                  f'실제 {r.status_code}')

            # ⚠️ **2026-08-11 규칙이 바뀌었다.** 그전에는 "이름이 활성 사용자 중
            #    유일하면" 편집 권한이 열렸다. 지금은 **knoxId 로만** 연다 —
            #    동명이인이 한 명만 새로 가입해도 조용히 끊기는 판정이었고,
            #    그때까지는 엉뚱한 사람이 열려 있었을 수 있기 때문이다.
            print("\n── ★ 이름만으로는 열리지 않는다 (2026-08-11) ──")
            r = client.get(f'/api/dt-v2/projects/{puid}', headers=auth(by_name))
            check('★★ 유일한 이름이어도 canEdit=False',
                  r.get_json()['data'].get('canEdit') is False,
                  f"실제 {r.get_json()['data'].get('canEdit')}")
            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'progress': 22}}, headers=auth(by_name))
            check('★★ 실제 수정도 403', r.status_code == 403, f'실제 {r.status_code}')

            print("\n── ★ 동명이인도 당연히 인정하지 않는다 ──")
            for u, tag in ((dup1, 'dup1'), (dup2, 'dup2')):
                r = client.get(f'/api/dt-v2/projects/{puid}', headers=auth(u))
                check(f'★★ {tag}: canEdit=False (같은 이름이 2명)',
                      r.get_json()['data'].get('canEdit') is False,
                      f"실제 {r.get_json()['data'].get('canEdit')}")
                r = client.patch(f'/api/dt-v2/projects/{puid}',
                                 json={'patch': {'progress': 99}}, headers=auth(u))
                check(f'  {tag}: 수정 403', r.status_code == 403, f'실제 {r.status_code}')
            local, name_tok = P.actor_match_tokens(dup1)
            check('★ 동명이인은 이름 토큰이 None', name_tok is None, f'실제 {name_tok!r}')

            print("\n── ★ 빈 knoxId 가 아무나 열어주지 않는가 ──")
            r = client.get(f'/api/dt-v2/projects/{puid}', headers=auth(outsider))
            check('★★ 무관한 사람 canEdit=False',
                  r.get_json()['data'].get('canEdit') is False)
            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'progress': 98}}, headers=auth(outsider))
            check('★★ 무관한 사람 403', r.status_code == 403, f'실제 {r.status_code}')
            # 이메일에 @ 가 없어 로컬파트가 빈 사용자도 매칭되면 안 된다
            weird = mk('weird', f'{MARK}이메일이상', email='no-at-sign')
            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'progress': 97}}, headers=auth(weird))
            check('★ 로컬파트를 못 만드는 계정도 403', r.status_code == 403,
                  f'실제 {r.status_code}')

            print("\n── ★ viewer 는 참여인력이어도 쓰기 금지 ──")
            r = client.get(f'/api/dt-v2/projects/{puid}', headers=auth(viewer))
            check('★★ viewer canEdit=False (참여인력이지만)',
                  r.get_json()['data'].get('canEdit') is False,
                  f"실제 {r.get_json()['data'].get('canEdit')}")
            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'progress': 96}}, headers=auth(viewer))
            check('★★ viewer 403', r.status_code == 403, f'실제 {r.status_code}')

            # `owners_json` 은 **이름 문자열 배열**이라 knoxId 가 아예 없다.
            # 이름 매칭을 버렸으므로 이 경로는 이제 권한을 열지 않는다 —
            # 그 사람은 참여인력에 knoxId 로 등록돼 있어야 한다.
            print("\n── ★ owners_json(이름 문자열)은 권한을 열지 않는다 ──")
            proj = Dt2Project.query.filter_by(uuid=puid).first()
            proj.members_json = []
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(proj, 'members_json'); db.session.commit()
            r = client.get(f'/api/dt-v2/projects/{puid}', headers=auth(by_name))
            check('★★ members 를 비우면 owners_json 문자열로는 안 열린다',
                  r.get_json()['data'].get('canEdit') is False,
                  f"실제 {r.get_json()['data'].get('canEdit')}")
            r = client.get(f'/api/dt-v2/projects/{puid}', headers=auth(by_knox))
            check('  knoxId 만 있던 사람은 이제 불가',
                  r.get_json()['data'].get('canEdit') is False)

            print("\n── ★ 목록 필터와 권한이 일치하는가 ──")
            proj = Dt2Project.query.filter_by(uuid=puid).first()
            proj.members_json = [{'knoxId': f'{MARK}Knox', '이름': '아무개'}]
            flag_modified(proj, 'members_json'); db.session.commit()
            for u, tag in ((by_knox, 'knoxId'), (by_name, '이름'), (dup1, '동명이인'),
                           (outsider, '무관'), (viewer, 'viewer')):
                r = client.get('/api/dt-v2/projects?editable=true&limit=1000',
                               headers=auth(u))
                listed = {i['uuid'] for i in r.get_json()['data']['items']}
                db.session.expire_all()
                pr = Dt2Project.query.filter_by(uuid=puid).first()
                expect = P.can_edit_project(u, pr)
                check(f'★ {tag}: 목록 포함={puid in listed}, 권한={expect} 일치',
                      (puid in listed) == expect)
                rows = Dt2Project.query.filter(
                    Dt2Project.uuid.in_(listed)).all() if listed else []
                bad = [x.code for x in rows if not P.can_edit_project(u, x)]
                check(f'  {tag}: 목록의 모든 항목이 편집 가능', not bad,
                      f'예외 {bad[:3]}')

        finally:
            print("\n── 정리 ──")
            ids = [u.id for u in made]
            Dt2ProjectPerformance.query.filter_by(project_uuid=puid).delete()
            Dt2ChangeProposal.query.filter_by(project_uuid=puid).delete()
            Dt2ProjectChange.query.filter_by(project_uuid=puid).delete()
            Dt2ProjectHistory.query.filter_by(project_uuid=puid).delete()
            Dt2Project.query.filter_by(uuid=puid).delete()
            db.session.commit()
            Dt2ProjectChange.query.filter(
                or_(Dt2ProjectChange.actor_user_id.in_(ids),
                    Dt2ProjectChange.on_behalf_of.in_(ids))).delete(
                synchronize_session=False)
            db.session.commit()
            User.query.filter(User.id.in_(ids)).delete(synchronize_session=False)
            db.session.commit()
            check('과제 건수 불변', Dt2Project.query.count() == n_proj)
            check('사용자 건수 불변', User.query.count() == n_user,
                  f'{n_user} -> {User.query.count()}')

        failed = [d for d, ok in results if not ok]
        print("\n" + "=" * 72)
        if failed:
            print(f" 결과: [FAIL] {len(failed)}건 실패")
            for d in failed:
                print(f"   - {d}")
            print("=" * 72)
            sys.exit(1)
        print(f" 결과: [OK] {len(results)}건 전부 통과")
        print("=" * 72)


if __name__ == '__main__':
    main()
