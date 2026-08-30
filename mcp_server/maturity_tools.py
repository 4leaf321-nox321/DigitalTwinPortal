"""디지털 트윈 **성숙도** MCP 도구 — 대시보드와 섞이지 않게 따로 둔다. (2026-08-30)

왜 파일을 갈랐나
    `server.py` 의 도구 49개는 **디지털 트윈 대시보드**(과제·성과·KPI·기술정보·설문)의
    것이다. 성숙도는 다른 모듈이고, 다루는 것도 다르다 — 저쪽은 「과제가 어떻게
    되어 가나」이고 여기는 「시험 하나에 대해 시뮬레이션이 어디까지 왔나」다.
    섞이면 AI 가 `list_projects` 로 성숙도를 찾다가 엉뚱한 답을 만든다.

섞이지 않게 하는 세 가지
    ① **이름** — 성숙도 도구는 전부 `maturity_` 로 시작한다. 목록에서 한눈에 갈린다.
    ② **파일** — 이 파일에만 있다. `server.py` 는 마지막에 `register(mcp, _request)` 한 줄.
    ③ **접두사** — 백엔드 블루프린트가 다르다(`/api/dev-dt-maturity`). 대시보드의
       `/api/dt-v2` 로는 성숙도를 부를 수 없고, 그 반대도 마찬가지다.

이 서버의 규칙은 그대로 따른다 — **얇은 프록시**다. 판단(권한·근거 필수·값→칸 환산·
동시 수정)은 전부 백엔드에 있고 여기선 REST 로 부르기만 한다. 인증도 같다: 사용자의
JWT 를 그대로 넘기므로 **화면에서와 똑같은 권한**이 걸린다(자기 사업부만 쓰기).

⚠️ 성숙도에는 **제안 큐가 없다.** 대시보드의 202(사람 승인 대기)는 여기서 안 나온다.
   대신 **근거(note)가 없으면 저장 자체가 거절**된다 — 그게 이 모듈의 안전장치다.
"""
from mcp.server.fastmcp import Context

# 성숙도는 블루프린트가 달라 접두사부터 갈린다 — 여기서 대시보드를 부를 수 없다.
MATURITY_PREFIX = "/api/dev-dt-maturity"


def register(mcp, request_fn):
    """성숙도 도구를 서버에 붙인다. `request_fn` 은 server.py 의 `_request`."""

    async def _m(ctx, method, path, *, params=None, json_body=None):
        out = await request_fn(ctx, method, path, params=params, json_body=json_body,
                               prefix=MATURITY_PREFIX)
        # 409 안내는 대시보드 것(get_project·rowVersion)이라 성숙도 말로 바꿔 준다.
        if isinstance(out, dict) and out.get("status") == "conflict":
            out = {**out, "hint": "maturity_get_pair 로 그 축의 assessed_at 을 다시 받아 "
                                  "base_assessed_at 에 넣고 재시도하세요. 남이 고친 값을 "
                                  "덮기 전에 무엇이 바뀌었는지 사용자에게 보여 주세요."}
        return out

    # ── 읽기 ────────────────────────────────────────────────────────────────

    @mcp.tool()
    async def maturity_describe(ctx: Context) -> dict:
        """[성숙도] 디지털 트윈 성숙도의 **뼈대** — 부문·축·칸·집계 규칙. **다른 성숙도 도구보다 먼저 부른다.**

        여기서 무엇을 알 수 있나
          · `sectors` — 부문 목록. 부문마다 **대상·수단의 이름이 다르다**(시뮬레이션은
            「시험 항목 × 시뮬레이션」, 모니터링은 「공정 × 수집 수단」, 디지털 스레드는
            수단 없이 「연계 구간」에 바로 매긴다). `active:false` 인 부문은 아직 척도가 없다.
          · `axes` — 부문마다 다른 평가 축과 그 **칸(rung) key**. 평가할 때 이 key 를 쓴다.
          · 축의 `kind` 가 갈림길이다:
              rung   — 칸 하나를 고른다(`rung`)
              value  — **값을 넣는다**(`value`). 칸은 서버가 문턱으로 정한다 — 칸을 직접
                       넣으면 거절된다(정확도가 둘이 되기 때문).
              set    — 여러 항목을 켠다(**`flags`** 목록 — `rung` 이 아니다)
              matrix — 바탕 토글 + 불량 유형 표. 이건 화면에서 다루는 것이 낫다.

        ⚠️ 이 모듈은 **대시보드 과제와 다른 것**이다. 과제·성과·KPI 를 찾는다면
           `list_projects` 쪽(접두사 없는 도구들)을 쓰세요.
        """
        return await _m(ctx, "GET", "/definitions")

    @mcp.tool()
    async def maturity_list_divisions(ctx: Context) -> list:
        """[성숙도] 성숙도를 매기는 사업부 목록. `deny_reason` 이 있으면 **읽기만** 되는 곳이다.

        성숙도에는 「전체」가 없다 — 모든 조회가 사업부 하나를 받는다.
        """
        return await _m(ctx, "GET", "/divisions")

    @mcp.tool()
    async def maturity_board(ctx: Context, division_id: int,
                             sector: str = "simulation") -> dict:
        """[성숙도] 한 사업부의 **판** — 대상 × 수단마다 축별 지금 칸. 성숙도를 읽는 기본 도구.

        `sector` 는 `maturity_describe` 의 부문 key(simulation · manufacturing_monitoring ·
        digital_thread …). 안 주면 시뮬레이션이다.

        돌아오는 각 연계에는 `pair_id` 가 있다 — 고치려면 그 id 로
        `maturity_get_pair` · `maturity_assess` 를 부른다.
        """
        return await _m(ctx, "GET", "/board",
                        params={"division_id": division_id, "sector": sector})

    @mcp.tool()
    async def maturity_list_items(ctx: Context, division_id: int, kind: str,
                                  sector: str = "simulation") -> list:
        """[성숙도] 그 사업부의 **대상**(kind='subject') 또는 **수단**(kind='agent') 목록.

        이름은 부문이 정한다 — 시뮬레이션에서 대상은 「시험 항목」, 수단은 「시뮬레이션」이고
        모니터링에서는 「공정」·「수집 수단」이다(`maturity_describe` 의 subject_label·agent_label).
        """
        if kind not in ("subject", "agent"):
            return {"status": "error", "message": "kind 는 subject(대상) · agent(수단) 중 하나입니다."}
        return await _m(ctx, "GET", f"/{kind}s",
                        params={"division_id": division_id, "sector": sector})

    @mcp.tool()
    async def maturity_get_pair(ctx: Context, pair_id: int) -> dict:
        """[성숙도] 연계 하나의 **상세** — 축별 지금 칸·근거·근거 자료·이력.

        각 축의 `assessed_at` 을 기억해 두었다가 `maturity_assess` 의 `base_assessed_at`
        으로 넘기면, 그 사이 남이 같은 축을 고쳤을 때 덮지 않고 409 로 알려 준다.
        """
        return await _m(ctx, "GET", f"/pairs/{pair_id}")

    @mcp.tool()
    async def maturity_changes(ctx: Context, division_id: int,
                               sector: str = "simulation", days: int = 365) -> dict:
        """[성숙도] 그 사업부에서 **무엇이 언제 올라갔나** — 축별 변화 이력.

        「지난 분기에 뭐가 좋아졌나」 같은 물음에 이걸 쓴다. 칸이 실제로 바뀐 것만 남는다
        (같은 값을 다시 저장한 것은 이력에 없다).
        """
        return await _m(ctx, "GET", "/changes",
                        params={"division_id": division_id, "sector": sector, "days": days})

    # ── 쓰기 ────────────────────────────────────────────────────────────────

    @mcp.tool()
    async def maturity_add_item(ctx: Context, division_id: int, kind: str, name: str,
                                sector: str = "simulation", detail: str = "",
                                fields: dict = None) -> dict:
        """[성숙도] 대상(subject) 또는 수단(agent)을 **새로 만든다.**

        `fields` 로 부문에 맞는 나머지를 함께 넣는다 —
          시뮬레이션 대상: product_families(목록) · accuracy_rule(auto·mean·single)
          시뮬레이션 수단: kind(구조·열…) · model_kind · tools(목록) · defect_types(목록)
          모니터링 대상: line(라인·사업장) · process(공정 단계 key)

        ⚠️ 이름이 같은 것이 이미 있으면 그것을 다시 쓰지 않고 **또 만든다** — 먼저
           `maturity_list_items` 로 있는지 보고 부르세요. 여럿을 한 번에 세울 때는
           `maturity_bulk` 가 낫다(그쪽은 같은 이름이면 다시 만들지 않는다).
        """
        if kind not in ("subject", "agent"):
            return {"status": "error", "message": "kind 는 subject(대상) · agent(수단) 중 하나입니다."}
        if sector == "digital_thread":
            # ⚠️ 스레드의 대상은 **구간**이라 만드는 길이 다르다. 여기로 만들면 스레드·
            #    출발·도착이 없는 쓸 수 없는 줄이 생긴다(2026-08-30 실측).
            return {"status": "error",
                    "message": "디지털 스레드는 대상이 「연계 구간」이라 이 도구로 만들지 않습니다.",
                    "hint": "maturity_add_segment 를 쓰세요 — 스레드·출발·도착까지 함께 세웁니다. "
                            "이 부문에는 수단(agent)도 없습니다."}
        body = {"division_id": division_id, "sector": sector, "name": name,
                **({"detail": detail} if detail else {}), **(fields or {})}
        return await _m(ctx, "POST", f"/{kind}s", json_body=body)

    @mcp.tool()
    async def maturity_add_segment(ctx: Context, division_id: int,
                                   segment_def_id: int = 0, name: str = "",
                                   fields: dict = None) -> dict:
        """[성숙도] **디지털 스레드의 구간**을 만든다 — 자료가 조직·시스템을 건너는 자리.

        스레드 부문은 대상이 구간이고 **수단이 없다**(구간에 바로 매긴다). 그래서
        `maturity_add_item` 이 아니라 이 도구를 쓴다 — 대상·연계·구간 속성이 한 번에 선다.

        `segment_def_id` 는 표준 구간(`maturity_threads` 의 각 스레드 안 `segments`)이다.
        고르면 이름과 「데이터 종류」 기본값이 따라온다. 안 고르면 `name` 이 필요하다.

        `fields` 에 넣는 것 — 전부 **id** 다(이름이 아니다):
          thread_id · from_org_id · from_system_id · via_system_id · to_org_id ·
          to_system_id · data_kinds(목록) · note
        조직·시스템 id 는 `maturity_thread_dicts` 로 찾는다.

        ⚠️ 매개 시스템이 「비시스템 매개」(메일·구두 등)면 연결 축은 첫 칸까지만 매겨진다 —
           시스템을 안 거치는 길이라 그렇다. 백엔드가 막아 준다.
        """
        body = {"division_id": division_id, **(fields or {})}
        if segment_def_id:
            body["segment_def_id"] = segment_def_id
        if name:
            body["name"] = name
        return await _m(ctx, "POST", "/segments", json_body=body)

    @mcp.tool()
    async def maturity_threads(ctx: Context) -> list:
        """[성숙도] 표준 **스레드와 그 구간** 정의 — 디지털 스레드에서 구간을 세울 재료.

        각 스레드 안의 `segments[].id` 가 `maturity_add_segment` 의 `segment_def_id` 다.
        """
        return await _m(ctx, "GET", "/threads")

    @mcp.tool()
    async def maturity_thread_dicts(ctx: Context, division_id: int) -> dict:
        """[성숙도] 디지털 스레드의 **사전** — 시스템(전사)과 조직(그 사업부).

        구간을 세울 때 출발·매개·도착에 넣을 **id** 를 여기서 찾는다.
        조직은 포탈 부서를 저절로 따르고, 포탈에서 없어진 것은 `gone` 으로 표시된다.
        """
        systems = await _m(ctx, "GET", "/systems")
        orgs = await _m(ctx, "GET", "/orgs", params={"division_id": division_id})
        return {"systems": systems, "orgs": orgs}

    @mcp.tool()
    async def maturity_update_item(ctx: Context, kind: str, item_id: int,
                                   fields: dict) -> dict:
        """[성숙도] 대상·수단의 **속성을 고친다.** `fields` 에 바꿀 것만 담는다.

        ⚠️ 사업부를 옮기면 걸려 있던 연계가 어긋난다 — 백엔드가 막는다.
        """
        if kind not in ("subject", "agent"):
            return {"status": "error", "message": "kind 는 subject(대상) · agent(수단) 중 하나입니다."}
        return await _m(ctx, "PUT", f"/{kind}s/{item_id}", json_body=fields or {})

    @mcp.tool()
    async def maturity_link(ctx: Context, subject_id: int, agent_id: int = 0) -> dict:
        """[성숙도] 대상 × 수단을 **잇는다.** 평가는 이 연계에 쌓인다.

        디지털 스레드처럼 수단이 없는 부문은 `agent_id` 를 비운다(대상에 바로 매긴다).

        ⚠️ 대상과 수단은 **같은 사업부·같은 부문**이어야 한다 — MX 의 시험에 VD 의
           시뮬레이션을 걸면 어느 사업부의 평가인지가 사라진다.
        """
        body = {"subject_id": subject_id}
        if agent_id:
            body["agent_id"] = agent_id
        return await _m(ctx, "POST", "/pairs", json_body=body)

    @mcp.tool()
    async def maturity_assess(ctx: Context, pair_id: int, axis: str, note: str,
                              rung: str = "", value: float = None,
                              flags: list = None, evidence: dict = None,
                              base_assessed_at: str = "") -> dict:
        """[성숙도] 연계의 한 축을 **매긴다.** 이 모듈의 핵심 도구.

        ⚠️ **`note`(근거)가 없으면 저장되지 않는다.** 올릴 때도 내릴 때도 마찬가지다 —
           근거 없는 칸은 인상평이라 이 모듈이 일부러 막는다. 「어디서 확인했는지」를
           사람의 말로 적으세요. 사용자가 근거를 주지 않았으면 **묻고 나서** 부르세요.

        축의 kind 에 따라 넣는 것이 다르다(`maturity_describe` 로 먼저 확인):
          rung   → `rung` 에 칸 key 하나
          value  → `value` 에 숫자(정확도는 %). **칸은 넣지 않는다** — 서버가 사업부
                   문턱으로 정한다. 칸을 직접 넣으면 거절된다.
          set    → **`flags`** 에 켤 항목 key 목록(`rung` 이 아니다 — 묶음이라 여럿을 켠다)
          matrix → 화면에서 다루세요(불량 유형 × 열 표라 도구로 다루기에 나쁘다).

        `evidence` 는 축이 요구하는 근거 자료다(예: 정확도의 compared_tests·error_pct,
        자동화의 hours_per_run). `maturity_describe` 의 축마다 `evidence` 에 이름이 있다.

        `base_assessed_at` 에 `maturity_get_pair` 에서 받은 그 축의 `assessed_at` 을 넣으면,
        그 사이 남이 같은 축을 고쳤을 때 **덮지 않고** 409 로 알려 준다. 여럿이 함께 쓰는
        자료라 넣는 편이 좋다.
        """
        if not (note or "").strip():
            return {"status": "error",
                    "message": "근거(note)가 필요합니다 — 이 모듈은 근거 없는 평가를 저장하지 않습니다.",
                    "hint": "무엇을 보고 그렇게 판단했는지 사용자에게 물어보고 다시 부르세요."}
        body = {"note": note}
        if rung:
            body["rung"] = rung
        if value is not None:
            body["value"] = value
        if flags:
            body["flags"] = flags
        if evidence:
            body["evidence"] = evidence
        if base_assessed_at:
            body["base_assessed_at"] = base_assessed_at
        return await _m(ctx, "PUT", f"/pairs/{pair_id}/assessments/{axis}", json_body=body)

    @mcp.tool()
    async def maturity_bulk(ctx: Context, division_id: int, kind: str, text: str,
                            sector: str = "simulation", dry_run: bool = True) -> dict:
        """[성숙도] 표를 붙여넣어 **여럿을 한 번에** 세운다 — 처음 자료를 채울 때 이게 가장 빠르다.

        `kind` 는 부문마다 다르다. **먼저 `maturity_bulk_kinds` 로 어떤 갈래에 어떤 열이
        필요한지 받으세요** — 머리글이 다르면 그 열이 비워진다.

        `text` 는 머리글 한 줄 + 자료 줄들, 탭이나 쉼표로 나눈다. 화면의 「데이터 › 추출」이
        내보내는 것과 같은 꼴이다.

        ⚠️ `dry_run=True`(기본)는 **저장하지 않고** 줄마다 어떻게 될지만 돌려준다.
           먼저 이걸로 보고, 오류 줄이 없는지 사용자에게 보여 준 뒤 `dry_run=False` 로
           다시 부르세요. 같은 이름이 이미 있으면 다시 만들지 않는다(멱등).
        """
        return await _m(ctx, "POST", "/bulk",
                        json_body={"division_id": division_id, "sector": sector,
                                   "kind": kind, "text": text, "dry_run": dry_run})

    @mcp.tool()
    async def maturity_bulk_kinds(ctx: Context, division_id: int,
                                  sector: str = "simulation") -> list:
        """[성숙도] `maturity_bulk` 에 쓸 **갈래와 열 이름**, 그리고 열마다 고를 수 있는 값.

        `choices` 가 있는 열은 **정해진 값**이라 아무 글자나 적으면 그 칸이 비워진다.
        표를 만들기 전에 이걸 먼저 읽으세요.
        """
        return await _m(ctx, "GET", "/bulk/kinds",
                        params={"division_id": division_id, "sector": sector})
