"""이미지 그룹 카테고리 정리 — 슬롯 이름이 아닌 값을 되돌린다. (2026-08-08)

무엇을 고치나
    `이미지_그룹N_카테고리` 는 **그림 슬롯 키**다 — 화면이 `이미지_<값>` 으로 업로드
    위치를 정한다. 쓸 수 있는 값은 `개요그림 · 상세내용그림 · 향후계획그림` 셋뿐인데,
    2026 과제 시드(`dt3_seed_2026_projects.py`)가 여기에 `방사 패턴`·`모델 구조` 같은
    **그림 제목**을 넣었다. 이름만 보면 그렇게 읽히기 때문이다.

    그 과제에서는 이미지를 올려도 `이미지_방사 패턴` 슬롯으로 들어가고,
    저장 어댑터·서버 조립이 **정해진 슬롯 5개만** 알기 때문에 **조용히 사라졌다.**
    "편집창에서 고쳤는데 안 들어간다" 의 정체가 이것이다.

무엇을 하나
    잘못된 값을 그룹 순서에 맞는 기본값(`개요그림`/`상세내용그림`)으로 되돌린다.
    **이미지 데이터는 건드리지 않는다** — 그런 슬롯에 올라간 파일은 애초에
    과제에 연결된 적이 없다(`image_refs_json` 에 안 들어갔다).

⚠️ 기본은 **조사만** 한다. 실제로 고치려면 `--commit`.
   운영에서는 반출 후 한 번 돌리고, 결과를 런북에 남길 것.

실행:
    venv/Scripts/python.exe scripts/dt3_fix_image_categories.py
    venv/Scripts/python.exe scripts/dt3_fix_image_categories.py --commit
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app                                            # noqa: E402
from app.extensions import db                                         # noqa: E402
from app.modules.digital_twin_dashboard.models import ReportImage     # noqa: E402
from app.modules.digital_twin_dashboard.models_v2 import Dt2Project   # noqa: E402
from app.modules.digital_twin_dashboard.routes_v2 import (            # noqa: E402
    IMAGE_CATEGORY_KEYS,
)

COMMIT = '--commit' in sys.argv

# 그룹 순서에 맞는 기본값 — 화면(DetailInfoModal `IMAGE_CATEGORIES`)의 순서와 같다.
DEFAULTS = ('개요그림', '상세내용그림')
COLS = ('image_group1_category', 'image_group2_category')


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    app = create_app()
    with app.app_context():
        rows = Dt2Project.query.all()
        bad = []
        for p in rows:
            for i, col in enumerate(COLS):
                v = (getattr(p, col) or '').strip()
                if v and v not in IMAGE_CATEGORY_KEYS:
                    bad.append((p, col, v, DEFAULTS[i]))

        print(f'과제 {len(rows)}건 중 잘못된 카테고리 {len(bad)}개 항목')
        for p, col, v, to in bad[:20]:
            print(f'  {p.code:<12} {col[-16:]:<17} {v!r} → {to!r}')
        if len(bad) > 20:
            print(f'  … 외 {len(bad) - 20}개')

        # 그 슬롯으로 올라갔던 파일 — 과제에 연결된 적이 없다. 참고로만 센다.
        orphan_slots = {f'이미지_{v}' for _p, _c, v, _t in bad}
        if orphan_slots:
            n = ReportImage.query.filter(ReportImage.slot.in_(orphan_slots)).count()
            print(f'\n그 슬롯으로 올라간 이미지 파일: {n}건 '
                  '(과제에 연결된 적이 없다 — 이 스크립트는 건드리지 않는다)')

        if not bad:
            print('\n고칠 것이 없습니다.')
            return 0

        if not COMMIT:
            print('\n[조사만 함] 실제로 고치려면 --commit 을 붙여 다시 실행하세요.')
            return 0

        for p, col, _v, to in bad:
            setattr(p, col, to)
        db.session.commit()
        print(f'\n[완료] {len(bad)}개 항목을 기본값으로 되돌렸습니다.')
        print('       이제 그 과제에서 이미지를 올리면 정상 슬롯에 저장됩니다.')
        return 0


if __name__ == '__main__':
    sys.exit(main())
