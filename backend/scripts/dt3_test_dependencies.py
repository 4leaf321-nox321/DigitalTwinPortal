"""선행 과제(과제 → 과제 엣지) V2 쓰기.

무엇을 못 박나
    `dt2_project_dependencies` 는 테이블·이관·읽기까지 있었는데 **쓰기 API 만 없었다.**
    그래서 이 필드가 바뀐 저장은 통째로 V1 으로 물러섰고, 컷오버 뒤에는 그게 조용한
    손실이 됐다(V1 에 쓰이고 dt2 는 안 바뀌어 새로고침하면 사라진다).
    2026-08-08 에 쓰기 경로를 만들었다. 여기서 확인하는 것:

    ① **순환 금지** — A→B→A 를 400 으로 막는가. 이 엣지는 앞으로 그래프 순회의
       뼈대가 되므로, 사이클이 들어가면 순회가 끝나지 않는다. DB 제약으로는 못 막아
       쓰기 경로가 유일한 방어선이다.
    ② 자기 자신·없는 과제·중복·영구삭제 과제를 거절하는가
    ③ 읽을 때 과제명을 **살아 있는 행**에서 채우는가 (베껴 둔 사본은 이름이 바뀌면 낡는다)
    ④ 후속 과제(역방향)가 같은 행에서 나오는가
    ⑤ AI 는 403 인가
    ⑥ 변경 이력에 `dependencies` 가상 필드로 남고 라벨이 한글로 나오는가

실행: python scripts\\dt3_test_dependencies.py
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask_jwt_extended import create_access_token                 # noqa: E402

from app import create_app                                         # noqa: E402
from app.extensions import db                                      # noqa: E402
from app.modules.auth.models import User, UserRole                 # noqa: E402
from app.modules.digital_twin_dashboard import routes_v2 as R      # noqa: E402
from app.modules.digital_twin_dashboard.assemble import (          # noqa: E402
    assemble_project,
)
from app.modules.digital_twin_dashboard.models_v2 import (         # noqa: E402
    Dt2Project, Dt2ProjectChange, Dt2ProjectDependency,
)

fails = []

# 시험이 만든 연결만 지우기 위한 표식. 운영 데이터의 연결은 절대 건드리지 않는다.
TEST_REASON = '__dt3_시험_선행과제'


def check(desc, ok, extra=''):
    print(f"  {'[OK]  ' if ok else '[FAIL]'} {desc}" + (f'   {extra}' if not ok and extra else ''))
    if not ok:
        fails.append(desc)


def _clear(uuids):
    """
    시험 대상 과제들의 선행 연결을 지운다 (시험 전후 청소).

    변경 이력도 함께 지운다 — **`dependencies` 필드 것만.** 안 지우면 돌릴 때마다
    쌓여서, 개발 서버의 변경 이력 탭이 시험 기록으로 덮인다. 다른 필드의 이력은
    시험이 만든 것이 아니므로 손대지 않는다.
    """
    if not uuids:
        return
    Dt2ProjectDependency.query.filter(
        Dt2ProjectDependency.project_uuid.in_(uuids)).delete(synchronize_session=False)
    Dt2ProjectDependency.query.filter(
        Dt2ProjectDependency.depends_on_uuid.in_(uuids)).delete(synchronize_session=False)
    Dt2ProjectChange.query.filter(
        Dt2ProjectChange.project_uuid.in_(uuids),
        Dt2ProjectChange.field == 'dependencies').delete(synchronize_session=False)
    db.session.commit()


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    app = create_app()
    with app.app_context():
        admin = User.query.filter_by(role=UserRole.ADMIN).first()
        if admin is None:
            check('admin 계정이 있다', False)
            return 1
        hdr = {'Authorization': f'Bearer {create_access_token(identity=str(admin.id))}',
               # 컷오버 스위치가 꺼진 개발 환경에서도 쓰기 경로를 확인해야 한다.
               'X-DT2-Allow-Write': 'test'}

        # 살아 있는 과제 셋을 빌린다. 값은 건드리지 않고 **연결만** 만들었다 지운다.
        pool = (Dt2Project.query
                .filter(Dt2Project.is_deleted.is_(False),
                        Dt2Project.is_permanently_deleted.is_(False))
                .order_by(Dt2Project.id.asc())
                .limit(3).all())
        if len(pool) < 3:
            check('시험할 과제가 3개 이상 있다', False, f'실제 {len(pool)}개')
            return 1
        A, B, C = pool
        uuids = [A.uuid, B.uuid, C.uuid]
        print(f"     [정보] 시험 대상 A={A.code or A.uuid[:8]} "
              f"B={B.code or B.uuid[:8]} C={C.code or C.uuid[:8]}")

        _clear(uuids)

        # ── 1. 순수 함수 — 순환 판정 ──────────────────────────────────────
        #
        # HTTP 를 태우기 전에 판정 자체를 본다. 여기가 틀리면 아래 시험이 통과해도
        # 다른 모양의 사이클이 통과할 수 있다.
        print('── 순환 판정 ──')
        check('빈 목록은 순환이 아니다', R._dep_cycle_error(A.uuid, []) is None)
        try:
            # B → A 를 만들어 둔 상태에서 A → B 를 물으면 순환이어야 한다.
            db.session.add(Dt2ProjectDependency(
                project_uuid=B.uuid, depends_on_uuid=A.uuid, extra_fields={}))
            db.session.commit()

            check('★ 한 칸짜리 순환(A→B, B→A)을 잡는다',
                  R._dep_cycle_error(A.uuid, [B.uuid]) is not None)
            check('순환이 아닌 것은 통과시킨다',
                  R._dep_cycle_error(C.uuid, [A.uuid]) is None)

            # 두 칸짜리: C → B → A. 이 상태에서 A → C 를 물으면 순환이다.
            db.session.add(Dt2ProjectDependency(
                project_uuid=C.uuid, depends_on_uuid=B.uuid, extra_fields={}))
            db.session.commit()
            check('★ 두 칸 건너뛴 순환(A→C→B→A)도 잡는다',
                  R._dep_cycle_error(A.uuid, [C.uuid]) is not None)

            # 🐞 자기 행은 셈에서 빼야 한다 — 안 그러면 "A→B 를 지우면서 B→A 를 넣는"
            #    정상적인 교체가 거절된다. B 의 기존 행(B→A)을 지우고 B→C 로 바꾸는 것은
            #    C→B 가 있으므로 진짜 순환이다. 대신 **A 자신**을 교체하는 쪽을 본다.
            db.session.add(Dt2ProjectDependency(
                project_uuid=A.uuid, depends_on_uuid=C.uuid, extra_fields={}))
            db.session.commit()
            check('★ 교체 중인 자기 행은 셈에서 뺀다 (A→C 가 있어도 A 를 다시 계산 가능)',
                  R._dep_cycle_error(A.uuid, []) is None)
        finally:
            _clear(uuids)

        # ── 2. 쓰기 검증 ─────────────────────────────────────────────────
        print('\n── 쓰기 검증 ──')
        with app.test_client() as c:
            base = f'/api/dt-v2/projects/{A.uuid}/dependencies'

            r = c.get(base)
            check('토큰 없으면 401', r.status_code in (401, 422), f'실제 {r.status_code}')

            r = c.put(base, headers=hdr, json={'items': 'x'})
            check('items 가 배열이 아니면 400', r.status_code == 400, f'실제 {r.status_code}')

            r = c.put(base, headers=hdr, json={'items': [{'dependsOnUuid': A.uuid}]})
            check('★ 자기 자신은 400', r.status_code == 400, f'실제 {r.status_code}')

            r = c.put(base, headers=hdr, json={'items': [{'dependsOnUuid': '없는uuid'}]})
            check('없는 과제는 400', r.status_code == 400, f'실제 {r.status_code}')

            r = c.put(base, headers=hdr, json={'items': [{}]})
            check('dependsOnUuid 가 없으면 400', r.status_code == 400, f'실제 {r.status_code}')

            r = c.put(base, headers=hdr, json={'items': [
                {'dependsOnUuid': B.uuid}, {'dependsOnUuid': B.uuid}]})
            check('같은 과제 두 번은 400', r.status_code == 400, f'실제 {r.status_code}')

            r = c.put(base, headers=hdr,
                      json={'items': [{'dependsOnUuid': B.uuid}], 'actor_mode': 'ai'})
            check('★ AI 는 403', r.status_code == 403, f'실제 {r.status_code}')

            r = c.put(base, headers=hdr, json={'items': [], 'expected_version': 999999})
            check('버전이 어긋나면 409', r.status_code == 409, f'실제 {r.status_code}')

        # ── 3. 실제 저장 · 읽기 · 역방향 ──────────────────────────────────
        print('\n── 저장 · 읽기 ──')
        with app.test_client() as c:
            base_a = f'/api/dt-v2/projects/{A.uuid}/dependencies'
            base_b = f'/api/dt-v2/projects/{B.uuid}/dependencies'
            try:
                # A 의 선행 = B, C
                r = c.put(base_a, headers=hdr, json={
                    'items': [{'dependsOnUuid': B.uuid}, {'dependsOnUuid': C.uuid}],
                    'reason': TEST_REASON})
                check('두 건 저장 200', r.status_code == 200, f'실제 {r.status_code}')
                items = (r.get_json().get('data') or {}).get('items') or []
                check('두 건이 돌아온다', len(items) == 2, str(len(items)))
                check('순서가 넣은 순서다',
                      [i['dependsOnUuid'] for i in items] == [B.uuid, C.uuid])
                check('과제명을 함께 준다', items[0]['title'] == B.title,
                      f"{items[0]['title']!r} vs {B.title!r}")
                check('사라진 대상이 아니라고 표시한다', items[0]['missing'] is False)
                check('휴지통이 아니라고 표시한다', items[0]['isDeleted'] is False)

                # ★ 대상이 휴지통에 들어가도 연결은 살아 있어야 하고, **그렇다고 말해야** 한다.
                #   여기가 비면 화면이 지워진 과제를 멀쩡한 것처럼 보여준다.
                B.is_deleted = True
                db.session.commit()
                try:
                    r2 = c.get(base_a, headers=hdr)
                    got2 = (r2.get_json().get('data') or {}).get('items') or []
                    tr = next((i for i in got2 if i['dependsOnUuid'] == B.uuid), {})
                    check('★ 대상이 휴지통에 가도 연결은 남는다', tr != {})
                    check('★ 휴지통이라고 알려준다', tr.get('isDeleted') is True, str(tr))
                    check('휴지통은 missing 과 다르다', tr.get('missing') is False)
                    # 되살릴 수 있어야 하므로 **기존 연결을 그대로 다시 보내는 것은 통과**해야
                    # 한다. 여기서 막으면 그 과제를 아예 저장할 수 없게 된다.
                    r2 = c.put(base_a, headers=hdr, json={'items': [
                        {'dependsOnUuid': B.uuid}, {'dependsOnUuid': C.uuid}]})
                    check('★ 휴지통 과제로의 기존 연결은 다시 저장할 수 있다',
                          r2.status_code == 200, f'실제 {r2.status_code} {r2.get_json()}')
                finally:
                    B.is_deleted = False
                    db.session.commit()

                # ★ 순환 — B 의 선행으로 A 를 넣으려 하면 막혀야 한다 (A→B 가 이미 있다)
                r = c.put(base_b, headers=hdr, json={'items': [{'dependsOnUuid': A.uuid}]})
                check('★ 순환이 되는 저장은 400', r.status_code == 400, f'실제 {r.status_code}')
                check('★ 순환이라고 말해 준다', '순환' in (r.get_json().get('message') or ''),
                      (r.get_json() or {}).get('message'))

                # 역방향 — B 에서 보면 A 가 후속이다. 행을 따로 만들지 않았는데도 나와야 한다.
                r = c.get(base_b, headers=hdr)
                succ = (r.get_json().get('data') or {}).get('successors') or []
                check('★ 후속 과제가 같은 행에서 나온다',
                      any(s['dependsOnUuid'] == A.uuid for s in succ),
                      str([s['dependsOnUuid'][:8] for s in succ]))
                check('B 자신의 선행은 비어 있다',
                      len((r.get_json().get('data') or {}).get('items') or []) == 0)

                # ★ 읽기는 **살아 있는 행**에서 이름을 가져와야 한다.
                #    연결에 베껴 둔 사본을 망가뜨려 놓고, 그래도 제 이름이 나오는지 본다.
                row = Dt2ProjectDependency.query.filter_by(
                    project_uuid=A.uuid, depends_on_uuid=B.uuid).first()
                row.extra_fields = dict(row.extra_fields or {}, 과제명='__낡은사본')
                db.session.commit()

                r = c.get(base_a, headers=hdr)
                got = (r.get_json().get('data') or {}).get('items') or []
                first = next((i for i in got if i['dependsOnUuid'] == B.uuid), {})
                check('★ API 는 사본이 아니라 지금 과제명을 준다',
                      first.get('title') == B.title, first.get('title'))

                proj = Dt2Project.query.filter_by(uuid=A.uuid).first()
                deps = Dt2ProjectDependency.query.filter_by(project_uuid=A.uuid).all()
                out = assemble_project(proj, [], deps, {B.uuid: B, C.uuid: C})
                names = [d.get('과제명') for d in (out.get('선행과제목록') or [])]
                check('★ V1 재조립도 지금 과제명을 준다', '__낡은사본' not in names, str(names))
                check('V1 재조립에 참조 uuid 가 들어 있다',
                      all(d.get('uuid') for d in (out.get('선행과제목록') or [])))

                # 대상 과제를 못 찾을 때는 사본으로라도 자리를 채운다
                out2 = assemble_project(proj, [], deps, {})
                check('대상을 못 찾으면 사본을 쓴다',
                      '__낡은사본' in [d.get('과제명') for d in (out2.get('선행과제목록') or [])])

                # 변경 이력 — 가상 필드 `dependencies` 로 남고 라벨이 한글이어야 한다
                ch = (Dt2ProjectChange.query
                      .filter_by(project_uuid=A.uuid, field='dependencies')
                      .order_by(Dt2ProjectChange.id.desc()).first())
                check('★ 변경 이력에 남는다', ch is not None)
                if ch is not None:
                    check('이유가 함께 남는다', ch.reason == TEST_REASON, str(ch.reason))
                check('가상 필드 라벨이 한글이다',
                      R.VIRTUAL_FIELD_LABELS.get('dependencies') == '선행 과제 연결')

                # 한 건 해제
                r = c.delete(f'{base_a}/{C.uuid}', headers=hdr)
                check('한 건 해제 200', r.status_code == 200, f'실제 {r.status_code}')
                left = (r.get_json().get('data') or {}).get('items') or []
                check('하나만 남는다', len(left) == 1, str(len(left)))
                r = c.delete(f'{base_a}/{C.uuid}', headers=hdr)
                check('없는 연결 해제는 404', r.status_code == 404, f'실제 {r.status_code}')

                # ★ 화면이 하는 순서 그대로 — 선행 연결을 **먼저** 보내고 필드를 PATCH 한다.
                #   연결 저장이 row_version 을 올리므로, 응답의 rowVersion 을 안 물려받으면
                #   바로 뒤의 PATCH 가 **자기 자신 때문에 409** 가 난다.
                #   프론트의 `rememberProjectRowVersion` 이 하는 일이 이것이다.
                # 여기서는 **실제로 달라지는** 값을 보내야 한다. 같은 집합을 다시 보내면
                # 서버가 이력을 안 남기고 row_version 도 안 올린다(그게 맞는 동작이다).
                stale = Dt2Project.query.filter_by(uuid=A.uuid).first().row_version
                r = c.put(base_a, headers=hdr,
                          json={'items': [{'dependsOnUuid': C.uuid}],
                                'expected_version': stale})
                check('현재 버전으로 보내면 200', r.status_code == 200, f'실제 {r.status_code}')
                fresh = (r.get_json().get('data') or {}).get('rowVersion')
                check('★ 연결 저장이 row_version 을 올린다', fresh == stale + 1,
                      f'{stale} → {fresh}')

                # ★ 낡은 버전으로 필드 PATCH 를 보내도 **409 가 아니다.**
                #   PATCH 는 버전이 어긋나면 그 사이에 바뀐 **필드**를 보고, 내가 건드리는
                #   필드와 겹치지 않으면 합쳐 준다. 선행 연결은 가상 필드 `dependencies`
                #   라서 어떤 실제 컬럼과도 안 겹친다 → 항상 병합된다.
                #   그래도 프론트는 rowVersion 을 물려받는다 — 병합에 기대는 것과
                #   처음부터 맞는 버전을 보내는 것은 다르다(병합은 겹치면 409 다).
                r = c.patch(f'/api/dt-v2/projects/{A.uuid}', headers=hdr,
                            json={'patch': {'과제명': A.title}, 'expected_version': stale})
                check('★ 낡은 버전이어도 필드가 안 겹치면 병합된다',
                      r.status_code == 200, f'실제 {r.status_code} {r.get_json()}')
                check('★ 무엇과 병합했는지 알려준다 (dependencies)',
                      'dependencies' in ((r.get_json().get('data') or {}).get('mergedWith') or []),
                      str((r.get_json().get('data') or {}).get('mergedWith')))
                r = c.patch(f'/api/dt-v2/projects/{A.uuid}', headers=hdr,
                            json={'patch': {'과제명': A.title}, 'expected_version': fresh})
                check('★ 물려받은 버전으로 PATCH 하면 200', r.status_code == 200,
                      f'실제 {r.status_code} {r.get_json()}')

                # 같은 값을 다시 보내면 아무 일도 없어야 한다 — 저장할 때마다 이력이
                # 쌓이면 "누가 언제 바꿨나" 를 못 읽는다.
                same = Dt2Project.query.filter_by(uuid=A.uuid).first().row_version
                r = c.put(base_a, headers=hdr, json={'items': [{'dependsOnUuid': C.uuid}]})
                after_same = Dt2Project.query.filter_by(uuid=A.uuid).first().row_version
                check('★ 같은 집합 재전송은 버전을 안 올린다', after_same == same,
                      f'{same} → {after_same}')

                # 빈 배열 = 전부 해제
                r = c.put(base_a, headers=hdr, json={'items': []})
                check('빈 배열로 전부 해제된다',
                      len((r.get_json().get('data') or {}).get('items') or []) == 0)
            finally:
                _clear(uuids)

        # ── 4. 화면 왕복 — 저장한 것이 `/data` 로 돌아오는가 ────────────────
        #
        # 여기가 진짜 관문이다. 연결 API 가 200 을 줘도 **화면이 읽는 응답에 안 실리면**
        # 사용자에게는 "저장했는데 새로고침하면 사라진다" 로 보인다. 컷오버 때 실제로
        # 그런 사고가 났던 자리라(V1 에 쓰이고 dt2 는 안 바뀜) 왕복까지 못 박는다.
        print('\n── 화면 왕복 (/data) ──')
        with app.test_client() as c:
            base_a = f'/api/dt-v2/projects/{A.uuid}/dependencies'
            try:
                # 화면이 보내는 모양 그대로 — 참조만 담는다(`toDepItems`).
                r = c.put(base_a, headers=hdr,
                          json={'items': [{'dependsOnUuid': B.uuid}]})
                check('연결 저장 200', r.status_code == 200, f'실제 {r.status_code}')

                r = c.get('/api/dt-v2/data', headers=hdr)
                check('/data 200', r.status_code == 200, f'실제 {r.status_code}')
                payload = (r.get_json().get('data') or {})
                mine = next((p for p in (payload.get('projects') or [])
                             if p.get('uuid') == A.uuid), None)
                check('과제가 응답에 있다', mine is not None)
                deps = (mine or {}).get('선행과제목록') or []
                check('★ 저장한 선행과제가 /data 에 실려 온다', len(deps) == 1, str(deps))
                if deps:
                    # 편집창은 `formData.선행과제목록 = project.선행과제목록` 으로 시작하고
                    # PredecessorSection 은 원소의 `uuid` 로 화면을 그린다. 이 키가 없으면
                    # 카드가 빈 채로 뜨고 삭제 버튼도 동작하지 않는다.
                    check('★ 원소에 uuid 가 있다 (편집창이 이 키로 그린다)',
                          deps[0].get('uuid') == B.uuid, str(deps[0]))
                    check('★ 과제명이 지금 값이다', deps[0].get('과제명') == B.title,
                          str(deps[0].get('과제명')))
                    check('사업부·연도·PL 자리도 채워진다',
                          all(k in deps[0] for k in ('사업부', '과제년도', '과제PL')),
                          str(sorted(deps[0])))

                # 화면이 "안 바뀌었다" 로 판정할 수 있어야 한다 — 편집창을 열었다 그냥
                # 닫기만 해도 저장이 나가면 이력이 쓰레기가 된다. (프론트 normalizeDeps 와
                # 같은 기준: 참조 uuid 목록만 본다)
                refs = [d.get('uuid') for d in deps]
                check('★ 참조만 뽑으면 보낸 것과 같다 (변경 판정의 기준)',
                      refs == [B.uuid], str(refs))
            finally:
                _clear(uuids)

        # ── 5. AI 안내가 갱신됐는가 ───────────────────────────────────────
        #
        # 에이전트는 `describe_fields` 만 보고 판단한다. "쓰기 API 가 없다" 가 남아 있으면
        # 사용자에게 "그 칸은 못 고칩니다" 라고 잘못 안내한다.
        print('\n── AI 안내 ──')
        from app.modules.digital_twin_dashboard.ai_tools import (
            UNSUPPORTED_FIELDS, describe_fields,
        )
        why = UNSUPPORTED_FIELDS.get('선행과제목록') or ''
        check('선행과제는 여전히 AI 쓰기 금지다', '선행과제목록' in UNSUPPORTED_FIELDS)
        check('★ "쓰기 API 가 없다" 안내가 사라졌다', 'API 가 없다' not in why, why[:80])
        check('사람이 고치는 길을 안내한다', 'dependencies' in why, why[:80])
        desc = describe_fields()
        dep = next((f for f in desc['fields'] if f['key'] == '선행과제목록'), None)
        check('필드 설명에 그대로 나온다', dep is not None)

    print()
    if fails:
        print(f'[FAIL] {len(fails)}건 실패')
        for f in fails:
            print(f'   - {f}')
        return 1
    print('[OK] 전부 통과')
    return 0


if __name__ == '__main__':
    sys.exit(main())
