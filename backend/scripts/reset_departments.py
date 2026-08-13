"""
부서 목록 재설정 — 기존 부서를 모두 내리고 지정한 9개만 남긴다.

왜 하드 삭제가 아니라 is_active=False 인가
    화면(설정 ▸ 부서)에서 부서를 지우면 `_sync_departments` 가 하는 일이 정확히 이것이다 —
    행을 지우지 않고 `is_active=False` 로 내린다. 조회(`GET /settings`)는 활성만 준다.
    **같은 결과를 다른 방법으로 만들지 않는다.** 되돌리기도 쉽다.

    실측(2026-08-02): `departments.id` 를 참조하는 외래키가 하나도 없어서 하드 삭제도
    가능하지만, 그러면 과제에 남은 부서 이름과 대조할 근거가 사라진다.

⚠️ 사업부는 **활성 행(id 17~24)** 에 붙인다. divisions 에는 같은 이름이 3벌 있고
   (id 1~8, 9~16 은 비활성) 이름으로 찾으면 비활성 쪽이 먼저 잡힌다.

사용법
    python scripts\\reset_departments.py            # 미리보기
    python scripts\\reset_departments.py --apply    # 실제 반영
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app                                          # noqa: E402
from app.extensions import db                                       # noqa: E402
from app.modules.digital_twin_dashboard.models import (              # noqa: E402
    Division, Department,
)

# (부서명, 소속 사업부명) — 화면에 보일 순서 그대로
DEPARTMENTS = [
    ('CAE그룹(MX)', 'MX'),
    ('Mecha그룹(VD)', 'VD'),
    ('CAE그룹(DA)', 'DA'),
    ('Digital Twin사무국(MX)', 'MX'),
    ('Digital Twin사무국(VD)', 'VD'),
    ('Digital Twin사무국(DA)', 'DA'),
    ('Digital Twin사무국(네트워크)', 'NW'),
    ('Digital Twin사무국(의료기기)', '의료기기'),
    ('Digital Twin사무국(생기연)', 'GTR'),
]


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    apply = '--apply' in sys.argv
    app = create_app()

    with app.app_context():
        print('=' * 78)
        print(' 부서 재설정 ' + ('(실제 반영)' if apply else '(미리보기 — --apply 필요)'))
        print('=' * 78)

        # 활성 사업부만 이름 → id
        div_map = {d.name: d.id
                   for d in Division.query.filter_by(is_active=True).all()}
        missing = sorted({dv for _, dv in DEPARTMENTS if dv not in div_map})
        if missing:
            print(f'\n[중단] 활성 사업부에 없는 이름: {", ".join(missing)}')
            print('       사업부를 먼저 만들어야 합니다.')
            return 1

        current = Department.query.filter_by(is_active=True).all()
        print(f'\n[내림] 현재 활성 부서 {len(current)}개 → is_active=False')
        for d in current[:8]:
            print(f'    - {d.name}')
        if len(current) > 8:
            print(f'    ... 외 {len(current) - 8}개')

        print(f'\n[추가] {len(DEPARTMENTS)}개')
        for i, (name, div) in enumerate(DEPARTMENTS):
            print(f'    {i + 1}. {name:<28} → {div} (division_id={div_map[div]})')

        if not apply:
            print('\n ※ 미리보기였습니다. 반영하려면 --apply 를 붙이세요.')
            return 0

        # 1) 기존 전부 내린다
        Department.query.filter_by(is_active=True).update(
            {'is_active': False}, synchronize_session=False)

        # 2) 새로 넣는다. 같은 이름의 비활성 행이 있으면 **되살려 재사용**한다 —
        #    새 행을 쌓으면 지금처럼 같은 이름이 여러 벌 남는다.
        for idx, (name, div) in enumerate(DEPARTMENTS):
            row = (Department.query.filter_by(name=name)
                   .order_by(Department.id.desc()).first())
            if row is None:
                row = Department(name=name)
                db.session.add(row)
            row.division_id = div_map[div]
            row.order = idx
            row.is_active = True

        db.session.commit()

        print('\n[결과] 활성 부서 목록')
        for d in (Department.query.filter_by(is_active=True)
                  .order_by(Department.order).all()):
            dv = Division.query.get(d.division_id)
            print(f'    id={d.id:<5} order={d.order:<3} {d.name:<28} → {dv.name if dv else "(없음)"}')
        return 0


if __name__ == '__main__':
    sys.exit(main())
