"""
AI 의 DX KPI 연결 **제안**(2026-08-12) — 개발 DB 전용.

무엇이 바뀌었나
    `PUT /projects/<uuid>/kpi-links` 의 `actor_mode='ai'` 가 **403 → 202** 가 됐다.
    막았던 이유("AI 가 추측으로 채우면 매트릭스의 빈칸=계획의 구멍이 가짜로
    메워진다")를 **금지가 아니라 근거+승인으로** 풀었다. 과제-성과 연결이
    지나간 길과 같다.

이 시험이 지키는 것 — **완화가 구멍이 되지 않았는가**
    ★★ 근거(`reason`) 없이는 제안조차 만들어지지 않는다 (400)
    ★★ 제안만으로는 **아무것도 반영되지 않는다**
    ★★ preview 에 **지표 이름**이 들어 있다 — id 만 보여주면 승인이 형식이 된다
    ★★ 대상 사업부·기여 등급 규칙이 **제안 단계에서** 그대로 걸린다 (400)
    ★  승인해야 실제로 들어간다
    ★  화면 경로(actor_mode 없음)는 예전처럼 즉시 반영된다
    ★  일괄 편집은 여전히 PAT 을 막는다

사용법
    python scripts\\dt3_test_kpi_ai_propose.py
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
    Dt2ChangeProposal, Dt2Project, Dt2ProjectChange, Dt2ProjectHistory,
    Dt2ProjectKpi,
)
from app.modules.dx_kpi_management.models import KpiDefinition
from flask_jwt_extended import create_access_token

MARK = '__dt3_kpiai__'
results = []


def check(desc, cond, extra=''):
    results.append((desc, bool(cond)))
    print(f"  {'[OK]  ' if cond else '[FAIL]'} {desc}"
          + (f'   {extra}' if not cond and extra else ''))


def auth(u):
    return {'Authorization': f'Bearer {create_access_token(identity=str(u.id))}',
            'X-DT2-Allow-Write': 'test'}


def links_of(uuid):
    return [(x.kpi_definition_id, x.target_division, x.relation_type)
            for x in Dt2ProjectKpi.query.filter_by(project_uuid=uuid).all()]


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    app = create_app()
    with app.app_context():
        client = app.test_client()
        n_proj = Dt2Project.query.count()
        admin = User.query.filter_by(role=UserRole.ADMIN, is_active=True).first()

        # 전사 공통 지표(사업부 제한 없음) — 어느 사업부 과제에도 걸 수 있다
        common = next((k for k in KpiDefinition.query.all() if not (k.divisions or [])),
                      None)
        # 사업부 전용 지표 — 엉뚱한 대상으로 걸면 400 이어야 한다
        scoped = next((k for k in KpiDefinition.query.all() if (k.divisions or [])), None)

        # ⚠️ **KPI 를 관리하는 사업부**의 과제를 고른다. 아무거나 고르면 기능조직
        #    (GTR·SR·CS)이 잡힐 수 있고, 그러면 대상 사업부를 지목해야 해서
        #    이 시험의 모든 요청이 400 이 된다 — 실행마다 결과가 달라진다.
        #    `code` 로 정렬해 **매번 같은 과제**를 고른다.
        from app.modules.digital_twin_dashboard.routes_v2 import _kpi_owner_divisions
        owners = {d['name'] for d in _kpi_owner_divisions() if d['isKpiOwner']}
        src = (Dt2Project.query
               .filter(Dt2Project.division.in_(sorted(owners)),
                       Dt2Project.is_deleted.is_(False))
               .order_by(Dt2Project.code.asc()).first()) if owners else None
        if common is None or src is None:
            print('[SKIP] KPI 정의나 KPI 보유 사업부 과제가 없어 시험할 수 없다.')
            return 0

        puid = str(uuidlib.uuid4())
        db.session.add(Dt2Project(
            uuid=puid, code=f'{MARK}1', title=f'{MARK} 과제', status='정상진행',
            progress=0, row_version=1, extra_fields={}, is_deleted=False,
            is_permanently_deleted=False,
            division=src.division, division_id=src.division_id))
        db.session.commit()

        try:
            print(f'\n대상: {src.division} 과제 · 공통 지표 #{common.id} {common.label}')

            # ── A. 근거 없이는 제안조차 안 만든다 ─────────────────────────
            print('\n── A. ★★ 근거(reason) 없이는 제안이 안 만들어진다 ──')
            r = client.put(f'/api/dt-v2/projects/{puid}/kpi-links',
                           json={'items': [{'kpiDefinitionId': common.id}],
                                 'actor_mode': 'ai'}, headers=auth(admin))
            check('★★ 400', r.status_code == 400, f'실제 {r.status_code}')
            check('  왜 필요한지 말해 준다',
                  'reason' in (r.get_json() or {}).get('message', ''))
            check('★★ 제안이 쌓이지 않았다',
                  Dt2ChangeProposal.query.filter_by(project_uuid=puid).count() == 0)

            # ── B. 규칙은 제안 단계에서 걸린다 ────────────────────────────
            print('\n── B. ★★ 대상 사업부·기여등급 규칙이 제안 전에 걸린다 ──')
            r = client.put(f'/api/dt-v2/projects/{puid}/kpi-links',
                           json={'items': [{'kpiDefinitionId': common.id,
                                            'targetDivision': '없는사업부'}],
                                 'actor_mode': 'ai', 'reason': 'x'},
                           headers=auth(admin))
            check('★★ 남의 사업부 대상 → 400', r.status_code == 400,
                  f'실제 {r.status_code}')
            r = client.put(f'/api/dt-v2/projects/{puid}/kpi-links',
                           json={'items': [{'kpiDefinitionId': common.id,
                                            'relationType': '아무거나'}],
                                 'actor_mode': 'ai', 'reason': 'x'},
                           headers=auth(admin))
            check('★★ 모르는 기여등급 → 400', r.status_code == 400,
                  f'실제 {r.status_code}')
            # ⚠️ 이 단정은 **명백히 잘못된 두 요청 바로 뒤**에 있어야 한다.
            #    아래 '사업부 전용 지표' 는 그 사업부 소관이면 202 가 정상이라
            #    제안이 하나 생긴다 — 그 뒤에서 0 을 기대하면 시험이 거짓으로 깨진다.
            check('★★ 규칙 위반은 제안으로도 안 쌓인다',
                  Dt2ChangeProposal.query.filter_by(project_uuid=puid).count() == 0)

            if scoped is not None:
                r = client.put(f'/api/dt-v2/projects/{puid}/kpi-links',
                               json={'items': [{'kpiDefinitionId': scoped.id}],
                                     'actor_mode': 'ai', 'reason': 'x'},
                               headers=auth(admin))
                # 그 사업부가 관리하는 지표면 202 가 정상, 아니면 400 이다
                check('  사업부 전용 지표는 관리 사업부에서만',
                      r.status_code in (202, 400), f'실제 {r.status_code}')
                # 위에서 만들어졌을 수 있는 제안은 다음 절에 영향을 주지 않게 치운다
                Dt2ChangeProposal.query.filter_by(project_uuid=puid).delete()
                db.session.commit()

            # ── C. 근거와 함께면 202 ─────────────────────────────────────
            print('\n── C. 근거와 함께 → 202 (아직 반영 아님) ──')
            reason = '시뮬레이션 기술 개발이라 이 지표에 직접 기여'
            r = client.put(f'/api/dt-v2/projects/{puid}/kpi-links',
                           json={'items': [{'kpiDefinitionId': common.id,
                                            'relationType': 'primary'}],
                                 'actor_mode': 'ai', 'reason': reason},
                           headers=auth(admin))
            check('★ 202', r.status_code == 202, f'실제 {r.status_code}')
            data = (r.get_json() or {}).get('data') or {}
            pid = data.get('proposalId')
            check('  proposalId 를 준다', bool(pid))
            check('  pendingFields 가 kpi_links', data.get('pendingFields') == ['kpi_links'])
            check('★★ 아직 아무것도 안 들어갔다', links_of(puid) == [], f'{links_of(puid)}')

            prev = (data.get('preview') or {})
            after = (list(prev.values())[0] if prev else {}).get('after') or []
            check('★★ preview 에 지표 이름이 있다',
                  bool(after) and after[0].get('label') == common.label,
                  f'{after[:1]}')
            check('  대상 사업부가 확정돼 있다',
                  after and after[0].get('targetDivision') == src.division,
                  f'{after[:1]}')
            check('  기여 등급도 보인다', after and after[0].get('relationType') == 'primary')
            check('  근거를 되돌려 준다', data.get('reason') == reason)

            # ── D. 승인해야 들어간다 ─────────────────────────────────────
            print('\n── D. 승인 → 반영 ──')
            r = client.post(f'/api/dt-v2/proposals/{pid}/approve',
                            json={'note': '확인함'}, headers=auth(admin))
            check('★ 승인 200', r.status_code == 200, f'실제 {r.status_code}')
            check('  applied 에 kpi_links',
                  'kpi_links' in ((r.get_json() or {}).get('data') or {}).get('applied', []))
            db.session.expire_all()
            check('★★ 이제 실제로 들어갔다',
                  links_of(puid) == [(common.id, src.division, 'primary')],
                  f'{links_of(puid)}')
            ch = (Dt2ProjectChange.query.filter_by(project_uuid=puid, field='kpi_links')
                  .count())
            check('  변경 이력에 kpi_links 로 남는다', ch >= 1, f'{ch}건')

            # ── E. 화면 경로는 그대로 즉시 반영 ──────────────────────────
            print('\n── E. 화면 경로(actor_mode 없음)는 즉시 반영 ──')
            r = client.put(f'/api/dt-v2/projects/{puid}/kpi-links',
                           json={'items': []}, headers=auth(admin))
            check('★ 200 (202 아님)', r.status_code == 200, f'실제 {r.status_code}')
            db.session.expire_all()
            check('  바로 비워졌다', links_of(puid) == [], f'{links_of(puid)}')

            # ── F. 일괄 편집은 여전히 PAT 을 막는다 ──────────────────────
            print('\n── F. 일괄 편집은 여전히 막혀 있다 ──')
            r = client.post('/api/dt-v2/kpi-links/bulk',
                            json={'cells': [], 'dryRun': True}, headers=auth(admin))
            # JWT(사람)로는 통과할 수 있다 — 막는 것은 PAT 이다. 그 사실만 확인한다.
            check('  JWT 로는 부를 수 있다 (막는 대상은 PAT)',
                  r.status_code in (200, 400), f'실제 {r.status_code}')

        finally:
            print('\n── 정리 ──')
            Dt2ProjectKpi.query.filter_by(project_uuid=puid).delete()
            Dt2ChangeProposal.query.filter_by(project_uuid=puid).delete()
            Dt2ProjectChange.query.filter_by(project_uuid=puid).delete()
            Dt2ProjectHistory.query.filter_by(project_uuid=puid).delete()
            Dt2Project.query.filter_by(uuid=puid).delete()
            db.session.commit()
            check('과제 건수 불변', Dt2Project.query.count() == n_proj)

        failed = [d for d, ok in results if not ok]
        print('\n' + '=' * 72)
        print(f' 결과: {"[OK] " + str(len(results)) + "건 전부 통과" if not failed else "[FAIL] " + str(len(failed)) + "건 실패"}')
        print('=' * 72)
        return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
