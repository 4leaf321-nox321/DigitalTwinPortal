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

    def _slim_axes(axes):
        """축은 key·이름·종류·칸 목록만 — 묻는 말과 칸 설명은 describe 가 준다."""
        return [{"key": a["key"], "label": a["label"], "kind": a["kind"],
                 "rungs": [r["key"] for r in a.get("rungs") or []]}
                for a in axes or []]

    def _slim_cell(v):
        """평가 하나 — 「지금 어느 칸인가」만. 근거·근거 자료·누가 언제는 get_pair 로."""
        if not v:
            return None
        out = {}
        if v.get("value") is not None:
            out["value"] = v["value"]
        if v.get("rung"):
            out["rung"] = v["rung"]
        if v.get("stale"):
            out["stale"] = True                      # 재평가 필요
        if v.get("unknown"):
            out["unknown"] = True                    # 「모름」 — 확인이 필요한 상태
        return out or None

    def _compact_board(b):
        """판을 AI 가 읽을 수 있는 크기로. `full=True` 면 통짜 그대로."""
        subjects = []
        for s in b.get("subjects") or []:
            pairs = []
            for p in s.get("pairs") or []:
                cells = {k: _slim_cell(v) for k, v in (p.get("assessments") or {}).items()}
                pairs.append({"pair_id": p.get("id"),
                              "agent_id": p.get("agent_id"),
                              "agent_name": (p.get("agent") or {}).get("name"),
                              "at": {k: v for k, v in cells.items() if v},
                              "unassessed": p.get("unassessed") or []})
            row = {"subject_id": s.get("id"), "name": s.get("name"), "pairs": pairs}
            for f in ("detail", "line", "process_label"):
                if s.get(f):
                    row[f] = s[f]
            subjects.append(row)
        return {"division_id": b.get("division_id"), "sector": b.get("sector"),
                "deny_reason": b.get("deny_reason"), "stale_days": b.get("stale_days"),
                "totals": b.get("totals"), "axes": _slim_axes(b.get("axes")),
                "subjects": subjects,
                "note": "간추린 판입니다 — 근거·근거 자료·이력은 maturity_get_pair 로, "
                        "축의 묻는 말과 칸 설명은 maturity_describe 로 보세요. "
                        "통짜가 필요하면 full=True."}

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
                             sector: str = "simulation", full: bool = False) -> dict:
        """[성숙도] 한 사업부의 **판** — 대상 × 수단마다 축별 지금 칸. 성숙도를 읽는 기본 도구.

        `sector` 는 `maturity_describe` 의 부문 key(simulation · manufacturing_monitoring ·
        digital_thread …). 안 주면 시뮬레이션이다.

        각 연계에 `pair_id` 가 있다 — 고치려면 그 id 로 `maturity_assess` 를 부른다.
        `at` 이 축별 지금 칸이고, `unassessed` 는 아직 안 매긴 축이다.

        ⚠️ 기본은 **간추린 판**이다. 근거 글·근거 자료·누가 언제는 빠져 있다 — 그건
           `maturity_get_pair` 로 그 연계 하나만 열어 보세요. 사업부에 연계가 백 개면
           통짜는 40만 자가 넘어 통째로 읽을 수 없다. 정말 필요할 때만 `full=True`.
        """
        out = await _m(ctx, "GET", "/board",
                       params={"division_id": division_id, "sector": sector})
        if full or not isinstance(out, dict) or "subjects" not in out:
            return out
        return _compact_board(out)

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
                               sector: str = "simulation", days: int = 365) -> list:
        """[성숙도] 그 사업부에서 **무엇이 언제 올라갔나** — 축별 변화 이력의 **목록**.

        「지난 분기에 뭐가 좋아졌나」 같은 물음에 이걸 쓴다. 줄마다 시험 항목·시뮬레이션·
        축·before→after·근거·누가·언제가 들어 있어 그대로 사람에게 보고할 수 있다.

        칸이 **실제로 바뀐 것만** 남는다(같은 값을 다시 저장한 것은 이력에 없다).
        정확도 같은 값 축만 예외로 저장마다 한 줄 쌓인다 — 값의 흐름이 곧 이야기라서다.
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
          matrix → 두 손잡이다. **바탕**(형상 재현·거동 재현)은 여기 `flags` 로 켜고,
                   **불량 유형 표**는 `maturity_set_defect` 로 칸마다 적는다.

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
    async def maturity_set_defect(ctx: Context, pair_id: int, axis: str, name: str,
                                  col: str, month: str = "") -> dict:
        """[성숙도] **모델링 수준의 불량 유형 표** 칸 하나 — 「그 불량을 재현하는가」.

        `name` 은 그 시뮬레이션의 불량 유형(예: 크랙·변색). **시뮬레이션에 없는 유형은
        못 적는다** — `maturity_update_item` 으로 `defect_types` 에 먼저 넣으세요.
        `col` 은 `test`(신뢰성 시험 불량) 또는 `market`(시장 불량).
        `month` 는 재현한 연-월(`2026-03`). **비우면 그 칸을 끈다.**

        ⚠️ 여기만 근거를 안 받는다 — 칸 하나가 곧 사실이라(재현했나 아닌가) 이력에
           무엇이 켜졌는지가 그대로 남는다. 축의 서열은 표가 얼마나 찼는지로 접힌다.
        """
        if col not in ("test", "market"):
            return {"status": "error", "message": "col 은 test(시험 불량) · market(시장 불량) 중 하나입니다."}
        return await _m(ctx, "PUT", f"/pairs/{pair_id}/defects/{axis}",
                        json_body={"name": name, "col": col, "month": month or None})

    @mcp.tool()
    async def maturity_reached(ctx: Context, pair_id: int, axis: str, rung: str,
                               month: str) -> dict:
        """[성숙도] 그 칸에 **언제 올라왔는지**를 적는다 — 옛 자료를 넣을 때 쓴다.

        `month` 는 연-월(`2025-03`). 이력의 날짜가 그 달로 옮겨지고, 그 칸을 만든 이력이
        없으면 하나 만든다(근거는 「시점 적기」).

        ⚠️ 이게 없으면 옛 자료가 **전부 오늘 날짜로** 쌓여 「변화」 화면이 뜻을 잃는다.
        ⚠️ **지금 칸보다 위의 칸에는 못 적는다** — 아직 안 올라온 칸의 시점은 뜻이 없다.
           정확도 같은 값 축도 안 된다(값을 저장할 때 `assessed_at` 으로 넣으세요).
        """
        return await _m(ctx, "PUT", f"/pairs/{pair_id}/reached/{axis}/{rung}",
                        json_body={"month": month})

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


    # ── 건 기록 — 척도가 상태라면 이쪽은 사건이다 ────────────────────────────
    #
    # ⚠️ 둘은 **서로 다른 것을 센다.** 척도는 「지금 어디까지 왔나」(연계마다 하나,
    #    갱신됨)이고 기록은 「무엇을 했나」(건마다 한 줄, 쌓임)다. 기록을 척도처럼
    #    고치려 하거나 그 반대로 하면 둘 다 뜻을 잃는다.

    _REC = {"review": ("/reviews", "해석 활용 기록"),
            "thread_case": ("/thread-cases", "연계 개발 기록")}

    def _rec_path(kind):
        row = _REC.get(kind)
        return row[0] if row else None

    @mcp.tool()
    async def maturity_list_records(ctx: Context, kind: str, division_id: int,
                                    year: int = 0, filter_by: str = "") -> list:
        """[성숙도] **건 기록** 목록 — 척도가 아니라 「무엇을 했나」.

        `kind`
          `review`      해석 활용 기록 — 시험과 짝이 없는 스팟성 해석(설계 스펙 검토·원인 분석).
                        `filter_by` 에 종류 key 를 주면 그것만.
          `thread_case` 연계 개발 기록 — 연동·도입·정합화·자동화·폐지 건.
                        `filter_by` 에 상태(planned·doing·done)를 주면 그것만.

        `year` 를 비우면 그 사업부의 전부. `division_id` 는 `thread_case` 에 한해
        `0` 이면 전사다(연계 개발은 전사로도 본다).
        """
        path = _rec_path(kind)
        if not path:
            return {"status": "error", "message": "kind 는 review(해석 활용) · thread_case(연계 개발) 중 하나입니다."}
        params = {"division_id": "all" if (division_id == 0 and kind == "thread_case") else division_id}
        if year:
            params["year"] = year
        if filter_by:
            params["kind" if kind == "review" else "status"] = filter_by
        return await _m(ctx, "GET", path, params=params)

    @mcp.tool()
    async def maturity_record_stats(ctx: Context, kind: str, division_id: int,
                                    year: int = 0) -> dict:
        """[성숙도] 건 기록의 **연간 셈** — 이게 이 기록들을 두는 이유다.

        `review` — 종류마다 건수 · 「스펙 확정 전 이상」% · 「관문 이상」% · 「검증됨」% ·
          리드타임 중앙값, 그리고 **정착 후보**(같은 시뮬레이션 × 항목이 여러 번 되풀이된 것).
          정착 후보는 `maturity_promote_review` 로 상시 시험 항목으로 올린다.
        `thread_case` — 상태별·무엇을별 건수와 올라간 칸 수.

        `division_id` 를 `0` 으로 주면 전 사업부를 한 번에 준다.
        `year` 를 비우면 올해.
        """
        path = _rec_path(kind)
        if not path:
            return {"status": "error", "message": "kind 는 review · thread_case 중 하나입니다."}
        params = {"division_id": "all" if division_id == 0 else division_id}
        if year:
            params["year"] = year
        return await _m(ctx, "GET", f"{path}/stats", params=params)

    @mcp.tool()
    async def maturity_add_record(ctx: Context, kind: str, division_id: int,
                                  fields: dict) -> dict:
        """[성숙도] 건 기록 한 줄을 **적는다.**

        `review` 에 넣는 것 — month(`2026-03`) · kind(spec·cause) · target(제품·과제) ·
          item(스펙 항목/불량 유형) · agent_id 또는 agent_name(쓴 시뮬레이션) ·
          timing · decision · basis · lead_days(리드타임, 일) · note
        `thread_case` 에 넣는 것 — month · action(무엇을) · status · thread_id ·
          segment_id · system_id 또는 system_name · org_id · link_from · link_to · note

        고를 수 있는 값(timing·decision·basis·action·status 등)은 `maturity_describe` 의
        `review` · `thread` 에 있다. **거기 없는 값은 거절된다.**

        ⚠️ 같은 건을 두 번 적어도 막지 않는다 — 기록은 사건이라 겹칠 수 있어서다.
           넣기 전에 `maturity_list_records` 로 이미 있는지 보세요.
        """
        path = _rec_path(kind)
        if not path:
            return {"status": "error", "message": "kind 는 review · thread_case 중 하나입니다."}
        return await _m(ctx, "POST", path, json_body={"division_id": division_id, **(fields or {})})

    @mcp.tool()
    async def maturity_update_record(ctx: Context, kind: str, record_id: int,
                                     fields: dict) -> dict:
        """[성숙도] 건 기록 한 줄을 **고친다.** `fields` 에 바꿀 것만 담는다."""
        path = _rec_path(kind)
        if not path:
            return {"status": "error", "message": "kind 는 review · thread_case 중 하나입니다."}
        return await _m(ctx, "PUT", f"{path}/{record_id}", json_body=fields or {})

    @mcp.tool()
    async def maturity_promote_review(ctx: Context, division_id: int, agent_name: str,
                                      item: str, subject_name: str = "",
                                      make_agent: bool = False) -> dict:
        """[성숙도] **정착 후보를 상시 시험 항목으로 올린다** — 되풀이되는 해석은 척도로 관리한다.

        `maturity_record_stats(kind='review')` 의 `promote` 에서 짝(`agent_name` × `item`)을
        가져와 부른다. 시험 항목 × 시뮬레이션 연계가 서고, 그 뒤로는 `maturity_assess` 로 매긴다.

        `subject_name` 으로 시험 항목 이름을 고칠 수 있다 — 기록의 「항목」은 스펙 항목·
        불량 유형이라 시험 항목 이름과 결이 다를 수 있다.
        시뮬레이션이 사전에 없으면 거절된다 — 만들려면 `make_agent=True`.

        ⚠️ **평가는 만들지 않는다.** 연계만 세운다 — 근거는 사람이 적는다.
        ⚠️ 올려도 그 기록들은 남는다(「올림」 표가 붙고 후보에서만 빠진다).
        """
        return await _m(ctx, "POST", "/reviews/promote",
                        json_body={"division_id": division_id, "agent_name": agent_name,
                                   "item": item, "subject_name": subject_name or None,
                                   "make_agent": make_agent})

    # ── 스레드 사전 쓰기 — 읽기만 되면 구간을 처음부터 못 세운다 ──────────────

    @mcp.tool()
    async def maturity_add_system(ctx: Context, name: str, kind: str,
                                  fields: dict = None) -> dict:
        """[성숙도] 시스템 사전에 하나 **더한다** — 구간의 출발·매개·도착에 쓸 것.

        ⚠️ 시스템 사전은 **전사 하나**다(사업부별이 아니다). 그래서 **같은 이름이 이미
           있으면 거절된다**(400) — 사업부마다 같은 PLM 을 따로 세우면 스레드가 갈라진다.
           먼저 `maturity_thread_dicts` 로 찾아보고, 있으면 그 id 를 쓰세요.
           표기가 다른 같은 시스템(Teamcenter/TC)을 둘 다 세웠다면 합치는 것은 사무국이
           화면에서 한다 — 여기엔 합치기 도구를 두지 않았다(구간이 딸려 옮겨간다).

        `kind` 는 `maturity_describe` 의 `thread.system_kinds` 에서 고른다.
        `fields` — owner_org(주관 조직) · stages(생애 단계 목록) · link_means(API 있음·
        파일 배치·없음·미확인) · status(운영·도입 중·폐지 예정) · note
        """
        body = {"name": name, "kind": kind, **(fields or {})}
        return await _m(ctx, "POST", "/systems", json_body=body)

    @mcp.tool()
    async def maturity_update_system(ctx: Context, system_id: int, fields: dict) -> dict:
        """[성숙도] 시스템 사전의 한 줄을 **고친다** — 연계 수단이 생겼거나 폐지 예정이 됐을 때.

        ⚠️ 종류·이름을 고치는 것은 사무국만 된다(전사가 함께 쓰는 사전이라). 403 이 오면
           그대로 사용자에게 전하세요.
        """
        return await _m(ctx, "PUT", f"/systems/{system_id}", json_body=fields or {})

    @mcp.tool()
    async def maturity_add_org(ctx: Context, division_id: int, name: str,
                               role: str = "") -> dict:
        """[성숙도] 조직 사전에 하나 **더한다** — 구간의 출발·도착 조직.

        ⚠️ **포탈 부서는 저절로 들어온다.** 여기 쓰는 것은 부서 표에 없는 조직
           (협력사·태스크포스 등)이다. 먼저 `maturity_thread_dicts` 로 보세요.
           같은 사업부에 같은 이름이 있으면 **조용히 있는 것을 준다**(시스템과 다르다) —
           그래서 두 번 불러도 늘지 않지만, 새로 만들었는지는 id 로 확인해야 한다.

        `role` 은 그 조직이 주로 서 있는 생애 단계(`maturity_describe` 의 `thread.stages`).
        """
        body = {"division_id": division_id, "name": name}
        if role:
            body["role"] = role
        return await _m(ctx, "POST", "/orgs", json_body=body)

    @mcp.tool()
    async def maturity_bulk_kinds(ctx: Context, division_id: int,
                                  sector: str = "simulation") -> list:
        """[성숙도] `maturity_bulk` 에 쓸 **갈래와 열 이름**, 그리고 열마다 고를 수 있는 값.

        `choices` 가 있는 열은 **정해진 값**이라 아무 글자나 적으면 그 칸이 비워진다.
        표를 만들기 전에 이걸 먼저 읽으세요.
        """
        return await _m(ctx, "GET", "/bulk/kinds",
                        params={"division_id": division_id, "sector": sector})
