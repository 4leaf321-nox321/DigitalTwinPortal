"""액션아이템 정체성(`uuid`) 부여.

무엇을 못 박나
    액션아이템의 `id` 는 정체성이 아니라 **순번**이다 — 화면이 저장할 때마다 위치
    순서로 다시 매긴다. 그래서 3개 중 첫 번째를 지우면 활동 로그가 **엉뚱한 항목이
    삭제됐다고 기록한다.** 그것을 고치려고 `uuid` 를 더했다.

    운영에는 액션아이템에 붙은 활동 이력이 있다. 그래서 **이관 중 안전**이 이 시험의
    절반이다:

    ① 이미 붙은 uuid 는 **절대 안 바뀐다** (몇 번을 저장하든)
    ② uuid 없이 들어온 저장은 기존 값을 **물려받는다** — 새로 만들지 않는다
       (백필 전이거나 편집창을 열어 둔 옛 화면이 저장하는 경우)
    ③ 옛 화면이 **첫 항목을 지우고** 저장해도 나머지 uuid 가 어긋나지 않는다
    ④ 한 uuid 가 두 항목에 붙지 않는다
    ⑤ `id` 는 그대로 둔다 — 지우면 화면이 깨진다
    ⑥ 진척 이력(`dt2_project_history`)에 **가짜 행이 안 생긴다**
       (해시가 개수만 보므로 uuid 를 더해도 값이 안 바뀌어야 한다)

실행: python scripts\\dt3_test_action_uuids.py
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask_jwt_extended import create_access_token                 # noqa: E402

from app import create_app                                         # noqa: E402
from app.extensions import db                                      # noqa: E402
from app.modules.auth.models import User, UserRole                 # noqa: E402
from app.modules.digital_twin_dashboard import routes_v2 as R      # noqa: E402
from app.modules.digital_twin_dashboard.models_v2 import (         # noqa: E402
    Dt2Project, Dt2ProjectChange, Dt2ProjectHistory,
)

fails = []


def check(desc, ok, extra=''):
    print(f"  {'[OK]  ' if ok else '[FAIL]'} {desc}" + (f'   {extra}' if not ok and extra else ''))
    if not ok:
        fails.append(desc)


def uuids(items):
    return [str((i or {}).get('uuid') or '') for i in (items or [])]


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    app = create_app()
    with app.app_context():
        # ── 1. 순수 함수 — 여기가 규칙의 단일 출처다 ──────────────────────
        print('── uuid 부여 규칙 ──')
        A = {'제목': '가', '완료여부': False}
        B = {'제목': '나', '완료여부': False}
        C = {'제목': '다', '완료여부': False}

        first = R._assign_action_uuids([dict(A), dict(B), dict(C)])
        u = uuids(first)
        check('없으면 만들어 준다', all(u) and len(set(u)) == 3, str(u))
        check('id 를 만들어내지 않는다', all('id' not in i for i in first))

        again = R._assign_action_uuids(first, first)
        check('★ 이미 있으면 안 바꾼다 (몇 번을 저장하든)', uuids(again) == u, str(uuids(again)))

        # ② 옛 화면 — uuid 없이 그대로 보낸다
        old_client = [dict(A), dict(B), dict(C)]
        carried = R._assign_action_uuids(old_client, first)
        check('★ uuid 없이 와도 기존 값을 물려받는다 (새로 안 만든다)',
              uuids(carried) == u, str(uuids(carried)))

        # ③ 옛 화면이 **첫 항목을 지우고** 보낸다 — 자리가 전부 밀린다.
        #    자리(index)부터 보면 uuid 가 한 칸씩 어긋난다. 제목을 먼저 보는 이유다.
        removed_first = R._assign_action_uuids([dict(B), dict(C)], first)
        check('★ 첫 항목을 지워도 나머지 uuid 가 안 밀린다',
              uuids(removed_first) == [u[1], u[2]], f'{uuids(removed_first)} vs {[u[1], u[2]]}')

        # 가운데를 지우는 경우도 같다
        removed_mid = R._assign_action_uuids([dict(A), dict(C)], first)
        check('가운데를 지워도 안 밀린다',
              uuids(removed_mid) == [u[0], u[2]], str(uuids(removed_mid)))

        # 제목을 바꾼 경우 — 제목으로 못 찾으니 자리로 물려받는다
        renamed = R._assign_action_uuids(
            [{'제목': '가(수정)'}, dict(B), dict(C)], first)
        check('제목이 바뀌면 자리로 물려받는다', uuids(renamed) == u, str(uuids(renamed)))

        # 새 항목이 섞여 오면 그것만 새로 만든다
        added = R._assign_action_uuids(
            [dict(A), dict(B), dict(C), {'제목': '라'}], first)
        ua = uuids(added)
        check('새 항목만 새 uuid 를 받는다',
              ua[:3] == u and ua[3] not in u, str(ua))

        # ④ 같은 uuid 가 둘에 붙어 오면 뒤엣것을 새로 만든다
        dup = R._assign_action_uuids(
            [{'제목': '가', 'uuid': u[0]}, {'제목': '나', 'uuid': u[0]}], first)
        ud = uuids(dup)
        check('★ 한 uuid 가 두 항목에 붙지 않는다',
              ud[0] == u[0] and ud[1] != u[0] and ud[1], str(ud))

        # 제목이 같은 항목이 둘이어도 각자 다른 uuid 를 받는다
        same_title_prev = R._assign_action_uuids([{'제목': '중복'}, {'제목': '중복'}])
        st = uuids(same_title_prev)
        check('제목이 같아도 서로 다른 uuid', st[0] != st[1] and all(st), str(st))
        st2 = uuids(R._assign_action_uuids(
            [{'제목': '중복'}, {'제목': '중복'}], same_title_prev))
        check('제목이 같아도 물려받기가 어긋나지 않는다', st2 == st, str(st2))

        # 이상한 원소는 건드리지 않는다
        odd = R._assign_action_uuids(['문자열', None, dict(A)], None)
        check('dict 가 아닌 원소는 그대로 둔다',
              odd[0] == '문자열' and odd[1] is None and odd[2].get('uuid'))
        check('배열이 아니면 빈 배열', R._assign_action_uuids('x') == [])

        # ⑤ normalize 를 지나도 파생 규칙이 그대로 작동한다
        print('\n── 기존 파생 규칙이 그대로인가 ──')
        with_subs = [{'제목': '가', '완료여부': False, '완료일': '',
                      '세부항목목록': [{'내용': 'x', '완료여부': True, '완료일': '2026-03-02'},
                                  {'내용': 'y', '완료여부': True, '완료일': '2026-03-05'}]}]
        norm = R.normalize_action_items(with_subs)
        check('세부항목이 다 끝나면 상위도 완료', norm[0]['완료여부'] is True)
        check('완료일은 마지막 세부항목 날짜', norm[0]['완료일'] == '2026-03-05',
              str(norm[0].get('완료일')))
        check('★ uuid 도 함께 붙는다', bool(norm[0].get('uuid')))
        check('★ 같은 입력을 다시 넣어도 uuid 가 그대로',
              uuids(R.normalize_action_items(norm, norm)) == uuids(norm))

        # ── 2. 실제 저장 왕복 ────────────────────────────────────────────
        print('\n── 저장 왕복 ──')
        admin = User.query.filter_by(role=UserRole.ADMIN).first()
        if admin is None:
            check('admin 계정이 있다', False)
            return 1
        hdr = {'Authorization': f'Bearer {create_access_token(identity=str(admin.id))}',
               'X-DT2-Allow-Write': 'test'}

        p = (Dt2Project.query
             .filter(Dt2Project.is_deleted.is_(False),
                     Dt2Project.is_permanently_deleted.is_(False))
             .order_by(Dt2Project.id.asc()).first())
        if p is None:
            check('시험할 과제가 있다', False)
            return 1

        keep_items = p.action_items_json
        keep_status = p.status
        keep_progress = p.progress
        hist_before = Dt2ProjectHistory.query.filter_by(project_uuid=p.uuid).count()
        print(f"     [정보] 시험 대상 {p.code or p.uuid[:8]}")

        with app.test_client() as c:
            url = f'/api/dt-v2/projects/{p.uuid}'
            try:
                # 옛 화면이 보내는 모양 그대로 — uuid 없이, id 는 1..N
                pid = p.code or 'X'
                old_shape = [
                    {'id': f'action_{pid}_1', '제목': '가', '완료여부': False,
                     '목표일': '', '완료일': '', '세부항목목록': []},
                    {'id': f'action_{pid}_2', '제목': '나', '완료여부': False,
                     '목표일': '', '완료일': '', '세부항목목록': []},
                    {'id': f'action_{pid}_3', '제목': '다', '완료여부': False,
                     '목표일': '', '완료일': '', '세부항목목록': []},
                ]
                r = c.patch(url, headers=hdr, json={
                    'patch': {'액션아이템목록': old_shape, '진행상태': '정상진행'}})
                check('옛 모양 저장 200', r.status_code == 200,
                      f'실제 {r.status_code} {r.get_json()}')

                db.session.expire_all()
                saved = Dt2Project.query.filter_by(uuid=p.uuid).first().action_items_json
                v1 = uuids(saved)
                check('★ 서버가 uuid 를 채워 준다 (화면이 안 보내도)',
                      all(v1) and len(set(v1)) == 3, str(v1))
                check('★ id 는 그대로 둔다 (화면 React key)',
                      [i.get('id') for i in saved] == [i['id'] for i in old_shape])

                # 같은 것을 다시 — uuid 없이 (옛 화면이 계속 그렇게 보낸다)
                r = c.patch(url, headers=hdr, json={'patch': {'액션아이템목록': old_shape}})
                check('재저장 200', r.status_code == 200, f'실제 {r.status_code}')
                db.session.expire_all()
                v2 = uuids(Dt2Project.query.filter_by(uuid=p.uuid).first().action_items_json)
                check('★ 옛 화면이 계속 저장해도 uuid 가 안 바뀐다', v2 == v1,
                      f'{v2} vs {v1}')

                # 옛 화면이 **첫 항목을 지우고** 보낸다 — id 는 1,2 로 당겨진다
                shifted = [
                    {'id': f'action_{pid}_1', '제목': '나', '완료여부': False,
                     '목표일': '', '완료일': '', '세부항목목록': []},
                    {'id': f'action_{pid}_2', '제목': '다', '완료여부': False,
                     '목표일': '', '완료일': '', '세부항목목록': []},
                ]
                r = c.patch(url, headers=hdr, json={'patch': {'액션아이템목록': shifted}})
                check('첫 항목 삭제 저장 200', r.status_code == 200, f'실제 {r.status_code}')
                db.session.expire_all()
                v3 = uuids(Dt2Project.query.filter_by(uuid=p.uuid).first().action_items_json)
                check('★ 첫 항목을 지워도 남은 uuid 가 안 밀린다 (활동로그가 맞아진다)',
                      v3 == [v1[1], v1[2]], f'{v3} vs {[v1[1], v1[2]]}')

                # ⑥ 진척 이력 — uuid 를 더했다고 가짜 행이 생기면 안 된다.
                #    해시는 개수(action_total·action_done)만 보므로 안 생겨야 한다.
                same_count = [dict(i) for i in shifted]
                before_h = Dt2ProjectHistory.query.filter_by(project_uuid=p.uuid).count()
                r = c.patch(url, headers=hdr, json={'patch': {'액션아이템목록': same_count}})
                after_h = Dt2ProjectHistory.query.filter_by(project_uuid=p.uuid).count()
                check('★ 개수가 같으면 진척 이력이 안 늘어난다', after_h == before_h,
                      f'{before_h} → {after_h}')

                # 화면이 uuid 를 실어 보내는 경우(새 프론트) — 그대로 존중
                mine = [dict(i, uuid=v3[k]) for k, i in enumerate(shifted)]
                r = c.patch(url, headers=hdr, json={'patch': {'액션아이템목록': mine}})
                db.session.expire_all()
                v4 = uuids(Dt2Project.query.filter_by(uuid=p.uuid).first().action_items_json)
                check('★ 화면이 보낸 uuid 를 존중한다', v4 == v3, f'{v4} vs {v3}')

                # ★ 백필 뒤의 평범한 저장이 **까닭 없는 변경 이력**을 만들면 안 된다.
                #   uuid 를 더한 것 때문에 "액션아이템목록이 바뀌었다" 가 뜨면,
                #   사용자는 자기가 안 바꾼 것이 이력에 남는 것을 보게 된다.
                #   두 경우를 다 본다 — 새 화면(uuid 실어 보냄)과 옛 화면(안 보냄).
                def dep_changes():
                    return Dt2ProjectChange.query.filter_by(
                        project_uuid=p.uuid, field='action_items_json').count()

                base_n = dep_changes()
                c.patch(url, headers=hdr, json={'patch': {'액션아이템목록': mine}})
                check('★ 같은 값 재전송(uuid 포함)은 이력을 안 남긴다',
                      dep_changes() == base_n, f'{base_n} → {dep_changes()}')

                stripped = [{k: v for k, v in i.items() if k != 'uuid'} for i in mine]
                c.patch(url, headers=hdr, json={'patch': {'액션아이템목록': stripped}})
                check('★ 옛 화면이 uuid 없이 보내도 이력을 안 남긴다 (물려받아 같은 값)',
                      dep_changes() == base_n, f'{base_n} → {dep_changes()}')
            finally:
                # 원상복구 — 값·상태·진행률을 되돌린다.
                row = Dt2Project.query.filter_by(uuid=p.uuid).first()
                row.action_items_json = keep_items
                row.status = keep_status
                row.progress = keep_progress
                db.session.commit()
                back = Dt2Project.query.filter_by(uuid=p.uuid).first()
                check('정리: 액션아이템 원복', back.action_items_json == keep_items)
                check('정리: 진행상태 원복', back.status == keep_status)
                hist_after = Dt2ProjectHistory.query.filter_by(project_uuid=p.uuid).count()
                print(f'     [정보] 진척 이력 {hist_before} → {hist_after}행 '
                      f'(상태·진행률을 바꿨으므로 늘어나는 것이 정상)')

    print()
    if fails:
        print(f'[FAIL] {len(fails)}건 실패')
        for f in fails:
            print(f'   - {f}')
        return 1
    print('[OK] 전부 통과')
    return 0


if __name__ == '__main__':
    sys.exit(main())
