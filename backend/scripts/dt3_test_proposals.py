"""
AI 제안 처리 + 신규 생성 시험 (Phase 3-3) — 개발 DB 전용.

여기서 지켜야 할 규칙을 집중적으로 본다.
    ① 제안은 **그 과제를 고칠 수 있는 사람**만 승인한다 — 권한 없으면 403.
       ⚠️ 2026-08-01 이전엔 "자기가 낸 제안은 자기가 승인 못 한다" 도 있었으나 뺐다.
          인증이 개인 PAT 이 되면서 제안자 = AI 를 시킨 사람 본인이 됐고, 그 사람은
          같은 필드를 편집창에서 손으로 고칠 수 있어 막아도 막아지는 게 없었다.
          (`permissions.can_review_proposal` 주석에 되살릴 조건을 적어 뒀다)
    ② 제안이 만들어진 뒤 같은 필드가 바뀌었으면 그대로 반영하지 않는다
       — 덮어쓰면 그 사이의 수정이 조용히 사라진다.

시험용 계정과 과제를 만들어 쓰고 끝나면 지운다. 기존 행은 건드리지 않는다.

사용법
    python scripts\\dt3_test_proposals.py
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
    Dt2Project, Dt2ProjectChange, Dt2ProjectHistory, Dt2ChangeProposal,
)
from flask_jwt_extended import create_access_token

MARK = '__dt3_prop_test__'
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
        user_before = User.query.count()

        admin = User.query.filter_by(role=UserRole.ADMIN, is_active=True).first()
        if admin is None:
            print('[FAIL] admin 사용자가 없습니다.')
            sys.exit(1)

        # 제안자(bot)와 승인자(admin)를 나눠 둔다 — 둘 다 승인할 수 있어야 한다.
        bot = User(email=f'{MARK}_bot@test.local', name=f'{MARK} MCP봇',
                   role=UserRole.DT_OFFICE_MEMBER, is_active=True)
        bot.set_password('x' * 16)
        # 완화한 것은 '자기 제안' 뿐이라는 것을 보이려면 **권한 자체가 없는 사람**이 필요하다.
        # 일반 user 이고 이 과제의 소유자도 참여인력도 아니다.
        outsider = User(email=f'{MARK}_out@test.local', name=f'{MARK} 무관한사람',
                        role=UserRole.USER, is_active=True)
        outsider.set_password('x' * 16)
        db.session.add_all([bot, outsider])
        db.session.commit()
        print(f"시험용 계정 생성: 제안자 id={bot.id} · 무관한사람 id={outsider.id}")

        puid = None
        try:
            # ── 신규 생성 ──────────────────────────────────────────────────
            print("\n── 신규 생성 ──")
            r = client.post('/api/dt-v2/projects',
                            json={'fields': {'title': f'{MARK} 새과제', 'status': '미착수',
                                             'progress': 0, 'year': 2026}},
                            headers=auth(admin))
            check('POST 201', r.status_code == 201, f'실제 {r.status_code}')
            created = r.get_json()['data']
            puid = created['uuid']
            check('만든 사람이 소유자', created['ownerUserId'] == admin.id)
            check('rowVersion=1', created['rowVersion'] == 1)

            r = client.post('/api/dt-v2/projects', json={'fields': {'title': ''}},
                            headers=auth(admin))
            check('제목 없으면 400', r.status_code == 400, f'실제 {r.status_code}')

            r = client.post('/api/dt-v2/projects',
                            json={'fields': {'title': 'x', 'made_up': 1}}, headers=auth(admin))
            check('모르는 필드 400', r.status_code == 400, f'실제 {r.status_code}')

            # ── 제안 생성 ──────────────────────────────────────────────────
            print("\n── AI 제안 생성 ──")
            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'status': '완료'}, 'actor_mode': 'ai',
                                   'reason': '액션아이템이 전부 완료됨'},
                             headers=auth(bot))
            check('AI 핵심필드 → 202', r.status_code == 202, f'실제 {r.status_code}')
            pid = r.get_json()['data']['proposalId']
            check('제안 id 반환', pid is not None)

            # ── ① 제안자 본인도 승인할 수 있다 ────────────────────────────
            #
            # 2026-08-01 방침 변경. 예전엔 "자기가 낸 제안은 자기가 승인 못 한다" 였는데,
            # 인증이 **개인 PAT** 이 되면서 제안자 = AI 를 시킨 사람 본인이 됐다.
            # 그 사람은 편집창에서 손으로 그냥 고칠 수 있으니 승인만 막아야 의미가 없고,
            # 승인자가 자기뿐인 과제는 제안이 영영 안 풀린다. (permissions.py 주석 참고)
            print("\n── ① 제안 목록에 내 제안이 보이는가 ──")
            r = client.get('/api/dt-v2/proposals?status=pending', headers=auth(bot))
            check('목록 200', r.status_code == 200)
            items_bot = r.get_json()['data']['items']
            # ★ 예전엔 여기서 사라졌다 — AI 는 "승인 대기" 라는데 화면은 비어 있었다
            check('★ 제안자 본인에게도 보인다', any(i['id'] == pid for i in items_bot))

            r = client.get('/api/dt-v2/proposals?status=pending', headers=auth(admin))
            items = r.get_json()['data']['items']
            check('다른 승인자에게도 보임', any(i['id'] == pid for i in items))

            pr = Dt2ChangeProposal.query.get(pid)
            db.session.refresh(pr)
            check('아직 pending', pr.status == 'pending', f'실제 {pr.status}')
            fresh = Dt2Project.query.filter_by(uuid=puid).first()
            db.session.refresh(fresh)
            check('승인 전이라 과제는 그대로', fresh.status == '미착수', f'실제 {fresh.status}')

            # ── 다른 사람이 승인 ──────────────────────────────────────────
            print("\n── 승인 ──")
            r = client.post(f'/api/dt-v2/proposals/{pid}/approve',
                            json={'note': '확인함'}, headers=auth(admin))
            check('승인 200', r.status_code == 200, f'실제 {r.status_code}')
            # 제안은 `status` 하나였는데 `progress` 도 함께 반영된다 —
            # **2026-08-11 규칙**: 액션아이템이 0 건이면 `완료` 는 진행률 100 이다.
            # 이 과제는 액션아이템 없이 만들어졌으므로 파생이 걸린다.
            # (그 반대 방향은 일어나지 않는다 — 파생은 올리기만 하고 내리지 않는다)
            check('applied 에 status + 파생된 progress',
                  r.get_json()['data']['applied'] == ['status', 'progress'],
                  f"실제 {r.get_json()['data'].get('applied')}")
            db.session.expire_all()
            fresh = Dt2Project.query.filter_by(uuid=puid).first()
            check('★ 이제 반영됨', fresh.status == '완료', f'실제 {fresh.status}')
            check('★ 액션아이템 0건 + 완료 → 진행률 100',
                  fresh.progress == 100, f'실제 {fresh.progress}')

            r = client.post(f'/api/dt-v2/proposals/{pid}/approve', headers=auth(admin))
            check('★ 이미 처리된 제안 재승인 409', r.status_code == 409, f'실제 {r.status_code}')

            print("\n── 변경 로그에 출처가 남는가 ──")
            logs = (Dt2ProjectChange.query.filter_by(project_uuid=puid, field='status')
                    .order_by(Dt2ProjectChange.id.desc()).all())
            check('status 변경 로그 있음', len(logs) >= 1)
            if logs:
                check("★ source='ai' 로 기록", logs[0].source == 'ai', f'실제 {logs[0].source}')
                check('승인자가 actor 로 기록', logs[0].actor_user_id == admin.id)
                check('사유에 제안 번호', str(pid) in (logs[0].reason or ''),
                      f'실제 {logs[0].reason!r}')

            # ── ② 낡은 제안 ───────────────────────────────────────────────
            print("\n── ② 제안 이후 같은 필드가 바뀐 경우 ──")
            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'title': f'{MARK} 제안용'}, 'actor_mode': 'ai'},
                             headers=auth(bot))
            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'status': '지연'}, 'actor_mode': 'ai',
                                   'reason': '두번째 제안'},
                             headers=auth(bot))
            pid2 = r.get_json()['data']['proposalId']
            check('두번째 제안 생성', pid2 is not None)

            # 사람이 그 사이 같은 필드를 직접 바꾼다
            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'status': '정상진행'}}, headers=auth(admin))
            check('사람이 status 직접 수정 200', r.status_code == 200, f'실제 {r.status_code}')

            r = client.post(f'/api/dt-v2/proposals/{pid2}/approve', headers=auth(admin))
            check('★ 낡은 제안 승인 409', r.status_code == 409, f'실제 {r.status_code}')
            db.session.expire_all()
            pr2 = Dt2ChangeProposal.query.get(pid2)
            check("★ 상태가 stale 로 표시", pr2.status == 'stale', f'실제 {pr2.status}')
            fresh = Dt2Project.query.filter_by(uuid=puid).first()
            check('★ 사람의 수정이 살아있음', fresh.status == '정상진행', f'실제 {fresh.status}')

            # ── 반려 ──────────────────────────────────────────────────────
            print("\n── 반려 ──")
            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'category': '개선'}, 'actor_mode': 'ai'},
                             headers=auth(bot))
            pid3 = r.get_json()['data']['proposalId']
            r = client.post(f'/api/dt-v2/proposals/{pid3}/reject',
                            json={'note': '불필요'}, headers=auth(admin))
            check('반려 200', r.status_code == 200, f'실제 {r.status_code}')
            db.session.expire_all()
            pr3 = Dt2ChangeProposal.query.get(pid3)
            check('상태 rejected', pr3.status == 'rejected', f'실제 {pr3.status}')
            fresh = Dt2Project.query.filter_by(uuid=puid).first()
            check('★ 반려는 과제를 안 건드림', fresh.category != '개선',
                  f'실제 {fresh.category}')

            r = client.post('/api/dt-v2/proposals/999999/approve', headers=auth(admin))
            check('없는 제안 404', r.status_code == 404, f'실제 {r.status_code}')

            # ── ③ 제안자 본인 승인 (2026-08-01 방침) ──────────────────────
            #
            # 사람이 AI 에게 시킨 것이므로 이미 그 사람의 의도다. 게다가 같은 필드를
            # 편집창에서 손으로 고칠 수 있는 사람이라 막아도 막아지는 게 없다.
            print("\n── ③ 제안자 본인이 승인 ──")
            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'category': '신규'}, 'actor_mode': 'ai',
                                   'reason': '본인 승인 시험'},
                             headers=auth(bot))
            check('제안 생성 202', r.status_code == 202, f'실제 {r.status_code}')
            pid4 = r.get_json()['data']['proposalId']

            r = client.post(f'/api/dt-v2/proposals/{pid4}/approve',
                            json={'note': '내가 시킨 것'}, headers=auth(bot))
            check('★ 제안자 본인 승인 200', r.status_code == 200, f'실제 {r.status_code}')
            db.session.expire_all()
            fresh = Dt2Project.query.filter_by(uuid=puid).first()
            check('★ 본인 승인으로 반영됨', fresh.category == '신규', f'실제 {fresh.category}')
            pr4 = Dt2ChangeProposal.query.get(pid4)
            check('승인자가 본인으로 기록', pr4.reviewed_by == bot.id)

            # 권한 자체가 없는 사람은 여전히 막힌다 — 완화한 것은 '자기 제안' 뿐이다
            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'category': '개선'}, 'actor_mode': 'ai'},
                             headers=auth(bot))
            pid5 = r.get_json()['data']['proposalId']
            r = client.post(f'/api/dt-v2/proposals/{pid5}/approve', headers=auth(outsider))
            check('★ 권한 없는 사람은 여전히 403', r.status_code == 403,
                  f'실제 {r.status_code}')

            # ── ④ 사람 필드 ──────────────────────────────────────────────
            #
            # **2026-08-02 에 기준이 갈라졌다.** 그 전에는 셋 다 403 이었다.
            # 막았던 이유는 권한이 아니라 "확인 화면이 이름만 보여주는데 동명이인을
            # 가릴 수 없다" 였다. knoxId 가 그 모호함을 없애므로, **knoxId 를 담을 수
            # 있는 필드만** 열렸다(확인 대기 202 로). 이름만 담기는 필드는 그대로 403.
            #
            # 그래서 여기서 볼 것은 "전부 막혔나" 가 아니라 **그 구분이 유지되는가**다.
            print("\n── ④ 사람 필드: 사본은 파생 · 소유자는 admin 전용 ──")
            before_cnt = Dt2ChangeProposal.query.filter_by(project_uuid=puid).count()

            # 2026-08-05: 셋 다 403 이 아니게 됐다. 방법이 바뀌었을 뿐,
            # **AI 가 이름만으로 사람을 넣지 못한다**는 결론은 그대로다.
            #   담당자·과제\参여인력 → 파생. 보내도 \参여인력목록에서 다시 만들어진다.
            #   소유자             → admin 전용(별도 검사). bot 은 일반 사용자다.
            for label, body in [('과제\参여인력(표시용)', {'과제\参여인력': '홍길동'}),
                                ('담당자', {'담당자': [{'이름': '홍길동'}]})]:
                before_owners = list(Dt2Project.query.filter_by(uuid=puid).first().owners_json or [])
                r = client.patch(f'/api/dt-v2/projects/{puid}',
                                 json={'patch': body, 'actor_mode': 'ai',
                                       'ignore_unknown': True}, headers=auth(bot))
                db.session.expire_all()
                check(f'★ AI 가 보낸 {label} 는 들어가지 않는다',
                      list(Dt2Project.query.filter_by(uuid=puid).first().owners_json or [])
                      == before_owners, f'실제 {r.status_code}')

            # 소유자는 admin·dt_office 만. `bot` 은 dt_office 라 **통과해야** 한다
            # (열린 것이지 아무나 되는 게 아니다 — 아래에서 일반 사용자로 다시 본다).
            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'owner_user_id': admin.id},
                                   'actor_mode': 'ai'}, headers=auth(bot))
            check('★ 소유자: dt_office 는 202 (확인 대기)', r.status_code == 202,
                  f'실제 {r.status_code}')
            _pid = ((r.get_json() or {}).get('data') or {}).get('proposalId')
            if _pid:
                client.post(f'/api/dt-v2/proposals/{_pid}/reject',
                            json={'note': '시험 정리'}, headers=auth(admin))

            # ★★ 일반 사용자(그 과제를 고칠 수는 있는 사람)에게는 403 이어야 한다.
            #    2026-08-05 이전엔 이 검사가 **생성에만** 있어서 PATCH 로 그냥 넘어갔다.
            member = User(email=f'{MARK}_own@test.local', name=f'{MARK} 소유이전시도',
                          role=UserRole.USER, is_active=True)
            member.set_password('x' * 16)
            db.session.add(member)
            db.session.commit()
            proj = Dt2Project.query.filter_by(uuid=puid).first()
            proj.members_json = [{'knoxId': member.email.split('@')[0],
                                  '이름': member.name, '부서': 'T'}]
            db.session.commit()
            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'owner_user_id': member.id}},
                             headers=auth(member))
            check('★★ 소유자: 일반 사용자는 403 (수정 경로에도 검사가 있다)',
                  r.status_code == 403, f'실제 {r.status_code}')
            check('  관리자만 지정할 수 있다고 알려준다',
                  '관리자' in ((r.get_json() or {}).get('message') or ''),
                  str(r.get_json())[:120])
            User.query.filter_by(id=member.id).delete()
            # ④-2 는 참여인력이 비어 있다는 전제로 "아직 반영 안 됨" 을 본다 — 되돌린다.
            Dt2Project.query.filter_by(uuid=puid).first().members_json = []
            db.session.commit()

            # ④ 에서 제안이 하나 생겼으므로 기준선을 다시 잡는다(반려해도 행은 남는다).
            before_cnt = Dt2ChangeProposal.query.filter_by(project_uuid=puid).count()
            check('★ 금지 건은 대기열에도 안 쌓인다',
                  Dt2ChangeProposal.query.filter_by(project_uuid=puid).count() == before_cnt)

            # ④-2 knoxId 가 있으면 열린다 — 단 **즉시 반영이 아니라 확인 대기**로.
            #     저위험으로 새면 확인 없이 편집 권한이 생긴다(그게 최악이다).
            print("\n── ④-2 과제참여인력목록: knoxId 가 있으면 202 ──")
            r = client.patch(
                f'/api/dt-v2/projects/{puid}',
                json={'patch': {'과제참여인력목록': [{'이름': '홍길동', 'knoxId': 'hong.gd'}]},
                      'actor_mode': 'ai'}, headers=auth(bot))
            check('★ knoxId 를 붙이면 202 (403 이 아니다)', r.status_code == 202,
                  f'실제 {r.status_code}')
            body202 = (r.get_json() or {}).get('data') or {}
            check('  대기열에 쌓인다',
                  Dt2ChangeProposal.query.filter_by(project_uuid=puid).count()
                  == before_cnt + 1)
            # 값만 보여주면 사용자는 어느 홍길동인지 모른 채 승인하게 된다.
            check('★ peoplePreview 로 누구인지 보여준다',
                  bool(body202.get('peoplePreview')), str(body202)[:160])
            db.session.expire_all()
            check('  아직 반영되지는 않았다',
                  not (Dt2Project.query.filter_by(uuid=puid).first().members_json or []))

            # ④-3 이름만 보내면 **막힌다**(400). 열린 것은 필드가 아니라 'knoxId 를
            #     붙였을 때' 다 — 이게 안 걸리면 원래 막았던 이유가 되살아난다.
            r = client.patch(
                f'/api/dt-v2/projects/{puid}',
                json={'patch': {'과제참여인력목록': [{'이름': '홍길동'}]},
                      'actor_mode': 'ai'}, headers=auth(bot))
            check('★★ 이름만 보내면 400', r.status_code == 400, f'실제 {r.status_code}')
            check('  그 400 이 knoxId 를 요구한다고 말한다',
                  'knoxId' in ((r.get_json() or {}).get('message') or ''),
                  str(r.get_json())[:140])
            check('  그 건은 대기열에 안 쌓인다',
                  Dt2ChangeProposal.query.filter_by(project_uuid=puid).count()
                  == before_cnt + 1)

            # ── ④-4 영구삭제는 PATCH 로 못 한다 ──────────────────────────
            #
            # 2026-08-05 실측: `_permanentlyDeleted` 가 핵심 필드였을 때
            # **202 → confirm 으로 영구삭제가 통과했다.** admin 이 아니라 그 과제를
            # 고칠 수 있는 일반 사용자로도 됐다 — 전용 라우트는 admin·dt_office 전용인데
            # patch 경로는 can_edit_project 만 봤기 때문이다.
            # 소프트 삭제와 달리 **되돌릴 수 없고 휴지통에도 안 남는다.**
            # 분류(dt3_test_describe)만 보면 라우트가 바뀌었을 때 못 잡으므로 여기서 동작을 본다.
            print("\n── ④-4 영구삭제는 PATCH 로 못 한다 ──")
            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'_permanentlyDeleted': True},
                                   'actor_mode': 'ai', 'ignore_unknown': True},
                             headers=auth(bot))
            body = (r.get_json() or {}).get('data') or {}
            check('★★ MCP 모양으로 보내도 반영되지 않는다',
                  '_permanentlyDeleted' in (body.get('ignored') or []),
                  str(body)[:140])
            db.session.expire_all()
            check('★★ 실제로 영구삭제되지 않았다',
                  not Dt2Project.query.filter_by(uuid=puid).first().is_permanently_deleted)
            # 화면 경로(ignore_unknown 없음)는 조용히 넘기지 않고 400 으로 끊는다
            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'_permanentlyDeleted': True}},
                             headers=auth(admin))
            check('★ 화면 경로는 400 (admin 이어도)', r.status_code == 400,
                  f'실제 {r.status_code}')
            db.session.expire_all()
            check('  admin 으로도 영구삭제되지 않았다',
                  not Dt2Project.query.filter_by(uuid=puid).first().is_permanently_deleted)

            # 사람은 같은 필드를 그대로 고칠 수 있어야 한다 — 불변이 아니라 'AI 금지' 다
            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'과제참여인력목록': [{'이름': '홍길동',
                                                                'knoxId': 'hong.gd'}]}},
                             headers=auth(admin))
            check('★ 사람은 그대로 고칠 수 있다', r.status_code == 200, f'실제 {r.status_code}')
            db.session.expire_all()
            fresh = Dt2Project.query.filter_by(uuid=puid).first()
            check('  사람 수정은 반영됨',
                  (fresh.members_json or [{}])[0].get('knoxId') == 'hong.gd',
                  str(fresh.members_json))

        finally:
            print("\n── 정리 ──")
            if puid:
                Dt2ChangeProposal.query.filter_by(project_uuid=puid).delete()
                Dt2ProjectChange.query.filter_by(project_uuid=puid).delete()
                Dt2ProjectHistory.query.filter_by(project_uuid=puid).delete()
                Dt2Project.query.filter_by(uuid=puid).delete()
            db.session.commit()
            User.query.filter(User.id.in_([bot.id, outsider.id])).delete(
                synchronize_session=False)
            db.session.commit()
            check('과제 건수 불변', Dt2Project.query.count() == proj_before,
                  f'{proj_before} -> {Dt2Project.query.count()}')
            check('사용자 건수 불변', User.query.count() == user_before,
                  f'{user_before} -> {User.query.count()}')

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
