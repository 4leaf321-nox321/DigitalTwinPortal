"""
과제-성과 연결 API 시험 — 개발 DB 전용.

결정 (2026-07-29): **과제기여도 합계는 막지 않고 표시만 한다.**
    그래서 "합이 100 이 아니어도 저장된다" 와 "그 사실이 응답에 담긴다" 를 둘 다 본다.
    막지 않기로 한 것을 조용히 막아버리면 화면의 '기여도 부적합' 필터가 무의미해진다.

합계 기준은 화면과 같다 — 성과 하나에 연결된 **모든 과제**의 기여도 합
(ContributionEditModal.jsx:505). 과제별 합이 아니다. 그래서 과제 2개를 만들어 본다.

사용법
    python scripts\\dt3_test_links.py
"""

from __future__ import annotations

import os
import sys
import uuid as uuidlib

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.extensions import db
from app.modules.auth.models import User, UserRole
from app.modules.digital_twin_dashboard.models_v2 import (
    Dt2Project, Dt2Performance, Dt2ProjectPerformance,
    Dt2ProjectChange, Dt2ProjectHistory, Dt2PerformanceHistory,
)
from flask_jwt_extended import create_access_token

MARK = '__dt3_link_test__'
results = []


def check(desc, cond, extra=''):
    results.append((desc, bool(cond)))
    print(f"  {'[OK]  ' if cond else '[FAIL]'} {desc}" + (f"   {extra}" if not cond and extra else ''))


def auth(u):
    # 컷오버 전 쓰기 차단을 시험에서는 통과시킨다 (config.DT2_ALLOW_TEST_WRITE_HEADER)
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
        n_proj, n_perf = Dt2Project.query.count(), Dt2Performance.query.count()
        admin = User.query.filter_by(role=UserRole.ADMIN, is_active=True).first()

        pA, pB = str(uuidlib.uuid4()), str(uuidlib.uuid4())
        f1 = f2 = None
        try:
            for u, c in ((pA, MARK + '-A'), (pB, MARK + '-B')):
                db.session.add(Dt2Project(uuid=u, code=c, title=c, status='정상진행',
                                          owner_user_id=admin.id, row_version=1,
                                          extra_fields={}, is_deleted=False,
                                          is_permanently_deleted=False))
            for _ in range(2):
                pass
            db.session.commit()

            r = client.post('/api/dt-v2/performances',
                            # 2026-08-03 부터 대분류·소분류가 생성 시 필수다(짝도 맞아야 한다).
                            # 빠뜨리면 400 이라 여기서 스크립트가 죽고 아래가 안 돈다.
                            json={'fields': {'title': f'{MARK} 성과1', 'unit': '건',
                                             'category': '품질향상',
                                             'subcategory': '예측 정확도'}},
                            headers=auth(admin))
            f1 = r.get_json()['data']['uuid']
            r = client.post('/api/dt-v2/performances',
                            json={'fields': {'title': f'{MARK} 성과2', 'unit': '%',
                                             'category': '품질향상',
                                             'subcategory': '예측 정확도'}},
                            headers=auth(admin))
            f2 = r.get_json()['data']['uuid']

            print("\n── 연결 교체 ──")
            r = client.put(f'/api/dt-v2/projects/{pA}/performances',
                           json={'items': [
                               {'performanceUuid': f1, 'contribution': 60},
                               {'performanceUuid': f2, 'contribution': 100}]},
                           headers=auth(admin))
            check('PUT 200', r.status_code == 200, f'실제 {r.status_code}')
            d = r.get_json()['data']
            check('2건 연결됨', len(d['items']) == 2, f"실제 {len(d['items'])}")
            check('순서가 보존됨', [i['performanceUuid'] for i in d['items']] == [f1, f2])
            check('제목이 함께 옴', d['items'][0]['title'] is not None)

            print("\n── ★ 기여도 합계는 막지 않고 표시만 ──")
            warns = {w['performanceUuid']: w for w in d['contributionWarnings']}
            check('★ 60% 인 성과가 경고에 나옴', f1 in warns, f'실제 {list(warns)}')
            check('  합계 60 으로 보고', warns.get(f1, {}).get('sum') == 60,
                  f"실제 {warns.get(f1, {}).get('sum')}")
            check('★ 100% 인 성과는 경고 없음', f2 not in warns)
            check('★ 그래도 저장은 됐다',
                  Dt2ProjectPerformance.query.filter_by(
                      project_uuid=pA, performance_uuid=f1).first() is not None)

            print("\n── ★ 합계는 성과 기준(여러 과제 합산) ──")
            r = client.put(f'/api/dt-v2/projects/{pB}/performances',
                           json={'items': [{'performanceUuid': f1, 'contribution': 40}]},
                           headers=auth(admin))
            warns = {w['performanceUuid']: w for w in r.get_json()['data']['contributionWarnings']}
            check('★ 60+40=100 이 되어 경고가 사라짐', f1 not in warns,
                  f'실제 {warns.get(f1)}')

            r = client.get(f'/api/dt-v2/projects/{pA}/performances', headers=auth(admin))
            warns = {w['performanceUuid']: w for w in r.get_json()['data']['contributionWarnings']}
            check('  A 과제에서 조회해도 동일', f1 not in warns)

            print("\n── 검증 ──")
            r = client.put(f'/api/dt-v2/projects/{pA}/performances',
                           json={'items': [{'performanceUuid': str(uuidlib.uuid4())}]},
                           headers=auth(admin))
            check('★ 없는 성과 400', r.status_code == 400, f'실제 {r.status_code}')
            r = client.put(f'/api/dt-v2/projects/{pA}/performances',
                           json={'items': [{'performanceUuid': f1},
                                           {'performanceUuid': f1}]},
                           headers=auth(admin))
            check('★ 같은 성과 중복 400', r.status_code == 400, f'실제 {r.status_code}')

            cur = Dt2Project.query.filter_by(uuid=pA).first().row_version
            r = client.put(f'/api/dt-v2/projects/{pA}/performances',
                           json={'items': [], 'expected_version': cur - 1},
                           headers=auth(admin))
            check('버전 어긋나면 409', r.status_code == 409, f'실제 {r.status_code}')

            # ── ★ AI 연결은 확인 대기로 간다 (2026-08-02 변경) ───────────────
            #
            # 그 전에는 403 이었다. 막은 이유는 "연결을 바꾸면 그 성과를 쓰는 **다른
            # 과제의 기여도 합**까지 흔들리는데 승인자가 자기 과제만 보고 승인한다"
            # 였다. 그래서 막는 대신 **202 로 보내고 그 다른 과제들을 실어 보낸다** —
            # 우려의 원인을 없앤 것이라, `affectedProjects` 가 안 나오면 원래 문제가
            # 그대로 돌아온다. 그래서 여기서는 202 만이 아니라 **그 표까지** 본다.
            print("\n── ★ AI 연결은 즉시 반영이 아니라 확인 대기 ──")
            before = Dt2ProjectPerformance.query.filter_by(project_uuid=pA).count()
            r = client.put(f'/api/dt-v2/projects/{pA}/performances',
                           json={'items': [], 'actor_mode': 'ai'}, headers=auth(admin))
            check('★ AI 연결은 202 (403 이 아니다)', r.status_code == 202,
                  f'실제 {r.status_code}')
            d = (r.get_json() or {}).get('data') or {}
            check('  proposalId 가 온다', bool(d.get('proposalId')), str(d)[:120])
            check('★ 영향 받는 과제를 함께 준다',
                  'affectedProjects' in d, str(d)[:160])
            db.session.expire_all()
            check('★★ 그 자리에서 반영되지 않는다',
                  Dt2ProjectPerformance.query.filter_by(project_uuid=pA).count() == before,
                  f'{before} -> '
                  f'{Dt2ProjectPerformance.query.filter_by(project_uuid=pA).count()}')
            if d.get('proposalId'):
                client.post(f"/api/dt-v2/proposals/{d['proposalId']}/reject",
                            json={'note': '시험 정리'}, headers=auth(admin))

            print("\n── 개별 해제 · 변경 로그 ──")
            r = client.delete(f'/api/dt-v2/projects/{pB}/performances/{f1}',
                              headers=auth(admin))
            check('DELETE 200', r.status_code == 200, f'실제 {r.status_code}')
            warns = {w['performanceUuid']: w for w in r.get_json()['data']['contributionWarnings']}
            check('★ 해제로 합이 60 이 되어 다시 경고', warns.get(f1, {}).get('sum') == 60,
                  f"실제 {warns.get(f1, {}).get('sum')}")

            logs = Dt2ProjectChange.query.filter_by(
                project_uuid=pA, field='performance_links').count()
            check('★ 연결 변경이 로그에 남음', logs >= 1, f'실제 {logs}건')

        finally:
            print("\n── 정리 ──")
            for u in (pA, pB):
                Dt2ProjectPerformance.query.filter_by(project_uuid=u).delete()
                Dt2ProjectChange.query.filter_by(project_uuid=u).delete()
                Dt2ProjectHistory.query.filter_by(project_uuid=u).delete()
                Dt2Project.query.filter_by(uuid=u).delete()
            for u in (f1, f2):
                if u:
                    Dt2PerformanceHistory.query.filter_by(performance_uuid=u).delete()
                    Dt2Performance.query.filter_by(uuid=u).delete()
            db.session.commit()
            check('과제 건수 불변', Dt2Project.query.count() == n_proj)
            check('성과 건수 불변', Dt2Performance.query.count() == n_perf)

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
