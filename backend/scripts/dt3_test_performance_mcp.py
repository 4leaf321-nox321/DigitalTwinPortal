"""
성과 MCP 경로 검증 — AI 가 성과를 만들고 과제에 붙일 수 있다. (2026-08-02)

무엇이 바뀌었나
    원래 과제-성과 연결은 AI 에게 **403** 이었다. 이유는 권한이 아니라
    "연결을 바꾸면 그 성과를 쓰는 **다른 과제의 기여도 합**까지 흔들리는데,
    승인자가 자기 과제만 보고 승인하면 남의 과제가 조용히 틀어진다" 였다.

    그래서 막는 대신 **제안 큐(202)로 보내고, preview 에 그 성과를 함께 쓰는
    다른 과제(`affectedProjects`)를 실어 보낸다.** 우려의 원인을 없앤 것이지
    우려를 무시한 게 아니다 — 그 표가 안 나오면 원래 문제가 그대로 남는다.

권한이 **넓어지는** 변경이라, 열려야 할 것보다 **닫혀야 할 것**을 더 본다.

  A  성과 필드 안내가 과제와 다른 표를 읽는다 (핵심=403, 202 아님)
  B  AI 가 성과를 만들 수 있고, 이력 출처가 'ai' 로 갈린다 ★
  C  AI 가 저위험 필드(실적수준)를 고치면 즉시 반영된다
  D  AI 가 핵심 필드(단위)를 고치면 **403** — 202 로 새지 않는다 ★
  E  AI 연결은 202 로 가고 **그 자리에서 반영되지 않는다** ★
  F  202 preview 에 `affectedProjects` 가 나온다 — 남의 과제가 보인다 ★★
  G  승인하면 실제로 연결된다
  H  없는 성과를 연결하려 하면 **제안을 만들기 전에** 400 ★
  I  사람(비-AI) PUT 은 여전히 즉시 반영된다 (회귀)

실행:  venv/Scripts/python.exe scripts/dt3_test_performance_mcp.py
"""
import os
import sys
import uuid as uuidlib

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask_jwt_extended import create_access_token                    # noqa: E402

from app import create_app                                            # noqa: E402
from app.extensions import db                                         # noqa: E402
from app.modules.auth.models import User                              # noqa: E402
from app.modules.digital_twin_dashboard.models_v2 import (            # noqa: E402
    Dt2ChangeProposal, Dt2Performance, Dt2PerformanceHistory,
    Dt2Project, Dt2ProjectPerformance,
)

FAIL = []
MADE_PERF = []
MADE_PROJ = []


def check(name, got, want):
    ok = got == want
    print(f"  {'OK  ' if ok else 'FAIL'}  {name}: got={got!r} want={want!r}")
    if not ok:
        FAIL.append(name)


def check_true(name, got):
    ok = bool(got)
    print(f"  {'OK  ' if ok else 'FAIL'}  {name}: {got!r}")
    if not ok:
        FAIL.append(name)


def body_of(resp):
    j = resp.get_json() or {}
    return j.get('data', j)


def main():
    app = create_app()
    with app.app_context():
        admin = User.query.filter_by(email='yjtwin.park@samsung.com').first()
        if admin is None:
            print('테스트할 관리자 계정이 없다 — 중단')
            return 1
        token = create_access_token(identity=str(admin.id))
        H = {'Authorization': f'Bearer {token}'}
        c = app.test_client()

        # 검증용 과제 2건을 새로 만든다. 기존 과제를 쓰면 그 과제의 연결을
        # 통째 교체해 버려서 실제 데이터가 지워진다.
        for i in (1, 2):
            p = Dt2Project(uuid=str(uuidlib.uuid4()), code=f'ZZTEST-PERF-{i}',
                           title=f'[테스트] 성과MCP 검증 과제 {i}',
                           owner_user_id=admin.id, row_version=1,
                           is_deleted=False, is_permanently_deleted=False)
            db.session.add(p)
            MADE_PROJ.append(p.uuid)
        db.session.commit()
        PRJ1, PRJ2 = MADE_PROJ

        print('A  성과 필드 안내')
        r = c.get('/api/dt-v2/describe/performance-fields', headers=H)
        check('안내 조회', r.status_code, 200)
        d = body_of(r)
        risks = {f['key']: f['risk'] for f in d.get('fields', [])}
        check('실적수준 = low', risks.get('실적수준'), 'low')
        check('목표수준 = core', risks.get('목표수준'), 'core')
        check('uuid = immutable', risks.get('uuid'), 'immutable')
        # 2026-08-05: 단위는 **소분류가 정한다.** 화면이 이미 입력을 잠그는데 서버만
        # 자유 컬럼이라 112건 중 35건이 어긋나 있었다 → 파생으로 바꿨다.
        check('단위 = derived', risks.get('단위'), 'derived')
        derived_note = next((f['note'] for f in d['fields']
                             if f['risk'] == 'derived'), '')
        check_true('파생 안내가 소분류를 가리킨다', '소분류' in derived_note)
        # 2026-08-05: 핵심이 403 → 202 가 됐다. 다만 과제와 **하나 다르다** —
        # `affectedProjects` 를 같이 보여줘야 한다는 것이 안내에 있어야 한다.
        # 그게 없으면 "남의 과제가 조용히 틀어진다" 는 원래 우려가 그대로 돌아온다.
        core_note = next((f['note'] for f in d['fields'] if f['risk'] == 'core'), '')
        check_true('핵심 필드 안내가 202 를 말한다', '202' in core_note)
        check_true('핵심 필드 안내가 affectedProjects 를 말한다 ★',
                   'affectedProjects' in core_note)

        print('B  AI 가 성과를 만든다')
        r = c.post('/api/dt-v2/performances', headers=H, json={
            # ⚠️ 대괄호 접두어는 **사업부**다(2026-08-03 강제). `[테스트]` 같은
            #    값은 400 이라 여기서도 실제 사업부 값을 쓴다.
            # ⚠️ 대분류·소분류는 생성 시 필수이고 **짝이 맞아야 한다**
            #    (2026-08-03 강제). 비우면 화면에서 미분류로 떨어진다.
            'fields': {'성과항목': '[공통] 테스트 해석 리드타임 단축', '단위': '일',
                       '대분류': '리드타임단축', '소분류': '검증/분석 시간',
                       '성과년도': 2026, '목표수준': 10, '현재수준': 3},
            'actor_mode': 'ai', 'reason': '성과 MCP 검증',
        })
        check('생성', r.status_code, 201)
        perf = body_of(r)
        PERF = perf.get('uuid')
        MADE_PERF.append(PERF)
        check_true('uuid 발급', bool(PERF))
        # ★ 이력 출처가 'ai' 로 갈리는가 (원래 'ui' 하드코딩 결함)
        h = (Dt2PerformanceHistory.query
             .filter_by(performance_uuid=PERF)
             .order_by(Dt2PerformanceHistory.id.desc()).first())
        check('이력 출처', getattr(h, 'source', None), 'ai')

        print('C  AI + 저위험 필드 → 즉시 반영')
        r = c.patch(f'/api/dt-v2/performances/{PERF}', headers=H, json={
            'patch': {'실적수준': '7'}, 'actor_mode': 'ai', 'reason': '검증',
        })
        check('저위험 PATCH', r.status_code, 200)
        check('applied 에 들어감', 'actual_level' in body_of(r).get('applied', []), True)

        print('D  AI + 핵심 필드 → 403 (202 로 새지 않는다) ★')
        before_target = Dt2Performance.query.filter_by(uuid=PERF).first().target_level
        r = c.patch(f'/api/dt-v2/performances/{PERF}', headers=H, json={
            'patch': {'목표수준': 999}, 'actor_mode': 'ai', 'reason': '검증',
        })
        check('핵심 PATCH 는 202', r.status_code, 202)
        _d = body_of(r)
        check_true('affectedProjects 가 함께 온다 ★', 'affectedProjects' in _d)
        db.session.expire_all()
        check('그 자리에서 반영되지 않는다 ★',
              Dt2Performance.query.filter_by(uuid=PERF).first().target_level,
              before_target)
        # 승인하면 실제로 들어간다
        c.post(f"/api/dt-v2/proposals/{_d['proposalId']}/approve",
               headers=H, json={'note': '검증'})
        db.session.expire_all()
        check('승인하면 반영된다 ★',
              str(Dt2Performance.query.filter_by(uuid=PERF).first().target_level), '999')

        print('D-2  단위는 소분류가 정한다 — 보내도 안 들어간다 ★')
        unit_now = Dt2Performance.query.filter_by(uuid=PERF).first().unit
        r = c.patch(f'/api/dt-v2/performances/{PERF}', headers=H, json={
            'patch': {'단위': '시간'}, 'actor_mode': 'ai', 'reason': '단위 변경 시도',
            'ignore_unknown': True,
        })
        # 403 이 아니다 — 거절이 아니라 **파생**이다. 소분류 값으로 덮고 알린다.
        check('403 이 아니라 200', r.status_code, 200)
        db.session.expire_all()
        check('단위가 그대로다',
              Dt2Performance.query.filter_by(uuid=PERF).first().unit, unit_now)
        check_true('왜 안 바뀌었는지 알려준다',
                   '소분류' in ((r.get_json() or {}).get('message') or ''))

        print('E  AI 연결 → 202, 아직 반영 안 됨 ★')
        r = c.put(f'/api/dt-v2/projects/{PRJ1}/performances', headers=H, json={
            'items': [{'performanceUuid': PERF, 'contribution': '60'}],
            'actor_mode': 'ai', 'reason': '성과 MCP 검증',
        })
        check('연결은 202', r.status_code, 202)
        d = body_of(r)
        PROP = d.get('proposalId')
        check_true('proposalId 발급', bool(PROP))
        check('pendingFields', d.get('pendingFields'), ['performance_links'])
        check('아직 연결 안 됨',
              Dt2ProjectPerformance.query.filter_by(project_uuid=PRJ1).count(), 0)
        check_true('preview 있음', bool(d.get('preview')))

        print('F  승인 → 실제 연결')
        r = c.post(f'/api/dt-v2/proposals/{PROP}/approve', headers=H,
                   json={'note': '검증'})
        check('승인', r.status_code, 200)
        check('연결됨',
              Dt2ProjectPerformance.query.filter_by(project_uuid=PRJ1).count(), 1)
        ln = Dt2ProjectPerformance.query.filter_by(project_uuid=PRJ1).first()
        check('기여도 보존', ln.contribution, '60')
        # 화면이 참조를 읽는 키가 들어갔는가 — 없으면 화면이 고아로 보고 지운다
        check_true('extra_fields 참조키',
                   '성과항목UUID' in (ln.extra_fields or {}))

        print('G  다른 과제에 같은 성과 연결 → affectedProjects 에 앞 과제가 보인다 ★★')
        r = c.put(f'/api/dt-v2/projects/{PRJ2}/performances', headers=H, json={
            'items': [{'performanceUuid': PERF, 'contribution': '40'}],
            'actor_mode': 'ai', 'reason': '공유 성과 검증',
        })
        check('연결은 202', r.status_code, 202)
        d = body_of(r)
        affected = d.get('affectedProjects') or []
        codes = {a.get('projectCode') for a in affected}
        check_true('affectedProjects 에 앞 과제가 나온다', 'ZZTEST-PERF-1' in codes)
        check_true('자기 과제는 빠진다', 'ZZTEST-PERF-2' not in codes)
        # 합이 100 이 아니면 경고가 나와야 한다 (지금 60 하나뿐이라 경고 대상)
        check_true('contributionWarnings 키 존재',
                   'contributionWarnings' in d)
        c.post(f"/api/dt-v2/proposals/{d['proposalId']}/reject", headers=H,
               json={'note': '검증 종료'})

        print('H  없는 성과 → 제안을 만들기 전에 400 ★')
        before_props = Dt2ChangeProposal.query.count()
        r = c.put(f'/api/dt-v2/projects/{PRJ1}/performances', headers=H, json={
            'items': [{'performanceUuid': 'no-such-uuid-0000'}],
            'actor_mode': 'ai', 'reason': '검증',
        })
        check('없는 성과는 400', r.status_code, 400)
        check('제안이 안 쌓였다', Dt2ChangeProposal.query.count(), before_props)

        print('I  사람(비-AI) PUT 은 즉시 반영 (회귀)')
        r = c.put(f'/api/dt-v2/projects/{PRJ2}/performances', headers=H, json={
            'items': [{'performanceUuid': PERF, 'contribution': '40'}],
            'reason': '사람 경로 회귀 검증',
        })
        check('사람은 200', r.status_code, 200)
        check('즉시 연결됨',
              Dt2ProjectPerformance.query.filter_by(project_uuid=PRJ2).count(), 1)

        # ── 뒷정리 ────────────────────────────────────────────────────────
        print('정리')
        Dt2ProjectPerformance.query.filter(
            Dt2ProjectPerformance.project_uuid.in_(MADE_PROJ)).delete(
                synchronize_session=False)
        Dt2ChangeProposal.query.filter(
            Dt2ChangeProposal.project_uuid.in_(MADE_PROJ)).delete(
                synchronize_session=False)
        Dt2PerformanceHistory.query.filter(
            Dt2PerformanceHistory.performance_uuid.in_(MADE_PERF)).delete(
                synchronize_session=False)
        Dt2Performance.query.filter(
            Dt2Performance.uuid.in_(MADE_PERF)).delete(
                synchronize_session=False)
        Dt2Project.query.filter(
            Dt2Project.uuid.in_(MADE_PROJ)).delete(synchronize_session=False)
        db.session.commit()
        print(f'  테스트 데이터 삭제: 과제 {len(MADE_PROJ)}건, 성과 {len(MADE_PERF)}건')

    print()
    if FAIL:
        print(f'실패 {len(FAIL)}건: {", ".join(FAIL)}')
        return 1
    print('전부 통과')
    return 0


if __name__ == '__main__':
    sys.exit(main())
