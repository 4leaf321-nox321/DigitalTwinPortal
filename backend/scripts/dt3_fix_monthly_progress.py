"""
월간진척현황 재생성 — 튜플이 문자열로 새어 나간 것을 바로잡는다. (2026-08-02)

무엇이 잘못됐나
    `res` 원소가 (제목, [하위줄]) 튜플일 때 f-string 에 그대로 넣어
    `- ('데이터 수집 체계 구축', ['설비 30대 연결'])` 처럼 찍혔다.

`월간진척현황`은 저위험 필드라 확인 대기 없이 즉시 반영된다.
값이 실제로 달라진 과제만 고친다.

실행:  venv/Scripts/python.exe scripts/dt3_fix_monthly_progress.py [--dry-run]
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask_jwt_extended import create_access_token                    # noqa: E402

from app import create_app                                            # noqa: E402
from app.modules.auth.models import User                              # noqa: E402
from app.modules.digital_twin_dashboard.models_v2 import Dt2Project   # noqa: E402

from dt3_seed_2026_data import SPECS                                  # noqa: E402
from dt3_seed_2026_projects import build                              # noqa: E402

DRY = '--dry-run' in sys.argv


def main():
    app = create_app()
    with app.app_context():
        admin = User.query.filter_by(email='yjtwin.park@samsung.com').first()
        token = create_access_token(identity=str(admin.id))
        H = {'Authorization': f'Bearer {token}'}
        c = app.test_client()

        need, ok, fail = [], 0, []
        for idx, spec in enumerate(SPECS):
            p = Dt2Project.query.filter_by(code=spec['code']).first()
            if p is None:
                continue
            fresh = build(idx, spec)['월간진척현황']
            if (p.monthly_progress_json or {}) != fresh:
                need.append((p.uuid, spec['code'], fresh, p.row_version))

        # 튜플이 실제로 새어 나간 건수 — 결함 규모를 남긴다
        leaked = sum(
            1 for p in Dt2Project.query.filter(
                Dt2Project.code.in_([s['code'] for s in SPECS])).all()
            if any("', ['" in str(v) for v in (p.monthly_progress_json or {}).values()))
        print(f'재생성 대상 {len(need)}건 / 전체 {len(SPECS)}건 '
              f'(이 중 튜플 노출 {leaked}건)')
        if DRY:
            for _u, code, fresh, _v in need[:3]:
                print(f'  {code} 7월 -> {fresh.get(str(max(int(k) for k in fresh)), "")[:70]}')
            print('--dry-run 이라 고치지 않는다')
            return 0

        for uuid, code, fresh, ver in need:
            r = c.patch(f'/api/dt-v2/projects/{uuid}', headers=H, json={
                'patch': {'월간진척현황': fresh},
                'actor_mode': 'ai', 'ignore_unknown': True,
                'expected_version': ver,
                'reason': '월간진척현황 재생성 - 성과 항목 튜플이 문자열로 새어 나간 것 수정',
            })
            j = r.get_json() or {}
            d = j.get('data', j)
            if r.status_code == 200 and 'monthly_progress_json' in (d.get('applied') or []):
                ok += 1
            else:
                fail.append((code, r.status_code, j.get('message')))

    print(f'수정 {ok}건 / 실패 {len(fail)}건')
    for code, st, msg in fail:
        print(f'  {code}: {st} {msg}')
    return 1 if fail else 0


if __name__ == '__main__':
    sys.exit(main())
