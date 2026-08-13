"""액션아이템에 정체성(`uuid`) 채워 넣기 — 이관 스크립트.

왜 필요한가
    액션아이템의 `id` 는 정체성이 아니라 **순번**이다. 화면이 저장할 때마다 위치
    순서로 다시 매긴다(`formUtils.processFormData` → `generateNextActionItemId`;
    편집 저장에서는 기존 목록을 빈 배열로 넘겨 항상 1..N 이 된다).

    그래서 3개 중 **첫 번째**를 지우면 남은 둘의 id 가 1,2 로 당겨지고, id 로 비교하는
    활동 로그는 "3번이 사라졌다" 고 본다 — **엉뚱한 항목이 삭제됐다고 기록된다.**
    지식 그래프에서는 더 나쁘다: 노드 id 가 저장 한 번에 다른 항목으로 옮겨 붙는다.

무엇을 하나 / 안 하나
    한다     `uuid` 키가 없는 액션아이템에 uuid4 를 **하나 붙인다.**
    안 한다  기존 값은 아무것도 손대지 않는다. **`id` 는 그대로 둔다** —
             지우면 화면의 React key 와 기존 비교 코드가 같이 깨진다.
    안 한다  `row_version` 을 올리지 않고 변경 이력도 남기지 않는다.
             사용자가 바꾼 것이 아니라 기술적인 식별자 부여다. 과제 수백 건의
             "액션아이템목록 변경" 이력이 쌓이면 진짜 변경을 못 찾게 된다.
    안 한다  세부항목(`세부항목목록`)에는 아직 안 준다. 그것을 가리키는 데이터가
             아직 없다(운영·개발 모두 0건). 필요해지면 같은 방식으로 한 겹 더 내려간다.

규칙은 **서버와 같은 함수**를 쓴다 (`routes_v2._assign_action_uuids`).
여기서 다시 구현하면 배치와 API 가 갈리고, 갈리면 uuid 가 두 벌 생긴다.

되돌리기
    `uuid` 키만 지우면 된다. 다른 것을 안 건드리므로 그것으로 원상복구다.

반입 순서 (중요)
    ① 백엔드 반입 → ② **이 스크립트(--commit)** → ③ 프론트 반입
    ②를 ①보다 먼저 할 수는 없다(이 스크립트가 서버 코드를 가져다 쓴다).

**②를 건너뛰면 안 된다.** "저장하면 서버가 알아서 붙여 주지 않나" 는 절반만 맞다 —
서버는 그 저장에 **액션아이템 목록이 실려 있을 때만** 붙인다(`_derive_action_items`).
과제명이나 진행률만 바꾼 저장에는 안 실리므로, **액션아이템을 한 번도 안 건드리는
과제는 영영 uuid 가 없다.** (개발 DB 실측으로 확인)

    게다가 화면은 **새로 만드는** 항목에만 uuid 를 붙인다 — 이미 있던 항목에 소급해
    붙이지 않는다. 그래서 백필 없이 첫 편집을 하면 그 한 번은 여전히 순번(`id`)으로
    비교하고, **첫 항목을 지우면 엉뚱한 항목이 삭제됐다고 기록된다.**
    두 번째 편집부터야 정상이 된다. 이 스크립트는 그 "첫 한 번" 을 없앤다.

실행
    python scripts\\dt3_backfill_action_uuids.py            (미리보기 · 아무것도 안 쓴다)
    python scripts\\dt3_backfill_action_uuids.py --commit   (실제 반영)
    python scripts\\dt3_backfill_action_uuids.py --verbose  (과제별로 자세히)
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm.attributes import flag_modified                # noqa: E402

from app import create_app                                         # noqa: E402
from app.extensions import db                                      # noqa: E402
from app.modules.digital_twin_dashboard.models_v2 import Dt2Project  # noqa: E402
# 규칙 복제 금지 — uuid 를 붙이는 판단은 서버와 **같은 함수**를 쓴다.
from app.modules.digital_twin_dashboard.routes_v2 import (         # noqa: E402
    ACTION_UUID_KEY, _assign_action_uuids,
)


def main(argv):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    commit = '--commit' in argv
    verbose = '--verbose' in argv

    app = create_app()
    with app.app_context():
        # **삭제된 과제도 포함한다.** 휴지통에서 되살아나면 그때 uuid 가 없는 항목이
        # 남아 있게 되고, 되살린 사람은 이 스크립트가 있었다는 것을 모른다.
        rows = Dt2Project.query.order_by(Dt2Project.id.asc()).all()

        touched = 0          # 바뀐 과제 수
        filled = 0           # 새로 uuid 를 받은 항목 수
        already = 0          # 이미 uuid 가 있던 항목 수
        total_items = 0
        skipped_shape = 0    # dict 가 아닌 원소 (건드리지 않는다)

        for p in rows:
            items = p.action_items_json
            if not isinstance(items, list) or not items:
                continue

            before_missing = 0
            for it in items:
                if not isinstance(it, dict):
                    skipped_shape += 1
                    continue
                total_items += 1
                if str(it.get(ACTION_UUID_KEY) or '').strip():
                    already += 1
                else:
                    before_missing += 1

            if before_missing == 0:
                continue          # 이미 다 있다 — 손대지 않는다(재실행해도 안전)

            # `previous` 를 자기 자신으로 준다. 이미 붙어 있는 uuid 는 그대로 두고
            # 없는 것만 새로 만들라는 뜻이다.
            new_items = _assign_action_uuids(items, items)

            touched += 1
            filled += before_missing
            if verbose:
                print(f'  {p.code or p.uuid[:8]:<12} 항목 {len(items):>2}개 중 '
                      f'{before_missing}개에 uuid 부여')

            if commit:
                p.action_items_json = new_items
                # JSONB 를 통째로 바꿔 넣으므로 SQLAlchemy 가 알아채지만,
                # 같은 객체를 재사용하는 경로에 대비해 명시한다.
                flag_modified(p, 'action_items_json')
                # ⚠️ row_version 을 올리지 않는다. 사용자 변경이 아니다 —
                #    올리면 편집창을 열어 둔 사람이 저장할 때 까닭 없이 409 를 본다.

        if commit:
            db.session.commit()

        print()
        print('─' * 64)
        print(f'과제 {len(rows)}개 · 액션아이템 {total_items}개')
        print(f'  이미 uuid 있음   {already}개')
        print(f'  새로 부여        {filled}개  (과제 {touched}개)')
        if skipped_shape:
            print(f'  건드리지 않음    {skipped_shape}개 (dict 가 아닌 원소)')
        print('─' * 64)
        if commit:
            print('[OK] 반영했습니다. 다시 실행하면 "새로 부여 0개" 가 나와야 합니다.')
        else:
            print('[미리보기] 아무것도 쓰지 않았습니다. 반영하려면 --commit 을 붙이세요.')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
