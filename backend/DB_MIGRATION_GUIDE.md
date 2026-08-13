# DB 테이블 구조 마이그레이션 가이드

이 문서는 데이터베이스 테이블 구조를 오프라인 환경으로 마이그레이션하는 방법을 설명합니다.

> **주의**: 이 가이드는 테이블 구조(스키마)만 마이그레이션합니다. 기존 데이터는 포함되지 않습니다.

---

## 방법 A: Flask-Migrate 사용 (권장)

Flask-Migrate를 사용하면 마이그레이션 이력을 관리하면서 테이블을 생성할 수 있습니다.

### 1. 현재 환경에서 준비

`migrations` 폴더 전체를 복사합니다:

```
backend/
  migrations/
    alembic.ini
    env.py
    script.py.mako
    versions/
      92b5e89500e8_initial_migration.py
      e5f1df92778d_add_processdiagramdata_table.py
      ... (기타 마이그레이션 파일들)
```

### 2. 오프라인 환경에서 적용

```bash
cd backend

# 가상환경 활성화
# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

# 마이그레이션 적용 (빈 테이블 생성)
flask db upgrade
```

### 3. 특정 버전까지만 적용하기

```bash
# 특정 마이그레이션까지만 적용
flask db upgrade e5f1df92778d

# 현재 적용된 마이그레이션 확인
flask db current

# 마이그레이션 이력 보기
flask db history
```

---

## 방법 B: SQL 스키마 추출

PostgreSQL의 `pg_dump`를 사용하여 테이블 구조만 추출합니다.

### 1. 전체 스키마 추출

```bash
# 테이블 구조만 덤프 (데이터 제외)
pg_dump -h localhost -U postgres -d your_db_name --schema-only > schema.sql
```

### 2. 특정 테이블만 추출

```bash
# process_diagram_data 테이블만 추출
pg_dump -h localhost -U postgres -d your_db_name -t process_diagram_data --schema-only > process_diagram_table.sql

# 여러 테이블 추출
pg_dump -h localhost -U postgres -d your_db_name \
  -t users \
  -t process_diagram_data \
  -t digital_twin_projects \
  --schema-only > selected_tables.sql
```

### 3. 오프라인 환경에서 적용

```bash
psql -h localhost -U postgres -d your_db_name < schema.sql
```

---

## 현재 테이블 목록

### process_diagram_data (DX 부문 데이터/프로세스 가시화)

| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| id | Integer (PK) | 고유 ID |
| name | String(200) | 다이어그램 이름 |
| description | Text | 설명 |
| nodes | JSON | 노드 데이터 |
| edges | JSON | 연결선 데이터 |
| viewport | JSON | 뷰포트 정보 (x, y, zoom) |
| diagram_metadata | JSON | 추가 메타데이터 |
| created_by | Integer (FK) | 생성자 ID (users.id) |
| created_at | DateTime | 생성일시 |
| updated_at | DateTime | 수정일시 |

### 기타 테이블

- `users`: 사용자 정보
- `digital_twin_projects`: 디지털 트윈 과제 정보
- `organizations`: 조직 정보
- (기타 모듈별 테이블...)

---

## 마이그레이션 파일 생성 (개발 시)

새로운 모델을 추가했을 때 마이그레이션 파일 생성 방법:

```bash
# 1. 모델 변경 감지 및 마이그레이션 파일 생성
flask db migrate -m "Add new_table_name table"

# 2. 생성된 파일 확인 (migrations/versions/ 폴더)
# 3. 마이그레이션 적용
flask db upgrade
```

---

## 문제 해결

### 마이그레이션 충돌 시

```bash
# 현재 상태 확인
flask db current

# 특정 버전으로 다운그레이드
flask db downgrade <revision_id>

# 마이그레이션 이력 초기화 (주의: 기존 데이터 유지, alembic_version 테이블만 리셋)
# 1. alembic_version 테이블 삭제
# 2. flask db stamp head (현재 상태를 최신으로 마킹)
```

### 테이블이 이미 존재할 때

```bash
# 현재 DB 상태를 특정 마이그레이션 버전으로 마킹 (실제 마이그레이션 실행 없이)
flask db stamp <revision_id>

# 또는 최신 버전으로 마킹
flask db stamp head
```

---

## 참고 사항

- 마이그레이션 파일은 버전 관리(Git)에 포함시켜야 합니다.
- 프로덕션 환경에서는 `flask db upgrade` 전에 백업을 권장합니다.
- JSON 컬럼은 PostgreSQL의 JSONB 타입을 사용합니다.
