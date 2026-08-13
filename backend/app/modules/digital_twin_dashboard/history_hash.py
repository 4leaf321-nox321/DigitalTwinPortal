"""
이력 변경감지 해시 — **순수 함수만.** 표준 라이브러리 외에는 아무것도 import 하지 않는다.

왜 따로 떼어냈나
    이력을 쓰는 경로가 둘이다.
        1) scripts/dt2_import.py   배치 이관 (psycopg, Flask 없음)
        2) app/.../history.py      쓰기 API (SQLAlchemy, Flask 안)

    두 경로가 "값이 바뀌었는가" 를 **다르게 판단하면** 이력이 깨진다.
    한쪽이 Decimal('10') 을 '10' 으로, 다른 쪽이 '10.0' 으로 정규화하면
    바뀌지도 않은 값에 매번 새 행이 생긴다.

    그래서 판단 로직은 이 파일 하나에만 둔다. 양쪽이 여기서 가져다 쓴다.

이 파일에 Flask·SQLAlchemy·psycopg 를 import 하지 말 것.
배치 스크립트가 Flask 앱 없이 이 파일만 읽어갈 수 있어야 한다.
"""

from __future__ import annotations

import hashlib
import json
from decimal import Decimal, InvalidOperation


# 성과에서 추적하는 값. 단위를 포함하는 이유는 단위가 바뀌면 과거 값과의
# 비교가 무의미해지는데, 값만 저장하면 나중에 그 사실을 알 방법이 없기 때문이다.
PERF_HISTORY_COLS = (
    'current_level', 'target_level', 'actual_level', 'monthly_values_json', 'unit',
)

# 과제는 '진척률' 한 칸으로 정리되지 않아 묶음으로 본다.
PROJECT_HISTORY_COLS = (
    'status', 'progress',
    'action_total', 'action_done',
    'issue_total', 'issue_open',
    'start_month', 'end_month',
)

# 소수점이 있을 수 있어 Decimal 로 정규화해야 하는 컬럼.
_NUMERIC_COLS = frozenset({'current_level', 'target_level'})

# JSON 문자열이거나 파이썬 구조일 수 있는 컬럼.
_JSON_COLS = frozenset({'monthly_values_json'})


def canon(col: str, value) -> str:
    """
    해시용 정규화. 같은 값이면 어느 경로에서 오든 같은 문자열이 나와야 한다.

    psycopg 는 numeric 을 Decimal 로, SQLAlchemy 도 Decimal 로 준다.
    원본 JSON 에서는 문자열('10')이나 int(10)로 온다. 전부 같게 만든다.
    """
    if value is None:
        return '\x00'

    if col in _NUMERIC_COLS:
        try:
            d = Decimal(str(value)).normalize()
            # normalize() 는 100 을 1E+2 로 만든다. 지수 표기를 되돌린다.
            return format(d, 'f')
        except (InvalidOperation, ValueError):
            return str(value)

    if col in _JSON_COLS:
        obj = value
        if isinstance(obj, (str, bytes, bytearray)):
            try:
                obj = json.loads(obj)
            except (ValueError, TypeError):
                return str(value)
        try:
            return json.dumps(obj, ensure_ascii=False, sort_keys=True)
        except (TypeError, ValueError):
            return str(value)

    return str(value).strip()


def value_hash(values: dict, cols) -> str:
    """추적 대상 컬럼들을 정규화해 이어붙인 sha256."""
    joined = '\x1f'.join(canon(c, values.get(c)) for c in cols)
    return hashlib.sha256(joined.encode('utf-8')).hexdigest()


def changed_fields(new_values: dict, prev_values: dict, cols) -> list:
    """직전 기록 대비 실제로 달라진 컬럼 이름들."""
    if not prev_values:
        return []
    return [c for c in cols
            if canon(c, new_values.get(c)) != canon(c, prev_values.get(c))]


def derive_project_counts(project_dict: dict) -> dict:
    """
    과제 dict(원본 JSON 또는 ORM to_dict)에서 액션아이템·이슈 집계를 뽑는다.

    화면의 진척률은 액션아이템 완료 비율로 계산되는데 이 값은 **소급 변경된다** —
    오늘 액션아이템을 3개 추가하면 '지난달 진척률' 을 역산한 값이 어제와 달라진다.
    분모가 바뀌기 때문이다. 그래서 그 시점의 분자·분모를 그대로 남긴다.

    원본 JSON 키('액션아이템목록')와 V2 컬럼명('action_items_json') 둘 다 받는다.
    """
    def _list(*keys):
        for k in keys:
            v = project_dict.get(k)
            if isinstance(v, (str, bytes, bytearray)):
                try:
                    v = json.loads(v)
                except (ValueError, TypeError):
                    v = None
            if isinstance(v, list):
                return [it for it in v if isinstance(it, dict)]
        return []

    items = _list('액션아이템목록', 'action_items_json')
    issues = _list('이슈목록', 'issues_json')
    return {
        'action_total': len(items),
        'action_done': sum(1 for it in items if it.get('완료여부')),
        'issue_total': len(issues),
        'issue_open': sum(1 for it in issues if not it.get('해결여부')),
    }
