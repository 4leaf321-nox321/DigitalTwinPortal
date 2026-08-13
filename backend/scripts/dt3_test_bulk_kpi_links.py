"""
과제-KPI 연결 **일괄 편집** API 시험 — 개발 DB 전용.

무엇을 지키려는가
    이 경로는 한 번에 수백 칸을 쓴다. "되는가" 보다 **"건드리면 안 될 것을
    안 건드리는가"** 가 시험의 대부분이다. 못 박는 것 다섯:

      · **안 보낸 칸은 그대로** — 이게 이 엔드포인트의 존재 이유다. 과제 하나짜리
        PUT 은 통째로 교체라, 그 의미가 일괄로 새면 고르지 않은 연결이 사라진다.
      · **append 가 기본** — 남이 적어 둔 기여방법이 소리 없이 없어지면 안 된다.
      · **dryRun 은 한 글자도 안 쓴다** — 미리보기를 믿고 누르는 화면이라 여기서
        새면 미리보기 자체가 거짓말이 된다.
      · **권한** — admin·dt_office 만. AI(PAT)는 어떤 토큰이어도 막힌다.
      · **대상 사업부 규칙** — 기능조직은 지목 필수, 사업부 과제는 자기 것 고정.
        일괄이면 한 번 틀릴 때 수십 건이 엉뚱한 사업부에 붙는다.

    시험 데이터는 MARK 가 붙은 과제만 만들고 끝나면 지운다.

사용법
    python scripts\\dt3_test_bulk_kpi_links.py
"""

from __future__ import annotations

import os
import sys
import uuid as uuidlib

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app                                          # noqa: E402
from app.extensions import db                                       # noqa: E402
from app.modules.auth import pat as pat_mod                         # noqa: E402
from app.modules.auth.models import User, UserRole                  # noqa: E402
from app.modules.digital_twin_dashboard.models_v2 import (          # noqa: E402
    Dt2Project, Dt2ProjectKpi, Dt2ProjectChange, Dt2ProjectHistory,
)
from app.modules.dx_kpi_management.models import KpiDefinition       # noqa: E402
from app.shared.auth import _G_KEY as PAT_G_KEY                     # noqa: E402
from flask import g as flask_g                                      # noqa: E402
from flask_jwt_extended import create_access_token                  # noqa: E402

MARK = '__dt3_bulkkpi__'
URL = '/api/dt-v2/kpi-links/bulk'
results = []


def check(desc, cond, extra=''):
    results.append((desc, bool(cond)))
    print(f"  {'[OK]  ' if cond else '[FAIL]'} {desc}"
          + (f"   {extra}" if not cond and extra else ''))


def auth(u):
    return {'Authorization': f'Bearer {create_access_token(identity=str(u.id))}',
            'X-DT2-Allow-Write': 'test'}


def mk_project(title, division, owner_id):
    u = str(uuidlib.uuid4())
    db.session.add(Dt2Project(uuid=u, code=f'{MARK}{title}', title=f'{MARK} {title}',
                              division=division, year=1901, status='진행중',
                              owner_user_id=owner_id))
    return u


def links_of(puid):
    return {(l.kpi_definition_id, l.target_division or ''): l
            for l in Dt2ProjectKpi.query.filter_by(project_uuid=puid).all()}


def methods(ln):
    return [x.strip() for x in str(ln.note or '').split('\n') if x.strip()]


def main():
    app = create_app()
    with app.app_context():
        from app.modules.digital_twin_dashboard.routes_v2 import _kpi_owner_divisions
        divs = _kpi_owner_divisions()
        owner = next((d for d in divs if d['isKpiOwner']), None)
        func = next((d for d in divs if not d['isKpiOwner']), None)
        other = next((d for d in divs if d['isKpiOwner'] and d['name'] != owner['name']), None)
        if not (owner and func and other):
            print('사업부 구성이 시험 전제와 다릅니다 (관리 사업부 2 + 기능조직 1 필요).')
            return 1

        # owner 가 관리하는 지표 둘 (전사 공통이거나 owner 범위)
        kds = [d for d in KpiDefinition.query.order_by(KpiDefinition.id).all()
               if not (d.divisions or []) or owner['code'] in (d.divisions or [])]
        if len(kds) < 2:
            print(f"{owner['name']} 이(가) 관리하는 지표가 2개 미만입니다.")
            return 1
        K1, K2 = kds[0].id, kds[1].id
        # owner 는 관리하지 않는 지표 (범위 밖 거절 확인용)
        K_out = next((d.id for d in KpiDefinition.query.all()
                      if (d.divisions or []) and owner['code'] not in (d.divisions or [])), None)

        print(f"\n대상: 사업부 {owner['name']} · 기능조직 {func['name']} · 지표 {K1},{K2}")

        admin = User(email=f'{MARK}a@t.local', name=f'{MARK} admin',
                     role=UserRole.ADMIN, is_active=True); admin.set_password('x' * 16)
        office = User(email=f'{MARK}o@t.local', name=f'{MARK} office',
                      role=UserRole.DT_OFFICE_MEMBER, is_active=True); office.set_password('x' * 16)
        plain = User(email=f'{MARK}u@t.local', name=f'{MARK} user',
                     role=UserRole.USER, is_active=True); plain.set_password('x' * 16)
        db.session.add_all([admin, office, plain]); db.session.flush()

        pa = mk_project('A', owner['name'], admin.id)
        pb = mk_project('B', owner['name'], admin.id)
        pf = mk_project('F', func['name'], admin.id)
        db.session.flush()

        # pa 에 **미리 연결 하나**를 둔다 — "안 보낸 칸은 그대로" 를 확인할 기준점
        db.session.add(Dt2ProjectKpi(project_uuid=pa, kpi_definition_id=K2,
                                     target_division=owner['name'], note='기존방법',
                                     relation_type='support', created_by=admin.id))
        db.session.commit()
        v_before = Dt2Project.query.filter_by(uuid=pa).first().row_version

        c = app.test_client()
        cell = lambda p, k, rel=None, ms=None, td=None: {
            'projectUuid': p, 'kpiDefinitionId': k, 'relationType': rel,
            'methods': ms or [], **({'targetDivision': td} if td else {})}

        # ── 권한 ───────────────────────────────────────────────────────────
        print('\n── 권한 ──')
        r = c.post(URL, json={'cells': [cell(pa, K1)]}, headers=auth(plain))
        check('일반 사용자는 403', r.status_code == 403, f'실제 {r.status_code}')
        r = c.post(URL, json={'cells': [cell(pa, K1)], 'dryRun': True}, headers=auth(office))
        check('dt_office 는 통과', r.status_code == 200, f'실제 {r.status_code}')

        # ── dryRun ────────────────────────────────────────────────────────
        print('\n── dryRun 은 쓰지 않는다 ──')
        r = c.post(URL, json={'dryRun': True, 'cells': [
            cell(pa, K1, 'primary', ['방법1']),
            cell(pb, K1, 'primary', ['방법1']),
        ]}, headers=auth(admin))
        d = r.get_json()['data']
        check('신규 2건으로 센다', d['summary']['created'] == 2, str(d['summary']))
        check('dryRun 뒤 DB 에 안 생겼다', (K1, owner['name']) not in links_of(pa))

        # ── 실제 적용 ──────────────────────────────────────────────────────
        print('\n── 적용 ──')
        r = c.post(URL, json={'cells': [
            cell(pa, K1, 'primary', ['방법1', '방법2']),
            cell(pb, K1, 'primary', ['방법1']),
        ]}, headers=auth(admin))
        d = r.get_json()['data']
        check('신규 2건', d['summary']['created'] == 2, str(d['summary']))
        la = links_of(pa)
        check('pa-K1 생겼다', (K1, owner['name']) in la)
        check('방법 2개', methods(la[(K1, owner['name'])]) == ['방법1', '방법2'])
        check('★ 안 보낸 pa-K2 는 그대로', (K2, owner['name']) in la
              and la[(K2, owner['name'])].relation_type == 'support'
              and methods(la[(K2, owner['name'])]) == ['기존방법'])
        check('row_version 올랐다',
              Dt2Project.query.filter_by(uuid=pa).first().row_version > v_before)

        # ── append / replace ──────────────────────────────────────────────
        print('\n── 기여방법 병합 ──')
        c.post(URL, json={'cells': [cell(pa, K1, 'primary', ['방법3'])]}, headers=auth(admin))
        check('★ append 는 기존을 남긴다',
              methods(links_of(pa)[(K1, owner['name'])]) == ['방법1', '방법2', '방법3'],
              str(methods(links_of(pa)[(K1, owner['name'])])))
        r = c.post(URL, json={'methodMode': 'replace',
                              'cells': [cell(pa, K1, 'primary', ['오직이것'])]},
                   headers=auth(admin))
        check('replace 는 갈아끼운다',
              methods(links_of(pa)[(K1, owner['name'])]) == ['오직이것'])

        # ── replace 로만 보내는 화면을 지킨다 ───────────────────────────────
        # BulkKpiLinkModal 은 최종 목록을 알고 있어 **늘 replace** 로 보낸다.
        # 그 대신 손대지 않은 칸도 현재 방법을 그대로 실어야 한다. 그 계약이 깨지면
        # 격자를 열어 보기만 해도 남의 기록이 지워진다 — 여기서 못 박는다.
        print('\n── 화면 계약: 늘 replace ──')
        c.post(URL, json={'methodMode': 'replace',
                          'cells': [cell(pa, K1, 'primary', ['가', '나'])]}, headers=auth(admin))
        r = c.post(URL, json={'dryRun': True, 'methodMode': 'replace',
                              'cells': [cell(pa, K1, 'primary', ['가', '나'])]},
                   headers=auth(admin))
        check("★ 그대로 다시 보내면 'unchanged'",
              r.get_json()['data']['summary']['unchanged'] == 1,
              str(r.get_json()['data']['rows']))
        r = c.post(URL, json={'dryRun': True, 'methodMode': 'replace',
                              'cells': [cell(pa, K1, 'primary', [])]}, headers=auth(admin))
        row = r.get_json()['data']['rows'][0]
        check('빈 목록을 보내면 지워진다고 **미리 말한다**',
              row['kind'] == 'methods' and '−2' in row['detail'], str(row))
        r = c.post(URL, json={'dryRun': True, 'methodMode': 'replace',
                              'cells': [cell(pa, K1, 'primary', ['가', '다'])]},
                   headers=auth(admin))
        row = r.get_json()['data']['rows'][0]
        check('늘고 주는 것을 함께 알린다',
              '+1' in row['detail'] and '−1' in row['detail'], str(row))

        # ── 분류 ──────────────────────────────────────────────────────────
        print('\n── 분류 ──')
        # ⚠️ 앞 블록이 pa-K1 을 ['가','나'] 로 바꿔 뒀다. 여기서 기대값을 박아 두면
        #    앞을 고칠 때마다 여기가 깨진다 — **지금 값을 읽어** 기준으로 쓴다.
        now = methods(links_of(pa)[(K1, owner['name'])])
        r = c.post(URL, json={'dryRun': True,
                              'cells': [cell(pa, K1, 'primary', now)]}, headers=auth(admin))
        check("같은 값이면 'unchanged'",
              r.get_json()['data']['summary']['unchanged'] == 1,
              f"현재 {now} / {r.get_json()['data']['rows']}")
        r = c.post(URL, json={'dryRun': True,
                              'cells': [cell(pa, K1, 'support', now)]}, headers=auth(admin))
        check("등급만 다르면 'relation'",
              r.get_json()['data']['summary']['relation'] == 1)
        r = c.post(URL, json={'dryRun': True,
                              'cells': [cell(pa, K1, 'primary', now + ['새방법'])]},
                   headers=auth(admin))
        check("방법만 늘면 'methods'",
              r.get_json()['data']['summary']['methods'] == 1)

        # ── 대상 사업부 ────────────────────────────────────────────────────
        print('\n── 대상 사업부 ──')
        r = c.post(URL, json={'dryRun': True, 'cells': [cell(pf, K1, 'primary')]},
                   headers=auth(admin))
        check('기능조직인데 대상 없으면 건너뜀',
              r.get_json()['data']['summary']['skipped'] == 1,
              str(r.get_json()['data']['rows']))
        r = c.post(URL, json={'dryRun': True,
                              'cells': [cell(pf, K1, 'primary', td=owner['name'])]},
                   headers=auth(admin))
        check('기능조직 + 대상 지목이면 생성', r.get_json()['data']['summary']['created'] == 1)
        r = c.post(URL, json={'dryRun': True,
                              'cells': [cell(pa, K1, 'primary', td=other['name'])]},
                   headers=auth(admin))
        check('사업부 과제에 남의 사업부 대상 → 건너뜀',
              r.get_json()['data']['summary']['skipped'] == 1)
        if K_out is not None:
            r = c.post(URL, json={'dryRun': True, 'cells': [cell(pa, K_out, 'primary')]},
                       headers=auth(admin))
            check('그 사업부가 관리 안 하는 지표 → 건너뜀',
                  r.get_json()['data']['summary']['skipped'] == 1)

        # ── 해제 ──────────────────────────────────────────────────────────
        # 유일하게 **지우는** 길이다. 칸마다 명시해야만 지워지고, 미리보기가
        # 무엇이 사라지는지 먼저 말해야 한다.
        print('\n── 연결 해제 ──')
        rm = dict(cell(pb, K1), remove=True)
        r = c.post(URL, json={'dryRun': True, 'cells': [rm]}, headers=auth(admin))
        row = r.get_json()['data']['rows'][0]
        check("dryRun 은 'removed' 로 세기만 한다",
              r.get_json()['data']['summary']['removed'] == 1 and '해제' in row['detail'],
              str(row))
        check('★ dryRun 뒤에도 연결은 살아 있다', (K1, owner['name']) in links_of(pb))
        r = c.post(URL, json={'cells': [rm]}, headers=auth(admin))
        check('적용하면 실제로 지워진다', (K1, owner['name']) not in links_of(pb),
              str(list(links_of(pb).keys())))
        r = c.post(URL, json={'dryRun': True, 'cells': [rm]}, headers=auth(admin))
        check("없는 연결 해제는 'unchanged'",
              r.get_json()['data']['summary']['unchanged'] == 1)
        # ★ 해제는 그 칸만. 같은 과제의 다른 연결이 말려들면 안 된다.
        check('★ 같은 과제의 다른 연결은 그대로',
              Dt2ProjectKpi.query.filter_by(project_uuid=pa).count() >= 2,
              f"pa 연결 {Dt2ProjectKpi.query.filter_by(project_uuid=pa).count()}건")

        # ── 방어 ──────────────────────────────────────────────────────────
        print('\n── 방어 ──')
        r = c.post(URL, json={'dryRun': True, 'cells': [
            cell(pa, K1, 'primary'), cell(pa, K1, 'support')]}, headers=auth(admin))
        check('같은 칸 두 번 → 하나는 건너뜀',
              r.get_json()['data']['summary']['skipped'] == 1)
        r = c.post(URL, json={'dryRun': True,
                              'cells': [cell(pb, K1, 'primary', ['가' * 320])]},
                   headers=auth(admin))
        check('300자 초과 → 건너뜀', r.get_json()['data']['summary']['skipped'] == 1)
        r = c.post(URL, json={'dryRun': True, 'cells': [cell(pa, K1, 'nope')]},
                   headers=auth(admin))
        check('잘못된 등급 → 건너뜀', r.get_json()['data']['summary']['skipped'] == 1)
        r = c.post(URL, json={'cells': []}, headers=auth(admin))
        check('빈 cells 는 400', r.status_code == 400, f'실제 {r.status_code}')

        # ── AI(PAT) ───────────────────────────────────────────────────────
        print('\n── AI 는 막힌다 ──')
        rec, plaintext = pat_mod.create_token(admin.id, f'{MARK} 시험용', expires_days=1)
        r = c.post(URL, json={'cells': [cell(pb, K2, 'primary')]},
                   headers={'Authorization': f'Bearer {plaintext}',
                            'X-DT2-Allow-Write': 'test'})
        check('★ PAT(admin 토큰이어도) 403', r.status_code == 403, f'실제 {r.status_code}')
        check('★ PAT 요청으로 아무것도 안 생겼다', (K2, owner['name']) not in links_of(pb))
        pat_mod.delete_token(admin.id, rec.id)
        # ⚠️ 시험 한정 정리 — PAT 인증이 g 에 사용자를 담아 두는데 이 스크립트는 앱
        #    컨텍스트를 한 번만 열어서, 안 지우면 뒤의 JWT 요청이 전부 그 사용자로
        #    보인다. 운영은 요청마다 컨텍스트가 새로 생겨 안 겪는다. (dt3_test 공통)
        flask_g.pop(PAT_G_KEY, None)

        # ── 정리 ──────────────────────────────────────────────────────────
        # ⚠️ 순서가 있다. 이 시험은 실제로 쓰기 때문에 **이력이 남고**, 그 이력이
        #    시험 사용자를 참조한다(dt2_project_changes.actor_user_id). 이력을 먼저
        #    지우지 않으면 사용자 삭제가 FK 위반으로 죽고, 다음 실행이 이메일 중복으로
        #    시작조차 못 한다.
        uids = [admin.id, office.id, plain.id]
        Dt2ProjectKpi.query.filter(
            Dt2ProjectKpi.project_uuid.in_([pa, pb, pf])).delete(synchronize_session=False)
        Dt2ProjectChange.query.filter(
            Dt2ProjectChange.actor_user_id.in_(uids)).delete(synchronize_session=False)
        Dt2ProjectHistory.query.filter(
            Dt2ProjectHistory.project_uuid.in_([pa, pb, pf])).delete(synchronize_session=False)
        Dt2Project.query.filter(Dt2Project.uuid.in_([pa, pb, pf])).delete(
            synchronize_session=False)
        User.query.filter(User.id.in_(uids)).delete(synchronize_session=False)
        db.session.commit()
        left = Dt2Project.query.filter(Dt2Project.title.like(f'{MARK}%')).count()
        check('시험 데이터 정리됨', left == 0, f'{left}건 남음')

    bad = [d for d, ok in results if not ok]
    print(f"\n{'=' * 60}\n{len(results) - len(bad)}/{len(results)} 통과")
    if bad:
        print('실패:'); [print('  -', d) for d in bad]
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
