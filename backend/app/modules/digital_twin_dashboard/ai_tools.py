"""
AI 가 이 시스템을 다룰 때 필요한 **어휘와 규칙**을 한 곳에서 만든다.

🚦 **여기는 '필드' 다. '도구' 가 아니다.**
    바로 옆 `ai/agent_tools.py` 와 이름이 비슷한데 **다른 물건이다** —
      · `ai_tools.py`(이 파일)  **무엇을 고칠 수 있나** (필드·위험도·선택지)
      · `ai/agent_tools.py`     **LLM 이 부를 함수** (도구 스키마·실행)
    필드를 손보러 왔다면 여기가 맞다. 도구를 늘리러 왔다면 저쪽이다.
    전체 지도: 루트 `디지털트윈_AI기능_지도.md`

왜 필요한가
    AI 는 필드명을 **지어낸다.** `진행율`·`상태`·`progress_rate` 처럼 그럴듯하지만 없는
    이름을 보내면 서버는 `ignored` 로 돌려주고, 사용자는 "저장됐다" 는 말만 듣는다.
    그래서 **무엇을 고칠 수 있고 어떤 값이 허용되는지**를 먼저 알려줘야 한다.

    더 중요한 것은 **위험도**다. 이 시스템은 AI 쓰기를 두 갈래로 나눈다 —
    저위험 필드는 즉시 반영, **핵심 필드는 사용자 확인을 거친다**(202).
    AI 가 그걸 모르면 "고쳤습니다" 라고 답하는데 실제로는 아직 안 바뀐 상태가 된다.

한 곳에서 만드는 이유
    필드 목록은 `field_maps.py`, 위험도는 `permissions.py` 가 정본이다. 여기서 **읽어서**
    만들고 **절대 복제하지 않는다.** 복제하면 필드가 늘었을 때 안내만 옛것으로 남아,
    AI 가 "그런 필드 없다" 는 잘못된 전제로 움직인다.

    이 모듈은 **MCP 서버와 (나중의) GLM 에이전트가 같이 쓴다.** 도구를 두 벌 만들면
    규칙이 갈린다.
"""

from __future__ import annotations

from app.modules.digital_twin_dashboard import permissions as P
from app.modules.digital_twin_dashboard.field_maps import (
    PERFORMANCE_FIELD_MAP, PROJECT_FIELD_MAP,
)
from app.modules.digital_twin_dashboard.models import (
    Division, PerformanceCategory, PerformanceSubcategory, ProcessCategory,
    ProjectDomain, TaskCategory, TaskStatus,
)

# 별도 API 로만 바뀌는 키. PATCH 본문에 넣으면 `ignored` 로 돌아온다 —
# 값이 사라지는 게 아니라 **가는 길이 다르다.**
RELATION_FIELDS = {
    # AI 도 바꿀 수 있지만 **PATCH 본문으로는 안 된다.** 전용 경로로 보내면
    # 확인 대기(202)로 쌓이고, preview 에 이 성과를 함께 쓰는 다른 과제까지 실린다.
    '성과목록': 'PUT /api/dt-v2/projects/<uuid>/performances (통째 교체 · AI 는 202 확인 대기)',
    '이미지_좌측': 'POST /api/digital-twin-dashboard/report-images/... (파일 업로드)',
    '이미지_우측': '〃',
    '이미지_개요그림': '〃',
    '이미지_상세내용그림': '〃',
    '이미지_향후계획그림': '〃',
}

# **AI 가 바꿀 길이 없는** 키. 사람에게는 길이 있어도 여기 있을 수 있다.
#
# 선행과제 (2026-08-08 갱신)
#     사람용 쓰기 API 는 생겼다 — `PUT /api/dt-v2/projects/<uuid>/dependencies`.
#     하지만 **AI 는 403 이다**(routes_v2.replace_project_dependencies).
#     DX KPI 연결과 같은 이유다: 선행 관계는 사람이 선언하는 계보이고,
#     문서에 안 적혀 있는 경우가 대부분이라 LLM 이 제목 유사도로 이으면
#     없던 이력이 데이터가 된다. 게다가 이 엣지는 그래프 순회의 뼈대라 틀리면 멀리 퍼진다.
UNSUPPORTED_FIELDS = {
    '선행과제목록': ('사람용 쓰기 API 는 있지만(PUT /projects/<uuid>/dependencies) '
                'AI 호출은 403 이다. 수정을 시도하지 말고, 필요하면 사용자에게 '
                '편집창 ▸ 기타 탭에서 직접 연결하도록 안내할 것.'),
}

# 선택지가 설정 테이블에서 오는 필드 — (한글키, 모델).
# 값은 **활성 행만**. 비활성은 설정을 저장할 때마다 쌓인 옛 버전이라 쓰면 안 된다
# (permissions.resolve_division_id 주석과 같은 이유).
_OPTION_SOURCES = [
    ('사업부', Division),
    ('프로세스', ProcessCategory),
    ('과제영역', ProjectDomain),
    ('과제구분', TaskCategory),
    ('진행상태', TaskStatus),
]

_RISK_NOTE = {
    'low': '즉시 반영된다.',
    'core': '**AI 가 고치면 즉시 반영되지 않는다**(응답 202). 응답의 `preview`(before → after)를 '
            '사용자에게 보여주고 동의를 받은 뒤 `confirm_change` 로 반영한다.',
    'forbidden': '**AI 는 이 필드를 바꿀 수 없다**(403). 이름만 담을 수 있는 형태라 '
                 '동명이인을 가릴 수 없기 때문이다. '
                 '참여인력을 넣으려면 `과제참여인력목록`(knoxId 포함)을 쓴다. '
                 '소유자는 사람이 화면에서 지정한다.',
    'derived': '**보내도 들어가지 않는다.** 다른 필드의 표시용 사본이라 서버가 만든다 — '
               '`담당자`·`과제참여인력` 은 `과제참여인력목록` 에서, `담당부서` 는 '
               '`담당부서목록` 에서 나온다. 바꾸려면 **그 정본을 바꾼다.**',
    'immutable': '어떤 경로로도 고칠 수 없다. 서버가 정하거나 별도 API 로만 바뀐다.',
    'relation': '이 PATCH 로는 못 고친다. 아래 `via` 의 API 를 쓴다.',
    'unsupported': '**쓰기 경로가 없다.** 시도하지 말 것.',
}

# 위험도 문구만으로는 **어디로 가야 하는지**를 못 알려주는 필드. 여기만 덧붙인다.
#
# 왜 필요한가 — `immutable` 기본 문구는 "서버가 정한다" 인데, 영구삭제는 서버가
# 정하는 값이 아니라 **사람이 다른 경로로 하는 일**이다. 그렇게만 적어 두면 AI 는
# 사용자에게 "안 됩니다" 로 끝내고, 사용자는 방법이 있는데도 못 찾는다.
# (금지 필드에 '대신 갈 곳' 을 적어 둔 것과 같은 이유다.)
_FIELD_NOTE = {
    '_permanentlyDeleted':
        ' **영구삭제는 PATCH 로 할 수 없다 — 관리자(admin·dt_office)가 화면에서 한다.** '
        '되돌릴 수 없고 휴지통에도 안 남기 때문이다. '
        '사용자가 삭제를 원하면 `_deleted`(휴지통으로 보내기)를 안내한다 — '
        '그건 확인을 거쳐 되돌릴 수 있다.',
}


# JSON 을 담는 필드의 **모양**. 위험도만으로는 부족해서 넣는다 —
# `risk=low` 는 "즉시 반영된다" 는 뜻이지 "아무 모양이나 된다" 는 뜻이 아닌데,
# 컬럼이 JSONB 라 서버는 무엇을 넣든 그대로 받는다. 모양이 틀리면 **저장은 성공하고
# 화면에서만 안 보인다** — `applied` 만 보는 AI 는 끝까지 알아채지 못한다.
# (실제로 상세정보에 맨 배열을 넣어 이 일이 났다.)
#
# 정본은 화면 코드다. 바뀌면 여기도 같이 고쳐야 한다 —
#   상세정보  frontend/.../ProjectModal/components/DetailInfoModal.jsx
#   액션·이슈  frontend/.../ProjectModal/  (같은 폴더의 편집 모달)
_DETAIL_SECTION_SHAPE = {
    'example': '{"enabled": true, "items": [{"text": "한 줄", "children": [{"text": "하위 줄"}]}]}',
    'note': '`enabled` 를 안 보내고 `items` 만 넣으면 **서버가 true 로 채우고** '
            '응답 `normalized` 로 알려준다(안 채우면 화면이 이 섹션을 통째로 '
            '건너뛴다). 숨기려면 `enabled: false` 를 **명시**한다. '
            '한 줄은 **39자까지 — 넘으면 400**. 공백은 0.5자로 센다(화면 입력 제한).',
}
_DETAIL_PARENT_ONLY_SHAPE = {
    'example': '{"enabled": true, "items": [{"text": "한 줄", "children": []}]}',
    'note': _DETAIL_SECTION_SHAPE['note'] +
            ' 이 섹션은 **항목 2개까지, 하위 줄(`children`)은 쓰지 않는다 — '
            '넘으면 400.**',
}

_SHAPES = {
    '상세정보_과제개요': _DETAIL_PARENT_ONLY_SHAPE,
    '상세정보_추진배경': _DETAIL_PARENT_ONLY_SHAPE,
    '상세정보_과제목표': _DETAIL_PARENT_ONLY_SHAPE,
    '상세정보_상세내용': _DETAIL_SECTION_SHAPE,
    '상세정보_성과': _DETAIL_SECTION_SHAPE,
    '상세정보_산출물': _DETAIL_SECTION_SHAPE,
    '상세정보_향후계획': _DETAIL_SECTION_SHAPE,
    '액션아이템목록': {
        'example': '[{"uuid": "3f2a…", "id": "action_MX-1_1", "제목": "...", '
                   '"목표일": "2026-03-31", '
                   '"완료여부": true, "완료일": "2026-03-31", "월별내용": {}, '
                   '"세부항목목록": [{"id": 1785600000001, "내용": "...", '
                   '"완료여부": true, "완료일": "2026-03-20"}]}]',
        'note': '⚠️ **`uuid` 는 읽은 그대로 되돌려 보낼 것.** 그 항목이 무엇인지 '
                '가리키는 유일한 값이다(`id` 는 저장할 때마다 순번으로 다시 매겨져서 '
                '정체성이 아니다). 새로 만드는 항목에는 넣지 말 것 — 서버가 만든다. '
                '빠뜨리면 서버가 제목·자리로 짐작해 물려주지만, 제목까지 바꾸면 '
                '그 항목은 **다른 항목으로 취급된다.** '
                '날짜는 `YYYY-MM-DD` 문자열, 미완료면 `완료일`은 빈 문자열. '
                '**상위 액션아이템의 `완료여부`·`완료일`은 서버가 세부항목에서 '
                '파생시킨다** — 세부항목이 전부 완료면 상위도 완료가 되고, 완료일은 '
                '세부항목 중 마지막 완료일이 된다. 그래서 세부항목만 바꿔 보내면 된다. '
                '`진행률`도 이 목록에서 다시 계산되므로 **항목을 늘리면 과거 진척률까지 '
                '내려간다.** 배열 **통째 교체**라 한 건만 바꿔도 기존 전부를 함께 보낸다.',
    },
    '진행률': {
        'example': '58',
        'note': '**액션아이템에서 자동으로 계산된다.** 액션아이템이 1건이라도 있으면 '
                '이 값을 직접 보내도 400 이다 — `액션아이템목록` 의 완료 표시를 바꾸면 '
                '진행률이 따라온다. 액션아이템이 없는 과제에서만 직접 넣을 수 있다.',
    },
    '이슈목록': {
        'example': '[{"id": 1785600000010, "제목": "...", "코멘트": "...", '
                   '"등록일": "2026-06-15", "해결여부": false, "해결일": ""}]',
        'note': '미해결이면 `해결일`은 빈 문자열.',
    },
    '월간진척현황': {
        'example': '{"1": "□ 항목\\n  - 세부", "2": "..."}',
        'note': '키는 **월 번호 문자열 "1"~"12"**. 날짜가 아니다.',
    },
    '담당부서목록': {
        'example': '["개발그룹", "Digital Twin Lab"]',
        'note': '부서명 문자열의 배열.',
    },
    '과제참여인력목록': {
        'example': '[{"knoxId": "hong.gd", "이름": "홍길동", "부서": "개발그룹"}]',
        'note': '**원소마다 `knoxId` 가 있어야 한다**(없으면 400). 이름만으로는 '
                '동명이인을 가릴 수 없어 사용자가 확인할 수 없기 때문이다. '
                'knoxId 는 `find_people` 로 찾는다 — 여러 명이 나오면 **사용자에게 '
                '누구인지 물어볼 것.** 여기 들어간 사람은 이 과제를 고칠 수 있게 된다.',
    },
    '과제PL_knoxId': {
        'example': '"hong.gd"',
        'note': '사내 이메일 @앞부분. `find_people` 로 확인한다. '
                '이 계정은 이 과제를 고칠 수 있게 된다. 빈 문자열은 연결 해제다.',
    },
    '작성자': {
        'example': '"홍길동"',
        'note': '**`작성자_knoxId` 와 함께 넣는다.** 이름만 넣으면 화면이 작성자를 '
                "**'연결 안 됨'** 으로 표시한다. `과제PL` 과 달리 knoxId 가 없어도 "
                '400 이 아니라 그냥 통과하므로 조용히 끊긴다. '
                '이름이 활성 사용자 중 유일하면 서버가 knoxId 를 찾아 채우고 '
                '`normalized` 로 알려주지만, **동명이인이면 못 채운다.** '
                '작성자는 표시 전용이라 권한과는 무관하다.',
    },
    '작성자_knoxId': {
        'example': '"hong.gd"',
        'note': '사내 이메일 @앞부분. `find_people` 로 확인한다. '
                '비어 있으면 화면에 **\'연결 안 됨\'** 으로 뜬다. '
                '과제PL 과 달리 이 계정에 편집 권한이 생기지는 않는다(표시 전용).',
    },
}


def _risk_of(column: str) -> str:
    """`permissions` 의 분류표를 그대로 읽는다. 여기서 판단하지 않는다."""
    # 금지가 먼저다 — 이 필드들은 CORE 에도 들어 있어서 순서가 뒤바뀌면
    # '확인하면 된다' 고 잘못 안내한다.
    if column in P.AI_FORBIDDEN_FIELDS:
        return 'forbidden'
    # 파생도 CORE 보다 먼저 본다 — 보내도 안 들어가고 서버가 정본에서 채운다.
    if column in P.PROJECT_DERIVED_FIELDS:
        return 'derived'
    if column in P.LOW_RISK_FIELDS:
        return 'low'
    if column in P.CORE_FIELDS:
        return 'core'
    if column in P.IMMUTABLE_FIELDS:
        return 'immutable'
    # 분류표에 없으면 서버가 PATCH 를 거부한다(모르는 필드는 거부 — fail closed).
    # 안내에서도 그렇게 보여야 AI 가 헛수고하지 않는다.
    return 'immutable'


def _options():
    """설정 테이블에서 선택지를 읽는다. **활성 행만.**"""
    out = {}
    for key, model in _OPTION_SOURCES:
        try:
            rows = (model.query
                    .filter(model.is_active.is_(True))
                    .order_by(model.id)
                    .all())
            names = [r.name for r in rows if getattr(r, 'name', None)]
            if names:
                out[key] = names
        except Exception:
            # 설정 테이블이 비었거나 컬럼이 다르면 **선택지 없이** 나간다.
            # 안내가 통째로 실패하는 것보다 낫다.
            continue
    return out


def describe_fields() -> dict:
    """
    과제 필드 안내. AI 가 PATCH 를 만들기 전에 이걸 먼저 본다.

    `key` 는 화면·API 가 쓰는 **한글 키**다. 영어 컬럼명으로 보내도 서버가 받지만
    (`_to_columns`), 안내는 한글로 통일한다 — 화면과 같은 어휘를 쓰는 편이 헷갈림이 적다.
    """
    options = _options()

    fields = []
    for key, column in PROJECT_FIELD_MAP.items():
        if key in RELATION_FIELDS or key in UNSUPPORTED_FIELDS:
            continue
        risk = _risk_of(column)
        item = {'key': key, 'column': column, 'risk': risk,
                'note': _RISK_NOTE[risk] + _FIELD_NOTE.get(key, '')}
        if key in options:
            item['options'] = options[key]
        if key in _SHAPES:
            item['shape'] = _SHAPES[key]
        fields.append(item)

    for key, via in RELATION_FIELDS.items():
        fields.append({'key': key, 'column': None, 'risk': 'relation',
                       'note': _RISK_NOTE['relation'], 'via': via})

    for key, why in UNSUPPORTED_FIELDS.items():
        fields.append({'key': key, 'column': None, 'risk': 'unsupported',
                       'note': _RISK_NOTE['unsupported'], 'why': why})

    # 손댈 수 있는 것부터. AI 가 앞쪽만 읽고 끝낼 수도 있다.
    order = {'low': 0, 'core': 1, 'derived': 2, 'forbidden': 2, 'relation': 3,
             'unsupported': 4, 'immutable': 5}
    fields.sort(key=lambda f: (order[f['risk']], f['key']))

    return {
        'fields': fields,
        'counts': {r: sum(1 for f in fields if f['risk'] == r) for r in order},
        'rules': [
            'PATCH 본문은 **바뀐 필드만** 담는다. 안 바뀐 값을 같이 보내지 않는다.',
            '`risk=core` 필드를 AI 가 고치면 **아직 반영되지 않는다**(202). 응답의 '
            '`preview` 에 있는 before → after 를 **사용자에게 그대로 보여주고** '
            '"이대로 반영할까요?" 라고 물은 뒤, 동의를 받아야 `confirm_change` 를 부른다. '
            '묻지 않고 바로 부르면 이 단계가 없는 것과 같다.',
            '`risk=forbidden`(소유자·담당자)은 **시도하지 말 것**(403). 이름만 담기는 '
            '형태라 동명이인을 가릴 수 없다. 참여인력은 `과제참여인력목록` 을 쓴다.',
            '**사람을 지정하는 필드는 knoxId 가 필수다**(`과제참여인력목록`·`과제PL_knoxId`). '
            '이름만 보내면 400 이다. `find_people` 로 찾아 knoxId 를 확인하고, '
            '**같은 이름이 여럿 나오면 반드시 사용자에게 누구인지 물어본 뒤** 넣는다. '
            '여기 들어간 사람은 그 과제를 고칠 수 있게 되므로, 짐작으로 고르지 말 것.',
            '응답의 `ignored` 에 키가 있으면 **그 키는 저장되지 않았다.** 조용히 넘기지 말 것.',
            '`shape` 가 있는 필드는 **그 모양을 그대로 지킨다.** JSON 컬럼이라 모양이 틀려도 '
            '서버는 받아서 저장하고 `applied` 로 성공을 돌려주지만, **화면에서는 안 보인다** — '
            '`applied` 만 보고 "넣었다" 고 답하면 안 된다. 넣은 뒤 `get_project` 로 되읽어 확인할 것.',
            '`expected_version` 을 함께 보내면 남이 먼저 고쳤을 때 409 로 막힌다. '
            '읽을 때 받은 `rowVersion` 을 그대로 넣는다.',
            '`reason` 에 왜 고치는지 적는다. 변경 이력에 남아 사람이 판단 근거를 본다.',
        ],
    }


# ─────────────────────────────────────────────────────────────────────────────
# 성과
# ─────────────────────────────────────────────────────────────────────────────

# 성과의 위험도 기준은 과제와 **하나 다르다.** 성과는 여러 과제가 공유하므로
# 다른 과제의 숫자까지 바꾸는 필드는 전부 핵심이고, 핵심은 202 가 아니라 **403** 이다.
_PERF_RISK_NOTE = {
    'low': '즉시 반영된다.',
    'core': '**AI 가 고치면 즉시 반영되지 않는다**(응답 202). 응답의 `preview`(before → '
            'after)와 **`affectedProjects`(이 성과를 함께 쓰는 다른 과제)** 를 사용자에게 '
            '보여주고 동의를 받은 뒤 `confirm_change` 로 반영한다. '
            '⚠️ 저위험 필드를 같이 보내면 **그것도 함께 대기한다**(`alsoPending`) — '
            '단위와 값이 반쪽만 반영되면 숫자의 뜻이 어긋나기 때문이다.',
    'derived': '**보내도 들어가지 않는다.** 소분류가 정하는 값이라 서버가 소분류에서 '
               '채운다 — 화면도 이 칸을 잠근다. 바꾸려면 `소분류` 를 바꾼다(그러면 '
               '단위가 따라온다). 보낸 값과 다르면 응답 `normalized` 로 알려준다.',
    'immutable': '어떤 경로로도 고칠 수 없다. 서버가 정하거나 별도 API 로만 바뀐다.',
}

_PERF_SHAPES = {
    '월별실적': {
        'example': '[{"월": 1, "값": 12.5}, {"월": 2, "값": 13.0}]',
        'note': '월별 실적 배열. `월별실적여부`가 true 일 때만 화면이 읽는다.',
    },
    '조치사항목록': {
        'example': '[{"내용": "...", "작성일": "2026-06-15"}]',
        'note': '조치사항을 여러 건 담는다. 단건은 `조치사항` 문자열을 쓴다.',
    },
    '계산로직': {
        'example': '{"수식": "...", "설명": "..."}',
        'note': '`로직입력여부`가 true 여야 화면이 표시한다.',
    },
}

_PERF_OPTION_SOURCES = [
    ('대분류', PerformanceCategory),
    ('소분류', PerformanceSubcategory),
]


def _division_names():
    """활성 사업부 이름. `성과항목` 접두어 안내에 쓴다."""
    try:
        rows = (Division.query
                .filter(Division.is_active.is_(True))
                .order_by(Division.id).all())
        return [r.name for r in rows if getattr(r, 'name', None)]
    except Exception:
        return []


def _title_shape():
    """
    `성과항목` 의 모양 — **사업부가 여기 들어간다.**

    성과에는 사업부 컬럼이 없다. 화면은 이름 앞에 `[MX] ` 같은 대괄호 접두어를
    붙여 저장하고, 읽을 때 정규식으로 다시 떼어낸다
    (AllPerformancesView.jsx `extractDivisionFromPerformance`).
    접두어가 없으면 **'모든 성과 현황' 에서 통째로 `미분류` 로 떨어진다.**

    이걸 안내하지 않으면 AI 는 접두어 없이 만들고, 서버는 200 을 돌려주며,
    사용자는 화면을 열어보고서야 안다 — `shape` 를 두는 이유가 바로 이것이다.
    (2026-08-03: 실제로 성과 100건이 전부 미분류로 만들어진 뒤 추가)
    """
    divs = _division_names()
    listed = ' · '.join(divs) if divs else 'MX · VD · DA · NW · 의료기기 · GTR'
    return {
        'example': '"[MX] 폴더블 힌지 수명 예측 오차 저감"',
        'note': '**맨 앞에 `[사업부] ` 를 붙인다 — 서버가 강제한다.** 성과에는 사업부 '
                '컬럼이 없어서 화면이 이 접두어로 사업부를 가른다. '
                f'쓸 수 있는 값: `공통` · {listed}. '
                '어느 사업부인지 모르면 **연결할 과제의 사업부를 따른다**'
                '(`get_project` 의 `사업부`). 정말 모르면 `[공통]` 을 쓴다. '
                '· 모르는 접두어(`[무선]` 같은 오타)는 **400** 이다. '
                '· 접두어가 없으면 서버가 `[공통] ` 을 붙이고 응답의 `normalized` 로 '
                '알려준다 — 그 값으로 굳으므로 그냥 넘기지 말 것. '
                '⚠️ 생성 뒤에는 core 라 못 고친다(403).',
    }


def _perf_risk_of(column: str) -> str:
    """`permissions` 의 성과 분류표를 그대로 읽는다. 여기서 판단하지 않는다."""
    if column in P.PERF_LOW_RISK_FIELDS:
        return 'low'
    # 파생 필드가 먼저다 — 보내도 안 들어가고 서버가 소분류에서 채운다.
    if column in P.PERF_DERIVED_FIELDS:
        return 'derived'
    if column in P.PERF_CORE_FIELDS:
        return 'core'
    if column in P.PERF_IMMUTABLE_FIELDS:
        return 'immutable'
    # 분류표에 없으면 서버가 거부한다(fail closed). 안내도 그렇게 보여야 한다.
    return 'immutable'


def _perf_options():
    out = {}
    for key, model in _PERF_OPTION_SOURCES:
        try:
            rows = (model.query
                    .filter(model.is_active.is_(True))
                    .order_by(model.id)
                    .all())
            names = [r.name for r in rows if getattr(r, 'name', None)]
            if names:
                out[key] = names
        except Exception:
            continue
    return out


def _subcategory_by_category():
    """
    대분류 → 그에 딸린 소분류 목록.

    소분류는 **대분류에 종속**이다(`performance_subcategories.category_id`).
    평평한 목록만 주면 AI 가 `대분류=품질향상` 에 `소분류=시험 시간` 같은 짝이
    안 맞는 조합을 고르고, 서버는 그냥 저장한다 — 화면 필터가 그 조합을
    못 찾아 사실상 안 보이게 된다.
    """
    try:
        cats = {c.id: c.name for c in PerformanceCategory.query.filter(
            PerformanceCategory.is_active.is_(True)).all()}
        subs = (PerformanceSubcategory.query
                .filter(PerformanceSubcategory.is_active.is_(True))
                .order_by(PerformanceSubcategory.order,
                          PerformanceSubcategory.id).all())
        out = {}
        for s in subs:
            name = cats.get(s.category_id)
            if name and getattr(s, 'name', None):
                out.setdefault(name, []).append(s.name)
        return out
    except Exception:
        return {}


def describe_performance_fields() -> dict:
    """
    성과 필드 안내. AI 가 성과를 만들거나 고치기 전에 이걸 먼저 본다.

    과제용 `describe_fields` 와 **다른 표를 읽는다**(PERF_*). 과제 안내를 보고
    성과를 고치려 들면 없는 필드를 보내게 된다.
    """
    options = _perf_options()
    # `성과항목` 만 선택지가 설정 테이블이 아니라 사업부에서 온다(접두어).
    shapes = {**_PERF_SHAPES, '성과항목': _title_shape()}

    fields = []
    for key, column in PERFORMANCE_FIELD_MAP.items():
        risk = _perf_risk_of(column)
        item = {'key': key, 'column': column, 'risk': risk,
                'note': _PERF_RISK_NOTE[risk]}
        if key in options:
            item['options'] = options[key]
        # 소분류는 평평한 목록만으로 부족하다 — 어느 대분류에 딸렸는지 같이 준다.
        if key == '소분류':
            by_cat = _subcategory_by_category()
            if by_cat:
                item['optionsByCategory'] = by_cat
        if key in shapes:
            item['shape'] = shapes[key]
        fields.append(item)

    order = {'low': 0, 'core': 1, 'derived': 2, 'immutable': 3}
    fields.sort(key=lambda f: (order[f['risk']], f['key']))

    return {
        'fields': fields,
        'counts': {r: sum(1 for f in fields if f['risk'] == r) for r in order},
        'rules': [
            '**`성과항목`(title)은 생성 시 필수이고, 맨 앞에 `[사업부] ` 를 붙인다 — '
            '서버가 강제한다.** 성과에는 사업부 컬럼이 없어서 화면이 이 접두어로 '
            '사업부를 가른다. 모르는 접두어는 400, 접두어가 없으면 서버가 `[공통]` 을 '
            '붙이고 `normalized` 로 알려준다. 생성 뒤에는 못 고친다(403). `shape` 참고.',
            '**`대분류`와 `소분류`는 생성 시 필수다 — 서버가 강제한다.** 화면은 '
            '사업부 › 대분류 › 소분류로 묶는데, 비면 그 단계가 `미분류` 가 된다. '
            '소분류는 **대분류에 딸린 값**이라 짝이 어긋나면 **400** 이다 — '
            '`optionsByCategory` 에서 짝이 맞는 것을 고른다 '
            '(예: 대분류 `품질향상` → 소분류 `예측 정확도`).',
            '**`id`(성과코드)가 이미 있으면 409** 다. 과제코드와 같다.',
            '`risk=core` 는 **202(확인 대기)** 다 — 과제와 같다. 다만 응답에 '
            '**`affectedProjects`(이 성과를 함께 쓰는 다른 과제)** 가 함께 오니 '
            '`preview` 와 **같이** 보여줘야 한다. 자기 과제만 보여주고 승인받으면 '
            '남의 과제가 조용히 틀어진다. '
            '생성할 때는 핵심 필드를 바로 지정할 수 있다(아직 아무 과제에도 안 붙었으므로). '
            '⚠️ `_deleted`·`isActive` 는 여전히 막혀 있다 — 성과를 지우면 그 성과를 쓰던 '
            '모든 과제의 연결이 함께 사라지고 복구해도 돌아오지 않기 때문이다.',
            '**과제에 붙이는 것은 이 API 가 아니다.** `link_performances` 를 쓴다 — '
            'AI 가 부르면 확인 대기(202)로 쌓이고, `preview` 에 이 성과를 함께 쓰는 '
            '**다른 과제 목록**(`affectedProjects`)이 실린다. 그것까지 사용자에게 보여주고 '
            '동의를 받은 뒤 `confirm_change` 를 부른다.',
            '연결은 **통째 교체**다. 한 건만 더하려 해도 **기존 연결을 모두 포함해서** '
            '보내야 한다. 빠뜨리면 그 연결이 지워진다 — 먼저 '
            '`list_project_performances` 로 지금 목록을 읽을 것.',
            '**삭제는 MCP 로 하지 않는다.** 성과를 지우면 그 성과를 쓰던 '
            '**모든 과제의 연결이 함께 사라지고, 복구해도 연결은 돌아오지 않는다.**',
            '응답의 `ignored` 에 키가 있으면 **그 키는 저장되지 않았다.** 조용히 넘기지 말 것.',
            '`expected_version` 을 함께 보내면 남이 먼저 고쳤을 때 409 로 막힌다.',
        ],
    }
