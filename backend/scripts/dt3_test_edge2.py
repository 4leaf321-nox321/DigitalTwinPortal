"""
V2 API 경계 시험 2 — 동시성·원자성·간섭 (개발 DB 전용)

edge 1 이 "한 번에 하나씩 보내는 잘못된 요청" 을 봤다면, 여기는
**동시에 일어나는 일**과 **중간에 실패하는 일**을 본다.

    A. 동기화 ↔ V2 쓰기 간섭 ★ 두 경로가 같은 dt2 테이블을 쓴다
    B. 진짜 동시 요청        스레드 2개가 같은 행을 동시에 고칠 때 (lost update)
    C. 제안 동시 승인        둘이 같이 승인 버튼을 누를 때
    D. 원자성                중간에 실패하면 앞부분이 남는가
    E. 대용량 페이로드
    F. 남은 입력 검증

사용법
    python scripts\\dt3_test_edge2.py
"""

from __future__ import annotations

import json
import os
import sys
import threading
import time
import uuid as uuidlib

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.extensions import db
from app.modules.auth.models import User, UserRole
from app.modules.digital_twin_dashboard import v2_sync
from app.modules.digital_twin_dashboard.models import DashboardData
from app.modules.digital_twin_dashboard.models_v2 import (
    Dt2Project, Dt2Performance, Dt2ProjectPerformance,
    Dt2ProjectChange, Dt2ProjectHistory, Dt2PerformanceHistory, Dt2ChangeProposal,
)
from flask_jwt_extended import create_access_token
from sqlalchemy import or_

MARK = '__dt3_edge2__'
results = []


def check(desc, cond, extra=''):
    results.append((desc, bool(cond)))
    print(f"  {'[OK]  ' if cond else '[FAIL]'} {desc}" + (f"   {extra}" if not cond and extra else ''))


def auth(u):
    # 컷오버 전 쓰기 차단을 시험에서는 통과시킨다 (config.DT2_ALLOW_TEST_WRITE_HEADER)
    return {'Authorization': f'Bearer {create_access_token(identity=str(u.id))}',
            'X-DT2-Allow-Write': 'test'}


def wait_sync(timeout=40):
    for _ in range(timeout * 10):
        st = v2_sync.sync_status()
        if not st['running'] and not st['pending']:
            return st
        time.sleep(0.1)
    return v2_sync.sync_status()


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    app = create_app()
    with app.app_context():
        client = app.test_client()
        admin = User.query.filter_by(role=UserRole.ADMIN, is_active=True).first()
        n_proj = Dt2Project.query.count()

        # ⚠️ A 절과 G 절은 **컷오버 전에만 성립한다.**
        #     A — v2_sync 가 V2 쓰기를 덮는지 본다. 그런데 `DT2_WRITE_ENABLED=true` 면
        #         v2_sync 는 **스스로 멈춘다**(설계가 그렇다) → 덮을 수가 없다.
        #     G — 쓰기가 503 으로 막히는지 본다. 컷오버 후에는 200 이 정상이다.
        #     게다가 G 의 '생성도 503' 이 201 로 통과해 **시험용 과제가 남는다**
        #     (2026-08-01 실측: 과제 수 337 → 338).
        # 컷오버는 2026-07-31 에 끝났고 `.env` 의 true 는 되돌리면 안 되는 값이므로,
        # 실패로 두지 않고 **건너뛰되 눈에 보이게** 알린다. 조용히 빼면 나중에
        # "이 시험은 원래 안 도나?" 를 아무도 모른다.
        pre_cutover = not app.config.get('DT2_WRITE_ENABLED', False)
        if not pre_cutover:
            print('  [건너뜀] A·G 절은 컷오버 전 전용이다 '
                  '(DT2_WRITE_ENABLED=true → v2_sync 정지 · 쓰기 허용이 정상).')

        puid = str(uuidlib.uuid4())
        v1_uuid = orig_desc = None
        try:
            db.session.add(Dt2Project(
                uuid=puid, code=MARK, title=MARK, status='정상진행', progress=10,
                owner_user_id=admin.id, row_version=1, extra_fields={},
                is_deleted=False, is_permanently_deleted=False))
            db.session.commit()

            # ── A. 동기화 ↔ V2 쓰기 ─────────────────────────────────────────
            print("\n── A. 배치 동기화와 V2 쓰기가 부딪히면 ──")
            head = DashboardData.query.first()
            projs = head.projects or []
            idx = next(i for i, p in enumerate(projs)
                       if isinstance(p, dict) and p.get('uuid') and not p.get('_deleted'))
            v1_uuid = projs[idx]['uuid']
            # 여기서 고르는 것은 **실재하는 과제**라 액션아이템이 있을 수 있다.
            # 진행률은 액션아이템에서 파생되는 값이라 직접 쓰면 무시된다(routes_v2 (c-3)).
            # 이 절이 보려는 것은 "V1 에도 있는 과제를 V2 로 고칠 수 있나" 이므로
            # 파생과 무관한 과제상세설명으로 본다.
            orig_desc = Dt2Project.query.filter_by(uuid=v1_uuid).first().description
            v2_only = f'{MARK} V2 전용 수정'

            r = client.patch(f'/api/dt-v2/projects/{v1_uuid}',
                             json={'patch': {'description': v2_only}}, headers=auth(admin))
            check('V1 에도 있는 과제를 V2 로 수정 200', r.status_code == 200,
                  f'실제 {r.status_code}')
            db.session.expire_all()
            check('dt2 에 반영됨',
                  Dt2Project.query.filter_by(uuid=v1_uuid).first().description == v2_only)

            if pre_cutover:
                v2_sync.request_sync('edge2-test')
                wait_sync()
                db.session.expire_all()
                after = Dt2Project.query.filter_by(uuid=v1_uuid).first().description
                overwritten = (after != v2_only)
                print(f"     동기화 후 description = {after!r} (V2 로 쓴 값 {v2_only!r}, "
                      f"V2 이전 값 {orig_desc!r})")
                check('★★ 동기화가 V2 쓰기를 덮는다 — 컷오버 전에는 이것이 정상',
                      overwritten,
                      '덮지 않았다면 동기화가 제대로 안 돈 것이다')
                print("     → 컷오버 전에 V2 쓰기 API 를 실제로 쓰면 안 된다는 뜻이다.")
            else:
                print('     [건너뜀] 컷오버 후에는 v2_sync 가 멈춰 있어 덮을 수가 없다.')

            # V2 전용 과제(=V1 에 없음)는 동기화가 건드리지 않아야 한다
            db.session.expire_all()
            check('★ V1 에 없는 과제는 동기화가 안 건드림',
                  Dt2Project.query.filter_by(uuid=puid).first() is not None)

            # ── B. 진짜 동시 요청 ───────────────────────────────────────────
            print("\n── B. 스레드 2개가 같은 과제를 동시에 수정 ──")
            db.session.expire_all()
            before_v = Dt2Project.query.filter_by(uuid=puid).first().row_version
            codes = []
            lock = threading.Lock()

            def hit(field, value):
                with app.app_context():
                    c = app.test_client()
                    rr = c.patch(f'/api/dt-v2/projects/{puid}',
                                 json={'patch': {field: value}}, headers=auth(admin))
                    with lock:
                        codes.append(rr.status_code)
                    db.session.remove()

            ts = [threading.Thread(target=hit, args=('progress', 41)),
                  threading.Thread(target=hit, args=('description', '동시'))]
            for t in ts:
                t.start()
            for t in ts:
                t.join()
            check('둘 다 응답함', len(codes) == 2, f'실제 {codes}')
            check('★ 둘 다 성공 (다른 필드라 충돌 없음)', all(c == 200 for c in codes),
                  f'실제 {codes}')
            db.session.expire_all()
            row = Dt2Project.query.filter_by(uuid=puid).first()
            check('★ 잃어버린 갱신 없음 — 두 값이 모두 반영',
                  row.progress == 41 and row.description == '동시',
                  f'실제 progress={row.progress} desc={row.description!r}')
            check('★ row_version 이 2 증가', row.row_version == before_v + 2,
                  f'실제 {before_v} -> {row.row_version}')

            print("\n── B-2. 같은 필드를 동시에 ──")
            codes.clear()
            ts = [threading.Thread(target=hit, args=('progress', 51)),
                  threading.Thread(target=hit, args=('progress', 52))]
            for t in ts:
                t.start()
            for t in ts:
                t.join()
            check('둘 다 응답 (행 락으로 직렬화)', len(codes) == 2 and all(
                c == 200 for c in codes), f'실제 {codes}')
            db.session.expire_all()
            row = Dt2Project.query.filter_by(uuid=puid).first()
            check('★ 최종값이 둘 중 하나', row.progress in (51, 52), f'실제 {row.progress}')
            n_chg = Dt2ProjectChange.query.filter_by(
                project_uuid=puid, field='progress').count()
            check('★ 변경 로그가 요청 수만큼 남음 (유실 없음)', n_chg >= 3,
                  f'실제 {n_chg}건')

            # ── C. 제안 동시 승인 ───────────────────────────────────────────
            print("\n── C. 같은 제안을 둘이 동시에 승인 ──")
            bot = User(email=f'{MARK}_bot@t.local', name=f'{MARK}봇',
                       role=UserRole.DT_OFFICE_MEMBER, is_active=True)
            bot.set_password('x' * 16)
            db.session.add(bot); db.session.commit()
            try:
                r = client.patch(f'/api/dt-v2/projects/{puid}',
                                 json={'patch': {'status': '완료'}, 'actor_mode': 'ai'},
                                 headers=auth(bot))
                pid = r.get_json()['data']['proposalId']
                acodes = []

                def approve():
                    with app.app_context():
                        c = app.test_client()
                        rr = c.post(f'/api/dt-v2/proposals/{pid}/approve',
                                    headers=auth(admin))
                        with lock:
                            acodes.append(rr.status_code)
                        db.session.remove()

                ts = [threading.Thread(target=approve) for _ in range(2)]
                for t in ts:
                    t.start()
                for t in ts:
                    t.join()
                check('★ 정확히 하나만 성공', sorted(acodes).count(200) == 1,
                      f'실제 {acodes}')
                check('★ 나머지는 409 (이미 처리됨)', 409 in acodes, f'실제 {acodes}')
                db.session.expire_all()
                pr = Dt2ChangeProposal.query.get(pid)
                check('제안 상태 approved', pr.status == 'approved', f'실제 {pr.status}')
                n_status = Dt2ProjectChange.query.filter_by(
                    project_uuid=puid, field='status').count()
                check('★ status 가 두 번 적용되지 않음', n_status == 1, f'실제 {n_status}건')
            finally:
                Dt2ChangeProposal.query.filter_by(project_uuid=puid).delete()
                Dt2ProjectChange.query.filter(
                    or_(Dt2ProjectChange.actor_user_id == bot.id,
                        Dt2ProjectChange.on_behalf_of == bot.id)).delete(
                    synchronize_session=False)
                db.session.commit()
                User.query.filter_by(id=bot.id).delete()
                db.session.commit()

            # ── D. 원자성 ──────────────────────────────────────────────────
            print("\n── D. 중간에 실패하면 앞부분이 남는가 ──")
            db.session.expire_all()
            before = Dt2Project.query.filter_by(uuid=puid).first()
            bv, bp = before.row_version, before.progress
            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'progress': 77, 'title': 'ㄱ' * 2000}},
                             headers=auth(admin))
            check('길이 초과 포함 → 400', r.status_code == 400, f'실제 {r.status_code}')
            db.session.expire_all()
            after_row = Dt2Project.query.filter_by(uuid=puid).first()
            check('★★ 같이 보낸 정상 필드도 반영되지 않음 (원자성)',
                  after_row.progress == bp, f'실제 {after_row.progress} (이전 {bp})')
            check('★ row_version 도 안 오름', after_row.row_version == bv,
                  f'실제 {after_row.row_version} (이전 {bv})')

            # ── E. 대용량 ──────────────────────────────────────────────────
            print("\n── E. 대용량 페이로드 ──")
            big = [{'id': f'a{i}', '제목': 'x' * 200, '완료여부': False}
                   for i in range(2000)]
            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'action_items_json': big}},
                             headers=auth(admin))
            check(f'액션아이템 2,000건 ({len(json.dumps(big))//1024}KB) 처리',
                  r.status_code in (200, 400, 413), f'실제 {r.status_code}')
            if r.status_code == 200:
                db.session.expire_all()
                row = Dt2Project.query.filter_by(uuid=puid).first()
                check('★ 진척 이력의 action_total 이 2000',
                      Dt2ProjectHistory.query.filter_by(project_uuid=puid)
                      .order_by(Dt2ProjectHistory.id.desc()).first().action_total == 2000)

            # ── F. 남은 입력 검증 ──────────────────────────────────────────
            print("\n── F. 나머지 입력 ──")
            r = client.post('/api/dt-v2/projects',
                            json={'fields': {'title': '   '}}, headers=auth(admin))
            check('공백만 있는 제목 400', r.status_code == 400, f'실제 {r.status_code}')

            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'title': '이모지 🚀 테스트'}},
                             headers=auth(admin))
            check('이모지 저장 200', r.status_code == 200, f'실제 {r.status_code}')

            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'progress': 50}, 'expected_version': -1},
                             headers=auth(admin))
            check('음수 expected_version — 500 아님', r.status_code != 500,
                  f'실제 {r.status_code}')

            r = client.put(f'/api/dt-v2/projects/{puid}/performances',
                           json={'items': [{'performanceUuid': None}]},
                           headers=auth(admin))
            check('연결에 null uuid — 400', r.status_code == 400, f'실제 {r.status_code}')

            # `<int:>` 는 음수를 안 받으므로 V2 라우트에 매칭되지 않는다.
            # 그러면 SPA catch-all(`@app.route('/<path:path>')`, GET 전용)이 잡아
            # **405** 가 나온다. 앱 전체의 기존 동작이고 V2 결함이 아니다.
            # (API 클라이언트에는 404 가 자연스럽지만, SPA 라우팅을 바꿀 일은 아니다)
            r = client.post('/api/dt-v2/proposals/-1/approve', headers=auth(admin))
            check('음수 제안 id — 404 또는 405 (앱 catch-all 때문)',
                  r.status_code in (404, 405), f'실제 {r.status_code}')
            r = client.post('/api/dt-v2/proposals/999999/approve', headers=auth(admin))
            check('★ 없는 제안 id 는 정상적으로 404', r.status_code == 404,
                  f'실제 {r.status_code}')

            r = client.get('/api/dt-v2/projects?limit=999999', headers=auth(admin))
            check('★ limit 상한이 적용됨',
                  r.status_code == 200 and r.get_json()['data']['limit'] <= 1000,
                  f"실제 {r.get_json()['data'].get('limit') if r.status_code == 200 else r.status_code}")

            # ── G. 컷오버 전 쓰기 차단 ──────────────────────────────────────
            print("\n── G. 컷오버 전 쓰기 차단 ──")
            plain = {'Authorization': f'Bearer {create_access_token(identity=str(admin.id))}'}
            if pre_cutover:
                r = client.patch(f'/api/dt-v2/projects/{puid}',
                                 json={'patch': {'progress': 1}}, headers=plain)
                check('★★ 시험 헤더 없이 쓰면 503', r.status_code == 503, f'실제 {r.status_code}')
                # ⚠️ 이 호출은 **성공하면 안 된다.** 성공하면(201) 시험용 과제가 하나
                #    남아 아래 '과제 건수 불변' 까지 함께 깨진다(2026-08-01 실측).
                r = client.post('/api/dt-v2/projects',
                                json={'fields': {'title': 'x'}}, headers=plain)
                check('★ 생성도 503', r.status_code == 503, f'실제 {r.status_code}')
                r = client.delete(f'/api/dt-v2/projects/{puid}', headers=plain)
                check('★ 삭제도 503', r.status_code == 503, f'실제 {r.status_code}')
            else:
                print('     [건너뜀] 컷오버 후에는 쓰기가 열려 있는 것이 정상이다.')
            # 읽기는 스위치와 무관하다 — 어느 상태에서도 봐야 한다.
            r = client.get(f'/api/dt-v2/projects/{puid}', headers=plain)
            check('★ 읽기는 막히지 않음', r.status_code == 200, f'실제 {r.status_code}')
            r = client.get('/api/dt-v2/data', headers=plain)
            check('★ /data 읽기도 정상', r.status_code == 200, f'실제 {r.status_code}')

        finally:
            print("\n── 정리 ──")
            # A 에서 건드린 V1 과제를 원상복구
            if v1_uuid is not None:
                v2_sync.request_sync('edge2-cleanup')
                wait_sync()
            Dt2ProjectPerformance.query.filter_by(project_uuid=puid).delete()
            Dt2ChangeProposal.query.filter_by(project_uuid=puid).delete()
            Dt2ProjectChange.query.filter_by(project_uuid=puid).delete()
            Dt2ProjectHistory.query.filter_by(project_uuid=puid).delete()
            Dt2Project.query.filter_by(uuid=puid).delete()
            db.session.commit()
            check('과제 건수 불변', Dt2Project.query.count() == n_proj,
                  f'{n_proj} -> {Dt2Project.query.count()}')
            if v1_uuid is not None and pre_cutover:
                db.session.expire_all()
                restored = Dt2Project.query.filter_by(uuid=v1_uuid).first()
                check('★ A 에서 건드린 과제가 V1 값으로 돌아옴',
                      restored.description == orig_desc,
                      f'실제 {restored.description!r} vs {orig_desc!r}')
            elif v1_uuid is not None:
                # 컷오버 후에는 v2_sync 가 안 돌아 원상복구가 안 된다. A 가 바꿔 놓은
                # 값을 **직접** 되돌린다 — 안 그러면 개발 DB 에 시험 값이 그대로 남는다.
                tgt = Dt2Project.query.filter_by(uuid=v1_uuid).first()
                if tgt is not None:
                    tgt.description = orig_desc
                    db.session.commit()
                check('★ A 에서 건드린 과제를 직접 되돌렸다',
                      tgt is None or tgt.description == orig_desc,
                      f'실제 {tgt.description if tgt else "없음"!r} vs {orig_desc!r}')

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
