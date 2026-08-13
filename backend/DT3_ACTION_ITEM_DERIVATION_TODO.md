# 액션아이템 파생 — 운영 반영 절차 (2026-08-03 작성)

개발서버 반영·검증 완료. **운영 미반영.** 나중에 올릴 때 이 문서대로 한다.

---

## 무엇이 바뀌나

**액션아이템이 정본이 된다.** 상위 액션아이템의 완료여부·완료일과 과제 진행률을
서버가 액션아이템에서 계산한다. 진행상태는 서버가 바꾸지 않고, 액션아이템과
어긋나는 조합을 거절만 한다.

| | 규칙 |
|---|---|
| 상위 완료여부 | 세부항목이 전부 완료면 완료 (세부항목이 없으면 그 자신이 정본) |
| 상위 완료일 | 세부항목 중 **마지막 완료일**. 세부항목에 날짜가 하나도 없으면 기존 값 유지 |
| 진행률 | 액션아이템 균등 기여 × 세부항목 완료 비율. 액션아이템 0건이면 0 |
| 진행률 직접 쓰기 | 액션아이템이 1건이라도 있으면 — AI·MCP 는 **400**, 화면은 `ignored` |
| 진행상태 `완료` | 액션아이템이 **모두** 완료가 아니면 **400** |
| 진행상태 `미착수`·`계획`·`미배정` | 완료된 액션아이템이 있으면 **400** |

**화면과 AI 는 여기서 갈린다.** 진행상태 자동 조정은 화면에만 있는 동작이고, 서버는
진행상태를 바꾸지 않는다(핵심 필드라 확인 대기를 우회하게 되므로). 그래서 미착수·계획
과제의 액션아이템을 완료로 바꿀 때 — 화면은 진행상태를 알아서 `정상진행` 으로 올리지만,
AI 는 `진행상태` 를 **같이 보내야** 한다. 안 보내면 400 이다.
같이 보내면 서버가 **둘 다 확인 대기로 묶는다**(`applied` 가 비고 `alsoPending` 에
액션아이템목록이 들어온다). 액션아이템만 먼저 반영되어 과제가 잠기는 것을 막기 위해서다.

왜 이렇게 했는지와 배경은 대화 기록 및 `routes_v2.py` 의 「액션아이템 파생」 절 주석 참고.

### 바뀐 파일

```
backend/app/modules/digital_twin_dashboard/routes_v2.py    파생·불변식 (핵심)
backend/app/modules/digital_twin_dashboard/ai_tools.py     describe_fields 안내문
backend/scripts/dt3_backfill_action_items.py               신규 — 조사/백필
backend/scripts/dt3_seed_2026_projects.py                  진행률을 안 보내게
backend/scripts/dt3_test_edge2.py                          시험 — 진행률 대신 설명 사용
backend/scripts/dt3_test_koreankeys.py                     시험 — 파생 규칙 검사 추가
frontend/src/shared/utils/localDate.js                     projectCompletedYmd 추가
frontend/src/modules/digital-twin-dashboard/components/ProjectModal/components/BasicInfoSection.jsx
frontend/src/modules/digital-twin-dashboard/components/ProjectModal/components/ActionItemsSection.jsx
mcp_server/server.py                                       patch_project 설명
mcp_server/skill/digitaltwin/SKILL.md                      진행률·진행상태 안내
```

**DB 마이그레이션 없다.** 스키마는 그대로다 — `flask db upgrade` 는 이 변경 때문에
필요하지 않다(다른 변경과 함께 올린다면 그건 그 변경의 절차를 따른다).

---

## 반영 절차

### 1. 반입 (아직 재시작하지 않는다)

폴더 통째 압축 반입. **백엔드와 프론트 빌드를 반드시 함께** 올린다.

> ⚠️ 백엔드만 먼저 올리면 화면에서 진행상태를 `완료` 로 고를 때 상위 액션아이템만
> 켜지고 세부항목이 안 켜져, 서버가 상위를 다시 미완료로 파생시키면서 **저장이 400**
> 이 된다. 구 프론트 + 신 백엔드 조합은 쓰지 않는다.

`.env` 도 같이 가므로 압축 전에 값을 확인한다.

### 2. 재시작 **전에** 현황 조사 — 여기가 제일 중요하다

```
python scripts\dt3_backfill_action_items.py
```

읽기만 한다(`--commit` 없으면 아무것도 안 쓴다). 두 가지를 본다.

- **`진행상태가 액션아이템과 어긋난 과제`** — 이게 0건이 아니면 **그 과제들은 재시작
  후 어떤 저장도 400 이 된다.** 불변식이 "이번 저장이 끝난 뒤의 상태" 를 보기 때문에,
  진행상태를 건드리지 않는 저장도 막힌다.
  → **아직 구 코드가 돌고 있는 지금** 화면에서 정리한다. 재시작한 뒤에는 그 과제를
    화면에서도 못 고친다. 상태를 내릴지 액션아이템을 완료로 볼지는 사람이 정한다.
- `손볼 것 N건` — 백필 대상. 값이 얼마나 움직이는지 미리 본다.

개발서버 기준으로는 어긋난 과제가 0건이었지만, **운영은 데이터가 다르므로 반드시
직접 확인한다.**

### 3. 서비스 재시작

백엔드·프론트 함께. MCP 서버도 별도 프로세스이므로 같이 재시작한다
(`server.py` 의 도구 설명과 `SKILL.md` 가 바뀌었다. `describe_fields` 는 백엔드에서
오므로 자동으로 새 안내가 나간다).

### 4. 백필

```
python scripts\dt3_backfill_action_items.py            # 다시 한 번 dry-run
python scripts\dt3_backfill_action_items.py --commit   # 반영
```

DB 를 직접 UPDATE 하지 않고 **PATCH API 를 지난다.** 그래서 변경 이력과 진척 이력이
정상적으로 남는다. `reason` 에 `액션아이템 파생 백필 …` 로 찍히므로 나중에 골라낼 수 있다.

> 백필을 안 하면 파생이 안 도는 게 아니다. 앞으로의 저장은 그대로 파생된다.
> 다만 **아무도 저장하지 않은 과제**는 옛 진행률이 그대로 화면에 보이고, 과제마다
> 다음 저장 시점에 값이 제각각 튀어 진척 추이에 계단이 흩어진다. 한 번에 정리하면
> 계단이 한 시점에 한 번만 생긴다.

기본 계정은 `yjtwin.park@samsung.com` 이다. 운영 계정이 다르면 `--email` 로 준다.
그 계정은 **전 과제를 고칠 수 있어야** 한다.

### 5. 확인

```
python scripts\dt3_backfill_action_items.py    # 손볼 것 0건 · 어긋난 과제 없음
python scripts\dt3_test_api.py
python scripts\dt3_test_invariants.py
python scripts\dt3_test_koreankeys.py
```

화면에서:
- 액션아이템의 세부항목 하나를 체크 → 상위가 자동 완료되고 진행률이 따라 오르는가
- 진행률 입력칸이 잠겨 있는가(액션아이템이 있는 과제)
- 액션아이템 상위를 체크 → 아래 액티비티가 전부 체크되고 **완료일까지** 채워지는가
- `지연` 과제에서 액티비티를 하나 체크 → 진행상태가 **`지연` 으로 그대로 있는가**
  (예전에는 `정상진행` 으로 조용히 바뀌었다)

MCP 에서:
- `describe_fields` 의 `진행률` 에 "액션아이템에서 자동 계산" 안내가 보이는가
- 액션아이템이 있는 과제에 `patch_project({"진행률": …})` → 400 인가

---

## 되돌리기

코드를 되돌리면 파생과 불변식이 함께 멈춘다. 백필로 바뀐 값은 DB 에 남지만,
그 값들은 화면이 쓰던 것과 같은 공식으로 계산된 값이라 구 코드에서도 문제가 되지
않는다. 다만 **상위 액션아이템의 완료일**만 규칙이 다르다(신: 세부항목 마지막 완료일 /
구: 저장 시점). 되돌린 뒤 그 칸을 다시 저장하면 저장 시점 날짜로 덮인다.

---

## 아직 안 한 것 / 알려진 문제

- **CSV 임포트** (`importExportUtils.js`) — `parseActionItemList` 가 세부항목을 아예
  만들지 않고 `완료여부:false` 로만 넣는다. 내보내기→가져오기 라운드트립에서
  세부항목이 통째로 사라진다. 파생과는 별개 문제.
