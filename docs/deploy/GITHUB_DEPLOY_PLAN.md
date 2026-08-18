# GitHub 기반 배포 계획 및 ReportArchive 비교

요약
- 목적: 이 저장소(디지털 트윈 포탈)를 GitHub에 등록하고, ReportArchive 사례를 참고해 자동 빌드·배포·릴리스(아카이브) 방식으로 운영할 수 있도록 실행계획을 세운다.
- 산출물: 본문 비교·차이점 정리, 위험요소, 단계별 실행 계획(Windows vs Linux 고려), 권장 GitHub Actions 구성 요약.

1. 현황 요약(두 프로젝트)
- ReportArchive (참고 구현)
  - 플랫폼: WSL/Linux 기반(레포에 여러 곳에서 `/home/yongjin/projects/ReportArchive` 참조)
  - 스택: FastAPI / MCP 서버 패턴, Python 가상환경, wheel 번들 및 오프라인 설치 스크립트 제공
  - 배포 방식(참고): 로컬 WSL 개발, 패키지(wheel)·스크립트 번들, 회귀·e2e 스크립트로 자동검증

- Digital Twin Portal (현재 저장소)
  - 플랫폼: 주로 Windows 기반(프로젝트에 `setup_venv.bat`, `.ps1` 등 존재)
  - 스택: 백엔드(프로젝트 내 `backend/` — 기존 `run.py` 등), 프론트엔드(`frontend/` with `package.json` + Vite), MCP 서버(`mcp_server/`) 존재
  - 현황: ReportArchive를 참고한 MCP 구성과 테스트가 포함되어 있음(참고 문서 존재). 다만 운영 환경은 Windows 중심.

2. 핵심 차이점(배포·운영 관점)
- OS 및 파일시스템
  - Linux: 대소문자 구분, systemd/서비스 단위 배포, 쉘 스크립트, 권한·소유권 관리가 중요
  - Windows: CRLF, 실행파일(.bat/.ps1), 서비스 등록 방식(Windows Service/IIS), 파일 경로식(`\\`)과 권한 모델 차이
- 가상환경 및 패키징
  - Linux: pip wheel, systemd 서비스 + virtualenv 권장
  - Windows: venv + .bat/.ps1 설치 스크립트 또는 Windows 서비스 래퍼
- CI/CD 실행 환경
  - ReportArchive: WSL/Ubuntu 환경에서 테스트·빌드 검증이 주로 이뤄짐
  - Digital Twin: CI는 Linux에서 돌릴 수 있지만, Windows 특정 동작(스크립트·권한) 검증이 필요

3. 위험요소
- Windows 전용 스크립트가 Linux CI에서 실패할 수 있음 (또는 그 반대)
- 파일 권한·경로 이슈로 인한 런타임 버그
- PAT·시크릿 취급(특히 MCP용 PAT)은 절대 레포에 노출하면 안 됨

4. 권장 단계별 실행 계획 (우선순위 순)
1) 문서·메타 추가(간단·즉시)
   - 최상위 `README.md`에 GitHub 등록·릴리스·시크릿 설정 가이드 추가
   - `GITHUB_DEPLOY_PLAN.md`(이 문서) 저장
   - `.gitignore` + `LICENSE` 추가
2) 패키징 정리
   - Python: `pyproject.toml` 또는 `setup.py`/`requirements.txt` 정리(backend, mcp_server)
   - Frontend: `package.json` `build` 스크립트(이미 존재하면 확인)
3) CI 구성 (GitHub Actions)
   - 기본: matrix 빌드(`ubuntu-latest`, `windows-latest`)로 backend 테스트와 frontend 빌드 수행
   - Windows job: `setup_venv.bat`/`.ps1` 실행 경로 테스트(Windows-only 스크립트 검증)
   - Linux job: 린트·유닛테스트·wheel 빌드, mcp_server 패키징(wheel)
4) Release/Archive 워크플로
   - `on: push` 또는 `workflow_dispatch`로 동작하는 릴리스 빌드
   - 빌드 결과물: `frontend/dist`(zip), `backend` wheel 또는 tar.gz, `mcp_server` 패키지
   - `actions/upload-release-asset` 또는 `actions/create-release` 사용해 GitHub Release에 업로드
5) 배포 방식 문서화
   - Windows: `setup_venv.bat`·서비스 등록 안내, 권한·포트 방화벽 설정 안내
   - Linux: systemd 서비스 유닛 예시, 가상환경·권한 설정 안내
6) 보안·시크릿 관리
   - 필요한 시크릿: `GITHUB_TOKEN`(Actions 기본), `DOCKER_HUB_TOKEN`(선택), `PUBLISH_PAT`(release 업로드용, 최소 권한) 및 MCP용 PAT 관리 방법 문서화
7) 자동화 추가(선택)
   - GitHub Pages로 프론트 배포 또는 Release artifact 업로드 후 서버에서 자동 배포 스크립트 트리거
   - Release 생성 시 태그 규칙을 정해 자동 릴리스·릴리스 노트 생성

5. GitHub Actions 제안(요약)
- CI (ci.yml)
  - trigger: push, pull_request
  - matrix: os: [ubuntu-latest, windows-latest]
  - steps: checkout, setup-python, install deps, run backend tests, build frontend (`npm ci && npm run build`), archive artifacts
- Release (release.yml)
  - trigger: manual (`workflow_dispatch`) or on tag push
  - build on `ubuntu-latest` (and optionally `windows-latest`), upload artifacts to Release
  - include signing/sha256 checksums if 필요

6. README/문서 업데이트 위치
- 참고로 저는 `mcp_server/README.md` 파일을 열어 ReportArchive 관련 설명을 확인했습니다. (아직 최상위 `README.md`는 수정하지 않았습니다.)

7. 다음 작업 권장(저의 제안)
 - 즉시: `.gitignore`와 `LICENSE` 추가, 그리고 이 `GITHUB_DEPLOY_PLAN.md`를 검토해 승인해 주세요.
 - 다음: `ci.yml`(GitHub Actions) 초기 버전 추가: ubuntu+windows matrix로 최소 빌드/테스트 실행.

부록: 필요한 GitHub 시크릿(초기)
- `PUBLISH_PAT` — Release 업로드용 (minimal: repo & packages 권한)
- `MCP_PAT` — MCP 연동용(운영 비밀, 필요 시 문서화만)
- `FRONTEND_STATIC_BUCKET_KEY` 등 배포 대상이 있을 경우 별도 추가

파일 위치: 이 문서는 저장소 루트의 `GITHUB_DEPLOY_PLAN.md` 입니다.

필요하시면 바로 `.gitignore`와 `LICENSE`를 생성하고, 이어서 `ci.yml` 샘플을 추가하겠습니다.
