# 📊 Knowledge Graph Project

다양한 시각화 도구와 차트를 통합한 웹 애플리케이션입니다. 지식 그래프, 간트 차트, 기술 레이더, 스윔레인 차트 등의 모듈을 포함합니다.

## 📁 프로젝트 구조

```
52_KnowledgeGraphProject/
├── frontend/                   # 🏠 메인 React 애플리케이션
│   ├── src/
│   │   ├── App.jsx            # 메인 앱 + 라우팅
│   │   ├── main.jsx           # 앱 진입점
│   │   │
│   │   ├── pages/             # 📄 페이지 컴포넌트
│   │   │   ├── MainPage.jsx   # 메인 허브 페이지
│   │   │   └── EngineeringHub/
│   │   │       └── EngineeringHub.jsx
│   │   │
│   │   ├── modules/           # 🧩 기능별 모듈들
│   │   │   ├── knowledge-graph/     # 지식 그래프 모듈
│   │   │   │   ├── components/      # 그래프 컴포넌트들
│   │   │   │   │   ├── DataPanel/   # 데이터 패널 (노드/엣지 정보)
│   │   │   │   │   ├── KnowledgeGraph/ # 그래프 시각화 및 벌크 편집
│   │   │   │   │   └── Layout/      # 레이아웃, 헤더 & 타입 설정
│   │   │   │   ├── hooks/          # 그래프 관련 훅 (8개)
│   │   │   │   ├── utils/          # 그래프 유틸리티 (5개)
│   │   │   │   ├── data/           # 샘플 데이터
│   │   │   │   └── KnowledgeGraphApp.jsx
│   │   │   │
│   │   │   ├── gantt-chart/        # 간트 차트 모듈
│   │   │   │   ├── components/     # 간트 컴포넌트들
│   │   │   │   │   ├── GanttChart/ # 차트 시각화 & 타임라인
│   │   │   │   │   ├── TaskPanel/  # 작업 관리 패널 (CRUD)
│   │   │   │   │   └── Layout/     # 헤더 & 레이아웃
│   │   │   │   ├── hooks/          # 간트 관련 훅 (4개)
│   │   │   │   ├── utils/          # 날짜 & 작업 유틸리티 (8개)
│   │   │   │   ├── data/           # 샘플 작업 데이터
│   │   │   │   └── GanttChartApp.jsx
│   │   │   │
│   │   │   ├── tech-radar/         # 기술 레이더 모듈
│   │   │   │   ├── components/     # 레이더 컴포넌트들
│   │   │   │   │   ├── TechRadar/  # 레이더 시각화
│   │   │   │   │   ├── TechnologyPanel/ # 기술 관리 패널
│   │   │   │   │   ├── MaturityPanel/   # 성숙도 관리 패널
│   │   │   │   │   ├── GroupedTable/    # 그룹화된 테이블
│   │   │   │   │   ├── TechTable/       # 기술 목록 테이블
│   │   │   │   │   └── Layout/          # 헤더 & 레이아웃
│   │   │   │   ├── hooks/          # 레이더 관련 훅
│   │   │   │   ├── utils/          # 레이더 유틸리티
│   │   │   │   ├── data/           # 샘플 기술 데이터
│   │   │   │   └── TechRadarApp.jsx
│   │   │   │
│   │   │   ├── digital-twin-solution/   # 디지털 트윈 솔루션 모듈
│   │   │   │   ├── components/     # 디지털 트윈 컴포넌트들
│   │   │   │   │   ├── TechRadar/  # 레이더 시각화
│   │   │   │   │   ├── TechnologyPanel/ # 기술 관리 패널
│   │   │   │   │   ├── MaturityPanel/   # 성숙도 관리 패널
│   │   │   │   │   ├── SectorPanel/     # 섹터 관리 패널
│   │   │   │   │   ├── GroupedTable/    # 그룹화된 테이블
│   │   │   │   │   ├── TechTable/       # 기술 목록 테이블
│   │   │   │   │   └── Layout/          # 헤더 & 레이아웃
│   │   │   │   ├── hooks/          # 디지털 트윈 관련 훅
│   │   │   │   ├── utils/          # 디지털 트윈 유틸리티
│   │   │   │   ├── data/           # 샘플 데이터
│   │   │   │   └── DigitalTwinSolutionApp.jsx
│   │   │   │
│   │   │   ├── swimlane-chart/     # 스윔레인 차트 모듈
│   │   │   │   ├── components/     # 스윔레인 컴포넌트들
│   │   │   │   │   ├── SwimlaneChart/ # 차트 시각화
│   │   │   │   │   │   ├── components/  # 차트 하위 컴포넌트 (4개)
│   │   │   │   │   │   ├── hooks/       # 차트 전용 훅 (2개)
│   │   │   │   │   │   └── utils/       # 차트 유틸리티
│   │   │   │   │   ├── ProcessCell/   # 프로세스 셀 컴포넌트
│   │   │   │   │   │   └── components/  # 프로세스 하위 컴포넌트 (3개)
│   │   │   │   │   ├── FilterPanel/   # 필터 패널
│   │   │   │   │   └── Layout/        # 헤더 & 레이아웃
│   │   │   │   ├── utils/          # 필터 유틸리티
│   │   │   │   └── SwimlaneChartApp.jsx
│   │   │   │
│   │   │   └── tech-archive/       # 기술 아카이브 모듈
│   │   │       ├── components/     # 아카이브 컴포넌트들
│   │   │       │   ├── Navigation/ # 네비게이션
│   │   │       │   ├── Viewer/     # 문서 뷰어
│   │   │       │   ├── Filter/     # 필터 (예비)
│   │   │       │   ├── ProjectModal/ # 프로젝트 모달
│   │   │       │   └── Layout/     # 헤더
│   │   │       ├── hooks/          # 아카이브 관련 훅
│   │   │       ├── data/           # 샘플 데이터
│   │   │       ├── utils/          # 유틸리티 (예비)
│   │   │       └── TechArchiveApp.jsx
│   │   │
│   │   ├── shared/            # 🔗 공통 리소스
│   │   │   ├── components/    # 공통 컴포넌트
│   │   │   │   ├── Modal/     # 통합 모달 시스템 (8개)
│   │   │   │   ├── ImportExport/ # 데이터 가져오기/내보내기 (4개)
│   │   │   │   └── Header/    # 공통 헤더 컴포넌트
│   │   │   ├── hooks/         # 공통 훅
│   │   │   └── utils/         # 공통 유틸리티
│   │   │
│   │   ├── routes/           # 🛣️ 라우팅 설정 (예비)
│   │   ├── styles/           # 🎨 전역 스타일 (예비)
│   │   └── utils/            # 🛠️ 전역 유틸리티
│   │
│   ├── package.json          # 의존성 관리
│   ├── vite.config.js        # Vite 설정
│   ├── MODULE_CREATION_GUIDE.md
│   ├── PROJECT_ARCHITECTURE.md
│   └── MODULE_TEMPLATE/      # 새 모듈 생성용 템플릿
│
├── CSV_IMPORT_EXPORT_README.md  # CSV 가져오기/내보내기 문서
├── test-tech-radar-data.csv     # 테스트 데이터 파일들
├── test-tech-radar-data.json
├── test-tech-radar-simple.json
├── 통합 문서1.xlsx
├── useless/                     # 사용하지 않는 파일들
└── README.md                    # 📖 이 파일
```

## 🎯 주요 모듈

### 1. 📊 Knowledge Graph (지식 그래프)
- **경로**: `frontend/src/modules/knowledge-graph/`
- **기능**: 노드와 엣지 기반 지식 그래프 시각화
- **주요 컴포넌트**: vis.js 기반 그래프, 데이터 패널, 벌크 편집

### 2. 📅 Gantt Chart (간트 차트)
- **경로**: `frontend/src/modules/gantt-chart/`
- **기능**: 프로젝트 일정 관리 및 시각화
- **주요 컴포넌트**: 타임라인, 작업 패널, 날짜 유틸리티

### 3. 🎯 Tech Radar (기술 레이더)
- **경로**: `frontend/src/modules/tech-radar/`
- **기능**: 기술 성숙도 및 트렌드 시각화
- **주요 컴포넌트**: 레이더 차트, 기술 관리 패널

### 4. 🔧 Digital Twin Solution (디지털 트윈 솔루션)
- **경로**: `frontend/src/modules/digital-twin-solution/`
- **기능**: 디지털 트윈 기술 관리 및 시각화
- **주요 컴포넌트**: 기술 레이더, 섹터 관리

### 5. 🏊 Swimlane Chart (스윔레인 차트)
- **경로**: `frontend/src/modules/swimlane-chart/`
- **기능**: 프로세스 플로우 시각화
- **주요 컴포넌트**: 그리드 차트, 프로세스 셀, 연결 렌더러

### 6. 📚 Tech Archive (기술 아카이브)
- **경로**: `frontend/src/modules/tech-archive/`
- **기능**: 기술 문서 및 프로젝트 아카이브
- **주요 컴포넌트**: 문서 뷰어, 네비게이션

## 🛠️ 기술 스택

- **Frontend**: React + Vite
- **시각화**: vis.js, D3.js, SVG
- **스타일링**: CSS Modules
- **상태 관리**: React Hooks
- **데이터**: CSV/JSON 가져오기/내보내기

## 🚀 시작하기

1. **프로젝트 클론**
   ```bash
   cd D:\0_Program\52_KnowledgeGraphProject\frontend
   ```

2. **의존성 설치**
   ```bash
   npm install
   ```

3. **개발 서버 시작**
   ```bash
   npm run dev
   ```

4. **빌드**
   ```bash
   npm run build
   ```

## 📋 개발 가이드

### 새 모듈 추가
1. `frontend/MODULE_TEMPLATE/` 폴더를 복사
2. `frontend/src/modules/` 아래에 새 모듈 폴더 생성
3. `MODULE_CREATION_GUIDE.md` 참조하여 개발

### 공통 컴포넌트 사용
- **모달**: `shared/components/Modal/`
- **가져오기/내보내기**: `shared/components/ImportExport/`
- **헤더**: `shared/components/Header/`

### 파일 관리 규칙
- 700줄 이상 파일은 자동으로 리팩토링하여 분할
- 백업 파일은 `파일명.backup날짜` 형식으로 생성

## 📊 데이터 형식

각 모듈은 CSV/JSON 형식의 데이터 가져오기/내보내기를 지원합니다:
- **Knowledge Graph**: 노드/엣지 데이터

## 📦 GitHub 등록 및 Windows 기반 배포(요약)

이 프로젝트는 ReportArchive GitHub 계정 하에 레포지토리를 생성하여 관리합니다. 운영서버와 개발환경이 Windows인 점을 고려해 Windows 중심의 CI/CD 및 릴리스 패키지를 사용합니다.

핵심 흐름
- 로컬 개발 → Push → GitHub Actions(Windows)에서 빌드/패키지 → Tag(push)로 Release 생성 → 운영서버에서 `deploy.ps1` 실행

배포 절차 전체는 [DEPLOY_WINDOWS.md](DEPLOY_WINDOWS.md)를 참고하세요. 요약하면 태그를 푸시해
릴리스를 만든 뒤, 운영서버에서 앱을 중지하고 아래를 실행합니다.

```powershell
.\deploy.ps1 -AppPath 'C:\apps\DigitalTwinPortal'
```

다운로드·검증·폴더 교체·`uploads`/`.env` 이관·마이그레이션까지 한 번에 처리하며,
직전 버전은 `_prev`에 남아 `rollback.ps1`로 되돌릴 수 있습니다.

필요 작업(간단)
1. 이 저장소를 ReportArchive 계정으로 등록(레포 생성) — 권한은 담당자와 협의
2. `.github/workflows/ci-windows.yml`(CI)와 `.github/workflows/release-windows.yml`(릴리스)을 활성화
3. GitHub 시크릿 설정: 아래 목록 참조
4. 태그를 푸시하면 릴리스가 생성되고 `deploy_package.zip`이 Release asset으로 올라감

필수 GitHub 시크릿(권장)
- `PUBLISH_PAT`: Release 업로드 및 리포지토리 권한(최소권한: `repo`)
- `MCP_PAT`: MCP 서버 연동용 개인 액세스 토큰(운영용 — 문서화 및 별도 보관)
- `DOCKER_HUB_TOKEN` / `DOCKER_HUB_USERNAME`: 이미지 푸시가 필요한 경우

로컬 테스트 명령
- Windows 빌드(테스트):
```powershell
powershell -File .\scripts\ci\windows_build.ps1
```
- 패키지 생성(릴리스용):
```powershell
powershell -File .\scripts\ci\package_deploy.ps1
```

운영서버 주의사항
- `deploy_package.zip`의 `site-packages`는 빌드한 Python 버전(예: 3.11)과 호환되어야 합니다. 버전을 미리 아실 필요는 없습니다 — `deploy.ps1`이 패키지에 기록된 빌드 버전과 서버 버전을 대조해, 다르면 운영 폴더를 건드리기 전에 두 버전을 알려주고 중단합니다.
- 배포 전에 실행 중인 앱을 반드시 중지하세요. Windows가 실행 중인 파일을 잠급니다.
- 권장: 서비스로 등록(NSSM 등)하여 자동 시작/재시작을 구성하세요.

추가 참고
- MCP 관련 구성 및 PAT 발급·관리 절차는 `mcp_server/README.md`를 참고하세요. ReportArchive의 기존 워크플로와 시크릿 구성을 검토 후 차이점을 문서화해야 합니다.

- **Gantt Chart**: 작업/일정 데이터
- **Tech Radar**: 기술/성숙도 데이터
- **Swimlane Chart**: 프로세스/플로우 데이터

자세한 내용은 `CSV_IMPORT_EXPORT_README.md`를 참조하세요.

## 📁 아키텍처

프로젝트 아키텍처에 대한 자세한 내용은 `frontend/PROJECT_ARCHITECTURE.md`를 참조하세요.

---

## 📝 업데이트 로그

- **2025-09-25**: 프로젝트 구조 업데이트 및 README.md 생성
- 각 모듈별 백업 파일들이 포함된 현재 상태 반영
- 6개 주요 모듈의 상세 구조 및 기능 명시
