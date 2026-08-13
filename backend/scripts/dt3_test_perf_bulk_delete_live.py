"""
성과 전체 삭제 — **성공 경로 검증 (파괴적, 스냅샷 후 원복).** (2026-08-02)

이 스크립트는 **실제로 전량을 지운다.** 그래서 지우기 전에 되돌릴 것을 전부
파일로 먼저 떠 놓는다 — 중간에 죽어도 그 파일로 손으로 복원할 수 있다.

  1. 스냅샷을 파일에 쓰고 flush (성과 삭제 상태 + 연결 전량)
  2. 전체 삭제 실행
  3. 지워졌는지, 연결이 끊겼는지, 활동 로그가 남았는지 확인
  4. 스냅샷대로 원복
  5. 원복이 정확한지 확인 (건수·연결 내용까지)

실행:  venv/Scripts/python.exe scripts/dt3_test_perf_bulk_delete_live.py
복원만:  ... --restore-only   (2~3 단계에서 죽었을 때)
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask_jwt_extended import create_access_token                    # noqa: E402

from app import create_app                                            # noqa: E402
from app.extensions import db                                         # noqa: E402
from app.modules.auth.models import User                              # noqa: E402
from app.modules.digital_twin_dashboard.models import (               # noqa: E402
    DashboardActivityLog,
)
from app.modules.digital_twin_dashboard.models_v2 import (            # noqa: E402
    Dt2Performance, Dt2Project, Dt2ProjectChange, Dt2ProjectPerformance,
)

SNAP = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                    '_perf_bulk_delete_snapshot.json')
MARK = '__BULK_DELETE_LIVE_TEST__'
RESTORE_ONLY = '--restore-only' in sys.argv

FAIL = []


def check(name, got, want):
    ok = got == want
    print(f"  {'OK  ' if ok else 'FAIL'}  {name}: got={got!r} want={want!r}")
    if not ok:
        FAIL.append(name)


def take_snapshot():
    perfs = [{'uuid': p.uuid, 'is_deleted': bool(p.is_deleted),
              'deleted_at': p.deleted_at.isoformat() if p.deleted_at else None,
              'deleted_by_name': p.deleted_by_name,
              'row_version': p.row_version}
             for p in Dt2Performance.query.all()]
    links = [{'project_uuid': l.project_uuid,
              'performance_uuid': l.performance_uuid,
              'contribution': l.contribution,
              'actual_level': l.actual_level,
              'position': l.position,
              'extra_fields': l.extra_fields}
             for l in Dt2ProjectPerformance.query.all()]
    projs = [{'uuid': p.uuid, 'row_version': p.row_version}
             for p in Dt2Project.query.all()]
    snap = {'performances': perfs, 'links': links, 'projects': projs}
    with open(SNAP, 'w', encoding='utf-8') as f:
        json.dump(snap, f, ensure_ascii=False)
        f.flush()
        os.fsync(f.fileno())
    return snap


def restore(snap):
    """스냅샷대로 되돌린다. 이 스크립트가 만든 이력 행도 지운다."""
    from datetime import datetime
    for row in snap['performances']:
        p = Dt2Performance.query.filter_by(uuid=row['uuid']).first()
        if p is None:
            continue
        p.is_deleted = row['is_deleted']
        p.deleted_at = (datetime.fromisoformat(row['deleted_at'])
                        if row['deleted_at'] else None)
        p.deleted_by_name = row['deleted_by_name']
        p.row_version = row['row_version']

    Dt2ProjectPerformance.query.delete()
    db.session.flush()
    for row in snap['links']:
        db.session.add(Dt2ProjectPerformance(
            project_uuid=row['project_uuid'],
            performance_uuid=row['performance_uuid'],
            contribution=row['contribution'],
            actual_level=row['actual_level'],
            position=row['position'],
            extra_fields=row['extra_fields'],
        ))

    for row in snap['projects']:
        p = Dt2Project.query.filter_by(uuid=row['uuid']).first()
        if p is not None:
            p.row_version = row['row_version']

    # 이 검증이 만든 흔적 제거
    Dt2ProjectChange.query.filter(
        Dt2ProjectChange.reason.like(f'%{MARK}%')).delete(synchronize_session=False)
    DashboardActivityLog.query.filter(
        DashboardActivityLog.changes['reason'].astext.like(f'%{MARK}%')
    ).delete(synchronize_session=False)
    db.session.commit()


def main():
    app = create_app()
    with app.app_context():
        if RESTORE_ONLY:
            with open(SNAP, encoding='utf-8') as f:
                snap = json.load(f)
            restore(snap)
            print('스냅샷으로 원복 완료')
            return 0

        admin = User.query.filter_by(email='yjtwin.park@samsung.com').first()
        c = app.test_client()
        H = {'Authorization': f'Bearer {create_access_token(identity=str(admin.id))}'}

        live_before = Dt2Performance.query.filter(
            Dt2Performance.is_deleted.isnot(True)).count()
        links_before = Dt2ProjectPerformance.query.count()
        print(f'1. 스냅샷 — 살아있는 성과 {live_before}건 · 연결 {links_before}건')
        snap = take_snapshot()
        print(f'   저장: {SNAP}')

        summary = (c.get('/api/dt-v2/performances/delete-summary', headers=H)
                   .get_json() or {}).get('data', {})
        live_affected = summary.get('affectedProjectCount')

        print('2. 전체 삭제 실행')
        r = c.post('/api/dt-v2/performances/bulk-delete', headers=H,
                   json={'expectedCount': live_before, 'reason': MARK})
        d = (r.get_json() or {}).get('data', {})
        check('200', r.status_code, 200)
        check('삭제 건수', d.get('count'), live_before)
        # 확인 화면이 본 숫자와 결과가 같아야 한다
        check('영향 과제 수가 summary 와 일치',
              d.get('affectedProjectCount'), live_affected)

        print('3. 실제로 지워졌는지')
        db.session.expire_all()
        check('살아있는 성과 0건', Dt2Performance.query.filter(
            Dt2Performance.is_deleted.isnot(True)).count(), 0)
        check('연결 0건', Dt2ProjectPerformance.query.count(), 0)
        check('행은 남아 있다(소프트 삭제)',
              Dt2Performance.query.count(), len(snap['performances']))
        check('활동 로그 1건', DashboardActivityLog.query.filter(
            DashboardActivityLog.changes['reason'].astext.like(f'%{MARK}%')).count(), 1)
        check('연결 해제 이력 남음', Dt2ProjectChange.query.filter(
            Dt2ProjectChange.reason.like(f'%{MARK}%')).count() > 0, True)

        print('4. 원복')
        restore(snap)

        print('5. 원복 확인')
        db.session.expire_all()
        check('살아있는 성과 복구', Dt2Performance.query.filter(
            Dt2Performance.is_deleted.isnot(True)).count(), live_before)
        check('연결 복구', Dt2ProjectPerformance.query.count(), links_before)
        now_links = {(l.project_uuid, l.performance_uuid, l.contribution,
                      l.actual_level, l.position)
                     for l in Dt2ProjectPerformance.query.all()}
        want_links = {(r['project_uuid'], r['performance_uuid'], r['contribution'],
                       r['actual_level'], r['position']) for r in snap['links']}
        check('연결 내용까지 동일', now_links == want_links, True)
        check('검증 흔적 제거(이력)', Dt2ProjectChange.query.filter(
            Dt2ProjectChange.reason.like(f'%{MARK}%')).count(), 0)
        check('검증 흔적 제거(활동로그)', DashboardActivityLog.query.filter(
            DashboardActivityLog.changes['reason'].astext.like(f'%{MARK}%')).count(), 0)

    print()
    if FAIL:
        print(f'실패 {len(FAIL)}건: {", ".join(FAIL)}')
        print(f'⚠️ 데이터가 원복되지 않았을 수 있다. 확인 후 --restore-only 로 복원할 것.')
        return 1
    os.remove(SNAP)
    print('전부 통과 (데이터 원상 복구 확인, 스냅샷 삭제)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
