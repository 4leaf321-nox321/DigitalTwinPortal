"""폼 채우기 도우미 — LLM 이 **편집 화면의 칸을 채우기만** 한다. 저장은 사람이 누른다.

🚦 **여기는 '화면 보조' 다. '에이전트' 가 아니다.**
    같은 폴더에 나란히 있는데 하는 일이 다르다 —
      · `agent.py`·`agent_tools.py`  LLM 이 도구를 골라 **스스로 고친다**(권한·202·409)
      · `form_assist.py`(이 파일)    LLM 이 **값을 제안만** 한다. 쓰기 코드가 한 줄도 없다
    전체 지도: 루트 `디지털트윈_AI기능_지도.md`

왜 확인 대기(202)가 없나 — **편집 화면 자체가 확인 화면이기 때문이다.**
    에이전트는 자기가 PATCH 를 보내므로 핵심 필드에 사람의 동의를 따로 받아야 한다.
    여기서 나간 값은 **폼에 들어갈 뿐**이고, 사람이 눈으로 보고 고치고 저장을 누른다.
    저장은 평소와 **완전히 같은 경로**로 가서 권한·낙관적 락·변경 이력이 그대로 걸린다.
    그래서 이 모듈은 DB 를 읽지도 쓰지도 않는다(선택지 조회만 한다).

    ⚠️ 뒤집어 말하면 **변경 이력에는 사람이 고친 것으로 남는다**(`source='ui'`).
       AI 가 채운 칸인지 사람이 친 칸인지는 저장 뒤에 구분되지 않는다. 그래서
       화면이 **적용 전에 before → after 를 반드시 보여준다** — 그것이 유일한 관문이다.

왜 `SKILL.md` 를 안 싣나
    그 문서는 **도구를 쓰는 절차**다(describe_fields 먼저 · 202 면 물어보고 confirm ·
    배열은 통째 교체). 여기에는 도구가 없다. 실으면 모델이 있지도 않은 도구를 부르려
    든다. 대신 **필드 목록·선택지는 `ai_tools.describe_fields()` 에서 읽어 온다** —
    설정에서 사업부 하나가 늘면 여기 고칠 것 없이 따라온다. 복제하지 않는다.

무엇을 안 채우나 — 이유가 각각 다르다(`_EXCLUDED` 참고). 특히
    · `진행률`·`진행상태`  액션아이템에서 파생된다. 넣으면 **저장이 400 으로 막힌다**
    · 사람 필드          knoxId 가 있어야 하고, 잘못 넣으면 **편집 권한이 생긴다**
    · 성과·이미지·상세정보  이 폼이 아니라 각자의 화면에서 다룬다
"""
from __future__ import annotations

import json
import re

from flask import current_app

from app.modules.digital_twin_dashboard import detail_rules as DR
from app.modules.digital_twin_dashboard.ai.llm import chat
from app.modules.digital_twin_dashboard.ai_tools import describe_fields

# 붙여넣은 원문 상한. 넘으면 자르고 **잘랐다고 알린다** — 조용히 자르면 사용자는
# 뒷부분이 통째로 무시된 줄 모르고 "왜 저건 안 뽑혔지" 를 헤맨다.
# `.env` 의 `LLM_FORM_SOURCE_CHARS` 로 조절한다(여기 값은 설정이 없을 때의 기본).
MAX_SOURCE_CHARS = 12000

# 한 번에 뽑는 액션아이템 상한. 넘으면 자르고 역시 알린다.
MAX_ACTION_ITEMS = 30
MAX_DETAILS_PER_ITEM = 20

_TITLE_MAX = 200
_DETAIL_MAX = 500
_DESC_MAX = 4000

# LLM 응답을 기다리는 시간. 어댑터 기본값(LLM_TIMEOUT · 120초)보다 **짧게** 잡는다 —
# 이건 대화가 아니라 **편집 중에 잠깐 부르는 것**이라, 2분을 기다리느니 실패가 낫다.
_TIMEOUT = 90.0

# 사실을 뽑아내는 일이라 창의성이 필요 없다. 낮게 고정한다.
_TEMPERATURE = 0.2

# ⚠️ **이 표식을 바꾸면 `scripts/llm_stub.py` 도 같이 바꿀 것.**
#    개발서버에는 LLM 이 없어서 스텁이 이 표식을 보고 그럴듯한 JSON 을 돌려준다
#    (그게 없으면 개발에서 이 기능을 한 줄도 못 돌려본다). 진짜 모델에게는 그냥
#    제목 한 줄이라 해가 없다. 어긋나면 `dt3_test_form_assist.py` 가 실패한다.
MARK_FILL = '### dt-form-assist: project-fill'
MARK_ACTIONS = '### dt-form-assist: action-items'


# ─────────────────────────────────────────────────────────────────────────────
# 채울 수 있는 칸
#
# `tab` 은 화면이 "이 값이 어느 탭에 들어가는지" 를 사람에게 보여주는 데 쓴다 —
# 편집창이 탭으로 나뉘어 있어서, 안 열어 본 탭의 칸이 바뀌면 모르고 저장하게 된다.
# ─────────────────────────────────────────────────────────────────────────────

_FILL_SPECS = {
    '과제명': {
        'type': 'text', 'tab': '기본정보', 'max': _TITLE_MAX,
        'hint': '과제를 한 줄로 요약한 이름. 40자 안쪽을 권한다.',
    },
    '과제상세설명': {
        'type': 'text', 'tab': '기타', 'max': _DESC_MAX,
        # 화면은 서식 있는 편집기(Quill)라 HTML 을 담지만, **여기서는 일반 텍스트만
        # 주고받는다.** 모델에게 HTML 을 만들게 하면 화면이 못 읽는 태그가 섞이고,
        # 현재 값을 HTML 째로 보여주면 프롬프트가 태그로 뒤덮인다.
        # 텍스트 ↔ HTML 변환은 화면이 한다(AiFillPanel).
        'hint': '무엇을 왜 하는 과제인지 서술. 줄바꿈은 그대로 쓴다. **HTML 태그를 쓰지 말 것.**',
    },
    '사업부': {'type': 'choice', 'tab': '기본정보'},
    '프로세스': {'type': 'choice', 'tab': '기본정보'},
    '과제영역': {'type': 'choice', 'tab': '기본정보'},
    '과제구분': {'type': 'choice', 'tab': '기본정보'},
    '시작': {'type': 'month', 'tab': '기본정보', 'hint': '시작 **월 번호**(1~12). 날짜가 아니다.'},
    '종료': {'type': 'month', 'tab': '기본정보', 'hint': '종료 **월 번호**(1~12). 날짜가 아니다.'},
    '중점과제여부': {'type': 'bool', 'tab': '기본정보', 'hint': '중점 과제로 볼 근거가 원문에 있을 때만 true.'},
    # 상세 과제 정보 7섹션 — 보고서에 그대로 실리는 문구다. `_detail_specs()` 가
    # 섹션마다 한계(항목 수·하위 줄 허용)를 붙여 넣는다.
}

# 상세정보 한 섹션이 가질 수 있는 최대 항목·하위 줄. 화면에 제한은 없지만
# **모델이 스무 줄씩 뱉는 것**을 막는다 — 보고서 한 칸에 들어갈 분량이 아니다.
_DETAIL_ITEMS_MAX = 6
_DETAIL_CHILDREN_MAX = 5


def _detail_specs() -> dict:
    """상세정보 7섹션의 사양. 한계는 **`detail_rules` 에서 읽는다**(복제 금지)."""
    out = {}
    for key in DR.DETAIL_KEYS:
        col = DR.KEY_TO_COL.get(key)
        if col is None:
            continue
        parent_only = DR.is_parent_only(col)
        out[key] = {
            'type': 'detail',
            'tab': '상세 과제 정보',
            'col': col,
            'parent_only': parent_only,
            'max_items': DR.DETAIL_PARENT_MAX if parent_only else _DETAIL_ITEMS_MAX,
            'hint': ('항목 %d개까지, **하위 줄 없이**' % DR.DETAIL_PARENT_MAX)
                    if parent_only else
                    ('항목 %d개까지, 항목마다 하위 줄 %d개까지'
                     % (_DETAIL_ITEMS_MAX, _DETAIL_CHILDREN_MAX)),
        }
    return out

# 일부러 뺀 칸과 그 이유. **여기 적힌 이유가 곧 이 기능의 경계다** —
# 넓히려면 이유가 해소됐는지부터 볼 것.
_EXCLUDED = {
    '진행률': '액션아이템에서 파생된다. 직접 보내면 저장이 400 이다.',
    '진행상태': '액션아이템 완료 상태와 모순되면 저장이 400 이다. 사람이 정한다.',
    '과제참여인력목록': 'knoxId 가 필요하고, 넣은 사람에게 편집 권한이 생긴다.',
    '과제PL_knoxId': '〃 (편집 권한의 근거가 되는 값이다)',
    '작성자': '사람 이름은 짐작으로 넣지 않는다.',
    '담당부서목록': '참여인력에서 따라오는 값이다.',
    '성과목록': '성과는 여러 과제가 공유한다 — 성과 탭에서 다룬다.',
    '이미지_좌측': '파일 업로드 경로다.',
    '사업부내공개여부': '공개 범위는 AI 가 정할 일이 아니다.',
    '과제년도': '연도를 바꾸면 액션아이템 날짜 제한이 통째로 어긋난다.',
}

# 정본(`permissions`)이 막은 것은 여기서도 막힌다. 화이트리스트에 있어도 위험도가
# 이 둘이 아니면 내보내지 않는다 — 나중에 어떤 필드가 파생·금지로 바뀌면 **자동으로**
# 빠진다. (core 를 허용하는 이유: 저장 경로가 사람의 UI 저장이라 202 를 안 탄다.)
_ALLOWED_RISKS = frozenset({'low', 'core'})


def fillable_specs() -> dict:
    """지금 채울 수 있는 칸 → 사양. **선택지는 설정 테이블에서 읽어 온다.**

    선택지를 못 읽은 칸은 **아예 빼 버린다.** 목록 없이 채우게 두면 모델이 그럴듯한
    사업부 이름을 지어내고, 그 값은 저장할 때 조용히 무시되거나 400 이 된다.
    """
    catalog = {f['key']: f for f in (describe_fields().get('fields') or [])}

    out = {}
    for key, spec in {**_FILL_SPECS, **_detail_specs()}.items():
        info = catalog.get(key)
        if info is None or info.get('risk') not in _ALLOWED_RISKS:
            continue
        item = dict(spec)
        item['key'] = key
        if spec['type'] == 'choice':
            options = info.get('options') or []
            if not options:
                continue
            item['options'] = options
        out[key] = item
    return out


# ─────────────────────────────────────────────────────────────────────────────
# 응답 파싱 — 모델은 JSON 만 내라고 해도 앞뒤에 말을 붙인다
# ─────────────────────────────────────────────────────────────────────────────

_FENCE_RE = re.compile(r'```(?:json)?\s*(.+?)\s*```', re.S)


def _extract_json(text: str, *, want: str = 'object'):
    """모델 답변에서 JSON 하나를 건져낸다. 못 건지면 `None`.

    통째로 파싱 → 코드펜스 안 → 첫 여는 괄호부터 마지막 닫는 괄호까지, 세 번 시도한다.
    **예외를 던지지 않는다** — 여기서 죽이면 사용자는 "실패했습니다" 만 보고, 모델이
    무슨 말을 했는지는 아무 데도 안 남는다. 호출부가 원문을 로그에 남기고 안내한다.
    """
    raw = (text or '').strip()
    if not raw:
        return None

    open_ch, close_ch = ('{', '}') if want == 'object' else ('[', ']')
    want_type = dict if want == 'object' else list

    candidates = [raw]
    m = _FENCE_RE.search(raw)
    if m:
        candidates.append(m.group(1))
    i, j = raw.find(open_ch), raw.rfind(close_ch)
    if i != -1 and j > i:
        candidates.append(raw[i:j + 1])

    for c in candidates:
        try:
            v = json.loads(c)
        except (ValueError, TypeError):
            continue
        if isinstance(v, want_type):
            return v
    return None


def _source_limit() -> int:
    """원문 상한. `.env` 로 조절한다(모델의 컨텍스트 창이 작으면 줄인다)."""
    try:
        return int(current_app.config.get('LLM_FORM_SOURCE_CHARS') or MAX_SOURCE_CHARS)
    except (TypeError, ValueError):
        return MAX_SOURCE_CHARS


def _clip(text: str) -> tuple[str, list]:
    """원문을 상한까지 자른다. 잘랐으면 **알린다.**"""
    s = (text or '').strip()
    limit = _source_limit()
    if len(s) <= limit:
        return s, []
    return s[:limit], [
        f'붙여넣은 글이 길어 앞 {limit:,}자만 읽었습니다 '
        f'(전체 {len(s):,}자). 나머지는 나눠서 다시 시도하세요.'
    ]


def _parse_failed_note(res) -> str:
    """JSON 을 못 읽었을 때 사용자에게 할 말.

    **길이 제한에 걸린 경우를 갈라서 말한다.** 그때는 원문이 나빠서가 아니라 답이
    중간에서 끊긴 것이라, "원문을 짧게 나눠 보세요" 만 안내하면 사용자는 엉뚱한 곳을
    고치며 헤맨다(고칠 곳은 `LLM_MAX_TOKENS` 다).
    """
    if getattr(res, 'finish_reason', None) == 'length':
        return ('AI 응답이 **길이 제한에 걸려 잘렸습니다.** 원문을 줄이거나, '
                '서버의 `LLM_MAX_TOKENS` 를 올려 주세요(관리자).')
    return 'AI 응답에서 값을 읽지 못했습니다. 원문을 짧게 나눠 다시 시도해 보세요.'


# ─────────────────────────────────────────────────────────────────────────────
# ① 과제 폼 채우기
# ─────────────────────────────────────────────────────────────────────────────

def _current_text(spec: dict, v) -> str:
    """프롬프트에 실을 '지금 값'.

    상세정보는 JSON 째로 실으면 **프롬프트가 중괄호로 뒤덮인다** — 토큰만 먹고
    모델이 읽지도 못한다. 사람이 읽는 모양(줄 목록)으로 줄여서 싣는다.
    """
    if v in (None, '', [], {}):
        return '(비어 있음)'
    if spec['type'] != 'detail':
        return str(v)

    shape = _detail_shape(v)
    if not shape or not shape[1]:
        return '(비어 있음)'
    out = []
    for text, kids in shape[1]:
        out.append(text)
        out += [f'  - {k}' for k in kids if k]
    return ' / '.join(out)[:400]


def _fill_prompt(specs: dict, current: dict, source: str, instruction: str) -> list:
    lines = [
        MARK_FILL,
        '당신은 과제 관리 화면의 입력 도우미다. 사용자가 준 글에서 사실을 뽑아 '
        '**편집 폼의 칸에 넣을 값**을 만든다.',
        '',
        '지켜야 할 것',
        '1) 아래 "채울 수 있는 칸" 에 있는 key 만 쓴다. 없는 key 는 무시된다.',
        '2) **근거가 원문에 있는 칸만** 채운다. 확실치 않으면 그 칸을 빼라 — '
        '빈칸으로 두는 편이 지어낸 값보다 낫다.',
        '3) 이미 들어 있는 값이 원문과 어긋나지 않으면 **그 칸을 건드리지 마라.**',
        '4) 선택지(options)가 있는 칸은 **목록에 있는 문자열을 그대로** 쓴다. '
        '비슷한 말을 지어내면 버려진다.',
        '5) 사람 이름·담당자·진행률·진행상태는 **절대 넣지 마라.** 여기서 다루지 않는다.',
        '',
        '출력 형식 — **JSON 객체 하나만**. 설명·인사·코드펜스를 붙이지 마라.',
        '{"fields": {"<key>": <값>}, "note": "<사람에게 전할 짧은 말(선택)>"}',
        '',
        '채울 수 있는 칸',
    ]
    for key, spec in specs.items():
        bits = [f'- `{key}` ({spec["type"]})']
        if spec.get('hint'):
            bits.append(spec['hint'])
        if spec.get('options'):
            bits.append('선택지: ' + ' · '.join(spec['options']))
        lines.append(' '.join(bits))

    if any(s['type'] == 'detail' for s in specs.values()):
        lines += [
            '',
            '상세 과제 정보(`상세정보_…`)를 채울 때',
            '  모양: {"enabled": true, "items": [{"text": "한 줄", '
            '"children": [{"text": "하위 줄"}]}]}',
            f'  · **한 줄은 {DR.DETAIL_LINE_LIMIT}자를 넘기지 마라**(공백은 0.5자로 센다). '
            '넘는 줄은 버려진다 — 화면 입력 제한이다.',
            '  · 보고서에 그대로 실리는 문구다. **명사형으로 짧게 끊어 쓴다** '
            '("해석 정확도 15% 개선", "시험 조건 표준화"). 문장으로 늘여 쓰지 마라.',
            '  · 근거가 없는 섹션은 **통째로 빼라.** 빈 섹션을 만들지 마라.',
        ]

    user = ['[현재 값]']
    for key, spec in specs.items():
        user.append(f'- {key}: {_current_text(spec, current.get(key))}')
    if instruction:
        user += ['', '[사용자 지시]', instruction]
    user += ['', '[원문]', source or '(없음)']

    return [
        {'role': 'system', 'content': '\n'.join(lines)},
        {'role': 'user', 'content': '\n'.join(user)},
    ]


def _coerce_detail(spec: dict, value):
    """상세정보 섹션 하나를 화면이 읽는 모양으로 → `(ok, 값, 사유, 알림[])`.

    **위반한 줄만 버리고 섹션은 살린다.** 사람이 보낸 값이면 서버가 400 으로 막지만
    (`detail_rules.detail_section_errors`), 모델이 만든 값을 그렇게 다루면 한 줄이
    길다고 나머지 다섯 줄까지 잃는다. 대신 **뺐다는 사실을 반드시 말한다** —
    조용히 빼면 사용자는 모델이 그만큼만 만든 줄 안다.
    """
    if isinstance(value, list):          # `items` 배열만 보내는 모델이 있다. 받아 준다.
        value = {'items': value}
    if not isinstance(value, dict):
        return False, None, '모양이 올바르지 않습니다 ({enabled, items}).', []

    raw_items = value.get('items')
    if not isinstance(raw_items, list):
        return False, None, '`items` 가 배열이 아닙니다.', []

    def _line(x):
        return str((x.get('text') if isinstance(x, dict) else x) or '').strip()

    notes, items = [], []
    too_long = kids_dropped = 0

    for it in raw_items:
        if len(items) >= spec['max_items']:
            break
        text = _line(it)
        if not text:
            continue
        if DR.screen_width(text) > DR.DETAIL_LINE_LIMIT:
            too_long += 1
            continue

        row = {'text': text, 'children': []}
        kids = it.get('children') if isinstance(it, dict) else None
        if isinstance(kids, list) and kids:
            if spec['parent_only']:
                # 이 섹션은 화면에 하위 줄을 그릴 자리가 없다. 넣으면 안 보인다.
                kids_dropped += len(kids)
            else:
                for k in kids[:_DETAIL_CHILDREN_MAX]:
                    ktext = _line(k)
                    if not ktext:
                        continue
                    if DR.screen_width(ktext) > DR.DETAIL_LINE_LIMIT:
                        too_long += 1
                        continue
                    row['children'].append({'text': ktext})
        items.append(row)

    if len(raw_items) > spec['max_items']:
        notes.append(f"항목은 {spec['max_items']}개까지라 뒤의 "
                     f"{len(raw_items) - spec['max_items']}개를 뺐습니다.")
    if too_long:
        notes.append(f'{DR.DETAIL_LINE_LIMIT}자(공백은 0.5자)를 넘는 줄 {too_long}개를 '
                     f'뺐습니다 — 화면 입력 제한이라 저장할 수 없습니다.')
    if kids_dropped:
        notes.append(f'이 섹션은 하위 줄을 쓰지 않아 {kids_dropped}줄을 뺐습니다.')

    if not items:
        return False, None, '넣을 줄이 없습니다(모두 비었거나 39자를 넘었습니다).', notes

    # `enabled` 를 **반드시 켠다.** 없거나 false 면 화면이 이 섹션을 통째로 건너뛴다 —
    # 값은 들어갔는데 아무 데도 안 보이는 상태가 된다.
    return True, {'enabled': True, 'items': items}, None, notes


def _coerce(spec: dict, value):
    """값 하나를 칸의 규칙에 맞춘다 → `(ok, 값, 사유, 알림[])`.

    맞출 수 없으면 **버리고 사유를 남긴다.** 사유는 화면에 그대로 뜬다 — 무엇이
    왜 안 들어갔는지 못 보면 사용자는 AI 가 그 칸을 안 건드린 줄 안다.
    """
    kind = spec['type']

    if kind == 'detail':
        return _coerce_detail(spec, value)

    if kind == 'text':
        if not isinstance(value, (str, int, float)):
            return False, None, '문자열이 아닙니다.', []
        s = str(value).strip()
        if not s:
            return False, None, '빈 값입니다.', []
        if len(s) > spec.get('max', _TITLE_MAX):
            return False, None, f"{spec.get('max')}자를 넘습니다({len(s)}자).", []
        return True, s, None, []

    if kind == 'choice':
        options = spec.get('options') or []
        s = str(value or '').strip()
        if not s:
            return False, None, '빈 값입니다.', []
        if s in options:
            return True, s, None, []
        # 대소문자·공백만 다른 경우는 받아 준다. 그 이상은 **지어낸 값**으로 본다.
        loose = {o.replace(' ', '').lower(): o for o in options}
        hit = loose.get(s.replace(' ', '').lower())
        if hit:
            return True, hit, None, []
        return False, None, f"선택지에 없는 값입니다 — 쓸 수 있는 값: {' · '.join(options)}", []

    if kind == 'month':
        try:
            n = int(str(value).strip())
        except (TypeError, ValueError):
            return False, None, '월 번호(1~12)가 아닙니다.', []
        if not 1 <= n <= 12:
            return False, None, f'월 번호는 1~12 입니다(보낸 값 {n}).', []
        return True, n, None, []

    if kind == 'bool':
        if isinstance(value, bool):
            return True, value, None, []
        s = str(value).strip().lower()
        if s in ('true', '예', 'yes', '1'):
            return True, True, None, []
        if s in ('false', '아니오', 'no', '0'):
            return True, False, None, []
        return False, None, '참/거짓이 아닙니다.', []

    return False, None, '알 수 없는 칸입니다.', []


def fill_project_form(*, current: dict, source: str, instruction: str = '') -> dict:
    """원문 → 폼에 넣을 값. `{patch, notes, skipped, model}`.

    `current` 는 **화면이 지금 들고 있는 값**이다(저장된 값이 아니다) — 사용자가
    편집 중인 상태 위에서 판단해야 "이미 채워진 칸은 건드리지 마라" 가 성립한다.
    `과제상세설명` 은 일반 텍스트로 오간다(화면이 HTML 과 변환한다).
    """
    specs = fillable_specs()
    if not specs:
        # 설정 테이블을 못 읽으면 선택지가 다 빠져 여기로 온다. 조용히 빈 결과를 주면
        # 사용자는 모델이 못 알아들은 줄 안다 — 원인을 그대로 말한다.
        return {'patch': {}, 'notes': ['채울 수 있는 칸이 없습니다. 설정(사업부·프로세스 등)을 '
                                       '확인해 주세요.'], 'skipped': [], 'model': None}

    clipped, notes = _clip(source)
    # max_tokens 를 안 넘긴다 — `LLM_MAX_TOKENS`(.env) 하나로 조절한다.
    res = chat(_fill_prompt(specs, current or {}, clipped, (instruction or '').strip()),
               temperature=_TEMPERATURE, timeout=_TIMEOUT)

    data = _extract_json(res.content, want='object')
    if data is None:
        current_app.logger.warning('[DT-AI/form] JSON 을 못 건졌다(finish=%s): %s',
                                   res.finish_reason, (res.content or '')[:300])
        return {'patch': {}, 'notes': notes + [_parse_failed_note(res)],
                'skipped': [], 'model': res.model}

    fields = data.get('fields')
    if not isinstance(fields, dict):
        # `{"fields": …}` 를 빼먹고 칸을 바로 담아 오는 모델이 있다. 받아 준다.
        fields = {k: v for k, v in data.items() if k in specs}
    if data.get('note'):
        notes.append(str(data['note'])[:300])

    patch, skipped, unchanged = {}, [], []
    for key, value in (fields or {}).items():
        spec = specs.get(key)
        if spec is None:
            skipped.append({'key': str(key)[:60],
                            'why': _EXCLUDED.get(key, '이 화면에서 채울 수 없는 칸입니다.')})
            continue
        ok, v, why, hints = _coerce(spec, value)
        # 다듬으면서 뺀 것이 있으면 **성공했어도** 알린다(상세정보의 긴 줄 등).
        notes += [f'{key}: {h}' for h in hints]
        if not ok:
            skipped.append({'key': key, 'why': why})
            continue
        # 지금 값과 같으면 **제안 목록에 올리지 않는다** — 미리보기에 안 바뀌는 줄이
        # 섞이면 사람이 무엇을 확인해야 하는지 흐려진다.
        #
        # 다만 **조용히 빼지는 않는다.** 모델이 사업부를 제대로 골랐는데 지금 값과 같아서
        # 아무것도 안 뜨면, 사용자는 "선택지 있는 칸은 안 되는구나" 로 읽는다(실제로 그랬다).
        if _same(current.get(key), v):
            unchanged.append(key)
            continue
        # `kind` 를 함께 준다 — 화면이 종류마다 다르게 그린다(글 한 줄 / 계층 목록).
        patch[key] = {'value': v, 'tab': spec['tab'], 'kind': spec['type']}

    if unchanged:
        notes.append(f"{' · '.join(unchanged)} 은(는) 지금 값과 같아 그대로 두었습니다.")

    return {'patch': patch, 'notes': notes, 'skipped': skipped, 'model': res.model}


def _detail_shape(v):
    """상세정보 섹션을 비교용 모양으로. `enabled` 와 줄 텍스트만 본다."""
    if not isinstance(v, dict):
        return None
    items = v.get('items') if isinstance(v.get('items'), list) else []
    return (bool(v.get('enabled')), tuple(
        (str((it or {}).get('text') or '').strip(),
         tuple(str((k or {}).get('text') or '').strip()
               for k in ((it or {}).get('children') or [])))
        for it in items if str((it or {}).get('text') or '').strip()
    ))


def _same(a, b) -> bool:
    if isinstance(b, dict):          # 상세정보 섹션
        return _detail_shape(a) == _detail_shape(b)
    if isinstance(b, bool):
        return bool(a) is b
    if isinstance(b, int):
        try:
            return int(a) == b
        except (TypeError, ValueError):
            return False
    return str(a or '').strip() == str(b or '').strip()


# ─────────────────────────────────────────────────────────────────────────────
# ② 붙여넣기 → 액션아이템
#
# 왜 **완료 표시를 안 뽑나** — 진행률이 여기서 계산되기 때문이다.
#   액션아이템의 완료 여부가 과제 진행률과 진행상태를 정한다(서버가 파생시키고,
#   모순이면 저장을 400 으로 막는다). 회의록의 "A 끝냄" 한 줄을 모델이 완료로 읽으면
#   **과제 진척이 조용히 움직인다.** 그래서 전부 미완료로 들어가고, 완료 체크는
#   사람이 화면에서 한다 — 그 화면에는 완료일·액티비티 파생이 이미 걸려 있다.
# ─────────────────────────────────────────────────────────────────────────────

_DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')


def _action_prompt(*, source: str, project_name: str, year: int,
                   start_month, end_month, existing: list) -> list:
    period = (f'{start_month}월 ~ {end_month}월'
              if start_month and end_month else '연중')
    system = [
        MARK_ACTIONS,
        '당신은 과제 관리 화면의 입력 도우미다. 사용자가 준 **과제 내용**에서 '
        '**해야 할 일(액션아이템)** 을 뽑아 목록으로 만든다.',
        '',
        '들어오는 글은 두 갈래다. 둘 다 다뤄야 한다.',
        '  ㉠ **회의록·메일·주간보고** — 할 일이 이미 줄 단위로 적혀 있다. 그대로 옮긴다.',
        '  ㉡ **서술형 과제 설명** — "…를 위해 …를 확보하고 …를 개선한다" 처럼 '
        '문장으로만 적혀 있다. 이때는 **문장을 일의 단계로 나눈다.**',
        '',
        '서술형을 나누는 법',
        '  · 문장 속 **행동(…확보, …개발, …구축, …검증, …개선)** 을 찾아 각각 한 건으로 만든다.',
        '  · 목표가 크면 **일이 진행되는 순서**로 쪼갠다 '
        '(예: 데이터 확보 → 모델 개발 → 검증 → 적용).',
        '  · 목록의 **순서가 곧 화면의 순서**다. 먼저 할 일부터 적어라.',
        '  · 🚧 **경계** — 나누는 것은 되지만 **원문에 없는 일을 더하지는 마라.** '
        '"품의 결재", "킥오프 회의" 처럼 흔하지만 원문에 없는 것을 채워 넣지 마라.',
        '',
        '지켜야 할 것',
        '1) 원문이 말하는 일만 다룬다. 확실치 않으면 그 건을 빼라.',
        '2) 제목은 **한 줄짜리 행동**으로 쓴다("힌지 수명 시험 조건 확정"). '
        '느낌이나 상태("잘 안 됨"), 배경 설명("경쟁사 대비 열위")은 액션아이템이 아니다.',
        '3) 한 건이 **한두 달 안에 끝날 크기**가 되게 한다. '
        f'보통 **3~8건**이면 충분하다(이 과제 기간: {period}). '
        '너무 잘게 쪼개면 목록만 길어지고, 너무 뭉치면 진척을 볼 수 없다.',
        '4) 한 건 아래 세부 작업이 드러나면 `액티비티` 에 2~4개로 나눠 담는다. '
        '원문이 그만큼 말하지 않으면 빈 배열로 둔다.',
        f'5) `목표일` 은 원문에 기한이 있을 때만 `YYYY-MM-DD` 로 쓴다. '
        f'**{year}년 안이어야 한다.** 없으면 빈 문자열 — '
        '기한을 **짐작해서 만들지 마라**(화면에 균일 분배 기능이 따로 있다).',
        '6) **완료 여부는 쓰지 마라.** 다 끝난 일이라도 목록에만 담는다 — '
        '완료 표시는 사람이 화면에서 한다.',
        '7) 이미 있는 액션아이템과 **같은 일은 다시 만들지 마라.**',
        '',
        '출력 형식 — **JSON 객체 하나만**. 설명·코드펜스를 붙이지 마라.',
        '{"items": [{"제목": "...", "목표일": "", "액티비티": ["...", "..."]}], '
        '"note": "<사람에게 전할 짧은 말(선택)>"}',
        '뽑을 것이 없으면 `{"items": []}` 로 답한다.',
    ]

    user = [f'[과제] {project_name or "(이름 없음)"} · {year}년']
    if start_month and end_month:
        user.append(f'[기간] {start_month}월 ~ {end_month}월')
    if existing:
        user.append('[이미 있는 액션아이템]')
        user += [f'- {t}' for t in existing[:50]]
    user += ['', '[과제 내용]', source or '(없음)']

    return [
        {'role': 'system', 'content': '\n'.join(system)},
        {'role': 'user', 'content': '\n'.join(user)},
    ]


def _norm_title(s: str) -> str:
    """중복 판정용 정규화. 공백과 대소문자만 무시한다 — 과하게 다듬으면 다른 일이 겹친다."""
    return re.sub(r'\s+', '', str(s or '')).lower()


def extract_action_items(*, source: str, year: int, project_name: str = '',
                         start_month=None, end_month=None,
                         existing_titles=None) -> dict:
    """원문 → 액션아이템 후보. `{items, notes, model}`.

    돌려주는 모양은 **화면이 쓰는 그대로**다(`제목`·`목표일`·`세부항목목록`).
    `id` 는 넣지 않는다 — 화면이 붙인다(기존 목록과 안 겹치게 만들어야 해서
    서버가 정할 수 있는 값이 아니다).
    """
    existing = [str(t) for t in (existing_titles or []) if str(t or '').strip()]
    clipped, notes = _clip(source)

    # max_tokens 를 안 넘긴다 — `LLM_MAX_TOKENS`(.env) 하나로 조절한다.
    # ⚠️ 이쪽이 **가장 길게 답하는 경로**다(액션아이템 수십 건 + 액티비티).
    #    설정을 낮추면 여기부터 잘린다 — 그때 `_parse_failed_note` 가 그렇게 말한다.
    res = chat(_action_prompt(source=clipped, project_name=project_name, year=year,
                              start_month=start_month, end_month=end_month,
                              existing=existing),
               temperature=_TEMPERATURE, timeout=_TIMEOUT)

    data = _extract_json(res.content, want='object')
    if data is None:
        current_app.logger.warning('[DT-AI/form] JSON 을 못 건졌다(finish=%s): %s',
                                   res.finish_reason, (res.content or '')[:300])
        return {'items': [], 'notes': notes + [_parse_failed_note(res)],
                'model': res.model}

    raw_items = data.get('items')
    if not isinstance(raw_items, list):
        raw_items = []
    if data.get('note'):
        notes.append(str(data['note'])[:300])

    seen = {_norm_title(t) for t in existing}
    items, dropped = [], 0

    for it in raw_items:
        if len(items) >= MAX_ACTION_ITEMS:
            dropped += 1
            continue
        if not isinstance(it, dict):
            continue
        title = str(it.get('제목') or it.get('title') or '').strip()
        if not title:
            continue
        if len(title) > _TITLE_MAX:
            title = title[:_TITLE_MAX]

        key = _norm_title(title)
        duplicate = key in seen
        seen.add(key)

        # 목표일 — 과제년도 밖이면 **날짜만 버리고 항목은 살린다.**
        # 화면의 날짜 칸이 그 해로 제한돼 있어(min/max) 넣어도 안 보인다.
        due = str(it.get('목표일') or it.get('due') or '').strip()
        if due and not (_DATE_RE.match(due) and due[:4] == str(year)):
            notes.append(f'"{title[:20]}" 의 목표일 `{due}` 은 {year}년이 아니라 비웠습니다.')
            due = ''

        details = it.get('액티비티')
        if not isinstance(details, list):
            details = it.get('세부항목목록') if isinstance(it.get('세부항목목록'), list) else []
        rows = []
        for d in details[:MAX_DETAILS_PER_ITEM]:
            text = d.get('내용') if isinstance(d, dict) else d
            text = str(text or '').strip()
            if text:
                rows.append({'내용': text[:_DETAIL_MAX]})

        items.append({
            '제목': title,
            '목표일': due,
            '세부항목목록': rows,
            # 이미 같은 제목이 있다는 표시. 화면이 이 줄의 체크를 꺼 둔다 —
            # 같은 회의록을 두 번 붙여넣는 일이 실제로 흔하다.
            'duplicate': duplicate,
        })

    if dropped:
        notes.append(f'한 번에 {MAX_ACTION_ITEMS}건까지만 만듭니다 — {dropped}건을 뺐습니다.')

    return {'items': items, 'notes': notes, 'model': res.model}


# ─────────────────────────────────────────────────────────────────────────────
# ③ 붙여넣기 → 참여인력 **후보**
#
# 🚨 **여기만 다른 물건이다 — AI 는 값을 채우지 않고 이름만 찾아 준다.**
#     참여인력에 들어간 사람은 그 과제를 **고칠 수 있게 된다**(`is_project_member`).
#     그리고 원문에는 동명이인을 가릴 정보가 없다 — "홍길동" 이 어느 홍길동인지
#     모델이 알 방법이 없다. 짐작으로 고르면 **엉뚱한 사람에게 편집 권한**이 간다.
#
#     그래서 흐름을 나눈다:
#       ① 모델은 원문에서 **이름과 근거 문장만** 뽑는다 (knoxId 는 절대 만들지 않는다)
#       ② 서버가 이름으로 계정을 찾아 **후보를 붙인다** (`/people/search` 와 같은 규칙)
#       ③ 사람이 화면에서 **누구인지 고른다** — 후보가 하나뿐이어도 고르는 것은 사람이다
#     ②를 서버가 하는 이유는 모델에게 사용자 명부를 통째로 넘기지 않기 위해서다.
# ─────────────────────────────────────────────────────────────────────────────

MARK_PEOPLE = '### dt-form-assist: people'

MAX_PEOPLE = 20


def _people_prompt(*, source: str, existing: list) -> list:
    system = [
        MARK_PEOPLE,
        '당신은 과제 관리 화면의 입력 도우미다. 글에서 **이 과제에 참여하는 사람의 '
        '이름**을 뽑는다.',
        '',
        '지켜야 할 것',
        '1) 원문에 **이름이 적힌 사람만** 뽑는다. 역할·직책만 있고 이름이 없으면 뽑지 마라.',
        '2) **knoxId·사번·이메일을 만들지 마라.** 계정 확인은 서버가 한다. 이름만 쓴다.',
        '3) 이 과제와 무관한 사람(참조 수신자, 인용된 논문 저자 등)은 빼라.',
        '4) `근거` 에 그 사람이 나온 **원문의 짧은 구절**을 그대로 옮긴다 — '
        '사람이 판단할 근거가 된다. 지어내지 마라.',
        '5) 이미 등록된 사람은 다시 만들지 마라.',
        '',
        '출력 형식 — **JSON 객체 하나만**. 설명·코드펜스를 붙이지 마라.',
        '{"people": [{"이름": "홍길동", "근거": "원문 구절"}]}',
        '뽑을 사람이 없으면 `{"people": []}`.',
    ]
    user = []
    if existing:
        user.append('[이미 등록된 사람]')
        user += [f'- {n}' for n in existing[:50]]
        user.append('')
    user += ['[원문]', source or '(없음)']
    return [
        {'role': 'system', 'content': '\n'.join(system)},
        {'role': 'user', 'content': '\n'.join(user)},
    ]


def extract_people(*, source: str, existing_names=None, resolver=None) -> dict:
    """원문 → 참여인력 후보. `{people: [...], notes, model}`.

    `resolver(name) -> [{이름, knoxId, 부서, 동명이인}]` 는 **서버가 넘긴다**
    (이 모듈은 DB 를 모른다). 후보를 못 찾아도 이름은 돌려준다 — 아직 가입하지 않은
    사람일 수 있고, 그때는 사람이 knoxId 를 직접 넣어야 한다는 사실을 화면이 알린다.
    """
    existing = [str(n) for n in (existing_names or []) if str(n or '').strip()]
    clipped, notes = _clip(source)

    res = chat(_people_prompt(source=clipped, existing=existing),
               temperature=_TEMPERATURE, timeout=_TIMEOUT)

    data = _extract_json(res.content, want='object')
    if data is None:
        current_app.logger.warning('[DT-AI/form] JSON 을 못 건졌다(finish=%s): %s',
                                   res.finish_reason, (res.content or '')[:300])
        return {'people': [], 'notes': notes + [_parse_failed_note(res)],
                'model': res.model}

    raw = data.get('people') if isinstance(data.get('people'), list) else []
    if data.get('note'):
        notes.append(str(data['note'])[:300])

    seen = {_norm_title(n) for n in existing}
    out, dropped = [], 0
    for item in raw:
        if len(out) >= MAX_PEOPLE:
            dropped += 1
            continue
        if isinstance(item, dict):
            name = str(item.get('이름') or item.get('name') or '').strip()
            why = str(item.get('근거') or item.get('reason') or '').strip()
        else:
            name, why = str(item or '').strip(), ''
        if not name or len(name) > 40:
            continue
        key = _norm_title(name)
        if key in seen:
            continue
        seen.add(key)

        # 🚨 모델이 knoxId 를 보내와도 **쓰지 않는다.** 계정은 서버가 찾는다.
        candidates = resolver(name) if resolver else []
        out.append({
            '이름': name,
            '근거': why[:200],
            'candidates': candidates,
            # 후보가 둘 이상이면 화면이 **반드시 고르게** 한다. 하나여도 자동으로
            # 넣지 않는다 — 이름이 같은 다른 사람일 수 있고, 그 대가가 편집 권한이다.
            '동명이인': len(candidates) > 1,
        })

    if dropped:
        notes.append(f'한 번에 {MAX_PEOPLE}명까지만 찾습니다 — {dropped}명을 뺐습니다.')
    return {'people': out, 'notes': notes, 'model': res.model}


# ─────────────────────────────────────────────────────────────────────────────
# ④ DX KPI 연결 **추천**
#
# ⚠️ 이 자리는 원래 AI 쓰기가 **403 으로 막혀 있다**(`replace_project_kpi_links`) —
#    "AI 가 추측으로 채우면 매트릭스의 빈칸(=계획의 구멍)이 가짜로 메워진다" 는 판단이었다.
#    2026-08-08 에 **폼 도우미만 예외로** 열었다. 근거는 그 걱정에 대한 답이 있기 때문이다:
#      · AI 는 연결을 **만들지 않는다.** 후보와 **근거**를 낼 뿐이다
#      · 화면이 자동으로 체크하지 않는다 — **사람이 하나씩 고른다**
#      · 저장은 평소의 KPI 저장 경로(사람 권한·낙관적 락)
#    **에이전트(`actor_mode='ai'`)의 403 은 그대로다.** LLM 이 스스로 거는 것은 여전히 금지다.
#
# AI 가 정하지 않는 것 — **대상 사업부와 기여 방법.**
#    대상은 서버 규칙(자기 사업부만 / 기능조직은 골라야 함 / 사업부 전용 지표)이 정하고,
#    화면(`KpiLinkSection.toggleKpi`)이 이미 그 규칙대로 만든다. 여기서 다시 만들면 갈린다.
# ─────────────────────────────────────────────────────────────────────────────

MARK_KPI = '### dt-form-assist: kpi-links'

MAX_KPI_SUGGESTIONS = 8

# 프롬프트에 실을 근거의 상한. **상세 과제 정보 쪽을 더 넉넉히 준다** —
# 실제 데이터에서 내용이 그쪽에 있는 과제가 더 많다(2026-08-08 확인).
_KPI_DETAIL_MAX = 4000
_KPI_DESC_MAX = 2000

_TAG_RE = re.compile(r'<[^>]+>')
_ENTITIES = (('&nbsp;', ' '), ('&amp;', '&'), ('&lt;', '<'),
             ('&gt;', '>'), ('&quot;', '"'), ('&#39;', "'"))


def _strip_html(value) -> str:
    """`과제상세설명` 의 HTML 을 벗긴다.

    화면이 서식 편집기(Quill)라 이 값은 `<p>…</p>` 로 저장돼 있다. 그대로 프롬프트에
    실으면 **태그가 절반**을 차지하고, 모델이 태그를 근거 문장으로 옮겨 적기도 한다.
    (`AiFillPanel` 은 브라우저에서 같은 일을 한다 — 그쪽은 DOM 을 쓸 수 있어 방식이 다르다)
    """
    s = str(value or '')
    if not s:
        return ''
    s = re.sub(r'<(?:/p|br\s*/?|/div|/li|/h[1-6])>', '\n', s, flags=re.I)
    s = _TAG_RE.sub('', s)
    for a, b in _ENTITIES:
        s = s.replace(a, b)
    return re.sub(r'\n{3,}', '\n\n', s).strip()


def _kpi_prompt(*, project: dict, available: list, linked_ids: list,
                instruction: str) -> list:
    system = [
        MARK_KPI,
        '당신은 과제 관리 화면의 입력 도우미다. 과제 내용을 읽고 **이 과제가 기여하는 '
        'DX KPI 지표**를 고른다.',
        '',
        '지켜야 할 것',
        '1) 아래 목록의 `id` 만 쓴다. 목록에 없는 지표를 지어내지 마라.',
        '2) **근거가 과제 내용에 있는 것만** 고른다. 그럴듯해 보인다고 넣지 마라 — '
        '이 연결은 "이 과제가 무엇에 기여하는가" 를 선언하는 값이라, '
        '**빈칸을 가짜로 채우면 계획의 구멍이 보이지 않게 된다.**',
        '3) `근거` 에 **과제의 어느 대목 때문인지** 한 줄로 적는다. 사람이 그걸 보고 '
        '판단한다 — 근거가 약하면 고르지 않을 것이다.',
        '4) 확신이 없으면 **적게 고르는 편**이 낫다. 아무것도 못 고르면 빈 목록으로 답한다.',
        '5) 대상 사업부·기여 방법은 **정하지 마라.** 서버와 화면이 규칙대로 정한다.',
        '6) **[상세 과제 정보] 를 먼저 읽어라.** 과제 설명이 비어 있어도 그쪽에 '
        '목표·상세내용·성과가 적혀 있는 경우가 많다. 거기 적힌 목표·성과 지표가 '
        '가장 강한 근거다.',
        '',
        '출력 형식 — **JSON 객체 하나만**. 설명·코드펜스를 붙이지 마라.',
        '{"kpis": [{"id": 12, "근거": "과제 내용의 어느 대목"}]}',
        '',
        '고를 수 있는 지표',
    ]
    for k in available:
        bits = [f"- id={k['kpiDefinitionId']} `{k.get('label') or ''}`"]
        if k.get('category'):
            bits.append(f"({k['category']})")
        if k.get('unit'):
            bits.append(f"단위 {k['unit']}")
        if k.get('kind') == 'platform':
            bits.append('· 플랫폼 구축(측정값 없음)')
        if k.get('kpiDefinitionId') in set(linked_ids):
            bits.append('· **이미 연결됨**')
        lines_bit = ' '.join(bits)
        system.append(lines_bit)

    user = ['[과제]']
    for key in ('과제명', '사업부', '프로세스', '과제영역', '과제구분'):
        if project.get(key):
            user.append(f'- {key}: {project[key]}')

    # **상세 과제 정보를 먼저 싣는다.** 실제로 내용이 여기 있는 과제가 더 많고,
    # 프롬프트 앞쪽이 뒤쪽보다 잘 읽힌다.
    detail = str(project.get('상세정보') or '').strip()
    if detail:
        user += ['', '[상세 과제 정보]', detail[:_KPI_DETAIL_MAX]]

    desc = _strip_html(project.get('과제상세설명'))
    if desc:
        user += ['', '[과제 설명]', desc[:_KPI_DESC_MAX]]
    if not detail and not desc:
        user += ['', '(과제 설명과 상세 과제 정보가 모두 비어 있다 — '
                 '근거가 없으면 아무것도 고르지 마라.)']
    if instruction:
        user += ['', '[사용자 지시]', instruction]

    return [
        {'role': 'system', 'content': '\n'.join(system)},
        {'role': 'user', 'content': '\n'.join(user)},
    ]


def suggest_kpi_links(*, project: dict, available: list, linked_ids=None,
                      instruction: str = '') -> dict:
    """과제 내용 → 연결할 만한 DX KPI 후보. `{items, notes, model}`.

    **연결을 만들지 않는다.** 후보와 근거만 돌려주고, 고르는 것은 사람이다.
    이미 걸린 지표는 후보에서 뺀다 — 화면에 이미 체크돼 있어 다시 제안할 이유가 없다.
    """
    if not available:
        return {'items': [], 'notes': ['고를 수 있는 DX KPI 지표가 없습니다.'], 'model': None}

    linked = set(linked_ids or ())
    res = chat(_kpi_prompt(project=project or {}, available=available,
                           linked_ids=sorted(linked), instruction=(instruction or '').strip()),
               temperature=_TEMPERATURE, timeout=_TIMEOUT)

    data = _extract_json(res.content, want='object')
    if data is None:
        current_app.logger.warning('[DT-AI/form] JSON 을 못 건졌다(finish=%s): %s',
                                   res.finish_reason, (res.content or '')[:300])
        return {'items': [], 'notes': [_parse_failed_note(res)], 'model': res.model}

    by_id = {k['kpiDefinitionId']: k for k in available}
    notes, items, seen = [], [], set()
    if data.get('note'):
        notes.append(str(data['note'])[:300])

    for row in (data.get('kpis') if isinstance(data.get('kpis'), list) else []):
        if len(items) >= MAX_KPI_SUGGESTIONS:
            break
        raw = row.get('id') if isinstance(row, dict) else row
        try:
            kid = int(raw)
        except (TypeError, ValueError):
            continue
        # **목록에 없는 id 는 버린다.** 모델이 숫자를 지어내면 화면이 알 수 없는 지표를
        # 체크하게 되고, 저장할 때 조용히 사라지거나 400 이 된다.
        if kid not in by_id or kid in seen:
            continue
        seen.add(kid)
        if kid in linked:
            continue                      # 이미 걸려 있다 — 제안할 것이 없다
        k = by_id[kid]
        items.append({
            'kpiDefinitionId': kid,
            'label': k.get('label') or '',
            'category': k.get('category') or '',
            'unit': k.get('unit') or '',
            'kind': k.get('kind') or 'metric',
            '근거': str((row.get('근거') or row.get('reason') or '')
                        if isinstance(row, dict) else '')[:200],
        })

    # 근거 없는 추천은 **판단할 수가 없다.** 버리지는 않되 화면이 눈에 띄게 표시하도록 알린다.
    blank = [it['label'] for it in items if not it['근거']]
    if blank:
        notes.append(f"근거를 적지 않은 추천이 있습니다: {' · '.join(blank)} — "
                     '근거 없이 연결하면 매트릭스가 사실과 달라집니다.')
    return {'items': items, 'notes': notes, 'model': res.model}


__all__ = ['fill_project_form', 'extract_action_items', 'extract_people',
           'suggest_kpi_links', 'fillable_specs',
           'MARK_FILL', 'MARK_ACTIONS', 'MARK_PEOPLE', 'MARK_KPI']
