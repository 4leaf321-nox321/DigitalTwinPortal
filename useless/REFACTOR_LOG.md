# 리팩토링 백업 - 2025-08-30

## 리팩토링 전 구조
- 기존: Knowledge Graph 중심의 단일 모듈 구조
- 문제점: 확장성 부족, 공통 자원과 모듈별 자원 혼재

## 리팩토링 후 목표 구조
```
src/
├── shared/           # 공통 자원
├── pages/           # 페이지 컴포넌트
├── modules/         # 각 모듈별 독립 구조
└── routes/          # 라우팅 설정
```

## 백업 파일들
- App.jsx.backup-before-refactor
- components/ 전체 구조 백업됨
