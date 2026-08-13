"""
V1 저장 → V2 자동 동기화 시험 (실행계획 7.5-3) — 개발 DB 전용.

지켜야 할 두 가지를 본다.
    ① 저장하면 dt2 가 따라 온다 (읽기를 V2 로 넘길 수 있는 근거)
    ② **동기화가 실패해도 저장은 성공한다** — 이쪽이 더 중요하다.
       V1 이 정본이므로 dt2 는 배치로 복구되지만, 저장 실패는 사용자 손실이다.

원본 dashboard_data 를 건드리므로 개발에서만 돌린다.
과제 하나의 진행률을 바꿨다가 정확히 되돌린다.

사용법
    python scripts\\dt3_test_sync.py
"""

from __future__ import annotations

import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.extensions import db
from app.modules.auth.models import User, UserRole
from app.modules.digital_twin_dashboard import v2_sync
from app.modules.digital_twin_dashboard.models import DashboardData
from app.modules.digital_twin_dashboard.models_v2 import Dt2Project
from flask_jwt_extended import create_access_token

results = []


def check(desc, cond, extra=''):
    results.append((desc, bool(cond)))
    print(f"  {'[OK]  ' if cond else '[FAIL]'} {desc}" + (f"   {extra}" if not cond and extra else ''))


def wait_sync(timeout=30):
    """백그라운드 동기화가 끝날 때까지 기다린다."""
    for _ in range(timeout * 10):
        st = v2_sync.sync_status()
        if not st['running'] and not st['pending']:
            return st
        time.sleep(0.1)
    return v2_sync.sync_status()


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    app = create_app()

    # ── 컷오버가 끝난 DB 에서는 돌지 않는다 (2026-08-05 추가) ──────────────
    #
    # 이 시험은 **컷오버 전 동작**(V1 저장 → dt2 동기화)을 검증하므로 아래에서
    # `DT2_WRITE_ENABLED = False` 로 그 상태를 만든다. 그런데 컷오버가 끝난 DB 에
    # 그렇게 하면 **V1 이 정본인 척하고 dt2 를 덮는다.**
    #
    #   · 2026-08-01 아침: V2 에만 있던 **KPI 연결이 사라졌다.**
    #   · 2026-08-05: 성과를 다시 만든 직후 이 시험이 V1 의 옛 성과목록에서
    #     **이미 삭제된 성과를 가리키는 연결 218건**을 정본에 다시 심었다.
    #     회귀는 전부 초록불이라 아무도 눈치채지 못했다.
    #
    # 그래서 **플래그를 덮어쓰기 전에** 진짜 설정을 읽어 판단한다 — `v2_sync._cutover_done`
    # 이 보는 것과 같은 신호다. 여기서 막지 않으면 회귀를 한 번 돌릴 때마다 심는다.
    if app.config.get('DT2_WRITE_ENABLED', False) and '--force-precutover' not in sys.argv:
        print('건너뜀 — 이 DB 는 컷오버가 끝났다(DT2_WRITE_ENABLED=True).')
        print('  돌리면 V1 의 낡은 값이 dt2(정본)를 덮는다.')
        print('  · 2026-08-01 KPI 연결 소실 · 2026-08-05 성과 연결 218건 재삽입')
        print('  컷오버 전 환경에서 검증하려는 것이면 --force-precutover 를 준다.')
        print('  (돌린 뒤에는 삭제된 성과를 가리키는 연결이 남지 않았는지 확인할 것)')
        return 0

    # 컷오버 전 상태를 **명시적으로** 만든다.
    #
    # 예전에는 이 줄이 없어도 동작했다 — create_app 이 .env 를 안 읽어서
    # DT2_WRITE_ENABLED 가 우연히 False 였기 때문이다. 그 우연이 위 08-01 사고의
    # 원인이었으므로 이제는 적는다.
    app.config['DT2_WRITE_ENABLED'] = False

    with app.app_context():
        client = app.test_client()
        admin = User.query.filter_by(role=UserRole.ADMIN, is_active=True).first()
        if admin is None:
            print('[FAIL] admin 사용자가 없습니다.')
            sys.exit(1)
        hdr = {'Authorization': f'Bearer {create_access_token(identity=str(admin.id))}'}

        head = DashboardData.query.first()
        projs = head.projects or []
        idx = next(i for i, p in enumerate(projs)
                   if isinstance(p, dict) and p.get('uuid') and not p.get('_deleted'))
        target_uuid = projs[idx]['uuid']
        orig_progress = projs[idx].get('진행률')
        orig_version = head.version
        new_progress = (int(orig_progress) + 7) % 100 if str(orig_progress).isdigit() else 42

        print(f"대상 과제 {target_uuid[:8]} · 진행률 {orig_progress!r} -> {new_progress}")
        print(f"시작 버전 v{orig_version}")

        def upsert(progress):
            payload = json.loads(json.dumps(projs, ensure_ascii=False))
            payload[idx]['진행률'] = progress
            r = client.post('/api/digital-twin-dashboard/data/upsert',
                            json={'version': DashboardData.query.first().version,
                                  'projects': payload,
                                  'performances': head.performances or [],
                                  'metadata': head.data_metadata or {}},
                            headers=hdr)
            return r

        try:
            # ── ① 저장하면 dt2 가 따라오는가 ──────────────────────────────
            print("\n── ① 저장 → 자동 동기화 ──")
            r = upsert(new_progress)
            check('저장 200', r.status_code == 200, f'실제 {r.status_code}')

            st = wait_sync()
            check('동기화가 끝남', not st['running'] and not st['pending'])
            check('동기화 성공', st['lastOk'] is True, f"실제 {st['lastOk']} / {st['lastDetail']}")

            db.session.expire_all()
            row = Dt2Project.query.filter_by(uuid=target_uuid).first()
            check('★ dt2 에 새 값이 반영됨', row and row.progress == new_progress,
                  f'실제 {row.progress if row else None}')

            v1 = DashboardData.query.first()
            check('V1 버전이 올라감', v1.version > orig_version,
                  f'{orig_version} -> {v1.version}')

            # ── ② 동기화가 깨져도 저장은 되는가 ──────────────────────────
            print("\n── ② 동기화 실패 시 저장 ──")
            broken = new_progress + 1
            original_loader = v2_sync._load_importer
            v2_sync._load_importer = lambda: (_ for _ in ()).throw(
                RuntimeError('의도적 실패 — 시험용'))
            try:
                r = upsert(broken)
                check('★ 동기화가 깨져도 저장 200', r.status_code == 200,
                      f'실제 {r.status_code}')
                st = wait_sync()
                check('동기화는 실패로 기록됨', st['lastOk'] is False,
                      f"실제 {st['lastOk']}")
                v1 = DashboardData.query.first()
                saved = (v1.projects or [])[idx].get('진행률')
                check('★ V1 에는 값이 저장돼 있음', saved == broken, f'실제 {saved!r}')
            finally:
                v2_sync._load_importer = original_loader

            # 정상 동기화로 복구되는가
            print("\n── ③ 다음 저장에서 복구 ──")
            r = upsert(new_progress)
            st = wait_sync()
            check('동기화 성공으로 복귀', st['lastOk'] is True, f"실제 {st['lastDetail']}")
            db.session.expire_all()
            row = Dt2Project.query.filter_by(uuid=target_uuid).first()
            check('★ dt2 가 최신으로 맞춰짐', row and row.progress == new_progress,
                  f'실제 {row.progress if row else None}')

        finally:
            print("\n── 정리 ──")
            r = upsert(orig_progress)
            wait_sync()
            db.session.expire_all()
            v1 = DashboardData.query.first()
            restored = (v1.projects or [])[idx].get('진행률')
            check('원본 진행률 복원', restored == orig_progress,
                  f'{restored!r} != {orig_progress!r}')
            row = Dt2Project.query.filter_by(uuid=target_uuid).first()
            check('dt2 도 원본값', row and str(row.progress) == str(
                orig_progress if orig_progress is not None else row.progress),
                f'실제 {row.progress if row else None}')

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
