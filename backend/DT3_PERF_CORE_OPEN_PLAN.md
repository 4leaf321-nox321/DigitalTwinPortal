# 성과 핵심 필드 개방 — 계획 (2026-08-05 작성)

AI·MCP 가 성과의 **핵심 필드**(목표수준·단위·대분류 등)를 고칠 수 있게 한다.
지금은 **403** 이고, 확인 대기로도 가지 않아 `confirm_change` 를 찾을 수조차 없다.

> 관련 문서: `mcp_server/README.md`(쓰기 갈래) · `DT2_CUTOVER_TODO.md` §4-9(운영 반출)

---

## 1. 지금 무엇이 되고 무엇이 안 되나

실측(2026-08-05)으로 확인한 것:

| 하려는 일 | 지금 |
|---|---|
| 과제 진척도 체크 (액션아이템 완료) | **200 즉시.** 서버가 `진행률` 을 파생시켜 함께 반영 |
| 성과 **실적치** 입력 (`실적수준`) | **200 즉시** |
| 성과 **목표** 입력 (`목표수준`) | **403** ← 이번에 여는 것 |
| 과제 핵심 필드 (`진행상태` 등) | **202** → 확인 → 반영 |

성과에서 AI 가 고칠 수 있는 것은 저위험 7개뿐이다 —
`실적수준` `조치사항` `조치사항목록` `성과평가` `설명` `월별실적` `보고현황목록`.

## 2. 왜 막아 뒀고, 왜 이제 열어도 되나

**막은 이유는 권한이 아니었다.** 성과는 **여러 과제가 공유**해서, 승인자가 자기 과제만
보고 승인하면 **남의 과제 숫자가 조용히 틀어진다** — 그것이 이유였다.

그런데 **같은 우려를 이미 해결한 선례가 있다.** `link_performances`(과제-성과 연결)도
같은 이유로 403 이었는데, 막는 대신 **202 로 보내고 `preview` 에 그 성과를 함께 쓰는
다른 과제(`affectedProjects`)를 실어** 보내는 쪽으로 바꿨다. 우려의 **원인을 없앤** 것이다.

성과 본체 수정도 같은 방법이 통한다. 필요한 재료가 이미 다 있다:

| 필요한 것 | 이미 있는 것 |
|---|---|
| 영향받는 과제 목록 | `_projects_sharing()` — 연결 변경 때 쓰는 그 함수 |
| 승인 권한 규칙 | **`can_edit_performance()`** — 아래 참조 |
| 확인 절차·도구 | `confirm_change` · `cancel_change` · `list_proposals` **그대로 쓴다** |

### 승인 권한은 새로 만들지 않는다

`can_edit_performance()` 가 이미 원하는 규칙 그대로다:

```
admin / dt_office   항상 허용
생성자              본인이 만든 성과 (아직 아무 과제도 안 붙었을 때)
연결된 과제 담당     그 성과를 쓰는 과제 중 하나라도 고칠 수 있으면 허용
```

**결정 (2026-08-05):** 공유 과제가 2건 이상이어도 **관리자 승인을 요구하지 않는다.**
연결된 과제 중 하나라도 고칠 수 있는 사람이면 승인할 수 있다. 즉 위 함수를 그대로 쓴다.

## 3. 삭제 계열은 열지 않는다

성과 핵심 17개 안에 **`_deleted` · `_deletedAt`** 이 들어 있다.
core 를 통째로 열면 **AI 가 성과를 지울 수 있게 된다.**

성과 삭제는 되돌릴 수 없는 종류다 — 지우면 **그 성과를 쓰던 모든 과제의 연결이 함께
사라지고, 복구해도 연결은 돌아오지 않는다.** 오늘 과제 `_permanentlyDeleted` 를 막은 것과
같은 판단이라, **삭제 계열은 core 에서 빼서 계속 막는다.**

| 필드 | 지금 | 바꾼 뒤 |
|---|---|---|
| `목표수준`·`현재수준`·`성과항목`·`대분류`·`소분류`·`성과년도` 등 | 403 | **202** |
| `계산로직`·`디지털트윈기여도`·`월별실적여부`·`로직입력여부`·`displayName` | 403 | **202** |
| **`단위` · `isAchievementType`** | 403 | **열지 않는다 — 소분류에서 파생.** §3-2 |
| **`_deleted` · `_deletedAt`** | 403 | **계속 막는다** (IMMUTABLE 로 내림) |
| `isActive` | 403 | **계속 막는다** — 비활성화는 사실상 숨기기다 |

## 3-2. `단위` 는 성과의 값이 아니다 — 소분류의 사본이다 (2026-08-05 확인)

**처음 계획에서 `단위` 를 202 로 열려던 것은 틀렸다.**

`performance_subcategories.unit` 이 단위를 정의하고 있고, **화면은 그것을 읽기 전용으로
잠근다** (`AddPerformanceModal.jsx` — 소분류에 `unit` 이 있으면 `disabled + readOnly`).
활성 소분류 35개가 **전부** `unit` 을 갖고 있으므로, 화면에서 단위는 **항상 읽기 전용**이다.

그런데 서버의 `dt2_performances.unit` 은 **검증이 하나도 없는 자유 컬럼**이다. 그래서:

- 열면 **MCP 가 화면보다 느슨해진다** — 오늘 영구삭제에서 겪은 것과 같은 함정이다.
- 이미 갈라져 있었다: **112건 중 35건(31%)** 이 소분류 단위와 달랐다(2026-08-05 실측).
- 더 나쁜 것은 **화면에서 고칠 수도 없다**는 점이다. 수정 창은 저장된 값을 그대로 싣고
  읽기 전용으로 잠근다 — 소분류에서 다시 계산하지 않는다. **틀린 채로 굳는다.**

`관리자`(manager_name)가 `과제PL` 의 사본이었던 것과 **같은 구조**다. 그때 결론이 그대로 적용된다 —
**입력을 막는 것만으로는 부족하다. 서버가 파생시켜야 한다.**

### 해야 할 일

| | |
|---|---|
| **① 소분류 단위 통일** | ✅ 2026-08-05 완료 — `억`→`억원`(6) · `day`→`hrs`(1) |
| **② 성과 데이터 정합** | ✅ 2026-08-05 완료 — 30건 갱신, 어긋남 0 |
| **③ 서버 파생** | ✅ 2026-08-05 완료 — `_derive_perf_from_subcategory()` |
| **④ 분류 이동 시 재파생** | ✅ ③과 같은 함수가 처리한다 |

### ③④ 구현 (2026-08-05 완료)

**새 분류 `derived`** — `PERF_DERIVED_FIELDS = {unit, is_achievement_type}`.

⚠️ **IMMUTABLE 에 넣지 않았다.** 넣으면 화면이 폼 전체를 보낼 때마다 `ignored` 에 떠서
소음이 된다. 대신 **분류에 태우기 전에 떼어내고** 소분류 값으로 채운다.

| 경로 | 동작 |
|---|---|
| 생성 | 보낸 단위를 무시하고 소분류 값으로. `normalized` 로 알림 |
| 수정 (단위만) | **200 인데 `applied` 가 빈다.** `message` 가 왜인지 말한다 |
| 수정 (소분류 이동) | 단위가 **따라온다**. `normalized` 로 알림 |
| 소분류에 `unit` 이 없으면 | 손대지 않는다 — 화면도 그때는 커스텀 입력을 허용한다 |

실측:

```
생성 시 dB 를 보냄        → 201, 저장된 단위 '%',  ignored 비어 있음
단위만 '건' 으로 바꾸려 함 → 200, applied=[], "단위는 소분류 `예측 정확도` 가 정합니다"
소분류를 시료비용으로 이동 → 200, 단위가 '억원' 으로 따라옴
```

**403 이 아니라 200 인 것이 중요하다** — 거절이 아니라 파생이다. 다만 조용히 넘기지
않는다(`normalized` + `message`). 안 그러면 부르는 쪽은 자기 값이 저장된 줄 안다.

회귀: `dt3_test_performance_mcp`(A·D-2) · `dt3_test_mcp_e2e`(H) · `dt3_test_skill`
(`PERF_CLAIMS` 의 `단위`·`isAchievementType` → `derived`). **전체 30개 928 [OK] / 0 FAIL.**

⚠️ **②를 하면서 지표를 다시 쓴 것이 있다.** 소분류 단위에 맞추느라 절대 오차(도·dB)를
**오차율(%)** 로, 감소율(%)을 **절대 시간(hrs)** 으로 바꿨다. 값의 뜻이 달라진 항목이라
`dt3_perf_2026_data.py` 의 해당 줄과 설명을 함께 봐야 한다.

⚠️ **`예측 정확도` 소분류에 온도·음향이 섞여 있다.** 지금은 전부 `%`(오차율)로 눌렀지만,
절대 오차가 자연스러운 지표라 **소분류를 쪼개는 것**이 더 맞을 수 있다. 열어 둔 논점이다.

---

## 4. 설계

### 4-1. 제안 테이블 확장 — **마이그레이션 필요**

`dt2_change_proposals` 는 지금 **과제 전용**이다:

```python
project_uuid = db.Column(..., ForeignKey('dt2_projects.uuid'), nullable=False, index=True)
```

성과 제안은 과제에 속하지 않으므로(여러 과제가 공유) 담을 자리가 없다.

```
project_uuid      nullable=False  →  nullable=True
performance_uuid  신규 (nullable, FK dt2_performances.uuid, ondelete CASCADE)
target_type       신규 ('project' | 'performance', nullable=False, default 'project')
```

⚠️ **`target_type` 을 명시한다 — uuid 유무로 추론하지 않는다.** 둘 다 비었거나 둘 다 찬
행이 생겼을 때 분기가 **조용히** 틀어진다. 기존 행은 전부 `'project'` 로 채운다.

### 4-2. `patch_performance` — 403 을 202 로

지금 코드(`routes_v2.py`):

```python
is_ai = (body.get('actor_mode') == 'ai')
if is_ai and cls.core:
    return error_response('AI 는 성과의 핵심 필드를 직접 고칠 수 없습니다. ...', 403)
```

이 자리를 제안 생성으로 바꾼다. 응답에 싣는 것:

- `preview` — before → after (과제와 같은 모양)
- `performanceTitle` · `performanceCode` — **어느 성과를 집었는지** 사용자가 판단할 근거
- `affectedProjects` — 이 성과를 함께 쓰는 과제들 (`_projects_sharing` 재사용)
- `unitChangeWarning` — `단위`·`성과년도` 를 바꿀 때. **과거 실적값과 비교가 무의미해진다**는
  것은 before/after 만 봐서는 안 보인다

⚠️ **저위험 필드도 함께 대기시킨다.** 과제의 `alsoPending` 과 같은 이유다 —
`단위` 를 대기시키고 `실적수준` 만 즉시 반영하면 **숫자의 뜻이 어긋난 채로 남는다**
(12 가 '%' 인지 '건' 인지 모르는 상태). 성과는 core 가 하나라도 있으면 **전부 묶는다.**

### 4-3. `approve` / `reject` — 성과 분기

지금 승인 라우트는 전부 과제 기준이다(`pr.project_uuid` → 과제 로드 → `classify_patch`).
`target_type` 으로 갈라 성과 경로를 만든다:

| 단계 | 과제 (기존) | 성과 (신규) |
|---|---|---|
| 대상 로드 | `Dt2Project` | `Dt2Performance` |
| 권한 | `can_review_proposal` → `can_edit_project` | **`can_edit_performance`** |
| 분류 | `classify_patch` | `classify_performance_patch` |
| 낙관적 락 | 과제 `row_version` vs `base_version` | 성과 `row_version` vs `base_version` |
| 이력 | `Dt2ProjectChange` | **`record_performance_history(source='ai')`** |

⚠️ **승인 시점에도 분류를 다시 본다.** 지금 과제 경로가 그렇게 한다 — "이 방침이 생기기
전에 쌓인 대기 건" 이 출구로 그대로 들어오는 것을 막기 위해서다. 성과도 같게 한다.

### 4-4. 이미 있는 검증이 AI 경로에도 걸린다 (확인 필요)

`patch_performance` 의 접두어 검증(`_ensure_division_prefix`)과 대분류·소분류 짝
검증(`_validate_perf_classification`)은 **403 검사보다 먼저** 실행된다. 따라서 열어도
그대로 걸린다 — **다만 두 곳의 주석이 "AI 는 여기까지 오지 않는다(403)" 라고 적혀 있어
반드시 고쳐야 한다.** 주석이 틀리면 다음 사람이 그 전제로 코드를 옮긴다.

회귀에서 **AI 경로로도 400 이 나는지** 못 박는다(지금은 사람 경로만 검사한다).

### 4-5. 안내 — 세 곳

| 파일 | 무엇 |
|---|---|
| `ai_tools.py` `_PERF_RISK_NOTE['core']` | "403 이다. 확인 대기로도 안 간다" → 202 절차로 |
| `ai_tools.py` `describe_performance_fields()['rules']` | 같은 문구가 `rules` 에도 있다 |
| `mcp_server/server.py` `patch_performance` docstring | ⚠️ 블록 전체 교체 |
| `mcp_server/skill/digitaltwin/SKILL.md` 「성과」절 | risk 표 + "403 을 받으면" 문단 |

### 4-6. 화면 변경 — **없다**

승인 화면을 만들지 않았다(확인을 대화 안으로 옮겼다). 성과도 같은 경로를 쓰므로
프론트 변경이 없다. `list_proposals` 응답에 성과 건이 섞이는 것만 확인하면 된다.

---

## 5. 회귀 — **기존 3곳이 지금 동작을 못 박고 있다**

여는 순간 **빨간불이 된다.** 계획대로 뒤집는 것이지 시험이 틀린 게 아니다.

| 파일 | 항목 | 어떻게 |
|---|---|---|
| `dt3_test_performance_mcp.py` | A `핵심 필드 안내가 403 을 말한다` | 202 를 말하는지로 |
| 〃 | D `핵심 PATCH 는 403` | **202 → confirm → 반영** 으로 |
| `dt3_test_performance.py` | `★ AI + 목표수준 403` | 〃 |

**새로 볼 것:**

- 202 응답에 `affectedProjects` 가 실린다 — 0건·1건·2건 이상 각각 ★★
- `confirm_change` 로 실제 반영되고 `Dt2PerformanceHistory` 에 `source='ai'` 로 남는다
- **저위험이 섞이면 함께 대기한다**(`applied` 가 비고 `alsoPending` 에 들어온다) ★
- **`_deleted`·`isActive` 는 여전히 막힌다** ★★ — 여기가 이번 변경에서 제일 샐 만한 곳
- 권한 없는 사람은 승인도 못 한다(`can_edit_performance` 실패 → 403)
- 접두어·분류 짝 검증이 **AI 경로에서도** 400 을 낸다 ★
- 승인 대기 중 다른 사람이 같은 필드를 고치면 `stale` / 409
- `list_proposals` 에 과제 건과 성과 건이 섞여 나와도 각각 알아볼 수 있다

---

## 6. 단계

| | 무엇 | 상태 |
|---|---|---|
| **0** | 결정 2건 못 박기 | ✅ 삭제 계열 제외 · 관리자 승인 불요 |
| **1** | 스키마 + 마이그레이션 | ✅ `8c4d2b02a4a2` — 기존 307건이 `target_type='project'` 로 채워짐 |
| **2** | 삭제 계열을 core 에서 빼기 | ✅ `_deleted`·`_deletedAt`·`isActive` 는 IMMUTABLE |
| **3** | `patch_performance` 202 분기 | ✅ preview·affectedProjects·alsoPending |
| **4** | `approve`/`reject`/`list_proposals` 성과 분기 | ✅ `_approve_performance_proposal()` |
| **5** | 안내 4곳 | ✅ describe · server.py · SKILL.md · 이 문서 |
| **6** | 회귀 | ✅ 기존 4곳 뒤집기 + 신규 — **30개 935 [OK] / 0 FAIL** |
| **7** | 운영 반출 항목 추가 | ✅ `DT2_CUTOVER_TODO.md` §4-9 (마이그레이션 필요 명시) |

**2단계를 3단계보다 먼저 한 이유** — 순서를 바꾸면 "core 를 열었는데 삭제도 같이
열린" 상태가 잠깐 존재한다. 그 사이에 누가 시험을 돌리면 성과가 지워진다.

### 실측 (2026-08-05)

```
① AI 가 목표수준+실적수준을 함께 보냄
   → 202  proposalId=954
          preview     {"목표수준": {"before":"80","after":95},
                       "실적수준": {"before":"40","after":"55"}}
          alsoPending ['실적수준']        ← 저위험도 함께 대기
          affectedProjects ['__202A__','__202B__']   ← 공유 과제가 보인다
          이 시점 DB: 목표 80, 실적 '40'  ← 아직 그대로

② list_proposals  → targetType='performance', performanceTitle 로 알아볼 수 있다

③ confirm_change  → 200  applied=['actual_level','target_level']
                         목표 95 · 실적 '55' · rowVersion 2 · 이력 source='ai'
```

### 구현에서 갈린 다섯 가지 (과제 경로와 다름)

| | 과제 | 성과 |
|---|---|---|
| 대상 | `Dt2Project` | `Dt2Performance` |
| 권한 | `can_review_proposal` → `can_edit_project` | **`can_edit_performance`** |
| 분류 | `classify_patch` | `classify_performance_patch` |
| 낙관적 락 | 과제 `row_version` | 성과 `row_version` |
| 이력 | `Dt2ProjectChange` | `record_performance_history(source='ai')` |

`stale` 판정은 같은 방식이다 — 버전이 아니라 **제안이 건드리는 바로 그 필드**가
그 사이 바뀌었는지 본다. 버전만 보면 무관한 수정에도 걸린다.

---

## 7. 과제 쪽 — 별도 결정

**진척도 체크와 실적 입력은 이미 열려 있다**(200 즉시). 과제 핵심 21개도 이미 202 로 된다.
지금 과제에서 정말 막힌 것은 셋이고, 아직 고르지 않았다:

| 후보 | 지금 | 열려면 |
|---|---|---|
| `담당자` · `소유자` | 403 | 이름만 담기는 형태 → **knoxId 를 받는 형태**로 바꿔야 한다(`과제참여인력목록` 선례). ⚠️ 소유자는 편집 권한을 준다 |
| `선행과제목록` | 쓰기 API 없음 | `PUT /projects/<uuid>/dependencies` 신설. 화면의 숨긴 편집 UI 도 살아난다. 운영 실측 0건이라 급하지 않음 |
| 이미지 5개 | 파일 업로드 | MCP 로는 base64 전송이라 토큰이 폭증한다. **권장하지 않음** |

---

## 8. 안 하기로 한 것

- **관리자 승인 단계** — 공유 과제가 많아도 두지 않는다(2026-08-05 결정).
  되살릴 조건: 사람이 시키지 않는 **자율 에이전트**를 붙일 때.
  그때는 과제 쪽 `can_review_proposal` 주석의 조건과 같이 판단한다.
- **성과 삭제 도구** — 계속 두지 않는다. §3 참조.
- **승인 화면** — 확인은 대화 안에서 끝난다. §4-6 참조.
