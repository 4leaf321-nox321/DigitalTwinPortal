"""못 맞춘 KPI 이름을 **LLM 에게 물어본다.** 고르기만 시킨다.

왜 LLM 인가
    글자 맞추기(`importer._match_kpi`)로 푸는 데는 한계가 있다. 주간보고의 이름은
    해마다 사람이 다시 쓰기 때문에 「가상검증 적용률」 · 「Virtual Verification 비율」
    처럼 **같은 뜻인데 글자가 겹치지 않는** 것이 남는다. 이건 뜻을 아는 쪽이 유리하다.

무엇을 지키나 — 이 셋이 이 파일의 전부다
    ① **고르기만 시킨다.** 답은 반드시 우리가 준 KPI 목록 안에 있어야 한다.
       목록에 없는 이름이 돌아오면 **버린다.** 지어낸 KPI 가 화면에 뜨면 안 된다.
    ② **숫자를 만지지 않는다.** 값·분수·기준일은 근처에도 안 간다.
       (`importer` 의 규칙과 같다 — LLM 은 이름과 위치만 다룬다)
    ③ **자동으로 반영하지 않는다.** 여기서 나온 것은 *제안*이다. 사람이 미리보기에서
       확인하고 고른 뒤에야 별칭으로 남는다. 조용히 남의 지표에 값이 꽂히는 것이
       이 기능에서 제일 무서운 실패다.

⚠️ **AI 가 없어도 화면은 그대로 돌아가야 한다.** 운영 LLM 이 막혀 있을 수 있어서
   (403 policy denied), 실패는 예외가 아니라 `{ok: False, reason}` 으로 돌려준다.
   반입 자체는 AI 없이도 끝까지 된다 — 사람이 직접 고르면 되기 때문이다.
"""
from __future__ import annotations

import json
import re

from app.modules.digital_twin_dashboard.ai import llm
from app.modules.dx_kpi_management.importer import _norm

# 한 번에 물어볼 이름 수. 많으면 답이 길어져 잘린다(`LLM_MAX_TOKENS`).
MAX_ASK = 30

# ⚠️ **이 표식을 바꾸면 `scripts/llm_stub.py` 도 같이 바꿀 것.**
#    개발서버에는 LLM 이 없어서 스텁이 이 표식을 보고 그럴듯한 JSON 을 돌려준다.
#    (`form_assist.MARK_*` 와 같은 방식이다)
MARK_NAME_MATCH = '### dxkpi-import: name-match'

_SYSTEM = (
    MARK_NAME_MATCH + '\n'
    '너는 사내 DX KPI 담당자다. 주간보고 표에서 읽은 지표 이름을, '
    '등록된 KPI 목록 중 **같은 것을 가리키는 하나**에 짝지어라.\n'
    '규칙:\n'
    '1. 반드시 주어진 KPI 목록에 **그대로 있는 이름**만 쓴다. 새 이름을 만들지 않는다.\n'
    '2. 확신이 없으면 null 로 둔다. 억지로 짝짓지 마라 — '
    '틀리게 짝지으면 남의 지표에 숫자가 들어간다.\n'
    '3. 숫자·날짜·값은 다루지 않는다. 이름만 본다.\n'
    '4. JSON 만 출력한다. 설명·머리말·코드펜스를 붙이지 마라.\n'
    '출력 형식: {"matches":[{"name":"읽은 이름","kpi":"목록의 이름 또는 null",'
    '"confidence":"high|medium|low","why":"한 문장"}]}'
)


def _extract_json(text):
    """모델이 코드펜스나 군말을 붙여도 JSON 만 건져낸다."""
    raw = str(text or '').strip()
    raw = re.sub(r'^```(?:json)?\s*|\s*```$', '', raw, flags=re.I | re.M).strip()
    try:
        return json.loads(raw)
    except (ValueError, TypeError):
        pass
    start, end = raw.find('{'), raw.rfind('}')
    if start != -1 and end > start:
        try:
            return json.loads(raw[start:end + 1])
        except (ValueError, TypeError):
            return None
    return None


def suggest(unknown_names, definitions, max_ask=MAX_ASK):
    """
    못 맞춘 이름들 → 제안 목록.

    unknown_names  ['가상검증 적용률', ...]
    definitions    [{label, category, unit}, ...]  — **고를 수 있는 답의 전부**

    돌려주는 것
        {ok, suggestions: [{name, kpi, confidence, why}], skipped, reason}

        ok=False 면 `reason` 이 사람에게 보여줄 한 문장이다. 화면은 그것만 띄우고
        평소대로 사람이 고르게 두면 된다.
    """
    names = [str(n).strip() for n in (unknown_names or []) if str(n).strip()]
    if not names:
        return {'ok': True, 'suggestions': [], 'skipped': 0, 'reason': ''}
    if not definitions:
        return {'ok': False, 'suggestions': [], 'skipped': 0,
                'reason': '등록된 KPI 가 없어 짝지을 대상이 없습니다.'}
    if not llm.is_configured():
        return {'ok': False, 'suggestions': [], 'skipped': 0,
                'reason': 'AI 가 설정되어 있지 않습니다. 이름은 직접 골라 주세요.'}

    asked, skipped = names[:max_ask], max(0, len(names) - max_ask)

    catalog = '\n'.join(
        f"- {d['label']}"
        + (f" (구분 {d.get('category')}" if d.get('category') else '')
        + (f", 단위 {d.get('unit')})" if d.get('unit') and d.get('category')
           else (f" (단위 {d.get('unit')})" if d.get('unit') else
                 (')' if d.get('category') else '')))
        for d in definitions)
    question = (
        f'등록된 KPI 목록:\n{catalog}\n\n'
        f'주간보고에서 읽었지만 짝을 못 찾은 이름들:\n'
        + '\n'.join(f'- {n}' for n in asked)
    )

    try:
        res = llm.chat(
            [{'role': 'system', 'content': _SYSTEM},
             {'role': 'user', 'content': question}],
            temperature=0,          # 이름 고르기다 — 매번 달라지면 안 된다
        )
    except llm.LLMError as exc:
        return {'ok': False, 'suggestions': [], 'skipped': 0, 'reason': str(exc)}

    data = _extract_json(res.content)
    if not isinstance(data, dict) or not isinstance(data.get('matches'), list):
        return {'ok': False, 'suggestions': [], 'skipped': 0,
                'reason': 'AI 답을 읽지 못했습니다. 이름은 직접 골라 주세요.'}

    # ── 검증 — 여기가 이 파일의 핵심이다 ────────────────────────────────
    # 모델이 목록에 없는 이름을 지어낼 수 있다. **우리 목록에 있는 것만** 통과시킨다.
    by_label = {d['label']: d for d in definitions}
    by_key = {_norm(d['label']): d['label'] for d in definitions}
    asked_keys = {_norm(n): n for n in asked}

    out, seen = [], set()
    for m in data['matches']:
        if not isinstance(m, dict):
            continue
        name = str(m.get('name') or '').strip()
        # 우리가 묻지 않은 이름에 대한 답은 버린다 (물어본 것만 받는다)
        real_name = asked_keys.get(_norm(name))
        if not real_name or real_name in seen:
            continue
        picked = m.get('kpi')
        if picked in (None, '', 'null'):
            continue
        label = str(picked).strip()
        if label not in by_label:
            # 글자가 살짝 다를 수 있다 — 정규화해서 한 번 더 본다. 그래도 없으면 버린다.
            label = by_key.get(_norm(label))
            if not label:
                continue
        conf = str(m.get('confidence') or '').strip().lower()
        seen.add(real_name)
        out.append({
            'name': real_name,
            'kpi': label,
            'confidence': conf if conf in ('high', 'medium', 'low') else 'low',
            'why': str(m.get('why') or '').strip()[:200],
        })

    return {'ok': True, 'suggestions': out, 'skipped': skipped, 'reason': ''}
