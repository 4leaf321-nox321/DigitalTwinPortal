"""
성과 수정 → 과제-성과 연결 전파 시험 (2026-08-07) — 개발 서버/DB 전용.

무엇을 확인하나
    ① 성과의 실적수준을 고치면 **연결 행까지** 따라 바뀌는가
       (extra_fields 사본 + actual_level 컬럼 — 마른 행은 컬럼이 정본이라 둘 다 본다)
    ② 화면이 받는 조립 결과(`/dt-v2/data/download`)에 새 값이 나오는가
    ③ 값이 바뀐 과제의 `row_version` 이 올라가는가
       — 이게 있어야 편집창을 열어 둔 사람의 낡은 저장이 409 로 막힌다
    ④ 낡은 버전으로 연결을 저장하면 **정말 409** 인가 (되돌아가기 방지의 핵심)
    ⑤ 같은 값으로 다시 고치면 아무 과제도 안 건드리는가 (근거 없는 409 방지)
    ⑥ 과제기여도는 **안 덮이는가** (유일한 과제별 값)

**실제로 돌고 있는 서버**에 HTTP 로 때린다. in-process test_client 로 하면
"내 코드" 는 맞지만 "지금 돌고 있는 서버" 는 아니라서, 재시작이 됐는지를 못 가린다.

원래 값은 끝나고 되돌린다. 시험용 데이터를 새로 만들지 않는다.

사용법
    python scripts\\dt3_test_perf_link_sync.py [--base http://localhost:5174]
"""

from __future__ import annotations

import os
import sys
import argparse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import requests

from app import create_app
from app.extensions import db
from app.modules.auth.models import User, UserRole
from app.modules.digital_twin_dashboard.models_v2 import (
    Dt2Project, Dt2ProjectPerformance, Dt2Performance,
)
from flask_jwt_extended import create_access_token

results = []


def check(desc, cond, extra=''):
    results.append((desc, bool(cond)))
    print(f"  {'[OK]  ' if cond else '[FAIL]'} {desc}" + (f"   → {extra}" if extra else ''))


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    ap = argparse.ArgumentParser()
    ap.add_argument('--base', default='http://localhost:5174')
    args = ap.parse_args()
    api = args.base.rstrip('/') + '/api'

    app = create_app()
    with app.app_context():
        admin = User.query.filter_by(role=UserRole.ADMIN, is_active=True).first()
        if admin is None:
            print('관리자 계정이 없어 시험할 수 없습니다.')
            return 1
        # 돌고 있는 서버와 **같은 SECRET_KEY** 를 쓰므로 이 토큰이 그대로 통한다
        token = create_access_token(identity=str(admin.id))
        H = {'Authorization': f'Bearer {token}',
             'X-DT2-Allow-Write': 'test',
             'Content-Type': 'application/json'}

        # 실적수준이 들어 있는 연결을 하나 고른다 (삭제되지 않은 과제)
        ln = (db.session.query(Dt2ProjectPerformance)
              .join(Dt2Project, Dt2Project.uuid == Dt2ProjectPerformance.project_uuid)
              .filter(Dt2Project.is_deleted.is_(False))
              .filter(Dt2Project.is_permanently_deleted.is_(False))
              .filter(Dt2ProjectPerformance.actual_level.isnot(None))
              .first())
        if ln is None:
            print('실적수준이 있는 연결이 없어 시험할 수 없습니다.')
            return 1

        perf = Dt2Performance.query.filter_by(uuid=ln.performance_uuid).first()
        proj_uuid = ln.project_uuid
        proj = Dt2Project.query.filter_by(uuid=proj_uuid).first()

        orig_perf_actual = perf.actual_level
        orig_link_actual = ln.actual_level
        orig_extra = dict(ln.extra_fields or {})
        orig_contrib = ln.contribution
        v_before = proj.row_version
        perf_v_before = perf.row_version

        print(f"대상 과제 : {proj.title[:40]} (row_version={v_before})")
        print(f"대상 성과 : {perf.title[:40]}")
        print(f"실적수준  : 성과={orig_perf_actual!r} · 연결={orig_link_actual!r}"
              f" · 기여도={orig_contrib!r}\n")

        NEW = '77.7' if str(orig_perf_actual) != '77.7' else '66.6'
        ok_restore = True

        try:
            # ── ① 성과 실적수준 수정 ───────────────────────────────────────
            r = requests.patch(f'{api}/dt-v2/performances/{perf.uuid}',
                               json={'patch': {'실적수준': NEW},
                                     'expected_version': perf_v_before},
                               headers=H, timeout=15)
            body = r.json() if r.content else {}
            data = body.get('data') or {}
            check('성과 PATCH 200', r.status_code == 200, f'{r.status_code} {body.get("message","")}')
            check('applied 에 actual_level', 'actual_level' in (data.get('applied') or []),
                  str(data.get('applied')))
            check('★ relinkedRows ≥ 1 (연결 행을 고쳤다)', (data.get('relinkedRows') or 0) >= 1,
                  f"relinkedRows={data.get('relinkedRows')}")

            db.session.expire_all()
            ln2 = Dt2ProjectPerformance.query.filter_by(
                project_uuid=proj_uuid, performance_uuid=perf.uuid).first()
            proj2 = Dt2Project.query.filter_by(uuid=proj_uuid).first()

            # ── ② 저장된 연결 행 ──────────────────────────────────────────
            check('연결 actual_level 컬럼 반영', str(ln2.actual_level) == NEW,
                  f'{ln2.actual_level!r}')
            if '실적수준' in orig_extra:
                check('연결 extra_fields 사본 반영',
                      str((ln2.extra_fields or {}).get('실적수준')) == NEW,
                      str((ln2.extra_fields or {}).get('실적수준')))
            check('⑥ 과제기여도는 안 덮였다', ln2.contribution == orig_contrib,
                  f'{orig_contrib!r} → {ln2.contribution!r}')

            # ── ③ row_version 상승 ────────────────────────────────────────
            check('★ 과제 row_version 상승', proj2.row_version == v_before + 1,
                  f'{v_before} → {proj2.row_version}')

            # ── ② 화면이 받는 조립 결과 ───────────────────────────────────
            r2 = requests.get(f'{api}/dt-v2/data/download?rowVersions=1', headers=H, timeout=60)
            dl = (r2.json().get('data') or {}) if r2.content else {}
            target = next((p for p in (dl.get('projects') or [])
                           if (p.get('uuid') or p.get('id')) == proj_uuid), None)
            elem = None
            if target:
                for e in (target.get('성과목록') or []):
                    ref = (e.get('성과항목UUID') or e.get('성과UUID')
                           or e.get('uuid') or e.get('성과항목ID') or e.get('id'))
                    if ref in (perf.uuid, perf.code):
                        elem = e
                        break
            check('download 200', r2.status_code == 200, str(r2.status_code))
            check('★ 조립된 성과목록 원소에 새 실적수준',
                  elem is not None and str(elem.get('실적수준')) == NEW,
                  str(elem))

            # ── ④ 낡은 버전으로 연결 저장 → 409 ──────────────────────────
            items = [{'performanceUuid': l.performance_uuid,
                      'contribution': l.contribution,
                      'actualLevel': (orig_link_actual
                                      if l.performance_uuid == perf.uuid else l.actual_level)}
                     for l in Dt2ProjectPerformance.query.filter_by(project_uuid=proj_uuid).all()]
            r3 = requests.put(f'{api}/dt-v2/projects/{proj_uuid}/performances',
                              json={'items': items, 'expected_version': v_before,
                                    'reason': '낡은 버전 저장 시험'},
                              headers=H, timeout=15)
            check('★ 낡은 버전으로 연결 저장 → 409 (되돌아가기 차단)',
                  r3.status_code == 409, f'{r3.status_code}')

            db.session.expire_all()
            ln3 = Dt2ProjectPerformance.query.filter_by(
                project_uuid=proj_uuid, performance_uuid=perf.uuid).first()
            check('★ 막혔으므로 실적수준이 안 되돌아갔다', str(ln3.actual_level) == NEW,
                  f'{ln3.actual_level!r}')

            # ── ⑤ 같은 값으로 다시 → 아무것도 안 바뀐다 ───────────────────
            db.session.expire_all()
            perf2 = Dt2Performance.query.filter_by(uuid=perf.uuid).first()
            v_now = Dt2Project.query.filter_by(uuid=proj_uuid).first().row_version
            r4 = requests.patch(f'{api}/dt-v2/performances/{perf.uuid}',
                                json={'patch': {'실적수준': NEW},
                                      'expected_version': perf2.row_version},
                                headers=H, timeout=15)
            d4 = (r4.json().get('data') or {}) if r4.content else {}
            db.session.expire_all()
            v_after = Dt2Project.query.filter_by(uuid=proj_uuid).first().row_version
            check('⑤ 같은 값 재저장은 과제 row_version 을 안 올린다', v_after == v_now,
                  f'{v_now} → {v_after} (applied={d4.get("applied")})')

        finally:
            # ── 원래대로 ──────────────────────────────────────────────────
            try:
                db.session.expire_all()
                p = Dt2Performance.query.filter_by(uuid=perf.uuid).first()
                p.actual_level = orig_perf_actual
                l = Dt2ProjectPerformance.query.filter_by(
                    project_uuid=proj_uuid, performance_uuid=perf.uuid).first()
                l.actual_level = orig_link_actual
                l.extra_fields = orig_extra
                l.contribution = orig_contrib
                pj = Dt2Project.query.filter_by(uuid=proj_uuid).first()
                pj.row_version = v_before
                p.row_version = perf_v_before
                db.session.commit()
                print('\n원래 값으로 되돌렸습니다.')
            except Exception as e:      # noqa: BLE001
                ok_restore = False
                db.session.rollback()
                print(f'\n⚠️ 되돌리기 실패: {e}')

    print('\n' + '=' * 72)
    bad = [d for d, ok in results if not ok]
    if bad or not ok_restore:
        print(f' 결과: [FAIL] {len(bad)}건 실패')
        for d in bad:
            print(f'   - {d}')
        return 1
    print(f' 결과: [OK] {len(results)}건 전부 통과')
    print('=' * 72)
    return 0


if __name__ == '__main__':
    sys.exit(main())
