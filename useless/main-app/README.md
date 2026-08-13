# Knowledge Graph Project

기업 내 데이터와 문서들을 지식 그래프로 구조화하여 연결하고 시각화하는 프로젝트입니다.

## 프로젝트 구조

```
52_KnowledgeGraphProject/
├── main-app/           # 메인 진입점 앱 (카드 UI + 라우팅)
├── frontend/          # Knowledge Graph 핵심 애플리케이션
└── README.md
```

## 실행 방법

### 1. 의존성 설치

```bash
cd D:\0_Program\52_KnowledgeGraphProject\main-app
npm install
```

### 2. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 http://localhost:3000 으로 접속

## 기능

### 메인 진입페이지 (Cards)
- 다양한 시뮬레이터와 도구들을 카드 형태로 표시
- 각 카드 클릭 시 해당 애플리케이션으로 이동

### Knowledge Graph
- 노드와 엣지로 구성된 그래프 데이터 시각화
- 인터랙티브한 그래프 탐색
- 데이터 필터링 및 검색
- 노드/엣지 추가, 편집, 삭제
- 타입 관리 (노드 타입, 엣지 타입)
- 데이터 가져오기/내보내기
- 다양한 레이아웃 지원

## 주요 라이브러리

- React 18
- React Router DOM
- Styled Components
- Framer Motion
- D3.js
- Vis.js Network
- Lucide React (아이콘)

## 개발 참고사항

- TypeScript 지원
- Vite 기반 빌드 시스템
- ESLint 코드 품질 관리
- 700줄 이상 파일은 자동으로 리팩토링 대상
