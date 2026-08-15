# 설문 모듈 — 개발 계획

> 상태: **API · 관리자 화면 완료. 응답자 화면(6-3)부터 남음** · 2026-08-15
> 상위 계획: [PLAN.md](./PLAN.md) — 전략 기획 모듈. 설문은 그 6절에서 갈라져 나온 것입니다.
>
> **내일 여기서부터** → 6절 「다음에 할 일」

---

## 0. 기존 설문 기능에 대하여

`collaboration_board` 모듈에 `Survey`·`SurveyQuestion`·`SurveyResponse`·
`SurveyAnswer` 와 서비스가 **이미 있습니다**(표: `surveys`, `survey_questions`,
`survey_responses`, `survey_answers`). 이 문서의 이전 판에 "포탈에 설문 기능이
전혀 없습니다"라고 적혀 있었는데 **틀린 서술이었습니다.**

다만 **그쪽은 만들다 만 것이라 쓰지 않습니다**(2026-08-15 확인). 재사용하지 않는
이유는 방향이 다르기 때문이기도 합니다 — 그쪽은 익명 여부·중복 응답을 설문마다
켜고 끄는 일반 게시판형 설문이고, 여기서 필요한 것은 **익명 방식이 하나로 고정**
되고 **문항이 진단 축에 연결**되는 설문입니다(3절·6-4).

⚠️ 그래도 **이름은 반드시 겹치지 않게** 지어야 합니다. 이유는 4절 참고.

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

## 2. 진입점 — 두 개다

관리자와 응답자가 완전히 다른 사람이라 **하나로 묶으면 반드시 권한이 꼬입니다.**

```
홈 화면
├─ [디지털 트윈 전략 기획]   admin · dt_office 전용
│    └ 설문 만들기 · 배포 · 집계 · 응답자 확인
│
└─ [설문]  ③건                전원 공개          ← 새 카드
     └ 내가 받은 설문만. 전략 산출물은 안 보임
```

**응답은 반드시 전략 모듈 밖.** 전략 모듈은 `admin`·`dt_office` 전용인데 설문은
전사 대상입니다. 응답을 그 안에 두려면 권한을 뚫어야 하고, 뚫는 순간 초안 전략과
핵심 난제가 샐 위험이 생깁니다. 화면에서 가려도 URL 직접 접근이 남습니다.

**만들기·집계는 반드시 전략 모듈 안.** 설문은 독립 제품이 아니라 전략의 도구입니다.
문항이 단계에 묶이고 결과가 진단 칸으로 들어갑니다. 진단 화면에서
**「이 축을 설문으로 물어보기」** 를 바로 눌러야 맥락이 안 끊깁니다. 별도 모듈로
빼면 "어느 연도, 어느 축을 위한 설문인지"를 매번 다시 골라야 하고, 그러면 아무도
안 씁니다.

**발견성은 배지로.** 홈 타일이 이미 `badge` 를 지원합니다
([MainPage.jsx](../../../pages/MainPage.jsx) 의 `TileBadge`). 미응답 건수를 띄우면
"설문 받았는데 어디서 하지"가 없어집니다. 0건이면 배지 없이 카드만 남습니다.

### 확정 (2026-08-15)

**홈에 설문 모듈 카드를 추가합니다.** 지금까지 만든 것은 전부 사무국/관리자용이라
일반 사용자 화면은 그대로였는데, **이건 조직 전체가 보는 화면을 바꾸는 첫
변경**입니다. 그래서 확인받고 진행합니다.

```javascript
// MainPage.jsx 의 카드 목록
{
  id: "survey",
  name: "설문",
  desc: "받은 설문에 응답합니다",   // ← 이 문구가 중요하다
  route: "/survey",
  // allowedRoles 를 적지 않는다 = 전원 공개
}
```

`desc` 를 "받은 설문에 응답합니다"로 적는 이유는, 이름만 "설문"이면 **설문을
만드는 곳으로 오해**하기 때문입니다. 만드는 곳은 전략 모듈 안입니다.

**카드를 역할로 숨기지 않습니다.** 이 포탈은 카드를 모두에게 보여주고 **누를 때
거부**하는 방식입니다(`MainPage.jsx` 의 `onOpen` → "⚠️ 접근 권한이 없습니다").
설문 카드도 그 방식을 따릅니다.

> ⚠️ PLAN.md 8절에 "해당 역할이 아니면 카드 자체가 보이지 않습니다"라고 적혀
> 있었는데 **틀린 서술이었습니다.** `filtered` 는 검색어·상태·역할필터로만 거르고
> `allowedRoles` 는 보지 않습니다. 지금도 일반 사용자에게 전략 기획 카드가 보이고,
> 누르면 토스트로 거부됩니다. 이 동작을 유지하기로 했습니다.

**응답자 화면도 다른 모듈과 같은 껍데기를 씁니다.**
`shared/components/Header/CommonHeader` + 홈 버튼. 전략 모듈의
`components/Layout/Header.jsx` 가 그 사용 예입니다 — 로고·제목·`onGoHome` 을
넘기고, 모듈 고유 버튼은 `centerContent` 로 얹습니다.

> 대안이었던 것: 설문을 통째로 독립 모듈로 만들고 역할에 따라 다른 화면을
> 보여주는 방식. 나중에 전략 외 용도로도 설문을 쓸 거라면 이쪽이 맞습니다.
> 지금은 진단 축과의 연결이 이 설문의 존재 이유라, 그 연결을 링크 너머로
> 밀어내는 비용이 더 큽니다.

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

`backend/app/modules/digital_twin_strategy/models.py`
마이그레이션 `298c0f1b8fb6` 적용 완료.

```
strategy_survey                 설문 한 벌
  plan_id(CASCADE), title, description, stage,
  target_type(all|department|role|user), target_refs(JSON),
  status(draft|open|closed), closes_at, created_by

strategy_survey_question        문항
  survey_id(CASCADE), order, text, help_text,
  qtype(scale|choice|rank|text), required, options(JSON),
  link_category, link_dimension       ← 진단 축 연결

strategy_survey_response        한 사람의 응답 한 벌
  survey_id(CASCADE), user_id,
  department_name, division_id, division_source(profile|picked|unknown),
  submitted_at
  UNIQUE(survey_id, user_id)          ← 중복 응답 차단

strategy_survey_answer          문항 하나에 대한 답
  response_id(CASCADE), question_id(CASCADE),
  value_number | value_text | value_json
  UNIQUE(response_id, question_id)

strategy_survey_access_log      관리자가 응답자를 확인한 기록
  survey_id(CASCADE), viewer_id, response_id, action
```

### ⚠ 이름에 `Strategy` 접두어가 붙은 이유 (2026-08-15)

처음에는 `Survey`·`SurveyQuestion` 이었는데, **`collaboration_board` 모듈에
같은 이름의 클래스가 이미 있었습니다**(`surveys`·`survey_questions` 표).
같은 declarative base 라서 관계 문자열 `'SurveyQuestion'` 이 모호해지고
**매퍼 설정이 실패해 모든 DB 질의가 죽었습니다.**

그리고 그 상태로 **v0.1.22 가 릴리스되어 개발서버에 배포까지 됐습니다.** 이유가
셋입니다 — 마이그레이션 생성·적용은 매퍼를 완전히 설정하지 않고, 표 존재
확인(inspect)도 매퍼를 안 건드리며, **CI 는 `backend\tests` 가 없어 pytest 를
통째로 건너뛰고 있었습니다.** 즉 모델을 고치고 질의를 한 번도 안 해본 것입니다.

→ `backend/scripts/check_models.py` 를 만들어 CI 에 넣었습니다. DB 없이
모든 모델을 불러와 `configure_mappers()` 를 부르고 표 이름 중복도 봅니다.
충돌을 일부러 만들어 실제로 잡는 것까지 확인했습니다.

**새 모델은 모듈 접두어로 짓습니다**(`StrategySurvey`, `Dt2Project` 처럼).
짧은 일반명은 언젠가 부딪힙니다.

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

`backend/app/modules/digital_twin_strategy/` 안에 `survey_routes.py` 를 새로 둡니다.
`routes.py` 에 섞지 않는 이유는 **권한 기준이 다르기 때문**입니다 — 그 파일의
`office_required` 가 전부에 걸려 있어, 응답자용을 같이 두면 실수로 막히거나
실수로 열립니다.

**관리자용** (`office_required`)

```
GET    /api/digital-twin-strategy/plans/<year>/surveys        목록
POST   /api/digital-twin-strategy/plans/<year>/surveys        생성(문항 포함)
GET    /api/.../surveys/<id>                                  문항까지 조회
PUT    /api/.../surveys/<id>                                  수정
DELETE /api/.../surveys/<id>
PUT    /api/.../surveys/<id>/status                           배포·마감·회수
GET    /api/.../surveys/<id>/results                          집계 (익명)
GET    /api/.../surveys/<id>/identities                       응답자 확인 → 감사 로그
```

상태 전환을 `open`·`close` 두 엔드포인트로 나누지 않고 `status` 하나로 둡니다.
되돌리는 경우(`open → draft`)까지 생각하면 동사마다 엔드포인트를 파는 것보다
상태를 넘기는 편이 단순하고, 상태가 늘어나도 경로가 안 늘어납니다.

**응답자용** (로그인만 요구, 역할 무관)

```
GET    /api/surveys/mine                내가 받은 설문 (미응답 우선)
GET    /api/surveys/mine/count          홈 배지용 미응답 건수
GET    /api/surveys/<id>/form           문항 (대상자만)
POST   /api/surveys/<id>/responses      제출 (1인 1회)
```

**지킨 것** (`survey_routes.py`)

- 대상자 판정은 `is_target(user, survey)` **한 곳**뿐. 목록·조회·제출이 전부
  이걸 쓴다 — 흩어 쓰면 목록엔 안 뜨는데 id 로 POST 하면 받아지는 구멍이 생긴다.
- 응답 직렬화는 `serialize_response(r, reveal=False)` **한 곳**뿐이고
  **기본값이 '가린다'** 다. 깜빡하면 더 가려지지, 새지 않는다.
- `status != 'open'` 이거나 `closes_at` 이 지났으면 거부(`_accepting()`).
- 제출은 **DB 를 건드리기 전에 전부 검증**한다. 처음엔 넣으면서 검사했는데,
  알 수 없는 문항이 섞이면 응답이 반쯤 저장된 채 400 이 나갔다 —
  **테스트가 첫 실행에서 잡았다.**
- 응답이 있는 설문은 문항 수정을 막는다(409). 바꾸면 이미 받은 답이 무엇에
  대한 답이었는지 알 수 없다.

**테스트** — `backend/tests/test_survey_api.py` 19개. 권한과 익명성부터 짰다.
`backend/tests` 가 없어서 CI 의 pytest 가 통째로 건너뛰어지고 있었고, 그게
매퍼 충돌이 릴리스까지 간 이유였다. 이제 **`backend-tests` 잡(ubuntu +
postgres 서비스)** 이 따로 돈다 — Windows 러너에는 Postgres 가 없고 Actions 의
`services:` 도 리눅스 전용이다.

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
