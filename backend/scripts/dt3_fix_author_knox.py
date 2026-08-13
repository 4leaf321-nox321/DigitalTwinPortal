"""
작성자 knoxId 채우기 — 이름만 들어가 '연결 안 됨' 으로 뜨는 과제를 고친다. (2026-08-03)

무엇이 잘못됐나
    2026 과제 100건이 `작성자` 이름만 있고 `작성자_knoxId` 가 비어 있었다.
    화면은 knoxId 가 없으면 작성자를 **'연결 안 됨'** 으로 표시한다
    (ResponsibleInfoSection `OwnerLinkBadge`).
    `과제PL`·`참여인력` 은 knoxId 가 없으면 400 인데 **작성자는 그 검사 대상이
    아니라** 조용히 통과했다.

`작성자_knoxId` 는 저위험 필드라 확인 대기 없이 즉시 반영된다.

이름이 활성 사용자 중 **유일할 때만** 채운다(`build_member_index` 규칙).
동명이인이면 손대지 않고 목록에 남긴다 — 표시 전용이라 권한은 안 열리지만
엉뚱한 계정을 붙일 이유는 없다.

MCP `patch_project` 와 같은 경로로 보낸다 (actor_mode='ai').

실행:  venv/Scripts/python.exe scripts/dt3_fix_author_knox.py [--dry-run]
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask_jwt_extended import create_access_token                    # noqa: E402

from app import create_app                                            # noqa: E402
from app.modules.auth.models import User                              # noqa: E402
from app.modules.digital_twin_dashboard import permissions as P       # noqa: E402
from app.modules.digital_twin_dashboard.models_v2 import Dt2Project    # noqa: E402

DRY = '--dry-run' in sys.argv


def main():
    app = create_app()
    with app.app_context():
        admin = User.query.filter_by(email='yjtwin.park@samsung.com').first()
        H = {'Authorization': f'Bearer {create_access_token(identity=str(admin.id))}'}
        c = app.test_client()

        _by_local, by_name = P.build_member_index()

        targets, unresolved = [], []
        for p in Dt2Project.query.filter(
                Dt2Project.is_deleted.is_(False)).order_by(Dt2Project.code).all():
            name = (p.author_name or '').strip()
            if not name or p.author_knox_id:
                continue
            u = by_name.get(name)
            if u is None or not u.email or '@' not in u.email:
                unresolved.append((p.code, name))
                continue
            targets.append((p.uuid, p.code, name,
                            u.email.split('@')[0].strip(), p.row_version))

        print(f'작성자 knoxId 가 빈 과제: {len(targets) + len(unresolved)}건')
        print(f'  이름으로 계정 특정 가능 : {len(targets)}건')
        print(f'  특정 불가(동명이인·미가입): {len(unresolved)}건')
        for code, name in unresolved[:10]:
            print(f'      {code} — {name!r}')
        if targets[:3]:
            print('  예시:')
            for _u, code, name, knox, _v in targets[:3]:
                print(f'      {code}: {name} → {knox}')
        if DRY:
            print('--dry-run 이라 고치지 않는다')
            return 0

        ok, fail = 0, []
        for uuid, code, name, knox, ver in targets:
            r = c.patch(f'/api/dt-v2/projects/{uuid}', headers=H, json={
                'patch': {'작성자_knoxId': knox},
                'actor_mode': 'ai', 'ignore_unknown': True,
                'expected_version': ver,
                'reason': "작성자 knoxId 누락 보정 — 화면에서 '연결 안 됨' 으로 표시됨",
            })
            j = r.get_json() or {}
            d = j.get('data', j)
            if r.status_code == 200 and 'author_knox_id' in (d.get('applied') or []):
                ok += 1
            else:
                fail.append((code, r.status_code, j.get('message')))

        print()
        print(f'수정 {ok}건 / 실패 {len(fail)}건')
        for code, st, msg in fail:
            print(f'  {code}: {st} {msg}')

        # 되읽어 확인
        left = Dt2Project.query.filter(
            Dt2Project.is_deleted.is_(False),
            Dt2Project.author_name.isnot(None),
            Dt2Project.author_knox_id.is_(None)).count()
        print(f'남은 미연결 작성자: {left}건'
              + (' (동명이인·미가입이라 손대지 않음)' if left else ''))
    return 1 if fail else 0


if __name__ == '__main__':
    sys.exit(main())
