"""디지털 트윈 대시보드 MCP 서버 — 외부 AI(Claude Code · Gemini CLI …)가 과제를 조회·수정.

구조
    이 서버는 **얇은 프록시**다. 판단(권한·검증·제안 큐 분기)은 전부 백엔드에 있고
    여기선 REST 로 부르기만 한다. 도구를 늘릴 때도 로직을 여기 두지 않는다 —
    같은 규칙을 두 곳에 두면 갈린다.

인증 — **만능 토큰을 쓰지 않는다**
    사용자가 각자 자기 JWT 로 붙고, 이 서버는 그 `Authorization` 헤더를 백엔드로
    **그대로 넘긴다.** 그래서 과제별 편집 권한(`can_edit_project`)이 사람이 화면에서
    쓸 때와 **똑같이** 걸린다. 서비스 계정을 두면 그 계정이 전 과제를 고칠 수 있게 되고,
    `on_behalf_of` 대리는 admin·dt_office 만 쓸 수 있어 일반 사용자는 오히려 막힌다.

AI 쓰기의 안전장치 (백엔드가 이미 갖고 있다)
    `patch_project` 는 `actor_mode='ai'` 로 보낸다. 그러면 백엔드가 필드 위험도로 나눈다 —
    **저위험은 즉시 반영, 핵심 필드는 제안 큐(202)** 로 가서 사람이 승인해야 한다.
    그래서 AI 가 과제명·일정·진행상태를 함부로 바꿔도 바로 반영되지 않는다.

실행
    set DT_API_BASE=http://localhost:5174
    venv\\Scripts\\python.exe server.py        # streamable-http, 기본 127.0.0.1:3003/mcp

등록 (사용자별 토큰)
    claude mcp add --transport http digitaltwin http://<host>:3003/mcp \\
      --header "Authorization: Bearer <내 토큰>"
"""
import os

import httpx
from mcp.server.fastmcp import Context, FastMCP

# ⚠️ DT 백엔드는 **5174** 다(backend/.env 의 FLASK_PORT). 5173 은 Vite(프론트)이고
#    브라우저가 보는 `/api` 는 Vite 가 5174 로 프록시한 것이다. 여기선 직접 붙는다.
API_BASE = os.environ.get("DT_API_BASE", "http://localhost:5174").rstrip("/")
API_PREFIX = "/api/dt-v2"
# 기술정보 모듈은 블루프린트가 달라 접두사도 다르다.
INTEL_PREFIX = "/api/digital-twin-intel"

# 기본은 SSE(streamable-http). 중간에 SSE 를 버퍼링하는 프록시·VPN·보안장비가 끼면
# initialize 응답의 첫 바이트가 클라이언트에 닿지 못해 "무응답 → 타임아웃" 이 난다.
# 이 값이 1 이면 응답을 **단발 JSON**(Content-Length 완결)으로 돌려 그런 경로를 통과한다.
# 이 서버는 진행률·로그 스트리밍을 쓰지 않으므로 실질 손실이 없다.
_JSON_RESPONSE = os.environ.get("MCP_JSON_RESPONSE") == "1"

mcp = FastMCP("digitaltwin", json_response=_JSON_RESPONSE)


def _forward_headers(ctx: Context) -> dict:
    """들어온 MCP 요청의 인증 헤더를 백엔드로 그대로 넘긴다 — 그 사용자 권한으로 동작."""
    headers = {}
    req = getattr(getattr(ctx, "request_context", None), "request", None)
    if req is not None:
        v = req.headers.get("authorization")
        if v:
            headers["Authorization"] = v
    return headers


def _unwrap(r: httpx.Response):
    """
    `{success, data, message}` 봉투를 벗긴다.

    **오류를 조용히 삼키지 않는다.** 실패를 빈 결과로 돌려주면 AI 가 "없다" 로 오해하고
    엉뚱한 답을 만든다. 상태코드와 서버 메시지를 그대로 올려 AI 가 고쳐 재시도하게 한다.
    특히 **202(제안 큐로 감)와 409(남이 먼저 고침)는 오류가 아니라 결과**라 그대로 전한다.
    """
    try:
        body = r.json()
    except Exception:
        body = {}

    if r.status_code == 202:
        return {"status": "needs_confirmation", "httpStatus": 202,
                "message": body.get("message")
                or "핵심 필드라 아직 반영되지 않았습니다. 확인이 필요합니다.",
                "data": body.get("data"),
                "next": "data.preview 의 before → after 를 사용자에게 그대로 보여주고, "
                        "동의를 받은 뒤 confirm_change(data.proposalId) 를 부르세요. "
                        "묻지 않고 바로 부르면 안 됩니다."}
    if r.status_code == 409:
        return {"status": "conflict", "httpStatus": 409,
                "message": body.get("message") or "다른 사용자가 먼저 수정했습니다.",
                "data": body.get("data"),
                "hint": "get_project 로 최신 rowVersion 을 다시 받아 재시도하세요."}
    if not r.is_success:
        return {"status": "error", "httpStatus": r.status_code,
                "message": body.get("message") or r.text[:500],
                "errors": body.get("errors")}
    return body.get("data") if isinstance(body, dict) and "data" in body else body


async def _request(ctx, method, path, *, params=None, json_body=None,
                   prefix=API_PREFIX):
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.request(method, f"{API_BASE}{prefix}{path}",
                            headers=_forward_headers(ctx),
                            params=params, json=json_body)
    return _unwrap(r)


async def _intel(ctx, method, path, *, params=None, json_body=None):
    """기술정보 모듈로 보낸다. 인증 헤더는 똑같이 그대로 넘어간다."""
    return await _request(ctx, method, path, params=params, json_body=json_body,
                          prefix=INTEL_PREFIX)


# ─────────────────────────────────────────────────────────────────────────────
# 읽기
# ─────────────────────────────────────────────────────────────────────────────

@mcp.tool()
async def describe_fields(ctx: Context) -> dict:
    """과제에서 **무엇을 고칠 수 있는지**와 각 필드의 위험도·선택지를 돌려준다.

    **과제를 수정하기 전에 반드시 먼저 부른다.** 필드 이름을 지어내면 서버가 조용히
    무시(`ignored`)하므로, 여기 나온 `key` 만 쓴다.

    risk 값의 뜻:
      low         즉시 반영된다
      core        **제안 큐로 간다(202).** 사람이 승인해야 반영 — 사용자에게 알릴 것
      relation    이 PATCH 로 못 고친다. `via` 의 다른 API 를 써야 한다
      unsupported 쓰기 경로가 없다. 시도하지 말 것
      immutable   서버가 정한다
    """
    return await _request(ctx, "GET", "/describe/fields")


@mcp.tool()
async def list_projects(
    ctx: Context,
    q: str = "",
    status: str = "",
    division: str = "",
    process: str = "",
    year: int = 0,
    is_key: bool | None = None,
    progress_min: int | None = None,
    progress_max: int | None = None,
    kpi_linked: bool | None = None,
    mine_only: bool = False,
    editable_only: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    """과제 목록을 검색한다.

    q             과제명·과제코드 부분일치
    status        진행상태로 거르기 (describe_data 의 statuses)
    division      사업부명 (describe_data 의 divisions)
    process       프로세스 (describe_data 의 processes)
    year          과제년도
    is_key        중점과제만 / 중점 아닌 것만
    progress_min  진행률 하한(0~100)
    progress_max  진행률 상한(0~100)
    kpi_linked    DX KPI 연결 여부. False 면 **미연결 과제만**
    mine_only     내가 소유자인 것만
    editable_only 내가 고칠 수 있는 것만 — **수정하려는 과제를 찾을 때 이걸 켜면
                  권한 없는 과제를 붙잡고 헤매지 않는다**

    ⚠️ 응답의 `truncated` 가 true 면 **목록이 잘린 것**이다. 세지 말고
       `aggregate_projects` 로 다시 물어야 한다.
    """
    params = _query_params(q=q, status=status, division=division, process=process,
                           year=year, is_key=is_key, progress_min=progress_min,
                           progress_max=progress_max, kpi_linked=kpi_linked,
                           mine_only=mine_only, editable_only=editable_only)
    params.update({"limit": limit, "offset": offset})
    return await _request(ctx, "GET", "/projects", params=params)


def _query_params(**kw) -> dict:
    """조회 인자 → REST 질의. 빈 값은 안 싣는다(빈 문자열도 필터로 먹는다).
    에이전트 쪽 `agent_tools._query_params` 와 **같은 규칙**이어야 한다."""
    p: dict = {}
    for k in ("q", "status", "division", "process"):
        if kw.get(k):
            p[k] = kw[k]
    if kw.get("year"):
        p["year"] = kw["year"]
    for k in ("progress_min", "progress_max"):
        if kw.get(k) is not None:
            p[k] = kw[k]
    for k in ("is_key", "kpi_linked"):
        if isinstance(kw.get(k), bool):
            p[k] = "true" if kw[k] else "false"
    if kw.get("mine_only"):
        p["owner"] = "me"
    if kw.get("editable_only"):
        p["editable"] = "true"
    return p


@mcp.tool()
async def aggregate_projects(
    ctx: Context,
    group_by: str = "",
    q: str = "",
    status: str = "",
    division: str = "",
    process: str = "",
    year: int = 0,
    is_key: bool | None = None,
    progress_min: int | None = None,
    progress_max: int | None = None,
    kpi_linked: bool | None = None,
    mine_only: bool = False,
    editable_only: bool = False,
) -> dict:
    """과제를 **세어서** 돌려준다.

    "몇 건" · "사업부별로" · "평균 진행률" 같은 질문은 목록을 받아 직접 세지 말고
    **반드시 이걸 쓴다** — 목록은 상한에 잘리는데, 잘린 줄 모르고 세면 틀렸다는
    신호 없이 틀린 수를 답하게 된다. 세는 일은 DB 가 한다.

    group_by  division | process | status | year | category (없으면 전체 합계만)
    나머지    list_projects 와 완전히 같은 필터

    응답: {total, avgProgress, groupBy, groups: [{key, count, avgProgress}]}
    """
    params = _query_params(q=q, status=status, division=division, process=process,
                           year=year, is_key=is_key, progress_min=progress_min,
                           progress_max=progress_max, kpi_linked=kpi_linked,
                           mine_only=mine_only, editable_only=editable_only)
    if group_by:
        params["group_by"] = group_by
    return await _request(ctx, "GET", "/projects/aggregate", params=params)


@mcp.tool()
async def describe_data(ctx: Context) -> dict:
    """조회에 쓸 수 있는 **값 목록** — 사업부·프로세스·진행상태·과제구분·연도·DX KPI.

    사업부나 상태 이름이 확실치 않으면 **먼저 이걸 부른다.** 여기 없는 값을 필터에
    넣으면 조용히 0건이 나온다.

    (고칠 수 있는 필드를 알려면 `describe_fields` — 다른 도구다)
    """
    return await _request(ctx, "GET", "/ai/data-map")


@mcp.tool()
async def get_project(uuid: str, ctx: Context) -> dict:
    """과제 1건의 상세. 수정 전에 부르면 **`rowVersion`** 을 얻을 수 있고,
    그 값을 `patch_project(expected_version=…)` 에 넣으면 남이 먼저 고쳤을 때 409 로 막힌다.
    `canEdit` 이 false 면 이 사용자는 그 과제를 고칠 수 없다.

    ⚠️ **`isDeleted` 를 확인할 것.** true 면 **휴지통에 있는 과제**다.
       이 API 는 uuid 만 알면 휴지통 과제도 그냥 200 으로 돌려주고 `canEdit` 도 true 다
       (복구·영구삭제가 같은 판정을 쓰기 때문). `list_projects` 는 휴지통을 안 주므로,
       여기서 삭제된 과제가 나왔다면 사용자가 옛 uuid 를 준 것이다.
       수정은 `patch_project` 가 400 으로 막지만, **읽어서 보고할 때도 삭제 상태를 같이
       알려야 한다** — 안 그러면 사용자는 멀쩡한 과제 이야기로 듣는다."""
    return await _request(ctx, "GET", f"/projects/{uuid}")


@mcp.tool()
async def get_project_changes(uuid: str, ctx: Context, limit: int = 50) -> list:
    """과제의 **필드 단위 변경 이력** — 누가·언제·무엇을 어떤 값에서 어떤 값으로 바꿨나.

    행 하나가 필드 하나다. 같은 `rowVersion` 은 **한 번의 저장**이다.
    ⚠️ 2026-07-31(V2 전환) 이후 변경만 기록돼 있다."""
    return await _request(ctx, "GET", f"/projects/{uuid}/changes", params={"limit": limit})


@mcp.tool()
async def get_project_history(uuid: str, ctx: Context, limit: int = 50) -> list:
    """과제의 **진척 지표 추이** — 그 시점의 진행률·진행상태·액션아이템·이슈·기간.

    화면의 진척률은 액션아이템 완료 비율로 **매번 다시 계산**되어 소급 변경되지만
    (액션아이템을 추가하면 분모가 바뀌어 과거 숫자까지 달라진다), 이 이력은 **그때 기록된
    분자·분모**라 안 바뀐다. 그래서 "진척률이 떨어진 게 일을 못 해서인지 일이 늘어서인지"
    를 가릴 수 있다 — `actionTotal` 이 늘었는지 보면 된다.

    ⚠️ `startMonth`/`endMonth` 는 **날짜가 아니라 월 번호(1~12)**. 연도는 `year`.
    ⚠️ 2026-07-29 이전 기간은 존재하지 않는다."""
    return await _request(ctx, "GET", f"/projects/{uuid}/history", params={"limit": limit})


@mcp.tool()
async def list_proposals(ctx: Context, status: str = "pending", limit: int = 50) -> list:
    """확인 대기 중인 변경 목록. 핵심 필드를 고치려 하면 여기 쌓인다.

    status: pending(기본) · approved · rejected · stale · all

    대기 중인 것이 있으면 **사용자에게 무엇이 걸려 있는지 알리고** 어떻게 할지 묻는다.
    반영은 `confirm_change`, 취소는 `cancel_change`."""
    return await _request(ctx, "GET", "/proposals",
                          params={"status": status, "limit": limit})


@mcp.tool()
async def find_people(q: str, ctx: Context) -> list:
    """이름(또는 knoxId 앞부분)으로 사람을 찾아 **knoxId 를 확인한다.** 읽기 전용.

    q  이름 일부 또는 knoxId 앞부분

    돌려주는 것: `[{"이름", "knoxId", "부서", "동명이인"}]` — 가입한 활성 계정만.

    ── 언제 부르나 ──────────────────────────────────────────────────────────
    `과제참여인력목록`·`과제PL_knoxId` 를 넣기 **전에.** 이 두 필드는 knoxId 가
    없으면 서버가 400 으로 거절한다. 이름만 알고 있다면 여기서 먼저 확정한다.

    ⚠️ **`동명이인: true` 가 있으면 마음대로 고르지 말 것.** 사용자에게 이름·부서를
       보여주고 누구인지 물어본다. 여기 넣은 사람은 **그 과제를 고칠 수 있게 된다** —
       잘못 고르면 엉뚱한 사람에게 편집 권한이 간다.

    ⚠️ 검색 결과가 없으면 **아직 가입하지 않은 사람**일 수 있다. knoxId(사내 이메일
       @앞부분)를 사용자에게 물어 넣어 두면, 그 사람이 가입하는 순간 연결된다.
       지어내지 말 것.
    """
    return await _request(ctx, "GET", "/people/search", params={"q": q})


# ─────────────────────────────────────────────────────────────────────────────
# 쓰기 — 위험도 분기는 **백엔드가** 한다
# ─────────────────────────────────────────────────────────────────────────────

@mcp.tool()
async def patch_project(
    uuid: str,
    patch: dict,
    reason: str,
    ctx: Context,
    expected_version: int = 0,
) -> dict:
    """과제 1건을 수정한다. **바뀐 필드만** 담는다.

    patch            `{"과제상세설명": "...", "상세정보_향후계획": {...}}` — 키는 `describe_fields` 의 `key`
                     ⚠️ `진행률` 은 액션아이템에서 자동 계산된다. 액션아이템이 있는 과제에
                     직접 보내면 400 이다 — `액션아이템목록` 의 완료 표시를 바꾼다.
    reason           **왜 고치는지.** 변경 이력에 남아 사람이 판단 근거를 본다. 필수로 적을 것
    expected_version `get_project` 의 `rowVersion`. 넣으면 남이 먼저 고쳤을 때 409 로 막힌다

    돌아오는 것:
      status=needs_confirmation(202) **아직 안 바뀌었다.** 핵심 필드라 확인이 필요하다.
                                    → 아래 '확인 절차' 를 그대로 따를 것
      status=conflict(409)          남이 먼저 고쳤다. get_project 로 다시 받아 재시도
      그 외 성공                    `applied` 에 반영된 필드, **`ignored` 에 무시된 키**.
                                    `ignored` 가 비어 있지 않으면 **그 키는 저장되지 않았다** —
                                    사용자에게 그대로 알릴 것. 조용히 넘기지 말 것

    ── 확인 절차 (202 를 받았을 때) ──────────────────────────────────
    1. `preview` 의 **before → after 를 사용자에게 그대로 보여준다.**
       요약하거나 "바꿨습니다" 로 넘기지 말 것 — 확인의 요점은 사용자가 **값을 직접
       보는 것**이다. `projectTitle`·`projectCode` 도 함께 보여 **과제를 제대로
       집었는지** 사용자가 판단하게 한다.
    2. 사용자에게 **명시적으로 묻는다** ("이대로 반영할까요?").
    3. 사용자가 그렇다고 하면 `confirm_change(proposalId)`, 아니라면
       `cancel_change(proposalId)`.

    ⚠️ 응답에 `alsoPending` 이 있으면 **그 항목도 아직 반영되지 않았다.** 저위험이라
       원래는 즉시 반영되지만, 반쪽만 반영하면 과제가 모순 상태로 잠기는 경우
       서버가 함께 대기시킨 것이다(예: 미착수 과제의 `액션아이템목록` + `진행상태`).
       이때 `applied` 는 비어 있다 — "액션아이템은 반영했다" 고 말하면 거짓이 된다.

    ⚠️ 응답에 `peoplePreview` 가 있으면 **그 표를 반드시 같이 보여준다.** 사람 필드는
       값만 봐서는 누구인지 모른다 — 이름·knoxId·부서·연결여부가 거기 들어 있다.
       "홍길동 추가" 만 보여주면 사용자는 어느 홍길동인지 모른 채 승인하게 된다.
       `연결: 가입 대기(계정 없음)` 이면 지금은 권한이 안 생기고 그 사람이 가입할 때
       생긴다는 것도 같이 알린다.

    ⚠️ **묻지 않고 바로 `confirm_change` 를 부르지 말 것.** 그러면 이 단계가 없는 것과
       같다. 사용자가 "확인 없이 그냥 해" 라고 **먼저 말한 경우에만** 바로 진행한다.

    ⚠️ `성과목록`·이미지·`선행과제목록` 은 여기로 안 간다. `describe_fields` 참고.

    ⚠️ **휴지통 과제는 400 으로 거절된다.** `get_project` 의 `isDeleted` 가 true 면
       고치기 전에 사용자에게 알리고, 복구할지 물어라(복구는 화면의 휴지통에서 한다).
       화면은 같은 과제를 고칠 수 있다 — 사업부 이름 변경 같은 일괄 수정이 휴지통까지
       닿아야 하기 때문이다. AI 만 막는 이유가 그것이다.
    """
    body = {"patch": patch, "actor_mode": "ai", "ignore_unknown": True}
    if reason:
        body["reason"] = reason
    if expected_version:
        body["expected_version"] = expected_version
    return await _request(ctx, "PATCH", f"/projects/{uuid}", json_body=body)


@mcp.tool()
async def create_project(
    fields: dict,
    reason: str,
    ctx: Context,
) -> dict:
    """**새 과제를 만든다.** 있는 과제를 고치는 것이 아니다.

    fields  `{"과제명": "...", "사업부": "MX", "진행상태": "미착수", ...}`
            키는 `describe_fields` 의 `key` 를 쓴다. **`과제명` 은 필수.**
            `id`(과제코드)를 주면 그 값으로, 안 주면 코드 없이 만들어진다.
    reason  왜 만드는지. 변경 이력에 남는다.

    ── 부르기 전에 반드시 ────────────────────────────────────────────
    1. `describe_fields` 로 필드 이름과 **선택지**를 확인한다(사업부·진행상태·프로세스·
       과제구분·과제영역은 정해진 값만 들어간다).
    2. **만들 내용을 사용자에게 보여주고 동의를 받는다.**
       수정과 달리 **확인 대기(202)가 없다** — 부르는 즉시 만들어진다.
       생성은 기존 값을 덮지 않아 잃는 것이 없지만, 그래도 **묻지 않고 만들지 말 것.**
    3. 여러 건이면 **한 건씩** 만들고 결과를 보고한다. 한 번에 몰아 만들지 않는다.

    ── 사람을 같이 넣을 때 ───────────────────────────────────────────
    `과제참여인력목록`·`과제PL_knoxId` 를 여기서 바로 넣을 수 있다. 단
    **knoxId 가 없으면 400** 이다 — 먼저 `find_people` 로 확인한다.
    같은 이름이 여럿이면 **사용자에게 누구인지 물어본 뒤** 넣는다.
    생성은 확인 대기가 없어 **즉시 권한이 생긴다.** 짐작으로 고르지 말 것.
    (`담당자`·`과제참여인력`(레거시 문자열)·소유자는 여전히 못 넣는다 — 이름만
     담기는 형태라 동명이인을 가릴 수 없다.)

    ⚠️ 과제코드가 이미 있으면 **409** 로 거절된다 — 다른 코드로 다시 부른다.
    ⚠️ 응답의 `ignored` 에 키가 있으면 **그 값은 저장되지 않았다.** 사용자에게 알릴 것.

    돌아오는 것: 만들어진 과제의 상세(`uuid`·`rowVersion` 포함).
    그 `uuid` 로 이어서 `patch_project` 를 부를 수 있다.
    """
    body = {"fields": fields, "actor_mode": "ai", "ignore_unknown": True}
    if reason:
        body["reason"] = reason
    return await _request(ctx, "POST", "/projects", json_body=body)


# ─────────────────────────────────────────────────────────────────────────────
# 성과
#
# 과제와 기준이 **하나 다르다.** 성과는 여러 과제가 공유하므로, 다른 과제의 숫자까지
# 바꾸는 것은 확인 대기(202)로도 안 보내고 **403** 으로 막는다. 대신 과제-성과
# **연결**은 202 로 가되, preview 에 그 성과를 함께 쓰는 다른 과제까지 실어 보낸다.
# 삭제·복구는 도구를 두지 않았다 — 성과를 지우면 그 성과를 쓰던 모든 과제의 연결이
# 함께 사라지고, 복구해도 연결은 돌아오지 않는다.
# ─────────────────────────────────────────────────────────────────────────────


@mcp.tool()
async def describe_performance_fields(ctx: Context) -> dict:
    """성과에서 **무엇을 고칠 수 있는지**와 각 필드의 위험도·선택지를 돌려준다.

    **성과를 만들거나 고치기 전에 반드시 먼저 부른다.** 과제용 `describe_fields` 와
    **표가 다르다** — 그걸 보고 성과를 고치려 들면 없는 필드를 보내게 되고
    서버는 `ignored` 로 조용히 넘긴다.

    risk 값의 뜻 (과제와 다른 점에 주의):
      low        즉시 반영된다
      core       **403 이다. 확인 대기로도 안 간다** — 이 성과를 쓰는 다른 과제의
                 숫자까지 바뀌기 때문. 화면에서 사람이 고친다.
                 단 **생성할 때는** 핵심 필드도 함께 지정할 수 있다.
      immutable  서버가 정한다
    """
    return await _request(ctx, "GET", "/describe/performance-fields")


@mcp.tool()
async def list_performances(
    ctx: Context,
    q: str = "",
    year: int = 0,
    category: str = "",
    limit: int = 50,
    offset: int = 0,
) -> dict:
    """성과 목록을 검색한다.

    q         성과항목명 부분일치
    year      성과년도
    category  대분류 (`describe_performance_fields` 의 선택지 참고)
    """
    params = {"limit": limit, "offset": offset}
    if q:
        params["q"] = q
    if year:
        params["year"] = year
    if category:
        params["category"] = category
    return await _request(ctx, "GET", "/performances", params=params)


@mcp.tool()
async def get_performance(uuid: str, ctx: Context) -> dict:
    """성과 1건의 상세.

    `rowVersion` 을 얻어 `patch_performance(expected_version=…)` 에 넣으면
    남이 먼저 고쳤을 때 409 로 막힌다.
    **`affectedProjects` 를 꼭 본다** — 이 성과를 쓰는 과제 수다. 1보다 크면
    이 성과를 고칠 때 그 과제들의 숫자도 함께 움직인다.
    """
    return await _request(ctx, "GET", f"/performances/{uuid}")


@mcp.tool()
async def list_project_performances(uuid: str, ctx: Context) -> dict:
    """과제 1건에 연결된 성과 목록.

    **`link_performances` 를 부르기 전에 반드시 이걸 먼저 읽는다.** 연결은
    통째 교체라, 여기서 읽은 기존 목록을 함께 보내지 않으면 **그 연결이 지워진다.**
    """
    return await _request(ctx, "GET", f"/projects/{uuid}/performances")


@mcp.tool()
async def create_performance(fields: dict, reason: str, ctx: Context) -> dict:
    """**새 성과를 만든다.** 있는 성과를 고치는 것이 아니다.

    fields  `{"성과항목": "[MX] ...", "대분류": "...", "소분류": "...",
              "단위": "%", "목표수준": 10, ...}`
            키는 `describe_performance_fields` 의 `key` 를 쓴다. **`성과항목` 은 필수.**
    reason  왜 만드는지.

    ── 화면에서 사라지지 않게 하려면 (셋 다 생성 때만 넣을 수 있다) ─────
    1. **`성과항목` 앞에 `[사업부] ` 를 붙인다 — 서버가 강제한다.** 성과에는
       사업부 컬럼이 없어서 화면이 이 접두어로 사업부를 가른다.
       예: `"[MX] 힌지 수명 예측 오차 저감"`
       어느 사업부인지 모르면 **연결할 과제의 사업부를 따른다**
       (`get_project` 의 `사업부`). 정말 모르면 `[공통]`.
       · 모르는 접두어(`[무선]` 같은 오타)는 **400** 이다.
       · 안 붙이면 서버가 `[공통] ` 을 붙이고 응답 `normalized` 로 알려준다 —
         **그 값으로 굳으므로** 사용자에게 그대로 전할 것.
    2. **`대분류` 와 `소분류` 는 필수다 — 서버가 강제한다.** 화면이 사업부 › 대분류 ›
       소분류로 묶어서, 비면 그 단계가 `미분류` 가 된다. 빠뜨리면 **400** 이다.
    3. **소분류는 대분류에 딸린 값이다.** `describe_performance_fields` 의
       `optionsByCategory` 에서 짝이 맞는 것을 고른다. **짝이 어긋나도 400** 이고,
       오류 메시지가 그 대분류에 쓸 수 있는 값을 알려준다.

    아직 어느 과제에도 안 붙은 상태로 만들어진다. 과제에 붙이려면 이어서
    `link_performances` 를 부른다(그건 확인 대기로 간다).

    ⚠️ **확인 대기(202)가 없다** — 부르는 즉시 만들어진다. 만들 내용을 먼저
       사용자에게 보여주고 동의를 받을 것.
    ⚠️ 위 세 가지는 **생성 뒤에 못 고친다**(core, 403). 틀리면 새로 만들어
       연결을 갈아끼워야 하는데 **성과는 MCP 로 지울 수 없다.** 만들기 전에 확인할 것.
    ⚠️ 응답의 `ignored` 에 키가 있으면 **그 값은 저장되지 않았다.** 사용자에게 알릴 것.
    """
    body = {"fields": fields, "actor_mode": "ai", "ignore_unknown": True}
    if reason:
        body["reason"] = reason
    return await _request(ctx, "POST", "/performances", json_body=body)


@mcp.tool()
async def patch_performance(
    uuid: str,
    patch: dict,
    reason: str,
    ctx: Context,
    expected_version: int = 0,
) -> dict:
    """성과 1건을 수정한다. **바뀐 필드만** 담는다.

    patch            `{"실적수준": "12", "조치사항": "..."}` — 키는
                     `describe_performance_fields` 의 `key`
    reason           **왜 고치는지.** 필수로 적을 것
    expected_version `get_performance` 의 `rowVersion`

    ⚠️ **핵심 필드(`성과항목`·`대분류`·`소분류`·`목표수준`·`현재수준`)는 202 다.**
       과제와 같은 확인 절차를 탄다. 다만 응답에 **`affectedProjects`**(이 성과를
       함께 쓰는 다른 과제)가 함께 오니 **`preview` 와 같이 보여줘야 한다** —
       자기 과제만 보여주고 승인받으면 남의 과제가 조용히 틀어진다.

    ⚠️ **저위험을 같이 보내면 그것도 함께 대기한다**(`alsoPending`). 이때 `applied` 는
       비어 있다 — "실적은 반영했다" 고 말하면 거짓이 된다.

    ⚠️ **`_deleted`·`isActive` 는 여전히 막혀 있다.** 성과를 지우면 그 성과를 쓰던
       모든 과제의 연결이 함께 사라지고, 복구해도 돌아오지 않는다.

    ⚠️ **`단위` 는 403 이 아니라 `derived` 다 — 보내도 안 들어간다.**
       `소분류` 가 정하는 값이라 서버가 소분류의 단위로 채운다(화면도 이 칸을 잠근다).
       응답은 **200 인데 `applied` 에 없고**, `normalized`·`message` 가 그 사실을
       알려준다. 그대로 사용자에게 전할 것.
       단위를 바꾸려면 **`소분류` 를 바꾼다**(그러면 단위가 따라온다).
       `isAchievementType` 도 같다.
    """
    body = {"patch": patch, "actor_mode": "ai", "ignore_unknown": True}
    if reason:
        body["reason"] = reason
    if expected_version:
        body["expected_version"] = expected_version
    return await _request(ctx, "PATCH", f"/performances/{uuid}", json_body=body)


@mcp.tool()
async def link_performances(
    project_uuid: str,
    items: list,
    reason: str,
    ctx: Context,
    expected_version: int = 0,
) -> dict:
    """과제에 붙는 성과 연결을 **통째로 교체**한다.

    items  `[{"performanceUuid": "...", "contribution": "50"}, ...]`
           순서가 곧 화면 표시 순서다.
    reason 왜 바꾸는지.

    ⚠️ **`actualLevel` 은 여기 넣지 않는다.** 실적수준은 성과 본체에 있고, 화면은
       거기서만 읽는다 — 과제 리포트조차 연결 값을 본체 값으로 덮어쓴다.
       여기 다른 값을 넣으면 **저장은 되는데 아무 데도 안 보인다.**
       기여도로 곱하거나 나누지도 않는다.
       실적을 바꾸려면 `patch_performance(uuid, {"실적수준": "12"})` 를 쓴다.
       그래도 보내면 응답 `actualLevelWarnings` 에 어긋난 건이 실려 온다.

    ── 부르기 전에 반드시 ────────────────────────────────────────────
    **`list_project_performances` 로 지금 연결을 먼저 읽는다.** 이건 통째 교체라,
    한 건만 더하려 해도 **기존 연결을 전부 포함해서** 보내야 한다.
    빠뜨린 연결은 지워진다.

    ── 돌아오는 것 ───────────────────────────────────────────────────
    status=needs_confirmation(202) **아직 안 바뀌었다.** 아래 확인 절차를 따를 것.

    ⚠️ 202 응답에는 `affectedProjects` 가 실려 온다 — **이 성과를 함께 쓰는 다른
       과제들**이다. 연결을 바꾸면 그 과제들의 기여도 합도 흔들린다.
       `contributionWarnings` 는 합이 100 이 아닌 성과다.
       **이 두 가지를 preview 와 함께 사용자에게 그대로 보여준다.** 자기 과제만
       보여주고 승인받으면 남의 과제가 조용히 틀어진다.
    3. 사용자가 동의하면 `confirm_change(proposalId)`, 아니면 `cancel_change`.
    """
    body = {"items": items, "actor_mode": "ai"}
    if reason:
        body["reason"] = reason
    if expected_version:
        body["expected_version"] = expected_version
    return await _request(ctx, "PUT", f"/projects/{project_uuid}/performances",
                          json_body=body)


@mcp.tool()
async def confirm_change(proposal_id: int, ctx: Context, note: str = "") -> dict:
    """확인 대기 중인 변경을 **실제로 반영한다.**

    `patch_project` 가 202(needs_confirmation)를 돌려줬을 때, **사용자에게 before → after
    를 보여주고 명시적으로 동의를 받은 다음** 부른다.

    note  사용자가 덧붙인 말이 있으면 적는다. 변경 이력에 남는다.

    ⚠️ **사용자에게 묻지 않고 부르지 말 것.** 이 도구를 바로 부르면 확인 단계가 통째로
       사라진다. 202 응답을 받자마자 자동으로 이어 부르는 것은 잘못된 사용이다.

    409 가 오면 그 사이 **누군가 같은 항목을 고친 것**이다. 그대로 덮으면 그 수정이
    사라지므로 서버가 막는다 — `get_project` 로 지금 값을 다시 보고 사용자와 다시 정한다.
    """
    return await _request(ctx, "POST", f"/proposals/{proposal_id}/approve",
                          json_body={"note": note} if note else {})


@mcp.tool()
async def cancel_change(proposal_id: int, ctx: Context, note: str = "") -> dict:
    """확인 대기 중인 변경을 **취소한다.** 과제는 건드리지 않는다.

    사용자가 "아니다" 라고 했을 때 부른다. 그냥 두면 대기 목록에 계속 남아
    나중에 무엇이 살아 있는 요청인지 알 수 없게 된다.

    note  왜 취소하는지 짧게. 나중에 목록에서 사람이 읽는다.
    """
    return await _request(ctx, "POST", f"/proposals/{proposal_id}/reject",
                          json_body={"note": note} if note else {})


# ─────────────────────────────────────────────────────────────────────────────
# 관계도 · 분석 (2026-08-12 추가) — **전부 읽기 전용**
#
# 왜 도구를 11개로 쪼개지 않았나
#     분석은 인자가 거의 같고(연도·사업부) 답의 성격만 다르다. 도구를 종류마다
#     만들면 목록이 30개를 넘어 모델이 고르기부터 어려워진다. 하나로 묶고
#     `kind` 로 가른다 — 무엇을 물을 수 있는지는 이 설명이 알려 준다.
#
# ⚠️ **계산은 전부 서버에 있다.** 이 도구는 숫자를 만들지 않는다.
#    `graph_agent.py` 에는 `llm` 이라는 글자가 없다 — 그 파일의 모든 값은 결정적이다.
#    받은 숫자를 고쳐 말하지 말 것.
# ─────────────────────────────────────────────────────────────────────────────

_ANALYSIS = {
    "gaps": "/graph/agent/gaps",
    "risky": "/graph/agent/risky",
    "stalled": "/graph/agent/stalled",
    "schedule": "/graph/agent/schedule",
    "issues": "/graph/agent/issues",
    "hidden": "/graph/agent/hidden",
    "key_projects": "/graph/agent/key-projects",
    "divisions": "/graph/agent/divisions",
    "readiness": "/graph/agent/readiness",
}


@mcp.tool()
async def analyze(
    kind: str,
    ctx: Context,
    years: str = "",
    divisions: str = "",
    kpi_id: int = 0,
    limit: int = 0,
) -> dict:
    """과제 데이터를 **분석**한다. 관계도 화면이 쓰는 것과 같은 계산이다.

    kind — 무엇을 물을지
      gaps          **데이터 공백.** 성과·KPI 미연결, 기여도 합, 계정 미연결 등.
                    ★ 다른 분석의 신뢰도를 정한다. 사람 관련 답을 하기 전에 먼저 볼 것
      risky         **위험 지표.** 달성률이 낮은 KPI (연도 기준)
      stalled       **멈춘 과제.** 상태는 진행 중인데 진행률이 그대로.
                    ★ 유일하게 시간 축을 여는 분석이다
      schedule      **일정 쏠림.** 미완료 액션의 목표일이 한 달에 몰린 과제
      issues        **이슈 적체.** 오래 남은 미해결 이슈, 대응 액션이 없는 과제
      hidden        **숨은 연결.** 같은 KPI·사람으로 이어지는데 서로 모르는 과제 쌍
      key_projects  **중점과제의 말과 실제.** 선언과 데이터가 어긋난 것
      divisions     **사업부별 채움 정도**
      readiness     **보고 준비도.** 결과 보고서 전에 채울 것
      kpi           **KPI 한 장 브리핑.** `kpi_id` 필수

    years      "2026" 또는 "2026,2025". 비우면 전체
    divisions  "MX,VD". 비우면 전체
    limit      risky 에서만 쓴다 (기본 5, 최대 20)

    ── 답할 때 지킬 것 ──────────────────────────────────────────────
    (1) **숫자를 다시 계산하지 않는다.** 서버가 준 값을 그대로 쓴다
    (2) 응답의 `coverage`·`note` 를 **먼저** 말한다 — "판단하지 않은 과제 N개",
        "참여인력 연결률 81%" 같은 것이 답의 신뢰도다. 빼고 말하면 과장이 된다
    (3) `stalled` 의 **진행률이 내려간 것은 나쁜 신호가 아니다** — 액션아이템을
        늘려 계획이 커진 것일 수 있다. 그렇게 읽어 줄 것
    """
    if kind == "kpi":
        if not kpi_id:
            return {"status": "error",
                    "message": "kind='kpi' 에는 kpi_id 가 필요합니다."}
        path = f"/graph/agent/kpi/{kpi_id}"
    else:
        path = _ANALYSIS.get(kind)
        if path is None:
            return {"status": "error",
                    "message": f"모르는 분석입니다: {kind}",
                    "available": sorted(list(_ANALYSIS) + ["kpi"])}

    params = {}
    if years:
        params["years"] = years
    if divisions:
        params["divisions"] = divisions
    if limit:
        params["limit"] = limit
    return await _request(ctx, "GET", path, params=params or None)


@mcp.tool()
async def get_graph(
    ctx: Context,
    years: str = "",
    divisions: str = "",
    layers: str = "",
    include_deleted: bool = False,
) -> dict:
    """관계도 원본 — 과제·성과·KPI·사업부·사람이 어떻게 이어져 있는지.

    layers  "perf,kpi,dep" 처럼. 비우면 기본값, "all" 도 된다.
            모르는 이름을 넣으면 400 이다(조용히 무시하지 않는다)
    include_deleted  휴지통·취소 과제까지 (기본은 뺀다)

    ⚠️ **노드가 수백 개다.** 전체를 그대로 사용자에게 늘어놓지 말 것 —
       무엇을 찾는지 정하고 `analyze` 로 좁히는 편이 거의 항상 낫다.
       이 도구는 "이 과제가 무엇과 이어져 있나" 를 직접 봐야 할 때만 쓴다.
    """
    params = {}
    if years:
        params["years"] = years
    if divisions:
        params["divisions"] = divisions
    if layers:
        params["layers"] = layers
    if include_deleted:
        params["includeDeleted"] = "1"
    return await _request(ctx, "GET", "/graph", params=params or None)


@mcp.tool()
async def get_graph_options(ctx: Context, years: str = "",
                            divisions: str = "") -> dict:
    """관계도에서 고를 수 있는 값들(연도·사업부·레이어). 필터를 짜기 전에 부른다."""
    params = {}
    if years:
        params["years"] = years
    if divisions:
        params["divisions"] = divisions
    return await _request(ctx, "GET", "/graph/options", params=params or None)


# ─────────────────────────────────────────────────────────────────────────────
# DX KPI 연결 · 선행 과제
#
#   과제-KPI 연결   ✅ **2026-08-12 열렸다.** `set_project_kpi_links` 로 **제안**할
#                  수 있다 — 항상 202 이고 사람이 승인해야 반영된다. `reason` 필수.
#                  막았던 이유("AI 가 추측으로 채우면 매트릭스의 빈칸=계획의 구멍이
#                  가짜로 메워진다")를 **금지가 아니라 근거+승인으로 풀었다.**
#                  과제-성과 연결이 지나간 길과 같다.
#
#   선행 과제       ⛔ 아직 **읽기만**. 서버가 `actor_mode='ai'` 를 403 으로 막는다
#                  ("AI 는 선행 과제 연결을 변경할 수 없습니다"). 도구를 만들어도
#                  부를 때마다 403 이라 안 만들었다 — 화면에서 하도록 안내할 것.
#
#   KPI 일괄 편집   ⛔ **PAT(외부 토큰) 자체를 막는다.** 한 번의 오조작이 N배로
#                  번지고 승인 화면도 칸마다 보여주기 어렵다. 과제별로 하나씩 제안할 것.
# ─────────────────────────────────────────────────────────────────────────────

@mcp.tool()
async def get_project_kpi_links(uuid: str, ctx: Context) -> dict:
    """과제에 걸린 **DX KPI 연결**(기여등급·기여방법 포함).

    ⚠️ **바꾸기 전에 반드시 이걸 먼저 읽는다.** `set_project_kpi_links` 는
       **통째 교체**라, 여기서 읽은 기존 연결을 전부 포함해서 보내야 한다.
       빠뜨린 연결은 지워진다.

    무엇이 비어 있는지는 `analyze('gaps')` 의 `noKpi`(연결 없음)·
    `noRelationType`(기여등급 미지정)과 함께 보면 좋다.
    """
    return await _request(ctx, "GET", f"/projects/{uuid}/kpi-links")


@mcp.tool()
async def set_project_kpi_links(
    project_uuid: str,
    items: list,
    reason: str,
    ctx: Context,
    expected_version: int = 0,
) -> dict:
    """과제의 **DX KPI 연결을 통째로 교체**하자고 제안한다. (2026-08-12)

    items  `[{"kpiDefinitionId": 4, "relationType": "primary", "note": "..."}, ...]`
           `targetDivision` 은 **대개 보내지 않는다** — 사업부 과제는 서버가 자기
           사업부로 고정한다. **기능조직(GTR·SR·CS) 과제만** 지원할 사업부를
           지목해야 하고, 안 보내면 400 으로 알려 준다.
    relationType  primary(주기여) · secondary(보조) · indirect(간접). 생략하면 미지정.
    reason **필수.** 왜 이 지표인지. 없으면 400 이다 — 아래 참조.

    ── 이건 **바로 반영되지 않는다** ─────────────────────────────────────
    항상 **202(확인 대기)** 로 간다. 사람이 승인해야 들어간다.

    왜 그런가: 이 연결은 사람이 "이 과제가 무엇에 기여하는가" 를 **선언**하는
    값이다. AI 가 추측으로 채우면 매트릭스의 빈칸(=계획의 구멍)이 가짜로 메워진다.
    그래서 원래 403 이었고, 2026-08-12 에 **근거를 붙여 사람이 판단하게 하는
    조건으로** 열렸다. `reason` 이 필수인 것이 그 조건이다.

    ── 부르기 전에 반드시 ────────────────────────────────────────────
    **`get_project_kpi_links` 로 지금 연결을 먼저 읽는다.** 통째 교체라, 하나만
    더하려 해도 **기존 연결을 전부 포함해서** 보내야 한다. 빠뜨린 연결은 지워진다.
    후보를 고를 때는 `get_kpi_matrix` 로 어떤 지표가 있는지 보고,
    `analyze('gaps')` 의 `noKpi`·`noRelationType` 으로 어디가 비었는지 본다.

    ── 돌아오는 것 ───────────────────────────────────────────────────
    status=needs_confirmation(202) **아직 안 바뀌었다.**
      1. `preview` 의 before → after 를 사용자에게 그대로 보여준다.
         after 에는 **지표 이름(label)·대상 사업부·기여 등급**이 들어 있다 —
         id 만 읽어 주지 말 것. 승인자가 무엇에 동의하는지 알아야 한다
      2. **왜 그 지표인지(`reason`)를 함께 말한다.** 근거를 안 보여주고 승인을
         받으면 이 절차가 형식이 되고, 원래 막았던 문제가 그대로 돌아온다
      3. 동의하면 `confirm_change(proposalId)`, 아니면 `cancel_change`

    ⚠️ 여러 과제를 한 번에 거는 일괄 편집은 **PAT 자체가 막혀 있다.** 한 번의
       오조작이 N배로 번지기 때문이다 — 과제별로 하나씩 제안할 것.
    """
    body = {"items": items, "actor_mode": "ai", "reason": reason}
    if expected_version:
        body["expected_version"] = expected_version
    return await _request(ctx, "PUT", f"/projects/{project_uuid}/kpi-links",
                          json_body=body)


@mcp.tool()
async def get_kpi_matrix(ctx: Context, year: int = 0) -> dict:
    """KPI x 사업부 매트릭스의 **원재료**(집계 전, 평평한 목록).

    year  비우면 전 연도.

    ⚠️ 서버가 **일부러 집계하지 않고** 준다. 필요한 축으로 직접 묶어 쓰되,
       묶는 방법을 사용자에게 밝힐 것 — 화면의 매트릭스와 다르게 묶으면
       숫자가 달라 보인다.
    """
    return await _request(ctx, "GET", "/kpi-matrix",
                          params={"year": year} if year else None)


@mcp.tool()
async def get_project_dependencies(uuid: str, ctx: Context) -> dict:
    """이 과제의 **선행 과제**(먼저 끝나야 하는 과제) 연결.

    ⚠️ **읽기만 된다.** 거는 것은 AI 에게 막혀 있다(위 주석) — 화면에서 해야 한다.
    """
    return await _request(ctx, "GET", f"/projects/{uuid}/dependencies")


# ─────────────────────────────────────────────────────────────────────────────
# 추이 (시계열)
# ─────────────────────────────────────────────────────────────────────────────

_TREND = {
    "projects": "/trend/projects",
    "performances": "/trend/performances",
    "notes": "/trend/notes",
    "changes": "/trend/changes",
}


@mcp.tool()
async def get_trend(
    kind: str,
    ctx: Context,
    years: str = "",
    divisions: str = "",
    date: str = "",
) -> dict:
    """시간에 따라 **무엇이 어떻게 변했는지**.

    kind
      projects      날짜별 사업부 과제 수 (완료 포함·취소 제외).
                    올라가면 새로 편성된 것, 내려가면 지워진 것이라 곡선 자체가 편성 이력
      performances  성과 속성 카드별 현재·목표·실적 시계열
      changes       그날 들어오고 나간 과제 (`date` 로 하루를 고른다)
      notes         사람이 곡선에 붙여 둔 메모

    years / divisions  "2026,2025" · "MX,VD" 처럼. 비우면 전체
    date               changes·notes 에서 하루를 고를 때 "2026-08-11"

    ── 반드시 함께 말할 것 ──────────────────────────────────────────
    (1) **2026-07-29 이전 기간은 없다.** 이력 수집이 그날 시작됐고 소급 생성은
        불가능하다. 그 전 추이를 물으면 "없다" 고 답할 것 — 지어내지 말 것
    (2) `estimated` 표시가 붙은 점은 **이관이 지어낸 생성일**이다. 그날 과제가
        실제로 쏟아진 것이 아니다. 그대로 읽으면 절벽처럼 보인다
    (3) 값은 **환산 전 원본**이다. 단위가 섞인 것을 그냥 더하지 말 것
        (환산 규칙은 화면에 있고 이 값에는 안 걸려 있다)
    """
    path = _TREND.get(kind)
    if path is None:
        return {"status": "error", "message": f"모르는 추이입니다: {kind}",
                "available": sorted(_TREND)}
    params = {}
    if years:
        params["years"] = years
    if divisions:
        params["divisions"] = divisions
    if date:
        params["date"] = date
    return await _request(ctx, "GET", path, params=params or None)



# ─────────────────────────────────────────────────────────────────────────────
# 디지털 트윈 기술정보 — 바깥 소식과 기술 레이더
#
# ⚠️⚠️ **이 도구들이 이 모듈의 주 입구다.** 포털 서버는 인터넷에 못 나간다(바깥
#    호출이 사내 LLM 하나뿐이다). 그래서 소식을 **긁어오지 못한다.** 웹을 읽을 수
#    있는 것은 바깥에서 도는 AI(=너)뿐이고, 조사한 결과를 여기로 밀어 넣어야 쌓인다.
#
# ⚠️ 이 자리는 세 번 시도됐다가 세 번 다 죽었다. **기술 목록이 아무의 일도 아니어서**
#    다. 그래서 `add_intel_news` 는 `technologies` 를 함께 받아 **소식을 넣는 김에
#    레이더가 채워지게** 되어 있다. 소식만 넣고 기술을 비우면 그 장치가 안 돈다.
# ─────────────────────────────────────────────────────────────────────────────

@mcp.tool()
async def describe_intel(ctx: Context) -> dict:
    """기술정보에서 **무엇을 고를 수 있는지** — 소식 분류ㆍ레이더 부채꼴ㆍ단계ㆍCPT.

    **소식이나 기술을 넣기 전에 먼저 부른다.** 분류와 부채꼴은 설정에서 늘어나는
    값이라 지어내면 안 된다. 여기 없는 값을 보내면 그대로 저장되어 **레이더에 빈
    부채꼴이 하나 생긴다.**

    돌려주는 것
        newsCategories  소식 분류 (기술 발표ㆍ시장ㆍ경쟁사ㆍ규제·표준ㆍ사례ㆍ연구)
        techCategories  레이더 부채꼴 — **기술 하나는 여기서 딱 하나**를 고른다
        stages          도입 / 시험 / 관찰 / 보류
        cptGroups       DTC Capabilities Periodic Table v1.1 여섯 묶음.
                        **여러 개 붙일 수 있는 태그**이고 값이 고정이다
    """
    return await _intel(ctx, "GET", "/settings")


@mcp.tool()
async def list_intel_news(
    ctx: Context,
    q: str = "",
    category: str = "",
    tech_uuid: str = "",
) -> list:
    """모여 있는 소식 목록. **새 것을 넣기 전에 이미 있는지 본다.**

    ⚠️ 같은 원문 주소는 서버가 알아서 막지만, 주소가 다른 같은 사건(보도자료와
       기사)은 못 막는다. `q` 로 먼저 찾아볼 것.

    ⚠️ 응답에 **본문은 없다**(기사 전문이 수백 건이면 응답이 메가바이트가 된다).
       `hasBody`ㆍ`bodyLength` 로 보관 여부만 온다. 본문을 읽으려면
       `get_intel_news` 를 쓴다.

    tech_uuid 를 주면 **그 기술의 근거가 된 소식만** 나온다.
    """
    params = {}
    if q:
        params["q"] = q
    if category:
        params["category"] = category
    if tech_uuid:
        params["techUuid"] = tech_uuid
    return await _intel(ctx, "GET", "/news", params=params or None)


@mcp.tool()
async def get_intel_news(uuid: str, ctx: Context) -> dict:
    """소식 하나 — **보관된 원문까지** 준다."""
    return await _intel(ctx, "GET", f"/news/{uuid}")


@mcp.tool()
async def add_intel_news(
    ctx: Context,
    title: str,
    summary: str = "",
    source: str = "",
    url: str = "",
    published_at: str = "",
    category: str = "",
    body: str = "",
    tags: list | None = None,
    divisions: list | None = None,
    technologies: list | None = None,
) -> dict:
    """조사한 소식을 포털에 넣는다. **이 모듈의 주 입구다.**

    ⚠️⚠️ **`technologies` 를 반드시 채운다.** 그 소식이 말하는 기술 이름을 함께
       보내면 레이더에 자동으로 올라가고(처음 보는 것은 「관찰」), 이미 있으면
       **별칭까지 맞춰 같은 줄에 이어 붙는다.** 이게 레이더를 살리는 장치라,
       비우면 소식만 쌓이고 레이더는 빈 채로 남는다 — 앞선 세 번이 그렇게 죽었다.

           technologies=[{"name": "NVIDIA Omniverse",
                          "note": "실시간 물리 해석이 붙었다"}]

       `note` 는 **그 소식이 그 기술에 대해 무엇을 말하는지** 한 줄이다. 제목만으론
       6개월 뒤 왜 걸었는지 알 수 없다.

    ⚠️ `published_at` 은 **기사가 나온 날**(`YYYY-MM-DD`)이다. 모르면 **비워 둘 것** —
       오늘 날짜로 채우지 말 것. 목록이 발표일 순이라, 오래된 글이 맨 위에 선다.

    ⚠️ **`body` 에 원문을 담아라.** 링크는 썩는다 — 회사가 글을 내리거나 주소를
       바꾸면 6개월 뒤엔 제목만 남는다. 너는 페이지를 읽을 수 있으니, 읽은 본문을
       그대로 넣어 두면 원문이 사라져도 조직이 읽을 수 있다.

    ⚠️ `category` 는 `describe_intel` 의 `newsCategories` 에서 고른다. 지어내지 말 것.

    같은 `url` 이 이미 있으면 **새로 만들지 않고 그것을 돌려준다**(중복 안전).
    """
    # ⚠️ **출처를 밝힌다.** 안 밝히면 서버가 「사람이 손으로 적음」으로 남기고,
    #    나중에 사람이 확인한 것과 AI 가 조사한 것을 못 가른다.
    body_json = {"title": title, "origin": "mcp"}
    for k, v in (("summary", summary), ("source", source), ("url", url),
                 ("publishedAt", published_at), ("category", category),
                 ("body", body)):
        if v:
            body_json[k] = v
    if tags:
        body_json["tags"] = tags
    if divisions:
        body_json["divisions"] = divisions
    if technologies:
        body_json["technologies"] = technologies
    return await _intel(ctx, "POST", "/news", json_body=body_json)


@mcp.tool()
async def list_intel_tech(
    ctx: Context,
    q: str = "",
    category: str = "",
    stage: str = "",
) -> list:
    """기술 레이더 목록. **기술을 새로 만들기 전에 반드시 본다.**

    ⚠️ 같은 기술이 여러 줄이 되는 순간 레이더는 목록이 아니라 잡동사니가 된다.
       `q` 로 먼저 찾아보고, 있으면 새로 만들지 말고 그 uuid 를 쓸 것.

    ⚠️ 검색은 **태그와 CPT 까지** 닿는다 — 「표준화」로 찾으면 부채꼴이 데이터·연결인
       OPC UA 도 나온다(표준화가 태그로 걸려 있다).

    응답에 함께 오는 것
        evidenceCount  이 기술을 떠받치는 소식 수
        isStale        근거가 오래 없어 **낡았다**는 표시. 단계마다 기준이 다르다
                       (관찰 180일 · 도입 540일). true 면 새 근거가 필요하다는 뜻
    """
    params = {}
    if q:
        params["q"] = q
    if category:
        params["category"] = category
    if stage:
        params["stage"] = stage
    return await _intel(ctx, "GET", "/tech", params=params or None)


@mcp.tool()
async def get_intel_tech_evidence(uuid: str, ctx: Context) -> list:
    """그 기술을 떠받치는 소식들. **왜 지금 단계인지**가 여기서 읽힌다."""
    return await _intel(ctx, "GET", f"/tech/{uuid}/evidence")


@mcp.tool()
async def add_intel_tech(
    ctx: Context,
    name: str,
    summary: str = "",
    vendor: str = "",
    category: str = "",
    url: str = "",
    description: str = "",
    aliases: list | None = None,
    tags: list | None = None,
    cpt: list | None = None,
) -> dict:
    """기술을 레이더에 올린다. **소식 없이 기술만 따로 넣을 때** 쓴다.

    ⚠️ 보통은 이걸 직접 부르지 말고 `add_intel_news` 의 `technologies` 로 넣는다 —
       그래야 근거가 함께 남는다. 근거 없는 줄은 「누가 왜 올렸는지 모르는 줄」이 되고,
       그런 줄이 쌓이면 아무도 레이더를 안 본다.

    ⚠️ **먼저 `list_intel_tech` 로 찾아본다.** 이미 있으면 서버가 그것을 돌려주지만
       (별칭까지 맞춘다), 표기가 많이 다르면 못 잡아 두 줄이 된다.

    ⚠️ 단계는 여기서 못 정한다 — 새 기술은 **늘 「관찰」로 시작**한다. 단계를 옮기는
       것은 조직의 판단이라 관리자·사무국만 할 수 있다(화면에서 한다).

    각 칸이 왜 있나
        summary  **이게 뭐냐.** 한 문장. 목록에서 이것만 읽는다 — 비우면 6개월 뒤
                 「이게 뭐였지」가 되고 그 줄은 죽는다. **반드시 채울 것**
        url      공식 문서·제품 주소. 없으면 더 알아보려고 검색을 다시 해야 한다
        aliases  기사마다 다른 이름으로 나온다(Omniverse / NVIDIA Omniverse / OV).
                 적어 두면 다음 소식이 **같은 줄에 이어 붙는다**
        category `describe_intel` 의 `techCategories` 에서 **하나만**. 레이더에서
                 어느 부채꼴에 놓을지를 정한다
        tags     부채꼴이 하나뿐이라 **걸치는 갈래는 여기 남긴다**
                 (OPC UA → category=데이터·연결, tags=["표준화"])
        cpt      DTC CPT v1.1 여섯 중 해당하는 것들. `describe_intel` 참고.
                 값이 고정이라 모르는 값은 **조용히 버려진다**
    """
    body_json = {"name": name, "origin": "mcp"}
    for k, v in (("summary", summary), ("vendor", vendor), ("category", category),
                 ("url", url), ("description", description)):
        if v:
            body_json[k] = v
    if aliases:
        body_json["aliases"] = aliases
    if tags:
        body_json["tags"] = tags
    if cpt:
        body_json["cpt"] = cpt
    return await _intel(ctx, "POST", "/tech", json_body=body_json)


@mcp.tool()
async def update_intel_tech(
    uuid: str,
    ctx: Context,
    summary: str = "",
    vendor: str = "",
    category: str = "",
    url: str = "",
    description: str = "",
    aliases: list | None = None,
    tags: list | None = None,
    cpt: list | None = None,
) -> dict:
    """레이더의 빈 칸을 채운다. **비운 인자는 안 건드린다.**

    ⚠️ 소식에서 저절로 만들어진 기술은 **이름밖에 없다.** `list_intel_tech` 로
       `summary` 가 빈 줄을 찾아 채우는 것이 이 도구의 주 용도다 — 그런 줄을 두면
       레이더가 「이름만 적힌 목록」이 되고, 그러면 아무도 안 본다.

    ⚠️ **단계(stage)는 여기서 못 바꾼다.** 조직의 판단이라 권한이 다르고, 전용
       경로가 따로 있다(화면에서 관리자·사무국이 한다). 보내도 400 이 난다.
    """
    body_json = {}
    for k, v in (("summary", summary), ("vendor", vendor), ("category", category),
                 ("url", url), ("description", description)):
        if v:
            body_json[k] = v
    for k, v in (("aliases", aliases), ("tags", tags), ("cpt", cpt)):
        if v is not None:
            body_json[k] = v
    if not body_json:
        return {"status": "error", "message": "고칠 값이 하나도 없습니다."}
    return await _intel(ctx, "PATCH", f"/tech/{uuid}", json_body=body_json)


@mcp.tool()
async def link_intel_evidence(
    news_uuid: str,
    tech_uuid: str,
    ctx: Context,
    note: str = "",
) -> dict:
    """이미 있는 소식과 기술을 잇는다.

    ⚠️ 넣을 때 놓친 연결을 나중에 붙이는 자리다. **`note` 를 채울 것** — 그 소식이
       그 기술에 대해 무엇을 말하는지가 없으면, 나중에 왜 걸었는지 알 수 없다.
    """
    return await _intel(ctx, "POST", "/evidence",
                        json_body={"newsUuid": news_uuid, "techUuid": tech_uuid,
                                   "note": note or None, "origin": "mcp"})



if __name__ == "__main__":
    mcp.settings.host = os.environ.get("MCP_HOST", "127.0.0.1")
    mcp.settings.port = int(os.environ.get("MCP_PORT", "3003"))
    mcp.run(transport="streamable-http")
