# Digital Twin Dashboard — MCP 서버

Claude Code · Gemini CLI 같은 **외부 AI**가 디지털 트윈 과제를 조회·수정하게 하는 MCP 서버.

> 🚦 이 프로젝트에는 이름이 비슷한 AI 갈래가 **여섯**이다(`ai_tools.py` 와 `ai/agent_tools.py`
> 는 같은 폴더에 나란히 있다). AI 작업을 시작하기 전에 루트
> **`디지털트윈_AI기능_지도.md`** 를 먼저 볼 것.

**이게 V2 정규화를 한 원래 목적이다.** 싱글톤 JSON 한 덩어리로는 AI 가 과제 한 건을
집어 고칠 수가 없었다.

> 참고 구현: WSL `/home/yongjin/projects/ReportArchive/mcp_server/` — 같은 패턴을 따른다.

---

# 만든 것 (2026-08-03 · 개발 실측 완료 · **2026-08-07 운영 반영**)

> ⚠️ 코드는 나갔지만 **상시 기동은 아직 안 정했다** — 콘솔에서 띄우므로
> **창을 닫거나 서버가 재부팅되면 죽는다.** 아래 「먼저 할 일」 참고.

## 한눈에

```
Claude Code ──PAT──> MCP 서버(3003) ──REST+PAT──> DT 백엔드(5174) ──> dt2_*
                     도구 18개           판단은 전부 여기서
```

| 층 | 무엇 | 어디 |
|---|---|---|
| **MCP 서버** | 도구 18개, 헤더 전달만 하는 얇은 대리인 | `mcp_server/server.py` |
| **필드 안내** | 무엇을 고칠 수 있고 위험도가 뭔지 | `…/digital_twin_dashboard/ai_tools.py` |
| **인증(PAT)** | 발급·검증·폐기 | `app/modules/auth/pat.py` |
| **인증 갈림길** | JWT / PAT 을 접두사로 가른다 | `app/shared/auth.py` |
| **발급 화면** | 계정 관리 ▸ MCP 연결 | `frontend/…/auth/components/McpTokenSection.jsx` |
| **사용 안내(스킬)** | AI 가 지킬 절차 | `skill/digitaltwin/SKILL.md` |
| **오프라인 설치** | wheel 번들 + 설정 스크립트 | `packages/` · `setup_venv.bat`·`.ps1` |
| **DB** | `personal_access_tokens` (추가만) | 마이그레이션 `860bcaf47aa8` |

## MCP 도구 39개

읽기 11 · 쓰기 5 · 확인 2 · **기술정보 11**(2026-08-25 추가). **위험도 판단은 백엔드가 한다** — 여기서 하지 않는다
(규칙이 두 곳에 있으면 반드시 갈라진다).

> **생성(`create_project`·`create_performance`)만 확인 절차가 없다.** 기존 값을 덮지 않고
> 더하기만 해서 잃는 것이 없고, 아직 행이 없어 before → after 를 보여줄 대상 자체가 없기
> 때문이다. 대신 **부르기 전에 사용자에게 보여주고 묻도록** 도구 설명과 스킬에 못 박았고,
> 변경 이력에 `source='ai'` 로 남겨 나중에 골라낼 수 있게 했다.

**과제 (9)**

| 도구 | 하는 일 |
|---|---|
| `describe_fields` | **고치기 전에 반드시 먼저.** 필드·위험도·선택지 |
| `create_project` | **새 과제 생성.** 확인 대기가 없다 — 부르면 바로 만들어진다 |
| `list_projects` | 과제 목록 (`q`·`status`·`year`·`mine_only`·`editable_only`) |
| `get_project` | 과제 1건 + `rowVersion` + `canEdit` |
| `get_project_changes` | 누가 무엇을 바꿨나 (필드 단위 · 2026-07-31 이후) |
| `get_project_history` | 진척 지표가 어떻게 변했나 (2026-07-29 이후) |
| `find_people` | 이름 → **knoxId**. 사람 필드를 넣기 전에 부른다 |
| `list_proposals` | 확인 대기 중인 변경 |
| `patch_project` | 수정. 저위험=즉시 / 핵심=202 + `preview` |

**성과 (7 · 2026-08-02 추가)**

| 도구 | 하는 일 |
|---|---|
| `describe_performance_fields` | **과제와 표가 다르다.** 성과를 건드리기 전에 먼저 |
| `list_performances` | 성과 목록 (`q`·`year`·`category`) |
| `get_performance` | 성과 1건 + `rowVersion` + **`affectedProjects`** |
| `list_project_performances` | 과제에 붙은 성과. **`link_performances` 전에 필수** |
| `create_performance` | **새 성과 생성.** 확인 대기가 없다 |
| `patch_performance` | 수정. 저위험=즉시 / **핵심=403**(202 아님) |
| `link_performances` | 과제-성과 연결 **통째 교체**. 202 + `affectedProjects` |

**분석·관계도 (3)** — 2026-08-12 추가. **전부 읽기 전용**

| 도구 | 하는 일 |
|---|---|
| `analyze` | **분석 10종을 하나로.** `kind=` gaps · risky · stalled · schedule · issues · hidden · key_projects · divisions · readiness · kpi |
| `get_graph` | 관계도 원본. ⚠️ 노드가 수백 개라 통째로 늘어놓지 말 것 |
| `get_graph_options` | 고를 수 있는 연도·사업부·레이어 |

> 도구를 10개로 쪼개지 않고 `analyze` 하나로 묶었다 — 인자가 같고 답의 성격만
> 다른데 종류마다 도구를 만들면 목록이 30개를 넘어 **모델이 고르기부터 어려워진다.**
>
> **계산은 전부 서버에 있다.** `graph_agent.py` 에는 `llm` 이라는 글자가 없어
> 그 파일의 모든 값이 결정적이다 — AI 는 숫자를 다시 만들지 말고 그대로 전한다.
> 답할 때 `coverage`·`note`(판단하지 않은 과제 수, 참여인력 연결률)를 **먼저**
> 말해야 한다. 빼고 말하면 과장이 된다.

**KPI 연결 · 선행 과제 · 추이 (4)** — 2026-08-12 추가

| 도구 | 하는 일 |
|---|---|
| `get_project_kpi_links` | 과제의 DX KPI 연결 (기여등급·기여방법) — **읽기만** |
| `get_kpi_matrix` | KPI × 사업부 매트릭스 원재료 (집계 전) |
| `set_project_kpi_links` | KPI 연결 **통째 교체 제안.** 항상 202 · `reason` 필수 |
| `get_project_dependencies` | 선행 과제 연결 — **읽기만** |
| `get_trend` | 시계열. `kind=` projects · performances · changes · notes |

> ✅ **KPI 연결이 2026-08-12 에 열렸다 — 금지가 아니라 근거+승인으로.**
>
> 원래 `actor_mode='ai'` 는 **403** 이었다. 이유는 *"이 과제가 무엇에 기여하는가" 는
> 사람이 선언하는 값이고, AI 가 추측으로 채우면 **매트릭스의 빈칸(=계획의 구멍)이
> 가짜로 메워진다"* 였다. 그 우려를 **없애는 쪽**으로 바꿨다 —
> 과제-성과 연결이 지나간 길 그대로다(그쪽도 같은 종류의 우려로 403 이었다).
>
> · 항상 **202**. 즉시 반영되지 않고 사람이 승인해야 들어간다
> · **`reason` 필수** — 근거 없는 제안은 아예 만들지 않는다(400). 이것이
>   "추측으로 채우는 것" 을 막는 실질적인 장치다
> · preview 에 **지표 이름·대상 사업부·기여 등급**을 다 싣는다. id 만 보여주면
>   승인이 형식이 되고 원래 우려가 그대로 돌아온다
> · 대상 사업부 규칙(`_resolve_link_target`)은 **제안을 만들기 전에** 걸린다 —
>   규칙에 어긋난 조합은 대기 목록에조차 쌓이지 않는다
>
> 회귀는 `dt3_test_kpi_ai_propose.py` 가 잡는다(완화가 구멍이 되지 않았는지).
>
> ⛔ **선행 과제는 여전히 읽기만.** `actor_mode='ai'` 가 403 이다.
> ⛔ **KPI 일괄 편집은 PAT 자체를 막는다** — 한 번의 오조작이 N배로 번진다.
>    과제별로 하나씩 제안할 것.
>
> `get_trend` 로 답할 때 **2026-07-29 이전 기간은 없다** 고 반드시 말할 것.
> 이력 수집이 그날 시작됐고 소급 생성은 불가능하다.

**공통 (2)**

| 도구 | 하는 일 |
|---|---|
| `confirm_change` | 확인받은 변경을 반영 |
| `cancel_change` | 취소 |

> **삭제 전용 도구는 두지 않았다.** 다만 **과제는 `patch_project` 의 `_deleted` 로
> 휴지통에 넣을 수 있다**(핵심 필드라 202 → 확인 → 반영). 되돌릴 수 있어서 열어 뒀다.
>
> **영구삭제와 성과 삭제는 막혀 있다.**
> · `_permanentlyDeleted` 는 **immutable** — 전용 라우트(admin·dt_office)로만.
>   되돌릴 수 없고 휴지통에도 안 남는다. (2026-08-05 수정 — 아래 참고)
> · 성과는 핵심 필드가 전부 403 이라 삭제도 막힌다. 성과를 지우면 그 성과를 쓰던
>   **모든 과제의 연결이 함께** 사라지고, 복구해도 연결은 돌아오지 않는다.

#### 🐞 영구삭제가 열려 있었다 (2026-08-05 수정)

`_permanentlyDeleted` 가 **핵심 필드**였다. 즉 `patch_project` 로 보내면 202 로 가고
`confirm_change` 하면 **영구삭제가 됐다.** 실측으로 확인한 것이 둘이다:

- admin 이 아니라 **그 과제를 고칠 수 있는 일반 사용자**(role=user 소유자)로도 됐다.
- 전용 라우트 `permanent_delete_project` 는 **admin·dt_office 전용**이다.

같은 일에 권한 기준이 두 곳에 있었고 **느슨한 쪽으로 샜다.** 확인 절차로 감쌀 수 있는
종류가 아니라고 보고(되돌릴 수 없다) `IMMUTABLE_FIELDS` 로 내려 **경로를 하나로 모았다.**
화면은 이 필드를 보내지 않아 영향이 없다(전수 확인). 회귀는 분류(`dt3_test_describe`)와
동작(`dt3_test_proposals` ④-4) 양쪽에 못 박았다.

### 디지털 트윈 기술정보 (9) — 2026-08-25

```
describe_intel            무엇을 고를 수 있나 (분류ㆍ부채꼴ㆍ단계ㆍCPT). **넣기 전에 먼저**
list_intel_news           모여 있는 소식 (본문은 안 옴)
get_intel_news            소식 하나 + **보관된 원문**
add_intel_news            ★ 조사한 소식을 밀어 넣는다 — 이 모듈의 주 입구
list_intel_tech           기술 레이더 (근거 수ㆍ낡음 표시 포함)
get_intel_tech_evidence   그 기술을 떠받치는 소식들
add_intel_tech            기술만 따로 올린다 (보통은 add_intel_news 를 쓴다)
update_intel_tech         빈 요약ㆍ링크를 채운다
link_intel_evidence       이미 있는 소식과 기술을 잇는다
unlink_intel_evidence     잘못 걸린 근거를 끊는다 — **무를 수 있어야 쓴다**
list_intel_changes        단계가 바뀐 기록 (왜 지금 이 단계인지)
```

⚠️⚠️ **이 도구들이 그 모듈의 주 입구다.** 포털 서버는 인터넷에 못 나간다(바깥 호출이
   사내 LLM 하나뿐). 소식을 **긁어올 수 없다** — 웹을 읽을 수 있는 것은 바깥에서 도는
   AI 뿐이라, 조사한 결과를 밀어 넣어야 쌓인다.

⚠️ `add_intel_news` 의 **`technologies` 를 비우지 말 것.** 그 소식이 말하는 기술을 함께
   보내면 레이더에 자동으로 올라가고(처음 보는 것은 「관찰」), 이미 있으면 **별칭까지
   맞춰 같은 줄에 이어 붙는다.** 이게 레이더를 살리는 장치다 — 그 자리는 세 번 시도됐다가
   세 번 다 죽었고(`tech_radar`ㆍ`tech_archive`ㆍ`digital_twin_solution`), 이유가
   **기술 목록이 아무의 일도 아니어서**였다.

⚠️ **`body` 에 원문을 담을 것.** 링크는 썩는다 — 회사가 글을 내리면 6개월 뒤엔 제목만
   남는다. AI 는 페이지를 읽을 수 있으니 읽은 본문을 그대로 넣어 두면 조직이 나중에도 읽는다.

⚠️ **단계(도입/시험/관찰/보류)는 MCP 로 못 바꾼다.** 조직의 판단이라 관리자ㆍ사무국이
   화면에서 한다. 새 기술은 늘 「관찰」로 시작한다.

⚠️ 쓰기 도구는 `origin: "mcp"` 를 함께 보낸다. **안 보내면 「사람이 손으로 적음」으로
   남아** 사람이 확인한 것과 AI 가 조사한 것을 못 가른다(2026-08-25 실측으로 잡음).

## 디지털 트윈 **성숙도** 도구 12개 (2026-08-30)

`maturity_tools.py` — **대시보드와 다른 모듈**이라 파일부터 갈라 뒀다. 저쪽은 「과제가
어떻게 되어 가나」이고 여기는 「시험 하나에 대해 시뮬레이션이 어디까지 왔나」다.

섞이지 않게 하는 세 가지
1. **이름** — 전부 `maturity_` 로 시작한다. 도구 목록에서 한눈에 갈린다.
2. **파일** — 이 파일에만 있다. `server.py` 는 `maturity_tools.register(mcp, _request)` 한 줄.
3. **접두사** — 백엔드 블루프린트가 다르다(`/api/dev-dt-maturity`). 여기서 `/api/dt-v2` 를
   부를 수 없고 그 반대도 같다. 회귀시험이 이걸 강제한다.

| 도구 | 하는 것 |
|---|---|
| `maturity_describe` | 부문·축·칸·집계 규칙. **다른 성숙도 도구보다 먼저 부른다** |
| `maturity_list_divisions` | 사업부 — `deny_reason` 이 있으면 읽기만 |
| `maturity_board` | 사업부 판 — 대상 × 수단마다 축별 지금 칸 |
| `maturity_list_items` | 대상(subject)·수단(agent) 목록 |
| `maturity_get_pair` | 연계 상세 — 축별 칸·근거·이력 |
| `maturity_changes` | 무엇이 언제 올라갔나 |
| `maturity_add_item` | 대상·수단 만들기 |
| `maturity_update_item` | 대상·수단 고치기 |
| `maturity_link` | 대상 × 수단 잇기 |
| `maturity_assess` | **한 축을 매긴다** — 근거 필수 |
| `maturity_bulk` | 표를 붙여넣어 여럿을 한 번에(먼저 dry_run) |
| `maturity_bulk_kinds` | 그 표에 어떤 열·어떤 값이 필요한가 |

### 대시보드와 안전장치가 다르다

대시보드는 AI 쓰기를 **제안 큐(202)** 로 거른다 — 핵심 필드는 사람이 승인해야 반영된다.
성숙도에는 제안 큐가 없다. 대신 **근거(note) 없는 평가는 저장 자체가 거절**된다.
근거 없는 칸은 인상평이기 때문이고, 그것이 이 모듈이 지키는 한 가지다.
`maturity_assess` 는 근거가 비면 **서버에 가기도 전에** 막고 왜 필요한지 말해 준다.

몇 가지 더:
- **정확도 같은 `value` 축은 값을 넣는다.** 칸을 직접 넣으면 거절된다 — 사업부 문턱으로
  서버가 정한다(칸을 손으로 넣을 수 있으면 정확도가 둘이 된다).
- **동시 수정** — `maturity_get_pair` 의 `assessed_at` 을 `base_assessed_at` 으로 넘기면,
  그 사이 남이 같은 축을 고쳤을 때 덮지 않고 409 로 알려 준다.
- **권한은 화면과 같다.** 사용자 JWT 를 그대로 넘기므로 자기 사업부만 쓸 수 있다.

## 서버 API (이번에 만든 것만)

```
GET    /api/dt-v2/describe/fields              과제 필드 안내
GET    /api/dt-v2/describe/performance-fields  성과 필드 안내 (표가 다르다)
GET    /api/dt-v2/people/search                이름 → knoxId (AI 전용 · 화면은 안 쓴다)
GET    /api/dt-v2/proposals                    확인 대기 목록
POST   /api/dt-v2/proposals/<id>/approve       반영
POST   /api/dt-v2/proposals/<id>/reject        취소
GET    /api/dt-v2/skill/digitaltwin            사용 안내 파일(SKILL.md) 그대로
GET    /api/auth/me/mcp-tokens                 내 토큰 목록
POST   /api/auth/me/mcp-tokens                 발급 (평문은 여기서 1회만)
DELETE /api/auth/me/mcp-tokens/<id>            폐기 (즉시 무효)
```

## Packaging & GitHub Release (Windows)

- 이 레포는 Windows 배포를 지원하도록 GitHub Actions에서 `deploy_package.zip`을 생성합니다.
- 패키징 스크립트: `scripts/ci/package_deploy.ps1` (backend 코드 복사 + `site-packages`에 의존성 설치)
- 서버 실행 템플릿: `scripts/ci/run_server_template.ps1` (패키지에 포함되어 배포 시 수정하여 사용)
- 릴리스 기준: 태그 `v*` 푸시 시 `.github/workflows/release-windows.yml`이 동작하여 `deploy_package.zip`을 Release asset으로 업로드합니다.


**성과 도구는 새 API 를 만들지 않았다** — 화면이 쓰던 것을 그대로 부른다
(`/performances` · `/performances/<uuid>` · `/projects/<uuid>/performances`).
`actor_mode='ai'` 를 붙이면 같은 엔드포인트가 AI 갈래로 갈린다. 안내(`describe`)만
새로 만들었다. `/projects/<uuid>/history` 도 화면의 '지표 추이' 와 공용이다.

⚠️ `routes_v2.py` 의 `@jwt_required()` 를 **전부 `@auth_required` 로 바꿨다.**
웹 인증은 그대로다 — 갈래를 하나 더 받는 것이다.

## 회귀시험

| 스크립트 | 지키는 것 |
|---|---|
| `dt3_test_describe.py` | 안내가 **정본(`field_maps`·`permissions`)과 어긋나지 않는다** |
| `dt3_test_pat.py` | 발급~폐기 19항목. **폐기 직후 401** · 목록에 평문 없음 |
| `dt3_test_proposals.py` | 47항목. 확인 흐름 · 낡은 제안 · **AI 금지 필드** |
| `dt3_test_skill.py` | 21항목. **안내가 정본과 어긋나지 않는다** — 필드 위험도·도구 이름·절차 문구를 `describe_fields`·`server.py` 에 대고 확인하고, 화면이 내려주는 것이 **그 파일 그대로**인지 본다 |
| `dt3_test_ai_people.py` | A~F. 사람 필드는 **knoxId 가 있을 때만** 열린다 · 이름만 담기는 필드는 여전히 403 · 분류가 core 인지(저위험으로 새면 확인 없이 권한이 생긴다) |
| `dt3_test_performance_mcp.py` | A~H. 성과 **핵심은 403**(202 로 새지 않는다) · 연결은 202 · preview 에 `affectedProjects` |
| `dt3_test_perf_division_prefix.py` | A~G. `[사업부]` 접두어 강제 — 없으면 `[공통]` · 오타는 400 · PATCH 도 같은 규칙 |
| `dt3_test_input_shapes.py` | A~H. 월 범위·역전·날짜 형식·월간진척 키 400 · **기존 100건이 새 규칙을 전부 통과** |
| `dt3_test_mcp_e2e.py` | A~J. **유일하게 `localhost:3003/mcp` 를 통해** 도는 시험 — 도구 28개 등록 확인부터 과제·성과·연결 전 구간 |
| `dt3_test_maturity_mcp.py` | 20항목. 성숙도 도구 12개를 하나씩 불러 **그 경로가 백엔드 URL 표에 그 메서드로 있는지** 대본다(서버 없이 돈다) · 이름이 전부 `maturity_` 인가 · **남의 접두사로 새지 않는가** · 근거 없는 평가가 서버 전에 막히는가 |
| `dt3_test_maturity_mcp_live.py` | 22항목. **경로만으로는 안 잡히는 것** — 보내는 몸통이 백엔드가 받는 꼴인지. `localhost:3003/mcp` 로 실제 도구를 부른다: 만들고·잇고·매기고, 근거 없으면 막히고, 값 축은 값만 받고, 낡은 기준이면 409, dry_run 은 저장 안 하고, **끝에 만든 것을 전부 지운다** |

전체 회귀는 `backend/scripts/dt3_test_*.py` **30개**. 손대면 전부 돌릴 것.

**2026-08-05 전체 실행: 914 [OK] / 0 FAIL** (30개 전부 · e2e·`_live` 포함.
`dt3_test_sync` 는 아래 이유로 스스로 건너뛴다).

> 🐞 **회귀가 초록불인데 데이터를 더럽히고 있었다 (2026-08-05).**
> `dt3_test_sync.py` 는 **컷오버 전 동작**을 검증하려고 `DT2_WRITE_ENABLED=False` 를
> 세팅한 뒤 V1→V2 스윕을 돌린다. 그런데 이 DB 는 컷오버가 끝나서 정본이 dt2 다 —
> **V1 의 낡은 값이 정본을 덮는다.** 2026-08-01 에는 KPI 연결이 사라졌고, 08-05 에는
> 성과를 다시 만든 직후 **이미 삭제된 성과를 가리키는 연결 218건**이 다시 심겼다.
> 검사는 전부 통과하므로 **[FAIL] 을 봐서는 절대 알 수 없다.**
> → 이제 컷오버 상태를 감지해 **스스로 건너뛴다**(`--force-precutover` 로만 강행).

> 🐞 **그 전까지 6개가 빨간불이었는데 아무도 몰랐다.** 08-02(사람 필드 개방)와
> 08-03(성과 분류 강제)이 **정본만 바꾸고 시험을 안 고쳤다.** 특히 나쁜 쪽은 이것이다 —
> 성과 생성에 `대분류`·`소분류` 가 필수가 되면서 **5개 스크립트가 첫 생성에서 죽었다.**
> 죽으면 `[FAIL]` 이 안 찍히므로 **`grep FAIL` 로 훑으면 초록불로 보인다.**
> (`dt3_test_invariants` 는 40개 검사 중 3개만 돌고 있었다.)
> → **통과 건수를 같이 봐야 한다.** 갑자기 줄었으면 중간에 죽은 것이다.

⚠️ 두 개는 조건이 따로다.
· **`dt3_test_mcp_e2e.py`** — MCP 서버(3003)를 띄워 둬야 돈다. 나머지는 백엔드만 있으면 된다.
· **`dt3_test_perf_bulk_delete_live.py`** — **실제로 성과를 전량 지웠다 되돌린다.**
  지우기 전에 스냅샷을 파일로 fsync 하고, 끝나면 건수·연결 내용까지 대조해 원복을 확인한다.
  중간에 죽으면 **`--restore-only`** 로 그 파일에서 복원한다(성공해야 파일이 지워진다).
  운영에서는 돌리지 말 것.

> 🐞 **이 `_live` 시험이 실제 버그를 하나 잡았다 (2026-08-05).** 아래 '성과 전체 삭제' 참고.
> 파괴적이라고 미뤄 두면 이런 것이 안 잡힌다.

⚠️ 파이프로 넘길 때는 **`PYTHONIOENCODING=utf-8`** 을 준다. 안 그러면 콘솔이 cp949 라
   기동 배너의 `—` 에서 `UnicodeEncodeError` 로 죽는다(시험 실패가 아니라 출력 문제다).

---

# 만들 것

| | 무엇 | 왜 |
|---|---|---|
| **먼저** | **운영 반출** | 여기 전부 개발에만 있다. 같이 밀린 물량은 `DT2_CUTOVER_TODO.md` §4-9, 액션아이템 파생은 `DT3_ACTION_ITEM_DERIVATION_TODO.md` (백엔드·프론트를 **반드시 함께** 올릴 것) |
| **먼저** | **상시 기동 방법**(서비스 등록) | 지금은 콘솔에서 띄운다. 창을 닫으면 죽는다. 런북에 넣어야 한다 |
| Phase 5 | **실제 GLM-5.2 와 붙여 보기** | 루프·도구·화면은 **개발에서 끝냈다**(스텁으로 실측). 운영에서 `LLM_BASE_URL` 만 GLM 주소로 바꾸면 된다 |

> ✅ **2026-08-05 — 안내·에이전트를 도구 18개에 맞췄다.** `SKILL.md` 는 도구 10개 시절에,
> 사내 에이전트(`ai/agent_tools.py`)는 `_CATALOG` 10개에 멈춰 있었다.
> 둘 다 `find_people` + 성과 도구 7개를 더해 18개로 맞췄고, 회귀시험이 그것을 강제한다
> (`dt3_test_skill.py` · `dt3_test_agent.py` 양쪽에 도구 대조 검사가 이미 있었다).
>
> 여기가 그냥 문서가 아니라는 점이 중요하다 — 이 파일은 **사용자에게 내려가고**
> Phase 5 에이전트의 **시스템 프롬프트로도 그대로 실린다.** 안내에 없는 도구는
> AI 가 절차를 모르는 채로 부르게 된다(연결 통째 교체 · 성과 403 · `[사업부]` 접두어).

## Phase 5 에서 되돌아봐야 할 것

- **자기 승인 차단**을 되살릴지. 지금은 뺐다(아래 '왜 승인이 아니라 확인인가').
  자율 에이전트는 사람이 안 보고 있으므로 얘기가 달라진다.
  🔁 되살릴 조건은 `permissions.can_review_proposal` 주석에 적어 뒀다 —
  **user_id 로 가르면 안 된다.** 사람이 부른 것과 자율 실행을 구분할 표시가 먼저다.
- **대량 변경 상한.** 지금은 `patch_project` 가 1건씩이고 호출이 채팅에 다 보여서
  사람이 끊을 수 있다. 자율 루프에는 그 안전판이 없다.

## 안 만들기로 한 것

- ~~**Phase 3 — AI 제안 승인 화면**~~. 확인을 **대화 안으로** 옮겨서 화면이 필요 없어졌다.
  승인 API·`dt2_change_proposals` 테이블은 그대로 살아 있다(Phase 5 에서 다시 쓴다).

---

# 참고

## 왜 별도 폴더·별도 venv 인가 (2026-08-01 Phase 0 실측)

**의존성 충돌 때문이 아니다.** 확인해 보니 DT 백엔드에는 `pydantic` 도 `starlette` 도 없다
(Flask 스택뿐). ReportArchive 가 겪은 충돌은 **FastAPI(=starlette+pydantic) ↔ mcp** 사이의
것이라 여기엔 해당하지 않는다.

그래도 분리하는 이유는 **운영상의 독립**이다:

- `mcp` 는 starlette · pydantic · uvicorn · anyio 를 **새로 끌고 온다**. 백엔드 venv 를
  그걸로 불릴 이유가 없다 (실측: 백엔드 venv 는 그대로임을 확인)
- MCP 서버는 **다른 포트 · 다른 프로세스 · 다른 수명주기**다. 따로 재기동할 수 있어야 한다
- 백엔드와는 **REST API 로만** 통신한다 — 스마트 로직은 백엔드에 두고 여기선 호출만 한다

## ⚠️ `mcp` 버전을 1.x 로 고정한다

`mcp` **2.0.0 에서 `mcp.server.fastmcp` 가 사라졌다**(구조가 `mcp.server.mcpserver` 등으로 바뀜).
그냥 `pip install mcp` 하면 2.x 가 잡혀 **import 부터 깨진다.**

ReportArchive 가 1.27.2 로 돌고 있고 그 패턴(헤더 전달·`json_response`)을 그대로 쓰므로
**1.x 로 고정한다.** 2.x 이관은 별도 작업.

```
mcp>=1.27.0,<2.0.0
```

## 설치·실행

**venv 는 반입되지 않는다** — 운영 PC 에서 다시 만들어야 한다. 그런데 **운영은 인터넷이 없다.**
그래서 백엔드와 똑같이 wheel 을 `packages/` 에 미리 모아 두고 `--no-index` 로 설치한다.

```cmd
cd mcp_server
setup_venv.bat                 :: 또는 PowerShell 에서 .\setup_venv.ps1
```

venv 생성 → 오프라인 설치 → **기동 확인**까지 한다. 손으로 하면:

```cmd
python -m venv venv
venv\Scripts\python.exe -m pip install --no-index --find-links=packages -r requirements.txt
```

실행 (개발 — 같은 PC 에서 붙을 때):

```cmd
set DT_API_BASE=http://localhost:5174
venv\Scripts\python.exe server.py        :: streamable-http, 기본 127.0.0.1:3003/mcp
```

### 🚨 운영에서는 `MCP_HOST=0.0.0.0` 이 필요하다

**기본값이 `127.0.0.1` 이라 그 장비 안에서만 붙는다.** 개발은 Claude Code 가 같은 PC 에서
도니 문제가 없지만, **운영은 사용자가 자기 PC 에서 붙는다** — 그대로 띄우면 화면이 알려준
`http://<서버>:3003/mcp` 로 아무도 접속하지 못한다(연결 거부).

```cmd
set DT_API_BASE=http://localhost:5174
set MCP_HOST=0.0.0.0
venv\Scripts\python.exe server.py
```

방화벽에서 **3003/tcp 인바운드**도 열어야 한다:

```cmd
netsh advfirewall firewall add rule name="DT MCP 3003" dir=in action=allow protocol=TCP localport=3003
```

> 확인은 **다른 PC 에서** 해야 한다. 서버 장비에서 `curl http://localhost:3003/mcp` 는
> `MCP_HOST` 가 무엇이든 되므로 판정 근거가 못 된다.

> **Python 은 3.13 이어야 한다** — 번들의 wheel 이 `cp313` 용이다(백엔드와 같은 버전).
> `packages/` 는 **31개 · 14.5MB**. 2026-08-01 실측: 새 venv 에 `--no-index` 로 설치해
> `server.py` 가 뜨는 것까지 확인했다(그때 도구 9개 · 지금 18개. 도구가 늘어도
> 의존성은 그대로라 번들은 다시 만들 필요가 없다).

### 번들 다시 만들기 (온라인 PC 에서)

의존성이 바뀌었을 때만 한다. **지금 돌고 있는 venv 의 버전을 그대로 고정**해서 받는다 —
`requirements.txt` 범위(`mcp>=1.27,<2`)만 주고 받으면 시험한 것과 **다른 버전**이 잡힐 수 있다.

```cmd
venv\Scripts\python.exe -m pip freeze > constraints.txt
venv\Scripts\python.exe -m pip download --only-binary=:all: -d packages -r requirements.txt -c constraints.txt
del constraints.txt
```

> **포트 주의** — DT 백엔드는 **5174**다(`backend/.env` 의 `FLASK_PORT`).
> 5173 은 Vite(프론트)이고, 브라우저가 보는 `/api` 는 Vite 가 5174 로 **프록시**한 것이다
> (`frontend/vite.config.js`). MCP 서버는 프론트를 거치지 않으므로 **5174 에 직접** 붙는다.

⚠️ **콘솔 창을 닫으면 죽는다.** 위는 개발용이다. 운영에서는 상시 기동이 필요한데
그 방법(서비스 등록)은 **아직 안 정했다** — '만들 것' 참고.

### 두 개가 다 떠 있어야 한다

MCP 서버는 백엔드 REST 를 부르는 **대리인**이라 혼자서는 아무것도 못 한다.
`claude mcp list` 가 `✔ Connected` 라고 해도 **그건 MCP 핸드셰이크만** 성공한 것이다 —
백엔드가 죽어 있어도 그렇게 나온다. 실제로 되는지는 도구를 한 번 불러 봐야 안다.

## 등록 (사용자별 토큰)

**만능 토큰을 쓰지 않는다.** 각자 자기 토큰으로 붙고, 서버는 그 헤더를 백엔드에 그대로
넘긴다 → **그 사용자 권한 그대로** 동작한다(과제별 편집 권한이 그대로 걸린다).

```bash
# Claude Code
claude mcp add --transport http digitaltwin http://<host>:3003/mcp \
  --header "Authorization: Bearer dtp_..."
```

Gemini CLI 등 다른 MCP 클라이언트도 같은 방식(HTTP transport + Authorization 헤더)이다.

### 토큰은 **PAT** 이다 — 웹 로그인 JWT 가 아니다

`dtp_` 로 시작하는 **개인 액세스 토큰**을 쓴다. 웹 화면의 JWT 를 복사해 쓰면 안 된다:

| | 웹 JWT | PAT (`dtp_…`) |
|---|---|---|
| 만료 | **12시간** — MCP 헤더는 갱신이 안 되므로 매일 다시 등록해야 한다 | 기본 90일 |
| 폐기 | **불가** (secret 교체 = 전원 재로그인) | **행 삭제로 즉시** |
| 저장 | — | DB 에 **sha256 해시만**. 평문은 발급 시 1회만 |

발급·목록·폐기 API:

```
GET    /api/auth/me/mcp-tokens
POST   /api/auth/me/mcp-tokens      {"name": "내 노트북", "expiresDays": 90}
DELETE /api/auth/me/mcp-tokens/<id>
```

> ⚠️ **평문은 발급 응답에서 딱 한 번만** 나온다. 목록으로는 다시 볼 수 없다 —
> DB 가 새도 토큰이 새지 않게 하려는 것이고, 그게 의도다. 잃어버리면 폐기하고 다시 발급한다.

### 발급 화면

**메인 화면 우상단 내 이름 클릭 → 계정 관리 → `MCP 연결` 카드**
("내 계정 정보" 바로 **오른쪽**에 나란히 있다 · `frontend/src/modules/auth/components/McpTokenSection.jsx`)

거기서 위 명령을 **통째로** 복사할 수 있다. 토큰만 주면 사용자가 조립하다 틀리므로
명령 전체를 만들어서 보여준다.

> ⚠️ 여기는 **DT 대시보드의 '설정' 메뉴가 아니다.** 그 메뉴는 admin·manager·dt_office
> 로 막혀 있는데, PAT 은 개인 것이라 **과제 담당자도 자기 토큰이 필요하다.**
> 계정 관리 화면은 `<ProtectedRoute>` 만 걸려 있어 로그인한 사람 누구나 들어온다
> (관리자만 보이는 '사용자 권한 관리' 는 그 아래 전체 폭에 따로 있다).
>
> (`modules/auth/pages/ProfilePage.jsx` 는 이름만 맞고 **라우트가 없는 죽은 코드**다.
>  거기 만들면 아무도 못 본다.)

MCP 서버 주소는 기본이 `http://<지금 접속한 호스트>:3003/mcp` 다. 다른 데 띄웠으면
프론트 빌드 시 `VITE_MCP_URL` 로 덮는다.

### 사용 안내(Agent Skill) — `skill/digitaltwin/SKILL.md`

**도구 설명만으로는 절차가 안 지켜진다.** 도구 docstring 은 그 도구를 부르는 순간에만 읽히는데,
정작 중요한 것은 **순서**(먼저 `describe_fields`)와 **하지 말아야 할 것**(묻지 않고 `confirm_change`)
이라 도구 하나에 담기지 않는다. 스킬은 대화 시작에 통째로 들어가 그 절차를 붙잡아 준다.

특히 스킬이 없으면 자주 나는 사고 넷:

| | 무슨 일이 |
|---|---|
| 확인 건너뛰기 | 202 를 받고 `preview` 를 안 보여준 채 바로 `confirm_change` → 확인 단계가 없는 것과 같다 |
| **배열 통째 날리기** | `액션아이템목록`·`이슈목록` 은 **통째로 교체**된다. 새 원소만 보내면 나머지가 전부 사라진다. **성과 연결(`link_performances`)도 같다** — `list_project_performances` 를 먼저 읽지 않으면 기존 연결이 지워진다 |
| 섞어 보내기 | 핵심+저위험을 한 번에 보내면 **저위험만 즉시 반영**된다. 취소해도 절반은 이미 들어가 있다 |
| **403 을 202 로 착각** | 성과 핵심 필드는 확인 대기가 **없다.** `confirm_change` 를 찾지 말고 화면에서 고치라고 알려야 한다 |

**설치 — 사용자**: 계정 관리 ▸ MCP 연결 의 **[SKILL.md 내려받기]** 버튼.
같은 자리의 명령으로 폴더(`~/.claude/skills/digitaltwin`)를 만들어 열고, 받은 파일을 넣은 뒤
Claude Code 를 다시 시작한다. 없어도 도구는 동작한다 — 실수가 줄 뿐이다.

**설치 — 개발자**: `cp -r skill/digitaltwin ~/.claude/skills/digitaltwin`

> 화면이 주는 파일은 **이 파일 그대로**다(`GET /api/dt-v2/skill/digitaltwin` 이 디스크에서 읽어
> 보낸다). 프론트에 본문을 복사해 넣지 않았다 — 필드 규칙이 바뀌었는데 안내만 옛말을 하는 상태가
> 가장 나쁘다. **단일 출처는 이 파일 하나다.**
>
> ⚠️ 그래서 **`mcp_server/` 폴더가 반입에서 빠지면 화면의 내려받기가 404 가 된다.**
> (조용히 빈 파일을 주지 않고 분명히 실패로 알린다.)

### 인증이 어떻게 갈리나

`@jwt_required()` 는 `dtp_…` 를 **JWT 로 파싱하려다 뷰에 닿기도 전에 401** 을 낸다(실측).
그래서 `app/shared/auth.py` 의 `auth_required` 가 **접두사로 갈래를 나눈다** —
`dtp_` 면 해시 조회, 아니면 기존 JWT 검증. **웹 화면 인증은 그대로다**(갈래를 하나 더 받는 것).

## 쓰기가 어떻게 갈리나 (2026-08-03 현재)

AI 쓰기는 저위험·핵심·금지 **세 갈래**이고, **과제와 성과의 기준이 다르다.**
판단은 전부 백엔드(`permissions.py`)가 하고 MCP 는 옮기기만 한다.

### 과제 (`patch_project`)

| | 무엇이 | 어떻게 |
|---|---|---|
| **저위험** | 액션아이템·이슈·상세설명·상세정보·작성자·월간진척 | 바로 반영 (200) |
| **핵심** | 과제명·일정·진행상태·사업부·과제구분·PoC/중점 · **참여인력·과제PL** | **202 + `preview`** → 사용자에게 before → after 를 보여주고 동의를 받은 뒤 `confirm_change` |
| **금지** | **소유자 · 담당자 · `과제참여인력`(레거시 문자열)** | **403.** 화면에서만 |

⚠️ **`진행률` 은 저위험인데도 AI 에겐 400 이다** — 액션아이템이 하나라도 있는 과제라면.
액션아이템에서 파생되는 값이라 직접 써 봐야 다음 저장에 덮인다(화면은 폼 전체를 보내므로
400 대신 `ignored` 로 알린다). **AI 는 `액션아이템목록` 의 완료 표시를 바꾼다.**

⚠️ **저위험이라고 항상 즉시 반영은 아니다.** 반쪽만 반영하면 과제가 모순 상태로 잠기는
조합(미착수 과제에 `액션아이템목록`+`진행상태`)은 서버가 **함께 대기시킨다** —
응답의 `applied` 가 비고 `alsoPending` 에 들어온다. "액션아이템은 반영했다" 고 말하면 거짓이다.

### 성과 (`patch_performance` · `link_performances`) — 기준이 하나 다르다

| | 무엇이 | 어떻게 |
|---|---|---|
| **저위험** | 실적수준·조치사항·성과평가·설명·월별실적·보고현황 | 바로 반영 (200) |
| **핵심** | 성과항목·대분류/소분류·단위·목표수준·현재수준 | **403.** 확인 대기로도 **안 간다** |
| **연결** | 과제-성과 연결(`link_performances`) | **202 + `affectedProjects`** |

**왜 성과 핵심은 202 가 아니라 403 인가** — 성과는 **여러 과제가 공유한다.** 단위나 목표수준을
바꾸면 그 성과를 쓰는 **다른 과제의 숫자까지** 함께 움직이는데, 승인자는 자기 과제만 보고
승인한다. 확인 절차로 감쌀 수 있는 종류의 위험이 아니다.

**연결은 왜 열었나** — 같은 이유로 원래 403 이었다. 막는 대신 **우려의 원인을 없앴다**:
202 의 `preview` 에 그 성과를 함께 쓰는 다른 과제(`affectedProjects`)와 기여도 합
경고(`contributionWarnings`)를 실어 보낸다. **그 표가 안 나오면 원래 문제가 그대로 남는다.**

⚠️ 연결은 **통째 교체**다. `list_project_performances` 로 지금 연결을 먼저 읽어 함께
보내지 않으면 빠뜨린 연결이 지워진다.

### 서버가 조용한 실수를 막는 곳 (2026-08-03 추가)

MCP 로 과제 100건 + 성과 100건을 실제로 만들어 보고 **`applied` 는 성공인데 화면에서만
어긋나던 것들**을 서버가 잡게 했다. 안내만으로는 안 막혔다는 것이 실측 결론이다.

| 무엇이 | 서버가 |
|---|---|
| 성과 이름에 `[사업부]` 접두어 없음 → 화면에서 통째로 `미분류` | `[공통]` 을 붙이고 응답 `normalized` 로 알린다. **모르는 접두어는 400** |
| `작성자` 이름만 있고 knoxId 없음 → 화면에 '연결 안 됨' | 이름이 **활성 계정 중 유일할 때만** 채우고 알린다. 동명이인이면 손대지 않는다 |
| 상세정보 본문만 넣고 `enabled` 누락 → 화면에 안 뜸 | 자동으로 켠다 |
| 성과 월별실적·계산로직 본문만 넣고 여부 플래그 누락 | 자동으로 켠다. 단 **속이 빈 값**(`Array(12).fill('')`)은 내용 없음으로 본다 |
| 월 범위 밖·시작>종료·`YYYY-MM-DD` 아닌 날짜·월간진척 키 오류 | **400** |

> 🐞 `디지털트윈기여도` 는 자동으로 켜지 **않는다.** 화면 폼의 기본값이
> `여부: false` + `값: '100'` 이라 **값이 있다는 게 쓰겠다는 뜻이 아니다.**

### 왜 '승인' 이 아니라 '확인' 인가

원래는 제안을 쌓아 두고 **웹 화면에서 승인**하는 설계였다. 인증이 개인 PAT 이 되면서
전제가 깨졌다 — 제안자가 곧 **AI 를 시킨 사람**이다. 그 사람이 채팅에서 "바꿔줘" 라고 한 것이
이미 의사표시인데, 브라우저를 열어 같은 결정을 또 누르게 하는 것은 마찰만 는다.

그래서 **확인을 대화 안으로** 옮겼다. 202 응답이 `preview`(before → after)와
`projectTitle`/`projectCode` 를 실어 주고, AI 가 그걸 사람에게 보여준 뒤 `confirm_change`
(또는 `cancel_change`)를 부른다.

이 단계가 잡는 것은 권한 위반이 아니라 **AI 의 오해**다 — 엉뚱한 과제를 집었거나, 값이
서버에서 다르게 정규화되거나, 사용자 말과 다른 칸을 고른 경우. 전부 값을 눈으로 보면 걸린다.

⚠️ **차단 장치가 아니다.** `actor_mode='ai'` 는 클라이언트가 스스로 붙이는 값이라
빼고 부르면 그냥 통과한다(실측). 권한은 `can_edit_project` 가 본다.

### 사람 필드 — 금지에서 **knoxId 필수**로 (2026-08-02 변경)

원래 참여인력·과제PL 도 403 이었다. **막은 이유는 권한이 아니었다** — 확인 화면이
before → after 를 **이름으로** 보여주는데 **동명이인은 이름만 봐서 구분이 안 되기**
때문이다(개발 실측에서 한 이름이 여러 (이름,부서) 묶음에 걸친 게 4종). "홍길동 추가" 를
보고 예라고 해도 **어느 홍길동인지 모른 채** 승인하는 것이다.

그 모호함은 knoxId 가 없앤다(`users.email` 로컬파트와 1:1). 그래서 **금지를 푸는 대신
knoxId 를 필수로** 만들었다. 이름만 보내면 **400** 이고, 메시지가 `find_people` 로 가라고
말한다. 승인 preview 에는 이름·knoxId·부서·연결여부를 담은 `peoplePreview` 가 함께 온다.

| 필드 | AI 가 |
|---|---|
| `과제참여인력목록`(`members_json`) · `과제PL_knoxId`(`pl_knox_id`) | **넣을 수 있다.** knoxId 필수 · 핵심이라 202 |
| `소유자`(`owner_user_id`) · `담당자`(`owners_json`) · `과제참여인력`(`member_names`) | **못 넣는다(403).** 이름만 담기는 형태라 knoxId 를 담을 자리가 없다 |

⚠️ **여전히 권한을 여는 필드다.** 여기 들어간 사람은 그 과제를 고칠 수 있게 된다
(`is_project_member` · `is_project_pl`). 되돌려도 그 사이엔 열려 있었다.
생성(`create_project`)은 확인 대기가 없어 **즉시** 권한이 생긴다 — 짐작으로 고르지 말 것.

> 계정으로 안 풀리는 knoxId 도 막지 않는다. knoxId 는 사내 이메일 앞부분이라 **가입 전에도
> 미리 채울 수 있고**, 계정이 없으면 권한도 안 생긴다. preview 에 '가입 대기' 로 표시해
> 사람이 판단하게 한다. 일괄 정리는 전용 화면(**참여인력 계정 점검**)이 따로 있다.

## 프록시가 SSE 를 버퍼링하면

`MCP_JSON_RESPONSE=1` 로 띄우면 응답을 **단발 JSON**(Content-Length 완결)으로 돌려준다.
중간에 SSE 를 붙잡는 프록시·VPN·보안장비가 있으면 initialize 응답이 도달하지 못해
"무응답 → 타임아웃" 이 나는데, 그때 쓴다. 이 서버는 스트리밍 기능을 쓰지 않아 실질 손실이 없다.

## 진행 경과

| | | 실측 |
|---|---|---|
| Phase 0 | 의존성·버전 확인 | 백엔드 venv 무영향 · `mcp` 1.x 고정 |
| Phase 1 | `ai_tools.py` + `describe/fields` | 필드 55개 · 핵심 23개 |
| Phase 2 | `server.py` 도구 7개 | 전 구간 통과(클라이언트→MCP→백엔드→DB) |
| Phase 2.5 | PAT | 19항목. **폐기 직후 401** |
| Phase 2.6 | 발급 화면 | 브라우저 실측(발급→명령 복사→폐기→DB 0행) |
| Phase 3 | ~~승인 화면~~ → **대화 안 확인** | 도구 9개로. 확인·취소·금지 전부 실측 |
| Phase 4 | Agent Skill + 화면에서 배포 | 응답 모양 실호출 대조 · 화면 클릭 확인 완료 |
| Phase 5 | **에이전트 루프**(백엔드) + 화면 | 스텁으로 전 구간 실측 · 브라우저 확인 완료 |
| 08-02 | **사람 필드 개방** (knoxId 필수) + `find_people` | 금지 → 조건부. 이름만 보내면 400 |
| 08-02 | **성과 도구 7개** | 핵심=403 · 연결=202 + `affectedProjects` 실측 |
| 08-03 | **MCP 로 실제 시딩** — 과제 100건 + 성과 100건 | `localhost:3003/mcp` 로 300 콜. 여기서 조용한 실수들이 드러났다 |
| 08-03 | 그 실수들을 **서버가 잡게** | 접두어 강제 · 작성자 knoxId · 여부 플래그 · 형식 400 |
| 08-03 | **액션아이템 파생** | 진행률 직접 쓰기 400 · 모순 조합 400 · `alsoPending` |
| 08-03 | **e2e** (`dt3_test_mcp_e2e.py`) | 도구 18개 등록부터 과제·성과·연결까지 MCP 경로로 A~J |
| 08-05 | **안내·에이전트를 18개에 맞춤** | `SKILL.md` + `agent_tools.py` 둘 다 10개였다 |
| 08-05 | **전체 회귀 복구** | 낡은 단언 정리 · 중간에 죽던 5개 살림 |
| 08-05 | **성과 전체 삭제 버그 수정** | 연결이 218건 남던 것 → 0건. 30개 전부 **927 [OK] / 0 FAIL** |

### 성과 전체 삭제 — 연결이 남던 버그 (2026-08-05 수정)

`POST /performances/bulk-delete` 는 **삭제 대상 성과의 연결만** 끊고 있었다. 그런데 이
조작이 끝나면 살아있는 성과가 **하나도 안 남으므로**, 그때 남아 있는 연결은 전부
**이미 삭제된 성과를 가리키는 빈 참조**다. 화면은 성과 목록에서 삭제된 것을 걸러내니
(`assemble` 의 `is_deleted` 필터) 가리킬 대상이 없고, 과제를 휴지통에서 되살리면
그 빈 참조가 그대로 따라 올라온다.

**개발 DB 실측: 218건이 그렇게 쌓여 있었다** — 휴지통 과제 211건에 붙은,
2026-08-02 에 지워진 성과 208건을 가리키는 연결(살아있는 과제에는 0건).

고친 곳은 두 군데다. **한 곳만 고치면 안 된다:**

| | 무엇 |
|---|---|
| `bulk_delete_performances` | 대상의 연결만 → **연결 전부** 삭제 |
| `performance_delete_summary` | 세는 범위도 같이 넓혔다 — 안 그러면 **확인 화면에서 본 숫자보다 실제로 더 많은 과제가 바뀐다**(그 함수가 있는 이유 자체가 그것이다) |

⚠️ **운영 반영 시 영향** — 다음에 '성과 전체 삭제' 를 누르면 **휴지통 과제의 성과목록도
   함께 비워진다.** 되살릴 때 그 목록은 안 돌아온다(원래도 성과 자체는 안 돌아왔다).

---

## Phase 5 — 사내 LLM 에이전트 (2026-08-01 개발 완료 · **2026-08-07 운영 반영**)

**개발서버는 GLM 에 못 닿는데도 전부 만들었다.** ReportArchive 가 쓴 방법 그대로다 —
GLM 과 **같은 응답 모양**을 흉내내는 스텁을 띄우면 어댑터·루프·도구·화면이 **진짜 코드로**
돈다. 운영에서만 확인되는 것은 "GLM 이 옳은 도구를 고르는가" 한 줄뿐이다.

| 층 | 무엇 | 어디 |
|---|---|---|
| 어댑터 | OpenAI 호환 호출 · `tool_calls` 파싱 | `backend/…/dt_dashboard/ai/llm.py` |
| 도구 | 스키마 **18개** + 실행. **판단은 없다** | 〃 `ai/agent_tools.py` |
| 루프 | tool_calls → 실행 → 되먹임 → 답변 | 〃 `ai/agent.py` |
| 라우트 | `POST /api/dt-v2/ai/agent` **관리자 전용** | `routes_v2.py` |
| 화면 | 대시보드 우하단 패널 (관리자만) | `…/digital-twin-dashboard/components/AiAgentPanel.jsx` |
| 스텁 | GLM 흉내 서버 (개발용) | `backend/scripts/llm_stub.py` |
| 회귀 | 36항목 | `backend/scripts/dt3_test_agent.py` |

**규칙을 복제하지 않았다** — 이게 설계의 전부다.
· 도구는 **MCP 와 똑같이 REST 로** 자기 API 를 부른다(권한·202·409 판단이 한 곳에만 있다).
· 시스템 프롬프트는 **`skill/digitaltwin/SKILL.md` 를 그대로 싣는다**(앞머리만 뗀다).
  Claude Code 로 쓸 때와 사내 LLM 으로 쓸 때 **같은 규칙**이 적용된다.

✅ **2026-08-05 — 사내 에이전트도 도구 18개가 됐다.** 그 전에는 10개라
   `find_people` 과 성과 도구 7개가 없었고, 그래서 **참여인력·과제PL 을 넣을 수 없고**
   (knoxId 를 확인할 방법이 없었다) **성과를 못 만졌다.** 막아 둔 게 아니라 안 옮긴 것이었다.
   규칙은 그대로 REST 에 두고 스키마·실행만 늘렸다 — `_CATALOG` 에 8개 추가.
   `dt3_test_agent.py` 의 「MCP 도구 18개가 에이전트에도 다 있다」가 이 일치를 강제한다.

> 읽기 전용 모드(`READONLY_TOOL_NAMES`)에는 `find_people` 과 성과 **읽기** 4개를 넣었다.
> `find_people` 은 사람을 **찾기만** 한다(GET) — 넣는 것은 `patch_project`·`create_project`
> 라 여기 둬도 쓰기가 열리지 않는다. 시험이 그것도 본다(「readonly 모드에 쓰기 도구가 없다」).

⚠️ **`httpx` 가 아니라 `requests`** 를 쓴다 — 백엔드 venv 에 httpx 가 없다(실측).
   참고 구현은 httpx 지만 그것 때문에 의존성을 늘리지 않았다.

⚠️ **요청 하나가 스레드 두 개를 쓴다**(바깥 요청 + 자기 호출). 동시 사용이 많으면
   waitress 스레드가 마른다 → 운영에서 `WAITRESS_THREADS` 를 넉넉히 줄 것.
   (관리자 전용이라 동시 사용자가 적다는 전제가 깔려 있다.)

### 기존 AI 채팅(`AiChatSidebar`)은 내렸다 (2026-08-01)

메인·DT 대시보드·문서자동작성 **세 곳의 진입점을 전부 없앴다.** 채팅창이 둘이면 사용자가
어디에 물어야 하는지 알 수 없고, 그쪽은 브라우저가 `/llm` 을 직접 불러 **도구를 못 쓴다.**

**진입점만 없앴다** — `components/AiChatSidebar.jsx` · 백엔드 `/api/ai/context`·`/api/ai/analyze` ·
Vite `/llm` 프록시는 그대로다. 각 자리에 주석으로 남겨 뒀으니 되돌리려면 그 줄만 살리면 된다.

⚠️ **`AutoDocumentApp` 이 직접 부르는 `/llm` 은 건드리지 않았다**(`AutoDocumentApp.jsx:1005`).
   그건 채팅이 아니라 **데이터 매핑 자동화** — 그 화면의 기능이다. `/llm` 프록시를 지우면 깨진다.

⚠️ 지금 AI 창구는 **DT 대시보드의 에이전트 하나뿐이고 관리자 전용**이다. 일반 사용자는
   AI 기능이 없어진 상태다 — 넓힐지는 에이전트를 써 보고 정한다.

### 개발에서 돌려보기

```cmd
python scripts\llm_stub.py            :: 터미널 1 — 가짜 GLM (9001)
python run.py                         :: 터미널 2 — 백엔드
```
`backend\.env` 에 `LLM_BASE_URL=http://localhost:9001/v1`.
대시보드 우하단 청록색 버튼 → 질문에 **`!tool list_projects {"limit":3}`** 이라고 쓰면
스텁이 그 도구를 부르라고 답해서 **루프와 도구 실행을 눈으로** 볼 수 있다.

### 운영에서 켤 때

1. `LLM_BASE_URL` 을 **GLM 주소**로 바꾼다(`/v1` 까지). ← 개발 스텁 주소가 그대로 나가면
   AI 만 503 이 된다
2. 실제 GLM 응답을 한 번 떠서 `backend/tests/fixtures/glm_chat_response.json` 에 넣어 두면,
   개발에서 **그 진짜 모양**에 파싱을 고정할 수 있다(`arguments` 가 문자열인지 객체인지 등)

---

## Phase 5 를 위해 미리 찾아둔 것 (2026-08-01)

**이 프로젝트에 이미 OpenAI 호환 LLM 배관이 있다.**

- `frontend/vite.config.js` — `/llm` → `http://localhost:8080` 프록시 (SSE 버퍼링 방지 헤더까지)
- `components/AiChatSidebar.jsx` · `modules/auto-document/AutoDocumentApp.jsx` —
  `POST /llm/v1/chat/completions` 호출

즉 **엔드포인트 모양이 GLM-5.2 와 같다**(`/v1/chat/completions`). ReportArchive 의
`app/ai/llm.py` 가 같은 규격에 GLM reasoning 처리(`<think>` 스트립·`reasoning_effort`)를
덧댄 것이라 그대로 이식할 수 있다.

⚠️ **다만 지금은 브라우저가 부른다**(browser → Vite proxy → 8080). tool-calling 에이전트는
도구를 **권한 검사와 함께 실행**해야 하므로 **백엔드에서 불러야 한다.** 프론트 호출을
그대로 재활용할 수는 없고, 배관 모양만 같다.
