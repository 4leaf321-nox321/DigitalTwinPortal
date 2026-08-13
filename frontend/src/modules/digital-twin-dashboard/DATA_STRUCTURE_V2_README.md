# 디지털 트윈 대시보드 데이터 구조 개선 (v2.0)

## 🔄 주요 변경사항

### 데이터 구조 분리
기존의 프로젝트 중심 구조에서 **metadata, projects, performances 3개의 최상위 구분**으로 개선되었습니다.

#### 이전 구조 (v1.0)
```javascript
project = {
  id: 'VD-1',
  // ... 기본 정보
  성과목록: [
    {
      대분류: '리드타임단축',
      소분류: '검증·분석시간', 
      성과항목: 'AI 예측으로 인한 설계 검증 시간 단축',
      과제기여도: '80',
      현재수준: '120',
      목표수준: '60',
      실적수준: '95',
      단위: 'hours'
    }
  ]
}
```

#### 새로운 구조 (v2.0)
```javascript
// 1. 메타데이터
metadata = {
  version: '2.0',
  projectCount: 12,
  performanceCount: 18,
  settings: { currentYear: 2025, viewMode: 'dashboard' }
}

// 2. 글로벌 성과 항목들 (독립적 관리)
performance = {
  id: 'perf_ai_prediction_time',
  성과항목: 'AI 예측으로 인한 설계 검증 시간 단축',
  대분류: '리드타임단축',
  소분류: '검증·분석시간',
  단위: 'hours',
  현재수준: '120',
  목표수준: '60',
  실적수준: '',
  설명: 'AI 기반 예측 모델을 통한 설계 검증 시간 단축'
}

// 3. 프로젝트 (성과는 ID로 참조)
project = {
  id: 'VD-1',
  // ... 기본 정보
  성과목록: [
    {
      id: 'perf_ai_prediction_time',  // 성과 ID 참조
      과제기여도: '80',              // 프로젝트별 기여도
      실적수준: '95'                 // 프로젝트별 실적
    }
  ]
}
```

## 📁 새로운 파일 구조

```
utils/
├── dataStructure.js          # 메인 데이터 관리 (metadata, projects, performances)
└── projectPerformanceLink.js # 프로젝트-성과 연결 유틸리티

data/
├── sampleData.js            # 기존 레거시 샘플 데이터 (호환성 유지)
└── sampleDataV2.js          # 새로운 구조의 샘플 데이터
```

## 🔧 주요 함수

### 데이터 구조 관리 (dataStructure.js)
```javascript
// 메타데이터
loadMetadata()
saveMetadata(metadata)
updateMetadata(updates)

// 성과 항목 관리
loadPerformances()
savePerformances(performances)
addPerformance(performanceData)
updatePerformance(performanceId, updates)
deletePerformance(performanceId)

// 프로젝트 관리
loadProjects()
saveProjects(projects)
addProject(projectData)
updateProject(projectId, updates)
deleteProject(projectId)

// 마이그레이션 및 유틸리티
migrateLegacyData(legacyProjects)
clearAllData()
createBackup()
validateData()
```

### 프로젝트-성과 연결 (projectPerformanceLink.js)
```javascript
// 연결된 데이터 조회
getProjectPerformancesWithData(project, globalPerformances)
getAllProjectsWithPerformanceData(projects, globalPerformances)
convertProjectsToLegacyFormat(projects, globalPerformances)

// 검색 및 분석
searchPerformances(filters, globalPerformances)
searchProjects(filters, projects, globalPerformances)
calculateProjectPerformanceStats(project, globalPerformances)
calculateOverallPerformanceStats(projects, globalPerformances)
```

## 💾 로컬 스토리지 구조

### 스토리지 키
```javascript
'digitalTwinDashboard_metadata'      // 메타데이터
'digitalTwinDashboard_projects'      // 프로젝트 목록
'digitalTwinDashboard_performances'  // 성과 항목 목록
```

### 백업 파일 형식
```json
{
  "timestamp": "2025-10-27T11:22:55.000Z",
  "version": "2.0",
  "metadata": { /* 메타데이터 */ },
  "projects": [ /* 프로젝트 배열 */ ],
  "performances": [ /* 성과 항목 배열 */ ]
}
```

## 🔄 마이그레이션 프로세스

1. **자동 감지**: 기존 레거시 데이터가 있으면 자동으로 마이그레이션 수행
2. **성과 추출**: 모든 프로젝트에서 성과 항목을 추출하여 글로벌 목록 생성
3. **중복 제거**: 동일한 성과 항목은 하나로 통합 (이름+대분류+소분류 기준)
4. **ID 생성**: 각 성과 항목에 고유 ID 할당
5. **참조 변환**: 프로젝트의 성과목록을 ID 참조 방식으로 변경

## 🎯 장점

### 1. 성과 항목 재사용성
- 동일한 성과 항목을 여러 프로젝트에서 공유 가능
- 성과 정의 일관성 보장
- 중복 데이터 제거

### 2. 데이터 일관성
- 성과 항목 수정 시 모든 연결된 프로젝트에 자동 반영
- 성과 항목 삭제 시 관련 프로젝트에서 자동 제거
- 데이터 무결성 검증 기능

### 3. 확장성
- 새로운 메타데이터 필드 추가 용이
- 성과 항목별 상세 정보 확장 가능
- 프로젝트-성과 관계 분석 기능 향상

### 4. 성능 개선
- 성과 항목별 통계 계산 최적화
- 프로젝트 검색 성능 향상
- 메모리 사용량 감소

## 🔧 개발 가이드

### 새로운 성과 항목 추가
```javascript
import { addPerformance } from './utils/dataStructure';

const newPerformance = {
  성과항목: '새로운 성과 명',
  대분류: '기술혁신',
  소분류: '시뮬레이션 정확도',
  단위: '%',
  현재수준: '75',
  목표수준: '90',
  설명: '성과 설명'
};

const updatedPerformances = addPerformance(newPerformance);
```

### 프로젝트에 성과 연결
```javascript
import { addPerformanceToProject } from './utils/dataStructure';

addPerformanceToProject('VD-1', 'perf_ai_prediction_time', '80');
```

### 연결된 데이터 조회 (기존 컴포넌트 호환)
```javascript
import { convertProjectsToLegacyFormat } from './utils/projectPerformanceLink';

const legacyProjects = convertProjectsToLegacyFormat(projects, globalPerformances);
// 기존 컴포넌트에서 그대로 사용 가능
```

## ⚠️ 주의사항

### 1. 기존 컴포넌트 호환성
- 기존 컴포넌트들은 `convertProjectsToLegacyFormat()` 함수를 통해 호환성 유지
- UI 컴포넌트 수정 없이 새로운 데이터 구조 적용

### 2. 데이터 백업 권장
- 구조 변경 전 백업 생성 (`Header`의 "백업 생성" 버튼 사용)
- 마이그레이션 중 오류 발생 시 데이터 복구 가능

### 3. 성과 ID 변경 금지
- 성과 항목의 ID는 한 번 생성되면 변경하지 말 것
- ID 변경 시 모든 프로젝트 연결이 깨짐

## 🐛 디버깅

### 데이터 검증
```javascript
import { validateData } from './utils/dataStructure';

const validation = validateData();
if (!validation.isValid) {
  console.error('Validation errors:', validation.errors);
  console.warn('Validation warnings:', validation.warnings);
}
```

### 로컬 스토리지 확인
```javascript
// 브라우저 개발자 도구 콘솔에서
localStorage.getItem('digitalTwinDashboard_metadata');
localStorage.getItem('digitalTwinDashboard_projects');
localStorage.getItem('digitalTwinDashboard_performances');
```

### 마이그레이션 로그 확인
- 브라우저 콘솔에서 마이그레이션 진행 상황 확인 가능
- 성과 항목 생성 및 프로젝트 변환 과정이 상세히 기록됨

## 📈 향후 개선 계획

1. **성과 항목 카테고리 관리**: 대분류/소분류 동적 관리 기능
2. **성과 템플릿**: 자주 사용하는 성과 항목 템플릿 제공
3. **성과 분석 대시보드**: 성과별 통계 및 트렌드 분석
4. **프로젝트 성과 매트릭스**: 프로젝트-성과 관계 시각화
5. **데이터 내보내기 개선**: Excel, PDF 형식 지원

---

## 🚀 시작하기

1. 기존 데이터가 있는 경우 자동 마이그레이션됩니다.
2. 새로 설치하는 경우 샘플 데이터로 초기화됩니다.
3. "백업 생성" 버튼으로 정기적인 백업을 권장합니다.
4. 문제 발생 시 브라우저 콘솔에서 로그를 확인해주세요.
