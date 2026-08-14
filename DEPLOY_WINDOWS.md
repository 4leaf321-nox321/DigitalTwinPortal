# Windows 운영서버 배포 가이드

## 전체 흐름

```
[개발 PC]  v* 태그 푸시
              ↓
[GitHub]   Release - Windows package 워크플로가
           코드 + wheel 묶음으로 deploy_package.zip 생성 후 릴리스 발행
              ↓
[운영서버] 앱 중지 → deploy.ps1 실행 → 앱 시작
```

## 폴더 구조

```
C:\apps\
  DigitalTwinPortal\              ← 운영. 항상 이 경로에서 실행
  DigitalTwinPortal_prev\         ← 직전 버전 (롤백용)
  DigitalTwinPortal_venvs\
    backend\                      ← 백엔드 가상환경
    mcp_server\                   ← MCP 가상환경 (별도 유지)
```

가상환경을 배포 폴더 **바깥**에 두는 이유는 두 가지입니다. 배포할 때마다 다시
만들거나 복사할 필요가 없고, 절대경로가 그대로 유지됩니다.
`requirements.txt`가 바뀔 때만 다시 만듭니다.

백엔드와 MCP를 분리하는 이유는 `mcp_server/README.md`의
"왜 별도 폴더·별도 venv 인가"에 있습니다. `mcp`는 starlette·pydantic·uvicorn·anyio를
새로 끌고 오는데 백엔드가 그걸 짊어질 이유가 없습니다.

## 의존성은 네트워크를 쓰지 않습니다

패키지에 **wheel 묶음**이 함께 들어갑니다. 서버는 그것만으로 가상환경을 만듭니다.

```powershell
pip install --no-index --find-links=packages -r requirements.txt
             ^^^^^^^^^^ PyPI에 접속하지 않음
```

사내망에서 pip이 불안정해도 배포가 멈추지 않습니다.

---

## 최초 1회 준비 (운영서버)

### 1. Python 확인

`deploy.ps1`이 패키지에 기록된 빌드 버전과 서버 버전을 대조하므로 미리 아실
필요는 없습니다. 다만 **PATH의 `python`이 무엇을 가리키는지**는 봐두시는 게
좋습니다.

```powershell
python --version
py -0p              # 설치된 모든 버전
```

빌드 버전과 다르면 `deploy.ps1`이 `py -<버전>`으로 정확한 인터프리터를 찾고,
그래도 없으면 운영 폴더를 건드리기 전에 중단합니다.

### 2. 릴리스 다운로드 수단

저장소가 private이라 인증이 필요합니다.

```powershell
winget install GitHub.cli
gh auth login
```

`gh` 설치가 어려우면 릴리스 페이지에서 `deploy_package.zip`을 직접 받아
`-ZipPath`로 넘기셔도 됩니다.

### 3. 배포 스크립트 배치

`scripts/deploy/`의 **`deploy.ps1`과 `rollback.ps1`** 두 개를 서버의 편한 위치에
둡니다 (예: `C:\apps\deploy\`). `venv_sync.ps1`은 패키지 안에 함께 들어가므로
따로 두실 필요 없습니다.

### 4. 기존 폴더를 고정 경로로 전환

번호 폴더(`digitaltwinportal11`, `12` …) 체계를 고정 경로로 바꿉니다.
**앱을 중지한 뒤** 현재 쓰고 계신 폴더 이름을 바꾸세요.

```powershell
Rename-Item 'C:\apps\digitaltwinportal12' 'DigitalTwinPortal'
```

첫 배포 때 이 폴더의 `uploads`와 `.env`가 자동으로 이관됩니다.

---

## 평소 배포 절차

### 개발 PC — 릴리스 만들기

```powershell
git tag -a v0.1.15 -m "v0.1.15"
git push origin v0.1.15
```

1~2분 뒤 릴리스가 발행됩니다. Actions에서 `Release - Windows package`가
초록불인지 확인하세요.

### 운영서버 — 배포

**1) 앱 중지** — 콘솔 창에서 `Ctrl+C` 또는 창 닫기.
Windows가 실행 중인 파일을 잠그므로 반드시 먼저 중지해야 합니다.
(안 하면 `deploy.ps1`이 폴더를 건드리기 전에 거부합니다.)

**2) 배포**

```powershell
.\deploy.ps1 -AppPath 'C:\apps\DigitalTwinPortal'
```

수행 내용:

1. 릴리스 `deploy_package.zip` 다운로드
2. 임시 폴더에 풀어 **wheel 묶음·Python 버전 검사** (문제 시 여기서 중단)
3. 현재 폴더를 `_prev`로 이동, 새 버전 배치
4. 이전 버전에서 `backend\uploads`와 `backend\.env` 이관
5. **가상환경 동기화** — `requirements.txt`가 그대로면 재사용, 바뀌었으면 wheel로 재설치
6. `flask db upgrade`

**3) 앱 시작**

```powershell
cd C:\apps\DigitalTwinPortal
.\run_server.ps1          # 백엔드
```

MCP 서버는 별도 창에서 실행합니다.

```powershell
.\run_mcp_server.ps1      # DT_API_BASE, MCP_HOST, MCP_PORT 환경변수로 조정
```

### 자주 쓰는 옵션

```powershell
# 특정 버전
.\deploy.ps1 -AppPath 'C:\apps\DigitalTwinPortal' -Tag v0.1.14

# DB는 건드리지 않고 폴더 교체·환경 준비만 (첫 시도에 권장)
.\deploy.ps1 -AppPath 'C:\apps\DigitalTwinPortal' -SkipMigrations

# 미리 받아둔 zip 사용
.\deploy.ps1 -AppPath 'C:\apps\DigitalTwinPortal' -ZipPath 'C:\tmp\deploy_package.zip'

# 인터프리터 직접 지정 (py 런처가 없을 때)
.\deploy.ps1 -AppPath 'C:\apps\DigitalTwinPortal' -PythonExe 'C:\Python313\python.exe'
```

### 가상환경만 다시 만들기

의심스러울 때 패키지 안의 스크립트로 강제 재생성할 수 있습니다.

```powershell
cd C:\apps\DigitalTwinPortal
.\venv_sync.ps1 -AppPath 'C:\apps\DigitalTwinPortal' -Force
```

---

## 롤백

```powershell
# 앱 중지 후
.\rollback.ps1 -AppPath 'C:\apps\DigitalTwinPortal'
cd C:\apps\DigitalTwinPortal
.\run_server.ps1
```

**파일만 되돌아갑니다. 마이그레이션은 취소되지 않습니다.** 실패한 배포가
파괴적 마이그레이션(컬럼 삭제·이름 변경 등)을 적용했다면 DB는 따로 복구해야
합니다.

되돌린 버전의 `requirements.txt`가 다르면 가상환경이 새 버전 기준으로 남아
있습니다. 그때는 위의 `venv_sync.ps1`을 한 번 실행하세요.

---

## 패키지에 일부러 넣지 않는 것

운영 데이터라 git에도 패키지에도 없습니다. `deploy.ps1`이 이전 폴더에서
자동으로 옮기지만, 어디서 오는지 알아두시는 게 좋습니다.

| 항목 | 설명 |
|---|---|
| `backend\uploads` | 사용자가 업로드한 파일 |
| `backend\.env` | `DATABASE_URL` 등 접속 정보 |

최초 설치처럼 이관할 이전 폴더가 없으면 `.env`를 직접 만들어야 합니다.
`backend\.env.example`을 참고하세요.

---

## 문제 해결

**`Python version mismatch`**

서버 Python과 wheel을 만든 버전이 다릅니다. 운영 폴더는 건드리지 않은
상태입니다. 메시지에 두 버전이 표시되니, `py -<버전>`으로 맞는 인터프리터를
설치하거나 `-PythonExe`로 지정하거나, `.github/workflows/`의 `ci-windows.yml`과
`release-windows.yml`에서 `python-version`을 서버 버전으로 맞추고 새 릴리스를
만드세요.

**`Cannot write to ... Close the running app`**

앱이 아직 실행 중이거나, 해당 폴더를 열어둔 탐색기·터미널이 있습니다.

**`backend\.env is missing`**

`DigitalTwinPortal_prev\backend\.env`에서 복사하거나 새로 만드세요.

**`Package has no wheel bundle for ...`**

릴리스 패키지가 불완전합니다. 운영 폴더는 건드리지 않은 상태이니
릴리스 워크플로를 확인하고 새로 만드세요.

**`Backend venv not found`**

가상환경이 아직 없습니다. `venv_sync.ps1`을 실행하거나 `deploy.ps1`을 다시
돌리세요.
