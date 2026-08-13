"""
`describe_fields` 안내가 **정본과 어긋나지 않는지** 검사한다.

왜 이 검사가 필요한가
    안내는 `field_maps.py`(필드 목록)와 `permissions.py`(위험도 분류)에서 만들어진다.
    누가 필드를 추가하고 안내를 안 고치면 **AI 는 "그런 필드 없다" 는 잘못된 전제**로
    움직인다 — 사용자에게는 "저장했다" 고 답하는데 서버는 `ignored` 로 버린 상태가 된다.

    그래서 "정본에 있는 것이 안내에도 다 있는가" 를 코드로 강제한다.
    이 검사가 깨지면 **안내를 고치라는 뜻**이지 검사를 고치라는 뜻이 아니다.

실행: python scripts\\dt3_test_describe.py
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app                                          # noqa: E402
from app.modules.auth.models import User                            # noqa: E402
from app.modules.digital_twin_dashboard import permissions as P     # noqa: E402
from app.modules.digital_twin_dashboard.ai_tools import (           # noqa: E402
    describe_fields, RELATION_FIELDS, UNSUPPORTED_FIELDS,
)
from app.modules.digital_twin_dashboard.field_maps import PROJECT_FIELD_MAP  # noqa: E402
from flask_jwt_extended import create_access_token                  # noqa: E402

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
        print('── describe_fields 안내 정합성 ──')
        data = describe_fields()
        fields = data['fields']
        by_key = {f['key']: f for f in fields}

        # ① 정본(field_maps)의 키가 **하나도 빠지지 않아야** 한다
        missing = [k for k in PROJECT_FIELD_MAP
                   if k not in by_key and k not in RELATION_FIELDS
                   and k not in UNSUPPORTED_FIELDS]
        check(f'field_maps 의 키 {len(PROJECT_FIELD_MAP)}개가 모두 안내에 있다',
              not missing, f'빠진 키: {missing[:8]}')

        # ② 안내에만 있는 유령 키가 없어야 한다
        known = set(PROJECT_FIELD_MAP) | set(RELATION_FIELDS) | set(UNSUPPORTED_FIELDS)
        ghost = [f['key'] for f in fields if f['key'] not in known]
        check('안내에만 있는 키가 없다', not ghost, f'유령 키: {ghost[:8]}')

        # ③ 위험도는 permissions 분류표와 **같아야** 한다
        wrong = []
        for f in fields:
            col = f.get('column')
            if not col:
                continue
            # 금지가 먼저다 — 이 필드들은 CORE 에도 들어 있어서, 순서가 뒤바뀌면
            # 안내가 '확인하면 반영된다' 고 잘못 말한다.
            # 순서가 `_risk_of` 와 같아야 한다 — 금지·파생이 CORE 보다 먼저다.
            expect = ('forbidden' if col in P.AI_FORBIDDEN_FIELDS
                      else 'derived' if col in P.PROJECT_DERIVED_FIELDS
                      else 'low' if col in P.LOW_RISK_FIELDS
                      else 'core' if col in P.CORE_FIELDS
                      else 'immutable')
            if f['risk'] != expect:
                wrong.append((f['key'], f['risk'], expect))
        check('위험도가 permissions 분류표와 일치한다', not wrong, f'{wrong[:5]}')

        # ④ 관계·미지원 키가 **일반 필드로 새어 나오면 안 된다**
        #    (그러면 AI 가 PATCH 로 보내고 조용히 무시된다)
        leaked = [k for k in list(RELATION_FIELDS) + list(UNSUPPORTED_FIELDS)
                  if by_key.get(k, {}).get('risk') not in ('relation', 'unsupported')]
        check('관계·미지원 키가 일반 필드로 새지 않는다', not leaked, f'{leaked}')

        # ⑤ 선행과제목록은 반드시 unsupported 여야 한다 (쓰기 경로가 없다)
        check('선행과제목록이 unsupported 로 표시된다',
              by_key.get('선행과제목록', {}).get('risk') == 'unsupported',
              str(by_key.get('선행과제목록')))

        # ⑥ 핵심 필드 안내는 두 가지를 반드시 말해야 한다 — 하나라도 빠지면
        #    AI 가 "고쳤습니다" 라고 잘못 답하거나, 확인 단계를 건너뛴다.
        #      ⓐ 즉시 반영이 **아니다**            → 잘못된 완료 보고를 막는다
        #      ⓑ `confirm_change` 로 반영한다      → 다음에 뭘 해야 하는지 알려준다
        core = next((f for f in fields if f['risk'] == 'core'), None)
        note = (core or {}).get('note', '')
        check('핵심 필드 안내가 "즉시 반영 아님" 을 말한다',
              '즉시 반영되지 않' in note, str(core))
        check('핵심 필드 안내가 confirm_change 를 알려준다',
              'confirm_change' in note, str(core))
        # 규칙 문구에도 "묻고 나서 부른다" 가 있어야 한다 — 이게 없으면 AI 가
        # 202 를 받자마자 스스로 confirm 을 이어 불러 확인 단계가 사라진다.
        # ⑥-2 사람 필드. **2026-08-02 에 기준이 갈라졌다** — 그 전에는 셋 다
        #      금지였다.
        #        · `과제참여인력목록`  knoxId 를 담을 수 있다 → **core**(202)
        #        · 나머지 둘          이름만 담기는 형태 → **forbidden**(403)
        #      막았던 이유가 권한이 아니라 "이름으로는 누구인지 못 가린다" 였으므로,
        #      담을 수 있게 된 쪽만 열렸다. 여기서 볼 것은 **그 구분이 유지되는가**다.
        #      셋 다 core 로 새면 AI 가 이름만으로 사람을 넣게 된다.
        # 2026-08-05: 금지 → **파생**. 참여인력목록·담당부서목록의 표시용 사본이라
        # 서버가 만든다(화면도 그렇게 만든다 — formUtils.js).
        for key in ('과제참여인력', '담당자', '담당부서'):
            check(f'{key} 는 derived (사본이라 서버가 만든다)',
                  by_key.get(key, {}).get('risk') == 'derived',
                  str(by_key.get(key)))
        members = by_key.get('과제참여인력목록', {})
        check('과제참여인력목록 은 core 다 (금지가 아니라 확인 대기)',
              members.get('risk') == 'core', str(members))
        # 열린 대신 **knoxId 를 요구한다**는 사실이 안내에 있어야 한다.
        # 이게 빠지면 AI 는 이름만 담아 보내고 400 을 받는다.
        check('과제참여인력목록 안내가 knoxId 가 필요하다고 말한다',
              'knoxId' in str(members.get('shape') or ''), str(members))
        # 금지 필드는 **지금 하나도 없다**(2026-08-05). 셋이 있었는데 둘은 파생으로,
        # 소유자는 admin 검사로 옮겼다 — 금지는 "고칠 방법이 아예 없다" 는 뜻이라
        # 마지막 수단이어야 하기 때문이다. 다시 생긴다면 **대신 갈 곳**을 적어야 한다.
        forb = next((f for f in fields if f['risk'] == 'forbidden'), None)
        check('금지 필드가 있다면 대신 갈 곳을 알려준다',
              forb is None or len((forb or {}).get('note', '')) > 20, str(forb))
        check('파생 안내가 정본을 가리킨다',
              '과제참여인력목록' in by_key.get('담당자', {}).get('note', ''),
              str(by_key.get('담당자')))

        # ⑥-3 삭제. **소프트와 영구의 기준이 다르다** — 여기가 갈리면 권한이 샌다.
        #
        #   2026-08-05 실측: `_permanentlyDeleted` 가 core 여서
        #   `patch_project` → 202 → confirm 으로 **영구삭제가 통과했다.**
        #   그것도 admin 이 아니라 **그 과제를 고칠 수 있는 일반 사용자**로 됐다.
        #   전용 라우트는 admin·dt_office 전용인데 patch 경로만 can_edit_project 를
        #   봤기 때문이다 — 같은 일에 기준이 둘이면 느슨한 쪽으로 샌다.
        #   → `_permanentlyDeleted` 는 immutable 로 내렸다(전용 라우트만 남긴다).
        soft = by_key.get('_deleted', {})
        perm = by_key.get('_permanentlyDeleted', {})
        check('_deleted 는 core (휴지통 — 확인 거쳐 되돌릴 수 있다)',
              soft.get('risk') == 'core', str(soft))
        check('★★ _permanentlyDeleted 는 immutable (PATCH 로 영구삭제 불가)',
              perm.get('risk') == 'immutable', str(perm))
        check('영구삭제 안내가 대신 갈 곳을 알려준다',
              '화면' in perm.get('note', '') and '관리자' in perm.get('note', ''),
              str(perm))

        check('규칙에 "사용자에게 묻는다" 가 있다',
              any('confirm_change' in r and ('물은' in r or '묻' in r)
                  for r in data['rules']),
              str(data['rules']))

        # ⑦ 규칙 문구에 ignored 경고가 있어야 한다
        check('규칙에 `ignored` 경고가 있다',
              any('ignored' in r for r in data['rules']))

        print('\n── 엔드포인트 ──')
        u = User.query.filter_by(role='admin').first() or User.query.first()
        if u is None:
            check('사용자가 있어 엔드포인트를 시험할 수 있다', False, 'users 비어 있음')
        else:
            token = create_access_token(identity=str(u.id))
            with app.test_client() as c:
                r = c.get('/api/dt-v2/describe/fields',
                          headers={'Authorization': f'Bearer {token}'})
                check('GET /dt-v2/describe/fields 200', r.status_code == 200,
                      f'실제 {r.status_code}')
                body = (r.get_json() or {}).get('data') or {}
                check('응답에 fields 가 있다', len(body.get('fields') or []) > 0)
                # 읽기 전용 조회라 컷오버 스위치와 무관해야 한다
                r2 = c.get('/api/dt-v2/describe/fields')
                check('토큰 없으면 401', r2.status_code in (401, 422),
                      f'실제 {r2.status_code}')

        n_low = data['counts']['low']
        n_core = data['counts']['core']
        print(f"\n  [정보] 저위험 {n_low} · 핵심 {n_core} · "
              f"관계 {data['counts']['relation']} · 미지원 {data['counts']['unsupported']} · "
              f"불변 {data['counts']['immutable']}")

    print()
    if fails:
        print(f'[FAIL] {len(fails)}건 — 안내를 정본에 맞추세요: {fails}')
        return 1
    print('[OK] 전부 통과')
    return 0


if __name__ == '__main__':
    sys.exit(main())
