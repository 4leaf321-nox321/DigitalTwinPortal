# 운영서버 통합 런북 — Phase 1 (배포 → 백업 → 스냅샷 정리 → 이미지 분리)

> 대상: **운영서버에서 직접 실행** (AI 없음 · 인터넷 없음)
> 이 문서 하나만 위에서 아래로 따라가면 된다. 다른 런북은 문제가 생겼을 때만 참조한다.
> 소요: **약 2~3시간** (대부분 백업 대기 시간)
> 서비스 중단: **없음.** 재시작 수 초 + VACUUM 중 스냅샷 화면만 잠시 대기

## 이 작업으로 달라지는 것

| | 지금 | 완료 후 |
|---|---|---|
| 저장 1회 왕복 전송 | **74.9 MB** | **약 3.8 MB** |
| 저장 1회 서버 디스크 쓰기 | **74.8 MB** | **약 3.5 MB** |
| 스냅샷 누적 디스크 | **25.2 GB** | 수백 MB (증가 정지) |

---

## 이 런북을 쓰는 법

- 명령은 **그대로 복사해서 붙여넣는다.**
- 각 단계의 **"이 결과가 나와야 정상"** 과 다르면 **거기서 멈춘다.**
- **판단하지 않는다.** 예상과 다르면 화면을 캡처하고 담당자에게 전달한다.
- ★ 표시는 **건너뛰면 안 되는 검증 지점**이다.

## 전체 순서와 이유

```
A. 준비           변수 설정 · 사전 점검
B. 백업 ★         모든 되돌리기의 전제. 여기가 가장 오래 걸린다
C. 배포           코드 교체 + DB 마이그레이션 + 재시작
D. 배포 검증 ★     자동 스냅샷이 멈췄는지 · 화면이 정상인지
E. 스냅샷 정리     25.2 GB 회수  (C 이후에 해야 새로 안 쌓인다)
F. 이미지 추출     원본은 그대로 두고 파일로 복사
G. 화면 확인 ★     이미지가 정상으로 보이는지 눈으로 확인
H. 원본 제거       여기서 payload 가 급감
I. 최종 확인
```

**순서가 중요한 이유**
- B 없이 E·H 를 하면 되돌릴 수 없다
- C 없이 E 를 하면 정리하는 동안 다시 쌓인다
- G 없이 H 를 하면 이미지가 안 보이는 걸 모른 채 원본을 지우게 된다

---

# A. 준비

## A-1. 변수 설정 — **경로와 비밀번호만 수정**

```powershell
$PROJ   = "C:\경로를_여기에\52_KnowledgeGraphProject"
$BACKUP = "D:\dt_backup"
$PGBIN  = "C:\Program Files\PostgreSQL\17\bin"
$DB     = "dxdigitaltwin"
$env:PGPASSWORD = "여기에_비밀번호"
```

이어서 그대로 실행 (수정 불필요):

```powershell
$STAMP = Get-Date -Format "yyyyMMdd_HHmm"
New-Item -ItemType Directory -Force -Path $BACKUP | Out-Null

# 이미 만들어 둔 백업 파일이 있으면 그것을 가리킨다 (창을 닫았다 다시 열어도 안전)
$COREBK = (Get-ChildItem $BACKUP -Filter "core_*.dump"      -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
$SNAPBK = (Get-ChildItem $BACKUP -Filter "snapshots_*.dump" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName

Write-Host "작업 스탬프 : $STAMP"
Write-Host "백업 폴더   : $BACKUP"
Write-Host "core 백업   : $(if($COREBK){$COREBK}else{'(아직 없음 — B-1 에서 생성)'})"
Write-Host "스냅샷 백업 : $(if($SNAPBK){$SNAPBK}else{'(아직 없음 — B-2 에서 생성)'})"
```

> ⚠️ **PowerShell 창을 닫았다면 A-1 을 다시 실행한다.**
> `$STAMP` 는 새 시각으로 바뀌지만, `$COREBK`·`$SNAPBK` 는 **이미 만든 백업 파일을 자동으로 찾아** 가리킨다.
> 이후 단계에서 백업 파일을 쓸 때는 `$STAMP` 가 아니라 **`$COREBK` / `$SNAPBK`** 를 사용한다.

## A-2. 사전 점검

```powershell
& "$PGBIN\pg_dump.exe" --version
& "$PGBIN\psql.exe" -U postgres -h localhost -d $DB -t -c "SHOW server_version;"
& "$PGBIN\psql.exe" -U postgres -h localhost -d $DB -c "SELECT pg_size_pretty(pg_database_size(current_database())) AS db크기;"
Get-PSDrive ($BACKUP.Substring(0,1)) | Select-Object Name, @{n='FreeGB';e={[math]::Round($_.Free/1GB,1)}}
```

**정상 조건**
- `pg_dump` 버전 **≥** 서버 버전
- 디스크 여유가 **DB 크기의 2배 이상**

**실패 시** — 중단하고 담당자에게 알린다.

## A-3. 현재 상태 기록 ★ 나중에 대조할 숫자다

```powershell
& "$PGBIN\psql.exe" -U postgres -h localhost -d $DB -c "SELECT (SELECT version FROM dashboard_data LIMIT 1) AS 데이터버전, (SELECT count(*) FROM dashboard_snapshots) AS 스냅샷, (SELECT count(*) FROM project_attachments) AS 첨부, (SELECT count(*) FROM users) AS 사용자, (SELECT count(*) FROM dashboard_activity_logs) AS 로그;" | Tee-Object -FilePath "$BACKUP\baseline_$STAMP.txt"
& "$PGBIN\psql.exe" -U postgres -h localhost -d $DB -c "SELECT pg_size_pretty(octet_length(projects::text)::bigint) AS projects크기, json_array_length(projects) AS 과제수, json_array_length(performances) AS 성과수 FROM dashboard_data;" | Tee-Object -Append -FilePath "$BACKUP\baseline_$STAMP.txt"
```

**화면의 숫자를 적어둔다.** `baseline_*.txt` 에도 저장된다.

---

# B. 백업 ★ 여기를 건너뛰면 안 된다

## B-1. 핵심 백업 (스냅샷 제외 — 빠르다)

```powershell
$T0 = Get-Date
& "$PGBIN\pg_dump.exe" -h localhost -U postgres -d $DB `
  --format=custom --compress=6 --no-owner --no-privileges `
  --exclude-table-data=public.dashboard_snapshots `
  -f "$BACKUP\core_$STAMP.dump"
Write-Host "종료코드: $LASTEXITCODE / $([int]((Get-Date)-$T0).TotalMinutes)분"
Get-Item "$BACKUP\core_$STAMP.dump" | Select-Object Name, @{n='MB';e={[math]::Round($_.Length/1MB,1)}}
```

**정상** — 종료코드 `0`, 파일 크기 0 아님.

## B-2. 스냅샷 백업 (오래 걸린다 — 20분~1시간)

```powershell
$T0 = Get-Date
& "$PGBIN\pg_dump.exe" -h localhost -U postgres -d $DB `
  --format=custom --compress=6 --no-owner --no-privileges `
  --table=public.dashboard_snapshots `
  -f "$BACKUP\snapshots_$STAMP.dump"
Write-Host "종료코드: $LASTEXITCODE / $([int]((Get-Date)-$T0).TotalMinutes)분"
Get-Item "$BACKUP\snapshots_$STAMP.dump" | Select-Object Name, @{n='GB';e={[math]::Round($_.Length/1GB,2)}}
```

> 화면이 멈춘 것처럼 보여도 **기다린다.** 종료코드가 나올 때까지가 정상이다.

## B-3. 백업 파일 무결성 확인

```powershell
$c = (& "$PGBIN\pg_restore.exe" --list "$BACKUP\core_$STAMP.dump").Count
$s = (& "$PGBIN\pg_restore.exe" --list "$BACKUP\snapshots_$STAMP.dump").Count
Write-Host "core 항목 수      : $c"
Write-Host "snapshots 항목 수 : $s"
```

**정상** — 두 값 모두 0보다 크다 (core 는 보통 수백).

## B-4. 복원 리허설 ★ "파일이 있다"와 "복원된다"는 다르다

```powershell
& "$PGBIN\psql.exe" -U postgres -h localhost -d postgres -c "DROP DATABASE IF EXISTS dxdigitaltwin_stg;"
& "$PGBIN\psql.exe" -U postgres -h localhost -d postgres -c "CREATE DATABASE dxdigitaltwin_stg;"
& "$PGBIN\pg_restore.exe" -h localhost -U postgres -d dxdigitaltwin_stg --no-owner --no-privileges "$BACKUP\core_$STAMP.dump"
Write-Host "복원 종료코드: $LASTEXITCODE"
& "$PGBIN\psql.exe" -U postgres -h localhost -d dxdigitaltwin_stg -c "SELECT (SELECT version FROM dashboard_data LIMIT 1) AS 데이터버전, (SELECT count(*) FROM project_attachments) AS 첨부, (SELECT count(*) FROM users) AS 사용자, (SELECT count(*) FROM dashboard_activity_logs) AS 로그;"
& "$PGBIN\psql.exe" -U postgres -h localhost -d dxdigitaltwin_stg -c "SELECT json_array_length(projects) AS 과제수, json_array_length(performances) AS 성과수 FROM dashboard_data;"
```

**정상** — `데이터버전`·`첨부`·`사용자`·`로그`·`과제수`·`성과수` 가 **A-3 과 전부 일치**.

> `DROP DATABASE ... 없음, 건너 뜀` 안내는 처음 실행 시 정상이다.

**하나라도 다르면** — 백업을 신뢰할 수 없다. **B-1 부터 다시 한다.**

---

# C. 배포

## C-1. 백엔드 서비스 중지

운영에서 백엔드를 기동하는 방식대로 중지한다.

> 파일 잠금 때문에 교체가 실패하는 것을 막기 위해 **먼저 중지**한다.
> (2026-07-28 에 실행 중 상태로 빌드하다 `dist/assets` 권한 오류로 배포가 부분 실패한 적이 있다)

## C-2. 기존 파일 보관

```powershell
New-Item -ItemType Directory -Force -Path "$BACKUP\code_before_$STAMP" | Out-Null
Copy-Item "$PROJ\backend\app\__init__.py"                                          "$BACKUP\code_before_$STAMP\" -Force
Copy-Item "$PROJ\backend\app\shared\errors.py"                                     "$BACKUP\code_before_$STAMP\" -Force
Copy-Item "$PROJ\backend\app\modules\digital_twin_dashboard\models.py"             "$BACKUP\code_before_$STAMP\" -Force
Copy-Item "$PROJ\backend\app\modules\digital_twin_dashboard\routes.py"             "$BACKUP\code_before_$STAMP\" -Force
Compress-Archive -Path "$PROJ\frontend\dist" -DestinationPath "$BACKUP\dist_before_$STAMP.zip" -Force
Get-ChildItem "$BACKUP\code_before_$STAMP" | Select-Object Name
```

**정상** — 4개 파일이 보이고 `dist_before_*.zip` 이 생성된다.

## C-3. 새 파일 배포

담당자가 전달한 파일을 아래 위치에 덮어쓴다.

**백엔드 (교체 4 + 신규 4)**
```
backend\app\__init__.py                                                    (교체)
backend\app\shared\errors.py                                               (교체)
backend\app\modules\digital_twin_dashboard\models.py                       (교체)
backend\app\modules\digital_twin_dashboard\routes.py                       (교체)
backend\migrations\versions\e707bfa26eeb_add_dt_report_images_table.py     (신규)
backend\scripts\dt_scan.py                                                 (신규)
backend\scripts\dt_snapshot_cleanup.py                                     (신규)
backend\scripts\dt_image_extract.py                                        (신규)
```

**프론트엔드**
```
frontend\dist\    ← 개발서버에서 빌드한 폴더를 통째로 교체
```

> ⚠️ **운영서버에서 `npm run build` 를 하지 않는다.** 개발서버에서 빌드해 온 `dist` 를 쓴다.
> 운영에서 빌드하면 권한·잠금 문제로 부분 실패할 수 있고, 그때 **에러 없이 스타일만 사라지는**
> 증상이 난다. (2026-07-28 실제 사고)

교체 전 기존 dist 를 지운다:

```powershell
Remove-Item "$PROJ\frontend\dist" -Recurse -Force -ErrorAction SilentlyContinue
# 이후 전달받은 dist 폴더를 $PROJ\frontend\ 아래에 복사한다
```

## C-4. 배포 파일 확인

```powershell
Select-String -Path "$PROJ\backend\app\modules\digital_twin_dashboard\routes.py" -Pattern "Phase 1-1|_prune_auto_snapshots|report-images" | Measure-Object | Select-Object @{n='routes_변경확인';e={$_.Count}}
Select-String -Path "$PROJ\backend\app\__init__.py" -Pattern "init_compression|check_frontend_build" | Measure-Object | Select-Object @{n='init_변경확인';e={$_.Count}}
Test-Path "$PROJ\backend\migrations\versions\e707bfa26eeb_add_dt_report_images_table.py"
Test-Path "$PROJ\frontend\dist\index.html"
```

**정상** — 앞의 두 값이 각각 **3 이상**, 뒤의 두 값이 `True`.

## C-5. DB 마이그레이션 ★ 건너뛰면 이미지 업로드가 실패한다

```powershell
cd "$PROJ\backend"
.\venv\Scripts\activate
$env:FLASK_APP = "run.py"
python -m flask db upgrade
& "$PGBIN\psql.exe" -U postgres -h localhost -d $DB -c "SELECT count(*) AS 이미지행 FROM dt_report_images;"
```

**정상** — `Running upgrade ... -> e707bfa26eeb` 가 보이고, `이미지행` 이 **0**.

> 이 마이그레이션은 **새 테이블을 만들기만 한다.** 기존 테이블은 건드리지 않는다.
> 되돌리려면 `python -m flask db downgrade`.

## C-6. 서비스 재시작

기동 로그에 아래가 보여야 한다:

```
[Frontend] 빌드 자산 확인 완료 (핵심 자산 정상, 참조 N개)
```

> `★ 경고 — 화면이 깨집니다` 가 보이면 **dist 배포가 불완전**하다. C-3 을 다시 한다.
> `참고 — 없는 부가 파일: /vite.svg` 는 원래 그런 것이므로 무시해도 된다.

```powershell
Invoke-WebRequest -Uri "http://localhost:5174/api/digital-twin-dashboard/health" -UseBasicParsing | Select-Object StatusCode
```

**정상** — `200`

**실패 시** — `$BACKUP\code_before_$STAMP\` 의 파일들을 되돌리고 재시작한다.

---

# D. 배포 검증 ★

## D-1. 화면 기본 동작

브라우저에서 **Ctrl+F5** 로 새로고침한 뒤:

```
□ 대시보드가 정상적으로 뜬다
□ 상단 헤더(홈 버튼, 대시보드/과제진행현황 탭) 서식이 정상이다
□ 과제 목록이 보인다
□ 보고서 화면에서 기존 이미지가 정상으로 보인다
```

> 이 시점에는 이미지가 아직 base64 그대로다. 기존과 똑같이 보이는 것이 정상이다.

## D-2. 자동 스냅샷이 멈췄는지 ★

> ⚠️ **"스냅샷 0" 만 보면 안 된다.** 저장 자체가 실패해도 0 이 나오기 때문이다.
> **저장이 실제로 일어났다는 증거(버전 증가)와 함께** 확인한다.

### ① 저장 전 — 현재 값 기록

```powershell
& "$PGBIN\psql.exe" -U postgres -h localhost -d $DB -c "SELECT version AS 저장전_버전 FROM dashboard_data;"
```

**화면의 숫자를 적어둔다.**

### ② 대시보드에서 과제 하나를 열어 저장한다

### ③ 저장 후 — 확인

```powershell
& "$PGBIN\psql.exe" -U postgres -h localhost -d $DB -c "SELECT (SELECT version FROM dashboard_data) AS 저장후_버전, (SELECT max(created_at) FROM dashboard_snapshots) AS 최신스냅샷_UTC, (SELECT count(*) FROM dashboard_snapshots WHERE created_at > (now() AT TIME ZONE 'UTC') - interval '10 minutes') AS 최근10분_스냅샷;"
```

**정상 조건 — 둘 다 만족해야 한다**

| 값 | 정상 | 의미 |
|---|---|---|
| `저장후_버전` | ①보다 **증가** | 저장이 실제로 일어났다 |
| `최근10분_스냅샷` | **0** | 자동 스냅샷이 멈췄다 |

**판정**

- 버전 증가 + 스냅샷 0 → **[OK] 정상.** E 로 진행
- 버전 증가 + 스냅샷 1 이상 → 코드 미반영. **C-4 로 돌아간다**
- **버전 그대로** → 저장이 안 된 것이다. 스냅샷 0 은 의미 없다. 화면에서 저장이 성공했는지 다시 확인하고 ② 부터 반복

> `created_at` 은 **UTC** 로 저장되므로 `now()`(KST) 와 그냥 비교하면 9시간이 어긋나 **항상 0** 이 나온다.
> 위 쿼리의 `now() AT TIME ZONE 'UTC'` 가 그것을 맞춘 것이다. (2026-07-28 검증에서 발견)

## D-3. gzip 이 동작하는지

브라우저 개발자도구(F12) → Network 탭 → 새로고침 → `data` 요청 클릭 → Response Headers 확인

```
Content-Encoding: gzip     ← 이게 보이면 정상
```

## D-4. 새 이미지 업로드

과제 편집 → 상세정보 → 이미지 추가

```
□ "업로드 중…" 이 잠깐 뜬 뒤 이미지가 추가된다
□ 저장 후 다시 열어도 이미지가 보인다
```

```powershell
& "$PGBIN\psql.exe" -U postgres -h localhost -d $DB -c "SELECT count(*) AS 새이미지 FROM dt_report_images;"
```

**정상** — 방금 올린 만큼 행이 생겼다.

---

# E. 스냅샷 정리 (25.2 GB 회수)

## E-1. 정리 대상 확인 (아무것도 지우지 않음)

```powershell
cd "$PROJ\backend"
python scripts\dt_snapshot_cleanup.py
```

**확인할 것**
- `정리 후 예상 건수` 가 **0이 아니다** (0이면 중단)
- `manual` / `upload` 는 정리 후에도 **그대로 남는다**

## E-2. 실제 삭제

```powershell
python scripts\dt_snapshot_cleanup.py --commit --backup-file "$SNAPBK"
```

**정상** — `[OK] 커밋 완료 — N건 삭제`

> **디스크가 아직 안 줄어드는 것이 정상이다.** PostgreSQL 은 DELETE 만으로 파일을 반환하지 않는다.

## E-3. 디스크 실제 반환

> 이 단계는 `dashboard_snapshots` 테이블을 잠근다. **스냅샷 목록 화면만** 잠시 멈춘다.
> 과제 저장·조회에는 영향이 없다 (자동 스냅샷 생성을 C 에서 이미 끊었다).

```powershell
python scripts\dt_snapshot_cleanup.py --vacuum-full --backup-file "$SNAPBK"
```

**정상** — `[OK] VACUUM FULL 완료`, `VACUUM 후 디스크` 가 크게 줄어 있다.

## E-4. 확인

```powershell
& "$PGBIN\psql.exe" -U postgres -h localhost -d $DB -c "SELECT snapshot_type, count(*) FROM dashboard_snapshots GROUP BY 1 ORDER BY 2 DESC;"
& "$PGBIN\psql.exe" -U postgres -h localhost -d $DB -c "SELECT pg_size_pretty(pg_total_relation_size('dashboard_snapshots')) AS 스냅샷디스크;"
```

**정상** — `manual`/`upload` 건수가 **A-3 과 동일**, 디스크가 수백 MB 수준.

---

# F. 이미지 추출 (원본은 그대로 둔다)

## F-1. 현황 확인

```powershell
python scripts\dt_image_extract.py
```

**적어둘 것** — `인라인 base64 이미지` 장수, `payload 총량`.

**정상** — `디코드 실패` 가 **0**.

## F-2. 추출 실행

```powershell
python scripts\dt_image_extract.py --extract
```

**정상 — 아래 3개가 전부 0**
```
── 무결성 검증 ──
  DB 행 없음(dangling id)     : 0장
  파일 없음                   : 0장
  해시 불일치                 : 0장
  판정: [OK] 전부 정상
```

**하나라도 0이 아니면 G 로 넘어가지 않는다.**

> 이 단계에서 **payload 는 아직 안 줄어든다.** 원본 dataUrl 을 일부러 남겨뒀기 때문이다.

```powershell
(Get-ChildItem "$PROJ\backend\uploads\digital-twin-dashboard" -Filter "img_*").Count
& "$PGBIN\psql.exe" -U postgres -h localhost -d $DB -c "SELECT count(*) AS 이미지행, pg_size_pretty(sum(file_size)::bigint) AS 총용량 FROM dt_report_images;"
```

---

# G. 화면 확인 ★ 절대 건너뛰지 않는다

브라우저에서 **Ctrl+F5** 후:

```
□ 보고서 화면에서 이미지가 전부 정상으로 보인다
□ 이미지를 클릭하면 확대 보기가 정상 동작한다
□ 과제 편집 → 상세정보에서 기존 이미지가 보인다
□ 개발자도구 Network 탭에 report-images 요청이 200 으로 나온다
```

> 지금은 이미지가 **두 벌** 있다. 서버에서 받아오다 실패하면 자동으로 기존 dataUrl 로 폴백하므로
> **설령 새 경로에 문제가 있어도 화면이 깨지지 않는다.** 그래서 여기서 확인하는 것이 안전하다.

**이미지가 안 보이면** — H 로 가지 않는다. 이 상태로 두어도 서비스는 정상이다.

---

# H. 원본 제거 — payload 급감

> **여기서 처음으로 원본이 사라진다.** 파일과 DB 행은 남으므로 복구는 가능하다.

```powershell
python scripts\dt_image_extract.py --strip --backup-file "$COREBK"
```

**정상**
```
── 무결성 검증 ──
  판정: [OK] 전부 정상          ← 통과해야만 진행한다
── dataUrl 제거 실행 ──
  제거 대상 : N장
[OK]   커밋 완료 — N장의 dataUrl 제거
       과제 payload: 3.5 MB (이미지 제거 후)
```

**정상 판정** — `과제 payload` 가 **크게 줄었다** (37.4 MB → 수 MB).

---

# I. 최종 확인

```powershell
python scripts\dt_image_extract.py
& "$PGBIN\psql.exe" -U postgres -h localhost -d $DB -c "SELECT pg_size_pretty(octet_length(projects::text)::bigint) AS projects, pg_size_pretty(octet_length(performances::text)::bigint) AS performances, json_array_length(projects) AS 과제수, json_array_length(performances) AS 성과수 FROM dashboard_data;"
& "$PGBIN\psql.exe" -U postgres -h localhost -d $DB -c "SELECT pg_size_pretty(pg_database_size(current_database())) AS DB전체;"
```

**정상 조건**
- `인라인 base64 이미지` = **0장**
- **`과제수` · `성과수` 가 A-3 과 동일** ★ 데이터가 사라지지 않았다는 증거
- `projects` 크기가 크게 감소
- `DB전체` 가 크게 감소

## I-1. 화면 최종 확인

```
□ 보고서 이미지 정상
□ 확대 보기 정상
□ 과제 수정 후 저장 → 눈에 띄게 빨라졌다
□ 새 이미지 추가 정상
□ 스냅샷 목록 조회 정상 / 수동 스냅샷 생성 정상
```

## I-2. 정리 후 백업 다시 뜨기 (권장)

데이터가 훨씬 작아졌으므로 새 기준점을 만들어 둔다.

```powershell
$STAMP2 = Get-Date -Format "yyyyMMdd_HHmm"
& "$PGBIN\pg_dump.exe" -h localhost -U postgres -d $DB --format=custom --compress=6 --no-owner --no-privileges -f "$BACKUP\full_after_phase1_$STAMP2.dump"
Write-Host "종료코드: $LASTEXITCODE"
Get-Item "$BACKUP\full_after_phase1_$STAMP2.dump" | Select-Object Name, @{n='MB';e={[math]::Round($_.Length/1MB,1)}}
```

## I-3. staging 정리

```powershell
& "$PGBIN\psql.exe" -U postgres -h localhost -d postgres -c "DROP DATABASE IF EXISTS dxdigitaltwin_stg;"
$env:PGPASSWORD = ""
```

---

# 완료 체크리스트

```
□ A-2   pg_dump 버전 · 디스크 여유 확인
□ A-3   기준값 기록 (baseline_*.txt)
□ B-1   core_*.dump 생성 (종료코드 0)
□ B-2   snapshots_*.dump 생성 (종료코드 0)
□ B-3   pg_restore --list 두 파일 모두 항목 > 0
□ B-4   staging 복원 → 기준값과 전부 일치 ★
□ C-2   기존 코드·dist 보관
□ C-3   백엔드 8개 + frontend\dist 배포
□ C-5   flask db upgrade → dt_report_images 0행 ★
□ C-6   재시작, 기동 로그 "빌드 자산 확인 완료", health 200
□ D-1   화면·헤더 서식 정상
□ D-2   저장해도 스냅샷 안 늘어남 ★
□ D-3   Content-Encoding: gzip 확인
□ D-4   새 이미지 업로드 정상
□ E-2   스냅샷 삭제 [OK]
□ E-3   VACUUM FULL, 디스크 감소
□ E-4   manual/upload 건수 유지
□ F-2   이미지 추출, 무결성 3항목 전부 0 ★
□ G     화면에서 이미지 정상 표시 ★
□ H     --strip 성공, payload 급감
□ I     인라인 0장 · 과제수/성과수 A-3 과 동일 ★
□ I-2   정리 후 백업
□ I-3   staging 삭제
```

**23개 항목이 모두 체크되면 Phase 1 완료.**

---

# 되돌리기

| 어디까지 갔나 | 방법 | 손실 |
|---|---|---|
| C (배포) 직후 | `$BACKUP\code_before_$STAMP\` 4개 파일 복원 + `flask db downgrade` + dist zip 복원 + 재시작 | 없음 |
| E (스냅샷 삭제) 후 | `snapshots_*.dump` 를 staging 에 복원해 확인 후 담당자와 진행 | 지운 자동 스냅샷 |
| F (추출) 후 | 되돌릴 것 없음. 코드만 되돌리면 기존 dataUrl 로 동작 | 없음 |
| H (원본 제거) 후 | 파일·DB 행이 남아 있어 보통 불필요. 필요하면 `core_*.dump` 를 staging 에 복원 후 담당자와 진행 | H 이후 입력분 |

**어느 단계든 혼자 판단해서 운영 DB 에 직접 복원하지 않는다.**

---

# 문제가 생겼을 때

1. **더 이상 아무 명령도 실행하지 않는다**
2. `$PROJ\backend\scripts\out\` 의 최신 `.log` 파일을 확보한다
3. 화면 전체를 캡처한다
4. 담당자에게 전달한다

> E·F·H 의 DB 변경은 모두 **단일 트랜잭션**이다. 중간에 실패하면 자동으로 전부 되돌려진다.
> "일부만 처리된" 어중간한 상태는 생기지 않는다.

---

# 자주 나오는 상황

| 상황 | 답 |
|---|---|
| B-2 가 30분째 멈춰 있다 | **정상.** 스냅샷이 크다. 종료코드가 나올 때까지 기다린다 |
| E-2 후 디스크가 그대로다 | **정상.** E-3 (VACUUM) 에서 줄어든다 |
| F-2 후 payload 가 그대로다 | **정상.** 원본을 일부러 남겼다. H 에서 줄어든다 |
| F-2 에 "중복 재사용" 이 많다 | **정상.** 같은 이미지는 파일 하나만 만든다 |
| 이미지가 잠깐 흐릿하다 바뀐다 | **정상.** dataUrl 을 먼저 보여주고 서버 이미지로 교체한다 |
| 스냅샷 목록에 자동 백업이 안 쌓인다 | **의도한 변화.** 수동 스냅샷과 덮어쓰기 직전 백업은 그대로 생성된다 |
| 이미지 추가 시 "업로드 중…" 이 뜬다 | **정상.** 이제 서버로 올린다. 대신 저장이 빨라진다 |
| 스크립트를 두 번 실행했다 | **안전하다.** 이미 처리된 것은 건너뛴다 |
| PowerShell 창을 닫았다 | A-1 을 다시 실행한다. 만든 파일은 그대로 있다 |

---

# 검증 이력

개발 환경(PostgreSQL 17.5)에서 **운영 DB 복제본으로 전 과정을 실제 실행함** (2026-07-28).

| 단계 | 결과 |
|---|---|
| B (백업·복원) | staging 복원값이 기준값과 전부 일치 |
| C (마이그레이션) | `create_table` 만 포함, `downgrade` 는 `drop_table` |
| E (스냅샷) | 358 → 40건, 논리 159.8 MB → 33.5 MB, VACUUM 후 디스크 41.2 MB → **10.4 MB** |
| E 안전장치 | 백업 미지정 / 없는 파일 / 1 MB 미만 파일 → **전부 거부** |
| F (추출) | 11장 처리 (신규 1 + 중복 재사용 10), 무결성 전항 0 |
| F 재실행 | "이미 처리됨 11장" — 변경 없음 |
| H (제거) | payload **763.4 kB → 274.7 kB** |
| gzip | `GET /data` 1.1 MB → **243.5 kB**, 압축 해제 후 내용 동일 |
| 정적파일 404 | 없는 CSS → **404** (전엔 200 HTML), SPA 라우팅은 유지 |
| 프론트 빌드 | `npm run build` 성공 |
| 원본 개발 DB | **version 571 / 과제 328 / 인라인 3건 그대로** |

> 운영은 데이터가 훨씬 커서 **소요 시간만 다르고 절차·판정 기준은 동일**하다.
