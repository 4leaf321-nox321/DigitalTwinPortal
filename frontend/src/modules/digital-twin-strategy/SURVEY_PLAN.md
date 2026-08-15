# 설문 모듈 — 개발 계획

> 상태: **독립 모듈로 분리 중** · 2026-08-15
> 백엔드 완료(`app/modules/survey/`). 프론트 분리 진행 중.
> 상위 계획: [PLAN.md](./PLAN.md) — 전략 기획 모듈. 설문은 그 6절에서 갈라져 나온 것입니다.
>
> **내일 여기서부터** → 6절 「다음에 할 일」

---

## 0. 기존 설문 기능을 걷어냈다 (2026-08-15)

`collaboration_board` 에 설문 기능이 **있었고, 죽은 코드가 아니었습니다.**
이 문서의 이전 판이 두 번 틀렸습니다 — 처음엔 "포탈에 설문이 전혀 없다"고 했고,
다음엔 "만들다 만 것"이라고 했습니다. 실제로는:

| | |
|---|---|
| 백엔드 | `/surveys` CRUD 라우트 일습 + 서비스 |
| 프론트 | 게시판의 **「설문조사」 카테고리 탭** — 만들기·수정·마감·삭제 화면 |
| 데이터 | 설문 2건 · 문항 3개 · **응답 4건** (개발 DB) |

**사용자 확인 후 걷어냈습니다.** 포탈에 설문이 둘 있는 것보다 하나로 통일하는
쪽을 골랐고, 그래서 새 모듈이 `Survey` / `surveys` 이름을 가져왔습니다.

두 설문은 실제로 다른 물건이었습니다 — 게시판 것은 글 옆에 붙는 가벼운 투표
(익명 여부를 설문마다 켜고 끔, 대상 개념 없음)였고, 새 것은 **익명 방식이 하나로
고정**되고 **대상을 지정**하며 **문항이 진단 축에 연결**되는 설문입니다.

⚠️ 그래서 게시판 설문 데이터는 **옮기지 않고 버렸습니다.** 옛 행에는 대상·소속이
아예 없어서, 옮기면 전부 "소속 알 수 없음"인 응답만 남습니다.

---

## 1. 왜 만드는가

포탈 데이터는 **시스템이 아는 것**만 말해줍니다. 과제가 몇 건인지, KPI 에 걸렸는지는
알지만 **그게 잘 돌아가는지는 모릅니다.**

```
포탈 데이터   시스템이 아는 것   — 과제 수, KPI 달성률, 연결 등급
설문         사람만 아는 것     — 체감, 판단, 우선순위, 제약
```

특히 진단의 **조직 역량 5축**(AX-5R: 준비도·업무 정착·역할·책임·리스크 관리·성과 측정)은
시스템이 알 방법이 아예 없습니다. 지금은 사람이 손으로 찍는 값이고, 근거가 없습니다.
`definitions.py` 의 `ORGANIZATION_DIMENSIONS` 에 `survey_recommended: True` 로
표시해 둔 것이 바로 이 자리입니다.

그리고 운영 데이터를 개발로 반출하지 않는 제약 아래에서, **설문은 개발이 못 보는
맥락을 운영 사용자가 직접 채워 넣는 유일한 통로**입니다.

---

## 2. 진입점 — 설문은 자기 모듈이다

**설문은 전략의 부품이 아니라 포탈의 기능입니다.** 그래서 자기 모듈과 자기
카드를 갖습니다. 전략은 첫 사용처일 뿐입니다.

```
홈 화면
├─ [디지털 트윈 전략 기획]   admin · dt_office
│    헤더 [설문 ↗] ─────────┐   지금 보고 있는 전략을 context 로 달아 넘어간다
│                            │
└─ [설문]  ③건   전원 공개  ◀┘
     · 누구나 — 내가 받은 설문에 응답
     · admin·dt_office — 화면 안에서 '설문 관리'로 전환
```

**한 모듈이 두 얼굴을 갖습니다.** 로그인한 사람은 누구나 들어와 자기가 받은
설문에 답하고, 권한이 있으면 같은 모듈 안에서 만들기·집계로 전환합니다.
가르는 것은 **백엔드**입니다 — `/api/surveys/manage/*` 는 `manager_required`,
응답용은 로그인만 봅니다. 화면에서 가리는 것은 방어가 아닙니다.

**전략은 링크로만 잇습니다.** 헤더의 [설문 ↗] 은 만들기 화면을 열지 않고
`/survey?context_type=strategy_plan&context_id=<planId>` 로 넘어갑니다.
저쪽에서 그 전략의 설문만 걸러 보여줍니다. 이렇게 해야 설문 모듈이 전략을
모르는 채로 있을 수 있습니다.

### 홈 카드 (확정 2026-08-15)

```javascript
{
  id: "survey",
  name: "설문",
  desc: "받은 설문에 응답합니다",   // ← 이 문구가 중요하다
  route: "/survey",
  // allowedRoles 를 적지 않는다 = 전원 공개
}
```

`desc` 를 이렇게 적는 이유는, 이름만 "설문"이면 **설문을 만드는 곳으로 오해**
하기 때문입니다. 대부분의 사용자에게 이 카드는 답하러 가는 곳입니다.

미응답 건수를 **배지**로 띄웁니다(`GET /api/surveys/mine/count`). 0이거나
호출이 실패하면 배지를 안 그립니다 — 배지는 부가 정보라 실패해도 홈이 깨지면
안 됩니다.

**카드를 역할로 숨기지 않습니다.** 이 포탈은 카드를 모두에게 보여주고 **누를 때
거부**합니다(`MainPage.jsx` 의 `onOpen`). 설문 카드는 애초에 전원 공개라 거부될
일이 없습니다.

> ⚠️ PLAN.md 8절에 "해당 역할이 아니면 카드 자체가 보이지 않습니다"라고 적혀
> 있었는데 **틀린 서술이었습니다.** `filtered` 는 `allowedRoles` 를 보지 않습니다.

**껍데기는 다른 모듈과 같습니다** — `shared/components/Header/CommonHeader` +
홈 버튼. 모듈만 생김새가 다르면 사용자는 다른 시스템으로 넘어온 줄 압니다.

---

## 3. 익명성 — 한 가지 방식만 둔다

```
일반 열람   "생산기술팀 · 3점"
관리자      "생산기술팀 · 홍길동 · 3점"   ← 감사 로그에 남음
```

**설문마다 켜고 끄는 설정으로 두지 않습니다.** 설문마다 다르면 응답자가 무엇을
믿어야 할지 몰라지고, 결국 어느 설문에도 솔직하게 답하지 않습니다.

⚠️ **이 구조는 진짜 익명이 아닙니다.** 그러므로 응답 화면에
**「관리자는 응답자를 확인할 수 있습니다」를 반드시 고지**합니다. 익명이라 안내하고
실제로는 추적 가능하면, 그 사실이 알려지는 순간 설문 자체의 신뢰가 무너집니다.
한 번 무너지면 이후 어떤 설문도 솔직한 답을 못 받습니다.

정직하게 안내하면 오히려 응답 품질이 예측 가능해집니다 — 사람들이 "이건 기록에
남는다"를 알고 답하니까요. 민감한 주제는 설문 대신 다른 방법을 씁니다.

그리고 고지하는 이상 **실제로 누가 언제 봤는지 남아야** 그 고지가 면피 문구가
아니게 됩니다. `survey_access_log` 가 그 자리입니다.

- `list_identities` — 응답자 목록을 연 것
- `view_identity` — 특정 응답의 응답자를 본 것

> **[남은 결정]** 감사 로그를 **어디까지** 남길지. 지금 모델은 위 두 가지를
> 담을 수 있게만 해두었습니다. 화면에서 관리자에게 열람 이력을 보여줄지,
> 응답자에게도 "내 응답이 조회되었습니다"를 알릴지는 정하지 않았습니다.

**자유서술은 특히 신원이 드러나기 쉽습니다.** AI 요약을 붙일 때 개인 특정 표현을
걸러내야 합니다(Phase 5).

---

## 4. 데이터 모델 (구현 완료)

`backend/app/modules/survey/models.py` · 마이그레이션 `b0410d38d54c`

```
surveys                 설문 한 벌
  title, description,
  context_type, context_id, context_tag,   ← 어디에 매달렸나 (비어도 된다)
  target_type(all|department|role|user), target_refs(JSON),
  status(draft|open|closed), closes_at, created_by

survey_questions        문항
  survey_id(CASCADE), order, text, help_text,
  qtype(scale|choice|rank|text), required, options(JSON),
  link_type, link_key                      ← 무엇에 연결되나

survey_responses        한 사람의 응답 한 벌
  survey_id(CASCADE), user_id,
  department_name, division_id, division_source(profile|picked|unknown),
  submitted_at
  UNIQUE(survey_id, user_id)               ← 중복 응답 차단

survey_answers          문항 하나에 대한 답
  response_id(CASCADE), question_id(CASCADE),
  value_number | value_text | value_json
  UNIQUE(response_id, question_id)

survey_access_logs      관리자가 응답자를 확인한 기록
  survey_id(CASCADE), viewer_id, response_id, action
```

### 이 모듈은 무엇에도 의존하지 않는다

전략 모듈을 import 하지 않고 전략 표에 FK 도 걸지 않습니다. 대신 **불투명한
문자열 칸**만 들고 있습니다.

| 칸 | 전략이 넣는 값 | 설문 모듈이 아는 것 |
|---|---|---|
| `context_type` / `context_id` | `'strategy_plan'`, `12` | 없음. 그대로 보관·반환 |
| `link_type` / `link_key` | `'strategy_dimension'`, `'organization:readiness'` | 없음 |

**아무 데도 안 매단 설문이 유효해야** 진짜 독립입니다. 테스트가 그렇게 만들어
검증합니다(`_make_survey()` 는 context 를 안 답니다).

권한 검사도 이 모듈이 직접 합니다(`manager_required`). 전략의
`office_required` 를 빌려 쓰면 역할은 같아도 다시 매입니다.

### ⚠ 클래스 이름 충돌로 v0.1.22 가 깨졌던 일

처음엔 `strategy_survey_*` 로 만들었다가, 독립시키면서 게시판 것을 걷어내고
`surveys` 를 가져왔습니다. 그 사이에 **같은 declarative base 에 `Survey` 가
둘이 되어 매퍼 설정이 실패했고, 모든 DB 질의가 죽은 채로 릴리스됐습니다.**

세 가지가 전부 매퍼를 안 건드려서 통과했습니다 — 마이그레이션 생성, 적용,
표 존재 확인(inspect). CI 가 막았어야 하는데 `backend/tests` 가 없어 pytest 를
통째로 건너뛰고 있었습니다.

→ `backend/scripts/check_models.py` 가 CI 에서 DB 없이 모든 모델을 불러
`configure_mappers()` 를 부르고 표 이름 중복도 봅니다. 충돌을 일부러 되살려
실제로 잡는 것까지 확인했습니다.

**답을 유형별로 나눠 담습니다.** 한 칸에 전부 문자열로 밀어넣으면 집계할 때마다
파싱해야 하고, 숫자가 아닌 값이 섞여도 모릅니다.

**소속은 응답 시점에 복사합니다.** 나중에 조직이 바뀌어도 "그때 이 부서가 이렇게
답했다"가 남아야 집계가 검증됩니다.

---

## 5. ⚠ 응답을 사업부로 묶을 방법이 지금은 없다

**이 계획에서 가장 조심해야 할 부분입니다.**

진단은 사업부 단위인데, 응답자에게서 사업부를 알아낼 경로가 확인되지 않았습니다.

| 확인한 것 (개발 DB, 2026-08-15) | |
|---|---|
| `users.department` | **8명 전부 NULL** |
| `departments` 100행의 `division_id` | **전부 NULL** |

운영은 다를 수 있지만 **반출 제약 때문에 확인할 수 없습니다.** 그래서 셋 중
하나로 정해지도록 설계했습니다 — `survey_response.division_source`:

```
profile   users.department → departments.division_id 로 유도됨
picked    응답자가 응답할 때 직접 고름          ← 지금은 이게 주 경로일 것
unknown   둘 다 안 됨
```

**사업부를 모르는 응답을 조용히 아무 데나 넣으면 집계가 거짓말을 합니다.**
그래서 `unknown` 을 별도로 두고, 관리자 집계 화면에 **「소속 미확인 N건」을
반드시 표시**합니다. 숨기면 5개 사업부 평균이 그럴듯하게 나오는데 실은 절반이
어디 것인지 모르는 상태가 됩니다.

**응답 화면에서 사업부를 고르게 할 때**는 유도된 값이 있으면 그것을 기본값으로
두고 고칠 수 있게 합니다. 매번 처음부터 고르게 하면 대충 고릅니다.

> 운영에서 `departments.division_id` 가 채워져 있다면 `picked` 단계를 건너뛸 수
> 있습니다. **배포 후 가장 먼저 확인할 것 중 하나**입니다.

---

## 6. 다음에 할 일

### ✅ 6-1. 백엔드 API (완료)

`backend/app/modules/survey/routes.py` — 블루프린트가 둘입니다. **권한 기준이
달라서** 한 파일 안에서도 경로로 갈랐습니다.

**관리자용** (`manager_required` — admin·dt_office)

```
GET    /api/surveys/manage?context_type=&context_id=   목록 (context 로 좁힘)
POST   /api/surveys/manage                             생성(문항 포함)
GET    /api/surveys/manage/<id>                        문항까지 조회
PUT    /api/surveys/manage/<id>                        수정
DELETE /api/surveys/manage/<id>
PUT    /api/surveys/manage/<id>/status                 배포·마감·회수
GET    /api/surveys/manage/<id>/results                집계 (익명)
GET    /api/surveys/manage/<id>/identities             응답자 확인 → 감사 로그
```

**응답자용** (로그인만 — 역할 안 봄)

```
GET  /api/surveys/mine          내가 받은 설문 (미응답 먼저)
GET  /api/surveys/mine/count    홈 배지용 미응답 건수
GET  /api/surveys/<id>/form     문항 (대상자만)
POST /api/surveys/<id>/responses  제출 (1인 1회)
```

상태 전환을 `open`·`close` 로 나누지 않고 `status` 하나로 둡니다. 되돌리는
경우(`open → draft`)까지 생각하면 상태를 넘기는 편이 단순하고, 상태가 늘어나도
경로가 안 늘어납니다.

**지킨 것**

- 대상자 판정은 `is_target(user, survey)` **한 곳**뿐. 목록·조회·제출이 전부
  이걸 씁니다 — 흩어 쓰면 목록엔 안 뜨는데 id 로 POST 하면 받아지는 구멍이 생깁니다.
- 응답 직렬화는 `serialize_response(r, reveal=False)` **한 곳**뿐이고
  **기본값이 '가린다'** 입니다. 깜빡하면 더 가려지지, 새지 않습니다.
- `status != 'open'` 이거나 `closes_at` 이 지났으면 거부(`_accepting()`).
- 제출은 **DB 를 건드리기 전에 전부 검증**합니다. 처음엔 넣으면서 검사했는데,
  알 수 없는 문항이 섞이면 응답이 반쯤 저장된 채 400 이 나갔습니다 —
  **테스트가 첫 실행에서 잡았습니다.**
- 응답이 있는 설문은 문항 수정을 막습니다(409).

**테스트** — `backend/tests/test_survey_api.py` 19개. 권한과 익명성부터.
`backend/tests` 가 없어서 CI 의 pytest 가 통째로 건너뛰어지고 있었고, 그게
매퍼 충돌이 릴리스까지 간 이유였습니다. 이제 **`backend-tests` 잡(ubuntu +
postgres 서비스)** 이 따로 돕니다 — Windows 러너에는 Postgres 가 없고 Actions 의
`services:` 도 리눅스 전용입니다.

### ✅ 6-2. 관리자 화면 (완료)

`components/Survey/` — `SurveyManager` · `SurveyEditor` · `SurveyResults`

**단계 탭에 넣지 않았습니다.** 설문은 어느 단계에도 속하지 않고 모든 단계를
가로지르므로, ①~⑤ 옆에 끼우면 **5단계 척추가 6개로 읽힙니다.** 헤더의
**[설문]** 버튼으로 열고, 그 화면에서는 단계 탭을 감춥니다 — 탭이 하나 켜져
있으면 거짓말이 됩니다.

- 목록 — 상태·문항 수·**응답/대상**을 한 줄에. 배포·마감·삭제·집계 진입
- **「조직 역량 5축으로 채우기」** — 진단의 `ORGANIZATION_DIMENSIONS` 를 그대로
  문항으로 옮깁니다. `link_dimension` 이 붙은 채로 만들어져야 나중에 집계값이
  그 축의 현재 수준 후보로 들어갈 수 있습니다(6-4).
  매번 백지에서 설계하게 두면 아무도 안 씁니다.
- 응답이 있으면 **문항 편집을 화면에서부터 막습니다.** 서버도 409 로 막지만,
  보내놓고 거절당하는 것보다 아예 못 만지는 편이 낫습니다.
- 집계 — 평균 옆에 **항상 응답 수**를 둡니다. 7명이 답한 3.2 와 2명이 답한 3.2 는
  다른 이야기입니다. 사업부별 분포, 자유서술 원문.
- **「소속 미확인 N건」을 경고 띠로** 띄웁니다. 사업부별 평균에서 빠진 응답이
  얼마나 되는지 모르면 그 평균을 그대로 믿게 됩니다.
- 응답자 확인 버튼에 **"누르면 열람 기록이 남습니다"** 를 적어 둡니다.
  누르기 전에 알아야 고지가 의미가 있습니다.

### ⬜ 6-3. 응답자 화면 (여기부터)

`frontend/src/modules/survey/` · 라우트 `/survey` · 홈 카드 전원 공개

**다른 모듈과 같은 껍데기를 씁니다.** 이 모듈만 생김새가 다르면 사용자는 다른
시스템으로 넘어온 줄 압니다.

```
modules/survey/
  SurveyApp.jsx
  components/Layout/Header.jsx     ← CommonHeader 를 감싸는 얇은 층
  components/...
  services/surveyApi.js
```

- `shared/components/Header/CommonHeader` 사용. 로고·제목·`onGoHome` 을 넘기고
  모듈 고유 버튼은 `centerContent` 로 얹습니다
  (예: `modules/digital-twin-strategy/components/Layout/Header.jsx`)
- **홈 버튼**은 다른 모듈과 같은 자리·같은 동작
- 받은 설문 목록 (미응답 우선), 미응답 0건이면 빈 상태
- 응답 폼 — 상단에 **익명 고지 문구 상시 노출**
- 사업부 선택 (유도값이 있으면 기본값)
- 제출 후 수정 가능 여부 → **[남은 결정]**

### ⬜ 6-4. 진단 연결

여기까지 와야 설문이 "숫자 구경"으로 안 끝납니다.

- 진단 화면 조직 역량 축마다 **「설문으로 물어보기」** 버튼
- 집계값을 `strategy_assessment.current_level` **후보로 내민다.** 자동으로
  넣지 않는다 — 3.4 점을 3 으로 내릴지 4 로 올릴지는 사람이 정한다
- 반영하면 `basis='survey'` 로 남긴다. 이미 그 칸이 모델에 있다
- 근거는 `strategy_evidence` 에 `kind='survey'` 로 스냅샷

---

## 7. 문항 유형

| 유형 | `options` | 집계 |
|---|---|---|
| `scale` | `{min:1, max:5, minLabel, maxLabel}` | 평균 · 분포 |
| `choice` | `{choices:[...], multiple:bool}` | 선택 빈도 |
| `rank` | `{choices:[...], topN:3}` | 순위별 가중 집계 |
| `text` | `{}` | 원문 목록. AI 요약은 Phase 5 |

**진단 연결에 쓰이는 것은 `scale` 뿐입니다.** 1~5 척도가 성숙도 레벨과 같은 자를
쓰기 때문입니다. 나머지는 근거 패널에 붙습니다.

---

## 8. 위험

**설문 피로.** → 단계별 최소 문항. 같은 대상에게 연속 배포 방지.

**소속 미확인이 쌓이는 것.** → 5절. 집계 화면에 반드시 드러낸다. 숨기면 그럴듯한
평균이 나오는데 실은 절반이 어디 것인지 모른다.

**익명이라 믿고 답했다가 신뢰가 깨지는 것.** → 3절. 고지 + 감사 로그.

**응답률이 낮아 집계가 무의미해지는 것.** → 집계에 **응답 수를 항상 같이** 보여준다.
"3점"이 아니라 "3.2점 (7명 응답 / 대상 24명)". 몇 명이 답했는지 모르는 평균은
숫자 구경이다.

**설문이 진단과 안 이어지는 것.** → 6-4 를 반드시 한다. 여기까지 안 오면 설문은
따로 도는 기능이 되고, 그러면 애초에 안 만드느니만 못하다.
