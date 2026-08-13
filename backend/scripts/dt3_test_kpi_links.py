"""
과제 ↔ DX KPI 연결 시험 (2026-08-01) — 개발 DB 전용.

집중해서 보는 것 넷
    ① 연결/해제가 통째 교체(PUT)로 정확히 반영되는가
    ② 정렬이 `kpi_definitions.sort_order` 를 따르는가
       — 후보 목록과 연결 목록의 순서가 갈리면 사람이 대조할 수 없다
    ③ 잘못된 입력이 **400 으로** 떨어지는가 (FK 위반이 500 으로 새면 안 된다)
    ④ 연결이 남아 있는 KPI 정의를 지울 수 없는가
       — dx_kpi_management 의 삭제 라우트에 원래 가드가 없었다

시험용 과제를 만들어 쓰고 끝나면 지운다. 기존 행은 건드리지 않는다.

사용법
    python scripts\\dt3_test_kpi_links.py
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.extensions import db
from app.modules.auth.models import User, UserRole
from app.modules.digital_twin_dashboard.models_v2 import (
    Dt2Project, Dt2ProjectChange, Dt2ProjectHistory, Dt2ProjectKpi,
)
from app.modules.dx_kpi_management.models import KpiDefinition
from flask_jwt_extended import create_access_token

MARK = '__dt3_kpi_test__'
results = []


def check(desc, cond, extra=''):
    results.append((desc, bool(cond)))
    print(f"  {'[OK]  ' if cond else '[FAIL]'} {desc}" + (f"   {extra}" if not cond and extra else ''))


def auth(user):
    return {'Authorization': f'Bearer {create_access_token(identity=str(user.id))}',
            'X-DT2-Allow-Write': 'test'}


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    app = create_app()
    with app.app_context():
        client = app.test_client()
        proj_before = Dt2Project.query.count()
        link_before = Dt2ProjectKpi.query.count()

        admin = User.query.filter_by(role=UserRole.ADMIN, is_active=True).first()
        if admin is None:
            print('[FAIL] admin 사용자가 없습니다.')
            sys.exit(1)

        defs = (KpiDefinition.query
                .order_by(KpiDefinition.sort_order.asc(), KpiDefinition.id.asc())
                .all())
        if len(defs) < 3:
            print(f'[FAIL] KPI 정의가 {len(defs)}개뿐입니다. 시험하려면 3개 이상 필요합니다.')
            sys.exit(1)
        print(f'KPI 정의 {len(defs)}개 — 예: {", ".join(d.label for d in defs[:3])}')

        # KPI 연결은 대상 사업부를 요구한다 — 사업부 없는 과제는 연결할 수 없다
        # (그것 자체가 규칙이라 시험 과제에도 사업부를 준다).
        from app.modules.digital_twin_dashboard.models import Division
        owner_div = Division.query.filter_by(is_active=True, is_kpi_owner=True).first()
        if owner_div is None:
            print('[FAIL] KPI 를 관리하는 사업부가 없습니다.')
            sys.exit(1)
        print(f'시험 과제 사업부: {owner_div.name}')

        puid = None
        try:
            r = client.post('/api/dt-v2/projects',
                            json={'fields': {'title': f'{MARK} 과제', 'status': '미착수',
                                             'progress': 0, 'year': 2026,
                                             'division': owner_div.name}},
                            headers=auth(admin))
            if r.status_code != 201:
                print(f'[FAIL] 시험 과제 생성 실패 {r.status_code}: {r.get_data(as_text=True)[:200]}')
                sys.exit(1)
            puid = r.get_json()['data']['uuid']
            print(f'시험 과제 생성: {puid[:12]}')

            # ── 초기 조회 ────────────────────────────────────────────────
            print('\n── 초기 조회 ──')
            r = client.get(f'/api/dt-v2/projects/{puid}/kpi-links', headers=auth(admin))
            check('GET 200', r.status_code == 200, f'실제 {r.status_code}')
            d = r.get_json()['data']
            check('연결 없음', d['items'] == [])
            check('후보 목록을 같이 준다', len(d['available']) == len(defs),
                  f"{len(d['available'])} != {len(defs)}")
            check('canEdit true', d['canEdit'] is True)
            check('후보에 divisions 가 있다',
                  all('divisions' in a for a in d['available']))

            # ── 연결 ────────────────────────────────────────────────────
            print('\n── 연결 (3개) ──')
            # 일부러 sort_order 역순으로 보낸다 — 서버가 정렬해 돌려줘야 한다
            picked = [defs[2], defs[0], defs[1]]
            r = client.put(f'/api/dt-v2/projects/{puid}/kpi-links',
                           json={'items': [{'kpiDefinitionId': k.id} for k in picked]},
                           headers=auth(admin))
            check('PUT 200', r.status_code == 200,
                  f'실제 {r.status_code} {r.get_data(as_text=True)[:160]}')
            items = r.get_json()['data']['items']
            check('3건 저장', len(items) == 3, f'실제 {len(items)}')
            check('sort_order 순으로 정렬돼 나온다',
                  [i['kpiDefinitionId'] for i in items] == [defs[0].id, defs[1].id, defs[2].id],
                  str([i['kpiDefinitionId'] for i in items]))
            check('지표 이름이 함께 온다', items[0]['label'] == defs[0].label,
                  f"{items[0]['label']!r} != {defs[0].label!r}")

            # ── 변경 이력 ────────────────────────────────────────────────
            print('\n── 변경 이력 ──')
            r = client.get(f'/api/dt-v2/projects/{puid}/changes', headers=auth(admin))
            rows = [x for x in r.get_json()['data'] if x['field'] == 'kpi_links']
            check('kpi_links 변경이 기록됐다', len(rows) == 1, f'실제 {len(rows)}')
            if rows:
                check('한글 라벨이 붙는다', rows[0]['fieldLabel'] == 'DX KPI 연결',
                      repr(rows[0]['fieldLabel']))
                check('before 가 빈 목록', rows[0]['before'] == [])
                check('after 가 3건', len(rows[0]['after']) == 3)

            # ── 교체 (2건 + note) ────────────────────────────────────────
            print('\n── 교체 (2건 + 메모) ──')
            r = client.put(f'/api/dt-v2/projects/{puid}/kpi-links',
                           json={'items': [
                               {'kpiDefinitionId': defs[0].id, 'note': '가상검증 대상 확대'},
                               {'kpiDefinitionId': defs[1].id},
                           ]},
                           headers=auth(admin))
            check('PUT 200', r.status_code == 200, f'실제 {r.status_code}')
            items = r.get_json()['data']['items']
            check('2건으로 교체', len(items) == 2, f'실제 {len(items)}')
            check('메모 저장', items[0]['note'] == '가상검증 대상 확대', repr(items[0]['note']))
            check('메모 없는 쪽은 None', items[1]['note'] is None, repr(items[1]['note']))
            check('DB 실제 행 수도 2', Dt2ProjectKpi.query.filter_by(project_uuid=puid).count() == 2)

            # ── 같은 내용 재저장 → 이력이 늘지 않아야 한다 ──────────────
            print('\n── 같은 내용 재저장 ──')
            before_cnt = Dt2ProjectChange.query.filter_by(
                project_uuid=puid, field='kpi_links').count()
            client.put(f'/api/dt-v2/projects/{puid}/kpi-links',
                       json={'items': [
                           {'kpiDefinitionId': defs[0].id, 'note': '가상검증 대상 확대'},
                           {'kpiDefinitionId': defs[1].id},
                       ]},
                       headers=auth(admin))
            after_cnt = Dt2ProjectChange.query.filter_by(
                project_uuid=puid, field='kpi_links').count()
            check('내용이 같으면 이력을 남기지 않는다', before_cnt == after_cnt,
                  f'{before_cnt} -> {after_cnt}')

            # ── 화면이 실제로 보내는 모양 ────────────────────────────────
            # KpiLinkSection 의 toggle 은 메모가 없어도 `note: ''` 를 채워 보낸다.
            # 빈 문자열이 그대로 저장되면 화면에 빈 메모 칸이 열린 채로 보인다.
            print('\n── 화면이 보내는 모양 (note: "") ──')
            r = client.put(f'/api/dt-v2/projects/{puid}/kpi-links',
                           json={'items': [
                               {'kpiDefinitionId': defs[0].id, 'note': ''},
                               {'kpiDefinitionId': defs[2].id, 'note': '  공백만  '},
                           ]},
                           headers=auth(admin))
            check('PUT 200', r.status_code == 200, f'실제 {r.status_code}')
            items = r.get_json()['data']['items']
            check('빈 문자열 메모는 None 으로 저장', items[0]['note'] is None,
                  repr(items[0]['note']))
            check('메모 앞뒤 공백은 잘린다', items[1]['note'] == '공백만',
                  repr(items[1]['note']))

            # 되돌리기 — 아래 잘못된 입력 시험이 2건을 전제로 한다
            client.put(f'/api/dt-v2/projects/{puid}/kpi-links',
                       json={'items': [
                           {'kpiDefinitionId': defs[0].id, 'note': '가상검증 대상 확대'},
                           {'kpiDefinitionId': defs[1].id},
                       ]},
                       headers=auth(admin))

            # ── 잘못된 입력 ─────────────────────────────────────────────
            print('\n── 잘못된 입력 (전부 400 이어야 한다) ──')
            bad = [
                ('없는 KPI id', {'items': [{'kpiDefinitionId': 999999}]}),
                ('중복 연결', {'items': [{'kpiDefinitionId': defs[0].id},
                                      {'kpiDefinitionId': defs[0].id}]}),
                ('정수가 아닌 id', {'items': [{'kpiDefinitionId': 'abc'}]}),
                ('items 가 배열이 아님', {'items': 'x'}),
                ('원소가 객체가 아님', {'items': [1, 2]}),
                ('expected_version 이 정수가 아님',
                 {'items': [], 'expected_version': 'x'}),
            ]
            for desc, payload in bad:
                r = client.put(f'/api/dt-v2/projects/{puid}/kpi-links',
                               json=payload, headers=auth(admin))
                check(f'{desc} → 400', r.status_code == 400, f'실제 {r.status_code}')

            check('실패한 요청이 기존 연결을 지우지 않았다',
                  Dt2ProjectKpi.query.filter_by(project_uuid=puid).count() == 2)

            # ── 낙관적 락 ───────────────────────────────────────────────
            print('\n── 낙관적 락 ──')
            cur = Dt2Project.query.filter_by(uuid=puid).first().row_version
            r = client.put(f'/api/dt-v2/projects/{puid}/kpi-links',
                           json={'items': [], 'expected_version': cur - 1},
                           headers=auth(admin))
            check('버전이 어긋나면 409', r.status_code == 409, f'실제 {r.status_code}')
            r = client.put(f'/api/dt-v2/projects/{puid}/kpi-links',
                           json={'items': [{'kpiDefinitionId': defs[0].id}],
                                 'expected_version': cur},
                           headers=auth(admin))
            check('맞는 버전이면 통과', r.status_code == 200, f'실제 {r.status_code}')

            # ── AI 경로 ─────────────────────────────────────────────────
            #
            # ⚠️ **2026-08-12 규칙이 바뀌었다.** 예전에는 `actor_mode='ai'` 가
            #    **403**(금지)이었다. 지금은 **근거를 붙이면 202**(확인 대기)로 가고
            #    사람이 승인해야 반영된다 — 막았던 이유를 금지가 아니라
            #    근거+승인으로 풀었다. 자세한 것은 `dt3_test_kpi_ai_propose.py`.
            print('\n── AI 는 즉시 반영되지 않는다 ──')
            r = client.put(f'/api/dt-v2/projects/{puid}/kpi-links',
                           json={'items': [], 'actor_mode': 'ai'}, headers=auth(admin))
            check('★ 근거가 없으면 400 (제안조차 안 만든다)',
                  r.status_code == 400, f'실제 {r.status_code}')
            r = client.put(f'/api/dt-v2/projects/{puid}/kpi-links',
                           json={'items': [], 'actor_mode': 'ai',
                                 'reason': '연결을 정리한다'}, headers=auth(admin))
            check('★★ 근거가 있으면 202 (즉시 반영이 아니다)',
                  r.status_code == 202, f'실제 {r.status_code}')

            # ── 대상 사업부 규칙 ────────────────────────────────────────
            # DX KPI 는 (지표 × 사업부) 로 측정된다. 연결이 '누구의 지표' 인지 지목해야
            # 기능조직(GTR·SR·CS)의 기여가 지원 대상 사업부 칸에 잡힌다.
            print('\n── 대상 사업부 ──')
            from app.modules.digital_twin_dashboard.models import Division
            owners = [d.name for d in Division.query.filter_by(is_active=True, is_kpi_owner=True)]
            funcs = [d.name for d in Division.query.filter_by(is_active=True, is_kpi_owner=False)]
            check('KPI 보유 사업부가 있다', len(owners) > 0, str(owners))
            check('기능조직이 구분돼 있다', len(funcs) > 0, str(funcs))

            r = client.get(f'/api/dt-v2/projects/{puid}/kpi-links', headers=auth(admin))
            g = r.get_json()['data']
            check('divisions 에 code 가 온다 (프론트가 매핑표를 복제하지 않게)',
                  all('code' in x for x in g['divisions']))
            check('의료기기 → medical 매핑',
                  next((x['code'] for x in g['divisions'] if x['name'] == '의료기기'), None) == 'medical')

            proj = Dt2Project.query.filter_by(uuid=puid).first()
            check(f'시험 과제({proj.division})는 기능조직이 아니다',
                  g['isFunctionalOrg'] is False)
            check('자기 사업부가 기본 대상', g['defaultTargets'] == [proj.division],
                  str(g['defaultTargets']))
            check('연결에 targetDivision 이 실린다',
                  all(i['targetDivision'] == proj.division for i in g['items']),
                  str([i['targetDivision'] for i in g['items']]))

            # 사업부 과제가 남의 사업부를 대상으로 → 400
            other = next((o for o in owners if o != proj.division), None)
            if other:
                r = client.put(f'/api/dt-v2/projects/{puid}/kpi-links',
                               json={'items': [{'kpiDefinitionId': defs[0].id,
                                                'targetDivision': other}]},
                               headers=auth(admin))
                check('사업부 과제가 남의 사업부 대상 → 400', r.status_code == 400,
                      f'실제 {r.status_code}')

            # 기능조직이 아닌 사업부를 대상으로 → 400
            if funcs:
                r = client.put(f'/api/dt-v2/projects/{puid}/kpi-links',
                               json={'items': [{'kpiDefinitionId': defs[0].id,
                                                'targetDivision': funcs[0]}]},
                               headers=auth(admin))
                check(f'{funcs[0]}(기능조직) 대상 → 400', r.status_code == 400,
                      f'실제 {r.status_code}')

            # 사업부 전용 지표를 엉뚱한 대상으로 → 400
            scoped = next((d for d in defs if d.divisions), None)
            if scoped:
                bad = next((o for o in owners
                            if o not in [x['name'] for x in g['divisions']
                                         if x['code'] in scoped.divisions]), None)
                if bad:
                    r = client.put(f'/api/dt-v2/projects/{puid}/kpi-links',
                                   json={'items': [{'kpiDefinitionId': scoped.id,
                                                    'targetDivision': bad}]},
                                   headers=auth(admin))
                    check(f'{scoped.label}({scoped.divisions}) 을 {bad} 대상으로 → 400',
                          r.status_code == 400, f'실제 {r.status_code}')

            # 되돌리기 — 아래 삭제 가드 시험이 연결 존재를 전제로 한다
            client.put(f'/api/dt-v2/projects/{puid}/kpi-links',
                       json={'items': [{'kpiDefinitionId': defs[0].id}]},
                       headers=auth(admin))
            check('대상을 안 보내도 자기 사업부로 채워진다',
                  (Dt2ProjectKpi.query.filter_by(project_uuid=puid).first()
                   .target_division) == proj.division)

            # ── 기능조직 과제 (이 변경의 핵심) ──────────────────────────
            # GTR·SR·CS 는 자기 지표가 없다. 이들의 과제는 **지원할 사업부를
            # 지목**해야 하고, 그 기여는 지원 대상 사업부의 칸에 잡혀야 한다.
            if funcs:
                print('\n── 기능조직 과제 ──')
                r = client.post('/api/dt-v2/projects',
                                json={'fields': {'title': f'{MARK} 기능조직 과제',
                                                 'status': '미착수', 'progress': 0,
                                                 'year': 2026, 'division': funcs[0]}},
                                headers=auth(admin))
                check('기능조직 과제 생성 201', r.status_code == 201, f'실제 {r.status_code}')
                fuid = r.get_json()['data']['uuid']

                g2 = client.get(f'/api/dt-v2/projects/{fuid}/kpi-links',
                                headers=auth(admin)).get_json()['data']
                check(f'{funcs[0]} 과제는 기능조직으로 판정', g2['isFunctionalOrg'] is True)
                check('기본 대상이 비어 있다 (직접 골라야 한다)',
                      g2['defaultTargets'] == [], str(g2['defaultTargets']))

                # 대상 없이 저장 → 400
                r = client.put(f'/api/dt-v2/projects/{fuid}/kpi-links',
                               json={'items': [{'kpiDefinitionId': defs[0].id}]},
                               headers=auth(admin))
                check('대상을 안 고르면 400', r.status_code == 400, f'실제 {r.status_code}')

                # 두 사업부를 동시에 지원 — 같은 지표, 다른 대상 → 2행
                two = owners[:2]
                r = client.put(f'/api/dt-v2/projects/{fuid}/kpi-links',
                               json={'items': [
                                   {'kpiDefinitionId': defs[0].id, 'targetDivision': two[0]},
                                   {'kpiDefinitionId': defs[0].id, 'targetDivision': two[1]},
                               ]},
                               headers=auth(admin))
                check(f'같은 지표를 {two[0]}·{two[1]} 두 대상으로 → 200',
                      r.status_code == 200,
                      f'실제 {r.status_code} {r.get_data(as_text=True)[:140]}')
                check('2행으로 저장',
                      Dt2ProjectKpi.query.filter_by(project_uuid=fuid).count() == 2)

                # 같은 지표 + 같은 대상 중복 → 400
                r = client.put(f'/api/dt-v2/projects/{fuid}/kpi-links',
                               json={'items': [
                                   {'kpiDefinitionId': defs[0].id, 'targetDivision': two[0]},
                                   {'kpiDefinitionId': defs[0].id, 'targetDivision': two[0]},
                               ]},
                               headers=auth(admin))
                check('같은 지표+같은 대상 중복 → 400', r.status_code == 400,
                      f'실제 {r.status_code}')

                # ★ 매트릭스에서 기능조직 기여가 **지원 대상 칸**에 잡히는가
                m = client.get('/api/dt-v2/kpi-matrix?year=2026',
                               headers=auth(admin)).get_json()['data']
                mine = [l for l in m['links'] if l[0] == fuid]
                check('매트릭스 링크가 대상 사업부를 실어 온다',
                      sorted(l[2] for l in mine) == sorted(two), str(mine))
                check('기능조직은 매트릭스 열이 아니다',
                      all(not d['isKpiOwner'] for d in m['divisions']
                          if d['name'] in funcs))
                check('과제 소속(기능조직)이 아니라 대상으로 집계된다',
                      all(l[2] not in funcs for l in mine), str(mine))

                Dt2ProjectKpi.query.filter_by(project_uuid=fuid).delete()
                Dt2ProjectChange.query.filter_by(project_uuid=fuid).delete()
                Dt2ProjectHistory.query.filter_by(project_uuid=fuid).delete()
                Dt2Project.query.filter_by(uuid=fuid).delete()
                db.session.commit()

            # ── KPI 정의 삭제 가드 ──────────────────────────────────────
            print('\n── KPI 정의 삭제 가드 ──')
            r = client.delete(f'/api/dx-kpi-management/kpi-definitions/{defs[0].id}')
            check('연결이 있으면 삭제 거부', r.status_code >= 400, f'실제 {r.status_code}')
            body = r.get_data(as_text=True)
            check('사람이 읽을 이유를 준다 (500 아님)',
                  r.status_code != 500 and '연결된' in body, body[:160])
            check('KPI 정의가 살아 있다',
                  KpiDefinition.query.get(defs[0].id) is not None)

            # ── 과제 삭제 시 연결도 함께 (CASCADE) ──────────────────────
            print('\n── 과제 물리 삭제 시 연결 CASCADE ──')
            Dt2ProjectChange.query.filter_by(project_uuid=puid).delete()
            Dt2ProjectHistory.query.filter_by(project_uuid=puid).delete()
            Dt2Project.query.filter_by(uuid=puid).delete()
            db.session.commit()
            check('과제가 지워지면 연결도 지워진다',
                  Dt2ProjectKpi.query.filter_by(project_uuid=puid).count() == 0)
            puid = None

        finally:
            print('\n── 정리 ──')
            if puid:
                Dt2ProjectKpi.query.filter_by(project_uuid=puid).delete()
                Dt2ProjectChange.query.filter_by(project_uuid=puid).delete()
                Dt2ProjectHistory.query.filter_by(project_uuid=puid).delete()
                Dt2Project.query.filter_by(uuid=puid).delete()
                db.session.commit()
            check('과제 건수 불변', Dt2Project.query.count() == proj_before,
                  f'{proj_before} -> {Dt2Project.query.count()}')
            check('연결 건수 불변', Dt2ProjectKpi.query.count() == link_before,
                  f'{link_before} -> {Dt2ProjectKpi.query.count()}')
            check('KPI 정의 건수 불변', KpiDefinition.query.count() == len(defs),
                  f'{len(defs)} -> {KpiDefinition.query.count()}')

        failed = [d for d, ok in results if not ok]
        print('\n' + '=' * 72)
        if failed:
            print(f' 결과: [FAIL] {len(failed)}건 실패')
            for d in failed:
                print(f'   - {d}')
            print('=' * 72)
            sys.exit(1)
        print(f' 결과: [OK] {len(results)}건 전부 통과')
        print('=' * 72)


if __name__ == '__main__':
    main()
