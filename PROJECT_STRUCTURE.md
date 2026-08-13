# 프로젝트 구조 상세 문서

## 프로젝트 개요

**프로젝트명**: Knowledge Graph Project
**위치**: `F:\데이터\0_Program\52_KnowledgeGraphProject`
**프로젝트 타입**: React + Vite 기반 시각화 웹 애플리케이션

다양한 시각화 도구와 차트를 통합한 웹 애플리케이션으로, 지식 그래프, 간트 차트, 기술 레이더, 스윔레인 차트 등의 모듈을 포함합니다.

---

## 전체 디렉토리 구조

```
52_KnowledgeGraphProject/
├── frontend/                          # 메인 React 애플리케이션
│   ├── src/                          # 소스 코드
│   │   ├── App.jsx                   # 메인 애플리케이션 + 라우팅
│   │   ├── App.css                   # 메인 애플리케이션 스타일
│   │   ├── main.jsx                  # 애플리케이션 진입점
│   │   ├── index.css                 # 전역 스타일
│   │   │
│   │   ├── pages/                    # 페이지 컴포넌트
│   │   │   ├── MainPage.jsx         # 메인 허브 페이지
│   │   │   └── EngineeringHub/      # 엔지니어링 허브
│   │   │
│   │   ├── modules/                  # 기능별 모듈
│   │   │   ├── knowledge-graph/     # 지식 그래프 모듈
│   │   │   ├── gantt-chart/         # 간트 차트 모듈
│   │   │   ├── tech-radar/          # 기술 레이더 모듈
│   │   │   ├── digital-twin-solution/    # 디지털 트윈 솔루션 모듈
│   │   │   ├── digital-twin-dashboard/   # 디지털 트윈 대시보드 모듈
│   │   │   ├── swimlane-chart/      # 스윔레인 차트 모듈
│   │   │   └── tech-archive/        # 기술 아카이브 모듈
│   │   │
│   │   ├── shared/                   # 공통 리소스
│   │   │   ├── components/          # 공통 컴포넌트
│   │   │   ├── hooks/               # 공통 React 훅
│   │   │   └── utils/               # 공통 유틸리티
│   │   │
│   │   ├── routes/                   # 라우팅 설정 (예비)
│   │   ├── styles/                   # 전역 스타일 (예비)
│   │   └── utils/                    # 전역 유틸리티
│   │       └── colorUtils.js        # 색상 관련 유틸리티
│   │
│   ├── backup/                       # 백업 파일들
│   ├── dist/                         # 빌드 결과물
│   ├── node_modules/                 # NPM 패키지
│   ├── MODULE_TEMPLATE/              # 새 모듈 생성용 템플릿
│   │
│   ├── package.json                  # NPM 의존성 관리
│   ├── package-lock.json             # NPM 의존성 잠금 파일
│   ├── vite.config.js                # Vite 설정 파일
│   ├── index.html                    # HTML 엔트리 포인트
│   │
│   ├── MODULE_CREATION_GUIDE.md      # 모듈 생성 가이드
│   ├── frontend1.zip                 # 백업 아카이브
│   ├── frontend2.zip
│   ├── frontend3.zip
│   ├── frontend4.zip
│   └── 지식그래프데이터.xlsx          # 샘플 데이터
│
├── useless/                          # 사용하지 않는 파일들
│   ├── backups/
│   ├── components/
│   ├── debug-files/
│   ├── main-app/
│   ├── src/
│   └── *.md                          # 구 문서 파일들
│
├── README.md                         # 프로젝트 README
├── CSV_IMPORT_EXPORT_README.md       # CSV 가져오기/내보내기 문서
├── HYBRID_CSV_GUIDE.md               # 하이브리드 CSV 가이드
│
├── test-tech-radar-data.csv          # 테스트 데이터 파일
├── test-tech-radar-data.json
├── test-tech-radar-simple.json
├── test-digital-twin-hybrid-sample.csv
├── test-digital-twin-multi-table-sample.csv
│
├── frontend.zip                      # 프론트엔드 백업 아카이브
├── frontend (2).zip
│
├── 디지털트윈 대시보드.xlsx           # 샘플 데이터 파일
├── 디지털트윈 대시보드 new.xlsx
├── 통합 문서1.xlsx
└── 로드맵 관련 모듈.txt               # 메모 파일
```

---

## 모듈 상세 구조

### 1. Knowledge Graph (지식 그래프)
**경로**: `frontend/src/modules/knowledge-graph/`

```
knowledge-graph/
├── components/
│   ├── DataPanel/              # 노드/엣지 정보 패널
│   ├── KnowledgeGraph/         # 그래프 시각화 및 벌크 편집
│   └── Layout/                 # 레이아웃, 헤더 & 타입 설정
├── hooks/                      # 그래프 관련 React 훅 (8개)
├── utils/                      # 그래프 유틸리티 (5개)
├── data/                       # 샘플 데이터
└── KnowledgeGraphApp.jsx       # 메인 앱 컴포넌트
```

**주요 기능**:
- vis.js 기반 노드-엣지 그래프 시각화
- 노드/엣지 추가, 수정, 삭제
- 벌크 편집 기능
- CSV/JSON 데이터 가져오기/내보내기
- 노드 타입별 색상 관리

---

### 2. Gantt Chart (간트 차트)
**경로**: `frontend/src/modules/gantt-chart/`

```
gantt-chart/
├── components/
│   ├── GanttChart/             # 차트 시각화 & 타임라인
│   ├── TaskPanel/              # 작업 관리 패널 (CRUD)
│   └── Layout/                 # 헤더 & 레이아웃
├── hooks/                      # 간트 관련 React 훅 (4개)
├── utils/                      # 날짜 & 작업 유틸리티 (8개)
├── data/                       # 샘플 작업 데이터
└── GanttChartApp.jsx           # 메인 앱 컴포넌트
```

**주요 기능**:
- 프로젝트 일정 관리 및 시각화
- 작업 추가, 수정, 삭제
- 타임라인 뷰
- 의존성 관리
- 마일스톤 관리

---

### 3. Tech Radar (기술 레이더)
**경로**: `frontend/src/modules/tech-radar/`

```
tech-radar/
├── components/
│   ├── TechRadar/              # 레이더 시각화
│   ├── TechnologyPanel/        # 기술 관리 패널
│   ├── MaturityPanel/          # 성숙도 관리 패널
│   ├── GroupedTable/           # 그룹화된 테이블
│   ├── TechTable/              # 기술 목록 테이블
│   └── Layout/                 # 헤더 & 레이아웃
├── hooks/                      # 레이더 관련 React 훅
├── utils/                      # 레이더 유틸리티
├── data/                       # 샘플 기술 데이터
└── TechRadarApp.jsx            # 메인 앱 컴포넌트
```

**주요 기능**:
- 기술 성숙도 및 트렌드 시각화
- 4개 섹터 (Tools, Techniques, Platforms, Languages & Frameworks)
- 성숙도 링 관리 (Adopt, Trial, Assess, Hold)
- 기술 정보 관리

---

### 4. Digital Twin Solution (디지털 트윈 솔루션)
**경로**: `frontend/src/modules/digital-twin-solution/`

```
digital-twin-solution/
├── components/
│   ├── TechRadar/              # 레이더 시각화
│   ├── TechnologyPanel/        # 기술 관리 패널
│   ├── MaturityPanel/          # 성숙도 관리 패널
│   ├── SectorPanel/            # 섹터 관리 패널
│   ├── GroupedTable/           # 그룹화된 테이블
│   ├── TechTable/              # 기술 목록 테이블
│   └── Layout/                 # 헤더 & 레이아웃
├── hooks/                      # 디지털 트윈 관련 React 훅
├── utils/                      # 디지털 트윈 유틸리티
├── data/                       # 샘플 데이터
└── DigitalTwinSolutionApp.jsx  # 메인 앱 컴포넌트
```

**주요 기능**:
- 디지털 트윈 기술 관리 및 시각화
- 섹터 커스터마이징
- 기술 레이더 시각화
- 성숙도 관리

---

### 5. Digital Twin Dashboard (디지털 트윈 대시보드)
**경로**: `frontend/src/modules/digital-twin-dashboard/`

```
digital-twin-dashboard/
├── components/
├── hooks/
├── utils/
├── data/
└── DigitalTwinDashboardApp.jsx
```

**주요 기능**:
- 디지털 트윈 대시보드
- 데이터 시각화 및 분석

---

### 6. Swimlane Chart (스윔레인 차트)
**경로**: `frontend/src/modules/swimlane-chart/`

```
swimlane-chart/
├── components/
│   ├── SwimlaneChart/          # 차트 시각화
│   │   ├── components/         # 차트 하위 컴포넌트 (4개)
│   │   ├── hooks/              # 차트 전용 React 훅 (2개)
│   │   └── utils/              # 차트 유틸리티
│   ├── ProcessCell/            # 프로세스 셀 컴포넌트
│   │   └── components/         # 프로세스 하위 컴포넌트 (3개)
│   ├── FilterPanel/            # 필터 패널
│   └── Layout/                 # 헤더 & 레이아웃
├── utils/                      # 필터 유틸리티
└── SwimlaneChartApp.jsx        # 메인 앱 컴포넌트
```

**주요 기능**:
- 프로세스 플로우 시각화
- SVG 기반 그리드 차트
- 프로세스 셀 관리
- 연결선 렌더링
- 필터 기능

---

### 7. Tech Archive (기술 아카이브)
**경로**: `frontend/src/modules/tech-archive/`

```
tech-archive/
├── components/
│   ├── Navigation/             # 네비게이션
│   ├── Viewer/                 # 문서 뷰어
│   ├── Filter/                 # 필터 (예비)
│   ├── ProjectModal/           # 프로젝트 모달
│   └── Layout/                 # 헤더
├── hooks/                      # 아카이브 관련 React 훅
├── data/                       # 샘플 데이터
├── utils/                      # 유틸리티 (예비)
└── TechArchiveApp.jsx          # 메인 앱 컴포넌트
```

**주요 기능**:
- 기술 문서 및 프로젝트 아카이브
- 문서 뷰어 (React Quill 기반)
- 프로젝트 네비게이션
- 문서 검색 및 필터링

---

## Shared (공통 리소스)

**경로**: `frontend/src/shared/`

```
shared/
├── components/
│   ├── Modal/                  # 통합 모달 시스템 (8개 컴포넌트)
│   ├── ImportExport/           # 데이터 가져오기/내보내기 (4개 컴포넌트)
│   └── Header/                 # 공통 헤더 컴포넌트
├── hooks/                      # 공통 React 훅
└── utils/                      # 공통 유틸리티
```

**주요 컴포넌트**:
- **Modal System**: 재사용 가능한 모달 컴포넌트
- **Import/Export**: CSV/JSON 파일 가져오기/내보내기
- **Header**: 공통 헤더 컴포넌트

---

## 기술 스택

### Frontend
- **Framework**: React 18.2.0
- **Build Tool**: Vite 4.4.5
- **Routing**: React Router DOM 6.30.1
- **Styling**: CSS Modules, Styled Components 5.3.11

### 시각화 라이브러리
- **vis-network**: 9.1.6 (지식 그래프)
- **vis-data**: 7.1.4 (데이터 관리)
- **d3**: 7.8.5 (차트 시각화)

### UI/UX
- **framer-motion**: 10.18.0 (애니메이션)
- **lucide-react**: 0.263.1 (아이콘)
- **react-resizable-panels**: 0.0.55 (리사이징 패널)
- **react-quill**: 2.0.0 (텍스트 에디터)

### 개발 도구
- **ESLint**: 8.45.0 (코드 린팅)
- **TypeScript Types**: @types/d3, @types/react

---

## NPM 스크립트

```json
{
  "dev": "vite",                    // 개발 서버 실행 (http://localhost:5173)
  "build": "vite build",            // 프로덕션 빌드
  "lint": "eslint . --ext js,jsx",  // 코드 린팅
  "preview": "vite preview"         // 빌드 결과 미리보기
}
```

---

## 데이터 형식

각 모듈은 CSV/JSON 형식의 데이터 가져오기/내보내기를 지원합니다:

### Knowledge Graph
- **노드**: id, label, type, color
- **엣지**: from, to, label

### Gantt Chart
- **작업**: id, name, start, end, progress, dependencies

### Tech Radar
- **기술**: name, sector, maturity, description

### Swimlane Chart
- **프로세스**: id, name, lane, connections

자세한 내용은 `CSV_IMPORT_EXPORT_README.md`를 참조하세요.

---

## 개발 가이드

### 새 모듈 추가 방법

1. `frontend/MODULE_TEMPLATE/` 폴더를 복사
2. `frontend/src/modules/` 아래에 새 모듈 폴더 생성
3. `MODULE_CREATION_GUIDE.md` 참조하여 개발
4. `App.jsx`에 라우트 추가

### 파일 관리 규칙

- 700줄 이상 파일은 자동으로 리팩토링하여 분할
- 백업 파일은 `파일명.backup날짜` 형식으로 생성
- 사용하지 않는 파일은 `useless/` 폴더로 이동

### 코드 컨벤션

- **컴포넌트**: PascalCase (예: `KnowledgeGraph.jsx`)
- **유틸리티**: camelCase (예: `graphUtils.js`)
- **훅**: use 접두사 (예: `useGraphData.js`)
- **CSS 모듈**: ComponentName.module.css

---

## 프로젝트 실행 방법

### 1. 의존성 설치
```bash
cd frontend
npm install
```

### 2. 개발 서버 실행
```bash
npm run dev
```
브라우저에서 `http://localhost:5173` 접속

### 3. 프로덕션 빌드
```bash
npm run build
```
빌드 결과물은 `frontend/dist/` 폴더에 생성됩니다.

### 4. 빌드 미리보기
```bash
npm run preview
```

---

## 백업 파일

### Frontend 백업
- `frontend1.zip` ~ `frontend4.zip`: 버전별 백업
- `frontend.zip`, `frontend (2).zip`: 전체 프로젝트 백업

### 개별 모듈 백업
- `frontend/backup/`: 주요 변경 사항 백업

---

## 문서 파일

- **README.md**: 프로젝트 전체 개요
- **PROJECT_STRUCTURE.md**: 상세 프로젝트 구조 (이 문서)
- **CSV_IMPORT_EXPORT_README.md**: CSV 가져오기/내보내기 가이드
- **HYBRID_CSV_GUIDE.md**: 하이브리드 CSV 포맷 가이드
- **MODULE_CREATION_GUIDE.md**: 새 모듈 생성 가이드

---

## 업데이트 로그

- **2025-10-29**: 상세 프로젝트 구조 문서 생성
- **2025-09-25**: 프로젝트 구조 업데이트 및 README.md 생성
- 6개 주요 모듈의 상세 구조 및 기능 명시
