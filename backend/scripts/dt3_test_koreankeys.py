"""
한글 키 수용 시험 (1단계-a) — 개발 DB 전용.

무엇을 시험하나
    화면은 데이터를 한글 키(`진행률`)로 들고 있고 dt2 는 영문 컬럼(`progress`)이다.
    그 번역을 **서버가** 맡기로 했다(실행계획 1단계 (b)안). 맵을 프론트에 복제하면
    갈릴 자리가 하나 더 생기고, 이 프로젝트는 사본으로 이미 세 번 물렸다.

    그래서 확인할 것은 셋이다.
      1. 한글로 보내면 **정말 그 칸에** 들어가는가
      2. 영어로 보내던 기존 경로가 그대로인가 (AI·MCP 는 영어를 쓴다)
      3. 애매하게 보냈을 때 **조용히 넘어가지 않는가**
         — 같은 칸을 두 이름으로, 모르는 키, 못 고치는 키

안전장치
    시험용 과제·성과를 직접 만들어 쓰고 끝나면 지운다. 기존 행은 건드리지 않는다.
    마지막에 건수를 대조한다.

사용법
    python scripts\\dt3_test_koreankeys.py
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
    Dt2Project, Dt2Performance, Dt2ProjectChange,
    Dt2ProjectHistory, Dt2PerformanceHistory,
)

from flask_jwt_extended import create_access_token

MARK = '__dt3_kr_test__'
results = []


def check(desc, cond, extra=''):
    results.append((desc, bool(cond)))
    print(f"  {'[OK]  ' if cond else '[FAIL]'} {desc}" + (f"   {extra}" if not cond and extra else ''))


def auth(user):
    # 컷오버 전 쓰기 차단을 시험에서는 통과시킨다 (config.DT2_ALLOW_TEST_WRITE_HEADER)
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
        before_p = Dt2Project.query.count()
        before_f = Dt2Performance.query.count()

        admin = User.query.filter_by(role=UserRole.ADMIN, is_active=True).first()
        if admin is None:
            print('[FAIL] admin 사용자가 없어 시험할 수 없습니다.')
            sys.exit(1)
        hdr = auth(admin)

        puid = str(uuidlib.uuid4())
        db.session.add(Dt2Project(
            uuid=puid, code=MARK, title=f'{MARK} 원본제목',
            status='정상진행', progress=10, year=2026,
            start_month=1, end_month=12,
            owner_user_id=admin.id, action_items_json=[], issues_json=[],
            is_deleted=False, is_permanently_deleted=False,
            row_version=1, extra_fields={},
        ))
        fuid = str(uuidlib.uuid4())
        db.session.add(Dt2Performance(
            uuid=fuid, code=MARK, title=f'{MARK} 성과',
            unit='건', year=2026, current_level=1, target_level=10,
            actual_level=2, is_deleted=False, row_version=1, extra_fields={},
        ))
        db.session.commit()
        print(f'\n시험용 과제 {puid[:8]} / 성과 {fuid[:8]} 생성')

        created_uuids = []
        try:
            # ── 1. 한글 키가 실제 컬럼에 들어가는가 ──────────────────────────
            print('\n[1] 한글 키 → 컬럼 반영')
            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'진행률': 55}}, headers=hdr)
            check('진행률 로 PATCH 200', r.status_code == 200, f'실제 {r.status_code} {r.get_json()}')
            db.session.expire_all()
            row = Dt2Project.query.filter_by(uuid=puid).first()
            check('★ progress 컬럼에 55 가 들어감', row.progress == 55, f'실제 {row.progress}')
            check('applied 는 컬럼명(영문)으로 응답',
                  r.get_json()['data']['applied'] == ['progress'],
                  f"실제 {r.get_json()['data']['applied']}")

            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'과제명': f'{MARK} 한글로바꾼제목',
                                             '진행상태': '지연'}}, headers=hdr)
            check('과제명·진행상태 동시 200', r.status_code == 200, f'실제 {r.status_code}')
            db.session.expire_all()
            row = Dt2Project.query.filter_by(uuid=puid).first()
            check('★ title 반영', row.title == f'{MARK} 한글로바꾼제목', f'실제 {row.title!r}')
            check('★ status 반영', row.status == '지연', f'실제 {row.status!r}')

            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'액션아이템목록': [{'내용': 'x'}]}}, headers=hdr)
            check('JSON 컬럼(액션아이템목록) 200', r.status_code == 200, f'실제 {r.status_code}')
            db.session.expire_all()
            row = Dt2Project.query.filter_by(uuid=puid).first()
            # 통째 비교가 아니다 — 서버가 **정체성(`uuid`)을 하나 더 붙인다**
            # (2026-08-08, routes_v2._assign_action_uuids). 보낸 값이 그대로 들어가는지와
            # uuid 가 붙는지를 따로 본다. 통째로 비교하면 uuid 를 더할 때마다 여기가 깨진다.
            saved_items = row.action_items_json
            check('★ action_items_json 반영', len(saved_items) == 1
                  and saved_items[0].get('내용') == 'x', f'실제 {saved_items}')
            check('★ 서버가 액션아이템에 uuid 를 붙인다',
                  bool(saved_items and saved_items[0].get('uuid')), f'실제 {saved_items}')

            # 액션아이템이 생기는 순간 `진행률` 은 파생 필드가 된다 — 직접 보내도
            # 반영되지 않고 `ignored` 로 돌아온다(routes_v2 (c-3)).
            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'진행률': 42}}, headers=hdr)
            got = ((r.get_json() or {}).get('data') or {}).get('ignored') or []
            check('★ 액션아이템이 있으면 진행률은 ignored', '진행률' in got, f'실제 {got}')
            db.session.expire_all()
            check('  진행률 값이 안 바뀐다',
                  Dt2Project.query.filter_by(uuid=puid).first().progress != 42)

            # 아래 절들은 `진행률` 을 평범한 저위험 필드로 써서 번역·병합·낙관적 락을
            # 본다. 파생에 걸리지 않게 액션아이템을 비워 둔다.
            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'액션아이템목록': []}}, headers=hdr)
            check('액션아이템 비우기 200', r.status_code == 200, f'실제 {r.status_code}')

            # ── 2. 영어 키 회귀 ───────────────────────────────────────────────
            print('\n[2] 영어 키는 그대로 (AI·MCP 경로)')
            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'progress': 77}}, headers=hdr)
            check('progress 로 PATCH 200', r.status_code == 200, f'실제 {r.status_code}')
            db.session.expire_all()
            check('★ progress 77', Dt2Project.query.filter_by(uuid=puid).first().progress == 77)

            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'진행률': 88, 'status': '정상진행'}}, headers=hdr)
            check('한글·영어 혼용(다른 필드) 200', r.status_code == 200, f'실제 {r.status_code}')
            db.session.expire_all()
            row = Dt2Project.query.filter_by(uuid=puid).first()
            check('★ 둘 다 반영', row.progress == 88 and row.status == '정상진행',
                  f'실제 {row.progress} / {row.status!r}')

            # ── 3. 조용히 넘어가면 안 되는 것들 ───────────────────────────────
            print('\n[3] 애매하게 보내면 시끄럽게 실패해야 한다')
            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'과제명': 'A', 'title': 'B'}}, headers=hdr)
            check('★ 같은 칸을 두 이름으로 → 400', r.status_code == 400, f'실제 {r.status_code}')
            msg = (r.get_json() or {}).get('message', '')
            check('  메시지에 두 이름이 다 보임', '과제명' in msg and 'title' in msg, f'실제 {msg!r}')
            db.session.expire_all()
            check('  덮어쓰지 않았다', Dt2Project.query.filter_by(uuid=puid).first().title
                  == f'{MARK} 한글로바꾼제목')

            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'없는필드': 1}}, headers=hdr)
            check('모르는 한글 키 → 400', r.status_code == 400, f'실제 {r.status_code}')
            check('★ 오류에 보낸 이름(한글)이 나온다',
                  '없는필드' in (r.get_json() or {}).get('message', ''),
                  f"실제 {(r.get_json() or {}).get('message')!r}")

            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'id': 'NEW-1'}}, headers=hdr)
            check('id(→code) 는 못 고침 400', r.status_code == 400, f'실제 {r.status_code}')
            check('  오류에 보낸 이름 id 로 표시',
                  'id' in (r.get_json() or {}).get('message', ''),
                  f"실제 {(r.get_json() or {}).get('message')!r}")

            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'createdAt': '2020-01-01'}}, headers=hdr)
            check('createdAt(→created_at) 400', r.status_code == 400, f'실제 {r.status_code}')

            # ── 4. 생성 경로 ─────────────────────────────────────────────────
            print('\n[4] 생성도 한글 키로')
            r = client.post('/api/dt-v2/projects',
                            json={'fields': {'과제명': f'{MARK} 한글생성', '진행률': 5,
                                             '진행상태': '정상진행', '과제년도': 2026}},
                            headers=hdr)
            check('POST /projects 201', r.status_code == 201, f'실제 {r.status_code} {r.get_json()}')
            if r.status_code == 201:
                new_uuid = r.get_json()['data']['uuid']
                created_uuids.append(new_uuid)
                made = Dt2Project.query.filter_by(uuid=new_uuid).first()
                check('★ title/progress/status 반영',
                      made.title == f'{MARK} 한글생성' and made.progress == 5
                      and made.status == '정상진행',
                      f'실제 {made.title!r}/{made.progress}/{made.status!r}')

            # ── 5. 성과도 같은 규칙 ──────────────────────────────────────────
            print('\n[5] 성과 — 같은 규칙')
            r = client.patch(f'/api/dt-v2/performances/{fuid}',
                             json={'patch': {'실적수준': 7}}, headers=hdr)
            check('실적수준 로 PATCH 200', r.status_code == 200, f'실제 {r.status_code} {r.get_json()}')
            db.session.expire_all()
            frow = Dt2Performance.query.filter_by(uuid=fuid).first()
            check('★ actual_level 7', float(frow.actual_level) == 7.0, f'실제 {frow.actual_level}')

            r = client.patch(f'/api/dt-v2/performances/{fuid}',
                             json={'patch': {'성과항목': 'A', 'title': 'B'}}, headers=hdr)
            check('성과도 두 이름 충돌 400', r.status_code == 400, f'실제 {r.status_code}')

            r = client.patch(f'/api/dt-v2/performances/{fuid}',
                             json={'patch': {'성과항목UUID': 'x'}}, headers=hdr)
            check('성과항목UUID(→legacy_uuid) 는 못 고침 400', r.status_code == 400,
                  f'실제 {r.status_code}')

            # ── 6. ignore_unknown — 화면이 전체 diff 를 보낼 때 ────────────────
            print('\n[6] ignore_unknown — 못 고치는 키는 건너뛰되 알려준다')
            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'진행률': 33,
                                             'updatedAt': '2026-01-01',   # 서버가 정하는 값
                                             'isEditing': True,           # UI 임시값
                                             '없는필드': 1},
                                   'ignore_unknown': True}, headers=hdr)
            check('★ 섞여 있어도 200', r.status_code == 200, f'실제 {r.status_code} {r.get_json()}')
            data = (r.get_json() or {}).get('data', {})
            check('★ 정상 필드는 반영 (applied=progress)', data.get('applied') == ['progress'],
                  f"실제 {data.get('applied')}")
            check('★ 건너뛴 키를 ignored 로 돌려준다',
                  set(data.get('ignored') or []) == {'updatedAt', 'isEditing', '없는필드'},
                  f"실제 {data.get('ignored')}")
            db.session.expire_all()
            check('  progress 33 반영됨',
                  Dt2Project.query.filter_by(uuid=puid).first().progress == 33)

            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'isEditing': True, '없는필드': 2},
                                   'ignore_unknown': True}, headers=hdr)
            check('전부 건너뛰면 200 + applied 빈배열', r.status_code == 200
                  and (r.get_json() or {}).get('data', {}).get('applied') == [],
                  f'실제 {r.status_code} {r.get_json()}')

            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'진행률': 34, '없는필드': 1}}, headers=hdr)
            check('★ ignore_unknown 없으면 여전히 400 (AI·MCP 경로는 엄격)',
                  r.status_code == 400, f'실제 {r.status_code}')
            db.session.expire_all()
            check('  400 이면 정상 필드도 반영 안 됨(전부 아니면 전무)',
                  Dt2Project.query.filter_by(uuid=puid).first().progress == 33,
                  f'실제 {Dt2Project.query.filter_by(uuid=puid).first().progress}')

            # ── 7. 생성 — 전체 필드를 보내므로 분류 누락이 곧 데이터 손실 ────
            print('\n[7] 생성 — uuid 수용 · 새로 분류된 필드 · ignore_unknown')
            from app.modules.digital_twin_dashboard import permissions as P
            # 파생 필드도 '분류된 것' 이다 — 입력으로는 안 받지만 서버가 채운다.
            all_cls = (set(P.LOW_RISK_FIELDS) | set(P.CORE_FIELDS)
                       | set(P.IMMUTABLE_FIELDS) | set(P.PROJECT_DERIVED_FIELDS))
            from app.modules.digital_twin_dashboard import field_maps as FM
            gap = sorted(set(FM.PROJECT_FIELD_MAP.values()) - all_cls)
            check('★ 맵의 모든 컬럼이 분류돼 있다 (생성 시 누락 방지)', not gap, f'미분류 {gap}')
            check('★ members_json 은 핵심 — 편집 권한을 주는 필드다',
                  'members_json' in P.CORE_FIELDS)
            # 2026-08-05: owners_json 은 핵심이 아니라 **파생**이다 —
            # `members_json` 의 표시용 사본이라 서버가 만든다. 핵심으로 되돌리면
            # AI 가 이름만 담아 넣을 수 있게 되고, 사본이 정본과 갈린다.
            check('★ owners_json 은 파생 (members_json 의 사본)',
                  'owners_json' in P.PROJECT_DERIVED_FIELDS
                  and 'owners_json' not in P.CORE_FIELDS)
            check('deleted_by_raw 는 불변 — 본문으로 위조 못 한다',
                  'deleted_by_raw' in P.IMMUTABLE_FIELDS)

            my_uuid = str(uuidlib.uuid4())
            r = client.post('/api/dt-v2/projects', json={'fields': {
                'uuid': my_uuid,
                '과제명': f'{MARK} 생성2',
                # `관리자` 는 일부러 보낸다 — 불변 필드라 **무시돼야** 한다.
                # 대신 과제PL 에서 파생된 값이 들어간다(아래 확인).
                '프로세스': '개발', '작성자': '홍길동', '관리자': '김관리',
                '과제PL': '박PL',
                '담당부서': '기획팀', '담당부서목록': [{'이름': '기획팀'}],
                '과제참여인력목록': [{'knoxId': 'abc', '이름': '홍길동'}],
                '사업부내공개여부': True,
                '진행률': 12, '과제년도': 2026,
            }, 'ignore_unknown': True}, headers=hdr)
            check('POST 201', r.status_code == 201, f'실제 {r.status_code} {r.get_json()}')
            if r.status_code == 201:
                created_uuids.append(my_uuid)
                check('★ 화면이 만든 uuid 를 그대로 쓴다',
                      r.get_json()['data']['uuid'] == my_uuid,
                      f"실제 {r.get_json()['data']['uuid']}")
                made = Dt2Project.query.filter_by(uuid=my_uuid).first()
                check('★ 프로세스 반영', made.process == '개발', f'실제 {made.process!r}')
                check('★ 작성자 반영', made.author_name == '홍길동', f'실제 {made.author_name!r}')
                # 2026-08-02 계약 변경: 관리자는 과제PL 의 **사본**이다.
                # 보낸 값('김관리')은 버려지고 과제PL('박PL')이 들어가야 한다.
                # 이걸 다시 '반영된다' 로 되돌리면, AI 가 관리자만 따로 바꿔 놓고
                # 다음 저장 때 조용히 덮이는 옛 문제가 그대로 돌아온다.
                check('★ 관리자는 직접 못 쓴다 (보낸 값 무시)',
                      made.manager_name != '김관리', f'실제 {made.manager_name!r}')
                check('★ 관리자는 과제PL 에서 파생된다',
                      made.manager_name == '박PL', f'실제 {made.manager_name!r}')
                check('★ 담당부서 반영', made.dept_name == '기획팀', f'실제 {made.dept_name!r}')
                check('★ 담당부서목록 반영', made.depts_json == [{'이름': '기획팀'}],
                      f'실제 {made.depts_json}')
                check('★ 과제참여인력목록 반영',
                      made.members_json == [{'knoxId': 'abc', '이름': '홍길동'}],
                      f'실제 {made.members_json}')
                check('★ 사업부내공개여부 반영', made.is_division_public is True,
                      f'실제 {made.is_division_public}')

            r = client.post('/api/dt-v2/projects', json={'fields': {
                'uuid': my_uuid, '과제명': f'{MARK} 중복'}}, headers=hdr)
            check('★ 같은 uuid 로 또 만들면 409', r.status_code == 409, f'실제 {r.status_code}')

            r = client.post('/api/dt-v2/projects', json={'fields': {
                '과제명': f'{MARK} 생성3', 'isEditing': True, '없는필드': 1},
                'ignore_unknown': True}, headers=hdr)
            check('생성도 ignore_unknown 이 동작', r.status_code == 201, f'실제 {r.status_code}')
            if r.status_code == 201:
                created_uuids.append(r.get_json()['data']['uuid'])
                check('  건너뛴 키를 알려준다',
                      set(r.get_json()['data'].get('ignored') or []) == {'isEditing', '없는필드'},
                      f"실제 {r.get_json()['data'].get('ignored')}")

            r = client.post('/api/dt-v2/projects', json={'fields': {
                '과제명': f'{MARK} 생성4', '없는필드': 1}}, headers=hdr)
            check('★ ignore_unknown 없으면 생성도 400', r.status_code == 400,
                  f'실제 {r.status_code}')

            # ── 8. 사업부 텍스트 → division_id 재해석 ────────────────────────
            print('\n[8] 사업부를 바꾸면 division_id 도 따라간다 (권한이 옛 사업부에 남지 않게)')
            from app.modules.digital_twin_dashboard.models import Division
            divs = Division.query.filter(Division.is_active.is_(True)).limit(2).all()
            if len(divs) < 2:
                check('활성 사업부가 2개 이상 필요', False, f'실제 {len(divs)}개')
            else:
                d1, d2 = divs[0], divs[1]
                r = client.patch(f'/api/dt-v2/projects/{puid}',
                                 json={'patch': {'사업부': d1.name}}, headers=hdr)
                check(f'사업부 → {d1.name!r} 200', r.status_code == 200, f'실제 {r.status_code}')
                db.session.expire_all()
                row = Dt2Project.query.filter_by(uuid=puid).first()
                check('★ division_id 가 함께 갱신된다', row.division_id == d1.id,
                      f'실제 {row.division_id} (기대 {d1.id})')
                check('  division_id 변경도 이력에 남는다',
                      Dt2ProjectChange.query.filter_by(
                          project_uuid=puid, field='division_id').count() >= 1)

                r = client.patch(f'/api/dt-v2/projects/{puid}',
                                 json={'patch': {'사업부': d2.name}}, headers=hdr)
                db.session.expire_all()
                check(f'★ 다른 사업부로 옮기면 id 도 따라간다 ({d2.name})',
                      Dt2Project.query.filter_by(uuid=puid).first().division_id == d2.id)

                r = client.patch(f'/api/dt-v2/projects/{puid}',
                                 json={'patch': {'사업부': '존재하지않는사업부명'}}, headers=hdr)
                db.session.expire_all()
                check('★ 못 찾으면 NULL — 값을 지어내지 않는다',
                      Dt2Project.query.filter_by(uuid=puid).first().division_id is None,
                      f'실제 {Dt2Project.query.filter_by(uuid=puid).first().division_id}')

                r = client.post('/api/dt-v2/projects', json={'fields': {
                    '과제명': f'{MARK} 사업부생성', '사업부': d1.name},
                    'ignore_unknown': True}, headers=hdr)
                check('생성도 division_id 를 푼다', r.status_code == 201, f'실제 {r.status_code}')
                if r.status_code == 201:
                    nu = r.get_json()['data']['uuid']
                    created_uuids.append(nu)
                    check('★ 새 과제의 division_id 가 채워진다',
                          Dt2Project.query.filter_by(uuid=nu).first().division_id == d1.id)

            # ── 9. 행 버전 · 낙관적 락 ───────────────────────────────────────
            print('\n[9] rowVersions 응답 · 409 충돌')
            r = client.get('/api/dt-v2/data', headers=hdr)
            check('★ 기본 응답에는 rowVersions 가 없다 (V1 대조 형태 유지)',
                  'rowVersions' not in (r.get_json() or {}).get('data', {}))

            r = client.get('/api/dt-v2/data?rowVersions=1', headers=hdr)
            rv = (r.get_json() or {}).get('data', {}).get('rowVersions')
            check('rowVersions=1 이면 따로 내려준다', isinstance(rv, dict) and 'projects' in rv)
            db.session.expire_all()
            cur_ver = Dt2Project.query.filter_by(uuid=puid).first().row_version
            check('★ 과제의 실제 row_version 과 일치',
                  (rv or {}).get('projects', {}).get(puid) == cur_ver,
                  f"응답 {(rv or {}).get('projects', {}).get(puid)} / 실제 {cur_ver}")
            check('  성과 버전도 함께 온다', puid and isinstance(rv.get('performances'), dict))

            # 같은 필드를 낡은 버전으로 고치면 409
            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'진행률': 41}}, headers=hdr)
            check('먼저 한 사람의 저장은 성공', r.status_code == 200, f'실제 {r.status_code}')
            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'진행률': 42}, 'expected_version': cur_ver},
                             headers=hdr)
            check('★ 같은 필드를 낡은 버전으로 고치면 409',
                  r.status_code == 409, f'실제 {r.status_code}')
            db.session.expire_all()
            check('  409 면 값이 안 바뀐다',
                  Dt2Project.query.filter_by(uuid=puid).first().progress == 41,
                  f'실제 {Dt2Project.query.filter_by(uuid=puid).first().progress}')

            # 겹치지 않는 필드면 낡은 버전이어도 자동 병합
            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'과제상세설명': '다른 필드'},
                                   'expected_version': cur_ver}, headers=hdr)
            check('★ 겹치지 않는 필드는 낡은 버전이어도 통과 (자동 병합)',
                  r.status_code == 200, f'실제 {r.status_code} {r.get_json()}')

            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'진행률': 43}}, headers=hdr)
            check('expected_version 을 안 주면 락을 건너뛴다', r.status_code == 200,
                  f'실제 {r.status_code}')

            # ── 10. 두 사람이 서로 다른 필드를 고치는 실제 시나리오 ──────────
            #
            # A 가 프로세스를 제조→개발로 바꾸고 저장한다.
            # B 는 **새로고침하지 않고** 과제영역을 데이터→시뮬레이션으로 바꿔 저장한다.
            # 이때 A 의 '개발' 이 B 의 낡은 '제조' 로 되돌아가면 안 된다.
            print('\n[10] A 가 고친 뒤 B 가 다른 필드를 고쳐도 A 의 변경이 살아남는가 ★')
            client.patch(f'/api/dt-v2/projects/{puid}',
                         json={'patch': {'프로세스': '제조', '과제영역': '데이터'}},
                         headers=hdr)
            db.session.expire_all()
            base = Dt2Project.query.filter_by(uuid=puid).first()
            base_ver = base.row_version
            check('출발점: 프로세스=제조 / 과제영역=데이터',
                  base.process == '제조' and base.domain == '데이터',
                  f'실제 {base.process!r}/{base.domain!r}')

            # A — 프로세스만 바꾼다
            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'프로세스': '개발'},
                                   'expected_version': base_ver}, headers=hdr)
            check('A 저장 성공', r.status_code == 200, f'실제 {r.status_code}')

            # B — 낡은 버전으로, **자기가 바꾼 필드만** 보낸다 (화면 어댑터가 그렇게 만든다)
            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'과제영역': '시뮬레이션'},
                                   'expected_version': base_ver}, headers=hdr)
            check('B 저장도 성공 (겹치지 않으므로 자동 병합)', r.status_code == 200,
                  f'실제 {r.status_code} {r.get_json()}')
            merged = (r.get_json() or {}).get('data', {}).get('mergedWith')
            check('★ 무엇이 병합됐는지 알려준다 (화면이 낡았다는 신호)',
                  merged == ['프로세스'], f'실제 {merged}')
            check('  이름은 화면이 쓰는 한글로 준다', merged and '프로세스' in merged)

            db.session.expire_all()
            after = Dt2Project.query.filter_by(uuid=puid).first()
            check('★★ A 의 프로세스=개발 이 살아 있다 (제조로 되돌아가지 않는다)',
                  after.process == '개발', f'실제 {after.process!r}')
            check('★★ B 의 과제영역=시뮬레이션 도 반영됐다',
                  after.domain == '시뮬레이션', f'실제 {after.domain!r}')

            # 반대로 **같은 필드**를 건드리면 덮어쓰지 않고 막아야 한다
            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'프로세스': '제조'},
                                   'expected_version': base_ver}, headers=hdr)
            check('★ 같은 필드를 낡은 버전으로 고치면 409 (덮어쓰지 않는다)',
                  r.status_code == 409, f'실제 {r.status_code}')
            db.session.expire_all()
            check('  그래서 프로세스는 여전히 개발',
                  Dt2Project.query.filter_by(uuid=puid).first().process == '개발')

            # ── 11. 보고서 이미지 슬롯 ───────────────────────────────────────
            #
            # 2026-07-30 리허설에서 "상세과제정보에서 이미지가 적용되지 않는다" 로 드러났다.
            # image_refs_json 이 IMMUTABLE 이었는데 대체할 이미지 API 가 없어서,
            # 이미지가 바뀐 저장이 통째로 V1 으로 물러섰다.
            print('\n[11] 보고서 이미지 (image_refs_json)')
            refs = {'이미지_상세내용그림': [{'imageId': 7, 'caption': '그림'}],
                    '이미지_좌측': [{'imageId': 8}]}
            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'image_refs_json': refs},
                                   'ignore_unknown': True}, headers=hdr)
            check('★ image_refs_json 을 PATCH 할 수 있다', r.status_code == 200,
                  f'실제 {r.status_code} {r.get_json()}')
            check('  건너뛰지 않는다', not (r.get_json() or {}).get('data', {}).get('ignored'),
                  f"ignored={(r.get_json() or {}).get('data', {}).get('ignored')}")
            db.session.expire_all()
            check('★ 값이 그대로 들어간다',
                  Dt2Project.query.filter_by(uuid=puid).first().image_refs_json == refs,
                  f'실제 {Dt2Project.query.filter_by(uuid=puid).first().image_refs_json}')

            # 재조립이 슬롯별로 되돌려야 화면이 읽는다
            from app.modules.digital_twin_dashboard.assemble import assemble_project
            row = Dt2Project.query.filter_by(uuid=puid).first()
            out = assemble_project(row, [], [])
            check('★ 재조립이 슬롯별 키로 되돌린다',
                  out.get('이미지_상세내용그림') == refs['이미지_상세내용그림']
                  and out.get('이미지_좌측') == refs['이미지_좌측'],
                  f"실제 {out.get('이미지_상세내용그림')} / {out.get('이미지_좌측')}")

            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'image_refs_json': {}}}, headers=hdr)
            check('빈 값으로 지울 수 있다', r.status_code == 200, f'실제 {r.status_code}')
            db.session.expire_all()
            check('  지워지면 재조립에도 안 나온다',
                  '이미지_좌측' not in assemble_project(
                      Dt2Project.query.filter_by(uuid=puid).first(), [], []))

        finally:
            # ── 정리 ────────────────────────────────────────────────────────
            targets = [puid] + created_uuids
            Dt2ProjectChange.query.filter(Dt2ProjectChange.project_uuid.in_(targets)).delete(
                synchronize_session=False)
            Dt2ProjectHistory.query.filter(Dt2ProjectHistory.project_uuid.in_(targets)).delete(
                synchronize_session=False)
            Dt2PerformanceHistory.query.filter_by(performance_uuid=fuid).delete(
                synchronize_session=False)
            Dt2Project.query.filter(Dt2Project.uuid.in_(targets)).delete(
                synchronize_session=False)
            Dt2Performance.query.filter_by(uuid=fuid).delete(synchronize_session=False)
            db.session.commit()

            after_p = Dt2Project.query.count()
            after_f = Dt2Performance.query.count()
            print('\n── 정리 ──')
            check('과제 건수 원복', after_p == before_p, f'{before_p} → {after_p}')
            check('성과 건수 원복', after_f == before_f, f'{before_f} → {after_f}')

    ok = sum(1 for _, c in results if c)
    bad = len(results) - ok
    print('\n' + '=' * 72)
    print(f'결과: {ok}/{len(results)} 통과' + (f' — [FAIL] {bad}건' if bad else ' — [OK]'))
    if bad:
        for desc, c in results:
            if not c:
                print(f'  [FAIL] {desc}')
    print('=' * 72)
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
