"""
V2 불변식 시험 — 쓰기·읽기·이력·권한이 서로 어긋나지 않는가 (개발 DB 전용)

앞선 스위트들은 각 API 를 따로 봤다. 여기는 **서로 물린 부분**을 본다.
경계값보다 이런 이음매에서 조용한 결함이 나온다.

    A. 왕복        V2 로 쓴 값이 재조립(assemble)에 그대로 나오는가 ★
    B. 이력 해시   쓰기 API 와 배치 이관이 '바뀜' 을 같게 판단하는가 ★
    C. 권한 매트릭스  역할 × 관계 전수
    D. 목록 ↔ 권한  editable=true 목록과 can_edit 판정이 일치하는가
    E. 이력 정확성  안 바뀌면 안 쌓이고, 바뀐 필드만 기록되는가

사용법
    python scripts\\dt3_test_invariants.py
"""

from __future__ import annotations

import json
import os
import sys
import uuid as uuidlib

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.extensions import db
from app.modules.auth.models import User, UserRole
from app.modules.digital_twin_dashboard import permissions as P
from app.modules.digital_twin_dashboard.assemble import assemble_project
from app.modules.digital_twin_dashboard.history_hash import (
    PERF_HISTORY_COLS, PROJECT_HISTORY_COLS, value_hash, derive_project_counts,
)
from app.modules.digital_twin_dashboard.models_v2 import (
    Dt2Project, Dt2Performance, Dt2ProjectPerformance,
    Dt2ProjectChange, Dt2ProjectHistory, Dt2PerformanceHistory, Dt2ChangeProposal,
)
from flask_jwt_extended import create_access_token
from sqlalchemy import or_

MARK = '__dt3_inv__'
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
        n_proj, n_perf, n_user = (Dt2Project.query.count(),
                                  Dt2Performance.query.count(), User.query.count())
        admin = User.query.filter_by(role=UserRole.ADMIN, is_active=True).first()

        made_users = []

        def mkuser(tag, role):
            u = User(email=f'{MARK}_{tag}@t.local', name=f'{MARK}{tag}',
                     role=role, is_active=True)
            u.set_password('x' * 16)
            db.session.add(u); db.session.commit()
            made_users.append(u)
            return u

        owner = mkuser('owner', UserRole.USER)
        other = mkuser('other', UserRole.USER)
        viewer = mkuser('viewer', UserRole.VIEWER)
        dtoff = mkuser('dtoff', UserRole.DT_OFFICE_MEMBER)

        puid = str(uuidlib.uuid4())
        fid = None
        try:
            db.session.add(Dt2Project(
                uuid=puid, code=MARK, title=MARK, status='정상진행', progress=10,
                owner_user_id=owner.id, row_version=1, extra_fields={},
                action_items_json=[], issues_json=[],
                is_deleted=False, is_permanently_deleted=False))
            db.session.commit()

            # ── A. 왕복 ─────────────────────────────────────────────────────
            print("\n── A. V2 로 쓴 값이 재조립에 그대로 나오는가 ──")
            r = client.post('/api/dt-v2/performances',
                            # 대분류·소분류는 2026-08-03 부터 생성 시 필수다(400).
                            json={'fields': {'title': f'{MARK}성과', 'unit': '건',
                                             'category': '품질향상',
                                             'subcategory': '예측 정확도'}},
                            headers=auth(admin))
            fid = r.get_json()['data']['uuid']
            r = client.put(f'/api/dt-v2/projects/{puid}/performances',
                           json={'items': [{'performanceUuid': fid,
                                            'contribution': 70, 'actualLevel': '12'}]},
                           headers=auth(admin))
            check('연결 저장 200', r.status_code == 200, f'실제 {r.status_code}')

            db.session.expire_all()
            proj = Dt2Project.query.filter_by(uuid=puid).first()
            links = Dt2ProjectPerformance.query.filter_by(project_uuid=puid).all()
            elem = (assemble_project(proj, links, []).get('성과목록') or [{}])[0]
            check('★★ 재조립에 과제기여도가 살아있음', elem.get('과제기여도') == '70',
                  f'실제 {elem}')
            check('★★ 재조립에 실적수준이 살아있음', elem.get('실적수준') == '12',
                  f'실제 {elem}')
            check('★ 참조 키도 있음',
                  any(k in elem for k in ('성과항목UUID', '성과UUID', 'uuid',
                                          '성과항목ID', 'id')), f'실제 {elem}')

            # /data 응답에도 나오는가
            r = client.get('/api/dt-v2/data', headers=auth(admin))
            got = next((p for p in r.get_json()['data']['projects']
                        if p.get('uuid') == puid), None)
            check('★ /data 응답에도 기여도가 담김',
                  got and (got.get('성과목록') or [{}])[0].get('과제기여도') == '70',
                  f"실제 {got.get('성과목록') if got else None}")

            # 기존 원소의 부가 정보가 편집으로 사라지지 않는가
            ln = Dt2ProjectPerformance.query.filter_by(project_uuid=puid).first()
            ex = dict(ln.extra_fields or {})
            ex['성과항목'] = '복제된이름'
            ln.extra_fields = ex
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(ln, 'extra_fields'); db.session.commit()
            client.put(f'/api/dt-v2/projects/{puid}/performances',
                       json={'items': [{'performanceUuid': fid, 'contribution': 55}]},
                       headers=auth(admin))
            db.session.expire_all()
            ln = Dt2ProjectPerformance.query.filter_by(project_uuid=puid).first()
            check('★ 재편집해도 기존 부가 필드가 보존됨',
                  (ln.extra_fields or {}).get('성과항목') == '복제된이름',
                  f'실제 {ln.extra_fields}')
            check('  기여도는 새 값으로', (ln.extra_fields or {}).get('과제기여도') == '55')
            check('  실적수준은 안 보냈으므로 사라짐',
                  '실적수준' not in (ln.extra_fields or {}))

            # ── B. 이력 해시 교차 일치 ──────────────────────────────────────
            print("\n── B. 쓰기 API 와 배치 이관이 '바뀜' 을 같게 보는가 ──")
            # 연결 변경은 추적 필드가 아니라 이력을 만들지 않는다(정상).
            # 해시를 대조하려면 추적 필드를 한 번 바꿔 이력을 만들어야 한다.
            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'progress': 44}}, headers=auth(admin))
            check('추적 필드 변경 200', r.status_code == 200, f'실제 {r.status_code}')
            db.session.expire_all()
            proj = Dt2Project.query.filter_by(uuid=puid).first()
            api_hash = value_hash({
                'status': proj.status, 'progress': proj.progress,
                'start_month': proj.start_month, 'end_month': proj.end_month,
                **derive_project_counts({'action_items_json': proj.action_items_json,
                                         'issues_json': proj.issues_json}),
            }, PROJECT_HISTORY_COLS)
            latest = (Dt2ProjectHistory.query.filter_by(project_uuid=puid)
                      .order_by(Dt2ProjectHistory.id.desc()).first())
            check('★★ 최신 이력 해시가 현재 값에서 계산한 것과 같음',
                  latest is not None and latest.value_hash == api_hash,
                  f'실제 {latest.value_hash[:12] if latest else None} vs {api_hash[:12]}')

            perf = Dt2Performance.query.filter_by(uuid=fid).first()
            ph = value_hash({c: getattr(perf, c) for c in PERF_HISTORY_COLS},
                            PERF_HISTORY_COLS)
            plat = (Dt2PerformanceHistory.query.filter_by(performance_uuid=fid)
                    .order_by(Dt2PerformanceHistory.id.desc()).first())
            check('★★ 성과도 동일', plat is not None and plat.value_hash == ph,
                  f'실제 {plat.value_hash[:12] if plat else None} vs {ph[:12]}')

            # ── C. 권한 매트릭스 ────────────────────────────────────────────
            print("\n── C. 역할 × 관계 전수 ──")
            cases = [
                ('admin',    admin,  True,  True),
                ('dt_office', dtoff, True,  True),
                ('소유자',    owner,  True,  False),
                ('무관 user', other,  False, False),
                ('viewer',    viewer, False, False),
            ]
            for name, u, can_edit, can_perm_del in cases:
                r = client.get(f'/api/dt-v2/projects/{puid}', headers=auth(u))
                got_edit = r.get_json()['data'].get('canEdit')
                check(f'{name}: canEdit={can_edit}', got_edit is can_edit,
                      f'실제 {got_edit}')
                r = client.patch(f'/api/dt-v2/projects/{puid}',
                                 json={'patch': {'progress': 12}}, headers=auth(u))
                ok = (r.status_code == 200) if can_edit else (r.status_code == 403)
                check(f'  {name}: PATCH {"허용" if can_edit else "거부"}', ok,
                      f'실제 {r.status_code}')
                r = client.post(f'/api/dt-v2/projects/{puid}/delete', headers=auth(u))
                ok = (r.status_code in (200, 400)) if can_edit else (r.status_code == 403)
                check(f'  {name}: 삭제 {"허용" if can_edit else "거부"}', ok,
                      f'실제 {r.status_code}')
                if r.status_code == 200:
                    client.post(f'/api/dt-v2/projects/{puid}/restore', headers=auth(u))

            # ── D. 목록 ↔ 권한 일관성 ───────────────────────────────────────
            print("\n── D. editable=true 목록이 can_edit 과 일치하는가 ──")
            for name, u in (('소유자', owner), ('무관', other), ('viewer', viewer)):
                r = client.get('/api/dt-v2/projects?editable=true&limit=1000',
                               headers=auth(u))
                listed = {i['uuid'] for i in r.get_json()['data']['items']}
                rows = Dt2Project.query.filter(
                    Dt2Project.uuid.in_(listed)).all() if listed else []
                bad = [x.uuid for x in rows if not P.can_edit_project(u, x)]
                check(f'★ {name}: 목록에 있는 것은 전부 편집 가능', not bad,
                      f'예외 {len(bad)}건')
                check(f'  {name}: 대상 과제 포함 여부가 권한과 일치',
                      (puid in listed) == P.can_edit_project(
                          u, Dt2Project.query.filter_by(uuid=puid).first()),
                      f'목록포함={puid in listed}')

            # ── E. 이력 정확성 ──────────────────────────────────────────────
            print("\n── E. 이력이 필요할 때만 쌓이는가 ──")
            db.session.expire_all()
            n_before = Dt2ProjectHistory.query.filter_by(project_uuid=puid).count()
            cur_prog = Dt2Project.query.filter_by(uuid=puid).first().progress
            client.patch(f'/api/dt-v2/projects/{puid}',
                         json={'patch': {'progress': cur_prog}}, headers=auth(admin))
            db.session.expire_all()
            check('★ 같은 값 재전송은 이력을 안 만든다',
                  Dt2ProjectHistory.query.filter_by(project_uuid=puid).count() == n_before,
                  f'{n_before} -> {Dt2ProjectHistory.query.filter_by(project_uuid=puid).count()}')

            client.patch(f'/api/dt-v2/projects/{puid}',
                         json={'patch': {'description': '이력에 안 잡히는 필드'}},
                         headers=auth(admin))
            db.session.expire_all()
            check('★ 추적 대상이 아닌 필드는 이력을 안 만든다',
                  Dt2ProjectHistory.query.filter_by(project_uuid=puid).count() == n_before,
                  f'실제 {Dt2ProjectHistory.query.filter_by(project_uuid=puid).count()}')

            client.patch(f'/api/dt-v2/projects/{puid}',
                         json={'patch': {'progress': (cur_prog or 0) + 3}},
                         headers=auth(admin))
            db.session.expire_all()
            last = (Dt2ProjectHistory.query.filter_by(project_uuid=puid)
                    .order_by(Dt2ProjectHistory.id.desc()).first())
            check('★ 추적 필드가 바뀌면 이력 1행',
                  Dt2ProjectHistory.query.filter_by(project_uuid=puid).count() == n_before + 1)
            check('★ changed_fields 에 progress 만',
                  last and list(last.changed_fields or []) == ['progress'],
                  f'실제 {last.changed_fields if last else None}')
            check('  change_kind 가 ui', last and last.change_kind == 'ui',
                  f'실제 {last.change_kind if last else None}')

        finally:
            print("\n── 정리 ──")
            ids = [u.id for u in made_users]
            Dt2ProjectPerformance.query.filter_by(project_uuid=puid).delete()
            Dt2ChangeProposal.query.filter_by(project_uuid=puid).delete()
            Dt2ProjectChange.query.filter_by(project_uuid=puid).delete()
            Dt2ProjectHistory.query.filter_by(project_uuid=puid).delete()
            Dt2Project.query.filter_by(uuid=puid).delete()
            if fid:
                Dt2ProjectPerformance.query.filter_by(performance_uuid=fid).delete()
                Dt2PerformanceHistory.query.filter_by(performance_uuid=fid).delete()
                Dt2Performance.query.filter_by(uuid=fid).delete()
            db.session.commit()
            Dt2ProjectChange.query.filter(
                or_(Dt2ProjectChange.actor_user_id.in_(ids),
                    Dt2ProjectChange.on_behalf_of.in_(ids))).delete(
                synchronize_session=False)
            db.session.commit()
            User.query.filter(User.id.in_(ids)).delete(synchronize_session=False)
            db.session.commit()
            check('과제 건수 불변', Dt2Project.query.count() == n_proj)
            check('성과 건수 불변', Dt2Performance.query.count() == n_perf)
            check('사용자 건수 불변', User.query.count() == n_user)

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
