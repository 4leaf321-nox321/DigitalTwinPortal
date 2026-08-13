"""
권한 함수 단위 시험 (Phase 3-1) — DB 를 쓰지 않는다.

왜 가짜 객체로 시험하나
    권한은 "허용해야 할 때 허용" 보다 **"거부해야 할 때 거부"** 가 중요하다.
    후자는 실제 데이터에 그런 조합이 없으면 시험되지 않는다.
    (운영 데이터에는 소유자 없는 활성 과제가 1건뿐이다 — 그것만으로는 부족하다)
    그래서 조합을 직접 만들어 넣는다.

    actor_division_id 만 DB 를 타므로 그 부분은 단조 함수로 갈아끼운다.

사용법
    python scripts\\dt3_test_permissions.py
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.modules.digital_twin_dashboard import permissions as P
from app.modules.auth.models import UserRole


class FakeUser:
    def __init__(self, uid, role, department=None, is_active=True,
                 email=None, name=None):
        self.id = uid
        self.role = role
        self.department = department
        self.is_active = is_active
        self.email = email or f'user{uid}@test.local'
        self.name = name or f'사용자{uid}'


class FakeProject:
    def __init__(self, owner_user_id=None, division_id=None,
                 is_permanently_deleted=False, is_division_public=False,
                 members_json=None, owners_json=None,
                 pl_knox_id=None, author_knox_id=None, author_name=None):
        self.owner_user_id = owner_user_id
        self.division_id = division_id
        self.is_permanently_deleted = is_permanently_deleted
        self.is_division_public = is_division_public
        self.members_json = members_json or []
        self.owners_json = owners_json or []
        # 권한을 주는 사람 필드 — 전부 knoxId 기준이다 (2026-08-11)
        self.pl_knox_id = pl_knox_id
        self.author_knox_id = author_knox_id
        self.author_name = author_name          # 표시용. 권한을 주지 않는다


# actor_division_id 를 DB 없이 결정론적으로 대체한다.
#   'DX1' → 1,  'DX2' → 2,  그 외/빈값 → None (해석 실패)
_FAKE_DIV = {'dx1': 1, 'dx2': 2}
P.actor_division_id = lambda actor: (
    _FAKE_DIV.get((actor.department or '').strip().lower()) if actor else None
)

# actor_match_tokens 는 이름 유일성 확인에 DB 를 탄다. 단위 시험에서는 대체한다.
# '동명이인' 이라는 이름을 가진 사람은 이름 토큰이 없는 것으로 본다(= 매칭 불가).
def _fake_tokens(actor):
    if actor is None:
        return None, None
    email = getattr(actor, 'email', '') or ''
    local = email.split('@')[0].strip().lower() if '@' in email else None
    name = (getattr(actor, 'name', '') or '').strip()
    if name == '동명이인':
        name = None
    return local or None, name or None


P.actor_match_tokens = _fake_tokens

ADMIN = FakeUser(1, UserRole.ADMIN, 'DX1')
DTOFF = FakeUser(9, UserRole.DT_OFFICE_MEMBER, 'DX1')
DTOFF_X = FakeUser(10, UserRole.DT_OFFICE_MEMBER, '없는부서')   # 부서 해석 실패
DTOFF_OFF = FakeUser(11, UserRole.DT_OFFICE_MEMBER, 'DX1', is_active=False)
MGR1 = FakeUser(2, UserRole.MANAGER, 'DX1')
MGR2 = FakeUser(3, UserRole.MANAGER, 'DX2')
MGR_X = FakeUser(4, UserRole.MANAGER, '없는부서')      # 해석 실패
MGR_NULL = FakeUser(5, UserRole.MANAGER, None)          # 부서 비어 있음
USER1 = FakeUser(6, UserRole.USER, 'DX1')
VIEWER = FakeUser(7, UserRole.VIEWER, 'DX1')
INACTIVE = FakeUser(8, UserRole.ADMIN, 'DX1', is_active=False)
MEMBER = FakeUser(12, UserRole.USER, 'DX1', email='memberx@t.local', name='참여자하나')
MEMBER2 = FakeUser(13, UserRole.USER, 'DX2', email='member2@t.local', name='참여자둘')
DUP = FakeUser(14, UserRole.USER, 'DX1', email='dupuser@t.local', name='동명이인')
VIEWER_MEM = FakeUser(15, UserRole.VIEWER, 'DX1', email='viewmem@t.local', name='뷰어참여')

CASES = [
    # (설명, actor, project, 기대)
    ("admin 은 남의 과제도 허용",           ADMIN, FakeProject(owner_user_id=99, division_id=2), True),
    ("admin 은 소유자·사업부 없어도 허용",   ADMIN, FakeProject(), True),
    ("소유자 본인 허용",                     USER1, FakeProject(owner_user_id=6, division_id=2), True),
    ("소유자 아닌 일반 사용자 거부",         USER1, FakeProject(owner_user_id=99, division_id=1), False),
    ("viewer 는 자기 사업부라도 거부",       VIEWER, FakeProject(owner_user_id=99, division_id=1), False),
    ("manager 는 같은 사업부 허용",          MGR1, FakeProject(owner_user_id=99, division_id=1), True),
    ("manager 는 다른 사업부 거부",          MGR1, FakeProject(owner_user_id=99, division_id=2), False),
    ("manager 도 소유자면 허용",             MGR2, FakeProject(owner_user_id=3, division_id=1), True),

    # ↓ 여기부터가 진짜 시험. 판단 근거가 없을 때 열리면 안 된다.
    ("부서 해석 실패한 manager 는 거부",     MGR_X, FakeProject(owner_user_id=99, division_id=1), False),
    ("부서 빈 manager 는 거부",              MGR_NULL, FakeProject(owner_user_id=99, division_id=1), False),
    ("★ 사업부 미상 manager + 사업부 미상 과제 → 거부 (None==None 금지)",
     MGR_X, FakeProject(owner_user_id=99, division_id=None), False),
    ("★ 사업부 있는 manager + 사업부 미상 과제 → 거부",
     MGR1, FakeProject(owner_user_id=99, division_id=None), False),
    ("★ 소유자 미지정 과제를 남이 허용받지 않음",
     USER1, FakeProject(owner_user_id=None, division_id=1), False),
    ("★ owner_user_id None 인데 actor.id 도 None 이면 거부",
     FakeUser(None, UserRole.USER, 'DX1'), FakeProject(owner_user_id=None), False),
    # 참여인력 — 2026-07-29 결정: 소유자가 아니어도 참여인력이면 편집 가능
    ("참여인력(knoxId) 허용", MEMBER,
     FakeProject(owner_user_id=99, members_json=[{'knoxId': 'memberx', '이름': 'x'}]), True),
    ("참여인력(대소문자 달라도) 허용", MEMBER,
     FakeProject(owner_user_id=99, members_json=[{'knoxId': ' MemberX ', '이름': 'x'}]), True),
    # ⚠️ **2026-08-11 이름 매칭을 버렸다.** 아래 둘은 그전에 True 였다 —
    #    이름이 유일하면 열렸다. 지금은 knoxId 로만 연다.
    ("★ 참여인력이어도 이름만으로는 거부", MEMBER2,
     FakeProject(owner_user_id=99, members_json=[{'knoxId': '', '이름': '참여자둘'}]), False),
    ("★ 담당자(owners_json 이름 문자열)도 거부", MEMBER2,
     FakeProject(owner_user_id=99, owners_json=['참여자둘']), False),
    # 같은 배열이라도 knoxId 가 실린 객체 원소는 연다
    ("담당자(owners_json 객체 + knoxId) 허용", MEMBER,
     FakeProject(owner_user_id=99, owners_json=[{'knoxId': 'memberx', '이름': 'x'}]), True),
    # 작성자 — 2026-08-11 추가. knoxId 로만 본다
    ("작성자(author_knox_id) 허용", MEMBER,
     FakeProject(owner_user_id=99, author_knox_id='MemberX'), True),
    ("★ 작성자 이름(author_name)만으로는 거부", MEMBER2,
     FakeProject(owner_user_id=99, author_name='참여자둘'), False),
    ("★ 빈 knoxId 는 아무나 매칭시키지 않음", USER1,
     FakeProject(owner_user_id=99, members_json=[{'knoxId': '', '이름': '남'}]), False),
    ("★ 동명이인은 이름으로 매칭 안 됨", DUP,
     FakeProject(owner_user_id=99, members_json=[{'knoxId': '', '이름': '동명이인'}]), False),
    ("★ 참여인력이어도 viewer 는 거부", VIEWER_MEM,
     FakeProject(owner_user_id=99, members_json=[{'knoxId': 'viewmem', '이름': 'v'}]), False),
    ("참여인력 목록이 비어 있으면 거부", MEMBER,
     FakeProject(owner_user_id=99, members_json=[]), False),
    ("members_json 이 None 이어도 안 터짐", MEMBER,
     FakeProject(owner_user_id=99, members_json=None), False),

    # dt_office — 2026-07-29 결정: 전 과제 편집 (admin 과 동일 범위)
    ("dt_office 는 남의 사업부도 허용",      DTOFF, FakeProject(owner_user_id=99, division_id=2), True),
    ("dt_office 는 소유자·사업부 없어도 허용", DTOFF, FakeProject(), True),
    ("dt_office 는 부서 해석 실패해도 허용",  DTOFF_X, FakeProject(owner_user_id=99, division_id=1), True),
    ("★ 비활성 dt_office 는 거부",           DTOFF_OFF, FakeProject(owner_user_id=99, division_id=1), False),
    ("★ 영구삭제 과제는 dt_office 도 거부",   DTOFF, FakeProject(owner_user_id=9, is_permanently_deleted=True), False),

    ("영구삭제 과제는 admin 도 거부",        ADMIN, FakeProject(owner_user_id=1, is_permanently_deleted=True), False),
    ("비활성 사용자는 admin 이어도 거부",    INACTIVE, FakeProject(owner_user_id=8), False),
    ("actor 없음 거부",                      None, FakeProject(owner_user_id=1), False),
    ("project 없음 거부",                    ADMIN, None, False),
]

PATCH_CASES = [
    ("저위험만",            {'progress': 50}, ['progress'], [], []),
    ("핵심만",              {'title': 'x'}, [], ['title'], []),
    ("섞임",                {'progress': 50, 'status': '완료'}, ['progress'], ['status'], []),
    ("★ 모르는 필드는 거부", {'progress': 50, 'made_up_field': 1}, ['progress'], [], ['made_up_field']),
    ("★ 불변 필드는 거부",   {'uuid': 'x'}, [], [], ['uuid']),
    ("★ row_version 거부",   {'row_version': 99}, [], [], ['row_version']),
    ("★ extra_fields 거부",  {'extra_fields': {}}, [], [], ['extra_fields']),
    ("빈 패치",             {}, [], [], []),
    ("None 패치",           None, [], [], []),
]


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    print("=" * 72)
    print(" 권한 함수 시험 (Phase 3-1)")
    print("=" * 72)

    failed = 0

    print("\n── can_edit_project ──")
    for desc, actor, project, expect in CASES:
        got = P.can_edit_project(actor, project)
        ok = (got == expect)
        if not ok:
            failed += 1
        print(f"  {'[OK]  ' if ok else '[FAIL]'} {desc}"
              + ('' if ok else f"   기대={expect} 실제={got}"))

    print("\n── classify_patch ──")
    for desc, patch, exp_low, exp_core, exp_rej in PATCH_CASES:
        c = P.classify_patch(patch)
        ok = (sorted(c.low_risk) == sorted(exp_low)
              and sorted(c.core) == sorted(exp_core)
              and sorted(c.rejected) == sorted(exp_rej))
        if not ok:
            failed += 1
        print(f"  {'[OK]  ' if ok else '[FAIL]'} {desc}"
              + ('' if ok else f"   실제={c}"))

    print("\n── 분류표 자체 점검 ──")
    overlap = P.LOW_RISK_FIELDS & P.CORE_FIELDS
    dup_imm = (P.LOW_RISK_FIELDS | P.CORE_FIELDS) & P.IMMUTABLE_FIELDS
    for label, s in (("저위험 ∩ 핵심", overlap), ("분류 ∩ 불변", dup_imm)):
        ok = not s
        if not ok:
            failed += 1
        print(f"  {'[OK]  ' if ok else '[FAIL]'} {label} 겹침 없음"
              + ('' if ok else f"   겹침={sorted(s)}"))

    print("\n" + "=" * 72)
    if failed:
        print(f" 결과: [FAIL] {failed}건 실패")
        print("=" * 72)
        sys.exit(1)
    total = len(CASES) + len(PATCH_CASES) + 2
    print(f" 결과: [OK] {total}건 전부 통과")
    print("=" * 72)


if __name__ == '__main__':
    main()
