"""과제PL·작성자 계정 연결 + 에이전트 읽기 개방.

두 가지를 못 박는다.

① **계정 연결 일괄** (`/owner-links/*`)
   운영에 이름만 적히고 knoxId 가 빈 과제가 많다. 과제PL 은 knoxId 가 곧 편집 권한이라
   (`is_project_pl`) 비어 있으면 **본인이 자기 과제를 못 고친다.**
   위험한 것은 동명이인이다 — 잘못 고르면 **엉뚱한 사람에게 편집 권한**이 간다.
   그래서 서버는 후보만 주고, 대상 과제 목록은 **화면이 준 것만** 바꾼다.

② **에이전트 읽기 개방** (`/ai/agent`)
   비관리자에게 열되 **쓰기는 서버가 막는다.** 화면 스위치는 안내일 뿐이라,
   `readonly: false` 를 보내도 서버가 되돌리는지 여기서 본다.

실행: python scripts\\dt3_test_owner_links.py
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask_jwt_extended import create_access_token                 # noqa: E402

from app import create_app                                         # noqa: E402
from app.extensions import db                                      # noqa: E402
from app.modules.auth.models import User, UserRole                 # noqa: E402
from app.modules.digital_twin_dashboard import permissions as P    # noqa: E402
from app.modules.digital_twin_dashboard import routes_v2 as R      # noqa: E402
from app.modules.digital_twin_dashboard.models_v2 import (         # noqa: E402
    Dt2Project, Dt2ProjectChange,
)

fails = []


def check(desc, ok, extra=''):
    print(f"  {'[OK]  ' if ok else '[FAIL]'} {desc}" + (f'   {extra}' if not ok and extra else ''))
    if not ok:
        fails.append(desc)


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    app = create_app()
    with app.app_context():
        admin = User.query.filter_by(role=UserRole.ADMIN).first()
        plain = User.query.filter(User.role != UserRole.ADMIN,
                                  User.is_active.is_(True)).first()
        if admin is None:
            check('admin 계정이 있다', False)
            return 1
        admin_hdr = {'Authorization': f'Bearer {create_access_token(identity=str(admin.id))}'}

        # ── 1. 이름 열쇠 ─────────────────────────────────────────────────
        #
        # 운영 데이터에 `홍길동 책임`·`홍 길동` 처럼 적힌 것이 있다. 정확 일치만 보면
        # **고칠 수 있는 것도 못 찾는다.** 다만 넓히는 것은 후보까지고, 고르는 건 사람이다.
        print('── 이름 열쇠 ──')
        check('공백을 지운다', R._name_key('홍 길동') == '홍길동')
        check('직함을 지운다', R._name_key('홍길동 책임') == '홍길동')
        check('띄어쓰기 없는 직함도 지운다', R._name_key('홍길동님') == '홍길동',
              R._name_key('홍길동님'))
        # 🐞 `김선임`·`이수석` 은 직함이 아니라 **이름**이다. 떼면 `김` 이 되어
        #    엉뚱한 사람이 후보로 올라오고 정작 본인은 안 올라온다.
        check('★ 직함과 같은 글자가 이름에 있으면 안 지운다',
              R._name_key('김선임') == '김선임', R._name_key('김선임'))
        check('★ 두 글자 이름도 안 망가진다', R._name_key('이수석') == '이수석',
              R._name_key('이수석'))
        check('빈 값도 죽지 않는다', R._name_key(None) == '')

        # ── 2. 점검 조회 ─────────────────────────────────────────────────
        print('\n── 미연결 조회 ──')
        with app.test_client() as c:
            r = c.get('/api/dt-v2/owner-links/audit')
            check('토큰 없으면 401', r.status_code in (401, 422), f'실제 {r.status_code}')

            if plain is not None and plain.role not in P.GLOBAL_EDIT_ROLES:
                tok = create_access_token(identity=str(plain.id))
                r = c.get('/api/dt-v2/owner-links/audit',
                          headers={'Authorization': f'Bearer {tok}'})
                check('★ 관리자·사무국이 아니면 403', r.status_code == 403, f'실제 {r.status_code}')

            r = c.get('/api/dt-v2/owner-links/audit?kind=없는종류', headers=admin_hdr)
            check('kind 가 이상하면 400', r.status_code == 400, f'실제 {r.status_code}')

            r = c.get('/api/dt-v2/owner-links/audit', headers=admin_hdr)
            check('관리자는 200', r.status_code == 200, f'실제 {r.status_code}')
            rows = r.get_json()['data']
            check('결과가 배열이다', isinstance(rows, list))
            check('★ 이미 연결된 것은 안 나온다',
                  all(row['projectCount'] > 0 for row in rows), str(rows[:1])[:200])
            check('종류가 pl·author 뿐이다',
                  all(row['kind'] in ('pl', 'author') for row in rows))
            check('과제 목록을 함께 준다 (화면이 눈으로 고를 수 있게)',
                  all('projects' in row for row in rows))
            print(f"     [정보] 미연결 {len(rows)}명 · "
                  f"과제 {sum(r0['projectCount'] for r0 in rows)}개")

            pl_rows = [r0 for r0 in rows if r0['kind'] == 'pl']
            r = c.get('/api/dt-v2/owner-links/audit?kind=pl', headers=admin_hdr)
            check('kind=pl 로 좁힐 수 있다',
                  len(r.get_json()['data']) == len(pl_rows), str(len(pl_rows)))

        # ── 3. 적용 — 되돌릴 수 있는 것만 실제로 태운다 ───────────────────
        print('\n── 적용 ──')
        with app.test_client() as c:
            r = c.patch('/api/dt-v2/owner-links', headers=admin_hdr,
                        json={'kind': 'pl', 'name': 'x', 'knoxId': 'y'})
            check('projectUuids 가 없으면 400', r.status_code == 400, f'실제 {r.status_code}')
            r = c.patch('/api/dt-v2/owner-links', headers=admin_hdr,
                        json={'kind': '없음', 'name': 'x', 'knoxId': 'y',
                              'projectUuids': ['u']})
            check('kind 가 이상하면 400', r.status_code == 400, f'실제 {r.status_code}')
            r = c.patch('/api/dt-v2/owner-links', headers=admin_hdr,
                        json={'kind': 'pl', 'name': 'x', 'knoxId': '',
                              'projectUuids': ['u']})
            check('knoxId 가 비면 400', r.status_code == 400, f'실제 {r.status_code}')

            # 실제 적용 — 시험용 과제를 하나 잡아 이름만 넣고 돌린 뒤 되돌린다.
            p = Dt2Project.query.filter(
                Dt2Project.is_deleted.is_(False)).first()
            if p is None:
                check('시험할 과제가 있다', False)
            else:
                before_name, before_knox = p.pl_name, p.pl_knox_id
                before_version = p.row_version
                p.pl_name = '__dt3_시험_PL'
                p.pl_knox_id = None
                db.session.commit()
                try:
                    # 이름이 다른 과제는 건너뛴다 (화면이 낡은 목록을 보냈을 때의 방어)
                    r = c.patch('/api/dt-v2/owner-links', headers=admin_hdr,
                                json={'kind': 'pl', 'name': '__다른이름',
                                      'knoxId': 'dt3.test', 'projectUuids': [p.uuid]})
                    d = r.get_json()['data']
                    check('★ 이름이 다르면 건너뛴다 (바꾸지 않는다)',
                          d['updatedCount'] == 0 and d['skippedCount'] == 1, str(d)[:200])

                    r = c.patch('/api/dt-v2/owner-links', headers=admin_hdr,
                                json={'kind': 'pl', 'name': '__dt3_시험_PL',
                                      'knoxId': 'dt3.test', 'projectUuids': [p.uuid]})
                    d = r.get_json()['data']
                    check('이름이 맞으면 연결한다', d['updatedCount'] == 1, str(d)[:200])

                    db.session.expire_all()
                    p2 = Dt2Project.query.filter_by(uuid=p.uuid).first()
                    check('★ knoxId 가 실제로 들어갔다', p2.pl_knox_id == 'dt3.test',
                          str(p2.pl_knox_id))
                    check('이름은 건드리지 않는다', p2.pl_name == '__dt3_시험_PL')
                    check('row_version 이 올라간다', p2.row_version > before_version)

                    row = (Dt2ProjectChange.query
                           .filter_by(project_uuid=p.uuid, field='pl_knox_id')
                           .order_by(Dt2ProjectChange.id.desc()).first())
                    check('★ 변경 이력이 남는다 ("왜 이 사람이 들어갔지" 를 볼 수 있게)',
                          row is not None and row.after_value == 'dt3.test', str(row))
                    check('그 이력에 사유가 적힌다', bool(row and row.reason), str(row and row.reason))

                    # 이미 붙어 있으면 **덮지 않는다** — 이 기능은 빈 것을 채우는 일이다.
                    r = c.patch('/api/dt-v2/owner-links', headers=admin_hdr,
                                json={'kind': 'pl', 'name': '__dt3_시험_PL',
                                      'knoxId': 'other.id', 'projectUuids': [p.uuid]})
                    d = r.get_json()['data']
                    check('★★ 이미 연결된 과제는 덮어쓰지 않는다',
                          d['updatedCount'] == 0 and d['skippedCount'] == 1, str(d)[:200])
                finally:
                    # 되돌린다 — 시험이 개발 DB 를 더럽히면 다음 사람이 진짜로 오해한다.
                    db.session.expire_all()
                    p3 = Dt2Project.query.filter_by(uuid=p.uuid).first()
                    p3.pl_name, p3.pl_knox_id = before_name, before_knox
                    Dt2ProjectChange.query.filter_by(
                        project_uuid=p.uuid, field='pl_knox_id').delete()
                    db.session.commit()
                    back = Dt2Project.query.filter_by(uuid=p.uuid).first()
                    check('시험 흔적을 되돌렸다',
                          back.pl_name == before_name and back.pl_knox_id == before_knox,
                          f'{back.pl_name} / {back.pl_knox_id}')

        # ── 4. 에이전트 읽기 개방 ────────────────────────────────────────
        #
        # 화면 스위치는 안내일 뿐이다. **서버가 막는지** 본다.
        print('\n── 에이전트 읽기 개방 ──')
        with app.test_client() as c:
            if plain is None:
                check('비관리자 계정이 있어 개방을 시험할 수 있다', False)
            else:
                tok = create_access_token(identity=str(plain.id))
                hdr = {'Authorization': f'Bearer {tok}'}

                r = c.post('/api/dt-v2/ai/agent', json={'query': ''}, headers=hdr)
                check('★ 비관리자도 403 이 아니다 (질문이 비어 400)',
                      r.status_code == 400, f'실제 {r.status_code}')

                saved = app.config.get('LLM_BASE_URL')
                app.config['LLM_BASE_URL'] = ''
                try:
                    r = c.post('/api/dt-v2/ai/agent',
                               json={'query': '지연 과제 알려줘'}, headers=hdr)
                    check('★ 비관리자도 조회 요청이 라우트를 통과한다 (LLM 미설정 503)',
                          r.status_code == 503, f'실제 {r.status_code}')
                finally:
                    app.config['LLM_BASE_URL'] = saved

                # ★★ 여기가 이 개방의 핵심이다 — **쓰기를 서버가 막는가.**
                #    `run_agent` 만 가로채 어떤 모드로 불렸는지 본다(LLM 은 필요 없다).
                captured = {}

                def fake_run_agent(auth, query, *, history=None, readonly=False, **kw):
                    captured['readonly'] = readonly
                    return {'answer': 'ok', 'answerEmpty': False, 'trace': [],
                            'hops': 0, 'toolCalls': 0, 'model': 'fake', 'truncated': False}

                orig_run = R.dt_agent.run_agent
                saved = app.config.get('LLM_BASE_URL')
                app.config['LLM_BASE_URL'] = 'http://stub/v1'
                R.dt_agent.run_agent = fake_run_agent
                try:
                    r = c.post('/api/dt-v2/ai/agent', headers=hdr,
                               json={'query': 'ProjA 진행률 60으로 올려줘', 'readonly': False})
                    data = (r.get_json() or {}).get('data') or {}
                    check('★★ 비관리자가 readonly:false 를 보내도 읽기로 돌린다',
                          captured.get('readonly') is True, str(captured))
                    check('★ 되돌렸다는 사실을 응답에 담는다 (조용히 바꾸지 않는다)',
                          data.get('readonlyForced') is True, str(data)[:200])
                    check('응답에 실제 모드를 담는다', data.get('readonly') is True)

                    # 관리자는 그대로 통과한다 — 개방이 관리자 쓰기를 막으면 안 된다
                    captured.clear()
                    r = c.post('/api/dt-v2/ai/agent', headers=admin_hdr,
                               json={'query': 'ProjA 진행률 60으로 올려줘', 'readonly': False})
                    data = (r.get_json() or {}).get('data') or {}
                    check('★ 관리자는 쓰기 모드가 유지된다',
                          captured.get('readonly') is False, str(captured))
                    check('관리자에겐 readonlyForced 가 없다',
                          'readonlyForced' not in data, str(data)[:160])
                finally:
                    R.dt_agent.run_agent = orig_run
                    app.config['LLM_BASE_URL'] = saved

                # 진단 기록은 진짜로 남는다(기능이다). 시험이 남긴 것만 지운다.
                from app.modules.digital_twin_dashboard.models_v2 import Dt2AgentRun
                Dt2AgentRun.query.filter(
                    Dt2AgentRun.question == 'ProjA 진행률 60으로 올려줘').delete()
                db.session.commit()

        print()
        if fails:
            print(f'[FAIL] {len(fails)}건: {fails}')
            return 1
        print('[OK] 전부 통과')
        return 0


if __name__ == '__main__':
    sys.exit(main())
