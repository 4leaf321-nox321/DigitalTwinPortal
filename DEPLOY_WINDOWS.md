# Windows 운영서버 배포 가이드 — 기존 설치 갱신

## 이 문서의 범위

**이미 돌고 있는 설치를 새 버전으로 갱신하는 절차**입니다.

다루지 **않는** 것: 완전 신규 환경 구축. PostgreSQL 데이터베이스 생성,
초기 관리자 계정, 시스템 설정 초기화는 별도 스크립트가 담당합니다
(`backend/setup_db.py`, `backend/set_admin.py`, `backend/reset_system_settings.py`).

---

## 전체 흐름

```
[개발 PC]  v* 태그 푸시
              ↓
[GitHub]   Release - Windows package 워크플로가
           코드 + wheel 묶음으로 deploy_package.zip 생성 후 릴리스 발행
              ↓
[운영서버] 앱 중지 → deploy.ps1 → 앱 시작
```

## 폴더 구조

```
C:\apps\
  tools\                          배포 스크립트 (앱 폴더 바깥에 둘 것)
    deploy.ps1
    rollback.ps1
  DigitalTwinPortal\              운영. 항상 이 경로에서 실행
  DigitalTwinPortal_prev\         직전 버전 (롤백용)
  DigitalTwinPortal_venvs\
    backend\                      백엔드 가상환경
    mcp_server\                   MCP 가상환경 (별도 유지)
```

배포할 때 앱 폴더가 통째로 교체되므로 **배포 스크립트는 그 바깥**에 둡니다.

가상환경도 바깥에 두어, 배포마다 다시 만들거나 복사하지 않고 절대경로도
그대로 유지됩니다. `requirements.txt`가 바뀔 때만 다시 만듭니다.

백엔드와 MCP를 나누는 이유는 `mcp_server/README.md`의
"왜 별도 폴더·별도 venv 인가"에 있습니다.

## 의존성은 네트워크를 쓰지 않습니다

패키지에 **wheel 묶음**이 함께 들어갑니다. 서버는 그것만으로 가상환경을 만듭니다.

```
pip install --no-index --find-links=packages -r requirements.txt
             ^^^^^^^^^^ PyPI에 접속하지 않음
```

사내망에서 pip이 불안정해도 배포가 멈추지 않습니다.

---

# A. 최초 1회 준비

서버당 한 번만 합니다.

## A-1. Python 확인

패키지의 wheel은 빌드에 쓰인 Python 마이너 버전에서만 설치됩니다.
현재 기준은 **3.13**입니다.

```powershell
py -0p              # 설치된 목록
py -3.13 --version  # 3.13이 잡히는지
```

`py -3.13`이 동작하면 됩니다. `deploy.ps1`이 이걸로 정확한 인터프리터를 찾으므로,
PATH의 `python`이 다른 버전이어도 상관없습니다.

`py` 런처가 없는 환경이면 나중에 `-PythonExe 'C:\Python313\python.exe'`처럼
경로를 직접 주면 됩니다.

## A-2. GitHub CLI 설치 및 로그인

저장소가 private이라 릴리스를 받으려면 인증이 필요합니다.

```powershell
winget install GitHub.cli
gh auth login
```

## A-3. 배포 스크립트 꺼내기 (부트스트랩)

배포 스크립트는 패키지 안에 들어 있습니다. 한 번만 손으로 꺼내면,
이후 배포는 그 스크립트가 전부 처리합니다.

```powershell
New-Item -ItemType Directory -Force -Path 'C:\apps\bootstrap'
cd C:\apps\bootstrap

gh release download --repo 4leaf321-nox321/DigitalTwinPortal --pattern deploy_package.zip
Expand-Archive -Path .\deploy_package.zip -DestinationPath .\unpacked -Force

New-Item -ItemType Directory -Force -Path 'C:\apps\tools'
Copy-Item .\unpacked\deploy.ps1, .\unpacked\rollback.ps1 'C:\apps\tools\'
```

끝나면 `C:\apps\bootstrap`은 지워도 됩니다.

## A-4. 기존 폴더를 고정 경로로 전환

번호 폴더(`digitaltwinportal11`, `12` …)를 고정 경로 하나로 바꿉니다.
**앱을 중지한 뒤** 현재 쓰고 계신 폴더의 이름만 바꾸면 됩니다.

```powershell
Rename-Item 'C:\apps\digitaltwinportal12' 'DigitalTwinPortal'
```

첫 배포 때 이 폴더의 `backend\uploads`와 `backend\.env`가 새 버전으로
자동 이관됩니다.

---

# B. 평소 배포 절차

## B-1. 개발 PC — 릴리스 만들기

```powershell
git tag -a v0.1.16 -m "v0.1.16"
git push origin v0.1.16
```

1~2분 뒤 릴리스가 발행됩니다. Actions에서 `Release - Windows package`가
초록불인지 확인하세요.

## B-2. 운영서버 — 앱 중지

콘솔 창에서 `Ctrl+C` 또는 창 닫기. Windows가 실행 중인 파일을 잠그므로
반드시 먼저 중지해야 합니다. 안 하면 `deploy.ps1`이 폴더를 건드리기 전에
거부합니다.

MCP 서버를 함께 쓰고 계시면 그 창도 닫습니다.

## B-3. 배포

```powershell
cd C:\apps\tools
.\deploy.ps1 -AppPath 'C:\apps\DigitalTwinPortal'
```

수행 내용:

| 순서 | 내용 |
|---|---|
| 1 | 최신 릴리스 `deploy_package.zip` 다운로드 |
| 2 | 임시 폴더에 풀어 **wheel 묶음·Python 버전 검사** — 문제 시 여기서 중단 |
| 3 | 현재 폴더를 `_prev`로 이동, 새 버전 배치 |
| 4 | 이전 버전에서 `backend\uploads`·`backend\.env` 이관 |
| 5 | 가상환경 동기화 — `requirements.txt` 그대로면 재사용 |
| 6 | `flask db upgrade` |

2단계까지는 **운영 폴더를 건드리지 않습니다.** 패키지에 문제가 있으면
기존 설치는 그대로 남습니다.

## B-4. 앱 시작

```powershell
cd C:\apps\DigitalTwinPortal
.\run_server.ps1
```

MCP 서버는 **다른 창**에서:

```powershell
cd C:\apps\DigitalTwinPortal
.\run_mcp_server.ps1
```

`DT_API_BASE`가 기본 `http://localhost:5174`입니다. 백엔드 포트가 다르면
먼저 지정하세요.

```powershell
$env:DT_API_BASE = 'http://localhost:5000'
.\run_mcp_server.ps1
```

---

# C. 자주 쓰는 옵션

```powershell
# 특정 버전 배포
.\deploy.ps1 -AppPath 'C:\apps\DigitalTwinPortal' -Tag v0.1.15

# DB는 건드리지 않고 폴더 교체·가상환경 준비만
.\deploy.ps1 -AppPath 'C:\apps\DigitalTwinPortal' -SkipMigrations

# 미리 받아둔 zip 사용 (gh를 못 쓰는 환경)
.\deploy.ps1 -AppPath 'C:\apps\DigitalTwinPortal' -ZipPath 'C:\tmp\deploy_package.zip'

# 인터프리터 직접 지정 (py 런처가 없을 때)
.\deploy.ps1 -AppPath 'C:\apps\DigitalTwinPortal' -PythonExe 'C:\Python313\python.exe'
```

가상환경만 강제로 다시 만들려면 패키지 안의 스크립트를 씁니다.

```powershell
cd C:\apps\DigitalTwinPortal
.\venv_sync.ps1 -AppPath 'C:\apps\DigitalTwinPortal' -Force
```

---

# D. 롤백

```powershell
# 앱 중지 후
cd C:\apps\tools
.\rollback.ps1 -AppPath 'C:\apps\DigitalTwinPortal'

cd C:\apps\DigitalTwinPortal
.\run_server.ps1
```

**파일만 되돌아갑니다. 마이그레이션은 취소되지 않습니다.** 실패한 배포가
파괴적 마이그레이션(컬럼 삭제·이름 변경 등)을 적용했다면 DB는 따로 복구해야
합니다.

되돌린 버전의 `requirements.txt`가 다르면 가상환경이 새 버전 기준으로 남아
있습니다. 그때는 위의 `venv_sync.ps1 -Force`를 한 번 실행하세요.

---

# E. 패키지에 일부러 넣지 않는 것

운영 데이터라 git에도 패키지에도 없습니다. `deploy.ps1`이 이전 폴더에서
자동으로 옮기지만, 어디서 오는지 알아두시는 게 좋습니다.

| 항목 | 설명 |
|---|---|
| `backend\uploads` | 사용자가 업로드한 파일 |
| `backend\.env` | `DATABASE_URL` 등 접속 정보 |

이관할 이전 폴더가 없으면 `.env`를 직접 만들어야 합니다.
`backend\.env.example`을 참고하세요.

---

# F. DB를 언제 건드리는가

배포 경로에서 데이터베이스에 접근하는 명령은 **`flask db upgrade` 하나**뿐입니다.

- `-SkipMigrations`를 주면 실행되지 않습니다
- 앱 기동(`run_server.ps1`)은 스키마를 건드리지 않습니다 — 코드에
  `create_all`/`drop_all`이 없습니다
- 가상환경 생성·wheel 설치도 DB와 무관합니다

`flask db upgrade`는 alembic이 현재 리비전을 확인해 **밀린 것만** 적용합니다.
이미 최신이면 아무 변경 없이 통과합니다.

---

# G. 문제 해결

**`Python version mismatch`**

서버 Python과 wheel을 만든 버전이 다릅니다. 운영 폴더는 건드리지 않은
상태입니다. 메시지에 두 버전이 표시됩니다. 맞는 버전을 설치하거나
`-PythonExe`로 지정하거나, `.github/workflows/`의 `ci-windows.yml`과
`release-windows.yml`에서 `python-version`을 서버 버전으로 맞추고 새 릴리스를
만드세요.

**`Cannot write to ... Close the running app`**

앱이 아직 실행 중이거나, 해당 폴더를 열어둔 탐색기·터미널이 있습니다.

**`backend\.env is missing`**

`DigitalTwinPortal_prev\backend\.env`에서 복사하거나 새로 만드세요.
마이그레이션과 기동에 `DATABASE_URL`이 필요합니다.

**`Package has no wheel bundle for ...`**

릴리스 패키지가 불완전합니다. 운영 폴더는 건드리지 않은 상태이니
릴리스 워크플로를 확인하고 새로 만드세요.

**`Backend venv not found`**

가상환경이 아직 없습니다. `deploy.ps1`을 다시 돌리거나
`venv_sync.ps1`을 실행하세요.

---

# H. 개발 PC에서 연습하기

운영에 적용하기 전에 같은 절차를 개발 PC에서 그대로 밟아볼 수 있습니다.
경로만 바꾸면 명령은 동일합니다.

```powershell
# 준비 — py 런처가 3.13을 찾는지 확인
py -3.13 --version

# A-3. 부트스트랩
New-Item -ItemType Directory -Force -Path 'F:\data\0_Program\_deploytest\bootstrap'
cd F:\data\0_Program\_deploytest\bootstrap
gh release download --repo 4leaf321-nox321/DigitalTwinPortal --pattern deploy_package.zip
Expand-Archive -Path .\deploy_package.zip -DestinationPath .\unpacked -Force
New-Item -ItemType Directory -Force -Path 'F:\data\0_Program\_deploytest\tools'
Copy-Item .\unpacked\deploy.ps1, .\unpacked\rollback.ps1 'F:\data\0_Program\_deploytest\tools\'

# B-3. 첫 배포 — DB는 건드리지 않음 (약 2분 20초, 가상환경 생성)
cd F:\data\0_Program\_deploytest\tools
.\deploy.ps1 -AppPath 'F:\data\0_Program\_deploytest\DigitalTwinPortal' -SkipMigrations

# .env 넣기 — 어느 DB를 가리키는지 먼저 확인할 것
Get-Content 'F:\data\0_Program\52_DigitalTwinPortal\backend\.env' | Select-String 'DATABASE_URL'
Copy-Item 'F:\data\0_Program\52_DigitalTwinPortal\backend\.env' `
          'F:\data\0_Program\_deploytest\DigitalTwinPortal\backend\.env'

# 마이그레이션까지 (가상환경 재사용되어 몇 초면 끝남)
.\deploy.ps1 -AppPath 'F:\data\0_Program\_deploytest\DigitalTwinPortal'

# 앱 실행 — 기존 개발 서버와 포트가 겹치면 먼저 끌 것
cd F:\data\0_Program\_deploytest\DigitalTwinPortal
.\run_server.ps1
```

연습이 끝나면 폴더 하나만 지우면 됩니다. 가상환경도 그 안에 있습니다.

```powershell
Remove-Item -Recurse -Force 'F:\data\0_Program\_deploytest'
```

연습은 기존 프로젝트 폴더에 영향을 주지 않습니다. 공유되는 것은 `.env`가
가리키는 데이터베이스뿐입니다.
