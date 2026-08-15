"""
문항이 가리키는 진단 축 — **서버가 아는 값만 쓴다.**

문항에 `link_key='organization:readiness'` 를 달아 두면 나중에 그 답이 전략
진단의 '조직 역량 · 준비도' 칸으로 간다(LINK_PLAN.md).

⚠️ 지금까지 이 값을 **손으로 타이핑**했다. 오타가 나면 조용히 안 붙고, 그
   사실은 진단을 만들 때가 되어서야 드러난다 — 그때는 응답이 다 들어와 있어
   문항이 잠겨서 못 고친다. 역할·프로세스를 목록에서만 고르게 한 것과 같은
   문제라 같은 방식으로 막는다(roles.py).

⚠️ **전략 모듈을 import 로 매달지 않는다.** 못 읽으면 빈 목록을 주고 연결
   기능만 조용히 빠진다. 설문은 전략 없이도 돌아야 한다 — 이 모듈을 독립시킨
   이유가 그것이다.
"""

# 문항의 link_type. 지금은 이 한 종류뿐이다.
STRATEGY_DIMENSION = 'strategy_dimension'

# 연결키의 앞자리. 'organization:readiness' 의 'organization'.
_ORGANIZATION = 'organization'


def link_key_options():
    """고를 수 있는 연결키. [{key, label, question}, ...]

    전략 모듈의 조직 역량 축을 그대로 쓴다. 설문이 자기 목록을 따로 들면
    전략에서 축을 바꿔도 안 따라가고, 그 순간 두 목록이 갈린다.
    """
    try:
        from app.modules.digital_twin_strategy.definitions import (
            ORGANIZATION_DIMENSIONS,
        )
    except Exception:
        return []

    out = []
    for dim in ORGANIZATION_DIMENSIONS:
        key = (dim.get('key') or '').strip()
        if not key:
            continue
        out.append({
            'key': f'{_ORGANIZATION}:{key}',
            'label': f"조직 역량 · {dim.get('label') or key}",
            # 무엇을 묻는 축인지 같이 준다. 화면이 이것을 툴팁으로 띄우면
            # 사무국이 문항과 축을 맞춰 볼 수 있다.
            'question': dim.get('question') or '',
        })
    return out


def allowed_link_keys():
    """검증용 키 집합. **비어 있으면 검증하지 않는다.**

    전략 모듈을 못 읽는 상황(모듈이 빠졌거나 순환 import)에서 전부 거절하면,
    멀쩡한 표가 통째로 막힌다. 모르면 막지 않는 편이 낫다 — 연결이 안 붙는
    것은 나중에 고칠 수 있지만, 설문을 못 만드는 것은 그 자리에서 막힌다.
    """
    return {opt['key'] for opt in link_key_options()}


def link_type_for(link_key):
    """이 연결키가 어떤 종류인가. 모르면 None.

    ⚠️ **종류는 키에서 나온다.** 예전에는 화면이 표 전체를 보고 정했다 —
       연결키 10개 중 하나가 이상하면 10개 **전부** 연결이 NULL 로 저장되고
       화면은 아무 말도 안 했다. 판단은 키 하나마다 따로 한다.
    """
    if not link_key:
        return None
    return STRATEGY_DIMENSION if link_key in allowed_link_keys() else None
