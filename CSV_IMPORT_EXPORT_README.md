# CSV Import/Export 기능 추가

## 개요

각 모듈(Gantt Chart, Knowledge Graph, Tech Radar)에 CSV 형식의 import/export 기능을 추가했습니다. 기존 JSON 형식과 함께 dropdown 방식으로 선택할 수 있습니다.

## 추가된 기능

### 1. 공통 컴포넌트
- `ImportDropdown`: JSON/CSV 파일 import를 위한 dropdown 컴포넌트
- `ExportDropdown`: JSON/CSV 파일 export를 위한 dropdown 컴포넌트
- `csvUtils.js`: CSV 파싱/변환을 위한 공통 유틸리티

### 2. 모듈별 CSV 변환 유틸리티

#### Gantt Chart (`gantt-chart/utils/csvUtils.js`)
- `tasksToCSV()`: Task 데이터를 CSV 형태로 변환
- `csvToTasks()`: CSV 데이터를 Task 형태로 변환
- `validateGanttCSVData()`: Gantt CSV 데이터 유효성 검증
- `tasksToHierarchicalCSV()`: 계층 구조가 표현된 CSV 변환

**CSV 필드:**
```
ID, Name, Description, Start Date, End Date, Duration (Days), Progress (%), 
Status, Priority, Assignee, Parent ID, Is Parent, Color, Notes, Created At, Updated At
```

#### Knowledge Graph (`knowledge-graph/utils/csvUtils.js`)
- `graphDataToCSV()`: 그래프 데이터를 노드/엣지 CSV로 분리 변환
- `csvToGraphData()`: CSV 데이터를 그래프 데이터로 변환
- `validateKnowledgeGraphCSVData()`: 그래프 CSV 데이터 유효성 검증
- `csvArrayToGraphData()`: 단일 CSV 파일을 그래프 데이터로 변환

**노드 CSV 필드:**
```
ID, Label, Type, Description, Color, Size, X, Y, Fixed, Hidden, 
Created At, Updated At, Properties
```

**엣지 CSV 필드:**
```
ID, From, To, Label, Type, Color, Width, Arrows, Dashes, Hidden, 
Created At, Updated At, Properties
```

#### Tech Radar (`tech-radar/utils/csvUtils.js`)
- `technologiesToCSV()`: 기술 데이터를 CSV 형태로 변환
- `csvToTechnologies()`: CSV 데이터를 기술 데이터로 변환
- `validateTechRadarCSVData()`: Tech Radar CSV 데이터 유효성 검증
- `technologiesToGroupedCSV()`: 사분면별로 그룹화된 CSV 변환
- `technologiesToStatisticsCSV()`: 링별 통계 CSV 변환

**CSV 필드:**
```
ID, Name, Description, Quadrant, Ring, Is New, Moved, Category, Tags, 
Website, License, Assessment, Language, Platform, Maturity Level, 
Adoption Status, Strategic Importance, Risk Level, Investment, Timeline, 
Owner, Team, Budget, Notes, Created At, Updated At, Last Reviewed
```

## 사용 방법

### Import
1. 각 모듈의 헤더에서 "불러오기" 버튼 클릭
2. Dropdown에서 JSON 또는 CSV 선택
3. 파일 선택 및 업로드
4. 자동으로 데이터 형식 검증 후 import

### Export
1. 각 모듈의 헤더에서 "내보내기" 버튼 클릭
2. Dropdown에서 JSON 또는 CSV 선택
3. 파일 자동 다운로드

## 특징

### 1. 사용자 친화적 UI
- Dropdown 형태로 파일 형식 선택
- 각 형식별 설명 제공
- 로딩 상태 표시
- 오류 메시지 표시

### 2. 데이터 유효성 검증
- 필수 필드 검증
- 데이터 타입 검증
- 중복 ID 검증
- 관계 무결성 검증 (Knowledge Graph)

### 3. 유연한 CSV 지원
- 다양한 구분자 지원 (`,`, `;`, `\t`, `|`)
- 따옴표 처리
- 줄바꿈 처리
- 이스케이프 문자 처리

### 4. 계층 구조 지원 (Gantt Chart)
- 부모-자식 관계 유지
- 계층 표현을 위한 들여쓰기
- 레벨별 구분

### 5. 복합 데이터 지원 (Knowledge Graph)
- 노드와 엣지 분리 export
- 단일 파일로 import 가능
- Properties JSON 직렬화

## 파일 구조

```
frontend/src/
├── shared/
│   ├── components/ImportExport/
│   │   ├── ImportDropdown.jsx
│   │   ├── ImportDropdown.css
│   │   ├── ExportDropdown.jsx
│   │   ├── ExportDropdown.css
│   │   └── index.js
│   └── utils/
│       └── csvUtils.js
└── modules/
    ├── gantt-chart/
    │   ├── components/Layout/Header.jsx (수정)
    │   ├── GanttChartApp.jsx (수정)
    │   └── utils/csvUtils.js (신규)
    ├── knowledge-graph/
    │   ├── components/Layout/Header.jsx (수정)
    │   ├── KnowledgeGraphApp.jsx (수정)
    │   └── utils/csvUtils.js (신규)
    └── tech-radar/
        ├── components/Layout/Header.jsx (수정)
        ├── TechRadarApp.jsx (수정)
        └── utils/csvUtils.js (신규)
```

## 백업 파일

리팩토링 과정에서 다음 백업 파일들이 생성되었습니다:
- `Header.jsx.backup20250902`
- `GanttChartApp.jsx.backup20250902`
- `KnowledgeGraphApp.jsx.backup20250902`
- `TechRadarApp.jsx.backup20250902`

## 향후 개선사항

1. **Excel 파일 지원**: XLSX 형식 import/export
2. **대용량 파일 처리**: 스트리밍 방식 CSV 처리
3. **템플릿 다운로드**: 각 모듈별 CSV 템플릿 제공
4. **배치 처리**: 여러 파일 동시 처리
5. **데이터 매핑**: 컬럼 매핑 UI 제공