"""에이전트 도구 — 스키마와 실행. **판단은 한 줄도 없다.**

🚦 **여기는 '도구' 다. '필드' 가 아니다.**
    한 층 위 `../ai_tools.py` 와 이름이 비슷한데 **다른 물건이다** —
      · `ai_tools.py`            **무엇을 고칠 수 있나** (필드·위험도·선택지)
      · `agent_tools.py`(이 파일) **LLM 이 부를 함수** (도구 스키마·실행)
    필드가 늘었으면 저쪽은 `field_maps`·`permissions` 에서 자동으로 따라온다 — 여기 손댈 일이 아니다.
    전체 지도: 루트 `디지털트윈_AI기능_지도.md`

왜 REST 로 부르나 (직접 함수를 부르지 않는 이유)
    도구가 지켜야 할 규칙 — 권한(`can_edit_project`) · 위험도 분기(저위험 즉시 /
    핵심 202) · AI 금지 필드 403 · 낙관적 락 409 · `dt2_project_changes` 기록 —
    은 전부 `routes_v2.patch_project` 안에 있다. 여기서 그 흐름을 다시 쓰면
    **같은 규칙이 세 곳**(화면·MCP·에이전트)이 되고, 셋은 반드시 갈린다.

    그래서 **MCP 서버와 똑같이 한다** — 자기 REST API 를 호출자의 토큰으로 부른다.
    코드 경로가 하나뿐이라 "MCP 로는 막히는데 에이전트로는 통과" 같은 구멍이 안 생긴다.

    ⚠️ 대가: 요청 하나가 **스레드 두 개**를 쓴다(바깥 요청 + 자기 호출). 동시에 도는
       에이전트가 많으면 waitress 스레드가 마른다. 그래서 `_MAX_TOOL_CALLS_TOTAL` 로
       한 대화의 도구 실행을 묶고, 운영에서는 `WAITRESS_THREADS` 를 넉넉히 준다.
       (에이전트는 관리자 전용이라 동시 사용자가 적다는 전제도 깔려 있다.)

도구 이름은 **MCP 서버(`mcp_server/server.py`)와 같아야 한다.** 같은 일을 하는데 이름이
다르면 스킬 문서·운영 안내가 둘로 갈린다. `dt3_test_agent.py` 가 일치를 강제한다.
"""
from __future__ import annotations

import requests                 # httpx 가 아니다 — 이 venv 에는 없다(llm.py 머리말 참고)
from flask import current_app

# 한 번에 너무 많이 긁어오지 않게 하는 상한. 목록이 길면 토큰만 먹고 판단은 안 좋아진다.
_LIST_LIMIT_MAX = 50
_HTTP_TIMEOUT = 30.0


def _fn(name: str, description: str, properties: dict, required: list = None) -> dict:
    """OpenAI function-calling 스키마 한 건."""
    return {
        'type': 'function',
        'function': {
            'name': name,
            'description': description,
            'parameters': {
                'type': 'object',
                'properties': properties,
                'required': required or [],
            },
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# 실행 — 전부 REST 로 넘긴다
# ─────────────────────────────────────────────────────────────────────────────

def _request(auth: str, method: str, path: str, *, params=None, json_body=None) -> dict:
    """`/api/dt-v2` 로 자기 자신을 부른다. 호출자의 인증을 **그대로** 넘긴다.

    응답을 봉투째 벗기지 않고 **상태코드까지 실어서** 돌려준다 —
    202(확인 필요)와 409(남이 먼저 고침)는 오류가 아니라 **결과**라, 모델이 그 차이를
    알아야 사용자에게 제대로 전한다. MCP 서버 `_unwrap()` 과 같은 판단이다.
    """
    base = current_app.config.get('LLM_AGENT_API_BASE') or 'http://127.0.0.1:5174'
    try:
        r = requests.request(
            method, f'{base}/api/dt-v2{path}',
            headers={'Authorization': auth} if auth else {},
            params=params, json=json_body, timeout=_HTTP_TIMEOUT,
        )
    except requests.RequestException as exc:
        # 도구가 못 돌았다고 대화를 죽이지 않는다 — 모델이 읽고 다른 방법을 찾게 한다.
        return {'error': f'도구 호출이 실패했습니다: {exc}'}

    try:
        body = r.json()
    except ValueError:
        body = {}

    if r.status_code == 202:
        return {
            'status': 'needs_confirmation',
            'httpStatus': 202,
            'message': body.get('message') or '핵심 필드라 아직 반영되지 않았습니다.',
            'data': body.get('data'),
            'next': ('data.preview 의 before → after 를 사용자에게 그대로 보여주고, '
                     '동의를 받은 뒤 confirm_change(data.proposalId) 를 부르세요. '
                     '묻지 않고 바로 부르면 안 됩니다.'),
        }
    if r.status_code == 409:
        return {
            'status': 'conflict', 'httpStatus': 409,
            'message': body.get('message') or '다른 사용자가 먼저 수정했습니다.',
            'data': body.get('data'),
            'hint': 'get_project 로 최신 rowVersion 을 다시 받아 재시도하세요.',
        }
    if not r.ok:
        return {
            'status': 'error', 'httpStatus': r.status_code,
            'message': body.get('message') or (r.text or '')[:300],
            'errors': body.get('errors'),
        }
    data = body.get('data') if isinstance(body, dict) and 'data' in body else body
    return data if isinstance(data, dict) else {'result': data}


def _clamp_limit(args: dict, default: int = 20) -> int:
    try:
        v = int(args.get('limit') or default)
    except (TypeError, ValueError):
        v = default
    return max(1, min(v, _LIST_LIMIT_MAX))


def _describe_fields(auth, args):
    return _request(auth, 'GET', '/describe/fields')


# 목록·집계가 **같은 필터**를 쓴다. 따로 만들면 "목록 12건 / 집계 15건" 이 된다.
def _query_params(args):
    """조회 인자 → REST 질의. 빈 값은 안 싣는다(빈 문자열도 필터로 먹는다)."""
    p = {}
    for k in ('q', 'status', 'division', 'process'):
        if args.get(k):
            p[k] = args[k]
    if args.get('year'):
        p['year'] = args['year']
    for k in ('progress_min', 'progress_max'):
        if args.get(k) is not None:
            p[k] = args[k]
    for k in ('is_key', 'kpi_linked'):
        if isinstance(args.get(k), bool):
            p[k] = 'true' if args[k] else 'false'
    if args.get('mine_only'):
        p['owner'] = 'me'
    if args.get('editable_only'):
        p['editable'] = 'true'
    return p


def _list_projects(auth, args):
    params = _query_params(args)
    params.update({'limit': _clamp_limit(args), 'offset': int(args.get('offset') or 0)})
    return _request(auth, 'GET', '/projects', params=params)


def _aggregate_projects(auth, args):
    params = _query_params(args)
    if args.get('group_by'):
        params['group_by'] = args['group_by']
    return _request(auth, 'GET', '/projects/aggregate', params=params)


def _describe_data(auth, args):
    return _request(auth, 'GET', '/ai/data-map')


def _get_project(auth, args):
    if not args.get('uuid'):
        return {'error': 'uuid 가 필요합니다. list_projects 로 먼저 과제를 찾으세요.'}
    return _request(auth, 'GET', f"/projects/{args['uuid']}")


def _get_project_changes(auth, args):
    if not args.get('uuid'):
        return {'error': 'uuid 가 필요합니다.'}
    return _request(auth, 'GET', f"/projects/{args['uuid']}/changes",
                    params={'limit': _clamp_limit(args)})


def _get_project_history(auth, args):
    if not args.get('uuid'):
        return {'error': 'uuid 가 필요합니다.'}
    return _request(auth, 'GET', f"/projects/{args['uuid']}/history",
                    params={'limit': _clamp_limit(args)})


def _list_proposals(auth, args):
    return _request(auth, 'GET', '/proposals',
                    params={'status': args.get('status') or 'pending',
                            'limit': _clamp_limit(args)})


def _patch_project(auth, args):
    if not args.get('uuid'):
        return {'error': 'uuid 가 필요합니다.'}
    patch = args.get('patch')
    if not isinstance(patch, dict) or not patch:
        return {'error': 'patch 가 비어 있습니다. 바꿀 필드만 담아 보내세요.'}
    # actor_mode='ai' 를 **여기서 붙인다.** 이게 있어야 서버가 핵심 필드를 확인 대기로
    # 돌린다. 모델이 정하게 두면 빼고 부를 수 있다(그래도 권한은 그대로 걸린다).
    body = {'patch': patch, 'actor_mode': 'ai', 'ignore_unknown': True}
    if args.get('reason'):
        body['reason'] = args['reason']
    if args.get('expected_version'):
        body['expected_version'] = args['expected_version']
    return _request(auth, 'PATCH', f"/projects/{args['uuid']}", json_body=body)


def _create_project(auth, args):
    fields = args.get('fields')
    if not isinstance(fields, dict) or not fields:
        return {'error': 'fields 가 비어 있습니다. 최소한 과제명은 있어야 합니다.'}
    # actor_mode='ai' 를 여기서 붙인다 — 변경 이력의 source 가 'ai' 로 남아야
    # 나중에 AI 가 만든 과제를 골라낼 수 있다.
    body = {'fields': fields, 'actor_mode': 'ai', 'ignore_unknown': True}
    if args.get('reason'):
        body['reason'] = args['reason']
    return _request(auth, 'POST', '/projects', json_body=body)


def _find_people(auth, args):
    q = (args.get('q') or '').strip()
    if not q:
        return {'error': 'q 가 필요합니다. 찾을 이름이나 knoxId 앞부분을 주세요.'}
    return _request(auth, 'GET', '/people/search', params={'q': q})


# ─────────────────────────────────────────────────────────────────────────────
# 성과 — 과제와 기준이 하나 다르다
#
# 성과는 여러 과제가 **공유한다.** 그래서 다른 과제의 숫자까지 바꾸는 필드는
# 확인 대기(202)로도 안 보내고 **403** 으로 막는다(과제는 202 로 간다).
# 연결만 202 로 가되 preview 에 그 성과를 함께 쓰는 다른 과제를 실어 보낸다.
# 삭제·복구 도구는 두지 않았다 — MCP 서버와 같은 판단이다.
# ─────────────────────────────────────────────────────────────────────────────

def _describe_performance_fields(auth, args):
    return _request(auth, 'GET', '/describe/performance-fields')


def _list_performances(auth, args):
    params = {'limit': _clamp_limit(args), 'offset': int(args.get('offset') or 0)}
    if args.get('q'):
        params['q'] = args['q']
    if args.get('year'):
        params['year'] = args['year']
    if args.get('category'):
        params['category'] = args['category']
    return _request(auth, 'GET', '/performances', params=params)


def _get_performance(auth, args):
    if not args.get('uuid'):
        return {'error': 'uuid 가 필요합니다. list_performances 로 먼저 성과를 찾으세요.'}
    return _request(auth, 'GET', f"/performances/{args['uuid']}")


def _list_project_performances(auth, args):
    if not args.get('uuid'):
        return {'error': 'uuid 가 필요합니다.'}
    return _request(auth, 'GET', f"/projects/{args['uuid']}/performances")


def _create_performance(auth, args):
    fields = args.get('fields')
    if not isinstance(fields, dict) or not fields:
        return {'error': 'fields 가 비어 있습니다. 최소한 성과항목은 있어야 합니다.'}
    body = {'fields': fields, 'actor_mode': 'ai', 'ignore_unknown': True}
    if args.get('reason'):
        body['reason'] = args['reason']
    return _request(auth, 'POST', '/performances', json_body=body)


def _patch_performance(auth, args):
    if not args.get('uuid'):
        return {'error': 'uuid 가 필요합니다.'}
    patch = args.get('patch')
    if not isinstance(patch, dict) or not patch:
        return {'error': 'patch 가 비어 있습니다. 바꿀 필드만 담아 보내세요.'}
    body = {'patch': patch, 'actor_mode': 'ai', 'ignore_unknown': True}
    if args.get('reason'):
        body['reason'] = args['reason']
    if args.get('expected_version'):
        body['expected_version'] = args['expected_version']
    return _request(auth, 'PATCH', f"/performances/{args['uuid']}", json_body=body)


def _link_performances(auth, args):
    if not args.get('project_uuid'):
        return {'error': 'project_uuid 가 필요합니다.'}
    items = args.get('items')
    if not isinstance(items, list):
        # 빈 목록은 '전부 떼기' 라는 뜻이라 허용한다. 목록이 아닌 것만 막는다.
        return {'error': 'items 는 배열이어야 합니다. '
                         'list_project_performances 로 지금 연결을 먼저 읽으세요 — '
                         '통째 교체라 빠뜨린 연결은 지워집니다.'}
    body = {'items': items, 'actor_mode': 'ai'}
    if args.get('reason'):
        body['reason'] = args['reason']
    if args.get('expected_version'):
        body['expected_version'] = args['expected_version']
    return _request(auth, 'PUT', f"/projects/{args['project_uuid']}/performances",
                    json_body=body)


def _confirm_change(auth, args):
    pid = args.get('proposal_id')
    if not pid:
        return {'error': 'proposal_id 가 필요합니다.'}
    return _request(auth, 'POST', f'/proposals/{pid}/approve',
                    json_body={'note': args['note']} if args.get('note') else {})


def _cancel_change(auth, args):
    pid = args.get('proposal_id')
    if not pid:
        return {'error': 'proposal_id 가 필요합니다.'}
    return _request(auth, 'POST', f'/proposals/{pid}/reject',
                    json_body={'note': args['note']} if args.get('note') else {})


# ─────────────────────────────────────────────────────────────────────────────
# 목록 — 설명은 MCP 도구 docstring 과 같은 말을 한다
# ─────────────────────────────────────────────────────────────────────────────

_UUID = {'type': 'string', 'description': '과제 uuid. 과제코드(MX-12)가 아니다 — '
                                          'list_projects 가 준 uuid 를 쓴다.'}

_PERF_UUID = {'type': 'string', 'description': '성과 uuid. 성과코드가 아니다 — '
                                               'list_performances 가 준 uuid 를 쓴다.'}

# ─────────────────────────────────────────────────────────────────────────────
# 분석·관계도·KPI·선행과제·추이 (2026-08-12) — MCP 서버와 **같은 도구**
#
# 계산은 전부 서버(`ai/graph_agent.py`)에 있다. 여기서 숫자를 만들지 않는다.
# ─────────────────────────────────────────────────────────────────────────────

_ANALYSIS_PATHS = {
    'gaps': '/graph/agent/gaps',
    'risky': '/graph/agent/risky',
    'stalled': '/graph/agent/stalled',
    'schedule': '/graph/agent/schedule',
    'issues': '/graph/agent/issues',
    'hidden': '/graph/agent/hidden',
    'key_projects': '/graph/agent/key-projects',
    'divisions': '/graph/agent/divisions',
    'readiness': '/graph/agent/readiness',
}

_TREND_PATHS = {
    'projects': '/trend/projects',
    'performances': '/trend/performances',
    'notes': '/trend/notes',
    'changes': '/trend/changes',
}


def _scope_params(args):
    """분석·추이가 공통으로 쓰는 범위 인자. 빈 값은 안 싣는다."""
    p = {}
    for k in ('years', 'divisions', 'date'):
        v = args.get(k)
        if v not in (None, ''):
            p[k] = str(v)
    return p


def _analyze(auth, args):
    kind = str(args.get('kind') or '').strip()
    if kind == 'kpi':
        kid = args.get('kpi_id')
        if not kid:
            return {'error': "kind='kpi' 에는 kpi_id 가 필요합니다."}
        path = f'/graph/agent/kpi/{int(kid)}'
    else:
        path = _ANALYSIS_PATHS.get(kind)
        if path is None:
            return {'error': f'모르는 분석입니다: {kind}',
                    'available': sorted(list(_ANALYSIS_PATHS) + ['kpi'])}
    params = _scope_params(args)
    if args.get('limit'):
        params['limit'] = int(args['limit'])
    return _request(auth, 'GET', path, params=params or None)


def _get_graph(auth, args):
    params = _scope_params(args)
    if args.get('layers'):
        params['layers'] = str(args['layers'])
    if args.get('include_deleted'):
        params['includeDeleted'] = '1'
    return _request(auth, 'GET', '/graph', params=params or None)


def _get_graph_options(auth, args):
    return _request(auth, 'GET', '/graph/options',
                    params=_scope_params(args) or None)


def _get_trend(auth, args):
    path = _TREND_PATHS.get(str(args.get('kind') or '').strip())
    if path is None:
        return {'error': f"모르는 추이입니다: {args.get('kind')}",
                'available': sorted(_TREND_PATHS)}
    return _request(auth, 'GET', path, params=_scope_params(args) or None)


def _get_project_kpi_links(auth, args):
    if not args.get('uuid'):
        return {'error': 'uuid 가 필요합니다.'}
    return _request(auth, 'GET', f"/projects/{args['uuid']}/kpi-links")


def _get_kpi_matrix(auth, args):
    year = args.get('year')
    return _request(auth, 'GET', '/kpi-matrix',
                    params={'year': int(year)} if year else None)


def _get_project_dependencies(auth, args):
    if not args.get('uuid'):
        return {'error': 'uuid 가 필요합니다.'}
    return _request(auth, 'GET', f"/projects/{args['uuid']}/dependencies")


def _set_project_kpi_links(auth, args):
    """KPI 연결 제안. **항상 202** 로 가고 사람이 승인해야 반영된다."""
    if not args.get('project_uuid'):
        return {'error': 'project_uuid 가 필요합니다.'}
    items = args.get('items')
    if not isinstance(items, list):
        return {'error': 'items 는 배열이어야 합니다.'}
    reason = str(args.get('reason') or '').strip()
    if not reason:
        return {'error': 'reason(왜 이 지표인지)이 필요합니다. '
                         '근거 없이는 승인자가 판단할 수 없습니다.'}
    body = {'items': items, 'actor_mode': 'ai', 'reason': reason}
    if args.get('expected_version'):
        body['expected_version'] = int(args['expected_version'])
    return _request(auth, 'PUT', f"/projects/{args['project_uuid']}/kpi-links",
                    json_body=body)


_CATALOG = {
    'describe_fields': (
        _fn('describe_fields',
            '과제에서 **무엇을 고칠 수 있는지**와 각 필드의 위험도·선택지를 돌려준다. '
            '과제를 수정하기 전에 반드시 먼저 부른다. 여기 나온 key 만 쓸 것 — '
            '이름을 지어내면 서버가 조용히 무시(ignored)한다.',
            {}),
        _describe_fields),
    'list_projects': (
        _fn('list_projects',
            '과제를 찾는다. 사용자가 말한 과제코드(MX-12)·과제명으로 q 검색해 uuid 를 얻는다. '
            '수정하려는 과제를 찾을 때는 editable_only 를 켜면 권한 없는 과제를 붙잡고 헤매지 않는다.',
            {'q': {'type': 'string', 'description': '과제명·과제코드 부분일치.'},
             'status': {'type': 'string', 'description': '진행상태(describe_fields 의 선택지).'},
             'year': {'type': 'integer', 'description': '과제년도.'},
             'division': {'type': 'string', 'description': '사업부명(describe_data 의 divisions).'},
             'process': {'type': 'string', 'description': '프로세스(describe_data 의 processes).'},
             'is_key': {'type': 'boolean', 'description': '중점과제만/중점 아닌 것만.'},
             'progress_min': {'type': 'integer', 'description': '진행률 하한(0~100).'},
             'progress_max': {'type': 'integer', 'description': '진행률 상한(0~100).'},
             'kpi_linked': {'type': 'boolean', 'description': 'DX KPI 연결 여부. false 면 미연결 과제만.'},
             'mine_only': {'type': 'boolean', 'description': '내가 소유자인 것만.'},
             'editable_only': {'type': 'boolean', 'description': '내가 고칠 수 있는 것만.'},
             'limit': {'type': 'integer', 'description': f'최대 {_LIST_LIMIT_MAX}.'},
             'offset': {'type': 'integer'}}),
        _list_projects),
    'aggregate_projects': (
        _fn('aggregate_projects',
            '과제를 **세어서** 돌려준다. "몇 건" · "사업부별로" · "평균 진행률" 같은 '
            '질문은 목록을 받아 직접 세지 말고 **반드시 이걸 쓴다** — 목록은 상한에 '
            '잘리는데 잘린 줄 모르고 세면 틀린 수를 답하게 된다. '
            '필터는 list_projects 와 완전히 같다.',
            {'group_by': {'type': 'string',
                          'enum': ['division', 'process', 'status', 'year', 'category'],
                          'description': '나눌 축. 없으면 전체 합계만.'},
             'q': {'type': 'string'},
             'status': {'type': 'string'},
             'division': {'type': 'string'},
             'process': {'type': 'string'},
             'year': {'type': 'integer'},
             'is_key': {'type': 'boolean'},
             'progress_min': {'type': 'integer'},
             'progress_max': {'type': 'integer'},
             'kpi_linked': {'type': 'boolean'},
             'mine_only': {'type': 'boolean'},
             'editable_only': {'type': 'boolean'}}),
        _aggregate_projects),
    'describe_data': (
        _fn('describe_data',
            '조회에 쓸 수 있는 **값 목록** — 사업부·프로세스·진행상태·과제구분·연도·'
            'DX KPI. 사업부나 상태 이름이 확실치 않으면 **먼저 이걸 부른다.** '
            '여기 없는 값을 필터에 넣으면 조용히 0건이 나온다. '
            '(고칠 수 있는 필드는 describe_fields 쪽이다 — 다른 도구다)',
            {}),
        _describe_data),
    'get_project': (
        _fn('get_project',
            '과제 1건의 상세. 수정 전에 부르면 rowVersion 을 얻고, 그 값을 '
            'patch_project 의 expected_version 에 넣으면 남이 먼저 고쳤을 때 409 로 막힌다. '
            'canEdit 이 false 면 이 사용자는 그 과제를 고칠 수 없다.',
            {'uuid': _UUID}, ['uuid']),
        _get_project),
    'get_project_changes': (
        _fn('get_project_changes',
            '누가·언제·무엇을 어떤 값에서 어떤 값으로 바꿨나(필드 단위). '
            '같은 rowVersion 은 한 번의 저장이다. 2026-07-31 이후 변경만 기록돼 있다.',
            {'uuid': _UUID, 'limit': {'type': 'integer'}}, ['uuid']),
        _get_project_changes),
    'get_project_history': (
        _fn('get_project_history',
            '진척 지표가 어떻게 변해 왔나(그 시점의 진행률·상태·액션아이템·이슈). '
            '화면의 진척률은 매번 다시 계산돼 소급 변경되지만 이 값은 그때 기록된 것이라 '
            '안 바뀐다 — 진척률이 떨어진 게 일을 못 해서인지 일이 늘어서인지 가릴 때 쓴다'
            '(actionTotal 이 늘었는지 본다). 2026-07-29 이전은 없다.',
            {'uuid': _UUID, 'limit': {'type': 'integer'}}, ['uuid']),
        _get_project_history),
    'list_proposals': (
        _fn('list_proposals',
            '확인 대기 중인 변경 목록. 핵심 필드를 고치려 하면 여기 쌓인다. '
            '내가 승인할 수 있는 것만 보인다.',
            {'status': {'type': 'string',
                        'description': 'pending(기본) · approved · rejected · stale · all'},
             'limit': {'type': 'integer'}}),
        _list_proposals),
    'find_people': (
        _fn('find_people',
            '이름(또는 knoxId 앞부분)으로 사람을 찾아 **knoxId 를 확인한다.** 읽기 전용. '
            '과제참여인력목록·과제PL_knoxId 를 넣기 **전에** 반드시 부른다 — 이 두 필드는 '
            'knoxId 가 없으면 서버가 400 으로 거절한다. '
            '결과에 동명이인: true 가 있으면 마음대로 고르지 말고 이름·부서를 보여주며 '
            '사용자에게 누구인지 물어본다. 여기 넣은 사람은 그 과제를 고칠 수 있게 되므로 '
            '잘못 고르면 엉뚱한 사람에게 편집 권한이 간다. '
            '검색 결과가 없으면 아직 가입하지 않은 사람일 수 있다 — knoxId(사내 이메일 '
            '@앞부분)를 사용자에게 물어서 넣는다. 지어내지 말 것.',
            {'q': {'type': 'string', 'description': '이름 일부 또는 knoxId 앞부분.'}},
            ['q']),
        _find_people),
    'patch_project': (
        _fn('patch_project',
            '과제 1건을 수정한다. **바뀐 필드만** 담는다. '
            '저위험 필드는 바로 반영되고, 핵심 필드는 즉시 반영되지 않고 202(needs_confirmation)로 '
            '돌아온다 — 그때는 preview 의 before → after 를 사용자에게 보여주고 동의를 받은 뒤 '
            'confirm_change 를 부른다. 응답의 ignored 에 키가 있으면 그 키는 저장되지 않은 것이니 '
            '반드시 사용자에게 알린다. '
            '응답에 alsoPending 이 있으면 저위험 필드도 함께 대기 중이라는 뜻이다 — '
            'applied 가 비어 있으므로 "그건 반영됐다" 고 말하면 거짓이 된다. '
            '응답에 peoplePreview 가 있으면 그 표(이름·knoxId·부서·연결)까지 같이 보여준다.',
            {'uuid': _UUID,
             'patch': {'type': 'object',
                       'description': '{"과제상세설명": "..."} 처럼 describe_fields 의 key 로. '
                                      '액션아이템·이슈 같은 배열은 통째로 교체되므로 '
                                      'get_project 로 현재 값을 받아 전체를 보낸다. '
                                      '⚠️ 진행률은 액션아이템에서 자동 계산된다 — '
                                      '액션아이템이 있는 과제에 직접 보내면 400 이다. '
                                      '액션아이템목록의 완료 표시를 바꾼다.'},
             'reason': {'type': 'string',
                        'description': '왜 고치는지. 변경 이력에 남아 사람이 판단 근거를 본다. 반드시 적을 것.'},
             'expected_version': {'type': 'integer',
                                  'description': 'get_project 의 rowVersion.'}},
            ['uuid', 'patch', 'reason']),
        _patch_project),
    'create_project': (
        _fn('create_project',
            '**새 과제를 만든다**(있는 과제 수정이 아니다). '
            '부르기 전에 describe_fields 로 필드와 선택지를 확인하고, '
            '**만들 내용을 사용자에게 보여주고 동의를 받는다** — 수정과 달리 확인 대기가 '
            '없어서 부르는 즉시 만들어진다. 여러 건이면 한 건씩 만들고 결과를 보고한다. '
            '과제참여인력목록·과제PL_knoxId 는 여기서 바로 넣을 수 있지만 **knoxId 가 '
            '없으면 400** 이다 — find_people 로 먼저 확정한다. 생성은 확인 대기가 없어 '
            '**즉시 편집 권한이 생기므로** 짐작으로 고르지 말 것. '
            '담당자·과제참여인력(레거시 문자열)은 여기서도 못 넣는다(403). '
            '과제코드가 겹치면 409 로 거절된다. '
            '응답의 ignored 에 키가 있으면 그 값은 저장되지 않은 것이니 알린다.',
            {'fields': {'type': 'object',
                        'description': '{"과제명": "...", "사업부": "MX"} — describe_fields 의 key. '
                                       '과제명은 필수. id 를 주면 그 값이 과제코드가 된다.'},
             'reason': {'type': 'string', 'description': '왜 만드는지. 변경 이력에 남는다.'}},
            ['fields', 'reason']),
        _create_project),
    # ── 성과 ────────────────────────────────────────────────────────────────
    'describe_performance_fields': (
        _fn('describe_performance_fields',
            '성과에서 **무엇을 고칠 수 있는지**와 각 필드의 위험도·선택지를 돌려준다. '
            '성과를 만들거나 고치기 전에 반드시 먼저 부른다. '
            '과제용 describe_fields 와 **표가 다르다** — 그걸 보고 성과를 고치려 들면 '
            '없는 필드를 보내게 되고 서버는 ignored 로 조용히 넘긴다. '
            'risk 값의 뜻이 과제와 다르다: core 는 **403 이고 확인 대기로도 안 간다** '
            '(이 성과를 쓰는 다른 과제의 숫자까지 바뀌기 때문). 단 생성할 때는 지정할 수 있다.',
            {}),
        _describe_performance_fields),
    'list_performances': (
        _fn('list_performances',
            '성과를 찾는다. 성과항목명으로 q 검색해 uuid 를 얻는다.',
            {'q': {'type': 'string', 'description': '성과항목명 부분일치.'},
             'year': {'type': 'integer', 'description': '성과년도.'},
             'category': {'type': 'string',
                          'description': '대분류(describe_performance_fields 의 선택지).'},
             'limit': {'type': 'integer', 'description': f'최대 {_LIST_LIMIT_MAX}.'},
             'offset': {'type': 'integer'}}),
        _list_performances),
    'get_performance': (
        _fn('get_performance',
            '성과 1건의 상세. rowVersion 을 얻어 patch_performance 의 expected_version 에 '
            '넣으면 남이 먼저 고쳤을 때 409 로 막힌다. '
            '**affectedProjects 를 꼭 본다** — 이 성과를 쓰는 과제 수다. 1보다 크면 '
            '이 성과를 고칠 때 그 과제들의 숫자도 함께 움직인다.',
            {'uuid': _PERF_UUID}, ['uuid']),
        _get_performance),
    'list_project_performances': (
        _fn('list_project_performances',
            '과제 1건에 연결된 성과 목록. '
            '**link_performances 를 부르기 전에 반드시 이걸 먼저 읽는다** — 연결은 통째 '
            '교체라, 여기서 읽은 기존 목록을 함께 보내지 않으면 그 연결이 지워진다.',
            {'uuid': _UUID}, ['uuid']),
        _list_project_performances),
    'create_performance': (
        _fn('create_performance',
            '**새 성과를 만든다**(있는 성과 수정이 아니다). 확인 대기가 없어 부르는 즉시 '
            '만들어지고, **만든 뒤에는 아래 세 가지를 못 고친다(403). 성과는 지울 수도 없다** — '
            '만들 내용을 먼저 사용자에게 보여주고 동의를 받을 것. '
            '(1) 성과항목 앞에 "[사업부] " 를 붙인다. 성과에는 사업부 컬럼이 없어서 화면이 '
            '이 접두어로 사업부를 가른다. 모르면 연결할 과제의 사업부를 따르고, 정말 모르면 '
            '[공통]. 모르는 접두어는 400, 안 붙이면 서버가 [공통] 을 붙이고 normalized 로 '
            '알려주므로 그 값을 그대로 전한다. '
            '(2) 대분류·소분류는 필수다. 짝이 안 맞으면 400 — optionsByCategory 에서 고른다. '
            '(3) 만들면 아직 어느 과제에도 안 붙어 있다. 붙이려면 link_performances 를 이어 부른다.',
            {'fields': {'type': 'object',
                        'description': '{"성과항목": "[MX] ...", "대분류": "...", '
                                       '"소분류": "...", "단위": "%", "목표수준": 10} — '
                                       'describe_performance_fields 의 key. 성과항목은 필수.'},
             'reason': {'type': 'string', 'description': '왜 만드는지.'}},
            ['fields', 'reason']),
        _create_performance),
    'patch_performance': (
        _fn('patch_performance',
            '성과 1건을 수정한다. **바뀐 필드만** 담는다. '
            '⚠️ 핵심 필드(성과항목·대분류·소분류·단위·목표수준·현재수준)는 **403** 이다 — '
            '과제와 달리 확인 대기로도 가지 않는다. 이 성과를 쓰는 다른 과제의 숫자까지 '
            '함께 바뀌기 때문이다. 403 을 받으면 confirm_change 를 찾지 말고 '
            '**화면에서 고쳐야 한다고 사용자에게 알린다.** '
            '고칠 수 있는 것은 실적수준·조치사항·성과평가·설명 같은 값이다.',
            {'uuid': _PERF_UUID,
             'patch': {'type': 'object',
                       'description': '{"실적수준": "12"} — describe_performance_fields 의 key.'},
             'reason': {'type': 'string', 'description': '왜 고치는지. 반드시 적을 것.'},
             'expected_version': {'type': 'integer',
                                  'description': 'get_performance 의 rowVersion.'}},
            ['uuid', 'patch', 'reason']),
        _patch_performance),
    'link_performances': (
        _fn('link_performances',
            '과제에 붙는 성과 연결을 **통째로 교체**한다. 순서가 곧 화면 표시 순서다. '
            '부르기 전에 **list_project_performances 로 지금 연결을 먼저 읽는다** — '
            '한 건만 더하려 해도 기존 연결을 전부 포함해서 보내야 하고, 빠뜨리면 지워진다. '
            '202(needs_confirmation)로 돌아온다. 그때 preview 와 함께 **affectedProjects**'
            '(이 성과를 함께 쓰는 다른 과제들)와 contributionWarnings(기여도 합이 100 이 '
            '아닌 성과)를 **반드시 같이 보여준다** — 자기 과제만 보여주고 승인받으면 '
            '남의 과제가 조용히 틀어진다. '
            '⚠️ actualLevel(실적수준)은 여기 넣지 않는다. 화면은 성과 본체에서만 읽어서 '
            '여기 넣으면 저장은 되는데 아무 데도 안 보인다 — patch_performance 를 쓴다.',
            {'project_uuid': _UUID,
             'items': {'type': 'array',
                       'description': '[{"performanceUuid": "...", "contribution": "50"}, ...] '
                                      '— 기존 연결을 포함한 **전체 목록**.',
                       'items': {'type': 'object'}},
             'reason': {'type': 'string', 'description': '왜 바꾸는지. 반드시 적을 것.'},
             'expected_version': {'type': 'integer',
                                  'description': 'get_project 의 rowVersion.'}},
            ['project_uuid', 'items', 'reason']),
        _link_performances),
    'confirm_change': (
        _fn('confirm_change',
            '확인 대기 중인 변경을 실제로 반영한다. '
            '**사용자에게 before → after 를 보여주고 명시적으로 동의를 받은 다음에만** 부른다. '
            '202 를 받자마자 이어 부르면 확인 단계가 통째로 사라진다.',
            {'proposal_id': {'type': 'integer'},
             'note': {'type': 'string', 'description': '사용자가 덧붙인 말(선택).'}},
            ['proposal_id']),
        _confirm_change),
    'cancel_change': (
        _fn('cancel_change',
            '확인 대기 중인 변경을 취소한다. 과제는 건드리지 않는다. '
            '사용자가 아니라고 하면 반드시 불러서 정리한다 — 그냥 두면 대기 목록에 남는다.',
            {'proposal_id': {'type': 'integer'},
             'note': {'type': 'string', 'description': '왜 취소하는지 짧게.'}},
            ['proposal_id']),
        _cancel_change),
    'analyze': (
        _fn('analyze',
            '과제 데이터를 분석한다(관계도 화면과 같은 계산). kind: '
            'gaps(데이터 공백 — 다른 분석의 신뢰도를 정한다, 먼저 볼 것) · '
            'risky(달성률 낮은 KPI) · stalled(멈춘 과제 — 유일하게 시간축을 연다) · '
            'schedule(일정 쏠림) · issues(이슈 적체) · hidden(숨은 연결) · '
            'key_projects(중점과제의 말과 실제) · divisions(사업부별 채움) · '
            'readiness(보고 준비도) · kpi(KPI 한 장 브리핑, kpi_id 필요). '
            '숫자를 다시 계산하지 말고 서버가 준 값을 그대로 쓴다. '
            '응답의 coverage·note(판단 못한 과제 수 등)를 먼저 말할 것.',
            {'kind': {'type': 'string', 'description': '분석 종류.'},
             'years': {'type': 'string', 'description': '"2026" 또는 "2026,2025".'},
             'divisions': {'type': 'string', 'description': '"MX,VD".'},
             'kpi_id': {'type': 'integer', 'description': "kind='kpi' 일 때 필수."},
             'limit': {'type': 'integer', 'description': 'risky 에서만.'}},
            ['kind']),
        _analyze),
    'get_graph': (
        _fn('get_graph',
            '관계도 원본(과제·성과·KPI·사업부·사람). 노드가 수백 개라 통째로 '
            '늘어놓지 말 것 — 대개 analyze 로 좁히는 편이 낫다.',
            {'years': {'type': 'string'}, 'divisions': {'type': 'string'},
             'layers': {'type': 'string', 'description': '"perf,kpi,dep" 또는 "all".'},
             'include_deleted': {'type': 'boolean'}}),
        _get_graph),
    'get_graph_options': (
        _fn('get_graph_options',
            '관계도에서 고를 수 있는 연도·사업부·레이어.',
            {'years': {'type': 'string'}, 'divisions': {'type': 'string'}}),
        _get_graph_options),
    'get_trend': (
        _fn('get_trend',
            '시계열. kind: projects(날짜별 사업부 과제 수) · performances(성과 카드 값) · '
            'changes(그날 들고난 과제, date 로 하루) · notes(사람이 붙인 메모). '
            '2026-07-29 이전 기간은 없다 — 지어내지 말고 없다고 답할 것.',
            {'kind': {'type': 'string'}, 'years': {'type': 'string'},
             'divisions': {'type': 'string'},
             'date': {'type': 'string', 'description': '"2026-08-11".'}},
            ['kind']),
        _get_trend),
    'get_project_kpi_links': (
        _fn('get_project_kpi_links',
            '과제의 DX KPI 연결(기여등급·기여방법). set_project_kpi_links 는 통째 '
            '교체라 **바꾸기 전에 반드시 이걸 먼저 읽는다** — 빠뜨린 연결은 지워진다.',
            {'uuid': {'type': 'string'}}, ['uuid']),
        _get_project_kpi_links),
    'get_kpi_matrix': (
        _fn('get_kpi_matrix',
            'KPI × 사업부 매트릭스의 원재료(집계 전). 어떤 지표가 있는지 볼 때.',
            {'year': {'type': 'integer'}}),
        _get_kpi_matrix),
    'set_project_kpi_links': (
        _fn('set_project_kpi_links',
            '과제의 DX KPI 연결을 통째 교체하자고 **제안**한다. 항상 202(확인 대기)로 '
            '가고 사람이 승인해야 반영된다. reason(왜 이 지표인지) 필수 — 근거 없이는 '
            '제안이 만들어지지 않는다. targetDivision 은 대개 보내지 않는다(사업부 '
            '과제는 서버가 자기 사업부로 고정). preview 의 지표 이름·대상 사업부·'
            '기여등급을 근거와 함께 보여주고 동의를 받은 뒤 confirm_change 를 부를 것.',
            {'project_uuid': {'type': 'string'},
             'items': {'type': 'array',
                       'description': '[{kpiDefinitionId, relationType?, note?}]',
                       'items': {'type': 'object'}},
             'reason': {'type': 'string', 'description': '왜 이 지표인지. 필수.'},
             'expected_version': {'type': 'integer'}},
            ['project_uuid', 'items', 'reason']),
        _set_project_kpi_links),
    'get_project_dependencies': (
        _fn('get_project_dependencies',
            '이 과제의 선행 과제 연결. **읽기만 된다** — 거는 것은 화면에서 해야 한다.',
            {'uuid': {'type': 'string'}}, ['uuid']),
        _get_project_dependencies),
}

TOOL_SCHEMAS = [schema for schema, _ in _CATALOG.values()]
TOOL_NAMES = sorted(_CATALOG)

# 읽기 전용 도구. '읽기만' 모드에서 이것만 넘긴다 — 처음 켤 때 쓰기를 닫아두고
# 관찰할 수 있어야 한다(스위치는 라우트에 있다).
READONLY_TOOL_NAMES = frozenset({
    'describe_fields', 'describe_data', 'list_projects', 'aggregate_projects',
    'get_project',
    'get_project_changes', 'get_project_history', 'list_proposals',
    # find_people 은 사람을 **찾기만** 한다(GET /people/search). 넣는 것은
    # patch_project·create_project 라 여기 둬도 쓰기가 열리지 않는다.
    'find_people',
    'describe_performance_fields', 'list_performances', 'get_performance',
    'list_project_performances',
    # 분석·관계도·추이·KPI 읽기 (2026-08-12). 전부 GET 이라 '읽기만' 모드에서도 안전하다.
    # ⚠️ `set_project_kpi_links` 는 **여기 없다** — 그건 제안을 만드는 쓰기다.
    'analyze', 'get_graph', 'get_graph_options', 'get_trend',
    'get_project_kpi_links', 'get_kpi_matrix', 'get_project_dependencies',
})


def schemas(*, readonly: bool = False) -> list:
    if not readonly:
        return TOOL_SCHEMAS
    return [s for name, (s, _) in _CATALOG.items() if name in READONLY_TOOL_NAMES]


def run_tool(auth: str, name: str, args: dict) -> dict:
    """이름으로 도구를 실행한다.

    모르는 이름은 **예외가 아니라 오류 내용**으로 돌려준다 — 모델이 이름을 지어내는 것은
    흔한 일이고, 그때 대화를 죽이는 대신 고쳐 부르게 하는 편이 낫다.
    """
    entry = _CATALOG.get(name)
    if not entry:
        return {'error': f'알 수 없는 도구입니다: {name}. '
                         f'쓸 수 있는 도구: {", ".join(TOOL_NAMES)}'}
    _, executor = entry
    return executor(auth, args or {})
