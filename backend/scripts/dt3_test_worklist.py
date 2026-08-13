"""
「내 일」 화면 시험 (2026-08-11) — 개발 DB 전용.

무엇을 지키려는 시험인가
    이 기능의 위험은 **권한이 새는 것**과 **렌즈가 뜻을 잃는 것** 둘이다.

    ★ 남의 과제가 내 목록에 들어오면 안 된다 (렌즈가 곧 권한 경계다)
    ★ manager 의 「내가 하는 일」이 **사업부 전체가 되면 안 된다**
      — `can_edit_project` 를 쓰면 그렇게 된다. 이 시험이 그 실수를 막는다
    ★ viewer 는 「내 일」 자체가 없다
    ★ 「나중에」는 **자기 것만** 가려야 한다 (남의 미룸이 내 목록에 영향 X)
    ★ 기한 지난 항목은 **연도를 무시한다** (작년 것도 지금 할 일)
    ★ summary 는 급한 카드만 세지만 그 숫자는 전체와 **같아야** 한다

사용법
    python scripts\\dt3_test_worklist.py
"""

from __future__ import annotations

import os
import sys
import uuid as uuidlib
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.extensions import db
from app.modules.auth.models import User, UserRole
from app.modules.digital_twin_dashboard import permissions as P
from app.modules.digital_twin_dashboard import worklist as WL
from app.modules.digital_twin_dashboard.models import Department, Division
from app.modules.digital_twin_dashboard.models_v2 import (
    Dt2ChangeProposal, Dt2Project, Dt2ProjectChange, Dt2ProjectHistory,
    Dt2ProjectPerformance, Dt2WorklistDismissal,
)
from flask_jwt_extended import create_access_token
from sqlalchemy import or_

MARK = '__dt3_wl__'
results = []


def check(desc, cond, extra=''):
    results.append((desc, bool(cond)))
    print(f"  {'[OK]  ' if cond else '[FAIL]'} {desc}"
          + (f'   {extra}' if not cond and extra else ''))


def auth(u):
    return {'Authorization': f'Bearer {create_access_token(identity=str(u.id))}',
            'X-DT2-Allow-Write': 'test'}


def card(data, key):
    for c in data.get('cards') or []:
        if c['key'] == key:
            return c
    return None


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    app = create_app()
    with app.app_context():
        client = app.test_client()
        n_proj, n_user = Dt2Project.query.count(), User.query.count()
        made, puids = [], []

        # manager 렌즈를 시험하려면 실재하는 사업부·부서가 있어야 한다
        dept = (Department.query.filter(Department.is_active.is_(True),
                                        Department.division_id.isnot(None)).first())
        div_id = dept.division_id if dept else None

        def mk(tag, role=UserRole.USER, department=None):
            u = User(email=f'{MARK}{tag}@t.local', name=f'{MARK}{tag}',
                     role=role, is_active=True, department=department)
            u.set_password('x' * 16)
            db.session.add(u); db.session.commit()
            made.append(u)
            return u

        def mkproj(tag, **cols):
            uid = str(uuidlib.uuid4())
            base = dict(uuid=uid, code=f'{MARK}{tag}', title=f'{MARK} {tag}',
                        status='정상진행', progress=0, row_version=1,
                        extra_fields={}, is_deleted=False,
                        is_permanently_deleted=False, year=2026)
            base.update(cols)
            db.session.add(Dt2Project(**base)); db.session.commit()
            puids.append(uid)
            return uid

        try:
            mine_user = mk('mine')
            other = mk('other')
            viewer = mk('viewer', role=UserRole.VIEWER)
            mgr = mk('mgr', role=UserRole.MANAGER,
                     department=dept.name if dept else None)

            knox = f'{MARK}mine'          # 이메일 @앞부분
            past = (datetime.utcnow() - timedelta(days=40)).strftime('%Y-%m-%d')

            # 내 과제 — PL 이고 기한 지난 액션아이템이 하나 있다
            a_uuid = str(uuidlib.uuid4())
            p_mine = mkproj('mine', pl_knox_id=knox, action_items_json=[
                {'uuid': a_uuid, '제목': f'{MARK} 늦은 항목',
                 '목표일': past, '완료여부': False}])
            # 남의 과제 — 같은 모양이지만 나와 무관하다
            p_other = mkproj('other', pl_knox_id=f'{MARK}other',
                             action_items_json=[
                                 {'uuid': str(uuidlib.uuid4()),
                                  '제목': f'{MARK} 남의 늦은 항목',
                                  '목표일': past, '완료여부': False}])
            # 작년 과제 — 연도 필터를 무시하는지 본다
            b_uuid = str(uuidlib.uuid4())
            p_last = mkproj('last', year=2025, pl_knox_id=knox, action_items_json=[
                {'uuid': b_uuid, '제목': f'{MARK} 작년에 안 끝난 것',
                 '목표일': past, '완료여부': False}])

            # ── 1. 렌즈 ────────────────────────────────────────────────────
            print('\n── 1. 렌즈 ──')
            check('일반 사용자는 mine 만', WL.available_lenses(mine_user) == ['mine'],
                  f'{WL.available_lenses(mine_user)}')
            check('viewer 는 렌즈가 없다', WL.available_lenses(viewer) == [])
            if div_id:
                check('manager 는 division 도',
                      'division' in WL.available_lenses(mgr),
                      f'{WL.available_lenses(mgr)}')
                check('manager 기본 렌즈는 division',
                      WL.default_lens(mgr) == 'division', WL.default_lens(mgr))
            check('일반 사용자 기본 렌즈는 mine', WL.default_lens(mine_user) == 'mine')

            # ── 2. 내 것만 들어오는가 ──────────────────────────────────────
            print('\n── 2. ★ 남의 과제가 새지 않는가 ──')
            r = client.get('/api/dt-v2/me/worklist?lens=mine', headers=auth(mine_user))
            check('200', r.status_code == 200, f'실제 {r.status_code}')
            data = r.get_json()['data']
            od = card(data, 'actions')
            keys = [x['key'] for x in od['items']]
            check('★ 내 기한 지난 항목이 잡힌다',
                  any(a_uuid in k for k in keys), f'{keys}')
            check('★★ 남의 과제는 안 잡힌다',
                  not any(p_other in k for k in keys), f'{keys}')
            check('  관계 표시(PL)가 붙는다',
                  od['items'] and od['items'][0].get('relationLabel') == 'PL',
                  f"{od['items'][0] if od['items'] else None}")

            # ── 3. 연도 ────────────────────────────────────────────────────
            print('\n── 3. ★ 기한 지난 항목은 연도를 무시한다 ──')
            r = client.get('/api/dt-v2/me/worklist?lens=mine&year=2026',
                           headers=auth(mine_user))
            od26 = card(r.get_json()['data'], 'actions')
            k26 = [x['key'] for x in od26['items']]
            check('★★ 2026 을 골라도 작년(2025) 미완료가 보인다',
                  any(b_uuid in k for k in k26), f'{k26}')
            gaps = card(r.get_json()['data'], 'gaps')
            check('  다른 카드는 연도를 지킨다(과제 수가 줄어든다)',
                  r.get_json()['data']['projectCount'] <= data['projectCount'])

            # ── 4. viewer ──────────────────────────────────────────────────
            print('\n── 4. ★ viewer 는 「내 일」이 없다 ──')
            r = client.get('/api/dt-v2/me/worklist', headers=auth(viewer))
            d = r.get_json()['data']
            check('★★ 카드가 없다', d['cards'] == [] and d['lens'] is None)
            check('  왜 없는지 말해 준다', bool(d.get('notes')))

            # ── 5. ★ manager 의 「내가 하는 일」 ≠ 사업부 전체 ──────────────
            print('\n── 5. ★★ manager 의 mine 이 사업부 전체가 되면 안 된다 ──')
            if div_id:
                p_div = mkproj('div', division_id=div_id)       # 관계 없음
                mine_m = WL.build(mgr, lens='mine')
                div_m = WL.build(mgr, lens='division')
                check('★★ 사업부 과제가 mine 에는 안 들어온다',
                      mine_m['projectCount'] < div_m['projectCount'],
                      f"mine={mine_m['projectCount']} div={div_m['projectCount']}")
                pr = Dt2Project.query.filter_by(uuid=p_div).first()
                check('  (대조) 그 과제를 고칠 수는 있다',
                      P.can_edit_project(mgr, pr) is True)
                check('  (대조) 그런데 내 것은 아니다',
                      P.is_my_project(mgr, pr) is False)
            else:
                print('   건너뜀 — 사업부에 연결된 부서가 없다')

            # ── 6. 「나중에」 ──────────────────────────────────────────────
            print('\n── 6. 「나중에」 ──')
            target = od['items'][0]['key']
            r = client.post('/api/dt-v2/me/worklist/snooze',
                            json={'itemKey': target, 'card': 'overdue'},
                            headers=auth(mine_user))
            check('미루기 200', r.status_code == 200, f'실제 {r.status_code}')
            check('  30일', r.get_json()['data']['days'] == 30)

            d2 = WL.build(mine_user, lens='mine')
            od2 = card(d2, 'actions')
            check('★ 목록에서 빠진다',
                  target not in [x['key'] for x in od2['items']])
            check('★ 몇 건을 가렸는지 밝힌다', od2['snoozed'] >= 1,
                  f"snoozed={od2['snoozed']}")

            d3 = WL.build(other, lens='mine')
            check('★★ 남의 미룸은 내 목록에 영향이 없다',
                  WL.active_dismissals(other.id) == {})

            r = client.post('/api/dt-v2/me/worklist/snooze',
                            json={'itemKey': target}, headers=auth(mine_user))
            check('  같은 항목을 또 미뤄도 행이 하나',
                  Dt2WorklistDismissal.query.filter_by(
                      user_id=mine_user.id, item_key=target).count() == 1)

            r = client.delete(f'/api/dt-v2/me/worklist/snooze?itemKey={target}',
                              headers=auth(mine_user))
            check('꺼내기 200', r.status_code == 200)
            od3 = card(WL.build(mine_user, lens='mine'), 'actions')
            check('★ 도로 나타난다', target in [x['key'] for x in od3['items']])

            r = client.post('/api/dt-v2/me/worklist/snooze', json={},
                            headers=auth(mine_user))
            check('itemKey 없으면 400', r.status_code == 400)

            # ── 6-2. ★ 작업대 카드 — 이 화면에서 처리하는 것들 ─────────────
            print('\n── 6-2. ★ 작업대 카드가 처리에 필요한 것을 다 주는가 ──')
            w = WL.build(mine_user, lens='mine')
            acts = card(w, 'actions')
            check('★ 미완료 액션아이템 카드가 있다', acts is not None and acts['count'] > 0,
                  f"{acts['count'] if acts else None}건")
            it0 = acts['items'][0] if acts and acts['items'] else {}
            # 화면이 배열을 통째로 다시 보내려면 **어느 과제의 어느 항목인지** 알아야 한다.
            check('★★ projectUuid 를 준다', bool(it0.get('projectUuid')))
            check('★★ actionUuid 를 준다', bool(it0.get('actionUuid')))
            check('  제목이 비어 있지 않다 (키는 `제목` 이다)',
                  it0.get('itemTitle') not in (None, '', '(이름 없는 항목)'),
                  f"{it0.get('itemTitle')}")
            check('  배지는 기한 지난 것만 센다(전체가 아니라)',
                  acts['urgent'] <= acts['count'])
            check('  상한이 알림 카드보다 높다',
                  WL.INLINE_CARD_LIMIT > WL.CARD_LIMIT)
            check('  action=inline 로 표시된다', acts['action'] == 'inline')

            # ── 6-3. ★★ 세부항목만 체크했을 때 (실제로 터졌던 버그) ────────
            #
            # 「내 업무」 화면은 **세부항목(액티비티)만** 체크해 배열을 통째로 보낸다.
            # 상위 완료여부·완료일·진행률은 서버가 파생시키는데, **응답이 그 값을
            # 안 돌려주면** 화면은 자기가 보낸 배열(상위 미완료)을 계속 들고 있어
            # "다 체크했는데 액션아이템이 안 켜진다" 가 된다. 2026-08-11 실제 신고.
            print('\n── 6-3. ★★ 세부항목만 체크 → 상위·진행률 응답 ──')
            s_uuid = str(uuidlib.uuid4())
            p_sub = mkproj('sub', pl_knox_id=knox, action_items_json=[
                {'uuid': s_uuid, '제목': f'{MARK} 상위', '완료여부': False,
                 '세부항목목록': [{'내용': 'A', '완료여부': False},
                                {'내용': 'B', '완료여부': False}]}])
            body = [{'uuid': s_uuid, '제목': f'{MARK} 상위', '완료여부': False,
                     '세부항목목록': [{'내용': 'A', '완료여부': True, '완료일': '2026-08-11'},
                                    {'내용': 'B', '완료여부': True, '완료일': '2026-08-11'}]}]
            r = client.patch(f'/api/dt-v2/projects/{p_sub}',
                             json={'patch': {'액션아이템목록': body}},
                             headers=auth(mine_user))
            check('세부항목만 보내도 200', r.status_code == 200, f'실제 {r.status_code}')
            dv = (r.get_json().get('data') or {}).get('derived') or {}
            check('★★ 응답이 derived 를 돌려준다', bool(dv), f'{list(dv.keys())}')
            top = (dv.get('액션아이템목록') or [{}])[0]
            check('★★ 돌려준 상위가 완료로 켜져 있다', top.get('완료여부') is True,
                  f"{top.get('완료여부')}")
            check('  완료일도 채워져 있다', bool(top.get('완료일')))
            check('★ 진행률도 함께 돌려준다', dv.get('진행률') == 100, f"{dv.get('진행률')}")
            # DB 도 같은 값이어야 한다 (응답만 맞고 저장이 다르면 더 나쁘다)
            db.session.expire_all()
            stored = Dt2Project.query.filter_by(uuid=p_sub).first()
            check('  DB 의 상위도 완료', bool((stored.action_items_json or [{}])[0].get('완료여부')))
            check('  DB 진행률도 100', stored.progress == 100, f'{stored.progress}')
            # 그 액션아이템은 「내 액션아이템」에서 사라져야 한다
            after = card(WL.build(mine_user, lens='mine'), 'actions')
            check('★ 완료됐으므로 목록에서 빠진다',
                  not any(s_uuid in x['key'] for x in after['items']))

            # ── 6-4. ★ 집계 카드도 과제 이름을 준다 (블록마다 모양이 다르다) ──
            #
            # 🐞 `graph_agent` 는 분석마다 필요한 것만 담는다 — 어떤 블록은
            #    {code, title} 을 주고 어떤 블록은 {projectCode} 만 준다.
            #    그대로 그리면 **그 블록만 과제 이름이 안 나온다**(2026-08-11 신고).
            print('\n── 6-4. ★ 집계 블록도 과제 이름을 주는가 ──')
            g = card(WL.build(mine_user, lens='mine'), 'gaps')
            blocks = (g or {}).get('items') or []
            check('빈 값 카드에 블록이 있다', bool(blocks), f'{len(blocks)}')
            noname = [(b['blockKey'], x)
                      for b in blocks for x in (b.get('items') or [])
                      if not x.get('code')]
            check('★★ 코드가 빈 항목이 없다', not noname,
                  f'{[b for b, _ in noname][:3]}')
            notitle = [b['blockKey'] for b in blocks
                       for x in (b.get('items') or []) if x.get('title') is None]
            check('★ 제목 키가 빠진 항목이 없다', not notitle, f'{notitle[:3]}')

            # ── 6-5. ★ 완료 과제의 보고서 알림 ────────────────────────────
            print('\n-- 6-5. 완료 과제 보고서 알림 --')
            p_done = mkproj('done', pl_knox_id=knox, status='완료',
                            detail_completed=False)
            p_done2 = mkproj('done2', pl_knox_id=knox, status='완료',
                             detail_completed=False,
                             detail_overview_json={'items': [{'text': '쓰다 만 것'}]})
            p_done3 = mkproj('done3', pl_knox_id=knox, status='완료',
                             detail_completed=True)     # 다 썼다 → 안 떠야 한다
            rd = card(WL.build(mine_user, lens='mine'), 'reportDue')
            keys = [x['key'] for x in (rd or {}).get('items') or []]
            check('★ 완료인데 상세정보 미작성이면 뜬다',
                  any(p_done in k for k in keys), f'{keys}')
            check('★★ 상세정보를 다 쓴 완료 과제는 안 뜬다',
                  not any(p_done3 in k for k in keys), f'{keys}')
            states = {x['key']: x['reportState'] for x in rd['items']}
            check('  아직 손도 안 댄 것은 「미작성」',
                  states.get(f'reportDue:{p_done}') == '미작성',
                  f"{states.get(f'reportDue:{p_done}')}")
            check('  일부라도 쓴 것은 「작성 중」',
                  states.get(f'reportDue:{p_done2}') == '작성 중',
                  f"{states.get(f'reportDue:{p_done2}')}")
            check('  미작성이 작성 중보다 앞에 온다',
                  keys.index(f'reportDue:{p_done}') < keys.index(f'reportDue:{p_done2}'))
            check('  완료가 아닌 과제는 안 뜬다',
                  not any(p_mine in k for k in keys), f'{keys}')
            check('  「나중에」를 쓸 수 있다 (보고 시즌까지 미룰 수 있어야 한다)',
                  rd['snoozable'] is True)

            # ── 7. summary ────────────────────────────────────────────────
            print('\n── 7. summary ──')
            full = WL.build(mine_user, lens='mine')
            summ = WL.build(mine_user, lens='mine', summary=True)
            check('★ 급한 숫자가 전체와 같다',
                  summ['urgentCount'] == full['urgentCount'],
                  f"{summ['urgentCount']} vs {full['urgentCount']}")
            check('  가벼운 카드만 만든다',
                  {c['key'] for c in summ['cards']} <= set(WL.SUMMARY_CARDS),
                  f"{[c['key'] for c in summ['cards']]}")
            check('  이력을 읽는 카드는 빠진다',
                  card(summ, 'stalled') is None)

            # ── 8. 잘린 건수를 밝히는가 ───────────────────────────────────
            print('\n── 8. 조용히 자르지 않는가 ──')
            for c in full['cards']:
                if c['count'] > WL.CARD_LIMIT:
                    check(f"  {c['key']}: more 로 알린다", c['more'] > 0)
            check('★ 모든 카드가 more 를 갖는다',
                  all('more' in c for c in full['cards']))

        finally:
            print('\n── 정리 ──')
            ids = [u.id for u in made]
            Dt2WorklistDismissal.query.filter(
                Dt2WorklistDismissal.user_id.in_(ids)).delete(
                synchronize_session=False)
            for uid in puids:
                Dt2ProjectPerformance.query.filter_by(project_uuid=uid).delete()
                Dt2ChangeProposal.query.filter_by(project_uuid=uid).delete()
                Dt2ProjectChange.query.filter_by(project_uuid=uid).delete()
                Dt2ProjectHistory.query.filter_by(project_uuid=uid).delete()
                Dt2Project.query.filter_by(uuid=uid).delete()
            db.session.commit()
            if ids:
                Dt2ProjectChange.query.filter(
                    or_(Dt2ProjectChange.actor_user_id.in_(ids),
                        Dt2ProjectChange.on_behalf_of.in_(ids))).delete(
                    synchronize_session=False)
                db.session.commit()
                User.query.filter(User.id.in_(ids)).delete(synchronize_session=False)
                db.session.commit()
            check('과제 건수 불변', Dt2Project.query.count() == n_proj,
                  f'{n_proj} -> {Dt2Project.query.count()}')
            check('사용자 건수 불변', User.query.count() == n_user)

        failed = [d for d, ok in results if not ok]
        print('\n' + '=' * 72)
        print(f' 결과: {"[OK] " + str(len(results)) + "건 전부 통과" if not failed else "[FAIL] " + str(len(failed)) + "건 실패"}')
        print('=' * 72)
        return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
