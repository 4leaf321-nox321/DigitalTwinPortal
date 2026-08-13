"""
2026-08-11 권한 변경을 **눈으로 보는** 데모 — 개발 DB 전용.

무엇을 하나
    임시 사용자 1명과 임시 과제 1건을 만들어 네 가지 상황을 세우고,
    **같은 데이터에 옛 규칙과 지금 규칙을 둘 다 돌려** 나란히 보여준다.
    끝나면 만든 것을 전부 지운다(과제·사용자 건수 불변을 확인한다).

        S1  작성자만 있는 과제        예전 못 고침 → **지금 고칠 수 있다**
        S2  참여인력에 이름만         예전 고칠 수 있었음 → **지금 못 고친다**
        S3  담당자(owners_json 문자열) 예전 고칠 수 있었음 → **지금 못 고친다**
        S4  사업부 다른 참여인력       예전 목록에 안 보임 → **지금 보인다**

왜 이런 데모가 필요한가
    **개발 DB 에서는 그냥 둘러봐서는 아무 차이도 안 난다.** 시드가 모든 과제에
    소유자·PL·참여인력을 다 채워 놔서(활성 101건 전부 owner_user_id 보유,
    knoxId 없는 참여인력 0명, 사업부내공개 0건) 규칙을 바꿔도 결과가 같다.
    그래서 차이가 드러나는 상황을 **일부러 세워야** 한다.

「옛 규칙」은 흉내가 아니라 **그때 코드를 되살려 실제로 돌린 결과**다
    `_old_is_project_member` · `_old_can_view_project` 가 2026-08-11 이전 구현이고,
    `old_rules()` 안에서 `permissions` 모듈의 이름을 잠시 그것으로 바꿔 끼운다.
    `can_edit_project` 가 모듈 전역을 통해 부르므로 그대로 옛 판정이 돈다.
    ⚠️ 이 스크립트 밖으로 새지 않는다 — `finally` 에서 반드시 되돌린다.

무엇을 하지 않나
    **기존 데이터를 건드리지 않는다.** 새로 만든 과제 하나만 고친다.
    실패하든 성공하든 `finally` 에서 지우고, 건수가 그대로인지 확인한다.

사용법
    python scripts\\dt3_demo_permissions.py

의존성
    개발 백엔드와 같은 venv (앱을 직접 띄운다 — 서버가 안 떠 있어도 된다).
"""

from __future__ import annotations

import os
import sys
import uuid as uuidlib
from contextlib import contextmanager

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.extensions import db
from app.modules.auth.models import User, UserRole
from app.modules.digital_twin_dashboard import permissions as P
from app.modules.digital_twin_dashboard.models import Division
from app.modules.digital_twin_dashboard.models_v2 import (
    Dt2ChangeProposal, Dt2Project, Dt2ProjectChange, Dt2ProjectHistory,
    Dt2ProjectPerformance,
)
from flask_jwt_extended import create_access_token
from sqlalchemy import or_
from sqlalchemy.orm.attributes import flag_modified

MARK = '__dt3_demo__'
KNOX = f'{MARK}user'                     # 이 사람의 knoxId (= 이메일 @앞부분)
NAME = f'{MARK}데모사용자'                # 활성 사용자 중 유일한 이름

problems = []


# ─────────────────────────────────────────────────────────────────────────────
# 옛 규칙 (2026-08-11 이전) — 되살려서 실제로 돌린다
# ─────────────────────────────────────────────────────────────────────────────

def _old_is_project_member(actor, project):
    """이름 매칭을 인정하던 구현. 이름은 활성 사용자 중 유일할 때만 토큰이 된다."""
    local, name = P.actor_match_tokens(actor)
    if not local and not name:
        return False
    for el in (getattr(project, 'members_json', None) or []):
        if not isinstance(el, dict):
            continue
        if local and (el.get('knoxId') or '').strip().lower() == local:
            return True
        if name and (el.get('이름') or '').strip() == name:
            return True
    for el in (getattr(project, 'owners_json', None) or []):
        if isinstance(el, str):
            if name and el.strip() == name:
                return True
        elif isinstance(el, dict):
            if local and (el.get('knoxId') or '').strip().lower() == local:
                return True
            if name and (el.get('이름') or '').strip() == name:
                return True
    return False


def _old_can_view_project(actor, project):
    """당사자 예외가 **소유자뿐**이던 구현."""
    if actor is None or not actor.is_active:
        return False
    if actor.role in P.GLOBAL_EDIT_ROLES:
        return True
    if not getattr(project, 'is_division_public', False):
        return True
    if project.owner_user_id == actor.id:
        return True
    div = P.actor_division_id(actor)
    return div is not None and div == project.division_id


@contextmanager
def old_rules():
    """모듈 전역을 잠시 옛 구현으로 바꿔 끼운다. 반드시 되돌린다."""
    keep = (P.is_project_member, P.is_project_author, P.can_view_project)
    P.is_project_member = _old_is_project_member
    P.is_project_author = lambda actor, project: False      # 그때는 없던 경로
    P.can_view_project = _old_can_view_project
    try:
        yield
    finally:
        (P.is_project_member, P.is_project_author, P.can_view_project) = keep


# ─────────────────────────────────────────────────────────────────────────────

def auth(u):
    return {'Authorization': f'Bearer {create_access_token(identity=str(u.id))}',
            'X-DT2-Allow-Write': 'test'}


def yn(v):
    return '가능' if v else '불가'


def scenario(title, setup, expect_old, expect_new, kind='edit'):
    """한 상황을 세우고 옛/지금 규칙을 나란히 찍는다. `kind` 는 edit | view."""
    print()
    print(f'── {title} ' + '─' * max(0, 70 - len(title)))
    for line in setup():
        print(f'   {line}')
    return expect_old, expect_new, kind


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    app = create_app()
    with app.app_context():
        client = app.test_client()
        n_proj, n_user = Dt2Project.query.count(), User.query.count()

        # 사업부내공개(S4)에는 실재하는 division_id 가 필요하다.
        div = Division.query.first()
        div_id = div.id if div else None

        made_users = []
        puid = str(uuidlib.uuid4())

        print('=' * 74)
        print(' 2026-08-11 권한 변경 데모 — 옛 규칙 vs 지금 규칙')
        print('=' * 74)
        print(' 임시 사용자 1명과 임시 과제 1건을 만들어 네 상황을 세운다.')
        print(' 끝나면 전부 지우고 건수가 그대로인지 확인한다.')

        try:
            u = User(email=f'{KNOX}@t.local', name=NAME,
                     role=UserRole.USER, is_active=True)
            u.set_password('x' * 16)
            db.session.add(u)
            db.session.commit()
            made_users.append(u)

            db.session.add(Dt2Project(
                uuid=puid, code=f'{MARK}1', title=f'{MARK} 데모 과제',
                status='정상진행', progress=0, row_version=1, extra_fields={},
                owner_user_id=None, is_deleted=False, is_permanently_deleted=False))
            db.session.commit()

            print(f'\n 사용자 : {NAME}  (knoxId = {KNOX})')
            print(f' 과제   : {MARK} 데모 과제')

            def reset(**cols):
                """과제를 백지에서 다시 세운다 — 앞 상황이 새지 않게."""
                p = Dt2Project.query.filter_by(uuid=puid).first()
                p.owner_user_id = None
                p.pl_knox_id = None
                p.author_knox_id = None
                p.members_json = []
                p.owners_json = []
                p.is_division_public = False
                p.division_id = None
                for k, v in cols.items():
                    setattr(p, k, v)
                for k in ('members_json', 'owners_json'):
                    flag_modified(p, k)
                db.session.commit()
                return p

            def compare(title, note, p, kind='edit'):
                fn = (lambda: P.can_edit_project(u, p)) if kind == 'edit' \
                    else (lambda: P.can_view_project(u, p))
                with old_rules():
                    old = fn()
                new = fn()
                label = '편집' if kind == 'edit' else '조회'
                print()
                print(f'── {title} ' + '─' * max(0, 66 - len(title)))
                print(f'   세운 것  {note}')
                print(f'   옛 규칙  {label} {yn(old)}')
                print(f'   지금     {label} {yn(new)}   '
                      + ('← 달라졌다 ★' if old != new else '(그대로)'))
                return old, new

            # ── S1. 작성자만 있는 과제 ─────────────────────────────────────
            p = reset(author_knox_id=KNOX)
            old, new = compare(
                'S1  작성자만 있는 과제',
                '작성자=이 사람 · 소유자/PL/참여인력 전부 비움', p)
            if not (old is False and new is True):
                problems.append('S1 작성자 개방이 안 보인다')
            r = client.get(f'/api/dt-v2/projects/{puid}', headers=auth(u))
            can = r.get_json()['data'].get('canEdit')
            r2 = client.patch(f'/api/dt-v2/projects/{puid}',
                              json={'patch': {'description': '작성자가 고쳤다'}},
                              headers=auth(u))
            print(f'   화면     canEdit={can} · 저장 {r2.status_code} '
                  + ('(예전엔 403 이었다)' if r2.status_code == 200 else ''))
            if not (can is True and r2.status_code == 200):
                problems.append('S1 API 가 함수 판정과 다르다')

            # ── S2. 참여인력에 이름만 ──────────────────────────────────────
            p = reset(members_json=[{'knoxId': '', '이름': NAME}])
            old, new = compare(
                'S2  참여인력에 이름만 (knoxId 비움)',
                f'참여인력=[{{이름: {NAME}, knoxId: 없음}}]', p)
            if not (old is True and new is False):
                problems.append('S2 이름 매칭 폐지가 안 보인다')
            r = client.get(f'/api/dt-v2/projects/{puid}', headers=auth(u))
            r2 = client.patch(f'/api/dt-v2/projects/{puid}',
                              json={'patch': {'description': '이름으로 고쳐보기'}},
                              headers=auth(u))
            print(f"   화면     canEdit={r.get_json()['data'].get('canEdit')} · "
                  f'저장 {r2.status_code} '
                  + ('(예전엔 200 이었다)' if r2.status_code == 403 else ''))
            print('   ↑ 편집창 참여인력 배지가 「이름으로만」 → 「knoxId 필요」 로 바뀐 자리')
            if r2.status_code != 403:
                problems.append('S2 API 가 함수 판정과 다르다')

            # ── S3. 담당자(owners_json 이름 문자열) ────────────────────────
            p = reset(owners_json=[NAME])
            old, new = compare(
                'S3  담당자가 이름 문자열로만 적힌 과제',
                f'owners_json=["{NAME}"] — knoxId 를 담을 자리가 없다', p)
            if not (old is True and new is False):
                problems.append('S3 owners_json 문자열 경로가 안 보인다')
            print('   ↑ 운영에서 가장 많이 걸릴 자리다 (개발 DB 에만 문자열 원소 301개)')

            # ── S4. 사업부가 다른 참여인력 ─────────────────────────────────
            if div_id is None:
                print('\n── S4  건너뜀 — divisions 테이블이 비어 있다 ─────────')
            else:
                p = reset(is_division_public=True, division_id=div_id,
                          members_json=[{'knoxId': KNOX, '이름': NAME}])
                old, new = compare(
                    'S4  사업부내공개 과제의 타 사업부 참여인력',
                    '사업부내공개=켬 · 참여인력=이 사람(knoxId) · 사업부는 남의 것',
                    p, kind='view')
                if not (old is False and new is True):
                    problems.append('S4 조회 확장이 안 보인다')
                # 예전의 모순: 조회는 막혔는데 편집은 열려 있었다
                with old_rules():
                    old_edit = P.can_edit_project(u, p)
                print(f'   ★ 옛 규칙의 모순  조회 불가 인데 편집 {yn(old_edit)} '
                      '— 목록엔 없는데 저장은 되던 상태')
                r = client.get('/api/dt-v2/projects?limit=1000', headers=auth(u))
                listed = {i['uuid'] for i in r.get_json()['data']['items']}
                print(f'   화면     과제 목록에 보임={puid in listed} '
                      '(예전엔 안 보였다)')
                if puid not in listed:
                    problems.append('S4 목록에 안 보인다')

        finally:
            print('\n── 정리 ──')
            ids = [x.id for x in made_users]
            Dt2ProjectPerformance.query.filter_by(project_uuid=puid).delete()
            Dt2ChangeProposal.query.filter_by(project_uuid=puid).delete()
            Dt2ProjectChange.query.filter_by(project_uuid=puid).delete()
            Dt2ProjectHistory.query.filter_by(project_uuid=puid).delete()
            Dt2Project.query.filter_by(uuid=puid).delete()
            db.session.commit()
            if ids:
                Dt2ProjectChange.query.filter(
                    or_(Dt2ProjectChange.actor_user_id.in_(ids),
                        Dt2ProjectChange.on_behalf_of.in_(ids))).delete(
                    synchronize_session=False)
                db.session.commit()
                User.query.filter(User.id.in_(ids)).delete(synchronize_session=False)
                db.session.commit()
            same_p, same_u = Dt2Project.query.count(), User.query.count()
            print(f'   과제 {n_proj} → {same_p} · 사용자 {n_user} → {same_u}')
            if same_p != n_proj or same_u != n_user:
                problems.append('정리 후 건수가 다르다')
            # 바꿔 끼운 규칙이 남아 있지 않은지 마지막으로 확인한다
            if P.is_project_member is _old_is_project_member:
                problems.append('★ 옛 규칙이 복원되지 않았다')

        print()
        print('=' * 74)
        if problems:
            print(' [FAIL] ' + ' / '.join(problems))
        else:
            print(' [OK] 네 상황 모두 옛 규칙과 지금 규칙이 예상대로 갈렸다')
        print('=' * 74)
        return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
