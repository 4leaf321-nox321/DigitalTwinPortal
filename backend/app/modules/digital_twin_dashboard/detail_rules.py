"""상세 과제 정보 7섹션의 **모양과 한계**. 한 곳에서만 판정한다.

왜 따로 뺐나
    이 규칙(한 줄 39자 · 앞 3섹션은 항목 2개까지 · 그 섹션엔 하위 줄 없음)은 원래
    `routes_v2.py` 안에만 있었다. 그런데 **AI 폼 도우미도 같은 판정이 필요하다** —
    모델이 만든 줄을 화면에 넘기기 전에 걸러야 하기 때문이다.

    `form_assist` 가 `routes_v2` 를 import 하면 순환이 되고(routes_v2 → form_assist),
    규칙을 복사하면 두 곳이 갈린다. **갈리면 화면은 "넣었습니다" 라고 하는데 저장이
    400 으로 막히는** 상태가 된다 — 사용자는 원인을 알 방법이 없다.
    그래서 둘 다 여기를 본다.

⚠️ 진짜 정본은 **화면**(`DetailInfoModal.jsx`)이다. 입력칸이 39자에서 막히고, 앞 3섹션은
   항목을 2개까지만 만들 수 있다. 여기 값은 그 화면과 **같아야 한다** — 화면 쪽을 고치면
   여기도 같이 고칠 것. (`ai_tools._SHAPES` 의 안내 문구도 이 값을 말로 옮긴 것이다)
"""
from __future__ import annotations

from app.modules.digital_twin_dashboard.field_maps import PROJECT_FIELD_MAP

# 상세정보 7개 섹션. `enabled` 가 없으면 화면이 그 섹션을 통째로 건너뛴다.
DETAIL_SECTION_COLS = (
    'detail_overview_json', 'detail_background_json', 'detail_goal_json',
    'detail_content_json', 'detail_output_json', 'detail_result_json',
    'detail_plan_json',
)

# 그중 **항목 2개까지, 하위 줄(children) 없음** 인 섹션.
# 화면(DetailInfoModal)이 그렇게 만들어져 있어 더 넣으면 잘리거나 안 보인다.
DETAIL_PARENT_ONLY = (
    'detail_overview_json', 'detail_background_json', 'detail_goal_json',
)

DETAIL_LINE_LIMIT = 39          # 한 줄 최대 (공백은 0.5자로 센다 — 화면 입력 제한)
DETAIL_PARENT_MAX = 2

_COL_TO_KOREAN = {col: key for key, col in PROJECT_FIELD_MAP.items()}

# 한글 키 → 컬럼. 폼 도우미는 한글 키로 다루므로 되돌릴 길이 필요하다.
#
# ⚠️ 순서는 **화면(DetailInfoModal `DETAIL_SECTIONS`)과 같게** 둔다 — 컬럼 순서와
#    한 곳(성과·산출물)이 다르다. AI 에게 주는 목록과 미리보기가 화면과 다른 순서로
#    나오면 사람이 두 화면을 대조하지 못한다.
DETAIL_KEYS = (
    '상세정보_과제개요', '상세정보_추진배경', '상세정보_과제목표',
    '상세정보_상세내용', '상세정보_성과', '상세정보_산출물', '상세정보_향후계획',
)
KEY_TO_COL = {k: PROJECT_FIELD_MAP[k] for k in DETAIL_KEYS if k in PROJECT_FIELD_MAP}


def screen_width(s) -> float:
    """화면 입력 제한과 같은 셈 — **공백은 0.5자.**

    화면이 이렇게 세기 때문에 서버도 이렇게 센다. 다르게 세면 화면에서는 통과한 줄이
    저장에서 막힌다.
    """
    return sum(0.5 if ch == ' ' else 1 for ch in str(s or ''))


def label_of(col: str) -> str:
    return _COL_TO_KOREAN.get(col, col)


def is_parent_only(col: str) -> bool:
    return col in DETAIL_PARENT_ONLY


def detail_section_errors(col, v) -> list:
    """상세정보 한 섹션의 길이·개수 위반을 모아 돌려준다. (저장 경로가 400 을 낼 근거)

    **위반을 고치지 않는다** — 사람이 화면에서 보낸 값은 화면이 이미 막았어야 하는
    것이라, 여기서 조용히 다듬으면 화면의 결함이 가려진다. 오류로 알린다.
    (AI 가 만든 값은 성격이 다르다 — `form_assist` 가 위반한 줄만 빼고 알린다)
    """
    label = label_of(col)
    if not isinstance(v, dict):
        return []
    items = v.get('items')
    if not isinstance(items, list):
        return []

    errs = []
    if is_parent_only(col) and len(items) > DETAIL_PARENT_MAX:
        errs.append(f'{label}: 항목은 {DETAIL_PARENT_MAX}개까지입니다 '
                    f'(보낸 값 {len(items)}개)')

    for i, it in enumerate(items):
        if not isinstance(it, dict):
            continue
        t = it.get('text')
        if t is not None and screen_width(t) > DETAIL_LINE_LIMIT:
            errs.append(f'{label}[{i}]: 한 줄은 {DETAIL_LINE_LIMIT}자까지입니다 '
                        f'({screen_width(t)}자) — {str(t)[:20]}…')
        kids = it.get('children')
        if isinstance(kids, list) and kids:
            if is_parent_only(col):
                errs.append(f'{label}[{i}]: 이 섹션은 하위 줄(children)을 쓰지 않습니다')
            for j, k in enumerate(kids):
                if not isinstance(k, dict):
                    continue
                kt = k.get('text')
                if kt is not None and screen_width(kt) > DETAIL_LINE_LIMIT:
                    errs.append(
                        f'{label}[{i}].하위[{j}]: 한 줄은 {DETAIL_LINE_LIMIT}자까지'
                        f'입니다 ({screen_width(kt)}자) — {str(kt)[:20]}…')
    return errs


def section_lines(v) -> list:
    """섹션 하나 → `[(깊이, 줄)]`. 빈 줄은 뺀다. 모양이 아니면 빈 목록."""
    if not isinstance(v, dict):
        return []
    out = []
    for it in (v.get('items') if isinstance(v.get('items'), list) else []):
        text = str((it or {}).get('text') or '').strip()
        if not text:
            continue
        out.append((0, text))
        for k in ((it or {}).get('children') or []):
            kt = str((k or {}).get('text') or '').strip()
            if kt:
                out.append((1, kt))
    return out


def render_detail_text(sections: dict, *, per_section_max: int = 900) -> str:
    """상세 과제 정보 → **사람이 읽는 줄글.** 프롬프트·요약에 실을 용도다.

    왜 필요한가
        이 값은 `{enabled, items:[{text, children}]}` 인 JSON 이다. 그대로 문자열로
        만들면 `[{'text': …, 'children': […]}]` 같은 파이썬 repr 이 실린다 —
        **토큰만 먹고 모델은 못 읽는다.** 게다가 섹션 이름이 빠져서 "무엇에 대한
        줄인지" 를 알 수가 없다.

    ⚠️ `enabled=False` 인 섹션은 **뺀다.** 화면이 그 섹션을 통째로 건너뛰므로,
       사람이 "쓰지 않기로 한 내용" 이다. 근거로 삼으면 화면에 없는 것을 근거로
       판단하게 된다. (키가 아예 없으면 옛 데이터라 보고 포함한다)

    `sections` 는 `{한글키: 섹션값}`. 없는 키·빈 섹션은 알아서 건너뛴다.
    """
    blocks = []
    for key in DETAIL_KEYS:
        v = sections.get(key)
        if not isinstance(v, dict) or v.get('enabled') is False:
            continue
        lines = section_lines(v)
        if not lines:
            continue
        body = '\n'.join(('  - ' if depth else '- ') + text for depth, text in lines)
        blocks.append(f'[{key.replace("상세정보_", "")}]\n{body[:per_section_max]}')
    return '\n'.join(blocks)


__all__ = [
    'DETAIL_SECTION_COLS', 'DETAIL_PARENT_ONLY', 'DETAIL_LINE_LIMIT',
    'DETAIL_PARENT_MAX', 'DETAIL_KEYS', 'KEY_TO_COL',
    'screen_width', 'label_of', 'is_parent_only', 'detail_section_errors',
    'section_lines', 'render_detail_text',
]
