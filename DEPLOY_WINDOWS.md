# Windows 운영서버 배포 가이드

## 전체 흐름

```
[개발 PC]  v* 태그 푸시
              ↓
[GitHub]   Release - Windows package 워크플로가
           deploy_package.zip 생성 후 릴리스 발행
              ↓
[운영서버] 앱 중지 → deploy.ps1 실행 → 앱 시작
```

패키지에는 **의존성이 전부 포함**돼 있습니다(`site-packages`). 서버에서 `pip install`이나
venv 생성이 필요 없고, 인터넷 연결도 필요 없습니다.

---

## 최초 1회 준비 (운영서버)

### 1. Python 설치 확인

패키지의 바이너리 휠은 빌드에 쓰인 Python 마이너 버전에서만 동작합니다.
버전을 모르셔도 됩니다 — `deploy.ps1`이 대조해서 안 맞으면 알려주고 멈춥니다.

```powershell
python --version
```

`python`이 PATH에 있어야 합니다. 마이그레이션 실행에도 필요합니다.

### 2. 릴리스 다운로드 수단

저장소가 private이라 인증이 필요합니다. 둘 중 하나면 됩니다.

**GitHub CLI 사용 (권장)** — `deploy.ps1`이 알아서 받아옵니다.

```powershell
winget install GitHub.cli
gh auth login
```

**수동 다운로드** — 릴리스 페이지에서 `deploy_package.zip`을 직접 받아
`-ZipPath`로 넘기셔도 됩니다. `gh` 설치가 어려운 환경에서 쓰세요.

### 3. 배포 스크립트 배치

`scripts/deploy/deploy.ps1`과 `rollback.ps1`을 서버의 편한 위치에 둡니다
(예: `C:\apps\deploy\`). 리포에서 받아오거나 복사해두면 됩니다.

### 4. 기존 폴더를 고정 경로로 전환

기존 `digitaltwinportal11`, `digitaltwinportal12` 같은 번호 폴더 체계를
고정 경로 하나로 바꿉니다. **앱을 중지한 뒤** 현재 쓰고 계신 폴더의 이름을 바꾸세요.

```powershell
Rename-Item 'C:\apps\digitaltwinportal12' 'DigitalTwinPortal'
```

이후 배포는 이 경로만 씁니다. 첫 `deploy.ps1` 실행 때 이 폴더의
`uploads`와 `.env`가 새 버전으로 자동 이관됩니다.

---

## 평소 배포 절차

### 개발 PC — 릴리스 만들기

```powershell
git tag -a v0.1.11 -m "v0.1.11"
git push origin v0.1.11
```

1분 남짓 뒤 릴리스가 발행됩니다. Actions에서 `Release - Windows package`가
초록불인지 확인하세요.

### 운영서버 — 배포

**1) 앱 중지**

콘솔에서 실행 중이면 해당 창에서 `Ctrl+C` 또는 창을 닫습니다.
Windows는 실행 중인 파일을 잠그기 때문에 반드시 먼저 중지해야 합니다.
(안 하면 `deploy.ps1`이 폴더를 건드리기 전에 거부합니다.)

**2) 배포**

```powershell
.\deploy.ps1 -AppPath 'C:\apps\DigitalTwinPortal'
```

한 번에 다음을 수행합니다.

1. 최신 릴리스의 `deploy_package.zip` 다운로드
2. 임시 폴더에 풀어 **의존성·Python 버전 검사** (문제가 있으면 여기서 중단)
3. 현재 폴더를 `DigitalTwinPortal_prev`로 이동
4. 새 버전을 운영 경로에 배치
5. 이전 버전에서 `backend\uploads`와 `backend\.env` 이관
6. `flask db upgrade` 실행

**3) 앱 시작**

```powershell
cd C:\apps\DigitalTwinPortal
.\run_server.ps1
```

### 자주 쓰는 옵션

```powershell
# 특정 버전 배포
.\deploy.ps1 -AppPath 'C:\apps\DigitalTwinPortal' -Tag v0.1.9

# DB는 건드리지 않고 폴더 교체만 (첫 시도에 권장)
.\deploy.ps1 -AppPath 'C:\apps\DigitalTwinPortal' -SkipMigrations

# 미리 받아둔 zip 사용
.\deploy.ps1 -AppPath 'C:\apps\DigitalTwinPortal' -ZipPath 'C:\tmp\deploy_package.zip'
```

---

## 롤백

직전 버전이 항상 `DigitalTwinPortal_prev`에 남아 있습니다.

```powershell
# 앱 중지 후
.\rollback.ps1 -AppPath 'C:\apps\DigitalTwinPortal'
cd C:\apps\DigitalTwinPortal
.\run_server.ps1
```

**파일만 되돌아갑니다. 마이그레이션은 취소되지 않습니다.** 실패한 배포가
파괴적 마이그레이션(컬럼 삭제·이름 변경 등)을 적용했다면 DB는 따로 복구해야 합니다.

---

## 패키지에 일부러 넣지 않는 것

두 가지는 운영 데이터라 git에도 패키지에도 없습니다. `deploy.ps1`이 이전
폴더에서 자동으로 옮기지만, 어디서 오는지 알아두시는 게 좋습니다.

| 항목 | 설명 |
|---|---|
| `backend\uploads` | 사용자가 업로드한 파일. 패키지에 있으면 운영 파일을 덮어씀 |
| `backend\.env` | `DATABASE_URL` 등 접속 정보. 저장소에 커밋하면 안 되는 값 |

최초 설치처럼 이관할 이전 폴더가 없으면 `.env`를 직접 만들어야 합니다.
`backend\.env.example`을 참고하세요.

---

## 문제 해결

**`Python version mismatch`**

서버 Python과 패키지 빌드 버전이 다릅니다. 운영 폴더는 건드리지 않은 상태입니다.
메시지에 두 버전이 표시되니, `.github/workflows/` 의 `ci-windows.yml`과
`release-windows.yml`에서 `python-version`을 서버 버전으로 맞추고 새 릴리스를 만드세요.

**`Cannot write to ... Close the running app`**

앱이 아직 실행 중이거나, 해당 폴더를 열어둔 탐색기·터미널이 있습니다.
모두 닫고 다시 실행하세요.

**`backend\.env is missing`**

`.env`를 이관하지 못했습니다. 마이그레이션과 기동에 `DATABASE_URL`이 필요하니
`DigitalTwinPortal_prev\backend\.env`에서 복사하거나 새로 만드세요.

**`Package is missing '...' in site-packages`**

릴리스 패키지가 불완전합니다. 운영 폴더는 건드리지 않은 상태이니
릴리스 워크플로를 확인하고 새로 만드세요.
